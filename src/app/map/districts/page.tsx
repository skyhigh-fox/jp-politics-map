import Link from "next/link";
import { getLegislators, getParties, getShugiinDistricts } from "@/lib/data";
import { partyDisplayName } from "@/lib/party";
import {
  districtKeyFromKuname,
  isSangiinDistrictSeat,
  isShugiinSingleSeatDistrict,
  groupLegislatorsByDistrict,
  prefectureOfShugiinDistrict,
  prefecturesOfSangiinDistrict,
  sangiinDistrictKeys,
} from "@/lib/districts";
import { buildDistrictBoundaryCoverage } from "@/lib/dataProvenance";
import { DataCoverageNote } from "@/components/DataCoverageNote";
import {
  DistrictExplorer,
  type DistrictMemberView,
  type DistrictSeat,
} from "@/components/DistrictExplorer";
import type { Chamber, Legislator, Party } from "@/types";

export const metadata = {
  title: "選挙区マップ | 日本政治マップ",
  description:
    "衆議院289小選挙区・参議院45選挙区を地図から選び、その選挙区選出の国会議員を確認できます。",
};

/**
 * 選挙区マップ（機能拡充ロードマップ Tier1 #4）。
 *
 * 都道府県マップ（/map）が「都道府県という行政区画」の地図なのに対し、
 * こちらは「議員が選ばれる単位」の地図。自分の選挙区から議員に辿り着ける
 * 導線を目的にしている。
 *
 * 選挙区の一覧は境界データ（public/data/districts-shugiin-topo.json）から
 * 取り出す。議員データ側から作ると、欠員が出ている選挙区が一覧から
 * 消えてしまうため。
 */

function toMemberView(
  legislator: Legislator,
  partyById: Map<string, Party>,
  chamber: Chamber
): DistrictMemberView {
  const party = partyById.get(legislator.currentPartyId);
  return {
    id: legislator.id,
    name: legislator.name,
    nameKana: legislator.nameKana,
    partyName: partyDisplayName(party, chamber),
    partyColor: party?.color,
  };
}

export default async function DistrictMapPage() {
  const [legislators, parties, districts] = await Promise.all([
    getLegislators(),
    getParties(),
    getShugiinDistricts(),
  ]);

  const partyById = new Map(parties.map((p) => [p.id, p]));

  const shugiinMembers = groupLegislatorsByDistrict(
    legislators,
    isShugiinSingleSeatDistrict
  );
  const shugiin: DistrictSeat[] = districts.map(({ kuname }) => {
    const key = districtKeyFromKuname(kuname);
    const prefecture = prefectureOfShugiinDistrict(key);
    return {
      key,
      label: kuname,
      prefectures: prefecture ? [prefecture] : [],
      members: (shugiinMembers[key] ?? []).map((l) =>
        toMemberView(l, partyById, "衆議院")
      ),
    };
  });

  const sangiinMembers = groupLegislatorsByDistrict(
    legislators,
    isSangiinDistrictSeat
  );
  const sangiin: DistrictSeat[] = sangiinDistrictKeys().map((key) => {
    const prefectures = prefecturesOfSangiinDistrict(key);
    return {
      key,
      label: prefectures.join("・"),
      prefectures,
      members: (sangiinMembers[key] ?? []).map((l) =>
        toMemberView(l, partyById, "参議院")
      ),
    };
  });

  const coverage = buildDistrictBoundaryCoverage(
    districts.map((d) => d.kuname),
    legislators
  );

  return (
    <div className="animate-fade-in">
      <p className="text-sm">
        <Link
          href="/map"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← 都道府県マップ
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        選挙区マップ
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        国会議員が選ばれる単位である選挙区の地図です。衆議院の289小選挙区と、参議院の45選挙区（都道府県単位・合区を含む）を切り替えて、選挙区からその選挙区選出の議員を辿れます。
      </p>

      {shugiin.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
          選挙区の境界データが未生成です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            node scripts/build-shugiin-district-topojson.mjs
          </code>
          で生成してください。
        </p>
      ) : (
        <DistrictExplorer shugiin={shugiin} sangiin={sangiin} />
      )}

      <div className="mt-6 max-w-2xl">
        <DataCoverageNote datasetId="district-boundaries" facts={coverage.facts} />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
        この地図は選挙区の位置と選出議員を確認するためのものです。選挙区ごとの有権者数の違いを強調する図（面積を人口に合わせて変形するカルトグラム等）や、得票率による塗り分けは行っていません。正確な区割りは、総務省および各選挙管理委員会の公表資料をご確認ください。
      </p>
    </div>
  );
}
