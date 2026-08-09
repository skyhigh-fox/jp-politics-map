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
    <div>
      <p className="text-sm">
        <Link
          href={`/map/${encodeURIComponent(prefecture)}`}
          className="underline"
        >
          ← {prefecture}の地図に戻る
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-bold">
        {municipality}の地方議会議員（{prefecture}）
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        {members.length === 0
          ? "この地域のデータはまだありません。"
          : `${members.length} 名（選挙区が複数市区町村にまたがる場合、同じ選挙区の議員は各市区町村に重複して表示されます）`}
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded border border-neutral-200 p-3 text-sm"
          >
            <div className="font-semibold">{member.name}</div>
            <div className="text-neutral-600">
              {member.assembly} / {member.partyName}
            </div>
            <div className="text-neutral-600">{member.district}選挙区</div>
            {member.officialUrl && (
              <a
                href={member.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs underline"
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
