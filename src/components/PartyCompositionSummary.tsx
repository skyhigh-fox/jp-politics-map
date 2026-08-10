import Link from "next/link";
import { PartyColorDot } from "@/components/PartyColorDot";
import type { Legislator, Party } from "@/types";

/**
 * トップページ用「政党別議席構成」サマリー。
 *
 * dataviz skill的には「identity型」の categorical 配色: 政党という
 * カテゴリを政党公式カラー（parties.jsonのcolor）でそのまま示す。
 * 中立性配慮のため並び順は議席数（客観的基準）の降順のみとし、上位政党を
 * 強調する演出（極端な拡大・先頭固定装飾など）は行わない。
 * 公式カラーは黄色・オレンジ系などコントラスト/CVD分離が弱い組み合わせを
 * 含む（検証済み）ため、色单独に依存せず常に政党名・件数のテキストを併記する
 * （PartyColorDot.tsxのコメント方針と同じ）。
 */
const TOP_N = 6;
const OTHER_COLOR = "#9E9E9E";

export function PartyCompositionSummary({
  legislators,
  parties,
}: {
  legislators: Legislator[];
  parties: Party[];
}) {
  const active = legislators.filter((l) => l.termStatus === "現職");
  const total = active.length;

  const countByParty = new Map<string, number>();
  for (const l of active) {
    countByParty.set(l.currentPartyId, (countByParty.get(l.currentPartyId) ?? 0) + 1);
  }
  const partyById = new Map(parties.map((p) => [p.id, p]));

  const sorted = [...countByParty.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const otherCount = rest.reduce((sum, [, c]) => sum + c, 0);

  const segments = top.map(([partyId, count]) => {
    const party = partyById.get(partyId);
    return {
      key: partyId,
      name: party?.abbreviation ?? party?.name ?? partyId,
      color: party?.color,
      count,
    };
  });
  if (otherCount > 0) {
    segments.push({
      key: "other",
      name: "その他",
      color: OTHER_COLOR,
      count: otherCount,
    });
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        政党別議席構成
      </h2>

      {total === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
          データ未取得です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:legislators
          </code>
          で取得してください。
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            現職{total.toLocaleString()}人・議席数順
          </p>

          <div
            role="img"
            aria-label={segments
              .map(
                (s) =>
                  `${s.name} ${s.count.toLocaleString()}人（${((s.count / total) * 100).toFixed(1)}%）`
              )
              .join("、")}
            className="mt-4 flex h-6 w-full gap-[2px] overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
          >
            {segments.map((s) => (
              <div
                key={s.key}
                title={`${s.name}: ${s.count.toLocaleString()}人（${((s.count / total) * 100).toFixed(1)}%）`}
                className="h-full"
                style={{
                  width: `${(s.count / total) * 100}%`,
                  backgroundColor: s.color || OTHER_COLOR,
                }}
              />
            ))}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {segments.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
              >
                <PartyColorDot color={s.color} />
                <span>{s.name}</span>
                <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                  {s.count.toLocaleString()}人
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href="/legislators"
        className="mt-4 inline-flex items-center text-xs font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
      >
        議員一覧を見る
        <span aria-hidden className="ml-1">
          →
        </span>
      </Link>
    </div>
  );
}
