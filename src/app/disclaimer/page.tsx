import Link from "next/link";

export const metadata = {
  title: "免責事項・出典 | 日本政治マップ",
};

interface CreditItem {
  name: string;
  url: string;
  note?: string;
}

const CREDITS: { category: string; items: CreditItem[] }[] = [
  {
    category: "議員・法案・選挙",
    items: [
      {
        name: "スマートニュース メディア研究所「国会議案データベース（衆議院・参議院）」「日本の行政区画境界データ」",
        url: "https://github.com/smartnews-smri",
        note: "MITライセンス",
      },
      {
        name: "衆議院・参議院 公式サイト",
        url: "https://www.shugiin.go.jp/",
      },
      {
        name: "総務省「選挙関連資料」",
        url: "https://www.soumu.go.jp/senkyo/senkyo_s/data/",
      },
      {
        name: "国立国会図書館「国会会議録検索システム」検索用API",
        url: "https://kokkai.ndl.go.jp/api.html",
        note: "発言回数は氏名の部分一致による参考値",
      },
      {
        name: "Wikipedia（政党別議席推移）",
        url: "https://ja.wikipedia.org/",
        note: "CC BY-SA 4.0",
      },
      {
        name: "国土交通省「国土数値情報」（市区町村境界データ）",
        url: "https://nlftp.mlit.go.jp/ksj/",
      },
    ],
  },
  {
    category: "予算・財政",
    items: [
      {
        name: "総務省「地方財政状況調査」（e-Stat経由）",
        url: "https://www.e-stat.go.jp/",
      },
      {
        name: "総務省「主要財政指標一覧」",
        url: "https://www.soumu.go.jp/",
      },
      {
        name: "総務省統計局「人口推計」",
        url: "https://www.stat.go.jp/",
      },
    ],
  },
  {
    category: "ニュース",
    items: [
      {
        name: "総務省「ホームページ新着情報」RSS",
        url: "https://www.soumu.go.jp/menu_kyotsuu/rss_information.html",
        note: "見出し・リンクのみ、本文・画像は転載なし",
      },
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <div className="max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        免責事項・出典
      </h1>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          このサイトの方針
        </h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            「日本政治マップ」は、国会議員・法案の審議状況・選挙結果・予算などの公開情報を、地図やグラフを使って分かりやすく閲覧できるようにすることを目的とした個人運営のサイトです。
          </p>
          <p>
            特定の政党・候補者・政策を支持または批判するものではありません。政党の識別色は各党の公式カラーをそのまま使用し、法案の審議状況や議員の活動量（発言回数・質問主意書提出数等）は、独自の評価・格付け・ランキングを加えず、公的な一次情報源に基づく客観的な事実の集計として提示しています。
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          情報の正確性について
        </h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            掲載しているデータは、各ページに記載の公的機関・オープンデータ等の情報源から自動的に取得・集計しています。取得元の情報自体の誤り、更新のタイミングのずれ、自動処理（氏名の突合・分類等）に伴う不正確さが含まれる可能性があり、内容の正確性・完全性・最新性は保証できません。
          </p>
          <p>
            重要な判断（投票行動を含む）を行う際は、必ず各データの出典元（衆参議院公式サイト、総務省、国立国会図書館等）で一次情報をご確認ください。
          </p>
          <p>
            国会会議録検索システムAPIによる発言回数のように、氏名の部分一致検索に基づく参考値は、同姓同名の別人の発言が混在する可能性があります。各ページの注記もあわせてご確認ください。
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          訂正のご連絡について
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          内容の誤りにお気づきの場合にご連絡いただく窓口は、現在準備中です。
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          データの出典
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          各ページの個別データにも出典リンクを掲載していますが、主なデータ提供元は以下のとおりです。
        </p>
        <div className="mt-4 space-y-6">
          {CREDITS.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {group.category}
              </h3>
              <ul className="mt-2 space-y-2">
                {group.items.map((item) => (
                  <li key={item.name} className="text-sm">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                    >
                      {item.name}
                    </a>
                    {item.note && (
                      <span className="ml-1.5 text-xs text-neutral-500 dark:text-neutral-500">
                        （{item.note}）
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm">
        <Link
          href="/"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← トップに戻る
        </Link>
      </p>
    </div>
  );
}
