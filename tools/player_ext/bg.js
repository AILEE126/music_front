/* 음원 플레이어 확장 — background (user request 2026-11-20: updates by itself, never installed again).
   The extension is only this loader: it fetches the player's js/player_ext_media.js from the public music_front repo
   (main) and registers it as a user script (world MAIN, document_start, every frame) on the player sites it covers.
   When: browser start · install · every hour · a click on its icon (now). Offline / fetch failed → the last fetched copy,
   else the copy inside this folder (media.js). The self-update needs '사용자 스크립트 허용' (Chrome 138+ / Edge: the
   extension's 세부 정보 page) — while it is off this opens that page once and checks again every minute.
   Switch off (user report 2026-11-20: installed, never recognised — its storage held only 'asked', the script was never
   registered): the copy in this folder runs as a plain content script (fallback), so everything works right after loading
   the folder; only new versions wait for the switch (or for downloading the extension again).
   Zipped by music_front js/play_engine.js extZip (manifest made there: matches = EXT_ORIGINS → matches.json). */
const SRC = "https://raw.githubusercontent.com/AILEE126/music_front/main/js/player_ext_media.js";
const ID = "mpx";

const usable = () => { try { return !!(chrome.userScripts && chrome.userScripts.getScripts); } catch (e) { return false; } };
const text = async (url, opt) => { const r = await fetch(url, opt); if (!r.ok) throw new Error(url + " " + r.status); return r.text(); };

const matchList = async () => JSON.parse(await text(chrome.runtime.getURL("matches.json")));
/* the folder's own copy as a content script — on only while user scripts can't be used (both at once would run it twice) */
async function fallback(on) {
  const have = await chrome.scripting.getRegisteredContentScripts({ids: [ID]});
  if (on && !have.length) await chrome.scripting.registerContentScripts([{id: ID, matches: await matchList(), js: ["media.js"], allFrames: true, runAt: "document_start", world: "MAIN"}]);
  if (!on && have.length) await chrome.scripting.unregisterContentScripts({ids: [ID]});
}

async function update(force = false) {
  if (!usable()) { await fallback(true); return askToggle(); }
  await fallback(false);
  chrome.alarms.create("update", {periodInMinutes: 60});
  chrome.alarms.clear("toggle");
  const kept = await chrome.storage.local.get(["code"]);
  let code = "";
  try { code = await text(SRC, {cache: "no-cache"}); } catch (e) {}
  if (!/function mpxMedia\(/.test(code)) code = kept.code || await text(chrome.runtime.getURL("media.js"));
  const matches = await matchList();
  const have = await chrome.userScripts.getScripts({ids: [ID]});
  if (have.length && kept.code === code && !force) return;
  const s = {id: ID, matches, js: [{code}], allFrames: true, runAt: "document_start", world: "MAIN"};
  await (have.length ? chrome.userScripts.update([s]) : chrome.userScripts.register([s]));
  const ver = +((/const VER = (\d+)/.exec(code) || [])[1]) || 0;
  await chrome.storage.local.set({code, ver, at: Date.now()});
  chrome.action.setTitle({title: `음원 플레이어 확장 — 기능 버전 ${ver} (자동 업데이트, 누르면 지금 확인)`});
}
async function askToggle() {
  chrome.alarms.create("toggle", {periodInMinutes: 1});
  const {asked} = await chrome.storage.local.get(["asked"]);
  if (asked) return;
  await chrome.storage.local.set({asked: true});
  chrome.tabs.create({url: "chrome://extensions/?id=" + chrome.runtime.id});  // Edge opens it as edge://extensions
}

chrome.runtime.onInstalled.addListener(() => { chrome.storage.local.remove("asked").then(() => update(true)); });
chrome.runtime.onStartup.addListener(() => update());
chrome.alarms.onAlarm.addListener(a => update(a.name === "toggle"));
chrome.action.onClicked.addListener(() => update(true));
