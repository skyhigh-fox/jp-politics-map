/**
 * フェーズ1（国会議員＋法案審議進捗）のデータモデル型定義。
 * 詳細設計の経緯はObsidian Vault（jp-politics-map/決定事項ログ.md）を参照。
 */

export type Chamber = "衆議院" | "参議院";

export type ElectionType = "小選挙区" | "比例代表" | "選挙区" | "比例代表(参院)";

/**
 * 院ごとの会派プロフィール。
 *
 * 【重要】「会派」は衆議院・参議院それぞれの院で別個に届け出られる院内グループであり、
 * 同じ政党を母体にしていても院によって正式名称・略称・所属議員数がすべて異なる
 * （例: 国民民主党は衆議院では「国民民主党・無所属クラブ」、参議院では
 * 「国民民主党・新緑風会」。無所属議員は衆議院では「無所属」、参議院では
 * 「各派に属しない議員」と表記される）。
 * また、片方の院にしか存在しない会派もある（衆議院の「中道改革連合・無所属」、
 * 参議院の「公明党」「れいわ新選組」等）。
 *
 * 名称・略称・所属議員数は各院の公式サイトの表記をそのまま保持し、
 * 独自の言い換えや推測による補完はしない。
 */
export interface PartyChamberProfile {
  /** その院での会派正式名称（各院公式サイトの表記のまま） */
  name: string;
  /** その院での会派略称（各院公式サイトの表記のまま） */
  abbreviation?: string;
  /**
   * 各院が公表している会派別所属議員数。
   * legislators.json 側の実カウントとの検算に使う（取得スクリプトが自動照合する）。
   */
  memberCount?: number;
  /** 会派名・所属議員数の基準日（原典に記載がある場合のみ。ISO 8601 YYYY-MM-DD） */
  asOf?: string;
  /** その院の会派一覧の出典URL（出典明記・再検証のため） */
  sourceUrl?: string;
}

/**
 * 政党・会派マスタ。
 *
 * 1レコード = 「衆参をまたいで同一とみなせる政党・勢力」1つ。
 * 実際に議員が所属するのは院ごとの「会派」であり、その院別の正式名称は
 * `chambers` に院ごとに保持する（背景は PartyChamberProfile のコメント参照）。
 *
 * 【このデータモデルにした経緯（2026-08-11 の重大なデータ品質バグ修正）】
 * 以前は院の区別を持たない単一の name しか持たず、かつ参議院側の取得スクリプトが
 * 後勝ちで name を上書きしていたため、衆議院議員にも参議院の会派名が表示されていた
 * （衆議院の「国民民主党・無所属クラブ」28名が「国民民主党・新緑風会」と誤表示される等）。
 * 院ごとに異なる会派名を、それぞれの院の一次情報のまま保持できるようにするのが
 * `chambers` フィールドの目的。
 */
