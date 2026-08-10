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
