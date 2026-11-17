import KS from '/lib/ks.js';
import { indexCards, parseDeckList, checkDeck } from '/lib/deck.js';
import Sound from '/lib/sound.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const TYPE_KO = { Grass: '풀', Fire: '불꽃', Water: '물', Lightning: '번개', Psychic: '초', Fighting: '격투', Darkness: '악', Metal: '강철', Dragon: '드래곤', Colorless: '무색' };
const TYPE_COLOR = { Grass: '#5fb35a', Fire: '#e8503f', Water: '#3b8fd9', Lightning: '#f2c230', Psychic: '#a65ec2', Fighting: '#c0703a', Darkness: '#3d3d55', Metal: '#9aa4ad', Dragon: '#b59a3a', Colorless: '#e8e2d6' };
const COND_KO = { asleep: '잠듦', confused: '혼란', paralyzed: '마비', poisoned: '독', burned: '화상' };

let ME = null, ALL = null, IDX = null;

// ---------- 아이콘 (선 그림) ----------
const svg = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  battle: svg('<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>'),
  deck: svg('<rect x="8" y="3" width="12" height="16" rx="2"/><path d="M5 6.5V19a2 2 0 0 0 2 2h9"/>'),
  gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'),
  sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>'),
  bolt: svg('<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>'),
  door: svg('<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M14.5 12h.01"/>'),
  wait: svg('<path d="M7 3h10M7 21h10M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/>'),
  warn: svg('<path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4M12 17h.01"/>'),
  check: svg('<path d="M5 12.5 9.5 17 19 7"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};
const ringIcon = (ic, k = '', ping = false) => `<span class="ring ${k} ${ping ? 'ping' : ''}"><i>${ICON[ic]}</i></span>`;

// ---------- 꾸미기: 카드 뒷면·매트·카드 그림 ----------
// 관리자가 정한 모임 기본값(group) → 각자 고른 것(prefs: 'group' 이면 모임 기본 따르기, 'mine' 이면 내가 올린 사진)
const BACKS = [['ball', '기본'], ['ring', '링'], ['sea', '바다'], ['night', '밤하늘'], ['leaf', '숲'], ['sunset', '노을'], ['flame', '불꽃']];
const MATS = [['grass', '풀밭'], ['sky', '하늘'], ['sand', '바닷가'], ['snow', '눈밭'], ['sakura', '벚꽃'], ['night', '밤하늘'], ['autumn', '단풍']];
const SKIN_DEF = { back: 'ball', mat: 'grass', art: 'mix' };
const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
// 서버에서 받은 꾸미기 정보 (빠르게 그리려고 이 기기에도 같이 저장)
let SK = (() => { try { return JSON.parse(localStorage.getItem('skin') || 'null'); } catch { return null; } })() || { group: {}, prefs: null, imgs: {}, gimgs: {}, admin: false };
const imgUrl = im => `url(/api/img/${im.id})`;
function groupSkin(kind) { // 모임 기본값이 실제로 무엇인지 → { preset } 또는 { img }
  const g = SK.group?.[kind] || SKIN_DEF[kind];
  if (g === 'custom') return SK.gimgs?.[kind] ? { img: SK.gimgs[kind] } : { preset: SKIN_DEF[kind] };
  return { preset: g };
}
function effSkin(kind) { // 지금 내 화면에 보일 것
  const p = SK.prefs?.[kind] || 'group';
  if (p === 'mine') return SK.imgs?.[kind] ? { img: SK.imgs[kind] } : groupSkin(kind);
  if (p === 'group') return groupSkin(kind);
  return { preset: p };
}
let ART = 'mix';
function applySkin() {
  const b = document.body;
  [...b.classList].filter(c => /^(back|mat)-/.test(c)).forEach(c => b.classList.remove(c));
  const bk = effSkin('back'), mt = effSkin('mat');
  if (bk.img) { b.classList.add('back-custom'); b.style.setProperty('--bk-img', imgUrl(bk.img)); } else b.classList.add('back-' + bk.preset);
  if (mt.img) { b.classList.add('mat-custom', mt.img.dark ? 'mat-dark' : 'mat-light'); b.style.setProperty('--mt-img', imgUrl(mt.img)); } else b.classList.add('mat-' + mt.preset);
  const a = SK.prefs?.art || 'group';
  ART = a === 'group' ? (SK.group?.art || SKIN_DEF.art) : a;
}
function setSkin(info) { // /api/me 등에서 받은 꾸미기 정보 반영
  SK = { group: info.group || {}, prefs: info.prefs, imgs: info.imgs || {}, gimgs: info.gimgs || {}, admin: !!info.admin };
  try { localStorage.setItem('skin', JSON.stringify(SK)); } catch {}
  applySkin();
}
applySkin();
let meAt = 0;
async function loadMe() {
  const r = await api('/api/me'); ME = r.user; meAt = Date.now(); setSkin(r);
  if (!r.prefs) { // 예전에 이 기기에서 고른 것이 있으면 내 설정으로 옮김 (처음 한 번)
    const old = { back: pref('back', ''), mat: pref('mat', ''), art: pref('art', '') }, o = {};
    if (BACKS.some(x => x[0] === old.back) && old.back !== 'ball') o.back = old.back;
    if (MATS.some(x => x[0] === old.mat) && old.mat !== 'grass') o.mat = old.mat;
    if (['en', 'kr'].includes(old.art)) o.art = old.art;
    api('/api/prefs', o).then(setSkin).catch(() => {});
  }
}
async function api(path, body, method) {
  const r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({ error: '서버 응답을 읽지 못했어요.' }));
  if (r.status === 401 && path !== '/api/me') { ME = null; location.hash = '#login'; }
  if (!r.ok) throw new Error(j.error || '오류가 났어요.');
  return j;
}
function toast(m, ms = 2600) { const t = $('#toast'); t.textContent = m; t.hidden = false; Sound.sfx('notify'); clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms); }
async function loadCards() { if (!ALL) { ALL = await (await fetch('/cards.json')).json(); IDX = indexCards(ALL); } return ALL; }
// 카드 그림: mix = 판·손패는 영문 그림(워터마크 없음) + 한글 이름표, 크게 볼 때 한글 그림 / en = 모두 영문 / kr = 모두 한글
const ART_KINDS = [['mix', '판은 영문 그림, 크게 볼 때 한글 그림'], ['en', '모두 영문 그림'], ['kr', '모두 한글 그림']];
const hires = u => u ? u.replace(/\.png$/, '_hires.png') : null;
const cimg = c => c && (ART === 'kr' ? (c.kimg || c.img) : (c.img || c.kimg));
const bigImg = c => !c ? null : ART === 'en' ? (hires(c.img) || c.kimg) : (c.kimg || hires(c.img));
const cname = c => { if (!c) return '?'; if (c.kn) return c.kn; if (!c.ko) return c.n; let k = c.ko; if (/^Mega /.test(c.n)) k = '메가' + k; if (/ ex$/.test(c.n)) k += ' ex'; return k; };

