/* SNS 공유 카드 (user request 2026-11-18): X(트위터) · 디스코드에 링크를 붙이면 유튜브 링크처럼 큰 카드가 뜨게 —
   썸네일 위에 곡 제목 · 일본어 제목 · 프로듀서 · 엔진(보컬)을 얹은 그림, 링크를 누르면 사이버노인정에서 그 곡을 바로 재생
   (재생목록에는 넣지 않음 — player_start.js offlineOpened 가 shareTake() 로 받음).
   Both sites read the card from <meta> tags of the linked page without running JS, so every shared song needs a static page:
   the player draws the card on a canvas (1200×630) and commits s/<VocaDB id>/index.html + card.jpg to a separate public
   GitHub Pages repo. Its key is in the private data branch, Server/data/share_card.json
   {"repo": "아이디/저장소", "token": "<fine-grained token: that repo's Contents read·write only>", "branch": "main",
    "base": "https://아이디.github.io/저장소/", "player": "<player address the page sends to (default APP.publicUrl)>"}
   (same idea as listen_turn.json — players read it with their own token; the token can touch only the share repo).
   The page sends visitors on with JS (bots don't run it) to <player>#play=<id>. A card is uploaded again only when its
   content changed (csc-key, also in the card's file name card_<key>.jpg).
   Within 3 s (user request 2026-11-20: waiting ~1 min for Pages was too slow): the link is not the Pages page but the same
   file at its commit on rawcdn.githack.com (text/html, live at once, no robots.txt); the card image is read from
   raw.githubusercontent.com (image/jpeg — githack refuses images), its name new per key so no stale cache. Pages still
   publishes the same page later. */
const SHARE_V = 8;  // bump when the card drawing or its page changes (every card is made again on its next share)
const SHARE = {cfg: null};
async function shareCfg() {
  if (!SHARE.cfg) {
    const c = await LOCAL.readJson(`${LOCAL.data}share_card.json`, null).catch(() => null);
    if (!c || !c.repo || !c.token) throw new Error("공유 저장소 설정(Server/data/share_card.json)이 아직 없습니다.");
    SHARE.cfg = {branch: "main", player: APP.publicUrl, ...c};  // base (the Pages address) is no longer used for links
  }
  return SHARE.cfg;
}

/* 링크로 들어온 곡 (#play=<VocaDB id>) — 시작할 때 한 번 읽고 주소에서 지움 (새로고침해도 다시 틀지 않음) */
const SHARE_IN = (() => {
  const m = /^#play=(\d+)$/.exec(location.hash);
  if (m) history.replaceState(null, "", location.href.split("#")[0]);
  return m ? m[1] : "";
})();
let shareInUsed = false;
const shareTake = () => { if (shareInUsed) return ""; shareInUsed = true; return SHARE_IN; };

/* 카드에 쓸 글자: 제목 (플레이어가 보이는 앞 이름) · 일본어 제목 (같거나 없으면 플레이어의 다음 이름 — 발음 · 한글 제목 …) · 프로듀서 · 엔진(보컬, 3명 + 외 N명) */
function shareText(it) {
  const main = titleOf(it), seen = fold(main);
  const ja = [it.defJa ? it.def : it.ja, it.ja, ...titleNames(it).slice(1)].map(x => String(x || "").trim()).find(x => x && fold(x) !== seen) || "";
  const v = String(it.singer || "").split(",").map(x => x.trim()).filter(Boolean);
  return {title: main, ja, producer: shortName(it.composer || ""), engine: v.slice(0, 3).join(", ") + (v.length > 3 ? ` 외 ${v.length - 3}명` : "")};
}

/* 썸네일 (canvas 에 그리려면 CORS 가 필요): 유튜브 원본은 i.ytimg.com 이 허용 — 큰 것부터. 니코니코 썸네일은 허용이 없어
   images.weserv.nl (공개 이미지 중계, CORS 허용) 을 거침 */
