/**
 * 都道府県別・性質別歳出データ取得スクリプト（予算の見える化 Phase B）。
 *
 * データソース: 総務省「地方財政状況調査」（e-Stat経由、都道府県分）
 *   統計表ページ: https://www.e-stat.go.jp/stat-search/files?toukei=00200251&tstat=000001077755&tclass1=000001078091&tclass2=000001078092
 *   対象表: 表15「歳出の状況・その1　性質別経費の状況」
 *
 * 調査結果（2026-08-11、実CSVをfetchして確認）:
 *   - fetch-prefecture-finance.ts 等と同じ「ファイル」検索画面のダウンロードURL
 *     （`/stat-search/file-download?statInfId=...&fileKind=1`）が
 *     認証・Cookie・appId一切不要で直接200 text/csvを返す
 *   - 表15は「県名×行番号（性質別区分25種）」の縦持ち（ロング）形式。
 *     行番号01〜24が個々の性質別区分、行番号23が「歳出合計」。
 *     47都道府県×25行＝1175行（＋ヘッダー1行＝1176行）を実データで確認済み
 *   - 【単年度のみの収録】表15には決算年度列があるが、実データを確認したところ
 *     全行が令和6年度（2024年度決算）のみで、fetch-prefecture-finance.tsが
 *     使う表02「決算収支の状況」のような当該年度＋前年度の2年分収録では
 *     なかった。無理に過去分を遡らず、公開されている単年度分のみを取得する
 *   - 25行のうち、以下12行が相互に排他的な「性質別」大区分であり、
 *     合計すると行番号23「歳出合計」に一致する（北海道で実データ検算済み）:
 *     01人件費・04物件費・05維持補修費・06扶助費・07補助費等・08公債費・
 *     12積立金・13投資及び出資金・14貸付金・15繰出金・16前年度繰上充用金・
 *     17投資的経費。それ以外の行（02うち職員給、03うち退職手当債を財源と
 *     するもの、09〜11公債費の内訳、18投資的経費のうち人件費、19〜22
 *     投資的経費の内訳、24歳出合計のうち人件費）はいずれも上記12区分の
 *     部分集合（内訳）であり、二重計上を避けるため`categories`には含めない
 *   - 【PrefectureFinance/PrefectureExpenditureByPurposeとの合計差異】
 *     表15の「歳出合計」（上記12区分の合計）は、PrefectureFinance.
 *     totalExpenditureThousandYenやPrefectureExpenditureByPurposeの目的別
 *     合計より少ない値になる。北海道で検算した差額（1,736億円）は、
 *     PrefectureExpenditureByPurposeの表12にある「都道府県が徴収した税の
 *     一部を市町村へ交付する経費」（利子割交付金・配当割交付金・
 *     地方消費税交付金等の合計、1,736億円）と完全一致することを確認済み。
 *     つまり表15「性質別経費」はこれらの交付金を対象外とする総務省側の
 *     分類仕様であり、データの欠落や取得漏れではない
 *   - CSVはShift_JISエンコーディング（他スクリプトと同じ）
 *   - 利用規約: e-Statは政府標準利用規約（第2.0版）準拠
 *
 * 【既知の制約・運用上の注意】
 *   - `CSV_URL`のstatInfIdは「令和6年度分」という個別公開物に対して発行された
 *     固定ID。総務省が次年度分を新規公開すると新しいstatInfIdが発行され、
 *     このURLは古い年度のデータを返し続ける（他スクリプトと同じ運用上の注意）。
 *     年1回、e-Statの統計表ページで最新のstatInfIdを確認し、下記`CSV_URL`を
 *     手動更新する必要がある
 *   - 最新statInfIdの確認手順: e-Statで「地方財政状況調査」→「都道府県分」→
 *     対象年度を選択→表15「歳出の状況　その１　性質別経費の状況」の
 *     「CSV」ボタンのリンク先URLを確認する
 *
 * 実行: npm run fetch:prefecture-expenditure-by-nature
 */
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type {
  PrefectureExpenditureByNature,
  PrefectureExpenditureCategory,
} from "../src/types";
import { writeDataJson } from "./lib/writeJson";

