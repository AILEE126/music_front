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
     이 플레이어가 아는 곡 + 우리 DB(전체 곡) 에서 찾은 곡 (2026-11-14 — VocaDB 검색 안 씀) → 곡을 고르면 신청. 방장이 고르면 바로 대기열
     손님이 맞춰 옮길 때마다 '방장과 싱크조정중...' 이 화면 아래에 잠깐 뜸 (user request)
   · 손님이 검색해서 요청 → '요청중' · 방장이 수락하면 '직접 넣은 곡'에 들어가고 '재생대기' →
     틀면 '재생중' → 다 틀고 다음 곡으로 넘어가면 사라짐. 요청곡과 상태는 방 안 모두에게 보임 (방장은 거절도 가능)
   · 대기열 (user request): 방장의 '직접 넣은 곡'·'다음 곡'을 손님도 그대로 받음 (중간에 끼워 넣은 곡도) — 손님은 대기열을 못 바꿈
   · 방이 생기거나 닫히거나 인원이 바뀌면 다른 화면의 방 목록에 바로 보임 (user request): 열린 화면마다 'watch-<n>' 자리를 하나
     맡아 두고(방 목록 찾기에 쓰는 peer), 방장이 그 자리들에 방 카드('room')·닫힘('gone')을 보냄 — 서버 없이 알리는 방법
   · 방 만들기 (user request 2026-11-12): 자물쇠 버튼 하나로 공개/비밀 전환 · 방 제목 지정 · 번호로 들어가기 없음 (목록·링크로만)
   · OPEN CHANNEL (user request 2026-11-17): 방 목록 맨 위에 늘 열려 있는 것처럼 보이는 채널 하나 (음원 관리 › OPEN CHANNEL 에서
     정한 필터 → filter.json channel). 고정 PeerJS id 라 첫 사람이 그 id 를 잡아 방장 역할(곡을 고르고 넘김)을 맡고 그때부터 재생 —
     필터에 맞는 곡을 무작위로 섞어 끝없이 (한 바퀴 돌면 다시 섞음). 방장 역할을 맡은 사람이 나가면 남은 사람이 이어받아 곡이 끊기지 않고,
     아무도 없으면 멈춤. 채널에서는 아무도 재생을 조작하지 못하고 (방장 역할도), 곡 신청은 바로 대기열에 들어감 (한 사람이 신청한 뒤
     2곡이 지나야 다시 신청). 같이듣기 단추의 방 수에 늘 들어가고, 열린 방이 채널 하나뿐이면 숫자 대신 빨간 'ONAIR' · 채널의 필터는 공개하지 않음 ('OPEN CHANNEL' 태그만, 저장 불가)
   서버가 없는 화면이라 브라우저끼리 바로 잇는 WebRTC(PeerJS — 번호로 서로 찾는 일만 PeerJS 공개 서버)를 씀.
   player_screen.js · player_start.js 다음에 읽음 (SHELL·audio·keyOf·LIB·OFFDIR·ONLINE 을 씀) */
const LT_PEERJS = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
const LT_PREFIX = "ailee126-noinjeong-lt-";  // PeerJS id = 이 앞머리 + 번호
const LT_SLOTS = 8;  // room list: each open room also holds one "lobby-<n>" id that answers who/what (no server to list rooms)
const ltSlotId = i => LT_PREFIX + "lobby-" + i;
const LT_WATCH = 16;  // open players that get told at once when a room appears / closes / changes
const ltWatchId = i => LT_PREFIX + "watch-" + i;
const LT = {uid: Math.random().toString(36).slice(2), role: "", code: "", me: "", open: true, pw: "", title: "", lock: false, linkCode: "", lobby: null, lobbyAt: 0, peer: null, conns: new Map(), host: null,
  members: [], status: "", lastHeard: 0, lostAt: 0, retryAt: 0, ask: "", rtt: 0, align: 0, qsig: "", lead: 0, seekAt: 0, reqs: [],
  prep: null, gprep: null, chOn: false, chFast: false, chSave: null, chList: null, chTry: 0, cool: {}, coolKey: ""};  // ch*: OPEN CHANNEL (in it / joining)  // ask: code of a secret room waiting for its password · prep (host) / gprep (guest): start together
