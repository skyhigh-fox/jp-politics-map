import type { BillStage } from "@/types";

/**
 * 【法案審議ステージ（BillStage）の配色】
 * `data/bill-status-history.json` の `stage` フィールド（手続き上の通過段階）を
 * 可視化する際に、法案一覧ページのファネル図・法案詳細ページのタイムラインの
 * 両方で共通して使う配色をここに集約する。
 *
 * 配色方針（新しく考案せず、既存コンポーネントの思想を踏襲）:
 * - `src/components/StatusBadge.tsx` ・ `src/components/BillSessionTrendChart.tsx`
 *   と同じ「良し悪し」ではなく「進行段階」を示す中立配色の考え方を使う。
 * - BillStage は BillStatus（審議中/可決/成立...）とは別軸の値（手続き上の
 *   通過段階）だが、意味の近い段階には近い色相を割り当てて直感的に対応させる。
 *   - 提出・委員会付託 = 「まだ可否が決していない・審議が進行中」
 *     → sky（青系、StatusBadgeの審議中と同系統）。オーディナル2段階
 *       （提出→委員会付託の順で少し濃くなる＝先へ進んだことを示す）。
 *   - 委員会可決・本会議可決・成立 = 「可決に向けて進んでいる」
 *     → emerald（緑系、StatusBadgeの可決/成立と同系統）。オーディナル3段階
 *       （成立に近づくほど緑が濃くなる）。「成立」の色は StatusBadge・
 *       BillSessionTrendChart の「成立」と同一の値を再利用し、両ページ間でも
 *       同じ言葉に同じ色が対応するようにしている。
 *   - 委員会否決・本会議否決・廃案 = 「可決に至らず終了」
 *     → neutral（グレー系、StatusBadgeの否決/廃案と同系統）。「悪い」印象の
 *       強い赤は使わない。オーディナル3段階（審議が進んだ段階での終了ほど
 *       濃いグレー。廃案はデータ上は本モジュール作成時点で
 *       bill-status-history.json に出現しないが、BillStage型に含まれるため
 *       将来の出現に備えて定義しておく）。
 *
 * 検証: dataviz スキルの `validate_palette.js` で各グループを
 * `--ordinal` モードで検証済み（light/dark各サーフェス、全グループPASS）。
 *   - sky 2段階（提出/委員会付託）: light `#0ea5e9,#0369a1` / dark `#38bdf8,#0284c7`
 *   - emerald 3段階（委員会可決/本会議可決/成立）:
 *     light `#10b981,#059669,#047857` / dark `#6ee7b7,#34d399,#059669`
 *   - neutral 3段階（委員会否決/本会議否決/廃案）:
 *     light `#a3a3a3,#525252,#262626` / dark `#d4d4d4,#a3a3a3,#737373`
 * 7色（+廃案）を1本の categorical パレットとして通しで検証すると、
 * neutral 系がChroma floor未達（意図的な無彩色）・emerald↔neutral間の
 * CVD分離が基準未達で FAIL する。これは BillSessionTrendChart.tsx の
 * コメントに記載済みの許容パターンと同じ状況（単一の8色カテゴリカル配列
 * ではなく、意味のあるグループ単位のオーディナル配色の組み合わせのため）。
 * ラベル併記の凡例・直接ツールチップ・データテーブルという secondary
 * encoding で識別を補っている。
 */
export const BILL_STAGE_COLORS: Record<
  BillStage,
  { light: string; dark: string; label: string }
> = {
  提出: { light: "#0ea5e9", dark: "#38bdf8", label: "提出" },
  委員会付託: { light: "#0369a1", dark: "#0284c7", label: "委員会付託" },
  委員会可決: { light: "#10b981", dark: "#6ee7b7", label: "委員会可決" },
  本会議可決: { light: "#059669", dark: "#34d399", label: "本会議可決" },
  成立: { light: "#047857", dark: "#059669", label: "成立" },
  委員会否決: { light: "#a3a3a3", dark: "#d4d4d4", label: "委員会否決" },
  本会議否決: { light: "#525252", dark: "#a3a3a3", label: "本会議否決" },
  廃案: { light: "#262626", dark: "#737373", label: "廃案" },
};

/** 自然な流れ順（表示・凡例の並び替えに使う正規順序）。
 * 提出→委員会付託→（委員会可決 or 委員会否決）→（本会議可決 or 本会議否決）→成立。
 * 廃案は手続き上どの段階の後にも起こりうる終着点のため末尾に置く。 */
export const BILL_STAGE_DISPLAY_ORDER: BillStage[] = [
  "提出",
  "委員会付託",
  "委員会可決",
  "委員会否決",
  "本会議可決",
  "本会議否決",
  "成立",
  "廃案",
];

/** CSS変数名の接頭辞なしのスラグ（`var(--stage-xxx)` 用） */
export const BILL_STAGE_SLUGS: Record<BillStage, string> = {
  提出: "submitted",
  委員会付託: "committee-referred",
  委員会可決: "committee-passed",
  委員会否決: "committee-rejected",
  本会議可決: "plenary-passed",
  本会議否決: "plenary-rejected",
  成立: "enacted",
  廃案: "lapsed",
};
