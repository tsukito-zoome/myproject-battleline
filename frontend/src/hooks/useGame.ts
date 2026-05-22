import { useReducer, useCallback, useEffect } from 'react';
import type { GameState, GameAction, GameMode } from '../types/game';
import { initGame, applyAction, canUseTactic } from '../game/gameLogic';
import { canClaim } from '../game/formations';

function gameReducer(state: GameState, action: GameAction): GameState {
  return applyAction(state, action);
}

export function useGame(mode: GameMode) {
  const [state, dispatch] = useReducer(gameReducer, mode, initGame);

  const reset = useCallback(() => {
    dispatch({ type: 'SELECT_CARD', card: null });
    // 強制リセットはreducer外で行うためページリロードを促す形にする
    // （実際はApp側でkeyを変えてコンポーネントを再マウント）
  }, []);

  // AIの自動行動
  useEffect(() => {
    if (state.mode !== 'ai') return;
    if (state.phase !== 'playing') return;
    if (
      state.currentPlayer !== 1 &&
      state.pendingDraw !== 1 &&
      state.pendingEndTurn !== 1 &&
      state.pendingWildcard?.player !== 1 &&
      state.scoutState?.player !== 1 &&
      state.redeployState?.player !== 1 &&
      state.traitorState?.player !== 1
    ) return;

    const delay = setTimeout(() => {
      // フラッグ自動確保
      for (let i = 0; i < 9; i++) {
        const flag = state.flags[i];
        if (flag.claimed !== null) continue;
        if (canClaim(flag.cards[1], flag.cards[0], flag.mud, flag.fog, state.flags, [])) {
          dispatch({ type: 'CLAIM_FLAG', player: 1, flagIndex: i });
          return;
        }
      }

      // ワイルドカード割り当て待ち
      if (state.pendingWildcard?.player === 1) {
        const { card, flagIndex } = state.pendingWildcard;
        const value = card.tacticType === 'companion' ? 8
          : card.tacticType === 'shield' ? 3
          : 10;
        dispatch({ type: 'ASSIGN_WILD', card, flagIndex, color: 'red', value });
        return;
      }

      // ターン終了ボタン待ち — 自動でターン終了
      if (state.pendingEndTurn === 1) {
        dispatch({ type: 'END_TURN', player: 1 });
        return;
      }

      // カード引き待ち — 常にトループデッキから引く（なければタクティク）
      if (state.pendingDraw === 1) {
        const deck = state.troopDeckCount > 0 ? 'troop' : 'tactic';
        dispatch({ type: 'DRAW_CARD', player: 1, deck });
        return;
      }

      // 配置転換: Phase2 — 常に捨て場へ
      if (state.redeployState?.player === 1) {
        dispatch({ type: 'REDEPLOY_DISCARD', player: 1 });
        return;
      }

      // 裏切り: Phase2 — 空きのある最初の自分のフラグに配置、なければ捨て場へ
      if (state.traitorState?.player === 1) {
        for (let i = 0; i < 9; i++) {
          const flag = state.flags[i];
          if (flag.claimed !== null) continue;
          const needed = flag.mud ? 4 : 3;
          if (flag.cards[1].length < needed) {
            dispatch({ type: 'TRAITOR_PLACE', player: 1, destFlagIndex: i });
            return;
          }
        }
        // 配置先がなければ捨て場へ
        dispatch({ type: 'TRAITOR_DISCARD', player: 1 });
        return;
      }

      // 偵察: デッキ選択フェーズ
      if (state.scoutState?.player === 1 && state.scoutState.phase === 'select-decks') {
        const troopAvail = state.troopDeckCount;
        const tacticAvail = state.tacticDeckCount;
        // できるだけ多くトループを引く（2+1優先）
        const troop = Math.min(2, troopAvail);
        const tactic = Math.min(3 - troop, tacticAvail);
        dispatch({ type: 'SCOUT_DRAW', player: 1, troopCount: troop, tacticCount: tactic });
        return;
      }

      // 偵察: カード返却フェーズ — 最も弱いカードを戻す
      if (state.scoutState?.player === 1 && state.scoutState.phase === 'return-cards') {
        const hand = state.hands[1];
        // トループカードの中で最も低い値を戻す
        const troopCards = hand.filter((c) => c.type === 'troop');
        if (troopCards.length > 0) {
          const weakest = troopCards.reduce(
            (min, c) => (c.type === 'troop' && c.value < (min as any).value ? c : min),
            troopCards[0]
          );
          dispatch({ type: 'SCOUT_RETURN', player: 1, card: weakest, deck: 'troop' });
        } else if (hand.length > 0) {
          // トループがなければ最初の戦術カードを戻す
          dispatch({ type: 'SCOUT_RETURN', player: 1, card: hand[0], deck: 'tactic' });
        }
        return;
      }

      // 通常行動
      let bestFlagIndex = -1;
      let bestCard = null;
      let bestScore = -Infinity;

      const hand = state.hands[1];

      // Scout: 手札が少ない場合に優先使用
      const scoutCard = hand.find((c) => c.type === 'tactic' && (c as any).tacticType === 'scout');
      if (scoutCard && hand.length <= 5 && state.tacticUsed[1] <= state.tacticUsed[0]) {
        dispatch({ type: 'SELECT_CARD', card: scoutCard });
        dispatch({ type: 'PLAY_TACTIC_SCOUT', player: 1 });
        return;
      }

      // Deserter: 相手フィールドの弱いカードを捨てる
      const deserterCard = hand.find((c) => c.type === 'tactic' && (c as any).tacticType === 'deserter');
      if (deserterCard && state.tacticUsed[1] <= state.tacticUsed[0]) {
        const oppFieldCards: { flagIndex: number; card: import('../types/game').Card }[] = [];
        for (let i = 0; i < 9; i++) {
          const flag = state.flags[i];
          if (flag.claimed !== null) continue;
          for (const card of flag.cards[0]) {
            oppFieldCards.push({ flagIndex: i, card });
          }
        }
        if (oppFieldCards.length > 0) {
          const weakest = oppFieldCards.reduce((min, cur) => {
            const minVal = min.card.type === 'troop' ? min.card.value : 5;
            const curVal = cur.card.type === 'troop' ? cur.card.value : 5;
            return curVal < minVal ? cur : min;
          }, oppFieldCards[0]);
          // 相手の強いカード（値7以上）があれば優先して脱走を使う
          const strongCards = oppFieldCards.filter((e) => e.card.type === 'troop' && e.card.value >= 7);
          const target = strongCards.length > 0
            ? strongCards.reduce((max, cur) => (cur.card.type === 'troop' && cur.card.value > (max.card as any).value ? cur : max), strongCards[0])
            : weakest;
          dispatch({ type: 'SELECT_CARD', card: deserterCard });
          dispatch({ type: 'PLAY_TACTIC_DESERTER', player: 1, sourceFlagIndex: target.flagIndex, card: target.card });
          return;
        }
      }

      // Traitor: 相手フィールドの強い部隊カードを奪う
      const traitorCard = hand.find((c) => c.type === 'tactic' && (c as any).tacticType === 'traitor');
      if (traitorCard && state.tacticUsed[1] <= state.tacticUsed[0]) {
        const oppTroopCards: { flagIndex: number; card: import('../types/game').TroopCard }[] = [];
        for (let i = 0; i < 9; i++) {
          const flag = state.flags[i];
          if (flag.claimed !== null) continue;
          for (const c of flag.cards[0]) {
            if (c.type === 'troop') oppTroopCards.push({ flagIndex: i, card: c as import('../types/game').TroopCard });
          }
        }
        if (oppTroopCards.length > 0) {
          const target = oppTroopCards.reduce((max, cur) => cur.card.value > max.card.value ? cur : max, oppTroopCards[0]);
          const hasSpace = state.flags.some((f) => f.claimed === null && f.cards[1].length < (f.mud ? 4 : 3));
          if (hasSpace && target.card.value >= 7) {
            dispatch({ type: 'SELECT_CARD', card: traitorCard });
            dispatch({ type: 'PLAY_TACTIC_TRAITOR', player: 1, sourceFlagIndex: target.flagIndex, targetCard: target.card });
            return;
          }
        }
      }

      // Redeploy: フィールドに弱いカードがあれば使う（AI は常に捨てる）
      const redeployCard = hand.find((c) => c.type === 'tactic' && (c as any).tacticType === 'redeploy');
      if (redeployCard && state.tacticUsed[1] <= state.tacticUsed[0]) {
        const fieldCards: { flagIndex: number; card: import('../types/game').Card }[] = [];
        for (let i = 0; i < 9; i++) {
          const flag = state.flags[i];
          if (flag.claimed !== null) continue;
          for (const card of flag.cards[1]) {
            fieldCards.push({ flagIndex: i, card });
          }
        }
        if (fieldCards.length > 0) {
          const weakest = fieldCards.reduce((min, cur) => {
            const minVal = min.card.type === 'troop' ? min.card.value : 5;
            const curVal = cur.card.type === 'troop' ? cur.card.value : 5;
            return curVal < minVal ? cur : min;
          }, fieldCards[0]);
          if (weakest.card.type === 'troop' && weakest.card.value <= 3) {
            dispatch({ type: 'SELECT_CARD', card: redeployCard });
            dispatch({ type: 'PLAY_TACTIC_REDEPLOY', player: 1, sourceFlagIndex: weakest.flagIndex, card: weakest.card });
            return;
          }
        }
      }

      const aiCanTactic = canUseTactic(state, 1);
      for (const card of hand) {
        for (let i = 0; i < 9; i++) {
          const flag = state.flags[i];
          if (flag.claimed !== null) continue;
          const needed = flag.mud ? 4 : 3;
          if (flag.cards[1].length >= needed) continue;
          // タクティクカードは使用可能かつ配置系のみ
          if (card.type === 'tactic') {
            if (!aiCanTactic) continue;
            if (!['alexander', 'darius', 'companion', 'shield', 'fog', 'mud'].includes((card as any).tacticType)) continue;
          }

          const score = 100 - Math.abs(i - 4) + flag.cards[1].length * 10;
          if (score > bestScore) {
            bestScore = score;
            bestCard = card;
            bestFlagIndex = i;
          }
        }
      }

      if (bestCard && bestFlagIndex >= 0) {
        dispatch({ type: 'SELECT_CARD', card: bestCard });
        dispatch({ type: 'PLAY_CARD', player: 1, card: bestCard, flagIndex: bestFlagIndex });
      } else {
        // 配置できる場所がない → パス
        dispatch({ type: 'PASS_TURN', player: 1 });
      }
    }, 800);

    return () => clearTimeout(delay);
  }, [state]);

  return { state, dispatch, reset };
}
