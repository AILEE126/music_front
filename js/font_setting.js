/* 글꼴 (user request 2026-11-18) — ⚙ 설정 › 글꼴 (named 가사 for a while on 2026-11-19), two picks: 일본어 글꼴 (kana · kanji, Chinese hanzi too) and 한글 글꼴 (the rest; was 나머지 글꼴).
   Each: 기본 (the built-in stack, as before) · 시스템 글꼴 (phones only — the phone's own UI font, system-ui; not offered on a
   PC, user request 2026-11-18 — the pick stays saved and acts as 기본 there) · fonts registered in the server's Manage › 글꼴 (Server/data/fonts/fonts.json + the files, data branch).
   Only the lyrics view and the overlays use them (user request 2026-11-18 — PC and phone; the rest of the screen keeps its font).
   Registered fonts become FontFaces split by unicode-range, so the Japanese pick draws only kana/kanji and the other pick
   the rest; they go in front of the lyrics view's font (CSS --font-user). A font file is downloaded once and kept in IndexedDB
   (one slot per pick, {sha, file, buf}, replaced when the pick or the file changes) — the phone app's overlay window
   (html/lyrics_overlay_mobile.html, same origin) reads the same slots; the PC overlay program gets the file sent once
   (fontToOverlay). Both learn the picked files from the overlay settings (font_ja · font_etc = file name, "" = 기본).
   굵기 (user request 2026-11-19 — 니코모지 플러스 looked far too thick): most registered fonts have one weight only, and the
   lyrics' original line is weight 600 (overlays 700), so the browser / WPF drew a fake bold of it. Default now = 글꼴 그대로
   (the face covers every weight → never faked); '굵게' per pick brings the fake bold back. Thinner than the font is not
   possible. Overlays learn it as font_bold_ja · font_bold_etc. */
const FONT_RANGE = {
  ja: "U+3000-30FF,U+31F0-31FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF,U+20000-3FFFF",
  etc: "U+0-2FFF,U+3100-31EF,U+3200-33FF,U+4DC0-4DFF,U+A000-F8FF,U+FB00-FEFF,U+FFF0-FFFF,U+10000-1FFFF,U+40000-10FFFF",
};
const FONT_FAMILY = {ja: "CscFontJa", etc: "CscFontEtc"};
const FONT = {list: null, def: {}, faces: {}, run: 0};
const fontDb = idbKV("music-fonts");
/* "" 기본 가사 글꼴 (built-in) · "system" · registered font id. Never picked in this browser → the server's 기본 글꼴 for that
   pick (Manage › 글꼴 ★, fonts.json default — user request 2026-11-19), the built-in one when it has none */
const fontPick = k => { const v = store.get("font." + k, null); return v === null ? FONT.def[k] || "" : v; };
const fontBold = k => !!store.get("font.bold." + k, false);
const fontPhone = () => APP.on || document.body.classList.contains("m");
/* a font is registered as 일본어 (use "ja") or 한글 ("etc") and offered only in that pick (user request 2026-11-19;
   fonts from before it have no use → 일본어) */
const fontFor = (f, k) => (f.use || "ja") === k;

