/* 곡 필터: 판정(FKIND)·카테고리 만들기·그룹 판정 — 플레이어(player_screen.js)와 음원 관리 '싱크 만들기'(sync_filter_panel.js)가 같이 씀
   그룹 [{x: 제외 그룹, c: [{k: 종류, v: 값 또는 [값, …](그중 하나라도 — 여러 개를 한꺼번에 고른 조건)}]}]:
   그룹 안 조건은 모두 맞아야(교집합), 포함 그룹끼리는 하나라도 맞으면(합집합),
   제외 그룹의 조건에 모두 맞는 곡은 빠짐 (shared_screen_helpers.js 의 fold·shortName 을 씀) */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", CHO_BASE = {"ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ"};
const INITIALS = [..."ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0-9", "기호"];
/* 제목 첫 글자 → 초성(된소리는 예사소리로) / 영문 대문자 / 0-9 / 기호 (보카로 가사 위키 색인과 같은 나눔) */
function initialOf(title) {
  const c = (title || "").trim().normalize("NFKC")[0] || "";
  const code = c.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) { const ch = CHO[Math.floor((code - 0xAC00) / 588)]; return CHO_BASE[ch] || ch; }
  if (CHO.includes(c)) return CHO_BASE[c] || c;
  if (/[a-z]/i.test(c)) return c.toUpperCase();
  if (/[0-9]/.test(c)) return "0-9";
  return "기호";
}
/* "하츠네 미쿠 , KAITO" / "Neru & z'5" → 사람별로 */
const people = s => (s || "").split(/\s*(?:,|，|、|&|＆|\/)\s*/).map(x => x.trim()).filter(Boolean);
/* 보컬 인원수 (user request 2026-11-14): 보컬 칸의 사람 수 그대로 — 태그가 아님. 5명부터는 '5+' 하나 (보컬이 없는 곡은 값 없음) */
const VCOUNT_MAX = 5;
const vcountOf = it => { const n = (it._singers || []).length; return !n ? "" : n >= VCOUNT_MAX ? VCOUNT_MAX + "+" : String(n); };
function prepItem(it) {
  it._ini = initialOf(it.title);
  it._singers = people(it.singer);
  it._composers = people(it.composer);
  it._year = /^\d{4}/.test(it.date || "") ? it.date.slice(0, 4) : "";
}
/* 곡 상태 (user request 2026-11-15: 싱크 · 가사 유무 · 번역명도 태그처럼 필터에) — 코드가 정하는 태그. 순서 = 목록 순서.
   규칙은 음원 관리 › 필터 › 하위 태그에 보임 (vocadb/filter_settings.py FLAGS 와 같음) */
const FLAGS = ["싱크 있음", "싱크 없음", "우리 가사 있음", "VocaDB 가사 있음", "가사 없음", "한글 제목 있음", "한글 제목 없음", "보컬 15명 넘음"];
/* 보컬이 너무 많은 곡 (user request 2026-11-16, e.g. 合音声大決闘戦): 보컬은 앞 VOCAL_SHOW 명만 보이고 나머지는 '+N' 칩 —
   그 칩은 곡 상태 태그 MANY_VOCALS 의 색 (필터 › 하위 태그에서 색 지정) */
const VOCAL_SHOW = 15, MANY_VOCALS = "보컬 15명 넘음";
/* vdbLyrics: VocaDB 에 원문 가사 (data.lyrics = Y) · koTitle: 한글 제목이 있고 원제와 다름 */
function songFlags(it, vdbLyrics, koTitle) {
  return [it.sync === "ok" ? "싱크 있음" : "싱크 없음", ...(it.lyrics ? ["우리 가사 있음"] : []), ...(vdbLyrics ? ["VocaDB 가사 있음"] : []),
          ...(!it.lyrics && !vdbLyrics ? ["가사 없음"] : []), koTitle ? "한글 제목 있음" : "한글 제목 없음",
          ...(people(it.singer).length > VOCAL_SHOW ? [MANY_VOCALS] : [])];
}
/* 보컬 종류 (user request 2026-11-16): data.vocal_kind (VocaDB 보컬의 artistType) — 엔진 · 섞임(엔진 + 사람) · 사람 · 정보 없음 (빈칸).
   사람 원곡을 엔진으로 부른 커버와 가르려고 (예: 튜링러브 원곡은 사람, 커버는 엔진). 순서 = 목록 순서 */
