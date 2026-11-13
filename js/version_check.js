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

async function vcCheck(force) {
  if (VC.busy || VC.stale || location.protocol === "file:") return;
  if (!force && Date.now() - VC.lastAt < 2 * 60 * 1000) return;
  VC.busy = true; VC.lastAt = Date.now();
  try {
    const r = await fetch(`https://api.github.com/repos/${VC_REPO}/commits/${VC_BRANCH}`, {headers: {Accept: "application/vnd.github.sha"}, cache: "no-store"});
    if (!r.ok) return;  // offline / rate limit → try next time
    const sha = (await r.text()).trim();
    if (!sha || sha === VC.sha) return;
    const files = vcFiles(), local = vcLocal();
    // Only ask for a refresh when the site already serves the new files: GitHub Pages / githack can lag a few minutes or
    // fail a deploy (Pages 502), and then a refresh brings back the same old file → the notice came back forever.
    // A local page (this PC's folder) still says "git pull" whenever it differs from GitHub.
    const res = await Promise.all(files.map(async f => {
      const get = (u, cache) => fetch(u, {cache}).then(x => x.ok ? x.text() : null).then(t => t == null ? null : vcNorm(t));
      const [mine, latest] = await Promise.all([
        get(f.url, "force-cache"),  // what this page is running
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
const vcLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
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
      : again ? "새로고침했는데도 아직 예전 화면이에요 — 몇 분 뒤 다시 새로고침하거나 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> 를 눌러 주세요."
      : "지금 새로고침하면 바뀐 화면이 나와요. (안 바뀌면 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>)"}</span>
    <span class="vc-btns"><button class="primary" id="vcReload">👉 강력 새로고침</button><button id="vcLater">나중에</button></span>`;
  document.body.appendChild(box);
  try { box.showPopover(); } catch (e) { box.classList.add("vc-fallback"); }
  $("vcLater").onclick = () => { try { box.hidePopover(); } catch (e) {} box.remove(); };  // asks again on the next newer version
  $("vcReload").onclick = async () => {
    $("vcReload").disabled = true; $("vcReload").textContent = "받는 중…";
    try { sessionStorage.setItem("vcTried", sha); } catch (e) {}
    // hard refresh: re-download every file into the browser cache, then reload
    await Promise.all(vcFiles().map(f => fetch(f.url, {cache: "reload"}).catch(() => {})));
    location.reload();
  };
}

setTimeout(() => vcCheck(true), 4000);
setInterval(() => vcCheck(true), VC_EVERY);
document.addEventListener("visibilitychange", () => { if (!document.hidden) vcCheck(false); });
