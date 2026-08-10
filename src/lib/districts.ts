import type { Legislator } from "@/types";
import { PREFECTURE_CODES, PREFECTURE_SHORT_NAMES } from "@/lib/prefectures";

/**
 * 選挙区マップ（衆議院289小選挙区・参議院45選挙区）用のヘルパー。
 *
 * 【キーの考え方】
 * 議員データ（data/legislators.json）の `district` をそのまま「選挙区キー」として
 * 使う。境界データ側の表記はデータソースごとに違うため、こちら側へ寄せる。
 * - 衆議院小選挙区: "岡山1"（境界データは "岡山1区"）
 * - 参議院選挙区:   "岡山"／合区は "鳥取・島根"（境界データは都道府県名 "岡山県"）
 *
 * 【中立性の方針】
 * 選挙区の塗り分けは既定では行わない（全区ニュートラル）。政党別の塗り分けは
 * 利用者が明示的にオンにしたときだけ適用する。得票率による塗り分けや、
 * 有権者数に応じて面積を変形する図（カルトグラム）は作らない。
 */

/** 衆議院小選挙区の境界データ（令和4年改訂・289区）。生成方法は public/data/README.md 参照 */
export const SHUGIIN_DISTRICT_GEO_URL = "/data/districts-shugiin-topo.json";
/** 参議院選挙区は都道府県単位（合区あり）なので、都道府県境界データを流用する */
export const PREFECTURE_GEO_URL = "/data/prefectures-topo.json";

/** 境界データ側の選挙区名（"岡山1区"）→ 議員データ側の表記（"岡山1"） */
export function districtKeyFromKuname(kuname: string): string {
  return kuname.replace(/区$/, "");
}

/** 議員データ側の表記（"岡山1"）→ 表示用の選挙区名（"岡山1区"） */
export function districtLabel(districtKey: string): string {
  return `${districtKey}区`;
}

/** 衆議院小選挙区キー（"岡山1"）→ 都道府県の正式名称（"岡山県"）。不明なら null */
export function prefectureOfShugiinDistrict(districtKey: string): string | null {
  const short = districtKey.replace(/\d+$/, "");
  const official = Object.entries(PREFECTURE_SHORT_NAMES).find(
    ([, s]) => s === short
  )?.[0];
  return official ?? null;
}

/**
 * 参議院の合区（2016年参院選から実施）。
 * 2県で1つの選挙区を構成するため、都道府県境界データでは2つの地物が
 * 同じ選挙区キーを指すことになる。
 */
const SANGIIN_MERGED_DISTRICTS: Record<string, string> = {
  鳥取: "鳥取・島根",
  島根: "鳥取・島根",
  徳島: "徳島・高知",
  高知: "徳島・高知",
};

/** 都道府県の正式名称（"島根県"）→ 参議院選挙区キー（"鳥取・島根"）。不明なら null */
export function sangiinDistrictOfPrefecture(
  officialName: string
): string | null {
  const short = PREFECTURE_SHORT_NAMES[officialName];
  if (!short) return null;
  return SANGIIN_MERGED_DISTRICTS[short] ?? short;
}

/** 参議院選挙区キー → 含まれる都道府県の正式名称（合区は2件） */
export function prefecturesOfSangiinDistrict(districtKey: string): string[] {
  return Object.keys(PREFECTURE_CODES).filter(
    (official) => sangiinDistrictOfPrefecture(official) === districtKey
  );
}

/** 参議院の全選挙区キーを、都道府県コード順（合区は若い方のコード）で返す */
export function sangiinDistrictKeys(): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const official of Object.keys(PREFECTURE_CODES)) {
    const key = sangiinDistrictOfPrefecture(official);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/** その議員が衆議院の小選挙区選出か（比例代表は末尾に数字が付かない） */
export function isShugiinSingleSeatDistrict(legislator: Legislator): boolean {
  return legislator.chamber === "衆議院" && /\d$/.test(legislator.district);
}

/** その議員が参議院の選挙区選出か（全国区の比例代表を除く） */
export function isSangiinDistrictSeat(legislator: Legislator): boolean {
  return legislator.chamber === "参議院" && legislator.district !== "比例";
}

/**
 * 選挙区キー → その選挙区選出の議員一覧。
 * 衆議院小選挙区は原則1名、参議院選挙区は改選期をまたぐため定数分（2〜12名）になる。
 */
export function groupLegislatorsByDistrict(
  legislators: Legislator[],
  predicate: (legislator: Legislator) => boolean
): Record<string, Legislator[]> {
  const result: Record<string, Legislator[]> = {};
  for (const l of legislators) {
    if (!predicate(l)) continue;
    (result[l.district] ??= []).push(l);
  }
  return result;
}
