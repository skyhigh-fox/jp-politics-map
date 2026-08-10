import type { Chamber, Party, PartySeatHistory } from "@/types";

/**
 * 政党別議席推移グラフ（PartySeatTrendChart）用の集計。
 *
 * data/party-seat-history.json は選挙ごとに「その時点の政党名・獲得議席数」を
 * 原資料の表記のまま保持している（scripts/fetch-party-seat-history.ts参照）。
 * このうち data/parties.json の id に解決できなかった政党（解散・改称等で
 * 現在の政党マスタに対応がつかないもの）は、グラフ上では色を新規に割り当てず
 * 「その他（解散・改称等）」としてグレーの1系列にまとめる。個々の政党名・議席数は
 * データテーブル（<details>展開）側では省略せずそのまま提示する。
 */

const OTHER_KEY = "__other__";
export const OTHER_LABEL = "その他（解散・改称等）";
// PartyColorDot.tsx のフォールバック色と同じグレーを採用し、
// ライト/ダーク両テーマで単一値のまま使う既存の政党カラーの扱いに合わせる。
export const OTHER_COLOR = "#9E9E9E";

export interface SeatTrendSegment {
  key: string;
  label: string;
  color: string;
  seats: number;
}

export interface SeatTrendElection {
  electionYear: number;
  electionName: string;
  electionDate: string;
  totalSeats: number;
  /** 積み上げ順（凡例と同じ並び、"その他"は最後） */
  segments: SeatTrendSegment[];
  /** データテーブル用：原資料の政党名単位の内訳（"その他"にまとめる前の生データ） */
  rawResults: { partyName: string; seats: number }[];
  sourceUrl: string;
}

export interface ChamberSeatTrend {
  chamber: Chamber;
  elections: SeatTrendElection[];
  /** 凡例（登場する全政党を、全選挙合計の議席数の多い順に並べたもの。"その他"は末尾固定） */
  legend: { key: string; label: string; color: string }[];
}

export function buildChamberSeatTrend(
  history: PartySeatHistory[],
  parties: Party[],
  chamber: Chamber
): ChamberSeatTrend | null {
  const rows = history
    .filter((h) => h.chamber === chamber)
    .sort((a, b) => a.electionYear - b.electionYear);
  if (rows.length === 0) return null;

  const partyById = new Map(parties.map((p) => [p.id, p]));
  const totalByKey = new Map<string, number>();
  const labelByKey = new Map<string, string>();
  const colorByKey = new Map<string, string>();

  const elections: SeatTrendElection[] = rows.map((row) => {
    const byKey = new Map<string, { label: string; color: string; seats: number }>();

    for (const r of row.results) {
      const party = r.partyId ? partyById.get(r.partyId) : undefined;
      const key = party ? party.id : OTHER_KEY;
      const label = party ? party.name : OTHER_LABEL;
      const color = party?.color ?? OTHER_COLOR;
      const prev = byKey.get(key);
      byKey.set(key, {
        label,
        color,
        seats: (prev?.seats ?? 0) + r.seats,
      });
      totalByKey.set(key, (totalByKey.get(key) ?? 0) + r.seats);
      labelByKey.set(key, label);
      colorByKey.set(key, color);
    }

    // 積み上げ順は議席数の多い順（"その他"は必ず最後）
    const segments = [...byKey.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => {
        if (a.key === OTHER_KEY) return 1;
        if (b.key === OTHER_KEY) return -1;
        return b.seats - a.seats;
      });

    return {
      electionYear: row.electionYear,
      electionName: row.electionName,
      electionDate: row.electionDate,
      totalSeats: row.totalSeats,
      segments,
      rawResults: row.results.map((r) => ({
        partyName: r.partyName,
        seats: r.seats,
      })),
      sourceUrl: row.sourceUrl,
    };
  });

  const legend = [...totalByKey.entries()]
    .map(([key, total]) => ({
      key,
      label: labelByKey.get(key)!,
      color: colorByKey.get(key)!,
      total,
    }))
    .sort((a, b) => {
      if (a.key === OTHER_KEY) return 1;
      if (b.key === OTHER_KEY) return -1;
      return b.total - a.total;
    })
    .map(({ key, label, color }) => ({ key, label, color }));

  return { chamber, elections, legend };
}

/**
 * グラフ表示中のデータから機械的に言い換えられる事実の一覧を作る
 * （DataInsight コンポーネント用）。
 * 「良い/悪い」等の評価語は使わず、直近選挙の議席1位と、前回選挙からの
 * 増減が大きい政党（"その他"は集計対象の顔ぶれが選挙ごとに変わるため除外）
 * だけを言い換える。原因の推測はしない。
 */
export function buildSeatTrendFacts(trend: ChamberSeatTrend): string[] {
  const { elections } = trend;
  if (elections.length === 0) return [];
  const facts: string[] = [];

  const latest = elections[elections.length - 1]!;
  const topInLatest = latest.segments.find((s) => s.key !== OTHER_KEY);
  if (topInLatest) {
    const pct = ((topInLatest.seats / latest.totalSeats) * 100).toFixed(0);
    facts.push(
      `直近の${latest.electionName}（${latest.electionYear}年）で最も議席が多いのは${topInLatest.label}（${topInLatest.seats}議席、全体の${pct}%）です。`
    );
  }

  if (elections.length >= 2) {
    const prev = elections[elections.length - 2]!;
    const prevByKey = new Map(prev.segments.map((s) => [s.key, s.seats]));
    const diffs = latest.segments
      .filter((s) => s.key !== OTHER_KEY && prevByKey.has(s.key))
      .map((s) => ({
        label: s.label,
        diff: s.seats - (prevByKey.get(s.key) ?? 0),
      }))
      .filter((d) => d.diff !== 0);

    const maxGain = diffs.reduce(
      (max, d) => (d.diff > (max?.diff ?? 0) ? d : max),
      null as { label: string; diff: number } | null
    );
    const maxLoss = diffs.reduce(
      (min, d) => (d.diff < (min?.diff ?? 0) ? d : min),
      null as { label: string; diff: number } | null
    );

    if (maxGain) {
      facts.push(
        `前回の${prev.electionName}（${prev.electionYear}年）と比べて、${maxGain.label}は${maxGain.diff}議席増えました。`
      );
    }
    if (maxLoss && maxLoss.label !== maxGain?.label) {
      facts.push(
        `同じく前回と比べて、${maxLoss.label}は${Math.abs(maxLoss.diff)}議席減りました。`
      );
    }
  }

  return facts;
}
