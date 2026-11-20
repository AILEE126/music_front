/* 플레이어 재생기 (서버 없이 연 플레이어 — player_screen.js 가 makePlayer 로 만듦)
   · 온라인 곡: 중계 페이지(WEB\tools\stream_bridge\index.html 을 GitHub Pages 에 올린 것)의 니코니코·유튜브 플레이어
     (파일로 연 화면은 주소가 없어 유튜브(오류 153)·니코니코 퍼가기 플레이어가 거부함 → https 주소인 중계 페이지를 거침)
   · 오프라인 곡: 고른 mp3 폴더의 mp3 (offline_folder.js)
   makePlayer(audio): 곡 바꾸기 · 대기열(play_queue.js) · 가사(위 막대·오버레이용) · 가사 먼저 보이기 · 못 튼 곡 창·오류 신고 ·
   가사 오버레이 알림 · 영상 칸(placeVideo) 을 한곳에 */
const BRIDGE_URL = store.get("bridgeUrl", "") || "https://ailee126.github.io/music-bridge/";  // 시험할 때만 브라우저 저장값 player.bridgeUrl 로 다른 주소
/* 영상 주소 → {kind: yt|nico|sc|vimeo|bili|file, id, url}
   sc · vimeo · bili · file (user request 2026-11-18): the song's other links (SoundCloud · Vimeo · Bilibili · an mp3 file on
   VocaDB) play too, after Niconico/YouTube — for songs whose original was deleted. Bandcamp · Piapro have no player to drive. */
function vidRef(url) {
  url = url || "";
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return {kind: "yt", id: m[1], url};
  m = url.match(/(?:nicovideo\.jp\/watch\/|nico\.ms\/)((?:sm|nm|so)\d+)/);
  if (m) return {kind: "nico", id: m[1], url};
  m = url.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([\w-]+\/[\w-]+)(?:[?#]|$)/);
  if (m) return {kind: "sc", id: "https://soundcloud.com/" + m[1], url};
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return {kind: "vimeo", id: m[1], url};
  m = url.match(/bilibili\.com\/video\/(av\d+|BV\w{10})/i);
  if (m) return {kind: "bili", id: m[1], url};
  // https only: the bridge page is https (an http file would be blocked as mixed content)
  return /^https:\/\/[^?#]+\.(?:mp3|m4a|ogg|opus|wav)(?:[?#]|$)/i.test(url) ? {kind: "file", id: url, url} : null;
}
/* 온라인 곡 출처 차례: 직접 연결한 영상 → 곡의 영상 차례 (니코니코 → 유튜브 → 그 밖 — vocadb_api.js 가 그 차례로 둠).
   vocadb · secs: Bilibili needs the song's length — ours first (secs), else VocaDB's API (LocalMedia.biliLength) */
const streamRefs = it => [...new Set([it.video_link, ...(it.sources || [])].filter(Boolean))].map(vidRef).filter(Boolean)
  .map(r => it.vocadb ? {...r, vocadb: it.vocadb, secs: +it.secs || 0} : r);
/* 틀 수 있는 곡: 오프라인 곡(고른 mp3 폴더) · 원곡 영상 주소가 있는 온라인 곡 (삭제된 곡 표시는 2026-11-20 없앰) */
const canPlay = it => !!it && (it.site === "local" || (it.site === "stream" && (it._pn ?? streamRefs(it).length) > 0));  // _pn: playable links, counted once (search_dialog.js playableFast)

/* Diagnostic log (user: songs stop while another tab is in front — record what happened while hidden, read it after coming back).
   Last 400 lines kept in this browser (survives reload); playerDiag() in the console or a stall report attaches it. */
const DIAG = store.get("diag", []);
let diagSave = 0;
function diag(...a) {
  const hms = nowText().slice(5);  // MM-DD HH:MM:SS
  DIAG.push(`${hms} ${document.hidden ? "H" : "V"} ${a.join(" ")}`);
  if (DIAG.length > 400) DIAG.splice(0, DIAG.length - 400);
  clearTimeout(diagSave); diagSave = setTimeout(() => store.set("diag", DIAG), 500);
}
window.playerDiag = () => [navigator.userAgent, ...DIAG].join("\n");
document.addEventListener("visibilitychange", () => diag("visibility", document.visibilityState));

let bridgeSeq = 0;
/* 니코니코 댓글(弾幕) 켜기/끄기 — 플레이어의 💬 댓글 버튼 (기본 켬, 브라우저에 기억) */
const nicoComments = () => store.get("nicoComments", true);
/* 니코니코 재생수: 재생 중인 중계 페이지가 알려 주거나(ready), 안 보이는 중계 페이지를 정보만 받게 띄움(info=1) — 이번에 연 동안만 기억 (10분) */
const NICO_VIEWS = new Map(), NICO_WAIT = new Map();
function gotNicoViews(id, v) {
  if (v == null) return;
  NICO_VIEWS.set(id, {v: +v, at: Date.now()});
  (NICO_WAIT.get(id) || []).forEach(f => f(+v)); NICO_WAIT.delete(id);
}
function nicoViews(id) {
  const c = NICO_VIEWS.get(id);
  if (c && Date.now() - c.at < 600000) return Promise.resolve(c.v);
  return new Promise(res => {
    const first = !NICO_WAIT.has(id);
    NICO_WAIT.set(id, [...(NICO_WAIT.get(id) || []), res]);
    if (!first) return;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:180px;border:0";
    f.allow = "autoplay";
    f.src = `${BRIDGE_URL}?nico=${encodeURIComponent(id)}&info=1&mute=1`;
    const done = v => { removeEventListener("message", on); clearTimeout(t); f.remove(); if (v == null) { (NICO_WAIT.get(id) || []).forEach(g => g(null)); NICO_WAIT.delete(id); } else gotNicoViews(id, v); };
    const on = e => { if (e.source === f.contentWindow && e.data && e.data.bridge && (e.data.ev === "info" || e.data.ev === "error")) done(e.data.views ?? null); };
    const t = setTimeout(() => done(null), 20000);  // 중계 페이지가 예전 판(info 모름)이거나 인터넷이 안 됨
    addEventListener("message", on);
    document.body.appendChild(f);
  });
}
/* 중계 페이지 하나 = 플레이어 하나. on(메시지): ready · state(s: playing|paused|ended|buffering) · time · error */
class BridgePlayer {
  constructor(host, ref, {start = 0, mute = false, volume = 1, rate = 1, guide = false, vs = false, on = () => {}} = {}) {
    this.id = "b" + ++bridgeSeq; this.t = start; this.at = this.heard = performance.now(); this.d = 0; this.state = "buffering"; this.ready = false;
    this.r = rate;  // 배속 (time() runs at it)
    this.ref = ref; this.on = on;  // on: 메시지 받는 곳 (미리 띄워 둔 플레이어를 넘겨받으면 바뀜)
    const f = this.frame = document.createElement("iframe");
    f.allow = "autoplay; encrypted-media; fullscreen";
    f.src = `${BRIDGE_URL}?${ref.kind}=${encodeURIComponent(ref.id)}&id=${this.id}&start=${Math.floor(start)}${mute ? "&mute=1" : ""}&vol=${Math.round(volume * 100)}${nicoComments() ? "" : "&cmt=0"}${ref.len ? "&len=" + ref.len : ""}${guide ? "&guide=1" : ""}${vs ? "&vs=1" : ""}${rate !== 1 ? "&rate=" + rate : ""}`;
    // 유튜브 플레이어는 칸이 접혀(1px) 안 보이면 재생 상태(state)를 알려 주지 않음 → 시간이 흐르는지로 재생·멈춤·끝을 셈
    const guess = s => { if (this.state === s) return; this.state = s; if (s === "playing") this.played = true; this.on({ev: "state", s}); };
    let still = 0;
    this.onMsg = e => {
      if (e.source !== f.contentWindow || !e.data || !e.data.bridge) return;
      const m = e.data;
      this.heard = performance.now();  // the frame still answers (LocalMedia.watch)
      this.ver = +m.ver || 1;  // bridge page version (2+: can "load" another YouTube song — older deployed page cannot · 4: rate, ext)
      if (m.ev === "ext") return extSeen(m.v);  // the extension in this browser (bridge page 4+)
      if (m.ev === "loud") return gotLoud(m);  // what the extension measured for this video
      if (this.loopAt && performance.now() - this.loopAt < 1000 && (m.ev === "time" || m.ev === "state")) return;  // the loop's own paused/playing/time
      if (m.ev === "time") {
        const t = +m.t || 0, now = performance.now(), moved = Math.abs(t - this.t) > 0.01;
        if (+m.d) this.d = +m.d;
        // User report: 폿핏포 (Niconico sm5508956) repeated forever — that embed jumps from its last second back to 0 by itself
        // and never sends "ended". A jump from the end to the start we didn't ask for (seek sets this.t first) = ended.
        if (this.state === "playing" && this.d && this.t >= this.d - 3 && t < 3) {
          this.t = t; this.at = now; this.loopAt = now; this.pause();
          return guess("ended");
        }
        if (moved) { still = 0; if (t > this.t && this.state !== "playing" && this.ready) { this.t = t; this.at = now; guess("playing"); } }
        else if (!still) still = now;
        else if (this.state === "playing" && now - still > 1500) guess(this.d && t >= this.d - 1.5 ? "ended" : "paused");
        this.t = t; this.at = now;
        return this.on(m);
      }
      else if (m.ev === "state") { this.t = this.time(); this.at = performance.now(); this.state = m.s; if (m.s === "playing") this.played = true; }
      else if (m.ev === "ready") {
        if (m.vid && m.vid !== this.ref.id) return;  // late message of the song before a "load"
        this.ready = true; clearTimeout(this.timer); if (+m.d) this.d = +m.d; if (this.ref.kind === "nico") gotNicoViews(this.ref.id, m.views);
      }
      this.on(m);
    };
    addEventListener("message", this.onMsg);
    host.appendChild(f);
    this.arm();
  }
  arm() {  // 중계 페이지·플레이어가 안 뜸 (인터넷 등)
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.ready) return;
      // test (hidden tab): a reused YouTube player played the next song but its "ready" never came → playing counts as ready
      if (this.state === "playing") { this.ready = true; return this.on({ev: "ready", d: this.d}); }
      this.on({ev: "error", code: "timeout"});
    }, 20000);
  }
  /* Another song of the same kind in this same player (bridge cmd "load" — YouTube: ver 2+, Niconico: ver 3+).
     Chrome/Whale defer media in frames created while the tab is hidden, a reused one goes on. */
  load(ref, start = 0, play = true) {
    this.ref = ref; this.t = start; this.at = performance.now(); this.d = 0; this.state = "buffering"; this.ready = false;
    this.arm();
    this.cmd("load", {[ref.kind]: ref.id, start, play});
  }
  canLoad(kind) { return this.ref.kind === kind && this.ver >= ({nico: 3, yt: 2}[kind] || Infinity); }  // other kinds: a new frame per song
  cmd(cmd, v) { try { this.frame.contentWindow.postMessage({cmd, v}, "*"); } catch (e) {} }
  time() { return this.state === "playing" ? this.t + (performance.now() - this.at) / 1000 * this.r : this.t; }  // 0.25초마다 받는 시간 사이를 메움
  rate(r) { if (r === this.r) return; this.t = this.time(); this.at = performance.now(); this.r = r; this.cmd("rate", r); }
  fx(o) { const k = JSON.stringify(o); if (k !== this.fxSent) { this.fxSent = k; this.cmd("fx", o); } }  // 키 · 소리 크기 (player_ext_media.js)
  play() { this.cmd("play"); }
  pause() { this.cmd("pause"); }
  seek(t) { this.t = t; this.at = performance.now(); this.cmd("seek", t); }
  volume(v) { this.cmd("volume", Math.round(v * 100)); }
  mute(on) { this.cmd("mute", on); }
  comments(on) { if (this.ref.kind === "nico") this.cmd("comments", on); }
  guide(on) { this.cmd("guide", on); }
  destroy() { clearTimeout(this.timer); removeEventListener("message", this.onMsg); this.frame.remove(); }
}
/* 중계 플레이어가 알려 준 오류 → 못 튼 까닭 (자동 오류 신고에 남길 글) */
function bridgeReason(code) {
  if (code === 100) return "원곡 영상이 삭제·비공개입니다";
  if (code === 101 || code === 150) return "원곡 영상이 퍼가기 금지라 이 화면에서 재생할 수 없습니다";
  if (code === 2 || code === 5) return "유튜브 플레이어가 영상을 열지 못했습니다";
  if (code === "timeout" || code === "api") return "중계 페이지·플레이어가 뜨지 않았습니다 — 인터넷 연결을 확인하세요 (잠시 뒤 다시)";
  if (code === "no-video") return "원곡 영상 주소가 없습니다";
  if (code === "no-length") return "비리비리 영상의 길이를 몰라 재생할 수 없습니다";
  if (code === "sc" || code === "vimeo" || code === "file") return `${{sc: "SoundCloud", vimeo: "Vimeo", file: "음원 파일"}[code]} 을 열지 못했습니다 — 삭제·비공개이거나 막힘`;
  return `니코니코 플레이어 오류 (${code}) — 삭제·비공개이거나 잠시 재생이 막힘`;
}
/* 소리 크기 per platform (user request 2026-11-18 — no measuring per video). Both platforms level each video themselves:
   YouTube turns loud videos down to -14 LUFS, Niconico to about -15 (watch API audios[].loudnessCollection 'video', e.g.
   직소 퍼즐 -4.3 → ×0.29). So no extra cut here — the old cut came on top of theirs (직소 퍼즐 sounded far too quiet).
   What differs is the volume knob: YouTube uses it as it is (media volume = v × its loudness factor), Niconico's embed bends
   it — out = c(80·v + 20) / c(100), c(x) = 0.6838x³ − 1.7262x² + 2.4252x (its player script), ~-7 dB at 0.7 instead
   of -3. platformVolume sends the value whose Niconico output equals the slider, so the slider means the same on both. */
