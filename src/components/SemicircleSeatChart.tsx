import type { Chamber, Legislator, Party } from "@/types";
import { PartyColorDot } from "@/components/PartyColorDot";
import { DataInsight } from "@/components/DataInsight";

/**
 * トップページ用「半円形議席配置図」（衆院・参院それぞれ）。
 *
 * dataviz skill的には「identity型」の categorical 配色: PartyCompositionSummary.tsx
 * と同じ思想で、政党という カテゴリを政党公式カラー（parties.jsonのcolor）でそのまま
 * 示す。中立性配慮のため並び順は議席数（客観的基準）の降順のみとし、イデオロギー的な
 * 左右配置など主観的な基準は一切使わない。半円の一端から他端まで、政党ごとに
 * ドットが一塊（くさび形）になるように並べる。
 *
 * 座席の配置アルゴリズム（自前実装、同心円弧方式）:
 *   1. 半円の内側半径〜外側半径の範囲を等間隔の弧（行）に分割する行数Rを、
 *      各行の弧上の点間隔が行間の半径方向間隔とほぼ等しくなるよう探索して決める
 *      （小さいRから順に「各行の弧長 ÷ 行間隔」で入る点数の合計が総議席数以上に
 *      なるまで増やす）。
 *   2. 決まった行数Rに対し、各行の座席数を半径に比例配分する（半径が大きい＝弧が
 *      長い行ほど多くの座席を割り当てる）ことで、内側〜外側で点の密度がほぼ均一に
 *      なるようにする。端数は最大剰余法で調整し、合計が総議席数と厳密に一致する
 *      ようにする。
 *   3. 各行内の座席はその行の弧（角度0〜π）に等間隔に配置する。
 *   4. 全座席点を行をまたいで角度の昇順に並べ替え、議席数降順の政党順に先頭から
 *      詰めていく。これにより行構造とは独立に、政党ごとの塊が半円上で
 *      くさび形（扇形）にまとまる。
 *
 * 色だけに依存しないアクセシビリティ対応:
 *   - 政党ごとの塊は<g role="img" aria-label="党名 n議席（xx.x%）">でグループ化し、
 *     キーボードフォーカス可能にする（tabIndex）。
 *   - 個々のドットには<title>で「党名: n議席」のホバーツールチップを付与する。
 *   - 凡例に政党名・議席数を必ずテキスト併記する（PartyColorDot.tsx方針と同じ）。
 *   - <details>によるデータテーブル代替を用意し、視覚化なしでも全政党の内訳を
 *     確認できるようにする。
 */

const TOP_N = 8;
const OTHER_COLOR = "#9E9E9E";

// SVGジオメトリ（両院で共通の見た目サイズにする。ドット径や行数は総議席数に応じて
// 自動調整されるため、衆院465人前後・参院248人前後のどちらでも同程度の密度で描ける）
const PADDING = 14;
const OUTER_RADIUS = 170;
const INNER_RADIUS = 60;
const CX = OUTER_RADIUS + PADDING;
const CY = OUTER_RADIUS + PADDING;
const SVG_WIDTH = CX * 2;
const SVG_HEIGHT = CY + 22;

interface SeatPoint {
  r: number;
  theta: number;
}

interface SeatLayout {
  points: SeatPoint[];
  dotRadius: number;
}

/** 同心円弧上に総議席数分の点を、行間隔・弧上点間隔ができるだけ均等になるよう配置する */
function layoutSeats(total: number): SeatLayout {
  if (total <= 0) return { points: [], dotRadius: 4 };

  const radiusRange = OUTER_RADIUS - INNER_RADIUS;
  let rows = 1;
  let rowSpacing = radiusRange || 1;

  for (let candidateRows = 1; candidateRows <= 60; candidateRows++) {
    const dr = candidateRows === 1 ? 0 : radiusRange / (candidateRows - 1);
    const spacing = dr || radiusRange || 1;
    let capacity = 0;
    for (let i = 0; i < candidateRows; i++) {
      const r = INNER_RADIUS + i * dr;
      capacity += Math.floor((Math.PI * r) / spacing) + 1;
    }
    rows = candidateRows;
    rowSpacing = spacing;
    if (capacity >= total) break;
  }

  const dr = rows === 1 ? 0 : radiusRange / (rows - 1);
  const radii = Array.from({ length: rows }, (_, i) => INNER_RADIUS + i * dr);
  const weightSum = radii.reduce((sum, r) => sum + r, 0);

  // 各行の座席数を半径に比例配分（最大剰余法で端数を調整し合計を総議席数に一致させる）
  const raw = radii.map((r) => (weightSum > 0 ? (total * r) / weightSum : total / rows));
  const seatsPerRow = raw.map((v) => Math.max(1, Math.floor(v)));
  const allocated = seatsPerRow.reduce((sum, v) => sum + v, 0);

  const remainders = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let diff = total - allocated;
  let ri = 0;
  while (diff > 0 && ri < remainders.length) {
    const entry = remainders[ri];
    if (entry) {
      seatsPerRow[entry.i] = (seatsPerRow[entry.i] ?? 0) + 1;
    }
    diff -= 1;
    ri += 1;
  }
  while (diff < 0) {
    let maxIdx = 0;
    let maxVal = seatsPerRow[0] ?? 0;
    for (let idx = 1; idx < seatsPerRow.length; idx++) {
      const v = seatsPerRow[idx] ?? 0;
      if (v > maxVal) {
        maxVal = v;
        maxIdx = idx;
      }
    }
    if (maxVal <= 1) break;
    seatsPerRow[maxIdx] = maxVal - 1;
    diff += 1;
  }

  const points: SeatPoint[] = [];
  for (let i = 0; i < rows; i++) {
    const n = seatsPerRow[i] ?? 0;
    const r = radii[i] ?? INNER_RADIUS;
    for (let j = 0; j < n; j++) {
      const theta = n === 1 ? Math.PI / 2 : (j / (n - 1)) * Math.PI;
      points.push({ r, theta });
    }
  }
  // 行をまたいで角度昇順に並べることで、政党ブロックが半円上で扇形にまとまる
  points.sort((a, b) => a.theta - b.theta || a.r - b.r);

  const dotRadius = Math.max(2, Math.min(7, rowSpacing / 2.6));

  return { points, dotRadius };
}

