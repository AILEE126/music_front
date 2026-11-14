/* 재생 대기열 — 플레이어 재생기(play_engine.js makePlayer)가 씀
   queue = 재생목록 (플레이어 왼쪽 칸 — 곡 검색에서 넣음) · upcoming = 앞으로 틀 순서 (무작위면 미리 섞어 둠 — 한 바퀴 동안 겹치지 않음)
   pinned = 우클릭 '대기열에 추가'로 넣은 곡 (upcoming 보다 먼저) · history = 지난 곡 10곡 (⏮ 는 무작위여도 바로 전에 틀었던 곡으로, 더 앞은 지금 곡 처음으로)
   재생기(S)가 갖춰야 할 것: audio · now · load(it, autoplay, how) — load 는 곡을 바꾸기 전에 this.queueOnLoad(it, how) 를 부름
   고를 수 있는 것: S.canQueue(it) (재생 목록에 넣을 곡만) · S.onModes() (무작위·반복이 바뀌면) */
const QUEUE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h13M3 12h13M3 18h8"/><path d="m16 15 5 3-5 3z" fill="currentColor"/></svg>`;
function addPlayQueue(S) {
  const key = it => it.site + "/" + it.name;
  Object.assign(S, {
    queue: [], upcoming: [], pinned: [], history: [], qsubs: new Set(), subs: new Set(),
    shuffle: store.get("shuffle", false), repeat: store.get("repeat", "all"),
    /* how: next(대기열에서 다음) · prev(지난 곡) · pick(곡 하나만 고름) · ''(그 곡부터 순서를 새로) */
    queueOnLoad(it, how) {
      if (this.now && how !== "prev" && key(this.now) !== key(it)) this.history = [...this.history, this.now].slice(-10);
      if (!how) this.plan(it);
      else this.upcoming = this.upcoming.filter(x => key(x) !== key(it));  // 직접 넣은 곡·지난 곡을 틀면 이번 바퀴에서 또 나오지 않게
    },
    setQueue(list) { this.queue = this.canQueue ? list.filter(this.canQueue) : list.slice(); },
    /* 앞으로 틀 순서 다시 짜기: from 다음 곡부터 (순서대로) / from 을 뺀 나머지를 섞어서 (무작위) */
    plan(from) {
      const q = this.queue, k = from ? key(from) : "";
      if (this.shuffle) {
        const rest = q.filter(x => key(x) !== k);
        for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        this.upcoming = rest;
      } else this.upcoming = q.slice(q.findIndex(x => key(x) === k) + 1);
      this.qemit();
    },
    next(auto, how = "next") {
      let it = this.pinned.shift();
      if (!it) {
        if (!this.upcoming.length) {  // 한 바퀴 다 틀었음
          if (!this.queue.length || auto && this.repeat === "off") return this.qemit();
          this.plan(this.shuffle ? this.now : null);
          if (!this.upcoming.length) this.upcoming = this.queue.slice(0, 1);  // 곡이 하나뿐이면 그 곡을 다시
        }
        it = this.upcoming.shift();
      }
      this.load(it, true, how);
    },
    prev() {
      if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
      const it = this.history.pop();
      if (it) {
        if (this.now) this.upcoming.unshift(this.now);  // 다시 ⏭ 하면 지금 곡으로 돌아옴
        return this.load(it, true, "prev");
      }
      this.audio.currentTime = 0;  // 지난 곡이 없음 (10곡까지만 기억): 지금 곡을 처음부터
    },
    enqueue(it) { this.upcoming = this.upcoming.filter(x => key(x) !== key(it)); this.pinned.push(it); this.qemit(); },  // 다음 곡 목록에 있던 곡이면 거기선 뺌
    unqueue(list, i) { this[list].splice(i, 1); this.qemit(); },
    jump(list, i) { const [it] = this[list].splice(i, 1); if (it) this.load(it, true, "next"); },
    setShuffle(v) { this.shuffle = v; store.set("shuffle", v); this.plan(this.now); if (this.onModes) this.onModes(); this.emit(); },
    setRepeat(v) { this.repeat = v; store.set("repeat", v); if (this.onModes) this.onModes(); this.emit(); this.qemit(); },
    qsubscribe(fn) { this.qsubs.add(fn); return () => this.qsubs.delete(fn); },
    qemit() { this.qsubs.forEach(f => { try { f(); } catch (e) { this.qsubs.delete(f); } }); },
    /* 곡이 바뀌면 플레이어 화면에 알림 */
    subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
    emit() { this.subs.forEach(f => { try { f(this.now); } catch (e) { this.subs.delete(f); } }); },
  });
  queuePanel(S);
  return S;
}

