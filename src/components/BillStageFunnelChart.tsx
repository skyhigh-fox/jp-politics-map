"use client";

import { useId, useMemo, useState } from "react";
import type { BillStage } from "@/types";
import {
  FUNNEL_MAIN_PATH_ORDER,
  buildFunnelFacts,
  type BillFunnelStats,
} from "@/lib/billFunnelStats";
import { BILL_STAGE_COLORS, BILL_STAGE_SLUGS } from "@/lib/billStageColors";
import { DataInsight } from "@/components/DataInsight";

/**
 * 【法案審議ファネル図（一覧レベル）】
 * `data/bill-status-history.json` の `stage`（手続き上の通過段階）を、
 * 各ステージへ到達したユニーク法案数の横棒ファネルとして可視化する。
 * dataviz スキルの手順（フォーム選定→配色→検証→マーク仕様→ホバー層→
 * アクセシビリティ）に従って実装している。
 *
 * BillSessionTrendChart（国会回次別・`status` の推移）とは扱うデータ軸が
 * 異なる別コンポーネント。こちらは法案の「今の状態（status）」ではなく、
 * 審議手続き上の「通過段階（stage）」を扱う。
 *
 * 配色は src/lib/billStageColors.ts に集約し、法案詳細ページの審議進捗
 * タイムライン（src/app/bills/[id]/page.tsx）と同じステージ＝同じ色に
 * なるようにしている（今回の実装の核心）。配色検証の根拠は
 * billStageColors.ts のコメント、および決定の経緯はObsidian:
 * jp-politics-map/決定事項ログ.md を参照。
 *
 * 主経路（提出→委員会付託→委員会可決→本会議可決→成立）を横棒として並べ、
 * 主経路から外れる分岐（委員会否決・本会議否決）は、分岐元ステージの
 * 直後に小さく添えて表示する（「否決＝悪い」という演出を避け、
 * 「そこで審議が終了した」という中立的な表現にとどめる）。
 */

interface BillStageFunnelChartProps {
  stats: BillFunnelStats;
}

type Row =
  | { kind: "main"; stage: BillStage; billCount: number }
  | { kind: "branch"; stage: BillStage; billCount: number; branchesAfter: BillStage };

function pct(count: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (count / denominator) * 100;
}

function fmtPct(count: number, denominator: number): string {
  return `${pct(count, denominator).toFixed(1)}%`;
}

