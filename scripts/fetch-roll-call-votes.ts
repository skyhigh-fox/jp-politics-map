/**
 * 参議院本会議の記名投票（押しボタン式投票）結果を取得するスクリプト。
 *
 * データソース:
 *   - 一覧: https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html
 *     （国会回次ごとに https://www.sangiin.go.jp/japanese/touhyoulist/{回次}/vote_ind.htm
 *     へのリンクが並ぶ）
 *   - 回次ごとの投票結果一覧: https://www.sangiin.go.jp/japanese/touhyoulist/{回次}/vote_ind.htm
 *   - 個々の投票結果: https://www.sangiin.go.jp/japanese/touhyoulist/{回次}/{回次}-{MMDD}-v{通し番号}.htm
 *
 * 実行: npm run fetch:roll-call-votes
 *
 * 【衆議院を対象にしない理由】
 *   衆議院本会議の採決は起立採決が中心で、議員個人の賛否が原則公開されない。
 *   参議院は押しボタン式投票（第142回国会〜）により議員個人の賛否がページ単位で
 *   公開されているため、この機能は参議院限定とする。
 *
 * 実データ確認済み（2026-08-10、WebFetch/curlで直接検証）:
 *   - 一覧ページ（touhyoulist.html）には第142回国会（平成10年）〜最新回次まで
 *     全80回次超のリンクが並ぶ。全件を毎回舐めるのはサイトへの負荷が大きすぎるため、
 *     今回は「直近N回次」のみを対象にする（SESSION_COUNTで調整可能）。
 *   - 各回次の vote_ind.htm には、内閣総理大臣の指名（単記記名投票、複数候補への
 *     配分結果でPDF形式）と、法律案・条約承認・決算等の賛否投票（HTML形式、
 *     押しボタン式投票が大半）の両方へのリンクが混在する。本スクリプトが対象と
 *     するのは後者（.htm）のみ。前者（.pdf）は賛成/反対の二択ではなく候補者への
 *     配分結果という別形式のため対象外とする。
 *   - 1回次あたりの投票件数は会期の長さでばらつきが大きい（実測: 通常国会
 *     ［150日前後］で100〜140件程度、臨時会・特別会の短い会期では数件〜数十件）。
 *     直近8回次（通常国会2回分を含む）で概ね300件程度になる想定で、全件取得は
 *     現実的な量。
 *   - ページの文字コードは実際にはUTF-8（<meta charset="utf-8">、参議院の
 *     他ページ同様Shift_JISではない）。
 *   - 投票結果ページのHTML構造（#ContentsBox配下）:
 *     - `<h2 class="kaiji_nichiji">第221回国会<br>2026年 7月 24日<br>投票結果</h2>`
 *       → 西暦表記のためReiwa換算不要。テキストから正規表現で年月日を抽出する。
 *     - `<dl class="ankenmei"><dt>案件名：</dt><dd>日程第１　○○法律案（衆議院提出）</dd></dl>`
 *       → 議案名。先頭の「日程第○」と末尾の提出者情報の括弧を取り除いた文字列は
 *       多くの場合 bills.json の title と一致する（法律案・条約承認等）。
 *     - `<h3 class="tohyosousu">投票総数　243<br><span>賛成票　227　　　反対票　16</span></h3>`
 *       → 賛成・反対の総数（検証用にそのまま保持）。
 *     - `<h4 class="party">自由民主党・無所属の会(101名)</h4>` と直後の
 *       `<dl class="sanpilist">...</dl>` が会派ごとに繰り返される兄弟要素。
 *       会派名は投票当時の名称（例: 旧「自由民主党」、現「自由民主党・無所属の会」）
 *       であり、必ずしも parties.json の現在の名称と一致しないため、完全一致→
 *       前方一致の順でフォールバックし、それでも解決できない場合のみ議員個人の
 *       現在の所属会派（legislators.json）で代替する。
 *     - 議員1名 = `<li class="giin">` 1件。観測されたパターンは3種類のみ:
 *       (1) `<span class="pros">賛成</span><span class="cons"></span>` → 賛成
 *       (2) `<span class="pros"></span><span class="cons">反対</span>` → 反対
 *       (3) `<span class="novote">...投票なし...</span>` → 欠席として扱う
 *       （棄権を示す別パターンは確認できなかったが、型としては許容しておく）
 *     - 氏名は `<span class="names">` に入るが、姓名間の全角スペースの数が
 *       不揃い（表示上の桁揃え）。legislators.json 側も姓名間に全角スペースが
 *       入っているため、共通の名寄せモジュール（src/lib/nameMatch.ts）で
 *       正規化キーを作って照合する。同姓同名で正規化キーが衝突する場合は
 *       誤結合を避けるためどちらの議員にも紐付けない。
 *
 * 【院をまたぐ照合について】
 *   対象は参議院の投票だが、投票当時は参議院議員でも、その後の選挙で
 *   衆議院に鞍替えして現在は衆議院議員として legislators.json に載っている
 *   議員がいる（実測で12名・約860レコード）。そのため名寄せは
 *   「参議院で一意 → 院を問わず一意」の順にフォールバックする
 *   （src/lib/nameMatch.ts の resolveName の allowCrossChamber）。
 *   それでも解決できない氏名は、現職議員マスタに存在しない元議員
 *   （引退・落選）と考えられるため、次の作業者が追えるよう末尾に一覧をログ出力する。
 */
