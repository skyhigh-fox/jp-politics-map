/**
 * 都道府県別・財政健全化指標データ取得スクリプト（予算の見える化 Phase B）。
 *
 * データソース: 総務省「主要財政指標一覧」（都道府県分）
 *   紹介ページ: https://www.soumu.go.jp/iken/shihyo_ichiran.html
 *   対象年度ページ: https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000135.html
 *     （「令和6年度主要財政指標一覧」）
 *   ダウンロードExcel: https://www.soumu.go.jp/main_content/001044528.xlsx
 *     （「全都道府県の主要財政指標」、シート名「全都道府県の主要財政指標」1枚のみ）
 *
 * 調査結果（2026-08-11、実URLをfetchして確認）:
 *   - 当初は既存スクリプト群と同じe-Stat「地方財政状況調査」都道府県分
 *     （toukei=00200251）の表を探したが、実際にe-Statの統計表一覧
 *     （表01〜96、年度分すべて実データで確認）を洗い出した結果、
 *     財政力指数・実質公債費比率・経常収支比率・将来負担比率をまとめて
 *     収録した表は**e-Stat側には存在しない**ことを確認した
 *     （表01「団体の概況」に財政力指数の列はあるが、他3指標は
 *     どの表にも見当たらない。前回調査で候補に挙がっていた「35 公債費比率等の
 *     状況」という表番号自体、令和6年度・令和5年度いずれの年度分一覧にも
 *     存在しなかった＝欠番）
 *   - 代わりに総務省サイト本体（e-Statを介さない直接公表ページ）に
 *     「主要財政指標一覧」という年度ごとのページがあり、そこから
 *     「全都道府県の主要財政指標」というExcelファイル1枚をダウンロードすると、
 *     財政力指数・経常収支比率・実質公債費比率・将来負担比率・
 *     ラスパイレス指数の5指標が47都道府県分＋全国平均行（1行）で
 *     まとまって収録されていることを確認した（シートを1枚fetchして実データ確認済み）
 *   - シート内の財政力指数はe-Stat表01「団体の概況」の
 *     `006:財政力指数（4～6年度）`列（例:北海道 46275 → 0.46275）と
 *     完全一致することを確認済み（クロスチェック済み、同一の一次データ）
 *   - 単位: 財政力指数は無単位の比率（小数）、経常収支比率・実質公債費比率・
 *     将来負担比率は%。シートの値をそのまま使用する（丸め処理はしない）
 *   - 利用規約: 総務省ウェブサイトは政府標準利用規約（第2.0版）準拠。
 *     出典表記をすれば商用・非商用問わず自由利用可
 *
 * 【既知の制約・運用上の注意】
 *   - `EXCEL_URL`は「令和6年度主要財政指標一覧」という個別公開ページに
 *     対して発行された固定パス（`/main_content/001044528.xlsx`）。総務省が
 *     次年度分（令和7年度、例年12月頃公表）を新規公開すると、新しい
 *     ページ・新しいファイルパスが発行され、このURLは指し先が変わらないまま
 *     古い年度のデータを返し続ける（＝リンク切れにはならないが更新されない）。
 *     年1回、`https://www.soumu.go.jp/iken/shihyo_ichiran.html` で最新年度の
 *     「主要財政指標一覧」ページへのリンクを確認し、そのページ内の
 *     「全都道府県の主要財政指標」Excelのリンク先URLを確認して
 *     下記`EXCEL_URL`を手動更新する必要がある
 *   - 実質公債費比率・将来負担比率の公式基準値（早期健全化基準・財政再生基準）
 *     は `src/types/index.ts` の `FINANCIAL_HEALTH_STANDARDS` に定数として
 *     保持している（法律改正がない限り年次更新は不要）
 *
 * 実行: npm run fetch:prefecture-financial-health
 */
import * as XLSX from "xlsx";
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type { PrefectureFinancialHealth } from "../src/types";
import { writeDataJson } from "./lib/writeJson";

const EXCEL_URL = "https://www.soumu.go.jp/main_content/001044528.xlsx";

// シート名は「全都道府県の主要財政指標」（実データで確認済み、ブック内シートは1枚のみ）
const SHEET_NAME = "全都道府県の主要財政指標";

// ヘッダー行（"都道府県名","財政力指数",...）の列名
const COL_PREFECTURE = "都道府県名";
const COL_FINANCIAL_STRENGTH = "財政力指数";
const COL_CURRENT_BALANCE = "経常収支比率";
const COL_REAL_DEBT_SERVICE = "実質公債費比率";
const COL_FUTURE_BURDEN = "将来負担比率";

