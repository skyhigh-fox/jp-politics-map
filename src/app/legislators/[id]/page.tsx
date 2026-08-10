import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBillSponsorships,
  getBills,
  getLegislators,
  getParties,
  getElectionResults,
  getNdlSpeechCounts,
  getRollCallVotes,
  getWrittenQuestionCounts,
} from "@/lib/data";
import { PartyColorDot } from "@/components/PartyColorDot";
import { DataCoverageNote } from "@/components/DataCoverageNote";
import { LegislatorBillSponsorshipSection } from "@/components/LegislatorBillSponsorshipSection";
import { LegislatorRollCallVoteSection } from "@/components/LegislatorRollCallVoteSection";
import { partyDisplayName } from "@/lib/party";
import {
  buildBillSponsorshipScopeFacts,
  buildElectionResultCoverage,
  buildNdlSpeechCoverage,
  buildRollCallVoteScopeFacts,
  buildWrittenQuestionCoverage,
} from "@/lib/dataProvenance";
import { buildLegislatorVoteRecords } from "@/lib/rollCallVoteStats";
import type { Bill } from "@/types";

export default async function LegislatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const [
    legislators,
    parties,
    electionResults,
    ndlSpeechCounts,
    writtenQuestions,
    bills,
    billSponsorships,
    rollCallVotes,
  ] = await Promise.all([
    getLegislators(),
    getParties(),
    getElectionResults(),
    getNdlSpeechCounts(),
    getWrittenQuestionCounts(),
    getBills(),
    getBillSponsorships(),
    getRollCallVotes(),
  ]);

  const legislator = legislators.find((l) => l.id === id);
  if (!legislator) notFound();

  // 「この議員が提出者・提出の賛成者として記載されている議案」を集める。
  // 事実の一覧であり、件数の多寡による評価は行わない（コンポーネント側の注記参照）。
  const billById = new Map(bills.map((b) => [b.id, b]));
  const sponsoredBills: Bill[] = [];
  const supportedBills: Bill[] = [];
  for (const sponsorship of billSponsorships) {
    const bill = billById.get(sponsorship.billId);
    if (!bill) continue;
    if (sponsorship.sponsors.some((p) => p.legislatorId === id)) {
      sponsoredBills.push(bill);
    } else if (sponsorship.supporters.some((p) => p.legislatorId === id)) {
      // 提出者として既に挙げた議案は賛成者側に重複表示しない
      supportedBills.push(bill);
    }
  }
  // 新しい国会回次から順に並べる（同回次内は議案件名で安定ソート）
  const bySessionDesc = (a: Bill, b: Bill) =>
    b.dietSession - a.dietSession || a.title.localeCompare(b.title, "ja");
  sponsoredBills.sort(bySessionDesc);
  supportedBills.sort(bySessionDesc);
  const sponsorshipScopeFacts = buildBillSponsorshipScopeFacts(billSponsorships);

  // 参議院本会議の記名投票における、この議員個人の賛否の記録（Tier1 #5）。
  // 「いつ・何に・どう投票したか」の転記のみで、賛成率等の指標化はしない。
  const voteRecords = buildLegislatorVoteRecords(rollCallVotes, id);
  const rollCallScopeFacts = buildRollCallVoteScopeFacts(rollCallVotes);

  const party = parties.find((p) => p.id === legislator.currentPartyId);
  const results = electionResults
    .filter((r) => r.legislatorId === id)
    .sort((a, b) => b.electionYear - a.electionYear);
  const speechStat = ndlSpeechCounts.find((s) => s.legislatorId === id);
  const questionStat = writtenQuestions.find((q) => q.legislatorId === id);

  // 出典・鮮度・欠損の体系的表示: 件数・カバー率はハードコードせず、
  // 表示に使っているデータそのものから毎回算出する（src/lib/dataProvenance.ts）。
  const speechCoverage = buildNdlSpeechCoverage(
    ndlSpeechCounts,
    legislators.length
  );
  const questionCoverage = buildWrittenQuestionCoverage(
    writtenQuestions,
    legislators.length
  );
  const electionCoverage = buildElectionResultCoverage(
    electionResults,
    legislators.length
  );

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

      {(ndlSpeechCounts.length > 0 || writtenQuestions.length > 0) && (
        <>
          <h2 className="mt-8 text-lg font-bold text-neutral-900 dark:text-neutral-50">
            国会活動
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            解釈を要さない客観的な活動量の指標です。多寡による評価・ランキングを意図したものではありません。
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ndlSpeechCounts.length > 0 && (
              <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                  国会での発言回数
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {speechStat ? (
                    <>
                      {speechStat.speechCount.toLocaleString()}
                      <span className="ml-1 text-sm font-normal text-neutral-500 dark:text-neutral-500">
                        回
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400 dark:text-neutral-600">―</span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                  {speechStat
                    ? "国立国会図書館「国会会議録検索システム」より、氏名の部分一致で集計した参考値です。同姓同名の別人の発言が混ざっている可能性があります。"
                    : "この議員については、国立国会図書館「国会会議録検索システム」からの集計結果を取得できていません。"}
                </p>
                {/* 注記は本文の数値より目立たせない（DataCoverageNote側で控えめな配色にしている） */}
                <DataCoverageNote
                  datasetId="ndl-speech-counts"
                  facts={speechCoverage.facts}
                  className="mt-3"
                />
              </div>
            )}
            {writtenQuestions.length > 0 && (
              <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                  質問主意書の提出数
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {questionStat ? (
                    <>
                      {questionStat.questionCount.toLocaleString()}
                      <span className="ml-1 text-sm font-normal text-neutral-500 dark:text-neutral-500">
                        件
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400 dark:text-neutral-600">―</span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                  {questionStat ? (
                    <>
                      {questionStat.sessionsCovered.length > 0 && (
                        <>
                          第{Math.min(...questionStat.sessionsCovered)}回〜第
                          {Math.max(...questionStat.sessionsCovered)}回国会で提出。
                        </>
                      )}
                      直近の国会回次のみを対象に衆参公式サイトから集計しています（全期間の集計ではありません）。
                    </>
                  ) : (
                    <>
                      集計対象の回次では、この議員の提出を確認できていません。提出が0件だった場合と、提出者名を現職議員と照合できなかった場合の区別はついていません。
                    </>
                  )}
                </p>
                <DataCoverageNote
                  datasetId="written-questions"
                  facts={questionCoverage.facts}
                  className="mt-3"
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* データ未取得（fetch:bill-sponsorships 未実行）のときはセクションごと出さない */}
      {billSponsorships.length > 0 && (
        <LegislatorBillSponsorshipSection
          sponsoredBills={sponsoredBills}
          supportedBills={supportedBills}
          coverageFacts={sponsorshipScopeFacts}
        />
      )}

      {/* データ未取得（fetch:roll-call-votes 未実行）のときはセクションごと出さない。
          衆議院議員のページでは、記録が無い理由（起立採決が中心で個人の賛否が
          原則公開されない）をセクション内で明示する */}
      {rollCallVotes.length > 0 && (
        <LegislatorRollCallVoteSection
          records={voteRecords}
          chamber={legislator.chamber}
          totalVoteCount={rollCallVotes.length}
          coverageFacts={rollCallScopeFacts}
        />
      )}

      <h2 className="mt-8 text-lg font-bold text-neutral-900 dark:text-neutral-50">
        選挙結果
      </h2>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
          この議員の得票数は、現在収録している選挙の範囲では見つかりませんでした。
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

      <DataCoverageNote
        datasetId="election-results"
        facts={electionCoverage.facts}
        className="mt-3"
      />

      <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-600">
        出典: {legislator.sourceRef}
      </p>
    </div>
  );
}
