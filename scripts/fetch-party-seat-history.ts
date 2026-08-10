/**
 * 過去選挙の「政党別獲得議席数」推移を取得するスクリプト。
 *
 * 背景・スコープ（重要）:
 *   scripts/fetch-election-results.ts は候補者「個人」の得票数を対象としているが、
 *   総務省の元データはExcel配布のものが限られ（2025年参院選挙区のみ）、氏名表記
 *   ゆれのマッチング問題もあるため候補者単位のデータは現状その1回に限定されている。
 *   本スクリプトはそれとは別の、もっと粒度の粗いデータ（選挙ごとの政党別獲得議席数
 *   という「集計済みの事実」だけ）を対象にする。候補者名マッチングの問題を回避できる。
 *
 * データソース調査（2026-08-10）:
 *   - 総務省「選挙関連資料」の各選挙結果ページ（例:
 *     https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin49/index.html）を確認したが、
 *     政党別の獲得議席数を単独でまとめた集計表（Excel/PDF）は提供されていない
 *     （候補者別・市区町村別のデータはあるが、政党集計は自分で数える必要がある）
 *   - SmartNews メディア研究所のリポジトリ（house-of-representatives /
 *     house-of-councillors、既に議案データ取得で使用中）も確認したが、収録データは
 *     議案（gian）・議員名簿（giin）・会派名一覧（kaiha）・質問主意書（syuisyo）のみで、
 *     選挙ごとの政党別獲得議席数の集計データは含まれていない
 *   - そのため、CLAUDE.mdで指示されている代替方針に従い、Wikipedia日本語版の各選挙
 *     結果記事（「党派別獲得議席数」表）を情報源として採用した。Wikipediaの内容は
 *     CC BY-SA 4.0 でライセンスされており、二次利用には出典表記（記事タイトル・URL・
 *     ライセンス名）が必要。本データはそのまま転記した事実データ（議席数）のみを
 *     抽出しており、文章の改変・要約ではない。出典表記は下記 sourceUrl フィールド
 *     （記事URL）および Obsidian Vault データソース調査.md に記載している
 *   - 各選挙の政党別獲得議席数の合計が、当該選挙で選出された議席の総数（衆議院は
 *     総定数、参議院は改選議席数）と一致することを確認済み（本スクリプト内でも
 *     assertValidElection() で検証し、不一致なら例外を投げる）
 *   - 追記（2026-08-11）: 第51回衆議院議員総選挙（2026-02-08執行）については、総務省
 *     「令和8年2月8日執行 衆議院議員総選挙・最高裁判所裁判官国民審査 速報結果」
 *     3.開票結果 (1)「届出政党等別男女別新前元別当選人数（小選挙区、比例代表）」
 *     （https://www.soumu.go.jp/main_content/001061475.xlsx）という一次情報の
 *     Excelが提供されていたため、この回だけは総務省の数値をそのまま採用している
 *     （Wikipediaの同記事の表は無所属当選者の追加公認1名分を自由民主党に含めて
 *     自民316・無所属4としているが、それは選挙結果そのものではなく事後の追加公認を
 *     反映した数値であり、他の回（例: 第50回の自民191）と数え方が揃わないため）
 *
 * 対象範囲:
 *   衆議院: 第46回(2012)〜第51回(2026) の直近6回
 *   参議院: 第23回(2013)〜第27回(2025) の直近5回（通常選挙）
 *
 * データの性質について（重要）:
 *   Wikipediaの表は記事更新のたびに変わりうる「生きた情報源」であり、本スクリプトは
 *   API等からの自動スクレイピングではなく、上記記事を人手で確認して転記した固定データを
 *   保持している（Wikipediaのテーブル構造は記事ごとに列構成・脚注・rowspanの使い方が
 *   異なり、機械的パースが脆弱なため）。記事が更新された場合は、このファイル内の
 *   ELECTIONS 定数を再調査のうえ手動で更新すること。
 *
 * 政党idの解決について:
 *   党名（原資料表記）→ 現行 data/parties.json の id への変換は、
 *   scripts/lib/partyColors.ts の PARTY_ALIASES / resolvePartyId を再利用しつつ、
 *   本スクリプト内の PARTY_FULL_NAME_TO_ABBR で「正式名称→略称」変換を追加している
 *   （衆参の元データが略称ベースなのに対し、過去選挙の集計表は正式名称ベースのため）。
 *   解散・改名等で現行政党に対応がつかない政党（例:「民主党」「みんなの党」など）は
 *   無理に統合せず、partyName に原資料表記を保持したまま partyId: null とする。
 *
 * 実行: npm run fetch:party-seat-history
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Party, PartySeatHistory, PartySeatResult } from "../src/types";
import { resolvePartyId } from "./lib/partyColors";
import { writeDataJson } from "./lib/writeJson";

/** 過去選挙の正式政党名 → 現行の会派略称（resolvePartyIdへの入力）。対応不明な党は含めない */
const PARTY_FULL_NAME_TO_ABBR: Record<string, string> = {
  自由民主党: "自民",
  公明党: "公明",
  日本維新の会: "維新",
  おおさか維新の会: "維新", // 2016年に「日本維新の会」へ改称した同一政党
  中道改革連合: "中道", // PARTY_ALIASESの対象外。resolvePartyIdで party-中道 に解決される
  日本共産党: "共産",
  社会民主党: "社民",
  立憲民主党: "立憲",
  国民民主党: "国民", // PARTY_ALIASESで party-民主（国民民主党・新緑風会）に解決される
  れいわ新選組: "れ新",
  参政党: "参政",
  日本保守党: "保守",
  チームみらい: "みらい", // PARTY_ALIASESで party-みら に解決される
  無所属: "無", // PARTY_ALIASESで party-無所属 に解決される
};

