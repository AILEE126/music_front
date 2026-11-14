/* Our song DB in the player (user request 2026-11-14: song search reads only our DB — the tables on GitHub, export/db —
   never the VocaDB API, so a search of 98만 곡 can still be played as a whole):
   · rowById = every collected song (data table rows) · all() = them as player items, built on first use
   · curated = our songs (lyrics · sync of ours, or on a karaoke list — karaoke.json = karaoke table): '노래방 곡만' · '가사·싱크 있는 곡'
   · master.json: Korean names and the filter's values (보컬 · 프로듀서 · 태그 with its VocaDB category)
   The VocaDB API is left only for lyrics (lyricsDoc). */
const VDB_API = "https://vocadb.net/api";
const VDB_TYPES = [["", "모든 종류"], ["Original", "오리지널"], ["Cover", "커버"], ["Remix", "리믹스"], ["Arrangement", "어레인지"],
  ["Remaster", "리마스터"], ["Rearrangement", "재편곡"], ["Instrumental", "반주·인스트"], ["Mashup", "매시업"], ["ShortVersion", "짧은 버전"],
  ["Live", "라이브"], ["MusicPV", "뮤직 PV"], ["DramaPV", "드라마 PV"], ["Other", "그 밖"]];
const VDB_TYPE_KO = Object.fromEntries(VDB_TYPES.filter(([k]) => k));
const VOCAL_COLORS = {  // same table as music_backend library/vocal_colors.py (name → color, other names)
  "하츠네 미쿠": ["#39c5bb", "미쿠", "miku", "初音ミク"], "카가미네 린": ["#ffa500", "린", "rin", "鏡音リン"],
  "카가미네 렌": ["#ffe211", "렌", "len", "鏡音レン"], "메구리네 루카": ["#ffc0cb", "루카", "luka", "巡音ルカ"],
  KAITO: ["#0000ff", "카이토"], MEIKO: ["#d80000", "메이코"], GUMI: ["#39ca25", "구미", "메구폰"], IA: ["#f096dc", "이아"],
  "카사네 테토": ["#ef7793", "테토", "teto", "重音テト"], "유니": ["#fa6e98", "UNI"], "시유": ["#ff8c00", "SeeU"],
  "카무이 가쿠포": ["#594d9e", "가쿠포", "가쿳포", "gakupo"], MAYU: ["#e1dfc9", "마유"], VY1: ["#ef837d"], VY2: ["#dd9030"],
  "카아이 유키": ["#dd4444"], Kanaria: ["#fe1818", "카나리아"], "v flower": ["#8c5fc4", "플라워", "flower"], Lily: ["#f8e58c", "릴리"],
  "유즈키 유카리": ["#b07ad6", "유카리", "yukari"], "오토마치 우나": ["#2fb7e8", "우나"], "츠루마키 마키": ["#f5c040", "마키"],
  "토호쿠 즌코": ["#8ed14b", "즌코"], "코토노하 아카네": ["#ff7a9e", "아카네"], "코토노하 아오이": ["#74b3ff", "아오이"],
  "SF-A2 개발코드 miki": ["#ff5e5e", "miki"], Fukase: ["#e73a3a", "후카세"], "호시마치 스이세이": ["#0099ff", "스이세이"], KAFU: ["#8ec5ff", "카후", "可不"],
};
const VOCAL_ALIAS = Object.entries(VOCAL_COLORS).flatMap(([n, [, ...al]]) => [n, ...al].map(a => [a.toLowerCase(), n])).sort((a, b) => b[0].length - a[0].length);
function readableColor(c, least = 120) {
  const ch = k => parseInt(c.slice(k, k + 2), 16), lum = ch(1) * 0.3 + ch(3) * 0.59 + ch(5) * 0.11;
  if (lum >= least) return c.toLowerCase();
  const t = (least - lum) / (255 - lum), x = k => Math.round(ch(k) * (1 - t) + 255 * t).toString(16).padStart(2, "0");
  return "#" + x(1) + x(3) + x(5);
}
/* vocal color: known vocal (any of its names inside the text) → its color, else a fixed color made from the name */
function vocalColor(name) {
  const low = String(name || "").toLowerCase(), hit = VOCAL_ALIAS.find(([a]) => low.includes(a));
  if (hit) return readableColor(VOCAL_COLORS[hit[1]][0]);
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `hsl(${h % 360} 60% 66%)`;
}

/* fields every player item has, derived from the ones above (Niconico first — sources are in that order) */
function vdbDerive(it) {
  it.video = it.sources[0] || "";
  it.videos = it.sources.filter(u => /youtu/.test(u)).slice(0, 1);
  it.artist = [it.composer, it.singer].filter(Boolean).join(" feat. ");
  it.score = it.score ?? null;
}

