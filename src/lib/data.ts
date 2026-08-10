import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Bill,
  BillSponsorship,
  BillStatusHistory,
  ElectionResult,
  Legislator,
  NdlSpeechCount,
  Party,
  PartySeatHistory,
  NationalBudget,
  PrefectureExpenditureByNature,
  PrefectureExpenditureByPurpose,
  PrefectureFinance,
  PrefectureFinancialHealth,
  PrefecturePopulation,
  RollCallVote,
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
 * 法案の提出者・提出会派・衆議院審議時の賛成/反対会派（機能拡充ロードマップ Tier1 #3）。
 * data/bill-sponsorships.json は取得スクリプト（fetch:bill-sponsorships）を
 * 実行するまで存在しないため、ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getBillSponsorships = async (): Promise<BillSponsorship[]> => {
  try {
    const data = await readJson<BillSponsorship[]>("bill-sponsorships.json");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

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
 * 過去選挙の政党別獲得議席数の推移（フェーズ4）を取得する。
 * data/party-seat-history.json は取得スクリプト（fetch:party-seat-history）を
 * 実行するまで存在しないため、ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getPartySeatHistory = async (): Promise<PartySeatHistory[]> => {
  try {
    const data = await readJson<PartySeatHistory[]>("party-seat-history.json");
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

/**
 * 参議院の記名投票（押しボタン式投票）結果一覧を取得する（フェーズ4）。
 * data/roll-call-votes.json は取得スクリプト（fetch:roll-call-votes）を
 * 実行するまで存在しないため、ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getRollCallVotes = async (): Promise<RollCallVote[]> => {
  try {
    const data = await readJson<RollCallVote[]>("roll-call-votes.json");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/**
 * 都道府県別・総人口データ（予算の見える化 Phase A-2）を取得する。
 * data/prefecture-population.json は取得スクリプト（fetch:prefecture-population）を
 * 実行するまで存在しないため、ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getPrefecturePopulation = async (): Promise<PrefecturePopulation[]> => {
  try {
    const data = await readJson<PrefecturePopulation[]>("prefecture-population.json");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/**
 * 都道府県別・目的別歳出データ（予算の見える化 Phase A-2）を取得する。
 * data/prefecture-expenditure-by-purpose.json は取得スクリプト
 * （fetch:prefecture-expenditure-by-purpose）を実行するまで存在しないため、
 * ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getPrefectureExpenditureByPurpose = async (): Promise<
  PrefectureExpenditureByPurpose[]
> => {
  try {
    const data = await readJson<PrefectureExpenditureByPurpose[]>(
      "prefecture-expenditure-by-purpose.json"
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/**
 * 都道府県別・財政健全化指標データ（予算の見える化 Phase B）を取得する。
 * data/prefecture-financial-health.json は取得スクリプト
 * （fetch:prefecture-financial-health）を実行するまで存在しないため、
 * ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getPrefectureFinancialHealth = async (): Promise<
  PrefectureFinancialHealth[]
> => {
  try {
    const data = await readJson<PrefectureFinancialHealth[]>(
      "prefecture-financial-health.json"
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/**
 * 都道府県別・性質別歳出データ（予算の見える化 Phase B）を取得する。
 * data/prefecture-expenditure-by-nature.json は取得スクリプト
 * （fetch:prefecture-expenditure-by-nature）を実行するまで存在しないため、
 * ファイル未生成時もフェイルセーフに空配列を返す。
 */
export const getPrefectureExpenditureByNature = async (): Promise<
  PrefectureExpenditureByNature[]
> => {
  try {
    const data = await readJson<PrefectureExpenditureByNature[]>(
      "prefecture-expenditure-by-nature.json"
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/**
 * 国の税収・歳出データ（機能拡充ロードマップ Tier1 #2）を取得する。
 * data/national-budget.json は取得スクリプト（fetch:national-budget）を
 * 実行するまで存在しないため、ファイル未生成時もフェイルセーフにnullを返す
 * （配列ではなく単一オブジェクトのため、他のgetterと異なりnullで表現する）。
 */
export const getNationalBudget = async (): Promise<NationalBudget | null> => {
  try {
    const data = await readJson<NationalBudget>("national-budget.json");
    return data && typeof data === "object" && "taxRevenue" in data ? data : null;
  } catch {
    return null;
  }
};
