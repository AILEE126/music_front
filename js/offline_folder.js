/* 플레이어 오프라인 모드: 고른 mp3 폴더의 mp3 를 그대로 틂
   · 폴더는 열 때마다 고름 (브라우저 폴더 권한). '이전 폴더 연결하기'를 누르면 지난번에 고른 폴더를 다시 (누를 때만 권한을 물을 수 있음)
   · 곡 정보: mp3 태그 (제목·아티스트·프로듀서·보컬·투고일·원제·원제 발음·받은 영상·썸네일)
   · 가사·싱크: mp3 와 같은 이름의 <이름>.json 이 있는 곡만 (음원 관리 'mp3 다운로드'가 같이 씀 — 화면용 가사 json 과 같은 모양).
     싱크 밀기·직접 맞추기는 그 json 의 sync 에 저장
 */
var OFFDIR = (() => {
  /* ---- 지난번에 고른 폴더 기억 (IndexedDB 에 폴더 손잡이) ---- */
  const idb = idbKV("music-mp3");  // shared_screen_helpers.js

  /* ---- mp3 태그 읽기 (ID3v2.3/2.4 — mutagen 이 쓴 태그): 글자 칸·TXXX·썸네일(APIC) ---- */
  const synchsafe = b => (b[0] & 0x7f) << 21 | (b[1] & 0x7f) << 14 | (b[2] & 0x7f) << 7 | (b[3] & 0x7f);
  const uint32 = b => ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
  const decoders = {0: new TextDecoder("latin1"), 1: new TextDecoder("utf-16"), 2: new TextDecoder("utf-16be"), 3: new TextDecoder("utf-8")};
  const text = (enc, b) => (decoders[enc] || decoders[3]).decode(b).replace(/\0+$/, "").split("\0")[0];
  function textSplit(enc, b) {  // 인코딩에 맞춰 0 으로 끝나는 첫 글자 + 나머지
    const wide = enc === 1 || enc === 2;
    let i = 0;
    if (wide) { while (i + 1 < b.length && (b[i] || b[i + 1])) i += 2; }
    else { while (i < b.length && b[i]) i++; }
    return [b.subarray(0, i), b.subarray(i + (wide ? 2 : 1))];
  }
  async function readTags(file) {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    const out = {}, tags = {};
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {tags, cover: null};  // "ID3"
    const ver = head[3], end = 10 + synchsafe(head.subarray(6, 10));
    const tag = new Uint8Array(await file.slice(0, end).arrayBuffer());
    let p = 10;
    if (head[5] & 0x40) p += ver === 4 ? synchsafe(tag.subarray(p, p + 4)) : uint32(tag.subarray(p, p + 4)) + 4;  // 확장 머리말
    while (p + 10 <= end) {
      const id = String.fromCharCode(...tag.subarray(p, p + 4));
      if (!/^[A-Z0-9]{4}$/.test(id)) break;  // 여백(0) 시작
      const size = ver === 4 ? synchsafe(tag.subarray(p + 4, p + 8)) : uint32(tag.subarray(p + 4, p + 8));
      const b = tag.subarray(p + 10, p + 10 + size);
      p += 10 + size;
      if (!b.length) continue;
      const enc = b[0];
      if (id === "TXXX") { const [d, v] = textSplit(enc, b.subarray(1)); tags["TXXX:" + text(enc, d)] = text(enc, v); }
      else if (id[0] === "T") tags[id] = text(enc, b.subarray(1));
      else if (id === "APIC" && !out.cover) {
        let i = 1;
        while (i < b.length && b[i]) i++;  // 형식 (latin1, 0 종료)
        const mime = decoders[0].decode(b.subarray(1, i)) || "image/jpeg";
        const [, rest] = textSplit(enc, b.subarray(i + 2));  // 0 + 그림 종류 1바이트 → 설명
        out.cover = new Blob([rest], {type: mime});
      }
    }
    return {tags, cover: out.cover || null};
  }

  const D = {
    dir: null, items: [], byName: new Map(), urls: [], subs: new Set(),
    get name() { return this.dir ? this.dir.name : ""; },
    async saved() { try { return await idb("get", "mp3-dir"); } catch (e) { return null; } },
    async pick() {
      if (!window.showDirectoryPicker) throw new Error("이 브라우저는 폴더 열기를 지원하지 않습니다. 크롬이나 엣지로 여세요.");
      const dir = await showDirectoryPicker({id: "mp3", mode: "readwrite"});
      await this.use(dir);
      try { await idb("put", "mp3-dir", dir); } catch (e) {}
    },
    async reconnect() {  // '이전 폴더 연결하기' (누를 때만 — 브라우저가 그때만 권한을 물어봄)
      const dir = await this.saved();
      if (!dir) throw new Error("이전에 연결한 폴더가 없습니다. 폴더를 고르세요.");
      let st = await dir.queryPermission({mode: "readwrite"});
      if (st !== "granted") st = await dir.requestPermission({mode: "readwrite"});
      if (st !== "granted") throw new Error("폴더를 읽을 권한이 없습니다.");
      await this.use(dir);
    },
    /* 폴더의 mp3 · 같은 이름의 json → 곡 목록 */
    async use(dir) {
      const mp3s = [], jsons = new Map();
      for await (const [n, h] of dir.entries()) {
        if (h.kind !== "file") continue;
        if (/\.mp3$/i.test(n)) mp3s.push(h); else if (/\.json$/i.test(n)) jsons.set(n.replace(/\.json$/i, "").toLowerCase(), h);
      }
      if (!mp3s.length) throw new Error(`'${dir.name}' 폴더에 mp3 가 없습니다.`);
      this.urls.forEach(u => URL.revokeObjectURL(u)); this.urls = [];
      const items = [];
      let k = 0;
      const one = async h => {
        const file = await h.getFile(), stem = h.name.replace(/\.mp3$/i, "");
        let t = {tags: {}, cover: null};
        try { t = await readTags(file); } catch (e) {}
        const g = x => t.tags[x] || "", side = jsons.get(stem.toLowerCase());
        let sj = null;
        if (side) { try { sj = JSON.parse((await (await side.getFile()).text()).replace(/^﻿/, "")); } catch (e) {} }
        const url = URL.createObjectURL(file), cover = t.cover ? URL.createObjectURL(t.cover) : "";
        this.urls.push(url); if (cover) this.urls.push(cover);
        const date = g("TDRC").slice(0, 10), sync = sj && sj.groups && sj.groups.length ? (sj.sync && sj.sync.times ? sj.sync_state || "ok" : "") : "";
        items.push({site: "local", name: h.name, title: g("TIT2") || stem, artist: g("TPE1"), composer: g("TCOM"), singer: g("TXXX:SINGER"),
          date: /^\d{4}/.test(date) ? date : "", orig: g("TXXX:TITLE_ORIG"), reading: g("TXXX:TITLE_READING"),
          video: g("TXXX:VIDEO") || g("TXXX:SOURCE"), videos: [], nico: "", tags: [], nums: {}, ord: {local: 0},
          cover: cover ? 1 : 0, _url: url, _cover: cover, _side: side || null,
          lyrics: sj && sj.groups && sj.groups.length ? "own" : "", sync, method: sj && sj.sync ? sj.sync.method || "" : "",
          score: sj && sj.sync ? sj.sync.score : null, vocals: [], categories: [], notes: [], memo: null});
      };
      const queue = mp3s.slice(), run = async () => { while (queue.length) { await one(queue.shift()); k++; } };
      await Promise.all(Array.from({length: 6}, run));
      items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      items.forEach((it, i) => { it.ord = {local: i}; });
      this.dir = dir; this.items = items; this.byName = new Map(items.map(it => [it.name, it]));
      this.subs.forEach(f => { try { f(); } catch (e) { this.subs.delete(f); } });
    },
    item(name) {
      const it = this.byName.get(name);
      if (!it) throw new Error("오프라인 폴더에서 그 곡을 찾을 수 없습니다. 폴더를 다시 연결하세요.");
      return it;
    },
    audioUrl(it) { const x = this.byName.get(it.name); return x ? x._url : ""; },
    coverUrl(it) { const x = this.byName.get(it.name); return x ? x._cover : ""; },
    async readSide(it) {
      if (!it._side) return null;
      try { return JSON.parse((await (await it._side.getFile()).text()).replace(/^﻿/, "")); } catch (e) { return null; }
    },
    /* 가사: 같은 이름의 json (없으면 가사 없음) */
    async lyrics(name) {
      const it = this.item(name), d = await this.readSide(it);
      if (!d || !d.groups) return {site: "local", name, title: it.title, artist: it.artist, groups: [], sync: null, sync_state: "", raw: "", notes: [],
        lyrics_src: "", lyrics_kind: "", sync_fail: null, link: null};
      return {...d, site: "local", name, title: it.title, artist: it.artist};
    },
    /* 싱크 저장: 그 json 의 sync (밀기만 · 직접 맞춘 시간) */
    async saveSync(b) {
      const it = this.item(b.name), d = await this.readSide(it);
      if (!d || !d.groups || !d.groups.length) throw new Error("이 곡은 가사·싱크 json 이 없어 저장할 수 없습니다.");
      const s = d.sync || {}, round = v => Math.round(+v * 100) / 100;
      if (b.times != null) {
        if (!Array.isArray(b.times) || b.times.length !== d.groups.length) throw new Error("시간 개수가 가사 묶음 수와 다릅니다.");
        const ok = Array.isArray(b.matched) && b.matched.length === b.times.length ? b.matched.map(Boolean) : b.times.map(() => true);
        Object.assign(s, {times: b.times.map(round), matched: ok, method: ok.every(Boolean) ? "manual" : (s.method && s.method !== "manual" ? s.method : "auto"),
                          edited: new Date().toISOString().slice(0, 19)});
      }
      if (!s.times) throw new Error("싱크가 없는 곡입니다.");
      s.offset = round(b.offset ?? s.offset ?? 0);
      d.sync = s; d.sync_state = "ok";
      const w = await it._side.createWritable();
      await w.write(JSON.stringify(d, null, 1)); await w.close();
      Object.assign(it, {sync: "ok", method: s.method});
      return this.lyrics(b.name);
    },
    /* 화면 요청 중 오프라인 곡(site=local)의 것 (shared_screen_helpers.js api() 가 보냄) */
    async request(path, opt = {}) {
      const u = new URL(path, "http://x/"), q = Object.fromEntries(u.searchParams);
      const body = opt.body ? JSON.parse(opt.body) : {}, post = (opt.method || "GET") === "POST";
      if (!post && u.pathname === "/api/lyrics") return this.lyrics(q.name);
      if (post && u.pathname === "/api/sync/save") return this.saveSync(body);
      throw new Error("오프라인 곡(mp3 폴더)은 이 기능을 쓸 수 없습니다. 온라인으로 바꿔서 하세요.");
    },
    subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  };
  return D;
})();
/* 오프라인 곡 요청인지 (주소의 site=local · 보낸 값의 site) */
const isLocalReq = (path, opt = {}) => /[?&]site=local(&|$)/.test(path) || (!!opt.body && /"site":"local"/.test(opt.body));
