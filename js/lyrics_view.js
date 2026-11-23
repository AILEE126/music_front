/* 지금 곡 — 재생 · 곡 정보 줄 · 가사 그리기 · 지금 줄 따라가기 (tick) · 표시 옵션 · 밀기 · 직접 맞추기.
   player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* ================= 재생 ================= */
/* 가사·싱크를 저장했으면 재생기 가사(오버레이 알림)도 다시 읽게 함 */
const syncShell = () => { if (SHELL.now && cur && keyOf(SHELL.now) === keyOf(cur)) SHELL.reloadLyrics(); };  // 저장한 싱크를 재생기 가사(오버레이)에도
/* 재생목록의 곡을 누르면 그 곡부터 (⏭ 는 재생목록 순서대로) · 검색 창에서 바로 튼 곡은 재생목록 지금 곡 다음에 들어감 */
async function play(it, autoplay = true, how = "pick") {  // how '': 재생 목록에서 그 곡 다음부터 (처음 열 때 지난 곡)
  if (!it) return;
  if (editing && !await uiConfirm("편집하던 싱크·파트·가사를 저장하지 않고 다른 곡으로 넘어갈까요?")) return;
  stopEdit();
  SHELL.load(it, autoplay, how);  // 곡이 바뀌면 재생기가 알려 줌 → showSong
}
/* ▶ 처음부터: 재생목록(오프라인은 mp3 폴더의 곡)을 처음 곡부터 (무작위면 섞은 첫 곡)
   start: a playlist row clicked — same as ▶ 처음부터, only starting at that song (user request 2026-11-23) */
async function playView(start) {
  // right after opening, the saved list not read yet (no 요약본): wait for it with the loading notice (user request 2026-11-19)
  if (ONLINE && !guestPl && !PL.restored && !view.length) await loadWait(PL.whenRestored());
  const list = viewSongs.filter(canPlay);  // folded albums' songs too
  if (!list.length) return ONLINE ? openSearch() : uiAlert("재생할 곡이 없습니다.");
  if (editing && !await uiConfirm("편집하던 싱크·파트·가사를 저장하지 않고 다른 곡으로 넘어갈까요?")) return;
  stopEdit();
  if (!listFilter) SHELL.setQueue(list);  // filtered view: keep the whole playlist (⏭ follows the filter — SHELL.playFilter)
  SHELL.load(start || (SHELL.shuffle ? list[Math.floor(Math.random() * list.length)] : list[0]), true);
}
$("btnPlayView").onclick = () => playView();
/* 기억해 둔 재생목록을 되살림 (화면을 새로 열었을 때) — songs put in before it was read stay, after the saved ones */
async function restoreQueue() {
  if (!ONLINE && SHELL.queue.length) { PL.restored = true; PL.restoredOk(); return; }  // the mp3 folder's list is up — the playlist comes back online
  let q = await PL.restore();
  // 요약본 stood in (PL.early): songs taken out of it meanwhile stay out; the rest of the list joins as live items
  if (PL.early) { const now = new Set(SHELL.queue.map(keyOf)); q = q.filter(it => !PL.early.has(keyOf(it)) || now.has(keyOf(it))); }
  const have = new Set(q.map(keyOf)), added = SHELL.queue.filter(it => !have.has(keyOf(it)));
  SHELL.setQueue([...q, ...added]);
  SHELL.plan(SHELL.now);
  PL.restored = true; PL.early = null; PL.restoredOk();
  for (const it of q) if (it.vocadb) LOCAL.items.set(keyOf(it), it);  // the 요약본 copies remembered by name → the live song
  PL.save();  // also writes the 요약본 (first open after the update has none yet)
}
/* 재생기에서 곡이 바뀜 (직접 고르거나, 곡이 끝나 다음 곡으로 넘어감) → 화면 갱신 */
async function showSong(it) {
  if (!it || (cur && keyOf(cur) === keyOf(it))) return;
  stopEdit();
  cur = it;
  $("nowTitle").textContent = titleOf(it); showArtist(it);
  $("nowDetail").innerHTML = detailHtml(it);
  showViews(it);
  renderMeta(it);
  if (hasCover(it)) { $("nowCover").dataset.ck = keyOf(it); $("nowCover").src = coverUrl(it); } else $("nowCover").removeAttribute("src");
  showVideo();
  document.title = `${titleOf(it)} · 음원 플레이어`;
  renderRows(true);  // 지금 곡 표시만 (목록을 다시 거르지 않음)
  // the last song's lyrics never stay up while this one's load (user report 2026-11-19: VocaDB API hung → the previous
  // song's lyrics showed under the new song)
  song = null; times = null; offset = 0;
  $("lyrics").className = "nosync"; $("lyrics").innerHTML = `<div class="empty">가사 불러오는 중…</div>`;
  renderSyncChip();
  await loadSong();
}
/* 투고일 (곡 정보의 값) · 니코니코 원곡 재생수 (그때그때 — 서버는 니코니코 정보 API, 서버 없이는 중계 페이지의 니코니코 플레이어. 유튜브 원곡은 안 보임) */
function showViews(it) {
  const date = it.date ? `투고 ${it.date}` : "";
  $("nowDate").textContent = date; $("nowDate").title = "";
  if (it.site !== "stream") return;
  // no count → say why in its place (user request 2026-11-22): YouTube … can't give one, Niconico failed this time
  const none = (msg, tip) => {
    if (!cur || keyOf(cur) !== keyOf(it)) return;
    $("nowDate").textContent = [date, msg].filter(Boolean).join(" · ");
    $("nowDate").title = tip;
  };
  if (!/nicovideo\.jp|nico\.ms/.test(it.video || "")) return none("재생수를 가져올 수 없는 영상입니다", "재생수는 니코니코 원곡만 받을 수 있음");
  const fail = () => none("재생수 가져오기에 실패했습니다", "니코니코 재생수를 이번에 받지 못함");
  api(`/api/stream/views?name=${encodeURIComponent(it.name)}`).then(r => {
    if (!cur || keyOf(cur) !== keyOf(it)) return;
    if (r.views == null) return fail();
    $("nowDate").textContent = [date, `재생수 ${r.views.toLocaleString()}회`].filter(Boolean).join(" · ");
    $("nowDate").title = "니코니코 원곡 재생수 (지금 받은 값)";
  }).catch(fail);
}
/* 곡 태그: 보컬(보컬 색) → 노래방(TJ·JOY만; 내려간 기기는 어느 기기든 취소선 칩 — user request 2026-11-15) → 내부 분류(한국·일본 목록) → 나무위키 분류(평범한 칩) · 아래에 노래방 목록 각주(작게) */
const KARAOKE_TAG = {TJ: "TJ", JOYSOUND: "JOY"};
/* 특정 기기에서만 선곡 가능 (나무위키 ⓗ · ⓢ, user request 2026-11-15): the symbol after the brand + its meaning on hover */
const karaOnlyMark = (it, b) => it.only && it.only[b] ? `<small>${esc(it.only[b].charAt(0))}</small>` : "";
const karaOnlyTip = (it, b, base) => it.only && it.only[b] ? `${base} — 특정 기기에서만 선곡 가능: ${it.only[b]}` : base;
/* 보컬이 너무 많은 곡 (user request 2026-11-16): 앞 VOCAL_SHOW 명만 칩 · 나머지는 '+N' 칩 (곡 상태 태그 MANY_VOCALS 의 색) →
   누르면 전체 보컬을 스크롤되는 작은 팝업으로 (펼치면 세로 화면에서 영상·가사가 밀려나서). 제목 옆 보컬 줄도 같음 */
