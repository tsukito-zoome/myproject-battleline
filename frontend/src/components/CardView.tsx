import type { Card, TroopCard, TacticCard, TroopColor } from '../types/game';
import styles from './CardView.module.css';

const COLOR_MAP: Record<TroopColor, string> = {
  red: '#e74c3c',
  orange: '#e67e22',
  yellow: '#f1c40f',
  green: '#27ae60',
  blue: '#2980b9',
  purple: '#8e44ad',
};

const TACTIC_LABELS: Record<string, string> = {
  alexander: 'アレクサンダー',
  darius: 'ダリウス',
  companion: '騎兵隊',
  shield: '盾',
  fog: '霧',
  mud: '泥',
  scout: '偵察',
  deserter: '脱走',
  traitor: '裏切り',
  redeploy: '配置転換',
};

interface Props {
  card: Card;
  selected?: boolean;
  faceDown?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  small?: boolean;
}

export function CardView({ card, selected, faceDown, disabled, onClick, small }: Props) {
  if (faceDown) {
    return (
      <div
        className={`${styles.card} ${styles.faceDown} ${small ? styles.small : ''}`}
        onClick={onClick}
      />
    );
  }

  if (card.type === 'troop') {
    const t = card as TroopCard;
    return (
      <div
        className={`${styles.card} ${styles.troop} ${selected ? styles.selected : ''} ${small ? styles.small : ''}`}
        style={{ backgroundColor: COLOR_MAP[t.color], borderColor: selected ? '#fff' : COLOR_MAP[t.color] }}
        onClick={onClick}
        title={`${t.color} ${t.value}`}
      >
        <span className={styles.value}>{t.value}</span>
      </div>
    );
  }

  const t = card as TacticCard;

  // 色・値が割り当て済みのワイルドカードはトループカード風に表示
  if (t.assignedColor && t.assignedValue !== undefined) {
    return (
      <div
        className={`${styles.card} ${styles.troop} ${styles.assigned} ${selected ? styles.selected : ''} ${small ? styles.small : ''}`}
        style={{ backgroundColor: COLOR_MAP[t.assignedColor], borderColor: selected ? '#fff' : COLOR_MAP[t.assignedColor] }}
        onClick={onClick}
        title={`${TACTIC_LABELS[t.tacticType]}: ${t.assignedColor} ${t.assignedValue}`}
      >
        <span className={styles.value}>{t.assignedValue}</span>
        <span className={styles.assignedLabel}>{TACTIC_LABELS[t.tacticType]}</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.card} ${styles.tactic} ${selected ? styles.selected : ''} ${small ? styles.small : ''} ${disabled ? styles.disabled : ''}`}
      onClick={onClick}
      title={disabled ? '戦術カードは相手が使うまで使えません' : TACTIC_LABELS[t.tacticType]}
    >
      <span className={styles.tacticLabel}>{TACTIC_LABELS[t.tacticType]}</span>
    </div>
  );
}
