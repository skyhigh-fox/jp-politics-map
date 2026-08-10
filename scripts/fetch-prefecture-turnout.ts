/**
 * 都道府県別・投票率データ取得スクリプト（機能拡充ロードマップ Tier1 #7「投票率マップ」）。
 *
 * データソース: 総務省「選挙関連資料」配下の各回選挙結果調
 *   一覧ページ:
 *     衆議院 https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin/ichiran.html
 *     参議院 https://www.soumu.go.jp/senkyo/senkyo_s/data/sangiin/ichiran.html
 *   各回の個別ページ（例: .../data/shugiin51/index.html）に、表ごとに
 *   1ファイルずつExcelが掲載されている。
 *
 * 調査結果（2026-08-11、実ファイルをダウンロードして確認）:
 *   - 衆議院: 各回ページに「都道府県別投票率（小選挙区）」というExcelがあり、
 *     47都道府県＋全国計について**男・女・計**の投票率（%）が
 *     そのまま数値で入っている。第46回（2012年）以降の8回分すべてで
 *     同じ様式（レイアウトの細部は年により異なるが、後述のパーサで吸収できる）。
 *     ※比例代表の投票率も別ファイルで公表されているが、小選挙区とほぼ同値
 *       （小数第2位で数百分の1程度の差）なので、代表として小選挙区を採用した。
 *   - 参議院: 各回ページの「都道府県別有権者数、投票者数、投票率（選挙区）」は
 *     実際には有権者数・投票者数・棄権者数の**実数**しか収録しておらず、
 *     投票率（%）が入っているのは同名の**（比較）**ファイルのほう
 *     （前回投票率との比較表で、その先頭3列が当該回の男・女・計の投票率）。
 *     そのため参議院は（比較）ファイルを取得元にしている。
 *   - どちらの院も、シート内の表は
 *       [都道府県名, 当該回 男, 当該回 女, 当該回 計, 前回 男, 前回 女, 前回 計, 差 男, 差 女, 差 計]
 *     という10列構成で、`男/女/計` が並ぶヘッダ行の位置だけが年によって
 *     前後する（0〜5行目のどこか）。パーサはヘッダ行を探索して吸収している。
 *   - 参議院の表末尾には「（再掲）」として合区（鳥取県・島根県／徳島県・高知県）の
 *     行があるが、その直前までに鳥取県・島根県・徳島県・高知県それぞれ単独の
 *     行も存在する。本スクリプトは都道府県名が PREFECTURE_CODES に
 *     一致する行だけを採用するため、合区の再掲行は自動的に除外される。
 *   - 男女別の区分は選挙人名簿上の性別によるもので、原資料の区分をそのまま
 *     保持している（本サイトが独自に分類したものではない）。
 *   - 利用規約: 総務省ウェブサイトは政府標準利用規約（第2.0版）準拠。
 *     出典表記をすれば商用・非商用問わず自由利用可。
 *
 * 【既知の制約・運用上の注意】
 *   - 下記 `ELECTIONS` のExcel URLは、総務省が各回の公表時に発行する固定パス
 *     （/main_content/XXXXXXXXX.xls(x)）で、回次ごとに手で登録している。
 *     新しい国政選挙が執行されたら、上記の一覧ページから新しい回のページを開き、
 *     「都道府県別投票率（小選挙区）」（衆）/「都道府県別有権者数、投票者数、
 *     投票率（選挙区）（比較）」（参）のリンク先URLを調べて `ELECTIONS` に
 *     1件追記する（自動追随はしない）。
 *   - 過去回のファイルURLは変化しないため、既存分の再取得結果は基本的に不変。
 *
 * 実行: npm run fetch:prefecture-turnout
 */
import * as XLSX from "xlsx";
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type {
  PrefectureTurnoutElection,
  PrefectureTurnoutEntry,
  TurnoutRates,
} from "../src/types";
import { writeDataJson } from "./lib/writeJson";

interface ElectionSource {
  id: string;
  chamber: "衆議院" | "参議院";
  round: number;
  electionName: string;
  /** 投票日（YYYY-MM-DD） */
  electionDate: string;
  votingCategory: "小選挙区" | "選挙区";
  /** 投票率が収録されたExcelの直リンク */
  sourceUrl: string;
  /** 上記Excelが掲載されている総務省のページ */
  sourcePageUrl: string;
}

