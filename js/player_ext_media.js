/* 음원 플레이어 확장 · 앱 공용 (user request 2026-11-19: only what works both on a PC (extension) and in the app).
   ONE file, three uses:
   · PC extension: a loader (tools/player_ext/bg.js) fetches this file from music_front main and registers it as a user script
     (world MAIN, document_start, every frame) — updates by itself
   · phone app: injected at document start into the same frames (music_app AdBlock.java · MusicAppPlugin.swift read it from
     the bundled music_front js/)
   · the player page loads it too: there it only hands its audio chain to the player (our own mp3 — key change · 소리 크기)
   Where it runs:
   · the bridge page → window.MPX_EXT = version (the bridge tells the player {ev: "ext"} → which buttons work)
   · the players' frames (Niconico · YouTube · SoundCloud · Vimeo · Bilibili) → from the bridge {mpx: 1, rate, semis, level,
     vol, key, prior} / {biliVol}:
     배속 (playbackRate) · 키 변경 (semis: pitch without changing speed) · 소리 크기 맞추기 (level: measured loudness →
     every song at the same level) · Bilibili volume · YouTube ads cut out / skipped · Niconico / Bilibili ad boxes hidden.
     Reports {mpxAck: version} and {mpxLoud: {lufs, secs}} (what it measured, kept by the player for the next play). */
