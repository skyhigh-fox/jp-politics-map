/**
 * 衆議院小選挙区（令和4年改訂・289区）の境界TopoJSONを生成する。
 *
 *   node scripts/build-shugiin-district-topojson.mjs
 *   → public/data/districts-shugiin-topo.json
 *
 * 【このスクリプトが fetch:all に入っていない理由】
 * 区割りは公職選挙法改正のときにしか変わらないため日次更新の対象ではなく、
 * 一方で原典が125MBのシェープファイル（ダウンロード＋変換で数分かかる）で
 * あるため、毎日実行するのは原典サイトへの負荷の面でも見合わない。
 * 区割り改定があったときに手動で1回実行する運用とする。
 *
 * 【依存パッケージ】
 * 変換にしか使わないため package.json には入れていない（Playwrightと同じ運用）。
 * 実行前に以下を入れること:
 *   npm install --no-save shapefile polygon-clipping topojson-server topojson-simplify
 *
 * ---------------------------------------------------------------------------
 * 【データソースの選定経緯（重要）】
 *
 * 市区町村境界で使っている smartnews-smri/japan-topography にも小選挙区の
 * TopoJSONがあるが、こちらは2017年（平成29年）改訂の区割りであり、
 * 2022年（令和4年）改訂のいわゆる「10増10減」より前の状態である。
 * 実際に議員データ（data/legislators.json）の選挙区名と突き合わせると、
 * 東京26〜30区・神奈川19/20区・埼玉16区・千葉14区・愛知16区の10区が存在せず、
 * 逆に廃止済みの宮城6区・福島5区・新潟6区・滋賀4区・和歌山3区・岡山5区・
 * 広島7区・山口4区・愛媛4区・長崎4区の10区が残っていた。
 * そのため、2022年改訂に対応している下記の原典から自前で変換している。
 *
 * 原典: 「衆議院議員選挙・小選挙区の統計データ及び地図データ」
 *        （東京大学空間情報科学研究センター 西沢明 客員研究員）
 *        https://gtfs-gis.jp/senkyoku/
 *        - 2022年(令和4年)改訂の289小選挙区ポリゴン（シェープ形式）
 *        - ライセンス: パブリックドメイン（CC0相当）。出所明示は不要とされているが、
 *          本サイトでは免責事項ページに出典として明記している。
 *
 * ---------------------------------------------------------------------------
 * 【変換の中身と、なぜこの手順なのか】
 *
 * 原典は「小選挙区コードを属性に持つ町丁字レベルの細片ポリゴン119,706件」で
 * あり、選挙区ごとに1つの面にまとまってはいない。そのまま描画すると
 * 選挙区の内部に町丁字の境界線が出てしまう。
 *
 * 1. 都道府県コード(ken)ごとにNDJSONへ分割する
 *    → 1,135万点を一度にメモリへ載せずに済ませるため。
 *      小選挙区は都道府県をまたがないので、この分割は安全。
 * 2. 選挙区ごとにポリゴンの和（union）を取って内部境界を消す
 *    → TopoJSONのmergeArcsでは消せない。原典は隣接ポリゴンの頂点列が
 *      一致しておらず（共有点は全体の13%程度）、トポロジカルに整合していない
 *      ためアーク共有が成立しないことを実測で確認した。実座標での和演算が要る。
 * 3. 巻き方向（winding order）を「外周＝時計回り」に正規化する
 *    → d3-geo / TopoJSON はこの向きで面の内外を判定する。polygon-clippingの
 *      出力は逆向きのため、そのまま描画すると面が反転し地図全体が塗り潰される
 *      （実際に一度そうなった）。
 * 4. 全国1本のTopoJSONにまとめ、簡略化・量子化する
 *    → 全国地図（600×700px、最大8倍ズーム）で必要十分な精度に落とす。
 *      無加工だと約1,120万点／数百MBになり、Webでは扱えない。
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const MISSING_DEPS_MESSAGE = `
変換用の依存パッケージが見つかりません。次のコマンドで一時的に導入してから再実行してください:

  npm install --no-save shapefile polygon-clipping topojson-server topojson-simplify
`;

let shapefile, pc, topojsonServer, topojsonSimplify, topojsonClient;
try {
  shapefile = require("shapefile");
  pc = require("polygon-clipping");
  topojsonServer = require("topojson-server");
  topojsonSimplify = require("topojson-simplify");
  topojsonClient = require("topojson-client");
} catch {
  console.error(MISSING_DEPS_MESSAGE);
  process.exit(1);
}

const SOURCE_URL = "https://gtfs-gis.jp/senkyoku2022/senkyoku2022.zip";
const OUT_PATH = path.join(process.cwd(), "public/data/districts-shugiin-topo.json");
const WORK_DIR = path.join(os.tmpdir(), "jp-politics-map-districts");

/** 座標のスナップ幅（度）。約0.1m。微小なずれ由来の不正な交差を減らす */
const SNAP = 1e-6;
/** 和演算の結果から落とす微小ポリゴンの面積（度²）。約1ha未満の岩礁 */
const MIN_POLYGON_AREA_DEG2 = 1e-6;
/** 簡略化の閾値（球面三角形面積）。全国表示に必要な精度から実測で決めた値 */
const SIMPLIFY_MIN_WEIGHT = 4e-6;
/** 簡略化後に落とすリングの球面面積（ステラジアン）。約0.04km²未満 */
const FILTER_MIN_RING_AREA = 1e-9;
/** TopoJSONの量子化グリッド */
const QUANTIZATION = 1e5;

