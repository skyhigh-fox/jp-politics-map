import type {
  Bill,
  BillSponsorship,
  ElectionResult,
  Legislator,
  LocalAssemblyMember,
  LocalAssemblyPartyComposition,
  NdlSpeechCount,
  PartySeatHistory,
  PrefectureFinance,
  PrefectureTurnoutElection,
  RollCallVote,
  WrittenQuestionCount,
} from "@/types";
import type { NewsItem } from "@/lib/news";

/**
 * 【出典・鮮度・欠損の体系的表示】データセットごとの出典・収録範囲・
 * 既知のカバレッジを一元管理するモジュール。
 *
 * 設計方針（DataInsight.tsx と同じ思想）:
 * - 件数・カバレッジ率・対象時点は、ハードコードせず**表示時に実データから
 *   機械的に算出する**。データが増減しても数値が自動的に正しくなるようにする。
 * - 静的に持つのは「情報源が何か」「取得スクリプトの設計上どこまでを対象に
 *   しているか」という、実データからは算出できない仕様の説明のみ。
 *
 * 中立性の方針（重要）:
 * - 収録できていない範囲は隠さず事実として書くが、「不十分」「不完全」
 *   「限定的」といった評価語は使わない。「○○名分を確認できています」
 *   「○○は収録していません」のように、確認できた事実・確認できていない
 *   事実の記述に留める。
 * - 数値の多寡についての意味づけ（良い/悪い、ランキング的な含意）はしない。
 */

export type DatasetId =
  | "legislators"
  | "bills"
  | "bill-sponsorships"
  | "roll-call-votes"
  | "ndl-speech-counts"
  | "written-questions"
  | "election-results"
  | "prefecture-turnout"
  | "party-seat-history"
  | "local-assembly-members"
  | "local-assembly-party-composition"
  | "prefecture-finance"
  | "district-boundaries"
  | "news";

export interface DatasetSource {
  name: string;
  url: string;
}

/** データセットの静的な仕様（実データからは算出できない情報のみを持つ） */
export interface DatasetMeta {
  id: DatasetId;
  /** 画面に出す名称 */
  label: string;
  /** 情報源（一次情報源へのリンク） */
  sources: DatasetSource[];
  /**
   * 取得スクリプトの設計上どこまでを収録対象にしているか。
   * 「なぜ全件ではないのか」を事実として説明する（サイトへの負荷、
   * 原資料の配布形式など）。
   */
  scope: string;
}

/** 実データから算出した収録状況 */
export interface DatasetCoverage {
  /**
   * データの対象時点。ラベルはデータセットによって意味が異なる
   * （API取得日時なのか、収録データの最終日なのか、決算年度なのか）ため、
   * 値と一緒にラベルも持たせて誤解を避ける。
   */
  asOf: { label: string; value: string } | null;
  /** 収録件数・カバレッジ・既知の欠損についての事実の箇条書き */
  facts: string[];
}

/** 免責事項ページに並べる1データセット分の情報 */
export interface DatasetProvenance extends DatasetMeta, DatasetCoverage {}

