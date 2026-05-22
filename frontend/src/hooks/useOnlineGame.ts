import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, set, onValue, get } from 'firebase/database';
import { db } from '../firebase';
import { initGame, applyAction } from '../game/gameLogic';
import type { GameState, GameAction, PlayerSide } from '../types/game';

export type OnlineStatus = 'idle' | 'waiting' | 'playing' | 'error';

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function useOnlineGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [myPlayer, setMyPlayer] = useState<PlayerSide>(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<OnlineStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // stale closure 対策
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;
  const roomIdRef = useRef<string | null>(null);
  roomIdRef.current = roomId;

  const createRoom = useCallback(async () => {
    const id = generateRoomId();
    const initialState = initGame('online');
    await set(ref(db, `rooms/${id}`), {
      stateJson: JSON.stringify(initialState),
      playerCount: 1,
      createdAt: Date.now(),
    });
    setRoomId(id);
    setMyPlayer(0);
    setStatus('waiting');
  }, []);

  const joinRoom = useCallback(async (id: string) => {
    const code = id.trim().toUpperCase();
    const snap = await get(ref(db, `rooms/${code}`));

    if (!snap.exists()) {
      setErrorMsg('ルームが見つかりません');
      setStatus('error');
      return;
    }
    const data = snap.val() as { playerCount: number };
    if (data.playerCount >= 2) {
      setErrorMsg('このルームは満員です');
      setStatus('error');
      return;
    }

    await set(ref(db, `rooms/${code}/playerCount`), 2);
    setRoomId(code);
    setMyPlayer(1);
    setStatus('playing');
  }, []);

  // Firebase リスナー
  useEffect(() => {
    if (!roomId) return;

    const unsubState = onValue(ref(db, `rooms/${roomId}/stateJson`), (snap) => {
      if (snap.exists()) {
        setState(JSON.parse(snap.val() as string) as GameState);
      }
    });

    const unsubPlayers = onValue(ref(db, `rooms/${roomId}/playerCount`), (snap) => {
      if (snap.exists() && (snap.val() as number) >= 2) {
        setStatus((prev) => (prev === 'waiting' ? 'playing' : prev));
      }
    });

    return () => {
      unsubState();
      unsubPlayers();
    };
  }, [roomId]);

  const dispatch = useCallback((action: GameAction) => {
    const cur = stateRef.current;
    const rid = roomIdRef.current;
    if (!cur || !rid) return;

    const next = applyAction(cur, action);
    void set(ref(db, `rooms/${rid}/stateJson`), JSON.stringify(next));
  }, []);

  const resetRoom = useCallback(() => {
    const rid = roomIdRef.current;
    if (!rid) return;
    const fresh = initGame('online');
    void set(ref(db, `rooms/${rid}/stateJson`), JSON.stringify(fresh));
  }, []);

  return { state, myPlayer, roomId, status, errorMsg, createRoom, joinRoom, dispatch, resetRoom };
}
