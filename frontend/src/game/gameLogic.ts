import type {
  GameState, GameAction, FlagSlot, Card, TroopCard, TacticCard,
  PlayerSide, GameMode, PendingWildcard,
} from '../types/game';
import { createTroopDeck, createTacticDeck } from './deck';
import { canClaim, evaluateFormation, compareFormations, requiredCards } from './formations';

const FLAG_COUNT = 9;
const INITIAL_HAND_SIZE = 7;

function createInitialFlags(): FlagSlot[] {
  return Array.from({ length: FLAG_COUNT }, () => ({
    cards: [[], []],
    claimed: null,
    fog: false,
    mud: false,
    fogCard: null,
    mudCard: null,
    fogPlayer: null,
    mudPlayer: null,
  }));
}

export function initGame(mode: GameMode): GameState {
  const troopDeck = createTroopDeck();
  const tacticDeck = createTacticDeck();

  const hands: [Card[], Card[]] = [
    troopDeck.splice(0, INITIAL_HAND_SIZE),
    troopDeck.splice(0, INITIAL_HAND_SIZE),
  ];

  return {
    mode,
    phase: 'playing',
    flags: createInitialFlags(),
    hands,
    troopDeck,
    tacticDeck,
    troopDeckCount: troopDeck.length,
    tacticDeckCount: tacticDeck.length,
    currentPlayer: 0,
    winner: null,
    winReason: null,
    tacticUsed: [0, 0],
    scoutState: null,
    redeployState: null,
    deserterState: null,
    traitorState: null,
    discardPile: [],
    selectedCard: null,
    selectedCardFrom: null,
    pendingDraw: null,
    pendingEndTurn: null,
    pendingWildcard: null,
    lastTacticMessage: null,
    tacticNotifyId: 0,
  };
}

const TACTIC_NAMES: Record<string, string> = {
  alexander: 'アレクサンダー', darius: 'ダリウス', companion: '騎兵隊', shield: '盾',
  fog: '霧', mud: '泥', scout: '偵察', deserter: '脱走', traitor: '裏切り', redeploy: '配置転換',
};

function tacticMsg(player: PlayerSide, tacticType: string): string {
  const name = TACTIC_NAMES[tacticType] ?? tacticType;
  return player === 0 ? `あなたが【${name}】を使用しました` : `AIが【${name}】を使用しました`;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_CARD':
      return { ...state, selectedCard: action.card, selectedCardFrom: action.card ? 'hand' : null };

    case 'PLAY_CARD':
      return playCard(state, action.player, action.card, action.flagIndex);

    case 'PLAY_TACTIC_SCOUT':
      return playScout(state, action.player);

    case 'SCOUT_RETURN':
      return scoutReturn(state, action.player, action.card, action.deck);

    case 'PLAY_TACTIC_DESERTER':
      return startDeserter(state, action.player, action.sourceFlagIndex, action.card);

    case 'PLAY_TACTIC_TRAITOR':
      return startTraitor(state, action.player, action.sourceFlagIndex, action.targetCard);

    case 'TRAITOR_PLACE':
      return finishTraitorPlace(state, action.player, action.destFlagIndex);

    case 'TRAITOR_DISCARD':
      return finishTraitorDiscard(state, action.player);

    case 'PASS_TURN':
      return endTurn({ ...state, selectedCard: null, selectedCardFrom: null }, action.player);

    case 'END_TURN':
      return performEndTurn(state, action.player);

    case 'PLAY_TACTIC_REDEPLOY':
      return startRedeploy(state, action.player, action.sourceFlagIndex, action.card);

    case 'REDEPLOY_MOVE':
      return finishRedeployMove(state, action.player, action.destFlagIndex);

    case 'REDEPLOY_DISCARD':
      return finishRedeployDiscard(state, action.player);

    case 'CLAIM_FLAG':
      return claimFlag(state, action.player, action.flagIndex);

    case 'ASSIGN_WILD':
      return assignWild(state, action.card, action.flagIndex, action.color, action.value);

    case 'CANCEL_WILDCARD':
      return cancelWildcard(state, action.player);

    case 'DRAW_CARD':
      return drawCard(state, action.player, action.deck);

    case 'SCOUT_DRAW':
      return scoutDraw(state, action.player, action.troopCount, action.tacticCount);

    default:
      return state;
  }
}

// ------- カード配置後・ターン終了ボタン待ち状態へ -------
function endTurn(state: GameState, player: PlayerSide): GameState {
  return {
    ...state,
    pendingEndTurn: player,
    pendingDraw: null,
    selectedCard: null,
    selectedCardFrom: null,
  };
}