// ---------- 선택 창 (뒤로 가기로 닫힘) ----------
const sheetStack = [];
function openSheet(html, onMount) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="in">${html}</div>`; sh.hidden = false; Sound.sfx('open');
  if (!sheetStack.length) history.pushState({ sheet: 1 }, '');
  sheetStack.push(1);
  sh.onclick = e => { if (e.target === sh || e.target.closest('[data-close]')) closeSheet(); };
  onMount && onMount(sh.firstElementChild);
}
function closeSheet(fromPop) {
  const sh = $('#sheet'); if (sh.hidden) return;
  sh.hidden = true; sh.innerHTML = ''; sheetStack.length = 0;
  if (!fromPop) history.back();
}
let backArmed = 0;
window.addEventListener('popstate', () => {
  if (!$('#sheet').hidden) { closeSheet(true); return; }
});
function pick(title, options) { // options: [{label, value, cls}]
  return new Promise(res => {
    openSheet(`<button class="x sm" data-close>닫기</button><h3>${esc(title)}</h3><div class="acts">${options.map((o, i) => `<button class="${o.cls || ''}" data-i="${i}">${o.label}</button>`).join('')}</div>`, el => {
      el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const o = options[+b.dataset.i]; closeSheet(); setTimeout(() => res(o.value), 30); });
    });
  });
}
function ask(title, html, okLabel = '확인', cls = 'primary') {
  return new Promise(res => {
    openSheet(`<h3>${esc(title)}</h3>${html}<div class="row" style="margin-top:12px"><button class="${cls}" data-ok>${okLabel}</button><button data-close>취소</button></div>`, el => {
      el.querySelector('[data-ok]').onclick = () => { const f = {}; el.querySelectorAll('[name]').forEach(x => { if (x.type === 'checkbox' && !x.checked) return; f[x.name] = x.value; }); closeSheet(); setTimeout(() => res(f), 30); };
      el.querySelector('[data-close]').addEventListener('click', () => res(null));
    });
  });
}

// ---------- 화면 이동 ----------
const NAV = [['#lobby', 'battle', '대전'], ['#decks', 'deck', '덱'], ['#settings', 'gear', '설정']];
function nav(cur) { $('#nav').innerHTML = ME ? NAV.map(([h, ic, l]) => `<a href="${h}" class="${cur === h ? 'on' : ''}" aria-label="${l}">${ICON[ic]}<span class="lb">${l}</span></a>`).join('') : ''; drawSnd(); }
function drawSnd() { // 머리의 소리 단추: 누르면 효과음·배경음악 모두 끄고 켬
  const b = $('#snd'); if (!b) return;
  const off = Sound.get('mute');
  b.hidden = false; b.classList.toggle('off', off); b.innerHTML = off ? ICON.mute : ICON.sound;
  b.setAttribute('aria-label', off ? '소리 켜기' : '소리 끄기');
  b.onclick = () => { Sound.set('mute', !off); drawSnd(); Sound.sfx('notify'); };
}
let leaveGame = null;
async function route() {
  if (leaveGame) { leaveGame(); leaveGame = null; }
  if (!ME) { try { await loadMe(); } catch { ME = null; } }
  else if (Date.now() - meAt > 60000) loadMe().catch(() => {}); // 관리자가 바꾼 모임 기본값을 가끔 다시 받아 옴
  const h = location.hash || '#lobby';
  if (!ME && h !== '#login') { location.hash = '#login'; return; }
  const [base, arg] = h.split('/');
  nav(base === '#me' ? '#settings' : base);
  Sound.music(base === '#game' ? 'battle' : 'lobby');
  if (base === '#login') return renderLogin();
  if (base === '#lobby') return renderLobby();
  if (base === '#decks') return renderDecks(arg);
  if (base === '#game') return renderGame(arg);
  if (base === '#replay') return renderReplay(arg, +(h.split('/')[2] || -1));
  if (base === '#me' || base === '#settings') return renderSettings();
  location.hash = '#lobby';
}
window.addEventListener('hashchange', route);
const go = h => { if (location.hash === h) route(); else location.hash = h; };

function renderLogin() {
  app.innerHTML = `<div class="card-box hero">
    <div class="logo">${ringIcon('bolt', '', true)}<div><h2>도란 카드 대전</h2><div class="muted small">우리 모임 카드 대전</div></div></div>
    <p class="muted">모임에서 받은 입장 코드와 대전에 쓸 이름을 넣어 주세요.</p>
    <label class="h">이름</label><input id="nm" maxlength="12" autocomplete="nickname" style="width:100%">
    <label class="h">입장 코드</label><input id="cd" type="password" style="width:100%">
    <button class="primary" id="go">들어가기</button></div>`;
  $('#go').onclick = async () => {
    try { const r = await api('/api/login', { name: $('#nm').value, code: $('#cd').value }); ME = r.user; await loadMe().catch(() => {}); location.hash = '#lobby'; }
    catch (e) { toast(e.message); }
  };
}
// ---------- 설정 (꾸미기는 내 계정에 저장, 소리는 이 기기에만) ----------
const backPv = sk => sk.img ? `<div class="pc back bk-img" style="--bk-img:${imgUrl(sk.img)}"><div class="cb"></div></div>` : `<div class="pc back bk-${sk.preset}"><div class="cb"></div></div>`;
const matPv = sk => sk.img ? `<div class="pv-mat mt-img ${sk.img.dark ? 'mt-dark' : 'mt-light'}" style="--mt-img:${imgUrl(sk.img)}"><i></i><i></i></div>` : `<div class="pv-mat mt-${sk.preset}"><i></i><i></i></div>`;
const addPv = kind => `<div class="pv-add ${kind === "back" ? "pa-back" : "pa-mat"}">${ICON.plus}</div>`;
const skinLabel = (kind, sk) => sk.img ? '사진' : ((kind === 'back' ? BACKS : MATS).find(x => x[0] === sk.preset) || [, ''])[1];
function settingsHtml(inSheet) {
  const opt = (kind, k, label, pv, extra = '') => `<button class="opt" data-set="${kind}" data-v="${k}" ${extra}>${pv}<span>${esc(label)}</span></button>`;
  const vol = k => Math.round(Sound.get(k) * 100);
  const pv = kind => kind === 'back' ? backPv : matPv;
  // 내 것: 모임 기본 + 기본 7종 + 내 사진 = 9칸 (3×3)
  const mine = (kind, title) => {
    const list = kind === 'back' ? BACKS : MATS, my = SK.imgs?.[kind], g = groupSkin(kind);
    return `<section class="set"><h3>${title}</h3><div class="opts n9">
      ${opt(kind, 'group', '모임 기본', pv(kind)(g), `title="관리자가 정한 모임 기본 (지금: ${esc(skinLabel(kind, g))})"`)}
      ${list.map(([k, l]) => opt(kind, k, l, pv(kind)({ preset: k }))).join('')}
      ${opt(kind, 'mine', '내 사진', my ? pv(kind)({ img: my }) : addPv(kind))}</div>
      <div class="photo-row">${my ? `<button class="sm" data-up="${kind}" data-scope="me">${ICON.plus}사진 바꾸기</button><button class="sm" data-del="${kind}" data-scope="me">사진 지우기</button>` : `<span class="small muted">'내 사진' 칸을 누르면 휴대폰이나 PC의 사진으로 ${kind === 'back' ? '카드 뒷면' : '매트'}을 꾸밀 수 있어요.</span>`}</div></section>`;
  };
  // 관리자: 기본 7종 + 모임 사진 = 8칸 (4×2)
  const admin = (kind, title) => {
    const list = kind === 'back' ? BACKS : MATS, gi = SK.gimgs?.[kind];
    return `<h4>${title}</h4><div class="opts n8">${list.map(([k, l]) => opt('g-' + kind, k, l, pv(kind)({ preset: k }))).join('')}${opt('g-' + kind, 'custom', '모임 사진', gi ? pv(kind)({ img: gi }) : addPv(kind))}</div>
      <div class="photo-row">${gi ? `<button class="sm" data-up="${kind}" data-scope="group">${ICON.plus}사진 바꾸기</button><button class="sm" data-del="${kind}" data-scope="group">사진 지우기</button>` : `<span class="small muted">'모임 사진' 칸을 누르면 사진을 올려 모두의 기본으로 쓸 수 있어요.</span>`}</div>`;
  };
  return `${mine('back', '카드 뒷면')}${mine('mat', '매트')}
    <section class="set"><h3>카드 그림</h3><div class="seg"><button class="opt" data-set="art" data-v="group"><span>모임 기본 따르기<small class="sub">지금: ${esc((ART_KINDS.find(x => x[0] === (SK.group?.art || SKIN_DEF.art)) || ART_KINDS[0])[1])}</small></span></button>${ART_KINDS.map(([k, l]) => opt('art', k, l, '')).join('')}</div></section>
    <section class="set"><h3>소리</h3><div class="snd">
      <div class="r"><span class="nm">효과음</span><button class="sw" data-sw="sfx" aria-label="효과음 켜고 끄기"></button><input type="range" min="0" max="100" value="${vol('sfxVol')}" style="--v:${vol('sfxVol')}%" data-vol="sfxVol" aria-label="효과음 크기"><button class="sm" data-try>${ICON.play}들어 보기</button></div>
      <div class="r"><span class="nm">배경음악</span><button class="sw" data-sw="bgm" aria-label="배경음악 켜고 끄기"></button><input type="range" min="0" max="100" value="${vol('bgmVol')}" style="--v:${vol('bgmVol')}%" data-vol="bgmVol" aria-label="배경음악 크기"></div>
      <p class="small muted" style="margin:0">효과음과 배경음악은 모두 이 사이트에서 직접 만든 소리예요. 소리 설정은 이 기기에만 저장돼요.</p></div></section>
    ${!inSheet && SK.admin ? `<section class="set admin"><h3>모임 기본값 <span class="chip k-admin">관리자</span></h3>
      <p class="small muted">처음 들어온 사람과 '모임 기본'을 고른 사람에게 보이는 모양이에요. 각자 다른 것을 고른 사람은 그대로예요.</p>
      ${admin('back', '카드 뒷면')}${admin('mat', '매트')}
      <h4>카드 그림</h4><div class="seg">${ART_KINDS.map(([k, l]) => opt('g-art', k, l, '')).join('')}</div></section>` : ''}
    ${inSheet ? '' : `<section class="set"><h3>내 정보</h3><div class="row"><span class="grow">${esc(ME.name)} 님으로 들어와 있어요.</span><button id="lo">로그아웃</button></div></section>`}`;
}
// 사진 줄이기: 카드 뒷면은 카드 비율로 가운데를 잘라 440px, 매트는 긴 쪽 1600px. 밝기도 재서 매트 선 색을 고름
async function prepImage(file, kind) {
  let src;
  try { src = await createImageBitmap(file); }
  catch { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('사진을 읽지 못했어요.')); im.src = URL.createObjectURL(file); }); }
  const W0 = src.width, H0 = src.height; let sx = 0, sy = 0, sw = W0, sh = H0, w, h;
  if (kind === 'back') { const r = 63 / 88; if (sw / sh > r) { sw = sh * r; sx = (W0 - sw) / 2; } else { sh = sw / r; sy = (H0 - sh) / 2; } w = 440; h = Math.round(440 / r); }
  else { const k = Math.min(1, 1600 / Math.max(sw, sh)); w = Math.round(sw * k); h = Math.round(sh * k); }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  const sm = document.createElement('canvas'); sm.width = sm.height = 24; const sc = sm.getContext('2d'); sc.drawImage(cv, 0, 0, 24, 24);
  const d = sc.getImageData(0, 0, 24, 24).data; let L = 0;
  for (let i = 0; i < d.length; i += 4) L += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  L /= d.length / 4;
  let blob = null;
  for (let q = .86; q > .4; q -= .15) {
    blob = await new Promise(r => cv.toBlob(r, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size < 1.4e6) break;
  }
  if (!blob) throw new Error('사진을 줄이지 못했어요.');
  return { blob, dark: L < .55 };
}
async function uploadSkin(kind, scope, file) {
  toast('사진을 올리는 중이에요…', 20000);
  const { blob, dark } = await prepImage(file, kind);
  const r = await fetch(`/api/img?kind=${kind}&scope=${scope}`, { method: 'POST', headers: { 'content-type': blob.type, 'x-meta': JSON.stringify({ dark }) }, body: blob, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({ error: '서버 응답을 읽지 못했어요.' }));
  if (!r.ok) throw new Error(j.error || '올리지 못했어요.');
  setSkin(j); toast(scope === 'group' ? '모임 사진을 올렸어요. 모두의 기본이 됐어요.' : '사진을 올렸어요.');
}
function bindSettings(root, onArt, inSheet) {
  const refresh = () => { root.innerHTML = settingsHtml(inSheet); bindSettings(root, onArt, inSheet); };
  const curOf = { back: () => SK.prefs?.back || 'group', mat: () => SK.prefs?.mat || 'group', art: () => SK.prefs?.art || 'group',
    'g-back': () => SK.group?.back || SKIN_DEF.back, 'g-mat': () => SK.group?.mat || SKIN_DEF.mat, 'g-art': () => SK.group?.art || SKIN_DEF.art };
  const mark = () => {
    root.querySelectorAll('[data-set]').forEach(b => { const on = b.dataset.v === curOf[b.dataset.set](); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    root.querySelectorAll('[data-sw]').forEach(b => { const on = Sound.get(b.dataset.sw); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  };
  mark();
  // 사진 고르기 (숨긴 파일 칸 하나를 같이 씀)
  let fp = root.querySelector('input[type=file]');
  if (!fp) { fp = document.createElement('input'); fp.type = 'file'; fp.accept = 'image/*'; fp.hidden = true; root.appendChild(fp); }
  const pickPhoto = (kind, scope) => { fp.value = ''; fp.onchange = async () => { const f = fp.files[0]; if (!f) return; try { await uploadSkin(kind, scope, f); Sound.sfx('place'); onArt && onArt(); refresh(); } catch (e) { toast(e.message); } }; fp.click(); };
  const save = async (url, body) => { try { setSkin(await api(url, body)); } catch (e) { toast(e.message); } onArt && onArt(); refresh(); };
  root.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    const k = b.dataset.set, v = b.dataset.v;
    if (k === 'back' || k === 'mat' || k === 'art') {
      if (v === 'mine' && !SK.imgs?.[k]) return pickPhoto(k, 'me');
      SK.prefs = { back: 'group', mat: 'group', art: 'group', ...SK.prefs, [k]: v }; applySkin(); mark(); if (k !== 'art') Sound.sfx('place');
      if (k === 'art' && onArt) onArt();
      return save('/api/prefs', { [k]: v });
    }
    const gk = k.slice(2); // 관리자: 모임 기본값
    if (v === 'custom' && !SK.gimgs?.[gk]) return pickPhoto(gk, 'group');
    SK.group = { ...SK.group, [gk]: v }; applySkin(); mark(); if (gk !== 'art') Sound.sfx('place');
    save('/api/group', { [gk]: v });
  });
  root.querySelectorAll('[data-up]').forEach(b => b.onclick = () => pickPhoto(b.dataset.up, b.dataset.scope));
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    try { const r = await fetch(`/api/img?kind=${b.dataset.del}&scope=${b.dataset.scope}`, { method: 'DELETE', credentials: 'same-origin' }); const j = await r.json(); if (!r.ok) throw new Error(j.error || '지우지 못했어요.'); setSkin(j); toast('사진을 지웠어요.'); }
    catch (e) { toast(e.message); }
    onArt && onArt(); refresh();
  });
  root.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { const k = b.dataset.sw; Sound.set(k, !Sound.get(k)); mark(); if (k === 'sfx') Sound.sfx('notify'); });
  root.querySelectorAll('[data-vol]').forEach(r => { r.oninput = () => { Sound.set(r.dataset.vol, r.value / 100); r.style.setProperty('--v', r.value + '%'); }; r.onchange = () => { if (r.dataset.vol === 'sfxVol') Sound.sfx('coin'); }; });
  const tr = root.querySelector('[data-try]');
  if (tr) tr.onclick = () => ['draw', 'place', 'attack', 'coin', 'turnMine'].forEach((n, i) => setTimeout(() => Sound.sfx(n), i * 450));
  const lo = root.querySelector('#lo');
  if (lo) lo.onclick = async () => { await api('/api/logout', {}); ME = null; try { localStorage.removeItem('skin'); } catch {} setSkin({}); location.hash = '#login'; };
}
function renderSettings() {
  app.innerHTML = `<div class="card-box" style="max-width:860px;margin:0 auto"><h2>설정</h2><p class="muted small" style="margin-top:0">고르면 바로 바뀌어요. 카드 뒷면·매트·카드 그림은 내 계정에 저장돼서 다른 기기에서도 그대로예요.</p><div class="setwrap">${settingsHtml(false)}</div></div>`;
  bindSettings(app.querySelector('.setwrap'), null, false);
}
function openSettings(onArt) { openSheet(`<button class="x sm" data-close>닫기</button><h3>설정</h3><div class="setwrap">${settingsHtml(true)}</div>`, el => bindSettings(el.querySelector('.setwrap'), onArt, true)); }

// ---------- 로비 ----------
const fmtLeft = ms => { if (ms <= 0) return '기한 지남'; const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return h ? `${h}시간 ${m}분 남음` : `${m}분 남음`; };
const modeKo = c => (c.mode === 'async' ? `비동기 · 결정마다 ${c.deadlineH}시간` : '실시간') + ` · ${c.bestOf === 3 ? '3판 2선승' : '1판'}` + (c.spectate === 'no' ? ' · 관전 끔' : c.spectate === 'open' ? ' · 손패 공개 관전' : '');
let lobbyTab = (() => { try { return localStorage.getItem('lobbyTab') || 'mine'; } catch { return 'mine'; } })();
async function renderLobby() {
  app.innerHTML = '<p class="muted pad">방 목록을 불러오는 중…</p>';
  let data, decks;
  try { [data, decks] = await Promise.all([api('/api/rooms'), api('/api/decks')]); } catch (e) { app.innerHTML = `<p class="pad">${esc(e.message)}</p>`; return; }
  const rooms = data.rooms;
  const mine = rooms.filter(r => r.mine && r.status !== 'done'), open = rooms.filter(r => r.status === 'open' && !r.mine), watch = rooms.filter(r => !r.mine && r.status === 'playing'), done = rooms.filter(r => r.status === 'done' || r.status === 'between');
  const myTurnN = mine.filter(r => r.myTurn).length;
  document.title = (myTurnN ? `(${myTurnN}) ` : '') + '도란 카드 대전';
  const tabs = [['mine', `내 대전 ${mine.length}`], ['open', `들어갈 방 ${open.length}`], ['watch', `관전 ${watch.length}`], ['done', '끝난 판'], ['new', '+ 방 만들기']];
  const roomItem = r => {
    const last = r.games[r.games.length - 1];
    const vs = r.names.join(' vs ') + (r.players.length < 2 ? ' (상대 기다리는 중)' : '');
    let badge = '';
    if (r.status === 'open') badge = '<span class="chip">모집 중</span>';
    else if (r.myTurn) badge = '<span class="chip turn">내 차례</span>';
    else if (r.status === 'playing') badge = `<span class="chip">${r.phase === 'setup' ? '준비 중' : (r.turn || 0) + '번째 차례'}</span>`;
    else badge = `<span class="chip ok">${r.wins.join(' : ')}</span>`;
    const dl = r.deadline && r.status === 'playing' ? `<span class="chip warn">${fmtLeft(r.deadline - Date.now())}</span>` : '';
    let btns = '';
    if (r.status === 'open' && !r.mine) btns = `<button class="primary sm" data-join="${r.id}">들어가기</button>`;
    else if (r.status === 'open' && r.host === data.me) btns = `<button class="sm" data-close-room="${r.id}">방 닫기</button>`;
    else if (last && (r.status === 'playing')) btns = `<a class="btn ${r.mine ? 'primary' : ''} sm" href="#game/${last}">${r.mine ? '판으로' : '관전'}</a>`;
    if (r.status === 'between' && r.mine) btns += `<button class="primary sm" data-next="${r.id}">다음 판 시작</button>`;
    if (last && r.status !== 'open') btns += `<a class="btn sm" href="#replay/${last}">기보</a>`;
    const ic = r.status === 'open' ? ['door', 'k-open'] : r.myTurn ? ['bolt', 'k-turn'] : r.status === 'playing' ? (r.mine ? ['wait', 'k-wait'] : ['eye', 'k-watch']) : ['trophy', 'k-done'];
    return `<div class="item ${r.myTurn ? 'hot' : ''}">${ringIcon(ic[0], ic[1], r.myTurn)}<div class="grow"><div class="t">${esc(r.cfg.title || vs)}</div><div class="small muted">${esc(r.cfg.title ? vs + ' · ' : '')}${esc(modeKo(r.cfg))}${r.cfg.invite ? ' · 초대: ' + esc(r.cfg.invite) : ''}</div></div>${badge}${dl}<div class="row">${btns}</div></div>`;
  };
  const lists = { mine, open, watch, done };
  const body = lobbyTab === 'new' ? newRoomForm(decks.decks) : `<div class="list">${(lists[lobbyTab] || []).map(roomItem).join('') || `<div class="empty-note">${ringIcon('wait', 'k-wait')}아직 없어요.</div>`}</div>`;
  app.innerHTML = `<div class="tabs g2">${tabs.map(([k, l]) => `<button class="tab ${lobbyTab === k ? 'on' : ''} ${k === 'new' ? 'span' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { lobbyTab = b.dataset.tab; try { localStorage.setItem('lobbyTab', lobbyTab); } catch {} renderLobby(); });
  const chooseDeck = async () => {
    const ok = decks.decks; if (!ok.length) { toast('먼저 덱을 만들어 주세요.'); location.hash = '#decks'; return null; }
    return pick('어떤 덱으로 할까요?', ok.map(d => ({ label: esc(d.name) + (d.ok ? '' : ' ⚠'), value: d.id })));
  };
  app.querySelectorAll('[data-join]').forEach(b => b.onclick = async () => {
    const deckId = await chooseDeck(); if (!deckId) return;
    try { const r = await api(`/api/rooms/${b.dataset.join}/join`, { deckId }); location.hash = '#game/' + r.room.games[r.room.games.length - 1]; } catch (e) { toast(e.message); }
  });
  app.querySelectorAll('[data-next]').forEach(b => b.onclick = async () => { try { const r = await api(`/api/rooms/${b.dataset.next}/next`, {}); location.hash = '#game/' + r.room.games[r.room.games.length - 1]; } catch (e) { toast(e.message); } });
  app.querySelectorAll('[data-close-room]').forEach(b => b.onclick = async () => { await api(`/api/rooms/${b.dataset.closeRoom}/close`, {}); renderLobby(); });
  const f = $('#newroom');
  if (f) f.onsubmit = async e => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(f));
    try { await api('/api/rooms', fd); lobbyTab = 'mine'; toast('방을 만들었어요. 상대가 들어오면 시작해요.'); renderLobby(); } catch (er) { toast(er.message); }
  };
}
function newRoomForm(decks) {
  if (!decks.length) return `<div class="card-box"><h3>덱이 먼저 있어야 해요</h3><p>덱 화면에서 덱 리스트를 붙여 넣거나 카드를 골라 만들어 주세요.</p><a class="btn primary" href="#decks">덱 만들러 가기</a></div>`;
  return `<form id="newroom" class="card-box"><h3>방 만들기</h3>
    <label class="h">방 이름 (안 쓰면 이름으로)</label><input name="title" maxlength="30" style="width:100%">
    <label class="h">내 덱</label><select name="deckId">${decks.map(d => `<option value="${d.id}">${esc(d.name)}${d.ok ? '' : ' (규칙 확인 필요)'}</option>`).join('')}</select>
    <label class="h">진행 방식</label><select name="mode"><option value="live">실시간 (지금 같이)</option><option value="async">비동기 (편할 때 한 수씩)</option></select>
    <label class="h">비동기 결정 기한</label><select name="deadlineH"><option>12</option><option selected>24</option><option>48</option><option>72</option></select> 시간
    <label class="h">판수</label><select name="bestOf"><option value="1">1판</option><option value="3">3판 2선승 (대회)</option></select>
    <label class="h">관전</label><select name="spectate"><option value="yes">허용 (공개 정보만)</option><option value="no">끔</option><option value="open">손패 공개 관전 (연습·가르치기)</option></select>
    <label class="h">초대 (이 이름만 들어올 수 있어요, 비우면 누구나)</label><input name="invite" maxlength="12">
    <div class="row" style="margin-top:12px"><button class="primary">방 만들기</button></div></form>`;
}

// ---------- 덱 ----------
async function renderDecks(editId) {
  app.innerHTML = '<p class="muted pad">카드 자료를 불러오는 중…</p>';
  await loadCards();
  const { decks } = await api('/api/decks');
  if (editId) return deckEditor(decks.find(d => d.id === editId) || { name: '새 덱', list: [] });
  app.innerHTML = `<div class="row" style="margin-bottom:10px"><h2 class="grow">내 덱</h2><button class="primary" id="nd">+ 새 덱</button></div>
    <div class="list">${decks.map(d => { const ch = checkDeck(d.list, IDX); return `<div class="item">${ringIcon(ch.ok ? 'deck' : 'warn', ch.ok ? 'k-ok' : 'k-warn')}<div class="grow"><div class="t">${esc(d.name)}</div><div class="small muted">${ch.total}장 · ${ch.ok ? '규칙 통과' : esc(ch.problems[0])}</div></div>${ch.ok ? '<span class="chip ok">사용 가능</span>' : '<span class="chip warn">확인 필요</span>'}<a class="btn sm" href="#decks/${d.id}">고치기</a></div>`; }).join('') || `<div class="empty-note">${ringIcon('deck', 'k-ok')}아직 덱이 없어요.</div>`}</div>`;
  $('#nd').onclick = () => deckEditor({ name: '새 덱', list: [] });
}
function deckEditor(deck) {
  let list = deck.list.map(x => ({ ...x }));
  let q = '', filt = 'all';
  const count = () => list.reduce((a, b) => a + b.n, 0);
  app.innerHTML = `<div class="card-box"><div class="row"><input id="dn" value="${esc(deck.name)}" maxlength="30" class="grow"><button class="primary" id="save">저장</button>${deck.id ? '<button class="bad" id="del">삭제</button>' : ''}</div>
    <div id="chk" class="small" style="margin-top:6px"></div></div>
    <div class="game"><div class="card-box"><h3>카드 찾기</h3>
      <div class="row"><input id="q" class="grow" placeholder="이름 검색 (예: 피카츄, ㅍㅋㅊ, vzc)"></div>
      <div class="tabs g2" style="margin-top:8px">${[['all', '전체'], ['P', '포켓몬'], ['T', '트레이너스'], ['E', '에너지']].map(([k, l]) => `<button class="tab ${k === 'all' ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      <div id="res" class="cardgrid"></div></div>
    <div class="side"><div class="card-box"><h3>덱 리스트 <span id="cnt" class="chip"></span></h3><div id="lst" class="cardgrid"></div></div>
      <div class="card-box"><h3>리스트 붙여 넣기</h3><p class="small muted">PTCGL에서 내보낸 덱 리스트를 붙여 넣으면 지금 리스트를 바꿔요.</p><textarea id="paste" placeholder="4 Pikachu ex SVP 106&#10;..."></textarea><button id="imp" class="blue" style="margin-top:6px">불러오기</button><div id="bad" class="small"></div></div></div></div>`;
  const card = (c, n, on) => `<div class="c ${on ? 'on' : ''}" data-id="${c.id}">${cimg(c) ? `<img loading="lazy" referrerpolicy="no-referrer" src="${cimg(c)}" alt="${esc(cname(c))}">` : `<div class="ph">${esc(cname(c))}</div>`}${n ? `<span class="n">${n}</span>` : ''}<div>${esc(cname(c))}</div><div class="muted">${esc(c.set || '')} ${esc(c.no || '')}</div></div>`;
  const drawList = () => {
    const ch = checkDeck(list, IDX);
    $('#cnt').textContent = count() + ' / 60';
    $('#chk').innerHTML = ch.ok ? '<span class="chip ok">덱 규칙 통과</span>' : ch.problems.map(p => `<span class="chip warn">${esc(p)}</span>`).join(' ');
    const sorted = [...list].sort((a, b) => ('PTE'.indexOf(IDX.byId[a.id].st) - 'PTE'.indexOf(IDX.byId[b.id].st)) || cname(IDX.byId[a.id]).localeCompare(cname(IDX.byId[b.id])));
    $('#lst').innerHTML = sorted.map(x => card(IDX.byId[x.id], x.n)).join('') || '<p class="muted">왼쪽에서 카드를 눌러 넣어요.</p>';
    $('#lst').querySelectorAll('.c').forEach(el => el.onclick = () => cardSheet(el.dataset.id));
  };
  const drawRes = () => {
    let items = ALL.filter(c => filt === 'all' || c.st === filt);
    if (q.trim()) { const m = KS.matcher(q); items = items.map(c => [m(KS.norm(cname(c)), KS.norm(c.n), c._sc ||= {}), c]).filter(h => h[0] >= 0).sort((a, b) => a[0] - b[0]).map(h => h[1]); }
    else items = items.filter(c => c.rm >= 'I' || c.st === 'E').reverse().sort((a, b) => (a.kro ? 1 : 0) - (b.kro ? 1 : 0)); // 최신 카드부터, 한국판 전용 카드는 뒤로
    $('#res').innerHTML = items.slice(0, 60).map(c => card(c, list.find(x => x.id === c.id)?.n)).join('') || '<p class="muted">찾는 카드가 없어요.</p>';
    $('#res').querySelectorAll('.c').forEach(el => el.onclick = () => cardSheet(el.dataset.id));
  };
  const cardSheet = id => {
    const c = IDX.byId[id], have = list.find(x => x.id === id)?.n || 0;
    openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(c)}<div class="row" style="margin-top:10px"><button class="primary" data-a="1">+1장</button><button data-a="-1">−1장</button><span class="chip">지금 ${have}장</span></div>`, el => {
      el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
        const d = +b.dataset.a; let x = list.find(y => y.id === id);
        if (!x && d > 0) list.push(x = { id, n: 0 });
        if (x) { x.n += d; if (x.n <= 0) list = list.filter(y => y !== x); }
        closeSheet(); drawList(); drawRes();
      });
    });
  };
  $('#q').oninput = e => { q = e.target.value; drawRes(); };
  app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filt = b.dataset.f; app.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); drawRes(); });
  $('#imp').onclick = () => { const r = parseDeckList($('#paste').value, IDX); list = r.list; $('#bad').innerHTML = r.bad.length ? '못 찾은 줄: ' + r.bad.map(esc).join(' · ') : '<span class="chip ok">모두 찾았어요</span>'; drawList(); drawRes(); };
  $('#save').onclick = async () => {
    try { const r = await api('/api/decks', { id: deck.id, name: $('#dn').value, list }); deck.id = r.deck.id; toast(r.check.ok ? '저장했어요.' : '저장했어요. 덱 규칙을 확인해 주세요.'); go('#decks'); } catch (e) { toast(e.message); }
  };
  if ($('#del')) $('#del').onclick = async () => { if (!(await ask('덱을 지울까요?', '<p>지우면 되돌릴 수 없어요.</p>', '지우기', 'bad'))) return; await api('/api/decks/' + deck.id, null, 'DELETE'); go('#decks'); };
  drawList(); drawRes();
}
function cardInfoHtml(c) {
  if (!c) return '<p>카드 정보가 없어요.</p>';
  const cost = cs => (cs || []).map(t => `<i title="${TYPE_KO[t] || t}" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${TYPE_COLOR[t] || '#ccc'};border:1px solid rgba(0,0,0,.3)"></i>`).join('');
  return `<div class="cardinfo">${cimg(c) ? `<div class="big"><img src="${bigImg(c)}" alt="${esc(cname(c))}" referrerpolicy="no-referrer" onerror="if(!this.dataset.s){this.dataset.s=1;this.src='${cimg(c)}'}"></div>` : ''}<div class="txt"><h3>${esc(cname(c))}</h3><div class="small muted">${c.kro ? '한국판 카드' : esc(c.n)} · ${esc(c.set || '')} ${esc(c.no || '')} · 레귤레이션 ${esc(c.rm || '—')}</div>
    <div class="row" style="margin:4px 0">${(c.sub || []).map(s => `<span class="chip">${esc(s)}</span>`).join('')}${c.hp ? `<span class="chip">HP ${c.hp}</span>` : ''}${(c.ty || []).map(t => `<span class="chip">${TYPE_KO[t] || t}</span>`).join('')}</div>
    ${(c.ab || []).map((a, i) => { const k = (c.kab || [])[i] || a; return `<div class="atk"><b>특성 ${esc(k.n)}</b><div>${esc(k.t)}</div></div>`; }).join('')}
    ${(c.at || []).map((a, i) => { const k = (c.kat || [])[i] || a; return `<div class="atk"><b>${cost(a.c)} ${esc(k.n)} ${esc(a.d || '')}</b><div>${esc(k.t || '')}</div></div>`; }).join('')}
    ${(c.kr || c.r || []).map(t => `<div class="small muted atk">${esc(t)}</div>`).join('')}
    ${c.st === 'P' ? `<div class="small atk">약점 ${(c.wk || []).map(t => TYPE_KO[t]).join(', ') || '—'} · 저항력 ${(c.rs || []).map(r => TYPE_KO[r[0]] + ' ' + r[1]).join(', ') || '—'} · 후퇴 ${c.rt || 0}</div>` : ''}
    ${c.kn ? '' : '<div class="small muted atk">이 카드는 아직 한글 자료와 연결되지 않아 영문으로 보여요.</div>'}</div></div>`;
}

// ---------- 대전 ----------
let G = null; // { id, view, lines, cards, ws, pend:{}, specs, ui }
function cinfo(cid) { // 판에 저장된 카드 정보 + 지금 카드 자료의 한글 이름·그림·문장
  const base = (G && G.cards[cid]) || (IDX && IDX.byId[cid]) || { n: '?' };
  const cur = IDX && IDX.byId[cid];
  return cur && cur.kn ? { ...base, kn: cur.kn, kimg: cur.kimg, kab: cur.kab, kat: cur.kat, kr: cur.kr } : base; // 한글은 항상 지금 자료 우선
}
const nmOf = x => x ? cname(cinfo(x.c)) : '?';
const topOf = sl => sl.cards[sl.cards.length - 1];

const TYPE_CH = { Grass: '풀', Fire: '불', Water: '물', Lightning: '번', Psychic: '초', Fighting: '격', Darkness: '악', Metal: '강', Dragon: '드', Colorless: '무' };

function renderGame(id) {
  loadCards().then(() => { if (G && G.view && G.id === id) draw([]); }).catch(() => {});
  G = { id, view: null, lines: [], cards: {}, pend: {}, seq: 1, specs: [], ui: { tab: 'log', dockOpen: true }, prev: null };
  app.innerHTML = '<div class="arena-loading"><div class="spin-ball"></div><p>판에 연결하는 중…</p></div>';
  document.body.classList.add('in-game');
  let closed = false, retry = 0;
  const connect = () => {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/game/' + id);
    G.ws = ws;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'full') { const first = !G.view; G.view = m.view; G.lines = m.lines; G.cards = m.cards; if (m.specs) G.specs = m.specs; draw(first ? [] : null); }
      else if (m.t === 'upd') { G.view = m.view; G.lines.push(...m.lines); draw(m.lines); }
      else if (m.t === 'specs') { G.specs = m.specs; drawSpecs(); }
      else if (m.t === 'spec') { (G.specChat ||= []).push(m); if (G.ui.tab === 'spec') drawSide(); }
      else if (m.t === 'res') { const p = G.pend[m.id]; if (p) { delete G.pend[m.id]; p(m); } }
    };
    ws.onopen = () => { retry = 0; };
    ws.onclose = () => { if (!closed) setTimeout(connect, Math.min(8000, 500 * 2 ** retry++)); };
  };
  connect();
  const ping = setInterval(() => { try { G.ws.readyState === 1 && G.ws.send('{"t":"ping"}'); } catch {} }, 25000);
  leaveGame = () => { closed = true; clearInterval(ping); if (G.rw) { clearTimeout(G.rw.timer); G.rw = null; } try { G.ws.close(); } catch {} document.body.classList.remove('in-game'); };
}
function send(a) {
  return new Promise(res => {
    const id = G.seq++; G.pend[id] = res;
    G.ws.send(JSON.stringify({ t: 'act', id, a }));
  }).then(async r => {
    if (r.ok) return true;
    if (r.warn) {
      const f = await ask('이렇게 할까요?', `<p>기본 룰과 다른 점이 있어요.</p><ul>${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul><p class="small muted">카드 효과 때문이라면 그대로 진행하세요. 기록에 <span class="chip judge">사람 판정</span>으로 남고 상대가 확인해요.</p><label class="h">설명 (선택)</label><input name="note" maxlength="100" style="width:100%" placeholder="예: 특성으로 에너지 한 장 더">`, '그대로 진행', 'judge');
      if (!f) return false;
      return send({ ...a, force: true, note: f.note || a.note });
    }
    toast(r.err || '할 수 없어요.'); return false;
  });
}
const meSeat = () => G.view.me;
const oppSeat = () => G.view.me == null ? 1 : 1 - G.view.me;
const bottomSeat = () => G.view.me == null ? 0 : G.view.me;

// ----- 카드 한 장 -----
function cardFace(x, cls = '', extra = '') {
  const c = cinfo(x.c), src = cimg(c);
  const tag = src && c.kn && src === c.img ? `<span class="kn" style="--len:${[...c.kn].length}">${esc(c.kn)}</span>` : ''; // 영문 그림 위 한글 이름표
  return `<div class="pc ${cls}" data-k="${x.i}" ${extra}>${src ? `<img src="${src}" alt="${esc(cname(c))}" referrerpolicy="no-referrer" loading="lazy" draggable="false">${tag}` : `<div class="ph">${esc(cname(c))}</div>`}</div>`;
}
const cardBack = (cls = '', extra = '') => `<div class="pc back ${cls}" ${extra}><div class="cb"></div></div>`;
const TYPE_ICON = { Grass: '🌿', Fire: '🔥', Water: '💧', Lightning: '⚡', Psychic: '🔮', Fighting: '👊', Darkness: '🌙', Metal: '⚙️', Dragon: '🐉', Colorless: '⭐' };
function energyTabs(sl) { // 실물처럼 포켓몬 밑에 깔린 에너지 카드
  const n = sl.en.length; if (!n) return '';
  return `<div class="entabs" style="--n:${n}">${sl.en.map((x, i) => { const e = cinfo(x.c); const ty = (e.n.match(/Basic (\w+) Energy/) || [])[1]; return `<span class="entab" data-k="${x.i}" style="--i:${i};--ec:${TYPE_COLOR[ty] || '#c9b3ff'}" title="${esc(cname(e))}"><i>${ty ? TYPE_ICON[ty] : '✦'}</i></span>`; }).join('')}</div>`;
}
function slotHtml(sl, opt = {}) {
  const size = opt.active ? 'act' : 'bn';
  if (!sl) return `<div class="spot ${size} empty">${opt.active ? '<span>배틀 필드</span>' : ''}</div>`;
  if (sl.hidden) return `<div class="spot ${size}">${cardBack('flipin')}</div>`;
  const t = topOf(sl), c = cinfo(t.c);
  const cd = sl.cond || {};
  const rot = cd.asleep ? 'r-sleep' : cd.paralyzed ? 'r-para' : cd.confused ? 'r-conf' : '';
  const hpLeft = c.hp ? Math.max(0, c.hp - sl.dmg) : null;
  const pct = c.hp ? hpLeft / c.hp * 100 : 100;
  const marks = [cd.poisoned ? '<b class="mk poison">독</b>' : '', cd.burned ? '<b class="mk burn">화상</b>' : '', cd.asleep ? '<b class="mk sleep">잠듦</b>' : '', cd.paralyzed ? '<b class="mk para">마비</b>' : '', cd.confused ? '<b class="mk conf">혼란</b>' : ''].join('');
  const under = sl.cards.length > 1 ? sl.cards.slice(0, -1).map((x, i) => `<div class="pc under" data-k="${x.i}" style="--u:${sl.cards.length - 1 - i}"></div>`).join('') : '';
  return `<div class="spot ${size} filled" data-sid="${sl.sid}">
    <div class="rotwrap ${rot}">${energyTabs(sl)}${under}${cardFace(t, 'onfield')}
      ${sl.dmg ? `<span class="dmg" data-dmg="${sl.sid}">${sl.dmg}</span>` : ''}
      ${c.hp ? `<span class="hpb ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}">${hpLeft}</span>` : ''}
      ${sl.tl.length ? `<div class="tools">${sl.tl.map(x => `<span data-k="${x.i}" title="도구: ${esc(nmOf(x))}">🔧</span>`).join('')}</div>` : ''}
    </div>
    ${marks ? `<div class="marks">${marks}</div>` : ''}</div>`;
}
// ----- 판 배치 (PTCGL처럼): 두 사람 모두 사이드 왼쪽·덱/트래시 오른쪽, 벤치는 큰 칸 하나 -----
function pilesHtml(p) {
  const P = G.view.p[p];
  const topD = P.discard[P.discard.length - 1];
  const deck = `<div class="pile deck" data-zone="deck" data-p="${p}" data-deck="${p}">${P.deck.n ? `<div class="stack" style="--t:${Math.min(8, Math.ceil(P.deck.n / 7))}">${cardBack()}</div>` : '<div class="zone-mark">덱</div>'}<span class="cnt" title="덱">${P.deck.n}</span></div>`;
  const disc = `<div class="pile disc" data-zone="discard" data-p="${p}">${topD ? cardFace(topD) : '<div class="zone-mark">트래시</div>'}<span class="cnt" title="트래시">${P.discard.length}</span></div>`;
  const lost = P.lost.length ? `<span class="cnt lostc" data-zone="lost" data-p="${p}">로스트 ${P.lost.length}</span>` : '';
  return `<div class="piles">${deck}${disc}${lost}</div>`;
}
function prizesHtml(p) { // 겹쳐 쌓은 사이드 더미 + 남은 수
  const P = G.view.p[p]; const n = P.prizesN;
  const cards = Array.from({ length: n }, (_, k) => P.prizes ? cardFace(P.prizes[k], 'pz', `style="--k:${k}"`) : cardBack('pz', `style="--k:${k}"`)).join('');
  return `<div class="prizes" data-zone="prizes" data-p="${p}" style="--n:${Math.max(1, n)}"><div class="pzstack">${cards || '<div class="zone-mark">사이드</div>'}</div><span class="cnt" title="남은 사이드">${n}</span></div>`;
}
const USES = [['energy', '⚡', '에너지'], ['supporter', '👤', '서포트'], ['retreat', '↩', '후퇴'], ['attack', '⚔', '기술']];
function areaHtml(p, isBottom) {
  const v = G.view, P = v.p[p];
  const now = v.phase === 'play' && v.current === p;
  const uses = now ? `<span class="uses">${USES.map(([k, ic, l]) => `<span class="use ${P.used[k] ? 'done' : ''}" title="${l} ${P.used[k] ? '(이번 차례에 썼어요)' : '(아직 안 썼어요)'}"><i>${ic}</i><span class="ul">${l}</span></span>`).join('')}</span>` : '';
  const state = v.phase === 'setup' ? `<b class="zst ${P.ready ? 'ok' : ''}">${P.ready ? '준비 완료' : '준비 중'}</b>` : '';
  const tag = `<span class="ztag ${isBottom ? 'me' : 'opp'} ${now ? 'turn' : ''}"><i class="av">${esc(P.name.slice(0, 1))}</i><span class="zn">${esc(P.name)}</span>${state}${v.phase === 'setup' && P.mull ? `<b class="zst">멀리건 ${P.mull}</b>` : ''}${uses}</span>`;
  return `<section class="area ${isBottom ? 'bottom' : 'top'} ${now ? 'now' : ''}" data-area="${p}">
      <div class="g-pz">${prizesHtml(p)}</div>
      <div class="g-act">${slotHtml(P.active, { active: true })}</div>
      <div class="g-pile">${pilesHtml(p)}</div>
      <div class="g-bench">${tag}<div class="benchrow">${P.bench.map(b => slotHtml(b)).join('')}</div>${P.bench.length ? '' : '<span class="bempty">벤치</span>'}</div>
    </section>`;
}
function handHtml(p) { // 내 손패: 아래쪽 일자 줄 (위쪽만 보이고, 누르면 올라옴). 볼 수 없는 손패는 뒷면
  const P = G.view.p[p], n = P.hand ? P.hand.length : P.handN, mine = G.view.me === p;
  if (!P.hand) return `<div class="handbar peek backs"><div class="fan" style="--n:${n}">${Array.from({ length: Math.min(n, 12) }, (_, i) => cardBack('inhand', `style="--i:${i}"`)).join('')}</div><span class="hcnt">${n}</span></div>`;
  return `<div class="handbar ${mine ? '' : 'peek'}"><div class="fan" style="--n:${n}">${P.hand.map((x, i) => cardFace(x, 'inhand', `${mine ? `data-hand="${x.i}"` : ''} style="--i:${i}"`)).join('') || '<span class="nohand">손패 없음</span>'}</div>${n ? `<span class="hcnt" title="손패">${n}</span>` : ''}</div>`;
}
function oppHandHtml(p) { // 상대 손패: 맨 위에 뒷면이 살짝 보임
  const P = G.view.p[p], n = P.hand ? P.hand.length : P.handN;
  const cards = P.hand ? P.hand.map((x, i) => cardFace(x, 'oh', `style="--i:${i}"`)).join('') : Array.from({ length: Math.min(n, 12) }, (_, i) => cardBack('oh', `style="--i:${i}"`)).join('');
  return `<div class="ohand" data-zone="hand" data-p="${p}" style="--n:${Math.min(n, 12)}"><div class="ofan">${cards}</div><span class="hcnt" title="상대 손패">${n}</span></div>`;
}
function midHtml(readOnly) {
  const v = G.view;
  const stadium = v.stadium ? `<div class="stadium" data-stadium="1">${cardFace(v.stadium, 'stad')}</div>` : '<div class="stadium none" title="스타디움 없음"><span>스타디움</span></div>';
  const last = [...G.lines].reverse().find(l => !l.chat && l.txt);
  return `<div class="fieldline">${stadium}<div class="centerball"></div>${last && !readOnly ? `<div class="ticker">${esc(last.txt)}</div>` : ''}</div>`;
}
const fmtShort = ms => { if (ms <= 0) return '지남'; const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간` : m >= 1 ? `${m}분` : '곧'; };
function rbarHtml(readOnly) { // 오른쪽 세로 막대: 위 사람 남은 사이드(빨강) · 차례/남은 시간 · 아래 사람 남은 사이드(파랑)
  const v = G.view, bs = bottomSeat(), os = 1 - bs;
  const cur = v.phase === 'play' ? (v.current === bs ? 'me' : 'opp') : '';
  const mid = v.phase === 'setup' ? '<b>준비</b>' : v.phase === 'over' ? '<b>끝</b>' : `<small>${v.turn}번째</small>${v.deadline ? `<b title="${fmtLeft(v.deadline - Date.now())}">${fmtShort(v.deadline - Date.now())}</b>` : '<b>차례</b>'}`;
  return `<div class="rbar">
    <div class="pzc opp" title="${esc(v.p[os].name)} 님 남은 사이드"><b>${v.p[os].prizesN}</b></div>
    <div class="clock ${cur}" title="${v.deadline ? '이번 결정까지 남은 시간' : ''}">${mid}</div>
    <div class="pzc me" title="${esc(v.p[bs].name)} 님 남은 사이드"><b>${v.p[bs].prizesN}</b></div>
    ${readOnly ? '' : '<span class="specs" id="specs"></span>'}</div>`;
}
// 오른쪽 둥근 버튼: 볼 줄무늬 링 (시안 6-약). 가만히 있어도 옅은 파동, 마우스를 올리면 살짝 갸웃, 누르면 가운데 단추가 빛나요.
const FAB_ICON = {
  log: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.5V8h3.5L14 4.5ZM8 11v1.8h8V11H8Zm0 3.5v1.8h8v-1.8H8Zm0-7V9h4V7.5H8Z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.7" fill="none" stroke="currentColor" stroke-width="2.3"/><path fill="currentColor" d="M12 6.9l1.55 3.15 3.45.5-2.5 2.44.59 3.44L12 14.8l-3.09 1.63.59-3.44L7 10.55l3.45-.5z"/></svg>',
  hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3.5a1.3 1.3 0 0 1 2.6 0V11h.6V2.6a1.3 1.3 0 0 1 2.6 0V11h.6V4.2a1.3 1.3 0 0 1 2.6 0v9.6c0 4-2.7 7.2-6.6 7.2-2.4 0-4-1.2-5.3-3.1l-3-4.6a1.4 1.4 0 0 1 2.3-1.6L9 14V3.5Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="2.3" fill="currentColor"/><circle cx="12" cy="12" r="2.3" fill="currentColor"/><circle cx="18.5" cy="12" r="2.3" fill="currentColor"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 2.5h1.8v19H5v-19Zm2.8 1h11.4l-2.6 4.4 2.6 4.4H7.8V3.5Z"/></svg>',
  rewatch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M4.6 12a7.4 7.4 0 1 0 2.3-5.4"/><path fill="currentColor" d="M3.4 3.4v6h6z"/><path fill="currentColor" d="M10.2 8.4v7.2l5.8-3.6z"/></svg>',
};
const FAB_FX = '<i class="fx f1"></i><i class="fx f3"></i><i class="fx f4"></i>';
const fabBtn = (t, ic, l, k, extra = '') => `<div class="fabw"><button class="fab ${k}" data-t="${t}" aria-label="${l}">${FAB_FX}<span class="core">${FAB_ICON[ic]}</span>${extra}</button><span class="fl">${l}</span></div>`;
function fabHtml() { // 왼쪽: 코인·효과 / 오른쪽: 더 보기(위)·기록(아래), 가운데 줄 옆에 차례 끝내기
  const v = G.view, me = meSeat();
  const pend = me == null ? 0 : v.groups.filter(g => g.who !== me && g.status !== 'ok').length;
  const log = fabBtn('log', 'log', '기록', 'k-log', pend ? `<i class="badge">${pend}</i>` : '');
  if (me == null || v.phase === 'over') return `<div class="rbtns lo">${log}</div>`;
  const myTurn = v.phase === 'play' && v.current === me;
  const open = v.openGroup[me];
  const rwt = lastOppTurn(), rwNew = rwt && !rwSeen(rwt);
  const rw = rwt ? `<div class="rwbtn">${fabBtn('rewatch', 'rewatch', '상대 턴', 'k-rw' + (rwNew ? ' on nudge' : ''), rwNew ? '<i class="badge">새</i>' : '')}</div>` : '';
  return `${rw}<div class="lbtns">${fabBtn('coin', 'coin', '코인', 'k-coin')}${open ? fabBtn('effectEnd', 'check', '효과 끝', 'k-fx on') : fabBtn('effect', 'hand', '효과 쓰기', 'k-fx')}</div>
    <div class="rbtns hi">${fabBtn('more', 'more', '더 보기', 'k-more')}</div><div class="rbtns lo">${log}</div>
    ${myTurn ? `<button class="fab wide endturn" data-t="endTurn">${FAB_FX}${FAB_ICON.flag}<span>차례<br>끝내기</span></button>` : ''}`;
}
// 누르면 버튼마다 '누를 때' 움직임을 한 번
// 누르면 통 튀는 효과 + 소리 (버튼·탭·카드)
document.addEventListener('pointerdown', e => {
  const t = e.target.closest && e.target.closest('.fab, button, .btn, #nav a, .pc.inhand, .cardgrid .c, .spot.filled, .pile, .prizes');
  if (!t) return;
  if (t.matches('.fab, button, .btn')) { t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); clearTimeout(t._pop); t._pop = setTimeout(() => t.classList.remove('pop'), 650); }
  Sound.sfx(t.classList.contains('fab') ? 'pop' : 'tap');
});
function matHtml(readOnly = false) {
  const bs = bottomSeat(), os = 1 - bs, v = G.view;
  const over = v.phase === 'over' ? `<div class="overpill">🏆 ${esc(v.p[v.winner]?.name || '')} 승리</div>` : '';
  return `${oppHandHtml(os)}<div class="matwrap"><div class="matbox"><div class="mat ${readOnly ? 'ro' : ''}">${areaHtml(os, false)}${midHtml(readOnly)}${areaHtml(bs, true)}</div>
    ${over}${rbarHtml(readOnly)}${readOnly ? '' : fabHtml()}</div></div>${handHtml(bs)}`;
}

// ----- 그리기 + 애니메이션 -----
function snapRects() {
  const m = new Map();
  app.querySelectorAll('[data-k]').forEach(el => { if (!m.has(el.dataset.k)) m.set(el.dataset.k, el.getBoundingClientRect()); });
  const decks = {}; app.querySelectorAll('[data-deck]').forEach(el => decks[el.dataset.deck] = el.getBoundingClientRect());
  return { m, decks };
}
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function flip(prev) {
  if (!prev || reduceMotion()) return;
  const seen = new Set();
  app.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k; if (seen.has(k)) return; seen.add(k);
    const r = el.getBoundingClientRect(); let o = prev.m.get(k);
    if (!o && el.classList.contains('inhand')) o = prev.decks[bottomSeat()]; // 덱에서 뽑힘
    if (!o) { el.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1.2)' }); return; }
    const dx = o.left - r.left, dy = o.top - r.top, sx = o.width / (r.width || 1);
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sx})`, zIndex: 30 }, { transform: 'none', zIndex: 30 }], { duration: 480, easing: 'cubic-bezier(.25,.8,.25,1)' });
  });
}
function effects(prevView, newLines) {
  const v = G.view; if (!prevView || reduceMotion()) return;
  // 데미지 숫자 튀기
  const dm = {}; for (const p of [0, 1]) for (const sl of [prevView.p[p].active, ...prevView.p[p].bench]) if (sl && !sl.hidden) dm[sl.sid] = sl.dmg;
  for (const p of [0, 1]) for (const sl of [v.p[p].active, ...v.p[p].bench]) {
    if (!sl || sl.hidden || dm[sl.sid] == null || sl.dmg === dm[sl.sid]) continue;
    const el = app.querySelector(`[data-sid="${sl.sid}"]`); if (!el) continue;
    const d = sl.dmg - dm[sl.sid];
    const pop = document.createElement('div'); pop.className = 'dmgpop ' + (d > 0 ? 'hurt' : 'heal'); pop.textContent = (d > 0 ? '-' : '+') + Math.abs(d);
    el.appendChild(pop); setTimeout(() => pop.remove(), 1200);
    if (d > 0) el.querySelector('.rotwrap')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 380 });
  }
  // 새 기록 줄에 따라
  for (const l of newLines || []) {
    if (/코인 \d+번 —|코인 (앞면|뒷면)|코인 던지기/.test(l.txt)) coinAnim(l.txt);
    if (/의 기술 「/.test(l.txt)) {
      const att = app.querySelector(`[data-area="${l.who}"] .g-act .spot`), def = app.querySelector(`[data-area="${1 - l.who}"] .g-act .spot`);
      const up = l.who === bottomSeat() ? -1 : 1;
      att?.animate([{ transform: 'none' }, { transform: `translateY(${up * 22}px) scale(1.06)` }, { transform: 'none' }], { duration: 420, easing: 'ease-out' });
      def?.classList.remove('hit'); void def?.offsetWidth; def?.classList.add('hit');
    }
    if (/기절 → 트래시/.test(l.txt)) banner('기절!', 'ko');
  }
  if (prevView.phase === 'setup' && v.phase === 'play') banner('대전 시작!', 'start');
  else if (v.phase === 'play' && prevView.current !== v.current) banner(v.current === v.me ? '내 차례!' : v.me == null ? `${v.p[v.current].name} 님 차례` : '상대 차례', v.current === v.me ? 'mine' : 'theirs');
  if (prevView.phase !== 'over' && v.phase === 'over') banner(`🏆 ${v.p[v.winner]?.name} 님 승리!`, 'win', 2600);
}
function gameSounds(pv, lines) { // 새 기록 줄과 판 변화에 맞는 효과음 (한 번에 4개까지)
  const v = G.view; if (!pv) return;
  const q = [];
  let hurt = false, heal = false;
  const dm = {}; for (const p of [0, 1]) for (const sl of [pv.p[p].active, ...pv.p[p].bench]) if (sl && !sl.hidden) dm[sl.sid] = sl.dmg;
  for (const p of [0, 1]) for (const sl of [v.p[p].active, ...v.p[p].bench]) { if (!sl || sl.hidden || dm[sl.sid] == null) continue; if (sl.dmg > dm[sl.sid]) hurt = true; if (sl.dmg < dm[sl.sid]) heal = true; }
  for (const { txt: t } of lines || []) {
    if (/의 기술 「/.test(t)) q.push('attack');
    else if (/기절 → 트래시/.test(t)) q.push('ko');
    else if (/코인/.test(t)) q.push('coin');
    else if (/진화시켰어요/.test(t)) q.push('evolve');
    else if (/붙였어요/.test(t)) q.push('attach');
    else if (/섞었어요/.test(t)) q.push('shuffle');
    else if (/뽑았어요/.test(t)) q.push('draw');
    else if (/프라이즈 1장을 손패로/.test(t)) q.push('prize');
    else if (/효과 처리 시작/.test(t)) q.push('judge');
    else if (/이의가 있어요/.test(t)) q.push('error');
    else if (/후퇴하고/.test(t)) q.push('retreat');
    else if (/냈어요/.test(t)) q.push('place');
    else if (/썼어요/.test(t)) q.push('play');
  }
  if (hurt && !q.includes('attack')) q.push('damage');
  if (heal) q.push('heal');
  if (pv.phase === 'setup' && v.phase === 'play') q.push('start');
  else if (v.phase === 'play' && pv.current !== v.current) q.push(v.current === v.me ? 'turnMine' : 'turnTheirs');
  if (pv.phase !== 'over' && v.phase === 'over') q.push(v.me == null || v.winner === v.me ? 'win' : 'lose');
  [...new Set(q)].slice(0, 4).forEach((n, i) => setTimeout(() => Sound.sfx(n), i * 170));
}
function banner(text, kind, ms = 1300) {
  const b = document.createElement('div'); b.className = 'banner ' + kind; b.innerHTML = `<span>${esc(text)}</span>`;
  document.body.appendChild(b); setTimeout(() => b.remove(), ms);
}
function coinAnim(txt) {
  const res = (txt.match(/— ([앞뒤 ]+)\(/) || [])[1]?.trim().split(/\s+/) || (/앞면/.test(txt) ? ['앞'] : /뒷면/.test(txt) ? ['뒤'] : []);
  if (!res.length) return;
  const o = document.createElement('div'); o.className = 'coinlayer';
  o.innerHTML = `<div class="coins">${res.slice(0, 10).map((r, i) => `<div class="coin ${r === '앞' ? 'heads' : 'tails'}" style="--d:${i * 90}ms"><div class="f h">앞</div><div class="f t">뒤</div></div>`).join('')}</div><div class="coinres">앞면 ${res.filter(r => r === '앞').length} · 뒷면 ${res.filter(r => r === '뒤').length}</div>`;
  document.body.appendChild(o); setTimeout(() => o.classList.add('out'), 1700); setTimeout(() => o.remove(), 2100);
}
function draw(newLines) {
  const v = G.view; if (!v) return;
  if (G.rw) { G.rw.dirty = true; return; } // 상대 턴 다시 보는 중: 끝나면 그때 그림
  const prev = app.querySelector('.mat') ? snapRects() : null;
  const prevView = G.prev;
  const me = meSeat();
  const waitingMe = me != null && v.waiting.includes(me);
  document.title = (waitingMe ? '● 내 차례 · ' : '') + '도란 카드 대전';
  const dock = setupHtml() + promptsHtml() + lookHtml() + groupsHtml();
  app.innerHTML = `<div class="arena"><div class="table">${matHtml()}
      ${dock ? `<div class="dock ${G.ui.dockOpen ? '' : 'shut'}"><button class="dockt" data-dock>${G.ui.dockOpen ? '접기 ▾' : '확인할 것 ▴'}</button><div class="dockin">${dock}</div></div>` : ''}
    </div><aside class="panel" id="side"></aside></div>`;
  drawSpecs(); drawSide(); bindBoard();
  const dt = app.querySelector('[data-dock]'); if (dt) dt.onclick = () => { G.ui.dockOpen = !G.ui.dockOpen; draw([]); };
  flip(prev); if (newLines) { effects(prevView, newLines); gameSounds(prevView, newLines); }
  G.prev = JSON.parse(JSON.stringify(v));
}
function drawSpecs() { const el = $('#specs'); if (el) el.textContent = G.specs.length ? `👀 관전 ${G.specs.length}` : ''; }
function setupHtml() {
  const v = G.view, me = meSeat(); if (v.phase !== 'setup' || me == null) return '';
  const P = v.p[me], O = v.p[1 - me]; const parts = [];
  if (v.first == null && v.coinWinner === me) parts.push(`<div class="prompt"><div class="q">🪙 코인에서 이겼어요! 선공·후공을 골라 주세요.</div><div class="bar"><button class="primary" data-order="1">선공</button><button data-order="0">후공</button></div></div>`);
  if (v.first == null && v.coinWinner !== me) parts.push(`<div class="prompt soft"><div class="q">상대가 선공·후공을 고르는 중이에요.</div></div>`);
  if (!P.ready) {
    parts.push(`<div class="prompt"><div class="q">손패의 기본 포켓몬을 눌러 배틀 포켓몬 1장과 벤치(최대 5장)를 놓아 주세요. 상대에게는 뒷면으로 보여요.</div>
      ${O.mull && !P.mullDrawn ? `<div class="row">상대가 멀리건을 ${O.mull}번 했어요. 추가로 몇 장 뽑을까요? ${Array.from({ length: O.mull + 1 }, (_, n) => `<button class="sm" data-mull="${n}">${n}장</button>`).join('')}</div>` : ''}
      <div class="bar"><button class="primary" data-t="setupDone" ${P.active ? '' : 'disabled'}>준비 완료</button></div></div>`);
  } else parts.push(`<div class="prompt soft"><div class="q">상대 준비를 기다리는 중이에요.</div></div>`);
  return parts.join('');
}
function promptsHtml() {
  const v = G.view, me = meSeat();
  return v.prompts.map(q => {
    const mine = q.to === me;
    let btn = '';
    if (me != null) {
      if (q.type === 'prize') btn = q.p === me ? `<div class="pzpick">${Array.from({ length: v.p[me].prizesN }, (_, k) => cardBack('pick', `data-prize="${q.id}" data-k="${k}"`)).join('')}</div>` : '';
      else if (q.type === 'promote') btn = q.p === me ? `<div class="bar">${v.p[me].bench.map(b => `<button class="primary sm" data-promote="${q.id}" data-sid="${b.sid}">${esc(nmOf(topOf(b)))}</button>`).join('')}</div>` : '';
      else btn = `<div class="bar"><button class="primary sm" data-confirm="${q.id}">이대로 확정</button><button class="judge sm" data-dismiss="${q.id}">다르게 처리</button></div>`;
    }
    const who = q.to != null ? `<span class="chip">${esc(v.p[q.to].name)} 님 확인</span>` : '';
    return `<div class="prompt ${mine ? '' : 'soft'}"><div class="q">${esc(q.text)} ${who}</div>${btn}</div>`;
  }).join('');
}
function lookHtml() {
  const v = G.view, me = meSeat(); if (me == null) return '';
  const lk = v.p[me].look; if (!lk) return '';
  const P = v.p[lk.p];
  const cards = lk.z === 'deck' ? P.deck.cards : lk.z === 'hand' ? P.hand : P.prizes;
  return `<div class="prompt look"><div class="row"><div class="q grow">🔍 ${lk.p === me ? '내' : '상대'} ${({ deck: '덱', hand: '손패', prizes: '프라이즈' })[lk.z]} 보는 중 (${(cards || []).length}장) · 카드를 눌러 옮겨요</div><button class="sm" data-t="lookEnd">닫기</button>${lk.z === 'deck' ? '<button class="sm" data-t="shuffleMine">섞고 닫기</button>' : ''}</div>
    <div class="lookrow">${(cards || []).map(x => cardFace(x, 'lk', `data-pile="${x.i}"`)).join('')}</div></div>`;
}
function groupsHtml() {
  const v = G.view, me = meSeat(); if (me == null) return '';
  return v.groups.filter(g => g.status !== 'ok' && (g.who !== me || g.status === 'disputed' || g.rewindBy != null)).filter(g => g.status !== 'open' || g.who !== me).map(g => {
    const theirs = g.who !== me;
    let btn = '';
    if (g.rewindBy != null && g.rewindBy !== me) btn = `<button class="bad sm" data-rwok="${g.start}">되돌리기 동의</button><button class="sm" data-rwno="${g.gid}">거절</button>`;
    else if (g.rewindBy === me) btn = '<span class="chip">상대 동의를 기다리는 중</span>';
    else if (g.status === 'disputed') btn = `<button class="bad sm" data-rwask="${g.gid}">이 판정 전으로 되돌리자</button>${theirs ? `<button class="good sm" data-agree="${g.gid}">그냥 동의</button>` : ''}`;
    else if (theirs) btn = `<button class="good sm" data-agree="${g.gid}">동의</button><button class="bad sm" data-dispute="${g.gid}">이의 있음</button>`;
    return `<div class="grp"><div class="t">✋ 사람 판정 · ${esc(v.p[g.who].name)}: ${esc(g.title)} ${g.status === 'open' ? '<span class="chip">진행 중</span>' : g.status === 'disputed' ? '<span class="chip warn">이의</span>' : '<span class="chip">확인 전</span>'}</div>${g.note ? `<div class="small">${esc(g.note)}</div>` : ''}${g.disputes.length ? `<div class="small">이의: ${g.disputes.map(esc).join(' / ')}</div>` : ''}<div class="bar">${btn}</div></div>`;
  }).join('');
}
// 기록을 차례마다 덩어리로: 머리(몇 번째 차례 · 누구 · 뽑은 카드) + 그 차례의 줄들. 줄마다 이름 대신 색 띠(나 파랑, 상대 빨강)
function logBlocks(lines, lineHtml) {
  const v = G.view, names = [v.p[0].name, v.p[1].name], bs = bottomSeat();
  const seatOf = n => names[0] === n ? 0 : names[1] === n ? 1 : null;
  const side = p => p == null ? 'sys' : p === bs ? 'me' : 'op';
  const blocks = []; let cur = null;
  for (const l of lines) {
    if (l.turn) { const m = l.txt.match(/(\d+)번째 차례: (.+) \(/); cur = { owner: m ? seatOf(m[2]) : null, head: { no: m ? m[1] : '?', nm: m ? m[2] : '', own: l.own, k: l.k, l } }; blocks.push(cur); cur.items = []; continue; }
    if (!cur) { cur = { owner: null, head: null, items: [] }; blocks.push(cur); }
    cur.items.push(l);
  }
  const actorOf = l => { if (l.who != null && l.k >= 0) return l.who; const m = l.txt.match(/^(?:\S+ )?([^:]+): /); return m ? seatOf(m[1]) : null; };
  const strip = (txt, p) => { if (p == null) return txt; const n = names[p]; return txt.replace(new RegExp(`^((?:\\S+ )?)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `), '$1'); };
  return blocks.map(b => {
    const h = b.head;
    const head = h ? `<div class="th" ${h.l ? lineHtml(h.l, null, true) : ''}><span class="tno">${esc(h.no)}번째 차례</span><span class="tnm">${esc(h.nm)}</span><span class="tdr">1장 뽑음${h.own ? ` · <span class="own">${esc(h.own)}</span>` : ''}</span></div>` : '<div class="th"><span class="tno">준비</span><span class="tnm">대전 준비</span></div>';
    return `<section class="tblk ${side(b.owner)}">${head}${b.items.map(l => { const a = actorOf(l); return lineHtml(l, { cls: 'a-' + side(a) + (a != null && a === b.owner ? ' ow' : ''), txt: strip(l.txt, a) }); }).join('')}</section>`;
  }).join('');
}
function logHtml() {
  const gs = Object.fromEntries(G.view.groups.map(g => [g.gid, g]));
  return logBlocks(G.lines, (l, o, headAttr) => {
    if (headAttr) return '';
    const g = l.gid && gs[l.gid];
    const jc = g ? `<span class="chip ${g.status === 'ok' ? 'ok' : g.status === 'disputed' ? 'warn' : 'judge'}">${g.status === 'ok' ? '동의함' : g.status === 'disputed' ? '이의' : '사람 판정'}</span> ` : (l.gid ? '<span class="chip judge">사람 판정</span> ' : '');
    if (l.chat) return `<div class="ln chat ${o.cls} ${l.rw ? 'rw' : ''}">${esc(l.txt)}</div>`;
    return `<div class="ln ${o.cls} ${l.gid ? 'j' : ''} ${l.rw ? 'rw' : ''}">${jc}${esc(o.txt)}${l.own ? ` <span class="own">(나만 보임: ${esc(l.own)})</span>` : ''}</div>`;
  });
}
function drawSide(target) {
  const el = target || $('#side'); if (!el) return;
  const tab = G.ui.tab;
  const tabs = `<div class="tabs"><button class="tab ${tab === 'log' ? 'on' : ''}" data-st="log">기록·채팅</button><button class="tab ${tab === 'spec' ? 'on' : ''}" data-st="spec">관전자</button><a class="tab" href="#replay/${G.id}">⏪ 되감기</a></div>`;
  let body;
  if (tab === 'log') body = `<div class="log">${logHtml()}</div>${meSeat() != null ? `<form class="chatf row"><input class="grow" name="t" maxlength="300" placeholder="채팅 (기록에 남아요)"><button class="blue sm">보내기</button></form>` : ''}`;
  else body = `<div class="log">${(G.specChat || []).map(m => `<div class="ln chat"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') || '<p class="muted">관전자 채팅이 없어요.</p>'}</div>${meSeat() == null ? `<form class="schatf row"><input class="grow" name="t" maxlength="200" placeholder="응원 한마디"><button class="blue sm">보내기</button></form>` : ''}`;
  el.innerHTML = tabs + body;
  el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { G.ui.tab = b.dataset.st; drawSide(el); });
  const lg = el.querySelector('.log'); if (lg) lg.scrollTop = lg.scrollHeight;
  const cf = el.querySelector('.chatf'); if (cf) cf.onsubmit = e => { e.preventDefault(); const t = cf.t.value.trim(); if (t) { send({ type: 'chat', text: t }); cf.t.value = ''; } };
  const sf = el.querySelector('.schatf'); if (sf) sf.onsubmit = e => { e.preventDefault(); const t = sf.t.value.trim(); if (t) { G.ws.send(JSON.stringify({ t: 'specChat', text: t })); sf.t.value = ''; } };
}

// ---------- 판 조작 ----------
function allSlots(p) { const P = G.view.p[p]; return [P.active, ...P.bench].filter(x => x && !x.hidden); }
function findSlot(sid) { for (const p of [0, 1]) { const P = G.view.p[p]; if (P.active?.sid === sid) return { p, sl: P.active, where: 'active' }; const b = P.bench.find(x => x.sid === sid); if (b) return { p, sl: b, where: 'bench' }; } return null; }
async function pickSlot(title, ps = [meSeat()]) {
  const opts = [];
  for (const p of ps) for (const sl of allSlots(p)) opts.push({ label: `${p === meSeat() ? '' : '상대 '}${G.view.p[p].active?.sid === sl.sid ? '배틀' : '벤치'}: ${esc(nmOf(topOf(sl)))}`, value: sl.sid });
  if (!opts.length) { toast('고를 포켓몬이 없어요.'); return null; }
  return pick(title, opts);
}
async function moveMenu(iids, label) {
  const me = meSeat();
  const to = await pick(`${label} 옮기기`, [
    { label: '손패로', value: { z: 'hand', p: me } }, { label: '트래시로', value: { z: 'discard', p: me } },
    { label: '덱 위로', value: { z: 'deck', p: me, pos: 'top' } }, { label: '덱 아래로', value: { z: 'deck', p: me, pos: 'bottom' } },
    { label: '벤치로 (새 포켓몬)', value: { z: 'bench', p: me } }, { label: '포켓몬에게 붙이기', value: 'attach' },
    { label: '로스트존으로', value: { z: 'lost', p: me } }, { label: '프라이즈로', value: { z: 'prizes', p: me } }, { label: '공개하기', value: 'reveal' },
  ]);
  if (!to) return;
  if (to === 'reveal') return send({ type: 'reveal', iids });
  if (to === 'attach') { const sid = await pickSlot('어느 포켓몬에게?', [me, 1 - me]); if (!sid) return; const part = (await pick('무엇으로 붙일까요?', [{ label: '에너지로', value: 'en' }, { label: '도구로', value: 'tl' }, { label: '진화 카드로 (위에 겹치기)', value: 'cards' }])); if (!part) return; return send({ type: 'move', iids, to: { z: 'slot', sid, part } }); }
  return send({ type: 'move', iids, to });
}
async function onHandCard(iid) {
  const v = G.view, me = meSeat(); const x = v.p[me].hand.find(h => h.i === iid); const c = cinfo(x.c);
  const isBasic = c.st === 'P' && (c.sub || []).includes('Basic');
  const opts = [];
  if (v.phase === 'setup') {
    if (isBasic) opts.push({ label: '배틀 포켓몬으로', value: 'sa', cls: 'primary' }, { label: '벤치로', value: 'sb', cls: 'primary' });
  } else {
    if (c.st === 'P' && isBasic) opts.push({ label: '벤치에 내기', value: 'bench', cls: 'primary' });
    if (c.st === 'P' && !isBasic) opts.push({ label: '진화시키기', value: 'evolve', cls: 'primary' });
    if (c.st === 'E') opts.push({ label: '에너지 붙이기', value: 'attach', cls: 'primary' });
    if ((c.sub || []).includes('Pokémon Tool')) opts.push({ label: '도구 붙이기', value: 'attach', cls: 'primary' });
    else if (c.st === 'T') opts.push({ label: '사용하기', value: 'play', cls: 'primary' });
    opts.push({ label: '다른 곳으로 옮기기 (효과)', value: 'move', cls: 'judge' });
  }
  openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(c)}<div class="acts">${opts.map((o, i) => `<button class="${o.cls || ''}" data-i="${i}">${o.label}</button>`).join('')}</div>`, el => {
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const k = opts[+b.dataset.i].value; closeSheet(); await new Promise(r => setTimeout(r, 30));
      if (k === 'sa' || k === 'sb') return send({ type: 'setupPlace', iid, to: k === 'sa' ? 'active' : 'bench' });
      if (k === 'bench') return send({ type: 'bench', iid });
      if (k === 'evolve') { const sid = await pickSlot('어느 포켓몬을 진화시킬까요?'); if (sid) send({ type: 'evolve', iid, sid }); return; }
      if (k === 'attach') { const sid = await pickSlot('어느 포켓몬에게 붙일까요?', [me, 1 - me]); if (sid) send({ type: 'attach', iid, sid }); return; }
      if (k === 'play') { send({ type: 'play', iid }); return; }
      if (k === 'move') moveMenu([iid], cname(c));
    });
  });
}
async function onSlot(sid) {
  const v = G.view, me = meSeat(); const f = findSlot(sid); if (!f) return;
  const mine = f.p === me, c = cinfo(topOf(f.sl).c);
  const opts = [];
  if (me != null && v.phase === 'setup' && mine) opts.push({ label: '손패로 되돌리기', value: ['setupReturn'] });
  if (me != null && v.phase === 'play') {
    if (mine && f.where === 'active') {
      (c.at || []).forEach((a, k) => opts.push({ label: `⚔ ${esc((c.kat || [])[k]?.n || a.n)} ${esc(a.d || '')}`, value: ['attack', k], cls: 'primary' }));
      if (v.p[me].bench.length) opts.push({ label: '후퇴', value: ['retreat'], cls: 'blue' });
    }
    if (mine) (c.ab || []).forEach((a, k) => opts.push({ label: `✨ 특성 ${esc((c.kab || [])[k]?.n || a.n)}`, value: ['ability', k], cls: 'blue' }));
    if (f.where === 'bench') opts.push({ label: '배틀 포켓몬과 바꾸기 (효과)', value: ['switch'], cls: 'judge' });
    opts.push({ label: '데미지 +10', value: ['dmg', 10], cls: 'judge' }, { label: '데미지 −10', value: ['dmg', -10], cls: 'judge' }, { label: '데미지 직접 넣기', value: ['dmgN'], cls: 'judge' });
    if (f.where === 'active') opts.push({ label: '특수상태', value: ['cond'], cls: 'judge' });
    opts.push({ label: '붙은 카드 옮기기', value: ['parts'], cls: 'judge' }, { label: '포켓몬 통째로 옮기기', value: ['whole'], cls: 'judge' });
  }
  const attached = [...f.sl.cards.slice(0, -1).map(x => '진화 전: ' + nmOf(x)), ...f.sl.en.map(x => '에너지: ' + nmOf(x)), ...f.sl.tl.map(x => '도구: ' + nmOf(x))];
  openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(c)}<div class="small">데미지 ${f.sl.dmg} · ${attached.map(esc).join(' · ') || '붙은 카드 없음'}</div><div class="acts">${opts.map((o, i) => `<button class="${o.cls || ''}" data-i="${i}">${o.label}</button>`).join('')}</div>`, el => {
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const [k, arg] = opts[+b.dataset.i].value; closeSheet(); await new Promise(r => setTimeout(r, 30));
      if (k === 'setupReturn') return send({ type: 'setupReturn', sid });
      if (k === 'attack') {
        const a = c.at[arg]; const sug = suggest(arg);
        const ka = (c.kat || [])[arg] || a; const fm = await ask(`기술 ${ka.n}`, `<p>${esc(ka.t || '추가 효과 없음')}</p><p>사이트 계산: <b>${sug.dmg}</b>${sug.parts.length ? ' (' + esc(sug.parts.join(', ')) + ')' : ''}</p><label class="h">상대 배틀 포켓몬에게 줄 데미지</label><input name="dmg" type="number" step="10" min="0" value="${sug.dmg}"><label class="h">설명 (선택)</label><input name="note" maxlength="100" style="width:100%">${a.t ? '<p class="small muted">추가 효과(벤치 데미지, 상태 이상 등)는 기술을 쓴 뒤 도구로 처리하고 「효과 끝」을 눌러요.</p>' : ''}`, '기술 쓰기');
        if (!fm) return; const d = +fm.dmg; return send({ type: 'attack', k: arg, dmg: d === sug.dmg ? undefined : d, note: fm.note || undefined });
      }
      if (k === 'retreat') {
        const to = await pickSlot('누구와 바꿀까요?'); if (!to || to === sid) return;
        const cost = c.rt || 0; const ens = f.sl.en;
        let dis = ens.slice(0, cost).map(x => x.i);
        if (ens.length > cost && cost > 0) {
          const fm = await ask(`트래시할 에너지 ${cost}장`, ens.map(x => `<label class="row"><input type="checkbox" name="e_${x.i}" value="1" ${dis.includes(x.i) ? 'checked' : ''}>${esc(nmOf(x))}</label>`).join(''), '후퇴');
          if (!fm) return; dis = Object.keys(fm).filter(k2 => k2.startsWith('e_')).map(k2 => k2.slice(2));
        }
        return send({ type: 'retreat', sid: to, discard: dis });
      }
      if (k === 'ability') return send({ type: 'ability', sid, k: arg });
      if (k === 'switch') return send({ type: 'switch', sid });
      if (k === 'dmg') return send({ type: 'damage', sid, n: arg });
      if (k === 'dmgN') { const fm = await ask('데미지 직접 넣기', '<label class="h">더할 데미지 (빼려면 −)</label><input name="n" type="number" step="10" value="10">'); if (fm) send({ type: 'damage', sid, n: +fm.n }); return; }
      if (k === 'cond') {
        const opt = Object.entries(COND_KO).map(([ck, l]) => ({ label: (f.sl.cond[ck] ? '✓ ' : '') + l + (f.sl.cond[ck] ? ' 회복' : ''), value: ck }));
        const ck = await pick('특수상태', opt); if (ck) send({ type: 'cond', sid, c: ck, on: !f.sl.cond[ck] }); return;
      }
      if (k === 'parts') {
        const ps = [...f.sl.en.map(x => ({ label: '에너지 ' + esc(nmOf(x)), value: x.i })), ...f.sl.tl.map(x => ({ label: '도구 ' + esc(nmOf(x)), value: x.i })), ...f.sl.cards.slice(0, -1).map(x => ({ label: '진화 전 ' + esc(nmOf(x)), value: x.i }))];
        if (!ps.length) return toast('붙은 카드가 없어요.');
        const i = await pick('어떤 카드를 옮길까요?', ps); if (!i) return;
        if (!mine) { const sid2 = await pickSlot('어느 포켓몬에게 옮길까요?', [f.p]); if (sid2) send({ type: 'move', iids: [i], to: { z: 'slot', sid: sid2, part: 'en' } }); return; }
        return moveMenu([i], '붙은 카드');
      }
      if (k === 'whole') {
        const all = [...f.sl.cards, ...f.sl.en, ...f.sl.tl].map(x => x.i);
        const to = await pick('포켓몬과 붙은 카드 모두', [{ label: '손패로', value: 'hand' }, { label: '트래시로', value: 'discard' }, { label: '덱으로 (섞기 전)', value: 'deck' }, { label: '로스트존으로', value: 'lost' }]);
        if (to) send({ type: 'move', iids: all, to: { z: to, p: f.p } }); return;
      }
    });
  });
}

