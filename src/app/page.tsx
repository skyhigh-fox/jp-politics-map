import Link from "next/link";
import { getBills, getLegislators, getNationalBudget } from "@/lib/data";
import { formatYenCompact } from "@/lib/formatFinance";
import { getNews } from "@/lib/news";

/**
 * トップページ。2026-08-11、ユーザーフィードバック（「TOPページが何を出したいのか
 * 分かりにくい」）を受けて全面再設計した。3サブエージェント2ラウンド議論の結論
 * （詳細はObsidian決定事項ログ・Claude永続メモリ`homepage-redesign-plan`参照）に
 * 従い、以下の方針で構成する:
 *
 * - トップページの役割を「①何のサイトか一目で伝える」「②主要な入口を示す」の
 *   2点に絞る。ダッシュボード的な詳細データ（議席配置図・議席推移・法案審議状況・
 *   政党別構成・ニュース一覧）は置かない（それぞれの詳細ページ、または
 *   /legislatorsの折りたたみセクションへ移設・統合済み）
 * - h2見出しは使わない（見出しが並列されて優先順位が見えなくなる問題を避けるため）
 * - 「実データで公開しています」という手段の説明から、「格付けをしない」という
 *   差別化ポイントを含む価値提案へタグラインを変更した
 */

const LINKS_META = {
  bills: {
    href: "/bills",
    title: "法案一覧",
  },
  legislators: {
    href: "/legislators",
    title: "議員一覧",
    description: "衆参両院議員のプロフィール・選挙結果・政党別議席構成を検索",
  },
  map: {
    href: "/map",
    title: "都道府県マップ",
    description: "都道府県・市区町村の関連議員数と地方財政データを地図から辿る",
  },
  budget: {
    href: "/budget",
    title: "国の予算・決算",
    description: "国の税収・歳入・歳出の内訳と年度推移を財務省の公式区分のまま確認",
  },
} as const;

export default async function HomePage() {
  const [bills, legislators, news, nationalBudget] = await Promise.all([
    getBills(),
    getLegislators(),
    getNews(),
    getNationalBudget(),
  ]);

  const currentLegislatorCount = legislators.filter(
    (l) => l.termStatus === "現職"
  ).length;

  const latestNews = [...news].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  )[0];

  const latestBudgetYear =
    nationalBudget?.expenditureByMajorExpense.years.at(-1) ?? null;
  const budgetYearCount = nationalBudget
    ? Math.max(
        nationalBudget.taxRevenue.years.length,
        nationalBudget.revenueByMajorItem.years.length,
        nationalBudget.expenditureByMajorExpense.years.length,
        nationalBudget.expenditureByPurpose.years.length
      )
    : 0;

  const lastUpdated = bills
    .map((b) => b.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1);

  const cards = [
    {
      ...LINKS_META.bills,
      description:
        bills.length > 0
          ? `全${bills.length.toLocaleString()}件の法案の審議状況・進捗を検索`
          : "国会に提出された法案の審議状況・進捗を検索",
    },
    {
      ...LINKS_META.legislators,
      description:
        currentLegislatorCount > 0
          ? `現職${currentLegislatorCount.toLocaleString()}名の議員プロフィール・選挙結果・政党別議席構成を検索`
          : LINKS_META.legislators.description,
    },
    LINKS_META.map,
    {
      ...LINKS_META.budget,
      description: latestBudgetYear
        ? `${latestBudgetYear.eraLabel}の歳出決算${formatYenCompact(latestBudgetYear.totalThousandYen ?? 0)}の内訳と、最長${budgetYearCount}年度分の推移を見る`
        : LINKS_META.budget.description,
    },
    {
      href: "/news",
      title: "最新ニュース",
      description: latestNews
        ? `最新: ${latestNews.title}（${latestNews.publishedAt.slice(5, 10).replace("-", "/")}）`
        : "総務省の新着情報から政治関連の見出しをチェック",
    },
  ];

  return (
    <div className="animate-fade-in">
      <span className="inline-flex items-center rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-600/20 dark:bg-accent-950/60 dark:text-accent-300 dark:ring-accent-400/30">
        国会データ公開中
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
        日本政治マップ
      </h1>
      <p className="mt-4 max-w-2xl text-lg font-semibold leading-relaxed text-neutral-900 dark:text-neutral-50">
        国会の“いま”を、格付けなしの一次データで。
      </p>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
        法案の審議状況・議員の活動・都道府県の地方財政データを、気になる切り口から確かめられます。議員や政党の評価・ランキングは行いません。
      </p>

      {/* 導線カードは5枚（法案・議員・都道府県マップ・国の予算決算・ニュース）。
          4列だと最終行が1枚だけ取り残されるため、3列＋2枚の並びにしている */}
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((link) => (
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

      {(bills.length > 0 || currentLegislatorCount > 0) && (
        <p className="mt-6 text-xs text-neutral-400 dark:text-neutral-600">
          法案{bills.length.toLocaleString()}件・議員{currentLegislatorCount.toLocaleString()}名のデータを日次自動更新
          {lastUpdated && `（最終更新: ${lastUpdated}）`}
        </p>
      )}
    </div>
  );
}
