/**
 * 国の税収・歳出データ取得スクリプト（機能拡充ロードマップ Tier1 #2「国の税収・歳出ビューア」）。
 *
 * データソース: 財務省
 *   - 税制ページ「税収に関する資料」
 *     https://www.mof.go.jp/tax_policy/summary/condition/a03.htm
 *     → 「昭和54年度（1979年度）以降の税収の推移」
 *        https://www.mof.go.jp/tax_policy/summary/condition/zeisyu.xls
 *   - 予算・決算ページ「財政統計（予算決算等データ）」
 *     https://www.mof.go.jp/policy/budget/reference/statistics/data.htm
 *     → 第4表  昭和57年度以降 一般会計歳入主要科目別決算  statistics/04.xlsx
 *     → 第20表 昭和42年度以降 主要経費別分類による一般会計歳出予算現額及び決算額 statistics/20.xlsx
 *     → 第24表 平成9年度以降 一般会計歳出決算目的別分類     statistics/24.xlsx
 *
 * 調査結果（2026-08-11、実ファイルをfetchして構造を確認）:
 *   - 4ファイルとも固定URLで直接200を返す。**Shift_JIS対応は不要**
 *     （xlsx/xlsはバイナリ、文字列はUTF-16で内包されるため`xlsx`でそのまま読める）。
 *     このプロジェクトで初めてShift_JISデコードが要らないデータ源。
 *   - zeisyu.xls: シート1枚（"S54~R7"）。B列=元号、C列=和暦年、D列=西暦、
 *     E列=一般会計税収、F列=所得税収、G列=法人税収、H列=消費税収。単位は億円。
 *     消費税導入前（〜昭和63年度）のH列は"ー"。
 *     所得税・法人税・消費税以外の税目（相続税・酒税・揮発油税・印紙収入等）は
 *     この表に内訳がないため、`一般会計税収 −（所得税＋法人税＋消費税）`の
 *     残差を「その他の税収」として1区分にまとめている（単純な引き算のみで、
 *     独自の再分類・推計は行っていない）。
 *   - 04.xlsx: シート1枚（"4表"）。単位は百万円。列は
 *     租税/印紙収入/計・専売納付金(3列)・官業益金及び官業収入・政府資産整理収入・
 *     雑収入・公債金・前年度剰余金受入・合計。原表の注2にあるとおり、
 *     一部年度は決算調整資金からの受入があり主要科目の単純合計と合計が
 *     一致しないため、その差額を「決算調整資金受入等」として1区分にしている。
 *   - 20.xlsx: 年度ごとに1シート（"昭和42"〜"令和6"＋"（注）"）。単位は千円。
 *     B列=主要経費別の区分名、D列=予算現額、E列=決算額、F列=差引額。
 *     「（社会保障関係費）」のように括弧付きの行はグループ見出しで、
 *     その配下の明細行のあとに来る「計」がグループ計。取得するのは**決算額**のみ。
 *   - 24.xlsx: シート1枚（"24表"）。単位は千円。1行＝目的別区分、
 *     E列以降が年度（平成9年度〜令和6年度）の横持ち。A列に大区分名、
 *     B列に丸数字・C列に細目名が入る2階層構造。
 *   - 利用規約: 財務省ウェブサイトは政府標準利用規約（第2.0版）準拠。
 *     出典を明記すれば商用・非商用問わず複製・加工・再配布が可能。
 *
 * 【政治的中立性についての設計判断（重要・変更禁止）】
 *   - 個別税目 → 個別経費のフロー図（サンキー図）は**作らない**。一般会計は
 *     ノンアフェクタシオンの原則（特定の歳入を特定の歳出に紐づけない）で
 *     運用されており、税目と経費を結ぶ線は事実に反する。法律上明記された
 *     例外（消費税法第1条第2項の社会保障目的、地方交付税法第6条の法定率）は
 *     `src/lib/nationalBudgetStats.ts`側で根拠条文つきの注記として別枠で扱う。
 *   - 「年収を入力するとあなたの税金の使い道がわかる」型のパーソナライズ計算は
 *     作らない（推計モデル自体が編集判断を含むため）。
 *   - いわゆる「ワニの口」（税収と歳出の乖離の強調）表現は作らない。公債金は
 *     歳入の一科目として、他の科目と同じ扱い・同じ配色で淡々と表示する。
 *   - 区分は財務省の公式分類（主要経費別・目的別・主要科目別）をそのまま使い、
 *     独自に再集約・再定義しない（上記2つの残差区分のみ、原表の注記に沿った
 *     引き算として明示的に設けている）。
 *   - 「無駄」「削減余地」「効率」等の評価語はデータ・UIとも一切使わない。
 *   - 単年度の絶対額だけを見せず、必ず年度推移を併置する。
 *
 * 【既知の制約・運用上の注意】
 *   - 4つのURLはいずれも年度によらない固定パスで、財務省が年1回（例年秋〜冬）
 *     内容を更新する。URL自体は変わらないため、日次で再実行していれば
 *     最新年度が自動的に増えていく（statInfIdの手動更新が必要だった
 *     e-Stat系スクリプトと異なり、手動メンテは原則不要）。
 *   - zeisyu.xlsには決算年度より先の年度（予算額ベース）が含まれる。
 *     第4表（歳入決算）の最新年度を「決算が確定している最新年度」とみなし、
 *     それより新しい年度には`isSettlement: false`を立てている。
 *
 * 実行: npm run fetch:national-budget
 */
