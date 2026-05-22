import type {
  GameState, GameAction, Card, TroopCard, TacticCard,
  TroopColor, TacticType, FlagSlot, PlayerSide, GameMode,
} from './types';
import { initGame, applyAction } from './gameLogic';

export class GameRoom {
  roomId: string;
  players: string[] = [];
  private state: GameState | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  addPlayer(socketId: string) {
    this.players.push(socketId);
  }

  startGame() {
    this.state = initGame('online');
  }

  applyAction(action: GameAction) {
    if (!this.state) return;
    this.state = applyAction(this.state, action);
  }

  // プレイヤーごとに相手の手札を非公開にした状態を返す
  getStateForPlayer(playerIndex: 0 | 1): Partial<GameState> & { opponentHandSize: number } {
    if (!this.state) return { opponentHandSize: 0 };
    const opp = playerIndex === 0 ? 1 : 0;
    return {
      ...this.state,
      hands: [
        playerIndex === 0 ? this.state.hands[0] : ([] as Card[]),
        playerIndex === 1 ? this.state.hands[1] : ([] as Card[]),
      ] as [Card[], Card[]],
      opponentHandSize: this.state.hands[opp].length,
    };
  }
}
