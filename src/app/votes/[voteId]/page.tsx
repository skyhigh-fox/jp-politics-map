import Link from "next/link";
import { notFound } from "next/navigation";
import { getBills, getParties, getRollCallVotes } from "@/lib/data";
import { RollCallVoteHeatmap } from "@/components/RollCallVoteHeatmap";
import { VoteChoiceBadge } from "@/components/VoteChoiceBadge";
import { PartyColorDot } from "@/components/PartyColorDot";
import { buildRollCallVoteNoteFacts } from "@/lib/dataProvenance";
import { buildPartyVoteMemberGroups } from "@/lib/rollCallVoteStats";
import { buildPageMetadata } from "@/lib/siteMetadata";

/**
 * 個別の記名投票ページ（機能拡充ロードマップ Tier1 #5）。
 *
 * 法案IDに紐付かない投票（会期の件・国家公務員等の任命に関する件など）も含め、
 * すべての記名投票に固定URLを与えて到達可能にする。会派別の集計は法案詳細ページと
 * 同じ RollCallVoteHeatmap を再利用し、このページではさらに議員個人の賛否まで示す。
 *
 * 【中立性の方針（重要）】
 * - 参議院公式サイトの投票結果ページに載っている事実（誰がどの区分だったか）を
 *   そのまま転記する。賛否そのものへの評価、議員個人の指標化（賛成率・造反回数）は
 *   一切行わない。
 * - 議員の並びは会派ごと・原データ（公式ページ）の掲載順のまま。会派内で賛否が
 *   分かれた議員を先頭に出すなどの強調・並び替えはしない。
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ voteId: string }>;
}) {
  const { voteId: rawVoteId } = await params;
  const voteId = decodeURIComponent(rawVoteId);
  const votes = await getRollCallVotes();
  const vote = votes.find((v) => v.voteId === voteId);

  if (!vote) {
    return buildPageMetadata({
      title: "記名投票",
      description:
        "参議院本会議の記名投票（押しボタン式投票）の会派別・議員別の賛否を、参議院公式サイトの投票結果のまま表示しています。",
      path: `/votes/${encodeURIComponent(voteId)}`,
    });
  }

  return buildPageMetadata({
    title: `${vote.subject}（第${vote.session}回国会・${vote.date}）`,
    description: `参議院本会議の記名投票。賛成${vote.totalFor.toLocaleString("ja-JP")}・反対${vote.totalAgainst.toLocaleString("ja-JP")}。会派別・議員別の賛否を、参議院公式サイトの投票結果のまま表示しています。賛否への評価や議員個人の指標化は行っていません。`,
    path: `/votes/${encodeURIComponent(vote.voteId)}`,
  });
}

export default async function VoteDetailPage({
  params,
}: {
  params: Promise<{ voteId: string }>;
}) {
  // Next.jsの動的ルートのparamsはパーセントエンコードのままのことがあるため必ずデコードする
  const { voteId: rawVoteId } = await params;
  const voteId = decodeURIComponent(rawVoteId);

  const [votes, parties, bills] = await Promise.all([
    getRollCallVotes(),
    getParties(),
    getBills(),
  ]);

  const vote = votes.find((v) => v.voteId === voteId);
  if (!vote) notFound();

  const bill = vote.billId ? bills.find((b) => b.id === vote.billId) : undefined;
  const memberGroups = buildPartyVoteMemberGroups(vote, parties);
  const linkedCount = vote.results.filter((r) => r.legislatorId !== null).length;

  return (
    <div className="max-w-3xl animate-fade-in">
      <p className="text-sm">
        <Link
          href="/votes"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← 記名投票一覧に戻る
        </Link>
      </p>

      <h1
        data-testid="vote-subject"
        className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50"
      >
        {vote.subject}
      </h1>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-sm shadow-card dark:border-neutral-800 dark:bg-neutral-900">
        <dt className="text-neutral-500 dark:text-neutral-500">院</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">参議院（本会議）</dd>
        <dt className="text-neutral-500 dark:text-neutral-500">国会回次</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          第{vote.session}回
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">投票日</dt>
        <dd className="tabular-nums text-neutral-800 dark:text-neutral-200">
          {vote.date}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">賛成・反対</dt>
        <dd className="tabular-nums text-neutral-800 dark:text-neutral-200">
          賛成 {vote.totalFor.toLocaleString("ja-JP")}／反対{" "}
          {vote.totalAgainst.toLocaleString("ja-JP")}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">対応する法案</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {bill ? (
            <Link
              href={`/bills/${encodeURIComponent(bill.id)}`}
              className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              {bill.title}
            </Link>
          ) : (
            <span className="text-neutral-500 dark:text-neutral-500">
              法案データと突合できる案件ではありません（会期の件・人事案件など）
            </span>
          )}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">情報源</dt>
        <dd>
          <a
            href={vote.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            参議院サイトの投票結果を見る
          </a>
        </dd>
      </dl>

      {/* 会派別の集計は法案詳細ページと同じコンポーネントを再利用する */}
      <RollCallVoteHeatmap
        vote={vote}
        parties={parties}
        coverageFacts={buildRollCallVoteNoteFacts(vote, votes)}
      />

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          議員別の賛否
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
          参議院公式サイトの投票結果に記載されている議員個人の賛否です。会派ごとにまとめ、会派内は公式ページの掲載順のまま並べています。賛否への評価や、議員個人の指標化（賛成率など）は行っていません。
        </p>

        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300">
              議員{vote.results.length.toLocaleString("ja-JP")}名分の賛否を表示
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
              {linkedCount === vote.results.length
                ? "全員分が議員ページへ紐付いています。"
                : `このうち${linkedCount.toLocaleString("ja-JP")}名が議員ページへ紐付いています（氏名が現在の議員データに見つからない方は、氏名のみ表示しています）。`}
              会派名は投票当時の記載に基づきます。
            </p>
            <div className="mt-3 space-y-5">
              {memberGroups.map((group) => (
                <div key={group.key}>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    <PartyColorDot color={group.color} />
                    {group.label}
                    <span className="font-normal text-xs text-neutral-500 dark:text-neutral-500">
                      （{group.members.length}名）
                    </span>
                  </h3>
                  <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                    {group.members.map((member, i) => (
                      <li
                        key={`${member.legislatorId ?? member.name}-${i}`}
                        className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-1.5 text-sm last:border-0 dark:border-neutral-800"
                      >
                        {member.legislatorId ? (
                          <Link
                            href={`/legislators/${encodeURIComponent(member.legislatorId)}`}
                            className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                          >
                            {member.name}
                          </Link>
                        ) : (
                          <span className="text-neutral-700 dark:text-neutral-300">
                            {member.name}
                          </span>
                        )}
                        <VoteChoiceBadge choice={member.vote} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
