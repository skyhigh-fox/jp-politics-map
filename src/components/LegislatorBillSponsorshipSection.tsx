import Link from "next/link";
import type { Bill } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { DataCoverageNote } from "@/components/DataCoverageNote";

/**
 * 議員詳細ページの「提出者・賛成者として名を連ねた法案」セクション
 * （機能拡充ロードマップ Tier1 #3。法案DBと議員DBを双方向に接続するためのもの）。
 *
 * 【中立性の方針（重要）】
 * - 「この議員がどの法案の提出者・賛成者として記載されているか」という事実の
 *   一覧に留める。件数の多寡を活動量の評価やランキングとして提示しない。
 *   提出者・賛成者に名を連ねる理由は多様（所属会派の慣行、委員会での役職など）で、
 *   本人の関与度を測る指標にはならないため。
 * - 収録範囲は第139回国会以降の衆議院の議案経過情報に限られ、参議院に発議された
 *   議案の発議者は原資料に含まれない。件数が0件であることは「提出した法案が
 *   なかった」ことを意味しないため、その旨を注記に明示する。
 */

function BillRow({ bill }: { bill: Bill }) {
  return (
    <li className="border-b border-neutral-100 py-2 last:border-0 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-500">
          第{bill.dietSession}回
        </span>
        <Link
          href={`/bills/${encodeURIComponent(bill.id)}`}
          className="text-sm text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          {bill.title}
        </Link>
        <StatusBadge status={bill.status} />
      </div>
    </li>
  );
}

/**
 * 議案一覧の折りたたみブロック。
 * 提出者としての記載は数件〜95件、提出の賛成者としての記載は最大700件規模まで
 * 幅があるため、件数が多いときだけ畳んだ状態で始める（件数はサマリーに常時出す）。
 */
const AUTO_OPEN_MAX = 20;

function BillListBlock({
  title,
  bills,
  note,
}: {
  title: string;
  bills: Bill[];
  note?: string;
}) {
  const autoOpen = bills.length <= AUTO_OPEN_MAX;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <details open={autoOpen}>
        <summary className="cursor-pointer text-sm font-semibold text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300">
          {title}（{bills.length}件{autoOpen ? "" : "・クリックで一覧を表示"}）
        </summary>
        {note && (
          <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
            {note}
          </p>
        )}
        <ul className="mt-1">
          {bills.map((bill) => (
            <BillRow key={bill.id} bill={bill} />
          ))}
        </ul>
      </details>
    </div>
  );
}

export function LegislatorBillSponsorshipSection({
  sponsoredBills,
  supportedBills,
  coverageFacts,
}: {
  sponsoredBills: Bill[];
  supportedBills: Bill[];
  coverageFacts: string[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        提出者・賛成者として名を連ねた法案
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
        衆議院の議案経過情報の「議案提出者一覧」「議案提出の賛成者」欄に氏名の記載がある議案です。件数の多寡による評価・ランキングを意図したものではありません。
      </p>

      {sponsoredBills.length === 0 && supportedBills.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-500">
          収録している範囲では、この議員の氏名が記載された議案は見つかりませんでした。
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {sponsoredBills.length > 0 && (
            <BillListBlock
              title="提出者（発議者）として記載"
              bills={sponsoredBills}
            />
          )}
          {supportedBills.length > 0 && (
            <BillListBlock
              title="提出の賛成者として記載"
              bills={supportedBills}
              note="議員立法の発議に必要な賛成者（国会法第56条）として名を連ねた議案です。本会議での賛否とは別のものです。提出者としても記載されている議案は、上の一覧にのみ表示しています。"
            />
          )}
        </div>
      )}

      <DataCoverageNote
        datasetId="bill-sponsorships"
        facts={coverageFacts}
        className="mt-3"
      />
    </section>
  );
}
