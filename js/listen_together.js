/* 같이듣기 (user request: enter a one-time code each time and listen together)
   · 방 만들기: 6자리 번호가 새로 나옴 — 방을 닫거나 화면을 새로 열면 그 번호는 끝 (다음엔 새 번호)
   · 들어가기: 번호를 넣으면 방장(호스트)이 트는 곡·재생/멈춤·위치를 그대로 따라감 (음량은 각자)
   · 들어온 사람(손님)은 음량·나가기만 — ▶/⏸·⏭/⏮·위치 옮기기·다른 곡 틀기는 막음 (user request: 방장만 조작)
   서버가 없는 화면이라 브라우저끼리 바로 잇는 WebRTC(PeerJS — 번호로 서로 찾는 일만 PeerJS 공개 서버)를 씀.
   player_screen.js 다음에 읽음 (SHELL·audio·keyOf·LIB·OFFDIR·ONLINE 을 씀) */
const LT_PEERJS = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
const LT_PREFIX = "ailee126-noinjeong-lt-";  // PeerJS id = 이 앞머리 + 번호
const LT = {role: "", code: "", peer: null, conns: new Map(), host: null, members: [], status: "", lastHeard: 0};
let ltApplying = 0;  // 방장 상태를 따라 하는 중 (이때 바뀐 건 다시 보내지 않음)
const ltQuiet = fn => { ltApplying++; try { return fn(); } finally { ltApplying--; } };
const ltName = () => $("ltName").value.trim() || store.get("reportWho", "") || "이름 없음";

function ltLoadPeerJs() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = LT_PEERJS; s.onload = res; s.onerror = () => rej(new Error("같이듣기 연결 도구를 받지 못했습니다 (인터넷 확인)"));
    document.head.appendChild(s);
  });
}
const ltNewCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
const ltShowCode = c => c.slice(0, 3) + " " + c.slice(3);
/* 재생하려는 중인가 (온라인 곡은 뜨는 동안 paused 라 재생 의도로 봄) */
const ltIntent = () => audio.bridged ? !!audio.autoplay : !audio.paused;
const ltStrip = it => Object.fromEntries(Object.entries(it).filter(([k]) => !k.startsWith("_")));
/* 받은 곡 → 이 화면의 곡 (같은 키 → 같은 이름 → 온라인 곡이면 받은 곡 그대로 → 제목이 같은 온라인 곡) */
function ltFindItem(key, item) {
  const pools = [LIB.items, (typeof OFFDIR !== "undefined" && OFFDIR && OFFDIR.items) || []];
  for (const p of pools) { const x = p.find(x => keyOf(x) === key); if (x) return x; }
  if (!item) return null;
  if (item.site === "stream") { const x = {...item}; prepItem(x); return x; }
  return LIB.items.find(x => x.title === item.title && canPlay(x)) || null;  // 방장의 mp3 곡 → 같은 곡의 온라인 곡
}

/* ---------- 방장 ---------- */
function ltState() {
  const it = SHELL.now;
  return {key: it ? keyOf(it) : "", item: it ? ltStrip(it) : null, pos: audio.currentTime || 0, playing: ltIntent(), run: !audio.paused, ready: audio.readyState > 0};
}
let ltSendTimer = 0;
function ltBroadcast() {  // 잇따른 변화는 한 번에
  if (LT.role !== "host") return;
  clearTimeout(ltSendTimer);
  ltSendTimer = setTimeout(() => { const m = {t: "state", s: ltState()}; LT.conns.forEach((_, c) => ltSend(c, m)); }, 60);
}
function ltSend(c, m) { try { if (c.open) c.send(m); } catch (e) {} }
function ltMembers() {
  LT.members = [ltName(), ...[...LT.conns.values()].map(v => v.name)];
  const m = {t: "members", list: LT.members};
  LT.conns.forEach((_, c) => ltSend(c, m));
  ltRender();
}
async function ltHost() {
  ltLeave(true);
  LT.status = "방을 만드는 중…"; ltRender();
  try { await ltLoadPeerJs(); } catch (e) { LT.status = e.message; return ltRender(); }
  const tryOpen = (left) => {
    const code = ltNewCode(), peer = new Peer(LT_PREFIX + code);
    LT.peer = peer;
    peer.on("open", () => {
      if (LT.peer !== peer) return;
      LT.role = "host"; LT.code = code; LT.status = ""; SHELL.follow = false;
      ltMembers();
    });
    peer.on("connection", c => {
      c.on("open", () => { LT.conns.set(c, {name: (c.metadata && c.metadata.name) || "손님", seen: Date.now()}); ltMembers(); ltSend(c, {t: "state", s: ltState()}); });
      c.on("data", m => ltHostGot(c, m));
      c.on("close", () => { if (LT.conns.delete(c)) ltMembers(); });
      c.on("error", () => { if (LT.conns.delete(c)) ltMembers(); });
    });
    peer.on("error", e => {
      if (LT.peer !== peer) return;
      if (e.type === "unavailable-id" && left > 0) { peer.destroy(); return tryOpen(left - 1); }  // 번호가 겹침 → 다른 번호
      if (LT.role === "host" && e.type !== "network" && e.type !== "server-error" && e.type !== "socket-error") return;  // 손님 하나의 문제
      ltLeave(true); LT.status = ltErrText(e); ltRender();
    });
    // the PeerJS server link dropped: guests already joined keep working, new guests can't join until it comes back
    peer.on("disconnected", () => { if (LT.peer === peer && LT.role === "host") setTimeout(() => { if (LT.peer === peer && !peer.destroyed) try { peer.reconnect(); } catch (e) {} }, 2000); });
  };
  tryOpen(3);
}
function ltHostGot(c, m) {
  const v = LT.conns.get(c); if (!v || !m) return;
  v.seen = Date.now();
}