// 정보 카드 (artist_card.js): a chip with a card has no '보컬' / '프로듀서' tooltip — it covered the card (user request 2026-11-22)
const vocalChip = ([n, c]) => { const a = cardAttrs("singer", n);
  return `<span class="b vocal${a ? " icard" : ""}" style="--vc:${esc(c)}"${a || ' title="보컬"'}>${esc(n)}</span>`; };
const vocalMoreChip = (n, all) => { const c = tagColor("flag", MANY_VOCALS);
  return `<button type="button" class="b vmore${c ? " tc" : ""}"${c ? ` style="--tc:${esc(c)}"` : ""} data-vmore title="보컬 ${all}명 — 눌러서 모두 보기">+${n}</button>`; };
const vocalsOf = it => it.vocals && it.vocals.length ? it.vocals : String(it.singer || "").split(",").map(x => x.trim()).filter(Boolean).map(n => [n, vocalColor(n)]);
function showArtist(it) {
  if (!it.vocalMore) { $("nowArtist").innerHTML = artistHtml(it); return; }
  $("nowArtist").innerHTML = `${artistHtml(it, it.artistBase)} ${vocalMoreChip(it.vocalMore, it.vocalMore + VOCAL_SHOW)}`;
}
function vocalPopClose() { document.querySelectorAll(".vpop").forEach(p => p.remove()); }
function vocalPop(btn) {
  const vs = cur ? vocalsOf(cur) : [];
  chipPop(btn, `<div class="h">보컬 ${vs.length}명</div>${vs.map(vocalChip).join("")}`);
}
/* a small popup under a chip (보컬 +N · 파일 포맷 링크 여럿) — the same chip again closes it */
function chipPop(btn, html) {
  const open = document.querySelector(".vpop");
  vocalPopClose();
  if (!cur || (open && open._from === btn)) return;
  const p = document.createElement("div");
  p.className = "vpop"; p._from = btn;
  p.innerHTML = html;
  document.body.appendChild(p);
  // 화면 축소(--ui-zoom): same correction as ctxMenu · below the chip, above it when there is no room
  const f = uiZoom();
  const r = btn.getBoundingClientRect(), w = p.offsetWidth * f, h = p.offsetHeight * f;
  const x = Math.max(4, Math.min(r.left, innerWidth - w - 4)), y = r.bottom + 4 + h <= innerHeight ? r.bottom + 4 : Math.max(4, r.top - 4 - h);
  p.style.left = x / f + "px"; p.style.top = y / f + "px";
}
document.addEventListener("click", e => { const b = e.target.closest("[data-vmore]"); if (b) { e.stopPropagation(); vocalPop(b); } });
/* 파일 포맷 태그 (user request 2026-11-18): 반주 · MIDI … 칩 — 접히는 '+N' 에 넣지 않음, 누르면 그 링크로 바로 (여럿이면 고르는 팝업).
   파일은 우리에게 없고 VocaDB 에 적힌 링크만 있음 (piapro 등은 그 사이트에서 받음) */
