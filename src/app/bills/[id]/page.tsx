import Link from "next/link";
import { notFound } from "next/navigation";
import { getBills, getBillStatusHistory } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const [bills, history] = await Promise.all([
    getBills(),
    getBillStatusHistory(),
  ]);

  const bill = bills.find((b) => b.id === id);
  if (!bill) notFound();

  const timeline = history
    .filter((h) => h.billId === id)
    // 同日に複数院で動きがあることもあるため、日付→院の順で安定ソート
    .sort((a, b) => a.date.localeCompare(b.date) || a.house.localeCompare(b.house));

  return (
    <div className="max-w-2xl animate-fade-in">
      <p className="text-sm">
        <Link
          href="/bills"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← 法案一覧に戻る
        </Link>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          {bill.title}
        </h1>
        <StatusBadge status={bill.status} />
      </div>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-sm shadow-card dark:border-neutral-800 dark:bg-neutral-900">
        <dt className="text-neutral-500 dark:text-neutral-500">国会回次</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          第{bill.dietSession}回
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">議案種類</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {bill.category ?? "不明"}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">提出区分</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {bill.submitterType}
        </dd>
        <dt className="text-neutral-500 dark:text-neutral-500">先議院</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">{bill.house}</dd>
        <dt className="text-neutral-500 dark:text-neutral-500">現在の状況</dt>
        <dd className="text-neutral-800 dark:text-neutral-200">
          {bill.status}
        </dd>
        {bill.submittedDate && (
          <>
            <dt className="text-neutral-500 dark:text-neutral-500">提出日</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">
              {bill.submittedDate}
            </dd>
          </>
        )}
        <dt className="text-neutral-500 dark:text-neutral-500">情報源</dt>
        <dd>
          <a
            href={bill.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            衆議院サイトの経過情報を見る
          </a>
        </dd>
      </dl>

      <h2 className="mt-8 text-lg font-bold text-neutral-900 dark:text-neutral-50">
        審議進捗
      </h2>
      {timeline.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
          進捗履歴データは見つかりませんでした。
        </p>
      ) : (
        <ol className="mt-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
          {timeline.map((h, i) => (
            <li key={i} className="relative mb-5 pb-1 last:mb-0">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent-500 ring-4 ring-accent-100 dark:bg-accent-400 dark:ring-accent-950" />
              <div className="text-sm text-neutral-500 dark:text-neutral-500">
                {h.date}
              </div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {h.house} / {h.stage}
              </div>
              {h.note && (
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  {h.note}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
