import { DATASET_META, type DatasetId, type DatasetSource } from "./dataProvenance";

/**
 * 【データダウンロード／公開データ】（機能拡充ロードマップ Tier1 #9）
 *
 * 本サイトが集計に使っているJSONのうち、**原典のライセンス・利用規約で
 * 再配布が明示的に認められているもの**だけを、機械可読な形のまま配布する。
 *
 * 設計方針:
 * - 配布可否は「原典の規約に再配布の許諾があるか」だけで決める。データの
 *   内容や重要度では決めない。判断できないものは配布せず、原典へのリンクに留める。
 * - 配布しないデータについても、その事実と理由を同じページに並べて示す
 *   （何を配っていないかを隠さない）。
 * - 配布URLは `/data/datasets/<ファイル名>` に固定する。実ファイルは
 *   ビルド時に scripts/build-public-datasets.ts が data/ からコピーする
 *   （リポジトリに同じJSONを二重にコミットしないため）。
 *
 * 中立性の方針（重要）:
 * - 「このデータでこう分析できる」「こう解釈すべき」といった誘導・示唆は書かない。
 *   各データセットの説明は「何が入っているか」という事実の記述に限る。
 * - 配布しない理由も、規約の書きぶりについての事実の記述に留め、原典側を
 *   批判する書き方はしない。
 */

/** 公開ダウンロードファイルを置くディレクトリ（public/ からの相対パス） */
export const PUBLIC_DATASET_DIR = "data/datasets";

/** 機械可読な一覧（この機能の「公開API」にあたるエンドポイント） */
export const MANIFEST_PATH = `/${PUBLIC_DATASET_DIR}/manifest.json`;

export interface DatasetLicense {
  /** ライセンス・利用規約の名称 */
  name: string;
  /** 規約本文のURL（実在を確認できたもののみ。確認できない場合は null） */
  url: string | null;
  /**
   * 再配布・二次利用の際に求められる出典表記。
   * ダウンロードした人がそのままコピーして使えるよう、文例の形で持つ。
   */
  attribution: string;
}

const LICENSE_MIT_SMARTNEWS_SHUGIIN: DatasetLicense = {
  name: "MITライセンス",
  url: "https://github.com/smartnews-smri/house-of-representatives/blob/main/LICENSE",
  attribution:
    "スマートニュース メディア研究所「国会議案データベース：衆議院」（原典: 衆議院ウェブサイト）",
};

const LICENSE_SOUMU: DatasetLicense = {
  name: "総務省ウェブサイト利用規約（政府標準利用規約準拠）",
  url: "https://www.soumu.go.jp/menu_kyotsuu/policy/tyosaku.html",
  attribution: "総務省ウェブサイト（https://www.soumu.go.jp/）",
};

const LICENSE_ESTAT: DatasetLicense = {
  name: "e-Stat 利用規約（政府標準利用規約〔第2.0版〕準拠）",
  url: "https://www.e-stat.go.jp/terms-of-use",
  attribution: "政府統計の総合窓口(e-Stat)（https://www.e-stat.go.jp/）",
};

const LICENSE_MOF: DatasetLicense = {
  name: "財務省ウェブサイト利用規約（政府標準利用規約準拠）",
  url: "https://www.mof.go.jp/about_mof/notice/index.html",
  attribution: "財務省ウェブサイト（https://www.mof.go.jp/）",
};

const LICENSE_CC_BY_SA_4: DatasetLicense = {
  name: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/deed.ja",
  attribution:
    "Wikipedia日本語版 各選挙の結果記事（CC BY-SA 4.0）。本データを再配布する場合も同じライセンスで公開する必要があります。",
};

const LICENSE_JAPAN_TOPOGRAPHY: DatasetLicense = {
  name: "商用・非商用を問わず無償利用可（国土交通省指定のクレジット表記が必要）",
  url: "https://github.com/smartnews-smri/japan-topography",
  attribution:
    "スマートニュース メディア研究所「日本の行政区画境界データ」／国土交通省「国土数値情報（行政区域データ）」",
};

