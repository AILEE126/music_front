/* 리듬게임 (user request 2026-11-26: "우리 곡 싱크랑 영상 링크로 리듬게임 생성 — 서버 없이", "채보는 박자가 더 중요 · 엇박으로 시작되는
   첫 가사 같은 걸 채보로 표현", "난이도는 쉬움 어려움 매우어려움 >>매우매우어려움<<", "게임화면 진입하는 버튼 · 게임화면 구현 — 일단 보고
   판단"). The song plays as it always does (the same video · sound, audio.currentTime is the clock); the notes come from
   the chart the auto sync made with the sync (song.sync.chart — music_backend lyrics_auto_sync_engine.py make_chart:
   beats + the place of every sung syllable on a quarter of a beat + the tune where nobody sings). Nothing is asked of
   the server.

   After the first play (user 2026-11-26: "가사 없는 구간 노트 빈 게 많아서 난이도 불문하고 가사 노트 없는 구간에 멜로디 맞춰서 롱노트",
   "노트 끊김 현상", "난이도가 전체적으로 너무 낮은 감", "백그라운드에 영상이 깔렸으면 — 게임화면 말고 게임창 뒤로"):
   · every level was moved up one (the old 쉬움 is gone) and every level fills the stretches without singing: the tune's
     notes of the chart (`longs` — long ones are held to their end, a higher pitch = a key further right), and the beat
     itself where there is no tune either
   · the notes move by the game's own clock (gameClock): the relayed video reports its time in small jumps (±15 ms)
   · the video plays behind the window (#gameBack, video_box.js showVideo), whether or not the player's 영상 is on

   After the second play (user 2026-11-26: "패턴이 좀 일정하지 않은 것 같고 — 인터넷에 채보 만드는 가이드 찾아서 반영", "동시에 치는 건
   모든 난이도에 넣어도 됨, 횟수의 문제", "난이도 전체적으로 더 올려도 될 듯"). GAME_RULES — from the osu!mania mapping guide and
   ranking criteria (osu.ppy.sh/wiki Osu!mania_Mapping_Guide · Ranking_criteria/osu!mania):
   · lower sounds left, higher sounds right → the key follows the pitch the chart keeps for every sung note and tune note
   · the same sound gets the same pattern every time → no key is picked by where in the song a note is (it was a hash
     of the step: a chorus sung again came out different)
   · chords for emphasis (the start of a phrase, the strong beats), fewer the easier the level; the other hand takes the
     second key · the same key again only for the same sound, not in quick runs · a long note is at least a beat and
     nothing else is played in its stretch (they are only where nobody sings)
   Every level went up one more step (the old 쉬움, a note a beat, is gone).

   난이도 = how many of the chart's notes are played (the chart holds every syllable). Since the chart guide was applied
   (GAME_GUIDE below, user 2026-11-26 "반영해") a level is the level above with the least important notes taken out
   until its limits hold (GAME_FIT) — before: by the part of the beat a note fell on. The levels were then set further
   apart (user 2026-11-26: "매우매우어려움 난이도를 더 올려야 · 쉬움은 더 쉽게 · 난이도끼리 차이가 좀 더 많이 나게"):
   ジッタードール 382 · 624 · 824 · 1,110 notes (1.7 · 2.8 · 3.7 · 5.0 a second; before 481 · 623 · 770 · 946):
     쉬움              never closer than 3/4 beat · 2 notes in any 2 beats · a beat's rest after a line · one key,
                       two only on the hardest 3 % of the beats
     어려움            never closer than half a beat · 6 notes in any 5 beats · two keys on 18 % of the beats
     매우어려움        quarter beats · 7 notes in any 2 beats · two keys on 45 %, three on 6 %
     >>매우매우어려움<<  every syllable · two keys on 90 % of the beats, three on 40 %, all four on 6 %, two between the
                       beats where much comes in · more notes while a key is held
   all: every long note · from 어려움 up two keys on a line's first note and the beats the song hits while a key is
   held (the other hand) · the bare beat where nothing else is (beat · beat · half · half)
   A song without a chart (not made yet — 음원 관리 › 수집 › 자동 싱크 › 채보 만들기) plays its sync's line starts only, the same
   at every level; the start screen says so.
   Keys D F J K (lanes left to right) · touch: the lane under the finger · Space pauses · Esc closes. */
// names (user 2026-11-26: "EASY, MIDDLE?, HARD, SUPER HARD로" — the second one asked with a question mark: NORMAL, the
// usual word) — the comments here still say 쉬움 · 어려움 · 매우어려움 · >>매우매우어려움<< for the four, in this order
const GAME_LEVELS = ["EASY", "NORMAL", "HARD", "SUPER HARD"];
const GAME_CODES = ["KeyD", "KeyF", "KeyJ", "KeyK"];
/* 키 설정 (user request 2026-11-26: "키 설정하는 것도 넣어줘"): the four keys, left to right, kept per device (store
   game.keys = [[code, label] × 4]). Set from the bar: '키' → press four keys one after another (Esc = leave as it was).
   Not usable: Esc · Space · Enter (the game's own) and a key already taken. */
const gameKeys = () => { const k = store.get("game.keys", null); return Array.isArray(k) && k.length === 4 && k.every(x => Array.isArray(x) && x[0]) ? k : GAME_CODES.map(c => [c, c.slice(3)]); };
const gameKeyLabel = e => /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.key.length === 1 ? e.key.toUpperCase() : e.key.replace(/^Arrow/, "").slice(0, 5);
const gameLane = code => gameKeys().findIndex(k => k[0] === code);
function gameKeysShow() {
  const set = GAME.keyset;
  $("gameKeys").textContent = set ? `${set.length + 1}번째 키를 누르세요 (${set.map(k => k[1]).join(" ")}${set.length ? " " : ""}…)` : gameKeys().map(k => k[1]).join(" ");
  $("gameKeys").classList.toggle("on", !!set);
}
const GAME_WIN = [["PERFECT", 0.05], ["GREAT", 0.1], ["GOOD", 0.16]];  // name · seconds either way
const GAME_MISS = GAME_WIN[GAME_WIN.length - 1][1];
/* DJMAX 같은 느낌으로 디테일하게 (user request 2026-11-26: "판정에 몇 퍼센트 정확인지", "콤보도 판정 문구에 표시 — 끊기면 처음부터",
   "목숨 게이지 — 일정 이하 내려가면 실패, 설정에서 껐다 켜게", "곡마다 랭킹보드 — 닉네임은 현재 접속 중인 닉네임, 최대 5위, 점수 ·
   랭킹 · 정확도 · 콤보", "콤보 정보도 결과창에"):
   · every hit says how exact it was: 100 % within 0.02 s, down to 1 % at the edge of GOOD; FAST / SLOW beside it. The
     score of a note = 10 × its percent (+ the combo's bonus), 정확도 = the mean percent (a MISS = 0)
   · the combo is written under the judgement and starts again from 0 at a MISS
   · 게이지: starts full, a hit gives a little, a MISS takes GAME_LIFE.miss (more the higher the level); empty = FAILED
     (the game stops, nothing is ranked). 게이지 켬/끔 in the bar (store game.life) — off: no gauge, never failed
   · the result: 등급 (정확도) · 점수 · 정확도 · 최대 콤보 / 노트 수 · each judgement's count · FAST / SLOW · FULL COMBO /
     PERFECT PLAY · 신기록 (this device's best of the song and level, store game.best)
   · 랭킹: per song and level, the best run of each nickname (the start nickname, store reportWho), 5 places — file
     Server/data/game_rank/<VocaDB id>.json {levels: {"<level>": [{name, score, acc, max, notes, hit, miss, grade, fc, at}]}}
     written like the other shared files (LOCAL: a write token or the server PC's folder). A read-only token, no
     nickname, a song joined midway (같이듣기) or one without a chart: this device's best only. */
