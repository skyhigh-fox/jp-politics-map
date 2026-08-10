import type { NationalBudgetSeries, NationalBudgetYear } from "@/types";
import { formatYenCompact } from "@/lib/formatFinance";
import {
  BUDGET_CATEGORICAL_COLORS,
  BUDGET_MAX_STACKED_SERIES,
} from "@/lib/budgetChartColors";

/**
 * 国の税収・歳出データ（data/national-budget.json）の表示用集計。
 *
 * 【中立性の方針（このファイルを触るときは必ず守ること）】
 * - 区分名は財務省の公式分類のまま使う。独自の再集約・言い換えはしない。
 * - 並び順は原資料の掲載順に固定する（金額の大小で並べ替えない）。
 * - 事実要約（DataInsight）は表示中の数値から機械的に算出できる言い換えに
 *   留め、「無駄」「削減余地」「効率」等の評価語や原因の説明は書かない。
 * - 税目→経費のフロー（サンキー図）は作らない。一般会計はノンアフェクタシオンの
 *   原則で運用され、法律上の例外は `STATUTORY_EARMARK_NOTES` の2件のみ。
 */

// ---------------------------------------------------------------------------
// 積み上げ推移グラフ用
// ---------------------------------------------------------------------------

export interface StackedTrendSegment {
  key: string;
  label: string;
  light: string;
  dark: string;
  amountThousandYen: number;
}

export interface StackedTrendYear {
  fiscalYear: number;
  eraLabel: string;
  isSettlement: boolean;
  /** 積み上げ順（下→上）＝原資料の掲載順 */
  segments: StackedTrendSegment[];
  /** 積み上げの合計（＝segmentsの単純合計。原表の合計とは端数で微差がありうる） */
  stackedTotalThousandYen: number;
  /** 原表に記載された合計額 */
  totalThousandYen: number | null;
}

export interface StackedTrend {
  title: string;
  legend: { key: string; label: string; light: string; dark: string }[];
  years: StackedTrendYear[];
  maxStackedTotal: number;
}

/**
 * 系列（＝財務省の1つの表）を積み上げ棒グラフ用の形に整える。
 * 区分数が配色スロット数（8）を超える系列には使えない（意図的に例外を投げる。
 * 独自に「その他」へ再集約しない方針のため、9区分以上はスモールマルチプルで扱う）。
 */
export function buildStackedTrend(series: NationalBudgetSeries): StackedTrend {
  if (series.categoryNames.length > BUDGET_MAX_STACKED_SERIES) {
    throw new Error(
      `区分数（${series.categoryNames.length}）が配色スロット数（${BUDGET_MAX_STACKED_SERIES}）を超えています: ${series.title}`
    );
  }

  const legend = series.categoryNames.map((name, i) => ({
    key: name,
    label: name,
    light: BUDGET_CATEGORICAL_COLORS[i]!.light,
    dark: BUDGET_CATEGORICAL_COLORS[i]!.dark,
  }));
  const colorByName = new Map(legend.map((l) => [l.key, l]));

  const years: StackedTrendYear[] = series.years.map((year) => {
    const segments: StackedTrendSegment[] = [];
    for (const name of series.categoryNames) {
      const amount = year.items.find((i) => i.name === name)?.amountThousandYen ?? null;
      if (amount === null || amount <= 0) continue; // 該当なし・0の年度は帯を描かない
      const color = colorByName.get(name)!;
      segments.push({
        key: name,
        label: name,
        light: color.light,
        dark: color.dark,
        amountThousandYen: amount,
      });
    }
    return {
      fiscalYear: year.fiscalYear,
      eraLabel: year.eraLabel,
      isSettlement: year.isSettlement,
      segments,
      stackedTotalThousandYen: segments.reduce((s, seg) => s + seg.amountThousandYen, 0),
      totalThousandYen: year.totalThousandYen,
    };
  });

  return {
    title: series.title,
    legend,
    years,
    maxStackedTotal: Math.max(...years.map((y) => y.stackedTotalThousandYen), 0),
  };
}

