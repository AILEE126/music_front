/* Our song DB in the player (user request 2026-11-14: song search reads only our DB — the tables on GitHub, export/db —
   never the VocaDB API, so a search of 98만 곡 can still be played as a whole):
   · every collected song (data table rows, read in blocks — the screen opens before all are read) · all() = them as player items
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

/* playable links in play order: Niconico/YouTube in the server's order (원본 → 니코니코 → 유튜브, unchanged), then the other
   platforms the player can drive (user request 2026-11-18: SoundCloud · Vimeo · Bilibili · mp3 file — when the original is gone) */
const MAIN_URL = /nicovideo\.jp|nico\.ms|youtube\.com|youtu\.be/;
const OTHER_URL = /soundcloud\.com\/[\w-]+\/[\w-]+|vimeo\.com\/(?:video\/)?\d+|bilibili\.com\/video\/(?:av\d|BV)|^https:\/\/[^?#]+\.(?:mp3|m4a|ogg|opus|wav)(?:[?#]|$)/i;
const vdbSources = urls => [...urls.filter(u => MAIN_URL.test(u || "")), ...urls.filter(u => u && !MAIN_URL.test(u) && OTHER_URL.test(u))];

/* fields every player item has, derived from the ones above (Niconico first — sources are in that order) */
function vdbDerive(it) {
  it.video = it.sources[0] || "";
  it.videos = it.sources.filter(u => /youtu/.test(u)).slice(0, 1);
  // 보컬이 VOCAL_SHOW 명 넘으면 앞 VOCAL_SHOW 명 + ' [+N]' (user request 2026-11-16) — 화면의 제목 옆은 artistBase + '+N' 칩
  const v = String(it.singer || "").split(",").map(x => x.trim()).filter(Boolean);
  it.vocalMore = v.length > VOCAL_SHOW ? v.length - VOCAL_SHOW : 0;
  it.artistBase = [it.composer, it.vocalMore ? v.slice(0, VOCAL_SHOW).join(", ") : it.singer].filter(Boolean).join(" feat. ");
  it.artist = it.artistBase + (it.vocalMore ? ` [+${it.vocalMore}]` : "");
  it.score = it.score ?? null;
}

/* {cols, rows} table file → row objects */
const tableRows = t => t.rows.map(r => Object.fromEntries(t.cols.map((c, i) => [c, r[i]])));

const VDB = {
  curated: [], _all: null,
  /* our data — tables only (user request 2026-11-14), written by the server (music_backend vocadb/table_export.py):
     export/db/master.json (names · filter values) · karaoke.json (numbers) · songs/ (EVERY collected song, gzip blocks) */
  master: {vocal: [], producer: [], artist: [], tag: [], title: []},  // [{id, name (shown), src (VocaDB name), cat}]
  /* Loading in two steps (user request 2026-11-18: the screen first, the rest in the background with no progress bar —
     1M songs took ~1 min and ~1.5 GB if read whole at start):
     · load(): the small files (index · karaoke · filter) — then the screen opens; ensure(ids) reads just the blocks
       those songs live in (the last song)
     · loadRest(): every other block + master, quietly; then curated · all() exist and `done` is true (VDB.full resolves).
     Rows stay as the parsed arrays (no object per row) and are dropped once all() made the items. */
  rowById: new Map(),  // VocaDB id → data row array (cols: this.col) — until all() has made every item
  items: new Map(),  // VocaDB id → player item, made once (the same object everywhere: playlist · search · curated)
  done: false, full: null, _fullOk: null,  // full: resolves when every block is read (newFull — set below)
  /* a song of our DB (loaded or not yet) */
  has(id) { id = String(id); return this.items.has(id) || this.rowById.has(id) || (this.kara && this.kara.has(id)); },
  get total() { return this._all ? this._all.length : this.idx ? this.idx.files.reduce((a, b) => a + b.n, 0) : 0; },
  async load() {
    const rd = f => LOCAL.readJson(`${LOCAL.out}/db/${f}`, null);
    const [idx, kara, flt] = await Promise.all([rd("songs/index.json"), rd("karaoke.json"), rd("filter.json")]);
    this.filter = flt;  // 음원 관리 › 필터 (user request 2026-11-14): category order · symbols · 필터 프리셋 추천 — missing → built-in defaults
    const miss = [!kara && "karaoke.json", !idx && "songs/index.json"].filter(Boolean);
    if (miss.length) throw new Error(`${LOCAL.out}/db 에 ${miss.join(", ")} 이 없습니다. 서버에서 내보내기·올리기를 하세요.`);
    this.idx = idx;
    this.col = Object.fromEntries(idx.cols.map((c, i) => [c, i]));
    this.kara = new Map(tableRows(kara).map(k => [String(k.vocadb_id), k]));
    this.rowById = new Map(); this.items = new Map(); this.blockP = new Map(); this.textP = new Map();
    this.curated = []; this._all = null;
    if (this.done) this.newFull();  // opened again (another token): wait for the new list — anyone waiting on the old one too
    this.done = false;
  },
  newFull() { this.full = new Promise(r => { this._fullOk = r; }); },
  /* songs/<block>.json.gz — kept in this browser (IndexedDB) under its content hash, so after the first open only blocks
     the server changed are downloaded (GitHub sends files uncompressed — the blocks are gzip themselves) */
  blockText(b) {
    if (!this.textP.has(b.f)) this.textP.set(b.f, (async () => {
      const cache = idbKV("music-songs"), key = `${LOCAL.name}|${b.f}`, hit = await cache("get", key).catch(() => null);
      if (hit && hit.h === b.h) return hit.text;
      const gz = await LOCAL.readBytes(`${LOCAL.out}/db/songs/${b.f}`);
      const text = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      cache("put", key, {h: b.h, text}).catch(() => {});
      return text;
    })());
    return this.textP.get(b.f);
  },
  block(b) {  // read (blockText) + parse into rowById, once
    if (!this.blockP.has(b.f)) this.blockP.set(b.f, this.blockText(b).then(text => {
      const id = this.col.vocadb_id;
      for (const r of JSON.parse(text)) this.rowById.set(String(r[id]), r);
      this.textP.delete(b.f);
    }));
    return this.blockP.get(b.f);
  },
  blockOf(id) { const f = `${Math.floor(+id / this.idx.block)}.json.gz`; return this.idx.files.find(b => b.f === f); },
  /* the blocks these songs live in (before the rest is read) */
  async ensure(ids) {
    if (this.done) return;
    const bs = new Set(ids.filter(x => /^\d+$/.test(String(x))).map(x => this.blockOf(x)).filter(Boolean));
    await Promise.all([...bs].map(b => this.block(b)));
  },
  /* the rest, in the background: 4 blocks downloading ahead, parsed one at a time with the screen's turn in between (yieldUI) */
  async loadRest() {
    const mst = LOCAL.readJson(`${LOCAL.out}/db/master.json`, null);
    const todo = this.idx.files.filter(b => !this.blockP.has(b.f));
    todo.slice(0, 4).forEach(b => this.blockText(b));
    for (let i = 0; i < todo.length; i++) {
      if (todo[i + 4]) this.blockText(todo[i + 4]);
      await this.block(todo[i]);
      await yieldUI();
    }
    await Promise.all(this.blockP.values());  // blocks ensure() started
    const m = await mst;
    this.master = {vocal: [], producer: [], artist: [], tag: [], title: []};
    for (const r of m ? tableRows(m) : []) (this.master[r.kind] || (this.master[r.kind] = [])).push({id: +r.id, name: r.ko || r.name, src: r.name, cat: r.cat});
    // our songs = with lyrics / sync of ours (ours) or on a karaoke list (+ karaoke songs without a data row yet)
    const ours = this.col.ours, cur = [];
    for (const [id, r] of this.rowById) if (r[ours] || this.kara.has(id)) cur.push(this.itemById(id));
    this.done = true;  // from here a karaoke song without a row is made from its karaoke row
    for (const id of this.kara.keys()) if (!this.rowById.has(id)) cur.push(this.itemById(id));
    this.curated = cur;
    this._fullOk();
  },
  /* VocaDB id → player item (made once) — null when not in our DB, or its block isn't read yet */
  itemById(id) {
    id = String(id);
    let it = this.items.get(id);
    if (it) return it;
    const r = this.rowById.get(id), k = this.kara.get(id);
    if (r) {
      it = this.fromRow(Object.fromEntries(this.idx.cols.map((c, i) => [c, r[i]])), k);
      if (!r[this.col.ours] && !k) it.api = true;  // not one of our songs (badges: no 가사·싱크·노래방)
    } else if (k && this.done) it = this.fromKara(k);
    else return null;
    this.items.set(id, it);
    return it;
  },
  /* every song in our DB as player items ('전체 곡') — empty until the rest is read. Made in steps by makeAll: async callers
     await it first (made all at once here took 3 s over 25만 곡) */
  all() {
    if (!this.done) return [];
    if (!this._all) { for (const id of this.rowById.keys()) this.itemById(id); this._allDone(); }
    return this._all;
  },
  async makeAll(tick) {
    if (this._all || !this.done) return;
    let n = 0;
    for (const id of this.rowById.keys()) { this.itemById(id); if (!(++n & 2047)) await tick(); }
    if (!this._all) this._allDone();
  },
  _allDone() {
    this._all = [...this.items.values()];
    this.rowById = new Map();  // every row is an item now — the arrays can go (memory)
  },
  /* karaoke table row → numbers · lists (the old item shape: nums {TJ…}, list tags 한국 / 일본 + brands, ord namu / japan) */
  karaInfo(k) {
    if (!k) return {nums: {}, gone: {}, only: {}, ord: {}, karaoke: false, extraTags: [], namu: ""};
    // gone = machines the song was taken off (karaoke.gone, user request 2026-11-15): their numbers stay out of nums —
    // so 랜덤 추천 · 노래방 필터 · 노래방 모드 skip them — and are kept in gone only to show struck through in the tags
    const nums = {}, gone = {}, col = {tj: "TJ", kumyoung: "금영", dam: "DAM", uga: "UGA", joys: "JOYSOUND"}, off = String(k.gone || "").split(",");
    for (const [c, b] of Object.entries(col)) if (/\d/.test(k[c] || "")) (off.includes(c) ? gone : nums)[b] = k[c];
    // only = 특정 기기에서만 선곡 가능 (karaoke.only_on, 나무위키 ⓗ · ⓢ — user request 2026-11-15) {brand: "ⓗ 60시리즈부터 선곡 가능"}
    const only = {};
    try { for (const [c, t] of Object.entries(JSON.parse(k.only_on || "{}"))) if (col[c]) only[col[c]] = t; } catch (e) {}
    const lists = [["한국", ["tj", "kumyoung"]], ["일본", ["dam", "uga", "joys"]]].filter(([, cs]) => cs.some(c => k[c] && !off.includes(c))).map(([l]) => l);
    const ord = {};
    if (k.kr_order != null) ord.namu = k.kr_order;
    if (k.jp_order != null) ord.japan = k.jp_order;
    return {nums, gone, only, ord, karaoke: lists.length > 0, extraTags: [...lists, ...Object.keys(nums)], namu: k.namu_url || ""};
  },
  /* data table row (+ karaoke row) → player item */
  fromRow(r, k) {
    // 원제 = VocaDB 기본 이름 (title_default, e.g. English 'Cutie Mew Mew Magic'), else the Japanese name (user request 2026-11-16)
    const id = String(r.vocadb_id), orig = r.title_default || r.title_ja || "", title = r.title_ko || orig, ki = this.karaInfo(k), ours = r.ours || {};
    const people = s => String(s || "").split(",").map(x => x.trim()).filter(Boolean);
    const d = String(r.upload_date || "");
    const it = {site: "stream", name: `vocadb_${id}`, vocadb: id, title, orig: orig !== title ? orig : "", reading: r.title_reading || "",
      def: orig, defJa: !r.title_default || r.title_default === r.title_ja,  // VocaDB 기본 이름 · 그게 일본어인지 (titleNames, 2026-11-17)
      ja: r.title_ja && r.title_ja !== orig ? r.title_ja : "",  // 일본어 이름이 원제가 아닐 때 — 검색 · '*일본어 제목' 표시용
      en: r.title_en || "", alt: r.alt_names || "",  // 검색용 영어 이름 · 다른 이름 (user request 2026-11-16)
      singer: r.singer || "", composer: r.composer || "", vocals: people(r.singer).map(n => [n, vocalColor(n)]),
      date: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "", thumb: r.thumb || "", type: r.song_type || "", vkind: r.vocal_kind || "", origId: r.original_id || "",  // 같은 곡 묶기 (원곡 번호)
      rating: +r.rating_score || 0, sources: vdbSources([r.video_url, ...String(r.alt_urls || "").split(" ")]),
      tags: [...String(r.tags || "").split("|").filter(Boolean), ...ki.extraTags], nums: ki.nums, gone: ki.gone, only: ki.only, ord: ki.ord, karaoke: ki.karaoke, namu: ki.namu,
      lyrics: ours.lyrics || "", ...(ours.sync === "ok" ? {sync: "ok", method: ours.method || "", score: ours.score ?? null} : {}),
      ...(ours.sync === "stale" ? {stale: 1} : {}),  // lyrics changed after the sync — list badge (2026-11-18)
      ...(ours.vsync ? {vsync: 1} : {})};  // sync made on VocaDB's lyrics (export/db/vsync/<id>.json, 2026-11-17)
    if (Array.isArray(r.files) && r.files.length) it.files = r.files;  // 파일 포맷 태그 [[종류, 주소, 설명], …] (user request 2026-11-18)
    it.flags = songFlags(it, r.lyrics === "Y", !!(r.title_ko && r.title_ko !== r.title_ja && r.title_ko !== orig));  // 곡 상태 (song_filter.js FLAGS)
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
    // where each row came from (user request 2026-11-16: 원문 · 발음 · 번역 출처 above the lyrics) — shown by lyricsSources
    const meta = l => ({by: "VocaDB", lang: (l.cultureCodes || []).filter(Boolean), source: l.source || "", url: l.url || "", type: l.translationType});
    const has = role => extra.some(([r]) => r === role);
    return {vdb: 1, info: {o: meta(orig), ...(has("r") ? {r: meta(rom)} : {}), ...(has("t") ? {t: meta(ko)} : {})}, roles: ["o", ...extra.map(([role]) => role)], langs: ["", ...extra.map(([role, l]) => role === "x" ? cc(l) : "")],
      g: ol.map((t, i) => [t, ...extra.map(([, , xs]) => xs[i])]),
      src: [`VocaDB https://vocadb.net/S/${id}`, ...used.map(l => `${l.source || "?"}${l.url ? " " + l.url : ""} (${l.translationType}${(l.cultureCodes || []).length ? " · " + l.cultureCodes.join(",") : ""})`)]};
  },
};
VDB.newFull();