const nicoCurve = v => {
  if (v <= 0) return 0;
  const c = x => 0.6838 * x ** 3 - 1.7262 * x ** 2 + 2.4252 * x;
  return Math.max(0.01, c(80 * Math.min(v, 1) + 20) / c(100));
};
/* SoundCloud · Vimeo · a plain file (user request 2026-11-18): nobody levels them and their knob is linear. Songs are mastered
   around -8 LUFS (YouTube's own stats on loud songs: 'cont.-5.9dB' to reach -14) → a fixed -6 dB brings them near the other two.
   Bilibili: unleveled too (its loudness leveling is off in the embed) and linear (player.setVolume = media volume, checked
   2026-11-18) — it takes the volume only through the user script below. */
const UNLEVELED = 0.5;
function platformVolume(kind, v) {
  if (kind === "sc" || kind === "vimeo" || kind === "file" || kind === "bili") return Math.max(0, Math.min(1, v)) * UNLEVELED;
  if (kind !== "nico" || v <= 0 || v >= 1) return Math.max(0, Math.min(1, v));
  let lo = 0, hi = 1;  // nicoCurve rises with v → bisect for the value Niconico turns into v
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (nicoCurve(m) < v) lo = m; else hi = m; }
  return hi;
}

/* 음원 플레이어 확장 (user request 2026-11-18 Bilibili volume · 2026-11-19 one extension for every player: 배속 · 볼륨 ·
   키 변경 · 소리 크기 맞추기 · YouTube ads). Embeds take no speed / key / volume (Bilibili) from a page, so a tiny extension
   the user loads unpacked (developer mode — no store, no Tampermonkey) does it inside their frames. Its one script is
   js/player_ext_media.js (mpxMedia — the phone app injects the same file into the same frames); setupZip() builds the zip
   right here from it, so it always matches this code. The old bili-volume extension (v1) still answers biliVol only. */
const EXT_VER = window.MPX_VER || 0;
const EXT_ORIGINS = ["https://embed.nicovideo.jp/*", "https://www.youtube-nocookie.com/*", "https://www.youtube.com/*", "https://player.bilibili.com/*",
  "https://w.soundcloud.com/*", "https://player.vimeo.com/*", "https://ailee126.github.io/music-bridge/*", "http://127.0.0.1/tools/stream_bridge/*"];  // 127.0.0.1: the bridge under test
const EXT_MANIFEST = JSON.stringify({
  manifest_version: 3, name: "음원 플레이어 확장", version: EXT_VER + ".0",
  description: "음원 플레이어의 배속 · 키 변경 · 소리 크기 맞추기 · 볼륨이 니코니코 · 유튜브 · 비리비리 · SoundCloud · Vimeo 영상에도 적용되게 합니다 (유튜브 · 니코니코 · 비리비리 광고 없애기 포함)",
  content_scripts: [{matches: EXT_ORIGINS, js: ["media.js"], all_frames: true, run_at: "document_start", world: "MAIN"}],
}, null, 2);
/* 추가기능 파일 (user request 2026-11-19): ONE zip for both PC add-ons — folder 오버레이/ (tools/lyrics_overlay.bat + .ps1)
   and folder 추가기능 활성화 확장프로그램/ (manifest.json + media.js). Both guides (오버레이 button · 배속/키/비리비리) hand out
   the same zip and walk through both. The overlay files are read from this player's own tools/ folder (same origin), so
   the zip always matches this code; a page that can't read them (opened as a file) gets the extension only. */
const EXT_DIR = "추가기능 활성화 확장프로그램", OV_DIR = "오버레이", SETUP_ZIP = "음원 플레이어 추가기능.zip";
const OV_FILES = ["lyrics_overlay.bat", "lyrics_overlay.ps1"], OV_SRC = {};
async function ovFiles() {
  for (const f of OV_FILES) if (!OV_SRC[f]) {
    const r = await fetch(new URL("../tools/" + f, location.href), {cache: "no-cache"});
    if (!r.ok) throw new Error(f + " " + r.status);
    OV_SRC[f] = new Uint8Array(await r.arrayBuffer());
  }
  return OV_FILES.map(f => [OV_DIR + "/" + f, OV_SRC[f]]);
}
/* the overlay version of those files ($OV_VER in the ps1 — bump it with every overlay change; the running overlay answers
   its own in /ovprograms `ver`) → 0 when they can't be read */
async function ovLatest() {
  try { return +((/\$OV_VER\s*=\s*(\d+)/.exec(new TextDecoder().decode((await ovFiles())[1][1])) || [])[1]) || 0; } catch (e) { return 0; }
}
/* stored (no compression) zip of [[path, text | bytes]] */
function zipBlob(files) {
  const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = d => { let c = -1; for (const x of d) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const enc = new TextEncoder(), parts = [], dir = [];
  let off = 0;
  for (const [name, body] of files) {
    const n = enc.encode(name), d = typeof body === "string" ? enc.encode(body) : body, c = crc(d);
    const head = (sig, extra) => { const h = new DataView(new ArrayBuffer(extra)); h.setUint32(0, sig, true); return h; };
    const l = head(0x04034b50, 30);  // local header: version 20, flag 0x800 (UTF-8 names), stored
    l.setUint16(4, 20, true); l.setUint16(6, 0x800, true); l.setUint32(14, c, true); l.setUint32(18, d.length, true); l.setUint32(22, d.length, true); l.setUint16(26, n.length, true);
    const g = head(0x02014b50, 46);  // central directory entry
    g.setUint16(4, 20, true); g.setUint16(6, 20, true); g.setUint16(8, 0x800, true); g.setUint32(16, c, true); g.setUint32(20, d.length, true); g.setUint32(24, d.length, true);
    g.setUint16(28, n.length, true); g.setUint32(42, off, true);
    parts.push(l, n, d); dir.push(g, n);
    off += 30 + n.length + d.length;
  }
  const size = dir.reduce((a, x) => a + x.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...dir, e], {type: "application/zip"});
}
/* → {blob, ov: overlay files in it} */
async function setupZip() {
  const files = [[EXT_DIR + "/manifest.json", EXT_MANIFEST], [EXT_DIR + "/media.js", `// 음원 플레이어 확장 — music_front js/player_ext_media.js
(${mpxMedia})();
`]];
  let ov = false;
  if (OV_PC()) try { files.push(...await ovFiles()); ov = true; } catch (e) { console.warn("오버레이 파일을 못 읽음", e); }
  return {blob: zipBlob(files), ov};
}

/* phone / tablet: no extensions to load there — the guide only says so */
const BILI_TOUCH = () => matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
/* the PC overlay program is Windows only (PowerShell) and not for the phone app (it has its own floating lyrics) */
const OV_PC = () => !APP.on && !BILI_TOUCH() && /Windows/.test(navigator.userAgent);

