import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { datasetHref } from "@/lib/dataProvenance";
import { buildPageMetadata } from "@/lib/siteMetadata";
import {
  DOWNLOADABLE_DATASETS,
  MANIFEST_PATH,
  PUBLIC_DATASET_DIR,
  WITHHELD_DATASETS,
  type DatasetManifest,
  type DatasetManifestEntry,
} from "@/lib/datasetDownloads";

/**
 * データダウンロード／公開データのページ（機能拡充ロードマップ Tier1 #9）。
 *
 * 【このページの設計制約（変更時は必ず守ること）】
 * 1. 目的はデータをそのまま渡すことに限る。「このデータでこう分析できる」
 *    「こう解釈すべき」といった利用方法の誘導・示唆は書かない。
 * 2. 配布可否は原典のライセンス・利用規約だけで決める。判断できないものは
 *    配布せず、原典へのリンクに留め、その理由を同じページに明記する
 *    （何を配っていないかを隠さない）。
 * 3. 配布しない理由は規約の書きぶりについての事実の記述に留め、原典側を
 *    批判する書き方はしない。
 *
 * 配布可否の判断と根拠は src/lib/datasetDownloads.ts に一元管理している。
 * 件数・ファイルサイズはハードコードせず、ビルド時に生成される
 * public/data/datasets/manifest.json から読む。
 */

export const metadata: Metadata = buildPageMetadata({
  title: "データの入手",
  description:
    "本サイトが集計に使っているデータのうち、原典のライセンス・利用規約で再配布が認められているものを、機械可読なJSONのまま配布しています。",
  path: "/data",
});

const numberFormat = new Intl.NumberFormat("ja-JP");

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * ビルド時に生成したマニフェストを読む。
 * 未生成でもページが壊れないよう、読めない場合は空のマップを返す
 * （件数・サイズの表示だけが省かれ、リンクは変わらず機能する）。
 */
async function loadManifestEntries(): Promise<Map<string, DatasetManifestEntry>> {
  try {
    const manifestFile = path.join(
      process.cwd(),
      "public",
      ...PUBLIC_DATASET_DIR.split("/"),
      "manifest.json"
    );
    const raw = await readFile(manifestFile, "utf-8");
    const manifest = JSON.parse(raw) as DatasetManifest;
    return new Map(manifest.datasets.map((entry) => [entry.path, entry]));
  } catch {
    return new Map();
  }
}

