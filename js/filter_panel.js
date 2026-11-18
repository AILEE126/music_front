/* 곡 검색 창의 필터 — 그룹·조건 칩 · 값 펼침 목록 · 프리셋·저장된 필터 · 끌어 옮기기 · 검색 준비 (warmSearch) ·
   재생목록에 걸린 필터 표시. 판정·카테고리는 song_filter.js (음원 관리와 같이 씀).
   player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* ================= 필터 (판정·카테고리는 song_filter.js — 음원 관리와 같이 씀) — 곡 검색 창 안 (user request 2026-11-14) ================= */
/* 고를 값의 곡: 그 범위의 곡 (곡 수도 그 범위 기준) */
const sfItems = scopeItems;
/* 필터 그룹 [{x: 제외 그룹, m: '＋ 그룹'·'− 제외' 버튼으로 만든 그룹, c: [{k: 종류, v: 값}]}] — 그룹 안 조건은 모두 맞아야(교집합),
   포함 그룹끼리는 하나라도 맞으면 보임(합집합), 제외 그룹의 조건에 모두 맞는 곡은 빠짐. fCur: 새 조건이 들어갈 그룹.
   버튼으로 그룹을 만들지 않았으면(m 없음) 조건을 고를 때마다 그 조건 하나만으로 거름 (앞 조건은 바뀜).
   예전 태그(f.chips: 태그마다 포함·제외)는 태그 하나짜리 그룹으로 옮김 · m 이 생기기 전에 저장한 조건 여럿짜리 그룹은 직접 만든 것으로 봄 */
/* 기본 필터 (user request 2026-11-16, was 곡 종류 오리지널 only): [곡 종류 오리지널 또는 커버 · 보컬 종류 엔진 또는 섞임] —
   음원 관리 › 필터 › 기본 필터 (filter.json default) 가 있으면 그것. 아무것도 안 고른 때 · ↺ 뒤의 필터이고,
   새 그룹('＋ 그룹' · '− 제외')은 그 첫 포함 그룹의 조건으로 시작함 */
/* + 같은 곡 정렬 · 자르기 (user request 2026-11-16, song_filter.js filterGroups): 같은 노래는 재생되는 · 원곡 · 인기 · 먼저 나온 한 곡만 */
// 2026-11-18 (user request: 그 곡의 가장 원조인 보카로 버전): + 리믹스 · 리마스터, 원작자 먼저 → 먼저 나온 순 → 인기순 (= filter_settings.DEFAULT_FILTER)
const F_SORT_OLD = ["재생 가능", "긴 버전 먼저", "원곡 먼저", "인기순", "먼저 나온 순"];
const F_DEFAULT_DEF = [{x: false, c: [{k: "type", v: ["오리지널", "커버", "리믹스", "리마스터"]}, {k: "vkind", v: ["엔진", "섞임"]},
  {k: "same_sort", v: ["재생 가능", "긴 버전 먼저", "원작자 먼저", "먼저 나온 순", "인기순"]}, {k: "same_cut", v: "1"}]}];
const fDefault = () => JSON.parse(JSON.stringify(VDB.filter && (VDB.filter.default || []).length ? VDB.filter.default : F_DEFAULT_DEF)).map(g => ({...g, m: true}));
const fBase = () => { const d = fDefault(); return (d.find(g => !g.x) || d[0]).c; };
const fNewGroup = x => ({x, m: true, c: fBase()});
/* 곡 종류는 그룹마다 꼭 하나 (user request 2026-11-14) — 없으면 기본 필터의 곡 종류로 넣음 · 지울 수 없고, 카테고리 '곡 종류'에서 고르면 값만 바뀜 */
const withType = g => g.c.some(c => c.k === "type") ? g : {...g, c: [fBase().find(c => c.k === "type") || {k: "type", v: "오리지널"}, ...g.c]};
/* 곡 종류와 기본 필터 조건만 든 그룹은 첫 그룹이 아니면 아직 빈 그룹 — 다른 조건을 고를 때까지 거르지 않음 ('＋ 그룹'만 눌러도 결과가 바뀌지 않게) */
const fBaseCond = c => c.k === "type" || fBase().some(b => b.k === c.k && JSON.stringify(b.v) === JSON.stringify(c.v));
const fReal = (g, i) => i === 0 || g.c.some(c => !fBaseCond(c));
/* 기본 필터 접기 (user request 2026-11-17 — same in 음원 관리 filter_manage_panel.js): a group holding every condition of the
   default's first include group (곡 종류 included — 2026-11-17) shows them as one '기본 필터' chip; clicking it unfolds /
   folds (g.d = unfolded). → indices of those conditions in g.c, or null */
