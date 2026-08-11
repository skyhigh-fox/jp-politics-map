/**
 * 都道府県知事・指定都市市長データ取得スクリプト
 * （機能拡充ロードマップ Tier1 #8「知事・首長データベース＋選挙カレンダー」）。
 *
 * データソース: 総務省「地方公共団体の長の連続就任回数調」
 *   一覧ページ: https://www.soumu.go.jp/senkyo/senkyo_s/data/syozoku/ichiran.html
 *   年次ページ: 上記から動的に解決（例: /senkyo/senkyo_s/data/syozoku/r06_00001.html）
 *   本体Excel : 年次ページ内の「地方公共団体の長の連続就任回数」という表記の
 *               xlsxリンク（例: /main_content/001065955.xlsx）
 *   ※ 年次ページ・Excel URLの解決は Tier1 #6（所属党派別人員調）と同じページを
 *      辿るため、scripts/lib/soumuSurvey.ts に共通化している。
 *
 * 調査結果（2026-08-11、実URLをfetchして確認）:
 *   - 調査は毎年12月31日現在で実施され、翌年に公表される。取得時点の最新は
 *     「令和7年12月31日現在」（＝2025-12-31基準）。
 *   - ブックは5シート構成:
 *       知事・政令市長 / 市区長 / 町村長 / 市区長 (４回以上) / 町村長 (４回以上)
 *     このうち本スクリプトが取り込むのは「知事・政令市長」シートのみ。
 *     「市区長」「町村長」シートは都道府県ごとの**人数の分布**（1回が何人、
 *     2回が何人…）であって個人の氏名・任期満了日を持たないため対象外。
 *     「(４回以上)」シートは団体名と任期満了日を持つが、連続就任回数が4回以上の
 *     長だけを抜き出した表であり、これを取り込むと「多選の首長だけを並べた一覧」に
 *     なってしまう（下記の中立性の方針に反する）ため対象外とする。
 *   - 「知事・政令市長」シートの構成:
 *       行0  : 表題「２　地方公共団体の長の連続就任回数調」
 *       行2  : 表題「(1)知事及び政令指定都市長の連続就任回数調」
 *       行3  : 「（令和７年１２月３１日現在）」（全角数字。調査基準日）
 *       行4  : ヘッダー（区分 / 知事名 / 任期満了年月日 / 就任回数 /
 *                        指定都市名 / 市長名 / 任期満了年月日 / 就任回数）
 *       行5  : 「都道府県」（区分の見出し）
 *       行6〜 : 47都道府県の各行。指定都市を複数抱える県は2行目以降の
 *               都道府県名が空欄になる（例: 神奈川県の下に川崎市・相模原市）。
 *     ※ 右側（列12以降）には連続就任回数の分布の集計表が同居しているが、
 *       都道府県別の情報ではないため読まない。
 *   - 「任期満了年月日」は**元号年・月・日が3列に分かれた数値**（例: 9, 4, 22）。
 *     元号名は列に現れないため、調査基準日の元号（令和）を前提に西暦へ変換し、
 *     変換結果が調査基準日から妥当な範囲（首長の任期は4年）に収まるかを検査する。
 *   - 値が文字列で入っているセルが混在する（例: 広島市の月が文字列 "4"）ため、
 *     数値化は必ず String() 経由で行う。
 *   - 原表に氏名・任期満了日が空欄の団体が存在しうる（令和7年調査では福井県が空欄）。
 *     欠測は推測で埋めず null のまま保持する。
 *   - 利用規約: 総務省ウェブサイトは政府標準利用規約（第2.0版）準拠。
 *     出典表記をすれば商用・非商用問わず自由利用可。
 *
 * 【政治的中立性についての注記（重要）】
 *   - 「連続就任回数」は原表の項目名・数値をそのまま保持する。多選・長期在任に
 *     ついての評価的な含意（是非・問題視）は、データにもUIにも一切持たせない。
 *   - 都道府県間の比較・ランキング（連続就任回数の順位付け等）は行わない。
 *     そのため本データは「都道府県ごとの独立したレコード」の形にし、
 *     全国横断で並べ替えられる集計値は持たせない。
 *   - 氏名は原表の表記を保持する（`name`）。表示用に空白を1つに畳んだ
 *     `displayName` と、照合用の `nameKey`（src/lib/nameMatch.ts の正規化）を
 *     併せて持つが、いずれも独自の言い換え・補完はしない。
 *   - 任期満了日は「確定した予定」ではなく、解散・辞職・失職等があれば変動する。
 *     UI側で確定と推定を区別して表示すること（src/lib/electionCalendar.ts）。
 *
 * 実行: npm run fetch:prefecture-executives
 */