// ---------------------------------------------------------------------------
// 1. 原典のダウンロードと展開
// ---------------------------------------------------------------------------

async function ensureSource() {
  const shp = path.join(WORK_DIR, "senkyoku2022.shp");
  if (fs.existsSync(shp)) {
    console.log("原典は展開済み:", shp);
    return shp;
  }
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const zipPath = path.join(WORK_DIR, "senkyoku2022.zip");
  if (!fs.existsSync(zipPath)) {
    console.log("ダウンロード中:", SOURCE_URL);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`ダウンロードに失敗しました: ${res.status}`);
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }
  console.log("展開中:", zipPath);
  const { execFileSync } = await import("node:child_process");
  // Windows/macOS/Linuxのいずれでも使えるよう、まずtar（Windows 10以降に同梱）を試す
  execFileSync("tar", ["-xf", zipPath, "-C", WORK_DIR], { stdio: "inherit" });
  if (!fs.existsSync(shp)) throw new Error("展開後にシェープファイルが見つかりません");
  return shp;
}

// ---------------------------------------------------------------------------
// 2. 都道府県コードごとに分割
// ---------------------------------------------------------------------------

async function splitByPrefecture(shpPath) {
  const dir = path.join(WORK_DIR, "byken");
  if (fs.existsSync(path.join(dir, "47.ndjson"))) {
    console.log("都道府県別への分割は済み");
    return dir;
  }
  fs.mkdirSync(dir, { recursive: true });
  const source = await shapefile.open(shpPath, shpPath.replace(/\.shp$/, ".dbf"), {
    encoding: "shift_jis", // .cpg に従う
  });
  const streams = new Map();
  let n = 0;
  for (;;) {
    const r = await source.read();
    if (r.done) break;
    const f = r.value;
    const ken = String(f.properties.ken).padStart(2, "0");
    let s = streams.get(ken);
    if (!s) {
      s = fs.createWriteStream(path.join(dir, `${ken}.ndjson`));
      streams.set(ken, s);
    }
    const line = JSON.stringify({
      kucode: f.properties.kucode,
      kuname: f.properties.kuname,
      g: f.geometry,
    });
    if (!s.write(line + "\n")) await new Promise((res) => s.once("drain", res));
    if (++n % 20000 === 0) console.log(`  分割 ${n}件`);
  }
  await Promise.all([...streams.values()].map((s) => new Promise((res) => s.end(res))));
  console.log(`分割完了: ${n}件 / ${streams.size}都道府県`);
  return dir;
}