function fDefIdx(g) {
  const out = [];
  for (const b of fBase()) {  // 곡 종류 too (user request 2026-11-17)
    const j = g.c.findIndex(c => c.k === b.k && JSON.stringify(c.v) === JSON.stringify(b.v));
    if (j < 0) return null;
    out.push(j);
  }
  return out.length ? out : null;
}
/* 곡 조건 (user request 2026-11-18): several songs → a small scrolling list, one song per line (like the vocal +N list) */
const chipVal = c => c.k === "song" && Array.isArray(c.v) && c.v.length > 1
  ? `<span class="v slist">${c.v.map(v => `<span>${esc(oneLabel(c.k, v))}</span>`).join("")}</span>` : `<span class="v">${esc(chipLabel(c))}</span>`;
const fDefChip = (g, open, ro) => `<span class="fchip fdef${open ? " open" : ""}"${ro ? ` title="기본 필터: ${esc(fBase().map(chipLabel).join(" · "))}"` : ` draggable="true" data-def="1" title="기본 필터: ${esc(fBase().map(chipLabel).join(" · "))}&#10;누르면 ${open ? "접기" : "펼치기"} · 끌어서 다른 그룹으로 (곡 종류는 그대로)"`}><svg class="fdi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg><span class="k">기본 필터</span>${ro ? "" : DD_CHEV}</span>`;
/* 조건 끌어 옮기기 (user request 2026-11-17): a condition (or the folded 기본 필터 — all of them) dragged onto another group moves
   there. 곡 종류 never moves (one per group). A one-per-group condition replaces the one already there */
function fMoveConds(from, ci, to) {
  const src = FG[from], dst = FG[to];
  if (!src || !dst || from === to) return false;
  const moved = (ci < 0 ? fDefIdx(src) || [] : [ci]).map(j => src.c[j]).filter(c => c && c.k !== "type");
  if (!moved.length) return false;
  src.c = src.c.filter(c => !moved.includes(c));
  for (const c of moved) {
    const t = ONE_COND.includes(c.k) && dst.c.find(x => x.k === c.k);
    if (t) t.v = c.v;
    else if (!dst.c.some(x => x.k === c.k && JSON.stringify(x.v) === JSON.stringify(c.v))) dst.c.push(c);
  }
  if (ci < 0) dst.d = src.d;
  FG.forEach(g => { g.m = true; });
  return true;
}
/* "＋ 기본 필터" (user request 2026-11-17): the default's conditions into a group */
function fAddDefault(g) {  // one-per-group kinds (곡 종류 · 같은 곡 정렬 · 자르기) take the default's value
  let n = 0;
  for (const b of fBase()) {
    const v = JSON.stringify(b.v), t = ONE_COND.includes(b.k) && g.c.find(c => c.k === b.k);
    if (t) { if (JSON.stringify(t.v) !== v) { t.v = JSON.parse(v); n++; } continue; }
    if (g.c.some(c => c.k === b.k && JSON.stringify(c.v) === v)) continue;
    g.c.push(JSON.parse(JSON.stringify(b))); n++;
  }
  g.m = true;
  return n;
}
let FG = (store.get("f.groups", null) || store.get("f.chips", []).map(c => ({x: !!c.x, c: [{k: c.k, v: c.v}]})))
  .map(g => "m" in g ? g : {...g, m: g.c.length > 1}).map(withType);
