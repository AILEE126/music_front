/* 같이듣기 (user request: enter a one-time code each time and listen together)
   · 방 만들기: 6자리 번호가 새로 나옴 — 방을 닫거나 화면을 새로 열면 그 번호는 끝 (다음엔 새 번호)
   · 들어가기: 번호를 넣으면 방장(호스트)이 트는 곡·재생/멈춤·위치를 그대로 따라감 (음량은 각자)
   · 들어온 사람(손님)은 음량·나가기만 — ▶/⏸·⏭/⏮·위치 옮기기·다른 곡 틀기는 막음 (user request: 방장만 조작)
   · 방 목록 (user request): 만든 방은 모두 목록에 보임 (화면을 열 때 한 번 · 새로고침 버튼으로만 다시 찾음) — 공개방은 눌러서 바로, 비밀방은 방장이 정한 비밀번호를 넣어야 들어감.
     방 안에 있을 때도 목록을 볼 수 있음. 메인 화면 버튼에 방 수 · 내 방 인원 (user request)
   · 바로 들어오는 링크: 화면 주소 + #lt=<번호> (비밀방은 링크 + 비밀번호)
   · 닉네임이 없으면 방을 만들거나 들어갈 수 없음 (user request: 빨간 * · 시도하면 칸 아래 "필수값입니다.") · 방 화면에 방장 이름
   · 닉네임 중복 (user request): 지금 같이듣기 방에 들어가 있는 사람의 닉네임과 같으면 "사용중인 닉네임입니다."
     (방 목록을 바로 다시 찾아 확인 + 방장도 들어올 때 확인 — 같은 브라우저가 다시 잇는 건 uid 로 구분)
   · 방장은 노란 왕관 아이콘 (user request: '방장' 글자 없음) · 방을 만들거나 들어가거나 나가면 방 목록을 바로 다시 찾음
   · 시간 맞추기 (user request): 손님이 처음 들어올 때와 새 곡이 시작될 때 곡이 실제로 울리기 시작하면 방장 상태를 바로 다시 받아
     0.1초 안으로 맞춤 (user request: 차이 거의 없게 — 주고받는 시간의 절반 + 이 기기의 '옮기는 데 걸리는 시간'(LT.lead,
     맞춘 뒤 남은 차이로 배움)을 더함, 최대 4번). 그 뒤로는 0.5초 넘게 벌어질 때만 맞춤
   · 신청곡 구역은 방 안에서 늘 보임 (user request 2026-11-12): 신청곡 목록(한 번에 5개, 넘으면 쪽 넘기기) 아래 맨 밑에 검색창 —
     메인 화면 검색 드롭다운과 같은 항목 (검색어가 든 곡·보컬·프로듀서… + 곡 수) → 고르면 그 곡들 → 곡을 고르면 신청. 방장이 고르면 바로 대기열
     손님이 맞춰 옮길 때마다 '방장과 싱크조정중...' 이 화면 아래에 잠깐 뜸 (user request)
   · 손님이 검색해서 요청 → '요청중' · 방장이 수락하면 '직접 넣은 곡'에 들어가고 '재생대기' →
     틀면 '재생중' → 다 틀고 다음 곡으로 넘어가면 사라짐. 요청곡과 상태는 방 안 모두에게 보임 (방장은 거절도 가능)
   · 대기열 (user request): 방장의 '직접 넣은 곡'·'다음 곡'을 손님도 그대로 받음 (중간에 끼워 넣은 곡도) — 손님은 대기열을 못 바꿈
   · 방이 생기거나 닫히거나 인원이 바뀌면 다른 화면의 방 목록에 바로 보임 (user request): 열린 화면마다 'watch-<n>' 자리를 하나
     맡아 두고(방 목록 찾기에 쓰는 peer), 방장이 그 자리들에 방 카드('room')·닫힘('gone')을 보냄 — 서버 없이 알리는 방법
   · 방 만들기 (user request 2026-11-12): 자물쇠 버튼 하나로 공개/비밀 전환 · 방 제목 지정 · 번호로 들어가기 없음 (목록·링크로만)
   서버가 없는 화면이라 브라우저끼리 바로 잇는 WebRTC(PeerJS — 번호로 서로 찾는 일만 PeerJS 공개 서버)를 씀.
   player_screen.js 다음에 읽음 (SHELL·audio·keyOf·LIB·OFFDIR·ONLINE 을 씀) */
const LT_PEERJS = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
const LT_PREFIX = "ailee126-noinjeong-lt-";  // PeerJS id = 이 앞머리 + 번호
const LT_SLOTS = 8;  // room list: each open room also holds one "lobby-<n>" id that answers who/what (no server to list rooms)
const ltSlotId = i => LT_PREFIX + "lobby-" + i;
const LT_WATCH = 16;  // open players that get told at once when a room appears / closes / changes
const ltWatchId = i => LT_PREFIX + "watch-" + i;
const LT = {uid: Math.random().toString(36).slice(2), role: "", code: "", me: "", open: true, pw: "", title: "", lock: false, linkCode: "", lobby: null, lobbyAt: 0, peer: null, conns: new Map(), host: null,
  members: [], status: "", lastHeard: 0, lostAt: 0, retryAt: 0, ask: "", rtt: 0, align: 0, qsig: "", lead: 0, seekAt: 0, reqs: [],
  prep: null, gprep: "", gkey: "", gsent: false, ggo: ""};  // ask: code of a secret room waiting for its password · prep/g*: start together (ltPrepStart)
const LT_SILENT = 70000;   // 방장 소식이 이만큼 없으면 끊긴 것으로 봄 (뒤에 깔린 탭은 브라우저가 타이머를 1분에 한 번까지 늦춤)
const LT_GIVE_UP = 180000; // 손님: 이만큼 다시 잇지 못하면 나감
let ltApplying = 0;  // 방장 상태를 따라 하는 중 (이때 바뀐 건 다시 보내지 않음)
const ltQuiet = fn => { ltApplying++; try { return fn(); } finally { ltApplying--; } };
const ltName = () => $("ltName").value.trim();
const ltCrownSvg = () => `<svg class="ltcrown" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-label="방장"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z"/></svg>`;
const ltPenSvg = () => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/><path d="M14.5 5.5l3 3"/></svg>`;
const ltKey = n => String(n || "").normalize("NFKC").trim().toLowerCase();  // nickname compare
const ltNick = n => (typeof n === "string" ? n : (n && n.name) || "");
/* the nickname is taken by someone in a room right now (my own current room doesn't count — I am leaving it) */
function ltTaken(name) {
  const k = ltKey(name);
  return (LTS.rooms || []).some(r => (!LT.role || r.code !== LT.code)
    && [r.name, ...(r.members || [])].some(m => ltKey(m) === k));
}
function ltNameTaken() {
  $("ltNameErr").textContent = "사용중인 닉네임입니다.";
  $("ltNameErr").hidden = false;
  $("ltName").closest(".ltfield").classList.add("need");
  $("ltName").focus();
}
/* fresh room list, then: nickname free? (user request: duplicate check against people in rooms now) */
async function ltNameFree() {
  LT.status = "입장중…"; ltRender();
  await ltScan(true);
  LT.status = "";
  if (ltTaken(ltName())) { ltRender(); ltNameTaken(); return false; }
  return true;
}
const ltLockSvg = open => `<svg class="ltico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="${open ? "공개방" : "비밀방"}"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="${open ? "M8 11V7a4 4 0 0 1 7.8-1.2" : "M8 11V7a4 4 0 0 1 8 0v4"}"/></svg>`;
/* name required to make or join a room */
function ltNeedName() {
  if (ltName()) return false;
  $("ltNameErr").textContent = "필수값입니다.";
  $("ltNameErr").hidden = false;
  $("ltName").closest(".ltfield").classList.add("need");
  $("ltName").focus();
  return true;
}

