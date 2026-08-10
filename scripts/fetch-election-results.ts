/**
 * 選挙結果（簡易版）取得スクリプト。
 *
 * データソース: 総務省「選挙関連資料」（候補者別得票数）
 *   https://www.soumu.go.jp/senkyo/senkyo_s/data/
 *
 * 実行: npm run fetch:election-results
 *
 * 調査結果（2026-08-10、実ファイルをダウンロードして確認）:
 *   - 候補者別得票数（＝議員個人の得票数）がExcelで配布されているのは、
 *     現時点で確認できた範囲では「第27回参議院議員通常選挙（2025年7月20日執行）
 *     選挙区」の001027842.xlsx のみ
 *   - 第26回参議院議員通常選挙（2022年）の同等ファイルはPDF配布
 *     （000825874.pdf）、衆議院第50回（2024年）も同様にPDF配布（000979134.pdf）
 *   - つまり現時点では参議院の直近1回（2025年選挙区・約半数の議員）しか
 *     Excelから機械的に取得できない。それ以外（衆議院全体、参議院の
 *     2022年以前に当選した議員、比例代表）はPDFのテキスト抽出が必要で、
 *     このスクリプトのスコープ外（TODO: 別途調査・実装）
 *   - 比例代表（政党名簿登載者別）は選挙区と別ファイル・別レイアウトのため、
 *     今回は選挙区のみを対象にしている（TODO）
 *
 * Excelのレイアウトについて:
 *   - 1シートに新聞のような「左右2段組」で印刷用に組まれた表がそのまま入っている
 *   - 列は [当落,候補者氏名,年齢,党派,新現,職業,得票数] が2セット
 *     （列0-6が左段、列7-13が右段）
 *   - 都道府県の見出し行（例:"北海道  (定数3名)"）はどちらかの段の先頭列にだけ
 *     単独で現れる。見出しの直後からその都道府県の候補者が始まるが、
 *     1つの都道府県の候補者が左段の途中から右段に続くこともあるため、
 *     「左段を最後まで読んでから右段を最後まで読む」という順序で走査しつつ、
 *     現在の都道府県を1つの変数で共有し続ける必要がある（実データで検証済み）
 *   - 候補者の実データ行は「当落」列が"当"または"落"の行だけ
 *     （ふりがな行はそれ以外の値なので自動的にスキップされる）
 *   - データ行の直後の行に「（〜）」という括弧書きの表記が入っていることがあり、
 *     これは通称名（ひらがな等）を使っている候補者の戸籍名であることが多い。
 *   - データ行の直前の行（ふりがな行）には、候補者氏名のうち漢字部分の読みだけが
 *     入っている（既にひらがなの部分は元々ふりがな不要なので空）。そのため
 *     「ふりがな行 + 候補者氏名からひらがな文字だけ抜き出したもの」を連結すると、
 *     議員名簿（giin.json）側の「読み方」列とほぼ同じ文字列になる
 *
 * マッチング戦略（3段階、2026-08-10実測）:
 *   1. 候補者氏名（通称の場合あり）で議員名簿の氏名と完全一致
 *   2. 括弧書きの別表記（戸籍名であることが多い）で氏名と完全一致
 *   3. 上記いずれも合わなければ、読み仮名同士で一致するか試す
 *      （表記は違っても読みが同じ、という通称名パターンをカバーする）
 *   この3段階で2025年参院選（選挙区）の当選者75名中74名（98.7%）がマッチした。
 *   残り1名（読み仮名が姓名ともカタカナ表記で、ふりがな行自体が存在しないケース）
 *   は今回のロジックでは拾えず、既知の限界として残している
 */
import * as XLSX from "xlsx";
import type { ElectionResult, Legislator } from "../src/types";
import { getLegislators } from "./lib/getLegislators";
import { writeDataJson } from "./lib/writeJson";
import { normalizeKanaKey, normalizeNameKey } from "../src/lib/nameMatch";

interface ElectionSource {
  year: number;
  electionType: "選挙区";
  url: string;
}

// TODO: 2022年以前・衆議院・比例代表はPDF調査後に追加する
const ELECTIONS: ElectionSource[] = [
  {
    year: 2025,
    electionType: "選挙区",
    url: "https://www.soumu.go.jp/main_content/001027842.xlsx",
  },
];

interface RawCandidate {
  prefecture: string;
  elected: boolean;
  /** 候補者氏名列の表記（通称名利用時は通称、ひらがな表記の場合あり） */
  ballotName: string;
  /**
   * データ行の直後にある「（〜）」括弧書きの行から取れる表記。
   * 通称名を使っている候補者は、ここに戸籍名（本名）が入っていることが多い
   * （2026-08-10、実データで確認）。無ければballotNameと同じ
   */
  altName: string;
  /**
   * ふりがな行＋候補者氏名中のひらがな文字を連結した読み。
   * 議員名簿の「読み方」列とのマッチングに使う（漢字の表記ゆれに強い）
   */
  reading: string;
  votes: number;
}

function stripSpaces(s: string | undefined): string {
  return (s ?? "").replace(/[　\s]/g, "");
}

