/* 정보 카드 (user request 2026-11-22): SERVER mode only, in the now-playing song info only (not the song list): the
   producer · vocal names of the artist line (producers colored, vocals in their vocal chip's color) and the 프로듀서 · 보컬 ·
   태그 칩 that have a VocaDB entry.
   Hover shows the card — producer · vocal: picture, other names (e.g. 뭐든지모에화 went by many names) and their top 10
   songs in our DB by popularity, numbered, 1–10 left · 11–20 right (to look at only); tag: description, links; at its foot the hint that a click searches.
   A click on the chip opens 곡 검색 filtered to it. Phones (no hover): a tap opens the card with '검색에서 보기' at its top.
   Read from export/db/artist|tag/<id // 2000>.json.gz (수집 › 아티스트 정보 전체 · 태그 전체 — user request: keep them in
   our tables, producers and voicebanks in one table); one not stored yet is asked from VocaDB (once per visit).
   Loaded after vocadb_api.js: uses VDB.master · VDB.get · LOCAL. */
/* filter key → [card kind, master kinds searched in order]: a: artist entry · t: tag entry */
const CARD_KINDS = {composer: ["a", ["producer", "artist"]], singer: ["a", ["vocal", "artist"]], tags: ["t", ["tag"]]};
let cardIds = {of: null, maps: {}};
/* shown name → VocaDB id for a filter key ('' none) */
function cardId(fk, name) {
  if (cardIds.of !== VDB.master) cardIds = {of: VDB.master, maps: {}};
  let map = cardIds.maps[fk];
  if (!map) {
    map = cardIds.maps[fk] = new Map();
    for (const k of CARD_KINDS[fk][1]) for (const a of VDB.master[k] || []) if (a.name && !map.has(a.name)) map.set(a.name, a.id);
  }
  return map.get(name) || 0;
}
/* attributes that make a chip a card target (none in LOCAL, or when the name has no VocaDB entry) */
function cardAttrs(fk, name) {
  const id = ONLINE ? cardId(fk, name) : 0;
  return id ? ` data-cid="${id}" data-ck="${CARD_KINDS[fk][0]}" data-fk="${fk}" data-n="${esc(name)}"` : "";
}
const cardNames = (s, fk) => s.split(", ").map(n => { const a = cardAttrs(fk, n);
  return !a ? esc(shortName(n)) : fk === "singer" ? `<span class="prod voc icard" style="--vc:${esc(vocalPair(n)[1])}"${a}>${esc(shortName(n))}</span>`
    : `<span class="prod icard"${a}>${esc(shortName(n))}</span>`; }).join(", ");
/* an artist line ('프로듀서 feat. 보컬 [+N]') as html, names(list, filter key) drawing the producer · vocal names */
function artistLineHtml(it, text, names) {
  text = String(text ?? (it.artist || it.name || ""));
  const comp = String(it.composer || "");
  if (comp ? !text.startsWith(comp) : !it.singer) return esc(shortName(text));  // mp3 files: just their name
  const rest = text.slice(comp.length), m = (comp ? rest : " feat. " + rest).match(/^ feat\. (.*?)( \[\+\d+\])?$/);
  if (!m) return comp ? names(comp, "composer") + esc(shortName(rest)) : esc(shortName(text));
  return (comp ? names(comp, "composer") + " feat. " : "") + names(m[1], "singer") + esc(m[2] || "");
}
/* now-playing artist line: each known producer · vocal name marked (user request 2026-11-22: brought back next to the chips) */
const artistHtml = (it, text) => artistLineHtml(it, text, cardNames);
/* playlist · 곡 검색 rows: only the vocal names, each in its vocal color (user request 2026-11-22) — no card there */
const artistVocHtml = it => artistLineHtml(it, undefined, (s, fk) => fk !== "singer" ? esc(shortName(s))
  : s.split(", ").map(n => `<span class="vname" style="--vc:${esc(vocalPair(n)[1])}">${esc(shortName(n))}</span>`).join(", "));

