/* 곡 검색 창의 필터 — 편집기(그룹·조건 칩 · 카테고리 단추 · 값 목록 · 원곡만 · 고급)는 filter_editor.js (음원 관리와 같은 코드) ·
   여기는 이 창의 몫: 카테고리 세기 · 곡 조건 · 검색 칸 제안 · 프리셋·저장된 필터 · 검색 준비 (warmSearch) · 재생목록에 걸린 필터 표시.
   판정·카테고리는 song_filter.js (음원 관리와 같이 씀). player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* 고를 값의 곡: 그 범위의 곡 (곡 수도 그 범위 기준) */
const sfItems = scopeItems;
/* the filter is not kept in the browser (user request 2026-11-18): the search window opens fresh every time (searchReset) —
   a filter to keep goes in 저장된 필터. It opens on 원곡만 · 인기순 0번부터 1000곡 (filter_editor.js — the server's 기본 필터 is gone,
   user request 2026-11-22) */
/* the 오류 신고 kinds of the 포함 groups (fRepWas: any at the last draw) */
let fRepWas = false;
const fRepKinds = () => FE.live().flatMap(g => g.x ? [] : g.c.filter(c => c.k === "report").flatMap(c => [].concat(c.v)));
const fRep = () => fRepKinds().length > 0;
const FE = makeFilterEditor({
  chips: $("fChips"), panel: $("fPanel"), key: "f.",
  // categories not counted yet (user request 2026-11-19: counting 1M songs held the window ~6 s — results come first): the
  // chips draw now, the category row says so and fills in when counted (catsLater)
  cats() {
    if (!VDB.done) return null;  // the categories come from the whole song list
    const its = sfItems();
    if (!catsReady(its)) { catsLater(); return null; }
    return sfCatsMemo(its);
  },
  // the category names are known before any counting (filter.json cats, in 음원 관리 › 필터 order) — user request 2026-11-22
  catNames: () => VDB.filter && VDB.filter.cats && VDB.filter.cats.filter(c => c.id !== "state").slice().sort((a, b) => a.p - b.p).map(c => ({id: c.id, label: c.label})),
  icon: c => catIconOf(c),
  // 더보기 (user request 2026-11-22): 음원 관리 › 필터 카테고리 순서에서 '기본 표시'를 끈 카테고리 · the list doesn't have (오류 신고) too
  more: c => { const f = fltCat(c.id); return VDB.filter && VDB.filter.cats ? !f || !!f.more : c.id === "report"; },
  sortBox: $("sSortBox"),  // 정렬 · 몇 번째부터 · 몇 곡 — in the result row, seen with the filter folded too
  keepSort: true,  // a filter saved without them (before 2026-11-22) leaves the window's sort and range as they are
  chipKind, chipLabel, oneLabel,
  condCat: c => c.k === "solo" ? "singer" : c.k === "tag" ? "tag:" + tagGroupOf(firstV(c)) : c.k,
  known: c => !!FKIND[c.k],
  popParent: () => $("searchDlg"),  // inside the dialog (top layer) so it shows above it
  onChange: keep => runSearch(keep),
  // 오류 신고 put in → 신고 들어온 순 (user request 2026-11-23: 싱크 수정, then every kind); taken out → back to 인기순
  sortAuto: s => { const on = fRep(); return on && !fRepWas ? "report" : !on && s === "report" ? "RatingScore" : null; },
  sortOk: k => k !== "report" || fRep(),
  fold: () => setFilterOpen(false),
  afterRender() {
    fRepWas = fRep();
    const n = FE.picked();  // 원곡만 스위치 말고 고른 조건 수
    $("btnFilter").classList.toggle("on", !!n);
    $("btnFilter").classList.toggle("open", !$("fPanel").hidden);
    $("btnFilter").querySelector(".cnt").textContent = n || "";
  },
});
const fDefault = FE.def, fReal = FE.real, renderFilterOptions = FE.render, closeDD = FE.closeDD, placePop = filterPlacePop;
samePlayable = it => canPlay(it);  // 같은 곡 정렬 '재생 가능' = 재생목록에 넣을 수 있는 곡
/* 곡 조건 (user request 2026-11-14: 검색 결과의 '현재 필터에 추가'): 지금 결과에 이 곡'도' 더함 — 곡만 모은 포함 그룹 하나
   (곡 조건 — 예전에 저장한 것은 곡 종류도, 그룹끼리는 또는)에 VocaDB 번호를 모음. 선택된 그룹에 넣으면 결과가 그 곡으로 좁혀져 목록이 줄어들기 때문
   (user report: 누르니 목록이 맨 위로). 그 곡의 종류가 그룹의 곡 종류에 없으면 더함. 이미 든 곡은 다시 누르면 뺌 (다 빠지면 그룹도) */
