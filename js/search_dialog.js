/* 곡 검색 창 — 검색 실행 · 정렬 · 결과 목록 · 다른 창용 곡 찾기 (findSongs). 필터는 filter_panel.js.
   player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* ================= 곡 검색 창 (user request 2026-11-14) =================
   our DB only (export/db — the tables on GitHub; user request 2026-11-14: no VocaDB API, so every match can be played):
   전체 곡 (every collected song) · 노래방 곡만 · 가사·싱크 있는 곡. Results: ▶ play now · ＋ playlist · ⤵ next · 결과 모두 = every match */
const S = {items: [], q: ""};
const S_SCOPES = ["all", "kara", "ours"];
if (!S_SCOPES.includes(store.get("sScope", "all"))) store.set("sScope", "all");  // was 'vocadb' (VocaDB 전체)
$("sScope").value = store.get("sScope", $("sScope").value);
$("sScope").onchange = () => { store.set("sScope", $("sScope").value); renderFilterOptions(); runSearch(); };  // the sort: part of the filter (filter_editor.js)
/* the window first, the slow part after (user request 2026-11-15: building the song list took a while with nothing on
   screen) — a spinner over the window meanwhile, also while the song list is still being read (VDB.full) */
/* 준비 진행 (user request 2026-11-19: the spinner said '초기 한번만 불러와요' but it ran at every page load, with no sign of how
   far): one percent over the steps — song blocks (VDB.prog) half, then the search steps (warmStep) — shown under the spinner */
const WARM_STEPS = {items: [0, 10], long: [10, 15], family: [15, 30], rank: [30, 60], sort: [60, 68], filter: [68, 100]};
let warmAt = 0;
function warmStep(step, n = 0, total = 1) {
  const [a, b] = WARM_STEPS[step] || [100, 100];
  warmAt = a + (b - a) * Math.min(1, n / (total || 1));
  busyLabel();
}
const busyPct = () => VDB.done ? 50 + Math.round(warmAt / 2) : Math.round(loadPct() / 2);
function busyLabel() {
  const t = `${VDB.done ? "검색 준비 중" : "곡 목록 받는 중"}… ${busyPct()}%\n처음 열 때만 기다려요 (화면을 새로 열면 다시)`;
  document.querySelectorAll("dialog.busy").forEach(d => { d.dataset.busy = t; });
}
addEventListener("vdbprog", busyLabel);
function withBusy(dlg, work, ready = searchBase) {
  dlg.classList.add("busy");
  busyLabel();
  setTimeout(async () => {  // a moment to draw the window first
    try { await ready(); await work(); } finally { dlg.classList.remove("busy"); }
  }, 40);
}
/* the window opens fresh every time (user request 2026-11-18): no search text · 전체 곡 · 인기순 0번부터 1000곡 · 원곡만
   (노래방 모드: its preset) · filter panel open. A filter to keep goes in 저장된 필터 */
function searchReset() {
  closeDD(); closeFSet();
  $("sQ").value = "";
  store.set("sScope", "all"); $("sScope").value = "all";
  S.play = "";  // 재생가능 | 재생불가능 (admin): every song again — before FE.set draws the bar
  FE.set(null);  // 원곡만 · 인기순 0번부터 1000곡 (filter_editor.js)
  if (KARA.mode) FE.set(KARA.presetGroups());
  $("fPanel").hidden = false; store.set("sfOpen", true);
  S.items = []; $("sList").innerHTML = ""; $("sInfo").textContent = "";  // the last results don't show while the new search runs
}
function openSearch() {
  searchReset();
  $("searchDlg").showModal();
  $("sQ").focus();
  // the same preparation as the background one (warmSearch, shared — the first open used to do it a second time alongside)
  withBusy($("searchDlg"), async () => { renderFilterOptions(); runSearch(); }, warmSearch);  // categories: counted in warmSearch too
}
$("btnSearch").onclick = () => ONLINE ? openSearch() : openAddSongs();  // LOCAL: 곡 추가 (playlist_panel.js)
$("sClose").onclick = () => $("searchDlg").close();
$("searchDlg").addEventListener("click", e => { if (e.target === $("searchDlg")) $("searchDlg").close(); });  // outside the box
$("sGo").onclick = () => runSearch();
let sTimer = 0;
$("sQ").addEventListener("input", () => { clearTimeout(sTimer); sTimer = setTimeout(runSearch, 200); });  // as you type (local, no request)
/* 공식 여부 칩 (user request 2026-11-19: 중요한 태그 — 곡 검색 · 신고 · 신청곡 찾기에서 맨 앞, 반투명 바탕 색) — 하위 태그 색이
   있으면 그 색, 없으면 기본 색. 전체 곡이 다 읽히기 전엔 묶음을 모르므로 정해 둔 값만 (verOf) */
