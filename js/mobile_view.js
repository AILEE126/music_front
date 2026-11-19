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
    sliding();
    body.classList.add("mplay");
    history.pushState({mplay: 1}, "");  // the phone's back button closes it
  }
  function close() {
    if (!isOpen()) return;
    sliding();
    body.classList.remove("mplay");
    if (history.state && history.state.mplay) history.back();
  }
  addEventListener("popstate", () => { if (isOpen()) sliding(); body.classList.remove("mplay"); });
  /* while the player screen slides (or follows a finger) the video relay is folded (body.mmove, SHELL.videoHidden): it sits
     outside the screen and only follows every 250ms, so it lagged behind as a ghost (user report 2026-11-16) — it comes back
     at its place once the slide ends */
  const main = document.querySelector(".main");
  let slideT = 0;
  function sliding() {
    if (!body.classList.contains("m")) return;
    body.classList.add("mmove"); SHELL.refitVideo();
    clearTimeout(slideT); slideT = setTimeout(slid, 400);  // fallback when no transitionend comes (no change · hidden tab)
  }
  function slid() {
    clearTimeout(slideT);
    if (drag) return;  // a finger holds it again
    body.classList.remove("mmove"); SHELL.refitVideo();
  }
  main.addEventListener("transitionend", e => { if (e.target === main && e.propertyName === "transform") slid(); });

  /* 밀어서 열고 닫기 (user request 2026-11-16): drag the mini bar up → the player screen follows the finger; drag its top
     (⌄ 재생 중 · song info · buttons) down → back to the mini bar. Let go past a quarter or with a flick = done, else it
     springs back. Lyrics keep their own scrolling */
  let drag = null;
  const zoom = () => main.offsetHeight ? main.getBoundingClientRect().height / main.offsetHeight : 1;
  function dragDown(e, fromOpen) {
    if (!body.classList.contains("m") || !e.isPrimary || e.button > 0 || page()) return;
    if (e.target.closest("input,select,textarea")) return;
    drag = {id: e.pointerId, fromOpen, y0: e.clientY, x0: e.clientX, t0: e.timeStamp, on: false, z: zoom()};
  }
  function dragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = (e.clientY - drag.y0) / drag.z, dx = (e.clientX - drag.x0) / drag.z;
    if (!drag.on) {
      if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx) || (drag.fromOpen ? dy < 0 : dy > 0)) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) drag = null;  // sideways or the wrong way: not a slide
        return;
      }
      drag.on = true;
      drag.full = innerHeight / drag.z;  // closed = one screen down (CSS: translateY(100dvh))
      main.style.transition = "none";
      body.classList.add("mmove"); SHELL.refitVideo();
    }
    const off = Math.max(0, Math.min(drag.full, (drag.fromOpen ? 0 : drag.full) + dy));
    drag.off = off; drag.v = dy / Math.max(1, e.timeStamp - drag.t0);
    main.style.transform = `translateY(${off}px)`;
  }
  function dragUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.on) return;
    noClick = true; setTimeout(() => { noClick = false; }, 0);  // the release is not a tap on what is under the finger
    const moved = d.fromOpen ? d.off : d.full - d.off;
    const go = moved > d.full * 0.25 || Math.abs(d.v) > 0.5 && (d.fromOpen ? d.v > 0 : d.v < 0);
    main.style.transition = ""; main.style.transform = "";  // the CSS transition carries it on from where the finger left it
    if (go) d.fromOpen ? close() : open(); else sliding();
  }
  let noClick = false;
  addEventListener("click", e => { if (noClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  for (const [el, fromOpen] of [[$("miniBar"), false], [document.querySelector(".mhead"), true], [document.querySelector(".now"), true]])
    el.addEventListener("pointerdown", e => dragDown(e, fromOpen));
  addEventListener("pointermove", dragMove);  // on the window: the finger soon leaves the thin bar
  addEventListener("pointerup", dragUp);
  addEventListener("pointercancel", dragUp);
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
    $("mZoom").value = p; fillRange($("mZoom")); $("mZoomVal").textContent = p + "%";
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
    $("miniPlay").innerHTML = playIcon(audio.paused);  // SVG (shared_screen_helpers.js) — never ⏸︎, an orange emoji on Samsung
    body.classList.toggle("mbar", has);  // the bar takes its room above the bottom menu only when a song is there
  }
  // only the title · artist · cover (the whole .now box also changed with the play time every second)
  const mo = new MutationObserver(render), opt = {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["src", "hidden"]};
  ["nowTitle", "nowArtist", "nowCover"].forEach(id => mo.observe($(id), opt));
  ["play", "pause", "emptied", "sourcechange"].forEach(ev => audio.addEventListener(ev, render));
  let progShown = "";
  setInterval(() => {
    if (APP.screenOff || document.hidden || !body.classList.contains("mbar")) return;  // nothing on screen to draw
    const d = audio.duration, p = d > 0 && isFinite(d) ? Math.min(1, audio.currentTime / d).toFixed(3) : "0";
    if (p !== progShown) $("miniProg").style.transform = `scaleX(${progShown = p})`;
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
    // a page opening folds the player screen back to the mini bar (user request 2026-11-16: it stayed open under the page)
    new MutationObserver(() => { if (d.open) close(); renderNav(); }).observe(d, {attributes: true, attributeFilter: ["open"]});
  }
  const page = () => PAGES.find(id => $(id).open) || "";
  // the video relay sits over the video box (z above everything): with the player screen down or a page over it, fold it —
  // it peeked out over the bottom menu (user report 2026-11-15); the sound goes on
  SHELL.videoHidden = () => body.classList.contains("m") && (!isOpen() || !!page() || body.classList.contains("mmove"));
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
  /* 좌우로 밀어 메뉴 옮기기 (user request 2026-11-16): a sideways swipe goes to the next / previous bottom-menu item, in the
     menu's order (the player screen counts as 재생목록). Touch events, not pointer ones: they still end when the browser
     scrolls the list meanwhile. Not on inputs, sideways-scrolling rows or over a popup */
  const NAV_ORDER = ["list", "listen", "search", "kara", "set"];
  const sideScroll = el => {
    for (; el && el !== body; el = el.parentElement) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
    }
    return false;
  };
  /* like a pager (user request 2026-11-16: the first fade-in looked poor): the screen follows the finger; let go past a
     quarter (or a flick) → it slides out while the next one slides in right beside it; else it springs back.
     transform only (Web Animations, ~0.2s) — light on a phone. 재생목록 = its scrolling parts, not the fixed room card · mini bar */
  const screenEls = k => k !== "list" ? [$(NAV_PAGE[k])]
    : isOpen() ? []  // the player screen is up: it folds down by itself when a page opens
    : [...document.querySelectorAll(".side-head>:not(dialog):not(.ltcard),#list")];
  const slow = matchMedia("(prefers-reduced-motion:reduce)");
  const anim = (el, from, to, ms) => (el.style.transform = to ? `translateX(${to}px)` : "", el).animate(  // ends where it stays: no snap back[{transform: `translateX(${from}px)`}, {transform: `translateX(${to}px)`}],
    {duration: slow.matches ? 0 : ms, easing: "cubic-bezier(.2,.7,.3,1)"}).finished.catch(() => {});
  const openPage = k => {  // like the menu button, but the old page stays until it has slid away
    if (k === "listen") return $("btnListen").click();
    if (k === "search") return $("btnSearch").click();
    if (k === "kara") return $("btnKara").click();
    if (k === "set") $("mSetDlg").showModal();
  };
  let swipe = null;
  addEventListener("touchstart", e => {
    swipe = null;
    if (!body.classList.contains("m") || e.touches.length !== 1) return;
    const t = e.target;
    if (t.closest("input,select,textarea,.mnav,#miniBar") || sideScroll(t)) return;
    if ([...document.querySelectorAll("dialog[open]")].some(d => !PAGES.includes(d.id))) return;  // a popup is up
    swipe = {x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp, on: false, dx: 0};
  }, {passive: true});
  addEventListener("touchmove", e => {
    const s = swipe; if (!s || drag) return;
    const z = zoom(), dx = (e.touches[0].clientX - s.x) / z, dy = (e.touches[0].clientY - s.y) / z;
    if (!s.on) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.5) { swipe = null; return; }  // a scroll
      s.on = true; s.W = innerWidth / z;
      s.cur = Object.keys(NAV_PAGE).find(k => NAV_PAGE[k] === page()) || "list";
      s.els = screenEls(s.cur);
    }
    const next = NAV_ORDER[NAV_ORDER.indexOf(s.cur) + (dx < 0 ? 1 : -1)];
    s.dx = next ? dx : dx * 0.25;  // nothing that way: it only gives a little
    s.v = dx / Math.max(1, e.timeStamp - s.t);
    for (const el of s.els) el.style.transform = `translateX(${s.dx}px)`;
  }, {passive: true});
  const swipeEnd = async () => {
    const s = swipe; swipe = null;
    if (!s || !s.on) return;
    const dir = s.dx < 0 ? 1 : -1, k = NAV_ORDER[NAV_ORDER.indexOf(s.cur) + dir];
    const go = k && (Math.abs(s.dx) > s.W * 0.25 || Math.abs(s.v) > 0.4 && Math.sign(s.v) === -dir);
    const clear = () => s.els.forEach(el => { el.style.transform = ""; });
    if (!go) { await Promise.all(s.els.map(el => anim(el, s.dx, 0, 160))); return clear(); }
    const out = Promise.all(s.els.map(el => anim(el, s.dx, -dir * s.W, 220)));
    if (k === "list") {  // the list lies under the page: the page slides away and shows it
      await out; clear(); nav.querySelector('[data-nav="list"]').click(); return;
    }
    const old = page();
    openPage(k);
    const nw = $(NAV_PAGE[k]);
    nw.classList.add("mswtop");  // over the page that is leaving
    await Promise.all([out, anim(nw, s.dx + dir * s.W, 0, 220)]);
    nw.classList.remove("mswtop"); clear();
    if (old && old !== NAV_PAGE[k] && $(old).open) $(old).close();
  };
  addEventListener("touchend", swipeEnd, {passive: true});
  addEventListener("touchcancel", swipeEnd, {passive: true});
  const renderNav = () => {
    // the screen in front (user request: clearer than the green 같이듣기): list · 곡 검색 page · 노래방 page
    const pg = page();
    nav.querySelector('[data-nav="list"]').classList.toggle("cur", !pg && !isOpen());
    for (const [k, id] of Object.entries(NAV_PAGE)) nav.querySelector(`[data-nav="${k}"]`).classList.toggle("cur", pg === id);
    nav.querySelector('[data-nav="listen"]').classList.toggle("on", $("btnListen").classList.contains("on"));
    nav.querySelector('[data-nav="listen"]').classList.toggle("live", $("btnListen").classList.contains("live"));  // a room is open → green (user request)
    // open rooms, the web's badge as it is (user request 2026-11-15) — incl. OPEN CHANNEL's 'ONAIR' (2026-11-17)
    const bd = $("ltBadge");
    $("mLtBadge").hidden = bd.hidden; $("mLtBadge").textContent = bd.textContent; $("mLtBadge").classList.toggle("open", bd.classList.contains("open"));
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
    if (b.dataset.set === "overlay") { dlg.close(); openPlayerSettings(); }
  });
  function renderEar() {
    dlg.querySelectorAll("button[data-ear]").forEach(b => {
      const on = earOpt(b.dataset.ear);
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.disabled = !APP.on;
    });
    $("mSetEarNote").hidden = APP.on && APP.ear !== null;
  }
  dlg.addEventListener("toggle", renderEar);  // fresh each time it opens
  // 새 항목 (shared_screen_helpers.js setNew): rows added since last time are marked while the page is open, then count as seen
  dlg.addEventListener("toggle", () => {
    if (!dlg.open) return;
    const fresh = setNew("m");
    dlg.querySelectorAll("[data-nk]").forEach(el => el.classList.toggle("isnew", fresh.includes(el.dataset.nk)));
    setSeen(fresh);
  });
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
