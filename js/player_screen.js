/* player_screen.html 화면 동작 — 서버 없이 html 을 바로 열어 씀 (서버·음원 관리와 따로)
   곡 검색은 VocaDB API (vocadb_api.js) · 우리 곡(노래방·가사·싱크)·한글 이름은 깃허브(토큰) 또는 고른 Server\data 폴더(서버 PC)에서
   읽음 (local_files.js) · 왼쪽 칸은 재생목록 · 오프라인 mp3 는 고른 mp3 폴더 (offline_folder.js)
   싱크 밀기·직접 맞추기·오류 신고는 그곳에 바로 저장. 싱크 만들기·가사 받기 등은 서버 PC 의 음원 관리에서 */
const SHELL = makePlayer($("audioLocal"));  // 재생기 (play_engine.js)
const audio = SHELL.audio;
const cleanups = [];
function on(target, ev, fn) { target.addEventListener(ev, fn); cleanups.push(() => target.removeEventListener(ev, fn)); }
window.addEventListener("pagehide", () => cleanups.forEach(f => f()));  // 화면을 떠나면 바깥 재생기에 건 연결 해제

let LIB = {items: [], sites: {}}, view = [], cur = null, song = null;
let editShift = 0;  // +/− pushed while editing (shown next to the buttons)
let times = null, offset = 0, curIdx = -1, editing = false, editTimes = null, editOk = null, cursor = 0;
let userScrollAt = 0;

/* ================= 재생목록 (user request 2026-11-14) =================
   No full song list any more: the side panel is the playlist (SHELL.queue — the order ⏭ follows, play_queue.js), filled from the
   search popup. Kept in this browser as whole items (VocaDB songs can't be looked up again without a request).
   Offline (mp3 folder): the panel lists the folder's songs as before. */
const keyOf = it => it.site + "/" + it.name;
const PL_KEY = "playlist2", PL_DB = idbKV("music-playlist");  // 재생목록은 IndexedDB 에 (수십만 곡이면 localStorage 5MB 를 넘음)
const plStrip = it => Object.fromEntries(Object.entries(it).filter(([k]) => !k.startsWith("_")));
/* a saved / received song → the live item: our curated copy when we have that song (fresher lyrics · sync · numbers) */
function liveItem(x) {
  if (!x) return null;
  const cur = x.vocadb && VDB.itemById(x.vocadb);
  if (cur) return cur;
  const it = {...x};
  prepItem(it);
  return LOCAL.remember(it);
}
const PL = {
  get items() { return SHELL.queue; },
  /* 우리 DB 곡은 VocaDB id 만 (숫자), 그 밖(mp3 · 예전 곡)은 곡 그대로. IndexedDB 를 못 쓰면 localStorage 에 */
  save() {
    const q = SHELL.queue.map(it => it.vocadb && VDB.rowById.has(String(it.vocadb)) ? +it.vocadb : plStrip(it));
    PL_DB("put", PL_KEY, q).then(() => store.set(PL_KEY, null), () => store.set(PL_KEY, q));
  },
  set(list) { SHELL.setQueue(list); SHELL.plan(SHELL.now); this.save(); renderList(); },
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
async function loadLibrary() {
  // the load bar (GitHub download progress) must close even when this is not the first open
  try { LIB = await api("/api/library"); } catch (e) { $("libInfo").textContent = e.message; return; } finally { hideLoad(); }
  renderOnOff();
  if (SHELL) await restoreQueue();
  renderList();
}
/* 온라인 / 오프라인 (기본 온라인 · 기억). 온라인: 재생목록 · 오프라인: 고른 mp3 폴더의 mp3 그대로 (offline_folder.js) */
var ONLINE = store.get("online", true);
function renderOnOff() { $("onOff").classList.toggle("on", ONLINE); $("onOff").setAttribute("aria-pressed", ONLINE); renderOffBar(); }
$("onOff").addEventListener("click", async () => {
  ONLINE = !ONLINE; store.set("online", ONLINE);
  if (ONLINE && SHELL.queue.some(it => it.site !== "stream")) { SHELL.setQueue(await PL.restore()); SHELL.plan(SHELL.now); }  // back from the mp3 folder's list
  renderOnOff(); renderList();
});
/* songs this player knows (our songs · searched · playlist) — listen together · report search look here */
const allItems = () => ONLINE ? [...LOCAL.items.values()] : OFFDIR.items;
async function connectOffDir(pickNew) {
  try {
    if (!pickNew && await OFFDIR.saved()) { try { await OFFDIR.reconnect(); } catch (e) { if (e.name === "AbortError") throw e; await OFFDIR.pick(); } }
    else await OFFDIR.pick();
  } catch (e) { if (e.name !== "AbortError") uiAlert(e.message); return; }
  OFFDIR.items.forEach(prepItem);
  renderOffBar(); renderList();
}
/* 오프라인 폴더 줄: 연결된 폴더 이름 + 다른 폴더 고르기. not connected → the list shows only "폴더를 연결해 주세요" (renderRows) */
function renderOffBar() {
  const bar = $("offBar");
  if (ONLINE || !OFFDIR.dir) { bar.innerHTML = ""; return; }
  bar.innerHTML = `<div class="offnote">📁 <b>${esc(OFFDIR.name)}</b> · mp3 ${OFFDIR.items.length}곡 (같은 이름의 json 이 있는 곡만 가사·싱크)
    <div class="row"><button id="offDirPick">다른 폴더 고르기</button></div></div>`;
  $("offDirPick").onclick = () => connectOffDir(true);
}
var BRAND_COLOR = {TJ: "rgb(0,175,236)", 금영: "rgb(130,112,219)", DAM: "rgb(230,30,40)", JOYSOUND: "rgb(225,225,232)", UGA: "rgb(225,225,232)"};
/* 같이듣기 손님: 방장의 재생목록 (user request 2026-11-14: 그대로 보이되 조작은 못 함 — listen_together.js 가 채움) · null: 내 재생목록 */
var guestPl = null;
function renderList() {
  view = guestPl ? guestPl.slice() : ONLINE ? SHELL.queue.slice() : OFFDIR.items.slice();
  $("libInfo").innerHTML = guestPl ? `방장 재생목록 <b>${view.length}</b>곡` : ONLINE ? `재생목록 <b>${view.length}</b>곡` : `mp3 <b>${view.length}</b>곡`;
  $("btnPlClear").hidden = !ONLINE || !!guestPl;
  renderRows(true);
  if (!guestPl && typeof ltPlChanged === "function") ltPlChanged();  // 방장: 손님들에게도
}
/* 목록은 보이는 줄(과 위아래 몇 줄)만 그림. 줄 높이가 모두 같아 그린 줄을 재서 위아래 빈 칸으로 전체 높이를 맞춤 */
var ROW_H = 0, vlFrom = -1, vlTo = -1, VL_STEP = 20;
function renderRows(force) {
  const L = $("list");
  if (guestPl && !view.length) { L.innerHTML = `<div class="empty">방장의 재생목록이 비어 있습니다.</div>`; vlFrom = vlTo = -1; return; }
  if (!guestPl && !ONLINE && !OFFDIR.dir) {  // offline, no mp3 folder yet → one button only (user request)
    L.innerHTML = `<div class="empty"><button class="primary" id="offConnect">폴더를 연결해 주세요</button></div>`;
    $("offConnect").onclick = () => connectOffDir(false);
    vlFrom = vlTo = -1; return;
  }
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
    + `<div class="vpad" style="height:${(view.length - to) * h}px"></div>`;
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
  const bs = [];
  if (it.site === "stream" && it.api) bs.push('<span class="b src" title="VocaDB 에서 찾은 곡 — 가사는 VocaDB 가사 (있으면)">VocaDB</span>');
  else if (it.lyrics === "vocaro" && it.karaoke) bs.push('<span class="b src" title="나무위키에 가사가 없어 보카로 가사 위키(VL)에서 받은 가사">VL가사</span>');
  else if (it.lyrics === "own" && it.site !== "local") bs.push('<span class="b src" title="직접 넣은 가사">직접 가사</span>');
  else if (!it.lyrics && it.site === "local") bs.push('<span class="b warn" title="같은 이름의 가사·싱크 json 이 없음">가사X</span>');
  if (it.sync === "ok" && it.method === "manual") bs.push('<span class="b ok">직접 싱크</span>');
  else if (it.sync_fail) bs.push(`<span class="b err" title="자동 싱크 실패: ${esc(it.sync_fail)}">싱크 실패</span>`);
  if (it.deleted) bs.unshift('<span class="b err" title="원곡 영상이 삭제되어 재생할 수 없음">삭제됨</span>');
  return bs.join("");
}
function itemHtml(it, i) {
  const pl = ONLINE && !guestPl;
  return `<div class="item${cur && keyOf(cur) === keyOf(it) ? " cur" : ""}${it.deleted ? " gone" : ""}" data-i="${i}"${pl ? ' draggable="true"' : ""}${it.deleted ? ' aria-disabled="true"' : ""}>
    ${coverHtml(it, "thumb")}<div class="meta"><div class="t">${esc(it.title)}</div><div class="a">${esc(shortName(it.artist || it.name))}</div></div>
    <div class="badges">${badgesHtml(it)}</div>${pctHtml(it)}${pl ? '<button class="plx" title="재생목록에서 빼기">✕</button>' : ""}</div>`;
}
/* mp3 안의 썸네일 (오프라인 곡) · 원곡 영상의 썸네일 주소 (온라인 곡) — 못 받은 그림은 ♪ */
const coverUrl = it => it.site === "local" ? OFFDIR.coverUrl(it) : LOCAL.coverUrl(it);
const hasCover = it => it.site === "local" ? !!it.cover : !!coverUrl(it);
const coverHtml = (it, cls) => hasCover(it) ? `<img class="${cls}" data-ck="${esc(keyOf(it))}" src="${coverUrl(it)}" loading="lazy" alt="">` : `<span class="${cls}">♪</span>`;
/* 곡 상세: 제목 옆에 원제 · 제목 발음 (원제가 제목과 같으면 생략) */
function detailHtml(it) {
  const parts = [];
  if (it.orig && it.orig !== it.title) parts.push(`<span title="원제">${esc(it.orig)}</span>`);
  if (it.reading) parts.push(`<span title="제목 발음">${esc(it.reading)}</span>`);
  return parts.join("");
}
/* ◎ 재생 중인 곡으로 (곡이 넘어가도 목록은 저절로 움직이지 않음) */
$("btnFindCur").onclick = () => {
  const now = SHELL.now || cur; if (!now) return;
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
  if (e.target.closest(".plx")) return PL.remove(i);
  if (el.classList.contains("gone")) return;  // deleted song: can't be picked
  play(view[i], true, ONLINE ? "" : "pick");  // playlist song: ⏭ goes on from it
});
/* drag a playlist row to reorder (user request 2026-11-14: the playlist moved to the side panel) */
let dragFrom = -1;
$("list").addEventListener("dragstart", e => { const el = e.target.closest(".item"); if (!el || !ONLINE || guestPl) return; dragFrom = +el.dataset.i; e.dataTransfer.effectAllowed = "move"; });
$("list").addEventListener("dragover", e => { if (dragFrom >= 0) { e.preventDefault(); const el = e.target.closest(".item"); document.querySelectorAll("#list .item.dropto").forEach(x => x !== el && x.classList.remove("dropto")); if (el) el.classList.add("dropto"); } });
$("list").addEventListener("drop", e => {
  const el = e.target.closest(".item"); e.preventDefault();
  if (el && dragFrom >= 0 && +el.dataset.i !== dragFrom) PL.move(dragFrom, +el.dataset.i);
  dragFrom = -1;
});
$("list").addEventListener("dragend", () => { dragFrom = -1; document.querySelectorAll("#list .item.dropto").forEach(x => x.classList.remove("dropto")); });
/* 자동 싱크 인식 일치 % (직접 싱크·싱크 없음은 없음, 100 이면 생략) */
var syncPct = it => it.sync === "ok" && it.method !== "manual" && it.score != null ? Math.round(it.score * 100) : null;
var pctHtml = it => {
  const p = syncPct(it);
  return p != null && p < 100 ? `<span class="pct ${p >= 70 ? "ok" : "warn"}" title="자동 싱크 · 인식 일치 ${p}%">${p}%</span>` : "";
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
  songContext(e, it, ONLINE && !guestPl ? [{label: "다음에 재생", fn: () => SHELL.enqueue(it)}, {label: "재생목록에서 빼기", fn: () => PL.remove(i)}] : []);
});
$("btnPlClear").onclick = async () => { if (SHELL.queue.length && await uiConfirm("재생목록을 비울까요?")) PL.set([]); };

/* ================= 곡 검색 창 (user request 2026-11-14) =================
   our DB only (export/db — the tables on GitHub; user request 2026-11-14: no VocaDB API, so every match can be played):
   전체 곡 (every collected song) · 노래방 곡만 · 가사·싱크 있는 곡. Results: ▶ play now · ＋ playlist · ⤵ next · 결과 모두 = every match */