function parseVotes(s: string | undefined): number | null {
  if (!s) return null;
  const n = String(s).replace(/[,\s]/g, "");
  return n ? parseInt(n, 10) : null;
}

/** 文字列からひらがな文字だけを抜き出す（U+3040-U+309F） */
function hiraganaOnly(s: string): string {
  return s.replace(/[^぀-ゟ]/g, "");
}

/**
 * 左右2段組シートを「左段を全部読んでから右段を全部読む」順で走査し、
 * 都道府県の現在値を2段またいで共有する。関数外で state を持つのではなく、
 * 呼び出し側から current prefecture の参照を渡してもらう形にしている。
 */
function scanColumn(
  rows: string[][],
  colOffset: number,
  state: { pref: string | null },
  out: RawCandidate[]
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const c0 = (row[colOffset] ?? "").toString().trim();
    const prefMatch = c0.match(/^(.+?[都道府県])\s*[（(]定数\s*(\d+)/);
    if (prefMatch?.[1]) {
      state.pref = prefMatch[1];
      continue;
    }
    if (c0 === "当" || c0 === "落") {
      const votes = parseVotes(row[colOffset + 6]);
      if (state.pref === null || votes === null) continue;
      const ballotName = stripSpaces(row[colOffset + 1]);
      const prevCell = stripSpaces(
        (rows[i - 1]?.[colOffset + 1] ?? "").toString()
      );
      const nextCell = (rows[i + 1]?.[colOffset + 1] ?? "").toString().trim();
      const altMatch = nextCell.match(/^[（(](.+)[）)]$/);
      out.push({
        prefecture: state.pref,
        elected: c0 === "当",
        ballotName,
        altName: altMatch ? stripSpaces(altMatch[1]) : ballotName,
        reading: prevCell + hiraganaOnly(ballotName),
        votes,
      });
    }
  }
}

function parseCandidates(buf: ArrayBuffer): RawCandidate[] {
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  const ws = firstSheetName ? wb.Sheets[firstSheetName] : undefined;
  if (!ws) throw new Error("シートが見つかりません");
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
  });

  const out: RawCandidate[] = [];
  const state = { pref: null as string | null };
  scanColumn(rows, 0, state, out); // 左段（列0-6）を最後まで
  scanColumn(rows, 7, state, out); // 続けて右段（列7-13）。prefは引き継ぐ
  return out;
}

/** 都道府県ごとに得票数降順で順位を振る */
function withRank(
  candidates: RawCandidate[]
): (RawCandidate & { rank: number; totalCandidates: number })[] {
  const byPref = new Map<string, RawCandidate[]>();
  for (const c of candidates) {
    const list = byPref.get(c.prefecture);
    if (list) list.push(c);
    else byPref.set(c.prefecture, [c]);
  }
  const result: (RawCandidate & { rank: number; totalCandidates: number })[] =
    [];
  for (const list of byPref.values()) {
    const sorted = [...list].sort((a, b) => b.votes - a.votes);
    sorted.forEach((c, i) => {
      result.push({ ...c, rank: i + 1, totalCandidates: sorted.length });
    });
  }
  return result;
}

async function main() {
  const legislators = await getLegislators();
  // 名前の表記ゆれ（全角スペースの入れ方など）を吸収するため、
  // 空白除去した氏名でマッチングする。同姓同名がいる場合は誤マッチの
  // リスクがあるため、院・当選種別で絞り込んだ上でマッチングする
  const results: ElectionResult[] = [];

  for (const election of ELECTIONS) {
    const res = await fetch(election.url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${election.url}`);
    const buf = await res.arrayBuffer();
    const candidates = withRank(parseCandidates(buf));

    const pool = legislators.filter(
      (l) => l.chamber === "参議院" && l.electionType === "選挙区"
    );
    // 照合キーの作り方は共通の名寄せモジュール（src/lib/nameMatch.ts）に合わせる。
    // 3段階のマッチ順序（氏名 → 別表記 → 読み仮名）は従来どおり維持する。
    const nameIndex = new Map<string, Legislator>();
    for (const l of pool) nameIndex.set(normalizeNameKey(l.name), l);
    const kanaIndex = new Map<string, Legislator>();
    for (const l of pool) {
      if (l.nameKana) kanaIndex.set(normalizeKanaKey(l.nameKana), l);
    }

    let matched = 0;
    for (const c of candidates) {
      // 3段階でマッチを試みる（詳細はファイル冒頭のコメント参照）。
      // 全て外れた場合は表記ゆれとして現状スキップしている
      const legislator =
        nameIndex.get(normalizeNameKey(c.ballotName)) ??
        nameIndex.get(normalizeNameKey(c.altName)) ??
        kanaIndex.get(normalizeKanaKey(c.reading));
      if (!legislator) continue;
      matched++;
      results.push({
        legislatorId: legislator.id,
        electionYear: election.year,
        electionType: election.electionType,
        district: c.prefecture,
        votes: c.votes,
        rank: c.rank,
        totalCandidates: c.totalCandidates,
        sourceUrl: election.url,
      });
    }
    console.log(
      `${election.year}年${election.electionType}: 候補者${candidates.length}名中、現職議員に${matched}名マッチ`
    );
  }

  await writeDataJson("election-results.json", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