import * as cheerio from "cheerio";
import type {
  Bill,
  Legislator,
  Party,
  RollCallVote,
  RollCallVoteChoice,
  RollCallVoteResult,
} from "../src/types";
import { writeDataJson } from "./lib/writeJson";
import { buildNameIndex, resolveName } from "../src/lib/nameMatch";
import { readFile } from "node:fs/promises";
import path from "node:path";

// 直近何回次を対象にするか。全回次（第142回〜）を毎回舐めるとサイトへの
// 負荷が大きいため範囲を絞る。将来広げる場合はこの値を増やすだけでよい。
const SESSION_COUNT = 8;

// 万一「現在の回次」の自動検出に失敗した場合のフォールバック
// （2026-08-10時点で確認した回次。老朽化したら手動で更新する）
const FALLBACK_LATEST_SESSION = 221;

const TOUHYOULIST_INDEX_URL =
  "https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html";
const VOTE_INDEX_URL = (session: number) =>
  `https://www.sangiin.go.jp/japanese/touhyoulist/${session}/vote_ind.htm`;
const SESSION_BASE_URL = (session: number) =>
  `https://www.sangiin.go.jp/japanese/touhyoulist/${session}/`;

const WAIT_MS = 400;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  // 参議院サイトはUTF-8（他ページと同様、Shift_JISではないことを確認済み）
  return new TextDecoder("utf-8").decode(buf);
}

/** 一覧ページ（touhyoulist.html）から現在の最新回次番号を検出する */
async function detectLatestSession(): Promise<number> {
  try {
    const html = await fetchText(TOUHYOULIST_INDEX_URL);
    const match = html.match(/第(\d+)回国会/);
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

interface VoteLink {
  url: string;
  voteId: string;
}

/**
 * 回次ごとの投票結果一覧ページ（vote_ind.htm）から、個々の投票結果ページへの
 * リンクを抽出する。内閣総理大臣の指名等（.pdf形式、賛成/反対の二択ではない）
 * は対象外とし、法律案等の賛否投票（.htm形式）のみを拾う。
 */
function parseVoteIndex(html: string, session: number): VoteLink[] {
  const $ = cheerio.load(html);
  const links: VoteLink[] = [];
  const base = SESSION_BASE_URL(session);
  $("table.touhyo_index a").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    if (!href.toLowerCase().endsWith(".htm")) return; // .pdf(総理指名等)は対象外
    const url = new URL(href, base).toString();
    const voteId = href.replace(/\.htm$/i, "");
    links.push({ url, voteId });
  });
  return links;
}

/** 会派名の末尾についている「(◯◯名)」を取り除く */
function stripPartyCount(rawPartyHeading: string): string {
  return rawPartyHeading.replace(/[（(]\s*\d+\s*名\s*[）)]\s*$/, "").trim();
}

/** 議案名の先頭「日程第○」と末尾の提出者情報の括弧を取り除く */
function normalizeSubjectForBillMatch(subject: string): string {
  return subject
    .replace(/^日程第[0-9０-９]+\s*/, "")
    .replace(/\s*[（(][^（）()]*[）)]\s*$/, "")
    .trim();
}

interface ParsedVotePage {
  session: number;
  date: string;
  subject: string;
  totalFor: number;
  totalAgainst: number;
  entries: { partyHeading: string; name: string; vote: RollCallVoteChoice }[];
}