function ltLoadPeerJs() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = LT_PEERJS; s.onload = res; s.onerror = () => { s.remove(); rej(new Error("같이듣기 연결 도구를 받지 못했습니다 (인터넷 확인)")); };
    document.head.appendChild(s);
  });
}
const ltNewCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
const ltLink = code => location.href.split("#")[0] + "#lt=" + code;
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
  return {key: it ? keyOf(it) : "", item: it ? ltStrip(it) : null, pos: audio.currentTime || 0, playing: ltIntent(), run: !audio.paused, ready: audio.readyState > 0,
          prep: LT.prep ? LT.prep.id : ""};
}
/* Start a new song together. User report: guests' song start stuttered (they started late, then catch-up seeks re-buffered).
   Now: everyone loads the new song paused at 0 and says "ready"; the host starts when all are ready and tells guests "go".
   Waits at most 2s (user decision) — anyone later catches up by seeking as before. */
const LT_PREP_MAX = 2000;
let ltPrepSeq = 0;
function ltPrepStart() {
  ltPrepEnd();
  LT.prep = {id: ++ltPrepSeq + Math.random().toString(36).slice(2, 6), wait: new Set(LT.conns.keys()), timer: setTimeout(ltGo, LT_PREP_MAX)};
}
function ltPrepEnd() { if (LT.prep) clearTimeout(LT.prep.timer); LT.prep = null; }
function ltPrepCheck() {  // host: my song is ready and every guest still here answered → go
  const p = LT.prep;
  if (LT.role === "host" && p && audio.readyState > 0 && ![...p.wait].some(c => c.open)) ltGo();
}
function ltGo() {
  if (!LT.prep) return;
  const id = LT.prep.id;
  ltPrepEnd();
  if (audio.currentTime > 0.05) audio.currentTime = 0;  // a fresh frame plays a moment before it pauses
  audio.play().catch(() => {});
  LT.conns.forEach((_, c) => ltSend(c, {t: "go", id}));
  ltBroadcast();
}
let ltSendTimer = 0;
function ltBroadcast() {  // 잇따른 변화는 한 번에
  if (LT.role !== "host") return;
  clearTimeout(ltSendTimer);
  ltSendTimer = setTimeout(() => { const m = {t: "state", s: ltState()}; LT.conns.forEach((_, c) => ltSend(c, m)); }, 60);
}
function ltSend(c, m) { try { if (c.open) c.send(m); } catch (e) {} }
const LT_QMAX = 30;  // upcoming songs sent to guests (the list can be thousands long)
function ltQueueMsg() {
  const pack = it => ({key: keyOf(it), item: ltStrip(it)});
  return {t: "queue", pinned: SHELL.pinned.slice(0, LT_QMAX).map(pack), upcoming: SHELL.upcoming.slice(0, LT_QMAX).map(pack)};
}
/* host: send the queue when it changed (or to one guest that just came in) */
function ltSendQueue(to) {
  if (LT.role !== "host") return;
  const sig = [...SHELL.pinned.slice(0, LT_QMAX), "|", ...SHELL.upcoming.slice(0, LT_QMAX)].map(x => x === "|" ? x : keyOf(x)).join("\n");
  if (!to && sig === LT.qsig) return;
  LT.qsig = sig;
  const m = ltQueueMsg();
  if (to) return ltSend(to, m);
  LT.conns.forEach((_, c) => ltSend(c, m));
}
function ltMembers() {
  LT.members = [LT.me, ...[...LT.conns.values()].map(v => v.name)];
  const m = {t: "members", list: LT.members, title: LT.title, open: LT.open};
  LT.conns.forEach((_, c) => ltSend(c, m));
  ltRender();
  ltAnnounceSoon();  // room opened / someone came or left → other screens at once
}
async function ltHost(open, pw, title) {
  if (ltNeedName()) return;
  if (!open && !pw) { LT.status = "비밀번호를 정해 주세요"; ltRender(); return $("ltNewPw").focus(); }
  if (!await ltNameFree()) return;
  ltLeave(true);
  LT.me = ltName(); LT.open = open; LT.pw = open ? "" : pw; LT.title = title || `${LT.me}님의 방`;
  LT.status = "방을 만드는 중…"; ltRender();
  try { await ltLoadPeerJs(); } catch (e) { LT.status = e.message; return ltRender(); }
  ltHostPeer(ltNewCode(), 3);
}
/* 방장 peer (번호 = PeerJS id). left: 번호가 겹치면 새 번호로 다시 할 횟수 (-1: 이미 연 방을 같은 번호로 다시 엶) */
function ltHostPeer(code, left) {
  const peer = new Peer(LT_PREFIX + code);
  LT.peer = peer;
  peer.on("open", () => {
    if (LT.peer !== peer) return;
    LT.role = "host"; LT.code = code; LT.status = ""; LT.lostAt = 0; SHELL.follow = false;
    ltRescan("", 1500);  // after the lobby slot is taken, my room shows in the list
    ltMembers();
    if (!LT.lobby) ltLobby(0);
  });
  peer.on("connection", c => {
    c.on("open", () => {
      const pw = (c.metadata && c.metadata.pw) || "";
      if (!LT.open && pw !== LT.pw) {  // secret room: the host checks the password
        ltSend(c, {t: "denied", why: pw ? "wrong" : "need"});
        return setTimeout(() => { try { c.close(); } catch (e) {} }, 800);
      }
      const name = (c.metadata && c.metadata.name) || "손님", uid = (c.metadata && c.metadata.uid) || "";
      for (const [o, v] of LT.conns) if (uid && v.uid === uid) { LT.conns.delete(o); try { o.close(); } catch (e) {} }  // same browser coming back
      if (ltKey(name) === ltKey(LT.me) || [...LT.conns.values()].some(v => ltKey(v.name) === ltKey(name))) {
        ltSend(c, {t: "denied", why: "name"});
        return setTimeout(() => { try { c.close(); } catch (e) {} }, 800);
      }
      LT.conns.set(c, {name, uid, seen: Date.now()}); ltMembers(); ltSend(c, {t: "state", s: ltState()}); ltSendQueue(c); ltSend(c, ltReqsMsg());
    });
    c.on("data", m => ltHostGot(c, m));
    c.on("close", () => { if (LT.conns.delete(c)) ltMembers(); });
    c.on("error", () => { if (LT.conns.delete(c)) ltMembers(); });
  });
  peer.on("error", e => {
    if (LT.peer !== peer) return;
    if (LT.role !== "host") {  // 방을 열기 전
      if (e.type === "unavailable-id" && left > 0) { peer.destroy(); return ltHostPeer(ltNewCode(), left - 1); }  // 번호가 겹침 → 다른 번호
      ltLeave(true); LT.status = ltErrText(e); return ltRender();
    }
    // Room already open (user report: the room broke after a while): a dropped link to the PeerJS server used to close it.
    // Guests already in talk to this browser directly and don't need that server — keep the room, reconnect in ltKeep.
    if (["network", "server-error", "socket-error", "socket-closed", "disconnected", "unavailable-id"].includes(e.type)) ltHostLost();
  });
  peer.on("disconnected", () => { if (LT.peer === peer && LT.role === "host") ltHostLost(); });
}
/* room list slot: take the first free lobby-<n> id; anyone who connects gets this room's card */
function ltLobby(i) {
  if (LT.role !== "host" || i >= LT_SLOTS) return;
  const p = new Peer(ltSlotId(i));
  LT.lobby = p;
  p.on("error", e => {
    if (LT.lobby !== p) return;
    if (e.type === "unavailable-id") { p.destroy(); LT.lobby = null; return ltLobby(i + 1); }  // slot taken by another room
    if (["network", "server-error", "socket-error", "socket-closed", "disconnected"].includes(e.type)) { p.destroy(); LT.lobby = null; }  // ltKeep tries again
  });
  p.on("disconnected", () => { if (LT.lobby === p) { p.destroy(); LT.lobby = null; } });
  p.on("connection", c => {
    c.on("open", () => {
      const it = SHELL.now;
      // secret rooms show their code too: the password set by the host is what keeps them closed
      ltSend(c, ltCard());
      setTimeout(() => { try { c.close(); } catch (e) {} }, 1500);
    });
  });
}
/* ---------- 곡 요청 (방장이 목록을 갖고 모두에게 보냄) ---------- */
const ltReqsMsg = () => ({t: "reqs", list: LT.reqs.map(({item, ...r}) => r)});
function ltSendReqs() {
  if (LT.role !== "host") return;
  const m = ltReqsMsg();
  LT.conns.forEach((_, c) => ltSend(c, m));
  ltRenderReqs();
}
function ltReqAccept(id) {
  const r = LT.reqs.find(r => r.id === id); if (!r || r.state !== "wait") return;
  const it = ltFindItem(r.key, r.item);
  if (!it) { LT.reqs = LT.reqs.filter(x => x !== r); return ltSendReqs(); }
  r.state = "queued";
  SHELL.enqueue(it);  // into '직접 넣은 곡' (plays before the rest)
  ltSendReqs();
}
/* host picked a song in the search: straight into the queue */
function ltHostRequest(it) {
  if (LT.reqs.some(r => r.key === keyOf(it))) return;
  LT.reqs.push({id: Math.random().toString(36).slice(2, 8), key: keyOf(it), item: ltStrip(it), title: it.title || "", artist: it.artist || "", by: LT.me, state: "wait"});
  ltReqAccept(LT.reqs[LT.reqs.length - 1].id);
}
function ltReqDrop(id) { LT.reqs = LT.reqs.filter(r => r.id !== id); ltSendReqs(); }
/* host: follow the song — queued → playing when it starts; gone when the next song comes or it left the queue */
function ltReqFollow() {
  if (LT.role !== "host" || !LT.reqs.length) return;
  const now = SHELL.now ? keyOf(SHELL.now) : "", inQ = new Set([...SHELL.pinned, ...SHELL.upcoming].map(keyOf));
  const before = LT.reqs.map(r => r.id + r.state).join();
  LT.reqs = LT.reqs.filter(r => {
    if (r.state === "playing") return r.key === now;
    if (r.state === "queued") { if (r.key === now) r.state = "playing"; else if (!inQ.has(r.key)) return false; }
    return true;
  });
  if (LT.reqs.map(r => r.id + r.state).join() !== before) ltSendReqs();
}
function ltCard() {  // this room as the room list shows it
  const it = SHELL.now;
  return {t: "room", name: LT.me, members: LT.members.slice(1), title: LT.title, open: LT.open, code: LT.code, n: (LT.members.length || 1), song: it ? (it.title || "") : ""};
}
/* tell every open player (their watch-<n> peer) about my room at once */
function ltAnnounce(m) {
  const p = LTS.peer;
  if (!p || !p.open || p.destroyed) return;
  for (let i = 0; i < LT_WATCH; i++) {
    if (ltWatchId(i) === p.id) continue;
    const c = p.connect(ltWatchId(i), {reliable: true});
    c.on("open", () => { ltSend(c, m); setTimeout(() => { try { c.close(); } catch (e) {} }, 1000); });
  }
}
let ltAnnT = 0;
function ltAnnounceSoon() { clearTimeout(ltAnnT); ltAnnT = setTimeout(() => { if (LT.role === "host" && LT.code) ltAnnounce(ltCard()); }, 400); }
function ltLobbyStop() { const p = LT.lobby; LT.lobby = null; if (p) try { p.destroy(); } catch (e) {} }
function ltHostLost() {
  if (!LT.lostAt) LT.lostAt = Date.now();
  LT.status = "연결 서버와 다시 잇는 중… (들어와 있는 사람은 그대로 같이 들음 · 새로 들어오기만 잠시 안 됨)"; ltRender();
}
function ltHostGot(c, m) {
  const v = LT.conns.get(c); if (!v || !m) return;
  v.seen = Date.now();
  if (m.t === "ping") ltSend(c, {t: "pong", at: m.at});  // guest measures the round trip
  else if (m.t === "want") ltSend(c, {t: "state", s: ltState()});  // guest's song just started sounding: exact position now
  else if (m.t === "ready") { if (LT.prep && m.id === LT.prep.id) { LT.prep.wait.delete(c); ltPrepCheck(); } }  // guest lined up at 0
  else if (m.t === "req" && m.key && !LT.reqs.some(r => r.key === m.key)) {  // song request from a guest
    const it = ltFindItem(m.key, m.item);
    if (!it || !canPlay(it)) return;
    LT.reqs.push({id: Math.random().toString(36).slice(2, 8), key: m.key, item: ltStrip(it), title: it.title || "", artist: it.artist || "", by: v.name, state: "wait"});
    ltSendReqs();
  }
}