const LT_SILENT = 70000;   // 방장 소식이 이만큼 없으면 끊긴 것으로 봄 (뒤에 깔린 탭은 브라우저가 타이머를 1분에 한 번까지 늦춤)
const LT_GIVE_UP = 180000; // 손님: 이만큼 다시 잇지 못하면 나감
let ltApplying = 0;  // 방장 상태를 따라 하는 중 (이때 바뀐 건 다시 보내지 않음)
const ltQuiet = fn => { ltApplying++; try { return fn(); } finally { ltApplying--; } };
// one nickname everywhere (user request 2026-11-17): the one typed at the start (edited by '노인 <name> ✎') — no field here
const ltName = () => String(store.get("reportWho", "") || "").trim();
const ltCrownSvg = () => `<svg class="ltcrown" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-label="방장"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z"/></svg>`;
const ltPenSvg = () => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/><path d="M14.5 5.5l3 3"/></svg>`;
const ltKey = n => String(n || "").normalize("NFKC").trim().toLowerCase();  // nickname compare
const ltNick = n => (typeof n === "string" ? n : (n && n.name) || "");
/* ---------- OPEN CHANNEL (user request 2026-11-17) ---------- */
const LT_CH = "open-channel";  // the channel's LT.code (PeerJS id = LT_PREFIX + this, fixed — whoever holds it plays)
/* OPEN CHANNEL 2x!! (user request 2026-11-20): a second channel — the same songs (same filter), everyone at 2× speed, red
   instead of green. Its own fixed id, so it runs apart from the 1× one. Entering checks the extension first (speed on
   Niconico · SoundCloud … needs it) and opens the add-on guide when it's missing (ltChFastEnter) */
const LT_CH2 = "open-channel-2x", LT_CH2_RATE = 2;
const ltChId = () => LT.chFast ? LT_CH2 : LT_CH;
const ltChName = fast => fast ? "OPEN CHANNEL 2x!!" : "OPEN CHANNEL";
const ltChRate = () => LT.chOn && LT.chFast && LT.role ? LT_CH2_RATE : 0;  // play_engine.js rateFor: the channel's speed
const ltSpeed = () => ltChRate() || 1;  // song seconds per real second (positions sent between players)
const LT_CH_COOL = 2;  // songs that must start before the same person can request again
/* each channel's playlist (user request 2026-11-20: the 2x!! channel plays a list of its own — Manage › 필터 › OPEN CHANNEL 2x!!,
   filter.json channel2; not set → the 1× list). Both channels exist while OPEN CHANNEL is on. k: its saved list ("" · "2") */
const ltChOk = c => c && (c.groups || []).length ? c : null;
function ltChSrc(fast) {
  const f = typeof ONLINE !== "undefined" && ONLINE && VDB.filter;
  if (!f || !ltChOk(f.channel)) return null;
  return fast && ltChOk(f.channel2) ? {conf: f.channel2, k: "2"} : {conf: f.channel, k: ""};
}
const ltChConf = (fast = LT.chFast) => (ltChSrc(fast) || {}).conf || null;
const ltChTag = () => `<span class="ltchtag" title="${ltChName(LT.chFast)} 재생목록 — 필터는 공개하지 않음">${ltChName(LT.chFast)}</span>`;  // stands for the channel's filter
const ltChHost = () => LT.chOn && LT.role === "host";
// cooldown per browser (uid), not per name — the channel needs no nickname (user request 2026-11-17)
const ltCoolLeft = uid => LT.cool[uid] || 0;
/* the channel's songs: our whole DB through its filter, playable only.
   미리 만든 목록 (user request 2026-11-19: entering the channel right after opening waited for the whole song list and the
   filter): Server/data/channel_list.json.gz {sig (the filter), data (VDB.dataSig), at, ids, cols, rows (data rows of those
   songs)} — read at start by everyone; made by a player with a write token (the filter is the player's JS, not the server's)
   whenever the filter or the song list changed, so the channel opens without the whole list */
const ltChFilePath = k => `${LOCAL.data}channel${k}_list.json.gz`;  // channel_list · channel2_list (2x!!)
const ltChFileP = {}, ltChUp = {};  // per k
const ltChSrcs = () => [ltChSrc(false), ltChSrc(true)].filter((s, i, a) => s && (i === 0 || s.k !== a[0].k));
function ltChPrefetch() {
  for (const k of ["", "2"]) delete ltChFileP[k];
  for (const {k} of ltChSrcs()) ltChFileP[k] = LOCAL.readBytes(ltChFilePath(k))
    .then(gz => new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).json()).catch(() => null);
}
const ltChFileOk = (d, groups) => d && Array.isArray(d.ids) && d.sig === JSON.stringify(groups);
/* 정렬해서 n번부터 n곡만 (user request 2026-11-22 — the filter's sort and range; before: 인기순 상위 N곡, conf.top 2026-11-20):
   cut after the filter, so the saved list keeps every passing song and the manage screen can show any range from it.
   No range → every song, as it is (the channel shuffles anyway) */
const ltChTop = (conf, list) => {
  const f = filterOf(conf);
  if (!(f.n > 0 || f.from > 0)) return list;
  return [...list].sort(ourCmp(f.sort || "RatingScore", true)).slice(f.from, f.n > 0 ? f.from + f.n : undefined);
};
async function ltChSongs(fast) {
  const {conf, k} = ltChSrc(fast), groups = conf.groups, d = ltChFileP[k] && await ltChFileP[k];
  if (ltChFileOk(d, groups)) {  // the list made before — a day old song list is fine for a shuffle
    if (!VDB.done) VDB.addRows(d.cols, d.rows);
    const list = d.ids.map(id => VDB.itemById(id)).filter(it => it && canPlay(it));
    if (list.length) return ltChTop(conf, list);
  }
  const make = async () => {
    await searchBase();  // the whole song list (read in the background after the screen opened)
    return (await filterGroupsAsync(VDB.all(), groups, bgTick())).filter(canPlay);  // background: the player's timers keep running
  };
  const list = VDB.done ? await make() : await loadWait(make());  // still loading: the notice with the progress bar
  ltChUpload(groups, list, k);
  return ltChTop(conf, list);
}
/* write token: save the channel's list for everyone (only when the filter or the song list changed since the saved one) */
async function ltChUpload(groups, list, k) {
  if (!LOCAL.canWrite || ltChUp[k]) return;
  const sig = JSON.stringify(groups), data = VDB.dataSig;
  ltChUp[k] = (async () => {
    const d = ltChFileP[k] && await ltChFileP[k];
    if (d && d.sig === sig && d.data === data) return;
    const ids = list.map(it => +it.vocadb).filter(Boolean), tick = bgTick();
    const doc = {sig, data, at: new Date().toISOString(), ids, cols: VDB.idx.cols, rows: await VDB.rowsOf(ids, tick)};
    const gz = await new Response(new Blob([JSON.stringify(doc)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    await LOCAL.writeBytes(ltChFilePath(k), gz, ltName() || "OPEN CHANNEL");
    ltChFileP[k] = Promise.resolve(doc);
  })().catch(e => console.warn("OPEN CHANNEL 곡 목록을 못 올림:", e.message || e)).finally(() => { ltChUp[k] = null; });
}
/* after loading (playlist_panel.js loadRest, write token only): make the saved list again when it's off */
async function ltChRefresh() {
  if (!LOCAL.canWrite) return;
  for (const {conf, k} of ltChSrcs()) {  // each channel's own list
    if (!ltChFileP[k]) ltChPrefetch();
    const d = await ltChFileP[k];
    if (d && d.sig === JSON.stringify(conf.groups) && d.data === VDB.dataSig) continue;
    await searchBase();
    ltChUpload(conf.groups, (await filterGroupsAsync(VDB.all(), conf.groups, bgTick())).filter(canPlay), k);
  }
}
async function ltChJoin(fast = false) {
  const conf = ltChConf(fast);
  if (!conf) return;
  if (LT.chOn && LT.role && LT.chFast === fast) { LT.status = "지금 있는 채널입니다"; return ltRender(); }
  ltLeave(true);  // no nickname needed, no name check — the channel only counts listeners (user request 2026-11-17)
  $("ltNameErr").hidden = true; $("ltName").closest(".ltfield").classList.remove("need");
  LT.me = ltName(); LT.pw = ""; LT.ask = ""; LT.linkCode = ""; LT.open = true; LT.title = conf.title || ""; LT.chFast = fast;
  LT.status = `${ltChName(fast)} 에 들어가는 중…`; ltRender();
  try { await ltLoadPeerJs(); } catch (e) { LT.status = e.message; return ltRender(); }
  // the channel only plays songs here (user request 2026-11-20: no trace of the room shell) — my playlist and queue stay on
  // screen as they were (queue read-only, SHELL.qView), the channel's own queue runs unseen; leaving brings back my song,
  // its position and my queue as before entering
  LT.chSave = {now: SHELL.now, pos: audio.currentTime || 0, queue: SHELL.queue, pinned: SHELL.pinned, upcoming: SHELL.upcoming, history: SHELL.history, repeat: SHELL.repeat};
  SHELL.pinned = []; SHELL.upcoming = []; SHELL.history = [];
  LT.chOn = true; LT.chTry = 0; LT.cool = {};
  ltChClaim();
}
/* OPEN CHANNEL 2x!!: ask the extension once (a hidden bridge page) — there → in; missing / old → the add-on guide, in after it */
let ltFastChecking = false;
async function ltChFastEnter() {
  if (ltFastChecking) return;
  if (LT.chOn && LT.chFast && LT.role) return ltChJoin(true);  // already there: says so
  ltFastChecking = true; LT.status = "확장 프로그램을 확인하는 중…"; ltRender();
  try { await extProbe(); } finally { ltFastChecking = false; }
  LT.status = ""; ltRender();
  if (EXT.ver >= 2) return ltChJoin(true);  // 2: the first version that sets the speed (play_engine.js rateBlock)
  openSetupGuide(ltChName(true), () => { if (EXT.ver >= 2) ltChJoin(true); });
}
/* take the channel id (→ host) · taken → join whoever holds it (ltHostPeer error) */
function ltChClaim() { if (LT.chOn) ltHostPeer(ltChId(), 0); }
/* in the channel but cut off from its host: try again (claim first — the host may be gone) */
function ltChRetry() {
  if (!LT.chOn || LT.role !== "guest" || LT.host || Date.now() < LT.retryAt - 50) return;
  LT.retryAt = Date.now() + 6000;
  const old = LT.peer; LT.peer = null;
  if (old) try { old.destroy(); } catch (e) {}
  ltChClaim();
}
function ltChRetrySoon(ms) { LT.retryAt = Date.now() + ms; setTimeout(ltChRetry, ms + 20); }
/* host: start playing (first one in) or carry on (took over from a host that left — the song is already playing here) */
async function ltChStart(took) {
  const conf = ltChConf();
  if (!conf && !(took && LT.chList)) { ltLeave(true); LT.status = "OPEN CHANNEL 이 꺼져 있습니다"; return ltRender(); }  // took over: its list goes on
  LT.title = conf ? conf.title || "" : LT.title;
  if (!LT.chList) {  // a guest taking over already has it (ltChGuestPl)
    LT.status = "채널 재생목록을 만드는 중…"; ltRender();
    const list = await ltChSongs(LT.chFast);
    if (!ltChHost()) return;
    LT.chList = list; LT.status = "";
  }
  if (!LT.chList.length) { ltLeave(true); LT.status = "OPEN CHANNEL 재생목록에 틀 수 있는 곡이 없습니다 (필터 확인)"; return ltRender(); }
  SHELL.repeat = "all";
  LT.coolKey = SHELL.now ? keyOf(SHELL.now) : "";
  ltMembers(); ltSendReqs();
  if (took && SHELL.now) { if (!SHELL.upcoming.length) SHELL.plan(SHELL.now); ltSendQueue(); return ltBroadcast(); }
  if (conf && ltChRestore(conf)) return;
  SHELL.pinned = []; SHELL.plan(null); SHELL.next(true);
}
/* 마지막 사람이 나가도 1분 동안은 이어지는 것처럼 (user request 2026-11-17): the last listener leaving (나가기 · closing ·
   reloading) leaves a snapshot here (localStorage — no server, so only this browser can pick it up); whoever opens the
   channel again from here within 1 min goes on where it would be now: same song at the position time has moved it to
   (song over meanwhile → the next one from its start — other songs' lengths aren't known), same queue · requests · cooldowns.
   Older than 1 min = the channel was gone: a fresh shuffle. */
const LT_CH_SNAP = "lt.chSnap", LT_CH_KEEP = 60 * 1000;  // 1 min (user request 2026-11-17, was 5)
const ltChSnapKey = () => LT_CH_SNAP + (LT.chFast ? ".2x" : "");  // one per channel
const ltChSig = conf => { const f = filterOf(conf); return JSON.stringify(f.groups) + (f.n > 0 || f.from > 0 ? `#${f.sort},${f.from},${f.n}` : ""); };
function ltChSnapSave() {
  const conf = ltChConf();
  if (!ltChHost() || !conf || !SHELL.now) return;
  const pack = it => it.vocadb ? +it.vocadb : null;
  const s = {at: Date.now(), sig: ltChSig(conf), now: pack(SHELL.now), pos: audio.currentTime || 0, dur: audio.duration || 0, run: !audio.paused,
    pinned: SHELL.pinned.map(pack).filter(Boolean), upcoming: SHELL.upcoming.slice(0, 300).map(pack).filter(Boolean), reqs: LT.reqs, cool: LT.cool};
  try { localStorage.setItem(ltChSnapKey(), JSON.stringify(s)); } catch (e) {}
}
function ltChRestore(conf) {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(ltChSnapKey()) || "null"); localStorage.removeItem(ltChSnapKey()); } catch (e) {}
  if (!s || Date.now() - s.at > LT_CH_KEEP || s.sig !== ltChSig(conf)) return false;
  const get = l => (l || []).map(id => VDB.itemById(id)).filter(it => it && canPlay(it));
  const now = s.now && VDB.itemById(s.now), pos = s.pos + (s.run ? (Date.now() - s.at) / 1000 * ltSpeed() : 0);
  LT.reqs = s.reqs || []; LT.cool = s.cool || {}; ltSendReqs();
  SHELL.pinned = get(s.pinned); SHELL.upcoming = get(s.upcoming);
  if (!SHELL.upcoming.length) SHELL.plan(now);
  if (now && canPlay(now) && s.dur && pos < s.dur - 3) { SHELL.resumeAt(now, pos); SHELL.load(now, true, "next"); }
  else SHELL.next(true);
  return true;
}
/* guest: the channel's list, made here from the same filter (never shown — kept for taking over) */
async function ltChGuestPl() {
  const conf = ltChConf();
  if (!conf || !LT.chOn) return;
  if (!LT.chList) { const list = await ltChSongs(LT.chFast); if (!LT.chOn) return; LT.chList = LT.chList || list; }
}
/* host lost the channel id while cut off and someone else holds it now → my guests and I join that one */
function ltChDemote() {
  LT.conns.forEach((_, c) => ltSend(c, {t: "handover", to: ""}));
  LT.conns = new Map(); ltPrepEnd();
  LT.role = "guest"; LT.host = null; LT.lostAt = LT.lostAt || Date.now();
  LT.status = "채널과 다시 잇는 중…"; ltRender();
  ltChRetrySoon(500);
}
/* host: a song started → everyone's request cooldown goes down by one */
function ltCoolTick() {
  const k = SHELL.now ? keyOf(SHELL.now) : "";
  if (!ltChHost() || !k || k === LT.coolKey) return;
  LT.coolKey = k;
  let changed = false;
  for (const n of Object.keys(LT.cool)) { changed = true; if (--LT.cool[n] <= 0) delete LT.cool[n]; }
  if (changed) ltSendReqs();
}

/* the nickname is taken by someone in a room right now (my own current room doesn't count — I am leaving it) */
function ltTaken(name) {
  const k = ltKey(name);
  return [...(LTS.rooms || []), ...(LTS.ch ? [LTS.ch] : []), ...(LTS.ch2 ? [LTS.ch2] : [])].some(r => (!LT.role || r.code !== LT.code)
    && [r.name, ...(r.members || [])].some(m => ltKey(m) === k));
}
function ltNameTaken() {
  LT.status = "사용중인 닉네임입니다 — 프로그램 이름 옆 ✎ 에서 바꿔 주세요."; ltRender();
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
  LT.status = "닉네임이 없습니다 — 프로그램 이름 옆에서 정해 주세요."; ltRender();
  return true;
}

async function ltLoadPeerJs() {
  if (!window.Peer) await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = LT_PEERJS; s.onload = res; s.onerror = () => { s.remove(); rej(new Error("같이듣기 연결 도구를 받지 못했습니다 (인터넷 확인)")); };
    document.head.appendChild(s);
  });
  await ltTurn();
}
/* Relay (TURN) server. User report: some people saw "열린 방이 없습니다" while a room was open — PeerJS's built-in TURN
   hosts (*.turn.peerjs.com) no longer exist, so networks that can't connect directly (mobile data, some company/school
   wifi) could reach no one. Metered free TURN (user's account); the API key is not in this public repo (user request):
   it sits in the private data repo, Server/data/listen_turn.json {"app": "<name>.metered.live 의 name", "apiKey": "…"},
   read like the song list (token / folder). No file or no answer → direct connections only, as before.
   Every Peer gets this one config object, and PeerJS reads it per connection, so filling it later still counts. */