/* an old built-in default left as it was (one group: 곡 종류 오리지널 only · 2: + 보컬 종류, before 같은 곡) → the new default, once
   (user request 2026-11-16) */
if (store.get("f.defV", 0) < 3) {
  const was = [JSON.stringify([{k: "type", v: "오리지널"}]), JSON.stringify([{k: "type", v: ["오리지널", "커버"]}, {k: "vkind", v: ["엔진", "섞임"]}])];
  if (FG.length === 1 && was.includes(JSON.stringify(FG[0].c))) { FG = fDefault(); store.set("f.groups", FG); }
  store.set("f.defV", 3);
}
/* 4: + 긴 버전 먼저 (user request 2026-11-17) — the 2026-11-16 default left as it was → the new one, once */
if (store.get("f.defV", 0) < 4) {
  const was = JSON.stringify([{k: "type", v: ["오리지널", "커버"]}, {k: "vkind", v: ["엔진", "섞임"]},
    {k: "same_sort", v: F_SORT_OLD.filter(v => v !== "긴 버전 먼저")}, {k: "same_cut", v: "1"}]);
  if (FG.length === 1 && JSON.stringify(FG[0].c) === was) { FG = fDefault(); store.set("f.groups", FG); }
  store.set("f.defV", 4);
}
/* 5: 원조 보카로 버전 (user request 2026-11-18) — groups still on the old same-song order get the new one (+ 리마스터), once */
if (store.get("f.defV", 0) < 5) {
  let hit = false;
  for (const g of FG) {
    const s = g.c.find(c => c.k === "same_sort"), t = g.c.find(c => c.k === "type");
    if (!s || JSON.stringify(s.v) !== JSON.stringify(F_SORT_OLD)) continue;
    s.v = [...F_DEFAULT_DEF[0].c[2].v]; hit = true;
    if (t && Array.isArray(t.v) && !t.v.includes("리마스터")) t.v = [...t.v, ...(t.v.includes("리믹스") ? [] : ["리믹스"]), "리마스터"];
  }
  if (hit) store.set("f.groups", FG);
  store.set("f.defV", 5);
}
let fCur = Math.min(store.get("f.cur", 0), FG.length - 1);
samePlayable = it => canPlay(it);  // 같은 곡 정렬 '재생 가능' = 재생목록에 넣을 수 있는 곡
function saveChips(keepScroll) { sfDefaultGroup(); store.set("f.groups", FG); store.set("f.cur", fCur); renderFilterOptions(); runSearch(keepScroll); }
function addChip(k, v) {  // v: 값 하나 또는 [값, …] (그중 하나라도)
  if (!v || (Array.isArray(v) && !v.length)) return;
  if (Array.isArray(v) && v.length === 1) v = v[0];
  if (!FG[fCur] || !FG[fCur].m) {  // 직접 만든 그룹이 선택돼 있지 않음 → 이 조건 하나만 (버튼 없이 고른 앞 조건은 지움)
    FG = FG.filter(g => g.m);
    FG.push(withType({x: false, m: false, c: [{k, v}]})); fCur = FG.length - 1;
    return saveChips();
  }
  const g = FG[fCur], t = g.c.find(c => c.k === k && ONE_COND.includes(k));
  if (k === "same_cut" && Array.isArray(v)) v = v[v.length - 1];  // 자르기는 값 하나
  if (t) { t.v = v; return saveChips(); }  // 곡 종류 · 같은 곡 정렬 · 자르기는 그룹에 하나뿐 — 값만 바꿈
  if (!g.c.some(c => c.k === k && JSON.stringify(c.v) === JSON.stringify(v))) g.c.push({k, v});
  saveChips();
}
/* 곡 조건 (user request 2026-11-14: 검색 결과의 '현재 필터에 추가'): 지금 결과에 이 곡'도' 더함 — 곡만 모은 포함 그룹 하나
   (곡 종류 + 곡 조건, 그룹끼리는 또는)에 VocaDB 번호를 모음. 선택된 그룹에 넣으면 결과가 그 곡으로 좁혀져 목록이 줄어들기 때문
   (user report: 누르니 목록이 맨 위로). 그 곡의 종류가 그룹의 곡 종류에 없으면 더함. 이미 든 곡은 다시 누르면 뺌 (다 빠지면 그룹도) */