/* ---------- 손님 ---------- */
async function ltJoin(code, pw = "") {
  if (ltNeedName()) return;
  code = String(code || "").replace(/\D/g, "");
  if (code.length !== 6) return;
  LT.linkCode = "";
  if (LT.role && code === LT.code) { LT.status = "지금 있는 방입니다"; return ltRender(); }
  if (!await ltNameFree()) return;
  ltLeave(true);
  LT.me = ltName(); LT.pw = pw; LT.ask = "";
  LT.status = "들어가는 중…"; ltRender();
  try { await ltLoadPeerJs(); } catch (e) { LT.status = e.message; return ltRender(); }
  ltGuestPeer(code);
}
/* 손님 peer: 방장에게 잇기. 첫 소식이 오면 들어간 것 (비밀번호가 틀리면 방장이 "denied").
   이미 들어와 있던 방(LT.role guest)이면 끊겨도 나가지 않고 ltKeep 이 다시 이음 */
function ltGuestPeer(code) {
  const peer = LT.peer = new Peer();
  const fail = msg => {
    if (LT.peer !== peer) return;
    if (LT.role === "guest") return ltGuestLost();
    ltLeave(true); LT.status = msg; ltRender();
  };
  peer.on("open", () => {
    if (LT.peer !== peer) return;
    const c = peer.connect(LT_PREFIX + code, {reliable: true, metadata: {name: LT.me, pw: LT.pw, uid: LT.uid}});
    const t = setTimeout(() => { if (LT.peer === peer && LT.host !== c) fail("방에 들어가지 못했습니다 — 번호를 확인하거나 다시 해 보세요"); }, 15000);
    c.on("data", m => {
      if (LT.peer !== peer || !m) return;
      if (m.t === "denied") {
        clearTimeout(t);
        const wasIn = LT.role === "guest";
        ltLeave(true);
        if (m.why === "name") { LT.status = ""; ltRender(); return ltNameTaken(); }
        LT.ask = code;  // ask for the password and try again
        LT.status = wasIn ? "방의 비밀번호가 바뀌었습니다" : m.why === "wrong" ? "비밀번호가 틀렸습니다" : "";
        ltRender();
        return $("ltPwIn").focus();
      }
      if (LT.host !== c) {  // first word from the host → in
        clearTimeout(t);
        LT.role = "guest"; LT.code = code; LT.host = c; LT.status = ""; LT.lastHeard = Date.now(); LT.lostAt = 0;
        ltRescan("", 0);
        SHELL.follow = true;  // 곡이 끝나도 혼자 다음 곡으로 넘어가지 않음 (방장이 넘김)
        LT.align = 4;  // first time in: line up tightly once the song sounds
        ltSend(c, {t: "ping", at: performance.now()});
        ltRender();
      }
      ltGuestGot(m);
    });
    c.on("close", () => { if (LT.host === c) ltGuestLost(); });
  });
  peer.on("error", e => fail(e.type === "peer-unavailable" ? "그 번호의 방이 없습니다 — 번호를 확인해 주세요" : ltErrText(e)));
}
/* 들어와 있던 방과 끊김 → 방장이 방을 닫았다고 알리기 전까지는 다시 잇기 (3분 넘게 안 되면 나감) */
function ltGuestLost() {
  if (LT.role !== "guest") return;
  LT.host = null;
  if (!LT.lostAt) LT.lostAt = Date.now();
  LT.status = "방장과 연결이 끊겨 다시 잇는 중…"; ltRender();
}
function ltGuestGot(m) {
  LT.lastHeard = Date.now();
  if (m.t === "bye") { const code = LT.code; ltLeave(true); LT.status = "방장이 방을 닫았습니다"; return ltRescan(code, 800); }
  if (m.t === "members") { LT.members = m.list || []; LT.title = m.title || ""; LT.open = m.open !== false; return ltRender(); }
  if (m.t === "state") return ltApply(m.s, performance.now());
  if (m.t === "go") return ltGuestGo(m.id);
  if (m.t === "pong") { const r = performance.now() - m.at; if (r >= 0 && r < 5000) LT.rtt = LT.rtt ? LT.rtt * 0.7 + r * 0.3 : r; return; }
  if (m.t === "queue") return ltApplyQueue(m);
  if (m.t === "reqs") { LT.reqs = m.list || []; ltRenderReqs(); }
}
/* host's queue → mine (songs I can't play here are left out) */
function ltApplyQueue(m) {
  const take = l => (l || []).map(x => ltFindItem(x.key, x.item)).filter(it => it && canPlay(it));
  SHELL.pinned = take(m.pinned); SHELL.upcoming = take(m.upcoming);
  SHELL.qemit();
}
/* guest: the song really started sounding → ask for the exact position (after joining / a new song) */
function ltWant() { if (LT.role === "guest" && LT.host && LT.align) ltSend(LT.host, {t: "want"}); }
/* guest: the song the host is lining up is loaded here → back to 0 (still paused) and tell the host */
function ltGuestReady() {
  if (LT.role !== "guest" || !LT.host || !LT.gprep || LT.gsent || !SHELL.now || keyOf(SHELL.now) !== LT.gkey || audio.readyState <= 0) return;
  if (audio.currentTime > 0.05) ltQuiet(() => { audio.currentTime = 0; });
  LT.gsent = true;
  ltSend(LT.host, {t: "ready", id: LT.gprep});
}
/* guest: host says go → start now. Lined up in time → no catch-up seeks; too late (over 2s) → catch up as before */
function ltGuestGo(id) {
  if (!id || id !== LT.gprep) return;
  LT.ggo = id; LT.gprep = "";
  if (LT.gsent) LT.align = 0;
  ltQuiet(() => { audio.play().catch(() => {}); });
}
function ltApply(s, got) {
  if (!s || !s.key) return;
  const it = ltFindItem(s.key, s.item);
  if (!it || !canPlay(it)) { LT.status = `방장이 트는 곡을 여기서 틀 수 없습니다: ${(s.item && s.item.title) || s.key}`; return ltRender(); }
  if (LT.status) { LT.status = ""; ltRender(); }
  if (s.prep && s.prep !== LT.ggo) {  // host is lining everyone up for a new song: load it paused at 0, then say ready
    if (LT.gprep !== s.prep) { LT.gprep = s.prep; LT.gkey = keyOf(it); LT.gsent = false; }
    if (!SHELL.now || keyOf(SHELL.now) !== keyOf(it)) { LT.align = 4; return ltQuiet(() => SHELL.load(it, false, "pick")); }  // ready on loadedmetadata
    if (ltIntent()) ltQuiet(() => audio.pause());
    return ltGuestReady();
  }
  if (!SHELL.now || keyOf(SHELL.now) !== keyOf(it)) { LT.align = 4; return ltQuiet(() => SHELL.load(it, s.playing, "pick")); }  // 위치는 곡이 울리기 시작하면 (ltWant)
  if (s.playing && !ltIntent()) ltQuiet(() => { audio.play().catch(() => {}); });
  else if (!s.playing && ltIntent()) ltQuiet(() => audio.pause());
  // position: only when both sides are really playing (or both stopped) — not while one of them is still loading
  if (!s.ready || audio.readyState <= 0) return;
  // expected host position now: + time since it arrived + half the round trip (it was already that old when sent)
  const exp = s.pos + (s.run ? (performance.now() - got + LT.rtt / 2) / 1000 : 0), both = s.run && !audio.paused, still = !s.playing && audio.paused;
  if (!both && !still) return;
  const diff = audio.currentTime - exp, off = Math.abs(diff);
  // learn how late this player lands after a seek (embedded players): the residual right after our own seek
  if (both && LT.seekAt && performance.now() - LT.seekAt < 4000) LT.lead = Math.max(0, Math.min(1.5, LT.lead - diff * 0.8));
  LT.seekAt = 0;
  const seek = () => { ltSyncNote(); ltQuiet(() => { audio.currentTime = exp + (both ? LT.lead : 0); }); if (both) LT.seekAt = performance.now(); };
  if (both && LT.align) {  // tight after joining / a new song: seek, check again shortly, up to 4 times
    if (off > 0.1) { seek(); LT.align--; if (LT.align) setTimeout(ltWant, 1200); }
    else LT.align = 0;
    return;
  }
  if (off > (both ? 0.5 : 0.3)) { seek(); if (both) { LT.align = 2; setTimeout(ltWant, 1200); } }
}

