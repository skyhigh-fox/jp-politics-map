import {
  FINANCIAL_HEALTH_STANDARDS,
  type PrefectureFinancialHealth,
} from "@/types";

/**
 * 財政健全化指標（Phase B）の表示用ヘルパー。
 *
 * 中立性の方針: 「高い/低い」を良し悪しで語らず、公式基準値（法定の
 * 早期健全化基準・財政再生基準）がある指標はそれを併記する。基準値の
 * ない指標（財政力指数・経常収支比率）は実測値のみを提示し、独自の
 * 目安・評価は加えない。
 */

export interface FinancialHealthIndicatorMeta {
  key: keyof Pick<
    PrefectureFinancialHealth,
    "financialStrengthIndex" | "currentBalanceRatio" | "realDebtServiceRatio" | "futureBurdenRatio"
  >;
  label: string;
  unit: string;
  /** 公式基準値の説明文（ない指標はundefined） */
  standardNote?: string;
}

export const FINANCIAL_HEALTH_INDICATORS: FinancialHealthIndicatorMeta[] = [
  { key: "financialStrengthIndex", label: "財政力指数", unit: "" },
  { key: "currentBalanceRatio", label: "経常収支比率", unit: "%" },
  {
    key: "realDebtServiceRatio",
    label: "実質公債費比率",
    unit: "%",
    standardNote: `早期健全化基準${FINANCIAL_HEALTH_STANDARDS.realDebtServiceRatio.earlyWarningThreshold}%・財政再生基準${FINANCIAL_HEALTH_STANDARDS.realDebtServiceRatio.reconstructionThreshold}%`,
  },
  {
    key: "futureBurdenRatio",
    label: "将来負担比率",
    unit: "%",
    standardNote: `早期健全化基準${FINANCIAL_HEALTH_STANDARDS.futureBurdenRatio.earlyWarningThreshold}%（財政再生基準の設定なし）`,
  },
];

export function formatFinancialHealthValue(
  value: number,
  indicator: FinancialHealthIndicatorMeta
): string {
  if (indicator.unit === "") {
    return value.toFixed(2);
  }
  return `${value.toFixed(1)}${indicator.unit}`;
}

/** 地図レイヤー用: 指定指標の都道府県別マップを作る（nullは除外） */
export function buildFinancialHealthLayer(
  data: PrefectureFinancialHealth[],
  key: FinancialHealthIndicatorMeta["key"]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of data) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    result[row.prefecture] = value;
  }
  return result;
}
