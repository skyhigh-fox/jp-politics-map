import Link from "next/link";
import { buildPageMetadata } from "@/lib/siteMetadata";

export const metadata = buildPageMetadata({
  title: "プライバシーポリシー",
  description:
    "本サイトが収集する情報の範囲と、アクセス解析（Vercel Analytics）の利用について説明しています。",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        プライバシーポリシー
      </h1>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          このサイトが収集する情報
        </h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            本サイトは会員登録・ログイン・お問い合わせフォーム等を持たないため、氏名・メールアドレスといった個人情報を直接収集する仕組みはありません。閲覧のためにCookieを発行することもありません。
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          アクセス解析について
        </h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            本サイトは、ホスティング先であるVercel社が提供する
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="mx-1 text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              Vercel Analytics
            </a>
            を利用し、ページ閲覧数など集計された利用状況を把握しています。Vercel Analyticsはページを識別するための一時的な値をハッシュ化して扱う方式で、Cookieの発行や、個人を特定できる情報（氏名・メールアドレス・正確な位置情報等）の収集は行いません。収集される情報は集計された統計としてのみ扱われ、個々の訪問者を特定する目的では使用しません。
          </p>
          <p>
            詳細はVercel社の
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="mx-1 text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
            >
              Web Analytics Privacy Policy
            </a>
            をご確認ください。
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          GitHub Issuesをご利用の場合
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          データの誤り等を
          <Link
            href="/disclaimer"
            className="mx-1 text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
          >
            GitHub Issues
          </Link>
          でご報告いただく場合、投稿内容はGitHub社のサービス上で公開され、GitHub社のプライバシーポリシーが適用されます。本サイト側で投稿内容を別途収集・保管することはありません。
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          広告について
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          本サイトは広告を掲載していません。第三者配信の広告サービスによるトラッキングは行っていません。
        </p>
      </section>

      <p className="mt-10 text-sm">
        <Link
          href="/disclaimer"
          className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← 免責事項・出典に戻る
        </Link>
      </p>
    </div>
  );
}
