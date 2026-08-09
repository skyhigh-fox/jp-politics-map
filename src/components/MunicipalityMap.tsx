"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  type GeographyProps,
} from "react-simple-maps";
import { geoMercator, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";

const WIDTH = 600;
const HEIGHT = 600;

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
const NO_DATA_COLOR = "#e5e5e5";

function colorForCount(
  count: number | undefined,
  min: number,
  max: number
): string {
  if (count === undefined) return NO_DATA_COLOR;
  if (max === min) return SEQUENTIAL_STEPS[3] as string;
  const t = (count - min) / (max - min);
  const idx = Math.min(
    SEQUENTIAL_STEPS.length - 1,
    Math.floor(t * SEQUENTIAL_STEPS.length)
  );
  return SEQUENTIAL_STEPS[idx] as string;
}

/**
 * 都道府県ごとに手動でcenter/scaleを用意する代わりに、TopoJSONを一度
 * フェッチしてd3-geoで「重心座標」と「収まりの良い拡大率」を計算する。
 *
 * react-simple-maps に自前で構築したd3-geoのprojectionインスタンスを
 * そのまま渡すと、内部で使われているd3-geoの実体と噛み合わず
 * "projectionStream is not a function" になることがある（実機で確認済み）。
 * そのため、計算はここだけで完結させ、react-simple-mapsには
 * projection="geoMercator" ＋ 数値だけのprojectionConfigとして渡す
 * （PrefectureMapと同じ、動作実績のある渡し方）。
 */
function useFittedProjectionConfig(geoUrl: string) {
  const [config, setConfig] = useState<{
    center: [number, number];
    scale: number;
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setError(false);
    fetch(geoUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        return res.json();
      })
      .then((topology: Topology) => {
        if (cancelled) return;
        const objectKey = Object.keys(topology.objects)[0];
        if (!objectKey) throw new Error("no objects in topology");
        const collection = topology.objects[objectKey] as GeometryCollection;
        const fc = feature(
          topology,
          collection
        ) as unknown as FeatureCollection<Geometry>;

        // 東京都の伊豆・小笠原諸島のような遠方の離島が全体の重心・拡大率を
        // 引っ張ってしまい、本土側が豆粒になることがある。各地物の重心の
        // 中央値付近（±2度）だけを使ってフィッティングすることで回避する
        const centroids = fc.features.map((f) => geoCentroid(f));
        const median = (nums: number[]) =>
          [...nums].sort((a, b) => a - b)[Math.floor(nums.length / 2)] ?? 0;
        const medianLon = median(centroids.map((c) => c[0]));
        const medianLat = median(centroids.map((c) => c[1]));
        const CORE_RADIUS_DEG = 2;
        const coreFeatures = fc.features.filter((_, i) => {
          const c = centroids[i];
          if (!c) return false;
          return (
            Math.abs(c[0] - medianLon) < CORE_RADIUS_DEG &&
            Math.abs(c[1] - medianLat) < CORE_RADIUS_DEG
          );
        });
        const coreFc: FeatureCollection<Geometry> = {
          type: "FeatureCollection",
          features: coreFeatures.length > 0 ? coreFeatures : fc.features,
        };

        const fitted = geoMercator().fitSize([WIDTH, HEIGHT], coreFc);
        setConfig({
          center: geoCentroid(coreFc),
          scale: fitted.scale(),
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [geoUrl]);

  return { config, error };
}

export function MunicipalityMap({
  geoUrl,
  /** 市区町村名 → 件数。未指定の場合は色分けせず全て中立色で表示する */
  counts,
  /** クリック時の遷移先を返す。未指定 or nullを返した場合はクリック無効 */
  hrefFor,
}: {
  geoUrl: string;
  counts?: Record<string, number>;
  hrefFor?: (municipalityName: string) => string | null;
}) {
  const router = useRouter();
  const { config, error } = useFittedProjectionConfig(geoUrl);
  const [hovered, setHovered] = useState<{
    name: string;
    count?: number;
    x: number;
    y: number;
  } | null>(null);

  const values = counts ? Object.values(counts) : [];
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  if (error) {
    return (
      <p className="text-sm text-neutral-600">
        地図データの読み込みに失敗しました。
      </p>
    );
  }
  if (!config) {
    return <p className="text-sm text-neutral-400">地図を読み込み中…</p>;
  }

  return (
    <div className="relative">
      <ComposableMap
        width={WIDTH}
        height={HEIGHT}
        projection="geoMercator"
        projectionConfig={{ center: config.center, scale: config.scale }}
        className="w-full h-auto"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: GeographyProps["geography"][] }) =>
            geographies.map((geo) => {
              const props = (
                geo as unknown as { properties: { N03_004?: string } }
              ).properties;
              const name = props.N03_004 ?? "";
              const count = counts ? counts[name] : undefined;
              const href = hrefFor ? hrefFor(name) : null;
              return (
                <Geography
                  key={(geo as unknown as { rsmKey: string }).rsmKey}
                  geography={geo}
                  fill={counts ? colorForCount(count, min, max) : NO_DATA_COLOR}
                  stroke="#fcfcfb"
                  strokeWidth={0.5}
                  onMouseEnter={(evt: React.MouseEvent) => {
                    setHovered({ name, count, x: evt.clientX, y: evt.clientY });
                  }}
                  onMouseMove={(evt: React.MouseEvent) => {
                    setHovered((prev) =>
                      prev ? { ...prev, x: evt.clientX, y: evt.clientY } : prev
                    );
                  }}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (href) router.push(href);
                  }}
                  style={{
                    default: { outline: "none" },
                    hover: {
                      outline: "none",
                      opacity: href ? 0.8 : 1,
                      cursor: href ? "pointer" : "default",
                    },
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
          {hovered.count !== undefined && (
            <div className="text-neutral-600">{hovered.count}名</div>
          )}
        </div>
      )}
    </div>
  );
}
