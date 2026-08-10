/**
 * 法案の提出者・提出会派・衆議院審議時の賛成/反対会派を取得するスクリプト
 * （機能拡充ロードマップ Tier1 #3「法案の提出者・賛成会派・反対会派表示」）。
 *
 * データソース: SmartNews メディア研究所「国会議案データベース：衆議院」
 *   https://github.com/smartnews-smri/house-of-representatives （MITライセンス）
 *   出典表記: 「スマートニュース メディア研究所」または「SmartNews Media Research Institute」
 *   （原典は衆議院公式サイトの議案経過情報ページ）
 *
 * 実行: npm run fetch:bill-sponsorships
 *   前提: data/legislators.json・data/parties.json が存在すること
 *   （議員IDの名寄せ・会派IDの照合に使うため。fetch:all では議員取得の後に走る）
 *
 * 【スコープの判断（重要）】
 *   当初は「衆議院公式の議案経過ページを法案ごとにスクレイピングする必要が
 *   あるかもしれない（その場合は直近回次に絞る）」と想定していたが、実データを
 *   確認したところ、fetch-bills.ts が既に取得している gian.json 自体に
 *   以下7列が最初から含まれていた:
 *     議案提出者 / 議案提出者一覧 / 議案提出の賛成者 / 議案提出会派 /
 *     衆議院審議時会派態度 / 衆議院審議時賛成会派 / 衆議院審議時反対会派
 *   そのため衆議院サイトへの追加アクセスは一切不要で、回次を絞る理由もない。
 *   bills.json と同じ全期間（第139回国会〜）・全6,985法案を対象にする。
 *
 * 実データ確認済み（2026-08-11、Node.jsから直接fetchして検証。11,620行 / 6,985法案）:
 *   - 「議案提出者」は11,519行に記載があり、内閣提出法案では「内閣」、議員立法では
 *     「熊代　昭彦君外四名」のような代表者＋人数の表記になる。
 *   - 「議案提出者一覧」「議案提出の賛成者」は衆法・決議・規則等（＝衆議院に
 *     発議された議員立法）にのみ記載がある。参法・閣法・条約等には記載がない
 *     （衆議院のDBであり、参議院に発議された議案の発議者は収録されていない）。
 *     法案単位では 提出者一覧1,947件 / 賛成者1,467件。
 *   - 「衆議院審議時賛成会派」は衆議院本会議で採決に至った議案のみ（法案単位1,557件）。
 *     反対会派は反対があった議案のみ（同967件）。全会一致の場合は反対会派が空になる。
 *   - 区切り文字は原則「; 」だが、「議案提出会派」列にのみ全角セミコロン「；」で
 *     区切られた行が混在する。両方を区切りとして扱う。
 *   - 1法案が複数行（掲載回次違い）にまたがるとき、継続審査中に提出者が交代したり
 *     賛成者が増減したりして値が食い違う行がある（提出者142件・賛成者448件）。
 *     bills.json 側が「掲載回次が最も新しい行」を現在の状態の代表として採用して
 *     いるため、こちらも同じ行を優先し、その行が空欄の場合のみ古い行へ遡る。
 *     出典URLも同じ行の経過情報URLを使い、表示内容とリンク先が食い違わないようにする。
 *
 * 【中立性の方針（重要）】
 *   原資料の「誰が提出し、どの会派が賛成・反対したか」という事実を転記するだけに
 *   留める。議員間の共同提案ネットワーク図や、会派の賛否パターンからイデオロギー・
 *   スコアのような合成指標を作ることはしない（提出者・賛成者に名を連ねる理由は
 *   多様であり、政治的立場の指標として扱うと誤導になるため）。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  BillSponsorParty,
  BillSponsorPerson,
  BillSponsorship,
  Legislator,
  Party,
} from "../src/types";
import { writeDataJson } from "./lib/writeJson";
import { rowsToObjects } from "./lib/csvJson";
import { billIdFromKey, billKey } from "./lib/gianBillKey";
import { buildNameIndex, resolveName, type NameIndex } from "../src/lib/nameMatch";

const GIAN_URL =
  "https://raw.githubusercontent.com/smartnews-smri/house-of-representatives/main/data/gian.json";

/** このスクリプトが使う列だけを宣言する（fetch-bills.ts の RawGian とは担当が別） */
interface RawGianSponsorship {
  掲載回次: string;
  提出回次?: string;
  議案種類?: string;
  番号?: string;
  議案件名?: string;
  経過情報URL?: string;
  本文情報URL?: string;
  議案提出者?: string;
  議案提出者一覧?: string;
  議案提出の賛成者?: string;
  議案提出会派?: string;
  衆議院審議時会派態度?: string;
  衆議院審議時賛成会派?: string;
  衆議院審議時反対会派?: string;
}

