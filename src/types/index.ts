/**
 * フェーズ1（国会議員＋法案審議進捗）のデータモデル型定義。
 * 詳細設計の経緯はObsidian Vault（jp-politics-map/決定事項ログ.md）を参照。
 */

export type Chamber = "衆議院" | "参議院";

export type ElectionType = "小選挙区" | "比例代表" | "選挙区" | "比例代表(参院)";

/** 政党・会派マスタ */
export interface Party {
  id: string;
  name: string;
  abbreviation?: string;
  /** 政党の公式カラー。中立性配慮のため、良し悪しの含意を持たせず公式カラーをそのまま採用する */
  color?: string;
}

/** 議員の会派所属履歴（会派移動が多いため履歴として持つ） */
export interface PartyMembershipHistory {
  legislatorId: string;
  partyId: string;
  startDate: string; // ISO 8601 (YYYY-MM-DD)
  endDate: string | null; // 現職はnull
  note?: string;
}

/** 議員写真の掲載可否ポリシー */
export type PhotoPolicy =
  | { status: "none" } // 写真なし。アバター+外部リンクで代替
  | { status: "licensed"; url: string; source: string; license: string }; // CC等ライセンス確認済み

/** 国会議員 */
export interface Legislator {
  id: string;
  chamber: Chamber;
  name: string;
  nameKana?: string;
  currentPartyId: string;
  electionType: ElectionType;
  /** 小選挙区名・選挙区名・比例ブロック名など */
  district: string;
  termStatus: "現職" | "引退" | "落選" | "死去";
  officialUrl?: string;
  photo: PhotoPolicy;
  /** データ取得元（出典明記の義務があるソースを追跡するため） */
  sourceRef: string;
}

export type BillSubmitterType = "内閣提出" | "議員立法";

export type BillStatus =
  | "審議中"
  | "可決"
  | "否決"
  | "継続審議"
  | "廃案"
  | "成立";

/** 法案 */
export interface Bill {
  id: string;
  dietSession: number; // 国会回次
  billNumber: string;
  title: string;
  category?: string;
  submitterType: BillSubmitterType;
  house: Chamber | "両院";
  status: BillStatus;
  submittedDate: string; // ISO 8601
  lastUpdated: string; // ISO 8601
  sourceUrl: string;
}

export type BillStage =
  | "提出"
  | "委員会付託"
  | "委員会可決"
  | "委員会否決"
  | "本会議可決"
  | "本会議否決"
  | "成立"
  | "廃案";

/** 法案の審議進捗履歴（差分検知で追記していく想定） */
export interface BillStatusHistory {
  billId: string;
  date: string; // ISO 8601
  stage: BillStage;
  house: Chamber;
  note?: string;
  sourceUrl: string;
}

/** 法案と議員の関連（提出者・賛成会派など） */
export interface BillSponsorship {
  billId: string;
  legislatorId: string;
  role: "提出者" | "賛成会派" | "反対会派";
}

/** 選挙結果（フェーズ1は簡易版） */
export interface ElectionResult {
  legislatorId: string;
  electionYear: number;
  electionType: ElectionType;
  district: string;
  votes: number | null; // 比例代表は個人得票が取れない場合がありnull許容
  rank: number | null;
  totalCandidates: number | null;
  sourceUrl: string;
}

/**
 * 過去選挙の政党別獲得議席数（フェーズ4）。
 *
 * 候補者個人の得票データ（ElectionResult）とは別軸で、選挙ごとの
 * 「政党がいくつ議席を獲得したか」という集計済みの事実データのみを扱う。
 * 候補者名のマッチング問題を回避するため、総務省の集計表またはWikipediaの
 * 選挙結果記事（出典表記が必要）を情報源とする。詳細な調査経緯・出典URLは
 * Obsidian Vault（jp-politics-map/データソース調査.md
 * 「過去選挙の政党別議席数推移（Phase 4）」）を参照。
 */
export interface PartySeatResult {
  /** 当時の政党名（原資料の表記のまま。現在は解散・改名済みの政党も含む） */
  partyName: string;
  /**
   * data/parties.json の id に解決できた場合のみ設定する。
   * 後継関係が曖昧な政党（分裂・合流等）は無理に統合せず null のままにする。
   */
  partyId: string | null;
  seats: number;
}

