/**
 * NDL国会会議録検索システムAPIから、現職議員の発言件数（件数のみ）を集計するスクリプト。
 *
 * データソース: 国立国会図書館「国会会議録検索システム」検索用API
 *   https://kokkai.ndl.go.jp/api/speech?{検索条件}
 *   - 発言者名で絞り込み: speaker パラメータ（部分一致）
 *   - recordPacking=json でJSONレスポンスを取得
 *   - レスポンスの numberOfRecords フィールドに該当件数の総数が入るため、
 *     maximumRecords=1 を指定して本文を大量取得せず件数だけを取得する
 *   - 登録・APIキーは不要
 *
 * 本文（発言テキスト）は一切保存しない。著作権配慮のため件数のみを集計・保存する
 * （CLAUDE.mdの中立性・出典明記の原則を踏襲）。
 *
 * 【重要】同姓同名の混同リスクについて:
 *   NDL側の speaker 検索は完全な人物特定（議員IDでの一意な紐付け）ではなく、
 *   発言者名文字列の部分一致検索でしかない。そのため、同姓同名の別人
 *   （引退した元議員、地方議員、参考人など）の発言も件数に混入しうる。
 *   この値は「本人の発言回数」を保証するものではなく、あくまで参考値である。
 *   出力データには isApproximate: true を明示的に持たせているので、UI側で
 *   表示する際も必ず「参考値」である旨を明記すること。
 *
 * 【重要】議員名の空白について:
 *   data/legislators.json の name フィールドは姓名の間に全角スペースが
 *   複数入っていることがある（例:「赤羽　　一嘉」）。NDL API側の発言者名表記とは
 *   空白の入り方が異なる可能性が高いため、検索前に空白文字（半角・全角とも）を
 *   除去してから speaker パラメータに渡す。
 *
 * 利用上の注意（NDL API利用規約）:
 *   「短時間での大量アクセス等、負荷をかける利用は自粛」「データ取得後、数秒程度
 *   空けて次のリクエスト」という記載があるため、丁寧のため各リクエスト間に
 *   300〜500ms程度のウェイトを入れる（他の fetch-*.ts スクリプトの方針を踏襲、
 *   scripts/fetch-shugiin-members.ts のコメント参照）。
 *
 * 実行時間の目安: 現職議員712名 × 0.3〜0.5秒 ≈ 4〜6分程度。
 *
 * 実行: npm run fetch:ndl-speech-counts
 */
import type { Legislator, NdlSpeechCount } from "../src/types";
import { writeDataJson } from "./lib/writeJson";
// 空白除去は共通の名寄せモジュール（src/lib/nameMatch.ts）に集約している。
// ここでは NFKC や異体字の畳み込みは行わない: NDL会議録は当時の表記（旧字体を
// 含む）をそのまま持っており、常用字体へ寄せるとかえってヒットしなくなるため、
// 空白除去だけの stripNameWhitespace() を使う。
import { stripNameWhitespace } from "../src/lib/nameMatch";
import { readFile } from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://kokkai.ndl.go.jp/api/speech";
const MIN_WAIT_MS = 300;
const MAX_WAIT_MS = 500;

function buildSearchUrl(speaker: string): string {
  const params = new URLSearchParams({
    speaker,
    maximumRecords: "1",
    recordPacking: "json",
  });
  return `${API_BASE}?${params.toString()}`;
}

interface NdlSpeechApiResponse {
  numberOfRecords?: number;
}

async function fetchSpeechCount(speaker: string): Promise<number> {
  const url = buildSearchUrl(speaker);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NDL API fetch failed (speaker=${speaker}): ${res.status}`);
  }
  const json = (await res.json()) as NdlSpeechApiResponse;
  if (typeof json.numberOfRecords !== "number") {
    throw new Error(`NDL API response missing numberOfRecords (speaker=${speaker})`);
  }
  return json.numberOfRecords;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomWaitMs(): number {
  return MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const legislators = JSON.parse(
    await readFile(path.join(dataDir, "legislators.json"), "utf-8")
  ) as Legislator[];

  const currentLegislators = legislators.filter((l) => l.termStatus === "現職");
  console.log(`対象議員数（現職）: ${currentLegislators.length}名`);

  const results: NdlSpeechCount[] = [];
  let failedCount = 0;

  for (let i = 0; i < currentLegislators.length; i++) {
    const legislator = currentLegislators[i]!;
    const speaker = stripNameWhitespace(legislator.name);

    try {
      const speechCount = await fetchSpeechCount(speaker);
      results.push({
        legislatorId: legislator.id,
        name: legislator.name,
        speechCount,
        // 完全な人物特定ではなく発言者名の部分一致検索による集計のため、
        // 同姓同名の別人の発言が混ざりうる参考値であることを明示する。
        isApproximate: true,
        fetchedAt: new Date().toISOString(),
        sourceUrl: buildSearchUrl(speaker),
      });
    } catch (err) {
      // 1議員の取得失敗で全体を止めず、スキップして続行する
      failedCount++;
      console.error(`取得失敗（スキップ）: ${legislator.name} (${legislator.id})`, err);
    }

    // 進捗ログ（50件ごと、および最後に出力）
    if ((i + 1) % 50 === 0 || i === currentLegislators.length - 1) {
      console.log(`進捗: ${i + 1}/${currentLegislators.length}件処理（失敗 ${failedCount}件）`);
    }

    // NDL APIへの配慮として、リクエスト間に300〜500ms程度のウェイトを入れる。
    // 最後の1件の後は待つ必要がないのでスキップする。
    if (i < currentLegislators.length - 1) {
      await wait(randomWaitMs());
    }
  }

  console.log(`取得成功: ${results.length}件 / 失敗: ${failedCount}件`);

  if (results.length === 0) {
    throw new Error(
      "発言件数を1件も取得できませんでした。NDL API側の仕様変更・障害の可能性があります。"
    );
  }

  await writeDataJson("ndl-speech-counts.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
