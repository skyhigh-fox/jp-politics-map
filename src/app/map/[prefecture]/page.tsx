import Link from "next/link";
import { notFound } from "next/navigation";
import { getLegislators } from "@/lib/data";
import {
  PREFECTURE_CODES,
  isValidPrefectureName,
  legislatorPrefectures,
} from "@/lib/prefectures";
import { MunicipalityMap } from "@/components/MunicipalityMap";
import { getLocalAssemblyMemberCountsByMunicipality } from "@/lib/localAssembly";

const MUNICIPALITY_GEO_BASE =
  "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0010";

export default async function PrefectureDetailPage({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}) {
  const { prefecture: rawPrefecture } = await params;
  const prefecture = decodeURIComponent(rawPrefecture);
  if (!isValidPrefectureName(prefecture)) notFound();

  const code = PREFECTURE_CODES[prefecture];
  const geoUrl = `${MUNICIPALITY_GEO_BASE}/N03-21_${code}_210101.json`;

  const legislators = await getLegislators();
  const relatedCount = legislators.filter((l) =>
    legislatorPrefectures(l).includes(prefecture)
  ).length;

  const localCounts = await getLocalAssemblyMemberCountsByMunicipality(
    prefecture
  );

  return (
    <div>
      <p className="text-sm">
        <Link href="/map" className="underline">
          ← 都道府県マップに戻る
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-bold">{prefecture}</h1>
      <p className="mt-2 text-sm text-neutral-600">
        国会議員（関連） {relatedCount} 名 —{" "}
        <Link
          href={`/legislators?prefecture=${encodeURIComponent(prefecture)}`}
          className="underline"
        >
          一覧を見る
        </Link>
      </p>

      <div className="mt-6 max-w-xl">
        <MunicipalityMap
          geoUrl={geoUrl}
          counts={localCounts ?? undefined}
          linkBase={
            localCounts ? `/local/${encodeURIComponent(prefecture)}` : undefined
          }
        />
      </div>

      {localCounts ? (
        <p className="mt-4 text-xs text-neutral-500">
          市区町村をクリックすると、その地域選出の地方議会議員一覧に移動します。
        </p>
      ) : (
        <p className="mt-4 text-xs text-neutral-500">
          地方議会議員データは現在フェーズ3のパイロット対象自治体のみ整備中です。
        </p>
      )}
    </div>
  );
}
