import type { Metadata } from "next";
import Link from "next/link";
import { BudgetStackedTrendChart } from "@/components/BudgetStackedTrendChart";
import { NationalBudgetBreakdown } from "@/components/NationalBudgetBreakdown";
import { getNationalBudget } from "@/lib/data";
import { formatYenCompact } from "@/lib/formatFinance";
import { buildPageMetadata } from "@/lib/siteMetadata";
import {
  STATUTORY_EARMARK_NOTES,
  buildBreakdownFacts,
  buildCategoryTrends,
  buildLatestBreakdown,
  buildStackedTrend,
  buildStackedTrendFacts,
} from "@/lib/nationalBudgetStats";

/**
 * 国の税収・歳出ビューア（機能拡充ロードマップ Tier1 #2）。
 * 財務省の公表Excel（税収の推移／財政統計 第4表・第20表・第24表）をもとに、
 * 一般会計の税収・歳入・歳出を年度推移つきで表示する。
 *
 * 【このページの中立性の設計制約（変更時は必ず守ること）】
 * 1. 個別税目→個別経費のフロー図（サンキー図）を作らない。一般会計は
 *    ノンアフェクタシオンの原則で運用され、大半の税目は特定経費に紐づかない。
 *    法律に明記された例外（消費税法第1条第2項・地方交付税法第6条）だけを
 *    根拠条文つきの注記として別枠で示す。
 * 2. 「年収を入力→あなたの税金の使い道」型のパーソナライズ計算を作らない
 *    （推計モデル自体が編集判断を含むため）。人口で割るだけの一人当たり額は可。
 * 3. いわゆる「ワニの口」（税収と歳出の乖離の強調）表現を作らない。公債金は
 *    歳入の一科目として他の科目と同じ扱い・同じ配色で表示する。
 * 4. 区分は財務省の公式分類（主要科目別・主要経費別・目的別）をそのまま使う。
 *    独自に再集約・再定義しない。
 * 5. 「無駄」「削減余地」「効率」等の評価語を使わない。
 * 6. 単年度の絶対額だけを見せず、必ず年度推移を併置する。
 */

export const metadata: Metadata = buildPageMetadata({
  title: "国の予算・決算",
  description:
    "財務省の公表データをもとに、国（一般会計）の税収・歳入・歳出の内訳と年度推移を、財務省の公式区分のまま表示します。",
  path: "/budget",
});

