/**
 * 日本語の人名（主に議員名）の表記ゆれを吸収するための共通モジュール。
 *
 * 【なぜ必要か】
 *   data/legislators.json の `name` は、衆参両院の公式サイトの表記をそのまま
 *   持っているため、姓名の間に全角スペース（U+3000）が桁揃えのために
 *   0〜4文字入る（例:「逢沢　　一郎」「東　　　　徹」）。712名中703名（98.7%）が
 *   このパターンで、単純な文字列一致では
 *     - 外部データ（記名投票・質問主意書・選挙結果など）との突合
 *     - UI側の氏名検索（利用者は「逢沢一郎」とスペース無しで入力する）
 *   の双方が失敗する。
 *
 *   各 fetch スクリプトが個別に `normalizeName()` / `stripNameSpaces()` を
 *   持っていて実装が微妙にばらついていたため、ここに集約する。
 *
 * 【置き場所について】
 *   Next.js側（`src/app/legislators/page.tsx` の検索）と scripts/ 側
 *   （fetch-*.ts のID紐付け）の両方から使うため `src/lib/` に置く。
 *   `server-only` も Node.js 固有APIも import しない純粋な関数群なので、
 *   サーバーコンポーネント・クライアントコンポーネント・tsxスクリプトの
 *   いずれからも読み込める。
 *
 * 【照合の段階】
 *   誤結合（別人を同一人物とみなすこと）を避けるため、ゆるい正規化ほど
 *   後段に回し、かつ「候補が一意に定まるときだけ」採用する:
 *     1. 正規化キー（NFKC・空白除去・敬称除去）での一致
 *     2. 異体字畳み込みキー（旧字体・人名異体字を常用字体へ寄せる）での一致
 *     3. かなキー（カタカナ→ひらがな、空白除去）での一致
 *   さらに各段階で「同じ院の議員」→「院を問わない全議員」の順に見る
 *   （参議院議員が衆議院に鞍替えする等で、当時の院と現在の院が食い違うため）。
 */

/**
 * 旧字体・人名異体字 → 常用字体の対応表。
 *
 * 「嶋/島」「冨/富」「斉/斎」のように、本来は別姓として区別される字も含む。
 * これらを無条件に同一視すると別人を取り違えるため、この畳み込みは
 * 「正規化キーでの一致が取れなかった場合のフォールバック」としてのみ使い、
 * かつ候補が一意のときだけ採用する（`resolveName()` 参照）。
 */