export const DATASET_META: Record<DatasetId, DatasetMeta> = {
  legislators: {
    id: "legislators",
    label: "国会議員",
    sources: [
      { name: "衆議院「会派名及び会派別所属議員数」等", url: "https://www.shugiin.go.jp/" },
      { name: "参議院「議員情報」", url: "https://www.sangiin.go.jp/" },
    ],
    scope:
      "各院の公式サイトが公表している現職議員の一覧を収録しています。氏名・会派名は公式サイトの表記をそのまま保持し、独自の言い換えや推測による補完はしていません。",
  },
  bills: {
    id: "bills",
    label: "法案・審議進捗",
    sources: [
      {
        name: "スマートニュース メディア研究所「国会議案データベース」",
        url: "https://github.com/smartnews-smri",
      },
      { name: "衆議院「議案」", url: "https://www.shugiin.go.jp/internet/itdb_gian.nsf/html/gian/menu.htm" },
    ],
    scope:
      "衆議院に提出された議案の経過情報を収録しています。参議院先議の議案・条約承認案件等、衆議院の議案一覧に掲載されないものは含まれません。",
  },
  "bill-sponsorships": {
    id: "bill-sponsorships",
    label: "法案の提出者・提出会派・審議時の賛否会派",
    sources: [
      {
        name: "スマートニュース メディア研究所「国会議案データベース」",
        url: "https://github.com/smartnews-smri",
      },
      {
        name: "衆議院「議案」（議案経過情報）",
        url: "https://www.shugiin.go.jp/internet/itdb_gian.nsf/html/gian/menu.htm",
      },
    ],
    scope:
      "衆議院の議案経過情報に記載されている「議案提出者」「議案提出者一覧」「議案提出の賛成者」「議案提出会派」「衆議院審議時会派態度」「衆議院審議時賛成会派」「衆議院審議時反対会派」の各欄をそのまま転記しています。提出者・提出の賛成者の氏名は、衆議院に発議された議案（衆法・決議案等）にのみ記載があり、参議院に発議された議案（参法）の発議者は原資料に含まれません。賛成会派・反対会派は衆議院での審議時のものであり、参議院での会派態度は原資料に含まれません。会派名・氏名は当時の表記のまま保持し、独自の言い換えや推測による補完はしていません。",
  },
  "roll-call-votes": {
    id: "roll-call-votes",
    label: "参議院の記名投票（議員個人の賛否）",
    sources: [
      {
        name: "参議院「本会議投票結果」",
        url: "https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html",
      },
    ],
    scope:
      "衆議院本会議の採決は起立採決が中心で議員個人の賛否が原則公開されないため、押しボタン式投票により個人の賛否が公開されている参議院のみを対象にしています。参議院側も全回次を毎回取得するとサイトへの負荷が大きいため、直近の回次に絞って取得しています。",
  },
  "ndl-speech-counts": {
    id: "ndl-speech-counts",
    label: "国会での発言回数",
    sources: [
      {
        name: "国立国会図書館「国会会議録検索システム」検索用API",
        url: "https://kokkai.ndl.go.jp/api.html",
      },
    ],
    scope:
      "APIの検索条件が発言者名の部分一致であり、議員IDによる一意の人物特定ではないため、同姓同名の別人（元議員・地方議員・参考人等）の発言が件数に混ざる可能性がある参考値です。発言本文は著作権への配慮から取得・保存していません。",
  },
  "written-questions": {
    id: "written-questions",
    label: "質問主意書の提出件数",
    sources: [
      {
        name: "衆議院「質問答弁情報」",
        url: "https://www.shugiin.go.jp/internet/itdb_shitsumon.nsf/html/shitsumon/menu.htm",
      },
      {
        name: "参議院「質問主意書」",
        url: "https://www.sangiin.go.jp/japanese/joho1/kousei/syuisyo/syuisyo.htm",
      },
    ],
    scope:
      "第1回国会からの全回次を毎回取得するとサイトへの負荷が大きいため、直近の回次に絞って集計しています。提出者名は氏名の正規化により現職議員と照合しており、表記が一致しなかった提出者（引退した元議員を含む）は集計に含まれません。質問・答弁の本文は著作権への配慮から取得・保存していません。",
  },
  "election-results": {
    id: "election-results",
    label: "選挙結果（候補者別得票数）",
    sources: [
      {
        name: "総務省「選挙関連資料」",
        url: "https://www.soumu.go.jp/senkyo/senkyo_s/data/",
      },
    ],
    scope:
      "候補者別の得票数が機械可読な形式（Excel）で配布されている選挙のみを収録しています。それ以外の選挙はPDFでの配布であり、現時点では取り込んでいません。比例代表の名簿登載者別得票も現時点では対象外です。",
  },
  "prefecture-turnout": {
    id: "prefecture-turnout",
    label: "都道府県別の投票率（国政選挙）",
    sources: [
      {
        name: "総務省「選挙関連資料」衆議院議員総選挙結果調",
        url: "https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin/ichiran.html",
      },
      {
        name: "総務省「選挙関連資料」参議院議員通常選挙結果調",
        url: "https://www.soumu.go.jp/senkyo/senkyo_s/data/sangiin/ichiran.html",
      },
    ],
    scope:
      "各回の選挙結果調に含まれる都道府県別投票率の表（衆議院は小選挙区、参議院は選挙区）を、原資料の値のまま転記しています。男・女・計の3区分は原資料（選挙人名簿上の性別）の区分であり、本サイトが独自に分類したものではありません。比例代表の投票率、年齢別・年代別の投票率、市区町村別の投票率は収録していません（年代別投票率は原資料がPDFのみのため）。回ごとにExcelの様式が異なるため、様式が安定している2012年（第46回衆議院議員総選挙）以降に絞って収録しています。投票率の高低は評価を含まない実測値であり、本サイトでは順位付けを行わず、全国計との比較と推移の形で表示しています。",
  },
  "party-seat-history": {
    id: "party-seat-history",
    label: "政党別議席数の推移",
    sources: [
      { name: "Wikipedia（各選挙の結果記事）", url: "https://ja.wikipedia.org/" },
    ],
    scope:
      "候補者名の照合を要さない「選挙ごとの政党別獲得議席数」という集計済みの数値のみを収録しています。分裂・合流により後継関係が曖昧な政党は、無理に現在の政党へ統合せず当時の名称のまま保持しています。",
  },
  "local-assembly-members": {
    id: "local-assembly-members",
    label: "地方議会議員",
    sources: [
      {
        name: "東京都議会「議員名簿」",
        url: "https://www.gikai.metro.tokyo.lg.jp/membership/list.html",
      },
    ],
    scope:
      "全国の地方議員は3万人を超えるため、まずパイロットとして1議会分のみを収録しています。他の自治体の議員は収録していません。",
  },
  "local-assembly-party-composition": {
    id: "local-assembly-party-composition",
    label: "地方議会・長の党派別構成",
    sources: [
      {
        name: "総務省「地方公共団体の議会の議員及び長の所属党派別人員調」",
        url: "https://www.soumu.go.jp/senkyo/senkyo_s/data/syozoku/",
      },
    ],
    scope:
      "議員個人の名簿ではなく、都道府県ごと・党派ごとの人員数の集計です（原資料がその形式で公表されているため）。個々の議員の氏名・選挙区・所属は含まれません。党派名・党派の並び順・人員数は原資料の表記と掲載順のまま保持し、独自の再分類（与党・野党への括り直し等）や人数順への並べ替えはしていません。原資料には男女別の内訳もありますが、本サイトでは保持していません。市区町村単位の内訳は原資料になく、都道府県単位の合計のみを収録しています。",
  },
  "prefecture-finance": {
    id: "prefecture-finance",
    label: "都道府県の財政・歳出",
    sources: [
      { name: "総務省「地方財政状況調査」（e-Stat経由）", url: "https://www.e-stat.go.jp/" },
      { name: "総務省「主要財政指標一覧」", url: "https://www.soumu.go.jp/" },
      { name: "総務省統計局「人口推計」", url: "https://www.stat.go.jp/" },
    ],
    scope:
      "都道府県分の決算値のみを収録しており、市区町村分は収録していません。人口一人当たりの金額に用いる人口は、原表が千人単位で丸められた推計値です。",
  },
  "district-boundaries": {
    id: "district-boundaries",
    label: "選挙区の境界データ",
    sources: [
      {
        name: "衆議院議員選挙・小選挙区の統計データ及び地図データ（東京大学空間情報科学研究センター 西沢明 客員研究員）",
        url: "https://gtfs-gis.jp/senkyoku/",
      },
      {
        name: "スマートニュース メディア研究所「日本の行政区画境界データ」（都道府県境界）",
        url: "https://github.com/smartnews-smri/japan-topography",
      },
    ],
    scope:
      "衆議院小選挙区は2022年（令和4年）改訂、いわゆる「10増10減」後の区割りに対応した境界データを使っています。原典は小選挙区コードを持つ町丁字レベルの細片ポリゴンのため、選挙区単位に統合したうえで全国地図の表示に必要な精度まで簡略化しています（生成手順は scripts/build-shugiin-district-topojson.mjs に記載）。参議院選挙区は都道府県単位のため、都道府県境界データをそのまま用い、合区は2県を1つの選挙区として扱っています。境界線は簡略化されているため、正確な区割りは総務省・各選挙管理委員会の公表資料をご確認ください。",
  },
  news: {
    id: "news",
    label: "行政ニュース",
    sources: [
      {
        name: "総務省「ホームページ新着情報」RSS",
        url: "https://www.soumu.go.jp/menu_kyotsuu/rss_information.html",
      },
    ],
    scope:
      "配信元RSSに掲載されている見出しとリンクのみを保持し、本文・画像は転載していません。RSSの保持件数を超えた過去の記事は収録していません。報道機関・他省庁のRSSは、規約で再配信が制限されているものが多いため採用していません。",
  },
};