export default async function BudgetPage() {
  const budget = await getNationalBudget();

  if (!budget) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          国の予算・決算
        </h1>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          データがまだ取得されていません（<code>npm run fetch:national-budget</code>{" "}
          を実行してください）。
        </p>
      </div>
    );
  }

  const {
    taxRevenue,
    revenueByMajorItem,
    expenditureByMajorExpense,
    expenditureByPurpose,
    latestSettlementFiscalYear,
  } = budget;

  const taxTrend = buildStackedTrend(taxRevenue);
  const revenueTrend = buildStackedTrend(revenueByMajorItem);

  const majorExpenseBreakdown = buildLatestBreakdown(expenditureByMajorExpense);
  const purposeBreakdown = buildLatestBreakdown(expenditureByPurpose);
  const majorExpenseTrends = buildCategoryTrends(expenditureByMajorExpense);
  const purposeTrends = buildCategoryTrends(expenditureByPurpose);

  const latestSettlementLabel =
    revenueByMajorItem.years.at(-1)?.eraLabel ?? `${latestSettlementFiscalYear}年度`;
  const latestExpenditureTotal =
    expenditureByMajorExpense.years.at(-1)?.totalThousandYen ?? null;
  const latestRevenueTotal = revenueByMajorItem.years.at(-1)?.totalThousandYen ?? null;
  // 税収の推移表は決算確定年度より先（予算額ベース）まで載るため、
  // 「決算年度」とは別に、表がカバーしている最新年度を注記に使う
  const latestTaxYearLabel = taxRevenue.years.at(-1)?.eraLabel ?? "";

  return (
    <div className="animate-fade-in space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
          国の予算・決算
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          財務省が公表している一般会計の税収・歳入・歳出を、財務省の公式区分・掲載順のまま表示しています。金額の大小で区分を並べ替えたり、独自にカテゴリをまとめ直したりはしていません。
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">
              対象・年度
            </dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              一般会計 / {latestSettlementLabel}決算まで
            </dd>
            <dd className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              特別会計・政府関係機関は含みません。税収の推移のみ{latestTaxYearLabel}
              （予算額）まで収録。
            </dd>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">
              {latestSettlementLabel}の歳入決算 / 歳出決算
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {latestRevenueTotal !== null ? formatYenCompact(latestRevenueTotal) : "―"}
              {" / "}
              {latestExpenditureTotal !== null
                ? formatYenCompact(latestExpenditureTotal)
                : "―"}
            </dd>
            <dd className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              いずれも決算額（予算額ではありません）。
            </dd>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">出典</dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              財務省
            </dd>
            <dd className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              「税収の推移」および「財政統計（予算決算等データ）」第4表・第20表・第24表。政府標準利用規約に基づき利用。
            </dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
          <p className="font-semibold text-neutral-700 dark:text-neutral-300">
            グラフを読むときの前提
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              ・
              <strong className="font-medium">決算額と予算額は別のもの</strong>
              です。歳入・歳出の各グラフはすべて決算額（実際に収納・支出された額）です。税収の推移グラフだけは決算が確定していない年度（
              {latestSettlementFiscalYear + 1}年度以降）を含み、その年度は斜線で区別しています。
            </li>
            <li>
              ・一般会計は
              <strong className="font-medium">
                特定の歳入を特定の歳出に紐づけない
              </strong>
              仕組み（ノンアフェクタシオンの原則）で運用されています。このため「この税金がこの経費に使われた」という対応づけの図は掲載していません。法律で使途が定められている例外は下の
              <a href="#statutory" className="text-accent-600 hover:underline dark:text-accent-400">
                「法律で定めのある結びつき」
              </a>
              に記載しています。
            </li>
            <li>
              ・金額は財務省の原資料の値をそのまま用い、表示のみ「兆円／億円」に換算しています。四捨五入のため、内訳の合計と原資料の合計額が数千円単位で一致しないことがあります。
            </li>
          </ul>
        </div>
      </header>

      <BudgetStackedTrendChart
        trend={taxTrend}
        heading="税収の推移（税目別）"
        description="一般会計税収を、財務省が公表している所得税・法人税・消費税の3税目と、それ以外の税目（相続税・酒税・揮発油税・印紙収入等）の残額に分けた積み上げ棒グラフです。3税目以外の内訳は原資料に記載がないため、一般会計税収から3税目を差し引いた額を「その他の税収」としてまとめています。"
        provisionalNote={`斜線の年度（${latestSettlementFiscalYear + 1}年度以降）は決算が確定していない年度で、財務省公表時点の予算額です。`}
        facts={buildStackedTrendFacts(taxTrend, "一般会計税収")}
        source={{
          title: taxRevenue.sourceTitle,
          url: taxRevenue.sourceUrl,
          pageUrl: taxRevenue.sourcePageUrl,
        }}
      />

      <BudgetStackedTrendChart
        trend={revenueTrend}
        heading="一般会計歳入 主要科目別決算の推移"
        description="歳入決算を財務省の主要科目別に積み上げた棒グラフです。公債金（国債の発行によって調達した収入）も、租税及印紙収入や雑収入と同じ扱いの1科目として表示しています。「つなぎ公債・決算調整資金受入等」は、原資料の合計額と主要科目の単純合計との差額で、原資料の注記によれば決算調整資金からの受入と、独立した科目を持たないつなぎ公債（減税特例公債・復興債・年金特例公債等）がこれにあたります。専売納付金は制度の廃止に伴い、平成13年度以降は計上がありません。"
        facts={buildStackedTrendFacts(revenueTrend, "一般会計歳入決算")}
        source={{
          title: revenueByMajorItem.sourceTitle,
          url: revenueByMajorItem.sourceUrl,
          pageUrl: revenueByMajorItem.sourcePageUrl,
        }}
      />

      {majorExpenseBreakdown && (
        <NationalBudgetBreakdown
          heading="一般会計歳出決算 主要経費別"
          description="歳出決算を「主要経費別分類」（社会保障関係費・国債費・地方交付税交付金・防衛関係費・公共事業関係費など、予算編成で使われる分類）で見た内訳と、区分ごとの年度推移です。"
          facts={buildBreakdownFacts(majorExpenseBreakdown, expenditureByMajorExpense)}
          breakdown={majorExpenseBreakdown}
          trends={majorExpenseTrends}
          source={{
            title: expenditureByMajorExpense.sourceTitle,
            url: expenditureByMajorExpense.sourceUrl,
            pageUrl: expenditureByMajorExpense.sourcePageUrl,
          }}
          footnote={
            <p>
              「地方交付税交付金」「地方特例交付金」は、国から地方公共団体へ配分される財源です。配分された先の都道府県の歳入・歳出は{" "}
              <Link
                href="/map"
                className="text-accent-600 hover:underline dark:text-accent-400"
              >
                都道府県マップ
              </Link>{" "}
              の各都道府県ページで確認できます。
            </p>
          }
        />
      )}

      {purposeBreakdown && (
        <NationalBudgetBreakdown
          heading="一般会計歳出決算 目的別"
          description="同じ歳出決算を「目的別分類」（国家機関費・地方財政費・社会保障関係費など、支出の目的による分類）で見た内訳と、区分ごとの年度推移です。主要経費別分類とは切り口が異なるだけで、合計額は同じです。"
          facts={buildBreakdownFacts(purposeBreakdown, expenditureByPurpose)}
          breakdown={purposeBreakdown}
          trends={purposeTrends}
          source={{
            title: expenditureByPurpose.sourceTitle,
            url: expenditureByPurpose.sourceUrl,
            pageUrl: expenditureByPurpose.sourcePageUrl,
          }}
        />
      )}

      <section
        id="statutory"
        className="scroll-mt-20 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
      >
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          法律で定めのある結びつき
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          一般会計では原則として特定の歳入と特定の歳出は紐づけられませんが、法律に明記された例外が次の2件あります。これらは条文に基づく事実であり、上のグラフには反映していません（グラフに反映すると、法律の定めがない他の税目についても対応づけがあるかのように読めてしまうため）。
        </p>
        <dl className="mt-3 space-y-3">
          {STATUTORY_EARMARK_NOTES.map((note) => (
            <div
              key={note.law}
              className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <dt className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {note.title}
                <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  {note.law}
                </span>
              </dt>
              <dd className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                {note.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs leading-relaxed text-neutral-400 dark:text-neutral-600">
        このページは財務省が公表した数値をそのまま集計・表示するもので、予算の是非についての評価・順位づけは行いません。データは日次で自動更新しています（財務省側の更新は年1回程度）。
      </p>
    </div>
  );
}