const LICENSE_PUBLIC_DOMAIN_SENKYOKU: DatasetLicense = {
  name: "パブリックドメイン（CC0相当）",
  url: "https://gtfs-gis.jp/senkyoku/",
  attribution:
    "「衆議院議員選挙・小選挙区の統計データ及び地図データ」（東京大学空間情報科学研究センター 西沢明 客員研究員）",
};

/** 本サイトが独自に作成した部分（原典の再配布にあたらないもの） */
const LICENSE_OWN_WORK: DatasetLicense = {
  name: "本サイトが作成したマスタデータ（自由に利用可）",
  url: null,
  attribution: "日本政治マップ",
};

export interface DownloadableDataset {
  /** 公開URL（サイトルートからの絶対パス） */
  path: string;
  /**
   * コピー元（data/ 配下のファイル名）。
   * null は、地図描画用として元から public/data に置いてあるファイル
   * （ビルド時のコピー対象外）。
   */
  sourceFileName: string | null;
  label: string;
  /** ファイルに何が入っているかの事実の説明 */
  description: string;
  /** 収録範囲・カバレッジの詳細（免責事項ページ）へのリンク先。無い場合は null */
  datasetId: DatasetId | null;
  /** 原典（DATASET_META にあるものはそこから引く） */
  sources: DatasetSource[];
  license: DatasetLicense;
  /** このライセンス・規約のもとで再配布してよいと判断した根拠 */
  rationale: string;
  /**
   * 配布ファイルを作るときの変換。未指定なら data/ のファイルをそのまま配る。
   * 原典由来の欄を落とす必要がある場合にのみ使う。
   */
  transform?: (raw: unknown) => unknown;
}

const sourcesOf = (id: DatasetId): DatasetSource[] => DATASET_META[id].sources;

/**
 * parties.json から院別の会派プロフィール（chambers）を落とす変換。
 *
 * 政党ID・正式名称・略称・識別色は本サイトが作成したマスタだが、
 * chambers 配下の会派名・所属議員数は衆議院公式サイトから取得した値を含む。
 * 衆議院ウェブサイトの利用条件は再配布まで明示的に許諾しているとは読み取れない
 * ため、配布ファイルからはその部分を除く（本サイトの画面表示では引き続き使う）。
 */
function stripChamberProfiles(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((party) => {
    if (typeof party !== "object" || party === null) return party;
    return Object.fromEntries(
      Object.entries(party as Record<string, unknown>).filter(
        ([key]) => key !== "chambers"
      )
    );
  });
}

/**
 * 再配布できると判断したデータセット。
 *
 * 判断基準は「原典側が再配布を明示的に認めているか」の一点。
 * MITライセンス・政府標準利用規約準拠・CC BY-SA・パブリックドメインのいずれかで、
 * 出典表記等の条件を満たせば再配布できると読み取れるものだけを載せている。
 */
