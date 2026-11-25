/* 플레이어(서버 없이 html 을 바로 엶)가 우리 곡(노래방·가사·싱크)·한글 이름·가사·싱크·영상 연결·오버레이 파일·오류 신고를 읽고 쓰는 곳 (LOCAL).
   곡 목록·곡 검색은 우리 DB (export/db — vocadb_api.js), VocaDB API 는 가사만.
   읽는 곳 둘 중 하나:
   · 깃허브에서 열기: 비공개 저장소를 토큰으로 (GitHub API — 폴더를 고르지 않아 회사 보안 프로그램에 안 걸림). 저장은 그 저장소에 커밋
   · 폴더 고르기 (서버 PC 만): 처음 한 번 고른 Server\data 폴더(곡 정보 파일만 — csv·json·txt)에서 계속 읽고 씀 — 브라우저 폴더 권한
     (Server·프로그램 폴더·Music 폴더를 골라도 그 안의 Server\data 를 찾아 씀)
     Data lives in Server\data, not WEB (user request: only WEB is zipped and handed out — others read GitHub).
     읽기: Server\data\export (서버가 써 둔 우리 곡·한글 이름·가사). 썸네일은 원곡 영상의 썸네일 주소(thumb)를 바로
   (오프라인 mp3 는 플레이어에서 고른 mp3 폴더 — offline_folder.js)
     쓰기: 싱크 밀기(±초)·직접 맞추기 → Server\data\sync_pending\<싱크 파일> + '싱크 수정' 오류 신고 (본 싱크 파일은 그대로 —
     음원 관리에서 반영해야 바뀜. 그때까지 이 플레이어는 고친 싱크로 틂; 관리자 토큰은 반영 요청도 같이 남김 — savePending)
   화면의 api()·post() 는 모두 LOCAL.request() 로 옴 (shared_screen_helpers.js — 플레이어는 서버에 묻지 않음) */
const CRLF = "\r\n", LF = "\n";
const GH_API = "https://api.github.com";
const DATA_REPO_DIR = "Server/data/";  // data folder in the repo / program folder (moved out of WEB so WEB = player code only)
const DATA_BRANCH = "data";  // branch holding Server/data (server: Server/web_api/data_git_publish.py)
// No old files any more (user request 2026-11-14): from the data branch only the files the server makes from its tables —
// export/db/ (master · karaoke · songs · lyrics/<id> …, read by vocadb_api.js).
// Server: music_backend Server/vocadb/table_export.py
/* 깃허브 API 로 보낼 파일 내용 (base64 — 한글이 깨지지 않게 UTF-8 바이트로) */
function b64utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
/* VocaDB lyrics (user request 2026-11-14: songs without other lyrics show VocaDB's own) come compact from the API
   (VDB.lyricsDoc in vocadb_api.js: {vdb, src, roles, g: [[original, romanized?, Korean?]]}) — expand to
   the usual lyrics shape; title · artist · colors come from the song list */
// d.auto: roles the server's program made (자동 가사, user request 2026-11-14) — those lines get auto: true (the '자동' badge)
// except the line numbers in d.manual[role] (checked or edited by the user in the manage screen)
function vdbLyrics(d, it) {
  const vc = (it.vocals || []).map(v => v[1]).slice(0, 3), auto = d.auto || [], manual = d.manual || {};
  const groups = d.g.map((xs, k) => ({orig: xs[0], vc, lines: xs.map((text, i) => ({text, role: d.roles[i], ...(d.langs && d.langs[i] ? {lang: d.langs[i]} : {}),
    ...(auto.includes(d.roles[i]) && !(manual[d.roles[i]] || []).includes(k) ? {auto: true} : {})})).filter(l => l.text)}));
  const raw = [it.title, `작곡: ${it.composer || ""} / 노래: ${it.singer || ""}`, ...d.src.map((s, i) => (i ? "가사 출처: " : "출처: ") + s),
    "※ 인용된 가사의 저작권은 원저작자 및 관련 권리자에게 있습니다.", "=".repeat(40), "", ...d.g.map(xs => xs.join("\n")), ""].join("\n");
  return {site: it.site, name: it.name, title: it.title, artist: it.artist, sync_fail: null, lyrics_src: "vocadb", lyrics_kind: "vocadb", src_info: d.info || null,
    lyrics_file: "", raw, notes: [], groups, sync_state: "", sync: null, link: null};
}
/* 썸네일 그림을 못 받으면(지워진 영상·주소 끝 값이 필요한 니코니코 새 영상) 깨진 그림 대신 ♪ 칸 — 그 주소는 기억해 다시 부르지 않음 */
const BAD_THUMBS = new Set();
/* 유튜브 썸네일 주소 → 그걸 못 받으면 쓸 곡의 원래 썸네일 (LOCAL.coverUrl) */
const COVER_NEXT = new Map();
const thumbFail = t => {
  BAD_THUMBS.add(t.src);
  const next = COVER_NEXT.get(t.src);
  if (next && !BAD_THUMBS.has(next)) { t.src = next; return; }
  if (t.classList.contains("thumb")) t.replaceWith(Object.assign(document.createElement("span"), {className: t.className, textContent: "♪"}));
  else t.removeAttribute("src");
};
document.addEventListener("error", e => {
  const t = e.target;
  if (t.tagName === "IMG" && /nimg\.jp|ytimg\.com/.test(t.src) && !t.onerror) thumbFail(t);  // onerror: the image runs its own fallbacks (노래방 추첨)
}, true);
// 지워진 유튜브 영상: 404 인데도 120×90 회색 그림을 보내 load 가 옴 — 그것도 못 받은 것으로
document.addEventListener("load", e => {
  const t = e.target;
  if (t.tagName === "IMG" && /ytimg\.com\/vi\/[^/]+\/(?:mq|hq|maxres)default/.test(t.src) && t.naturalWidth === 120) { BAD_THUMBS.add(t.src); t.onerror ? t.onerror() : thumbFail(t); }
}, true);
const ytThumbId = u => (/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.exec(u || "") || [])[1] || "";
const notFound = path => Object.assign(new Error(`${path} 이 없습니다.`), {name: "NotFoundError"});

/* ---------- 지난번에 고른 폴더 기억 (IndexedDB 에 폴더 손잡이 저장) ---------- */
const idb = idbKV("music-offline");  // shared_screen_helpers.js

