/**
 * 政党・会派マスタ（data/parties.json）の一元管理。
 * 正規idへのエイリアス解決・共通表示名・公式カラー・院別会派プロフィールのマージを担う。
 *
 * 背景1（2026-08-10 調査・PM確定）:
 *   衆議院公式サイトの「会派」列は略称のみ（例:「国民」「みらい」「無」）で記載される一方、
 *   参議院側（SmartNews メディア研究所データ、fetch-sangiin-members.ts）は正式名称ベースの
 *   会派表記（例:「国民民主党・新緑風会」→id: party-民主）を使っている。
 *   この表記ゆれにより、同一政党が衆参で別idの重複レコードとして登録されてしまっていた
 *   （例: 衆議院 party-国民 28人 と 参議院 party-民主 が同一政党なのに別id）。
 *   → PARTY_ALIASES で衆議院側の略称を正規idに寄せることで解決済み。
 *
 * 背景2（2026-08-11 の重大なデータ品質バグ修正）:
 *   背景1の対応で「1政党=1レコード」に統合した結果、今度は逆に
 *   「院ごとに会派名が違う」という事実を表現できなくなり、後から実行された
 *   fetch-sangiin-members.ts が参議院の会派名で name を上書きしていたため、
 *   衆議院議員にも参議院の会派名が表示されるようになっていた。実害:
 *     - 衆議院「国民民主党・無所属クラブ」28名 → 「国民民主党・新緑風会」と誤表示
 *     - 衆議院「チームみらい」11名 → 「チームみらい・無所属の会」と誤表示
 *     - 衆議院「無所属」7名 → 「各派に属しない議員」と誤表示
 *     - 衆議院にしか無い「中道改革連合・無所属」が参議院のフィルタにも出る（逆も同様）
 *   → Party.chambers（院別会派プロフィール）を導入し、各院の一次情報の表記を
 *     そのまま院ごとに保持する。id は従来どおり衆参共通（政党単位）なので、
 *     roll-call-votes.json / party-seat-history.json 等の既存 partyId 参照は壊れない。
 *
 * 各 fetch スクリプトは自分の院の会派プロフィールだけを setChamberProfiles() で
 * 書き込み、もう片方の院の内容には触れない。したがって
 * fetch:sangiin-members / fetch:shugiin-members の実行順序に依存しない。
 */
import type { Chamber, Party, PartyChamberProfile } from "../../src/types";

/**
 * 衆議院側の会派略称（partyIdFromNameの元になる文字列） → 正規の政党id。
 *
 * - "国民" → party-民主（国民民主党・新緑風会。参議院側の正式表記に統合）
 * - "みらい" → party-みら（チームみらい・無所属の会。参議院側の正式表記に統合）
 * - "無" → party-無所属（「無所属」は参議院側の「各派に属しない議員」と実質同じカテゴリ）
 *
 * 「中道」（中道改革連合・無所属）は統合しない。旧公明党系・旧立憲民主党系の議員が
 * ほぼ半数ずつ合流した独立の混成会派であり、単一政党の後継ではないため
 * party-中道 として単独維持する（PM確定方針）。
 */
export const PARTY_ALIASES: Record<string, string> = {
  国民: "party-民主",
  みらい: "party-みら",
  無: "party-無所属",
};

/**
 * 会派略称・正式名称の文字列から、エイリアス解決済みの正規政党idを返す。
 * エイリアスに該当しない場合は従来通り `party-{name}` とする。
 */
export function resolvePartyId(name: string): string {
  return PARTY_ALIASES[name] ? PARTY_ALIASES[name] : `party-${name}`;
}

/**
 * 正規id → 衆参共通で使う表示名（Party.name）。
 *
 * 【なぜ会派名をそのまま使わないか】
 * 会派の正式名称は院ごとに異なる（例: 国民民主党は衆議院「国民民主党・無所属クラブ」、
 * 参議院「国民民主党・新緑風会」）ため、衆参をまたいだ集計（都道府県別の議席構成、
 * 過去選挙の政党別議席推移など）では、どちらか一方の院の会派名を使うと必ず
 * もう一方の院にとって誤った表示になる。そこで「院に依存しない母体政党名」を
 * 共通表示名として持たせる。院が特定できる文脈では常に Party.chambers[院].name
 * （その院の公式会派名）が優先される。
 *
 * 【中立性についての注記】
 * ここでの共通表示名は「会派名に付く院内グループ固有の付加部分（『・無所属の会』
 * 『・新緑風会』『・無所属クラブ』等）を除いた、各政党・団体自身が公称している名称」
 * という一つの機械的な規則を全会派に等しく適用したもので、特定の政党を有利・不利に
 * 扱う調整は一切していない。母体政党が単一でない混成会派（party-中道）や、
 * そもそも政党ではないカテゴリ（party-無所属）は、会派名・カテゴリ名をそのまま用いる。
 */
