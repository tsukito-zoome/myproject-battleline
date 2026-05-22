import { RulesContent } from './RulesContent';
import styles from './RulesScreen.module.css';

interface Props {
  onBack: () => void;
}

export function RulesScreen({ onBack }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 戻る</button>
        <h1 className={styles.title}>ルール説明</h1>
        <div className={styles.headerSpacer} />
      </div>
      <div className={styles.scrollArea}>
        <div className={styles.contentWrapper}>
          <RulesContent />
        </div>
      </div>
    </div>
  );
}
