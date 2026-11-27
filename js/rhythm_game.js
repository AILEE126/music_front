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
   멜로디 위주 (user 2026-11-27: "너무 가사만 쫓아간다는 후기가 많아서 — 멜로디 80% 가사 20% 정도로 로직 다 갈아엎어야", "가사 20%도
   잔잔한 부분 · 말하듯이 하는 부분 · 소리 지르는 부분 같은 특징적인 부분만"): with a chart v7 the notes are the music's (where
   something comes in · the tune's notes), the lyrics' own only where they stand out — GAME_MUSIC in gameNotes. What is
   said above about syllables is how a chart made before v7 still plays. ジッタードール now 392 · 652 · 931 · 1,285 notes; of
   the notes that are not keys-at-once or the bare beat about a quarter are the lyrics' own. Limits: 쉬움 as above ·
   어려움 5 notes in any 4 beats · 매우어려움 4 in any 2 beats · the top level 7 in any 2 beats (no longer every note);
   keys at once on 3 · 14 · 30 · 60 % of the beats (three 0 · 0 · 4 · 20 %, four 3 % at the top).
   Then (user 2026-11-27, GAME_MUSIC · GAME_PAIRS below): the drums first · long stretches without singing = long notes
   only, no bare beat · never more than two keys at once, in a fixed round of pairs, joined by a bar.
   ジッタードール 409 · 652 · 966 · 1,169 notes — with the patterns (GAME_GROUPS below) 409 · 626 · 946 · 1,144.
   A song without a chart (not made yet — 음원 관리 › 수집 › 자동 싱크 › 채보 만들기) plays its sync's line starts only, the same
   at every level; the start screen says so.
   Keys D F J K (lanes left to right) · touch: the lane under the finger · Space pauses · Esc closes. */
// names (user 2026-11-26: "EASY, MIDDLE?, HARD, SUPER HARD로" — the second one asked with a question mark: NORMAL, the
// usual word) — the comments here still say 쉬움 · 어려움 · 매우어려움 · >>매우매우어려움<< for the four, in this order
// EXTREME (user 2026-11-27: "익스트림 난이도 만들어 줘 — 나머지는 난이도 그대로 유지"): a fifth level above SUPER HARD, the four
// below it untouched — every quarter beat may hold a note (8 in 2 beats), two keys at once on 60 % of the beats and
// on the half beats the drums hit hard, a long note only when it lasts 4 beats, a MISS costs more
const GAME_LEVELS = ["EASY", "NORMAL", "HARD", "SUPER HARD", "EXTREME"];
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
const GAME_LIFE = {got: [1.5, 1, 0.4], miss: [4, 5, 6, 7, 8]};  // + by judgement · − a MISS by level (of 100)
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
  {gap: 3, win: 8, max: 3, rest: 4},             // ≥ rest steps between two phrases (a step = a quarter beat)
  {gap: 2, win: 8, max: 4, rest: 2},
  {gap: 1, win: 8, max: 5, rest: 0},
  {gap: 1, win: 8, max: 6, rest: 0},
  {gap: 1, win: 8, max: 8, rest: 0}];
/* 난이도는 간격과 패턴 (user 2026-11-27: "하이라이트가 아닌 부분도 노트가 너무 부실하다고 함 — 난이도는 노트 갯수보다는 간격이나 패턴이
   결정하는 거임"): the levels had been told apart by how MANY notes a stretch may hold (2 · 5 in 4 beats · 4 · 7 in 2
   beats), and a part that is not the highlight got 30 % of that — thin everywhere but the chorus. Now a level is its
   spacing: EASY 3/4 beat apart · NORMAL half a beat · HARD and SUPER HARD a quarter (HARD: 6 notes in 2 beats at
   most, so quarter runs stay short) — `max` only says that; and the calm parts keep GAME_SOFT (0.7) of it, with their
   notes half a beat apart at the least. What sets the upper levels apart is the patterns (GAME_RUNS · GAME_PAIRS). */
const GAME_MUSIC = 0.3;                          // the music: the steps where most comes in — this share of all steps
const GAME_STRONG = 0.6, GAME_CALM = 0.1, GAME_SOFT = 0.6, GAME_HOOK = 0.8;  // 강약: a part's strength (0–1) → the share of the level's notes it gets
const GAME_LONG = [[1, 1.5, 2, 3, 4], [0, 1, 2, 4, 4]];  // by level: a long note lasts at least · comes at least this long after the one before (beats)
const GAME_BURST = 4;                            // single notes within 2 beats = a burst (폭타): no long note next to one
const GAME_PAIR = 0.4;                           // two keys at once only where the song is at least this strong
const GAME_GAP = 4;                              // beats nobody sings for → that stretch is long notes only
const GAME_LYRIC = 0.2;                          // the lyrics' own notes: this share of the notes (the syllables that stand out)
/* 동시에 치는 키 (user 2026-11-27: "모든 난이도에서 3, 4칸 동시 노트는 재미가 없다고 함 — 2, 4 반복 노트가 차라리 재밌을 듯 · 아주
   어려운 모드에서도 노트의 규칙은 지켜져야 함, 예를 들어 FJ FJ DK DK DJ FK DJ FK 이런 식으로 · 동시에 치는 노트는 줄로 연결"):
   never more than two keys, one of each hand, and which two is not worked out note by note any more — the pairs come in
   this round, the same at every level; a new round starts after 2 bars without one. The two notes are joined by a bar. */
const GAME_PAIRS = [[1, 2], [1, 2], [0, 3], [0, 3], [0, 2], [1, 3], [0, 2], [1, 3]];
/* 패턴 (user 2026-11-27: "계단 같은 패턴도 활용해야 하고 … 공개적으로 올라와 있는 채보 정보 다 습득해서 문서화 — 그것도 활용해서
   규칙 로직 너가 더 추가해 봐"; music_backend docs/rhythm_chart_guide.md §12 — its rule numbers in brackets). With a chart
   v7+ the key of a single note is not worked out note by note from the pitch any more, it comes from the pattern the
   note is part of (gameNotes › GAME_RUNS):
   · a run = single notes half a beat or closer, between two-key notes · long notes · longer waits
   · a run whose tune clearly goes one way is a stair — up D F J K, down K J F D, on round as a roll; up and down again
     a spiral with its top on K; two pitches to and fro a two-hand trill F J [4]. A tune that does none of these, or
     moves within 2 semitones, counts as no tune [5]
   · a run without a tune is laid in fours from GAME_GROUPS — trill · bent stair · stair, so one four in three is a
     whole stair [8] and the shape only changes on the four [7]; every other run left ↔ right [11]; no turn that is
     not one of these [9]
   · a run that lands on a two-key note ends in the four that fits that pair [12]: before FJ a stair, before DK a
     folded stair, before DJ the stair up, before FK the stair down
   · between two two-key notes half a beat apart: nothing in the DJ FK part of the round (any key there would be the
     same key twice a quarter beat apart) [14], D / K between FJ FJ, F / J between DK DK
   · a quarter-beat run ends on the beat or the half beat — a last note between them is left out [1]
   · the notes that are not in a run (the slow ones — all of EASY) walk through GAME_WALK: a set of four keys played
     twice, then the next set [2]. */
/* 계단은 이유가 있는 곳에만 (user 2026-11-27: "계단이 너무 뜬금없는 곳에 있는 것 같음"): the first try put a whole stair in every third
   four of a run and in the slow notes' sets, whatever the music did (the guide's [8] "one four in three" taken without
   its [6] "where"). Now a whole stair comes only where the song gives the reason: the tune goes one way [4] · the run
   is a fill — it ends in the last beat of a bar [6]: up when the next bar is as strong or stronger, down when it is
   calmer · the run lands on a two-key note [12]. Everything else is trills and bent stairs; the slow notes' sets and
   the runs of three have no stair in them. */
const GAME_GROUPS = [[1, 2, 1, 2], [0, 1, 2, 1], [2, 1, 2, 1], [3, 2, 1, 2], [0, 3, 0, 3], [1, 2, 3, 2]];
const GAME_LAND = {"1,2": [0, 1, 2, 3], "0,3": [1, 2, 3, 2], "0,2": [0, 1, 2, 3], "1,3": [3, 2, 1, 0]};  // the four before a pair
const GAME_WALK = [[1, 2, 0, 3], [2, 1, 3, 0], [0, 2, 1, 3], [3, 1, 2, 0]];
const GAME_SHORT = [[[1, 2], [0, 1], [2, 3], [2, 1], [3, 2], [1, 0]],                           // runs of two · of three: steps of
                    [[1, 2, 1], [2, 1, 2], [0, 2, 0], [3, 1, 3], [1, 3, 1], [2, 0, 2]]];     // to and fro
