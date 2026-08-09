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

const GEO_URL = "/data/prefectures-topo.json";
const WIDTH = 600;
const HEIGHT = 600;
const DEFAULT_CENTER: [number, number] = [137, 38];
const DEFAULT_SCALE = 1500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.5;

// dataviz skill: sequential(単一色相・低→高)の青ランプ100〜700から抜粋
const SEQUENTIAL_STEPS = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#256abf",
  "#184f95",
  "#0d366b",
];
const NO_DATA_COLOR = "#e5e5e5"; // neutral gray（該当データなし用）

function colorForCount(count: number | undefined, min: number, max: number) {
  if (count === undefined) return NO_DATA_COLOR;
  if (max === min) return SEQUENTIAL_STEPS[3];
  const t = (count - min) / (max - min);
  const idx = Math.min(
    SEQUENTIAL_STEPS.length - 1,
    Math.floor(t * SEQUENTIAL_STEPS.length)
  );
  return SEQUENTIAL_STEPS[idx];
}

type MapPosition = { coordinates: [number, number]; zoom: number };

const DEFAULT_POSITION: MapPosition = { coordinates: DEFAULT_CENTER, zoom: 1 };

export function PrefectureMap({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const router = useRouter();
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
                return (
                  <Geography
                    key={(geo as unknown as { rsmKey: string }).rsmKey}
                    geography={geo}
                    fill={colorForCount(count, min, max)}
                    stroke="#fcfcfb"
                    strokeWidth={0.5}
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
                    onClick={() =>
                      router.push(`/map/${encodeURIComponent(name)}`)
                    }
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
          <div className="text-neutral-600">関連議員 {hovered.count}名</div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-600">
        <span>少ない</span>
        {SEQUENTIAL_STEPS.map((c) => (
          <span
            key={c}
            className="inline-block h-3 w-6"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>多い</span>
        <span className="ml-2 text-neutral-400">
          （{min}〜{max}名。クリックでその都道府県の詳細へ／ホイールでズーム・ドラッグでパン）
        </span>
      </div>
    </div>
  );
}