const S = {items: [], q: ""};
const S_SCOPES = ["all", "kara", "ours"];
if (!S_SCOPES.includes(store.get("sScope", "all"))) store.set("sScope", "all");  // was 'vocadb' (VocaDB 전체)
for (const id of ["sScope", "sSort"]) { $(id).value = store.get(id, $(id).value); $(id).onchange = () => { store.set(id, $(id).value); if (id === "sScope") { renderSortOptions(); renderFilterOptions(); } runSearch(); }; }
function openSearch() {
  sfDefaultGroup();  // a group is always there to put conditions in (user request 2026-11-14)
  renderSortOptions(); renderFilterOptions();
  $("searchDlg").showModal();
  $("sQ").focus(); $("sQ").select();
  if (!S.items.length) runSearch();
}
$("btnSearch").onclick = openSearch;
$("sClose").onclick = () => $("searchDlg").close();
$("searchDlg").addEventListener("click", e => { if (e.target === $("searchDlg")) $("searchDlg").close(); });  // outside the box
$("sGo").onclick = () => runSearch();
let sTimer = 0;
$("sQ").addEventListener("input", () => { clearTimeout(sTimer); sTimer = setTimeout(runSearch, 200); });  // as you type (local, no request)
/* small song finder for the report dialog and the listen-together request box: the songs given (already known) first,
   then matches from our whole DB — no duplicates */
async function findSongs(q, known = [], max = 40) {
  const v = fold(q), seen = new Set(), out = [];
  const db = v ? VDB.all().filter(it => FKIND.text[1](it, v)).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, max) : [];
  for (const it of [...known, ...db]) if (!seen.has(keyOf(it))) { seen.add(keyOf(it)); out.push(it); }
  return out.slice(0, max);
}
/* the scope's songs: 전체 곡 = our whole DB · 노래방 곡만 · 가사·싱크 있는 곡 = our songs */
const scopeItems = () => { const sc = $("sScope").value; return sc === "kara" ? VDB.curated.filter(it => it.karaoke) : sc === "ours" ? VDB.curated.filter(it => !!(it.lyrics || it.sync)) : VDB.all(); };
/* keep: stay where the list is (user request 2026-11-14: a song action — e.g. '현재 필터에 추가' — never jumps to the top) */
function runSearch(keep) {
  const scope = $("sScope").value, q = $("sQ").value.trim(), v = fold(q);
  S.q = q;
  if (!keep) $("sList").scrollTop = 0;
  S.items = ourSort(scopeItems().filter(it => passChips(it) && (!v || FKIND.text[1](it, v))));
  renderSearch(`${{kara: "노래방 곡", ours: "가사·싱크 있는 곡"}[scope] || "전체 곡"} ${S.items.length.toLocaleString()}곡${q ? ` — "${q}"` : ""}${FG.some(g => g.c.length) ? " · 필터 적용" : ""}`);
}
function renderSearch(info) {
  const st = $("sList").scrollTop;  // runSearch already put it at 0 when it should go to the top
  $("sInfo").textContent = info;
  $("sMakePl").disabled = !S.items.some(canPlay);
  const inPl = new Set(SHELL.queue.map(keyOf)), show = S.items.slice(0, 300), inF = new Set(fSongIds());
  $("sList").innerHTML = show.map((it, i) => {
    const nums = Object.entries(it.nums || {}).map(([b, n]) => `<span class="b kara" style="--bc:${BRAND_COLOR[b] || "#888"}" title="${esc(b)}">${esc(b)} ${esc(n)}</span>`).join("");
    const own = it.api ? "" : `<span class="b src" title="우리 데이터가 있는 곡">${it.sync === "ok" ? "싱크" : it.lyrics ? "가사" : "노래방"}</span>`;
    return `<div class="sitem${canPlay(it) ? "" : " gone"}" data-i="${i}">${coverHtml(it, "thumb")}
      <div class="meta"><div class="t">${esc(it.title)}${it.orig && it.orig !== it.title ? ` <span class="o">${esc(it.orig)}</span>` : ""}</div>
        <div class="a">${esc(shortName(it.artist || ""))}</div>
        <div class="tags">${own}${it.type ? `<span class="b">${esc(VDB_TYPE_KO[it.type] || it.type)}</span>` : ""}${it.date ? `<span class="d">${esc(it.date)}</span>` : ""}${nums}</div></div>
      <div class="sacts">${canPlay(it) ? `<button data-a="play" title="지금 재생">▶</button><button data-a="next" title="다음에 재생 — 재생 대기열(직접 넣은 곡)에 넣음: 무작위 재생이어도 지금 곡 다음에">⤵</button>`
        + `<button data-a="add" title="재생목록 끝에"${inPl.has(keyOf(it)) ? " disabled" : ""}>${inPl.has(keyOf(it)) ? "✓" : "＋"}</button>` : '<span class="hint">영상 없음</span>'}`
        + `<button data-a="filt" class="sfilt${inF.has(songId(it)) ? " on" : ""}" title="${inF.has(songId(it)) ? "필터에 넣은 곡 — 누르면 뺌" : "현재 필터에 추가 — 지금 결과는 그대로 두고 이 곡도 결과에 더함 (곡만 모은 필터 그룹)"}">${FILT_SVG}</button></div></div>`;
  }).join("") + (S.items.length > show.length ? `<div class="hint">… ${(S.items.length - show.length).toLocaleString()}곡 더 ('상위 … 곡 재생목록 만들기' 는 이 곡들까지 셈)</div>` : "")
    || `<div class="empty">맞는 곡이 없습니다.</div>`;
  $("sList").scrollTop = st;
}

/* ================= 필터 (판정·카테고리는 song_filter.js — 음원 관리와 같이 씀) — 곡 검색 창 안 (user request 2026-11-14) ================= */
/* 고를 값의 곡: 그 범위의 곡 (곡 수도 그 범위 기준) */
const sfItems = scopeItems;
/* 필터 그룹 [{x: 제외 그룹, m: '＋ 그룹'·'− 제외' 버튼으로 만든 그룹, c: [{k: 종류, v: 값}]}] — 그룹 안 조건은 모두 맞아야(교집합),
   포함 그룹끼리는 하나라도 맞으면 보임(합집합), 제외 그룹의 조건에 모두 맞는 곡은 빠짐. fCur: 새 조건이 들어갈 그룹.
   버튼으로 그룹을 만들지 않았으면(m 없음) 조건을 고를 때마다 그 조건 하나만으로 거름 (앞 조건은 바뀜).
   예전 태그(f.chips: 태그마다 포함·제외)는 태그 하나짜리 그룹으로 옮김 · m 이 생기기 전에 저장한 조건 여럿짜리 그룹은 직접 만든 것으로 봄 */
/* 곡 종류는 그룹마다 꼭 하나 (user request 2026-11-14) — 없으면 오리지널로 넣음 · 지울 수 없고, 카테고리 '곡 종류'에서 고르면 값만 바뀜 */
const F_TYPE_DEF = "오리지널";
const withType = g => g.c.some(c => c.k === "type") ? g : {...g, c: [{k: "type", v: F_TYPE_DEF}, ...g.c]};
/* 곡 종류만 든 그룹은 첫 그룹이 아니면 아직 빈 그룹 — 다른 조건을 고를 때까지 거르지 않음 ('＋ 그룹'만 눌러도 결과가 늘지 않게) */
const fReal = (g, i) => i === 0 || g.c.some(c => c.k !== "type");
let FG = (store.get("f.groups", null) || store.get("f.chips", []).map(c => ({x: !!c.x, c: [{k: c.k, v: c.v}]})))
  .map(g => "m" in g ? g : {...g, m: g.c.length > 1}).map(withType);
let fCur = Math.min(store.get("f.cur", 0), FG.length - 1);
const passChips = it => passGroups(it, FG.filter(fReal));
function saveChips(keepScroll) { sfDefaultGroup(); store.set("f.groups", FG); store.set("f.cur", fCur); renderFilterOptions(); runSearch(keepScroll); }
function addChip(k, v) {  // v: 값 하나 또는 [값, …] (그중 하나라도)
  if (!v || (Array.isArray(v) && !v.length)) return;
  if (Array.isArray(v) && v.length === 1) v = v[0];
  if (!FG[fCur] || !FG[fCur].m) {  // 직접 만든 그룹이 선택돼 있지 않음 → 이 조건 하나만 (버튼 없이 고른 앞 조건은 지움)
    FG = FG.filter(g => g.m);
    FG.push(withType({x: false, m: false, c: [{k, v}]})); fCur = FG.length - 1;
    return saveChips();
  }
  const g = FG[fCur], t = g.c.find(c => c.k === "type");
  if (k === "type" && t) { t.v = v; return saveChips(); }  // 곡 종류는 하나뿐 — 값만 바꿈
  if (!g.c.some(c => c.k === k && JSON.stringify(c.v) === JSON.stringify(v))) g.c.push({k, v});
  saveChips();
}
/* 곡 조건 (user request 2026-11-14: 검색 결과의 '현재 필터에 추가'): 지금 결과에 이 곡'도' 더함 — 곡만 모은 포함 그룹 하나
   (곡 종류 + 곡 조건, 그룹끼리는 또는)에 VocaDB 번호를 모음. 선택된 그룹에 넣으면 결과가 그 곡으로 좁혀져 목록이 줄어들기 때문
   (user report: 누르니 목록이 맨 위로). 그 곡의 종류가 그룹의 곡 종류에 없으면 더함. 이미 든 곡은 다시 누르면 뺌 (다 빠지면 그룹도) */
function songGroup() { return FG.find(g => !g.x && g.c.some(c => c.k === "song") && g.c.every(c => c.k === "song" || c.k === "type")); }
function songId(it) { return String(it.vocadb || it.name); }
var FILT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 5h12l-5 6v5l-3 2v-7z"/><path d="M18 12v8M14 16h8"/></svg>';
function fSongIds() { const g = songGroup(), c = g && g.c.find(c => c.k === "song"); return c ? [].concat(c.v) : []; }
function toggleSongCond(it) {
  sfDefaultGroup();
  const id = songId(it), ty = VDB_TYPE_KO[it.type] || it.type;
  let g = songGroup();
  if (!g) { g = {x: false, m: true, c: [{k: "type", v: ty || F_TYPE_DEF}]}; FG.push(g); }
  FG.forEach(x => { x.m = true; });  // 버튼 없이 고른 조건도 그룹으로 남김 (다음 조건을 골라도 지워지지 않게)
  let c = g.c.find(c => c.k === "song");
  if (c && [].concat(c.v).includes(id)) {
    c.v = [].concat(c.v).filter(x => x !== id);
    if (!c.v.length) { FG.splice(FG.indexOf(g), 1); fCur = Math.min(fCur, FG.length - 1); }
  } else {
    if (!c) g.c.push(c = {k: "song", v: []});
    c.v = [...[].concat(c.v), id];
    const t = g.c.find(c => c.k === "type");
    if (t && ty && ![].concat(t.v).includes(ty)) t.v = [...[].concat(t.v), ty];
  }
  saveChips(true);  // a song action: the result list stays where it is
}
/* 그룹 안 조건 고치기 (user request 2026-11-14): 조건을 누르면 그 카테고리의 값 목록이 지금 값이 체크된 채로 열리고, '바꾸기'로 그 조건만 바뀜.
   fEdit {g, c}: 고치는 중인 조건 (목록이 닫히면 끝) */
var fEdit = null;
function editCond() { return fEdit && FG[fEdit.g] && FG[fEdit.g].c[fEdit.c] || null; }
function condCat(c) { return c.k === "solo" ? "singer" : c.k === "tag" ? "tag:" + tagGroupOf(firstV(c)) : c.k; }
function editChip(gi, ci) {
  const c = FG[gi] && FG[gi].c[ci]; if (!c) return;
  fCur = gi; fEdit = {g: gi, c: ci};
  if ($("fPanel").hidden) { $("fPanel").hidden = false; store.set("sfOpen", true); }
  $("fSolo").checked = c.k === "solo";
  store.set("f.kind", condCat(c)); store.set("f.cur", fCur);
  renderFilterOptions();
  openDD("fVal", [].concat(c.v));
}
function applyEdit(e, vs) {
  const g = e && FG[e.g], c = g && g.c[e.c];
  if (c) {
    vs = vs.filter(Boolean);
    if (!vs.length) { if (c.k !== "type") g.c.splice(e.c, 1); }  // 다 풀면 조건을 뺌 (곡 종류는 꼭 하나라 그대로)
    else {
      c.v = vs.length === 1 && c.k !== "song" ? vs[0] : vs;
      if (c.k === "singer" || c.k === "solo") c.k = $("fSolo").checked ? "solo" : "singer";
    }
  }
  saveChips();
}

