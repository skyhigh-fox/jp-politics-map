import {
  getLegislators,
  getParties,
  getPrefectureFinance,
  getPrefectureExpenditureByPurpose,
  getPrefecturePopulation,
  getPrefectureFinancialHealth,
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
import { MapExplorer } from "@/components/MapExplorer";

export default async function MapPage() {
  const [
    legislators,
    parties,
    prefectureFinance,
    expenditure,
    population,
    financialHealth,
  ] = await Promise.all([
    getLegislators(),
    getParties(),
    getPrefectureFinance(),
    getPrefectureExpenditureByPurpose(),
    getPrefecturePopulation(),
    getPrefectureFinancialHealth(),
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

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        都道府県マップ
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        都道府県ごとの関連国会議員数（小選挙区・参議院選挙区の当該都道府県選出議員
        ＋ 比例代表で当該都道府県を含むブロック選出議員の合計）を色の濃さで表示。
        都道府県をクリックすると、右側にその都道府県の政党別議席構成が表示されます。
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
        />
      )}
    </div>
  );
}
