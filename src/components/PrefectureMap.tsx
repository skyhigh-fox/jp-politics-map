"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  type GeographyProps,
} from "react-simple-maps";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  colorForCount,
  MAP_SEQUENTIAL_STEPS,
  MAP_STROKE_COLOR,
} from "@/lib/mapColors";

const GEO_URL = "/data/prefectures-topo.json";
const WIDTH = 600;
const HEIGHT = 600;
const DEFAULT_CENTER: [number, number] = [137, 38];
const DEFAULT_SCALE = 1500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.5;

const SELECTED_STROKE = "#4f46e5"; // accent-600（選択中の都道府県の枠線）

type MapPosition = { coordinates: [number, number]; zoom: number };

const DEFAULT_POSITION: MapPosition = { coordinates: DEFAULT_CENTER, zoom: 1 };

export function PrefectureMap({
  counts,
  selected = null,
  onSelectPrefecture,
  metricLabel = "関連議員",
  formatValue = (v: number) => `${v}名`,
}: {
  counts: Record<string, number>;
  /** 現在選択中の都道府県名（サイドバー連動でハイライト表示する） */
  selected?: string | null;
  /**
   * 都道府県クリック時のコールバック。指定時はこちらを呼ぶだけで、
   * 議員一覧ページへの遷移は行わない（クリック→サイドバーに政党別内訳表示
   * →サイドバー内のリンクから議員一覧へ、という2段階導線にするため）。
   * 未指定の場合は従来通り議員一覧ページへ直接遷移する（後方互換用）。
   */
  onSelectPrefecture?: (name: string) => void;
  /** ツールチップ・凡例に表示する指標名（レイヤー切替対応、既定は議員数） */
  metricLabel?: string;
  /** 数値の表示形式（既定は「◯名」。財政データ等、単位が異なるレイヤー用） */
  formatValue?: (value: number) => string;
}) {
  const router = useRouter();
  const mode = useColorScheme();
  const [hovered, setHovered] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const [position, setPosition] = useState<MapPosition>(DEFAULT_POSITION);

  const values = Object.values(counts);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sequentialSteps = MAP_SEQUENTIAL_STEPS[mode];
  const stroke = MAP_STROKE_COLOR[mode];

  function handleMoveEnd(pos: MapPosition) {
    setPosition(pos);
  }

  function zoomBy(factor: number) {
    setPosition((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor)),
    }));
  }

  function resetView() {
    setPosition(DEFAULT_POSITION);
  }

  function handleSelect(name: string) {
    if (onSelectPrefecture) {
      onSelectPrefecture(name);
    } else {
      router.push(`/map/${encodeURIComponent(name)}`);
    }
  }

  return (
    <div className="relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: DEFAULT_CENTER, scale: DEFAULT_SCALE }}
        width={WIDTH}
        height={HEIGHT}
        className="w-full h-auto"
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          translateExtent={[
            [-WIDTH, -HEIGHT],
            [WIDTH * 2, HEIGHT * 2],
          ]}
          onMoveEnd={handleMoveEnd}
        >
          <Geographies geography={GEO_URL}>
            {({
              geographies,
            }: {
              geographies: GeographyProps["geography"][];
            }) =>
              geographies.map((geo) => {
                const name = (
                  geo as unknown as { properties: { N03_001: string } }
                ).properties.N03_001;
                const count = counts[name];
                const isSelected = name === selected;
                return (
                  <Geography
                    key={(geo as unknown as { rsmKey: string }).rsmKey}
                    geography={geo}
                    fill={colorForCount(count, min, max, mode)}
                    stroke={isSelected ? SELECTED_STROKE : stroke}
                    strokeWidth={isSelected ? 2 : 0.5}
                    onMouseEnter={(evt: React.MouseEvent) => {
                      setHovered({
                        name,
                        count: count ?? 0,
                        x: evt.clientX,
                        y: evt.clientY,
                      });
                    }}
                    onMouseMove={(evt: React.MouseEvent) => {
                      setHovered((prev) =>
                        prev
                          ? { ...prev, x: evt.clientX, y: evt.clientY }
                          : prev
                      );
                    }}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleSelect(name)}
                    style={{
                      default: { outline: "none", cursor: "pointer" },
                      hover: {
                        outline: "none",
                        opacity: 0.8,
                        cursor: "pointer",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          aria-label="ズームイン"
          title="ズームイン"
          className="flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 shadow hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          ＋
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          aria-label="ズームアウト"
          title="ズームアウト"
          className="flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 shadow hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          －
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="表示をリセット"
          title="表示をリセット"
          className="flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 shadow hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          ⟲
        </button>
      </div>

      {hovered && (
        <div
          className="pointer-events-none fixed z-10 rounded border border-neutral-300 bg-white px-2 py-1 text-xs shadow dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          style={{ left: hovered.x + 12, top: hovered.y + 12 }}
        >
          <div className="font-semibold">{hovered.name}</div>
          <div className="text-neutral-600 dark:text-neutral-400">
            {metricLabel} {formatValue(hovered.count)}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <span>少ない</span>
        {sequentialSteps.map((c) => (
          <span
            key={c}
            className="inline-block h-3 w-6"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>多い</span>
        <span className="ml-2 text-neutral-400 dark:text-neutral-500">
          （{formatValue(min)}〜{formatValue(max)}。クリックでその都道府県の政党別内訳を表示／ホイールでズーム・ドラッグでパン）
        </span>
      </div>
    </div>
  );
}
