/**
 * 衆議院議員名簿をスクレイピングするスクリプト。
 *
 * データソース: 衆議院公式サイト「議員一覧（50音順）」
 *   https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm
 * （参議院と異なり、SmartNews メディア研究所のリポジトリに議員名簿データが
 *   含まれないため、公式サイトのHTMLを直接パースする）
 *
 * 実行: npm run fetch:shugiin-members
 *
 * !! 未検証 !!
 * このスクリプトはNode.js未インストールのため実行・動作確認ができていない。
 * ページ構造は事前調査（2026-08-10）時点の要約情報を基に、以下を前提にして書いている:
 *   - 氏名・ふりがな・会派・選挙区・当選回数の5列を持つtableがある
 *   - 氏名セルにprofile/NNN.html への相対リンクが張られている
 * npm install 後、最初の実行時に必ず取得件数（本来480名前後）と
 * サンプル数件の中身をログで確認し、セレクタが実際の構造と合っているか
 * 検証すること。ズレていればここを実データに合わせて修正する。
 */
import * as cheerio from "cheerio";
import type { Legislator, Party } from "../src/types";
import { upsertById, writeDataJson } from "./lib/writeJson";
import { readFile } from "node:fs/promises";
import path from "node:path";

const LIST_URL =
  "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm";
const BASE_URL = "https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/";
const SOURCE_REF = `shugiin.go.jp scraping (${LIST_URL})`;

function partyIdFromName(name: string): string {
  return `party-${name}`;
}

async function main() {
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const legislators: Legislator[] = [];
  const partyNames = new Set<string>();

  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return; // ヘッダー行や無関係な行をスキップ

    const nameCell = cells.eq(0);
    const name = nameCell.text().trim();
    const nameKana = cells.eq(1).text().trim();
    const party = cells.eq(2).text().trim();
    const district = cells.eq(3).text().trim();
    // 当選回数 = cells.eq(4)（現状のデータモデルでは未使用。将来ElectionResult等に活用検討）

    if (!name) return;

    const href = nameCell.find("a").attr("href");
    const profileMatch = href?.match(/profile\/(\d+)\.html/);
    const profileId = profileMatch?.[1];

    partyNames.add(party);

    legislators.push({
      id: `shugiin-${profileId ?? name}`,
      chamber: "衆議院",
      name,
      nameKana,
      currentPartyId: party ? partyIdFromName(party) : "party-unknown",
      // 小選挙区か比例代表かはこの一覧だけでは判別できない場合がある。
      // 選挙区名に「比例」を含む場合のみ比例代表とみなす簡易判定。
      electionType: district.includes("比例") ? "比例代表" : "小選挙区",
      district: district || "不明",
      termStatus: "現職",
      officialUrl: profileId ? `${BASE_URL}${profileId}.html` : undefined,
      photo: { status: "none" },
      sourceRef: SOURCE_REF,
    });
  });

  if (legislators.length === 0) {
    throw new Error(
      "議員データを1件も取得できませんでした。ページ構造が想定と異なる可能性があります。セレクタを見直してください。"
    );
  }
  console.log(`取得件数: ${legislators.length}件（衆議院定数465名程度が目安）`);

  const parties: Party[] = Array.from(partyNames)
    .filter(Boolean)
    .map((name) => ({ id: partyIdFromName(name), name }));

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
  const mergedParties = upsertById(existingParties, parties);

  await writeDataJson("legislators.json", mergedLegislators);
  await writeDataJson("parties.json", mergedParties);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
