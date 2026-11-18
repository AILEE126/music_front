/* 패치노트 (user request 2026-11-17). Written in the server's Manage › 패치노트 → Server/data/patch_notes.json (data branch);
   only notes the server pushed ("pub") are shown.
   · A note not seen yet pops up once when the player opens; closing it marks it seen → no popup until the next note.
   · The app name opens the list any time. A note that came while the player was open (not popped up) shows a red dot
     (no number) on the app name instead of interrupting.
   · Opening grows the window out of the app name, closing shrinks it back into it (user request). */
const PN = {notes: [], open: false, timer: 0, busy: false};
const PN_EVERY = 10 * 60 * 1000;
const pnSeen = () => String(store.get("patch.seen", "") || "");
const pnUnread = () => PN.notes.filter(n => n.id > pnSeen());
const pnName = () => document.querySelector(".side-head h1");

/* body text → html: '## x' sub title · '- x' item · other lines plain (same rules as the manage screen) */
const pnInline = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")  // **글자** → bold
  .replace(/^\[(서버|웹)\]\s*/, (m, w) => w === "서버" ? '<span class="pchip sv">서버</span>' : "");  // only 서버 gets a chip — 웹 not shown (user request 2026-11-17)
function pnHtml(text) {
  // '- x' item · '  - x' (indented) detail under the item above (user request 2026-11-17: feature + its details)
  let html = "", lvl = 0, top = null;  // top: feature line not written yet (it becomes a fold when details follow)
  // '@캡처' pictures go under the feature, outside its fold — always shown, details folded or not (user request 2026-11-19)
  let pics = "";
  const outPics = () => { html += pics; pics = ""; };
  // details under a feature are folded — the feature name opens them (user request 2026-11-17)
  const flush = () => { if (top != null) { html += `<li>${top}`; top = null; } };
  const close = to => { while (lvl > to) { if (lvl === 2) { html += "</ul></details>"; outPics(); } else { flush(); outPics(); html += "</li></ol>"; } lvl--; } };
  for (const ln of String(text || "").split(/\r?\n/)) {
    const li = /^(\s*)[-*]\s+(.*)$/.exec(ln), h = /^\s*#{1,3}\s+(.*)$/.exec(ln);
    const shot = /^\s*@캡처\s+([\w-]+\.(?:jpg|png))\s*$/.exec(ln);  // picture of the changed screen part (user request 2026-11-18)
    if (h) { close(0); html += `<h4>${pnInline(h[1])}</h4>`; }
    else if (shot) {
      if (lvl === 0) { html += "<ol>"; lvl = 1; top = ""; }
      pics += `<div class="pn-shot"><img data-shot="${esc(shot[1])}" alt="바뀐 화면"></div>`;
    } else if (li && li[1].length >= 2) {
      if (lvl === 0) { html += "<ol>"; lvl = 1; top = ""; }
      // a feature's details start folded (user request 2026-11-19)
      if (lvl === 1) { html += `<li class="fold"><details><summary>${top || ""}</summary><ul>`; top = null; lvl = 2; }
      html += `<li>${pnInline(li[2])}</li>`;
    } else if (li) {
      close(1);
      if (lvl === 1) { flush(); outPics(); html += "</li>"; } else { html += "<ol>"; lvl = 1; }  // features numbered 1 2 3 (user request), details not
      top = pnInline(li[2]);
    } else { close(0); if (ln.trim()) html += `<p>${pnInline(ln)}</p>`; }
  }
  close(0);
  return html;
}
/* '@캡처' pictures (Server/data/patch_shots): read only once their note is open (one GitHub request each); a missing one is
   left out. Click = full size */
