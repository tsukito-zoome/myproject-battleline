// フロントエンドと共有の型定義

export type TroopColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export type TacticType =
  | 'alexander' | 'darius' | 'companion' | 'shield'
  | 'fog' | 'mud'
  | 'scout' | 'deserter' | 'traitor' | 'redeploy';

export type CardType = 'troop' | 'tactic';

export interface TroopCard {
  id: string;
  type: 'troop';
  color: TroopColor;
  value: number;
}

export interface TacticCard {
  id: string;
  type: 'tactic';
  tacticType: TacticType;
  assignedColor?: TroopColor;
  assignedValue?: number;
}

export type Card = TroopCard | TacticCard;
export type PlayerSide = 0 | 1;
export type FormationType = 'wedge' | 'phalanx' | 'battalion' | 'skirmish' | 'host';

export interface Formation {
  type: FormationType;
  strength: number;
  cards: Card[];
}

export interface FlagSlot {
  cards: [Card[], Card[]];
  claimed: PlayerSide | null;
  fog: boolean;
  mud: boolean;
  fogCard: TacticCard | null;
  mudCard: TacticCard | null;
}

export type GameMode = 'ai' | 'local' | 'online';
export type GamePhase = 'setup' | 'playing' | 'ended';

export interface ScoutState {
  player: PlayerSide;
  drawnCards: Card[];
  returnCount: number;
  returnedToTroop: Card[];
  returnedToTactic: Card[];
}

export interface RedeployState {
  player: PlayerSide;
  card: Card;
  sourceFlagIndex: number;
}

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  flags: FlagSlot[];
  hands: [Card[], Card[]];
  troopDeck: TroopCard[];
  tacticDeck: TacticCard[];
  troopDeckCount: number;
  tacticDeckCount: number;
  currentPlayer: PlayerSide;
  winner: PlayerSide | null;
  winReason: string | null;
  tacticUsed: [number, number];
  scoutState: ScoutState | null;
  redeployState: RedeployState | null;
  selectedCard: Card | null;
  selectedCardFrom: 'hand' | null;
}

export type GameAction =
  | { type: 'PLAY_CARD'; player: PlayerSide; card: Card; flagIndex: number }
  | { type: 'PLAY_TACTIC_SCOUT'; player: PlayerSide }
  | { type: 'SCOUT_RETURN'; player: PlayerSide; card: Card; deck: 'troop' | 'tactic' }
  | { type: 'PLAY_TACTIC_DESERTER'; player: PlayerSide; targetFlagIndex: number; targetCard: TacticCard }
  | { type: 'PLAY_TACTIC_TRAITOR'; player: PlayerSide; targetFlagIndex: number; targetCard: TroopCard; destFlagIndex: number }
  | { type: 'PLAY_TACTIC_REDEPLOY'; player: PlayerSide; sourceFlagIndex: number; card: Card }
  | { type: 'REDEPLOY_MOVE'; player: PlayerSide; destFlagIndex: number }
  | { type: 'REDEPLOY_DISCARD'; player: PlayerSide }
  | { type: 'CLAIM_FLAG'; player: PlayerSide; flagIndex: number }
  | { type: 'SELECT_CARD'; card: Card | null }
  | { type: 'ASSIGN_WILD'; card: TacticCard; flagIndex: number; color: TroopColor; value: number };
