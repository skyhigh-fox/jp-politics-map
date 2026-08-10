# public/data

地図描画に使う境界データ（TopoJSON）を置く場所。いずれもコードから
`fetch` される静的ファイルで、日次の自動更新（`npm run fetch:all`）の対象外。

## prefectures-topo.json

都道府県境界のTopoJSON（簡略化レベル s0001 = 0.1%、全国のみ）。

- 出典: SmartNews メディア研究所「日本の行政区画境界データ」
  https://github.com/smartnews-smri/japan-topography
  （原典: 国土交通省 国土数値情報）
- 取得元URL: https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0001/prefectures.json
- 取得日: 2026-08-10
- ライセンス: 商用・非商用問わず無償利用可
- 各Feature の `properties.N03_001` が都道府県名（例:"北海道","青森県"）
- 用途: 都道府県マップ（`/map`）、および選挙区マップ（`/map/districts`）の
  参議院選挙区レイヤー（参院選挙区は都道府県単位のため、専用の境界データを
  持たず、合区の2県を1つの選挙区として束ねて使う）

手動で取得したファイル。更新が必要な場合は取得元URLから再取得する。

## districts-shugiin-topo.json

衆議院小選挙区（**2022年＝令和4年改訂**・289区）の境界TopoJSON。

- 出典: 「衆議院議員選挙・小選挙区の統計データ及び地図データ」
  （東京大学空間情報科学研究センター 西沢明 客員研究員）
  https://gtfs-gis.jp/senkyoku/
- 取得元URL: https://gtfs-gis.jp/senkyoku2022/senkyoku2022.zip （シェープ形式・約125MB）
- 取得日: 2026-08-11
- ライセンス: パブリックドメイン（CC0相当）。出所明示は不要とされているが、
  免責事項ページ（`/disclaimer`）に出典として明記している
- 各Geometry の `properties.kuname` が選挙区名（例:"岡山1区"）、
  `properties.kucode` が選挙区コード（都道府県コード×100＋区番号）

### なぜ smartnews-smri/japan-topography の選挙区データを使わないのか

同リポジトリにも小選挙区のTopoJSONがあるが、こちらは **2017年（平成29年）改訂**の
区割りで、いわゆる「10増10減」より前の状態。現職議員データ
（`data/legislators.json`）の選挙区名と突き合わせると、

- 境界データに存在しない: 東京26〜30区・神奈川19/20区・埼玉16区・千葉14区・愛知16区（10区）
- 境界データにのみ存在する（廃止済み）: 宮城6区・福島5区・新潟6区・滋賀4区・
  和歌山3区・岡山5区・広島7区・山口4区・愛媛4区・長崎4区（10区）

というズレが出る。そのため2022年改訂に対応した上記の原典から自前で変換している。

### 再生成の方法

区割り改定があったときに手動で実行する（原典が125MBあり、変換に数分かかるため
日次更新には含めていない）。

```
npm install --no-save shapefile polygon-clipping topojson-server topojson-simplify
node scripts/build-shugiin-district-topojson.mjs
```

変換手順とその理由（ディゾルブが必要な理由、巻き方向の正規化が必要な理由など）は
`scripts/build-shugiin-district-topojson.mjs` の冒頭コメントに記載。