function mpxMedia() {
  const VER = 5;  // 4: Niconico · Bilibili ads hidden · 5: the PC extension loads this file from GitHub itself (old static ones are asked to reinstall once)
  const host = location.hostname;
  // the player itself is on ailee126.github.io too (/music_front/) — only the bridge path counts
  if ((host === "ailee126.github.io" && /^\/music-bridge\//.test(location.pathname)) || (/^(127\.0\.0\.1|localhost)$/.test(host) && /stream_bridge/.test(location.pathname))) {
    window.MPX_EXT = VER;  // the bridge page (deployed · under test)
    return;
  }

  /* ---- audio chain: input → (key change) → level gain → limiter → speakers, + loudness meter on the input ----
     Key change uses plain Web Audio nodes only (two delay lines swept by a saw, crossfaded): YouTube and Vimeo block
     AudioWorklet modules (their CSP), this runs everywhere. Tested 2026-11-19: 440 Hz → +12 880 · −12 220 · +3 520. */
  function makeChain(ac, connect) {
    const sr = ac.sampleRate, T = 0.1, N = Math.round(T * sr), TT = N / sr;
    const input = ac.createGain(), level = ac.createGain(), lim = ac.createDynamicsCompressor();
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;  // no clipping when a quiet song is raised
    connect(level, lim); connect(lim, ac.destination);
    const buf = f => { const b = ac.createBuffer(1, N, sr), d = b.getChannelData(0); for (let i = 0; i < N; i++) d[i] = f(i / N); return b; };
    let nodes = [], semis = 0;  // input → level directly while semis is 0 (connected below)
    function setSemis(s) {
      s = Math.max(-12, Math.min(12, Math.round(+s || 0)));
      if (s === semis) return;
      semis = s;
      nodes.forEach(x => { try { if (x.stop) x.stop(); x.disconnect(); } catch (e) {} });
      nodes = [];
      try { input.disconnect(level); } catch (e) {}
      if (!s) return connect(input, level);
      const r = 2 ** (s / 12), A = Math.abs(r - 1) * TT, up = r > 1, out = ac.createGain();
      const ramp = buf(x => up ? 1 - x : x), win = buf(x => Math.sin(Math.PI * x) ** 2), t0 = ac.currentTime + 0.02;
      for (const off of [0, TT / 2]) {
        const d = ac.createDelay(1), g = ac.createGain(), mg = ac.createGain(), ms = ac.createBufferSource(), ws = ac.createBufferSource();
        d.delayTime.value = 0; g.gain.value = 0; mg.gain.value = A;
        ms.buffer = ramp; ms.loop = true; ws.buffer = win; ws.loop = true;
        connect(ms, mg); connect(mg, d.delayTime); connect(ws, g.gain);
        connect(input, d); connect(d, g); connect(g, out);
        ms.start(t0 + off); ws.start(t0 + off);
        nodes.push(d, g, mg, ms, ws);
      }
      connect(out, level); nodes.push(out);
    }
    connect(input, level);

    /* loudness (ITU-R BS.1770): K-weighting (high shelf +4 dB @1.68 kHz, high pass 38 Hz) per channel, 400 ms blocks
       every 100 ms, power summed over channels; integrated = gated mean (absolute −70 LUFS, relative −10 LU) */
    const hs = ac.createBiquadFilter(), hp = ac.createBiquadFilter(), split = ac.createChannelSplitter(2), sink = ac.createGain();
    hs.type = "highshelf"; hs.frequency.value = 1681.97; hs.gain.value = 4;
    hp.type = "highpass"; hp.frequency.value = 38.13; hp.Q.value = 0.5;
    sink.gain.value = 0;
    const an = [ac.createAnalyser(), ac.createAnalyser()];
    connect(input, hs); connect(hs, hp); connect(hp, split);
    an.forEach((a, i) => { a.fftSize = 32768; connect(split, a, i); connect(a, sink); });
    connect(sink, ac.destination);  // analysers are only run when something pulls them
    const blk = Math.round(0.4 * sr), data = new Float32Array(32768);
    function blockPower() {
      let p = 0;
      for (const a of an) {
        a.getFloatTimeDomainData(data);
        let s = 0; for (let i = data.length - blk; i < data.length; i++) s += data[i] * data[i];
        p += s / blk;
      }
      return p;
    }
    /* the limiter works only while 소리 크기 맞추기 is on (off = the song exactly as the site gives it) */
    const limit = on => { lim.threshold.value = on ? -1.5 : 0; lim.ratio.value = on ? 20 : 1; };
    limit(false);
    return {input, level, setSemis, blockPower, limit, get semis() { return semis; }};
  }
  const lufs = p => -0.691 + 10 * Math.log10(p + 1e-20);
  function integrated(blocks) {
    const abs = blocks.filter(p => lufs(p) > -70);
    if (!abs.length) return null;
    const rel = lufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const g = abs.filter(p => lufs(p) > rel);
    return g.length ? lufs(g.reduce((a, b) => a + b, 0) / g.length) : null;
  }
  /* 소리 크기 맞추기: the song's own loudness C (measured on what the media gives, its volume f divided out) → level gain
     so that what plays = TARGET × vol (the player's slider × fade, sent as vol). f = the media element's volume: the sites'
     volume knobs (and their own leveling) all end in it, and Web Audio gets the sound after it (tested 2026-11-19).
     C: this video's earlier full measure (prior, kept by the player) for the first minute, else our own integrated measure
     once 3 s are in, before that YouTube's own figure (hint), else no change. */
  const TARGET = -14;
  function makeLeveler(chain, ac, mediaVol) {
    const L = {on: false, vol: 1, prior: null, hint: null, blocks: [], key: "", sent: 0};
    let t = 0;
    L.reset = key => { L.key = key; L.blocks = []; L.prior = null; L.hint = null; L.sent = 0; };
    L.content = () => {
      if (L.prior != null && L.blocks.length < 600) return L.prior;
      if (L.blocks.length >= 30) { const c = integrated(L.blocks); if (c != null) return c; }
      return L.prior != null ? L.prior : L.hint;
    };
    L.apply = () => {
      const g = chain.level.gain, C = L.content(), f = Math.max(mediaVol(), 1e-4);
      let want = 1;
      if (L.on && C != null && L.vol > 0.003) {
        want = 10 ** ((TARGET - C) / 20) * L.vol / f;
        want = Math.max(0.05, Math.min(want, 8 * L.vol / f, 8));  // at most +18 dB, never above the slider ×8
      }
      chain.limit(L.on);
      g.setTargetAtTime(want, ac.currentTime, L.blocks.length < 100 ? 1 : 3);  // settles fast at first, then slowly (no pumping)
    };
    L.tick = playing => {
      if (playing && L.on) {
        const f = mediaVol();
        if (f > 0.01) { L.blocks.push(chain.blockPower() / (f * f)); if (L.blocks.length > 20000) L.blocks.splice(0, 5000); }
        if (++t % 5 === 0) L.apply();
        // report what we know: after 30 s, then every 30 s (the player keeps it for the next play of this video)
        const secs = L.blocks.length / 10;
        if (secs >= 30 && secs - L.sent >= 30) { L.sent = secs; L.report(); }
      }
    };
    L.report = () => { const C = integrated(L.blocks); if (C != null && L.blocks.length >= 100) parent.postMessage({mpxLoud: {lufs: +C.toFixed(2), secs: Math.round(L.blocks.length / 10), key: L.key}}, "*"); };
    return L;
  }

  if (window.top === window) {  // the player page: our own mp3 (<audio>) through the same chain
    window.MPX_VER = VER;
    window.mpxAudioFor = media => {
      const ac = new AudioContext(), src = ac.createMediaElementSource(media);
      const chain = makeChain(ac, (a, b, i) => i === undefined ? a.connect(b) : a.connect(b, i));
      src.connect(chain.input);
      const lev = makeLeveler(chain, ac, () => media.muted ? 0 : media.volume);
      lev.report = () => {};
      setInterval(() => { if (ac.state === "suspended" && !media.paused) ac.resume().catch(() => {}); lev.tick(!media.paused); }, 100);
      return {ac, chain, lev};
    };
    return;
  }

  const media = new Set(), play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { media.add(this); return play.apply(this, arguments); };  // audio kept out of the page (SoundCloud)
  const all = () => { document.querySelectorAll("video,audio").forEach(m => media.add(m)); return media; };
  const main = () => [...all()].filter(m => m.duration > 0).sort((a, b) => (a.paused - b.paused) || (b.duration - a.duration))[0] || null;
  let rate = 1, vol = null, fx = {semis: 0, level: false, vol: 1, key: "", prior: null};

  /* 배속 */
  const setRate = () => { for (const m of all()) if (Math.abs(m.playbackRate - rate) > 0.001) { m.defaultPlaybackRate = rate; m.playbackRate = rate; } };
  /* Bilibili volume: its own player (window.player) */
  const setVol = () => {
    const p = window.player, v = document.querySelector("video");
    if (vol === null || !p || typeof p.setVolume !== "function") return;
    try { if (Math.abs((+p.getVolume() || 0) - vol) > 0.005 || (v && v.muted)) p.setVolume(vol); } catch (e) {}
  };

  /* audio: made only once key change or 소리 크기 is wanted (a media element can't be taken back out of Web Audio).
     SoundCloud plays through its own AudioContext → our chain goes between its graph and its speakers (connect hook). */
  const ctxs = new Map();  // AudioContext → {chain, lev}
  let own = null, ownEl = null, A = null;  // our context for a plain media element · the active {chain, lev}
  const rawConnect = AudioNode.prototype.connect;
  const connect = (a, b, i) => i === undefined ? rawConnect.call(a, b) : rawConnect.call(a, b, i);
  AudioNode.prototype.connect = function (d, ...rest) {  // the site's own nodes only — ours use rawConnect
    if (d instanceof AudioDestinationNode) return rawConnect.call(this, chainOf(this.context).chain.input, ...rest);
    return rawConnect.call(this, d, ...rest);
  };
  function chainOf(ac) {
    if (!ctxs.has(ac)) {
      const chain = makeChain(ac, connect);
      const lev = makeLeveler(chain, ac, () => { const m = main(); return !m || m.muted ? 0 : m.volume; });
      ctxs.set(ac, {chain, lev});
      lev.reset(fx.key); lev.prior = fx.prior;
    }
    return ctxs.get(ac);
  }
  function wantAudio() {
    if (!(fx.semis || fx.level)) return A;
    if (A) return A;
    if (ctxs.size) return (A = [...ctxs.values()][0]);  // the site's own graph (SoundCloud)
    const m = main();
    if (!m) return null;
    if (!own) own = new AudioContext();
    if (own.state !== "running") { own.resume().catch(() => {}); return null; }  // not allowed to start yet — the media keeps playing as it is
    try {
      const src = own.createMediaElementSource(m); ownEl = m;
      A = chainOf(own); connect(src, A.chain.input);
    } catch (e) { return null; }  // already in someone else's graph: the connect hook takes it
    return A;
  }
  function applyFx() {
    const a = wantAudio(); if (!a) return;
    a.chain.setSemis(fx.semis);
    a.lev.on = !!fx.level; a.lev.vol = fx.vol;
    if (a.lev.key !== fx.key) { a.lev.report(); a.lev.reset(fx.key); }  // next song in the same player: keep what was measured
    if (a.lev.prior == null && fx.prior != null) a.lev.prior = fx.prior;
    if (a.lev.hint == null && /youtube/.test(host)) a.lev.hint = ytPrior();
    a.lev.apply();
  }
  /* YouTube's own figure for this video ("cont.-5.2dB tgt.-14.0dB": the song is 5.2 dB over its −14 target) */
  function ytPrior() {
    try {
      const s = document.querySelector("#movie_player").getStatsForNerds().volume || "";
      const m = s.match(/cont\.\s*(-?[\d.]+)dB\s*tgt\.\s*(-?[\d.]+)dB/);
      return m ? +m[2] - +m[1] : null;
    } catch (e) { return null; }
  }

  addEventListener("message", e => {
    const d = e.data;
    if (e.source !== parent || !d) return;
    if ("biliVol" in d) {
      if (typeof d.biliVol === "number") { vol = Math.max(0, Math.min(1, d.biliVol)); setVol(); }
      parent.postMessage({biliVolAck: 1, mpxAck: VER}, "*");
    }
    if (d.mpx) {
      if (typeof d.rate === "number") { rate = Math.max(0.25, Math.min(4, d.rate)); setRate(); }
      for (const k of ["semis", "level", "vol", "key", "prior"]) if (k in d) fx[k] = d[k];
      applyFx();
      parent.postMessage({mpxAck: VER}, "*");
    }
  });
  document.addEventListener("ratechange", () => { if (rate !== 1) setRate(); }, true);  // the player set it back
  setInterval(() => { setVol(); if (rate !== 1) setRate(); }, 500);  // players come up after the first message
  setInterval(() => {  // 10 a second: loudness blocks; a context the browser suspended is woken while the song plays
    if (!A) { if (fx.semis || fx.level) applyFx(); return; }
    const m = main(), playing = !!m && !m.paused;
    for (const ac of ctxs.keys()) if (ac.state === "suspended" && playing) ac.resume().catch(() => {});
    if (ownEl && m && m !== ownEl && own) {  // the site swapped its video element (rare) → take the new one too
      try { connect(own.createMediaElementSource(m), A.chain.input); ownEl = m; } catch (e) {}
    }
    A.lev.tick(playing);
  }, 100);
  addEventListener("pagehide", () => { if (A) A.lev.report(); });
  window.__mpx = {fx, get A() { return A; }, get rate() { return rate; }};  // for checking from devtools

  /* YouTube ads (user request 2026-11-15 app · 2026-11-19 also the PC extension): ad videos come from the same servers as
     the song, so the ad entries are cut out of the player's data, and an ad that still shows is jumped to its end
     (tested 2026-11-19: a 15 s + 197 s pod → the song plays ~3 s later). */
  if (/(^|\.)youtube(-nocookie)?\.com$/.test(host) && !window.__musicAdSkip) {
    window.__musicAdSkip = {cut: 0, skipped: 0};  // counts, for checking from devtools
    const KEYS = ["adPlacements", "adSlots", "playerAds", "adBreakHeartbeatParams"];
    const prune = o => {
      if (!o || typeof o !== "object") return o;
      for (const k of KEYS) if (k in o) { delete o[k]; window.__musicAdSkip.cut++; }
      if (o.playerResponse) prune(o.playerResponse);
      if (o.embedded_player_response) prune(o.embedded_player_response);
      return o;
    };
    const parse = JSON.parse;
    JSON.parse = function () { return prune(parse.apply(this, arguments)); };
    const json = Response.prototype.json;
    Response.prototype.json = function () { return json.call(this).then(prune); };
    setInterval(() => {
      const p = document.querySelector(".html5-video-player");
      if (!p || !p.classList.contains("ad-showing")) return;
      window.__musicAdSkip.skipped++;
      const v = p.querySelector("video");
      if (v && isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration;
      const b = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button");
      if (b) b.click();
    }, 300);
  }

  /* Niconico · Bilibili ads (user request 2026-11-20, PC extension + app): Niconico's embed puts a 468×60 banner over the
     bottom of the video with a ✕ above it (an empty black box when the ad doesn't load) — container class is hashed, so it
     is found by its banner (#overlayBanner, loads res.ads.nicovideo.jp ads2.js) and the stable `ads-in-back`. Bilibili's
     embed ends on a "download the Bilibili app" panel. Checked 2026-11-20: SoundCloud · Vimeo embeds show no ads. */
  const HIDE = {"embed.nicovideo.jp": "#overlayBanner, .ads-in-back, div:has(> #overlayBanner) { display: none !important; }",
    "player.bilibili.com": ".bpx-player-embeded-ending-wrap { display: none !important; }"}[host];
  if (HIDE) {
    const st = document.createElement("style");
    st.textContent = HIDE;
    const put = () => { if (!st.isConnected) (document.head || document.documentElement).appendChild(st); };
    put(); document.addEventListener("DOMContentLoaded", put);  // the page may rewrite <head> while loading
  }
}
mpxMedia();
