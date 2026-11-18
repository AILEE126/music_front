/* 오류 신고 · 텍스트 대치 제안 창 — 종류 · 곡 · 그림 붙이기 · 보내기.
   player_screen.js 를 나눈 조각 (user request 2026-11-18) */
/* ================= 오류 신고: 고른 종류 + 자세한 내용 + 곡·재생 위치·틀던 출처 → 음원 관리 › 오류 신고 (서버 없이도 — local_files.js) ================= */
let reportIt = null;  // 신고할 곡 (처음엔 지금 재생 중인 곡)
// User request: everyone shares one token, so each report carries the sender's name (required · remembered in this browser).
// "신곡 추가 요청": no song is picked — the song search box becomes the requested song name.
const REPORT_REQ = "신곡 추가 요청";
const reportReq = () => $("reportKind").value === REPORT_REQ;
// 텍스트 대치 제안 · 개선 (user request 2026-11-15): suggestions — a song is optional (기능제안 removed 2026-11-17; 개선 takes its place)
const REPORT_REPL = "텍스트 대치 제안";
const reportIdea = () => ["개선", REPORT_REPL].includes($("reportKind").value);
const reportRepl = () => $("reportKind").value === REPORT_REPL;
let reportBusy = false;  // sending: the window stays open, 취소 locked (user request 2026-11-17)
function reportCanSend() {
  if (reportBusy) return;
  $("reportSend").disabled = !!(LOCAL.gh && !LOCAL.gh.write)  // 읽기만 되는 깃허브 토큰이면 보낼 수 없음
    || !$("reportKind").value  // 종류 is required (user request 2026-11-17)
    || !$("reportWho").value.trim() || (reportReq() ? !$("reportQ").value.trim() : !reportIt && !reportIdea())
    || (reportRepl() && !$("reportFrom").value.trim());  // 텍스트 대치: 바꿀 글자는 꼭
}
// the picked song shows as the one picked row of the results list (user request 2026-11-17: no separate pre-picked field)
function setReportSong(it) {
  reportIt = it;
  const playing = it && SHELL.now && keyOf(SHELL.now) === keyOf(it);
  $("reportList").innerHTML = it ? `<div class="ri sel">✓ ${titleHtml(it)} <span class="hint">${esc(shortName(it.artist || ""))}${playing ? ` · 재생 위치 ${fmt(audio.currentTime)}` : ""}</span></div>` : "";
  reportCanSend();
}
function reportKindChanged() {
  const req = reportReq();
  $("reportRepl").hidden = !reportRepl();
  $("reportReqNote").hidden = !req;
  $("reportSongLabel").innerHTML = req ? "요청할 곡" : reportIdea() ? '관련된 곡 <span class="hint">(없어도 됨)</span>' : "어느 곡인가요";
  $("reportNow").hidden = req;
  $("reportQ").type = req ? "text" : "search";
  $("reportQ").placeholder = req ? "요청할 곡명 (제목·가수 — 영상 주소도 좋아요)" : "다른 곡 찾기 (제목·원제·가수)";
  $("reportQ").value = "";
  if (req) { setReportSong(null); $("reportQ").focus(); }  // request: the picked song is cleared
  else setReportSong(reportIt);
}
$("reportNow").onclick = () => { const it = SHELL.now || cur; if (!it) return uiAlert("재생 중인 곡이 없습니다."); $("reportQ").value = ""; setReportSong(it); };
$("reportKind").addEventListener("change", reportKindChanged);
$("reportFrom").addEventListener("input", reportCanSend);
/* 그림 붙이기 (user request 2026-11-15): 최대 5장 — Ctrl+V · 창에 끌어 놓기 · 파일 고르기. 보내기 전에 줄여서 (긴 변 1600px JPEG)
   신고 파일 안에 data URL 로 (깃허브엔 신고 하나 = 커밋 하나 그대로) → 음원 관리 › 오류 신고에서 봄 */
