import Link from "next/link";
import { getBills, getLegislators, getParties } from "@/lib/data";
import { getNews } from "@/lib/news";
import { BillStatusSummary } from "@/components/BillStatusSummary";
import { PartyCompositionSummary } from "@/components/PartyCompositionSummary";
import { SemicircleSeatChart } from "@/components/SemicircleSeatChart";
import { NewsPreview } from "@/components/NewsPreview";

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
    description: "都道府県・市区町村単位で関連議員数を地図から辿る（ズーム・パン対応）",
  },
] as const;

export default async function HomePage() {
  const [bills, legislators, parties, news] = await Promise.all([
    getBills(),
    getLegislators(),
    getParties(),
    getNews(),
  ]);

  return (
    <div className="animate-fade-in">
      <span className="inline-flex items-center rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-600/20 dark:bg-accent-950/60 dark:text-accent-300 dark:ring-accent-400/30">
        国会データ公開中
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
        日本政治マップ
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
        国会議員・法案の審議状況を実データで公開しています。都道府県ドリルダウン地図（ズーム・パン対応）、法案検索、議員検索、最新の政治ニュースも合わせて確認できます。
      </p>

      <h2 className="mt-10 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        サマリー
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
          <SemicircleSeatChart chamber="衆議院" legislators={legislators} parties={parties} />
          <SemicircleSeatChart chamber="参議院" legislators={legislators} parties={parties} />
        </div>
        <BillStatusSummary bills={bills} />
        <PartyCompositionSummary legislators={legislators} parties={parties} />
        <div className="lg:col-span-2">
          <NewsPreview items={news} />
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        詳細ページ
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
