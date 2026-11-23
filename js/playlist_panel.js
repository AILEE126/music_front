/* 플레이어 왼쪽 칸 — 재생목록 (저장·되살리기 · 그리기 · 끌어 옮기기) · 오프라인 mp3 폴더 / 유튜브 재생목록 줄 · 칸 접기·펴기.
   player_screen.js 를 나눈 조각 (user request 2026-11-18) — html 의 <script> 순서대로 읽힘 (player_screen.js 머리 주석) */
/* ================= 재생목록 (user request 2026-11-14) =================
   No full song list any more: the side panel is the playlist (SHELL.queue — the order ⏭ follows, play_queue.js), filled from the
   search popup. Kept in this browser as whole items (VocaDB songs can't be looked up again without a request).
   Offline (mp3 folder): the panel lists the folder's songs as before. */
const keyOf = it => it.site + "/" + it.name;
const PL_KEY = "playlist2", PL_DB = idbKV("music-playlist");  // 재생목록은 IndexedDB 에 (수십만 곡이면 localStorage 5MB 를 넘음)
const plStrip = it => Object.fromEntries(Object.entries(plainSong(it)).filter(([k]) => !k.startsWith("_")));  // plainSong: vocadb_api.js
/* a saved / received song → the live item: our curated copy when we have that song (fresher lyrics · sync · numbers) */
function liveItem(x) {
  if (!x) return null;
  const cur = x.vocadb && VDB.itemById(x.vocadb);
  if (cur) return cur;
  const it = {...x};
  prepItem(it);
  return LOCAL.remember(it);
}
/* 요약본 (user request 2026-11-19: the playlist had to wait for every song block — 30만 곡 — before it showed or played):
   the first PL_SNAP_MAX songs kept whole as well, so the list is up and playable at once; the whole list follows from the
   blocks (restoreQueue) */
const PL_SNAP = "playlist2.snap", PL_SNAP_MAX = 2000;
const PL = {
  restored: false,  // the saved list is read only once every song block is (loadRest) — no save before, it would cut it short
  early: null,  // keys of the 요약본 songs while it stands in for the list (before restoreQueue) · savedN: the saved list's size
  savedN: 0,
  _rp: null, _rOk: null,
  whenRestored() { return this.restored ? Promise.resolve() : this._rp || (this._rp = new Promise(r => { this._rOk = r; })); },
  restoredOk() { if (this._rOk) this._rOk(); this._rp = this._rOk = null; },
  get items() { return SHELL.queue; },
  /* 우리 DB 곡은 VocaDB id 만 (숫자), 그 밖(mp3 · 예전 곡)은 곡 그대로. IndexedDB 를 못 쓰면 localStorage 에 */
  save() {
    if (!this.restored) return;  // restoreQueue saves what was added meanwhile
    const q = SHELL.queue.map(qPack);
    PL_DB("put", PL_KEY, q).then(() => store.set(PL_KEY, null), () => store.set(PL_KEY, q));
    clearTimeout(this._snapT);
    this._snapT = setTimeout(() => PL_DB("put", PL_SNAP, {n: SHELL.queue.length, items: SHELL.queue.slice(0, PL_SNAP_MAX).map(plStrip)}).catch(() => {}), 1500);
  },
  /* the 요약본 as the list until the blocks are read (only when nothing else is in the list yet) */
  async early_() {
    if (this.restored || !ONLINE || SHELL.queue.length) return;
    const s = await PL_DB("get", PL_SNAP).catch(() => null);
    if (!s || !Array.isArray(s.items) || !s.items.length || this.restored || SHELL.queue.length) return;
    const list = s.items.map(liveItem).filter(Boolean);
    this.early = new Set(list.map(keyOf)); this.savedN = s.n || list.length;
    SHELL.setQueue(list); SHELL.plan(SHELL.now);
    renderList();
  },
  // OPEN CHANNEL: the queue on screen is my frozen one (SHELL.qView) — it is planned again on leaving (ltLeave)
  set(list) { SHELL.setQueue(list); if (!(SHELL.qView && SHELL.qView())) SHELL.plan(SHELL.now); this.save(); renderList(); },
  add(list, next = false) {
    const have = new Set(SHELL.queue.map(keyOf)), add = list.filter(it => canPlay(it) && !have.has(keyOf(it)));
    if (!add.length) return 0;
    add.forEach(it => LOCAL.remember(it));
    let q = SHELL.queue.slice();
    if (next && SHELL.now) { const i = q.findIndex(x => keyOf(x) === keyOf(SHELL.now)); q.splice(i + 1, 0, ...add); } else q = q.concat(add);
    this.set(q);
    return add.length;
  },
  remove(i) { const q = SHELL.queue.slice(); q.splice(i, 1); this.set(q); },
  move(from, to) { const q = SHELL.queue.slice(), [it] = q.splice(from, 1); q.splice(to, 0, it); this.set(q); },
  async restore() {
    let q = await PL_DB("get", PL_KEY).catch(() => null);
    if (!Array.isArray(q)) q = store.get(PL_KEY, []) || [];  // not saved there yet (older version) → the localStorage copy
    return q.map(x => typeof x === "number" ? VDB.itemById(x) : liveItem(x)).filter(Boolean);
  },
};
/* queue kept over an update reload (user request 2026-11-17: 직접 넣은 곡 · 다음 곡 · 지난 곡 stay as they were) —
   sessionStorage (this tab only), read once at start (offlineOpened). Our DB songs as VocaDB id, others as the item */
