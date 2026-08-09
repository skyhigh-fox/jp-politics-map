import { getBills } from "@/lib/data";
import { FilterBar } from "@/components/FilterBar";
import type { Bill } from "@/types";

const DISPLAY_LIMIT = 50;

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
  const shown = sorted.slice(0, DISPLAY_LIMIT);

  return (
    <div>
      <h1 className="text-xl font-bold">法案一覧</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {bills.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1">npm run fetch:bills</code>
            で取得してください。
          </>
        ) : (
          `全${bills.length}件中${filtered.length}件が条件に一致（直近更新の${shown.length}件を表示）`
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

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-2 pr-4">国会回次</th>
            <th className="py-2 pr-4">件名</th>
            <th className="py-2 pr-4">提出</th>
            <th className="py-2 pr-4">院</th>
            <th className="py-2 pr-4">状況</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((bill) => (
            <tr key={bill.id} className="border-b border-neutral-100">
              <td className="py-2 pr-4">{bill.dietSession}</td>
              <td className="py-2 pr-4">
                <a href={bill.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                  {bill.title}
                </a>
              </td>
              <td className="py-2 pr-4">{bill.submitterType}</td>
              <td className="py-2 pr-4">{bill.house}</td>
              <td className="py-2 pr-4">{bill.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
