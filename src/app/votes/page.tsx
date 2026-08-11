import Link from "next/link";
import { getRollCallVotes } from "@/lib/data";
import { FilterBar } from "@/components/FilterBar";
import { DataCoverageNote } from "@/components/DataCoverageNote";
import { buildRollCallVoteCoverage } from "@/lib/dataProvenance";
import { buildPageMetadata } from "@/lib/siteMetadata";
import {
  type RollCallVoteSummary,
  compareVotesByDateDesc,
  toRollCallVoteSummary,
} from "@/lib/rollCallVoteStats";

/**
 * 記名投票の一覧（機能拡充ロードマップ Tier1 #5）。
 *
 * 【このページを作った理由】
 * data/roll-call-votes.json には参議院の記名投票が全件入っているが、これまでは
 * 法案詳細ページ（/bills/[id]）の会派別ヒートマップからしか辿れず、法案IDに
 * 紐付かない投票（会期の件・国家公務員等の任命に関する件など）はサイト上の
 * どのページからも到達できなかった。ここで全件を一覧にして到達可能にする。
 *
 * 【中立性の方針（重要）】
 * - 並び順は投票日の新しい順のみ。「賛否が割れた順」「重要な投票順」のような
 *   編集的・評価的な並び替えや、注目投票のピックアップは行わない。
 * - 賛成・反対の数は原データの集計値をそのまま表示する。可否の判定や
 *   「僅差」「圧倒的」といった評価的な言い換えは加えない。
 */

export const metadata = buildPageMetadata({
  title: "記名投票一覧",
  description:
    "参議院本会議の記名投票（押しボタン式投票）の一覧。回次・年で絞り込み、投票ごとの会派別・議員別の賛否を確認できます。",
  path: "/votes",
});

interface VoteFilters {
  session?: string;
  year?: string;
  linkage?: string;
  q?: string;
}

const LINKAGE_OPTIONS = [
  { value: "linked", label: "対応する法案ページあり" },
  { value: "unlinked", label: "対応する法案ページなし" },
] as const;

function matchesFilters(vote: RollCallVoteSummary, filters: VoteFilters): boolean {
  if (filters.session && String(vote.session) !== filters.session) return false;
  if (filters.year && vote.date.slice(0, 4) !== filters.year) return false;
  if (filters.linkage === "linked" && vote.billId === null) return false;
  if (filters.linkage === "unlinked" && vote.billId !== null) return false;
  if (filters.q && !vote.subject.includes(filters.q)) return false;
  return true;
}

export default async function VotesPage({
  searchParams,
}: {
  searchParams: Promise<VoteFilters>;
}) {
  const filters = await searchParams;
  const votes = await getRollCallVotes();

  // 一覧に議員個人の賛否（1投票あたり最大245件）は不要なので、
  // 表示に使うメタ情報だけへ落としてから扱う
  const summaries = votes.map(toRollCallVoteSummary);
  const coverage = buildRollCallVoteCoverage(votes);

  const sessions = [...new Set(summaries.map((v) => v.session))].sort(
    (a, b) => b - a
  );
  const years = [...new Set(summaries.map((v) => v.date.slice(0, 4)))].sort(
    (a, b) => b.localeCompare(a)
  );

  const filtered = summaries
    .filter((v) => matchesFilters(v, filters))
    .sort(compareVotesByDateDesc);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        記名投票一覧
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        参議院本会議の記名投票（押しボタン式投票）の記録です。衆議院本会議の採決は起立採決が中心で議員個人の賛否が原則公開されないため、収録しているのは参議院のみです。各投票の件名から、会派別・議員別の賛否を確認できます。
      </p>

      {votes.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          データ未取得です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:roll-call-votes
          </code>
          で取得してください。
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            全{votes.length.toLocaleString("ja-JP")}件中
            {filtered.length.toLocaleString("ja-JP")}件が条件に一致（投票日の新しい順）
          </p>

          <FilterBar
            selects={[
              {
                key: "session",
                label: "国会回次",
                options: sessions.map((s) => ({
                  value: String(s),
                  label: `第${s}回`,
                })),
              },
              {
                key: "year",
                label: "年",
                options: years.map((y) => ({ value: y, label: `${y}年` })),
              },
              {
                key: "linkage",
                label: "法案ページとの対応",
                options: LINKAGE_OPTIONS.map((o) => ({ ...o })),
              },
            ]}
            searchKey="q"
            searchLabel="件名で検索"
            searchPlaceholder="例: 予算"
          />

          <p className="mt-2 text-xs leading-relaxed text-neutral-400 dark:text-neutral-600">
            「法案ページとの対応」は、投票の件名を法案データと突合できたかどうかによる区分です。会期の件・国家公務員等の任命に関する件・決算など、法案として提出されたものではない案件には対応する法案ページがありません。
          </p>

          <div
            data-testid="votes-table"
            className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 shadow-card dark:border-neutral-800"
          >
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">
                    投票日
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">
                    回次
                  </th>
                  <th className="px-3 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">
                    件名
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">
                    賛成
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">
                    反対
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-900">
                {filtered.map((vote) => (
                  <tr
                    key={vote.voteId}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 align-top tabular-nums text-neutral-800 dark:text-neutral-200">
                      {vote.date}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-neutral-800 dark:text-neutral-200">
                      第{vote.session}回
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link
                        href={`/votes/${encodeURIComponent(vote.voteId)}`}
                        className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                      >
                        {vote.subject}
                      </Link>
                      {vote.billId && (
                        <Link
                          href={`/bills/${encodeURIComponent(vote.billId)}`}
                          className="ml-2 whitespace-nowrap text-xs text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                        >
                          法案ページ →
                        </Link>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-neutral-800 dark:text-neutral-200">
                      {vote.totalFor.toLocaleString("ja-JP")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-neutral-800 dark:text-neutral-200">
                      {vote.totalAgainst.toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-500">
              条件に一致する投票はありませんでした。
            </p>
          )}

          <DataCoverageNote
            datasetId="roll-call-votes"
            facts={coverage.facts}
            className="mt-4 max-w-3xl"
          />
        </>
      )}
    </div>
  );
}
