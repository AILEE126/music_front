/* 관리자 기능 (user request 2026-11-20): only for an admin token — perm 관리자 in Manage › 토큰 관리 (the server PC's folder
   counts too). The player compares its own token's SHA-256 with the token records the server shares on the data branch
   (Server/data/tokens.json — hashes and perms, never the tokens; github_tokens._save). Every other token sees none of it.
   · 곡 검색 필터 '오류 신고': songs with reports not handled yet, one value per report kind (song_filter.js reportKindsOf).
     Handled state lives on the server PC → Server/data/report_index.json (error_reports._write_index); report files it
     doesn't list yet are read here once and kept in the browser (a report file never changes).
   · 재생목록 선택 모드: right-click a song → '선택 모드' (that song picked); click picks/unpicks, shift-click a range;
     right-click again → 선택한 곡 싱크 반영. The player has no server: it leaves Server/data/sync_apply/<id>.json
     {ids, who, at} on the data branch and the server applies it in its next upload round (error_reports.apply_player_requests)
     — every player already plays the pending sync meanwhile. Songs with no waiting sync edit are left out.
   · 자동 싱크 대상 (user request 2026-11-25: "자동 싱크 대상을 프론트에 있는 필터 기능으로 넣을 수 있게"): filter the playlist,
     선택 모드 → 모두 고르기 → '선택한 곡을 자동 싱크 대상으로' leaves the picked songs' ids in
     Server/data/auto_sync_targets.json; the server's 자동 싱크 job then runs those songs (music_backend vocadb/auto_sync.py
     — it leaves out hand-made syncs, waiting edits … itself). '자동 싱크 대상 비우기' empties the list. */
const ADM = {byVid: new Map(), syncRid: new Map(), repAt: new Map(), fixed: new Map(), busy: false, last: 0, sel: null, anchor: -1, ok: false, tok: ""};
const ADM_CACHE = "adm.reports", ADM_EVERY = 10 * 60 * 1000;
const isAdmin = () => ADM.ok && typeof LOCAL !== "undefined" && LOCAL.ready && LOCAL.canWrite;
/* is this token a 관리자 token? (looked up again whenever the token changes and at every reload of the reports) */
async function admCheck() {
  if (!LOCAL.ready || !LOCAL.canWrite) return ADM.ok = false;
  if (!LOCAL.gh) return ADM.ok = true;  // the server PC's folder
  const tok = LOCAL.gh.token, list = await LOCAL.readJson(`${LOCAL.data}tokens.json`, null).catch(() => null);
  const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok)))].map(b => b.toString(16).padStart(2, "0")).join("");
  return ADM.ok = !!(list && (list.tokens || []).some(t => t.sha256 === h && t.perm === "관리자"));
}
reportKindsOf = it => { const s = isAdmin() && ADM.byVid.get(String(it.vocadb || "")); return s ? [...s] : []; };
const admSyncWaits = it => isAdmin() && ADM.syncRid.has(String(it.vocadb || ""));
const admRowCls = it => ADM.sel && ADM.sel.has(keyOf(it)) ? " sel" : "";

/* a few reads at a time (GitHub API) */
async function admEach(list, fn, n = 6) {
  let i = 0;
  await Promise.all(Array.from({length: Math.min(n, list.length)}, async () => { while (i < list.length) await fn(list[i++]); }));
}

