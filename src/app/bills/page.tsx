import { getBills } from "@/lib/data";

const DISPLAY_LIMIT = 50;

export default async function BillsPage() {
  const bills = await getBills();
  const sorted = [...bills].sort((a, b) =>
    b.lastUpdated.localeCompare(a.lastUpdated)
  );
  const shown = sorted.slice(0, DISPLAY_LIMIT);

  return (
    <div>
      <h1 className="text-xl font-bold">法案一覧</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {bills.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1">npm run fetch:bills</code>
            で取得してください。
          </>
        ) : (
          `全${bills.length}件中、直近更新の${shown.length}件を表示（一覧・検索機能は今後追加予定）`
        )}
      </p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-2 pr-4">国会回次</th>
            <th className="py-2 pr-4">件名</th>
            <th className="py-2 pr-4">提出</th>
            <th className="py-2 pr-4">院</th>
            <th className="py-2 pr-4">状況</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((bill) => (
            <tr key={bill.id} className="border-b border-neutral-100">
              <td className="py-2 pr-4">{bill.dietSession}</td>
              <td className="py-2 pr-4">
                <a href={bill.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                  {bill.title}
                </a>
              </td>
              <td className="py-2 pr-4">{bill.submitterType}</td>
              <td className="py-2 pr-4">{bill.house}</td>
              <td className="py-2 pr-4">{bill.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