function songGroup() { return FE.groups.find(g => !g.x && g.c.some(c => c.k === "song") && g.c.every(c => c.k === "song" || c.k === "type")); }
function songId(it) { return String(it.vocadb || it.name); }
var FILT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 5h12l-5 6v5l-3 2v-7z"/><path d="M18 12v8M14 16h8"/></svg>';
function fSongIds() { const g = songGroup(), c = g && g.c.find(c => c.k === "song"); return c ? [].concat(c.v) : []; }
function toggleSongCond(it) {
  FE.ensure();
  const id = songId(it), ty = VDB_TYPE_KO[it.type] || it.type;
  let g = songGroup();
  if (!g) { g = {x: false, m: true, c: []}; FE.groups.push(g); }  // 곡 종류 없이 (user request 2026-11-23)
  FE.groups.forEach(x => { x.m = true; });  // 버튼 없이 고른 조건도 그룹으로 남김 (다음 조건을 골라도 지워지지 않게)
  let c = g.c.find(c => c.k === "song");
  if (c && [].concat(c.v).includes(id)) {
    c.v = [].concat(c.v).filter(x => x !== id);
    if (!c.v.length) { FE.groups.splice(FE.groups.indexOf(g), 1); FE.cur = Math.min(FE.cur, FE.groups.length - 1); }
  } else {
    if (!c) g.c.push(c = {k: "song", v: []});
    c.v = [...[].concat(c.v), id];
    const t = g.c.find(c => c.k === "type");
    if (t && ty && ![].concat(t.v).includes(ty)) t.v = [...[].concat(t.v), ty];
  }
  FE.changed(true);  // a song action: the result list stays where it is
}
function setFilterOpen(open) {
  if (!open) { closeDD(); FE.prune(); }  // 접을 때: 아직 빈 그룹(곡 종류만 든 그룹 — 첫 그룹 말고)은 지움
  else FE.ensure();
  $("fPanel").hidden = !open; store.set("sfOpen", open); FE.render();
}
$("btnFilter").onclick = () => setFilterOpen($("fPanel").hidden);
$("fPanel").hidden = !store.get("sfOpen", true);  // in the search popup: open unless folded there (user request 2026-11-14)

/* 검색창도 펼친 목록처럼: 글자를 치면 바로 아래에 '"…" 검색' + 이름이 맞는 보컬·프로듀서·태그 등 (우리 곡 수와 함께)
   첫 줄(Enter)은 검색, 다른 줄을 누르거나 ↑↓ 로 골라 Enter → 그 조건을 필터에 더함. Esc·바깥 누르기로 닫힘 */