export default async function DataDownloadPage() {
  const entries = await loadManifestEntries();
  const totalBytes = [...entries.values()].reduce((sum, e) => sum + e.bytes, 0);

  return (
    <div className="max-w-3xl animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        データの入手
      </h1>

      <div className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <p>
          本サイトの画面は、公的機関やオープンデータから自動取得したJSONを集計して作っています。そのうち、
          <strong className="font-semibold">
            原典のライセンス・利用規約で再配布が認められているもの
          </strong>
          を、加工せず機械可読なJSONのまま配布しています。
        </p>
        <p>
          再配布の可否は原典の規約だけで判断しています。規約から再配布の許諾を読み取れないデータは配布せず、
          <Link
            href="#withheld"
            className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            配布していないデータ
          </Link>
          として理由とともに一覧にしています。
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          プログラムから使う
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          配布ファイルの一覧・ライセンス・件数を機械可読な形でまとめたマニフェストを、以下の固定URLに置いています。各ファイルのURLもこのマニフェストから取得できます。
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <a
            href={MANIFEST_PATH}
            className="font-mono text-xs text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            {MANIFEST_PATH}
          </a>
          <pre className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            <code>{`curl -s https://<このサイトのドメイン>${MANIFEST_PATH}`}</code>
          </pre>
        </div>
        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          <li>・いずれも認証・APIキーなしで取得できる静的ファイルです。</li>
          <li>
            ・データは1日1回自動更新しています。ファイル名・URLは更新後も変わりません。
          </li>
          <li>
            ・ブラウザのJavaScriptから取得できるよう、CORS（
            <code className="font-mono">Access-Control-Allow-Origin: *</code>
            ）を設定しています。
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          配布しているデータ
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {entries.size > 0
            ? `${numberFormat.format(entries.size)}ファイル・合計${formatBytes(totalBytes)}。各ファイルの再配布条件はカード内のライセンス欄のとおりです。`
            : "各ファイルの再配布条件はカード内のライセンス欄のとおりです。"}
        </p>

        <div className="mt-4 space-y-4">
          {DOWNLOADABLE_DATASETS.map((dataset) => {
            const entry = entries.get(dataset.path);
            return (
              <div
                key={dataset.path}
                className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {dataset.label}
                  </h3>
                  {entry && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-500">
                      {entry.records !== null &&
                        `${numberFormat.format(entry.records)}件・`}
                      {formatBytes(entry.bytes)}
                    </p>
                  )}
                </div>

                <p className="mt-2 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {dataset.description}
                </p>

                <p className="mt-3">
                  <a
                    href={dataset.path}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-xs text-accent-600 transition-colors hover:border-accent-300 hover:text-accent-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-accent-400 dark:hover:text-accent-300"
                  >
                    <span aria-hidden>↓</span>
                    {dataset.path}
                  </a>
                </p>

                <dl className="mt-3 space-y-1.5 text-xs leading-relaxed">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="shrink-0 text-neutral-500 dark:text-neutral-500">
                      ライセンス
                    </dt>
                    <dd className="text-neutral-700 dark:text-neutral-300">
                      {dataset.license.url ? (
                        <a
                          href={dataset.license.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                        >
                          {dataset.license.name}
                        </a>
                      ) : (
                        dataset.license.name
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="shrink-0 text-neutral-500 dark:text-neutral-500">
                      出典表記
                    </dt>
                    <dd className="text-neutral-700 dark:text-neutral-300">
                      {dataset.license.attribution}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="shrink-0 text-neutral-500 dark:text-neutral-500">
                      配布できる根拠
                    </dt>
                    <dd className="text-neutral-700 dark:text-neutral-300">
                      {dataset.rationale}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {dataset.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                    >
                      {source.name}
                    </a>
                  ))}
                  {dataset.datasetId && (
                    <Link
                      href={datasetHref(dataset.datasetId)}
                      className="text-neutral-500 transition-colors hover:text-neutral-700 hover:underline dark:text-neutral-500 dark:hover:text-neutral-300"
                    >
                      収録範囲の詳細
                    </Link>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2
          id="withheld"
          className="scroll-mt-24 text-lg font-bold text-neutral-900 dark:text-neutral-50"
        >
          配布していないデータ
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          以下は本サイトの画面では表示していますが、原典の利用規約から再配布の許諾を読み取れないため、ファイルとしては配布していません。いずれも原典から直接取得できます。
        </p>

        <div className="mt-4 space-y-4">
          {WITHHELD_DATASETS.map((dataset) => (
            <div
              key={dataset.label}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50"
            >
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {dataset.label}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                {dataset.reason}
              </p>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {dataset.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                  >
                    {source.name}
                  </a>
                ))}
                {dataset.datasetId && (
                  <Link
                    href={datasetHref(dataset.datasetId)}
                    className="text-neutral-500 transition-colors hover:text-neutral-700 hover:underline dark:text-neutral-500 dark:hover:text-neutral-300"
                  >
                    収録範囲の詳細
                  </Link>
                )}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          利用にあたって
        </h2>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li className="flex gap-1.5">
            <span aria-hidden className="text-neutral-400 dark:text-neutral-600">
              ・
            </span>
            <span>
              各ファイルの「出典表記」欄の記載を添えてご利用ください。原典側の規約で条件とされているものです。
            </span>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden className="text-neutral-400 dark:text-neutral-600">
              ・
            </span>
            <span>
              CC BY-SA 4.0 のデータ（政党別議席数の推移）は、再配布・改変して公開する場合、同じライセンスで公開する必要があります。
            </span>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden className="text-neutral-400 dark:text-neutral-600">
              ・
            </span>
            <span>
              データは原典から自動取得したものであり、取得元の誤り・更新のずれ・自動処理に伴う不正確さが含まれる可能性があります。正確性・完全性・最新性は保証できません。詳しくは
              <Link
                href="/disclaimer"
                className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
              >
                免責事項・出典
              </Link>
              をご確認ください。
            </span>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden className="text-neutral-400 dark:text-neutral-600">
              ・
            </span>
            <span>
              各データセットがどの範囲まで収録できているか（収録していない範囲を含む）は、各カードの「収録範囲の詳細」からご確認ください。
            </span>
          </li>
        </ul>
      </section>

      <p className="mt-10 text-sm">
        <Link
          href="/"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← トップに戻る
        </Link>
      </p>
    </div>
  );
}
