import Link from "next/link";
import { getLegislators, getParties, getPartySeatHistory } from "@/lib/data";
import { legislatorPrefectures, PREFECTURE_CODES } from "@/lib/prefectures";
import { FilterBar } from "@/components/FilterBar";
import { InfiniteLegislatorList } from "@/components/InfiniteLegislatorList";
import { SemicircleSeatChart } from "@/components/SemicircleSeatChart";
import { PartySeatTrendChart } from "@/components/PartySeatTrendChart";
import { buildChamberSeatTrend } from "@/lib/partySeatTrendStats";
import { partiesInChamber, partyDisplayName } from "@/lib/party";
import { matchesNameQuery } from "@/lib/nameMatch";
import { buildPageMetadata } from "@/lib/siteMetadata";
import type { Chamber, Legislator, Party } from "@/types";

export const metadata = buildPageMetadata({
  title: "議員一覧",
  description:
    "衆議院・参議院の国会議員を、院・都道府県・会派・氏名で絞り込んで検索できます。各院の公式サイトが公表している会派名・選挙区の表記のまま掲載しています。",
  path: "/legislators",
});

const CHAMBER_OPTIONS = ["衆議院", "参議院"] as const;
const PREFECTURE_OPTIONS = Object.keys(PREFECTURE_CODES);

function isChamber(value: string | undefined): value is Chamber {
  return value === "衆議院" || value === "参議院";
}

/**
 * 「政党・会派」フィルタの選択肢を作る。
 *
 * 会派は院ごとに別組織なので、院が指定されているときはその院に実在する会派だけを、
 * その院の正式会派名で並べる（例: 院=衆議院 のときに参議院にしか無い
 * 「立憲民主・無所属」を選択肢に出さない／「国民民主党・新緑風会」ではなく
 * 衆議院の「国民民主党・無所属クラブ」と表示する）。
 * 院が未指定のときは衆参をまたぐ集計になるため、共通表示名（母体政党名）を使う。
 */
function buildPartyOptions(
  parties: Party[],
  chamber: string | undefined,
  selectedPartyId: string | undefined
): { value: string; label: string }[] {
  const targetChamber = isChamber(chamber) ? chamber : undefined;
  const candidates = targetChamber
    ? partiesInChamber(parties, targetChamber)
    : parties;
  // 選択中の会派がその院に存在しない場合でも、絞り込み状態が選択肢から消えて
  // 「すべて」に見えてしまわないよう、選択中のものだけは必ず残す
  const shown = candidates.some((p) => p.id === selectedPartyId)
    ? candidates
    : [
        ...candidates,
        ...parties.filter((p) => p.id === selectedPartyId),
      ];

  return shown
    .map((p) => ({ value: p.id, label: partyDisplayName(p, targetChamber) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

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
  // 氏名検索は表記ゆれを吸収して判定する。
  // legislators.jsonのnameは姓名間に全角スペースが入る（例:「逢沢　　一郎」）ため
  // 素の includes では「逢沢一郎」がヒットしない。あわせて nameKana による
  // かな検索（ひらがな・カタカナどちらでも可）にも対応する。
  if (filters.q && !matchesNameQuery(filters.q, legislator)) return false;
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
  const [allLegislators, parties, partySeatHistory] = await Promise.all([
    getLegislators(),
    getParties(),
    getPartySeatHistory(),
  ]);
  const legislators = allLegislators.filter((l) => matchesFilters(l, filters));
  const partyOptions = buildPartyOptions(
    parties,
    filters.chamber,
    filters.party
  );

  const shugiinSeatTrend = buildChamberSeatTrend(partySeatHistory, parties, "衆議院");
  const sangiinSeatTrend = buildChamberSeatTrend(partySeatHistory, parties, "参議院");

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        議員一覧{filters.prefecture ? `（${filters.prefecture}）` : ""}
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {allLegislators.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              npm run fetch:sangiin-members / fetch:shugiin-members
            </code>
            で取得してください。
          </>
        ) : (
          `全${allLegislators.length}名中${legislators.length}名が条件に一致`
        )}
      </p>

      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
        この一覧は衆参の国会議員のみが対象です。都道府県議会・市区町村議会の地方議会議員（現在は東京都のみパイロット対応）は
        <Link
          href="/map"
          className="ml-1 text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          都道府県マップ
        </Link>
        からご覧いただけます。
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
              options: partyOptions,
            },
            {
              key: "prefecture",
              label: "都道府県",
              options: PREFECTURE_OPTIONS.map((v) => ({ value: v, label: v })),
            },
          ]}
          searchKey="q"
          searchLabel="氏名・よみで検索"
          searchPlaceholder="例: 山田 / やまだ"
        />
      )}

      {allLegislators.length > 0 && (
        <details className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <summary className="cursor-pointer select-none text-sm font-semibold text-neutral-900 hover:text-accent-600 dark:text-neutral-100 dark:hover:text-accent-400">
            政党別議席構成・推移を見る
          </summary>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
            検索・絞り込みとは別に、衆参両院の現在の議席配置と、過去の選挙ごとの推移を確認できます（議席数降順のみで表示、評価的な並び順ではありません）。
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SemicircleSeatChart chamber="衆議院" legislators={allLegislators} parties={parties} />
            <SemicircleSeatChart chamber="参議院" legislators={allLegislators} parties={parties} />
          </div>

          {(shugiinSeatTrend || sangiinSeatTrend) && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {shugiinSeatTrend && <PartySeatTrendChart trend={shugiinSeatTrend} />}
              {sangiinSeatTrend && <PartySeatTrendChart trend={sangiinSeatTrend} />}
            </div>
          )}
        </details>
      )}

      <InfiniteLegislatorList legislators={legislators} parties={parties} />
    </div>
  );
}
