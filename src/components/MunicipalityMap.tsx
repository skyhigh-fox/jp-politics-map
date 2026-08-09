"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  type GeographyProps,
} from "react-simple-maps";
import { geoMercator, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";

const WIDTH = 600;
const HEIGHT = 600;
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
 *
 * ズーム/パン（ZoomableGroup）を導入した後も、渡しているのは
 * 引き続き文字列("geoMercator")＋数値のprojectionConfigのみであり、
 * ZoomableGroup自体もReact-simple-maps標準のズーム実装（内部でd3-zoomの
 * transformを適用するだけ）なので、projectionインスタンスを直接扱う
 * ことはなく、上記のエラーは再発しないことを確認済み。
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

type MapPosition = { coordinates: [number, number]; zoom: number };

export function MunicipalityMap({
  geoUrl,
  /** 市区町村名 → 件数。未指定の場合は色分けせず全て中立色で表示する */
  counts,
  /**
   * クリック時の遷移先のベースパス（例:"/local/東京都"）。
   * 指定時は `${linkBase}/${encodeURIComponent(市区町村名)}` へ遷移する。
   * 未指定ならクリック無効。
   * （Server ComponentからClient Componentには関数を渡せないため、
   *   関数ではなく文字列で受け取ってこちら側でURLを組み立てる）
   */
  linkBase,
}: {
  geoUrl: string;
  counts?: Record<string, number>;
  linkBase?: string;
}) {
  const router = useRouter();
  const { config, error } = useFittedProjectionConfig(geoUrl);
  const [hovered, setHovered] = useState<{
    name: string;
    count?: number;
    x: number;
    y: number;
  } | null>(null);
  const [position, setPosition] = useState<MapPosition | null>(null);

  // 都道府県（geoUrl）が切り替わったら、前の都道府県のズーム/パン状態を
  // 引きずらないよう、新しく計算されたfit configでリセットする
  useEffect(() => {
    if (config) {
      setPosition({ coordinates: config.center, zoom: 1 });
    }
  }, [geoUrl, config]);

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
  if (!config || !position) {
    return <p className="text-sm text-neutral-400">地図を読み込み中…</p>;
  }

  function handleMoveEnd(pos: MapPosition) {
    setPosition(pos);
  }

  function zoomBy(factor: number) {
    setPosition((prev) =>
      prev
        ? {
            ...prev,
            zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor)),
          }
        : prev
    );
  }

  function resetView() {
    if (config) setPosition({ coordinates: config.center, zoom: 1 });
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
          <Geographies geography={geoUrl}>
            {({
              geographies,
            }: {
              geographies: GeographyProps["geography"][];
            }) =>
              geographies.map((geo) => {
                const props = (
                  geo as unknown as { properties: { N03_004?: string } }
                ).properties;
                const name = props.N03_004 ?? "";
                const count = counts ? counts[name] : undefined;
                const href =
                  linkBase && name
                    ? `${linkBase}/${encodeURIComponent(name)}`
                    : null;
                return (
                  <Geography
                    key={(geo as unknown as { rsmKey: string }).rsmKey}
                    geography={geo}
                    fill={
                      counts ? colorForCount(count, min, max) : NO_DATA_COLOR
                    }
                    stroke="#fcfcfb"
                    strokeWidth={0.5}
                    onMouseEnter={(evt: React.MouseEvent) => {
                      setHovered({
                        name,
                        count,
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
          {hovered.count !== undefined && (
            <div className="text-neutral-600">{hovered.count}名</div>
          )}
        </div>
      )}
    </div>
  );
}