/* the extension in this browser: its version as the last bridge page told it (0 = none; kept in the browser so the
   buttons are right before the first song). extChange fires on window when it changes. */
const EXT = {ver: +store.get("extVer", 0) || 0};
function extSeen(v) {
  v = +v || 0;
  if (v === EXT.ver) return;
  EXT.ver = v; store.set("extVer", v);
  dispatchEvent(new Event("extchange"));
}
/* ask a hidden bridge page now (guide's 다 했어요) → resolves the version (0: none, or an old bridge page that can't tell) */
function extProbe() {
  return new Promise(res => {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:10px;height:10px;border:0";
    f.src = `${BRIDGE_URL}?probe=1&id=probe`;
    const done = v => { removeEventListener("message", on); clearTimeout(t); f.remove(); if (v != null) extSeen(v); res(EXT.ver); };
    const on = e => { if (e.source === f.contentWindow && e.data && e.data.bridge && e.data.ev === "ext") done(e.data.v); };
    const t = setTimeout(() => done(null), 10000);
    addEventListener("message", on);
    document.body.appendChild(f);
  });
}
/* 배속 (user request 2026-11-19): YouTube · a file · our mp3 take it themselves; the other players only through the extension */
const RATE_SELF = new Set(["", "yt", "file"]);
const rateNeedsExt = kind => !RATE_SELF.has(kind || "");
/* 같이듣기 · OPEN CHANNEL: everyone at 1× (the room keeps listeners at the same second) */
const rateLocked = () => typeof LT !== "undefined" && !!LT.role;
/* 키 변경 · 소리 크기 맞추기 (user request 2026-11-19, player_ext_media.js): online songs need the extension / app
   (version 3), a plain file link can't (its host gives no CORS — Web Audio would hear silence), our mp3 works in the page */
function fxBlock(kind) {
  if (!kind) return window.mpxAudioFor ? "" : "ext";
  if (kind === "file") return "file";
  return EXT.ver >= 3 ? "" : BILI_TOUCH() ? "touch" : "ext";
}
const levelOn = () => true;  // 소리 크기 맞추기: always on where the extension / app can (user request 2026-11-19 — the switch was removed)
/* measured loudness per video (LUFS — what the extension sent; the next play starts at the right level) */
const LOUD = store.get("loud", {}) || {};
function gotLoud(m) {
  if (!m.key || !isFinite(+m.lufs)) return;
  const old = LOUD[m.key];
  if (old && old[1] > +m.secs) return;  // keep the longer measure
  delete LOUD[m.key]; LOUD[m.key] = [+m.lufs, +m.secs || 0];
  const keys = Object.keys(LOUD); if (keys.length > 3000) keys.slice(0, keys.length - 3000).forEach(k => delete LOUD[k]);
  store.set("loud", LOUD);
}
/* 페이드 인 · 아웃 (user request 2026-11-19): seconds at a song's start / end, 0 = off — settings ⚙ › 재생 */
const fadeSecs = () => ({fin: Math.max(0, +store.get("fadeIn", 0) || 0), fout: Math.max(0, +store.get("fadeOut", 0) || 0)});

/* Bilibili video length in seconds (0 = unknown): VocaDB API (CORS ok — bilibili's own API is not) → that PV's length,
   else the song's. Kept per video while the page is open */
const BILI_LEN = new Map();
async function biliLength(ref) {
  if (BILI_LEN.has(ref.id)) return BILI_LEN.get(ref.id);
  // our song list knows the length (user report 2026-11-19: with VocaDB's API down the song failed after a long wait) —
  // the API only for a song without it, and given 8 s at most
  if (ref.secs) return ref.secs;
  let n = 0;
  try {
    if (ref.vocadb && typeof VDB !== "undefined") {
      const s = await Promise.race([VDB.get(`songs/${ref.vocadb}`, {fields: "PVs"}), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 8000))]);
      const pv = (s.pvs || []).find(p => p.service === "Bilibili" && String(p.url || "").toLowerCase().includes(ref.id.toLowerCase()));
      n = +(pv && pv.length) || +s.lengthSeconds || 0;
    }
  } catch (e) { return 0; }  // offline etc. — asked again next time
  BILI_LEN.set(ref.id, n);
  return n;
}

/* 재생기 하나로 보이게: mp3 는 <audio>, 온라인 곡은 중계 페이지 — 화면은 이것만 봄 (audio 와 같은 이름·이벤트)
   host: 중계 플레이어를 띄울 칸 (makePlayer 가 만든 #streamHost — 화면의 영상 칸 위로 옮겨 보임) */
