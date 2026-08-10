/**
 * 「このデータからわかること」ボックス。
 *
 * グラフや表を見ても数字の意味を読み取りにくいという指摘に対応するため、
 * 表示中のデータから直接計算できる事実だけを短い文で言い換えて示す。
 *
 * 中立性の方針（重要）:
 * - 文言は呼び出し側（各ページ）で、表示しているデータから機械的に算出する。
 *   AIによる自然文生成は使わない（解釈・評価が混入するリスクを避けるため）。
 * - 「多い／伸びている」等の量の言い換えはするが、「良い／悪い」「望ましい」
 *   といった評価語は使わない（呼び出し側の文言作成時も同じ方針を守ること）。
 * - あくまで「表示中の集計値の言い換え」に留め、背景・原因の説明はしない
 *   （例:「歳出が増えた」とは言うが「なぜ増えたか」には触れない）。
 */
export function DataInsight({
  facts,
  title = "このデータからわかること",
}: {
  facts: string[];
  title?: string;
}) {
  if (facts.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-accent-100 bg-accent-50/60 p-3 dark:border-accent-800/60 dark:bg-accent-900/30">
      <p className="text-xs font-semibold text-accent-800 dark:text-accent-300">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
        {facts.map((fact, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden className="text-accent-500 dark:text-accent-400">
              ・
            </span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