var qHl = 0;
function qOpts() {
  const raw = $("sQ").value.trim(), v = fold(raw); if (!v) return [];
  const out = [{k: "text", v, label: `"${raw}" 검색 (Enter)`, n: "", grp: "검색"}];
  for (const c of FE.cats) for (const [val, cnt] of c.rows)
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
  if (o.k === "solo" || (o.k === "singer" && FE.solo)) o = {...o, k: "solo"};
  FE.addChip(o.k, o.v);
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
/* 긴 버전 (user request 2026-11-17): a song tagged 'extended version' / 'full version' whose original (origId) is a
   'short version' counts as that original's type here — Tell Your World's full song is VocaDB Remix 8395 of the 61 s
   Original CM, so 곡 종류 오리지널 + 같은 곡 정렬 '긴 버전 먼저' picks the full song. Set once per song (longVersionTypes) */
FKIND.type = ["곡 종류", (it, v) => (VDB_TYPE_KO[it.typeAs || it.type] || it.typeAs || it.type) === v];
FONE.type = it => VDB_TYPE_KO[it.typeAs || it.type] || it.typeAs || it.type;  // several 곡 종류 picked: one lookup (song_filter.js matchCond)
const LONG_TAGS = ["extended version", "full version"];
// the original found by VDB.itemById, the songs' own map (2026-11-23: a new 98만-entry map here took ~1 s); its own tags first
async function longVersionTypes(all, tick) {
  for (let i = 0; i < all.length; i++) {
    const it = all[i];
    if (it.origId && (it.tags || []).some(t => LONG_TAGS.includes(t)) && !isShortVer(it)) { const o = VDB.itemById(it.origId); if (o && isShortVer(o)) it.typeAs = o.type; }
    if (!(i & 4095)) await tick();
  }
}
/* filter categories: the scope's songs (with counts) + 곡 종류 */
function sfCats(its, base = filterCats(its, true), types = countBy(its.map(it => it.type ? [VDB_TYPE_KO[it.type] || it.type] : []))) {
  // 가사·싱크 상태 is replaced by 곡 상태 here (user request 2026-11-15 — 싱크 · 가사 유무 · 번역명 as tags)
  const cats = base.filter(c => c.id !== "state");
  if (types.length) cats.push({id: "type", label: "곡 종류", k: "type", rows: types, lab: x => x});
  cats.push(...sameCats());  // 같은 곡 정렬 · 자르기 (user request 2026-11-16)
  const p = id => (fltCat(id) || {p: 1e9}).p;  // 음원 관리 › 필터의 순서 (없으면 가나다순)
  return cats.sort((a, b) => p(a.id) - p(b.id) || a.label.localeCompare(b.label, "ko"));
}
/* categories only change with the scope's songs (not with the filter) — counted once, copies handed out (the caller changes rows) */
let catMemo = new WeakMap();
function sfCatsMemo(its) {
  let m = catMemo.get(its);
  if (!m || m.f !== VDB.filter || m.m !== VDB.master) catMemo.set(its, m = {f: VDB.filter, m: VDB.master, cats: sfCats(its)});
  return m.cats.map(c => ({...c}));
}
/* the scope's categories counted in steps (sfCatsMemo would count them in one go) */
const catsReady = its => { const m = catMemo.get(its); return !!m && m.f === VDB.filter && m.m === VDB.master; };
let catsP = null;
function catsLater() {  // the scope's categories in the background, then the filter options drawn again
  if (catsP || !VDB.done) return;
  catsP = warmCats(bgTick()).finally(() => { catsP = null; if ($("searchDlg").open && catsReady(sfItems())) renderFilterOptions(); });
}
async function warmCats(tick) {
  const its = scopeItems(), m = catMemo.get(its);
  if (!m || m.f !== VDB.filter || m.m !== VDB.master) catMemo.set(its, {f: VDB.filter, m: VDB.master, cats: sfCats(its, await filterCatsAsync(its, true, tick))});
}
/* in the background once the song list is read (user request 2026-11-18 — was on the loading screen): make every item, the
   song families, the categories (about a second over 14만 곡, the one step that can't be split) and the sorted scope, so
   opening the search window later never stalls the screen (user request 2026-11-16, phones too) */
const bgTick = () => { let last = performance.now(); return async () => { if (performance.now() - last > 12) { await yieldUI(); last = performance.now(); } }; };
/* what every search needs first: every item + the long versions' type — made once (searches opened early wait for it) */
let baseP = null;
const searchBase = () => baseP || (baseP = (async () => {
  const tick = bgTick();
  await VDB.full;
  await VDB.makeAll(tick, (n, total) => warmStep("items", n, total));
  warmStep("long");
  await longVersionTypes(VDB.all(), tick);  // 숏버전 원곡의 긴 버전은 원곡의 곡 종류로
})());
/* the search window's preparation, once (the background run after loading and an early open share it — user request
   2026-11-19: the first open did it again alongside, 17–23 s): families · categories · the sorted scope · the window's opening
   result (원곡만, 인기순, 전체 곡 — searchReset's state) · then every song's search text, so the first keystroke is quick */
let warmP = null;
const warmSearch = () => warmP || (warmP = (async () => {
  const tick = bgTick();
  await searchBase();
  const all = VDB.all();
  if (!$("searchDlg").open) searchReset();  // the state the window opens in
  // 같은 곡 묶음 · 공식 여부 (song_filter.js) — once per song. The filter's categories are counted in the same pass (user request
  // 2026-11-22: not a step of their own after the songs — counted after everything, '카테고리 세는 중…' stayed long)
  // 2026-11-23 (user request — phones waited long here): counted by the server (VDB.cats) when it is of this list — then only
  // 오류 신고 (admin players) is counted here, and the songs aren't gone through at all
  const sc = VDB.cats, cnt = catsReady(all) ? null : filterCatsCounter(true, sc), cf = VDB.filter, cm = VDB.master;
  if (sc) {
    if (cnt && typeof ADM !== "undefined") for (const vid of ADM.byVid.keys()) { const it = VDB.itemById(vid); if (it) for (const r of reportKindsOf(it)) cnt.inc("report", r); }
  } else for (let i = 0; i < all.length; i++) { verOf(all[i], all); if (cnt) cnt.add(all[i]); if (!(i & 1023)) { warmStep("family", i, all.length); await tick(); } }
  if (cnt) {
    const types = new Map();  // the server sends VocaDB's type — named here as sfCats does
    if (sc) for (const [t, n] of Object.entries(sc.type || {})) { const k = VDB_TYPE_KO[t] || t; types.set(k, (types.get(k) || 0) + n); }
    catMemo.set(all, {f: cf, m: cm, cats: sc ? sfCats(all, cnt.done(), sortCounts(types)) : sfCats(all, cnt.done())});
  }
  warmStep("rank");
  // title places: kept from today's list, else made in the worker (the screen free meanwhile) — every sort below needs them
  if (!await titleRanksKept(all, tick)) await titleRanks(all, tick);
  warmStep("sort");
  await sortedScope();
  warmStep("filter");
  // the window's filter (opened meanwhile: it waits for this, so it's the same). Its 재생 가능 count is no longer made here
  // (~8 s at 1M): the window shows only its range of the result (0번부터 1000곡) and counts that
  await filteredScope(FE.live(), tick);
  warmStep("done");
  // every song's search text, after the window is ready (user request 2026-11-19: ~7 s at 1M) — a search typed before it's done
  // waits for it (the list's spinner) — one maker, not two at once (that doubled it: 13 s). Not waited for here
  hayP = (async () => { for (let i = 0; i < all.length; i++) { searchHay(all[i]); if (!(i & 2047)) await tick(); } })();
  // then the values the most used filters test (user request 2026-11-23 — 노래방 · 프로듀서 · 보컬 · 보컬 인원수 · 곡 종류): each is
  // worked out once per song when first asked (vocadb_api.js VSong.q …) — here, so the first pick of one doesn't wait ~2 s for it
  hayP.then(async () => { for (let i = 0; i < all.length; i++) { filterValues(all[i]); if (!(i & 2047)) await tick(); } });
})());
const filterValues = it => { it._singers; it._vsingers; it._composers; it._ktags; it.type; it.vkind; it._year; it._ver; it._ini; it.flags; };
let hayP = null;  // every song's search text being made (warmSearch) — a text search waits for it (searchText)
const searchText = () => hayP || Promise.resolve();
/* 음원 관리 › 필터 (user request 2026-11-14 — export/db/filter.json): a category's row {id, label, icon, p} · its symbol */
const fltCat = id => VDB.filter && (VDB.filter.cats || []).find(c => c.id === id);
const catIconOf = x => { const f = fltCat(x.id); return f && f.icon ? f.icon + "︎" : catIcon(x.label); };
/* 하위 태그 색 (user request 2026-11-15 — 음원 관리 › 필터 › 하위 태그 색, filter.json tags {cat_id: {value: color}}) — none: built-in look */
const tagColor = (cat, v) => VDB.filter && VDB.filter.tags && (VDB.filter.tags[cat] || {})[v] || "";
/* a chip in the tag's color (the karaoke-number look) · no color → plain chip (cls: its built-in class) */
const tagChipHtml = (cat, v, text, cls = "", title = "", attrs = "") => { const c = tagColor(cat, v);  // attrs: 정보 카드 (artist_card.js cardAttrs)
  return `<span class="b${cls ? " " + cls : ""}${c ? " tc" : ""}${attrs ? " icard" : ""}"${c ? ` style="--tc:${esc(c)}"` : ""}${title ? ` title="${esc(title)}"` : ""}${attrs}>${esc(text)}</span>`; };
/* 태그 → 분류 (song_filter.js tagGroupOf): master tag rows keep VocaDB's category — remade when master is read again */
let tagCats = {of: null, map: new Map()};
/* 곡 조건의 값(VocaDB 번호) → 제목 (song_filter.js songTitleOf) */
songTitleOf = v => { const it = VDB.itemById(v); return it ? titleOf(it) : `곡 ${v}`; };
tagGroupOf = v => {
  if (tagCats.of !== VDB.master) tagCats = {of: VDB.master, map: new Map((VDB.master.tag || []).map(t => [t.name, TAG_CAT_KO[t.cat] || t.cat || ""]))};
  return tagCats.map.get(v) || "";
};
/* VocaDB tag categories (master tag rows keep VocaDB's) → Korean labels for the filter */
const TAG_CAT_KO = {Genres: "장르", Themes: "테마", Subjective: "분위기", Instruments: "악기", Composition: "곡 구성", Vocalists: "보컬 관련",
  Copyrights: "원작", Series: "시리즈", Animation: "애니메이션", Games: "게임", "MMD models": "MMD 모델", Sources: "출처", Distribution: "배포",
  "Editor notes": "편집 메모", "Synthesizer engines": "음성 합성 엔진", Lyrics: "가사", Derivative: "2차 창작", Design: "디자인", Events: "이벤트",
  Media: "매체", Jobs: "역할", Languages: "언어"};
/* 곡 정렬: F_SORTS (filter_editor.js — the sort is part of the filter, drawn by the editor) */
const titleGroup = t => { const c = (t || "").trim()[0] || ""; return /[가-힣ㄱ-ㅣ]/.test(c) ? 0 : /\d/.test(c) ? 1 : /[a-z]/i.test(c) ? 2 : 3; };
const KO_CMP = new Intl.Collator("ko").compare;  // same order as localeCompare(…, "ko"), much faster over 수십만 곡
/* 제목 순서 (user request 2026-11-19, sized for 1M songs): every sort ends on the title, and most songs tie before it (57% have
   no rating) — comparing titles there made the 인기순 sort ~8 s. Every song's place in title order is worked out once
   (_tr, a stable sort of the whole list) and the sorts compare that number.
   That sort itself is slow (~15 s at 1M), so its result is kept in this browser (VocaDB ids in title order) and the next
   open takes the places from it before sorting; songs new since then fall back to comparing titles */
/* the name sorted by = the bold name the list shows (user request 2026-11-22: some songs show their English name first, and
   ' 태양소녀 ' — a space in front — came first) */
const sortTitle = it => mainTitle(it).trim();
const titleCmp = (a, b) => { const x = sortTitle(a), y = sortTitle(b); return titleGroup(x) - titleGroup(y) || KO_CMP(x, y); };
const TR_KEY = () => `${LOCAL.name}|title_rank2`;  // 2: sorted by sortTitle
/* 정렬 일꾼 (user request 2026-11-19, sized for 1M songs): a worker thread that sorts with the browser's own sort, so the
   screen does none of it — the title order (titles + their group, Korean collator like KO_CMP, ~3 s at 1M instead of ~11 s
   here) and number keys (numSorted). Made from this text (a page opened as a file can't load a worker file); no worker → the
   sorts run here as before */
const SORT_WORKER = `const col = new Intl.Collator("ko").compare;
onmessage = e => {
  const d = e.data;
  if (d.titles) {
    const t = d.titles, g = d.groups, a = Array.from({length: t.length}, (_, i) => i);
    a.sort((x, y) => g[x] - g[y] || col(t[x], t[y]) || x - y);
    const order = Uint32Array.from(a);
    postMessage({id: d.id, order}, [order.buffer]);
  } else { d.keys.sort(); postMessage({id: d.id, keys: d.keys}, [d.keys.buffer]); }
};`;
let sortW = null, sortSeq = 0;
function sortWork(msg, transfer) {
  return new Promise((res, rej) => {
    try { sortW = sortW || new Worker(URL.createObjectURL(new Blob([SORT_WORKER], {type: "text/javascript"}))); } catch (e) { return rej(e); }
    const id = ++sortSeq, w = sortW;
    const on = e => { if (e.data && e.data.id === id) { w.removeEventListener("message", on); w.removeEventListener("error", bad); res(e.data); } };
    const bad = e => { w.removeEventListener("message", on); w.removeEventListener("error", bad); sortW = null; rej(e); };
    w.addEventListener("message", on); w.addEventListener("error", bad);
    w.postMessage({...msg, id}, transfer);
  });
}
let TR_BY = [];  // title place → song (numSorted turns a sorted key back into its song)
function setRanks(by) { for (let i = 0; i < by.length; i++) if (by[i]) by[i]._tr = i; TR_BY = by; }
/* a short print of the title sorted by (FNV-1a) — kept with the order, so the next list's changed titles are found */
const titleHash = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };
const keepRanks = (by, hs, ids = Uint32Array.from(by, it => +it.vocadb || 0)) => idbKV("music-songs")("put", TR_KEY(), {sig: VDB.dataSig, ids, hs}).catch(() => {});
async function titleRanks(all, tick) {
  let by, hs;
  try {
    const titles = new Array(all.length), groups = new Int8Array(all.length);
    for (let i = 0; i < all.length; i++) { titles[i] = sortTitle(all[i]); groups[i] = titleGroup(titles[i]); if (!(i & 16383)) await tick(); }
    const {order} = await sortWork({titles, groups}, [groups.buffer]);
    by = Array.from(order, i => all[i]);
    hs = Uint32Array.from(order, i => titleHash(titles[i]));
  } catch (e) { by = await sortAsync(all, titleCmp, tick); hs = Uint32Array.from(by, it => titleHash(sortTitle(it))); }  // no worker: here, in steps
  setRanks(by);
  keepRanks(by, hs);
}
/* the kept title order → _tr (→ true). Made from another list (user request 2026-11-23: every upload — even one song's sync —
   changed the list, and the whole order was sorted again, ~4 s on a PC): its songs whose title is the same keep their order,
   the rest (new songs, changed titles) are put in their places one by one — the same order a new sort gives, songs of the
   same title aside. Too many of them → false (sorted again) */