function songGroup() { return FG.find(g => !g.x && g.c.some(c => c.k === "song") && g.c.every(c => c.k === "song" || c.k === "type")); }
function songId(it) { return String(it.vocadb || it.name); }
var FILT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 5h12l-5 6v5l-3 2v-7z"/><path d="M18 12v8M14 16h8"/></svg>';
/* 그룹에 하나뿐인 조건 — 다시 고르면 값만 바뀜 */
var ONE_COND = ["type", "same_sort", "same_cut"];
/* 같은 곡 정렬: 체크한 순서 = 우선순위 — 목록에 '1순위' … 로 보임 */
function sameRank(v) {
  if (ddOpen !== "fVal" || $("fKind").value !== "same_sort" || !ddSel.has(v)) return "";
  return `<span class="n">${[...ddSel].indexOf(v) + 1}순위</span>`;
}
function fSongIds() { const g = songGroup(), c = g && g.c.find(c => c.k === "song"); return c ? [].concat(c.v) : []; }
function toggleSongCond(it) {
  sfDefaultGroup();
  const id = songId(it), ty = VDB_TYPE_KO[it.type] || it.type;
  let g = songGroup();
  if (!g) { g = {x: false, m: true, c: [ty ? {k: "type", v: ty} : fBase().find(c => c.k === "type")]}; FG.push(g); }
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
      c.v = c.k === "same_cut" ? vs[vs.length - 1] : vs.length === 1 && c.k !== "song" ? vs[0] : vs;
      if (c.k === "singer" || c.k === "solo") c.k = $("fSolo").checked ? "solo" : "singer";
    }
  }
  saveChips();
}