const VDB = {
  names: {artist: {}, tag: {}, title: {}}, curated: [], byId: new Map(), seen: new Map(), _all: null,
  /* our data — tables only (user request 2026-11-14), written by the server (music_backend vocadb/table_export.py):
     export/db/master.json (names · filter values) · karaoke.json (numbers) · songs/ (EVERY collected song, gzip blocks) */
  master: {vocal: [], producer: [], artist: [], tag: [], title: []},  // [{id, name (shown), src (VocaDB name), cat}]
  rowById: new Map(),  // VocaDB id → data row (object) — the whole collected song list (user request 2026-11-14: taken at start)
  /* songs/index.json + its blocks. A block is kept in this browser (IndexedDB) under its content hash, so after the first
     open only blocks the server changed are downloaded (GitHub sends files uncompressed — the blocks are gzip themselves) */
  async loadSongs() {
    const dir = `${LOCAL.out}/db/songs`, idx = await LOCAL.readJson(`${dir}/index.json`, null);
    if (!idx) return null;
    const cache = idbKV("music-songs"), src = LOCAL.name;
    let done = 0;
    const one = async b => {
      const key = `${src}|${b.f}`, hit = await cache("get", key).catch(() => null);
      let text = hit && hit.h === b.h ? hit.text : null;
      if (text == null) {
        const gz = await LOCAL.readBytes(`${dir}/${b.f}`);
        text = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
        cache("put", key, {h: b.h, text}).catch(() => {});
      }
      LOCAL.progress(`곡 목록 읽는 중… ${++done}/${idx.files.length}`, 0.3 + 0.5 * done / idx.files.length);
      return JSON.parse(text);
    };
    const parts = [];
    for (let i = 0; i < idx.files.length; i += 6) parts.push(...await Promise.all(idx.files.slice(i, i + 6).map(one)));  // 6 at a time
    return {cols: idx.cols, rows: parts.flat()};
  },
  async load() {
    const rd = f => LOCAL.readJson(`${LOCAL.out}/db/${f}`, null);
    const [mst, kara, songs] = await Promise.all([rd("master.json"), rd("karaoke.json"), this.loadSongs()]);
    const miss = [!mst && "master.json", !kara && "karaoke.json", !songs && "songs/index.json"].filter(Boolean);
    if (miss.length) throw new Error(`${LOCAL.out}/db 에 ${miss.join(", ")} 이 없습니다. 서버에서 내보내기·올리기를 하세요.`);
    const rows = t => t.rows.map(r => Object.fromEntries(t.cols.map((c, i) => [c, r[i]])));
    this.master = {vocal: [], producer: [], artist: [], tag: [], title: []};
    this.names = {artist: {}, tag: {}, title: {}};
    for (const m of rows(mst)) {
      const shown = m.ko || m.name, e = {id: +m.id, name: shown, src: m.name, cat: m.cat};
      (this.master[m.kind] || (this.master[m.kind] = [])).push(e);
      if (m.ko) this.names[m.kind === "tag" || m.kind === "title" ? m.kind : "artist"][m.id] = m.ko;
    }
    const kmap = new Map(rows(kara).map(k => [String(k.vocadb_id), k]));
    this.kara = kmap;
    this.rowById = new Map(rows(songs).map(r => [String(r.vocadb_id), r]));
    this.seen = new Map(); this._all = null;
    // our songs = with lyrics / sync of ours (ours) or on a karaoke list
    this.curated = [...this.rowById.values()].filter(r => r.ours || kmap.has(String(r.vocadb_id))).map(r => this.fromRow(r, kmap.get(String(r.vocadb_id))));
    for (const [id, k] of kmap) if (!this.curated.some(it => it.vocadb === id)) this.curated.push(this.fromKara(k));  // karaoke song without a data row yet
    this.byId = new Map(this.curated.map(it => [String(it.vocadb), it]));
    return this.curated;
  },
  /* karaoke table row → numbers · lists (the old item shape: nums {TJ…}, list tags 한국 / 일본 + brands, ord namu / japan) */
  karaInfo(k) {
    if (!k) return {nums: {}, ord: {}, karaoke: false, extraTags: [], namu: ""};
    const nums = {}, col = {tj: "TJ", kumyoung: "금영", dam: "DAM", uga: "UGA", joys: "JOYSOUND"};
    for (const [c, b] of Object.entries(col)) if (/\d/.test(k[c] || "")) nums[b] = k[c];
    const lists = [["한국", ["tj", "kumyoung"]], ["일본", ["dam", "uga", "joys"]]].filter(([, cs]) => cs.some(c => k[c])).map(([l]) => l);
    const ord = {};
    if (k.kr_order != null) ord.namu = k.kr_order;
    if (k.jp_order != null) ord.japan = k.jp_order;
    return {nums, ord, karaoke: lists.length > 0, extraTags: [...lists, ...Object.keys(nums)], namu: k.namu_url || ""};
  },
  /* data table row (+ karaoke row) → player item */
  fromRow(r, k) {
    const id = String(r.vocadb_id), title = r.title_ko || r.title_ja, ki = this.karaInfo(k), ours = r.ours || {};
    const people = s => String(s || "").split(",").map(x => x.trim()).filter(Boolean);
    const d = String(r.upload_date || "");
    const it = {site: "stream", name: `vocadb_${id}`, vocadb: id, title, orig: r.title_ja !== title ? r.title_ja : "", reading: r.title_reading || "",
      singer: r.singer || "", composer: r.composer || "", vocals: people(r.singer).map(n => [n, vocalColor(n)]),
      date: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "", thumb: r.thumb || "", type: r.song_type || "",
      rating: +r.rating_score || 0, sources: [r.video_url, ...String(r.alt_urls || "").split(" ")].filter(u => /nicovideo\.jp|nico\.ms|youtube\.com|youtu\.be/.test(u || "")),
      tags: [...String(r.tags || "").split("|").filter(Boolean), ...ki.extraTags], nums: ki.nums, ord: ki.ord, karaoke: ki.karaoke, namu: ki.namu,
      lyrics: ours.lyrics || "", ...(ours.sync === "ok" ? {sync: "ok", method: ours.method || "", score: ours.score ?? null} : {})};
    vdbDerive(it); prepItem(it);
    return it;
  },
  fromKara(k) {
    return this.fromRow({vocadb_id: k.vocadb_id, title_ko: k.title_ko, title_ja: k.title_ja, singer: k.singer, composer: k.composer}, k);
  },
  async get(path, params) {
    const u = new URL(`${VDB_API}/${path}`);
    for (const [k, v] of Object.entries(params || {})) if (v !== "" && v != null) [].concat(v).forEach(x => u.searchParams.append(k, x));
    let r;
    try { r = await fetch(u, {headers: {Accept: "application/json"}}); } catch (e) { throw new Error("VocaDB 에 연결하지 못했습니다 (인터넷 확인)."); }
    if (!r.ok) throw new Error(`VocaDB 응답 ${r.status}`);
    return r.json();
  },
  /* VocaDB id → player item: our curated item, else the collected song's row (made once, then kept) — null when not in our DB */
  itemById(id) {
    id = String(id);
    if (this.byId.has(id)) return this.byId.get(id);
    if (this.seen.has(id)) return this.seen.get(id);
    const r = this.rowById.get(id);
    if (!r) return null;
    const it = this.fromRow(r, null);
    it.api = true;  // not one of our songs (badges: no 가사·싱크·노래방)
    this.seen.set(id, it);
    return it;
  },
  /* every song in our DB as player items ('전체 곡') — collected rows + karaoke songs without a data row yet */
  all() {
    if (!this._all) this._all = [...[...this.rowById.keys()].map(id => this.itemById(id)), ...this.curated.filter(it => !this.rowById.has(it.vocadb))];
    return this._all;
  },
  /* lyrics of a VocaDB song from the API → the compact doc the player expands (vdbLyrics) — or null.
     Original first (Japanese preferred), romanized / Korean translation under each line when the line counts match;
     other translations (English …) as role 'x' — hidden unless '다른 언어' is on (user request 2026-11-14) */
  async lyricsDoc(id) {
    const s = await this.get(`songs/${id}`, {fields: "Lyrics"});
    const ls = (s.lyrics || []).filter(l => l.value), lines = v => String(v || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const orig = ls.filter(l => l.translationType === "Original").sort((a, b) => !(a.cultureCodes || []).includes("ja") - !(b.cultureCodes || []).includes("ja"))[0];
    if (!orig) return null;
    const ol = lines(orig.value);
    if (!ol.length) return null;
    const rom = ls.find(l => l.translationType === "Romanized");
    const ko = ls.find(l => l.translationType === "Translation" && (l.cultureCodes || []).includes("ko"));
    const others = ls.filter(l => l !== orig && l !== rom && l !== ko);
    const extra = [["r", rom], ["t", ko], ...others.map(l => ["x", l])].filter(([, l]) => l).map(([role, l]) => [role, l, lines(l.value)])
      .filter(([, , xs]) => xs.length === ol.length);
    const used = [orig, ...extra.map(([, l]) => l)];
    const cc = l => ((l.cultureCodes || []).find(Boolean) || "etc").toLowerCase().replace(/[^a-z0-9-]/g, "");
    return {vdb: 1, roles: ["o", ...extra.map(([role]) => role)], langs: ["", ...extra.map(([role, l]) => role === "x" ? cc(l) : "")],
      g: ol.map((t, i) => [t, ...extra.map(([, , xs]) => xs[i])]),
      src: [`VocaDB https://vocadb.net/S/${id}`, ...used.map(l => `${l.source || "?"}${l.url ? " " + l.url : ""} (${l.translationType}${(l.cultureCodes || []).length ? " · " + l.cultureCodes.join(",") : ""})`)]};
  },
};
