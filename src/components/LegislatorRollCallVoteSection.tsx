import Link from "next/link";
import type { Chamber } from "@/types";
import type { LegislatorVoteRecord } from "@/lib/rollCallVoteStats";
import { VoteChoiceBadge } from "@/components/VoteChoiceBadge";
import { DataCoverageNote } from "@/components/DataCoverageNote";

/**
 * 議員詳細ページの「参議院本会議・記名投票での賛否」セクション
 * （機能拡充ロードマップ Tier1 #5）。
 *
 * 【中立性の方針（重要）】
 * - 「いつ・何に・どう投票したか」という参議院公式サイトの記録の転記に留める。
 *   賛成率・造反回数・出席率といった派生指標は算出も表示もしない
 *   （議員の姿勢を1つの数値へ要約すると、それ自体が評価として働くため）。
 * - 欠席・棄権は原データの区分をそのまま表示する。「造反」「不真面目」のような
 *   否定的な言い換え・強調表示はしない。欠席には委員会等の公務・病気・
 *   会派の方針など多様な事情があり、記録からは理由を判別できない。
 * - 並び順は投票日の新しい順のみ。「賛否が割れた投票順」「重要な投票順」といった
 *   編集的な並び替えは行わない。
 * - 衆議院議員のページでは、データが無いこと自体ではなく「衆議院は起立採決が
 *   中心で個人の賛否が原則公開されていない」という理由を明示する。
 */

/** 件数が多いときは畳んだ状態で始める（LegislatorBillSponsorshipSectionと同じ方針） */
const AUTO_OPEN_MAX = 20;

function VoteRow({ record }: { record: LegislatorVoteRecord }) {
  const { vote, choice } = record;
  return (
    <li className="border-b border-neutral-100 py-2 last:border-0 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular-nums text-xs text-neutral-500 dark:text-neutral-500">
          {vote.date}
        </span>
        <span className="tabular-nums text-xs text-neutral-500 dark:text-neutral-500">
          第{vote.session}回
        </span>
        <VoteChoiceBadge choice={choice} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/votes/${encodeURIComponent(vote.voteId)}`}
          className="text-sm text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          {vote.subject}
        </Link>
        {vote.billId && (
          <Link
            href={`/bills/${encodeURIComponent(vote.billId)}`}
            className="whitespace-nowrap text-xs text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            法案ページ →
          </Link>
        )}
      </div>
    </li>
  );
}

export function LegislatorRollCallVoteSection({
  records,
  chamber,
  totalVoteCount,
  coverageFacts,
}: {
  records: LegislatorVoteRecord[];
  chamber: Chamber;
  /** 収録している記名投票の総件数（この議員の記録件数と対比するために使う） */
  totalVoteCount: number;
  coverageFacts: string[];
}) {
  const autoOpen = records.length <= AUTO_OPEN_MAX;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        参議院本会議・記名投票での賛否
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
        参議院本会議の記名投票（押しボタン式投票）で公開されている、この議員個人の賛否の記録です。参議院公式サイトの記録をそのまま転記したもので、賛成率・出席率などの指標化や、賛否そのものへの評価は行っていません。欠席・棄権も原データの区分のまま表示しており、その理由（公務・病気・会派の方針など）は記録からは分かりません。
      </p>

      {records.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-500">
          {chamber === "参議院"
            ? "収録している記名投票の範囲では、この議員の投票記録は見つかりませんでした（在職期間が収録範囲と重ならない場合や、氏名を照合できなかった場合があります）。"
            : "衆議院本会議の採決は起立採決が中心で、議員個人の賛否は原則として公開されていません。そのため記名投票のデータは参議院のみを収録しており、衆議院議員の投票記録はありません。"}
        </p>
      ) : (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
          <details open={autoOpen}>
            <summary className="cursor-pointer text-sm font-semibold text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300">
              投票の記録（{records.length}件
              {autoOpen ? "" : "・クリックで一覧を表示"}）
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
              収録している記名投票{totalVoteCount.toLocaleString("ja-JP")}件のうち、この議員の記録があるのは
              {records.length.toLocaleString("ja-JP")}件です。投票日の新しい順に並べています。
            </p>
            <ul className="mt-1">
              {records.map((record) => (
                <VoteRow key={record.vote.voteId} record={record} />
              ))}
            </ul>
          </details>
        </div>
      )}

      <p className="mt-3 text-sm">
        <Link
          href="/votes"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          記名投票の一覧を見る →
        </Link>
      </p>

      <DataCoverageNote
        datasetId="roll-call-votes"
        facts={coverageFacts}
        className="mt-3"
      />
    </section>
  );
}