const linkHost = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const fileLinks = (it, k) => (it.files || []).filter(f => f[0] === k);
function fileChip(it, k) {
  const ls = fileLinks(it, k), c = tagColor("file", k);
  const tip = ls.length === 1 ? `${k} — 누르면 링크로 이동\n${ls[0][2] || linkHost(ls[0][1])}\n${ls[0][1]}` : `${k} 링크 ${ls.length}개 — 눌러서 고르기`;
  return `<button type="button" class="b file${c ? " tc" : ""}"${c ? ` style="--tc:${esc(c)}"` : ""} data-file="${esc(k)}" title="${esc(tip)}">⤓ ${esc(k)}${ls.length > 1 ? ` <small>${ls.length}</small>` : ""}</button>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-file]"); if (!b || !cur) return;
  e.stopPropagation();
  const k = b.dataset.file, ls = fileLinks(cur, k);
  if (ls.length === 1) { vocalPopClose(); window.open(ls[0][1], "_blank", "noopener"); return; }
  chipPop(b, `<div class="h">${esc(k)} 링크 ${ls.length}개</div>${ls.map(([, u, d]) =>
    `<a class="b flink" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">${esc(d || linkHost(u))}${d ? ` <small>${esc(linkHost(u))}</small>` : ""}</a>`).join("")}`);
});
document.addEventListener("click", e => { if (e.target.closest(".vpop a.flink")) setTimeout(vocalPopClose); });
addEventListener("mousedown", e => { if (!e.target.closest(".vpop, [data-vmore], [data-file]")) vocalPopClose(); }, true);
addEventListener("keydown", e => { if (e.key === "Escape") vocalPopClose(); });
addEventListener("scroll", e => { if (!(e.target.closest && e.target.closest(".vpop"))) vocalPopClose(); }, true);
addEventListener("resize", vocalPopClose);
/* 원곡 ↗ (user request 2026-11-21): a chip after 싱크 표시 for the song's main original — only on songs that are not it.
   A click searches it (2026-11-23: 원곡만 + its 원제 + its producers as the filter; LOCAL plays it).
   Main original = of the same song (origId up to the top, then every version under the top — sameSong) the versions by the
   top song's producer, the long one with the most VocaDB rating (실패작 소녀: the Niconico upload, not the album 'Original'
   VocaDB puts on top). Other people's covers / remixes never count as it. */
let origKids = null;  // origId → versions made from it, over every song (made once when the whole list is in)
const mainOrig = it => { const f = origFamily(it); return f && f.best !== it ? f.best : null; };
/* the song's family: {best: its main original, fam: every version of the same song (it too)} */
function origFamily(it) {
  if (!it || !it.vocadb) return null;
  let top = it;
  for (let o = it.origId, seen = new Set([String(it.vocadb)]), i = 0; o && i < 20 && !seen.has(String(o)); i++) {
    seen.add(String(o));
    const p = VDB.itemById(o); if (!p) break;
    if (sameSong(it, p)) top = p;
    o = p.origId;
  }
  if (!origKids && VDB.done) {
    origKids = new Map();
    for (const x of VDB.all()) if (x.origId) { const k = String(x.origId); (origKids.get(k) || origKids.set(k, []).get(k)).push(x); }
  }
  const fam = [top], seen = new Set([String(top.vocadb)]);
  for (let i = 0; i < fam.length && fam.length < 5000; i++)
    for (const x of (origKids && origKids.get(String(fam[i].vocadb))) || [])
      if (!seen.has(String(x.vocadb)) && sameSong(x, top)) { seen.add(String(x.vocadb)); fam.push(x); }
  if (!seen.has(String(it.vocadb))) fam.push(it);
  const tp = peopleSet(top.composer), own = x => x === top || [...peopleSet(x.composer)].some(p => tp.has(p));
  const best = fam.filter(own).sort((a, b) => (isShortVer(a) ? 1 : 0) - (isShortVer(b) ? 1 : 0) || (b.rating || 0) - (a.rating || 0))[0];
  return {best: best || it, fam};
}
/* 원곡 칩 (user request 2026-11-23): on the main original itself, when other versions of it are in our DB — hover shows
   them like the producer card (artist_card.js, look only), a click searches its 원제 in 곡 검색 with 모든곡 */
const origVersions = it => { const f = origFamily(it); return f && f.best === it ? f.fam.filter(x => x !== it) : []; };
document.addEventListener("click", e => {
  const b = e.target.closest("[data-orig]"); if (!b) return;
  e.stopPropagation();
  const o = VDB.itemById(b.dataset.orig); if (o) ONLINE ? origSearch(o) : play(o);  // LOCAL (no 곡 검색): play it
});
/* 곡 검색: 원곡만 + the original's 원제 + its producers as the filter (user request 2026-11-23 — was: play it) */
function origSearch(o) {
  if (o) cardSearch("composer", String(o.composer || "").split(", ").filter(Boolean), o.def || o.title || "");
}
/* 곡 태그 칩 묶음 순서 when filter.json has none (= server filter_settings.CHIP_GROUPS) */
const CHIP_ORDER = ["producer", "vocal", "support", "kara", "gone", "list", "tag", "file"];
function renderMeta(it) {
  const tags = it.tags || [], notes = it.notes || [], box = $("songMeta");
  const kara = tags.filter(t => KARAOKE_TAG[t]).map(t => [KARAOKE_TAG[t], t]);
  // 우리 DB 태그는 많이 붙은 순 앞 8개만 (분류는 마우스를 올리면). 음성 합성 엔진은 맨 앞 보컬(보컬 색)로 보이므로 뺌
  const lists = tags.filter(t => t === "한국" || t === "일본");
  const inner = [...lists, ...tags.filter(t => !KARA_RE.test(t) && !lists.includes(t) && tagGroupOf(t) !== "음성 합성 엔진").slice(0, 8)];
  const tagChip = t => lists.includes(t) ? tagChipHtml("kara", t, t, `inner${t === "한국" ? " ko" : " ja"}`, "노래방 목록 (한국·일본)")
    : tagChipHtml("tag:" + tagGroupOf(t), t, t, "", tagGroupOf(t) || "태그", cardAttrs("tags", t));
  // user request 2026-11-15: only colored chips are shown; the plain ones fold behind a "+N" chip (open state remembered)
  const isPlain = t => !lists.includes(t) && !tagColor("tag:" + tagGroupOf(t), t);
  const vocals = it.vocals || [];
  // 곡 태그 표시 순서 (user request 2026-11-18: Manage › 필터 › 곡 태그 표시 순서 → filter.json chips; built-in: 파일 포맷 last)
  // 프로듀서 칩 (user request 2026-11-22): one shared light gray, card · search like the name in the artist line
  const prodChip = n => { const a = cardAttrs("composer", n); return `<span class="b prodchip${a ? " icard" : ""}"${a || ' title="프로듀서"'}>${esc(shortName(n))}</span>`; };
  const groups = {
    producer: String(it.composer || "").split(", ").filter(Boolean).map(prodChip),
    vocal: [...vocals.slice(0, VOCAL_SHOW).map(vocalChip), ...(vocals.length > VOCAL_SHOW ? [vocalMoreChip(vocals.length - VOCAL_SHOW, vocals.length)] : [])],
    // VocaDB 보조 보컬 (user request 2026-11-22): a plain chip — no color, no card, not a vocal anywhere else
    support: String(it.support || "").split(", ").filter(Boolean).map(n => `<span class="b" title="보컬(보조 보컬)">${esc(n)}</span>`),
    kara: kara.map(([t, b]) => `<span class="b kara" style="--bc:${tagColor("kara", b) || BRAND_COLOR[b]}" title="${esc(karaOnlyTip(it, b, "노래방 수록"))}">${esc(t)}${karaOnlyMark(it, b)}</span>`),
    gone: Object.keys(it.gone || {}).map(b => `<span class="b kara gone" style="--bc:${tagColor("kara", b) || BRAND_COLOR[b] || "#888"}" title="노래방에서 내려간 곡입니다 (${esc(b)} ${esc(it.gone[b])})">${esc(KARAOKE_TAG[b] || b)}</span>`),
    list: lists.map(tagChip),
    tag: inner.filter(t => !lists.includes(t) && !isPlain(t)).map(tagChip),
    file: fileKindsOf(it).map(k => fileChip(it, k)),  // 파일 포맷: always shown, never folded (user request 2026-11-18)
  };
  const order = [...new Set([...((VDB.filter && VDB.filter.chips) || []), ...CHIP_ORDER])].filter(g => groups[g]);
  const chips = order.flatMap(g => groups[g]);
  const plain = [...inner.filter(isPlain).map(tagChip), ...(it.categories || []).map(c => `<span class="b" title="나무위키 분류">${esc(c)}</span>`)];
  const open = !!store.get("tagsOpen", false);
  const more = plain.length ? `<button class="b more" id="tagsMore" title="${open ? "나머지 태그 접기" : "나머지 태그 보기"}">${open ? "접기" : `+${plain.length}`}</button>` : "";
  const sync = $("syncChip");  // 싱크 표시 stays the first chip (user request 2026-11-15) — kept across re-renders, filled by renderSyncChip
  box.hidden = false;
  box.innerHTML = `<div class="cats">${chips.join("")}${open ? plain.join("") : ""}${more}</div>`
    + (notes.length ? `<div class="fn" title="노래방 수록 목록의 각주">${notes.map(n => `<div>※ ${esc(n)}</div>`).join("")}</div>` : "");
  box.querySelector(".cats").prepend(sync);
  const o = mainOrig(it);
  // SERVER: hover = the original's own card (artist_card.js songCardHtml) · LOCAL: a tooltip, a click plays it
  if (o) sync.insertAdjacentHTML("afterend", ONLINE
    ? `<button type="button" class="b file orig icard" data-orig="${esc(o.vocadb)}" data-cid="${esc(o.vocadb)}" data-ck="s" data-n="${esc(titleOf(o))}">원곡 ↗</button>`
    : `<button type="button" class="b file orig" data-orig="${esc(o.vocadb)}" title="${esc(`원곡: ${titleOf(o)}${o.date ? ` (${o.date})` : ""} — 누르면 재생`)}">원곡 ↗</button>`);
  else if (ONLINE && origVersions(it).length)
    sync.insertAdjacentHTML("afterend", `<button type="button" class="b file orig icard" data-cid="${esc(it.vocadb)}" data-ck="o" data-fk="orig" data-n="${esc(it.def || it.title || "")}">원곡</button>`);
}
async function loadSong() {
  const it = cur; if (!it) return;
  let s;
  try { s = await api(`/api/lyrics?site=${encodeURIComponent(it.site)}&name=${encodeURIComponent(it.name)}`); }
  catch (e) { if (cur !== it) return; song = null; $("lyrics").innerHTML = `<div class="empty">가사를 받아오는데 실패했습니다.<br><span class="hint">${esc(e.message)}</span></div>`; renderSyncChip(); return; }
  if (cur !== it) return;  // 가사를 받는 사이 다른 곡으로 넘어감 (온라인 곡은 위키를 읽느라 늦게 옴) → 늦게 온 앞 곡 가사로 덮지 않음
  song = s;
  songTimes();
  renderLyrics(); renderSyncChip();
}
function songTimes() {
  const sj = song.sync;
  times = sj && (song.sync_state === "ok" || song.sync_state === "resync") ? sj.times : null;  // 재싱크 필요여도 지난 싱크로 우선 표시
  offset = sj ? +sj.offset || 0 : 0;
}
function renderSyncChip() {
  const c = $("syncChip"), sj = song && song.sync;
  let txt = "싱크 없음", cls = "b sync";
  if (song && song.load_err) { txt = "가사 받기 실패"; cls += " warn"; }
  else if (!song || !song.groups.length) txt = "가사 없음";
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
  // edited here, waiting for the manage screen to confirm (반영) — played meanwhile; an admin's edit is applied without one
  if (times && song.sync_pending && !song.sync_pending.admin) {
    txt += " · 확인 대기";
    c.title = "고친 싱크가 음원 관리의 확인을 기다리는 중입니다. 반영되면 본 싱크가 되고, 버려지면 전 싱크로 돌아갑니다.\n" + c.title;
  }
  c.textContent = txt; c.className = cls;
  showOff();
  const has = !!(song && song.groups.length), fail = song && song.sync_fail;
  $("failChip").hidden = !fail;
  if (fail) { $("failChip").textContent = `자동 싱크 실패: ${fail.reason}`; $("failChip").title = `${fail.at} · 모델 ${fail.model || "?"}`; }
  $("btnEdit").disabled = !has;
  partsBtn();
  $("offMinus").disabled = $("offPlus").disabled = !times && !editing;
}
function showOff() {
  const v = editing ? editShift : offset;
  $("offVal").textContent = (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(1) + "초";
}
/* 가사 출처 (user request 2026-11-16, PC · mobile): 원문 · 발음 · 번역 rows above the lyrics.
   Ours: the wiki the lyrics file came from (its reading / translation lines come with it). VocaDB: each row's own lyric
   (language · source); 발음 made by the server = 자동 생성 (lines it had no reading for keep VocaDB's romaji). Lines marked
   auto make a row 자동 생성 too (translation engine not built yet). A row with no lines = 없음. */
const LANG_KO = {ja: "일본어", en: "영어", ko: "한국어", zh: "중국어", cmn: "중국어", es: "스페인어", fr: "프랑스어", ru: "러시아어", de: "독일어", id: "인도네시아어", th: "태국어", tl: "타갈로그어"};
const WIKI_KO = {namu: "나무위키", vocaro: "보카로 가사위키", unknown: "출처 모름 (구버전)"};
function lyricsSources(s) {
  const lines = s.groups.flatMap(g => g.cols ? g.cols.flatMap(c => c.lines || []) : g.lines);
  const link = (text, url) => /^https?:\/\//.test(url || "") ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
  const vdb = m => {
    const lang = m.type === "Romanized" ? "로마자" : (m.lang || []).filter(c => c !== "und").map(c => LANG_KO[c] || c).join("·");
    return link(`VocaDB${lang ? " " + lang : ""}${m.type === "Original" ? " (원본)" : m.type === "Translation" ? " (번역)" : ""}`, m.url) + (m.source ? ` · ${esc(m.source)}` : "");
  };
  const wiki = WIKI_KO[s.lyrics_kind] ? link(WIKI_KO[s.lyrics_kind], s.lyrics_src) : "";
  const info = s.src_info || {};
  const row = role => {
    const ls = lines.filter(l => l.role === role && l.text);
    if (!ls.length) return "없음";
    const m = info[role], nAuto = ls.filter(l => l.auto).length;
    if (m && m.by === "auto") return nAuto === ls.length || !m.fill ? "자동 생성" : `자동 생성 + ${vdb(m.fill)} (${ls.length - nAuto}줄)`;
    const base = m ? vdb(m) : wiki || "출처 모름";
    return nAuto === ls.length ? "자동 생성" : nAuto ? `${base} + 자동 생성 (${nAuto}줄)` : base;
  };
  // 가사·싱크 나눔 (user request 2026-11-18): another version of the same song (length within ±5 s) lent its lyrics / sync —
  // said on one small line under the sources, so the two lines take little room
  const sh = s.shared;
  const shared = sh ? `<div class="lshare">${sh.original ? "원곡" : "같은 곡"} [${esc(sh.title)}] 에서 ${s.sync && (sh.sync && !s.sync_pending || s.sync_pending && s.sync_pending.from) ? "가사와 싱크를" : "가사를"} 공유받습니다.</div>` : "";
  return `<div class="lsrc"><span><b>원문</b> ${row("o")}</span><span><b>발음</b> ${row("r")}</span><span><b>번역</b> ${row("t")}</span>${shared}</div>`;
}
function renderLyrics() {
  const box = $("lyrics");
  curIdx = -1;
  if (!song || !song.groups.length) {
    box.className = "nosync";
    // failed load ≠ no lyrics (user request 2026-11-19: say it failed, e.g. VocaDB blocked our IP)
    if (song && song.load_err) { box.innerHTML = `<div class="empty">가사를 받아오는데 실패했습니다.<br><span class="hint">${esc(song.load_err)}</span></div>`; return; }
    box.innerHTML = `<div class="empty">가사 없음${cur && cur.site === "local" ? '<br><span class="hint">mp3 와 같은 이름의 가사·싱크 json 이 없습니다 (음원 관리 › mp3 다운로드로 받은 곡은 같이 받음)</span>' : ""}</div>`;
    return;
  }
  const matched = (song.sync && song.sync.matched) || [];
  const notes = (song.notes || []).length ? `<div class="lnotes">${song.notes.map(esc).join("<br>")}</div>` : "";
  const partTag = p => p ? `<div class="part" style="--pc:${/^#[0-9a-f]{6}$/i.test(p.color) ? inkOf(p.color) : "transparent"}">${
    (p.colors || [null]).map(c => c && /^#[0-9a-f]{6}$/i.test(c) ? `<i style="--pc:${inkOf(c)}"></i>` : "<i></i>").join("")}${esc(p.name)}</div>` : "";
  // 동시에 부르는 묶음(g.cols): 보컬마다 칸을 나란히 (칸 위에 그 보컬 이름)
  const lyring = editing && editMode === "lyrics";  // 가사편집: row buttons under each group, the open row as inputs
  box.innerHTML = lyricsSources(song) + notes + song.groups.map((g, i) => `<div class="g${times && song.sync.method !== "manual" && matched[i] === false ? " guess" : ""}" data-i="${i}">
      ${lyring && i === lyrEdit ? lyrEditor(g) : g.cols ? lyrCols(g, p => partTag(p) || '<div class="part">&nbsp;</div>') : partTag(g.part) + g.lines.map(l => lyrLine(l.role + (l.auto ? " auto" : "") + (l.lang ? ` xl-${l.lang}` : ""), l.text, g.vc)).join("")}
      <div class="prog"><i></i></div>
      <div class="stamp"><button data-d="-1" title="1초 앞으로">&lt;&lt;</button><button data-d="-0.2" title="0.2초 앞으로">&lt;</button><span class="tv"></span><button data-d="0.2" title="0.2초 뒤로">&gt;</button><button data-d="1" title="1초 뒤로">&gt;&gt;</button></div>
      ${lyring && i !== lyrEdit ? lyrTools(g) : ""}
    </div>`).join("");
  box.className = (times && !editing ? "" : "nosync ") + (editing ? {sync: "editing ", parts: "parting ", lyrics: "lyring "}[editMode] : "") + ($("showR").checked ? "" : "hide-r ") + ($("showT").checked ? "" : "hide-t ") + ($("showP").checked ? "" : "hide-p ");
  renderXLang();
  box.scrollTop = 0;
  if (editing && editMode === "sync") renderStamps();
  tick(true);
}

$("lyrics").addEventListener("click", e => {
  const g = e.target.closest(".g"); if (!g) return;
  const i = +g.dataset.i;
  if (editing) {  // 싱크 (파트분리 · 가사편집 clicks are taken before this — capture listener below)
    const d = e.target.closest("button[data-d]");
    if (d) { if (editTimes[i] != null) { editTimes[i] = Math.max(0, +(editTimes[i] + +d.dataset.d).toFixed(2)); editOk[i] = true; audio.currentTime = Math.max(0, editTimes[i] - 0.5); } }
    else { cursor = i; if (editTimes[i] != null) audio.currentTime = Math.max(0, editTimes[i] - 1); }
    renderStamps(); return;
  }
  if (times) { audio.currentTime = Math.max(0, times[i] + offset); if (audio.paused) audio.play(); }
});
$("lyrics").addEventListener("wheel", () => userScrollAt = Date.now(), {passive: true});
$("lyrics").addEventListener("touchmove", () => userScrollAt = Date.now(), {passive: true});

/* 현재 묶음 표시 — 0.25초마다 + 다음 줄로 바뀌는 순간 (nextTimer). Was every frame; the phone got hot (user request
   2026-11-18): the time · bar are written only when they change, and the line's progress bar runs by itself (CSS transition) */
let tShown = "", seekShown = -1, progRun = "";
function tick(force) {
  const now = audio.currentTime, t = fmt(now);
  if (t !== tShown) $("tCur").textContent = tShown = t;
  const sv = !seeking && audio.duration ? Math.round(now / audio.duration * 1000) : seekShown;
  if (sv !== seekShown) { $("seek").value = seekShown = sv; fillRange($("seek")); }
  const T = editing ? editTimes : times;
  if (!T || !song) return;
  const off = editing ? 0 : offset;  // '가사 먼저 보이기' is the overlay's only — the player shows the sync as it is (user request 2026-11-18)
  let idx = -1;
  for (let i = 0; i < T.length; i++) { if (T[i] != null && T[i] + off <= now + 0.05) idx = i; else if (T[i] != null) break; }
  const box = $("lyrics");
  if (idx !== curIdx || force) {
    const gs = box.querySelectorAll(".g"), was = curIdx;
    // only the lines whose look changes (all of them on force: new lyrics · seek)
    const all = force || was < 0 || idx < 0, from = all ? 0 : Math.min(was, idx), to = all ? gs.length - 1 : Math.max(was, idx);
    for (let i = from; i <= to && i < gs.length; i++) { gs[i].classList.toggle("cur", i === idx); gs[i].classList.toggle("past", idx >= 0 && i < idx); }
    curIdx = idx;
    // 셀렉트 박스(필터 등)를 열어 둔 동안은 가사 칸을 움직이지 않음 — 화면 안에서 스크롤이 일어나면 브라우저가 열린 목록을 닫음
    const el = idx >= 0 && gs[idx];
    if (el && Date.now() - userScrollAt > 4000 && !editing && !selectOpen()) box.scrollTop = el.offsetTop - box.clientHeight * 0.35;
  }
  // the line's progress bar: set where it is now and let it run to the end on its own (restarted on a new line · play/pause · seek)
  const run = `${idx}|${audio.paused}|${off}`;
  if (idx >= 0 && (run !== progRun || force)) {
    progRun = run;
    const bar = box.querySelector(`.g[data-i="${idx}"] .prog i`);
    if (bar) {
      const st = T[idx] + off, end = idx + 1 < T.length && T[idx + 1] != null ? T[idx + 1] + off : (audio.duration || now + 1);
      const p = Math.min(1, Math.max(0, (now - st) / Math.max(0.1, end - st)));
      bar.style.transition = "none"; bar.style.transform = `scaleX(${p})`;
      if (!audio.paused && p < 1) {
        void bar.offsetWidth;  // start the transition from p
        bar.style.transition = `transform ${Math.max(0, end - now) / (audio.playbackRate || 1)}s linear`; bar.style.transform = "scaleX(1)";
      }
    }
  }
  // 다음 줄로 바뀌는 그 순간에 한 번 더 (창이 가려져 화면 갱신 신호가 멈추면 0.2초마다 확인만으로는 최대 0.2초 늦음)
  clearTimeout(nextTimer);
  if (APP.screenOff) return;  // phone screen off: no lyrics checks until it is on again (battery)
  const nb = T.find((t, i) => i > idx && t != null);
  if (!audio.paused && nb != null) nextTimer = setTimeout(() => tick(false), Math.max(0, (nb + off - 0.05 - now) * 1000 / (audio.playbackRate || 1)) + 2);
}
var nextTimer = 0;
/* 셀렉트 박스에 초점이 있으면 열려 있는 것으로 봄 (열린 상태를 알려 주는 기능이 없음). 고르면 초점을 놓아 가사가 다시 따라가고,
   초점이 빠지면 밀린 가사 위치로 바로 옮김 */
function selectOpen() { return !!document.activeElement && document.activeElement.tagName === "SELECT"; }
document.addEventListener("change", e => { if (e.target.tagName === "SELECT") e.target.blur(); });
document.addEventListener("focusout", e => { if (e.target.tagName === "SELECT") setTimeout(() => tick(true), 0); });
// 0.25초마다 (시간 · 재생 막대) — 줄이 바뀌는 순간은 nextTimer 가 맞춤. 탭이 가려져 있으면 그리지 않음 (돌아오면 바로 맞춤)
// 폰 화면이 꺼지면 가사를 아예 확인하지 않음 — 켜지면 그 자리로 바로 맞춤 (user request 2026-11-15, battery)
const tickTimer = setInterval(() => { if (!audio.paused && !APP.screenOff && !document.hidden) tick(false); }, 250);
on(window, "appscreen", e => { if (e.detail.on) tick(true); });
on(document, "visibilitychange", () => { if (!document.hidden) tick(true); });
cleanups.push(() => clearInterval(tickTimer));
// ❚❚ not ⏸︎: Samsung phones ignore the text selector and draw ⏸ as an orange emoji (user report 2026-11-16)
on(audio, "play", () => { $("btnPlay").innerHTML = playIcon(false); tick(false); });
on(audio, "pause", () => { $("btnPlay").innerHTML = playIcon(true); tick(false); });
on(audio, "seeked", () => tick(true));
on(audio, "loadedmetadata", () => { $("tDur").textContent = fmt(audio.duration); });
// audio.error 가 없으면 이미 다음 곡으로 넘어간 것 (재생기가 못 튼 곡을 건너뜀) → 새 곡에 오류 글을 적지 않음
on(audio, "error", () => { if (cur && audio.error) $("nowArtist").textContent = cur.site === "stream" ? audio.error.reason || "원곡 영상을 재생할 수 없습니다" : "재생할 수 없는 파일입니다: " + cur.name; });
on(audio, "playing", () => { if (cur) showArtist(cur); });  // 끊겼다 이어 틀면 오류 글을 되돌림
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
  offTimer = setTimeout(() => SHELL.sending(() => post("/api/sync/save", {site: s.site, name: s.name, offset})).catch(e => uiAlert(e.message)), 600);
}
$("offMinus").onclick = () => nudge(-0.2);
$("offPlus").onclick = () => nudge(0.2);