// ------- ターン終了ボタン押下後・カード引き待ち状態へ -------
function performEndTurn(state: GameState, player: PlayerSide): GameState {
  // 両デッキが空なら即座にターン終了
  if (state.troopDeck.length === 0 && state.tacticDeck.length === 0) {
    return checkVictory({
      ...state,
      pendingDraw: null,
      pendingEndTurn: null,
      currentPlayer: (player === 0 ? 1 : 0) as PlayerSide,
      selectedCard: null,
      selectedCardFrom: null,
    });
  }

  return {
    ...state,
    pendingDraw: player,
    pendingEndTurn: null,
    selectedCard: null,
    selectedCardFrom: null,
  };
}

// ------- カードを引いてターン終了 -------
function drawCard(state: GameState, player: PlayerSide, deck: 'troop' | 'tactic'): GameState {
  if (state.pendingDraw !== player) return state;

  let { troopDeck, tacticDeck, hands } = state;
  const newHands: [Card[], Card[]] = [hands[0].slice(), hands[1].slice()];

  if (deck === 'troop' && troopDeck.length > 0) {
    const [drawn, ...rest] = troopDeck;
    newHands[player] = [...newHands[player], drawn];
    troopDeck = rest;
  } else if (deck === 'tactic' && tacticDeck.length > 0) {
    const [drawn, ...rest] = tacticDeck;
    newHands[player] = [...newHands[player], drawn];
    tacticDeck = rest;
  }

  return checkVictory({
    ...state,
    hands: newHands,
    troopDeck,
    tacticDeck,
    troopDeckCount: troopDeck.length,
    tacticDeckCount: tacticDeck.length,
    pendingDraw: null,
    currentPlayer: (player === 0 ? 1 : 0) as PlayerSide,
  });
}

// ------- 戦術カードを使えるか判定 -------
export function canUseTactic(state: GameState, player: PlayerSide): boolean {
  const opp = (player === 0 ? 1 : 0) as PlayerSide;
  return state.tacticUsed[player] <= state.tacticUsed[opp];
}

// ------- リーダーカードをすでにフィールドに持っているか -------
function hasLeaderOnField(state: GameState, player: PlayerSide): boolean {
  return state.flags.some(
    (flag) =>
      flag.claimed === null &&
      flag.cards[player].some(
        (c) =>
          c.type === 'tactic' &&
          ((c as TacticCard).tacticType === 'alexander' ||
            (c as TacticCard).tacticType === 'darius')
      )
  );
}

// ------- カードをフラグに置く -------
function playCard(state: GameState, player: PlayerSide, card: Card, flagIndex: number): GameState {
  const flag = state.flags[flagIndex];
  if (flag.claimed !== null) return state;
  if (card.type === 'tactic' && !canUseTactic(state, player)) return state;

  // --- 霧・泥：フォーメーション枠外に配置（隣接配置） ---
  if (card.type === 'tactic') {
    const t = card as TacticCard;
    if (t.tacticType === 'fog' || t.tacticType === 'mud') {
      if (t.tacticType === 'fog' && flag.fog) return state; // 既に霧あり
      if (t.tacticType === 'mud' && flag.mud) return state; // 既に泥あり

      const newFlags = state.flags.map((f, i) => {
        if (i !== flagIndex) return f;
        if (t.tacticType === 'fog') return { ...f, fog: true, fogCard: t, fogPlayer: player };
        return { ...f, mud: true, mudCard: t, mudPlayer: player };
      });
      const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
      newHands[player] = newHands[player].filter((c) => c.id !== card.id);
      const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
      newTacticUsed[player]++;
      return endTurn(
        { ...state, flags: newFlags, hands: newHands, tacticUsed: newTacticUsed, selectedCard: null, selectedCardFrom: null,
          lastTacticMessage: tacticMsg(player, t.tacticType), tacticNotifyId: state.tacticNotifyId + 1 },
        player
      );
    }
  }

  // --- 通常カード・その他タクティク：フォーメーション枠に配置 ---
  const needed = requiredCards(flag.mud);
  if (flag.cards[player].length >= needed) return state;

  // リーダーカード重複チェック
  if (card.type === 'tactic') {
    const t = card as TacticCard;
    if (
      (t.tacticType === 'alexander' || t.tacticType === 'darius') &&
      hasLeaderOnField(state, player)
    ) return state;
  }

  const newFlags = state.flags.map((f, i) => {
    if (i !== flagIndex) return f;
    const newSide = [...f.cards[player], card];
    const newCards: [Card[], Card[]] = [
      player === 0 ? newSide : f.cards[0],
      player === 1 ? newSide : f.cards[1],
    ];
    return { ...f, cards: newCards };
  });

  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = newHands[player].filter((c) => c.id !== card.id);

  const isTactic = card.type === 'tactic';
  const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
  if (isTactic) newTacticUsed[player]++;

  const next: GameState = {
    ...state,
    flags: newFlags,
    hands: newHands,
    tacticUsed: newTacticUsed,
    selectedCard: null,
    selectedCardFrom: null,
  };

  // ワイルド系タクティクは割り当てUIを待つ（ターン終了は割り当て後）
  if (card.type === 'tactic') {
    const t = card as TacticCard;
    if (
      t.tacticType === 'alexander' ||
      t.tacticType === 'darius' ||
      t.tacticType === 'companion' ||
      t.tacticType === 'shield'
    ) {
      return {
        ...next,
        pendingWildcard: { card: t, flagIndex, player } as PendingWildcard,
        lastTacticMessage: tacticMsg(player, t.tacticType),
        tacticNotifyId: state.tacticNotifyId + 1,
      };
    }
  }

  return endTurn(next, player);
}

