import { PREFECTURE_CODES } from "@/lib/prefectures";
import type { PrefectureTurnoutElection } from "@/types";

/**
 * 投票率マップ（機能拡充ロードマップ Tier1 #7）の表示用ヘルパー。
 *
 * 【中立性の方針（重要）】
 * - 投票率の高低に「良い/悪い」「関心が高い/低い」といった含意を持たせない。
 *   本モジュールが生成する文言は、表示中の数値の言い換え（全国計はいくつか、
 *   都道府県別の値はどの範囲に散らばっているか、選択中の都道府県は全国計と
 *   何ポイント違うか）に限定する。
 * - 順位付けをしない。都道府県の並び順は常に都道府県コード順（総務省の
 *   原資料と同じ、評価的な意味を持たない既定順）とし、値の降順に並べ替えない。
 * - 「最も高い都道府県」「最も低い都道府県」を名指ししない。他レイヤーの
 *   DataInsightは最大・最小を名指ししているが、投票率については名指しが
 *   「その都道府県の有権者への評価」と読まれうるため、範囲（幅）の提示に留める。
 * - 男女別の区分は原資料（選挙人名簿上の性別）の区分をそのまま使う。
 */

export type TurnoutGenderKey = "total" | "male" | "female";

export interface TurnoutGenderMeta {
  key: TurnoutGenderKey;
  /** UI上の表示名（原資料の区分名に合わせる） */
  label: string;
  /** 選択中であることを説明文中で示すときの表記 */
  phrase: string;
}

/** 男女区分の選択肢（原資料の並び順「男・女・計」に対し、既定値の「計」を先頭に置く） */
export const TURNOUT_GENDERS: TurnoutGenderMeta[] = [
  { key: "total", label: "計（男女計）", phrase: "投票率" },
  { key: "male", label: "男", phrase: "男性の投票率" },
  { key: "female", label: "女", phrase: "女性の投票率" },
];

export function turnoutGenderMeta(key: TurnoutGenderKey): TurnoutGenderMeta {
  return TURNOUT_GENDERS.find((g) => g.key === key) ?? TURNOUT_GENDERS[0]!;
}

/** 投票率の表示形式（原資料と同じ小数第2位まで） */
export function formatTurnoutValue(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** 差分（ポイント）の表示形式。符号を明示する（±0.00ポイント） */
export function formatTurnoutDiff(diff: number): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return `${sign}${Math.abs(diff).toFixed(2)}ポイント`;
}

/** 選挙の表示ラベル（例:"2026年 第51回衆議院議員総選挙（小選挙区）"） */
export function turnoutElectionLabel(election: PrefectureTurnoutElection): string {
  return `${election.electionDate.slice(0, 4)}年 ${election.electionName}（${election.votingCategory}）`;
}

/** 地図レイヤー用: 指定選挙・指定区分の都道府県別マップを作る（値がない都道府県は除外） */
export function buildTurnoutLayer(
  election: PrefectureTurnoutElection,
  gender: TurnoutGenderKey
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of election.prefectures) {
    const value = entry[gender];
    if (value === null || value === undefined) continue;
    result[entry.prefecture] = value;
  }
  return result;
}

/**
 * サイドバーの一覧表示用の並び（都道府県コード順）。
 * 値の降順に並べ替えないことで「順位表」にしないための関数。
 */
export function sortByPrefectureCode(
  entries: [string, number][]
): [string, number][] {
  return entries
    .slice()
    .sort(
      (a, b) => Number(PREFECTURE_CODES[a[0]] ?? 99) - Number(PREFECTURE_CODES[b[0]] ?? 99)
    );
}

/**
 * 表示中の投票率レイヤーについて、数値の言い換えだけの事実を組み立てる。
 * 順位・評価は含めない（モジュール冒頭の方針を参照）。
 */
export function buildTurnoutMapFacts(
  election: PrefectureTurnoutElection,
  gender: TurnoutGenderKey,
  selectedPrefecture: string | null
): string[] {
  const meta = turnoutGenderMeta(gender);
  const facts: string[] = [];

  const national = election.national[gender];
  if (national !== null && national !== undefined) {
    facts.push(
      `${election.electionName}（${election.electionDate}執行、${election.votingCategory}）の${meta.phrase}は、全国計で${formatTurnoutValue(national)}です。`
    );
  }

  const values = election.prefectures
    .map((p) => p[gender])
    .filter((v): v is number => v !== null && v !== undefined);
  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    facts.push(
      `都道府県別の値は${formatTurnoutValue(min)}〜${formatTurnoutValue(max)}の範囲に分布しています（幅${(max - min).toFixed(2)}ポイント、${values.length}都道府県）。`
    );
  }

  if (selectedPrefecture) {
    const entry = election.prefectures.find(
      (p) => p.prefecture === selectedPrefecture
    );
    const value = entry?.[gender];
    if (value !== null && value !== undefined) {
      const diffText =
        national !== null && national !== undefined
          ? `、全国計との差は${formatTurnoutDiff(value - national)}`
          : "";
      facts.push(
        `選択中の${selectedPrefecture}は${formatTurnoutValue(value)}です${diffText}。`
      );
    }
  }

  return facts;
}

