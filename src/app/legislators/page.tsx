import { getLegislators, getParties } from "@/lib/data";

export default async function LegislatorsPage() {
  const [legislators, parties] = await Promise.all([
    getLegislators(),
    getParties(),
  ]);
  const partyName = (id: string) =>
    parties.find((p) => p.id === id)?.name ?? "不明";

  return (
    <div>
      <h1 className="text-xl font-bold">議員一覧</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {legislators.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1">
              npm run fetch:sangiin-members / fetch:shugiin-members
            </code>
            で取得してください。
          </>
        ) : (
          `現在 ${legislators.length} 名（検索・フィルタ機能は今後追加予定）`
        )}
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {legislators.map((legislator) => (
          <li
            key={legislator.id}
            className="rounded border border-neutral-200 p-3 text-sm"
          >
            <div className="font-semibold">{legislator.name}</div>
            <div className="text-neutral-600">
              {legislator.chamber} / {partyName(legislator.currentPartyId)}
            </div>
            <div className="text-neutral-600">{legislator.district}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
