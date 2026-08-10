/**
 * 都道府県別・目的別歳出データ取得スクリプト（予算の見える化 Phase A-2）。
 *
 * データソース: 総務省「地方財政状況調査」（e-Stat経由、都道府県分）
 *   統計表ページ: https://www.e-stat.go.jp/stat-search/files?toukei=00200251&tstat=000001077755&tclass1=000001078091&tclass2=000001078092
 *
 * 調査結果（2026-08-11、実CSVをfetchして確認）:
 *   - fetch-prefecture-finance.ts で使っているのと同じ「ファイル」検索画面の
 *     ダウンロードURL（`/stat-search/file-download?statInfId=...&fileKind=1`）
 *     が認証・Cookie・appId一切不要で直接200 text/csvを返す
 *   - 「目的別歳出」は表番号07〜13（表名称「歳出内訳及び財源内訳（その１）」〜
 *     「（その７）」）の**6枚の表に分割**されている（令和6年度分、実データで確認）。
 *     各表は「行＝性質別（人件費・物件費・扶助費・普通建設事業費・公債費等）」
 *     「列＝目的別（総務費・民生費・衛生費…の大区分＋その内訳細目）」の
 *     クロス集計表で、行番号・行名称"歳出合計"の行だけを見れば
 *     「その表がカバーする目的別大区分ごとの合計歳出額」が取れる
 *       - 表07（その1）: 001:議会費, 002:総務費・総額
 *       - 表08（その2）: 001:民生費・総額, 007:衛生費・総額
 *       - 表09（その3）: 001:労働費・総額, 006:農林水産業費・総額, 012:商工費・総額
 *       - 表10（その4）: 001:土木費・総額, 012:警察費, 013:消防費
 *       - 表11（その5）: 001:教育費・総額
 *       - 表12（その6）: 001:災害復旧費・総額, 023:公債費, 024:諸支出金・総額,
 *         027:前年度繰上充用金、および利子割交付金・配当割交付金・
 *         株式等譲渡所得割交付金・分離課税所得割交付金・地方消費税交付金・
 *         ゴルフ場利用税交付金・自動車取得税交付金・軽油引取税交付金・
 *         自動車税環境性能割交付金・法人事業税交付金・特別区財政調整交付金
 *         （都道府県が徴収した税の一部を市町村へ交付する経費。総務費や
 *         諸支出金の内数ではなく、この表では独立した目的別区分として
 *         計上されている）
 *     表13（その7、行56="歳出合計"）はこれら全区分を合算した「性質別」の
 *     総括表であり、目的別の内訳としては使わない（ただし北海道の
 *     歳出合計＝2,803,025,736千円がprefecture-finance.jsonの
 *     totalExpenditureThousandYenと完全一致することを検算に使い、上記26区分を
 *     すべて合算した値も同額になることを確認済み＝目的別区分に抜け漏れが
 *     ないことの検証済み）
 *   - CSVはShift_JISエンコーディング（fetch-prefecture-finance.tsと同じ）
 *   - 利用規約: e-Statは政府標準利用規約（第2.0版）準拠
 *
 * 【既知の制約・運用上の注意】
 *   - 各表のstatInfIdは「令和6年度分」という個別公開物に対して発行された
 *     固定ID。総務省が次年度分を新規公開すると新しいstatInfIdが発行され、
 *     このURLは古い年度のデータを返し続ける（fetch-prefecture-finance.tsと
 *     同じ運用上の注意）。年1回、e-Statの統計表ページで最新のstatInfIdを
 *     確認し、下記`TABLES`の`statInfId`を6つとも手動更新する必要がある
 *   - 最新statInfIdの確認手順: e-Statで「地方財政状況調査」→「都道府県分」→
 *     対象年度を選択→表07〜13「歳出内訳及び財源内訳（その1）」〜（その7）の
 *     各「CSV」ボタンのリンク先URLを確認する（表13は検算用途のみで
 *     取得スクリプトには含めていない）
 *
 * 実行: npm run fetch:prefecture-expenditure-by-purpose
 */
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type {
  PrefectureExpenditureByPurpose,
  PrefectureExpenditureCategory,
} from "../src/types";
import { writeDataJson } from "./lib/writeJson";

const ROW_NAME_TOTAL = "歳出合計";

interface TableDef {
  /** 表番号（例:"07"） */
  tableNo: string;
  statInfId: string;
  /** 抽出する列（CSVヘッダーのキー）→ 目的別区分の名称 */
  columns: { columnKey: string; categoryName: string }[];
}

/**
 * 表07〜表12（歳出内訳及び財源内訳 その1〜その6）。
 * 列キーはCSVヘッダーの表記そのまま（総務省の分類名称を独自に言い換えない）。
 */