// ---------------------------------------------------------------------------
// 推移（時系列）
// ---------------------------------------------------------------------------

export interface TurnoutTrendPoint {
  electionId: string;
  /** 横軸ラベル（例:"2026"） */
  year: string;
  /** 回次を含む正式名（ツールチップ・表用） */
  electionName: string;
  electionDate: string;
  sourceUrl: string;
  /** 全国計の値（%）。原資料に値がない場合はnull */
  national: number | null;
  /** 選択中都道府県の値（%）。未選択・値なしの場合はnull */
  prefecture: number | null;
}

/** 院ごとの推移系列（衆議院と参議院は選挙の性格が違うため必ず分けて描く） */
export interface TurnoutTrendSeries {
  chamber: "衆議院" | "参議院";
  /** その院の投票の種類（"小選挙区" / "選挙区"） */
  votingCategory: string;
  points: TurnoutTrendPoint[];
}

/**
 * 院ごとに分けた投票率の推移を組み立てる。
 *
 * 衆議院（小選挙区）と参議院（選挙区）は選挙の仕組みも実施間隔も異なるため、
 * 1本の系列につなげず院ごとに分ける（つなげると異質なものを同じ推移として
 * 読ませてしまう）。
 */
export function buildTurnoutTrend(
  elections: PrefectureTurnoutElection[],
  gender: TurnoutGenderKey,
  selectedPrefecture: string | null
): TurnoutTrendSeries[] {
  const byChamber = new Map<string, TurnoutTrendSeries>();
  const sorted = elections
    .slice()
    .sort((a, b) => a.electionDate.localeCompare(b.electionDate));

  for (const election of sorted) {
    const series =
      byChamber.get(election.chamber) ??
      ({
        chamber: election.chamber,
        votingCategory: election.votingCategory,
        points: [],
      } satisfies TurnoutTrendSeries);
    byChamber.set(election.chamber, series);

    const prefEntry = selectedPrefecture
      ? election.prefectures.find((p) => p.prefecture === selectedPrefecture)
      : undefined;

    series.points.push({
      electionId: election.id,
      year: election.electionDate.slice(0, 4),
      electionName: election.electionName,
      electionDate: election.electionDate,
      sourceUrl: election.sourceUrl,
      national: election.national[gender] ?? null,
      prefecture: prefEntry?.[gender] ?? null,
    });
  }

  // 衆議院→参議院の順で返す（院の並びは常に固定。評価的な意味は持たない）
  const order: ("衆議院" | "参議院")[] = ["衆議院", "参議院"];
  return order
    .map((chamber) => byChamber.get(chamber))
    .filter((s): s is TurnoutTrendSeries => s !== undefined);
}

/**
 * 推移グラフに添える事実。全国計の推移の幅と、選択中都道府県との比較に留める。
 */
export function buildTurnoutTrendFacts(
  series: TurnoutTrendSeries[],
  gender: TurnoutGenderKey,
  selectedPrefecture: string | null
): string[] {
  const meta = turnoutGenderMeta(gender);
  const facts: string[] = [];

  for (const s of series) {
    const nationals = s.points
      .map((p) => p.national)
      .filter((v): v is number => v !== null);
    if (nationals.length === 0) continue;
    const first = s.points.find((p) => p.national !== null);
    const last = [...s.points].reverse().find((p) => p.national !== null);
    if (!first || !last || first === last) continue;
    facts.push(
      `${s.chamber}（${s.votingCategory}）の全国計は、${first.year}年の${formatTurnoutValue(first.national!)}から${last.year}年の${formatTurnoutValue(last.national!)}まで、収録${s.points.length}回で${formatTurnoutValue(Math.min(...nationals))}〜${formatTurnoutValue(Math.max(...nationals))}の範囲を推移しています。`
    );
  }

  if (selectedPrefecture) {
    for (const s of series) {
      const pairs = s.points.filter(
        (p) => p.national !== null && p.prefecture !== null
      );
      if (pairs.length === 0) continue;
      const above = pairs.filter((p) => p.prefecture! > p.national!).length;
      const below = pairs.filter((p) => p.prefecture! < p.national!).length;
      const same = pairs.length - above - below;
      const detail = [
        above > 0 ? `全国計を上回った回が${above}回` : null,
        below > 0 ? `下回った回が${below}回` : null,
        same > 0 ? `同値の回が${same}回` : null,
      ]
        .filter(Boolean)
        .join("、");
      facts.push(
        `${selectedPrefecture}の${meta.phrase}は、収録している${s.chamber}${pairs.length}回のうち${detail}です。`
      );
    }
  }

  return facts;
}
