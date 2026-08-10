import {
  LOCAL_ASSEMBLY_BODY_TYPES,
  LOCAL_EXECUTIVE_BODY_TYPES,
  type LocalAssemblyPartyComposition,
  type LocalGovernmentBodyType,
  type LocalPartyCompositionBody,
  type Party,
} from "@/types";

/**
 * 地方議会・長の党派別構成（機能拡充ロードマップ Tier1 #6）の表示用ヘルパー。
 *
 * 中立性の方針（重要）:
 * - 党派の並び順は総務省の原表の列順のまま固定する。人数の多い順に並べ替えると
 *   「1位の党」を作り出す表示になるため行わない。
 * - 占有率は事実として算出するが、「過半数」「与党」等の解釈ラベルは付けない。
 * - 都道府県間の比較・ランキング・順位付けは一切行わない（この機能では
 *   1都道府県の内訳のみを表示する。Budget Phase Cを中立性リスクで保留した
 *   判断と同じ考え方）。
 * - 男女別の内訳は原データにもUIにも持たせない（別ロードマップ項目のため
 *   本機能のスコープ外）。
 */

/**
 * 政党マスタに存在しない党派カテゴリ（現行データでは「諸派」のみ）の表示色。
 *
 * 「諸派」は複数の少数政党をまとめた原表側のカテゴリであり、特定の政党を
 * 指さないため、印象を持たない中立グレーを充てる。政党マスタの
 * 「無所属」(#9E9E9E) と完全に同色だと見分けが付かなくなるため、
 * 明度だけを変えた別トーンのグレーにしている（彩度は持たせない）。
 */
export const NON_PARTY_CATEGORY_COLOR = "#C7C7C7";

/** 区分の大分類（議会/長）。長は独任制で「議席構成」ではないため分けて扱う */
export interface LocalBodyGroup {
  label: string;
  description: string;
  bodyTypes: LocalGovernmentBodyType[];
}

export const LOCAL_BODY_GROUPS: LocalBodyGroup[] = [
  {
    label: "議会",
    description: "議員の所属党派別人員",
    bodyTypes: LOCAL_ASSEMBLY_BODY_TYPES,
  },
  {
    label: "長",
    description: "知事・市区長・町村長の所属党派別人員",
    bodyTypes: LOCAL_EXECUTIVE_BODY_TYPES,
  },
];

/** 積み上げバー1本分のセグメント（＝1党派） */
export interface LocalPartySegment {
  name: string;
  partyId: string | null;
  count: number;
  /** 現員に対する占有率（%）。現員0の場合は0 */
  sharePercent: number;
  color: string;
}

/** 1区分（例:「市区議会」）の表示用ビュー */
export interface LocalPartyCompositionView {
  bodyType: LocalGovernmentBodyType;
  fixedNumber: number;
  totalMembers: number;
  vacancies: number;
  /** 人員が1名以上ある党派のみ（並び順は原表の列順のまま） */
  segments: LocalPartySegment[];
}

/**
 * 党派別人員を積み上げバー用のセグメント列に変換する。
 * 人員0の党派は表示から省く（原表の列としては存在するが、
 * 凡例が長くなるだけで内訳としての情報を持たないため）。
 */
export function buildLocalPartyCompositionView(
  body: LocalPartyCompositionBody,
  parties: Party[]
): LocalPartyCompositionView {
  const colorById = new Map(parties.map((p) => [p.id, p.color]));
  const total = body.totalMembers;
  return {
    bodyType: body.bodyType,
    fixedNumber: body.fixedNumber,
    totalMembers: body.totalMembers,
    vacancies: body.vacancies,
    segments: body.parties
      .filter((p) => p.count > 0)
      .map((p) => ({
        name: p.name,
        partyId: p.partyId,
        count: p.count,
        sharePercent: total > 0 ? (p.count / total) * 100 : 0,
        color:
          (p.partyId ? colorById.get(p.partyId) : undefined) ??
          NON_PARTY_CATEGORY_COLOR,
      })),
  };
}

/** 都道府県の全区分を表示用ビューに変換する（原表のシート順のまま） */
export function buildLocalPartyCompositionViews(
  composition: LocalAssemblyPartyComposition,
  parties: Party[]
): LocalPartyCompositionView[] {
  return composition.bodies.map((body) =>
    buildLocalPartyCompositionView(body, parties)
  );
}

/** 調査基準日（YYYY-MM-DD）を「2025年12月31日現在」の表記にする */
export function formatAsOfDate(asOfDate: string): string {
  const m = asOfDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return asOfDate;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日現在`;
}
