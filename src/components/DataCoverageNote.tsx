import Link from "next/link";
import { type DatasetId, DATASET_META, datasetHref } from "@/lib/dataProvenance";

/**
 * 「このデータの収録範囲」注記。
 *
 * 各データが実際に表示される個別ページ（議員詳細・法案詳細など）に、
 * そのデータで確認できている範囲・確認できていない範囲を短く添えるための
 * 小さな注記コンポーネント。詳細は免責事項ページの該当データセットの
 * 見出しへ誘導する。
 *
 * 中立性の方針（DataInsight.tsx と同じ）:
 * - 文言は呼び出し側で実データから機械的に算出する（src/lib/dataProvenance.ts
 *   のbuild*Coverage関数を使う）。AIによる自然文生成は使わない。
 * - 「不十分」「不完全」といった評価語は使わず、「○○名分を確認できています」
 *   「○○は収録していません」という事実の記述に留める。
 *
 * 見た目は DataInsight（アクセントカラーの囲み）より一段控えめにして、
 * 本文の数値より注記が目立たないようにしている。
 */
export function DataCoverageNote({
  datasetId,
  facts,
  className = "",
}: {
  datasetId: DatasetId;
  facts: string[];
  className?: string;
}) {
  if (facts.length === 0) return null;
  const meta = DATASET_META[datasetId];
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60 ${className}`}
    >
      <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
        このデータの収録範囲
      </p>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        {facts.map((fact, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden className="text-neutral-400 dark:text-neutral-600">
              ・
            </span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        <Link
          href={datasetHref(datasetId)}
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          「{meta.label}」の出典と収録範囲を見る
        </Link>
      </p>
    </div>
  );
}
