/**
 * 都道府県別・地方財政データ（Phase 4、data/prefecture-finance.json）の
 * 表示用フォーマッタ。金額は千円単位で保持されているため、地図・ツールチップ等で
 * 人間が読みやすい「兆円」「億円」表記に変換する。
 */
export function formatYenCompact(thousandYen: number): string {
  const oku = (thousandYen * 1000) / 1e8; // 億円換算
  if (Math.abs(oku) >= 10000) {
    return `${(oku / 10000).toLocaleString("ja-JP", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    })}兆円`;
  }
  return `${Math.round(oku).toLocaleString("ja-JP")}億円`;
}