/** 選挙ごとの政党別獲得議席数（フェーズ4） */
export interface PartySeatHistory {
  chamber: Chamber;
  electionYear: number;
  electionDate: string; // ISO 8601 (YYYY-MM-DD)
  /** 例:「第50回衆議院議員総選挙」「第27回参議院議員通常選挙」 */
  electionName: string;
  /**
   * その選挙で選出された議席の合計（= resultsのseats合計と一致する想定）。
   * 参議院は改選議席数、衆議院は総定数。当日に欠員補充（繰上補充等）を含む
   * 場合はその旨をnoteに記載する。
   */
  totalSeats: number;
  results: PartySeatResult[];
  /** 出典URL（再現性・出典明記のため） */
  sourceUrl: string;
  note?: string;
}

/**
 * NDL国会会議録検索システムAPIによる議員の発言件数（フェーズ4）。
 *
 * 【重要】この値は「本人の発言回数」を保証するものではなく、あくまで参考値。
 * NDL APIのspeakerパラメータは発言者名の部分一致検索であり、完全な人物特定
 * （議員IDでの一意な紐付け）ではないため、同姓同名の別人（引退した元議員・
 * 地方議員・参考人など）の発言も件数に混入しうる。UI表示時は必ず「参考値」
 * である旨を明記すること（isApproximateフィールドで明示）。
 * 本文（発言テキスト）は著作権配慮のため取得・保存していない。
 */
export interface NdlSpeechCount {
  legislatorId: string;
  name: string;
  speechCount: number;
  /** 同姓同名混同のリスクがある参考値であることの明示フラグ（常にtrue） */
  isApproximate: true;
  /** 取得日時 ISO 8601 */
  fetchedAt: string;
  /** 集計に使ったNDL API検索URL（再現性・出典明記のため） */
  sourceUrl: string;
}

/**
 * 質問主意書の提出件数集計（フェーズ4）。
 * 政治的中立性配慮のため、件数の多寡について「良い/悪い」といった評価的な
 * 意味づけ（ランキング表示を前提にした並び順等）はデータ構造として持たせない。
 * あくまで「対象回次の中で何件提出したか」という事実データ。
 */
export interface WrittenQuestionCount {
  legislatorId: string;
  name: string;
  questionCount: number;
  /** 集計対象とした国会回次のうち、実際に1件以上提出があった回次 */
  sessionsCovered: number[];
}

/** 参議院記名投票（押しボタン式投票）における議員個人の賛否（フェーズ4） */
export type RollCallVoteChoice = "賛成" | "反対" | "欠席" | "棄権";

/**
 * 記名投票（押しボタン式投票）1件における議員個人の投票結果。
 * legislatorIdは氏名の正規化照合（空白除去）で一意に解決できた場合のみ設定し、
 * 同姓同名の衝突がある場合は無理にマッチさせずnullのまま氏名(name)だけ保持する。
 * partyIdは投票結果ページに記載された投票当時の会派名を優先してparties.jsonと
 * 照合し、解決できない場合のみlegislators.jsonの現在の所属会派で代替する
 * （会派移動があった議員は投票当時と所属が異なりうる点に注意）。
 */
export interface RollCallVoteResult {
  legislatorId: string | null;
  name: string;
  partyId: string | null;
  vote: RollCallVoteChoice;
}

/**
 * 参議院本会議における記名投票（押しボタン式投票）1件分の結果（フェーズ4）。
 * 衆議院は起立採決が中心で議員個人の賛否が原則公開されないため、この型は
 * 参議院のみを対象にする。
 *
 * 政治的中立性配慮のため、賛否の集計・議員個人の投票結果は取得元ページの
 * 事実をそのまま保持するのみとし、評価的な意味づけ（「良い投票」等の
 * ランキングや当落線的な演出）は一切加えない。
 */
