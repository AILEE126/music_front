/* 플레이어 화면 도우미 (음원 관리는 서버 화면이라 따로 — Server\ui\js\manage_helpers.js)
   플레이어는 이 파일보다 먼저 STORE_PREFIX(브라우저 저장값 이름 앞머리)를 정함 */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const fmt = s => !isFinite(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
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

/* 가사 글자색 (바탕화면 오버레이와 같음): 서버가 묶음마다 준 보컬 색 vc 1~3개. 여럿이면(듀엣·합창) 한 줄의 글자를
   위(첫 색)→아래(끝 색) 그라데이션으로 칠함 — 줄 높이(1lh)마다 반복돼 여러 줄로 넘어가도 줄마다 같음 */
function lyrLine(cls, text, cs) {
  cs = (cs || []).filter(c => /^#[0-9a-f]{6}$/i.test(c));
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
/* 검색 비교용: 대소문자·전각/반각(Ｍｉｒｒｏｒ = mirror) 무시 — 모든 찾기 칸이 씀 */
/* 화면 표시용: 같은 글자가 10번 넘게 이어지면 '누×53' 처럼 줄임 (프로듀서 '누누누…' 같은 긴 이름). mp3 태그·검색·필터 값은 그대로 */
const shortName = s => String(s ?? "").replace(/(.)\1{9,}/gu, (m, c) => `${c}×${[...m].length}`);
const fold = s => String(s ?? "").normalize("NFKC").toLowerCase();
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
  const f = document.documentElement.getBoundingClientRect().width / document.documentElement.offsetWidth || 1;
  const x = Math.min(e.clientX, innerWidth - m.offsetWidth * f - 4), y = Math.min(e.clientY, innerHeight - m.offsetHeight * f - 4);
  m.style.left = Math.max(0, x) / f + "px"; m.style.top = Math.max(0, y) / f + "px";
  if (x + m.offsetWidth * f * 2 > innerWidth) m.classList.add("flip");  // 하위 메뉴가 오른쪽 끝을 넘으면 왼쪽으로
}
/* 글 복사 (클립보드를 못 쓰는 창이면 예전 방식으로) */
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return; } catch (e) {}
  const t = document.createElement("textarea");
  t.value = s; t.style.position = "fixed"; t.style.opacity = "0";
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
function fillRange(el) { el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min) * 100 || 0) + "%"); }
/* 음량 버튼·막대 그리기: 소리 크기에 따라 물결 0~2개, 음소거면 X */
function renderVolume(btn, range, audio) {
  const v = audio.muted ? 0 : audio.volume;
  range.value = v; fillRange(range);
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/>'
    + (v === 0 ? '<path d="m16 9 5 6M21 9l-5 6"/>' : '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>' + (v > .5 ? '<path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : "")) + "</svg>";
}

/* ---- 가사 오버레이 설정 창 (⚙) ----
   가사 오버레이 = programs\WEB\tools\lyrics_overlay.bat 로 켜는 파워쉘 창 (바탕 투명 · 어느 브라우저든). 이 창에서 바꾸면 곧바로 반영.
   local_files.js 가 WEB\overlay\lyrics_overlay.json 에 씀 (깃허브에서 연 화면은 이 브라우저에만).
   창이 열려 있는 동안은 editing_at 을 계속 알려 줌 → 오버레이가 붙일 프로그램과 상관없이 보이고 끌어 옮길 수 있음 (닫으면 원래대로) */
const OVSET_DEFAULTS = {x: -1, y: -1, width: 1100, size: 22, outline: 2, opacity: 100, clickthrough: false, target: "ffxiv_dx11", info: true, editing_at: 0, quit_at: 0, enabled: true};
async function openOverlaySettings() {
  let c, progs = [];
  try { if (!await LOCAL.ovConnect()) return; } catch (e) { if (e.name !== "AbortError") uiAlert(e.message); return; }  // 깃허브에서 연 화면: 이 PC 의 WEB 폴더를 한 번 고름
  try { c = {...OVSET_DEFAULTS, ...(await api("/api/ovset"))}; } catch (e) { return uiAlert(e.message); }
  try { progs = (await api("/api/ovprograms")).items || []; } catch (e) {}
  const opts = progs.slice();
  if (c.target && !opts.some(p => p.exe === c.target.replace(/\.exe$/i, "")))
    opts.unshift({exe: c.target.replace(/\.exe$/i, ""), title: "지금 꺼져 있음"});
  const d = document.createElement("dialog");
  d.className = "uidlg ovset";
  d.innerHTML = `<div class="dlg-body"><b>가사 오버레이 설정</b>
    <p class="muted">바탕이 투명한 가사 창 (어느 브라우저든). 이 창을 열어 둔 동안은 오버레이가 늘 보이고 끌어서 옮길 수 있어요.</p>
    <label>이 프로그램이 앞에 있을 때만 보이기 <select data-k="target">
      <option value="">(늘 보임)</option>${opts.map(p => `<option value="${esc(p.exe)}">${esc(p.exe)}${p.title ? ` — ${esc(p.title)}` : ""}</option>`).join("")}</select>
      <span class="muted">그 프로그램이 꺼져 있으면 늘 보임 · 목록은 오버레이가 켜져 있을 때 채워짐</span></label>
    <label class="inline"><input type="checkbox" data-k="clickthrough"> 클릭 통과 (가사를 눌러도 뒤 창으로 — 끄면 가사를 끌어 옮김)</label>
    <label class="inline"><input type="checkbox" data-k="info"> 곡 정보 줄 (제목 — 프로듀서 feat. 가수)</label>
    <label>글자 크기 <b data-v="size"></b><input type="range" min="9" max="30" step="1" data-k="size"></label>
    <label>테두리 두께 <b data-v="outline"></b><input type="range" min="0" max="6" step="0.5" data-k="outline"></label>
    <label>불투명도 <b data-v="opacity"></b><input type="range" min="10" max="100" step="5" data-k="opacity"></label>
    <label>가로 폭 <b data-v="width"></b><input type="range" min="300" max="3000" step="50" data-k="width"></label>
    <p class="muted">발음·번역 줄은 플레이어의 '발음'·'번역' 체크를 따릅니다.</p>
    <div class="row"><button data-act="reset">위치 처음으로 (화면 아래 가운데)</button></div></div>
    <div class="dlg-foot"><button class="primary" data-act="close">닫기</button></div>`;
  const ins = [...d.querySelectorAll("[data-k]")];
  for (const i of ins) { if (i.type === "checkbox") i.checked = !!c[i.dataset.k]; else i.value = String(c[i.dataset.k]).replace(/\.exe$/i, ""); }
  const showVals = () => d.querySelectorAll("[data-v]").forEach(b => b.textContent = d.querySelector(`[data-k=${b.dataset.v}]`).value + (b.dataset.v === "opacity" ? "%" : ""));
  showVals();
  let t = 0;
  const values = () => Object.fromEntries(ins.map(i => [i.dataset.k, i.type === "checkbox" ? i.checked : i.type === "range" ? +i.value : i.value]));
  const save = (extra = {}, now = false) => {  // 바꿀 때마다 (끌어 움직이는 동안은 0.25초에 한 번)
    clearTimeout(t);
    const go = () => post("/api/ovset", {...values(), editing_at: Date.now(), ...extra}).catch(e => uiAlert(e.message));
    if (now) return go();
    t = setTimeout(go, 250);
  };
  ins.forEach(i => i.addEventListener(i.type === "range" ? "input" : "change", () => { showVals(); save(); if (i.tagName === "SELECT") i.blur(); }));
  const beat = setInterval(() => post("/api/ovset", {editing_at: Date.now()}).catch(() => {}), 3000);  // 열려 있다는 표시
  post("/api/ovset", {editing_at: Date.now()}).catch(() => {});
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "reset") save({x: -1, y: -1}); else d.close();
  });
  d.addEventListener("close", () => { clearInterval(beat); clearTimeout(t); save({editing_at: 0}, true); d.remove(); });
  document.body.appendChild(d);
  d.showModal();
}