function verChipHtml(it) {
  const v = VDB.done ? verOf(it, VDB.all()) : verOf(it);
  if (!v) return "";
  const c = tagColor("ver", v);
  return `<span class="b ver ver-${VERS.indexOf(v)}"${c ? ` style="--vc:${esc(c)}"` : ""} title="공식 여부">${esc(v)}</span>`;
}
/* small song finder for the report dialog and the listen-together request box: the songs given (already known) first,
   then matches from our whole DB — no duplicates */
async function findSongs(q, known = [], max = 40) {
  const v = fold(q), seen = new Set(), out = [];
  // in steps — the whole DB in one go stalled the screen while typing
  if (v) { await searchBase(); await searchText(); }
  const db = v ? await topMatches(VDB.all(), it => FKIND.text[1](it, v), max) : [];
  for (const it of [...known, ...db]) if (!seen.has(keyOf(it))) { seen.add(keyOf(it)); out.push(it); }
  return out.slice(0, max);
}
/* the `max` most popular songs passing `f`, in one pass (user request 2026-11-19, sized for 1M songs: 'a' matched most songs and
   sorting them all took 5 s): a song that can't beat the last kept one isn't even tested; same order as a stable sort by rating */
async function topMatches(its, f, max) {
  const top = [];
  for (let i = 0; i < its.length; i++) {
    if (!(i & 16383)) await yieldUI();
    const it = its[i], r = it.rating || 0;
    if (top.length === max && r <= (top[max - 1].rating || 0)) continue;
    if (!f(it)) continue;
    let j = top.length;
    while (j > 0 && (top[j - 1].rating || 0) < r) j--;
    top.splice(j, 0, it);
    if (top.length > max) top.pop();
  }
  return top;
}
/* the scope's songs: 전체 곡 = our whole DB · 노래방 곡만 · 가사·싱크 있는 곡 = our songs —
   kept until the scope or the song data changes (same array → the categories · sorted order below are reused) */
let scopeMemo = {};
const scopeItems = () => {
  const sc = $("sScope").value, all = VDB.all(), cur = VDB.curated;
  if (scopeMemo.sc !== sc || scopeMemo.all !== all || scopeMemo.cur !== cur)
    scopeMemo = {sc, all, cur, its: sc === "kara" ? cur.filter(it => it.karaoke) : sc === "ours" ? cur.filter(it => !!(it.lyrics || it.sync)) : all};
  return scopeMemo.its;
};
/* 검색이 화면을 멈추지 않게 (user request 2026-11-16: 필터를 걸고 뺄 때마다 화면이 잠깐 멈춤 — 목록 칸에만 도는 표시):
   정렬은 범위·정렬이 바뀔 때만 (정렬해 둔 범위 곡을 거르면 순서가 그대로라 다시 정렬할 일 없음) · 카테고리도 범위가 바뀔 때만 ·
   거르기 · 정렬은 조금씩 나눠 하면서 화면에 차례를 넘김. 하는 사이 다시 바꾸면 하던 건 버림 (searchGen) */