function renderFilterOptions() {
  const its = sfItems(), opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
  const fill = (id, head, rows, label = k => k, show = rows.length) => {
    $(id).innerHTML = opt("", head) + rows.map(([k, n]) => opt(k, n === "" ? label(k) : `${label(k)} (${n})`)).join("");
    $(id).hidden = !show;
  };
  const cats = sfCats(its), ec = editCond();
  if (ec && ec.k === "song") cats.unshift({id: "song", label: "곡", k: "song", rows: [].concat(ec.v).map(v => [v, ""]), lab: songTitleOf});  // 넣은 곡만 (빼기용)
  FCATS = cats;
  const want = store.get("f.kind", "singer"), c = cats.find(x => x.id === want) || cats[0];
  if (ec && c && c.id === condCat(ec)) {  // 고치는 조건의 값이 이 범위 곡에 없어도 목록에 (안 그러면 '바꾸기'에서 빠짐)
    const have = new Set(c.rows.map(r => r[0]));
    c.rows = [...c.rows, ...[].concat(ec.v).filter(v => !have.has(v)).map(v => [v, 0])];
  }
  $("fKind").innerHTML = cats.map(x => opt(x.id, `${catIconOf(x)} ${x.rows.length ? `${x.label} (${x.rows.length})` : x.label}`)).join("");
  $("fKind").value = c ? c.id : "";
  $("fKind").hidden = !cats.length;
  fill("fVal", c ? c.label : "값", c ? c.rows : [], c ? c.lab : undefined, !!c);
  $("fSolo").disabled = !c || c.k !== "singer";
  $("fSolo").parentNode.classList.toggle("off", $("fSolo").disabled);
  syncDD();
  // 그룹 = 한 줄 상자 (왼쪽 동그라미 ＋ 포함 / − 제외). 포함 상자 사이에만 작은 '또는' 줄, 제외 상자는 맨 아래
  const box = i => {
    const g = FG[i], cs = g.c.filter(c => FKIND[c.k]), ed = fEdit && fEdit.g === i ? fEdit.c : -1;
    return `<div class="fgroup${g.x ? " exc" : ""}${i === fCur ? " cur" : ""}" data-g="${i}" title="${i === fCur ? "새 조건이 이 그룹에 들어감" : "누르면 이 그룹 선택"}">`
      + `<button class="gh" title="${g.x ? "제외 그룹 — 누르면 포함으로" : "포함 그룹 — 누르면 제외로"}">${g.x ? "−" : "＋"}</button>`
      + cs.map(c => { const j = g.c.indexOf(c), on = j === ed ? " edit" : "";
        // 곡 종류: 그룹마다 꼭 하나 — 지우기 없이 고르는 칸 모양 (▾) · 다른 조건: 누르면 고치기, × 빼기
        return c.k === "type"
          ? `<span class="fchip req${on}" data-c="${j}" title="곡 종류 — 그룹마다 꼭 하나 · 누르면 바꾸기"><span class="k">${esc(chipKind(c))}</span><span class="v">${esc(chipLabel(c))}</span>${DD_CHEV}</span>`
          : `<span class="fchip${on}" data-c="${j}" title="누르면 이 조건 고치기"><span class="k">${esc(chipKind(c))}</span><span class="v">${esc(chipLabel(c))}</span><button title="빼기">×</button></span>`; }).join("")
      + (fReal(g, i) ? "" : '<span class="empty">조건을 고르세요</span>')
      + `<button class="gx" title="그룹 지우기">✕</button></div>`;
  };
  const idx = FG.map((g, i) => i), inc = idx.filter(i => !FG[i].x), exc = idx.filter(i => FG[i].x);
  $("fChips").innerHTML = inc.map(box).join('<div class="fsep">또는</div>') + exc.map(box).join("");
  const n = FG.reduce((a, g) => a + g.c.length, 0), open = !$("fPanel").hidden;
  $("btnFilter").classList.toggle("on", !!n);
  $("btnFilter").classList.toggle("open", open);
  $("btnFilter").querySelector(".cnt").textContent = n || "";
}
function setFilterOpen(open) {
  if (!open) {  // 접을 때: 아직 빈 그룹(곡 종류만 든 그룹 — 첫 그룹 말고)은 지움 (곡 거르기에는 원래 영향 없음)
    closeDD();
    const keep = FG[fCur];
    FG = FG.filter(fReal);
    fCur = Math.max(0, FG.includes(keep) ? FG.indexOf(keep) : FG.length - 1);
    store.set("f.groups", FG); store.set("f.cur", fCur);
  }
  else sfDefaultGroup();
  $("fPanel").hidden = !open; store.set("sfOpen", open); renderFilterOptions();
}
/* open panel with no group yet → one empty include group, ready for the first condition (user request 2026-11-14) */
function sfDefaultGroup() { if (!FG.length) { FG = [{x: false, m: true, c: [{k: "type", v: F_TYPE_DEF}]}]; fCur = 0; } }  // 첫 그룹: 곡 종류 오리지널
/* 필터 목록 칸 펼치기: 맨 위 검색창 + 항목 (optgroup 은 작은 제목). 글자를 치면 그 글자가 든 항목만, Enter 는 위에서 첫 항목,
   ↑↓ 로 고르기, Esc·바깥 누르기로 닫힘. 항목을 누르면 원래 select 의 change 로 조건을 더함 */
var DD_IDS = ["fKind", "fVal"];
var DD_SHOW = new Set(["fKind"]);  // 이 칸은 단추에 고른 항목을 보임 (다른 칸은 고르면 조건이 되고 단추는 제목 그대로)
var FCATS;  // (값을 넣지 않음: 이 줄보다 먼저 목록을 그렸으면 그 값 유지) 지금 목록의 필터 카테고리 [{id, label, k: 조건 종류, rows: [[값, 곡 수]], lab: 값 표시}]
var DD_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
var ddOpen = null, ddHl = 0, ddSel = new Set();  // ddSel: 소분류에서 체크한 값 · var: 목록을 처음 그릴 때(이 줄보다 먼저 실행될 수 있음)도 쓸 수 있게
for (const id of DD_IDS) {
  const sel = $(id), w = document.createElement("div");
  w.className = "fdd"; w.dataset.for = id; w.title = sel.title;
  w.innerHTML = `<button class="fdd-btn" type="button"><span></span>${DD_CHEV}</button>`;
  sel.after(w); sel.classList.add("fdd-src");
  w.firstChild.onclick = e => { e.stopPropagation(); if (ddOpen === id) closeDD(); else openDD(id); };
}
function syncDD() {
  for (const id of DD_IDS) {
    const w = document.querySelector(`.fdd[data-for="${id}"]`); if (!w) continue;
    w.hidden = $(id).hidden;
    const o = DD_SHOW.has(id) ? $(id).selectedOptions[0] : $(id).options[0];
    w.querySelector(".fdd-btn span").textContent = o ? o.text : "";
  }
  if (ddOpen) renderDD();
}
function openDD(id, preset) {  // preset: values checked at the start (고치는 조건의 지금 값)
  closeDD(true);
  ddOpen = id;
  const w = document.querySelector(`.fdd[data-for="${id}"]`), r = w.getBoundingClientRect();
  const p = document.createElement("div");
  p.id = "fddPop"; p.className = "fddpop";
  const multi = id === "fVal";  // 소분류: 체크박스로 여러 개 고른 뒤 '추가' → 그중 하나라도 (OR) 조건 하나
  ddSel = new Set(multi && preset || []);
  p.innerHTML = `<div class="fdd-top"><input type="search" placeholder="${esc($(id).options[0].text)} 검색" spellcheck="false" autocomplete="off">`
    + (multi ? `<button type="button" class="fdd-add" disabled title="체크한 값들을 조건 하나로 (그중 하나라도 맞으면)">추가</button>` : "") + `</div><div class="fdd-list"></div>`;
  if (multi) p.querySelector(".fdd-add").onclick = () => { const vs = [...ddSel], e = fEdit; closeDD(true); fEdit = null; e ? applyEdit(e, vs) : addValues(vs); };
  ddAddBtn(p.querySelector(".fdd-add"));
  $("searchDlg").appendChild(p);  // inside the dialog (top layer) so it shows above it
  placePop(p, w, 240);
  w.classList.add("open");
  const q = p.querySelector("input");
  q.oninput = () => { ddHl = 0; renderDD(); };
  q.onkeydown = e => {
    const os = [...p.querySelectorAll(".fdd-opt")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      ddHl = Math.max(0, Math.min(os.length - 1, ddHl + (e.key === "ArrowDown" ? 1 : -1)));
      os.forEach((o, i) => o.classList.toggle("hl", i === ddHl));
      if (os[ddHl]) os[ddHl].scrollIntoView({block: "nearest"});
    } else if (e.key === "Enter") { e.preventDefault(); if (os[ddHl]) fEdit && ddOpen === "fVal" ? os[ddHl].click() : pickDD(os[ddHl].dataset.v); }  // 고치는 중: 체크만
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeDD(); }  // don't close the search popup too
  };
  p.querySelector(".fdd-list").onclick = e => {
    if (e.target.closest(".fdd-all")) {  // 전체 선택: every value matching the search box (user request — top of the list)
      e.stopPropagation();  // the list is redrawn → the clicked node is detached and would look like an outside click
      const vs = ddVisible(), all = vs.length && vs.every(v => ddSel.has(v));
      vs.forEach(v => all ? ddSel.delete(v) : ddSel.add(v));
      ddAddBtn(p.querySelector(".fdd-add"));
      renderDD();
      return;
    }
    const o = e.target.closest(".fdd-opt"); if (!o) return;
    if (e.target.closest(".fdd-ck") || (fEdit && ddOpen === "fVal")) {  // 체크박스: 고르기만 (추가는 '추가' 단추) · 고치는 중이면 줄을 눌러도 체크만
      const ck = o.querySelector(".fdd-ck");
      if (e.target !== ck) ck.checked = !ck.checked;
      ck.checked ? ddSel.add(o.dataset.v) : ddSel.delete(o.dataset.v);
      ddAddBtn(p.querySelector(".fdd-add"));
      return;
    }
    pickDD(o.dataset.v);
  };
  ddHl = 0;
  renderDD();
  q.focus();
}
/* 펼친 목록을 칸 바로 아래에. 화면을 줄여 두면(--ui-zoom) 잰 위치와 style 의 px 단위가 달라 그 비율로 나눔 */
function placePop(p, anchor, minW) {
  const r = anchor.getBoundingClientRect(), z = r.width / anchor.offsetWidth || 1;
  const W = innerWidth / z, H = innerHeight / z, left = r.left / z, top = r.bottom / z + 3;
  const width = Math.max(r.width / z, minW);
  Object.assign(p.style, {left: Math.max(4, Math.min(left, W - width - 4)) + "px", top: top + "px", width: width + "px",
                          maxHeight: Math.max(180, Math.min(380, H - top - 8)) + "px"});
}
function renderDD() {
  const p = $("fddPop"); if (!p || !ddOpen) return;
  const q = fold(p.querySelector("input").value.trim());
  const name = o => o.text.replace(/ \(\d+\)$/, ""), cnt = o => (o.text.match(/ \((\d+)\)$/) || [])[1];
  let html = "", k = 0;
  for (const node of $(ddOpen).children) {
    const grp = node.tagName === "OPTGROUP";
    const hit = (grp ? [...node.children] : [node]).filter(o => o.value && (!q || fold(name(o)).includes(q)));
    if (!hit.length) continue;
    if (grp) html += `<div class="fdd-grp">${esc(node.label)}</div>`;
    html += hit.map(o => `<div class="fdd-opt${k++ === ddHl ? " hl" : ""}" data-v="${esc(o.value)}">`
      + (ddOpen === "fVal" ? `<input type="checkbox" class="fdd-ck"${ddSel.has(o.value) ? " checked" : ""}>` : "")
      + `${esc(name(o))}${cnt(o) ? `<span class="n">${cnt(o)}</span>` : ""}</div>`).join("");
  }
  if (html && ddOpen === "fVal") {  // 맨 위 '전체 선택' (찾은 값 모두 체크 / 다시 누르면 모두 해제)
    const vs = ddVisible(), on = vs.filter(v => ddSel.has(v)).length;
    html = `<div class="fdd-all"><input type="checkbox"${on && on === vs.length ? " checked" : ""}> <b>전체 선택</b><span class="n">${vs.length}</span></div>` + html;
  }
  p.querySelector(".fdd-list").innerHTML = html || `<div class="fdd-none">맞는 항목이 없습니다</div>`;
  const a = p.querySelector(".fdd-all input");
  if (a) { const vs = ddVisible(), on = vs.filter(v => ddSel.has(v)).length; a.indeterminate = on > 0 && on < vs.length; }
}
/* 값 칸에서 지금 찾기 글자에 맞는 값들 (전체 선택용) */
function ddVisible() {
  const p = $("fddPop"), q = p ? fold(p.querySelector("input").value.trim()) : "";
  return [...$("fVal").querySelectorAll("option")].filter(o => o.value && (!q || fold(o.text.replace(/ \(\d+\)$/, "")).includes(q))).map(o => o.value);
}
/* '추가' 단추: 고치는 중이면 '바꾸기' (다 풀면 '조건 빼기' — 곡 종류는 하나는 남겨야 함) */
function ddAddBtn(b) {
  if (!b) return;
  const ec = editCond();
  b.disabled = ec ? !ddSel.size && ec.k === "type" : !ddSel.size;
  b.textContent = ec ? (ddSel.size ? `바꾸기 ${ddSel.size}` : "조건 빼기") : ddSel.size ? `추가 ${ddSel.size}` : "추가";
  b.title = ec ? "체크한 값으로 이 조건을 바꿈" : "체크한 값들을 조건 하나로 (그중 하나라도 맞으면)";
}
function pickDD(v) {
  const sel = $(ddOpen);
  closeDD();
  sel.value = v;
  sel.dispatchEvent(new Event("change"));
}
function closeDD(keepEdit) {  // closing without '바꾸기' ends the edit (keepEdit: still on it)
  if ($("fddPop")) $("fddPop").remove();
  document.querySelectorAll(".fdd.open").forEach(w => w.classList.remove("open"));
  ddOpen = null;
  if (fEdit && !keepEdit) { fEdit = null; renderFilterOptions(); }
}
document.addEventListener("click", e => { if (ddOpen && !e.target.closest("#fddPop, .fdd")) closeDD(); });
/* 스크롤: 칸이 들어 있는 곳(왼쪽 목록 칸·화면)이 움직일 때만 닫음 — 가사 칸이 저절로 넘어가거나 검색 글자 칸 안에서 움직이는 건 그대로 */
document.addEventListener("scroll", e => {
  if (!ddOpen) return;
  const w = document.querySelector(`.fdd[data-for="${ddOpen}"]`), t = e.target === document ? document.documentElement : e.target;
  if (w && t.contains && t.contains(w)) closeDD();
}, true);
window.addEventListener("resize", closeDD);
$("btnFilter").onclick = () => setFilterOpen($("fPanel").hidden);
$("fFold").onclick = () => setFilterOpen(false);
$("fPanel").hidden = !store.get("sfOpen", true);  // in the search popup: open unless folded there (user request 2026-11-14)
$("fNew").addEventListener("click", e => {
  const b = e.target.closest("[data-new]"); if (!b) return;
  const x = b.dataset.new === "exc";
  FG.forEach(g => { g.m = true; });  // 버튼 없이 고른 조건도 그룹으로 남김 (다음 조건을 골라도 지워지지 않게)
  if (FG[fCur] && !fReal(FG[fCur], fCur)) FG[fCur].x = x;  // 비어 있는 선택 그룹은 새로 만들지 않고 종류만 바꿈
  else { FG.push({x, m: true, c: [{k: "type", v: F_TYPE_DEF}]}); fCur = FG.length - 1; }
  saveChips();
});
$("fKind").onchange = () => { fEdit = null; store.set("f.kind", $("fKind").value); renderFilterOptions(); };
$("fVal").onchange = () => addValues([$("fVal").value]);
/* 소분류 값(하나 또는 여러 개 — 여러 개면 그중 하나라도)을 조건으로 더함 */
function addValues(vs) {
  const c = (FCATS || []).find(x => x.id === $("fKind").value); if (!c) return;
  addChip(c.k === "singer" && $("fSolo").checked ? "solo" : c.k, vs.filter(Boolean));
}
$("fChips").addEventListener("click", e => {
  const gEl = e.target.closest(".fgroup"); if (!gEl) return;
  const gi = +gEl.dataset.g, chip = e.target.closest(".fchip");
  if (e.target.closest(".gx")) { FG.splice(gi, 1); if (fCur >= gi) fCur = Math.max(0, fCur - 1); }
  else if (chip && e.target.closest("button")) FG[gi].c.splice(+chip.dataset.c, 1);
  else if (chip) { e.stopPropagation(); return editChip(gi, +chip.dataset.c); }  // the page's outside-click would close the list it opens
  else if (e.target.closest(".gh")) FG[gi].x = !FG[gi].x;
  else fCur = gi;
  saveChips();
});
$("fReset").onclick = () => { FG = []; fCur = 0; saveChips(); };