async function fontList(fresh = false) {
  if (FONT.list && !fresh) return FONT.list;
  if (!LOCAL.ready) return [];  // not kept: read again once our data can be read
  const d = await LOCAL.readJson(`${LOCAL.data}fonts/fonts.json`, null).catch(() => null);
  FONT.def = (d && d.default) || {};
  return (FONT.list = (d && d.fonts) || []);
}
async function fontFace(k, f) {
  let hit = await fontDb("get", k).catch(() => null);
  if (!hit || hit.sha !== f.sha || hit.file !== f.file) {
    hit = {sha: f.sha, file: f.file, buf: await LOCAL.readBytes(`${LOCAL.data}fonts/${f.file}`)};
    await fontDb("put", k, hit).catch(() => {});  // before the overlays hear of it (they read this slot)
  }
  const bold = fontBold(k);  // not bold: one face for weights 100–900, so 600/700 text is drawn as the font is
  const face = new FontFace(FONT_FAMILY[k], hit.buf, {unicodeRange: FONT_RANGE[k], display: "swap", ...(bold ? {} : {weight: "100 900"})});
  await face.load();
  return {face, sha: f.sha, file: f.file, buf: hit.buf, bold};
}
/* --font-user from what is loaded — cheap, run again when the screen turns phone ↔ PC (시스템 글꼴 is phones only) */
function fontStack() {
  const fams = ["ja", "etc"].filter(k => FONT.faces[k]).map(k => `"${FONT_FAMILY[k]}"`);
  if (fontPhone() && (fontPick("ja") === "system" || fontPick("etc") === "system")) fams.push("system-ui");
  const v = fams.length ? fams.join(",") + "," : "";
  const root = document.documentElement.style;
  if (root.getPropertyValue("--font-user") !== v) v ? root.setProperty("--font-user", v) : root.removeProperty("--font-user");
}
/* load the picked registered fonts (a file that fails or was removed from the server → 기본 for that pick) */
async function fontApply() {
  const run = ++FONT.run;
  const list = await fontList();  // also brings the server's 기본 글꼴 (fontPick)
  const ids = ["ja", "etc"].map(fontPick);
  for (const [i, k] of ["ja", "etc"].entries()) {
    const f = list.find(x => x.id === ids[i] && fontFor(x, k)), old = FONT.faces[k];
    if (old && old.sha === (f && f.sha) && old.bold === fontBold(k)) continue;
    let got = null;
    if (f) try { got = await fontFace(k, f); } catch (e) { console.warn("글꼴을 못 읽음", f.name, e); }
    if (run !== FONT.run) return;  // a newer pick came meanwhile
    if (old) document.fonts.delete(old.face);
    if (got) document.fonts.add(got.face);
    FONT.faces[k] = got;
  }
  fontStack();
  fontToOverlay();
}
/* 오버레이도 같은 글꼴 (user request 2026-11-18): the overlay settings name the picked files; the PC overlay program
   (tools/lyrics_overlay.ps1, WPF — reads ttf/otf only) is sent the files it doesn't have yet, raw, once. Also run when
   the PC overlay starts answering (bindOverlayPower) */
const OV_URL = "http://127.0.0.1:47613";
async function fontToOverlay() {
  if (!APP.on && !LOCAL.ovOn) return;  // this browser never used the overlay
  const want = {font_ja: FONT.faces.ja ? FONT.faces.ja.file : "", font_etc: FONT.faces.etc ? FONT.faces.etc.file : "",
    font_bold_ja: fontBold("ja"), font_bold_etc: fontBold("etc")};
  if (!APP.on) {
    try {
      const have = (await (await fetch(OV_URL + "/fonts")).json()).files || [];
      for (const f of [FONT.faces.ja, FONT.faces.etc])
        if (f && !have.includes(f.file)) await fetch(`${OV_URL}/font?file=${encodeURIComponent(f.file)}`, {method: "POST", body: f.buf});
    } catch (e) { return; }  // overlay program not running (or an old one without fonts)
  }
  const c = await api("/api/ovset").catch(() => null);
  if (c && Object.keys(want).some(k => (c[k] || (k.startsWith("font_bold") ? false : "")) !== want[k])) post("/api/ovset", want).catch(() => {});
}
new MutationObserver(fontStack).observe(document.body, {attributes: true, attributeFilter: ["class"]});

/* ⚙ 설정 › 글꼴 (shared_screen_helpers.js openPlayerSettings puts it in as a part; 2026-11-19: 글꼴 → 가사 → 글꼴 again, user request).
   One line per pick: 글꼴 + 굵기 (user request 2026-11-19), and under it a preview drawn the way the lyrics view draws it
   (same font stack — --font-user — and the lyrics' line styles): parts split like a duet, カンタレラ (KAITO · 初音ミク).
   Not the song's words (copyright) — each singer's greeting. 일본어 preview = the original lines, 한글 = 발음 · 번역 lines. */