const STALE = {};
let searchGen = 0, sortMemo = new WeakMap();  // scope songs → {key: sort, out: sorted}
/* give the screen a turn (input · drawing · the player's timers) — not setTimeout: clamped to 4 ms, and far slower in a hidden
   tab. Not scheduler.yield either (user request 2026-11-18, heat · lag): it puts the rest ahead of every other task, so a
   search or the 6 s warm-up held back the player's timers (lyrics · video box) — a posted message waits in line with them */
const yieldUI = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
function searchTick(gen) {
  let last = performance.now();
  return async () => {
    if (performance.now() - last > 12) { await yieldUI(); last = performance.now(); }
    if (gen !== searchGen) throw STALE;
  };
}
/* stable merge sort that yields (Array.sort of 14만 곡 by title takes about a second in one go) */
async function sortAsync(a, cmp, tick) {
  // runs of R sorted by the browser's own (stable) sort — ~4× quicker than ours, and a run takes only a few ms (2026-11-19,
  // sized for 1M songs); then merged in passes that give the screen its turn
  const n = a.length, R = 4096;
  let src = a.slice(), dst = new Array(n), ops = 0;  // ops: comparisons since the last tick
  for (let s = 0; s < n; s += R) {
    const run = src.slice(s, s + R).sort(cmp);
    for (let i = 0; i < run.length; i++) src[s + i] = run[i];
    await tick();
  }
  for (let w = R; w < n; w *= 2) {
    for (let s = 0; s < n; s += 2 * w) {
      const m = Math.min(s + w, n), e = Math.min(s + 2 * w, n);
      let i = s, j = m, k = s;
      while (i < m && j < e) { dst[k++] = cmp(src[j], src[i]) < 0 ? src[j++] : src[i++]; if (++ops > 2048) { ops = 0; await tick(); } }
      while (i < m) dst[k++] = src[i++];
      while (j < e) dst[k++] = src[j++];
    }
    [src, dst] = [dst, src];
  }
  return src;
}
/* the sorted scope — shared work (the background warm-up and a search wanting the same order wait for one sort, never two;
   a newer search doesn't throw it away). The caller's tick only checks for staleness afterwards */
async function sortedScope(tick, key = FE.sort) {
  const its = scopeItems(), m = sortMemo.get(its);
  if (!m || m.key !== key) {
    const p = (async () => await numSorted(its, key, bgTick()) || sortAsync(its, ourCmp(key), bgTick()))();  // numSorted: filter_panel.js
    sortMemo.set(its, {key, p});
    p.catch(() => sortMemo.delete(its));
  }
  const out = await sortMemo.get(its).p;
  if (tick) await tick();
  return out;
}
/* 필터 결과 재사용 (user request 2026-11-19, sized for 1M songs: every keystroke ran the whole filter again — ~2 s over 44만 곡,
   ~5 s at 1M — and every open ran the opening filter again): per sorted scope, the last few filter results by their groups; typing
   only filters that result by the text. Made by the warm-up for the opening filter, so the window opens on it at once */
/* 정렬만 바꿀 때 (user request 2026-11-22: changing the sort took long — the whole scope sorted, then filtered again): the kept
   result of the same filter is sorted instead — the same songs, usually far fewer, and the same order (every sort ends on the
   title place) */
