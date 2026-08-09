/**
 * 政治関連ニュースの見出し・リンクを取得するスクリプト。
 *
 * データソース選定（2026-08-10調査、詳細はObsidian データソース調査.md／決定事項ログ.md参照）:
 *   1. NHK NEWS WEB「政治」カテゴリ RSS（cat4.xml）
 *      規約上「個人利用限定・プログラムでの再配信不可」と明記されているが、
 *      公共放送で党派性が低く、政治専用フィードが安定運用されている点から
 *      他候補（Yahoo!ニュース、47NEWS、Googleニュース、首相官邸）より
 *      相対的にリスクが低いと判断し採用
 *   2. 総務省「ホームページ新着情報」RSS（news.rdf）
 *      利用規約ページに禁止文言が一切なく（内閣府・首相官邸にある
 *      「営利・非営利問わず再配布禁止」のような記載が無い）、技術的注意書き
 *      （URL変更の可能性等）のみだったため追加。ただし内容は総務省全般の
 *      お知らせであり、NHKほど政治ニュースに特化していない点に留意
 *
 * リスク低減のため、両ソースとも本文・画像は一切取得・転載せず、見出しテキストと
 * 元記事への直リンクのみを保存する。本プロジェクトが非個人利用の規模で公開される
 * 場合は、NHK分の採否を再検討すること。
 *
 * 実装メモ: 総務省のnews.rdfはRSS1.0(RDF)形式・Shift_JISエンコーディング。
 * rss-parserの`parseURL()`はエンコーディングを認識せず文字化けするため、
 * 自前でarrayBufferを取得してShift_JISデコードしてから`parseString()`に渡す
 * 必要がある（実データで確認済み）。NHK側はUTF-8のRSS2.0なのでparseURL()で問題ない。
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
    url: "https://www3.nhk.or.jp/rss/news/cat4.xml",
    sourceName: "NHKニュース",
    maxItems: 30,
  },
  {
    url: "https://www.soumu.go.jp/news.rdf",
    sourceName: "総務省",
    encoding: "shift_jis",
    maxItems: 20,
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