const ART_TYPE_KO = {Producer: "프로듀서", Circle: "서클", Label: "레이블", OtherGroup: "그룹", Band: "밴드", Animator: "애니메이터",
  Illustrator: "일러스트레이터", Lyricist: "작사가", Instrumentalist: "연주자", Designer: "디자이너", CoverArtist: "커버 아티스트",
  OtherVocalist: "가수", OtherIndividual: "개인", Utaite: "우타이테", Vocalist: "가수", CoProducer: "공동 프로듀서", Unknown: "",
  Vocaloid: "VOCALOID", SynthesizerV: "Synthesizer V", OtherVoiceSynthesizer: "음성 합성", ACEVirtualSinger: "ACE Studio",
  NewType: "NEWTYPE", AIVOICE: "A.I.VOICE"};
const CARD_BLOCK = 2000;  // = table_export.CARD_BLOCK
const cardBlocks = new Map(), cardCache = new Map();  // "a:12" block → promise of {id: doc} · "a:<id>" → promise of the doc
const cardBlock = (k, b) => { const key = `${k}:${b}`;
  if (!cardBlocks.has(key)) cardBlocks.set(key, LOCAL.readBytes(`${LOCAL.out}/db/${k === "a" ? "artist" : "tag"}/${b}.json.gz`)
    .then(gz => new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).json()).catch(() => ({})));
  return cardBlocks.get(key); };
/* VocaDB entry → the stored doc's shape (= table_export._card_doc) */
function cardDocOf(x) {
  const pic = x.mainPicture || {}, tr = x.translatedDescription || {};
  return {n: x.name || x.defaultName || "", t: x.artistType || x.categoryName || "", a: x.additionalNames || "",
    d: String(x.description || tr.english || tr.original || "").trim().slice(0, 600), u: (x.parent || {}).name || "",
    p: pic.urlThumb || pic.urlSmallThumb || "", l: (x.webLinks || []).filter(w => !w.disabled && w.url)
      .sort((a, b) => (a.category !== "Official") - (b.category !== "Official")).map(w => [w.description || "", w.url])};
}
async function cardFetch(k, id) {
  const x = (await cardBlock(k, Math.floor(id / CARD_BLOCK)))[String(id)];
  if (x) return x;
  return cardDocOf(await (k === "a" ? VDB.get(`artists/${id}`, {fields: "AdditionalNames,Description,MainPicture,WebLinks", lang: "Default"})
    : VDB.get(`tags/${id}`, {fields: "AdditionalNames,Description,MainPicture,Parent,TranslatedDescription,WebLinks", lang: "Default"})));
}
const cardGet = (k, id) => { const key = `${k}:${id}`;
  if (!cardCache.has(key)) cardCache.set(key, cardFetch(k, id).catch(e => { cardCache.delete(key); throw e; }));
  return cardCache.get(key); };
/* 곡 검색 fresh: its 원곡만 group + this name under its filter key (프로듀서 · 보컬 · 태그), every match by popularity */
function cardSearch(fk, name) {
  cardClose();
  if ($("searchDlg").open) $("searchDlg").close();
  openSearch();
  FE.set({groups: [{x: false, c: [...F_ORIG_DEF[0].c, {k: fk, v: [name]}]}], sort: "RatingScore", from: 0, n: 0});
  FE.render();
}

/* producer · vocal card: their top songs in our DB, most popular first — shown only, no click (user request 2026-11-22;
   the whole list is 곡 검색's job), numbered in two columns (1–10 left, 11–20 right). Kept per name until the song list changes */
