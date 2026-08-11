/**
 * 都道府県別・地方議会及び長の党派別構成データ取得スクリプト
 * （機能拡充ロードマップ Tier1 #6「地方議会の党派別構成レイヤー」）。
 *
 * データソース: 総務省「地方公共団体の議会の議員及び長の所属党派別人員調」
 *   一覧ページ: https://www.soumu.go.jp/senkyo/senkyo_s/data/syozoku/ichiran.html
 *   年次ページ: 上記から動的に解決（例: /senkyo/senkyo_s/data/syozoku/r06_00001.html）
 *   本体Excel : 年次ページ内の「地方公共団体の議会の議員及び長の所属党派別人員調」
 *               という表記のxlsxリンク（例: /main_content/001065953.xlsx）
 *
 * 調査結果（2026-08-11、実URLをfetchして確認）:
 *   - 調査は毎年12月31日現在で実施され、翌年に公表される。取得時点の最新は
 *     「令和7年12月31日現在」（＝2025-12-31基準）。
 *   - ブックは8シート構成:
 *       総括表１ / 総括表2 / 都道府県知事 / 都道府県議会 / 市区長 / 市区議会 /
 *       町村長 / 町村議会
 *     このうち総括表2枚は全国計・年次推移であり都道府県別ではないため使わず、
 *     残り6シート（団体名＝47都道府県 × 党派 × 男女）を取り込む。
 *   - 各シートの構成（シートによって上に結合セル展開行が1行入る場合がある）:
 *       行0        : 表題（例:"（２）都道府県議会議員の所属党派別人員調"）
 *       行n-1      : 党派名行（"区　　　　分", null, "自由民主党", null, null, ... , "欠員"）
 *       行n        : 小見出し行（"団体名", "定数", "男", "女", "計", "男", ...）
 *       行n+1 以降 : 47都道府県の各行 ＋ 末尾に "合計" 行（さらに注記行が続くシートもある）
 *     → 「団体名」行を基準に党派名行を1行上として取り、"男"の列位置＝党派グループの
 *       先頭列、その2つ右が"計"列、という対応で機械的に読む。
 *   - 党派列は年によって増減する（新党の登場・消滅）。令和7年時点は
 *     自由民主党／立憲民主党／日本維新の会／国民民主党／公明党／参政党／
 *     れいわ新選組／日本共産党／日本保守党／社会民主党／チームみらい／
 *     諸派／無所属 の13グループ＋合計＋欠員。**ヘッダー行から動的に読む実装が必須**
 *     （列位置の決め打ちは絶対にしないこと）。
 *   - 原表の注記（市区議会シート）:「性別非公表の議員がいるため、男女の計と計が
 *     一致しない箇所がある」。したがって人員数は必ず「計」列を採用し、
 *     男+女で再計算してはならない。
 *   - 利用規約: 総務省ウェブサイトは政府標準利用規約（第2.0版）準拠。
 *     出典表記をすれば商用・非商用問わず自由利用可。
 *
 * 【年次更新への対応・文字コード】
 *   年次ページ／Excel URLの動的解決（毎年URLが変わる）とShift_JISのデコードは、
 *   同じ年次ページを辿る fetch-prefecture-executives.ts と共通のため
 *   scripts/lib/soumuSurvey.ts に集約している。
 *
 * 【政治的中立性についての注記】
 *   党派名・党派の並び順・人員数はすべて原表のとおりに保持する。独自の再分類
 *   （例:「与党/野党」への括り直し）、人数順への並べ替え、都道府県間の比較・
 *   ランキングは行わない。男女別の内訳は原表に存在するが、女性比率等の指標化は
 *   本データセットのスコープ外のため保持しない。
 *
 * 実行: npm run fetch:local-assembly-party-composition
 */
import * as XLSX from "xlsx";
import { PREFECTURE_CODES } from "../src/lib/prefectures";
import type {
  LocalAssemblyPartyComposition,
  LocalGovernmentBodyType,
  LocalPartyCompositionBody,
  LocalPartyCount,
} from "../src/types";
import { PARTY_CANONICAL_NAMES } from "./lib/partyColors";
import {
  fetchExcelBuffer,
  resolveExcelUrlByLinkText,
  resolveLatestSurveyPage,
} from "./lib/soumuSurvey";
import { writeDataJson } from "./lib/writeJson";