const QSAVE_KEY = "player.qsave";
const qPack = it => it.vocadb && VDB.has(it.vocadb) ? +it.vocadb : plStrip(it);
const qUnpack = l => (l || []).map(x => typeof x === "number" ? VDB.itemById(x) : liveItem(x)).filter(it => it && canPlay(it));
function qSaveForReload(q) {
  try { sessionStorage.setItem(QSAVE_KEY, JSON.stringify({pinned: q.pinned.map(qPack), upcoming: q.upcoming.map(qPack), history: q.history.map(qPack), at: Date.now()})); } catch (e) {}
}
function qRestoreAfterReload(playing) {
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(QSAVE_KEY) || "null"); sessionStorage.removeItem(QSAVE_KEY); } catch (e) {}
  if (!s || Date.now() - s.at > 30 * 60 * 1000) return;
  const k = playing ? keyOf(playing) : "", pinned = qUnpack(s.pinned), upcoming = qUnpack(s.upcoming);
  // the song the page came back with was the next one: take it out once (pinned first, as next() would)
  const drop = l => { const i = l.findIndex(x => keyOf(x) === k); if (i >= 0) { l.splice(i, 1); return true; } return false; };
  if (k && !drop(pinned)) drop(upcoming);
  SHELL.pinned = pinned; SHELL.upcoming = upcoming; SHELL.history = qUnpack(s.history).slice(-10);
  SHELL.qemit();
}
/* 첫 화면 먼저 (user request 2026-11-18): the small files + the blocks of `ids` (the song shown first) → the screen opens.
   loadRest then reads the rest in the background, no progress bar; the playlist · search · channel follow when it's in */
async function loadLibrary(ids) {
  PL.restored = false;
  try { LIB = await LOCAL.library(ids); } catch (e) { $("libInfo").textContent = e.message; return false; }
  renderOnOff(); renderList();
  await PL.early_();
  if (typeof ltChPrefetch === "function") ltChPrefetch();  // OPEN CHANNEL's saved list — read now, the channel may be opened at once
  return true;
}
async function loadRest() {
  baseP = null; warmP = null;
  await VDB.loadRest();
  LIB = {items: VDB.curated, sync_ready: true};
  await restoreQueue();
  renderList();  // the song count · filter names (master) are known now
  if (typeof ltChReady === "function") ltChReady();  // 같이듣기: OPEN CHANNEL (filter.json channel)
  idle(async () => { await warmSearch(); if (typeof ltChRefresh === "function") ltChRefresh(); });
}
/* 불러오는 중 (user request 2026-11-19): only inside the playlist area — a line under the list (the screen works meanwhile) */
const loadPct = () => { const p = VDB.prog; return p && p.total ? Math.round(p.n / p.total * 100) : 0; };
const plLoadHtml = () => `<div class="plload"><span class="spin"></span><span class="t">곡 목록 불러오는 중… <b>${loadPct()}%</b></span><span class="bar"><i style="width:${loadPct()}%"></i></span></div>`;
addEventListener("vdbprog", () => {
  const l = document.querySelector("#list .plload");
  if (l) { l.querySelector("b").textContent = loadPct() + "%"; l.querySelector("i").style.width = loadPct() + "%"; }
  const d = document.querySelector("dialog.loadnote");
  if (d) { d.querySelector("b.pct").textContent = loadPct() + "%"; d.querySelector(".bar i").style.width = loadPct() + "%"; d.querySelector(".st").textContent = VDB.prog.n < VDB.prog.total ? "곡 목록 받는 중" : "곡 정리 중"; }
});
/* a play that has to wait for the loading (user request 2026-11-19: entering OPEN CHANNEL or playing right after opening) →
   '아직 첫 화면 로딩이 진행중입니다.' with the progress bar, closed when `p` is done (닫기 = just the notice; the play still goes on) */
async function loadWait(p) {
  let d = null;
  const t = setTimeout(() => {
    d = document.createElement("dialog");
    d.className = "uidlg loadnote";
    d.innerHTML = `<div class="dlg-body"><b>아직 첫 화면 로딩이 진행중입니다.</b>
      <div class="lnrow"><span class="st">${VDB.prog && VDB.prog.n >= VDB.prog.total ? "곡 정리 중" : "곡 목록 받는 중"}</span><b class="pct">${loadPct()}%</b></div>
      <span class="bar"><i style="width:${loadPct()}%"></i></span>
      <div class="note">끝나면 바로 재생합니다.</div></div>
      <div class="dlg-foot"><button type="button" class="primary">닫기</button></div>`;
    d.querySelector("button").onclick = () => d.remove();
    d.addEventListener("cancel", () => d.remove());  // Esc
    document.body.appendChild(d);
    d.showModal();
  }, 150);  // done at once (already loaded) → no notice
  try { return await p; } finally { clearTimeout(t); if (d) d.remove(); }
}
/* run when the browser has nothing else to do (no idle callback — Safari: soon after) */
const idle = fn => window.requestIdleCallback ? requestIdleCallback(() => fn(), {timeout: 3000}) : setTimeout(fn, 300);  // timeout: a busy or hidden page never gets an idle turn
/* 온라인 / 오프라인 (기본 온라인 · 기억). 온라인: 재생목록 · 오프라인: 고른 mp3 폴더의 mp3 그대로 (offline_folder.js).
   Shown as SERVER | LOCAL (user request 2026-11-22); in LOCAL the 검색 button (and the phone menu's) is 곡 추가 */
