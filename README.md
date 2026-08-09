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