/** 取り込む対象シート（総括表は全国計のため対象外）。原表のシート名と一致させる */
const TARGET_SHEETS: LocalGovernmentBodyType[] = [
  "都道府県知事",
  "都道府県議会",
  "市区長",
  "市区議会",
  "町村長",
  "町村議会",
];

/**
 * 原表の党派名 → 政党マスタ（data/parties.json）のid。
 * PARTY_CANONICAL_NAMES（id → 共通表示名）の逆引きで作る。政党マスタ側の
 * 表記を変えたときにこちらだけ古くなる、という二重管理を避けるため、
 * このスクリプト内に独自の対応表は持たない。
 */
const PARTY_ID_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(PARTY_CANONICAL_NAMES).map(([id, name]) => [name, id])
);

/**
 * 原表に現れるが「単一の政党」ではないカテゴリ列。
 * 政党マスタに存在しなくても正常なので、未知の党派としての警告を出さない。
 * （「無所属」は政党マスタ側にも party-無所属 として存在するためここには含めない）
 */
const NON_PARTY_CATEGORIES = new Set(["諸派"]);

const cellText = (raw: unknown): string =>
  raw === undefined || raw === null ? "" : String(raw).replace(/\s/g, "").trim();

function toNumber(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "" || raw === "-") return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 1党派グループ（原表の連続する 男/女/計 の3列）の列位置 */
interface PartyColumn {
  name: string;
  /** 「計」列のインデックス */
  totalIndex: number;
}

/** シートのヘッダーを解析して、党派グループ・定数・合計・欠員の列位置を得る */
function parseHeader(rows: unknown[][], sheetName: string) {
  const subHeaderIndex = rows.findIndex(
    (row) => Array.isArray(row) && cellText(row[0]) === "団体名"
  );
  if (subHeaderIndex <= 0) {
    throw new Error(
      `シート「${sheetName}」で小見出し行（"団体名"）を特定できませんでした。シート構成が変わった可能性があります。`
    );
  }
  const subHeader = rows[subHeaderIndex]!;
  const partyRow = rows[subHeaderIndex - 1]!;

  const fixedNumberIndex = subHeader.findIndex((c) => cellText(c) === "定数");
  if (fixedNumberIndex === -1) {
    throw new Error(`シート「${sheetName}」で「定数」列が見つかりませんでした。`);
  }
  const vacancyIndex = partyRow.findIndex((c) => cellText(c) === "欠員");
  if (vacancyIndex === -1) {
    throw new Error(`シート「${sheetName}」で「欠員」列が見つかりませんでした。`);
  }

  // 「男」が現れる列＝党派グループの先頭。同じ列位置の党派名行の値がその党派名
  const groups: PartyColumn[] = [];
  for (let i = 0; i < subHeader.length; i++) {
    if (cellText(subHeader[i]) !== "男") continue;
    if (cellText(subHeader[i + 2]) !== "計") {
      throw new Error(
        `シート「${sheetName}」の列${i}の党派グループに「計」列が見つかりませんでした。シート構成が変わった可能性があります。`
      );
    }
    const name = String(partyRow[i] ?? "").replace(/\s+/g, "").trim();
    if (!name) {
      throw new Error(
        `シート「${sheetName}」の列${i}に対応する党派名を読み取れませんでした。シート構成が変わった可能性があります。`
      );
    }
    groups.push({ name, totalIndex: i + 2 });
  }

  const totalGroup = groups.find((g) => g.name === "合計");
  if (!totalGroup) {
    throw new Error(`シート「${sheetName}」で「合計」列グループが見つかりませんでした。`);
  }
  const partyGroups = groups.filter((g) => g.name !== "合計");
  if (partyGroups.length === 0) {
    throw new Error(`シート「${sheetName}」で党派の列グループが1つも見つかりませんでした。`);
  }

  return {
    dataStartIndex: subHeaderIndex + 1,
    fixedNumberIndex,
    vacancyIndex,
    partyGroups,
    totalIndex: totalGroup.totalIndex,
    title: String(rows[0]?.[0] ?? "").trim(),
  };
}

