// Cloudflare Worker: 로그인, 방, 덱, 대전(Durable Object) 연결
import { DurableObject } from 'cloudflare:workers';
import { newGame, apply, viewFor, replay, waitingOn, fixJosa } from '../public/lib/engine.js';
import { withEvo } from '../public/lib/fxrules.js';
import { indexCards, checkDeck, expand } from '../public/lib/deck.js';
import { makeVapid, sendPush } from './webpush.js';
import { DC_KR, DC_JP, JP_PICT, DC_UA, dcFetch, deckCode } from './deckcode.js';
import EVO from './evo.json'; // 진화 전 이름 표 (tools/build-evo.py 로 만듦)

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const err = (m, status = 400) => json({ error: m }, status);
const rid = (n = 10) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

// ---- 로그인 토큰 (HMAC) ----
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}
// 서명 열쇠: SECRET 이 없으면 로비가 처음 한 번 만들어 저장한 무작위 값 (공개 저장소라 기본값을 쓰면 안 됨)
let KEY = null;
const keyOf = async (env, lobby) => env.SECRET || (KEY ||= await lobby.secret());
async function makeToken(key, uid, tv) { const b = uid + '.' + (tv | 0); return b + '.' + await hmac(key, b); }
async function readToken(key, tok) {
  if (!tok) return null; const p = String(tok).split('.');
  if (p.length !== 3 || !p[0]) return null;
  return p[2] === await hmac(key, p[0] + '.' + p[1]) ? { uid: p[0], tv: p[1] | 0 } : null;
}
const cookieTok = req => (req.headers.get('cookie') || '').match(/(?:^|;\s*)tok=([^;]+)/)?.[1];
const tokCookie = (tok, url) => `tok=${tok}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`;
// 로그인한 기기 이름 (관리자 화면의 접속 기록용, IP 는 저장하지 않음)
function devOf(ua = '') {
  const os = /iPad/.test(ua) ? '아이패드' : /iPhone|iPod/.test(ua) ? '아이폰' : /Android/.test(ua) ? '안드로이드' : /Windows/.test(ua) ? '윈도우 PC' : /Mac OS X/.test(ua) ? '맥' : /Linux|CrOS/.test(ua) ? '리눅스' : '기타';
  const br = /KAKAOTALK/i.test(ua) ? '카카오톡' : /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /Whale/.test(ua) ? '웨일' : /Edg(A|iOS)?\//.test(ua) ? '엣지' : /CriOS|Chrome\//.test(ua) ? '크롬' : /FxiOS|Firefox/.test(ua) ? '파이어폭스' : /Safari/.test(ua) ? '사파리' : '';
  return br ? `${os} · ${br}` : os;
}
const PW_ITER = 100000; // 클라우드플레어가 허용하는 가장 큰 값
const b64 = u8 => btoa(String.fromCharCode(...u8));
async function pwHash(pw, salt) {
  salt ||= crypto.getRandomValues(new Uint8Array(16));
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const h = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PW_ITER }, k, 256));
  return `p1$${PW_ITER}$${b64(salt)}$${b64(h)}`;
}
async function pwCheck(stored, pw) {
  const [v, , s] = String(stored || '').split('$'); if (v !== 'p1' || !s) return false;
  const again = await pwHash(String(pw || ''), Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  let d = again.length ^ stored.length; for (let i = 0; i < Math.min(again.length, stored.length); i++) d |= again.charCodeAt(i) ^ stored.charCodeAt(i);
  return d === 0;
}
const nameOk = n => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 12);

