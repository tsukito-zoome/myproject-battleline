import type { GameState, Card, PlayerSide, TroopCard, TacticCard } from '../types/game';
import { applyAction } from './gameLogic';
import { evaluateFormation, canClaim, requiredCards } from './formations';

const AI_PLAYER: PlayerSide = 1;

// フラグの優先度スコア（高いほど優先）
function flagPriority(state: GameState, flagIndex: number): number {
  const flag = state.flags[flagIndex];
  if (flag.claimed !== null) return -1000;

  const myCards = flag.cards[AI_PLAYER];
  const oppCards = flag.cards[0];
  const needed = requiredCards(flag.mud);

  // 既に相手が埋めていてこちらが勝てない場合はスキップ
  if (oppCards.length === needed && myCards.length < needed) {
    const oppForm = evaluateFormation(oppCards, flag.fog);
    if (myCards.length > 0) {
      const myForm = evaluateFormation(myCards, flag.fog);
      if (oppForm.strength > myForm.strength) return -500;
    }
  }

  let score = 0;
  // 自分のカードが多いほど優先
  score += myCards.length * 20;
  // 相手のカードが多いほど守る必要がある
  score += oppCards.length * 10;
  // 連続性ボーナス（隣接フラグを取ると連続3枚になる可能性）
  const claimed = state.flags.map((f) => f.claimed);
  if (flagIndex > 0 && claimed[flagIndex - 1] === AI_PLAYER) score += 30;
  if (flagIndex < 8 && claimed[flagIndex + 1] === AI_PLAYER) score += 30;

  return score;
}

// カードをフラグに置いたときの期待スコア
function cardFlagScore(state: GameState, card: Card, flagIndex: number): number {
  const flag = state.flags[flagIndex];
  if (flag.claimed !== null) return -9999;

  const needed = requiredCards(flag.mud);
  const myCards = flag.cards[AI_PLAYER];
  if (myCards.length >= needed) return -9999;

  const tentative = [...myCards, card];
  const form = evaluateFormation(tentative, flag.fog);
  return form.strength + flagPriority(state, flagIndex);
}

export function getAIAction(state: GameState): (() => GameState) {
  const hand = state.hands[AI_PLAYER];
  if (hand.length === 0) return () => state;

  // タクティクカードを含む場合の処理
  for (const card of hand) {
    if (card.type === 'tactic') {
      const t = card as TacticCard;
      // Scout: 手札が少ない場合に使う
      if (t.tacticType === 'scout' && hand.length <= 5) {
        return () =>
          applyAction({ ...state, selectedCard: card, selectedCardFrom: 'hand' }, {
            type: 'PLAY_TACTIC_SCOUT',
            player: AI_PLAYER,
          });
      }
      // Fog/Mud: フラグに置く（争っているフラグへ）
      if (t.tacticType === 'fog' || t.tacticType === 'mud') {
        let bestFlag = -1;
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
          const f = state.flags[i];
          if (f.claimed !== null) continue;
          if (f.fog && t.tacticType === 'fog') continue;
          if (f.mud && t.tacticType === 'mud') continue;
          // 相手が有利なフラグに置く
          const score = flagPriority(state, i) - f.cards[AI_PLAYER].length * 5;
          if (score > bestScore) { bestScore = score; bestFlag = i; }
        }
        if (bestFlag >= 0) {
          return () =>
            applyAction({ ...state, selectedCard: card, selectedCardFrom: 'hand' }, {
              type: 'PLAY_CARD',
              player: AI_PLAYER,
              card,
              flagIndex: bestFlag,
            });
        }
      }
    }
  }

  // トループカード（またはLeader/Cavalry/Shield）をフラグに置く
  let bestCard: Card | null = null;
  let bestFlag = -1;
  let bestScore = -Infinity;

  for (const card of hand) {
    if (card.type === 'tactic') {
      const t = card as TacticCard;
      if (!['alexander', 'darius', 'companion', 'shield'].includes(t.tacticType)) continue;
    }

    for (let i = 0; i < 9; i++) {
      const flag = state.flags[i];
      if (flag.claimed !== null) continue;
      const needed = requiredCards(flag.mud);
      if (flag.cards[AI_PLAYER].length >= needed) continue;

      let c = card;
      // ワイルドカードへの仮割り当て
      if (card.type === 'tactic') {
        const t = card as TacticCard;
        if (t.tacticType === 'companion') {
          c = { ...t, assignedColor: 'red', assignedValue: 8 };
        } else if (t.tacticType === 'shield') {
          c = { ...t, assignedColor: 'red', assignedValue: 3 };
        } else {
          c = { ...t, assignedColor: 'red', assignedValue: 10 };
        }
      }

      const score = cardFlagScore(state, c, i);
      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
        bestFlag = i;
      }
    }
  }

  if (bestCard && bestFlag >= 0) {
    const card = bestCard;
    const flagIndex = bestFlag;
    return () =>
      applyAction({ ...state, selectedCard: card, selectedCardFrom: 'hand' }, {
        type: 'PLAY_CARD',
        player: AI_PLAYER,
        card,
        flagIndex,
      });
  }

  // 手が打てない場合はそのまま
  return () => state;
}

export function getAIScoutReturns(state: GameState): (() => GameState) {
  const { scoutState, hands } = state;
  if (!scoutState || scoutState.player !== AI_PLAYER) return () => state;

  const hand = hands[AI_PLAYER];
  // 最も弱いカードをトループデッキに戻す
  const troopCards = hand.filter((c): c is TroopCard => c.type === 'troop');
  if (troopCards.length === 0) return () => state;

  const weakest = troopCards.reduce((min, c) => (c.value < min.value ? c : min), troopCards[0]);
  return () =>
    applyAction(state, { type: 'SCOUT_RETURN', player: AI_PLAYER, card: weakest, deck: 'troop' });
}
