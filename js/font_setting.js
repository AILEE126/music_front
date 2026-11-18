/* 글꼴 (user request 2026-11-18) — ⚙ 설정 › 글꼴, two picks: 일본어 글꼴 (kana · kanji, Chinese hanzi too) and 나머지 글꼴.
   Each: 기본 (the built-in stack, as before) · 시스템 글꼴 (phones only — the phone's own UI font, system-ui; not offered on a
   PC, user request 2026-11-18 — the pick stays saved and acts as 기본 there) · fonts registered in the server's Manage › 글꼴 (Server/data/fonts/fonts.json + the files, data branch).
   Only the lyrics view and the overlays use them (user request 2026-11-18 — PC and phone; the rest of the screen keeps its font).
   Registered fonts become FontFaces split by unicode-range, so the Japanese pick draws only kana/kanji and the other pick
   the rest; they go in front of the lyrics view's font (CSS --font-user). A font file is downloaded once and kept in IndexedDB
   (one slot per pick, {sha, file, buf}, replaced when the pick or the file changes) — the phone app's overlay window
   (html/lyrics_overlay_mobile.html, same origin) reads the same slots; the PC overlay program gets the file sent once
   (fontToOverlay). Both learn the picked files from the overlay settings (font_ja · font_etc = file name, "" = 기본). */
const FONT_RANGE = {
  ja: "U+3000-30FF,U+31F0-31FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF,U+20000-3FFFF",
  etc: "U+0-2FFF,U+3100-31EF,U+3200-33FF,U+4DC0-4DFF,U+A000-F8FF,U+FB00-FEFF,U+FFF0-FFFF,U+10000-1FFFF,U+40000-10FFFF",
};
const FONT_FAMILY = {ja: "CscFontJa", etc: "CscFontEtc"};
const FONT = {list: null, faces: {}, run: 0};
const fontDb = idbKV("music-fonts");
const fontPick = k => store.get("font." + k, "");  // "" 기본 · "system" · registered font id
const fontPhone = () => APP.on || document.body.classList.contains("m");

async function fontList(fresh = false) {
  if (FONT.list && !fresh) return FONT.list;
  const d = LOCAL.ready ? await LOCAL.readJson(`${LOCAL.data}fonts/fonts.json`, null).catch(() => null) : null;
  return (FONT.list = (d && d.fonts) || []);
}
async function fontFace(k, f) {
  let hit = await fontDb("get", k).catch(() => null);
  if (!hit || hit.sha !== f.sha || hit.file !== f.file) {
    hit = {sha: f.sha, file: f.file, buf: await LOCAL.readBytes(`${LOCAL.data}fonts/${f.file}`)};
    await fontDb("put", k, hit).catch(() => {});  // before the overlays hear of it (they read this slot)
  }
  const face = new FontFace(FONT_FAMILY[k], hit.buf, {unicodeRange: FONT_RANGE[k], display: "swap"});
  await face.load();
  return {face, sha: f.sha, file: f.file, buf: hit.buf};
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
  const ids = ["ja", "etc"].map(fontPick);
  const list = ids.some(v => v && v !== "system") ? await fontList() : [];
  for (const [i, k] of ["ja", "etc"].entries()) {
    const f = list.find(x => x.id === ids[i]), old = FONT.faces[k];
    if (old && old.sha === (f && f.sha)) continue;
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
  const want = {font_ja: FONT.faces.ja ? FONT.faces.ja.file : "", font_etc: FONT.faces.etc ? FONT.faces.etc.file : ""};
  if (!APP.on) {
    try {
      const have = (await (await fetch(OV_URL + "/fonts")).json()).files || [];
      for (const f of [FONT.faces.ja, FONT.faces.etc])
        if (f && !have.includes(f.file)) await fetch(`${OV_URL}/font?file=${encodeURIComponent(f.file)}`, {method: "POST", body: f.buf});
    } catch (e) { return; }  // overlay program not running (or an old one without fonts)
  }
  const c = await api("/api/ovset").catch(() => null);
  if (c && ((c.font_ja || "") !== want.font_ja || (c.font_etc || "") !== want.font_etc)) post("/api/ovset", want).catch(() => {});
}
new MutationObserver(fontStack).observe(document.body, {attributes: true, attributeFilter: ["class"]});

/* ⚙ 설정 › 글꼴 (shared_screen_helpers.js openPlayerSettings puts it in as a part) */
async function fontSettingsHtml() {
  const list = await fontList(true);
  const sel = (k, label, hint) => `<label title="${hint}">${label}<select data-font="${k}">
      <option value="">기본</option>${fontPhone() ? '<option value="system">시스템 글꼴</option>' : ""}
      ${list.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></label>`;
  return sel("ja", "일본어 글꼴", "일본어(가나)와 한자(중국어 한자 포함)를 이 글꼴로")
    + sel("etc", "나머지 글꼴", "한글 · 영어 · 숫자 등 일본어 · 한자가 아닌 글자를 이 글꼴로")
    + (list.length ? "" : `<p class="muted">서버에 등록된 글꼴이 아직 없습니다.</p>`)
    + `<p class="muted" data-font-note hidden></p>`;
}
function fontSettingsBind(d) {
  const note = d.querySelector("[data-font-note]");
  d.querySelectorAll("select[data-font]").forEach(s => {
    const v = fontPick(s.dataset.font);
    s.value = [...s.options].some(o => o.value === v) ? v : "";  // a font taken off the server (or 시스템 글꼴 on a PC) → 기본
    s.addEventListener("change", async () => {
      store.set("font." + s.dataset.font, s.value);
      s.blur();
      const big = s.value && s.value !== "system" && FONT.faces[s.dataset.font]?.sha !== (FONT.list.find(f => f.id === s.value) || {}).sha;
      if (big) { note.hidden = false; note.textContent = "글꼴 파일을 받는 중…"; }
      await fontApply();
      note.hidden = true;
    });
  });
}
