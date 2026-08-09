import Link from "next/link";

const LINKS = [
  {
    href: "/bills",
    title: "法案一覧",
    description: "国会に提出された法案の審議状況・進捗タイムラインを確認",
  },
  {
    href: "/legislators",
    title: "議員一覧",
    description: "衆参両院の議員プロフィールと選挙結果を検索",
  },
  {
    href: "/map",
    title: "都道府県マップ",
    description: "都道府県・市区町村単位で関連議員数を地図から辿る",
  },
] as const;

export default function HomePage() {
  return (
    <div className="max-w-3xl animate-fade-in">
      <span className="inline-flex items-center rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-600/20 dark:bg-accent-950/60 dark:text-accent-300 dark:ring-accent-400/30">
        開発中 &middot; フェーズ1
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
        日本政治マップ
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
        フェーズ1: 国会議員・法案審議進捗のデータ基盤を構築中です。
        地図UI（都道府県ドリルダウン）はフェーズ2で追加予定。
      </p>

      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group block h-full rounded-xl border border-neutral-200 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-card-hover dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-700"
            >
              <div className="font-semibold text-neutral-900 group-hover:text-accent-600 dark:text-neutral-100 dark:group-hover:text-accent-400">
                {link.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {link.description}
              </p>
              <span className="mt-3 inline-flex items-center text-sm font-medium text-accent-600 dark:text-accent-400">
                見る
                <span
                  aria-hidden
                  className="ml-1 transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
