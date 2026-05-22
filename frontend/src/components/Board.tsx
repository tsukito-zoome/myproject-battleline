import { useState, useEffect } from 'react';
import type { Card, GameState, PlayerSide, TroopColor, TacticCard } from '../types/game';
import { FlagView } from './FlagView';
import { HandView } from './HandView';
import { CardView } from './CardView';
import { RulesContent } from './RulesContent';
import { canUseTactic } from '../game/gameLogic';
import { canClaim, requiredCards } from '../game/formations';
import styles from './Board.module.css';

interface Props {
  state: GameState;
  myPlayer: PlayerSide;
  onCardClick: (card: Card) => void;
  onFlagClick: (index: number) => void;
  onClaimClick: (index: number) => void;
  onDrawCard: (deck: 'troop' | 'tactic') => void;
  onAssignWild: (card: TacticCard, flagIndex: number, color: TroopColor, value: number) => void;
  onScoutDraw: (troopCount: number, tacticCount: number) => void;
  onScoutReturn: (card: Card) => void;
  onFieldCardClick: (flagIndex: number, card: Card) => void;
  onRedeployDiscard: () => void;
  onCancelWildcard: () => void;
  tacticConfirm: TacticCard | null;
  tacticReady: boolean;
  onTacticConfirm: (yes: boolean) => void;
  onPassTurn: () => void;
  onEndTurn: () => void;
  onMenu: () => void;
  onRestart: () => void;
}

function tacticName(t: string): string {
  const map: Record<string, string> = { scout: '偵察', redeploy: '配置転換', deserter: '脱走', traitor: '裏切り' };
  return map[t] ?? t;
}

