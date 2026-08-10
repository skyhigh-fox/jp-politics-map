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
import { writeDataJson } from "./lib/writeJson";
import { setChamberProfiles, type ChamberPartyInput } from "./lib/partyColors";
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
  会派名と略称の時点?: string; // ISO 8601 (YYYY-MM-DD)
  議員数?: number;
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

  // --- 参議院の会派プロフィールを組み立てつつ、議員数を検算する ---
  // 会派名・略称・議員数はいずれも参議院公式サイト由来の値（SmartNews メディア研究所が
  // 機械可読化したもの）をそのまま保持する。参議院の会派名は衆議院と別物なので
  // （例: 参「国民民主党・新緑風会」/ 衆「国民民主党・無所属クラブ」）、
  // Party.chambers.参議院 に参議院分だけを書き込み、衆議院分には触れない。
  const countedByPartyId = new Map<string, number>();
  for (const l of legislators) {
    countedByPartyId.set(
      l.currentPartyId,
      (countedByPartyId.get(l.currentPartyId) ?? 0) + 1
    );
  }

  const mismatches: string[] = [];
  const chamberInputs: ChamberPartyInput[] = kaihaList.map((k) => {
    const id = partyIdFromKey(k.略称 || k.会派名);
    const counted = countedByPartyId.get(id) ?? 0;
    const official = typeof k.議員数 === "number" ? k.議員数 : undefined;
    const mark = official === undefined || official === counted ? "OK" : "NG";
    console.log(
      `  [${mark}] ${k.会派名}（${k.略称 ?? "略称なし"} / ${id}）公式 ${
        official ?? "不明"
      }名 / 名簿から集計 ${counted}名`
    );
    if (official !== undefined && official !== counted) {
      mismatches.push(`${k.会派名}: 公式${official}名 ≠ 名簿集計${counted}名`);
    }
    countedByPartyId.delete(id);
    return {
      id,
      profile: {
        name: k.会派名,
        abbreviation: k.略称 || undefined,
        memberCount: official ?? counted,
        asOf: k.会派名と略称の時点,
        sourceUrl: KAIHA_URL,
      },
    };
  });

  // 会派マスタに現れない会派（表記ゆれ等）が議員データ側にあれば、
  // 取りこぼさないよう議員データから補完しつつ警告する
  for (const [id, counted] of countedByPartyId) {
    if (id === "party-unknown") continue;
    console.warn(
      `[parties] ${id} は kaiha.json の会派一覧に存在しませんが、議員${counted}名が所属しています（表記ゆれの可能性）`
    );
    chamberInputs.push({
      id,
      profile: {
        name: id.replace(/^party-/, ""),
        memberCount: counted,
        sourceUrl: KAIHA_URL,
      },
    });
  }

  if (mismatches.length > 0) {
    // 参議院は補欠選挙・繰上補充等で「会派名の時点」と「議員数の時点」がずれることが
    // あり、数名程度の差は正常な状態でも起こりうる。取得を止めずに警告に留める。
    console.warn(
      "会派別議員数が公式値と一致しませんでした（基準日のずれの可能性があります）:\n" +
        mismatches.map((m) => `  - ${m}`).join("\n")
    );
  } else {
    console.log(
      `検算OK: 会派別議員数の合計 ${legislators.length}名が公式値と一致`
    );
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
  const mergedParties = setChamberProfiles(
    existingParties,
    "参議院",
    chamberInputs
  );

  await writeDataJson("legislators.json", mergedLegislators);
  await writeDataJson("parties.json", mergedParties);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
