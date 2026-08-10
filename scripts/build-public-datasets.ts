/**
 * 公開ダウンロード用のデータセットを public/data/datasets/ に書き出すスクリプト
 * （機能拡充ロードマップ Tier1 #9「データダウンロード／公開API」）。
 *
 * 実行: npm run build:public-datasets
 *   （npm run dev / npm run build の前に predev / prebuild で自動実行される）
 *
 * 【なぜコピーするのか】
 *   配布対象のJSONは data/ にあるが、Next.js が静的配信するのは public/ 配下だけ。
 *   かといって同じ内容を public/ にもコミットすると、日次の自動更新
 *   （fetch:all → data/ を更新）のたびに2箇所を同期する必要が生じ、
 *   リポジトリのサイズも倍になる。そのため public/data/datasets/ は
 *   ビルド時に生成する成果物とし、.gitignore に入れている。
 *
 * 【何を配布するか】
 *   配布可否の判断とその根拠は src/lib/datasetDownloads.ts に一元管理している
 *   （ダウンロードページの表示もそこから作る）。このスクリプトは判断をせず、
 *   DOWNLOADABLE_DATASETS に載っているものだけを機械的に書き出す。
 *
 * 【manifest.json】
 *   同じディレクトリに機械可読な一覧を書き出す。プログラムから本サイトの
 *   データを使う場合の入口（＝公開API）にあたるファイル。
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { datasetHref } from "../src/lib/dataProvenance";
import {
  DOWNLOADABLE_DATASETS,
  PUBLIC_DATASET_DIR,
  type DatasetManifest,
  type DatasetManifestEntry,
} from "../src/lib/datasetDownloads";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(PUBLIC_DIR, ...PUBLIC_DATASET_DIR.split("/"));

/** JSONのトップレベルが配列なら要素数を返す（それ以外は null） */
function countRecords(text: string): number | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const entries: DatasetManifestEntry[] = [];
  const missing: string[] = [];

  for (const dataset of DOWNLOADABLE_DATASETS) {
    const fileName = path.posix.basename(dataset.path);

    let text: string;
    if (dataset.sourceFileName === null) {
      // 地図データ（元から public/ にあるファイル）はコピーせず、サイズだけ測る
      const publicPath = path.join(PUBLIC_DIR, ...dataset.path.split("/"));
      try {
        text = await readFile(publicPath, "utf-8");
      } catch {
        missing.push(dataset.path);
        continue;
      }
    } else {
      const srcPath = path.join(DATA_DIR, dataset.sourceFileName);
      let raw: string;
      try {
        raw = await readFile(srcPath, "utf-8");
      } catch {
        // fetch スクリプト未実行などでファイルが無い場合は、ビルドを止めずに
        // そのデータセットだけ配布対象から外す（他ページの動作には影響しない）
        missing.push(dataset.sourceFileName);
        continue;
      }
      text = dataset.transform
        ? JSON.stringify(dataset.transform(JSON.parse(raw) as unknown), null, 2) + "\n"
        : raw;
      await writeFile(path.join(OUT_DIR, fileName), text, "utf-8");
    }

    entries.push({
      path: dataset.path,
      fileName,
      label: dataset.label,
      description: dataset.description,
      records: countRecords(text),
      bytes: Buffer.byteLength(text, "utf-8"),
      license: dataset.license,
      sources: dataset.sources,
      coverageUrl: dataset.datasetId ? datasetHref(dataset.datasetId) : null,
    });
  }

  const manifest: DatasetManifest = {
    site: "日本政治マップ",
    siteUrl: null,
    generatedAt: new Date().toISOString(),
    note: "各ファイルの再配布条件は license 欄のとおりです。利用の際は attribution の出典表記を添えてください。",
    datasets: entries,
  };
  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8"
  );

  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
  console.log(
    `wrote ${entries.length} datasets to ${OUT_DIR} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`
  );
  if (missing.length > 0) {
    console.warn(`skipped (file not found): ${missing.join(", ")}`);
  }

  // 生成物が実際に配信できる場所にあるかの簡単な検算
  const manifestStat = await stat(path.join(OUT_DIR, "manifest.json"));
  if (manifestStat.size === 0) {
    throw new Error("manifest.json が空です");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
