"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 400;

/**
 * 一定量スクロールすると現れる「トップへ戻る」ボタン。
 * 法案一覧の無限スクロール等、下までスクロールすると戻るのが大変なページ向けに
 * レイアウト共通で表示する。
 */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="ページの先頭へ戻る"
      className="fixed bottom-20 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 shadow-md transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-accent-700 dark:hover:bg-neutral-800 dark:hover:text-accent-400"
    >
      ↑
    </button>
  );
}