const SHUGIIN_PAGE = (n: number) =>
  `https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin${n}/index.html`;
const SANGIIN_PAGE = (n: number) =>
  `https://www.soumu.go.jp/senkyo/senkyo_s/data/sangiin${n}/index.html`;

/**
 * 収録対象の国政選挙。
 *
 * 「時系列で推移を見せる」という要件のため、衆参それぞれ直近5〜6回
 * （2012年〜）を対象にした。これより前の回も総務省サイトに掲載はあるが、
 * Excelの様式が回ごとに大きく異なるため、様式が安定している範囲に絞っている。
 * 並び順は投票日の昇順（推移グラフの並びと一致させる）。
 */
const ELECTIONS: ElectionSource[] = [
  {
    id: "shugiin-46",
    chamber: "衆議院",
    round: 46,
    electionName: "第46回衆議院議員総選挙",
    electionDate: "2012-12-16",
    votingCategory: "小選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000194178.xls",
    sourcePageUrl: SHUGIIN_PAGE(46),
  },
  {
    id: "sangiin-23",
    chamber: "参議院",
    round: 23,
    electionName: "第23回参議院議員通常選挙",
    electionDate: "2013-07-21",
    votingCategory: "選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000244364.xls",
    sourcePageUrl: SANGIIN_PAGE(23),
  },
  {
    id: "shugiin-47",
    chamber: "衆議院",
    round: 47,
    electionName: "第47回衆議院議員総選挙",
    electionDate: "2014-12-14",
    votingCategory: "小選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000328941.xls",
    sourcePageUrl: SHUGIIN_PAGE(47),
  },
  {
    id: "sangiin-24",
    chamber: "参議院",
    round: 24,
    electionName: "第24回参議院議員通常選挙",
    electionDate: "2016-07-10",
    votingCategory: "選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000430605.xls",
    sourcePageUrl: SANGIIN_PAGE(24),
  },
  {
    id: "shugiin-48",
    chamber: "衆議院",
    round: 48,
    electionName: "第48回衆議院議員総選挙",
    electionDate: "2017-10-22",
    votingCategory: "小選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000516716.xls",
    sourcePageUrl: SHUGIIN_PAGE(48),
  },
  {
    id: "sangiin-25",
    chamber: "参議院",
    round: 25,
    electionName: "第25回参議院議員通常選挙",
    electionDate: "2019-07-21",
    votingCategory: "選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000636670.xls",
    sourcePageUrl: SANGIIN_PAGE(25),
  },
  {
    id: "shugiin-49",
    chamber: "衆議院",
    round: 49,
    electionName: "第49回衆議院議員総選挙",
    electionDate: "2021-10-31",
    votingCategory: "小選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000776964.xls",
    sourcePageUrl: SHUGIIN_PAGE(49),
  },
  {
    id: "sangiin-26",
    chamber: "参議院",
    round: 26,
    electionName: "第26回参議院議員通常選挙",
    electionDate: "2022-07-10",
    votingCategory: "選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000825824.xls",
    sourcePageUrl: SANGIIN_PAGE(26),
  },
  {
    id: "shugiin-50",
    chamber: "衆議院",
    round: 50,
    electionName: "第50回衆議院議員総選挙",
    electionDate: "2024-10-27",
    votingCategory: "小選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/000979119.xls",
    sourcePageUrl: SHUGIIN_PAGE(50),
  },
  {
    id: "sangiin-27",
    chamber: "参議院",
    round: 27,
    electionName: "第27回参議院議員通常選挙",
    electionDate: "2025-07-20",
    votingCategory: "選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/001027812.xlsx",
    sourcePageUrl: SANGIIN_PAGE(27),
  },
  {
    id: "shugiin-51",
    chamber: "衆議院",
    round: 51,
    electionName: "第51回衆議院議員総選挙",
    electionDate: "2026-02-08",
    votingCategory: "小選挙区",
    sourceUrl: "https://www.soumu.go.jp/main_content/001061472.xlsx",
    sourcePageUrl: SHUGIIN_PAGE(51),
  },
];

async function fetchExcelBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Excel取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }
  return res.arrayBuffer();
}