/** 個々の投票結果ページ（xxx-xxxx-vxxx.htm）をパースする */
function parseVotePage(html: string): ParsedVotePage | null {
  const $ = cheerio.load(html);
  const contentsBox = $("#ContentsBox");

  const kaijiText = contentsBox.find("h2.kaiji_nichiji").text();
  const sessionMatch = kaijiText.match(/第(\d+)回国会/);
  const dateMatch = kaijiText.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!sessionMatch || !dateMatch) return null;
  const session = Number(sessionMatch[1]);
  const [, y, m, d] = dateMatch;
  const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const subject = contentsBox.find("dl.ankenmei dd").first().text().trim();

  const totalsText = contentsBox.find("h3.tohyosousu").text();
  const forMatch = totalsText.match(/賛成票\s*(\d+)/);
  const againstMatch = totalsText.match(/反対票\s*(\d+)/);
  const totalFor = forMatch ? Number(forMatch[1]) : 0;
  const totalAgainst = againstMatch ? Number(againstMatch[1]) : 0;

  const entries: ParsedVotePage["entries"] = [];
  let currentPartyHeading = "";
  contentsBox.children().each((_, el) => {
    const node = $(el);
    if (node.is("h4.party")) {
      currentPartyHeading = stripPartyCount(node.text());
      return;
    }
    if (!node.is("dl.sanpilist")) return;
    node.find("li.giin").each((_, li) => {
      const liNode = $(li);
      const name = liNode.find("span.names").text().trim();
      if (!name) return;
      const prosText = liNode.find("span.pros").text().trim();
      const consText = liNode.find("span.cons").text().trim();
      const hasNovote = liNode.find("span.novote").length > 0;
      let vote: RollCallVoteChoice;
      if (prosText === "賛成") vote = "賛成";
      else if (consText === "反対") vote = "反対";
      else if (hasNovote) vote = "欠席";
      else return; // 想定外パターンはスキップ（誤集計を避ける）
      entries.push({ partyHeading: currentPartyHeading, name, vote });
    });
  });

  return { session, date, subject, totalFor, totalAgainst, entries };
}

/**
 * 投票結果ページの会派名からpartyIdを解決する（完全一致→前方一致の順）。
 *
 * 記名投票は参議院のみが対象のため、照合には parties.json の共通表示名ではなく
 * 「参議院の正式会派名」（Party.chambers.参議院.name）を優先して使う。
 * 共通表示名は院に依存しない母体政党名（例:「国民民主党」）であり、投票結果ページの
 * 会派表記（例:「国民民主党・新緑風会」）とは一致しないため、そのままでは
 * 前方一致に頼ることになり誤マッチのリスクがある。
 */
function partyNameCandidates(party: Party): string[] {
  const sangiin = party.chambers?.["参議院"];
  // 参議院会派名 → 共通表示名 の順（先に評価されたものが優先される）
  return [sangiin?.name, party.name].filter((v): v is string => Boolean(v));
}

function resolvePartyIdFromHeading(
  heading: string,
  parties: Party[]
): string | null {
  if (!heading) return null;
  const exact = parties.find((p) => partyNameCandidates(p).includes(heading));
  if (exact) return exact.id;
  // 旧会派名（例:「自由民主党」→現行「自由民主党・無所属の会」）に対応する
  // ため、現在の会派名が投票当時の会派名を前方一致で含む場合のみ採用する
  const prefixMatch = parties.find((p) =>
    partyNameCandidates(p).some(
      (name) => name.startsWith(heading) || heading.startsWith(name)
    )
  );
  return prefixMatch ? prefixMatch.id : null;
}

/**
 * 議案名からbills.json内の該当法案を突合する。dietSessionが一致し、かつ
 * 正規化した議案名が完全一致する場合のみ採用する（複数一致・不一致はnull）。
 */