async function titleRanksKept(all, tick) {
  const kept = await idbKV("music-songs")("get", TR_KEY()).catch(() => null);
  if (!kept || !kept.ids) return false;
  // the songs by VocaDB id are VDB.items already (2026-11-23: a new 98만-entry map here took ~1.5 s)
  if (kept.sig === VDB.dataSig && kept.ids.length === all.length) {
    const by = new Array(kept.ids.length);
    for (let i = 0; i < kept.ids.length; i++) { const it = VDB.items.get(String(kept.ids[i])); if (!it) return false; by[i] = it; if (!(i & 16383)) await tick(); }
    setRanks(by);
    for (let i = 0; i < all.length; i++) if (by[all[i]._tr] !== all[i]) return false;  // every song its own place
    return true;
  }
  if (!kept.hs || kept.hs.length !== kept.ids.length) return false;
  for (let i = 0; i < all.length; i++) all[i]._tr = -1;  // -1: no place yet
  const by = [], hs = [], ids = [];
  for (let i = 0; i < kept.ids.length; i++) {
    const it = VDB.items.get(String(kept.ids[i]));
    if (it && it._tr === -1 && titleHash(sortTitle(it)) === kept.hs[i]) { it._tr = -2; by.push(it); hs.push(kept.hs[i]); ids.push(kept.ids[i]); }
    if (!(i & 16383)) await tick();
  }
  const rest = all.filter(it => it._tr === -1);
  if (rest.length > all.length / 20) return false;
  // each one after the last kept song not after it (binary search) — then all put in, from the back
  const at = rest.map(it => { let lo = 0, hi = by.length; while (lo < hi) { const m = lo + hi >> 1; if (titleCmp(by[m], it) <= 0) lo = m + 1; else hi = m; } return lo; });
  const ord = rest.map((_, i) => i).sort((a, b) => at[a] - at[b] || titleCmp(rest[a], rest[b]) || a - b);
  const out = new Array(by.length + rest.length), oh = new Uint32Array(out.length), oi = new Uint32Array(out.length);
  let k = 0, j = 0;
  const put = (it, h, id) => { oh[j] = h; oi[j] = id; out[j++] = it; };
  for (const r of ord) { while (k < at[r]) { put(by[k], hs[k], ids[k]); k++; } put(rest[r], titleHash(sortTitle(rest[r])), +rest[r].vocadb || 0); }
  while (k < by.length) { put(by[k], hs[k], ids[k]); k++; }
  setRanks(out);
  keepRanks(out, oh, oi);
  return true;
}
/* number-then-title sorts (user request 2026-11-19, sized for 1M songs: 인기순 ~4 s → ~0.4 s): the number and the title place
   packed into one value and sorted by the worker; the same order as ourCmp (checked on 108만 곡). null when it can't be used
   (a sort by text, a song without its title place, a number that isn't whole) — the caller sorts as before */
