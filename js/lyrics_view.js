/* 지금 곡 — 재생 · 곡 정보 줄 · 가사 그리기 · 지금 줄 따라가기 (tick) · 표시 옵션 · 밀기 · 직접 맞추기.
   player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* ================= 재생 ================= */
/* 가사·싱크를 저장했으면 재생기 가사(오버레이 알림)도 다시 읽게 함 */
const syncShell = () => { if (SHELL.now && cur && keyOf(SHELL.now) === keyOf(cur)) SHELL.reloadLyrics(); };  // 저장한 싱크를 재생기 가사(오버레이)에도
/* 재생목록의 곡을 누르면 그 곡부터 (⏭ 는 재생목록 순서대로) · 검색 창에서 바로 튼 곡은 재생목록 지금 곡 다음에 들어감 */
async function play(it, autoplay = true, how = "pick") {  // how '': 재생 목록에서 그 곡 다음부터 (처음 열 때 지난 곡)
  if (!it) return;
  if (editing && !await uiConfirm("직접 맞추던 싱크를 저장하지 않고 다른 곡으로 넘어갈까요?")) return;
  stopEdit();
  SHELL.load(it, autoplay, how);  // 곡이 바뀌면 재생기가 알려 줌 → showSong
}
/* ▶ 처음부터: 재생목록(오프라인은 mp3 폴더의 곡)을 처음 곡부터 (무작위면 섞은 첫 곡) */
async function playView() {
  const list = view.filter(canPlay);
  if (!list.length) return ONLINE ? openSearch() : uiAlert("재생할 곡이 없습니다.");
  if (editing && !await uiConfirm("직접 맞추던 싱크를 저장하지 않고 다른 곡으로 넘어갈까요?")) return;
  stopEdit();
  if (!listFilter) SHELL.setQueue(list);  // filtered view: keep the whole playlist (⏭ follows the filter — SHELL.playFilter)
  SHELL.load(SHELL.shuffle ? list[Math.floor(Math.random() * list.length)] : list[0], true);
}
$("btnPlayView").onclick = playView;
/* 기억해 둔 재생목록을 되살림 (화면을 새로 열었을 때) — songs put in before it was read stay, after the saved ones */
async function restoreQueue() {
  if (!ONLINE && SHELL.queue.length) { PL.restored = true; return; }  // the mp3 folder's list is up — the playlist comes back online
  const q = await PL.restore(), have = new Set(q.map(keyOf)), added = SHELL.queue.filter(it => !have.has(keyOf(it)));
  SHELL.setQueue([...q, ...added]);
  SHELL.plan(SHELL.now);
  PL.restored = true;
  if (added.length) PL.save();
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
  await loadSong();
}
/* 투고일 (곡 정보의 값) · 니코니코 원곡 재생수 (그때그때 — 서버는 니코니코 정보 API, 서버 없이는 중계 페이지의 니코니코 플레이어. 유튜브 원곡은 안 보임) */
function showViews(it) {
  const date = it.date ? `투고 ${it.date}` : "";
  $("nowDate").textContent = date; $("nowDate").title = "";
  if (it.site !== "stream" || !/nicovideo\.jp|nico\.ms/.test(it.video || "")) return;
  api(`/api/stream/views?name=${encodeURIComponent(it.name)}`).then(r => {
    if (!cur || keyOf(cur) !== keyOf(it) || r.views == null) return;
    $("nowDate").textContent = [date, `재생수 ${r.views.toLocaleString()}회`].filter(Boolean).join(" · ");
    $("nowDate").title = "니코니코 원곡 재생수 (지금 받은 값)";
  }).catch(() => {});
}
/* 곡 태그: 보컬(보컬 색) → 노래방(TJ·JOY만; 내려간 기기는 어느 기기든 취소선 칩 — user request 2026-11-15) → 내부 분류(한국·일본 목록) → 나무위키 분류(평범한 칩) · 아래에 노래방 목록 각주(작게) */
const KARAOKE_TAG = {TJ: "TJ", JOYSOUND: "JOY"};
/* 특정 기기에서만 선곡 가능 (나무위키 ⓗ · ⓢ, user request 2026-11-15): the symbol after the brand + its meaning on hover */
const karaOnlyMark = (it, b) => it.only && it.only[b] ? `<small>${esc(it.only[b].charAt(0))}</small>` : "";
const karaOnlyTip = (it, b, base) => it.only && it.only[b] ? `${base} — 특정 기기에서만 선곡 가능: ${it.only[b]}` : base;
/* 보컬이 너무 많은 곡 (user request 2026-11-16): 앞 VOCAL_SHOW 명만 칩 · 나머지는 '+N' 칩 (곡 상태 태그 MANY_VOCALS 의 색) →
   누르면 전체 보컬을 스크롤되는 작은 팝업으로 (펼치면 세로 화면에서 영상·가사가 밀려나서). 제목 옆 보컬 줄도 같음 */