async function admLoad() {
  if (ADM.busy || typeof LOCAL === "undefined" || !LOCAL.ready) return;
  ADM.busy = true; ADM.last = Date.now();
  try {
    const was = ADM.ok;
    if (!await admCheck()) { if (was) { if (ADM.sel) admSelEnd(); ADM.byVid = new Map(); ADM.syncRid = new Map(); ADM.repAt = new Map(); admChanged(); } return; }
    const d = LOCAL.data;
    // pend: the songs whose edited sync really waits (Server/data/sync_pending/vocadb/<id>.json — 반영 · 버리기 delete it).
    // User report 2026-11-24: syncs applied long ago kept showing as 확인대기 — the list's 'done' is one PC's record, so a
    // report handled on the other PC came back as open. A 싱크 수정 report counts only while its song's file is there.
    const [idx, names, reqs, pendNames] = await Promise.all([LOCAL.readJson(`${d}report_index.json`, {}),
      LOCAL.listDir(`${d}reports`), LOCAL.listDir(`${d}sync_apply`), LOCAL.listDir(`${d}sync_pending/vocadb`).catch(() => null)]);
    const pend = pendNames && new Set(pendNames.filter(n => n.endsWith(".json")).map(n => n.slice(0, -5)));
    const known = (idx && idx.items) || {}, cache = store.get(ADM_CACHE, {}) || {};
    const ids = names.filter(n => n.endsWith(".json")).map(n => n.slice(0, -5)).sort();
    await admEach(ids.filter(id => !known[id] && !cache[id]), async id => {
      const r = await LOCAL.readJson(`${d}reports/${id}.json`, null).catch(() => null);
      if (r) cache[id] = [String(r.kind || ""), String((r.song || {}).vocadb || "")];
    });
    store.set(ADM_CACHE, Object.fromEntries(ids.filter(id => !known[id] && cache[id]).map(id => [id, cache[id]])));
    const queued = new Set(), fixed = new Map();  // 싱크 반영 asked already / an admin's own sync save, the server hasn't run it yet
    await admEach(reqs.filter(n => n.endsWith(".json")), async n => {
      const q = await LOCAL.readJson(`${d}sync_apply/${n}`, null).catch(() => null);
      for (const x of (q && q.ids) || []) queued.add(String(x));
      for (const x of (q && q.syncs) || []) if (x && x.sync) fixed.set(String(x.vocadb), x.sync);
    });
    ADM.fixed = fixed;
    const by = new Map(), sync = new Map(), at = new Map();
    for (const id of ids) {
      const k = known[id], [kind, vid] = k ? [k.kind, k.vocadb] : cache[id] || ["", ""];
      if ((k && k.done) || queued.has(id) || !kind || !vid || (kind === "싱크 수정" && (fixed.has(vid) || (pend && !pend.has(vid))))) continue;
      (by.get(vid) || by.set(vid, new Set()).get(vid)).add(kind);
      const ka = at.get(vid) || at.set(vid, new Map()).get(vid);
      if (!ka.has(kind)) ka.set(kind, id);  // ids are in time order → per kind the oldest (신고 들어온 순, filter_panel.js repAt)
      if (kind === "싱크 수정") sync.set(vid, id);  // the newest stays
    }
    ADM.byVid = by; ADM.syncRid = sync; ADM.repAt = at;
    admChanged();
  } catch (e) { console.warn("관리자: 오류 신고 목록을 못 읽음:", e.message || e); }
  finally { ADM.busy = false; }
}
/* an admin's own sync save (local_files.js savePending, user request 2026-11-20): no 확인 대기 — the song's 싱크 수정
   reports count as handled (the server marks them when it runs the request). The list row is the server's data, which
   the save wrote itself (LOCAL.oursCell, user request 2026-11-22 — was a row laid over it here until the server ran) */
function admSynced(it, s) {
  ADM.fixed.set(String(it.vocadb || ""), s);
  const vid = String(it.vocadb || ""), k = ADM.byVid.get(vid);
  ADM.syncRid.delete(vid); ADM.repAt.get(vid)?.delete("싱크 수정");
  if (k) { k.delete("싱크 수정"); if (!k.size) ADM.byVid.delete(vid); }
  admChanged();
}
/* reports changed → the search window's categories are counted again, the rows' badges redrawn */
function admChanged() {
  catMemo = new WeakMap();  // filter_panel.js
  if ($("searchDlg").open) catsLater();
  renderRows(true);
  partsBtn();  // 파트분리 button: admin only (lyrics_view.js)
}

