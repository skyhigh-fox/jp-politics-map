import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLegislators,
  getLocalAssemblyPartyComposition,
  getParties,
  getPrefectureExecutives,
  getPrefectureExpenditureByPurpose,
  getPrefectureExpenditureByNature,
  getPrefecturePopulation,
  getPrefectureFinancialHealth,
} from "@/lib/data";
import {
  PREFECTURE_CODES,
  isValidPrefectureName,
  legislatorPrefectures,
} from "@/lib/prefectures";
import { DataCoverageNote } from "@/components/DataCoverageNote";
import { LocalAssemblyPartyComposition } from "@/components/LocalAssemblyPartyComposition";
import { MunicipalityMap } from "@/components/MunicipalityMap";
import { PrefectureExecutivesSection } from "@/components/PrefectureExecutivesSection";
import { PrefectureExpenditureBreakdown } from "@/components/PrefectureExpenditureBreakdown";
import { PrefectureFinancialHealthCards } from "@/components/PrefectureFinancialHealthCards";
import {
  buildLocalPartyCompositionScopeFacts,
  buildPrefectureExecutiveScopeFacts,
} from "@/lib/dataProvenance";
import {
  buildPrefectureElectionCalendar,
  toIsoDateInJst,
} from "@/lib/electionCalendar";
import { getLocalAssemblyMemberCountsByMunicipality } from "@/lib/localAssembly";
import {
  buildLocalPartyCompositionViews,
  formatAsOfDate,
} from "@/lib/localPartyCompositionStats";
import {
  buildExpenditureBreakdown,
  buildExpenditureByNatureBreakdown,
  buildPopulationMap,
} from "@/lib/prefectureExpenditureStats";
import { buildPageMetadata } from "@/lib/siteMetadata";

const MUNICIPALITY_GEO_BASE =
  "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0010";