class LocalMedia extends EventTarget {
  constructor(el, host) {
    super();
    this.el = el; this.host = host; this.br = null; this.refs = null; this.brPaused = true; this.brErr = null; this.errs = [];
    this.kept = {yt: null, nico: null};  // kept bridge player per kind (see tryRef)
    // volume = the slider's (uv); what plays = uv × gain (페이드 — fadeTick). el.volume of our mp3 carries the gain too,
    // so el's own volumechange counts only for mute
    this.uv = 1; this.gain = 1; this.wasMuted = el.muted;
    for (const ev of ["play", "pause", "playing", "ended", "seeked", "loadedmetadata", "error", "waiting", "emptied", "timeupdate"])
      el.addEventListener(ev, () => { if (!this.refs) this.fire(ev); });
    el.addEventListener("volumechange", () => { if (el.muted === this.wasMuted) return; this.wasMuted = el.muted; this.applyVolume(); this.fire("volumechange"); });
    for (const ev of ["play", "playing", "seeked", "loadedmetadata"]) this.addEventListener(ev, () => this.fadeTick());
    this.addEventListener("pause", () => clearTimeout(this.fadeT));
    addEventListener("extchange", () => this.applyFx());  // the extension / app script just showed up → key · 소리 크기 now
    setInterval(() => this.watch(), 1000);
    // back in sight: the frame's timers were slowed meanwhile — give it a moment before watch() counts its silence
    const grace = () => { if (this.br) this.br.heard = performance.now(); };
    document.addEventListener("visibilitychange", grace);
    addEventListener("appscreen", grace);
  }
  fire(ev) { this.dispatchEvent(new Event(ev)); }
  get bridged() { return !!this.refs; }
  /* mp3 */
  setSrc(src) { this.stopStream(); this.fadeStart(0); this.applyVolume(); this.el.src = src; this.applyRate(); }
  /* 다음 곡 미리 띄워 두기: 그 곡 첫 출처의 중계 플레이어를 소리 없이 띄워 멈춰 둠 (안 보이게 지금 플레이어 뒤에) →
     그 곡 차례가 되면 새로 띄우지 않고 넘겨받아 바로 틂. 미리 띄운 출처가 안 되면(삭제 등) 그 곡 차례에 다음 출처부터 보통대로 */
  preload(refs) {
    const ref = refs && refs[0];
    if (this.pre && ref && this.pre.br.ref.url === ref.url) return;  // 이미 띄워 둠
    this.dropPreload();
    // YouTube: no preload — the one kept YouTube player loads the next song itself (see tryRef).
    // Niconico: only while shown — a frame created while the tab is hidden stays silent; then the kept Niconico player loads it.
    // Other kinds (SoundCloud · Bilibili …): no preload — they are fallbacks, rarely next.
    if (!ref || ref.kind !== "nico" || document.hidden || (this.br && this.br.ref.url === ref.url)) return;
    const pre = this.pre = {failed: false};
    pre.br = new BridgePlayer(this.host, ref, {mute: true, volume: 0, on: m => {
      // let it really start (muted) before pausing: a frame that has played can go on in a hidden tab
      if (m.ev === "state" && m.s === "playing") pre.br.pause();  // 띄워 두기만 (중계 페이지는 곧바로 틂)
      else if (m.ev === "error") pre.failed = true;
    }});
    pre.br.frame.classList.add("pre");
  }
  dropPreload() { if (this.pre) this.pre.br.destroy(); this.pre = null; }
  /* Make the kept player of a kind while the tab is shown (muted, plays a moment then pauses, parked behind) —
     test: Whale with another tab in front, the first YouTube song after Niconico songs needed a new frame and stayed silent
     until the tab was shown. With one ready per kind, songs while hidden only reuse (load) it. */
  warm(ref) {
    if (!ref || document.hidden || this.kept[ref.kind]) return;
    const br = new BridgePlayer(this.host, ref, {mute: true, volume: 0, on: m => {
      if (m.ev === "state" && m.s === "playing") br.pause();
      else if (m.ev === "error" && this.kept[ref.kind] === br && br !== this.br) { this.kept[ref.kind] = null; br.destroy(); }
    }});
    br.frame.classList.add("pre");
    this.kept[ref.kind] = br;
    diag("warm", ref.kind + ":" + ref.id);
  }
  /* 온라인 곡: 출처 차례대로 — 안 되는 출처(삭제·퍼가기 금지)는 다음으로 */
  async playStream(refs, autoplay, start = 0) {  // start: seconds (resume after a reload)
    // User report: songs stop while the player isn't watched. Chrome/Edge defer media in a frame created while the tab is hidden
    // (minimized, behind other windows, other tab) until it is shown → every Niconico song needs a new frame and waits.
    // Source order stays Niconico first (user decision) — never swapped to YouTube for being hidden.
    const pre = this.pre && refs[0] && this.pre.br.ref.url === refs[0].url && !this.pre.failed ? this.pre : null;
    if (pre) this.pre = null; else this.dropPreload();  // 미리 띄워 둔 곡이 아니면 버림
    this.stopStream();
    this.refs = refs; this.ri = -1; this.brErr = null; this.errs = []; this.brPaused = true; this.autoplay = autoplay; this.start = start;
    this.fadeStart(start);
    // Loaded without playing = primed: it starts muted, and once it really plays it pauses back at the start → ready.
    // A frame that never played may stay silent in a hidden tab (see preload), and a play() sent before the bridge is ready
    // is lost — user report: listen together's start-together left both players stuck at 0.
    this.priming = !autoplay;
    this.el.pause(); this.el.removeAttribute("src"); this.el.load();
    this.fire("emptied");
    if (this.refs !== refs) { if (pre) pre.br.destroy(); return; }  // 그사이 다른 곡
    this.tryRef(0, pre && pre.br);
  }
  /* i 번째 출처로 틀기 (got: 미리 띄워 둔 그 출처의 중계 플레이어 — 넘겨받아 소리를 켜고 처음부터) */
  tryRef(i, got = null) {
    this.release(this.br); this.br = null;
    const ref = this.refs[i], refs = this.refs;
    if (!ref) { this.brErr = {code: 4, reason: this.reason()}; this.brPaused = true; return this.fire("error"); }  // 출처가 모두 안 됨
    if (ref.kind === "bili" && ref.len === undefined) {  // its player tells no time — the bridge counts it up to the length
      biliLength(ref).then(n => { ref.len = n; if (this.refs !== refs) return; if (n) this.tryRef(i, got); else { this.errs.push("no-length"); this.tryRef(i + 1); } });
      return;
    }
    this.ri = i;
    const on = m => {
      if (this.br !== br) return;
      if (m.ev === "ready") { if (!this.priming) { if (!this.autoplay) br.pause(); this.fire("loadedmetadata"); } }
      else if (m.ev === "time") { if (!this.priming) this.fire("timeupdate"); }
      else if (m.ev === "state") {
        if (this.priming) { if (m.s === "playing") this.primed(br); }  // other states while priming aren't the song's own
        else if (m.s === "playing" && this.brPaused) { this.brPaused = false; this.fire("play"); this.fire("playing"); }
        else if (m.s === "paused" && !this.brPaused) { this.brPaused = true; this.fire("pause"); }
        else if (m.s === "ended") { this.brPaused = true; this.fire("pause"); this.fire("ended"); }
      }
      else if (m.ev === "volctl") this.gotVolCtl(br);
      else if (m.ev === "novolctl") store.set("biliScript", false);  // script removed / off → the guide comes back next time
      else if (m.ev === "error" && this.refs === refs) {
        // kept player broke (page/player didn't come up) → make a new one next time
        if (br === this.kept[ref.kind] && (m.code === "api" || m.code === "timeout")) { this.kept[ref.kind] = null; br.destroy(); }
        this.errs.push(m.code); this.tryRef(i + 1);
      }
      if (m.ev !== "time") diag("br", m.ev === "state" ? m.s : m.ev === "error" ? "error " + m.code : m.ev, ref.kind + ":" + ref.id);
    };
    // One kept player per kind (YouTube·Niconico): reused for every song of that kind so playback goes on in a hidden tab
    // (user report: Whale, other tab in front → the next song changed but stayed silent in its new frame).
    let br;
    const kept = this.kept[ref.kind];
    if (got) {
      br = got;
      if (kept && kept !== got) kept.destroy();
      this.kept[ref.kind] = got;  // the preloaded frame (made while shown, has played) becomes the kept one
      diag("preloaded", ref.kind + ":" + ref.id);
    } else if (kept && kept.canLoad(ref.kind)) {
      br = kept; br.on = on; br.frame.classList.remove("pre");
      this.br = br; this.applyVolume();  // muted first when priming
      br.load(ref, this.start); br.comments(nicoComments());  // always plays (priming pauses it once it really started)
      diag("reuse", ref.kind + ":" + ref.id, document.hidden ? "hidden" : "shown");
    } else {
      // Bilibili: script installed earlier → &vs (opens muted, the script unmutes at our volume); else the guide (see biliGuide)
      const vs = ref.kind === "bili" && (store.get("biliScript", false) || EXT.ver >= 2);
      const guide = ref.kind === "bili" && !vs && !this.biliLater && !(BILI_TOUCH() && store.get("biliTouchOk", false));
      // muted too while guiding: an older deployed bridge ignores &guide and would play aloud (user report: 귀테러)
      br = new BridgePlayer(this.host, ref, {start: this.start, volume: platformVolume(ref.kind, this.uv * this.gain), rate: this.rateFor(ref.kind),
        mute: this.el.muted || this.priming || guide, guide, vs, on});
      br.guiding = guide;
      if (kept) kept.destroy();  // (old bridge page: replaced each time as before)
      this.kept[ref.kind] = br;
      diag("new frame", ref.kind + ":" + ref.id, document.hidden ? "hidden" : "shown");
    }
    this.br = br; this.applyRate();
    if (got) {
      this.priming = false;  // a preloaded frame has played already
      got.on = on; got.frame.classList.remove("pre");
      got.seek(this.start); this.applyVolume();
      if (this.autoplay) got.play();
      if (got.ready) this.fire("loadedmetadata");
    }
    this.fire("sourcechange");  // 영상 칸이 새 플레이어를 다시 놓음
  }
  /* 모든 출처가 안 될 때의 까닭: 삭제·비공개 → 퍼가기 금지 → 그 밖 (맨 앞 출처의 것) */
  reason() {
    const e = this.errs;
    if (e.includes(100)) return bridgeReason(100);
    if (e.some(c => c === 101 || c === 150)) return bridgeReason(150);
    return bridgeReason(e[0] ?? "no-video");
  }
  /* primed song really started (muted): back to the start, paused, sound back on → ready. play() came meanwhile → just go on */
  primed(br) {
    this.priming = false; this.applyVolume();
    if (!this.autoplay) { br.seek(this.start); br.pause(); }  // this order: Niconico resumes on a seek sent right after pause
    this.fire("loadedmetadata");
    if (this.autoplay) { this.brPaused = false; this.fire("play"); this.fire("playing"); }
  }
  stopStream() { this.release(this.br); this.br = null; this.refs = null; this.priming = false; }
  /* done with a bridge player: a kept one is paused and parked behind (reused for the next song of its kind), others removed */
  release(br) {
    if (!br) return;
    if (br !== this.kept[br.ref.kind]) return br.destroy();
    br.on = () => {}; br.pause(); br.frame.classList.add("pre");
  }
  /* 지금 틀고 있는 출처 종류 (yt|nico — 온라인 곡이 아니거나 아직 없으면 '') · 니코니코 댓글 켜기/끄기 (미리 띄운 다음 곡에도) */
  get kind() { return this.refs && this.br ? this.br.ref.kind : ""; }
  /* Bilibili volume guide (user request 2026-11-18): its embed takes our volume only through the extension (BILI_EXT_JS).
     Until it answers in this browser, a Bilibili song opens muted with the step guide over the video (makePlayer):
     download the zip → open the extensions page (address copy) → load the folder. Its answer (bridge "volctl") ends the
     guide by itself. 나중에 = sound on at Bilibili's own volume, asked again after a reload. Touch devices can't load
     extensions: one notice. */
  get biliGuide() { return !!(this.refs && this.br && this.br.guiding); }
  endBiliGuide() {
    const br = this.br;
    if (br && br.guiding) { br.guiding = false; this.applyVolume(); br.guide(false); }  // unmute first: the guide frame stays open meanwhile
    this.fire("guidechange");
  }
  laterBiliGuide() { this.biliLater = true; this.endBiliGuide(); }
  touchBiliOk() { store.set("biliTouchOk", true); this.endBiliGuide(); }
  recheckBili() { if (this.br && this.br.guiding) this.br.cmd("reload"); }  // a just-saved script runs only in a new page
  gotVolCtl(br) {
    br.volCtl = true;
    store.set("biliScript", true);
    if (br === this.br) { this.fire("volctl"); this.endBiliGuide(); }
  }
  get comments() { return nicoComments(); }
  set comments(on) { store.set("nicoComments", !!on); if (this.br) this.br.comments(!!on); if (this.pre) this.pre.br.comments(!!on); }
  applyVolume() {
    const v = this.uv * this.gain;
    if (!this.refs && Math.abs(this.el.volume - v) > 0.0005) this.el.volume = v;
    if (this.br) { this.br.volume(platformVolume(this.br.ref.kind, v)); this.br.mute(this.el.muted || this.priming || !!this.br.guiding); }
    this.applyFx();
  }
  /* 키 변경 (semis, per song — play_speed.js sets it) · 소리 크기 맞추기 (setting): online = sent through the bridge to the
     extension / app script in the site's frame; our mp3 = the same chain in this page (made only once wanted — an <audio>
     can't be taken back out of Web Audio) */
  applyFx() {
    const level = levelOn(), vol = this.el.muted ? 0 : this.uv * this.gain;
    if (this.refs) {
      if (!this.br || fxBlock(this.br.ref.kind)) return;
      const key = this.br.ref.kind + ":" + this.br.ref.id, l = LOUD[key];
      this.br.fx({semis: this.semis || 0, level, vol: Math.round(vol * 1000) / 1000, key, prior: l ? l[0] : null});
      return;
    }
    if (!this.local && !(this.semis || level) || !window.mpxAudioFor || !this.el.src) return;
    if (!this.local) { try { this.local = window.mpxAudioFor(this.el); } catch (e) { return; } }
    const {chain, lev} = this.local;
    chain.setSemis(this.semis || 0);
    if (lev.key !== this.el.src) lev.reset(this.el.src);
    lev.on = level; lev.vol = vol; lev.apply();
  }
  get semis() { return this.semisV || 0; }
  set semis(s) { this.semisV = Math.max(-12, Math.min(12, Math.round(+s || 0))); this.applyFx(); this.fire("fxchange"); }
  /* 페이드 인 · 아웃 (user request 2026-11-19): gain from where the song is — 0 → 1 over the first fin seconds, 1 → 0 over
     the last fout (only when the song is long enough). From the position, not a clock: a seek or a resume is right at once.
     Looked at every 50 ms inside a fade only; between them one timer waits for the fade-out (no loop all song long). */
  fadeGain() {
    const {fin, fout} = fadeSecs(), t = this.currentTime || 0, d = this.duration;
    let g = 1;
    if (fin > 0) g = Math.min(g, t / fin);
    if (fout > 0 && d > (fin + fout) * 1.5) g = Math.min(g, (d - t) / fout);
    return Math.max(0, Math.min(1, g));
  }
  fadeStart(start) { const {fin} = fadeSecs(); this.gain = fin > 0 && start < fin ? 0 : 1; }  // a new song: silent until it fades in
  fadeTick() {
    clearTimeout(this.fadeT);
    if (this.priming) return;
    const g = this.fadeGain();
    if (Math.abs(g - this.gain) >= 0.01 || (g !== this.gain && (g === 0 || g === 1))) { this.gain = g; this.applyVolume(); }
    if (this.paused) return;
    const {fin, fout} = fadeSecs(), t = this.currentTime || 0, d = this.duration;
    let wait = 0;  // 0 = nothing more to fade
    if (fin > 0 && t < fin) wait = 50;
    else if (fout > 0 && d > (fin + fout) * 1.5) wait = t >= d - fout - 0.3 ? 50 : Math.min(5000, (d - fout - 0.3 - t) * 1000 / (this.playbackRate || 1));
    if (wait) this.fadeT = setTimeout(() => this.fadeTick(), Math.max(50, wait));
  }
  /* 배속 (user request 2026-11-19, browser key rate): what plays — 1 in a 같이듣기 room, or on a player that needs the
     extension when it isn't here (the button shows that: rateBlock) */
  rateFor(kind) { return this.rateBlock(kind) ? 1 : +store.get("rate", 1) || 1; }
  rateBlock(kind = this.kind) {
    if (rateLocked()) return "lock";
    if (rateNeedsExt(kind) && EXT.ver < 2) return BILI_TOUCH() ? "touch" : "ext";  // the app injects the same script (EXT.ver from its bridge page)
    return "";
  }
  applyRate() {
    const r = this.rateFor(this.kind);
    if (this.refs) { if (this.br) this.br.rate(r); }
    else if (this.el.playbackRate !== r) { this.el.defaultPlaybackRate = r; this.el.playbackRate = r; }
    if (r !== this.lastRate) { this.lastRate = r; this.fire("ratechange"); this.fadeTick(); }
  }
  get currentTime() { return this.refs ? (this.br ? this.br.time() : 0) : this.el.currentTime; }
  set currentTime(t) { if (!this.refs) { this.el.currentTime = t; return; } if (this.br) { this.br.seek(t); setTimeout(() => this.fire("seeked"), 0); } }
  get duration() { return this.refs ? (this.br && this.br.d) || NaN : this.el.duration; }
  get paused() { return this.refs ? this.brPaused : this.el.paused; }
  /* User report 2026-11-16 (S24, phone app): after moving from 곡 검색 to 재생목록 the song went silent, the bar kept moving
     (time() runs on while the state is "playing") and ▶ did nothing — the bridge frame had stopped answering (not seen on the
     emulator or a PC). A frame silent while it should play, or that doesn't answer a ▶, is replaced by a new one at the last
     position it told. Only while the page is in sight: a hidden tab / screen off delays the frame's timers. */
  watch() {
    const br = this.br, now = performance.now();
    if (!br || !this.refs || this.brPaused || this.priming || !br.ready || br.state !== "playing") return;
    if (document.hidden || APP.screenOff || now - br.heard < 5000 || now - (this.revivedAt || 0) < 30000) return;
    this.revive("silent");
  }
  revive(why) {
    const br = this.br;
    diag("revive", why, br.ref.kind + ":" + br.ref.id, `t=${Math.round(br.t)}`);
    this.revivedAt = performance.now();
    this.start = Math.floor(br.t); this.autoplay = true; this.priming = false;
    if (this.kept[br.ref.kind] === br) this.kept[br.ref.kind] = null;
    this.br = null; br.destroy();
    this.tryRef(this.ri);  // brPaused stays: a playing song shows no ▶ flicker, a paused one turns to playing when the new frame plays
  }
  play() {
    if (!this.refs) return this.el.play();
    this.autoplay = true;
    const br = this.br;
    if (br) {
      const sent = performance.now();
      diag("cmd play", br.ref.kind + ":" + br.ref.id, `${br.state}${br.ready ? "" : " not-ready"} heard ${Math.round((sent - br.heard) / 1000)}s ago`);
      br.play();
      setTimeout(() => { if (this.br === br && br.ready && !this.priming && br.heard < sent && !document.hidden && !APP.screenOff) this.revive("no answer to play"); }, 3000);
    }
    return Promise.resolve();
  }
  pause() { if (!this.refs) return this.el.pause(); this.autoplay = false; if (this.br) diag("cmd pause", this.br.ref.kind + ":" + this.br.ref.id, this.br.state); if (this.br && !this.priming) this.br.pause(); if (!this.brPaused) { this.brPaused = true; this.fire("pause"); } }  // priming pauses by itself
  get volume() { return this.uv; }
  set volume(v) { this.uv = Math.max(0, Math.min(1, +v || 0)); this.applyVolume(); this.fire("volumechange"); }
  get muted() { return this.el.muted; }
  set muted(v) { this.el.muted = v; }
  get error() { return this.refs ? this.brErr : this.el.error; }
  get src() { return this.refs ? (this.refs[this.ri] || {}).url || "" : this.el.src; }
  get readyState() { return this.refs ? (this.br && this.br.ready && !this.priming ? 4 : 0) : this.el.readyState; }
  get playbackRate() { return this.refs ? (this.br ? this.br.r : 1) : this.el.playbackRate; }
  set playbackRate(v) { store.set("rate", +v || 1); this.applyRate(); this.fire("ratechange"); }
}