export const PARTY_CANONICAL_NAMES: Record<string, string> = {
  "party-自民": "自由民主党",
  "party-立憲": "立憲民主党",
  "party-民主": "国民民主党",
  "party-公明": "公明党",
  "party-維新": "日本維新の会",
  "party-参政": "参政党",
  "party-共産": "日本共産党",
  "party-れ新": "れいわ新選組",
  "party-保守": "日本保守党",
  "party-沖縄": "沖縄の風", // 政党ではなく参議院の院内会派。会派名をそのまま用いる
  "party-みら": "チームみらい",
  "party-社民": "社会民主党",
  "party-無所属": "無所属", // 政党ではなくカテゴリ。参議院の公式表記は「各派に属しない議員」
  "party-中道": "中道改革連合", // 複数政党系の混成会派。母体政党名に還元できないため会派名を用いる
};

/**
 * 正規id → 衆参共通で使う略称（Party.abbreviation）。
 * 院別の略称は各院の公式表記（Party.chambers[院].abbreviation）を用いるため、
 * ここは院をまたいだ凡例等で使う共通の短縮表記。
 */
export const PARTY_CANONICAL_ABBREVIATIONS: Record<string, string> = {
  "party-自民": "自民",
  "party-立憲": "立憲",
  "party-民主": "国民",
  "party-公明": "公明",
  "party-維新": "維新",
  "party-参政": "参政",
  "party-共産": "共産",
  "party-れ新": "れ新",
  "party-保守": "保守",
  "party-沖縄": "沖縄",
  "party-みら": "みらい",
  "party-社民": "社民",
  "party-無所属": "無所属",
  "party-中道": "中道",
};

/**
 * 政党id → 公式カラー(hex)。
 *
 * 採用方針（中立性配慮。CLAUDE.md記載の原則に従い、意図的な明暗・彩度調整はしない）:
 *   - 各党の公式サイト・著作物利用ガイドライン等で確認できる色をそのまま採用する。
 *   - 出典が確認できない政党は、印象操作を避けるため中立グレーをフォールバック採用する。
 *   - 詳細な調査経緯・出典URLはObsidian Vault
 *     （jp-politics-map/決定事項ログ.md 2026-08-10）にも記録済み。
 *
 * 個別の注記:
 *   - party-自民（自由民主党）: 公式サイトCSSで使われている赤 #E50012 を採用。
 *     Wikipedia政党色テンプレートには緑 #3CA324 の表記もあるが、報道等で一般的に
 *     使われる赤を採用した（表記ゆれの存在を承知の上での判断）。
 *   - party-民主（国民民主党）: 公式ロゴのメインカラーである黄 #FABE00 を採用。
 *     サブカラーは紺 #003F88（参考情報。UIでは使用しない）。
 *   - party-中道（中道改革連合・無所属）: 旧公明党系・旧立憲民主党系の議員がほぼ
 *     半数ずつ合流した混成会派のため、どちらの母体政党の色も流用せず、
 *     Wikipedia政党色テンプレートで独立項目として既に割り当てられている
 *     #0073BD を採用（中立性を保てる第三の値）。
 *   - party-沖縄（沖縄の風）: 公式カラーの出典が見つからなかったため中立グレーを
 *     フォールバック採用。ただし party-無所属 と完全に同一色にはせず、
 *     視覚的に見分けがつくようやや青みがかった別トーンのグレーにしている。
 *   - party-無所属（各派に属しない議員）: 中立グレー。
 */
