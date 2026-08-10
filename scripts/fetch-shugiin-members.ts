/**
 * 衆議院議員名簿・衆議院の会派マスタをスクレイピングするスクリプト。
 *
 * データソース（いずれも衆議院公式サイト）:
 *   1. 議員一覧（50音順）
 *      https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm
 *      （あ行〜わ行で10ページに分かれている。参議院と異なり、SmartNews メディア研究所の
 *      リポジトリに議員名簿データが含まれないため、公式サイトのHTMLを直接パースする）
 *   2. 会派名及び会派別所属議員数
 *      https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/kaiha_m.htm
 *      （会派の「正式名称・略称・所属議員数」の一次情報。議員一覧の「会派」列は略称
 *      しか持たないため、正式名称はこちらから取る）
 *
 * 実行: npm run fetch:shugiin-members
 *
 * 実装メモ（2026-08-10 実データ確認済み）:
 *   - ページの文字コードは Shift_JIS。fetchのres.text()はUTF-8前提で文字化けするため、
 *     arrayBuffer() を TextDecoder("shift_jis") で明示的にデコードする必要がある
 *   - テーブルが入れ子になっており、単純に `table tr` を拾うとヘッダー行や
 *     無関係な行も混ざる。氏名セルに profile/NNN.html へのリンクを持つ行だけを対象にする
 *   - 列は 氏名(リンク付き・末尾に「君」が付く)/ふりがな/会派/選挙区/当選回数 の5列
 *
 * 実装メモ（2026-08-11 追記・重大なデータ品質バグ修正）:
 *   - 以前は会派の正式名称を取得せず、参議院側が書き込んだ会派名をそのまま流用して
 *     いたため、衆議院議員に参議院の会派名が表示されていた（例: 衆議院の
 *     「国民民主党・無所属クラブ」28名が「国民民主党・新緑風会」と誤表示）。
 *     kaiha_m.htm から衆議院自身の正式名称を取り、Party.chambers.衆議院 に
 *     衆議院分だけを書き込むようにした（詳細は scripts/lib/partyColors.ts の冒頭コメント）。
 *   - 併せて、議員一覧から数えた会派別人数と kaiha_m.htm の公式所属議員数を
 *     突き合わせる検算を入れ、食い違ったら異常終了する（サイト構造変更・取りこぼしの検知）。
 */
import * as cheerio from "cheerio";
import type { Legislator, Party } from "../src/types";
import { writeDataJson } from "./lib/writeJson";
import {
  resolvePartyId,
  setChamberProfiles,
  type ChamberPartyInput,
} from "./lib/partyColors";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PAGE_COUNT = 10; // あ行〜わ行
const LIST_URL = (page: number) =>
  `https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/${page}giin.htm`;
const KAIHA_URL =
  "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/kaiha_m.htm";
const BASE_URL = "https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/";
const SOURCE_REF = "shugiin.go.jp scraping (議員一覧 50音順)";

// 衆議院の会派略称は参議院側と表記がずれるため、必ず lib/partyColors.ts の
// PARTY_ALIASES を経由して正規idに解決する（party-国民/みらい/無 の重複防止）
function partyIdFromName(name: string): string {
  return resolvePartyId(name);
}

async function fetchShiftJis(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed (${url}): ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("shift_jis").decode(buf);
}

interface OfficialKaiha {
  /** 会派正式名称（例:「国民民主党・無所属クラブ」） */
  name: string;
  /** 会派略称（議員一覧の「会派」列と同じ表記。例:「国民」） */
  abbreviation: string;
  /** 公式発表の所属議員数 */
  memberCount: number;
}

/** 和暦（令和N年M月D日）をISO 8601に変換する。解釈できない場合はundefined */
function parseWarekiDate(text: string): string | undefined {
  const m = text.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (!m) return undefined;
  const [, era, month, day] = m;
  const year = 2018 + Number(era); // 令和元年 = 2019年
  return `${year}-${String(Number(month)).padStart(2, "0")}-${String(
    Number(day)
  ).padStart(2, "0")}`;
}

/**
 * 「会派名及び会派別所属議員数」ページをパースする。
 * 表は 会派名/会派略称/所属議員数 の3列で、末尾に「欠員」「計」の集計行が付く
 * （これらは会派ではないため除外する）。
 */
async function fetchOfficialKaiha(): Promise<{
  kaiha: OfficialKaiha[];
  asOf?: string;
  vacancies: number | null;
  totalSeats: number | null;
}> {
  const html = await fetchShiftJis(KAIHA_URL);
  const $ = cheerio.load(html);

  const kaiha: OfficialKaiha[] = [];
  let vacancies: number | null = null;
  let totalSeats: number | null = null;

  $("tr").each((_, tr) => {
    const cells = $(tr)
      .children("td,th")
      .map((__, td) => $(td).text().replace(/[\s　]+/g, "").trim())
      .get();

    if (cells.length === 2) {
      // 「欠員 15」「計 480」の集計行
      const [label, value] = cells;
      const num = Number(value);
      if (label === "欠員" && Number.isFinite(num)) vacancies = num;
      if (label === "計" && Number.isFinite(num)) totalSeats = num;
      return;
    }
    if (cells.length !== 3) return;

    const [name, abbreviation, countText] = cells;
    const memberCount = Number(countText);
    // ヘッダー行（「会派名/会派略称/所属議員数」）は所属議員数が数値にならないので弾かれる
    if (!name || !abbreviation || !Number.isFinite(memberCount)) return;
    kaiha.push({ name, abbreviation, memberCount });
  });

  if (kaiha.length === 0) {
    throw new Error(
      `会派一覧を1件も取得できませんでした（${KAIHA_URL}）。ページ構造が変わった可能性があります。`
    );
  }

  return {
    kaiha,
    asOf: parseWarekiDate($("body").text()),
    vacancies,
    totalSeats,
  };
}

