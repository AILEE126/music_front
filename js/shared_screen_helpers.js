/* 플레이어 화면 도우미 (음원 관리는 서버 화면이라 따로 — Server\ui\js\manage_helpers.js)
   플레이어는 이 파일보다 먼저 STORE_PREFIX(브라우저 저장값 이름 앞머리)를 정함 */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const fmt = s => !isFinite(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/* '2026-11-08 15:20:03' — local time (the server's memo times look the same) */
function nowText(d = new Date()) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}
/* 화면 축소(--ui-zoom) 비율: 마우스 좌표·잰 위치는 창 기준, style 의 px 는 줄인 문서 기준 → 이 값으로 나눔 */
const uiZoom = () => document.documentElement.getBoundingClientRect().width / document.documentElement.offsetWidth || 1;
/* 화면별 작은 기억값 (접힘 상태·음량 등). 개인 창·저장 차단이면 그냥 기본값 */
const store = {
  get(k, d) { try { const v = localStorage.getItem(STORE_PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(STORE_PREFIX + k, JSON.stringify(v)); } catch (e) {} },
};
async function api(path, opt = {}) {
  // 오프라인 곡(고른 mp3 폴더): 그 폴더의 파일로 처리 (offline_folder.js)
  if (typeof OFFDIR !== "undefined" && OFFDIR && isLocalReq(path, opt)) return OFFDIR.request(path, opt);
  // 그 밖(곡 정보·가사·싱크 저장·오버레이 파일·오류 신고): 깃허브 또는 고른 Server\data 폴더 (local_files.js)
  return LOCAL.request(path, opt);
}
const post = (path, body) => api(path, {method: "POST", body: JSON.stringify(body)});

/* 터치 화면(폰): 글 칸은 사용자가 직접 눌렀을 때만 키패드가 뜸 (user request 2026-11-16 — 창·화면을 넘길 때마다 키패드가 떴음).
   코드가 부르는 focus()·select() 와 창(dialog)이 열릴 때 첫 글 칸으로 가는 기본 동작을 터치 화면에서만 막음 (PC 는 그대로) */
(() => {
  const touch = () => matchMedia("(pointer: coarse)").matches;
  const NOKEY = /^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/i;
  const typing = el => !!el && !el.readOnly && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" && !NOKEY.test(el.type));
  for (const P of [HTMLInputElement, HTMLTextAreaElement]) {
    const focus = P.prototype.focus, select = P.prototype.select;
    P.prototype.focus = function (...a) { if (!(touch() && typing(this))) return focus.apply(this, a); };
    // select() on a field that isn't focused would focus it; already focused (tapped) = fine
    P.prototype.select = function () { if (!(touch() && typing(this) && document.activeElement !== this)) return select.call(this); };
  }
  for (const k of ["show", "showModal"]) {
    const open = HTMLDialogElement.prototype[k];
    HTMLDialogElement.prototype[k] = function () {
      if (!touch()) return open.call(this);
      const had = this.hasAttribute("autofocus");
      this.autofocus = true;  // the dialog itself takes the focus, not its first text field
      try { return open.call(this); } finally {
        if (!had) this.removeAttribute("autofocus");
        const a = document.activeElement;
        if (typing(a) && this.contains(a)) a.blur();
      }
    };
  }
})();

/* 알림·확인 창: 브라우저 기본 alert·confirm 은 떠 있는 동안 화면 전체(재생기 포함)를 멈춰
   곡이 끝나도 다음 곡으로 못 넘어가고 영상도 서므로, 화면 안의 창으로 띄움 (Promise: 확인 true / 취소·Esc false) */
function uiDialog(msg, ok, cancel) {
  return new Promise(res => {
    const d = document.createElement("dialog");
    d.className = "uidlg";
    d.innerHTML = `<div class="dlg-body"></div><div class="dlg-foot">${cancel ? `<button data-v="0">${esc(cancel)}</button>` : ""}<button class="primary" data-v="1">${esc(ok)}</button></div>`;
    d.firstChild.textContent = msg;
    d.addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) d.close(b.dataset.v); });
    d.addEventListener("close", () => { d.remove(); res(d.returnValue === "1"); });
    document.body.appendChild(d);
    d.showModal();
    d.querySelector(".primary").focus();
  });
}
const uiAlert = msg => uiDialog(msg, "확인");
/* text input dialog → the typed text (trimmed) / null when cancelled */
function uiPrompt(msg, value = "", placeholder = "") {
  return new Promise(res => {
    const d = document.createElement("dialog");
    d.className = "uidlg";
    d.innerHTML = `<div class="dlg-body"><p></p><input type="text" maxlength="40" autocomplete="off" spellcheck="false" style="width:100%;box-sizing:border-box"></div>
      <div class="dlg-foot"><button data-v="0">취소</button><button class="primary" data-v="1">확인</button></div>`;
    d.querySelector("p").textContent = msg;
    const inp = d.querySelector("input");
    inp.value = value; inp.placeholder = placeholder;
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && inp.value.trim()) d.close("1"); });
    d.addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b && (b.dataset.v === "0" || inp.value.trim())) d.close(b.dataset.v); });
    d.addEventListener("close", () => { d.remove(); res(d.returnValue === "1" ? inp.value.trim() : null); });
    document.body.appendChild(d);
    d.showModal();
    inp.focus();
  });
}
const uiConfirm = (msg, ok = "확인") => uiDialog(msg, ok, "취소");

/* 대표색상 (user request 2026-11-17): one color per person — "" = none (shown as before). Picked in the entry dialog and the
   nickname dialog; small like the server's tag color cell (color box + 기본) with a row of ready-made colors under it */
