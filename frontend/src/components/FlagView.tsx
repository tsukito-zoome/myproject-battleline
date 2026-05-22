import type { FlagSlot, Card, PlayerSide, TacticCard } from '../types/game';
import { CardView } from './CardView';
import { evaluateFormation, requiredCards, formationLabel } from '../game/formations';
import styles from './FlagView.module.css';

interface Props {
  flag: FlagSlot;
  index: number;
  currentPlayer: PlayerSide;
  selectedCard: Card | null;
  isClaimable?: boolean;
  onFlagClick: (index: number) => void;
  onClaimClick: (index: number) => void;
  onFieldCardClick?: (card: Card) => void;
  onOppFieldCardClick?: (card: Card) => void;
  isOppCardClickable?: (card: Card) => boolean;
  isRedeployDest?: boolean;
  isDeserterDest?: boolean;
  isTraitorDest?: boolean;
}

export function FlagView({
  flag,
  index,
  currentPlayer,
  selectedCard,
  isClaimable,
  onFlagClick,
  onClaimClick,
  onFieldCardClick,
  onOppFieldCardClick,
  isOppCardClickable,
  isRedeployDest,
  isDeserterDest,
  isTraitorDest,
}: Props) {
  const needed = requiredCards(flag.mud);
  const oppPlayer = (currentPlayer === 0 ? 1 : 0) as PlayerSide;
  const myCards = flag.cards[currentPlayer];
  const oppCards = flag.cards[oppPlayer];

  const isFog = selectedCard?.type === 'tactic' && (selectedCard as TacticCard).tacticType === 'fog';
  const isMud = selectedCard?.type === 'tactic' && (selectedCard as TacticCard).tacticType === 'mud';
  const canPlaceFogMud =
    (isFog && !flag.fog && flag.claimed === null) ||
    (isMud && !flag.mud && flag.claimed === null);
  const canPlace = flag.claimed === null && !!selectedCard && (myCards.length < needed || canPlaceFogMud);
  const claimable =
    !!isClaimable &&
    !selectedCard &&
    !onFieldCardClick &&
    !onOppFieldCardClick &&
    !isRedeployDest &&
    !isDeserterDest &&
    !isTraitorDest;

  const claimedClass =
    flag.claimed === 0
      ? styles.claimedPlayer0
      : flag.claimed === 1
      ? styles.claimedPlayer1
      : '';

  const formLabel =
    myCards.length >= needed
      ? formationLabel(evaluateFormation(myCards, flag.fog).type)
      : '';
  const oppFormLabel =
    oppCards.length >= needed
      ? formationLabel(evaluateFormation(oppCards, flag.fog).type)
      : '';

  const flagSlotClass = [
    styles.flagSlot,
    claimedClass,
    canPlace ? styles.targetable : '',
    isRedeployDest ? styles.redeployTarget : '',
    isDeserterDest ? styles.deserterTarget : '',
    isTraitorDest ? styles.redeployTarget : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={flagSlotClass}>
      {/* 相手側（player1/AI）の札 */}
      <div className={styles.oppCards}>
        {oppFormLabel && <div className={styles.formLabel}>{oppFormLabel}</div>}
        <div className={styles.cardRow}>
          {oppCards.map((card) => (
            onOppFieldCardClick && flag.claimed === null && (!isOppCardClickable || isOppCardClickable(card)) ? (
              <button
                key={card.id}
                className={styles.redeploySourceCard}
                onClick={() => onOppFieldCardClick(card)}
              >
                <CardView card={card} small />
              </button>
            ) : (
              <CardView key={card.id} card={card} faceDown={false} small />
            )
          ))}
          {Array.from({ length: Math.max(0, needed - oppCards.length) }).map((_, i) => (
            <div key={`opp-empty-${i}`} className={styles.emptySlot} />
          ))}
        </div>
      </div>

      {/* 相手が置いた気象カード（フラグの上側） */}
      {(flag.fogPlayer === oppPlayer || flag.mudPlayer === oppPlayer) && (
        <div className={styles.weatherRow}>
          {flag.fogPlayer === oppPlayer && <span className={styles.weatherTag} title="霧">🌫️ 霧</span>}
          {flag.mudPlayer === oppPlayer && <span className={styles.weatherTag} title="泥">🟤 泥</span>}
        </div>
      )}

      {/* フラグ本体 */}
      <div
        className={[
          styles.flagCenter,
          claimable ? styles.claimable : '',
          isRedeployDest ? styles.redeployable : '',
          isDeserterDest ? styles.deserterRedeployable : '',
          isTraitorDest ? styles.redeployable : '',
        ].filter(Boolean).join(' ')}
        onClick={() => {
          if (claimable) {
            onClaimClick(index);
          } else if (isRedeployDest || isDeserterDest || isTraitorDest) {
            onFlagClick(index);
          } else if (canPlace) {
            onFlagClick(index);
          }
        }}
      >
        {flag.claimed !== null ? (
          <span className={styles.flagCaptured}>{flag.claimed === 0 ? '🏴' : '🚩'}</span>
        ) : (
          <span className={styles.flagNum}>{index + 1}</span>
        )}
        {claimable && <div className={styles.claimHint}>Click!</div>}
        {isRedeployDest && <div className={styles.claimHint}>移動</div>}
        {isDeserterDest && <div className={styles.claimHint}>移動</div>}
        {isTraitorDest && <div className={styles.claimHint}>配置</div>}
      </div>

      {/* 自分が置いた気象カード（フラグの下側） */}
      {(flag.fogPlayer === currentPlayer || flag.mudPlayer === currentPlayer) && (
        <div className={styles.weatherRow}>
          {flag.fogPlayer === currentPlayer && <span className={styles.weatherTag} title="霧">🌫️ 霧</span>}
          {flag.mudPlayer === currentPlayer && <span className={styles.weatherTag} title="泥">🟤 泥</span>}
        </div>
      )}

      {/* 自分側（player0）の札 */}
      <div className={styles.myCards}>
        <div className={styles.cardRow}>
          {myCards.map((card) => (
            onFieldCardClick && flag.claimed === null ? (
              <button
                key={card.id}
                className={styles.redeploySourceCard}
                onClick={() => onFieldCardClick(card)}
              >
                <CardView card={card} small />
              </button>
            ) : (
              <CardView key={card.id} card={card} small />
            )
          ))}
          {Array.from({ length: Math.max(0, needed - myCards.length) }).map((_, i) => (
            <div key={`my-empty-${i}`} className={styles.emptySlot} />
          ))}
        </div>
        {formLabel && <div className={styles.formLabel}>{formLabel}</div>}
      </div>
    </div>
  );
}
