/* player_screen.html 화면 동작 — 서버 없이 html 을 바로 열어 씀 (서버·음원 관리와 따로)
   곡 검색은 우리 DB (vocadb_api.js) · 우리 곡(노래방·가사·싱크)·한글 이름은 깃허브(토큰) 또는 고른 Server\data 폴더(서버 PC)에서
   읽음 (local_files.js) · 왼쪽 칸은 재생목록 · 오프라인 mp3 는 고른 mp3 폴더 (offline_folder.js)
   싱크 밀기·직접 맞추기·오류 신고는 그곳에 바로 저장. 싱크 만들기·가사 받기 등은 서버 PC 의 음원 관리에서.
   This file holds only what every part shares (player · current song state); the screen is split by feature (user request
   2026-11-18), read in this order by player_screen.html — a file may use another's names at load only if that one comes
   earlier: playlist_panel · search_dialog · filter_panel · lyrics_view · video_box · report_dialog · player_start (last). */
const SHELL = makePlayer($("audioLocal"));  // 재생기 (play_engine.js)
const audio = SHELL.audio;
const cleanups = [];
function on(target, ev, fn) { target.addEventListener(ev, fn); cleanups.push(() => target.removeEventListener(ev, fn)); }
window.addEventListener("pagehide", () => cleanups.forEach(f => f()));  // 화면을 떠나면 바깥 재생기에 건 연결 해제

let LIB = {items: [], sites: {}}, view = [], cur = null, song = null;
let editShift = 0;  // +/− pushed while editing (shown next to the buttons)
let times = null, offset = 0, curIdx = -1, editing = false, editTimes = null, editOk = null, cursor = 0, editFoldedVid = false, editFoldedBar = false;
let userScrollAt = 0;