var ONLINE = store.get("online", true);
const ICO_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ICO_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
function renderSearchBtn() {
  const b = $("btnSearch"), m = document.querySelector('#mNav [data-nav="search"]'), lbl = ONLINE ? "검색" : "곡 추가";
  b.querySelector(".ico").innerHTML = ONLINE ? ICO_SEARCH : ICO_ADD;
  b.querySelector(".tl").textContent = lbl;
  b.title = ONLINE ? "곡 검색 창 열기 (전체 곡 · 노래방 곡 · 가사·싱크 있는 곡 — 우리 DB) — 찾은 곡을 바로 틀거나 재생목록에 넣음"
    : "곡 추가 창 열기 — mp3 폴더 · 유튜브 재생목록 · 추천 재생목록";
  if (m) m.innerHTML = (ONLINE ? ICO_SEARCH : ICO_ADD) + lbl;
}
renderSearchBtn();  // before the library is in
function renderOnOff() { $("btnSkip").hidden = ONLINE; $("onOff").classList.toggle("on", ONLINE); $("onOff").setAttribute("aria-pressed", ONLINE); renderOffBar(); renderSearchBtn(); }
$("onOff").addEventListener("click", async () => {
  ONLINE = !ONLINE; store.set("online", ONLINE);
  for (const d of ["searchDlg", "addDlg"]) if ($(d).open) $(d).close();  // the 검색 / 곡 추가 window of the other mode
  if (ONLINE && SHELL.queue.some(it => it.site !== "stream" || it.offyt)) { SHELL.setQueue(await PL.restore()); SHELL.plan(SHELL.now); }  // back from the mp3 folder's list
  renderOnOff(); renderList();
  if (typeof ltRender === "function") ltRender();  // 같이듣기 button / wave as before the switch
});
/* songs this player knows (our songs · searched · playlist) — listen together · report search look here */
const allItems = () => ONLINE ? [...LOCAL.items.values()] : offItems();
/* 오프라인 모드의 곡 (user request 2026-11-15): 고른 mp3 폴더 (mp3 만) 또는 유튜브 재생목록 (그 재생목록의 영상 — 소리는 인터넷으로).
   OFFSRC "dir" | "yt" (remembered) · OFFYT {url, list, title, vids}: the list's video numbers + titles, kept in this browser
   so it opens at once next time (불러오기 again to refresh) */
var OFFSRC = store.get("off.src", "dir") === "yt" ? "yt" : "dir";
/* 추천 재생목록 options (user request 2026-11-23, set in Manage › 추천 재생목록): cut = title regex — the match (group 1 if
   any) is the shown title, no match = the whole title · skipA / skipB = seconds skipped at each video's start / end */
function ytCut(title, cut) {
  if (!cut) return title;
  try { const m = String(title).match(new RegExp(cut)); return m && (m[1] ?? m[0]).trim() || title; } catch (e) { return title; }
}
/* 예외 (user request 2026-11-23): opt.ex [{n: "3, 5-7", cut, skip_a, skip_b}] — those video numbers (1 = first) use the
   row's values; an empty one keeps the default. The first row that names the number wins */
