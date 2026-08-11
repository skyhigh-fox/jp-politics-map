import type {
  LocalExecutive,
  PrefectureExecutives,
} from "@/types";

/**
 * 首長の任期満了日から「次の選挙の見込み時期」を算出するモジュール
 * （機能拡充ロードマップ Tier1 #8「知事・首長データベース＋選挙カレンダー」）。
 *
 * 【確定と推定の区別（重要）】
 * 総務省の原資料が持っているのは「調査基準日時点の任期満了年月日」であり、
 * 選挙期日そのものではない。任期満了による選挙の期日は、公職選挙法第33条第2項が
 * 「任期満了の日前三十日以内に行う」と定めているため、任期満了日から
 * 「いつ頃の選挙になるか」の**範囲**までは機械的に導ける。一方で、
 *   - 辞職・失職・死亡による退職（同法第34条の選挙）
 *   - リコール（解職請求）の成立
 * があった場合は任期満了日そのものが変わるため、算出結果は必ず
 * 「見込み」として提示し、確定した期日として扱わない。
 *
 * 【政治的中立性についての注記】
 * - 連続就任回数は原資料の事実の数値としてのみ扱い、多選・長期在任についての
 *   評価的な含意（是非・問題視）を持ち込まない。
 * - 都道府県間の比較・ランキングは行わない。この関数群はすべて
 *   「1都道府県分のレコード」を入力とし、全国を横断する集計を提供しない。
 */

/**
 * 任期満了による選挙が行われる期間の長さ（日）。
 * 公職選挙法第33条第2項「地方公共団体の議会の議員及び長の任期満了に因る選挙は、
 * 任期満了の日前三十日以内に行う」による。
 */
export const TERM_EXPIRY_ELECTION_WINDOW_DAYS = 30;

/** 根拠条文の表示用ラベル（UIの注記で使う） */
export const TERM_EXPIRY_ELECTION_LAW_NOTE =
  "公職選挙法第33条第2項（任期満了による選挙は任期満了の日前30日以内に行う）";

export interface ExecutiveElectionSchedule {
  executive: LocalExecutive;
  /** 表示用の選挙名（例:"神奈川県知事選挙"・"横浜市長選挙"） */
  electionName: string;
  /** 任期満了日（YYYY-MM-DD）。原資料に記載がない場合はnull */
  termEndDate: string | null;
  /** 任期満了による選挙が行われる期間の始期（任期満了日の30日前） */
  windowStartDate: string | null;
  /** 同・終期（＝任期満了日） */
  windowEndDate: string | null;
  /** 基準日（サイトの更新時点）で任期満了日を過ぎているか */
  isPastDue: boolean;
}

/** 選挙名を作る。原資料の団体名に区分の呼称を付けるだけで、独自の言い換えはしない */
export function executiveElectionName(executive: LocalExecutive): string {
  return executive.type === "都道府県知事"
    ? `${executive.bodyName}知事選挙`
    : `${executive.bodyName}長選挙`;
}

/** 首長の肩書（例:"神奈川県知事"・"横浜市長"） */
export function executiveTitle(executive: LocalExecutive): string {
  return executive.type === "都道府県知事"
    ? `${executive.bodyName}知事`
    : `${executive.bodyName}長`;
}

/** YYYY-MM-DD を UTC 基準の Date にする（タイムゾーンによるずれを避ける） */
function parseIsoDate(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(iso: string, days: number): string | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Date を YYYY-MM-DD（日本時間の暦日）にする */
export function toIsoDateInJst(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** 1名分の選挙見込みを算出する */
export function buildExecutiveElectionSchedule(
  executive: LocalExecutive,
  referenceIsoDate: string
): ExecutiveElectionSchedule {
  const termEndDate = executive.termEndDate;
  return {
    executive,
    electionName: executiveElectionName(executive),
    termEndDate,
    windowStartDate: termEndDate
      ? addDays(termEndDate, -TERM_EXPIRY_ELECTION_WINDOW_DAYS)
      : null,
    windowEndDate: termEndDate,
    isPastDue: termEndDate !== null && termEndDate < referenceIsoDate,
  };
}

/**
 * 1都道府県分の選挙カレンダー（知事＋その県内の指定都市市長）を
 * 任期満了日の早い順に並べて返す。任期満了日が不明なものは末尾。
 *
 * 「早い順」は時系列の並びであり、団体間の優劣を示すものではない。
 */
export function buildPrefectureElectionCalendar(
  record: PrefectureExecutives,
  referenceIsoDate: string
): ExecutiveElectionSchedule[] {
  const executives: LocalExecutive[] = [
    ...(record.governor ? [record.governor] : []),
    ...record.designatedCityMayors,
  ];
  return executives
    .map((e) => buildExecutiveElectionSchedule(e, referenceIsoDate))
    .sort((a, b) => {
      if (a.termEndDate === b.termEndDate) return 0;
      if (a.termEndDate === null) return 1;
      if (b.termEndDate === null) return -1;
      return a.termEndDate < b.termEndDate ? -1 : 1;
    });
}

/** YYYY-MM-DD を「2027年4月22日」の表記にする */
export function formatJapaneseDate(iso: string | null): string {
  if (!iso) return "―";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

/**
 * 選挙が行われる期間を「2027年3月24日〜4月22日」の表記にする。
 * 年が同じ場合は終期の年を省く（月が同じ場合は月も省く）。
 */
export function formatElectionWindow(
  schedule: ExecutiveElectionSchedule
): string | null {
  const { windowStartDate, windowEndDate } = schedule;
  if (!windowStartDate || !windowEndDate) return null;
  const start = windowStartDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const end = windowEndDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!start || !end) return null;
  const startLabel = `${Number(start[1])}年${Number(start[2])}月${Number(start[3])}日`;
  if (start[1] !== end[1]) {
    return `${startLabel}〜${Number(end[1])}年${Number(end[2])}月${Number(end[3])}日`;
  }
  if (start[2] !== end[2]) {
    return `${startLabel}〜${Number(end[2])}月${Number(end[3])}日`;
  }
  return `${startLabel}〜${Number(end[3])}日`;
}
