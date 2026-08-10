import Link from "next/link";

/**
 * サイト共通フッター。免責事項・出典ページへの導線を常設する
 * （一般公開に向けた準備の一環、2026-08-11追加）。
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 py-6 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-neutral-500 dark:text-neutral-500">
        <p>
          本サイトは特定の政党・候補者を支持または批判するものではありません。
        </p>
        <Link
          href="/disclaimer"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          免責事項・出典
        </Link>
      </div>
    </footer>
  );
}
