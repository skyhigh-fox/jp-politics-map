import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBillSponsorships,
  getBills,
  getBillStatusHistory,
  getParties,
  getRollCallVotes,
} from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { BillSponsorshipSection } from "@/components/BillSponsorshipSection";
import { RollCallVoteHeatmap } from "@/components/RollCallVoteHeatmap";
import {
  BILL_STAGE_COLORS,
  BILL_STAGE_DISPLAY_ORDER,
  BILL_STAGE_SLUGS,
} from "@/lib/billStageColors";
import { DataCoverageNote } from "@/components/DataCoverageNote";
import {
  buildBillSponsorshipScopeFacts,
  buildRollCallVoteNoteFacts,
  buildRollCallVoteScopeFacts,
} from "@/lib/dataProvenance";

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const [bills, history, rollCallVotes, parties, billSponsorships] =
    await Promise.all([
      getBills(),
      getBillStatusHistory(),
      getRollCallVotes(),
      getParties(),
      getBillSponsorships(),
    ]);

  const bill = bills.find((b) => b.id === id);
  if (!bill) notFound();

  const rollCallVote = rollCallVotes.find((v) => v.billId === id);
  const rollCallScopeFacts = buildRollCallVoteScopeFacts(rollCallVotes);

  const sponsorship = billSponsorships.find((s) => s.billId === id);
  const sponsorshipScopeFacts = buildBillSponsorshipScopeFacts(billSponsorships);

  const timeline = history
    .filter((h) => h.billId === id)
    // 同日に複数院で動きがあることもあるため、日付→院の順で安定ソート
    .sort((a, b) => a.date.localeCompare(b.date) || a.house.localeCompare(b.house));

  // このページに登場するステージのみ、正規の流れ順で凡例を表示する
  const timelineStageSet = new Set(timeline.map((h) => h.stage));
  const uniqueStages = BILL_STAGE_DISPLAY_ORDER.filter((s) =>
    timelineStageSet.has(s)
  );

  return (
    <div className="max-w-2xl animate-fade-in">
      <p className="text-sm">
        <Link
          href="/bills"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← 法案一覧に戻る
        </Link>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          {bill.title}
        </h1>
        <StatusBadge status={bill.status} />
      </div>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-sm shadow-card dark:border-neutral-800 dark:bg-neutral-900">
        <dt className="text-neutral-500 dark:text-neutral-500">国会回次</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          第{bill.dietSession}回
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">議案種類</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {bill.category ?? "不明"}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">提出区分</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {bill.submitterType}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">先議院</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">{bill.house}</dd>
        <dt className="text-neutral-500 dark:text-neutral-500">現在の状況</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {bill.status}
        </dd>
        {bill.submittedDate && (
          <>
            <dt className="text-neutral-500 dark:text-neutral-500">提出日</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">
              {bill.submittedDate}
            </dd>
          </>
        )}
        <dt className="text-neutral-500 dark:text-neutral-500">情報源</dt>
        <dd>
          <a
            href={bill.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            衆議院サイトの経過情報を見る
          </a>
        </dd>
      </dl>

      {/* データ未取得（fetch:bill-sponsorships 未実行）のときはセクションごと出さない。
          個別の議案に記載が無いだけの場合は、セクション内でその旨を明示する */}
      {billSponsorships.length > 0 && (
        <BillSponsorshipSection
          sponsorship={sponsorship}
          parties={parties}
          // 収録範囲の文言はハードコードせず、表示に使っているデータから算出する
          coverageFacts={sponsorshipScopeFacts}
        />
      )}

      <h2 className="mt-8 text-lg font-bold text-neutral-900 dark:text-neutral-50">
        審議進捗
      </h2>
      {timeline.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
          進捗履歴データは見つかりませんでした。
        </p>
      ) : (
        <>
          {/* ドットの色は src/lib/billStageColors.ts に集約したステージ別配色を
              使う（法案一覧ページのファネル図と同じステージ＝同じ色）。
              ダークモードはこのアプリの他チャート同様 prefers-color-scheme
              ベース（tailwind.config.ts の darkMode: "media"）。 */}
          <style>{`
            .bill-timeline {
              ${uniqueStages
                .map(
                  (s) =>
                    `--stage-${BILL_STAGE_SLUGS[s]}: ${BILL_STAGE_COLORS[s].light};`
                )
                .join("\n              ")}
            }
            @media (prefers-color-scheme: dark) {
              .bill-timeline {
                ${uniqueStages
                  .map(
                    (s) =>
                      `--stage-${BILL_STAGE_SLUGS[s]}: ${BILL_STAGE_COLORS[s].dark};`
                  )
                  .join("\n                ")}
              }
            }
          `}</style>

          {/* 凡例（このページに登場するステージのみ。色だけに依存しないようラベル併記） */}
          <ul className="bill-timeline mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {uniqueStages.map((stage) => (
              <li
                key={stage}
                className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: `var(--stage-${BILL_STAGE_SLUGS[stage]})` }}
                />
                {BILL_STAGE_COLORS[stage].label}
              </li>
            ))}
          </ul>

          <ol className="bill-timeline mt-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
            {timeline.map((h, i) => (
              <li key={i} className="relative mb-5 pb-1 last:mb-0">
                <span
                  className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-neutral-100 dark:ring-neutral-800"
                  style={{ backgroundColor: `var(--stage-${BILL_STAGE_SLUGS[h.stage]})` }}
                />
                <div className="text-sm text-neutral-500 dark:text-neutral-500">
                  {h.date}
                </div>
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {h.house} / {h.stage}
                </div>
                {h.note && (
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {h.note}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {rollCallVote && (
        <RollCallVoteHeatmap
          vote={rollCallVote}
          parties={parties}
          // 紐付け率・収録範囲はハードコードせず、表示に使っているデータから算出する
          coverageFacts={buildRollCallVoteNoteFacts(rollCallVote, rollCallVotes)}
        />
      )}

      {/* 記名投票が見つからない法案でも、「データが無いこと」自体を明示して
          収録範囲へ誘導する（該当する投票が存在しなかったのか、収録範囲外
          なのかを読み手が区別できるようにするため） */}
      {!rollCallVote && rollCallVotes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            参議院 会派別の賛否（記名投票）
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
            この法案に対応する参議院の記名投票（押しボタン式投票）は、収録している範囲では見つかりませんでした。
          </p>
          <DataCoverageNote
            datasetId="roll-call-votes"
            facts={rollCallScopeFacts}
            className="mt-3"
          />
        </section>
      )}
    </div>
  );
}
