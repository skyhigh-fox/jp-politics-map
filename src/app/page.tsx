import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">日本政治マップ（開発中）</h1>
      <p className="mt-4 text-neutral-600">
        フェーズ1: 国会議員・法案審議進捗のデータ基盤を構築中です。
        地図UI（都道府県ドリルダウン）はフェーズ2で追加予定。
      </p>
      <ul className="mt-6 list-disc pl-5 text-neutral-700">
        <li>
          <Link href="/bills" className="underline">
            法案一覧
          </Link>
        </li>
        <li>
          <Link href="/legislators" className="underline">
            議員一覧
          </Link>
        </li>
      </ul>
    </div>
  );
}