interface RawSeatEntry {
  partyName: string;
  seats: number;
}

interface RawElection {
  chamber: "衆議院" | "参議院";
  electionYear: number;
  electionDate: string;
  electionName: string;
  totalSeats: number;
  sourceUrl: string;
  results: RawSeatEntry[];
  note?: string;
}

/**
 * 出典: Wikipedia日本語版（CC BY-SA 4.0）各選挙記事の「党派別獲得議席数」表
 * （2026-08-10 確認。数値は各記事の表をそのまま転記）
 */
const ELECTIONS: RawElection[] = [
  {
    chamber: "衆議院",
    electionYear: 2012,
    electionDate: "2012-12-16",
    electionName: "第46回衆議院議員総選挙",
    totalSeats: 480,
    sourceUrl: "https://ja.wikipedia.org/wiki/第46回衆議院議員総選挙",
    results: [
      { partyName: "自由民主党", seats: 294 },
      { partyName: "民主党", seats: 57 },
      { partyName: "日本維新の会", seats: 54 },
      { partyName: "公明党", seats: 31 },
      { partyName: "みんなの党", seats: 18 },
      { partyName: "日本未来の党", seats: 9 },
      { partyName: "日本共産党", seats: 8 },
      { partyName: "社会民主党", seats: 2 },
      { partyName: "新党大地", seats: 1 },
      { partyName: "国民新党", seats: 1 },
      { partyName: "無所属", seats: 5 },
    ],
  },
  {
    chamber: "衆議院",
    electionYear: 2014,
    electionDate: "2014-12-14",
    electionName: "第47回衆議院議員総選挙",
    totalSeats: 475,
    sourceUrl: "https://ja.wikipedia.org/wiki/第47回衆議院議員総選挙",
    results: [
      { partyName: "自由民主党", seats: 291 },
      { partyName: "民主党", seats: 73 },
      { partyName: "維新の党", seats: 41 },
      { partyName: "公明党", seats: 35 },
      { partyName: "日本共産党", seats: 21 },
      { partyName: "次世代の党", seats: 2 },
      { partyName: "生活の党", seats: 2 },
      { partyName: "社会民主党", seats: 2 },
      { partyName: "無所属", seats: 8 },
    ],
  },
  {
    chamber: "衆議院",
    electionYear: 2017,
    electionDate: "2017-10-22",
    electionName: "第48回衆議院議員総選挙",
    totalSeats: 465,
    sourceUrl: "https://ja.wikipedia.org/wiki/第48回衆議院議員総選挙",
    results: [
      { partyName: "自由民主党", seats: 284 },
      { partyName: "立憲民主党", seats: 55 },
      { partyName: "希望の党", seats: 50 },
      { partyName: "公明党", seats: 29 },
      { partyName: "日本共産党", seats: 12 },
      { partyName: "日本維新の会", seats: 11 },
      { partyName: "社会民主党", seats: 2 },
      { partyName: "無所属", seats: 22 },
    ],
  },
  {
    chamber: "衆議院",
    electionYear: 2021,
    electionDate: "2021-10-31",
    electionName: "第49回衆議院議員総選挙",
    totalSeats: 465,
    sourceUrl: "https://ja.wikipedia.org/wiki/第49回衆議院議員総選挙",
    results: [
      { partyName: "自由民主党", seats: 261 },
      { partyName: "立憲民主党", seats: 96 },
      { partyName: "日本維新の会", seats: 41 },
      { partyName: "公明党", seats: 32 },
      { partyName: "国民民主党", seats: 11 },
      { partyName: "日本共産党", seats: 10 },
      { partyName: "れいわ新選組", seats: 3 },
      { partyName: "社会民主党", seats: 1 },
      { partyName: "無所属", seats: 10 },
    ],
  },
  {
    chamber: "衆議院",
    electionYear: 2024,
    electionDate: "2024-10-27",
    electionName: "第50回衆議院議員総選挙",
    totalSeats: 465,
    sourceUrl: "https://ja.wikipedia.org/wiki/第50回衆議院議員総選挙",
    results: [
      { partyName: "自由民主党", seats: 191 },
      { partyName: "立憲民主党", seats: 148 },
      { partyName: "日本維新の会", seats: 38 },
      { partyName: "国民民主党", seats: 28 },
      { partyName: "公明党", seats: 24 },
      { partyName: "れいわ新選組", seats: 9 },
      { partyName: "日本共産党", seats: 8 },
      { partyName: "参政党", seats: 3 },
      { partyName: "日本保守党", seats: 3 },
      { partyName: "社会民主党", seats: 1 },
      { partyName: "無所属", seats: 12 },
    ],
  },
  {
    chamber: "衆議院",
    electionYear: 2026,
    electionDate: "2026-02-08",
    electionName: "第51回衆議院議員総選挙",
    totalSeats: 465,
    note:
      "この回のみ、Wikipediaではなく総務省の速報結果（3.開票結果 (1)「届出政党等別" +
      "男女別新前元別当選人数（小選挙区、比例代表）」001061475.xlsx）を一次情報として" +
      "転記した。したがって自由民主党315・無所属5は、無所属当選者1名の事後の追加公認を" +
      "含まない選挙結果そのものの数値（Wikipediaの表は追加公認を反映して自民316・" +
      "無所属4としているが、第46〜50回と数え方を揃えるため採用していない）。" +
      "立憲民主党・公明党は本選挙に党として臨まず、中道改革連合として立候補している。",
    sourceUrl: "https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin51/index.html",
    results: [
      { partyName: "自由民主党", seats: 315 },
      { partyName: "中道改革連合", seats: 49 },
      { partyName: "日本維新の会", seats: 36 },
      { partyName: "国民民主党", seats: 28 },
      { partyName: "参政党", seats: 15 },
      { partyName: "チームみらい", seats: 11 },
      { partyName: "日本共産党", seats: 4 },
      { partyName: "れいわ新選組", seats: 1 },
      { partyName: "減税日本・ゆうこく連合", seats: 1 },
      { partyName: "無所属", seats: 5 },
    ],
  },
  {
    chamber: "参議院",
    electionYear: 2013,
    electionDate: "2013-07-21",
    electionName: "第23回参議院議員通常選挙",
    totalSeats: 121,
    sourceUrl: "https://ja.wikipedia.org/wiki/第23回参議院議員通常選挙",
    results: [
      { partyName: "自由民主党", seats: 65 },
      { partyName: "民主党", seats: 17 },
      { partyName: "公明党", seats: 11 },
      { partyName: "日本維新の会", seats: 8 },
      { partyName: "日本共産党", seats: 8 },
      { partyName: "みんなの党", seats: 8 },
      { partyName: "社会民主党", seats: 1 },
      { partyName: "沖縄社会大衆党", seats: 1 },
      { partyName: "無所属", seats: 2 },
    ],
  },
  {
    chamber: "参議院",
    electionYear: 2016,
    electionDate: "2016-07-10",
    electionName: "第24回参議院議員通常選挙",
    totalSeats: 121,
    sourceUrl: "https://ja.wikipedia.org/wiki/第24回参議院議員通常選挙",
    results: [
      { partyName: "自由民主党", seats: 56 },
      { partyName: "民進党", seats: 32 },
      { partyName: "公明党", seats: 14 },
      { partyName: "おおさか維新の会", seats: 7 },
      { partyName: "日本共産党", seats: 6 },
      { partyName: "無所属", seats: 4 },
      { partyName: "社会民主党", seats: 1 },
      { partyName: "生活の党と山本太郎となかまたち", seats: 1 },
    ],
  },
  {
    chamber: "参議院",
    electionYear: 2019,
    electionDate: "2019-07-21",
    electionName: "第25回参議院議員通常選挙",
    totalSeats: 124,
    sourceUrl: "https://ja.wikipedia.org/wiki/第25回参議院議員通常選挙",
    results: [
      { partyName: "自由民主党", seats: 57 },
      { partyName: "立憲民主党", seats: 17 },
      { partyName: "公明党", seats: 14 },
      { partyName: "日本維新の会", seats: 10 },
      { partyName: "日本共産党", seats: 7 },
      { partyName: "国民民主党", seats: 6 },
      { partyName: "無所属", seats: 9 },
      { partyName: "れいわ新選組", seats: 2 },
      { partyName: "社会民主党", seats: 1 },
      { partyName: "NHKから国民を守る党", seats: 1 },
    ],
  },
  {
    chamber: "参議院",
    electionYear: 2022,
    electionDate: "2022-07-10",
    electionName: "第26回参議院議員通常選挙",
    totalSeats: 125,
    note:
      "改選議席数124に、同日に行われた神奈川県選挙区の欠員補充（繰上補充ではなく" +
      "補欠選挙相当分）1議席を加えた125議席が対象（Wikipedia記事の表記に準拠）。",
    sourceUrl: "https://ja.wikipedia.org/wiki/第26回参議院議員通常選挙",
    results: [
      { partyName: "自由民主党", seats: 63 },
      { partyName: "立憲民主党", seats: 17 },
      { partyName: "公明党", seats: 13 },
      { partyName: "日本維新の会", seats: 12 },
      { partyName: "国民民主党", seats: 5 },
      { partyName: "無所属", seats: 5 },
      { partyName: "日本共産党", seats: 4 },
      { partyName: "れいわ新選組", seats: 3 },
      { partyName: "社会民主党", seats: 1 },
      { partyName: "NHK党", seats: 1 },
      { partyName: "参政党", seats: 1 },
    ],
  },
  {
    chamber: "参議院",
    electionYear: 2025,
    electionDate: "2025-07-20",
    electionName: "第27回参議院議員通常選挙",
    totalSeats: 125,
    note:
      "改選議席数124に、同日に行われた東京都選挙区の補欠選挙分1議席を加えた" +
      "125議席が対象（Wikipedia記事の表記に準拠。立憲民主党の内訳「22+1」を含む）。",
    sourceUrl: "https://ja.wikipedia.org/wiki/第27回参議院議員通常選挙",
    results: [
      { partyName: "自由民主党", seats: 39 },
      { partyName: "立憲民主党", seats: 22 },
      { partyName: "国民民主党", seats: 17 },
      { partyName: "参政党", seats: 14 },
      { partyName: "公明党", seats: 8 },
      { partyName: "日本維新の会", seats: 7 },
      { partyName: "無所属", seats: 8 },
      { partyName: "日本共産党", seats: 3 },
      { partyName: "れいわ新選組", seats: 3 },
      { partyName: "日本保守党", seats: 2 },
      { partyName: "社会民主党", seats: 1 },
      { partyName: "チームみらい", seats: 1 },
    ],
  },
];

