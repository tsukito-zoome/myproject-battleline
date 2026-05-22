import type {
  GameState, GameAction, FlagSlot, Card, TroopCard, TacticCard,
  PlayerSide, GameMode, ScoutState,
} from './types';
import { createTroopDeck, createTacticDeck } from './deck';
import { canClaim, requiredCards } from './formations';

const FLAG_COUNT = 9;
const INITIAL_HAND_SIZE = 7;

function createInitialFlags(): FlagSlot[] {
  return Array.from({ length: FLAG_COUNT }, () => ({
    cards: [[], []] as [Card[], Card[]],
    claimed: null,
    fog: false,
    mud: false,
    fogCard: null,
    mudCard: null,
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
    mode, phase: 'playing', flags: createInitialFlags(), hands,
    troopDeck, tacticDeck,
    troopDeckCount: troopDeck.length, tacticDeckCount: tacticDeck.length,
    currentPlayer: 0, winner: null, winReason: null,
    tacticUsed: [0, 0], scoutState: null, redeployState: null,
    selectedCard: null, selectedCardFrom: null,
  };
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_CARD':
      return { ...state, selectedCard: action.card, selectedCardFrom: action.card ? 'hand' : null };
    case 'PLAY_CARD':
      return playCard(state, action.player, action.card, action.flagIndex);
    case 'CLAIM_FLAG':
      return claimFlag(state, action.player, action.flagIndex);
    default:
      return state;
  }
}

function playCard(state: GameState, player: PlayerSide, card: Card, flagIndex: number): GameState {
  const flag = state.flags[flagIndex];
  const needed = requiredCards(flag.mud);
  if (flag.claimed !== null || flag.cards[player].length >= needed) return state;

  const newFlags = state.flags.map((f, i) => {
    if (i !== flagIndex) return f;
    const newSide = [...f.cards[player], card];
    const newCards: [Card[], Card[]] = [
      player === 0 ? newSide : f.cards[0],
      player === 1 ? newSide : f.cards[1],
    ];
    if (card.type === 'tactic') {
      const t = card as TacticCard;
      if (t.tacticType === 'fog') return { ...f, cards: newCards, fog: true, fogCard: t };
      if (t.tacticType === 'mud') return { ...f, cards: newCards, mud: true, mudCard: t };
    }
    return { ...f, cards: newCards };
  });

  const newHands: [Card[], Card[]] = [state.hands[0].slice(), state.hands[1].slice()];
  newHands[player] = newHands[player].filter((c) => c.id !== card.id);

  const newTacticUsed: [number, number] = [...state.tacticUsed] as [number, number];
  if (card.type === 'tactic') newTacticUsed[player]++;

  let { troopDeck } = state;
  if (troopDeck.length > 0) {
    const [drawn, ...rest] = troopDeck;
    newHands[player] = [...newHands[player], drawn];
    troopDeck = rest;
  }

  const next: GameState = {
    ...state, flags: newFlags, hands: newHands, troopDeck,
    troopDeckCount: troopDeck.length,
    tacticUsed: newTacticUsed,
    currentPlayer: (player === 0 ? 1 : 0) as PlayerSide,
    selectedCard: null, selectedCardFrom: null,
  };
  return checkVictory(next);
}

function claimFlag(state: GameState, player: PlayerSide, flagIndex: number): GameState {
  const flag = state.flags[flagIndex];
  if (flag.claimed !== null) return state;
  const opp = (player === 0 ? 1 : 0) as PlayerSide;
  if (!canClaim(flag.cards[player], flag.cards[opp], flag.mud, flag.fog)) return state;
  const newFlags = state.flags.map((f, i) => i === flagIndex ? { ...f, claimed: player } : f);
  return checkVictory({ ...state, flags: newFlags });
}

function checkVictory(state: GameState): GameState {
  const claimed = state.flags.map((f) => f.claimed);
  for (const p of [0, 1] as PlayerSide[]) {
    const count = claimed.filter((c) => c === p).length;
    if (count >= 5) return { ...state, phase: 'ended', winner: p, winReason: `${count}枚のフラグを獲得` };
  }
  for (const p of [0, 1] as PlayerSide[]) {
    for (let i = 0; i <= FLAG_COUNT - 3; i++) {
      if (claimed[i] === p && claimed[i + 1] === p && claimed[i + 2] === p) {
        return { ...state, phase: 'ended', winner: p, winReason: '連続3枚のフラグを獲得' };
      }
    }
  }
  return state;
}
