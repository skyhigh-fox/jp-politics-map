/**
 * 質問主意書の提出件数を議員ごとに集計するスクリプト。
 *
 * データソース:
 *   - 参議院: https://www.sangiin.go.jp/japanese/joho1/kousei/syuisyo/{回次}/syuisyo.htm
 *   - 衆議院: https://www.shugiin.go.jp/internet/itdb_shitsumon.nsf/html/shitsumon/kaiji{回次}_l.htm
 *
 * 実行: npm run fetch:written-questions
 *
 * 重要な設計方針:
 *   - 質問主意書の本文・答弁書本文は一切取得・保存しない。件名と提出者名から
 *     「件数」だけを集計する（著作権配慮）。
 *   - 政治的中立性配慮のため、このデータ自体に「多い/少ない＝良い」といった
 *     評価的な意味づけ（ランキング用の並び替え等）を持たせない。単に
 *     「対象回次の中で何件提出したか」という事実データとして保持する。
 *   - 全69回次（第1回〜）を毎回スクレイピングするのはサイトへの負荷が大きすぎるため、
 *     今回は「直近N回次」のみを対象にする（SESSION_COUNT定数で調整可能）。
 *     国会回次は衆参共通の通し番号なので、両院とも同じ回次レンジを対象にする。
 *
 * 実データ確認済み（2026-08-10、Node.jsから直接fetchして検証）:
 *   - 現在の国会回次は両院とも第221回（参議院の
 *     `.../syuisyo/current/syuisyo.htm` がJavaScriptで
 *     `.../syuisyo/221/syuisyo.htm` にリダイレクトすることで確認）
 *   - 参議院: ページの文字コードは実際にはUTF-8（<meta>にcharset=utf-8とあり、
 *     衆議院と違ってShift_JISではない）。テーブルは1問につき2〜3行の<tr>にまたがり、
 *     「提出者」という<th>の直後の<td>（class="ta_l"）に氏名が入る
 *     （例:「神谷　　宗幣君」のように姓名間に全角スペース、末尾に「君」）
 *   - 衆議院: ページはShift_JIS。過去回次一覧ページ
 *     （kaiji{回次}_l.htm、回次>147の場合。147以下は別データベース
 *     `itdb_shitsumona.nsf` になるが、今回のSESSION_COUNTの範囲では出てこない）の
 *     テーブルは `<td headers="SHITSUMON.TEISHUTSUSHA">` に提出者氏名が入る
 *     （例:「緒方林太郎君」。参議院と異なりスペースなし・末尾に「君」）
 *   - 提出者名の表記はlegislators.jsonの`name`（姓名間に全角スペース、敬称なし）と
 *     異なるため、共通の名寄せモジュール（src/lib/nameMatch.ts）で正規化キー
 *     （NFKC・空白除去・敬称「君」除去）を作ってから照合する
 *
 * 【院をまたぐ照合について】
 *   直近18回次には、提出当時と現在で所属する院が変わっている議員
 *   （参議院→衆議院の鞍替え等）が含まれる。そのため名寄せは
 *   「同じ院で一意 → 院を問わず一意」の順にフォールバックする。
 *   それでも解決できない提出者名は現職議員マスタに存在しない元議員と
 *   考えられるため、件数上位を末尾にログ出力して次の作業者が追えるようにする。
 */
import * as cheerio from "cheerio";
import type { Legislator, WrittenQuestionCount } from "../src/types";
import { writeDataJson } from "./lib/writeJson";
import { buildNameIndex, resolveName, type NameIndex } from "../src/lib/nameMatch";
import { readFile } from "node:fs/promises";
import path from "node:path";

// 直近何回次を対象にするか（1回次あたり衆参2ページ取得。全69回次を毎回舐めると
// サイトへの負荷が大きいため、今回は範囲を絞る。将来広げる場合はこの値を増やすだけでよい）
const SESSION_COUNT = 18;