/**
 * 都道府県ごとのtitle/description/OGP。
 * 都道府県名は`params`から取るためデコードが必須（未デコードだと
 * 「%E6%9D%B1%E4%BA%AC%E9%83%BD」がそのままタイトルに出る）。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}) {
  const { prefecture: rawPrefecture } = await params;
  const prefecture = decodeURIComponent(rawPrefecture);

  if (!isValidPrefectureName(prefecture)) {
    return buildPageMetadata({
      title: "都道府県",
      description:
        "都道府県ごとの関連国会議員・地方議会の党派別構成・歳出内訳・財政健全化指標を表示しています。",
      path: "/map",
    });
  }

  return buildPageMetadata({
    title: prefecture,
    description: `${prefecture}に関係する国会議員、地方議会及び長の党派別構成、知事・指定都市市長、人口一人当たりの歳出内訳、財政健全化指標を、公的機関の公表資料のまま表示しています。市区町村の地図から地方議会議員も辿れます。`,
    path: `/map/${encodeURIComponent(prefecture)}`,
  });
}

export default async function PrefectureDetailPage({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}) {
  const { prefecture: rawPrefecture } = await params;
  const prefecture = decodeURIComponent(rawPrefecture);
  if (!isValidPrefectureName(prefecture)) notFound();

  const code = PREFECTURE_CODES[prefecture];
  const geoUrl = `${MUNICIPALITY_GEO_BASE}/N03-21_${code}_210101.json`;

  const [
    legislators,
    expenditure,
    expenditureByNature,
    population,
    financialHealth,
    parties,
    localPartyComposition,
    prefectureExecutives,
  ] = await Promise.all([
    getLegislators(),
    getPrefectureExpenditureByPurpose(),
    getPrefectureExpenditureByNature(),
    getPrefecturePopulation(),
    getPrefectureFinancialHealth(),
    getParties(),
    getLocalAssemblyPartyComposition(),
    getPrefectureExecutives(),
  ]);
  const relatedCount = legislators.filter((l) =>
    legislatorPrefectures(l).includes(prefecture)
  ).length;

  const localCounts = await getLocalAssemblyMemberCountsByMunicipality(
    prefecture
  );

  const expenditureRow = expenditure.find((e) => e.prefecture === prefecture);
  const populationByPrefecture = buildPopulationMap(population);
  const expenditureBreakdown = expenditureRow
    ? buildExpenditureBreakdown(expenditureRow, populationByPrefecture)
    : null;

  const natureRow = expenditureByNature.find((e) => e.prefecture === prefecture);
  const natureBreakdown = natureRow
    ? buildExpenditureByNatureBreakdown(natureRow, populationByPrefecture)
    : null;

  const financialHealthRow = financialHealth.find(
    (f) => f.prefecture === prefecture
  );

  // 地方議会・長の党派別構成（Tier1 #6）。個人名簿（東京都パイロット）とは別に、
  // 47都道府県すべてを党派別人員数の集計としてカバーするレイヤー
  const compositionRow = localPartyComposition.find(
    (c) => c.prefecture === prefecture
  );
  const compositionViews = compositionRow
    ? buildLocalPartyCompositionViews(compositionRow, parties)
    : null;

  // 知事・首長と選挙カレンダー（Tier1 #8）。
  // 「任期満了日を既に経過しているか」の判定に使う基準日は、このページを
  // 生成した時点（日本時間の暦日）。日次のデータ更新で再ビルドされるため、
  // 画面上でも基準日を明示して、確定情報との区別が付くようにしている。
  const executivesRow = prefectureExecutives.find(
    (e) => e.prefecture === prefecture
  );
  const referenceDate = toIsoDateInJst(new Date());
  const electionCalendar = executivesRow
    ? buildPrefectureElectionCalendar(executivesRow, referenceDate)
    : [];

  return (
    <div className="animate-fade-in">
      <p className="text-sm">
        <Link
          href="/map"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← 都道府県マップに戻る
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        {prefecture}
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        国会議員（関連） {relatedCount} 名 —{" "}
        <Link
          href={`/legislators?prefecture=${encodeURIComponent(prefecture)}`}
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          一覧を見る
        </Link>
      </p>

      <div className="mt-6 max-w-xl">
        <MunicipalityMap
          geoUrl={geoUrl}
          counts={localCounts ?? undefined}
          linkBase={
            localCounts ? `/local/${encodeURIComponent(prefecture)}` : undefined
          }
        />
      </div>

      {localCounts ? (
        <>
          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">
            市区町村をクリックすると、その地域選出の地方議会議員一覧に移動します。地図上の区市町村は面積が小さく選びづらいことがあるため、下の一覧からも選べます。
          </p>
          <div className="mt-3 max-w-xl rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              市区町村一覧（地方議会議員数）
            </h2>
            <ul className="mt-3 grid max-h-72 grid-cols-1 gap-0.5 overflow-y-auto sm:grid-cols-2">
              {Object.entries(localCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <li key={name}>
                    <Link
                      href={`/local/${encodeURIComponent(prefecture)}/${encodeURIComponent(name)}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-accent-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-accent-400"
                    >
                      <span className="truncate">{name}</span>
                      <span className="shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500">
                        {count}名
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">
          議員個人の名簿を収録している地方議会は、現在フェーズ3のパイロット対象自治体のみです。
          {compositionRow &&
            "党派ごとの人員数（個人名を含まない集計）は、下の「地方議会・長の党派別構成」で全都道府県分をご覧いただけます。"}
        </p>
      )}

      {executivesRow && (
        <div className="mt-6 max-w-xl space-y-3">
          <PrefectureExecutivesSection
            data={executivesRow}
            calendar={electionCalendar}
            referenceDate={referenceDate}
          />
          <DataCoverageNote
            datasetId="prefecture-executives"
            facts={buildPrefectureExecutiveScopeFacts(executivesRow)}
          />
        </div>
      )}

      {compositionRow && compositionViews && (
        <div className="mt-6 max-w-xl space-y-3">
          <LocalAssemblyPartyComposition
            views={compositionViews}
            asOfLabel={formatAsOfDate(compositionRow.asOfDate)}
            sourceUrl={compositionRow.sourceUrl}
            sourcePageUrl={compositionRow.sourcePageUrl}
          />
          <DataCoverageNote
            datasetId="local-assembly-party-composition"
            facts={buildLocalPartyCompositionScopeFacts(compositionRow)}
          />
        </div>
      )}

      {financialHealthRow && (
        <div className="mt-6 max-w-xl">
          <PrefectureFinancialHealthCards data={financialHealthRow} />
        </div>
      )}

      {expenditureBreakdown && (
        <div className="mt-6 max-w-xl">
          <PrefectureExpenditureBreakdown breakdown={expenditureBreakdown} />
        </div>
      )}

      {natureBreakdown && (
        <div className="mt-6 max-w-xl">
          <PrefectureExpenditureBreakdown
            breakdown={natureBreakdown}
            title="歳出の内訳（性質別・人口一人当たり）"
            description={`${natureBreakdown.fiscalYear}年度決算。総務省「地方財政状況調査」の性質別歳出（人件費・扶助費・投資的経費等、支出の性質による分類）を人口一人当たりに換算（並び順は原表の掲載順で固定、金額順ではありません）。`}
          />
        </div>
      )}
    </div>
  );
}