/* ---- 가사 오버레이 켜기/끄기 단추 (플레이어 툴바) ----
   오버레이 프로그램은 한 번 켜 두면 뒤에서 계속 돌고(서버를 켜면 서버가 띄움 · 서버 없이는 lyrics_overlay.bat 한 번),
   이 단추는 설정 파일의 enabled(보이기·숨기기)만 바꿈 → 어느 브라우저든, 서버가 없어도 바로 됨.
   프로그램이 돌고 있는지: 6초마다 프로그램 목록 파일을 새로 씀 → 15초 안이면 돌고 있음.
   프로그램이 꺼져 있을 때 '켜기': 'musicoverlay:' 링크 (못 켜 주는 브라우저면 bat 안내) */
function bindOverlayPower(btn) {
  let alive = false, enabled = true, starting = 0;
  const on = () => alive && enabled;
  const show = () => {
    btn.textContent = starting ? "오버레이 켜는 중…" : on() ? "오버레이 끄기" : "오버레이 켜기";
    btn.classList.toggle("on", on());
    btn.title = on() ? "가사 오버레이 숨기기" : "가사 오버레이 보이기 (바탕 투명 가사 창 — 설정은 ⚙)";
  };
  const check = async () => {
    try {
      const [r, c] = await Promise.all([api("/api/ovprograms"), api("/api/ovset")]);
      alive = !!r.running; enabled = c.enabled !== false;
    } catch (e) { alive = false; }
    if (on()) starting = 0;
    show();
  };
  btn.onclick = async () => {
    if (starting) return;
    try { if (!await LOCAL.ovConnect()) return; } catch (e) { if (e.name !== "AbortError") uiAlert(e.message); return; }  // 깃허브에서 연 화면: 이 PC 의 WEB 폴더를 한 번 고름
    await check();
    try { await post("/api/ovset", {enabled: !on()}); } catch (e) { return uiAlert(e.message); }
    if (on()) { enabled = false; return show(); }  // 끄기 = 숨기기 (프로그램은 뒤에서 계속 — 다시 켜면 바로)
    enabled = true;
    if (alive) return show();
    // 오버레이 프로그램이 꺼져 있음 → 'musicoverlay:' 링크로 띄우기 (오버레이가 켤 때마다 이 링크를 이 PC 에 등록함)
    const a = Object.assign(document.createElement("a"), {href: "musicoverlay:start"});
    document.body.appendChild(a); a.click(); a.remove();
    starting = Date.now(); show();
    setTimeout(async () => {
      await check();
      if (on() || !starting) return;
      starting = 0; show();
      uiAlert("가사 오버레이 프로그램이 꺼져 있습니다.\nprograms\\WEB\\tools\\lyrics_overlay.bat 을 한 번 더블클릭해 주세요."
        + "\n(한 번 켜 두면 컴퓨터를 끌 때까지 뒤에서 돌고, 그동안은 이 단추로 바로 켜고 끕니다)");
    }, 8000);
  };
  show(); check(); setInterval(check, 5000);
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
