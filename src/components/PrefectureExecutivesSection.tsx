import {
  TERM_EXPIRY_ELECTION_LAW_NOTE,
  type ExecutiveElectionSchedule,
  executiveTitle,
  formatElectionWindow,
  formatJapaneseDate,
} from "@/lib/electionCalendar";
import { formatAsOfDate } from "@/lib/localPartyCompositionStats";
import type { LocalExecutive, PrefectureExecutives } from "@/types";

/**
 * 都道府県詳細ページ用「知事・首長」＋「選挙カレンダー」セクション
 * （機能拡充ロードマップ Tier1 #8）。
 *
 * 中立性の方針（重要）:
 * - 連続就任回数は原資料の項目名（「連続就任回数」）と数値をそのまま示す。
 *   「多選」「長期政権」等の評価的な語や、回数の多寡についての注釈は付けない。
 * - 都道府県間の比較・ランキングはしない（このセクションは1都道府県分の
 *   事実のみを表示し、他県の値を参照しない）。
 * - 選挙カレンダーは「任期満了日」という確定した記載と、そこから法令の定めで
 *   導いた「見込みの期間」を視覚的に区別し、確定した期日ではないことを明記する。
 */

function ExecutiveFacts({ executive }: { executive: LocalExecutive }) {
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-neutral-600 dark:text-neutral-400">
      <dt className="text-neutral-500 dark:text-neutral-500">連続就任回数</dt>
      <dd className="tabular-nums">
        {executive.consecutiveTerms !== null
          ? `${executive.consecutiveTerms}回`
          : "―"}
      </dd>
      <dt className="text-neutral-500 dark:text-neutral-500">任期満了日</dt>
      <dd className="tabular-nums">
        {formatJapaneseDate(executive.termEndDate)}
      </dd>
    </dl>
  );
}

export function PrefectureExecutivesSection({
  data,
  calendar,
  referenceDate,
}: {
  data: PrefectureExecutives;
  /** 任期満了日の早い順（src/lib/electionCalendar.ts で算出） */
  calendar: ExecutiveElectionSchedule[];
  /** 「任期満了日を経過しているか」の判定に使った基準日（YYYY-MM-DD） */
  referenceDate: string;
}) {
  const { governor, designatedCityMayors } = data;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          知事・首長
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
          {formatAsOfDate(data.asOfDate)}。総務省「地方公共団体の長の連続就任回数調」。氏名・回数・日付は原資料のとおりです。
        </p>

        {governor ? (
          <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <div className="text-xs text-neutral-500 dark:text-neutral-500">
              {executiveTitle(governor)}
            </div>
            <div className="mt-0.5 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {governor.displayName ?? "―"}
            </div>
            <ExecutiveFacts executive={governor} />
          </div>
        ) : (
          <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-500">
            調査基準日時点の原資料に、この都道府県の知事の記載がありません。推測による補完はしていません。
          </p>
        )}

        {designatedCityMayors.length > 0 && (
          <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              指定都市の市長
            </h3>
            <ul className="mt-2 space-y-3">
              {designatedCityMayors.map((mayor) => (
                <li key={mayor.bodyName}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-500">
                      {executiveTitle(mayor)}
                    </span>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {mayor.displayName ?? "―"}
                    </span>
                  </div>
                  <ExecutiveFacts executive={mayor} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {calendar.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            選挙カレンダー（首長）
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            任期満了日から、{TERM_EXPIRY_ELECTION_LAW_NOTE}
            に基づいて算出した見込みの時期です。<strong className="font-semibold">確定した選挙期日ではありません</strong>
            。辞職・失職等による退職があった場合は、任期満了日そのものが変わります。
          </p>
          <ul className="mt-3 space-y-3">
            {calendar.map((schedule) => {
              const window = formatElectionWindow(schedule);
              return (
                <li
                  key={`${schedule.executive.type}-${schedule.executive.bodyName}`}
                  className="border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {schedule.electionName}
                    </span>
                    <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-500">
                      任期満了日 {formatJapaneseDate(schedule.termEndDate)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {window
                      ? `次の選挙（任期満了による場合）の見込み: ${window}`
                      : "原資料に任期満了年月日の記載がないため、見込みの時期を算出していません。"}
                  </p>
                  {schedule.isPastDue && (
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-500">
                      この任期満了日は、本サイトのデータ更新時点（{formatJapaneseDate(referenceDate)}）で既に経過しています。調査基準日以降に行われた選挙の結果は反映されていません。
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
