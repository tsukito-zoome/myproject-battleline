import { useState } from 'react';
import type { OnlineStatus } from '../hooks/useOnlineGame';
import styles from './OnlineLobby.module.css';

interface Props {
  status: OnlineStatus;
  roomId: string | null;
  errorMsg: string;
  onCreateRoom: () => void;
  onJoinRoom: (id: string) => void;
  onBack: () => void;
}

export function OnlineLobby({ status, roomId, errorMsg, onCreateRoom, onJoinRoom, onBack }: Props) {
  const [inputCode, setInputCode] = useState('');

  if (status === 'waiting' && roomId) {
    return (
      <div className={styles.lobby}>
        <h2 className={styles.title}>ルームを作成しました</h2>
        <p className={styles.hint}>このコードを相手に伝えてください</p>
        <div className={styles.roomCode}>{roomId}</div>
        <p className={styles.waiting}>相手の接続を待っています...</p>
        <div className={styles.spinner} />
        <button className={styles.backBtn} onClick={onBack}>← キャンセル</button>
      </div>
    );
  }

  return (
    <div className={styles.lobby}>
      <h2 className={styles.title}>オンライン対戦</h2>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>ルームを作成</h3>
        <p className={styles.hint}>作成したコードを相手に伝えます</p>
        <button
          className={styles.createBtn}
          onClick={onCreateRoom}
          disabled={status !== 'idle' && status !== 'error'}
        >
          ルームを作成する
        </button>
      </div>

      <div className={styles.divider}>または</div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>ルームに参加</h3>
        <p className={styles.hint}>相手から受け取ったコードを入力</p>
        <div className={styles.joinRow}>
          <input
            className={styles.codeInput}
            type="text"
            placeholder="XXXXXX"
            maxLength={6}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          />
          <button
            className={styles.joinBtn}
            onClick={() => onJoinRoom(inputCode)}
            disabled={inputCode.length < 6}
          >
            参加
          </button>
        </div>
        {status === 'error' && <p className={styles.error}>{errorMsg}</p>}
      </div>

      <button className={styles.backBtn} onClick={onBack}>← 戻る</button>
    </div>
  );
}