const GAME_GRADE = [[98, "SS"], [95, "S"], [90, "A"], [80, "B"], [70, "C"], [0, "D"]];  // 정확도 from → 등급
const GAME_LIFE = {got: [1.5, 1, 0.4], miss: [4, 5, 6, 7]};  // + by judgement · − a MISS by level (of 100)
const GAME_TOP = 5;
const gameLifeOn = () => store.get("game.life", true) !== false;
const gamePct = d => d <= 0.02 ? 100 : Math.max(1, Math.round(100 - (d - 0.02) / (GAME_MISS - 0.02) * 99));
const gameGrade = acc => GAME_GRADE.find(g => acc >= g[0])[1];
const gameWho = () => String(store.get("reportWho", "") || "").trim().slice(0, 40);
const gameNickKey = n => String(n || "").normalize("NFKC").trim().toLowerCase();
const gameSongKey = it => it ? String(it.vocadb || keyOf(it)) : "";
const GAME = {on: false, run: false, raf: 0, notes: [], lanes: [[], [], [], []], ptr: [0, 0, 0, 0], song: null, stat: null, flash: [0, 0, 0, 0],
              judged: {text: "", at: 0}, line: -1, beat: false, colors: null,
              hold: [null, null, null, null],  // the long note each key is holding
              touch: new Map(),                // pointer id → lane (a finger lifted lets its long note go)
              keyset: null,                    // 키 설정 중: the keys pressed so far
              fx: [],                          // judgements being shown on the line: {lane, at, k (GAME_WIN place, -1 = miss)}
              ct: null, cp: 0};                // the game's clock: song seconds at performance.now() cp

/* a chart step → seconds (the same sum as the server's chart_time) */
function gameStepTime(ch, step) {
  const bt = ch.beats, n = ch.steps, i = Math.floor(step / n), k = step - i * n;
  if (i < 0) return bt[0] + step * (bt[1] - bt[0]) / n;
  if (i >= bt.length - 1) return bt[bt.length - 1] + (step - (bt.length - 1) * n) * (bt[bt.length - 1] - bt[bt.length - 2]) / n;
  return bt[i] + k * (bt[i + 1] - bt[i]) / n;
}
/* the notes of a level → [{t, e (a long note's end, else t), lane, line, ok, fill, long}] in time order
   (offset: the song's 싱크 밀기 — the chart moves with the sync).
   GAME_GUIDE — the rules of music_backend docs/rhythm_chart_guide.md §10 (user 2026-11-26: "인터넷상 올라와있는 채보나 가이드나
   난이도조정 관련글 전부 다 읽어서 문서화해", then "반영해"):
   ① a lower level is the top level with notes taken out, the least important first (GAME_FIT — not "every n-th part of
     the beat" any more: a syncopated syllable stays when it is not close to another note) · ③ a bar's pitches low →
     high over the keys, few pitches in the middle keys; no more than 4 notes in a row with one hand; the two hands
     about even over the song · ④ a bar with the same rhythm and the same ups and downs = the same keys and the same
     notes taken out; its 3rd and 4th time left ↔ right · ⑤ keys at once: the size by how hard the beat is hit, a quiet
     beat one less, apart by the level's distance · ⑥ the same key again quickly only for the same pitch (twice) ·
     ⑨ a rest after a line at 쉬움 · ⑩ gameNotes' last pass places every note and moves / drops what breaks a limit
     (GAME.lint = what it did). */
const GAME_FIT = [                               // a level's limits: notes ≥ gap steps apart · ≤ max notes in any win steps ·
  {gap: 3, win: 8, max: 2, rest: 4},             // ≥ rest steps between two phrases (a step = a quarter beat)
  {gap: 2, win: 20, max: 6, rest: 2},
  {gap: 1, win: 8, max: 7, rest: 0},
  null];                                         // >>매우매우어려움<<: every note