async function fetchExcelBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Excel取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }
  return res.arrayBuffer();
}

function toNumberOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "" || raw === "-") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log(`総務省「全都道府県の主要財政指標」を取得: ${EXCEL_URL}`);
  const buf = await fetchExcelBuffer(EXCEL_URL);
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!ws) {
    throw new Error(
      `シート「${SHEET_NAME}」が見つかりませんでした。実際のシート名: ${wb.SheetNames.join(", ")}`
    );
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  // タイトル行（例:"全都道府県の主要財政指標（令和６年度）"）の次にヘッダー行がある
  const headerRowIndex = rows.findIndex(
    (row) => Array.isArray(row) && row[0] === COL_PREFECTURE
  );
  if (headerRowIndex === -1) {
    throw new Error(
      "ヘッダー行（都道府県名列）が見つかりませんでした。シート構成が変わった可能性があります。"
    );
  }
  const headerRow = rows[headerRowIndex];
  if (!headerRow) {
    throw new Error("ヘッダー行の取得に失敗しました。");
  }

  // タイトル行から決算年度（西暦）を読み取る（例:"（令和６年度）" → 2024）。
  // 全角数字（６年度）で書かれているため、半角数字に正規化してからマッチする
  const toHalfWidthDigits = (s: string): string =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const titleRow = rows[0];
  const titleText = toHalfWidthDigits(
    Array.isArray(titleRow) ? String(titleRow[0] ?? "") : ""
  );
  const reiwaMatch = titleText.match(/令和(\d+|元)年度/);
  if (!reiwaMatch) {
    throw new Error(
      `タイトル行から決算年度を読み取れませんでした: "${titleText}"。シート構成が変わった可能性があります。`
    );
  }
  const reiwaYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
  const fiscalYear = 2018 + reiwaYear; // 令和元年=2019年度 → 2018+1=2019
  console.log(`決算年度: 令和${reiwaMatch[1]}年度（西暦${fiscalYear}年度）`);

  const colIndex = (name: string): number => {
    const idx = headerRow.indexOf(name);
    if (idx === -1) {
      throw new Error(`列「${name}」が見つかりませんでした。シート構成が変わった可能性があります。`);
    }
    return idx;
  };
  const idxPrefecture = colIndex(COL_PREFECTURE);
  const idxFinancialStrength = colIndex(COL_FINANCIAL_STRENGTH);
  const idxCurrentBalance = colIndex(COL_CURRENT_BALANCE);
  const idxRealDebtService = colIndex(COL_REAL_DEBT_SERVICE);
  const idxFutureBurden = colIndex(COL_FUTURE_BURDEN);

  const results: PrefectureFinancialHealth[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const prefecture = String(row[idxPrefecture] ?? "").trim();
    if (!(prefecture in PREFECTURE_CODES)) continue; // "都道府県平均"行・空行等を除外

    const financialStrengthIndex = toNumberOrNull(row[idxFinancialStrength]);
    const currentBalanceRatio = toNumberOrNull(row[idxCurrentBalance]);
    const realDebtServiceRatio = toNumberOrNull(row[idxRealDebtService]);
    const futureBurdenRatio = toNumberOrNull(row[idxFutureBurden]);

    if (
      financialStrengthIndex === null ||
      currentBalanceRatio === null ||
      realDebtServiceRatio === null
    ) {
      console.warn(`スキップ（数値パース失敗）: ${prefecture}`, row);
      continue;
    }

    results.push({
      prefecture,
      fiscalYear,
      financialStrengthIndex,
      currentBalanceRatio,
      realDebtServiceRatio,
      futureBurdenRatio, // データがない場合はnull（今回取得分は全都道府県で実測値あり）
      sourceUrl: EXCEL_URL,
    });
  }

  results.sort(
    (a, b) => Number(PREFECTURE_CODES[a.prefecture]) - Number(PREFECTURE_CODES[b.prefecture])
  );

  if (results.length !== 47) {
    console.warn(
      `【警告】都道府県数が47件になりませんでした（実際: ${results.length}件）。` +
        `総務省側のExcelレイアウトが変わっている可能性があるため確認してください。`
    );
  } else {
    console.log("47都道府県すべて取得できました。");
  }

  await writeDataJson("prefecture-financial-health.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