export function BillStageFunnelChart({ stats }: BillStageFunnelChartProps) {
  const titleId = useId();
  const descId = useId();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const { totalBills, mainPath, branches } = stats;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const m of mainPath) {
      out.push({ kind: "main", stage: m.stage, billCount: m.billCount });
      for (const b of branches) {
        if (b.branchesAfter === m.stage) {
          out.push({
            kind: "branch",
            stage: b.stage,
            billCount: b.billCount,
            branchesAfter: b.branchesAfter,
          });
        }
      }
    }
    return out;
  }, [mainPath, branches]);

  if (totalBills === 0) return null;

  const allStagesForLegend: BillStage[] = [
    ...FUNNEL_MAIN_PATH_ORDER,
    ...branches.map((b) => b.stage),
  ];

  return (
    <section
      aria-labelledby={titleId}
      className="bill-funnel-chart mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
    >
      <style>{`
        .bill-funnel-chart {
          --chart-surface: #ffffff;
          --chart-ink: #171717;
          --chart-ink-secondary: #525252;
          --chart-track: #f5f5f5;
          ${allStagesForLegend
            .map(
              (s) =>
                `--stage-${BILL_STAGE_SLUGS[s]}: ${BILL_STAGE_COLORS[s].light};`
            )
            .join("\n          ")}
        }
        @media (prefers-color-scheme: dark) {
          .bill-funnel-chart {
            --chart-surface: #171717;
            --chart-ink: #fafafa;
            --chart-ink-secondary: #a3a3a3;
            --chart-track: #262626;
            ${allStagesForLegend
              .map(
                (s) =>
                  `--stage-${BILL_STAGE_SLUGS[s]}: ${BILL_STAGE_COLORS[s].dark};`
              )
              .join("\n            ")}
          }
        }
        .bill-funnel-chart .funnel-row:focus-visible {
          outline: 2px solid var(--chart-ink);
          outline-offset: 2px;
          border-radius: 0.375rem;
        }
      `}</style>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={titleId}
          className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
        >
          法案審議ファネル（ステージ別の通過状況）
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          全{totalBills.toLocaleString("ja-JP")}件（審議履歴データに基づく）
        </p>
      </div>
      <p id={descId} className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        提出から成立までの各段階に到達した法案の件数です（ユニーク法案数）。委員会・本会議の各段階は「可決して次へ進む」側と「その段階で審議が終了する」側に分かれるため、後者は主経路の下に小さく添えています。バーにポインタを合わせる、またはTabキーでfocusすると件数の内訳を確認できます。
      </p>

      <DataInsight facts={buildFunnelFacts(stats)} />

      {/* 凡例（色だけに依存しないようラベルを併記） */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden="true">
        {allStagesForLegend.map((stage) => (
          <li
            key={stage}
            className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `var(--stage-${BILL_STAGE_SLUGS[stage]})` }}
            />
            {BILL_STAGE_COLORS[stage].label}
          </li>
        ))}
      </ul>

      <div
        className="relative mt-4 space-y-2"
        role="group"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {rows.map((row) => {
          const key = rowKey(row);
          const isBranch = row.kind === "branch";
          const widthPct = Math.max(pct(row.billCount, totalBills), 1.2);
          const isActive = activeKey === key;

          return (
            <div
              key={key}
              className={isBranch ? "ml-6 sm:ml-10" : ""}
            >
              <div
                className="funnel-row relative cursor-pointer rounded-md py-0.5"
                tabIndex={0}
                role="button"
                aria-label={rowAriaLabel(row, totalBills)}
                onPointerEnter={() => setActiveKey(key)}
                onPointerLeave={() =>
                  setActiveKey((cur) => (cur === key ? null : cur))
                }
                onFocus={() => setActiveKey(key)}
                onBlur={() => setActiveKey((cur) => (cur === key ? null : cur))}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={
                      isBranch
                        ? "text-xs text-neutral-500 dark:text-neutral-400"
                        : "text-sm font-medium text-neutral-800 dark:text-neutral-200"
                    }
                  >
                    {isBranch ? "－ " : ""}
                    {BILL_STAGE_COLORS[row.stage].label}
                    {isBranch && (
                      <span className="ml-1 text-neutral-400 dark:text-neutral-500">
                        （この段階で審議終了）
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-neutral-600 dark:text-neutral-400">
                    {row.billCount.toLocaleString("ja-JP")}件
                    <span className="ml-1 text-neutral-400 dark:text-neutral-500">
                      ({fmtPct(row.billCount, totalBills)})
                    </span>
                  </span>
                </div>
                <div
                  className={
                    isBranch
                      ? "mt-1 h-2.5 w-full rounded-full bg-[var(--chart-track)]"
                      : "mt-1 h-6 w-full rounded-md bg-[var(--chart-track)]"
                  }
                >
                  <div
                    className={
                      isBranch
                        ? "h-2.5 rounded-full transition-[width]"
                        : "h-6 rounded-md transition-[width]"
                    }
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: `var(--stage-${BILL_STAGE_SLUGS[row.stage]})`,
                    }}
                  />
                </div>

                {isActive && (
                  <div
                    className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-max max-w-[calc(100vw-4rem)] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-card-hover dark:border-neutral-700 dark:bg-neutral-800"
                    role="status"
                  >
                    <p className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-50">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: `var(--stage-${BILL_STAGE_SLUGS[row.stage]})`,
                        }}
                      />
                      {BILL_STAGE_COLORS[row.stage].label}
                    </p>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-300">
                      {row.billCount.toLocaleString("ja-JP")}件 / 全
                      {totalBills.toLocaleString("ja-JP")}件中（
                      {fmtPct(row.billCount, totalBills)}）
                    </p>
                    {isBranch && (
                      <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        {BILL_STAGE_COLORS[
                          (row as Extract<Row, { kind: "branch" }>).branchesAfter
                        ].label}
                        の次に、この段階で審議が終了した法案の数です。
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* データテーブル代替（スクリーンリーダー・数値確認用） */}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          データを表で見る（ステージ別の通過法案数）
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-neutral-600 dark:text-neutral-300">
                  ステージ
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                  通過法案数
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                  全体比
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <td className="px-3 py-1 text-neutral-700 dark:text-neutral-300">
                    {row.kind === "branch" ? "－ " : ""}
                    {BILL_STAGE_COLORS[row.stage].label}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                    {row.billCount.toLocaleString("ja-JP")}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                    {fmtPct(row.billCount, totalBills)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function rowKey(row: Row): string {
  return row.kind === "main" ? `main:${row.stage}` : `branch:${row.stage}`;
}

function rowAriaLabel(row: Row, totalBills: number): string {
  const label = BILL_STAGE_COLORS[row.stage].label;
  const pctLabel = fmtPct(row.billCount, totalBills);
  if (row.kind === "branch") {
    return `${label}（${
      BILL_STAGE_COLORS[row.branchesAfter].label
    }の次にこの段階で審議終了）：${row.billCount}件、全体の${pctLabel}`;
  }
  return `${label}：${row.billCount}件、全体の${pctLabel}`;
}