function shareImg(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => im.naturalWidth > 120 ? res(im) : rej(new Error("작은 썸네일"));  // 유튜브: 없는 크기 = 120×90 빈 그림
    im.onerror = () => rej(new Error("썸네일을 못 받음"));
    im.src = url;
  });
}
async function shareThumb(it) {
  const yt = (it.sources || []).map(u => (/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.exec(u) || [])[1]).find(Boolean);
  const urls = yt ? [`https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`] : [];
  // 니코니코: 주소에 해시가 붙은 썸네일(…/<번호>.<해시>)만 .M (320×180) · .L (360×270) 이 있음 — 해시 없는 옛 영상은 130×100 뿐.
  // 640×360 이상은 서명 키가 붙은 주소라 브라우저에서는 못 얻음 (nvapi 가 CORS 를 막음)
  const c0 = LOCAL.coverUrl(it), cov = COVER_NEXT.get(c0) || c0, big = /nimg\.jp\/thumbnails\/\d+\/\d+\.\d+$/.test(cov || "") ? [cov + ".M", cov + ".L"] : [];
  for (const u of cov && /^https?:/.test(cov) ? [...big, cov] : []) urls.push(`https://images.weserv.nl/?url=${encodeURIComponent(u.replace(/^https?:\/\//, ""))}`);
  for (const u of urls) { try { return await shareImg(u); } catch (e) {} }
  return null;
}