import * as XLSX from "xlsx";
import { normalizeNameKey } from "../src/lib/nameMatch";
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type {
  LocalExecutive,
  LocalExecutiveType,
  PrefectureExecutives,
} from "../src/types";
import {
  fetchExcelBuffer,
  resolveExcelUrlByLinkText,
  resolveLatestSurveyPage,
} from "./lib/soumuSurvey";
import { writeDataJson } from "./lib/writeJson";

/** 年次ページ上のリンク表記（このキーワードでxlsxを選ぶ） */
const EXCEL_LINK_KEYWORD = "長の連続就任回数";

/** 取り込む対象シート名の判定（原表のシート名は「知事・政令市長」） */
const isGovernorSheetName = (name: string) =>
  name.includes("知事") && name.includes("市長");

/** 令和元年 = 2019年 → 2018 + 1 */
const ERA_REIWA_BASE = 2018;

const cellText = (raw: unknown): string =>
  raw === undefined || raw === null ? "" : String(raw).replace(/\s|　/g, "").trim();

/** 数値セル（文字列で入っている場合がある）を数値にする。数値でなければ null */
function toNumberOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s　]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** ヘッダー行のうち `label` に一致する列を、`from` 以降で探す */
function findColumn(header: unknown[], label: string, from = 0): number {
  for (let i = from; i < header.length; i++) {
    if (cellText(header[i]) === label) return i;
  }
  return -1;
}

function requireColumn(header: unknown[], label: string, from = 0): number {
  const index = findColumn(header, label, from);
  if (index === -1) {
    throw new Error(
      `ヘッダー行に「${label}」列が見つかりませんでした（${from}列目以降）。` +
        `総務省側のExcelレイアウトが変わった可能性があります。` +
        `実際のヘッダー: ${header.map((c) => cellText(c)).join(" / ")}`
    );
  }
  return index;
}

interface ColumnLayout {
  /** 都道府県名（＝区分）の列 */
  prefecture: number;
  governorName: number;
  /** 任期満了年月日の先頭列（年・月・日の3列） */
  governorTermEnd: number;
  governorTerms: number;
  cityName: number;
  mayorName: number;
  mayorTermEnd: number;
  mayorTerms: number;
  /** データ行の開始インデックス */
  dataStartIndex: number;
}

function parseLayout(rows: unknown[][]): ColumnLayout {
  const headerIndex = rows.findIndex(
    (row) => Array.isArray(row) && cellText(row[0]) === "区分"
  );
  if (headerIndex === -1) {
    throw new Error(
      `ヘッダー行（1列目が「区分」の行）を特定できませんでした。` +
        `総務省側のExcelレイアウトが変わった可能性があります。`
    );
  }
  const header = rows[headerIndex]!;

  const governorName = requireColumn(header, "知事名");
  const governorTermEnd = requireColumn(header, "任期満了年月日", governorName);
  const governorTerms = requireColumn(header, "就任回数", governorTermEnd);
  const cityName = requireColumn(header, "指定都市名", governorTerms);
  const mayorName = requireColumn(header, "市長名", cityName);
  const mayorTermEnd = requireColumn(header, "任期満了年月日", mayorName);
  const mayorTerms = requireColumn(header, "就任回数", mayorTermEnd);

  return {
    prefecture: 0,
    governorName,
    governorTermEnd,
    governorTerms,
    cityName,
    mayorName,
    mayorTermEnd,
    mayorTerms,
    dataStartIndex: headerIndex + 1,
  };
}

