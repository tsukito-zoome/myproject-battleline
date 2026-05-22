import type { Card, TacticCard, Formation, FormationType } from './types';

function resolveCard(card: Card): { color: string; value: number } | null {
  if (card.type === 'troop') return { color: card.color, value: card.value };
  const t = card as TacticCard;
  if (['alexander', 'darius'].includes(t.tacticType) && t.assignedColor && t.assignedValue) {
    return { color: t.assignedColor, value: t.assignedValue };
  }
  if (t.tacticType === 'companion' && t.assignedColor) return { color: t.assignedColor, value: 8 };
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

export function evaluateFormation(cards: Card[], fog: boolean): Formation {
  if (fog) return { type: 'host', strength: formationScore('host', cards), cards };

  const resolved = cards.map(resolveCard);
  if (resolved.some((r) => r === null)) return { type: 'host', strength: formationScore('host', cards), cards };

  const vals = resolved.map((r) => r!.value).sort((a, b) => a - b);
  const colors = resolved.map((r) => r!.color);
  const allSameColor = colors.every((c) => c === colors[0]);
  const allSameVal = vals.every((v) => v === vals[0]);
  const isConsecutive = vals[2] - vals[1] === 1 && vals[1] - vals[0] === 1;

  let type: FormationType;
  if (allSameColor && isConsecutive) type = 'wedge';
  else if (allSameVal) type = 'phalanx';
  else if (allSameColor) type = 'battalion';
  else if (isConsecutive) type = 'skirmish';
  else type = 'host';

  return { type, strength: formationScore(type, cards), cards };
}

function formationScore(type: FormationType, cards: Card[]): number {
  const RANK: Record<FormationType, number> = {
    wedge: 5_000_000, phalanx: 4_000_000, battalion: 3_000_000, skirmish: 2_000_000, host: 1_000_000,
  };
  return RANK[type] + sum(cards);
}

export function canClaim(myCards: Card[], oppCards: Card[], mud: boolean, fog: boolean): boolean {
  const needed = requiredCards(mud);
  if (myCards.length < needed) return false;
  const myForm = evaluateFormation(myCards.slice(0, needed), fog);
  const maxOppStrength = oppCards.length >= needed
    ? evaluateFormation(oppCards.slice(0, needed), fog).strength
    : Infinity;
  return myForm.strength > maxOppStrength;
}

export function requiredCards(mud: boolean): number {
  return mud ? 4 : 3;
}
