/**
 * 法案（議案）と審議進捗履歴を取得するスクリプト。
 *
 * データソース: SmartNews メディア研究所「国会議案データベース：衆議院」
 *   https://github.com/smartnews-smri/house-of-representatives （MITライセンス）
 *   出典表記: 「スマートニュース メディア研究所」または「SmartNews Media Research Institute」
 *
 * 実行: npm run fetch:bills
 *
 * 実データ確認済み（2026-08-10、Node.jsから直接fetchして検証）:
 *   - data/gian.json は「先頭行=ヘッダー、以降=データ行」の配列の配列（rowsToObjectsで変換）
 *   - 「審議状況」列に詳細ステータス文字列が直接入っている（billStatus.tsで正規化）
 *   - 日付は元号表記（例:"平成10年 3月11日"）、日付と委員会名/結果が
 *     全角スラッシュ区切りで同一セルに入っている列がある（eraDate.tsで分解）
 *   - 1行=1法案ではない。継続審査になった法案は「掲載回次」が変わるたびに
 *     別行として登場する（同じ法案が複数行にまたがる）。一方「提出回次＋議案種類＋番号」
 *     の組み合わせは実データで一意になることを確認済み（11,620行 → 6,985法案に集約）。
 *     そのためこの3つの組み合わせをBillの安定IDとして使い、複数行をグルーピングしている
 */
import type { Bill, BillStatusHistory } from "../src/types";
import { writeDataJson } from "./lib/writeJson";
import { rowsToObjects } from "./lib/csvJson";
import { normalizeBillStatus } from "./lib/billStatus";
import { eraToIsoDate, splitDateAndNote } from "./lib/eraDate";

const GIAN_URL =
  "https://raw.githubusercontent.com/smartnews-smri/house-of-representatives/main/data/gian.json";

interface RawGian {
  掲載回次: string;
  提出回次?: string;
  議案件名: string;
  審議状況: string;
  経過情報URL?: string;
  本文情報URL?: string;
  議案種類?: string; // 衆法/参法/閣法/条約 など
  番号?: string;
  議案提出者?: string;
  衆議院予備審査議案受理年月日?: string;
  衆議院議案受理年月日?: string;
  "衆議院付託年月日／衆議院付託委員会"?: string;
  "衆議院審査終了年月日／衆議院審査結果"?: string;
  "衆議院審議終了年月日／衆議院審議結果"?: string;
  参議院予備審査議案受理年月日?: string;
  参議院議案受理年月日?: string;
  "参議院付託年月日／参議院付託委員会"?: string;
  "参議院審査終了年月日／参議院審査結果"?: string;
  "参議院審議終了年月日／参議院審議結果"?: string;
  "公布年月日／法律番号"?: string;
}

function submitterType(category: string | undefined): Bill["submitterType"] {
  return category?.includes("閣") ? "内閣提出" : "議員立法";
}

function house(category: string | undefined): Bill["house"] {
  if (category?.startsWith("衆法")) return "衆議院";
  if (category?.startsWith("参法")) return "参議院";
  return "両院"; // 閣法・条約等は先議院をこの列だけからは判別できないため
}

/** 委員会・本会議の議決結果の注記テキストから、可決/否決の粒度だけ拾う簡易判定 */
function committeeStage(note: string): "委員会可決" | "委員会否決" {
  return note.includes("否決") ? "委員会否決" : "委員会可決";
}
function plenaryStage(note: string): "本会議可決" | "本会議否決" {
  return note.includes("否決") ? "本会議否決" : "本会議可決";
}

/** 提出回次＋議案種類＋番号 で法案を一意に識別する（実データで一意性を確認済み） */
function billKey(g: RawGian): string {
  return `${g.提出回次 ?? "unknown"}|${g.議案種類 ?? "unknown"}|${g.番号 ?? "unknown"}`;
}
function billIdFromKey(key: string): string {
  return `gian-${key.replace(/\|/g, "-")}`;
}