// ---------------------------------------------------------------------------
// 3. 選挙区ごとの和演算（内部境界の消去）
// ---------------------------------------------------------------------------

const snapValue = (v) => Math.round(v / SNAP) * SNAP;

function snapRing(ring) {
  const out = [];
  let px = NaN;
  let py = NaN;
  for (const c of ring) {
    const x = snapValue(c[0]);
    const y = snapValue(c[1]);
    if (x === px && y === py) continue;
    out.push([x, y]);
    px = x;
    py = y;
  }
  while (
    out.length > 1 &&
    out[0][0] === out[out.length - 1][0] &&
    out[0][1] === out[out.length - 1][1]
  ) {
    out.pop();
  }
  return out.length >= 3 ? out : null;
}

function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

function minLongitude(poly) {
  let m = Infinity;
  for (const c of poly[0]) if (c[0] < m) m = c[0];
  return m;
}

/**
 * polygon-clipping は入力が多いと
 * "Infinite loop when putting segment endpoints in a priority queue" で
 * 落ちることがある（岩手・三重・長崎で発生）。経度順に並べて半分ずつ
 * 処理し、それでも落ちる場合は統合せずそのまま残す（面としての欠損は起きない）。
 */
function robustUnion(polys) {
  if (polys.length === 0) return [];
  if (polys.length === 1) return [polys[0]];
  try {
    return pc.union(polys);
  } catch {
    const sorted = [...polys].sort((a, b) => minLongitude(a) - minLongitude(b));
    const mid = Math.ceil(sorted.length / 2);
    const a = robustUnion(sorted.slice(0, mid));
    const b = robustUnion(sorted.slice(mid));
    try {
      return pc.union([...a, ...b]);
    } catch {
      return [...a, ...b];
    }
  }
}

/** d3-geo / TopoJSON の慣習（外周＝時計回り、穴＝反時計回り）に正規化する */
function rewind(coordinates) {
  for (const poly of coordinates) {
    poly.forEach((ring, i) => {
      const a = signedArea(ring);
      const wantNegative = i === 0;
      if (wantNegative ? a > 0 : a < 0) ring.reverse();
    });
  }
}

/**
 * 簡略化後のリングを整える。
 *
 * 簡略化（topojson-simplify）と量子化（topojson-client の quantize）を通すと、
 * 一部のリングで「始点と終点が一致しない＝閉じていない」状態が生じる
 * （実測で41区。いずれも点の少ない都市部の区）。GeoJSONとして不正であり、
 * d3-geo はこれを「地球全体」と解釈するため、地図全体が塗り潰されてしまう。
 * ここで閉じ直し、巻き方向（外周＝時計回り）も揃えてから、
 * トポロジーを作り直す。
 */
function sanitizeRings(features) {
  let closedCount = 0;
  let droppedRings = 0;
  for (const f of features) {
    const geo = f.geometry;
    if (geo.type !== "Polygon" && geo.type !== "MultiPolygon") continue;
    const polys = geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates;
    const keptPolys = [];
    for (const poly of polys) {
      const rings = [];
      for (const ring of poly) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]]);
          closedCount++;
        }
        if (ring.length < 4) {
          droppedRings++;
          continue;
        }
        rings.push(ring);
      }
      // 外周が消えたポリゴンは丸ごと捨てる
      if (rings.length > 0) keptPolys.push(rings);
    }
    rewind(keptPolys);
    f.geometry = { type: "MultiPolygon", coordinates: keptPolys };
  }
  return { closedCount, droppedRings };
}

/** 出来上がったTopoJSONが描画に耐えるかを検証する（閉じているか・巻き方向） */
function verifyTopology(topo, objectName, toGeoJson) {
  const fc = toGeoJson(topo, topo.objects[objectName]);
  const problems = [];
  for (const f of fc.features) {
    const polys =
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (!polys || polys.length === 0) {
      problems.push(`${f.properties.kuname}: 図形が空`);
      continue;
    }
    polys.forEach((poly, pi) => {
      poly.forEach((ring, ri) => {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          problems.push(`${f.properties.kuname}: リング(${pi},${ri})が閉じていない`);
        }
        const a = signedArea(ring);
        if (ri === 0 ? a > 0 : a < 0) {
          problems.push(`${f.properties.kuname}: リング(${pi},${ri})の巻き方向が逆`);
        }
      });
    });
  }
  return problems;
}

