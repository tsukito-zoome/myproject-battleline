import styles from './RulesContent.module.css';

export function RulesContent() {
  return (
    <div className={styles.rules}>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ゲームの流れ</h2>
        <ol className={styles.flowList}>
          <li>各プレイヤーは部隊カード<strong>7枚</strong>を手札に持ちゲームスタート</li>
          <li>手番プレイヤーは手札から<strong>1枚</strong>を9本のフラグのいずれかに配置する</li>
          <li>配置後、「ターン終了」を押す前に確保できるフラグをクリックして確保できる</li>
          <li>ターン終了後はデッキから<strong>1枚</strong>引いて相手のターンへ</li>
          <li>各フラグに通常<strong>3枚</strong>（泥カード使用時は<strong>4枚</strong>）並べるとフォーメーション完成</li>
          <li>双方のフォーメーションを比べ、強い方がフラグを確保できる</li>
          <li><strong>5本以上</strong>、または<strong>隣接した連続3本</strong>のフラグを先に確保した方が勝利</li>
        </ol>
        <div className={styles.note}>
          <strong>証明ルール：</strong>
          自分のフォーメーションが完成していて、相手がどのカードを追加しても自分に勝てない状況になった場合、
          相手のフォーメーション完成を待たずにフラグを確保できる。
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>フォーメーション（強い順）</h2>
        <div className={styles.formTable}>
          <div className={styles.formHeader}>
            <span>役名</span><span>条件</span><span>例</span>
          </div>
          <div className={`${styles.formRow} ${styles.wedge}`}>
            <span className={styles.formName}>ウェッジ</span>
            <span>同色の連続する数字3枚</span>
            <span className={styles.example}>赤3・赤4・赤5</span>
          </div>
          <div className={`${styles.formRow} ${styles.phalanx}`}>
            <span className={styles.formName}>ファランクス</span>
            <span>同じ数字3枚</span>
            <span className={styles.example}>青7・赤7・緑7</span>
          </div>
          <div className={`${styles.formRow} ${styles.battalion}`}>
            <span className={styles.formName}>バタリオン</span>
            <span>同色3枚</span>
            <span className={styles.example}>青2・青6・青9</span>
          </div>
          <div className={`${styles.formRow} ${styles.skirmish}`}>
            <span className={styles.formName}>スカーミッシュ</span>
            <span>連続する数字3枚（異色可）</span>
            <span className={styles.example}>赤4・青5・緑6</span>
          </div>
          <div className={`${styles.formRow} ${styles.host}`}>
            <span className={styles.formName}>ホスト</span>
            <span>上記以外（合計値で比較）</span>
            <span className={styles.example}>赤1・青5・緑9</span>
          </div>
        </div>
        <div className={styles.note}>
          同じ役同士は合計値の高い方が勝ち。合計も同じ場合は先に完成させた方が勝ち。
          <br />
          <strong>霧カード使用時：</strong>そのフラグの役はホスト（合計値比較）のみとなる。
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>戦術カード一覧</h2>
        <div className={styles.tacticNote}>
          戦術カードのルール：相手より多く使うことはできない（使用枚数の差は最大1まで）
        </div>
        <div className={styles.tacticGroup}>
          <div className={styles.tacticGroupLabel}>リーダー</div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>アレクサンダー / ダリウス</span>
            <span className={styles.tacticDesc}>任意の色・数字（1〜10）のワイルドカード。自分のフィールドに1枚まで配置可能。</span>
          </div>
        </div>
        <div className={styles.tacticGroup}>
          <div className={styles.tacticGroupLabel}>騎兵・歩兵</div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>騎兵隊</span>
            <span className={styles.tacticDesc}>任意の色で数字<strong>8</strong>として扱うワイルドカード。</span>
          </div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>盾</span>
            <span className={styles.tacticDesc}>任意の色で数字<strong>1・2・3</strong>のいずれかとして扱うワイルドカード。</span>
          </div>
        </div>
        <div className={styles.tacticGroup}>
          <div className={styles.tacticGroupLabel}>環境</div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>霧</span>
            <span className={styles.tacticDesc}>このフラグの役判定をホスト（合計値比較）のみに変更する。</span>
          </div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>泥</span>
            <span className={styles.tacticDesc}>このフラグの必要枚数を3枚から<strong>4枚</strong>に変更する。</span>
          </div>
        </div>
        <div className={styles.tacticGroup}>
          <div className={styles.tacticGroupLabel}>士気</div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>偵察</span>
            <span className={styles.tacticDesc}>デッキから合計<strong>3枚</strong>引き、その中から<strong>2枚</strong>を山札の上に戻す。</span>
          </div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>脱走</span>
            <span className={styles.tacticDesc}>未確保フラグにある相手のカード<strong>1枚</strong>を捨て場に送る。</span>
          </div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>裏切り</span>
            <span className={styles.tacticDesc}>未確保フラグにある相手の<strong>部隊カード1枚</strong>を自分の好きなフラグに移す（or 捨て場へ）。</span>
          </div>
          <div className={styles.tacticRow}>
            <span className={styles.tacticName}>配置転換</span>
            <span className={styles.tacticDesc}>自分のフィールドにある<strong>カード1枚</strong>を別のフラグに移すか捨て場に送る。</span>
          </div>
        </div>
      </section>

    </div>
  );
}
