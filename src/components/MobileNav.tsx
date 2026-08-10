"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NewsItem } from "@/lib/news";
import { NewsPreviewList } from "@/components/NewsMenu";

interface NavLink {
  href: string;
  label: string;
}

/**
 * モバイル幅（`sm:`未満、目安390px前後）専用のハンバーガーメニュー。
 * デスクトップの横並びナビ＋NewsMenuドロップダウンの代わりに、
 * ヘッダー右端のボタンで開閉する縦積みのメニューパネルを表示する。
 *
 * ニュース欄はNewsMenuのような絶対配置ドロップダウンではなく、
 * パネル内のディスクロージャー（アコーディオン）として文書フローの中に
 * インライン展開する。ハンバーガーメニューのパネルとニュースのドロップダウンが
 * それぞれ独立した絶対配置要素として重なり、見た目が崩れる問題を避けるため。
 */
export function MobileNav({
  navLinks,
  news,
}: {
  navLinks: readonly NavLink[];
  news: NewsItem[];
}) {
  const [open, setOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const closeMenu = () => {
    setOpen(false);
    setNewsOpen(false);
  };

  // Escapeキーで閉じ、トグルボタンにフォーカスを戻す。
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        toggleButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // パネル外クリックで閉じる（NewsMenu単体のドロップダウンと同じ挙動）。
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [open]);

  // 開いたらパネル内の最初のリンクへフォーカスを移す。
  useEffect(() => {
    if (open) {
      firstLinkRef.current?.focus();
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        ref={toggleButtonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-accent-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-accent-400"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M18 6l-12 12" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 shadow-card-hover dark:border-neutral-800 dark:bg-neutral-900"
        >
          <ul className="flex flex-col gap-1">
            {navLinks.map((link, i) => (
              <li key={link.href}>
                <Link
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={link.href}
                  onClick={closeMenu}
                  className="block rounded-md px-2 py-2 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-accent-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-accent-400"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setNewsOpen((v) => !v)}
              aria-expanded={newsOpen}
              className="flex w-full items-center justify-between rounded-md px-2 py-2 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-accent-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-accent-400"
            >
              ニュース
              <svg
                className={`h-4 w-4 transition-transform ${newsOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {newsOpen && (
              <div className="px-2 pb-1 pt-2">
                <NewsPreviewList items={news} onNavigate={closeMenu} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
