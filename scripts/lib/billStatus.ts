import type { BillStatus } from "../../src/types";

/**
 * smartnews-smri の議案データベースは「審議状況」を単一の列で持たず、
 * 衆参それぞれの委員会・本会議の議決結果列（例:
 * 「衆議院本会議経過情報 - 議決」="可決"）から読み取る必要がある。
 * ここでは簡易的なヒューリスティックでフェーズ1のBillStatus enumに正規化する。
 *
 * 参考: data/gian_status.json（house-of-representatives）に定義されている
 * 実際の詳細ステータス値は28種類あり、将来的にはこの一覧を全て汲み取った
 * より精密なマッピングに拡張する必要がある（TODO）。
 */
export function normalizeBillStatus(raw: {
  shugiinPlenaryResult?: string; // 衆議院本会議経過情報 - 議決
  sangiinPlenaryResult?: string; // 参議院本会議経過情報 - 議決
  law?: string; // 成立法律
}): BillStatus {
  if (raw.law) return "成立";
  if (raw.shugiinPlenaryResult?.includes("否決")) return "否決";
  if (raw.sangiinPlenaryResult?.includes("否決")) return "否決";
  if (raw.shugiinPlenaryResult?.includes("廃案")) return "廃案";
  if (raw.sangiinPlenaryResult?.includes("廃案")) return "廃案";
  if (raw.shugiinPlenaryResult?.includes("可決") && raw.sangiinPlenaryResult?.includes("可決")) {
    return "可決";
  }
  if (raw.shugiinPlenaryResult?.includes("継続") || raw.sangiinPlenaryResult?.includes("継続")) {
    return "継続審議";
  }
  return "審議中";
}
