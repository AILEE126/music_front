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

/* 100만 곡 메모리 (user request 2026-11-19: sized for 1M songs, not today's count): the same text (tag · name · date · type)
   kept once, not once per song; one shared empty object / array for the karaoke fields of songs on no list, one array per
   flag set and per vocal — none of these is ever changed in place */
const STR = new Map(), istr = s => { if (!s) return ""; let v = STR.get(s); if (v === undefined) STR.set(s, v = s); return v; };
const NONE_OBJ = Object.freeze({}), NONE_ARR = Object.freeze([]);
const VPAIR = new Map(), vocalPair = n => { let p = VPAIR.get(n); if (!p) VPAIR.set(n, p = Object.freeze([n, vocalColor(n)])); return p; };
const FLAGSET = new Map(), flagSet = f => { const k = f.join("|"); let s = FLAGSET.get(k); if (!s) FLAGSET.set(k, s = Object.freeze(f)); return s; };
const KI_NONE = Object.freeze({nums: NONE_OBJ, gone: NONE_OBJ, only: NONE_OBJ, ord: NONE_OBJ, karaoke: false, extraTags: NONE_ARR, namu: ""});

/* 짧은 주소 (user request 2026-11-19): the server sends a known address start as '~' + letter, and a Niconico / YouTube
   thumbnail that follows from the song's video as '~n' / '~y' — music_backend table_export.py URL_PRE, same table and order */
const URL_PRE = ["https://nicovideo.cdn.nimg.jp/thumbnails/", "https://i.ytimg.com/vi/", "https://www.nicovideo.jp/watch/", "https://youtu.be/",
  "https://www.bilibili.com/video/", "http://piapro.jp/content/", "http://nicovideo.cdn.nimg.jp/thumbnails/", "https://f4.bcbits.com/img/",
  "https://i1.sndcdn.com/", "https://tn.smilevideo.jp/", "https://res.piapro.jp/r/", "http://i0.hdslb.com/bfs/"];
function unUrl(u, video = "") {
  if (!u || u[0] !== "~") return u || "";
  if (u === "~n") { const n = /(?:sm|nm|so)(\d+)$/.exec(unUrl(video)); return n ? `https://nicovideo.cdn.nimg.jp/thumbnails/${n[1]}/${n[1]}` : ""; }
  if (u === "~y") { const y = /youtu\.be\/([\w-]{11})$/.exec(unUrl(video)); return y ? `https://i.ytimg.com/vi/${y[1]}/default.jpg` : ""; }
  return (URL_PRE[u.charCodeAt(1) - 97] || "") + u.slice(2);
}

/* 작은 곡 객체 (user request 2026-11-19, sized for 1M songs: a full object per song took ~1.2 KB and ~7 µs to make — 1.2 GB
   and 9 s at 1M): a song keeps only its data row (r) and karaoke row (k); every player field is read from them when asked —
   the same names and values a plain item has. Writing a field keeps the value on that song (it hides the read one).
   plain() = the fields as a plain object, for whatever copies a song (saved playlist · 같이듣기 · last song) */
