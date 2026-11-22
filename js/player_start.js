/* 시작 — 토큰·닉네임 창 · 인사말 · 첫 화면 먼저, 나머지는 뒤에서 (loadLibrary · loadRest) · 오버레이 ⚙ · 키보드 ·
   맨 끝에서 화면을 엶. 맨 마지막에 읽혀야 함. player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* ================= 서버 없이 연 화면: 우리 곡·가사·싱크를 어디서 읽을지 (깃허브 또는 Server\data 폴더) =================
   지난번 것(깃허브 토큰·폴더 권한)이 그대로 열리면 바로, 아니면 팝업 — 제대로 열릴 때까지 닫히지 않음 (Esc·바깥 눌러도) */
/* 여는 중 표시 (user request 2026-11-18: no loading box or bar — the screen is there at once): one short line in the playlist
   header until the song list opens, and in the open dialog while it is up */
function showLoad(label) {
  if (!VDB.idx) $("libInfo").textContent = label;
  const e = document.querySelector("dialog.offdlg[open] #offErr");
  if (e) e.textContent = label;
}
LOCAL.progress = showLoad;
/* '노인 <닉네임> ✎' right of the app name (user request 2026-11-17; wording 2026-11-18) — click = change the nickname */
function renderHello() {
  const h = $("hello"), who = String(store.get("reportWho", "") || "").trim();
  if (!h) return;
  h.hidden = !who || !LOCAL.ready;
  // ✎ mirrored (css): the nickname can be changed — by everyone, read-only tokens too (user request 2026-11-17)
  // one line (user request 2026-11-18): '노인 <닉네임> ✎' — a long nickname is cut, the theme button never wraps
  // 간단 mode (user request 2026-11-18): no nickname, just '이름변경 ✎' (css swaps .full / .simple)
  h.innerHTML = `<span class="l1"><span class="full">노인 <span class="nm">${esc(who)}</span></span><span class="simple">이름변경</span> <span class="pen">✎</span></span>`;
  h.classList.add("edit");
  h.title = "누르면 닉네임 · 대표색상 바꾸기";
  // 대표색상 (user request 2026-11-17): only the nickname in that color, not the whole greeting (간단 mode stays plain — css)
  const c = okColor(store.get("myColor", ""));
  h.classList.toggle("colored", !!c);
  if (c) h.style.setProperty("--me", c); else h.style.removeProperty("--me");
}
/* nickname + 대표색상 dialog (opened from the greeting) */
function editMe() {
  const d = document.createElement("dialog");
  d.className = "uidlg medlg";
  d.innerHTML = `<div class="dlg-body"><label class="ghform ghfield"><span class="ghlab">닉네임</span><input type="text" id="meWho" maxlength="8" autocomplete="off" spellcheck="false"></label>
      <div class="ghform ghfield"><span class="ghlab">대표색상</span><span id="meClr"></span></div></div>
    <div class="dlg-foot"><button data-v="0">취소</button><button class="primary" data-v="1">확인</button></div>`;
  const who = d.querySelector("#meWho"), cf = colorField(store.get("myColor", ""));
  d.querySelector("#meClr").replaceWith(cf.el);
  who.value = store.get("reportWho", "");
  who.addEventListener("keydown", e => { if (e.key === "Enter" && who.value.trim()) d.close("1"); });
  d.addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b && (b.dataset.v === "0" || who.value.trim())) d.close(b.dataset.v); });
  d.addEventListener("close", () => {
    d.remove();
    if (d.returnValue !== "1") return;
    const nm = who.value.trim().slice(0, 40), nameChanged = nm !== store.get("reportWho", "");
    store.set("reportWho", nm); store.set("myColor", cf.value);
    renderHello(); if (nameChanged) LOCAL.userSyncSoon();
    if (typeof ltColorChanged === "function") ltColorChanged();  // 같이듣기 chips follow at once
  });
  document.body.appendChild(d);
  d.showModal(); who.focus();
}
$("hello").onclick = editMe;
/* 저장된 필터 → the server (users/<nickname>.json) whenever they change */
{ const set = store.set; store.set = function (k, v) { const r = set.call(this, k, v); if (k === "f.saved" && LOCAL.ready) LOCAL.userSyncSoon(); return r; }; }
async function offlineOpened() {
  showLoad("여는 중…");
  renderHello();
  LOCAL.userSyncSoon();  // registers the nickname · uploads 저장된 필터 (only when changed)
  LOCAL.ovReopen();  // 이 브라우저에서 오버레이를 쓴 적이 있으면 바로 오버레이와 주고받음
  fontApply();  // 고른 글꼴 (font_setting.js) — in the background, the screen doesn't wait for font files
  setNewInit();  // 설정 새 항목 badge (shared_screen_helpers.js) — needs the registered fonts
  // the song shown first: tab reloaded while a song played (e.g. the browser reloaded it by itself) → go on playing it from
  // there; else the last song, paused. Only its block is read before the screen opens
  const res = SHELL.takeResume(), vid = k => (/\/vocadb_(\d+)$/.exec(k || "") || [])[1];
  const sid = typeof shareTake === "function" ? shareTake() : "";  // SNS 공유 카드 링크 (#play=<id>, share_card.js)
  if (!await loadLibrary([sid, vid(res && res.k), vid(store.get("last", ""))].filter(Boolean))) return;
  // the '☁ <repo> · 서버 없이 재생 중' note above the playlist was removed (user request 2026-11-15)
  const find = k => { try { return k && LOCAL.item(...k.split(/\/(.*)/s)); } catch (e) { return null; } };
  // shared song: plays at once, not put in the playlist (user request 2026-11-18) — before the resumed / last song
  const sit = sid && find(`stream/vocadb_${sid}`);
  if (sid && !(sit && canPlay(sit))) uiAlert(sit ? "공유된 곡은 지금 재생할 수 없습니다 (영상 없음)." : "공유된 곡을 찾지 못했습니다.");
  const rit = res && find(res.k), it = sit && canPlay(sit) ? sit : rit && canPlay(rit) ? rit : find(store.get("last", ""));
  if (it && canPlay(it) && !SHELL.now) { if (it === rit) SHELL.resumeAt(it, res.t); play(it, it === rit || it === sit, it === sit ? "pick" : ""); }
  if (typeof pnCheck === "function") setTimeout(() => pnCheck(true), 400);  // 패치노트: a new one pops up once (patch_notes.js)
  addonFromHash();  // #addon=ext|ov: sent here from a page opened as a file to download an add-on (play_engine.js)
  await loadRest();
  qRestoreAfterReload(rit && it === rit ? rit : null);  // after an update reload: the queue as it was
}
async function offlineIntro() {
  const gh = LOCAL.savedGitHub();
  showLoad("여는 중…");
  // kept in this browser again (user request 2026-11-17 — typing it at every start was too much): opens at once with the
  // nickname kept too; an expired token → the dialog with the reason
  if (gh && gh.token && store.get("reportWho", "")) {
    try { await LOCAL.useGitHub(gh.repo, gh.token, false); return offlineOpened(); } catch (e) { return offlineDialog(e.message); }
  }
  const saved = await LOCAL.saved();  // 브라우저 저장소를 못 쓰면 없음
  if (saved) {  // 지난번 폴더: 권한이 남아 있으면 바로 (없으면 팝업의 단추를 한 번 눌러 허락 — 브라우저가 누를 때만 물어볼 수 있음)
    try { await LOCAL.reopen(saved, false); return offlineOpened(); } catch (e) {}
  }
  offlineDialog();
}
/* 처음 화면: 깃허브 토큰 입력만 (user request — repo field, Server\data folder and mp3-folder choices removed;
   offline mp3 folder is connected from the list after switching to offline). Repo = last one used or the default.
   Can't be closed until a token opens. No '다른 토큰으로 열기' (user request 2026-11-20: one token per user). */
