import Link from "next/link";
import {
  getBillSponsorships,
  getBills,
  getElectionResults,
  getLegislators,
  getNdlSpeechCounts,
  getPartySeatHistory,
  getPrefectureFinance,
  getRollCallVotes,
  getWrittenQuestionCounts,
} from "@/lib/data";
import { getLocalAssemblyMembers } from "@/lib/localAssembly";
import { getNews } from "@/lib/news";
import {
  DATASET_META,
  DATASET_ORDER,
  type DatasetId,
  type DatasetProvenance,
  buildBillCoverage,
  buildBillSponsorshipCoverage,
  buildElectionResultCoverage,
  buildLegislatorCoverage,
  buildLocalAssemblyCoverage,
  buildNdlSpeechCoverage,
  buildNewsCoverage,
  buildPartySeatHistoryCoverage,
  buildPrefectureFinanceCoverage,
  buildRollCallVoteCoverage,
  buildWrittenQuestionCoverage,
  datasetAnchor,
} from "@/lib/dataProvenance";

export const metadata = {
  title: "免責事項・出典 | 日本政治マップ",
};

interface CreditItem {
  name: string;
  url: string;
  note?: string;
}

/**
 * データセット単位で整理しきれないクレジット（地図の境界データ、
 * ライセンス表記の義務があるもの等）。データセットごとの出典は
 * src/lib/dataProvenance.ts の DATASET_META に一元化しており、
 * ここには重複して書かない。
 */
const OTHER_CREDITS: { category: string; items: CreditItem[] }[] = [
  {
    category: "地図・境界データ",
    items: [
      {
        name: "スマートニュース メディア研究所「日本の行政区画境界データ」",
        url: "https://github.com/smartnews-smri",
        note: "MITライセンス",
      },
      {
        name: "国土交通省「国土数値情報」（市区町村境界データ）",
        url: "https://nlftp.mlit.go.jp/ksj/",
      },
    ],
  },
  {
    category: "ライセンス表記",
    items: [
      {
        name: "Wikipedia（政党別議席数の推移）",
        url: "https://ja.wikipedia.org/",
        note: "CC BY-SA 4.0",
      },
    ],
  },
];

/**
 * 各データセットの「出典・対象時点・収録範囲」を、実データから算出して集める。
 *
 * 件数・カバレッジ率はハードコードせず、必ずここで実データから計算する
 * （データが増減しても表示が自動的に正しくなるようにするため）。
 * 算出ロジックは src/lib/dataProvenance.ts 側の純関数にまとめてあり、
 * 同じ関数を個別ページの DataCoverageNote からも使う。
 */
async function loadDataProvenance(): Promise<DatasetProvenance[]> {
  const [
    legislators,
    bills,
    billSponsorships,
    rollCallVotes,
    ndlSpeechCounts,
    writtenQuestions,
    electionResults,
    partySeatHistory,
    localAssemblyMembers,
    prefectureFinance,
    news,
  ] = await Promise.all([
    getLegislators(),
    getBills(),
    getBillSponsorships(),
    getRollCallVotes(),
    getNdlSpeechCounts(),
    getWrittenQuestionCounts(),
    getElectionResults(),
    getPartySeatHistory(),
    getLocalAssemblyMembers(),
    getPrefectureFinance(),
    getNews(),
  ]);

  const coverages: Record<DatasetId, ReturnType<typeof buildLegislatorCoverage>> = {
    legislators: buildLegislatorCoverage(legislators),
    bills: buildBillCoverage(bills),
    "bill-sponsorships": buildBillSponsorshipCoverage(billSponsorships),
    "roll-call-votes": buildRollCallVoteCoverage(rollCallVotes),
    "ndl-speech-counts": buildNdlSpeechCoverage(ndlSpeechCounts, legislators.length),
    "written-questions": buildWrittenQuestionCoverage(
      writtenQuestions,
      legislators.length
    ),
    "election-results": buildElectionResultCoverage(
      electionResults,
      legislators.length
    ),
    "party-seat-history": buildPartySeatHistoryCoverage(partySeatHistory),
    "local-assembly-members": buildLocalAssemblyCoverage(localAssemblyMembers),
    "prefecture-finance": buildPrefectureFinanceCoverage(prefectureFinance),
    news: buildNewsCoverage(news),
  };

  return DATASET_ORDER.map((id) => ({ ...DATASET_META[id], ...coverages[id] }));
}

export default async function DisclaimerPage() {
  const provenance = await loadDataProvenance();
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
          <p>
            また、すべてのデータをすべての議員・法案について収録できているわけではありません。データセットごとに、どの範囲まで収録できているかを
            <Link
              href="#data-coverage"
              className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              「データの出典と収録範囲」
            </Link>
            に記載しています。
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
        <h2
          id="data-coverage"
          className="scroll-mt-24 text-lg font-bold text-neutral-900 dark:text-neutral-50"
        >
          データの出典と収録範囲
        </h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            データセットごとの情報源・対象時点・収録できている範囲は以下のとおりです。件数とカバー率は、実際に掲載しているデータから毎回のビルド時に集計しており、手入力していません。
          </p>
          <p>
            すべての情報を網羅できているわけではないため、「収録していない範囲」も同じ場所に記載しています。ある議員・法案について本サイトに記載がないことは、そうした事実がなかったことを意味しません。
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {provenance.map((dataset) => (
            <div
              key={dataset.id}
              id={datasetAnchor(dataset.id)}
              className="scroll-mt-24 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {dataset.label}
                </h3>
                {dataset.asOf && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    {dataset.asOf.label}: {dataset.asOf.value}
                  </p>
                )}
              </div>

              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                {dataset.facts.map((fact, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span
                      aria-hidden
                      className="text-neutral-400 dark:text-neutral-600"
                    >
                      ・
                    </span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                {dataset.scope}
              </p>

              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {dataset.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                  >
                    {source.name}
                  </a>
                ))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          その他の出典・クレジット
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          上記のデータセットに含まれない、地図の描画等に使用しているデータです。
        </p>
        <div className="mt-4 space-y-6">
          {OTHER_CREDITS.map((group) => (
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
