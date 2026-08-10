import Link from "next/link";
import type { Bill, BillStatus } from "@/types";

/**
 * トップページ用「法案の審議状況」サマリー。
 *
 * 配色はStatusBadge.tsxと同じ思想（進行段階の表現であり、良し悪しの評価では
 * ない）を踏襲する: 審議中=sky（進行中）、継続審議=amber（保留）、
 * 可決/成立=emerald（完了に向けて前進）、否決/廃案=neutral（終了）。
 * StatusBadgeはバッジの薄い背景色（-50/-950）だが、こちらは面積の大きい
 * 塗りつぶしバーのため、ライト/ダーク共にWCAGコントラスト3:1以上を確保できる
 * -600/-500系の彩度で別途定義している（dataviz skillのcontrastチェック済み）。
 */
const STATUS_ORDER: BillStatus[] = [
  "審議中",
  "継続審議",
  "可決",
  "成立",
  "廃案",
  "否決",
];

const STATUS_FILL: Record<BillStatus, string> = {
  審議中: "bg-sky-600 dark:bg-sky-500",
  継続審議: "bg-amber-600 dark:bg-amber-500",
  可決: "bg-emerald-600 dark:bg-emerald-500",
  成立: "bg-emerald-600 dark:bg-emerald-500",
  廃案: "bg-neutral-500 dark:bg-neutral-400",
  否決: "bg-neutral-500 dark:bg-neutral-400",
};

export function BillStatusSummary({ bills }: { bills: Bill[] }) {
  const total = bills.length;
  const counts = new Map<BillStatus, number>();
  for (const bill of bills) {
    counts.set(bill.status, (counts.get(bill.status) ?? 0) + 1);
  }
  const segments = STATUS_ORDER.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  })).filter((s) => s.count > 0);

  return (
    <div className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        法案の審議状況
      </h2>

      {total === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
          データ未取得です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:bills
          </code>
          で取得してください。
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            全{total.toLocaleString()}件・進行段階別
          </p>

          <div
            role="img"
            aria-label={segments
              .map(
                (s) =>
                  `${s.status} ${s.count.toLocaleString()}件（${((s.count / total) * 100).toFixed(1)}%）`
              )
              .join("、")}
            className="mt-4 flex h-6 w-full gap-[2px] overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
          >
            {segments.map((s) => (
              <div
                key={s.status}
                title={`${s.status}: ${s.count.toLocaleString()}件（${((s.count / total) * 100).toFixed(1)}%）`}
                className={`h-full ${STATUS_FILL[s.status]}`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {segments.map((s) => (
              <li
                key={s.status}
                className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
              >
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_FILL[s.status]}`}
                />
                <span>{s.status}</span>
                <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                  {s.count.toLocaleString()}件
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href="/bills"
        className="mt-4 inline-flex items-center text-xs font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
      >
        法案一覧を見る
        <span aria-hidden className="ml-1">
          →
        </span>
      </Link>
    </div>
  );
}