/* 추가기능 넣기 안내 (user request 2026-11-18 Bilibili volume · 2026-11-19 speed button · 2026-11-19 one guide for both PC
   add-ons): whichever asked (오버레이 button, 배속 · 키, Bilibili), the guide hands out the one zip (setupZip) and walks
   through every add-on this PC still lacks — the overlay (run its bat) and the extension (extensions page → load the folder).
   One step at a time. An add-on that is there but older than this player's files ("old") gets: download again → unzip over
   the old folder ('파일 바꾸기') → double-click the bat (the new one replaces the running old one itself) / ↻ on the extension.
   An add-on that is up to date is left out. box: the card element. intro: why (first step) · touch: what a phone sees
   instead · later / touchOk: buttons · done: the extension check (returns the note to show) · ok: all done (no extension
   step). → {reset, note(text)} */
/* the PC overlay: "" running + up to date (or not this PC's thing) · "old" running, older than these files · "off" ran in
   this browser before, not running now · "new" never seen */
async function ovNeed() {
  if (!OV_PC()) return "";
  if (LOCAL.ovOn) {
    const r = await api("/api/ovprograms").catch(() => ({}));
    if (r.running) { store.set("ovSeen", true); return (+r.ver || 0) < await ovLatest() ? "old" : ""; }
  }
  return store.get("ovSeen", false) ? "off" : "new";
}
const extNeed = () => BILI_TOUCH() || EXT.ver >= EXT_VER ? "" : EXT.ver ? "old" : "new";
function extGuide(box, {intro, touch, later, touchOk, done, ok}) {
  const ua = navigator.userAgent, brw = /Whale\//.test(ua) ? "whale" : /Edg\//.test(ua) ? "edge" : "chrome";
  let need = null, steps = [], step = 0, note = "", run = 0, poll = 0;
  const zipBtn = '<button type="button" class="vg-cta" data-get="zip">추가기능 내려받기</button>';
  const addrBtn = '<button type="button" class="vg-cta" data-get="addr">주소 복사</button>';
  function build() {
    const {ov, ext} = need, S = [], old = ov === "old" || ext === "old";
    const what = [ov === "old" && "가사 오버레이", ext === "old" && "확장 프로그램"].filter(Boolean).join(" · ");
    if (ov === "new" || ov === "old" || ext) S.push({t: old ? "새 버전 내려받기" : "추가기능 내려받기",
      b: (old ? `새 버전이 나왔어요: <b>${what}</b><br>다시 받아 전에 받은 파일에 덮어써 주세요.` : intro)
        + "<br>① 아래 버튼으로 내려받기{A}" + (old
          ? "② 전에 압축을 푼 곳에 <b>압축 풀기</b> — 같은 파일이 있다고 물으면 <b>파일 바꾸기</b>"
          : `② 지우지 않을 곳(예: 문서 폴더)에 <b>압축 풀기</b><br><span class="vg-note">폴더 안에 <b>${OV_DIR}</b> · <b>${EXT_DIR}</b> 두 폴더가 생겨요.</span>`),
      a: zipBtn});
    if (ov) S.push({t: "가사 오버레이 켜기", ov: true,
      b: (ov === "off" ? `가사 오버레이 프로그램이 꺼져 있어요.<br>① 전에 압축을 푼 <b>${OV_DIR}</b> 폴더의 <b>lyrics_overlay.bat</b> 더블클릭`
        : ov === "old" ? `① 덮어쓴 <b>${OV_DIR}</b> 폴더의 <b>lyrics_overlay.bat</b> 더블클릭 — 켜져 있던 옛 오버레이는 저절로 새 것으로 바뀌어요`
        : `① 압축을 푼 <b>${OV_DIR}</b> 폴더의 <b>lyrics_overlay.bat</b> 더블클릭`)
        + "<br>② <b>Windows의 PC 보호</b> 창이 뜨면 <b>추가 정보</b> → <b>실행</b>{A}"
        + '<br><span class="vg-note">한 번 켜 두면 컴퓨터를 끌 때까지 뒤에서 돌고, 그동안은 [오버레이] 단추로 켜고 꺼요.</span>',
      a: ov === "off" ? `<span class="vg-note">폴더가 없으면</span>${zipBtn}` : ""});
    if (ext === "new") S.push(
      {t: "확장 프로그램 화면 열기", b: "① <b>주소 복사</b>를 누르고 새 탭 주소창에 붙여 넣어 이동{A}② 오른쪽 위 <b>개발자 모드</b> 켜기", a: addrBtn},
      {t: "확장 프로그램 폴더 넣기", b: `① <b>압축해제된 확장 프로그램을 로드합니다</b> 누르기<br>② 압축을 푼 <b>${EXT_DIR}</b> 폴더를 골라 <b>폴더 선택</b><br>③ 이 화면으로 돌아와 <b>다 했어요</b>`
        + '<br><span class="vg-note">예전에 넣은 <b>음원 플레이어 확장 · 비리비리 볼륨</b>이 있으면 지워도 돼요.</span>', a: ""});
    if (ext === "old") S.push({t: "확장 프로그램 새로 고침",
      b: "① <b>주소 복사</b>를 누르고 새 탭 주소창에 붙여 넣어 이동{A}② <b>음원 플레이어 확장</b>의 <b>↻</b>(새로고침) 누르기<br>③ 이 화면으로 돌아와 <b>다 했어요</b>"
        + `<br><span class="vg-note">예전 <b>music-player-ext</b> 폴더로 넣었다면: 그 확장은 <b>삭제</b> → <b>압축해제된 확장 프로그램을 로드합니다</b> → <b>${EXT_DIR}</b> 폴더.</span>`, a: addrBtn});
    return S;
  }
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement("textarea");  // fallback (clipboard API refused) — off screen, removed at once
    ta.value = text; ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove(); return ok;
  };
  const shown = () => box.isConnected && !box.hidden && !(box.closest("dialog") && !box.closest("dialog").open);
  // the overlay step watches for the (new) overlay every 2 s while shown
  function ovWatch() {
    clearInterval(poll);
    if (!need || !(steps[step] || {}).ov) return;
    LOCAL.ovEnable();  // from now on this browser talks to the overlay
    poll = setInterval(async () => {
      if (!shown() || !(steps[step] || {}).ov) return clearInterval(poll);
      if (!await ovNeed()) { clearInterval(poll); note = "가사 오버레이가 켜졌어요."; draw(); }
    }, 2000);
  }
  function draw() {
    if (BILI_TOUCH()) {
      box.innerHTML = `<div class="vg-b">${touch}</div>` +
        '<div class="vg-nav"><span></span><button type="button" class="primary" data-act="touchok">확인</button></div>';
      return;
    }
    if (!need) { box.innerHTML = '<div class="vg-b"><span class="vg-note">확인하는 중…</span></div>'; return; }
    if (!steps.length) {
      box.innerHTML = '<div class="vg-b">추가기능(가사 오버레이 · 확장 프로그램)이 모두 최신이에요.</div><div class="vg-nav"><span></span><button type="button" class="primary" data-act="ok">확인</button></div>';
      return;
    }
    const S = steps[step], last = step === steps.length - 1;
    const act = S.a || note ? `<div class="vg-a">${S.a}${note ? `<span class="vg-note">${note}</span>` : ""}</div>` : "";
    const body = S.b.includes("{A}") ? S.b.replace("{A}", act) : S.b + act;
    box.innerHTML = `<div class="vg-h"><span class="vg-n">${step + 1}/${steps.length}</span>${S.t}</div><div class="vg-b">${body}</div>` +
      '<div class="vg-nav"><button type="button" class="vg-later" data-act="later">나중에</button><span>' +
      (step ? '<button type="button" data-act="prev">이전</button>' : "") +
      (last ? '<button type="button" class="primary" data-act="done">다 했어요</button>' : '<button type="button" class="primary" data-act="next">다음</button>') +
      "</span></div>";
  }
  box.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.get === "zip") {
      const z = await setupZip(), a = document.createElement("a");
      a.href = URL.createObjectURL(z.blob); a.download = SETUP_ZIP;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      note = OV_PC() && !z.ov ? "내려받았어요. (오버레이 파일은 이 화면에서 읽지 못해 빠졌어요 — 플레이어 주소로 열어 주세요)" : "내려받았어요. 압축을 풀어 주세요.";
      return draw();
    }
    if (b.dataset.get === "addr") {
      note = await copy(`${brw}://extensions`) ? "주소를 복사했어요. 새 탭 주소창에 붙여 넣으세요." : "복사하지 못했어요. 다시 눌러 주세요.";
      return draw();
    }
    const act = b.dataset.act;
    note = "";
    if (act === "next") step++;
    else if (act === "prev") step--;
    else if (act === "later") { clearInterval(poll); return later(); }
    else if (act === "touchok") return touchOk();
    else if (act === "ok") return (ok || later)();
    else if (act === "done") {
      if (need.ov && await ovNeed()) note = "가사 오버레이가 아직 확인되지 않아요. lyrics_overlay.bat 을 실행했는지 확인해 주세요.";
      else if (need.ext) note = done() || "";
      else { clearInterval(poll); return (ok || later)(); }
    }
    draw(); ovWatch();
  });
  return {
    async reset() {
      const r = ++run;
      clearInterval(poll); need = null; steps = []; step = 0; note = ""; draw();
      const n = {ov: await ovNeed(), ext: extNeed()};
      if (r !== run) return;
      need = n; steps = build(); draw(); ovWatch();
    },
    note(t) { note = t; draw(); }};
}
/* the guide as a window over a darkened screen (user request 2026-11-19, like ⚙ 설정) — 오버레이 button · 배속 · 키.
   what: the title's first word · after: run once everything answers (the buttons refresh) */
