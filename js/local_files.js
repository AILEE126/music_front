/* 플레이어(서버 없이 html 을 바로 엶)가 곡 목록·가사·싱크·특이사항·영상 연결·오버레이 파일·오류 신고를 읽고 쓰는 곳 (LOCAL).
   읽는 곳 둘 중 하나:
   · 깃허브에서 열기: 비공개 저장소를 토큰으로 (GitHub API — 폴더를 고르지 않아 회사 보안 프로그램에 안 걸림). 저장은 그 저장소에 커밋
   · 폴더 고르기 (서버 PC 만): 처음 한 번 고른 Server\data 폴더(곡 정보 파일만 — csv·json·txt)에서 계속 읽고 씀 — 브라우저 폴더 권한
     (Server·프로그램 폴더·Music 폴더를 골라도 그 안의 Server\data 를 찾아 씀)
     Data lives in Server\data, not WEB (user request: only WEB is zipped and handed out — others read GitHub).
     읽기: Server\data\export (서버가 써 둔 곡 목록·가사). 썸네일은 원곡 영상의 썸네일 주소(thumb)를 바로
   (오프라인 mp3 는 플레이어에서 고른 mp3 폴더 — offline_folder.js)
     쓰기: 특이사항 → 서버와 같은 파일(Server\data\*.json)·같은 형식
     싱크 밀기(±초)·직접 맞추기 → Server\data\sync_pending\<싱크 파일> + '싱크 수정' 오류 신고 (본 싱크 파일은 그대로 —
     음원 관리에서 반영해야 바뀜. 그때까지 이 플레이어는 고친 싱크로 틂)
   화면의 api()·post() 는 모두 LOCAL.request() 로 옴 (shared_screen_helpers.js — 플레이어는 서버에 묻지 않음) */
const CRLF = "\r\n", LF = "\n";
const GH_API = "https://api.github.com";
const DATA_REPO_DIR = "Server/data/";  // data folder in the repo / program folder (moved out of WEB so WEB = player code only)
const DATA_BRANCH = "data";  // branch holding Server/data (server: Server/web_api/data_git_publish.py)
/* 깃허브 API 로 보낼 파일 내용 (base64 — 한글이 깨지지 않게 UTF-8 바이트로) */
function b64utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
/* 썸네일 그림을 못 받으면(지워진 영상·주소 끝 값이 필요한 니코니코 새 영상) 깨진 그림 대신 ♪ 칸 — 그 주소는 기억해 다시 부르지 않음 */
const BAD_THUMBS = new Set();
document.addEventListener("error", e => {
  const t = e.target;
  if (t.tagName !== "IMG" || !/nimg\.jp|ytimg\.com/.test(t.src)) return;
  BAD_THUMBS.add(t.src);
  if (t.classList.contains("thumb")) t.replaceWith(Object.assign(document.createElement("span"), {className: t.className, textContent: "♪"}));
  else t.removeAttribute("src");
}, true);
const notFound = path => Object.assign(new Error(`${path} 이 없습니다.`), {name: "NotFoundError"});

/* ---------- 지난번에 고른 폴더 기억 (IndexedDB 에 폴더 손잡이 저장) ---------- */
const idb = idbKV("music-offline");  // shared_screen_helpers.js

