"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrefectureMap } from "@/components/PrefectureMap";
import { PrefecturePartyComposition } from "@/components/PrefecturePartyComposition";
import { PrefectureTurnoutTrendChart } from "@/components/PrefectureTurnoutTrendChart";
import { DataInsight } from "@/components/DataInsight";
import { DataCoverageNote } from "@/components/DataCoverageNote";
import { formatYenCompact, formatYenPerCapita } from "@/lib/formatFinance";
import {
  FINANCIAL_HEALTH_INDICATORS,
  formatFinancialHealthValue,
  type FinancialHealthIndicatorMeta,
} from "@/lib/financialHealthStats";
import {
  TURNOUT_GENDERS,
  buildTurnoutLayer,
  buildTurnoutMapFacts,
  buildTurnoutTrend,
  buildTurnoutTrendFacts,
  formatTurnoutValue,
  sortByPrefectureCode,
  turnoutElectionLabel,
  turnoutGenderMeta,
  type TurnoutGenderKey,
} from "@/lib/turnoutStats";
import type { Party, PrefectureTurnoutElection } from "@/types";

type Layer =
  | "legislators"
  | "finance"
  | "expenditure"
  | "financialHealth"
  | "turnout";

/**
 * `/map` ページ本体。左に都道府県地図、右にサイドバー
 * （議員数ランキング表＋選択中都道府県の政党別内訳）を並べる2カラムレイアウト。
 *
 * - デスクトップ（lg以上）は「左: 地図／右: サイドバー」の横並び、
 *   モバイルは縦積み（サイドバーが地図の下に来る）。
 * - サイドバーの議員数ランキング表は、地図が読めない・使えないユーザー向けの
 *   アクセシビリティ代替として常設する（地図と同じ情報をテキストでも取得できる）。
 *   ランキングの各行はボタンになっており、地図のクリックと同じ「選択」操作を
 *   キーボード・スクリーンリーダーからも行える。
 * - 都道府県クリック（またはランキング行選択）は、即座に議員一覧へは遷移せず、
 *   まずサイドバーにその都道府県の政党別議席構成を表示する2段階導線
 *   （PrefectureMapのonSelectPrefectureコールバックで受け取る）。
 *   一覧ページへはPrefecturePartyComposition内のリンクから遷移する。
 * - 地図の指標レイヤーは「関連議員数」「歳出総額（都道府県財政、Phase 4）」
 *   「歳出内訳（分野別・人口一人当たり、予算の見える化Phase A-2）」
 *   「財政健全化指標（予算の見える化Phase B）」「投票率（機能拡充ロードマップ
 *   Tier1 #7）」の5種類を切り替えられる（各データが取得できている場合のみ
 *   そのボタンを表示）。どのレイヤーでも配色ロジック（colorForCount）は
 *   共通のまま、指標値と表示形式だけが切り替わる。
 * - サイドバーの一覧は、既定では値の降順（ランキング）だが、投票率レイヤーだけは
 *   都道府県コード順の「一覧」にしている。投票率の順位表は
 *   「投票率が高い＝良い/意識が高い」という含意を持ちやすく、
 *   本プロジェクトの中立性方針に反するため（src/lib/turnoutStats.ts 冒頭の
 *   方針コメントを参照）。
 */
