/**
 * 都道府県別・地方財政データ（決算収支の状況）取得スクリプト（Phase 4）。
 *
 * データソース: 総務省「地方財政状況調査」（e-Stat「政府統計の総合窓口」経由でCSV配布）
 *   統計表ページ: https://www.e-stat.go.jp/stat-search/files?toukei=00200251
 *
 * 調査結果（2026-08-10、実URLをfetchして確認）:
 *   - e-Stat APIは通常 appId（無料の利用者登録）が必須だが、e-Statの「ファイル」
 *     検索画面（統計表ダウンロードUI）が実際に叩くダウンロードURL
 *     （`/stat-search/file-download?statInfId=...&fileKind=1`）は
 *     **認証・Cookie・appId一切不要**で直接200 text/csvが返ることを確認済み
 *     （API経由ではなく、ブラウザの「ダウンロード」ボタンと同じ画面遷移をたどった先）
 *   - 対象表: 地方財政状況調査 都道府県分 表02「決算収支の状況」
 *     （toukei=00200251, tstat=000001077755, tclass1=000001078091[都道府県分]）
 *   - 47都道府県＋全国合計行が1ファイルに収録されており、最新年度（令和6年度＝
 *     2024年度決算、行番号="01"）と前年度（令和5年度、行番号="02"）の2年分を含む
 *   - CSVはShift_JISエンコーディング（総務省・e-Statの日本語CSVで典型的な仕様。
 *     このリポジトリで複数回踏んだ既知のパターンに従い arrayBuffer() →
 *     TextDecoder("shift_jis") でデコードする）
 *   - 利用規約: e-Statは政府標準利用規約（第2.0版）準拠。出典表記（「政府統計の
 *     総合窓口(e-Stat)」）をすれば商用・非商用問わず自由利用可
 *
 * 【既知の制約・運用上の注意】
 *   - `CSV_URL`のstatInfIdは「令和6年度分」という個別公開物に対して発行された
 *     固定ID。総務省が次年度（令和7年度分、2027年3月頃公開予定）を新規公開すると
 *     新しいstatInfIdが発行され、このURLは指し先が変わらないまま「古い年度の
 *     決算データ」を返し続ける（＝リンク切れにはならないが、データが更新されない）。
 *     年1回、e-Statの統計表ページで最新のstatInfIdを確認し、下記`CSV_URL`を
 *     手動更新する必要がある（fetch-election-results.tsが選挙結果のExcel URLを
 *     選挙のたびに手動更新しているのと同じ運用パターン）
 *   - 最新statInfIdの確認手順: e-Statで「地方財政状況調査」→「都道府県分」→
 *     対象年度を選択→表02「決算収支の状況」の「CSV」ボタンのリンク先URLを確認する
 *
 * 実行: npm run fetch:prefecture-finance
 */
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type { PrefectureFinance } from "../src/types";
import { writeDataJson } from "./lib/writeJson";

const CSV_URL =
  "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040374259&fileKind=1";

// 表02「決算収支の状況」の行番号: "01"=対象年度（最新）、"02"=前年度（比較用、今回は未使用）
const TARGET_ROW_NO = "01";

async function fetchCsvText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CSV取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }
  const buf = await res.arrayBuffer();
  return new TextDecoder("shift_jis").decode(buf);
}

/**
 * このCSVは団体名・表名称等がすべて単純な文字列（カンマ・改行・引用符を含まない）
 * のため、汎用CSVパーサを使わずシンプルな行分割＋カンマ分割で足りる（実データで確認済み）。
 */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const [headerLine, ...bodyLines] = lines;
  if (!headerLine) return [];
  const header = headerLine.split(",").map((h) => h.trim());
  return bodyLines.map((line) => {
    const cells = line.split(",");
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = cells[i] ?? "";
    });
    return record;
  });
}

function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log(`地方財政状況調査（都道府県分・決算収支の状況）を取得: ${CSV_URL}`);
  const text = await fetchCsvText(CSV_URL);
  const rows = parseCsv(text);
  console.log(`CSV行数（データ行のみ）: ${rows.length}`);

  const results: PrefectureFinance[] = [];
  for (const row of rows) {
    if (row["行番号"] !== TARGET_ROW_NO) continue;

    const prefecture = row["県名"] ?? "";
    if (!(prefecture in PREFECTURE_CODES)) continue; // 「合計(全国)」行等を除外

    const fiscalYearRaw = row["決算年度"];
    const fiscalYear = Number(fiscalYearRaw);
    const totalRevenueThousandYen = parseAmount(row["001:歳入総額"]);
    const totalExpenditureThousandYen = parseAmount(row["002:歳出総額"]);
    const realBalanceThousandYen = parseAmount(row["005:実質収支"]);

    if (
      !Number.isFinite(fiscalYear) ||
      totalRevenueThousandYen === null ||
      totalExpenditureThousandYen === null ||
      realBalanceThousandYen === null
    ) {
      console.warn(`スキップ（数値パース失敗）: ${prefecture}`, row);
      continue;
    }

    results.push({
      prefecture,
      fiscalYear,
      totalRevenueThousandYen,
      totalExpenditureThousandYen,
      realBalanceThousandYen,
      sourceUrl: CSV_URL,
    });
  }

  results.sort(
    (a, b) =>
      Number(PREFECTURE_CODES[a.prefecture]) - Number(PREFECTURE_CODES[b.prefecture])
  );

  if (results.length !== 47) {
    console.warn(
      `【警告】都道府県数が47件になりませんでした（実際: ${results.length}件）。` +
        `e-Stat側のCSVレイアウトが変わっている可能性があるため確認してください。`
    );
  } else {
    console.log("47都道府県すべて取得できました。");
  }

  await writeDataJson("prefecture-finance.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
