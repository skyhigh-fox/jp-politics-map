import { getBills, getBillStatusHistory } from "@/lib/data";
import { FilterBar } from "@/components/FilterBar";
import { InfiniteBillsTable } from "@/components/InfiniteBillsTable";
import { BillSessionTrendChart } from "@/components/BillSessionTrendChart";
import { BillStageFunnelChart } from "@/components/BillStageFunnelChart";
import { aggregateBillsBySession } from "@/lib/billSessionStats";
import { aggregateBillFunnel } from "@/lib/billFunnelStats";
import { BILL_TOPIC_ORDER, classifyBillTopics } from "@/lib/billTopics";
import { buildPageMetadata } from "@/lib/siteMetadata";
import type { Bill } from "@/types";

export const metadata = buildPageMetadata({
  title: "法案一覧",
  description:
    "第139回国会以降に国会へ提出された議案を、回次・院・提出区分・審議状況で絞り込んで一覧できます。件数・審議状況は各院の公表情報のまま表示しています。",
  path: "/bills",
});

const HOUSE_OPTIONS = ["衆議院", "参議院", "両院"] as const;
const STATUS_OPTIONS = [
  "審議中",
  "可決",
  "否決",
  "継続審議",
  "廃案",
  "成立",
] as const;
const SUBMITTER_OPTIONS = ["内閣提出", "議員立法"] as const;
// 議案種類（category）は元データ（SmartNews メディア研究所の議案データベース）の
// 表記そのまま。予算・決算・国の収支に関する区分をまとめて先頭に置き、
// 一般的な法律案・条約等をその後に続ける順（中立的な既定順、金額や件数での
// 並び替えはしない）
const CATEGORY_OPTIONS = [
  "予算",
  "決算",
  "承諾",
  "国有財産",
  "ＮＨＫ決算",
  "国庫債務",
  "衆法",
  "参法",
  "閣法",
  "条約",
  "承認",
  "決議",
  "規則",
  "規程",
  "議決",
  "憲法八条議決案",
] as const;

function matchesFilters(
  bill: Bill,
  filters: {
    house?: string;
    status?: string;
    submitterType?: string;
    category?: string;
    topic?: string;
    q?: string;
  }
): boolean {
  if (filters.house && bill.house !== filters.house) return false;
  if (filters.status && bill.status !== filters.status) return false;
  if (filters.submitterType && bill.submitterType !== filters.submitterType)
    return false;
  if (filters.category && bill.category !== filters.category) return false;
  if (
    filters.topic &&
    !classifyBillTopics(bill.title).includes(
      filters.topic as (typeof BILL_TOPIC_ORDER)[number]
    )
  )
    return false;
  if (filters.q && !bill.title.includes(filters.q)) return false;
  return true;
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{
    house?: string;
    status?: string;
    submitterType?: string;
    category?: string;
    topic?: string;
    q?: string;
  }>;
}) {
  const filters = await searchParams;
  const [bills, billStatusHistory] = await Promise.all([
    getBills(),
    getBillStatusHistory(),
  ]);
  const filtered = bills.filter((b) => matchesFilters(b, filters));
  const sorted = [...filtered].sort((a, b) =>
    b.lastUpdated.localeCompare(a.lastUpdated)
  );
  // 推移グラフ・ファネル図は一覧側のフィルタに左右されず、常に全件ベースで
  // 集計する（ページ冒頭のサマリーとして独立させる方針）
  const sessionStats = aggregateBillsBySession(bills);
  const funnelStats = aggregateBillFunnel(billStatusHistory);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        法案一覧
      </h1>

      {bills.length > 0 && <BillSessionTrendChart data={sessionStats} />}

      {funnelStats.totalBills > 0 && (
        <BillStageFunnelChart stats={funnelStats} />
      )}

      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {bills.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              npm run fetch:bills
            </code>
            で取得してください。
          </>
        ) : (
          `全${bills.length}件中${filtered.length}件が条件に一致（更新日の新しい順）`
        )}
      </p>

      {bills.length > 0 && (
        <FilterBar
          selects={[
            {
              key: "house",
              label: "院",
              options: HOUSE_OPTIONS.map((v) => ({ value: v, label: v })),
            },
            {
              key: "status",
              label: "審議状況",
              options: STATUS_OPTIONS.map((v) => ({ value: v, label: v })),
            },
            {
              key: "submitterType",
              label: "提出区分",
              options: SUBMITTER_OPTIONS.map((v) => ({ value: v, label: v })),
            },
            {
              key: "category",
              label: "議案種類",
              options: CATEGORY_OPTIONS.filter((c) =>
                bills.some((b) => b.category === c)
              ).map((v) => ({ value: v, label: v })),
            },
            {
              key: "topic",
              label: "政策分野",
              options: BILL_TOPIC_ORDER.map((v) => ({ value: v, label: v })),
            },
          ]}
          searchKey="q"
          searchLabel="件名で検索"
          searchPlaceholder="例: 予算"
        />
      )}
      {bills.length > 0 && (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-600">
          「政策分野」は件名に含まれるキーワードによる機械的な分類です。人が内容を判断して付けたものではないため、分類の誤り・漏れがあります。
        </p>
      )}

      <InfiniteBillsTable bills={sorted} />
    </div>
  );
}
