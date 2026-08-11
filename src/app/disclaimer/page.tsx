import Link from "next/link";
import {
  getBillSponsorships,
  getBills,
  getElectionResults,
  getLegislators,
  getLocalAssemblyPartyComposition,
  getNdlSpeechCounts,
  getPartySeatHistory,
  getPrefectureExecutives,
  getPrefectureFinance,
  getPrefectureTurnout,
  getRollCallVotes,
  getShugiinDistricts,
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
  buildDistrictBoundaryCoverage,
  buildElectionResultCoverage,
  buildLegislatorCoverage,
  buildLocalAssemblyCoverage,
  buildLocalPartyCompositionCoverage,
  buildNdlSpeechCoverage,
  buildNewsCoverage,
  buildPartySeatHistoryCoverage,
  buildPrefectureExecutiveCoverage,
  buildPrefectureFinanceCoverage,
  buildPrefectureTurnoutCoverage,
  buildRollCallVoteCoverage,
  buildWrittenQuestionCoverage,
  datasetAnchor,
} from "@/lib/dataProvenance";
import { buildPageMetadata } from "@/lib/siteMetadata";

export const metadata = buildPageMetadata({
  title: "免責事項・出典",
  description:
    "本サイトが表示しているデータの出典・収録範囲・更新頻度と、利用にあたっての免責事項をまとめています。",
  path: "/disclaimer",
});

interface CreditItem {
  name: string;
  url: string;
  note?: string;
}

interface NotBuiltItem {
  /** 作っていない機能・表現 */
  title: string;
  /** なぜ作らないのか。断定的・否定的な決めつけを避けた説明にする */
  reason: string;
}

/**
 * 「意図的に作っていないもの」の一覧
 * （機能拡充ロードマップ Tier1 #10「作らないものリスト」の明文化）。
 *
 * これまでコード中のコメント（src/lib/rollCallVoteStats.ts、src/app/budget/page.tsx、
 * src/lib/districts.ts、src/components/DataInsight.tsx 等の「中立性の方針」注記）と
 * Obsidian側の決定事項ログにしか書かれていなかった編集方針を、閲覧者から見える形に
 * したもの。新しい機能を追加する際にここへ抵触しないかを確認する基準でもあるため、
 * 実装側の方針を変えるときは必ずこの一覧も合わせて更新すること。
 */