/* 검색창도 펼친 목록처럼: 글자를 치면 바로 아래에 '"…" 검색' + 이름이 맞는 보컬·프로듀서·태그 등 (우리 곡 수와 함께)
   첫 줄(Enter)은 검색, 다른 줄을 누르거나 ↑↓ 로 골라 Enter → 그 조건을 필터에 더함. Esc·바깥 누르기로 닫힘 */
var qHl = 0;
function qOpts() {
  const raw = $("sQ").value.trim(), v = fold(raw); if (!v) return [];
  const out = [{k: "text", v, label: `"${raw}" 검색 (Enter)`, n: "", grp: "검색"}];
  for (const c of FCATS || []) for (const [val, cnt] of c.rows)
    if (fold(c.lab(val)).includes(v) && out.length < 80) out.push({k: c.k, v: val, label: c.lab(val), n: cnt, grp: c.label});
  return out;
}
function renderQPop() {
  const os = qOpts();
  let p = $("qPop");
  if (!os.length || document.activeElement !== $("sQ")) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement("div"); p.id = "qPop"; p.className = "fddpop"; p.innerHTML = '<div class="fdd-list"></div>'; $("searchDlg").appendChild(p); }  // inside the dialog (top layer) so it shows above it
  qHl = Math.min(qHl, os.length - 1);
  let g = "";
  p.querySelector(".fdd-list").innerHTML = os.map((o, i) => (o.grp !== g ? `<div class="fdd-grp">${esc(g = o.grp)}</div>` : "")
    + `<div class="fdd-opt${i === qHl ? " hl" : ""}" data-i="${i}">${esc(o.label)}<span class="n">${o.n}</span></div>`).join("");
  p.querySelector(".fdd-list").onmousedown = e => {  // mousedown: 검색창 focus 가 빠져 목록이 먼저 닫히지 않게
    const o = e.target.closest(".fdd-opt"); if (!o) return;
    e.preventDefault(); pickQ(qOpts()[+o.dataset.i]);
  };
  placePop(p, $("sQ"), 240);
}
function pickQ(o) {
  if (!o) return;
  if ($("qPop")) $("qPop").remove();
  if (o.k === "text") return runSearch();  // the first one: search with the box as it is
  $("sQ").value = "";
  if (o.k === "solo" || (o.k === "singer" && $("fSolo").checked)) o = {...o, k: "solo"};
  addChip(o.k, o.v);
}
$("sQ").addEventListener("input", () => { qHl = 0; setTimeout(renderQPop); });
$("sQ").addEventListener("focus", renderQPop);
$("sQ").addEventListener("blur", () => { if ($("qPop")) $("qPop").remove(); });
$("sQ").addEventListener("keydown", e => {
  if (e.isComposing) return;
  const os = qOpts();
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && os.length) {
    e.preventDefault();
    qHl = Math.max(0, Math.min(os.length - 1, qHl + (e.key === "ArrowDown" ? 1 : -1)));
    renderQPop();
    const h = $("qPop") && $("qPop").querySelector(".hl"); if (h) h.scrollIntoView({block: "nearest"});
  } else if (e.key === "Enter") { e.preventDefault(); pickQ(os[qHl]); }
  else if (e.key === "Escape" && $("qPop")) { e.preventDefault(); $("qPop").remove(); }
});

/* 곡 종류 (user request 2026-11-14: moved from the search row into the filter) — value = Korean name, our songs keep VocaDB's type */
FKIND.type = ["곡 종류", (it, v) => (VDB_TYPE_KO[it.type] || it.type) === v];
/* filter categories: the scope's songs (with counts) + 곡 종류 */
function sfCats(its) {
  const cats = filterCats(its, true), types = countBy(its.map(it => it.type ? [VDB_TYPE_KO[it.type] || it.type] : []));
  if (types.length) cats.push({id: "type", label: "곡 종류", k: "type", rows: types, lab: x => x});
  const p = id => (fltCat(id) || {p: 1e9}).p;  // 음원 관리 › 필터의 순서 (없으면 가나다순)
  return cats.sort((a, b) => p(a.id) - p(b.id) || a.label.localeCompare(b.label, "ko"));
}
/* 음원 관리 › 필터 (user request 2026-11-14 — export/db/filter.json): a category's row {id, label, icon, p} · its symbol */
const fltCat = id => VDB.filter && (VDB.filter.cats || []).find(c => c.id === id);
const catIconOf = x => { const f = fltCat(x.id); return f && f.icon ? f.icon + "︎" : catIcon(x.label); };
/* 태그 → 분류 (song_filter.js tagGroupOf): master tag rows keep VocaDB's category — remade when master is read again */
let tagCats = {of: null, map: new Map()};
/* 곡 조건의 값(VocaDB 번호) → 제목 (song_filter.js songTitleOf) */
songTitleOf = v => { const it = VDB.itemById(v); return it ? it.title : `곡 ${v}`; };
tagGroupOf = v => {
  if (tagCats.of !== VDB.master) tagCats = {of: VDB.master, map: new Map((VDB.master.tag || []).map(t => [t.name, TAG_CAT_KO[t.cat] || t.cat || ""]))};
  return tagCats.map.get(v) || "";
};
/* VocaDB tag categories (master tag rows keep VocaDB's) → Korean labels for the filter */
const TAG_CAT_KO = {Genres: "장르", Themes: "테마", Subjective: "분위기", Instruments: "악기", Composition: "곡 구성", Vocalists: "보컬 관련",
  Copyrights: "원작", Series: "시리즈", Animation: "애니메이션", Games: "게임", "MMD models": "MMD 모델", Sources: "출처", Distribution: "배포",
  "Editor notes": "편집 메모", "Synthesizer engines": "음성 합성 엔진", Lyrics: "가사", Derivative: "2차 창작", Design: "디자인", Events: "이벤트",
  Media: "매체", Jobs: "역할", Languages: "언어"};
/* 곡 정렬: 이전 목록의 정렬 그대로 (전체 곡도 같음) */
const OUR_SORTS = [["RatingScore", "인기순"], ["list", "노래방 목록 순"], ["Name", "제목 (가나다)"], ["no", "노래방 번호"], ["PublishDate", "투고일 (최신)"],
                   ["old", "투고일 (오래된)"], ["composer", "프로듀서"], ["singer", "보컬"]];
function renderSortOptions() {
  const list = OUR_SORTS, v = store.get("sSort", "RatingScore");
  $("sSort").innerHTML = list.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  $("sSort").value = list.some(([k]) => k === v) ? v : "RatingScore";
}
const titleGroup = t => { const c = (t || "").trim()[0] || ""; return /[가-힣ㄱ-ㅣ]/.test(c) ? 0 : /\d/.test(c) ? 1 : /[a-z]/i.test(c) ? 2 : 3; };
const KO_CMP = new Intl.Collator("ko").compare;  // same order as localeCompare(…, "ko"), much faster over 수십만 곡
function ourSort(list) {
  const big = 1e9, txt = (a, b) => (a ? 0 : 1) - (b ? 0 : 1) || KO_CMP(a || "", b || "");
  const ord = it => { const o = it.ord || {}; return o.namu != null ? o.namu : o.japan != null ? 1e6 + o.japan : big; };
  const num = it => { const n = it.nums || {}, b = ["TJ", "금영", "DAM", "JOYSOUND", "UGA"].findIndex(x => n[x]); return b < 0 ? [big, big] : [b, parseInt(String(n[["TJ", "금영", "DAM", "JOYSOUND", "UGA"][b]]).replace(/\D/g, ""), 10) || big]; };
  const byTitle = (a, b) => titleGroup(a.title) - titleGroup(b.title) || KO_CMP(a.title, b.title);
  const cmp = {RatingScore: (a, b) => (b.rating || 0) - (a.rating || 0), list: (a, b) => ord(a) - ord(b), Name: () => 0,
    no: (a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1]; },
    PublishDate: (a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (b.date || "").localeCompare(a.date || ""), old: (a, b) => txt(a.date, b.date),
    composer: (a, b) => txt(a.composer, b.composer), singer: (a, b) => txt(a.singer, b.singer)}[$("sSort").value] || (() => 0);
  return list.sort((a, b) => cmp(a, b) || byTitle(a, b));
}

$("sList").addEventListener("click", e => {
  const b = e.target.closest("button[data-a]"), row = e.target.closest(".sitem"); if (!b || !row) return;
  const it = LOCAL.remember(S.items[+row.dataset.i]);
  if (b.dataset.a === "filt") return toggleSongCond(it);
  if (b.dataset.a === "play") { PL.add([it], true); play(it, true, "pick"); }
  // user request 2026-11-14: 다음에 재생 = the play queue's 직접 넣은 곡 (before the shuffled rest), not a playlist position
  else if (b.dataset.a === "next") { PL.add([it]); SHELL.enqueue(it); }
  else PL.add([it]);
  renderSearch($("sInfo").textContent);
});
$("sList").addEventListener("contextmenu", e => { const row = e.target.closest(".sitem"); if (row) songContext(e, S.items[+row.dataset.i]); });
/* 상위 N 곡 재생목록 만들기 (user request 2026-11-14 — '결과 모두 재생목록에' 대신): 찾은 곡을 위에서부터 N곡 (틀 수 있는 곡만) → 새 재생목록 */
$("sTopN").value = store.get("sTopN", 1000);
const topN = () => { const n = Math.max(1, parseInt($("sTopN").value, 10) || 1000); $("sTopN").value = n; store.set("sTopN", n); return n; };
$("sTopN").onchange = topN;
$("sTopN").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("sMakePl").click(); } });
$("sMakePl").onclick = async () => {
  const n = topN(), list = S.items.filter(canPlay).slice(0, n);
  if (!list.length) return;
  if (SHELL.queue.length && !await uiConfirm(`지금 재생목록 ${SHELL.queue.length.toLocaleString()}곡을 비우고 찾은 곡 상위 ${list.length.toLocaleString()}곡으로 새로 만들까요?`)) return;
  const seen = new Set();
  PL.set(list.filter(it => !seen.has(keyOf(it)) && seen.add(keyOf(it))).map(it => LOCAL.remember(it)));
  renderSearch($("sInfo").textContent);
  uiAlert(`재생목록을 ${SHELL.queue.length.toLocaleString()}곡으로 만들었습니다.`);
};