const exHas = (n, no) => String(n || "").split(",").some(p => { const [a, b = a] = p.split("-").map(x => +x.trim()); return no >= a && no <= b; });
function ytOptAt(no) {
  const o = OFFYT.opt, e = (o.ex || []).find(x => exHas(x.n, no)) || {}, pick = (k, d) => e[k] == null || e[k] === "" ? d : e[k];
  return {cut: pick("cut", o.cut), skipA: +pick("skip_a", o.skip_a) || 0, skipB: +pick("skip_b", o.skip_b) || 0};
}
const ytItem = (v, i = 0) => ytItemAt(v, ytOptAt(i + 1));
const ytItemAt = (v, o) => liveItem({site: "stream", name: "yt:" + v.id, offyt: true, title: ytCut(v.title || v.id, o.cut), artist: v.author || "",
  skipA: o.skipA, skipB: o.skipB,
  video: `https://www.youtube.com/watch?v=${v.id}`, video_link: `https://www.youtube.com/watch?v=${v.id}`, thumb: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`});
const OFFYT = (() => { const s = store.get("offyt", null) || {}; return {url: s.url || "", list: s.list || "", title: s.title || "", vids: s.vids || [], opt: s.opt || {}, items: [], busy: false}; })();
const ytOpt = r => r ? {cut: r.cut || "", skip_a: +r.skip_a || 0, skip_b: +r.skip_b || 0, ex: r.ex || []} : {};
const saveOffyt = () => store.set("offyt", {url: OFFYT.url, list: OFFYT.list, title: OFFYT.title, vids: OFFYT.vids, opt: OFFYT.opt});
var offItems = () => OFFSRC === "yt" ? OFFYT.items : OFFDIR.items;
const offReady = () => OFFSRC === "yt" ? !!OFFYT.list : !!OFFDIR.dir;
/* the playlist's video numbers: the stream bridge page asks YouTube's own player (getPlaylist — up to 200; a page opened here
   can't read youtube.com) · titles from YouTube's oEmbed (CORS ok), 6 at a time */
function ytListIds(list) {
  return new Promise((res, rej) => {
    const id = "yl" + Date.now(), f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:180px;border:0";
    f.allow = "autoplay; encrypted-media";
    const end = (fn, v) => { clearTimeout(t); removeEventListener("message", on); f.remove(); fn(v); };
    const on = e => {
      const m = e.data; if (!m || !m.bridge || m.id !== id) return;
      if (m.ev === "list") end(res, m.ids || []);
      else if (m.ev === "error") end(rej, new Error(m.code === "empty" ? "재생목록에 영상이 없거나 열 수 없는 재생목록입니다 (비공개 등)." : "유튜브 재생목록을 읽지 못했습니다."));
    };
    const t = setTimeout(() => end(rej, new Error("유튜브 재생목록을 읽지 못했습니다 (중계 페이지가 이 기능을 아직 모를 수 있음).")), 25000);
    addEventListener("message", on);
    f.src = `${BRIDGE_URL}?ytlist=${encodeURIComponent(list)}&id=${id}`;
    document.body.appendChild(f);
  });
}
const ytOembed = url => fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`).then(r => r.ok ? r.json() : null).catch(() => null);
async function loadYtList(input) {
  const m = String(input || "").match(/[?&]list=([\w-]+)/) || String(input || "").trim().match(/^((?:PL|OL|UU|FL|RD|LL)[\w-]{10,})$/);
  if (!m) return uiAlert("유튜브 재생목록 주소를 넣어 주세요 (…playlist?list=… 또는 …&list=…).");
  OFFYT.busy = true; renderOffBar();
  try {
    const list = m[1], ids = [...new Set(await ytListIds(list))];
    if (!REC.lists) await loadRec();
    const rec = REC.lists.find(r => r.list === list);
    const info = await ytOembed(`https://www.youtube.com/playlist?list=${list}`);
    const vids = ids.map(id => ({id}));
    for (let i = 0; i < vids.length; i += 6)
      await Promise.all(vids.slice(i, i + 6).map(async v => { const o = await ytOembed(`https://www.youtube.com/watch?v=${v.id}`); if (o) { v.title = o.title; v.author = o.author_name; } }));
    Object.assign(OFFYT, {url: String(input).trim(), list, title: info && info.title || "유튜브 재생목록", vids, opt: ytOpt(rec)});
    OFFYT.items = vids.map(ytItem);
    saveOffyt();
    const thumb = info && info.thumbnail_url || (vids[0] ? `https://i.ytimg.com/vi/${vids[0].id}/mqdefault.jpg` : "");
    histAdd({list, url: `https://www.youtube.com/playlist?list=${list}`, title: OFFYT.title, n: vids.length, thumb});
    // the server sees which playlists users load (Manage › 추천 재생목록, user request 2026-11-22) — never blocks playing;
    // a recommended one isn't recorded (user request 2026-11-23)
    if (!rec) LOCAL.saveUserPlaylist({list, url: `https://www.youtube.com/playlist?list=${list}`, title: OFFYT.title, n: vids.length, thumb}).catch(() => {});
  } catch (e) { uiAlert(e.message); }
  finally { OFFYT.busy = false; renderOffBar(); renderList(); }
}
function setOffSrc(src) {
  OFFSRC = src; store.set("off.src", src);
  renderOffBar(); renderList();
  if (src === "dir" && !OFFDIR.dir) connectOffDir(false);
}
async function connectOffDir(pickNew) {
  try {
    if (!pickNew && await OFFDIR.saved()) { try { await OFFDIR.reconnect(); } catch (e) { if (e.name === "AbortError") throw e; await OFFDIR.pick(); } }
    else await OFFDIR.pick();
  } catch (e) { if (e.name !== "AbortError") uiAlert(e.message); return; }
  OFFDIR.items.forEach(prepItem);
  renderOffBar(); renderList(); renderDirHist();
}
/* 이전에 연결한 mp3 폴더 (user request 2026-11-22): path (a browser gives only the folder name) · mp3 count · time,
   폴더 연결 on the right, ✕ takes it out — kept in this browser only (offline_folder.js recent) */
async function renderDirHist() {
  const L = await OFFDIR.recent();
  $("dirInfo").textContent = L.length ? `${L.length}개` : "";
  $("dirList").innerHTML = L.length ? L.map((x, i) => `<div class="dirrow${OFFDIR.dir && OFFDIR.dir.name === x.name ? " on" : ""}" data-i="${i}">`
    + `<span class="dp" title="${esc(x.path || x.name)}">📁 ${esc(x.path || x.name)}</span><span class="dm">mp3 ${x.n ?? "?"}곡 · ${esc(String(x.at || "").slice(0, 16))}</span>`
    + `<button class="primary" data-a="go">폴더 연결</button><button class="ib" data-a="del" title="기록에서 빼기">✕</button></div>`).join("")
    : '<div class="empty">아직 연결한 폴더가 없습니다.</div>';
}
$("dirList").addEventListener("click", async e => {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const i = +b.closest(".dirrow").dataset.i;
  if (b.dataset.a === "del") { await OFFDIR.forget(i); return renderDirHist(); }
  try { await OFFDIR.connectRecent(i); } catch (err) { if (err.name !== "AbortError") uiAlert(err.message); return; }
  if (OFFSRC !== "dir") { OFFSRC = "dir"; store.set("off.src", "dir"); }
  OFFDIR.items.forEach(prepItem);
  renderOffBar(); renderList(); renderDirHist();
  $("addDlg").close();
});
/* 곡 추가 창 (user request 2026-11-22): the source picks below + 추천 재생목록 — YouTube playlists registered in
   Manage › 추천 재생목록 (Server/data/rec_playlists.json {lists: [{list, url, title, thumb}]}); a card loads that playlist */
const REC = {lists: null};
async function loadRec() {
  try { const d = LOCAL.ready ? await LOCAL.readJson(`${LOCAL.data}rec_playlists.json`, null) : null; REC.lists = (d && d.lists) || []; }
  catch (e) { REC.lists = []; }
  // options changed in Manage meanwhile → the loaded recommended playlist takes them at once
  const r = OFFYT.list && REC.lists.find(x => x.list === OFFYT.list);
  if (r && JSON.stringify(ytOpt(r)) !== JSON.stringify(OFFYT.opt)) {
    OFFYT.opt = ytOpt(r); saveOffyt();
    if (OFFYT.items.length) { OFFYT.items = OFFYT.vids.map(ytItem); if (!ONLINE && OFFSRC === "yt") renderList(); }
  }
  renderRec();
}
/* 이전에 추가한 재생목록 (user request 2026-11-22): the playlists this browser loaded, newest first — browser storage only
   (store key offyt.hist, never sent anywhere); ✕ takes one out */
const HIST_MAX = 30;
const histGet = () => store.get("offyt.hist", []) || [];
function histAdd(r) {
  store.set("offyt.hist", [{...r, at: nowText()}, ...histGet().filter(x => x.list !== r.list)].slice(0, HIST_MAX));
}
const recCard = (r, i, del) => `<button type="button" class="reccard${OFFSRC === "yt" && OFFYT.list === r.list ? " on" : ""}" data-i="${i}" title="이 재생목록 불러오기">`
  + `<span class="rthumb">${r.thumb ? `<img src="${esc(r.thumb)}" loading="lazy" alt="">` : "▶"}<i>${r.n ? `영상 ${r.n}개` : "▶ 재생목록"}</i>`
  + (del ? '<b class="rdel" data-del="1" title="기록에서 빼기">✕</b>' : "") + `</span>`
  + `<span class="rt">${esc(r.title || r.list)}</span>${del && r.at ? `<span class="rat">${esc(r.at.slice(0, 16))}</span>` : ""}</button>`;
function renderRec() {
  const L = REC.lists, H = histGet();
  $("recInfo").textContent = L && L.length ? `${L.length}개` : "";
  $("recList").innerHTML = !L ? '<div class="empty">불러오는 중…</div>' : !L.length ? '<div class="empty">아직 추천 재생목록이 없습니다.</div>'
    : L.map((r, i) => recCard(r, i, false)).join("");
  $("histInfo").textContent = H.length ? `${H.length}개` : "";
  $("histList").innerHTML = H.length ? H.map((r, i) => recCard(r, i, true)).join("") : '<div class="empty">아직 불러온 재생목록이 없습니다.</div>';
}
async function recPick(e, lists) {
  const c = e.target.closest(".reccard"); if (!c) return;
  const r = lists[+c.dataset.i];
  if (e.target.closest("[data-del]")) {
    store.set("offyt.hist", histGet().filter(x => x.list !== r.list));
    return renderRec();
  }
  if (OFFSRC !== "yt") { OFFSRC = "yt"; store.set("off.src", "yt"); }
  await loadYtList(r.url || `https://www.youtube.com/playlist?list=${r.list}`);
  if (OFFYT.list === r.list) $("addDlg").close();
}
$("recList").addEventListener("click", e => recPick(e, REC.lists));
$("histList").addEventListener("click", e => recPick(e, histGet()));
function openAddSongs() {
  renderOffBar();
  $("addDlg").showModal();
  if (!REC.lists) renderRec();
  renderDirHist();
  loadRec();  // every open — a list registered meanwhile shows up
}
$("addClose").onclick = () => $("addDlg").close();
$("addDlg").addEventListener("click", e => { if (e.target === $("addDlg")) $("addDlg").close(); });  // outside the box
/* 오프라인 줄 (user request 2026-11-15): 곡 출처 [📁 mp3 폴더 | ▶ 유튜브 재생목록] + 그 출처 (폴더 이름 · 다른 폴더 / 재생목록 주소 · 불러오기) */
function renderOffBar() {
  const bar = $("offBar");
  $("addBusy").hidden = !OFFYT.busy;  // 곡 추가 window dimmed with a spinner while a playlist loads (user request 2026-11-23)
  if (ONLINE) { bar.innerHTML = ""; return; }
  if (OFFSRC === "yt" && !OFFYT.items.length && OFFYT.vids.length) OFFYT.items = OFFYT.vids.map(ytItem);
  const tab = (src, label) => `<button data-src="${src}" class="${OFFSRC === src ? "on" : ""}">${label}</button>`;
  bar.innerHTML = `<div class="offnote"><div class="row offsrc">${tab("dir", "📁 mp3 폴더")}${tab("yt", "▶ 유튜브 재생목록")}</div>`
    + (OFFSRC === "dir"
      ? (OFFDIR.dir ? `<div>📁 <b>${esc(OFFDIR.name)}</b> · mp3 ${OFFDIR.items.length}곡 (같은 이름의 json 이 있는 곡만 가사·싱크)</div>` : "")
        + `<div class="row"><button class="primary" id="offDirPick">📁 폴더 추가</button><span class="muted">고른 폴더의 mp3 전체 (하위 폴더 포함)</span></div>`
      : `<div class="row offyt"><input type="text" id="offYtUrl" placeholder="유튜브 재생목록 주소 (…list=…)" value="${esc(OFFYT.url)}" autocomplete="off" spellcheck="false">`
        + `<button class="primary" id="offYtGo"${OFFYT.busy ? " disabled" : ""}>${OFFYT.busy ? "불러오는 중…" : "불러오기"}</button></div>`
        + (OFFYT.list ? `<div>▶ <b>${esc(OFFYT.title)}</b> · 영상 ${OFFYT.items.length}개 (소리는 인터넷으로 — 가사·싱크는 없음)</div>` : ""))
    + `</div>`;
  if (REC.lists) renderRec();  // the card of the playlist now loaded
  bar.querySelectorAll("[data-src]").forEach(b => b.onclick = () => setOffSrc(b.dataset.src));
  if ($("offDirPick")) $("offDirPick").onclick = () => connectOffDir(true);
  if ($("offYtGo")) {
    $("offYtGo").onclick = () => loadYtList($("offYtUrl").value);
    $("offYtUrl").addEventListener("keydown", e => { if (e.key === "Enter") $("offYtGo").click(); });
  }
}
var BRAND_COLOR = {TJ: "rgb(0,175,236)", 금영: "rgb(130,112,219)", DAM: "rgb(230,30,40)", JOYSOUND: "rgb(225,225,232)", UGA: "rgb(225,225,232)"};
/* 같이듣기 손님: 방장의 재생목록 (user request 2026-11-14: 그대로 보이되 조작은 못 함 — listen_together.js 가 채움) · null: 내 재생목록 */
var guestPl = null;
/* 재생목록 보기 거르기 (노래방 모드 + 고른 기기 — karaoke_random.js, user request 2026-11-15): {fn} · null = 모두.
   Only the view: the playlist itself keeps every song (row index → queue index through plIdx) */
var listFilter = null;
const plIdx = i => SHELL.queue.indexOf(view[i]);
/* viewAll: the list before the 재생목록에서 찾기 box (what 같이듣기 sends to guests) · view: what the rows show */
var viewAll = [];
function renderList() {
  view = guestPl ? guestPl.slice() : ONLINE ? SHELL.queue.slice() : offItems().slice();
  if (listFilter && ONLINE && !guestPl) view = view.filter(listFilter.fn);
  viewAll = view;
  const pq = fold($("plQ").value.trim());
  if (pq) view = view.filter(it => FKIND.text[1](it, pq));  // 재생목록에서 찾기 (user request 2026-11-15)
  // label on its own line, the count (with commas) under it next to the buttons — a big count pushed them down (user request 2026-11-15)
  const lbl = guestPl ? "방장 재생목록" : ONLINE ? "재생목록" : OFFSRC === "yt" ? "영상" : "mp3", unit = !guestPl && !ONLINE && OFFSRC === "yt" ? "개" : "곡";
  // my online playlist: '<all our songs> / <in the playlist>곡' — the total and the slash plain, the playlist count stands out (user request 2026-11-15)
  const total = ONLINE && !guestPl ? vdbTotal() : 0;
  const n = PL.early && !guestPl && !pq ? Math.max(view.length, PL.savedN) : view.length;  // 요약본 up: the whole saved list's count
  // LOCAL YouTube list: its name above '영상 n개' (user request 2026-11-23)
  const plName = !guestPl && !ONLINE && OFFSRC === "yt" && OFFYT.list ? `<span class="plname" title="${esc(OFFYT.title)}">${esc(OFFYT.title)}</span>` : "";
  $("libInfo").innerHTML = `${plName}<span class="lbl">${lbl}</span><span class="cnt">${total ? `<span class="tot">${total.toLocaleString()} / </span>` : ""}<b>${n.toLocaleString()}</b>${unit}</span>`;
  renderPlFilter();
  $("btnPlClear").hidden = !ONLINE || !!guestPl;
  renderRows(true);
  if (!guestPl && typeof ltPlChanged === "function") ltPlChanged();  // 방장: 손님들에게도
}
/* 목록은 보이는 줄(과 위아래 몇 줄)만 그림. 줄 높이가 모두 같아 그린 줄을 재서 위아래 빈 칸으로 전체 높이를 맞춤 */
var ROW_H = 0, vlFrom = -1, vlTo = -1, VL_STEP = 20;
function renderRows(force) {
  const L = $("list");
  if (guestPl && !view.length) { L.innerHTML = `<div class="empty">방장의 재생목록이 비어 있습니다.</div>`; vlFrom = vlTo = -1; return; }
  if (!guestPl && !ONLINE && !offReady()) {  // offline, nothing picked yet: 곡 추가 (the picks live in its window since 2026-11-22)
    L.innerHTML = `<div class="empty">mp3 폴더나 유튜브 재생목록을 골라 주세요.<br><button class="primary" id="offConnect">곡 추가</button></div>`;
    $("offConnect").onclick = openAddSongs;
    vlFrom = vlTo = -1; return;
  }
  const loading = ONLINE && !guestPl && !PL.restored;  // the saved list isn't all here yet
  if (!view.length && loading) { L.innerHTML = plLoadHtml(); vlFrom = vlTo = -1; return; }
  if (!view.length) {
    L.innerHTML = ONLINE ? `<div class="empty">재생목록이 비어 있습니다.<br><button class="primary" id="plSearch">곡 검색</button></div>` : `<div class="empty">곡이 없습니다.</div>`;
    if ($("plSearch")) $("plSearch").onclick = openSearch;
    vlFrom = vlTo = -1; return;
  }
  const h = ROW_H || 56, n = Math.ceil((L.clientHeight || 800) / h), top = Math.min(L.scrollTop, Math.max(0, view.length * h - L.clientHeight));
  const from = Math.max(0, (Math.floor(top / h / VL_STEP) - 1) * VL_STEP), to = Math.min(view.length, from + n + 3 * VL_STEP);
  if (!force && from === vlFrom && to === vlTo) return;
  vlFrom = from; vlTo = to;
  L.innerHTML = `<div class="vpad" style="height:${from * h}px"></div>` + view.slice(from, to).map((it, k) => itemHtml(it, from + k)).join("")
    + `<div class="vpad" style="height:${(view.length - to) * h}px"></div>` + (loading ? plLoadHtml() : "");
  L.scrollTop = top;
  const real = (L.querySelector(".item") || {}).offsetHeight;
  if (real && real !== ROW_H) { ROW_H = real; renderRows(true); }
}
var rowsQueued = false;
$("list").addEventListener("scroll", () => {
  if (rowsQueued) return;
  rowsQueued = true;
  requestAnimationFrame(() => { rowsQueued = false; renderRows(false); });
});
window.addEventListener("resize", () => renderRows(true));
/* badges: our lyrics / sync state (songs of ours) · 'VocaDB' for songs found only on VocaDB */
function badgesHtml(it) {
  // two lines (user request 2026-11-18): lyrics state on top, sync state (+ %) under it
  // user request 2026-11-22, the same rule for every song: gray 가사X · 싱크X (no lyrics = both) · colored 파트분리 · the %
  // (노래방 모드: the number) · 가사다름 (stale) · 재싱크 필요 (resync) · 싱크 실패 (red); plain lyrics and 직접 싱크 show nothing
  // the state as the server sent it, the same values the filters read (song_filter.js songLy · songSyncState)
  const bs = [], ss = [], st = songSyncState(it);
  if (songLy(it) === "parts") bs.push('<span class="b src" title="보컬별로 파트가 나뉜 가사">파트분리</span>');
  else if (!songHasLyr(it)) bs.push('<span class="b" title="가사가 없음">가사X</span>');
  if (st === "stale") ss.push('<span class="b err" title="싱크를 맞춘 뒤 가사가 바뀜 — 싱크를 다시 맞춰야 함">가사다름</span>');
  else if (st === "resync") ss.push('<span class="b warn" title="바뀐 가사에 지난 싱크를 일부만 옮김 — 다시 맞춰야 함 (지난 싱크로 표시)">재싱크 필요</span>');
  else if (st === "fail") ss.push(`<span class="b err" title="자동 싱크 실패${it.sync_fail ? `: ${esc(it.sync_fail)}` : ""}">싱크 실패</span>`);  // red (user request 2026-11-22)
  else if (st === "none") ss.push('<span class="b" title="싱크가 없음">싱크X</span>');
  ss.push(pctHtml(it));
  return `<div class="bl">${bs.join("")}</div><div class="bl">${ss.join("")}</div>`;
}
function itemHtml(it, i) {
  const pl = ONLINE && !guestPl;
  const hl = SHELL.qView && SHELL.qView() ? SHELL.qView().now : cur;  // OPEN CHANNEL: the mark stays on my song from before
  return `<div class="item${hl && keyOf(hl) === keyOf(it) ? " cur" : ""}${typeof admRowCls === "function" ? admRowCls(it) : ""}" data-i="${i}"${pl ? ' draggable="true"' : ""}>
    ${coverHtml(it, "thumb")}<div class="meta"><div class="t">${titleHtml(it)}</div><div class="a">${artistVocHtml(it)}</div></div>
    <div class="badges">${badgesHtml(it)}</div></div>`;  // no ✕ — removing is in the right-click menu (user request 2026-11-18)
}
/* mp3 안의 썸네일 (오프라인 곡) · 원곡 영상의 썸네일 주소 (온라인 곡) — 못 받은 그림은 ♪ */
const coverUrl = it => it.site === "local" ? OFFDIR.coverUrl(it) : LOCAL.coverUrl(it);
const hasCover = it => it.site === "local" ? !!it.cover : !!coverUrl(it);
const coverHtml = (it, cls) => hasCover(it) ? `<img class="${cls}" data-ck="${esc(keyOf(it))}" src="${coverUrl(it)}" loading="lazy" alt="">` : `<span class="${cls}">♪</span>`;
/* 곡 상세: 제목 옆에 원제 · 제목 발음 (원제가 제목과 같으면 생략) */
const detailHtml = titleSubHtml;  // 재생 화면 제목줄: 기본 이름 옆 다른 이름들 (titleNames)
/* ◎ 재생 중인 곡으로 (곡이 넘어가도 목록은 저절로 움직이지 않음) */
$("btnFindCur").onclick = () => {
  const now = (SHELL.qView && SHELL.qView() ? SHELL.qView().now : SHELL.now) || cur; if (!now) return;  // OPEN CHANNEL: my song from before
  const i = view.findIndex(it => keyOf(it) === keyOf(now));
  if (i < 0) { uiAlert("지금 재생 중인 곡이 재생목록에 없습니다 (검색에서 바로 튼 곡)."); return; }
  const L = $("list");
  L.scrollTop = i * ROW_H - (L.clientHeight - ROW_H) / 2;
  renderRows(false);
  const el = L.querySelector(`.item[data-i="${i}"]`);
  if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
};
$("list").addEventListener("click", e => {
  const el = e.target.closest(".item"); if (!el || guestPl) return;  // 손님: 방장 재생목록은 보기만
  const i = +el.dataset.i;
  play(view[i], true, ONLINE ? "" : "pick");  // playlist song: ⏭ goes on from it
});
/* drag a playlist row to reorder (user request 2026-11-14: the playlist moved to the side panel) */
let dragFrom = -1;
$("list").addEventListener("dragstart", e => { const el = e.target.closest(".item"); if (!el || !ONLINE || guestPl) return; dragFrom = +el.dataset.i; e.dataTransfer.effectAllowed = "move"; });
$("list").addEventListener("dragover", e => { if (dragFrom >= 0) { e.preventDefault(); const el = e.target.closest(".item"); document.querySelectorAll("#list .item.dropto").forEach(x => x !== el && x.classList.remove("dropto")); if (el) el.classList.add("dropto"); } });
$("list").addEventListener("drop", e => {
  const el = e.target.closest(".item"); e.preventDefault();
  if (el && dragFrom >= 0 && +el.dataset.i !== dragFrom) PL.move(plIdx(dragFrom), plIdx(+el.dataset.i));
  dragFrom = -1;
});
$("list").addEventListener("dragend", () => { dragFrom = -1; document.querySelectorAll("#list .item.dropto").forEach(x => x.classList.remove("dropto")); });
/* 자동 싱크 인식 일치 % (직접 싱크·싱크 없음은 없음, 100% 도 표시 — user request 2026-11-18) */
var syncPct = it => it.sync === "ok" && it.method !== "manual" && it.score != null ? Math.round(it.score * 100) : null;
var pctHtml = it => {
  const p = syncPct(it);
  return p != null ? `<span class="pct ${p >= 70 ? "ok" : "warn"}" title="자동 싱크 · 인식 일치 ${p}%">${p}%</span>` : "";
};
/* 곡 우클릭: 나무위키 문서 · 가사 위키 · VocaDB · 복사 (+ 재생목록: 다음에 재생 · 빼기) */
function songContext(e, it, extra = []) {
  songMenu(e, {namu: it.namu || "", vocaro: it.wiki || "", title: it.title, orig: it.orig, reading: it.reading,
               composer: it.composer, singer: it.singer || (it.vocals || []).map(v => v[0]).join(", ")},
           [...extra, ...(it.vocadb ? [{label: "VocaDB 에서 보기", fn: () => window.open(`https://vocadb.net/S/${it.vocadb}`, "_blank", "noopener")}] : [])]);
}
$("list").addEventListener("contextmenu", e => {
  const el = e.target.closest(".item"); if (!el) return;
  const i = +el.dataset.i, it = view[i];
  // in a 같이듣기 room / OPEN CHANNEL: request the song (user request 2026-11-18 — playlist and offline rows alike)
  const req = typeof LT !== "undefined" && LT.role ? [{label: "신청곡으로 신청", fn: () => ltRequestFromMenu(it)}] : [];
  const adm = ONLINE && !guestPl && typeof admMenu === "function" ? admMenu(it) : [];  // 관리자: 선택 모드 (admin_tools.js)
  const inCh = typeof LT !== "undefined" && LT.chOn;  // OPEN CHANNEL: my queue is frozen meanwhile
  songContext(e, it, [...req, ...(ONLINE && !guestPl ? [...(inCh ? [] : [{label: "다음에 재생", fn: () => SHELL.enqueue(it)}]), {label: "이 곡 재생목록에서 빼기", fn: () => PL.remove(plIdx(i))}] : []), ...adm]);
});
{ let t = 0; $("plQ").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { $("list").scrollTop = 0; renderList(); }, 150); }); }
$("btnPlClear").onclick = async () => { if (SHELL.queue.length && await uiConfirm("재생목록을 비울까요?")) { setPlFilter(null); PL.set([]); } };

