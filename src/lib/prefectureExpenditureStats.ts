import type {
  PrefectureExpenditureByPurpose,
  PrefecturePopulation,
} from "@/types";

/**
 * 都道府県別・目的別歳出（予算の見える化 Phase A-2）の表示用集計。
 *
 * data/prefecture-expenditure-by-purpose.json の26区分のうち、
 * 「利子割交付金」等の税交付金11区分・前年度繰上充用金は、政策分野への
 * 支出というより税収の按分・繰越処理であり、「税金が何の政策分野に
 * 使われているか」を見せる目的にはノイズになる。総務省の目的別歳出の
 * 標準13分類のみを主要区分として表示し、残りは「その他」にまとめる
 * （データ自体は原表のまま保持し、省略はしない。表示側の集約のみ）。
 *
 * 並び順は総務省の目的別歳出分類の掲載順（中立的な既定順）に固定し、
 * 金額の大小で並べ替えることはしない（他のPhase4集計と同じ中立性方針）。
 */
export const MAJOR_EXPENDITURE_CATEGORIES = [
  "議会費",
  "総務費",
  "民生費",
  "衛生費",
  "労働費",
  "農林水産業費",
  "商工費",
  "土木費",
  "警察費",
  "消防費",
  "教育費",
  "災害復旧費",
  "公債費",
] as const;

export const OTHER_EXPENDITURE_LABEL = "その他（税交付金等）";

export interface ExpenditureBreakdownItem {
  name: string;
  amountThousandYen: number;
  /** 人口一人当たり金額（円）。人口データが無い場合はnull */
  perCapitaYen: number | null;
}

export interface PrefectureExpenditureBreakdown {
  prefecture: string;
  fiscalYear: number;
  totalThousandYen: number;
  /** 主要13区分＋「その他」、総務省の分類順で固定（金額順ソートなし） */
  items: ExpenditureBreakdownItem[];
  population: number | null;
}

function perCapita(
  amountThousandYen: number,
  population: number | null
): number | null {
  if (!population) return null;
  return (amountThousandYen * 1000) / population;
}

export function buildExpenditureBreakdown(
  row: PrefectureExpenditureByPurpose,
  populationByPrefecture: Map<string, number>
): PrefectureExpenditureBreakdown {
  const population = populationByPrefecture.get(row.prefecture) ?? null;
  const byName = new Map(row.categories.map((c) => [c.name, c.amountThousandYen]));

  let otherTotal = 0;
  for (const c of row.categories) {
    if (!(MAJOR_EXPENDITURE_CATEGORIES as readonly string[]).includes(c.name)) {
      otherTotal += c.amountThousandYen;
    }
  }

  const items: ExpenditureBreakdownItem[] = MAJOR_EXPENDITURE_CATEGORIES.map(
    (name) => {
      const amount = byName.get(name) ?? 0;
      return { name, amountThousandYen: amount, perCapitaYen: perCapita(amount, population) };
    }
  );
  items.push({
    name: OTHER_EXPENDITURE_LABEL,
    amountThousandYen: otherTotal,
    perCapitaYen: perCapita(otherTotal, population),
  });

  const totalThousandYen = row.categories.reduce(
    (sum, c) => sum + c.amountThousandYen,
    0
  );

  return {
    prefecture: row.prefecture,
    fiscalYear: row.fiscalYear,
    totalThousandYen,
    items,
    population,
  };
}

export function buildPopulationMap(
  population: PrefecturePopulation[]
): Map<string, number> {
  return new Map(population.map((p) => [p.prefecture, p.population]));
}

/**
 * 地図レイヤー用: 指定した歳出区分（主要13区分いずれか）の
 * 都道府県別・人口一人当たり金額（円）マップを作る。
 */
export function buildPerCapitaLayer(
  expenditure: PrefectureExpenditureByPurpose[],
  populationByPrefecture: Map<string, number>,
  categoryName: string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of expenditure) {
    const population = populationByPrefecture.get(row.prefecture);
    if (!population) continue;
    const amount = row.categories.find((c) => c.name === categoryName)
      ?.amountThousandYen;
    if (amount === undefined) continue;
    result[row.prefecture] = (amount * 1000) / population;
  }
  return result;
}