/* 필터 프리셋 추천 · 저장된 필터 (user request 2026-11-14) — 고르면 지금 필터가 그 필터로 바뀜 */
const F_PRESETS_DEF = [
  {name: "한국/일본 노래방 수록곡", groups: [{x: false, m: true, c: [{k: "kara", v: ONOFF_LISTS.slice()}]}]},  // 노래방 카테고리 전체 선택
];
/* 프리셋은 음원 관리 › 필터에서 정함 (filter.json) — 없으면 위 기본값 */
const fPresets = () => VDB.filter && (VDB.filter.presets || []).length ? VDB.filter.presets : F_PRESETS_DEF;
const fSummary = gs => gs.filter(g => g.c.length).map(g => (g.x ? "− " : "") + g.c.map(chipLabel).join(" · ")).join(" / ");
function applyFilter(groups) {
  FG = JSON.parse(JSON.stringify(groups)).map(g => withType({...g, m: true}));
  fCur = 0;
  saveChips();
}
function closeFSet() { if ($("fSetPop")) $("fSetPop").remove(); document.querySelectorAll("#btnPreset.open, #btnSaved.open").forEach(b => b.classList.remove("open")); }
function openFSet(btn) {
  const was = $("fSetPop") && $("fSetPop").dataset.for === btn.id;
  closeFSet(); closeDD();
  if (was) return;  // the same button again: just close
  const p = document.createElement("div");
  p.id = "fSetPop"; p.className = "fddpop"; p.dataset.for = btn.id;
  p.innerHTML = '<div class="fdd-list"></div>';
  $("searchDlg").appendChild(p);  // inside the dialog (top layer) so it shows above it
  btn.classList.add("open");
  renderFSet();
  placePop(p, btn, 280);
}
function renderFSet() {
  const p = $("fSetPop"); if (!p) return;
  const preset = p.dataset.for === "btnPreset", saved = store.get("f.saved", []);
  const row = (f, i) => `<div class="fdd-opt fset" data-i="${i}" title="${esc(fSummary(f.groups))}"><span class="nm">${esc(f.name)}</span>`
    + `<span class="sum">${esc(fSummary(f.groups))}</span>${preset ? "" : '<button class="fx" title="지우기">✕</button>'}</div>`;
  p.querySelector(".fdd-list").innerHTML = preset ? `<div class="fdd-grp">추천 필터</div>` + fPresets().map(row).join("")
    : `<div class="fdd-top"><button class="primary fsave"${FG.some(g => g.c.length) ? "" : " disabled"} title="지금 고른 필터를 이름을 붙여 저장">＋ 지금 필터 저장</button></div>`
      + (saved.length ? saved.map(row).join("") : `<div class="fdd-none">저장된 필터가 없습니다</div>`);
}
$("btnPreset").onclick = e => { e.stopPropagation(); openFSet($("btnPreset")); };
$("btnSaved").onclick = e => { e.stopPropagation(); openFSet($("btnSaved")); };
$("searchDlg").addEventListener("click", async e => {
  const p = $("fSetPop"); if (!p) return;
  if (!e.target.closest("#fSetPop")) return closeFSet();
  e.stopPropagation();
  const preset = p.dataset.for === "btnPreset", saved = store.get("f.saved", []);
  if (e.target.closest(".fsave")) {
    closeFSet();
    const name = await uiPrompt("저장할 필터 이름", fSummary(FG).slice(0, 40), "필터 이름");
    if (!name) return;
    const groups = FG.filter(g => g.c.length).map(({x, c}) => ({x, c}));
    store.set("f.saved", [...saved.filter(f => f.name !== name), {name, groups}]);  // 같은 이름이면 덮어씀
    return;
  }
  const o = e.target.closest(".fset"); if (!o) return;
  const i = +o.dataset.i;
  if (e.target.closest(".fx")) { saved.splice(i, 1); store.set("f.saved", saved); return renderFSet(); }
  const f = (preset ? fPresets() : saved)[i]; if (!f) return;
  closeFSet();
  applyFilter(f.groups);
});
$("searchDlg").addEventListener("keydown", e => { if (e.key === "Escape" && $("fSetPop")) { e.preventDefault(); closeFSet(); } });
$("searchDlg").addEventListener("close", closeFSet);
window.addEventListener("resize", closeFSet);

