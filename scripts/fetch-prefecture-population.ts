/**
 * 都道府県別・総人口データ取得スクリプト（予算の見える化 Phase A-2）。
 *
 * データソース: 総務省統計局「人口推計」（e-Stat「政府統計の総合窓口」経由でExcel配布）
 *   統計表ページ: https://www.e-stat.go.jp/stat-search/files?toukei=00200524&tstat=000000090001
 *   対象表: 人口推計 各年10月1日現在人口 第５表「都道府県、男女別人口－総人口、
 *     日本人人口（各年10月1日現在）」
 *
 * 調査結果（2026-08-11、実URLをfetchして確認）:
 *   - fetch-prefecture-finance.ts と同じ「ファイル」検索画面のダウンロードURL
 *     （`/stat-search/file-download?statInfId=...&fileKind=...`）が
 *     認証・Cookie・appId一切不要で直接200が返ることを確認済み
 *   - この統計表（statInfId=000040268859、第５表）は**CSV配布がなくEXCELのみ**
 *     （fileKind=0）。fetch-election-results.tsと同様に`xlsx`パッケージで
 *     直接パースする
 *   - シート「第５表」は1シートに複数の断面（人口区分:総人口/日本人人口 ×
 *     性別:男女計/男/女）が縦に連結されている。1つの断面ブロックは
 *     「00000:全国」1行 + 47都道府県の47行 = 48行で、そのうち最初のブロック
 *     （人口区分="総人口"、性別="男女計"）が今回の対象
 *   - 列は都道府県コード・地域名（末尾に全角空白でパディングされているためtrim
 *     必須）・単位（"千人"）・年ごとの人口推計値（西暦年見出しの列）が並ぶ。
 *     値は**千人単位に丸められている**（総務省の公表単位そのまま。個人単位の
 *     精度ではない点に注意。1人当たり歳出計算等の概算用途では十分だが、
 *     厳密な人口統計としては住民基本台帳人口等の方が精度が高い）
 *   - 最新年は西暦年見出しの列のうち最も右（本取得時点では2024年＝令和6年
 *     10月1日現在の確定値）。翌年分（2025年）は2026年4月頃に公開予定で、
 *     公開後は同じstatInfIdのファイルに列が追加される形で更新される見込み
 *     （このシートの過去実績が「1ファイルに複数年分を横持ちで蓄積」という
 *     形式のため、fetch-prefecture-finance.tsのような「年度ごとに新しい
 *     statInfIdが発行される」方式とは異なる）
 *   - 利用規約: e-Statは政府標準利用規約（第2.0版）準拠。出典表記（「政府統計の
 *     総合窓口(e-Stat)」）をすれば商用・非商用問わず自由利用可
 *
 * 【既知の制約・運用上の注意】
 *   - `EXCEL_URL`のstatInfIdは「令和6年（2024年）10月1日現在人口」を含む
 *     第５表ファイルに対して発行された固定ID。新しい年の確定値が追加されても
 *     同じファイルが更新される可能性が高いため、fetch-prefecture-finance.ts
 *     ほど頻繁な手動URL更新は不要と見込まれるが、総務省が統計表を新規に
 *     切り出した場合（別ファイル化された場合）はstatInfIdが変わりうる。
 *     年1回、e-Statの統計表ページで最新のstatInfIdと最新年列を確認すること
 *   - 最新statInfIdの確認手順: e-Statで「人口推計」→「各年10月1日現在人口」→
 *     「都道府県」カテゴリ→「５　都道府県、男女別人口－総人口、日本人人口
 *     （各年10月1日現在）」のEXCELボタンのリンク先URLを確認する
 *
 * 実行: npm run fetch:prefecture-population
 */
import * as XLSX from "xlsx";
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type { PrefecturePopulation } from "../src/types";
import { writeDataJson } from "./lib/writeJson";

const EXCEL_URL =
  "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040268859&fileKind=0";

const SHEET_NAME = "第５表";

