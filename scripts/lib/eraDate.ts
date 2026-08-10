/**
 * smartnews-smri の議案データベースの日付は元号表記
 * （例: "平成10年 3月11日"）のため、ISO 8601 (YYYY-MM-DD) に変換する。
 */
const ERA_START_YEAR: Record<string, number> = {
  明治: 1868,
  大正: 1912,
  昭和: 1926,
  平成: 1989,
  令和: 2019,
};

export function eraToIsoDate(input: string | undefined | null): string | null {
  if (!input) return null;
  // 元号名と年の間、月・日の間に空白（全角スペース含む）が入ることがある
  // （例:"令和 8年 3月12日"。1桁年を右詰めするための空白パディングと見られる。
  // 2026-08-11、令和2年以降の日付が軒並みパースに失敗していたバグを修正）
  const match = input.match(
    /(明治|大正|昭和|平成|令和)\s*(\d+|元)年\s*(\d+)月\s*(\d+)日/
  );
  if (!match) return null;
  const [, era, yearStr, month, day] = match;
  if (!era || !yearStr || !month || !day) return null;
  const eraStart = ERA_START_YEAR[era];
  if (!eraStart) return null;
  const year = yearStr === "元" ? eraStart : eraStart + parseInt(yearStr, 10) - 1;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * gian.json の「日付／委員会・結果」形式の列（全角スラッシュ区切り、
 * 例: "平成10年 3月11日／内閣"）を { date, note } に分解する。
 * 空欄（"／"のみ）の場合は date が null になる。
 */
export function splitDateAndNote(input: string | undefined): {
  date: string | null;
  note: string;
} {
  if (!input) return { date: null, note: "" };
  const [datePart, ...rest] = input.split("／");
  return {
    date: eraToIsoDate(datePart?.trim()),
    note: rest.join("／").trim(),
  };
}