const FONT_PREV = [
  {name: "カイト", ko: "KAITO", color: "#4f6fd8", o: "はじめまして、カイトです", r: "하지메마시테, 카이토데스", t: "처음 뵙겠습니다, 카이토입니다"},
  {name: "初音ミク", ko: "하츠네 미쿠", color: "#39c5bb", o: "初音ミクです、よろしくね！", r: "하츠네 미쿠데스, 요로시쿠네!", t: "하츠네 미쿠예요, 잘 부탁해!"},
];
function fontPreview(k) {
  const part = p => `<div class="part" style="--pc:${p.color}"><i></i>${esc(k === "ja" ? p.name : p.ko || p.name)}</div>`;  // 한글 preview: Korean names (user request 2026-11-19)
  const roles = k === "ja" ? ["o"] : ["r", "t"];
  return `<div class="fprev" aria-hidden="true"><div class="fprevhd">미리보기</div>${FONT_PREV.map(p => `<div class="g">${part(p)}${
    roles.map(r => lyrLine(r, p[r], [p.color])).join("")}</div>`).join("")}</div>`;
}
async function fontSettingsHtml() {
  const list = await fontList(true);
  const sel = (k, label, hint) => `<div class="frow"><label title="${hint}">${label}<select data-font="${k}">
      <option value="">기본 가사 글꼴</option>${fontPhone() ? '<option value="system">시스템 글꼴</option>' : ""}
      ${list.filter(f => fontFor(f, k)).map(f => `<option value="${esc(f.id)}">${esc(f.name)}${FONT.def[k] === f.id ? " ★" : ""}</option>`).join("")}</select></label>
    <label title="원문 줄은 굵은 글씨라, 굵기가 하나뿐인 글꼴은 '굵게'면 가짜로 두껍게 그려짐 · 기본 글꼴은 늘 원래 굵기">굵기<select data-fbold="${k}">
      <option value="">글꼴 그대로</option><option value="1">굵게</option></select></label></div>${fontPreview(k)}`;
  return sel("ja", "일본어 글꼴", "일본어(가나)와 한자(중국어 한자 포함)를 이 글꼴로")
    + sel("etc", "한글 글꼴", "한글 · 영어 · 숫자 등 일본어 · 한자가 아닌 글자를 이 글꼴로")
    + (list.length ? "" : `<p class="muted">서버에 등록된 글꼴이 아직 없습니다.</p>`)
    + (FONT.def.ja || FONT.def.etc ? `<p class="muted">★ = 따로 고르지 않으면 쓰이는 기본 글꼴 (음원 관리 › 글꼴에서 정함)</p>` : "")
    + `<p class="muted" data-font-note hidden></p>`;
}
function fontSettingsBind(d) {
  const note = d.querySelector("[data-font-note]");
  // 굵게: only for a registered font (기본 · 시스템 글꼴 have real bold weights)
  const boldRow = k => { const s = d.querySelector(`select[data-font="${k}"]`), c = d.querySelector(`[data-fbold="${k}"]`); c.value = fontBold(k) ? "1" : ""; c.disabled = !s.value || s.value === "system"; };
  d.querySelectorAll("[data-fbold]").forEach(c => c.addEventListener("change", () => { store.set("font.bold." + c.dataset.fbold, !!c.value); c.blur(); fontApply(); }));
  d.querySelectorAll("select[data-font]").forEach(s => {
    const v = fontPick(s.dataset.font);
    s.value = [...s.options].some(o => o.value === v) ? v : "";  // a font taken off the server (or 시스템 글꼴 on a PC) → 기본
    boldRow(s.dataset.font);
    s.addEventListener("change", async () => {
      store.set("font." + s.dataset.font, s.value);
      s.blur(); boldRow(s.dataset.font);
      const big = s.value && s.value !== "system" && FONT.faces[s.dataset.font]?.sha !== (FONT.list.find(f => f.id === s.value) || {}).sha;
      if (big) { note.hidden = false; note.textContent = "글꼴 파일을 받는 중…"; }
      await fontApply();
      note.hidden = true;
    });
  });
}
