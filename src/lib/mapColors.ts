/**
 * 地図（PrefectureMap / MunicipalityMap 共通）の配色定義。
 *
 * react-simple-maps の `Geography` の `fill`/`stroke` は SVG 属性への直接指定で
 * あり、TailwindCSS の `dark:` クラスでは制御できない。そのため、色の値そのものを
 * ライト/ダークで別々に用意し、呼び出し側（各コンポーネント）が
 * `useColorScheme()`（src/hooks/useColorScheme.ts）で判定した現在のモードに応じて
 * 動的に選択する。
 *
 * dataviz skill の sequential 配色ルール（単一色相・light→dark の光度ランプ、
 * 100〜700番台）に従う:
 * - ライトモードは references/palette.md の sequential ランプをそのまま採用
 *   （低い値ほど白い紙面に近い薄い色＝目立たない、高い値ほど濃い色＝目立つ）。
 * - ダークモードは同じランプの中でも「ダーク面（surface）に対してコントラストが
 *   取れる範囲」だけを使う。palette.md の指針
 *   （"on dark, go no darker than step 600"）に従い、700番台
 *   （#0d366b。ダーク面 #171717 に対するコントラストが2:1未満）は使わず、
 *   600番台を「値が小さいほど背景に近く沈む」側の下限とする。逆に「値が
 *   大きいほど明るく浮き上がる」側は100番台（最も明るい薄青）を使う。
 *   つまりダークモードのランプは、同じ7色をライトモードとは逆方向
 *   （暗→明）に並べたものになる。
 *
 * light/dark 双方とも dataviz skill の `validate_palette.js --ordinal` で検証済み
 * （検証コマンド・結果はObsidian: jp-politics-map/決定事項ログ.md 参照）。
 *
 * 検証結果の要約:
 * - light（7段階、100〜700番台をそのまま採用）: 単調な明度・隣接ステップの
 *   ΔL(>=0.06)はPASS。「最も明るい100番=#cde2fb と白背景のコントラストが
 *   2:1未満」はFAILと出るが、これは意図的なもの。references/color-formula.md
 *   の通り、この検証コマンドの2:1下限は「ordinal（離散的な順序尺度）」向けの
 *   基準であり、この地図の用途は連続量を表す「sequential」（低いほど紙面に
 *   近い色へ沈み込ませてよい）にあたるため、この基準は当てはまらない
 *   （既存実装から変更していない配色でもある）。
 * - dark（6段階、100〜600番台）: 全項目PASS。700番台（#0d366b）は
 *   ダーク面(#171717)に対して1.50:1しか取れず「沈む」ため除外し、
 *   600番台（2.21:1）を沈み込みの下限とした。7段階そのままを反転させると
 *   明るい側（100〜200番台）の隣接ΔLが0.06を切りFAILするため、
 *   ダークは6段階とした（100番刻みで均等に明度が変化し、隣接ΔLは
 *   すべて0.09以上）。
 */

export type ColorSchemeMode = "light" | "dark";

/** 地図が実際に描画されるカード面の色（validate_palette.js の --surface と一致させる） */
export const MAP_SURFACE: Record<ColorSchemeMode, string> = {
  light: "#ffffff",
  dark: "#171717",
};

/** sequential ランプ（値が小さい→大きい の順） */
export const MAP_SEQUENTIAL_STEPS: Record<ColorSchemeMode, readonly string[]> = {
  light: [
    "#cde2fb", // 100
    "#9ec5f4", // 200
    "#6da7ec", // 300
    "#3987e5", // 400
    "#256abf", // 500
    "#184f95", // 600
    "#0d366b", // 700
  ],
  dark: [
    "#184f95", // 600（背景に沈まないための下限。700番台は使わない）
    "#256abf", // 500
    "#3987e5", // 400
    "#6da7ec", // 300
    "#9ec5f4", // 200
    "#cde2fb", // 100（最も明るく、値が大きいほど暗い背景から浮き上がる）
  ],
};

/** 該当データなし（NO_DATA）用のニュートラルグレー */
export const MAP_NO_DATA_COLOR: Record<ColorSchemeMode, string> = {
  light: "#e5e5e5",
  dark: "#52525b",
};

/** 都道府県・市区町村境界線の色（面同士の「2pxのすき間」代わり。面の色と地続きになるよう、地図が乗る面(surface)の色に合わせる） */
export const MAP_STROKE_COLOR: Record<ColorSchemeMode, string> = {
  light: "#fcfcfb",
  dark: "#171717",
};

/**
 * 件数(count)から塗り色を決定する。
 * @param count 対象の件数。undefinedは「データなし」を表す
 * @param min 表示中の全域における最小値
 * @param max 表示中の全域における最大値
 * @param mode 現在の配色モード（ライト/ダーク）
 */
export function colorForCount(
  count: number | undefined,
  min: number,
  max: number,
  mode: ColorSchemeMode
): string {
  const steps = MAP_SEQUENTIAL_STEPS[mode];
  if (count === undefined) return MAP_NO_DATA_COLOR[mode];
  if (max === min) return steps[Math.floor(steps.length / 2)] as string;
  const t = (count - min) / (max - min);
  const idx = Math.min(steps.length - 1, Math.floor(t * steps.length));
  return steps[idx] as string;
}
