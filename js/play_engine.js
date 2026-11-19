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
   vocadb: Bilibili needs the song's length from VocaDB (LocalMedia.biliLength) */
const streamRefs = it => [...new Set([it.video_link, ...(it.sources || [])].filter(Boolean))].map(vidRef).filter(Boolean)
  .map(r => it.vocadb ? {...r, vocadb: it.vocadb} : r);
/* 틀 수 있는 곡: 오프라인 곡(고른 mp3 폴더) · 원곡 영상 주소가 있는 온라인 곡.
   deleted: original video confirmed gone (Manage › 오류 신고) — user request: shown greyed, never played or queued */
const canPlay = it => !!it && (it.site === "local" || (it.site === "stream" && !it.deleted && (it._pn ?? streamRefs(it).length) > 0));  // _pn: playable links, counted once (search_dialog.js playableFast)

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
  constructor(host, ref, {start = 0, mute = false, volume = 1, guide = false, vs = false, on = () => {}} = {}) {
    this.id = "b" + ++bridgeSeq; this.t = start; this.at = this.heard = performance.now(); this.d = 0; this.state = "buffering"; this.ready = false;
    this.ref = ref; this.on = on;  // on: 메시지 받는 곳 (미리 띄워 둔 플레이어를 넘겨받으면 바뀜)
    const f = this.frame = document.createElement("iframe");
    f.allow = "autoplay; encrypted-media; fullscreen";
    f.src = `${BRIDGE_URL}?${ref.kind}=${encodeURIComponent(ref.id)}&id=${this.id}&start=${Math.floor(start)}${mute ? "&mute=1" : ""}&vol=${Math.round(volume * 100)}${nicoComments() ? "" : "&cmt=0"}${ref.len ? "&len=" + ref.len : ""}${guide ? "&guide=1" : ""}${vs ? "&vs=1" : ""}`;
    // 유튜브 플레이어는 칸이 접혀(1px) 안 보이면 재생 상태(state)를 알려 주지 않음 → 시간이 흐르는지로 재생·멈춤·끝을 셈
    const guess = s => { if (this.state === s) return; this.state = s; if (s === "playing") this.played = true; this.on({ev: "state", s}); };
    let still = 0;
    this.onMsg = e => {
      if (e.source !== f.contentWindow || !e.data || !e.data.bridge) return;
      const m = e.data;
      this.heard = performance.now();  // the frame still answers (LocalMedia.watch)
      this.ver = +m.ver || 1;  // bridge page version (2+: can "load" another YouTube song — older deployed page cannot)
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
  time() { return this.state === "playing" ? this.t + (performance.now() - this.at) / 1000 : this.t; }  // 0.25초마다 받는 시간 사이를 메움
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

/* Bilibili volume extension (user request 2026-11-18): its embed takes no volume from a page, so the player's guide hands
   out a tiny extension the user loads unpacked (developer mode — no store, no Tampermonkey). biliExtZip() builds the zip
   right here, so it always matches this code. Its content script runs in the Bilibili frame's page world (MAIN — Bilibili's
   window.player lives there): it takes {biliVol: 0~1 | null} from the bridge, sets it with Bilibili's own player.setVolume
   (linear, also unmutes, saved by Bilibili) and answers {biliVolAck: 1}. null = only "are you there" (guide: stay muted). */
const BILI_EXT_JS = `// 음원 플레이어 · 비리비리 볼륨 — the player's volume slider for Bilibili videos inside the music player
(function () {
  if (window.top === window) return;  // only inside the music player
  let want = null;
  const apply = () => {
    const p = window.player, v = document.querySelector("video");
    if (want === null || !p || typeof p.setVolume !== "function") return;
    try { if (Math.abs((+p.getVolume() || 0) - want) > 0.005 || (v && v.muted)) p.setVolume(want); } catch (e) {}
  };
  addEventListener("message", e => {
    if (e.source !== parent || !e.data || !("biliVol" in e.data)) return;
    if (typeof e.data.biliVol === "number") { want = Math.max(0, Math.min(1, e.data.biliVol)); apply(); }
    parent.postMessage({biliVolAck: 1}, "*");
  });
  setInterval(apply, 500);  // the player comes up after the first message
})();
`;
const BILI_EXT_MANIFEST = JSON.stringify({
  manifest_version: 3, name: "음원 플레이어 · 비리비리 볼륨", version: "1.0",
  description: "음원 플레이어의 볼륨 슬라이더가 비리비리 영상에도 적용되게 합니다",
  content_scripts: [{matches: ["https://player.bilibili.com/*"], js: ["bili_volume.js"], all_frames: true, run_at: "document_start", world: "MAIN"}],
}, null, 2);
/* the extension as a zip (stored, no compression) — folder bili-volume/ with manifest.json + bili_volume.js */
function biliExtZip() {
  const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = d => { let c = -1; for (const x of d) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const enc = new TextEncoder(), parts = [], dir = [];
  let off = 0;
  for (const [name, text] of [["bili-volume/manifest.json", BILI_EXT_MANIFEST], ["bili-volume/bili_volume.js", BILI_EXT_JS]]) {
    const n = enc.encode(name), d = enc.encode(text), c = crc(d);
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
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, 2, true); e.setUint16(10, 2, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...dir, e], {type: "application/zip"});
}

/* phone / tablet: no extensions to load there — the guide only says so */
const BILI_TOUCH = () => matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;

/* Bilibili video length in seconds (0 = unknown): VocaDB API (CORS ok — bilibili's own API is not) → that PV's length,
   else the song's. Kept per video while the page is open */
const BILI_LEN = new Map();
async function biliLength(ref) {
  if (BILI_LEN.has(ref.id)) return BILI_LEN.get(ref.id);
  let n = 0;
  try {
    if (ref.vocadb && typeof VDB !== "undefined") {
      const s = await VDB.get(`songs/${ref.vocadb}`, {fields: "PVs"});
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
    for (const ev of ["play", "pause", "playing", "ended", "seeked", "loadedmetadata", "error", "waiting", "emptied", "timeupdate"])
      el.addEventListener(ev, () => { if (!this.refs) this.fire(ev); });
    el.addEventListener("volumechange", () => { this.applyVolume(); this.fire("volumechange"); });
    setInterval(() => this.watch(), 1000);
    // back in sight: the frame's timers were slowed meanwhile — give it a moment before watch() counts its silence
    const grace = () => { if (this.br) this.br.heard = performance.now(); };
    document.addEventListener("visibilitychange", grace);
    addEventListener("appscreen", grace);
  }
  fire(ev) { this.dispatchEvent(new Event(ev)); }
  get bridged() { return !!this.refs; }
  /* mp3 */
  setSrc(src) { this.stopStream(); this.el.src = src; }
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
      const vs = ref.kind === "bili" && store.get("biliScript", false);
      const guide = ref.kind === "bili" && !vs && !this.biliLater && !(BILI_TOUCH() && store.get("biliTouchOk", false));
      // muted too while guiding: an older deployed bridge ignores &guide and would play aloud (user report: 귀테러)
      br = new BridgePlayer(this.host, ref, {start: this.start, volume: platformVolume(ref.kind, this.el.volume), mute: this.el.muted || this.priming || guide, guide, vs, on});
      br.guiding = guide;
      if (kept) kept.destroy();  // (old bridge page: replaced each time as before)
      this.kept[ref.kind] = br;
      diag("new frame", ref.kind + ":" + ref.id, document.hidden ? "hidden" : "shown");
    }
    this.br = br;
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
  applyVolume() { if (this.br) { this.br.volume(platformVolume(this.br.ref.kind, this.el.volume)); this.br.mute(this.el.muted || this.priming || !!this.br.guiding); } }
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
  get volume() { return this.el.volume; }
  set volume(v) { this.el.volume = v; }
  get muted() { return this.el.muted; }
  set muted(v) { this.el.muted = v; }
  get error() { return this.refs ? this.brErr : this.el.error; }
  get src() { return this.refs ? (this.refs[this.ri] || {}).url || "" : this.el.src; }
  get readyState() { return this.refs ? (this.br && this.br.ready && !this.priming ? 4 : 0) : this.el.readyState; }
  get playbackRate() { return this.refs ? 1 : this.el.playbackRate; }
  set playbackRate(v) { this.el.playbackRate = v; }
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
  // Bilibili volume guide (LocalMedia.biliGuide): a card over the video, one step at a time
  // (user request 2026-11-18: download + address copy buttons, developer-mode extension — no Tampermonkey)
  const bubble = document.createElement("div");
  bubble.className = "vguide";
  bubble.hidden = true;
  host.appendChild(bubble);
  const ua = navigator.userAgent, brw = /Whale\//.test(ua) ? "whale" : /Edg\//.test(ua) ? "edge" : "chrome";
  const STEPS = [
    // {A} = where the step's button (+ its note) goes — right under the line that asks for it (user request 2026-11-18)
    {t: "확장 프로그램 내려받기", b: "비리비리 영상은 우리 플레이어 볼륨이 적용되지 않아요. 작은 확장 프로그램을 한 번 넣으면 플레이어 볼륨으로 조절돼요.<br>① 아래 버튼으로 내려받기{A}② 내려받은 zip 의 <b>압축 풀기</b> (<b>bili-volume</b> 폴더가 생겨요)",
     a: `<button type="button" class="vg-cta" data-get="zip">확장 프로그램 내려받기</button>`},
    {t: "확장 프로그램 화면 열기", b: "① <b>주소 복사</b>를 누르고 새 탭 주소창에 붙여 넣어 이동{A}② 오른쪽 위 <b>개발자 모드</b> 켜기",
     a: `<button type="button" class="vg-cta" data-get="addr">주소 복사</button>`},
    {t: "폴더 넣기", b: "① <b>압축해제된 확장 프로그램을 로드합니다</b> 누르기<br>② 압축을 푼 <b>bili-volume</b> 폴더를 골라 <b>폴더 선택</b><br>③ 이 화면으로 돌아와 <b>다 했어요</b>", a: ""}];
  let step = 0, note = "", checkT = 0;
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement("textarea");  // fallback (clipboard API refused) — off screen, removed at once
    ta.value = text; ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove(); return ok;
  };
  function drawGuide() {
    if (BILI_TOUCH()) {
      bubble.innerHTML = '<div class="vg-b">비리비리 영상은 이 기기에서 플레이어 볼륨이 적용되지 않아요. 기기 볼륨으로 맞춰 주세요.</div>' +
        '<div class="vg-nav"><span></span><button type="button" class="primary" data-act="touchok">확인</button></div>';
      return;
    }
    const S = STEPS[step], last = step === STEPS.length - 1;
    const act = S.a || note ? `<div class="vg-a">${S.a}${note ? `<span class="vg-note">${note}</span>` : ""}</div>` : "";
    const body = S.b.includes("{A}") ? S.b.replace("{A}", act) : S.b + act;
    bubble.innerHTML = `<div class="vg-h"><span class="vg-n">${step + 1}/${STEPS.length}</span>${S.t}</div><div class="vg-b">${body}</div>` +
      `<div class="vg-nav"><button type="button" class="vg-later" data-act="later">나중에</button><span>` +
      (step ? '<button type="button" data-act="prev">이전</button>' : "") +
      (last ? '<button type="button" class="primary" data-act="done">다 했어요</button>' : '<button type="button" class="primary" data-act="next">다음</button>') +
      "</span></div>";
  }
  bubble.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.get === "zip") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(biliExtZip()); a.download = "bili-volume.zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      note = "내려받았어요. 압축을 풀어 주세요.";
      return drawGuide();
    }
    if (b.dataset.get === "addr") {
      note = await copy(`${brw}://extensions`) ? "주소를 복사했어요. 새 탭 주소창에 붙여 넣으세요." : "복사하지 못했어요. 다시 눌러 주세요.";
      return drawGuide();
    }
    const act = b.dataset.act;
    note = "";
    if (act === "next") step++;
    else if (act === "prev") step--;
    else if (act === "later") return audio.laterBiliGuide();
    else if (act === "touchok") return audio.touchBiliOk();
    else if (act === "done") {
      audio.recheckBili();
      note = "확장 프로그램을 확인하는 중…";
      clearTimeout(checkT);
      checkT = setTimeout(() => { if (audio.biliGuide) { note = "아직 확장 프로그램이 확인되지 않아요. 개발자 모드와 폴더를 다시 확인해 주세요."; drawGuide(); } }, 12000);
    }
    drawGuide();
  });
  const showGuide = () => {
    const g = audio.biliGuide;
    if (g && bubble.hidden) { step = 0; note = ""; drawGuide(); }
    if (!g) clearTimeout(checkT);
    bubble.hidden = !g;  // the shield stays (user request 2026-11-18: no unlocked video — the guide's buttons sit above it)
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
        uiAlert(it.deleted ? "이 곡은 원곡 영상이 삭제되어 재생할 수 없습니다." : it.site === "stream" ? "이 곡은 재생할 수 있는 영상 주소(니코니코·유튜브·비리비리·SoundCloud 등)가 없습니다." : "오프라인 폴더에서 그 곡을 찾을 수 없습니다. 폴더를 다시 연결하세요.");
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
    const it = P.now, L = P.lyr, i = P.lyrIndex(), g = L && L.times && i >= 0 ? L.groups[i] : null;
    const d = {title: it ? titleOf(it) : "", artist: it ? shortName(it.artist || "") : "", playing: !audio.paused,
      show_r: store.get("showR", true), show_t: store.get("showT", true), colors: g && !store.get("simple", false) ? (g.vc || []) : [],  // 간단 표시: 보컬 색 없이 흰색
      light: store.get("theme", "dark") === "light",  // 밝은 화면: 오버레이도 흰 테두리 + 어두운 글자 (user request 2026-11-18)
      // other-language lines (VocaDB): only the language picked in the player's 다른 언어 select (none by default)
      lines: g ? g.lines.filter(l => l.role !== "x" || (l.lang && l.lang === store.get("xLang", ""))).map(l => ({role: l.role, text: l.text})) : []};
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