export const DOWNLOADABLE_DATASETS: DownloadableDataset[] = [
  {
    path: "/data/datasets/bills.json",
    sourceFileName: "bills.json",
    label: "法案・議案",
    description:
      "議案の提出回次・議案種類・番号・件名・提出者区分・審議状況を1件1レコードで収録しています。",
    datasetId: "bills",
    sources: sourcesOf("bills"),
    license: LICENSE_MIT_SMARTNEWS_SHUGIIN,
    rationale:
      "取得元のスマートニュース メディア研究所「国会議案データベース：衆議院」がMITライセンスで公開しているため、出典表記を条件に再配布できます。",
  },
  {
    path: "/data/datasets/bill-status-history.json",
    sourceFileName: "bill-status-history.json",
    label: "法案の審議経過",
    description:
      "議案ごとの審議段階（提出・委員会付託・可決等）と、その日付・委員会名を時系列で収録しています。",
    datasetId: "bills",
    sources: sourcesOf("bills"),
    license: LICENSE_MIT_SMARTNEWS_SHUGIIN,
    rationale:
      "法案データと同じMITライセンスのデータベースから生成しています。",
  },
  {
    path: "/data/datasets/bill-sponsorships.json",
    sourceFileName: "bill-sponsorships.json",
    label: "法案の提出者・提出会派・審議時の賛否会派",
    description:
      "議案ごとの提出者・提出の賛成者の氏名、提出会派、衆議院審議時の賛成会派・反対会派を収録しています。",
    datasetId: "bill-sponsorships",
    sources: sourcesOf("bill-sponsorships"),
    license: LICENSE_MIT_SMARTNEWS_SHUGIIN,
    rationale:
      "原典は衆議院の議案経過情報ですが、スマートニュース メディア研究所がMITライセンスで再公開しているデータベースから取得しており、同ライセンスのもとで再配布できます。",
  },
  {
    path: "/data/datasets/parties.json",
    sourceFileName: "parties.json",
    label: "政党マスタ",
    description:
      "本サイトが各データセットの partyId として使っている政党の識別子・正式名称・略称・識別色の対応表です。各院の会派名・所属議員数の欄は配布ファイルには含めていません。",
    datasetId: null,
    sources: [],
    license: LICENSE_OWN_WORK,
    rationale:
      "識別子・略称は本サイトが付与したもの、識別色は各党の公式カラーです。原典サイトから取得した会派名・所属議員数の欄は配布ファイルから除いています。",
    transform: stripChamberProfiles,
  },
  {
    path: "/data/datasets/election-results.json",
    sourceFileName: "election-results.json",
    label: "選挙結果（候補者別得票数）",
    description:
      "候補者別の得票数・当落・党派を、選挙区単位で収録しています。",
    datasetId: "election-results",
    sources: sourcesOf("election-results"),
    license: LICENSE_SOUMU,
    rationale:
      "総務省ウェブサイトは政府標準利用規約に準拠し、出典表記を条件に複製・加工・再配布ができると明記されています。",
  },
  {
    path: "/data/datasets/party-seat-history.json",
    sourceFileName: "party-seat-history.json",
    label: "政党別議席数の推移",
    description:
      "衆議院・参議院の選挙ごとに、政党別の獲得議席数を収録しています。",
    datasetId: "party-seat-history",
    sources: sourcesOf("party-seat-history"),
    license: LICENSE_CC_BY_SA_4,
    rationale:
      "出典のWikipedia日本語版はCC BY-SA 4.0で、出典表記と同一ライセンスでの公開を条件に再配布できます。",
  },
  {
    path: "/data/datasets/local-assembly-party-composition.json",
    sourceFileName: "local-assembly-party-composition.json",
    label: "地方議会・長の党派別構成",
    description:
      "都道府県ごとに、知事・都道府県議会・市区長・市区議会・町村長・町村議会の党派別人員数を収録しています。",
    datasetId: "local-assembly-party-composition",
    sources: sourcesOf("local-assembly-party-composition"),
    license: LICENSE_SOUMU,
    rationale:
      "総務省ウェブサイトは政府標準利用規約に準拠し、出典表記を条件に複製・加工・再配布ができると明記されています。",
  },
  {
    path: "/data/datasets/national-budget.json",
    sourceFileName: "national-budget.json",
    label: "国の税収・歳入・歳出（一般会計）",
    description:
      "一般会計の税目別税収、主要科目別歳入、主要経費別歳出、目的別歳出を年度別に収録しています（単位は千円）。",
    datasetId: null,
    sources: [
      { name: "財務省「財政統計」「租税及び印紙収入決算額調」", url: "https://www.mof.go.jp/policy/budget/reference/statistics/data.htm" },
    ],
    license: LICENSE_MOF,
    rationale:
      "財務省ウェブサイトは政府標準利用規約に準拠し、出典表記を条件に商用利用・加工・再配布ができると明記されています。",
  },
  {
    path: "/data/datasets/prefecture-finance.json",
    sourceFileName: "prefecture-finance.json",
    label: "都道府県の決算収支",
    description:
      "都道府県ごとの歳入総額・歳出総額・実質収支を収録しています（単位は千円）。",
    datasetId: "prefecture-finance",
    sources: sourcesOf("prefecture-finance"),
    license: LICENSE_ESTAT,
    rationale:
      "e-Statは政府標準利用規約（第2.0版）に準拠し、出典表記を条件に複製・加工・再配布ができると明記されています。",
  },
  {
    path: "/data/datasets/prefecture-expenditure-by-purpose.json",
    sourceFileName: "prefecture-expenditure-by-purpose.json",
    label: "都道府県の目的別歳出",
    description:
      "都道府県ごとの歳出を、総務費・民生費・衛生費・教育費などの目的別区分で収録しています（単位は千円）。",
    datasetId: "prefecture-finance",
    sources: sourcesOf("prefecture-finance"),
    license: LICENSE_ESTAT,
    rationale:
      "e-Statは政府標準利用規約（第2.0版）に準拠し、出典表記を条件に複製・加工・再配布ができると明記されています。",
  },
  {
    path: "/data/datasets/prefecture-expenditure-by-nature.json",
    sourceFileName: "prefecture-expenditure-by-nature.json",
    label: "都道府県の性質別歳出",
    description:
      "都道府県ごとの歳出を、人件費・扶助費・公債費・投資的経費などの性質別区分で収録しています（単位は千円）。",
    datasetId: "prefecture-finance",
    sources: sourcesOf("prefecture-finance"),
    license: LICENSE_ESTAT,
    rationale:
      "e-Statは政府標準利用規約（第2.0版）に準拠し、出典表記を条件に複製・加工・再配布ができると明記されています。",
  },
  {
    path: "/data/datasets/prefecture-financial-health.json",
    sourceFileName: "prefecture-financial-health.json",
    label: "都道府県の財政指標",
    description:
      "都道府県ごとの財政力指数・経常収支比率・実質公債費比率・将来負担比率・ラスパイレス指数を収録しています。",
    datasetId: "prefecture-finance",
    sources: sourcesOf("prefecture-finance"),
    license: LICENSE_SOUMU,
    rationale:
      "総務省「主要財政指標一覧」から取得しており、総務省ウェブサイトの利用規約（政府標準利用規約準拠）のもとで再配布できます。",
  },
  {
    path: "/data/datasets/prefecture-population.json",
    sourceFileName: "prefecture-population.json",
    label: "都道府県別人口",
    description:
      "都道府県ごとの推計人口（各年10月1日現在）を収録しています。原表が千人単位で丸められた値です。",
    datasetId: "prefecture-finance",
    sources: sourcesOf("prefecture-finance"),
    license: LICENSE_ESTAT,
    rationale:
      "総務省統計局「人口推計」をe-Stat経由で取得しており、政府標準利用規約（第2.0版）のもとで再配布できます。",
  },
  {
    path: "/data/prefectures-topo.json",
    sourceFileName: null,
    label: "都道府県境界（TopoJSON）",
    description:
      "都道府県の境界ポリゴン（TopoJSON、簡略化済み）です。地図描画用として本サイトが配信しているファイルです。",
    datasetId: "district-boundaries",
    sources: [
      {
        name: "スマートニュース メディア研究所「日本の行政区画境界データ」",
        url: "https://github.com/smartnews-smri/japan-topography",
      },
    ],
    license: LICENSE_JAPAN_TOPOGRAPHY,
    rationale:
      "取得元が商用・非商用を問わず無償で利用可としており、原典（国土交通省 国土数値情報）指定のクレジット表記を条件に再配布できます。",
  },
  {
    path: "/data/districts-shugiin-topo.json",
    sourceFileName: null,
    label: "衆議院小選挙区の境界（TopoJSON）",
    description:
      "2022年（令和4年）改訂の衆議院小選挙区289区の境界ポリゴン（TopoJSON、選挙区単位に統合・簡略化済み）です。",
    datasetId: "district-boundaries",
    sources: [
      {
        name: "衆議院議員選挙・小選挙区の統計データ及び地図データ（東京大学空間情報科学研究センター 西沢明 客員研究員）",
        url: "https://gtfs-gis.jp/senkyoku/",
      },
    ],
    license: LICENSE_PUBLIC_DOMAIN_SENKYOKU,
    rationale:
      "原典がパブリックドメイン（出所明示不要）として公開しているため、再配布に制限がありません。",
  },
];

