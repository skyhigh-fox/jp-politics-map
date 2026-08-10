"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DistrictMap } from "@/components/DistrictMap";
import { PartyColorDot } from "@/components/PartyColorDot";
import { useColorScheme } from "@/hooks/useColorScheme";
import { MAP_NO_DATA_COLOR } from "@/lib/mapColors";
import {
  PREFECTURE_GEO_URL,
  SHUGIIN_DISTRICT_GEO_URL,
  districtKeyFromKuname,
  sangiinDistrictOfPrefecture,
} from "@/lib/districts";
import { matchesNameQuery } from "@/lib/nameMatch";
import type { Chamber } from "@/types";

/**
 * 選挙区マップ（衆議院289小選挙区・参議院45選挙区）の画面本体。
 *
 * 【中立性の方針】
 * - 既定の塗りはニュートラル1色で、当選者の政党や得票率では塗り分けない。
 *   政党別の塗り分けは「政党で塗り分ける」を利用者が明示的にオンにしたときだけ。
 * - 「1票の格差」を演出するような面積の変形（カルトグラム）は行わない。
 * - 選挙区の並び順は選挙区コード順（都道府県コード＋区番号）で固定し、
 *   議員数や政党によるランキング的な並べ替えはしない。
 *
 * 【アクセシビリティ】
 * 小選挙区は都市部ほど地図上で小さく、クリックでの選択が難しい。
 * 都道府県詳細ページの「市区町村一覧」と同じく、地図と同じ情報を
 * テキストの一覧からも選べるようにしている（キーボード・スクリーンリーダー対応）。
 */

export interface DistrictMemberView {
  id: string;
  name: string;
  nameKana?: string;
  partyName: string;
  partyColor?: string;
}

export interface DistrictSeat {
  /** 選挙区キー（議員データの district と同じ表記。例:"岡山1" "鳥取・島根"） */
  key: string;
  /** 画面表示用の選挙区名（例:"岡山1区" "鳥取県・島根県選挙区"） */
  label: string;
  /** 属する都道府県の正式名称（合区は2件） */
  prefectures: string[];
  members: DistrictMemberView[];
}

const CHAMBERS: { value: Chamber; label: string; note: string }[] = [
  {
    value: "衆議院",
    label: "衆議院 小選挙区",
    note: "289区。1区につき1名を選出します（比例代表選出の議員はこの地図には現れません）。",
  },
  {
    value: "参議院",
    label: "参議院 選挙区",
    note: "45区。都道府県単位ですが、鳥取県と島根県・徳島県と高知県はそれぞれ2県で1区の「合区」です。3年ごとに半数を改選するため、1区から複数名が在職します。",
  },
];