/** セルの値を数値にする（"54.43"のような文字列セルも許容、空欄・"-"はnull） */
function toRateOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "" || s === "-" || s === "−" || s === "－") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // 投票率は%なので、明らかに範囲外の値はレイアウト誤読とみなして弾く
  if (n < 0 || n > 100) return null;
  // 原資料に稀に長い浮動小数（例:56.064229720871）が入っているため小数第2位に丸める
  return Math.round(n * 100) / 100;
}

/** 都道府県名・区分名のセル文字列を正規化する（全角/半角スペース除去） */
function normalizeLabel(raw: unknown): string {
  return String(raw ?? "").replace(/[　\s]/g, "");
}

/**
 * 投票率表のシートを読んで、都道府県別＋全国計の投票率を取り出す。
 *
 * ヘッダ行（列1〜3が "男","女","計"）を探し、そこから下の行のうち
 * 列0が都道府県名の行を採用する。列1〜3が当該回の男・女・計の投票率で、
 * 列4以降（前回・差分）は使わない。
 */
function parseTurnoutSheet(
  buf: ArrayBuffer,
  label: string
): { prefectures: PrefectureTurnoutEntry[]; national: TurnoutRates } {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error(`${label}: シートが1枚もありません`);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`${label}: シート「${sheetName}」を読めませんでした`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  const headerRowIndex = rows.findIndex(
    (row) =>
      Array.isArray(row) &&
      normalizeLabel(row[1]) === "男" &&
      normalizeLabel(row[2]) === "女" &&
      normalizeLabel(row[3]) === "計"
  );
  if (headerRowIndex === -1) {
    throw new Error(
      `${label}: 「男/女/計」のヘッダ行が見つかりませんでした。原資料のレイアウトが変わった可能性があります。`
    );
  }

  const prefectures: PrefectureTurnoutEntry[] = [];
  let national: TurnoutRates | null = null;
  const seen = new Set<string>();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const name = normalizeLabel(row[0]);
    if (name === "") continue;

    const rates: TurnoutRates = {
      male: toRateOrNull(row[1]),
      female: toRateOrNull(row[2]),
      total: toRateOrNull(row[3]),
    };

    if (name in PREFECTURE_CODES) {
      // 参議院の「（再掲）」ブロックには合区行しか現れないため重複しないはずだが、
      // 万一同じ都道府県が2回現れた場合は先に現れた本表側を採用する
      if (seen.has(name)) continue;
      if (rates.total === null) {
        console.warn(`${label}: ${name} の「計」を数値として読めませんでした`, row);
        continue;
      }
      seen.add(name);
      prefectures.push({ prefecture: name, ...rates });
      continue;
    }

    // 全国計の行（原資料の表記は「計」）。再掲ブロックより前に1度だけ現れる
    if (national === null && (name === "計" || name === "全国")) {
      national = rates;
    }
  }

  if (national === null) {
    throw new Error(`${label}: 全国計（「計」行）が見つかりませんでした`);
  }
  if (prefectures.length !== 47) {
    throw new Error(
      `${label}: 都道府県数が47件になりませんでした（実際: ${prefectures.length}件）。原資料のレイアウトが変わった可能性があります。`
    );
  }

  prefectures.sort(
    (a, b) =>
      Number(PREFECTURE_CODES[a.prefecture]) - Number(PREFECTURE_CODES[b.prefecture])
  );

  return { prefectures, national };
}

async function main() {
  const results: PrefectureTurnoutElection[] = [];

  for (const election of ELECTIONS) {
    const label = `${election.electionName}（${election.votingCategory}）`;
    console.log(`取得: ${label} ${election.sourceUrl}`);
    const buf = await fetchExcelBuffer(election.sourceUrl);
    const { prefectures, national } = parseTurnoutSheet(buf, label);

    const withGender = prefectures.filter(
      (p) => p.male !== null && p.female !== null
    ).length;
    console.log(
      `  → 47都道府県取得（男女別の内訳あり: ${withGender}件）／全国計 ${national.total}%`
    );

    results.push({
      id: election.id,
      chamber: election.chamber,
      round: election.round,
      electionName: election.electionName,
      electionDate: election.electionDate,
      votingCategory: election.votingCategory,
      national,
      prefectures,
      sourceUrl: election.sourceUrl,
      sourcePageUrl: election.sourcePageUrl,
    });
  }

  results.sort((a, b) => a.electionDate.localeCompare(b.electionDate));

  await writeDataJson("prefecture-turnout.json", results);
  console.log(`合計 ${results.length} 回分の選挙を収録しました。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
