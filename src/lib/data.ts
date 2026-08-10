import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Bill,
  BillStatusHistory,
  ElectionResult,
  Legislator,
  NdlSpeechCount,
  Party,
  PrefectureFinance,
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
 * NDL国会会議録検索システムAPIによる議員発言件数（フェーズ4、参考値）。
 * データ未取得（scripts/fetch-ndl-speech-counts.ts 未実行）やファイルが空の
 * 場合でも画面が壊れないよう、フェイルセーフに空配列を返す。
 */
export const getNdlSpeechCounts = async (): Promise<NdlSpeechCount[]> => {
  try {
    const data = await readJson<NdlSpeechCount[]>("ndl-speech-counts.json");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

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

/**
 * 都道府県別・地方財政データ（Phase 4、決算収支の状況）を取得する。
 * data/prefecture-finance.json は取得スクリプト（fetch:prefecture-finance）を
 * 実行するまで存在しないため、ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getPrefectureFinance = async (): Promise<PrefectureFinance[]> => {
  try {
    const data = await readJson<PrefectureFinance[]>("prefecture-finance.json");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
