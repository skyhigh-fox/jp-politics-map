/**
 * 法案（議案）と審議進捗履歴を取得するスクリプト。
 *
 * データソース: SmartNews メディア研究所「国会議案データベース：衆議院」
 *   https://github.com/smartnews-smri/house-of-representatives （MITライセンス）
 *   出典表記: 「スマートニュース メディア研究所」または「SmartNews Media Research Institute」
 *
 * 実行: npm run fetch:bills
 *
 * !! 未検証 !!
 * gian.json は10MB超のためこのセッションでは中身を直接確認できておらず、
 * house-of-councillors リポジトリの data/gian_sample.json（2026-08-10時点で確認済み、
 * 39カラム）と同一のカラム構成であるという前提でキー名を書いている。
 * npm install 後、最初の実行時に取得件数・サンプルの中身を必ず確認し、
 * キー名がズレていれば下記 RawGian インターフェースとマッピング処理を実データに合わせる。
 *
 * ステータス正規化について: 実際の「審議状況」は本会議・委員会の議決結果列から
 * 読み取る必要があり、詳細ステータスは28種類ある（data/gian_status.json参照）。
 * ここでは lib/billStatus.ts の簡易ヒューリスティックでフェーズ1のBillStatus enumに
 * 正規化している（TODO: 将来的により精密なマッピングに拡張する）。
 */
import type { Bill, BillStatusHistory } from "../src/types";
import { writeDataJson } from "./lib/writeJson";
import { normalizeBillStatus } from "./lib/billStatus";

const GIAN_URL =
  "https://raw.githubusercontent.com/smartnews-smri/house-of-representatives/main/data/gian.json";

interface RawGian {
  審議回次: number;
  種類?: string;
  提出番号?: string;
  件名: string;
  議案URL?: string;
  "議案審議情報一覧 - 提出日"?: string;
  "議案審議情報一覧 - 提出者区分"?: string;
  "議案審議情報一覧 - 先議区分"?: string;
  "衆議院委員会等経過情報 - 本付託日"?: string;
  "衆議院委員会等経過情報 - 付託委員会等"?: string;
  "衆議院委員会等経過情報 - 議決日"?: string;
  "衆議院委員会等経過情報 - 議決・継続結果"?: string;
  "衆議院本会議経過情報 - 議決日"?: string;
  "衆議院本会議経過情報 - 議決"?: string;
  "参議院委員会等経過情報 - 本付託日"?: string;
  "参議院委員会等経過情報 - 付託委員会等"?: string;
  "参議院委員会等経過情報 - 議決日"?: string;
  "参議院委員会等経過情報 - 議決・継続結果"?: string;
  "参議院本会議経過情報 - 議決日"?: string;
  "参議院本会議経過情報 - 議決"?: string;
  成立法律?: string;
}

function submitterType(raw?: string): Bill["submitterType"] {
  if (raw?.includes("内閣")) return "内閣提出";
  return "議員立法";
}

function billId(g: RawGian, index: number): string {
  return `gian-${g.審議回次}-${g.提出番号 ?? index}`;
}

async function main() {
  const res = await fetch(GIAN_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const gianList = (await res.json()) as RawGian[];

  const today = new Date().toISOString().slice(0, 10);
  const bills: Bill[] = [];
  const history: BillStatusHistory[] = [];

  gianList.forEach((g, index) => {
    const id = billId(g, index);
    const status = normalizeBillStatus({
      shugiinPlenaryResult: g["衆議院本会議経過情報 - 議決"],
      sangiinPlenaryResult: g["参議院本会議経過情報 - 議決"],
      law: g.成立法律,
    });

    bills.push({
      id,
      dietSession: g.審議回次,
      billNumber: g.提出番号 ?? "",
      title: g.件名,
      category: g.種類,
      submitterType: submitterType(g["議案審議情報一覧 - 提出者区分"]),
      house:
        g["議案審議情報一覧 - 先議区分"] === "衆議院" ||
        g["議案審議情報一覧 - 先議区分"] === "参議院"
          ? (g["議案審議情報一覧 - 先議区分"] as Bill["house"])
          : "両院",
      status,
      submittedDate: g["議案審議情報一覧 - 提出日"] ?? "",
      lastUpdated: today, // TODO: 実データの最終更新日カラムが判明次第そちらに置き換える
      sourceUrl: g.議案URL ?? "",
    });

    const stages: Array<[string | undefined, BillStatusHistory["stage"], "衆議院" | "参議院"]> = [
      [g["議案審議情報一覧 - 提出日"], "提出", "衆議院"],
      [g["衆議院委員会等経過情報 - 本付託日"], "委員会付託", "衆議院"],
      [g["衆議院委員会等経過情報 - 議決日"], "委員会可決", "衆議院"],
      [g["衆議院本会議経過情報 - 議決日"], "本会議可決", "衆議院"],
      [g["参議院委員会等経過情報 - 本付託日"], "委員会付託", "参議院"],
      [g["参議院委員会等経過情報 - 議決日"], "委員会可決", "参議院"],
      [g["参議院本会議経過情報 - 議決日"], "本会議可決", "参議院"],
    ];
    for (const [date, stage, house] of stages) {
      if (!date) continue;
      history.push({
        billId: id,
        date,
        stage,
        house,
        sourceUrl: g.議案URL ?? "",
      });
    }
  });

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