function ltErrText(e) {
  if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) return "같이듣기 연결 서버에 닿지 못했습니다 (인터넷 확인 · 잠시 뒤 다시)";
  if (e.type === "browser-incompatible" || e.type === "webrtc") return "이 브라우저에서는 같이듣기를 할 수 없습니다";
  return "같이듣기 연결 오류 (" + (e.type || e.message || e) + ")";
}
function ltLeave(quiet) {
  LT.titleEdit = false;
  if (LT.role === "host") { LT.conns.forEach((_, c) => ltSend(c, {t: "bye"})); clearTimeout(ltAnnT); ltAnnounce({t: "gone", code: LT.code}); }
  ltLobbyStop();
  const peer = LT.peer;
  ltPrepEnd(); LT.gprep = ""; LT.ggo = "";
  LT.peer = null; LT.role = ""; LT.code = ""; LT.host = null; LT.members = []; LT.reqs = []; LT.reqPage = 0; LT.lead = 0; LT.conns = new Map(); LT.lostAt = 0; LT.retryAt = 0;
  SHELL.follow = false;
  if (peer) setTimeout(() => { try { peer.destroy(); } catch (e) {} }, 300);  // "bye" 가 먼저 나가게
  if (!quiet) LT.status = "";
  ltRender();
}

/* 3초마다: 방장은 지금 상태를 알리고 연결 서버와 끊겼으면 다시 이음 · 손님은 살아 있다고 알리고 끊겼으면 다시 들어감 */
function ltKeep() {
  const now = Date.now();
  if (LT.role === "host") {
    ltBroadcast();
    ltSendQueue();
    let gone = false;
    LT.conns.forEach((v, c) => { if (now - v.seen > 20000 && !c.open) { LT.conns.delete(c); gone = true; } });
    if (gone) ltMembers();
    const p = LT.peer;
    if (!LT.lobby && p && p.open && now >= LT.lobbyAt) { LT.lobbyAt = now + 30000; ltLobby(0); }  // lost / full slots: try again now and then
    if (p && (p.destroyed || p.disconnected) && now >= LT.retryAt) {
      LT.retryAt = now + 5000;
      if (!LT.lostAt) ltHostLost();
      if (p.destroyed) ltHostPeer(LT.code, -1);  // same code, guests already in were on the old peer and will rejoin
      else try { p.reconnect(); } catch (e) {}
    }
  } else if (LT.role === "guest") {
    if (LT.host) {
      ltSend(LT.host, {t: "ping", at: performance.now()});
      if (now - LT.lastHeard > LT_SILENT) { const c = LT.host; ltGuestLost(); try { c.close(); } catch (e) {} }
    } else if (now - LT.lostAt > LT_GIVE_UP) { ltLeave(true); LT.status = "방장과 연결이 끊겼습니다 (3분 동안 다시 잇지 못함)"; ltRender(); }
    else if (now >= LT.retryAt) {
      LT.retryAt = now + 16000;  // 한 번 잇기에 최대 15초
      const old = LT.peer;
      ltGuestPeer(LT.code);
      if (old) try { old.destroy(); } catch (e) {}
    }
  }
}

