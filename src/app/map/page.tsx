import Link from "next/link";
import {
  getLegislators,
  getParties,
  getPrefectureFinance,
  getPrefectureExpenditureByPurpose,
  getPrefecturePopulation,
  getPrefectureFinancialHealth,
  getPrefectureTurnout,
} from "@/lib/data";
import {
  countLegislatorsByPrefecture,
  countLegislatorsByPrefectureAndParty,
} from "@/lib/prefectures";
import {
  MAJOR_EXPENDITURE_CATEGORIES,
  buildPerCapitaLayer,
  buildPopulationMap,
} from "@/lib/prefectureExpenditureStats";
import {
  FINANCIAL_HEALTH_INDICATORS,
  buildFinancialHealthLayer,
} from "@/lib/financialHealthStats";
import { buildPrefectureTurnoutCoverage } from "@/lib/dataProvenance";
import { MapExplorer } from "@/components/MapExplorer";
import { buildPageMetadata } from "@/lib/siteMetadata";

export const metadata = buildPageMetadata({
  title: "都道府県マップ",
  description:
    "47都道府県を地図から選び、その都道府県に関係する国会議員・地方議会の党派別構成・人口一人当たりの歳出内訳・財政健全化指標・国政選挙の投票率を確認できます。",
  path: "/map",
});

export default async function MapPage() {
  const [
    legislators,
    parties,
    prefectureFinance,
    expenditure,
    population,
    financialHealth,
    turnoutElections,
  ] = await Promise.all([
    getLegislators(),
    getParties(),
    getPrefectureFinance(),
    getPrefectureExpenditureByPurpose(),
    getPrefecturePopulation(),
    getPrefectureFinancialHealth(),
    getPrefectureTurnout(),
  ]);
  const counts = countLegislatorsByPrefecture(legislators);
  const partyCountsByPrefecture = countLegislatorsByPrefectureAndParty(legislators);
  const financeCounts = Object.fromEntries(
    prefectureFinance.map((f) => [f.prefecture, f.totalExpenditureThousandYen])
  );
  const financeFiscalYear = prefectureFinance[0]?.fiscalYear;

  const populationByPrefecture = buildPopulationMap(population);
  const expenditureCategories = MAJOR_EXPENDITURE_CATEGORIES.filter((c) =>
    expenditure.some((row) => row.categories.some((cat) => cat.name === c))
  );
  const expenditureLayers = Object.fromEntries(
    expenditureCategories.map((category) => [
      category,
      buildPerCapitaLayer(expenditure, populationByPrefecture, category),
    ])
  );
  const expenditureFiscalYear = expenditure[0]?.fiscalYear;

  const financialHealthLayers = Object.fromEntries(
    FINANCIAL_HEALTH_INDICATORS.map((indicator) => [
      indicator.key,
      buildFinancialHealthLayer(financialHealth, indicator.key),
    ])
  );
  const financialHealthFiscalYear = financialHealth[0]?.fiscalYear;

  // 投票率データの収録範囲は、免責事項ページと同じ純関数で実データから算出する
  // （件数・回数をハードコードしない）
  const turnoutCoverageFacts =
    buildPrefectureTurnoutCoverage(turnoutElections).facts;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        都道府県マップ
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        都道府県ごとの関連国会議員数のほか、歳出総額・分野別の歳出内訳（人口一人当たり）・財政健全化指標・国政選挙の投票率（男女別・時系列）を、レイヤーを切り替えて地図上で確認できます。
        都道府県をクリックすると、右側にその都道府県の政党別議席構成が表示されます。
      </p>
      <p className="mt-2 text-sm">
        <Link
          href="/map/districts"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          選挙区マップ（衆議院289小選挙区・参議院45選挙区）を見る →
        </Link>
      </p>
      {legislators.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
          データ未取得です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:all
          </code>
          で取得してください。
        </p>
      ) : (
        <MapExplorer
          counts={counts}
          partyCountsByPrefecture={partyCountsByPrefecture}
          parties={parties}
          financeCounts={financeCounts}
          financeFiscalYear={financeFiscalYear}
          expenditureLayers={expenditureLayers}
          expenditureCategories={expenditureCategories as unknown as string[]}
          expenditureFiscalYear={expenditureFiscalYear}
          financialHealthLayers={financialHealthLayers}
          financialHealthFiscalYear={financialHealthFiscalYear}
          turnoutElections={turnoutElections}
          turnoutCoverageFacts={turnoutCoverageFacts}
        />
      )}
    </div>
  );
}