/* 마지막 토큰 생성 (user request 2026-11-17) — shown in the entry dialog. Kept here because the player can't read our data before a
   token opens it; the newest 생성 시간 in 음원 관리 › 토큰 관리 is the value to put here */
const TOKEN_MADE = "2026-11-16 14:00";
async function offlineDialog(err = "") {
  if (!VDB.idx) $("libInfo").textContent = "";
  const gh = LOCAL.savedGitHub(), repo = (gh || {}).repo || "AILEE126/music_backend";
  document.querySelector("dialog.offdlg")?.remove();
  const d = document.createElement("dialog");
  d.className = "uidlg offdlg";
  // + nickname (user request 2026-11-17) · a read-only token also needs the 1차 지인's nickname, registered on the server
  d.innerHTML = `<div class="dlg-body"><b>깃허브 토큰을 넣어 주세요</b>
      <div class="ghmade">마지막 토큰 생성 <b>${TOKEN_MADE}</b></div>
      <div class="ghform"><input type="text" id="ghToken" class="masked" placeholder="깃허브 토큰 (github_pat_…)" autocomplete="off" spellcheck="false"></div>
      <label class="ghform ghfield"><span class="ghlab"><span class="ltreq">*</span>닉네임</span><input type="text" id="ghWho" maxlength="8" autocomplete="off" spellcheck="false"></label>
      <div class="ghform ghfield"><span class="ghlab">대표색상</span><span id="ghClr"></span></div>
      <label class="ghform ghfield" id="ghViaRow" hidden><span class="ghlab"><span class="ltreq">*</span>소개받은 닉네임</span><input type="text" id="ghVia" placeholder="토큰을 준 사람의 닉네임" maxlength="8" autocomplete="off" spellcheck="false"></label>
      <div class="ghform ghbtns"><button class="primary" id="ghOpen">열기</button></div>
    <div class="offerr" id="offErr"></div></div>`;
  const q = sel => d.querySelector(sel), btns = () => d.querySelectorAll("button");
  const showErr = m => { q("#offErr").textContent = m; };
  showErr(err);
  let done = false;
  d.addEventListener("cancel", e => e.preventDefault());  // no Esc
  d.addEventListener("close", () => { if (!done) d.showModal(); });  // comes back until a token opens
  const tryOpen = async open => {
    showErr(""); btns().forEach(b => b.disabled = true); q("#offErr").textContent = "여는 중…";
    try { await open(); }
    catch (e) { showErr(e.name === "AbortError" ? "" : e.message); btns().forEach(b => b.disabled = false); return; }
    done = true; d.close(); d.remove();
    await offlineOpened();
  };
  q("#ghWho").value = store.get("reportWho", ""); q("#ghVia").value = store.get("ghVia", "");
  const clr = colorField(store.get("myColor", ""));  // 대표색상 (optional, user request 2026-11-17)
  q("#ghClr").replaceWith(clr.el);
  q("#ghOpen").onclick = () => tryOpen(async () => {
    const who = q("#ghWho").value.trim(), via = q("#ghVia").value.trim();
    if (!q("#ghToken").value.trim()) { q("#ghToken").focus(); throw new Error("토큰을 넣어 주세요."); }
    if (!who) { q("#ghWho").focus(); throw new Error("닉네임을 넣어 주세요."); }
    await LOCAL.useGitHub(repo, q("#ghToken").value, false);
    const tok = q("#ghToken").value.trim();
    // read-only: the 소개받은 닉네임 field appears only now (user request 2026-11-17) and must be a registered nickname
    if (!LOCAL.gh.write) {
      const shown = !q("#ghViaRow").hidden;
      q("#ghViaRow").hidden = false;
      let ok = false;
      if (shown && via) try { ok = await LOCAL.userExists(via); } catch (e) {}
      if (!ok) {
        LOCAL.gh = null; q("#ghVia").focus();
        throw new Error(!shown || !via ? "읽기 전용 토큰입니다 — 소개받은 닉네임을 넣어 주세요." : `'${via}' 은(는) 등록된 닉네임이 아닙니다 — 토큰을 준 사람의 닉네임을 넣어 주세요.`);
      }
    }
    store.set("reportWho", who.slice(0, 40)); store.set("ghVia", via.slice(0, 40)); store.set("myColor", clr.value);
    store.set("gh", {repo, token: tok});  // remembered (only once everything checked out)
  });
  d.querySelectorAll("input").forEach(i => { i.onkeydown = e => { if (e.key === "Enter") q("#ghOpen").click(); }; });
  document.body.appendChild(d);
  d.showModal();
  q("#ghToken").focus();
}