const GAME_ANCHOR = [2, 4, 99, 99];              // the same key at most this many times in a row half a beat apart
function gameNotes(level) {
  const sj = song && song.sync, ch = sj && sj.chart, off = offset || 0;
  GAME.lint = null;
  if (!ch || !(ch.v >= 2) || !(ch.notes || []).length || (ch.beats || []).length < 2) {  // no chart: the sync's line starts
    const m = (sj && sj.matched) || [];
    return {beat: false, notes: (times || []).map((t, i) => ({t: t + off, e: t + off, lane: i % 4, line: i, ok: m[i] !== false, fill: false, long: false}))};
  }
  const S = ch.steps, mod = (a, b) => ((a % b) + b) % b;
  const fillEvery = [S, S, S / 2, S / 2][level];
  // keys at once — every level, how often is the level: a line's first note always; two keys on every `two`-th beat,
  // three on a line's first note and every `three`-th beat
  const two = [0, 4 * S, 2 * S, S][level], three = [0, 0, 0, 4 * S][level];
  /* the song's own feel (chart.feel — a digit a beat: lvl how loud, acc how hard the beat is hit; user 2026-11-26: "곡마다
     특색·컨셉을 살려야 함 — 가사와 멜로디의 특색도 그때그때"): keys at once go where the song hits hard — the hardest
     `share` of its beats (so a calm song gets them on its few accents, a driving one all through, and a verse and a
     chorus of one song differ) — and a silent beat is left empty. A chart without it: every `two`-th beat. */
  const feel = ch.feel && ch.feel.acc && ch.feel.lvl ? ch.feel : null, beatOf = st => Math.min(Math.max(Math.floor(st / S), 0), ch.beats.length - 1);
  const hard = share => {  // → the acc digit the hardest `share` of the beats reach
    if (!feel || !share) return 99;
    const a = [...feel.acc].map(Number).sort((x, y) => y - x);
    return Math.max(1, a[Math.min(a.length - 1, Math.floor(a.length * share))]);
  };
  // the levels further apart (user 2026-11-26: "매우매우어려움 난이도를 더 올려야 · 쉬움은 더 쉽게 · 난이도끼리 차이가 좀 더 많이
  // 나게"): 쉬움 fewer notes and keys at once only on the few hardest beats (not on every line's first note); the top
  // level keys at once on nearly every beat, three on four beats of ten, all four on the hardest, and two between the
  // beats where much comes in
  const acc2 = hard([0.03, 0.18, 0.45, 0.9][level]), acc3 = hard([0, 0, 0.06, 0.4][level]), acc4 = hard([0, 0, 0, 0.06][level]);
  const accOf = st => mod(st, S) === 0 ? +feel.acc[beatOf(st)] : -1, silent = st => !!feel && +feel.lvl[beatOf(st)] < 2;
  const lvlOf = st => feel ? +feel.lvl[beatOf(st)] : 9, movOf = st => feel && feel.mov ? +feel.mov[beatOf(st)] : 9;

  // 1. every note the chart holds = the top level: kind 1 a sung note · 2 the tune where nobody sings
  const all = [];
  for (const [st, line, ok, pitch, len] of ch.notes) all.push({st, len: len || 0, p: pitch || 0, kind: 1, line, ok: !!ok, fill: false});
  for (const [st, len, p] of ch.longs || []) all.push({st, len, p, kind: 2, line: -1, ok: true, fill: false});
  all.sort((x, y) => x.st - y.st);
  // phrases: a sung line · the tune notes that follow one another within 2 beats (a held sound, no pitch, is in none)
  const phr = new Map();
  let grp = 0, gEnd = -1e9;
  for (const n of all) {
    if (n.kind === 2) { if (n.st - gEnd > 2 * S) grp++; gEnd = n.st + n.len; n.g = "t" + grp; } else n.g = "l" + n.line;
    if (n.kind === 1 || n.p) { if (!phr.has(n.g)) phr.set(n.g, []); phr.get(n.g).push(n); }
  }
  /* 2. the keys and how much each note matters — by the bar (4 beats of a phrase; a whole line never came back note for
     note on ジッタードール, bars do), worked out once for a bar's shape (where its notes fall + whether each is higher /
     lower / the same as the one before) and used again every time the shape comes back.
     Keys: the bar's pitches from low to high over the four keys (not the walk of the melody, up = a key right: that
     drifted to one side on ジッタードール); the same key again: the same pitch twice (three times half a beat apart), then
     to and fro; another pitch within a beat one key on in the melody's direction. A sung note whose pitch was not
     found: by its place in the bar. The 5th note in a row of one hand (off the beat) goes to the other hand.
     Matters: a line's first syllable (always played) > a held one > on the beat (more the harder the beat is hit) >
     half beat > quarter; a line's last note, its highest and lowest a little more; a note in a silent beat less. */
  const seen = new Map(), bars = [];
  for (const ns of phr.values()) {
    ns[0].h = ns[0].kind === 1; ns[ns.length - 1].z = true;  // a line's first syllable · the phrase's last note
    for (const n of ns) { const b = Math.floor(n.st / (4 * S)); if (!bars.length || bars[bars.length - 1].b !== b || bars[bars.length - 1].g !== n.g) bars.push({b, g: n.g, ns: []}); bars[bars.length - 1].ns.push(n); }
  }
  for (const {b, ns} of bars) {
    const st0 = b * 4 * S;
    const fp = ns.map((n, i) => (n.st - st0) + (n.len ? "L" : "") + (n.h ? "H" : "") + (n.z ? "Z" : "") + (!i || !n.p || !ns[i - 1].p ? "?" : "-=+"[Math.sign(n.p - ns[i - 1].p) + 1])).join(",");
    let e = seen.get(fp);
    if (!e) {
      const ps = ns.filter(n => n.p).map(n => n.p), u = [...new Set(ps)].sort((a, b) => a - b), hi = u[u.length - 1], lo = u[0];
      // (fewer than four pitches: not always the same keys — every key gets its share)
      const few = [[[1], [2]][b % 2], [[1, 2], [0, 2], [1, 3], [0, 3]][b % 4], [[0, 1, 3], [0, 2, 3]][b % 2]][u.length - 1];
      const home = p => few ? few[u.indexOf(p)] : Math.min(3, Math.floor(u.indexOf(p) * 4 / u.length));
      let prev = -1, prev2 = -1, prevSt = -1e9, prevP = 0, run = 0, hand = 0;
      const lanes = ns.map(n => {
        const d = n.st - prevSt;
        let lane;
        if (n.p) {
          lane = home(n.p);
          if (lane === prev) {
            if (n.p === prevP) { if (d < S && run >= (d < 2 ? 2 : 3)) lane = prev2 >= 0 && Math.abs(prev2 - prev) === 1 ? prev2 : prev < 2 ? prev + 1 : prev - 1; }
            else if (prevP && (d < S || run >= 3)) lane = n.p > prevP ? (prev < 3 ? prev + 1 : 2) : prev > 0 ? prev - 1 : 1;
          }
        } else {
          const h = Math.imul(n.st - st0 + 1013, 2654435761) >>> 0;
          lane = (h >>> 16) % 4;
          if (lane === prev && d < S) lane = (lane + 1 + (h & 1)) % 4;  // not the same key twice within a beat
        }
        const same = prev >= 0 && d < S && (lane < 2) === (prev < 2);
        if (same && hand >= 4 && mod(n.st, S) !== 0) lane = lane < 2 ? 2 : 1;
        hand = prev >= 0 && d < S && (lane < 2) === (prev < 2) ? hand + 1 : 1;
        run = lane === prev ? run + 1 : 1;
        prev2 = prev; prev = lane; prevSt = n.st; prevP = n.p;
        return lane;
      });
      const score = ns.map((n, i) => (n.h ? 100 : 0) + (n.len ? 50 : 0)
        + (mod(n.st, S) === 0 ? 6 + (feel ? accOf(n.st) / 2 : 0) : mod(n.st, S / 2) === 0 ? 3 : 0)
        + (n.z ? 3 : 0) + (n.p && u.length > 2 && (n.p === hi || n.p === lo) ? 2 : 0) - (lvlOf(n.st) < 2 ? 3 : 0));
      seen.set(fp, e = {lanes, score, k: 0, inv: false, all: []});
    }
    const flip = mod(e.k++, 4) >= 2;  // the 3rd and 4th time: left ↔ right (the same pattern is not played over and over)
    ns.forEach((n, i) => { n.fp = e; n.lane0 = e.lanes[i]; n.flip = flip; n.score = e.score[i]; });
    e.all.push(ns);
  }
  // the two hands about even over the song: a shape that leans to the heavy hand is turned round, every time it comes
  const laneOf = n => n.flip !== n.fp.inv ? 3 - n.lane0 : n.lane0;
  const lean = e => { let v = 0; for (const ns of e.all) for (const n of ns) v += laneOf(n) < 2 ? 1 : -1; return v; };
  let bal = 0, tot = 0;
  for (const e of seen.values()) { bal += lean(e); for (const ns of e.all) tot += ns.length; }
  for (const e of [...seen.values()].sort((x, y) => Math.abs(lean(y)) - Math.abs(lean(x)))) {
    if (Math.abs(bal) <= tot * 0.08) break;
    const v = lean(e);
    if (v * bal > 0 && Math.abs(bal - 2 * v) < Math.abs(bal)) { e.inv = !e.inv; bal -= 2 * v; }
  }
  // 3. the level: from 쉬움 up, each level keeps the one below and takes in the notes that matter most and still fit
  // (a long note is played at every level)
  all.forEach((n, i) => { n.i = i; if (n.score == null) n.score = 50; });
  const on = Uint8Array.from(all, n => n.len ? 1 : 0), order = [...all].sort((x, y) => y.score - x.score || x.st - y.st);
  for (let lv = 0; lv <= level; lv++) {
    const C = GAME_FIT[lv];
    if (!C) { on.fill(1); break; }
    const fits = i => {
      const n = all[i], near = [n.st];
      let a = i - 1, b = i + 1;
      while (a >= 0 && !on[a]) a--;
      while (b < all.length && !on[b]) b++;
      if (a >= 0) { const d = n.st - all[a].st - all[a].len; if (d < C.gap || (all[a].g !== n.g && d < C.rest)) return false; }
      if (b < all.length) { const d = all[b].st - n.st - n.len; if (d < C.gap || (all[b].g !== n.g && d < C.rest)) return false; }
      for (let j = a; j >= 0 && n.st - all[j].st < C.win; j--) if (on[j]) near.unshift(all[j].st);
      for (let j = b; j < all.length && all[j].st - n.st < C.win; j++) if (on[j]) near.push(all[j].st);
      for (let j = 0; j + C.max < near.length; j++) if (near[j + C.max] - near[j] < C.win) return false;
      return true;
    };
    for (const n of order) if (!on[n.i] && fits(n.i)) on[n.i] = 1;
  }
  const kept = all.filter(n => on[n.i]);
  let ln = -1;  // the first note played of its line gets the line's two keys
  for (const n of kept) if (n.kind === 1) { n.head = n.line !== ln; ln = n.line; }
  if (kept.length) {  // the beat itself where there is nothing else (no note and no long note within a beat)
    const a = Math.max(0, kept[0].st - 16 * S), b = Math.min(kept[kept.length - 1].st + 8 * S, (ch.beats.length - 1) * S), fill = [];
    /* inside a long note too (user 2026-11-26: "롱노트 구간 안에 다른 키 겹쳐도 돼 — 그런 채보가 얼마나 많은데"): while a key is
       held, the beats the song hits (feel.acc ≥ 4 — a held noise has none, a held voice over the band has) are played
       with the other hand; not at 쉬움, not within a beat of the long note's start or end.
       Between the beats (the two upper levels) only where something comes in during the beat (feel.mov ≥ 4) — a note
       is a sound of the song (guide §10 ②). */
    let k = 0, head = -1e9, lend = -1e9;  // the last note's start · where the last long note ends
    for (let st = Math.ceil(a / fillEvery) * fillEvery; st <= b; st += fillEvery) {
      while (k < kept.length && kept[k].st <= st + S) { head = kept[k].st; if (kept[k].len) lend = Math.max(lend, kept[k].st + kept[k].len); k++; }
      if (head >= st - S || silent(st) || (mod(st, S) !== 0 && movOf(st) < 4)) continue;
      const over = st <= lend - S;
      if (over ? !(level >= 1 && feel && (mod(st, S) === 0 ? accOf(st) >= (level === 3 ? 3 : 4) : level === 3 && movOf(st) >= 6) && (level > 1 || mod(Math.floor(st / S), 2) === 0)) : lend >= st - S) continue;  // (어려움: every 2nd beat)
      fill.push({st, len: 0, p: 0, kind: 0, line: -1, ok: true, fill: true, head: false, over});
    }
    if (fill.length) { kept.push(...fill); kept.sort((x, y) => x.st - y.st); }
  }
  /* 4. every note onto its key, in time order — the last check (guide §10 ⑩). A key is not free for a note when it is
     held, has a note on that step, had one a quarter beat before (the top level: two in a row at most) or already has GAME_ANCHOR notes half a beat apart: the note goes to the nearest key that is free, a key of
     keys-at-once is left out instead.
     Keys at once: the other hand's mirror key, the third = the key beside the first — on a line's first note and on
     the beats the song hits hardest (acc2 · acc3), one key less on a quiet beat (lvl ≤ 5); 쉬움 not in the middle of a
     run, 어려움 a beat apart, 매우어려움 half a beat. The beat itself: a fixed round of the four keys; a held sound
     without a pitch: its own round; a note while a key is held: the other hand. */
  const BEAT_LANE = [0, 3, 1, 2], OFF_LANE = [2, 1, 3, 0], HELD_LANE = [1, 2, 0, 3];
  const notes = [], lint = {moved: 0, cut: 0, kept: 0, lanes: [0, 0, 0, 0]};
  const last = [0, 1, 2, 3].map(() => ({end: -1e9, a: 0, q: 0}));
  const bad = (l, st) => {
    const L = last[l], d = st - L.end;
    return d <= 0 || (d < 2 && (level < 3 || L.q >= 2)) || (d <= 2 && L.a >= GAME_ANCHOR[level]);
  };
  const put = (n, lane, t) => {
    const L = last[lane], d = n.st - L.end;
    L.a = d <= 2 ? L.a + 1 : 1; L.q = d < 2 ? L.q + 1 : 1; L.end = n.st + n.len;
    lint.lanes[lane]++;
    notes.push({t, e: n.len ? gameStepTime(ch, n.st + n.len) + off : t, lane, line: n.line, ok: n.ok, fill: n.fill, long: !!n.len});
  };
  let heldN = 0, prevSt = -1e9, prevEnd = -1e9, prevKind = -1, chordSt = -1e9;
  kept.forEach((n, i) => {
    let lane;
    if (n.fill) {
      const b = mod(Math.floor(n.st / S), 4);
      lane = mod(n.st, S) === 0 ? BEAT_LANE[b] : OFF_LANE[b];
    } else if (n.kind === 2 && !n.p) {
      if (n.st - prevEnd > 2 * S || prevKind !== 2) heldN = 0;  // each stretch starts the round again
      lane = HELD_LANE[heldN++ % 4];
    } else lane = laneOf(n);
    if (n.over) {  // during a long note: the other hand's two keys in turn
      const h = last.findIndex(L => L.end >= n.st);
      lane = (h >= 0 && h < 2 ? [2, 3] : [1, 0])[mod(Math.floor(n.st / S), 2)];
    }
    if (bad(lane, n.st)) {
      const free = [lane ^ 1, 3 - lane, 3 - (lane ^ 1)].find(l => !bad(l, n.st));
      if (free != null) { lane = free; lint.moved++; }
      else if (n.fill) { lint.cut++; return; }
      else lint.kept++;
    }
    const t = gameStepTime(ch, n.st) + off;
    put(n, lane, t);
    if (n.kind !== 2 && !n.len && !n.over) {
      const c3 = feel ? accOf(n.st) >= acc3 || (level === 3 && n.head) : three && (n.head || mod(n.st, three) === 0);
      const c2 = c3 || (n.head && level > 0) || (feel ? accOf(n.st) >= acc2 || (level === 3 && mod(n.st, S) === S / 2 && movOf(n.st) >= 7) : two && mod(n.st, two) === 0);
      let size = feel && accOf(n.st) >= acc4 ? 4 : c3 ? 3 : c2 ? 2 : 1;
      if (size > 1 && !n.head) {
        const next = i + 1 < kept.length ? kept[i + 1].st : 1e9;
        if (feel && lvlOf(n.st) <= 5) size--;
        if (level === 0 ? n.st - prevSt < S && next - n.st < S : level < 3 && n.st - chordSt < [S, S, S / 2][level]) size = 1;
      }
      if (size > 1) chordSt = n.st;
      for (const l of [3 - lane, lane ^ 1, 3 - (lane ^ 1)].slice(0, size - 1)) { if (bad(l, n.st)) lint.cut++; else put({st: n.st, len: 0, line: n.line, ok: n.ok, fill: n.fill}, l, t); }
    }
    prevSt = n.st; prevEnd = n.st + n.len; prevKind = n.kind;
  });
  lint.n = notes.length;
  GAME.lint = lint;
  return {beat: true, notes};
}
const gameLevel = () => Math.max(0, Math.min(3, +store.get("game.level", 1) || 0));
const gameSpeed = () => Math.max(0.6, Math.min(3, +store.get("game.speed", 1.4) || 1.4));  // seconds a note is on screen before its line
const gameLag = () => Math.max(-0.3, Math.min(0.3, +store.get("game.lag", 0) || 0));  // 판정 맞추기: + = the notes come later
// in a 같이듣기 room as a guest / in a channel the song can't be moved: the game joins where the song is
const gameCanSeek = () => !(typeof LT !== "undefined" && LT.role && (LT.role === "guest" || LT.chOn));
/* the song's time for the game. audio.currentTime of a relayed video comes in reports and is corrected in small jumps
   (measured ±10–15 ms a few times a second — the notes jerked: user 2026-11-26 "노트 끊김"): the game counts on by the
   screen's own clock and only leans toward the reported time; a real jump (seek · the next report after a stall) is taken at once.
   gameClock: once a frame (moves the clock) · gameNow: between frames (a key press) */