/* ================= 직접 맞추기 · 파트분리 · 가사편집 ================= */
// user request 2026-11-22: 싱크 opens one edit — admins get 파트분리 · 가사편집 next to it and switch between the three freely;
// what was changed in one stays while in the others, 저장 keeps all three at once and 취소 drops all three
var editMode = "sync", editBase = null, editStart = null;  // the groups · times the edit began with (취소 · what changed)
const EDIT_GUIDE = {
  sync: "재생하면서 각 묶음이 시작될 때 <kbd>Space</kbd> 또는 <kbd>↓</kbd> — 점선 묶음에 지금 시간을 찍습니다. <kbd>↑</kbd> 한 묶음 뒤로, 묶음을 누르면 그 묶음부터.",
  parts: "보컬을 고르고 가사 묶음을 누르면 그 묶음의 파트가 됩니다. <kbd>Shift</kbd> 누르고 누르면 앞에 누른 묶음부터 여기까지.",
  lyrics: "묶음마다 위·아래에 행 추가 · 편집 · 삭제. 편집 칸에서 <kbd>Enter</kbd> 확인, <kbd>Esc</kbd> 되돌리기. 저장 · 취소는 싱크 · 파트분리 · 가사편집 모두에 한 번에.",
};
// 파트분리 · 가사편집: admin token, our lyrics only (not VocaDB's lyrics, not an mp3 folder)
const moreEdit = () => typeof isAdmin === "function" && isAdmin() && !!(cur && cur.lyrics && cur.site !== "local" && song && song.groups.length && song.lyrics_kind !== "vocadb");
function startEdit() {
  if (!song || !song.groups.length) return;
  editing = true; SHELL.editing = true;
  // phone (user request 2026-11-15): fold the video while syncing, unfold it again when done (not remembered)
  editFoldedVid = document.body.classList.contains("m") && VID.on;
  if (editFoldedVid) { VID.on = false; showVideo(); }
  // phone (user request 2026-11-16): the lyrics tool bar folds too, and unfolds when done (the remembered fold stays as it was)
  // — not for admins: the bar holds the 싱크 · 파트분리 · 가사편집 switch (2026-11-22)
  editFoldedBar = document.body.classList.contains("m") && !document.body.classList.contains("barfold") && !moreEdit();
  if (editFoldedBar) applyBar(true);
  editTimes = song.groups.map((_, i) => times ? +(times[i] + offset).toFixed(2) : null);
  editShift = offset;  // the song's current push is baked into editTimes; show it as the start value
  // 묶음마다 믿을 만한 시간인지: 인식으로 맞았거나 손으로 찍음 → 안 고친 '추정' 묶음은 저장해도 추정으로 남음
  const m = (song.sync && song.sync.matched) || [];
  editOk = song.groups.map((_, i) => !!times && (song.sync.method === "manual" || m[i] !== false));
  cursor = 0;
  if (times) { const t = audio.currentTime; cursor = Math.max(0, editTimes.findIndex(x => x > t)); }
  editBase = JSON.parse(JSON.stringify(song.groups)); editStart = JSON.stringify([editTimes, editOk]);
  lyrEdit = -1; lyrNew = false; parting = null;
  $("editbar").classList.add("show");
  $("offMinus").disabled = $("offPlus").disabled = false; showOff();
  partsBtn();
  setEditMode("sync");
}
/* ends the edit — whatever was not saved goes (취소 · another song) */
function stopEdit() {
  if (editBase && song) song.groups = editBase;
  editing = false; editTimes = null; editOk = null; editBase = editStart = null; parting = null; lyrEdit = -1; SHELL.editing = false;
  if (editFoldedVid) { editFoldedVid = false; VID.on = true; showVideo(); }
  if (editFoldedBar) { editFoldedBar = false; applyBar(false); }
  $("editbar").classList.remove("show", "sync"); $("partNew").hidden = true;
  for (const id of ["btnEdit", "btnParts", "btnLyrEdit"]) $(id).classList.remove("on");
  partsBtn();
  showOff(); $("offMinus").disabled = $("offPlus").disabled = !times;
  $("lyrics").classList.remove("editing", "parting", "lyring");
  $("lyrics").classList.toggle("nosync", !times);
  $("lyrics").querySelectorAll(".g.cursor").forEach(el => el.classList.remove("cursor"));
}
function setEditMode(m) {
  if (m !== "sync" && !parting) m = "sync";
  if (m !== "lyrics" && lyrEdit >= 0 && !lyrApply()) return;  // a row open in 가사편집 is taken as it is first
  editMode = m;
  for (const [id, k] of [["btnEdit", "sync"], ["btnParts", "parts"], ["btnLyrEdit", "lyrics"]]) $(id).classList.toggle("on", m === k);
  $("editGuide").innerHTML = EDIT_GUIDE[m];
  $("offBox").hidden = m !== "sync";
  $("partRow").hidden = m !== "parts";
  if (m !== "parts") $("partNew").hidden = true;
  $("editbar").classList.toggle("sync", m === "sync");  // phone ↑ ↓ keys: 싱크 only
  rerenderKeepScroll();
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
// ↓ / Space: stamp (paused → play first) · ↑: one group back — keyboard and the phone's floating buttons
function editDown() { if (audio.paused) audio.play(); else stamp(); }
function editUp() { cursor = Math.max(0, cursor - 1); renderStamps(); }
// pointerdown, not click: the stamp lands when the finger touches, and the button never takes focus
for (const [id, fn] of [["editDown", editDown], ["editUp", editUp]])
  $(id).addEventListener("pointerdown", e => { e.preventDefault(); if (editing && editMode === "sync") fn(); });
$("btnEdit").onclick = async () => {
  if (editing) {
    if (editMode !== "sync") return setEditMode("sync");
    if (editChanged() && !await uiConfirm("고친 내용을 저장하지 않고 편집을 끝낼까요?", "끝내기")) return;
    stopEdit(); renderLyrics(); return;
  }
  // OPEN CHANNEL (user request 2026-11-20): syncing leaves the channel — asked first; the channel's song stays here to sync
  if (typeof LT !== "undefined" && LT.chOn && LT.role) {
    if (!await uiConfirm("싱크를 수정하면 OPEN CHANNEL 에서 나가집니다. 나가고 싱크를 수정할까요?", "나가고 싱크 수정")) return;
    ltLeaveBtn(true);
  }
  startEdit();
};
$("btnParts").onclick = () => { if (editing) setEditMode("parts"); };
$("btnLyrEdit").onclick = () => { if (editing) setEditMode("lyrics"); };
$("btnEditCancel").onclick = () => { stopEdit(); renderLyrics(); };

/* what the edit changed: 가사 (rows · text) · 파트 · 싱크 (times; new lyrics re-save the times when there are any) */
const lyrKey = g => JSON.stringify([g.orig, g.lines.map(l => [l.role, l.text, l.lang || ""])]);
const partKey = gs => JSON.stringify(gs.map(g => g.cols ? null : g.part || null));
function editChanges() {
  const lyr = song.groups.length !== editBase.length || song.groups.some((g, i) => lyrKey(g) !== lyrKey(editBase[i]));
  const prt = !!parting && (partKey(song.groups) !== partKey(editBase) || (lyr && song.groups.some(g => g.part)));
  const syn = JSON.stringify([editTimes, editOk]) !== editStart || (lyr && editTimes.some(x => x != null));
  return {lyr, prt, syn};
}
const editChanged = () => { const c = editChanges(); return c.lyr || c.prt || c.syn; };
// 찍지 않은 묶음은 앞뒤 시간 사이를 고르게 채움 → null when nothing is stamped
function fillTimes(src) {
  const T = src.slice(), n = T.length;
  if (T.every(x => x == null)) return null;
  let first = T.findIndex(x => x != null);
  for (let i = first - 1; i >= 0; i--) T[i] = Math.max(0, T[i + 1] - 3);
  for (let i = 1; i < n; i++) if (T[i] == null) {
    let j = i; while (j < n && T[j] == null) j++;
    const a = T[i - 1], b = j < n ? T[j] : a + 4 * (j - i + 1);
    for (let k = i; k < j; k++) T[k] = +(a + (b - a) * (k - i + 1) / (j - i + 1)).toFixed(2);
    i = j;
  }
  return T;
}
$("btnEditSave").onclick = async () => {
  if (lyrEdit >= 0 && !lyrApply()) return;
  const ch = editChanges();
  if (!ch.lyr && !ch.prt && !ch.syn) { stopEdit(); renderLyrics(); return; }
  const T = ch.syn ? fillTimes(editTimes) : null;
  if (ch.syn && !T) { uiAlert("찍은 시간이 없습니다."); return; }
  // user request 2026-11-17: spinner + "서버에 전송중..." on 저장, 취소 locked, the song doesn't move on until it's sent
  const lock = on => { for (const id of ["btnEditCancel", "btnEdit", "btnParts", "btnLyrEdit"]) $(id).disabled = on; };
  sendingBtn($("btnEditSave"), true); lock(true);
  await SHELL.sending(async () => {
    const s = song, groups = s.groups, ok = editOk.slice(), from = await lyricsHash(editBase);
    // in this order: new lyrics first, then the parts and times of those lyrics
    try {
      if (ch.lyr) song = await post("/api/lyrics/save", {site: s.site, name: s.name, from, groups});
      if (ch.prt) song = await post("/api/parts/save", {site: s.site, name: s.name, parts: groups.map(g => g.cols ? null : g.part || null), vc: groups.map(g => g.vc)});
      if (ch.syn) song = await post("/api/sync/save", {site: s.site, name: s.name, times: T, matched: ok, offset: 0});
    } catch (e) {
      if (song === s) { uiAlert(e.message); return; }  // nothing kept yet — the edit stays open
      uiAlert(e.message + "\n(앞 단계까지는 저장됐습니다)");
    } finally { sendingBtn($("btnEditSave"), false); lock(false); }
    editBase = null; stopEdit(); songTimes(); syncShell();
    // the song's list mark is already updated (admin: LOCAL.oursCell) — re-downloading the whole list (MBs on GitHub) left the load bar up
    rerenderKeepScroll(); renderSyncChip(); renderList();
  });
};

/* ================= 파트분리 (관리자) ================= */
// user request 2026-11-21: admin token only — pick a vocal, click lyrics groups to give them that part
// (shift-click: from the last clicked group). Saved like an admin's sync (local_files.js saveParts); groups sung at once stay
var parting = null;  // {orig: [{part, vc}], brush, last, plain, own: {name: colors}} — while editing, admin only
const partColors = n => (parting && parting.own[n]) || (n.includes("합창") ? vocalsOf(cur).map(v => v[1]) : n.split("·").map(x => vocalColor(x.trim()))).slice(0, 3);
const PART_GRAY = "#9e9e9e";  // ready-made gray for lines like an unknown speaker's words (user request 2026-11-21)
/* 파트분리 · 가사편집 buttons: only while editing (user request 2026-11-22), admin only */
function partsBtn() {
  const ok = editing && moreEdit();
  $("btnParts").hidden = $("btnLyrEdit").hidden = !ok;
  if (ok && !parting) initParting();  // also when the admin token is read after the edit began
  if (!ok && editing && editMode !== "sync") setEditMode("sync");
}
function rerenderKeepScroll() {
  const box = $("lyrics"), st = box.scrollTop;
  renderLyrics();
  box.scrollTop = st; userScrollAt = Date.now();
}
function initParting() {
  const orig = song.groups.map(g => ({part: g.part, vc: g.vc}));
  parting = {orig, brush: null, last: -1, plain: (orig.find(o => !o.part) || {}).vc || vocalsOf(cur).map(v => v[1]).slice(0, 3), own: {}};
  drawPartVocals();
  pickBrush(parting.names[0]);
}
function drawPartVocals() {
  const names = parting.names = [...new Set([...vocalsOf(cur).map(v => v[0]), ...song.groups.map(g => g.part && g.part.name).filter(Boolean), ...Object.keys(parting.own), "합창"])];
  const dot = n => { const o = parting.orig.find(o => o.part && o.part.name === n); return (o && o.part.color) || partColors(n)[0] || "#888888"; };
  $("partVocals").innerHTML = names.map(n => `<button class="pv" data-n="${esc(n)}"><i style="--pc:${esc(inkOf(dot(n)))}"></i>${esc(n)}</button>`).join("")
    + '<button class="pv" data-n="" title="이 묶음은 파트 표시 없음 (곡의 보컬 색)">파트 없음</button>'
    + '<button id="btnPartNew" title="이름과 색(최대 3개)을 정해 새 파트 만들기">+ 파트 추가</button>';
  if (parting.brush != null) pickBrush(parting.brush);
}
function pickBrush(n) {
  parting.brush = n;
  $("partVocals").querySelectorAll(".pv").forEach(b => b.classList.toggle("on", b.dataset.n === n));
}
function setPart(i, n) {
  const g = song.groups[i];
  if (!g || g.cols) return;
  if (!n) { delete g.part; g.vc = parting.plain; return; }
  const same = parting.orig.find(o => o.part && o.part.name === n);  // a part the page already has keeps its color
  if (same) { g.part = {...same.part}; g.vc = same.vc; return; }
  const c = partColors(n), own = parting.own[n];
  g.part = {name: n, color: c[0] || "", ...(own || n.includes("·") ? {colors: c} : {}), ...(own ? {own: 1} : {})}; g.vc = c;
}
$("partVocals").addEventListener("click", e => {
  if (!parting) return;
  if (e.target.closest("#btnPartNew")) return openPartNew();
  const b = e.target.closest(".pv"); if (b) pickBrush(b.dataset.n);
});
/* 파트 추가 (user request 2026-11-21): a part of its own name (e.g. '??' for an unknown speaker) and 1–3 colors — each slot
   from the song's vocal colors, a picked RGB color or the ready gray. own: 1 tells the export to keep these colors */
var partSlots = null, partSlot = 0;
function openPartNew() {
  partSlots = [PART_GRAY, "", ""]; partSlot = 0;
  $("partNewName").value = "";
  const pal = [...vocalsOf(cur).map(v => [v[0], v[1]]), ["회색", PART_GRAY]].filter((v, i, a) => a.findIndex(w => w[1] === v[1]) === i);
  $("partPal").innerHTML = pal.map(([n, c]) => `<button data-c="${esc(c)}" title="${esc(n)}" style="--pc:${esc(inkOf(c))}"></button>`).join("");
  drawPartSlots();
  $("partNew").hidden = false;
  $("partNewName").focus();
}
function drawPartSlots() {
  $("partSlots").innerHTML = partSlots.map((c, i) => `<button class="pslot${i === partSlot ? " on" : ""}" data-i="${i}" title="${i + 1}번째 색${i ? " (없어도 됨)" : ""}"${c ? ` style="--pc:${esc(inkOf(c))}"` : ""}></button>`).join("");
}
const setSlot = c => { partSlots[partSlot] = c; if (c && partSlot < 2 && !partSlots[partSlot + 1]) partSlot++; drawPartSlots(); };
$("partSlots").addEventListener("click", e => { const b = e.target.closest(".pslot"); if (b) { partSlot = +b.dataset.i; drawPartSlots(); } });
$("partPal").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setSlot(b.dataset.c); });
$("partPick").addEventListener("change", e => setSlot(e.target.value.toLowerCase()));
$("partSlotClear").onclick = () => { partSlots[partSlot] = ""; drawPartSlots(); };
$("partNewClose").onclick = () => { $("partNew").hidden = true; };
$("partNewAdd").onclick = () => {
  const n = $("partNewName").value.trim(), c = partSlots.filter(Boolean);
  if (!n) return uiAlert("파트 이름을 적어 주세요.");
  if (!c.length) return uiAlert("색을 하나 이상 골라 주세요.");
  if (parting.names.includes(n)) return uiAlert("이미 있는 파트 이름입니다.");
  parting.own[n] = c;
  $("partNew").hidden = true;
  drawPartVocals(); pickBrush(n);
};
// capture: in 파트분리 a click on a group sets its part, in 가사편집 it runs the row buttons (no seek in either)
$("lyrics").addEventListener("click", e => {
  if (!editing || editMode === "sync") return;
  e.stopImmediatePropagation();
  const g = e.target.closest(".g"); if (!g) return;
  const i = +g.dataset.i;
  if (editMode === "lyrics") return lyrClick(e, i);
  const [a, b] = e.shiftKey && parting.last >= 0 ? [Math.min(parting.last, i), Math.max(parting.last, i)] : [i, i];
  for (let k = a; k <= b; k++) setPart(k, parting.brush);
  parting.last = i;
  rerenderKeepScroll();
}, true);