class VSong {
  constructor(r, k) { this.r = r; this.k = k || null; this.ki = k ? VDB.karaInfo(k) : KI_NONE; }
  plain() {
    const o = {};
    for (const f of Object.keys(VSONG_GET)) { const v = this[f]; if (v !== undefined) o[f] = v; }
    for (const [f, v] of Object.entries(this)) if (f !== "r" && f !== "k" && f !== "ki") o[f] = v;
    return o;
  }
}
const vcol = (s, name) => s.r[VDB.col[name]];
const vours = s => s.r[VDB.col.ours] || NONE_OBJ;
// one of our songs: lyrics or a sync of ours — not a song that only has a 싱크 실패 state (2026-11-22)
const vmine = r => { const o = r[VDB.col.ours]; return !!(o && (o.lyrics || o.vsync)); };
const vsingers = s => String(vcol(s, "singer") || "").split(",").map(x => x.trim()).filter(Boolean);
const VSONG_GET = {
  site() { return "stream"; },
  vocadb() { return String(vcol(this, "vocadb_id")); },
  name() { return "vocadb_" + this.vocadb; },
  // 원제 = VocaDB 기본 이름 (title_default, e.g. English 'Cutie Mew Mew Magic'), else the Japanese name (user request 2026-11-16)
  def() { return vcol(this, "title_default") || vcol(this, "title_ja") || ""; },
  title() { return vcol(this, "title_ko") || this.def; },
  orig() { const d = this.def; return d !== this.title ? d : ""; },
  defJa() { const d = vcol(this, "title_default"); return !d || d === vcol(this, "title_ja"); },  // VocaDB 기본 이름이 일본어인지 (titleNames)
  ja() { const j = vcol(this, "title_ja"); return j && j !== this.def ? j : ""; },  // 일본어 이름이 원제가 아닐 때 — 검색 · '*일본어 제목'
  reading() { return vcol(this, "title_reading") || ""; },
  en() { return vcol(this, "title_en") || ""; },
  alt() { return vcol(this, "alt_names") || ""; },
  singer() { return vcol(this, "singer") || ""; },
  composer() { return vcol(this, "composer") || ""; },
  // VocaDB 보조 보컬 names (user request 2026-11-22): not in singer — only plain '보컬(보조 보컬)' chips in the song info
  support() { return vcol(this, "support") || undefined; },
  vocals() { return vsingers(this).map(vocalPair); },
  date() { const d = String(vcol(this, "upload_date") || ""); return d.length === 8 ? istr(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`) : ""; },
  thumb() { return unUrl(vcol(this, "thumb"), vcol(this, "video_url")); },
  type() { return vcol(this, "song_type") || ""; },
  vkind() { return vcol(this, "vocal_kind") || ""; },
  origId() { return vcol(this, "original_id") || ""; },  // 같은 곡 묶기 (원곡 번호)
  rating() { return +vcol(this, "rating_score") || 0; },
  secs() { return +vcol(this, "length_seconds") || 0; },  // 곡 길이 (songs col length_seconds, 2026-11-19 — Bilibili plays only with it)
  sources() { return vdbSources([unUrl(vcol(this, "video_url")), ...String(vcol(this, "alt_urls") || "").split(" ").map(u => unUrl(u))]); },
  tags() { const t = String(vcol(this, "tags") || "").split("|").filter(Boolean), x = this.ki.extraTags; return x.length ? [...t, ...x] : t.length ? t : NONE_ARR; },
  nums() { return this.ki.nums; }, gone() { return this.ki.gone; }, only() { return this.ki.only; }, ord() { return this.ki.ord; },
  karaoke() { return this.ki.karaoke; }, namu() { return this.ki.namu; },
  lyrics() { return vours(this).lyrics || ""; },
  sync() { return vours(this).sync === "ok" ? "ok" : undefined; },
  method() { return vours(this).sync === "ok" ? vours(this).method || "" : undefined; },
  score() { const o = vours(this); return o.sync === "ok" ? o.score ?? null : null; },
  // the final lyrics · sync state the server sends (table_export._state, user request 2026-11-22) — badges and filters
  // show these as they are. No cell: ly from VocaDB's lyrics column, sync none
  ly() { const o = vours(this); return o.ly || (vcol(this, "lyrics") === "Y" ? "vocadb" : "none"); },
  st() { const s = vours(this).sync; return s === "ok" || s === "fail" || s === "stale" || s === "resync" ? s : "none"; },
  sync_fail() { return vours(this).fail || undefined; },  // the auto sync's reason (tooltip of 싱크 실패)
  vsync() { return vours(this).vsync ? 1 : undefined; },  // sync made on VocaDB's lyrics (export/db/vsync/<id>.json, 2026-11-17)
  parts() { return vours(this).parts ? 1 : undefined; },  // lyrics name the vocal of some groups — list badge 파트분리 (2026-11-21)
  files() { const f = vcol(this, "files"); return Array.isArray(f) && f.length ? f : undefined; },  // 파일 포맷 태그 [[종류, 주소, 설명], …]
  flags() {  // 곡 상태 (song_filter.js FLAGS)
    const ko = vcol(this, "title_ko");
    return flagSet(songFlags(this, vcol(this, "lyrics") === "Y", !!(ko && ko !== vcol(this, "title_ja") && ko !== this.def)));
  },
  api() { return !vmine(this.r) && !this.k ? true : undefined; },  // not one of our songs (badges: no 가사·싱크·노래방)
  video() { return this.sources[0] || ""; },  // Niconico first — sources are in that order
  videos() { const yt = this.sources.find(u => /youtu/.test(u)); return yt ? [yt] : NONE_ARR; },
  // 보컬이 VOCAL_SHOW 명 넘으면 앞 VOCAL_SHOW 명 + ' [+N]' (user request 2026-11-16) — 화면의 제목 옆은 artistBase + '+N' 칩
  vocalMore() { const n = vsingers(this).length; return n > VOCAL_SHOW ? n - VOCAL_SHOW : 0; },
  artistBase() { const m = this.vocalMore; return [this.composer, m ? vsingers(this).slice(0, VOCAL_SHOW).join(", ") : this.singer].filter(Boolean).join(" feat. "); },
  artist() { const m = this.vocalMore; return this.artistBase + (m ? ` [+${m}]` : ""); },
  // song_filter.js prepItem's fields
  _ini() { return initialOf(this.title); },
  _singers() { return people(this.singer); },
  _vsingers() { return mainSingers(this); },  // 보컬 인원수 · 솔로 (피노키오피 빼고)
  _composers() { return people(this.composer); },
  _year() { const d = this.date; return /^\d{4}/.test(d) ? d.slice(0, 4) : ""; },
  // 같은 곡 묶음 · 공식 여부 from the server (fam · own · ver columns) — none (older data): song_filter.js works them out
  _fam() { return VDB.col.fam === undefined ? undefined : vcol(this, "fam") || this.vocadb; },
  _own() { return VDB.col.own === undefined ? undefined : !!vcol(this, "own"); },
  _ver() { return VDB.col.ver === undefined ? undefined : vcol(this, "ver") || ""; },
  _fam1() { return VDB.col.fam1 !== undefined && !!vcol(this, "fam1"); },  // alone in its family — song_filter.js sameCut skips grouping it
};
for (const [f, get] of Object.entries(VSONG_GET))
  Object.defineProperty(VSong.prototype, f, {get, set(v) { Object.defineProperty(this, f, {value: v, writable: true, enumerable: true, configurable: true}); }, configurable: true});
/* a song as a plain object (what gets saved or sent) — plain items as they are */
const plainSong = it => it instanceof VSong ? it.plain() : it;

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
    this.curated = []; this._all = null; this.extra = new Map(); this.prog = null;
    // 바뀐 곡 (songs/patch.json.gz, user request 2026-11-19 — table_export._songs): a block stays as it was and the day's changed /
    // new / deleted songs come in this one small file, laid over each block as it is read (block file → {rows, del})
    this.patch = new Map();
    if (idx.patch) {
      const p = JSON.parse(await this.blockText(idx.patch)), id = this.col.vocadb_id, at = f => this.patch.get(f) || (this.patch.set(f, {rows: [], del: []}), this.patch.get(f));
      this.textP.delete(idx.patch.f);
      for (const r of p.rows || []) { const b = this.blockOf(r[id]); if (b) at(b.f).rows.push(r); }
      for (const x of p.del || []) { const b = this.blockOf(x); if (b) at(b.f).del.push(String(x)); }
    }
    if (this.done) this.newFull();  // opened again (another token): wait for the new list — anyone waiting on the old one too
    this.done = false;
  },
  newFull() { this.full = new Promise(r => { this._fullOk = r; }); },
  /* songs/<block>.json.gz — kept in this browser (IndexedDB) under its content hash, so after the first open only blocks
     the server changed are downloaded (GitHub sends files uncompressed — the blocks are gzip themselves). Kept as the gzip
     bytes (2026-11-19, sized for 1M songs: the unpacked text took ~5× the room), unpacked when read */
  blockText(b) {
    const unzip = gz => new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    if (!this.textP.has(b.f)) this.textP.set(b.f, (async () => {
      const cache = idbKV("music-songs"), key = `${LOCAL.name}|${b.f}`, hit = await cache("get", key).catch(() => null);
      if (hit && hit.h === b.h) return hit.gz ? unzip(hit.gz) : hit.text;  // text: kept by an older version
      const gz = await LOCAL.readBytes(`${LOCAL.out}/db/songs/${b.f}`);
      cache("put", key, {h: b.h, gz}).catch(() => {});
      return unzip(gz);
    })());
    return this.textP.get(b.f);
  },
  block(b) {  // read (blockText) + parse into rowById, once — then the patch's rows of this block on top
    if (!this.blockP.has(b.f)) this.blockP.set(b.f, this.blockText(b).then(text => {
      const id = this.col.vocadb_id, p = this.patch && this.patch.get(b.f);
      const put = r => {
        const k = String(r[id]);
        this.rowById.set(k, r);
        if (this.extra.size) { const o = this.items.get(k); if (o && o._x) this.items.delete(k); this.extra.delete(k); }  // made from a saved row: made again from this one
      };
      for (const r of JSON.parse(text)) put(r);
      if (p) { p.rows.forEach(put); for (const k of p.del) this.rowById.delete(k); }
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
    const todo = this.idx.files.filter(b => !this.blockP.has(b.f)), all = this.idx.files.length;
    this.setProg(all - todo.length, all);
    todo.slice(0, 6).forEach(b => this.blockText(b));
    for (let i = 0; i < todo.length; i++) {
      if (todo[i + 6]) this.blockText(todo[i + 6]);
      await this.block(todo[i]);
      this.setProg(all - todo.length + i + 1, all);
      await yieldUI();
    }
    await Promise.all(this.blockP.values());  // blocks ensure() started
    const m = await mst;
    this.master = {vocal: [], producer: [], artist: [], tag: [], title: []};
    for (const r of m ? tableRows(m) : []) (this.master[r.kind] || (this.master[r.kind] = [])).push({id: +r.id, name: r.ko || r.name, src: r.name, cat: r.cat});
    // our songs = with lyrics / sync of ours (ours) or on a karaoke list (+ karaoke songs without a data row yet)
    const cur = [];
    for (const [id, r] of this.rowById) if (vmine(r) || this.kara.has(id)) cur.push(this.itemById(id));
    this.done = true;  // from here a karaoke song without a row is made from its karaoke row
    for (const id of this.kara.keys()) if (!this.rowById.has(id)) cur.push(this.itemById(id));
    this.curated = cur;
    this.extra = new Map();
    this._fullOk();
    this.setProg(all, all);
  },
  /* 불러오기 진행 (user request 2026-11-19: shown in the playlist area, and in the wait notice when a play has to wait):
     prog {n, total} blocks read — 'vdbprog' on window whenever it moves */
  prog: null,
  setProg(n, total) { this.prog = {n, total}; dispatchEvent(new Event("vdbprog")); },
  /* rows from elsewhere before the blocks are read (OPEN CHANNEL list file — listen_together.js): items made from them are
     marked _x and made again from the real row once its block is read */
  extra: new Map(),
  addRows(cols, rows) {
    const at = this.idx.cols.map(c => cols.indexOf(c)), id = cols.indexOf("vocadb_id");
    for (const r of rows || []) if (!this.rowById.has(String(r[id]))) this.extra.set(String(r[id]), at.map(i => i < 0 ? null : r[i]));
  },
  /* the data rows of these songs, read again from the kept block texts (rows are dropped once every item is made) */
  async rowsOf(ids, tick) {
    const want = new Set(ids.map(String)), out = [], byBlock = new Map();
    for (const id of want) { const b = this.blockOf(id); if (b) byBlock.set(b, (byBlock.get(b) || 0) + 1); }
    const id = this.col.vocadb_id;
    for (const b of byBlock.keys()) {
      const text = await this.blockText(b), p = this.patch && this.patch.get(b.f), got = new Map();
      this.textP.delete(b.f);
      for (const r of JSON.parse(text)) if (want.has(String(r[id]))) got.set(String(r[id]), r);
      if (p) { for (const r of p.rows) if (want.has(String(r[id]))) got.set(String(r[id]), r); p.del.forEach(k => got.delete(k)); }
      out.push(...got.values());
      if (tick) await tick();
    }
    return out;
  },
  /* what the song list is now (block hashes + patch + karaoke size) — a saved OPEN CHANNEL list made from other data is made again */
  get dataSig() { return this.idx ? this.idx.files.map(b => b.h).join("") + (this.idx.patch ? "+" + this.idx.patch.h : "") + ":" + (this.kara ? this.kara.size : 0) : ""; },
  /* VocaDB id → player item (made once) — null when not in our DB, or its block isn't read yet */
  itemById(id) {
    id = String(id);
    let it = this.items.get(id);
    if (it) return it;
    const x = !this.rowById.has(id) && this.extra.get(id), r = x || this.rowById.get(id), k = this.kara.get(id);
    if (r) {
      it = new VSong(r, k);
      if (x) it._x = 1;
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
  async makeAll(tick, step) {
    if (this._all || !this.done) return;
    let n = 0;
    const total = this.rowById.size;
    // each row is dropped once its item is made (2026-11-19, sized for 1M songs: rows and items no longer both held at the top)
    for (const id of this.rowById.keys()) { this.itemById(id); this.rowById.delete(id); if (!(++n & 2047)) { if (step) step(n, total); await tick(); } }
    if (!this._all) this._allDone();
  },
  _allDone() {
    this._all = [...this.items.values()];
    this.rowById = new Map();  // every row is an item now — the arrays can go (memory)
  },
  /* karaoke table row → numbers · lists (the old item shape: nums {TJ…}, list tags 한국 / 일본 + brands, ord namu / japan) */
  karaInfo(k) {
    if (!k) return KI_NONE;
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
  /* a karaoke song with no data row yet → the same song object over a row made from its karaoke row */
  fromKara(k) {
    const r = new Array(this.idx.cols.length).fill(""), c = this.col;
    for (const f of ["vocadb_id", "title_ko", "title_ja", "singer", "composer"]) if (c[f] !== undefined) r[c[f]] = k[f] == null ? "" : String(k[f]);
    if (c.ours !== undefined) r[c.ours] = 0;
    if (c.fam !== undefined) { r[c.fam] = ""; r[c.own] = 1; r[c.ver] = ""; }  // fam1 stays "": data songs may point at it
    return new VSong(r, k);
  },
  async get(path, params) {
    const u = new URL(`${VDB_API}/${path}`);
    for (const [k, v] of Object.entries(params || {})) if (v !== "" && v != null) [].concat(v).forEach(x => u.searchParams.append(k, x));
    let r;
    // 15 s cap (user report 2026-11-19: VocaDB hung and the lyrics view waited forever)
    try { r = await fetch(u, {headers: {Accept: "application/json"}, signal: AbortSignal.timeout(15000)}); }
    catch (e) { throw new Error(e.name === "TimeoutError" ? "VocaDB 응답이 없습니다 (15초)." : "VocaDB 에 연결하지 못했습니다 (인터넷 확인)."); }
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