/* ---------- 손님 ---------- */
async function ltJoin(code) {
  code = String(code || "").replace(/\D/g, "");
  if (code.length !== 6) { LT.status = "번호 6자리를 넣어 주세요"; return ltRender(); }
  ltLeave(true);
  LT.status = "들어가는 중…"; ltRender();
  try { await ltLoadPeerJs(); } catch (e) { LT.status = e.message; return ltRender(); }
  const peer = LT.peer = new Peer();
  peer.on("open", () => {
    if (LT.peer !== peer) return;
    const c = peer.connect(LT_PREFIX + code, {reliable: true, metadata: {name: ltName()}});
    const t = setTimeout(() => { if (LT.peer === peer && LT.role !== "guest") { ltLeave(true); LT.status = "방에 들어가지 못했습니다 — 번호를 확인하거나 다시 해 보세요"; ltRender(); } }, 15000);
    c.on("open", () => {
      clearTimeout(t);
      if (LT.peer !== peer) return c.close();
      LT.role = "guest"; LT.code = code; LT.host = c; LT.status = ""; LT.lastHeard = Date.now();
      SHELL.follow = true;  // 곡이 끝나도 혼자 다음 곡으로 넘어가지 않음 (방장이 넘김)
      ltRender();
    });
    c.on("data", m => ltGuestGot(m));
    c.on("close", () => { if (LT.host === c) { ltLeave(true); LT.status = "방이 닫혔습니다"; ltRender(); } });
  });
  peer.on("error", e => {
    if (LT.peer !== peer) return;
    ltLeave(true);
    LT.status = e.type === "peer-unavailable" ? "그 번호의 방이 없습니다 — 번호를 확인해 주세요" : ltErrText(e);
    ltRender();
  });
}
function ltGuestGot(m) {
  if (!m) return;
  LT.lastHeard = Date.now();
  if (m.t === "members") { LT.members = m.list || []; return ltRender(); }
  if (m.t === "state") ltApply(m.s, performance.now());
}
function ltApply(s, got) {
  if (!s || !s.key) return;
  const it = ltFindItem(s.key, s.item);
  if (!it || !canPlay(it)) { LT.status = `방장이 트는 곡을 여기서 틀 수 없습니다: ${(s.item && s.item.title) || s.key}`; return ltRender(); }
  if (LT.status) { LT.status = ""; ltRender(); }
  if (!SHELL.now || keyOf(SHELL.now) !== keyOf(it)) return ltQuiet(() => SHELL.load(it, s.playing, "pick"));  // 위치는 다음 상태(3초 안)에 맞춤
  if (s.playing && !ltIntent()) ltQuiet(() => { audio.play().catch(() => {}); });
  else if (!s.playing && ltIntent()) ltQuiet(() => audio.pause());
  // position: only when both sides are really playing (or both stopped) — not while one of them is still loading
  if (!s.ready || audio.readyState <= 0) return;
  const exp = s.pos + (s.run ? (performance.now() - got) / 1000 : 0), both = s.run && !audio.paused, still = !s.playing && audio.paused;
  if ((both || still) && Math.abs(audio.currentTime - exp) > (both ? 2 : 1)) ltQuiet(() => { audio.currentTime = exp; });
}

function ltErrText(e) {
  if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) return "같이듣기 연결 서버에 닿지 못했습니다 (인터넷 확인 · 잠시 뒤 다시)";
  if (e.type === "browser-incompatible" || e.type === "webrtc") return "이 브라우저에서는 같이듣기를 할 수 없습니다";
  return "같이듣기 연결 오류 (" + (e.type || e.message || e) + ")";
}
function ltLeave(quiet) {
  if (LT.role === "host") LT.conns.forEach((_, c) => ltSend(c, {t: "bye"}));
  const peer = LT.peer;
  LT.peer = null; LT.role = ""; LT.code = ""; LT.host = null; LT.members = []; LT.conns = new Map();
  SHELL.follow = false;
  if (peer) setTimeout(() => { try { peer.destroy(); } catch (e) {} }, 300);  // "bye" 가 먼저 나가게
  if (!quiet) LT.status = "";
  ltRender();
}

