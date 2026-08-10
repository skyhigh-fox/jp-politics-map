import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLegislators,
  getParties,
  getElectionResults,
  getNdlSpeechCounts,
  getWrittenQuestionCounts,
} from "@/lib/data";
import { PartyColorDot } from "@/components/PartyColorDot";
import { partyDisplayName } from "@/lib/party";

export default async function LegislatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const [legislators, parties, electionResults, ndlSpeechCounts, writtenQuestions] =
    await Promise.all([
      getLegislators(),
      getParties(),
      getElectionResults(),
      getNdlSpeechCounts(),
      getWrittenQuestionCounts(),
    ]);

  const legislator = legislators.find((l) => l.id === id);
  if (!legislator) notFound();

  const party = parties.find((p) => p.id === legislator.currentPartyId);
  const results = electionResults
    .filter((r) => r.legislatorId === id)
    .sort((a, b) => b.electionYear - a.electionYear);
  const speechStat = ndlSpeechCounts.find((s) => s.legislatorId === id);
  const questionStat = writtenQuestions.find((q) => q.legislatorId === id);

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
          {/* 会派は院ごとに別組織のため、この議員が属する院の正式会派名を表示する */}
          <span>{partyDisplayName(party, legislator.chamber)}</span>
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

      {(speechStat || questionStat) && (
        <>
          <h2 className="mt-8 text-lg font-bold text-neutral-900 dark:text-neutral-50">
            国会活動
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            解釈を要さない客観的な活動量の指標です。多寡による評価・ランキングを意図したものではありません。
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {speechStat && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                  国会での発言回数
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {speechStat.speechCount.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-neutral-500 dark:text-neutral-500">
                    回
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                  国立国会図書館「国会会議録検索システム」より、氏名の部分一致で集計した参考値です。同姓同名の別人の発言が混ざっている可能性があります。
                </p>
              </div>
            )}
            {questionStat && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                  質問主意書の提出数
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {questionStat.questionCount.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-neutral-500 dark:text-neutral-500">
                    件
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                  {questionStat.sessionsCovered.length > 0 && (
                    <>
                      第{Math.min(...questionStat.sessionsCovered)}回〜第
                      {Math.max(...questionStat.sessionsCovered)}回国会で提出。
                    </>
                  )}
                  直近の国会回次のみを対象に衆参公式サイトから集計しています（全期間の集計ではありません）。
                </p>
              </div>
            )}
          </div>
        </>
      )}

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
