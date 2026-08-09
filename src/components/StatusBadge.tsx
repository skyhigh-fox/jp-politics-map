import type { BillStatus } from "@/types";

/**
 * 法案の審議状況を色分けして示すバッジ。
 * 中立性配慮のため「良し悪し」ではなく「進行段階」を示す配色とする
 * （成立=完了/緑、否決・廃案=終了/グレー、審議中=進行中/青、継続審議=保留/黄）。
 */
const STATUS_STYLES: Record<BillStatus, string> = {
  審議中:
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/30",
  可決:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/30",
  成立:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/30",
  継続審議:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/30",
  否決:
    "bg-neutral-100 text-neutral-600 ring-neutral-500/20 dark:bg-neutral-800/60 dark:text-neutral-300 dark:ring-neutral-400/20",
  廃案:
    "bg-neutral-100 text-neutral-600 ring-neutral-500/20 dark:bg-neutral-800/60 dark:text-neutral-300 dark:ring-neutral-400/20",
};

export function StatusBadge({ status }: { status: BillStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