async function main() {
  const { kaiha, asOf, vacancies, totalSeats } = await fetchOfficialKaiha();
  console.log(
    `会派一覧: ${kaiha.length}会派（${asOf ?? "基準日不明"}現在` +
      `${vacancies !== null ? `、欠員${vacancies}` : ""}` +
      `${totalSeats !== null ? `、定数${totalSeats}` : ""}）`
  );

  const legislators: Legislator[] = [];

  for (let page = 1; page <= PAGE_COUNT; page++) {
    const html = await fetchShiftJis(LIST_URL(page));
    const $ = cheerio.load(html);

    // テーブルが入れ子になっているため、profileリンクを起点にその直近の<tr>を辿り、
    // 直接の子<td>だけを見る（.find("td")だと入れ子テーブル全体を拾ってしまう）
    $('a[href*="profile/"]').each((_, link) => {
      const row = $(link).closest("tr");
      const cells = row.children("td");
      if (cells.length < 5) return;

      const nameCell = cells.eq(0);
      const name = nameCell.text().trim().replace(/君$/, "");
      const nameKana = cells.eq(1).text().trim().replace(/\s+/g, "");
      const party = cells.eq(2).text().trim();
      const district = cells.eq(3).text().trim();

      if (!name) return;

      const href = nameCell.find("a").attr("href");
      const profileMatch = href?.match(/profile\/(\d+)\.html/);
      const profileId = profileMatch?.[1];

      legislators.push({
        id: `shugiin-${profileId ?? name}`,
        chamber: "衆議院",
        name,
        nameKana,
        currentPartyId: party ? partyIdFromName(party) : "party-unknown",
        // 選挙区名に「比」を含む場合（例:「（比）北関東」）は比例代表とみなす
        electionType: district.includes("比") ? "比例代表" : "小選挙区",
        district: district || "不明",
        termStatus: "現職",
        officialUrl: profileId ? `${BASE_URL}${profileId}.html` : undefined,
        photo: { status: "none" },
        sourceRef: SOURCE_REF,
      });
    });

    // 公式サイトへの配慮として、ページ取得の間に少し間隔を空ける
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (legislators.length === 0) {
    throw new Error(
      "議員データを1件も取得できませんでした。ページ構造が想定と異なる可能性があります。セレクタを見直してください。"
    );
  }
  console.log(`取得件数: ${legislators.length}件（衆議院定数465名程度が目安）`);

  // --- 検算: 議員一覧から数えた会派別人数と、公式の会派別所属議員数を突き合わせる ---
  const countedByPartyId = new Map<string, number>();
  for (const l of legislators) {
    countedByPartyId.set(
      l.currentPartyId,
      (countedByPartyId.get(l.currentPartyId) ?? 0) + 1
    );
  }

  const mismatches: string[] = [];
  const chamberInputs: ChamberPartyInput[] = kaiha.map((k) => {
    const id = partyIdFromName(k.abbreviation);
    const counted = countedByPartyId.get(id) ?? 0;
    const mark = counted === k.memberCount ? "OK" : "NG";
    console.log(
      `  [${mark}] ${k.name}（${k.abbreviation} / ${id}）公式 ${k.memberCount}名 / 名簿から集計 ${counted}名`
    );
    if (counted !== k.memberCount) {
      mismatches.push(
        `${k.name}: 公式${k.memberCount}名 ≠ 名簿集計${counted}名`
      );
    }
    countedByPartyId.delete(id);
    return {
      id,
      profile: {
        name: k.name,
        abbreviation: k.abbreviation,
        memberCount: k.memberCount,
        asOf,
        sourceUrl: KAIHA_URL,
      },
    };
  });

  // 会派一覧に存在しないのに議員名簿側に現れた会派（＝取りこぼし・表記ゆれ）
  for (const [id, counted] of countedByPartyId) {
    mismatches.push(`${id}: 会派一覧に存在しないのに名簿に${counted}名います`);
  }

  const officialTotal = kaiha.reduce((sum, k) => sum + k.memberCount, 0);
  if (officialTotal !== legislators.length) {
    mismatches.push(
      `合計: 公式${officialTotal}名 ≠ 名簿集計${legislators.length}名`
    );
  }

  if (mismatches.length > 0) {
    throw new Error(
      "会派別所属議員数の検算に失敗しました（公式サイトの構造変更・スクレイピングの取りこぼしの可能性）:\n" +
        mismatches.map((m) => `  - ${m}`).join("\n")
    );
  }
  console.log(`検算OK: 会派別所属議員数の合計 ${officialTotal}名が公式値と一致`);

  const dataDir = path.join(process.cwd(), "data");
  const existingLegislators = JSON.parse(
    await readFile(path.join(dataDir, "legislators.json"), "utf-8")
  ) as Legislator[];
  const existingParties = JSON.parse(
    await readFile(path.join(dataDir, "parties.json"), "utf-8")
  ) as Party[];

  const mergedLegislators = [
    ...existingLegislators.filter((l) => l.chamber !== "衆議院"),
    ...legislators,
  ];
  // 衆議院分の会派プロフィールだけを差し替える。参議院分（fetch-sangiin-members.tsが
  // 書き込む Party.chambers.参議院）には触れないため、実行順序に依存しない。
  const mergedParties = setChamberProfiles(
    existingParties,
    "衆議院",
    chamberInputs
  );

  await writeDataJson("legislators.json", mergedLegislators);
  await writeDataJson("parties.json", mergedParties);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
