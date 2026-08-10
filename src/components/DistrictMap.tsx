"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  type GeographyProps,
} from "react-simple-maps";
import { useColorScheme } from "@/hooks/useColorScheme";
import { MAP_STROKE_COLOR } from "@/lib/mapColors";

/**
 * 選挙区マップ（衆議院289小選挙区 / 参議院45選挙区の共通コンポーネント）。
 *
 * 【実装上の注意（このリポジトリで踏んだ罠）】
 * react-simple-maps に自前で構築したd3-geoのprojectionインスタンスを渡すと
 * "projectionStream is not a function" になる。PrefectureMap.tsx と同じく、
 * projection は文字列（"geoMercator"）、projectionConfig は数値のみで渡す。
 *
 * 【投影の中心・拡大率について】
 * PrefectureMap は center [137,38] / scale 1500 / 600×600 だが、この設定だと
 * 沖縄県が下端から外れる。選挙区マップは289区すべてを一覧できることが目的なので、
 * 沖縄本島（沖縄1〜4区）まで入る center [136.5,36] / scale 1400 / 600×700 に
 * している（先島諸島はさらに西にあるためドラッグで移動して見る）。
 *
 * 【中立性】
 * 塗り色は呼び出し側の fillFor に委ねる。既定はニュートラル1色で、
 * 政党別の塗り分けは利用者が明示的にオンにしたときだけ渡される。
 */

const WIDTH = 600;
const HEIGHT = 700;
const DEFAULT_CENTER: [number, number] = [136.5, 36];
const DEFAULT_SCALE = 1400;
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;
const ZOOM_STEP = 1.6;

const SELECTED_STROKE = "#4f46e5"; // accent-600

type MapPosition = { coordinates: [number, number]; zoom: number };

const DEFAULT_POSITION: MapPosition = { coordinates: DEFAULT_CENTER, zoom: 1 };

export interface DistrictMapTooltip {
  title: string;
  lines: string[];
}

export function DistrictMap({
  geoUrl,
  nameProperty,
  toDistrictKey,
  selected,
  onSelect,
  fillFor,
  tooltipFor,
}: {
  /** 境界データ（TopoJSON）のURL */
  geoUrl: string;
  /** 地物のプロパティのうち、選挙区名（または都道府県名）が入っているキー */
  nameProperty: string;
  /** 地物名 → 選挙区キー。対応する選挙区が無ければ null */
  toDistrictKey: (featureName: string) => string | null;
  selected: string | null;
  onSelect: (districtKey: string) => void;
  /** 選挙区キー → 塗り色 */
  fillFor: (districtKey: string) => string;
  /** 選挙区キー → ツールチップの中身 */
  tooltipFor: (districtKey: string) => DistrictMapTooltip;
}) {
  const mode = useColorScheme();
  const [hovered, setHovered] = useState<{
    tooltip: DistrictMapTooltip;
    x: number;
    y: number;
  } | null>(null);
  const [position, setPosition] = useState<MapPosition>(DEFAULT_POSITION);

  const stroke = MAP_STROKE_COLOR[mode];

  function zoomBy(factor: number) {
    setPosition((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor)),
    }));
  }

  return (
    <div className="relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: DEFAULT_CENTER, scale: DEFAULT_SCALE }}
        width={WIDTH}
        height={HEIGHT}
        className="h-auto w-full"
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
          onMoveEnd={(pos: MapPosition) => setPosition(pos)}
        >
          <Geographies geography={geoUrl}>
            {({
              geographies,
            }: {
              geographies: GeographyProps["geography"][];
            }) =>
              geographies.map((geo) => {
                const properties = (
                  geo as unknown as { properties: Record<string, string> }
                ).properties;
                const featureName = properties[nameProperty] ?? "";
                const key = toDistrictKey(featureName);
                const isSelected = key !== null && key === selected;
                return (
                  <Geography
                    key={(geo as unknown as { rsmKey: string }).rsmKey}
                    geography={geo}
                    fill={key ? fillFor(key) : stroke}
                    stroke={isSelected ? SELECTED_STROKE : stroke}
                    strokeWidth={isSelected ? 1.4 : 0.35}
                    tabIndex={-1}
                    onMouseEnter={(evt: React.MouseEvent) => {
                      if (!key) return;
                      setHovered({
                        tooltip: tooltipFor(key),
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
                    onClick={() => {
                      if (key) onSelect(key);
                    }}
                    style={{
                      default: { outline: "none", cursor: "pointer" },
                      hover: { outline: "none", opacity: 0.75, cursor: "pointer" },
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
          onClick={() => setPosition(DEFAULT_POSITION)}
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
          <div className="font-semibold">{hovered.tooltip.title}</div>
          {hovered.tooltip.lines.map((line) => (
            <div key={line} className="text-neutral-600 dark:text-neutral-400">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