import * as XLSX from "xlsx";
import type {
  NationalBudget,
  NationalBudgetItem,
  NationalBudgetSeries,
  NationalBudgetYear,
} from "../src/types";
import { writeDataJson } from "./lib/writeJson";

const URL_TAX_REVENUE =
  "https://www.mof.go.jp/tax_policy/summary/condition/zeisyu.xls";
const URL_TABLE_04 =
  "https://www.mof.go.jp/policy/budget/reference/statistics/04.xlsx";
const URL_TABLE_20 =
  "https://www.mof.go.jp/policy/budget/reference/statistics/20.xlsx";
const URL_TABLE_24 =
  "https://www.mof.go.jp/policy/budget/reference/statistics/24.xlsx";

/** 原資料の金額単位 → 千円への換算係数 */
const THOUSAND_YEN_PER = {
  千円: 1,
  百万円: 1_000,
  億円: 100_000,
} as const;

async function fetchWorkbook(url: string): Promise<XLSX.WorkBook> {
  console.log(`取得: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Excel取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }
  return XLSX.read(await res.arrayBuffer(), { type: "array" });
}

function sheetRows(wb: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(
      `シート「${sheetName}」が見つかりませんでした。実際のシート名: ${wb.SheetNames.join(", ")}`
    );
  }
  return XLSX.utils
    .sheet_to_json<unknown[]>(ws, { header: 1, raw: true })
    .map((row) => (Array.isArray(row) ? row : []));
}

/** 全角英数を半角に、全角スペース・改行・空白をすべて除去して正規化する */
function normalizeLabel(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]/g, "");
}

/** 原資料で「該当なし」を表すダッシュ類（年度・作成者によって表記ゆれがある） */
const DASHES = new Set(["-", "ー", "―", "－", "‐", "—", "･", ""]);

function toAmountOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = normalizeLabel(raw);
  if (DASHES.has(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 元号＋和暦年 → 西暦の年度。"元"は1年として扱う */
function toFiscalYear(era: string, waRaw: string): number | null {
  const wa = waRaw === "元" ? 1 : Number(normalizeLabel(waRaw));
  if (!Number.isFinite(wa) || wa <= 0) return null;
  const base = era === "昭和" ? 1925 : era === "平成" ? 1988 : era === "令和" ? 2018 : null;
  return base === null ? null : base + wa;
}

function eraLabel(fiscalYear: number): string {
  if (fiscalYear >= 2019) {
    const n = fiscalYear - 2018;
    return `令和${n === 1 ? "元" : n}年度`;
  }
  if (fiscalYear >= 1989) return `平成${fiscalYear - 1988}年度`;
  return `昭和${fiscalYear - 1925}年度`;
}

function scale(value: number | null, unit: keyof typeof THOUSAND_YEN_PER): number | null {
  return value === null ? null : Math.round(value * THOUSAND_YEN_PER[unit]);
}

/** 区分名の掲載順（原資料の順）を、全年度をまたいで安定して積み上げる */
function collectCategoryNames(years: NationalBudgetYear[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const year of years) {
    for (const item of year.items) {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        order.push(item.name);
      }
    }
  }
  return order;
}

// ---------------------------------------------------------------------------
// 1. 税収の推移（zeisyu.xls）
// ---------------------------------------------------------------------------

const TAX_OTHER_NAME = "その他の税収";

async function parseTaxRevenue(): Promise<NationalBudgetYear[]> {
  const wb = await fetchWorkbook(URL_TAX_REVENUE);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("zeisyu.xls にシートがありません。");
  const rows = sheetRows(wb, sheetName);

  const headerIndex = rows.findIndex(
    (row) => normalizeLabel(row[3]) === "一般会計税収"
  );
  if (headerIndex === -1) {
    throw new Error(
      "zeisyu.xls のヘッダー行（一般会計税収）が見つかりませんでした。シート構成が変わった可能性があります。"
    );
  }

  const years: NationalBudgetYear[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    // D列（index 2）に西暦年度が直接入っているので元号の解釈は不要
    const fiscalYear = toAmountOrNull(row[2]);
    if (fiscalYear === null || fiscalYear < 1900 || fiscalYear > 2100) continue;

    const total = toAmountOrNull(row[3]);
    if (total === null) continue;
    const income = toAmountOrNull(row[4]);
    const corporate = toAmountOrNull(row[5]);
    const consumption = toAmountOrNull(row[6]);
    const other = total - (income ?? 0) - (corporate ?? 0) - (consumption ?? 0);

    years.push({
      fiscalYear,
      eraLabel: eraLabel(fiscalYear),
      totalThousandYen: scale(total, "億円"),
      // 並び順は原資料の列順（所得税→法人税→消費税）＋残差
      items: [
        { name: "所得税", amountThousandYen: scale(income, "億円") },
        { name: "法人税", amountThousandYen: scale(corporate, "億円") },
        { name: "消費税", amountThousandYen: scale(consumption, "億円") },
        { name: TAX_OTHER_NAME, amountThousandYen: scale(other, "億円") },
      ],
      isSettlement: true, // 後段（決算確定年度の判定）で上書きする
    });
  }
  console.log(`  税収の推移: ${years.length}年度分（${years[0]?.fiscalYear}〜${years.at(-1)?.fiscalYear}）`);
  return years;
}

// ---------------------------------------------------------------------------
// 2. 一般会計歳入 主要科目別決算（第4表）
// ---------------------------------------------------------------------------

/** 第4表の列位置（index）→ 区分名。原表のヘッダー表記をそのまま使う */
const TABLE_04_COLUMNS: { index: number; name: string }[] = [
  { index: 6, name: "租税及印紙収入" },
  { index: 9, name: "専売納付金" },
  { index: 10, name: "官業益金及び官業収入" },
  { index: 11, name: "政府資産整理収入" },
  { index: 12, name: "雑収入" },
  { index: 13, name: "公債金" },
  { index: 14, name: "前年度剰余金受入" },
];
const TABLE_04_TOTAL_INDEX = 15;
/**
 * 主要科目の単純合計と原表の合計額との差額に与える区分名。
 * 原表の注2・注3によれば、この差額の中身は
 *   - 決算調整資金からの受入（平成4・5・9・13・20年度）
 *   - いわゆる「つなぎ公債」（湾岸地域の平和活動支援の臨時特別公債＝平成2年度、
 *     減税特例公債＝平成6〜8年度、復興債＝平成23年度、年金特例公債＝平成24・25年度）
 * であり、いずれも原表では独立した主要科目の列を持たない。
 */
const TABLE_04_RESIDUAL_NAME = "つなぎ公債・決算調整資金受入等";

async function parseRevenueByMajorItem(): Promise<NationalBudgetYear[]> {
  const wb = await fetchWorkbook(URL_TABLE_04);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("04.xlsx にシートがありません。");
  const rows = sheetRows(wb, sheetName);

  // ヘッダーの妥当性チェック（列位置がずれていたら以降の解釈がすべて崩れるため）
  const headerRow = rows.find((row) => normalizeLabel(row[13]) === "公債金");
  if (!headerRow || normalizeLabel(headerRow[15]) !== "合計") {
    throw new Error(
      "第4表のヘッダー行（公債金・合計）が想定位置に見つかりませんでした。列構成が変わった可能性があります。"
    );
  }

  const years: NationalBudgetYear[] = [];
  let era = "";
  for (const row of rows) {
    const eraCell = normalizeLabel(row[0]);
    if (eraCell === "昭和" || eraCell === "平成" || eraCell === "令和") era = eraCell;
    if (!era) continue;

    const waCell = normalizeLabel(row[1]);
    if (!waCell) continue;
    const fiscalYear = toFiscalYear(era, waCell);
    if (fiscalYear === null) continue;

    const total = toAmountOrNull(row[TABLE_04_TOTAL_INDEX]);
    if (total === null) continue;

    const items: NationalBudgetItem[] = TABLE_04_COLUMNS.map(({ index, name }) => ({
      name,
      amountThousandYen: scale(toAmountOrNull(row[index]), "百万円"),
    }));
    // 原表の注2・注3（決算調整資金からの受入、つなぎ公債）により、主要科目の
    // 単純合計と合計は一致しない年度がある。その差額を1区分として明示する
    // （1百万円以下の端数は原表の四捨五入によるものなので0扱いにする）
    const itemsSum = items.reduce((s, i) => s + (i.amountThousandYen ?? 0), 0);
    const residual = scale(total, "百万円")! - itemsSum;
    items.push({
      name: TABLE_04_RESIDUAL_NAME,
      amountThousandYen: Math.abs(residual) <= THOUSAND_YEN_PER.百万円 ? 0 : residual,
    });

    years.push({
      fiscalYear,
      eraLabel: eraLabel(fiscalYear),
      totalThousandYen: scale(total, "百万円"),
      items,
      isSettlement: true,
    });
  }
  console.log(
    `  歳入主要科目別決算: ${years.length}年度分（${years[0]?.fiscalYear}〜${years.at(-1)?.fiscalYear}）`
  );
  return years;
}

// ---------------------------------------------------------------------------
// 3. 一般会計歳出決算 主要経費別（第20表）
// ---------------------------------------------------------------------------

const TABLE_20_HEADER_LABEL = "主要経費別";
const TABLE_20_TOTAL_LABEL = "合計";
/** グループ計・主要経費計など、明細と二重計上になるためスキップする行 */
const TABLE_20_SKIP_LABELS = new Set(["小計", "主要経費計", "総合計"]);
const TABLE_20_EXPENDITURE_COLUMN = 4; // E列＝決算額（D列は予算現額なので使わない）

async function parseExpenditureByMajorExpense(): Promise<NationalBudgetYear[]> {
  const wb = await fetchWorkbook(URL_TABLE_20);
  const years: NationalBudgetYear[] = [];

  for (const sheetName of wb.SheetNames) {
    const label = normalizeLabel(sheetName);
    const m = label.match(/^(昭和|平成|令和)(元|\d+)$/);
    if (!m) continue; // "（注）"シート等
    const fiscalYear = toFiscalYear(m[1]!, m[2]!);
    if (fiscalYear === null) continue;

    const rows = sheetRows(wb, sheetName);
    const items: NationalBudgetItem[] = [];
    let group: NationalBudgetItem | null = null;
    let total: number | null = null;

    for (const row of rows) {
      const name = normalizeLabel(row[1]);
      if (!name || name === TABLE_20_HEADER_LABEL) continue;
      const amount = toAmountOrNull(row[TABLE_20_EXPENDITURE_COLUMN]);

      const groupMatch = name.match(/^（(.+)）$/);
      if (groupMatch) {
        group = { name: groupMatch[1]!, amountThousandYen: null, subItems: [] };
        continue;
      }
      if (name === TABLE_20_TOTAL_LABEL) {
        total = amount;
        break; // 合計より後ろの行（決算不足補てん繰戻・総合計）は内訳ではない
      }
      if (TABLE_20_SKIP_LABELS.has(name)) continue;

      if (name === "計") {
        // グループ計。ここでグループを1区分として確定させる
        if (group) {
          group.amountThousandYen = amount;
          items.push(group);
          group = null;
        }
        continue;
      }
      if (group) {
        group.subItems!.push({ name, amountThousandYen: amount });
        continue;
      }
      items.push({ name, amountThousandYen: amount });
    }

    if (total === null) {
      console.warn(`  【警告】シート「${sheetName}」の合計行が見つかりませんでした。スキップします。`);
      continue;
    }
    years.push({
      fiscalYear,
      eraLabel: eraLabel(fiscalYear),
      totalThousandYen: total,
      items,
      isSettlement: true,
    });
  }

  years.sort((a, b) => a.fiscalYear - b.fiscalYear);
  console.log(
    `  歳出決算 主要経費別: ${years.length}年度分（${years[0]?.fiscalYear}〜${years.at(-1)?.fiscalYear}）`
  );
  return years;
}

// ---------------------------------------------------------------------------
// 4. 一般会計歳出決算 目的別（第24表）
// ---------------------------------------------------------------------------

const TABLE_24_TOTAL_LABEL = "合計";

async function parseExpenditureByPurpose(): Promise<NationalBudgetYear[]> {
  const wb = await fetchWorkbook(URL_TABLE_24);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("24.xlsx にシートがありません。");
  const rows = sheetRows(wb, sheetName);

  // 年度ヘッダー行（"平成９年度","10",… ,"令和元年度","2",…）を探す
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => /^(平成|令和)(元|\d+)年度$/.test(normalizeLabel(cell)))
  );
  if (headerIndex === -1) {
    throw new Error(
      "第24表の年度ヘッダー行が見つかりませんでした。シート構成が変わった可能性があります。"
    );
  }
  const headerRow = rows[headerIndex]!;

  // 列index → 年度（西暦）。元号セルが出てくるまでは直前の元号を引き継ぐ
  const yearColumns: { index: number; fiscalYear: number }[] = [];
  let era = "";
  headerRow.forEach((cell, index) => {
    const label = normalizeLabel(cell);
    if (!label) return;
    const withEra = label.match(/^(昭和|平成|令和)(元|\d+)年度$/);
    if (withEra) {
      era = withEra[1]!;
      const fy = toFiscalYear(era, withEra[2]!);
      if (fy !== null) yearColumns.push({ index, fiscalYear: fy });
      return;
    }
    const bare = label.match(/^(元|\d+)$/);
    if (bare && era) {
      const fy = toFiscalYear(era, bare[1]!);
      if (fy !== null) yearColumns.push({ index, fiscalYear: fy });
    }
  });
  if (yearColumns.length === 0) {
    throw new Error("第24表の年度列を1つも解釈できませんでした。");
  }

  // 行を「大区分（A列に名称）」「細目（B列に丸数字・C列に名称）」に分けて読む
  const categories: { name: string; amounts: Map<number, number | null>; subItems: typeof categories }[] =
    [];
  const totals = new Map<number, number | null>();

  const readAmounts = (row: unknown[]) => {
    const map = new Map<number, number | null>();
    for (const { index, fiscalYear } of yearColumns) {
      map.set(fiscalYear, toAmountOrNull(row[index]));
    }
    return map;
  };

  for (const row of rows.slice(headerIndex + 1)) {
    const majorRaw = normalizeLabel(row[0]);
    const minorRaw = normalizeLabel(row[2]);

    if (majorRaw) {
      if (majorRaw === TABLE_24_TOTAL_LABEL) {
        for (const [fy, v] of readAmounts(row)) totals.set(fy, v);
        continue;
      }
      // "１．国家機関費" / "10.経済危機対応・地域活性化予備費" のような連番を落とす
      const name = majorRaw.replace(/^[0-9０-９]+[．.]\s*/, "");
      if (!name) continue;
      categories.push({ name, amounts: readAmounts(row), subItems: [] });
      continue;
    }
    if (minorRaw && categories.length > 0) {
      categories.at(-1)!.subItems.push({
        name: minorRaw,
        amounts: readAmounts(row),
        subItems: [],
      });
    }
  }

  const years: NationalBudgetYear[] = yearColumns.map(({ fiscalYear }) => ({
    fiscalYear,
    eraLabel: eraLabel(fiscalYear),
    totalThousandYen: totals.get(fiscalYear) ?? null,
    items: categories.map((c) => ({
      name: c.name,
      amountThousandYen: c.amounts.get(fiscalYear) ?? null,
      subItems: c.subItems.map((s) => ({
        name: s.name,
        amountThousandYen: s.amounts.get(fiscalYear) ?? null,
      })),
    })),
    isSettlement: true,
  }));

  console.log(
    `  歳出決算 目的別: ${years.length}年度分（${years[0]?.fiscalYear}〜${years.at(-1)?.fiscalYear}）、区分${categories.length}件`
  );
  return years;
}

// ---------------------------------------------------------------------------

/** 内訳の合計と原表の合計が一致するかを検算し、乖離があれば警告する */
function verifyTotals(title: string, years: NationalBudgetYear[], toleranceRatio = 1e-6) {
  for (const year of years.slice(-3)) {
    const sum = year.items.reduce((s, i) => s + (i.amountThousandYen ?? 0), 0);
    const total = year.totalThousandYen ?? 0;
    const diff = sum - total;
    const ok = total === 0 || Math.abs(diff) / Math.abs(total) < toleranceRatio;
    console.log(
      `  検算 ${title} ${year.eraLabel}: 内訳計=${sum.toLocaleString()} 合計=${total.toLocaleString()} 差=${diff.toLocaleString()}千円 ${ok ? "OK" : "【要確認】"}`
    );
  }
}

function toSeries(
  base: Omit<NationalBudgetSeries, "categoryNames" | "years">,
  years: NationalBudgetYear[]
): NationalBudgetSeries {
  return { ...base, categoryNames: collectCategoryNames(years), years };
}

async function main() {
  const [taxYears, revenueYears, majorExpenseYears, purposeYears] = [
    await parseTaxRevenue(),
    await parseRevenueByMajorItem(),
    await parseExpenditureByMajorExpense(),
    await parseExpenditureByPurpose(),
  ];

  // 「決算が確定している最新年度」＝歳入決算（第4表）の最新年度。
  // 税収の推移（zeisyu.xls）はそれより先の年度（予算額ベース）を含むため、
  // その年度には isSettlement:false を立てる
  const latestSettlementFiscalYear = revenueYears.at(-1)?.fiscalYear;
  if (latestSettlementFiscalYear === undefined) {
    throw new Error("歳入決算（第4表）から年度を1つも取得できませんでした。");
  }
  for (const year of taxYears) {
    year.isSettlement = year.fiscalYear <= latestSettlementFiscalYear;
  }
  console.log(`決算確定の最新年度: ${eraLabel(latestSettlementFiscalYear)}（${latestSettlementFiscalYear}年度）`);

  verifyTotals("税収", taxYears);
  verifyTotals("歳入主要科目別", revenueYears);
  verifyTotals("歳出主要経費別", majorExpenseYears);
  verifyTotals("歳出目的別", purposeYears);

  const budget: NationalBudget = {
    generatedAt: new Date().toISOString(),
    latestSettlementFiscalYear,
    taxRevenue: toSeries(
      {
        title: "税収の推移（税目別）",
        sourceTitle: "財務省「昭和54年度（1979年度）以降の税収の推移」",
        sourceUrl: URL_TAX_REVENUE,
        sourcePageUrl: "https://www.mof.go.jp/tax_policy/summary/condition/a03.htm",
        sourceUnit: "億円",
        amountKind: "税収",
      },
      taxYears
    ),
    revenueByMajorItem: toSeries(
      {
        title: "一般会計歳入 主要科目別決算",
        sourceTitle: "財務省 財政統計 第4表「昭和57年度以降一般会計歳入主要科目別決算」",
        sourceUrl: URL_TABLE_04,
        sourcePageUrl: "https://www.mof.go.jp/policy/budget/reference/statistics/data.htm",
        sourceUnit: "百万円",
        amountKind: "決算額",
      },
      revenueYears
    ),
    expenditureByMajorExpense: toSeries(
      {
        title: "一般会計歳出決算 主要経費別",
        sourceTitle:
          "財務省 財政統計 第20表「昭和42年度以降主要経費別分類による一般会計歳出予算現額及び決算額」",
        sourceUrl: URL_TABLE_20,
        sourcePageUrl: "https://www.mof.go.jp/policy/budget/reference/statistics/data.htm",
        sourceUnit: "千円",
        amountKind: "決算額",
      },
      majorExpenseYears
    ),
    expenditureByPurpose: toSeries(
      {
        title: "一般会計歳出決算 目的別",
        sourceTitle: "財務省 財政統計 第24表「平成9年度以降一般会計歳出決算目的別分類」",
        sourceUrl: URL_TABLE_24,
        sourcePageUrl: "https://www.mof.go.jp/policy/budget/reference/statistics/data.htm",
        sourceUnit: "千円",
        amountKind: "決算額",
      },
      purposeYears
    ),
  };

  await writeDataJson("national-budget.json", budget);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
