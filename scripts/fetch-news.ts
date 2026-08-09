/**
 * 政治ニュースの見出し・リンクを取得するスクリプト。
 *
 * データソース: NHK NEWS WEB「政治」カテゴリ RSS
 *   https://www3.nhk.or.jp/rss/news/cat4.xml
 *
 * 選定理由（2026-08-10調査、詳細はObsidian データソース調査.md／決定事項ログ.md参照）:
 *   - 日本の政治ニュースRSSとしてNHK・Yahoo!ニュース・47NEWS・Googleニュース・
 *     首相官邸を調査したが、いずれも配信ページの利用規約で「個人利用限定・
 *     プログラム/ウェブサイト等での再配信は禁止」と明記されている（Yahoo!ニュース、
 *     47NEWS、Googleニュースはこの制約が特に明示的）。
 *   - NHKも同様の制約（「個人の方の利用のためのみ」「ブログやプログラム等による
 *     再配信・再提供は不可」、出典: https://www.nhk.or.jp/toppage/rss/index.html ）
 *     があるが、(1) 公共放送であり特定政党寄りの論調になりにくく本プロジェクトの
 *     政治的中立性の方針と相性が良い、(2) 政治カテゴリ専用フィード(cat4.xml)が
 *     長期間安定運用されている、という点から、他候補より相対的にリスクが低いと
 *     判断し採用した。
 *   - リスク低減のため、本文・画像は一切取得・転載せず、見出しテキストと元記事への
 *     直リンクのみを保存する（実装はrss-parserでtitle/link/pubDateのみ抽出）。
 *     本プロジェクトが非個人利用の規模で公開される場合は、この判断を再検討すること。
 *
 * サムネイル画像について: cat4.xmlのレスポンスに<enclosure>や<media:thumbnail>等の
 *   画像情報は含まれておらず、そもそも取得できない。仮に取得できたとしても
 *   著作権上の扱いが不明瞭なため、本プロジェクトの「ライセンス不明な画像は掲載しない」
 *   方針（議員写真と同様）に沿って、サムネイルは表示しない。
 *
 * 実行: npm run fetch:news
 */
import Parser from "rss-parser";
import type { NewsItem } from "../src/lib/news";
import { writeDataJson } from "./lib/writeJson";

const FEED_URL = "https://www3.nhk.or.jp/rss/news/cat4.xml";
const SOURCE_NAME = "NHKニュース";
const MAX_ITEMS = 30;

async function main() {
  const parser = new Parser();
  const feed = await parser.parseURL(FEED_URL);

  const items: NewsItem[] = (feed.items ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      id: item.guid || item.link!,
      title: item.title!.trim(),
      link: item.link!,
      sourceName: SOURCE_NAME,
      publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
    }))
    .slice(0, MAX_ITEMS);

  console.log(`取得件数: ${items.length}件`);
  if (items.length === 0) {
    throw new Error(
      "ニュースを1件も取得できませんでした。フィードURL・スキーマを確認してください。"
    );
  }

  await writeDataJson("news.json", items);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
