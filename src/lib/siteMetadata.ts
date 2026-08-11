import type { Metadata } from "next";

/**
 * サイト全体のメタデータ（title/description/OGP）の共通定義。
 *
 * 【中立性の方針（重要）】
 * SNSでシェアされたときに最初に読まれるのがこのメタデータなので、本文以上に
 * 表現の中立性が問われる。descriptionは DataInsight・DataCoverageNote と同じ
 * トーンに揃え、以下を守ること。
 * - 評価的な形容詞（重要な・注目の・話題の・驚きの 等）を使わない
 * - 法案・議員・政党の優劣や賛否への評価を書かない
 * - 「何のデータを、どの範囲で表示しているか」という事実の記述に留める
 */

export const SITE_NAME = "日本政治マップ";

export const SITE_DESCRIPTION =
  "国会の法案審議状況・国会議員・記名投票・都道府県別の地方財政データを、公的機関の公表資料をもとに出典つきで表示するサイトです。格付けや評価は行いません。";

/**
 * 本番の公開URL。ドメインが未確定のため、以下の優先順で解決する。
 *
 * 1. `NEXT_PUBLIC_SITE_URL`
 *    独自ドメインを取得した後に、Vercelの環境変数（あるいは`.env`）へ設定する想定。
 *    ここに値が入っていれば常にこれが最優先になる。
 * 2. `VERCEL_PROJECT_PRODUCTION_URL`
 *    Vercelがビルド時に自動で注入するシステム環境変数で、プレビューデプロイで
 *    ビルドしたときも「本番ドメイン」（例: jp-politics-map.vercel.app）を指す。
 *    デプロイごとに変わる`VERCEL_URL`と違い、canonical URL・OGP・sitemapに
 *    使ってよい値はこちら（`VERCEL_URL`を使うとプレビュー用の一意URLが
 *    canonicalとして外部に出てしまうため使わない）。
 * 3. 上記いずれも無い場合のフォールバック（ローカル開発・CI）。
 *    metadataBaseは絶対URLを要求するため、値が無いと生成に失敗する。
 *
 * 注: `NEXT_PUBLIC_`接頭辞の環境変数はビルド時にバンドルへ埋め込まれるため、
 * ドメイン確定後の切り替えには再デプロイが必要。
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalizeOrigin(explicit);

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return normalizeOrigin(vercelProduction);

  return "https://jp-politics-map.vercel.app";
}

/** スキームの有無・末尾スラッシュのゆらぎを吸収して`https://example.com`の形に揃える */
function normalizeOrigin(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl();

/** サイト内の絶対URLを組み立てる（sitemap・canonical用）。pathは先頭スラッシュ必須 */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

interface PageMetadataInput {
  /**
   * ページ固有のタイトル。ルートlayoutのtemplate（`%s | 日本政治マップ`）が
   * 自動で付くため、サイト名を含めずに書くこと。
   */
  title: string;
  description: string;
  /** サイトルートからのパス（先頭スラッシュ必須）。canonicalとog:urlに使う */
  path: string;
}

/**
 * 各ページのmetadataを組み立てる。
 *
 * openGraph.title / twitter.title はNext.jsのtitle.templateの対象外で、
 * 親（ルートlayout）の値をそのまま継承してしまうため、ここでサイト名まで
 * 含めた完全なタイトルを明示的に組み立てている（これをしないと、全ページの
 * OGPカードのタイトルが「日本政治マップ」で同一になる）。
 */
export function buildPageMetadata({
  title,
  description,
  path,
}: PageMetadataInput): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ja_JP",
      url: path,
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