// ------- Scout: Phase 1 — カードを手札から除去してデッキ選択待ちへ -------
function playScout(state: GameState, player: PlayerSide): GameState {
  if (!canUseTactic(state, player)) return state;

  const scoutCard = state.selectedCard!;
  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = newHands[player].filter((c) => c.id !== scoutCard.id);

  const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
  newTacticUsed[player]++;

  return {
    ...state,
    hands: newHands,
    tacticUsed: newTacticUsed,
    scoutState: {
      player,
      phase: 'select-decks',
      drawnCards: [],
      returnCount: 2,
      returnedToTroop: [],
      returnedToTactic: [],
    },
    selectedCard: null,
    selectedCardFrom: null,
    lastTacticMessage: tacticMsg(player, 'scout'),
    tacticNotifyId: state.tacticNotifyId + 1,
  };
}

// ------- Scout: Phase 2 — 指定枚数を各デッキから引いて手札に追加 -------
function scoutDraw(state: GameState, player: PlayerSide, troopCount: number, tacticCount: number): GameState {
  if (!state.scoutState || state.scoutState.phase !== 'select-decks') return state;

  let { troopDeck, tacticDeck } = state;
  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  const drawn: Card[] = [];

  for (let i = 0; i < troopCount && troopDeck.length > 0; i++) {
    drawn.push(troopDeck[0]);
    newHands[player] = [...newHands[player], troopDeck[0]];
    troopDeck = troopDeck.slice(1);
  }
  for (let i = 0; i < tacticCount && tacticDeck.length > 0; i++) {
    drawn.push(tacticDeck[0]);
    newHands[player] = [...newHands[player], tacticDeck[0]];
    tacticDeck = tacticDeck.slice(1);
  }

  return {
    ...state,
    hands: newHands,
    troopDeck,
    tacticDeck,
    troopDeckCount: troopDeck.length,
    tacticDeckCount: tacticDeck.length,
    scoutState: { ...state.scoutState, phase: 'return-cards', drawnCards: drawn },
  };
}

// ------- Scout: Phase 3 — 手札から1枚ずつ山札の一番上に戻す -------
function scoutReturn(state: GameState, player: PlayerSide, card: Card, deck: 'troop' | 'tactic'): GameState {
  if (!state.scoutState || state.scoutState.phase !== 'return-cards') return state;

  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = newHands[player].filter((c) => c.id !== card.id);

  let { troopDeck, tacticDeck } = state;
  const ss = state.scoutState;

  if (deck === 'troop') {
    troopDeck = [card as TroopCard, ...troopDeck];
  } else {
    tacticDeck = [card as TacticCard, ...tacticDeck];
  }

  const newReturnCount = ss.returnCount - 1;

  if (newReturnCount <= 0) {
    return checkVictory({
      ...state,
      hands: newHands,
      troopDeck,
      tacticDeck,
      troopDeckCount: troopDeck.length,
      tacticDeckCount: tacticDeck.length,
      scoutState: null,
      currentPlayer: (player === 0 ? 1 : 0) as PlayerSide,
    });
  }

  return {
    ...state,
    hands: newHands,
    troopDeck,
    tacticDeck,
    troopDeckCount: troopDeck.length,
    tacticDeckCount: tacticDeck.length,
    scoutState: { ...ss, returnCount: newReturnCount },
  };
}