/* ---------- 재생기에 걸기: 방장은 바뀔 때마다 알리고, 손님이 직접 하는 재생 조작은 막음 (방장 상태를 따라 할 때만 통과) ---------- */
{
  const locked = () => LT.role === "guest" && !ltApplying;
  const load = SHELL.load, next = SHELL.next, prev = SHELL.prev, toggle = SHELL.toggle;
  SHELL.load = function (it, autoplay = true, how = "") {
    if (locked()) return Promise.resolve();
    const prep = LT.role === "host" && autoplay && [...LT.conns.keys()].some(c => c.open);  // guests here → start together
    if (prep) ltPrepStart(); else ltPrepEnd();
    const r = load.call(this, it, autoplay && !prep, how);
    if (prep) this.autoplay = true;  // still meant to play (a song that fails still moves on)
    ltBroadcast();
    return r;
  };
  SHELL.next = function (auto, how) { if (!locked()) return next.call(this, auto, how); };  // 곡 끝·못 튼 곡도 방장이 넘김
  SHELL.prev = function () { if (!locked()) return prev.call(this); };
  SHELL.toggle = function () { if (locked()) return; if (LT.role === "host" && LT.prep) return ltGo(); return toggle.call(this); };  // ▶ while lining up = start now
  const enqueue = SHELL.enqueue, unqueue = SHELL.unqueue, qemit = SHELL.qemit;
  SHELL.enqueue = function (it) { if (!locked()) return enqueue.call(this, it); };  // guest: the host's queue only
  SHELL.unqueue = function (l, i) { if (!locked()) return unqueue.call(this, l, i); };
  SHELL.qemit = function () { const r = qemit.call(this); if (LT.role === "host") setTimeout(() => { ltSendQueue(); ltReqFollow(); }, 0); return r; };
  // every other way (keys ←/→, lyrics click, seek bar, video click) ends up here
  const proto = Object.getPrototypeOf(audio), ct = Object.getOwnPropertyDescriptor(proto, "currentTime");
  Object.defineProperty(audio, "currentTime", {
    configurable: true,
    get() { return ct.get.call(this); },
    set(t) { if (!locked()) ct.set.call(this, t); else setTimeout(() => tick(true), 0); },  // 막으면 위치 막대를 제자리로
  });
  audio.play = function () { return locked() ? Promise.resolve() : proto.play.call(this); };
  audio.pause = function () { if (!locked()) return proto.pause.call(this); };
  ["play", "playing", "pause", "seeked", "loadedmetadata"].forEach(ev => audio.addEventListener(ev, ltBroadcast));
  audio.addEventListener("playing", ltWant);
  audio.addEventListener("loadedmetadata", () => { ltPrepCheck(); ltGuestReady(); });
  SHELL.subscribe(() => { if (LT.role === "host") setTimeout(() => { ltSendQueue(); ltReqFollow(); }, 0); });  // song changed → upcoming changed too
  setInterval(ltKeep, 3000);
  addEventListener("pagehide", () => ltLeave(true));
}