// ---- 꾸미기: 카드 뒷면·매트·카드 그림 (모임 기본값은 관리자가, 각자 덮어쓰기) ----
const BACK_KEYS = ['ball', 'ring', 'sea', 'night', 'leaf', 'sunset', 'flame'];
const MAT_KEYS = ['grass', 'sky', 'sand', 'snow', 'sakura', 'night', 'autumn'];
const ART_KEYS = ['mix', 'en', 'kr'];
const IMG_TYPES = { 'image/webp': b => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45, 'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8, 'image/png': b => b[0] === 0x89 && b[1] === 0x50 };
const IMG_MAX = 1.5 * 1024 * 1024;
// 관리자: .dev.vars 의 ADMINS(쉼표로 이름 여러 개). 없으면 맨 처음 가입한 사람
async function isAdmin(env, lobby, me) {
  if (env.ADMINS) return String(env.ADMINS).split(',').map(x => x.trim()).filter(Boolean).includes(me.name);
  return (await lobby.firstUser()) === me.uid;
}
function pick(o, rules) { // 허용된 값만 남김
  const out = {};
  for (const [k, ok] of Object.entries(rules)) if (o[k] != null && ok.includes(o[k])) out[k] = o[k];
  return out;
}
// 카드 표시: 그림(한글판/합친 카드/영문판), 글자, 상세 화면, 크게 보기 첫 화면, 목록 카드 밑 글자, 목록 카드 크기, 덱 화면 그림
const DISP_RULES = { dimg: ['kr', 'mix', 'en'], dtext: ['ko', 'en', 'both'], ddet: ['text', 'card'], dzoom: ['en', 'mix', 'kr'], dinfo: ['show', 'hide'], dsize: ['s', 'm', 'l'], ddeck: ['art', 'card', 'none'] };
const PREF_RULES = { back: [...BACK_KEYS, 'group', 'mine'], mat: [...MAT_KEYS, 'group', 'mine'], art: [...ART_KEYS, 'group'], disp: ['group', 'mine'], ...DISP_RULES };
const GROUP_RULES = { back: [...BACK_KEYS, 'custom'], mat: [...MAT_KEYS, 'custom'], art: ART_KEYS, ...DISP_RULES };
async function meInfo(env, lobby, me) { return { user: me, admin: await isAdmin(env, lobby, me), ...(await lobby.skin(me.uid)) }; }
async function adminSet(env, lobby) { // 관리자 uid 목록 (회원 관리 화면 표시용)
  if (env.ADMINS) { const ns = String(env.ADMINS).split(',').map(x => x.trim()).filter(Boolean); return ns; }
  const f = await lobby.firstUser(); return f ? [f] : [];
}

// 카드 자료: PC에서 올리면(public/cards.json이 함께 올라감) 그 판을 로비 저장소에 보관해 두고,
// GitHub 자동 반영처럼 cards.json 없이 올라간 판에서는 보관해 둔 것을 씀 (카드 자료는 저장소에 넣지 않으므로)
let CARDS = null, CARDTXT = null, CARDP = null;
const gzip = async t => new Uint8Array(await new Response(new Blob([t]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
const gunzip = async b => new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
async function sha16(t) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))); return [...d.slice(0, 8)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function loadCardText(env, base) {
  const lobby = env.LOBBY.get(env.LOBBY.idFromName('main'));
  let txt = null;
  try { const r = await env.ASSETS.fetch(new URL('/cards.json', base)); if (r.ok && (r.headers.get('content-type') || '').includes('json')) txt = await r.text(); } catch {}
  if (txt) { const h = await sha16(txt); if ((await lobby.cardsHash()) !== h) await lobby.saveCards(h, await gzip(txt)); return { txt, h }; }
  const s = await lobby.loadCards(); if (!s) throw new Error('카드 자료가 아직 없어요');
  return { txt: await gunzip(s.data), h: s.h };
}
async function cardText(env, base) {
  if (CARDTXT) return CARDTXT;
  if (!CARDP) CARDP = loadCardText(env, base).then(x => (CARDTXT = x), e => { CARDP = null; throw e; });
  return CARDP;
}
async function cardIndex(env, req) {
  if (!CARDS) CARDS = indexCards(JSON.parse((await cardText(env, req.url)).txt));
  return CARDS;
}
async function serveCards(env, req) {
  const c = await cardText(env, req.url).catch(() => null); if (!c) return err('카드 자료가 아직 없어요. 관리자에게 알려 주세요.', 503);
  const et = `"${c.h}"`, hd = { etag: et, 'cache-control': 'private, no-cache' };
  if ((req.headers.get('if-none-match') || '') === et) return new Response(null, { status: 304, headers: hd });
  return new Response(c.txt, { headers: { ...hd, 'content-type': 'application/json; charset=utf-8' } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url); const path = url.pathname;
    if (path === '/kprints.json') return err('없는 주소예요.', 404); // 덱 코드용 카드 표는 서버 안에서만 씀
    if (!path.startsWith('/api/') && !path.startsWith('/ws/') && path !== '/cards.json' && path !== '/cardart.bin') return env.ASSETS.fetch(req);
    const lobby = env.LOBBY.get(env.LOBBY.idFromName('main')), key = await keyOf(env, lobby);
    if (path === '/api/health') return json({ ok: true, cards: !!(await lobby.cardsHash()) }); // 자동 반영 전 확인: 카드 자료를 보관해 두었는지
    // 로그인: 닉네임 + 비밀번호. 가입은 모임 입장 코드가 있어야 (한 번만)
    if ((path === '/api/login' || path === '/api/signup') && req.method === 'POST') {
      const b = await req.json().catch(() => ({})), ip = req.headers.get('cf-connecting-ip') || 'local', dev = devOf(req.headers.get('user-agent') || '');
      const name = nameOk(b.name), pw = String(b.pw || '');
      const r = path === '/api/login' ? await lobby.signin(name, pw, ip, dev)
        : await lobby.signup(name, pw, !!env.GROUP_CODE && String(b.code || '') === env.GROUP_CODE, ip, dev);
      if (r.error) return json(r, r.status || 400);
      const tok = await makeToken(key, r.user.uid, r.tv);
      return json({ user: r.user }, 200, { 'set-cookie': tokCookie(tok, url) });
    }
    const t = await readToken(key, cookieTok(req) || url.searchParams.get('tok'));
    const me = t && await lobby.auth(t.uid, t.tv); if (!me) return err('로그인이 필요해요.', 401);
    const uid = me.uid;
    if (path === '/cards.json') return serveCards(env, req); // 카드 문장 자료는 로그인한 사람만 (인터넷에 올렸을 때 아무나 내려받지 못하게)
    if (path === '/cardart.bin') { // 덱 사진 인식용 카드 그림 특징(그림 자체는 아님)도 로그인한 사람만. PC에서 올릴 때 함께 올라감
      const r = await env.ASSETS.fetch(req); if (!r.ok) return err('덱 사진 인식 자료가 아직 없어요. 관리자에게 알려 주세요.', 503);
      const h = new Headers(r.headers); h.set('cache-control', 'private, max-age=86400'); return new Response(r.body, { status: r.status, headers: h });
    }

    let m;
    if (path === '/api/deckcode' && req.method === 'GET') { // 한국·일본 공식 덱 코드 → 사이트 카드
      const code = String(url.searchParams.get('c') || '').trim();
      if (!DC_KR.test(code) && !DC_JP.test(code)) return err('덱 코드 모양이 아니에요.');
      try { return await deckCode(env, req, code); } catch (e) { return err(e.message || '덱 코드를 읽지 못했어요.', 502); }
    }
    if (path === '/api/deckcode/img' && req.method === 'GET') { // 일본 공식 카드 그림 (그림으로 카드를 찾을 때만, 같은 주소에서 읽어야 해서 거쳐 줌)
      const p = String(url.searchParams.get('p') || '');
      if (!JP_PICT.test(p)) return err('잘못된 그림 주소예요.');
      const r = await dcFetch('https://www.pokemon-card.com' + p, { headers: { 'user-agent': DC_UA }, cf: { cacheTtl: 604800, cacheEverything: true } }).catch(() => null);
      if (!r || !r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) return err('카드 그림을 받지 못했어요.', 502);
      return new Response(r.body, { headers: { 'content-type': r.headers.get('content-type'), 'cache-control': 'private, max-age=604800', 'x-content-type-options': 'nosniff' } });
    }
    if (path === '/api/me') return json(await meInfo(env, lobby, me));
    if (path === '/api/prefs' && req.method === 'POST') { await lobby.setPrefs(uid, pick(await req.json().catch(() => ({})), PREF_RULES)); return json(await meInfo(env, lobby, me)); }
    if (path === '/api/group' && req.method === 'POST') {
      if (!await isAdmin(env, lobby, me)) return err('모임 기본값은 관리자만 바꿀 수 있어요.', 403);
      await lobby.setGroup(pick(await req.json().catch(() => ({})), GROUP_RULES)); return json(await meInfo(env, lobby, me));
    }
    if ((m = path.match(/^\/api\/img\/(\w+)$/)) && req.method === 'GET') {
      const im = await lobby.img(m[1]); if (!im) return err('사진이 없어요.', 404);
      return new Response(im.data, { headers: { 'content-type': im.type, 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
    }
    if (path === '/api/img' && (req.method === 'POST' || req.method === 'DELETE')) {
      const kind = url.searchParams.get('kind'), scope = url.searchParams.get('scope');
      if (!['back', 'mat'].includes(kind) || !['me', 'group'].includes(scope)) return err('잘못된 요청이에요.');
      if (scope === 'group' && !await isAdmin(env, lobby, me)) return err('모임 사진은 관리자만 올릴 수 있어요.', 403);
      const owner = scope === 'group' ? '*' : uid;
      if (req.method === 'DELETE') { await lobby.delImg(owner, kind); return json(await meInfo(env, lobby, me)); }
      const type = (req.headers.get('content-type') || '').split(';')[0].trim();
      if (!IMG_TYPES[type]) return err('사진은 JPG, PNG, WEBP 만 올릴 수 있어요.');
      const buf = await req.arrayBuffer();
      if (buf.byteLength > IMG_MAX) return err('사진이 너무 커요.');
      if (buf.byteLength < 16 || !IMG_TYPES[type](new Uint8Array(buf, 0, 16))) return err('사진 파일이 아니에요.');
      let meta = {}; try { meta = JSON.parse(req.headers.get('x-meta') || '{}'); } catch {}
      await lobby.putImg(owner, kind, type, buf, { dark: !!meta.dark });
      return json(await meInfo(env, lobby, me));
    }
    if (path === '/api/logout') return json({ ok: 1 }, 200, { 'set-cookie': 'tok=; Path=/; Max-Age=0' });
    if (path === '/api/password' && req.method === 'POST') { // 내 비밀번호 바꾸기 (이 기기는 그대로, 다른 기기는 로그아웃)
      const b = await req.json().catch(() => ({})); const r = await lobby.setPw(uid, String(b.old || ''), String(b.pw || ''));
      if (r.error) return json(r, r.status || 400);
      return json({ ok: 1 }, 200, { 'set-cookie': tokCookie(await makeToken(key, uid, r.tv), url) });
    }
    if (path === '/api/stats') return json(await lobby.stats(uid)); // 내 전적: 모두, 상대별, 최근 판
    if (path === '/api/admin/users' || (m = path.match(/^\/api\/admin\/users\/(\w+)\/reset$/))) { // 관리자: 회원 목록·접속 기록, 비밀번호 초기화
      if (!await isAdmin(env, lobby, me)) return err('관리자만 볼 수 있어요.', 403);
      if (m && req.method === 'POST') { const r = await lobby.adminReset(m[1]); return r.error ? json(r, 404) : json(r); }
      return json({ users: await lobby.members(await adminSet(env, lobby), !!env.ADMINS), me: uid });
    }
    // 푸시 알림: 서버 공개 열쇠, 이 기기 구독 저장·지우기, 시험 알림
    if (path === '/api/push/key') return json({ key: await lobby.pushKey() });
    if (path === '/api/push/sub' && req.method === 'POST') {
      const b = await req.json().catch(() => ({})), ep = String(b.endpoint || ''), k = b.keys || {};
      const local = ['127.0.0.1', 'localhost'].includes(url.hostname) && /^http:\/\/127\.0\.0\.1:\d+\//.test(ep); // 시험용 가짜 푸시 서버 (내 PC에서만)
      let host = ''; try { host = new URL(ep).hostname; } catch {}
      const known = /^https:\/\//.test(ep) && /(^|\.)(googleapis\.com|mozilla\.com|mozaws\.net|windows\.com|push\.apple\.com)$/.test(host); // 크롬·삼성·엣지·파이어폭스·사파리 푸시 서버
      if ((!known && !local) || ep.length > 1000 || !k.p256dh || !k.auth) return err('알림 구독 정보가 맞지 않아요.');
      return json({ ok: await lobby.pushSub(uid, { endpoint: ep, p256dh: String(k.p256dh).slice(0, 200), auth: String(k.auth).slice(0, 100) }, url.origin) });
    }
    if (path === '/api/push/unsub' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json({ ok: await lobby.pushUnsub(uid, String(b.endpoint || '')) }); }
    if (path === '/api/push/test' && req.method === 'POST') return json(await lobby.notify(uid, { title: '알림 시험', body: '상대가 차례를 끝내면 이렇게 알려 드려요.', url: '/#lobby', tag: 'test' }));
    if (path === '/api/decks' && req.method === 'GET') return json({ decks: await lobby.decks(uid) });
    if (path === '/api/decks' && req.method === 'POST') {
      const b = await req.json(); const idx = await cardIndex(env, req);
      const list = (b.list || []).filter(x => idx.byId[x.id] && x.n > 0).map(x => ({ id: x.id, n: Math.min(60, x.n | 0), ...(x.c ? { c: 1 } : {}) })); // c: 덱 목록에 겹쳐 보일 대표 카드
      const chk = checkDeck(list, idx);
      return json({ deck: await lobby.saveDeck(uid, { id: b.id, name: String(b.name || '이름 없는 덱').slice(0, 30), list, ok: chk.ok }), check: chk });
    }
    if ((m = path.match(/^\/api\/decks\/(\w+)$/)) && req.method === 'DELETE') return json({ ok: await lobby.deleteDeck(uid, m[1]) });
    if (path === '/api/rooms' && req.method === 'GET') return json(await lobby.rooms(uid));
    if (path === '/api/rooms' && req.method === 'POST') {
      const b = await req.json();
      const cfg = {
        mode: b.mode === 'async' ? 'async' : 'live', deadlineH: [12, 24, 48, 72].includes(+b.deadlineH) ? +b.deadlineH : 24,
        bestOf: +b.bestOf === 3 ? 3 : 1, spectate: b.spectate === 'no' ? 'no' : b.spectate === 'open' ? 'open' : 'yes',
        invite: String(b.invite || '').trim().slice(0, 12), title: String(b.title || '').trim().slice(0, 30),
      };
      const deck = await lobby.deck(uid, b.deckId); if (!deck) return err('덱을 골라 주세요.');
      return json({ room: await lobby.createRoom(uid, cfg, deck.id) });
    }
    if ((m = path.match(/^\/api\/rooms\/(\w+)\/join$/)) && req.method === 'POST') {
      const b = await req.json(); const deck = await lobby.deck(uid, b.deckId); if (!deck) return err('덱을 골라 주세요.');
      const r = await lobby.joinRoom(uid, m[1], deck.id); if (r.error) return err(r.error);
      return json({ room: await startGame(env, req, lobby, r.room, uid) });
    }
    if ((m = path.match(/^\/api\/rooms\/(\w+)\/next$/)) && req.method === 'POST') {
      const room = await lobby.room(m[1]); if (!room || !room.players.includes(uid)) return err('방을 찾을 수 없어요.');
      if (room.status !== 'between') return err('지금은 다음 판을 시작할 수 없어요.');
      return json({ room: await startGame(env, req, lobby, room, uid) });
    }
    if ((m = path.match(/^\/api\/rooms\/(\w+)\/close$/)) && req.method === 'POST') return json({ ok: await lobby.closeRoom(uid, m[1]) });
    if ((m = path.match(/^\/api\/rooms\/(\w+)\/follow$/)) && req.method === 'POST') {
      const room = await lobby.room(m[1]); if (!room) return err('방을 찾을 수 없어요.', 404);
      const b = await req.json().catch(() => ({})); return json({ follow: await lobby.follow(uid, room.id, !!b.on) });
    }
    if ((m = path.match(/^\/api\/rooms\/(\w+)\/follow$/))) return json({ follow: await lobby.following(uid, m[1]) });
    if ((m = path.match(/^\/api\/admin\/rooms\/(\w+)\/(end|delete)$/)) && req.method === 'POST') { // 관리자: 진행 중·끝난 판 끝내기 / 지우기
      if (!await isAdmin(env, lobby, me)) return err('관리자만 할 수 있어요.', 403);
      const room = await lobby.room(m[1]); if (!room) return err('방을 찾을 수 없어요.', 404);
      if (m[2] === 'end') {
        const last = room.games[room.games.length - 1];
        if (last && room.status === 'playing') await env.GAME.get(env.GAME.idFromName(last)).adminEnd(me.name);
        return json({ ok: await lobby.adminEnd(room.id) });
      }
      for (const gid of room.games) await env.GAME.get(env.GAME.idFromName(gid)).wipe();
      return json({ ok: await lobby.adminDelete(room.id) });
    }
    if ((m = path.match(/^\/api\/games\/([\w-]+)\/(at|info)$/))) {
      const g = env.GAME.get(env.GAME.idFromName(m[1]));
      const r = await g.history(uid, m[2] === 'at' ? +url.searchParams.get('k') : -1);
      return r.error ? err(r.error, 404) : json(r);
    }
    if ((m = path.match(/^\/ws\/game\/([\w-]+)$/))) {
      if (req.headers.get('upgrade') !== 'websocket') return err('웹소켓이 필요해요.', 426);
      const g = env.GAME.get(env.GAME.idFromName(m[1]));
      const h = new Headers(req.headers); h.set('x-uid', uid); h.set('x-name', encodeURIComponent(me.name));
      return g.fetch(new Request(req.url, { headers: h }));
    }
    return err('없는 주소예요.', 404);
  },
};

async function startGame(env, req, lobby, room, actorUid) {
  const idx = await cardIndex(env, req);
  const decks = await Promise.all(room.players.map((u, k) => lobby.deck(u, room.decks[k])));
  const users = await Promise.all(room.players.map(u => lobby.user(u)));
  const cards = {};
  for (const d of decks) for (const { id } of d.list) cards[id] = withEvo(idx.byId[id], EVO);
  const gameId = room.id + '-' + (room.games.length + 1);
  const init = { seed: rid(16), rv: 2, cfg: { ...room.cfg, roomId: room.id, game: room.games.length + 1 }, cards, // rv: 규칙 판 (2 = 카드 글 도우미 규칙)
    players: room.players.map((u, k) => ({ uid: u, name: users[k].name, deck: expand(decks[k].list) })) };
  const g = env.GAME.get(env.GAME.idFromName(gameId));
  await lobby.gameStarted(room.id, gameId); // 방에 판을 먼저 붙여야 판 시작 알림·남은 시간이 바로 들어감
  await g.start(gameId, init, actorUid);
  return lobby.room(room.id);
}

// ---------------- 로비: 회원, 덱, 방 ----------------
export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY, name TEXT UNIQUE, created INTEGER);
      CREATE TABLE IF NOT EXISTS decks(id TEXT PRIMARY KEY, uid TEXT, name TEXT, list TEXT, ok INTEGER, updated INTEGER);
      CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, host TEXT, cfg TEXT, status TEXT, players TEXT, decks TEXT, games TEXT, wins TEXT, waiting TEXT, phase TEXT, turn INTEGER, deadline INTEGER, updated INTEGER);
      CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS cardsblob(i INTEGER PRIMARY KEY, data BLOB);
      CREATE TABLE IF NOT EXISTS prefs(uid TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS imgs(id TEXT PRIMARY KEY, owner TEXT, kind TEXT, type TEXT, data BLOB, meta TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS push(endpoint TEXT PRIMARY KEY, uid TEXT, p256dh TEXT, auth TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS follows(uid TEXT, room TEXT, PRIMARY KEY(uid, room));
      CREATE TABLE IF NOT EXISTS logins(uid TEXT, t INTEGER, dev TEXT);
      CREATE TABLE IF NOT EXISTS results(gid TEXT PRIMARY KEY, room TEXT, a TEXT, b TEXT, winner INTEGER, turns INTEGER, how TEXT, ended INTEGER);`);
    const cols = new Set(this.sql.exec('PRAGMA table_info(users)').toArray().map(c => c.name));
    for (const [c, ty] of [['pw', 'TEXT'], ['tv', 'INTEGER DEFAULT 0'], ['temp', 'INTEGER DEFAULT 0'], ['seen', 'INTEGER'], ['last', 'INTEGER'], ['nlog', 'INTEGER DEFAULT 0']])
      if (!cols.has(c)) this.sql.exec(`ALTER TABLE users ADD COLUMN ${c} ${ty}`);
    this.lim = new Map(); // 비밀번호·코드 틀린 횟수 (메모리에만)
  }
  // ---- 회원: 비밀번호, 접속 기록 ----
  cardsHash() { const r = this.sql.exec("SELECT v FROM kv WHERE k='cardsh'").toArray()[0]; return r ? JSON.parse(r.v) : null; }
  saveCards(h, data) { // 압축한 카드 자료를 1MB씩 나눠 보관 (한 칸 크기 제한 때문)
    this.sql.exec('DELETE FROM cardsblob');
    for (let i = 0, n = 0; i < data.length; i += 1 << 20, n++) this.sql.exec('INSERT INTO cardsblob VALUES(?,?)', n, data.subarray(i, i + (1 << 20)));
    this.sql.exec("INSERT OR REPLACE INTO kv VALUES('cardsh',?)", JSON.stringify(h));
  }
  loadCards() {
    const h = this.cardsHash(); if (!h) return null;
    const parts = this.sql.exec('SELECT data FROM cardsblob ORDER BY i').toArray().map(r => new Uint8Array(r.data));
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return { h, data: out };
  }
  secret() {
    let r = this.one("SELECT v FROM kv WHERE k='secret'"); if (r) return JSON.parse(r.v);
    const v = b64(crypto.getRandomValues(new Uint8Array(32))); this.sql.exec("INSERT OR REPLACE INTO kv VALUES('secret',?)", JSON.stringify(v)); return v;
  }
  locked(key) { const x = key && this.lim.get(key); return x && x.until > Date.now() ? Math.ceil((x.until - Date.now()) / 60e3) : 0; }
  failed(key, max = 6) { // 10분 안에 여러 번 틀리면 5분 쉬기
    if (!key) return;
    const now = Date.now(); let x = this.lim.get(key);
    if (!x || now - x.t0 > 10 * 60e3) x = { n: 0, t0: now, until: 0 };
    if (++x.n >= max) Object.assign(x, { n: 0, t0: now, until: now + 5 * 60e3 });
    this.lim.set(key, x);
  }
  logged(uid, dev) {
    const now = Date.now();
    this.sql.exec('UPDATE users SET last=?, seen=?, nlog=COALESCE(nlog,0)+1 WHERE uid=?', now, now, uid);
    this.sql.exec('INSERT INTO logins VALUES(?,?,?)', uid, now, dev);
    this.sql.exec('DELETE FROM logins WHERE uid=? AND t NOT IN (SELECT t FROM logins WHERE uid=? ORDER BY t DESC LIMIT 20)', uid, uid);
  }
  async signin(name, pw, ip, dev) {
    if (!name || !pw) return { error: '닉네임과 비밀번호를 넣어 주세요.' };
    const key = 'p:' + name, ik = ip === 'local' ? '' : 'i:' + ip, wait = Math.max(this.locked(key), this.locked(ik)); // 닉네임별 6번, 같은 곳(접속 주소)에서 여러 닉네임 합쳐 20번
    if (wait) return { error: `비밀번호를 여러 번 틀렸어요. ${wait}분 뒤에 다시 해 주세요.`, status: 429 };
    const u = this.one('SELECT uid,name,pw,tv,temp FROM users WHERE name=?', name);
    if (!u) { this.failed(ik, 20); return { error: "그 닉네임은 아직 없어요. 처음 왔다면 '처음 왔어요'에서 가입해 주세요.", status: 404, need: 'signup' }; }
    if (!u.pw) return { error: "이 닉네임은 아직 비밀번호가 없어요. '처음 왔어요'에서 모임 코드와 새 비밀번호를 넣으면 이 닉네임 그대로 쓸 수 있어요.", status: 409, need: 'claim' };
    if (!await pwCheck(u.pw, pw)) { this.failed(key); this.failed(ik, 20); return { error: '비밀번호가 맞지 않아요.', status: 403 }; }
    this.lim.delete(key); this.logged(u.uid, dev);
    return { user: { uid: u.uid, name: u.name, must: !!u.temp }, tv: u.tv | 0 };
  }
  async signup(name, pw, codeOk, ip, dev) {
    const key = 'c:' + ip, wait = this.locked(key);
    if (wait) return { error: `입장 코드를 여러 번 틀렸어요. ${wait}분 뒤에 다시 해 주세요.`, status: 429 };
    if (!codeOk) { this.failed(key); return { error: '모임 입장 코드가 맞지 않아요.', status: 403 }; }
    if (!name) return { error: '닉네임을 넣어 주세요.' };
    if (pw.length < 4 || pw.length > 64) return { error: '비밀번호는 4자 이상으로 정해 주세요.' };
    let u = this.one('SELECT uid,name,pw,tv FROM users WHERE name=?', name);
    if (u && u.pw) return { error: "이미 쓰고 있는 닉네임이에요. 내 닉네임이면 '로그인'에서 들어가 주세요.", status: 409 };
    const h = await pwHash(pw);
    if (u) this.sql.exec('UPDATE users SET pw=?, temp=0 WHERE uid=?', h, u.uid); // 비밀번호가 없던 예전 닉네임: 입장 코드로 이어 쓰기
    else { u = { uid: 'u' + rid(8), name, tv: 0 }; this.sql.exec('INSERT INTO users(uid,name,created,pw,tv,temp) VALUES(?,?,?,?,0,0)', u.uid, name, Date.now(), h); }
    this.logged(u.uid, dev);
    return { user: { uid: u.uid, name, must: false }, tv: u.tv | 0 };
  }
  auth(uid, tv) { // 요청마다: 토큰 버전 확인 + 마지막 접속 (1분에 한 번만 저장)
    const u = this.one('SELECT uid,name,tv,temp,seen FROM users WHERE uid=?', uid);
    if (!u || (u.tv | 0) !== tv) return null;
    const now = Date.now(); if (!u.seen || now - u.seen > 60e3) this.sql.exec('UPDATE users SET seen=? WHERE uid=?', now, uid);
    return { uid: u.uid, name: u.name, must: !!u.temp };
  }
  async setPw(uid, old, pw) {
    const u = this.one('SELECT pw,tv,temp FROM users WHERE uid=?', uid); if (!u) return { error: '로그인이 필요해요.', status: 401 };
    const key = 'o:' + uid, wait = this.locked(key);
    if (wait) return { error: `비밀번호를 여러 번 틀렸어요. ${wait}분 뒤에 다시 해 주세요.`, status: 429 };
    if (!u.temp && u.pw && !await pwCheck(u.pw, old)) { this.failed(key); return { error: '지금 비밀번호가 맞지 않아요.', status: 403 }; }
    this.lim.delete(key);
    if (pw.length < 4 || pw.length > 64) return { error: '새 비밀번호는 4자 이상으로 정해 주세요.' };
    const tv = (u.tv | 0) + 1;
    this.sql.exec('UPDATE users SET pw=?, temp=0, tv=? WHERE uid=?', await pwHash(pw), tv, uid);
    return { tv };
  }
  async adminReset(uid) { // 임시 비밀번호를 만들어 관리자에게 보여 줌. 그 사람의 모든 기기는 로그아웃
    const u = this.one('SELECT name,tv FROM users WHERE uid=?', uid); if (!u) return { error: '없는 회원이에요.' };
    const temp = rid(8);
    this.sql.exec('UPDATE users SET pw=?, temp=1, tv=? WHERE uid=?', await pwHash(temp), (u.tv | 0) + 1, uid);
    return { temp, name: u.name };
  }
  // ---- 전적 ----
  async fillResults() { // 전적 기능 전에 끝난 판도 한 번만 채움 (각 판에 결과를 물어봄)
    if (this.one("SELECT v FROM kv WHERE k='resfill'")) return;
    const have = new Set(this.sql.exec('SELECT gid FROM results').toArray().map(x => x.gid));
    for (const r of this.sql.exec('SELECT * FROM rooms').toArray().map(x => this.rowRoom(x))) for (const gid of r.games) {
      if (have.has(gid)) continue;
      try { const o = await this.env.GAME.get(this.env.GAME.idFromName(gid)).outcome(); if (o) this.sql.exec('INSERT OR REPLACE INTO results VALUES(?,?,?,?,?,?,?,?)', gid, r.id, r.players[0], r.players[1], o.winner ?? -1, o.turn || 0, o.how || '', o.t || Date.now()); } catch {}
    }
    this.sql.exec("INSERT OR REPLACE INTO kv VALUES('resfill','1')");
  }
  async stats(uid) {
    await this.fillResults();
    const names = Object.fromEntries(this.sql.exec('SELECT uid,name FROM users').toArray().map(u => [u.uid, u.name]));
    const titles = Object.fromEntries(this.sql.exec('SELECT id,cfg FROM rooms').toArray().map(r => [r.id, JSON.parse(r.cfg).title || '']));
    const rows = this.sql.exec('SELECT * FROM results WHERE a=? OR b=? ORDER BY ended DESC', uid, uid).toArray();
    const tot = { w: 0, l: 0, d: 0 }, by = {}, recent = [];
    for (const r of rows) {
      const seat = r.a === uid ? 0 : 1, opp = seat ? r.a : r.b, res = r.winner < 0 ? 'd' : r.winner === seat ? 'w' : 'l';
      tot[res]++; const o = by[opp] ||= { uid: opp, name: names[opp] || '(지운 회원)', w: 0, l: 0, d: 0, last: r.ended }; o[res]++;
      if (recent.length < 30) recent.push({ gid: r.gid, room: r.room, title: titles[r.room] || '', opp: names[opp] || '(지운 회원)', res, turns: r.turns, how: r.how, ended: r.ended });
    }
    return { total: tot, opps: Object.values(by).sort((a, b) => (b.w + b.l + b.d) - (a.w + a.l + a.d) || b.last - a.last), recent };
  }
  async members(admins, byName) { // 관리자 화면: 가입일, 마지막 접속, 로그인 횟수·기기, 전적
    await this.fillResults();
    const users = this.sql.exec('SELECT uid,name,created,seen,last,nlog,pw,temp FROM users ORDER BY created').toArray();
    const res = this.sql.exec('SELECT a,b,winner FROM results').toArray();
    return users.map(u => {
      const s = { w: 0, l: 0, d: 0 };
      for (const r of res) { const seat = r.a === u.uid ? 0 : r.b === u.uid ? 1 : -1; if (seat < 0) continue; s[r.winner < 0 ? 'd' : r.winner === seat ? 'w' : 'l']++; }
      const logins = this.sql.exec('SELECT t,dev FROM logins WHERE uid=? ORDER BY t DESC LIMIT 10', u.uid).toArray();
      return { uid: u.uid, name: u.name, created: u.created, seen: u.seen || null, last: u.last || null, nlog: u.nlog || 0, pw: u.pw ? (u.temp ? 'temp' : 'set') : 'none', admin: admins.includes(byName ? u.name : u.uid), ...s, logins };
    });
  }
  // ---- 푸시 알림 ----
  async vapid() {
    const r = this.one("SELECT v FROM kv WHERE k='vapid'"); if (r) return JSON.parse(r.v);
    const v = await makeVapid(); this.sql.exec("INSERT OR REPLACE INTO kv VALUES('vapid',?)", JSON.stringify(v)); return v;
  }
  async pushKey() { return (await this.vapid()).pub; }
  pushSub(uid, s, origin) {
    this.sql.exec('INSERT OR REPLACE INTO push VALUES(?,?,?,?,?)', s.endpoint, uid, s.p256dh, s.auth, Date.now());
    if (/^https:/.test(origin)) this.sql.exec("INSERT OR REPLACE INTO kv VALUES('origin',?)", JSON.stringify(origin));
    return true;
  }
  pushUnsub(uid, endpoint) { this.sql.exec('DELETE FROM push WHERE endpoint=? AND uid=?', endpoint, uid); return true; }
  follow(uid, roomId, on) { // 관전판 알림 받기
    if (on) this.sql.exec('INSERT OR REPLACE INTO follows VALUES(?,?)', uid, roomId); else this.sql.exec('DELETE FROM follows WHERE uid=? AND room=?', uid, roomId);
    return !!on;
  }
  following(uid, roomId) { return !!this.one('SELECT 1 AS x FROM follows WHERE uid=? AND room=?', uid, roomId); }
  async notify(uid, data) { // 그 사람의 모든 기기로. 구독이 끝난 기기(404·410)는 지움
    const subs = this.sql.exec('SELECT endpoint,p256dh,auth FROM push WHERE uid=?', uid).toArray(); if (!subs.length) return { sent: 0, ok: 0 };
    const vapid = await this.vapid(), origin = JSON.parse(this.one("SELECT v FROM kv WHERE k='origin'")?.v || 'null');
    const subject = origin || 'mailto:npcg@localhost';
    const res = await Promise.all(subs.map(s => Promise.race([sendPush(s, data, vapid, subject, data.tag).catch(() => 0), new Promise(r => setTimeout(() => r(0), 5000))])));
    res.forEach((st, i) => { if (st === 404 || st === 410) this.sql.exec('DELETE FROM push WHERE endpoint=?', subs[i].endpoint); });
    return { sent: subs.length, ok: res.filter(st => st >= 200 && st < 300).length };
  }
  one(q, ...a) { return this.sql.exec(q, ...a).toArray()[0] || null; }
  user(uid) { return this.one('SELECT uid,name FROM users WHERE uid=?', uid); }
  firstUser() { return this.one('SELECT uid FROM users ORDER BY created LIMIT 1')?.uid || null; }
  // 꾸미기: 모임 기본값(kv 'group'), 각자 고른 것(prefs), 올린 사진(imgs: owner '*' = 모임 사진)
  skin(uid) {
    const imgs = owner => Object.fromEntries(this.sql.exec('SELECT id,kind,meta FROM imgs WHERE owner=?', owner).toArray().map(r => [r.kind, { id: r.id, ...JSON.parse(r.meta || '{}') }]));
    const p = this.one('SELECT v FROM prefs WHERE uid=?', uid);
    return { group: JSON.parse(this.one("SELECT v FROM kv WHERE k='group'")?.v || '{}'), prefs: p ? JSON.parse(p.v) : null, imgs: imgs(uid), gimgs: imgs('*') };
  }
  setPrefs(uid, o) {
    const cur = JSON.parse(this.one('SELECT v FROM prefs WHERE uid=?', uid)?.v || '{}');
    this.sql.exec('INSERT OR REPLACE INTO prefs VALUES(?,?)', uid, JSON.stringify({ back: 'group', mat: 'group', art: 'group', ...cur, ...o }));
  }
  setGroup(o) {
    const cur = JSON.parse(this.one("SELECT v FROM kv WHERE k='group'")?.v || '{}');
    this.sql.exec("INSERT OR REPLACE INTO kv VALUES('group',?)", JSON.stringify({ ...cur, ...o }));
  }
  putImg(owner, kind, type, data, meta) {
    this.sql.exec('DELETE FROM imgs WHERE owner=? AND kind=?', owner, kind);
    const id = 'i' + rid(12);
    this.sql.exec('INSERT INTO imgs VALUES(?,?,?,?,?,?,?)', id, owner, kind, type, data, JSON.stringify(meta), Date.now());
    if (owner === '*') this.setGroup({ [kind]: 'custom' }); else this.setPrefs(owner, { [kind]: 'mine' }); // 올리면 바로 그 사진으로
    return id;
  }
  delImg(owner, kind) {
    this.sql.exec('DELETE FROM imgs WHERE owner=? AND kind=?', owner, kind);
    if (owner === '*') { const g = JSON.parse(this.one("SELECT v FROM kv WHERE k='group'")?.v || '{}'); if (g[kind] === 'custom') { delete g[kind]; this.sql.exec("INSERT OR REPLACE INTO kv VALUES('group',?)", JSON.stringify(g)); } }
    else { const p = JSON.parse(this.one('SELECT v FROM prefs WHERE uid=?', owner)?.v || '{}'); if (p[kind] === 'mine') this.setPrefs(owner, { [kind]: 'group' }); }
    return true;
  }
  img(id) { const r = this.one('SELECT type,data FROM imgs WHERE id=?', id); return r && { type: r.type, data: r.data }; }
  decks(uid) { return this.sql.exec('SELECT id,name,list,ok,updated FROM decks WHERE uid=? ORDER BY updated DESC', uid).toArray().map(d => ({ ...d, list: JSON.parse(d.list), ok: !!d.ok })); }
  deck(uid, id) { const d = this.one('SELECT id,name,list,ok FROM decks WHERE uid=? AND id=?', uid, id); return d && { ...d, list: JSON.parse(d.list) }; }
  saveDeck(uid, d) {
    const id = d.id && this.one('SELECT id FROM decks WHERE id=? AND uid=?', d.id, uid) ? d.id : 'd' + rid(8);
    this.sql.exec('INSERT OR REPLACE INTO decks VALUES(?,?,?,?,?,?)', id, uid, d.name, JSON.stringify(d.list), d.ok ? 1 : 0, Date.now());
    return { id, name: d.name, list: d.list, ok: d.ok };
  }
  deleteDeck(uid, id) { this.sql.exec('DELETE FROM decks WHERE uid=? AND id=?', uid, id); return true; }
  rowRoom(r) { return r && { ...r, cfg: JSON.parse(r.cfg), players: JSON.parse(r.players), decks: JSON.parse(r.decks), games: JSON.parse(r.games), wins: JSON.parse(r.wins), waiting: JSON.parse(r.waiting || '[]') }; }
  room(id) { return this.rowRoom(this.one('SELECT * FROM rooms WHERE id=?', id)); }
  saveRoom(r) {
    this.sql.exec('INSERT OR REPLACE INTO rooms VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', r.id, r.host, JSON.stringify(r.cfg), r.status, JSON.stringify(r.players), JSON.stringify(r.decks),
      JSON.stringify(r.games), JSON.stringify(r.wins), JSON.stringify(r.waiting || []), r.phase || '', r.turn || 0, r.deadline || 0, Date.now());
    return r;
  }
  createRoom(uid, cfg, deckId) {
    return this.saveRoom({ id: 'r' + rid(6), host: uid, cfg, status: 'open', players: [uid], decks: [deckId], games: [], wins: [0, 0], waiting: [] });
  }
  joinRoom(uid, id, deckId) {
    const r = this.room(id); if (!r) return { error: '방을 찾을 수 없어요.' };
    if (r.status !== 'open') return { error: '이미 시작한 방이에요.' };
    if (r.players.includes(uid)) return { error: '내가 만든 방이에요. 다른 사람이 들어와야 시작해요.' };
    const u = this.user(uid);
    if (r.cfg.invite && r.cfg.invite !== u.name) return { error: '초대받은 사람만 들어올 수 있어요.' };
    r.players.push(uid); r.decks.push(deckId); this.saveRoom(r); return { room: r };
  }
  gameStarted(id, gameId) { const r = this.room(id); r.games.push(gameId); r.status = 'playing'; return this.saveRoom(r); }
  closeRoom(uid, id) { const r = this.room(id); if (!r || r.host !== uid || r.status !== 'open') return false; this.sql.exec('DELETE FROM rooms WHERE id=?', id); return true; }
  adminEnd(id) { const r = this.room(id); if (!r) return false; if (r.status === 'open') { this.sql.exec('DELETE FROM rooms WHERE id=?', id); return true; } r.status = 'done'; r.waiting = []; r.deadline = 0; this.saveRoom(r); return true; }
  adminDelete(id) { this.sql.exec('DELETE FROM rooms WHERE id=?', id); this.sql.exec('DELETE FROM follows WHERE room=?', id); this.sql.exec('DELETE FROM results WHERE room=?', id); return true; }
  // 대전 DO 가 판 상태를 알려 줌
  async gameUpdate(roomId, gameId, u) {
    const r = this.room(roomId); if (!r || r.games[r.games.length - 1] !== gameId) return;
    const old = { waiting: r.waiting || [], turn: r.turn, phase: r.phase };
    r.waiting = u.waiting; r.phase = u.phase; r.turn = u.turn; r.deadline = u.deadline || 0;
    if (u.phase === 'over' && r.status === 'playing') {
      if (u.winner != null) r.wins[u.winner]++;
      const need = Math.ceil(r.cfg.bestOf / 2);
      r.status = r.wins.some(w => w >= need) ? 'done' : 'between';
    }
    this.saveRoom(r);
    if (u.phase === 'over' && old.phase !== 'over') this.sql.exec('INSERT OR REPLACE INTO results VALUES(?,?,?,?,?,?,?,?)', gameId, r.id, r.players[0], r.players[1], u.winner ?? -1, u.turn || 0, u.how || '', Date.now());
    if (u.actor) this.sql.exec('UPDATE users SET seen=? WHERE uid=?', Date.now(), u.actor);
    const quiet = new Set([...(u.online || []), u.actor].filter(Boolean)); // 지금 판을 보고 있는 사람, 방금 둔 사람은 빼고
    const names = r.players.map(p => this.user(p)?.name || '상대'), tail = r.cfg.title ? ` · ${r.cfg.title}` : '', vs = r.cfg.title || names.join(' vs ');
    const jobs = [], done = new Set();
    const send = (who, title, body) => { if (!who || quiet.has(who) || done.has(who)) return; done.add(who); jobs.push(this.notify(who, { title, body, url: '/#game/' + gameId, tag: r.id })); };
    const ended = u.phase === 'over' && old.phase !== 'over';
    if (r.cfg.mode === 'async') { // 두 사람: 비동기 판만 (실시간 판은 둘 다 보고 있음)
      if (ended) for (const seat of [0, 1]) send(r.players[seat], '판이 끝났어요', (u.winner == null ? '승부 없이 끝났어요' : u.winner === seat ? `${names[1 - seat]} 님과의 판에서 이겼어요!` : `${names[1 - seat]} 님이 이겼어요`) + tail);
      else for (const seat of u.waiting.filter(x => !old.waiting.includes(x))) {
        const opp = names[1 - seat];
        if (u.phase === 'setup') send(r.players[seat], '판이 시작됐어요', `${opp} 님과의 판이에요. 첫 포켓몬을 골라 주세요` + tail);
        else if (u.turn > (old.turn || 0)) send(r.players[seat], '내 차례예요', `${opp} 님이 차례를 끝냈어요` + tail);
        else send(r.players[seat], '대답을 기다려요', `${opp} 님이 확인을 기다려요` + tail);
      }
    }
    // 관전 알림을 켠 사람: 차례가 끝날 때마다, 판이 끝나면 (실시간·비동기 모두, 직접 켠 판만)
    const fans = this.sql.exec('SELECT uid FROM follows WHERE room=?', r.id).toArray().map(x => x.uid).filter(x => !r.players.includes(x));
    if (fans.length && (ended || (u.phase === 'play' && old.phase === 'play' && u.turn > (old.turn || 0) && u.current != null))) {
      const body = ended ? (u.winner == null ? '승부 없이 끝났어요' : `${names[u.winner]} 님이 이겼어요`) : `${names[1 - u.current]} 님이 차례를 끝냈어요 · 이제 ${names[u.current]} 님 차례`;
      for (const f of fans) send(f, `관전 · ${vs}`, body);
    }
    await Promise.all(jobs);
  }
  rooms(uid) {
    const all = this.sql.exec("SELECT * FROM rooms WHERE status!='done' OR updated>? ORDER BY updated DESC LIMIT 200", Date.now() - 14 * 864e5).toArray().map(x => this.rowRoom(x));
    const names = Object.fromEntries(this.sql.exec('SELECT uid,name FROM users').toArray().map(u => [u.uid, u.name]));
    const fl = new Set(this.sql.exec('SELECT room FROM follows WHERE uid=?', uid).toArray().map(x => x.room));
    for (const r of all) { r.names = r.players.map(p => names[p] || '?'); r.mine = r.players.includes(uid); r.myTurn = r.mine && r.waiting.includes(r.players.indexOf(uid)) && ['playing'].includes(r.status); r.follow = fl.has(r.id); }
    all.sort((a, b) => (b.myTurn - a.myTurn) || ((a.myTurn && b.myTurn) ? (a.deadline || 9e15) - (b.deadline || 9e15) : 0));
    return { rooms: all, me: uid };
  }
}

// ---------------- 대전 한 판 ----------------
export class Game extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.sql = ctx.storage.sql; this.mk();
    this.cache = null;
  }
  mk() { this.sql.exec(`CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS log(k INTEGER PRIMARY KEY, who INTEGER, a TEXT, t INTEGER);
      CREATE TABLE IF NOT EXISTS schat(k INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, text TEXT, t INTEGER);`); }
  specHist() { return this.sql.exec('SELECT name,text,t FROM (SELECT * FROM schat ORDER BY k DESC LIMIT 500) ORDER BY k').toArray(); } // 관전자 채팅은 쌓아 둠 (늦게 온 사람·다시 온 사람도 봄)
  seesSpec(G, a) { return a.seat == null || G.s.phase === 'over' || (a.sv && !G.init.cfg.muteSpec); } // 선수는 '대전 중에도 보기'를 켰을 때만
  async adminEnd(by) { // 관리자가 판 끝내기 (승자 없음). 보고 있는 사람에게 바로 보냄
    const G = this.load(); if (!G || G.s.phase === 'over') return false;
    const a = { type: 'adminEnd', by: String(by || '').slice(0, 20) }, t = Date.now();
    const r = apply(G.s, 0, a, G.log.length); if (!r.ok) { this.cache = null; return false; }
    G.log.push({ who: 0, a, t }); G.steps.push({ ok: true, ev: r.ev });
    this.sql.exec('INSERT INTO log VALUES(?,?,?,?)', G.log.length - 1, 0, JSON.stringify(a), t);
    this.push(G, false, G.log.length - 1); await this.report(G); return true;
  }
  outcome() { // 끝난 판이면 승자·차례·이유 (전적 채우기용)
    const G = this.load(); if (!G || G.s.phase !== 'over') return null;
    return { winner: G.s.winner, turn: G.s.turn, how: G.s.winReason || '', t: G.log.length ? G.log[G.log.length - 1].t : this.meta('created') };
  }
  async wipe() { // 관리자가 지우기: 기록을 모두 지우고 보고 있던 사람은 로비로
    for (const w of this.ctx.getWebSockets()) { try { w.send('{"t":"gone"}'); w.close(1000, 'deleted'); } catch {} }
    await this.ctx.storage.deleteAlarm(); await this.ctx.storage.deleteAll(); this.mk(); this.cache = null; return true;
  }
  meta(k) { const r = this.sql.exec('SELECT v FROM meta WHERE k=?', k).toArray()[0]; return r ? JSON.parse(r.v) : null; }
  setMeta(k, v) { this.sql.exec('INSERT OR REPLACE INTO meta VALUES(?,?)', k, JSON.stringify(v)); }
  loadLog() { return this.sql.exec('SELECT who,a,t FROM log ORDER BY k').toArray().map(r => ({ who: r.who, a: JSON.parse(r.a), t: r.t })); }
  load() {
    if (this.cache) return this.cache;
    const init = this.meta('init'); if (!init) return null;
    const log = this.loadLog();
    const R = replay(init, log);
    this.cache = { init, log, s: R.s, steps: R.steps, ev0: R.ev0, id: this.meta('id') };
    return this.cache;
  }
  async start(id, init, actorUid) {
    if (this.meta('init')) return;
    this.setMeta('id', id); this.setMeta('init', init); this.setMeta('created', Date.now());
    this.cache = null; const G = this.load(); await this.report(G, this.seatOf(G, actorUid));
  }
  seatOf(G, uid) { const k = G.init.players.findIndex(p => p.uid === uid); return k < 0 ? null : k; }
  specAll(G, seat) { return seat == null && G.init.cfg.spectate !== 'no'; } // 관전자는 모두 봄 (11/18 링크 님)
  lines(G, seat, from = 0) { // 사람마다 보이는 기록 줄
    const over = G.s.phase === 'over' || this.specAll(G, seat);
    const out = [];
    const push = (e, k, step) => {
      if (e.quiet && seat !== e.ownBy && !over) return;
      out.push({ k, txt: e.chat ? e.pub : fixJosa(e.pub), own: (over || seat === e.ownBy) ? fixJosa(e.own) || null : null, chat: !!e.chat, gid: step?.gid || null, rw: !!step?.rewound, who: k >= 0 ? G.log[k]?.who : null, t: k >= 0 ? G.log[k]?.t : null, turn: !!e.turn, ...(e.show ? { show: e.show, showT: e.showT || '' } : {}) });
    };
    if (from === 0) for (const e of G.ev0) push(e, -1);
    G.steps.forEach((st, k) => { if (k >= from) for (const e of st.ev) push(e, k, st); });
    return out;
  }
  view(G, seat) {
    const s = G.s, v = viewFor(s, this.specAll(G, seat) ? 'all' : seat == null ? 'spec' : seat);
    return { ...v, id: G.id, me: seat, n: G.log.length, deadline: this.deadline(G), cfg: G.init.cfg };
  }
  deadline(G) {
    if (G.init.cfg.mode !== 'async' || G.s.phase === 'over' || G.s.stop) return null; // 잠깐 멈춘 동안은 기한 시계도 멈춤
    const last = G.log.length ? G.log[G.log.length - 1].t : this.meta('created');
    return last + G.init.cfg.deadlineH * 3600e3;
  }
  // 판을 만들 때 저장한 카드 정보의 한글 칸(이름·그림·글)을 지금 카드 자료로 맞춤. 기록 줄 이름이 영어로 남지 않게 (한 번 맞추면 저장)
  async fresh() {
    if (this.kfresh) return; this.kfresh = true;
    try {
      const init = this.meta('init'); if (!init) return;
      const idx = await cardIndex(this.env, { url: 'https://assets.local/' }); let ch = false;
      for (const id in init.cards) { const c = init.cards[id], cur = idx.byId[id]; if (!c || !cur) continue;
        for (const f of ['kn', 'kimg', 'kab', 'kat', 'kr', 'kra', 'ksa', 'kmix', 'kmr', 'kset', 'kno', 'side', 'pair']) if (cur[f] !== undefined && JSON.stringify(cur[f]) !== JSON.stringify(c[f])) { c[f] = cur[f]; ch = true; } }
      if (ch) { this.setMeta('init', init); this.cache = null; }
    } catch (e) { console.log('fresh cards', e); }
  }
  async fetch(req) {
    await this.fresh();
    const G = this.load(); if (!G) return new Response('없는 판', { status: 404 });
    const uid = req.headers.get('x-uid'), name = decodeURIComponent(req.headers.get('x-name') || '');
    const seat = this.seatOf(G, uid);
    if (seat == null && G.init.cfg.spectate === 'no' && G.s.phase !== 'over') return new Response('관전이 꺼진 판이에요', { status: 403 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ uid, seat, name });
    pair[1].send(JSON.stringify({ t: 'full', view: this.view(G, seat), lines: this.lines(G, seat), cards: G.init.cards, specs: this.spectators(), room: G.init.cfg.roomId, schat: this.seesSpec(G, { seat }) ? this.specHist() : undefined }));
    this.broadcastSpecs();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  spectators() { // 지금 관전 중인 사람 (같은 사람이 창을 여러 개 열어도 한 명)
    const seen = new Set(), out = [];
    for (const w of this.ctx.getWebSockets()) { if (w.readyState !== 1) continue; const a = w.deserializeAttachment(); if (!a || a.seat != null) continue; const key = a.uid || a.name; if (seen.has(key)) continue; seen.add(key); out.push(a.name); }
    return out;
  }
  broadcastSpecs() { const sp = this.spectators(); for (const w of this.ctx.getWebSockets()) try { w.send(JSON.stringify({ t: 'specs', specs: sp })); } catch {} }
  async webSocketMessage(ws, msg) {
    const at = ws.deserializeAttachment(); let m; try { m = JSON.parse(msg); } catch { return; }
    await this.fresh();
    const G = this.load();
    if (m.t === 'ping') return ws.send('{"t":"pong"}');
    if (m.t === 'vis') { at.vis = m.v ? 1 : 0; ws.serializeAttachment(at); return; } // 화면을 보고 있는지 (안 보고 있으면 알림을 보냄)
    if (m.t === 'specView') { at.sv = m.on ? 1 : 0; ws.serializeAttachment(at); if (G && this.seesSpec(G, at)) ws.send(JSON.stringify({ t: 'specHist', list: this.specHist() })); return; } // 선수: 관전자 채팅 보기 켜고 끄기
    if (m.t === 'specChat' && at.seat == null) { // 관전자 채팅 (판에는 영향 없음, 쌓아 둠)
      const txt = String(m.text || '').trim().slice(0, 200); if (!txt) return;
      const t = Date.now(); this.sql.exec('INSERT INTO schat(name,text,t) VALUES(?,?,?)', at.name, txt, t);
      for (const w of this.ctx.getWebSockets()) { const a = w.deserializeAttachment(); if (a && this.seesSpec(G, a)) try { w.send(JSON.stringify({ t: 'spec', name: at.name, text: txt, ts: t })); } catch {} }
      return;
    }
    if (m.t !== 'act' || at.seat == null) return;
    const res = await this.act(at.seat, m.a);
    ws.send(JSON.stringify({ t: 'res', id: m.id, ...res }));
  }
  async webSocketClose(ws) { try { ws.close(); } catch {} this.broadcastSpecs(); }
  async act(seat, a) {
    const G = this.load();
    if (!a || typeof a.type !== 'string') return { ok: false, err: '잘못된 행동' };
    a = JSON.parse(JSON.stringify(a)); const t = Date.now();
    if (a.type === 'rewindOk') {
      const g = G.s.groups.find(x => x.start === (a.to | 0));
      if (!g || g.rewindBy == null || g.rewindBy === seat) return { ok: false, err: '되돌리기 요청이 없어요.' };
      a.salt = rid(12);
      this.sql.exec('INSERT INTO log VALUES(?,?,?,?)', G.log.length, seat, JSON.stringify(a), t);
      this.cache = null; const G2 = this.load();
      this.push(G2, true); await this.report(G2, seat); return { ok: true };
    }
    if (a.type === 'stopUndo') { // 잠깐 멈춤에서 지적받은 사람이 '그 행동 전으로 되돌리기'
      const st = G.s.stop;
      if (!st || st.to == null || st.by === seat) return { ok: false, err: '되돌릴 지적이 없어요.' };
      a.salt = rid(12);
      this.sql.exec('INSERT INTO log VALUES(?,?,?,?)', G.log.length, seat, JSON.stringify(a), t);
      this.cache = null; const G2 = this.load();
      this.push(G2, true); await this.report(G2, seat); return { ok: true };
    }
    if (a.type === 'timeout' || a.type === 'adminEnd') return { ok: false, err: '서버만 할 수 있어요.' };
    const r = apply(G.s, seat, a, G.log.length);
    if (!r.ok) { if (r.err || r.warn) { this.cache = null; } return { ok: false, err: r.err, warn: r.warn }; }
    // apply 가 실패하면 상태가 반쯤 바뀌었을 수 있어 캐시를 버린다 (위). 성공하면 기록.
    G.log.push({ who: seat, a, t }); G.steps.push({ ok: true, ev: r.ev, gid: r.gid });
    this.sql.exec('INSERT INTO log VALUES(?,?,?,?)', G.log.length - 1, seat, JSON.stringify(a), t);
    this.push(G, false, G.log.length - 1); await this.report(G, seat);
    return { ok: true };
  }
  push(G, full, from) {
    for (const w of this.ctx.getWebSockets()) {
      const at = w.deserializeAttachment(); if (!at) continue;
      try { w.send(JSON.stringify(full ? { t: 'full', view: this.view(G, at.seat), lines: this.lines(G, at.seat), cards: G.init.cards } : { t: 'upd', view: this.view(G, at.seat), lines: this.lines(G, at.seat, from) })); } catch {}
    }
  }
  async report(G, actor = null) {
    const dl = this.deadline(G);
    if (dl) await this.ctx.storage.setAlarm(dl); else await this.ctx.storage.deleteAlarm();
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('main'));
    const online = [...new Set(this.ctx.getWebSockets().map(w => w.deserializeAttachment()).filter(a => a && a.uid && a.vis !== 0).map(a => a.uid))]; // 화면을 보고 있는 사람 (관전자 포함)
    await lobby.gameUpdate(G.init.cfg.roomId, G.id, { waiting: waitingOn(G.s), phase: G.s.phase, turn: G.s.turn, current: G.s.current, winner: G.s.winner, how: G.s.winReason || '', deadline: dl, actor: actor == null ? null : G.init.players[actor]?.uid || null, online });
  }
  async alarm() {
    const G = this.load(); if (!G) return;
    const dl = this.deadline(G); if (!dl) return;
    if (Date.now() < dl - 1000) return void await this.ctx.storage.setAlarm(dl);
    const late = waitingOn(G.s); if (late.length !== 1) return; // 둘 다 늦으면 판정 보류 (사람이 정함)
    const a = { type: 'timeout', p: late[0] }; const r = apply(G.s, late[0], a, G.log.length);
    if (!r.ok) return;
    G.log.push({ who: late[0], a, t: Date.now() }); G.steps.push({ ok: true, ev: r.ev });
    this.sql.exec('INSERT INTO log VALUES(?,?,?,?)', G.log.length - 1, late[0], JSON.stringify(a), Date.now());
    this.push(G, false, G.log.length - 1); await this.report(G);
  }
  // 기보: k번째 행동까지의 장면 (진행 중이면 내 시점/관전 시점, 끝났으면 전체 공개)
  async history(uid, k) {
    await this.fresh();
    const G = this.load(); if (!G) return { error: '판을 찾을 수 없어요.' };
    const seat = this.seatOf(G, uid), over = G.s.phase === 'over';
    if (seat == null && G.init.cfg.spectate === 'no' && !over) return { error: '관전이 꺼진 판이에요.' };
    if (k < 0) return { n: G.log.length, lines: this.lines(G, seat), cards: G.init.cards, players: G.init.players.map(p => p.name), over, me: seat };
    k = Math.max(0, Math.min(G.log.length, k | 0));
    const R = replay(G.init, G.log, k);
    const v = viewFor(R.s, over || this.specAll(G, seat) ? 'all' : seat == null ? 'spec' : seat);
    return { k, n: G.log.length, view: v };
  }
}
