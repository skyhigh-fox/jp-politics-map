import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Bill,
  BillStatusHistory,
  ElectionResult,
  Legislator,
  Party,
  WrittenQuestionCount,
} from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(DATA_DIR, fileName);
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export const getLegislators = () => readJson<Legislator[]>("legislators.json");
export const getParties = () => readJson<Party[]>("parties.json");
export const getBills = () => readJson<Bill[]>("bills.json");
export const getBillStatusHistory = () =>
  readJson<BillStatusHistory[]>("bill-status-history.json");
export const getElectionResults = () =>
  readJson<ElectionResult[]>("election-results.json");

/**
 * 質問主意書の提出件数集計を取得する。
 * data/written-questions.json は取得スクリプト（fetch:written-questions）を
 * 実行するまで存在しない、あるいは対象回次に該当データがない場合は空配列に
 * なりうるため、ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getWrittenQuestionCounts = async (): Promise<WrittenQuestionCount[]> => {
  try {
    return await readJson<WrittenQuestionCount[]>("written-questions.json");
  } catch {
    return [];
  }
};