const ME_COLORS = ["#ff6b6b", "#ff9f68", "#f6c453", "#a3d65c", "#4fd1a5", "#39c5bb", "#4aa8ff", "#5b7cfa", "#9b6dff", "#c77dff", "#f472b6", "#e85d8a"];
const okColor = c => /^#[0-9a-f]{6}$/i.test(String(c || "")) ? String(c).toLowerCase() : "";
function colorField(value = "") {
  let cur = okColor(value);
  const el = document.createElement("div");
  el.className = "mycolor";
  el.innerHTML = `<div class="mcrow"><input type="color" title="색 고르기"><button type="button" class="mcdef">기본</button></div>
    <div class="mcsw">${ME_COLORS.map(c => `<button type="button" data-c="${c}" style="--c:${c}" title="${c}"></button>`).join("")}</div>`;
  const inp = el.querySelector("input"), def = el.querySelector(".mcdef");
  const show = () => {
    inp.value = cur || "#888888"; inp.classList.toggle("none", !cur);
    def.disabled = !cur; def.textContent = cur ? "기본으로" : "기본";
    def.title = cur ? "색 지우기 — 지금처럼 보이기" : "색 안 넣음 (지금처럼)";
    el.querySelectorAll(".mcsw button").forEach(b => b.classList.toggle("on", b.dataset.c === cur));
  };
  inp.addEventListener("input", () => { cur = okColor(inp.value); show(); });
  def.onclick = () => { cur = ""; show(); };
  el.querySelector(".mcsw").onclick = e => { const b = e.target.closest("button[data-c]"); if (b) { cur = b.dataset.c; show(); } };
  show();
  return {el, get value() { return cur; }};
}

/* 가사 글자색 (바탕화면 오버레이와 같음): 서버가 묶음마다 준 보컬 색 vc 1~3개. 여럿이면(듀엣·합창) 한 줄의 글자를
   위(첫 색)→아래(끝 색) 그라데이션으로 칠함 — 줄 높이(1lh)마다 반복돼 여러 줄로 넘어가도 줄마다 같음 */
/* near-black part / vocal colors (Namu's black = 합창) → charcoal: black letters vanished on the dark screen and the
   overlay (user request 2026-11-20, 'a dark gray, about charcoal') — web and overlay alike */
const INK_DARK = "#4a4a4a";
const inkOf = c => {
  if (!/^#[0-9a-f]{6}$/i.test(c || "")) return c;
  const n = parseInt(c.slice(1), 16);
  return Math.max(n >> 16, n >> 8 & 255, n & 255) < 48 ? INK_DARK : c;  // black only — a dark navy etc. stays
};
function lyrLine(cls, text, cs) {
  cs = (cs || []).filter(c => /^#[0-9a-f]{6}$/i.test(c)).map(inkOf);
  if (!cs.length) return `<div class="${cls}">${esc(text)}</div>`;
  if (cs.length === 1) return `<div class="${cls} vc" style="--vc:${cs[0]}">${esc(text)}</div>`;
  const g0 = 22, g1 = 82, n = cs.length;  // 글자가 실제로 차지하는 높이(줄의 22~82%)에 색을 고르게 놓음
  const stops = cs.map((c, k) => `${c} ${(g0 + (g1 - g0) * k / (n - 1)).toFixed(1)}%`).join(",");
  return `<div class="${cls} vc vcm" style="--vc:${cs[0]};--vcg:linear-gradient(to bottom,${stops})">${esc(text)}</div>`;
}
/* 여러 보컬이 서로 다른 가사를 동시에 부르는 묶음(g.cols): 보컬마다 칸을 나란히, 칸마다 그 보컬 색.
   head: 칸 위에 붙일 것 (파트 이름) */
function lyrCols(g, head, roles) {
  return `<div class="lcols" style="--n:${g.cols.length}">` + g.cols.map(c => `<div class="lcol">${head ? head(c.part) : ""}${
    c.lines.filter(l => !roles || roles.includes(l.role)).map(l => lyrLine(l.role, l.text, c.vc)).join("")}</div>`).join("") + "</div>";
}
/* 검색 비교용: 대소문자·전각/반각(Ｍｉｒｒｏｒ = mirror)·띄어쓰기 무시 — 모든 찾기 칸이 씀 (User request: no-space query still matches) */
/* 화면 표시용: 같은 글자가 10번 넘게 이어지면 '누×53' 처럼 줄임 (프로듀서 '누누누…' 같은 긴 이름). mp3 태그·검색·필터 값은 그대로 */
const shortName = s => String(s ?? "").replace(/(.)\1{9,}/gu, (m, c) => `${c}×${[...m].length}`);
/* text that NFKC leaves as it is (ASCII · Hangul syllables · kana without compat / combining marks · common CJK · 、。「」『』)
   skips the normalize call (2026-11-19, sized for 1M songs — same result, checked on 430만 search parts) */
const FOLD_SAFE = /^[\u0000-\u007f\uac00-\ud7a3\u3041-\u3096\u30a1-\u30fa\u30fc\u4e00-\u9fff\u3001-\u3002\u300c-\u300f]*$/;
// User request 2026-11-22: symbols are ignored too ("bad end night" finds "Bad∞End∞Night"), every search box;
// a text that is only symbols keeps them (so "★" still finds "★")
const fold = s => {
  s = String(s ?? ""); s = (FOLD_SAFE.test(s) ? s : s.normalize("NFKC")).toLowerCase();
  return s.replace(/[^\p{L}\p{N}\p{M}]+/gu, "") || s.replace(/\s+/g, "");
};
/* 곡 제목 표시 (user request 2026-11-17, 모든 곡 제목): 앞 이름을 굵게, 옆에 다른 이름을 흐리게 ' · ' 로 — 같은 이름은 한 번.
   앞 이름: VocaDB 기본 이름이 일본어면 한글 제목(번역명, 우리가 가진 것만 — 자동 번역명이 생기면 그건 앞에 두지 않음),
   없으면 기본 이름 / 기본 이름이 영어 등 일본어가 아니면 기본 이름.
   뒤: 기본 이름 > 일본어 이름 > 한글 발음 > 한글 제목 > 영어 이름 > VocaDB 다른 이름. 우리 DB 밖의 곡 (오프라인 mp3) 은 제목 · 원제 · 발음 */
const mainTitle = it => (it.def && !it.defJa ? it.def : it.title) || "";  // also the 제목 sort (filter_panel.js sortTitle)
function titleNames(it) {
  if (!it) return [""];
  const main = mainTitle(it), seen = new Set([fold(main)]);
  const subs = [it.def || it.orig, it.ja, it.reading, it.title, it.en, ...String(it.alt || "").split(",")]
    .map(x => String(x || "").trim()).filter(x => x && !seen.has(fold(x)) && seen.add(fold(x)));
  return [main, ...subs];
}
const titleOf = it => titleNames(it)[0];
const titleSubHtml = it => titleNames(it).slice(1).map(x => `<span>${esc(x)}</span>`).join("");
/* <b>기본 이름</b><span class="tsub">다른 · 이름</span> (.tsub: player_screen.css) */
const titleHtml = it => { const sub = titleSubHtml(it); return `<b>${esc(titleOf(it))}</b>${sub ? `<span class="tsub">${sub}</span>` : ""}`; };
/* 우클릭 메뉴 (곡 연결·플레이어 곡 목록): items [{label, href} 링크 | {label, fn} 누르면 실행 | {label, sub: [...]} 하위 메뉴 | {label} 흐리게].
   마우스 자리에 띄우고 고르거나·밖을 누르거나·Esc·스크롤·창 크기 바꾸면 닫힘 */
function ctxMenu(e, items) {
  e.preventDefault();
  ctxClose();
  const fns = [];
  const html = list => list.map(it => {
    const t = it.title ? ` title="${esc(it.title)}"` : "";
    if (it.sub) return `<div class="ctxsub"><span class="ctxi"${t}>${esc(it.label)}<i>›</i></span><div class="ctxm">${html(it.sub)}</div></div>`;
    if (it.href) return `<a class="ctxi" href="${esc(it.href)}" target="_blank" rel="noopener"${t}>${esc(it.label)}</a>`;
    if (it.fn) return `<button class="ctxi" data-f="${fns.push(it.fn) - 1}"${t}>${esc(it.label)}</button>`;
    return `<span class="ctxi off"${t}>${esc(it.label)}</span>`;
  }).join("");
  const m = document.createElement("div");
  m.className = "ctxm ctxroot";
  m.innerHTML = html(items);
  m.addEventListener("click", e => {
    const b = e.target.closest("button[data-f]");
    if (b) { fns[+b.dataset.f](); ctxClose(); } else if (e.target.closest("a")) setTimeout(ctxClose);
  });
  document.body.appendChild(m);
  // 화면 축소(--ui-zoom): 마우스 좌표는 창 기준, left/top 은 줄인 문서 기준 → 비율로 나눔
  const f = uiZoom();
  const x = Math.min(e.clientX, innerWidth - m.offsetWidth * f - 4), y = Math.min(e.clientY, innerHeight - m.offsetHeight * f - 4);
  m.style.left = Math.max(0, x) / f + "px"; m.style.top = Math.max(0, y) / f + "px";
  if (x + m.offsetWidth * f * 2 > innerWidth) m.classList.add("flip");  // 하위 메뉴가 오른쪽 끝을 넘으면 왼쪽으로
}
/* 글 복사 (클립보드를 못 쓰는 창이면 예전 방식으로) */
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return; } catch (e) {}
  const t = document.createElement("textarea");
  t.value = s; t.readOnly = true; t.style.position = "fixed"; t.style.opacity = "0";  // readOnly: no phone keyboard
  document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
}
function ctxClose() { document.querySelectorAll(".ctxm").forEach(m => m.remove()); }
addEventListener("mousedown", e => { if (!e.target.closest(".ctxm")) ctxClose(); }, true);
addEventListener("keydown", e => { if (e.key === "Escape") ctxClose(); });
addEventListener("scroll", ctxClose, true);
addEventListener("resize", ctxClose);
addEventListener("blur", ctxClose);
/* 나무위키에서 제목으로 찾기 (곡 문서 링크가 없을 때) — Go: 같은 이름의 문서가 있으면 바로 그 문서, 없으면 검색 결과.
   나무위키 문서 이름은 한국어 제목이라 원제(일본어)가 아니라 한국어 제목으로 찾음 */