/* ---------- 방 목록: 화면을 열 때 한 번 + 새로고침 버튼을 누를 때만 (user request: 저절로 다시 찾지 않음, 마지막 갱신 시각 표시) ---------- */
const LTS = {peer: null, rooms: null, busy: false, at: 0, done: "", again: false, wait: null};
function ltScan(again) {
  if (LTS.busy) { if (again) LTS.again = true; return LTS.wait; }  // a scan already running: one more right after (state changed meanwhile)
  LTS.busy = true; LTS.at = Date.now(); ltRenderRooms();
  return LTS.wait = new Promise(async res => {
    try { await ltLoadPeerJs(); } catch (e) { LTS.busy = false; LTS.rooms = LTS.rooms || []; ltRenderRooms(); return res(); }
    const found = new Map();  // empty slots give no signal at all → wait the full 4 s
    const finish = () => {
      if (!LTS.busy) return res();
      LTS.busy = false; LTS.rooms = [...found.values()]; LTS.done = ltNow(); ltRender();
      if (LTS.again) { LTS.again = false; return ltScan().then(res); }
      res();
    };
    const ask = p => {
      for (let i = 0; i < LT_SLOTS; i++) {
        const c = p.connect(ltSlotId(i), {reliable: true});
        c.on("data", m => { if (m && m.t === "room") found.set(i, m); try { c.close(); } catch (e) {} });
      }
      setTimeout(finish, 4000);
    };
    if (LTS.peer && LTS.peer.open && !LTS.peer.destroyed) return ask(LTS.peer);
    ltScanPeerDrop();
    ltWatchPeer(0, p => p ? ask(p) : finish());
    setTimeout(finish, 9000);
  });
}
/* user request: the room list follows every change on any screen — drop a room I just closed at once, then look again */
function ltRescan(dropCode, delay) {
  if (dropCode && LTS.rooms) LTS.rooms = LTS.rooms.filter(r => r.code !== dropCode);
  ltRender();
  setTimeout(() => ltScan(true), delay);
}
function ltNow() {
  const d = new Date(), z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}
/* the room-list peer also takes a free watch-<n> id so hosts can tell this screen about rooms at once (none free → random id) */
function ltWatchPeer(i, done) {
  const p = LTS.peer = i < LT_WATCH ? new Peer(ltWatchId(i)) : new Peer();
  let ok = false;
  p.on("open", () => { if (LTS.peer !== p) return; ok = true; done(p); });
  p.on("error", e => {
    if (LTS.peer !== p) return;
    if (e.type === "peer-unavailable") return;  // an empty lobby / watch slot
    if (!ok && e.type === "unavailable-id") { p.destroy(); return ltWatchPeer(i + 1, done); }  // taken by another screen
    if (!ok) { ltScanPeerDrop(); done(null); }
  });
  p.on("connection", c => c.on("data", ltWatchGot));
}
function ltWatchGot(m) {
  if (!m || !m.code) return;
  const rooms = (LTS.rooms || []).filter(r => r.code !== m.code);
  if (m.t === "room") rooms.push(m);
  else if (m.t !== "gone") return;
  LTS.rooms = rooms; LTS.done = ltNow(); ltRender();
}
function ltScanPeerDrop() { const p = LTS.peer; LTS.peer = null; if (p) try { p.destroy(); } catch (e) {} }
function ltRenderRooms() {
  const ul = $("ltRooms"), rooms = LTS.rooms;
  $("ltRefresh").disabled = LTS.busy;
  $("ltScanAt").textContent = LTS.busy ? "찾는 중…" : LTS.done ? `마지막 갱신 ${LTS.done}` : "";
  // 'ltempty', not 'empty': the page's global .empty (main song list) is centred with a 60px top margin
  if (!rooms || !rooms.length) { ul.innerHTML = !rooms || LTS.busy ? "" : `<li class="ltempty">열린 방이 없습니다</li>`; return; }  // while looking: the header says 찾는 중…
  ul.innerHTML = rooms.map((r, i) => {
    const here = LT.role && r.code === LT.code;
    return `<li class="ltroom${here ? " here" : ""}">
      <span class="who">${ltLockSvg(r.open)} ${esc(ltRoomName(r))}</span>
      <span class="meta">${ltCrownSvg()} ${esc(r.name || "")} · ${(here && LT.members.length) || r.n || 1}명${r.song ? " · ♪ " + esc(r.song) : ""}</span>
      ${here ? `<span class="here">지금 있는 방</span>` : `<button data-i="${i}" class="${r.open ? "primary" : ""}">${LT.role ? "이 방으로 옮기기" : "참여"}</button>`}
    </li>`;
  }).join("");
}
const ltRoomName = r => r.title || `${r.name || "이름 없음"}님의 방`;  // older players send no title
$("ltRooms").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const r = LTS.rooms && LTS.rooms[+b.dataset.i]; if (!r) return;
  if (r.open) return ltJoin(r.code);
  if (ltNeedName()) return;
  LT.ask = r.code; LT.status = ""; ltRender(); $("ltPwIn").focus();  // secret room: password first
});
$("ltRefresh").onclick = () => ltScan();

