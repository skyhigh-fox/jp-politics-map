import type {
  Party,
  RollCallVote,
  RollCallVoteChoice,
  RollCallVoteResult,
} from "@/types";
import { partyDisplayName } from "@/lib/party";

/**
 * RollCallVoteHeatmap（参議院・記名投票の会派別賛否ヒートマップ）用の集計。
 *
 * data/roll-call-votes.json の各投票結果（議員個人の賛否）を会派単位に集計する。
 * partyIdが解決できなかった議員（無所属・会派表記が政党マスタに対応しない等、
 * 実測で全体の約1.8%）は個別の列を作らず「その他・無所属」にまとめる
 * （PartySeatTrendChart の「その他」バケットと同じ方針）。
 *
 * 記名投票（押しボタン式投票）は参議院のみが対象なので、会派名は必ず
 * 参議院の正式会派名（例:「国民民主党・新緑風会」）で表示する
 * （衆議院の会派名や、院に依存しない母体政党名を出さない）。
 */
const VOTE_CHAMBER = "参議院" as const;

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
    const label = party
      ? partyDisplayName(party, VOTE_CHAMBER)
      : OTHER_LABEL;
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

/**
 * 表示中の投票結果から機械的に言い換えられる事実の一覧を作る
 * （DataInsight コンポーネント用）。可決/否決は賛成・反対の数の比較という
 * 客観的な事実として提示し、賛否そのものへの評価は加えない。
 */
export function buildRollCallVoteFacts(
  vote: RollCallVote,
  rows: PartyVoteRow[]
): string[] {
  const facts: string[] = [];
  const result =
    vote.totalFor > vote.totalAgainst
      ? "可決"
      : vote.totalFor < vote.totalAgainst
        ? "否決"
        : "同数";
  facts.push(
    `賛成${vote.totalFor}、反対${vote.totalAgainst}で${result}されました。`
  );

  const split = rows.filter(
    (r) => r.key !== OTHER_KEY && r.counts.賛成 > 0 && r.counts.反対 > 0
  );
  if (split.length > 0) {
    const names = split
      .map((r) => `${r.label}（賛成${r.counts.賛成}・反対${r.counts.反対}）`)
      .join("、");
    facts.push(`会派内で賛否が分かれたのは${names}です。`);
  }

  return facts;
}

// ---------------------------------------------------------------------------
// 記名投票の一覧（/votes）・議員別の投票履歴（機能拡充ロードマップ Tier1 #5）
//
// 【中立性の方針（重要）】
// - ここで作るのは「いつ・何に・どう投票したか」という原データの転記だけ。
//   議員個人の賛成率・造反回数・出席率のような派生指標は一切作らない
//   （TheyWorkForYouが「議員の姿勢を要約する指標」で受けた批判の教訓）。
// - 欠席・棄権は原データの区分をそのまま扱い、「造反」「不真面目」といった
//   否定的な含意を持つラベルや強調表示は付けない。
// - 並び順は日付（同日内は議事の順）のみ。「賛否が割れた順」「重要な順」のような
//   編集的・評価的な並び替えはしない。
// ---------------------------------------------------------------------------

/**
 * 一覧表示用に、議員個人の結果配列（1投票あたり最大245件）を落とした投票のメタ情報。
 * 288投票分の results をそのままクライアントへ渡すと11MB規模になるため、
 * 一覧・議員ページではこの軽量な型だけを扱う。
 */
export interface RollCallVoteSummary {
  voteId: string;
  session: number;
  date: string;
  subject: string;
  billId: string | null;
  totalFor: number;
  totalAgainst: number;
  sourceUrl: string;
  /** その投票で記録されている議員数（賛成+反対+欠席+棄権） */
  entryCount: number;
}

export function toRollCallVoteSummary(vote: RollCallVote): RollCallVoteSummary {
  return {
    voteId: vote.voteId,
    session: vote.session,
    date: vote.date,
    subject: vote.subject,
    billId: vote.billId,
    totalFor: vote.totalFor,
    totalAgainst: vote.totalAgainst,
    sourceUrl: vote.sourceUrl,
    entryCount: vote.results.length,
  };
}

/**
 * 新しい投票から順に並べる比較関数。
 * 同じ日に複数の投票がある場合は voteId（"214-1001-v001" のように議事の順に
 * 採番されている）の降順とし、その日の後の議事から並ぶようにする。
 * 日付以外の観点（賛否の割れ方など）での並び替えは行わない。
 */
export function compareVotesByDateDesc(
  a: { date: string; voteId: string },
  b: { date: string; voteId: string }
): number {
  return b.date.localeCompare(a.date) || b.voteId.localeCompare(a.voteId);
}

/** 議員1名分の投票記録（どの投票で、どの区分だったか） */
export interface LegislatorVoteRecord {
  vote: RollCallVoteSummary;
  choice: RollCallVoteChoice;
}

/**
 * ある議員の投票記録を、新しい投票順に取り出す。
 * legislatorId で解決できた記録のみを対象にする（氏名しか分からない記録は、
 * 同姓同名の別人を取り違える恐れがあるため議員ページには出さない）。
 */
export function buildLegislatorVoteRecords(
  votes: RollCallVote[],
  legislatorId: string
): LegislatorVoteRecord[] {
  const records: LegislatorVoteRecord[] = [];
  for (const vote of votes) {
    const result = vote.results.find((r) => r.legislatorId === legislatorId);
    if (!result) continue;
    records.push({ vote: toRollCallVoteSummary(vote), choice: result.vote });
  }
  return records.sort((a, b) => compareVotesByDateDesc(a.vote, b.vote));
}

/** 個別投票ページ用: 議員個人の賛否を会派ごとにまとめたもの */
export interface PartyVoteMemberGroup {
  key: string;
  label: string;
  color: string;
  members: RollCallVoteResult[];
}

/**
 * 個別の記名投票について、議員個人の賛否を会派単位にまとめる。
 * 会派の並び順・「その他・無所属」の扱いは buildPartyVoteBreakdown と揃える
 * （会派内の並びは原データ＝参議院の投票結果ページの掲載順のまま）。
 */
export function buildPartyVoteMemberGroups(
  vote: RollCallVote,
  parties: Party[]
): PartyVoteMemberGroup[] {
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const groups = new Map<string, PartyVoteMemberGroup>();

  for (const r of vote.results) {
    const party = r.partyId ? partyById.get(r.partyId) : undefined;
    const key = party ? party.id : OTHER_KEY;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: party ? partyDisplayName(party, VOTE_CHAMBER) : OTHER_LABEL,
        color: party?.color ?? OTHER_COLOR,
        members: [],
      };
      groups.set(key, group);
    }
    group.members.push(r);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === OTHER_KEY) return 1;
    if (b.key === OTHER_KEY) return -1;
    return b.members.length - a.members.length;
  });
}
