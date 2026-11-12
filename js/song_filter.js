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
function prepItem(it) {
  it._ini = initialOf(it.title);
  it._singers = people(it.singer);
  it._composers = people(it.composer);
  it._year = /^\d{4}/.test(it.date || "") ? it.date.slice(0, 4) : "";
}
const KARA_RE = /^(TJ|금영|DAM|UGA|JOYSOUND)$/;
const STATES = {lyrics: "가사 있음", nolyrics: "가사 없음", ok: "싱크됨", need: "싱크 필요", stale: "싱크 다시", resync: "재싱크 필요", fail: "싱크 실패",
                "src:namu": "나무위키 가사", "src:vocaro": "VL 가사", "src:own": "직접 넣은 가사", "src:link": "연결 가사"};
const FKIND = {
  text: ["검색", (it, v) => `${Object.values(it.nums || {}).join(" ")} ${it.title} ${it.kara_title || ""} ${it.orig} ${it.reading} ${it.artist} ${it.singer} ${it.name}`.normalize("NFKC").toLowerCase().includes(fold(v))],
  ini: ["가나다", (it, v) => it._ini === v],
  singer: ["보컬", (it, v) => it._singers.includes(v)],
  solo: ["솔로", (it, v) => it._singers.length === 1 && it._singers[0] === v],
  composer: ["프로듀서", (it, v) => it._composers.includes(v)],
  kara: ["노래방", (it, v) => (it.tags || []).includes(v)],
  tag: ["태그", (it, v) => (it.tags || []).includes(v)],
  cat: ["나무위키", (it, v) => (it.categories || []).includes(v)],
  year: ["년도", (it, v) => it._year === v],
  state: ["상태", (it, v) => v.startsWith("src:") ? it.lyrics === v.slice(4)
    : v === "lyrics" ? !!it.lyrics : v === "nolyrics" ? !it.lyrics : v === "ok" ? it.sync === "ok"
    : v === "need" ? (it.site === "stream" ? !!(it.karaoke && it.sync !== "ok") : !!(it.lyrics && it.sync !== "ok")) : v === "stale" || v === "resync" ? it.sync === v : v === "fail" ? !!it.sync_fail : false],
};
/* 조건 칩 앞 작은 글자: 종류 (스트리밍 태그는 그 분류 — 시리즈·인원수) */
const firstV = c => Array.isArray(c.v) ? c.v[0] || "" : c.v;
const chipKind = c => c.k === "tag" && firstV(c).includes(":") ? firstV(c).split(":")[0] : FKIND[c.k][0];
const oneLabel = (k, v) => k === "tag" ? v.slice(v.indexOf(":") + 1) : k === "year" ? v + "년" : k === "state" ? STATES[v] || v
  : k === "kara" && (v === "한국" || v === "일본") ? v + " 전체" : shortName(v);
const chipLabel = c => Array.isArray(c.v) ? c.v.map(v => oneLabel(c.k, v)).join(" 또는 ") : oneLabel(c.k, c.v);
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
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
}
/* 곡들에서 고를 수 있는 카테고리 [{id, label, k: 조건 종류, rows: [[값, 곡 수]], lab: 값 표시}] — 가나다순 · 값이 하나도 없는 카테고리는 뺌.
   가사·싱크 상태도 카테고리 하나 (online: 온라인 곡이면 가사 상태는 빼고 싱크 상태만).
   태그: 노래방 목록은 값만(한국·일본), 온라인 스트리밍은 '분류:이름'(위키 상단 분류)의 분류마다 카테고리 하나 —
   음성 합성 엔진·아티스트는 보컬·프로듀서 카테고리와 같아서 뺌 */
function filterCats(its, online) {
  const cats = [], add = (id, label, k, rows, lab = x => x) => { if (rows.length) cats.push({id, label, k, rows, lab}); };
  const ini = countBy(its.map(it => [it._ini])), order = new Map(INITIALS.map((x, i) => [x, i]));  // 제목 첫 글자 (ㄱ~ㅎ · A~Z · 0-9 · 기호 순)
  add("ini", "가나다", "ini", ini.sort((a, b) => order.get(a[0]) - order.get(b[0])));
  add("singer", "보컬", "singer", countBy(its.map(it => it._singers)), shortName);
  add("composer", "프로듀서", "composer", countBy(its.map(it => it._composers)), shortName);
  const kara = new Map(countBy(its.map(it => (it.tags || []).filter(t => ONOFF_LISTS.includes(t)))));  // 한국·일본 목록 + 브랜드
  add("kara", "노래방", "kara", ONOFF_LISTS.filter(t => kara.has(t)).map(t => [t, kara.get(t)]), t => t === "한국" || t === "일본" ? `${t} 전체` : t);
  const tags = countBy(its.map(it => (it.tags || []).filter(t => !ONOFF_LISTS.includes(t) && !/^(음성 합성 엔진|아티스트):/.test(t))));
  const groups = new Map();
  for (const [k, n] of tags) { const g = k.includes(":") ? k.split(":")[0] : ""; groups.set(g, [...(groups.get(g) || []), [k, n]]); }
  for (const [g, rows] of groups) add("tag:" + g, g || "태그", "tag", rows, k => k.slice(k.indexOf(":") + 1));
  add("cat", "나무위키 분류", "cat", countBy(its.map(it => it.categories || [])));
  add("year", "투고년도", "year", countBy(its.map(it => it._year ? [it._year] : [])).sort((a, b) => b[0].localeCompare(a[0])), k => k + "년");
  add("state", "가사·싱크 상태", "state", stateRows(its, online), k => STATES[k]);
  return cats.sort((a, b) => a.label.localeCompare(b.label, "ko"));  // 대분류는 가나다순
}
/* 가사·싱크 상태 [[값, 곡 수]] — 온라인 스트리밍은 가사를 그때 읽으므로 가사 상태는 빼고 싱크 상태만 */
const stateRows = (its, online) => Object.keys(STATES).filter(k => !online || !/^(lyrics|nolyrics|src:)/.test(k))
  .map(k => [k, its.filter(it => FKIND.state[1](it, k)).length]).filter(([, n]) => n);
/* 싱크를 만들 곡: 온라인은 싱크 생성 대상(syncable) · mp3 는 가사는 있는데 싱크가 없는 곡 (직접 맞춘 곡은 빼고) */
const needSync = it => it.site === "stream" ? !!it.syncable : !!(it.lyrics && it.sync !== "ok" && it.method !== "manual");