// ------- Deserter — 脱走カードを捨て、相手カードを即座に捨て場へ -------
function startDeserter(
  state: GameState,
  player: PlayerSide,
  sourceFlagIndex: number,
  card: Card
): GameState {
  if (!canUseTactic(state, player)) return state;
  const opp = (player === 0 ? 1 : 0) as PlayerSide;

  const deserterCard = state.selectedCard!;
  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = newHands[player].filter((c) => c.id !== deserterCard.id);
  const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
  newTacticUsed[player]++;

  const newFlags = state.flags.map((f, i) => {
    if (i !== sourceFlagIndex) return f;
    const newOppCards = f.cards[opp].filter((c) => c.id !== card.id);
    const newCards: [Card[], Card[]] = [
      opp === 0 ? newOppCards : f.cards[0],
      opp === 1 ? newOppCards : f.cards[1],
    ];
    return { ...f, cards: newCards };
  });

  return endTurn({
    ...state,
    flags: newFlags,
    hands: newHands,
    tacticUsed: newTacticUsed,
    discardPile: [...state.discardPile, card],
    selectedCard: null,
    selectedCardFrom: null,
    lastTacticMessage: tacticMsg(player, 'deserter'),
    tacticNotifyId: state.tacticNotifyId + 1,
  }, player);
}

// ------- Traitor: Phase1 — 裏切りカードを捨て、相手カードをフラグから除去して待機 -------
function startTraitor(
  state: GameState,
  player: PlayerSide,
  sourceFlagIndex: number,
  targetCard: TroopCard
): GameState {
  if (!canUseTactic(state, player)) return state;
  const opp = (player === 0 ? 1 : 0) as PlayerSide;

  const traitorCard = state.selectedCard!;
  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = newHands[player].filter((c) => c.id !== traitorCard.id);
  const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
  newTacticUsed[player]++;

  const newFlags = state.flags.map((f, i) => {
    if (i !== sourceFlagIndex) return f;
    const newOppCards = f.cards[opp].filter((c) => c.id !== targetCard.id);
    const newCards: [Card[], Card[]] = [
      opp === 0 ? newOppCards : f.cards[0],
      opp === 1 ? newOppCards : f.cards[1],
    ];
    return { ...f, cards: newCards };
  });

  return {
    ...state,
    flags: newFlags,
    hands: newHands,
    tacticUsed: newTacticUsed,
    traitorState: { player, card: targetCard, sourceFlagIndex },
    selectedCard: null,
    selectedCardFrom: null,
    lastTacticMessage: tacticMsg(player, 'traitor'),
    tacticNotifyId: state.tacticNotifyId + 1,
  };
}

// ------- Traitor: Phase2 — 自分のフラグに配置 -------
function finishTraitorPlace(
  state: GameState,
  player: PlayerSide,
  destFlagIndex: number
): GameState {
  if (!state.traitorState) return state;
  const { card } = state.traitorState;

  const newFlags = state.flags.map((f, i) => {
    if (i !== destFlagIndex) return f;
    const needed = requiredCards(f.mud);
    if (f.cards[player].length >= needed || f.claimed !== null) return f;
    const newMyCards = [...f.cards[player], card];
    const newCards: [Card[], Card[]] = [
      player === 0 ? newMyCards : f.cards[0],
      player === 1 ? newMyCards : f.cards[1],
    ];
    return { ...f, cards: newCards };
  });

  return endTurn({ ...state, flags: newFlags, traitorState: null }, player);
}

// ------- Traitor: Phase2b — 配置できない場合は捨て場へ -------
function finishTraitorDiscard(state: GameState, player: PlayerSide): GameState {
  if (!state.traitorState) return state;
  const { card } = state.traitorState;
  return endTurn({
    ...state,
    traitorState: null,
    discardPile: [...state.discardPile, card],
  }, player);
}

// ------- Redeploy -------
function startRedeploy(
  state: GameState,
  player: PlayerSide,
  sourceFlagIndex: number,
  card: Card
): GameState {
  if (!canUseTactic(state, player)) return state;
  const redeployCard = state.selectedCard!;
  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = newHands[player].filter((c) => c.id !== redeployCard.id);
  const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
  newTacticUsed[player]++;

  const newFlags = state.flags.map((f, i) => {
    if (i !== sourceFlagIndex) return f;
    const newMyCards = f.cards[player].filter((c) => c.id !== card.id);
    const newCards: [Card[], Card[]] = [
      player === 0 ? newMyCards : f.cards[0],
      player === 1 ? newMyCards : f.cards[1],
    ];
    return { ...f, cards: newCards };
  });

  return {
    ...state,
    flags: newFlags,
    hands: newHands,
    tacticUsed: newTacticUsed,
    redeployState: { player, card, sourceFlagIndex },
    selectedCard: null,
    selectedCardFrom: null,
    lastTacticMessage: tacticMsg(player, 'redeploy'),
    tacticNotifyId: state.tacticNotifyId + 1,
  };
}