export interface Party {
  id: string;
  /**
   * 衆参をまたいで使う共通表示名（＝母体となる政党・勢力の名称）。
   * 院が特定できる文脈では、必ず `chambers[chamber].name`（その院の正式会派名）を
   * 優先して表示すること（src/lib/party.ts の partyDisplayName を使う）。
   */
  name: string;
  /** 共通表示用の略称。院別の略称は `chambers[chamber].abbreviation` を参照する */
  abbreviation?: string;
  /** 政党の公式カラー。中立性配慮のため、良し悪しの含意を持たせず公式カラーをそのまま採用する */
  color?: string;
  /**
   * 院ごとの会派プロフィール。その院に会派が存在しない場合はキー自体を持たない
   * （＝「衆議院に立憲民主党の会派がない」といった事実をデータ構造で表現する）。
   */
  chambers?: Partial<Record<Chamber, PartyChamberProfile>>;
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

/**
 * 法案の提出者・賛成者として名を連ねた個人1名（機能拡充ロードマップ Tier1 #3）。
 *
 * 氏名は衆議院の議案経過情報の表記のまま（敬称「君」を含む）保持する。
 * legislatorIdは氏名の名寄せ（src/lib/nameMatch.ts）で現職議員マスタ
 * （data/legislators.json）に一意に解決できた場合のみ設定し、解決できない場合は
 * 誤結合を避けてnullのまま氏名だけを残す。収録している議案は第139回国会以降の
 * 全期間にわたるため、提出者の多くは既に引退・落選した元議員であり、
 * nullになるのが通常の状態である（データの欠落ではない）。
 */
export interface BillSponsorPerson {
  /** 原資料（衆議院の議案経過情報）の表記のままの氏名。敬称「君」を含む */
  name: string;
  /** data/legislators.json の議員に一意に照合できた場合のみ設定。それ以外はnull */
  legislatorId: string | null;
}

/**
 * 法案に関係する会派1つ（提出会派・衆議院審議時の賛成/反対会派）。
 *
 * 会派名は提出・審議「当時」の名称であり、解散・改称・合流した会派が多数を占める。
 * partyIdは現在の政党マスタ（data/parties.json）に無理なく照合できた場合のみ設定し、
 * 後継関係が曖昧な会派（合同会派・分裂した政党など）はnullのまま当時の名称を保持する
 * （PartySeatResult.partyId と同じ方針）。
 */
export interface BillSponsorParty {
  /** 原資料の表記のままの会派名（提出・審議当時の名称） */
  name: string;
  /** data/parties.json の政党に照合できた場合のみ設定。それ以外はnull */
  partyId: string | null;
}

/**
 * 法案の提出者・提出会派・衆議院審議時の賛成/反対会派（機能拡充ロードマップ Tier1 #3）。
 *
 * 情報源は衆議院の議案経過情報（SmartNews メディア研究所「国会議案データベース：
 * 衆議院」の gian.json 経由）。取得スクリプトは scripts/fetch-bill-sponsorships.ts。
 *
 * 【型を作り直した経緯】
 * 当初は `{ billId, legislatorId, role: "提出者" | "賛成会派" | "反対会派" }` という
 * 1関連=1レコードの形で宣言していた（データ・取得スクリプトは未実装のまま）。
 * しかし原資料の「賛成会派」「反対会派」は議員個人ではなく会派単位の情報であり、
 * legislatorIdでは表現できない。また提出者の大半は現職議員マスタに存在しない
 * 元議員で、legislatorIdを必須にすると大半のレコードを捨てることになる。
 * そのため「法案1件＝1レコード」で、人と会派を別フィールドに持つ形に変更した。
 *
 * 【政治的中立性についての注記（重要）】
 * ここに持つのは「その法案を誰が提出し、どの会派が賛成・反対したか」という
 * 原資料の事実の転記のみ。議員間の共同提案ネットワーク図や、会派態度から
 * イデオロギー・スコアのような合成指標を作ることはしない（提出者に名を
 * 連ねる理由は多様であり、政治的立場の指標として扱うと誤導になるため）。
 */
export interface BillSponsorship {
  /** data/bills.json の Bill.id */
  billId: string;
  /**
   * 議案経過情報の「議案提出者」欄の原文。
   * 例:「熊代　昭彦君外四名」「内閣」。内閣提出法案・予算等では「内閣」になる。
   */
  submitterLabel: string | null;
  /** 「議案提出者一覧」欄の議員（＝発議者）。衆法・決議案等でのみ記載がある */
  sponsors: BillSponsorPerson[];
  /**
   * 「議案提出の賛成者」欄の議員。
   * 議員立法の発議に必要な賛成者（国会法第56条）として名を連ねた議員であり、
   * 本会議での賛否とは別のもの。
   */
  supporters: BillSponsorPerson[];
  /** 「議案提出会派」欄の会派 */
  submitterParties: BillSponsorParty[];
  /**
   * 「衆議院審議時会派態度」欄。実データで確認できた値は
   * 「全会一致」「多数」「少数」の3種類だが、原資料の表記をそのまま保持するため
   * 文字列型にしている（記載がない場合はnull）。
   */
  houseVoteStance: string | null;
  /** 「衆議院審議時賛成会派」欄の会派（参議院審議時の会派態度は原資料に無い） */
  approvingParties: BillSponsorParty[];
  /** 「衆議院審議時反対会派」欄の会派 */
  opposingParties: BillSponsorParty[];
  /** 転記元とした議案経過情報ページのURL（出典明記・再検証のため） */
  sourceUrl: string;
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
 * 地方公共団体の議会・長の「所属党派別人員調」（機能拡充ロードマップ Tier1 #6）で
 * 集計対象となる団体の区分。総務省の原表のシート名（＝表題）をそのまま用いる。
 *
 * 「議会」の3区分（都道府県議会・市区議会・町村議会）と、「長」の3区分
 * （都道府県知事・市区長・町村長）で意味が大きく異なる（長は1団体1名の
 * 独任制であり、議席構成という概念がない）ため、UI側でも別グループとして扱う。
 */
export type LocalGovernmentBodyType =
  | "都道府県知事"
  | "都道府県議会"
  | "市区長"
  | "市区議会"
  | "町村長"
  | "町村議会";

/** 議会・長の区分が「議会」か「長」かの分類（UIのグループ分け用） */
export const LOCAL_ASSEMBLY_BODY_TYPES: LocalGovernmentBodyType[] = [
  "都道府県議会",
  "市区議会",
  "町村議会",
];
export const LOCAL_EXECUTIVE_BODY_TYPES: LocalGovernmentBodyType[] = [
  "都道府県知事",
  "市区長",
  "町村長",
];

/** 所属党派別人員調の1党派分（原表の1党派グループ＝男/女/計の3列に対応） */
export interface LocalPartyCount {
  /**
   * 党派名。総務省の原表のヘッダー表記そのまま（例:"自由民主党"、"諸派"、"無所属"）。
   * 独自の言い換え・略称化はしない。
   */
  name: string;
  /**
   * data/parties.json の政党id（例:"party-自民"）。原表の党派名が政党マスタの
   * 共通表示名（scripts/lib/partyColors.ts の PARTY_CANONICAL_NAMES）に
   * 一致しない場合はnull。現行データでは「諸派」（複数の少数政党をまとめた
   * 原表側のカテゴリで、単一政党ではない）のみがnullになる。
   */
  partyId: string | null;
  /**
   * 人員数。原表の党派グループの「計」列の値をそのまま用いる。
   * 【重要】原表には「性別非公表の議員がいるため、男女の計と計が一致しない
   * 箇所がある」という注記があり、男+女で再計算すると原表と食い違うため、
   * 必ず「計」列を採用する（男女別の内訳は本データセットのスコープ外）。
   */
  count: number;
}

/** 1都道府県・1区分（例:「東京都」の「市区議会」）の党派別人員 */
export interface LocalPartyCompositionBody {
  bodyType: LocalGovernmentBodyType;
  /** 原表シートの表題（例:"（２）都道府県議会議員の所属党派別人員調"） */
  sourceTableTitle: string;
  /** 定数（条例定数の合計。区分内の全団体分の合計） */
  fixedNumber: number;
  /** 現員（原表の「合計」グループの「計」列） */
  totalMembers: number;
  /** 欠員（原表の「欠員」列） */
  vacancies: number;
  /** 党派別の人員。並び順は原表の列の掲載順のまま（人数順に並べ替えない） */
  parties: LocalPartyCount[];
}

/**
 * 都道府県別・地方議会及び長の党派別構成（機能拡充ロードマップ Tier1 #6）。
 *
 * 情報源: 総務省「地方公共団体の議会の議員及び長の所属党派別人員調」
 * （毎年12月31日現在。都道府県ごと・党派ごとの人員数の集計表）
 *
 * 【LocalAssemblyMember との違い（重要）】
 * LocalAssemblyMember は「議員個人の名簿」（東京都議会のパイロット1議会のみ）
 * であるのに対し、こちらは「党派別の人員数の集計」であり議員個人は含まない。
 * その代わり47都道府県すべて・都道府県議会/市区議会/町村議会/各長の全区分を
 * カバーする。両者は代替関係ではなく、粒度の異なる別データセットとして扱う。
 *
 * 【政治的中立性についての注記】
 * - 党派名・並び順・人員数は原表のとおりに保持し、独自の再分類・再集計はしない。
 * - 都道府県間の比較・ランキングは行わない（この型にも順位を持たせない）。
 * - 男女別の内訳は原表に存在するが、女性議員比率等の指標化は本データセットの
 *   スコープ外としているため保持しない（別途の機能として検討する）。
 */
export interface LocalAssemblyPartyComposition {
  /** 都道府県の正式名称（例:"東京都"。PREFECTURE_CODESのキーと一致） */
  prefecture: string;
  /** 調査基準日（YYYY-MM-DD。原資料は毎年12月31日現在） */
  asOfDate: string;
  /** 区分別の党派別人員（原表のシート順） */
  bodies: LocalPartyCompositionBody[];
  /** 取得元Excelファイルの URL（出典明記のため保持） */
  sourceUrl: string;
  /** 取得元Excelが掲載されている総務省のページ（出典明記のため保持） */
  sourcePageUrl: string;
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

/**
 * 国の税収・歳出データ（機能拡充ロードマップ Tier1 #2「国の税収・歳出ビューア」）。
 * 財務省の公表Excel（税収の推移／財政統計 第4表・第20表・第24表）を情報源とする。
 * 取得スクリプトは `scripts/fetch-national-budget.ts`。
 *
 * 【政治的中立性についての注記（重要）】
 * - 区分名は財務省の公式分類（主要科目別・主要経費別・目的別）の表記を
 *   そのまま保持する。独自の再集約・言い換えはしない。
 * - 一般会計はノンアフェクタシオンの原則（特定の歳入を特定の歳出に紐づけない）
 *   で運用されるため、税目と経費を結ぶフロー（サンキー図）は作らない。
 * - 公債金は歳入の一科目として他の科目と同等に扱う（税収との乖離を強調する
 *   単独グラフは作らない）。
 * - 「無駄」「削減余地」等の評価語は用いない。単年度の絶対額だけでなく
 *   必ず年度推移を併置して表示する。
 */
export interface NationalBudgetItem {
  /** 区分名（財務省の分類表記そのまま。例:"社会保障関係費"） */
  name: string;
  /** 金額（千円）。原表で「−」等の該当なし表記だった場合はnull */
  amountThousandYen: number | null;
  /** 原表で内訳（細目）が示されている区分のみ、その明細を保持する */
  subItems?: NationalBudgetItem[];
}

/** 国の予算・決算データの1年度分 */
export interface NationalBudgetYear {
  /** 年度（西暦。例:2024 は「令和6年度」） */
  fiscalYear: number;
  /** 元号表記（例:"令和6年度"）。原資料の年度表記に合わせた表示用 */
  eraLabel: string;
  /** 原表に記載された合計額（千円）。内訳の単純合計と一致しない年度もある */
  totalThousandYen: number | null;
  /** 区分別の内訳（原資料の掲載順） */
  items: NationalBudgetItem[];
  /**
   * 決算額かどうか。falseの場合は決算が確定していない年度の予算額
   * （税収の推移表は決算確定年度より先の年度を含むため区別が必要）。
   */
  isSettlement: boolean;
}

/** 国の予算・決算データの1系列（＝財務省の1つの統計表） */
export interface NationalBudgetSeries {
  /** 系列の表示名（例:"一般会計歳出決算 主要経費別"） */
  title: string;
  /** 出典の正式名称（表番号を含む） */
  sourceTitle: string;
  /** 出典Excelの直リンク */
  sourceUrl: string;
  /** 出典Excelが掲載されている財務省のページ */
  sourcePageUrl: string;
  /** 原資料の金額単位（JSON上の金額はすべて千円に統一済み。出典表記用） */
  sourceUnit: string;
  /** 金額の性格（"決算額" / "税収"）。冒頭の但し書きに使う */
  amountKind: string;
  /** 全年度を通じた区分名の掲載順（原資料の順） */
  categoryNames: string[];
  /** 年度昇順 */
  years: NationalBudgetYear[];
}

/** data/national-budget.json のルート */
export interface NationalBudget {
  generatedAt: string;
  /** 決算が確定している最新年度（西暦）。歳入決算（第4表）の最新年度 */
  latestSettlementFiscalYear: number;
  /** 税収の推移（税目別。所得税・法人税・消費税＋その他の税収） */
  taxRevenue: NationalBudgetSeries;
  /** 一般会計歳入 主要科目別決算（租税及印紙収入・公債金・雑収入等） */
  revenueByMajorItem: NationalBudgetSeries;
  /** 一般会計歳出決算 主要経費別（社会保障関係費・国債費・地方交付税交付金等） */
  expenditureByMajorExpense: NationalBudgetSeries;
  /** 一般会計歳出決算 目的別（国家機関費・地方財政費・社会保障関係費等） */
  expenditureByPurpose: NationalBudgetSeries;
}

/**
 * 投票率（%）の男女別内訳。原資料（総務省の選挙結果調）が
 * 「男・女・計」の3区分で公表しているため、その3区分をそのまま保持する。
 *
 * 【注記】原資料の区分は選挙人名簿上の性別によるもので、本サイトが独自に
 * 分類したものではない。原資料の値が欠けている場合はnull。
 */
export interface TurnoutRates {
  /** 男（%） */
  male: number | null;
  /** 女（%） */
  female: number | null;
  /** 計（%）。男女を合算した全体の投票率 */
  total: number | null;
}

/** 都道府県1件分の投票率（男女別・計） */
export interface PrefectureTurnoutEntry extends TurnoutRates {
  /** 都道府県の正式名称（例:"東京都"）。PREFECTURE_CODESのキーと一致する */
  prefecture: string;
}

/**
 * 1回の国政選挙分の都道府県別投票率（機能拡充ロードマップ Tier1 #7）。
 *
 * データソース: 総務省「選挙関連資料」の各回選挙結果調に含まれる
 * 「都道府県別投票率（小選挙区）」（衆議院）/
 * 「都道府県別有権者数、投票者数、投票率（選挙区）（比較）」（参議院）のExcel。
 *
 * 【政治的中立性についての注記】
 * 投票率は「高いほど良い」「低いほど関心が低い」といった評価を含まない
 * 客観的な実測値である。UI側では順位付けをせず、全国計との比較と
 * 時系列の推移という中立的な提示に留めること。
 */
export interface PrefectureTurnoutElection {
  /** 一意キー（例:"shugiin-51"・"sangiin-27"） */
  id: string;
  /** 院（"衆議院" / "参議院"） */
  chamber: "衆議院" | "参議院";
  /** 回次（例:51） */
  round: number;
  /** 表示名（例:"第51回衆議院議員総選挙"） */
  electionName: string;
  /** 投票日（YYYY-MM-DD） */
  electionDate: string;
  /**
   * 投票率の対象となる投票の種類（衆議院は"小選挙区"、参議院は"選挙区"）。
   * 同じ選挙でも比例代表の投票率はごくわずかに異なるため、どちらの数値かを明示する。
   */
  votingCategory: "小選挙区" | "選挙区";
  /** 全国計の投票率（原資料の「計」行） */
  national: TurnoutRates;
  /** 都道府県別（47件、都道府県コード順） */
  prefectures: PrefectureTurnoutEntry[];
  /** データ取得元Excelファイルの URL（出典明記のため保持） */
  sourceUrl: string;
  /** 上記Excelが掲載されている総務省のページ */
  sourcePageUrl: string;
}

/**
 * 首長（地方公共団体の長）の区分。
 * 総務省「地方公共団体の長の連続就任回数調」の
 * 「(1)知事及び政令指定都市長の連続就任回数調」の表が持つ2区分に対応する。
 */
export type LocalExecutiveType = "都道府県知事" | "指定都市市長";

/**
 * 首長1名分（機能拡充ロードマップ Tier1 #8）。
 *
 * 【政治的中立性についての注記】
 * `consecutiveTerms`（連続就任回数）は原表の項目をそのまま保持した事実の数値。
 * 多選・長期在任の是非についての含意は持たせず、都道府県間の順位付けもしない。
 */
export interface LocalExecutive {
  /** 都道府県の正式名称（例:"神奈川県"）。PREFECTURE_CODESのキーと一致する */
  prefecture: string;
  type: LocalExecutiveType;
  /** 団体名（都道府県知事なら都道府県名、指定都市市長なら市名） */
  bodyName: string;
  /** 氏名（原表の表記のまま。姓名の間に全角スペースが複数入ることがある） */
  name: string | null;
  /** 表示用の氏名（連続する空白を全角スペース1つに畳んだもの） */
  displayName: string | null;
  /** 照合用の正規化キー（src/lib/nameMatch.ts の normalizeNameKey） */
  nameKey: string | null;
  /**
   * 任期満了年月日（YYYY-MM-DD）。原表に記載がない場合はnull。
   * 【重要】解散・辞職・失職等があれば変動する予定日であり、確定した選挙期日
   * ではない。UI側では必ず推定であることを明示する。
   */
  termEndDate: string | null;
  /** 連続就任回数（原表の「就任回数」欄）。記載がない場合はnull */
  consecutiveTerms: number | null;
}

/**
 * 都道府県1件分の首長データ（機能拡充ロードマップ Tier1 #8）。
 *
 * 情報源: 総務省「地方公共団体の長の連続就任回数調」
 * （毎年12月31日現在。知事及び政令指定都市長の氏名・任期満了年月日・就任回数）
 *
 * 【収録範囲】
 * 原表が氏名・任期満了日を個人単位で持つのは知事と指定都市市長のみで、
 * その他の市区長・町村長は「連続就任回数ごとの人数分布」としてしか
 * 公表されていないため、本データセットには含まれない。
 *
 * 【政治的中立性についての注記】
 * 都道府県ごとに独立したレコードとして持ち、全国横断で並べ替えられる
 * 集計値（連続就任回数が最も多い知事など）は持たせない。
 */
export interface PrefectureExecutives {
  /** 都道府県の正式名称（例:"東京都"） */
  prefecture: string;
  /** 調査基準日（YYYY-MM-DD。原資料は毎年12月31日現在） */
  asOfDate: string;
  /** 知事。原表の欄が空欄だった場合はnull */
  governor: LocalExecutive | null;
  /** 当該都道府県内の指定都市の市長（指定都市がない県では空配列） */
  designatedCityMayors: LocalExecutive[];
  /** データ取得元Excelファイルの URL（出典明記のため保持） */
  sourceUrl: string;
  /** 上記Excelが掲載されている総務省のページ */
  sourcePageUrl: string;
}

