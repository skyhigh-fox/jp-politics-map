"use client";

import { useState } from "react";
import { PartyColorDot } from "@/components/PartyColorDot";
import {
  LOCAL_BODY_GROUPS,
  type LocalPartyCompositionView,
} from "@/lib/localPartyCompositionStats";
import type { LocalGovernmentBodyType } from "@/types";

/**
 * 都道府県詳細ページ用「地方議会・長の党派別構成」
 * （機能拡充ロードマップ Tier1 #6）。
 *
 * 【このデータの位置づけ】
 * 東京都議会のパイロット（data/local-assembly-members.json）が「議員個人の名簿」
 * であるのに対し、こちらは総務省の統計「所属党派別人員調」に基づく
 * 「党派別の人員数の集計」。議員個人は含まれない代わりに47都道府県すべて・
 * 都道府県議会/市区議会/町村議会/各長の全区分をカバーする、粒度の異なる
 * 別レイヤーとして提示する。
 *
 * 【中立性への配慮（重要）】
 * - 党派の並び順は総務省の原表の列順のまま。人数順に並べ替えると事実上の
 *   ランキング表示になるため行わない。
 * - 積み上げバーは全党派を等しい高さ・等しい彩度で並べ、第1党だけを強調する
 *   「勝者総取り」的な演出（塗り分け地図・王冠アイコン等）は使わない。
 * - 他の都道府県との比較・順位は表示しない。
 * - 色は識別の補助であり、常に党派名と人数のテキストを併記する
 *   （PartyColorDot.tsx と同じ方針）。読み上げ用に aria-label も付ける。
 */
export function LocalAssemblyPartyComposition({
  views,
  asOfLabel,
  sourceUrl,
  sourcePageUrl,
}: {
  views: LocalPartyCompositionView[];
  /** 例:"2025年12月31日現在" */
  asOfLabel: string;
  sourceUrl: string;
  sourcePageUrl: string;
}) {
  const viewByType = new Map(views.map((v) => [v.bodyType, v]));
  const availableGroups = LOCAL_BODY_GROUPS.map((group) => ({
    ...group,
    bodyTypes: group.bodyTypes.filter((t) => viewByType.has(t)),
  })).filter((group) => group.bodyTypes.length > 0);

  const firstType = availableGroups[0]?.bodyTypes[0];
  const [selected, setSelected] = useState<LocalGovernmentBodyType | undefined>(
    firstType
  );
  const view = selected ? viewByType.get(selected) : undefined;

  if (!view) return null;

  const legendLabel = view.segments
    .map((s) => `${s.name} ${s.count.toLocaleString()}名`)
    .join("、");

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        地方議会・長の党派別構成
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
        {asOfLabel}。総務省「地方公共団体の議会の議員及び長の所属党派別人員調」による、県内の各区分の人員数の集計です（議員個人の名簿ではありません）。党派の並び順は原表の掲載順で固定しており、人数順ではありません。
      </p>

      <div className="mt-3 space-y-2">
        {availableGroups.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-1.5">
            <span
              className="w-8 shrink-0 text-[11px] text-neutral-400 dark:text-neutral-600"
              title={group.description}
            >
              {group.label}
            </span>
            {group.bodyTypes.map((bodyType) => {
              const isActive = bodyType === selected;
              return (
                <button
                  key={bodyType}
                  type="button"
                  onClick={() => setSelected(bodyType)}
                  aria-pressed={isActive}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    isActive
                      ? "border-accent-500 bg-accent-50 font-medium text-accent-700 dark:border-accent-400 dark:bg-accent-950 dark:text-accent-300"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                >
                  {bodyType}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
        定数{" "}
        <span className="tabular-nums font-medium">
          {view.fixedNumber.toLocaleString()}
        </span>
        {" ／ "}現員{" "}
        <span className="tabular-nums font-medium">
          {view.totalMembers.toLocaleString()}
        </span>
        {" ／ "}欠員{" "}
        <span className="tabular-nums font-medium">
          {view.vacancies.toLocaleString()}
        </span>
      </p>

      {view.segments.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
          この区分の現員は0名です（調査基準日時点）。
        </p>
      ) : (
        <>
          <div
            className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
            role="img"
            aria-label={`${selected}の党派別人員: ${legendLabel}`}
          >
            {view.segments.map((segment) => (
              <span
                key={segment.name}
                className="h-full"
                style={{
                  width: `${segment.sharePercent}%`,
                  backgroundColor: segment.color,
                }}
                title={`${segment.name} ${segment.count.toLocaleString()}名`}
              />
            ))}
          </div>

          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {view.segments.map((segment) => (
              <li
                key={segment.name}
                className="flex items-center gap-2 text-xs"
              >
                <PartyColorDot color={segment.color} />
                <span
                  className="flex-1 truncate text-neutral-600 dark:text-neutral-400"
                  title={segment.name}
                >
                  {segment.name}
                </span>
                <span className="shrink-0 tabular-nums text-neutral-700 dark:text-neutral-300">
                  {segment.count.toLocaleString()}名
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-600">
                  {segment.sharePercent.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-600">
            「諸派」は原表が複数の少数政党をまとめて集計している区分で、特定の政党を指すものではありません。原表で独立した列を持たない地域政党・政治団体もこの区分に含まれます。人員が0名の党派は表示していません。占有率は現員に対する割合です。
          </p>
        </>
      )}

      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <a
          href={sourcePageUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          出典: 総務省「所属党派別人員調」
        </a>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          原資料（Excel）
        </a>
      </p>
    </div>
  );
}