const namuSearch = q => `https://namu.wiki/Go?q=${encodeURIComponent(q)}`;
/* 곡 우클릭 메뉴: 나무위키 곡 문서(없으면 제목으로 찾기) · 보카로 가사 위키 곡 페이지 · 복사 › 제목·원제·발음·프로듀서·보컬
   (온라인 곡의 발음은 음원 관리 '곡 정보 받기'로 저장한 값) */
function songMenu(e, {namu, vocaro, title, orig, reading, composer, singer}, extra = []) {  // extra: 맨 위에 더 붙일 항목 (플레이어: 대기열에 추가)
  const cp = (label, v) => v ? {label, fn: () => copyText(v), title: v} : {label, title: "없음"};
  const readItem = cp("발음 복사", reading);
  ctxMenu(e, [
    ...extra,
    namu ? {label: "나무위키 문서 열기", href: namu}
         : {label: "나무위키에서 제목으로 찾기", href: namuSearch(title || orig), title: "노래방 목록에 곡 문서 링크가 없어 제목으로 찾음 — 같은 이름의 문서가 있으면 바로 열림 (다른 곡 문서일 수도 있음)"},
    vocaro ? {label: "가사 위키 페이지 열기", href: vocaro} : null,
    {label: "복사", sub: [cp("제목 복사", title), cp("원제 복사", orig), readItem, cp("프로듀서 복사", composer), cp("보컬 복사", singer)]},
  ].filter(Boolean));
}
/* 무작위·반복 버튼 아이콘 (선 아이콘 SVG, 글자색을 따름) */
const MODE_SVG = {
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11V10a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
};
function renderModeButtons(shBtn, rpBtn, shuffle, repeat) {
  shBtn.innerHTML = MODE_SVG.shuffle;
  shBtn.classList.toggle("on", !!shuffle);
  shBtn.title = shuffle ? "무작위 재생: 켜짐" : "무작위 재생: 꺼짐";
  rpBtn.innerHTML = MODE_SVG.repeat + (repeat === "one" ? '<b class="one">1</b>' : "");  // 한 곡 반복: 오른쪽 위에 작은 1
  rpBtn.classList.toggle("on", repeat !== "off");
  rpBtn.title = {off: "반복: 끔 (누르면 전체 반복)", all: "반복: 전체 (누르면 한 곡 반복)", one: "반복: 한 곡 (누르면 끔)"}[repeat];
}
/* 막대의 채운 부분 (.bar-range 의 CSS --p) */
/* 재생 / 일시정지 icon (user request 2026-11-19: the ▶︎ / ❚❚ letters were too big and sat off-centre) — sharp-edged SVG like ⏮ ⏭ (also SVG now), icon only */
const playIcon = paused => paused
  ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15L19.5 12z" fill="currentColor"/></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z" fill="currentColor"/></svg>';