/* ---------- 화면 ---------- */
function ltRender() {
  const b = $("btnListen"), n = LT.members.length, rooms = LTS.rooms ? LTS.rooms.length : 0;
  b.classList.toggle("on", !!LT.role);
  b.textContent = "🎧 같이듣기" + (rooms ? ` · 방 ${rooms}개` : "") + (LT.role ? ` · 내 방 ${n || 1}명` : "");
  $("ltIdle").hidden = !!LT.role;
  $("ltRoom").hidden = !LT.role;
  $("ltStatus").textContent = LT.status;
  $("ltStatus").hidden = !LT.status;
  $("ltLeave").hidden = !LT.role;
  $("ltLock").innerHTML = ltLockSvg(!LT.lock);
  document.querySelector("#listenDlg .ltfield").hidden = !!LT.role;  // in a room: no nickname field (leave and come back to change it)
  $("ltLock").title = LT.lock ? "비밀방 (누르면 공개방)" : "공개방 (누르면 비밀방)";
  $("ltNewPw").hidden = !LT.lock;
  $("ltTitle").placeholder = `${ltName() || "이름없음"}님의 방`;  // empty title → this name
  $("ltPwAsk").hidden = !LT.ask;
  if (LT.ask) {
    const r = (LTS.rooms || []).find(r => r.code === LT.ask);
    $("ltPwFor").textContent = r ? ltRoomName(r) : "비밀방";
  }
  // guest: only volume and leaving — the play controls look disabled
  const guest = LT.role === "guest";
  for (const id of ["btnPlay", "btnPrev", "btnNext", "seek", "btnPlayView", "btnShuffle", "btnRepeat", "btnEdit"]) $(id).disabled = guest;
  document.body.classList.toggle("lt-guest", guest);
  ltRenderRooms();
  if (!LT.role) return;
  const hostName = LT.members[0] || (LT.role === "host" ? LT.me : "");
  const title = LT.title || (hostName ? `${hostName}님의 방` : "");
  if (!LT.titleEdit) $("ltRoomTitle").innerHTML = `${ltLockSvg(LT.open)}<span class="tt">${esc(title)}</span>${
    LT.role === "host" ? `<button type="button" class="ltpen" title="방 제목 바꾸기">${ltPenSvg()}</button>` : ""}`;  // user request: lock always before the title, big and centred · host: ✏ renames
  $("ltRoomHint").textContent = "곡 재생 제어는 방장만 가능합니다.";
  $("ltRoomHint").hidden = LT.role === "host";
  const mem = LT.members.length ? LT.members : [hostName];
  $("ltMemCount").textContent = `${mem.length}명`;
  $("ltMembers").innerHTML = mem.map((m, i) => `<li class="${ltKey(ltNick(m)) === ltKey(LT.me) ? "me" : ""}">${i === 0 ? ltCrownSvg() : ""}${esc(ltNick(m))}</li>`).join("");
  $("ltLeave").textContent = LT.role === "host" ? "방 닫기" : "나가기";
  ltRenderReqs();
}
/* host renames the room (user request: pencil next to the title, host only) — guests and other screens get it at once */
function ltTitleEdit() {
  if (LT.role !== "host" || LT.titleEdit) return;
  LT.titleEdit = true;
  const box = $("ltRoomTitle");
  box.innerHTML = `<input type="text" id="ltTitleIn" maxlength="40" autocomplete="off" spellcheck="false">`;
  const inp = $("ltTitleIn");
  inp.value = LT.title || `${LT.me}님의 방`; inp.focus(); inp.select();
  let done = false;
  const end = save => {
    if (done) return; done = true;
    LT.titleEdit = false;
    const v = inp.value.trim();
    if (save && LT.role === "host" && v !== LT.title) { LT.title = v || `${LT.me}님의 방`; ltMembers(); }  // members msg carries the title
    else ltRender();
  };
  inp.addEventListener("keydown", e => {
    if (e.isComposing) return;
    if (e.key === "Enter") { e.preventDefault(); end(true); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(false); }  // don't close the dialog
  });
  inp.addEventListener("blur", () => end(true));
}
$("ltRoomTitle").addEventListener("click", e => { if (e.target.closest(".ltpen")) ltTitleEdit(); });
const LT_REQ_STATE = {wait: "요청중", queued: "재생대기", playing: "재생중"};
const LT_REQ_PAGE = 5;  // user request: 5 at a time, more → pages
function ltRenderReqs() {
  if (!LT.role) return;
  const host = LT.role === "host", n = LT.reqs.length, pages = Math.max(1, Math.ceil(n / LT_REQ_PAGE));
  LT.reqPage = Math.min(LT.reqPage || 0, pages - 1);
  $("ltReqQ").hidden = host;  // user request: the host has no request search (adds to the queue directly)
  const shown = LT.reqs.slice(LT.reqPage * LT_REQ_PAGE, (LT.reqPage + 1) * LT_REQ_PAGE);
  $("ltReqs").innerHTML = n ? shown.map(r => `<li data-id="${esc(r.id)}">
      <span class="t">${esc(r.title)}${r.artist ? ` <span class="a">${esc(shortName(r.artist))}</span>` : ""}</span>
      <span class="by">${esc(r.by)}</span>
      <span class="st ${r.state}">${LT_REQ_STATE[r.state] || r.state}</span>
      ${host && r.state === "wait" ? `<button class="primary ok">수락</button><button class="no">거절</button>` : ""}
    </li>`).join("") : host ? `<li class="ltempty">신청곡이 없습니다</li>` : "";  // guest: nothing (search box below) · host: no search, so say it
  $("ltReqPager").innerHTML = pages > 1
    ? `<button data-p="-1"${LT.reqPage ? "" : " disabled"}>‹</button>${LT.reqPage + 1} / ${pages}<button data-p="1"${LT.reqPage < pages - 1 ? "" : " disabled"}>›</button>` : "";
  if ($("ltReqPop") && $("ltReqPop").matches(":popover-open")) ltRenderPop();
}
$("ltReqPager").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (!b) return; LT.reqPage += +b.dataset.p; ltRenderReqs(); });

/* search = exactly the main screen's search dropdown (user request: same items): '"…" 들어간 곡' + matching 보컬·프로듀서·태그…
   with song counts, grouped. Choosing one opens its songs (2nd step, ← back / Esc) and a song there is requested. */
