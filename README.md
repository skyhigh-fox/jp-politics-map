# jp-politics-map

日本地図をベースに、都道府県・市区町村ごとの政治情報（政策の進捗、国会議員・地方議員のリスト、選挙結果など）を閲覧できるWebサイト。

## スコープ（フェーズ制）

- フェーズ1: 国会議員（衆議院・参議院）＋ 法案の審議進捗
- フェーズ2: 日本地図UI（都道府県までのドリルダウン）
- フェーズ3: 地方議会（数自治体でのパイロット運用）

詳細な要件は今後のコミットで追記していく。

## 技術スタック

- フロントエンド: Next.js (React + TypeScript, App Router) + Tailwind CSS
- 地図UI: react-simple-maps（D3ベース）+ TopoJSON（フェーズ2で導入予定）
- データ取得: `scripts/fetch-*.ts`（Node.jsスクリプト）で外部データソースを取得しJSON化
- ホスティング: Vercel想定
- データ更新の自動化: GitHub Actions（`.github/workflows/update-data.yml`、1日1回）

技術選定の背景・代替案の検討経緯はObsidian Vault（`jp-politics-map/決定事項ログ.md`）を参照。

## セットアップ

```bash
npm install
npm run dev
```

http://localhost:3000 を開く。

### データ取得

```bash
npm run fetch:all              # 参議院議員・衆議院議員・法案データを一括取得
npm run fetch:sangiin-members  # 参議院議員一覧（smartnews-smri経由）
npm run fetch:shugiin-members  # 衆議院議員一覧（公式サイトスクレイピング）
npm run fetch:bills            # 法案・審議進捗履歴
```

取得結果は `data/*.json` に書き出される。詳細は [`data/README.md`](./data/README.md) を参照。

> **注記**: 2026-08-10時点、このリポジトリの作業環境にはNode.jsが未インストールのため、
> 上記スクリプトは未実行・未検証。`npm install` 後、初回実行時に取得件数やデータの中身を
> 必ず確認し、外部サイトのHTML構造・JSONスキーマとズレがあればスクリプトを実データに合わせて
> 修正すること（各スクリプト冒頭のコメントに注意点を記載している）。

## 公開URL・SEO関連の設定

ページごとのtitle/description/OGP、`sitemap.xml`、`robots.txt` は、いずれも
サイトの絶対URLを必要とする（canonical URL・`og:url`・sitemapの`<loc>`）。
本番ドメインが未確定のため、`src/lib/siteMetadata.ts` が次の優先順で解決する。

| 優先 | 環境変数 | 用途 |
| --- | --- | --- |
| 1 | `NEXT_PUBLIC_SITE_URL` | 独自ドメイン取得後に手動で設定する（例: `https://example.jp`）。設定されていれば常にこれが使われる |
| 2 | `VERCEL_PROJECT_PRODUCTION_URL` | Vercelがビルド時に自動注入する。プレビューデプロイでも「本番ドメイン」を指すため、canonical/OGP/sitemapに使ってよい |
| 3 | （フォールバック）`https://jp-politics-map.vercel.app` | ローカル開発・CI用 |

デプロイごとに変わる `VERCEL_URL` は**使わない**（プレビュー用の一意URLが
canonical URLとして外部に出てしまうため）。`NEXT_PUBLIC_` 接頭辞の環境変数は
ビルド時にバンドルへ埋め込まれるので、ドメイン確定後は再デプロイが必要。

`sitemap.xml` / `robots.txt` は `src/app/sitemap.ts` / `src/app/robots.ts`
（Next.jsのMetadata Files規約）からビルド時に生成される。sitemapには静的ページに
加えて法案・議員・記名投票・都道府県・市区町村の全詳細ページ（約8,100URL）を
収録している。収録方針の判断根拠は `src/app/sitemap.ts` 冒頭のコメントを参照。

## ディレクトリ構成

```
src/
  app/            Next.js App Router のページ
  lib/data.ts     data/*.json 読み込みヘルパー
  types/index.ts  フェーズ1データモデルの型定義
scripts/          データ取得スクリプト（fetch-*.ts）
data/             取得済みJSONデータ（scriptsが生成、手書き禁止）
```

## データソース

議員名簿・法案審議進捗・選挙結果・地図境界データ・議員写真のデータソース調査結果は
Obsidian Vault（`jp-politics-map/データソース調査.md`）にまとめている。