/* ================= 재생 ================= */
/* 가사·싱크를 저장했으면 재생기 가사(오버레이 알림)도 다시 읽게 함 */
const syncShell = () => { if (SHELL.now && cur && keyOf(SHELL.now) === keyOf(cur)) SHELL.reloadLyrics(); };  // 저장한 싱크를 재생기 가사(오버레이)에도
/* 재생목록의 곡을 누르면 그 곡부터 (⏭ 는 재생목록 순서대로) · 검색 창에서 바로 튼 곡은 재생목록 지금 곡 다음에 들어감 */
async function play(it, autoplay = true, how = "pick") {  // how '': 재생 목록에서 그 곡 다음부터 (처음 열 때 지난 곡)
  if (!it) return;
  if (editing && !await uiConfirm("직접 맞추던 싱크를 저장하지 않고 다른 곡으로 넘어갈까요?")) return;
  stopEdit();
  SHELL.load(it, autoplay, how);  // 곡이 바뀌면 재생기가 알려 줌 → showSong
}
/* ▶ 처음부터: 재생목록(오프라인은 mp3 폴더의 곡)을 처음 곡부터 (무작위면 섞은 첫 곡) */
async function playView() {
  const list = view.filter(canPlay);
  if (!list.length) return ONLINE ? openSearch() : uiAlert("재생할 곡이 없습니다.");
  if (editing && !await uiConfirm("직접 맞추던 싱크를 저장하지 않고 다른 곡으로 넘어갈까요?")) return;
  stopEdit();
  SHELL.setQueue(list);
  SHELL.load(SHELL.shuffle ? list[Math.floor(Math.random() * list.length)] : list[0], true);
}
$("btnPlayView").onclick = playView;
/* 기억해 둔 재생목록을 되살림 (화면을 새로 열었을 때) */
async function restoreQueue() {
  if (SHELL.queue.length) return;
  const q = await PL.restore();
  if (SHELL.queue.length) return;
  SHELL.setQueue(q);
  SHELL.plan(SHELL.now);
}
/* 재생기에서 곡이 바뀜 (직접 고르거나, 곡이 끝나 다음 곡으로 넘어감) → 화면 갱신 */
async function showSong(it) {
  if (!it || (cur && keyOf(cur) === keyOf(it))) return;
  stopEdit();
  cur = it;
  $("nowTitle").textContent = it.title; $("nowArtist").textContent = shortName(it.artist || it.name);
  $("nowDetail").innerHTML = detailHtml(it);
  showViews(it);
  renderMeta(it);
  if (hasCover(it)) { $("nowCover").dataset.ck = keyOf(it); $("nowCover").src = coverUrl(it); } else $("nowCover").removeAttribute("src");
  $("btnSrc").hidden = !it.video;  // 원곡 영상 링크 (온라인 기능)
  if (it.video) $("btnSrc").href = it.video;
  // 위키 ↗: 나무위키 곡 문서가 있는 곡만 (노래방 수록 목록 표의 링크 — 제목으로 찾으면 같은 제목의 다른 노래 문서로 가기도 해서 링크가 있을 때만)
  const wb = $("btnWiki");
  wb.hidden = !it.namu;
  if (it.namu) wb.href = it.namu; else wb.removeAttribute("href");
  showVideo();
  document.title = `${it.title} · 음원 플레이어`;
  renderRows(true);  // 지금 곡 표시만 (목록을 다시 거르지 않음)
  await loadSong();
}
/* 투고일 (곡 정보의 값) · 니코니코 원곡 재생수 (그때그때 — 서버는 니코니코 정보 API, 서버 없이는 중계 페이지의 니코니코 플레이어. 유튜브 원곡은 안 보임) */
function showViews(it) {
  const date = it.date ? `투고 ${it.date}` : "";
  $("nowDate").textContent = date; $("nowDate").title = "";
  if (it.site !== "stream" || !/nicovideo\.jp|nico\.ms/.test(it.video || "")) return;
  api(`/api/stream/views?name=${encodeURIComponent(it.name)}`).then(r => {
    if (!cur || keyOf(cur) !== keyOf(it) || r.views == null) return;
    $("nowDate").textContent = [date, `재생수 ${r.views.toLocaleString()}회`].filter(Boolean).join(" · ");
    $("nowDate").title = "니코니코 원곡 재생수 (지금 받은 값)";
  }).catch(() => {});
}
/* 곡 태그: 보컬(보컬 색) → 노래방(TJ·JOY만) → 내부 분류(한국·일본 목록) → 나무위키 분류(평범한 칩) · 아래에 노래방 목록 각주(작게) */
const KARAOKE_TAG = {TJ: "TJ", JOYSOUND: "JOY"};
function renderMeta(it) {
  const tags = it.tags || [], notes = it.notes || [], box = $("songMeta");
  const kara = tags.filter(t => KARAOKE_TAG[t]).map(t => [KARAOKE_TAG[t], t]);
  // 우리 DB 태그는 많이 붙은 순 앞 8개만 (분류는 마우스를 올리면). 음성 합성 엔진은 맨 앞 보컬(보컬 색)로 보이므로 뺌
  const lists = tags.filter(t => t === "한국" || t === "일본");
  const inner = [...lists, ...tags.filter(t => !KARA_RE.test(t) && !lists.includes(t) && tagGroupOf(t) !== "음성 합성 엔진").slice(0, 8)];
  const tagChip = t => lists.includes(t) ? `<span class="b inner${t === "한국" ? " ko" : " ja"}" title="노래방 목록 (한국·일본)">${esc(t)}</span>`
    : `<span class="b" title="${esc(tagGroupOf(t) || "태그")}">${esc(t)}</span>`;
  const chips = [
    ...(it.vocals || []).map(([n, c]) => `<span class="b vocal" style="--vc:${esc(c)}" title="보컬">${esc(n)}</span>`),
    ...kara.map(([t, b]) => `<span class="b kara" style="--bc:${BRAND_COLOR[b]}" title="노래방 수록">${esc(t)}</span>`),
    ...inner.map(tagChip),
    ...(it.categories || []).map(c => `<span class="b" title="나무위키 분류">${esc(c)}</span>`)];
  box.hidden = !chips.length && !notes.length;
  box.innerHTML = (chips.length ? `<div class="cats">${chips.join("")}</div>` : "")
    + (notes.length ? `<div class="fn" title="노래방 수록 목록의 각주">${notes.map(n => `<div>※ ${esc(n)}</div>`).join("")}</div>` : "");
}
async function loadSong() {
  const it = cur; if (!it) return;
  let s;
  try { s = await api(`/api/lyrics?site=${encodeURIComponent(it.site)}&name=${encodeURIComponent(it.name)}`); }
  catch (e) { if (cur !== it) return; song = null; $("lyrics").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (cur !== it) return;  // 가사를 받는 사이 다른 곡으로 넘어감 (온라인 곡은 위키를 읽느라 늦게 옴) → 늦게 온 앞 곡 가사로 덮지 않음
  song = s;
  const sj = song.sync;
  times = sj && (song.sync_state === "ok" || song.sync_state === "resync") ? sj.times : null;  // 재싱크 필요여도 지난 싱크로 우선 표시
  offset = sj ? +sj.offset || 0 : 0;
  renderLyrics(); renderSyncChip();
}
function renderSyncChip() {
  const c = $("syncChip"), sj = song && song.sync;
  let txt = "싱크 없음", cls = "chip";
  if (!song || !song.groups.length) txt = "가사 없음";
  else if (song.sync_state === "stale") { txt = "가사가 바뀜 · 다시 맞춰야 함"; cls += " warn"; }
  else if (times && sj.method === "manual") { txt = "직접 맞춘 싱크"; cls += " ok"; }
  else if (times && sj.edited) {  // 손으로 고쳤지만 안 고친 '추정' 묶음이 남음 → 직접 싱크 아님
    txt = `직접 수정 · 추정 ${(sj.matched || []).filter(x => x === false).length}묶음 남음`; cls += " warn";
  }
  else if (times) {
    const p = Math.round((sj.score || 0) * 100);
    txt = `자동 싱크 · 인식 일치 ${p}%`; cls += p >= 70 ? " ok" : " warn";
  }
  c.title = times && sj.method !== "manual" ? "인식으로 맞춘 묶음의 비율입니다. '추정' 표시 묶음은 앞뒤 묶음 시간으로 채운 것이라 어긋날 수 있습니다." : "";
  if (times && song.sync_pending) {  // edited here, waiting for the manage screen to confirm (반영) — played meanwhile
    txt += " · 확인 대기";
    c.title = "고친 싱크가 음원 관리의 확인을 기다리는 중입니다. 반영되면 본 싱크가 되고, 버려지면 전 싱크로 돌아갑니다.\n" + c.title;
  }
  c.textContent = txt; c.className = cls;
  showOff();
  const has = !!(song && song.groups.length), fail = song && song.sync_fail;
  $("failChip").hidden = !fail;
  if (fail) { $("failChip").textContent = `자동 싱크 실패: ${fail.reason}`; $("failChip").title = `${fail.at} · 모델 ${fail.model || "?"}`; }
  $("btnEdit").disabled = !has;
  $("offMinus").disabled = $("offPlus").disabled = !times && !editing;
  $("btnLyrics").disabled = !song || !song.raw;
}
function showOff() {
  const v = editing ? editShift : offset;
  $("offVal").textContent = (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(1) + "초";
}
function renderLyrics() {
  const box = $("lyrics");
  curIdx = -1;
  if (!song || !song.groups.length) {
    box.className = "nosync";
    box.innerHTML = `<div class="empty">가사 없음${cur && cur.site === "local" ? '<br><span class="hint">mp3 와 같은 이름의 가사·싱크 json 이 없습니다 (음원 관리 › mp3 다운로드로 받은 곡은 같이 받음)</span>' : ""}</div>`;
    return;
  }
  const matched = (song.sync && song.sync.matched) || [];
  const notes = (song.notes || []).length ? `<div class="lnotes">${song.notes.map(esc).join("<br>")}</div>` : "";
  const partTag = p => p ? `<div class="part" style="--pc:${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "transparent"}">${
    (p.colors || [null]).map(c => c && /^#[0-9a-f]{6}$/i.test(c) ? `<i style="--pc:${c}"></i>` : "<i></i>").join("")}${esc(p.name)}</div>` : "";
  // 동시에 부르는 묶음(g.cols): 보컬마다 칸을 나란히 (칸 위에 그 보컬 이름)
  box.innerHTML = notes + song.groups.map((g, i) => `<div class="g${times && song.sync.method !== "manual" && matched[i] === false ? " guess" : ""}" data-i="${i}">
      ${g.cols ? lyrCols(g, p => partTag(p) || '<div class="part">&nbsp;</div>') : partTag(g.part) + g.lines.map(l => lyrLine(l.role + (l.auto ? " auto" : "") + (l.lang ? ` xl-${l.lang}` : ""), l.text, g.vc)).join("")}
      <div class="prog"><i></i></div>
      <div class="stamp"><button data-d="-1" title="1초 앞으로">&lt;&lt;</button><button data-d="-0.2" title="0.2초 앞으로">&lt;</button><span class="tv"></span><button data-d="0.2" title="0.2초 뒤로">&gt;</button><button data-d="1" title="1초 뒤로">&gt;&gt;</button></div>
    </div>`).join("");
  box.className = (times ? "" : "nosync ") + (editing ? "editing " : "") + ($("showR").checked ? "" : "hide-r ") + ($("showT").checked ? "" : "hide-t ") + ($("showP").checked ? "" : "hide-p ");
  renderXLang();
  box.scrollTop = 0;
  if (editing) renderStamps();
  tick(true);
}

$("lyrics").addEventListener("click", e => {
  const g = e.target.closest(".g"); if (!g) return;
  const i = +g.dataset.i;
  if (editing) {
    const d = e.target.closest("button[data-d]");
    if (d) { if (editTimes[i] != null) { editTimes[i] = Math.max(0, +(editTimes[i] + +d.dataset.d).toFixed(2)); editOk[i] = true; audio.currentTime = Math.max(0, editTimes[i] - 0.5); } }
    else { cursor = i; if (editTimes[i] != null) audio.currentTime = Math.max(0, editTimes[i] - 1); }
    renderStamps(); return;
  }
  if (times) { audio.currentTime = Math.max(0, times[i] + offset); if (audio.paused) audio.play(); }
});
$("lyrics").addEventListener("wheel", () => userScrollAt = Date.now(), {passive: true});
$("lyrics").addEventListener("touchmove", () => userScrollAt = Date.now(), {passive: true});

/* 가사 먼저 보이기(초): 재생기 값 (브라우저 저장값) */
const lyricsLead = () => SHELL.lead;
/* 현재 묶음 표시 (재생 중에는 매 프레임) */
function tick(force) {
  const now = audio.currentTime;
  $("tCur").textContent = fmt(now);
  if (!seeking && audio.duration) $("seek").value = Math.round(now / audio.duration * 1000);
  fillRange($("seek"));
  const T = editing ? editTimes : times;
  if (!T || !song) return;
  const off = editing ? 0 : offset - lyricsLead();  // 싱크를 직접 맞출 때는 싱크 그대로, 재생할 때만 '가사 먼저 보이기'만큼 앞당김
  let idx = -1;
  for (let i = 0; i < T.length; i++) { if (T[i] != null && T[i] + off <= now + 0.05) idx = i; else if (T[i] != null) break; }
  const gs = $("lyrics").querySelectorAll(".g");
  if (idx !== curIdx || force) {
    gs.forEach((el, i) => { el.classList.toggle("cur", i === idx); el.classList.toggle("past", idx >= 0 && i < idx); });
    curIdx = idx;
    // 셀렉트 박스(필터 등)를 열어 둔 동안은 가사 칸을 움직이지 않음 — 화면 안에서 스크롤이 일어나면 브라우저가 열린 목록을 닫음
    if (idx >= 0 && Date.now() - userScrollAt > 4000 && !editing && !selectOpen()) {
      const el = gs[idx], box = $("lyrics");
      box.scrollTop = el.offsetTop - box.clientHeight * 0.35;
    }
  }
  if (idx >= 0 && gs[idx]) {
    const end = idx + 1 < T.length && T[idx + 1] != null ? T[idx + 1] + off : (audio.duration || now + 1);
    const p = Math.min(1, Math.max(0, (now - (T[idx] + off)) / Math.max(0.1, end - (T[idx] + off))));
    const bar = gs[idx].querySelector(".prog i"); if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
  }
  // 다음 줄로 바뀌는 그 순간에 한 번 더 (창이 가려져 화면 갱신 신호가 멈추면 0.2초마다 확인만으로는 최대 0.2초 늦음)
  clearTimeout(nextTimer);
  const nb = T.find((t, i) => i > idx && t != null);
  if (!audio.paused && nb != null) nextTimer = setTimeout(() => tick(false), Math.max(0, (nb + off - 0.05 - now) * 1000 / (audio.playbackRate || 1)) + 2);
}
var nextTimer = 0;
/* 셀렉트 박스에 초점이 있으면 열려 있는 것으로 봄 (열린 상태를 알려 주는 기능이 없음). 고르면 초점을 놓아 가사가 다시 따라가고,
   초점이 빠지면 밀린 가사 위치로 바로 옮김 */
function selectOpen() { return !!document.activeElement && document.activeElement.tagName === "SELECT"; }
document.addEventListener("change", e => { if (e.target.tagName === "SELECT") e.target.blur(); });
document.addEventListener("focusout", e => { if (e.target.tagName === "SELECT") setTimeout(() => tick(true), 0); });
function loop() { tick(false); if (!audio.paused) requestAnimationFrame(loop); }
// 창이 가려지거나 최소화되면 화면 갱신 신호가 멈추므로 0.2초마다도 확인 (화면을 떠나면 멈춤)
const tickTimer = setInterval(() => { if (!audio.paused) tick(false); }, 200);
cleanups.push(() => clearInterval(tickTimer));
on(audio, "play", () => { $("btnPlay").textContent = "⏸︎"; requestAnimationFrame(loop); });
on(audio, "pause", () => { $("btnPlay").textContent = "▶︎"; tick(false); });
on(audio, "seeked", () => tick(true));
on(audio, "loadedmetadata", () => { $("tDur").textContent = fmt(audio.duration); });
// audio.error 가 없으면 이미 다음 곡으로 넘어간 것 (재생기가 못 튼 곡을 건너뜀) → 새 곡에 오류 글을 적지 않음
on(audio, "error", () => { if (cur && audio.error) $("nowArtist").textContent = cur.site === "stream" ? audio.error.reason || "원곡 영상을 재생할 수 없습니다" : "재생할 수 없는 파일입니다: " + cur.name; });
on(audio, "playing", () => { if (cur) $("nowArtist").textContent = shortName(cur.artist || cur.name); });  // 끊겼다 이어 틀면 오류 글을 되돌림
on(audio, "volumechange", () => renderVolume($("btnMute"), $("vol"), audio));
// 곡이 끝났을 때 다음 곡으로 넘기는 일은 재생기가 함

let seeking = false;
$("seek").addEventListener("input", () => { seeking = true; fillRange($("seek")); if (audio.duration) $("tCur").textContent = fmt($("seek").value / 1000 * audio.duration); });
$("seek").addEventListener("change", () => { if (audio.duration) audio.currentTime = $("seek").value / 1000 * audio.duration; seeking = false; });
renderVolume($("btnMute"), $("vol"), audio);
$("vol").addEventListener("input", () => { audio.muted = false; audio.volume = +$("vol").value; store.set("vol", audio.volume); });
$("btnMute").onclick = () => { audio.muted = !audio.muted; };
$("btnPlay").onclick = () => { if (!SHELL.now) return playView(); SHELL.toggle(); };
$("btnNext").onclick = () => { if (!editing) SHELL.next(false); };
$("btnPrev").onclick = () => { if (!editing) SHELL.prev(); };
function renderModes() {
  renderModeButtons($("btnShuffle"), $("btnRepeat"), SHELL.shuffle, SHELL.repeat);
}
$("btnShuffle").onclick = () => SHELL.setShuffle(!SHELL.shuffle);
{  // 대기열 창 (play_queue.js)
  $("btnPlayQueue").hidden = false; $("btnPlayQueue").innerHTML = SHELL.queueIcon;
  SHELL.queueBtns.add($("btnPlayQueue"));
  $("btnPlayQueue").onclick = e => { e.stopPropagation(); SHELL.toggleQueue(); };
}
$("btnRepeat").onclick = () => SHELL.setRepeat({off: "all", all: "one", one: "off"}[SHELL.repeat]);

/* ================= 표시 옵션 · 밀기 ================= */
/* 다른 언어 (user request 2026-11-14): VocaDB translations other than Korean (role x, lang = culture code) — off by default;
   the select lists the languages this song has; the choice is remembered and used for every song that has that language */
const LANG_NAME = (() => { try { const n = new Intl.DisplayNames(["ko"], {type: "language"}); return c => n.of(c) || c; } catch (e) { return c => c; } })();
function renderXLang() {
  const langs = song ? [...new Set(song.groups.flatMap(g => (g.lines || []).filter(l => l.role === "x" && l.lang).map(l => l.lang)))] : [];
  const want = store.get("xLang", ""), sel = $("xLang");
  sel.innerHTML = `<option value="">${langs.length ? "다른 언어 끔" : "다른 언어 없음"}</option>` + langs.map(c => `<option value="${esc(c)}">${esc(LANG_NAME(c))}</option>`).join("");
  sel.value = langs.includes(want) ? want : "";
  sel.disabled = !langs.length;
  $("lyrics").dataset.xl = sel.value;  // css shows only .x lines of that language (#xlStyle)
  $("xlStyle").textContent = sel.value ? `#lyrics .g .x.xl-${CSS.escape(sel.value)}{display:block}` : "";
}
document.head.appendChild(Object.assign(document.createElement("style"), {id: "xlStyle"}));
$("xLang").addEventListener("change", () => { store.set("xLang", $("xLang").value); renderXLang(); SHELL.notify(); });  // overlay too
for (const [id, cls] of [["showR", "hide-r"], ["showT", "hide-t"], ["showP", "hide-p"]]) {
  $(id).checked = store.get(id, true);
  $(id).addEventListener("change", () => { store.set(id, $(id).checked); $("lyrics").classList.toggle(cls, !$(id).checked); SHELL.notify(); });  // 오버레이의 발음·번역 줄도
}
let offTimer = null;
function nudge(d) {
  // +/− now live in the 직접 맞추기 guide (user request): they shift every stamped time; kept only by 저장
  if (editing) {
    if (!editTimes.some(x => x != null)) return;
    editTimes = editTimes.map(x => x == null ? x : Math.max(0, +(x + d).toFixed(2)));
    editShift = Math.round((editShift + d) * 10) / 10;
    showOff(); renderStamps(); tick(true);
    return;
  }
  if (!times) return;
  offset = Math.round((offset + d) * 10) / 10;
  renderSyncChip(); tick(true);
  if (SHELL.now && keyOf(SHELL.now) === keyOf(cur)) SHELL.setOffset(offset);  // 위 고정 가사도 같이
  clearTimeout(offTimer);
  const s = song;
  offTimer = setTimeout(() => post("/api/sync/save", {site: s.site, name: s.name, offset}).catch(e => uiAlert(e.message)), 600);
}
$("offMinus").onclick = () => nudge(-0.2);
$("offPlus").onclick = () => nudge(0.2);

/* ================= 직접 맞추기 ================= */
function startEdit() {
  if (!song || !song.groups.length) return;
  editing = true; SHELL.editing = true;
  editTimes = song.groups.map((_, i) => times ? +(times[i] + offset).toFixed(2) : null);
  editShift = offset;  // the song's current push is baked into editTimes; show it as the start value
  // 묶음마다 믿을 만한 시간인지: 인식으로 맞았거나 손으로 찍음 → 안 고친 '추정' 묶음은 저장해도 추정으로 남음
  const m = (song.sync && song.sync.matched) || [];
  editOk = song.groups.map((_, i) => !!times && (song.sync.method === "manual" || m[i] !== false));
  cursor = 0;
  if (times) { const t = audio.currentTime; cursor = Math.max(0, editTimes.findIndex(x => x > t)); }
  $("editbar").classList.add("show"); $("btnEdit").classList.add("on");
  $("offMinus").disabled = $("offPlus").disabled = false; showOff();
  $("lyrics").classList.add("editing", "nosync");
  renderStamps();
}
function stopEdit() {
  editing = false; editTimes = null; editOk = null; SHELL.editing = false;
  $("editbar").classList.remove("show"); $("btnEdit").classList.remove("on");
  showOff(); $("offMinus").disabled = $("offPlus").disabled = !times;
  $("lyrics").classList.remove("editing");
  $("lyrics").classList.toggle("nosync", !times);
  $("lyrics").querySelectorAll(".g.cursor").forEach(el => el.classList.remove("cursor"));
}
function renderStamps() {
  $("lyrics").querySelectorAll(".g").forEach((el, i) => {
    el.classList.toggle("cursor", i === cursor);
    el.classList.toggle("guess", !editOk[i]);
    el.querySelector(".tv").textContent = editTimes[i] == null ? "—" : fmt(editTimes[i]) + "." + String(Math.floor((editTimes[i] % 1) * 10));
  });
  const el = $("lyrics").querySelectorAll(".g")[cursor];
  if (el) { const box = $("lyrics"); box.scrollTop = el.offsetTop - box.clientHeight * 0.35; }
}
function stamp() {
  if (cursor >= editTimes.length) return;
  editTimes[cursor] = +audio.currentTime.toFixed(2); editOk[cursor] = true;
  for (let i = cursor + 1; i < editTimes.length; i++) if (editTimes[i] != null && editTimes[i] < editTimes[cursor]) { editTimes[i] = null; editOk[i] = false; }  // 뒤 묶음이 앞서면 비움
  cursor = Math.min(cursor + 1, editTimes.length - 1);
  renderStamps(); tick(true);
}
$("btnEdit").onclick = () => editing ? stopEdit() : startEdit();
$("btnEditCancel").onclick = () => { stopEdit(); renderLyrics(); };
$("btnEditSave").onclick = async () => {
  // 찍지 않은 묶음은 앞뒤 시간 사이를 고르게 채움
  const T = editTimes.slice(), n = T.length;
  if (T.every(x => x == null)) { uiAlert("찍은 시간이 없습니다."); return; }
  let first = T.findIndex(x => x != null);
  for (let i = first - 1; i >= 0; i--) T[i] = Math.max(0, T[i + 1] - 3);
  for (let i = 1; i < n; i++) if (T[i] == null) {
    let j = i; while (j < n && T[j] == null) j++;
    const a = T[i - 1], b = j < n ? T[j] : a + 4 * (j - i + 1);
    for (let k = i; k < j; k++) T[k] = +(a + (b - a) * (k - i + 1) / (j - i + 1)).toFixed(2);
    i = j;
  }
  try { song = await post("/api/sync/save", {site: song.site, name: song.name, times: T, matched: editOk, offset: 0}); }
  catch (e) { uiAlert(e.message); return; }
  stopEdit(); times = song.sync.times; offset = 0; syncShell();
  // the song's list mark is already updated (LOCAL.synced) — re-downloading the whole list (MBs on GitHub) left the load bar up
  renderLyrics(); renderSyncChip(); renderList();
};

/* ================= 가사 보기: 가사 txt 미리보기 · 끌어서 복사 · txt 로 받기 ================= */
function openLyricsView() {
  if (!cur || !song || !song.raw) return;
  $("lyrViewTitle").textContent = `가사 — ${cur.title}`;
  $("lyrViewHint").textContent = cur.site === "local" ? "mp3 와 같은 이름의 json 에 든 가사입니다."
    : {namu: "나무위키 곡 문서에서 받은 가사입니다.", vocaro: "보카로 가사 위키에서 받은 가사입니다.",
       vocadb: "VocaDB 에서 받은 가사입니다 (가사 출처는 맨 위)."}[song.lyrics_kind] || "직접 고친 가사입니다.";
  $("lyrViewText").textContent = song.raw;
  $("lyrView").showModal();
  $("lyrViewText").scrollTop = 0;
}
$("lyrViewClose").onclick = () => $("lyrView").close();
$("lyrViewDown").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([song.raw.replace(/\r?\n/g, "\r\n")], {type: "text/plain;charset=utf-8"}));
  a.download = `${(cur.title || "가사").replace(/[\\/:*?"<>|]+/g, "_").trim()}.txt`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("btnLyrics").onclick = openLyricsView;

/* ================= 원곡 영상 칸: 재생 중인 온라인 곡의 중계 플레이어(니코니코·유튜브)가 곧 영상 =================
   재생기(play_engine.js)가 중계 플레이어를 이 칸 위에 겹쳐 보임 (placeVideo). 영상을 숨기면 칸만 접음 — 소리는 그대로 */
const VID = {on: store.get("video", false)};
/* 간단 표시 (왼쪽 위 '간단' 버튼): 재생목록 썸네일 · 오른쪽 위 썸네일을 숨기고 영상도 접음 (영상 켜기 설정은 그대로 — 간단 표시를 끄면 다시 보임)
   · 가사·오버레이도 보컬 색 없이 일반 글자색 (파트 표시는 그대로 — player_screen.css · play_engine.js sendNow) */
let SIMPLE = !!store.get("simple", false);
function applySimple() {
  document.body.classList.toggle("simple", SIMPLE);
  $("btnSimple").classList.toggle("on", SIMPLE);
  $("btnVideo").disabled = SIMPLE;
  $("btnVideo").title = SIMPLE ? "간단 표시 중에는 영상을 접습니다 (왼쪽 위 '간단'을 끄면 보임)" : "원곡 영상 보기 · 숨기기 (인터넷 필요) · 끌면 영상 높이 조절";
}
$("btnSimple").onclick = () => { SIMPLE = !SIMPLE; store.set("simple", SIMPLE); applySimple(); showVideo(); renderRows(true); SHELL.notify(); };  // 썸네일이 빠져 줄 높이가 바뀜 → 다시 잼 · 오버레이 글자색도 바로
applySimple();
/* 라이트 모드 (제목 줄 오른쪽 끝 달/해 버튼): html[data-theme=light] 로 색 토큰을 바꿈 — 기억함 (첫 그림 전 적용은 player_screen.html <head>) */
function applyTheme(t) {
  if (t === "light") document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
  $("btnTheme").title = t === "light" ? "어두운 화면으로" : "밝은 화면으로";
}
$("btnTheme").onclick = () => { const t = store.get("theme", "dark") === "light" ? "dark" : "light"; store.set("theme", t); applyTheme(t); };
applyTheme(store.get("theme", "dark"));
function showVideo() {
  const on = VID.on && !!cur && !SIMPLE, playing = !!cur && !!SHELL.now && keyOf(SHELL.now) === keyOf(cur);
  const live = on && playing && audio.bridged && !audio.error;
  $("btnVideo").classList.toggle("on", VID.on);
  $("videoBox").hidden = !on;
  $("nowCover").hidden = !cur || !hasCover(cur) || on || SIMPLE;  // 영상 모드에서는 썸네일을 영상 자리에 · 간단 표시는 숨김
  SHELL.placeVideo(live ? $("videoFrame") : null);
  $("btnCmt").hidden = !(live && audio.kind === "nico");  // 니코니코 영상이 보일 때만
  $("btnCmt").classList.toggle("on", audio.comments);
  if (!on || live) { $("videoFrame").innerHTML = ""; return; }
  // 영상이 없을 때: 썸네일을 꽉 차게 + 맨 위 가운데에 까닭
  const msg = cur.site === "local" ? "오프라인 곡(mp3 폴더)은 영상이 없습니다."
    : !playing ? "재생 중인 곡의 영상만 보입니다 — 재생목록이나 곡 검색에서 곡을 누르면 재생합니다."
    : audio.error ? audio.error.reason || "원곡 영상을 재생할 수 없습니다." : "원곡 영상을 여는 중…";
  const bg = hasCover(cur) ? `style="background-image:url('${esc(coverUrl(cur))}')"` : "";
  $("videoFrame").innerHTML = `<div class="vfallback" ${bg}><div class="vmsg">${esc(msg)}
    ${cur.video ? `<a href="${esc(cur.video)}" target="_blank" rel="noopener">원곡 페이지 ↗</a>` : ""}</div></div>`;
}
/* Video tab (user request): a short click folds/unfolds the video, a drag (video shown) sets its height —
   the video keeps 16:9, so it shrinks/grows with it. Kept as a share of the window height (--vid-f, 10–85%)
   so it still fits after a window resize. The old grip bar under the video was removed. */
const VID_F = f => { f = Math.min(.85, Math.max(.1, f)); document.documentElement.style.setProperty("--vid-f", f); return f; };
{
  const saved = store.get("videoH", null);
  if (saved) VID_F(saved);
  const tab = $("btnVideo");
  let drag = null;
  tab.addEventListener("pointerdown", e => {
    if (SIMPLE || e.button !== 0) return;
    drag = {y: e.clientY, h: $("videoFrame").getBoundingClientRect().height, moved: false};
    tab.setPointerCapture(e.pointerId); e.preventDefault();
  });
  tab.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientY - drag.y) < 4) return;  // under 4px = a click
    if ($("videoBox").hidden) return;  // nothing to resize while folded
    drag.moved = true; tab.classList.add("drag");
    drag.f = VID_F((drag.h + e.clientY - drag.y) / innerHeight);
    dispatchEvent(new Event("resize"));  // the bridge player over the video follows at once (play_engine placeNow)
  });
  const end = (e, cancel) => {
    if (!drag) return;
    const d = drag; drag = null; tab.classList.remove("drag");
    if (d.moved) { if (d.f) store.set("videoH", d.f); return; }
    if (!cancel) { VID.on = !VID.on; store.set("video", VID.on); showVideo(); }  // short click: fold / unfold
  };
  tab.addEventListener("pointerup", e => end(e, false));
  tab.addEventListener("pointercancel", e => end(e, true));
  tab.addEventListener("keydown", e => { if (e.key === "Enter" && !SIMPLE) { e.preventDefault(); VID.on = !VID.on; store.set("video", VID.on); showVideo(); } });
}
$("btnCmt").onclick = () => { audio.comments = !audio.comments; showVideo(); };
for (const ev of ["sourcechange", "emptied", "error", "loadedmetadata"]) on(audio, ev, showVideo);  // 중계 플레이어가 바뀜·뜸·못 틂
cleanups.push(() => SHELL.placeVideo(null));  // 화면을 떠나면 영상 칸이 없어짐 → 접음 (소리는 그대로)