// ---------------------------------------------------------------------------
// 単年度の内訳（バーリスト）用
// ---------------------------------------------------------------------------

export interface BudgetBreakdownItem {
  name: string;
  amountThousandYen: number | null;
  /** 合計に占める割合（%）。合計が取れない場合はnull */
  sharePercent: number | null;
  subItems: { name: string; amountThousandYen: number | null }[];
}

export interface BudgetBreakdown {
  fiscalYear: number;
  eraLabel: string;
  isSettlement: boolean;
  totalThousandYen: number | null;
  /** 原資料の掲載順で固定（金額順ソートなし） */
  items: BudgetBreakdownItem[];
}

/** 系列の最新年度（＝配列末尾）の内訳を取り出す */
export function buildLatestBreakdown(series: NationalBudgetSeries): BudgetBreakdown | null {
  const year = series.years.at(-1);
  if (!year) return null;
  return buildBreakdown(year);
}

export function buildBreakdown(year: NationalBudgetYear): BudgetBreakdown {
  const total = year.totalThousandYen;
  return {
    fiscalYear: year.fiscalYear,
    eraLabel: year.eraLabel,
    isSettlement: year.isSettlement,
    totalThousandYen: total,
    items: year.items.map((item) => ({
      name: item.name,
      amountThousandYen: item.amountThousandYen,
      sharePercent:
        total && total > 0 && item.amountThousandYen !== null
          ? (item.amountThousandYen / total) * 100
          : null,
      subItems: (item.subItems ?? []).map((s) => ({
        name: s.name,
        amountThousandYen: s.amountThousandYen,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// スモールマルチプル（区分ごとの年度推移）用
// ---------------------------------------------------------------------------

export interface CategoryTrend {
  name: string;
  /** 年度昇順。原資料に金額の記載がない年度は含めない */
  points: { fiscalYear: number; eraLabel: string; amountThousandYen: number }[];
  maxAmountThousandYen: number;
}

/**
 * 区分ごとに独立した推移（スモールマルチプル）を作る。
 * 9区分以上ある歳出side（主要経費別・目的別）は、色を9色目に拡張したり
 * 独自に「その他」へ再集約したりせず、この形で年度推移を見せる。
 *
 * @param categoryNames 表示する区分（省略時は最新年度に金額のある区分すべて）
 */
export function buildCategoryTrends(
  series: NationalBudgetSeries,
  categoryNames?: string[]
): CategoryTrend[] {
  const latest = series.years.at(-1);
  const names =
    categoryNames ??
    series.categoryNames.filter((name) =>
      latest?.items.some((i) => i.name === name && i.amountThousandYen !== null)
    );

  return names.map((name) => {
    const points: CategoryTrend["points"] = [];
    for (const year of series.years) {
      const amount = year.items.find((i) => i.name === name)?.amountThousandYen;
      if (amount === null || amount === undefined) continue;
      points.push({
        fiscalYear: year.fiscalYear,
        eraLabel: year.eraLabel,
        amountThousandYen: amount,
      });
    }
    return {
      name,
      points,
      maxAmountThousandYen: Math.max(...points.map((p) => p.amountThousandYen), 0),
    };
  });
}

// ---------------------------------------------------------------------------
// 法律上の目的税・法定率に関する注記
// ---------------------------------------------------------------------------

/**
 * 【重要】一般会計は原則としてノンアフェクタシオン（特定の歳入を特定の歳出に
 * 紐づけない）で運用される。したがって「この税金がこの経費に使われている」と
 * 読める図（サンキー図等）は作らない。
 *
 * ただし、法律に明記された結びつきが2件だけ存在するので、根拠条文つきで
 * 別枠の注記として提示する（グラフ本体には反映しない）。
 */
export const STATUTORY_EARMARK_NOTES: { title: string; law: string; body: string }[] = [
  {
    title: "消費税の収入の使途",
    law: "消費税法第1条第2項",
    body: "消費税の収入は、地方交付税法に定めるところによるほか、毎年度、制度として確立された年金・医療・介護の社会保障給付及び少子化に対処するための施策に要する経費に充てる旨が法律に定められている。",
  },
  {
    title: "地方交付税の法定率",
    law: "地方交付税法第6条",
    body: "所得税・法人税・酒税・消費税の収入額のうち法律で定められた割合と、地方法人税の収入額の全額が、地方交付税の総額とされている。",
  },
];

// ---------------------------------------------------------------------------
// DataInsight 用の事実文（決定的・テンプレートベース。評価語は使わない）
// ---------------------------------------------------------------------------

function formatDiff(current: number, past: number): string {
  const diff = current - past;
  return `${formatYenCompact(Math.abs(diff))}${diff >= 0 ? "多い" : "少ない"}`;
}

/** 積み上げ推移グラフ用の事実文 */
export function buildStackedTrendFacts(trend: StackedTrend, unitLabel: string): string[] {
  const facts: string[] = [];
  const latest = trend.years.at(-1);
  if (!latest) return facts;

  const largest = [...latest.segments].sort(
    (a, b) => b.amountThousandYen - a.amountThousandYen
  )[0];
  if (largest && latest.stackedTotalThousandYen > 0) {
    const share = (largest.amountThousandYen / latest.stackedTotalThousandYen) * 100;
    facts.push(
      `${latest.eraLabel}の${unitLabel}は${formatYenCompact(latest.stackedTotalThousandYen)}。内訳のうち金額が最も大きいのは「${largest.label}」で${formatYenCompact(largest.amountThousandYen)}（全体の${share.toFixed(1)}%）。`
    );
  }

  const tenYearsAgo = trend.years.find((y) => y.fiscalYear === latest.fiscalYear - 10);
  if (tenYearsAgo && latest.stackedTotalThousandYen > 0) {
    facts.push(
      `10年前の${tenYearsAgo.eraLabel}（${formatYenCompact(tenYearsAgo.stackedTotalThousandYen)}）と比べると、${latest.eraLabel}は${formatDiff(latest.stackedTotalThousandYen, tenYearsAgo.stackedTotalThousandYen)}。`
    );
  }

  const first = trend.years[0];
  if (first) {
    facts.push(
      `グラフの対象期間は${first.eraLabel}〜${latest.eraLabel}（${trend.years.length}年度分）。`
    );
  }
  return facts;
}

/** 単年度の内訳バーリスト用の事実文 */
export function buildBreakdownFacts(
  breakdown: BudgetBreakdown,
  series: NationalBudgetSeries
): string[] {
  const facts: string[] = [];
  const withAmount = breakdown.items.filter(
    (i): i is BudgetBreakdownItem & { amountThousandYen: number } =>
      i.amountThousandYen !== null && i.amountThousandYen > 0
  );
  if (withAmount.length === 0) return facts;

  const sorted = [...withAmount].sort((a, b) => b.amountThousandYen - a.amountThousandYen);
  const top3 = sorted.slice(0, 3);
  const total = breakdown.totalThousandYen;
  if (total && total > 0) {
    const top3Share = (top3.reduce((s, i) => s + i.amountThousandYen, 0) / total) * 100;
    facts.push(
      `${breakdown.eraLabel}の${series.title}は合計${formatYenCompact(total)}。金額が大きい3区分は${top3
        .map((i) => `${i.name}（${formatYenCompact(i.amountThousandYen)}）`)
        .join("、")}で、この3区分で合計の${top3Share.toFixed(1)}%を占める。`
    );
  }

  const first = series.years[0];
  const latestYear = series.years.at(-1);
  if (first && latestYear) {
    facts.push(
      `区分と並び順は${series.sourceTitle}の掲載どおり（金額の大小では並べ替えていない）。データは${first.eraLabel}〜${latestYear.eraLabel}の${series.years.length}年度分。`
    );
  }
  return facts;
}