function suggest(k) {
  const v = G.view, me = meSeat(); const A = v.p[me].active, D = v.p[1 - me].active;
  const c = cinfo(topOf(A).c), at = c.at[k]; const parts = [];
  let dmg = parseInt(at.d || '0', 10) || 0;
  if (/[+×x-]$/.test(at.d || '')) parts.push(`기본 ${at.d}: 추가 데미지는 직접 고쳐 주세요`);
  if (D && !D.hidden && dmg > 0) {
    const d = cinfo(topOf(D).c);
    if ((d.wk || []).some(t => (c.ty || []).includes(t))) { dmg *= 2; parts.push('약점 ×2'); }
    const r = (d.rs || []).find(([t]) => (c.ty || []).includes(t)); if (r) { dmg = Math.max(0, dmg + (parseInt(r[1], 10) || -30)); parts.push('저항력 ' + r[1]); }
  }
  return { dmg, parts };
}
async function onZone(z, p) {
  const v = G.view, me = meSeat(), P = v.p[p], mine = p === me;
  if (z === 'discard' || z === 'lost') {
    const cards = P[z];
    openSheet(`<button class="x sm" data-close>닫기</button><h3>${mine ? '내' : esc(P.name) + ' 님'} ${z === 'discard' ? '트래시' : '로스트존'} (${cards.length}장)</h3><div class="cardgrid">${cards.map(x => { const c = cinfo(x.c); return `<div class="c" data-i="${x.i}">${cimg(c) ? `<img src="${cimg(c)}" referrerpolicy="no-referrer" alt="${esc(cname(c))}">` : `<div class="ph">${esc(cname(c))}</div>`}<div>${esc(cname(c))}</div></div>`; }).join('') || '<p class="muted">비어 있어요.</p>'}</div>`, el => {
      el.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => { const i = b.dataset.i; closeSheet(); await new Promise(r => setTimeout(r, 30)); if (me == null) return; if (mine) moveMenu([i], cname(cinfo(cards.find(x => x.i === i).c))); else { const to = await pick('상대 카드 옮기기', [{ label: '상대 덱 위로', value: { z: 'deck', p, pos: 'top' } }, { label: '상대 손패로', value: { z: 'hand', p } }, { label: '상대 로스트존으로', value: { z: 'lost', p } }]); if (to) send({ type: 'move', iids: [i], to }); } });
    });
    return;
  }
  if (me == null || v.phase !== 'play') return;
  if (z === 'deck') {
    const opts = mine ? [{ label: '1장 뽑기', value: ['draw', 1] }, { label: '여러 장 뽑기', value: ['drawN'] }, { label: '덱 전체 보기 (검색)', value: ['look', null] }, { label: '위에서 몇 장 보기', value: ['lookN'] }, { label: '섞기', value: ['shuffle'] }]
      : [{ label: '상대 덱 위에서 몇 장 보기', value: ['lookN'] }, { label: '상대 덱 섞기', value: ['shuffle'] }];
    const k = await pick(mine ? '내 덱' : '상대 덱', opts); if (!k) return;
    if (k[0] === 'draw') return send({ type: 'draw', n: 1 });
    if (k[0] === 'drawN') { const f = await ask('몇 장 뽑을까요?', '<input name="n" type="number" min="1" max="60" value="2">'); if (f) send({ type: 'draw', n: +f.n }); return; }
    if (k[0] === 'look') return send({ type: 'look', p, z: 'deck' });
    if (k[0] === 'lookN') { const f = await ask('위에서 몇 장 볼까요?', '<input name="n" type="number" min="1" max="60" value="3">'); if (f) send({ type: 'look', p, z: 'deck', n: +f.n }); return; }
    if (k[0] === 'shuffle') return send({ type: 'shuffle', p });
  }
  if (z === 'prizes') { const ok = await pick(mine ? '내 프라이즈' : '상대 프라이즈', [{ label: '앞면 확인하기 (효과)', value: 1 }]); if (ok) send({ type: 'look', p, z: 'prizes' }); return; }
  if (z === 'hand' && !mine) { const ok = await pick('상대 손패', [{ label: '상대 손패 보기 (효과)', value: 1 }]); if (ok) send({ type: 'look', p, z: 'hand' }); }
}
async function onPile(iid) {
  const v = G.view, me = meSeat(), lk = v.p[me].look; const P = v.p[lk.p];
  const arr = lk.z === 'deck' ? P.deck.cards : lk.z === 'hand' ? P.hand : P.prizes; const x = arr.find(y => y.i === iid);
  if (lk.p === me) return moveMenu([iid], cname(cinfo(x.c)));
  const to = await pick('상대 카드 옮기기', [{ label: '상대 트래시로', value: { z: 'discard', p: lk.p } }, { label: '상대 덱 아래로', value: { z: 'deck', p: lk.p, pos: 'bottom' } }, { label: '상대 덱 위로', value: { z: 'deck', p: lk.p, pos: 'top' } }, { label: '상대 손패로', value: { z: 'hand', p: lk.p } }]);
  if (to) send({ type: 'move', iids: [iid], to });
}
function bindBoard() {
  const v = G.view, me = meSeat();
  app.querySelectorAll('[data-hand]').forEach(el => el.onclick = () => onHandCard(el.dataset.hand));
  app.querySelectorAll('.mat [data-sid]').forEach(el => { el.onclick = () => onSlot(el.dataset.sid); });
  app.querySelectorAll('[data-zone]').forEach(el => el.onclick = () => onZone(el.dataset.zone, +el.dataset.p));
  app.querySelectorAll('[data-pile]').forEach(el => el.onclick = () => onPile(el.dataset.pile));
  app.querySelectorAll('[data-order]').forEach(el => el.onclick = () => send({ type: 'order', first: el.dataset.order === '1' }));
  app.querySelectorAll('[data-mull]').forEach(el => el.onclick = () => send({ type: 'mullDraw', n: +el.dataset.mull }));
  app.querySelectorAll('[data-confirm]').forEach(el => el.onclick = () => send({ type: 'confirm', pid: el.dataset.confirm }));
  app.querySelectorAll('[data-dismiss]').forEach(el => el.onclick = async () => { const f = await ask('다르게 처리할까요?', '<p>자동 제안 대신 도구로 직접 처리해요. 기록에 사람 판정으로 남아요.</p><label class="h">이유 (선택)</label><input name="note" maxlength="100" style="width:100%" placeholder="예: 특성 효과로 기절하지 않음">', '다르게 처리', 'judge'); if (f) send({ type: 'dismiss', pid: el.dataset.dismiss, note: f.note }); });
  app.querySelectorAll('[data-prize]').forEach(el => el.onclick = () => send({ type: 'confirm', pid: el.dataset.prize, k: +el.dataset.k }));
  app.querySelectorAll('[data-promote]').forEach(el => el.onclick = () => send({ type: 'confirm', pid: el.dataset.promote, sid: el.dataset.sid }));
  app.querySelectorAll('[data-agree]').forEach(el => el.onclick = () => send({ type: 'agree', gid: el.dataset.agree }));
  app.querySelectorAll('[data-dispute]').forEach(el => el.onclick = async () => { const f = await ask('어떤 점이 이상한가요?', '<input name="t" maxlength="200" style="width:100%" placeholder="예: 이 서포트는 벤치에서만 가져와요">', '이의 보내기', 'bad'); if (f) send({ type: 'dispute', gid: el.dataset.dispute, text: f.t }); });
  app.querySelectorAll('[data-rwask]').forEach(el => el.onclick = () => send({ type: 'rewindAsk', gid: el.dataset.rwask }));
  app.querySelectorAll('[data-rwno]').forEach(el => el.onclick = () => send({ type: 'rewindNo', gid: el.dataset.rwno }));
  app.querySelectorAll('[data-rwok]').forEach(el => el.onclick = async () => { if (await ask('이 판정 바로 전으로 되돌릴까요?', '<p>그 뒤에 한 행동이 모두 취소되고, 기록에는 줄을 그어 남겨요.</p><p class="small"><span class="chip warn">이미 본 카드가 있어요</span> 덱이나 손패에서 본 카드는 잊을 수 없어요. 덱은 다시 섞여요.</p>', '되돌리기', 'bad')) send({ type: 'rewindOk', to: +el.dataset.rwok }); });
  app.querySelectorAll('[data-stadium]').forEach(el => el.onclick = () => { const c = cinfo(v.stadium.c); openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(c)}${me != null ? '<div class="acts"><button class="judge" data-sd>트래시로 (효과)</button></div>' : ''}`, e2 => { const b = e2.querySelector('[data-sd]'); if (b) b.onclick = () => { closeSheet(); send({ type: 'move', iids: [v.stadium.i], to: { z: 'discard', p: v.stadium.by } }); }; }); });
  app.querySelectorAll('[data-t]').forEach(el => el.onclick = async () => {
    const t = el.dataset.t;
    if (t === 'setupDone' || t === 'endTurn' || t === 'lookEnd') return send({ type: t });
    if (t === 'rewatch') return startRewatch();
    if (t === 'shuffleMine') return send({ type: 'shuffle', p: me });
    if (t === 'log') { openSheet('<button class="x sm" data-close>닫기</button><div class="panel insheet"></div>', el2 => drawSide(el2.querySelector('.panel'))); return; }
    if (t === 'coin') { const f = await ask('코인 던지기', '<label class="h">몇 번?</label><input name="n" type="number" min="1" max="20" value="1"><label class="h">무엇 때문에? (선택)</label><input name="why" maxlength="60" style="width:100%">', '던지기'); if (f) send({ type: 'coin', n: +f.n, why: f.why }); return; }
    if (t === 'effect') { const f = await ask('효과 쓰기', '<p>지금부터 하는 카드 이동, 데미지 등이 이 효과 아래에 묶여 기록돼요.</p><label class="h">어떤 카드의 효과인가요?</label><input name="title" maxlength="40" style="width:100%" placeholder="예: 보스의 지령"><label class="h">설명 (선택)</label><input name="note" maxlength="100" style="width:100%">', '시작', 'judge'); if (f) send({ type: 'effect', title: f.title || '카드 효과', note: f.note }); return; }
    if (t === 'effectEnd') { const f = await ask('효과 끝', '<p>상대에게 "이렇게 처리했어요"로 보여요.</p><label class="h">한 줄 설명 (선택)</label><input name="note" maxlength="100" style="width:100%">', '끝내기', 'judge'); if (f) send({ type: 'effectEnd', note: f.note }); return; }
    if (t === 'more') { const k = await pick('더 보기', [{ label: `${ICON.gear}설정`, value: 'set' }, { label: '항복하기', value: 'concede', cls: 'bad' }, { label: '로비로', value: 'lobby' }]); if (k === 'lobby') location.hash = '#lobby';
      if (k === 'set') openSettings(() => draw([])); if (k === 'concede' && await ask('항복할까요?', '<p>이 판은 상대 승리로 끝나요.</p>', '항복', 'bad')) send({ type: 'concede' }); }
  });
}


// ---------- 상대 직전 턴 다시 보기 ----------
// 상대가 마지막으로 한 차례를 처음부터 한 단계씩 천천히 다시 그림. 움직인 카드에 강조 틀, 위에 무엇을 했는지 한 줄.
function lastOppTurn() {
  const v = G.view, me = meSeat(); if (me == null || v.phase === 'setup') return null;
  const on = v.p[1 - me].name;
  const ts = G.lines.filter(l => l.turn && l.k >= 0).map(l => ({ k: l.k, who: (l.txt.match(/차례: (.+) \(/) || [])[1] }));
  for (let i = ts.length - 1; i >= 0; i--) if (ts[i].who === on) return { k0: ts[i].k, k1: i + 1 < ts.length ? ts[i + 1].k + 1 : v.n };
  return null;
}
const rwKey = t => `rw:${G.id}:${t.k0}:${t.k1}`;
function rwSeen(t) { try { return localStorage.getItem(rwKey(t)) === '1'; } catch { return false; } }
async function startRewatch() {
  const t = lastOppTurn(); if (!t) return toast('다시 볼 상대 차례가 없어요.');
  const ks = []; for (let k = t.k0; k <= t.k1; k++) ks.push(k);
  let rs; try { rs = await Promise.all(ks.map(k => api(`/api/games/${G.id}/at?k=${k}`))); } catch (e) { return toast(e.message || '불러오지 못했어요.'); }
  const views = {}; rs.forEach((r, i) => views[ks[i]] = { ...r.view, me: G.view.me, n: r.n, deadline: null, cfg: G.view.cfg });
  try { localStorage.setItem(rwKey(t), '1'); } catch {}
  G.rw = { ...t, k: t.k0, views, playing: true, timer: null, prev: null, dirty: false };
  drawRw(false);
  rwPlan();
}
function rwPlan() { // 자동 재생: 한 단계마다 천천히
  const rw = G.rw; if (!rw) return; clearTimeout(rw.timer);
  if (rw.playing && rw.k < rw.k1) rw.timer = setTimeout(() => rwStep(1), rw.k === rw.k0 ? 1100 : 2000);
  else if (rw.k >= rw.k1) { rw.playing = false; }
}
function rwStep(d) {
  const rw = G.rw; if (!rw) return; const nk = rw.k + d;
  if (nk < rw.k0 || nk > rw.k1) return;
  rw.k = nk; drawRw(d > 0); rwPlan();
}
function endRewatch() { const rw = G.rw; if (!rw) return; clearTimeout(rw.timer); G.rw = null; draw([]); }
const stripWho = (txt, name) => txt.startsWith(name + ': ') ? txt.slice(name.length + 2) : txt;
function rwLoc(v) { // 카드 번호 → 있는 곳
  const m = new Map();
  for (const p of [0, 1]) {
    const P = v.p[p];
    (P.hand || []).forEach(x => m.set(x.i, `hand:${p}`)); P.discard.forEach(x => m.set(x.i, `disc:${p}`)); P.lost.forEach(x => m.set(x.i, `lost:${p}`));
    (P.prizes || []).forEach(x => x && m.set(x.i, `prz:${p}`));
    for (const sl of [P.active, ...P.bench]) if (sl && !sl.hidden) [...sl.cards, ...sl.en, ...sl.tl].forEach(x => m.set(x.i, `slot:${sl.sid}`));
  }
  if (v.stadium) m.set(v.stadium.i, 'stad');
  return m;
}
function rwTargets(a, b) { // 두 장면 사이에 바뀐 곳 (화면 요소 선택자)
  const A = rwLoc(a), B = rwLoc(b), out = [], add = s => { if (!out.includes(s)) out.push(s); };
  const sel = (loc, i) => { const [z, p] = loc.split(':');
    if (z === 'slot') return `.mat [data-sid="${p}"]`; if (z === 'disc') return `.pile.disc[data-p="${p}"]`; if (z === 'lost') return `.lostc[data-p="${p}"]`;
    if (z === 'prz') return `.prizes[data-p="${p}"]`; if (z === 'stad') return '.stadium';
    if (z === 'hand') return +p === bottomSeat() ? `.handbar [data-k="${i}"]` : '.ohand'; return null; };
  for (const [i, loc] of B) if (A.get(i) !== loc) { const s2 = sel(loc, i); if (s2) add(s2); }
  const st = v => { const o = {}; for (const p of [0, 1]) [v.p[p].active, ...v.p[p].bench].forEach((sl, j) => { if (sl && !sl.hidden) o[sl.sid] = `${sl.dmg}|${JSON.stringify(sl.cond || {})}|${p}:${j ? 'b' : 'a'}`; }); return o; };
  const sa = st(a), sb = st(b);
  for (const sid in sb) if (sa[sid] != null && sa[sid] !== sb[sid]) add(`.mat [data-sid="${sid}"]`);
  for (const p of [0, 1]) {
    if (a.p[p].deck.n !== b.p[p].deck.n) add(`.pile.deck[data-p="${p}"]`);
    if (!b.p[p].hand && a.p[p].handN !== b.p[p].handN) add('.ohand');
    if (a.p[p].prizesN !== b.p[p].prizesN) add(`.prizes[data-p="${p}"]`);
  }
  return out.slice(0, 5);
}
function hlFrame(w, h) { // 강조 틀: 가는 선 하나, 왼쪽 위·오른쪽 아래 모서리만 비스듬히 (링크 님이 고른 모양으로 바꿀 자리)
  const o = 2, c = Math.max(6, Math.min(12, Math.min(w, h) * .14)), f = n => n.toFixed(1);
  const d = `M${f(o + c)} ${f(o)}H${f(w - o)}V${f(h - o - c)}L${f(w - o - c)} ${f(h - o)}H${f(o)}V${f(o + c)}Z`;
  return `<svg viewBox="0 0 ${f(w)} ${f(h)}" aria-hidden="true"><path class="hd" pathLength="1" d="${d}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
function rwHighlight(sels) {
  const layer = app.querySelector('.hl-layer'), tb = app.querySelector('.table'); if (!layer || !tb) return;
  sels.forEach(s => app.querySelectorAll(s).forEach(el => el.classList.add('rwon')));
  setTimeout(() => { // 카드가 다 움직인 뒤에 틀을 그림
    if (!layer.isConnected) return;
    const T = tb.getBoundingClientRect(), m = 6;
    layer.innerHTML = sels.flatMap(s => [...app.querySelectorAll(s)].slice(0, 1)).map(el => {
      const r = el.getBoundingClientRect(); if (!r.width) return '';
      const w = r.width + m * 2, h = Math.min(r.height, T.bottom - r.top) + m * 2;
      return `<div class="hlf" style="left:${(r.left - T.left - m).toFixed(1)}px;top:${(r.top - T.top - m).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px">${hlFrame(w, h)}</div>`;
    }).join('');
  }, reduceMotion() ? 0 : 520);
}
function drawRw(forward) {
  const rw = G.rw, live = G.view, liveLines = G.lines, me = meSeat(), on = live.p[1 - me].name;
  const prevRects = app.querySelector('.mat') ? snapRects() : null;
  const cur = rw.views[rw.k], before = rw.k > rw.k0 ? rw.views[rw.k - 1] : null;
  const stepLines = before ? liveLines.filter(l => l.k === rw.k - 1) : [];
  const caps = stepLines.filter(l => l.txt && !l.turn).map(l => esc(stripWho(l.txt, on)) + (l.own ? ` <span class="muted">(${esc(l.own)})</span>` : ''));
  const turnL = stepLines.find(l => l.turn);
  const cap = rw.k === rw.k0 ? '처음부터 한 단계씩 보여 드릴게요.' : caps.length ? caps.join('<br>') : turnL ? esc(turnL.txt.replace(/─/g, '').trim()) : '차례를 넘겼어요.';
  const total = rw.k1 - rw.k0, at = rw.k - rw.k0, end = rw.k >= rw.k1;
  G.view = cur; G.lines = liveLines.filter(l => l.k < rw.k);
  app.innerHTML = `<div class="arena rwmode"><div class="table">${matHtml(true)}<div class="hl-layer"></div>
    <div class="rwcap"><b class="rwh">${esc(on)} 님 차례 다시 보기</b><span class="rwt">${cap}</span></div>
    <div class="rwbar"><button class="sm" data-rw="close">✕ 그만 보기</button><button class="sm" data-rw="prev" aria-label="이전" ${at ? '' : 'disabled'}>◀</button>
      ${end ? '<button class="sm primary" data-rw="close">판으로 돌아가기</button>' : `<button class="sm ${rw.playing ? '' : 'primary'}" data-rw="play">${rw.playing ? '⏸ 멈춤' : '▶ 재생'}</button>`}
      <button class="sm" data-rw="next" aria-label="다음" ${end ? 'disabled' : ''}>▶</button><span class="pill">${at} / ${total}</span></div></div></div>`;
  app.querySelectorAll('[data-rw]').forEach(b => b.onclick = () => {
    const k = b.dataset.rw;
    if (k === 'close') return endRewatch();
    if (k === 'play') { rw.playing = !rw.playing; drawRw(false); rwPlan(); return; }
    rw.playing = false; rwStep(k === 'next' ? 1 : -1);
  });
  flip(prevRects);
  if (before) {
    if (forward && rw.prev) { effects(rw.prev, stepLines); gameSounds(rw.prev, stepLines); }
    const sels = rwTargets(before, cur);
    sels.forEach(s => { if (s.startsWith('.handbar')) app.querySelector(s)?.classList.add('rwlift'); });
    rwHighlight(sels);
  }
  rw.prev = JSON.parse(JSON.stringify(cur));
  G.view = live; G.lines = liveLines;
}

// ---------- 기보 다시 보기 ----------
async function renderReplay(id, k0) {
  app.innerHTML = '<div class="arena-loading"><div class="spin-ball"></div><p>기보를 불러오는 중…</p></div>';
  document.body.classList.add('in-game');
  leaveGame = () => document.body.classList.remove('in-game');
  loadCards().catch(() => {});
  let info; try { info = await api(`/api/games/${id}/info`); } catch (e) { app.innerHTML = `<p class="pad">${esc(e.message)}</p>`; return; }
  const RG = { id, cards: info.cards, n: info.n, lines: info.lines, k: k0 >= 0 ? Math.min(k0, info.n) : info.n, timer: null };
  const turns = info.lines.filter(l => l.turn && l.k >= 0).map(l => l.k);
  const setK = k => { RG.k = Math.max(0, Math.min(RG.n, k)); history.replaceState(null, '', `#replay/${id}/${RG.k}`); show(); };
  const show = async () => {
    const r = await api(`/api/games/${id}/at?k=${RG.k}`);
    const prev = app.querySelector('.mat') ? snapRects() : null;
    G = { id, view: { ...r.view, me: info.me, n: r.n, deadline: null }, lines: info.lines.filter(l => l.k < RG.k), cards: info.cards, specs: [], ui: {} };
    const pos = l => `${l.k === RG.k - 1 ? 'cur' : l.k >= RG.k ? 'later' : ''}" data-k2="${l.k + 1}`;
    const lines = logBlocks(info.lines, (l, o, head) => head ? `class="${pos(l)}"` : `<div class="ln ${o.cls} ${l.chat ? 'chat' : ''} ${l.gid ? 'j' : ''} ${l.rw ? 'rw' : ''} ${pos(l)}">${l.gid ? '<span class="chip judge">사람 판정</span> ' : ''}${esc(l.chat ? l.txt : o.txt)}${l.own ? ` <span class="own">(${esc(l.own)})</span>` : ''}</div>`);
    app.innerHTML = `<div class="arena replay"><div class="table">
        <div class="replaybar"><span class="pill">${info.over ? '끝난 판 · 모두 공개' : '진행 중 · 내가 볼 수 있는 것만'}</span>
          <button class="rb" data-j="turnPrev">⏮</button><button class="rb" data-j="prev">◀</button><button class="rb" data-j="play">${RG.timer ? '⏸' : '▶ 재생'}</button><button class="rb" data-j="next">▶</button><button class="rb" data-j="turnNext">⏭</button>
          <span class="rk"><input type="range" min="0" max="${RG.n}" value="${RG.k}" id="rk" aria-label="몇 번째 수"><span class="pill">${RG.k} / ${RG.n}수</span>${info.over ? '' : `<a class="rb primary" href="#game/${id}">판으로</a>`}</span></div>
        ${matHtml(true)}</div>
      <aside class="panel"><div class="tabs"><span class="tab on">기보</span></div><div class="log" id="rlog">${lines}</div></aside></div>`;
    app.querySelectorAll('[data-j]').forEach(b => b.onclick = () => {
      const j = b.dataset.j;
      if (j === 'play') { if (RG.timer) { clearInterval(RG.timer); RG.timer = null; show(); } else { RG.timer = setInterval(() => { if (RG.k >= RG.n) { clearInterval(RG.timer); RG.timer = null; return show(); } setK(RG.k + 1); }, 1100); show(); } return; }
      if (j === 'prev') setK(RG.k - 1); if (j === 'next') setK(RG.k + 1);
      if (j === 'turnPrev') setK([...turns].reverse().find(t => t < RG.k - 1) ?? 0);
      if (j === 'turnNext') { const t = turns.find(t2 => t2 > RG.k - 1); setK(t != null ? t + 1 : RG.n); }
    });
    $('#rk').onchange = e => setK(+e.target.value);
    app.querySelectorAll('#rlog [data-k2]').forEach(el => el.onclick = () => setK(+el.dataset.k2));
    app.querySelectorAll('.mat [data-sid]').forEach(el => el.onclick = () => { const f = findSlot(el.dataset.sid); if (f) openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(cinfo(topOf(f.sl).c))}`); });
    const cur = app.querySelector('#rlog .cur'); if (cur) cur.scrollIntoView({ block: 'center' });
    flip(prev);
  };
  const prevLeave = leaveGame; leaveGame = () => { if (RG.timer) clearInterval(RG.timer); prevLeave(); };
  show();
}

document.addEventListener('error', e => { const im = e.target; if (im.tagName === 'IMG' && !im.dataset.f) { im.dataset.f = 1; const d = document.createElement('div'); d.className = 'ph'; d.textContent = im.alt || '카드'; d.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.72rem;padding:2px;word-break:keep-all;aspect-ratio:63/88'; im.replaceWith(d); } }, true);
// 잔잔한 배경: 천천히 흐르는 구름 몇 겹, 아주 느리게 도는 햇살, 아래에서 떠오르는 빛 알갱이 (움직임 줄이기 설정이면 멈춤)
(function ambient() {
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const clouds = Array.from({ length: 6 }, (_, i) => `<i class="cl" style="--w:${Math.round(90 + r() * 120)}px;--y:${Math.round(6 + r() * 58)}vh;--o:${(.5 + r() * .4).toFixed(2)};--d:${Math.round(110 + r() * 90)}s;--dl:${-Math.round(r() * 200)}s"></i>`).join('');
  const motes = Array.from({ length: 16 }, () => `<i class="mo" style="--x:${Math.round(r() * 100)}vw;--s:${Math.round(4 + r() * 7)}px;--o:${(.35 + r() * .45).toFixed(2)};--sw:${Math.round(-40 + r() * 80)}px;--d:${Math.round(16 + r() * 14)}s;--dl:${-Math.round(r() * 30)}s"></i>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<div id="amb" aria-hidden="true"><i class="rays"></i><i class="sun"></i>${clouds}${motes}</div>`);
})();
route();