function renderFilterOptions() {
  if (!VDB.done) return;  // the categories come from the whole song list (withBusy draws them once it's read)
  const its = sfItems(), opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
  const fill = (id, head, rows, label = k => k, show = rows.length) => {
    $(id).innerHTML = opt("", head) + rows.map(([k, n]) => opt(k, n === "" ? label(k) : `${label(k)} (${n})`)).join("");
    $(id).hidden = !show;
  };
  const cats = sfCatsMemo(its), ec = editCond();
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
    const di = fDefIdx(g), dset = new Set(di || []), isDef = c => dset.has(g.c.indexOf(c));
    const chip = (c, cls = "") => { const j = g.c.indexOf(c), on = j === ed ? " edit" : "";
      // 곡 종류: 그룹마다 꼭 하나 — 지우기 없이 고르는 칸 모양 (▾), 옮기지 않음 · 다른 조건: 누르면 고치기, × 빼기, 끌어서 다른 그룹으로
      return c.k === "type"
        ? `<span class="fchip req${cls}${on}" data-c="${j}" title="곡 종류 — 그룹마다 꼭 하나 · 누르면 바꾸기"><span class="k">${esc(chipKind(c))}</span><span class="v">${esc(chipLabel(c))}</span>${DD_CHEV}</span>`
        : `<span class="fchip${cls}${on}" data-c="${j}" draggable="true" title="누르면 이 조건 고치기 · 끌어서 다른 그룹으로"><span class="k">${esc(chipKind(c))}</span>${chipVal(c)}<button title="빼기">×</button></span>`; };
    return `<div class="fgroup${g.x ? " exc" : ""}${i === fCur ? " cur" : ""}" data-g="${i}" title="${i === fCur ? "새 조건이 이 그룹에 들어감" : "누르면 이 그룹 선택"}">`
      + `<button class="gh" title="${g.x ? "제외 그룹 — 누르면 포함으로" : "포함 그룹 — 누르면 제외로"}">${g.x ? "−" : "＋"}</button>`
      + cs.filter(c => c.k === "type" && !isDef(c)).map(c => chip(c)).join("")
      + (di ? fDefChip(g, g.d) + (g.d ? cs.filter(isDef).map(c => chip(c, " indef")).join("") : "") : "")
      + cs.filter(c => c.k !== "type" && !isDef(c)).map(c => chip(c)).join("")
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
function sfDefaultGroup() { if (!FG.length) { FG = fDefault(); fCur = 0; } }  // 기본 필터 (fDefault)
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
      if ($("fKind").value === "same_sort") { e.stopPropagation(); renderDD(); }  // 순위 숫자 다시 (다시 그리면 누른 칸이 떨어져 나가 바깥 누르기로 보임)
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
      + `${esc(name(o))}${sameRank(o.value) || (cnt(o) ? `<span class="n">${cnt(o)}</span>` : "")}</div>`).join("");
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
  if (e.target.closest("[data-defadd]")) { sfDefaultGroup(); if (FG[fCur]) fAddDefault(FG[fCur]); return saveChips(); }
  const b = e.target.closest("[data-new]"); if (!b) return;
  const x = b.dataset.new === "exc";
  FG.forEach(g => { g.m = true; });  // 버튼 없이 고른 조건도 그룹으로 남김 (다음 조건을 골라도 지워지지 않게)
  if (FG[fCur] && !fReal(FG[fCur], fCur)) FG[fCur].x = x;  // 비어 있는 선택 그룹은 새로 만들지 않고 종류만 바꿈
  else { FG.push(fNewGroup(x)); fCur = FG.length - 1; }
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
  if (chip && chip.dataset.def) { e.stopPropagation(); FG[gi].d = !FG[gi].d; store.set("f.groups", FG); return renderFilterOptions(); }  // fold only — the filter is the same
  if (e.target.closest(".gx")) { FG.splice(gi, 1); if (fCur >= gi) fCur = Math.max(0, fCur - 1); }
  else if (chip && e.target.closest("button")) FG[gi].c.splice(+chip.dataset.c, 1);
  else if (chip) { e.stopPropagation(); return editChip(gi, +chip.dataset.c); }  // the page's outside-click would close the list it opens
  else if (e.target.closest(".gh")) FG[gi].x = !FG[gi].x;
  else fCur = gi;
  saveChips();
});
$("fReset").onclick = () => { FG = []; fCur = 0; saveChips(); };
/* 조건 끌어 옮기기 (user request 2026-11-17) */
{
  let drag = null;
  const clear = () => $("fChips").querySelectorAll(".dropto,.drag").forEach(x => x.classList.remove("dropto", "drag"));
  $("fChips").addEventListener("dragstart", e => {
    const ch = e.target.closest(".fchip[draggable]"), gEl = ch && ch.closest(".fgroup");
    if (!ch || !gEl) return;
    drag = {g: +gEl.dataset.g, c: ch.dataset.def ? -1 : +ch.dataset.c};
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "");
    ch.classList.add("drag");
  });
  $("fChips").addEventListener("dragover", e => {
    const gEl = e.target.closest(".fgroup");
    if (!drag || !gEl || +gEl.dataset.g === drag.g) return;
    e.preventDefault();
    $("fChips").querySelectorAll(".fgroup.dropto").forEach(x => x !== gEl && x.classList.remove("dropto"));
    gEl.classList.add("dropto");
  });
  $("fChips").addEventListener("drop", e => {
    const gEl = e.target.closest(".fgroup");
    if (!drag || !gEl) return;
    e.preventDefault();
    const to = +gEl.dataset.g, d = drag; drag = null; clear();
    if (fMoveConds(d.g, d.c, to)) { fCur = to; saveChips(); }
  });
  $("fChips").addEventListener("dragend", () => { drag = null; clear(); });
}

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
/* 긴 버전 (user request 2026-11-17): a song tagged 'extended version' / 'full version' whose original (origId) is a
   'short version' counts as that original's type here — Tell Your World's full song is VocaDB Remix 8395 of the 61 s
   Original CM, so 곡 종류 오리지널 + 같은 곡 정렬 '긴 버전 먼저' picks the full song. Set once per song (longVersionTypes) */