export interface WithheldDataset {
  label: string;
  /** 収録範囲の詳細（免責事項ページ）へのリンク先 */
  datasetId: DatasetId | null;
  sources: DatasetSource[];
  /** 配布しない理由（原典側の規約の書きぶりについての事実の記述に限る） */
  reason: string;
}

/**
 * 本サイトでは表示しているが、ダウンロード配布はしていないデータ。
 *
 * 「原典の規約から再配布の許諾を読み取れないもの」を配布対象から外している。
 * 原典の一次情報は各リンク先から直接取得できる。
 */
export const WITHHELD_DATASETS: WithheldDataset[] = [
  {
    label: "国会議員",
    datasetId: "legislators",
    sources: sourcesOf("legislators"),
    reason:
      "衆議院分は衆議院公式サイトから直接取得しています。同サイトの「著作権について」はコンテンツの利用を教育目的・引用の範囲で説明しており、名簿データをまとめて再配布してよいとまでは読み取れないため、配布対象から外しています。参議院分（MITライセンスのデータベース由来）も同じファイルに統合されているため、ファイル単位で配布を見送っています。",
  },
  {
    label: "参議院の記名投票（議員個人の賛否）",
    datasetId: "roll-call-votes",
    sources: sourcesOf("roll-call-votes"),
    reason:
      "参議院公式サイトの投票結果ページから直接取得しています。同サイトの著作権に関する記載は著作権法上認められた範囲での利用について述べたもので、取得したデータの再配布を明示的に許諾するものではないため、配布対象から外しています。",
  },
  {
    label: "質問主意書の提出件数",
    datasetId: "written-questions",
    sources: sourcesOf("written-questions"),
    reason:
      "衆議院・参議院の公式サイトから直接取得しています。両サイトとも再配布を明示的に許諾する記載がないため、配布対象から外しています。",
  },
  {
    label: "国会での発言回数",
    datasetId: "ndl-speech-counts",
    sources: sourcesOf("ndl-speech-counts"),
    reason:
      "国立国会図書館「国会会議録検索システム」APIの検索結果件数です。同館のコンテンツ利用規約は、システムを利用して行う行為の責任を利用者が負うとしており、取得した検索結果の再配布を許諾するものではないため、配布対象から外しています（発言本文はそもそも取得・保存していません）。",
  },
  {
    label: "地方議会議員（東京都議会）",
    datasetId: "local-assembly-members",
    sources: sourcesOf("local-assembly-members"),
    reason:
      "東京都議会ウェブサイトの利用条件を確認できていないため、配布対象から外しています。",
  },
  {
    label: "行政ニュース",
    datasetId: "news",
    sources: sourcesOf("news"),
    reason:
      "総務省の新着情報RSSから取得した見出しとリンクです。RSSは購読・表示のための配信であり、見出しを収めたファイルとして配布することは想定されていないと判断し、配布対象から外しています。原典のRSSは誰でも直接購読できます。",
  },
];

/**
 * マニフェスト（/data/datasets/manifest.json）の型。
 * 公開APIとして外部から参照される想定のため、フィールドを削る際は互換性に注意する。
 */
export interface DatasetManifestEntry {
  path: string;
  fileName: string;
  label: string;
  description: string;
  /** JSONのトップレベルが配列のときの要素数（配列でない場合は null） */
  records: number | null;
  bytes: number;
  license: DatasetLicense;
  sources: DatasetSource[];
  /** 免責事項ページ内の収録範囲の説明へのリンク（無い場合は null） */
  coverageUrl: string | null;
}

export interface DatasetManifest {
  site: string;
  siteUrl: string | null;
  generatedAt: string;
  note: string;
  datasets: DatasetManifestEntry[];
}
