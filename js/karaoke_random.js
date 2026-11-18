/* ================= 노래방 번호 랜덤 추천 (user request 2026-11-15) =================
   A separate feature: pick a karaoke machine → a random song number from our karaoke table (VDB.curated nums).
   추첨 draws again each press. 곡 정보 off → only the number, big in the middle.
   중복 방지 on → a number drawn in the last 2 hours (same machine) is not drawn again.
   A number appears only when 추첨 is pressed — not on picking a machine (user request); reopening keeps the last one.
   구형 기기 (default off, user request 2026-11-15): on → songs only some machines of that brand have (나무위키 ⓗ · ⓢ —
   e.g. TJ 60시리즈부터 선곡 가능) are not drawn. Filters are not touched by it.
   노래방 모드 (user request 2026-11-15) is separate from this window: its on/off button and machine sit on the playlist,
   and it only filters the playlist to songs with that machine's number and shows the number where the sync % sat
   (no songs added, filters untouched). Always off when the screen opens; turns itself off 2 hours after it was turned on.
   중복 방지 (2시간) = on/off · 추첨 기록 = the past draws (15 rows, then scroll) with 지난 기록 초기화 (user request 2026-11-15). */
const KARA_MACHINES = ["TJ", "금영", "DAM", "UGA", "JOYSOUND"];
const KARA_NODUP_MS = 2 * 60 * 60 * 1000;
const KARA_MODE_MS = 2 * 60 * 60 * 1000;  // 노래방 모드 turns itself off after this
/* draw screen only (user request 2026-11-15): the stored thumbnail is the small one VocaDB gives (YouTube 120×90, Niconico
   small) — the same video's bigger picture is just another address. Largest first; a missing one falls back to the next,
   the stored address last */
