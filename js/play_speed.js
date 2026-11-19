/* 배속 · 키 · 구간 반복 버튼 (user request 2026-11-19: only what works both on a PC with the extension and in the app) —
   right of the volume in the play bar.
   배속: A menu of speeds (browser key rate, kept for
   every song). YouTube · files · our mp3 take it themselves; Niconico · SoundCloud · Vimeo · Bilibili only with the
   음원 플레이어 확장 (play_engine.js extZip). Where it can't apply the button is greyed and the song plays at 1×:
   · no extension → a click opens the extension guide (the same three steps as Bilibili's volume guide)
   · phone / tablet → a notice (no extensions there) · 같이듣기 · OPEN CHANNEL → everyone at 1×
   키: −12 ~ +12 (speed unchanged), kept per song (browser key keys) — online songs through the extension / app (v3), our mp3
   in the page; a plain file link can't (fxBlock).
   구간 반복 (A-B): 1st press = A at now, 2nd = B and the song loops A→B, 3rd = off; a new song clears it. Done here by seeking
   (every source, no extension needed). */
const RATES = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const rateText = r => (Math.round(r * 100) / 100) + "×";
{
  const btn = document.createElement("button");
  btn.className = "ib ratebtn"; btn.id = "btnRate"; btn.type = "button";
  $("vol").closest(".volpop").after(btn);
  const menu = document.createElement("div");
  menu.className = "ratemenu"; menu.hidden = true;
  menu.innerHTML = RATES.map(r => `<button type="button" data-rate="${r}">${rateText(r)}</button>`).join("");
  document.body.appendChild(menu);

  const WHY = {lock: "같이듣기 중에는 모두 1배속으로 들어요.",
    touch: "이 기기에서는 니코니코 · SoundCloud · Vimeo · 비리비리 영상의 배속이 안 돼요 (확장 프로그램은 PC 브라우저에서만).",
    ext: "니코니코 · SoundCloud · Vimeo · 비리비리 영상은 음원 플레이어 확장 프로그램이 있어야 배속이 돼요. 누르면 넣는 법이 나와요."};
  let shown = "";
  function render() {
    const want = +store.get("rate", 1) || 1, block = audio.rateBlock();
    const key = want + "|" + block;
    if (key === shown) return;
    shown = key;
    btn.textContent = rateText(want);
    btn.classList.toggle("off", !!block);
    btn.classList.toggle("on", !block && want !== 1);
    btn.setAttribute("aria-disabled", !!block);
    btn.title = block ? WHY[block] + (want !== 1 ? " (지금 1배로 재생 중)" : "") : "재생 속도";
    menu.querySelectorAll("[data-rate]").forEach(b => b.classList.toggle("on", +b.dataset.rate === want));
  }
  const refresh = () => { audio.applyRate(); render(); };
  audio.addEventListener("ratechange", render);
  audio.addEventListener("sourcechange", refresh);
  audio.addEventListener("emptied", refresh);
  addEventListener("extchange", refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 1000);  // joining / leaving a 같이듣기 room
  render();

  const closeMenu = () => { menu.hidden = true; };
  btn.onclick = e => {
    e.stopPropagation();
    const block = audio.rateBlock();
    if (block === "ext") return openExtGuide("배속");
    if (block) return uiAlert(WHY[block]);
    if (!menu.hidden) return closeMenu();
    menu.hidden = false;
    const b = btn.getBoundingClientRect(), m = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(innerWidth - m.width - 8, b.left + b.width / 2 - m.width / 2)) + "px";
    menu.style.top = (b.top - m.height - 6 > 8 ? b.top - m.height - 6 : b.bottom + 6) + "px";
  };
  menu.onclick = e => {
    const b = e.target.closest("[data-rate]"); if (!b) return;
    audio.playbackRate = +b.dataset.rate;
    closeMenu();
  };
  document.addEventListener("click", e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  /* the extension guide as a window (Bilibili's sits on its video instead) */
  let dlg = null, guide = null;
  function openExtGuide(what) {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "extDlg"; dlg.className = "uidlg extdlg";
      dlg.innerHTML = '<div class="dlg-head hx"><span class="eg-what"></span> — 확장 프로그램 넣기<button class="ib dlgx" title="닫기 (Esc)" aria-label="닫기">✕</button></div><div class="dlg-body"><div class="vguide"></div></div>';
      document.body.appendChild(dlg);
      dlg.querySelector(".dlgx").onclick = () => dlg.close();
      guide = extGuide(dlg.querySelector(".vguide"), {
        intro: "니코니코 · 유튜브 · SoundCloud · Vimeo · 비리비리 영상은 그 사이트 플레이어가 배속 · 키 변경 · 소리 크기 맞추기를 막아 두었어요. 작은 확장 프로그램을 한 번 넣으면 다 돼요 (비리비리는 볼륨도, 유튜브는 광고 건너뛰기도).",
        touch: WHY.touch, later: () => dlg.close(), touchOk: () => dlg.close(),
        done: () => {
          extProbe().then(v => {
            if (!dlg.open) return;
            if (v >= EXT_VER) { dlg.close(); refresh(); keyRender(); return; }
            guide.note("아직 확장 프로그램이 확인되지 않아요. 개발자 모드와 폴더를 다시 확인해 주세요.");
          });
          return "확장 프로그램을 확인하는 중…";
        }});
    }
    dlg.querySelector(".eg-what").textContent = what;
    guide.reset();
    dlg.showModal();
  }

  /* ---- 키 ---- */
  const kbtn = document.createElement("button");
  kbtn.className = "ib ratebtn keybtn"; kbtn.id = "btnKey"; kbtn.type = "button";
  btn.after(kbtn);
  const kmenu = document.createElement("div");
  kmenu.className = "ratemenu keymenu"; kmenu.hidden = true;
  kmenu.innerHTML = '<div class="krow"><button type="button" data-k="-1" aria-label="키 내리기">−</button><b class="kval"></b><button type="button" data-k="1" aria-label="키 올리기">＋</button></div><button type="button" data-k="0">원래 키</button>';
  document.body.appendChild(kmenu);
  const KWHY = {file: "음원 파일 링크는 키 변경이 안 돼요 (그 사이트가 소리를 읽게 해 주지 않아요).",
    touch: "이 기기에서는 영상의 키 변경이 안 돼요 (확장 프로그램은 PC 브라우저에서만 · 폰은 앱에서 돼요).",
    ext: "영상의 키 변경은 음원 플레이어 확장 프로그램이 있어야 돼요. 누르면 넣는 법이 나와요."};
  const songKey = () => SHELL.now ? SHELL.now.site + "/" + SHELL.now.name : "";
  const keyText = k => k ? (k > 0 ? "+" : "−") + Math.abs(k) : "0";
  function keyRender() {
    const k = audio.semis, block = fxBlock(audio.kind);
    kbtn.textContent = "키 " + keyText(k);
    kbtn.classList.toggle("off", !!block);
    kbtn.classList.toggle("on", !block && !!k);
    kbtn.setAttribute("aria-disabled", !!block);
    kbtn.title = block ? KWHY[block] : "키 변경 (곡마다 기억 · 속도는 그대로)";
    kmenu.querySelector(".kval").textContent = keyText(k);
  }
  function setKey(k) {
    audio.semis = k;
    const m = store.get("keys", {}) || {}, sk = songKey();
    if (sk) { if (audio.semis) m[sk] = audio.semis; else delete m[sk]; store.set("keys", m); }
    keyRender();
  }
  let keySong = null;
  SHELL.subscribe(now => {  // a new song: its own key
    if (now === keySong) return;
    keySong = now;
    audio.semis = (store.get("keys", {}) || {})[songKey()] || 0;
    keyRender(); abClear();
  });
  audio.addEventListener("sourcechange", keyRender);
  addEventListener("extchange", keyRender);
  keyRender();
  kbtn.onclick = e => {
    e.stopPropagation();
    const block = fxBlock(audio.kind);
    if (block === "ext") return openExtGuide("키 변경");
    if (block) return uiAlert(KWHY[block]);
    if (!kmenu.hidden) { kmenu.hidden = true; return; }
    kmenu.hidden = false;
    const b = kbtn.getBoundingClientRect(), m = kmenu.getBoundingClientRect();
    kmenu.style.left = Math.max(8, Math.min(innerWidth - m.width - 8, b.left + b.width / 2 - m.width / 2)) + "px";
    kmenu.style.top = (b.top - m.height - 6 > 8 ? b.top - m.height - 6 : b.bottom + 6) + "px";
  };
  kmenu.onclick = e => {
    e.stopPropagation();
    const b = e.target.closest("[data-k]"); if (!b) return;
    setKey(+b.dataset.k ? audio.semis + +b.dataset.k : 0);
  };
  document.addEventListener("click", e => { if (!kmenu.hidden && !kmenu.contains(e.target)) kmenu.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") kmenu.hidden = true; });

  /* ---- 구간 반복 (A-B) ---- */
  const ab = {a: null, b: null};
  const abBtn = document.createElement("button");
  abBtn.className = "ib ratebtn abbtn"; abBtn.id = "btnAB"; abBtn.type = "button";
  kbtn.after(abBtn);
  function abRender() {
    abBtn.textContent = ab.a == null ? "A-B" : ab.b == null ? `A ${fmt(ab.a)}` : `${fmt(ab.a)}~${fmt(ab.b)}`;
    abBtn.classList.toggle("on", ab.a != null);
    abBtn.title = ab.a == null ? "구간 반복 — 누른 곳이 시작(A)" : ab.b == null ? "한 번 더 누르면 끝(B) — 그 사이를 반복" : "구간 반복 중 — 누르면 끔";
  }
  function abClear() { ab.a = ab.b = null; clearTimeout(abT); abRender(); }
  let abT = 0;
  function abWatch() {  // near B: look every 50 ms, else wait till then
    clearTimeout(abT);
    if (ab.b == null || audio.paused) return;
    const t = audio.currentTime;
    if (t >= ab.b - 0.03 || t < ab.a - 1) { audio.currentTime = ab.a; abT = setTimeout(abWatch, 300); return; }
    abT = setTimeout(abWatch, Math.max(50, Math.min(1000, (ab.b - t) * 1000 / (audio.playbackRate || 1) - 60)));
  }
  abBtn.onclick = e => {
    e.stopPropagation();
    if (!SHELL.now) return;
    const t = audio.currentTime || 0;
    if (ab.a == null) ab.a = t;
    else if (ab.b == null) { if (t - ab.a < 1) return uiAlert("끝(B)은 시작(A)보다 1초 넘게 뒤여야 해요."); ab.b = t; audio.currentTime = ab.a; }
    else return abClear();
    abRender(); abWatch();
  };
  ["play", "playing", "seeked"].forEach(ev => audio.addEventListener(ev, abWatch));
  audio.addEventListener("ended", () => { if (ab.b != null) { audio.currentTime = ab.a; audio.play(); } });  // B at the very end
  abRender();
}
