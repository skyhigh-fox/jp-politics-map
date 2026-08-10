import { formatYenPerCapita } from "@/lib/formatFinance";
import type { PrefectureExpenditureBreakdown as Breakdown } from "@/lib/prefectureExpenditureStats";

/**
 * 都道府県詳細ページ用「歳出の内訳（人口一人当たり）」バーリスト。
 *
 * 分野（教育費・民生費等）はどれも等しく「政策分野の識別子」であり、優劣・
 * 序列を持たないため、13区分すべてに別々の色を割り当てる代わりに単一の
 * アクセントカラーで統一した（多数の categorical 色を無理に見分けさせるより、
 * ラベルと数値そのもので識別させる方針。RollCallVoteHeatmap等でも採用した
 * 「セマンティックな表以外は色に頼りすぎない」考え方を踏襲）。
 * 並び順は総務省の目的別歳出分類の掲載順で固定（金額順ソートはしない）。
 */
export function PrefectureExpenditureBreakdown({
  breakdown,
}: {
  breakdown: Breakdown;
}) {
  const values = breakdown.items
    .map((i) => i.perCapitaYen)
    .filter((v): v is number => v !== null);
  const max = values.length > 0 ? Math.max(...values) : 0;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        歳出の内訳（人口一人当たり）
      </h3>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
        {breakdown.fiscalYear}年度決算。総務省「地方財政状況調査」の目的別歳出を人口一人当たりに換算（並び順は総務省の分類順で固定、金額順ではありません）。
      </p>

      {breakdown.population === null ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
          人口データが取得できていないため、一人当たり換算を表示できません。
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {breakdown.items.map((item) => (
            <li key={item.name} className="flex items-center gap-2 text-xs">
              <span
                className="w-28 shrink-0 truncate text-neutral-600 dark:text-neutral-400"
                title={item.name}
              >
                {item.name}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <span
                  className="block h-full rounded-full bg-accent-500 dark:bg-accent-400"
                  style={{
                    width: `${max > 0 ? ((item.perCapitaYen ?? 0) / max) * 100 : 0}%`,
                  }}
                />
              </span>
              <span className="w-24 shrink-0 text-right tabular-nums text-neutral-500 dark:text-neutral-500">
                {item.perCapitaYen !== null ? formatYenPerCapita(item.perCapitaYen) : "―"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