/** 選挙ごとに、政党別議席数の合計が totalSeats と一致することを検証する */
function assertValidElection(election: RawElection): void {
  const sum = election.results.reduce((acc, r) => acc + r.seats, 0);
  if (sum !== election.totalSeats) {
    throw new Error(
      `議席数の合計が不一致: ${election.electionName} (results合計=${sum}, totalSeats=${election.totalSeats})`
    );
  }
}

/**
 * 陳腐化検知（重要）。
 *
 * 本スクリプトのELECTIONSは手動転記の固定データなので、新しい国政選挙が行われても
 * 誰かが気づいて追記しない限り永久に古いままになる（実際に第51回衆院選が
 * 半年間反映されないままだった）。そこで「制度上その時点までには必ず次の選挙が
 * 行われているはずの期限」を過ぎていたら警告を出す。
 *   - 衆議院: 任期4年（解散があるためこれより短くなることはあっても長くはならない）
 *   - 参議院: 3年ごとの通常選挙
 * 猶予として3か月を足している（選挙直後にデータ追記が間に合わない期間を許容するため）。
 *
 * 日次のGitHub Actions（fetch:all）を止めたくないので例外ではなく警告に留めるが、
 * ログに出たら ELECTIONS に最新の選挙結果を追記すること。
 */