function gameNow() {
  if (GAME.ct == null || audio.paused) return audio.currentTime;
  return GAME.ct + (performance.now() - GAME.cp) / 1000 * (audio.playbackRate || 1);
}
function gameClock() {
  const p = performance.now(), ct = audio.currentTime;
  if (GAME.ct == null || audio.paused) { GAME.ct = ct; GAME.cp = p; return ct; }
  const t = GAME.ct + (p - GAME.cp) / 1000 * (audio.playbackRate || 1), d = ct - t;
  // far off: a seek — believed only when it stays far for 8 frames (one report 0.2 s off and back again was seen)
  GAME.far = Math.abs(d) > 0.2 ? (GAME.far || 0) + 1 : 0;
  GAME.ct = GAME.far >= 8 ? ct : GAME.far ? t : t + d * 0.06; GAME.cp = p;
  if (GAME.far >= 8) GAME.far = 0;
  return GAME.ct;
}

function gameOpen() {
  if (!song || !times) return uiAlert("싱크가 있는 곡에서만 할 수 있습니다.");
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  // 노트 색 = 보컬 색 (user request 2026-11-26: "노트 컬러 보컬 컬러 따라가게" — before: the two middle keys green, the outer
  // two the accent colour, which only said which key): a sung note has its line's colour (the part's singer, as the
  // lyrics show it), every other note the song's first vocal's
  const hex = c => /^#[0-9a-f]{6}$/i.test(c || "") ? inkOf(c) : "";
  const voc = SHELL.now ? vocalsOf(SHELL.now) : [];
  GAME.vocal = hex(voc[0] && voc[0][1]) || v("--accent") || "#ccc";
  GAME.lineColor = (song.groups || []).map(g => hex((g.vc || [])[0]) || GAME.vocal);
  GAME.colors = {a: v("--accent") || "#ccc", ok: v("--ok") || "#4ade80", line: v("--line") || "#333", muted: v("--muted") || "#888", bg: v("--bg") || "#181818", text: v("--text") || "#ccc"};
  GAME.on = true; GAME.song = song;
  $("gameDlg").showModal();
  showVideo();  // the video goes behind the window
  gameComments(false);
  gameReady();
}
/* the start screen: what this song's chart is, the level buttons, 시작 */
function gameReady(result) {
  gameStop();
  const ch = song && song.sync && song.sync.chart, lvl = gameLevel(), g = gameNotes(lvl), it = SHELL.now;
  GAME.beat = g.beat;
  $("gameTitle").textContent = it ? titleOf(it) : "";
  $("gameLevels").innerHTML = GAME_LEVELS.map((l, i) => `<button type="button" data-l="${i}"${i === lvl ? ' class="on"' : ""}>${esc(l)}</button>`).join("");
  $("gameSpeed").textContent = gameSpeed().toFixed(1) + "초";
  $("gameLag").textContent = (gameLag() >= 0 ? "+" : "") + Math.round(gameLag() * 1000) + "ms";
  GAME.keyset = null; gameKeysShow();
  const nl = g.notes.filter(n => n.long).length;
  const info = g.beat ? `${Math.round(ch.bpm)} BPM · 노트 ${g.notes.length.toLocaleString()}개${nl ? ` (롱노트 ${nl}개)` : ""} · 채보 일치 ${Math.round((ch.score || 0) * 100)}%`
    : `이 곡은 아직 박자 채보가 없어 가사 줄 시작(${g.notes.length}개)만 노트로 나옵니다 — 난이도와 상관없이 같습니다`;
  const s = result, best = (store.get("game.best", {}) || {})[gameSongKey(it) + "|" + lvl];
  $("gameLifeBtn").textContent = gameLifeOn() ? "켬" : "끔";
  $("gameLifeBtn").classList.toggle("on", gameLifeOn());
  $("gameDlg").classList.toggle("nolife", !gameLifeOn());
  gameLifeShow(100);
  const cls = ["perfect", "great", "good"];
  $("gameOver").innerHTML = (s ? `<div class="gres${s.failed ? " failed" : ""}">`
      + `<div class="gbanner">${s.failed ? "FAILED" : s.perfect ? "PERFECT PLAY" : s.fc ? "FULL COMBO" : "CLEAR"}</div>`
      + `<div class="gmain"><em class="ggrade g${s.grade}">${s.grade}</em><div><b>${s.score.toLocaleString()}</b>${s.best ? '<i class="gnew">NEW RECORD</i>' : ""}`
      + `<span>정확도 <u>${s.acc.toFixed(2)}%</u> · 최대 콤보 <u>${s.max}</u> / ${s.notes}</span></div></div>`
      + `<div class="gcnt">${GAME_WIN.map(([n], i) => `<span class="${cls[i]}">${n}<b>${s.hit[i]}</b></span>`).join("")}<span class="miss">MISS<b>${s.miss}</b></span>`
      + `<span>FAST<b>${s.fast}</b></span><span>SLOW<b>${s.slow}</b></span></div>`
      + (s.note ? `<div class="gnote">${esc(s.note)}</div>` : "") + `</div>`
      : best ? `<div class="gbest">내 최고 기록 <em class="ggrade g${best.grade}">${best.grade}</em> <b>${best.score.toLocaleString()}</b> · ${best.acc.toFixed(2)}% · 최대 콤보 ${best.max}</div>` : "")
    + `<div class="grank" id="gameRank"></div>`
    + `<div class="ginfo${g.beat ? "" : " warn"}">${esc(info)}</div>`
    + `<button type="button" class="primary" id="gameStart">${s ? "다시 하기" : "시작"}</button>`
    + (s ? gameHistHtml(it) : "")
    + `<div class="ghelp">키 ${esc(gameKeys().map(k => k[1]).join(" "))} · 화면 터치 · 긴 노트는 끝까지 누르고 있기 · Space 일시정지 · Esc 닫기${gameCanSeek() ? " · 시작하면 곡이 처음부터 재생됩니다" : " · 같이듣기 중이라 지금 재생 위치부터 합니다"}</div>`;
  $("gameOver").hidden = false;
  $("gameScore").textContent = s ? s.score.toLocaleString() : "0"; $("gameCombo").textContent = ""; $("gameLyric").textContent = "";
  $("gameJudge").className = "gjudge";
  gameRankShow(it, lvl, s && s.at);
  gameDraw(audio.currentTime);
}
/* 내 플레이 기록 (user request 2026-11-26: "결과창에서 다시 하기 아래에 본인 개인 플레이 기록 — 최신순으로 최대 10개, 5개 5개 해서
   두 줄로"): this device's last GAME_HIST runs of the song, every level, failed ones too (store game.hist
   {song: [{lvl, score, acc, max, grade, fc, at}]}, newest first) */