// 万一「現在の回次」の自動検出に失敗した場合のフォールバック
// （2026-08-10時点で確認した回次。老朽化したら手動で更新する）
const FALLBACK_LATEST_SESSION = 221;

const SANGIIN_CURRENT_URL =
  "https://www.sangiin.go.jp/japanese/joho1/kousei/syuisyo/current/syuisyo.htm";
const SANGIIN_LIST_URL = (session: number) =>
  `https://www.sangiin.go.jp/japanese/joho1/kousei/syuisyo/${session}/syuisyo.htm`;
const SHUGIIN_LIST_URL = (session: number) =>
  `https://www.shugiin.go.jp/internet/itdb_shitsumon.nsf/html/shitsumon/kaiji${session}_l.htm`;

const WAIT_MS = 300;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 参議院の「質問主意書・答弁書一覧」ページから提出者名の一覧（1問=1エントリ）を抽出する。
 * テーブル内、ラベルが「提出者」の<th>の直後の<td>に氏名が入っている。
 */
function parseSangiinSubmitters(html: string): string[] {
  const $ = cheerio.load(html);
  const names: string[] = [];
  $("th").each((_, th) => {
    const label = $(th).text().trim();
    if (label !== "提出者") return;
    const raw = $(th).next("td").text().trim();
    if (raw) names.push(raw);
  });
  return names;
}

/**
 * 衆議院の「質問の一覧」ページから提出者名の一覧（1問=1エントリ）を抽出する。
 * `<td headers="SHITSUMON.TEISHUTSUSHA">` に氏名が入っている。
 */
function parseShugiinSubmitters(html: string): string[] {
  const $ = cheerio.load(html);
  const names: string[] = [];
  $('td[headers="SHITSUMON.TEISHUTSUSHA"]').each((_, td) => {
    const raw = $(td).text().trim();
    if (raw) names.push(raw);
  });
  return names;
}

async function fetchText(url: string, encoding: "utf-8" | "shift_jis"): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  return new TextDecoder(encoding).decode(buf);
}

/** 参議院の「現在」ページ（current/syuisyo.htm）のJSリダイレクト先から現在の回次番号を読み取る */
async function detectLatestSession(): Promise<number> {
  try {
    const html = await fetchText(SANGIIN_CURRENT_URL, "utf-8");
    const match = html.match(/syuisyo\/(\d+)\/syuisyo\.htm/);
    if (!match) throw new Error("回次番号のパターンが見つかりませんでした");
    return Number(match[1]);
  } catch (err) {
    console.warn(
      `現在の国会回次の自動検出に失敗したため、フォールバック値(${FALLBACK_LATEST_SESSION})を使用します:`,
      err
    );
    return FALLBACK_LATEST_SESSION;
  }
}

interface Accumulator {
  legislatorId: string;
  questionCount: number;
  sessions: Set<number>;
}

