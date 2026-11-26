/* 원곡 영상 칸 (크기 · 댓글 버튼) · 썸네일 크게 보기·저장.
   player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* ================= 원곡 영상 칸: 재생 중인 온라인 곡의 중계 플레이어(니코니코·유튜브)가 곧 영상 =================
   재생기(play_engine.js)가 중계 플레이어를 이 칸 위에 겹쳐 보임 (placeVideo). 영상을 숨기면 칸만 접음 — 소리는 그대로 */
const VID = {on: store.get("video", false)};
/* 간단 표시 (이름 밑 '기본 | 간단' 스위치): 재생목록 썸네일 · 오른쪽 위 썸네일을 숨기고, 켜는 순간 영상도 접음
   (user request 2026-11-24: 잠그지 않음 — 간단 중에도 영상 버튼으로 다시 펼 수 있고, 그 뒤로는 고른 대로 둠)
   · 가사·오버레이도 보컬 색 없이 일반 글자색 (파트 표시는 그대로 — player_screen.css · play_engine.js sendNow) */
let SIMPLE = !!store.get("simple", false);
function applySimple() {
  document.body.classList.toggle("simple", SIMPLE);
  $("btnSimple").classList.toggle("on", SIMPLE); $("btnSimple").setAttribute("aria-pressed", SIMPLE);
  // 간단 (user request 2026-11-15): 노래방 · 노래방 모드 buttons off and icon only (CSS) — a mode left on is turned off · the filter folds
  for (const b of [$("btnKara"), $("btnKaraMode"), document.querySelector('#mNav [data-nav="kara"]')]) if (b) b.disabled = SIMPLE;
  if (SIMPLE && typeof KARA !== "undefined") { if (KARA.mode) KARA.setMode(false); if ($("karaDlg").open) $("karaDlg").close(); }
  if (SIMPLE) plfFold = true;  // 간단 on folds it; 간단 off leaves it as it is
  renderPlFilter();
}
$("btnSimple").onclick = () => { SIMPLE = !SIMPLE; store.set("simple", SIMPLE); if (SIMPLE) { VID.on = false; store.set("video", false); } applySimple(); showVideo(); renderRows(true); SHELL.notify(); };  // 썸네일이 빠져 줄 높이가 바뀜 → 다시 잼 · 오버레이 글자색도 바로
applySimple();
/* 화면 밝기 (제목 줄 오른쪽 끝 버튼): html[data-theme] 로 색 토큰을 바꿈 — 기억함 (첫 그림 전 적용은 player_screen.html <head>).
   4 steps (user request 2026-11-19): light · dim (between light and dark) · dark (the default, no attribute) · black; a click
   goes one step on (black → light). Icon: sun · thin crescent · crescent · full moon, swapped with a small turn. */
const THEMES = ["light", "dim", "dark", "black"], THEME_NAME = {light: "밝은 화면", dim: "조금 어두운 화면", dark: "어두운 화면", black: "검은 화면"};
function applyTheme(t) {
  if (!THEMES.includes(t)) t = "dark";
  if (t === "dark") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
  $("btnTheme").title = `지금: ${THEME_NAME[t]} — 누르면 ${THEME_NAME[next]}`;
}
$("btnTheme").onclick = () => {
  const cur = THEMES.indexOf(store.get("theme", "dark")), t = THEMES[((cur < 0 ? 2 : cur) + 1) % THEMES.length];  // default = dark (3rd step)
  store.set("theme", t); applyTheme(t);
  const b = $("btnTheme"); b.classList.remove("turn"); void b.offsetWidth; b.classList.add("turn");
};
applyTheme(store.get("theme", "dark"));
function showVideo() {
  const guide = audio.biliGuide;  // Bilibili volume guide: the video shows even when folded (play_engine.js)
  const on = (VID.on || guide) && !!cur, playing = !!cur && !!SHELL.now && keyOf(SHELL.now) === keyOf(cur);
  const live = on && playing && audio.bridged && !audio.error;
  $("btnVideo").classList.toggle("on", VID.on);
  $("videoBox").hidden = !on;
  $("nowCover").hidden = !cur || !hasCover(cur) || on || SIMPLE;  // 영상 모드에서는 썸네일을 영상 자리에 · 간단 표시는 숨김
  // 리듬게임 open: the video plays behind its window, 영상 on or not (user request 2026-11-26 — rhythm_game.js, #gameBack)
  // — only when the game's 배경 is 영상; by default a still, blurred picture is behind it and the video is folded (2026-11-27)
  const gon = typeof GAME !== "undefined" && GAME.on, game = gon && playing && audio.bridged && !audio.error;
  SHELL.placeVideo(gon ? (game && gameBgVideo() ? $("gameBack") : null) : live ? $("videoFrame") : null);
  $("btnCmt").hidden = !(live && audio.kind === "nico");  // 니코니코 영상이 보일 때만
  $("btnCmt").classList.toggle("on", audio.comments);
  if (!on || live) { $("videoFrame").innerHTML = ""; return; }
  // 영상이 없을 때: 썸네일을 꽉 차게 + 맨 위 가운데에 까닭
  const msg = cur.site === "local" ? "오프라인 곡(mp3 폴더)은 영상이 없습니다."
    : !playing ? "재생 중인 곡의 영상만 보입니다 — 재생목록이나 곡 검색에서 곡을 누르면 재생합니다."
    : audio.error ? audio.error.reason || "원곡 영상을 재생할 수 없습니다." : "원곡 영상을 여는 중…";
  const bg = hasCover(cur) ? `style="background-image:url('${esc(coverUrl(cur))}')"` : "";
  $("videoFrame").innerHTML = `<div class="vfallback" ${bg}><div class="vmsg">${esc(msg)}
    ${cur.video ? `<a href="${esc(cur.video)}" target="_blank" rel="noopener">원곡 페이지 ↗</a>` : ""}</div></div>`;
}
/* Video tab (user request): a short click folds/unfolds the video, a drag (video shown) sets its height —
   the video keeps 16:9, so it shrinks/grows with it. Kept as a share of the window height (--vid-f, 10–85%)
   so it still fits after a window resize. The old grip bar under the video was removed. */