const CSV_URL =
  "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040374293&fileKind=1";

const ROW_NAME_TOTAL = "歳出合計";
const ROW_NO_TOTAL = "23";

/**
 * 相互に排他的な性質別大区分12行（行番号→区分名）。
 * 区分名は原表の「行名称」表記のまま（独自の言い換えはしない）。
 * 合計すると行番号23「歳出合計」に一致する（実データで検算済み）。
 */
const NATURE_ROW_NOS = [
  "01", // 人件費
  "04", // 物件費
  "05", // 維持補修費
  "06", // 扶助費
  "07", // 補助費等
  "08", // 公債費
  "12", // 積立金
  "13", // 投資及び出資金
  "14", // 貸付金
  "15", // 繰出金
  "16", // 前年度繰上充用金
  "17", // 投資的経費
];

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
 * のため、汎用CSVパーサを使わずシンプルな行分割＋カンマ分割で足りる
 * （fetch-prefecture-finance.tsと同じ前提。実データで確認済み）。
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
  console.log(`表15「歳出の状況・その1　性質別経費の状況」を取得: ${CSV_URL}`);
  const text = await fetchCsvText(CSV_URL);
  const rows = parseCsv(text);
  console.log(`CSV行数（データ行のみ）: ${rows.length}`);

  // prefecture -> { fiscalYear, categories, totalFromRow23 }
  const byPrefecture = new Map<
    string,
    {
      fiscalYear: number;
      categories: PrefectureExpenditureCategory[];
      totalFromRow23: number | null;
    }
  >();

  for (const row of rows) {
    const prefecture = row["県名"] ?? "";
    if (!(prefecture in PREFECTURE_CODES)) continue; // 空行等を除外

    const fiscalYear = Number(row["決算年度"]);
    if (!Number.isFinite(fiscalYear)) {
      console.warn(`スキップ（決算年度パース失敗）: ${prefecture}`, row);
      continue;
    }

    const rowNo = row["行番号"] ?? "";
    const rowName = row["行名称"] ?? "";
    const amount = parseAmount(row["001:決算額"]);

    const entry = byPrefecture.get(prefecture) ?? {
      fiscalYear,
      categories: [],
      totalFromRow23: null,
    };

    if (rowNo === ROW_NO_TOTAL && rowName === ROW_NAME_TOTAL) {
      entry.totalFromRow23 = amount;
    } else if (NATURE_ROW_NOS.includes(rowNo)) {
      if (amount === null) {
        console.warn(`スキップ（数値パース失敗、行="${rowName}"）: ${prefecture}`, row);
      } else {
        entry.categories.push({ name: rowName, amountThousandYen: amount });
      }
    }

    byPrefecture.set(prefecture, entry);
  }

  const results: PrefectureExpenditureByNature[] = [];
  let mismatchCount = 0;
  for (const [prefecture, { fiscalYear, categories, totalFromRow23 }] of byPrefecture.entries()) {
    const sum = categories.reduce((s, c) => s + c.amountThousandYen, 0);
    if (totalFromRow23 !== null && sum !== totalFromRow23) {
      mismatchCount++;
      console.warn(
        `検算不一致: ${prefecture} 性質別12区分合計=${sum.toLocaleString()} ` +
          `≠ 表内「歳出合計」行=${totalFromRow23.toLocaleString()}`
      );
    }
    results.push({ prefecture, fiscalYear, categories, sourceUrl: CSV_URL });
  }
  if (mismatchCount === 0) {
    console.log("検算OK: 全都道府県で性質別12区分の合計が表内「歳出合計」行と一致しました。");
  }

  results.sort(
    (a, b) => Number(PREFECTURE_CODES[a.prefecture]) - Number(PREFECTURE_CODES[b.prefecture])
  );

  if (results.length !== 47) {
    console.warn(
      `【警告】都道府県数が47件になりませんでした（実際: ${results.length}件）。` +
        `e-Stat側のCSVレイアウトが変わっている可能性があるため確認してください。`
    );
  } else {
    console.log("47都道府県すべて取得できました。");
  }

  await writeDataJson("prefecture-expenditure-by-nature.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
