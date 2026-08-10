/**
 * SmartNews メディア研究所「国会議案データベース：衆議院」（data/gian.json）の
 * 1行から、このリポジトリで使う法案ID（Bill.id）を組み立てる共通ヘルパー。
 *
 * 【なぜ共通化するか】
 *   gian.json は「1行=1法案」ではなく、継続審査になった議案は「掲載回次」が
 *   変わるたびに別行として登場する。そのため
 *   「提出回次＋議案種類＋番号」の組み合わせを法案の安定IDとして使っている
 *   （実データで一意性を確認済み。詳細は scripts/fetch-bills.ts のコメント参照）。
 *
 *   この採番ルールは fetch-bills.ts（bills.json / bill-status-history.json）と
 *   fetch-bill-sponsorships.ts（bill-sponsorships.json）の双方が使う。
 *   片方だけルールを変えると billId が食い違って紐付けが静かに壊れるため、
 *   ここに一箇所だけ定義する。
 */

/** billId の算出に必要な最小限の列だけを要求する */
export interface GianKeyFields {
  提出回次?: string;
  議案種類?: string;
  番号?: string;
}

/** 提出回次＋議案種類＋番号 で法案を一意に識別するキー */
export function billKey(g: GianKeyFields): string {
  return `${g.提出回次 ?? "unknown"}|${g.議案種類 ?? "unknown"}|${g.番号 ?? "unknown"}`;
}

export function billIdFromKey(key: string): string {
  return `gian-${key.replace(/\|/g, "-")}`;
}

/** gian.json の1行から直接 billId を作る */
export function billIdFromGian(g: GianKeyFields): string {
  return billIdFromKey(billKey(g));
}