/**
 * 「A君; B君; C君」形式の列を分解する。
 * 「議案提出会派」列には全角セミコロン区切りの行が混在するため両方を扱う。
 */
function splitList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 議案種類から、提出者の氏名を照合すべき院を決める。
 * 衆法・決議・規則等は衆議院に発議された議案なので発議者は衆議院議員。
 * 参法は参議院議員だが、そもそも衆議院のDBに発議者一覧は載っていない。
 * 判別できない種類は院を絞らず全議員から照合する（undefinedを返す）。
 */
function sponsorChamber(category: string | undefined): string | undefined {
  if (!category) return undefined;
  if (category.startsWith("参法")) return "参議院";
  if (category.startsWith("閣法") || category.startsWith("条約")) return undefined;
  return "衆議院";
}

/**
 * 会派名の照合に使う候補名。
 * 対象は衆議院の議案経過情報なので、衆議院の正式会派名を最優先し、
 * 次に院に依存しない共通表示名（母体政党名）を見る。
 */
function partyNameCandidates(party: Party): string[] {
  return [party.chambers?.["衆議院"]?.name, party.name].filter(
    (v): v is string => Boolean(v)
  );
}

/** 会派名の区切りとみなす文字（前方一致の誤マッチを防ぐための境界判定に使う） */
const PARTY_NAME_BOUNDARY_RE = /[・／/\s]/;

/**
 * `longer` が `shorter` で始まり、かつ続く文字が会派名の区切り文字であるか。
 *
 * 単純な startsWith だけで前方一致を許すと、「無所属の会」（2000年代に実在した
 * 会派名）が「無所属」（無所属議員のグループ）に誤マッチする。区切り文字での
 * 境界を要求することで、「自由民主党」→「自由民主党・無所属の会」のような
 * 正しい前方一致だけを残す。
 */
function isPrefixAtBoundary(longer: string, shorter: string): boolean {
  if (longer === shorter) return true;
  if (!longer.startsWith(shorter)) return false;
  return PARTY_NAME_BOUNDARY_RE.test(longer.charAt(shorter.length));
}

/**
 * 会派名からpartyIdを解決する（完全一致→区切り境界での前方一致の順）。
 *
 * 収録範囲が第139回国会（1997年）以降と長いため、会派名の大半は既に解散・改称
 * している（新進党・民主党・みんなの党 等）。後継関係が曖昧な会派を現在の政党へ
 * 無理に寄せると誤った同一視になるため、解決できない場合はnullのまま
 * 当時の会派名だけを保持する（PartySeatResult と同じ方針）。
 */
function resolvePartyId(name: string, parties: Party[]): string | null {
  if (!name) return null;
  const exact = parties.find((p) => partyNameCandidates(p).includes(name));
  if (exact) return exact.id;
  const prefixMatch = parties.find((p) =>
    partyNameCandidates(p).some(
      (candidate) =>
        isPrefixAtBoundary(candidate, name) || isPrefixAtBoundary(name, candidate)
    )
  );
  return prefixMatch ? prefixMatch.id : null;
}

interface ResolveStats {
  personTotal: number;
  personResolved: number;
  unresolvedNames: Map<string, number>;
  partyTotal: number;
  partyResolved: number;
  unresolvedParties: Map<string, number>;
}

