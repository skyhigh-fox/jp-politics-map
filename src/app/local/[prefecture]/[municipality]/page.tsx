import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidPrefectureName } from "@/lib/prefectures";
import { getLocalAssemblyMembersByMunicipality } from "@/lib/localAssembly";

export default async function LocalAssemblyMembersPage({
  params,
}: {
  params: Promise<{ prefecture: string; municipality: string }>;
}) {
  const { prefecture: rawPrefecture, municipality: rawMunicipality } =
    await params;
  const prefecture = decodeURIComponent(rawPrefecture);
  const municipality = decodeURIComponent(rawMunicipality);
  if (!isValidPrefectureName(prefecture)) notFound();

  const members = await getLocalAssemblyMembersByMunicipality(
    prefecture,
    municipality
  );

  return (
    <div className="animate-fade-in">
      <p className="text-sm">
        <Link
          href={`/map/${encodeURIComponent(prefecture)}`}
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← {prefecture}の地図に戻る
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        {municipality}の地方議会議員（{prefecture}）
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {members.length === 0
          ? "この地域のデータはまだありません。"
          : `${members.length} 名（選挙区が複数市区町村にまたがる場合、同じ選挙区の議員は各市区町村に重複して表示されます）`}
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-card transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-card-hover dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-700"
          >
            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
              {member.name}
            </div>
            <div className="mt-1 text-neutral-600 dark:text-neutral-400">
              {member.assembly} / {member.partyName}
            </div>
            <div className="text-neutral-600 dark:text-neutral-400">
              {member.district}選挙区
            </div>
            {member.officialUrl && (
              <a
                href={member.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
              >
                プロフィール
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