FKIND.type = ["곡 종류", (it, v) => (VDB_TYPE_KO[it.typeAs || it.type] || it.typeAs || it.type) === v];
const LONG_TAGS = ["extended version", "full version"];
async function longVersionTypes(all, tick) {
  const byId = new Map(all.filter(it => it.vocadb).map(it => [String(it.vocadb), it]));
  for (let i = 0; i < all.length; i++) {
    const it = all[i], o = it.origId && byId.get(String(it.origId));
    if (o && isShortVer(o) && !isShortVer(it) && (it.tags || []).some(t => LONG_TAGS.includes(t))) it.typeAs = o.type;
    if (!(i & 4095)) await tick();
  }
}
/* filter categories: the scope's songs (with counts) + 곡 종류 */
function sfCats(its, base = filterCats(its, true)) {
  // 가사·싱크 상태 is replaced by 곡 상태 here (user request 2026-11-15 — 싱크 · 가사 유무 · 번역명 as tags)
  const cats = base.filter(c => c.id !== "state"), types = countBy(its.map(it => it.type ? [VDB_TYPE_KO[it.type] || it.type] : []));
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
  await VDB.makeAll(tick);
  await longVersionTypes(VDB.all(), tick);  // 숏버전 원곡의 긴 버전은 원곡의 곡 종류로
})());
async function warmSearch() {
  const tick = bgTick();
  await searchBase();
  const all = VDB.all();
  for (let i = 0; i < all.length; i++) { sameKeyOf(all[i], all); if (!(i & 1023)) await tick(); }  // 같은 곡 묶음 (song_filter.js) — once per song
  await warmCats(tick);
  try { await sortedScope(searchTick(searchGen)); } catch (e) { if (e !== STALE) throw e; }
}
/* 음원 관리 › 필터 (user request 2026-11-14 — export/db/filter.json): a category's row {id, label, icon, p} · its symbol */
const fltCat = id => VDB.filter && (VDB.filter.cats || []).find(c => c.id === id);
const catIconOf = x => { const f = fltCat(x.id); return f && f.icon ? f.icon + "︎" : catIcon(x.label); };
/* 하위 태그 색 (user request 2026-11-15 — 음원 관리 › 필터 › 하위 태그 색, filter.json tags {cat_id: {value: color}}) — none: built-in look */
const tagColor = (cat, v) => VDB.filter && VDB.filter.tags && (VDB.filter.tags[cat] || {})[v] || "";
/* a chip in the tag's color (the karaoke-number look) · no color → plain chip (cls: its built-in class) */
const tagChipHtml = (cat, v, text, cls = "", title = "") => { const c = tagColor(cat, v);
  return `<span class="b${cls ? " " + cls : ""}${c ? " tc" : ""}"${c ? ` style="--tc:${esc(c)}"` : ""}${title ? ` title="${esc(title)}"` : ""}>${esc(text)}</span>`; };
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
function ourCmp() {
  const big = 1e9, txt = (a, b) => (a ? 0 : 1) - (b ? 0 : 1) || KO_CMP(a || "", b || "");
  const ord = it => { const o = it.ord || {}; return o.namu != null ? o.namu : o.japan != null ? 1e6 + o.japan : big; };
  const num = it => { const n = it.nums || {}, b = ["TJ", "금영", "DAM", "JOYSOUND", "UGA"].findIndex(x => n[x]); return b < 0 ? [big, big] : [b, parseInt(String(n[["TJ", "금영", "DAM", "JOYSOUND", "UGA"][b]]).replace(/\D/g, ""), 10) || big]; };
  const byTitle = (a, b) => titleGroup(a.title) - titleGroup(b.title) || KO_CMP(a.title, b.title);
  const cmp = {RatingScore: (a, b) => (b.rating || 0) - (a.rating || 0), list: (a, b) => ord(a) - ord(b), Name: () => 0,
    no: (a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1]; },
    PublishDate: (a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (b.date || "").localeCompare(a.date || ""), old: (a, b) => txt(a.date, b.date),
    composer: (a, b) => txt(a.composer, b.composer), singer: (a, b) => txt(a.singer, b.singer)}[$("sSort").value] || (() => 0);
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
  setPlFilter(FG.filter(fReal));  // the playlist remembers the filter it was made with (shown above it)
  PL.set(list.filter(it => !seen.has(keyOf(it)) && seen.add(keyOf(it))).map(it => LOCAL.remember(it)));
  renderSearch($("sInfo").textContent);
  uiAlert(`재생목록을 ${SHELL.queue.length.toLocaleString()}곡으로 만들었습니다.`);
};