function toPersons(
  rawList: string[],
  nameIndex: NameIndex,
  chamber: string | undefined,
  stats: ResolveStats
): BillSponsorPerson[] {
  return rawList.map((name) => {
    const resolved = resolveName(nameIndex, name, { chamber });
    stats.personTotal += 1;
    if (resolved.id) stats.personResolved += 1;
    else stats.unresolvedNames.set(name, (stats.unresolvedNames.get(name) ?? 0) + 1);
    return { name, legislatorId: resolved.id };
  });
}

function toParties(
  rawList: string[],
  parties: Party[],
  stats: ResolveStats
): BillSponsorParty[] {
  return rawList.map((name) => {
    const partyId = resolvePartyId(name, parties);
    stats.partyTotal += 1;
    if (partyId) stats.partyResolved += 1;
    else
      stats.unresolvedParties.set(
        name,
        (stats.unresolvedParties.get(name) ?? 0) + 1
      );
    return { name, partyId };
  });
}

async function readDataJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(process.cwd(), "data", fileName);
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

async function main() {
  const [legislators, parties] = await Promise.all([
    readDataJson<Legislator[]>("legislators.json"),
    readDataJson<Party[]>("parties.json"),
  ]);
  // 名寄せ用インデックス（src/lib/nameMatch.ts）。院は絞らずに構築し、
  // 照合時に「議案が発議された院を優先 → 院を問わず一意」の順で解決する。
  const nameIndex = buildNameIndex(legislators);

  const res = await fetch(GIAN_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const rows = (await res.json()) as unknown[][];
  const gianList = rowsToObjects<RawGianSponsorship>(rows);

  // 1法案が複数行（掲載回次違い）にまたがるため、bills.json と同じキーでまとめる
  const groups = new Map<string, RawGianSponsorship[]>();
  for (const g of gianList) {
    const key = billKey(g);
    const list = groups.get(key);
    if (list) list.push(g);
    else groups.set(key, [g]);
  }

  const stats: ResolveStats = {
    personTotal: 0,
    personResolved: 0,
    unresolvedNames: new Map(),
    partyTotal: 0,
    partyResolved: 0,
    unresolvedParties: new Map(),
  };

  const sponsorships: BillSponsorship[] = [];

  for (const [key, groupRows] of groups) {
    const sorted = [...groupRows].sort(
      (a, b) => Number(a.掲載回次) - Number(b.掲載回次)
    );

    /**
     * 互いに関係する欄をまとめて「同じ1行から」採るための代表行を選ぶ。
     *
     * 掲載回次が新しい行を優先する（bills.json が「最も新しい行」を現在の状態の
     * 代表としているのに合わせる）。欄ごとに別々の行から値を拾うと、
     *   - 継続審査中に提出者・賛成者が入れ替わった議案
     *   - 「番号」を持たない議案種類（承諾・決算・国有財産等）で複数の議案が
     *     同じ billKey にまとまってしまう既知のケース（6,985件中121件）
     * で、賛成会派と反対会派に同じ会派が並ぶといった矛盾した組み合わせが
     * 生じうる。関連する欄は同一行から採ることで、少なくとも表示される
     * 組み合わせが原資料のどこかの行と一致する状態を保つ。
     */
    function pickRow(
      fields: (keyof RawGianSponsorship)[]
    ): RawGianSponsorship | null {
      for (let i = sorted.length - 1; i >= 0; i--) {
        const row = sorted[i]!;
        if (fields.some((f) => String(row[f] ?? "").trim())) return row;
      }
      return null;
    }
    const value = (
      row: RawGianSponsorship | null,
      field: keyof RawGianSponsorship
    ) => String(row?.[field] ?? "").trim();

    // 提出時の情報（提出者・提出者一覧・提出の賛成者・提出会派）は同じ行から採る
    const submissionRow = pickRow([
      "議案提出者",
      "議案提出者一覧",
      "議案提出の賛成者",
      "議案提出会派",
    ]);
    // 衆議院審議時の情報（会派態度・賛成会派・反対会派）も同じ行から採る。
    // 反対会派は全会一致の議案では空欄になるため、賛成会派・態度を手掛かりにする
    const deliberationRow = pickRow([
      "衆議院審議時賛成会派",
      "衆議院審議時会派態度",
      "衆議院審議時反対会派",
    ]);

    const submitterLabel = value(submissionRow, "議案提出者");
    const sponsorList = value(submissionRow, "議案提出者一覧");
    const supporterList = value(submissionRow, "議案提出の賛成者");
    const submitterPartyList = value(submissionRow, "議案提出会派");
    const stance = value(deliberationRow, "衆議院審議時会派態度");
    const approvingList = value(deliberationRow, "衆議院審議時賛成会派");
    const opposingList = value(deliberationRow, "衆議院審議時反対会派");

    // どの欄にも記載がない議案（＝転記できる事実が無い）はレコード自体を作らない。
    // 「データが無いこと」は法案詳細ページ側で収録範囲の注記として説明する。
    if (!submissionRow && !deliberationRow) continue;

    const latest = sorted.at(-1)!;
    const chamber = sponsorChamber(latest.議案種類);

    sponsorships.push({
      billId: billIdFromKey(key),
      submitterLabel: submitterLabel || null,
      sponsors: toPersons(splitList(sponsorList), nameIndex, chamber, stats),
      supporters: toPersons(splitList(supporterList), nameIndex, chamber, stats),
      submitterParties: toParties(splitList(submitterPartyList), parties, stats),
      houseVoteStance: stance || null,
      approvingParties: toParties(splitList(approvingList), parties, stats),
      opposingParties: toParties(splitList(opposingList), parties, stats),
      // bills.json と同じ「最も新しい行」の経過情報URLを出典にする
      // （法案詳細ページ上部の情報源リンクと食い違わないようにするため）
      sourceUrl: latest.経過情報URL || latest.本文情報URL || "",
    });
  }

  if (sponsorships.length === 0) {
    throw new Error(
      "提出者・会派情報を1件も取得できませんでした。gian.jsonの列構成を確認してください。"
    );
  }

  const withSponsors = sponsorships.filter((s) => s.sponsors.length > 0).length;
  const withSupporters = sponsorships.filter((s) => s.supporters.length > 0).length;
  const withApproving = sponsorships.filter(
    (s) => s.approvingParties.length > 0
  ).length;
  const withOpposing = sponsorships.filter((s) => s.opposingParties.length > 0).length;
  console.log(
    `取得件数: ${sponsorships.length}件 / ${groups.size}法案` +
      `（提出者一覧あり${withSponsors}件・提出の賛成者あり${withSupporters}件・` +
      `衆議院審議時賛成会派あり${withApproving}件・同反対会派あり${withOpposing}件）`
  );
  console.log(
    `氏名→議員ID: 延べ${stats.personTotal}件中${stats.personResolved}件を解決（未解決の氏名 ${stats.unresolvedNames.size}名）。` +
      `未解決の大半は現職議員マスタに存在しない元議員です。`
  );
  console.log(
    `会派名→政党ID: 延べ${stats.partyTotal}件中${stats.partyResolved}件を解決（未解決の会派名 ${stats.unresolvedParties.size}件）。` +
      `未解決の大半は既に解散・改称した当時の会派です。`
  );

  // 次の作業者が追えるよう、未解決の会派名は全件出す（69件程度と少ないため）。
  // 氏名は1,000名規模になるため上位のみ。
  const topUnresolvedNames = Array.from(stats.unresolvedNames)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  if (topUnresolvedNames.length > 0) {
    console.log("議員IDに紐付けできなかった氏名（登場回数上位20名）:");
    for (const [name, count] of topUnresolvedNames) {
      console.log(`  - ${name}（${count}件）`);
    }
  }
  if (stats.unresolvedParties.size > 0) {
    console.log("政党IDに紐付けできなかった会派名:");
    for (const [name, count] of Array.from(stats.unresolvedParties).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  - ${name}（${count}件）`);
    }
  }

  await writeDataJson("bill-sponsorships.json", sponsorships);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
