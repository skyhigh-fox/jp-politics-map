# CLAUDE.md

このファイルは、Claude Code がこのリポジトリで作業する際のガイドライン。

## プロジェクト概要
日本地図をベースに、都道府県・市区町村ごとの政治情報（政策の進捗、国会議員・地方議員のリスト、選挙結果など）を閲覧できるWebサイト。詳細な要件・スコープは Obsidian 側の概要ノートを参照。

## 記録ルール（Obsidian）
以下の情報は、コード側のコミットメッセージだけでなく、**Obsidian Vault内の本プロジェクト用フォルダにMarkdownで記録すること**。

- 記録先フォルダ: `C:\Users\skyhi\Documents\Obsidian\My_Workspace\jp-politics-map\`
- 記録する内容と対象ファイル:
  - 重要な決定事項（技術選定・仕様変更など、後から振り返りたいもの） → `決定事項ログ.md` に追記
  - データソースの調査結果（議員・政策・選挙結果などの情報源、URL、利用条件） → `データソース調査.md` に追記
  - 進捗・作業内容（セッションごとに何をやったか） → `進捗ログ.md` に追記
- 追記時は既存のテンプレート（各ファイル冒頭に記載）に沿って、日付見出し（`## YYYY-MM-DD ...`）付きで書くこと。既存の記録は上書きせず追記していく。
- 作業の節目（1セッションの終わり、大きな意思決定をしたタイミング、データソースを1つ調べ終えたタイミングなど）で記録を更新すること。細かすぎる更新は不要。

## Git運用
- ローカルでの作業単位ごとにコミットする
- GitHubへのpushはキリの良いタイミングで行う。pushに対話的な認証プロンプトが必要な場合は、その旨をユーザーに伝えてユーザー側のターミナルで実行してもらう（このセッション側では認証プロンプトに応答できないため）
- gh CLIは`winget install --id GitHub.cli`でインストール済み・`gh auth login --web`でデバイスコード認証済み（`skyhigh-fox`アカウント）。GitHub Actionsの手動実行・確認等に使える

## 開発環境・実装上の注意点（このリポジトリで繰り返しハマったもの）

- **Node.js/gh CLIのPATH**: このマシン（Windows on ARM）ではNode.jsは`C:\Program Files\nodejs`、GitHub CLIは`C:\Program Files\GitHub CLI`にインストールされているが、Bash/PowerShellツールのデフォルトPATHに入っていないシェルがある。コマンド実行前に`export PATH="/c/Program Files/nodejs:$PATH"`（Bash）を毎回付ける。PowerShellで`$env:PATH`を更新しても、そのプロセス限りで次の呼び出しには引き継がれない
- **`.next`キャッシュの破損**: `npm run build`（本番ビルド）を実行した状態のまま`npm run dev`のdevサーバーを起動する（またはその逆）と、`.next`の内部構造が食い違い500エラーになる。devサーバー起動前・buildし直す前には`rm -rf .next`で一度消す
- **Next.js動的ルートの`params`はURLデコードされない**: `/map/[prefecture]`や`/bills/[id]`のようなルートで、`params`から取れる値は`%E6%9D%B1...`のようなパーセントエンコードのままのことがある。値に日本語を含みうる場合は必ず`decodeURIComponent()`する（このリポジトリで複数回踏んだ実際のバグ）
- **サブエージェント用worktree（`.claude/worktrees/`）**: `isolation: "worktree"`でAgentを起動する際、`.claude/`がリポジトリ自身の作業ツリー内に作られる。`.gitignore`と`eslint.config.mjs`の両方で`.claude/`を除外していないと、(1) worktree作成が安全チェックで失敗する、(2) ネストしたworktree内の`node_modules`まで`npm run lint`が拾って大量のエラーを出す、の2つが起きる。両方とも対応済みなので、除外設定を消さないこと
- **Shift_JISのサイトが多い**: 衆議院公式サイト・総務省など、日本の行政機関サイトはUTF-8でなくShift_JISが珍しくない。`fetch().then(r=>r.text())`だと文字化けするので、`arrayBuffer()`取得→`new TextDecoder('shift_jis').decode(buf)`でデコードする（RSSも同様、`rss-parser`の`parseURL()`はエンコーディングを認識しないため`parseString()`に自前デコードしたテキストを渡す）
- **react-simple-maps + d3-geo**: 自前で構築した`d3-geo`のprojectionインスタンスをComposableMapの`projection`propにそのまま渡すと`projectionStream is not a function`になる。文字列（`"geoMercator"`）＋数値だけの`projectionConfig`として渡すか、`ZoomableGroup`（ズーム/パン用、標準機能）を使う。詳細は`src/components/PrefectureMap.tsx`/`MunicipalityMap.tsx`のコメント参照
- **実機確認の徹底**: このプロジェクトにはブラウザがない環境で作業しているため、`npm install --no-save playwright@latest && npx --yes playwright@latest install chromium`でヘッドレスChromiumを都度用意し、スクリーンショット・クリック遷移・コンソールエラーを確認してからコミットする運用にしている（`package.json`には含めない）