const NUM_SORT = {
  RatingScore: it => 2 ** 30 - (it.rating || 0),
  PublishDate: it => it.date ? 99999999 - +it.date.replace(/-/g, "") : 1e8,  // newest first, no date last
  old: it => it.date ? +it.date.replace(/-/g, "") : 1e8,  // oldest first, no date last
  list: it => { const o = it.ord || {}; return o.namu != null ? o.namu : o.japan != null ? 1e6 + o.japan : 1e9; },
  Name: () => 0,
};
async function numSorted(its, sort, tick) {
  const f = NUM_SORT[sort], by = TR_BY, R = 4194304;  // title places up to 4M songs
  if (!f || by.length > R) return null;
  const keys = new Float64Array(its.length);
  for (let i = 0; i < its.length; i++) {
    const it = its[i], p = f(it), r = it._tr;
    if (r === undefined || by[r] !== it || !Number.isInteger(p) || p < 0 || p >= 2 ** 31) return null;
    keys[i] = p * R + r;
    if (!(i & 16383)) await tick();
  }
  let out;
  try { out = (await sortWork({keys}, [keys.buffer])).keys; } catch (e) { return null; }
  const res = new Array(out.length);
  for (let i = 0; i < out.length; i++) res[i] = by[out[i] % R];
  return res;
}
/* 신고 들어온 순: the song's oldest report not handled yet of the filter's kinds (none → any kind) — admin_tools.js, report ids
   are in time order */
