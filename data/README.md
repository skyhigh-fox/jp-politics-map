# data/

`scripts/fetch-*.ts` が生成するJSONファイルの置き場所。手書きしない。

- `legislators.json` — [Legislator[]](../src/types/index.ts)（`fetch:sangiin-members` + `fetch:shugiin-members` の出力をマージ）
- `parties.json` — Party[]
- `bills.json` — Bill[]（`fetch:bills` の出力）
- `bill-status-history.json` — BillStatusHistory[]
- `election-results.json` — ElectionResult[]（`fetch:election-results`、フェーズ1簡易版）
- `ndl-speech-counts.json` — NdlSpeechCount[]（`fetch:ndl-speech-counts`、フェーズ4。NDL国会会議録検索システムAPIによる現職議員の発言件数。発言者名の部分一致検索のため同姓同名混同のリスクがある参考値。本文は保存しない）

## 更新方法

```
npm run fetch:all
```

Node.jsセットアップ後、GitHub Actions（`.github/workflows/update-data.yml`）が1日1回自動実行し、差分があれば自動コミットする想定。