export const PARTY_COLORS: Record<string, string> = {
  "party-自民": "#E50012",
  "party-立憲": "#004098",
  "party-民主": "#FABE00",
  "party-公明": "#F55881",
  "party-維新": "#179345",
  "party-参政": "#FF7B00",
  "party-共産": "#DB001C",
  "party-れ新": "#E4027E",
  "party-保守": "#0A82DC",
  "party-沖縄": "#8A97A8", // 出典なし。フォールバックだが party-無所属 と区別できる青みがかったグレー
  "party-みら": "#0F8472",
  "party-社民": "#01A8EC",
  "party-無所属": "#9E9E9E", // 出典なし。中立グレー
  "party-中道": "#0073BD",
};

/**
 * 政党マスタ配列に対し、PARTY_COLORS にエントリがある政党の color を
 * 常に上書きする最終パス。新規追加分だけでなく既存レコードにも適用することで、
 * 日次自動更新のたびにカラー設定が失われないようにする。
 * （PARTY_COLORS を将来書き換えた場合も、スクリプト再実行だけで全体に反映される）
 */
export function applyPartyColors<T extends { id: string; color?: string }>(
  parties: T[]
): T[] {
  return parties.map((p) =>
    PARTY_COLORS[p.id] ? { ...p, color: PARTY_COLORS[p.id] } : p
  );
}

/** 会派マスタへの1院分の入力（各院の公式サイト・公式データの表記そのまま） */
export interface ChamberPartyInput {
  /** resolvePartyId() で解決済みの正規id */
  id: string;
  profile: PartyChamberProfile;
}

/**
 * 指定した院の会派プロフィールだけを丸ごと差し替えて政党マスタを再構築する。
 *
 * - もう片方の院のプロフィール・色・共通表示名は一切壊さない
 *   （2つのfetchスクリプトが同じ parties.json を書くため、実行順序に依存させない）。
 * - 今回の一覧に無くなった会派からは、その院のプロフィールを取り除く
 *   （会派の解散・改称が翌日以降も古い名前で残り続けるのを防ぐ）。
 * - どちらの院にも会派が無くなったレコードも、削除せず chambers なしで残す。
 *   party-seat-history.json / roll-call-votes.json が過去の partyId を参照しており、
 *   マスタから消すと色・名称が解決できなくなるため（警告だけ出す）。
 */
export function setChamberProfiles(
  existing: Party[],
  chamber: Chamber,
  incoming: ChamberPartyInput[]
): Party[] {
  const incomingById = new Map(incoming.map((i) => [i.id, i.profile]));
  const merged = new Map<string, Party>();

  for (const party of existing) {
    // 一旦この院のプロフィールを外してから、今回の一覧の分だけを入れ直す
    const others: Partial<Record<Chamber, PartyChamberProfile>> = {
      ...party.chambers,
    };
    delete others[chamber];
    merged.set(party.id, { ...party, chambers: others });
  }

  for (const { id, profile } of incoming) {
    const base = merged.get(id) ?? { id, name: id.replace(/^party-/, "") };
    merged.set(id, {
      ...base,
      chambers: { ...base.chambers, [chamber]: profile },
    });
  }

  const result: Party[] = [];
  for (const party of merged.values()) {
    const chambers = party.chambers ?? {};
    const hasAny = Object.keys(chambers).length > 0;
    if (!hasAny && !incomingById.has(party.id)) {
      console.warn(
        `[parties] ${party.id}（${party.name}）は衆参いずれの現行会派にも該当しません。` +
          `過去データからの参照用にレコードは残します。`
      );
    }
    result.push({
      ...party,
      // 共通表示名・略称は毎回マスタ定義から再適用する（定義を書き換えたら再実行で全体に反映される）
      name: PARTY_CANONICAL_NAMES[party.id] ?? party.name,
      abbreviation:
        PARTY_CANONICAL_ABBREVIATIONS[party.id] ?? party.abbreviation,
      chambers,
    });
  }

  // 表示順を安定させるため、衆参合計の公式所属議員数の降順で並べる
  // （議席数という客観的基準のみ。イデオロギー等の主観的な並び順は使わない）
  const totalMembers = (p: Party) =>
    Object.values(p.chambers ?? {}).reduce(
      (sum, c) => sum + (c?.memberCount ?? 0),
      0
    );
  result.sort((a, b) => totalMembers(b) - totalMembers(a) || a.id.localeCompare(b.id));

  return applyPartyColors(result);
}
