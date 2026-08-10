import type { RollCallVoteChoice } from "@/types";
import { VOTE_CHOICE_BADGE_CLASSES } from "@/lib/rollCallVoteColors";

/**
 * 記名投票における賛否区分（賛成/反対/欠席/棄権）のバッジ。
 *
 * 中立性の方針:
 * - 原データの区分をそのまま表示するだけで、言い換え（「造反」等）や
 *   否定的な強調（欠席・棄権を警告色にする等）は行わない。
 * - 配色は src/lib/rollCallVoteColors.ts に集約したものを使い、
 *   ヒートマップ・議員ページ・投票ページで同じ言葉に同じ色を対応させる。
 */
export function VoteChoiceBadge({ choice }: { choice: RollCallVoteChoice }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${VOTE_CHOICE_BADGE_CLASSES[choice]}`}
    >
      {choice}
    </span>
  );
}
