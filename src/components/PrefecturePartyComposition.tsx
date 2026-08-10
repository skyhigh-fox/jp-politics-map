import Link from "next/link";
import { PartyColorDot } from "@/components/PartyColorDot";
import type { Party } from "@/types";

/**
 * 地図ページで都道府県を選択した際にサイドバーへ表示する
 * 「選択中の都道府県の政党別議席構成」。
 *
 * トップページ用の全国集計 PartyCompositionSummary.tsx とは別コンポーネントとして
 * 新規作成（既存コンポーネントは壊さない）。設計方針は概ね共通:
 * - dataviz skill的には「identity型」の categorical 配色（政党公式カラーを
 *   そのまま使う）。
 * - 中立性配慮のため並び順は議席数（客観的基準）の降順のみ。上位政党を
 *   強調する演出は行わない。
 * - 色单独に依存せず、常に政党名・件数のテキストを併記する
 *   （PartyColorDot.tsxの方針と同じ）。
 * - 全国集計と違い都道府県あたりの政党数はそもそも少ないため、
 *   「その他」への丸め込みは行わず全件を表示する。
 * - この集計は衆参両院の議員を合算しているため、名前は院別の会派名
 *   （Party.chambers[院].name。例: 衆「国民民主党・無所属クラブ」/
 *   参「国民民主党・新緑風会」）ではなく、院に依存しない共通表示名
 *   （Party.name / Party.abbreviation）を使う。片方の院の会派名を選ぶと、
 *   もう片方の院の議員にとって必ず誤った表示になるため。
 */
export function PrefecturePartyComposition({
  prefecture,
  partyCounts,
  parties,
}: {
  prefecture: string;
  /** 政党ID → この都道府県に関連する現職議員数 */
  partyCounts: Record<string, number>;
  parties: Party[];
}) {
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const sorted = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {prefecture}の政党別議席構成
      </h3>

      {total === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
          この都道府県に関連する現職議員のデータがありません。
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            関連議員{total.toLocaleString()}名・議席数順
          </p>

          <ul
            className="mt-3 space-y-1.5"
            role="img"
            aria-label={sorted
              .map(([partyId, count]) => {
                const party = partyById.get(partyId);
                const name = party?.abbreviation ?? party?.name ?? partyId;
                return `${name} ${count.toLocaleString()}名`;
              })
              .join("、")}
          >
            {sorted.map(([partyId, count]) => {
              const party = partyById.get(partyId);
              const name = party?.abbreviation ?? party?.name ?? partyId;
              const pct = (count / total) * 100;
              return (
                <li key={partyId} className="flex items-center gap-2 text-xs">
                  <span className="flex w-20 shrink-0 items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                    <PartyColorDot color={party?.color} />
                    <span className="truncate" title={party?.name ?? partyId}>
                      {name}
                    </span>
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: party?.color || "#9E9E9E",
                      }}
                    />
                  </span>
                  <span className="w-7 shrink-0 text-right tabular-nums text-neutral-500 dark:text-neutral-500">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link
        href={`/map/${encodeURIComponent(prefecture)}`}
        className="mt-4 inline-flex items-center text-xs font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
      >
        {prefecture}の詳細（市区町村マップ・議員一覧）を見る
        <span aria-hidden className="ml-1">
          →
        </span>
      </Link>
    </div>
  );
}
