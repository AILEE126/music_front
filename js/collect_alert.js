/* 자동 수집 알림 (user request 2026-11-18). The server's GitHub Actions collect (every day: VocaDB 변경 확인 + 새 곡)
   writes Server/data/collect_alert.json (data branch) when it had to stop before getting everything (daily cap · time
   limit · VocaDB blocked) and deletes it once nothing is left. Shown only to admin players (write token or the server PC's
   folder) — a read-only token never even reads it. ✕ hides it until the next run writes a new one. */
const CA = {busy: false, doc: null};
const CA_EVERY = 10 * 60 * 1000;
const caHours = h => h == null ? "" : h >= 24 ? `${Math.floor(h / 24)}일 ${Math.round(h % 24)}시간` : `${Math.max(1, Math.round(h))}시간`;

function caRender() {
  let box = document.getElementById("collectAlert");
  const d = CA.doc;
  if (!d || String(store.get("collectAlert.hidden", "") || "") === d.at) { if (box) box.remove(); return; }
  if (!box) {
    const head = document.querySelector(".side-head");
    if (!head) return;
    box = document.createElement("div");
    box.id = "collectAlert";
    box.className = "calert";
    box.setAttribute("role", "status");
    head.appendChild(box);
  }
  const left = [];
  if (d.changes_since) left.push(`안 읽은 변경 기간 약 ${caHours(d.changes_hours)}`);
  if (d.refresh_left) left.push(`다시 받을 곡·아티스트 ${Number(d.refresh_left).toLocaleString()}개`);
  if (d.new_since) left.push("새 곡 확인 남음");
  box.innerHTML = `<button class="ib calert-x" title="닫기 — 다음 자동 수집이 새 알림을 쓸 때까지 숨김" aria-label="닫기">✕</button>`
    + `<b>자동 수집이 다 받지 못했습니다</b> <span class="calert-why">(${esc(d.reason_ko || "")} · ${esc(String(d.at || "").slice(5, 16))})</span>`
    + (left.length ? `<div>남은 것: ${esc(left.join(" · "))}</div>` : "")
    + `<div class="calert-todo">${esc(d.todo || "로컬에서 수동으로 추가 수집하세요.")}</div>`;
  box.querySelector(".calert-x").onclick = () => { store.set("collectAlert.hidden", d.at); box.remove(); };
}

async function caCheck() {
  if (typeof LOCAL === "undefined" || !LOCAL.ready || CA.busy) return;
  if (!LOCAL.canWrite) { CA.doc = null; caRender(); return; }  // 읽기 전용 토큰: 안 보임
  CA.busy = true;
  try { CA.doc = await LOCAL.readJson(`${LOCAL.data}collect_alert.json`, null); }
  catch (e) { return; }
  finally { CA.busy = false; }
  caRender();
}
{
  // LOCAL becomes ready after the entry dialog → look until then, later every 10 minutes and when the tab comes back
  const first = setInterval(() => { if (typeof LOCAL !== "undefined" && LOCAL.ready) { clearInterval(first); caCheck(); } }, 2000);
  setInterval(caCheck, CA_EVERY);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - (CA.last || 0) > 2 * 60 * 1000) { CA.last = Date.now(); caCheck(); } });
}
