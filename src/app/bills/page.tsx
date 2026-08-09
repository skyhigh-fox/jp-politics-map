import { getBills } from "@/lib/data";

export default async function BillsPage() {
  const bills = await getBills();

  return (
    <div>
      <h1 className="text-xl font-bold">法案一覧</h1>
      <p className="mt-2 text-sm text-neutral-600">
        現在 {bills.length} 件（データ未取得のため0件表示中。
        <code className="mx-1 rounded bg-neutral-100 px-1">npm run fetch:bills</code>
        で取得）
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
          {bills.map((bill) => (
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
