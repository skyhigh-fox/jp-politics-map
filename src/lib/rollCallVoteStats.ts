import type { Party, RollCallVote, RollCallVoteChoice } from "@/types";

/**
 * RollCallVoteHeatmap（参議院・記名投票の会派別賛否ヒートマップ）用の集計。
 *
 * data/roll-call-votes.json の各投票結果（議員個人の賛否）を会派単位に集計する。
 * partyIdが解決できなかった議員（無所属・会派表記が政党マスタに対応しない等、
 * 実測で全体の約1.8%）は個別の列を作らず「その他・無所属」にまとめる
 * （PartySeatTrendChart の「その他」バケットと同じ方針）。
 */

export const VOTE_CHOICE_ORDER: RollCallVoteChoice[] = ["賛成", "反対", "欠席", "棄権"];

const OTHER_KEY = "__other__";
export const OTHER_LABEL = "その他・無所属";
// PartyColorDot.tsx のフォールバック色と同じグレー（他のPhase4集計と統一）
export const OTHER_COLOR = "#9E9E9E";

export interface PartyVoteRow {
  key: string;
  label: string;
  color: string;
  counts: Record<RollCallVoteChoice, number>;
  total: number;
}

export function buildPartyVoteBreakdown(
  vote: RollCallVote,
  parties: Party[]
): PartyVoteRow[] {
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const rows = new Map<string, PartyVoteRow>();

  for (const r of vote.results) {
    const party = r.partyId ? partyById.get(r.partyId) : undefined;
    const key = party ? party.id : OTHER_KEY;
    const label = party ? party.name : OTHER_LABEL;
    const color = party?.color ?? OTHER_COLOR;

    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        label,
        color,
        counts: { 賛成: 0, 反対: 0, 欠席: 0, 棄権: 0 },
        total: 0,
      };
      rows.set(key, row);
    }
    row.counts[r.vote] += 1;
    row.total += 1;
  }

  return [...rows.values()].sort((a, b) => {
    if (a.key === OTHER_KEY) return 1;
    if (b.key === OTHER_KEY) return -1;
    return b.total - a.total;
  });
}
