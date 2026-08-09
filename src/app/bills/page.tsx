import { getBills } from "@/lib/data";
import { FilterBar } from "@/components/FilterBar";
import { InfiniteBillsTable } from "@/components/InfiniteBillsTable";
import type { Bill } from "@/types";

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

function matchesFilters(
  bill: Bill,
  filters: { house?: string; status?: string; submitterType?: string; q?: string }
): boolean {
  if (filters.house && bill.house !== filters.house) return false;
  if (filters.status && bill.status !== filters.status) return false;
  if (filters.submitterType && bill.submitterType !== filters.submitterType)
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
    q?: string;
  }>;
}) {
  const filters = await searchParams;
  const bills = await getBills();
  const filtered = bills.filter((b) => matchesFilters(b, filters));
  const sorted = [...filtered].sort((a, b) =>
    b.lastUpdated.localeCompare(a.lastUpdated)
  );

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        法案一覧
      </h1>
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
          ]}
          searchKey="q"
          searchLabel="件名で検索"
          searchPlaceholder="例: 予算"
        />
      )}

      <InfiniteBillsTable bills={sorted} />
    </div>
  );
}
