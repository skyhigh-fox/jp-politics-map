/**
 * 政党公式カラーを示す小さな色ドット。
 *
 * 中立性・アクセシビリティ配慮（CLAUDE.md参照）:
 *   - 色は識別の補助であり、単独の識別子にしないこと。このコンポーネントは
 *     常に政党名・略称のテキストと併記して使う前提で、ドット単体では
 *     情報を伝えない（aria-hiddenで読み上げからも除外する）。
 *   - 政党カラー未設定（新政党追加時など）の場合はグレーのフォールバック表示にし、
 *     UIが壊れないようにする。
 *   - 黄色(#FABE00)など薄い色は背景に埋もれやすいため、常に薄いring（枠線）を
 *     付けて視認性を担保する（ライト/ダーク両テーマ）。
 */
const FALLBACK_COLOR = "#9E9E9E";

export function PartyColorDot({
  color,
  className = "",
}: {
  color?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20 ${className}`}
      style={{ backgroundColor: color || FALLBACK_COLOR }}
    />
  );
}