function repAt(it, kinds) {
  const m = typeof ADM !== "undefined" && ADM.repAt.get(String(it.vocadb || ""));
  let out = "";
  if (m) for (const [k, id] of m) if ((!kinds.size || kinds.has(k)) && (!out || id < out)) out = id;
  return out;
}
/* key: the sort (the window's by default) · byId: ties by VocaDB id, not title place (OPEN CHANNEL's cut — the same on every player) */
function ourCmp(key = FE.sort, byId = false) {
  const big = 1e9, txt = (a, b) => (a ? 0 : 1) - (b ? 0 : 1) || KO_CMP(a || "", b || "");
  const ord = it => { const o = it.ord || {}; return o.namu != null ? o.namu : o.japan != null ? 1e6 + o.japan : big; };
  const num = it => { const n = it.nums || {}, b = ["TJ", "금영", "DAM", "JOYSOUND", "UGA"].findIndex(x => n[x]); return b < 0 ? [big, big] : [b, parseInt(String(n[["TJ", "금영", "DAM", "JOYSOUND", "UGA"][b]]).replace(/\D/g, ""), 10) || big]; };
  const kinds = key === "report" ? new Set(fRepKinds()) : null;
  const byTitle = (a, b) => a._tr !== undefined && b._tr !== undefined ? a._tr - b._tr : titleCmp(a, b);  // _tr: titleRanks
  const cmp = {RatingScore: (a, b) => (b.rating || 0) - (a.rating || 0), list: (a, b) => ord(a) - ord(b), Name: () => 0,
    no: (a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1]; },
    PublishDate: (a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (b.date || "").localeCompare(a.date || ""), old: (a, b) => txt(a.date, b.date),
    composer: (a, b) => txt(a.composer, b.composer), singer: (a, b) => txt(a.singer, b.singer),
    report: (a, b) => txt(repAt(a, kinds), repAt(b, kinds))}[key] || (() => 0);
  if (byId) return (a, b) => cmp(a, b) || (key === "Name" ? titleCmp(a, b) : 0) || (+a.vocadb || 0) - (+b.vocadb || 0);
  return (a, b) => cmp(a, b) || byTitle(a, b);
}

/* Song options (user request 2026-11-15, like Spotify): the 4 result buttons moved into a ⋯ button — shown on hover on the
   web, always on the phone. It opens the options with their explanations as text: a menu next to the button on the web,
   a sheet sliding up from the bottom on the phone. A popover, so it sits above the (modal) search window. */
