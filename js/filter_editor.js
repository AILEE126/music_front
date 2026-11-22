/* 필터 편집기 — 필터를 고치는 화면은 모두 이 코드 하나 (user request 2026-11-21: 필터가 여기저기 있어 고치면 다 같이 고쳐져야 함):
   플레이어 곡 검색 창 (music_front js/filter_panel.js) · 음원 관리 › 필터의 프리셋 · OPEN CHANNEL 편집기
   (music_backend Server/ui/js/filter_manage_panel.js). 두 저장소에 같은 내용의 사본 (music_front js/ · Server/ui/js) — 둘 다 바꿈.
   화면마다 다른 것(카테고리 값이 어디서 오는지 · 바뀐 뒤 할 일 · 이름 붙이기)만 makeFilterEditor(H) 의 H 로 받음.

   필터 = 그룹 [{x: 제외 그룹, m: 그룹으로 남김, c: [{k: 종류, v: 값 | [값, …]}]}] — 그룹 안 조건은 모두 맞아야(교집합),
   포함 그룹끼리는 하나라도 맞으면 보임(합집합), 제외 그룹의 조건에 모두 맞는 곡은 빠짐. cur: 새 조건이 들어갈 그룹.
   곡 종류는 꼭 고르지 않아도 됨 (user request 2026-11-23 — 예전엔 그룹마다 꼭 하나) · 새 필터는 원곡만 조건(F_ORIG_DEF)으로 시작.
   필터에는 정렬 · 몇 번째부터 · 몇 곡도 같이 들어감 (user request 2026-11-22): {groups, sort, from, n} — 예전에 저장한 것은 그룹만 (배열).

   화면 (user request 2026-11-21 — 강력하지만 복잡하고, 카테고리가 뭐가 있는지 한눈에 안 보여 잘 안 쓰게 됨):
   · 원곡만 스위치: 켜면 F_ORIG_DEF 의 조건(같은 노래는 원조 한 곡만 …)이 그룹에 들어가고, 끄면 빠짐 (커버 · 리믹스 포함).
   · 카테고리는 단추로 펼쳐 보임 — 음원 관리 › 필터 카테고리 순서에서 '기본 표시'로 둔 것 (H.more), 나머지는 '더보기' 안에. 누르면 그 값 목록.
   · 그룹 만들기 · 제외 · 같은 곡 정렬/자르기 · 끌어 옮기기는 '고급' 뒤 (그룹이 여럿인 필터는 저절로 고급으로 보임).
   · 값이 F_TAG_MIN 개도 안 되는 태그 분류는 고급에서만 보임. */
var DD_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
/* 원곡만 = 그 곡의 가장 원조인 보카로 버전 (user request 2026-11-16 · 2026-11-18). 음원 관리에서 고치던 예전 기본값 필터는 없앰
   (user request 2026-11-22: 원곡만 스위치가 생겨 필요 없음) — 이 값 하나로 고정. 곡 종류도 원곡만과 같이 들고 남
   (user request 2026-11-23: 모든곡인데 곡 종류가 남아 있었음) — 직접 고른 곡 종류는 그대로 */
const F_ORIG_DEF = [{x: false, c: [{k: "type", v: ["오리지널", "커버", "리믹스", "리마스터"]}, {k: "vkind", v: ["엔진", "섞임"]},
  {k: "same_sort", v: ["재생 가능", "긴 버전 먼저", "원작자 먼저", "먼저 나온 순", "인기순"]}, {k: "same_cut", v: "1"}]}];
const F_ONE_COND = ["type", "same_sort", "same_cut"];  // 그룹에 하나뿐인 조건 — 다시 고르면 값만 바뀜
const F_ADV_CATS = ["same_sort", "same_cut"];  // 고급에서만 고르는 카테고리
/* values worked out by our own code, not VocaDB's tags / data (user request 2026-11-22: a color of their own) */
const F_OWN_CATS = ["ini", "vcount", "vkind", "flag", "state", "ver", "file", "report", "same_sort", "same_cut"];
const fOwn = c => F_OWN_CATS.includes(c.k) ? " own" : "";
const F_TAG_MIN = 10, F_LIST_MAX = 2000;  // 태그 분류의 최소 값 수 · 목록에 한 번에 그리는 줄 수
/* 정렬 · 범위 (user request 2026-11-22: 필터에 같이 저장 — 프리셋 · OPEN CHANNEL · 저장된 필터 모두). n 0 = 끝까지 */
const F_SORTS = [["RatingScore", "인기순"], ["list", "노래방 목록 순"], ["Name", "제목 (가나다)"], ["no", "노래방 번호"], ["PublishDate", "투고일 (최신)"],
                 ["old", "투고일 (오래된)"], ["composer", "프로듀서"], ["singer", "보컬"]];
const F_N_DEF = 1000;
/* a saved filter in any shape → {groups, sort, from, n}: groups only (saved before 2026-11-22 — no sort: shown blank) ·
   {groups, top} (OPEN CHANNEL's 인기순 상위 N곡, 2026-11-20) · {groups, sort, from, n} */
