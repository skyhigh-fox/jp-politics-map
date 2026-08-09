import Link from "next/link";
import { notFound } from "next/navigation";
import { getLegislators, getParties, getElectionResults } from "@/lib/data";
import { PartyColorDot } from "@/components/PartyColorDot";

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
    <div className="max-w-2xl animate-fade-in">
      <p className="text-sm">
        <Link
          href="/legislators"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← 議員一覧に戻る
        </Link>
      </p>

      <div className="mt-4 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-100 text-lg font-semibold text-accent-700 ring-1 ring-inset ring-accent-600/20 dark:bg-accent-950 dark:text-accent-300 dark:ring-accent-400/30">
          {legislator.name.slice(0, 1)}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            {legislator.name}
          </h1>
          {legislator.nameKana && (
            <p className="text-sm text-neutral-500 dark:text-neutral-500">
              {legislator.nameKana}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-sm shadow-card dark:border-neutral-800 dark:bg-neutral-900">
        <dt className="text-neutral-500 dark:text-neutral-500">院</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {legislator.chamber}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">政党・会派</dt>
        <dd className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
          <PartyColorDot color={party?.color} />
          <span>{party?.name ?? "不明"}</span>
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">選挙区</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {legislator.district}（{legislator.electionType}）
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">現在の状況</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {legislator.termStatus}
        </dd>
        {legislator.officialUrl && (
          <>
            <dt className="text-neutral-500 dark:text-neutral-500">
              公式プロフィール
            </dt>
            <dd className="break-all">
              <a
                href={legislator.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
              >
                {legislator.officialUrl}
              </a>
            </dd>
          </>
        )}
      </dl>

      <h2 className="mt-8 text-lg font-bold text-neutral-900 dark:text-neutral-50">
        選挙結果
      </h2>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
          選挙結果データは現時点で見つかりませんでした（2025年参議院選挙区のみ収集済み。詳細はデータソース調査を参照）。
        </p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 shadow-card dark:border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
                <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                  年
                </th>
                <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                  選挙区
                </th>
                <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                  得票数
                </th>
                <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                  順位
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-900">
              {results.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-2.5 pr-4 text-neutral-800 dark:text-neutral-200">
                    {r.electionYear}
                  </td>
                  <td className="px-4 py-2.5 pr-4 text-neutral-800 dark:text-neutral-200">
                    {r.district}（{r.electionType}）
                  </td>
                  <td className="px-4 py-2.5 pr-4 text-neutral-800 dark:text-neutral-200">
                    {r.votes !== null ? `${r.votes.toLocaleString()}票` : "―"}
                  </td>
                  <td className="px-4 py-2.5 pr-4 text-neutral-800 dark:text-neutral-200">
                    {r.rank !== null && r.totalCandidates !== null
                      ? `${r.rank} / ${r.totalCandidates}`
                      : "―"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-600">
        出典: {legislator.sourceRef}
      </p>
    </div>
  );
}