let ltHl = 0, ltOpt = null;  // ltOpt: the chosen option (2nd step) or null
const ltPool = () => allItems().filter(canPlay);
function ltMainOpts() {  // same as qOpts() in player_screen.js, counted over the songs that can be requested
  const raw = $("ltReqQ").value.trim(), v = fold(raw); if (!v) return [];
  const pool = ltPool(), out = [{k: "text", v, label: `"${raw}" 들어간 곡`, n: pool.filter(it => FKIND.text[1](it, v)).length, grp: "검색"}];
  for (const c of FCATS || []) for (const [val, cnt] of c.rows)
    if (FKIND[c.k] && fold(c.lab(val)).includes(v) && out.length < 80) out.push({k: c.k, v: val, label: c.lab(val), n: cnt, grp: c.label});
  return out;
}
function ltOptSongs(o) { return ltPool().filter(it => FKIND[o.k][1](it, o.v)).slice(0, 200); }
const ltOpts = () => ltOpt ? ltOptSongs(ltOpt).map(it => ({it})) : ltMainOpts();
function ltRenderPop() {
  const q = $("ltReqQ"), os = ltOpts();
  let p = $("ltReqPop");
  if ((!os.length && !ltOpt) || document.activeElement !== q) { if (p) try { p.hidePopover(); } catch (e) {} return; }
  if (!p) {
    p = document.createElement("div"); p.id = "ltReqPop"; p.className = "fddpop"; p.setAttribute("popover", "manual");
    p.innerHTML = '<div class="fdd-list"></div>'; document.body.appendChild(p);
    const list = p.querySelector(".fdd-list");
    list.onmousedown = e => e.preventDefault();  // keep focus in the search box
    // choose on click, not mousedown (user request): hiding on mousedown let the rest of the tap land on 새로고침 under the box
    list.onclick = e => {
      if (e.target.closest(".lt-back")) { ltOpt = null; ltHl = 0; return ltRenderPop(); }
      const o = e.target.closest(".fdd-opt"); if (!o) return;
      ltChoose(ltOpts()[+o.dataset.i]);
    };
  }
  ltHl = Math.max(0, Math.min(ltHl, os.length - 1));
  const list = p.querySelector(".fdd-list");
  if (ltOpt) {  // 2nd step: the songs of the chosen option
    list.innerHTML = `<div class="fdd-grp lt-back" title="뒤로 (Esc)">← ${esc(ltOpt.grp)} · ${esc(ltOpt.label)} <span class="n">${os.length}</span></div>`
      + os.map((o, i) => {
        const r = LT.reqs.find(r => r.key === keyOf(o.it));
        return `<div class="fdd-opt${i === ltHl ? " hl" : ""}" data-i="${i}"><span class="t">${esc(o.it.title)} <span class="a">${esc(shortName(o.it.artist || ""))}</span></span>${
          r ? `<span class="st ${r.state}">${LT_REQ_STATE[r.state]}</span>` : `<span class="go">신청</span>`}</div>`;
      }).join("");
  } else {
    let g = "";
    list.innerHTML = os.map((o, i) => (o.grp !== g ? `<div class="fdd-grp">${esc(g = o.grp)}</div>` : "")
      + `<div class="fdd-opt${i === ltHl ? " hl" : ""}" data-i="${i}">${esc(o.label)}<span class="n">${o.n}</span></div>`).join("");
  }
  try { if (!p.matches(":popover-open")) p.showPopover(); } catch (e) {}
  p.scrollTop = 0;  // the box itself never scrolls (only its list) — a stray scroll cut the top off
  // under the box (or above it when the box is low); page zoom like the main search's placePop: rects are zoomed, styles are not
  const r0 = q.getBoundingClientRect(), z = r0.width / q.offsetWidth || 1, W = innerWidth / z, H = innerHeight / z;
  const rc = {left: r0.left / z, top: r0.top / z, bottom: r0.bottom / z, width: r0.width / z};
  const below = H - rc.bottom - 8, above = rc.top - 8, up = below < 200 && above > below;
  const h = Math.max(140, Math.min(380, up ? above : below));
  Object.assign(p.style, {position: "fixed", inset: "auto", left: Math.max(4, Math.min(rc.left, W - Math.max(rc.width, 240) - 4)) + "px",
    width: Math.max(rc.width, 240) + "px", maxHeight: h + "px", top: up ? "auto" : rc.bottom + 3 + "px", bottom: up ? H - rc.top + 3 + "px" : "auto"});
}
function ltChoose(o) {
  if (!o) return;
  if (!ltOpt) { ltOpt = o; ltHl = 0; return ltRenderPop(); }  // 1st step → its songs
  if (LT.reqs.some(r => r.key === keyOf(o.it))) return;
  LT.reqPage = 9999;  // show the page with the newest one (clamped in render)
  if (LT.role === "host") ltHostRequest(o.it);
  else if (LT.host) ltSend(LT.host, {t: "req", key: keyOf(o.it), item: ltStrip(o.it)});  // the host's list comes right back
  ltRenderReqs();  // the songs stay open (user request: the box doesn't close on its own) — the request shows as 요청중 there
}
$("ltReqQ").addEventListener("input", () => { ltHl = 0; ltOpt = null; ltRenderPop(); });
$("ltReqQ").addEventListener("focus", ltRenderPop);
$("ltReqQ").addEventListener("blur", () => { const p = $("ltReqPop"); if (p) try { p.hidePopover(); } catch (e) {} });
$("ltReqQ").addEventListener("keydown", e => {
  if (e.isComposing) return;
  const os = ltOpts();
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && os.length) {
    e.preventDefault();
    ltHl = Math.max(0, Math.min(os.length - 1, ltHl + (e.key === "ArrowDown" ? 1 : -1)));
    ltRenderPop();
    const h = $("ltReqPop") && $("ltReqPop").querySelector(".hl"); if (h) h.scrollIntoView({block: "nearest"});
  } else if (e.key === "Enter") { e.preventDefault(); ltChoose(os[ltHl]); }
  else if (e.key === "Escape") {
    const p = $("ltReqPop");
    if (ltOpt) { e.preventDefault(); e.stopPropagation(); ltOpt = null; ltHl = 0; ltRenderPop(); }
    else if (p && p.matches(":popover-open")) { e.preventDefault(); e.stopPropagation(); p.hidePopover(); }
  }
});
/* '방장과 싱크조정중...' for a moment at every alignment seek (above dialogs too: popover) */
let ltNoteT = 0;
function ltSyncNote() {
  let n = $("ltSyncNote");
  if (!n) { n = document.createElement("div"); n.id = "ltSyncNote"; n.setAttribute("popover", "manual"); n.textContent = "방장과 싱크조정중..."; document.body.appendChild(n); }
  try { if (!n.matches(":popover-open")) n.showPopover(); } catch (e) {}
  clearTimeout(ltNoteT);
  ltNoteT = setTimeout(() => { try { n.hidePopover(); } catch (e) {} }, 1200);
}
$("ltReqs").addEventListener("click", e => {
  const li = e.target.closest("li[data-id]"); if (!li || LT.role !== "host") return;
  if (e.target.closest(".ok")) ltReqAccept(li.dataset.id);
  else if (e.target.closest(".no")) ltReqDrop(li.dataset.id);
});
function ltOpenDlg() {
  if (!$("listenDlg").open) $("listenDlg").showModal();
  ltRender();
}
$("btnListen").onclick = () => {
  if (!LT.role) {  // user request: the nickname field always starts empty
    $("ltName").value = ""; $("ltNameErr").hidden = true; $("ltName").closest(".ltfield").classList.remove("need");
  }
  ltOpenDlg();
  if (!LT.role) (ltName() ? $("ltTitle") : $("ltName")).focus();
};
$("ltLock").onclick = () => { LT.lock = !LT.lock; ltRender(); if (LT.lock) $("ltNewPw").focus(); };
$("ltName").addEventListener("input", () => {
  store.set("reportWho", ltName());
  if (ltName()) { $("ltNameErr").hidden = true; $("ltName").closest(".ltfield").classList.remove("need"); }
  ltRender();
});
$("ltName").addEventListener("keydown", e => { if (e.key === "Enter" && LT.linkCode) ltJoin(LT.linkCode); });  // opened by a link without a nickname
$("ltMake").onclick = () => ltHost(!LT.lock, $("ltNewPw").value.trim(), $("ltTitle").value.trim());
$("ltTitle").addEventListener("keydown", e => { if (e.key === "Enter") $("ltMake").click(); });
$("ltNewPw").addEventListener("keydown", e => { if (e.key === "Enter") $("ltMake").click(); });
$("ltPwGo").onclick = () => { const pw = $("ltPwIn").value; if (!pw) return $("ltPwIn").focus(); $("ltPwIn").value = ""; ltJoin(LT.ask, pw); };
$("ltPwIn").addEventListener("keydown", e => { if (e.key === "Enter") $("ltPwGo").click(); });
$("ltPwNo").onclick = () => { LT.ask = ""; $("ltPwIn").value = ""; LT.status = ""; ltRender(); };
$("ltCopyLink").onclick = async () => {
  await copyText(ltLink(LT.code));
  LT.status = "방 바로가기가 복사되었습니다.";
  ltRender();
};
$("ltLeave").onclick = () => { const code = LT.role === "host" ? LT.code : ""; $("ltName").value = ""; ltLeave(false); ltRescan(code, 800); };  // back to an empty nickname
$("ltClose").onclick = () => $("listenDlg").close();

/* 바로 들어오는 링크 (#lt=<번호>): 시작 창(토큰)·불러오기가 끝난 뒤 같이듣기 창을 열고 들어감 */
function ltFromLink() {
  const m = /^#lt=(\d{6})$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, "", location.href.split("#")[0]);  // reload doesn't join again
  const code = m[1];
  const go = () => {
    if (document.querySelector("dialog.offdlg[open]") || ($("loadBox") && !$("loadBox").hidden)) return setTimeout(go, 500);
    ltOpenDlg();
    if (!ltName()) { LT.linkCode = code; LT.status = "닉네임을 넣고 Enter 를 누르면 링크의 방으로 들어갑니다"; ltRender(); return ltNeedName(); }
    ltJoin(code);
  };
  setTimeout(go, 800);
}
addEventListener("hashchange", ltFromLink);
ltFromLink();
ltRender();
setTimeout(ltScan, 1500);