function extractHistoryFromRow(
  billId: string,
  g: RawGian,
  sourceUrl: string
): BillStatusHistory[] {
  const entries: BillStatusHistory[] = [];
  const submittedDate =
    eraToIsoDate(g.衆議院議案受理年月日) ?? eraToIsoDate(g.参議院議案受理年月日);
  if (submittedDate) {
    entries.push({
      billId,
      date: submittedDate,
      stage: "提出",
      house: g.衆議院議案受理年月日 ? "衆議院" : "参議院",
      sourceUrl,
    });
  }

  const segments: Array<{
    field: string | undefined;
    stage: BillStatusHistory["stage"] | ((note: string) => BillStatusHistory["stage"]);
    house: "衆議院" | "参議院";
  }> = [
    { field: g["衆議院付託年月日／衆議院付託委員会"], stage: "委員会付託", house: "衆議院" },
    {
      field: g["衆議院審査終了年月日／衆議院審査結果"],
      stage: committeeStage,
      house: "衆議院",
    },
    { field: g["衆議院審議終了年月日／衆議院審議結果"], stage: plenaryStage, house: "衆議院" },
    { field: g["参議院付託年月日／参議院付託委員会"], stage: "委員会付託", house: "参議院" },
    {
      field: g["参議院審査終了年月日／参議院審査結果"],
      stage: committeeStage,
      house: "参議院",
    },
    { field: g["参議院審議終了年月日／参議院審議結果"], stage: plenaryStage, house: "参議院" },
  ];
  for (const seg of segments) {
    const { date, note } = splitDateAndNote(seg.field);
    if (!date) continue;
    entries.push({
      billId,
      date,
      stage: typeof seg.stage === "function" ? seg.stage(note) : seg.stage,
      house: seg.house,
      note: note || undefined,
      sourceUrl,
    });
  }

  const promulgation = splitDateAndNote(g["公布年月日／法律番号"]);
  if (promulgation.date) {
    // 公布はどちらの院に紐づくものでもないが、BillStatusHistory.houseは
    // 衆議院|参議院の必須項目のため、便宜上「参議院」を採用している（TODO: 要検討）
    entries.push({
      billId,
      date: promulgation.date,
      stage: "成立",
      house: "参議院",
      note: promulgation.note || undefined,
      sourceUrl,
    });
  }
  return entries;
}

async function main() {
  const res = await fetch(GIAN_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const rows = (await res.json()) as unknown[][];
  const gianList = rowsToObjects<RawGian>(rows);

  const groups = new Map<string, RawGian[]>();
  for (const g of gianList) {
    const key = billKey(g);
    const list = groups.get(key);
    if (list) list.push(g);
    else groups.set(key, [g]);
  }

  const bills: Bill[] = [];
  const history: BillStatusHistory[] = [];
  const seenHistoryKeys = new Set<string>();

  for (const [key, groupRows] of groups) {
    const id = billIdFromKey(key);
    // 掲載回次が最も新しい行を「現在の状態」の代表とする
    const sorted = [...groupRows].sort(
      (a, b) => Number(a.掲載回次) - Number(b.掲載回次)
    );
    const latest = sorted.at(-1)!;
    const category = latest.議案種類;
    const sourceUrl = latest.経過情報URL || latest.本文情報URL || "";

    // 提出日は元の提出時点の行にしかないことがあるため、全行から探す
    const submittedDate =
      sorted
        .map(
          (g) =>
            eraToIsoDate(g.衆議院議案受理年月日) ??
            eraToIsoDate(g.参議院議案受理年月日) ??
            eraToIsoDate(g.衆議院予備審査議案受理年月日) ??
            eraToIsoDate(g.参議院予備審査議案受理年月日)
        )
        .find((d): d is string => Boolean(d)) ?? "";

    const rowHistories = sorted.flatMap((g) =>
      extractHistoryFromRow(id, g, g.経過情報URL || g.本文情報URL || sourceUrl)
    );
    // 同じ法案が複数行にまたがることで生じる重複エントリを除去
    for (const entry of rowHistories) {
      const dedupeKey = `${entry.billId}|${entry.date}|${entry.stage}|${entry.house}`;
      if (seenHistoryKeys.has(dedupeKey)) continue;
      seenHistoryKeys.add(dedupeKey);
      history.push(entry);
    }

    const lastUpdated =
      rowHistories
        .map((h) => h.date)
        .sort()
        .at(-1) ?? submittedDate;

    bills.push({
      id,
      dietSession: Number(latest.掲載回次),
      billNumber: latest.番号 ?? "",
      title: latest.議案件名,
      category,
      submitterType: submitterType(category),
      house: house(category),
      status: normalizeBillStatus(latest.審議状況),
      submittedDate,
      lastUpdated,
      sourceUrl,
    });
  }

  console.log(`取得件数: ${bills.length}件 / 進捗履歴: ${history.length}件`);
  if (bills.length === 0) {
    throw new Error("議案データを1件も取得できませんでした。スキーマを確認してください。");
  }

  await writeDataJson("bills.json", bills);
  await writeDataJson("bill-status-history.json", history);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