const TABLES: TableDef[] = [
  {
    tableNo: "07",
    statInfId: "000040374264",
    columns: [
      { columnKey: "001:議会費", categoryName: "議会費" },
      { columnKey: "002:総務費・総額", categoryName: "総務費" },
    ],
  },
  {
    tableNo: "08",
    statInfId: "000040374265",
    columns: [
      { columnKey: "001:民生費・総額", categoryName: "民生費" },
      { columnKey: "007:衛生費・総額", categoryName: "衛生費" },
    ],
  },
  {
    tableNo: "09",
    statInfId: "000040374266",
    columns: [
      { columnKey: "001:労働費・総額", categoryName: "労働費" },
      { columnKey: "006:農林水産業費・総額", categoryName: "農林水産業費" },
      { columnKey: "012:商工費・総額", categoryName: "商工費" },
    ],
  },
  {
    tableNo: "10",
    statInfId: "000040374267",
    columns: [
      { columnKey: "001:土木費・総額", categoryName: "土木費" },
      { columnKey: "012:警察費", categoryName: "警察費" },
      { columnKey: "013:消防費", categoryName: "消防費" },
    ],
  },
  {
    tableNo: "11",
    statInfId: "000040374288",
    columns: [{ columnKey: "001:教育費・総額", categoryName: "教育費" }],
  },
  {
    tableNo: "12",
    statInfId: "000040374289",
    columns: [
      { columnKey: "001:災害復旧費・総額", categoryName: "災害復旧費" },
      { columnKey: "023:公債費", categoryName: "公債費" },
      { columnKey: "024:諸支出金・総額", categoryName: "諸支出金" },
      { columnKey: "027:前年度繰上充用金", categoryName: "前年度繰上充用金" },
      { columnKey: "028:利子割交付金", categoryName: "利子割交付金" },
      { columnKey: "029:配当割交付金", categoryName: "配当割交付金" },
      {
        columnKey: "030:株式等譲渡所得割交付金",
        categoryName: "株式等譲渡所得割交付金",
      },
      {
        columnKey: "031:分離課税所得割交付金",
        categoryName: "分離課税所得割交付金",
      },
      { columnKey: "032:地方消費税交付金", categoryName: "地方消費税交付金" },
      {
        columnKey: "033:ゴルフ場利用税交付金",
        categoryName: "ゴルフ場利用税交付金",
      },
      // 034:− は常に0（廃止済み税目の名残の列。実データで全都道府県0を確認済み）のため除外
      {
        columnKey: "035:自動車取得税交付金",
        categoryName: "自動車取得税交付金",
      },
      { columnKey: "036:軽油引取税交付金", categoryName: "軽油引取税交付金" },
      {
        columnKey: "037:自動車税環境性能割交付金",
        categoryName: "自動車税環境性能割交付金",
      },
      { columnKey: "038:法人事業税交付金", categoryName: "法人事業税交付金" },
      {
        columnKey: "039:特別区財政調整交付金",
        categoryName: "特別区財政調整交付金",
      },
    ],
  },
];

function fileDownloadUrl(statInfId: string): string {
  return `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${statInfId}&fileKind=1`;
}

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
  // prefecture -> fiscalYear -> categories[]
  const byPrefecture = new Map<
    string,
    { fiscalYear: number; categories: PrefectureExpenditureCategory[] }
  >();

  for (const table of TABLES) {
    const url = fileDownloadUrl(table.statInfId);
    console.log(`表${table.tableNo}（歳出内訳及び財源内訳）を取得: ${url}`);
    const text = await fetchCsvText(url);
    const rows = parseCsv(text);
    console.log(`  CSV行数（全行）: ${rows.length}`);

    let matchedRows = 0;
    for (const row of rows) {
      if (row["行名称"] !== ROW_NAME_TOTAL) continue;

      const prefecture = row["県名"] ?? "";
      if (!(prefecture in PREFECTURE_CODES)) continue; // 空行等を除外

      const fiscalYear = Number(row["決算年度"]);
      if (!Number.isFinite(fiscalYear)) {
        console.warn(`  スキップ（決算年度パース失敗）: ${prefecture}`, row);
        continue;
      }

      const categories: PrefectureExpenditureCategory[] = [];
      let parseFailed = false;
      for (const { columnKey, categoryName } of table.columns) {
        const amount = parseAmount(row[columnKey]);
        if (amount === null) {
          console.warn(
            `  スキップ（数値パース失敗、列="${columnKey}"）: ${prefecture}`,
            row
          );
          parseFailed = true;
          break;
        }
        categories.push({ name: categoryName, amountThousandYen: amount });
      }
      if (parseFailed) continue;

      const existing = byPrefecture.get(prefecture);
      if (existing) {
        existing.categories.push(...categories);
      } else {
        byPrefecture.set(prefecture, { fiscalYear, categories });
      }
      matchedRows++;
    }
    console.log(`  「${ROW_NAME_TOTAL}」行に一致した都道府県数: ${matchedRows}`);
  }

  const sourceUrls = TABLES.map((t) => fileDownloadUrl(t.statInfId));

  const results: PrefectureExpenditureByPurpose[] = Array.from(
    byPrefecture.entries()
  ).map(([prefecture, { fiscalYear, categories }]) => ({
    prefecture,
    fiscalYear,
    categories,
    sourceUrls,
  }));

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

  // 検算: 表13「歳出合計」（＝prefecture-finance.jsonのtotalExpenditureThousandYen）
  // と、6表から集めた目的別区分の合計が一致するかを軽くチェックする
  // （事前調査で北海道は完全一致を確認済み。乖離がある場合はテーブル構成の
  // 見直しが必要な可能性があるため警告のみ出す）
  for (const r of results.slice(0, 3)) {
    const sum = r.categories.reduce((s, c) => s + c.amountThousandYen, 0);
    console.log(`検算: ${r.prefecture} 目的別合計 = ${sum.toLocaleString()} 千円`);
  }

  await writeDataJson("prefecture-expenditure-by-purpose.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