/* ================= 오류 신고: 고른 종류 + 자세한 내용 + 곡·재생 위치·틀던 출처 → 음원 관리 › 오류 신고 (서버 없이도 — local_files.js) ================= */
let reportIt = null;  // 신고할 곡 (처음엔 지금 재생 중인 곡)
// User request: everyone shares one token, so each report carries the sender's name (required · remembered in this browser).
// "신곡 추가 요청": no song is picked — the song search box becomes the requested song name.
const REPORT_REQ = "신곡 추가 요청";
const reportReq = () => $("reportKind").value === REPORT_REQ;
function reportCanSend() {
  $("reportSend").disabled = !!(LOCAL.gh && !LOCAL.gh.write)  // 읽기만 되는 깃허브 토큰이면 보낼 수 없음
    || !$("reportWho").value.trim() || (reportReq() ? !$("reportQ").value.trim() : !reportIt);
}
function setReportSong(it) {
  reportIt = it;
  const playing = it && SHELL.now && keyOf(SHELL.now) === keyOf(it);
  $("reportSong").innerHTML = it ? `<b>${esc(it.title)}</b> <span class="hint">${esc(shortName(it.artist || ""))}${playing ? ` · 재생 위치 ${fmt(audio.currentTime)}` : ""}</span>`
    : '<span class="hint">곡을 고르세요</span>';
  reportCanSend();
}
function reportKindChanged() {
  const req = reportReq();
  $("reportSongLabel").innerHTML = req ? "요청할 곡" : '어느 곡인가요 <span class="hint">(지금 재생 중인 곡 — 다른 곡이면 아래에서 찾아 고르기)</span>';
  $("reportSong").hidden = req;
  $("reportQ").type = req ? "text" : "search";
  $("reportQ").placeholder = req ? "요청할 곡명 (제목·가수 — 영상 주소도 좋아요)" : "다른 곡 찾기 (제목·원제·가수)";
  $("reportQ").value = ""; $("reportList").innerHTML = "";
  setReportSong(req ? null : SHELL.now || cur);  // request: the picked song is cleared
  if (req) $("reportQ").focus();
}
$("reportKind").addEventListener("change", reportKindChanged);
$("reportWho").addEventListener("input", () => { store.set("reportWho", $("reportWho").value.trim()); reportCanSend(); });
let reportDiag = "";  // diagnostic log attached to a stall report (play_engine.js diag)
function openReport(pre = {}) {
  $("reportWho").value = store.get("reportWho", "");
  if (pre.kind) $("reportKind").value = pre.kind;
  else if (reportReq() || $("reportKind").value === REPORT_STALL) $("reportKind").selectedIndex = 0;
  reportKindChanged();
  if (pre.it) setReportSong(pre.it);
  $("reportText").value = pre.text || "";
  reportDiag = pre.diag || "";
  // 보내는 곳: 깃허브에서 열었으면 그 저장소 (서버 PC 의 음원 관리가 받아 봄) · 폴더로 열었으면 그 폴더 (서버 PC 의 폴더일 때만 전달됨)
  $("reportHint").textContent = "보낸 날짜·시각과 함께 저장됩니다 — " + (LOCAL.gh
    ? (LOCAL.gh.write ? `깃허브 ${LOCAL.gh.repo} 에 올라가 음원 관리에서 받아 봅니다` : "읽기만 되는 토큰이라 보낼 수 없습니다 (토큰에 Contents 쓰기 권한 필요)")
    : `고른 폴더(${LOCAL.name})에 저장됩니다 — 다른 PC 라면 '깃허브에서 열기'로 열어야 전달됩니다`);
  const ro = LOCAL.gh && !LOCAL.gh.write;
  $("reportSend").title = ro ? "읽기만 되는 토큰" : "";
  $("reportDlg").showModal();
  ($("reportWho").value ? $("reportText") : $("reportWho")).focus();
}
$("btnReport").onclick = () => openReport();
/* User request: no browser-settings popup (on entry or on stall). A song that stalled while the player wasn't watched
   (play_engine.js stallSubs) opens the error report instead, with the diagnostic log attached — once per load. */