const VKINDS = ["엔진", "섞임", "사람", "정보 없음"];
const vkindOf = it => it.vkind || "정보 없음";
/* 같은 곡 (user request 2026-11-16): 원곡과 그 커버·리믹스 … 는 한 곡 — VocaDB originalVersionId (data.original_id → it.origId) 를
   따라 올라간 맨 위 곡이 그 묶음. 커버곡은 같은 노래가 많아서, 그룹의 다른 조건에 맞는 곡들을 같은 곡끼리 '같은 곡 정렬'
   순서로 세우고 '같은 곡 자르기' n 곡만 남김 (예: 사람이 부른 원곡은 보컬 종류 조건에서 빠지고 그 엔진 커버 중 재생되고
   인기 있는 한 곡만). 정렬 값은 고른 순서가 우선순위 · 정렬만 고르면 1곡 · 자르기만 고르면 SAME_SORTS 순서.
   그룹마다 따로 (그룹끼리 합치고 빼는 건 그 뒤) — filterGroups. 끝까지 같으면 VocaDB 번호가 작은(먼저 등록된) 곡 */
/* 긴 버전 먼저 (user request 2026-11-17): VocaDB 'short version' 태그 곡(광고·TV 사이즈 …)은 같은 곡 중 맨 뒤 —
   Tell Your World 는 원곡이 61초 광고판이고 풀버전은 그 리믹스('extended version') */
/* 원작자 먼저 (user request 2026-11-18: '그 곡의 가장 원조인 보카로 버전'): 묶음 맨 위 곡(원곡)의 프로듀서가 참여한 버전 먼저 —
   원곡이 짧은 버전이면 원작자의 긴 버전(소실 리마스터), 사람 원곡이면 원작자가 낸 보카로 버전. 그다음 '먼저 나온 순'이면
   원작자 버전 중 가장 먼저 나온 것 (작곡가가 나중 버전에만 참여했어도 그 버전들끼리 차례) */