/* ================= 가사편집 (관리자) ================= */
// user request 2026-11-22: rows added above / below, edited and deleted right in the lyrics (no popup) — like 싱크.
// A row = one lyrics group (원문 · 발음 · 번역 lines); groups sung at once (cols) can be moved around or deleted, not edited
var lyrEdit = -1, lyrNew = false, lyrLines = null;  // the row open for editing · it was just added · the lines its inputs stand for
const LYR_ROLE = {o: "원문", r: "발음", t: "번역", x: "다른 언어"};
function lyrTools(g) {
  return `<div class="ltools"><button data-l="up" title="이 행 위에 새 행">위에 추가</button><button data-l="down" title="이 행 아래에 새 행">아래에 추가</button>`
    + `<button data-l="edit"${g.cols ? ' disabled title="여러 보컬이 동시에 부르는 행은 고칠 수 없습니다"' : ""}>편집</button><button data-l="del">삭제</button></div>`;
}
function lyrEditor(g) {
  const ord = {o: 0, r: 1, t: 2};
  lyrLines = g.lines.slice();
  for (const r of ["o", "r", "t"]) if (!lyrLines.some(l => l.role === r)) lyrLines.push({role: r, text: ""});
  lyrLines.sort((a, b) => (ord[a.role] ?? 3) - (ord[b.role] ?? 3));
  return `<div class="ledit">${lyrLines.map((l, k) => `<label><span>${LYR_ROLE[l.role] || esc(l.role)}${l.lang ? ` (${esc(l.lang)})` : ""}</span><input type="text" data-k="${k}" value="${esc(l.text)}"></label>`).join("")}
    <div class="lebtn"><button class="primary" data-l="ok">확인</button><button data-l="back">되돌리기</button></div></div>`;
}
function lyrRemove(i) {
  song.groups.splice(i, 1); editTimes.splice(i, 1); editOk.splice(i, 1);
  if (cursor > i || cursor >= song.groups.length) cursor = Math.max(0, cursor - 1);
}
/* the open row's inputs → its lines. → false (kept open: nothing written), "gone" (a new row left empty is dropped), true */
function lyrApply() {
  const i = lyrEdit, g = song.groups[i], box = $("lyrics").querySelector(`.g[data-i="${i}"] .ledit`);
  lyrEdit = -1;
  if (!g || !box) return true;
  const lines = [];
  box.querySelectorAll("input[data-k]").forEach(inp => {
    const l = lyrLines[+inp.dataset.k], text = inp.value.trim();
    if (!text) return;
    const n = {...l, text};
    if (text !== l.text) delete n.auto;  // a hand-written line is no '자동' line
    lines.push(n);
  });
  if (!lines.length) {
    if (lyrNew) { lyrNew = false; lyrRemove(i); return "gone"; }
    lyrEdit = i; uiAlert("빈 행입니다 — 글자를 적거나 삭제를 눌러 주세요."); return false;
  }
  if (!lines.some(l => l.role === "o")) lines[0] = {...lines[0], role: "o"};  // no 원문: the first line takes its place (like the page parser)
  g.lines = lines; g.orig = lines.filter(l => l.role === "o").map(l => l.text).join(" ");
  lyrNew = false;
  return true;
}
function lyrBack() {
  const i = lyrEdit;
  lyrEdit = -1;
  if (lyrNew) { lyrNew = false; lyrRemove(i); }
  rerenderKeepScroll();
}
function lyrClick(e, i) {
  const b = e.target.closest("button[data-l]"); if (!b || b.disabled) return;
  const a = b.dataset.l;
  if (a === "ok") { if (lyrApply()) rerenderKeepScroll(); return; }
  if (a === "back") return lyrBack();
  if (lyrEdit >= 0) {  // another row is open: take it as it is first
    const was = lyrEdit, r = lyrApply();
    if (!r) return;
    if (r === "gone") { if (was === i) return rerenderKeepScroll(); if (was < i) i--; }
  }
  if (a === "up" || a === "down") {
    const at = a === "up" ? i : i + 1;
    song.groups.splice(at, 0, {lines: [], orig: "", vc: parting ? parting.plain : []});
    editTimes.splice(at, 0, null); editOk.splice(at, 0, false);
    if (cursor >= at) cursor++;
    lyrEdit = at; lyrNew = true;
  } else if (a === "edit") { lyrEdit = i; lyrNew = false; }
  else if (a === "del") {
    if (song.groups.length < 2) return uiAlert("마지막 행은 지울 수 없습니다.");
    lyrRemove(i);
  }
  rerenderKeepScroll();
  const inp = lyrEdit >= 0 && $("lyrics").querySelector(".ledit input");
  if (inp) inp.focus({preventScroll: false});
}
$("lyrics").addEventListener("keydown", e => {
  if (!e.target.closest(".ledit") || e.isComposing) return;
  if (e.key === "Enter") { e.preventDefault(); if (lyrApply()) rerenderKeepScroll(); }
  else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); lyrBack(); }
});
/* sending state of a button that posts to the server (user request 2026-11-17: 신고 전송 · 싱크 저장) */
function sendingBtn(b, on) {
  if (on) { b.dataset.label = b.textContent; b.innerHTML = '<span class="sendspin" aria-hidden="true"></span>서버에 전송중...'; }
  else if (b.dataset.label != null) { b.textContent = b.dataset.label; delete b.dataset.label; }
  b.disabled = on; b.classList.toggle("sending", on);
}