function filterOf(x) {
  if (!x || Array.isArray(x)) return {groups: x || [], sort: "", from: 0, n: 0};
  const int = v => Math.max(0, parseInt(v, 10) || 0);
  return {groups: x.groups || [], sort: x.sort || (x.top > 0 ? "RatingScore" : ""), from: int(x.from), n: int(x.n != null ? x.n : x.top)};
}
/* "인기순 0 - 1000번" — every place a filter is shown (user request 2026-11-22) · no sort saved → "" */
function filterRange(x) {
  const f = filterOf(x), l = (F_SORTS.find(s => s[0] === f.sort) || [])[1];
  if (!l) return "";
  return `${l} ${f.n > 0 ? `${f.from.toLocaleString()} - ${(f.from + f.n).toLocaleString()}번` : f.from > 0 ? `${f.from.toLocaleString()}번부터` : "전체"}`;
}
const F_HELP = "• 조건은 선택된 그룹(밝은 상자)에 들어갑니다&#10;• 한 그룹 안 조건은 모두 맞아야 보입니다 (그리고)&#10;• 그룹끼리는 하나라도 맞으면 보입니다 (또는)&#10;• 빨간 − 그룹에 맞는 곡은 빠집니다&#10;• 그룹을 누르면 선택, 동그라미(＋/−)를 누르면 포함↔제외&#10;• 조건을 끌어 다른 그룹에 놓으면 그 그룹으로 옮겨집니다&#10;• '원곡만'은 원곡만 스위치로만 넣고 뺍니다";
const F_DEF_SVG = '<svg class="fdi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>';

/* 펼친 목록을 칸 바로 아래에. 화면을 줄여 두면(--ui-zoom) 잰 위치와 style 의 px 단위가 달라 그 비율로 나눔 */
function filterPlacePop(p, anchor, minW) {
  const r = anchor.getBoundingClientRect(), z = r.width / anchor.offsetWidth || 1;
  const W = innerWidth / z, H = innerHeight / z, left = r.left / z, top = r.bottom / z + 3;
  const width = Math.max(r.width / z, minW);
  Object.assign(p.style, {left: Math.max(4, Math.min(left, W - width - 4)) + "px", top: top + "px", width: width + "px",
                          maxHeight: Math.max(180, Math.min(380, H - top - 8)) + "px"});
}

/* H: chips · panel (그룹 상자 · 고르는 칸이 그려질 곳) · key (store 이름 앞 글자) · cats() → [{id, label, k, rows: [[값, 곡 수]], lab}] (아직 없으면 null)
   · icon(cat) · more(cat) (더보기 안에 둘 카테고리) · sortBox (정렬 · 범위 칸이 그려질 곳 — 없으면 panel 맨 아래) · keepSort · chipKind(c) · chipLabel(c) · oneLabel(k, v) · condCat(c) → 카테고리 id · known(c) · popParent()
   · onChange(keep) · afterRender() · fold() (접기 단추) · showOrig() · advOnly() · grip(pop, key) */
