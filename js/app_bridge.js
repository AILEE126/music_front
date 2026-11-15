/* 폰 앱 (music_app — 안드로이드·iOS 껍데기) 안에서 열렸을 때 폰 기능 쓰기
   User request 2026-11-15: the app is only a shell that runs this repo's files (downloaded, updated without reinstall);
   what a phone browser can't do comes from the app's plugin "MusicApp":
   · 백그라운드 재생: play state + title → the app keeps playing with the screen off (notification / lock-screen buttons)
   · 오프라인 모드: the mp3 folder is picked with the phone's folder picker (remembered) — offline_folder.js uses APP.pickDir
   · 화면 꺼짐: APP.screenOff — lyrics stop being followed, the video shrinks to a low quality (battery)
   · 가사 오버레이: the same /api/now · /api/ovset the PC overlay gets go to the app's floating lyrics window
     (html/lyrics_overlay_mobile.html — change its look there)
   Outside the app APP.on is false and nothing here runs. */
var APP = (() => {
  const C = window.Capacitor;
  const on = !!(C && C.isNativePlatform && C.isNativePlatform());
  const A = {on, platform: on ? C.getPlatform() : "", publicUrl: "https://raw.githack.com/AILEE126/music_front/main/html/player_screen.html"};
  if (!on) return A;
  const M = C.Plugins.MusicApp;
  A.native = M;

  /* ---- mp3 folder: handles shaped like the browser's folder handles (what offline_folder.js reads) ---- */
  const b64bytes = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
  const mediaUrl = uri => `/_app_media_?u=${encodeURIComponent(uri)}`;
  function fileHandle(dir, f) {
    const read = async (offset, length) => b64bytes((await M.readFile({uri: f.uri, offset, length})).data);
    const blobPart = (a, b) => ({arrayBuffer: async () => (await read(a, Math.max(0, b - a))).buffer});
    return {kind: "file", name: f.name,
      async getFile() {
        // not loaded into memory: tags / json read only the bytes asked for, the audio plays from the app's media path
        // (iOS gives a file path: Capacitor serves it, ranges included)
        return {name: f.name, size: f.size, lastModified: f.modified, _src: f.src ? C.convertFileSrc(f.src) : mediaUrl(f.uri),
          slice: (a = 0, b = f.size) => blobPart(a, Math.min(b, f.size)),
          arrayBuffer: async () => (await read(0, f.size)).buffer,
          text: async () => new TextDecoder().decode(await read(0, f.size))};
      },
      async createWritable() {
        let text = "";
        return {write: async t => { text += t; }, close: () => M.writeText({uri: f.uri, text})};
      }};
  }
  function dirHandle(d) {
    return {kind: "directory", name: d.name, _app: d,
      async *entries() {
        for (const f of (await M.listFolder({tree: d.tree, uri: d.uri})).items)
          yield [f.name, f.kind === "directory" ? dirHandle({...d, uri: f.uri, name: f.name}) : fileHandle(d, f)];
      },
      queryPermission: async () => "granted", requestPermission: async () => "granted"};
  }
  A.pickDir = async () => {
    try { return dirHandle(await M.pickFolder()); }
    catch (e) { const x = new Error("폴더를 고르지 않았습니다."); if (e.code === "cancel") x.name = "AbortError"; throw x; }
  };
  A.savedDir = async () => { const d = await M.savedFolder(); return d && d.uri ? dirHandle(d) : null; };

  /* ---- lyrics overlay: answers what local_files.js would ask the PC overlay (127.0.0.1:47613) ---- */
  let ovOn = false;
  M.overlayState().then(s => { ovOn = !!s.on; }).catch(() => {});
  const ovset = () => ({...OVSET_DEFAULTS, ...store.get("ovset", {}), enabled: ovOn});
  A.overlay = async (path, post, body) => {
    if (path === "/api/now") { if (post) M.overlayNow(body).catch(() => {}); return {ok: true}; }
    if (path === "/api/ovprograms") return {items: [], running: true};  // the overlay is part of the app: always "running"
    if (post) {
      const {enabled, ...rest} = body;
      store.set("ovset", {...store.get("ovset", {}), ...rest});
      if (enabled !== undefined) {
        const r = await M.overlayShow({on: !!enabled});
        ovOn = !!r.on;
        if (enabled && r.unsupported) uiAlert("아이폰 앱에는 아직 가사 오버레이가 없습니다.");
        else if (enabled && !r.allowed) uiAlert("가사 오버레이를 띄우려면 '다른 앱 위에 표시'를 허용해 주세요.");
      }
      M.overlaySet(ovset()).catch(() => {});
    }
    return ovset();
  };
  M.overlaySet(ovset()).catch(() => {});

  /* ---- phone notification (user request 2026-11-15: 같이듣기 신청곡 → the host's phone rings even with the app in the
     background) — older app builds have no 'alert': nothing happens there ---- */
  A.notify = (title, body) => M.alert({title, body}).catch(() => {});

  /* ---- earphones (user request 2026-11-15, 설정 on the phone): APP.ear true/false (null = this app build can't tell) ·
     window event "appheadset" {on} when they are plugged / unplugged ---- */
  A.ear = null;
  M.headset().then(s => { A.ear = !!s.on; }).catch(() => {});
  M.addListener("headset", ({on}) => { A.ear = !!on; dispatchEvent(new CustomEvent("appheadset", {detail: {on: !!on}})); });

  /* ---- screen off (user request 2026-11-15, battery): APP.screenOff · window event "appscreen" when it changes.
     The page is kept "visible" for background play, so document.hidden can't tell; older app builds never send it. ---- */
  A.screenOff = false;
  const setScreen = on => { if (A.screenOff === !on) return; A.screenOff = !on; dispatchEvent(new CustomEvent("appscreen", {detail: {on}})); };
  M.addListener("screen", ({on}) => setScreen(!!on));
  M.screen().then(s => setScreen(!!s.on)).catch(() => {});

  /* ---- background play: tell the app what plays; its notification / lock-screen / earphone buttons come back here ---- */
  addEventListener("DOMContentLoaded", () => {
    if (typeof SHELL === "undefined") return;
    const audio = SHELL.audio;
    let last = "";
    const send = () => {
      const it = SHELL.now, s = {playing: !!it && !audio.paused, title: it ? it.title || "" : "", artist: it ? shortName(it.artist || "") : ""};
      const k = JSON.stringify(s);
      if (k !== last) { last = k; M.state(s).catch(() => {}); }
    };
    ["play", "playing", "pause", "ended", "emptied", "sourcechange"].forEach(ev => audio.addEventListener(ev, send));
    setInterval(send, 2000);
    M.addListener("media", ({action}) => {
      if (action === "next") SHELL.next(false);
      else if (action === "prev") SHELL.prev();
      else if (action === "play") { if (audio.paused) SHELL.toggle(); }
      else if (action === "pause") { if (!audio.paused) SHELL.toggle(); }
      else if (SHELL.now) SHELL.toggle();
    });
  });
  return A;
})();
