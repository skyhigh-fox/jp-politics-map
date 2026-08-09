/**
 * smartnews-smri のデータベースが配布する *.json は、
 * 「先頭行=ヘッダー、以降=データ行」という配列の配列（CSVをそのままJSON化した形）。
 * 一般的な「オブジェクトの配列」ではないので、このヘルパーで変換する。
 *
 * 例: [["氏名","党"], ["山田太郎","A党"]] → [{ 氏名: "山田太郎", 党: "A党" }]
 */
export function rowsToObjects<T>(rows: unknown[][]): T[] {
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((row) => {
    const obj: Record<string, unknown> = {};
    header.forEach((key, i) => {
      obj[String(key)] = row[i] ?? "";
    });
    return obj as T;
  });
}
