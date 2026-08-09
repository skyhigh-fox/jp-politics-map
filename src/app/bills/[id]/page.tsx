import Link from "next/link";
import { notFound } from "next/navigation";
import { getBills, getBillStatusHistory } from "@/lib/data";

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
    <div className="max-w-2xl">
      <p className="text-sm">
        <Link href="/bills" className="underline">
          ← 法案一覧に戻る
        </Link>
      </p>

      <h1 className="mt-2 text-xl font-bold">{bill.title}</h1>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">国会回次</dt>
        <dd>第{bill.dietSession}回</dd>
        <dt className="text-neutral-500">議案種類</dt>
        <dd>{bill.category ?? "不明"}</dd>
        <dt className="text-neutral-500">提出区分</dt>
        <dd>{bill.submitterType}</dd>
        <dt className="text-neutral-500">先議院</dt>
        <dd>{bill.house}</dd>
        <dt className="text-neutral-500">現在の状況</dt>
        <dd>{bill.status}</dd>
        {bill.submittedDate && (
          <>
            <dt className="text-neutral-500">提出日</dt>
            <dd>{bill.submittedDate}</dd>
          </>
        )}
        <dt className="text-neutral-500">情報源</dt>
        <dd>
          <a
            href={bill.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            衆議院サイトの経過情報を見る
          </a>
        </dd>
      </dl>

      <h2 className="mt-8 text-lg font-bold">審議進捗</h2>
      {timeline.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          進捗履歴データは見つかりませんでした。
        </p>
      ) : (
        <ol className="mt-4 border-l border-neutral-300 pl-4">
          {timeline.map((h, i) => (
            <li key={i} className="relative mb-4 pb-1">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-neutral-400" />
              <div className="text-sm text-neutral-500">{h.date}</div>
              <div className="text-sm font-semibold">
                {h.house} / {h.stage}
              </div>
              {h.note && (
                <div className="text-sm text-neutral-600">{h.note}</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