const CARD_SONGS = 20, CARD_COL = 10;
let cardSongMemo = {of: null, map: new Map()};
async function cardSongs(fk, name) {
  if (!VDB.done) await VDB.full;
  const all = VDB.all();
  if (cardSongMemo.of !== all) cardSongMemo = {of: all, map: new Map()};
  const key = `${fk}:${name}`;
  if (cardSongMemo.map.has(key)) return cardSongMemo.map.get(key);
  const col = fk === "composer" ? "composer" : "singer", list = fk === "composer" ? "_composers" : "_singers", out = [];
  for (let i = 0; i < all.length; i++) {
    if (!(i & 65535)) await new Promise(r => setTimeout(r));
    const it = all[i];
    if (String(it[col] || "").includes(name) && it[list].includes(name)) out.push(it);
  }
  out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const res = {n: out.length, top: out.slice(0, CARD_SONGS)};
  cardSongMemo.map.set(key, res);
  return res;
}
const cardSongsHtml = ({n, top}) => `<div class="row"><span class="k">곡 ${n.toLocaleString()}개 · 인기순${n > top.length ? ` 상위 ${top.length}곡` : ""}</span></div>`
  + (top.length ? `<div class="songs${top.length > CARD_COL ? " two" : ""}">${[top.slice(0, CARD_COL), top.slice(CARD_COL)].filter(c => c.length)
    .map((c, ci) => `<div class="scol">${c.map((it, i) => `<div class="csong"><span class="no">${ci * CARD_COL + i + 1}</span>${coverHtml(it, "thumb")}<div class="m"><div class="t">${titleHtml(it)}</div>${cardVocalsHtml(it)}</div></div>`).join("")}</div>`).join("")}</div>` : "");
/* second line of a song: its vocals, each in its vocal color (user request 2026-11-22), 4 at most + '+N' */
function cardVocalsHtml(it) {
  const vs = vocalsOf(it);
  if (!vs.length) return "";
  return `<div class="v">${vs.slice(0, 4).map(([n, c]) => `<span class="voc" style="--vc:${esc(c)}">${esc(shortName(n))}</span>`).join(", ")}${vs.length > 4 ? ` +${vs.length - 4}` : ""}</div>`;
}

/* voicebank types: their picture is often a full-body illustration — shown whole, in its own ratio (user request
   2026-11-22; characters differ in height) · producers keep the small fixed square */
const CARD_VOICE = new Set(["Vocaloid", "UTAU", "CeVIO", "SynthesizerV", "NEUTRINO", "VoiSona", "NewType", "Voiceroid", "VOICEVOX",
  "ACEVirtualSinger", "AIVOICE", "OtherVoiceSynthesizer"]);
const CARD_HINT = `<div class="chint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>클릭하면 해당 정보를 검색합니다</div>`;