var MORE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
const SM_ICON = {play: "▶&#xFE0E;", next: "⤵&#xFE0E;", add: "＋", filt: FILT_SVG};
let smIt = null;
function openSongMenu(it, btn) {
  smIt = it;
  const inPl = SHELL.queue.some(q => keyOf(q) === keyOf(it)), inF = fSongIds().includes(songId(it)), ok = canPlay(it);
  const row = (a, label, desc, dis) => `<button data-a="${a}"${dis ? " disabled" : ""}><span class="si">${a === "add" && inPl ? "✓" : SM_ICON[a]}</span><span class="sl"><b>${label}</b><small>${desc}</small></span></button>`;
  const m = $("sMenu");
  m.innerHTML = `<div class="smgrip"></div><div class="smhead">${coverHtml(it, "thumb")}<div class="meta"><div class="t">${titleHtml(it)}</div><div class="a">${esc(shortName(it.artist || ""))}</div></div></div>`
    + (ok ? row("play", "지금 재생", "재생목록에 넣고 바로 틂")
      + row("next", "다음에 재생", "재생 대기열(직접 넣은 곡)에 넣음 — 무작위 재생이어도 지금 곡 다음에")
      + row("add", inPl ? "재생목록에 있음" : "재생목록에 추가", inPl ? "이미 재생목록에 있는 곡" : "재생목록 끝에 넣음", inPl)
      : `<div class="smnote">영상 없음 — 재생할 수 없는 곡</div>`)
    + row("filt", inF ? "필터에서 빼기" : "현재 필터에 추가", inF ? "필터에 넣은 곡 — 누르면 뺌" : "지금 결과는 그대로 두고 이 곡도 결과에 더함 (곡만 모은 필터 그룹)");
  const phone = document.body.classList.contains("m");
  m.classList.toggle("sheet", phone);
  m.style.left = m.style.top = "";
  const host = btn.closest("dialog") || document.body;  // inside the window: a modal window makes everything outside it unclickable
  if (m.parentNode !== host) host.appendChild(m);
  m.showPopover();
  if (!phone) {  // next to the ⋯ button, flipped up / left when it would run off the window
    const f = uiZoom();
    const r = btn.getBoundingClientRect(), w = m.offsetWidth * f, h = m.offsetHeight * f;
    const x = Math.max(4, Math.min(r.right - w, innerWidth - w - 4)), y = r.bottom + 4 + h > innerHeight - 4 ? Math.max(4, r.top - 4 - h) : r.bottom + 4;
    m.style.left = x / f + "px"; m.style.top = y / f + "px";
  }
}
$("sMenu").addEventListener("click", e => {
  const b = e.target.closest("button[data-a]"); if (!b || !smIt) return;
  const it = LOCAL.remember(smIt);
  $("sMenu").hidePopover();
  if (b.dataset.a === "filt") return toggleSongCond(it);
  if (b.dataset.a === "play") { PL.add([it], true); play(it, true, "pick"); }
  // user request 2026-11-14: 다음에 재생 = the play queue's 직접 넣은 곡 (before the shuffled rest), not a playlist position
  else if (b.dataset.a === "next") { PL.add([it]); SHELL.enqueue(it); }
  else PL.add([it]);
  renderSearch($("sInfo").textContent);
});
let smClosed = {row: null, t: 0};  // a tap outside closes the menu before the ⋯ click arrives
$("sMenu").addEventListener("toggle", e => {
  if (e.newState !== "closed") return;
  const row = document.querySelector(".sitem.menu");
  if (row) { row.classList.remove("menu"); smClosed = {row, t: Date.now()}; }
  smIt = null;
});
$("sList").addEventListener("click", e => {
  const b = e.target.closest("button[data-a=more]"), row = e.target.closest(".sitem"); if (!b || !row) return;
  if (smClosed.row === row && Date.now() - smClosed.t < 500) return;  // ⋯ of the open menu again = just close it
  row.classList.add("menu");  // keeps ⋯ shown while its menu is open
  openSongMenu(S.items[+row.dataset.i], b);
});
$("sList").addEventListener("contextmenu", e => { const row = e.target.closest(".sitem"); if (row) songContext(e, S.items[+row.dataset.i]); });
/* 재생목록 만들기 (user request 2026-11-14 — '결과 모두 재생목록에' 대신 상위 N곡; 2026-11-22: N 은 필터의 범위가 됨 — 결과가
   이미 'n번부터 n곡' 이라 그 결과의 틀 수 있는 곡 모두) → 새 재생목록 */
$("sMakePl").onclick = async () => {
  const list = S.items.filter(canPlay);
  if (!list.length) return;
  if (SHELL.queue.length && !await uiConfirm(`지금 재생목록 ${SHELL.queue.length.toLocaleString()}곡을 비우고 찾은 곡 ${list.length.toLocaleString()}곡으로 새로 만들까요?`)) return;
  const seen = new Set();
  setPlFilter(FE.filter());  // the playlist remembers the filter it was made with (shown above it) — with its sort and range
  PL.set(list.filter(it => !seen.has(keyOf(it)) && seen.add(keyOf(it))).map(it => LOCAL.remember(it)));
  renderSearch($("sInfo").textContent);
  uiAlert(`재생목록을 ${SHELL.queue.length.toLocaleString()}곡으로 만들었습니다.`);
};

/* 재생목록의 필터 (user request 2026-11-15): the filter the playlist was made with — 곡 검색 '재생목록 만들기' or 노래방 모드 —
   shown read-only above the playlist (same group boxes as the search filter). Kept in this browser; 비우기 clears it */