const SHARE_FONT = `"Pretendard","Noto Sans KR","Noto Sans JP","Malgun Gothic","Apple SD Gothic Neo","Hiragino Sans","Yu Gothic",sans-serif`;
/* 한 줄에 다 안 들어가면 글자를 줄이고, 그래도 넘치면 lines 줄까지 나누고 끝을 … 으로 */
function shareFit(g, text, weight, max, min, width, lines) {
  for (let size = max; ; size -= 2) {
    g.font = `${weight} ${size}px ${SHARE_FONT}`;
    const out = [];
    let line = "";
    // 띄어쓰기에서 나눔 — 한 낱말이 한 줄보다 길 때만 글자 사이에서
    for (const word of text.split(/(?<= )/)) {
      if (g.measureText(line + word).width <= width) { line += word; continue; }
      if (line) { out.push(line.trimEnd()); line = ""; }
      for (const ch of [...word]) {
        if (g.measureText(line + ch).width > width && line) { out.push(line); line = ch.trimStart(); } else line += ch;
      }
    }
    if (line) out.push(line);
    if (out.length <= lines || size <= min) {
      if (out.length > lines) {
        out.length = lines;
        let l = out[lines - 1];
        while (l && g.measureText(l + "…").width > width) l = l.slice(0, -1);
        out[lines - 1] = l + "…";
      }
      return {size, lines: out};
    }
  }
}
function shareRound(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
/* 1200×630 (X · 디스코드 큰 카드 비율): 썸네일을 꽉 채우고 (작은 썸네일은 흐리게) 아래쪽을 어둡게 해서 글자를 얹음.
   blur: hide the picture — some vocaloid thumbnails are gory or lewd (공유 창 '썸네일 흐리게', user request 2026-11-18):
   only a heavily blurred background, never the sharp small thumbnail (low-res cards without blur still get it).
   ink: "white" (white words on a dark shade) or "black" (black words on a light shade); the 사이버노인정 badge outline is the word color
   (공유 창 블랙/화이트 스위치, user request 2026-11-18). img: reuse an already fetched thumbnail (the toggle redraws without fetching again) */
async function shareDraw(it, {blur = false, img, ink = "white"} = {}) {
  const W = 1200, H = 630, P = 60, t = shareText(it), dark = ink === "black";
  const sh = dark ? "255,255,255" : "0,0,0", fg = dark ? "0,0,0" : "255,255,255";  // shade · word colors as r,g,b
  if (img === undefined) img = await shareThumb(it);
  try { await document.fonts.ready; } catch (e) {}
  const cv = Object.assign(document.createElement("canvas"), {width: W, height: H}), g = cv.getContext("2d");
  g.fillStyle = "#16161d"; g.fillRect(0, 0, W, H);
  let box = null;  // the sharp small thumbnail (top right) — the title keeps off it
  if (img) {
    // blur: scaled up a little so the blur's soft edge falls outside the card
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (blur ? 1.25 : 1), w = img.naturalWidth * s, h = img.naturalHeight * s;
    const small = img.naturalWidth < 640;
    if (blur) g.filter = "blur(48px) brightness(.8)";  // strong enough that the picture can't be made out
    else if (small) g.filter = "blur(14px) brightness(.85)";  // 니코니코 작은 썸네일: 늘리면 깨져 보임 → 흐리게
    g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    g.filter = "none";
    if (small && !blur) {  // 그 위에 원래 크기의 2배로 또렷하게 (오른쪽 위)
      const k = Math.min(2, 420 / img.naturalWidth), tw = img.naturalWidth * k, th = img.naturalHeight * k, x = W - P - tw, y = P;
      g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 30; shareRound(g, x, y, tw, th, 16); g.fillStyle = "#000"; g.fill(); g.restore();
      g.save(); shareRound(g, x, y, tw, th, 16); g.clip(); g.drawImage(img, x, y, tw, th); g.restore();
      box = {x, bottom: y + th};
    }
  }
  const grad = g.createLinearGradient(0, H * .25, 0, H);
  grad.addColorStop(0, `rgba(${sh},0)`); grad.addColorStop(.45, `rgba(${sh},.55)`); grad.addColorStop(1, `rgba(${sh},.9)`);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // 아래에서부터 쌓음: 프로듀서 · 엔진 → 일본어 제목 → 제목 — 왼쪽 아래 구석 (user request 2026-11-18).
  // User 2026-11-23: X always lays its title label over the bottom-left corner (it can't be hidden — a blank
  // twitter:title falls back to og:title) → the text block sits above that label's band.
  const E = 36, XB = 92;  // 글자의 왼쪽 여백 · 아래 여백 (X 이름표 자리)
  g.textBaseline = "alphabetic"; g.shadowColor = `rgba(${sh},.6)`; g.shadowBlur = 12;
  let y = H - XB;
  const meta = [["프로듀서", t.producer], ["엔진", t.engine]].filter(([, v]) => v);
  g.font = `600 30px ${SHARE_FONT}`;
  let x = E;
  for (const [i, [label, val]] of meta.entries()) {
    g.font = `700 22px ${SHARE_FONT}`;
    const lw = g.measureText(label).width + 22;
    g.shadowBlur = 0; shareRound(g, x, y - 30, lw, 36, 18); g.fillStyle = `rgba(${fg},.18)`; g.fill();
    g.fillStyle = `rgb(${fg})`; g.fillText(label, x + 11, y - 5);
    x += lw + 12;
    g.shadowBlur = 12;
    // 앞 칸(프로듀서)은 반까지, 마지막 칸(엔진)은 이름표 앞까지
    const room = i < meta.length - 1 ? (W - E - P) / 2 - lw - 36 : W - P - x - 230;
    const v = shareFit(g, val, 600, 30, 22, Math.max(120, room), 1);
    g.fillStyle = `rgba(${fg},.95)`; g.fillText(v.lines[0], x, y);
    x += g.measureText(v.lines[0]).width + 36;
  }
  if (meta.length) y -= 58;
  if (t.ja) {
    const j = shareFit(g, t.ja, 500, 34, 24, W - E - P, 1);
    g.fillStyle = `rgba(${fg},.82)`; g.fillText(j.lines[0], E, y);
    y -= j.size + 22;
  }
  let tt = shareFit(g, t.title, 800, 72, 44, W - E - P, 2);
  if (box && y - (tt.lines.length - 1) * tt.size * 1.15 - tt.size < box.bottom + 16) tt = shareFit(g, t.title, 800, 72, 44, box.x - E - 30, 2);  // would run under it
  g.fillStyle = `rgb(${fg})`;
  tt.lines.slice().reverse().forEach(l => { g.fillText(l, E, y); y -= tt.size * 1.15; });
  // 오른쪽 아래 구석: 이름표 — 타원 배경 없이 무지개 글자 + 검은 테두리, 살짝 비침 (user request 2026-11-18: 50~80% 사이 → 65% → 조금 더 투명하게 55%)
  // 따로 그린 뒤 통째로 비치게 — 바로 비치게 그리면 검은 테두리가 글자 속으로 비쳐 탁해짐
  const mk = Object.assign(document.createElement("canvas"), {width: W, height: H}), m = mk.getContext("2d");
  m.font = `800 28px ${SHARE_FONT}`; m.textAlign = "right";
  // the note = the tab icon's beamed note (player_screen.html favicon, user request 2026-11-18), not the ♪ glyph
  const bn = "사이버노인정", bw = m.measureText(bn).width, bx = W - 28, by = H - 30;
  const ns = .5, nx = bx - bw - 10 - 56 * ns, ny = by - 26;  // icon: 64-unit box scaled to ~28 px tall, left of the name
  const n64 = new Path2D("M22 11L56 4V14L22 21Z"), note = new Path2D();
  n64.rect(22, 11, 6, 38); n64.rect(50, 4, 6, 38);
  n64.moveTo(28, 49); n64.ellipse(17, 49, 11, 8, -20 * Math.PI / 180, 0, Math.PI * 2);
  n64.moveTo(56, 42); n64.ellipse(45, 42, 11, 8, -20 * Math.PI / 180, 0, Math.PI * 2);
  note.addPath(n64, new DOMMatrix().translate(nx - 6 * ns, ny).scale(ns));
  // outline the same color as the words: 화이트 = white outline, 블랙 = black (user 2026-11-18); width 6 → 5 (4 was too thin)
  m.lineJoin = "round"; m.lineWidth = 5; m.strokeStyle = `rgb(${fg})`; m.strokeText(bn, bx, by);
  m.stroke(note);  // all outlines first, then all fills — no outline inside the note
  const rb = m.createLinearGradient(nx, 0, bx, 0);
  // 화이트 (white outline): pastel letters bled into the white edge (user 2026-11-18) → the deeper rainbow the light theme's
  // app name uses; 블랙 (black outline) keeps the pastel one
  (dark ? ["#ff6b8b", "#ffb347", "#ffe66d", "#7ee081", "#6ec6ff", "#b388ff"] : ["#e00000", "#e06a00", "#c9a400", "#009a00", "#0068d6", "#3a00d6", "#a000d6"]).forEach((c, i, a) => rb.addColorStop(i / (a.length - 1), c));
  m.fillStyle = rb; m.fillText(bn, bx, by);
  m.fill(note);
  g.save(); g.shadowBlur = 0; g.globalAlpha = dark ? .55 : .4; g.drawImage(mk, 0, 0);  // 화이트: deep rainbow stood out more than 블랙's → fainter (user 2026-11-18) g.restore();
  const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", .9));
  if (!blob) throw new Error("카드 그림을 만들지 못했습니다.");
  return {blob, text: t, thumb: !!img, img, blur: blur && !!img, ink};
}

const shareAttr = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const shareLink = (cfg, sha, id) => `https://rawcdn.githack.com/${cfg.repo}/${sha}/s/${id}/index.html`;
function sharePage(cfg, id, t, key) {
  const img = `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/s/${id}/card_${key}.jpg`, play = `${cfg.player.split("#")[0]}#play=${id}`;
  // no og:url: it would name the Pages address, which is not live yet when the link is posted
  // no description (user report 2026-11-18): 디스코드는 설명을 그림 위에 글로 또 보여 줌 — 정보는 카드 그림에만. 제목은 남김
  // (X 의 이름표 · 디스코드의 누르는 제목)
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${shareAttr(t.title)} — 사이버노인정</title>
<meta name="csc-key" content="${key}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="사이버노인정">
<meta property="og:title" content="${shareAttr(t.title)}">
<meta property="og:image" content="${shareAttr(img)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${shareAttr(t.title)}">
<meta name="twitter:image" content="${shareAttr(img)}">
<meta name="theme-color" content="#ff6b8b">
<script>location.replace(${JSON.stringify(play)});</script>
</head><body style="font-family:sans-serif;background:#16161d;color:#eee;text-align:center;padding:40px">
<p><img src="${shareAttr(img)}" alt="" style="max-width:100%;border-radius:12px"></p>
<p><a href="${shareAttr(play)}" style="color:#6ec6ff">사이버노인정에서 듣기</a></p>
</body></html>
`;
}

const shareGh = async (cfg, path, body, method = body ? "POST" : "GET") => {
  const r = await fetch(`https://api.github.com/repos/${cfg.repo}/${path}`, {method, cache: "no-store",
    headers: {Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", ...(body ? {"Content-Type": "application/json"} : {})},
    body: body ? JSON.stringify(body) : undefined});
  if (method === "GET" && r.status === 404) return null;  // the song's folder before its first card
  if (!r.ok) throw new Error(`공유 저장소 응답 ${r.status}${r.status === 401 ? " (토큰 만료?)" : r.status === 409 ? " (저장소가 비어 있음?)" : ""}`);
  return r.json();
};
/* the branch head (commit + tree in one call) and the song's folder — fetched while the card is drawn */
async function shareState(cfg, id) {
  const [h, dir] = await Promise.all([shareGh(cfg, `commits/${cfg.branch}`), shareGh(cfg, `contents/s/${id}?ref=${cfg.branch}`)]);
  if (!h) throw new Error("공유 저장소 응답 404 (저장소 · 브랜치 확인)");
  return {head: h.sha, tree: h.commit.tree.sha, files: Array.isArray(dir) ? dir.map(f => f.name) : []};
}
/* 공유 저장소에 한 커밋으로 (index.html + card_<key>.jpg, the song's older cards removed) — git data API.
   Text files go inline in the tree (no blob call). Returns the commit sha at once (the link only needs it) and `moved`,
   the branch update the card image waits for — it lands well before anyone pastes the link. */