export function DistrictExplorer({
  shugiin,
  sangiin,
}: {
  shugiin: DistrictSeat[];
  sangiin: DistrictSeat[];
}) {
  const mode = useColorScheme();
  const [chamber, setChamber] = useState<Chamber>("衆議院");
  const [selected, setSelected] = useState<string | null>(null);
  const [colorByParty, setColorByParty] = useState(false);
  const [query, setQuery] = useState("");

  const seats = chamber === "衆議院" ? shugiin : sangiin;
  const seatByKey = useMemo(
    () => new Map(seats.map((s) => [s.key, s])),
    [seats]
  );
  const chamberMeta = CHAMBERS.find((c) => c.value === chamber)!;
  // 参議院選挙区は1区から複数名が在職するため、単一の政党色に還元できない。
  // 政党別の塗り分けは1区1名の衆議院小選挙区でだけ提供する。
  const canColorByParty = chamber === "衆議院";
  const partyFillEnabled = canColorByParty && colorByParty;

  const neutralFill = MAP_NO_DATA_COLOR[mode];

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return seats;
    return seats.filter(
      (s) =>
        s.label.includes(q) ||
        s.key.includes(q) ||
        s.prefectures.some((p) => p.includes(q)) ||
        s.members.some((m) => matchesNameQuery(q, m)) ||
        s.members.some((m) => m.partyName.includes(q))
    );
  }, [seats, query]);

  const selectedSeat = selected ? seatByKey.get(selected) : undefined;

  /**
   * 政党別に塗り分けているときの凡例。色だけを識別子にしないための必須要素
   * （PartyColorDot のコメント参照）。並び順は区数の多い順という事実に基づく
   * 並びで、評価を含む順位付けではない。
   */
  const partyLegend = useMemo(() => {
    if (!partyFillEnabled) return [];
    const counts = new Map<string, { name: string; color?: string; count: number }>();
    for (const seat of seats) {
      const m = seat.members[0];
      if (!m) continue;
      const entry = counts.get(m.partyName) ?? {
        name: m.partyName,
        color: m.partyColor,
        count: 0,
      };
      entry.count += 1;
      counts.set(m.partyName, entry);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [partyFillEnabled, seats]);

  /**
   * 一覧の見出し。衆議院は1県に複数区あるため都道府県ごとにまとめる。
   * 参議院は1区＝1都道府県（合区を除く）で見出しと項目が同じ文字列になるため、
   * 見出しを付けずフラットに並べる。
   */
  const groups = useMemo(() => {
    if (chamber !== "衆議院") return [[null, filtered] as const];
    const map = new Map<string, DistrictSeat[]>();
    for (const seat of filtered) {
      const label = seat.prefectures.join("・") || "その他";
      const list = map.get(label) ?? [];
      list.push(seat);
      map.set(label, list);
    }
    return [...map.entries()].map(([k, v]) => [k, v] as const);
  }, [chamber, filtered]);

  function handleSelectChamber(next: Chamber) {
    setChamber(next);
    setSelected(null);
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="表示する選挙区の種類"
            className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-xs dark:border-neutral-800 dark:bg-neutral-900"
          >
            {CHAMBERS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleSelectChamber(c.value)}
                aria-pressed={chamber === c.value}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  chamber === c.value
                    ? "bg-accent-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {canColorByParty && (
            <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={colorByParty}
                onChange={(e) => setColorByParty(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-300 text-accent-600 focus:ring-accent-500 dark:border-neutral-600 dark:bg-neutral-800"
              />
              現職議員の政党で塗り分ける
            </label>
          )}
        </div>

        <p className="mb-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
          {chamberMeta.note}
          {partyFillEnabled
            ? "政党の識別色は各党の公式カラーをそのまま使っています。得票率による塗り分けは行いません。"
            : "既定では選挙区を色で区別せず、すべて同じ色で表示しています。"}
        </p>

        <DistrictMap
          geoUrl={
            chamber === "衆議院" ? SHUGIIN_DISTRICT_GEO_URL : PREFECTURE_GEO_URL
          }
          nameProperty={chamber === "衆議院" ? "kuname" : "N03_001"}
          toDistrictKey={(featureName) => {
            const key =
              chamber === "衆議院"
                ? districtKeyFromKuname(featureName)
                : sangiinDistrictOfPrefecture(featureName);
            return key && seatByKey.has(key) ? key : null;
          }}
          selected={selected}
          onSelect={setSelected}
          fillFor={(key) => {
            if (!partyFillEnabled) return neutralFill;
            return seatByKey.get(key)?.members[0]?.partyColor ?? neutralFill;
          }}
          tooltipFor={(key) => {
            const seat = seatByKey.get(key);
            return {
              title: seat?.label ?? key,
              lines: seat?.members.length
                ? seat.members.map((m) => `${m.name}（${m.partyName}）`)
                : ["現職議員のデータがありません"],
            };
          }}
        />

        {partyLegend.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
            {partyLegend.map((p) => (
              <li key={p.name} className="flex items-center gap-1.5">
                <PartyColorDot color={p.color} />
                <span>{p.name}</span>
                <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                  {p.count}区
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
          選挙区をクリックすると、右側にその選挙区選出の議員が表示されます（ホイールでズーム・ドラッグでパン）。地図上では都市部の選挙区が小さく選びづらいため、右側の一覧からも選べます。
        </p>
      </div>

      <aside className="flex flex-col gap-4">
        {selectedSeat ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {selectedSeat.label}
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              {selectedSeat.prefectures.join("・")}
            </p>
            {selectedSeat.members.length === 0 ? (
              <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
                この選挙区について、現職議員のデータを収録していません。
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {selectedSeat.members.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/legislators/${encodeURIComponent(m.id)}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-accent-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-accent-400"
                    >
                      <PartyColorDot color={m.partyColor} />
                      <span className="font-medium">{m.name}</span>
                      <span className="truncate text-neutral-500 dark:text-neutral-500">
                        {m.partyName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {selectedSeat.prefectures.map((p) => (
                <Link
                  key={p}
                  href={`/map/${encodeURIComponent(p)}`}
                  className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                >
                  {p}の詳細を見る
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
            地図上の選挙区をクリックする（または下の一覧から選ぶ）と、その選挙区選出の議員がここに表示されます。
          </div>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            選挙区一覧（全{seats.length}区）
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            選挙区コード順。地図と同じ情報をテキストで選べます。
          </p>
          <label className="mt-3 block">
            <span className="sr-only">選挙区名・議員名で絞り込む</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="選挙区名・議員名・政党名で絞り込む"
              className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 transition-colors placeholder:text-neutral-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            />
          </label>
          {filtered.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
              該当する選挙区はありません。
            </p>
          ) : (
            <div className="mt-3 max-h-[28rem] overflow-y-auto">
              {groups.map(([prefectureLabel, list]) => (
                <div key={prefectureLabel ?? "all"} className="mb-2">
                  {prefectureLabel && (
                    <h4 className="sticky top-0 bg-white py-1 text-[11px] font-semibold text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500">
                      {prefectureLabel}
                    </h4>
                  )}
                  <ul className="space-y-0.5">
                    {list.map((seat) => {
                      const isSelected = seat.key === selected;
                      return (
                        <li key={seat.key}>
                          <button
                            type="button"
                            onClick={() => setSelected(seat.key)}
                            aria-pressed={isSelected}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                              isSelected
                                ? "bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300"
                                : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                            }`}
                          >
                            <span className="w-24 shrink-0 font-medium">
                              {seat.label}
                            </span>
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                              {seat.members[0] && (
                                <PartyColorDot color={seat.members[0].partyColor} />
                              )}
                              <span className="truncate">
                                {seat.members.length === 0
                                  ? "—"
                                  : seat.members.length === 1
                                    ? seat.members[0]!.name
                                    : `${seat.members[0]!.name} ほか${seat.members.length - 1}名`}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