/* ---- 선택 모드 ---- */
function admMenu(it) {
  if (!isAdmin()) return [];
  if (!ADM.sel) return [{label: "선택 모드 (관리자 — 여러 곡 싱크 반영 · 자동 싱크 대상)", fn: () => admSelStart(it)}];
  return [];  // in 선택 모드 the right-click opens admSelMenu instead (below)
}
function admSelStart(it) {
  ADM.sel = new Set(it ? [keyOf(it)] : []);
  ADM.anchor = it ? view.indexOf(it) : -1;
  admSelRender();
}
function admSelEnd() { ADM.sel = null; ADM.anchor = -1; admSelRender(); }
const admPicked = () => SHELL.queue.filter(it => ADM.sel.has(keyOf(it)));
function admSelRender() {
  $("list").classList.toggle("selmode", !!ADM.sel);
  let bar = $("admSelBar");
  if (!ADM.sel) { if (bar) bar.remove(); renderRows(true); return; }
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "admSelBar"; bar.className = "admbar";
    $("list").before(bar);
  }
  const n = ADM.sel.size, waits = admPicked().filter(admSyncWaits).length;
  bar.innerHTML = `<span>선택 모드 · <b>${n.toLocaleString()}</b>곡${n ? ` (수정 대기 ${waits.toLocaleString()})` : ""}</span><span class="sp"></span>`
    + `<button class="ib" data-a="wait" title="싱크 수정이 반영을 기다리는 곡만 고름">수정 대기 고르기</button>`
    + `<button class="ib" data-a="end" title="선택 모드 끝내기 (Esc)">끝내기</button>`;
  bar.querySelector('[data-a="wait"]').onclick = () => { ADM.sel = new Set(view.filter(admSyncWaits).map(keyOf)); admSelRender(); };
  bar.querySelector('[data-a="end"]').onclick = admSelEnd;
  renderRows(true);
}
function admSelMenu(e) {
  const n = ADM.sel.size;
  ctxMenu(e, [
    n ? {label: `선택한 곡 싱크 반영 (${n.toLocaleString()}곡)`, fn: admApplySync} : {label: "선택한 곡 싱크 반영 (고른 곡 없음)"},
    n ? {label: `선택한 곡을 자동 싱크 대상으로 (${n.toLocaleString()}곡)`, fn: () => admTargets(true)} : {label: "선택한 곡을 자동 싱크 대상으로 (고른 곡 없음)"},
    {label: "자동 싱크 대상 비우기", fn: () => admTargets(false)},
    {label: "모두 고르기", fn: () => { ADM.sel = new Set(view.map(keyOf)); admSelRender(); }},
    {label: "수정 대기만 고르기", fn: () => { ADM.sel = new Set(view.filter(admSyncWaits).map(keyOf)); admSelRender(); }},
    ...(n ? [{label: "고른 것 모두 풀기", fn: () => { ADM.sel.clear(); admSelRender(); }}] : []),
    {label: "선택 모드 끝내기", fn: admSelEnd},
  ]);
}
// capture: in 선택 모드 a click picks (no play) and the right-click is ours — before playlist_panel.js's handlers
$("list").addEventListener("click", e => {
  if (!ADM.sel) return;
  const el = e.target.closest(".item"); if (!el) return;
  e.stopImmediatePropagation();
  const i = +el.dataset.i, it = view[i];
  if (!it || it.hdr) return;  // an album header (playlist_panel.js albumView)
  if (e.shiftKey && ADM.anchor >= 0) {
    const [a, b] = ADM.anchor < i ? [ADM.anchor, i] : [i, ADM.anchor];
    for (const x of view.slice(a, b + 1)) ADM.sel.add(keyOf(x));
  } else {
    const k = keyOf(it);
    if (ADM.sel.has(k)) ADM.sel.delete(k); else ADM.sel.add(k);
    ADM.anchor = i;
  }
  admSelRender();
}, true);
$("list").addEventListener("contextmenu", e => {
  if (!ADM.sel) return;
  e.stopImmediatePropagation();
  admSelMenu(e);
}, true);
addEventListener("keydown", e => { if (e.key === "Escape" && ADM.sel && !document.querySelector("dialog[open]")) admSelEnd(); });

