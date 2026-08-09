import Link from "next/link";
import { notFound } from "next/navigation";
import { getLegislators, getParties, getElectionResults } from "@/lib/data";

export default async function LegislatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const [legislators, parties, electionResults] = await Promise.all([
    getLegislators(),
    getParties(),
    getElectionResults(),
  ]);

  const legislator = legislators.find((l) => l.id === id);
  if (!legislator) notFound();

  const party = parties.find((p) => p.id === legislator.currentPartyId);
  const results = electionResults
    .filter((r) => r.legislatorId === id)
    .sort((a, b) => b.electionYear - a.electionYear);

  return (
    <div className="max-w-2xl">
      <p className="text-sm">
        <Link href="/legislators" className="underline">
          ← 議員一覧に戻る
        </Link>
      </p>

      <div className="mt-4 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-lg font-semibold text-neutral-600">
          {legislator.name.slice(0, 1)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{legislator.name}</h1>
          {legislator.nameKana && (
            <p className="text-sm text-neutral-500">{legislator.nameKana}</p>
          )}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">院</dt>
        <dd>{legislator.chamber}</dd>
        <dt className="text-neutral-500">政党・会派</dt>
        <dd>{party?.name ?? "不明"}</dd>
        <dt className="text-neutral-500">選挙区</dt>
        <dd>
          {legislator.district}（{legislator.electionType}）
        </dd>
        <dt className="text-neutral-500">現在の状況</dt>
        <dd>{legislator.termStatus}</dd>
        {legislator.officialUrl && (
          <>
            <dt className="text-neutral-500">公式プロフィール</dt>
            <dd>
              <a
                href={legislator.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {legislator.officialUrl}
              </a>
            </dd>
          </>
        )}
      </dl>

      <h2 className="mt-8 text-lg font-bold">選挙結果</h2>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          選挙結果データは現時点で見つかりませんでした（2025年参議院選挙区のみ収集済み。詳細はデータソース調査を参照）。
        </p>
      ) : (
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-2 pr-4">年</th>
              <th className="py-2 pr-4">選挙区</th>
              <th className="py-2 pr-4">得票数</th>
              <th className="py-2 pr-4">順位</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2 pr-4">{r.electionYear}</td>
                <td className="py-2 pr-4">
                  {r.district}（{r.electionType}）
                </td>
                <td className="py-2 pr-4">
                  {r.votes !== null ? `${r.votes.toLocaleString()}票` : "―"}
                </td>
                <td className="py-2 pr-4">
                  {r.rank !== null && r.totalCandidates !== null
                    ? `${r.rank} / ${r.totalCandidates}`
                    : "―"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-8 text-xs text-neutral-400">
        出典: {legislator.sourceRef}
      </p>
    </div>
  );
}