const NOT_BUILT: { category: string; items: NotBuiltItem[] }[] = [
  {
    category: "議員・政党の評価に関するもの",
    items: [
      {
        title: "議員・政党の評価スコア、ランキング、格付け",
        reason:
          "数値の多寡は、それ自体が説明を伴わないまま「優秀／怠慢」といった道徳的な評価として読まれやすいためです。発言回数や質問主意書の提出件数のような活動量は、公的な一次情報からの集計値としてそのまま掲載し、順位付けや星の数への変換は行っていません。",
      },
      {
        title: "賛成率・出席率・造反回数などの派生指標",
        reason:
          "議員の姿勢を一つの数値へ要約すると、その計算式の選び方自体が評価になるためです。また、衆議院本会議の採決は起立採決が中心で議員個人の賛否や出欠の記録が原則として公開されておらず、こうした比率を正確に算出すること自体が原理的にできません。参議院の記名投票についても、欠席・棄権には委員会等の公務・病気・出産・会派の方針など多様な事情があり、記録からその理由を判別することはできません。そのため賛否・欠席・棄権は、原データの区分のまま個別の記録として表示しています。",
      },
      {
        title: "政党マッチング診断・投票ナビゲーター",
        reason:
          "どの争点をどう質問文にするか、各政党の立場をどの選択肢に当てはめるかという判断が不可欠で、その判断は公開情報の転記では決められないためです。",
      },
      {
        title: "議員間の共同提案ネットワーク図、イデオロギースコア",
        reason:
          "議員を保守・リベラルのような一次元の座標に位置づける行為そのものが評価にあたるためです。法案の提出者・賛成会派は、原資料に記載された事実の転記に留めています。また、法案への提出者としての参加は必ずしも各条項への賛意を意味せず、関係の強さを表す指標としては扱えません。",
      },
      {
        title: "外部の団体による議員の評価・格付け結果の掲載",
        reason:
          "評価の基準を設けているのが本サイトでなくても、それを地図やグラフの形で見せれば、本サイトがその基準を選んだことになるためです。掲載するのは、算出方法を本サイト側で説明できる一次データの集計に限っています。",
      },
      {
        title: "政治資金収支報告書の金額の可視化・比較",
        reason:
          "金額の大小がそのまま評価として読まれやすいことに加え、原資料が画像を含むPDFで公開されており、自動的な読み取りには誤りが混入します。人物のお金に関する誤った数値は、訂正しても影響が残りやすいと考えているためです。",
      },
    ],
  },
  {
    category: "予算・財政データに関するもの",
    items: [
      {
        title: "税目と経費を結びつけるフロー図（サンキー図）",
        reason:
          "一般会計はノンアフェクタシオン（特定の歳入を特定の歳出に紐づけない）の原則で運用されており、「この税金がこの費目に使われた」という対応関係は制度上存在しないためです。図にすると分かりやすくなる一方、事実として誤りになります。法律に定めのある例外（消費税法第1条第2項、地方交付税法第6条など）だけを、根拠条文を添えた注記として示しています。",
      },
      {
        title: "「年収を入力するとあなたの税金の使い道が分かる」型の計算",
        reason:
          "個人の負担額を推計するには、控除や社会保険料の扱いについて多くの前提を置く必要があり、その前提の置き方自体が編集判断になるためです。人口で割った一人当たり額のように、公表値から機械的に計算できるものに留めています。",
      },
      {
        title: "税収と歳出の乖離を強調する表現（いわゆる「ワニの口」）",
        reason:
          "同じ数値でも、どの年を起点に切り取るかで見え方が大きく変わる表現だからです。公債金は歳入の一科目として、他の科目と同じ扱い・同じ配色で表示しています。",
      },
      {
        title: "「無駄」「削減余地」「危ない」といった評価語、独自の区分",
        reason:
          "金額や指標の水準を言葉で言い換えた時点で、その水準への判断が加わるためです。区分は財務省・総務省の公式分類の表記をそのまま使い、財政健全化指標には法律で定められた基準値を併記する形にしています。",
      },
    ],
  },
  {
    category: "見せ方・並び順に関するもの",
    items: [
      {
        title: "値の大きい順に並べた一覧・ランキング表",
        reason:
          "並び順は、順位という意味を持たない場合でも順位として読まれるためです。一覧の並びは日付順・都道府県コード順・議席数順など、原資料と同じか評価的な意味を持たない基準に固定しています。",
      },
      {
        title: "「注目の投票」「重要な法案」といったピックアップ",
        reason:
          "何を注目に値するとみなすかの選定が編集行為になるためです。一覧は絞り込み条件を利用者が選ぶ形にしています。",
      },
      {
        title: "得票率による選挙区の塗り分け、面積を変形した地図（カルトグラム）",
        reason:
          "地図の色や形の強さが、そのまま勢力の印象として伝わるためです。選挙区は既定では塗り分けず、政党別の表示は利用者が明示的に切り替えたときだけ適用しています。",
      },
      {
        title: "AIによる解説文の自動生成",
        reason:
          "生成された文章には、元データにない解釈や評価が混入しうるためです。「このデータからわかること」欄の文言は、表示中の数値から決まった書式で機械的に組み立てており、背景や原因の説明には踏み込んでいません。",
      },
    ],
  },
];

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
    localPartyComposition,
    prefectureExecutives,
    prefectureFinance,
    prefectureTurnout,
    shugiinDistricts,
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
    getLocalAssemblyPartyComposition(),
    getPrefectureExecutives(),
    getPrefectureFinance(),
    getPrefectureTurnout(),
    getShugiinDistricts(),
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
    "prefecture-turnout": buildPrefectureTurnoutCoverage(prefectureTurnout),
    "party-seat-history": buildPartySeatHistoryCoverage(partySeatHistory),
    "local-assembly-members": buildLocalAssemblyCoverage(localAssemblyMembers),
    "local-assembly-party-composition":
      buildLocalPartyCompositionCoverage(localPartyComposition),
    "prefecture-executives": buildPrefectureExecutiveCoverage(prefectureExecutives),
    "prefecture-finance": buildPrefectureFinanceCoverage(prefectureFinance),
    "district-boundaries": buildDistrictBoundaryCoverage(
      shugiinDistricts.map((d) => d.kuname),
      legislators
    ),
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
          <p>
            本サイトの実装には、Claude Code（Anthropic社のAIコーディングエージェント）を活用しています。ただし、これは開発作業の効率化のための利用であり、サイト上に表示される文章はあらかじめ人が設計した決定的なロジックに基づくもので、閲覧のたびにAIが解説文や評価コメントをその場で自動生成する機能は持ちません。
          </p>
          <p>
            この方針は、何を掲載するかと同じくらい、何を作らないかによって形になっています。技術的には作れるものの、意図的に実装していない機能や表現を
            <Link
              href="#not-built"
              className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              「このサイトが意図的に作っていないもの」
            </Link>
            にまとめています。
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          関連プロジェクト
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          日本の在留外国人（人口動態・生活実態・多文化共生施策・犯罪統計）を地図やグラフで可視化する姉妹プロジェクト「多文化共生マップ」を、同じ開発者が
          <a
            href="https://jp-multicultural-map.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="mx-1 text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            https://jp-multicultural-map.vercel.app
          </a>
          で公開しています。テーマは政治情報と近接していますが、本サイトとはコードを共有していない独立したプロジェクトです。ソースコードは
          <a
            href="https://github.com/skyhigh-fox/jp-multicultural-map"
            target="_blank"
            rel="noreferrer"
            className="mx-1 text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            GitHub
          </a>
          で公開しています。
        </p>
      </section>

      <section className="mt-8">
        <h2
          id="not-built"
          className="scroll-mt-24 text-lg font-bold text-neutral-900 dark:text-neutral-50"
        >
          このサイトが意図的に作っていないもの
        </h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            公開情報を集めていると、そこから何らかのスコアや順位を作りたくなる場面が繰り返し訪れます。しかし、集計の仕方を一つ選ぶことは、何を良しとするかを一つ選ぶことでもあります。本サイトは、そうした判断を運営者が行わずに済む範囲に表現を限ることで中立性を保とうとしており、以下は技術的には実装できるものの、意図的に作っていないものです。
          </p>
          <p>
            いずれも「そうした見方に意味がない」という趣旨ではありません。運営者一人の判断で基準を決めてしまうと、その基準の妥当性を閲覧者が検証できないため、本サイトでは扱わないという整理です。
          </p>
        </div>

        <div className="mt-4 space-y-6">
          {NOT_BUILT.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {group.category}
              </h3>
              <ul className="mt-2 space-y-3">
                {group.items.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {item.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            この整理は、英国の議会情報サイト
            <a
              href="https://www.theyworkforyou.com/voting-information/"
              target="_blank"
              rel="noreferrer"
              className="mx-1 text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              TheyWorkForYou
            </a>
            が2024年に公表した方針転換を参考にしています。同サイトは議員ごとの投票傾向をまとめた要約を長年提供していましたが、欠席を反対寄りの態度として数えていたため、産休・病気療養などで議場にいなかった議員が消極的だったかのように示される問題が生じました。同サイトはこれを受けて欠席を集計対象から外し、投票の重み付けをやめて計算式を簡素化しています。
          </p>
          <p>
            同サイトはその後、自らを中立とは位置づけないと明言する立場を取りました。本サイトは中立を保つ方針を続けるため、同じ問題を編集方針の調整ではなく「その指標を作らない」ことで避ける設計にしています。
          </p>
          <p>
            なお、この一覧は今後も追加・見直しがありえます。ここに挙げていない機能であっても、同じ考え方に照らして扱わないと判断することがあります。
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
          内容の誤りにお気づきの場合は、GitHub Issuesにてご連絡ください。既存の同種の報告がないかご確認のうえ、対象のページ・議員名や法案名・誤りの内容を具体的にお書きいただけると対応しやすくなります。
        </p>
        <p className="mt-2 text-sm">
          <a
            href="https://github.com/skyhigh-fox/jp-politics-map/issues"
            target="_blank"
            rel="noreferrer"
            className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            GitHub Issuesで報告する →
          </a>
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
          <p>
            これらのデータのうち、原典のライセンス・利用規約で再配布が認められているものは、機械可読なJSONのまま
            <Link
              href="/data"
              className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              「データの入手」
            </Link>
            で配布しています。配布していないデータとその理由も同じページに記載しています。
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