/* 자동 싱크 대상: the picked songs' VocaDB ids → Server/data/auto_sync_targets.json (set: the list is replaced · else emptied) */
async function admTargets(set) {
  if (!isAdmin()) return;
  const ids = set ? [...new Set(admPicked().filter(it => it.vocadb).map(it => String(it.vocadb)))] : [];
  if (set && !ids.length) { uiAlert("고른 곡 중 자동 싱크를 돌릴 수 있는 곡이 없습니다."); return; }
  if (!await uiConfirm(set
    ? `${ids.length.toLocaleString()}곡을 자동 싱크 대상으로 넣을까요? (전에 넣은 대상은 이 목록으로 바뀝니다)\n\n`
      + "서버의 수집 › 자동 싱크를 실행하면 이 곡들만 돕니다 — 이미 자동 싱크가 있는 곡도 지금 방식으로 다시 맞춥니다.\n"
      + "직접 맞춘 싱크 · 확인 대기 · 가사를 공유받는 곡은 서버가 알아서 뺍니다."
    : "자동 싱크 대상을 비울까요? 서버의 자동 싱크가 원래 순서대로 돕니다.", set ? "넣기" : "비우기")) return;
  try {
    const who = LOCAL.gh ? await LOCAL.ghWho() : String(store.get("reportWho", "") || "").trim();
    await LOCAL.writeText(`${LOCAL.data}auto_sync_targets.json`, JSON.stringify({at: nowText(), who, ids}) + "\n", who);
  } catch (e) { uiAlert("자동 싱크 대상을 못 올렸습니다 — " + (e.message || e)); return; }
  uiAlert(set ? `자동 싱크 대상 ${ids.length.toLocaleString()}곡을 넣었습니다. 서버의 수집 › 자동 싱크를 실행하세요.` : "자동 싱크 대상을 비웠습니다.");
  if (set) admSelEnd();
}

/* 선택한 곡 싱크 반영: each picked song's waiting sync edit (its pending file names the report) → one request file */
async function admApplySync() {
  if (!isAdmin()) return;
  const its = admPicked().filter(it => it.vocadb), rids = [], songs = [];
  await admEach(its, async it => {
    const pj = await LOCAL.readJson(LOCAL.pendingPath(it), null).catch(() => null);
    const rid = pj && pj.pending && pj.pending.report;
    // a version sharing another's lyrics: applied only on the manage screen (user request 2026-11-23 — admins apply on the original)
    const doc = rid && it.lyrics ? await LOCAL.lyricsDoc(it).catch(() => null) : null;
    if (rid && !(doc && doc.shared)) { rids.push(String(rid)); songs.push({vocadb: String(it.vocadb), title: it.title || it.name || ""}); }
  });
  const skip = ADM.sel.size - rids.length;
  if (!rids.length) { uiAlert("고른 곡 중 싱크 수정이 반영을 기다리는 곡이 없습니다 (가사를 공유받는 곡은 원곡에서만 반영됩니다)."); return; }
  if (!await uiConfirm(`${rids.length.toLocaleString()}곡의 고친 싱크를 반영할까요?`
    + (skip ? `\n(싱크 수정 대기가 없거나 가사를 공유받는 ${skip.toLocaleString()}곡은 빠집니다)` : "")
    + "\n\n서버가 다음에 데이터를 올릴 때 반영됩니다 — 그때까지도 모든 플레이어는 고친 싱크로 틉니다.", "반영")) return;
  try {
    const who = LOCAL.gh ? await LOCAL.ghWho() : String(store.get("reportWho", "") || "").trim();
    const at = nowText(), id = at.replace(/[-: ]/g, "").replace(/^(\d{8})/, "$1_") + "_" + Math.random().toString(36).slice(2, 6);
    await LOCAL.writeText(`${LOCAL.data}sync_apply/${id}.json`, JSON.stringify({at, who, ids: rids, songs}, null, 1) + "\n", who);
  } catch (e) { uiAlert("싱크 반영 요청을 못 올렸습니다 — " + (e.message || e)); return; }
  for (const s of songs) { ADM.syncRid.delete(s.vocadb); ADM.repAt.get(s.vocadb)?.delete("싱크 수정"); const k = ADM.byVid.get(s.vocadb); if (k) { k.delete("싱크 수정"); if (!k.size) ADM.byVid.delete(s.vocadb); } }
  admSelEnd();
  admChanged();
  uiAlert(`${rids.length.toLocaleString()}곡 싱크 반영을 요청했습니다. 서버가 다음에 데이터를 올릴 때 반영됩니다.`);
}

{
  // LOCAL becomes ready after the entry dialog → look then and whenever the token changes (entry dialog again),
  // later every 10 minutes and when the tab comes back
  const who = () => typeof LOCAL === "undefined" || !LOCAL.ready ? "" : LOCAL.gh ? LOCAL.gh.token : "dir";
  setInterval(() => { const w = who(); if (w && w !== ADM.tok && !ADM.busy) { ADM.tok = w; admLoad(); } }, 2000);
  setInterval(admLoad, ADM_EVERY);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - ADM.last > 2 * 60 * 1000) admLoad(); });
}