function cardHtml(x, el, withSearch) {
  const {ck, cid, n: shown} = el.dataset;
  const type = ck === "a" ? ART_TYPE_KO[x.t] ?? x.t : (typeof TAG_CAT_KO !== "undefined" && TAG_CAT_KO[x.t]) || x.t;
  const other = String(x.a || "").split(",").map(s => s.trim()).filter(s => s && s !== x.n && s !== shown);
  const desc = String(x.d || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_#>]/g, "").replace(/\n-{3,}\n/g, "\n").trim();
  const links = (x.l || []).filter(([, u]) => /^https?:/i.test(u));
  const host = u => { try { return new URL(u).hostname; } catch (e) { return u; } };
  return `<div class="ctop">${x.p ? `<img class="pic${CARD_VOICE.has(x.t) ? " full" : ""}" src="${esc(x.p)}" alt="" referrerpolicy="no-referrer">` : ""}<div class="body">
    ${withSearch && ONLINE ? `<button type="button" class="csearch" data-csearch>검색에서 보기</button>` : ""}
    <div class="nm">${esc(x.n || shown)}${shown && shown !== x.n ? ` <small>${esc(shown)}</small>` : ""} <small class="ty">${esc(type || "")}</small></div>
    ${x.u ? `<div class="row"><span class="k">상위 태그</span>${esc(x.u)}</div>` : ""}
    ${other.length ? `<div class="row"><span class="k">다른 이름</span>${esc(other.join(", "))}</div>` : ""}
    ${ck === "a" ? `<div class="cslist"><div class="row k">곡 목록 불러오는 중…</div></div>` : `
    ${desc ? `<div class="row desc">${esc(desc.length > 300 ? desc.slice(0, 300) + "…" : desc)}</div>` : ""}
    ${links.length ? `<div class="row links">${links.slice(0, 14).map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t || host(u))}</a>`).join("")}</div>` : ""}
    <div class="row"><a href="https://vocadb.net/T/${cid}" target="_blank" rel="noopener">VocaDB 에서 보기</a></div>`}
    </div></div>${!withSearch && ONLINE ? CARD_HINT : ""}`;
}

let cardEl = null, cardTimer = 0;
function cardClose() { clearTimeout(cardTimer); if (cardEl) { cardEl.remove(); cardEl = null; } }
function cardPlace(p, el) {
  const f = uiZoom(), r = el.getBoundingClientRect(), w = p.offsetWidth * f, h = p.offsetHeight * f;
  const x = Math.max(4, Math.min(r.left, innerWidth - w - 4)), y = r.bottom + 4 + h <= innerHeight ? r.bottom + 4 : Math.max(4, r.top - 4 - h);
  p.style.left = x / f + "px"; p.style.top = y / f + "px";
}
async function cardOpen(el, withSearch = false) {
  if (cardEl && cardEl._from === el) return;
  cardClose();
  const p = cardEl = document.createElement("div");
  p.className = "acard"; p._from = el;
  p.innerHTML = `<div class="ctop"><div class="body"><div class="nm">${esc(el.dataset.n)}</div><div class="row k">불러오는 중…</div></div></div>`;
  document.body.appendChild(p); cardPlace(p, el);
  let html;
  try { html = cardHtml(await cardGet(el.dataset.ck, +el.dataset.cid), el, withSearch); }
  catch (e) { html = `<div class="ctop"><div class="body"><div class="nm">${esc(el.dataset.n)}</div><div class="row k">${esc(e.message)}</div></div></div>`; }
  if (cardEl !== p) return;
  p.innerHTML = html; cardPlace(p, el);
  p.querySelector("img.pic")?.addEventListener("load", e => {
    const img = e.target;
    if (img.classList.contains("full") && img.naturalWidth > img.naturalHeight) img.parentNode.classList.add("wide");
    if (cardEl === p) cardPlace(p, el);
  });
  const box = p.querySelector(".cslist");
  if (!box) return;
  let its;
  try { its = await cardSongs(el.dataset.fk, el.dataset.n); } catch (e) { its = {n: 0, top: []}; }
  if (cardEl !== p) return;
  box.innerHTML = cardSongsHtml(its); cardPlace(p, el);
}
// names become card targets only once master is read (VDB.full): redraw the now-playing song's info then (user report
// 2026-11-22: before the first play the artist line had no cards)
VDB.full.then(() => { if (typeof cur !== "undefined" && cur) { showArtist(cur); renderMeta(cur); } });
/* phones: no hover — taps (body.m = the narrow phone layout, or a touch-only screen) */
const cardTouch = () => document.body.classList.contains("m") || matchMedia("(hover: none)").matches;
// hover (not phones): opens after a short pause; stays while the pointer is on the name or the card (so its links can be clicked)
document.addEventListener("mouseover", e => {
  if (cardTouch()) return;
  const el = e.target.closest(".icard[data-cid]");
  if (el) { clearTimeout(cardTimer); if (!cardEl || cardEl._from !== el) cardTimer = setTimeout(() => cardOpen(el), 300); return; }
  if (e.target.closest(".acard")) { clearTimeout(cardTimer); return; }
  clearTimeout(cardTimer);
  if (cardEl) cardTimer = setTimeout(cardClose, 250);
});
// click: that name's songs in 곡 검색 (LOCAL has no 곡 검색 — nothing) · phones: a tap opens the card with '검색에서 보기' ·
// a click elsewhere closes the card
document.addEventListener("click", e => {
  const s = e.target.closest(".acard [data-csearch]");
  if (s) { e.stopPropagation(); const el = cardEl._from; cardSearch(el.dataset.fk, el.dataset.n); return; }
  const el = e.target.closest(".icard[data-cid]");
  if (el && cardTouch()) { e.stopPropagation(); cardEl && cardEl._from === el ? cardClose() : cardOpen(el, true); return; }
  if (el && !cardTouch() && ONLINE) { e.stopPropagation(); cardSearch(el.dataset.fk, el.dataset.n); return; }
  if (cardEl && !e.target.closest(".acard")) cardClose();
}, true);
// a scroll that moves the name closes its card — not other scrolls (user report 2026-11-22: the lyrics scroll at every line)
document.addEventListener("scroll", e => {
  if (cardEl && !cardEl.matches(":hover") && e.target.contains && e.target.contains(cardEl._from)) cardClose();
}, true);