/** 免責事項ページに並べる順序（読み手が辿りやすい粒度順） */
export const DATASET_ORDER: DatasetId[] = [
  "legislators",
  "bills",
  "bill-sponsorships",
  "roll-call-votes",
  "ndl-speech-counts",
  "written-questions",
  "election-results",
  "prefecture-turnout",
  "party-seat-history",
  "local-assembly-members",
  "local-assembly-party-composition",
  "prefecture-finance",
  "district-boundaries",
  "news",
];

/** 免責事項ページ内の該当データセットの見出しへのアンカー */
export function datasetAnchor(id: DatasetId): string {
  return `dataset-${id}`;
}

/** 個別ページの注記から張る「収録範囲の詳細」へのリンク先 */
export function datasetHref(id: DatasetId): string {
  return `/disclaimer#${datasetAnchor(id)}`;
}

// ---------------------------------------------------------------------------
// 表示用の小さなフォーマッタ
// ---------------------------------------------------------------------------

/**
 * ISO 8601 の日時を日本時間の YYYY-MM-DD にする。
 * ビルドを実行するマシンのタイムゾーン（GitHub ActionsはUTC）に結果が
 * 左右されないよう、明示的に Asia/Tokyo で整形する。
 */
const JST_DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatJstDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return JST_DATE_FORMAT.format(d).replaceAll("/", "-");
}

