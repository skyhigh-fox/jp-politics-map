/**
 * 政治関連ニュースの見出し・リンクを取得するスクリプト。
 *
 * データソース選定（2026-08-11更新、詳細はObsidian データソース調査.md／決定事項ログ.md参照）:
 *   総務省「ホームページ新着情報」RSS（news.rdf）のみを採用。
 *   利用規約ページに禁止文言が一切なく（内閣府・首相官邸・厚生労働省にある
 *   「営利・非営利問わず再配布禁止」のような記載が無い）、技術的注意書き
 *   （URL変更の可能性等）のみだったため採用。内容は総務省全般のお知らせであり、
 *   政治ニュースに特化はしていないが、選挙関連の告知等は含まれる。
 *
 *   2026-08-10時点ではNHK NEWS WEB「政治」カテゴリRSSも併用していたが、
 *   同RSSの規約は「個人の方の利用のためのみ」「商業目的での再配信・再提供は
 *   不可」と明記されており、一般公開（不特定多数への提供）を見据えて2026-08-11に
 *   除外した（一般公開検討リサーチで既知のブロッカーとして特定済み）。
 *   代替候補として内閣官房・内閣府・厚生労働省・政府広報オンラインのRSSも
 *   調査したが、いずれも同様の再配信禁止文言が確認され、採用を見送った。
 *
 * リスク低減のため、本文・画像は一切取得・転載せず、見出しテキストと
 * 元記事への直リンクのみを保存する。
 *
 * 実装メモ: 総務省のnews.rdfはRSS1.0(RDF)形式・Shift_JISエンコーディング。
 * rss-parserの`parseURL()`はエンコーディングを認識せず文字化けするため、
 * 自前でarrayBufferを取得してShift_JISデコードしてから`parseString()`に渡す
 * 必要がある（実データで確認済み）。
 *
 * 実行: npm run fetch:news
 */
import Parser from "rss-parser";
import type { NewsItem } from "../src/lib/news";
import { writeDataJson } from "./lib/writeJson";

interface FeedSource {
  url: string;
  sourceName: string;
  encoding?: "shift_jis"; // 未指定ならUTF-8としてparseURL()を使う
  maxItems: number;
}

const SOURCES: FeedSource[] = [
  {
    url: "https://www.soumu.go.jp/news.rdf",
    sourceName: "総務省",
    encoding: "shift_jis",
    maxItems: 30,
  },
];

function toNewsItems(
  items: Parser.Item[],
  sourceName: string,
  maxItems: number
): NewsItem[] {
  return items
    .filter((item) => item.title && item.link)
    .map((item) => ({
      id: item.guid || item.link!,
      title: item.title!.trim(),
      link: item.link!,
      sourceName,
      publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
    }))
    .slice(0, maxItems);
}

async function fetchSource(source: FeedSource): Promise<NewsItem[]> {
  const parser = new Parser();
  if (source.encoding === "shift_jis") {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`fetch failed (${source.sourceName}): ${res.status}`);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder(source.encoding).decode(buf);
    const feed = await parser.parseString(text);
    return toNewsItems(feed.items ?? [], source.sourceName, source.maxItems);
  }
  const feed = await parser.parseURL(source.url);
  return toNewsItems(feed.items ?? [], source.sourceName, source.maxItems);
}

async function main() {
  const results = await Promise.allSettled(SOURCES.map(fetchSource));

  const items: NewsItem[] = [];
  results.forEach((result, i) => {
    const source = SOURCES[i]!;
    if (result.status === "fulfilled") {
      console.log(`${source.sourceName}: ${result.value.length}件`);
      items.push(...result.value);
    } else {
      // 1ソースの失敗で全体を止めない（他ソースは引き続き取得する）
      console.error(`${source.sourceName}の取得に失敗:`, result.reason);
    }
  });

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  console.log(`合計取得件数: ${items.length}件`);
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