function fillRange(el) {  // --p: percent (bar-range) · --pf: 0…1 (설정 sliders)
  const f = (el.value - el.min) / (el.max - el.min) || 0;
  el.style.setProperty("--p", f * 100 + "%"); el.style.setProperty("--pf", f);
}
/* 음량 버튼·막대 그리기: 소리 크기에 따라 물결 0~2개, 음소거면 X */
function renderVolume(btn, range, audio) {
  const v = audio.muted ? 0 : audio.volume;
  range.value = v; fillRange(range);
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/>'
    + (v === 0 ? '<path d="m16 9 5 6M21 9l-5 6"/>' : '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>' + (v > .5 ? '<path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : "")) + "</svg>";
}

/* ---- 설정 창 (⚙, user request 2026-11-18: 가사 · 오버레이 as separate parts — 2026-11-19: 글꼴 (fonts + 굵기) first — PC: the parts listed on the left,
   one shown at a time · phone: every part foldable) ----
   가사 오버레이 = tools\lyrics_overlay.bat 로 켜는 파워쉘 창 (바탕 투명 · 어느 브라우저든). 이 창에서 바꾸면 곧바로 반영.
   local_files.js 가 오버레이의 창구(127.0.0.1:47613)로 보냄 → 오버레이가 overlay\lyrics_overlay.json 에 씀 (꺼져 있으면 이 브라우저에만).
   설정 창은 오버레이를 따로 띄우지 않음 (user request 2026-11-19 — forcing it on while the window was open looked like a bug):
   the 오버레이 part ends with a preview drawn like the overlay (ovPreview) that follows every slider at once.
   켜기·끄기는 가사 도구 줄의 [오버레이] 단추 (2026-11-18 — not in this window any more) */
/* 설정 새 항목 알림 (user request 2026-11-19): a setting added later, or a font registered in Manage › 글꼴, counts as new
   until its part of the settings is looked at — the count is a badge on ⚙ (phone: the 설정 menu) and on the part, and the
   new rows are marked '새로' while that window is open. A new setting = add its key here (ov · font = the ⚙ window's parts,
   m = the phone 설정 page, data-nk in player_screen.html). The first time, everything there counts as seen. */
const SET_KEYS = {
  ov: ["ov.lead", "ov.target", "ov.clickthrough", "ov.info", "ov.size", "ov.info_size", "ov.outline", "ov.opacity", "ov.width_pct", "ov.align", "ov.reset"],  // ov.width_pct: 가로 폭 became % (2026-11-20)
  font: ["font.ja", "font.etc", "font.bold_ja", "font.bold_etc"],
  m: ["m.report", "m.overlay", "m.zoom", "m.ear.connectPlay", "m.ear.unplugPause", "m.ear.ask"],
  play: ["play.fadein", "play.fadeout"],  // ⚙ › 재생 (2026-11-19)
  addon: ["addon.get"],  // ⚙ › 추가기능 (2026-11-19, PC only)
  app: ["app.apk"],  // ⚙ › 앱 설치 (2026-11-22, web only — PC and phone)
};
/* ⚙ › 추가기능 (user request 2026-11-19): the PC add-ons (overlay + extension, play_engine.js openSetupGuide) — not on phones */
const addonOk = () => typeof openSetupGuide === "function" && !APP.on && !BILI_TOUCH();
const SETNEW = {fonts: []};
function setKeys(all = false) {
  const phone = !all && (APP.on || document.body.classList.contains("m"));
  return {
    ov: SET_KEYS.ov.filter(k => all || !(phone && k === "ov.target")),  // 앞에 있을 때만: PC only
    font: [...SET_KEYS.font, ...SETNEW.fonts.map(f => "font:" + f.id)],
    m: all || phone ? SET_KEYS.m : [],
    // 페이드 is an extension feature → shown in 추가기능 where that part exists (user request 2026-11-19)
    play: all || !addonOk() ? SET_KEYS.play : [],
    addon: all ? SET_KEYS.addon : addonOk() ? [...SET_KEYS.addon, ...SET_KEYS.play] : [],
    app: all || !APP.on ? SET_KEYS.app : [],
  };
}
const setNew = sec => { const seen = new Set(store.get("set.seen", [])); return (sec ? setKeys()[sec] || [] : Object.values(setKeys()).flat()).filter(k => !seen.has(k)); };
function setSeen(keys) {
  const seen = new Set(store.get("set.seen", []));
  if (!keys.some(k => !seen.has(k))) return;
  keys.forEach(k => seen.add(k)); store.set("set.seen", [...seen]); setBadge();
}
/* the badges: ⚙ (PC toolbar) · the phone menu's 설정 and its '가사 · 오버레이 설정' button */
function setBadge() {
  const put = (el, n) => { if (el) { el.hidden = !n; el.textContent = n; } };
  const win = setNew("ov").length + setNew("font").length + setNew("play").length + setNew("addon").length + setNew("app").length;
  put(document.getElementById("setBadge"), win);
  put(document.getElementById("mSetBadge"), win + setNew("m").length);
  put(document.getElementById("mOvBadge"), win);
}
/* at start, once our data can be read (registered fonts come from it) */
async function setNewInit() {
  if (typeof fontList === "function") SETNEW.fonts = await fontList().catch(() => []);
  if (store.get("set.seen", null) === null) store.set("set.seen", Object.values(setKeys(true)).flat());
  setBadge();
}
/* 오버레이 미리보기 (user request 2026-11-19): a two-part example (하츠네 미쿠 · KAITO, sung at once), drawn the way
   the overlays draw them — outline · letters see-through together (opacity), info line, lyric size, width — from the
   window's current values, redrawn on every slider move. Lyrics font = the overlays' (the ⚙ 글꼴 picks, --font-user).
   발음 · 번역 rows follow the player's 발음 · 번역 checks like the overlay */
function ovPreview(d) {
  const box = d.querySelector("[data-ovprev]"); if (!box) return;
  const v = k => d.querySelector(`[data-k="${k}"]`), num = (k, def) => +(v(k) || {}).value || def, a = Math.max(.1, Math.min(1, num("opacity", 100) / 100));
  const chk = id => { const e = document.getElementById(id); return !e || e.checked; };
  const line = (text, size, weight, op, color) => `<div class="ovl" style="font-size:${size}px;font-weight:${weight};--o:${2 * Math.max(0, +(v("outline") || {}).value || 0)}px;${color ? `--c:${color};` : ""}">`
    + `<span class="grp" style="opacity:${(op * a).toFixed(3)}"><span class="edge">${esc(text)}</span><span class="fill">${esc(text)}</span></span></div>`;
  // two parts sung at once, side by side like the overlay draws them (user request 2026-11-19): part name small on top,
  // each column centred on its own, a gap between
  const s = Math.max(6, num("size", 22)), parts = [
    {name: "하츠네 미쿠", color: "#39c5bb", o: "初音ミクです！", r: "하츠네 미쿠데스!", t: "하츠네 미쿠예요!"},
    {name: "KAITO", color: "#4f6fd8", o: "カイトです。", r: "카이토데스.", t: "카이토예요."}];
  let h = v("info") && v("info").checked ? line("미리보기 · プレビュー · Preview — 곡 정보 줄", Math.max(6, num("info_size", 12)), 600, .9, "") : "";
  h += `<div class="ovcols" style="column-gap:${Math.round(s * 1.5)}px">` + parts.map(p => `<div class="ovcol">`
    + (chk("showP") ? line(p.name, Math.max(9, Math.round(s * .5)), 700, .9, p.color) : "")
    + line(p.o, s, 700, 1, p.color) + (chk("showR") ? line(p.r, s, 600, .85, p.color) : "") + (chk("showT") ? line(p.t, s, 600, 1, p.color) : "") + "</div>").join("") + "</div>";
  const av = (d.querySelector('[data-k="align"]:checked') || {}).value || "center", al = {left: "flex-start", right: "flex-end"}[av] || "center";  // 정렬 (2026-11-20)
  box.innerHTML = `<div class="ovprevhd">미리보기</div><div class="ovbox" style="width:${Math.min(100, num("width_pct", 60))}%;--al:${al};--ta:${av}">${h}</div>`;  // 가로 폭 = % of the screen (2026-11-20) → % of the preview
}
const OVSET_DEFAULTS ={x: -1, y: -1, width: 1100, width_pct: 60, align: "center", size: 22, info_size: 12, outline: 2, opacity: 100, clickthrough: false, target: "ffxiv_dx11", info: true, editing_at: 0, quit_at: 0, enabled: true, font_ja: "", font_etc: "", font_bold_ja: false, font_bold_etc: false};  // font_*: font_setting.js
async function openPlayerSettings(want = "") {  // want: the part to show (e.g. "addon" from the Bilibili warning)
  let c, progs = [];
  LOCAL.ovEnable();  // from now on this browser talks to the overlay (no folder picking — user request)
  try { c ={...OVSET_DEFAULTS, ...(await api("/api/ovset"))}; } catch (e) { return uiAlert(e.message); }
  try { progs = (await api("/api/ovprograms")).items || []; } catch (e) {}
  const opts = progs.slice();
  if (c.target && !opts.some(p => p.exe === c.target.replace(/\.exe$/i, "")))
    opts.unshift({exe: c.target.replace(/\.exe$/i, ""), title: "지금 꺼져 있음"});
  // phone (app or the narrow screen — user request 2026-11-15): no '프로그램이 앞에 있을 때만' — always shown
  const phoneUi = APP.on || document.body.classList.contains("m");
  if (phoneUi && c.target) { c.target = ""; post("/api/ovset", {target: ""}).catch(() => {}); }
  const d = document.createElement("dialog");
  d.className = "uidlg ovset " + (phoneUi ? "setfold" : "setnav");
  const lead = typeof SHELL !== "undefined" && SHELL.setLead;  // 플레이어 화면에서만
  const fonts = typeof fontSettingsHtml === "function" ? await fontSettingsHtml() : "";  // 글꼴 (font_setting.js, player only)
  const addon = lead && addonOk();
  const secs = [fonts && ["font", "글꼴"], lead && !addon && ["play", "재생"], ["ov", "오버레이"], addon && ["addon", '추가기능<small class="setsub">확장프로그램 필요</small>'], !APP.on && ["app", "앱 설치"]].filter(Boolean);  // 앱 설치: its own part so phones see it too (user request 2026-11-22)  // 추가기능: last (2026-11-19)  // 재생: 페이드 (2026-11-19, player only)  // 가사 먼저 보이기 moved into 오버레이 (user request 2026-11-18) · 글꼴 first (2026-11-19; named 가사 for a while)
  if (fonts) SETNEW.fonts = FONT.list || [];  // just read fresh by fontSettingsHtml
  const fresh = Object.fromEntries(secs.map(([k]) => [k, setNew(k)]));  // new items, as they were when the window opened
  const nb = k => `<b class="setnb"${fresh[k].length ? "" : " hidden"}>${fresh[k].length}</b>`;
  // extension features (user request 2026-11-19): 페이드 in 추가기능 on a PC (its own 재생 part only where 추가기능 isn't shown — app).
  const fadeHtml = `
    <label class="rng" title="곡이 시작할 때 소리를 0 에서 서서히 키움 (0 = 끔)">페이드 인 <b data-fade-v="fadeIn"></b><input type="range" min="0" max="5" step="0.5" data-fade="fadeIn"></label>
    <label class="rng" title="곡이 끝나기 전 이만큼 동안 소리를 서서히 줄임 (0 = 끔)">페이드 아웃 <b data-fade-v="fadeOut"></b><input type="range" min="0" max="8" step="0.5" data-fade="fadeOut"></label>`;
  const sec = (k, html) => `<section class="setsec" data-sec="${k}"><button type="button" class="sethead" data-fold="${k}">${secs.find(s => s[0] === k)[1]}${nb(k)}</button><div class="setbody">${html}</div></section>`;
  d.innerHTML = `<div class="dlg-head hx">설정<button class="ib dlgx" data-act="close" title="닫기 (Esc)" aria-label="닫기">✕</button></div><div class="dlg-body">
    <nav class="setlist">${secs.map(([k, t]) => `<button type="button" data-pick="${k}">${t}${nb(k)}</button>`).join("")}</nav><div class="setpanes">${fonts ? sec("font", fonts) : ""}${lead && !addon ? sec("play", fadeHtml) : ""}${sec("ov", `${lead ? `
    <label class="rng" title="싱크는 그대로 두고, 재생할 때 가사만 이만큼 먼저 넘어감 (0.10 ~ 1.00초, 0.01초 단위 · 기본 0.50초)">가사 먼저 보이기 <b data-lead></b><input type="range" min="0.1" max="1" step="0.01" data-lead-r></label>` : ""}
    <p class="muted">바탕이 투명한 가사 창 (어느 브라우저든) — 켜기·끄기는 가사 도구 줄의 [오버레이] 단추. 바꾼 모습은 맨 아래 미리보기에서 바로 보여요.</p>
    <label class="sel"${phoneUi ? " hidden" : ""}>이 프로그램이 앞에 있을 때만 보이기 <select data-k="target">
      <option value="">(늘 보임)</option>${opts.map(p => `<option value="${esc(p.exe)}">${esc(p.exe)}${p.title ? ` — ${esc(p.title)}` : ""}</option>`).join("")}</select>
      <span class="muted">그 프로그램이 꺼져 있으면 늘 보임 · 목록은 오버레이가 켜져 있을 때 채워짐</span></label>
    <label class="inline"><input type="checkbox" data-k="clickthrough"> 클릭 통과 (가사를 눌러도 뒤 창으로 — 끄면 가사를 끌어 옮김)</label>
    <label class="inline"><input type="checkbox" data-k="info"> 곡 정보 줄 (제목 — 프로듀서 feat. 가수)</label>
    <label class="rng">글자 크기 <b data-v="size"></b><input type="range" min="6" max="30" step="1" data-k="size"></label>
    <label class="rng">곡 정보 줄 글자 크기 <b data-v="info_size"></b><input type="range" min="6" max="30" step="1" data-k="info_size"></label>
    <label class="rng">테두리 두께 <b data-v="outline"></b><input type="range" min="0" max="6" step="0.5" data-k="outline"></label>
    <label class="rng">불투명도 <b data-v="opacity"></b><input type="range" min="10" max="100" step="5" data-k="opacity"></label>
    <label class="rng" title="오버레이가 있는 모니터 가로의 몇 %인지 (4K · 와이드 · 듀얼 모니터 어디서나 같은 비율)"${phoneUi ? " hidden" : ""}>가로 폭 <b data-v="width_pct"></b><input type="range" min="20" max="100" step="5" data-k="width_pct"></label>
    <div class="ovalign" title="가사 줄을 오버레이 구역의 어디에 맞출지">정렬 <div class="seg"><!-- joined buttons like 발음 · 번역 · 파트, one at a time (user request 2026-11-20) -->
      ${[["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]].map(([v, t]) => `<label><input type="radio" name="ovAlign" data-k="align" value="${v}" hidden>${t}</label>`).join("")}</div></div>
    <p class="muted">발음·번역 줄은 플레이어의 '발음'·'번역' 체크를 따릅니다.</p>
    <div class="row"><button data-act="reset">위치 처음으로 (화면 아래 가운데)</button></div>
    <div class="ovprev" data-ovprev aria-hidden="true"></div>`)}${addon ? sec("addon", `
    <p class="muted">가사 오버레이(바탕이 투명한 가사 창)와 확장 프로그램은 따로 받아요. 아래 단추를 누르면 이 PC에 아직 없는 것만 차례로 알려 줘요. 확장 프로그램이 있어야 니코니코 · 유튜브 · SoundCloud · Vimeo · 비리비리 영상에 배속 · 키 변경이 되고, 비리비리 볼륨 조절 · 유튜브 광고 건너뛰기도 돼요.</p>
    <ul class="addst" data-addst><li class="muted">확인하는 중…</li></ul>
    <div class="row"><button class="primary" data-act="addon">추가기능 내려받기 · 넣기</button></div>
    <p class="muted">한 번 넣으면 새 버전은 둘 다 저절로 받아요. 예전에 넣은 것이면 위에 '새 버전이 있어요'가 뜨고, 단추를 누르면 바꾸는 법이 나와요.</p>
    <div class="setsubhd">확장 프로그램 기능</div>${fadeHtml}
    <p class="muted">배속 · 키 변경은 재생 막대의 버튼에서.</p>`) : ""}${APP.on ? "" : sec("app", `
    <p class="muted">안드로이드 폰에 까는 앱이에요. 늘 가장 새 버전이 받아져요.</p>
    <div class="row"><button class="primary" data-act="apk">앱 설치 파일 받기 (apk)</button></div>
    <p class="muted">폰에서 받은 파일을 열면 설치되고, 예전 앱이 있으면 그 위에 덮어 설치돼요 (설정 · 재생목록은 그대로). 처음 한 번은 '출처를 알 수 없는 앱' 허용을 물어볼 수 있어요.</p>`)}</div></div>`;
  // new rows: marked '새로' while this window is open (a new font: its pick and the option)
  const rowOf = {"play.fadein": "[data-fade=fadeIn]", "play.fadeout": "[data-fade=fadeOut]", "ov.lead": "[data-lead-r]", "ov.reset": "[data-act=reset]", "ov.align": ".ovalign", "font.ja": "select[data-font=ja]", "font.etc": "select[data-font=etc]", "font.bold_ja": "[data-fbold=ja]", "font.bold_etc": "[data-fbold=etc]", "addon.get": "[data-act=addon]", "app.apk": "[data-act=apk]"};
  for (const k of Object.values(fresh).flat()) {
    if (k.startsWith("font:")) {
      const o = d.querySelector(`select[data-font] option[value="${CSS.escape(k.slice(5))}"]`);
      if (o) { o.textContent += " (새로)"; o.closest(".frow, label").classList.add("isnew"); }
      continue;
    }
    const el = d.querySelector(rowOf[k] || `[data-k="${k.slice(3)}"]`);
    if (el) (el.closest(".frow, label") || el).classList.add("isnew");
  }
  // a part counts as seen once it is shown (PC) or opened (phone) — its badge goes, the row marks stay till the window closes
  const seen = k => { setSeen(fresh[k]); d.querySelectorAll(`[data-pick="${k}"] .setnb,[data-fold="${k}"] .setnb`).forEach(b => b.hidden = true); };
  // PC: the picked part only (remembered) · phone: each part folds by its title (open ones remembered)
  const pick = k => {
    store.set("set.sec", k);
    d.querySelectorAll("[data-pick]").forEach(b => b.classList.toggle("on", b.dataset.pick === k));
    d.querySelectorAll(".setsec").forEach(s => s.classList.toggle("cur", s.dataset.sec === k));
    if (!phoneUi) seen(k);
  };
  const opened = new Set(store.get("set.open", ["ov"]));
  d.querySelectorAll(".setsec").forEach(s => s.classList.toggle("open", opened.has(s.dataset.sec)));
  if (phoneUi) secs.forEach(([k]) => opened.has(k) && seen(k));
  const first = [want, store.get("set.sec", "")].find(k => secs.some(s => s[0] === k));
  if (phoneUi && want && first === want) { opened.add(want); d.querySelector(`.setsec[data-sec="${want}"]`).classList.add("open"); seen(want); }
  pick(first || secs[0][0]);
  // 추가기능: what this PC has (overlay running / up to date · extension version) — again after the guide
  const addonState = async () => {
    const ul = d.querySelector("[data-addst]"); if (!ul) return;
    const ov = await ovNeed(), ext = extNeed();
    const line = (name, st, ok) => `<li class="${ok ? "ok" : "warn"}"><b>${name}</b> ${st}</li>`;
    ul.innerHTML = line("가사 오버레이", {"": "켜져 있음 · 최신", old: "새 버전이 있어요", off: "꺼져 있음 ([오버레이] 단추로 켜요)", new: "아직 없음"}[ov], !ov || ov === "off")
      + line("확장 프로그램", {"": "있음 · 최신", old: "새 버전이 있어요", new: "아직 없음"}[ext], !ext);
  };
  if (addon) addonState();
  d.addEventListener("click", e => {
    const p = e.target.closest("[data-pick]"); if (p) return pick(p.dataset.pick);
    const f = e.target.closest("[data-fold]"); if (!f) return;
    const s = f.closest(".setsec"), on = s.classList.toggle("open");
    on ? opened.add(s.dataset.sec) : opened.delete(s.dataset.sec);
    if (on) seen(s.dataset.sec);
    store.set("set.open", [...opened]);
  });
  if (fonts) fontSettingsBind(d);
  const ins = [...d.querySelectorAll("[data-k]")];
  for (const i of ins) { if (i.type === "checkbox") i.checked = !!c[i.dataset.k]; else if (i.type === "radio") i.checked = i.value === (c[i.dataset.k] || "center"); else i.value = String(c[i.dataset.k]).replace(/\.exe$/i, ""); }
  const showVals = () => d.querySelectorAll("[data-v]").forEach(b => b.textContent = d.querySelector(`[data-k=${b.dataset.v}]`).value + (b.dataset.v === "opacity" || b.dataset.v === "width_pct" ? "%" : ""));
  showVals(); ovPreview(d);
  d.querySelectorAll("[data-fade]").forEach(r => {  // 페이드 (browser keys fadeIn · fadeOut — play_engine.js fadeSecs)
    const k = r.dataset.fade, v = d.querySelector(`[data-fade-v=${k}]`), show = () => v.textContent = +r.value ? (+r.value).toFixed(1) + "초" : "끔";
    r.value = +store.get(k, 0) || 0; show();
    r.addEventListener("input", () => { store.set(k, +r.value); show(); SHELL.audio.fadeTick(); });
  });
  if (lead) {  // 가사 먼저 보이기: 오버레이 설정 파일이 아니라 재생기 값 (브라우저 저장값 · play_engine.js setLead)
    const r = d.querySelector("[data-lead-r]"), showLead = () => d.querySelector("[data-lead]").textContent = SHELL.lead.toFixed(2) + "초";
    r.value = SHELL.lead; showLead();
    r.addEventListener("input", () => { SHELL.setLead(r.value); showLead(); });
  }
  let t = 0;
  const values = () => Object.fromEntries(ins.filter(i => i.type !== "radio" || i.checked).map(i => [i.dataset.k, i.type === "checkbox" ? i.checked : i.type === "range" ? +i.value : i.value]));
  const save = (extra = {}, now = false) => {  // 바꿀 때마다 (끌어 움직이는 동안은 0.25초에 한 번)
    clearTimeout(t);
    const go = () => post("/api/ovset", {...values(), ...extra}).catch(e => uiAlert(e.message));
    if (now) return go();
    t = setTimeout(go, 250);
  };
  ins.forEach(i => i.addEventListener(i.type === "range" ? "input" : "change", () => { showVals(); ovPreview(d); save(); if (i.tagName === "SELECT") i.blur(); }));
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "addon") {
      openSetupGuide("추가기능", () => { if (SHELL.audio.biliGuide) SHELL.audio.recheckBili(); });  // a Bilibili song waiting: try again
      return setupDlg.addEventListener("close", addonState, {once: true});
    }
    // 앱 apk (user request 2026-11-22): always the newest — music_app's build overwrites this one public file (VC_APK)
    if (b.dataset.act === "apk") return void (location.href = VC_APK);
    if (b.dataset.act === "reset") save({x: -1, y: -1}); else d.close();
  });
  // 구역 표시 (user request 2026-11-20): while this window is open the PC overlay draws a blue dashed line round its window
  // (size check) — it only draws it, nothing is forced on. Phones: the overlay is full width, nothing to show
  const frame = on => phoneUi ? null : post("/api/frame", {on}).catch(() => {});
  const frameBeat = phoneUi ? 0 : setInterval(() => frame(true), 3000);
  frame(true);
  d.addEventListener("close", () => { clearTimeout(t); clearInterval(frameBeat); frame(false); save({editing_at: 0}, true); d.remove(); });  // editing_at 0: clears what older players left
  // sliders: the part left of the knob filled (--p, user request 2026-11-19 — the plain browser slider looked bad)
  d.querySelectorAll("input[type=range]").forEach(r => { fillRange(r); r.addEventListener("input", () => fillRange(r)); });
  document.body.appendChild(d);
  d.showModal();
}

/* ---- 가사 오버레이 켜기/끄기 단추 (가사 도구 줄의 [오버레이] — 2026-11-18 its own button again, out of the settings window) ----
   오버레이 프로그램은 한 번 켜 두면 뒤에서 계속 돌고(서버를 켜면 서버가 띄움 · 서버 없이는 lyrics_overlay.bat 한 번),
   이 단추는 설정 파일의 enabled(보이기·숨기기)만 바꿈 → 어느 브라우저든, 서버가 없어도 바로 됨.
   프로그램이 돌고 있는지: 창구(127.0.0.1:47613)가 답하면 돌고 있음.
   프로그램이 꺼져 있을 때 '켜기': 'musicoverlay:' 링크 (못 켜 주는 브라우저면 bat 안내)
   추가기능 안내 (user request 2026-11-19, play_engine.js openSetupGuide — player only): the overlay never ran in this
   browser → the guide at once (the zip with the overlay + extension, run the bat …); the link failed → the guide too;
   the running overlay is older than this player's tools/ files → the guide once per page (download again, overwrite) */
/* 창 번호 (user request 2026-11-22): with several player pages open (GitHub Pages · file:// · two tabs) every page that ever
   used the overlay told it its lyrics and the overlay flickered between them — now only the page whose [오버레이] was turned
   on last (owner in the overlay's settings) is shown; the others stop sending. Kept across reloads of this tab
   (sessionStorage); a duplicated tab copies it, so a new page asks the open ones first and takes a new number if it's taken */
const OVWIN = {id: "", owner: ""};
{
  const mk = () => Math.random().toString(36).slice(2, 10);
  const keep = id => { OVWIN.id = id; try { sessionStorage.setItem("ovWin", id); } catch (e) {} };
  try { keep(sessionStorage.getItem("ovWin") || mk()); } catch (e) { keep(mk()); }
  try {
    const ch = new BroadcastChannel("ovWin");
    let fresh = true; setTimeout(() => { fresh = false; }, 3000);
    ch.onmessage = e => { const m = e.data || {}; if (m.ask === OVWIN.id) ch.postMessage({dup: m.ask}); else if (fresh && m.dup === OVWIN.id) keep(mk()); };
    ch.postMessage({ask: OVWIN.id});
  } catch (e) {}
}
const ovMine = () => !OVWIN.owner || OVWIN.owner === OVWIN.id;  // no owner yet (older overlay): every page, as before
function bindOverlayPower(btn, label) {  // label: fixed text, on/off by color only (toolbar)
  let alive = false, enabled = true, starting = 0, ver = 0, oldShown = false;
  const guide = () => typeof openSetupGuide === "function" && OV_PC();
  const on = () => alive && enabled && ovMine();  // another page holds it → off here (pressing takes it over)
  const show = () => {
    btn.textContent = starting ? "오버레이 켜는 중…" : label || (on() ? "오버레이 끄기" : "오버레이 켜기");
    btn.classList.toggle("on", on()); btn.setAttribute("aria-pressed", on());
    btn.title = on() ? "가사 오버레이 숨기기" : "가사 오버레이 보이기 (바탕 투명 가사 창)";
  };
  const check = async () => {
    const was = alive;
    try {
      const [r, c] = await Promise.all([api("/api/ovprograms"), api("/api/ovset")]);
      alive = !!r.running; enabled = c.enabled !== false; ver = +r.ver || 0; OVWIN.owner = String(c.owner || "");
      if (alive) store.set("ovSeen", true);
    } catch (e) { alive = false; }
    if (alive && !was && typeof fontToOverlay === "function") fontToOverlay();  // overlay (re)started: give it the picked fonts
    if (on()) starting = 0;
    show();
  };
  btn.onclick = async () => {
    if (starting) return;
    const first = !LOCAL.ovOn;
    LOCAL.ovEnable();  // from now on this browser talks to the overlay (no folder picking — user request)
    await check();
    if (guide() && alive && !oldShown && await ovNeed() === "old") { oldShown = true; openSetupGuide("오버레이"); }  // the guide's own test (8+ updates itself) — else it opened saying '모두 최신'
    if (guide() && !alive && !store.get("ovSeen", false)) return openSetupGuide("오버레이");  // never ran here: nothing to start yet
    if (first && on()) return show();  // first press while the bat-started overlay already shows: keep it on
    // 켜기 = this page becomes the one shown (owner); 끄기 only from the page that holds it
    try { await post("/api/ovset", on() ? {enabled: false} : {enabled: true, owner: OVWIN.id}); } catch (e) { return uiAlert(e.message); }
    if (on()) { enabled = false; return show(); }  // 끄기 = 숨기기 (프로그램은 뒤에서 계속 — 다시 켜면 바로)
    enabled = true; OVWIN.owner = OVWIN.id;
    if (typeof SHELL !== "undefined" && SHELL.notify) SHELL.notify();  // this page's lyrics at once
    if (alive) return show();
    // 오버레이 프로그램이 꺼져 있음 → 'musicoverlay:' 링크로 띄우기 (오버레이가 켤 때마다 이 링크를 이 PC 에 등록함)
    const a = Object.assign(document.createElement("a"), {href: "musicoverlay:start"});
    document.body.appendChild(a); a.click(); a.remove();
    starting = Date.now(); show();
    setTimeout(async () => {
      await check();
      if (on() || !starting) return;
      starting = 0; show();
      if (guide()) return openSetupGuide("오버레이");
      uiAlert("가사 오버레이 프로그램이 꺼져 있습니다.\n플레이어 폴더의 tools\\lyrics_overlay.bat 을 한 번 더블클릭해 주세요."
        + "\n(한 번 켜 두면 컴퓨터를 끌 때까지 뒤에서 돌고, 그동안은 이 단추로 바로 켜고 끕니다)");
    }, 8000);
  };
  show(); check();
  const timer = setInterval(() => { if (!document.hidden) check(); }, 5000);
  return () => clearInterval(timer);
}
/* 브라우저 저장소(IndexedDB) 한 칸짜리 키-값: 고른 폴더 손잡이 기억 (곡 목록 폴더 · 오프라인 mp3 폴더) */
const idbKV = name => (op, key, val) => new Promise((res, rej) => {
  const q = indexedDB.open(name, 1);
  q.onupgradeneeded = () => q.result.createObjectStore("kv");
  q.onerror = () => rej(q.error);
  q.onsuccess = () => {
    const tx = q.result.transaction("kv", op === "get" ? "readonly" : "readwrite").objectStore("kv");
    const r = op === "get" ? tx.get(key) : tx.put(val, key);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  };
});