async function shareCommit(cfg, st, files, drop, msg) {
  const tree = [...await Promise.all(files.map(async ([path, content, enc]) => enc === "utf-8" ? {path, mode: "100644", type: "blob", content}
    : {path, mode: "100644", type: "blob", sha: (await shareGh(cfg, "git/blobs", {content, encoding: enc})).sha})),
    ...drop.map(path => ({path, mode: "100644", type: "blob", sha: null}))];
  const nt = await shareGh(cfg, "git/trees", {base_tree: st.tree, tree});
  const c = await shareGh(cfg, "git/commits", {message: msg, tree: nt.sha, parents: [st.head]});
  return {sha: c.sha, moved: shareGh(cfg, `git/refs/heads/${cfg.branch}`, {sha: c.sha}, "PATCH")};
}
const shareB64 = blob => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1]); f.onerror = rej; f.readAsDataURL(blob); });
async function shareKey(s) {
  const h = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].slice(0, 6).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* 공유 창: 카드 미리보기 · [링크 복사] [X 에 올리기] (디스코드는 링크를 붙이면 카드가 뜸).
   User request 2026-11-18: the link itself is not shown; both buttons spin until the card is committed (no Pages wait). */
async function openShare(it = cur) {
  if (!it || !it.vocadb) return uiAlert(it ? "VocaDB 곡만 공유할 수 있습니다 (mp3 폴더 곡은 안 됨)." : "공유할 곡을 먼저 트세요.");
  document.querySelector("dialog.sharedlg")?.remove();
  const d = document.createElement("dialog");
  d.className = "uidlg sharedlg";
  d.innerHTML = `<div class="dlg-head">SNS 공유 카드<span class="grow"></span><button class="ib" data-a="close" title="닫기 (Esc)">✕</button></div>
    <div class="dlg-body"><div class="shimg"><span class="spin"></span></div><div class="shrow"><div class="shst">카드 만드는 중…</div><button type="button" class="onoff shink" title="카드 위 글자 색 (처음엔 화이트)"><span class="lb off">블랙</span><span class="lb on">화이트</span></button></div></div>
    <div class="dlg-foot"><span class="grow shhint">디스코드에는 링크를 붙여 넣으면 카드가 뜹니다.</span><button data-a="copy">링크 복사</button><button class="shx" data-a="x" title="X(트위터)에 올리기">X</button><span class="shsep" aria-hidden="true">|</span><label class="shblur busy" title="잔인하거나 야한 썸네일일 때 — 그림을 알아볼 수 없게 흐린 배경만 남김">흐리게<span class="shck"><input type="checkbox" disabled><span class="sendspin" aria-hidden="true"></span></span></label></div>`;
  document.body.appendChild(d);
  d.addEventListener("close", () => { d.dead = true; d.remove(); });
  const st = m => { d.querySelector(".shst").textContent = m; }, btns = [...d.querySelectorAll("button[data-a=copy],button[data-a=x]")];
  // loading = the button greyed out with a spinner over it, not beside the text (user request 2026-11-18)
  const busy = on => btns.forEach(b => { b.disabled = on; b.classList.toggle("shbusy", on); }), bb = d.querySelector(".shblur"), bc = bb.querySelector("input");
  // checkbox, not a button (user 2026-11-18: the button changed size on every toggle); while redrawing a spinner sits in its place
  const bspin = on => { bb.classList.toggle("busy", on); bc.disabled = on || !img; };
  // 글자 색 스위치 (user request 2026-11-18): always starts at 화이트
  const ib = d.querySelector(".shink");
  let link = "", title = titleOf(it), run = 0, blur = false, img, ink = "white";
  ib.classList.toggle("on", ink === "white");
  ib.addEventListener("click", () => { ink = ink === "white" ? "black" : "white"; ib.classList.toggle("on", ink === "white"); make(); });
  d.addEventListener("click", async e => {
    const b = e.target.closest("button[data-a]"), a = b?.dataset.a;
    if (a === "close") d.close();
    if (a === "copy") {
      let ok = false;
      try { await navigator.clipboard.writeText(link); ok = true; } catch (er) {
        const t = Object.assign(document.createElement("textarea"), {value: link});  // clipboard API blocked → old way
        d.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (er2) {} t.remove();
      }
      st(ok ? "링크를 복사했습니다." : "복사하지 못했습니다.");
      if (ok) { b.textContent = "복사됨 ✓"; setTimeout(() => { if (!d.dead) b.textContent = "링크 복사"; }, 1500); }
    }
    // user request 2026-11-23: reuse one X tab — a page can only reuse a tab it opened itself (named target), never the
    // user's own X tab. No "noopener" (that always opens a new tab); the opener link is cut by hand instead.
    if (a === "x") { const w = window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(link)}`, "csc_x"); if (w) { try { w.opener = null; } catch (e) {} w.focus(); } }
  });
  bc.addEventListener("change", () => { blur = bc.checked; make(); });  // the link follows the picked look: redraw + upload again
  // one run = (draw ∥ read the share repo) → preview → one commit → link; a newer run (blur · ink toggle) makes the older one stop quietly
  async function make() {
    const my = ++run, gone = () => d.dead || my !== run, id = it.vocadb;
    link = ""; busy(true); bspin(true);
    const pre = shareCfg().then(async cfg => ({cfg, st: await shareState(cfg, id)}));
    pre.catch(() => {});  // its error is shown after the preview
    try {
      // the card first, so the preview shows even when the share settings are missing (user report 2026-11-18: 미리보기 안 됨)
      const card = await shareDraw(it, {blur, img, ink});
      if (gone()) return;
      img = card.img;
      // tweet text (user request 2026-11-23): 제목 — 프로듀서 feat. 가수들
      const {producer: pr, engine: en} = card.text, by = [pr, en && `feat. ${en}`].filter(Boolean).join(" ");
      title = by ? `${card.text.title} — ${by}` : card.text.title;
      bspin(false);
      d.querySelector(".shimg").innerHTML = `<img alt="" src="${URL.createObjectURL(card.blob)}">`;
      st(card.thumb ? "링크 만드는 중…" : "썸네일을 받지 못해 글자만 있는 카드입니다. 링크 만드는 중…");
      const {cfg, st: rs} = await pre;
      const key = await shareKey(JSON.stringify([SHARE_V, card.text, card.thumb, card.blur, card.ink, cfg.player]));
      const ready = (sha, m) => { if (gone()) return; link = shareLink(cfg, sha, id); busy(false); st(m); };
      const jpg = `card_${key}.jpg`;
      if (rs.files.includes(jpg)) return ready(rs.head, "이미 만들어 둔 카드입니다. 링크를 붙여 넣으면 카드가 뜹니다.");
      if (gone()) return;
      const drop = rs.files.filter(f => /^card.*\.jpg$/.test(f)).map(f => `s/${id}/${f}`);
      const c = await shareCommit(cfg, rs, [[`s/${id}/index.html`, sharePage(cfg, id, card.text, key), "utf-8"],
        [`s/${id}/${jpg}`, await shareB64(card.blob), "base64"]], drop, `share ${id}: ${card.text.title}`.slice(0, 120));
      ready(c.sha, "카드가 준비됐습니다. 링크를 붙여 넣으면 카드가 뜹니다.");
      await c.moved;  // failed (someone else's share moved the branch first) → the image would 404: take the link back
    } catch (e) {
      if (gone()) return;
      if (!d.querySelector(".shimg img")) d.querySelector(".shimg").textContent = "";
      link = "";
      btns.forEach(b => { b.disabled = true; b.classList.remove("shbusy"); });  // stay disabled: no link
      bspin(false);
      st(e.message);
    }
  }
  d.showModal();
  make();
}
$("btnShare").onclick = () => openShare();
