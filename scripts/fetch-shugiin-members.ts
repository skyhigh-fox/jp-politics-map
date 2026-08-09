/**
 * 衆議院議員名簿をスクレイピングするスクリプト。
 *
 * データソース: 衆議院公式サイト「議員一覧（50音順）」
 *   https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm
 *   （あ行〜わ行で10ページに分かれている。参議院と異なり、SmartNews メディア研究所の
 *   リポジトリに議員名簿データが含まれないため、公式サイトのHTMLを直接パースする）
 *
 * 実行: npm run fetch:shugiin-members
 *
 * 実装メモ（2026-08-10 実データ確認済み）:
 *   - ページの文字コードは Shift_JIS。fetchのres.text()はUTF-8前提で文字化けするため、
 *     arrayBuffer() を TextDecoder("shift_jis") で明示的にデコードする必要がある
 *   - テーブルが入れ子になっており、単純に `table tr` を拾うとヘッダー行や
 *     無関係な行も混ざる。氏名セルに profile/NNN.html へのリンクを持つ行だけを対象にする
 *   - 列は 氏名(リンク付き・末尾に「君」が付く)/ふりがな/会派/選挙区/当選回数 の5列
 */
import * as cheerio from "cheerio";
import type { Legislator, Party } from "../src/types";
import { insertIfMissingById, writeDataJson } from "./lib/writeJson";
import { applyPartyColors, resolvePartyId, resolvePartyName } from "./lib/partyColors";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PAGE_COUNT = 10; // あ行〜わ行
const LIST_URL = (page: number) =>
  `https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/${page}giin.htm`;
const BASE_URL = "https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/";
const SOURCE_REF = "shugiin.go.jp scraping (議員一覧 50音順)";

// 衆議院の会派略称は参議院側と表記がずれるため、必ず lib/partyColors.ts の
// PARTY_ALIASES を経由して正規idに解決する（party-国民/みらい/無 の重複防止）
function partyIdFromName(name: string): string {
  return resolvePartyId(name);
}

async function fetchPage(page: number): Promise<string> {
  const res = await fetch(LIST_URL(page));
  if (!res.ok) throw new Error(`fetch failed (page ${page}): ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("shift_jis").decode(buf);
}

async function main() {
  const legislators: Legislator[] = [];
  const partyNames = new Set<string>();

  for (let page = 1; page <= PAGE_COUNT; page++) {
    const html = await fetchPage(page);
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

      partyNames.add(party);

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

  const parties: Party[] = Array.from(partyNames)
    .filter(Boolean)
    .map((name) => ({ id: partyIdFromName(name), name: resolvePartyName(name) }));

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
  // 衆議院ページの「会派」列は略称のみ（正式名称なし）。参議院側
  // （fetch-sangiin-members.ts）が持つ正式名称付きのpartyレコードを
  // 上書きしないよう、まだ存在しないidだけを追加する。
  const mergedParties = applyPartyColors(
    insertIfMissingById(existingParties, parties)
  );

  await writeDataJson("legislators.json", mergedLegislators);
  await writeDataJson("parties.json", mergedParties);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