const filtMemo = new WeakMap(), FILT_KEEP = 4;  // scope songs → Map(filter → {sort, out})
async function filteredScope(gs, tick) {
  const scope = scopeItems(), key = JSON.stringify(gs), sort = FE.sort;
  let m = filtMemo.get(scope);
  if (!m) filtMemo.set(scope, m = new Map());
  const had = m.get(key);
  if (had && had.sort === sort) { m.delete(key); m.set(key, had); return had.out; }  // newest last
  // 신고 들어온 순 (filter_panel.js repAt): the reports change while the scope stays — the few songs found are sorted, not the scope
  const out = had ? await numSorted(had.out, sort, tick) || await sortAsync(had.out, ourCmp(sort), tick)
    : sort === "report" ? await sortAsync(await filterGroupsAsync(await sortedScope(tick, "RatingScore"), gs, tick), ourCmp(sort), tick)
    : await filterGroupsAsync(await sortedScope(tick), gs, tick);
  if (sort === "report") return out;
  if (key.includes('"k":"report"')) return out;  // 오류 신고 changes while the scope stays (admin_tools.js) — not kept
  m.delete(key); m.set(key, {sort, out});
  if (m.size > FILT_KEEP) m.delete(m.keys().next().value);
  return out;
}
const playN = new WeakMap();  // result list → how many can be played (counted once per list)
async function playableCount(its, tick) {
  if (!playN.has(its)) playN.set(its, (await chunkFilter(its, playableFast, tick)).length);
  return playN.get(its);
}
/* 재생 가능 세기: 곡마다 영상 주소 풀이는 한 번만 (deleted 는 그때그때) */
// kept on the song (_pn), not in a WeakMap — 1M entries there cost far more room (2026-11-19); our DB's songs keep it in VSong.q
const playableFast = it => it.site !== "stream" ? canPlay(it) : (it._pn ?? (it._pn = streamRefs(it).length)) > 0;
/* 목록 칸의 도는 표시 — 금방 끝나면 안 보이게 조금 뒤에 */
let busyTimer = 0;
function listBusy(on) {
  const b = $("sBusy"); if (!b) return;  // page from before the 2026-11-16 html (cached) — no marker, search still works
  clearTimeout(busyTimer);
  if (on) busyTimer = setTimeout(() => { b.hidden = false; }, 120); else b.hidden = true;
}
/* keep: stay where the list is (user request 2026-11-14: a song action — e.g. '현재 필터에 추가' — never jumps to the top) */
async function runSearch(keep) {
  const gen = ++searchGen, tick = searchTick(gen);
  listBusy(true);
  await searchBase();  // typed before the song list was all read
  const q = $("sQ").value.trim(), v = fold(q);
  S.q = q;
  try {
    let its = await filteredScope(FE.live(), tick);
    if (v) { await searchText(); await tick(); its = await chunkFilter(its, it => FKIND.text[1](it, v), tick); }  // searchText: filter_panel.js
    // 범위 (user request 2026-11-22: the filter's 'n번부터 n곡' — part of the filter, so the result itself is that range)
    const total = its.length, cut = FE.from > 0 || FE.n > 0;
    if (cut) its = its.slice(FE.from, FE.n > 0 ? FE.from + FE.n : undefined);
    const nPlay = await playableCount(its, tick);
    // 재생가능 | 재생불가능 (admin, filter_panel.js fPlayBtn): of the result above, only those
    const all = its.length;
    if (S.play) its = await chunkFilter(its, it => playableFast(it) === (S.play === "ok"), tick);
    S.items = its;
    if (!keep) $("sList").scrollTop = 0;
    // 검색결과 N곡 · 재생 가능 M곡 (user request 2026-11-15: songs without a video are found but can't go in the playlist)
    renderSearch(`검색결과 ${all.toLocaleString()}곡${cut ? ` (맞는 곡 ${total.toLocaleString()}곡 중 ${filterRange(FE.filter())})` : ""} · 재생 가능 ${nPlay.toLocaleString()}곡`
      + (S.play ? ` · ${S.play === "ok" ? "재생 가능" : "재생 불가능"}만 보기 ${its.length.toLocaleString()}곡` : "") + (q ? ` — "${q}"` : ""));
  } catch (e) { if (e !== STALE) throw e; }
  finally { if (gen === searchGen) listBusy(false); }
}
/* 걸린 필터 조건 (user request 2026-11-23: which filter condition brought a song in wasn't visible): per result, the values it
   matched — only where it tells something: a condition with several values (which one) or, with several 포함 groups, the
   matched group's conditions. One-value conditions of a single group match every result → not shown.
   User request 2026-11-23: 원곡만's conditions as one '원곡만' chip (it is one switch; also hidden in a single group), and
   the chips in the tag row left of the 투고일 — a row of their own made each song up to 4 lines tall */