/** 調査基準日の表記（例:"（令和７年１２月３１日現在）"）から元号年を読む */
function parseSurveyReiwaYear(rows: unknown[][]): number | null {
  for (const row of rows.slice(0, 8)) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const text = String(cell ?? "").normalize("NFKC");
      const m = text.match(/令和\s*(\d+|元)年/);
      if (m) return m[1] === "元" ? 1 : Number(m[1]);
    }
  }
  return null;
}

/**
 * 「任期満了年月日」の3列（元号年・月・日）をISO 8601の日付にする。
 * 元号名は原表の列に現れないため、呼び出し側から元号の基準年を受け取る。
 */
function readTermEndDate(
  row: unknown[],
  startIndex: number,
  eraBaseYear: number
): string | null {
  const eraYear = toNumberOrNull(row[startIndex]);
  const month = toNumberOrNull(row[startIndex + 1]);
  const day = toNumberOrNull(row[startIndex + 2]);
  if (eraYear === null || month === null || day === null) return null;
  const year = eraBaseYear + eraYear;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // 実在しない日付（2月30日等）を弾く
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== day) return null;
  return iso;
}

function buildExecutive(
  prefecture: string,
  type: LocalExecutiveType,
  bodyName: string,
  rawName: string,
  termEndDate: string | null,
  consecutiveTerms: number | null
): LocalExecutive {
  const name = rawName.trim();
  return {
    prefecture,
    type,
    bodyName,
    name: name || null,
    // 原表は桁揃えのため姓名の間に全角スペースが0〜複数入る（「鈴木　　直道」等）。
    // 表示用は空白1つに畳み、照合用は src/lib/nameMatch.ts の正規化キーを持つ。
    displayName: name ? name.replace(/[\s　]+/g, "　") : null,
    nameKey: name ? normalizeNameKey(name) : null,
    termEndDate,
    consecutiveTerms,
  };
}

/** 任期満了日が調査基準日から見て妥当な範囲か（首長の任期は4年） */
function isPlausibleTermEnd(termEndDate: string, asOfDate: string): boolean {
  const asOf = new Date(`${asOfDate}T00:00:00Z`).getTime();
  const termEnd = new Date(`${termEndDate}T00:00:00Z`).getTime();
  const year = 365.25 * 24 * 60 * 60 * 1000;
  // 調査基準日時点で在職中の長の任期満了日は、基準日以降・基準日＋4年以内に入る。
  // 原表の記載ゆれを考慮して前後に1年の余裕を持たせる。
  return termEnd >= asOf - year && termEnd <= asOf + 5 * year;
}