function resolveBillId(
  subject: string,
  session: number,
  bills: Bill[]
): string | null {
  const normalized = normalizeSubjectForBillMatch(subject);
  if (!normalized) return null;
  const candidates = bills.filter(
    (b) => b.dietSession === session && b.title === normalized
  );
  if (candidates.length === 1) return candidates[0]!.id;
  return null;
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const legislators = JSON.parse(
    await readFile(path.join(dataDir, "legislators.json"), "utf-8")
  ) as Legislator[];
  const parties = JSON.parse(
    await readFile(path.join(dataDir, "parties.json"), "utf-8")
  ) as Party[];
  const bills = JSON.parse(
    await readFile(path.join(dataDir, "bills.json"), "utf-8")
  ) as Bill[];
  const legislatorById = new Map(legislators.map((l) => [l.id, l]));

  // 名寄せ用インデックス（src/lib/nameMatch.ts）。院は絞らず全議員で作り、
  // 照合時に「参議院を優先、見つからなければ他院」の順で解決する。
  const nameIndex = buildNameIndex(legislators);
  // 解決できなかった氏名（現職議員マスタに存在しない元議員が大半のはず）を
  // 集計して最後にまとめてログ出力する
  const unresolvedNames = new Map<string, number>();
  // 鞍替え等で他院として解決した氏名（誤結合の可能性を後から検証できるように）
  const crossChamberNames = new Map<string, string>();

  const latestSession = await detectLatestSession();
  const sessions: number[] = [];
  for (let s = latestSession; s > latestSession - SESSION_COUNT; s--) {
    sessions.push(s);
  }
  console.log(
    `対象回次: 第${sessions[sessions.length - 1]}回〜第${sessions[0]}回（計${sessions.length}回次）`
  );

  const votes: RollCallVote[] = [];

  for (const session of sessions) {
    let indexHtml: string;
    try {
      indexHtml = await fetchText(VOTE_INDEX_URL(session));
    } catch (err) {
      console.warn(`第${session}回の投票結果一覧の取得に失敗しました。スキップします:`, err);
      continue;
    }
    const links = parseVoteIndex(indexHtml, session);
    console.log(`第${session}回国会: 対象投票 ${links.length}件`);
    await wait(WAIT_MS);

    for (const link of links) {
      let html: string;
      try {
        html = await fetchText(link.url);
      } catch (err) {
        console.warn(`投票結果ページの取得に失敗しました。スキップします: ${link.url}`, err);
        await wait(WAIT_MS);
        continue;
      }
      await wait(WAIT_MS);

      const parsed = parseVotePage(html);
      if (!parsed || parsed.entries.length === 0) {
        console.warn(`投票結果のパースに失敗、または0件でした。スキップします: ${link.url}`);
        continue;
      }

      const results: RollCallVoteResult[] = parsed.entries.map((entry) => {
        const resolved = resolveName(nameIndex, entry.name, {
          chamber: "参議院",
        });
        const legislatorId = resolved.id;
        if (!legislatorId) {
          unresolvedNames.set(
            entry.name,
            (unresolvedNames.get(entry.name) ?? 0) + 1
          );
        } else if (resolved.method !== "name") {
          crossChamberNames.set(entry.name, `${legislatorId}（${resolved.method}）`);
        }
        const partyId =
          resolvePartyIdFromHeading(entry.partyHeading, parties) ??
          (legislatorId
            ? (legislatorById.get(legislatorId)?.currentPartyId ?? null)
            : null);
        return {
          legislatorId,
          name: entry.name,
          partyId,
          vote: entry.vote,
        };
      });

      votes.push({
        voteId: link.voteId,
        session: parsed.session,
        date: parsed.date,
        subject: parsed.subject,
        billId: resolveBillId(parsed.subject, parsed.session, bills),
        totalFor: parsed.totalFor,
        totalAgainst: parsed.totalAgainst,
        results,
        sourceUrl: link.url,
      });
    }
  }

  if (votes.length === 0) {
    throw new Error(
      "記名投票結果を1件も取得できませんでした。ページ構造が想定と異なる可能性があります。"
    );
  }

  votes.sort((a, b) => a.voteId.localeCompare(b.voteId));

  const resolvedCount = votes.reduce(
    (sum, v) => sum + v.results.filter((r) => r.legislatorId).length,
    0
  );
  const totalResultCount = votes.reduce((sum, v) => sum + v.results.length, 0);
  const unresolvedCount = totalResultCount - resolvedCount;
  console.log(
    `取得件数: 投票${votes.length}件（議員個人の賛否レコード計${totalResultCount}件、うち氏名解決済み${resolvedCount}件 / 未解決${unresolvedCount}件 = ${
      totalResultCount === 0
        ? "0.0"
        : ((unresolvedCount / totalResultCount) * 100).toFixed(1)
    }%）`
  );

  if (crossChamberNames.size > 0) {
    console.log(
      `他院・異体字・かなでのフォールバックにより解決した議員 ${crossChamberNames.size}名（投票当時は参議院議員だが現在は衆議院議員、等）:`
    );
    for (const [name, info] of crossChamberNames) {
      console.log(`  - ${name} → ${info}`);
    }
  }

  if (unresolvedNames.size > 0) {
    // 正規化しても現職議員マスタ（legislators.json）に見つからない氏名。
    // 大半は引退・落選した元参議院議員と考えられる。元議員マスタを持つ
    // データソースを追加する際は、この一覧が出発点になる。
    const sorted = Array.from(unresolvedNames).sort((a, b) => b[1] - a[1]);
    console.log(
      `議員IDに紐付けできなかった氏名: ${sorted.length}名（レコード計${unresolvedCount}件）。現職議員マスタに存在しない元議員（引退・落選）と推定されます:`
    );
    for (const [name, count] of sorted) {
      console.log(`  - ${name}（${count}件）`);
    }
  }

  await writeDataJson("roll-call-votes.json", votes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
