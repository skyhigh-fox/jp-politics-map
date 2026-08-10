import Link from "next/link";
import type { BillSponsorParty, BillSponsorPerson, BillSponsorship, Party } from "@/types";
import { PartyColorDot } from "@/components/PartyColorDot";
import { DataCoverageNote } from "@/components/DataCoverageNote";

/**
 * 法案詳細ページの「提出者・会派」セクション（機能拡充ロードマップ Tier1 #3）。
 *
 * 【中立性の方針（重要）】
 * - 衆議院の議案経過情報に書かれている事実（誰が提出し、どの会派が賛成・反対したか）を
 *   そのまま転記して並べるだけに留める。賛成会派数・反対会派数から算出した
 *   「支持度」のようなスコアや、議員間の共同提案ネットワーク図は作らない。
 *   提出者・賛成者に名を連ねる理由は多様（所属会派の慣行、委員会での役職など）であり、
 *   政治的立場の指標として扱うと誤導になるため。
 * - 氏名・会派名は原資料の表記のまま（敬称「君」、当時の会派名）表示する。
 * - 賛成会派を先に、反対会派を後に置いているのは原資料の欄の並び順に従ったもので、
 *   優劣の含意はない。
 *
 * 議員IDに解決できた氏名だけ議員詳細ページへリンクする。解決できない氏名
 * （在職当時の元議員など）はリンクなしのテキストとして、事実は落とさずに表示する。
 */

function PersonList({ people }: { people: BillSponsorPerson[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {people.map((person, i) => (
        <li key={`${person.name}-${i}`} className="text-sm">
          {person.legislatorId ? (
            <Link
              href={`/legislators/${encodeURIComponent(person.legislatorId)}`}
              className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              {person.name}
            </Link>
          ) : (
            <span className="text-neutral-800 dark:text-neutral-200">
              {person.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PartyList({
  items,
  parties,
}: {
  items: BillSponsorParty[];
  parties: Party[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {items.map((item, i) => {
        // 会派名は提出・審議「当時」の名称。現在の政党マスタに解決できた場合のみ
        // 公式カラーのドットを添える（色は識別の補助であり、単独の識別子にしない）
        const party = item.partyId
          ? parties.find((p) => p.id === item.partyId)
          : undefined;
        return (
          <li
            key={`${item.name}-${i}`}
            className="flex items-center gap-1.5 text-sm text-neutral-800 dark:text-neutral-200"
          >
            {party && <PartyColorDot color={party.color} />}
            <span>{item.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-sm text-neutral-500 dark:text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function BillSponsorshipSection({
  sponsorship,
  parties,
  coverageFacts,
}: {
  sponsorship: BillSponsorship | undefined;
  parties: Party[];
  coverageFacts: string[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
        提出者・会派
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
        衆議院の議案経過情報に記載された内容をそのまま転記しています。会派名は提出・審議当時の名称です。
      </p>

      {!sponsorship ? (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-500">
          この議案については、提出者・会派の記載を収録できていません。
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
          {sponsorship.submitterLabel && (
            <Row label="議案提出者">
              <span className="text-sm text-neutral-800 dark:text-neutral-200">
                {sponsorship.submitterLabel}
              </span>
            </Row>
          )}

          {sponsorship.sponsors.length > 0 && (
            <Row label={`提出者一覧（${sponsorship.sponsors.length}名）`}>
              <PersonList people={sponsorship.sponsors} />
            </Row>
          )}

          {sponsorship.submitterParties.length > 0 && (
            <Row label="提出会派">
              <PartyList items={sponsorship.submitterParties} parties={parties} />
            </Row>
          )}

          {/* 提出の賛成者は最大で270名を超えることがあるため、既定では畳んでおく。
              件数は畳んだ状態でも分かるようにサマリーへ出す */}
          {sponsorship.supporters.length > 0 && (
            <Row label="提出の賛成者">
              <details className="text-sm">
                <summary className="cursor-pointer text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300">
                  {sponsorship.supporters.length}名（クリックで一覧を表示）
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                  議員立法の発議に必要な賛成者（国会法第56条）として名を連ねた議員です。本会議での賛否とは別のものです。
                </p>
                <div className="mt-2">
                  <PersonList people={sponsorship.supporters} />
                </div>
              </details>
            </Row>
          )}

          {sponsorship.houseVoteStance && (
            <Row label="衆議院審議時の会派態度">
              <span className="text-sm text-neutral-800 dark:text-neutral-200">
                {sponsorship.houseVoteStance}
              </span>
            </Row>
          )}

          {sponsorship.approvingParties.length > 0 && (
            <Row label="衆議院審議時の賛成会派">
              <PartyList items={sponsorship.approvingParties} parties={parties} />
            </Row>
          )}

          {sponsorship.opposingParties.length > 0 && (
            <Row label="衆議院審議時の反対会派">
              <PartyList items={sponsorship.opposingParties} parties={parties} />
            </Row>
          )}

          {sponsorship.sourceUrl && (
            <Row label="情報源">
              <a
                href={sponsorship.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
              >
                衆議院サイトの議案経過情報を見る
              </a>
            </Row>
          )}
        </dl>
      )}

      <DataCoverageNote
        datasetId="bill-sponsorships"
        facts={coverageFacts}
        className="mt-3"
      />
    </section>
  );
}