async function main() {
  const { pageUrl, asOfDate, eraLabel } = await resolveLatestSurveyPage();
  const excelUrl = await resolveExcelUrlByLinkText(pageUrl, EXCEL_LINK_KEYWORD);

  const buf = await fetchExcelBuffer(excelUrl);
  const wb = XLSX.read(buf, { type: "array" });
  console.log(`ブック内のシート: ${wb.SheetNames.join(", ")}`);

  const sheetName = wb.SheetNames.find(isGovernorSheetName);
  if (!sheetName) {
    throw new Error(
      `知事・指定都市市長のシートが見つかりませんでした。` +
        `実際のシート名: ${wb.SheetNames.join(", ")}`
    );
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
    header: 1,
    raw: true,
    blankrows: true,
  });
  const layout = parseLayout(rows);

  // 原表の「任期満了年月日」の列には元号名が入っていないため、令和の年として
  // 解釈する。シート内の調査基準日の表記（「（令和７年１２月３１日現在）」）が
  // 一覧ページから得た調査基準日と整合するかを確認し、将来の改元で前提が
  // 崩れたときに気付けるようにしておく。
  const surveyReiwaYear = parseSurveyReiwaYear(rows);
  const asOfYear = Number(asOfDate.slice(0, 4));
  if (surveyReiwaYear === null) {
    console.warn(
      "【警告】シート内の調査基準日の元号表記（令和N年）を読み取れませんでした。" +
        "任期満了日は令和として解釈します。"
    );
  } else if (ERA_REIWA_BASE + surveyReiwaYear !== asOfYear) {
    console.warn(
      `【警告】シート内の調査基準日（令和${surveyReiwaYear}年）と一覧ページの調査基準日` +
        `（${asOfDate}）が一致しません。改元または原表の様式変更の可能性があります。`
    );
  }
  const eraBaseYear = ERA_REIWA_BASE;

  const byPrefecture = new Map<
    string,
    { governor: LocalExecutive | null; mayors: LocalExecutive[] }
  >();
  const missingGovernor: string[] = [];
  const implausibleDates: string[] = [];

  let currentPrefecture: string | null = null;

  for (let i = layout.dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const label = String(row[layout.prefecture] ?? "").trim();
    if (label in PREFECTURE_CODES) {
      currentPrefecture = label;
      if (!byPrefecture.has(label)) {
        byPrefecture.set(label, { governor: null, mayors: [] });
      }

      const governorName = String(row[layout.governorName] ?? "").trim();
      const termEndDate = readTermEndDate(row, layout.governorTermEnd, eraBaseYear);
      const terms = toNumberOrNull(row[layout.governorTerms]);
      if (!governorName && termEndDate === null) {
        // 原表側が空欄（令和7年調査では福井県）。推測で埋めず欠測として記録する
        missingGovernor.push(label);
      } else {
        byPrefecture.get(label)!.governor = buildExecutive(
          label,
          "都道府県知事",
          label,
          governorName,
          termEndDate,
          terms
        );
      }
    }

    // 指定都市は都道府県行と同じ行に並ぶ。1県に複数ある場合は次行以降に
    // 続き、その行の都道府県名は空欄になるため直前の都道府県を引き継ぐ
    const cityName = String(row[layout.cityName] ?? "").trim();
    if (cityName && currentPrefecture) {
      const mayorName = String(row[layout.mayorName] ?? "").trim();
      const termEndDate = readTermEndDate(row, layout.mayorTermEnd, eraBaseYear);
      const terms = toNumberOrNull(row[layout.mayorTerms]);
      byPrefecture.get(currentPrefecture)!.mayors.push(
        buildExecutive(
          currentPrefecture,
          "指定都市市長",
          cityName,
          mayorName,
          termEndDate,
          terms
        )
      );
    }
  }

  const results: PrefectureExecutives[] = [...byPrefecture.entries()]
    .map(([prefecture, entry]) => ({
      prefecture,
      asOfDate,
      governor: entry.governor,
      designatedCityMayors: entry.mayors,
      sourceUrl: excelUrl,
      sourcePageUrl: pageUrl,
    }))
    .sort(
      (a, b) =>
        Number(PREFECTURE_CODES[a.prefecture]) - Number(PREFECTURE_CODES[b.prefecture])
    );

  // 元号の解釈が正しいかを、任期満了日が調査基準日から妥当な範囲に入るかで検査する
  for (const record of results) {
    for (const exec of [record.governor, ...record.designatedCityMayors]) {
      if (!exec?.termEndDate) continue;
      if (!isPlausibleTermEnd(exec.termEndDate, asOfDate)) {
        implausibleDates.push(`${exec.bodyName}: ${exec.termEndDate}`);
      }
    }
  }

  const mayorCount = results.reduce((s, r) => s + r.designatedCityMayors.length, 0);
  const governorCount = results.filter((r) => r.governor).length;
  console.log(
    `シート「${sheetName}」: ${results.length}都道府県 / 知事${governorCount}名 / ` +
      `指定都市市長${mayorCount}名を取得（調査基準日: ${asOfDate} / ${eraLabel}）`
  );

  if (results.length !== 47) {
    console.warn(
      `【警告】都道府県数が47件になりませんでした（実際: ${results.length}件）。` +
        `総務省側のExcelレイアウトが変わっている可能性があるため確認してください。`
    );
  }
  if (missingGovernor.length > 0) {
    console.warn(
      `【注記】原表で知事の欄が空欄だった都道府県: ${missingGovernor.join("、")}。` +
        `推測で補完せず、欠測（null）のまま保存しています。`
    );
  }
  if (implausibleDates.length > 0) {
    console.warn(
      `【警告】任期満了日が調査基準日（${asOfDate}）から見て想定範囲外の団体があります: ` +
        `${implausibleDates.join("、")}。元号の解釈または原表の様式が変わった可能性があります。`
    );
  }

  await writeDataJson("prefecture-executives.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