const VARIANT_CHAR_MAP: Readonly<Record<string, string>> = {
  // 人名でよく見る異体字（JIS第3・第4水準を含む）
  "髙": "高",
  "﨑": "崎",
  "嵜": "崎",
  "濵": "浜",
  "濱": "浜",
  "邊": "辺",
  "邉": "辺",
  "曻": "昇",
  "桒": "桑",
  "栁": "柳",
  "槗": "橋",
  "德": "徳",
  "瀨": "瀬",
  "嶋": "島",
  "嶌": "島",
  "冨": "富",
  "﨏": "沢",
  "澤": "沢",
  // 斎/斉/齋/齊 はすべて「斎」に寄せる（1文字ずつの単純置換なので、
  // 「齊→斉→斎」のような多段変換にならないよう終端の字へ直接マップする）
  "齋": "斎",
  "齊": "斎",
  "斉": "斎",
  // 旧字体（人名に現れうるものを中心に）
  "亞": "亜",
  "惡": "悪",
  "爲": "為",
  "醫": "医",
  "壹": "壱",
  "榮": "栄",
  "衞": "衛",
  "圓": "円",
  "鹽": "塩",
  "奧": "奥",
  "橫": "横",
  "溫": "温",
  "假": "仮",
  "價": "価",
  "會": "会",
  "樂": "楽",
  "卷": "巻",
  "關": "関",
  "歸": "帰",
  "氣": "気",
  "龜": "亀",
  "舊": "旧",
  "擧": "挙",
  "峽": "峡",
  "敎": "教",
  "曉": "暁",
  "區": "区",
  "驅": "駆",
  "勳": "勲",
  "徑": "径",
  "經": "経",
  "惠": "恵",
  "藝": "芸",
  "儉": "倹",
  "劍": "剣",
  "檢": "検",
  "縣": "県",
  "顯": "顕",
  "嚴": "厳",
  "廣": "広",
  "效": "効",
  "號": "号",
  "國": "国",
  "雜": "雑",
  "殘": "残",
  "齒": "歯",
  "兒": "児",
  "實": "実",
  "寫": "写",
  "舍": "舎",
  "壽": "寿",
  "收": "収",
  "從": "従",
  "澁": "渋",
  "縱": "縦",
  "處": "処",
  "將": "将",
  "涉": "渉",
  "燒": "焼",
  "稱": "称",
  "證": "証",
  "乘": "乗",
  "條": "条",
  "淨": "浄",
  "疊": "畳",
  "讓": "譲",
  "寢": "寝",
  "愼": "慎",
  "眞": "真",
  "圖": "図",
  "粹": "粋",
  "數": "数",
  "樞": "枢",
  "靜": "静",
  "攝": "摂",
  "專": "専",
  "戰": "戦",
  "淺": "浅",
  "潛": "潜",
  "纖": "繊",
  "踐": "践",
  "錢": "銭",
  "禪": "禅",
  "雙": "双",
  "壯": "壮",
  "搜": "捜",
  "插": "挿",
  "巢": "巣",
  "爭": "争",
  "總": "総",
  "莊": "荘",
  "裝": "装",
  "藏": "蔵",
  "屬": "属",
  "續": "続",
  "體": "体",
  "對": "対",
  "帶": "帯",
  "臺": "台",
  "擇": "択",
  "單": "単",
  "擔": "担",
  "團": "団",
  "彈": "弾",
  "斷": "断",
  "遲": "遅",
  "晝": "昼",
  "蟲": "虫",
  "鑄": "鋳",
  "廳": "庁",
  "徵": "徴",
  "聽": "聴",
  "鎭": "鎮",
  "傳": "伝",
  "轉": "転",
  "點": "点",
  "黨": "党",
  "燈": "灯",
  "當": "当",
  "鬪": "闘",
  "獨": "独",
  "讀": "読",
  "屆": "届",
  "繩": "縄",
  "惱": "悩",
  "腦": "脳",
  "拜": "拝",
  "賣": "売",
  "麥": "麦",
  "發": "発",
  "髮": "髪",
  "拔": "抜",
  "祕": "秘",
  "甁": "瓶",
  "拂": "払",
  "佛": "仏",
  "倂": "併",
  "竝": "並",
  "變": "変",
  "辯": "弁",
  "辨": "弁",
  "瓣": "弁",
  "舖": "舗",
  "步": "歩",
  "寶": "宝",
  "豐": "豊",
  "沒": "没",
  "每": "毎",
  "萬": "万",
  "滿": "満",
  "默": "黙",
  "彌": "弥",
  "藥": "薬",
  "譯": "訳",
  "豫": "予",
  "餘": "余",
  "與": "与",
  "譽": "誉",
  "搖": "揺",
  "樣": "様",
  "來": "来",
  "賴": "頼",
  "亂": "乱",
  "覽": "覧",
  "龍": "竜",
  "兩": "両",
  "獵": "猟",
  "綠": "緑",
  "淚": "涙",
  "壘": "塁",
  "曆": "暦",
  "歷": "歴",
  "戀": "恋",
  "鍊": "錬",
  "爐": "炉",
  "勞": "労",
  "樓": "楼",
  "錄": "録",
  "灣": "湾",
  "內": "内",
  "巖": "巌",
  "圡": "土",
  "瀧": "滝",
  "靑": "青",
  "淸": "清",
  "槇": "槙",
};

/**
 * 議員名の末尾に付く敬称。
 * 参議院・衆議院の議事情報では「神谷　　宗幣君」のように「君」が付く。
 */
const HONORIFIC_SUFFIX_RE = /(君|氏|さん|議員|委員長|議長|大臣)+$/;

/** 空白（半角・全角・タブ等）をすべて取り除く。JSの`\s`はU+3000を含む */
export function stripNameWhitespace(raw: string): string {
  return raw.replace(/[\s　]+/g, "");
}

/**
 * 氏名の照合キーを作る（第1段階）。
 *   - NFKC正規化（半角カナ・全角英数などの揺れを吸収）
 *   - 空白除去（全角スペースU+3000を含む）
 *   - 末尾の敬称（君・氏・さん 等）を除去
 *   - 中黒・ピリオド等の区切り記号を除去（外国人名表記の揺れ対策）
 */