/** 1回次分の提出者名リストを集計マップに反映する */
function accumulate(
  acc: Map<string, Accumulator>,
  rawNames: string[],
  nameIndex: NameIndex,
  chamber: Legislator["chamber"],
  session: number,
  unresolvedNames: Map<string, number>
) {
  for (const raw of rawNames) {
    // 同じ院で一意 → 院を問わず一意（鞍替え等）の順に解決する。
    // 同姓同名で一意に定まらない場合は誤集計を避けるため紐付けない。
    const legislatorId = resolveName(nameIndex, raw, { chamber }).id;
    if (!legislatorId) {
      // legislators.jsonに見つからない（引退議員等）。件数だけ記録して無視する
      const key = raw.trim();
      unresolvedNames.set(key, (unresolvedNames.get(key) ?? 0) + 1);
      continue;
    }

    const entry = acc.get(legislatorId) ?? {
      legislatorId,
      questionCount: 0,
      sessions: new Set<number>(),
    };
    entry.questionCount += 1;
    entry.sessions.add(session);
    acc.set(legislatorId, entry);
  }
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const legislators = JSON.parse(
    await readFile(path.join(dataDir, "legislators.json"), "utf-8")
  ) as Legislator[];
  const legislatorById = new Map(legislators.map((l) => [l.id, l]));

  // 名寄せ用インデックス（src/lib/nameMatch.ts）。院で絞らず全議員で作り、
  // 照合時に「提出時点の院を優先、見つからなければ他院」の順で解決する。
  const nameIndex = buildNameIndex(legislators);
  const unresolvedNames = new Map<string, number>();
  let totalSubmissions = 0;

  const latestSession = await detectLatestSession();
  const sessions: number[] = [];
  for (let s = latestSession; s > latestSession - SESSION_COUNT; s--) {
    sessions.push(s);
  }
  console.log(
    `対象回次: 第${sessions[sessions.length - 1]}回〜第${sessions[0]}回（計${sessions.length}回次）`
  );

  const acc = new Map<string, Accumulator>();

  for (const session of sessions) {
    // 参議院
    try {
      const html = await fetchText(SANGIIN_LIST_URL(session), "utf-8");
      const names = parseSangiinSubmitters(html);
      console.log(`参議院 第${session}回: ${names.length}件`);
      totalSubmissions += names.length;
      accumulate(acc, names, nameIndex, "参議院", session, unresolvedNames);
    } catch (err) {
      console.warn(`参議院 第${session}回の取得に失敗しました。スキップします:`, err);
    }
    await wait(WAIT_MS);

    // 衆議院
    try {
      const html = await fetchText(SHUGIIN_LIST_URL(session), "shift_jis");
      const names = parseShugiinSubmitters(html);
      console.log(`衆議院 第${session}回: ${names.length}件`);
      totalSubmissions += names.length;
      accumulate(acc, names, nameIndex, "衆議院", session, unresolvedNames);
    } catch (err) {
      console.warn(`衆議院 第${session}回の取得に失敗しました。スキップします:`, err);
    }
    await wait(WAIT_MS);
  }

  if (acc.size === 0) {
    throw new Error(
      "議員に紐付く質問主意書を1件も集計できませんでした。ページ構造が想定と異なる可能性があります。"
    );
  }

  const result: WrittenQuestionCount[] = Array.from(acc.values())
    .map((entry) => ({
      legislatorId: entry.legislatorId,
      name: legislatorById.get(entry.legislatorId)?.name ?? "",
      questionCount: entry.questionCount,
      sessionsCovered: Array.from(entry.sessions).sort((a, b) => a - b),
    }))
    // 件数の多寡による並び替え（ランキング的な見せ方）を避け、id順の機械的な並びにする
    .sort((a, b) => a.legislatorId.localeCompare(b.legislatorId));

  const unresolvedTotal = Array.from(unresolvedNames.values()).reduce(
    (sum, n) => sum + n,
    0
  );
  console.log(
    `集計件数: ${result.length}名分（提出件数 計${totalSubmissions}件のうち、現職議員に紐付いたのは${
      totalSubmissions - unresolvedTotal
    }件 / 未紐付け${unresolvedTotal}件 = ${
      totalSubmissions === 0
        ? "0.0"
        : ((unresolvedTotal / totalSubmissions) * 100).toFixed(1)
    }%）`
  );

  if (unresolvedNames.size > 0) {
    // 正規化しても現職議員マスタ（legislators.json）に見つからない提出者名。
    // 大半は引退・落選した元議員と考えられる。件数の多い順に上位30名を出す。
    const sorted = Array.from(unresolvedNames)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    console.log(
      `議員IDに紐付けできなかった提出者名: ${unresolvedNames.size}名（上位${sorted.length}名を表示）。現職議員マスタに存在しない元議員（引退・落選）と推定されます:`
    );
    for (const [name, count] of sorted) {
      console.log(`  - ${name}（${count}件）`);
    }
  }

  await writeDataJson("written-questions.json", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