export interface RollCallVote {
  voteId: string;
  session: number; // 国会回次
  date: string; // ISO 8601 (YYYY-MM-DD)
  /** 議案名（「日程第○」等の通し番号は取り除いた表記） */
  subject: string;
  /** bills.json の該当法案。案件名の突合ができなかった場合はnull */
  billId: string | null;
  totalFor: number;
  totalAgainst: number;
  results: RollCallVoteResult[];
  /** 取得元の投票結果ページURL（出典明記・再検証のため） */
  sourceUrl: string;
}

/** 都道府県マスタ（JIS都道府県コード） */
export interface Prefecture {
  code: string; // JIS X 0401 (2桁)
  name: string;
}

/**
 * 選挙区・比例ブロック→都道府県の対応表。
 * 小選挙区は都道府県より細かい単位、比例ブロックは複数県にまたがる単位のため
 * 「都道府県⇔議員」は多対多関係になる前提。
 */
export interface DistrictPrefectureMap {
  district: string;
  electionType: ElectionType;
  prefectureCodes: string[];
}

/**
 * フェーズ3（地方議会パイロット）の地方議会議員。
 * 全国35,000人超を対象にした共通モデルではなく、パイロット自治体（当面は
 * 東京都議会）に限定した簡易モデル。対象拡大時に見直す前提。
 */
export interface LocalAssemblyMember {
  id: string;
  /** 例:"東京都議会" */
  assembly: string;
  /** 都道府県の正式名称（src/lib/prefectures.tsのPREFECTURE_CODESキーと一致） */
  prefecture: string;
  /**
   * 選挙区名（例:"港区"、複数市区町村にまたがる合区は"北多摩第一"等の
   * 選挙区名そのまま）。地図上での市区町村への展開はsrc/lib/localAssembly.ts
   * の対応表で行う（1選挙区が複数市区町村にまたがることがあるため）
   */
  district: string;
  name: string;
  nameKana?: string;
  partyName: string;
  termStatus: "現職" | "引退" | "落選" | "死去";
  officialUrl?: string;
  sourceRef: string;
}

/**
 * 都道府県別・地方財政データ（Phase 4）。
 * 総務省「地方財政状況調査」（e-Stat経由、都道府県分・表02「決算収支の状況」）を
 * 情報源とする決算ベースの数値。単位はすべて千円（e-Statの原表どおり）。
 * `prefecture`はsrc/lib/prefectures.tsの`PREFECTURE_CODES`のキー（都道府県の正式名称）
 * と一致する。
 */
export interface PrefectureFinance {
  /** 都道府県の正式名称（例:"東京都"） */
  prefecture: string;
  /** 決算年度（西暦、例:2024 は「令和6年度」決算） */
  fiscalYear: number;
  /** 歳入総額（千円） */
  totalRevenueThousandYen: number;
  /** 歳出総額（千円） */
  totalExpenditureThousandYen: number;
  /** 実質収支（千円）。歳入歳出差引から翌年度繰越財源を控除した実質的な収支 */
  realBalanceThousandYen: number;
  /** データ取得元CSVのURL（出典明記のため保持） */
  sourceUrl: string;
}

/**
 * 都道府県別・総人口データ（予算の見える化 Phase A-2の前提データ）。
 * 総務省統計局「人口推計」（e-Stat経由、各年10月1日現在・総人口・男女計）を
 * 情報源とする。`prefecture`はsrc/lib/prefectures.tsの`PREFECTURE_CODES`の
 * キー（都道府県の正式名称）と一致する。
 *
 * 【注意】原表が千人単位で丸められているため、`population`も1000人単位の
 * 概算値（末尾3桁は常に000）。1人当たり歳出等の概算用途では十分だが、
 * 厳密な人口統計としては住民基本台帳人口等の方が精度が高い点に留意する。
 */
export interface PrefecturePopulation {
  /** 都道府県の正式名称（例:"東京都"） */
  prefecture: string;
  /** 人口の基準年（西暦、各年10月1日現在） */
  year: number;
  /** 総人口（人）。原表の千人単位を1000倍した概算値 */
  population: number;
  /** データ取得元ExcelのURL（出典明記のため保持） */
  sourceUrl: string;
}

