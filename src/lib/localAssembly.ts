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
    counts[m.municipality] = (counts[m.municipality] ?? 0) + 1;
  }
  return counts;
}