const n = (value: number) => value.toLocaleString("ja-JP");

/** 比率を「12.1%」の形にする（0除算時は空文字を返す） */
function percent(part: number, whole: number): string {
  if (whole <= 0) return "";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/** 数値の配列から「第204回〜第221回」のような範囲表現を作る */
function sessionRange(sessions: number[]): string | null {
  if (sessions.length === 0) return null;
  const min = Math.min(...sessions);
  const max = Math.max(...sessions);
  return min === max ? `第${min}回国会` : `第${min}回〜第${max}回国会`;
}

// ---------------------------------------------------------------------------
// データセットごとのカバレッジ算出（すべて純関数。実データのみを根拠にする）
// ---------------------------------------------------------------------------

export function buildLegislatorCoverage(
  legislators: Legislator[]
): DatasetCoverage {
  const byChamber = new Map<string, number>();
  for (const l of legislators) {
    byChamber.set(l.chamber, (byChamber.get(l.chamber) ?? 0) + 1);
  }
  const breakdown = [...byChamber.entries()]
    .map(([chamber, count]) => `${chamber}${n(count)}名`)
    .join("・");
  return {
    asOf: null,
    facts: [
      `${breakdown}の計${n(legislators.length)}名を収録しています。`,
      "各議員の写真は、掲載条件を確認できたものがないため掲載していません。",
    ],
  };
}

export function buildBillCoverage(bills: Bill[]): DatasetCoverage {
  const sessions = bills.map((b) => b.dietSession);
  const range = sessionRange(sessions);
  const lastUpdated = bills
    .map((b) => b.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    asOf: lastUpdated
      ? { label: "収録データの最終更新日", value: lastUpdated }
      : null,
    facts: [
      range
        ? `${range}の議案${n(bills.length)}件を収録しています。`
        : `議案${n(bills.length)}件を収録しています。`,
    ],
  };
}

/**
 * 提出者・会派データの「収録範囲」だけを示す軽量版の事実。
 *
 * 提出者・賛成者の氏名は延べ12万件規模になるため、法案詳細ページのように
 * 毎回レンダリングされる画面では、レコード件数だけで算出できる事実に絞る。
 */
export function buildBillSponsorshipScopeFacts(
  sponsorships: BillSponsorship[]
): string[] {
  const withSponsors = sponsorships.filter((s) => s.sponsors.length > 0).length;
  const withApproving = sponsorships.filter(
    (s) => s.approvingParties.length > 0
  ).length;
  return [
    `衆議院の議案経過情報のうち、提出者・会派の記載がある${n(sponsorships.length)}件分を収録しています。`,
    `このうち提出者の氏名一覧があるのは${n(withSponsors)}件です。氏名一覧は衆議院に発議された議案（衆法・決議案等）にのみ記載があり、参議院に発議された議案・内閣提出の議案には原資料に記載がありません。`,
    `衆議院審議時の賛成会派の記載があるのは${n(withApproving)}件です。衆議院本会議で採決に至っていない議案と、参議院での会派態度は原資料に含まれません。`,
  ];
}

export function buildBillSponsorshipCoverage(
  sponsorships: BillSponsorship[]
): DatasetCoverage {
  let personTotal = 0;
  let personLinked = 0;
  let partyTotal = 0;
  let partyLinked = 0;
  for (const s of sponsorships) {
    for (const person of [...s.sponsors, ...s.supporters]) {
      personTotal += 1;
      if (person.legislatorId !== null) personLinked += 1;
    }
    for (const party of [
      ...s.submitterParties,
      ...s.approvingParties,
      ...s.opposingParties,
    ]) {
      partyTotal += 1;
      if (party.partyId !== null) partyLinked += 1;
    }
  }

  const facts: string[] = [];
  if (personTotal > 0) {
    facts.push(
      `提出者・提出の賛成者として記載されている氏名は延べ${n(personTotal)}件で、そのうち${n(personLinked)}件（${percent(personLinked, personTotal)}）を現在の議員データと照合できています。残りは在職当時の元議員など現在の議員データに氏名が見つからない方で、氏名はそのまま表示し、議員ページへの紐付けのみを行っていません。`
    );
  }
  if (partyTotal > 0) {
    facts.push(
      `会派名は延べ${n(partyTotal)}件で、そのうち${n(partyLinked)}件（${percent(partyLinked, partyTotal)}）を現在の政党データと照合できています。既に解散・改称した会派、複数政党による合同会派は、後継関係を推測せず当時の名称のまま表示しています。`
    );
  }
  facts.push(...buildBillSponsorshipScopeFacts(sponsorships));

  return { asOf: null, facts };
}

/**
 * 記名投票データの「収録範囲」だけを示す軽量版の事実。
 *
 * 全投票の議員個人レコード（延べ7万件規模）を走査せず、投票の件数だけで
 * 算出できる事実に絞っている。法案詳細ページのように大量にレンダリングされる
 * 画面ではこちらを使う。
 */
export function buildRollCallVoteScopeFacts(votes: RollCallVote[]): string[] {
  const range = sessionRange(votes.map((v) => v.session));
  const linkedBills = votes.filter((v) => v.billId !== null).length;
  return [
    range
      ? `記名投票データは${range}の${n(votes.length)}件を収録しています（参議院のみ）。`
      : `記名投票データは${n(votes.length)}件を収録しています（参議院のみ）。`,
    `このうち法案データと案件名を突合できたのは${n(linkedBills)}件です。突合できなかった投票（会期の件・決算・人事案件など）は法案ページからは辿れませんが、記名投票一覧ページには全件を収録しています。`,
  ];
}

export function buildRollCallVoteCoverage(
  votes: RollCallVote[]
): DatasetCoverage {
  let entryCount = 0;
  let unlinked = 0;
  for (const v of votes) {
    entryCount += v.results.length;
    for (const r of v.results) {
      if (r.legislatorId === null) unlinked += 1;
    }
  }
  const lastDate = votes
    .map((v) => v.date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const facts: string[] = [
    `延べ${n(entryCount)}名分の賛否を収録しています。`,
  ];
  if (unlinked > 0) {
    facts.push(
      `このうち${n(unlinked)}名分（${percent(unlinked, entryCount)}）は、投票当時に在職していた元議員など、現在の議員データに氏名が見つからない方の記録です。賛否そのものは投票結果ページのとおり表示し、議員ページへの紐付けのみを行っていません。`
    );
  }
  facts.push(...buildRollCallVoteScopeFacts(votes));

  return {
    asOf: lastDate ? { label: "収録データの最終投票日", value: lastDate } : null,
    facts,
  };
}

/**
 * 法案詳細ページのヒートマップに添える注記用の事実。
 * 「その投票1件の中で何名が紐付いていないか」というページ固有の事実と、
 * データセット全体の収録範囲の両方を示す。
 */
export function buildRollCallVoteNoteFacts(
  vote: RollCallVote,
  allVotes: RollCallVote[]
): string[] {
  const facts: string[] = [];
  const unlinked = vote.results.filter((r) => r.legislatorId === null).length;
  if (unlinked > 0) {
    facts.push(
      `この投票の${n(vote.results.length)}名分のうち${n(unlinked)}名は、現在の議員データに氏名が見つからないため（投票当時に在職していた元議員など）、議員ページへの紐付けを行っていません。賛否の集計自体には含まれています。`
    );
  } else {
    facts.push(
      `この投票の${n(vote.results.length)}名分は、すべて現在の議員データと氏名を照合できています。`
    );
  }
  facts.push(...buildRollCallVoteScopeFacts(allVotes));
  return facts;
}

export function buildNdlSpeechCoverage(
  counts: NdlSpeechCount[],
  legislatorTotal: number
): DatasetCoverage {
  const fetchedAt = counts
    .map((c) => c.fetchedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const facts: string[] = [];
  if (legislatorTotal > 0) {
    facts.push(
      counts.length >= legislatorTotal
        ? `収録中の議員${n(legislatorTotal)}名全員分の件数を集計しています。`
        : `収録中の議員${n(legislatorTotal)}名のうち${n(counts.length)}名（${percent(counts.length, legislatorTotal)}）の件数を集計しています。`
    );
  }
  facts.push(
    "氏名の部分一致による検索結果の件数のため、同姓同名の別人の発言が混ざっている可能性がある参考値です。"
  );
  return {
    asOf: fetchedAt
      ? { label: "APIからの取得日", value: formatJstDate(fetchedAt) }
      : null,
    facts,
  };
}

export function buildWrittenQuestionCoverage(
  counts: WrittenQuestionCount[],
  legislatorTotal: number
): DatasetCoverage {
  const sessions = counts.flatMap((c) => c.sessionsCovered);
  const range = sessionRange(sessions);
  const facts: string[] = [];
  if (legislatorTotal > 0) {
    facts.push(
      `収録中の議員${n(legislatorTotal)}名のうち${n(counts.length)}名（${percent(counts.length, legislatorTotal)}）について、集計対象期間内の提出を確認できています。`
    );
  }
  if (range) {
    facts.push(`提出が確認できた回次は${range}です（全期間の集計ではありません）。`);
  }
  facts.push(
    "件数が0件の議員と、氏名の照合ができず集計に含められなかった議員は、この画面では区別できません。"
  );
  return {
    asOf: range ? { label: "集計対象の回次", value: range } : null,
    facts,
  };
}

export function buildElectionResultCoverage(
  results: ElectionResult[],
  legislatorTotal: number
): DatasetCoverage {
  const years = [...new Set(results.map((r) => r.electionYear))].sort();
  const types = [...new Set(results.map((r) => r.electionType))];
  const people = new Set(results.map((r) => r.legislatorId)).size;
  const yearLabel =
    years.length === 0
      ? null
      : years.length === 1
        ? `${years[0]}年`
        : `${years[0]}年〜${years.at(-1)}年`;

  const facts: string[] = [];
  if (yearLabel) {
    facts.push(
      `${yearLabel}の${types.join("・")}について、${n(people)}名分の得票数を収録しています。`
    );
  }
  if (legislatorTotal > 0) {
    facts.push(
      `収録中の議員${n(legislatorTotal)}名に対するカバー率は${percent(people, legislatorTotal)}です。上記以外の選挙で当選した議員の得票数は収録していません。`
    );
  }
  return {
    asOf: yearLabel ? { label: "収録している選挙", value: yearLabel } : null,
    facts,
  };
}

/**
 * 都道府県別投票率の収録状況（機能拡充ロードマップ Tier1 #7）。
 *
 * 中立性のため、投票率の値そのものについての言及（どこが高い/低い等）は
 * 一切書かず、「何回分・何都道府県分・どの区分を収録しているか」という
 * 収録範囲の事実だけを算出する。
 */
export function buildPrefectureTurnoutCoverage(
  elections: PrefectureTurnoutElection[]
): DatasetCoverage {
  if (elections.length === 0) {
    return { asOf: null, facts: ["現在収録しているデータはありません。"] };
  }
  const dates = elections.map((e) => e.electionDate).sort();
  const byChamber = new Map<string, { count: number; category: string }>();
  for (const e of elections) {
    const cur = byChamber.get(e.chamber);
    byChamber.set(e.chamber, {
      count: (cur?.count ?? 0) + 1,
      category: e.votingCategory,
    });
  }
  const breakdown = [...byChamber.entries()]
    .map(([chamber, v]) => `${chamber}（${v.category}）${n(v.count)}回`)
    .join("・");

  const prefectureCounts = new Set(elections.map((e) => e.prefectures.length));
  const allComplete = prefectureCounts.size === 1 && prefectureCounts.has(47);
  const withGender = elections.filter((e) =>
    e.prefectures.every((p) => p.male !== null && p.female !== null)
  ).length;

  return {
    asOf: {
      label: "収録している選挙",
      value: `${dates[0]!.slice(0, 4)}年〜${dates.at(-1)!.slice(0, 4)}年`,
    },
    facts: [
      `${breakdown}の計${n(elections.length)}回について、都道府県別の投票率を収録しています。`,
      allComplete
        ? `いずれの回も47都道府県すべてと全国計の値が揃っています。${withGender === elections.length ? "男・女・計の3区分もすべての回で揃っています。" : `男女別の内訳が揃っているのは${n(withGender)}回です。`}`
        : `回によって収録できている都道府県数が異なります（${[...prefectureCounts].sort((a, b) => a - b).join("・")}件）。`,
      "比例代表の投票率、年齢別・年代別の投票率、市区町村別の投票率は収録していません。これより前の回は原資料のExcelの様式が異なるため収録していません。",
    ],
  };
}

export function buildPartySeatHistoryCoverage(
  history: PartySeatHistory[]
): DatasetCoverage {
  const years = history.map((h) => h.electionYear).sort();
  const byChamber = new Map<string, number>();
  for (const h of history) {
    byChamber.set(h.chamber, (byChamber.get(h.chamber) ?? 0) + 1);
  }
  const breakdown = [...byChamber.entries()]
    .map(([chamber, count]) => `${chamber}${n(count)}回`)
    .join("・");
  const yearLabel =
    years.length === 0 ? null : `${years[0]}年〜${years.at(-1)}年`;
  return {
    asOf: yearLabel ? { label: "収録している選挙", value: yearLabel } : null,
    facts:
      years.length === 0
        ? ["現在収録しているデータはありません。"]
        : [
            `${yearLabel}に行われた${breakdown}の選挙結果を収録しています。`,
            "これより前の選挙は収録していません。",
          ],
  };
}

export function buildLocalAssemblyCoverage(
  members: LocalAssemblyMember[]
): DatasetCoverage {
  const assemblies = [...new Set(members.map((m) => m.assembly))];
  return {
    asOf: null,
    facts:
      members.length === 0
        ? ["現在収録しているデータはありません。"]
        : [
            `${assemblies.join("・")}の${n(members.length)}名を収録しています。`,
            "これ以外の都道府県議会・市区町村議会の議員は収録していません。",
          ],
  };
}

/**
 * 地方議会・長の党派別構成（Tier1 #6）の「収録範囲」だけを示す軽量版の事実。
 *
 * 都道府県詳細ページに添える注記用。その都道府県1件分のレコードから算出できる
 * 事実（区分の数・調査基準日・党派列の数）に限定している。
 * 中立性のため、党派名や人数の多寡についての意味づけは一切書かない。
 */
export function buildLocalPartyCompositionScopeFacts(
  composition: LocalAssemblyPartyComposition
): string[] {
  const bodyTypes = composition.bodies.map((b) => b.bodyType);
  const partyColumns = new Set(
    composition.bodies.flatMap((b) => b.parties.map((p) => p.name))
  );
  const unresolved = new Set(
    composition.bodies
      .flatMap((b) => b.parties)
      .filter((p) => p.partyId === null)
      .map((p) => p.name)
  );

  const facts: string[] = [
    `${bodyTypes.join("・")}の${n(bodyTypes.length)}区分について、党派別の人員数を収録しています。`,
    `原資料の党派の区分は${n(partyColumns.size)}種類で、調査基準日は${composition.asOfDate}です。`,
    "議員個人の氏名・選挙区・所属は原資料に含まれないため収録していません。市区町村ごとの内訳も原資料になく、都道府県単位の合計のみです。",
  ];
  if (unresolved.size > 0) {
    facts.push(
      `${[...unresolved].join("・")}は、原資料が複数の党派・団体をまとめて集計している区分（原資料で独立した列を持たない地域政党・政治団体を含む）のため、本サイトの政党データとは対応付けていません。`
    );
  }
  return facts;
}

export function buildLocalPartyCompositionCoverage(
  compositions: LocalAssemblyPartyComposition[]
): DatasetCoverage {
  if (compositions.length === 0) {
    return { asOf: null, facts: ["現在収録しているデータはありません。"] };
  }
  const asOfDates = [...new Set(compositions.map((c) => c.asOfDate))].sort();
  const bodyTypes = [
    ...new Set(compositions.flatMap((c) => c.bodies.map((b) => b.bodyType))),
  ];
  const partyColumns = new Set(
    compositions.flatMap((c) =>
      c.bodies.flatMap((b) => b.parties.map((p) => p.name))
    )
  );
  const totalMembers = compositions.reduce(
    (sum, c) => sum + c.bodies.reduce((s, b) => s + b.totalMembers, 0),
    0
  );

  return {
    asOf: { label: "調査基準日", value: asOfDates.join("・") },
    facts: [
      `${n(compositions.length)}都道府県${compositions.length === 47 ? "すべて" : ""}について、${bodyTypes.join("・")}の${n(bodyTypes.length)}区分・${n(partyColumns.size)}種類の党派区分の人員数を収録しています（延べ${n(totalMembers)}名分の集計）。`,
      "議員・長の個人名は原資料に含まれないため収録していません。個人の氏名を収録しているのは別データセット「地方議会議員」（パイロット1議会分）のみです。",
      "調査は毎年12月31日現在で実施され、本サイトは最新の1時点のみを収録しています。過去年との比較データは収録していません。",
    ],
  };
}

export function buildPrefectureFinanceCoverage(
  finance: PrefectureFinance[]
): DatasetCoverage {
  const years = [...new Set(finance.map((f) => f.fiscalYear))].sort();
  const prefectures = new Set(finance.map((f) => f.prefecture)).size;
  const yearLabel =
    years.length === 0
      ? null
      : years.length === 1
        ? `${years[0]}年度`
        : `${years[0]}年度〜${years.at(-1)}年度`;
  return {
    asOf: yearLabel ? { label: "対象年度（決算）", value: yearLabel } : null,
    facts:
      years.length === 0
        ? ["現在収録しているデータはありません。"]
        : [
            `${prefectures}都道府県${prefectures === 47 ? "すべて" : ""}の${yearLabel}決算を収録しています。`,
            "過去年度との比較、および市区町村単位の財政データは収録していません。",
          ],
  };
}

/**
 * 選挙区の境界データの収録状況。
 *
 * 「区割りが最新かどうか」は、境界データ側の選挙区名と現職議員データ側の
 * 選挙区名が1対1で突合できるかどうかで機械的に判定できる
 * （区割り改定前の境界データを使うと、東京26〜30区などが欠け、
 * 廃止済みの宮城6区などが余る）。ここではその突合結果を事実として示す。
 */
export function buildDistrictBoundaryCoverage(
  shugiinDistrictNames: string[],
  legislators: Legislator[]
): DatasetCoverage {
  const boundaryKeys = new Set(
    shugiinDistrictNames.map((name) => name.replace(/区$/, ""))
  );
  const legislatorDistricts = new Set(
    legislators
      .filter((l) => l.chamber === "衆議院" && /\d$/.test(l.district))
      .map((l) => l.district)
  );
  const matched = [...legislatorDistricts].filter((d) =>
    boundaryKeys.has(d)
  ).length;
  const unmatched = legislatorDistricts.size - matched;

  const facts: string[] = [
    `衆議院小選挙区${n(boundaryKeys.size)}区分の境界を収録しています。`,
  ];
  if (legislatorDistricts.size > 0) {
    facts.push(
      unmatched === 0
        ? `現職議員データにある${n(legislatorDistricts.size)}区すべてについて、境界データ側の選挙区名と一致することを確認できています。`
        : `現職議員データにある${n(legislatorDistricts.size)}区のうち${n(matched)}区（${percent(matched, legislatorDistricts.size)}）で境界データ側の選挙区名と一致しています。残る${n(unmatched)}区は地図上に表示されません。`
    );
  }
  facts.push(
    "参議院選挙区（45区）は専用の境界データを持たず、都道府県境界データから構成しています。合区（鳥取県・島根県、徳島県・高知県）は2県で1区として扱っています。",
    "境界線は表示用に簡略化しているため、実際の区割りとは細部が異なります。"
  );
  return { asOf: null, facts };
}

export function buildNewsCoverage(news: NewsItem[]): DatasetCoverage {
  const sources = [...new Set(news.map((item) => item.sourceName))];
  const latest = news
    .map((item) => item.publishedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    asOf: latest
      ? { label: "収録記事の最終公開日", value: formatJstDate(latest) }
      : null,
    facts:
      news.length === 0
        ? ["現在収録している記事はありません。"]
        : [
            `${sources.join("・")}の新着情報${n(news.length)}件の見出しとリンクを収録しています。`,
            "配信元RSSの保持件数を超えた過去の記事は収録していません。",
          ],
  };
}