/** 目的別歳出の1区分（例:"教育費"）とその金額 */
export interface PrefectureExpenditureCategory {
  /** 総務省の目的別歳出分類の名称（原表の表記のまま。独自の言い換えはしない） */
  name: string;
  /** 当該区分の歳出合計額（千円） */
  amountThousandYen: number;
}

/**
 * 都道府県別・目的別歳出データ（予算の見える化 Phase A-2）。
 * 総務省「地方財政状況調査」（e-Stat経由、都道府県分・表07〜表12
 * 「歳出内訳及び財源内訳（その1）〜（その6）」の「歳出合計」行）を
 * 情報源とする決算ベースの数値。単位はすべて千円（e-Statの原表どおり）。
 * `categories`の金額を合計すると、同一都道府県・同一fiscalYearの
 * PrefectureFinance.totalExpenditureThousandYenとほぼ一致する
 * （取得スクリプトの調査時点で北海道は完全一致を確認済み）。
 */
export interface PrefectureExpenditureByPurpose {
  /** 都道府県の正式名称（例:"東京都"） */
  prefecture: string;
  /** 決算年度（西暦、例:2024 は「令和6年度」決算） */
  fiscalYear: number;
  /** 目的別歳出の内訳（総務費・民生費・土木費・教育費等） */
  categories: PrefectureExpenditureCategory[];
  /** データ取得元CSV群のURL（複数表にまたがるため配列。出典明記のため保持） */
  sourceUrls: string[];
}

/**
 * 都道府県別・性質別歳出データ（予算の見える化 Phase B）。
 * 総務省「地方財政状況調査」（e-Stat経由、都道府県分・表15「歳出の状況
 * その１　性質別経費の状況」の性質別大区分12行）を情報源とする決算ベースの
 * 数値。単位はすべて千円（e-Statの原表どおり）。
 *
 * 【単年度のみの収録】表15は取得スクリプトの調査時点（2026-08-11）で
 * 単年度分（令和6年度＝2024年度決算）のみを収録しており、PrefectureFinanceの
 * 情報源表のような複数年度の横持ちはない（詳細はfetch-prefecture-expenditure-
 * by-nature.tsのコメント参照）。
 *
 * 【PrefectureFinance/PrefectureExpenditureByPurposeとの合計差異】
 * `categories`の金額合計は表15自身の「歳出合計」行と一致するが、表15は
 * 「都道府県が徴収した税の一部を市町村へ交付する経費」（利子割交付金・
 * 地方消費税交付金等）を対象外としているため、
 * PrefectureFinance.totalExpenditureThousandYenや
 * PrefectureExpenditureByPurposeの目的別合計より少ない値になる
 * （調査時点で北海道は約1,736億円少ないことを確認済み。総務省の
 * 「性質別経費」分類そのものの仕様であり、データの欠落や誤りではない）。
 */
export interface PrefectureExpenditureByNature {
  /** 都道府県の正式名称（例:"東京都"） */
  prefecture: string;
  /** 決算年度（西暦、例:2024 は「令和6年度」決算） */
  fiscalYear: number;
  /** 性質別歳出の内訳（人件費・物件費・維持補修費・扶助費・補助費等・公債費・
   * 積立金・投資及び出資金・貸付金・繰出金・前年度繰上充用金・投資的経費の
   * 12区分、原表の名称のまま。相互に排他的で合計すると表15の「歳出合計」に一致する） */
  categories: PrefectureExpenditureCategory[];
  /** データ取得元CSVのURL（出典明記のため保持） */
  sourceUrl: string;
}

/**
 * 都道府県別・財政健全化指標データ（予算の見える化 Phase B）。
 * 総務省「主要財政指標一覧」（都道府県分、決算年度ベース）を情報源とする。
 * `prefecture`はsrc/lib/prefectures.tsのPREFECTURE_CODESのキー（都道府県の
 * 正式名称）と一致する。
 *
 * 【政治的中立性についての注記】
 * ここでの各指標値は「悪い/良い」という評価を含まない客観的な実測値。
 * 評価軸として公式基準値と並べて提示する場合は`FINANCIAL_HEALTH_STANDARDS`
 * （本ファイル内で定義）を参照すること。財政力指数・経常収支比率には
 * 法律上の公式基準値が存在しないため、実測値のみを保持する。
 */