const REPORT_IMG_MAX = 5;
let reportImgs = [];
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  for (const [side, q] of [[1600, 0.85], [1200, 0.75], [900, 0.65]]) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const u = c.toDataURL("image/jpeg", q);
    if (u.length < 700000 || side === 900) { if (bmp.close) bmp.close(); return u; }
  }
}
async function addReportImages(files) {
  const imgs = [...files].filter(f => f && /^image\//.test(f.type));
  if (!imgs.length) return;
  const room = REPORT_IMG_MAX - reportImgs.length;
  if (room <= 0) return uiAlert(`그림은 ${REPORT_IMG_MAX}장까지 붙일 수 있습니다.`);
  for (const f of imgs.slice(0, room)) {
    try { reportImgs.push(await shrinkImage(f)); } catch (e) { uiAlert(`그림을 읽지 못했습니다 (${f.name || "붙여 넣은 그림"})`); }
  }
  renderReportImages();
  if (imgs.length > room) uiAlert(`그림은 ${REPORT_IMG_MAX}장까지라 ${imgs.length - room}장은 빠졌습니다.`);
}
function renderReportImages() {
  $("reportImgList").innerHTML = reportImgs.map((u, i) => `<span class="ri"><img src="${u}" alt="그림 ${i + 1}"><button type="button" data-i="${i}" title="빼기">✕</button></span>`).join("");
  $("reportImgPick").disabled = reportImgs.length >= REPORT_IMG_MAX;
}
$("reportImgList").addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (b) { reportImgs.splice(+b.dataset.i, 1); renderReportImages(); } });
$("reportImgPick").onclick = () => $("reportImgFile").click();
$("reportImgFile").onchange = async () => { await addReportImages($("reportImgFile").files); $("reportImgFile").value = ""; };
$("reportDlg").addEventListener("paste", e => {  // text pastes as usual — only images are taken
  const fs = [...(e.clipboardData && e.clipboardData.items || [])].filter(x => x.kind === "file").map(x => x.getAsFile());
  if (fs.some(f => f && /^image\//.test(f.type))) { e.preventDefault(); addReportImages(fs); }
});
$("reportDlg").addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); $("reportDlg").classList.add("drop"); } });
$("reportDlg").addEventListener("dragleave", e => { if (!$("reportDlg").contains(e.relatedTarget)) $("reportDlg").classList.remove("drop"); });
$("reportDlg").addEventListener("drop", e => { $("reportDlg").classList.remove("drop"); if (e.dataTransfer.files.length) { e.preventDefault(); addReportImages(e.dataTransfer.files); } });
/* 이름 칸 (user request 2026-11-16, web · phone): 같이듣기 닉네임 · 오류 신고 보내는 사람 start with the last name used,
   and tapping the field lists the names used before under it (✕ drops one) — store "nameHist", newest first */
