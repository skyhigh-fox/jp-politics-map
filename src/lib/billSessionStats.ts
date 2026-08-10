import type { Bill, BillStatus } from "@/types";

/**
 * 【国会回次別・法案成立状況の推移グラフ】用の集計ロジック。
 * 6,985件の生データをクライアントへ送らずに済むよう、
 * サーバー側（bills/page.tsxからの呼び出し）で回次×ステータスの件数へ
 * 事前集計してからクライアントコンポーネントへ渡す。
 */

/** 積み上げ順（下→上）。StatusBadgeの「進行段階」の考え方に合わせ、
 * 進行中・保留のグループ→成立系（緑系2段階）→終了系（グレー系2段階）の順に並べる。 */
export const SESSION_STATUS_ORDER: BillStatus[] = [
  "審議中",
  "継続審議",
  "可決",
  "成立",
  "否決",
  "廃案",
];

export interface SessionStatusCounts {
  /** 国会回次 */
  session: number;
  counts: Record<BillStatus, number>;
  total: number;
}

/** bills.jsonを国会回次ごとに集計する。回次は昇順（古い→新しい）でソートする。
 * データが存在しない回次（欠番）は出力しない＝実データの粒度をそのまま示す。 */
export function aggregateBillsBySession(bills: Bill[]): SessionStatusCounts[] {
  const bySession = new Map<number, Record<BillStatus, number>>();

  for (const bill of bills) {
    let counts = bySession.get(bill.dietSession);
    if (!counts) {
      counts = {
        審議中: 0,
        可決: 0,
        成立: 0,
        継続審議: 0,
        否決: 0,
        廃案: 0,
      };
      bySession.set(bill.dietSession, counts);
    }
    counts[bill.status] += 1;
  }

  return [...bySession.entries()]
    .sort(([a], [b]) => a - b)
    .map(([session, counts]) => ({
      session,
      counts,
      total: SESSION_STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0),
    }));
}