function sMatchHtml(it, gs) {
  const inc = gs.filter(g => !g.x && g.c.some(c => FKIND[c.k] && !SAME_KEYS.includes(c.k)));
  const out = [];
  for (const g of inc) {
    if (!g.c.every(c => matchCond(it, c))) continue;
    const part = [], di = new Set(FE.defIdx(g) || []);
    if (di.size && inc.length > 1) part.push(`<span class="fmc" title="원곡만">${F_DEF_SVG} 원곡만</span>`);
    for (const [j, c] of g.c.entries()) {
      if (di.has(j) || !FKIND[c.k] || SAME_KEYS.includes(c.k) || c.k === "text") continue;
      const vs = Array.isArray(c.v) ? c.v : [c.v];
      if (vs.length < 2 && inc.length < 2) continue;
      for (const v of vs.filter(v => matchCond(it, {k: c.k, v})))
        part.push(`<span class="fmc" title="${esc(chipKind({k: c.k, v}))}">${esc(catIcon(chipKind({k: c.k, v})))} ${esc(oneLabel(c.k, v))}</span>`);
    }
    if (part.length) out.push(part.join(""));
  }
  return out.length ? `<span class="fm" title="이 곡이 걸린 필터 조건">${out.join('<span class="fmor">또는</span>')}</span>` : "";
}
function renderSearch(info) {
  const st = $("sList").scrollTop;  // runSearch already put it at 0 when it should go to the top
  $("sInfo").textContent = info;
  $("sMakePl").disabled = !S.items.some(canPlay);
  const inPl = new Set(SHELL.queue.map(keyOf)), show = S.items.slice(0, 300), inF = new Set(fSongIds()), gs = FE.live();
  $("sList").innerHTML = show.map((it, i) => {
    // no karaoke numbers in the results (user request 2026-11-15: 노래방 모드 shows them)
    // 곡 종류 — 하위 태그 색이 있으면 그 색 (보컬 인원수 칩은 2026-11-22 뺌, user request)
    // 가사 · 싱크 상태: the playlist's badges on the right, left of ✓ and ⋮ (user request 2026-11-22: 재생목록에 넣었을 때처럼)
    // 공식 여부: 맨 앞 칩 (verChipHtml)
    const tk = it.type ? VDB_TYPE_KO[it.type] || it.type : "";
    return `<div class="sitem${canPlay(it) ? "" : " gone"}" data-i="${i}">${coverHtml(it, "thumb")}
      <div class="meta"><div class="t">${titleHtml(it)}</div>
        <div class="a">${artistVocHtml(it)}</div>
        <div class="tags">${verChipHtml(it)}${tk ? tagChipHtml("type", tk, tk, "", "곡 종류") : ""}${sMatchHtml(it, gs)}${it.date ? `<span class="d">${esc(it.date)}</span>` : ""}</div></div>
      <div class="badges">${badgesHtml(it)}</div>
      <div class="sacts">${inPl.has(keyOf(it)) ? `<span class="sin" title="재생목록에 있는 곡">✓</span>` : ""}${inF.has(songId(it)) ? `<span class="sin f" title="필터에 넣은 곡">${FILT_SVG}</span>` : ""}`
        + `<button class="ib smore" data-a="more" title="곡 옵션" aria-label="곡 옵션">${MORE_SVG}</button></div></div>`;
  }).join("") + (S.items.length > show.length ? `<div class="hint">… ${(S.items.length - show.length).toLocaleString()}곡 더 ('재생목록 만들기' 는 이 곡들까지 넣음)</div>` : "")
    || `<div class="empty">맞는 곡이 없습니다.</div>`;
  $("sList").scrollTop = st;
}
