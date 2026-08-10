import type { Chamber, Party, PartyChamberProfile } from "@/types";

/**
 * 政党・会派マスタ（data/parties.json）を「院を意識して」参照するためのヘルパー群。
 *
 * 【なぜ必要か】
 * 会派は衆議院・参議院それぞれで別個に届け出られる院内グループで、同じ政党が母体でも
 * 院によって正式名称が異なる（例: 国民民主党 → 衆議院「国民民主党・無所属クラブ」/
 * 参議院「国民民主党・新緑風会」）。さらに片方の院にしか存在しない会派もある
 * （衆議院のみ「中道改革連合・無所属」、参議院のみ「公明党」「立憲民主・無所属」等）。
 *
 * 院が特定できる文脈（議員詳細・院別の議席配置図・院別フィルタ等）では必ず
 * partyDisplayName(party, chamber) を使い、その院の正式会派名を表示すること。
 * 院をまたいだ集計（都道府県別の議席構成など、衆参の議員を合算する箇所）では
 * chamber を渡さず、共通表示名（Party.name）を使う。
 *
 * これらの関数はサーバー・クライアント双方のコンポーネントから使うため、
 * src/lib/data.ts（"server-only"）とは別ファイルに置いている。
 */

/** その院での会派プロフィールを返す。その院に会派が存在しない場合は undefined */
export function partyChamberProfile(
  party: Party | undefined,
  chamber: Chamber | undefined
): PartyChamberProfile | undefined {
  if (!party || !chamber) return undefined;
  return party.chambers?.[chamber];
}

/**
 * 表示用の会派名を返す。
 * chamber を渡した場合はその院の正式会派名を最優先する（無ければ共通表示名）。
 * party 自体が見つからない場合は、原因を追える形で partyId をそのまま返す。
 */
export function partyDisplayName(
  party: Party | undefined,
  chamber?: Chamber,
  fallback = "不明"
): string {
  if (!party) return fallback;
  return partyChamberProfile(party, chamber)?.name ?? party.name;
}

/**
 * 表示用の会派略称を返す（凡例など横幅が限られる箇所向け）。
 * 略称が無い場合は名称にフォールバックする。
 */
export function partyDisplayAbbreviation(
  party: Party | undefined,
  chamber?: Chamber,
  fallback = "不明"
): string {
  if (!party) return fallback;
  const profile = partyChamberProfile(party, chamber);
  return (
    profile?.abbreviation ??
    profile?.name ??
    party.abbreviation ??
    party.name
  );
}

/**
 * その院に会派が存在する政党だけを抜き出す（院フィルタの選択肢生成用）。
 *
 * chambers を持たない古い形式のデータが紛れ込んだ場合は、院の情報が無い＝
 * 除外の根拠が無いということなので、取りこぼしを防ぐため残す方に倒す。
 */
export function partiesInChamber(parties: Party[], chamber: Chamber): Party[] {
  return parties.filter((p) => !p.chambers || p.chambers[chamber]);
}

/** その院に所属議員がいる会派の議員数（公式発表値）。未取得なら undefined */
export function partyOfficialMemberCount(
  party: Party | undefined,
  chamber: Chamber
): number | undefined {
  return partyChamberProfile(party, chamber)?.memberCount;
}
