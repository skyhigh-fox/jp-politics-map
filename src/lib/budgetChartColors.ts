/**
 * 【国の予算・決算グラフ（/budget）のカテゴリカル配色】
 *
 * 歳入の科目（租税及印紙収入・公債金・雑収入…）や税目（所得税・法人税…）は、
 * 政党や審議ステージと違って既存の識別色を持たない「並列で優劣のない区分」なので、
 * dataviz skill の reference palette（8スロットのカテゴリカル配色）をそのまま
 * 採用する。区分の順序は財務省の原資料の掲載順に固定し、色はスロット順に
 * 割り当てる（金額の大小で色を付け替えない＝色は区分そのものに従う）。
 *
 * 検証: dataviz skill の `scripts/validate_palette.js` で、このプロジェクトの
 * 実際のカードサーフェス（light `#ffffff` = bg-white / dark `#171717` =
 * dark:bg-neutral-900）に対して検証済み（2026-08-11）。
 *   - light: Lightness band / Chroma floor / CVD separation（最悪隣接 ΔE 9.1）/
 *     Normal-vision floor（最悪隣接 ΔE 19.6）は PASS。
 *     Contrast vs surface のみ WARN（`#1baf7a` 2.82・`#eda100` 2.17・
 *     `#e87ba4` 2.69 が3:1未満）。WARNは「relief channel（ラベル併記の凡例・
 *     直接ツールチップ・データ表）を必ず用意すること」という条件付きの許容なので、
 *     BudgetStackedTrendChart では凡例・ツールチップ・`<details>`のデータ表を
 *     すべて実装している。
 *   - dark: 全チェック PASS（Contrastも全スロット3:1以上）。
 *
 * 【重要】9区分以上を1つの積み上げグラフに載せないこと。dataviz skill の
 * 「9本目の系列に色を新しく作らない」という原則に反するうえ、財務省の公式区分を
 * 独自に再集約して「その他」にまとめる行為は本プロジェクトの中立性方針
 * （公式区分をそのまま使う）にも反する。区分が9個以上ある歳出side
 * （主要経費別・目的別）は、積み上げではなく単色のバーリスト＋
 * スモールマルチプル（区分ごとに独立した推移グラフ）で表示している。
 */
export const BUDGET_CATEGORICAL_COLORS: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
];

/** 積み上げグラフに載せられる最大系列数（配色スロット数） */
export const BUDGET_MAX_STACKED_SERIES = BUDGET_CATEGORICAL_COLORS.length;