/* ================= 재생목록 칸 접기 / 펴기 (상태 기억) ================= */
function setListOpen(open) {
  document.querySelector(".app").classList.toggle("nolist", !open);
  $("btnList").classList.toggle("on", !open);
  $("btnList").title = open ? "재생목록 접기" : "재생목록 펴기";
  store.set("listOpen", open);
}
setListOpen(store.get("listOpen", true));
/* List tab (user request 2026-11-15, web): like the video tab — a short click folds/unfolds the list, a sideways drag
   (list shown) sets its width. 340px is the smallest; CSS keeps it at most 70% of the window (--side-w, remembered). */
{
  const SIDE_MIN = 340;
  const setW = w => document.documentElement.style.setProperty("--side-w", Math.max(SIDE_MIN, Math.round(w)) + "px");
  const saved = store.get("sideW", null);
  if (saved) setW(saved);
  const tab = $("btnList"), side = document.querySelector(".side");
  let drag = null, dragged = false;
  tab.addEventListener("pointerdown", e => {
    dragged = false;
    if (e.button !== 0 || document.body.classList.contains("m")) return;
    // 화면 축소(--ui-zoom): mouse moves in window px, the width is in the shrunk document's px → divide by the ratio
    const f = uiZoom();
    drag = {x: e.clientX, w: side.getBoundingClientRect().width / f, f, moved: false};
    tab.setPointerCapture(e.pointerId);
  });
  tab.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 4) return;  // under 4px = a click
    if (document.querySelector(".app").classList.contains("nolist")) return;  // nothing to resize while folded
    drag.moved = true; tab.classList.add("drag");
    const maxW = document.querySelector(".app").getBoundingClientRect().width / drag.f * .7;
    drag.wNew = Math.min(maxW, Math.max(SIDE_MIN, drag.w + (e.clientX - drag.x) / drag.f));
    setW(drag.wNew);
    dispatchEvent(new Event("resize"));  // list rows · the bridge player over the video follow at once
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null; tab.classList.remove("drag");
    if (d.moved) { dragged = true; if (d.wNew) store.set("sideW", Math.round(d.wNew)); }
  };
  tab.addEventListener("pointerup", end);
  tab.addEventListener("pointercancel", end);
  tab.onclick = () => {
    if (dragged) { dragged = false; return; }  // the click that ends a drag
    setListOpen(document.querySelector(".app").classList.contains("nolist"));
  };
}