function warnIfStale(elections: RawElection[], now: Date): void {
  const MAX_TERM_MONTHS: Record<RawElection["chamber"], number> = {
    衆議院: 4 * 12,
    参議院: 3 * 12,
  };
  const GRACE_MONTHS = 3;

  for (const chamber of ["衆議院", "参議院"] as const) {
    const latest = elections
      .filter((e) => e.chamber === chamber)
      .sort((a, b) => a.electionDate.localeCompare(b.electionDate))
      .at(-1);
    if (!latest) continue;

    const deadline = new Date(latest.electionDate);
    deadline.setMonth(deadline.getMonth() + MAX_TERM_MONTHS[chamber] + GRACE_MONTHS);
    if (now > deadline) {
      console.warn(
        `[陳腐化の疑い] ${chamber}の最新データが${latest.electionName}（${latest.electionDate}）のままです。` +
          `${chamber}の任期は${MAX_TERM_MONTHS[chamber] / 12}年なので、既に次の選挙が行われている可能性が高い。` +
          `scripts/fetch-party-seat-history.ts の ELECTIONS に最新の選挙結果を追記してください。`
      );
    }
  }
}

async function loadCurrentPartyIds(): Promise<Set<string>> {
  const filePath = path.join(process.cwd(), "data", "parties.json");
  const raw = await readFile(filePath, "utf-8");
  const parties = JSON.parse(raw) as Party[];
  return new Set(parties.map((p) => p.id));
}

