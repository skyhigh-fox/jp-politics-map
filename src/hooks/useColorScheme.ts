"use client";

import { useEffect, useState } from "react";

/**
 * `window.matchMedia("(prefers-color-scheme: dark)")` を購読し、現在の配色モード
 * （"light" | "dark"）を返すフック。
 *
 * react-simple-maps の `Geography` の `fill`/`stroke` は SVG 属性への直接指定であり、
 * TailwindCSSの`dark:`クラスでは制御できない（tailwind.config.tsの
 * darkMode: "media" もCSSのメディアクエリ止まりで、JS側の値には反映されない）。
 * そのため地図の塗り色はこのフックで判定したモードに応じて
 * `src/lib/mapColors.ts` のライト/ダーク配色配列を動的に切り替える。
 *
 * SSR時（windowが存在しない）は必ず"light"を返し、マウント後の
 * useEffectで実際のOS設定に同期する（サーバー側でOS設定を知る術がなく、
 * hydration mismatchを避けるため）。OS側の設定変更にも追従する。
 */
export function useColorScheme(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setMode(mql.matches ? "dark" : "light");

    const handleChange = (event: MediaQueryListEvent) => {
      setMode(event.matches ? "dark" : "light");
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return mode;
}