const VID_F = f => { f = Math.min(.85, Math.max(.1, f)); document.documentElement.style.setProperty("--vid-f", f); return f; };
{
  const saved = store.get("videoH", null);
  if (saved) VID_F(saved);
  const tab = $("btnVideo");
  let drag = null;
  tab.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    drag = {y: e.clientY, h: $("videoFrame").getBoundingClientRect().height, moved: false};
    tab.setPointerCapture(e.pointerId); e.preventDefault();
  });
  tab.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientY - drag.y) < 4) return;  // under 4px = a click
    if ($("videoBox").hidden) return;  // nothing to resize while folded
    drag.moved = true; tab.classList.add("drag");
    drag.f = VID_F((drag.h + e.clientY - drag.y) / innerHeight);
    dispatchEvent(new Event("resize"));  // the bridge player over the video follows at once (play_engine placeNow)
  });
  const end = (e, cancel) => {
    if (!drag) return;
    const d = drag; drag = null; tab.classList.remove("drag");
    if (d.moved) { if (d.f) store.set("videoH", d.f); return; }
    if (!cancel) { VID.on = !VID.on; store.set("video", VID.on); showVideo(); }  // short click: fold / unfold
  };
  tab.addEventListener("pointerup", e => end(e, false));
  tab.addEventListener("pointercancel", e => end(e, true));
  tab.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); VID.on = !VID.on; store.set("video", VID.on); showVideo(); } });
}
$("btnCmt").onclick = () => { audio.comments = !audio.comments; showVideo(); };
/* SKIP (user request 2026-11-23, LOCAL only): the recommended playlists' front / end skip on or off — play_engine skipOf */
const renderSkip = () => $("btnSkip").classList.toggle("on", store.get("offSkip", true));
$("btnSkip").onclick = () => { store.set("offSkip", !store.get("offSkip", true)); renderSkip(); };
renderSkip();
/* Space = play / pause like YouTube (user request 2026-11-23) — not while typing or a window is open */
addEventListener("keydown", e => {
  if (e.key !== " " || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.target.closest && e.target.closest("input, textarea, select, button, [contenteditable], dialog")) return;
  if (document.querySelector("dialog[open]")) return;
  e.preventDefault(); $("btnPlay").click();
});
$("songMeta").addEventListener("click", e => { if (e.target.id === "tagsMore" && cur) { store.set("tagsOpen", !store.get("tagsOpen", false)); renderMeta(cur); } });
for (const ev of ["sourcechange", "emptied", "error", "loadedmetadata", "guidechange"]) on(audio, ev, showVideo);  // 중계 플레이어가 바뀜·뜸·못 틂
cleanups.push(() => SHELL.placeVideo(null));  // 화면을 떠나면 영상 칸이 없어짐 → 접음 (소리는 그대로)

/* ================= 썸네일: 누르면 크게, 오른쪽 클릭하면 저장 ================= */
$("nowCover").onclick = () => { if (!cur || !hasCover(cur)) return; $("coverBig").src = coverUrl(cur); $("coverDlg").showModal(); };
$("coverDlg").onclick = () => $("coverDlg").close();
function saveCover(e) {
  e.preventDefault();
  if (!cur || !hasCover(cur)) return;
  const png = false;  // 썸네일은 jpg 로 저장해 둠
  const a = Object.assign(document.createElement("a"), {href: coverUrl(cur), download: `${(cur.title || "썸네일").replace(/[\\/:*?"<>|]/g, "_")}.${png ? "png" : "jpg"}`});
  document.body.appendChild(a); a.click(); a.remove();
}
$("nowCover").addEventListener("contextmenu", saveCover);
$("coverBig").addEventListener("contextmenu", saveCover);
