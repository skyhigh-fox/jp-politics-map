import type { RollCallVoteChoice } from "@/types";

/**
 * 【記名投票の賛否区分（RollCallVoteChoice）の配色】
 *
 * もともと `src/components/RollCallVoteHeatmap.tsx` の内部に閉じていた配色を、
 * 議員詳細ページの投票履歴・記名投票一覧（/votes）・個別投票ページでも
 * 同じ言葉に同じ色が対応するよう、`src/lib/billStageColors.ts` と同じ流儀で
 * lib 側に切り出したもの。
 *
 * 配色方針（ヒートマップ作成時の判断をそのまま引き継ぐ）:
 * - 賛成/反対は政治的な「賛否」という対極（polarity）を表すため、dataviz skill の
 *   diverging 配色（寒色/暖色の2極）に従い、賛成=blue・反対=amber を割り当てる。
 *   「賛成=良い/反対=悪い」という評価的な意味づけを避けるため、緑/赤のような
 *   良し悪しを連想させる配色は使わない（StatusBadge.tsx と同じ中立性の方針）。
 * - 欠席・棄権は「投票行動そのものが取られなかった」区分のため、単一の
 *   ニュートラルグレーの2階調（濃淡のみで序列を表現、ordinal）とする。
 *   否定的な含意を持つ配色（赤・警告色）は用いない。
 */
export const VOTE_CHOICE_COLORS: Record<
  RollCallVoteChoice,
  { rgbLight: string; rgbDark: string; textLight: string; textDark: string }
> = {
  賛成: {
    rgbLight: "37, 99, 235", // blue-600
    rgbDark: "96, 165, 250", // blue-400
    textLight: "#1e3a8a",
    textDark: "#dbeafe",
  },
  反対: {
    rgbLight: "217, 119, 6", // amber-600
    rgbDark: "251, 146, 60", // orange-400
    textLight: "#7c2d12",
    textDark: "#ffedd5",
  },
  欠席: {
    rgbLight: "115, 115, 115", // neutral-500
    rgbDark: "163, 163, 163", // neutral-400
    textLight: "#404040",
    textDark: "#e5e5e5",
  },
  棄権: {
    rgbLight: "82, 82, 82", // neutral-600
    rgbDark: "212, 212, 212", // neutral-300
    textLight: "#262626",
    textDark: "#f5f5f5",
  },
};

/**
 * 賛否バッジ（VoteChoiceBadge）用のTailwindクラス。
 * SVGではなく通常のDOM要素に当てるため、上の配色と同系統の色を
 * Tailwindのパレット名で指定する（`dark:`が使えるのでJS側での分岐は不要）。
 */
export const VOTE_CHOICE_BADGE_CLASSES: Record<RollCallVoteChoice, string> = {
  賛成:
    "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-400/30",
  反対:
    "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/30",
  欠席:
    "bg-neutral-100 text-neutral-600 ring-neutral-500/20 dark:bg-neutral-800/60 dark:text-neutral-300 dark:ring-neutral-400/20",
  棄権:
    "bg-neutral-100 text-neutral-700 ring-neutral-500/20 dark:bg-neutral-800/60 dark:text-neutral-200 dark:ring-neutral-400/20",
};