/**
 * 過去選挙の正式政党名から、現行 parties.json の id に解決を試みる。
 * 対応がつかない場合（解散・改名で後継が曖昧な党、現行マスタに存在しないid等）は null。
 */
function resolveHistoricalPartyId(
  partyName: string,
  currentPartyIds: Set<string>
): string | null {
  const abbr = PARTY_FULL_NAME_TO_ABBR[partyName];
  if (!abbr) return null;
  const id = resolvePartyId(abbr);
  return currentPartyIds.has(id) ? id : null;
}

async function main() {
  const currentPartyIds = await loadCurrentPartyIds();

  for (const election of ELECTIONS) {
    assertValidElection(election);
  }
  warnIfStale(ELECTIONS, new Date());

  const history: PartySeatHistory[] = ELECTIONS.map((election) => {
    const results: PartySeatResult[] = election.results.map((r) => ({
      partyName: r.partyName,
      partyId: resolveHistoricalPartyId(r.partyName, currentPartyIds),
      seats: r.seats,
    }));
    return {
      chamber: election.chamber,
      electionYear: election.electionYear,
      electionDate: election.electionDate,
      electionName: election.electionName,
      totalSeats: election.totalSeats,
      results,
      sourceUrl: election.sourceUrl,
      ...(election.note ? { note: election.note } : {}),
    };
  });

  const unresolvedPartyNames = new Set(
    history
      .flatMap((h) => h.results)
      .filter((r) => r.partyId === null)
      .map((r) => r.partyName)
  );
  console.log(`取得件数: ${history.length}選挙分`);
  console.log(
    `partyId未解決の政党名（解散・改名等で現行マスタに対応なし。想定内）: ${
      [...unresolvedPartyNames].join("、") || "なし"
    }`
  );

  if (history.length === 0) {
    throw new Error("政党別議席数データを1件も生成できませんでした。");
  }

  await writeDataJson("party-seat-history.json", history);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