export function normalizeNameKey(raw: string): string {
  if (!raw) return "";
  return stripNameWhitespace(raw.normalize("NFKC"))
    .replace(HONORIFIC_SUFFIX_RE, "")
    .replace(/[・.,、。'"`]/g, "")
    .trim();
}

/**
 * 異体字を畳み込んだ照合キーを作る（第2段階）。
 * `normalizeNameKey()` の結果に `VARIANT_CHAR_MAP` を適用する。
 */
export function foldNameVariants(raw: string): string {
  const normalized = normalizeNameKey(raw);
  let folded = "";
  for (const ch of normalized) {
    folded += VARIANT_CHAR_MAP[ch] ?? ch;
  }
  return folded;
}

/**
 * かなの照合キーを作る（第3段階）。
 *   - NFKC正規化（半角カナ「ｶﾞ」→「ガ」等）
 *   - 空白除去
 *   - カタカナ→ひらがな（データソースにより「アオキ　アイ」「あおき　あい」が混在）
 *   - 末尾の敬称を除去
 *
 * 漢字を渡した場合はほぼそのまま返るため、かな以外の文字列を誤って
 * かなキーとして扱っても、かなキー同士では一致しない（誤マッチしない）。
 */
export function normalizeKanaKey(raw: string): string {
  if (!raw) return "";
  const normalized = stripNameWhitespace(raw.normalize("NFKC")).replace(
    HONORIFIC_SUFFIX_RE,
    ""
  );
  // カタカナ（U+30A1〜U+30F6）をひらがな（U+3041〜U+3096）へ寄せる。
  // 「ー」（U+30FC）や「・」はこの範囲外なので影響を受けない。
  return normalized.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/** 名寄せ対象（議員に限らず使えるよう最小限のフィールドだけ要求する） */
export interface NameIndexEntry {
  id: string;
  name: string;
  nameKana?: string;
  /** 「衆議院」「参議院」など。省略時は院での絞り込みを行わない */
  chamber?: string;
}

/** どの段階で一致したか（ログ・デバッグ用） */
export type NameMatchMethod =
  | "name" // 正規化キー・同院
  | "name-cross-chamber" // 正規化キー・他院（鞍替え等）
  | "variant" // 異体字畳み込み・同院
  | "variant-cross-chamber"
  | "kana" // かな・同院
  | "kana-cross-chamber";

export type NameMatchFailure =
  | "not-found" // どの段階でも候補が見つからなかった
  | "ambiguous"; // 同姓同名等で候補が複数あり、一意に定まらなかった

export type NameResolution =
  | { id: string; entry: NameIndexEntry; method: NameMatchMethod }
  | { id: null; entry: null; reason: NameMatchFailure };

type KeyedBuckets = Map<string, NameIndexEntry[]>;

interface Buckets {
  name: KeyedBuckets;
  variant: KeyedBuckets;
  kana: KeyedBuckets;
}

export interface NameIndex {
  /** 院を問わない全体のインデックス */
  all: Buckets;
  /** 院ごとのインデックス（chamberが未設定のエントリは含まない） */
  byChamber: Map<string, Buckets>;
  size: number;
}

function emptyBuckets(): Buckets {
  return { name: new Map(), variant: new Map(), kana: new Map() };
}

function pushBucket(buckets: KeyedBuckets, key: string, entry: NameIndexEntry) {
  if (!key) return;
  const list = buckets.get(key);
  if (list) list.push(entry);
  else buckets.set(key, [entry]);
}

function addToBuckets(buckets: Buckets, entry: NameIndexEntry) {
  pushBucket(buckets.name, normalizeNameKey(entry.name), entry);
  pushBucket(buckets.variant, foldNameVariants(entry.name), entry);
  if (entry.nameKana) {
    pushBucket(buckets.kana, normalizeKanaKey(entry.nameKana), entry);
  }
}

/** 名寄せ用インデックスを構築する */
export function buildNameIndex(entries: readonly NameIndexEntry[]): NameIndex {
  const index: NameIndex = {
    all: emptyBuckets(),
    byChamber: new Map(),
    size: entries.length,
  };
  for (const entry of entries) {
    addToBuckets(index.all, entry);
    if (entry.chamber) {
      let buckets = index.byChamber.get(entry.chamber);
      if (!buckets) {
        buckets = emptyBuckets();
        index.byChamber.set(entry.chamber, buckets);
      }
      addToBuckets(buckets, entry);
    }
  }
  return index;
}

export interface ResolveNameOptions {
  /**
   * 優先して照合する院。指定すると「同院で一意」を先に試し、
   * 見つからなければ院を問わない照合にフォールバックする。
   */
  chamber?: string;
  /** 氏名のよみ（データソース側が持っている場合のみ）。第3段階で使う */
  kana?: string;
  /**
   * 他院へのフォールバックを許可するか（既定: true）。
   * 参議院の記名投票のように「当時は参議院議員だが現在は衆議院議員」という
   * ケースを拾うために必要。誤結合を厳格に避けたい場合は false にする。
   */
  allowCrossChamber?: boolean;
}

function uniqueFrom(
  buckets: Buckets | undefined,
  kind: keyof Buckets,
  key: string
): { entry: NameIndexEntry | null; ambiguous: boolean } {
  if (!buckets || !key) return { entry: null, ambiguous: false };
  const list = buckets[kind].get(key);
  if (!list || list.length === 0) return { entry: null, ambiguous: false };
  if (list.length > 1) return { entry: null, ambiguous: true };
  return { entry: list[0] ?? null, ambiguous: false };
}

/**
 * 表記ゆれのある氏名から、インデックス上の1エントリを解決する。
 *
 * 候補が複数ある（同姓同名など）場合は誤結合を避けるため解決しない
 * （`{ id: null, reason: "ambiguous" }` を返す）。
 */
export function resolveName(
  index: NameIndex,
  rawName: string,
  options: ResolveNameOptions = {}
): NameResolution {
  const { chamber, kana, allowCrossChamber = true } = options;
  const chamberBuckets = chamber ? index.byChamber.get(chamber) : undefined;

  const nameKey = normalizeNameKey(rawName);
  const variantKey = foldNameVariants(rawName);
  const kanaKey = kana ? normalizeKanaKey(kana) : "";

  // 段階（正規化キー → 異体字畳み込み → かな）ごとに、
  // 「同院で一意」→「院を問わず一意」の順に見ていく。
  const stages: { kind: keyof Buckets; key: string; method: NameMatchMethod }[] = [
    { kind: "name", key: nameKey, method: "name" },
    { kind: "variant", key: variantKey, method: "variant" },
    { kind: "kana", key: kanaKey, method: "kana" },
  ];

  let sawAmbiguous = false;
  for (const stage of stages) {
    if (!stage.key) continue;

    if (chamberBuckets) {
      const scoped = uniqueFrom(chamberBuckets, stage.kind, stage.key);
      if (scoped.entry) {
        return { id: scoped.entry.id, entry: scoped.entry, method: stage.method };
      }
      if (scoped.ambiguous) sawAmbiguous = true;
      if (!allowCrossChamber) continue;
    }

    const global = uniqueFrom(index.all, stage.kind, stage.key);
    if (global.entry) {
      return {
        id: global.entry.id,
        entry: global.entry,
        // 院を指定していて、かつ全体側でしか見つからなかった場合は
        // 「他院で見つかった（鞍替え等の可能性）」ことを呼び出し側へ伝える
        method: chamberBuckets
          ? (`${stage.method}-cross-chamber` as NameMatchMethod)
          : stage.method,
      };
    }
    if (global.ambiguous) sawAmbiguous = true;
  }

  return { id: null, entry: null, reason: sawAmbiguous ? "ambiguous" : "not-found" };
}

/**
 * UIの氏名検索用の部分一致判定。
 *
 * 利用者は「逢沢一郎」のようにスペース無しで入力するが、データ側は
 * 「逢沢　　一郎」なので生の `String.includes` では一致しない。
 * 漢字（正規化キー・異体字畳み込みキー）とかな（`nameKana`）の
 * いずれかに部分一致すればヒットとする。
 *
 * かな検索では、利用者がカタカナ／ひらがなのどちらで入力してもよい。
 */
export function matchesNameQuery(
  query: string,
  target: { name: string; nameKana?: string }
): boolean {
  const raw = query.trim();
  if (!raw) return true;

  // 生の文字列での部分一致（従来の挙動。全角スペース込みで検索した場合に効く）
  if (target.name.includes(raw)) return true;
  if (target.nameKana?.includes(raw)) return true;

  const nameKey = normalizeNameKey(raw);
  if (nameKey && normalizeNameKey(target.name).includes(nameKey)) return true;

  const variantKey = foldNameVariants(raw);
  if (variantKey && foldNameVariants(target.name).includes(variantKey)) return true;

  if (target.nameKana) {
    const kanaKey = normalizeKanaKey(raw);
    if (kanaKey && normalizeKanaKey(target.nameKana).includes(kanaKey)) return true;
  }

  return false;
}