function resolvePartyId(name: string, unknownNames: Set<string>): string | null {
  const id = PARTY_ID_BY_NAME[name];
  if (id) return id;
  if (!NON_PARTY_CATEGORIES.has(name)) unknownNames.add(name);
  return null;
}

async function main() {
  const { pageUrl, asOfDate, eraLabel } = await resolveLatestSurveyPage();
  // 同じ年次ページには「地方公共団体の長の連続就任回数」のxlsxも並ぶため、
  // リンクテキストで本体（所属党派別人員調）を選ぶ
  const excelUrl = await resolveExcelUrlByLinkText(pageUrl, "所属党派別人員調");

  const buf = await fetchExcelBuffer(excelUrl);
  const wb = XLSX.read(buf, { type: "array" });
  console.log(`ブック内のシート: ${wb.SheetNames.join(", ")}`);

  /** 都道府県 → 区分別の集計 */
  const byPrefecture = new Map<string, LocalPartyCompositionBody[]>();
  const unknownPartyNames = new Set<string>();

  for (const sheetName of TARGET_SHEETS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      throw new Error(
        `シート「${sheetName}」が見つかりませんでした。実際のシート名: ${wb.SheetNames.join(", ")}`
      );
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      blankrows: true,
    });
    const header = parseHeader(rows, sheetName);

    let count = 0;
    for (let i = header.dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const prefecture = String(row[0] ?? "").trim();
      // "合計"行・注記行（"＜女性の市区長＞"等）・空行を除外
      if (!(prefecture in PREFECTURE_CODES)) continue;

      const parties: LocalPartyCount[] = header.partyGroups.map((group) => ({
        name: group.name,
        partyId: resolvePartyId(group.name, unknownPartyNames),
        count: toNumber(row[group.totalIndex]),
      }));

      const body: LocalPartyCompositionBody = {
        bodyType: sheetName,
        sourceTableTitle: header.title,
        fixedNumber: toNumber(row[header.fixedNumberIndex]),
        totalMembers: toNumber(row[header.totalIndex]),
        vacancies: toNumber(row[header.vacancyIndex]),
        parties,
      };

      const list = byPrefecture.get(prefecture) ?? [];
      list.push(body);
      byPrefecture.set(prefecture, list);
      count += 1;
    }

    console.log(
      `シート「${sheetName}」: ${count}都道府県 × ${header.partyGroups.length}党派を取得` +
        `（党派列: ${header.partyGroups.map((g) => g.name).join("・")}）`
    );
    if (count !== 47) {
      console.warn(
        `【警告】シート「${sheetName}」の都道府県数が47件になりませんでした（実際: ${count}件）。` +
          `総務省側のExcelレイアウトが変わっている可能性があるため確認してください。`
      );
    }
  }

  if (unknownPartyNames.size > 0) {
    console.warn(
      `【警告】政党マスタ（scripts/lib/partyColors.ts の PARTY_CANONICAL_NAMES）に` +
        `該当がない党派名が見つかりました: ${[...unknownPartyNames].join("、")}。` +
        `新党の登場などでマスタ側の追加が必要か確認してください` +
        `（partyIdはnullのまま保存され、UIでは中立色で表示されます）。`
    );
  } else {
    console.log("すべての党派名を政党マスタと照合できました（諸派等のカテゴリ列を除く）。");
  }

  const results: LocalAssemblyPartyComposition[] = [...byPrefecture.entries()]
    .map(([prefecture, bodies]) => ({
      prefecture,
      asOfDate,
      // 原表のシート順（知事→都道府県議会→市区長→市区議会→町村長→町村議会）で固定
      bodies: bodies.sort(
        (a, b) => TARGET_SHEETS.indexOf(a.bodyType) - TARGET_SHEETS.indexOf(b.bodyType)
      ),
      sourceUrl: excelUrl,
      sourcePageUrl: pageUrl,
    }))
    .sort(
      (a, b) =>
        Number(PREFECTURE_CODES[a.prefecture]) - Number(PREFECTURE_CODES[b.prefecture])
    );

  if (results.length !== 47) {
    console.warn(
      `【警告】都道府県数が47件になりませんでした（実際: ${results.length}件）。`
    );
  } else {
    console.log(`47都道府県すべて取得できました（調査基準日: ${asOfDate} / ${eraLabel}）。`);
  }

  await writeDataJson("local-assembly-party-composition.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
