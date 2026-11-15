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
  const apply = () => { body.classList.toggle("m", mq.matches); if (!mq.matches) close(); };
  mq.addEventListener("change", apply);
  apply();

  /* mini bar: mirrors the player's own title · artist · cover (whatever the player shows there) */
  const bar = $("miniBar");
  function render() {
    const has = !!SHELL.now;
    bar.classList.toggle("empty", !has);
    $("miniTitle").textContent = has ? $("nowTitle").textContent : "";
    $("miniArtist").textContent = has ? $("nowArtist").textContent : "";
    const c = $("nowCover");
    $("miniCover").hidden = !has || c.hidden || !c.src;
    if (!$("miniCover").hidden && $("miniCover").src !== c.src) $("miniCover").src = c.src;
    $("miniPlay").textContent = audio.paused ? "▶︎" : "⏸︎";
  }
  new MutationObserver(render).observe(document.querySelector(".now"), {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["src", "hidden"]});
  ["play", "pause", "emptied", "sourcechange"].forEach(ev => audio.addEventListener(ev, render));
  setInterval(() => {
    const d = audio.duration;
    $("miniProg").style.width = d > 0 && isFinite(d) ? `${Math.min(100, audio.currentTime / d * 100)}%` : "0";
  }, 500);
  render();

  bar.addEventListener("click", e => { if (!e.target.closest("button")) open(); });
  bar.addEventListener("keydown", e => { if (e.key === "Enter") open(); });
  $("miniPlay").onclick = () => $("btnPlay").click();
  $("miniNext").onclick = () => $("btnNext").click();
  $("mClose").onclick = close;
})();