const REPORT_STALL = "안 보는 동안 곡이 멈춤";
let stallShown = false;
SHELL.stallSubs.add(it => {
  if (stallShown || $("reportDlg").open) return;
  stallShown = true;
  openReport({kind: REPORT_STALL, it, text: "플레이어를 안 보는 동안 다음 곡이 재생되지 않고 멈춰 있었습니다.", diag: playerDiag().split("\n").slice(-120).join("\n")});
});
cleanups.push(() => SHELL.stallSubs.clear());
/* 다른 곡 고르기: 이 플레이어가 아는 곡 (우리 곡·재생목록·찾아본 곡) 먼저, 그다음 VocaDB 검색 (곡 검색 창과 같은 곳) */
let reportSeq = 0;
$("reportQ").addEventListener("input", () => {
  if (reportReq()) { reportCanSend(); return; }  // request: the box is the song name, no search
  const raw = $("reportQ").value.trim(), seq = ++reportSeq;
  const show = (hits, more) => {
    $("reportList").innerHTML = hits.map((it, i) => `<div class="ri" data-i="${i}"><b>${esc(it.title)}</b> <span class="hint">${esc(shortName(it.artist || ""))}${it.deleted ? " · 삭제됨" : ""}${it.api ? " · VocaDB" : ""}</span></div>`).join("")
      + (more ? '<div class="hint">우리 DB 에서 찾는 중…</div>' : "") || (raw ? '<div class="hint">맞는 곡이 없습니다</div>' : "");
    $("reportList").onclick = e => { const r = e.target.closest(".ri"); if (!r) return; setReportSong(LOCAL.remember(hits[+r.dataset.i])); $("reportQ").value = ""; $("reportList").innerHTML = ""; };
  };
  const local = raw ? allItems().filter(it => FKIND.text[1](it, fold(raw))).slice(0, 20) : [];
  show(local, !!raw && ONLINE);
  if (!raw || !ONLINE) return;
  clearTimeout(reportFind.timer);
  reportFind.timer = setTimeout(() => findSongs(raw, local).then(hits => { if (seq === reportSeq) show(hits, false); }), 400);
});
const reportFind = {timer: 0};
$("reportCancel").onclick = () => $("reportDlg").close();
$("reportSend").onclick = async () => {
  const it = reportReq() ? null : reportIt, req = reportReq() ? $("reportQ").value.trim() : "";
  if (!it && !req) return;
  // user request: reporting a deleted song is allowed, but ask first
  if (it && it.deleted && !await uiConfirm("해당 곡은 삭제됐습니다. 신고하시겠습니까?", "예")) return;
  const playing = it && SHELL.now && keyOf(SHELL.now) === keyOf(it);
  $("reportSend").disabled = true;
  try {
    await post("/api/report", {kind: $("reportKind").value, text: $("reportText").value, who: $("reportWho").value.trim(), request: req,
      song: it ? {site: it.site, name: it.name, title: it.title, artist: it.artist || "", ...(it.vocadb ? {vocadb: String(it.vocadb)} : {})} : null,  // VocaDB id: the song's key from now on
      pos: playing ? Math.round(audio.currentTime * 10) / 10 : null, source: playing ? audio.src : "",
      diag: $("reportKind").value === REPORT_STALL ? reportDiag : ""});
  } catch (e) { reportCanSend(); uiAlert(e.message); return; }
  $("reportDlg").close();
  uiAlert("신고를 보냈습니다. 고맙습니다!");
};

/* ================= 재생목록 칸 접기 / 펴기 (상태 기억) ================= */
function setListOpen(open) {
  document.querySelector(".app").classList.toggle("nolist", !open);
  $("btnList").classList.toggle("on", !open);
  $("btnList").title = open ? "재생목록 접기" : "재생목록 펴기";
  store.set("listOpen", open);
}
$("btnList").onclick = () => setListOpen(document.querySelector(".app").classList.contains("nolist"));
setListOpen(store.get("listOpen", true));

/* ================= 썸네일: 누르면 크게, 오른쪽 클릭하면 저장 ================= */
$("nowCover").onclick = () => { if (!cur || !hasCover(cur)) return; $("coverBig").src = coverUrl(cur); $("coverDlg").showModal(); };
$("coverDlg").onclick = () => $("coverDlg").close();
function saveCover(e) {
  e.preventDefault();
  if (!cur || !hasCover(cur)) return;
  const png = false;  // 썸네일은 jpg 로 저장해 둠
  const a = Object.assign(document.createElement("a"), {href: coverUrl(cur), download: `${(cur.title || "썸네일").replace(/[\\/:*?"<>|]/g, "_")}.${png ? "png" : "jpg"}`});
  document.body.appendChild(a); a.click(); a.remove();
}
$("nowCover").addEventListener("contextmenu", saveCover);
$("coverBig").addEventListener("contextmenu", saveCover);

/* ================= 서버 없이 연 화면: 우리 곡·가사·싱크를 어디서 읽을지 (깃허브 또는 Server\data 폴더) =================
   지난번 것(깃허브 토큰·폴더 권한)이 그대로 열리면 바로, 아니면 팝업 — 제대로 열릴 때까지 닫히지 않음 (Esc·바깥 눌러도) */
/* 화면 가운데 로딩 막대 (깃허브·폴더에서 우리 곡을 읽는 동안): 단계 글 + 막대 (얼마나 남았는지 모르면 흐르는 막대) */
function showLoad(label, frac) {
  let b = $("loadBox");
  if (!b) {
    b = Object.assign(document.createElement("div"), {id: "loadBox"});
    b.innerHTML = '<div class="lb"><div class="lt">불러오는 중…</div><div class="lbar"><i></i></div><div class="ls"></div></div>';
    document.body.appendChild(b);
  }
  b.hidden = false;
  b.querySelector(".lt").textContent = label;
  const bar = b.querySelector(".lbar");
  bar.classList.toggle("busy", frac == null);
  if (frac != null) bar.firstChild.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + "%";
  b.querySelector(".ls").textContent = LOCAL.gh ? `깃허브 · ${LOCAL.gh.repo}` : LOCAL.dir ? `폴더 · ${LOCAL.dir.name}` : "서버 없이 연 플레이어";
  const e = document.querySelector("dialog.offdlg[open] #offErr");  // 열기 팝업이 떠 있으면 팝업 안에도
  if (e) e.textContent = label;
}
function hideLoad() { if ($("loadBox")) $("loadBox").hidden = true; }
LOCAL.progress = showLoad;
async function offlineOpened() {
  showLoad("여는 중…", 0.1);
  LOCAL.ovReopen();  // 이 브라우저에서 오버레이를 쓴 적이 있으면 바로 오버레이와 주고받음
  await loadLibrary();
  $("notice").innerHTML = `<div class="offnote">${LOCAL.gh ? "☁" : "📁"} <b>${esc(LOCAL.name)}</b> · 서버 없이 재생 중`
    + (LOCAL.gh && !LOCAL.gh.write ? " · 읽기만 (저장 안 됨)" : "") + ` (음원 관리·자동 싱크는 서버 필요)</div>`;  // no '다른 토큰으로 열기' (user request 2026-11-14: one token per user — a token that stops working brings the box back by itself)
  // tab reloaded while a song played (e.g. the browser reloaded it by itself) → go on playing it from there; else show the last song paused
  const res = SHELL.takeResume(), find = k => SHELL.queue.find(x => keyOf(x) === k) || LOCAL.items.get(k);
  const rit = res && find(res.k), it = rit && canPlay(rit) ? rit : find(store.get("last", ""));
  showLoad("재생목록 여는 중…", 1);
  if (it && canPlay(it) && !SHELL.now) { if (it === rit) SHELL.resumeAt(it, res.t); play(it, it === rit, ""); }
  setTimeout(hideLoad, 150);
}
async function offlineIntro() {
  const gh = LOCAL.savedGitHub();
  showLoad("여는 중…", 0);
  if (gh) {  // 지난번에 깃허브에서 열었으면 그대로 (토큰이 만료됐으면 팝업에 까닭)
    try { await LOCAL.useGitHub(gh.repo, gh.token); return offlineOpened(); } catch (e) { return offlineDialog(e.message); }
  }
  const saved = await LOCAL.saved();  // 브라우저 저장소를 못 쓰면 없음
  if (saved) {  // 지난번 폴더: 권한이 남아 있으면 바로 (없으면 팝업의 단추를 한 번 눌러 허락 — 브라우저가 누를 때만 물어볼 수 있음)
    try { await LOCAL.reopen(saved, false); return offlineOpened(); } catch (e) {}
  }
  hideLoad();
  offlineDialog();
}
/* 처음 화면: 깃허브 토큰 입력만 (user request — repo field, Server\data folder and mp3-folder choices removed;
   offline mp3 folder is connected from the list after switching to offline). Repo = last one used or the default.
   Nothing open yet → can't be closed until a token opens. Already open ('다른 토큰으로 열기') → 취소 · Esc close it and the
   player stays as it was (user request 2026-11-14: the box wouldn't go away). */
async function offlineDialog(err = "") {
  hideLoad();
  const gh = LOCAL.savedGitHub(), repo = (gh || {}).repo || "AILEE126/music_backend", cancelable = LOCAL.ready;
  document.querySelector("dialog.offdlg")?.remove();
  const d = document.createElement("dialog");
  d.className = "uidlg offdlg";
  d.innerHTML = `<div class="dlg-body"><b>깃허브 토큰을 넣어 주세요</b> <span class="muted">(받은 토큰 — 우리 곡의 노래방 번호·가사·싱크를 읽음 · 곡 검색은 VocaDB)</span>
      <div class="ghform"><input type="password" id="ghToken" placeholder="깃허브 토큰 (github_pat_…)" autocomplete="off">
        <button class="primary" id="ghOpen">열기</button>${cancelable ? '<button id="ghCancel" title="지금 열린 그대로 (Esc)">취소</button>' : ""}</div>
    <div class="offerr" id="offErr"></div></div>`;
  const q = sel => d.querySelector(sel), btns = () => d.querySelectorAll("button");
  const showErr = m => { q("#offErr").textContent = m; };
  showErr(err);
  let done = false;
  d.addEventListener("cancel", e => { if (!cancelable) e.preventDefault(); });  // Esc: closes only when something is open already
  d.addEventListener("close", () => { if (done) return; if (cancelable) d.remove(); else d.showModal(); });  // first open: comes back until a token opens
  if (cancelable) q("#ghCancel").onclick = () => { done = true; d.close(); d.remove(); };
  const tryOpen = async open => {
    showErr(""); btns().forEach(b => b.disabled = true); q("#offErr").textContent = "여는 중…";
    try { await open(); }
    catch (e) { showErr(e.name === "AbortError" ? "" : e.message); btns().forEach(b => b.disabled = false); return; }
    done = true; d.close(); d.remove();
    await offlineOpened();
  };
  q("#ghOpen").onclick = () => tryOpen(() => LOCAL.useGitHub(repo, q("#ghToken").value));
  q("#ghToken").onkeydown = e => { if (e.key === "Enter") q("#ghOpen").click(); };
  document.body.appendChild(d);
  d.showModal();
  q("#ghToken").focus();
}

/* ================= 가사 오버레이 (programs\WEB\tools\lyrics_overlay.bat — 파워쉘 창, 바탕 투명 · 어느 브라우저든) =================
   지금 곡·가사 묶음은 재생기(play_engine.js)가 알려 줌. ⚙ 는 오버레이 설정 창 (shared_screen_helpers.js) */
$("btnOverlaySet").onclick = e => { e.stopPropagation(); openOverlaySettings(); };
bindOverlayPower($("btnOverlayPower"));  // 오버레이 켜기/끄기 (켜짐 상태를 5초마다 봄)

/* ================= 키보드 ================= */
document.addEventListener("keydown", e => {
  if (e.target.closest("input[type=text],input[type=search],textarea,select") || $("lyrView").open || $("coverDlg").open || $("reportDlg").open || $("searchDlg").open || document.querySelector("dialog.uidlg[open]")) return;
  if (editing && (e.code === "Space" || e.key === "ArrowDown")) { e.preventDefault(); if (audio.paused) audio.play(); else stamp(); return; }
  if (editing && e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(0, cursor - 1); renderStamps(); return; }
  if (e.code === "Space") { e.preventDefault(); $("btnPlay").click(); }
  else if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  else if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
});

/* 가사 도구 줄 접기 · 펴기 (user request; remembered) */
function applyBar(fold) { document.body.classList.toggle("barfold", fold); $("btnBar").title = fold ? "가사 도구 펴기" : "가사 도구 접기"; }
applyBar(!!store.get("barFold", false));
$("btnBar").onclick = () => { const f = !document.body.classList.contains("barfold"); store.set("barFold", f); applyBar(f); };

/* ================= 시작 ================= */
(async () => {
  renderModes();
  cleanups.push(SHELL.subscribe(now => { renderModes(); showSong(now); }));
  cleanups.push(SHELL.lsubscribe(() => tick(true)));
  await offlineIntro();  // 우리 곡·가사를 어디서 읽을지 (지난번 것이 그대로 열리면 바로)
})();