let setupDlg = null, setupG = null, setupAfter = null;
function openSetupGuide(what, after) {
  setupAfter = after || null;
  if (!setupDlg) {
    setupDlg = document.createElement("dialog");
    setupDlg.id = "extDlg"; setupDlg.className = "uidlg extdlg";
    setupDlg.innerHTML = '<div class="dlg-head hx"><span class="eg-what"></span> — 추가기능 넣기<button class="ib dlgx" title="닫기 (Esc)" aria-label="닫기">✕</button></div><div class="dlg-body"><div class="vguide"></div></div>';
    document.body.appendChild(setupDlg);
    const close = () => setupDlg.close(), fin = () => { close(); if (setupAfter) setupAfter(); };
    setupDlg.querySelector(".dlgx").onclick = close;
    setupG = extGuide(setupDlg.querySelector(".vguide"), {
      // shorter, as a list (user request 2026-11-19): two red notes, then the two add-ons
      intro: '<ul class="vg-warn"><li>모바일은 아래 프로그램 없이 아래 기능을 사용할 수 있어요.</li><li>Bilibili 출처의 음원은 이 확장프로그램이 필수에요.</li></ul>'
        + '<ol class="vg-list"><li>가사 오버레이</li><li>확장프로그램 : 영상출처를 가리지않고 볼륨을 보다 정확하게 균일하게 만들고, 배속 · 음정변경 · 사이트별 광고제거 를 한번에 넣어요.</li></ol>',
      touch: "이 기기에서는 PC 추가기능(가사 오버레이 · 확장 프로그램)을 넣을 수 없어요. 폰은 앱에서 돼요.",
      later: close, touchOk: close, ok: fin,
      done: () => {
        extProbe().then(v => {
          if (!setupDlg.open) return;
          if (v >= EXT_VER) return fin();
          setupG.note("아직 확장 프로그램이 확인되지 않아요. 개발자 모드와 폴더를 다시 확인해 주세요.");
        });
        return "확장 프로그램을 확인하는 중…";
      }});
  }
  setupDlg.querySelector(".eg-what").textContent = what;
  setupG.reset();
  if (!setupDlg.open) setupDlg.showModal();
}

