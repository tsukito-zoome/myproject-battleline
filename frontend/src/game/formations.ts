import type { Card, TroopCard, TacticCard, Formation, FormationType, FlagSlot, TroopColor } from '../types/game';

// カードを「実質的なトループ」として解釈する（ワイルド系はassignedを使用）
function resolveCard(card: Card): { color: string; value: number } | null {
  if (card.type === 'troop') return { color: card.color, value: card.value };
  const t = card as TacticCard;
  if (
    (t.tacticType === 'alexander' || t.tacticType === 'darius') &&
    t.assignedColor && t.assignedValue
  ) {
    return { color: t.assignedColor, value: t.assignedValue };
  }
  if (t.tacticType === 'companion' && t.assignedColor) {
    return { color: t.assignedColor, value: 8 };
  }
  if (t.tacticType === 'shield' && t.assignedColor && t.assignedValue) {
    return { color: t.assignedColor, value: t.assignedValue };
  }
  return null;
}

function sum(cards: Card[]): number {
  return cards.reduce((acc, c) => {
    const r = resolveCard(c);
    return acc + (r ? r.value : 0);
  }, 0);
}

// フォーメーション種別とスコアを計算（3枚または泥の場合4枚）
export function evaluateFormation(cards: Card[], fog: boolean): Formation {
  if (fog) {
    return { type: 'host', strength: formationScore('host', cards), cards };
  }

  const resolved = cards.map(resolveCard);
  const hasUnassigned = resolved.some((r) => r === null);
  if (hasUnassigned) {
    return { type: 'host', strength: formationScore('host', cards), cards };
  }

  const vals = resolved.map((r) => r!.value).sort((a, b) => a - b);
  const colors = resolved.map((r) => r!.color);

  const allSameColor = colors.every((c) => c === colors[0]);
  const allSameVal = vals.every((v) => v === vals[0]);
  const isConsecutive = vals.every((v, i) => i === 0 || v === vals[i - 1] + 1);

  let type: FormationType;
  if (allSameColor && isConsecutive) {
    type = 'wedge';
  } else if (allSameVal) {
    type = 'phalanx';
  } else if (allSameColor) {
    type = 'battalion';
  } else if (isConsecutive) {
    type = 'skirmish';
  } else {
    type = 'host';
  }

  return { type, strength: formationScore(type, cards), cards };
}

function formationScore(type: FormationType, cards: Card[]): number {
  const RANK: Record<FormationType, number> = {
    wedge: 5_000_000,
    phalanx: 4_000_000,
    battalion: 3_000_000,
    skirmish: 2_000_000,
    host: 1_000_000,
  };
  return RANK[type] + sum(cards);
}

// 2つのフォーメーションを比較。positiveならfaが勝ち
export function compareFormations(fa: Formation, fb: Formation): number {
  return fa.strength - fb.strength;
}

// フラグの要求枚数（mud=4, 通常=3）
export function requiredCards(mud: boolean): number {
  return mud ? 4 : 3;
}

// ---- 証明(Proof)ルール ----

const ALL_COLORS: TroopColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

// ボード上・自分の手札にないトループカードをすべて返す（相手が引ける可能性のあるカード）
function getAvailableTroopCards(allFlags: FlagSlot[], myHand: Card[]): TroopCard[] {
  const usedKeys = new Set<string>();
  for (const flag of allFlags) {
    for (const sideCards of flag.cards) {
      for (const c of sideCards) {
        if (c.type === 'troop') {
          const t = c as TroopCard;
          usedKeys.add(`${t.color}:${t.value}`);
        }
      }
    }
  }
  for (const c of myHand) {
    if (c.type === 'troop') {
      const t = c as TroopCard;
      usedKeys.add(`${t.color}:${t.value}`);
    }
  }

  const avail: TroopCard[] = [];
  for (const color of ALL_COLORS) {
    for (let v = 1; v <= 10; v++) {
      if (!usedKeys.has(`${color}:${v}`)) {
        avail.push({ id: `_avail_${color}${v}`, type: 'troop', color, value: v });
      }
    }
  }
  return avail;
}

// 相手が available[startIdx..] から need 枚追加して myForm を上回れるか（早期終了）
// oppCards は呼び出し内で push/pop するミュータブル配列
function oppCanBeat(
  myForm: Formation,
  oppCards: Card[],
  available: TroopCard[],
  startIdx: number,
  need: number,
  fog: boolean
): boolean {
  if (need === 0) {
    return evaluateFormation(oppCards, fog).strength > myForm.strength;
  }
  const limit = available.length - need;
  for (let i = startIdx; i <= limit; i++) {
    oppCards.push(available[i]);
    if (oppCanBeat(myForm, oppCards, available, i + 1, need - 1, fog)) {
      oppCards.pop();
      return true;
    }
    oppCards.pop();
  }
  return false;
}

// フラグをclaimできるか判定
// allFlags と myHand を渡すと証明ルール（相手のフォーメーション未完成でも早期確保）も判定する
export function canClaim(
  myCards: Card[],
  oppCards: Card[],
  mud: boolean,
  fog: boolean,
  allFlags?: FlagSlot[],
  myHand?: Card[]
): boolean {
  const needed = requiredCards(mud);
  if (myCards.length < needed) return false;

  const myForm = evaluateFormation(myCards.slice(0, needed), fog);

  if (oppCards.length >= needed) {
    // 通常クレーム: 双方フォーメーション完成
    return myForm.strength > evaluateFormation(oppCards.slice(0, needed), fog).strength;
  }

  // 証明クレーム: 相手のフォーメーションが未完成だが、どのカードを追加しても自分に勝てない
  if (!allFlags || !myHand) return false;

  const available = getAvailableTroopCards(allFlags, myHand);
  const oppNeed = needed - oppCards.length;

  // available が足りない場合は相手はフォーメーションを完成できない → 証明成立
  if (available.length < oppNeed) return true;

  return !oppCanBeat(myForm, [...oppCards], available, 0, oppNeed, fog);
}

export function formationLabel(type: FormationType): string {
  const labels: Record<FormationType, string> = {
    wedge: 'ウェッジ',
    phalanx: 'ファランクス',
    battalion: 'バタリオン',
    skirmish: 'スカーミッシュ',
    host: 'ホスト',
  };
  return labels[type];
}
