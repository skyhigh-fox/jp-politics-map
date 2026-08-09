import Link from "next/link";
import { getLegislators, getParties } from "@/lib/data";
import { legislatorPrefectures, PREFECTURE_CODES } from "@/lib/prefectures";
import { FilterBar } from "@/components/FilterBar";
import type { Legislator, Party } from "@/types";

const CHAMBER_OPTIONS = ["衆議院", "参議院"] as const;
const PREFECTURE_OPTIONS = Object.keys(PREFECTURE_CODES);

function matchesFilters(
  legislator: Legislator,
  filters: { chamber?: string; party?: string; prefecture?: string; q?: string }
): boolean {
  if (filters.chamber && legislator.chamber !== filters.chamber) return false;
  if (filters.party && legislator.currentPartyId !== filters.party)
    return false;
  if (
    filters.prefecture &&
    !legislatorPrefectures(legislator).includes(filters.prefecture)
  )
    return false;
  if (filters.q && !legislator.name.includes(filters.q)) return false;
  return true;
}

export default async function LegislatorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    chamber?: string;
    party?: string;
    prefecture?: string;
    q?: string;
  }>;
}) {
  const filters = await searchParams;
  const [allLegislators, parties] = await Promise.all([
    getLegislators(),
    getParties(),
  ]);
  const legislators = allLegislators.filter((l) => matchesFilters(l, filters));
  const partyName = (id: string) =>
    parties.find((p) => p.id === id)?.name ?? "不明";
  const sortedParties = [...parties].sort((a, b) =>
    a.name.localeCompare(b.name, "ja")
  );

  return (
    <div>
      <h1 className="text-xl font-bold">
        議員一覧{filters.prefecture ? `（${filters.prefecture}）` : ""}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        {allLegislators.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1">
              npm run fetch:sangiin-members / fetch:shugiin-members
            </code>
            で取得してください。
          </>
        ) : (
          `全${allLegislators.length}名中${legislators.length}名が条件に一致`
        )}
      </p>

      {allLegislators.length > 0 && (
        <FilterBar
          selects={[
            {
              key: "chamber",
              label: "院",
              options: CHAMBER_OPTIONS.map((v) => ({ value: v, label: v })),
            },
            {
              key: "party",
              label: "政党・会派",
              options: sortedParties.map((p: Party) => ({
                value: p.id,
                label: p.name,
              })),
            },
            {
              key: "prefecture",
              label: "都道府県",
              options: PREFECTURE_OPTIONS.map((v) => ({ value: v, label: v })),
            },
          ]}
          searchKey="q"
          searchLabel="氏名で検索"
          searchPlaceholder="例: 山田"
        />
      )}

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {legislators.map((legislator) => (
          <li key={legislator.id}>
            <Link
              href={`/legislators/${legislator.id}`}
              className="block rounded border border-neutral-200 p-3 text-sm hover:border-neutral-400"
            >
              <div className="font-semibold">{legislator.name}</div>
              <div className="text-neutral-600">
                {legislator.chamber} / {partyName(legislator.currentPartyId)}
              </div>
              <div className="text-neutral-600">{legislator.district}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