const NAME_HIST = 8;
function nameHistAdd(n) {
  n = String(n || "").trim(); if (!n) return;
  store.set("nameHist", [n, ...store.get("nameHist", []).filter(x => x !== n)].slice(0, NAME_HIST));
}
if (!store.get("nameHist", []).length) nameHistAdd(store.get("reportWho", ""));  // the one name kept before
function nameField(inp) {
  const ul = document.createElement("ul");
  ul.className = "namehist"; ul.hidden = true; inp.after(ul);
  const show = () => {
    const q = inp.dataset.typed ? inp.value.trim().toLowerCase() : "";  // tapped: every name · typing: the names with that text
    const names = store.get("nameHist", []).filter(n => !q || n.toLowerCase().includes(q));
    ul.innerHTML = names.map(n => `<li data-n="${esc(n)}"><span>${esc(n)}</span><button type="button" class="nhx" title="목록에서 지우기" aria-label="지우기">✕</button></li>`).join("");
    ul.style.top = inp.offsetTop + inp.offsetHeight + 2 + "px";
    ul.hidden = !names.length;
  };
  const hide = () => { ul.hidden = true; delete inp.dataset.typed; };
  inp.addEventListener("focus", show);
  inp.addEventListener("click", show);
  inp.addEventListener("input", () => { if (inp.dataset.pick) return; inp.dataset.typed = 1; show(); });
  inp.addEventListener("blur", hide);
  inp.addEventListener("change", () => nameHistAdd(inp.value));
  inp.addEventListener("keydown", e => { if (e.key === "Escape" && !ul.hidden) { e.preventDefault(); e.stopPropagation(); hide(); } });  // closes the list, not the window
  ul.addEventListener("mousedown", e => e.preventDefault());  // the field keeps focus
  ul.addEventListener("click", e => {
    e.preventDefault();  // inside a <label>: the click must not reach the field again (it would reopen the list)
    const li = e.target.closest("li"); if (!li) return;
    if (e.target.closest(".nhx")) { store.set("nameHist", store.get("nameHist", []).filter(x => x !== li.dataset.n)); return show(); }
    inp.value = li.dataset.n; hide();
    inp.dataset.pick = 1; inp.dispatchEvent(new Event("input")); delete inp.dataset.pick;  // the field's own input handler (store · checks)
  });
}
nameField($("reportWho"));
$("reportWho").addEventListener("input", () => { store.set("reportWho", $("reportWho").value.trim()); reportCanSend(); });
let reportDiag = "";  // diagnostic log attached to a stall report (play_engine.js diag)
function openReport(pre = {}) {
  $("reportWho").value = store.get("reportWho", "");
  $("reportKind").value = pre.kind || "";  // nothing picked at first (user request 2026-11-17)
  reportIt = pre.it || null;
  reportKindChanged();
  $("reportText").value = pre.text || "";
  $("reportFrom").value = $("reportTo").value = "";
  reportImgs = []; renderReportImages();
  reportDiag = pre.diag || "";
  // 보내는 곳: 깃허브에서 열었으면 그 저장소 (서버 PC 의 음원 관리가 받아 봄) · 폴더로 열었으면 그 폴더 (서버 PC 의 폴더일 때만 전달됨)
  $("reportHint").textContent = "보낸 날짜·시각과 함께 저장됩니다 — " + (LOCAL.gh
    ? (LOCAL.gh.write ? `깃허브 ${LOCAL.gh.repo} 에 올라가 음원 관리에서 받아 봅니다` : "읽기만 되는 토큰이라 보낼 수 없습니다 (토큰에 Contents 쓰기 권한 필요)")
    : `고른 폴더(${LOCAL.name})에 저장됩니다 — 다른 PC 라면 '깃허브에서 열기'로 열어야 전달됩니다`);
  const ro = LOCAL.gh && !LOCAL.gh.write;
  $("reportSend").title = ro ? "읽기만 되는 토큰" : "";
  $("reportDlg").showModal();
  $("reportKind").focus();  // sender = the start nickname (field hidden — user request 2026-11-17)
}
$("btnReport").onclick = () => openReport();
$("sReport").onclick = () => openReport();  // 곡 검색 창 위에 열림 (dialog top layer)
/* User request: no browser-settings popup (on entry or on stall). A song that stalled while the player wasn't watched
   (play_engine.js stallSubs) opens the error report instead, with the diagnostic log attached — once per load. */