interface Segment {
  key: string;
  name: string;
  color: string;
  count: number;
}

export function SemicircleSeatChart({
  chamber,
  legislators,
  parties,
}: {
  chamber: Chamber;
  legislators: Legislator[];
  parties: Party[];
}) {
  const active = legislators.filter(
    (l) => l.chamber === chamber && l.termStatus === "現職"
  );
  const total = active.length;
  const partyById = new Map(parties.map((p) => [p.id, p]));

  const countByParty = new Map<string, number>();
  for (const l of active) {
    countByParty.set(l.currentPartyId, (countByParty.get(l.currentPartyId) ?? 0) + 1);
  }
  // 議席数の降順のみを基準にする（イデオロギー的な左右配置等は使わない）
  const sorted = [...countByParty.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const otherCount = rest.reduce((sum, [, c]) => sum + c, 0);

  const segments: Segment[] = top.map(([partyId, count]) => {
    const party = partyById.get(partyId);
    return {
      key: partyId,
      name: party?.abbreviation ?? party?.name ?? partyId,
      color: party?.color || OTHER_COLOR,
      count,
    };
  });
  if (otherCount > 0) {
    segments.push({ key: "other", name: "その他", color: OTHER_COLOR, count: otherCount });
  }

  // データテーブル代替は折りたたみ無しの全政党内訳（TOP_Nで畳まれた「その他」も展開）
  const fullBreakdown = sorted.map(([partyId, count]) => {
    const party = partyById.get(partyId);
    return {
      key: partyId,
      name: party?.name ?? partyId,
      abbreviation: party?.abbreviation ?? party?.name ?? partyId,
      color: party?.color || OTHER_COLOR,
      count,
    };
  });

  const { points, dotRadius } = layoutSeats(total);

  // データからわかること: 最大会派と過半数ラインの関係を機械的に言い換える
  // （「単独過半数を握っている」という事実の言い換えのみ。政策的な評価はしない）
  const facts: string[] = [];
  const top1 = sorted[0];
  if (total > 0 && top1) {
    const [topPartyId, topCount] = top1;
    const topParty = partyById.get(topPartyId);
    const topName = topParty?.name ?? topPartyId;
    const majority = Math.floor(total / 2) + 1;
    const diff = topCount - majority;
    const pct = ((topCount / total) * 100).toFixed(0);
    facts.push(
      `最も議席が多いのは${topName}（${topCount.toLocaleString()}議席、全体の${pct}%）です。過半数（${majority}議席）を${
        diff >= 0 ? `${diff}議席上回っています` : `${-diff}議席下回っています`
      }。`
    );
  }

  // 政党ブロックごとに点列を先頭から詰めていく
  let cursor = 0;
  const groups = segments.map((s) => {
    const slice = points.slice(cursor, cursor + s.count);
    cursor += s.count;
    return { ...s, points: slice };
  });

  return (
    <div className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {chamber}の議席配置
      </h3>

      {total === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
          データ未取得です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:sangiin-members
          </code>
          ・
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:shugiin-members
          </code>
          で取得してください。
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            現職{total.toLocaleString()}人・議席数順
          </p>

          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="mx-auto mt-3 w-full max-w-sm"
            role="group"
            aria-label={`${chamber}の議席配置図: ${segments
              .map(
                (s) =>
                  `${s.name} ${s.count.toLocaleString()}議席（${((s.count / total) * 100).toFixed(1)}%）`
              )
              .join("、")}`}
          >
            {groups.map((g) => (
              <g
                key={g.key}
                tabIndex={0}
                role="img"
                aria-label={`${g.name}: ${g.count.toLocaleString()}議席（${((g.count / total) * 100).toFixed(1)}%）`}
                className="focus:outline-none"
              >
                {g.points.map((p, idx) => {
                  const x = CX + p.r * Math.cos(p.theta);
                  const y = CY - p.r * Math.sin(p.theta);
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r={dotRadius}
                      fill={g.color}
                      stroke="currentColor"
                      strokeOpacity={0.15}
                      strokeWidth={0.75}
                      className="text-black dark:text-white"
                    >
                      <title>{`${g.name}: ${g.count.toLocaleString()}議席`}</title>
                    </circle>
                  );
                })}
              </g>
            ))}
          </svg>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {segments.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
              >
                <PartyColorDot color={s.color} />
                <span>{s.name}</span>
                <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                  {s.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>

          <DataInsight facts={facts} />

          <details className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
            <summary className="cursor-pointer select-none font-medium text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100">
              データテーブルで表示
            </summary>
            <table className="mt-2 w-full border-collapse text-left">
              <caption className="sr-only">{chamber}の政党別議席数一覧</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-500">
                  <th scope="col" className="py-1 pr-2 font-medium">
                    政党
                  </th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">
                    議席数
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    割合
                  </th>
                </tr>
              </thead>
              <tbody>
                {fullBreakdown.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60"
                  >
                    <th
                      scope="row"
                      className="flex items-center gap-1.5 py-1 pr-2 font-normal"
                    >
                      <PartyColorDot color={row.color} />
                      {row.name}
                    </th>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {((row.count / total) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
