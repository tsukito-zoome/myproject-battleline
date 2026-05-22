import type { Card, PlayerSide } from '../types/game';
import { CardView } from './CardView';
import styles from './HandView.module.css';

interface Props {
  hand: Card[];
  selectedCard: Card | null;
  currentPlayer: PlayerSide;
  myPlayer: PlayerSide;
  canUseTactic: boolean;
  onCardClick: (card: Card) => void;
}

export function HandView({ hand, selectedCard, currentPlayer, myPlayer, canUseTactic, onCardClick }: Props) {
  const isMyTurn = currentPlayer === myPlayer;

  return (
    <div className={styles.hand}>
      {hand.map((card) => {
        const isTacticBlocked = card.type === 'tactic' && !canUseTactic;
        const clickable = isMyTurn && !isTacticBlocked;
        return (
          <CardView
            key={card.id}
            card={card}
            selected={selectedCard?.id === card.id}
            disabled={isTacticBlocked}
            onClick={clickable ? () => onCardClick(card) : undefined}
          />
        );
      })}
      {hand.length === 0 && <span className={styles.empty}>手札なし</span>}
    </div>
  );
}