const PN_SHOT = new Map();
function pnShots(root) {
  for (const img of root.querySelectorAll("details[open] img[data-shot]:not([src])")) {
    const f = img.dataset.shot;
    if (!PN_SHOT.has(f)) PN_SHOT.set(f, LOCAL.readBytes(`${LOCAL.data}patch_shots/${f}`)
      .then(b => URL.createObjectURL(new Blob([b], {type: f.endsWith(".png") ? "image/png" : "image/jpeg"}))).catch(() => ""));
    PN_SHOT.get(f).then(u => { if (u) img.src = u; else img.closest(".pn-shot")?.remove(); });
    img.onclick = () => img.classList.toggle("big");
  }
}
function pnDot() {
  const h = pnName();
  if (h) h.classList.toggle("pn-dot", !PN.open && pnUnread().length > 0);
}
async function pnLoad() {
  if (typeof LOCAL === "undefined" || !LOCAL.ready || PN.busy) return false;
  PN.busy = true;
  try {
    const d = await LOCAL.readJson(`${LOCAL.data}patch_notes.json`, null);
    PN.notes = ((d && d.notes) || []).filter(n => n && n.pub && n.id).sort((a, b) => b.id.localeCompare(a.id));
    return true;
  } catch (e) { return false; }
  finally { PN.busy = false; }
}
/* the panel's transform when it sits on the app name (scaled down onto it) */
function pnFrom(box) {
  const h = pnName(), r = h && h.getBoundingClientRect(), b = box.getBoundingClientRect();
  if (!r || !r.width || !b.width) return "translate(0,-40vh) scale(.1)";
  const s = Math.max(.05, r.width / b.width);
  return `translate(${r.left + r.width / 2 - (b.left + b.width / 2)}px,${r.top + r.height / 2 - (b.top + b.height / 2)}px) scale(${s},${Math.max(.03, r.height / b.height)})`;
}
const pnCalm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function pnShow(all) {
  if (PN.open) return;
  const unread = new Set(pnUnread().map(n => n.id));
  const list = all ? PN.notes : PN.notes.filter(n => unread.has(n.id));
  const older = all ? [] : PN.notes.filter(n => !unread.has(n.id));
  const note = (n, open) => `<details class="pn-n${unread.has(n.id) ? " new" : ""}"${open ? " open" : ""}>
    <summary><b>${esc(n.title)}</b><span>${esc(String(n.pub_at || n.at || "").slice(0, 10))}</span>${unread.has(n.id) ? '<i class="pn-new">NEW</i>' : ""}</summary>
    <div class="pn-b">${pnHtml(n.body)}</div></details>`;
  const wrap = document.createElement("div");
  wrap.className = "pn-wrap";
  wrap.innerHTML = `<div class="pn-back"></div><div class="pn-box" role="dialog" aria-modal="true" aria-label="패치노트">
    <div class="pn-head"><b>패치노트</b><button class="ib pn-x" title="닫기" aria-label="닫기">✕</button></div>
    <div class="pn-list">${list.map((n, i) => note(n, i === 0)).join("") || '<p class="pn-none">아직 패치노트가 없습니다.</p>'}
      ${older.length ? `<div class="pn-old">지난 패치노트</div>${older.map(n => note(n, false)).join("")}` : ""}</div></div>`;  // only the newest note open (user request 2026-11-18)
  document.body.appendChild(wrap);
  pnShots(wrap);
  wrap.addEventListener("toggle", () => pnShots(wrap), true);  // toggle doesn't bubble — caught on the way down
  PN.open = true; pnDot();
  const box = wrap.querySelector(".pn-box"), back = wrap.querySelector(".pn-back");
  if (!pnCalm()) {
    box.animate([{transform: pnFrom(box), opacity: .2, borderRadius: "40px"}, {transform: "none", opacity: 1, borderRadius: "14px"}],
      {duration: 420, easing: "cubic-bezier(.2,.8,.2,1)"});
    back.animate([{opacity: 0}, {opacity: 1}], {duration: 300});
  }
  const close = () => {
    if (!PN.open) return;
    PN.open = false;
    if (PN.notes[0] && PN.notes[0].id > pnSeen()) store.set("patch.seen", PN.notes[0].id);  // seen → no popup until the next note
    document.removeEventListener("keydown", esc_);
    pnDot();
    if (pnCalm()) { wrap.remove(); return; }
    box.animate([{transform: "none", opacity: 1, borderRadius: "14px"}, {transform: pnFrom(box), opacity: .15, borderRadius: "40px"}],
      {duration: 360, easing: "cubic-bezier(.55,0,.75,.2)", fill: "forwards"}).onfinish = () => wrap.remove();
    setTimeout(() => wrap.remove(), 700);  // animations pause in a hidden tab — never leave the window behind
    back.animate([{opacity: 1}, {opacity: 0}], {duration: 340, fill: "forwards"});
    const h = pnName();  // the name takes it in
    if (h) h.animate([{transform: "scale(1)"}, {transform: "scale(1.12)", offset: .85}, {transform: "scale(1)"}], {duration: 520});
  };
  const esc_ = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", esc_);
  back.onclick = close;
  wrap.querySelector(".pn-x").onclick = close;
}

/* at open (popup when unread) · later checks only light the dot */
async function pnCheck(popup) {
  if (!await pnLoad()) return;
  if (popup && pnUnread().length) pnShow(false);
  pnDot();
}
{
  const h = pnName();
  if (h) {
    h.classList.add("pn-click");
    h.title = "패치노트 보기";
    h.addEventListener("click", async () => { if (!PN.notes.length) await pnLoad(); pnShow(true); });
  }
  setInterval(() => pnCheck(false), PN_EVERY);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - (PN.last || 0) > 2 * 60 * 1000) { PN.last = Date.now(); pnCheck(false); } });
}
