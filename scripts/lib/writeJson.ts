import { writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

/** data/ 配下にJSONを整形して書き出す共通ヘルパー */
export async function writeDataJson(fileName: string, data: unknown) {
  const filePath = path.join(DATA_DIR, fileName);
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`wrote ${filePath}`);
}

/** マージ先の配列に対して id で upsert する（既存レコードは新データで上書き） */
export function upsertById<T extends { id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

/**
 * 既存レコードを優先し、まだ存在しないidだけを追加する。
 * 政党マスタのように「参議院の会派名一覧（正式名称・略称あり）の方が
 * 衆議院側の略称だけの情報より詳しい」といった、情報源によって
 * データの充実度が異なるケースで、詳しい方が別ソースの実行順序に
 * よって薄いデータに上書きされてしまうのを防ぐために使う。
 */
export function insertIfMissingById<T extends { id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const existingIds = new Set(existing.map((item) => item.id));
  const additions = incoming.filter((item) => !existingIds.has(item.id));
  return [...existing, ...additions];
}
