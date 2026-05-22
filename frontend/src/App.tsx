import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameMode, Card, PlayerSide, TacticCard, TroopCard } from './types/game';
import { useGame } from './hooks/useGame';
import { useOnlineGame } from './hooks/useOnlineGame';
import { Board } from './components/Board';
import { OnlineLobby } from './components/OnlineLobby';
import { RulesScreen } from './components/RulesScreen';
import styles from './App.module.css';

const MODAL_TACTICS = ['scout', 'redeploy', 'deserter', 'traitor'];

type Screen = 'menu' | 'game' | 'rules' | 'online';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [gameKey, setGameKey] = useState(0);

  const startGame = (mode: GameMode) => {
    if (mode === 'online') {
      setScreen('online');
      return;
    }
    setGameMode(mode);
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  return (
    <div>
      {screen === 'menu' ? (
        <MenuScreen onStart={startGame} onRules={() => setScreen('rules')} />
      ) : screen === 'rules' ? (
        <RulesScreen onBack={() => setScreen('menu')} />
      ) : screen === 'online' ? (
        <OnlineGameScreen onMenu={() => setScreen('menu')} />
      ) : (
        <GameScreen
          key={gameKey}
          mode={gameMode}
          onMenu={() => setScreen('menu')}
          onRestart={() => setGameKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function MenuScreen({ onStart, onRules }: { onStart: (mode: GameMode) => void; onRules: () => void }) {
  return (
    <div className={styles.menu}>
      <h1 className={styles.title}>バトルライン</h1>
      <p className={styles.subtitle}>Battle Line</p>
      <div className={styles.buttons}>
        <button className={styles.btn} onClick={() => onStart('ai')}>
          🤖 AI対戦
        </button>
        <button className={styles.btn} onClick={() => onStart('local')}>
          👥 ローカル対戦
        </button>
        <button className={styles.btn} onClick={() => onStart('online')}>
          🌐 オンライン対戦
        </button>
        <button className={`${styles.btn} ${styles.btnRules}`} onClick={onRules}>
          📖 ルール説明
        </button>
      </div>
    </div>
  );
}

function GameScreen({
  mode,
  onMenu,
  onRestart,
}: {
  mode: GameMode;
  onMenu: () => void;
  onRestart: () => void;
}) {
  const { state, dispatch } = useGame(mode);
  const isLocal = mode === 'local';

  // ローカル対戦: myPlayer は state.currentPlayer に追従
  const myPlayer: PlayerSide = isLocal ? state.currentPlayer : 0;

  // 手番交代ハンドオフ
  const [handoffPlayer, setHandoffPlayer] = useState<PlayerSide | null>(null);
  const prevPlayerRef = useRef<PlayerSide | null>(null);
  useEffect(() => {
    if (!isLocal) return;
    if (state.phase !== 'playing') return;
    if (prevPlayerRef.current !== null && prevPlayerRef.current !== state.currentPlayer) {
      setHandoffPlayer(state.currentPlayer);
    }
    prevPlayerRef.current = state.currentPlayer;
  }, [state.currentPlayer, state.phase, isLocal]);

  const [tacticConfirm, setTacticConfirm] = useState<TacticCard | null>(null);
  const [tacticReady, setTacticReady] = useState(false);

  const handleCardClick = useCallback(
    (card: Card) => {
      if (state.currentPlayer !== myPlayer) return;
      if (state.pendingEndTurn === myPlayer) return;
      if (tacticConfirm) return;
      if (card.type === 'tactic' && MODAL_TACTICS.includes((card as TacticCard).tacticType)) {
        const t = card as TacticCard;
        if (state.selectedCard?.id === card.id) {
          setTacticConfirm(t);
        } else {
          dispatch({ type: 'SELECT_CARD', card });
        }
        return;
      }
      if (state.selectedCard?.id === card.id) {
        dispatch({ type: 'SELECT_CARD', card: null });
      } else {
        dispatch({ type: 'SELECT_CARD', card });
      }
    },
    [state, dispatch, tacticConfirm]
  );

  const handleTacticConfirm = useCallback(
    (yes: boolean) => {
      if (!tacticConfirm) return;
      if (yes) {
        if (tacticConfirm.tacticType === 'scout') {
          dispatch({ type: 'PLAY_TACTIC_SCOUT', player: myPlayer });
          setTacticConfirm(null);
        } else {
          setTacticConfirm(null);
          setTacticReady(true);
        }
      } else {
        dispatch({ type: 'SELECT_CARD', card: null });
        setTacticConfirm(null);
      }
    },
    [tacticConfirm, dispatch]
  );

  const handleFlagClick = useCallback(
    (flagIndex: number) => {
      // Traitor Phase2: 自分のフラグに配置
      if (state.traitorState?.player === myPlayer) {
        dispatch({ type: 'TRAITOR_PLACE', player: myPlayer, destFlagIndex: flagIndex });
        return;
      }
      // Redeploy Phase2: 移動先フラグを選択
      if (state.redeployState?.player === myPlayer) {
        dispatch({ type: 'REDEPLOY_MOVE', player: myPlayer, destFlagIndex: flagIndex });
        return;
      }

      if (!state.selectedCard) return;
      if (state.currentPlayer !== myPlayer) return;

      const card = state.selectedCard;
      if (card.type === 'tactic') {
        const t = card as TacticCard;
        if (t.tacticType === 'fog' || t.tacticType === 'mud') {
          dispatch({ type: 'PLAY_CARD', player: myPlayer, card, flagIndex });
          return;
        }
        if (t.tacticType === 'scout') {
          dispatch({ type: 'PLAY_TACTIC_SCOUT', player: myPlayer });
          return;
        }
        if (t.tacticType === 'redeploy' || t.tacticType === 'deserter' || t.tacticType === 'traitor') return;
      }
      dispatch({ type: 'PLAY_CARD', player: myPlayer, card, flagIndex });
    },
    [state, dispatch]
  );

  const handleFieldCardClick = useCallback(
    (flagIndex: number, card: Card) => {
      if (state.currentPlayer !== myPlayer) return;
      if (!state.selectedCard || !tacticReady) return;
      const sel = state.selectedCard as TacticCard;
      if (sel.type !== 'tactic') return;
      if (sel.tacticType === 'redeploy') {
        dispatch({ type: 'PLAY_TACTIC_REDEPLOY', player: myPlayer, sourceFlagIndex: flagIndex, card });
        setTacticReady(false);
      } else if (sel.tacticType === 'deserter') {
        dispatch({ type: 'PLAY_TACTIC_DESERTER', player: myPlayer, sourceFlagIndex: flagIndex, card });
        setTacticReady(false);
      } else if (sel.tacticType === 'traitor') {
        dispatch({ type: 'PLAY_TACTIC_TRAITOR', player: myPlayer, sourceFlagIndex: flagIndex, targetCard: card as TroopCard });
        setTacticReady(false);
      }
    },
    [state, dispatch, tacticReady]
  );

  const handlePassTurn = useCallback(() => {
    dispatch({ type: 'PASS_TURN', player: myPlayer });
  }, [dispatch, myPlayer]);

  const handleEndTurn = useCallback(() => {
    dispatch({ type: 'END_TURN', player: myPlayer });
  }, [dispatch, myPlayer]);

  const handleRedeployDiscard = useCallback(() => {
    dispatch({ type: 'REDEPLOY_DISCARD', player: myPlayer });
  }, [dispatch, myPlayer]);

  const handleClaimClick = useCallback(
    (flagIndex: number) => {
      dispatch({ type: 'CLAIM_FLAG', player: myPlayer, flagIndex });
    },
    [dispatch, myPlayer]
  );

  const handleDrawCard = useCallback(
    (deck: 'troop' | 'tactic') => {
      dispatch({ type: 'DRAW_CARD', player: myPlayer, deck });
    },
    [dispatch, myPlayer]
  );

  const handleAssignWild = useCallback(
    (card: TacticCard, flagIndex: number, color: import('./types/game').TroopColor, value: number) => {
      dispatch({ type: 'ASSIGN_WILD', card, flagIndex, color, value });
    },
    [dispatch]
  );

  const handleCancelWildcard = useCallback(() => {
    dispatch({ type: 'CANCEL_WILDCARD', player: myPlayer });
  }, [dispatch, myPlayer]);

  const handleScoutDraw = useCallback(
    (troopCount: number, tacticCount: number) => {
      dispatch({ type: 'SCOUT_DRAW', player: myPlayer, troopCount, tacticCount });
    },
    [dispatch, myPlayer]
  );

  const handleScoutReturn = useCallback(
    (card: Card) => {
      const deck = card.type === 'troop' ? 'troop' : 'tactic';
      dispatch({ type: 'SCOUT_RETURN', player: myPlayer, card, deck });
    },
    [dispatch, myPlayer]
  );

  return (
    <div className={styles.gameWrapper}>
      <div className={styles.gameNav}>
        <button className={styles.navBtn} onClick={onMenu}>
          ← メニュー
        </button>
        <button className={styles.navBtn} onClick={onRestart}>
          🔄 リスタート
        </button>
      </div>
      <Board
        state={state}
        myPlayer={myPlayer}
        onCardClick={handleCardClick}
        onFlagClick={handleFlagClick}
        onClaimClick={handleClaimClick}
        onDrawCard={handleDrawCard}
        onAssignWild={handleAssignWild}
        onScoutDraw={handleScoutDraw}
        onScoutReturn={handleScoutReturn}
        onFieldCardClick={handleFieldCardClick}
        onRedeployDiscard={handleRedeployDiscard}
        onCancelWildcard={handleCancelWildcard}
        tacticConfirm={tacticConfirm}
        tacticReady={tacticReady}
        onTacticConfirm={handleTacticConfirm}
        onPassTurn={handlePassTurn}
        onEndTurn={handleEndTurn}
        onMenu={onMenu}
        onRestart={onRestart}
      />

      {/* ローカル対戦: 手番交代ハンドオフ画面 */}
      {isLocal && handoffPlayer !== null && state.phase === 'playing' && (
        <div className={styles.handoffOverlay}>
          <div className={styles.handoffCard}>
            <div className={styles.handoffPlayerNum}>プレイヤー {handoffPlayer + 1}</div>
            <div className={styles.handoffMessage}>の番です</div>
            <p className={styles.handoffHint}>
              端末を渡してから<br />「スタート」を押してください
            </p>
            <button
              className={styles.handoffBtn}
              onClick={() => setHandoffPlayer(null)}
            >
              スタート ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OnlineGameScreen({ onMenu }: { onMenu: () => void }) {
  const { state, myPlayer, roomId, status, errorMsg, createRoom, joinRoom, dispatch, resetRoom } = useOnlineGame();

  const [tacticConfirm, setTacticConfirm] = useState<TacticCard | null>(null);
  const [tacticReady, setTacticReady] = useState(false);

  const handleCardClick = useCallback(
    (card: Card) => {
      if (!state || state.currentPlayer !== myPlayer) return;
      if (state.pendingEndTurn === myPlayer) return;
      if (tacticConfirm) return;
      if (card.type === 'tactic' && MODAL_TACTICS.includes((card as TacticCard).tacticType)) {
        const t = card as TacticCard;
        if (state.selectedCard?.id === card.id) {
          setTacticConfirm(t);
        } else {
          dispatch({ type: 'SELECT_CARD', card });
        }
        return;
      }
      if (state.selectedCard?.id === card.id) {
        dispatch({ type: 'SELECT_CARD', card: null });
      } else {
        dispatch({ type: 'SELECT_CARD', card });
      }
    },
    [state, dispatch, tacticConfirm, myPlayer]
  );

  const handleTacticConfirm = useCallback(
    (yes: boolean) => {
      if (!tacticConfirm) return;
      if (yes) {
        if (tacticConfirm.tacticType === 'scout') {
          dispatch({ type: 'PLAY_TACTIC_SCOUT', player: myPlayer });
          setTacticConfirm(null);
        } else {
          setTacticConfirm(null);
          setTacticReady(true);
        }
      } else {
        dispatch({ type: 'SELECT_CARD', card: null });
        setTacticConfirm(null);
      }
    },
    [tacticConfirm, dispatch, myPlayer]
  );

  const handleFlagClick = useCallback(
    (flagIndex: number) => {
      if (!state) return;
      if (state.traitorState?.player === myPlayer) {
        dispatch({ type: 'TRAITOR_PLACE', player: myPlayer, destFlagIndex: flagIndex });
        return;
      }
      if (state.redeployState?.player === myPlayer) {
        dispatch({ type: 'REDEPLOY_MOVE', player: myPlayer, destFlagIndex: flagIndex });
        return;
      }
      if (!state.selectedCard) return;
      if (state.currentPlayer !== myPlayer) return;
      const card = state.selectedCard;
      if (card.type === 'tactic') {
        const t = card as TacticCard;
        if (t.tacticType === 'fog' || t.tacticType === 'mud') {
          dispatch({ type: 'PLAY_CARD', player: myPlayer, card, flagIndex });
          return;
        }
        if (t.tacticType === 'scout') {
          dispatch({ type: 'PLAY_TACTIC_SCOUT', player: myPlayer });
          return;
        }
        if (t.tacticType === 'redeploy' || t.tacticType === 'deserter' || t.tacticType === 'traitor') return;
      }
      dispatch({ type: 'PLAY_CARD', player: myPlayer, card, flagIndex });
    },
    [state, dispatch, myPlayer]
  );

  const handleFieldCardClick = useCallback(
    (flagIndex: number, card: Card) => {
      if (!state || state.currentPlayer !== myPlayer || !state.selectedCard || !tacticReady) return;
      const sel = state.selectedCard as TacticCard;
      if (sel.type !== 'tactic') return;
      if (sel.tacticType === 'redeploy') {
        dispatch({ type: 'PLAY_TACTIC_REDEPLOY', player: myPlayer, sourceFlagIndex: flagIndex, card });
        setTacticReady(false);
      } else if (sel.tacticType === 'deserter') {
        dispatch({ type: 'PLAY_TACTIC_DESERTER', player: myPlayer, sourceFlagIndex: flagIndex, card });
        setTacticReady(false);
      } else if (sel.tacticType === 'traitor') {
        dispatch({ type: 'PLAY_TACTIC_TRAITOR', player: myPlayer, sourceFlagIndex: flagIndex, targetCard: card as TroopCard });
        setTacticReady(false);
      }
    },
    [state, dispatch, tacticReady, myPlayer]
  );

  const handleClaimClick = useCallback(
    (flagIndex: number) => dispatch({ type: 'CLAIM_FLAG', player: myPlayer, flagIndex }),
    [dispatch, myPlayer]
  );
  const handleDrawCard = useCallback(
    (deck: 'troop' | 'tactic') => dispatch({ type: 'DRAW_CARD', player: myPlayer, deck }),
    [dispatch, myPlayer]
  );
  const handleAssignWild = useCallback(
    (card: TacticCard, flagIndex: number, color: import('./types/game').TroopColor, value: number) =>
      dispatch({ type: 'ASSIGN_WILD', card, flagIndex, color, value }),
    [dispatch]
  );
  const handleCancelWildcard = useCallback(
    () => dispatch({ type: 'CANCEL_WILDCARD', player: myPlayer }),
    [dispatch, myPlayer]
  );
  const handleScoutDraw = useCallback(
    (troopCount: number, tacticCount: number) =>
      dispatch({ type: 'SCOUT_DRAW', player: myPlayer, troopCount, tacticCount }),
    [dispatch, myPlayer]
  );
  const handleScoutReturn = useCallback(
    (card: Card) => dispatch({ type: 'SCOUT_RETURN', player: myPlayer, card, deck: card.type === 'troop' ? 'troop' : 'tactic' }),
    [dispatch, myPlayer]
  );
  const handlePassTurn = useCallback(
    () => dispatch({ type: 'PASS_TURN', player: myPlayer }),
    [dispatch, myPlayer]
  );
  const handleEndTurn = useCallback(
    () => dispatch({ type: 'END_TURN', player: myPlayer }),
    [dispatch, myPlayer]
  );
  const handleRedeployDiscard = useCallback(
    () => dispatch({ type: 'REDEPLOY_DISCARD', player: myPlayer }),
    [dispatch, myPlayer]
  );

  if (status !== 'playing' || !state) {
    return (
      <OnlineLobby
        status={status}
        roomId={roomId}
        errorMsg={errorMsg}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onBack={onMenu}
      />
    );
  }

  return (
    <div className={styles.gameWrapper}>
      <div className={styles.gameNav}>
        <button className={styles.navBtn} onClick={onMenu}>← メニュー</button>
        <button className={styles.navBtn} onClick={resetRoom}>🔄 リスタート</button>
        {roomId && <span style={{ color: '#7f8c8d', fontSize: '0.8rem', marginLeft: 8 }}>Room: {roomId}</span>}
      </div>
      <Board
        state={state}
        myPlayer={myPlayer}
        onCardClick={handleCardClick}
        onFlagClick={handleFlagClick}
        onClaimClick={handleClaimClick}
        onDrawCard={handleDrawCard}
        onAssignWild={handleAssignWild}
        onScoutDraw={handleScoutDraw}
        onScoutReturn={handleScoutReturn}
        onFieldCardClick={handleFieldCardClick}
        onRedeployDiscard={handleRedeployDiscard}
        onCancelWildcard={handleCancelWildcard}
        tacticConfirm={tacticConfirm}
        tacticReady={tacticReady}
        onTacticConfirm={handleTacticConfirm}
        onPassTurn={handlePassTurn}
        onEndTurn={handleEndTurn}
        onMenu={onMenu}
        onRestart={resetRoom}
      />
    </div>
  );
}
