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
 *       入っているため、双方から空白文字（\s、全角スペースU+3000を含む）を
 *       除去して正規化キーを作り照合する（fetch-written-questions.tsの
 *       stripNameSpacesと同じ方針）。同姓同名で正規化キーが衝突する場合は
 *       誤結合を避けるためどちらの議員にも紐付けない。
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

/** 氏名の表記ゆれ（全角スペースの数など）を吸収して照合キーを作る */
function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/君$/, "").trim();
}

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
 * legislators.json（参議院）の氏名を正規化キーにして legislatorId を引ける
 * Map を作る。同姓同名で正規化キーが衝突する場合は、誤結合を避けるため
 * どちらの議員にも紐付けない。
 */
function buildNameLookup(legislators: Legislator[]): Map<string, string> {
  const idsByKey = new Map<string, string[]>();
  for (const l of legislators) {
    if (l.chamber !== "参議院") continue;
    const key = normalizeName(l.name);
    const ids = idsByKey.get(key) ?? [];
    ids.push(l.id);
    idsByKey.set(key, ids);
  }
  const lookup = new Map<string, string>();
  for (const [key, ids] of idsByKey) {
    const [onlyId] = ids;
    if (ids.length === 1 && onlyId) {
      lookup.set(key, onlyId);
    } else {
      console.warn(
        `同姓同名（正規化後: "${key}"）の議員が複数いるため名寄せをスキップします: ${ids.join(", ")}`
      );
    }
  }
  return lookup;
}

/** 投票結果ページの会派名からpartyIdを解決する（完全一致→前方一致の順） */
function resolvePartyIdFromHeading(
  heading: string,
  parties: Party[]
): string | null {
  if (!heading) return null;
  const exact = parties.find((p) => p.name === heading);
  if (exact) return exact.id;
  // 旧会派名（例:「自由民主党」→現行「自由民主党・無所属の会」）に対応する
  // ため、現在の会派名が投票当時の会派名を前方一致で含む場合のみ採用する
  const prefixMatch = parties.find(
    (p) => p.name.startsWith(heading) || heading.startsWith(p.name)
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

  const nameLookup = buildNameLookup(legislators);

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
        const key = normalizeName(entry.name);
        const legislatorId = nameLookup.get(key) ?? null;
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
  console.log(
    `取得件数: 投票${votes.length}件（議員個人の賛否レコード計${totalResultCount}件、うち氏名解決済み${resolvedCount}件）`
  );

  await writeDataJson("roll-call-votes.json", votes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
