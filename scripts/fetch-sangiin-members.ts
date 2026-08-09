/**
 * 参議院議員名簿・会派マスタを取得するスクリプト。
 *
 * データソース: SmartNews メディア研究所「国会議案データベース：参議院」
 *   https://github.com/smartnews-smri/house-of-councillors （MITライセンス）
 *   出典表記: 「スマートニュース メディア研究所」または「SmartNews Media Research Institute」
 *
 * 実行: npm run fetch:sangiin-members
 *
 * 注意: このリポジトリの giin.json には公式サイトの「写真URL」が含まれるが、
 * 二次利用ライセンスが未確認のため、フェーズ1の写真掲載方針（CCライセンス確認済みのみ掲載）
 * に従い photo.status は "none" 固定にしている。将来的にWikimedia Commons側の
 * ライセンス確認パイプラインと突き合わせて licensed に切り替える想定。
 */
import type { Legislator, Party } from "../src/types";
import { upsertById, writeDataJson } from "./lib/writeJson";
import { rowsToObjects } from "./lib/csvJson";
import { readFile } from "node:fs/promises";
import path from "node:path";

const GIIN_URL =
  "https://raw.githubusercontent.com/smartnews-smri/house-of-councillors/main/data/giin.json";
const KAIHA_URL =
  "https://raw.githubusercontent.com/smartnews-smri/house-of-councillors/main/data/kaiha.json";
const SOURCE_REF = "smartnews-smri/house-of-councillors data/giin.json";

// 実データは「先頭行=ヘッダー、以降=データ行」の配列の配列(rowsToObjectsで変換)。
// キー名は2026-08-10時点で実データにて確認済み。
interface RawGiin {
  議員氏名: string;
  読み方?: string;
  会派?: string; // kaiha.json の「略称」と一致する表記（例: "自民"）
  選挙区?: string; // 比例代表の場合は "比例" という値になる
  議員個人の紹介ページ?: string;
  任期満了?: string;
}

interface RawKaiha {
  会派名: string;
  略称?: string;
}

// giin.json の「会派」列はkaiha.jsonの「略称」と同じ表記のため、
// 党のidは略称ベースで揃える（略称が無い場合のみ正式名称にフォールバック）
function partyIdFromKey(key: string): string {
  return `party-${key}`;
}

async function main() {
  const [giinRes, kaihaRes] = await Promise.all([
    fetch(GIIN_URL),
    fetch(KAIHA_URL),
  ]);
  if (!giinRes.ok) throw new Error(`giin.json fetch failed: ${giinRes.status}`);
  if (!kaihaRes.ok) throw new Error(`kaiha.json fetch failed: ${kaihaRes.status}`);

  const giinList = rowsToObjects<RawGiin>(await giinRes.json());
  const kaihaList = rowsToObjects<RawKaiha>(await kaihaRes.json());

  const parties: Party[] = kaihaList.map((k) => ({
    id: partyIdFromKey(k.略称 || k.会派名),
    name: k.会派名,
    abbreviation: k.略称 || undefined,
  }));

  const legislators: Legislator[] = giinList.map((g, index) => {
    const isProportional = g.選挙区 === "比例";
    const legislator: Legislator = {
      id: `sangiin-${index + 1}`,
      chamber: "参議院",
      name: g.議員氏名,
      nameKana: g.読み方,
      currentPartyId: g.会派 ? partyIdFromKey(g.会派) : "party-unknown",
      electionType: isProportional ? "比例代表(参院)" : "選挙区",
      district: g.選挙区 ?? "不明",
      termStatus: "現職",
      officialUrl: g.議員個人の紹介ページ,
      photo: { status: "none" },
      sourceRef: SOURCE_REF,
    };
    return legislator;
  });

  // 会派マスタに現れない会派（表記ゆれ等）を検知できるよう、
  // 議員データ側から不足分を補完しておく
  const partyIds = new Set(parties.map((p) => p.id));
  for (const l of legislators) {
    if (!partyIds.has(l.currentPartyId) && l.currentPartyId !== "party-unknown") {
      parties.push({ id: l.currentPartyId, name: l.currentPartyId.replace("party-", "") });
      partyIds.add(l.currentPartyId);
    }
  }

  const dataDir = path.join(process.cwd(), "data");
  const existingLegislators = JSON.parse(
    await readFile(path.join(dataDir, "legislators.json"), "utf-8")
  ) as Legislator[];
  const existingParties = JSON.parse(
    await readFile(path.join(dataDir, "parties.json"), "utf-8")
  ) as Party[];

  // 参議院分だけを差し替え、衆議院分（別スクリプトが書き込む）は温存する
  const mergedLegislators = [
    ...existingLegislators.filter((l) => l.chamber !== "参議院"),
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