export interface PrefectureFinancialHealth {
  /** 都道府県の正式名称（例:"東京都"） */
  prefecture: string;
  /** 決算年度（西暦、例:2024 は「令和6年度」決算） */
  fiscalYear: number;
  /**
   * 財政力指数（直近3か年度平均、無単位の比率）。基準財政収入額÷基準財政需要額。
   * 1に近い、または1を超えるほど自主財源による歳出充当力が高いことを示す。
   * 法律上の公式基準値は存在しない。
   */
  financialStrengthIndex: number;
  /**
   * 経常収支比率（%）。人件費・扶助費・公債費等の経常的経費に、地方税・
   * 地方交付税等の経常一般財源がどれだけ充当されているかを示す。
   * 一般に数値が低いほど財政の弾力性が高いとされるが、法律上の公式基準値は
   * 存在しない（70〜80%程度が望ましいという慣行的な目安が語られることは
   * あるが、法定基準ではないため本データには基準値を持たせていない）。
   */
  currentBalanceRatio: number;
  /**
   * 実質公債費比率（%、直近3か年度平均）。公債費（借入金の返済額）による
   * 財政負担の重さを示す指標。「地方公共団体の財政の健全化に関する法律」に
   * 基づく早期健全化基準・財政再生基準の対象指標（`FINANCIAL_HEALTH_STANDARDS`
   * 参照）。
   */
  realDebtServiceRatio: number;
  /**
   * 将来負担比率（%）。地方債残高等、将来負担すべき実質的な負債の大きさを
   * 示す指標。同法に基づく早期健全化基準の対象指標（将来負担比率には
   * 財政再生基準は設定されていない）。データがない場合はnull（今回取得した
   * 47都道府県はいずれも実測値ありだが、将来的な様式変更等に備えて許容する）。
   */
  futureBurdenRatio: number | null;
  /** データ取得元Excelファイルの URL（出典明記のため保持） */
  sourceUrl: string;
}

/**
 * 財政健全化判断比率の公式基準値（都道府県分）。
 * 「地方公共団体の財政の健全化に関する法律」（平成19年法律第94号）及び
 * 同法施行令に基づく、早期健全化基準・財政再生基準。
 *
 * 出典: 総務省「早期健全化基準と財政再生基準」
 * https://www.soumu.go.jp/iken/zaisei/kenzenka/index3.html （2026-08-11確認）
 *
 * 【政治的中立性についての注記】
 * この基準値は「財政健全化計画」（早期健全化基準以上で策定義務）・
 * 「財政再生計画」（財政再生基準以上で策定義務）という法律上の手続きが
 * 発生する水準を示す客観的事実であり、UI側では実測値と並べて中立的に
 * 提示すること。基準未満だから「健全」・以上だから「不健全」と断定する
 * 評価語をデータ側・UI側とも用いないこと。
 *
 * 財政力指数・経常収支比率には法律上の公式基準値が存在しないため、
 * この定数には含まれていない。将来負担比率には財政再生基準が
 * 設定されていない（`reconstructionThreshold: null`）。
 * なお将来負担比率の基準は都道府県及び政令指定都市で400%、市町村
 * （政令指定都市を除く）は350%であり、本プロジェクトは都道府県分のみを
 * 扱うため都道府県分の基準値のみを保持する。
 */
export const FINANCIAL_HEALTH_STANDARDS = {
  /** 実質公債費比率（%）。都道府県・市町村共通の基準値 */
  realDebtServiceRatio: {
    /** 早期健全化基準（%）。以上で「財政健全化計画」の策定が義務付けられる */
    earlyWarningThreshold: 25,
    /** 財政再生基準（%）。以上で「財政再生計画」の策定が義務付けられる */
    reconstructionThreshold: 35,
  },
  /** 将来負担比率（%）。都道府県・政令指定都市の基準値（市町村は350%で異なる） */
  futureBurdenRatio: {
    /** 早期健全化基準（%） */
    earlyWarningThreshold: 400,
    /** 将来負担比率には財政再生基準が設定されていない */
    reconstructionThreshold: null as number | null,
  },
} as const;
