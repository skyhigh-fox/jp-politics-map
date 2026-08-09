/**
 * フェーズ3パイロット: 東京都議会議員名簿を取得するスクリプト。
 *
 * データソース: 東京都議会公式サイト「選挙区別議員名簿」
 *   https://www.gikai.metro.tokyo.lg.jp/membership/electoral-zone.html
 *
 * 実行: npm run fetch:tokyo-assembly-members
 *
 * ページ構造（2026-08-10実データ確認済み、UTF-8）:
 *   <h4 id="areaNN">選挙区名（定数N）</h4>
 *   <ul>
 *     <li><a href="numXXX.html">氏名（会派略称）</a></li>
 *     ...
 *   </ul>
 *   が42選挙区分繰り返され、計127名（定数どおり）取得できることを確認済み。
 *   会派は「自」「都」「公」「立」「共」「国」「参」「由」「無（や）」等の略称表記のまま
 *   格納する（正式名称への展開は誤りのリスクがあるため見送り）。
 *
 * 選挙区は特別区・単独市がほとんどだが、多摩地域の一部と島部は複数市町村の
 * 合区になっている。その市区町村への展開は src/lib/localAssembly.ts で行う
 * （このスクリプトは選挙区名をそのまま保存するだけでよい）。
 */
import * as cheerio from "cheerio";
import type { LocalAssemblyMember } from "../src/types";
import { writeDataJson } from "./lib/writeJson";
import { readFile } from "node:fs/promises";
import path from "node:path";

const LIST_URL = "https://www.gikai.metro.tokyo.lg.jp/membership/electoral-zone.html";
const BASE_URL = "https://www.gikai.metro.tokyo.lg.jp/membership/";
const ASSEMBLY = "東京都議会";
const PREFECTURE = "東京都";
const SOURCE_REF = `gikai.metro.tokyo.lg.jp scraping (選挙区別議員名簿, ${LIST_URL})`;

async function main() {
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const members: LocalAssemblyMember[] = [];

  $("h4[id^='area']").each((_, h4) => {
    const headingText = $(h4).text().trim(); // 例:"千代田区（定数1）"
    const districtMatch = headingText.match(/^(.+?)（定数\d+）$/);
    const district = districtMatch?.[1] ?? headingText;

    // 見出しの直後の<ul>だけを対象にする
    const list = $(h4).nextAll("ul").first();
    list.find("a[href^='num']").each((__, a) => {
      const text = $(a).text().trim(); // 例:"菅野 弘一（自）"、"さとう さおり（無（や））"
      // 会派表記が「無（や）」のように入れ子の括弧を含むことがあるため、
      // 貪欲マッチで末尾の最も外側の括弧を拾う（非貪欲＋除外文字クラスだと
      // 入れ子括弧の内側で誤って区切ってしまう）
      const nameMatch = text.match(/^(.+?)\s*[（(](.+)[）)]$/);
      const name = (nameMatch?.[1] ?? text).replace(/\s+/g, "");
      const partyName = nameMatch?.[2] ?? "不明";
      const href = $(a).attr("href");

      members.push({
        id: `tokyo-gikai-${href?.replace(/\D/g, "") ?? members.length + 1}`,
        assembly: ASSEMBLY,
        prefecture: PREFECTURE,
        district,
        name,
        partyName,
        termStatus: "現職",
        officialUrl: href ? `${BASE_URL}${href}` : undefined,
        sourceRef: SOURCE_REF,
      });
    });
  });

  console.log(`取得件数: ${members.length}名（定数127名が目安）`);
  if (members.length === 0) {
    throw new Error("議員データを1件も取得できませんでした。ページ構造を確認してください。");
  }

  // 他自治体（将来追加分）を上書きしないよう、東京都分だけ差し替える
  const dataDir = path.join(process.cwd(), "data");
  const existing = await readFile(
    path.join(dataDir, "local-assembly-members.json"),
    "utf-8"
  )
    .then((raw) => JSON.parse(raw) as LocalAssemblyMember[])
    .catch(() => [] as LocalAssemblyMember[]);
  const merged = [
    ...existing.filter((m) => m.assembly !== ASSEMBLY),
    ...members,
  ];

  await writeDataJson("local-assembly-members.json", merged);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