const GAME_ANCHOR = [2, 4, 99, 99, 99];              // the same key at most this many times in a row half a beat apart
function gameNotes(level) {
  const sj = song && song.sync, ch = sj && sj.chart, off = offset || 0;
  GAME.lint = null;
  if (!ch || !(ch.v >= 2) || !(ch.notes || []).length || (ch.beats || []).length < 2) {  // no chart: the sync's line starts
    const m = (sj && sj.matched) || [];
    return {beat: false, notes: (times || []).map((t, i) => ({t: t + off, e: t + off, lane: i % 4, line: i, ok: m[i] !== false, fill: false, long: false}))};
  }
  const S = ch.steps, mod = (a, b) => ((a % b) + b) % b;
  // the song's bars as the chart counted them (v9 `bar` [beats a bar, the first beat that starts one] — before: 4 from beat 0)
  const BAR = (ch.bar ? ch.bar[0] : 4) * S, BAR0 = (ch.bar ? ch.bar[1] : 0) * S;
  const fillEvery = [S, S, S / 2, S / 2, S / 2][level];
  // keys at once — every level, how often is the level: a line's first note always; two keys on every `two`-th beat,
  // three on a line's first note and every `three`-th beat
  const two = [0, 4 * S, 2 * S, S, S][level], three = [0, 0, 0, 4 * S, 4 * S][level];
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
  // (GAME_MUSIC: the notes sit on the song's hits now, so fewer of the beats are needed for as many keys at once;
  // three and four keys at once are gone — GAME_PAIRS)
  const acc2 = hard([0.03, 0.14, 0.3, 0.42, 0.6][level]);
  const accOf = st => mod(st, S) === 0 ? +feel.acc[beatOf(st)] : -1, silent = st => !!feel && +feel.lvl[beatOf(st)] < 2;
  const lvlOf = st => feel ? +feel.lvl[beatOf(st)] : 9, movOf = st => feel && feel.mov ? +feel.mov[beatOf(st)] : 9;
  /* 강약 (user 2026-11-27: "슈퍼하드도 채보 떨어지는 강약 조절이 필요 — 잔잔한 부분까지 노트가 많이 떨어지면 게임이 아니라 노동 · 악보
     만드는 거랑 똑같다"): how many notes a part gets follows how strong the song is there, at every level. A beat's
     strength = how loud it is + how much of the drums comes in, over the 2 bars round it, as its place among the
     song's own beats (0 the calmest … 1) — so every song has its calm and its strong parts, a loud one too.
     `ease`: the share of the level's notes a part may have — all from GAME_STRONG up, GAME_SOFT of them at GAME_CALM and
     under; a calm part also has no notes closer than half a beat and no two keys at once. */
  /* 하이라이트 (user 2026-11-27: "하이라이트가 어디인지 인식이 되고 있음? 하이라이트에 노트 많이 몰아주고 아닌 곳은 레이지하게 — 하이라이트가
     아닌 곳에 노트가 몰려서 재미가 없는 것 같고"): the strength was loudness + drums over 2 bars — a loud verse counted
     like the chorus. Now a part's strength is what makes a chorus one, over 4 bars round each beat: how loud and how
     busy it is (half), how high the voice sings there (three tenths — a chorus sits above its verse) and whether its
     lines come back in the song (two tenths — the same words sung again). Its place among the song's own beats is the
     strength; the top GAME_STRONG part gets every note of the level, the bottom GAME_CALM part GAME_SOFT of them. */
  const inten = (() => {
    if (!feel) return null;
    const nb = feel.lvl.length, dr = feel.drum || feel.hit, e = [], hi = new Array(nb).fill(0), hn = new Array(nb).fill(0), back = new Array(nb).fill(0);
    for (let b = 0; b < nb; b++) {
      let a = 0;
      if (dr) for (let k = 0; k < S; k++) a += +dr[b * S + k] || 0; else a = +feel.acc[b] * 2;
      e.push(+feel.lvl[b] / 9 + a / (4.5 * S));
    }
    const texts = ((song && song.groups) || []).map(g => String(g.orig || "").replace(/\s+/g, "")), seen = {};
    for (const t of texts) if (t) seen[t] = (seen[t] || 0) + 1;
    // … or half as much when only some words of the line do: 4 letters in a row it shares with a line 4 or more lines away
    // (ヒビカセ's hook is 'この息と音とヒビカセ' · '重ねた息と音をヒビカセ' · 'オトヒビカセ' — never the same line twice)
    const grams = texts.map(t => { const g = new Set(); for (let k = 0; k + 4 <= t.length; k++) g.add(t.slice(k, k + 4)); return g; });
    const part = texts.map((t, i) => grams.some((g, k) => Math.abs(k - i) >= 4 && [...grams[i]].some(x => g.has(x))));
    // a line is sung from its first syllable to the end of its last — a held note counts for as long as it is held
    // (ヒビカセ's hook is a few long notes: counted by syllables it was "nobody sings" and went by loudness alone)
    const inLine = new Array(nb).fill(0), lineEnd = {};
    for (const [st, line, , pitch, len] of ch.notes) {
      const b = beatOf(st), e = beatOf(st + (len || 0)), from = line in lineEnd ? lineEnd[line] : b;
      for (let k = b; k <= e; k++) if (pitch) { hi[k] += pitch; hn[k]++; }
      for (let k = Math.min(from, b); k <= e; k++) { inLine[k] = 1; if (seen[texts[line]] > 1) back[k] = 1; else if (part[line]) back[k] = Math.max(back[k], 0.5); }
      lineEnd[line] = e;
    }
    const W = 8;  // beats either side: 4 bars
    const over = (v, ok) => v.map((_, b) => { let x = 0, n = 0; for (let k = Math.max(0, b - W); k <= Math.min(nb - 1, b + W); k++) if (!ok || ok(k)) { x += v[k]; n++; } return n ? x / n : NaN; });
    const heardAt = b => +feel.lvl[b] >= 2;
    const rank = v => { const u = v.filter((x, b) => heardAt(b) && !isNaN(x)).sort((x, y) => x - y); return v.map(x => { if (isNaN(x) || !u.length) return 0.5; let lo = 0, top = u.length; while (lo < top) { const m = (lo + top) >> 1; if (u[m] < x) lo = m + 1; else top = m; } return lo / u.length; }); };
    if (e.filter((_, b) => heardAt(b)).length < 16) return null;
    const rE = rank(over(e)), rP = rank(over(hi.map((x, b) => hn[b] ? x / hn[b] : 0), b => hn[b] > 0)), rB = over(back);
    const sung = over(inLine);  // (where nobody sings the voice says nothing: loudness alone)
    /* ヒビカセ (user 2026-11-27: "하이라이트 구간에 노트가 오히려 더 안 나오는 문제"): its chorus is a wall of sound — nothing
       stands out of it, so "how busy" (the drums that stand out) is LOWER there than in the verse, and loudness is at
       the top of its scale all through the song; with half the weight on those two the chorus came out as the calm
       part (0.14–0.23). What does mark it: the voice is 3–5 semitones higher and its lines come back. So where
       somebody sings: the voice's height half, the lines coming back three tenths, loud + busy two tenths. */
    /* ワールズエンド・ダンスホール (user 2026-11-27: "하이라이트에 갑자기 노트 수가 확 떨어지는 문제 — 로직 만드는 규칙이 뭔가 잘못되어 있는
       것 같은데"): its chorus is sung LOWER than its verses (65–66 against 67–70) and with fewer drums that stand out, so
       "the voice is higher" put it at the bottom (0.08) — the second song the guess got backwards, each for another
       reason. Neither the voice's height nor the drums say "chorus" in every song; the one sign that held in both is
       that a chorus's words come back. So that carries the guess now (0.6), the other two only shade it (0.2 each) —
       and a part that is not taken for the highlight keeps GAME_SOFT 0.85 of the level's notes, so a wrong guess costs
       little. */
    /* 하이라이트는 추측하지 않는다 (user 2026-11-27: "하이라이트 구분을 못 하는 거 아님? 보니까 오히려 간주 구간이 노트 훨씬 많고"):
       right — the guess (the voice's height · the drums · loudness) was backwards on ヒビカセ and on ワールズエンド・ダンスホール,
       each for another reason, and thinned their choruses while the interludes, full of drums, kept everything. What
       the chart does know for certain is used instead:
         · somebody sings there        → every note of the level (0.6; 1 where the words come back in the song — a
                                          chorus's do — which also brings the melody in as notes at every level)
         · nobody sings (an interlude) → fewer than a sung part (0.4)
         · the song is quiet there     → fewest, and no closer than half a beat (0.1): 2 digits or more under the
                                          song's usual loudness */
    const lv = over(feel.lvl.split("").map(Number)), usual = [...lv].filter((_, b) => heardAt(b)).sort((x, y) => x - y);
    const loud = usual.length ? usual[Math.floor(usual.length * 0.6)] : 9;
    return lv.map((v, b) => v <= loud - 2 ? 0.1 : sung[b] > 0.2 ? 0.6 + 0.4 * Math.min(1, rB[b] * 1.5) : 0.4);
  })();
  const strong = st => inten ? inten[beatOf(st)] : 1;
  // how full a part is, of the level's limit: where the words come back 1 · sung 0.85 · an interlude 0.6 · quiet 0.4.
  // The notes there are to choose from are plenty everywhere now (every step with something of the drums on it), so
  // this — not how clearly the drums stand out in a part — decides how many notes it has: an interlude full of
  // drums no longer has more than the chorus (user 2026-11-27: "오히려 간주 구간이 노트 훨씬 많고")
  const ease = st => { const v = strong(st); return v >= GAME_HOOK ? 1 : v >= GAME_STRONG ? 0.85 : v > GAME_CALM ? 0.6 : 0.4; };

  // 1. every note there can be = the top level: kind 1 a sung note · 2 the tune where nobody sings · 3 the music
  const all = [], phr = new Map();
  const hit = feel && (feel.drum || feel.hit), music = !!(hit && ch.mel);  // (drum: chart v8 — v7 has `hit` only)
  if (music) {
    /* GAME_MUSIC — 멜로디 위주 (user 2026-11-27: "너무 가사만 쫓아간다는 후기가 많아서 가사보다는 멜로디 위주로 — 멜로디 80% 가사
       20% 정도로 로직 다 갈아엎어야", "가사 20%도 잔잔한 부분 · 말하듯이 하는 부분 · 소리 지르는 부분 같은 특징적인 부분만"):
       a note is first of all something of the music coming in (chart v7 feel.hit: a digit a step) and a note of the tune
       (chart.mel — the pitch gives the key); a syllable sung on such a step only makes it matter a little more.
       The lyrics lead only where they are the point — the GAME_LYRIC share of the notes, taken from the syllables that
       are most so: a held one (아~~~ · a shout), a run on one pitch or without one (spoken), one sung over a calm
       stretch (quiet · little coming in). Where nobody sings the chart's held sounds stay long notes as before.
       After the first melody-led play (user 2026-11-27): "멜로디 중 드럼에 중점으로" → the strength is the drums'
       (feel.drum, chart v8: how many bands of the sound rise at once) and a note of the tune is no reason for a note
       by itself any more, it only gives the key · "가사가 없는 멜로디 구간에도 억지로 노트를 끼워 넣은 것 같은 느낌 — 공백이 긴
       구간은 노트로 채우는 것보다 롱노트로" → where nobody sings for GAME_GAP beats or more there are no notes of the
       drums and no bare beat: only long notes — the chart's own (a held sound · a held note of the tune) and, where
       the tune moves, one from each of its notes to the next (a beat at least, 4 beats at most). */
    const top = hit.length, sung = new Map(ch.notes.map(n => [n[0], n]));
    const melAt = new Map(), tuneP = new Int16Array(top + 1), held = new Uint8Array(top + 1), at = new Map();
    for (const [st, len, p] of ch.mel) { melAt.set(st, [len, p]); for (let k = Math.max(0, st); k <= Math.min(top, st + Math.max(len, 1)); k++) tuneP[k] = p; }
    const spans = [];  // [first step, last step, line] of every sung line → the line a note of the music belongs to (its colour)
    for (const [st, line, , , len] of ch.notes) { const e = st + (len || 0); if (spans.length && spans[spans.length - 1][2] === line) spans[spans.length - 1][1] = e; else spans.push([st, e, line]); }
    let sp = 0;
    const lineAt = st => { while (sp < spans.length - 1 && spans[sp][1] < st) sp++; return spans[sp] && spans[sp][0] <= st + S && st <= spans[sp][1] + S ? spans[sp][2] : -1; };
    for (const [st, len, p] of ch.longs || []) {  // held sounds and long notes of the tune where nobody sings
      if (!len) continue;
      if (p && len < 2 * S) { if (st >= 0 && st < top) at.set(st, {st, len: 0, p, kind: 3, line: -1, ok: true, fill: false, w: 6}); continue; }  // (a short one: a single note)
      at.set(st, {st, len, p, kind: 2, line: -1, ok: true, fill: false, w: 60});
      for (let k = Math.max(0, st - 2); k <= Math.min(top, st + len + 1); k++) held[k] = 1;
    }
    // the long stretches without singing: [from, to] — a beat free after the last sung note and before the next
    const gap = new Uint8Array(top + 1), gaps = [];
    let pe = -1e9;
    for (const [a, b] of [...spans, [1e9, 1e9]]) {
      const lo = Math.max(0, pe + S), hi = Math.min(top, a - S);
      if (a - pe >= GAME_GAP * S && hi > lo) { gaps.push([lo, hi]); gap.fill(1, lo, hi + 1); }
      pe = b;
    }
    /* 간주 · 도입부 (user 2026-11-27: "간주 구간이나 초반 멜로디만 있는 구간 노트가 너무 많이 빔"): a stretch without singing had
       only long notes — one from each note of the tune to the next — and no notes of the drums, which left it nearly
       empty above EASY (the upper levels turn most long notes into single ones, and the long notes had kept their
       stretch clear). There the tune leads now: every note of it is a note, one held for 2 beats or more a long
       note (4 beats at most); the drums come in as everywhere else. */
    for (const [lo, hi] of gaps) {
      for (const m of ch.mel) {
        if (m[0] < lo || m[0] > hi || held[m[0]] || at.has(m[0]) || silent(m[0])) continue;
        const len = m[1] >= 2 * S ? Math.min(m[1], 4 * S, hi - m[0]) : 0;
        at.set(m[0], {st: m[0], len: len >= 2 * S ? len : 0, p: m[2], kind: 3, line: -1, ok: true, fill: false, w: 6 + 2 * (+hit[m[0]] || 0)});
        if (len >= 2 * S) held.fill(1, m[0] + 1, Math.min(top, m[0] + len) + 1);
      }
    }
    /* 상위 난이도 (user 2026-11-27: "상위 난이도는 롱노트에 일반 노트 빈도를 좀 많이 올려 줘야", "슈퍼하드 노트 총량 한 1.2배 정도로"):
       · HARD and SUPER HARD play on while a key is held — the notes that fall inside a long note are no longer left
         out there (the other hand takes them; no two keys at once meanwhile)
       · SUPER HARD takes the melody everywhere, not only in the strong parts: every sung syllable and every note of the
         tune that has a little of the drums on it, after the drums' own notes */
    const upper = level >= 2;
    const digits = [...hit].map(Number).sort((x, y) => y - x), need = Math.max(2, digits[Math.floor(digits.length * GAME_MUSIC)] || 2);
    let nMusic = 0;
    for (let st = 0; st < top; st++) {
      const h = +hit[st], m = melAt.get(st);
      if ((held[st] && !upper) || at.has(st) || silent(st) || h < 1) continue;  // (every step the drums touch: the level's limits pick among them, the hardest hits first)
      const s = sung.get(st);
      // a note of the tune held for two beats or more with nothing sung in it = a long note
      let len = m && m[0] >= 2 * S ? m[0] : 0;
      for (let k = st + 1; len && k < st + len; k++) if (sung.has(k)) len = 0;
      at.set(st, {st, len, p: (m && m[1]) || tuneP[st] || (s && s[3]) || 0, kind: 3, line: lineAt(st), ok: true, fill: false, w: 2 * h + (m ? 2 : 0) + (s ? 2 : 0)});
      nMusic++;
    }
    /* a strong part has every note of the level — but the drums alone may not give that many (ヒビカセ's chorus: 1.3–2.8
       places a second, its verse 4): there the song's own melody fills up, after the drums — the syllables sung and
       the notes of the tune, with less weight than a drum hit, so the level's limit takes the drums first */
    for (const [st, line, ok, pitch, len] of ch.notes) {
      if (st < 0 || st >= top || at.has(st) || (held[st] && !upper) || (strong(st) < GAME_HOOK && level < 3)) continue;
      at.set(st, {st, len: len || 0, p: pitch || tuneP[st] || 0, kind: 1, line, ok: !!ok, fill: false, w: 5});
    }
    for (const [st, , p] of ch.mel) {
      if (st < 0 || st >= top || at.has(st) || (held[st] && !upper) || gap[st] || silent(st) || (strong(st) < GAME_HOOK && level < 3) || +hit[st] < 1) continue;
      at.set(st, {st, len: 0, p, kind: 3, line: lineAt(st), ok: true, fill: false, w: 3});
    }
    // the lyrics' share: the syllables that stand out most
    const act = [], lead = [];
    for (let b = 0; b * S < top; b++) { let v = 0; for (let k = 0; k < S; k++) v += +hit[b * S + k] || 0; act.push(v); }
    const calmAt = [...act].sort((x, y) => x - y)[Math.floor(act.length * 0.25)];
    ch.notes.forEach((n, i) => {
      const [st, line, ok, pitch, len] = n, a = ch.notes[i - 1], b = ch.notes[i + 1];
      const near = x => x && x[1] === line && Math.abs(x[0] - st) <= 2 && (!pitch || !x[3] || Math.abs(x[3] - pitch) <= 1);
      const c = (len ? 3 : 0) + (near(a) && near(b) ? 2 : 0) + Math.max(0, 7 - lvlOf(st)) / 2 + (act[beatOf(st)] <= calmAt ? 1.5 : 0);
      if (c > 0 && !held[Math.max(0, Math.min(top, st))]) lead.push({c, n: {st, len: len || 0, p: pitch || 0, kind: 1, line, ok: !!ok, fill: false, w: 6 + 2.5 * c}});
    });
    lead.sort((x, y) => y.c - x.c || x.n.st - y.n.st);
    for (const {n} of lead.slice(0, Math.round(nMusic * GAME_LYRIC / (1 - GAME_LYRIC)))) at.set(n.st, n);
    all.push(...at.values());
    all.sort((x, y) => x.st - y.st);
    /* 롱노트는 위 난이도일수록 적게 (user 2026-11-27: "롱노트가 상위 난이도 갈수록 더 줄어야 하고 덜 몰리게 — 낮은 난이도보다는 높은
       난이도에서 나는 문제"): every long note was played at every level, so the upper levels had them all AND their own
       notes round them. A long note stays long only when it lasts GAME_LONG[0] beats at the level and the long note
       before it ended GAME_LONG[1] beats ago; else it is a single note there. (A held sound without a pitch — noise,
       the song's first and last stretch — stays.) */
    let longEnd = -1e9;
    for (const n of all) {
      if (!n.len) continue;
      if (n.kind === 2 && !n.p) { longEnd = n.st + n.len; continue; }
      if (n.len < GAME_LONG[0][level] * S || n.st - longEnd < GAME_LONG[1][level] * S) { n.len = 0; if (n.kind === 2) n.kind = 3; n.w = Math.min(n.w, 8); }
      else longEnd = n.st + n.len;
    }
    for (const n of all) { n.g = "m"; if (n.kind !== 2 || n.p) { if (!phr.has(n.g)) phr.set(n.g, []); phr.get(n.g).push(n); } }
  } else {  // a chart made before v7 (no music in it): the sung notes and the tune where nobody sings, as before
  for (const [st, line, ok, pitch, len] of ch.notes) all.push({st, len: len || 0, p: pitch || 0, kind: 1, line, ok: !!ok, fill: false});
  for (const [st, len, p] of ch.longs || []) all.push({st, len, p, kind: 2, line: -1, ok: true, fill: false});
  all.sort((x, y) => x.st - y.st);
  // phrases: a sung line · the tune notes that follow one another within 2 beats (a held sound, no pitch, is in none)
  let grp = 0, gEnd = -1e9;
  for (const n of all) {
    if (n.kind === 2) { if (n.st - gEnd > 2 * S) grp++; gEnd = n.st + n.len; n.g = "t" + grp; } else n.g = "l" + n.line;
    if (n.kind === 1 || n.p) { if (!phr.has(n.g)) phr.set(n.g, []); phr.get(n.g).push(n); }
  }
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
    if (!music) { ns[0].h = ns[0].kind === 1; ns[ns.length - 1].z = true; }  // a line's first syllable · the phrase's last note
    for (const n of ns) { const b = Math.floor((n.st - BAR0) / BAR); if (!bars.length || bars[bars.length - 1].b !== b || bars[bars.length - 1].g !== n.g) bars.push({b, g: n.g, ns: []}); bars[bars.length - 1].ns.push(n); }
  }
  for (const {b, ns} of bars) {
    const st0 = b * BAR + BAR0;
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
      // (GAME_MUSIC: how hard the music comes in there · a note of the tune · the lyrics' own notes — n.w — and its place in the beat)
      const score = music ? ns.map(n => n.w + (n.len ? 50 : 0) + (mod(n.st, S) === 0 ? 4 : mod(n.st, S / 2) === 0 ? 2 : 0)) : ns.map((n, i) => (n.h ? 100 : 0) + (n.len ? 50 : 0)
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
  const order = [...all].sort((x, y) => y.score - x.score || x.st - y.st);
  const thin = () => {
  const on = Uint8Array.from(all, n => n.len ? 1 : 0);
  for (let lv = 0; lv <= level; lv++) {
    const C = GAME_FIT[lv];
    if (!C) { on.fill(1); break; }
    const fits = i => {
      const n = all[i], near = [n.st];
      let a = i - 1, b = i + 1;
      while (a >= 0 && !on[a]) a--;
      while (b < all.length && !on[b]) b++;
      const k = ease(n.st), gap = strong(n.st) <= GAME_CALM ? Math.max(C.gap, S / 2) : C.gap, max = Math.max(1, Math.round(C.max * k));  // 강약
      // (HARD · SUPER HARD: a note may come while the note before is held — half a beat after it began at the least)
      if (a >= 0) { const d = lv >= 2 && all[a].len ? Math.min(n.st - all[a].st - S / 2 + gap, n.st - all[a].st) : n.st - all[a].st - all[a].len; if (d < gap || (all[a].g !== n.g && d < C.rest)) return false; }
      if (b < all.length) { const d = all[b].st - n.st - n.len; if (d < gap || (all[b].g !== n.g && d < C.rest)) return false; }
      for (let j = a; j >= 0 && n.st - all[j].st < C.win; j--) if (on[j]) near.unshift(all[j].st);
      for (let j = b; j < all.length && all[j].st - n.st < C.win; j++) if (on[j]) near.push(all[j].st);
      for (let j = 0; j + max < near.length; j++) if (near[j + max] - near[j] < C.win) return false;
      return true;
    };
    for (const n of order) if (!on[n.i] && fits(n.i)) on[n.i] = 1;
  }
  return on;
  };
  let on = thin();
  if (music) {  // 폭타 중 롱노트는 안 나오게 (user 2026-11-27): a long note with GAME_BURST single notes in the 2 beats before it
    // or after it is in the middle of a burst — there it is a single note too, and the level is worked out again
    // (a few rounds: the notes that come into a freed stretch can make the next long note one of a burst)
    for (let round = 0, any = true; any && round < 4; round++) {
    any = false;
    all.forEach((n, i) => {
      if (!on[i] || !n.len || (n.kind === 2 && !n.p)) return;
      let before = 0, after = 0;
      for (let j = i - 1; j >= 0 && n.st - all[j].st <= 2 * S; j--) if (on[j] && !all[j].len) before++;
      for (let j = i + 1; j < all.length && all[j].st - n.st - n.len <= 2 * S; j++) if (on[j] && !all[j].len && all[j].st > n.st + n.len) after++;
      if (before >= GAME_BURST || after >= GAME_BURST) { n.len = 0; if (n.kind === 2) n.kind = 3; any = true; }
    });
    if (any) on = thin();
    }
  }
  const kept = all.filter(n => on[n.i]);
  let ln = -1;  // the first note played of its line gets the line's two keys
  for (const n of kept) if (n.kind === 1) { n.head = n.line !== ln; ln = n.line; }
  if (kept.length && !music) {  // the beat itself where there is nothing else (no note and no long note within a beat) — not with GAME_MUSIC
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
      if (over ? !(level >= 1 && feel && (mod(st, S) === 0 ? accOf(st) >= (level >= 3 ? 3 : 4) : level >= 3 && movOf(st) >= 6) && (level > 1 || mod(Math.floor(st / S), 2) === 0)) : lend >= st - S) continue;  // (어려움: every 2nd beat)
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
  const notes = [], lint = {moved: 0, cut: 0, kept: 0, lanes: [0, 0, 0, 0], by: [0, 0, 0, 0]};  // by: the beat · sung · where nobody sings · the music
  const last = [0, 1, 2, 3].map(() => ({end: -1e9, a: 0, q: 0, two: false}));
  const bad = (l, st) => {  // (two: a key of two at once is never played again a quarter beat later — guide §12 [12])
    const L = last[l], d = st - L.end;
    return d <= 0 || (d < 2 && (level < 3 || L.q >= 2 || L.two)) || (d <= 2 && (L.a >= GAME_ANCHOR[level] || (L.two && level < 2)));
  };
  const put = (n, lane, t, pair = -1) => {  // pair: the other key of two at once
    const L = last[lane], d = n.st - L.end;
    L.a = d <= 2 ? L.a + 1 : 1; L.q = d < 2 ? L.q + 1 : 1; L.end = n.st + n.len; L.two = pair >= 0;
    lint.lanes[lane]++;
    notes.push({t, e: n.len ? gameStepTime(ch, n.st + n.len) + off : t, lane, line: n.line, ok: n.ok, fill: n.fill, long: !!n.len, pair});
  };
  if (music) {  // GAME_RUNS: which notes are two keys at once, then the key of every single note by its pattern
    let cSt = -1e9, pSt = -1e9, cN = 0;
    kept.forEach((n, i) => {
      n.two = false;
      if (n.kind !== 2 && !n.len) {
        const next = i + 1 < kept.length ? kept[i + 1].st : 1e9;
        // (where the words come back the beat need not be hit as hard: a chorus that is a wall of sound has few hard hits)
        let t2 = (accOf(n.st) >= acc2 - (strong(n.st) >= GAME_HOOK ? 2 : 0) || (level >= 4 && mod(n.st, S) === S / 2 && +hit[n.st] >= 6))  // (EXTREME: on a hard half beat too)
          && lvlOf(n.st) > 5 && strong(n.st) >= GAME_PAIR;
        if (t2 && (level === 0 ? n.st - pSt < S && next - n.st < S : level < 3 && n.st - cSt < [S, S, S / 2][level])) t2 = false;
        if (t2) { if (n.st - cSt > 8 * S) cN = 0; n.two = true; n.ci = cN++ % GAME_PAIRS.length; cSt = n.st; }
      }
      pSt = n.st;
    });
    const single = n => n && !n.two && !n.len && n.kind !== 2 && !n.drop;
    kept.forEach((n, i) => {  // a single note between two pairs half a beat apart [14]
      const a = kept[i - 1], b = kept[i + 1];
      if (!single(n) || !a || !b || !a.two || !b.two || b.st - a.st > S / 2) return;
      if (a.ci >= 4) n.drop = true; else n.rl = (a.ci < 2 ? [0, 3] : [1, 2])[mod(Math.floor(n.st / S), 2)];
    });
    const runs = [];
    let run = [];
    for (let i = 0; i <= kept.length; i++) {
      const n = kept[i];
      if (n && n.drop) continue;
      if (n && single(n) && n.rl == null && run.length && n.st - run[run.length - 1].st <= S / 2) { run.push(n); continue; }
      if (run.length) runs.push({ns: run, next: n && n.two && n.st - run[run.length - 1].st <= S / 2 ? n : null});
      run = n && single(n) && n.rl == null ? [n] : [];
    }
    let walk = 0, grp = 0, rn = 0;
    const short = [0, 0];
    let trill = 0;
    for (const r of runs) {
      let ns = r.ns;
      // a quarter-beat run ends on the beat or the half beat [1]
      if (ns.length > 2 && ns[ns.length - 1].st - ns[ns.length - 2].st === 1 && mod(ns[ns.length - 1].st, 2) === 1 && ns[ns.length - 1].kind === 3 && !r.next) {
        ns[ns.length - 1].drop = true; ns = ns.slice(0, -1);
      }
      if (ns.length === 1) { ns[0].rl = GAME_WALK[Math.floor(walk / 8) % GAME_WALK.length][walk % 4]; walk++; continue; }
      const L = ns.length, ps = ns.map(n => n.p), has = ps.filter(Boolean).length;
      let lanes = null;
      if (L >= 3 && has >= L * 0.75) {  // the tune: one way · up and down · two pitches to and fro [4] — else it counts as none [5]
        const q = ps.map((p, i) => p || ps.slice(0, i).reverse().find(Boolean) || ps.find(Boolean));
        const d = q.slice(1).map((p, i) => Math.sign(p - q[i])), u = [...new Set(q)].sort((x, y) => x - y);
        const wide = u[u.length - 1] - u[0] > 2, ups = d.filter(x => x > 0).length, downs = d.filter(x => x < 0).length;
        const top = q.indexOf(u[u.length - 1]);
        if (u.length === 2 && d.every(x => x)) { const tr = trill++ % 2 ? [0, 3] : [1, 2]; lanes = q.map(p => tr[p === u[0] ? 0 : 1]); }  // F J · D K in turn
        else if (wide && ups >= 2 && !downs) lanes = q.map((_, i) => mod(i + (L <= 4 ? 4 - L : 0), 4));
        else if (wide && downs >= 2 && !ups) lanes = q.map((_, i) => mod(3 - i - (L <= 4 ? 4 - L : 0), 4));
        else if (wide && top > 0 && top < L - 1 && d.slice(0, top).every(x => x >= 0) && d.slice(top).every(x => x <= 0)) lanes = q.map((_, i) => mod(3 - Math.abs(i - top), 4));
      }
      if (!lanes) {  // no tune: fours of GAME_GROUPS; the four that lands on a pair fits it [12]; every other run left ↔ right [11]
        const flip = rn++ % 2 === 1, land = r.next ? GAME_LAND[GAME_PAIRS[r.next.ci].join(",")] : null;
        lanes = [];
        if (L < 4) lanes = land ? land.slice(4 - L) : GAME_SHORT[L - 2][short[L - 2]++ % GAME_SHORT[L - 2].length];  // (its own round: every key gets its share)
        else {
          const tail = land ? ((L - 1) % 4) + 1 : 0;  // notes of the landing four (its last ones)
          for (let k = 0; k < L - tail; k += 4) { const g = GAME_GROUPS[grp++ % GAME_GROUPS.length]; for (let j = 0; j < 4 && k + j < L - tail; j++) lanes.push(flip ? 3 - g[j] : g[j]); }
          if (tail) lanes.push(...land.slice(4 - tail));
        }
        // a fill: the run ends in the last beat of a bar → its last notes are a stair into the next bar [6]
        const end = ns[L - 1].st, m = Math.min(4, L);
        if (!land && L >= 3 && mod(end - BAR0, BAR) >= BAR - S) {
          const up = strong(end + S) >= strong(ns[0].st);
          for (let j = 0; j < m; j++) lanes[L - m + j] = up ? 4 - m + j : m - 1 - j;
        }
      }
      ns.forEach((n, i) => { n.rl = lanes[i]; });
    }
  }
  let heldN = 0, prevSt = -1e9, prevEnd = -1e9, prevKind = -1, chordSt = -1e9, chordN = 0;
  kept.forEach((n, i) => {
    if (n.drop) return;  // left out by its pattern (GAME_RUNS)
    if (n.st === prevSt) return;  // (never a third key on a step)
    let lane;
    if (n.fill) {
      const b = mod(Math.floor(n.st / S), 4);
      lane = mod(n.st, S) === 0 ? BEAT_LANE[b] : OFF_LANE[b];
    } else if (n.kind === 2 && !n.p) {
      if (n.st - prevEnd > 2 * S || prevKind !== 2) heldN = 0;  // each stretch starts the round again
      lane = HELD_LANE[heldN++ % 4];
    } else lane = n.rl != null ? n.rl : laneOf(n);
    const hl = !n.len && !n.fill ? last.findIndex(L => L.end > n.st) : -1;  // a key is being held: the other hand plays this note
    if (hl >= 0 && (lane < 2) === (hl < 2)) lane = 3 - lane;
    if (n.over) {  // during a long note: the other hand's two keys in turn
      const h = last.findIndex(L => L.end >= n.st);
      lane = (h >= 0 && h < 2 ? [2, 3] : [1, 0])[mod(Math.floor(n.st / S), 2)];
    }
    const t = gameStepTime(ch, n.st) + off;
    if (n.kind !== 2 && !n.len && !n.over) {  // two keys at once (GAME_PAIRS)? — on the beats the song hits hardest
      let two2 = hl >= 0 ? false : music ? n.two : (n.head && level > 0) || (feel ? accOf(n.st) >= acc2 : two && mod(n.st, two) === 0);
      if (two2 && !n.head && !music) {
        const next = i + 1 < kept.length ? kept[i + 1].st : 1e9;
        if (feel && lvlOf(n.st) <= 5) two2 = false;  // a quiet beat
        if (level === 0 ? n.st - prevSt < S && next - n.st < S : level < 3 && n.st - chordSt < [S, S, S / 2][level]) two2 = false;
      }
      if (two2) {
        if (n.st - chordSt > 8 * S) chordN = 0;
        if (music) chordN = n.ci;  // (worked out with the patterns above)
        const [l0, l1] = GAME_PAIRS[chordN % GAME_PAIRS.length];
        if (!bad(l0, n.st) && !bad(l1, n.st) && n.st - last[l0].end >= 2 && n.st - last[l1].end >= 2) {  // (nor right after a note on one of its keys)
          chordN++; chordSt = n.st;
          lint.by[n.fill ? 0 : n.kind]++;
          put(n, l0, t, l1); put({st: n.st, len: 0, line: n.line, ok: n.ok, fill: n.fill}, l1, t, l0);
          prevSt = n.st; prevEnd = n.st; prevKind = n.kind;
          return;
        }
      }
    }
    if (bad(lane, n.st)) {
      const free = [lane ^ 1, 3 - lane, 3 - (lane ^ 1)].find(l => !bad(l, n.st));
      if (free != null) { lane = free; lint.moved++; }
      else if (n.fill) { lint.cut++; return; }
      else lint.kept++;
    }
    lint.by[n.fill ? 0 : n.kind]++;
    put(n, lane, t);
    prevSt = n.st; prevEnd = n.st + n.len; prevKind = n.kind;
  });
  lint.n = notes.length;
  GAME.lint = lint;
  return {beat: true, notes};
}
const gameLevel = () => Math.max(0, Math.min(GAME_LEVELS.length - 1, +store.get("game.level", 1) || 0));
// seconds a note is on screen before its line — 0.2 at the fastest (user 2026-11-27: "최대 속도 더 늘려줘"; it was 0.6)
const gameSpeed = () => Math.max(0.2, Math.min(3, +store.get("game.speed", 1.4) || 1.4));
const gameLag = () => Math.max(-0.5, Math.min(0.3, +store.get("game.lag", 0) || 0));  // 판정 맞추기: + = the notes come later
/* 박자에 맞춰 쳐서 맞추기 (user 2026-11-27: "박자가 판정 라인에 맞춰진 게 아니고 노트가 화면 밖으로 사라지는 거에 맞춰져 있는 거 아님? 뭔가
   많이 박자가 다른데"). A note is drawn on the line at its own time — but that time is the player's clock, and for a
   relayed video the clock is what the site's player reports (Niconico: a value every 0.27 s), which runs behind what
   is heard by an amount this page cannot measure (and a Bluetooth speaker adds its own). So the notes arrived late by
   that much — at a fast note speed that is the distance from the line to the bottom of the screen. The 판정 setting
   moves them, and this finds its value: the listener taps GAME_CAL beats of the playing song; where the taps fall in
   the chart's beats (their mean place round the beat) is the clock's distance from the sound. */
const GAME_CAL = 16;
/* 배경 영상이 비치는 정도 (user 2026-11-27: "뒤에 영상 좀 신경 쓰여서 투명도 조절좀"): 0–100 % in steps of 10, 40 % unless set
   (100 % = the glass as it was before this setting) */
const gameSee = () => { const v = +store.get("game.see", 0.4); return Math.max(0, Math.min(1, isNaN(v) ? 0.4 : v)); };
/* 배경: 이미지 (the song's thumbnail blurred, default) | 영상 (the playing video — video_box.js showVideo) */
const gameBgVideo = () => store.get("game.bg", "image") === "video";
function gameBgShow() {
  const it = SHELL.now, url = !gameBgVideo() && it && hasCover(it) ? coverUrl(it) : "";
  document.body.classList.toggle("gbgimg", !gameBgVideo());
  $("gameBgBtn").textContent = gameBgVideo() ? "영상" : "이미지";
  // the thumbnail drawn small (first 16 × 9, then that onto the 64 × 36 canvas: softer) and darkened — once a song.
  // No css blur: a filter on a screen-sized layer is worked out again whenever the notes above it move (css #gameBg)
  const cv = $("gameBg"), c = cv.getContext("2d");
  if (cv.dataset.u === url) return;
  cv.dataset.u = url;
  c.fillStyle = "#101014"; c.fillRect(0, 0, cv.width, cv.height);
  if (!url) return;
  const im = new Image();
  im.onload = () => {
    if (cv.dataset.u !== url) return;
    const s = document.createElement("canvas"), k = Math.max(16 / im.width, 9 / im.height);
    s.width = 16; s.height = 9;
    s.getContext("2d").drawImage(im, (16 - im.width * k) / 2, (9 - im.height * k) / 2, im.width * k, im.height * k);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    c.drawImage(s, 0, 0, cv.width, cv.height);
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(0, 0, cv.width, cv.height);
  };
  im.src = url;
}
function gameSeeShow() { $("gameDlg").style.setProperty("--gsee", gameSee()); $("gameSee").textContent = Math.round(gameSee() * 100) + "%"; }
const gameLagShow = () => { $("gameLag").textContent = (gameLag() >= 0 ? "+" : "") + Math.round(gameLag() * 1000) + "ms"; };
function gameCalShow(text) {
  $("gameCalBox").hidden = !GAME.cal && !text;
  $("gameCalText").textContent = text || (GAME.cal ? `곡을 들으며 박자에 맞춰 아래 버튼이나 아무 키를 눌러 주세요 — ${GAME.cal.length} / ${GAME_CAL} (Esc = 그만)` : "");
  $("gameCalTap").hidden = !GAME.cal;
}
function gameCalStart() {
  const ch = song && song.sync && song.sync.chart;
  if (GAME.run) return uiAlert("게임 중에는 맞출 수 없습니다.");
  if (!ch || (ch.beats || []).length < 16) return uiAlert("박자 채보가 있는 곡에서만 맞출 수 있습니다.");
  GAME.cal = [];
  if (audio.paused) audio.play();
  gameCalShow();
}
function gameCalTap() {
  if (!GAME.cal || audio.paused) return;
  GAME.cal.push(gameNow());
  if (GAME.cal.length < GAME_CAL) return gameCalShow();
  const bt = song.sync.chart.beats, off = offset || 0, taps = GAME.cal, per = [];
  let sx = 0, sy = 0;
  GAME.cal = null;
  for (const t of taps) {
    let i = 0;
    while (i < bt.length - 2 && bt[i + 1] + off <= t) i++;
    const p = bt[i + 1] - bt[i], ph = (t - bt[i] - off) / p * 2 * Math.PI;
    sx += Math.cos(ph); sy += Math.sin(ph); per.push(p);
  }
  per.sort((x, y) => x - y);
  const p = per[per.length >> 1], even = Math.hypot(sx, sy) / taps.length;
  let d = Math.atan2(sy, sx) / (2 * Math.PI) * p;  // the taps' mean distance from the beat, within half a beat either way
  if (d > 0.1) d -= p;  // (the clock runs behind the sound, not ahead: a tap "after" the beat is one before the next)
  if (even < 0.6) return gameCalShow("누른 박자가 고르지 않아 맞추지 못했습니다 — 다시 해 주세요.");
  store.set("game.lag", Math.round(Math.max(-0.5, Math.min(0.3, d)) * 100) / 100); GAME.cfg = null;
  gameLagShow();
  gameCalShow(`판정을 ${(gameLag() >= 0 ? "+" : "") + Math.round(gameLag() * 1000)}ms 로 맞췄습니다. 어긋나면 − ＋ 로 조금씩 고치세요.`);
}
// in a 같이듣기 room as a guest / in a channel the song can't be moved: the game joins where the song is
const gameCanSeek = () => !(typeof LT !== "undefined" && LT.role && (LT.role === "guest" || LT.chOn));
/* the song's time for the game. audio.currentTime of a relayed video comes in reports and is corrected in small jumps
   (measured ±10–15 ms a few times a second — the notes jerked: user 2026-11-26 "노트 끊김"): the game counts on by the
   screen's own clock and only leans toward the reported time; a real jump (seek · the next report after a stall) is taken at once.
   gameClock: once a frame (moves the clock) · gameNow: between frames (a key press) */
/* 노트 멈칫 (user 2026-11-27: "렉 같은 느낌은 아니고 노트가 내려오다 말고 멈칫 하는 현상이 약간 있음"): the clock above leaned
   6 % a frame toward the player's time — and that time is the last report + the time since it. A report that comes
   late, or twice with the same value (seen on Niconico: 66 ms after the one before, the song's time not moved),
   throws the player's time BACK by that much until the next report; the game's clock followed it down and up again
   — the notes slowed for a quarter of a second and caught up. Now the game's clock is the screen's own clock plus one
   number, how far the song is ahead of it (GAME.off). Every report is one reading of that number, and a reading can
   only be too LOW (a report is late, never early) — so the number is the highest of the last 12 readings (3 s), moved
   toward by 2 ms a frame at most. Between reports the clock does not look at the player's time at all.
   A reading 0.3 s or more off twice in a row = the song was moved: taken at once. */
const gameRate = () => audio.playbackRate || 1;
function gameNow() {
  if (GAME.off == null || audio.paused) return audio.currentTime;
  return performance.now() / 1000 * gameRate() + GAME.off;
}
function gameClock() {
  if (audio.paused || GAME.rate !== gameRate()) { GAME.off = null; GAME.rate = gameRate(); }
  if (GAME.off == null) {
    if (audio.paused) return audio.currentTime;
    GAME.off = GAME.offTo = audio.currentTime - performance.now() / 1000 * gameRate(); GAME.offs = [GAME.off]; GAME.offJump = 0;
  }
  GAME.off += Math.max(-0.002, Math.min(0.002, (GAME.offTo - GAME.off) * 0.1));
  return performance.now() / 1000 * gameRate() + GAME.off;
}
audio.addEventListener("timeupdate", () => {  // one report of the song's time = one reading
  if (!GAME.run || audio.paused || GAME.off == null) return;
  const o = audio.currentTime - performance.now() / 1000 * gameRate();
  if (Math.abs(o - GAME.offTo) > 0.3) {
    if (++GAME.offJump < 2) return;
    GAME.off = GAME.offTo = o; GAME.offs = [o]; GAME.offJump = 0;
    return;
  }
  GAME.offJump = 0;
  GAME.offs.push(o);
  if (GAME.offs.length > 12) GAME.offs.shift();
  GAME.offTo = Math.max(...GAME.offs);
});
for (const ev of ["seeked", "pause", "sourcechange"]) audio.addEventListener(ev, () => { GAME.off = null; });
/* 곡이 끝나면 (user 2026-11-27: "리듬게임 모드 중에서는 한 곡 재생 끝나면 그대로 멈추고 다음 곡 넘어가지도 않아야 됨 — 다시 하기 누르면
   방금 했던 곡 다시 시작"): while the game's window is open the player does not go on to the next song at the end of
   one (play_engine.js onEnd asks SHELL.gameHold) — it was the next song that 다시 하기 then started. A game still
   running when the song ends is over. Not as a 같이듣기 guest / in a channel: the song is not this player's to hold. */
SHELL.gameHold = () => GAME.on && gameCanSeek();
audio.addEventListener("ended", () => { if (GAME.on && GAME.run && gameCanSeek()) { gameStop(); gameEnd(); } });

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
  document.body.classList.add("gameon");  // (phone: the video behind is drawn small and enlarged — css)
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
  GAME.keyset = null; gameKeysShow(); gameSeeShow(); gameBgShow();
  const nl = g.notes.filter(n => n.long).length;
  const info = g.beat ? `${ch.bpms ? ch.bpms.map(Math.round).join("–") : Math.round(ch.bpm)} BPM · 노트 ${g.notes.length.toLocaleString()}개${nl ? ` (롱노트 ${nl}개)` : ""} · 채보 일치 ${Math.round((ch.score || 0) * 100)}%`
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
  $("gameJudge").className = "gjudge"; $("gameJudge").textContent = "";
  GAME.cfg = null; GAME.box = null; GAME.say = null; GAME.dirty = false;
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
  el.style.transform = `scaleY(${Math.max(0, Math.min(100, v)) / 100})`;
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
  GAME.cfg = null; GAME.box = null; GAME.say = null; GAME.dirty = true; gameFlush(true);
  GAME.run = true; GAME.startAt = performance.now(); GAME.off = null;
  document.body.classList.add("grun");  // (css: no blur while the notes move)
  GAME.last = g.notes.reduce((m, n) => Math.max(m, n.e), 0);
  cancelAnimationFrame(GAME.raf);
  GAME.raf = requestAnimationFrame(gameFrame);
}
function gameStop() { GAME.run = false; cancelAnimationFrame(GAME.raf); document.body.classList.remove("grun"); }
function gameClose() { gameStop(); GAME.on = false; document.body.classList.remove("gameon"); if ($("gameDlg").open) $("gameDlg").close(); showVideo(); gameComments(true); }
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
/* 노트 끊김 (user 2026-11-27: "리듬게임 중 노트가 중간중간 끊기는 현상 — 프로그램이 웹에서 돌아가기에 무거운 건 맞는데 그 와중에 노트
   자체는 안 끊기게 하는 방법을 찾아야 · 브라우저 화면 공유를 하면 훨씬 많이 끊긴다"). What the game itself did to the page
   while the notes move, and what it does now:
   · every hit rebuilt the judgement in the page and made the browser lay the whole window out again on the spot (to
     restart its pop), and every frame asked for the canvas's size, which lays it out once more when a hit has just
     changed the page — ten hits a second = ten to twenty forced layouts a second, each a frame that comes late
       → the judgement · percent · FAST / SLOW · combo are drawn on the notes' own canvas (gameDraw), the page is
         not touched by a hit; the canvas's size is measured when it changes (GAME.box), not every frame
   · score · 정확도 · 게이지 were written at every hit → at most 8 times a second (gameFlush); the gauge moves by a
     transform, which costs no layout
   · speed · 판정 · the keys were read from the browser's storage several times a frame → once (gameCfg), again
     when a setting is clicked
   · the lyrics behind the window went on following the song (4 times a second) → not while a game runs
     (lyrics_view.js tickTimer)
   · the canvas is drawn at 1.5 dots a pixel at most (was 2) — fewer dots to fill and to put on screen
   The notes' place is worked out from the clock, not counted in frames: a late frame shows them where they should be,
   it does not slow them. Not measured in frames a second (the test pane draws none). */
function gameSay(text, cls, pct, early) {
  GAME.judged = {text, at: performance.now()};
  GAME.say = {text, cls, pct, early, combo: GAME.stat.combo, at: performance.now()};
}
function gameScoreUp() { GAME.dirty = true; }
function gameFlush(force) {  // score · 정확도 · 게이지 onto the page, not more often than 8 times a second
  const t = performance.now();
  if (!GAME.dirty || (!force && t - (GAME.flushAt || 0) < 125)) return;
  GAME.dirty = false; GAME.flushAt = t;
  const s = GAME.stat;
  $("gameScore").textContent = s.score.toLocaleString();
  $("gameCombo").textContent = `${gameAcc(s).toFixed(2)}% · MAX ${s.max}`;
  if (GAME.lifeOn) gameLifeShow(s.life);
}
// the settings a frame needs, read once (the browser's storage is slow to ask many times a frame)
const gameCfg = () => GAME.cfg || (GAME.cfg = {speed: gameSpeed(), lag: gameLag(), keys: gameKeys()});
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
  const now = gameNow() - gameCfg().lag, q = GAME.lanes[lane];
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
  if (gameNow() - gameCfg().lag >= n.e - GAME_MISS) { n.done = true; return gameGot(0, lane); }
  n.broke = true;
  gameLost(lane);
}
function gameFrame() {
  if (!GAME.run) return;
  if (song !== GAME.song) {  // the next song came
    GAME.song = song; GAME.cut = GAME.lanes.some((q, l) => GAME.ptr[l] < q.length);
    return song && times ? gameEnd() : gameClose();
  }
  const now = gameClock() - gameCfg().lag;
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
  gameFlush();
  // the line being sung, under the lanes
  let li = -1;
  for (let i = 0; i < times.length; i++) { if (times[i] + (offset || 0) <= now + 0.05) li = i; else break; }
  if (li !== GAME.line) { GAME.line = li; $("gameLyric").textContent = li >= 0 && song.groups[li] ? song.groups[li].orig || "" : ""; }
  gameDraw(now);
  if (now > GAME.last + 2 && performance.now() - GAME.startAt > 3000) return gameEnd();
  GAME.raf = requestAnimationFrame(gameFrame);
}
function gameDraw(now) {
  const cfg = gameCfg();
  GAME.keyLabels = cfg.keys.map(k => k[1]);
  const cv = $("gameCanvas"), box = GAME.box || (GAME.box = cv.getBoundingClientRect()), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const W = Math.max(1, Math.round(box.width * dpr)), H = Math.max(1, Math.round(box.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = GAME.ctx || (GAME.ctx = cv.getContext("2d", {desynchronized: true})), C = GAME.colors, lw = W / 4, jy = H * 0.84, look = cfg.speed, nh = Math.max(10 * dpr, H * 0.022);
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
    const off = offset || 0, bt = ch.beats, barN = ch.bar ? ch.bar[0] : 4, bar0 = ch.bar ? ch.bar[1] : 0;  // (the stronger line = a bar's first beat)
    let i = 0;
    while (i < bt.length && bt[i] + off < now - 0.3) i++;
    for (; i < bt.length && bt[i] + off < now + look; i++) {
      c.globalAlpha = (i - bar0) % barN ? 0.25 : 0.6; c.fillStyle = C.line; c.fillRect(0, y(bt[i] + off) - dpr / 2, W, dpr);
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
    if (n.pair > n.lane && n.hit !== 1) {  // two keys at once: a bar from this note to the other
      c.globalAlpha = n.hit === -1 ? 0.2 : 0.75; c.fillStyle = "#fff";
      c.fillRect(n.lane * lw + lw / 2, yy + nh * 0.36, (n.pair - n.lane) * lw, nh * 0.28);
    }
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
  /* the judgement, in the middle and one under the other (user 2026-11-26): the combo · the judgement's name · how exact ·
     FAST / SLOW — drawn here, on the canvas (it was built in the page at every hit: 노트 끊김 above). It pops in
     (80 ms), stays, and fades out by 0.6 s */
  const sy = GAME.run && GAME.say;
  if (sy && t - sy.at < 600) {
    const age = t - sy.at, k = age < 80 ? 1.25 - 0.25 * age / 80 : 1, cx = W / 2, col = {perfect: C.ok, great: C.a, good: C.muted, miss: "#ff5a5a"}[sy.cls] || C.text;
    const line = (txt, size, yy, color, bold = 900) => {
      c.font = `${bold} ${Math.round(size * dpr * k)}px sans-serif`; c.lineJoin = "round";
      c.lineWidth = Math.max(2, size * dpr * 0.14); c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeText(txt, cx, yy);
      c.fillStyle = color; c.fillText(txt, cx, yy);
    };
    c.globalAlpha = age < 350 ? 1 : 1 - (age - 350) / 250;
    c.textAlign = "center"; c.textBaseline = "middle";
    let yy = H * 0.36;
    if (sy.combo > 1) { line(String(sy.combo), 50, yy, C.text); line("COMBO", 11, yy + 34 * dpr, C.text, 700); yy += 72 * dpr; }
    line(sy.text, 34, yy, col);
    if (sy.pct != null) line(sy.pct + "%", 20, yy + 34 * dpr, col);
    if (sy.early) line(sy.early < 0 ? "FAST" : "SLOW", 12, yy + 58 * dpr, sy.early < 0 ? "#6cb6ff" : "#e0b040", 700);
    c.textBaseline = "alphabetic"; c.globalAlpha = 1;
  }
}
function gameRound(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

$("btnGame").onclick = gameOpen;
// the canvas's size on screen: measured when it changes, not at every frame (노트 끊김)
if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { GAME.box = null; if (GAME.on && !GAME.run) gameDraw(audio.currentTime); }).observe($("gameCanvas"));
addEventListener("resize", () => { GAME.box = null; });
/* 설정 · 신고 (user request 2026-11-26: "난이도를 제외한 나머지 설정들 다 한 버튼으로 새로운 팝업 뜨는 걸로 · 설정 왼쪽에 오류 버그
   신고 버튼 — 새로운 항목 '리듬게임'으로 자동 작성"): the report window opens with the kind 리듬게임, the playing song and
   a first line saying how the game was set (level · speed · 판정 · gauge · the chart) */
$("gameSetBtn").onclick = () => { gameKeysShow(); $("gameSetDlg").showModal(); };
$("gameSetClose").onclick = () => $("gameSetDlg").close();
$("gameSetDlg").addEventListener("close", () => { GAME.keyset = null; gameKeysShow(); GAME.cal = null; gameCalShow(); });
$("gameCal").onclick = () => (GAME.cal ? (GAME.cal = null, gameCalShow()) : gameCalStart());
$("gameCalTap").addEventListener("pointerdown", e => { e.preventDefault(); gameCalTap(); });
$("gameReport").onclick = () => {
  if (GAME.run && !audio.paused && gameCanSeek()) $("btnPlay").click();  // (the game waits while the report is written)
  const ch = song && song.sync && song.sync.chart, lag = Math.round(gameLag() * 1000);
  openReport({kind: "리듬게임", it: SHELL.now || null,
    text: `[${GAME_LEVELS[gameLevel()]} · 속도 ${gameSpeed().toFixed(1)}초 · 판정 ${lag >= 0 ? "+" : ""}${lag}ms · 게이지 ${gameLifeOn() ? "켬" : "끔"} · ${ch ? `채보 v${ch.v} ${Math.round(ch.bpm)} BPM 일치 ${Math.round((ch.score || 0) * 100)}%` : "채보 없음"}]
`});
};
$("gameClose").onclick = gameClose;
$("gameDlg").addEventListener("close", () => { if (!$("gameDlg").open) { gameStop(); GAME.on = false; document.body.classList.remove("gameon"); showVideo(); gameComments(true); } });  // (the event comes later: it may be open again)
$("gameDlg").addEventListener("click", e => {
  GAME.cfg = null;  // (a setting may be about to change — read again at the next frame)
  const l = e.target.closest("#gameLevels button"), sp = e.target.closest("[data-sp]"), lag = e.target.closest("[data-lag]");
  if (l) { store.set("game.level", +l.dataset.l); return gameReady(); }  // another level: from the start screen again
  if (sp) {  // 0.2 s a press, 0.1 s under 0.6 s (the fast end is felt much more)
    const cur = gameSpeed(), d = +sp.dataset.sp, step = cur < 0.6 || (cur <= 0.6 && d > 0) ? 0.1 : 0.2;
    store.set("game.speed", Math.round((cur - step * d) * 10) / 10); $("gameSpeed").textContent = gameSpeed().toFixed(1) + "초";
  }
  if (lag) { store.set("game.lag", Math.round((gameLag() + 0.01 * +lag.dataset.lag) * 100) / 100); $("gameLag").textContent = (gameLag() >= 0 ? "+" : "") + Math.round(gameLag() * 1000) + "ms"; }
  if (e.target.closest("#gameBgBtn")) { store.set("game.bg", gameBgVideo() ? "image" : "video"); gameBgShow(); showVideo(); }
  const see = e.target.closest("[data-see]");
  if (see) { store.set("game.see", Math.round((gameSee() + 0.1 * +see.dataset.see) * 10) / 10); gameSeeShow(); }
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
      if (GAME.keyset.length === 4) { store.set("game.keys", GAME.keyset); GAME.keyset = null; GAME.cfg = null; gameKeysShow(); return gameReady(); }
    }
    return gameKeysShow();
  }
  if ($("gameSetDlg").open && GAME.cal) {  // 박자에 맞춰 치기: every key is a tap
    e.preventDefault();
    if (e.key === "Escape") { GAME.cal = null; gameCalShow(); } else if (!e.repeat) gameCalTap();
    return;
  }
  if ($("gameSetDlg").open) {  // 설정 창: Esc closes it (not the game), no key plays
    if (e.key === "Escape") { e.preventDefault(); $("gameSetDlg").close(); }
    return;
  }
  if (e.key === "Escape") { e.preventDefault(); return gameClose(); }
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat && GAME.run) $("btnPlay").click(); return; }
  if (e.key === "Enter" && !GAME.run) { e.preventDefault(); return gameStart(); }
  const lane = gameCfg().keys.findIndex(k => k[0] === e.code);
  if (lane >= 0) { e.preventDefault(); if (!e.repeat) gameHit(lane); }
}, true);
window.addEventListener("keyup", e => {
  if (!GAME.on) return;
  const lane = gameCfg().keys.findIndex(k => k[0] === e.code);
  if (lane >= 0) gameUp(lane);
}, true);
