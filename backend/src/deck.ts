import type { TroopCard, TacticCard, TroopColor, TacticType } from './types';

const COLORS: TroopColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const TACTIC_TYPES: TacticType[] = [
  'alexander', 'darius', 'companion', 'shield',
  'fog', 'mud',
  'scout', 'deserter', 'traitor', 'redeploy',
];

export function createTroopDeck(): TroopCard[] {
  const deck: TroopCard[] = [];
  for (const color of COLORS) {
    for (let value = 1; value <= 10; value++) {
      deck.push({ id: `troop-${color}-${value}`, type: 'troop', color, value });
    }
  }
  return shuffle(deck);
}

export function createTacticDeck(): TacticCard[] {
  return shuffle(
    TACTIC_TYPES.map((t) => ({ id: `tactic-${t}`, type: 'tactic' as const, tacticType: t }))
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