const KARA_BIG = u => {
  const yt = u.match(/^(https?:\/\/i\.ytimg\.com\/vi\/[^/]+\/)(?:mq)?default\.jpg$/);
  // 480×360 (4:3 — the 16:9 box crops its bars); a deleted YouTube video → the song's own thumbnail (COVER_NEXT, local_files.js)
  if (yt) return [yt[1].replace(/^http:/, "https:") + "hqdefault.jpg", u, ...(COVER_NEXT.has(u) ? KARA_BIG(COVER_NEXT.get(u)) : [])];
  if (/nicovideo\.cdn\.nimg\.jp\/thumbnails\/\d+\/\d+\.\d+$/.test(u)) return [u + ".L", u + ".M", u];  // only addresses with the hash have .L / .M
  return [u];
};
const KARA = {
  machine: store.get("kara.machine", ""),
  info: store.get("kara.info", false),  // default off (user request): only the number
  nodup: store.get("kara.nodup", true),  // default on (user request)
  mode: false,  // 노래방 모드 — always off when the screen opens (user request)
  modeMachine: store.get("kara.modeMachine", "TJ"),  // the playlist's machine, apart from the draw window's
  old: false,  // 구형 기기: always off when the screen opens — the newest machines are the default (user request 2026-11-15)
  cur: null,
  pool(m) { return (VDB.curated || []).filter(it => it.nums && /\d/.test(it.nums[m] || "") && !(this.old && it.only && it.only[m])); },
  /* drawn history [{m, n, t}] — kept in this browser, entries older than 2 hours dropped */
  history() { const now = Date.now(); return store.get("kara.history", []).filter(h => now - h.t < KARA_NODUP_MS); },
  draw() {
    const m = this.machine;
    if (!m) return;
    let pool = this.pool(m), note = "";
    if (this.nodup) {
      const used = new Set(this.history().filter(h => h.m === m).map(h => h.n));
      const fresh = pool.filter(it => !used.has(it.nums[m]));
      if (fresh.length) pool = fresh;
      else if (pool.length) { note = "2시간 안에 모든 곡이 나와서 처음부터 다시 뽑습니다"; store.set("kara.history", this.history().filter(h => h.m !== m)); }
    }
    if (!pool.length) { this.cur = null; this.render("이 기기 번호가 있는 곡이 없습니다"); return; }
    // never the same number twice in a row (when there is another)
    const cand = pool.length > 1 && this.cur ? pool.filter(it => it.nums[m] !== this.cur.nums[m]) : pool;
    this.cur = cand[Math.floor(Math.random() * cand.length)];
    store.set("kara.history", [...this.history(), {m, n: this.cur.nums[m], t: Date.now(), title: this.cur.title || ""}]);
    this.render(note);
  },
  render(note = "") {
    const m = this.machine;
    document.querySelectorAll("#karaMachines button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
    $("karaInfo").classList.toggle("on", this.info);
    $("karaNodup").classList.toggle("on", this.nodup);
    $("karaOld").classList.toggle("on", this.old);
    $("karaDraw").disabled = !m;
    $("karaDraw").hidden = !!this.cur;  // only for the first draw — after that the middle draws (user request)
    $("karaAgain").hidden = !this.cur;
    if ($("karaHistDlg").open) this.renderHist();
    const left = m && this.nodup ? (() => { const used = new Set(this.history().filter(h => h.m === m).map(h => h.n)); return this.pool(m).filter(it => !used.has(it.nums[m])).length; })() : null;
    $("karaNote").textContent = note || (left != null ? `중복 방지 중 — 아직 안 나온 곡 ${left}곡` : "");
    const it = this.cur;
    $("karaNum").textContent = it ? it.nums[m] : m ? "추첨을 누르세요" : "노래방 기기를 고르세요";
    $("karaNum").classList.toggle("ask", !it);
    $("karaNum").style.setProperty("--bc", this.color(m));
    $("karaSong").hidden = !(it && this.info);
    // 곡 정보 on: the song's thumbnail, big above the number (user request 2026-11-15)
    const cv = it && this.info && hasCover(it) ? coverUrl(it) : "";
    const img = $("karaCover");
    if (cv) { if (img.dataset.base !== cv) { this.covers = KARA_BIG(cv); img.dataset.base = cv; delete img.dataset.fail; img.src = this.covers.shift(); } }
    else { img.removeAttribute("src"); delete img.dataset.base; }
    img.hidden = !cv || !!img.dataset.fail;
    // every line always there, so the block keeps its height (user request 2026-11-15): no original title → the title itself
    // (e.g. an English title) · our pronunciation after it as '원제 · 발음'
    if (it) $("karaSong").innerHTML = `<div class="kt">${esc(titleOf(it))}</div>`
      + `<div class="ko">${esc((titleNames(it).length > 1 ? titleNames(it).slice(1) : titleNames(it)).join(" · "))}</div>`
      + `<div class="kp">${[it.composer && `작곡 ${esc(it.composer)}`, it.singer && `노래 ${esc(it.singer)}`].filter(Boolean).join(" · ") || "&nbsp;"}</div>`;
  },
  /* 지난 추첨 기록 (newest first, last 2 hours): time · machine · number · song */
  renderHist() {
    const hs = this.history().reverse();
    $("karaReset").disabled = !hs.length;
    const title = h => h.title || ((VDB.curated || []).find(it => it.nums && it.nums[h.m] === h.n) || {}).title || "";
    const hm = t => new Date(t).toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit"});
    $("karaHistList").innerHTML = hs.length
      ? hs.map(h => `<div class="khrow"><span class="kht">${hm(h.t)}</span><span class="khm">${esc(h.m)}</span><b class="khn" style="--bc:${this.color(h.m)}">${esc(h.n)}</b><span class="khs">${esc(title(h))}</span></div>`).join("")
      : `<div class="khempty">최근 2시간 동안 추첨한 기록이 없습니다</div>`;
  },
  /* 노래방 모드: the 일반 | 노래방 switch under the name + the machine row on the playlist (shown while on) */
  renderBtn() {
    $("btnKaraMode").classList.toggle("on", this.mode);
    $("btnKaraMode").setAttribute("aria-pressed", this.mode);
    $("karaModeMachine").hidden = $("karaModeMachine").parentElement.hidden = !this.mode;
    $("karaModeMachine").value = this.modeMachine;
  },
  /* the machine's color (user request 2026-11-15: playlist numbers · the drawn number — not in 간단 mode, CSS) */
  color(m = this.machine) { return tagColor("kara", m) || BRAND_COLOR[m] || "var(--accent)"; },
  machines() {
    $("karaMachines").innerHTML = KARA_MACHINES.map(m => `<button data-m="${esc(m)}" title="${esc(m)} 번호가 있는 곡 ${this.pool(m).length}곡">${esc(m)}<span class="kc">${this.pool(m).length}</span></button>`).join("");
  },
  open(then) {  // the last drawn number stays — reopening shows the window as it was (user request 2026-11-15)
    $("karaDlg").showModal();
    withBusy($("karaDlg"), () => { this.machines(); this.render(); if (then) then(); });  // window first, counting after (user request)
  },
  /* 노래방 모드: the playlist shows (and ⏭ plays) only songs with the machine's number */
  applyFilter() {
    const m = this.mode && this.modeMachine;
    listFilter = m ? {fn: it => !!(it.nums && /\d/.test(it.nums[m] || ""))} : null;
    SHELL.playFilter = listFilter && listFilter.fn;
    SHELL.plan(SHELL.now);
  },
  setMode(on) {
    if (on === this.mode) return;
    this.mode = on; store.set("kara.modeAt", on ? Date.now() : 0);
    on ? this.presetF() : this.restoreF();
    this.applyFilter();
    renderList();
    this.renderBtn();
  },
  /* 노래방 모드 on (user request 2026-11-16, web · phone): the search filter and the playlist's filter become the 노래방
     preset (필터 › 프리셋 — the one named 노래방, else the built-in one); the playlist's filter before is kept until it goes off.
     The search window opens on this preset while the mode is on (searchReset) */
  presetGroups() { return (fPresets().find(f => /노래방/.test(f.name)) || F_PRESETS_DEF[0]).groups; },
  presetF() {
    if (!store.get("kara.prevF", null)) store.set("kara.prevF", {plf: PLF});
    applyFilter(this.presetGroups());
    setPlFilter(FG.filter(fReal));
  },
  /* 일반 again: the search window back to its fresh state · the playlist's filter as it was */
  restoreF() {
    const prev = store.get("kara.prevF", null); if (!prev) return;
    if ($("searchDlg").open) { searchReset(); renderSortOptions(); renderFilterOptions(); runSearch(); }
    setPlFilter(prev.plf);
    store.set("kara.prevF", null);
  },
};
/* 노래방 모드: the playlist shows the picked machine's number in the sync % spot */
const pctPlain = pctHtml;
pctHtml = it => {
  if (!KARA.mode) return pctPlain(it);
  const m = KARA.modeMachine, n = it.nums && it.nums[m];
  return n ? `<span class="pct kno" style="--bc:${KARA.color(m)}" title="${esc(m)} 노래방 번호">${esc(n)}</span>` : "";
};
/* the side 노래방 button only opens the draw window (user request 2026-11-15: separate from 노래방 모드) */
$("btnKara").onclick = () => KARA.open();
$("karaModeMachine").innerHTML = KARA_MACHINES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
$("btnKaraMode").onclick = () => KARA.setMode(!KARA.mode);
$("karaModeMachine").onchange = e => { KARA.modeMachine = e.target.value; store.set("kara.modeMachine", KARA.modeMachine); KARA.applyFilter(); renderList(); };
KARA.renderBtn();
/* the mode starts off: the screen was closed while it was on → the filters from before it come back */
KARA.restoreF();
store.set("kara.mode", null);
// on for 2 hours → off by itself (checked each minute; a sleeping tab catches up on its next tick)
setInterval(() => { if (KARA.mode && Date.now() - store.get("kara.modeAt", 0) >= KARA_MODE_MS) KARA.setMode(false); }, 60 * 1000);
$("karaMachines").onclick = e => { const b = e.target.closest("button[data-m]"); if (!b) return; KARA.machine = b.dataset.m; store.set("kara.machine", KARA.machine); KARA.cur = null; KARA.render(); };
$("karaDraw").onclick = () => KARA.draw();
$("karaInfo").onclick = () => { KARA.info = !KARA.info; store.set("kara.info", KARA.info); KARA.render(); };
$("karaOld").onclick = () => { KARA.old = !KARA.old; KARA.machines(); KARA.render(KARA.old ? "구형 기기 — 특정 기기에서만 나오는 곡(ⓗ 등)은 빼고 뽑습니다" : ""); };
$("karaNodup").onclick = () => { KARA.nodup = !KARA.nodup; store.set("kara.nodup", KARA.nodup); KARA.render(); };
$("karaHist").onclick = () => { KARA.renderHist(); $("karaHistDlg").showModal(); };
$("karaHistClose").onclick = () => $("karaHistDlg").close();
/* 지난 기록 초기화 (user request): ask once, then forget every number drawn in the last 2 hours (all machines) */
$("karaReset").onclick = async () => {
  const n = KARA.history().length;
  if (!await uiConfirm(`최근 2시간 동안 나온 번호 ${n}개의 기록을 지웁니다.\n이미 나온 번호도 다시 나올 수 있게 됩니다 (모든 기기).\n\n초기화할까요?`, "초기화")) return;
  store.set("kara.history", []);
  KARA.render("지난 추첨 기록을 초기화했습니다");
};
// a bigger picture missing → the next one; none left → just the number
$("karaCover").onerror = () => { const next = (KARA.covers || []).shift(); if (next) $("karaCover").src = next; else { $("karaCover").dataset.fail = "1"; $("karaCover").hidden = true; } };
$("karaClose").onclick = () => $("karaDlg").close();
$("karaShow").addEventListener("click", e => { if (KARA.cur && !e.target.closest("#karaDraw")) KARA.draw(); });  // the middle, anywhere
const karaShowTip = () => { $("karaShow").classList.toggle("redraw", !!KARA.cur); $("karaShow").title = KARA.cur ? "아무 데나 누르면 다시 추첨" : ""; };
new MutationObserver(karaShowTip).observe($("karaNum"), {childList: true, characterData: true, subtree: true});