const GAME_HIST = 10;
function gameHistAdd(it, lvl, s) {
  const all = store.get("game.hist", {}) || {}, key = gameSongKey(it);
  all[key] = [{lvl, score: s.score, acc: s.acc, max: s.max, grade: s.grade, fc: s.fc, at: s.at}, ...(all[key] || [])].slice(0, GAME_HIST);
  store.set("game.hist", all);
}
function gameHistHtml(it) {
  const rows = (store.get("game.hist", {}) || {})[gameSongKey(it)] || [];
  if (!rows.length) return "";
  const when = at => { const d = new Date(at), p = n => String(n).padStart(2, "0"); return isNaN(d) ? "" : `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  return `<div class="ghist"><div class="grh">MY RECORD</div><div class="ghl">` + rows.map((r, i) => `<div class="ghc${i ? "" : " now"}">`
    + `<em class="ggrade g${esc(r.grade)}">${esc(r.grade)}</em><b>${(+r.score || 0).toLocaleString()}</b><span>${(+r.acc || 0).toFixed(2)}%</span>`
    + `<span>콤보 ${+r.max || 0}${r.fc ? " FC" : ""}</span><span>${esc(GAME_LEVELS[r.lvl] || "")}</span><span>${when(r.at)}</span></div>`).join("") + `</div></div>`;
}
/* 랭킹 (the song's file is read again every time the board is shown: someone else may have played) */
const gameRankPath = it => `${LOCAL.data}game_rank/${it.vocadb}.json`;
async function gameRankRead(it) {
  if (!it || !it.vocadb || !GAME.beat) return null;
  try { return await LOCAL.readJson(gameRankPath(it), null) || {levels: {}}; } catch (e) { return null; }
}
function gameRankHtml(rows, lvl, mineAt, note) {
  const me = gameNickKey(gameWho());
  return `<div class="grh">RANKING · ${esc(GAME_LEVELS[lvl])}</div>`
    + (rows.length ? `<div class="grt"><div class="grr head"><i>순위</i><b>닉네임</b><span>점수</span><span>정확도</span><span>최대 콤보</span><em>등급</em></div>`
        + rows.map((r, i) => `<div class="grr${gameNickKey(r.name) === me ? " me" : ""}${mineAt && r.at === mineAt ? " now" : ""}"><i>${i + 1}</i><b>${esc(r.name)}</b>`
          + `<span>${(+r.score || 0).toLocaleString()}</span><span>${(+r.acc || 0).toFixed(2)}%</span><span>${+r.max || 0}${r.fc ? " FC" : ""}</span><em class="ggrade g${esc(r.grade || "")}">${esc(r.grade || "")}</em></div>`).join("") + `</div>`
      : `<div class="gre">아직 기록이 없습니다</div>`)
    + (note ? `<div class="gnote">${esc(note)}</div>` : "");
}
async function gameRankShow(it, lvl, mineAt) {
  const box = () => song === GAME.song && gameLevel() === lvl ? $("gameRank") : null;
  if (!it || !it.vocadb || !GAME.beat) return;
  const d = await gameRankRead(it);
  if (box() && d) box().innerHTML = gameRankHtml((d.levels || {})[lvl] || [], lvl, mineAt,
    !gameWho() ? "닉네임이 없어 랭킹에 올라가지 않습니다" : !LOCAL.canWrite ? "읽기 전용으로 열어 랭킹에 올라가지 않습니다 (이 기기의 최고 기록만 남음)" : "");
}
/* a finished run → this device's best · the song's board (only a run that beats this nickname's own and is in the 5) */
async function gameRankSave(it, lvl, s) {
  const key = gameSongKey(it) + "|" + lvl, best = store.get("game.best", {}) || {};
  if (!best[key] || s.score > best[key].score) { s.best = !!best[key]; best[key] = {score: s.score, acc: s.acc, max: s.max, grade: s.grade, at: s.at}; store.set("game.best", best); }
  const name = gameWho();
  if (!name || !it.vocadb || !LOCAL.canWrite) return;
  const row = {name, score: s.score, acc: s.acc, max: s.max, notes: s.notes, hit: s.hit, miss: s.miss, grade: s.grade, fc: s.fc, at: s.at};
  const path = gameRankPath(it);
  await LOCAL.locked(path, async () => {
    const d = await LOCAL.readJson(path, null) || {levels: {}};
    d.levels = d.levels || {};
    const rows = d.levels[lvl] || [], mine = rows.find(r => gameNickKey(r.name) === gameNickKey(name));
    if (mine && mine.score >= row.score) return;
    const next = [...rows.filter(r => r !== mine), row].sort((a, b) => b.score - a.score || String(a.at).localeCompare(String(b.at))).slice(0, GAME_TOP);
    if (!next.includes(row)) return;
    d.vocadb = String(it.vocadb); d.title = titleOf(it); d.levels[lvl] = next;
    await LOCAL.writeText(path, JSON.stringify(d, null, 1) + "\n", name);
  });
}
function gameLifeShow(v) {
  const el = $("gameLife").firstElementChild;
  el.style.height = Math.max(0, Math.min(100, v)) + "%";
  $("gameLife").classList.toggle("low", v < 30);
}
function gameStart() {
  gameComments(false);  // (a song that came while the window was open loads with the player's setting)
  const g = gameNotes(gameLevel());
  GAME.notes = g.notes; GAME.beat = g.beat;
  GAME.lanes = [[], [], [], []];
  for (const n of g.notes) { n.hit = 0; GAME.lanes[n.lane].push(n); }  // hit: 0 waiting · 1 hit · -1 missed
  GAME.ptr = [0, 0, 0, 0]; GAME.hold = [null, null, null, null]; GAME.fx = [];
  GAME.stat = {score: 0, combo: 0, max: 0, hit: [0, 0, 0], miss: 0, sum: 0, fast: 0, slow: 0, life: 100};
  GAME.lifeOn = gameLifeOn(); GAME.level = gameLevel(); GAME.item = SHELL.now;
  GAME.whole = gameCanSeek(); GAME.cut = false;  // whole: played from the start · cut: the next song came before the last note
  gameLifeShow(100);
  GAME.line = -1; GAME.judged = {text: "", at: 0};
  $("gameOver").hidden = true;
  if (gameCanSeek()) audio.currentTime = 0;
  else {  // joined mid-song: what is already past is not counted
    const now = audio.currentTime;
    for (let l = 0; l < 4; l++) while (GAME.ptr[l] < GAME.lanes[l].length && GAME.lanes[l][GAME.ptr[l]].t < now + 0.5) GAME.lanes[l][GAME.ptr[l]++].hit = -2;
  }
  if (audio.paused) audio.play();
  GAME.run = true; GAME.startAt = performance.now(); GAME.ct = null;
  GAME.last = g.notes.reduce((m, n) => Math.max(m, n.e), 0);
  cancelAnimationFrame(GAME.raf);
  GAME.raf = requestAnimationFrame(gameFrame);
}
function gameStop() { GAME.run = false; cancelAnimationFrame(GAME.raf); }
function gameClose() { gameStop(); GAME.on = false; if ($("gameDlg").open) $("gameDlg").close(); showVideo(); gameComments(true); }
/* 니코니코 영상의 흐르는 코멘트: off while the game is open — it runs over the video behind the notes (user request
   2026-11-26: "배경에 띄운 영상 니코동이면 자동으로 꺼져야"); the player's own setting (💬) is not changed and comes back on close */
function gameComments(back) { if (audio.kind === "nico" && audio.br) audio.br.comments(back ? audio.comments : false); }
const gameAcc = s => { const n = s.hit[0] + s.hit[1] + s.hit[2] + s.miss; return n ? s.sum / n * 100 : 100; };
function gameEnd(failed) {
  const s = GAME.stat, n = s.hit[0] + s.hit[1] + s.hit[2] + s.miss, acc = Math.round(gameAcc(s) * 100) / 100, it = GAME.item, lvl = GAME.level;
  const res = {score: s.score, max: s.max, hit: s.hit, miss: s.miss, acc: n ? acc : 0, notes: n, fast: s.fast, slow: s.slow, failed: !!failed,
               fc: !failed && n > 0 && !s.miss, perfect: !failed && n > 0 && s.hit[0] === n, grade: failed ? "F" : gameGrade(acc), at: new Date().toISOString()};
  // ranked: a whole song with a chart, played to its last note
  const ranked = !failed && n > 0 && GAME.beat && GAME.whole && !GAME.cut && it;
  res.note = failed ? "게이지가 바닥나 실패했습니다 — 기록되지 않습니다" : !GAME.beat ? "박자 채보가 없는 곡은 기록되지 않습니다" : !GAME.whole ? "같이듣기 중 중간부터 해서 기록되지 않습니다"
    : GAME.cut ? "끝나기 전에 다음 곡으로 넘어가 기록되지 않습니다" : "";
  if (n > 0 && it && !GAME.cut) gameHistAdd(it, lvl, res);
  if (!ranked) return gameReady(res);
  gameRankSave(it, lvl, res).catch(e => { res.note = "랭킹 저장 실패: " + (e && e.message || e); })
    .then(() => { if (GAME.on && !GAME.run && SHELL.now === it && gameLevel() === lvl) gameReady(res); });
  gameReady(res);
}
/* the judgement on screen: the combo (gone at a MISS — above the judgement: user 2026-11-26 "콤보가 판정 위에 뜨게"),
   under it the judgement's name · how exact (%) · FAST / SLOW */
function gameSay(text, cls, pct, early) {
  GAME.judged = {text, at: performance.now()};
  const j = $("gameJudge"), s = GAME.stat;
  j.innerHTML = (s.combo > 1 ? `<div class="gj2"><b>${s.combo}</b><span>COMBO</span></div>` : "")
    + `<div class="gj1"><b>${text}</b>${pct != null ? `<i>${pct}%</i>` : ""}${early ? `<em class="${early < 0 ? "fast" : "slow"}">${early < 0 ? "FAST" : "SLOW"}</em>` : ""}</div>`;
  j.className = "gjudge " + cls;
  void j.offsetWidth; j.classList.add("pop");  // the pop runs again for every note
}
function gameScoreUp() {
  const s = GAME.stat;
  $("gameScore").textContent = s.score.toLocaleString();
  $("gameCombo").textContent = `${gameAcc(s).toFixed(2)}% · MAX ${s.max}`;
  if (GAME.lifeOn) gameLifeShow(s.life);
}
/* one judgement: k = its place in GAME_WIN · pct how exact · early: − hit before the note's time, + after (0: exact / a long note's end) */
function gameGot(k, lane, pct = 100, early = 0) {
  if (lane != null) GAME.fx.push({lane, at: performance.now(), k});
  const s = GAME.stat;
  s.hit[k]++; s.combo++; s.max = Math.max(s.max, s.combo);
  s.score += 10 * pct + Math.min(s.combo, 100) * 2;
  s.sum += pct / 100;
  if (pct < 100 && early) s[early < 0 ? "fast" : "slow"]++;
  s.life = Math.min(100, s.life + GAME_LIFE.got[k]);
  gameSay(GAME_WIN[k][0], ["perfect", "great", "good"][k], pct, pct < 100 ? early : 0); gameScoreUp();
}
function gameLost(lane) {  // a MISS: the combo starts again, the gauge goes down (empty → gameFrame ends the game)
  GAME.fx.push({lane, at: performance.now(), k: -1});
  const s = GAME.stat;
  s.miss++; s.combo = 0;
  s.life = Math.max(0, s.life - GAME_LIFE.miss[GAME.level]);
  gameSay("MISS", "miss"); gameScoreUp();
}
function gameMiss(n) { n.hit = -1; gameLost(n.lane); }
/* a key / a finger on a lane: the earliest waiting note of the lane within the widest window */
function gameHit(lane) {
  GAME.flash[lane] = performance.now();
  if (!GAME.run || audio.paused) return;
  const now = gameNow() - gameLag(), q = GAME.lanes[lane];
  let i = GAME.ptr[lane];
  while (i < q.length && q[i].hit) i++;
  const n = q[i];
  if (!n || Math.abs(n.t - now) > GAME_MISS) return;
  const d = Math.abs(n.t - now);
  n.hit = 1;
  if (n.long) GAME.hold[lane] = n;  // held from here to its end (gameUp / gameFrame)
  gameGot(GAME_WIN.findIndex(w => d <= w[1]), lane, gamePct(d), now - n.t);
}
/* the key / finger let go: a long note let go before its end is broken (its end counts as a MISS) */
function gameUp(lane) {
  const n = GAME.hold[lane];
  if (!n || !GAME.run) return;
  GAME.hold[lane] = null;
  if (gameNow() - gameLag() >= n.e - GAME_MISS) { n.done = true; return gameGot(0, lane); }
  n.broke = true;
  gameLost(lane);
}
function gameFrame() {
  if (!GAME.run) return;
  if (song !== GAME.song) {  // the next song came
    GAME.song = song; GAME.cut = GAME.lanes.some((q, l) => GAME.ptr[l] < q.length);
    return song && times ? gameEnd() : gameClose();
  }
  const now = gameClock() - gameLag();
  for (let l = 0; l < 4; l++) {  // notes that went by · long notes held to their end
    const q = GAME.lanes[l];
    while (GAME.ptr[l] < q.length && (q[GAME.ptr[l]].hit || q[GAME.ptr[l]].t < now - GAME_MISS)) { if (!q[GAME.ptr[l]].hit) gameMiss(q[GAME.ptr[l]]); GAME.ptr[l]++; }
    const h = GAME.hold[l];
    if (h && now >= h.e) { GAME.hold[l] = null; h.done = true; gameGot(0, l); }
    if (h && GAME.hold[l]) GAME.flash[l] = performance.now();  // the held key's lane stays lit
  }
  if (GAME.lifeOn && GAME.stat.life <= 0) {  // 게이지가 바닥: FAILED — the song stops where it may be stopped
    gameStop();
    if (gameCanSeek() && !audio.paused) audio.pause();
    return gameEnd(true);
  }
  // the line being sung, under the lanes
  let li = -1;
  for (let i = 0; i < times.length; i++) { if (times[i] + (offset || 0) <= now + 0.05) li = i; else break; }
  if (li !== GAME.line) { GAME.line = li; $("gameLyric").textContent = li >= 0 && song.groups[li] ? song.groups[li].orig || "" : ""; }
  gameDraw(now);
  if (now > GAME.last + 2 && performance.now() - GAME.startAt > 3000) return gameEnd();
  GAME.raf = requestAnimationFrame(gameFrame);
}
function gameDraw(now) {
  GAME.keyLabels = gameKeys().map(k => k[1]);
  const cv = $("gameCanvas"), box = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(1, Math.round(box.width * dpr)), H = Math.max(1, Math.round(box.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext("2d"), C = GAME.colors, lw = W / 4, jy = H * 0.84, look = gameSpeed(), nh = Math.max(10 * dpr, H * 0.022);
  const y = t => jy - (t - now) / look * jy;
  c.clearRect(0, 0, W, H);
  const t = performance.now();
  for (let l = 0; l < 4; l++) {  // lanes · the lane of a key just pressed lights up
    const a = Math.max(0, 1 - (t - GAME.flash[l]) / 180);
    if (a > 0) { c.globalAlpha = a * 0.28; c.fillStyle = C.a; c.fillRect(l * lw, 0, lw, H); c.globalAlpha = 1; }
    if (l) { c.fillStyle = C.line; c.fillRect(l * lw - dpr / 2, 0, dpr, H); }
  }
  const ch = GAME.beat && song && song.sync && song.sync.chart;
  if (ch) {  // the beats: thin lines, every 4th a little stronger
    const off = offset || 0, bt = ch.beats;
    let i = 0;
    while (i < bt.length && bt[i] + off < now - 0.3) i++;
    for (; i < bt.length && bt[i] + off < now + look; i++) {
      c.globalAlpha = i % 4 ? 0.25 : 0.6; c.fillStyle = C.line; c.fillRect(0, y(bt[i] + off) - dpr / 2, W, dpr);
    }
    c.globalAlpha = 1;
  }
  c.fillStyle = C.text; c.globalAlpha = 0.85; c.fillRect(0, jy - dpr, W, 2 * dpr); c.globalAlpha = 1;  // the line to hit on
  for (const n of GAME.notes) {
    if (n.e < now - 0.25) continue;
    if (n.t > now + look) break;
    if (n.hit === -2 || n.done || (n.hit === 1 && !n.long)) continue;
    const x = n.lane * lw + lw * 0.1, w = lw * 0.8;
    const col = n.line >= 0 ? GAME.lineColor[n.line] || GAME.vocal : GAME.vocal;
    if (n.long) {  // a long note: its body from the head to the end; while held the head stays on the line
      const held = GAME.hold[n.lane] === n, dead = n.hit === -1 || n.broke, y0 = held ? jy : y(n.t), y1 = Math.max(y(n.e), -nh);
      if (y1 > y0) continue;
      c.fillStyle = col;
      c.globalAlpha = dead ? 0.18 : held ? 0.9 : 0.5;
      gameRound(c, x + w * 0.14, y1 - nh / 2, w * 0.72, y0 - y1 + nh, nh / 2); c.fill();
      c.globalAlpha = dead ? 0.25 : 1;
      gameRound(c, x, y0 - nh / 2, w, nh, nh / 2); c.fill();
      continue;
    }
    const yy = y(n.t) - nh / 2;
    c.globalAlpha = n.hit === -1 ? 0.25 : n.fill ? 0.55 : 1;  // the bare beat (no sung note, no tune): paler
    // (a thin dark edge: a pale vocal colour on the light theme's glass was hard to see)
    if (n.ok) { c.fillStyle = col; gameRound(c, x, yy, w, nh, nh / 2); c.fill(); c.strokeStyle = "rgba(0,0,0,.45)"; c.lineWidth = dpr; c.stroke(); }
    else { c.strokeStyle = col; c.lineWidth = 2 * dpr; gameRound(c, x + dpr, yy + dpr, w - 2 * dpr, nh - 2 * dpr, nh / 2); c.stroke(); }  // 일치 안 된 노트: hollow
  }
  /* 판정 이펙트 (user request 2026-11-26: "노트 판정 이펙트 조금 더 눈에 띄게"): where the key was hit, on the line — a burst
     in the judgement's colour that opens and fades (0.35 s), an outline round it for PERFECT; a miss: a red bar */
  const FX = 350, fxCol = [C.ok, C.a, C.muted];
  GAME.fx = GAME.fx.filter(f => t - f.at < FX);
  for (const f of GAME.fx) {
    const q = (t - f.at) / FX, cx = f.lane * lw + lw / 2;
    if (f.k < 0) { c.globalAlpha = (1 - q) * 0.7; c.fillStyle = "#ff5a5a"; c.fillRect(f.lane * lw, jy - 3 * dpr, lw, 6 * dpr); continue; }
    // the note's own shape, growing out of where it was hit (user 2026-11-26: "원형 말고 노트 모양으로")
    const w = lw * 0.8 * (1 + 0.5 * q), h = nh * (1 + 2.2 * q);
    c.globalAlpha = (1 - q) * 0.85; c.fillStyle = fxCol[f.k];
    gameRound(c, cx - w / 2, jy - h / 2, w, h, h / 2); c.fill();
    if (q < 0.5) { c.globalAlpha = 1 - 2 * q; c.fillStyle = "#fff"; gameRound(c, cx - lw * 0.4, jy - nh / 2, lw * 0.8, nh, nh / 2); c.fill(); }
    if (f.k === 0) {  // PERFECT: an outline of the same shape, further out
      const w2 = lw * 0.8 * (1 + 0.9 * q), h2 = nh * (1 + 4 * q);
      c.globalAlpha = 1 - q; c.strokeStyle = "#fff"; c.lineWidth = 2 * dpr; gameRound(c, cx - w2 / 2, jy - h2 / 2, w2, h2, h2 / 2); c.stroke();
    }
  }
  c.globalAlpha = 1;
  c.fillStyle = C.muted; c.font = `${12 * dpr}px sans-serif`; c.textAlign = "center";
  for (let l = 0; l < 4; l++) c.fillText(GAME.keyLabels[l], l * lw + lw / 2, H - 8 * dpr);
}
function gameRound(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

$("btnGame").onclick = gameOpen;
/* 설정 · 신고 (user request 2026-11-26: "난이도를 제외한 나머지 설정들 다 한 버튼으로 새로운 팝업 뜨는 걸로 · 설정 왼쪽에 오류 버그
   신고 버튼 — 새로운 항목 '리듬게임'으로 자동 작성"): the report window opens with the kind 리듬게임, the playing song and
   a first line saying how the game was set (level · speed · 판정 · gauge · the chart) */
$("gameSetBtn").onclick = () => { gameKeysShow(); $("gameSetDlg").showModal(); };
$("gameSetClose").onclick = () => $("gameSetDlg").close();
$("gameSetDlg").addEventListener("close", () => { GAME.keyset = null; gameKeysShow(); });
$("gameReport").onclick = () => {
  if (GAME.run && !audio.paused && gameCanSeek()) $("btnPlay").click();  // (the game waits while the report is written)
  const ch = song && song.sync && song.sync.chart, lag = Math.round(gameLag() * 1000);
  openReport({kind: "리듬게임", it: SHELL.now || null,
    text: `[${GAME_LEVELS[gameLevel()]} · 속도 ${gameSpeed().toFixed(1)}초 · 판정 ${lag >= 0 ? "+" : ""}${lag}ms · 게이지 ${gameLifeOn() ? "켬" : "끔"} · ${ch ? `채보 v${ch.v} ${Math.round(ch.bpm)} BPM 일치 ${Math.round((ch.score || 0) * 100)}%` : "채보 없음"}]
`});
};
$("gameClose").onclick = gameClose;
$("gameDlg").addEventListener("close", () => { if (!$("gameDlg").open) { gameStop(); GAME.on = false; showVideo(); gameComments(true); } });  // (the event comes later: it may be open again)
$("gameDlg").addEventListener("click", e => {
  const l = e.target.closest("#gameLevels button"), sp = e.target.closest("[data-sp]"), lag = e.target.closest("[data-lag]");
  if (l) { store.set("game.level", +l.dataset.l); return gameReady(); }  // another level: from the start screen again
  if (sp) { store.set("game.speed", Math.round((gameSpeed() - 0.2 * +sp.dataset.sp) * 10) / 10); $("gameSpeed").textContent = gameSpeed().toFixed(1) + "초"; }
  if (lag) { store.set("game.lag", Math.round((gameLag() + 0.01 * +lag.dataset.lag) * 100) / 100); $("gameLag").textContent = (gameLag() >= 0 ? "+" : "") + Math.round(gameLag() * 1000) + "ms"; }
  if (e.target.closest("#gameKeys")) { if (GAME.run) return uiAlert("게임 중에는 키를 바꿀 수 없습니다."); GAME.keyset = GAME.keyset ? null : []; gameKeysShow(); }
  if (e.target.closest("#gameLifeBtn")) { if (GAME.run) return uiAlert("게임 중에는 게이지를 바꿀 수 없습니다."); }
  if (e.target.closest("#gameLifeBtn") && !GAME.run) { store.set("game.life", !gameLifeOn()); return gameReady(); }  // (not in the middle of a game)
  if (e.target.closest("#gameStart")) { GAME.keyset = null; gameKeysShow(); gameStart(); }
});
$("gameCanvas").addEventListener("pointerdown", e => {
  e.preventDefault();
  const r = $("gameCanvas").getBoundingClientRect(), lane = Math.max(0, Math.min(3, Math.floor((e.clientX - r.left) / r.width * 4)));
  GAME.touch.set(e.pointerId, lane);
  try { $("gameCanvas").setPointerCapture(e.pointerId); } catch (x) { /* the finger is gone already */ }
  gameHit(lane);
});
for (const ev of ["pointerup", "pointercancel"]) $("gameCanvas").addEventListener(ev, e => {
  if (!GAME.touch.has(e.pointerId)) return;
  const lane = GAME.touch.get(e.pointerId);
  GAME.touch.delete(e.pointerId);
  gameUp(lane);
});
/* keys while the game is open: its own only (the player's Space · ← → · sync keys must not act behind it) */
window.addEventListener("keydown", e => {
  if (!GAME.on || !$("gameDlg").open || document.querySelector("dialog.uidlg[open]") || $("reportDlg").open) return;
  e.stopPropagation();
  if (GAME.keyset) {  // 키 설정: this key is the next lane's
    e.preventDefault();
    if (e.key === "Escape") GAME.keyset = null;
    else if (!e.repeat && !["Space", "Enter", "NumpadEnter"].includes(e.code) && !GAME.keyset.some(k => k[0] === e.code)) {
      GAME.keyset.push([e.code, gameKeyLabel(e)]);
      if (GAME.keyset.length === 4) { store.set("game.keys", GAME.keyset); GAME.keyset = null; gameKeysShow(); return gameReady(); }
    }
    return gameKeysShow();
  }
  if ($("gameSetDlg").open) {  // 설정 창: Esc closes it (not the game), no key plays
    if (e.key === "Escape") { e.preventDefault(); $("gameSetDlg").close(); }
    return;
  }
  if (e.key === "Escape") { e.preventDefault(); return gameClose(); }
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat && GAME.run) $("btnPlay").click(); return; }
  if (e.key === "Enter" && !GAME.run) { e.preventDefault(); return gameStart(); }
  const lane = gameLane(e.code);
  if (lane >= 0) { e.preventDefault(); if (!e.repeat) gameHit(lane); }
}, true);
window.addEventListener("keyup", e => {
  if (!GAME.on) return;
  const lane = gameLane(e.code);
  if (lane >= 0) gameUp(lane);
}, true);