function makeFilterEditor(H) {
  const E = {groups: [], cur: 0, solo: false, cats: []};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), copy = x => JSON.parse(JSON.stringify(x));
  const known = c => !H.known || H.known(c);
  const phone = () => document.body.classList.contains("m");
  /* the panel: main (drawn again at every change) + the 정렬 · 범위 row (kept — typing in it isn't cut off by a redraw) */
  const main = document.createElement("div"), sortEl = H.sortBox || document.createElement("div");
  H.panel.textContent = ""; H.panel.appendChild(main);
  sortEl.classList.add("fsort");
  if (!H.sortBox) H.panel.appendChild(sortEl);
  let dd = null;  // 펼친 목록 {mode: cats | vals, cat, rows, sel: 체크한 값, hl, akey, anchor(): 붙을 칸, edit: {g, c} 고치는 조건}

  /* ---------- 그룹 ---------- */
  E.def = () => copy(F_ORIG_DEF).map(g => ({...g, m: true}));
  E.base = () => { const d = E.def(); return (d.find(g => !g.x) || d[0]).c; };
  /* 원곡만 조건만 든 그룹은 첫 그룹이 아니면 아직 빈 그룹 — 다른 조건을 고를 때까지 거르지 않음 ('＋ 그룹'만 눌러도 결과가 바뀌지 않게) */
  const baseCond = c => E.base().some(b => b.k === c.k && same(b.v, c.v));
  E.real = (g, i) => i === 0 || g.c.some(c => !baseCond(c));
  E.live = () => E.groups.filter(E.real);
  E.picked = () => E.groups.reduce((n, g) => n + g.c.filter(c => !baseCond(c)).length, 0);  // 원곡만 조건 말고 고른 조건 수
  E.ensure = () => { if (!E.groups.length) { E.groups = E.def(); E.cur = 0; } };  // no group yet → 원곡만
  /* 정렬 · 범위: null (새 필터) → 인기순 0번부터 F_N_DEF 곡 · 정렬 없이 저장된 예전 필터 → 전체 (H.keepSort: 지금 값 그대로) */
  E.sort = "RatingScore"; E.from = 0; E.n = F_N_DEF;
  E.set = x => {
    const f = x ? filterOf(x) : null;
    E.groups = f && f.groups.length ? copy(f.groups).map(g => ({...g, m: true})) : E.def(); E.cur = 0;
    if (!f) { E.sort = "RatingScore"; E.from = 0; E.n = F_N_DEF; }
    else if (f.sort) { E.sort = f.sort; E.from = f.from; E.n = f.n; }
    else if (!H.keepSort) { E.sort = "RatingScore"; E.from = 0; E.n = 0; }
  };
  E.filter = () => ({groups: E.live().map(({x, c}) => ({x, c})), sort: E.sort, from: E.from, n: E.n});  // what gets saved
  E.prune = () => {  // 아직 빈 그룹은 지움 (곡 거르기에는 원래 영향 없음)
    const keep = E.groups[E.cur];
    E.groups = E.groups.filter(E.real);
    E.cur = Math.max(0, E.groups.includes(keep) ? E.groups.indexOf(keep) : E.groups.length - 1);
  };
  E.changed = keep => { E.ensure(); E.render(); if (H.onChange) H.onChange(keep); };
  /* 원곡만 접기 (user request 2026-11-17): a group holding every 원곡만 condition shows them as one '원곡만' chip (with the
     starting 곡 종류 when it is there too). It never unfolds (user request 2026-11-22: the unfolded conditions looked like the
     removed 기본 필터) and is only a label — no ×, no drag: 원곡만 goes in / out with the switch only. → their indices in g.c, or null */
  E.defIdx = g => {
    const idx = bs => {
      const out = [];
      for (const b of bs) { const j = g.c.findIndex(c => c.k === b.k && same(c.v, b.v)); if (j < 0) return null; out.push(j); }
      return out.length ? out : null;
    };
    return idx(E.base()) || idx(baseExtra());
  };
  /* conditions into a group (the 원곡만 switch) — one-per-group kinds take the default's value */
  function putConds(g, conds) {
    let n = 0;
    for (const b of conds) {
      const t = F_ONE_COND.includes(b.k) && g.c.find(c => c.k === b.k);
      if (t) { if (!same(t.v, b.v)) { t.v = copy(b.v); n++; } continue; }
      if (g.c.some(c => c.k === b.k && same(c.v, b.v))) continue;
      g.c.push(copy(b)); n++;
    }
    g.m = true;
    return n;
  }
  /* 조건 끌어 옮기기 (user request 2026-11-17): a condition (or the folded 원곡만 chip — all of them) dragged onto another group moves
     there. A one-per-group condition replaces the one already there */
  function moveConds(from, ci, to) {
    const src = E.groups[from], dst = E.groups[to];
    if (!src || !dst || from === to) return false;
    const moved = (ci < 0 ? E.defIdx(src) || [] : [ci]).map(j => src.c[j]).filter(Boolean);
    if (!moved.length) return false;
    src.c = src.c.filter(c => !moved.includes(c));
    for (const c of moved) {
      const t = F_ONE_COND.includes(c.k) && dst.c.find(x => x.k === c.k);
      if (t) t.v = c.v;
      else if (!dst.c.some(x => x.k === c.k && same(x.v, c.v))) dst.c.push(c);
    }
    E.groups.forEach(g => { g.m = true; });
    return true;
  }
  E.addChip = (k, v) => {  // v: 값 하나 또는 [값, …] (그중 하나라도)
    if (!v || (Array.isArray(v) && !v.length)) return;
    if (Array.isArray(v) && v.length === 1) v = v[0];
    if (!E.groups[E.cur] || !E.groups[E.cur].m) {  // 그룹으로 남긴 게 선택돼 있지 않음 → 이 조건 하나만
      E.groups = E.groups.filter(g => g.m);
      E.groups.push({x: false, m: false, c: [{k, v}]}); E.cur = E.groups.length - 1;
      return E.changed();
    }
    const g = E.groups[E.cur], t = g.c.find(c => c.k === k && F_ONE_COND.includes(k));
    if (k === "same_cut" && Array.isArray(v)) v = v[v.length - 1];  // 자르기는 값 하나
    if (t) { t.v = v; return E.changed(); }  // 곡 종류 · 같은 곡 정렬 · 자르기는 그룹에 하나뿐 — 값만 바꿈
    if (!g.c.some(c => c.k === k && same(c.v, v))) g.c.push({k, v});
    E.changed();
  };

  /* ---------- 원곡만 스위치 (user request 2026-11-21) ----------
     F_ORIG_DEF 의 곡 종류 말고 나머지 조건 (보컬 종류 · 같은 곡 정렬 · 자르기 …) 이 포함 그룹마다 다 들어 있으면 켜짐.
     켜면 곡 종류가 없는 그룹엔 F_ORIG_DEF 의 곡 종류도 · 끄면 그 값 그대로인 곡 종류도 뺌 (직접 고른 곡 종류는 남음).
     곡만 모은 그룹 ('현재 필터에 추가') 과 제외 그룹은 세지 않음. → 1 켜짐 · 0 꺼짐 · -1 일부만 들어 있음 (고급으로 보임) */
  const baseExtra = () => E.base().filter(b => b.k !== "type");
  const hasCond = (g, b) => g.c.some(c => c.k === b.k && same(c.v, b.v));
  const songOnly = g => g.c.some(c => c.k === "song") && g.c.every(c => c.k === "song" || c.k === "type");
  const origGroups = () => E.groups.filter(g => !g.x && !songOnly(g));
  function origState() {
    const gs = origGroups(), ex = baseExtra();
    if (!gs.length || !ex.length) return 0;
    if (gs.every(g => ex.every(b => hasCond(g, b)))) return 1;
    return gs.some(g => ex.some(b => hasCond(g, b))) ? -1 : 0;
  }
  function setOrig(on, quiet) {  // quiet: no redraw · search (the caller does it)
    E.ensure();
    const ex = baseExtra(), bt = E.base().filter(b => b.k === "type");
    for (const g of origGroups()) {
      if (on) putConds(g, g.c.some(c => c.k === "type") ? ex : [...bt, ...ex]);
      else g.c = g.c.filter(c => !E.base().some(b => b.k === c.k && same(b.v, c.v)));
    }
    E.groups.forEach(g => { g.m = true; });
    if (!quiet) E.changed();
  }
  E.setOrig = setOrig;
  const showOrig = () => (!H.showOrig || H.showOrig()) && baseExtra().length > 0;
  /* 고급: 단추로 켠 때 · 그룹이 여럿이거나 제외 그룹이 있는 필터 (안 그러면 안 보이는 조건이 생김) */
  const complex = () => E.live().length > 1 || E.groups.some(g => g.x) || (showOrig() && origState() < 0);
  const advOn = () => !!(H.advOnly && H.advOnly()) || complex() || !!store.get(H.key + "adv", false);

  /* ---------- 그리기 ---------- */
  /* 곡 조건 (user request 2026-11-18): several songs → a small scrolling list, one song per line */
  E.chipVal = c => c.k === "song" && Array.isArray(c.v) && c.v.length > 1
    ? `<span class="v slist">${c.v.map(v => `<span>${esc(H.oneLabel(c.k, v))}</span>`).join("")}</span>` : `<span class="v">${esc(H.chipLabel(c))}</span>`;
  const defTitle = () => "원곡만: " + esc(E.base().map(H.chipLabel).join(" · "));
  function chipHtml(g, c, cls, ed, drag) {
    const j = g.c.indexOf(c), on = j === ed ? " edit" : "";
    // 누르면 고치기, × 빼기, 끌어서 다른 그룹으로
    return `<span class="fchip${cls}${on}" data-c="${j}"${drag ? ' draggable="true"' : ""} title="누르면 이 조건 고치기${drag ? " · 끌어서 다른 그룹으로" : ""}"><span class="k">${esc(H.chipKind(c))}</span>${E.chipVal(c)}<button title="빼기">×</button></span>`;
  }
  function renderChips() {
    const a = advOn(), ed = i => dd && dd.edit && dd.edit.g === i ? dd.edit.c : -1;
    H.chips.classList.toggle("simple", !a);
    if (!a) {  // 그룹 하나: 상자 없이 고른 조건만 — 원곡만 스위치가 대신하는 조건 (처음 값 그대로인 곡 종류도) 은 안 보임
      if (!E.groups[E.cur]) E.cur = 0;
      const ex = origState() > 0 ? E.base() : [];
      const hid = c => ex.some(b => b.k === c.k && same(b.v, c.v));
      H.chips.innerHTML = E.groups.map((g, i) => {
        const cs = g.c.filter(c => known(c) && !hid(c));
        return cs.length ? `<div class="fgroup plain" data-g="${i}">${cs.map(c => chipHtml(g, c, "", ed(i), false)).join("")}</div>` : "";
      }).join("");
      return;
    }
    // 그룹 = 한 줄 상자 (왼쪽 동그라미 ＋ 포함 / − 제외). 포함 상자 사이에만 작은 '또는' 줄, 제외 상자는 맨 아래
    const box = i => {
      const g = E.groups[i], cs = g.c.filter(known), di = E.defIdx(g), dset = new Set(di || []), isDef = c => dset.has(g.c.indexOf(c));
      return `<div class="fgroup${g.x ? " exc" : ""}${i === E.cur ? " cur" : ""}" data-g="${i}" title="${i === E.cur ? "새 조건이 이 그룹에 들어감" : "누르면 이 그룹 선택"}">`
        + `<button class="gh" title="${g.x ? "제외 그룹 — 누르면 포함으로" : "포함 그룹 — 누르면 제외로"}">${g.x ? "−" : "＋"}</button>`
        + cs.filter(c => c.k === "type" && !isDef(c)).map(c => chipHtml(g, c, "", ed(i), true)).join("")
        + (di ? `<span class="fchip fdef" data-def="1" title="${defTitle()}&#10;넣고 빼기는 아래 원곡만 스위치로">${F_DEF_SVG}<span class="k">원곡만</span></span>` : "")
        + cs.filter(c => c.k !== "type" && !isDef(c)).map(c => chipHtml(g, c, "", ed(i), true)).join("")
        + (E.real(g, i) ? "" : '<span class="empty">조건을 고르세요</span>')
        + `<button class="gx" title="그룹 지우기">✕</button></div>`;
    };
    const idx = E.groups.map((g, i) => i), inc = idx.filter(i => !E.groups[i].x), exc = idx.filter(i => E.groups[i].x);
    H.chips.innerHTML = inc.map(box).join('<div class="fsep">또는</div>') + exc.map(box).join("");
  }
  /* 고를 수 있는 카테고리: 고급이 아니면 같은 곡 정렬 · 자르기와 값이 몇 개 없는 태그 분류는 뺌 */
  /* names: the categories known before their values are counted (H.catNames — user request 2026-11-22: the buttons show at
     once, only the value list waits) · pend: the category pressed meanwhile — its list opens when counted */
  let names = null, pend = null;
  const pickCats = a => (names || E.cats).filter(c => a || (!F_ADV_CATS.includes(c.id) && !(c.id.startsWith("tag:") && c.rows && c.rows.length < F_TAG_MIN)));
  const iconOf = c => H.icon ? H.icon(c) : "";
  const isMore = c => !!(H.more && H.more(c));  // under 더보기 (음원 관리 › 필터 카테고리 순서에서 '기본 표시'를 끈 것)
  function renderPanel() {
    const a = advOn(), st = origState(), all = H.cats();
    E.cats = all || [];
    names = all ? null : H.catNames && H.catNames() || null;
    if (all || !names) pend = all ? pend : null;
    const wait = k => pend && pend.akey === k ? " wait" : "";
    const vis = pickCats(a), top = vis.filter(c => !isMore(c)), rest = vis.length - top.length;
    main.innerHTML = `<div class="fbar">`
      // same two-sided switch as OFFLINE | ONLINE, green side = 원곡만 (the default) (user request 2026-11-22)
      + (showOrig() ? `<button type="button" class="onoff forig${st > 0 ? " on" : st < 0 ? " part" : ""}" data-orig aria-pressed="${st > 0}" title="${defTitle()}&#10;모든곡: 커버 · 리믹스 · 사람이 부른 버전까지 모두"><span class="lb off">모든곡</span><span class="lb on">원곡만</span></button>`
        + (st < 0 ? `<small class="forignote">일부 그룹만 원곡만</small>` : "") : "")
      + `<span class="grow"></span>`
      + (H.advOnly && H.advOnly() ? "" : `<button type="button" class="fadv${a ? " on" : ""}" data-adv title="${complex() ? "그룹이 여럿인 필터라 고급으로 보입니다" : "그룹 · 제외 · 같은 곡 정렬 · 자르기 — 필터를 직접 짜기"}">고급${DD_CHEV}</button>`)
      + `<button type="button" class="ib" data-reset title="필터 모두 지우기">↺</button>`
      + (H.fold ? `<button type="button" class="ib" data-fold title="접기">▴</button>` : "") + `</div>`
      + (a ? `<div class="fhead"><button type="button" data-new="inc" title="새 그룹 — 그룹끼리는 하나라도 맞으면 보임">＋ 그룹</button>`
        + `<button type="button" data-new="exc" title="새 제외 그룹 — 이 그룹 조건에 모두 맞는 곡은 빠짐">− 제외</button>`
        + `<span class="grow"></span><span class="fhelp" title="${F_HELP}">?</span></div>` : "")
      + `<div class="fcats">` + (all || names ? top.map(c => `<button type="button" class="fcat${fOwn(c)}${wait("cat:" + c.id)}" data-cat="${esc(c.id)}" title="${esc(c.label)} — ${c.rows ? `값 ${c.rows.length.toLocaleString()}개` : "값 세는 중…"}">${esc(iconOf(c))} ${esc(c.label)}</button>`).join("")
        + (rest > 0 ? `<button type="button" class="fcat more${wait("more")}" data-more title="다른 카테고리 ${rest}개">더보기 ${rest}${DD_CHEV}</button>` : "")
        : `<span class="fcatnote">카테고리 세는 중…</span>`) + `</div>`;
  }
  /* 정렬 · 몇 번째부터 · 몇 곡 (user request 2026-11-22: 상위 n곡 → n번부터 n곡, 필터에 같이 저장) */
  function renderSort() {
    if (sortEl.contains(document.activeElement)) return;
    sortEl.innerHTML = `<select data-sort title="정렬 — 필터에 같이 저장됩니다">${F_SORTS.map(([k, l]) => `<option value="${k}"${k === E.sort ? " selected" : ""}>${l}</option>`).join("")}</select>`
      + `<label title="정렬한 순서에서 몇 번째 곡부터 (0 = 맨 위부터)"><input type="number" data-from min="0" step="1" value="${E.from}">번부터</label>`
      + `<label title="거기서부터 몇 곡 (비우거나 0 = 끝까지)"><input type="number" data-n min="0" step="1" value="${E.n || ""}" placeholder="전체">곡</label>`;
  }
  sortEl.addEventListener("change", e => {
    const t = e.target, int = () => Math.max(0, parseInt(t.value, 10) || 0);
    if (t.matches("[data-sort]")) E.sort = t.value;
    else if (t.matches("[data-from]")) E.from = int();
    else if (t.matches("[data-n]")) E.n = int();
    else return;
    E.changed();
  });
  E.render = () => {
    renderPanel(); renderChips(); renderSort();
    if (pend && !names) { const p = pend, c = E.cats.find(x => x.id === p.id); pend = null; H.panel.querySelectorAll(".fcat.wait").forEach(x => x.classList.remove("wait")); if (c) openVals(c, p.akey, p.anchor); }  // counted: the list asked for meanwhile
    if (dd) { const an = dd.anchor(); if (!an) closeDD(); else { an.classList.add(dd.edit ? "edit" : "open"); renderDD(); } }
    if (H.afterRender) H.afterRender();
  };

  /* ---------- 펼친 목록: 맨 위 검색창 + 항목. 글자를 치면 그 글자가 든 항목만, ↑↓ 로 고르기, Enter, Esc·바깥 누르기로 닫힘.
     값 목록은 체크박스로 여러 개 고른 뒤 '추가' → 그중 하나라도 (OR) 조건 하나 · 줄을 누르면 그 값 하나를 바로 ---------- */
  const pop = () => document.getElementById("fddPop");
  const catBtn = id => [...H.panel.querySelectorAll("[data-cat]")].find(b => b.dataset.cat === id);
  const editCond = () => dd && dd.edit && E.groups[dd.edit.g] && E.groups[dd.edit.g].c[dd.edit.c] || null;
  function closeDD() {
    const p = pop(); if (p) p.remove();
    for (const el of [H.panel, H.chips]) el.querySelectorAll(".fcat.open,.fchip.edit").forEach(x => x.classList.remove("open", "edit"));
    dd = null;
  }
  E.closeDD = closeDD;
  function valRows(cat, ec) {  // 고치는 조건의 값이 이 범위 곡에 없어도 목록에 (안 그러면 '바꾸기'에서 빠짐)
    const rows = cat.rows.map(([v, n]) => ({v: String(v), n, t: cat.lab ? cat.lab(v) : String(v)}));
    if (ec) { const have = new Set(rows.map(r => r.v)); for (const v of [].concat(ec.v)) if (!have.has(String(v))) rows.push({v: String(v), n: 0, t: cat.lab ? cat.lab(v) : String(v)}); }
    return rows;
  }
  function openVals(cat, akey, anchor, edit) {
    const ec = edit && E.groups[edit.g].c[edit.c];
    if (ec) E.solo = ec.k === "solo";
    openDD({mode: "vals", cat, rows: valRows(cat, ec), akey, anchor, edit: edit || null, sel: new Set(ec ? [].concat(ec.v).map(String) : [])});
  }
  function openCats(akey, anchor) {
    const rest = pickCats(advOn()).filter(isMore);
    openDD({mode: "cats", rows: rest.map(c => ({v: c.id, n: c.rows ? c.rows.length : "", t: `${iconOf(c)} ${c.label}`, own: fOwn(c)})), akey, anchor, edit: null, sel: new Set()});
  }
  /* 그룹 안 조건 고치기 (user request 2026-11-14): 조건을 누르면 그 카테고리의 값 목록이 지금 값이 체크된 채로 열리고, '바꾸기'로 그 조건만 바뀜 */
  function editChip(gi, ci) {
    const c = E.groups[gi] && E.groups[gi].c[ci]; if (!c) return;
    const cat = c.k === "song" ? {id: "song", label: "곡", k: "song", rows: [].concat(c.v).map(v => [v, ""]), lab: v => H.oneLabel("song", v)}  // 넣은 곡만 (빼기용)
      : E.cats.find(x => x.id === H.condCat(c));
    if (!cat) return;
    E.cur = gi;
    openVals(cat, `chip:${gi}:${ci}`, () => H.chips.querySelector(`.fgroup[data-g="${gi}"] .fchip[data-c="${ci}"]`), {g: gi, c: ci});
  }
  function applyEdit(e, vs) {
    const g = e && E.groups[e.g], c = g && g.c[e.c];
    if (c) {
      vs = vs.filter(Boolean);
      if (!vs.length) g.c.splice(e.c, 1);  // 다 풀면 조건을 뺌
      else {
        c.v = c.k === "same_cut" ? vs[vs.length - 1] : vs.length === 1 && c.k !== "song" ? vs[0] : vs;
        if (c.k === "singer" || c.k === "solo") c.k = E.solo ? "solo" : "singer";
      }
    }
    E.changed();
  }
  const addValues = (cat, vs) => E.addChip(cat.k === "singer" && E.solo ? "solo" : cat.k, vs.filter(Boolean));
  /* '추가' 단추: 고치는 중이면 '바꾸기' (다 풀면 '조건 빼기') */
  function addBtn() {
    const b = pop() && pop().querySelector(".fdd-add"); if (!b) return;
    const ec = editCond(), n = dd.sel.size;
    b.disabled = !ec && !n;
    b.textContent = ec ? (n ? `바꾸기 ${n}` : "조건 빼기") : n ? `추가 ${n}` : "추가";
    b.title = ec ? "체크한 값으로 이 조건을 바꿈" : "체크한 값들을 조건 하나로 (그중 하나라도 맞으면)";
  }
  const ddHits = () => {  // 찾기 글자에 맞는 줄
    const q = fold(pop().querySelector("input[type=search]").value.trim());
    return q ? dd.rows.filter(r => (r.f || (r.f = fold(r.t))).includes(q)) : dd.rows;
  };
  /* 같은 곡 정렬: 체크한 순서 = 우선순위 — 목록에 '1순위' … 로 보임 */
  const rank = v => dd.mode === "vals" && dd.cat.id === "same_sort" && dd.sel.has(v) ? `<span class="n">${[...dd.sel].indexOf(v) + 1}순위</span>` : "";
  function renderDD() {
    const p = pop(); if (!p || !dd) return;
    const hit = ddHits(), multi = dd.mode === "vals";
    let html = hit.slice(0, F_LIST_MAX).map((r, k) => `<div class="fdd-opt${r.own || ""}${k === dd.hl ? " hl" : ""}" data-v="${esc(r.v)}">`
      + (multi ? `<input type="checkbox" class="fdd-ck"${dd.sel.has(r.v) ? " checked" : ""}>` : "")
      + `${esc(r.t)}${rank(r.v) || (r.n !== "" && r.n != null ? `<span class="n">${r.n}</span>` : "")}</div>`).join("")
      + (hit.length > F_LIST_MAX ? `<div class="fdd-none">… ${(hit.length - F_LIST_MAX).toLocaleString()}개 더 — 찾기 글자로 좁혀 주세요</div>` : "");
    const on = multi ? hit.filter(r => dd.sel.has(r.v)).length : 0;
    if (html && multi)  // 맨 위 '전체 선택' (찾은 값 모두 체크 / 다시 누르면 모두 해제)
      html = `<div class="fdd-all"><input type="checkbox"${on && on === hit.length ? " checked" : ""}> <b>전체 선택</b><span class="n">${hit.length}</span></div>` + html;
    p.querySelector(".fdd-list").innerHTML = html || `<div class="fdd-none">맞는 항목이 없습니다</div>`;
    const a = p.querySelector(".fdd-all input");
    if (a) a.indeterminate = on > 0 && on < hit.length;
  }
  function pick(v) {  // a line picked: 카테고리 → 그 값 목록 · 값 → 그 값 하나를 조건으로
    if (dd.mode === "cats") { const cat = E.cats.find(c => c.id === v), {akey, anchor} = dd; return cat ? openVals(cat, akey, anchor) : waitCat(v, akey, anchor); }
    const cat = dd.cat; closeDD(); addValues(cat, [v]);
  }
  function waitCat(id, akey, anchor) {  // values not counted yet: the button waits, E.render opens the list when they are
    closeDD();
    if (!names) return;
    pend = {id, akey, anchor};
    renderPanel();
  }
  function openDD(d) {
    closeDD();
    dd = {hl: 0, ...d};
    const an = dd.anchor(); if (!an) { dd = null; return; }
    const p = document.createElement("div"), multi = dd.mode === "vals";
    p.id = "fddPop"; p.className = "fddpop";
    p.innerHTML = `<div class="fdd-top"><input type="search" placeholder="${esc(multi ? dd.cat.label : "카테고리")} 검색" spellcheck="false" autocomplete="off">`
      + (multi ? `<button type="button" class="fdd-add" disabled>추가</button>` : "") + `</div>`
      + (multi && dd.cat.k === "singer" ? `<label class="fdd-solo" title="이 보컬 혼자 부른 곡만"><input type="checkbox"${E.solo ? " checked" : ""}> 솔로곡만</label>` : "")
      + `<div class="fdd-list"></div>`;
    p.addEventListener("click", e => { e._fdd = true; });  // the list is redrawn on a click → the clicked node is detached and would look like an outside click
    if (multi) p.querySelector(".fdd-add").onclick = () => { const vs = [...dd.sel], e = dd.edit, cat = dd.cat; closeDD(); e ? applyEdit(e, vs) : addValues(cat, vs); };
    const so = p.querySelector(".fdd-solo input");
    if (so) so.onchange = () => { E.solo = so.checked; };
    (H.popParent ? H.popParent() : document.body).appendChild(p);
    filterPlacePop(p, an, 240);
    if (H.grip) H.grip(p, multi ? "fVal" : "fKind");
    an.classList.add(dd.edit ? "edit" : "open");
    const q = p.querySelector("input[type=search]");
    q.oninput = () => { dd.hl = 0; renderDD(); };
    q.onkeydown = e => {
      const os = [...p.querySelectorAll(".fdd-opt")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        dd.hl = Math.max(0, Math.min(os.length - 1, dd.hl + (e.key === "ArrowDown" ? 1 : -1)));
        os.forEach((o, i) => o.classList.toggle("hl", i === dd.hl));
        if (os[dd.hl]) os[dd.hl].scrollIntoView({block: "nearest"});
      } else if (e.key === "Enter") { e.preventDefault(); if (os[dd.hl]) dd.edit ? os[dd.hl].click() : pick(os[dd.hl].dataset.v); }  // 고치는 중: 체크만
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeDD(); }  // don't close the window it is in too
    };
    p.querySelector(".fdd-list").onclick = e => {
      if (e.target.closest(".fdd-all")) {  // 전체 선택: every value matching the search box
        const hit = ddHits(), all = hit.length && hit.every(r => dd.sel.has(r.v));
        hit.forEach(r => all ? dd.sel.delete(r.v) : dd.sel.add(r.v));
        addBtn(); return renderDD();
      }
      const o = e.target.closest(".fdd-opt"); if (!o) return;
      if (multi && (e.target.closest(".fdd-ck") || dd.edit)) {  // 체크박스: 고르기만 (추가는 '추가' 단추) · 고치는 중이면 줄을 눌러도 체크만
        const ck = o.querySelector(".fdd-ck");
        if (e.target !== ck) ck.checked = !ck.checked;
        ck.checked ? dd.sel.add(o.dataset.v) : dd.sel.delete(o.dataset.v);
        addBtn();
        if (dd.cat.id === "same_sort") renderDD();  // 순위 숫자 다시
        return;
      }
      pick(o.dataset.v);
    };
    addBtn();
    renderDD();
    if (!phone()) q.focus();  // 폰: 누르자마자 키패드가 목록을 가리지 않게 — 검색 칸을 누를 때만 (user report 2026-11-21)
  }
  document.addEventListener("click", e => { if (e._fdd) return; if (dd) closeDD(); if (pend) { pend = null; renderPanel(); } });
  /* 스크롤: 칸이 들어 있는 곳이 움직일 때만 닫음 — 목록 안이나 다른 칸이 움직이는 건 그대로 */
  document.addEventListener("scroll", e => {
    if (!dd) return;
    const an = dd.anchor(), t = e.target === document ? document.documentElement : e.target;
    if (an && t.contains && t.contains(an)) closeDD();
  }, true);
  /* 창 크기 (user report 2026-11-21: 폰에서 목록의 검색 칸을 누르면 키패드가 뜨면서 목록이 바로 닫힘): 너비가 바뀔 때만 닫음 —
     높이만 바뀌면 (폰 키패드가 뜨고 내려감) 열어 둔 채 남은 높이에 맞춰 자리만 다시 잡음 */
  let popW = innerWidth;
  window.addEventListener("resize", () => {
    const sameW = innerWidth === popW; popW = innerWidth;
    if (!dd) return;
    const an = dd.anchor();
    if (!sameW || !an) return closeDD();
    filterPlacePop(pop(), an, 240);
  });

  /* ---------- 누르기 ---------- */
  H.panel.addEventListener("click", e => {
    const t = e.target, cat = t.closest("[data-cat]"), more = t.closest("[data-more]");
    if (cat || more) {
      e._fdd = true;
      const akey = cat ? "cat:" + cat.dataset.cat : "more";
      if (dd && dd.akey === akey) return closeDD();  // the same button again: just close
      if (pend && pend.akey === akey) { pend = null; return renderPanel(); }
      if (more) return openCats(akey, () => H.panel.querySelector("[data-more]"));
      const id = cat.dataset.cat, c = E.cats.find(x => x.id === id);
      return c ? openVals(c, akey, () => catBtn(id)) : waitCat(id, akey, () => catBtn(id));
    }
    if (t.closest("[data-adv]")) {
      const on = !store.get(H.key + "adv", false);
      store.set(H.key + "adv", on);
      if (!on) E.prune();
      closeDD();
      return E.render();
    }
    if (t.closest("[data-orig]")) return setOrig(origState() <= 0);
    if (t.closest("[data-reset]")) { closeDD(); E.groups = []; E.cur = 0; return E.changed(); }
    if (t.closest("[data-fold]")) return H.fold();
    const b = t.closest("[data-new]"); if (!b) return;
    const x = b.dataset.new === "exc";
    E.groups.forEach(g => { g.m = true; });
    if (E.groups[E.cur] && !E.real(E.groups[E.cur], E.cur)) E.groups[E.cur].x = x;  // 비어 있는 선택 그룹은 새로 만들지 않고 종류만 바꿈
    else { E.groups.push({x, m: true, c: E.base()}); E.cur = E.groups.length - 1; }
    E.changed();
  });
  H.chips.addEventListener("click", e => {
    const gEl = e.target.closest(".fgroup"); if (!gEl || gEl.dataset.g == null) return;
    const gi = +gEl.dataset.g, chip = e.target.closest(".fchip");
    if (chip && chip.dataset.def) return;  // a label only — the 원곡만 switch puts it in / takes it out
    if (e.target.closest(".gx")) { E.groups.splice(gi, 1); if (E.cur >= gi) E.cur = Math.max(0, E.cur - 1); }
    else if (chip && e.target.closest("button")) E.groups[gi].c.splice(+chip.dataset.c, 1);
    else if (chip) { e._fdd = true; if (dd && dd.akey === `chip:${gi}:${chip.dataset.c}`) return closeDD(); return editChip(gi, +chip.dataset.c); }
    else if (e.target.closest(".gh")) E.groups[gi].x = !E.groups[gi].x;
    else E.cur = gi;
    closeDD();
    E.changed();
  });
  /* 조건 끌어 옮기기 (user request 2026-11-17) */
  {
    let drag = null;
    const clear = () => H.chips.querySelectorAll(".dropto,.drag").forEach(x => x.classList.remove("dropto", "drag"));
    H.chips.addEventListener("dragstart", e => {
      const ch = e.target.closest(".fchip[draggable]"), gEl = ch && ch.closest(".fgroup");
      if (!ch || !gEl) return;
      drag = {g: +gEl.dataset.g, c: ch.dataset.def ? -1 : +ch.dataset.c};
      e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "");
      ch.classList.add("drag");
    });
    H.chips.addEventListener("dragover", e => {
      const gEl = e.target.closest(".fgroup");
      if (!drag || !gEl || +gEl.dataset.g === drag.g) return;
      e.preventDefault();
      H.chips.querySelectorAll(".fgroup.dropto").forEach(x => x !== gEl && x.classList.remove("dropto"));
      gEl.classList.add("dropto");
    });
    H.chips.addEventListener("drop", e => {
      const gEl = e.target.closest(".fgroup");
      if (!drag || !gEl) return;
      e.preventDefault();
      const to = +gEl.dataset.g, d = drag; drag = null; clear();
      if (moveConds(d.g, d.c, to)) { E.cur = to; E.changed(); }
    });
    H.chips.addEventListener("dragend", () => { drag = null; clear(); });
  }

  /* ---------- 읽기만 하는 필터 표시 (재생목록의 필터 · 같이듣기 · 음원 관리의 OPEN CHANNEL · 사용자 저장 필터) ----------
     raw: every condition as it is · else the 원곡만 conditions under one '원곡만' chip (the conditions in its title) */
  E.roHtml = (x, {raw = false} = {}) => {
    const gs = filterOf(x).groups, range = filterRange(x);
    const box = g => {
      const cs = g.c.filter(known), ds = new Set(raw ? [] : E.defIdx(g) || []), isDef = c => ds.has(g.c.indexOf(c));
      const one = (c, cls = "") => `<span class="fchip${cls}"><span class="k">${esc(H.chipKind(c))}</span>${E.chipVal(c)}</span>`;
      return `<div class="fgroup${g.x ? " exc" : ""}"><span class="gh">${g.x ? "−" : "＋"}</span>`
        + cs.filter(c => c.k === "type" && !isDef(c)).map(c => one(c)).join("")
        + (ds.size ? `<span class="fchip fdef" title="${defTitle()}">${F_DEF_SVG}<span class="k">원곡만</span></span>` : "")
        + cs.filter(c => c.k !== "type" && !isDef(c)).map(c => one(c)).join("") + "</div>";
    };
    const live = gs.filter(g => g.c && g.c.length);
    return live.filter(g => !g.x).map(box).join('<div class="fsep">또는</div>') + live.filter(g => g.x).map(box).join("")
      + (range && live.length ? `<div class="frange" title="정렬 · 몇 번째 곡부터 몇 번째 곡까지">${esc(range)}</div>` : "");
  };
  /* 필터를 한 줄 글로 — the 원곡만 conditions as '원곡만' (raw: spelled out) · 끝에 정렬 · 범위 */
  E.summary = (x, raw) => filterOf(x).groups.filter(g => g.c && g.c.length).map(g => {
    const ds = new Set(raw ? [] : E.defIdx(g) || []), cs = g.c.filter((c, j) => !ds.has(j) && known(c)).map(H.chipLabel);
    if (ds.size) cs.splice(g.c.some((c, j) => c.k === "type" && !ds.has(j)) ? 1 : 0, 0, "원곡만");
    return (g.x ? "− " : "") + cs.join(" · ");
  }).join(" / ") + (filterRange(x) ? " — " + filterRange(x) : "");
  return E;
}
