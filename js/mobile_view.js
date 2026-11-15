/* 폰 화면 (user request 2026-11-15): 좁은 화면(폰 · 폰 앱)에서는
   · 화면 높이에 딱 맞게 고정 (페이지 전체가 스크롤되지 않음 — 목록 · 가사만 그 안에서 스크롤)
   · 재생목록(메인)과 재생 화면을 나눔: 목록 아래에 재생 중인 곡이 얇은 바(miniBar)로 보이고, 바를 누르면 재생 화면이 올라옴
   · 재생 화면은 위의 ⌄ 또는 폰의 뒤로 가기로 닫힘
   The player screen is the same .main as on a wide screen, only slid in over the list (CSS body.m / body.mplay),
   so the video relay keeps playing while it is closed. Width = the existing narrow layout (688px, player_screen.css). */
(() => {
  const mq = matchMedia("(max-width:688px)"), body = document.body;
  const isOpen = () => body.classList.contains("mplay");
  function open() {
    closePages();  // a page (검색 · 노래방 · 같이듣기 · 설정) sits above the player screen — it covered it (user report 2026-11-15)
    if (isOpen()) return;
    body.classList.add("mplay");
    history.pushState({mplay: 1}, "");  // the phone's back button closes it
  }
  function close() {
    if (!isOpen()) return;
    body.classList.remove("mplay");
    if (history.state && history.state.mplay) history.back();
  }
  addEventListener("popstate", () => body.classList.remove("mplay"));
  // phone app's back button (music_app MainActivity): true = handled here, false = the app hides itself
  window.appBack = () => { if (!isOpen()) return false; close(); return true; };
  // touch phone (user request 2026-11-15): volume only by the device's keys — the slider is hidden, so the player stays at full volume
  const touch = matchMedia("(pointer:coarse)").matches;
  /* user request 2026-11-15: the playlist head looks the same at every width — 온/오프라인 · theme stay in the title row,
     간단 + 노래방 모드 stay under the song count (no moving them into 설정 or the count row on a phone) */
  /* 설정 › 화면 크기 (user request 2026-11-16): a slider over the page zoom on the phone — 100% = the size it had (the
     smallest, --ui-zoom .8), up to 160%. Phone width only; a wide screen keeps the stylesheet's .8 */
  const ZOOM_BASE = 0.8, zoomPct = () => Math.min(160, Math.max(100, +store.get("mZoom", 100) || 100));
  const applyZoom = () => {
    const p = zoomPct();
    if (mq.matches && p !== 100) document.documentElement.style.setProperty("--ui-zoom", ZOOM_BASE * p / 100);
    else document.documentElement.style.removeProperty("--ui-zoom");
    $("mZoom").value = p; $("mZoomVal").textContent = p + "%";
  };
  $("mZoom").addEventListener("input", e => { store.set("mZoom", +e.target.value); applyZoom(); });
  const apply = () => {
    body.classList.toggle("m", mq.matches); if (!mq.matches) close();
    if (mq.matches && touch) { audio.muted = false; audio.volume = 1; }
    applyZoom();
  };
  mq.addEventListener("change", apply);
  apply();

  /* mini bar: mirrors the player's own title · artist · cover (whatever the player shows there) */
  const bar = $("miniBar");
  function render() {
    const has = !!SHELL.now;
    bar.classList.toggle("empty", !has);
    $("miniTitle").textContent = has ? $("nowTitle").textContent : "";
    $("miniArtist").textContent = has ? $("nowArtist").textContent : "";
    // the song's own thumbnail (user request 2026-11-15: always on the bar's left — the player hides its cover while the video shows)
    const url = has && hasCover(SHELL.now) ? coverUrl(SHELL.now) : "";
    $("miniCover").hidden = !url;
    if (url && $("miniCover").getAttribute("src") !== url) $("miniCover").src = url;
    $("miniPlay").textContent = audio.paused ? "▶︎" : "❚❚";  // not ⏸︎ — an orange emoji on Samsung (player_screen.js)
    body.classList.toggle("mbar", has);  // the bar takes its room above the bottom menu only when a song is there
  }
  new MutationObserver(render).observe(document.querySelector(".now"), {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["src", "hidden"]});
  ["play", "pause", "emptied", "sourcechange"].forEach(ev => audio.addEventListener(ev, render));
  setInterval(() => {
    if (APP.screenOff) return;  // phone screen off: nothing to draw
    const d = audio.duration;
    $("miniProg").style.width = d > 0 && isFinite(d) ? `${Math.min(100, audio.currentTime / d * 100)}%` : "0";
  }, 500);
  render();
  // room card = a bar right above the mini bar (user request 2026-11-15): its room is kept free under the list (CSS --mroom)
  const card = $("ltCard");
  const roomBar = () => {
    body.classList.toggle("mroom", !card.hidden);
    if (!card.hidden && card.offsetHeight) body.style.setProperty("--mroom", card.offsetHeight + "px");
  };
  new MutationObserver(roomBar).observe(card, {attributes: true, attributeFilter: ["hidden"]});
  new ResizeObserver(roomBar).observe(card);
  roomBar();

  bar.addEventListener("click", e => { if (!e.target.closest("button")) open(); });
  bar.addEventListener("keydown", e => { if (e.key === "Enter") open(); });
  $("miniPlay").onclick = () => $("btnPlay").click();
  $("miniNext").onclick = () => $("btnNext").click();
  $("mClose").onclick = close;
  ["play", "sourcechange", "emptied"].forEach(ev => audio.addEventListener(ev, render));  // new song → its thumbnail

  /* 아래 메뉴 (user request 2026-11-15): 재생목록 (closes the player screen) · 같이듣기 · 곡 검색 · 노래방 모드 · 설정 —
     each one presses the side panel's own button, so nothing works differently from the wide screen */
  const nav = $("mNav");
  /* 곡 검색 · 노래방 번호 추천 · 같이듣기 · 설정 open as pages on the phone (user request 2026-11-15): not modal, so the bottom
     menu stays usable under them (CSS: fixed, above the list, ending at the menu); a wide screen keeps the popups */
  const NAV_PAGE = {search: "searchDlg", kara: "karaDlg", listen: "listenDlg", set: "mSetDlg"};
  const PAGES = Object.values(NAV_PAGE);
  for (const id of PAGES) {
    const d = $(id), modal = d.showModal.bind(d);
    d.showModal = () => { if (!body.classList.contains("m")) return modal(); if (!d.open) d.show(); };
    new MutationObserver(() => renderNav()).observe(d, {attributes: true, attributeFilter: ["open"]});
  }
  const page = () => PAGES.find(id => $(id).open) || "";
  // the video relay sits over the video box (z above everything): with the player screen down or a page over it, fold it —
  // it peeked out over the bottom menu (user report 2026-11-15); the sound goes on
  SHELL.videoHidden = () => body.classList.contains("m") && (!isOpen() || !!page());
  const closePages = () => PAGES.forEach(id => { if ($(id).open) $(id).close(); });
  nav.addEventListener("click", e => {
    const b = e.target.closest("button[data-nav]"); if (!b) return;
    const k = b.dataset.nav;
    if (NAV_PAGE[k]) PAGES.filter(id => id !== NAV_PAGE[k]).forEach(id => $(id).open && $(id).close());  // one page at a time
    if (k === "list") { closePages(); return close(); }
    if (k === "listen") return $("btnListen").click();
    if (k === "search") return $("btnSearch").click();
    if (k === "kara") return $("btnKara").click();  // opens the draw page as it was (노래방 모드 is on the playlist)
    if (k === "set") $("mSetDlg").showModal();
  });
  const renderNav = () => {
    // the screen in front (user request: clearer than the green 같이듣기): list · 곡 검색 page · 노래방 page
    const pg = page();
    nav.querySelector('[data-nav="list"]').classList.toggle("cur", !pg && !isOpen());
    for (const [k, id] of Object.entries(NAV_PAGE)) nav.querySelector(`[data-nav="${k}"]`).classList.toggle("cur", pg === id);
    nav.querySelector('[data-nav="listen"]').classList.toggle("on", $("btnListen").classList.contains("on"));
    const rooms = typeof LTS !== "undefined" && LTS.rooms ? LTS.rooms.length : 0;
    nav.querySelector('[data-nav="listen"]').classList.toggle("live", rooms > 0);  // a room is open → green (user request)
    $("mLtBadge").hidden = !rooms; $("mLtBadge").textContent = rooms > 99 ? "99+" : rooms;  // open rooms, like the web's badge (user request 2026-11-15)
    nav.querySelector('[data-nav="listen"]').classList.toggle("blink", $("btnListen").classList.contains("reqwait"));  // a request waits (host)
  };
  new MutationObserver(renderNav).observe(body, {attributes: true, attributeFilter: ["class"]});
  for (const id of ["btnListen"]) new MutationObserver(renderNav).observe($(id), {attributes: true, attributeFilter: ["class"], childList: true, subtree: true, characterData: true});
  renderNav();

  /* 이어폰 options — default: 해제 시 중지 · 없으면 묻기 on, 연결 시 재생 off (user request 2026-11-15) */
  const EAR_DEF = {connectPlay: false, unplugPause: true, ask: true};
  const earOpt = k => !!store.get("ear." + k, EAR_DEF[k]);
  /* 설정: 신고 · 가사·오버레이 설정 · 이어폰 */
  const dlg = $("mSetDlg");
  dlg.addEventListener("click", e => {
    const ear = e.target.closest("button[data-ear]");
    if (ear) { store.set("ear." + ear.dataset.ear, !earOpt(ear.dataset.ear)); return renderEar(); }
    const b = e.target.closest("button[data-set]"); if (!b) return;
    if (b.dataset.set === "close") return dlg.close();
    if (b.dataset.set === "report") { dlg.close(); return $("btnReport").click(); }
    if (b.dataset.set === "overlay") { dlg.close(); openOverlaySettings(); }
  });
  function renderEar() {
    dlg.querySelectorAll("button[data-ear]").forEach(b => {
      const on = earOpt(b.dataset.ear);
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.disabled = !APP.on;
    });
    $("mSetEarNote").hidden = APP.on && APP.ear !== null;
  }
  dlg.addEventListener("toggle", renderEar);  // fresh each time it opens
  renderEar();

  /* 이어폰 (user request 2026-11-15 — phone app only, it tells plugged / unplugged; defaults above):
     · 연결 시 바로 재생 · 해제 시 재생 중지
     · 이어폰 없이 재생하려 하면 먼저 물어봄 ('1시간 동안 다시 묻지 않기'). One yes holds while it keeps playing
       (the next songs don't ask again) — a pause by hand or plugging / unplugging asks again next time */

  let earOk = false;
  addEventListener("appheadset", e => {
    earOk = false;
    if (e.detail.on && earOpt("connectPlay") && SHELL.now && audio.paused) SHELL.toggle();
    else if (!e.detail.on && earOpt("unplugPause") && !audio.paused) SHELL.toggle();
  });
  const needAsk = () => APP.on && APP.ear === false && earOpt("ask") && !earOk && Date.now() > store.get("ear.snooze", 0);
  function askEar(go) {
    const d = $("earAskDlg");
    if (d.open) return;
    $("earSnooze").checked = false;
    const done = yes => {
      d.close();
      if ($("earSnooze").checked) store.set("ear.snooze", Date.now() + 60 * 60 * 1000);
      if (yes) { earOk = true; go(); }
    };
    $("earYes").onclick = () => done(true);
    $("earNo").onclick = () => done(false);
    d.showModal();
  }
  const toggle = SHELL.toggle, load = SHELL.load;
  SHELL.toggle = function () {
    if (audio.paused && SHELL.now && needAsk()) return askEar(() => toggle.call(this));
    if (!audio.paused) earOk = false;  // paused by hand → ask again next time
    return toggle.call(this);
  };
  SHELL.load = function (it, autoplay = true, how = "") {
    if (autoplay && needAsk()) return askEar(() => load.call(this, it, autoplay, how));
    return load.call(this, it, autoplay, how);
  };
})();