const REPORT_STALL = "안 보는 동안 곡이 멈춤";
let stallShown = false;
SHELL.stallSubs.add(it => {
  if (stallShown || $("reportDlg").open) return;
  stallShown = true;
  openReport({kind: REPORT_STALL, it, text: "플레이어를 안 보는 동안 다음 곡이 재생되지 않고 멈춰 있었습니다.", diag: playerDiag().split("\n").slice(-120).join("\n")});
});
cleanups.push(() => SHELL.stallSubs.clear());
/* 다른 곡 고르기: 이 플레이어가 아는 곡 (우리 곡·재생목록·찾아본 곡) 먼저, 그다음 VocaDB 검색 (곡 검색 창과 같은 곳) */
let reportSeq = 0;
$("reportQ").addEventListener("input", () => {
  if (reportReq()) { reportCanSend(); return; }  // request: the box is the song name, no search
  const raw = $("reportQ").value.trim(), seq = ++reportSeq;
  const show = (hits, more) => {
    $("reportList").innerHTML = hits.map((it, i) => `<div class="ri" data-i="${i}">${titleHtml(it)} <span class="hint">${esc(shortName(it.artist || ""))}${it.deleted ? " · 삭제됨" : ""}${it.api ? " · VocaDB" : ""}</span></div>`).join("")
      + (more ? '<div class="hint">우리 DB 에서 찾는 중…</div>' : "") || (raw ? '<div class="hint">맞는 곡이 없습니다</div>' : "");
    $("reportList").onclick = e => { const r = e.target.closest(".ri[data-i]"); if (!r) return; $("reportQ").value = ""; setReportSong(LOCAL.remember(hits[+r.dataset.i])); };
  };
  if (!raw) { clearTimeout(reportFind.timer); return setReportSong(reportIt); }  // empty box: back to the picked song
  const local = raw ? allItems().filter(it => FKIND.text[1](it, fold(raw))).slice(0, 20) : [];
  show(local, !!raw && ONLINE);
  if (!raw || !ONLINE) return;
  clearTimeout(reportFind.timer);
  reportFind.timer = setTimeout(() => findSongs(raw, local).then(hits => { if (seq === reportSeq) show(hits, false); }), 400);
});
const reportFind = {timer: 0};
$("reportCancel").onclick = () => { if (!reportBusy) $("reportDlg").close(); };
$("reportDlg").addEventListener("cancel", e => { if (reportBusy) e.preventDefault(); });  // Esc can't close it while sending
$("reportSend").onclick = async () => {
  if (!$("reportKind").value) return;
  const it = reportReq() ? null : reportIt, req = reportReq() ? $("reportQ").value.trim() : "";
  if (!it && !req && !reportIdea()) return;
  // user request: reporting a deleted song is allowed, but ask first
  if (it && it.deleted && !await uiConfirm("해당 곡은 삭제됐습니다. 신고하시겠습니까?", "예")) return;
  const playing = it && SHELL.now && keyOf(SHELL.now) === keyOf(it);
  reportBusy = true; sendingBtn($("reportSend"), true); $("reportCancel").disabled = true;
  const done = () => { reportBusy = false; sendingBtn($("reportSend"), false); $("reportCancel").disabled = false; };
  try {
    nameHistAdd($("reportWho").value);
    await post("/api/report", {kind: $("reportKind").value, text: $("reportText").value, who: $("reportWho").value.trim(), request: req,
      song: it ? {site: it.site, name: it.name, title: it.title, artist: it.artist || "", ...(it.vocadb ? {vocadb: String(it.vocadb)} : {})} : null,  // VocaDB id: the song's key from now on
      pos: playing ? Math.round(audio.currentTime * 10) / 10 : null, source: playing ? audio.src : "",
      // phone app: every report carries the playback log (user report 2026-11-16: S24 went silent after a page change — not seen elsewhere)
      diag: $("reportKind").value === REPORT_STALL ? reportDiag : APP.on ? playerDiag().split("\n").slice(-120).join("\n") : "", images: reportImgs,
      ...(reportRepl() ? {replace: {from: $("reportFrom").value.trim(), to: $("reportTo").value.trim()}} : {})});
  } catch (e) { done(); reportCanSend(); uiAlert(e.message); return; }
  done();
  $("reportDlg").close();
  uiAlert("신고를 보냈습니다. 고맙습니다!");
};
