import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LocalAssemblyMember } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJsonSafe<T>(fileName: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(DATA_DIR, fileName), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null; // ファイル未生成（フェーズ3未対応の自治体）
  }
}

export async function getLocalAssemblyMembers(): Promise<
  LocalAssemblyMember[]
> {
  return (
    (await readJsonSafe<LocalAssemblyMember[]>(
      "local-assembly-members.json"
    )) ?? []
  );
}

/**
 * 東京都議会の選挙区 → 市区町村（地図データのN03_004表記）対応表。
 * 特別区・単独市の選挙区は市区町村名とそのまま一致するため対応不要。
 * 複数市町村にまたがる選挙区（多摩地域の合区・島部）のみここに列挙する。
 * 出典: 東京都選挙管理委員会「東京都議会議員の定数及び選挙区一覧表」
 *   https://www.senkyo.metro.tokyo.lg.jp/election/kakushu-teisuu/togi-teisuu-list1
 *   （2026-08-10確認）
 */
const TOKYO_MULTI_MUNICIPALITY_DISTRICTS: Record<string, string[]> = {
  西多摩: ["福生市", "羽村市", "あきる野市", "瑞穂町", "日の出町", "檜原村", "奥多摩町"],
  南多摩: ["多摩市", "稲城市"],
  北多摩第一: ["東村山市", "東大和市", "武蔵村山市"],
  北多摩第二: ["国分寺市", "国立市"],
  北多摩第三: ["調布市", "狛江市"],
  北多摩第四: ["東久留米市", "清瀬市"],
  島部: [
    "大島町",
    "利島村",
    "新島村",
    "神津島村",
    "三宅村",
    "御蔵島村",
    "八丈町",
    "青ヶ島村",
    "小笠原村",
  ],
};

/** 選挙区名から、地図上で対応する市区町村名の一覧を返す（特別区・単独市はそのまま1件） */
export function districtToMunicipalities(district: string): string[] {
  return TOKYO_MULTI_MUNICIPALITY_DISTRICTS[district] ?? [district];
}

/**
 * 都道府県内の市区町村ごとの地方議会議員数を返す。
 * フェーズ3のパイロット対象外の都道府県はnullを返す
 * （地図側で「データなし」表示に切り替えるための区別）
 */
export async function getLocalAssemblyMemberCountsByMunicipality(
  prefecture: string
): Promise<Record<string, number> | null> {
  const members = await getLocalAssemblyMembers();
  const inPref = members.filter((m) => m.prefecture === prefecture);
  if (inPref.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const m of inPref) {
    for (const municipality of districtToMunicipalities(m.district)) {
      counts[municipality] = (counts[municipality] ?? 0) + 1;
    }
  }
  return counts;
}

export async function getLocalAssemblyMembersByMunicipality(
  prefecture: string,
  municipality: string
): Promise<LocalAssemblyMember[]> {
  const members = await getLocalAssemblyMembers();
  return members.filter(
    (m) =>
      m.prefecture === prefecture &&
      districtToMunicipalities(m.district).includes(municipality)
  );
}