/* ---------- 재생기에 걸기: 방장은 바뀔 때마다 알리고, 손님이 직접 하는 재생 조작은 막음 (방장 상태를 따라 할 때만 통과) ---------- */
{
  const locked = () => LT.role === "guest" && !ltApplying;
  const load = SHELL.load, next = SHELL.next, prev = SHELL.prev, toggle = SHELL.toggle;
  SHELL.load = function (it, autoplay = true, how = "") {
    if (locked()) return Promise.resolve();
    const r = load.call(this, it, autoplay, how);
    ltBroadcast();
    return r;
  };
  SHELL.next = function (auto, how) { if (!locked()) return next.call(this, auto, how); };  // 곡 끝·못 튼 곡도 방장이 넘김
  SHELL.prev = function () { if (!locked()) return prev.call(this); };
  SHELL.toggle = function () { if (!locked()) return toggle.call(this); };
  // every other way (keys ←/→, lyrics click, seek bar, video click) ends up here
  const proto = Object.getPrototypeOf(audio), ct = Object.getOwnPropertyDescriptor(proto, "currentTime");
  Object.defineProperty(audio, "currentTime", {
    configurable: true,
    get() { return ct.get.call(this); },
    set(t) { if (!locked()) ct.set.call(this, t); else setTimeout(() => tick(true), 0); },  // 막으면 위치 막대를 제자리로
  });
  audio.play = function () { return locked() ? Promise.resolve() : proto.play.call(this); };
  audio.pause = function () { if (!locked()) return proto.pause.call(this); };
  ["play", "pause", "seeked", "loadedmetadata"].forEach(ev => audio.addEventListener(ev, ltBroadcast));
  setInterval(() => {
    if (LT.role === "host") {
      ltBroadcast();
      let gone = false;
      LT.conns.forEach((v, c) => { if (Date.now() - v.seen > 20000 && !c.open) { LT.conns.delete(c); gone = true; } });
      if (gone) ltMembers();
    } else if (LT.role === "guest") {
      ltSend(LT.host, {t: "ping"});
      if (Date.now() - LT.lastHeard > 15000) { ltLeave(true); LT.status = "방장과 연결이 끊겼습니다"; ltRender(); }
    }
  }, 3000);
  addEventListener("pagehide", () => ltLeave(true));
}

/* ---------- 화면 ---------- */
function ltRender() {
  const b = $("btnListen"), n = LT.members.length;
  b.classList.toggle("on", !!LT.role);
  b.textContent = LT.role ? `🎧 같이듣기 · ${n || 1}명` : "🎧 같이듣기";
  $("ltIdle").hidden = !!LT.role;
  $("ltRoom").hidden = !LT.role;
  $("ltStatus").textContent = LT.status;
  $("ltStatus").hidden = !LT.status;
  $("ltLeave").hidden = !LT.role;
  // guest: only volume and leaving — the play controls look disabled
  const guest = LT.role === "guest";
  for (const id of ["btnPlay", "btnPrev", "btnNext", "seek", "btnPlayView", "btnShuffle", "btnRepeat", "btnEdit"]) $(id).disabled = guest;
  document.body.classList.toggle("lt-guest", guest);
  if (!LT.role) return;
  $("ltCode").textContent = ltShowCode(LT.code);
  $("ltRoomHint").textContent = LT.role === "host"
    ? "이 번호를 같이 들을 사람에게 알려 주세요. 방을 닫으면 이 번호는 더 쓸 수 없습니다."
    : "방장이 트는 곡을 같이 듣는 중입니다. 곡 바꾸기·재생·멈춤·위치 옮기기는 방장만 할 수 있고, 여기서는 음량만 바꿀 수 있습니다.";
  $("ltMembers").innerHTML = LT.members.map((m, i) => `<li>${esc(m)}${i === 0 ? ' <span class="r">방장</span>' : ""}</li>`).join("");
  $("ltLeave").textContent = LT.role === "host" ? "방 닫기" : "나가기";
}
$("btnListen").onclick = () => {
  $("ltName").value = store.get("reportWho", "");
  ltRender();
  $("listenDlg").showModal();
  if (!LT.role) $("ltJoinCode").focus();
};
$("ltName").addEventListener("input", () => store.set("reportWho", $("ltName").value.trim()));  // 오류 신고의 보내는 사람과 같은 이름
$("ltMake").onclick = () => ltHost();
$("ltJoin").onclick = () => ltJoin($("ltJoinCode").value);
$("ltJoinCode").addEventListener("keydown", e => { if (e.key === "Enter") ltJoin($("ltJoinCode").value); });
$("ltLeave").onclick = () => ltLeave(false);
$("ltClose").onclick = () => $("listenDlg").close();
ltRender();
