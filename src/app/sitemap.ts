import type { MetadataRoute } from "next";
import { getBills, getLegislators, getRollCallVotes } from "@/lib/data";
import {
  districtToMunicipalities,
  getLocalAssemblyMembers,
} from "@/lib/localAssembly";
import { PREFECTURE_CODES } from "@/lib/prefectures";
import { absoluteUrl } from "@/lib/siteMetadata";

/**
 * sitemap.xml（Next.jsのMetadata Files規約。ビルド時に静的生成される）。
 *
 * 【収録方針と、その判断根拠】
 * 実在する全ページを1ファイルに入れている。内訳は概ね次の通り（2026-08時点）:
 *   静的ページ 10 ＋ 法案 6,985 ＋ 議員 712 ＋ 記名投票 288 ＋ 都道府県 47
 *   ＋ 地方議会の市区町村 60前後 = 約8,100 URL
 *
 * - sitemapの規格上限（1ファイルあたり50,000URL・非圧縮50MB）に対して十分に
 *   余裕があるため、`generateSitemaps()`によるファイル分割はしていない。分割は
 *   URL数が上限に近づいたとき（法案が5万件に迫る、市区町村を全国展開する等）に
 *   初めて必要になる。
 * - ビルド時間への影響は、data配下のJSONを読む分だけ（法案3MB・議員0.4MB・
 *   記名投票11MB）。ページのプリレンダリングは発生しないため数秒で終わる。
 * - 検索結果に出したいのは個別の法案・議員ページそのものなので、「重要度の高い
 *   一覧ページだけに絞る」判断は取らなかった（絞ると6,985件の法案詳細が
 *   クロール対象から外れ、このサイトの主要コンテンツが検索に出なくなる）。
 * - 一覧ページのクエリ付きURL（?house=衆議院 等）は、内容が重複するうえ
 *   組み合わせが膨大になるため収録しない。
 *
 * 【lastModifiedの方針】
 * 原データに更新日を持つもの（法案のlastUpdated、記名投票の投票日）はその値を
 * 使う。更新日を持たないデータ（議員マスタ・都道府県ページ等）はビルド日時を
 * 使う。日次のGitHub Actionsでデータ更新→再デプロイされるため、ビルド日時が
 * 実質の最終更新日になる。
 *
 * 【priorityについて】
 * 主要な検索エンジンはpriorityをほぼ無視するが、サイト内の構造を機械可読な形で
 * 示す意味はあるため、入口（トップ・一覧）を高め、個別ページを低めに置いている。
 * ページの「重要さ」の評価ではなく、サイトの階層構造の表現である。
 */

/** 一覧・案内系の静的ページ。並び順はグローバルナビに合わせている */
const STATIC_PATHS: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/bills", priority: 0.9, changeFrequency: "daily" },
  { path: "/legislators", priority: 0.9, changeFrequency: "weekly" },
  { path: "/votes", priority: 0.8, changeFrequency: "weekly" },
  { path: "/map", priority: 0.8, changeFrequency: "weekly" },
  { path: "/map/districts", priority: 0.8, changeFrequency: "monthly" },
  { path: "/budget", priority: 0.8, changeFrequency: "monthly" },
  { path: "/news", priority: 0.6, changeFrequency: "daily" },
  { path: "/data", priority: 0.6, changeFrequency: "weekly" },
  { path: "/disclaimer", priority: 0.4, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const buildDate = new Date();

  const [bills, legislators, votes, localAssemblyMembers] = await Promise.all([
    getBills(),
    getLegislators(),
    getRollCallVotes(),
    getLocalAssemblyMembers(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: buildDate,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const prefectureEntries: MetadataRoute.Sitemap = Object.keys(
    PREFECTURE_CODES
  ).map((prefecture) => ({
    url: absoluteUrl(`/map/${encodeURIComponent(prefecture)}`),
    lastModified: buildDate,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const billEntries: MetadataRoute.Sitemap = bills.map((bill) => ({
    url: absoluteUrl(`/bills/${encodeURIComponent(bill.id)}`),
    // 議案経過情報の最終更新日。過去の国会の議案はもう動かないため、
    // 「毎日クロールし直す必要はない」ことをこの値で伝えられる。
    lastModified: toDateOrFallback(bill.lastUpdated, buildDate),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const legislatorEntries: MetadataRoute.Sitemap = legislators.map(
    (legislator) => ({
      url: absoluteUrl(`/legislators/${encodeURIComponent(legislator.id)}`),
      lastModified: buildDate,
      changeFrequency: "weekly",
      priority: 0.6,
    })
  );

  const voteEntries: MetadataRoute.Sitemap = votes.map((vote) => ({
    url: absoluteUrl(`/votes/${encodeURIComponent(vote.voteId)}`),
    // 投票結果は事後に変わらないため、投票日をそのまま最終更新日とする
    lastModified: toDateOrFallback(vote.date, buildDate),
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  // 地方議会議員ページのURLは「選挙区 → 市区町村」の対応を展開した先になる。
  // 複数市町村にまたがる選挙区があり同じURLが何度も出てくるため、
  // 組み立てたパスをSetで一意化してから並べる。
  const municipalityPaths = new Set<string>();
  for (const member of localAssemblyMembers) {
    for (const municipality of districtToMunicipalities(member.district)) {
      const prefectureSegment = encodeURIComponent(member.prefecture);
      const municipalitySegment = encodeURIComponent(municipality);
      municipalityPaths.add(
        `/local/${prefectureSegment}/${municipalitySegment}`
      );
    }
  }
  const localEntries: MetadataRoute.Sitemap = [...municipalityPaths]
    .sort()
    .map((path) => ({
      url: absoluteUrl(path),
      lastModified: buildDate,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    }));

  return [
    ...staticEntries,
    ...prefectureEntries,
    ...billEntries,
    ...legislatorEntries,
    ...voteEntries,
    ...localEntries,
  ];
}

/**
 * ISO 8601（YYYY-MM-DD）の文字列をDateにする。
 * 原データ側で日付が欠けている・書式が崩れている行があっても
 * sitemap全体の生成が落ちないよう、パースできない場合はビルド日時に倒す。
 */
function toDateOrFallback(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