/* 재생목록의 필터 (user request 2026-11-15): the filter the playlist was made with — 곡 검색 '재생목록 만들기' or 노래방 모드 —
   shown read-only above the playlist (same group boxes as the search filter). Kept in this browser; 비우기 clears it */
var PLF = store.get("pl.filter", null);
function setPlFilter(groups) {
  PLF = groups && groups.length ? JSON.parse(JSON.stringify(groups)) : null;
  store.set("pl.filter", PLF);
  renderPlFilter();
  if (typeof ltPlChanged === "function") ltPlChanged();  // 같이듣기 방장: guests see it in the room (listen_together.js)
}
/* filter groups → read-only group boxes (also used by 같이듣기 for the host's filter) */
function plfHtml(groups) {
  const grp = g => { const ds = new Set(fDefIdx(g) || []), cs = g.c.filter(c => FKIND[c.k]);
    const one = c => `<span class="fchip"><span class="k">${esc(chipKind(c))}</span>${chipVal(c)}</span>`;
    return `<div class="fgroup${g.x ? " exc" : ""}"><span class="gh">${g.x ? "−" : "＋"}</span>`  // 기본 필터 folded here as well (2026-11-17)
      + cs.filter(c => c.k === "type" && !ds.has(g.c.indexOf(c))).map(one).join("") + (ds.size ? fDefChip(g, false, true) : "")
      + cs.filter(c => c.k !== "type" && !ds.has(g.c.indexOf(c))).map(one).join("") + "</div>"; };
  const inc = groups.filter(g => !g.x), exc = groups.filter(g => g.x);
  return inc.map(grp).join('<div class="fsep">또는</div>') + exc.map(grp).join("");
}
/* how many songs we have (the collected list) — from the song list's index, before its blocks are read */
const vdbTotal = () => VDB.total;
/* 현재 설정된 필터 folds (user request 2026-11-15): folded by default, folds again when 간단 mode is turned on — the header toggles it */
let plfFold = true;
function renderPlFilter() {
  // 같이듣기 손님: the list shown is the host's, so is the filter (user request 2026-11-15)
  const box = $("plFilter"), ch = guestPl && typeof LT !== "undefined" && LT.chOn, f = guestPl ? (typeof LT !== "undefined" && LT.hostPlf) || null : PLF;
  box.hidden = !(f || ch) || !ONLINE;
  box.classList.toggle("fold", plfFold && !ch);
  // OPEN CHANNEL (user request 2026-11-17): its filter stays private — just the tag
  if (ch) { box.innerHTML = `<div class="plfhead">현재 설정된 필터</div>${ltChTag()}`; return; }
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