// シート内の列インデックス（0始まり、実データで確認済み）
const COL_PREFECTURE_CODE = 9; // 例:"01000"
const COL_PREFECTURE_NAME = 10; // 例:"北海道　　　　"（全角空白パディングあり）
const COL_JINKO_KUBUN = 7; // 人口区分（"総人口" / "日本人人口"）
const COL_SEIBETSU = 8; // 性別（"男女計" / "男" / "女"）
const COL_UNIT = 12; // 単位（"千人"）
const FIRST_YEAR_COL = 13; // 年別人口の最初の列（実データでは2020年）

async function fetchExcelBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Excel取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }
  return res.arrayBuffer();
}

function trimPaddedName(raw: unknown): string {
  return String(raw ?? "").replace(/[\s　]+$/g, "");
}

async function main() {
  console.log(`人口推計（都道府県、男女別人口－総人口）を取得: ${EXCEL_URL}`);
  const buf = await fetchExcelBuffer(EXCEL_URL);
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(
      `シート「${SHEET_NAME}」が見つかりませんでした。実際のシート名: ${wb.SheetNames.join(", ")}`
    );
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  // ヘッダー行（"人口区分","性別",...,西暦年,...）を探し、最新年の列を特定する
  const headerRowIndex = rows.findIndex(
    (row) => Array.isArray(row) && row[COL_JINKO_KUBUN] === "人口区分"
  );
  if (headerRowIndex === -1) {
    throw new Error("ヘッダー行（人口区分列）が見つかりませんでした。シート構成が変わった可能性があります。");
  }
  const headerRow = rows[headerRowIndex];
  if (!headerRow) {
    throw new Error("ヘッダー行の取得に失敗しました。");
  }
  const yearCols: { col: number; year: number }[] = [];
  for (let c = FIRST_YEAR_COL; c < headerRow.length; c++) {
    const m = String(headerRow[c] ?? "").match(/^(\d{4})年$/);
    if (m) yearCols.push({ col: c, year: Number(m[1]) });
  }
  if (yearCols.length === 0) {
    throw new Error("年別の人口列が見つかりませんでした。シート構成が変わった可能性があります。");
  }
  const latest = yearCols[yearCols.length - 1];
  if (!latest) {
    throw new Error("最新年列の特定に失敗しました。");
  }
  console.log(`最新年列: ${latest.year}年（列インデックス${latest.col}）`);

  const results: PrefecturePopulation[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    // 最初の断面ブロック（総人口・男女計）のみを対象にする。
    // これ以外の断面（日本人人口、男/女別）に達したら走査を打ち切る。
    if (row[COL_JINKO_KUBUN] !== "総人口" || row[COL_SEIBETSU] !== "男女計") break;

    const prefCode = String(row[COL_PREFECTURE_CODE] ?? "");
    if (prefCode === "00000") continue; // 全国合計行を除外

    const prefecture = trimPaddedName(row[COL_PREFECTURE_NAME]);
    if (!(prefecture in PREFECTURE_CODES)) {
      console.warn(`スキップ（都道府県名が一致しません）: "${prefecture}"`, row);
      continue;
    }

    const unit = row[COL_UNIT];
    if (unit !== "千人") {
      console.warn(`スキップ（想定外の単位）: ${prefecture} unit=${unit}`);
      continue;
    }

    const raw = row[latest.col];
    const thousands = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(thousands)) {
      console.warn(`スキップ（数値パース失敗）: ${prefecture}`, row);
      continue;
    }

    results.push({
      prefecture,
      year: latest.year,
      // 原表は千人単位。実人数の概算値として1000倍する（丸め誤差を含む点に注意）
      population: Math.round(thousands * 1000),
      sourceUrl: EXCEL_URL,
    });
  }

  results.sort(
    (a, b) => Number(PREFECTURE_CODES[a.prefecture]) - Number(PREFECTURE_CODES[b.prefecture])
  );

  if (results.length !== 47) {
    console.warn(
      `【警告】都道府県数が47件になりませんでした（実際: ${results.length}件）。` +
        `e-Stat側のExcelレイアウトが変わっている可能性があるため確認してください。`
    );
  } else {
    console.log("47都道府県すべて取得できました。");
  }

  await writeDataJson("prefecture-population.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
