import type { Legislator } from "@/types";

/**
 * 議員データの`district`は都道府県のフルネーム（例:"岡山県"）ではなく、
 * 短縮表記（例:"岡山1"の"岡山"、参議院選挙区の"岡山"）で入っている。
 * 地図の境界データ（public/data/prefectures-topo.json）の
 * properties.N03_001 は正式名称（例:"岡山県"）なので対応表が必要。
 */
const PREFECTURE_OFFICIAL_NAMES: Record<string, string> = {
  北海道: "北海道",
  青森: "青森県",
  岩手: "岩手県",
  宮城: "宮城県",
  秋田: "秋田県",
  山形: "山形県",
  福島: "福島県",
  茨城: "茨城県",
  栃木: "栃木県",
  群馬: "群馬県",
  埼玉: "埼玉県",
  千葉: "千葉県",
  東京: "東京都",
  神奈川: "神奈川県",
  新潟: "新潟県",
  富山: "富山県",
  石川: "石川県",
  福井: "福井県",
  山梨: "山梨県",
  長野: "長野県",
  岐阜: "岐阜県",
  静岡: "静岡県",
  愛知: "愛知県",
  三重: "三重県",
  滋賀: "滋賀県",
  京都: "京都府",
  大阪: "大阪府",
  兵庫: "兵庫県",
  奈良: "奈良県",
  和歌山: "和歌山県",
  鳥取: "鳥取県",
  島根: "島根県",
  岡山: "岡山県",
  広島: "広島県",
  山口: "山口県",
  徳島: "徳島県",
  香川: "香川県",
  愛媛: "愛媛県",
  高知: "高知県",
  福岡: "福岡県",
  佐賀: "佐賀県",
  長崎: "長崎県",
  熊本: "熊本県",
  大分: "大分県",
  宮崎: "宮崎県",
  鹿児島: "鹿児島県",
  沖縄: "沖縄県",
};

/** 衆議院比例代表ブロック → 含まれる都道府県（短縮名） */
const PROPORTIONAL_BLOCKS: Record<string, string[]> = {
  北海道: ["北海道"],
  東北: ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
  北関東: ["茨城", "栃木", "群馬", "埼玉"],
  南関東: ["千葉", "神奈川", "山梨"],
  東京: ["東京"],
  北陸信越: ["新潟", "富山", "石川", "福井", "長野"],
  東海: ["岐阜", "静岡", "愛知", "三重"],
  近畿: ["滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"],
  中国: ["鳥取", "島根", "岡山", "広島", "山口"],
  四国: ["徳島", "香川", "愛媛", "高知"],
  九州: ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"],
};

function toOfficialNames(shortNames: string[]): string[] {
  return shortNames
    .map((s) => PREFECTURE_OFFICIAL_NAMES[s])
    .filter((s): s is string => Boolean(s));
}

/**
 * 議員1名が関連する都道府県（正式名称）の一覧を返す。
 * - 小選挙区・参議院選挙区: 1都道府県（合区は2都道府県）
 * - 比例代表: ブロックに含まれる全都道府県
 * - 参議院比例代表（全国区、district === "比例"）: 該当なし（空配列）
 */
export function legislatorPrefectures(legislator: Legislator): string[] {
  const { district } = legislator;

  if (district === "比例") return []; // 参議院比例代表（全国区）

  if (district.startsWith("（比）")) {
    const block = district.replace("（比）", "");
    return toOfficialNames(PROPORTIONAL_BLOCKS[block] ?? []);
  }

  if (district.includes("・")) {
    // 参議院の合区（例:"鳥取・島根"）
    return toOfficialNames(district.split("・"));
  }

  // 衆議院小選挙区（例:"岡山1"）は末尾の数字を除去
  const shortName = district.replace(/\d+$/, "");
  return toOfficialNames([shortName]);
}

/** 都道府県ごとの議員数を集計する */
export function countLegislatorsByPrefecture(
  legislators: Legislator[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const l of legislators) {
    for (const pref of legislatorPrefectures(l)) {
      counts[pref] = (counts[pref] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * 都道府県の正式名称 → JIS X 0401 の2桁都道府県コード。
 * 市区町村境界データ（smartnews-smri/japan-topography）のファイル名
 * （例:"N03-21_13_210101.json"の"13"）に対応する
 */
export const PREFECTURE_CODES: Record<string, string> = {
  北海道: "01",
  青森県: "02",
  岩手県: "03",
  宮城県: "04",
  秋田県: "05",
  山形県: "06",
  福島県: "07",
  茨城県: "08",
  栃木県: "09",
  群馬県: "10",
  埼玉県: "11",
  千葉県: "12",
  東京都: "13",
  神奈川県: "14",
  新潟県: "15",
  富山県: "16",
  石川県: "17",
  福井県: "18",
  山梨県: "19",
  長野県: "20",
  岐阜県: "21",
  静岡県: "22",
  愛知県: "23",
  三重県: "24",
  滋賀県: "25",
  京都府: "26",
  大阪府: "27",
  兵庫県: "28",
  奈良県: "29",
  和歌山県: "30",
  鳥取県: "31",
  島根県: "32",
  岡山県: "33",
  広島県: "34",
  山口県: "35",
  徳島県: "36",
  香川県: "37",
  愛媛県: "38",
  高知県: "39",
  福岡県: "40",
  佐賀県: "41",
  長崎県: "42",
  熊本県: "43",
  大分県: "44",
  宮崎県: "45",
  鹿児島県: "46",
  沖縄県: "47",
};

export function isValidPrefectureName(
  name: string
): name is keyof typeof PREFECTURE_CODES {
  return name in PREFECTURE_CODES;
}