const LT_STUN = {urls: "stun:stun.l.google.com:19302"};
const LT_CFG = {iceServers: [LT_STUN]};
const ltPeerOpts = () => ({config: LT_CFG});
let ltTurnP = null, ltTurnAt = 0, ltTurnTried = 0;
function ltTurn() {
  if (ltTurnAt && Date.now() - ltTurnAt < 6 * 3600e3) return Promise.resolve();  // credentials refreshed every 6 h
  if (ltTurnP) return ltTurnP;
  if (typeof LOCAL === "undefined" || !LOCAL.ready || Date.now() - ltTurnTried < 60000) return Promise.resolve();
  ltTurnTried = Date.now();
  return ltTurnP = (async () => {
    try {
      const k = await LOCAL.readJson(`${LOCAL.data}listen_turn.json`, null);
      const app = String((k && k.app) || "").trim().replace(/\.metered\.live$/i, "").toLowerCase();
      if (!/^[a-z0-9-]+$/.test(app) || !k.apiKey) return;
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(k.apiKey)}`, {signal: ctl.signal, cache: "no-store"});
      clearTimeout(t);
      const list = r.ok ? await r.json() : null;
      if (!Array.isArray(list) || !list.length) throw new Error("TURN " + r.status);
      LT_CFG.iceServers = [LT_STUN, ...list];
      ltTurnAt = Date.now();
    } catch (e) { console.warn("같이듣기 중계 서버 정보를 받지 못함 (직접 연결만):", e.message || e); }
    finally { ltTurnP = null; }
  })();
}
const ltNewCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
/* 재생하려는 중인가 (온라인 곡은 뜨는 동안 paused 라 재생 의도로 봄) */
const ltIntent = () => audio.bridged ? !!audio.autoplay : !audio.paused;
const ltStrip = it => Object.fromEntries(Object.entries(plainSong(it)).filter(([k]) => !k.startsWith("_")));  // plainSong: vocadb_api.js
/* 받은 곡 → 이 화면의 곡 (같은 키 → 같은 이름 → 온라인 곡이면 받은 곡 그대로 → 제목이 같은 온라인 곡) */
function ltFindItem(key, item) {
  if (LOCAL.items.has(key)) return LOCAL.items.get(key);  // our songs · songs met in search / playlist
  const off = ((typeof OFFDIR !== "undefined" && OFFDIR && OFFDIR.items) || []).find(x => keyOf(x) === key);
  if (off) return off;
  if (!item) return null;
  if (item.site === "stream") return liveItem(item);  // the host's song (e.g. a VocaDB result) — remembered so its lyrics load
  return LIB.items.find(x => x.title === item.title && canPlay(x)) || null;  // 방장의 mp3 곡 → 같은 곡의 온라인 곡
}

/* ---------- 방장 ---------- */
function ltState() {
  const it = SHELL.now;
  return {key: it ? keyOf(it) : "", item: it ? ltStrip(it) : null, pos: audio.currentTime || 0, playing: ltIntent(), run: !audio.paused, ready: audio.readyState > 0,
          prep: LT.prep ? LT.prep.id : ""};
}
/* Start a new song together. User report: guests' song start stuttered (they started late, then catch-up seeks re-buffered).
   Host and guests load the new song without playing (primed: paused at 0, see LocalMedia.primed) and say ready;
   the host starts when all are ready and tells guests "go". Waits at most 2s (user decision) — anyone later catches up
   by seeking as before.  host: prep {id, wait: guests not ready yet, timer} · guest: gprep {id, sent} */
const LT_PREP_MAX = 2000;
let ltPrepSeq = 0;
function ltPrepStart() {
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
/* host: the side panel's playlist → guests see it as it is (user request 2026-11-14 — read-only there).
   Our DB songs go as their VocaDB id only (like the saved playlist), mp3 songs as name/title only (the guest can't play them) */
function ltPlMsg() {
  // channel: no list — 10만 곡 넘는 id 목록은 PeerJS 로 안 건너감 (test 2026-11-17); guests make it from the same filter
  if (LT.chOn) return {t: "pl", plf: null, ch: true};  // the channel's filter is never shown or sent (user request 2026-11-17)
  // viewAll: not narrowed by 재생목록에서 찾기
  return {t: "pl", plf: PLF, list: viewAll.map(it => it.vocadb && VDB.has(it.vocadb) ? +it.vocadb
    : it.site === "local" ? {site: "local", name: it.name, title: it.title, artist: it.artist || ""} : ltStrip(it))};
}
let ltPlSig = "", ltPlT = 0;
function ltPlChanged() {  // called by renderList (player_screen.js) — sent only when the list really changed
  if (LT.role !== "host") return;
  clearTimeout(ltPlT);
  ltPlT = setTimeout(() => {
    const sig = viewAll.map(keyOf).join("\n") + "\n" + JSON.stringify(PLF);  // plf: the host's 재생목록 필터 (user request 2026-11-15) — may change alone
    if (sig === ltPlSig) return;
    ltPlSig = sig;
    const m = ltPlMsg();
    LT.conns.forEach((_, c) => ltSend(c, m));
  }, 300);
}
/* guest: show the host's playlist instead of mine (mine comes back on leaving) */
let ltPlN = 0;
async function ltShowPl(list) {
  const n = ++ltPlN;
  await VDB.ensure((list || []).filter(x => typeof x === "number"));  // blocks not read yet (the screen opens before them)
  if (n !== ltPlN) return;  // a newer list came meanwhile
  guestPl = (list || []).map(x => typeof x === "number" ? VDB.itemById(x) : x && x.site === "local" ? x : liveItem(x)).filter(Boolean);
  renderList();
}
const ltMyColor = () => okColor(store.get("myColor", ""));
/* my 대표색상 changed (nickname dialog): host → everyone's list again · guest → tell the host */
function ltColorChanged() {
  if (LT.role === "host") return ltMembers();
  if (LT.role === "guest" && LT.host) { LT.colors = Object.assign({}, LT.colors, {[ltKey(LT.me)]: ltMyColor()}); ltSend(LT.host, {t: "color", c: ltMyColor()}); }
  ltRender();
}
function ltMembers() {
  LT.members = [LT.me, ...[...LT.conns.values()].map(v => v.name)];
  // 대표색상 per nickname (user request 2026-11-17) — kept apart from list so old screens read members as before
  LT.colors = {};
  [[LT.me, ltMyColor()], ...[...LT.conns.values()].map(v => [v.name, v.color])].forEach(([n, c]) => { if (c) LT.colors[ltKey(n)] = c; });
  const m = {t: "members", list: LT.members, colors: LT.colors, title: LT.title, open: LT.open};
  LT.conns.forEach((_, c) => ltSend(c, m));
  ltRender();
  ltAnnounceSoon();  // room opened / someone came or left → other screens at once
}
async function ltHost(open, pw, title) {
  if (ltNeedName()) return;
  if (!open && !pw) { LT.status = "비밀번호를 정해 주세요"; ltRender(); return $("ltNewPw").focus(); }
  if (!await ltNameFree()) return;
  ltLeave(true);
  LT.me = ltName(); nameHistAdd(LT.me); LT.open = open; LT.pw = open ? "" : pw; LT.title = title || `${LT.me}님의 방`;
  LT.status = "방을 만드는 중…"; ltRender();
  try { await ltLoadPeerJs(); } catch (e) { LT.status = e.message; return ltRender(); }
  ltHostPeer(ltNewCode(), 3);
}
/* 방장 peer (번호 = PeerJS id). left: 번호가 겹치면 새 번호로 다시 할 횟수 (-1: 이미 연 방을 같은 번호로 다시 엶) */
function ltHostPeer(code, left) {
  const peer = new Peer(LT_PREFIX + code, ltPeerOpts());
  LT.peer = peer;
  peer.on("open", () => {
    if (LT.peer !== peer) return;
    const took = LT.role === "guest";  // channel: a guest takes over
    LT.resumeTry = 0;
    LT.role = "host"; LT.code = code; LT.status = ""; LT.lostAt = 0; LT.retryAt = 0; LT.host = null; SHELL.follow = false;
    ltRescan("", 1500);  // after the lobby slot is taken, my room shows in the list
    ltMembers();
    if (LT.chOn) return ltChStart(took);  // the channel takes no lobby slot: room lists ask its fixed id directly
    if (!LT.lobby) ltLobby(0);
  });
  peer.on("connection", c => {
    c.on("open", () => {
      if (c.metadata && c.metadata.probe) { ltSend(c, ltCard()); return setTimeout(() => { try { c.close(); } catch (e) {} }, 1500); }  // a room list asking the channel
      const pw = (c.metadata && c.metadata.pw) || "";
      if (!LT.open && pw !== LT.pw) {  // secret room: the host checks the password
        ltSend(c, {t: "denied", why: pw ? "wrong" : "need"});
        return setTimeout(() => { try { c.close(); } catch (e) {} }, 800);
      }
      const name = (c.metadata && c.metadata.name) || "손님", uid = (c.metadata && c.metadata.uid) || "";
      for (const [o, v] of LT.conns) if (uid && v.uid === uid) { LT.conns.delete(o); try { o.close(); } catch (e) {} }  // same browser coming back
      if (!LT.chOn && (ltKey(name) === ltKey(LT.me) || [...LT.conns.values()].some(v => ltKey(v.name) === ltKey(name)))) {
        ltSend(c, {t: "denied", why: "name"});
        return setTimeout(() => { try { c.close(); } catch (e) {} }, 800);
      }
      LT.conns.set(c, {name, uid, color: okColor(c.metadata && c.metadata.color), seen: Date.now()}); ltMembers(); ltSend(c, {t: "state", s: ltState()}); ltSendQueue(c); ltSend(c, ltReqsMsg()); ltSend(c, ltPlMsg());
    });
    c.on("data", m => ltHostGot(c, m));
    c.on("close", () => { if (LT.conns.delete(c)) ltMembers(); });
    c.on("error", () => { if (LT.conns.delete(c)) ltMembers(); });
  });
  peer.on("error", e => {
    if (LT.peer !== peer) return;
    if (LT.role !== "host") {  // 방을 열기 전
      if (LT.chOn && e.type === "unavailable-id") { peer.destroy(); return ltGuestPeer(ltChId()); }  // someone holds the channel → join them
      if (LT.chOn && LT.role === "guest") { peer.destroy(); return ltGuestLost(); }  // taking over failed: try again
      // back from an update reload: the old page may still hold the code for a moment → try the same code again
      if (e.type === "unavailable-id" && LT.resumeTry > 0) { LT.resumeTry--; peer.destroy(); return setTimeout(() => { if (LT.resumeTry >= 0 && !LT.role) ltHostPeer(code, -1); }, 2000); }
      if (e.type === "unavailable-id" && left > 0) { peer.destroy(); return ltHostPeer(ltNewCode(), left - 1); }  // 번호가 겹침 → 다른 번호
      ltLeave(true); LT.status = ltErrText(e); return ltRender();
    }
    // Room already open (user report: the room broke after a while): a dropped link to the PeerJS server used to close it.
    // Guests already in talk to this browser directly and don't need that server — keep the room, reconnect in ltKeep.
    if (LT.chOn && e.type === "unavailable-id") return ltChDemote();
    if (["network", "server-error", "socket-error", "socket-closed", "disconnected", "unavailable-id"].includes(e.type)) ltHostLost();
  });
  peer.on("disconnected", () => { if (LT.peer === peer && LT.role === "host") ltHostLost(); });
}
/* room list slot: take the first free lobby-<n> id; anyone who connects gets this room's card */
function ltLobby(i) {
  if (LT.role !== "host" || i >= LT_SLOTS) return;
  const p = new Peer(ltSlotId(i), ltPeerOpts());
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
const ltReqsMsg = () => ({t: "reqs", list: LT.reqs.map(({item, ...r}) => r), cool: LT.cool});
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
  ltQuiet(() => SHELL.enqueue(it));  // quiet: the channel locks the host's own queue edits  // into '직접 넣은 곡' (plays before the rest)
  ltSendReqs();
}
/* host picked a song in the search: straight into the queue */
function ltHostRequest(it) {
  if (LT.reqs.some(r => r.key === keyOf(it))) return;
  if (LT.chOn) { if (ltCoolLeft(LT.uid)) return; LT.cool[LT.uid] = LT_CH_COOL; }
  LT.reqs.push({id: Math.random().toString(36).slice(2, 8), key: keyOf(it), item: ltStrip(it), title: it.title || "", artist: it.artist || "", by: LT.me || "익명", state: "wait"});
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
  return {t: "room", ch: LT.chOn, at: Date.now(), name: LT.chOn ? "" : LT.me, members: LT.chOn ? [] : LT.members.slice(1), title: LT.title, open: LT.open, code: LT.code, n: (LT.members.length || 1), song: it ? (it.title || "") : ""};
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
  else if (m.t === "color") { v.color = okColor(m.c); ltMembers(); }  // guest changed 대표색상 while in the room
  else if (m.t === "ready") { if (LT.prep && m.id === LT.prep.id) { LT.prep.wait.delete(c); ltPrepCheck(); } }  // guest lined up at 0
  else if (m.t === "req" && m.key && !LT.reqs.some(r => r.key === m.key)) {  // song request from a guest
    if (LT.chOn && ltCoolLeft(v.uid)) return ltSendReqs();  // channel: still cooling down (their screen shows how long)
    const it = ltFindItem(m.key, m.item);
    if (!it || !canPlay(it)) return;
    LT.reqs.push({id: Math.random().toString(36).slice(2, 8), key: m.key, item: ltStrip(it), title: it.title || "", artist: it.artist || "", by: LT.chOn ? v.name || "익명" : v.name, state: "wait"});
    if (LT.chOn) { LT.cool[v.uid] = LT_CH_COOL; return ltReqAccept(LT.reqs[LT.reqs.length - 1].id); }  // channel: taken at once
    ltSendReqs();
    ltReqNotify(LT.reqs[LT.reqs.length - 1]);
  }
}
/* a guest's request came in (user request 2026-11-15, host only): open the 같이듣기 window, a short chime (phone app:
   a phone notification with its own sound instead — works in the background too; phone browser: + vibration),
   and the 수락 buttons · 같이듣기 button blink while a request waits */
let ltAudio = null;
function ltReqNotify(r) {
  if (!$("listenDlg").open) $("listenDlg").showModal();
  ltRender();
  if (APP.on && APP.notify) return APP.notify("같이듣기 신청곡", `${r.by}: ${r.title}${r.artist ? ` — ${shortName(r.artist)}` : ""}`);
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
  try {
    ltAudio = ltAudio || new (window.AudioContext || window.webkitAudioContext)();
    if (ltAudio.state === "suspended") ltAudio.resume();
    const t = ltAudio.currentTime, g = ltAudio.createGain();
    g.connect(ltAudio.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    [[880, 0], [1320, 0.16]].forEach(([f, d]) => {  // two-note "딩동"
      const o = ltAudio.createOscillator();
      o.type = "sine"; o.frequency.value = f; o.connect(g); o.start(t + d); o.stop(t + 0.7);
    });
  } catch (e) {}
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
  LT.me = ltName(); nameHistAdd(LT.me); LT.pw = pw; LT.ask = "";
  LT.status = "들어가는 중…"; ltRender();
  try { await ltLoadPeerJs(); } catch (e) { LT.status = e.message; return ltRender(); }
  ltGuestPeer(code);
}
/* 손님 peer: 방장에게 잇기. 첫 소식이 오면 들어간 것 (비밀번호가 틀리면 방장이 "denied").
   이미 들어와 있던 방(LT.role guest)이면 끊겨도 나가지 않고 ltKeep 이 다시 이음 */
function ltGuestPeer(code) {
  const peer = LT.peer = new Peer(ltPeerOpts());
  const fail = msg => {
    if (LT.peer !== peer) return;
    if (LT.role === "guest") return ltGuestLost();
    // back from an update reload: the host may be reloading too — try again a few times
    if (LT.resumeTry > 0) { LT.resumeTry--; LT.peer = null; try { peer.destroy(); } catch (e) {} return setTimeout(() => { if (!LT.role && !LT.peer) ltGuestPeer(code); }, 3000); }
    if (LT.chOn && LT.chTry++ < 4) { LT.peer = null; try { peer.destroy(); } catch (e) {} return setTimeout(ltChClaim, 800); }  // channel host just left: take it
    ltLeave(true); LT.status = msg; ltRender();
  };
  peer.on("open", () => {
    if (LT.peer !== peer) return;
    const c = peer.connect(LT_PREFIX + code, {reliable: true, metadata: {name: LT.me, pw: LT.pw, uid: LT.uid, color: ltMyColor()}});
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
        LT.role = "guest"; LT.code = code; LT.host = c; LT.status = ""; LT.lastHeard = Date.now(); LT.lostAt = 0; LT.resumeTry = 0;
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
  if (LT.chOn) {  // channel: someone takes over (claim) soon — at random so not everyone at once
    if (LT.retryAt < Date.now()) ltChRetrySoon(1000 + Math.random() * 2000);
    LT.status = "채널을 이어받는 중…"; return ltRender();
  }
  LT.status = "방장과 연결이 끊겨 다시 잇는 중…"; ltRender();
}
function ltGuestGot(m) {
  LT.lastHeard = Date.now();
  if (m.t === "handover") {  // channel: the host left — the one named takes over at once, the rest a little later
    LT.host = null; LT.lostAt = LT.lostAt || Date.now(); LT.status = "채널을 이어받는 중…"; ltRender();
    return ltChRetrySoon(m.to === LT.uid ? 700 : 2500 + Math.random() * 1500);
  }
  if (m.t === "reload") {  // host is reloading for an update: try again a few seconds later (ltKeep), same room
    const c = LT.host; ltGuestLost(); LT.retryAt = Date.now() + 4000;
    LT.status = "방장이 새 버전으로 새로고침하는 중… 곧 다시 이어집니다"; ltRender();
    try { c.close(); } catch (e) {}
    return;
  }
  if (m.t === "bye" && LT.chOn) return ltGuestGot({t: "handover", to: ""});  // the channel never closes on guests (user 2026-11-19)
  if (m.t === "bye") { const code = LT.code; ltLeave(true); LT.status = "방장이 방을 닫았습니다"; return ltRescan(code, 800); }
  if (m.t === "members") { LT.members = m.list || []; LT.colors = m.colors || {}; LT.title = m.title || ""; LT.open = m.open !== false; return ltRender(); }
  if (m.t === "state") return ltApply(m.s, performance.now());
  if (m.t === "go") return ltGuestGo(m.id);
  if (m.t === "pong") { const r = performance.now() - m.at; if (r >= 0 && r < 5000) LT.rtt = LT.rtt ? LT.rtt * 0.7 + r * 0.3 : r; return; }
  if (m.t === "queue") return ltApplyQueue(m);
  if (m.t === "pl") { LT.hostPlf = m.plf || null; if (m.ch) ltChGuestPl(); else ltShowPl(m.list); return ltRender(); }
  if (m.t === "reqs") { LT.reqs = m.list || []; LT.cool = m.cool || {}; ltRenderReqs(); }
}
/* host's queue → mine (songs I can't play here are left out) */
function ltApplyQueue(m) {
  const take = l => (l || []).map(x => ltFindItem(x.key, x.item)).filter(it => it && canPlay(it));
  SHELL.pinned = take(m.pinned); SHELL.upcoming = take(m.upcoming);
  SHELL.qemit();
}
/* guest: the song really started sounding → ask for the exact position (after joining / a new song) */
function ltWant() { if (LT.role === "guest" && LT.host && LT.align) ltSend(LT.host, {t: "want"}); }
/* guest: host is lining everyone up for a new song → have it here paused at 0, say ready when it is */
function ltGuestPrep(s, it) {
  if (LT.gprep && LT.gprep.id === s.prep) return;  // already on it
  LT.gprep = {id: s.prep, sent: false};
  LT.align = 4;  // if "go" comes before we're ready: catch up as before
  if (!SHELL.now || keyOf(SHELL.now) !== keyOf(it)) ltQuiet(() => SHELL.load(it, false, "pick"));  // primed → loadedmetadata → ready
  else ltQuiet(() => { audio.pause(); audio.currentTime = 0; });  // same song again
  ltGuestReady();
}
function ltGuestReady() {
  const g = LT.gprep;
  if (LT.role !== "guest" || !LT.host || !g || g.sent || audio.readyState <= 0) return;
  g.sent = true;
  ltSend(LT.host, {t: "ready", id: g.id});
}
function ltGuestGo(id) {
  const g = LT.gprep;
  if (!g || g.id !== id) return;
  LT.gprep = null;
  if (g.sent) LT.align = 0;  // lined up at 0 in time → no catch-up seeks
  ltQuiet(() => { audio.play().catch(() => {}); });
}
function ltApply(s, got) {
  if (!s || !s.key) return;
  const it = ltFindItem(s.key, s.item);
  if (!it || !canPlay(it)) { LT.status = `방장이 트는 곡을 여기서 틀 수 없습니다: ${(s.item && s.item.title) || s.key}`; return ltRender(); }
  if (LT.status) { LT.status = ""; ltRender(); }
  if (s.prep) return ltGuestPrep(s, it);
  LT.gprep = null;  // lining up is over ("go" lost, or the host moved on) — the play/pause below takes over
  if (!SHELL.now || keyOf(SHELL.now) !== keyOf(it)) { LT.align = 4; return ltQuiet(() => SHELL.load(it, s.playing, "pick")); }  // 위치는 곡이 울리기 시작하면 (ltWant)
  if (s.playing && !ltIntent()) ltQuiet(() => { audio.play().catch(() => {}); });
  else if (!s.playing && ltIntent()) ltQuiet(() => audio.pause());
  // position: only when both sides are really playing (or both stopped) — not while one of them is still loading
  if (!s.ready || audio.readyState <= 0) return;
  // expected host position now: + time since it arrived + half the round trip (it was already that old when sent)
  const exp = s.pos + (s.run ? (performance.now() - got + LT.rtt / 2) / 1000 * ltSpeed() : 0), both = s.run && !audio.paused, still = !s.playing && audio.paused;
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
function ltLeave(quiet, keepSong) {  // keepSong: the channel's song stays (left to sync it) — no song from before
  LT.titleEdit = false;
  const was = !!LT.role && !LT.unloading && !LT.reloading;  // really left a room / the channel (not a page unload)
  if (ltChHost() && !LT.conns.size) ltChSnapSave();  // the last one out of the channel: 1 min to come back to it
  if (LT.role === "host" && LT.chOn && LT.conns.size) {  // channel: someone still listening takes it over (first one in)
    const to = [...LT.conns.values()][0].uid;
    LT.conns.forEach((_, c) => ltSend(c, {t: "handover", to}));
  } else if (LT.role === "host" && LT.reloading) {  // update reload: the room comes back with the same code — guests wait
    LT.conns.forEach((_, c) => ltSend(c, {t: "reload"}));
  } else if (LT.role === "host") { LT.conns.forEach((_, c) => ltSend(c, {t: "bye"})); clearTimeout(ltAnnT); ltAnnounce({t: "gone", code: LT.code, at: Date.now()}); }
  ltLobbyStop();
  const peer = LT.peer;
  ltPrepEnd(); LT.gprep = null;
  LT.peer = null; LT.role = ""; LT.code = ""; LT.host = null; LT.members = []; LT.colors = {}; LT.hostPlf = null; LT.reqs = []; LT.reqPage = 0; LT.lead = 0; LT.conns = new Map(); LT.lostAt = 0; LT.retryAt = 0;
  SHELL.follow = false;
  if (LT.chSave) {  // left the channel: the screen as before entering — my song (paused at its place) and my queue
    const k = LT.chSave; LT.chSave = null;
    if (!keepSong && !LT.unloading && !LT.reloading && k.now && canPlay(k.now)) { SHELL.resumeAt(k.now, k.pos); SHELL.load(k.now, false, "pick"); }
    SHELL.pinned = k.pinned; SHELL.upcoming = k.upcoming; SHELL.history = k.history; SHELL.repeat = k.repeat;
    if (SHELL.queue !== k.queue) SHELL.plan(SHELL.now);  // my playlist changed while in the channel
    else SHELL.qemit();
  }
  LT.chOn = false; LT.chFast = false; LT.chList = null; LT.cool = {}; LT.coolKey = "";
  if (was) ltHoldPaused();
  ltPlSig = "";
  ltPlN++;  // a host list still being read is dropped
  if (guestPl) { guestPl = null; renderList(); }  // back to my own playlist
  if (peer) setTimeout(() => { try { peer.destroy(); } catch (e) {} }, 300);  // "bye" 가 먼저 나가게
  if (!quiet) LT.status = "";
  ltRender();
}

/* OPEN CHANNEL is left only by 나가기 (user 2026-11-19: never thrown out otherwise). One exception, phones only (app or a touch
   browser — user request 2026-11-18): another app playing media takes the sound and the player pauses → that one person leaves
   (the others go on: holder → handover; alone = the usual 1-min snapshot). Everywhere else a pause we didn't make is undone:
   play again. Our own pauses never get here (audio.pause is blocked in the channel); song end, a song change, lining up (prep)
   and a failing song are not "outside". Checked after a moment: a pause that comes right back isn't one.
   User report 2026-11-19 (the whole channel thrown out at once): at a song start every guest gets "go" together → play(); the
   embed's late answer to the priming pause (Niconico: paused after playing) looked like an outside pause. So on phones too a
   pause within a few seconds of our own play / load / seek is the player settling → play again, not leave. */
const ltOuter = {timer: 0, ended: false, cmdAt: 0, again: {}, hold: 0, holdCmd: 0};
/* left a room or OPEN CHANNEL → the screen stays paused (user request 2026-11-20: the song from before the channel started
   playing by itself on leaving). The player itself may still start the loaded song (a frame settling) — for a few seconds any
   start that isn't the user's own ▶ (audio.play → cmdAt) is paused again */
function ltHoldPaused() {
  audio.pause();
  ltOuter.hold = performance.now() + 8000; ltOuter.holdCmd = ltOuter.cmdAt;
}
audio.addEventListener("playing", () => {
  if (!LT.role && performance.now() < ltOuter.hold && ltOuter.cmdAt === ltOuter.holdCmd) { diag("lt", "left: started by itself — paused"); audio.pause(); }
});
const LT_SETTLE = 4000;
const ltPhone = () => (typeof APP !== "undefined" && APP.on) || matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
function ltChOuterPause() {
  if (!LT.chOn || !LT.role || ltApplying || LT.prep || LT.gprep || audio.priming || LT.reloading) return;
  const k = SHELL.now ? keyOf(SHELL.now) : "";
  ltOuter.ended = false;
  clearTimeout(ltOuter.timer);
  const still = () => LT.chOn && LT.role && k && !ltOuter.ended && audio.paused && !audio.error && !LT.prep && !LT.gprep && !LT.reloading
    && SHELL.now && keyOf(SHELL.now) === k;
  const settling = performance.now() - ltOuter.cmdAt < LT_SETTLE && (ltOuter.again[k] || 0) < 2;  // twice per song at most
  if (!ltPhone() || settling) {
    if (settling) ltOuter.again = {[k]: (ltOuter.again[k] || 0) + 1};
    ltOuter.timer = setTimeout(() => {
      if (!still()) return;
      diag("lt", "channel: paused not by us — play again");
      ltQuiet(() => { audio.play().catch(() => {}); });
    }, 1500);
    return;
  }
  ltOuter.timer = setTimeout(() => {
    if (!still()) return;
    ltLeave(true); LT.status = "다른 앱에서 재생이 시작돼 OPEN CHANNEL 에서 나왔습니다"; ltRender();
  }, 2500);
}

/* 3초마다: 방장은 지금 상태를 알리고 연결 서버와 끊겼으면 다시 이음 · 손님은 살아 있다고 알리고 끊겼으면 다시 들어감 */
function ltKeep() {
  const now = Date.now();
  if (LT.role === "host") {
    ltBroadcast();
    ltSendQueue();
    let gone = false;
    // closed link, or silent longer than a guest in a background tab can be (a phone app killed outright left its link "open"
    // and stayed in the member list for minutes)
    LT.conns.forEach((v, c) => { if (now - v.seen > 20000 && (!c.open || now - v.seen > LT_SILENT)) { LT.conns.delete(c); try { c.close(); } catch (e) {} gone = true; } });
    if (gone) ltMembers();
    if (ltChHost() && !LT.conns.size) ltChSnapSave();  // alone in the channel: kept fresh in case the tab dies (crash · killed app)
    else if (ltChHost()) try { localStorage.removeItem(ltChSnapKey()); } catch (e) {}  // others here carry it on — an old one would be wrong
    const p = LT.peer;
    if (!LT.chOn && !LT.lobby && p && p.open && now >= LT.lobbyAt) { LT.lobbyAt = now + 30000; ltLobby(0); }  // lost / full slots: try again now and then
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
    } else if (!LT.chOn && now - LT.lostAt > LT_GIVE_UP) { ltLeave(true); LT.status = "방장과 연결이 끊겼습니다 (3분 동안 다시 잇지 못함)"; ltRender(); }
    else if (LT.chOn) { ltChRetry(); if (now - LT.lostAt > LT_GIVE_UP) { LT.status = "채널과 다시 잇는 중… (인터넷 확인)"; ltRender(); } }  // channel: never gives up (user 2026-11-19)
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
  // OPEN CHANNEL: nobody controls playback, the host's screen neither — only its own song-end moves on (how "next")
  const chLocked = () => ltChHost() && !ltApplying;
  const load = SHELL.load, next = SHELL.next, prev = SHELL.prev, toggle = SHELL.toggle, plan = SHELL.plan, jump = SHELL.jump;
  SHELL.load = function (it, autoplay = true, how = "") {
    if (locked() || chLocked() && how !== "next") return Promise.resolve();
    ltPrepEnd();
    ltOuter.cmdAt = performance.now();
    const prep = LT.role === "host" && autoplay && [...LT.conns.keys()].some(c => c.open);  // guests here → start together
    if (prep) ltPrepStart();
    const r = load.call(this, it, autoplay && !prep, how);  // prep: loaded paused at 0 — ltGo starts it
    if (prep) this.autoplay = true;  // still meant to play (a song that fails still moves on)
    ltBroadcast();
    return r;
  };
  SHELL.next = function (auto, how) {  // 곡 끝·못 튼 곡도 방장이 넘김
    if (locked() || chLocked() && !auto) return;
    if (ltChHost() && !this.pinned.length && !this.upcoming.length) this.plan(this.now);  // channel: a lap done → shuffle again (my own playlist may be empty)
    return next.call(this, auto, how);
  };
  SHELL.prev = function () { if (!locked() && !chLocked()) return prev.call(this); };
  // channel host: the order comes from the channel's songs, always shuffled (never my playlist)
  SHELL.plan = function (from) {
    if (!ltChHost() || !LT.chList) return plan.call(this, from);
    const rest = LT.chList.filter(x => !from || keyOf(x) !== keyOf(from));
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    this.upcoming = rest; this.qemit();
  };
  SHELL.jump = function (l, i) { if (!locked() && !chLocked()) return jump.call(this, l, i); };
  SHELL.toggle = function () { if (locked() || chLocked()) return; if (LT.role === "host" && LT.prep) return ltGo(); return toggle.call(this); };  // ▶ while lining up = start now
  const enqueue = SHELL.enqueue, unqueue = SHELL.unqueue, qemit = SHELL.qemit;
  SHELL.enqueue = function (it) { if (!locked() && !chLocked()) return enqueue.call(this, it); };  // guest: the host's queue only
  SHELL.unqueue = function (l, i) { if (!locked() && !chLocked()) return unqueue.call(this, l, i); };
  SHELL.qemit = function () { const r = qemit.call(this); if (LT.role === "host") setTimeout(() => { ltSendQueue(); ltReqFollow(); }, 0); return r; };
  // every other way (keys ←/→, lyrics click, seek bar, video click) ends up here
  const proto = Object.getPrototypeOf(audio), ct = Object.getOwnPropertyDescriptor(proto, "currentTime");
  Object.defineProperty(audio, "currentTime", {
    configurable: true,
    get() { return ct.get.call(this); },
    set(t) { if (!locked() && !chLocked()) { ltOuter.cmdAt = performance.now(); ct.set.call(this, t); } else setTimeout(() => tick(true), 0); },  // 막으면 위치 막대를 제자리로
  });
  audio.play = function () { if (locked()) return Promise.resolve(); ltOuter.cmdAt = performance.now(); return proto.play.call(this); };
  audio.pause = function () { if (!locked() && !chLocked()) return proto.pause.call(this); };
  ["play", "playing", "pause", "seeked", "loadedmetadata"].forEach(ev => audio.addEventListener(ev, ltBroadcast));
  audio.addEventListener("playing", ltWant);
  audio.addEventListener("pause", ltChOuterPause);
  audio.addEventListener("ended", () => { ltOuter.ended = true; });
  audio.addEventListener("loadedmetadata", () => { ltPrepCheck(); ltGuestReady(); });
  SHELL.subscribe(() => { if (LT.role === "host") setTimeout(() => { ltSendQueue(); ltReqFollow(); ltCoolTick(); }, 0); });  // song changed → upcoming changed too
  setInterval(ltKeep, 3000);
  addEventListener("pagehide", () => { LT.unloading = true; ltLeave(true); });
  SHELL.qView = () => LT.chSave;  // in the channel the queue panel shows my queue as it was, read-only
}

/* ---------- 방 목록: 화면을 열 때 한 번 + 새로고침 버튼을 누를 때만 (user request: 저절로 다시 찾지 않음, 마지막 갱신 시각 표시) ---------- */
/* miss: rooms that exist (their slot id is taken) but sent no card in time — couldn't connect · err: no list at all */
const LTS = {peer: null, rooms: null, busy: false, at: 0, done: "", again: false, wait: null, miss: 0, err: "", unavail: null, ch: null, ch2: null};  // ch / ch2: OPEN CHANNEL's / 2x!!'s card while someone is in it
const LT_SCAN_MAX = 12000;  // user report: a room missing from the list — the old fixed 4 s was too short on slow networks
/* a failed look tries again by itself (user request 2026-11-15): up to 3 times, 4 s apart — the 새로고침 button starts over */
const LT_SCAN_RETRY = 3;
function ltScanRetry() {
  if (!LTS.err && !LTS.miss) { LTS.retry = 0; return; }
  if ((LTS.retry || 0) >= LT_SCAN_RETRY) return;
  LTS.retry = (LTS.retry || 0) + 1;
  clearTimeout(LTS.retryT); LTS.retryT = setTimeout(() => ltScan(), 4000);
}
function ltScan(again) {
  if (LTS.busy) { if (again) LTS.again = true; return LTS.wait; }  // a scan already running: one more right after (state changed meanwhile)
  LTS.busy = true; LTS.at = Date.now(); ltRenderRooms();
  return LTS.wait = new Promise(async res => {
    try { await ltLoadPeerJs(); } catch (e) { LTS.busy = false; LTS.rooms = LTS.rooms || []; LTS.err = e.message; ltRenderRooms(); ltScanRetry(); return res(); }
    const found = new Map(), open = new Set();  // open: slots not answered yet (no card, not reported empty)
    let fin = false;
    const finish = (err = "") => {
      if (fin) return; fin = true; LTS.unavail = null;
      if (!LTS.busy) return res();
      const slotsOpen = [...open].filter(i => typeof i === "number").length;  // the channel isn't a room (no answer = keep what we knew)
      LTS.busy = false; LTS.rooms = [...found.values()]; LTS.miss = slotsOpen; LTS.err = err; LTS.done = nowText();
      // no slot answered at all, not even "empty": the link to the PeerJS server is dead → a fresh peer next time
      if (slotsOpen === LT_SLOTS) { ltScanPeerDrop(); LTS.miss = 0; LTS.err = "같이듣기 연결 서버에서 답이 없습니다 — 잠시 뒤 새로고침해 주세요"; }
      ltRender();
      if (LTS.again) { LTS.again = false; return ltScan().then(res); }
      ltScanRetry();
      res();
    };
    const settle = i => { open.delete(i); if (!open.size) finish(); };  // everything answered → done at once
    const ask = p => {
      const CHS = [["ch", LT_CH], ["ch2", LT_CH2]];  // LTS key · channel code
      LTS.unavail = id => {
        const ch = CHS.find(([, code]) => id === LT_PREFIX + code);
        if (ch) { LTS[ch[0]] = null; return settle(ch[0]); }  // nobody in that channel
        const i = [...Array(LT_SLOTS).keys()].find(i => ltSlotId(i) === id); if (i != null) settle(i);  // empty slot
      };
      if (ltChConf()) for (const [k, code] of CHS) {  // OPEN CHANNEL (both): its holder answers a probe with its card
        open.add(k);
        const c = p.connect(LT_PREFIX + code, {reliable: true, metadata: {probe: true}});
        c.on("data", m => {
          try { c.close(); } catch (e) {}
          if (!m || m.t !== "room") return;
          LTS[k] = m;
          if (fin) return ltRender();
          settle(k);
        });
      }
      for (let i = 0; i < LT_SLOTS; i++) {
        open.add(i);
        const c = p.connect(ltSlotId(i), {reliable: true});
        c.on("data", m => {
          try { c.close(); } catch (e) {}
          if (!m || m.t !== "room") return;
          if (fin) { if (open.delete(i)) { LTS.miss = open.size; ltWatchGot(m); } return; }  // late card: still goes in the list
          found.set(i, m); settle(i);
        });
      }
      setTimeout(finish, LT_SCAN_MAX);
    };
    if (LTS.peer && LTS.peer.open && !LTS.peer.destroyed) return ask(LTS.peer);
    ltScanPeerDrop();
    ltWatchPeer(0, p => p ? ask(p) : finish("같이듣기 연결 서버에 닿지 못했습니다 (인터넷 확인 · 잠시 뒤 새로고침)"));
  });
}
/* user request: the room list follows every change on any screen — drop a room I just closed at once, then look again */
function ltRescan(dropCode, delay) {
  if (dropCode && LTS.rooms) LTS.rooms = LTS.rooms.filter(r => r.code !== dropCode);
  if (dropCode === LT_CH) LTS.ch = null;
  if (dropCode === LT_CH2) LTS.ch2 = null;
  ltRender();
  setTimeout(() => ltScan(true), delay);
}
/* the room-list peer also takes a free watch-<n> id so hosts can tell this screen about rooms at once (none free → random id) */
function ltWatchPeer(i, done) {
  const p = LTS.peer = i < LT_WATCH ? new Peer(ltWatchId(i), ltPeerOpts()) : new Peer(ltPeerOpts());
  let ok = false;
  p.on("open", () => { if (LTS.peer !== p) return; ok = true; done(p); });
  p.on("error", e => {
    if (LTS.peer !== p) return;
    if (e.type === "peer-unavailable") {  // an empty lobby / watch slot ("Could not connect to peer <id>")
      const id = (/peer (\S+)\s*$/.exec(e.message || "") || [])[1];
      if (id && LTS.unavail) LTS.unavail(id);
      return;
    }
    if (!ok && e.type === "unavailable-id") { p.destroy(); return ltWatchPeer(i + 1, done); }  // taken by another screen
    if (!ok) { ltScanPeerDrop(); done(null); }
  });
  p.on("connection", c => c.on("data", ltWatchGot));
}
function ltWatchGot(m) {
  if (!m || !m.code) return;
  if (m.code === LT_CH || m.code === LT_CH2) {  // OPEN CHANNEL came alive / emptied — a card slower than the 'gone' after it is dropped (test 2026-11-17)
    const k = m.code === LT_CH ? "ch" : "ch2";
    if ((m.at || 0) < (LTS[k + "At"] || 0)) return;
    LTS[k + "At"] = m.at || 0; LTS[k] = m.t === "room" ? m : null; LTS.done = nowText(); return ltRender();
  }
  const rooms = (LTS.rooms || []).filter(r => r.code !== m.code);
  if (m.t === "room") rooms.push(m);
  else if (m.t !== "gone") return;
  LTS.rooms = rooms; LTS.done = nowText(); ltRender();
}
function ltScanPeerDrop() { const p = LTS.peer; LTS.peer = null; if (p) try { p.destroy(); } catch (e) {} }
/* OPEN CHANNEL row: always first, above the paged rooms (user request 2026-11-17 — looks always open) */
function ltRenderCh() {
  const conf = ltChConf(), row = $("ltChRow");
  row.hidden = !conf;
  if (!conf) return row.innerHTML = "";
  // one line only (user request 2026-11-17: the description / '늘 열려 있음' text pushed 입장 down)
  // always on air (user request 2026-11-19: shown playing whether anyone is in or not) — the count only while someone is
  row.innerHTML = [false, true].map(fast => {
    const here = LT.chOn && !!LT.role && LT.chFast === fast, name = ltChName(fast);
    const info = here ? {n: LT.members.length || 1, song: SHELL.now ? SHELL.now.title || "" : ""} : LTS[fast ? "ch2" : "ch"];
    const n = info ? info.n || 1 : 0;
    return `<div class="ltroom ltch on${fast ? " ltch2" : ""}${here ? " here" : ""}" title="${esc(name)}${fast ? " · 2배속" : ""}${n && info.song ? " · ♪ " + esc(info.song) : ""}">
    <span class="who"><span class="ltchdot"></span><span class="ltchname">${esc(name)}</span></span>
    <span class="meta">${n ? `${n}명 듣는 중` : "재생 중"}</span>
    ${here ? `<span class="here">지금 있는 채널</span>` : `<button class="primary" data-ch="${fast ? 2 : 1}">${LT.role ? "채널로 옮기기" : "입장"}</button>`}
  </div>`;
  }).join("");
}
$("ltChRow").addEventListener("click", e => { const b = e.target.closest("button[data-ch]"); if (b) b.dataset.ch === "2" ? ltChFastEnter() : ltChJoin(); });
function ltRenderRooms() {
  ltRenderCh();
  const ul = $("ltRooms"), rooms = LTS.rooms;
  $("ltRefresh").disabled = LTS.busy;
  $("ltScanAt").textContent = LTS.busy ? "찾는 중…" : LTS.done ? `마지막 갱신 ${String(LTS.done).split(" ").pop()}` : "";  // time only — the row broke (user request 2026-11-15)
  // 'ltempty', not 'empty': the page's global .empty (main song list) is centred with a 60px top margin
  // user report: a failed look said "열린 방이 없습니다" — say what went wrong instead
  const note = LTS.busy ? "" : LTS.err ? `<li class="ltempty">${esc(LTS.err)}</li>`
    : LTS.miss ? `<li class="ltempty">방 ${LTS.miss}개에 연결하지 못했습니다 (네트워크 — 새로고침해 보세요)</li>` : "";
  // 5 rooms at a time, more → pages (user request 2026-11-15, like the requests)
  const per = ltRoomPage();
  const pages = Math.max(1, Math.ceil((rooms ? rooms.length : 0) / per));
  LTS.page = Math.min(LTS.page || 0, pages - 1);
  $("ltRoomPager").innerHTML =  // always shown (user request 2026-11-15) — one page: both arrows disabled
    `<button data-p="-1"${LTS.page ? "" : " disabled"}>‹</button>${LTS.page + 1} / ${pages}<button data-p="1"${LTS.page < pages - 1 ? "" : " disabled"}>›</button>`;
  if (!rooms || !rooms.length) { ul.innerHTML = !rooms || LTS.busy ? "" : note || `<li class="ltempty">${ltChConf() ? "다른 열린 방이 없습니다" : "열린 방이 없습니다"}</li>`; return; }  // while looking: the header says 찾는 중…
  const from = LTS.page * per;
  ul.innerHTML = note + rooms.slice(from, from + per).map((r, j) => {
    const i = from + j;
    const here = LT.role && r.code === LT.code;
    return `<li class="ltroom${here ? " here" : ""}">
      <span class="who">${ltLockSvg(r.open)} ${esc(ltRoomName(r))}</span>
      <span class="meta">${ltCrownSvg()} ${esc(r.name || "")} · ${(here && LT.members.length) || r.n || 1}명${r.song ? " · ♪ " + esc(r.song) : ""}</span>
      ${here ? `<span class="here">지금 있는 방</span>` : `<button data-i="${i}" class="${r.open ? "primary" : ""}">${LT.role ? "이 방으로 옮기기" : "참여"}</button>`}
    </li>`;
  }).join("");
}
/* rooms a page (user request 2026-11-15): 3 on the web (the panel got too long) · the phone page shows as many as fit */
const LT_ROOM_ROW = 52;  // a room row + its gap (css px) until a drawn row can be measured
function ltRoomPage() {
  const d = $("listenDlg");
  if (!document.body.classList.contains("m") || !d.open) return 3;
  const f = uiZoom();
  const body = d.querySelector(".dlg-body"), pager = $("ltRoomPager");
  const room = (body.getBoundingClientRect().bottom - $("ltRooms").getBoundingClientRect().top) / f - pager.offsetHeight - 24;
  const row = $("ltRooms").querySelector(".ltroom"), rowH = row ? row.offsetHeight + 6 : LT_ROOM_ROW;
  return Math.max(1, Math.floor(room / rowH));
}
addEventListener("resize", () => { if ($("listenDlg").open) ltRenderRooms(); });
$("ltRoomPager").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (!b) return; LTS.page = (LTS.page || 0) + +b.dataset.p; ltRenderRooms(); });
const ltRoomName = r => r.title || `${r.name || "이름 없음"}님의 방`;  // older players send no title
$("ltRooms").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const r = LTS.rooms && LTS.rooms[+b.dataset.i]; if (!r) return;
  if (r.open) return ltJoin(r.code);
  if (ltNeedName()) return;
  LT.ask = r.code; LT.status = ""; ltRender(); $("ltPwIn").focus();  // secret room: password first
});
/* song data loaded (local_files.js library): the OPEN CHANNEL setting is known now → show it and ask the channel */
function ltChReady() { ltRender(); if (ltChConf()) ltScan(true); }
$("ltRefresh").onclick = () => { LTS.retry = 0; ltScan(); };
/* phone: pull the 같이듣기 page down from its top and let go = 새로고침 (user request 2026-11-16, like SNS apps) —
   only the room list follows the finger (user request 2026-11-16), with resistance; a round arrow turns with it above
   the list, past the line it spins until the look ends */
(() => {
  const d = $("listenDlg"), body = d.querySelector(".dlg-body"), list = $("ltRooms");
  const box = document.createElement("div"), ind = document.createElement("div");
  box.className = "ltptr"; ind.className = "ltptr-i";
  ind.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/></svg>`;
  box.append(ind); list.before(box);
  const MAX = 120, GO = 70, REST = 56, SIZE = 36;  // css px: furthest pull · let go past this = refresh · held here while looking
  const slow = matchMedia("(prefers-reduced-motion:reduce)");
  let s = null, busy = false;
  const draw = (y, ms = 0) => {
    const tr = ms && !slow.matches ? `transform ${ms}ms cubic-bezier(.2,.7,.3,1),opacity ${ms}ms` : "none";
    list.style.transition = ind.style.transition = tr;
    list.style.transform = y ? `translateY(${y}px)` : "";
    const k = Math.min(1, y / GO);
    ind.style.opacity = busy ? 1 : k;
    ind.style.transform = `translateY(${Math.min(y, REST) - SIZE - 6}px) scale(${busy ? 1 : .6 + .4 * k})${busy ? "" : ` rotate(${y * 3}deg)`}`;
    ind.classList.toggle("go", busy || y >= GO);
  };
  const done = () => { draw(0, 260); setTimeout(() => { if (!busy) ind.classList.remove("spin"); }, 280); };  // spins on while it slides away
  body.addEventListener("touchstart", e => {
    s = null;
    if (!document.body.classList.contains("m") || busy || e.touches.length !== 1 || body.scrollTop > 0) return;
    if (e.target.closest("input,textarea,select")) return;
    box.style.top = list.offsetTop + "px";
    s = {x: e.touches[0].clientX, y: e.touches[0].clientY, pull: 0, on: false};
  }, {passive: true});
  body.addEventListener("touchmove", e => {
    if (!s) return;
    const z = uiZoom(), dx = (e.touches[0].clientX - s.x) / z, dy = (e.touches[0].clientY - s.y) / z;
    if (!s.on) {
      if (dy < 8) { if (dy < -4 || Math.abs(dx) > 8) s = null; return; }  // scrolling up or a side swipe: not mine
      if (Math.abs(dx) > dy || body.scrollTop > 0) { s = null; return; }
      s.on = true; s.y += 8 * z;  // starts from here, no jump
    }
    e.preventDefault();  // the page itself must not scroll / bounce meanwhile
    const p = Math.max(0, (e.touches[0].clientY - s.y) / z);
    s.pull = MAX * (1 - Math.exp(-p / MAX));  // gives less the further it goes
    draw(s.pull);
  }, {passive: false});
  const end = async () => {
    const t = s; s = null;
    if (!t || !t.on) return;
    if (t.pull < GO) return done();
    busy = true; ind.classList.add("spin");
    draw(REST, 200);
    LTS.retry = 0;
    await Promise.all([ltScan(), new Promise(r => setTimeout(r, 500))]);  // a fast answer still shows the spin a moment
    busy = false; done();
  };
  body.addEventListener("touchend", end);
  body.addEventListener("touchcancel", end);
})();

/* ---------- 화면 ---------- */
const ltChHint = () => LT.chFast ? "인기곡이 2배속으로 무작위로 계속 재생됩니다." : "인기곡이 무작위로 계속 재생됩니다.";
function ltRender() {
  if (audio.applyRate) audio.applyRate();  // OPEN CHANNEL 2x!!: in → 2×, out → my own speed
  const b = $("btnListen"), n = LT.members.length, rooms = LTS.rooms ? LTS.rooms.length : 0, ch = !!ltChConf();
  const chLive = ch;  // OPEN CHANNEL always looks on air, listeners or not (user request 2026-11-19)
  b.classList.toggle("on", !!LT.role);
  b.classList.toggle("live", rooms > 0 || chLive);  // a room is open → a moving wave on the button (user request 2026-11-15)
  b.classList.toggle("reqwait", LT.role === "host" && LT.reqs.some(r => r.state === "wait"));  // blinks (also the phone menu's 같이듣기)
  // open rooms = a small count badge on the icon (user request 2026-11-15: icon + name like the phone menu); the tooltip says it in full
  // OPEN CHANNEL counts as an open room always; when it is the only one the badge says ONAIR (user request 2026-11-17 — was OPEN)
  const all = rooms + (ch ? 2 : 0);  // both channels
  const cnt = [ch ? "OPEN CHANNEL · 2x!!" : "", rooms ? `방 ${rooms}개` : "", LT.role ? `${LT.chOn ? "채널" : "내 방"} ${n || 1}명` : ""].filter(Boolean).join(" · ");
  $("ltBadge").hidden = !all;
  $("ltBadge").classList.toggle("open", ch && !rooms);
  $("ltBadge").textContent = ch && !rooms ? "ONAIR" : all > 99 ? "99+" : all;
  b.title = "같이듣기 — 방을 만들면 나오는 번호를 넣은 사람과 같은 곡을 같은 위치로 같이 들음" + (cnt ? ` (${cnt})` : "");
  $("ltIdle").hidden = !!LT.role;
  $("ltRoom").hidden = !LT.role;
  $("ltStatus").textContent = LT.status;
  $("ltStatus").hidden = !LT.status;
  $("ltLeave").hidden = !LT.role;
  $("ltLock").innerHTML = ltLockSvg(!LT.lock);
  document.querySelector("#listenDlg .ltfield").hidden = true;  // no nickname field any more — the start nickname (2026-11-17)
  $("ltLock").title = LT.lock ? "비밀방 (누르면 공개방)" : "공개방 (누르면 비밀방)";
  $("ltNewPw").hidden = !LT.lock;
  $("ltTitle").placeholder = `${ltName() || "이름없음"}님의 방`;  // empty title → this name
  $("ltPwAsk").hidden = !LT.ask;
  if (LT.ask) {
    const r = (LTS.rooms || []).find(r => r.code === LT.ask);
    $("ltPwFor").textContent = r ? ltRoomName(r) : "비밀방";
  }
  // guest: only volume and leaving — the play controls look disabled
  const guest = LT.role === "guest" || LT.chOn && !!LT.role;  // OPEN CHANNEL: nobody controls playback
  for (const id of ["btnPlay", "btnPrev", "btnNext", "seek", "btnPlayView", "btnShuffle", "btnRepeat"]) $(id).disabled = guest;
  // 싱크: off for room guests only — in OPEN CHANNEL it asks to leave first (lyrics_view.js, user request 2026-11-20)
  $("btnEdit").disabled = LT.role === "guest" && !LT.chOn || !(song && song.groups.length);
  document.body.classList.toggle("lt-guest", guest);
  document.body.classList.toggle("lt-ch", LT.chOn && !!LT.role);  // OPEN CHANNEL: every play button but volume · seek bar gets a slash (player_screen.css)
  ltRenderRooms();
  // web: the room card only while the 같이듣기 panel is folded (user request 2026-11-15 — the panel shows the room itself)
  /* web (user request 2026-11-15): in a room, folding keeps the room card itself in place (only 방 만들기 · 열린 방 and the
     panel's border fold away) — so the small playlist card is the phone's only */
  const web = !document.body.classList.contains("m"), d = $("listenDlg");
  if (web && LT.role && !ltRender.wasIn) d.classList.add("fold");  // just entered a room (joined or made one): fold to the room card (user request 2026-11-15)
  ltRender.wasIn = !!LT.role;
  if (web && LT.role && !d.open) { d.classList.add("fold"); d.show(); }  // joined while folded (e.g. by a link)
  if (web && !LT.role && d.classList.contains("fold")) { d.classList.remove("fold"); d.close(); }  // left: nothing to keep
  $("ltCard").hidden = !LT.role || web;
  b.classList.toggle("open", web && d.open && !d.classList.contains("fold"));  // unfolded: the button looks selected (user request 2026-11-15)
  if (typeof renderPlFilter === "function") renderPlFilter();  // guest: the playlist's filter = the host's
  $("ltCard").classList.toggle("ltch2", LT.chOn && LT.chFast);  // 2x!!: red (player_screen.css)
  $("ltRoom").classList.toggle("ltch2", LT.chOn && LT.chFast);
  if (!LT.role) return;
  const hostName = LT.members[0] || (LT.role === "host" ? LT.me : "");
  const title = LT.chOn ? ltChName(LT.chFast) : LT.title || (hostName ? `${hostName}님의 방` : "");
  // the room above the playlist (user request 2026-11-15): title · how many (no names) · guest hint — click = this window
  $("ltCard").innerHTML = `<div class="lcr">${LT.chOn ? '<span class="ltchdot"></span>' : ltLockSvg(LT.open)}<b class="tt">${esc(title)}</b><span class="n">${LT.chOn ? "" : "참여자 "}${(LT.members.length || 1)}명${LT.chOn ? " 듣는 중" : ""}</span>`
    + `</div>`
    + (LT.chOn ? `<div class="lch">${ltChHint()}</div>`  /* same words in 간단 · 기본 (user request 2026-11-19) */ : LT.role === "guest" ? `<div class="lch">곡 재생 제어는 방장만 가능합니다.</div>` : "");
  if (LT.chOn) $("ltRoomTitle").innerHTML = `<span class="ltchdot"></span><span class="tt ltchname">${ltChName(LT.chFast)}</span>${LT.title ? `<span class="ltchsub">${esc(LT.title)}</span>` : ""}`;
  else if (!LT.titleEdit) $("ltRoomTitle").innerHTML = `${ltLockSvg(LT.open)}<span class="tt">${esc(title)}</span>${
    LT.role === "host" ? `<button type="button" class="ltpen" title="방 제목 바꾸기">${ltPenSvg()}</button>` : ""}`;  // user request: lock always before the title, big and centred · host: ✏ renames
  // user request 2026-11-17: short, two lines
  // one wording for 간단 and 기본 mode (user request 2026-11-19)
  if (LT.chOn) $("ltRoomHint").textContent = ltChHint();
  else $("ltRoomHint").textContent = "곡 재생 제어는 방장만 가능합니다.";
  $("ltRoomHint").hidden = LT.role === "host" && !LT.chOn;
  const mem = LT.members.length ? LT.members : [hostName];
  // channel: how many are listening + their name chips (user request 2026-11-19 — was count only), no crown (nobody leads)
  document.querySelector("#ltRoom .ltmemhead").firstChild.textContent = LT.chOn ? "" : "참여자 ";
  $("ltMemCount").textContent = LT.chOn ? `${mem.length}명 듣는 중` : `${mem.length}명`;
  // 대표색상 (user request 2026-11-17): chip see-through in that person's color — the channel too (2026-11-19)
  $("ltMembers").innerHTML = mem.map((m, i) => {
    const k = ltKey(ltNick(m)), c = okColor((LT.colors || {})[k] || (k === ltKey(LT.me) ? ltMyColor() : ""));
    return `<li class="${k === ltKey(LT.me) ? "me" : ""}${c ? " mc" : ""}"${c ? ` style="--mc:${c}"` : ""}>${i === 0 && !LT.chOn ? ltCrownSvg() : ""}${esc(ltNick(m) || "익명")}</li>`;
  }).join("");
  // 방장의 재생목록 필터 (user request 2026-11-15) — host: mine · guest: what the host sent
  const plf = LT.role === "host" && !LT.chOn ? PLF : LT.hostPlf;
  // user request 2026-11-15: no filter → just '필터 없음' · a filter → the header with a thin 필터 저장하기 at its right end
  // channel (user request 2026-11-17): its filter stays private — only an 'OPEN CHANNEL' tag, nothing to save
  $("ltPlf").innerHTML = LT.chOn ? `<div class="ltplfhead"><span>현재 재생중인 목록의 필터</span></div>${ltChTag()}`
    : plf && filterOf(plf).groups.length
    ? `<div class="ltplfhead"><span>현재 재생중인 목록의 필터</span><button type="button" class="ltsmall ltplfsave" title="이 필터를 저장된 필터에 넣음 (곡 검색 › 저장된 필터)">필터 저장하기</button></div>` + plfHtml(plf)
    : '<div class="ltplfnone">필터 없음</div>';
  $("ltLeave").textContent = LT.role === "host" && !LT.chOn ? "방 닫기" : "나가기";
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
const LT_REQ_PAGE = 3;  // 3 at a time, more → pages (user request 2026-11-15: the panel got too long — was 5)
function ltRenderReqs() {
  if (!LT.role) return;
  const host = LT.role === "host", n = LT.reqs.length, pages = Math.max(1, Math.ceil(n / LT_REQ_PAGE));
  $("btnListen").classList.toggle("reqwait", host && LT.reqs.some(r => r.state === "wait"));  // accepted / refused → stops blinking
  LT.reqPage = Math.min(LT.reqPage || 0, pages - 1);
  $("ltReqQ").hidden = host && !LT.chOn;  // user request: the host has no request search (adds to the queue directly) — the channel: everyone requests
  const left = LT.chOn ? ltCoolLeft(LT.uid) : 0;  // channel: my request cooldown
  // cooldown (user request 2026-11-17): the search stays usable — a small note above it from the moment I requested
  ltCoolNote(!!left);
  const shown = LT.reqs.slice(LT.reqPage * LT_REQ_PAGE, (LT.reqPage + 1) * LT_REQ_PAGE);
  $("ltReqs").innerHTML = n ? shown.map(r => `<li data-id="${esc(r.id)}">
      <span class="t">${esc(r.title)}${r.artist ? ` <span class="a">${esc(shortName(r.artist))}</span>` : ""}</span>
      ${LT.chOn ? "" : `<span class="by">${esc(r.by)}</span>`}
      <span class="st ${r.state}">${LT_REQ_STATE[r.state] || r.state}</span>
      ${host && r.state === "wait" ? `<button class="primary ok blink">수락</button><button class="no">거절</button>` : ""}
    </li>`).join("") : host && !LT.chOn ? `<li class="ltempty">신청곡이 없습니다</li>` : "";  // guest: nothing (search box below) · host: no search, so say it
  $("ltReqPager").innerHTML = pages > 1
    ? `<button data-p="-1"${LT.reqPage ? "" : " disabled"}>‹</button>${LT.reqPage + 1} / ${pages}<button data-p="1"${LT.reqPage < pages - 1 ? "" : " disabled"}>›</button>` : "";
  if ($("ltReqPop") && $("ltReqPop").matches(":popover-open")) ltRenderPop();
}
/* a request while cooling down: the note shakes (user request 2026-11-17) */
function ltCoolShake() {
  const n = $("ltReqCool"); if (!n || n.hidden) return;
  n.classList.remove("shake"); void n.offsetWidth; n.classList.add("shake");  // restart the animation on every try
}
/* '<n>곡 뒤에 신청할 수 있습니다' — small, under the request search (channel cooldown) */
function ltCoolNote(on) {
  let n = $("ltReqCool");
  // above the box (user report 2026-11-17: under it the song list covered it)
  if (!n) { n = document.createElement("div"); n.id = "ltReqCool"; n.className = "ltcool"; $("ltReqQ").before(n); }
  const left = LT.chOn ? ltCoolLeft(LT.uid) : 0;
  n.hidden = !(on && left);
  if (left) n.textContent = `${left}곡 뒤에 신청할 수 있습니다`;
}
$("ltReqPager").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (!b) return; LT.reqPage += +b.dataset.p; ltRenderReqs(); });

