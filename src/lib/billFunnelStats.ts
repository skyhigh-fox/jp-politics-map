import type { BillStage, BillStatusHistory } from "@/types";

/**
 * 【法案審議ファネル（一覧レベル）】用の集計ロジック。
 * `data/bill-status-history.json`（32,000件超の生ログ）をクライアントへ送らずに
 * 済むよう、サーバー側（bills/page.tsxからの呼び出し）で
 * 「各ステージに到達したユニーク法案数」へ事前集計してからクライアント
 * コンポーネントへ渡す。
 *
 * 自然な流れ: 提出 → 委員会付託 → 委員会可決 or 委員会否決
 *            → 本会議可決 or 本会議否決 → 成立
 * 「委員会可決/委員会否決」「本会議可決/本会議否決」は分岐（どちらか一方）
 * のため、主経路（可決して次に進む側）と、そこから外れる分岐（否決側）を
 * 分けて集計する。
 */

/** 主経路（可決して次段階へ進む側）の並び順 */
export const FUNNEL_MAIN_PATH_ORDER: BillStage[] = [
  "提出",
  "委員会付託",
  "委員会可決",
  "本会議可決",
  "成立",
];

/** 主経路から外れる分岐（否決系）。`branchesAfter` は「どの主経路ステージの
 * 直後に分岐するか」＝表示上、その主経路ステージの行に添えて示すための情報。 */
export const FUNNEL_BRANCH_STAGES: { stage: BillStage; branchesAfter: BillStage }[] = [
  { stage: "委員会否決", branchesAfter: "委員会付託" },
  { stage: "本会議否決", branchesAfter: "委員会可決" },
];

export interface FunnelStageStat {
  stage: BillStage;
  /** そのステージの記録が1回以上ある、ユニークな法案（billId）の件数 */
  billCount: number;
}

export interface BillFunnelBranchStat extends FunnelStageStat {
  branchesAfter: BillStage;
}

export interface BillFunnelStats {
  /** 履歴データ全体に含まれるユニーク法案数（分母） */
  totalBills: number;
  /** 主経路各ステージの通過数（提出→委員会付託→委員会可決→本会議可決→成立） */
  mainPath: FunnelStageStat[];
  /** 主経路から外れる分岐（否決系）の件数 */
  branches: BillFunnelBranchStat[];
}

/** bill-status-history.json 全体を集計する。
 * 同一法案が同一ステージに複数回登場しても（衆参両院での動きなど）
 * ユニークbillIdとして1件と数える。 */
export function aggregateBillFunnel(
  history: BillStatusHistory[]
): BillFunnelStats {
  const billIdsByStage = new Map<BillStage, Set<string>>();
  const allBillIds = new Set<string>();

  for (const h of history) {
    allBillIds.add(h.billId);
    let ids = billIdsByStage.get(h.stage);
    if (!ids) {
      ids = new Set();
      billIdsByStage.set(h.stage, ids);
    }
    ids.add(h.billId);
  }

  const countFor = (stage: BillStage) => billIdsByStage.get(stage)?.size ?? 0;

  return {
    totalBills: allBillIds.size,
    mainPath: FUNNEL_MAIN_PATH_ORDER.map((stage) => ({
      stage,
      billCount: countFor(stage),
    })),
    branches: FUNNEL_BRANCH_STAGES.map(({ stage, branchesAfter }) => ({
      stage,
      branchesAfter,
      billCount: countFor(stage),
    })),
  };
}

/**
 * ファネル図の集計値から、直接読み取りにくい割合を文で言い換える
 * （DataInsight コンポーネント用）。「多い/少ない」等の評価語は使わず、
 * 表示中の集計値をそのまま言い換えるだけに留める。
 */
export function buildFunnelFacts(stats: BillFunnelStats): string[] {
  if (stats.totalBills === 0) return [];
  const facts: string[] = [];

  const enacted = stats.mainPath.find((s) => s.stage === "成立")?.billCount ?? 0;
  const enactedPct = ((enacted / stats.totalBills) * 100).toFixed(0);
  facts.push(
    `審議履歴のある${stats.totalBills.toLocaleString("ja-JP")}件のうち、${enacted.toLocaleString("ja-JP")}件（${enactedPct}%）が成立まで進んでいます。`
  );

  const rejectedTotal = stats.branches.reduce((sum, b) => sum + b.billCount, 0);
  if (rejectedTotal > 0) {
    facts.push(
      `審議の途中（委員会または本会議）で否決された法案は${rejectedTotal.toLocaleString("ja-JP")}件です。`
    );
  }

  return facts;
}
