// トループカードの色
export type TroopColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

// タクティクカードの種類
export type TacticType =
  | 'alexander'    // Leader: ワイルドカード（任意の色・値）
  | 'darius'       // Leader: ワイルドカード（任意の色・値）
  | 'companion'    // Cavalry: 任意の色で値は8
  | 'shield'       // Infantry: 値は1-3の任意の色
  | 'fog'          // Environment: そのフラグはSum比較のみ
  | 'mud'          // Environment: そのフラグは4枚必要
  | 'scout'        // Morale: デッキから3枚引いて2枚戻す
  | 'deserter'     // Morale: 相手のタクティクカードを除去
  | 'traitor'      // Morale: 相手のトループカードを自分のフラグに移す
  | 'redeploy';    // Morale: 自分のカードを別のフラグへ移すか捨てる

export type CardType = 'troop' | 'tactic';

export interface TroopCard {
  id: string;
  type: 'troop';
  color: TroopColor;
  value: number; // 1-10
}

export interface TacticCard {
  id: string;
  type: 'tactic';
  tacticType: TacticType;
  // Leader/Cavalry/Infantry は値・色を選択できる
  assignedColor?: TroopColor;
  assignedValue?: number;
}

export type Card = TroopCard | TacticCard;

// フラグのプレイヤーサイド
export type PlayerSide = 0 | 1;

// フォーメーションの強さ
export type FormationType =
  | 'wedge'        // ストレートフラッシュ（同色連続3枚）最強
  | 'phalanx'      // スリーカード（同値3枚）
  | 'battalion'    // フラッシュ（同色3枚）
  | 'skirmish'     // ストレート（連続3枚）
  | 'host';        // ハイカード（合計値）

export interface Formation {
  type: FormationType;
  strength: number; // 比較用スコア
  cards: Card[];
}

export interface FlagSlot {
  cards: [Card[], Card[]]; // [player0の札, player1の札]
  claimed: PlayerSide | null;
  fog: boolean;    // Fogタクティクが置かれている
  mud: boolean;    // Mudタクティクが置かれている (4枚必要)
  fogCard: TacticCard | null;
  mudCard: TacticCard | null;
  fogPlayer: PlayerSide | null; // 霧を置いたプレイヤー
  mudPlayer: PlayerSide | null; // 泥を置いたプレイヤー
}

export type GameMode = 'ai' | 'local' | 'online';
export type GamePhase = 'setup' | 'playing' | 'ended';

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  flags: FlagSlot[];       // 9枚のフラグ
  hands: [Card[], Card[]]; // [player0の手札, player1の手札]
  troopDeck: TroopCard[];
  tacticDeck: TacticCard[];
  troopDeckCount: number;
  tacticDeckCount: number;
  currentPlayer: PlayerSide;
  winner: PlayerSide | null;
  winReason: string | null;
  // タクティクカードのルール: 相手より多くタクティクを使えない(差1まで)
  tacticUsed: [number, number];
  // Scout実行中の一時状態
  scoutState: ScoutState | null;
  // Redeployの一時状態
  redeployState: RedeployState | null;
  // Deserterの一時状態
  deserterState: DeserterState | null;
  // Traitorの一時状態
  traitorState: TraitorState | null;
  // 捨て札置き場
  discardPile: Card[];
  // 選択中のカード (UI用)
  selectedCard: Card | null;
  selectedCardFrom: 'hand' | null;
  // カードを引く待ち状態
  pendingDraw: PlayerSide | null;
  // カード配置後・フラッグ確保可能状態（ターン終了ボタン待ち）
  pendingEndTurn: PlayerSide | null;
  // ワイルドカード割り当て待ち
  pendingWildcard: PendingWildcard | null;
  // 戦術カード使用通知
  lastTacticMessage: string | null;
  tacticNotifyId: number;
}

export interface PendingWildcard {
  card: TacticCard;
  flagIndex: number;
  player: PlayerSide;
}

export interface ScoutState {
  player: PlayerSide;
  phase: 'select-decks' | 'return-cards'; // デッキ選択中 or 返却中
  drawnCards: Card[]; // 引いた3枚
  returnCount: number; // あと何枚戻す必要があるか
  returnedToTroop: Card[];
  returnedToTactic: Card[];
}

export interface RedeployState {
  player: PlayerSide;
  card: Card;
  sourceFlagIndex: number;
}

export interface DeserterState {
  player: PlayerSide;
  card: Card;
  sourceFlagIndex: number;
}

export interface TraitorState {
  player: PlayerSide;
  card: TroopCard;
  sourceFlagIndex: number;
}

// ゲームアクション
export type GameAction =
  | { type: 'PLAY_CARD'; player: PlayerSide; card: Card; flagIndex: number }
  | { type: 'PLAY_TACTIC_SCOUT'; player: PlayerSide }
  | { type: 'SCOUT_RETURN'; player: PlayerSide; card: Card; deck: 'troop' | 'tactic' }
  | { type: 'PLAY_TACTIC_DESERTER'; player: PlayerSide; sourceFlagIndex: number; card: Card }
  | { type: 'PLAY_TACTIC_TRAITOR'; player: PlayerSide; sourceFlagIndex: number; targetCard: TroopCard }
  | { type: 'TRAITOR_PLACE'; player: PlayerSide; destFlagIndex: number }
  | { type: 'TRAITOR_DISCARD'; player: PlayerSide }
  | { type: 'PLAY_TACTIC_REDEPLOY'; player: PlayerSide; sourceFlagIndex: number; card: Card }
  | { type: 'REDEPLOY_MOVE'; player: PlayerSide; destFlagIndex: number }
  | { type: 'REDEPLOY_DISCARD'; player: PlayerSide }
  | { type: 'CLAIM_FLAG'; player: PlayerSide; flagIndex: number }
  | { type: 'SELECT_CARD'; card: Card | null }
  | { type: 'ASSIGN_WILD'; card: TacticCard; flagIndex: number; color: TroopColor; value: number }
  | { type: 'CANCEL_WILDCARD'; player: PlayerSide }
  | { type: 'DRAW_CARD'; player: PlayerSide; deck: 'troop' | 'tactic' }
  | { type: 'SCOUT_DRAW'; player: PlayerSide; troopCount: number; tacticCount: number }
  | { type: 'PASS_TURN'; player: PlayerSide }
  | { type: 'END_TURN'; player: PlayerSide };

// オンライン通信用
export interface RoomInfo {
  roomId: string;
  players: string[];
  status: 'waiting' | 'playing' | 'ended';
}