/* 재생 대기열 창: 지난 곡 · 지금 · 직접 넣은 곡 · 다음 곡 — 눌러서 틀기, ✕ 로 빼기
   여는 단추는 S.queueBtns 에 넣어 둠 (열려 있으면 'on') — 서버 틀의 위 막대 단추, 플레이어 화면 단추 */
function queuePanel(S) {
  const QSHOW = 100, p = document.createElement("div");
  p.id = "qPanel"; p.className = "qp"; p.hidden = true;
  p.innerHTML = `<div class="qhead"><b>재생 대기열</b><span class="qmode"></span><button class="qclose" title="닫기">✕</button></div><div class="qbody"></div>`;
  document.body.appendChild(p);
  const body = p.querySelector(".qbody");
  const render = () => {
    if (p.hidden) return;
    p.querySelector(".qmode").textContent = `${S.shuffle ? "무작위" : "순서대로"} · ${{off: "반복 안 함", all: "전체 반복", one: "한 곡 반복"}[S.repeat]}`;
    const row = (it, list, i, cls = "") => `<div class="qi ${cls}" data-l="${list}" data-i="${i}" title="${esc(it.title)}${it.artist ? " — " + esc(shortName(it.artist)) : ""}">
      <span class="t">${esc(it.title)} <span class="a">${esc(shortName(it.artist || ""))}</span></span>
      ${list === "pinned" || list === "upcoming" ? `<button class="x" title="대기열에서 빼기">✕</button>` : ""}</div>`;
    const H = S.history.slice(-10), sec = t => `<div class="qsec">${t}</div>`, U = S.upcoming;
    let h = "";
    if (H.length) h += sec("지난 곡 (⏮ 로 돌아감)") + H.map((it, j) => row(it, "history", S.history.length - H.length + j, "old")).join("");
    if (S.now) h += sec("지금") + row(S.now, "now", 0, "cur");
    if (S.pinned.length) h += sec("직접 넣은 곡") + S.pinned.map((it, i) => row(it, "pinned", i)).join("");
    h += sec(`다음 곡 (${U.length}곡)`) + (U.length ? U.slice(0, QSHOW).map((it, i) => row(it, "upcoming", i)).join("")
      + (U.length > QSHOW ? `<div class="more">… 외 ${U.length - QSHOW}곡</div>` : "")
      : `<div class="more">${S.repeat === "off" ? "이 곡이 끝나면 멈춤" : "이 곡이 끝나면 처음부터 다시"}</div>`);
    body.innerHTML = h;
  };
  body.addEventListener("click", e => {
    const r = e.target.closest(".qi"); if (!r) return;
    const l = r.dataset.l, i = +r.dataset.i;
    if (e.target.closest(".x")) return S.unqueue(l, i);
    if (l === "history") { const [it] = S.history.splice(i, 1); if (S.now) S.upcoming.unshift(S.now); S.load(it, true, "prev"); }
    else if (l !== "now") S.jump(l, i);
  });
  const mark = () => S.queueBtns.forEach(b => { try { b.classList.toggle("on", !p.hidden); } catch (e) { S.queueBtns.delete(b); } });
  const close = () => { p.hidden = true; mark(); };
  p.querySelector(".qclose").onclick = close;
  document.addEventListener("click", e => { if (!p.hidden && !e.composedPath().includes(p)) close(); });
  S.qsubscribe(render);
  S.queueBtns = new Set();
  S.queueIcon = QUEUE_ICON;
  S.renderQueue = render;
  S.toggleQueue = () => { p.hidden = !p.hidden; mark(); render(); };
}
