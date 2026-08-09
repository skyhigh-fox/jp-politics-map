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
