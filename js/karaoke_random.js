/* ================= 노래방 번호 랜덤 추천 (user request 2026-11-15) =================
   A separate feature: pick a karaoke machine → a random song number from our karaoke table (VDB.curated nums).
   추첨 draws again each press. 곡 정보 off → only the number, big in the middle.
   중복 방지 on → a number drawn in the last 2 hours (same machine) is not drawn again.
   A number appears only when 추첨 is pressed — not on open, not on picking a machine (user request).
   노래방 모드 (default off): on → songs of the 필터 프리셋 '노래방' go into the playlist, and the playlist shows the
   picked machine's number where the sync % sat. */
const KARA_MACHINES = ["TJ", "금영", "DAM", "UGA", "JOYSOUND"];
const KARA_NODUP_MS = 2 * 60 * 60 * 1000;
const KARA = {
  machine: store.get("kara.machine", ""),
  info: store.get("kara.info", false),  // default off (user request): only the number
  nodup: store.get("kara.nodup", true),  // default on (user request)
  mode: store.get("kara.mode", false),
  cur: null,
  pool(m) { return (VDB.curated || []).filter(it => it.nums && /\d/.test(it.nums[m] || "")); },
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
    store.set("kara.history", [...this.history(), {m, n: this.cur.nums[m], t: Date.now()}]);
    this.render(note);
  },
  render(note = "") {
    const m = this.machine;
    document.querySelectorAll("#karaMachines button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
    $("karaMode").classList.toggle("on", this.mode);
    $("karaMode").querySelector("b").textContent = this.mode ? "ON" : "OFF";
    $("karaInfo").classList.toggle("on", this.info);
    $("karaNodup").classList.toggle("on", this.nodup);
    $("karaDraw").disabled = !m;
    $("karaReset").disabled = !this.history().length;
    const left = m && this.nodup ? (() => { const used = new Set(this.history().filter(h => h.m === m).map(h => h.n)); return this.pool(m).filter(it => !used.has(it.nums[m])).length; })() : null;
    $("karaNote").textContent = note || (left != null ? `중복 방지 중 — 아직 안 나온 곡 ${left}곡` : "");
    const it = this.cur;
    $("karaNum").textContent = it ? it.nums[m] : m ? "추첨을 누르세요" : "노래방 기기를 고르세요";
    $("karaNum").classList.toggle("ask", !it);
    $("karaSong").hidden = !(it && this.info);
    if (it) $("karaSong").innerHTML = `<div class="kt">${esc(it.title)}</div>${it.orig ? `<div class="ko">${esc(it.orig)}</div>` : ""}`
      + `<div class="kp">${[it.composer && `작곡 ${esc(it.composer)}`, it.singer && `노래 ${esc(it.singer)}`].filter(Boolean).join(" · ")}</div>`;
  },
  open() {
    $("karaMachines").innerHTML = KARA_MACHINES.map(m => `<button data-m="${esc(m)}" title="${esc(m)} 번호가 있는 곡 ${this.pool(m).length}곡">${esc(m)}<span class="kc">${this.pool(m).length}</span></button>`).join("");
    this.cur = null;
    $("karaDlg").showModal();
    this.render();
  },
  /* the 노래방 filter preset (음원 관리 › 필터 — the one with a 노래방 condition, by name first) */
  preset() {
    const ps = fPresets(), hasKara = p => p.groups.some(g => g.c.some(c => c.k === "kara"));
    return ps.find(p => hasKara(p) && /노래방/.test(p.name)) || ps.find(hasKara) || null;
  },
  setMode(on) {
    this.mode = on; store.set("kara.mode", on);
    let note = "";
    if (on) {
      const p = this.preset();
      if (!p) note = "노래방 필터 프리셋이 없어 재생목록에 넣지 못했습니다";
      else {
        const groups = p.groups.map(g => withType({...g, m: true}));
        const list = (VDB.curated || []).filter(it => passGroups(it, groups));
        const n = PL.add(list);
        note = `'${p.name}' ${list.length.toLocaleString()}곡 중 ${n.toLocaleString()}곡을 재생목록에 넣었습니다` + (n < list.length ? " (이미 있거나 틀 수 없는 곡 제외)" : "");
      }
      if (!this.machine) note += " · 번호를 볼 노래방 기기를 고르세요";
    }
    renderList();
    this.render(note);
  },
};
/* 노래방 모드: the playlist shows the picked machine's number in the sync % spot */
const pctPlain = pctHtml;
pctHtml = it => {
  if (!KARA.mode) return pctPlain(it);
  const n = KARA.machine && it.nums && it.nums[KARA.machine];
  return n ? `<span class="pct kno" title="${esc(KARA.machine)} 노래방 번호">${esc(n)}</span>` : "";
};
$("btnKara").onclick = () => KARA.open();
$("karaMachines").onclick = e => { const b = e.target.closest("button[data-m]"); if (!b) return; KARA.machine = b.dataset.m; store.set("kara.machine", KARA.machine); KARA.cur = null; KARA.render(); if (KARA.mode) renderList(); };
$("karaMode").onclick = () => KARA.setMode(!KARA.mode);
$("karaDraw").onclick = () => KARA.draw();
$("karaInfo").onclick = () => { KARA.info = !KARA.info; store.set("kara.info", KARA.info); KARA.render(); };
$("karaNodup").onclick = () => { KARA.nodup = !KARA.nodup; store.set("kara.nodup", KARA.nodup); KARA.render(); };
/* 중복 초기화 (user request): ask once, then forget every number drawn in the last 2 hours (all machines) */
$("karaReset").onclick = async () => {
  const n = KARA.history().length;
  if (!await uiConfirm(`최근 2시간 동안 나온 번호 ${n}개의 기록을 지웁니다.\n이미 나온 번호도 다시 나올 수 있게 됩니다 (모든 기기).\n\n초기화할까요?`, "초기화")) return;
  store.set("kara.history", []);
  KARA.render("중복 방지 기록을 초기화했습니다");
};
$("karaClose").onclick = () => $("karaDlg").close();
$("karaNum").onclick = () => { if (KARA.cur) KARA.draw(); };