export function MapExplorer({
  counts,
  partyCountsByPrefecture,
  parties,
  financeCounts,
  financeFiscalYear,
  expenditureLayers,
  expenditureCategories,
  expenditureFiscalYear,
  financialHealthLayers,
  financialHealthFiscalYear,
  turnoutElections,
  turnoutCoverageFacts,
}: {
  counts: Record<string, number>;
  partyCountsByPrefecture: Record<string, Record<string, number>>;
  parties: Party[];
  /** 都道府県別 歳出総額（千円単位）。未取得時はundefinedまたは空オブジェクト */
  financeCounts?: Record<string, number>;
  financeFiscalYear?: number;
  /** 歳出の目的別区分ごとの都道府県別・人口一人当たり金額（円）マップ */
  expenditureLayers?: Record<string, Record<string, number>>;
  /** expenditureLayersの表示順（総務省の目的別分類順、中立的な既定順） */
  expenditureCategories?: string[];
  expenditureFiscalYear?: number;
  /** 財政健全化指標キーごとの都道府県別マップ */
  financialHealthLayers?: Record<string, Record<string, number>>;
  financialHealthFiscalYear?: number;
  /** 国政選挙ごとの都道府県別投票率（投票日の昇順）。未取得時は空配列 */
  turnoutElections?: PrefectureTurnoutElection[];
  /**
   * 投票率データの収録範囲（dataProvenance.ts のbuildPrefectureTurnoutCoverageで
   * サーバ側が実データから算出したもの）。投票率レイヤー表示時に注記として出す
   */
  turnoutCoverageFacts?: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("legislators");
  const [expenditureCategory, setExpenditureCategory] = useState(
    () =>
      expenditureCategories?.find((c) => c === "教育費") ??
      expenditureCategories?.[0] ??
      ""
  );
  const [financialHealthIndicator, setFinancialHealthIndicator] =
    useState<FinancialHealthIndicatorMeta["key"]>(
      FINANCIAL_HEALTH_INDICATORS[0]!.key
    );
  // 投票率レイヤーの既定は「直近の選挙」「男女計」
  const [turnoutElectionId, setTurnoutElectionId] = useState(
    () => turnoutElections?.[turnoutElections.length - 1]?.id ?? ""
  );
  const [turnoutGender, setTurnoutGender] = useState<TurnoutGenderKey>("total");

  const hasFinanceLayer = !!financeCounts && Object.keys(financeCounts).length > 0;
  const hasExpenditureLayer =
    !!expenditureLayers && (expenditureCategories?.length ?? 0) > 0;
  const hasFinancialHealthLayer =
    !!financialHealthLayers &&
    Object.keys(financialHealthLayers).length > 0;
  const hasTurnoutLayer = (turnoutElections?.length ?? 0) > 0;
  const activeLayer: Layer =
    (layer === "finance" && hasFinanceLayer) ||
    (layer === "expenditure" && hasExpenditureLayer) ||
    (layer === "financialHealth" && hasFinancialHealthLayer) ||
    (layer === "turnout" && hasTurnoutLayer)
      ? layer
      : "legislators";

  const activeIndicatorMeta = FINANCIAL_HEALTH_INDICATORS.find(
    (i) => i.key === financialHealthIndicator
  )!;
  const activeTurnoutElection =
    turnoutElections?.find((e) => e.id === turnoutElectionId) ??
    turnoutElections?.[turnoutElections.length - 1];
  const turnoutGenderLabel = turnoutGenderMeta(turnoutGender).label;

  const activeCounts =
    activeLayer === "finance"
      ? financeCounts!
      : activeLayer === "expenditure"
        ? (expenditureLayers![expenditureCategory] ?? {})
        : activeLayer === "financialHealth"
          ? (financialHealthLayers![financialHealthIndicator] ?? {})
          : activeLayer === "turnout"
            ? buildTurnoutLayer(activeTurnoutElection!, turnoutGender)
            : counts;
  const metricLabel =
    activeLayer === "finance"
      ? "歳出総額"
      : activeLayer === "expenditure"
        ? expenditureCategory
        : activeLayer === "financialHealth"
          ? activeIndicatorMeta.label
          : activeLayer === "turnout"
            ? `投票率（${turnoutGenderLabel}）`
            : "関連議員";
  const formatValue = useMemo(
    () =>
      activeLayer === "finance"
        ? formatYenCompact
        : activeLayer === "expenditure"
          ? formatYenPerCapita
          : activeLayer === "financialHealth"
            ? (v: number) => formatFinancialHealthValue(v, activeIndicatorMeta)
            : activeLayer === "turnout"
              ? formatTurnoutValue
              : (v: number) => `${v}名`,
    [activeLayer, activeIndicatorMeta]
  );

  // 投票率レイヤーは順位表にしない（都道府県コード順の「一覧」にする）。
  // 詳細な理由はファイル冒頭のコメントと src/lib/turnoutStats.ts を参照。
  const isRankedList = activeLayer !== "turnout";
  const entries = Object.entries(activeCounts);
  const ranking = isRankedList
    ? entries.sort((a, b) => b[1] - a[1])
    : sortByPrefectureCode(entries);

  const turnoutTrend = useMemo(
    () =>
      activeLayer === "turnout"
        ? buildTurnoutTrend(turnoutElections ?? [], turnoutGender, selected)
        : [],
    [activeLayer, turnoutElections, turnoutGender, selected]
  );

  // データからわかること: 表示中レイヤーの最高/最低を機械的に言い換える
  // （評価語は使わず「高い/低い」「多い/少ない」という事実の言い換えのみ）。
  // 投票率レイヤーだけは最高/最低の都道府県を名指しせず、全国計との比較と
  // 分布の幅に留める（turnoutStats.ts の中立性方針）。
  const mapFacts: string[] = [];
  if (activeLayer === "turnout" && activeTurnoutElection) {
    mapFacts.push(
      ...buildTurnoutMapFacts(activeTurnoutElection, turnoutGender, selected)
    );
  } else if (ranking.length > 0) {
    const rankWord = activeLayer === "legislators" ? "多い" : "高い";
    const rankWordLow = activeLayer === "legislators" ? "少ない" : "低い";
    const [topName, topValue] = ranking[0]!;
    const [bottomName, bottomValue] = ranking[ranking.length - 1]!;
    mapFacts.push(
      `${metricLabel}が最も${rankWord}のは${topName}（${formatValue(topValue)}）です。`
    );
    if (bottomName !== topName) {
      mapFacts.push(
        `最も${rankWordLow}のは${bottomName}（${formatValue(bottomValue)}）です。`
      );
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        {(hasFinanceLayer ||
          hasExpenditureLayer ||
          hasFinancialHealthLayer ||
          hasTurnoutLayer) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="地図に表示する指標の切り替え"
              className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-xs dark:border-neutral-800 dark:bg-neutral-900"
            >
              <button
                type="button"
                onClick={() => setLayer("legislators")}
                aria-pressed={activeLayer === "legislators"}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  activeLayer === "legislators"
                    ? "bg-accent-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                関連議員数
              </button>
              {hasFinanceLayer && (
                <button
                  type="button"
                  onClick={() => setLayer("finance")}
                  aria-pressed={activeLayer === "finance"}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeLayer === "finance"
                      ? "bg-accent-600 text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                >
                  歳出総額{financeFiscalYear ? `（${financeFiscalYear}年度）` : ""}
                </button>
              )}
              {hasExpenditureLayer && (
                <button
                  type="button"
                  onClick={() => setLayer("expenditure")}
                  aria-pressed={activeLayer === "expenditure"}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeLayer === "expenditure"
                      ? "bg-accent-600 text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                >
                  歳出内訳（人口一人当たり）
                </button>
              )}
              {hasFinancialHealthLayer && (
                <button
                  type="button"
                  onClick={() => setLayer("financialHealth")}
                  aria-pressed={activeLayer === "financialHealth"}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeLayer === "financialHealth"
                      ? "bg-accent-600 text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                >
                  財政健全化指標
                </button>
              )}
              {hasTurnoutLayer && (
                <button
                  type="button"
                  onClick={() => setLayer("turnout")}
                  aria-pressed={activeLayer === "turnout"}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeLayer === "turnout"
                      ? "bg-accent-600 text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                >
                  投票率
                </button>
              )}
            </div>
            {activeLayer === "expenditure" && (
              <label className="text-xs text-neutral-600 dark:text-neutral-400">
                <span className="sr-only">歳出の分野</span>
                <select
                  value={expenditureCategory}
                  onChange={(e) => setExpenditureCategory(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  {expenditureCategories!.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {activeLayer === "financialHealth" && (
              <label className="text-xs text-neutral-600 dark:text-neutral-400">
                <span className="sr-only">財政健全化指標の種類</span>
                <select
                  value={financialHealthIndicator}
                  onChange={(e) =>
                    setFinancialHealthIndicator(
                      e.target.value as FinancialHealthIndicatorMeta["key"]
                    )
                  }
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  {FINANCIAL_HEALTH_INDICATORS.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {activeLayer === "turnout" && (
              <>
                <label className="text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="sr-only">表示する選挙</span>
                  <select
                    value={activeTurnoutElection?.id ?? ""}
                    onChange={(e) => setTurnoutElectionId(e.target.value)}
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    {/* 新しい選挙が上に来るよう降順で並べる（既定値は直近の選挙） */}
                    {[...(turnoutElections ?? [])].reverse().map((e) => (
                      <option key={e.id} value={e.id}>
                        {turnoutElectionLabel(e)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="sr-only">男女の区分</span>
                  <select
                    value={turnoutGender}
                    onChange={(e) =>
                      setTurnoutGender(e.target.value as TurnoutGenderKey)
                    }
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    {TURNOUT_GENDERS.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        )}
        {activeLayer === "finance" && (
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-500">
            都道府県普通会計の決算額（総務省「地方財政状況調査」）。人口規模の違いをそのまま反映するため、都市部ほど大きくなる傾向がある点に留意してください。
          </p>
        )}
        {activeLayer === "expenditure" && (
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-500">
            {expenditureFiscalYear ? `${expenditureFiscalYear}年度、` : ""}
            都道府県の目的別歳出決算額を人口一人当たりに換算した金額です（総務省「地方財政状況調査」・人口推計）。地理的条件（離島・過疎地等）や高齢化率の違いにより、人口規模だけでは説明できない差が生じる点に留意してください。
          </p>
        )}
        {activeLayer === "financialHealth" && (
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-500">
            {financialHealthFiscalYear ? `${financialHealthFiscalYear}年度、` : ""}
            総務省「主要財政指標一覧」に基づく実測値です。数値の高低を「良い/悪い」と単純に評価するものではありません。
            {activeIndicatorMeta.standardNote &&
              `法定の基準値: ${activeIndicatorMeta.standardNote}（地方公共団体の財政の健全化に関する法律）。`}
          </p>
        )}
        {activeLayer === "turnout" && activeTurnoutElection && (
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-500">
            総務省「{activeTurnoutElection.electionName}結果調」に基づく実測値です（
            {activeTurnoutElection.votingCategory}
            の投票率、{activeTurnoutElection.electionDate}執行）。
            投票率の高低は、有権者の年齢構成・地理的条件・同日実施の地方選挙の有無など様々な要因を反映しており、それ自体が有権者や地域の評価を意味するものではありません。本サイトでは順位付けを行わず、全国計との比較と推移の形で示しています。男女の区分は原資料（選挙人名簿上の性別）の区分をそのまま用いています。
          </p>
        )}
        <DataInsight facts={mapFacts} />
        <PrefectureMap
          counts={activeCounts}
          selected={selected}
          onSelectPrefecture={setSelected}
          metricLabel={metricLabel}
          formatValue={formatValue}
          {...(activeLayer === "turnout" || activeLayer === "financialHealth"
            ? { legendLowLabel: "低い", legendHighLabel: "高い" }
            : {})}
        />
        {activeLayer === "turnout" && turnoutTrend.length > 0 && (
          <PrefectureTurnoutTrendChart
            series={turnoutTrend}
            gender={turnoutGender}
            selectedPrefecture={selected}
            facts={buildTurnoutTrendFacts(turnoutTrend, turnoutGender, selected)}
          />
        )}
        {activeLayer === "turnout" && (turnoutCoverageFacts?.length ?? 0) > 0 && (
          <DataCoverageNote
            datasetId="prefecture-turnout"
            facts={turnoutCoverageFacts!}
            className="mt-3"
          />
        )}
      </div>

      <aside className="flex flex-col gap-4">
        {selected ? (
          <PrefecturePartyComposition
            prefecture={selected}
            partyCounts={partyCountsByPrefecture[selected] ?? {}}
            parties={parties}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
            地図上の都道府県をクリックする（または下のランキング表から選ぶ）と、
            その都道府県の政党別議席構成がここに表示されます。
          </div>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            都道府県別 {metricLabel}
            {isRankedList ? "ランキング" : "一覧"}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            {isRankedList ? "多い順" : "都道府県コード順"}・全{ranking.length}
            都道府県。地図と同じ情報をテキストで確認できます。
          </p>
          <ol className="mt-3 max-h-96 space-y-0.5 overflow-y-auto">
            {ranking.map(([name, count], i) => {
              const isSelected = name === selected;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setSelected(name)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300"
                        : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {/* 順位番号は「ランキング」表示のときだけ。投票率レイヤーは
                        順位付けをしないため番号を出さない */}
                    {isRankedList && (
                      <span className="w-5 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                        {i + 1}
                      </span>
                    )}
                    <span className="flex-1 truncate">{name}</span>
                    <span className="shrink-0 tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                      {formatValue(count)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {selected && (
            <Link
              href={`/map/${encodeURIComponent(selected)}`}
              className="mt-3 inline-flex items-center text-xs font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              選択中（{selected}）の詳細（市区町村マップ・議員一覧）を見る
              <span aria-hidden className="ml-1">
                →
              </span>
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