/* ---------- 재생기 ---------- */
function makePlayer(el) {
  const keyOf = it => it.site + "/" + it.name;
  // 중계 플레이어 칸: 이 문서에 하나 — 영상 칸(placeVideo)이 있으면 그 위에 겹쳐 보이고, 없으면 1px 로 접음 (소리는 계속)
  const host = document.createElement("div");
  host.id = "streamHost";
  document.body.appendChild(host);
  // user request: no YouTube/Niconico buttons on hover — a clear layer over the video takes the mouse; click = play/pause
  const shield = document.createElement("div");
  shield.className = "vshield";
  shield.title = "누르면 재생 / 일시정지";
  shield.addEventListener("click", () => P.toggle());
  host.appendChild(shield);
  // Bilibili volume warning (LocalMedia.biliGuide) over the video — 2026-11-19 (user request): a real warning box (yellow
  // and red) instead of the step-by-step guide; the steps live in ⚙ 설정 › 추가기능 (openSetupGuide). 나중에 = sound on.
  const bubble = document.createElement("div");
  bubble.className = "vguide vwarn";
  bubble.hidden = true;
  host.appendChild(bubble);
  const warnHtml = () => BILI_TOUCH()
    ? '<div class="vw-h"><span class="vw-i">!</span>볼륨 조절 안 됨</div><div class="vw-b">비리비리 영상은 이 기기에서 플레이어 볼륨이 적용되지 않아요. 기기 볼륨으로 맞춰 주세요.</div>'
      + '<div class="vg-nav"><span></span><button type="button" class="primary" data-act="touchok">확인</button></div>'
    : '<div class="vw-h"><span class="vw-i">!</span>볼륨 조절 안 됨</div><div class="vw-b">비리비리 영상은 플레이어 볼륨이 적용되지 않아요.<br>'
      + '<b>설정 › 추가기능</b>에서 추가기능을 내려받아 넣어야 볼륨을 조절할 수 있어요.</div>'
      + '<div class="vg-nav"><button type="button" class="vg-later" data-act="later">그냥 듣기</button><button type="button" class="primary" data-act="addon">설정 › 추가기능 열기</button></div>';
  bubble.addEventListener("click", e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    if (b.dataset.act === "later") audio.laterBiliGuide();
    else if (b.dataset.act === "touchok") audio.touchBiliOk();
    else if (b.dataset.act === "addon" && typeof openPlayerSettings === "function") openPlayerSettings("addon");
  });
  const showGuide = () => {
    const g = audio.biliGuide;
    if (g && bubble.hidden) bubble.innerHTML = warnHtml();
    bubble.hidden = !g;  // the shield stays (user request 2026-11-18: no unlocked video — the box's buttons sit above it)
  };
  const probe = document.createElement("div");  // 이 문서의 화면 축소 비율 재기 (100px 이 실제로 몇 px 로 보이나)
  probe.style.cssText = "position:fixed;left:0;top:0;width:100px;height:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const audio = new LocalMedia(el, host);
  for (const ev of ["sourcechange", "emptied", "guidechange"]) audio.addEventListener(ev, showGuide);
  const P = {
    audio, now: null, lyr: null, editing: false, autoplay: false,
    follow: false,  // 같이듣기 손님 (곡이 끝나도 혼자 넘어가지 않음)
    canQueue: canPlay,  // 재생 목록에는 틀 수 있는 곡만
    /* 곡 바꾸기 — how: next · prev · pick(곡 하나만 고름) · ''(그 곡부터 순서를 새로) */
    async load(it, autoplay = true, how = "") {
      if (!it) return;
      if (!canPlay(it)) {
        uiAlert(it.site === "stream" ? "이 곡은 재생할 수 있는 영상 주소(니코니코·유튜브·비리비리·SoundCloud 등)가 없습니다." : "오프라인 폴더에서 그 곡을 찾을 수 없습니다. 폴더를 다시 연결하세요.");
        return;
      }
      this.queueOnLoad(it, how);  // 지난 곡·다음 곡 순서 (play_queue.js)
      const start = resumeSeek && resumeSeek.it === it ? resumeSeek.t : 0; resumeSeek = null;  // resume after a reload (P.resumeAt)
      this.now = it; this.autoplay = autoplay; store.set("last", keyOf(it));
      store.set("lastItem", Object.fromEntries(Object.entries(typeof plainSong === "function" ? plainSong(it) : it).filter(([k]) => !k.startsWith("_"))));  // 새로고침해도 (음원 관리 화면이어도) 띄움
      if (it.site === "local") {
        audio.setSrc(OFFDIR.audioUrl(it));
        if (start) audio.currentTime = start;
        if (autoplay) audio.play().catch(() => {});
      } else {
        diag("song", how || "-", it.title, streamRefs(it).map(r => r.kind + ":" + r.id).join(","), autoplay ? "" : "(no autoplay)");
        audio.playStream(streamRefs(it), autoplay, start);
        // started while the tab is hidden and not minimized (minimized window: ~160x28) → watch for a stall (see hiddenStall)
        stallWatch = autoplay && document.hidden ? {it, at: Date.now(), min: outerHeight < 80} : null;
      }
      this.lyr = null; lyrIdx = -2; this.lemit();
      this.emit(); this.qemit();
      await this.reloadLyrics();
    },
    /* 가사·싱크 다시 읽기 (가사 편집·싱크 저장 뒤에도 부름) */
    async reloadLyrics() {
      const it = this.now; if (!it) return;
      try {
        const s = await api(`/api/lyrics?site=${encodeURIComponent(it.site)}&name=${encodeURIComponent(it.name)}`);
        if (this.now !== it) return;
        this.lyr = {groups: s.groups || [], times: s.sync && (s.sync_state === "ok" || s.sync_state === "resync") ? s.sync.times : null, offset: s.sync ? +s.sync.offset || 0 : 0,
                    state: s.sync_state || ""};  // state: ok · resync · stale(가사가 바뀌어 싱크가 안 맞음) · ''(싱크 없음)
      } catch (e) { if (this.now === it) this.lyr = null; }
      lyrIdx = -2; this.lemit();
    },
    setOffset(o) { if (this.lyr) { this.lyr.offset = o; lyrIdx = -2; this.lemit(); } },
    /* 가사 먼저 보이기(초): 싱크 파일은 그대로, 재생할 때 가사 표시만 이만큼 앞당김 (0.1~1.0초 · 기본 0.5초) — 오버레이만 (user request 2026-11-18: the player screen shows the sync as it is) */
    lead: Math.min(1, Math.max(0.1, +store.get("lyricsLead", 0.5) || 0.5)),
    setLead(v) {
      this.lead = Math.round(Math.min(1, Math.max(0.1, +v || 0)) * 100) / 100;
      store.set("lyricsLead", this.lead);
      lyrIdx = -2; this.lemit();
    },
    /* 지금 가사 묶음 번호 (-1: 첫 묶음 전 · 싱크가 없으면 -1) */
    lyrIndex() {
      const L = this.lyr; if (!L || !L.times) return -1;
      const now = audio.currentTime;
      let idx = -1;
      for (let i = 0; i < L.times.length; i++) { if (L.times[i] != null && L.times[i] + L.offset - this.lead <= now + 0.05) idx = i; else if (L.times[i] != null) break; }
      return idx;
    },
    /* 가사가 바뀜(곡·싱크·밀기·먼저 보이기) → 위 막대·플레이어가 다시 그림 */
    lsubs: new Set(),
    lsubscribe(fn) { this.lsubs.add(fn); return () => this.lsubs.delete(fn); },
    lemit() { this.lsubs.forEach(f => { try { f(); } catch (e) { this.lsubs.delete(f); } }); sendNow(); },
    toggle() {
      if (!this.now) return;
      if (!audio.paused) return audio.pause();
      this.autoplay = true;
      if (audio.error && this.queue.length > 1) return this.next(false);  // 못 트는 곡에서 ▶: 다음 곡으로 (못 튼 곡 창은 오류 때 이미 뜸)
      audio.play().catch(() => {});
    },
    /* 영상 칸: 화면이 영상을 보일 자리(el, 다른 문서 — 플레이어 iframe 안이어도 됨)를 알려 주면 중계 플레이어를 그 위에 겹쳐 보임.
       null 이면 1px 로 접음 (영상은 안 보여도 소리는 그대로). 화면을 떠나거나 영상을 숨길 때 null */
    placeVideo(target) { place = target || null; placeNow(); },
    refitVideo() { placeNow(); },  // the screen moved the video box (phone player screen done sliding) — follow it now, not on the next 250ms round
    notify() { sendNow(); },  // 오버레이에 바로 다시 알림 (플레이어의 발음·번역 체크가 바뀜)
  };
  addPlayQueue(P);  // 재생 목록·대기열·대기열 창

  /* ---- 영상 칸에 겹치기 ---- */
  let place = null, placed = "";
  /* the host's look — written only when it changes (this runs 4 times a second: rewriting the same style each time kept
     the page busy — user request 2026-11-18, phones got hot) */
  function setHost(cls, css = "") {
    if (placed === cls + css) return;
    placed = cls + css; host.className = cls; host.style.cssText = css;
  }
  function placeNow() {
    let r = null;
    // 폰 화면이 꺼짐: 영상 칸을 1px 로 접음 → 작은 플레이어라 유튜브·니코니코가 낮은 화질로 받음 (user request 2026-11-15, battery)
    if (APP.screenOff) return setHost("folded");
    // the screen decides the video box is out of sight (phone: player screen slid down / a page over it — mobile_view.js)
    if (P.videoHidden && P.videoHidden()) return setHost("folded");
    try {
      if (place && place.isConnected && audio.bridged) {
        const b = place.getBoundingClientRect(), w = place.ownerDocument.defaultView;
        if (b.width > 0 && b.height > 0) {
          r = {left: b.left, top: b.top, width: b.width, height: b.height};
          const fe = w.frameElement;  // 영상 칸이 플레이어 iframe 안: 그 iframe 위치만큼 더함 (iframe 안 화면 축소는 그 비율로)
          if (fe && w !== window) {
            const f = fe.getBoundingClientRect(), z = fe.clientWidth ? f.width / fe.clientWidth : 1;
            r = {left: f.left + fe.clientLeft + b.left * z, top: f.top + fe.clientTop + b.top * z, width: b.width * z, height: b.height * z};
          }
        }
      }
    } catch (e) { r = null; }  // 영상 칸이 있던 화면이 사라짐 (다른 화면으로 넘어감)
    if (!r) return setHost("folded");
    // 이 문서가 화면 축소(--ui-zoom)돼 있으면 style 의 px 도 그 비율로 줄어 보임 → 잰 크기를 그 비율로 나눔
    const hz = probe.getBoundingClientRect().width / 100 || 1;
    const px = v => Math.round(v / hz * 10) / 10 + "px";
    setHost("shown", `left:${px(r.left)};top:${px(r.top)};width:${px(r.width)};height:${px(r.height)}`);
  }
  setInterval(() => { if (!APP.screenOff && !document.hidden) placeNow(); }, 250);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) placeNow(); });
  addEventListener("appscreen", () => { placeNow(); sendNow(true); });  // 영상 칸이 움직이거나(스크롤·창 크기·목록 접기) 화면이 바뀌면 따라감
  addEventListener("resize", placeNow);
  audio.addEventListener("sourcechange", placeNow);
  audio.addEventListener("emptied", placeNow);

  /* ---- 가사 오버레이(tools\lyrics_overlay.bat — 파워쉘 창, 바탕 투명)에 지금 곡·가사 묶음 알리기 ----
     LOCAL 이 오버레이의 창구(127.0.0.1:47613)로 보냄 → 오버레이가 overlay\now_playing.json 에 씀.
     묶음이 바뀔 때·재생/멈춤 때 + 5초마다(화면이 켜져 있다는 표시 — 끄면 오버레이가 숨김).
     발음·번역 줄은 플레이어의 '발음'·'번역' 체크 그대로 (같은 브라우저 저장값) */
  let nowLast = "", lyrIdx = -2;
  const overlayOn = () => APP.on || LOCAL.ovOn;  // nobody to tell otherwise (the PC overlay was never used here)
  function sendNow(beat = false) {
    if (!LOCAL.ready || APP.screenOff || !overlayOn()) return;  // 폰 화면이 꺼짐: 가사 위치를 안 봄 (켜지면 appscreen 에서 바로 보냄)
    const it = P.now, L = P.lyr, i = P.lyrIndex(), g = L && L.times && i >= 0 ? L.groups[i] : null, plain = store.get("simple", false);
    // other-language lines (VocaDB): only the language picked in the player's 다른 언어 select (none by default)
    const keep = ls => (ls || []).filter(l => l.role !== "x" || (l.lang && l.lang === store.get("xLang", ""))).map(l => ({role: l.role, text: l.text}));
    const pc = p => plain ? [] : (p.colors || [p.color]).filter(c => /^#[0-9a-f]{6}$/i.test(c || "")).map(inkOf);  // black (합창) → charcoal
    const ink = cs => (cs || []).map(inkOf);
    const showP = store.get("showP", true);
    const d = {title: it ? titleOf(it) : "", artist: it ? shortName(it.artist || "") : "", playing: !audio.paused,
      show_r: store.get("showR", true), show_t: store.get("showT", true), colors: g && !plain ? ink(g.vc) : [],  // 간단 표시: 보컬 색 없이 흰색
      light: store.get("theme", "dark") === "light",  // 밝은 화면: 오버레이도 흰 테두리 + 어두운 글자 (user request 2026-11-18)
      lines: g ? keep(g.lines) : [],
      // 파트 (user request 2026-11-19): the part's name small above the lyrics (the player's 파트 check) · several singers at
      // once (g.cols) = side by side, each in its own colors and centred on its own, no '／' (lines stays for older overlays)
      part: g && g.part && !g.cols && showP ? {name: g.part.name, colors: pc(g.part)} : null,
      cols: g && g.cols ? g.cols.map(c => ({name: showP && c.part ? c.part.name : "", pcolors: c.part ? pc(c.part) : [], colors: plain ? [] : ink(c.vc), lines: keep(c.lines)})) : null};
    const text = JSON.stringify(d);
    if (text === nowLast && !beat) return;
    nowLast = text;
    post("/api/now", d).catch(() => {});  // 못 써도 재생은 그대로
  }
  setInterval(() => sendNow(true), 5000);
  setInterval(() => { if (!audio.paused && !APP.screenOff && overlayOn()) { const i = P.lyrIndex(); if (i !== lyrIdx) { lyrIdx = i; sendNow(); } } }, 200);
  ["play", "pause"].forEach(ev => audio.addEventListener(ev, () => sendNow()));

  /* ---- 다음 곡 미리 띄워 두기: 지금 곡이 4초쯤 흐른 뒤 다음에 틀 온라인 곡 (한 곡 반복·다음 곡 없음이면 안 함) ---- */
  let preTimer = 0;
  const nextUp = () => P.pinned[0] || P.upcoming[0] || null;
  function schedulePreload() {
    clearTimeout(preTimer);
    preTimer = setTimeout(() => {
      const it = nextUp();
      if (audio.paused || P.repeat === "one" || !it || it.site !== "stream" || !canPlay(it)) return audio.dropPreload();
      audio.preload(streamRefs(it));
    }, 4000);
  }
  audio.addEventListener("playing", schedulePreload);
  /* kept YouTube/Niconico players made while shown (LocalMedia.warm) — right when a song plays or the tab comes back,
     from the songs coming up, else the play list */
  function warmKinds() {
    if (document.hidden || audio.paused || !P.now || P.now.site !== "stream") return;
    for (const kind of ["yt", "nico"]) {
      if (audio.kept[kind]) continue;
      const it = [...P.pinned, ...P.upcoming.slice(0, 50), ...P.queue.slice(0, 200)].find(x => x.site === "stream" && streamRefs(x).some(r => r.kind === kind));
      if (it) audio.warm(streamRefs(it).find(r => r.kind === kind));
    }
  }
  audio.addEventListener("playing", () => setTimeout(warmKinds, 1000));
  document.addEventListener("visibilitychange", () => setTimeout(warmKinds, 1000));
  P.qsubscribe(schedulePreload);  // 다음 곡이 바뀜 (대기열에 넣음·무작위 등)

  /* ---- 끝·못 튼 곡 ---- */
  audio.volume = store.get("vol", 0.8);
  audio.addEventListener("volumechange", () => store.set("vol", audio.volume));
  /* user request 2026-11-17: while a sync save is being sent the song never moves on — an end during the send waits,
     and the next song plays once the send is done (P.sending wraps the send) */
  let endedWhileSending = false;
  const onEnd = () => {
    if (P.editing) return;  // 플레이어에서 싱크를 직접 맞추는 중이면 넘어가지 않음
    if (P.holdEnd && P.holdEnd()) return;  // update waiting for this song's end (version_check.js): it reloads instead
    if (P.follow) return;  // 같이듣기 손님: 방장이 다음 곡으로 넘김 (listen_together.js)
    if (P.repeat === "one") { audio.currentTime = 0; audio.play(); } else P.next(true);
  };
  let sendingN = 0;
  P.sending = async fn => {
    sendingN++;
    try { return await fn(); }
    finally { if (!--sendingN && endedWhileSending) { endedWhileSending = false; onEnd(); } }
  };
  audio.addEventListener("ended", () => {
    if (sendingN) { endedWhileSending = true; return; }
    onEnd();
  });
  /* 온라인 곡을 못 틀면 (원곡 영상 삭제·비공개·퍼가기 금지 등) 화면 가운데 창에 남기고 다음 곡으로 — 멈추지 않고 계속 재생.
     창은 확인을 누를 때까지 떠 있고, 그사이 또 못 튼 곡은 같은 창 목록에 쌓임. 틀려던 곡이면 넘어감 (곡을 골랐거나 ▶ 를 누름 —
     처음 화면을 열어 지난 곡을 띄워만 둔 때는 창만). 연달아 10곡 넘게 못 틀면 멈춤.
     못 튼 곡은 오류 신고를 저절로 보냄 (user request: 특이사항 대신 — 관리의 에러·지금 할 일에 뜸). 인터넷이 안 된 때는 곡 문제가 아니라 안 보냄 */
  const fail = failDialog(), failShown = new Set();
  let failRun = 0;
  audio.addEventListener("playing", () => { failRun = 0; });
  audio.addEventListener("play", () => { P.autoplay = true; });  // ▶ 를 누름 = 틀려던 곡
  audio.addEventListener("error", () => {
    const it = P.now;
    if (!it || it.site !== "stream" || !audio.error) return;
    const reason = audio.error.reason || "재생할 수 없습니다", go = P.autoplay && !P.editing && P.queue.length > 1 && ++failRun <= 10;
    if (go) setTimeout(() => { if (P.now === it && audio.error) P.next(true); }, 1500);
    if (failShown.has(keyOf(it))) return;  // 같은 곡을 다시 눌러 또 못 틀어도 창에는 한 번
    failShown.add(keyOf(it));
    fail.add(it, reason, go);
    if (!/인터넷/.test(reason)) noteFail(it, reason);
  });
  fail.onClear = () => failShown.clear();

  /* ---- 안 보는 동안 멈춘 곡 알리기 ----
     User report: songs stop while the player isn't watched. Chromium defers media in a frame created while the tab is hidden
     (each Niconico song = new embed frame). The screen opens an error report with
     the diagnostic log (report_dialog.js — the browser-settings popup was removed, user request). A real stall is the signal:
     a song started while hidden (not minimized) that never played until the tab came back → P.stallSubs. */
  let stallWatch = null;
  P.stallSubs = new Set();
  audio.addEventListener("playing", () => { stallWatch = null; });
  audio.addEventListener("error", () => { stallWatch = null; });
  // diagnostic heartbeat while hidden: position, paused, player state (timers in a hidden tab may run late — the gaps show that too)
  setInterval(() => {
    if (!document.hidden || !P.now || P.now.site !== "stream") return;
    const b = audio.br;
    diag("beat", `t=${Math.round(audio.currentTime)}/${Math.round(audio.duration) || "?"}`, audio.paused ? "paused" : "playing",
      b ? `${b.ref.kind}:${b.ref.id} ${b.state}${b.ready ? "" : " not-ready"}` : "no player", audio.error ? "error" : "");
  }, 20000);
  ["ended", "error"].forEach(ev => audio.addEventListener(ev, () => diag("audio", ev)));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    const w = stallWatch; stallWatch = null;
    if (w && !w.min && P.now === w.it && audio.paused && Date.now() - w.at > 5000)
      P.stallSubs.forEach(f => { try { f(w.it); } catch (e) {} });
  });

  /* ---- 새로고침돼도 이어 듣기 ----
     User report (2026-11-13): Whale reloaded the player tab by itself while a song played (nothing touched) → the page came
     back with that song paused at 0:00. While playing, this tab remembers song + position (sessionStorage: kept when the same
     tab reloads or is restored, not shared with a new tab); on start-up the screen resumes it (P.takeResume). Paused = forget. */
  const RESUME_KEY = "player.resume", RESUME_MAX = 30 * 60 * 1000;
  let resumeSeek = null;  // {it, t}: the next P.load of that song starts there
  let resumeFixed = false;  // P.resumeNext set what to play after the reload — keep it
  function saveResume() {
    if (resumeFixed) return;
    try {
      if (P.now && !audio.paused && !P.follow && !P.editing)
        sessionStorage.setItem(RESUME_KEY, JSON.stringify({k: keyOf(P.now), t: audio.currentTime || 0, at: Date.now()}));
      else sessionStorage.removeItem(RESUME_KEY);
    } catch (e) {}
  }
  setInterval(saveResume, 3000);  // hidden tab: timers may run once a minute — position is then up to that old
  audio.addEventListener("pause", saveResume);
  addEventListener("pagehide", saveResume);
  /* start-up: song key + position if this tab was playing just before it reloaded (null otherwise) — read once */
  P.takeResume = () => {
    let r = null;
    try { r = JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null"); sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
    return r && r.k && Date.now() - r.at < RESUME_MAX ? r : null;
  };
  // update reload after the current song (version_check.js): the page comes back playing this song from the start
  P.resumeNext = it => {
    resumeFixed = true;
    try { if (it) sessionStorage.setItem(RESUME_KEY, JSON.stringify({k: keyOf(it), t: 0, at: Date.now()})); else sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
  };
  P.resumeAt = (it, t) => { resumeSeek = t > 3 ? {it, t: Math.max(0, t - 1)} : null; diag("resume", it.title, `t=${Math.round(t)}`); };

  async function noteFail(it, reason) {
    const ymd = nowText().slice(0, 10);
    const sent = store.get("failReported", {}) || {};
    if (sent[keyOf(it)] === ymd) return;  // same song: one report a day from this browser
    const text = /삭제|비공개/.test(reason) ? "원곡 영상 링크 삭제됨 — 재생 불가" : `재생 못 함 — ${reason}`;
    try {
      await post("/api/report", {kind: "재생이 안 됨 (영상 삭제·막힘)", text: text + " (플레이어가 저절로 보냄)", who: store.get("reportWho", "") || "자동",
        song: {site: it.site, name: it.name, title: it.title, artist: it.artist || ""}, pos: null, source: ""});
      for (const k of Object.keys(sent)) if (sent[k] !== ymd) delete sent[k];
      sent[keyOf(it)] = ymd; store.set("failReported", sent);
    } catch (e) {}
  }
  return P;
}

/* 재생하지 못한 곡 창 (확인을 누를 때까지 떠 있음 — Esc 로 모르고 닫지 않게) */
function failDialog() {
  const d = document.createElement("dialog");
  d.id = "failDlg";
  d.innerHTML = '<div class="dlg-head">재생하지 못한 곡</div><div class="dlg-body"><ul id="failList"></ul></div><div class="dlg-foot"><button class="primary">확인</button></div>';
  document.body.appendChild(d);
  const list = d.querySelector("ul"), F = {onClear: null};
  d.querySelector("button").onclick = () => { d.close(); list.innerHTML = ""; if (F.onClear) F.onClear(); };
  d.addEventListener("cancel", e => e.preventDefault());
  F.add = (it, reason, skipped) => {
    const hm = nowText().slice(11, 16);
    list.insertAdjacentHTML("beforeend", `<li><span class="w">${hm}</span><span class="m">${titleHtml(it)}${it.artist ? ` <span class="r">${esc(shortName(it.artist))}</span>` : ""}
      <div class="r">${esc(reason)}${skipped ? " → 다음 곡으로 넘어감" : ""}</div></span></li>`);
    if (!d.open) d.showModal();
  };
  return F;
}
