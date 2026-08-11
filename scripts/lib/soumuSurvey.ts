/**
 * 総務省「地方公共団体の議会の議員及び長の所属党派別人員調等」の年次調査ページを
 * 辿るための共通ヘルパー。
 *
 * 一覧ページ: https://www.soumu.go.jp/senkyo/senkyo_s/data/syozoku/ichiran.html
 *   ├ 年次ページ（例: /senkyo/senkyo_s/data/syozoku/r06_00001.html）
 *   │   ├ 地方公共団体の議会の議員及び長の所属党派別人員調（.xlsx）
 *   │   └ 地方公共団体の長の連続就任回数（.xlsx）
 *
 * 同じ年次ページに複数の統計（党派別人員調／長の連続就任回数調）が並んでおり、
 * 取得スクリプトが2本あるため、ページ解決の部分をここに集約している。
 *
 * 【年次更新への対応】
 *   Excelの実URL（/main_content/00xxxxxx.xlsx）は年度ごとに新規発行されるため、
 *   固定URLをハードコードすると翌年以降も古い年のデータを返し続ける。
 *   そこで一覧ページから「令和N年12月31日現在」のリンクを全部拾い、元号年が
 *   最大のものを最新年として自動選択する。年1回の手動URL更新は不要。
 *
 * 【文字コード】
 *   総務省サイトのHTMLはShift_JIS。fetch().then(r => r.text()) だと文字化けするため
 *   arrayBuffer() → TextDecoder("shift_jis") でデコードする（CLAUDE.md記載の既知の罠）。
 */

export const SOUMU_ORIGIN = "https://www.soumu.go.jp";
export const SOUMU_SYOZOKU_INDEX_URL = `${SOUMU_ORIGIN}/senkyo/senkyo_s/data/syozoku/ichiran.html`;

const ERA_REIWA_BASE = 2018; // 令和元年 = 2019年 → 2018 + 1

/** 令和N年 → 西暦。「元」年も1年として扱う */
export function reiwaToGregorian(reiwaYear: number): number {
  return ERA_REIWA_BASE + reiwaYear;
}

export async function fetchShiftJisHtml(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTML取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }
  const buf = await res.arrayBuffer();
  return new TextDecoder("shift_jis").decode(buf);
}

export interface PageLink {
  href: string;
  text: string;
}

/** ページ内の <a href> を [href, リンクテキスト] の配列で返す（タグは除去） */
export function extractLinks(html: string): PageLink[] {
  const links: PageLink[] = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = (m[2] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (href) links.push({ href, text });
  }
  return links;
}

export const toAbsoluteSoumuUrl = (href: string): string =>
  href.startsWith("http") ? href : `${SOUMU_ORIGIN}${href}`;

export interface SurveyPage {
  pageUrl: string;
  /** 調査基準日（YYYY-MM-DD） */
  asOfDate: string;
  /** 原資料の表記（例:"令和7年12月31日現在"） */
  eraLabel: string;
}

/**
 * 一覧ページから最新調査年のページURLと調査基準日を解決する。
 * リンクテキスト「令和7年12月31日現在」の元号年が最大のものを最新とする
 * （掲載順が変わっても壊れないよう、順序ではなく年の大小で判定する）。
 */
export async function resolveLatestSurveyPage(): Promise<SurveyPage> {
  const html = await fetchShiftJisHtml(SOUMU_SYOZOKU_INDEX_URL);
  const candidates = extractLinks(html)
    .map((link) => {
      const m = link.text.match(/令和(\d+|元)年(\d+)月(\d+)日現在/);
      if (!m) return null;
      // PDFのみの年（平成21年以前）や別調査は対象外。HTMLページのみを候補にする
      if (!/\.html?$/i.test(link.href)) return null;
      const reiwaYear = m[1] === "元" ? 1 : Number(m[1]);
      const year = reiwaToGregorian(reiwaYear);
      const month = String(Number(m[2])).padStart(2, "0");
      const day = String(Number(m[3])).padStart(2, "0");
      return {
        pageUrl: toAbsoluteSoumuUrl(link.href),
        asOfDate: `${year}-${month}-${day}`,
        eraLabel: link.text,
        reiwaYear,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (candidates.length === 0) {
    throw new Error(
      `一覧ページから調査年のリンクを検出できませんでした（${SOUMU_SYOZOKU_INDEX_URL}）。` +
        `総務省側のページ構成が変わった可能性があります。`
    );
  }
  candidates.sort((a, b) => b.reiwaYear - a.reiwaYear);
  const latest = candidates[0]!;
  console.log(`最新の調査: ${latest.eraLabel} → ${latest.pageUrl}`);
  return latest;
}

/**
 * 年次ページから、リンクテキストに `keyword` を含むExcelのURLを解決する。
 * 同じページに複数の統計のxlsxが並ぶため、必ずリンクテキストで選ぶ。
 */
export async function resolveExcelUrlByLinkText(
  pageUrl: string,
  keyword: string
): Promise<string> {
  const html = await fetchShiftJisHtml(pageUrl);
  const xlsxLinks = extractLinks(html).filter((l) => /\.xlsx?$/i.test(l.href));
  const target = xlsxLinks.find((l) => l.text.includes(keyword));
  if (!target) {
    throw new Error(
      `年次ページから「${keyword}」を含むExcelのリンクを検出できませんでした（${pageUrl}）。` +
        `見つかったxlsxリンク: ${xlsxLinks.map((l) => l.text).join(" / ") || "なし"}。` +
        `総務省側のページ構成が変わった可能性があります。`
    );
  }
  const url = toAbsoluteSoumuUrl(target.href);
  console.log(`Excel: ${url}（リンク表記: ${target.text}）`);
  return url;
}

export async function fetchExcelBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Excel取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }
  return res.arrayBuffer();
}
