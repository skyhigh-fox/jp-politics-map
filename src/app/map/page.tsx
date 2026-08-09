import { getLegislators } from "@/lib/data";
import { countLegislatorsByPrefecture } from "@/lib/prefectures";
import { PrefectureMap } from "@/components/PrefectureMap";

export default async function MapPage() {
  const legislators = await getLegislators();
  const counts = countLegislatorsByPrefecture(legislators);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        都道府県マップ
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        都道府県ごとの関連国会議員数（小選挙区・参議院選挙区の当該都道府県選出議員
        ＋ 比例代表で当該都道府県を含むブロック選出議員の合計）を色の濃さで表示。
        都道府県をクリックすると、その都道府県に関連する議員の一覧に移動します。
      </p>
      {legislators.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
          データ未取得です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:all
          </code>
          で取得してください。
        </p>
      ) : (
        <div className="mt-6 max-w-xl">
          <PrefectureMap counts={counts} />
        </div>
      )}
    </div>
  );
}