const LOCAL = {
  dir: null, gh: null, base: "", items: new Map(), chains: new Map(),
  get ready() { return !!(this.dir || this.gh); },

  /* ---- 깃허브에서 열기: 저장소(아이디/이름)·토큰 → 그 저장소의 Server/data 를 읽고 씀 (기억: 이 브라우저에만) ---- */
  savedGitHub() {
    return store.get("gh", null);
  },
  async useGitHub(repo, token, remember = true) {
    repo = String(repo || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    token = String(token || "").trim();
    if (repo.split("/").length !== 2 || !token) throw new Error("저장소(아이디/저장소)와 토큰을 넣으세요.");
    this.progress("깃허브에 연결하는 중…");
    let r;
    try { r = await fetch(`${GH_API}/repos/${repo}`, {headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json"}, cache: "no-store"}); }
    catch (e) { throw new Error("깃허브에 연결하지 못했습니다. 인터넷·회사 보안 프로그램을 확인하세요."); }
    if (r.status === 401) throw new Error("토큰이 틀렸거나 만료·삭제됐습니다.");
    if (!r.ok) throw new Error(`이 토큰으로 ${repo} 저장소를 볼 수 없습니다 (${r.status}). 협업자 초대·토큰의 저장소 선택을 확인하세요.`);
    const info = await r.json();
    // Data lives on the 'data' branch (one commit the server keeps replacing — user request: no pile of data commits).
    // Reads and writes (reports·sync edits) both go there; repo without that branch yet → its default branch.
    let ref = DATA_BRANCH;
    try {
      const b = await fetch(`${GH_API}/repos/${repo}/branches/${DATA_BRANCH}`, {headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json"}, cache: "no-store"});
      if (b.status === 404) ref = info.default_branch || "main";
    } catch (e) {}
    this.gh = {repo, token, ref, write: !!(info.permissions || {}).push};
    this.dir = null; this.base = DATA_REPO_DIR;
    if (remember) store.set("gh", {repo, token});
  },
  forgetGitHub() { store.set("gh", null); this.gh = null; },
  async ghFetch(path, opt = {}) {
    const g = this.gh, url = `${GH_API}/repos/${g.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    const r = await fetch(opt.method ? url : `${url}?ref=${encodeURIComponent(g.ref)}`, {cache: "no-store", ...opt,
      headers: {Authorization: `Bearer ${g.token}`, Accept: opt.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", ...(opt.headers || {})}});
    if (r.status === 404) throw notFound(path);
    if (r.status === 401) throw new Error("깃허브 토큰이 만료·삭제됐습니다. 다시 열어 주세요.");
    if (r.status === 403 && opt.method) throw new Error("이 토큰은 읽기만 됩니다 (저장하려면 토큰에 Contents 쓰기 권한이 필요).");
    if (!r.ok) throw new Error(`깃허브 응답 ${r.status}`);
    return r;
  },

  /* Commit author for GitHub uploads (user request): everyone shares one token, so each upload is signed with the name
     the user types — the same remembered name as the report dialog's '보내는 사람'; asked once when it is empty */
  async ghWho() {
    let who = String(store.get("reportWho", "") || "").trim();
    if (who) return who;
    who = await uiPrompt("깃허브에 올릴 때 남길 이름을 적어 주세요 (다음에도 그대로 — 오류 신고의 '보내는 사람'과 같음)", "", "이름");
    if (!who) throw new Error("이름을 적어야 올릴 수 있습니다.");
    store.set("reportWho", who.slice(0, 40));
    return who.slice(0, 40);
  },

  /* ---- 사용자 (user request 2026-11-17) ----
     Server/data/users/<nickname>.json {name, at, filters}: a write token (or the server PC's folder) registers its nickname and
     uploads its 저장된 필터 (store f.saved) — at every start and whenever they change; 음원 관리 › 필터 lists them.
     A read-only token can't write: it only checks that the 1차 지인 nickname it typed is registered here. */
  userKey: n => String(n || "").normalize("NFKC").trim().toLowerCase().replace(/[\\/:*?"<>|#%\s]+/g, "_").slice(0, 40),
  userPath(n) { return `${this.data}users/${this.userKey(n)}.json`; },
  async userExists(n) { return !!this.userKey(n) && !!(await this.readJson(this.userPath(n), null)); },
  get canWrite() { return !!(this.dir || (this.gh && this.gh.write)); },
  async userSync() {
    const name = String(store.get("reportWho", "") || "").trim();
    if (!name || !this.canWrite) return;
    const filters = (store.get("f.saved", []) || []).map(({name, groups, sort, from, n}) => ({name, groups, ...(sort ? {sort, from, n} : {})}));  // + 정렬 · 범위 (2026-11-22)
    const old = await this.readJson(this.userPath(name), null);
    if (old && old.name === name && JSON.stringify(old.filters || []) === JSON.stringify(filters)) return;  // nothing new — no commit
    await this.writeText(this.userPath(name), JSON.stringify({name, at: new Date().toISOString(), filters}, null, 1) + "\n", name);
  },
  userSyncSoon() {
    clearTimeout(this._userT);
    this._userT = setTimeout(() => this.userSync().catch(e => console.warn("저장된 필터를 서버에 못 올림:", e.message || e)), 1500);
  },

  /* ---- 폴더 ---- */
  async saved() { try { return await idb("get", "music-dir"); } catch (e) { return null; } },
  async pick() {
    if (!window.showDirectoryPicker) throw new Error("이 브라우저는 폴더 읽고 쓰기를 지원하지 않습니다. 크롬이나 엣지로 여세요.");
    const dir = await showDirectoryPicker({id: "music", mode: "readwrite"});
    await this.use(dir);
    store.set("gh", null);  // 폴더로 열었으면 다음에도 폴더 (깃허브 기억은 지움)
    try { await idb("put", "music-dir", dir); } catch (e) {}
  },
  async reopen(dir, ask = true) {  // ask: 권한을 다시 물어봄 (사용자가 버튼을 눌렀을 때만 가능)
    let st = await dir.queryPermission({mode: "readwrite"});
    if (st !== "granted" && ask) st = await dir.requestPermission({mode: "readwrite"});
    if (st !== "granted") throw new Error("폴더를 읽고 쓸 권한이 없습니다.");
    await this.use(dir);
  },
  async use(dir) {
    // 고른 폴더 안 Server\data 위치 (base): Server\data 자체 → Server → 프로그램 폴더 → Music 폴더(그 안의 프로그램 폴더들)
    const bases = ["", "data/", DATA_REPO_DIR];
    try { for await (const [n, h] of dir.entries()) if (h.kind === "directory" && n !== "export" && n !== "lyrics") bases.push(`${n}/${DATA_REPO_DIR}`); } catch (e) {}
    let base = null;
    // Server\data = the folder holding export\db
    const hasExport = async b => { let d = dir; for (const p of `${b}export/db`.split("/").filter(Boolean)) d = await d.getDirectoryHandle(p); return true; };
    for (const b of bases) { try { await hasExport(b); base = b; break; } catch (e) {} }
    if (base == null) {
      throw new Error(`'${dir.name}' 폴더에서 Server\\data (안에 export\\db 폴더)를 찾지 못했습니다.\n`
        + "서버 PC 의 프로그램 폴더 안 Server\\data 폴더를 고르세요. 처음이면 서버를 한 번 켜야 생깁니다.");
    }
    this.dir = dir; this.gh = null; this.base = base;
  },
  get out() { return `${this.base}export`; },  // 서버가 화면용으로 써 둔 우리 곡·한글 이름·가사
  get data() { return this.base; },  // 서버와 같이 쓰는 파일 (Server\data: 오류 신고·싱크 수정 대기) · 영상 연결은 읽기만 (고치기는 음원 관리)
  get name() { return this.gh ? this.gh.repo : this.dir ? this.dir.name : ""; },

  /* ---- 파일 (고른 폴더 기준 경로 'a/b/c.json') ---- */
  async file(path, dir = this.dir, create = false) {
    const parts = path.split("/").filter(Boolean);
    let d = dir;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, {create});
    return d.getFileHandle(parts[parts.length - 1], {create});
  },
  /* 파일을 마지막으로 고친 시각 (ms · 없으면 0) — 오버레이가 켜져 있는지 (프로그램 목록 파일을 6초마다 새로 씀) */
  async modified(path) {
    try {
      if (this.dir) return (await (await this.file(path)).getFile()).lastModified;
    } catch (e) {}
    return 0;
  },
  /* 여는 중 알림 (플레이어 화면이 바꿔 끼움 — 짧은 글 한 줄) */
  progress(label) {},
  async readText(path) {
    if (this.gh) return (await this.ghFetch(path, {raw: true})).text();
    return (await (await this.file(path)).getFile()).text();
  },
  async readBytes(path) {  // binary files (gzip blocks)
    if (this.gh) return (await this.ghFetch(path, {raw: true})).arrayBuffer();
    return (await (await this.file(path)).getFile()).arrayBuffer();
  },
  async listDir(path) {  // file names in a folder ([] when it doesn't exist) — 관리자 기능 (admin_tools.js)
    try {
      if (this.gh) { const a = await (await this.ghFetch(path)).json(); return Array.isArray(a) ? a.filter(f => f.type === "file").map(f => f.name) : []; }
      let d = this.dir;
      for (const p of path.split("/").filter(Boolean)) d = await d.getDirectoryHandle(p);
      const out = [];
      for await (const [n, h] of d.entries()) if (h.kind === "file") out.push(n);
      return out;
    } catch (e) { if (e.name === "NotFoundError") return []; throw e; }
  },
  async readJson(path, dflt) {
    try { return JSON.parse((await this.readText(path)).replace(/^\uFEFF/, "")); }
    catch (e) { if (e.name === "NotFoundError" || e instanceof SyntaxError) return dflt; throw e; }
  },
  async writeText(path, text, asWho = "") {  // asWho: name for a write the player makes by itself (no name prompt)
    if (this.gh) return this.ghPut(path, b64utf8(text), asWho);
    const w = await (await this.file(path, this.dir, true)).createWritable();
    await w.write(text); await w.close();
  },
  async writeBytes(path, bytes, asWho = "") {  // binary files (gzip — the OPEN CHANNEL list)
    if (this.gh) {
      const u = new Uint8Array(bytes);
      let s = "";
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return this.ghPut(path, btoa(s), asWho);
    }
    const w = await (await this.file(path, this.dir, true)).createWritable();
    await w.write(bytes); await w.close();
  },
  async removeFile(path, asWho = "") {  // no file → nothing to do (an admin's sync save removes the waiting edit it replaces)
    try {
      if (this.gh) {
        const sha = (await (await this.ghFetch(path)).json()).sha, who = asWho || await this.ghWho();
        await this.ghFetch(path, {method: "DELETE", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({message: `${who}: 서버 없이 지움 — ${path.split("/").pop()}`, sha, branch: this.gh.ref,
                                author: {name: who, email: "music-player@users.noreply.github.com"}})});
        return;
      }
      const parts = path.split("/").filter(Boolean);
      let d = this.dir;
      for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p);
      await d.removeEntry(parts[parts.length - 1]);
    } catch (e) { if (e.name !== "NotFoundError") throw e; }
  },
  async ghPut(path, b64, asWho) {  // 깃허브: 지금 파일의 sha 를 받아 그 위에 커밋 (새 파일이면 sha 없이)
    const who = asWho || await this.ghWho();
    let sha;
    try { sha = (await (await this.ghFetch(path)).json()).sha; } catch (e) { if (e.name !== "NotFoundError") throw e; }
    await this.ghFetch(path, {method: "PUT", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({message: `${who}: 서버 없이 저장 — ${path.split("/").pop()}`, content: b64, sha, branch: this.gh.ref,
                            author: {name: who, email: "music-player@users.noreply.github.com"}})});
  },
  /* 서버(파이썬 json.dumps(…, ensure_ascii=False, indent=1))와 같은 모양 → 깃 차이가 생기지 않게.
     줄 끝도 그 파일 그대로 (윈도의 파이썬은 CRLF 로 씀 — 새 파일도 윈도면 CRLF) */
  writeJson(path, obj, eol = /Windows/.test(navigator.userAgent) ? CRLF : LF) {
    return this.writeText(path, JSON.stringify(obj, null, 1).replace(/\n/g, eol));
  },
  /* 같은 파일을 읽고-고쳐-쓰기는 한 번에 하나씩 (연달아 눌러도 앞 저장을 덮어쓰지 않게) */
  locked(path, fn) {
    const prev = this.chains.get(path) || Promise.resolve();
    const run = prev.catch(() => {}).then(fn);
    this.chains.set(path, run);
    return run;
  },
  async updateJson(path, fn) {
    return this.locked(path, async () => {
      let text = null;
      try { text = await this.readText(path); } catch (e) { if (e.name !== "NotFoundError") throw e; }
      const d = text ? JSON.parse(text.replace(/^\uFEFF/, "")) : {}, r = fn(d);
      await (text && !text.includes(CRLF) ? this.writeJson(path, d, LF) : this.writeJson(path, d));
      return r;
    });
  },

  /* ---- 썸네일 ---- */
  coverUrl(it) {
    // 원곡 영상의 썸네일 주소 (유튜브·니코니코 — 그림은 그때 바로 받음). 아직 안 받은 곡: 니코니코 옛 영상(2019년쯤 전)은 영상 번호만으로 됨
    const nc = String(it.video || "").match(/nicovideo\.jp\/watch\/(?:sm|nm|so)(\d+)/);
    const u = it.thumb || (nc ? `https://nicovideo.cdn.nimg.jp/thumbnails/${nc[1]}/${nc[1]}` : "");
    // user request 2026-11-18 (화면 전부): 곡의 영상 링크 중 유튜브가 있으면 유튜브 썸네일 (320×180 — 니코니코는 대개 130×100,
    // VocaDB 가 주는 유튜브 썸네일도 120×90). 재생 순서(니코니코 먼저)는 그대로, 그림만. 못 받으면 원래 썸네일로 (COVER_NEXT)
    const yt = [...(it.sources || []), ...(it.videos || []), it.video].map(ytThumbId).find(Boolean);
    const y = yt && `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`;
    if (y && !BAD_THUMBS.has(y)) { if (u && u !== y) COVER_NEXT.set(y, u); return y; }
    return BAD_THUMBS.has(u) ? "" : u;  // 못 받은 그림은 ♪
  },

  /* ---- 화면 요청 (서버 주소와 같은 이름) ---- */
  async request(path, opt = {}) {
    if (!this.ready) throw new Error("먼저 깃허브에서 열거나 Server\\data 폴더를 고르세요.");
    const u = new URL(path, "http://x/"), q = Object.fromEntries(u.searchParams);
    const body = opt.body ? JSON.parse(opt.body) : {};
    const post = (opt.method || "GET") === "POST";
    if (!post && u.pathname === "/api/library") return this.library();
    // 곡 하나에 대한 요청인데 곡 목록을 여는 중: 그걸 기다림
    if ((q.name || body.name) && this.libP) await this.libP.catch(() => {});
    if (!post && u.pathname === "/api/lyrics") return this.lyrics(q.site, q.name);
    if (!post && u.pathname === "/api/stream/views") return this.streamViews(q.name);
    if (post && u.pathname === "/api/report") return this.saveReport(body);
    if (post && u.pathname === "/api/sync/save") return body.times == null ? this.saveOffset(body) : this.saveTimes(body);
    if (post && u.pathname === "/api/parts/save") return this.saveParts(body);
    if (post && u.pathname === "/api/lyrics/save") return this.saveLyrics(body);
    if (["/api/now", "/api/ovset", "/api/ovprograms", "/api/frame"].includes(u.pathname)) return this.overlay(u.pathname, post, body);
    throw new Error("플레이어에서 할 수 없는 일입니다 (싱크 만들기·가사 받기 등은 서버 PC 의 음원 관리에서).");
  },
  /* ---- 가사 오버레이(tools\lyrics_overlay.bat)와 주고받기: 오버레이가 이 PC 에 여는 창구 http://127.0.0.1:47613 ----
     User request: the overlay must work by just running the bat — no folder picking in the player.
     /now (지금 곡·가사 묶음) · /ovset (설정) · /ovprograms (창이 떠 있는 프로그램 목록 — 답이 오면 켜져 있음) ·
     /frame (⚙ 설정이 열린 동안 파란 점선 구역 표시, 2026-11-20).
     Only after the overlay button/⚙ was used once in this browser (ovOn): Chrome asks "local network access" on the first
     request, so players who never use the overlay never see that prompt. */
  ovOn: false, ovFailAt: 0,
  ovEnable() { this.ovOn = true; store.set("ovOn", true); },
  async ovReopen() { this.ovOn = store.get("ovOn", false); },
  async overlay(path, post, body) {
    if (APP.on) return APP.overlay(path, post, body);  // 폰 앱: the app's floating lyrics window (app_bridge.js)
    const local = () => {  // overlay not running (or never used): drop the song notice, keep settings in this browser
      if (path === "/api/now" || path === "/api/frame") return {ok: true};
      if (path === "/api/ovset") { if (post) store.set("ovset", {...store.get("ovset", {}), ...body}); return {...OVSET_DEFAULTS, ...store.get("ovset", {})}; }
      return {items: [], running: false};
    };
    // a failed song notice waits 10 s (no request every lyric line while the overlay is off)
    if (!this.ovOn || (path !== "/api/ovset" && path !== "/api/ovprograms" && Date.now() - this.ovFailAt < 10000)) return local();
    try {
      const r = await fetch("http://127.0.0.1:47613/" + path.slice(5),
        post ? {method: "POST", body: JSON.stringify(path === "/api/now" ? {...body, at: Date.now(), win: OVWIN.id} : body)} : {});  // win: the overlay shows only its owner page's
      if (!r.ok) throw new Error(r.status);
      this.ovFailAt = 0;
      return await r.json();
    } catch (e) { this.ovFailAt = Date.now(); return local(); }
  },
  /* 니코니코 원곡 재생수 (서버의 stream_views 와 같은 요청): 중계 페이지의 니코니코 플레이어가 알려 준 값 — 저장하지 않음 */
  async streamViews(name) {
    const it = this.items.get("stream/" + name), ref = it && vidRef(it.video);
    return {views: ref && ref.kind === "nico" ? await nicoViews(ref.id) : null};
  },
  item(site, name) {
    // our DB songs: always the item VDB made (one object per song, also for blocks read after the screen opened —
    // user report 2026-11-16: playlist songs failed here when only remembered ones were looked up)
    const m = site === "stream" && /^vocadb_(\d+)$/.exec(name);
    const it = (m && VDB.itemById(m[1])) || this.items.get(site + "/" + name);
    if (!it) throw new Error("곡을 찾을 수 없습니다.");
    return it;
  },
  /* songs met outside our list (VocaDB search · playlist · listen together) — lyrics · reports look them up by name */
  remember(it) { if (it && !this.items.has(it.site + "/" + it.name)) this.items.set(it.site + "/" + it.name, it); return it; },

  /* 우리 곡·이름은 표에서만 (user request 2026-11-14 — 예전 파일은 안 읽음): export/db (vocadb_api.js).
     Only what the first screen needs (user request 2026-11-18): the small files + the blocks of these songs (ids — the last
     song); the screen then runs VDB.loadRest() in the background */
  library(ids = []) {
    return this.libP = (async () => {
      await VDB.load();
      await VDB.ensure(ids);
      return {items: VDB.curated, sync_ready: true};
    })();
  },

  /* 가사: 우리 가사 (export/db/lyrics/<VocaDB 번호>.json — 서버가 가사 표·싱크 표에서 만듦) → 없으면 VocaDB 가사 (API).
     싱크: 그 파일 안의 싱크 (가사와 맞을 때만) — 플레이어에서 고친 싱크가 확인을 기다리면 그것 */
  async lyrics(site, name) {
    const it = this.item(site, name);
    let d = it.lyrics && it.vocadb ? await this.lyricsDoc(it) : null, vErr = "";
    if (d) d = {site, name, title: it.title, artist: it.artist, sync_fail: null, lyrics_file: "", link: null, ...d};
    else if (it.vocadb) {
      const v = await VDB.lyricsDoc(it.vocadb).catch(e => { vErr = e.message; return null; });  // nothing of ours → VocaDB's own lyrics (API)
      if (v) d = vdbLyrics(await this.withReading(v, it.vocadb), it);
      if (d && it.vsync) {  // a confirmed sync on these VocaDB lines (user request 2026-11-17) — used while the lines still match
        const sj = await this.readJson(this.vsyncPath(it), null);
        if (sj && Array.isArray(sj.times)) {
          d.sync = sj;
          d.sync_state = sj.times.length === d.groups.length && sj.lyrics_hash === await lyricsHash(d.groups) ? "ok" : "stale";
        }
      }
    }
    if (!d) return {site, name, title: it.title, artist: it.artist, sync_fail: null, lyrics_src: "", lyrics_kind: "", lyrics_file: "",
      raw: "", notes: [], groups: [], sync_state: "", sync: null, link: null, live: false, load_err: vErr};
    if (it.vocadb && d.groups.length) {
      let pj = await this.readJson(this.pendingPath(it), null), from = null;
      if (!pj && (pj = await this.donorPending(d))) from = d.shared.id;
      if (pj && Array.isArray(pj.times) && pj.times.length === d.groups.length && pj.lyrics_hash === await syncHash(d)) {
        d.sync = pj; d.sync_state = "ok";
        d.sync_pending = {...(pj.pending || {}), ...(from ? {from} : {})};  // 고친 싱크가 음원 관리의 확인(반영)을 기다리는 중
      }
    }
    return d;
  },
  /* our lyrics doc of a song (export/db/lyrics/<id>.json) → the whole doc, null when there is none.
     가사·싱크 나눔 (user 2026-11-24: "공유받으면 원본 파일을 가져다가 보여주면 된다" — the original's lyrics are not copied into
     each version): a version has no file — its list cell names the donor (it.lfrom) and the donor's file is shown, in
     this version's singer colors where they differ (it.lvc: lines with no part · it.lvp: {part name: colors}, a nameless
     합창). Same rule as music_backend
     table_export._linked. A version with something of its own (a sync edited on it, its own 가사편집 · 파트분리) keeps a
     file holding only what differs from the donor's (`over`: 1, table_export._doc_text) — laid over the donor's here. */
  async lyricsDoc(it) {
    const dir = `${this.out}/db/lyrics/`;
    if (it.lfrom) {
      const id = String(it.lfrom), base = await this.readJson(`${dir}${id}.json`, null);
      if (!base || base.over || !Array.isArray(base.groups)) return null;
      await VDB.ensure([+id]).catch(() => {});  // the donor's row: its title for '원곡 [제목] 에서 … 공유받습니다' (it.lft: the server's, when the list shows another name)
      const o = VDB.itemById(id), vc = it.lvc, vp = it.lvp || {};
      const plain = x => { const c = x.part ? vp[x.part.name] : vc; return c ? {...x, vc: c} : x; };
      return {...base, vocadb: String(it.vocadb), shared: {id, title: it.lft || (o && o.def) || id, original: !!o && o.type === "Original", sync: !!base.sync},
        groups: base.groups.map(g => g.cols ? {...plain(g), cols: g.cols.map(plain)} : plain(g))};
    }
    const d = await this.readJson(`${dir}${it.vocadb}.json`, null);
    if (!d || !d.over) return d;
    const base = d.shared && d.shared.id ? await this.readJson(`${dir}${d.shared.id}.json`, null) : null;
    if (!base || base.over) return null;
    const {over, vc, ...own} = d, doc = {...base, ...own};
    // same lines in this version's singer colors: vc = one per group ({vc, cols} for a group sung at once) or {all}
    if (vc) doc.groups = base.groups.map((g, i) => {
      const x = Array.isArray(vc) ? vc[i] : vc.all;
      return x && !Array.isArray(x) ? {...g, vc: x.vc, cols: (g.cols || []).map((c, j) => ({...c, vc: x.cols[j]}))} : {...g, vc: x};
    });
    return doc;
  },
  /* 가사·싱크 나눔 + 확인 대기 (user request 2026-11-23): a version that shares the donor's lyrics and has no sync of its own
     also plays the donor's waiting sync edit, not only its confirmed sync */
  async donorPending(d) {
    const sh = d && d.shared;
    if (!sh || !sh.id || (d.sync && !sh.sync)) return null;  // a sync of its own wins
    return this.readJson(`${this.base}sync_pending/vocadb/${sh.id}.json`, null);
  },

  /* 자동 가사 hangul reading (user 2026-11-16: the readings were made but romaji still showed) — export/db/reading/<id // 1000>.json.gz
     {id: {h, r, m}} from the server (vocadb/table_export.py _readings). Used only when VocaDB's original still hashes the same
     (h = first 16 hex of SHA-1 of the lines joined by \n); it takes the 발음 row (role r) in place of VocaDB's romaji
     (a line without a reading keeps the romaji), marked '자동' except the lines in m (checked / edited). */
  _readBlocks: new Map(),
  async withReading(v, id) {
    try {
      const b = Math.floor(+id / 1000);
      if (!this._readBlocks.has(b)) this._readBlocks.set(b, this.readBytes(`${this.out}/db/reading/${b}.json.gz`)
        .then(gz => new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).json()).catch(() => ({})));
      const s = (await this._readBlocks.get(b))[String(id)];
      if (!s || s.r.length !== v.g.length) return v;
      if (await sha16(v.g.map(x => x[0]).join("\n")) !== s.h) return v;
      let ri = v.roles.indexOf("r");
      const g = v.g.map(xs => xs.slice()), roles = v.roles.slice(), langs = (v.langs || roles.map(() => "")).slice();
      if (ri < 0) { ri = 1; roles.splice(1, 0, "r"); langs.splice(1, 0, ""); g.forEach(xs => xs.splice(1, 0, "")); }
      g.forEach((xs, k) => { if (s.r[k]) xs[ri] = s.r[k]; });
      const manual = (s.m || []).concat(g.map((xs, k) => s.r[k] ? -1 : k).filter(k => k >= 0));  // romaji kept → no '자동'
      return {...v, g, roles, langs, auto: ["r"], manual: {r: manual}, info: {...(v.info || {}), r: {by: "auto", fill: v.info && v.info.r}}};
    } catch (e) { return v; }
  },

  /* ---- 저장 ---- */
  /* 오류 신고: 신고 하나에 파일 하나 (Server\data\reports\<시각>_<번호>.json — 여럿이 보내도 안 겹침).
     깃허브에서 열면 그 저장소에 커밋 (WEB 만 받은 다른 사람도) · 폴더로 열면 그 폴더에 → 서버 PC 의 음원 관리 › 오류 신고가 git 으로 받아 봄 */
  async saveReport(d) {
    // user request: the manage screen shows who sent each report — on GitHub ask the name first (sync edits have no dialog)
    if (this.gh && !String(d.who || "").trim()) d = {...d, who: await this.ghWho()};
    const at = nowText(), id = at.replace(/[-: ]/g, "").replace(/^(\d{8})/, "$1_") + "_" + Math.random().toString(36).slice(2, 6);
    const r = {at, kind: String(d.kind || "기타").slice(0, 40), text: String(d.text || "").trim().slice(0, 3000),
               song: d.song || null, pos: d.pos ?? null, source: String(d.source || "").slice(0, 300),
               from: this.gh ? `깃허브 (${this.gh.repo})` : `폴더 (${this.name})`,
               who: String(d.who || store.get("reportWho", "") || "").trim().slice(0, 40)};  // sender (shared token → name typed in the report dialog)
    if (d.diag) r.diag = String(d.diag).slice(-12000);  // 안 보는 동안 멈춤 신고: 재생기 진단 기록 (play_engine.js diag)
    if (d.request) r.request = String(d.request).trim().slice(0, 300);  // 신곡 추가 요청: requested song name
    if (d.sync) r.sync = {vocadb: String(d.sync.vocadb), pending: String(d.sync.pending)};  // 싱크 수정 신고: VocaDB 곡 · 기다리는 파일 (Server\data 기준)
    if (d.replace && d.replace.from) r.replace = {from: String(d.replace.from).slice(0, 300), to: String(d.replace.to || "").slice(0, 300)};  // 텍스트 대치 제안
    const imgs = (d.images || []).filter(u => typeof u === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(u) && u.length < 3e6).slice(0, 5);
    if (imgs.length) r.images = imgs;  // 붙인 그림 (user request 2026-11-15) — data URLs, shown in Manage › 오류 신고
    await this.writeText(`${this.data}reports/${id}.json`, JSON.stringify(r, null, 1));
    return {ok: true, id};
  },
  /* 유저가 불러온 유튜브 재생목록 (user request 2026-11-22): one file per playlist, Server/data/user_playlists/<list>.json
     {list, url, title, n, thumb, users: {nick: last time}, first, last} → Manage › 추천 재생목록 lists them.
     Only where this player may write (folder · write token); nothing new (same nick, same day) → no commit */
  async saveUserPlaylist(p) {
    if (!this.canWrite) return;
    const who = String(store.get("reportWho", "") || "").trim().slice(0, 40) || "이름 없음", at = nowText();
    const path = `${this.data}user_playlists/${p.list}.json`;
    await this.locked(path, async () => {
      const old = await this.readJson(path, null) || {};
      if (old.users && String(old.users[who] || "").slice(0, 10) === at.slice(0, 10) && old.n === p.n) return;
      const d = {list: p.list, url: p.url, title: p.title, n: p.n, thumb: p.thumb || old.thumb || "",
                 users: {...(old.users || {}), [who]: at}, first: old.first || at, last: at};
      await this.writeText(path, JSON.stringify(d, null, 1) + "\n", who);
    });
  },
  /* Sync edits (user request): the player never replaces a sync. The edited sync waits in
     Server/data/sync_pending/vocadb/<VocaDB id>.json (keyed by the VocaDB song since 2026-11-14 — no old file paths) and one
     '싱크 수정' report goes to the manage screen. Until it is confirmed or thrown away the player plays the pending one. */
  pendingPath(it) { return `${this.base}sync_pending/vocadb/${it.vocadb}.json`; },
  vsyncPath(it) { return `${this.out}/db/vsync/${it.vocadb}.json`; },
  async currentSync(it) {  // pending edit first, else the sync in our lyrics file (or the one on VocaDB's lyrics)
    const pj = await this.readJson(this.pendingPath(it), null);
    if (pj && Array.isArray(pj.times)) return {sj: pj, pend: pj.pending || {}};
    if (!it.lyrics && it.vsync) {
      const v = await this.readJson(this.vsyncPath(it), null);
      return {sj: v && Array.isArray(v.times) ? v : null, pend: null};
    }
    const d = await this.lyricsDoc(it);
    const dp = await this.donorPending(d);  // the donor's waiting edit is what this version plays — edits start from it
    if (dp && Array.isArray(dp.times)) { const s = {...dp}; delete s.pending; return {sj: s, pend: null}; }
    return {sj: d && d.sync ? {...d.sync} : null, pend: null};
  },
  /* 관리자 토큰 (user request 2026-11-20): no 확인 대기, no report, no server needed — whatever the song's state (also with
     someone's edit waiting, user 2026-11-20). The sync goes straight into the song's player file on the data branch
     (export/db/lyrics/<id>.json, or vsync/<id>.json for VocaDB's lyrics) and the list row changes at once. A waiting edit
     it replaces is removed. The request sync_apply/admin_<VocaDB id>.json (one per song, overwritten by the next nudge)
     lets the server put the sync into its table when it runs and mark the song's 싱크 수정 reports up to then handled
     (error_reports.apply_player_requests; also at server start, before the export that would write the old sync back). */
  async savePending(it, sj, what, draft) {  // draft: an admin's 임시저장 — kept waiting like anyone's edit (2026-11-25)
    const path = this.pendingPath(it), lpath = `${this.out}/db/lyrics/${it.vocadb}.json`;
    await this.locked(path, async () => {
      const old = await this.readJson(path, null);
      const doc = it.lyrics ? await this.lyricsDoc(it) : null;  // a version (doc.shared) never gets here as an admin apply
      // 가사·싱크 나눔 (user request 2026-11-23): an admin applies a sync only on the donor (original) — on a version that
      // shares its lyrics the edit waits for 확인 like anyone's
      if (typeof isAdmin === "function" && isAdmin() && !(doc && doc.shared) && !draft) {
        const who = this.gh ? await this.ghWho() : String(store.get("reportWho", "") || "").trim();
        const s = {...sj}; delete s.pending; delete s.lyrics;
        if (doc) {
          doc.sync = s; doc.sync_state = "ok";
          await this.writeText(lpath, JSON.stringify(doc), who);  // the server rewrites it in its own form once it applies the request
        } else await this.writeText(this.vsyncPath(it), JSON.stringify(s), who);  // the player showed VocaDB's lyrics
        await this.writeText(`${this.data}sync_apply/admin_${it.vocadb}.json`, JSON.stringify({at: nowText(), who,
          syncs: [{vocadb: String(it.vocadb), sync: s}], songs: [{vocadb: String(it.vocadb), title: it.title || it.name || ""}]}, null, 1) + "\n", who);
        if (old) await this.removeFile(path, who);
        await this.oursCell(it, o => {  // the list state the server will write (table_export._ours · _state)
          const c = {...(o || {})};
          delete c.fail; delete c.score;
          Object.assign(c, {sync: "ok", method: s.method || ""});
          if (doc) Object.assign(c, {score: s.score ?? null, ly: c.parts ? "parts" : "ours"}); else Object.assign(c, {vsync: 1, ly: "vocadb"});
          return c;
        }, who);
        admSynced(it, s);
        return;
      }
      let rid = old && old.pending && old.pending.report;
      // someone else's edit is waiting (user request 2026-11-24): this edit gets a report of its own and the pending file
      // names it — the server then marks the earlier report '다른 신고로 덮어씀' (error_reports._sync_settled).
      // The same person editing again keeps the one report. An old pending file has no name → the report's sender.
      const who = this.gh ? await this.ghWho() : String(store.get("reportWho", "") || "").trim();
      let was = rid ? old.pending.who : "";
      if (rid && was === undefined) was = ((await this.readJson(`${this.data}reports/${rid}.json`, null).catch(() => null)) || {}).who;
      const over = rid && who && was && String(was).trim() !== who ? rid : "";
      if (!rid || over) {  // first edit since the last confirm, or over another person's waiting edit → one report for it
        rid = (await this.saveReport({kind: "싱크 수정", who,
          text: `플레이어에서 싱크를 고쳤습니다 (${what}). 음원 관리에서 반영하거나 버리세요.`
            + (over ? ` ${String(was).trim()} 님의 수정이 확인을 기다리던 곡입니다 — 그 수정 위에 고친 것 (앞 신고 ${over}).` : ""),
          song: {site: it.site, name: it.name, title: it.title, artist: it.artist || "", vocadb: String(it.vocadb)},
          sync: {vocadb: it.vocadb, pending: `sync_pending/vocadb/${it.vocadb}.json`}})).id;
      }
      sj.pending = {report: rid, at: nowText(), what, who};
      await this.writeText(path, pyJson(sj));
    });
  },
  /* 파트분리 (user request 2026-11-21, 관리자 토큰 only): which vocal sings each lyrics group. Like an admin's sync edit it goes
     straight into the song's player file, and sync_apply/admin_part_<id>.json lets the server keep it in its table
     (vocadb/lyrics_parts.py — kept while the lyrics are the same). d.parts[i] = {name, color, colors?, own?} or null (own: an admin-made part — 파트 추가, its colors kept), d.vc[i] = its colors */
  async saveParts(d) {
    if (!(typeof isAdmin === "function" && isAdmin())) throw new Error("관리자 토큰만 파트를 나눌 수 있습니다.");
    const it = this.item(d.site, d.name), lpath = `${this.out}/db/lyrics/${it.vocadb}.json`;
    let has = false;
    await this.locked(lpath, async () => {
      const doc = it.lyrics && it.vocadb ? await this.lyricsDoc(it) : null;  // a version: written whole, the server makes it small again
      if (!doc || !Array.isArray(d.parts) || doc.groups.length !== d.parts.length)
        throw new Error("우리 가사가 있는 곡만 파트를 나눌 수 있습니다 (가사가 바뀌었으면 곡을 다시 열어 주세요).");
      doc.groups.forEach((g, i) => {
        if (g.cols) return;  // groups sung at once keep their columns
        const p = d.parts[i];
        if (p) g.part = {name: p.name, color: p.color || "", ...(p.colors ? {colors: p.colors} : {}), ...(p.own ? {own: 1} : {})}; else delete g.part;
        if (Array.isArray(d.vc[i])) g.vc = d.vc[i];
      });
      has = doc.groups.some(g => g.part || g.cols);
      const who = this.gh ? await this.ghWho() : String(store.get("reportWho", "") || "").trim();
      await this.writeText(lpath, JSON.stringify(doc), who);
      await this.writeText(`${this.data}sync_apply/admin_part_${it.vocadb}.json`, JSON.stringify({at: nowText(), who,
        parts: [{vocadb: String(it.vocadb), hash: await lyricsHash(doc.groups), parts: doc.groups.map(g => !g.cols && g.part ? {name: g.part.name, color: g.part.color || "", ...(g.part.own ? {colors: g.part.colors, own: 1} : {})} : null)}],
        songs: [{vocadb: String(it.vocadb), title: it.title || it.name || ""}]}, null, 1) + "\n", who);
      await this.oursCell(it, o => {  // list badge 파트분리 — the server's cell (2026-11-22)
        const c = {...(o || {})};
        // a version that showed its donor's file now has a file of its own (the server decides again when it applies the request)
        delete c.from; delete c.vc; delete c.vp; delete c.ft;
        if (has) c.parts = 1; else delete c.parts;
        c.ly = has ? "parts" : "ours";
        return c;
      }, who);
    });
    return this.lyrics(d.site, d.name);
  },
  /* 가사편집 (user request 2026-11-22, 관리자 토큰 only): rows added · edited · deleted in the player. Like 파트분리 it goes
     straight into the song's player file, and sync_apply/admin_lyrics_<id>.json lets the server keep it in its table
     (vocadb/lyrics_edit.py — used while the page's lyrics are the ones the edit began on: base). d.from = hash of the groups the
     edit began on, d.groups = the new groups. New lyrics drop the old sync (the player saves the times right after) */
  async saveLyrics(d) {
    if (!(typeof isAdmin === "function" && isAdmin())) throw new Error("관리자 토큰만 가사를 고칠 수 있습니다.");
    const it = this.item(d.site, d.name), lpath = `${this.out}/db/lyrics/${it.vocadb}.json`;
    await this.locked(lpath, async () => {
      const doc = it.lyrics && it.vocadb ? await this.lyricsDoc(it) : null;  // a version: written whole, the server makes it small again
      const groups = (Array.isArray(d.groups) ? d.groups : []).map(cleanGroup).filter(Boolean);
      if (!doc || !groups.length) throw new Error("우리 가사가 있는 곡만 가사를 고칠 수 있습니다.");
      const was = await lyricsHash(doc.groups), now = await lyricsHash(groups);
      if (was !== d.from && was !== now) throw new Error("그 사이 가사가 바뀌었습니다 — 곡을 다시 열어 주세요.");
      const who = this.gh ? await this.ghWho() : String(store.get("reportWho", "") || "").trim();
      const base = (doc.edited && doc.edited.base) || was;  // the page's lyrics hash, kept across later edits
      doc.groups = groups; doc.edited = {base, who, at: nowText()};
      if (was !== now) { doc.sync = null; doc.sync_state = ""; }
      await this.writeText(lpath, JSON.stringify(doc), who);
      await this.writeText(`${this.data}sync_apply/admin_lyrics_${it.vocadb}.json`, JSON.stringify({at: nowText(), who,
        lyrics: [{vocadb: String(it.vocadb), base, groups: groups.map(({vc, ...g}) => g)}],
        songs: [{vocadb: String(it.vocadb), title: it.title || it.name || ""}]}, null, 1) + "\n", who);
      const parted = groups.some(g => g.part || g.cols);
      await this.oursCell(it, o => {  // list badges — the server's cell (2026-11-22): new lyrics drop the sync
        const c = {...(o || {})};
        // a version that showed its donor's file now has a file of its own (the server decides again when it applies the request)
        delete c.from; delete c.vc; delete c.vp; delete c.ft;
        if (parted) c.parts = 1; else delete c.parts;
        c.ly = parted ? "parts" : "ours";
        if (was !== now) { delete c.method; delete c.score; c.sync = c.sync === "fail" ? "fail" : "none"; }
        return c;
      }, who);
    });
    return this.lyrics(d.site, d.name);
  },
  /* 관리자 저장 → the song's list state (user request 2026-11-22: the list and filters show only what the server sends).
     The same `ours` cell the server writes (music_backend table_export._state — ly · sync · fail · parts · method · score)
     goes into songs/patch.json.gz + index.json, the server's own '바뀐 곡' file: this player shows it now, the others on their
     next load, and the server writes the same when it runs the request. fn(old cell or null) → new cell */
  async oursCell(it, fn, who) {
    const d = `${this.out}/db/songs/`, vid = String(it.vocadb || "");
    if (!vid || typeof VDB === "undefined" || !VDB.col) return;
    await this.locked(d + "patch.json.gz", async () => {
      const itext = await this.readText(d + "index.json"), idx = JSON.parse(itext.replace(/^﻿/, ""));
      const oc = idx.cols.indexOf("ours"), ic = idx.cols.indexOf("vocadb_id");
      const unzip = gz => new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).json();
      const doc = idx.patch ? await unzip(await this.readBytes(d + idx.patch.f)) : {rows: [], del: []};
      if ((doc.del || []).map(String).includes(vid)) return;
      let row = doc.rows.find(r => String(r[ic]) === vid);
      if (!row) { const got = (await VDB.rowsOf([vid]))[0]; if (!got) return; doc.rows.push(row = [...got]); }
      const cell = fn(row[oc] || null) || 0;
      if (JSON.stringify(cell) !== JSON.stringify(row[oc])) {
        row[oc] = cell;
        doc.rows.sort((a, b) => a[ic] - b[ic]);
        const dels = (doc.del || []).map(String).sort((a, b) => a - b);
        const text = '{"rows":[\n' + doc.rows.map(r => JSON.stringify(r)).join(",\n") + '\n],"del":' + JSON.stringify(dels) + "}\n";  // table_export._patch_text
        const gz = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
        const h = [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
        await this.writeBytes(d + "patch.json.gz", gz, who);
        idx.patch = {f: "patch.json.gz", h, n: doc.rows.length, del: dels.length};
        await this.writeText(d + "index.json", JSON.stringify(idx) + (itext.includes(CRLF) ? CRLF : LF), who);
      }
      const r = VDB.rowById.get(vid) || (it.r !== undefined ? it.r : null);
      if (r) r[VDB.col.ours] = cell;  // this player: the row the song's fields read
      if (it.r && it.r !== r) it.r[VDB.col.ours] = cell;
    });
  },
  /* 싱크 밀기(±초)만: 지금 싱크(기다리는 수정이 있으면 그것)의 offset 만 바꿔 기다리는 파일로 */
  async saveOffset(d) {
    const it = this.item(d.site, d.name);
    if (!it.vocadb) throw new Error("싱크가 없는 곡입니다.");
    const {sj} = await this.currentSync(it);
    if (!sj || !Array.isArray(sj.times)) throw new Error("싱크가 없는 곡입니다.");
    const off = Math.round((+d.offset || 0) * 100) / 100;
    sj.offset = off;
    await this.savePending(it, sj, `밀기 ${off > 0 ? "+" : ""}${off}초`);
    return this.lyrics(d.site, d.name);
  },
  /* 직접 맞추기 저장: 서버의 save_sync 와 같은 값·같은 순서 (times·matched·method·edited·synced_at) → 기다리는 파일로 */
  async saveTimes(d) {
    const it = this.item(d.site, d.name);
    const L = await this.lyrics(d.site, d.name);
    if (!L.groups.length || !it.vocadb) throw new Error("가사가 없는 곡입니다.");
    if (!Array.isArray(d.times) || d.times.length !== L.groups.length) throw new Error("시간 개수가 가사 묶음 수와 다릅니다.");
    const times = d.times.map(t => Math.round(+t * 100) / 100);
    const ok = Array.isArray(d.matched) && d.matched.length === times.length ? d.matched.map(Boolean) : times.map(() => true);
    const hash = await syncHash(L), now = isoNow();
    const cur = (await this.currentSync(it)).sj || {};
    delete cur.pending;
    Object.assign(cur, {version: 1, times, lyrics_hash: hash, offset: Math.round((+(d.offset ?? cur.offset ?? 0) || 0) * 100) / 100});
    cur.edited = now;
    cur.matched = ok;
    if (ok.every(Boolean)) cur.method = "manual"; else if (cur.method == null || cur.method === "manual") cur.method = "auto";
    if (cur.method == null) cur.method = "manual";
    Object.assign(cur, {version: 2, synced_at: now});
    // the list row is not touched here (user request 2026-11-22: it shows only the server's data — an admin's save writes
    // that data itself, oursCell; anyone else's edit waits for the manage screen)
    await this.savePending(it, cur, `직접 맞추기 — 찍은 묶음 ${ok.filter(Boolean).length}/${ok.length}${d.draft ? " (임시저장)" : ""}`, !!d.draft);
    return this.lyrics(d.site, d.name);
  },
};

function isoNow() {  // '2026-11-08T15:20:03' (파이썬 isoformat(timespec="seconds"))
  return nowText().replace(" ", "T");
}
/* 서버(파이썬 json.dumps(…, ensure_ascii=False, indent=1))와 같은 모양: 시간·밀기 같은 실수는 1.0 처럼 소수점까지 */
const FLOAT_KEYS = new Set(["offset", "score", "duration"]);
function pyJson(obj, eol = /Windows/.test(navigator.userAgent) ? CRLF : LF) {
  const f = v => Number.isInteger(v) ? v.toFixed(1) : String(v);
  return JSON.stringify(obj, function (k, v) {
    return typeof v === "number" && (this === obj.times || FLOAT_KEYS.has(k)) ? `\u0001${f(v)}\u0001` : v;
  }, 1).replace(/"\\u0001(.*?)\\u0001"/g, "$1").replace(/\n/g, eol);
}
/* 가사 묶음 확인값: 서버 lyrics_hash 와 같음 (원문 줄들을 줄바꿈으로 이은 글의 SHA-1 앞 16자리) */
const lyricsHash = groups => sha16(groups.map(g => g.orig).join("\n"));
/* one lyrics group from 가사편집 → as the server keeps it (vocadb/lyrics_edit.py _clean — same orig rule: 원문 lines joined) */
function cleanGroup(g) {
  const lines = (g && Array.isArray(g.lines) ? g.lines : []).map(l => ({...l, text: String(l.text || "").trim().slice(0, 500),
    role: ["o", "r", "t", "x"].includes(l.role) ? l.role : "t"})).filter(l => l.text);
  if (!lines.length) return null;
  if (!lines.some(l => l.role === "o")) lines[0].role = "o";
  return {...g, lines, orig: lines.filter(l => l.role === "o").map(l => l.text).join(" ")};
}
/* first 16 hex of SHA-1 (the server's lyrics_hash · reading h) */
async function sha16(text) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
/* the hash a sync of this lyrics doc must carry: our lyrics file → the server's (its sync); VocaDB lyrics → made from the lines
   shown now (a VocaDB-lyrics sync may be stale — its old hash must not be copied into a new edit) */
async function syncHash(d) {
  return d.sync && d.lyrics_kind !== "vocadb" ? d.sync.lyrics_hash : lyricsHash(d.groups);
}


