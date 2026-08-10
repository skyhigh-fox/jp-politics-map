import Link from "next/link";
import type { CSSProperties } from "react";
import type { RollCallVote, Party, RollCallVoteChoice } from "@/types";
import {
  VOTE_CHOICE_ORDER,
  buildPartyVoteBreakdown,
  buildRollCallVoteFacts,
} from "@/lib/rollCallVoteStats";
import { VOTE_CHOICE_COLORS } from "@/lib/rollCallVoteColors";
import { PartyColorDot } from "@/components/PartyColorDot";
import { DataInsight } from "@/components/DataInsight";
import { DataCoverageNote } from "@/components/DataCoverageNote";

/**
 * 【参議院・記名投票の会派別賛否ヒートマップ】
 *
 * フォーム選定: 会派×賛否という2軸の集計値をそのまま格子状に見せたいケースであり、
 * dataviz skillの「マグニチュードを格子で見せたい」場合の定石どおりヒートマップを
 * 採用した。行×列の組み合わせが本質的に表形式のデータであるため、SVGではなく
 * セマンティックな<table>で実装し、背景色でセルの強度（会派内の比率）を表現する
 * （スクリーンリーダーには数値そのものが読み上げられるため、色に依存しない）。
 *
 * 配色: 賛成/反対は政治的な「賛否」という対極（polarity）を表すため、
 * dataviz skillのdiverging配色（暖色/寒色の2極+中立グレー）に従い、
 * 賛成=blue（寒色）・反対=amber（暖色）を割り当てた。「賛成=良い/反対=悪い」
 * という評価的な意味づけを避けるため、緑/赤のような良し悪しを連想させる配色は
 * 使わない（StatusBadge.tsx・BillSessionTrendChart.tsxと同じ中立性の方針）。
 * 欠席・棄権は「投票行動そのものが取られなかった」区分のため、単一のニュートラル
 * グレーの2階調（濃淡のみで序列を表現、ordinal）とした。
 * セルの背景色は「会派内でその選択が占める比率」に応じた不透明度で強度表現する
 * （比率が高いほど濃く塗る＝ヒートマップとしての強度表現）。
 *
 * 配色の定義そのものは、議員詳細ページの投票履歴・/votes 側でも同じ色を使えるよう
 * `src/lib/rollCallVoteColors.ts` に切り出してある。
 */

const CHOICE_META = VOTE_CHOICE_COLORS;

function cellStyle(ratio: number, choice: RollCallVoteChoice) {
  const alpha = ratio <= 0 ? 0 : 0.14 + ratio * 0.72;
  const meta = CHOICE_META[choice];
  return {
    "--cell-bg-light": `rgba(${meta.rgbLight}, ${alpha})`,
    "--cell-bg-dark": `rgba(${meta.rgbDark}, ${alpha})`,
  } as CSSProperties;
}

export function RollCallVoteHeatmap({
  vote,
  parties,
  coverageFacts = [],
  detailHref,
}: {
  vote: RollCallVote;
  parties: Party[];
  /**
   * 「この投票の何名分が議員データと紐付いているか」「記名投票データ全体で
   * どの範囲を収録しているか」を示す注記用の事実。
   * 呼び出し側（法案詳細ページ）が buildRollCallVoteNoteFacts で算出する。
   */
  coverageFacts?: string[];
  /**
   * 議員個人の賛否まで見られる個別投票ページ（/votes/[voteId]）への導線。
   * その個別投票ページ自身で使うときは自己参照になるため渡さない。
   */
  detailHref?: string;
}) {
  const rows = buildPartyVoteBreakdown(vote, parties);
  const totalVoted = vote.totalFor + vote.totalAgainst;
  const facts = buildRollCallVoteFacts(vote, rows);

  return (
    <section className="roll-call-heatmap mt-8">
      <style>{`
        .roll-call-heatmap .heat-cell {
          background: var(--cell-bg-light);
        }
        @media (prefers-color-scheme: dark) {
          .roll-call-heatmap .heat-cell {
            background: var(--cell-bg-dark);
          }
        }
      `}</style>

      <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        参議院 会派別の賛否（記名投票）
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
        第{vote.session}回国会・{vote.date}の本会議記名投票（押しボタン式投票）における会派ごとの内訳です。賛成{vote.totalFor}・反対{vote.totalAgainst}（計{totalVoted.toLocaleString("ja-JP")}名）。衆議院は起立採決が中心で議員個人の賛否が原則公開されないため、この情報は参議院のみで提供しています。事実の集計のみを示すものであり、賛否そのものへの評価は行っていません。
      </p>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden="true">
        {VOTE_CHOICE_ORDER.map((choice) => (
          <li
            key={choice}
            className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
              style={{
                backgroundColor: `rgb(${CHOICE_META[choice].rgbLight})`,
              }}
            />
            {choice}
          </li>
        ))}
      </ul>

      <DataInsight facts={facts} />

      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 shadow-card dark:border-neutral-800">
        <table className="w-full min-w-[440px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">
                会派
              </th>
              {VOTE_CHOICE_ORDER.map((choice) => (
                <th
                  key={choice}
                  className="px-3 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400"
                >
                  {choice}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">
                計
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-900">
            {rows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
              >
                <td className="whitespace-nowrap px-4 py-2 text-neutral-800 dark:text-neutral-200">
                  <span className="flex items-center gap-1.5">
                    <PartyColorDot color={row.color} />
                    {row.label}
                  </span>
                </td>
                {VOTE_CHOICE_ORDER.map((choice) => {
                  const count = row.counts[choice];
                  const ratio = row.total > 0 ? count / row.total : 0;
                  return (
                    <td
                      key={choice}
                      className="heat-cell px-3 py-2 text-right tabular-nums text-neutral-900 dark:text-neutral-50"
                      style={cellStyle(ratio, choice)}
                      title={`${row.label}: ${choice} ${count}名（会派内${(ratio * 100).toFixed(0)}%）`}
                    >
                      {count > 0 ? count : "―"}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailHref && (
        <p className="mt-3 text-sm">
          <Link
            href={detailHref}
            className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            この投票の議員別の賛否を見る →
          </Link>
        </p>
      )}

      <DataCoverageNote
        datasetId="roll-call-votes"
        facts={coverageFacts}
        className="mt-3"
      />

      <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-600">
        セルの色の濃さは、その会派内で当該選択が占める比率を表します（比率が高いほど濃い）。出典:{" "}
        <a
          href={vote.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent-600 hover:underline dark:text-accent-400"
        >
          参議院公式サイト
        </a>
      </p>
    </section>
  );
}
