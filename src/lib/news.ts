import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * 政治ニュースの見出し1件。
 *
 * データソース・利用条件の詳細はscripts/fetch-news.tsの冒頭コメントおよび
 * Obsidian（データソース調査.md／決定事項ログ.md）を参照。
 * 著作権上の扱いが不明瞭な本文・サムネイル画像は保持しない方針のため、
 * 見出しテキストと元記事へのリンクのみを持つ。
 */
export interface NewsItem {
  id: string;
  title: string;
  link: string;
  sourceName: string;
  publishedAt: string; // ISO 8601
}

/**
 * data/news.json を読み込む。
 *
 * ヘッダー（layout.tsx）から全ページ共通で呼ばれるため、他のgetXと異なり
 * ファイル未取得・破損時も例外を投げず空配列にフォールバックする
 * （そうしないと npm run fetch:news 未実行の状態でサイト全体が壊れてしまうため）。
 */
export async function getNews(): Promise<NewsItem[]> {
  try {
    const filePath = path.join(DATA_DIR, "news.json");
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as NewsItem[];
  } catch {
    return [];
  }
}