const LOCAL = {
  dir: null, gh: null, base: "", items: new Map(), synced: new Map(), chains: new Map(),
  get ready() { return !!(this.dir || this.gh); },

  /* ---- 깃허브에서 열기: 저장소(아이디/이름)·토큰 → 그 저장소의 Server/data 를 읽고 씀 (기억: 이 브라우저에만) ---- */
  savedGitHub() {
    const g = store.get("gh", null);
    // GitHub account/repo renamed (Alie14/Music → AILEE126/music_backend): saved logins follow the new name
    if (g && /^alie14\/music$/i.test(g.repo || "")) { g.repo = "AILEE126/music_backend"; store.set("gh", g); }
    return g;
  },
  async useGitHub(repo, token, remember = true) {
    repo = String(repo || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    token = String(token || "").trim();
    if (repo.split("/").length !== 2 || !token) throw new Error("저장소(아이디/저장소)와 토큰을 넣으세요.");
    this.progress("깃허브에 연결하는 중…", 0.05);
    let r;
    try { r = await fetch(`${GH_API}/repos/${repo}`, {headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json"}, cache: "no-store"}); }
    catch (e) { throw new Error("깃허브에 연결하지 못했습니다. 인터넷·회사 보안 프로그램을 확인하세요."); }
    if (r.status === 401) throw new Error("토큰이 틀렸거나 만료·삭제됐습니다.");
    if (!r.ok) throw new Error(`이 토큰으로 ${repo} 저장소를 볼 수 없습니다 (${r.status}). 협업자 초대·토큰의 저장소 선택을 확인하세요.`);
    const info = await r.json();
    const prev = {gh: this.gh, dir: this.dir, base: this.base};  // 못 열면 전에 열려 있던 곳 그대로
    // Data lives on the 'data' branch (one commit the server keeps replacing — user request: no pile of data commits).
    // Reads and writes (reports·memos·sync edits) both go there; repo without that branch yet → its default branch.
    let ref = DATA_BRANCH;
    try {
      const b = await fetch(`${GH_API}/repos/${repo}/branches/${DATA_BRANCH}`, {headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json"}, cache: "no-store"});
      if (b.status === 404) ref = info.default_branch || "main";
    } catch (e) {}
    this.gh = {repo, token, ref, write: !!(info.permissions || {}).push};
    this.dir = null; this.base = DATA_REPO_DIR;
    // 곡 목록(수 MB)은 여기서 한 번만 받아 두고 곡 목록 그리기(library)에서 그대로 씀
    this.libText = await this.readTextP(`${this.out}/library.json`, "곡 목록 받는 중", 0.1, 0.8).catch(e => {
      Object.assign(this, prev);
      throw e.name === "NotFoundError" ? new Error(`저장소에 ${DATA_REPO_DIR}export/library.json 이 없습니다. 서버를 켠 PC 에서 한 번 푸시하세요.`) : e;
    });
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
    for (const b of bases) { try { await this.file(`${b}export/library.json`, dir); base = b; break; } catch (e) {} }
    if (base == null) {
      throw new Error(`'${dir.name}' 폴더에서 export\\library.json 을 찾지 못했습니다.\n`
        + "서버 PC 의 프로그램 폴더 안 Server\\data 폴더를 고르세요. 처음이면 서버를 한 번 켜야 이 파일이 생깁니다.");
    }
    this.dir = dir; this.gh = null; this.base = base;
  },
  get out() { return `${this.base}export`; },  // 서버가 화면용으로 써 둔 곡 목록·가사
  get data() { return this.base; },  // 서버와 같이 쓰는 특이사항 등 (Server\data) · 영상 연결은 읽기만 (고치기는 음원 관리)
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
  /* 화면 가운데 로딩 막대에 알림 (플레이어 화면이 progress 를 바꿔 끼움) — label, 0~1 (null: 얼마나 남았는지 모름) */
  progress(label, frac) {},
  /* 큰 파일 읽기 + 받은 만큼 알림 (from~to 구간을 채움). 깃허브는 받는 중인 크기를 보며, 전체 크기를 모르면 받은 MB 만 */
  async readTextP(path, label, from, to) {
    if (!this.gh) { this.progress(label + "…", from); return this.readText(path); }  // 서버·폴더: 금방 읽음
    const r = await this.ghFetch(path, {raw: true});
    const total = +r.headers.get("Content-Length") || 0, gz = /gzip|br|deflate/.test(r.headers.get("Content-Encoding") || "");
    if (!r.body || !r.body.getReader) return r.text();
    const rd = r.body.getReader(), parts = [];
    let got = 0;
    for (;;) {
      const {done, value} = await rd.read();
      if (done) break;
      parts.push(value); got += value.length;
      const mb = (got / 1048576).toFixed(1);
      const f = total && !gz && got <= total ? got / total : null;
      this.progress(`${label}… ${mb}MB${f != null ? ` / ${(total / 1048576).toFixed(1)}MB` : ""}`, f != null ? from + (to - from) * f : null);
    }
    const buf = new Uint8Array(got);
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    return new TextDecoder().decode(buf);
  },
  async readText(path) {
    if (this.gh) return (await this.ghFetch(path, {raw: true})).text();
    return (await (await this.file(path)).getFile()).text();
  },
  async readJson(path, dflt) {
    try { return JSON.parse((await this.readText(path)).replace(/^\uFEFF/, "")); }
    catch (e) { if (e.name === "NotFoundError" || e instanceof SyntaxError) return dflt; throw e; }
  },
  async writeText(path, text) {
    if (this.gh) {  // 깃허브: 지금 파일의 sha 를 받아 그 위에 커밋 (새 파일이면 sha 없이)
      const who = await this.ghWho();
      let sha;
      try { sha = (await (await this.ghFetch(path)).json()).sha; } catch (e) { if (e.name !== "NotFoundError") throw e; }
      await this.ghFetch(path, {method: "PUT", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: `${who}: 서버 없이 저장 — ${path.split("/").pop()}`, content: b64utf8(text), sha, branch: this.gh.ref,
                              author: {name: who, email: "music-player@users.noreply.github.com"}})});
      return;
    }
    const w = await (await this.file(path, this.dir, true)).createWritable();
    await w.write(text); await w.close();
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
    return BAD_THUMBS.has(u) ? "" : u;  // 못 받은 그림은 ♪
  },

  /* ---- 화면 요청 (서버 주소와 같은 이름) ---- */
  async request(path, opt = {}) {
    if (!this.ready) throw new Error("먼저 깃허브에서 열거나 Server\\data 폴더를 고르세요.");
    const u = new URL(path, "http://x/"), q = Object.fromEntries(u.searchParams);
    const body = opt.body ? JSON.parse(opt.body) : {};
    const post = (opt.method || "GET") === "POST";
    if (!post && u.pathname === "/api/library") return this.library();
    // 곡 하나에 대한 요청인데 곡 목록을 아직 안 읽음: 한 번 읽어 둠
    if ((q.name || body.name) && !this.items.size) await (this.itemsP = this.itemsP || this.library().finally(() => { this.itemsP = null; }));
    if (!post && u.pathname === "/api/lyrics") return this.lyrics(q.site, q.name);
    if (!post && u.pathname === "/api/stream/views") return this.streamViews(q.name);
    if (post && u.pathname === "/api/memo") return this.saveMemo(body);
    if (post && u.pathname === "/api/report") return this.saveReport(body);
    if (post && u.pathname === "/api/sync/save") return body.times == null ? this.saveOffset(body) : this.saveTimes(body);
    if (["/api/now", "/api/ovset", "/api/ovprograms"].includes(u.pathname)) return this.overlay(u.pathname, post, body);
    throw new Error("플레이어에서 할 수 없는 일입니다 (싱크 만들기·가사 받기 등은 서버 PC 의 음원 관리에서).");
  },
  /* ---- 가사 오버레이(WEB\tools\lyrics_overlay.bat)와 주고받는 파일: 이 PC 의 WEB\overlay 의
     now_playing.json(지금 곡·가사 묶음) · lyrics_overlay.json(설정) · overlay_programs.json(오버레이가 6초마다 씀 — 켜져 있는지)
     (WEB\overlay, not the data folder: a PC that only got the WEB zip has no data folder but can still run the overlay)
     프로그램 폴더째 연 화면은 그 안의 WEB\overlay · 그 밖은 따로 한 번 고른 이 PC 의 WEB 폴더 (ovDir — 오버레이 단추·⚙ 를 누를 때 고름) ---- */
  ovDir: null, ovBase: "",
  get ovReady() { return !!this.ovPlace(); },
  ovPlace() {
    if (this.dir && this.base.endsWith(DATA_REPO_DIR))  // opened the program folder (or above) → its WEB\overlay
      return {dir: this.dir, base: this.base.slice(0, -DATA_REPO_DIR.length) + "WEB/overlay/"};
    return this.ovDir ? {dir: this.ovDir, base: this.ovBase} : null;
  },
  /* 지난번에 고른 오버레이 폴더를 권한이 남아 있으면 그대로 (물어보지 않음) */
  async ovReopen() {
    if (this.ovReady) return;
    try {
      const d = await idb("get", "overlay-dir");
      if (d && await d.queryPermission({mode: "readwrite"}) === "granted") await this.ovUse(d);
    } catch (e) {}
  },
  /* 오버레이 폴더 고르기 (단추를 누를 때만 — 브라우저가 그때만 물어봄): WEB 폴더 · WEB\overlay · 프로그램 폴더 아무거나 */
  async ovConnect() {
    if (this.ovReady) return true;
    const saved = await idb("get", "overlay-dir").catch(() => null);
    try {
      if (saved && await saved.requestPermission({mode: "readwrite"}) === "granted") { await this.ovUse(saved); return true; }
    } catch (e) {}
    if (!window.showDirectoryPicker) throw new Error("이 브라우저는 폴더 읽고 쓰기를 지원하지 않습니다. 크롬이나 엣지로 여세요.");
    if (!await uiConfirm("가사 오버레이와 지금 곡을 주고받으려면 이 PC 의 WEB 폴더(플레이어 폴더)를 한 번 골라야 합니다.\n(이 PC 의 파일을 따로 허락받음 — 다음부터는 묻지 않음)", "폴더 고르기")) return false;
    const d = await showDirectoryPicker({id: "overlay", mode: "readwrite"});
    await this.ovUse(d);
    try { await idb("put", "overlay-dir", d); } catch (e) {}
    return true;
  },
  async ovUse(d) {
    // WEB\overlay inside the picked folder: WEB (has tools) → overlay/ · program folder (has WEB) → WEB/overlay/ · overlay itself → ""
    // (overlay is not in git/zip → created on first write)
    const has = async n => { try { await d.getDirectoryHandle(n); return true; } catch (e) { return false; } };
    const b = await has("tools") ? "overlay/" : await has("WEB") ? "WEB/overlay/" : d.name === "overlay" ? "" : null;
    if (b == null) throw new Error(`'${d.name}' 폴더는 WEB 폴더가 아닙니다. 플레이어 WEB 폴더(tools 가 들어 있는 곳)를 고르세요.`);
    this.ovDir = d; this.ovBase = b;
  },
  async overlay(path, post, body) {
    const at = this.ovPlace();
    if (!at) {  // 깃허브에서 연 화면인데 아직 오버레이 폴더를 안 고름: 알림은 버리고, 설정은 이 브라우저에만
      if (path === "/api/now") return {ok: true};
      if (path === "/api/ovset") { if (post) store.set("ovset", {...store.get("ovset", {}), ...body}); return {...OVSET_DEFAULTS, ...store.get("ovset", {})}; }
      return {items: [], running: false, updated: 0, need: true};  // need: 폴더를 골라야 함
    }
    const io = at.dir === this.dir ? this : {  // separately picked WEB folder (GitHub mode, or data folder opened alone)
      file: (p, c = false) => this.file(p, at.dir, c),
      async readText(p) { return (await (await this.file(p)).getFile()).text(); },
      async readJson(p, dflt) { try { return JSON.parse((await this.readText(p)).replace(/^\uFEFF/, "")); } catch (e) { return dflt; } },
      async writeText(p, t) { const w = await (await this.file(p, true)).createWritable(); await w.write(t); await w.close(); },
      async modified(p) { try { return (await (await this.file(p)).getFile()).lastModified; } catch (e) { return 0; } },
    };
    const f = n => at.base + n;
    if (path === "/api/now") { await io.writeText(f("now_playing.json"), JSON.stringify({...body, at: Date.now()})); return {ok: true}; }
    if (path === "/api/ovset") {
      const cur = {...OVSET_DEFAULTS, ...(await io.readJson(f("lyrics_overlay.json"), {}))};
      if (!post) return cur;
      for (const k of Object.keys(OVSET_DEFAULTS)) if (k in body) cur[k] = body[k];
      await io.writeText(f("lyrics_overlay.json"), JSON.stringify(cur, null, 1));
      return cur;
    }
    const updated = await io.modified(f("overlay_programs.json"));  // 오버레이가 6초마다 새로 씀 → 15초 안이면 켜져 있음
    return {items: await io.readJson(f("overlay_programs.json"), []), running: Date.now() - updated < 15000, updated};
  },
  /* 니코니코 원곡 재생수 (서버의 stream_views 와 같은 요청): 중계 페이지의 니코니코 플레이어가 알려 준 값 — 저장하지 않음 */
  async streamViews(name) {
    const it = this.items.get("stream/" + name), ref = it && vidRef(it.video);
    return {views: ref && ref.kind === "nico" ? await nicoViews(ref.id) : null};
  },
  item(site, name) {
    const it = this.items.get(site + "/" + name);
    if (!it) throw new Error("곡을 찾을 수 없습니다.");
    return it;
  },

  /* 곡 목록: 서버가 써 둔 library.json + 지금 파일의 특이사항·영상 연결 (서버 없이 바꾼 특이사항도 바로) */
  async library() {
    const text = this.libText || await this.readTextP(`${this.out}/library.json`, "곡 목록 받는 중", 0.1, 0.8).catch(() => null);
    this.libText = null;
    this.progress("특이사항·영상 연결 읽는 중…", 0.85);
    const [memos, links] = await Promise.all([this.readJson(`${this.data}song_memos.json`, {}), this.readJson(`${this.data}video_links.json`, {})]);
    this.progress("곡 목록 정리하는 중…", 0.92);
    let lib = null;
    try { lib = text ? JSON.parse(text.replace(/^﻿/, "")) : null; } catch (e) {}
    if (!lib) throw new Error("곡 목록(library.json)을 읽지 못했습니다. 서버를 한 번 켜면 다시 만듭니다.");
    this.items.clear();
    for (const it of lib.items) {
      this.items.set(it.site + "/" + it.name, it);
      it.memo = memos[it.key] || null;
      this.applyLink(it, (links[it.key] || {}).url || "");
      Object.assign(it, this.synced.get(it.site + "/" + it.name) || {});  // 이번에 서버 없이 맞춘 싱크
    }
    lib.sync_ready = true;  // 싱크 단추는 그대로 보이고, 누르면 '서버를 실행시켜야 합니다'
    return lib;
  },
  applyLink(it, url) {  // 영상 연결: 연결한 영상이 영상 후보 맨 앞 (서버 library() 와 같음)
    const rest = (it.videos || []).filter(u => u !== it.video_link && u !== url);
    it.videos = url ? [url, ...rest] : rest;
    it.video_link = url;
  },

  /* 가사: 서버가 써 둔 곡 가사 + 지금 싱크 파일의 시간·밀기 (가사가 같을 때만 — 가사가 바뀌었으면 서버에서 다시 맞춰야 함) */
  async lyrics(site, name) {
    const it = this.item(site, name);
    const d = await this.readJson(`${this.out}/lyrics/${site}/${name}.json`, null);
    if (!d) return {site, name, title: it.title, artist: it.artist, sync_fail: null, lyrics_src: "", lyrics_kind: "", lyrics_file: "",
      raw: "", notes: [], groups: [], sync_state: "", sync: null, link: null, live: false};
    const {sj, pend} = it.sync_file ? await this.currentSync(it) : {sj: null, pend: null};
    if (sj && Array.isArray(sj.times) && sj.times.length === d.groups.length
        && sj.lyrics_hash === (d.sync ? d.sync.lyrics_hash : await lyricsHash(d.groups))) {
      if (d.sync) Object.assign(d.sync, {times: sj.times, offset: sj.offset || 0, matched: sj.matched || d.sync.matched, method: sj.method, edited: sj.edited});
      else { d.sync = sj; d.sync_state = "ok"; }  // 서버 없이 처음 맞춘 싱크 (화면용 데이터에는 아직 없음)
      d.sync_pending = pend;  // 고친 싱크가 음원 관리의 확인(반영)을 기다리는 중
    }
    return d;
  },

  /* ---- 저장 (서버의 song_memos.py · video_search_and_link.py · sync_save_and_lrc.py 와 같은 파일·같은 모양) ---- */
  async saveMemo(d) {
    const it = this.item(d.site, d.name);
    const memo = await this.updateJson(`${this.data}song_memos.json`, m => {
      let text = String(d.text || "").trim().slice(0, 5000);
      if (d.add) {
        const old = (m[it.key] || {}).text || "";
        if (old.includes(text)) return m[it.key] || null;
        text = `${old}\n${text}`.trim().slice(0, 5000);
      }
      if (text) m[it.key] = {text, saved: nowText()}; else delete m[it.key];
      return m[it.key] || null;
    });
    it.memo = memo;
    return {memo};
  },
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
    if (d.sync) r.sync = {file: String(d.sync.file), pending: String(d.sync.pending)};  // 싱크 수정 신고: 본 파일 · 기다리는 파일 (Server\data 기준)
    await this.writeText(`${this.data}reports/${id}.json`, JSON.stringify(r, null, 1));
    return {ok: true, id};
  },
  /* Sync edits (user request): never replace the real sync file from the player. The edited sync waits in
     Server/data/sync_pending/<sync file> and one '싱크 수정' report goes to the manage screen. Until it is confirmed
     (반영 → real file replaced) or thrown away (버리기), the player plays the pending one. More edits to the same
     song update the same pending file / report. */
  pendingPath(it) { return `${this.base}sync_pending/${it.sync_file}`; },
  async currentSync(it) {  // pending edit first, else the real sync file
    const pj = await this.readJson(this.pendingPath(it), null);
    if (pj && Array.isArray(pj.times)) return {sj: pj, pend: pj.pending || {}};
    return {sj: await this.readJson(this.base + it.sync_file, null), pend: null};
  },
  async savePending(it, sj, what) {
    const path = this.pendingPath(it);
    await this.locked(path, async () => {
      const old = await this.readJson(path, null);
      let rid = old && old.pending && old.pending.report;
      if (!rid) {  // first edit since the last confirm → one report for it
        rid = (await this.saveReport({kind: "싱크 수정", text: `플레이어에서 싱크를 고쳤습니다 (${what}). 음원 관리에서 반영하거나 버리세요.`,
          song: {site: it.site, name: it.name, title: it.title, artist: it.artist || ""},
          sync: {file: it.sync_file, pending: `sync_pending/${it.sync_file}`}})).id;
      }
      sj.pending = {report: rid, at: nowText(), what};
      await this.writeText(path, pyJson(sj));
    });
  },
  /* 싱크 밀기(±초)만: 지금 싱크(기다리는 수정이 있으면 그것)의 offset 만 바꿔 기다리는 파일로 */
  async saveOffset(d) {
    const it = this.item(d.site, d.name);
    if (!it.sync_file) throw new Error("싱크가 없는 곡입니다.");
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
    if (!L.groups.length || !it.sync_file) throw new Error("가사가 없는 곡입니다.");
    if (!Array.isArray(d.times) || d.times.length !== L.groups.length) throw new Error("시간 개수가 가사 묶음 수와 다릅니다.");
    const times = d.times.map(t => Math.round(+t * 100) / 100);
    const ok = Array.isArray(d.matched) && d.matched.length === times.length ? d.matched.map(Boolean) : times.map(() => true);
    const hash = L.sync ? L.sync.lyrics_hash : await lyricsHash(L.groups), now = isoNow();
    const cur = (await this.currentSync(it)).sj || {};
    delete cur.pending;
    Object.assign(cur, {version: 1, times, lyrics_hash: hash, offset: Math.round((+(d.offset ?? cur.offset ?? 0) || 0) * 100) / 100});
    cur.edited = now;
    cur.matched = ok;
    if (ok.every(Boolean)) cur.method = "manual"; else if (cur.method == null || cur.method === "manual") cur.method = "auto";
    if (cur.method == null) cur.method = "manual";
    Object.assign(cur, {version: 2, synced_at: now});
    await this.savePending(it, cur, `직접 맞추기 — 찍은 묶음 ${ok.filter(Boolean).length}/${ok.length}`);
    this.synced.set(it.site + "/" + it.name, {sync: "ok", method: cur.method});  // 곡 목록 표시 (화면용 데이터는 반영 뒤 서버가 다시 씀)
    Object.assign(it, this.synced.get(it.site + "/" + it.name));
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
async function lyricsHash(groups) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(groups.map(g => g.orig).join("\n")));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function nowText() {  // '2026-11-08 15:20:03' (서버 메모 시각과 같은 모양)
  const d = new Date(), z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

