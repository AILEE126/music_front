/* 새 버전 알림 (user request: 화면이 최신이 아니면 강력 새로고침하라는 알림창)
   No build step / version number to bump: the page compares the files it is running (html·css·js, read back from the
   browser cache) with the same files on GitHub main. GitHub's latest commit id is checked first, so the files are only
   compared when main moved since the last check. file:// pages can't read their own files → no check.
   Loaded last (after listen_together.js). */
const VC_REPO = "AILEE126/music_front", VC_BRANCH = "main";
const VC_EVERY = 10 * 60 * 1000;  // check again every 10 min (and when the tab comes back after 2 min+)
const VC = {sha: "", stale: false, lastAt: 0, busy: false};

/* repo paths of everything this page loaded from the repo (page itself + ../css + ../js) */
function vcFiles() {
  const root = new URL("../", location.href).href;
  const urls = [location.href.split(/[?#]/)[0],
    ...[...document.querySelectorAll('link[rel="stylesheet"][href]')].map(l => l.href),
    ...[...document.querySelectorAll("script[src]")].map(s => s.src)];
  return [...new Set(urls.map(u => u.split(/[?#]/)[0]).filter(u => u.startsWith(root)))]
    .map(u => ({url: u, path: u.slice(root.length)}));
}
const vcNorm = t => t.replace(/\r\n/g, "\n");
/* what this page is running, read once right at load (this file loads last). Reading it later from the browser cache
   missed updates (user report 2026-11-15): raw.githack sends no-store, so a 'cached' read actually downloaded the newest
   file — it always matched GitHub and the notice never came. */
const VC_MINE = location.protocol === "file:" ? Promise.resolve(new Map()) : Promise.all(vcFiles().map(f =>
  fetch(f.url, {cache: "force-cache"}).then(x => x.ok ? x.text() : null).then(t => [f.url, t == null ? null : vcNorm(t)]).catch(() => [f.url, null])))
  .then(a => new Map(a));
/* the player's GitHub token (when one is saved) lifts the API limit — without it every tab on this network shares 60 calls an hour */
function vcHead() {
  const g = (typeof LOCAL !== "undefined" && LOCAL.gh) || store.get("gh", null);
  return g && g.token ? {Authorization: `Bearer ${g.token}`} : {};
}

async function vcCheck(force) {
  if (VC.busy || VC.stale || location.protocol === "file:") return;
  if (!force && Date.now() - VC.lastAt < 2 * 60 * 1000) return;
  VC.busy = true; VC.lastAt = Date.now();
  try {
    const api = `https://api.github.com/repos/${VC_REPO}/commits/${VC_BRANCH}`, accept = {Accept: "application/vnd.github.sha"};
    let r = await fetch(api, {headers: {...accept, ...vcHead()}, cache: "no-store"});
    if (r.status === 401) r = await fetch(api, {headers: accept, cache: "no-store"});  // expired token: ask without it
    if (!r.ok) return;  // offline / rate limit → try next time
    const sha = (await r.text()).trim();
    if (!sha || sha === VC.sha) return;
    if (APP.on) {  // 폰 앱: runs a downloaded copy — compare its commit (web_manifest.json from the app's loader) with main
      const m = await fetch("/web_manifest.json", {cache: "no-store"}).then(x => x.json()).catch(() => null);
      VC.sha = sha;
      if (m && m.sha && m.sha !== sha) { VC.stale = true; vcShow(sha); }
      return;
    }
    const files = vcFiles(), local = vcLocal(), running = await VC_MINE;
    // Only ask for a refresh when the site already serves the new files: GitHub Pages / githack can lag a few minutes or
    // fail a deploy (Pages 502), and then a refresh brings back the same old file → the notice came back forever.
    // A local page (this PC's folder) still says "git pull" whenever it differs from GitHub.
    const res = await Promise.all(files.map(async f => {
      const get = (u, cache) => fetch(u, {cache}).then(x => x.ok ? x.text() : null).then(t => t == null ? null : vcNorm(t));
      const [mine, latest] = await Promise.all([
        running.has(f.url) ? running.get(f.url) : get(f.url, "force-cache"),  // what this page is running (read at load)
        get(`https://raw.githubusercontent.com/${VC_REPO}/${sha}/${f.path}`, "default"),
      ]);
      if (mine == null || latest == null || mine === latest) return "same";
      if (local) return "new";
      return await get(f.url, "no-store") === latest ? "new" : "behind";  // what a refresh would get now
    }));
    if (res.includes("new")) { VC.sha = sha; VC.stale = true; vcShow(sha); }
    else if (!res.includes("behind")) VC.sha = sha;  // site not caught up yet → compare again at the next check
  } catch (e) { /* offline: nothing to say */ } finally { VC.busy = false; }
}

/* notice: popover so it shows above open dialogs too */
const vcLocal = () => !APP.on && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
function vcShow(sha) {
  const local = vcLocal();
  let tried = "";
  try { tried = sessionStorage.getItem("vcTried") || ""; } catch (e) {}
  const again = tried === sha;  // already refreshed for this version and still old → the file server hasn't caught up yet
  const box = document.createElement("div");
  box.id = "vcNotice"; box.setAttribute("popover", "manual");
  // meme clip in the notice (user request; X "GIF" = mp4, saved in img/ so it doesn't depend on X)
  box.innerHTML = `<video class="vc-gif" src="../img/hard_refresh.mp4" autoplay loop muted playsinline></video>
    <b>🔄 ${local ? "GitHub 의 화면과 다릅니다" : "새 버전이 나왔어요"}</b>
    <span>${local ? "이 PC의 music_front 폴더가 예전 것이면 최신으로 받은 뒤(git pull) 새로고침해 주세요. (아직 올리지 않은 수정이 있어도 이렇게 보입니다)"
      : APP.on ? "지금 받으면 바뀐 화면이 나와요. (앱은 다시 설치하지 않아도 됩니다)"
      : again ? "새로고침했는데도 아직 예전 화면이에요 — 몇 분 뒤 다시 새로고침하거나 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> 를 눌러 주세요."
      : "지금 새로고침하면 바뀐 화면이 나와요. (안 바뀌면 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>)"}</span>
    <span class="vc-btns"><button class="primary" id="vcReload">👉 현재 곡까지만 재생 후 ${APP.on ? "업데이트" : "강력 새로고침"}</button></span>`;
  // user request 2026-11-17: no 나중에 button · the button hides the notice and reloads once the current song is over
  document.body.appendChild(box);
  try { box.showPopover(); } catch (e) { box.classList.add("vc-fallback"); }
  $("vcReload").onclick = () => {
    try { box.hidePopover(); } catch (e) {} box.remove();
    vcAfterSong(sha);
  };
}
/* reload when the current song is over: its end (the next song is played after the reload — P.resumeNext) or the song
   changing (a 같이듣기 guest follows the host). Nothing playing → now. The 같이듣기 room survives (ltBeforeReload). */
function vcAfterSong(sha) {
  const playing = SHELL.now && (SHELL.follow ? typeof ltIntent === "function" && ltIntent() : !audio.paused);
  if (!playing) return vcReload(sha);
  const key = keyOf(SHELL.now);
  let done = false;
  // in OPEN CHANNEL the channel brings its own song back (ltChStart) — nothing of the channel's is resumed here
  const go = it => { if (done) return; done = true; if (it || LT.chOn) SHELL.resumeNext(LT.chOn ? null : it); vcReload(sha); };
  SHELL.holdEnd = () => {  // song over: don't start the next one here — the page comes back playing it
    if (SHELL.follow) return false;
    const nx = SHELL.repeat === "one" ? SHELL.now : SHELL.pinned[0] || SHELL.upcoming[0];
    if (!nx) return false;  // next not known yet → let it move on, the change below reloads
    go(nx); return true;
  };
  SHELL.subscribe(() => { if (SHELL.now && keyOf(SHELL.now) !== key) go(SHELL.follow ? null : SHELL.now); });
}
async function vcReload(sha) {
  if (typeof ltBeforeReload === "function") ltBeforeReload();
  // my own queue stays (user request 2026-11-17) — in the channel it is the one kept aside; a guest follows the host's
  if (typeof qSaveForReload === "function" && !SHELL.follow) qSaveForReload(LT.chSave || {pinned: SHELL.pinned, upcoming: SHELL.upcoming, history: [...SHELL.history, ...(SHELL.now ? [SHELL.now] : [])]});
  else if (typeof qSaveForReload === "function" && LT.chSave) qSaveForReload(LT.chSave);
  if (APP.on) return location.replace("/index.html?update=1");  // the app's loader downloads the new files and opens them
  try { sessionStorage.setItem("vcTried", sha); } catch (e) {}
  // hard refresh: re-download every file into the browser cache, then reload
  await Promise.all(vcFiles().map(f => fetch(f.url, {cache: "reload"}).catch(() => {})));
  location.reload();
}

setTimeout(() => vcCheck(true), 4000);
setInterval(() => vcCheck(true), VC_EVERY);
document.addEventListener("visibilitychange", () => { if (!document.hidden) vcCheck(false); });