var PLF = store.get("pl.filter", null);
function setPlFilter(x) {  // x: {groups, sort, from, n} · groups only (노래방 모드, saved before 2026-11-22)
  PLF = x && filterOf(x).groups.length ? JSON.parse(JSON.stringify(x)) : null;
  store.set("pl.filter", PLF);
  renderPlFilter();
  if (typeof ltPlChanged === "function") ltPlChanged();  // 같이듣기 방장: guests see it in the room (listen_together.js)
}
/* filter groups → read-only group boxes (also used by 같이듣기 for the host's filter) — 원곡만 folded here as well, the sort and range under them */
const plfHtml = f => FE.roHtml(f);
/* how many songs we have (the collected list) — from the song list's index, before its blocks are read */
const vdbTotal = () => VDB.total;
/* 현재 설정된 필터 folds (user request 2026-11-15): folded by default, folds again when 간단 mode is turned on — the header toggles it */
let plfFold = true;
function renderPlFilter() {
  // 같이듣기 손님: the list shown is the host's, so is the filter (user request 2026-11-15)
  // (OPEN CHANNEL shows my own playlist and filter — user request 2026-11-20)
  const box = $("plFilter"), f = guestPl ? (typeof LT !== "undefined" && LT.hostPlf) || null : PLF;
  box.hidden = !f || !ONLINE;
  box.classList.toggle("fold", plfFold);
  box.innerHTML = f ? `<div class="plfhead" role="button" tabindex="0" title="${plfFold ? "필터 펼치기" : "필터 접기"}">현재 설정된 필터<span class="chev">▾</span></div>` + plfHtml(f) : "";
}
$("plFilter").addEventListener("click", e => { if (e.target.closest(".plfhead")) { plfFold = !plfFold; renderPlFilter(); } });
$("plFilter").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest(".plfhead")) { plfFold = !plfFold; renderPlFilter(); } });
renderPlFilter();

/* 필터 프리셋 추천 · 저장된 필터 (user request 2026-11-14) — 고르면 지금 필터가 그 필터로 바뀜 */
const F_PRESETS_DEF = [
  {name: "한국/일본 노래방 수록곡", groups: [{x: false, m: true, c: [{k: "kara", v: ONOFF_LISTS.slice()}]}]},  // 노래방 카테고리 전체 선택
];
/* 프리셋은 음원 관리 › 필터에서 정함 (filter.json) — 없으면 위 기본값 */
const fPresets = () => VDB.filter && (VDB.filter.presets || []).length ? VDB.filter.presets : F_PRESETS_DEF;
const fSummary = f => FE.summary(f);  // 원곡만 as one word · the sort and range at the end (filter_editor.js)
function applyFilter(f) {  // a preset · a saved filter ({groups, sort, from, n} — or groups only)
  FE.set(f);
  FE.changed();
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
  const row = (f, i) => `<div class="fdd-opt fset" data-i="${i}" title="${esc(fSummary(f))}"><span class="nm">${esc(f.name)}</span>`
    + `<span class="sum">${esc(fSummary(f))}</span>${preset ? "" : '<button class="fx" title="지우기">✕</button>'}</div>`;
  p.querySelector(".fdd-list").innerHTML = preset ? `<div class="fdd-grp">추천 필터</div>` + fPresets().map(row).join("")
    : `<div class="fdd-top"><button class="primary fsave"${FE.groups.some(g => g.c.length) ? "" : " disabled"} title="지금 고른 필터를 이름을 붙여 저장">＋ 지금 필터 저장</button></div>`
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
    const name = await uiPrompt("저장할 필터 이름", fSummary(FE.groups).slice(0, 40), "필터 이름");
    if (!name) return;
    const groups = FE.groups.filter(g => g.c.length).map(({x, c}) => ({x, c}));
    // 정렬 · 범위도 같이 저장 (user request 2026-11-22)
    store.set("f.saved", [...saved.filter(f => f.name !== name), {name, groups, sort: FE.sort, from: FE.from, n: FE.n}]);  // 같은 이름이면 덮어씀
    return;
  }
  const o = e.target.closest(".fset"); if (!o) return;
  const i = +o.dataset.i;
  if (e.target.closest(".fx")) { saved.splice(i, 1); store.set("f.saved", saved); return renderFSet(); }
  const f = (preset ? fPresets() : saved)[i]; if (!f) return;
  closeFSet();
  applyFilter(f);
});
$("searchDlg").addEventListener("keydown", e => { if (e.key === "Escape" && $("fSetPop")) { e.preventDefault(); closeFSet(); } });
$("searchDlg").addEventListener("close", closeFSet);
/* 창 크기: 너비가 바뀔 때만 닫음 — 높이만 바뀌면 (폰 키패드) 자리만 다시 (user report 2026-11-21, filter_editor.js 의 목록과 같음) */
{ let w = innerWidth; window.addEventListener("resize", () => { const same = innerWidth === w, p = $("fSetPop"); w = innerWidth; if (!same) closeFSet(); else if (p) placePop(p, $(p.dataset.for), 280); }); }
