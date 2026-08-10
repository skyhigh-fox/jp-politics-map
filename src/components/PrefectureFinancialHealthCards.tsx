import {
  FINANCIAL_HEALTH_INDICATORS,
  formatFinancialHealthValue,
} from "@/lib/financialHealthStats";
import type { PrefectureFinancialHealth } from "@/types";

/**
 * 都道府県詳細ページ用「財政健全化指標」カード（4指標）。
 * 法定の公式基準値がある指標（実質公債費比率・将来負担比率）は、
 * 数値の直後に基準値を併記する（「危ない」等の評価語は使わず、
 * 客観的な基準値のみを添える）。
 */
export function PrefectureFinancialHealthCards({
  data,
}: {
  data: PrefectureFinancialHealth;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        財政健全化指標
      </h3>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
        {data.fiscalYear}年度決算。総務省「主要財政指標一覧」。数値の高低を評価するものではありません。
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {FINANCIAL_HEALTH_INDICATORS.map((indicator) => {
          const value = data[indicator.key];
          return (
            <div key={indicator.key}>
              <div className="text-xs text-neutral-500 dark:text-neutral-500">
                {indicator.label}
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {value !== null ? formatFinancialHealthValue(value, indicator) : "―"}
              </div>
              {indicator.standardNote && (
                <div className="mt-0.5 text-[11px] leading-snug text-neutral-400 dark:text-neutral-600">
                  基準値: {indicator.standardNote}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
