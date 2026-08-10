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

/*
 * 【削除済み】insertIfMissingById（2026-08-11）
 *
 * 「衆参どちらか一方のソースが持つ会派名を正とし、他方は既存レコードを上書きしない」
 * という方針で政党マスタのマージに使っていたが、会派名は院ごとに別物であり
 * （例: 参「国民民主党・新緑風会」/ 衆「国民民主党・無所属クラブ」）、
 * どちらか一方を勝たせる時点で必ずもう一方の院に誤った会派名が表示される、
 * という重大なデータ品質バグの原因になっていた。
 *
 * 政党マスタのマージは scripts/lib/partyColors.ts の setChamberProfiles() を使い、
 * 各院が Party.chambers[院] に自分の院のプロフィールだけを書き込むこと。
 */
