"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  type GeographyProps,
} from "react-simple-maps";

const GEO_URL = "/data/prefectures-topo.json";

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

  const values = Object.values(counts);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div className="relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [137, 38], scale: 1500 }}
        width={600}
        height={600}
        className="w-full h-auto"
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: GeographyProps["geography"][] }) =>
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
                      prev ? { ...prev, x: evt.clientX, y: evt.clientY } : prev
                    );
                  }}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() =>
                    router.push(
                      `/legislators?prefecture=${encodeURIComponent(name)}`
                    )
                  }
                  style={{
                    default: { outline: "none", cursor: "pointer" },
                    hover: { outline: "none", opacity: 0.8, cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {hovered && (
        <div
          className="pointer-events-none fixed z-10 rounded border border-neutral-300 bg-white px-2 py-1 text-xs shadow"
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
          （{min}〜{max}名。クリックでその都道府県の関連議員一覧へ）
        </span>
      </div>
    </div>
  );
}