const SAME_SORTS = ["재생 가능", "긴 버전 먼저", "원작자 먼저", "원곡 먼저", "인기순", "먼저 나온 순"];
const isShortVer = it => (it.tags || []).includes("short version");
const SAME_CUTS = ["1", "2", "3", "5", "10"];
var samePlayable = it => (it.sources || []).length > 0;  // 플레이어는 canPlay 로 바꿈
const SAME_KEYS = ["same_sort", "same_cut"];
const dateKey = it => it.date || "9999";
const SAME_CMP = {
  "재생 가능": (a, b) => (samePlayable(b) ? 1 : 0) - (samePlayable(a) ? 1 : 0),
  "긴 버전 먼저": (a, b) => (isShortVer(a) ? 1 : 0) - (isShortVer(b) ? 1 : 0),
  "원작자 먼저": (a, b) => (b._own ? 1 : 0) - (a._own ? 1 : 0),
  "원곡 먼저": (a, b) => (a.origId ? 1 : 0) - (b.origId ? 1 : 0),
  "인기순": (a, b) => (b.rating || 0) - (a.rating || 0),
  "먼저 나온 순": (a, b) => dateKey(a) < dateKey(b) ? -1 : dateKey(a) > dateKey(b) ? 1 : 0,
};
const sameNo = it => +(it.vocadb || 0) || 1e12;
/* 제목 비교용: 글자·숫자만 */
const looseTitle = s => String(s || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const titleSet = it => [it.def, it.ja, it.en, ...String(it.alt || "").split(",")].map(looseTitle).filter(Boolean);
/* 같은 노래인가 (user request 2026-11-18): VocaDB 는 답가·패러디도 원곡 번호로 이음 (アドレサンス → サンドリヨン, 弱音ハクの消失 →
   初音ミクの消失) — 한쪽 이름이 다른 쪽 이름 안에 들어 있어야 같은 노래 ('初音ミクの消失' ↔ '初音ミクの消失 -DEAD END-') */
function sameSong(it, up) {
  const a = titleSet(it), b = titleSet(up);
  const has = (x, y) => y.length > 1 ? x.includes(y) : x === y;
  return !a.length || !b.length || b.some(t => a.some(s => has(s, t) || has(t, s)));
}
/* 같은 곡 묶음 열쇠: 원곡 번호를 목록 안에서 끝까지 따라 올라가, 이 곡과 같은 노래인 가장 위 곡 (アドレサンス 의 커버 →
   アドレサンス, サンドリヨン 아님 · '初音ミクの消失 (Hommarju Remix)' → '-DEAD END-' 를 지나 初音ミクの消失). 바로 위 원곡이
   목록에 없으면 그 번호 — 형제 커버끼리는 같이 묶임 */
function sameFam(it, byId) {
  const self = String(it.vocadb || it.name), seen = new Set([self]);
  let best = self, o = it.origId;
  for (let i = 0; o && i < 20 && !seen.has(String(o)); i++) {
    const id = String(o), p = byId.get(id);
    seen.add(id);
    if (!p) { if (!i) best = id; break; }
    if (sameSong(it, p)) best = id;
    o = p.origId;
  }
  return best;
}
const sameIds = new WeakMap();  // 목록(배열) → {VocaDB 번호: 곡}
const peopleSet = s => new Set(String(s || "").split(/\s*[,，、&＆/]\s*/).map(x => x.trim()).filter(Boolean));
/* 묶음 열쇠는 곡마다 한 번만 (it._fam — 곡 데이터를 다시 읽으면 곡도 새로 만들어짐) · it._own: 묶음 맨 위 곡의 프로듀서가 참여 */
function sameKeyOf(it, its) {
  if (it._fam !== undefined) return it._fam;
  if (!it.origId) { it._own = true; return it._fam = String(it.vocadb || it.name); }
  let byId = sameIds.get(its);
  if (!byId) sameIds.set(its, byId = new Map(its.filter(it => it.vocadb).map(it => [String(it.vocadb), it])));
  const fam = sameFam(it, byId), root = byId.get(fam);
  const rp = root ? peopleSet(root.composer) : null;
  it._own = root === it || (!!rp && [...peopleSet(it.composer)].some(p => rp.has(p)));
  return it._fam = fam;
}
function sameSpec(g) {
  const s = g.c.find(c => c.k === "same_sort"), n = g.c.find(c => c.k === "same_cut");
  if (!s && !n) return null;
  const keys = (s ? [].concat(s.v) : SAME_SORTS).filter(k => SAME_CMP[k]);
  return {cut: n ? parseInt(firstV(n), 10) || 1 : 1, cmp: (a, b) => { for (const k of keys) { const d = SAME_CMP[k](a, b); if (d) return d; } return sameNo(a) - sameNo(b); }};
}
function sameCut(m, g, its) {
  const sp = sameSpec(g); if (!sp) return m;
  const fam = new Map();
  for (const it of m) { const k = sameKeyOf(it, its); fam.has(k) ? fam.get(k).push(it) : fam.set(k, [it]); }
  const keep = new Set();
  for (const xs of fam.values()) (xs.length > sp.cut ? xs.sort(sp.cmp).slice(0, sp.cut) : xs).forEach(x => keep.add(x));
  return m.filter(it => keep.has(it));
}
/* sameCut 을 나눠서 (tick: chunkFilter 와 같음) */
async function sameCutAsync(m, g, its, tick) {
  const sp = sameSpec(g); if (!sp) return m;
  const fam = new Map();
  for (let i = 0; i < m.length; i++) {
    if (!(i & 1023)) await tick();
    const it = m[i], k = sameKeyOf(it, its);
    fam.has(k) ? fam.get(k).push(it) : fam.set(k, [it]);
  }
  const keep = new Set();
  let i = 0;
  for (const xs of fam.values()) {
    if (!(++i & 2047)) await tick();
    (xs.length > sp.cut ? xs.sort(sp.cmp).slice(0, sp.cut) : xs).forEach(x => keep.add(x));
  }
  return chunkFilter(m, it => keep.has(it), tick);
}
/* 곡 목록 → 필터를 지난 곡 (passGroups 와 같고 같은 곡 조건까지) — 순서는 그대로 */
function filterGroups(its, groups) {
  if (!groups.some(g => g.c.some(c => SAME_KEYS.includes(c.k)))) return its.filter(it => passGroups(it, groups));
  const gs = groups.filter(g => g.c.some(c => FKIND[c.k])), set = g => new Set(sameCut(its.filter(it => g.c.every(c => matchCond(it, c))), g, its));
  const inc = gs.filter(g => !g.x).map(set), exc = gs.filter(g => g.x).map(set);
  return its.filter(it => (!inc.length || inc.some(s => s.has(it))) && !exc.some(s => s.has(it)));
}
/* 나눠 하기 (user request 2026-11-16: 필터를 바꿀 때마다 화면이 잠깐 멈춤) — 2000곡마다 tick: 가끔 화면에 차례를 넘기고,
   더 새 검색이 시작됐으면 던져서 그만둠 (플레이어 runSearch) */
async function chunkFilter(its, f, tick) {
  const out = [];
  for (let i = 0; i < its.length; i += 2000) {
    if (tick) await tick();
    for (let j = i, e = Math.min(i + 2000, its.length); j < e; j++) if (f(its[j])) out.push(its[j]);
  }
  return out;
}
/* filterGroups 와 같은 결과를 나눠서 */
async function filterGroupsAsync(its, groups, tick) {
  if (!groups.some(g => g.c.some(c => SAME_KEYS.includes(c.k)))) return chunkFilter(its, it => passGroups(it, groups), tick);
  const sets = [];
  for (const g of groups.filter(g => g.c.some(c => FKIND[c.k])))
    sets.push([g.x, new Set(await sameCutAsync(await chunkFilter(its, it => g.c.every(c => matchCond(it, c)), tick), g, its, tick))]);
  const inc = sets.filter(s => !s[0]).map(s => s[1]), exc = sets.filter(s => s[0]).map(s => s[1]);
  return chunkFilter(its, it => (!inc.length || inc.some(s => s.has(it))) && !exc.some(s => s.has(it)), tick);
}
/* 같은 곡 카테고리 (값이 정해져 있음 — 곡 수 없음) */
const sameCats = () => [{id: "same_sort", label: "같은 곡 정렬", k: "same_sort", rows: SAME_SORTS.map(v => [v, ""]), lab: v => v},
                        {id: "same_cut", label: "같은 곡 자르기", k: "same_cut", rows: SAME_CUTS.map(v => [v, ""]), lab: v => `상위 ${v}곡`}];
const KARA_RE = /^(TJ|금영|DAM|UGA|JOYSOUND)$/;
const STATES = {lyrics: "가사 있음", nolyrics: "가사 없음", ok: "싱크됨", need: "싱크 필요", stale: "싱크 다시", resync: "재싱크 필요", fail: "싱크 실패",
                "src:namu": "나무위키 가사", "src:vocaro": "VL 가사", "src:own": "직접 넣은 가사", "src:link": "연결 가사"};
const FKIND = {
  // fold drops spaces (user request: no-space query matches) — fields joined by "" so a match never spans two fields
  text: ["검색", (it, v) => [...Object.values(it.nums || {}), it.title, it.kara_title, it.orig, it.ja, it.reading, it.en, it.alt, it.artist, it.singer, it.name].map(fold).join("").includes(fold(v))],
  ini: ["가나다", (it, v) => it._ini === v],
  singer: ["보컬", (it, v) => it._singers.includes(v)],
  solo: ["솔로", (it, v) => it._singers.length === 1 && it._singers[0] === v],
  vcount: ["인원수", (it, v) => vcountOf(it) === v],
  vkind: ["보컬 종류", (it, v) => vkindOf(it) === v],
  same_sort: ["같은 곡 정렬", () => true],  // 곡 하나로는 안 정함 — filterGroups 가 그룹 단위로
  same_cut: ["같은 곡 자르기", () => true],
  flag: ["곡 상태", (it, v) => (it.flags || []).includes(v)],
  song: ["곡", (it, v) => String(it.vocadb || it.name) === v],  // 그 곡 자체 (user request 2026-11-14: 검색 결과의 '필터에 추가') — v: VocaDB 번호
  composer: ["프로듀서", (it, v) => it._composers.includes(v)],
  kara: ["노래방", (it, v) => (it.tags || []).includes(v)],
  tag: ["태그", (it, v) => (it.tags || []).includes(v)],
  cat: ["나무위키", (it, v) => (it.categories || []).includes(v)],
  year: ["년도", (it, v) => it._year === v],
  state: ["상태", (it, v) => v.startsWith("src:") ? it.lyrics === v.slice(4)
    : v === "lyrics" ? !!it.lyrics : v === "nolyrics" ? !it.lyrics : v === "ok" ? it.sync === "ok"
    : v === "need" ? (it.site === "stream" ? !!(it.karaoke && it.sync !== "ok") : !!(it.lyrics && it.sync !== "ok")) : v === "stale" || v === "resync" ? it.sync === v : v === "fail" ? !!it.sync_fail : false],
};
/* 태그 → 그 분류 이름 (장르·테마 …) — 플레이어가 우리 DB 의 master 로 정함 (player_screen.js). 태그 이름에 ':' 가 있어도 그대로 이름
   (VocaDB 태그 'Persona 5: …' 등 — 예전 스트리밍 '분류:이름' 형식은 이제 없음) */
var tagGroupOf = v => "";
/* 조건 칩 앞 작은 글자: 종류 (태그는 그 분류) */
const firstV = c => Array.isArray(c.v) ? c.v[0] || "" : c.v;
const chipKind = c => c.k === "tag" && tagGroupOf(firstV(c)) || FKIND[c.k][0];
/* 곡 조건의 값(VocaDB 번호) → 제목 — 플레이어가 우리 DB 로 정함 (player_screen.js) */
var songTitleOf = v => v;
const oneLabel = (k, v) => k === "same_cut" ? `상위 ${v}곡` : k === "vcount" ? vcountLabel(v) : k === "song" ? songTitleOf(v) : k === "flag" || k === "vkind" || k === "same_sort" ? v : k === "tag" ? v : k === "year" ? v + "년" : k === "state" ? STATES[v] || v
  : k === "kara" && (v === "한국" || v === "일본") ? v + " 전체" : shortName(v);
const vcountLabel = v => v.endsWith("+") ? `${parseInt(v)}인 이상` : v + "인";
const chipLabel = c => c.k === "song" && Array.isArray(c.v) && c.v.length > 2 ? `${c.v.slice(0, 2).map(v => oneLabel(c.k, v)).join(", ")} 외 ${c.v.length - 2}곡`
  : Array.isArray(c.v) ? c.v.map(v => oneLabel(c.k, v)).join(c.k === "same_sort" ? " → " : " 또는 ") : oneLabel(c.k, c.v);
/* 조건 하나에 맞는지 (값이 여러 개면 그중 하나라도) */
const matchCond = (it, c) => !FKIND[c.k] || (Array.isArray(c.v) ? c.v.some(v => FKIND[c.k][1](it, v)) : FKIND[c.k][1](it, c.v));
/* 그룹 안에 이 값이 들어 있는지 (값 하나짜리 조건이든 여러 개짜리 조건이든) */
const condHas = (c, k, v) => c.k === k && (Array.isArray(c.v) ? c.v.includes(v) : c.v === v);
var ONOFF_LISTS = ["한국", "TJ", "금영", "일본", "DAM", "JOYSOUND", "UGA"];  // 필터 '노래방' 값 (곡의 tags) — 이 순서로
function passGroups(it, groups) {
  const gs = groups.filter(g => g.c.some(c => FKIND[c.k]));
  const all = g => g.c.every(c => matchCond(it, c));
  const inc = gs.filter(g => !g.x), exc = gs.filter(g => g.x);
  if (inc.length && !inc.some(all)) return false;
  return !exc.some(all);
}
function countBy(listOfLists) {
  const m = new Map();
  for (const xs of listOfLists) for (const x of xs) m.set(x, (m.get(x) || 0) + 1);
  return sortCounts(m);
}
/* {value: count} → [[value, count]] most first, then 가나다 */
const KO_COLLATE = new Intl.Collator("ko").compare;
const sortCounts = m => [...m.entries()].sort((a, b) => b[1] - a[1] || KO_COLLATE(a[0], b[0]));
/* 곡들에서 고를 수 있는 카테고리 [{id, label, k: 조건 종류, rows: [[값, 곡 수]], lab: 값 표시}] — 가나다순 · 값이 하나도 없는 카테고리는 뺌.
   가사·싱크 상태도 카테고리 하나 (online: 온라인 곡이면 가사 상태는 빼고 싱크 상태만).
   태그: 노래방 목록은 값만(한국·일본), 그 밖 태그는 분류(tagGroupOf)마다 카테고리 하나 —
   음성 합성 엔진·아티스트는 보컬·프로듀서 카테고리와 같아서 뺌 */
/* counted in one pass over the songs (add), the categories made at the end (done) — filterCatsAsync gives the screen its
   turns in between (user request 2026-11-18: counting 25만 곡 at once stalled the player 1.5 s) */
function filterCatsCounter(online) {
  const m = {ini: new Map(), singer: new Map(), vcount: new Map(), vkind: new Map(), composer: new Map(), kara: new Map(), tags: new Map(),
             cat: new Map(), year: new Map(), state: new Map(), flag: new Map()};
  const inc = (map, x) => map.set(x, (map.get(x) || 0) + 1);
  const states = Object.keys(STATES).filter(k => !online || !/^(lyrics|nolyrics|src:)/.test(k));  // 온라인: 싱크 상태만 (가사는 그때 읽음)
  return {
    add(it) {
      inc(m.ini, it._ini);
      for (const x of it._singers) inc(m.singer, x);
      const vc = vcountOf(it); if (vc) inc(m.vcount, vc);
      inc(m.vkind, vkindOf(it));
      for (const x of it._composers) inc(m.composer, x);
      for (const t of it.tags || []) if (ONOFF_LISTS.includes(t)) inc(m.kara, t);
      for (const t of it.tags || []) if (!ONOFF_LISTS.includes(t)) inc(m.tags, t);
      for (const c of it.categories || []) inc(m.cat, c);
      if (it._year) inc(m.year, it._year);
      for (const k of states) if (FKIND.state[1](it, k)) inc(m.state, k);
      for (const f of it.flags || []) inc(m.flag, f);
    },
    done() {
      const cats = [], add = (id, label, k, rows, lab = x => x) => { if (rows.length) cats.push({id, label, k, rows, lab}); };
      const order = new Map(INITIALS.map((x, i) => [x, i]));  // 제목 첫 글자 (ㄱ~ㅎ · A~Z · 0-9 · 기호 순)
      add("ini", "가나다", "ini", sortCounts(m.ini).sort((a, b) => order.get(a[0]) - order.get(b[0])));
      add("singer", "보컬", "singer", sortCounts(m.singer), shortName);
      add("vcount", "보컬 인원수", "vcount", sortCounts(m.vcount).sort((a, b) => parseInt(a[0]) - parseInt(b[0])), vcountLabel);
      add("vkind", "보컬 종류", "vkind", VKINDS.filter(v => m.vkind.has(v)).map(v => [v, m.vkind.get(v)]));
      add("composer", "프로듀서", "composer", sortCounts(m.composer), shortName);
      add("kara", "노래방", "kara", ONOFF_LISTS.filter(t => m.kara.has(t)).map(t => [t, m.kara.get(t)]), t => t === "한국" || t === "일본" ? `${t} 전체` : t);  // 한국·일본 목록 + 브랜드
      const groups = new Map();
      for (const [k, n] of sortCounts(m.tags)) { const g = tagGroupOf(k); if (/^(음성 합성 엔진|아티스트)$/.test(g)) continue; (groups.get(g) || groups.set(g, []).get(g)).push([k, n]); }
      for (const [g, rows] of groups) add("tag:" + g, g || "태그", "tag", rows);
      add("cat", "나무위키 분류", "cat", sortCounts(m.cat));
      add("year", "투고년도", "year", sortCounts(m.year).sort((a, b) => b[0].localeCompare(a[0])), k => k + "년");
      add("state", "가사·싱크 상태", "state", states.filter(k => m.state.has(k)).map(k => [k, m.state.get(k)]), k => STATES[k]);
      add("flag", "곡 상태", "flag", FLAGS.filter(f => m.flag.has(f)).map(f => [f, m.flag.get(f)]));
      return cats.sort((a, b) => a.label.localeCompare(b.label, "ko"));  // 대분류는 가나다순
    },
  };
}
function filterCats(its, online) {
  const c = filterCatsCounter(online);
  for (const it of its) c.add(it);
  return c.done();
}
async function filterCatsAsync(its, online, tick) {
  const c = filterCatsCounter(online);
  for (let i = 0; i < its.length; i++) { c.add(its[i]); if (!(i & 2047)) await tick(); }
  return c.done();
}
/* 카테고리 기호 (user request 2026-11-14): 카테고리 이름(label) → 기호 한 곳에서 관리. 그릴 때만 붙임 (이름·저장값은 그대로).
   컬러 이모지는 눈에 안 들어와서 (user request) 글자색 한 가지로 그려지는 단순한 기호 — U+FE0E: 이모지 그림으로 바꾸지 말고 글자로.
   태그 분류(장르·테마 …)는 VocaDB 분류의 한글 이름 (filter_panel.js TAG_CAT_KO) — 새 분류가 생기면 여기 한 줄 더, 없으면 # */
const CAT_ICON = {
  "가나다": "ㄱ", "보컬": "♪", "보컬 인원수": "Ⅲ", "프로듀서": "✎", "노래방": "♫", "나무위키 분류": "▤", "투고년도": "◷", "가사·싱크 상태": "✓", "곡 상태": "◇", "곡 종류": "◉", "보컬 종류": "◐", "같은 곡 정렬": "⇅", "같은 곡 자르기": "✂",
  "장르": "◆", "테마": "◈", "분위기": "☁", "악기": "♩", "곡 구성": "▦", "보컬 관련": "✧", "원작": "❖", "시리즈": "⟳", "애니메이션": "▶",
  "게임": "✦", "MMD 모델": "☺", "출처": "↗", "배포": "⇩", "편집 메모": "✐", "음성 합성 엔진": "⚙", "가사": "❝", "2차 창작": "⧉",
  "디자인": "✿", "이벤트": "⚑", "매체": "▣", "역할": "☰", "언어": "◎",
};
const catIcon = label => (CAT_ICON[label] || "#") + "︎";
/* 싱크를 만들 곡: 온라인은 싱크 생성 대상(syncable) · mp3 는 가사는 있는데 싱크가 없는 곡 (직접 맞춘 곡은 빼고) */
const needSync = it => it.site === "stream" ? !!it.syncable : !!(it.lyrics && it.sync !== "ok" && it.method !== "manual");