/* ================= 가사 오버레이 (programs\WEB\tools\lyrics_overlay.bat — 파워쉘 창, 바탕 투명 · 어느 브라우저든) =================
   지금 곡·가사 묶음은 재생기(play_engine.js)가 알려 줌. [오버레이] = 켜기·끄기, ⚙ = 설정 창 (shared_screen_helpers.js) */
bindOverlayPower($("btnOverlay"), "오버레이");
$("btnSettings").onclick = e => { e.stopPropagation(); openPlayerSettings(); };

/* ================= 키보드 ================= */
document.addEventListener("keydown", e => {
  if (e.target.closest("input[type=text],input[type=search],textarea,select") || $("coverDlg").open || $("reportDlg").open || $("searchDlg").open || $("karaDlg").open || document.querySelector("dialog.uidlg[open]")) return;
  if (editing && editMode === "sync" && (e.code === "Space" || e.key === "ArrowDown")) { e.preventDefault(); editDown(); return; }
  if (editing && editMode === "sync" && e.key === "ArrowUp") { e.preventDefault(); editUp(); return; }
  if (e.code === "Space") { e.preventDefault(); $("btnPlay").click(); }
  else if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  else if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
});

/* 가사 도구 줄 접기 · 펴기 (user request) — always opens unfolded, the fold is not remembered (user request 2026-11-19) */
function applyBar(fold) { document.body.classList.toggle("barfold", fold); $("btnBar").title = fold ? "가사 도구 펴기" : "가사 도구 접기"; }
applyBar(false);
$("btnBar").onclick = () => applyBar(!document.body.classList.contains("barfold"));

/* ================= 시작 ================= */
(async () => {
  renderModes();
  cleanups.push(SHELL.subscribe(now => { renderModes(); showSong(now); }));
  cleanups.push(SHELL.lsubscribe(() => tick(true)));
  await offlineIntro();  // 우리 곡·가사를 어디서 읽을지 (지난번 것이 그대로 열리면 바로)
})();