export function Board({ state, myPlayer, onCardClick, onFlagClick, onClaimClick, onDrawCard, onAssignWild, onScoutDraw, onScoutReturn, onFieldCardClick, onRedeployDiscard, onCancelWildcard, tacticConfirm, tacticReady, onTacticConfirm, onPassTurn, onEndTurn, onMenu, onRestart }: Props) {
  const { flags, hands, currentPlayer, troopDeckCount, tacticDeckCount, phase, winner, winReason, scoutState, redeployState, deserterState, traitorState, discardPile } = state;
  const isAIMode = state.mode === 'ai';
  const isLocalMode = state.mode === 'local';

  const [toast, setToast] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  useEffect(() => {
    if (!state.lastTacticMessage) return;
    setToast(state.lastTacticMessage);
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [state.tacticNotifyId]);

  const oppPlayer = (myPlayer === 0 ? 1 : 0) as PlayerSide;
  const claimedByMe = flags.filter((f) => f.claimed === myPlayer).length;
  const claimedByOpp = flags.filter((f) => f.claimed === oppPlayer).length;

  // Redeploy Phase1: 配置転換カードが選択中かつ確認済み → 自分フィールドのカードをクリック可能に
  const isRedeploySource =
    currentPlayer === myPlayer &&
    tacticReady &&
    state.selectedCard?.type === 'tactic' &&
    (state.selectedCard as TacticCard).tacticType === 'redeploy';

  // Redeploy Phase2: redeployState が自分のもの → 移動先フラグを選択
  const isRedeployDest = redeployState?.player === myPlayer;

  // Deserter Phase1: 脱走カードが選択中かつ確認済み → 相手フィールドのカードをクリック可能に
  const isDeserterSource =
    currentPlayer === myPlayer &&
    tacticReady &&
    state.selectedCard?.type === 'tactic' &&
    (state.selectedCard as TacticCard).tacticType === 'deserter';

  // Deserter Phase2: deserterState が自分のもの → 相手の移動先フラグを選択
  const isDeserterDest = deserterState?.player === myPlayer;

  // Traitor Phase1: 裏切りカードが選択中かつ確認済み → 相手フィールドの部隊カードをクリック可能に
  const isTraitorSource =
    currentPlayer === myPlayer &&
    tacticReady &&
    state.selectedCard?.type === 'tactic' &&
    (state.selectedCard as TacticCard).tacticType === 'traitor';

  // Traitor Phase2: traitorState が自分のもの → 自分のフラグに配置
  const isTraitorDest = traitorState?.player === myPlayer;

  const isPendingEndTurn = state.pendingEndTurn === myPlayer;

  // パス判定: 通常ターンで自分のフォーメーション枠が全フラグで埋まっている場合
  const isNormalTurn =
    phase === 'playing' &&
    currentPlayer === myPlayer &&
    !state.pendingDraw &&
    !isPendingEndTurn &&
    !scoutState && !redeployState && !deserterState && !traitorState &&
    !state.pendingWildcard && !tacticConfirm;

  const noFormationSpace = isNormalTurn && !flags.some(
    (f) => f.claimed === null && f.cards[myPlayer].length < requiredCards(f.mud)
  );
  const myHand = hands[myPlayer];
  const hasTacticInHand = myHand.some((c) => c.type === 'tactic');
  const mustAutoPass = noFormationSpace && !hasTacticInHand;
  const showPassButton = noFormationSpace && hasTacticInHand && canUseTactic(state, myPlayer);

  return (
    <div className={styles.board}>
      {/* トースト通知 */}
      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}

      {/* ステータスバー */}
      <div className={styles.statusBar}>
        <div className={styles.deckInfo}>
          <span>トループ: {troopDeckCount}</span>
          <span>タクティク: {tacticDeckCount}</span>
        </div>
        <button className={styles.rulesBtn} onClick={() => setShowRules(true)}>ルール</button>
        <div className={styles.score}>
          {isLocalMode ? (
            <>
              <span className={styles.myScore}>P1: {flags.filter((f) => f.claimed === 0).length}</span>
              <span className={styles.vs}> vs </span>
              <span className={styles.oppScore}>P2: {flags.filter((f) => f.claimed === 1).length}</span>
            </>
          ) : (
            <>
              <span className={styles.myScore}>自分: {claimedByMe}</span>
              <span className={styles.vs}> vs </span>
              <span className={styles.oppScore}>{isAIMode ? 'AI' : '相手'}: {claimedByOpp}</span>
            </>
          )}
        </div>
        <div className={canUseTactic(state, myPlayer) ? styles.tacticAvail : styles.tacticUnavail}>
          戦術カード：{canUseTactic(state, myPlayer) ? '使用可能' : '使用不可'}
        </div>
        <div className={styles.turnInfo}>
          {phase === 'playing' ? (
            scoutState ? (
              <span className={styles.scoutHint}>偵察: あと{scoutState.returnCount}枚戻してください</span>
            ) : isPendingEndTurn ? (
              <span className={styles.myTurn}>フラグを確保してターン終了ボタンを押してください</span>
            ) : isRedeploySource ? (
              <span className={styles.redeployHint}>配置転換: フィールドのカードを選んでください</span>
            ) : isRedeployDest ? (
              <span className={styles.redeployHint}>配置転換: 移動先を選ぶか捨て場へ</span>
            ) : isDeserterSource ? (
              <span className={styles.redeployHint}>脱走: 相手フィールドのカードを選んでください</span>
            ) : isDeserterDest ? (
              <span className={styles.redeployHint}>脱走: 移動先を選ぶか捨て場へ</span>
            ) : isTraitorSource ? (
              <span className={styles.redeployHint}>裏切り: 相手の部隊カードを選んでください</span>
            ) : isTraitorDest ? (
              <span className={styles.redeployHint}>裏切り: 配置先のフラグを選んでください</span>
            ) : mustAutoPass ? (
              <span className={styles.scoutHint}>配置できる場所がありません</span>
            ) : showPassButton ? (
              <span className={styles.redeployHint}>戦術カードを使うか、パスしてください</span>
            ) : currentPlayer === myPlayer ? (
              <span className={styles.myTurn}>
                {isLocalMode ? `プレイヤー${currentPlayer + 1}のターン` : 'あなたのターン'}
              </span>
            ) : (
              <span className={styles.oppTurn}>{isAIMode ? 'AIが考え中...' : '相手のターン'}</span>
            )
          ) : (
            <span className={styles.ended}>ゲーム終了</span>
          )}
        </div>
      </div>

      {/* 相手の手札（裏向き） */}
      <div className={styles.oppHand}>
        <div className={styles.handLabel}>
          {isLocalMode ? `プレイヤー${oppPlayer + 1}` : isAIMode ? 'AI' : '相手'}
          {' '}({hands[oppPlayer].length}枚)
        </div>
        <div className={styles.faceDownRow}>
          {hands[oppPlayer].map((card) => (
            <div key={card.id} className={styles.faceDownCard} />
          ))}
        </div>
      </div>

      {/* フラグエリア + 捨て札エリア */}
      <div className={styles.fieldRow}>
        <div className={styles.flagArea}>
          {flags.map((flag, i) => {
            const isClaimable =
              flag.claimed === null &&
              canClaim(flag.cards[myPlayer], flag.cards[oppPlayer], flag.mud, flag.fog, flags, []);
            const canBeRedeployDest =
              isRedeployDest &&
              flag.claimed === null &&
              flag.cards[myPlayer].length < requiredCards(flag.mud);
            const canBeDeserterDest =
              isDeserterDest &&
              flag.claimed === null &&
              flag.cards[oppPlayer].length < requiredCards(flag.mud);
            const canBeTraitorDest =
              isTraitorDest &&
              flag.claimed === null &&
              flag.cards[myPlayer].length < requiredCards(flag.mud);
            const suppressSelected = isRedeploySource || isDeserterSource || isTraitorSource;
            return (
              <FlagView
                key={i}
                flag={flag}
                index={i}
                currentPlayer={myPlayer}
                selectedCard={suppressSelected ? null : state.selectedCard}
                isClaimable={isClaimable}
                onFlagClick={onFlagClick}
                onClaimClick={onClaimClick}
                onFieldCardClick={isRedeploySource ? (card) => onFieldCardClick(i, card) : undefined}
                onOppFieldCardClick={
                  isDeserterSource ? (card) => onFieldCardClick(i, card) :
                  isTraitorSource ? (card) => onFieldCardClick(i, card) :
                  undefined
                }
                isOppCardClickable={isTraitorSource ? (card) => card.type === 'troop' : undefined}
                isRedeployDest={canBeRedeployDest}
                isDeserterDest={canBeDeserterDest}
                isTraitorDest={canBeTraitorDest}
              />
            );
          })}
        </div>

        {/* 捨て札エリア */}
        <div className={styles.discardArea}>
          <div className={styles.discardLabel}>捨て札</div>
          {/* Redeploy Phase2: 捨て場ボタン */}
          {isRedeployDest && (
            <button className={styles.discardTrashBtn} onClick={onRedeployDiscard}>
              ここに捨てる
            </button>
          )}
          {/* 保持中カード表示 (Redeploy) */}
          {isRedeployDest && redeployState && (
            <div className={styles.redeployHeldCard}>
              <div className={styles.discardCardLabel}>移動中</div>
              <CardView card={redeployState.card} small />
            </div>
          )}
          {/* 保持中カード表示 (Deserter) */}
          {isDeserterDest && deserterState && (
            <div className={styles.redeployHeldCard}>
              <div className={styles.discardCardLabel}>移動中</div>
              <CardView card={deserterState.card} small />
            </div>
          )}
          {/* 保持中カード表示 (Traitor) */}
          {isTraitorDest && traitorState && (
            <div className={styles.redeployHeldCard}>
              <div className={styles.discardCardLabel}>配置中</div>
              <CardView card={traitorState.card} small />
            </div>
          )}
          {/* 捨て札一覧 */}
          <div className={styles.discardCards}>
            {discardPile.map((card, i) => (
              <CardView key={`${card.id}-${i}`} card={card} small />
            ))}
            {discardPile.length === 0 && (
              <div className={styles.discardEmpty}>なし</div>
            )}
          </div>
        </div>
      </div>

      {/* 自分の手札 */}
      <div className={styles.myHandArea}>
        <div className={styles.handLabel}>
          {isLocalMode ? `プレイヤー${myPlayer + 1}の手札` : 'あなたの手札'}
        </div>
        {isPendingEndTurn && (
          <div className={styles.passButtonArea}>
            <button className={styles.endTurnBtn} onClick={onEndTurn}>ターン終了</button>
          </div>
        )}
        {showPassButton && (
          <div className={styles.passButtonArea}>
            <button className={styles.passBtn} onClick={onPassTurn}>パスする</button>
            <span className={styles.passHint}>戦術カードを使うか、パスするか選べます</span>
          </div>
        )}
        <HandView
          hand={hands[myPlayer]}
          selectedCard={state.selectedCard}
          currentPlayer={currentPlayer}
          myPlayer={myPlayer}
          canUseTactic={canUseTactic(state, myPlayer)}
          onCardClick={onCardClick}
        />
      </div>

      {/* 偵察: デッキ選択 */}
      {phase === 'playing' && scoutState?.phase === 'select-decks' && scoutState.player === myPlayer && (() => {
        const options: { troop: number; tactic: number }[] = [
          { troop: 3, tactic: 0 },
          { troop: 2, tactic: 1 },
          { troop: 1, tactic: 2 },
          { troop: 0, tactic: 3 },
        ];
        return (
          <div className={styles.overlay}>
            <div className={styles.scoutPrompt}>
              <h3>偵察 — 引くカードを選んでください（合計3枚）</h3>
              <div className={styles.scoutOptions}>
                {options.map(({ troop, tactic }) => {
                  const disabled = troopDeckCount < troop || tacticDeckCount < tactic;
                  return (
                    <button
                      key={`${troop}-${tactic}`}
                      className={styles.scoutOptionBtn}
                      disabled={disabled}
                      onClick={() => onScoutDraw(troop, tactic)}
                    >
                      <span>兵士 {troop}枚</span>
                      <span className={styles.scoutPlus}>+</span>
                      <span>戦術 {tactic}枚</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 偵察: 手札から2枚戻す */}
      {phase === 'playing' && scoutState?.phase === 'return-cards' && scoutState.player === myPlayer && (
        <div className={styles.overlay}>
          <div className={styles.scoutPrompt}>
            <h3>偵察 — 山札に戻すカードを選んでください（あと{scoutState.returnCount}枚）</h3>
            <p className={styles.scoutHintText}>カードをクリックすると山札の一番上に戻ります</p>
            <div className={styles.scoutReturnHand}>
              {hands[myPlayer].map((card) => (
                <button
                  key={card.id}
                  className={styles.scoutReturnCard}
                  onClick={() => onScoutReturn(card)}
                  title={card.type === 'troop' ? `${card.color} ${card.value}` : card.tacticType}
                >
                  <CardView card={card} small />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ワイルドカード割り当て */}
      {phase === 'playing' && state.pendingWildcard?.player === myPlayer && (() => {
        const pw = state.pendingWildcard!;
        const tacticType = pw.card.tacticType;
        const isCompanion = tacticType === 'companion';
        const isShield = tacticType === 'shield';
        const colors: TroopColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
        const colorLabels: Record<TroopColor, string> = {
          red: '赤', orange: '橙', yellow: '黄', green: '緑', blue: '青', purple: '紫',
        };
        const colorHex: Record<TroopColor, string> = {
          red: '#e74c3c', orange: '#e67e22', yellow: '#f1c40f',
          green: '#27ae60', blue: '#2980b9', purple: '#8e44ad',
        };
        return (
          <div className={styles.overlay}>
            <div className={styles.wildcardPrompt}>
              {isCompanion ? (
                <>
                  <h3>騎兵隊 — 色を選んでください（数字は8固定）</h3>
                  <div className={styles.companionColors}>
                    {colors.map((color) => (
                      <button
                        key={color}
                        className={styles.companionColorBtn}
                        style={{ background: colorHex[color], borderColor: colorHex[color] }}
                        onClick={() => onAssignWild(pw.card, pw.flagIndex, color, 8)}
                      >
                        <span>{colorLabels[color]}</span>
                        <span className={styles.companionValue}>8</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : isShield ? (
                <>
                  <h3>盾 — 色と数字（1・2・3）を選んでください</h3>
                  <div className={styles.wildcardForm}>
                    {colors.map((color) => (
                      <div key={color} className={styles.wildcardColorRow}>
                        <span className={styles.colorDot} style={{ background: colorHex[color] }} />
                        <span className={styles.colorName}>{colorLabels[color]}</span>
                        <div className={styles.valueButtons}>
                          {[1, 2, 3].map((v) => (
                            <button
                              key={v}
                              className={styles.valueBtn}
                              style={{ borderColor: colorHex[color] }}
                              onClick={() => onAssignWild(pw.card, pw.flagIndex, color, v)}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3>{tacticType === 'alexander' ? 'アレクサンダー' : 'ダリウス'} — 色と数字を選んでください</h3>
                  <div className={styles.wildcardForm}>
                    {colors.map((color) => (
                      <div key={color} className={styles.wildcardColorRow}>
                        <span className={styles.colorDot} style={{ background: colorHex[color] }} />
                        <span className={styles.colorName}>{colorLabels[color]}</span>
                        <div className={styles.valueButtons}>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                            <button
                              key={v}
                              className={styles.valueBtn}
                              style={{ borderColor: colorHex[color] }}
                              onClick={() => onAssignWild(pw.card, pw.flagIndex, color, v)}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button className={styles.passBtn} onClick={onCancelWildcard}>
                  ← 戻る（カードを手札に戻す）
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* カード引き選択 */}
      {phase === 'playing' && state.pendingDraw === myPlayer && (
        <div className={styles.overlay}>
          <div className={styles.drawPrompt}>
            <h3>カードを引く</h3>
            <p>どちらのデッキから引きますか？</p>
            <div className={styles.drawButtons}>
              <button
                className={styles.drawBtn}
                onClick={() => onDrawCard('troop')}
                disabled={state.troopDeckCount === 0}
              >
                兵士デッキ<br />
                <span>({state.troopDeckCount}枚)</span>
              </button>
              <button
                className={styles.drawBtn}
                onClick={() => onDrawCard('tactic')}
                disabled={state.tacticDeckCount === 0}
              >
                戦術デッキ<br />
                <span>({state.tacticDeckCount}枚)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自動パス: 配置できる場所がない＆戦術カードなし */}
      {mustAutoPass && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 12 }}>パス</h3>
            <p>配置する場所がないのでパスされます</p>
            <div className={styles.modalButtons}>
              <button className={styles.modalBtn} onClick={onPassTurn}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* 戦術カード確認ダイアログ */}
      {tacticConfirm && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>戦術カードを使用しますか？</h3>
            <p style={{ color: '#bdc3c7', margin: '8px 0 16px' }}>【{tacticName(tacticConfirm.tacticType)}】</p>
            <div className={styles.modalButtons}>
              <button className={styles.modalBtn} onClick={() => onTacticConfirm(true)}>はい</button>
              <button className={styles.modalBtn} onClick={() => onTacticConfirm(false)}>いいえ</button>
            </div>
          </div>
        </div>
      )}

      {/* ルール確認モーダル */}
      {showRules && (
        <div className={styles.overlay} onClick={() => setShowRules(false)}>
          <div className={styles.rulesModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.rulesModalHeader}>
              <span className={styles.rulesModalTitle}>ルール確認</span>
              <button className={styles.rulesModalClose} onClick={() => setShowRules(false)}>✕ 閉じる</button>
            </div>
            <div className={styles.rulesModalBody}>
              <RulesContent />
            </div>
          </div>
        </div>
      )}

      {/* 勝敗モーダル */}
      {phase === 'ended' && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2>
            {isLocalMode
              ? `プレイヤー${(winner ?? 0) + 1}の勝利！🎉`
              : winner === myPlayer ? '勝利！🎉' : '敗北...'}
          </h2>
            <p>{winReason}</p>
            <div className={styles.modalButtons}>
              <button className={styles.modalBtn} onClick={onRestart}>もう一度</button>
              <button className={styles.modalBtn} onClick={onMenu}>メニューへ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