/* search (user request 2026-11-14 — the player has no full song list any more, so no 보컬·프로듀서 groups): the songs this
   player knows that match, at once, then matches from our whole DB (after a short pause in typing). Choosing a
   song requests it. */
let ltHl = 0, ltOpt = null, ltSeq = 0, ltTimer = 0;  // ltOpt: {label, songs, busy} of the current search, or null
const ltPool = () => allItems().filter(canPlay);
function ltSearch() {
  const raw = $("ltReqQ").value.trim(), seq = ++ltSeq;
  clearTimeout(ltTimer);
  if (!raw) { ltOpt = null; return ltRenderPop(); }
  const local = ltPool().filter(it => FKIND.text[1](it, fold(raw))).slice(0, 30);
  ltOpt = {grp: "검색", label: `"${raw}"`, songs: local, busy: ONLINE};
  ltRenderPop();
  if (!ONLINE) return;
  ltTimer = setTimeout(() => findSongs(raw, local).then(s => {
    if (seq !== ltSeq) return;
    ltOpt = {...ltOpt, songs: s.filter(canPlay), busy: false};
    ltRenderPop();
  }), 400);
}
const ltOpts = () => ltOpt ? ltOpt.songs.map(it => ({it})) : [];
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
      const o = e.target.closest(".fdd-opt"); if (!o) return;
      ltChoose(ltOpts()[+o.dataset.i]);
    };
  }
  ltHl = Math.max(0, Math.min(ltHl, os.length - 1));
  const list = p.querySelector(".fdd-list");
  if (ltOpt) {  // 2nd step: the songs of the chosen option
    list.innerHTML = `<div class="fdd-grp">${esc(ltOpt.grp)} · ${esc(ltOpt.label)} <span class="n">${os.length}</span></div>`
      + (ltOpt.busy ? '<div class="fdd-none">우리 DB 에서 찾는 중…</div>' : os.length ? "" : '<div class="fdd-none">맞는 곡이 없습니다</div>')
      + os.map((o, i) => {
        const r = LT.reqs.find(r => r.key === keyOf(o.it));
        return `<div class="fdd-opt${i === ltHl ? " hl" : ""}" data-i="${i}"><span class="t">${verChipHtml(o.it)}${titleHtml(o.it)} <span class="a">${esc(shortName(o.it.artist || ""))}</span></span>${
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
function ltChoose(o) { if (o && o.it) ltRequest(o.it); }
function ltRequest(it) {
  if (!LT.role || !it) return;
  LOCAL.remember(it);  // a VocaDB result: lyrics · reports find it by name
  if (LT.reqs.some(r => r.key === keyOf(it))) return;
  if (LT.chOn && ltCoolLeft(LT.uid)) { ltCoolNote(true); return ltCoolShake(); }  // channel: still cooling down — the note above the box shakes
  LT.reqPage = 9999;  // show the page with the newest one (clamped in render)
  if (LT.role === "host") ltHostRequest(it);
  else if (LT.host) ltSend(LT.host, {t: "req", key: keyOf(it), item: ltStrip(it)});  // the host's list comes right back
  ltRenderReqs();  // the songs stay open (user request: the box doesn't close on its own) — the request shows as 요청중 there
}
/* 우클릭 '신청곡으로' (user request 2026-11-18: playlist / offline rows, only while in a room or OPEN CHANNEL) — the 같이듣기
   window opens so the request (or the cooldown note) shows */
function ltRequestFromMenu(it) {
  ltOpenDlg();
  ltRequest(it);
}
$("ltReqQ").addEventListener("input", () => { ltHl = 0; ltSearch(); });
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
    if (p && p.matches(":popover-open")) { e.preventDefault(); e.stopPropagation(); p.hidePopover(); }
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
/* web (user request 2026-11-15): the 같이듣기 window opens in place under the 같이듣기 · 검색 · 노래방 row, not as a popup —
   the 같이듣기 button opens / closes it. The phone keeps its page (mobile_view.js). */
{
  const d = $("listenDlg"), phoneOrModal = d.showModal.bind(d);
  d.showModal = () => { d.classList.remove("fold"); return document.body.classList.contains("m") ? phoneOrModal() : d.open || d.show(); };
}
new MutationObserver(() => ltRender()).observe($("listenDlg"), {attributes: true, attributeFilter: ["open"]});  // fold / unfold → the room card
function ltOpenDlg() {
  if (!$("listenDlg").open) $("listenDlg").showModal();
  ltRender();
}
$("btnListen").onclick = () => {
  const d = $("listenDlg");
  if (!document.body.classList.contains("m") && d.open) {  // web: the button folds it again
    if (!LT.role) return d.close();
    d.classList.toggle("fold"); return ltRender();  // in a room: fold to the room card / unfold
  }
  ltOpenFresh();
};
function ltOpenFresh() {
  if (!LT.role) {  // user request 2026-11-16: the nickname field starts with the last name used (was: always empty)
    $("ltName").value = store.get("reportWho", ""); $("ltNameErr").hidden = true; $("ltName").closest(".ltfield").classList.remove("need");
  }
  ltOpenDlg();
  if (!LT.role) $("ltTitle").focus();
}
$("ltLock").onclick = () => { LT.lock = !LT.lock; ltRender(); if (LT.lock) $("ltNewPw").focus(); };
nameField($("ltName"));
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
/* 필터 저장하기 (user request 2026-11-15): the room's playlist filter → 저장된 필터 (the same list the search window saves to) */
$("ltPlf").addEventListener("click", async e => {
  if (!e.target.closest(".ltplfsave") || LT.chOn) return;  // the channel's filter can't be saved
  const plf = LT.role === "host" ? PLF : LT.hostPlf;
  const pf = filterOf(plf), groups = pf.groups.filter(g => g.c && g.c.length).map(({x, c}) => ({x, c}));
  if (!groups.length) return;
  const name = await uiPrompt("저장할 필터 이름", fSummary(groups).slice(0, 40), "필터 이름");
  if (!name) return;
  // with the room filter's sort and range when it has them (user request 2026-11-22)
  store.set("f.saved", [...store.get("f.saved", []).filter(f => f.name !== name), {name, groups, ...(pf.sort ? {sort: pf.sort, from: pf.from, n: pf.n} : {})}]);  // 같은 이름이면 덮어씀
  LT.status = `필터 '${name}' 을(를) 저장했습니다.`; ltRender();
});
function ltLeaveBtn(keepSong) { const code = LT.role === "host" && !(LT.chOn && LT.conns.size) ? LT.code : ""; $("ltName").value = store.get("reportWho", ""); ltLeave(false, keepSong); ltRescan(code, 800); }  // back to the last name used
$("ltLeave").onclick = () => ltLeaveBtn(false);
$("ltClose").onclick = () => $("listenDlg").close();
$("ltCard").addEventListener("click", async e => {
  ltOpenFresh();  // opens, never folds
});
$("ltCard").addEventListener("keydown", e => { if (e.key === "Enter") ltOpenFresh(); });

/* 바로 들어오는 링크 (#lt=<번호>): 시작 창(토큰)·불러오기가 끝난 뒤 같이듣기 창을 열고 들어감 */
function ltFromLink() {
  const m = /^#lt=(\d{6})$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, "", location.href.split("#")[0]);  // reload doesn't join again
  const code = m[1];
  const go = () => {
    if (document.querySelector("dialog.offdlg[open]") || !VDB.idx) return setTimeout(go, 500);  // until the song list opened
    ltOpenDlg();
    if (ltNeedName()) return;
    ltJoin(code);
  };
  setTimeout(go, 800);
}
addEventListener("hashchange", ltFromLink);
ltFromLink();

/* 새 버전 새로고침 (user request 2026-11-17): the room must not break — the host tells guests "reload" (not "bye") and,
   back on the page, opens the same code again; a guest joins the same room again (same uid → not a duplicate name);
   the channel just rejoins (someone else holds it meanwhile). Listeners may drop out for a moment (user: fine).
   version_check.js calls ltBeforeReload; kept in sessionStorage (same tab only) for 2 min. */
const LT_RESUME_KEY = "lt.resume";
function ltBeforeReload() {
  if (!LT.role) return;
  LT.reloading = true;
  // the host keeps the requests too (user request 2026-11-17) — the queued ones come back with the queue (qSaveForReload)
  try { sessionStorage.setItem(LT_RESUME_KEY, JSON.stringify({role: LT.role, code: LT.code, me: LT.me, pw: LT.pw, open: LT.open, title: LT.title, ch: LT.chOn, fast: LT.chFast, uid: LT.uid,
    reqs: LT.role === "host" && !LT.chOn ? LT.reqs : [], cool: LT.chOn ? {} : LT.cool, at: Date.now()})); } catch (e) {}
}
function ltResume() {
  let r = null;
  try { r = JSON.parse(sessionStorage.getItem(LT_RESUME_KEY) || "null"); sessionStorage.removeItem(LT_RESUME_KEY); } catch (e) {}
  if (!r || !r.code || Date.now() - r.at > 120000) return;
  LT.uid = r.uid || LT.uid;
  const go = async () => {
    if (document.querySelector("dialog.offdlg[open]") || !VDB.idx) return setTimeout(go, 500);  // until the song list opened
    if (LT.role) return;  // already in a room some other way
    if (r.ch) return ltChJoin(!!r.fast);  // checked when first entered
    LT.me = r.me || ltName(); LT.pw = r.pw || ""; LT.open = r.open !== false; LT.title = r.title || ""; LT.resumeTry = 6;
    LT.status = r.role === "host" ? "방을 다시 여는 중…" : "방에 다시 들어가는 중…"; ltRender();
    try { await ltLoadPeerJs(); } catch (e) { LT.resumeTry = 0; LT.status = e.message; return ltRender(); }
    if (r.role === "host") { LT.reqs = r.reqs || []; LT.cool = r.cool || {}; ltHostPeer(r.code, -1); } else ltGuestPeer(r.code);
  };
  setTimeout(go, 300);
}
ltResume();
ltRender();
setTimeout(ltScan, 1500);