function finishRedeployMove(state: GameState, player: PlayerSide, destFlagIndex: number): GameState {
  if (!state.redeployState) return state;
  const { card } = state.redeployState;

  const newFlags = state.flags.map((f, i) => {
    if (i !== destFlagIndex) return f;
    const needed = requiredCards(f.mud);
    if (f.cards[player].length >= needed || f.claimed !== null) return f;
    const newMyCards = [...f.cards[player], card];
    const newCards: [Card[], Card[]] = [
      player === 0 ? newMyCards : f.cards[0],
      player === 1 ? newMyCards : f.cards[1],
    ];
    return { ...f, cards: newCards };
  });

  const next: GameState = { ...state, flags: newFlags, redeployState: null };
  return endTurn(next, player);
}

function finishRedeployDiscard(state: GameState, player: PlayerSide): GameState {
  if (!state.redeployState) return state;
  const { card } = state.redeployState;
  const next: GameState = {
    ...state,
    redeployState: null,
    discardPile: [...state.discardPile, card],
  };
  return endTurn(next, player);
}

// ------- フラグのclaim -------
function claimFlag(state: GameState, player: PlayerSide, flagIndex: number): GameState {
  const flag = state.flags[flagIndex];
  if (flag.claimed !== null) return state;

  const needed = requiredCards(flag.mud);
  const myCards = flag.cards[player];
  const oppCards = flag.cards[(player === 0 ? 1 : 0) as PlayerSide];

  if (!canClaim(myCards, oppCards, flag.mud, flag.fog, state.flags, [])) return state;

  const newFlags = state.flags.map((f, i) =>
    i === flagIndex ? { ...f, claimed: player } : f
  );

  return checkVictory({ ...state, flags: newFlags });
}

// ------- ワイルドカードへの値割り当て -------
function assignWild(
  state: GameState,
  card: TacticCard,
  flagIndex: number,
  color: import('../types/game').TroopColor,
  value: number
): GameState {
  const newFlags = state.flags.map((f, i) => {
    if (i !== flagIndex) return f;
    const updateSide = (cards: Card[]) =>
      cards.map((c) => (c.id === card.id ? { ...c, assignedColor: color, assignedValue: value } : c));
    return {
      ...f,
      cards: [updateSide(f.cards[0]), updateSide(f.cards[1])] as [Card[], Card[]],
    };
  });

  // pendingWildcard 中の割り当てはターン終了へ進む
  if (state.pendingWildcard) {
    const { player } = state.pendingWildcard;
    return endTurn({ ...state, flags: newFlags, pendingWildcard: null }, player);
  }
  return { ...state, flags: newFlags };
}

// ------- ワイルドカードキャンセル（手札に戻す） -------
function cancelWildcard(state: GameState, player: PlayerSide): GameState {
  if (!state.pendingWildcard) return state;
  const { card, flagIndex } = state.pendingWildcard;

  const newFlags = state.flags.map((f, i) => {
    if (i !== flagIndex) return f;
    const newPlayerCards = f.cards[player].filter((c) => c.id !== card.id);
    const newCards: [Card[], Card[]] = [
      player === 0 ? newPlayerCards : f.cards[0],
      player === 1 ? newPlayerCards : f.cards[1],
    ];
    return { ...f, cards: newCards };
  });

  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = [...newHands[player], card];

  const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
  newTacticUsed[player]--;

  return {
    ...state,
    flags: newFlags,
    hands: newHands,
    tacticUsed: newTacticUsed,
    pendingWildcard: null,
    selectedCard: null,
    selectedCardFrom: null,
  };
}

// ------- 勝利判定 -------
function checkVictory(state: GameState): GameState {
  const claimed = state.flags.map((f) => f.claimed);

  // 5枚以上取った
  for (const p of [0, 1] as PlayerSide[]) {
    const count = claimed.filter((c) => c === p).length;
    if (count >= 5) {
      return { ...state, phase: 'ended', winner: p, winReason: `${count}枚のフラグを獲得` };
    }
  }

  // 連続3枚取った
  for (const p of [0, 1] as PlayerSide[]) {
    for (let i = 0; i <= FLAG_COUNT - 3; i++) {
      if (claimed[i] === p && claimed[i + 1] === p && claimed[i + 2] === p) {
        return { ...state, phase: 'ended', winner: p, winReason: '連続3枚のフラグを獲得' };
      }
    }
  }

  return state;
}