const vocalChip = ([n, c]) => `<span class="b vocal" style="--vc:${esc(c)}" title="보컬">${esc(n)}</span>`;
const vocalMoreChip = (n, all) => { const c = tagColor("flag", MANY_VOCALS);
  return `<button type="button" class="b vmore${c ? " tc" : ""}"${c ? ` style="--tc:${esc(c)}"` : ""} data-vmore title="보컬 ${all}명 — 눌러서 모두 보기">+${n}</button>`; };
const vocalsOf = it => it.vocals && it.vocals.length ? it.vocals : String(it.singer || "").split(",").map(x => x.trim()).filter(Boolean).map(n => [n, vocalColor(n)]);
function showArtist(it) {
  if (!it.vocalMore) { $("nowArtist").textContent = shortName(it.artist || it.name); return; }
  $("nowArtist").innerHTML = `${esc(shortName(it.artistBase))} ${vocalMoreChip(it.vocalMore, it.vocalMore + VOCAL_SHOW)}`;
}
function vocalPopClose() { document.querySelectorAll(".vpop").forEach(p => p.remove()); }
function vocalPop(btn) {
  const open = document.querySelector(".vpop");
  vocalPopClose();
  if (!cur || (open && open._from === btn)) return;  // the same chip again = close
  const vs = vocalsOf(cur), p = document.createElement("div");
  p.className = "vpop"; p._from = btn;
  p.innerHTML = `<div class="h">보컬 ${vs.length}명</div>${vs.map(vocalChip).join("")}`;
  document.body.appendChild(p);
  // 화면 축소(--ui-zoom): same correction as ctxMenu · below the chip, above it when there is no room
  const f = uiZoom();
  const r = btn.getBoundingClientRect(), w = p.offsetWidth * f, h = p.offsetHeight * f;
  const x = Math.max(4, Math.min(r.left, innerWidth - w - 4)), y = r.bottom + 4 + h <= innerHeight ? r.bottom + 4 : Math.max(4, r.top - 4 - h);
  p.style.left = x / f + "px"; p.style.top = y / f + "px";
}
document.addEventListener("click", e => { const b = e.target.closest("[data-vmore]"); if (b) { e.stopPropagation(); vocalPop(b); } });
addEventListener("mousedown", e => { if (!e.target.closest(".vpop, [data-vmore]")) vocalPopClose(); }, true);
addEventListener("keydown", e => { if (e.key === "Escape") vocalPopClose(); });
addEventListener("scroll", e => { if (!(e.target.closest && e.target.closest(".vpop"))) vocalPopClose(); }, true);
addEventListener("resize", vocalPopClose);
function renderMeta(it) {
  const tags = it.tags || [], notes = it.notes || [], box = $("songMeta");
  const kara = tags.filter(t => KARAOKE_TAG[t]).map(t => [KARAOKE_TAG[t], t]);
  // 우리 DB 태그는 많이 붙은 순 앞 8개만 (분류는 마우스를 올리면). 음성 합성 엔진은 맨 앞 보컬(보컬 색)로 보이므로 뺌
  const lists = tags.filter(t => t === "한국" || t === "일본");
  const inner = [...lists, ...tags.filter(t => !KARA_RE.test(t) && !lists.includes(t) && tagGroupOf(t) !== "음성 합성 엔진").slice(0, 8)];
  const tagChip = t => lists.includes(t) ? tagChipHtml("kara", t, t, `inner${t === "한국" ? " ko" : " ja"}`, "노래방 목록 (한국·일본)")
    : tagChipHtml("tag:" + tagGroupOf(t), t, t, "", tagGroupOf(t) || "태그");
  // user request 2026-11-15: only colored chips are shown; the plain ones fold behind a "+N" chip (open state remembered)
  const isPlain = t => !lists.includes(t) && !tagColor("tag:" + tagGroupOf(t), t);
  const vocals = it.vocals || [];
  const chips = [
    ...vocals.slice(0, VOCAL_SHOW).map(vocalChip), ...(vocals.length > VOCAL_SHOW ? [vocalMoreChip(vocals.length - VOCAL_SHOW, vocals.length)] : []),
    ...kara.map(([t, b]) => `<span class="b kara" style="--bc:${tagColor("kara", b) || BRAND_COLOR[b]}" title="${esc(karaOnlyTip(it, b, "노래방 수록"))}">${esc(t)}${karaOnlyMark(it, b)}</span>`),
    ...Object.keys(it.gone || {}).map(b => `<span class="b kara gone" style="--bc:${tagColor("kara", b) || BRAND_COLOR[b] || "#888"}" title="노래방에서 내려간 곡입니다 (${esc(b)} ${esc(it.gone[b])})">${esc(KARAOKE_TAG[b] || b)}</span>`),
    ...inner.filter(t => !isPlain(t)).map(tagChip)];
  const plain = [...inner.filter(isPlain).map(tagChip), ...(it.categories || []).map(c => `<span class="b" title="나무위키 분류">${esc(c)}</span>`)];
  const open = !!store.get("tagsOpen", false);
  const more = plain.length ? `<button class="b more" id="tagsMore" title="${open ? "나머지 태그 접기" : "나머지 태그 보기"}">${open ? "접기" : `+${plain.length}`}</button>` : "";
  const sync = $("syncChip");  // 싱크 표시 stays the first chip (user request 2026-11-15) — kept across re-renders, filled by renderSyncChip
  box.hidden = false;
  box.innerHTML = `<div class="cats">${chips.join("")}${open ? plain.join("") : ""}${more}</div>`
    + (notes.length ? `<div class="fn" title="노래방 수록 목록의 각주">${notes.map(n => `<div>※ ${esc(n)}</div>`).join("")}</div>` : "");
  box.querySelector(".cats").prepend(sync);
}
async function loadSong() {
  const it = cur; if (!it) return;
  let s;
  try { s = await api(`/api/lyrics?site=${encodeURIComponent(it.site)}&name=${encodeURIComponent(it.name)}`); }
  catch (e) { if (cur !== it) return; song = null; $("lyrics").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (cur !== it) return;  // 가사를 받는 사이 다른 곡으로 넘어감 (온라인 곡은 위키를 읽느라 늦게 옴) → 늦게 온 앞 곡 가사로 덮지 않음
  song = s;
  const sj = song.sync;
  times = sj && (song.sync_state === "ok" || song.sync_state === "resync") ? sj.times : null;  // 재싱크 필요여도 지난 싱크로 우선 표시
  offset = sj ? +sj.offset || 0 : 0;
  renderLyrics(); renderSyncChip();
}
function renderSyncChip() {
  const c = $("syncChip"), sj = song && song.sync;
  let txt = "싱크 없음", cls = "b sync";
  if (!song || !song.groups.length) txt = "가사 없음";
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
  if (times && song.sync_pending) {  // edited here, waiting for the manage screen to confirm (반영) — played meanwhile
    txt += " · 확인 대기";
    c.title = "고친 싱크가 음원 관리의 확인을 기다리는 중입니다. 반영되면 본 싱크가 되고, 버려지면 전 싱크로 돌아갑니다.\n" + c.title;
  }
  c.textContent = txt; c.className = cls;
  showOff();
  const has = !!(song && song.groups.length), fail = song && song.sync_fail;
  $("failChip").hidden = !fail;
  if (fail) { $("failChip").textContent = `자동 싱크 실패: ${fail.reason}`; $("failChip").title = `${fail.at} · 모델 ${fail.model || "?"}`; }
  $("btnEdit").disabled = !has;
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
  return `<div class="lsrc"><span><b>원문</b> ${row("o")}</span><span><b>발음</b> ${row("r")}</span><span><b>번역</b> ${row("t")}</span></div>`;
}
function renderLyrics() {
  const box = $("lyrics");
  curIdx = -1;
  if (!song || !song.groups.length) {
    box.className = "nosync";
    box.innerHTML = `<div class="empty">가사 없음${cur && cur.site === "local" ? '<br><span class="hint">mp3 와 같은 이름의 가사·싱크 json 이 없습니다 (음원 관리 › mp3 다운로드로 받은 곡은 같이 받음)</span>' : ""}</div>`;
    return;
  }
  const matched = (song.sync && song.sync.matched) || [];
  const notes = (song.notes || []).length ? `<div class="lnotes">${song.notes.map(esc).join("<br>")}</div>` : "";
  const partTag = p => p ? `<div class="part" style="--pc:${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "transparent"}">${
    (p.colors || [null]).map(c => c && /^#[0-9a-f]{6}$/i.test(c) ? `<i style="--pc:${c}"></i>` : "<i></i>").join("")}${esc(p.name)}</div>` : "";
  // 동시에 부르는 묶음(g.cols): 보컬마다 칸을 나란히 (칸 위에 그 보컬 이름)
  box.innerHTML = lyricsSources(song) + notes + song.groups.map((g, i) => `<div class="g${times && song.sync.method !== "manual" && matched[i] === false ? " guess" : ""}" data-i="${i}">
      ${g.cols ? lyrCols(g, p => partTag(p) || '<div class="part">&nbsp;</div>') : partTag(g.part) + g.lines.map(l => lyrLine(l.role + (l.auto ? " auto" : "") + (l.lang ? ` xl-${l.lang}` : ""), l.text, g.vc)).join("")}
      <div class="prog"><i></i></div>
      <div class="stamp"><button data-d="-1" title="1초 앞으로">&lt;&lt;</button><button data-d="-0.2" title="0.2초 앞으로">&lt;</button><span class="tv"></span><button data-d="0.2" title="0.2초 뒤로">&gt;</button><button data-d="1" title="1초 뒤로">&gt;&gt;</button></div>
    </div>`).join("");
  box.className = (times ? "" : "nosync ") + (editing ? "editing " : "") + ($("showR").checked ? "" : "hide-r ") + ($("showT").checked ? "" : "hide-t ") + ($("showP").checked ? "" : "hide-p ");
  renderXLang();
  box.scrollTop = 0;
  if (editing) renderStamps();
  tick(true);
}

$("lyrics").addEventListener("click", e => {
  const g = e.target.closest(".g"); if (!g) return;
  const i = +g.dataset.i;
  if (editing) {
    const d = e.target.closest("button[data-d]");
    if (d) { if (editTimes[i] != null) { editTimes[i] = Math.max(0, +(editTimes[i] + +d.dataset.d).toFixed(2)); editOk[i] = true; audio.currentTime = Math.max(0, editTimes[i] - 0.5); } }
    else { cursor = i; if (editTimes[i] != null) audio.currentTime = Math.max(0, editTimes[i] - 1); }
    renderStamps(); return;
  }
  if (times) { audio.currentTime = Math.max(0, times[i] + offset); if (audio.paused) audio.play(); }
});
$("lyrics").addEventListener("wheel", () => userScrollAt = Date.now(), {passive: true});
$("lyrics").addEventListener("touchmove", () => userScrollAt = Date.now(), {passive: true});

/* 가사 먼저 보이기(초): 재생기 값 (브라우저 저장값) */
const lyricsLead = () => SHELL.lead;
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
  const off = editing ? 0 : offset - lyricsLead();  // 싱크를 직접 맞출 때는 싱크 그대로, 재생할 때만 '가사 먼저 보이기'만큼 앞당김
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
on(audio, "play", () => { $("btnPlay").textContent = "❚❚"; tick(false); });
on(audio, "pause", () => { $("btnPlay").textContent = "▶︎"; tick(false); });
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

/* ================= 직접 맞추기 ================= */
function startEdit() {
  if (!song || !song.groups.length) return;
  editing = true; SHELL.editing = true;
  // phone (user request 2026-11-15): fold the video while syncing, unfold it again when done (not remembered)
  editFoldedVid = document.body.classList.contains("m") && VID.on;
  if (editFoldedVid) { VID.on = false; showVideo(); }
  // phone (user request 2026-11-16): the lyrics tool bar folds too, and unfolds when done (the remembered fold stays as it was)
  editFoldedBar = document.body.classList.contains("m") && !document.body.classList.contains("barfold");
  if (editFoldedBar) applyBar(true);
  editTimes = song.groups.map((_, i) => times ? +(times[i] + offset).toFixed(2) : null);
  editShift = offset;  // the song's current push is baked into editTimes; show it as the start value
  // 묶음마다 믿을 만한 시간인지: 인식으로 맞았거나 손으로 찍음 → 안 고친 '추정' 묶음은 저장해도 추정으로 남음
  const m = (song.sync && song.sync.matched) || [];
  editOk = song.groups.map((_, i) => !!times && (song.sync.method === "manual" || m[i] !== false));
  cursor = 0;
  if (times) { const t = audio.currentTime; cursor = Math.max(0, editTimes.findIndex(x => x > t)); }
  $("editbar").classList.add("show"); $("btnEdit").classList.add("on");
  $("offMinus").disabled = $("offPlus").disabled = false; showOff();
  $("lyrics").classList.add("editing", "nosync");
  renderStamps();
}
function stopEdit() {
  editing = false; editTimes = null; editOk = null; SHELL.editing = false;
  if (editFoldedVid) { editFoldedVid = false; VID.on = true; showVideo(); }
  if (editFoldedBar) { editFoldedBar = false; applyBar(false); }
  $("editbar").classList.remove("show"); $("btnEdit").classList.remove("on");
  showOff(); $("offMinus").disabled = $("offPlus").disabled = !times;
  $("lyrics").classList.remove("editing");
  $("lyrics").classList.toggle("nosync", !times);
  $("lyrics").querySelectorAll(".g.cursor").forEach(el => el.classList.remove("cursor"));
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
  $(id).addEventListener("pointerdown", e => { e.preventDefault(); if (editing) fn(); });
$("btnEdit").onclick = () => editing ? stopEdit() : startEdit();
$("btnEditCancel").onclick = () => { stopEdit(); renderLyrics(); };
$("btnEditSave").onclick = async () => {
  // 찍지 않은 묶음은 앞뒤 시간 사이를 고르게 채움
  const T = editTimes.slice(), n = T.length;
  if (T.every(x => x == null)) { uiAlert("찍은 시간이 없습니다."); return; }
  let first = T.findIndex(x => x != null);
  for (let i = first - 1; i >= 0; i--) T[i] = Math.max(0, T[i + 1] - 3);
  for (let i = 1; i < n; i++) if (T[i] == null) {
    let j = i; while (j < n && T[j] == null) j++;
    const a = T[i - 1], b = j < n ? T[j] : a + 4 * (j - i + 1);
    for (let k = i; k < j; k++) T[k] = +(a + (b - a) * (k - i + 1) / (j - i + 1)).toFixed(2);
    i = j;
  }
  // user request 2026-11-17: spinner + "서버에 전송중..." on 저장, 취소 locked, the song doesn't move on until it's sent
  sendingBtn($("btnEditSave"), true); $("btnEditCancel").disabled = true;
  await SHELL.sending(async () => {
    try { song = await post("/api/sync/save", {site: song.site, name: song.name, times: T, matched: editOk, offset: 0}); }
    catch (e) { uiAlert(e.message); return; }
    finally { sendingBtn($("btnEditSave"), false); $("btnEditCancel").disabled = false; }
    stopEdit(); times = song.sync.times; offset = 0; syncShell();
    // the song's list mark is already updated (LOCAL.synced) — re-downloading the whole list (MBs on GitHub) left the load bar up
    renderLyrics(); renderSyncChip(); renderList();
  });
};
/* sending state of a button that posts to the server (user request 2026-11-17: 신고 전송 · 싱크 저장) */
function sendingBtn(b, on) {
  if (on) { b.dataset.label = b.textContent; b.innerHTML = '<span class="sendspin" aria-hidden="true"></span>서버에 전송중...'; }
  else if (b.dataset.label != null) { b.textContent = b.dataset.label; delete b.dataset.label; }
  b.disabled = on; b.classList.toggle("sending", on);
}