async function dissolvePrefecture(file) {
  const byDistrict = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    let entry = byDistrict.get(o.kucode);
    if (!entry) {
      entry = { kuname: o.kuname, polys: [] };
      byDistrict.set(o.kucode, entry);
    }
    const polys = o.g.type === "Polygon" ? [o.g.coordinates] : o.g.coordinates;
    for (const p of polys) {
      const rings = p.map(snapRing).filter(Boolean);
      if (rings.length) entry.polys.push(rings);
    }
  }

  const features = [];
  for (const [kucode, entry] of [...byDistrict.entries()].sort((a, b) => a[0] - b[0])) {
    const merged = robustUnion(entry.polys);
    const kept = merged.filter((p) => Math.abs(signedArea(p[0])) >= MIN_POLYGON_AREA_DEG2);
    const coordinates = kept.length ? kept : merged;
    rewind(coordinates);
    features.push({
      type: "Feature",
      properties: { kucode, kuname: entry.kuname },
      geometry: { type: "MultiPolygon", coordinates },
    });
  }
  return features;
}

// ---------------------------------------------------------------------------

async function main() {
  const shpPath = await ensureSource();
  const dir = await splitByPrefecture(shpPath);

  const features = [];
  for (let i = 1; i <= 47; i++) {
    const ken = String(i).padStart(2, "0");
    const file = path.join(dir, `${ken}.ndjson`);
    if (!fs.existsSync(file)) throw new Error(`${file} がありません`);
    const fs2 = await dissolvePrefecture(file);
    console.log(`  ${ken}: ${fs2.length}区`);
    features.push(...fs2);
  }
  if (features.length !== 289) {
    throw new Error(`選挙区の数が289ではありません: ${features.length}`);
  }

  // 1回目のトポロジー構築は「簡略化のため」。共有境界をアークとして
  // 共有させることで、隣接する区の境界線が簡略化後もぴったり一致する。
  let topo = topojsonServer.topology({
    senkyoku289: { type: "FeatureCollection", features },
  });
  topo = topojsonSimplify.presimplify(topo);
  topo = topojsonSimplify.simplify(topo, SIMPLIFY_MIN_WEIGHT);
  topo = topojsonSimplify.filter(
    topo,
    topojsonSimplify.filterWeight(topo, FILTER_MIN_RING_AREA, topojsonSimplify.sphericalRingArea)
  );

  // いったんGeoJSONへ戻してリングを整えてから、トポロジーを作り直す。
  // 簡略化を通したTopoJSONを直接書き出すと、閉じていないリングが残る
  // （sanitizeRings のコメント参照）。
  const simplified = topojsonClient.feature(topo, topo.objects.senkyoku289);
  const { closedCount, droppedRings } = sanitizeRings(simplified.features);
  console.log(`閉じ直したリング: ${closedCount}件 / 除外した微小リング: ${droppedRings}件`);

  topo = topojsonServer.topology({ senkyoku289: simplified }, QUANTIZATION);

  const geometries = topo.objects.senkyoku289.geometries;
  const empty = geometries.filter((g) => !g.arcs || g.arcs.length === 0);
  if (empty.length > 0) {
    throw new Error(`図形が空になった選挙区があります: ${empty.map((g) => g.properties.kuname).join(",")}`);
  }
  const problems = verifyTopology(topo, "senkyoku289", topojsonClient.feature);
  if (problems.length > 0) {
    throw new Error(
      `描画できない図形が${problems.length}件あります:\n${problems.slice(0, 20).join("\n")}`
    );
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(topo));
  console.log(
    `出力: ${OUT_PATH} (${geometries.length}区 / ${topo.arcs.length}アーク / ${fs.statSync(OUT_PATH).size}バイト)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
