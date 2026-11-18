import KS from '/lib/ks.js';
import { indexCards, parseDeckList, checkDeck, exportDeckList, koName, cardNo, sideEn } from '/lib/deck.js';
import Sound from '/lib/sound.js';
import { parseSearch, parseTop, parseCost, searchLabel, toLabel, REST_KO } from '/lib/fxhelp.js';

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
  sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  battle: svg('<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>'),
  deck: svg('<rect x="8" y="3" width="12" height="16" rx="2"/><path d="M5 6.5V19a2 2 0 0 0 2 2h9"/>'),
  gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'),
  bell: svg('<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.6 2.2H4.4z"/><path d="M10 20.6a2.2 2.2 0 0 0 4 0"/>'),
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
  key: svg('<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v3"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.8 3.5-5.5 6.5-5.5s5.7 1.7 6.5 5.5M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14.8c2 .7 3.4 2.4 4 5.2"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  star: svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>'),
  paste: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>'),
  photo: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>'),
  judge: svg('<path d="M8.5 12.5V5.2a1.5 1.5 0 0 1 3 0V11M11.5 10.5V3.8a1.5 1.5 0 0 1 3 0v6.7M14.5 10.5V5.6a1.5 1.5 0 0 1 3 0V14c0 4.2-2.6 7-6.4 7-2.5 0-4.1-1.3-5.4-3.4l-2.4-3.9a1.5 1.5 0 0 1 2.5-1.6l1.7 2.4"/>'),
  coin: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8l1.3 2.7 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>'),
  rewind: svg('<path d="M11 6.5 4.5 12l6.5 5.5zM19.5 6.5 13 12l6.5 5.5z"/>'),
  retreat: svg('<path d="M9 6.5 4 11.5l5 5"/><path d="M4.5 11.5H14a5.5 5.5 0 0 1 0 11h-1.5"/>'),
  spark: svg('<path d="M12 3.2l1.9 5.3 5.4 1.9-5.4 1.9L12 17.6l-1.9-5.3-5.4-1.9 5.4-1.9z"/><path d="M19 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>'),
  prev: svg('<path d="M15 5.5 8.5 12l6.5 6.5"/>'),
  next: svg('<path d="M9 5.5 15.5 12 9 18.5"/>'),
  first: svg('<path d="M17 5.5 10.5 12l6.5 6.5M7 5.5v13"/>'),
  last: svg('<path d="M7 5.5 13.5 12 7 18.5M17 5.5v13"/>'),
  pause: svg('<path d="M8.5 5v14M15.5 5v14"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  chat: svg('<path d="M4 5.5h16v10H10l-4.5 4v-4H4z"/>'),
  expand: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  shrink: svg('<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>'),
  share: svg('<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M8.5 10.5H6v10h12v-10h-2.5"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11.5" height="12.5" rx="2.2"/><path d="M15.5 8.5V5.2A2.2 2.2 0 0 0 13.3 3H6.2A2.2 2.2 0 0 0 4 5.2v8.6A2.2 2.2 0 0 0 6.2 16h2.3"/>'),
  save: svg('<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  out: svg('<path d="M13 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/><path d="M14.5 3.5H20V9M20 3.5l-8 8"/>'),
  flag: svg('<path d="M5.5 21V3.5M5.5 4h12.5l-2.6 4.6 2.6 4.6H5.5"/>'),
  homeAdd: svg('<rect x="6" y="2.8" width="12" height="18.4" rx="2.6"/><path d="M12 8.5v6M9 11.5h6"/>'),
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
// 카드 표시 (각자 고르거나 '모임 기본' 따르기). D = 지금 내 화면에 쓰는 값
const DISP_OPTS = [
  { k: 'dimg', t: '카드 그림', d: '판·손패·목록에 작게 나오는 카드 그림이에요. 합친 카드는 그림 칸만 영문판이고 이름과 설명은 한글판이에요.', o: [['kr', '한글판'], ['mix', '합친 카드'], ['en', '영문판']] },
  { k: 'dtext', t: '카드 글자', d: '카드 이름, 특성, 기술 설명을 어떤 말로 보여 줄지 골라요. 한국어 + 영어는 영어 이름을 작게 같이 보여 줘요.', o: [['ko', '한국어'], ['en', '영어'], ['both', '한국어 + 영어']] },
  { k: 'ddet', t: '카드를 눌렀을 때', d: '설명 없이 카드만 크게 볼 수도 있어요.', o: [['text', '글자 + 작은 카드'], ['card', '카드만 크게']] },
  { k: 'dinfo', t: '카드 밑 글자', d: '덱과 카드 추가 창에서 이름과 번호를 숨기면 카드만 보여요.', o: [['show', '보이기'], ['hide', '숨기기']] },
  { k: 'dsize', t: '카드 크기', d: '덱과 카드 추가 창의 카드 크기예요.', o: [['s', '작게'], ['m', '보통'], ['l', '크게']] },
];
const DISP_DEF = { dimg: 'mix', dtext: 'ko', ddet: 'text', dinfo: 'show', dsize: 'm' };
const DISP_PRESETS = [
  ['rec', '추천', '작게도 크게도 합친 카드, 글자는 한국어', {}],
  ['cardonly', '카드만', '설명 없이 카드 그림만', { ddet: 'card', dinfo: 'hide' }],
  ['en', '영어로만', '카드 그림도 글자도 영문판', { dimg: 'en', dtext: 'en' }],
  ['kr', '한글판만', '어디서든 한글판 그림', { dimg: 'kr' }],
].map(([k, l, d, o]) => ({ k, l, d, v: { ...DISP_DEF, ...o } }));
const sameDisp = (a, b) => DISP_OPTS.every(o => a[o.k] === b[o.k]);
const validDisp = (o, src, base) => { const out = { ...base }; for (const x of DISP_OPTS) if (src && x.o.some(y => y[0] === src[x.k])) out[x.k] = src[x.k]; return out; };
const groupDisp = () => validDisp(DISP_OPTS, SK.group, DISP_DEF);
let D = { ...DISP_DEF };
function applyDisp() {
  const p = SK.prefs || {}, g = groupDisp();
  if (p.disp === 'mine') D = validDisp(DISP_OPTS, p, g);
  else if (!p.disp && (p.art === 'en' || p.art === 'kr')) D = { ...g, dimg: p.art }; // 예전 '카드 그림' 설정
  else D = g;
  if (!SK.admin) D = g; // 카드 표시 설정은 잠시 관리자만 (11/18 링크 님: 일반 참가자에게는 숨기고 쓰지 않음)
}
function applySkin() {
  const b = document.body;
  [...b.classList].filter(c => /^(back|mat)-/.test(c)).forEach(c => b.classList.remove(c));
  const bk = effSkin('back'), mt = effSkin('mat');
  if (bk.img) { b.classList.add('back-custom'); b.style.setProperty('--bk-img', imgUrl(bk.img)); } else b.classList.add('back-' + bk.preset);
  if (mt.img) { b.classList.add('mat-custom', mt.img.dark ? 'mat-dark' : 'mat-light'); b.style.setProperty('--mt-img', imgUrl(mt.img)); } else b.classList.add('mat-' + mt.preset);
  applyDisp();
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
  if (!loadMe.push) { loadMe.push = 1; PUSH.sync(); } // 알림을 켜 둔 기기면 서버에 다시 등록
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
  if (!r.ok) { const e = new Error(j.error || '오류가 났어요.'); e.data = j; e.status = r.status; throw e; }
  return j;
}
function toast(m, ms = 2600) { const t = $('#toast'); t.textContent = m; t.hidden = false; Sound.sfx('notify'); clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms); }
async function loadCards() { if (!ALL) { const r = await fetch('/cards.json'); if (!r.ok) throw new Error('카드 자료를 못 불러왔어요. 다시 로그인해 주세요.'); const a = await r.json(); IDX = indexCards(a); ALL = a; } return ALL; }
// 카드 그림: kr = 한글판, en = 영문판(워터마크 없음), mix = 합친 카드(한글판 위에 그림 칸만 같은 그림의 영문판)
const hires = u => u ? u.replace(/\.png$/, '_hires.png') : null;
const canMix = c => !!(c && c.kimg && c.img && !(c.st === 'E' && (c.sub || []).includes('Basic'))); // 기본 에너지는 글 칸이 없어 뺌. 그림이 같은 한글판이 따로 있으면(kmix) 그 판을 바탕으로, 없으면 일반 판 틀에 영문판 그림 칸
function picMode(c, want) { // 고른 그림 → 실제로 보일 그림 (없으면 있는 쪽)
  if (!c) return null;
  if (want === 'mix' && canMix(c)) return 'mix';
  if (want === 'en' && c.img) return 'en';
  if (c.kimg) return 'kr';
  return c.img ? 'en' : null;
}
const BAND = c => { // 합친 카드에서 영문판을 쓰는 세로 범위 (카드 높이 %, 위·아래). PC에서 한글판 그림 칸 테두리를 재서 맞춤 (2026-11-18)
  const s = c.sub || [];
  if (c.st === 'E') return [13.5, 64.8, s.includes('ACE SPEC')]; // ACE SPEC 특수 에너지는 55.5% 아래 오른쪽 세로 'ACE SPEC' 칸(9.5%)을 뺌
  if (c.st !== 'P') return [13.5, 52.3];
  if (s.includes('MEGA')) return [13.6, 50.9]; // '○○이 메가진화한 모습' 띠 아래부터
  if (s.includes('Tera')) return [16.8, 50.9]; // 그림 위에 깔린 테라스탈 규칙 상자 아래부터
  const kra = c.kmix ? c.kmr : c.kra; // 바탕이 된 한글판의 레어도
  if (kra === 'AR') return [11.5, 50.5];
  if (s.includes('ex') || /^(SAR|SR|UR|HR|MUR|SSR|BWR)$/.test(kra || '')) return [12, 50.9];
  return [11.8, 47.4]; // 보통 포켓몬: 진화 줄 아래 ~ 도감 줄 위
};
function picHtml(c, want, big = false) { // 카드 그림 <img> (합친 카드는 두 장 겹침). 감싸는 칸은 position: relative
  const m = picMode(c, want); if (!m) return '';
  const nm = esc(cname(c)), lazy = big ? '' : 'loading="lazy"';
  // 크게 볼 때 영문 큰 그림은 장당 약 1MB·1초라, 이미 받아 둔 작은 그림을 먼저 보이고 큰 그림이 다 받아지면 바꾼다 (못 받으면 작은 그림 그대로)
  const en = c.img, fb = big && c.img ? ` data-hi="${hires(c.img)}" onload="const h=this.dataset.hi;if(h){this.dataset.hi='';const i=new Image();i.referrerPolicy='no-referrer';i.onload=()=>{this.src=h};i.src=h}"` : '';
  if (m === 'mix') { const [t, b, ace] = BAND(c), clip = ace ? `;clip-path:polygon(0 ${t}%,100% ${t}%,100% 55.5%,90.5% 55.5%,90.5% ${b}%,0 ${b}%)` : ''; return `<img src="${c.kmix || c.kimg}" alt="${nm}" referrerpolicy="no-referrer" ${lazy} draggable="false"><img class="band" src="${en}" alt="" referrerpolicy="no-referrer" ${lazy} draggable="false" style="--bt:${t}%;--bb:${100 - b}%${clip}"${fb}>`; }
  return `<img src="${m === 'kr' ? c.kimg : en}" alt="${nm}"${m === 'kr' && c.side === 'L' ? ' class="hl"' : ''} referrerpolicy="no-referrer" ${lazy} draggable="false"${m === 'en' ? fb : ''}>`; // 짝 카드 한글판은 두 장을 이어 붙인 그림: 좌측은 왼쪽 반(hl), 우측은 오른쪽 반(기본)
}
const cnameKo = c => !c ? '?' : koName(c) || c.n; // 한국어 이름 (deck.js의 koName: 내보내기·붙여 넣기와 같은 이름)
const cname = c => !c ? '?' : D.dtext === 'en' && !c.kro ? c.n + sideEn(c) : cnameKo(c); // 화면에 쓰는 이름 (카드 글자 설정). 짝 카드는 (좌측)·(우측)
const altName = c => D.dtext === 'both' && c && !c.kro && c.n !== cnameKo(c) ? c.n + sideEn(c) : ''; // '한국어 + 영어 이름'일 때 덧붙일 영문 이름

// ---------- 선택 창 (뒤로 가기로 닫힘) ----------
const sheetStack = [];
function openSheet(html, onMount) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="in">${html}</div>`; sh.hidden = false; Sound.sfx('open');
  if (!sheetStack.length) history.pushState({ sheet: 1 }, '');
  sheetStack.push(1);
  sh.onclick = e => { if (e.target === sh || e.target.closest('[data-close]')) closeSheet(); };
  // 닫기 단추는 창 바깥 오른쪽 위로 (창 안 내용이 한쪽으로 밀리지 않고 가운데에 오게)
  const inn = sh.firstElementChild, x = inn.querySelector(':scope > .x[data-close]');
  if (x) { x.className = 'xo'; x.innerHTML = ICON.x; x.setAttribute('aria-label', '닫기'); sh.appendChild(x); inn.classList.add('hasxo'); }
  onMount && onMount(inn);
  if (x) { placeX(); const h = e => { if (e.target !== inn) return; inn.removeEventListener('animationend', h); placeX(); }; inn.addEventListener('animationend', h); setTimeout(placeX, 360); }
}
function placeX() { // 창 위 오른쪽 바깥 (위에 자리가 없으면 창 안 오른쪽 위)
  const sh = $('#sheet'), x = sh.querySelector(':scope > .xo'), inn = sh.querySelector(':scope > .in'); if (!x || !inn || sh.hidden) return;
  const r = inn.getBoundingClientRect(), out = r.top >= 60;
  x.classList.toggle('inside', !out); inn.classList.toggle('xin', !out); x.style.top = Math.round(out ? r.top - 54 : r.top + 10) + 'px'; x.style.left = Math.round(r.right - (out ? 48 : 56)) + 'px';
}
window.addEventListener('resize', () => requestAnimationFrame(placeX));
function closeSheet(fromPop) {
  const sh = $('#sheet'); if (sh.hidden) return;
  const sub = SUBVIEW ? 1 : 0; SUBVIEW = null;
  sh.hidden = true; sh.innerHTML = ''; sheetStack.length = 0; ZV = null; if (typeof ZMENU !== 'undefined' && ZMENU) zvMenuClose();
  if (!fromPop) { popSkip++; history.go(-1 - sub); }
}
// ---------- 뒤로 가기 ----------
// 순서: 창 안의 자세히 보기 → 선택 창 → 리플레이 → 페이지. 대전·리플레이·덱 고치기는 두 번 눌러야 나감 (첫 번째엔 안내, 덱을 고쳤으면 저장할지 물음)
let GUARD = null, SUBVIEW = null, popSkip = 0, navCount = 0;
function guardPage(msg, onLeave) { if (GUARD) clearTimeout(GUARD.t); GUARD = { hash: location.hash, msg, onLeave, t: 0, armed: 0 }; history.pushState({ guard: 1 }, ''); }
function rearm() { if (GUARD && location.hash === GUARD.hash && !GUARD.leaving) { GUARD.armed = 0; history.pushState({ guard: 1 }, ''); } }
function leavePage(fallback) { // 화면의 '닫기'로 나갈 때: 지킴 칸을 건너뛰고 바로 앞 페이지로
  if (GUARD) { GUARD.leaving = true; clearTimeout(GUARD.t); }
  if (navCount > 1 && GUARD && !GUARD.armed) history.go(-2); else location.hash = fallback;
}
window.addEventListener('popstate', () => {
  if (popSkip) { popSkip--; return; }
  if (REVEAL) { closeReveal(true); return; } // 상대가 보여준 카드 창부터
  if (ZMENU) { const live = ZMENU.m.isConnected; zvMenuClose(); if (live) { history.pushState({ sheet: 1 }, ''); return; } } // 분류 목록만 닫고 창은 그대로
  if (SUBVIEW) { SUBVIEW(); return; }
  if (!$('#sheet').hidden) { closeSheet(true); return; }
  if (!GUARD || GUARD.leaving || location.hash !== GUARD.hash) return; // 다른 페이지로 가는 중 (hashchange가 그림)
  if (G && G.view && document.querySelector('.arena .dock')) { G.ui.dockMode = 'shut'; draw([]); rearm(); return; } // 판정 창이 펼쳐져 있으면 접기부터
  if (G && G.rw && G.rw.mode === 'game') { endRewatch(); rearm(); return; }
  const fn = GUARD.onLeave && GUARD.onLeave();
  if (fn) { rearm(); fn(); return; }
  if (GUARD.armed) return;
  GUARD.armed = 1; toast(GUARD.msg, 2200); clearTimeout(GUARD.t);
  GUARD.t = setTimeout(() => { if (GUARD && GUARD.armed) rearm(); }, 2200);
});
// 단추 묶음은 줄마다 개수가 고르게 (4개면 2+2, 5개면 3+2, 7개면 4+3), 글자가 줄바꿈되지 않을 만큼만 한 줄에
function balCols(labels, W = Math.min(innerWidth, 640) - 40) {
  const n = labels.length; if (!n) return 1;
  const L = Math.max(...labels.map(l => String(l).replace(/<small[^>]*>.*?<\/small>/g, '  ').replace(/<[^>]+>/g, '').trim().length));
  const per = Math.max(1, Math.min(4, Math.floor((W + 10) / (L * 15.5 + 58))));
  return Math.ceil(n / Math.ceil(n / per));
}
const actsHtml = (opts, cls = '', W) => opts.length ? `<div class="acts bal ${cls}" style="--cols:${balCols(opts.map(o => o.label), W)}">${opts.map(o => `<button class="${o.cls || ''}" data-i="${o.i}">${o.label}</button>`).join('')}</div>` : '';
const FX = '<small class="fx">효과</small>'; // 카드 효과로 하는 일 표시 (줄바꿈 없이 작은 꼬리표)
function pick(title, options) { // options: [{label, value, cls}]
  return new Promise(res => {
    openSheet(`<button class="x sm" data-close>닫기</button><h3>${esc(title)}</h3>${actsHtml(options.map((o, i) => ({ ...o, i })), '', Math.min(innerWidth, 520) - 40)}`, el => {
      el.classList.add('picksheet');
      el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const o = options[+b.dataset.i]; closeSheet(); setTimeout(() => res(o.value), 30); });
    });
  });
}
// 숫자 고르기는 키보드 대신 ▼▲ 단추: stepHtml(이름, 값, { min, max, by, unit })
const stepHtml = (name, v, o = {}) => `<div class="stepper" data-step data-min="${o.min ?? -999}" data-max="${o.max ?? 999}" data-by="${o.by || 1}"><button type="button" class="stp" data-d="-1" aria-label="줄이기">${ICON.down}</button><output class="stv" aria-live="polite"><b>${v}</b>${o.unit || ''}</output><input type="hidden" name="${name}" value="${v}"><button type="button" class="stp" data-d="1" aria-label="늘리기">${ICON.up}</button></div>`;
function bindSteps(root, onChange) {
  root.querySelectorAll('[data-step]').forEach(s => {
    const inp = s.querySelector('input'), out = s.querySelector('.stv b'), st = s.querySelectorAll('.stp'), lo = +s.dataset.min, hi = +s.dataset.max, by = +s.dataset.by;
    const set = v => { v = Math.max(lo, Math.min(hi, v)); inp.value = v; out.textContent = v; st[0].disabled = v <= lo; st[1].disabled = v >= hi; onChange && onChange(v, s); };
    st.forEach(b => b.onclick = () => { set(+inp.value + +b.dataset.d * by); Sound.sfx('tap'); });
    s.tabIndex = 0; s.onkeydown = e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); set(+inp.value + (e.key === 'ArrowUp' ? by : -by)); } };
    set(+inp.value);
  });
}
function ask(title, html, okLabel = '확인', cls = 'primary') {
  return new Promise(res => {
    openSheet(`<h3>${esc(title)}</h3>${html}<div class="row askr" style="margin-top:12px"><button class="${cls}" data-ok>${okLabel}</button><button data-close>취소</button></div>`, el => {
      bindSteps(el);
      el.querySelector('[data-ok]').onclick = () => { const f = {}; el.querySelectorAll('[name]').forEach(x => { if ((x.type === 'checkbox' || x.type === 'radio') && !x.checked) return; f[x.name] = x.value; }); closeSheet(); setTimeout(() => res(f), 30); };
      el.querySelector('[data-close]').addEventListener('click', () => res(null));
    });
  });
}

// ---------- 화면 이동 ----------
const NAV = [['#lobby', 'battle', '대전'], ['#decks', 'deck', '덱'], ['#record', 'trophy', '전적'], ['#settings', 'gear', '설정']];
function nav(cur) { $('#nav').innerHTML = ME ? NAV.map(([h, ic, l]) => `<a href="${h}" class="${cur === h ? 'on' : ''}" aria-label="${l}">${ICON[ic]}<span class="lb">${l}</span></a>`).join('') : ''; drawSnd(); drawThm(); drawInst(); }
// 화면 밝기: 일반(기본) / 다크. 기기 설정은 따르지 않고 이 기기에 저장
const THEME = { get() { try { return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } }, set(t) { try { localStorage.setItem('theme', t); } catch {} applyTheme(t); } };
function applyTheme(t = THEME.get()) {
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=color-scheme]'); if (m) m.content = 'only ' + t;
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = t === 'dark' ? '#0f1926' : '#f6efe3';
  drawThm(); document.querySelectorAll('[data-thm]').forEach(b => b.setAttribute('aria-pressed', b.dataset.thm === t));
}
function drawThm() {
  const b = $('#thm'); if (!b) return;
  const d = THEME.get() === 'dark';
  b.hidden = false; b.innerHTML = d ? ICON.sun : ICON.moon;
  b.setAttribute('aria-label', d ? '일반 모드로 바꾸기' : '다크 모드로 바꾸기'); b.title = d ? '일반 모드' : '다크 모드';
  b.onclick = () => THEME.set(d ? 'light' : 'dark');
}
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
  if (GUARD) { clearTimeout(GUARD.t); GUARD = null; } SUBVIEW = null; navCount++;
  if (!ME) { try { await loadMe(); } catch { ME = null; } }
  else if (Date.now() - meAt > 60000) loadMe().catch(() => {}); // 관리자가 바꾼 모임 기본값을 가끔 다시 받아 옴
  const h = location.hash || '#lobby';
  if (!ME && h !== '#login') { location.hash = '#login'; return; }
  const [base, arg] = h.split('/');
  armFs(base);
  document.body.classList.toggle('nohdr', base === '#game' || base === '#replay'); document.body.classList.remove('deckedit'); // 맨 위 머리줄은 대전·리플레이 말고 모두. 덱 고치기는 폰에서만 숨김 (deckEditor)
  nav(base === '#me' || base === '#members' ? '#settings' : base);
  Sound.music(base === '#game' ? 'battle' : 'lobby');
  if (base === '#login') return renderLogin();
  if (ME.must) return renderPwForce(); // 관리자가 비밀번호를 초기화한 뒤 처음: 새 비밀번호부터
  if (base === '#lobby') return renderLobby();
  if (base === '#decks') return renderDecks(arg);
  if (base === '#game') return renderGame(arg);
  if (base === '#replay') return renderReplay(arg, +(h.split('/')[2] || -1));
  if (base === '#me' || base === '#settings') return renderSettings();
  if (base === '#record') return renderRecord();
  if (base === '#members') return renderMembers();
  location.hash = '#lobby';
}
window.addEventListener('hashchange', route);
const go = h => { if (location.hash === h) route(); else location.hash = h; };

// ---------- 폰에서 주소창 줄이기: 홈 화면에 추가(앱처럼 열림), 안드로이드는 대전판에서 전체 화면 ----------
// 브라우저는 사람이 누르기 전에는 전체 화면을 막아 두고, 아이폰 사파리는 웹페이지 전체 화면을 아예 막아 둠 → 아이폰은 홈 화면에 추가를 안내
const UA = navigator.userAgent;
const IS_IOS = /iPhone|iPod|iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const IS_KAKAO = /KAKAOTALK/i.test(UA), IS_SAMSUNG = /SamsungBrowser/i.test(UA);
const isPhone = () => (IS_IOS || /Android|iPhone|iPod|Mobile/i.test(UA)) && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820; // 폰·태블릿만 (터치 모니터 PC는 아님)
const isApp = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: minimal-ui)').matches || (matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement); // 전체 화면 버튼으로 바꾼 것은 앱이 아님
const fsOk = () => !!(document.fullscreenEnabled && document.documentElement.requestFullscreen) && isPhone(); // 전체 화면은 폰에서만 (PC는 이미 넓어서 쓰지 않음)
const inFs = () => !!document.fullscreenElement;
const fsAuto = () => pref('fsAuto', 'on') === 'on';
let installEvt = null, fsArm = false;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.querySelectorAll('[data-a2hs]').forEach(b => b.innerHTML = `${ICON.homeAdd}설치하기`); drawInst(); });
window.addEventListener('appinstalled', () => { installEvt = null; setPref('a2hs', 'done'); drawInst(); });
const fsEnter = () => document.documentElement.requestFullscreen({ navigationUI: 'hide' });
function toggleFs() { if (inFs()) document.exitFullscreen().catch(() => {}); else fsEnter().catch(() => toast('이 브라우저는 전체 화면을 허락하지 않아요. 홈 화면에 추가해 보세요.')); }
// 대전판·리플레이에 들어온 뒤 처음 누를 때 전체 화면. 스스로 빠져나오면 다음에 판에 들어올 때까지 다시 바꾸지 않음
function armFs(base) { fsArm = (base === '#game' || base === '#replay') && fsAuto() && fsOk() && isPhone() && !isApp() && !inFs(); }
document.addEventListener('pointerup', () => { if (fsArm) { fsArm = false; if (!inFs()) fsEnter().catch(() => {}); } }, true);
function drawInst() { // 머리 줄의 '앱 설치' 단추 (폰이거나 브라우저가 설치를 허락할 때, 앱으로 열었거나 숨기면 없음)
  const b = $('#inst'); if (!b) return;
  const show = !!ME && !isApp() && (installEvt || isPhone()) && !pref('a2hs', '');
  b.hidden = !show; if (!show) return;
  b.innerHTML = `${ICON.homeAdd}<span class="lb">앱 설치</span>`; b.onclick = openA2hs;
}
function bindA2hs(root) {
  root.querySelectorAll('[data-a2hs]').forEach(b => b.onclick = openA2hs);
  root.querySelectorAll('[data-a2hs-x]').forEach(b => b.onclick = () => { setPref('a2hs', 'hide'); drawInst(); closeSheet(); toast('설정 → 폰 화면에서 언제든 다시 볼 수 있어요.'); });
  root.querySelectorAll('[data-a2hs-on]').forEach(b => b.onclick = () => { setPref('a2hs', ''); drawInst(); closeSheet(); });
}
async function openA2hs() {
  if (installEvt) { // 안드로이드 크롬: 브라우저의 설치 창을 바로 띄움
    const e = installEvt; installEvt = null; e.prompt();
    const r = await e.userChoice.catch(() => null);
    if (r && r.outcome === 'accepted') { setPref('a2hs', 'done'); drawInst(); toast('홈 화면의 닌포케카 아이콘으로 열어 주세요.'); }
    return;
  }
  const st = (ic, t) => `<li><i class="a2ic">${ic}</i><span>${t}</span></li>`, dots = '<b class="a2dots">⋮</b>';
  const open3 = st(`<img src="/icons/icon-192.png" alt="">`, '홈 화면에 생긴 <b>닌포케카</b> 아이콘으로 열어요.');
  const steps = IS_KAKAO ? [st(IS_IOS ? ICON.share : dots, `카카오톡 화면 ${IS_IOS ? '오른쪽 아래 <b>공유</b>' : '오른쪽 위 <b>⋮</b>'} 단추를 누르고 <b>다른 브라우저로 열기</b>를 골라요.`), st(ICON.homeAdd, '열린 브라우저에서 이 안내(설정 → 폰 화면)를 다시 열어 주세요.')]
    : IS_IOS ? [st(ICON.share, '화면 아래쪽(아이패드는 위쪽) <b>공유</b> 단추를 눌러요.'), st(ICON.homeAdd, '목록을 내려 <b>홈 화면에 추가</b>를 누르고, 오른쪽 위 <b>추가</b>를 눌러요.'), open3]
    : IS_SAMSUNG ? [st('<b class="a2dots">≡</b>', '화면 아래쪽 <b>≡</b> 메뉴를 눌러요.'), st(ICON.homeAdd, '<b>현재 페이지 추가</b> → <b>홈 화면</b>을 눌러요.'), open3]
    : [st(dots, '화면 오른쪽 위 <b>⋮</b> 메뉴를 눌러요.'), st(ICON.homeAdd, '<b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러요.'), open3];
  openSheet(`<button class="x sm" data-close>닫기</button><h3>주소창 없이 보기</h3>
    <p class="muted small" style="margin-top:0">홈 화면에 추가하면 주소창 없이 앱처럼 열려요. ${IS_IOS ? '아이폰은 맨 위 시계 줄만 남아요.' : '안드로이드는 맨 위 시계 줄까지 숨겨져요.'}</p>
    <ol class="a2steps">${steps.join('')}</ol>
    <p class="small muted" style="margin:0">홈 화면에서 처음 열 때 입장 코드를 한 번 더 넣어야 할 수도 있어요.</p>
    ${isApp() ? '' : `<div class="row" style="justify-content:center;margin-top:12px">${$('#inst') && !$('#inst').hidden ? '<button class="sm" data-a2hs-x>위쪽 \'앱 설치\' 단추 숨기기</button>' : pref('a2hs', '') === 'hide' ? '<button class="sm" data-a2hs-on>위쪽 \'앱 설치\' 단추 다시 보이기</button>' : ''}</div>`}`, el => bindA2hs(el));
}
// ---------- 푸시 알림 (비동기 판: 상대가 차례를 끝내거나 확인을 기다리면, 판이 끝나면) ----------
const PUSH = {
  why() { // 이 기기에서 못 쓰는 까닭 ('' = 쓸 수 있음)
    if (!window.isSecureContext) return 'http';
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !isApp() ? 'ios' : 'none';
    return '';
  },
  ok() { return !this.why(); },
  reg() { return navigator.serviceWorker.register('/sw.js'); },
  async sub() { if (!this.ok()) return null; const r = await navigator.serviceWorker.getRegistration('/'); return r ? r.pushManager.getSubscription() : null; },
  async state() { if (!this.ok()) return this.why(); if (Notification.permission === 'denied') return 'denied'; return (await this.sub()) && Notification.permission === 'granted' ? 'on' : 'off'; },
  async on() {
    const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error(perm === 'denied' ? '브라우저에서 알림을 막았어요. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔 주세요.' : '알림을 허용해야 켤 수 있어요.');
    const r = await this.reg(); await navigator.serviceWorker.ready;
    const { key } = await api('/api/push/key'), app = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((key.length + 3) % 4)), c => c.charCodeAt(0));
    let s = await r.pushManager.getSubscription();
    const same = s && s.options && s.options.applicationServerKey && new Uint8Array(s.options.applicationServerKey).join() === app.join();
    if (s && !same) { await s.unsubscribe().catch(() => {}); s = null; } // 서버 열쇠가 바뀌었으면 다시 구독
    if (!s) s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: app });
    await api('/api/push/sub', s.toJSON()); setPref('push', 'on'); return true;
  },
  async off() { const s = await this.sub(); if (s) { await api('/api/push/unsub', { endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe().catch(() => {}); } setPref('push', 'off'); },
  async sync() { // 켜 둔 기기는 들어올 때마다 서버에 다시 알려 줌 (서버 자료가 새로 시작돼도 이어지게)
    if (!this.ok()) return; navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (Notification.permission === 'granted' && pref('push') === 'on') this.on().catch(() => {});
  },
};
const PUSH_WHY = { http: '알림은 https 주소에서만 켤 수 있어요. 지금처럼 집 와이파이 주소(http://192…)로 들어오면 브라우저가 알림을 막아요. PC에서 localhost 주소로 들어오거나, 사이트를 인터넷 주소로 올리면 폰에서도 켤 수 있어요.',
  ios: '아이폰·아이패드는 사파리 공유 단추 → ‘홈 화면에 추가’로 설치한 앱에서 켤 수 있어요 (iOS 16.4 이상).', none: '이 브라우저는 알림을 지원하지 않아요.',
  denied: '브라우저에서 이 사이트 알림을 막아 두었어요. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 다시 켜 주세요.' };
function notifHtml() {
  return `<section class="set" id="notifset"><h3>알림</h3><div class="snd">
    <div class="r"><span class="nm">내 차례 알림</span><button class="sw" data-push aria-label="내 차례 알림 켜고 끄기"></button><button class="sm" data-pushtest>${ICON.bell}알림 시험</button></div>
    <p class="small muted pushmsg" style="margin:0">비동기 판에서 상대가 차례를 끝내거나 확인을 기다릴 때, 판이 끝났을 때 알려 드려요. 관전하는 판은 관전 카드나 관전 화면의 ‘알림 받기’를 켜면 두 사람이 차례를 끝낼 때마다 와요. 판을 보고 있을 때는 오지 않아요. 이 설정은 이 기기에만 적용돼요.</p></div></section>`;
}
async function bindNotif(root) {
  const sec = root.querySelector('#notifset'); if (!sec) return;
  const sw = sec.querySelector('[data-push]'), tb = sec.querySelector('[data-pushtest]'), msg = sec.querySelector('.pushmsg'), base = msg.textContent;
  const show = async () => { const st = await PUSH.state().catch(() => 'none'), on = st === 'on', bad = PUSH_WHY[st];
    sw.classList.toggle('on', on); sw.setAttribute('aria-pressed', on); sw.disabled = !!bad && st !== 'denied'; tb.disabled = !on; msg.textContent = bad || base; msg.classList.toggle('warnmsg', !!bad); };
  sw.onclick = async () => { sw.disabled = true; try { if (sw.classList.contains('on')) { await PUSH.off(); toast('알림을 껐어요.'); } else { await PUSH.on(); toast('알림을 켰어요.'); } } catch (e) { toast(e.message); } sw.disabled = false; show(); };
  tb.onclick = async () => { try { const r = await api('/api/push/test', {}); toast(r.ok ? '시험 알림을 보냈어요. 곧 떠요.' : r.sent ? '보내지 못했어요. 알림을 껐다가 다시 켜 주세요.' : '이 기기가 아직 등록되지 않았어요. 알림을 다시 켜 주세요.'); } catch (e) { toast(e.message); } };
  show();
}
async function setFollow(roomId, on) { // 관전판 알림 받기: 켜려면 이 기기 알림이 먼저 켜져 있어야 함
  if (on) {
    const st = await PUSH.state().catch(() => 'none');
    if (st !== 'on') {
      if (PUSH_WHY[st] && st !== 'denied') { await ask('이 기기에서는 알림을 켤 수 없어요', `<p>${PUSH_WHY[st]}</p>`, '알겠어요'); return null; }
      try { await PUSH.on(); } catch (e) { toast(e.message, 3600); return null; }
    }
  }
  try { const r = await api(`/api/rooms/${roomId}/follow`, { on: !!on }); toast(r.follow ? '이 판 알림을 켰어요. 두 사람이 차례를 끝낼 때마다 알려 드려요.' : '이 판 알림을 껐어요.', 3000); return r.follow; }
  catch (e) { toast(e.message); return null; }
}
async function pushOffer() { // 비동기 판을 만들거나 들어갈 때 한 번만 물어봄
  if (!PUSH.ok() || Notification.permission !== 'default' || pref('pushAsked')) return;
  setPref('pushAsked', '1');
  const ok = await ask('내 차례가 오면 알려 드릴까요?', '<p>상대가 차례를 끝내거나 확인을 기다리면 폰·PC 알림으로 알려 드려요. 설정 → 알림에서 언제든 끌 수 있어요.</p>', '알림 켜기');
  if (ok) PUSH.on().then(() => toast('알림을 켰어요.'), e => toast(e.message));
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.t === 'go' && e.data.url) location.href = e.data.url; });
function screenHtml() { // 설정 → 화면 (밝기 + 폰 화면)
  const t = THEME.get(), rows = [`<div class="r"><span class="nm">화면 밝기</span><div class="thmseg" role="group" aria-label="화면 밝기"><button class="sm" data-thm="light" aria-pressed="${t === 'light'}">${ICON.sun}일반</button><button class="sm" data-thm="dark" aria-pressed="${t === 'dark'}">${ICON.moon}다크</button></div></div>`];
  if (fsOk()) rows.push(`<div class="r"><span class="nm">전체 화면</span><button class="sw" data-fsauto aria-label="대전판에 들어가면 전체 화면으로"></button><button class="sm" data-fsnow>${inFs() ? `${ICON.shrink}전체 화면 끝내기` : `${ICON.expand}지금 전체 화면`}</button></div>`);
  rows.push(`<div class="r"><span class="nm">홈 화면 추가</span>${isApp() ? '<span class="small muted">지금 앱으로 열려 있어요</span>' : `<button class="sm" data-a2hs>${ICON.homeAdd}${installEvt ? '설치하기' : '방법 보기'}</button>`}</div>`);
  return `<section class="set"><h3>화면</h3><div class="snd">${rows.join('')}
    <p class="small muted" style="margin:0">홈 화면에 추가하면 주소창 없이 앱처럼 열려요.${fsOk() ? ' 전체 화면을 켜 두면 폰에서 대전판에 들어가 처음 누를 때 주소창이 사라져요(아이폰 사파리는 지원하지 않아요).' : ''} 이 설정은 이 기기에만 저장돼요.</p></div></section>`;
}
document.addEventListener('fullscreenchange', () => document.querySelectorAll('[data-fsnow]').forEach(b => b.innerHTML = inFs() ? `${ICON.shrink}전체 화면 끝내기` : `${ICON.expand}지금 전체 화면`));

let loginTab = 'in', loginName = '';
function renderLogin(note) { // 로그인: 닉네임 + 비밀번호. 처음 왔어요: + 비밀번호 한 번 더 + 모임 입장 코드 (한 번만)
  const up = loginTab === 'up';
  app.innerHTML = `<div class="card-box hero login">
    <div class="logo">${ringIcon('bolt', '', true)}<div><h2>닌포케카</h2><div class="muted small">닌도란 포켓몬 카드 게임 · NPCG</div></div></div>
    <div class="lgtabs" role="tablist"><button type="button" class="ltab${up ? '' : ' on'}" data-lt="in" role="tab" aria-selected="${!up}">${ICON.key}로그인</button><button type="button" class="ltab${up ? ' on' : ''}" data-lt="up" role="tab" aria-selected="${up}">${ICON.user}처음 왔어요</button></div>
    <form id="lf" novalidate>
      ${note ? `<p class="lnote">${esc(note)}</p>` : `<p class="muted small lhelp">${up ? '모임에서 받은 입장 코드는 가입할 때 한 번만 넣어요. 다음부터는 닉네임과 비밀번호로 들어와요.' : '닉네임과 비밀번호로 들어와요.'}</p>`}
      <label class="h" for="nm">닉네임</label><input id="nm" name="username" maxlength="12" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(loginName)}">
      <label class="h" for="pw">비밀번호${up ? ' <span class="hint">4자 이상</span>' : ''}</label>
      <div class="pwrow"><input id="pw" name="password" type="password" maxlength="64" autocomplete="${up ? 'new-password' : 'current-password'}"><button type="button" class="pwsee" data-see aria-label="비밀번호 보기" aria-pressed="false">${ICON.eye}</button></div>
      ${up ? `<label class="h" for="pw2">비밀번호 한 번 더</label><input id="pw2" type="password" maxlength="64" autocomplete="new-password">
      <label class="h" for="cd">모임 입장 코드</label><input id="cd" type="password" autocomplete="off">` : ''}
      <button class="primary" id="go" type="submit">${up ? '가입하고 들어가기' : '들어가기'}</button>
    </form>
    <p class="small muted lfoot">${up ? '예전에 쓰던 닉네임이 있으면 그 닉네임과 새 비밀번호, 입장 코드를 넣어 주세요. 대전 기록과 덱이 그대로 이어져요.' : '비밀번호를 잊었으면 관리자에게 초기화를 부탁해 주세요.'}</p></div>`;
  const nm = $('#nm'), pw = $('#pw');
  app.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { if (b.dataset.lt === loginTab) return; loginName = nm.value; loginTab = b.dataset.lt; renderLogin(); Sound.sfx('tap'); });
  app.querySelector('[data-see]').onclick = e => { const b = e.currentTarget, on = pw.type === 'password'; app.querySelectorAll('#pw, #pw2').forEach(x => x.type = on ? 'text' : 'password'); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); };
  (nm.value ? pw : nm).focus({ preventScroll: true });
  $('#lf').onsubmit = async e => {
    e.preventDefault(); loginName = nm.value.trim();
    if (!loginName) return toast('닉네임을 넣어 주세요.');
    if (!pw.value) return toast('비밀번호를 넣어 주세요.');
    if (up && pw.value.length < 4) return toast('비밀번호는 4자 이상으로 정해 주세요.');
    if (up && pw.value !== $('#pw2').value) return toast('비밀번호가 서로 달라요. 한 번 더 넣어 주세요.');
    if (up && !$('#cd').value) return toast('모임 입장 코드를 넣어 주세요.');
    const go = $('#go'); go.disabled = true;
    try {
      const r = await api(up ? '/api/signup' : '/api/login', up ? { name: loginName, pw: pw.value, code: $('#cd').value } : { name: loginName, pw: pw.value });
      ME = r.user; await loadMe().catch(() => {}); loginTab = 'in'; location.hash = '#lobby';
    } catch (er) {
      go.disabled = false;
      if (!up && er.data && (er.data.need === 'claim' || er.data.need === 'signup')) { loginTab = 'up'; return renderLogin(er.message); } // 비밀번호가 없는 예전 닉네임 / 없는 닉네임 → 가입 칸으로
      toast(er.message, 3200);
    }
  };
}
// 비밀번호 바꾸기: 설정에서 (지금 비밀번호 필요) / 관리자가 초기화한 뒤 처음 들어왔을 때 (바로 새 비밀번호)
const pwFormHtml = force => `${force ? '' : '<label class="h" for="pwo">지금 비밀번호</label><input id="pwo" type="password" maxlength="64" autocomplete="current-password">'}
  <label class="h" for="pwn">새 비밀번호 <span class="hint">4자 이상</span></label><input id="pwn" type="password" maxlength="64" autocomplete="new-password">
  <label class="h" for="pwn2">새 비밀번호 한 번 더</label><input id="pwn2" type="password" maxlength="64" autocomplete="new-password">`;
async function savePw(root) {
  const o = root.querySelector('#pwo')?.value || '', n = root.querySelector('#pwn').value, n2 = root.querySelector('#pwn2').value;
  if (n.length < 4) throw new Error('새 비밀번호는 4자 이상으로 정해 주세요.');
  if (n !== n2) throw new Error('새 비밀번호가 서로 달라요. 한 번 더 넣어 주세요.');
  await api('/api/password', { old: o, pw: n });
}
function renderPwForce() {
  app.innerHTML = `<div class="card-box hero login"><div class="logo">${ringIcon('key', '', true)}<div><h2>새 비밀번호 정하기</h2><div class="muted small">${esc(ME.name)} 님</div></div></div>
    <p class="lnote">관리자가 비밀번호를 초기화했어요. 앞으로 쓸 새 비밀번호를 정해 주세요.</p>
    <form id="pf" novalidate>${pwFormHtml(true)}<button class="primary" type="submit">저장하고 들어가기</button></form>
    <p class="small muted lfoot"><button type="button" class="linkbtn" id="lo2">다른 닉네임으로 들어가기</button></p></div>`;
  $('#pwn').focus({ preventScroll: true });
  $('#pf').onsubmit = async e => { e.preventDefault(); try { await savePw(app); ME.must = false; toast('새 비밀번호로 바꿨어요.'); location.hash = '#lobby'; route(); } catch (er) { toast(er.message, 3200); } };
  $('#lo2').onclick = async () => { await api('/api/logout', {}).catch(() => {}); ME = null; location.hash = '#login'; };
}
function openPwSheet() {
  openSheet(`<button class="x sm" data-close>닫기</button><h3>${ICON.key}비밀번호 바꾸기</h3><form class="pwf" novalidate>${pwFormHtml(false)}
    <p class="small muted">바꾸면 이 기기는 그대로이고, 다른 기기에서는 다시 로그인해야 해요.</p>
    <div class="row askr"><button class="primary" type="submit">바꾸기</button><button type="button" data-close>취소</button></div></form>`, el => {
    el.querySelector('#pwo').focus({ preventScroll: true });
    el.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await savePw(el); closeSheet(); toast('비밀번호를 바꿨어요.'); } catch (er) { toast(er.message, 3200); } };
  });
}
// ---------- 목록 화면 깜빡임 없이: 받아 둔 자료로 바로 그리고, 새 자료가 다를 때만 다시 그림 ----------
const VIEW = {};
async function viewData(key, load, draw, { hash = location.hash || '#lobby', drawn = false } = {}) {
  const old = VIEW[key]; let shown = drawn;
  if (old && !drawn) { draw(old.v); shown = true; }
  const slow = old ? 0 : setTimeout(() => { if (!shown && (location.hash || '#lobby') === hash) app.innerHTML = '<div class="loadwait"><div class="spin-ball"></div></div>'; }, 600); // 아주 늦을 때만 작게
  try {
    const v = await load(), sv = JSON.stringify(v); clearTimeout(slow);
    if ((location.hash || '#lobby') !== hash) { VIEW[key] = { v, s: sv }; return; }
    if (!old || old.s !== sv) { VIEW[key] = { v, s: sv }; if (old) keepScroll(() => draw(v)); else draw(v); }
  } catch (e) { clearTimeout(slow); if (!shown) app.innerHTML = `<p class="pad">${esc(e.message)}</p>`; }
}
function keepScroll(fn) { const y = scrollY; fn(); if (scrollY !== y) scrollTo(0, y); }
// ---------- 전적 (내 승패, 상대별, 최근 판) ----------
const fmtDay = t => { if (!t) return '—'; const d = new Date(t); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('ko-KR', { year: d.getFullYear() === new Date().getFullYear() ? undefined : '2-digit', month: 'numeric', day: 'numeric' }); };
const fmtFull = t => t ? new Date(t).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const fmtAgo = t => { if (!t) return '—'; const s = (Date.now() - t) / 1000; return s < 90 ? '방금' : s < 3600 ? `${Math.round(s / 60)}분 전` : s < 86400 ? `${Math.round(s / 3600)}시간 전` : s < 86400 * 30 ? `${Math.round(s / 86400)}일 전` : new Date(t).toLocaleDateString('ko-KR'); };
const wld = o => `<em class="w">${o.w}승</em><em class="l">${o.l}패</em>${o.d ? `<em class="d">${o.d}무</em>` : ''}`;
function renderRecord() { return viewData('record', () => api('/api/stats'), drawRecord); }
function drawRecord(s) {
  const T = s.total, n = T.w + T.l + T.d, rate = T.w + T.l ? Math.round(T.w * 100 / (T.w + T.l)) : null;
  const tile = (k, ic, l, v) => `<div class="rtile ${k}">${ringIcon(ic, 'k-' + k)}<span class="rl">${l}</span><b class="rv">${v}</b></div>`;
  const resChip = r => r === 'w' ? '<span class="chip ok">이김</span>' : r === 'l' ? '<span class="chip lose">짐</span>' : '<span class="chip">승부 없음</span>';
  const opp = s.opps.map(o => { const g = o.w + o.l, pct = g ? Math.round(o.w / g * 100) : 0;
    return `<div class="orow"><b class="onm">${esc(o.name)}</b><span class="owl">${wld(o)}</span><span class="obar" role="img" aria-label="이긴 비율 ${pct}%"><i style="width:${pct}%"></i></span><span class="opct">${g ? pct + '%' : '—'}</span></div>`; }).join('');
  const rec = s.recent.map(g => `<div class="grec">${resChip(g.res)}<div class="gmid"><b class="gopp">${esc(g.opp)} 님</b><span class="small muted">${fmtDay(g.ended)}${g.title ? ` · ${esc(g.title)}` : ''}${g.turns ? ` · ${g.turns}번째 차례` : ''}${g.how ? ` · ${esc(g.how)}` : ''}</span></div><a class="btn sm" href="#replay/${esc(g.gid)}" aria-label="${esc(g.opp)} 님과의 판 리플레이">${ICON.rewind}<span>리플레이</span></a></div>`).join('');
  app.innerHTML = `<div class="card-box recbox"><div class="rech"><h2>내 전적</h2><span class="small muted">${esc(ME.name)} 님</span>${SK.admin ? `<a class="btn sm" href="#members">${ICON.users}회원 관리</a>` : ''}</div>
    <div class="rtiles">${tile('n', 'battle', '끝난 판', n)}${tile('w', 'trophy', '이김', T.w)}${tile('l', 'x', '짐', T.l)}${tile('r', 'bolt', '승률', rate == null ? '—' : rate + '%')}</div>
    <section class="set"><h3>상대별 전적</h3>${opp ? `<div class="olist">${opp}</div>` : '<p class="muted small">아직 끝난 판이 없어요. 판이 끝나면 상대별로 쌓여요.</p>'}</section>
    <section class="set"><h3>최근 대전</h3>${rec ? `<div class="glist">${rec}</div>` : '<p class="muted small">끝난 판이 여기에 쌓여요.</p>'}${T.d ? '<p class="small muted">승부 없음: 관리자가 끝낸 판이에요. 승률에는 넣지 않아요.</p>' : ''}</section></div>`;
}
// ---------- 회원 관리 (관리자): 가입일, 마지막 접속, 로그인 기록, 비밀번호 초기화 ----------
function renderMembers() {
  if (!SK.admin) { location.hash = '#settings'; return; }
  return viewData('members', () => api('/api/admin/users'), drawMembers);
}
function drawMembers(d) {
  const us = d.users.slice().sort((a, b) => (b.seen || 0) - (a.seen || 0) || a.created - b.created);
  const pwChip = p => p === 'temp' ? '<span class="chip warn">임시 비밀번호</span>' : p === 'none' ? '<span class="chip">비밀번호 없음</span>' : '';
  const row = u => `<div class="mrow" data-u="${esc(u.uid)}" role="button" tabindex="0" aria-label="${esc(u.name)} 자세히">
    <div class="mtop">${u.seen && Date.now() - u.seen < 5 * 60e3 ? '<i class="mon" title="지금 접속 중"></i>' : ''}<b class="mnm">${esc(u.name)}</b>${u.admin ? '<span class="chip k-admin">관리자</span>' : ''}${u.uid === d.me ? '<span class="chip">나</span>' : ''}${pwChip(u.pw)}</div>
    <div class="mgrid"><span><em>가입</em>${fmtDay(u.created)}</span><span><em>마지막 접속</em>${fmtAgo(u.seen)}</span><span><em>로그인</em>${u.nlog}번${u.logins[0] ? ` · ${esc(u.logins[0].dev)}` : ''}</span><span><em>전적</em>${u.w}승 ${u.l}패${u.d ? ` ${u.d}무` : ''}</span></div></div>`;
  app.innerHTML = `<div class="card-box membox"><div class="rech"><h2>회원 관리</h2><span class="chip k-admin">관리자</span><a class="btn sm" href="#settings">${ICON.gear}설정으로</a></div>
    <p class="muted small" style="margin-top:0">모두 ${us.length}명 · 최근에 들어온 순서예요. 줄을 누르면 로그인 기록과 비밀번호 초기화가 나와요.</p>
    <div class="mlist">${us.map(row).join('')}</div></div>`;
  app.querySelectorAll('[data-u]').forEach(el => { const u = us.find(x => x.uid === el.dataset.u); el.onclick = () => openMember(u); el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMember(u); } }; });
}
function openMember(u) {
  const pwTxt = u.pw === 'set' ? '정해 둠' : u.pw === 'temp' ? '임시 비밀번호 (아직 안 바꿈)' : '없음 (예전 닉네임)';
  openSheet(`<button class="x sm" data-close>닫기</button><h3>${esc(u.name)}${u.admin ? ' <span class="chip k-admin">관리자</span>' : ''}</h3>
    <div class="mdet"><div><em>가입한 날</em><span>${fmtFull(u.created)}</span></div><div><em>마지막 접속</em><span>${fmtFull(u.seen)}${u.seen ? ` · ${fmtAgo(u.seen)}` : ''}</span></div>
      <div><em>마지막 로그인</em><span>${fmtFull(u.last)}</span></div><div><em>로그인 횟수</em><span>${u.nlog}번</span></div>
      <div><em>전적</em><span>${u.w}승 ${u.l}패${u.d ? ` ${u.d}무` : ''}</span></div><div><em>비밀번호</em><span>${pwTxt}</span></div></div>
    <h4>최근 로그인</h4>${u.logins.length ? `<div class="mlog">${u.logins.map(l => `<div><span>${fmtFull(l.t)}</span><span class="muted">${esc(l.dev)}</span></div>`).join('')}</div>` : '<p class="small muted">기록이 없어요.</p>'}
    <div class="row askr" style="margin-top:14px"><button class="bad" data-reset>${ICON.key}비밀번호 초기화</button></div>
    <p class="small muted">초기화하면 임시 비밀번호가 나와요. 그 사람에게 알려 주면 들어올 때 새 비밀번호를 정하게 돼요. 그 사람이 로그인해 둔 기기는 모두 로그아웃돼요.</p>`, el => {
    el.querySelector('[data-reset]').onclick = async () => {
      if (!await ask(`${u.name} 님 비밀번호를 초기화할까요?`, '<p>지금 비밀번호는 더 쓸 수 없고, 임시 비밀번호가 새로 나와요.</p>', '초기화', 'bad')) return;
      let r; try { r = await api(`/api/admin/users/${u.uid}/reset`, {}); } catch (e) { return toast(e.message); }
      openSheet(`<button class="x sm" data-close>닫기</button><h3>${ICON.key}임시 비밀번호</h3><p>${esc(r.name)} 님에게 알려 주세요.</p>
        <div class="tmpw"><code>${esc(r.temp)}</code><button class="sm" data-cp>${ICON.copy}복사</button></div>
        <p class="small muted">이 비밀번호로 들어오면 바로 새 비밀번호를 정하게 돼요. 이 창을 닫으면 다시 볼 수 없어요(다시 초기화하면 새로 나와요).</p>`, e2 => {
        e2.querySelector('[data-cp]').onclick = () => navigator.clipboard.writeText(r.temp).then(() => toast('복사했어요.'), () => toast('복사하지 못했어요. 글자를 보고 적어 주세요.'));
      });
      if (location.hash === '#members') renderMembers();
    };
  });
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
  // 내 것: 기본 7종 + 내 사진 = 8칸 (4×2). '모임 기본' 칸은 없앰 (아무것도 안 고른 사람은 관리자가 정한 모양 = 그 칸이 켜져 보임)
  const mine = (kind, title) => {
    const list = kind === 'back' ? BACKS : MATS, my = SK.imgs?.[kind];
    return `<section class="set"><h3>${title}</h3><div class="opts n8">
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
    ${SK.admin ? dispHtml(false) : ''}
    <section class="set"><h3>소리</h3><div class="snd">
      <div class="r"><span class="nm">효과음</span><button class="sw" data-sw="sfx" aria-label="효과음 켜고 끄기"></button><input type="range" min="0" max="100" value="${vol('sfxVol')}" style="--v:${vol('sfxVol')}%" data-vol="sfxVol" aria-label="효과음 크기"><button class="sm" data-try>${ICON.play}들어 보기</button></div>
      <div class="r"><span class="nm">배경음악</span><button class="sw" data-sw="bgm" aria-label="배경음악 켜고 끄기"></button><input type="range" min="0" max="100" value="${vol('bgmVol')}" style="--v:${vol('bgmVol')}%" data-vol="bgmVol" aria-label="배경음악 크기"></div>
      <p class="small muted" style="margin:0">효과음과 배경음악은 모두 이 사이트에서 직접 만든 소리예요. 소리 설정은 이 기기에만 저장돼요.</p></div></section>
    ${notifHtml()}
    ${screenHtml()}
    ${!inSheet && SK.admin ? `<section class="set admin"><h3>모임 기본값 <span class="chip k-admin">관리자</span></h3>
      <p class="small muted">처음 들어온 사람과 '모임 기본'을 고른 사람에게 보이는 모양이에요. 각자 다른 것을 고른 사람은 그대로예요.</p>
      ${admin('back', '카드 뒷면')}${admin('mat', '매트')}
      ${dispHtml(true)}</section>` : ''}
    ${inSheet ? '' : `<section class="set"><h3>내 정보</h3><div class="row meinfo"><span class="grow">${esc(ME.name)} 님으로 들어와 있어요.</span><button class="sm" data-pw>${ICON.key}비밀번호 바꾸기</button><button class="sm" id="lo">로그아웃</button></div>
      ${SK.admin ? `<div class="row meinfo adm"><a class="btn sm" href="#members">${ICON.users}회원 관리</a><span class="small muted grow">가입일·마지막 접속·로그인 기록 보기, 비밀번호 초기화 <span class="chip k-admin">관리자</span></span></div>` : ''}</section>`}`;
}
// 카드 표시: 빠른 설정(모임 기본·추천·카드만·영어로만·한글판만) + 항목별로 고르기. admin = 모임 기본값 고르기
function dispHtml(admin) {
  const cur = admin ? groupDisp() : D, g = groupDisp(), mineOn = !admin && SK.prefs?.disp === 'mine';
  const pre = DISP_PRESETS.find(x => sameDisp(x.v, cur));
  const nowName = pre ? pre.l : '직접 고름', rows = DISP_PRESETS; // '모임 기본 따르기'는 없앰
  const on = r => pre && pre.k === r.k;
  return `${admin ? '<h4>카드 표시</h4>' : `<section class="set disp"><h3>카드 표시 <span class="chip">${esc(nowName)}</span><span class="chip k-admin">관리자만 보여요</span></h3>`}
    <div class="seg dpre">${rows.map(r => `<button class="opt ${r.k === 'group' ? 'wide' : ''} ${on(r) ? 'on' : ''}" aria-pressed="${!!on(r)}" data-dpre="${r.k}" data-scope="${admin ? 'group' : 'me'}"><span>${esc(r.l)}<small class="sub">${esc(r.d)}</small></span></button>`).join('')}</div>
    ${[['판과 카드 정보', ['dimg', 'dtext', 'ddet']], ['덱 만들기', ['dinfo', 'dsize']]].map(([gt, ks]) => `<div class="dgh">${esc(gt)}</div><div class="dopts n${ks.length}">${DISP_OPTS.filter(o => ks.includes(o.k)).map(o => `<div class="dopt"><h5 id="do-${admin ? 'g' : 'm'}-${o.k}">${esc(o.t)}</h5>${o.d && !admin ? `<p class="small muted">${esc(o.d)}</p>` : ''}<div class="seg2 n${o.o.length}" role="group" aria-labelledby="do-${admin ? 'g' : 'm'}-${o.k}">${o.o.map(([v, l]) => `<button class="sm ${cur[o.k] === v ? 'on' : ''}" aria-pressed="${cur[o.k] === v}" data-dk="${o.k}" data-v="${v}" data-scope="${admin ? 'group' : 'me'}">${esc(l)}</button>`).join('')}</div></div>`).join('')}</div>`).join('')}
    ${admin ? '' : '</section>'}`;
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
  const own = k => { const v = SK.prefs?.[k] || 'group'; return v === 'group' ? groupSkin(k).preset || '' : v; }; // 안 고른 사람은 모임 기본값이 켜져 보임
  const curOf = { back: () => own('back'), mat: () => own('mat'), art: () => SK.prefs?.art || 'group',
    'g-back': () => SK.group?.back || SKIN_DEF.back, 'g-mat': () => SK.group?.mat || SKIN_DEF.mat, 'g-art': () => SK.group?.art || SKIN_DEF.art };
  const mark = () => {
    root.querySelectorAll('[data-set]').forEach(b => { const on = b.dataset.v === curOf[b.dataset.set](); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    root.querySelectorAll('[data-sw]').forEach(b => { const on = Sound.get(b.dataset.sw); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    root.querySelectorAll('[data-fsauto]').forEach(b => { const on = fsAuto(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
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
  // 카드 표시: 고르면 바로 적용하고 저장 (내 것은 disp=mine 으로 모든 항목을 함께 저장)
  const dispSave = (scope, vals) => {
    if (scope === 'group') { SK.group = { ...SK.group, ...vals }; applySkin(); onArt && onArt(); refresh(); return save('/api/group', vals); }
    SK.prefs = { back: 'group', mat: 'group', art: 'group', ...SK.prefs, ...vals }; applySkin(); onArt && onArt(); refresh(); return save('/api/prefs', vals);
  };
  root.querySelectorAll('[data-dpre]').forEach(b => b.onclick = () => {
    const k = b.dataset.dpre, sc = b.dataset.scope; Sound.sfx('place');
    if (k === 'group') return dispSave('me', { disp: 'group' });
    const v = DISP_PRESETS.find(x => x.k === k).v;
    dispSave(sc, sc === 'group' ? { ...v } : { disp: 'mine', ...v });
  });
  root.querySelectorAll('[data-dk]').forEach(b => b.onclick = () => {
    const sc = b.dataset.scope, k = b.dataset.dk, v = b.dataset.v; Sound.sfx('tap');
    dispSave(sc, sc === 'group' ? { [k]: v } : { disp: 'mine', ...D, [k]: v });
  });
  root.querySelectorAll('[data-up]').forEach(b => b.onclick = () => pickPhoto(b.dataset.up, b.dataset.scope));
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    try { const r = await fetch(`/api/img?kind=${b.dataset.del}&scope=${b.dataset.scope}`, { method: 'DELETE', credentials: 'same-origin' }); const j = await r.json(); if (!r.ok) throw new Error(j.error || '지우지 못했어요.'); setSkin(j); toast('사진을 지웠어요.'); }
    catch (e) { toast(e.message); }
    onArt && onArt(); refresh();
  });
  root.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { const k = b.dataset.sw; Sound.set(k, !Sound.get(k)); mark(); if (k === 'sfx') Sound.sfx('notify'); });
  root.querySelectorAll('[data-fsauto]').forEach(b => b.onclick = () => { setPref('fsAuto', fsAuto() ? 'off' : 'on'); mark(); Sound.sfx('tap'); });
  root.querySelectorAll('[data-fsnow]').forEach(b => b.onclick = toggleFs);
  bindA2hs(root); bindNotif(root);
  root.querySelectorAll('[data-vol]').forEach(r => { r.oninput = () => { Sound.set(r.dataset.vol, r.value / 100); r.style.setProperty('--v', r.value + '%'); }; r.onchange = () => { if (r.dataset.vol === 'sfxVol') Sound.sfx('coin'); }; });
  const tr = root.querySelector('[data-try]');
  if (tr) tr.onclick = () => ['draw', 'place', 'attack', 'coin', 'turnMine'].forEach((n, i) => setTimeout(() => Sound.sfx(n), i * 450));
  root.querySelectorAll('[data-pw]').forEach(b => b.onclick = openPwSheet);
  root.querySelectorAll('[data-thm]').forEach(b => b.onclick = () => THEME.set(b.dataset.thm));
  const lo = root.querySelector('#lo');
  if (lo) lo.onclick = async () => { await api('/api/logout', {}); ME = null; try { localStorage.removeItem('skin'); } catch {} setSkin({}); location.hash = '#login'; };
}
function renderSettings() {
  app.innerHTML = `<div class="card-box" style="max-width:860px;margin:0 auto"><h2>설정</h2><p class="muted small" style="margin-top:0">고르면 바로 바뀌어요. ${SK.admin ? '카드 뒷면·매트·카드 표시는' : '카드 뒷면과 매트는'} 내 계정에 저장돼서 다른 기기에서도 그대로예요.</p><div class="setwrap">${settingsHtml(false)}</div></div>`;
  bindSettings(app.querySelector('.setwrap'), null, false);
}
function openSettings(onArt) { openSheet(`<button class="x sm" data-close>닫기</button><h3>설정</h3><div class="setwrap">${settingsHtml(true)}</div>`, el => bindSettings(el.querySelector('.setwrap'), onArt, true)); }

// ---------- 로비 ----------
const fmtLeft = ms => { if (ms <= 0) return '기한 지남'; const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return h ? `${h}시간 ${m}분 남음` : m ? `${m}분 남음` : '1분 안 남음'; };
const modeKo = c => (c.mode === 'async' ? `비동기 · 결정마다 ${c.deadlineH}시간` : '실시간') + ` · ${c.bestOf === 3 ? '3판 2선승' : '1판'}` + (c.spectate === 'no' ? ' · 관전 끔' : '');
let lobbyTab = (() => { try { return localStorage.getItem('lobbyTab') || 'mine'; } catch { return 'mine'; } })();
function renderLobby() { return viewData('lobby', () => Promise.all([api('/api/rooms'), api('/api/decks')]), drawLobby); }
// 대전 화면은 가만히 있어도 맞게: 남은 시간 글자는 10초마다 다시 세고, 방 목록은 30초마다 조용히 받아 바뀐 것만 다시 그림.
// 탭으로 돌아오면 바로. 10분 넘게 손대지 않으면 목록 받기는 쉼 (무료 요청 수 아끼기, 차례 알림은 푸시로 옴)
function tickLeft() {
  const now = Date.now();
  document.querySelectorAll('[data-dl]').forEach(e => { const t = fmtLeft(+e.dataset.dl - now); if (e.textContent !== t) e.textContent = t; });
  document.querySelectorAll('[data-dls]').forEach(e => { const ms = +e.dataset.dls - now, t = fmtShort(ms); if (e.textContent !== t) e.textContent = t; e.title = fmtLeft(ms); });
}
let lastTouch = Date.now();
['pointerdown', 'keydown', 'wheel'].forEach(k => addEventListener(k, () => { lastTouch = Date.now(); }, { passive: true, capture: true }));
const onLobby = () => ME && (location.hash || '#lobby') === '#lobby' && document.visibilityState === 'visible';
const pollLobby = () => viewData('lobby', () => Promise.all([api('/api/rooms'), VIEW.lobby ? VIEW.lobby.v[1] : api('/api/decks')]), drawLobby, { drawn: true });
setInterval(tickLeft, 10000);
setInterval(() => { if (onLobby() && Date.now() - lastTouch < 600e3) pollLobby(); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') return; tickLeft(); if (onLobby()) { lastTouch = Date.now(); pollLobby(); } });
function drawLobby([data, decks]) {
  const rooms = data.rooms;
  const mine = rooms.filter(r => r.mine && r.status !== 'done'), open = rooms.filter(r => r.status === 'open' && !r.mine), watch = rooms.filter(r => !r.mine && r.status === 'playing'), done = rooms.filter(r => r.status === 'done' || r.status === 'between');
  const myTurnN = mine.filter(r => r.myTurn).length;
  document.title = (myTurnN ? `(${myTurnN}) ` : '') + '닌포케카';
  if (lobbyTab === 'new' || !['mine', 'open', 'watch', 'done'].includes(lobbyTab)) lobbyTab = 'mine';
  const tabs = [['mine', '내 대전', mine.length], ['open', '들어갈 방', open.length], ['watch', '관전', watch.length], ['done', '끝난 판', done.length]];
  // 방 하나 = 카드 한 장: 위 색 띠(상태) · 방 이름 · 두 사람 · 진행 방식 · 남은 시간 · 단추. 줄 위치는 모든 카드가 같음 (값이 없으면 —)
  const roomCard = r => {
    const last = r.games[r.games.length - 1];
    const st = r.status === 'open' ? ['open', 'door', '모집 중'] : r.myTurn ? ['turn', 'bolt', '내 차례'] : r.status === 'playing' ? (r.mine ? ['wait', 'wait', r.phase === 'setup' ? '준비 중' : `${r.turn || 0}번째 차례`] : ['watch', 'eye', r.phase === 'setup' ? '준비 중' : `${r.turn || 0}번째 차례`]) : ['done', 'trophy', r.status === 'between' ? '다음 판 기다림' : '끝남'];
    const nm = [0, 1].map(i => r.names[i] || '');
    const who = n => n ? `<span class="rp"><i class="av">${esc(n.slice(0, 1))}</i><b>${esc(n)}</b></span>` : '<span class="rp empty"><i class="av">?</i><b>기다리는 중</b></span>';
    const score = r.wins && (r.status === 'done' || r.status === 'between') ? `<span class="rsc">${r.wins.join(' : ')}</span>` : '<span class="rvs">vs</span>';
    const left = r.deadline && r.status === 'playing' ? `<span class="rleft">${ICON.wait}<span data-dl="${r.deadline}">${fmtLeft(r.deadline - Date.now())}</span></span>` : `<span class="rleft none">${r.cfg.invite ? `초대: ${esc(r.cfg.invite)}` : '—'}</span>`;
    let main = '';
    if (r.status === 'open' && !r.mine) main = `<button class="primary sm" data-join="${r.id}">${ICON.door}들어가기</button>`;
    else if (r.status === 'open' && r.host === data.me) main = `<button class="sm" data-close-room="${r.id}">${ICON.x}방 닫기</button>`;
    else if (r.status === 'between' && r.mine) main = `<button class="primary sm" data-next="${r.id}">${ICON.play}다음 판</button>`;
    else if (last && r.status === 'playing') main = `<a class="btn ${r.mine ? 'primary' : ''} sm" href="#game/${last}">${r.mine ? `${ICON.battle}판으로` : `${ICON.eye}관전`}</a>`;
    const rec = last && r.status !== 'open' ? `<a class="btn sm" href="#replay/${last}">${ICON.rewind}리플레이</a>` : '';
    const adm = SK.admin ? `<button class="radm" data-admin="${r.id}" aria-label="관리자: 판 끝내기·지우기">${ICON.gear}관리</button>` : '';
    const fol = !r.mine && r.status === 'playing' && r.cfg.spectate !== 'no' ? `<button class="rfol ${r.follow ? 'on' : ''}" data-follow="${r.id}" aria-pressed="${!!r.follow}" aria-label="이 판 알림 ${r.follow ? '끄기' : '받기'}">${ICON.bell}${r.follow ? '알림 켬' : '알림 받기'}</button>` : '';
    return `<article class="rcard s-${st[0]}"><div class="rtop">${ringIcon(st[1], 'k-' + st[0], r.myTurn)}<span class="rst">${st[2]}</span>${fol}${adm}</div>
      <h4 class="rt">${esc(r.cfg.title || nm.filter(Boolean).join(' vs '))}</h4>
      <div class="rvsrow">${who(nm[0])}${score}${who(nm[1])}</div>
      <div class="rmode">${esc(modeKo(r.cfg))}</div>${left}
      <div class="rbtns2">${main}${rec}</div></article>`;
  };
  const lists = { mine, open, watch, done }, cur = lists[lobbyTab] || [];
  const emptyMsg = { mine: '진행 중인 대전이 없어요. 방을 만들거나 들어갈 방을 찾아보세요.', open: '들어갈 수 있는 방이 없어요. 직접 방을 만들어 보세요.', watch: '지금 관전할 대전이 없어요.', done: '끝난 판이 아직 없어요.' }[lobbyTab];
  // 위쪽은 한 줄: 탭(내 대전·들어갈 방·관전·끝난 판) + 오른쪽 '방 만들기' (머리의 '대전'과 겹치는 제목은 뺌)
  app.innerHTML = `<div class="lobh"><div class="ltabs" role="tablist">${tabs.map(([k, l, n]) => `<button class="ltab ${lobbyTab === k ? 'on' : ''}" role="tab" aria-selected="${lobbyTab === k}" data-tab="${k}">${l}<b>${n}</b>${k === 'mine' && myTurnN ? `<i class="dot" title="내 차례 ${myTurnN}"></i>` : ''}</button>`).join('')}</div><button class="primary newroom" data-tab="new">${ICON.plus}<span>방 만들기</span></button></div>
    ${cur.length ? `<div class="rlist">${cur.map(roomCard).join('')}</div>` : `<div class="empty-note">${ringIcon('wait', 'k-wait')}<p>${emptyMsg}</p></div>`}`;
  app.querySelectorAll('.ltab[data-tab]').forEach(b => b.onclick = () => { lobbyTab = b.dataset.tab; try { localStorage.setItem('lobbyTab', lobbyTab); } catch {} drawLobby(VIEW.lobby ? VIEW.lobby.v : [data, decks]); viewData('lobby', () => Promise.all([api('/api/rooms'), api('/api/decks')]), drawLobby, { drawn: true }); });
  const chooseDeck = async () => {
    const ok = decks.decks; if (!ok.length) { toast('먼저 덱을 만들어 주세요.'); location.hash = '#decks'; return null; }
    return pick('어떤 덱으로 할까요?', ok.map(d => ({ label: esc(d.name) + (d.ok ? '' : ` <span class="chip warn">규칙 확인</span>`), value: d.id })));
  };
  app.querySelectorAll('[data-join]').forEach(b => b.onclick = async () => {
    const deckId = await chooseDeck(); if (!deckId) return;
    try { const r = await api(`/api/rooms/${b.dataset.join}/join`, { deckId }); location.hash = '#game/' + r.room.games[r.room.games.length - 1]; if (r.room.cfg.mode === 'async') setTimeout(pushOffer, 1500); } catch (e) { toast(e.message); }
  });
  app.querySelectorAll('[data-next]').forEach(b => b.onclick = async () => { try { const r = await api(`/api/rooms/${b.dataset.next}/next`, {}); location.hash = '#game/' + r.room.games[r.room.games.length - 1]; } catch (e) { toast(e.message); } });
  app.querySelectorAll('[data-close-room]').forEach(b => b.onclick = async () => { await api(`/api/rooms/${b.dataset.closeRoom}/close`, {}); renderLobby(); });
  app.querySelectorAll('[data-follow]').forEach(b => b.onclick = async () => { b.disabled = true; const f = await setFollow(b.dataset.follow, !b.classList.contains('on')); b.disabled = false; if (f != null) renderLobby(); });
  app.querySelectorAll('[data-admin]').forEach(b => b.onclick = async () => { // 관리자: 진행 중이면 끝내기, 언제든 지우기 (한 번 더 묻기)
    const r = rooms.find(x => x.id === b.dataset.admin); if (!r) return;
    const name = esc(r.cfg.title || r.names.filter(Boolean).join(' vs '));
    const k = await pick(`관리: ${r.cfg.title || r.names.filter(Boolean).join(' vs ')}`, [...(r.status === 'playing' || r.status === 'between' ? [{ label: `${ICON.flag || ''}판 끝내기`, value: 'end', cls: 'judge' }] : []), { label: `${ICON.x}지우기`, value: 'delete', cls: 'bad' }]);
    if (!k) return;
    const ok = await ask(k === 'end' ? '이 판을 끝낼까요?' : '이 방을 지울까요?', k === 'end' ? `<p>「${name}」을(를) 승자 없이 끝내요. 기록과 리플레이는 남아요.</p>` : `<p>「${name}」의 모든 판과 기록, 리플레이를 지워요. 되돌릴 수 없어요.</p>`, k === 'end' ? '판 끝내기' : '지우기', k === 'end' ? 'judge' : 'bad');
    if (!ok) return;
    try { await api(`/api/admin/rooms/${r.id}/${k}`, {}); toast(k === 'end' ? '판을 끝냈어요.' : '방을 지웠어요.'); } catch (e) { toast(e.message); }
    renderLobby();
  });
  app.querySelector('.newroom').onclick = () => openSheet(newRoomForm(decks.decks), el => {
    const f = el.querySelector('#newroom'); if (!f) return;
    const syncDl = () => { const a = f.querySelector('input[name=mode]:checked')?.value === 'async'; f.querySelector('.dlrow').hidden = !a; };
    f.querySelectorAll('input[name=mode]').forEach(x => x.onchange = syncDl); syncDl();
    f.onsubmit = async e => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(f));
      try { await api('/api/rooms', fd); closeSheet(); lobbyTab = 'mine'; try { localStorage.setItem('lobbyTab', 'mine'); } catch {} toast('방을 만들었어요. 상대가 들어오면 시작해요.'); setTimeout(renderLobby, 40); if (fd.mode === 'async') setTimeout(pushOffer, 700); } catch (er) { toast(er.message); }
    };
  });
}
function newRoomForm(decks) { // 고르는 것은 모두 단추로 (선택 상자 대신). 이름은 그대로라 서버는 같음
  if (!decks.length) return `<button class="x sm" data-close>닫기</button><h3>덱이 먼저 있어야 해요</h3><p>덱 화면에서 덱 리스트를 붙여 넣거나 카드를 골라 만들어 주세요.</p><a class="btn primary" href="#decks">덱 만들러 가기</a>`;
  const seg = (name, opts, on) => `<div class="rseg n${opts.length}" role="radiogroup">${opts.map(([v, l, s]) => `<label class="ropt"><input type="radio" name="${name}" value="${v}" ${v === on ? 'checked' : ''}><span><b>${l}</b>${s ? `<small>${s}</small>` : ''}</span></label>`).join('')}</div>`;
  return `<button class="x sm" data-close>닫기</button><form id="newroom"><h3>방 만들기</h3>
    <label class="h">방 이름 <small class="muted">안 쓰면 내 이름으로</small></label><input name="title" maxlength="30" style="width:100%" placeholder="예: 금요일 연습전">
    <label class="h">내 덱</label>${seg('deckId', decks.map(d => [d.id, esc(d.name), d.ok ? '' : '규칙 확인 필요']), decks.find(d => d.ok)?.id || decks[0].id)}
    <label class="h">진행 방식</label>${seg('mode', [['live', '실시간', '지금 같이'], ['async', '비동기', '편할 때 한 수씩']], 'live')}
    <div class="dlrow"><label class="h">결정 기한 <small class="muted">비동기에서 한 번 결정할 때마다</small></label>${seg('deadlineH', [['12', '12시간'], ['24', '24시간'], ['48', '48시간'], ['72', '72시간']], '24')}</div>
    <label class="h">판수</label>${seg('bestOf', [['1', '1판'], ['3', '3판 2선승', '대회처럼']], '1')}
    <label class="h">관전</label>${seg('spectate', [['yes', '허용', '손패·프라이즈·덱 모두 보기'], ['no', '끔']], 'yes')}
    <label class="h">초대 <small class="muted">이 이름만 들어올 수 있어요. 비우면 누구나</small></label><input name="invite" maxlength="12" style="width:100%">
    <div class="acts1"><button class="primary">${ICON.plus}방 만들기</button></div></form>`;
}

// ---------- 덱 ----------
async function renderDecks(editId) {
  const h = location.hash, t = setTimeout(() => { if (location.hash === h && !app.querySelector('.dtiles, .dk-top')) app.innerHTML = '<div class="loadwait"><div class="spin-ball"></div></div>'; }, 600); // 아주 늦을 때만
  try { await loadCards(); } catch (e) { clearTimeout(t); app.innerHTML = `<p class="pad">${esc(e.message)}</p>`; return; }
  if (editId) { // 고치기는 늘 새 자료로 (방금 저장한 내용이 보이게)
    let decks; try { ({ decks } = await api('/api/decks')); } catch (e) { clearTimeout(t); app.innerHTML = `<p class="pad">${esc(e.message)}</p>`; return; }
    clearTimeout(t); if (location.hash !== h) return; delete VIEW.decks;
    return deckEditor(decks.find(d => d.id === editId) || { name: '새 덱', list: [] });
  }
  clearTimeout(t);
  return viewData('decks', () => api('/api/decks'), drawDecks);
}
function drawDecks({ decks }) {
  app.innerHTML = `<div class="dtiles"><button class="dtile new" id="nd"><span class="fan">${ringIcon('plus', 'k-ok')}</span><span class="dtl"><span class="dtr"><b>새 덱 만들기</b></span><small>카드를 골라 60장을 채워요</small></span></button>${decks.map(d => { const ch = checkDeck(d.list, IDX);
      return `<a class="dtile" href="#decks/${d.id}">${coverFan(deckCover(d.list))}<span class="dtl"><span class="dtr"><b>${esc(d.name)}</b>${ch.ok ? '<span class="chip ok">사용 가능</span>' : '<span class="chip warn">확인 필요</span>'}</span><small>${ch.total}장 · ${ch.ok ? '규칙 통과' : esc(ch.problems[0])}</small></span></a>`; }).join('')}</div>`;
  $('#nd').onclick = () => go('#decks/new');
}
// 덱 상자에 겹쳐 보일 카드 (최대 4장, 이름이 같은 카드는 한 장만). ★ 대표 카드를 먼저, 모자라면 자동으로:
// 포켓몬(메가 ex > ex > 그 밖) → HP 높은 순 → 2진화 > 1진화 > 기본 → 많이 넣은 카드 / 그다음 트레이너스(ACE SPEC > 서포트 > 그 밖), 에너지(특수 먼저)
function coverRank(c) {
  const s = c.sub || [];
  if (c.st === 'P') return [0, s.includes('MEGA') ? 0 : s.includes('ex') ? 1 : 2, -(c.hp || 0), s.includes('Stage 2') ? 0 : s.includes('Stage 1') ? 1 : 2];
  if (c.st === 'T') return [1, s.includes('ACE SPEC') ? 0 : s.includes('Supporter') ? 1 : 2, 0, 0];
  return [2, s.includes('Special') ? 0 : 1, 0, 0];
}
function deckCover(list) {
  const cmp = (a, b) => { const A = coverRank(a.c0), B = coverRank(b.c0); for (let i = 0; i < 4; i++) if (A[i] !== B[i]) return A[i] - B[i]; return b.n - a.n; };
  const xs = list.filter(x => IDX.byId[x.id]).map(x => ({ ...x, c0: IDX.byId[x.id] }));
  const pool = [...xs.filter(x => x.c).sort(cmp), ...xs.filter(x => !x.c).sort(cmp)];
  const seen = new Set(), out = [];
  for (const x of pool) { const k = cname(x.c0); if (seen.has(k)) continue; seen.add(k); out.push(x.c0); if (out.length === 4) break; }
  return out; // 0번이 가장 대표: 가운데 맨 위에
}
function coverFan(cv) { // 대표 카드는 가운데 맨 위, 나머지는 양옆 뒤로
  const n = cv.length, mid = Math.floor(n / 2), pos = [...Array(n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  return `<span class="fan" style="--n:${n}">${cv.map((c, r) => `<span class="cpic${r === 0 ? ' main' : ''}" style="--i:${pos[r]};--z:${n - r}">${picHtml(c, D.dimg)}</span>`).join('')}</span>`;
}
// 같은 카드(이름·HP·기술·특성이 같음)는 그림이 달라도 한 칸으로 묶음. 대표 그림은 일반 등급·최신 카드 먼저
const REG_RARE = new Set(['C', 'U', 'R', 'RR', 'ACE', 'PR', 'TR', 'K', undefined, '']);
const fkey = c => c._fk ||= c.st + '|' + (c.st === 'P' ? [c.n, c.hp, (c.sub || []).join(','), (c.at || []).map(a => a.n + (a.d || '')).join(';'), (c.ab || []).map(a => a.n).join(';')].join('|') : c.n + (c.side || '')); // 짝 카드는 좌측·우측을 따로
let PRINTS = null;
function printsOf(c) { // 같은 카드의 다른 그림들 (보이는 그림이 같은 것은 하나만)
  if (!PRINTS) {
    PRINTS = new Map(); ALL.forEach((x, i) => { x._ix = i; const k = fkey(x); if (!PRINTS.has(k)) PRINTS.set(k, []); PRINTS.get(k).push(x); });
    for (const [k, xs] of PRINTS) PRINTS.set(k, xs.sort((a, b) => (REG_RARE.has(a.kra) ? 0 : 1) - (REG_RARE.has(b.kra) ? 0 : 1) || b._ix - a._ix));
  }
  const xs = PRINTS.get(fkey(c)) || [c], seen = new Set();
  return xs.filter(x => { const u = picKey(x); if (seen.has(u)) return false; seen.add(u); return true; });
}
const picKey = x => D.dimg === 'en' || !x.kimg || (D.dimg === 'mix' && canMix(x)) ? x.img || x.id : x.kimg; // 합친 카드는 그림 칸이 영문판이라 영문판 그림으로 구분
// ---------- 덱 사진 → 카드 (기기 안에서만 읽음: lib/deckscan.js 를 따로 돌림) ----------
const DeckScan = {
  w: null, names: null, energy: null, labels: null,
  call(msg, onProg) {
    if (!this.w) this.w = new Worker('/lib/deckscan-worker.js', { type: 'module' });
    return new Promise((ok, no) => {
      this.w.onmessage = e => { const m = e.data; if (m.t === 'p') onProg && onProg(m.p, m.s); else if (m.t === 'err') no(new Error(m.msg)); else ok(m); };
      this.w.onerror = () => { this.w = null; no(new Error('사진 읽기를 시작하지 못했어요. 새로고침 뒤 다시 해 주세요.')); };
      this.w.postMessage(msg, msg.img ? [msg.img.data.buffer] : []);
    });
  },
  async prep(onProg) {
    if (this.names) return;
    onProg && onProg(0.01, '카드 그림 목록 받는 중');
    const { labels } = await this.call({ t: 'labels' }), nz = x => (x || '').replace(/\s/g, '');
    this.labels = labels;
    this.names = labels.map(l => l[0] === '!' ? nz(l.slice(1)) : nz(IDX.byId[l] ? cnameKo(IDX.byId[l]) : l));
    this.energy = Uint8Array.from(labels.map(l => l[0] === '!' ? /^기본.+에너지$/.test(nz(l.slice(1))) : (IDX.byId[l]?.st === 'E' && (IDX.byId[l].sub || []).includes('Basic'))));
  },
  async load(file) { // 사진 → 캔버스 (가로 1600px 넘으면 줄임)
    let src; try { src = await createImageBitmap(file); } catch { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('사진을 읽지 못했어요.')); im.src = URL.createObjectURL(file); }); }
    const s = Math.min(1, 1600 / src.width), cv = document.createElement('canvas'); cv.width = Math.round(src.width * s); cv.height = Math.round(src.height * s);
    const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, cv.width, cv.height); return cv;
  },
  async scan(file, onProg) {
    const cv = await this.load(file); await this.prep(onProg);
    const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    const { res } = await this.call({ t: 'scan', img, names: this.names, energy: this.energy }, onProg);
    return { res, cv };
  },
  async card(url) { // 카드 한 장 그림(일본 공식 덱 코드) → 그림으로 찾기
    await this.prep();
    const r = await fetch(url, { credentials: 'same-origin' }); if (!r.ok) throw new Error('카드 그림을 받지 못했어요.');
    const src = await createImageBitmap(await r.blob()), s = Math.min(1, 520 / src.width), cv = document.createElement('canvas'); cv.width = Math.round(src.width * s); cv.height = Math.round(src.height * s);
    const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, cv.width, cv.height);
    const { res } = await this.call({ t: 'card', img: g.getImageData(0, 0, cv.width, cv.height), names: this.names });
    return { res, crop: this.crop(cv, { x: 0, y: 0, w: cv.width, h: cv.height }) };
  },
  crop(cv, c) { // 결과 줄에 보일 사진 속 카드 (작게)
    const k = document.createElement('canvas'); k.width = 90; k.height = 126; const g = k.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#ddd'; g.fillRect(0, 0, 90, 126); g.drawImage(cv, c.x, c.y, c.w, c.h, 0, 0, 90, 126); return k.toDataURL('image/jpeg', 0.82);
  },
};
function deckEditor(deck) {
  let list = deck.list.map(x => ({ ...x }));
  document.body.classList.add('deckedit');
  const snap = () => JSON.stringify([($('#dn') || {}).value ?? deck.name, list.map(x => [x.id, x.n, x.c || 0]).sort()]);
  const saved0 = JSON.stringify([deck.name, deck.list.map(x => [x.id, x.n, x.c || 0]).sort()]);
  const dirty = () => snap() !== saved0 && !(deck.id == null && !list.length);
  const count = () => list.reduce((a, b) => a + b.n, 0);
  const KIND = { P: '포켓몬', T: '트레이너스', E: '에너지' }, KIND_EN = { P: 'Pokémon', T: 'Trainer', E: 'Energy' };
  const kindName = st => D.dtext === 'en' ? KIND_EN[st] : KIND[st];
  const setNo = c => D.dtext !== 'en' && c.kset ? `${c.kset} ${c.kno || ''}` : `${c.set || ''} ${cardNo(c) || ''}`;
  const hexN = n => `<span class="hexn"><b>${n}</b></span>`;
  const tile = (c, n, extra = '', note = '') => `<div class="dkc" data-id="${c.id}">${picMode(c, D.dimg) ? `<span class="cpic">${picHtml(c, D.dimg)}</span>` : `<div class="ph">${esc(cname(c))}</div>`}${n ? hexN(n) : ''}${extra}<div class="cnm">${esc(cname(c))}${altName(c) ? `<small class="alt">${esc(altName(c))}</small>` : D.dtext === 'both' ? '<small class="alt">&nbsp;</small>' : ''}</div><div class="muted cno">${esc(setNo(c))}${note}</div></div>`;
  let view = 'kind'; try { view = localStorage.getItem('dkView') === 'all' ? 'all' : 'kind'; } catch {}
  // 위쪽은 한 줄: 뒤로 · 덱 이름 · 장수(규칙) · 카드 추가 · 내보내기 · 저장 ('더 보기' 메뉴 없이 단추로). 덱 지우기는 목록 맨 아래
  app.innerHTML = `<div class="dk-top"><button class="sm ib" id="back" aria-label="덱 목록으로">${ICON.back}</button><input id="dn" value="${esc(deck.name)}" maxlength="30" aria-label="덱 이름" placeholder="덱 이름"><button type="button" id="cnt" class="cntb" aria-label="덱 규칙 보기"></button><button class="primary sm" id="add">${ICON.plus}<span class="lb">카드 추가</span></button><button class="sm" id="exp" aria-label="리스트 내보내기">${ICON.out}<span class="lb">내보내기</span></button><button class="good sm" id="save">${ICON.check}<span class="lb">저장</span></button></div>
    <div id="lst"></div>`;
  const drawList = () => {
    const ch = checkDeck(list, IDX), cb = $('#cnt');
    cb.className = 'cntb ' + (ch.ok ? 'ok' : 'warn'); cb.innerHTML = `${ch.ok ? ICON.check : ICON.warn}<b>${count()}</b><span>/ 60</span>`; cb.title = [...(ch.ok ? ['덱 규칙 통과'] : ch.problems), ...ch.warns].join(' / ');
    const sorted = [...list].sort((a, b) => ('PTE'.indexOf(IDX.byId[a.id].st) - 'PTE'.indexOf(IDX.byId[b.id].st)) || cname(IDX.byId[a.id]).localeCompare(cname(IDX.byId[b.id])));
    const per = st => sorted.filter(x => IDX.byId[x.id].st === st), sum = xs => xs.reduce((a, b) => a + b.n, 0);
    const vsw = `<span class="vsw" role="group" aria-label="보기 방식">${[['kind', '종류별'], ['all', '한꺼번에']].map(([k, l]) => `<button type="button" data-v="${k}" class="${view === k ? 'on' : ''}" aria-pressed="${view === k}">${l}</button>`).join('')}</span>`;
    const grid = xs => `<div class="dkgrid sz-${D.dsize}${D.dinfo === 'hide' ? ' noinfo' : ''}">${xs.map(x => tile(IDX.byId[x.id], x.n, x.c ? `<span class="cvstar" title="덱 목록에 보이는 대표 카드">${ICON.star}</span>` : '')).join('')}</div>`;
    $('#lst').innerHTML = (!list.length ? `<div class="empty-note">${ringIcon('deck', 'k-ok')}<p>아직 카드가 없어요.<small class="enote2">오른쪽 위 <b>카드 추가</b>에서 카드를 고르거나, 덱 리스트·덱 사진을 넣어요.</small></p></div>`
      : view === 'all' ? `<div class="dgrp"><span class="dkst">${[...'PTE'].map(st => `<span>${kindName(st)} <b>${sum(per(st))}</b></span>`).join('')}</span>${vsw}</div>${grid(sorted)}` // 보기 단추는 첫 머리 줄 오른쪽 (줄을 따로 쓰지 않음)
      : [...'PTE'].filter(st => per(st).length).map((st, i) => { const xs = per(st); return `<div class="dgrp"><span>${kindName(st)} <small>${sum(xs)}장</small></span>${i === 0 ? vsw : ''}</div>${grid(xs)}`; }).join(''))
      + (deck.id ? `<div class="dkfoot"><button type="button" class="sm bad" id="deldeck">${ICON.x}덱 지우기</button></div>` : '');
    $('#lst').querySelectorAll('.dkc').forEach(el => el.onclick = () => cardSheet(el.dataset.id));
    const dd = $('#deldeck'); if (dd) dd.onclick = async () => { if (await ask('덱을 지울까요?', '<p>지우면 되돌릴 수 없어요.</p>', '지우기', 'bad')) { await api('/api/decks/' + deck.id, null, 'DELETE'); GUARD = null; go('#decks'); } };
    $('#lst').querySelectorAll('.vsw [data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; try { localStorage.setItem('dkView', view); } catch {} drawList(); });
  };
  const addN = (id, d) => { let x = list.find(y => y.id === id); if (!x && d > 0) list.push(x = { id, n: 0 }); if (x) { x.n += d; if (x.n <= 0) list = list.filter(y => y !== x); } drawList(); };
  const cardSheet = id => {
    const c = IDX.byId[id], x = list.find(y => y.id === id), have = x?.n || 0, cv = !!x?.c;
    openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(c)}<div class="row" style="margin-top:10px"><button class="primary" data-a="1">+1장</button><button data-a="-1"${have ? '' : ' disabled'}>−1장</button><span class="chip">지금 ${have}장</span>${have ? `<button class="sm ${cv ? 'on' : ''}" data-cv aria-pressed="${cv}">${ICON.star}${cv ? '대표 카드' : '대표 카드로'}</button>` : ''}</div><p class="small muted" style="margin:6px 0 0">대표 카드는 내 덱 목록에서 덱 상자 위에 겹쳐 보여요 (최대 4장). 고르지 않으면 메가 ex, ex, HP가 높은 포켓몬 순으로 알아서 골라요.</p>`, el => {
      el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { addN(id, +b.dataset.a); closeSheet(); });
      const cb = el.querySelector('[data-cv]'); if (cb) cb.onclick = () => { const y = list.find(z => z.id === id); if (!y) return; if (!y.c && list.filter(z => z.c).length >= 4) { toast('대표 카드는 4장까지예요.'); return; } y.c = y.c ? 0 : 1; if (!y.c) delete y.c; closeSheet(); drawList(); };
    });
  };
  // 카드 추가 창: 위는 한 줄(검색·장수·닫기), 종류는 옆 줄. 카드를 누르면 1장, ⓘ는 자세히 보기. 같은 카드는 한 칸(그림 여러 개면 '그림 N')
  const artPick = {};
  const openAdd = (start) => {
    let q = '', filt = 'all';
    try { q = localStorage.getItem('addQ') || ''; filt = localStorage.getItem('addTab') || 'all'; } catch {}
    if (!['all', 'P', 'T', 'E'].includes(filt)) filt = 'all';
    if (start === 'L') filt = 'L';
    const TABS = [['all', 'deck', '전체'], ['P', 'battle', '포켓몬'], ['T', 'user', '트레이너스'], ['E', 'bolt', '에너지']];
    openSheet(`<div class="adds"><div class="addh"><h3>카드 추가</h3><span class="chip" id="acnt"></span><label class="addq">${ICON.search}<input id="q" placeholder="${innerWidth < 480 ? '카드 이름 검색' : '이름 검색 (피카츄, ㅍㅋㅊ, vzc)'}" autocomplete="off" value="${esc(q)}"></label><button class="sm ib" data-close aria-label="닫기">${ICON.x}</button></div>
      <nav class="addt" aria-label="카드 종류">${TABS.map(([k, ic, l]) => `<button type="button" class="lgt ${k === filt ? 'on' : ''}" data-f="${k}">${ICON[ic]}<span>${l}</span></button>`).join('')}<i class="addsep2" aria-hidden="true"></i><button type="button" class="lgt lgp ${filt === 'L' ? 'on' : ''}" data-f="L">${ICON.paste}<span>리스트·<span class="nb">사진</span></span></button></nav>
      <div class="addr"><div id="res" class="dkgrid add sz-${D.dsize}${D.dinfo === 'hide' ? ' noinfo' : ''}"></div><div class="pastep" hidden></div></div><div class="addi" hidden></div></div>`, el => {
      el.classList.add('wide', 'addsheet');
      const repOf = c => { const ps = printsOf(c), inDeck = ps.find(p => list.some(x => x.id === p.id)); return IDX.byId[artPick[fkey(c)]] || inDeck || ps[0]; };
      const nIn = c => { const ids = new Set(printsOf(c).map(p => p.id)); return list.filter(x => ids.has(x.id) || fkey(IDX.byId[x.id]) === fkey(c)).reduce((a, b) => a + b.n, 0); };
      const minusId = c => { const r = repOf(c); if (list.some(x => x.id === r.id)) return r.id; const k = fkey(c); return list.find(x => fkey(IDX.byId[x.id]) === k)?.id; };
      const pp = el.querySelector('.pastep'), res = el.querySelector('#res');
      // 덱 사진: 고르기·붙여 넣기·끌어 놓기 → 카드 칸·장수·카드 찾기 → 확실한 것만 미리 체크, 애매한 것은 후보에서 고름
      let scan = null;
      const photoIn = document.createElement('input'); photoIn.type = 'file'; photoIn.accept = 'image/*'; photoIn.hidden = true; el.append(photoIn);
      photoIn.onchange = () => { const f = photoIn.files[0]; photoIn.value = ''; if (f) readPhoto(f); };
      const drawProg = () => { const b = pp.querySelector('.sprog'); if (!b || !scan || !scan.busy) return; const pc = Math.round(scan.p * 100); b.querySelector('i').style.width = pc + '%'; b.querySelector('span').textContent = `${scan.s} · ${pc}%`; };
      // 좌측·우측 짝 카드(전설의 산정 등)가 한 줄만 있으면 (한국 공식 덱 코드는 한 줄로 줌, 한글판 그림은 두 장이 이어져 있음)
      // 다른 줄을 더해 60장이 되면 '짝 수', 아니면 '장수'로 보고 좌측·우측 두 줄로 나눔
      const splitPairs = rows => { for (let i = rows.length - 1; i >= 0; i--) {
        const w = rows[i], c = w.id && IDX.byId[w.id]; if (!c || !c.pair || !IDX.byId[c.pair] || rows.some(x => x !== w && x.id === c.pair)) continue;
        const sum = rows.reduce((t, x) => t + x.n, 0), pairs = sum + w.n === 60, L = pairs ? w.n : Math.ceil(w.n / 2), R = pairs ? w.n : w.n - L;
        const lid = c.side === 'L' ? c.id : c.pair, rid = c.side === 'L' ? c.pair : c.id, ok = w.nSure && (pairs || sum === 60);
        rows.splice(i, 1, { ...w, id: lid, n: L, nSure: ok }, ...(R ? [{ ...w, id: rid, n: R, nSure: ok }] : []));
      } };
      const readPhoto = async f => {
        if (scan && scan.busy) return;
        if (filt !== 'L') setF('L');
        scan = { busy: true, p: 0, s: '사진 여는 중' }; pasteDraw();
        try {
          const { res, cv } = await DeckScan.scan(f, (p, st) => { if (scan && scan.busy) { scan.p = Math.max(scan.p, p); scan.s = st; drawProg(); } });
          if (!res.cards.length) { scan = null; pasteDraw(); toast('사진에서 카드를 찾지 못했어요. 덱 리스트 부분만 잘라서 다시 넣어 주세요.', 3600); return; }
          scan = { rows: res.cards.map(c => { const l = c.cands[0].label, id = l[0] === '!' ? null : l;
            return { id, name: id ? null : l.slice(1), n: c.n, nSure: c.nSure, sure: c.sure && !!id, on: c.sure && !!id, cands: c.cands.slice(0, 4).map(x => x.label), crop: DeckScan.crop(cv, c) }; }) };
          splitPairs(scan.rows);
          Sound.sfx('place');
        } catch (e) { scan = null; toast(e.message, 3600); }
        pasteDraw();
      };
      // 덱 코드: 한국 공식(vqvQ-LtHf-zBuI-kt8B)·일본 공식(fbVVkk-tfvTLr-FvkvVF). 서버가 공식 사이트에서 받아 사이트 카드로 잇고,
      // 일본판 트레이너스처럼 번호로 못 잇는 카드는 공식 카드 그림을 받아 그림으로 찾음 (확실한 것만 미리 체크)
      const readCode = async code => {
        if (scan && scan.busy) return;
        if (filt !== 'L') setF('L');
        scan = { busy: true, p: 0.05, s: '덱 코드 읽는 중', code }; pasteDraw();
        try {
          const r = await api('/api/deckcode?c=' + encodeURIComponent(code));
          const rows = r.items.map(x => { const id = x.id && IDX.byId[x.id] ? x.id : null;
            return { id, name: id ? null : x.kn || x.jp || '?', jp: x.jp || null, n: x.n, nSure: true, sure: !!id, on: !!id, cands: [], crop: null, pict: !id && !x.kn ? x.pict || null : null, note: !id && !x.kn && !x.pict ? '사이트 카드와 잇지 못했어요' : null }; });
          const todo = rows.filter(w => w.pict);
          for (let i = 0; i < todo.length; i++) {
            const w = todo[i]; scan.p = Math.max(scan.p, 0.15 + 0.8 * i / todo.length); scan.s = `카드 그림으로 찾는 중 ${i + 1}/${todo.length}`; drawProg();
            try {
              const { res, crop } = await DeckScan.card('/api/deckcode/img?p=' + encodeURIComponent(w.pict)), l = res.cands[0].label, id = l[0] === '!' ? null : IDX.byId[l] ? l : null;
              Object.assign(w, { crop, cands: res.cands.slice(0, 4).map(c => c.label), id, name: id ? null : l[0] === '!' ? l.slice(1) : w.name, sure: res.sure && !!id, on: res.sure && !!id });
            } catch { w.note = '카드 그림을 받지 못했어요 · 카드 추가에서 직접 넣어 주세요'; }
          }
          splitPairs(rows);
          scan = { rows, src: r.src, code };
          Sound.sfx('place');
        } catch (e) { scan = null; toast(e.message, 3600); }
        pasteDraw();
      };
      const codeOf = t => { const m = String(t || '').match(/(?:^|[^A-Za-z0-9-])([A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}|[A-Za-z0-9]{6}-[A-Za-z0-9]{6}-[A-Za-z0-9]{6})(?![A-Za-z0-9-])/); return m ? m[1] : null; };
      el.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); readPhoto(f); } });
      el.addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(x => x.kind === 'file')) e.preventDefault(); });
      el.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); readPhoto(f); } });
      const drawScan = () => {
        const sv = pp.querySelector('.scanv'), acts = pp.querySelector('.pacts');
        if (scan.busy) { if (!sv.querySelector('.sprog')) sv.innerHTML = `<div class="sprog"><div class="bar"><i></i></div><span></span></div>`; acts.innerHTML = ''; drawProg(); return; }
        const rows = scan.rows, onR = rows.filter(r => r.on && r.id), tot = onR.reduce((a, r) => a + r.n, 0), all = rows.reduce((a, r) => a + r.n, 0);
        const amb = rows.filter(r => r.id && !r.sure && !r.on).length, nos = rows.filter(r => !r.id).length, nq = rows.filter(r => !r.nSure).length;
        sv.innerHTML = `<div class="shead"><span class="chip ${all === 60 ? 'ok' : 'warn'}">${scan.src ? '덱 코드 속' : '사진 속'} ${rows.length}종 · ${all}장</span>${amb ? `<span class="chip warn">애매 ${amb}종</span>` : ''}${nos ? `<span class="chip">사이트에 없는 카드 ${nos}종</span>` : ''}${nq ? `<span class="chip warn">장수 확인 ${nq}종</span>` : ''}<span class="sbtns">${scan.src ? '' : `<button type="button" class="sm" data-photo2>${ICON.photo}다른 사진</button>`}<button type="button" class="sm" data-back2>${ICON.paste}리스트로</button></span></div>
          <p class="small muted snote">${scan.src ? `${scan.src === 'kr' ? '한국' : '일본'} 공식 덱 코드 <b>${esc(scan.code)}</b>에서 읽었어요. 체크한 카드만 덱에 넣어요.${scan.src === 'jp' ? ' 일본판 트레이너스는 카드 그림으로 찾았어요.' : ''}${amb ? ' 애매한 카드는 아래 후보에서 맞는 것을 누르면 체크돼요.' : ''}` : '체크한 카드만 덱에 넣어요. 애매한 카드는 아래 후보에서 맞는 것을 누르면 체크돼요. 장수가 다르면 −·+로 고쳐 주세요.'}</p>
          <div class="slist">${rows.map((r, i) => { const c = r.id && IDX.byId[r.id], st = r.id ? (r.sure ? '확실' : r.on ? '고름' : '애매') : r.note ? '못 찾음' : '사이트에 없음';
            return `<div class="srow ${r.id ? (r.sure || r.on ? 'sure' : 'amb') : 'nos'}${r.crop ? '' : ' nc'}" data-i="${i}">
              <button type="button" class="sck ${r.on ? 'on' : ''}" data-on aria-pressed="${r.on}" ${r.id ? '' : 'disabled'} aria-label="덱에 넣기">${ICON.check}</button>
              ${r.crop ? `<img class="scrop" src="${r.crop}" alt="${scan.src ? '공식 카드 그림' : '사진 속 카드'}">` : ''}
              ${c ? `<span class="cpic spic">${picHtml(c, D.dimg)}</span>` : '<span class="spic none">—</span>'}
              <div class="sinf"><b>${esc(c ? cnameKo(c) : r.name || '?')}</b><small><em class="st">${st}</em>${c ? ' · ' + esc(setNo(c)) : r.id ? '' : ' · ' + esc(r.note || 'H·I·J 카드가 아니에요')}${r.jp && r.jp !== r.name ? ` · <span lang="ja">${esc(r.jp)}</span>` : ''}</small>
                ${(!r.sure || !r.id) && r.cands.some(l => l[0] !== '!' && l !== r.id) ? `<div class="salt">${r.cands.map(l => { const cc = l[0] === '!' ? null : IDX.byId[l], cur = l === (r.id || '!' + r.name); return `<button type="button" class="sm ${cur ? 'on' : ''}" data-alt="${esc(l)}" ${cc ? '' : 'disabled'}>${esc(cc ? cnameKo(cc) : l.slice(1))}</button>`; }).join('')}</div>` : ''}</div>
              <div class="sstep"><button type="button" class="sm ib" data-n="-1" aria-label="1장 빼기">${ICON.minus}</button><b class="${r.nSure ? '' : 'q'}" title="${r.nSure ? '' : '장수를 확실히 읽지 못했어요'}">${r.n}</b><button type="button" class="sm ib" data-n="1" aria-label="1장 더">${ICON.plus}</button></div></div>`; }).join('')}</div>`;
        const p2 = sv.querySelector('[data-photo2]'); if (p2) p2.onclick = () => photoIn.click();
        sv.querySelector('[data-back2]').onclick = () => { const ta = pp.querySelector('#paste'); if (scan.code && codeOf(ta.value) === scan.code) ta.value = ''; scan = null; pasteDraw(); };
        sv.querySelectorAll('.srow').forEach(rw => { const r = rows[+rw.dataset.i];
          rw.querySelector('[data-on]').onclick = () => { if (!r.id) return; r.on = !r.on; drawScan(); };
          rw.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { r.n = Math.max(1, Math.min(60, r.n + +b.dataset.n)); r.nSure = true; drawScan(); });
          rw.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => { const l = b.dataset.alt; if (l[0] === '!') return; r.id = l; r.name = null; r.on = true; drawScan(); });
        });
        const has = list.length > 0, btns = has ? [['add', 'plus', `${tot}장 더하기`, 'primary'], ['rep', 'paste', '바꾸기', '']] : [['rep', 'plus', `${tot}장 덱에 넣기`, 'primary']];
        acts.style.setProperty('--cols', btns.length);
        acts.innerHTML = btns.map(([k, ic, l, cls]) => `<button type="button" class="${cls}" data-sgo="${k}" ${tot ? '' : 'disabled'}>${ICON[ic]}${l}</button>`).join('');
        acts.querySelectorAll('[data-sgo]').forEach(b => b.onclick = () => {
          const items = []; for (const r of onR) { const y = items.find(z => z.id === r.id); if (y) y.n += r.n; else items.push({ id: r.id, n: r.n }); }
          if (b.dataset.sgo === 'rep') list = items; else for (const x of items) { const y = list.find(z => z.id === x.id); if (y) y.n += x.n; else list.push({ ...x }); }
          const left = rows.length - onR.length; scan = null;
          drawList(); el.querySelector('#acnt').textContent = count() + ' / 60'; Sound.sfx('place'); closeSheet();
          toast(left ? `${tot}장 넣었어요. 체크하지 않은 ${left}종은 넣지 않았어요.` : `${tot}장 넣었어요.`, 3200);
        });
      };
      const pasteDraw = () => { // 리스트 붙여 넣기: 붙여 넣는 대로 찾은 장수·못 찾은 줄을 바로 보여 주고, 덱에 더하거나 통째로 바꿈
        const has = list.length > 0;
        if (!pp.firstChild) {
          pp.innerHTML = `<div class="phrow"><button type="button" class="primary sm" data-photo>${ICON.photo}덱 사진 읽기</button><small class="muted">덱 사진을 고르거나, 붙여 넣거나, 끌어 놓아요. 사진은 이 기기 안에서만 읽어요.</small></div>
            <p class="small muted pnote">PTCGL이나 이 사이트에서 내보낸 덱 리스트(영어·한국어)를 붙여 넣으세요. 한 줄에 ‘장수 이름 세트 번호’예요. 한국·일본 공식 <b>덱 코드</b>를 넣어도 돼요.<span class="pn2"> <b>더하기</b>는 지금 덱에 보태고, <b>바꾸기</b>는 지금 덱을 이 리스트로 바꿔요.</span></p>
            <div class="scanv" hidden></div>
            <textarea id="paste" spellcheck="false" autocomplete="off" placeholder="4 Pikachu ex SVP 106&#10;4 피카츄 ex SV8 033&#10;…&#10;또는 덱 코드 vqvQ-LtHf-zBuI-kt8B"></textarea>
            <div class="pres" aria-live="polite"></div><div class="acts bal pacts"></div>`;
          const ta = pp.querySelector('#paste'); ta.oninput = () => { const cd = codeOf(ta.value); if (cd && !parseDeckList(ta.value, IDX).list.length) { readCode(cd); return; } pasteDraw(); };
          pp.querySelector('[data-photo]').onclick = () => photoIn.click();
        }
        const scanOn = !!scan; pp.querySelector('.scanv').hidden = !scanOn; ['#paste', '.pres', '.pnote', '.phrow'].forEach(k => { pp.querySelector(k).hidden = scanOn; });
        if (scanOn) return drawScan();
        const ta = pp.querySelector('#paste'), r = parseDeckList(ta.value, IDX), tot = r.list.reduce((a, b) => a + b.n, 0);
        pp.querySelector('.pn2').hidden = !has;
        pp.querySelector('.pres').innerHTML = !ta.value.trim() ? '' : `<span class="chip ${r.bad.length ? 'warn' : 'ok'}">찾은 카드 ${tot}장 · ${r.list.length}종</span>${r.bad.length ? `<div class="pbad"><b>못 찾은 줄 ${r.bad.length}개</b><ul>${r.bad.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}${r.bad.length > 12 ? `<li>… ${r.bad.length - 12}줄 더</li>` : ''}</ul></div>` : ''}`;
        const acts = pp.querySelector('.pacts'), btns = has ? [['add', 'plus', '더하기', 'primary'], ['rep', 'paste', '바꾸기', '']] : [['rep', 'plus', '덱에 넣기', 'primary']];
        acts.style.setProperty('--cols', btns.length);
        acts.innerHTML = btns.map(([k, ic, l, cls]) => `<button type="button" class="${cls}" data-pgo="${k}" ${tot ? '' : 'disabled'}>${ICON[ic]}${l}</button>`).join('');
        acts.querySelectorAll('[data-pgo]').forEach(b => b.onclick = () => {
          const rr = parseDeckList(ta.value, IDX), n = rr.list.reduce((a, x) => a + x.n, 0); if (!n) return;
          if (b.dataset.pgo === 'rep') list = rr.list.map(x => ({ ...x }));
          else for (const x of rr.list) { const y = list.find(z => z.id === x.id); if (y) y.n += x.n; else list.push({ ...x }); }
          drawList(); el.querySelector('#acnt').textContent = count() + ' / 60'; Sound.sfx('place');
          if (rr.bad.length) { ta.value = rr.bad.join('\n'); pasteDraw(); toast(`${n}장 넣었어요. 못 찾은 줄만 남겨 뒀어요.`, 3200); }
          else { closeSheet(); toast(`${n}장 넣었어요.`); }
        });
      };
      const draw = () => {
        el.querySelector('#acnt').textContent = count() + ' / 60';
        const L = filt === 'L'; res.hidden = L; pp.hidden = !L; el.querySelector('.addq').classList.toggle('dim', L);
        if (L) { pasteDraw(); return; }
        let items = ALL.filter(c => filt === 'all' || c.st === filt);
        if (q.trim()) { const m = KS.matcher(q); items = items.map(c => [m(KS.norm(cnameKo(c)), KS.norm(c.n), c._sc ||= {}), c]).filter(h => h[0] >= 0).sort((a, b) => a[0] - b[0]).map(h => h[1]); }
        else items = items.filter(c => c.rm >= 'I' || c.st === 'E').reverse().sort((a, b) => (a.kro ? 1 : 0) - (b.kro ? 1 : 0)); // 최신 카드부터, 한국판 전용 카드는 뒤로
        const seen = new Set(), out = [];
        for (const c of items) { const k = fkey(c); if (seen.has(k)) continue; seen.add(k); out.push(repOf(c)); if (out.length >= 60) break; }
        el.querySelector('#res').innerHTML = out.map(c => { const n = nIn(c), arts = printsOf(c).length;
          return tile(c, n, `${n ? `<button class="sm dkminus" data-m aria-label="1장 빼기">${ICON.minus}</button>` : ''}<button class="sm dki" data-i aria-label="자세히 보기">${ICON.info}</button>`, arts > 1 ? ` · <b class="arts">그림 ${arts}</b>` : ''); }).join('') || '<p class="muted">찾는 카드가 없어요.</p>';
        el.querySelectorAll('#res .dkc').forEach(t => t.onclick = e => {
          const c = IDX.byId[t.dataset.id];
          if (e.target.closest('[data-i]')) return showInfo(c);
          const m = e.target.closest('[data-m]'); if (m) { const id = minusId(c); if (id) addN(id, -1); } else addN(c.id, 1);
          Sound.sfx(m ? 'tap' : 'place'); draw();
        });
      };
      const info = el.querySelector('.addi');
      const showInfo = (c, open = true) => { // 자세히 보기: 창 안에서 겹쳐 보여 줌 (뒤로 가기·'목록으로'로 돌아감)
        const ps = printsOf(c), cur = repOf(c), n = nIn(c);
        info.innerHTML = `<div class="addib">${cardInfoHtml(cur)}
          ${ps.length > 1 ? `<label class="h">그림 고르기 <small class="muted">넣을 그림을 골라요 (효과는 같아요)</small></label><div class="artrow">${ps.map(p => `<button type="button" class="artc ${p.id === cur.id ? 'on' : ''}" data-art="${p.id}" aria-pressed="${p.id === cur.id}" title="${esc(setNo(p))}"><span class="cpic">${picHtml(p, D.dimg)}</span><small>${esc(setNo(p))}</small></button>`).join('')}</div>` : ''}</div>
          <div class="addfab"><button class="sm" data-back aria-label="목록으로">${ICON.back}<span>목록</span></button><i class="addsep"></i><button class="sm ib" data-a="-1" ${n ? '' : 'disabled'} aria-label="1장 빼기">${ICON.minus}</button><b class="addn" title="덱에 들어 있는 장수">${n}<small>장</small></b><button class="primary ib" data-a="1" aria-label="1장 넣기">${ICON.plus}</button></div>`; // 넣기·빼기·목록은 오른쪽 아래 작은 묶음 (가로·세로 같은 자리)
        if (open) { info.hidden = false; info.scrollTop = 0; SUBVIEW = () => { info.hidden = true; SUBVIEW = null; draw(); }; history.pushState({ sub: 1 }, ''); }
        info.querySelector('[data-back]').onclick = () => history.back();
        info.querySelectorAll('[data-art]').forEach(b => b.onclick = () => { artPick[fkey(c)] = b.dataset.art; showInfo(c, false); });
        info.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (+b.dataset.a > 0) addN(repOf(c).id, 1); else { const id = minusId(c); if (id) addN(id, -1); } Sound.sfx('place'); showInfo(c, false); });
      };
      const setF = f => { filt = f; if (f !== 'L') try { localStorage.setItem('addTab', filt); } catch {} el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x.dataset.f === f)); draw(); };
      const qi = el.querySelector('#q'); qi.oninput = () => { q = qi.value; try { localStorage.setItem('addQ', q); } catch {} if (filt === 'L') { let f = 'all'; try { f = localStorage.getItem('addTab') || 'all'; } catch {} setF(['all', 'P', 'T', 'E'].includes(f) ? f : 'all'); } else draw(); }; // 붙여 넣기 중에 검색하면 카드 목록으로
      el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { setF(b.dataset.f); if (b.dataset.f === 'L') pp.querySelector('#paste')?.focus(); });
      draw(); if (filt === 'L') pp.querySelector('#paste')?.focus(); else if (matchMedia('(hover: hover)').matches) { qi.focus(); qi.select(); }
    });
  };
  // 리스트 내보내기: PTCGL(영어) / 한국어 글. 복사·파일 저장·공유 (고른 형식은 기억)
  const openExp = () => {
    let fmt = 'ptcgl'; try { if (localStorage.getItem('dkExp') === 'ko') fmt = 'ko'; } catch {}
    const nm = () => ((($('#dn') || {}).value || deck.name || '').trim() || '덱');
    const canShare = !!navigator.share;
    const btns = [['copy', 'copy', '복사하기', 'primary'], ['file', 'save', '파일로 저장', ''], ...(canShare ? [['share', 'share', '공유하기', '']] : [])];
    openSheet(`<button class="x sm" data-close>닫기</button><h3>리스트 내보내기</h3>
      <div class="seg2 n2 xfmt" role="group" aria-label="글 형식">${[['ptcgl', 'PTCGL 형식 (영어)'], ['ko', '한국어 형식']].map(([k, l]) => `<button type="button" class="sm" data-fmt="${k}">${l}</button>`).join('')}</div>
      <p class="small muted xnote"></p><textarea id="xout" class="xout" readonly spellcheck="false" aria-label="내보낼 덱 리스트"></textarea>
      <div class="acts bal xacts" style="--cols:${balCols(btns.map(b => b[2]), Math.min(innerWidth, 640) - 40)}">${btns.map(([k, ic, l, cls]) => `<button type="button" class="${cls}" data-x="${k}">${ICON[ic]}${l}</button>`).join('')}</div>`, el => {
      el.classList.add('xsheet');
      const out = el.querySelector('#xout'), note = el.querySelector('.xnote');
      const draw = () => {
        const r = exportDeckList(list, IDX, fmt);
        out.value = r.text;
        el.querySelectorAll('[data-fmt]').forEach(b => { b.classList.toggle('on', b.dataset.fmt === fmt); b.setAttribute('aria-pressed', b.dataset.fmt === fmt); });
        const ns = [fmt === 'ko' ? '한국어 이름과 한국판 카드 번호로 적어요. 친구에게 보내기 좋아요.' : '포켓몬 TCG 라이브(PTCGL)의 덱 가져오기에 그대로 붙여 넣을 수 있어요.', "이 사이트의 '리스트 붙여 넣기'로도 다시 불러올 수 있어요."];
        if (fmt !== 'ko' && r.krOnly.length) ns.push(`<b class="warnt">${ICON.warn}한국판에만 있는 카드(${esc(r.krOnly[0])}${r.krOnly.length > 1 ? ` 외 ${r.krOnly.length - 1}종` : ''})는 PTCGL에서 읽지 못해요.</b>`);
        if (r.total !== 60) ns.push(`<b class="warnt">${ICON.warn}지금 ${r.total}장이에요. 대전에는 60장이 필요해요.</b>`);
        note.innerHTML = ns.map(x => `<span>${x}</span>`).join(' ');
        out.style.height = ''; out.style.height = Math.min(out.scrollHeight + 4, Math.max(180, innerHeight * .46)) + 'px';
      };
      el.querySelectorAll('[data-fmt]').forEach(b => b.onclick = () => { fmt = b.dataset.fmt; try { localStorage.setItem('dkExp', fmt); } catch {} draw(); });
      out.onfocus = () => out.setSelectionRange(0, out.value.length);
      const fname = () => `${nm().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim() || '덱'} (${fmt === 'ko' ? '한국어' : 'PTCGL'}).txt`;
      const act = {
        copy: async () => {
          let ok = false;
          try { await navigator.clipboard.writeText(out.value); ok = true; } catch {}
          if (!ok) { out.focus(); out.setSelectionRange(0, out.value.length); try { ok = document.execCommand('copy'); } catch {} }
          toast(ok ? (fmt === 'ko' ? '복사했어요.' : '복사했어요. PTCGL의 덱 가져오기에 붙여 넣어 주세요.') : '복사하지 못했어요. 글을 모두 골라 직접 복사해 주세요.');
        },
        file: () => {
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.value + '\n'], { type: 'text/plain;charset=utf-8' })); a.download = fname();
          document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast(`'${fname()}' 파일로 저장했어요.`);
        },
        share: async () => { try { await navigator.share({ title: nm(), text: out.value }); } catch (e) { if (e && e.name !== 'AbortError') toast('공유하지 못했어요. 복사하기를 써 주세요.'); } },
      };
      el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { Sound.sfx('tap'); act[b.dataset.x](); });
      draw();
    });
  };
  const save = async () => {
    try { const r = await api('/api/decks', { id: deck.id, name: $('#dn').value, list }); deck.id = r.deck.id; GUARD = null; toast(r.check.ok ? '저장했어요.' : '저장했어요. 덱 규칙을 확인해 주세요.'); go('#decks'); return true; } catch (e) { toast(e.message); return false; }
  };
  const leave = async () => { // 고친 게 있으면 저장할지 먼저 물음
    if (dirty()) {
      const k = await pick('저장하지 않은 변경이 있어요', [{ label: `${ICON.check}저장하고 나가기`, value: 'save', cls: 'primary' }, { label: '저장하지 않고 나가기', value: 'drop', cls: 'bad' }, { label: '계속 고치기', value: 'stay' }]);
      if (k === 'save') return save();
      if (k !== 'drop') return false;
    }
    GUARD = null; go('#decks'); return true;
  };
  $('#back').onclick = leave;
  $('#add').onclick = () => openAdd();
  $('#cnt').onclick = () => { const ch = checkDeck(list, IDX); openSheet(`<button class="x sm" data-close>닫기</button><h3>덱 규칙</h3>${ch.ok ? '<p><span class="chip ok">덱 규칙 통과</span> 60장, 같은 이름 4장까지, 기본 포켓몬 1장 이상을 모두 지켰어요.</p>' : `<ul class="probs">${ch.problems.map(p => `<li>${ICON.warn}<span>${esc(p)}</span></li>`).join('')}</ul>`}${ch.warns.length ? `<h4 class="wh">알아 두기</h4><ul class="probs soft">${ch.warns.map(p => `<li>${ICON.warn}<span>${esc(p)}</span></li>`).join('')}</ul>` : ''}`); };
  $('#exp').onclick = () => list.length ? openExp() : toast('덱에 카드가 없어요.');
  $('#save').onclick = save;
  guardPage('한 번 더 누르면 덱 목록으로 가요', () => dirty() ? leave : null);
  drawList();
}
function cardInfoHtml(c) { // 카드를 눌렀을 때: 글자 + 작은 카드 / 카드만 크게 (표시 설정). 그림이 이미 고화질이라 '크게 보기'는 없음
  if (!c) return '<p>카드 정보가 없어요.</p>';
  const P = cardInfoParts(c);
  if (P.only) return `<div class="cardinfo only">${P.pic}</div>`;
  return `<div class="cardinfo">${P.pic}<div class="txt">${P.head}${P.body}</div></div>`;
}
// 단추가 있는 카드 창: 넓으면 [그림 | 이름 · 단추 · 설명], 세로 폰이면 [작은 그림 + 이름] 아래 단추, 그 아래 설명. 단추는 굴리지 않아도 바로 보임
function cardActHtml(c, acts, o = {}) {
  if (!c) return acts;
  const P = cardInfoParts(c), tall = innerWidth <= 640 && innerHeight > innerWidth;
  const pw = tall ? 0 : Math.round(Math.min(280, Math.max(150, (innerHeight - 70) * .716)));
  return `<div class="cact${P.only ? ' only' : ''}${tall ? ' tall' : ''}" style="${pw ? `--pw:${pw}px` : ''}">${P.pic ? `<div class="cpicw" ${o.cid ? `data-ci="${esc(o.cid)}" role="button" tabindex="0" aria-label="카드 크게 보기"` : ''}>${P.pic}</div>` : ''}
    <div class="chead">${P.only ? P.head.split('</h3>')[0] + '</h3>' : P.head}${o.head || ''}</div><div class="cacts">${acts}</div><div class="cbody">${o.top || ''}${P.only ? '' : P.body}</div></div>`;
}
const cactW = () => innerWidth <= 640 && innerHeight > innerWidth ? innerWidth - 40 : Math.min(innerWidth - 24, 920) - Math.round(Math.min(280, Math.max(150, (innerHeight - 70) * .716))) - 60; // 단추 칸 너비 (줄 나누기 계산용)
function cardInfoParts(c) {
  const en = D.dtext === 'en' && !c.kro, alt = s2 => D.dtext === 'both' && s2 ? `<small class="alt">${esc(s2)}</small>` : '';
  const pic = picMode(c, D.dimg) ? `<div class="big"><span class="cpic">${picHtml(c, D.dimg, D.ddet === 'card')}</span></div>` : '';
  const cost = cs => (cs || []).map(t => typeIcon(t, 'ecost', `title="${TYPE_KO[t] || t}"`)).join('');
  const L = en ? { ab: 'Ability', w: 'Weakness', r: 'Resistance', rt: 'Retreat', reg: 'Regulation' } : { ab: '특성', w: '약점', r: '저항력', rt: '후퇴', reg: '레귤레이션' };
  const tyName = t => en ? t : TYPE_KO[t] || t;
  const setLine = en || !c.kset ? `${c.set || ''} ${cardNo(c) || ''}` : `${c.kset} ${c.kno || ''}`;
  const head = `<h3>${esc(en ? c.n + sideEn(c) : cnameKo(c))}${alt(c.kro ? '' : c.n !== cnameKo(c) ? c.n + sideEn(c) : '')}</h3><div class="small muted">${c.kro ? '한국판 카드 · ' : ''}${esc(setLine)} · ${L.reg} ${esc(c.rm || '')}${c.kra && !en ? ` · ${esc(c.kra)}` : ''}</div>
    <div class="row" style="margin:4px 0">${c.side ? `<span class="chip warn">${en ? 'Play with both halves' : '좌측·우측 2장을 함께 내요'}</span>` : ''}${(c.sub || []).map(x => `<span class="chip">${esc(x)}</span>`).join('')}${c.hp ? `<span class="chip">HP ${c.hp}</span>` : ''}${(c.ty || []).map(t => `<span class="chip">${esc(tyName(t))}</span>`).join('')}</div>`;
  const body = `${(c.ab || []).map((a, i) => { const k = en ? a : (c.kab || [])[i] || a; return `<div class="atk"><b>${L.ab} ${esc(k.n)}</b>${alt(en ? '' : a.n !== k.n ? a.n : '')}<div>${esc(k.t)}</div></div>`; }).join('')}
    ${(c.at || []).map((a, i) => { const k = en ? a : (c.kat || [])[i] || a; return `<div class="atk"><b>${cost(a.c)} ${esc(k.n)} ${esc(a.d || '')}</b>${alt(en ? '' : a.n !== k.n ? a.n : '')}<div>${esc(k.t || '')}</div></div>`; }).join('')}
    ${((en ? c.r : c.kr || c.r) || []).map(t => `<div class="small muted atk">${esc(t)}</div>`).join('')}
    ${c.st === 'P' ? `<div class="small atk">${L.w} ${(c.wk || []).map(tyName).join(', ') || '—'} · ${L.r} ${(c.rs || []).map(r => tyName(r[0]) + ' ' + r[1]).join(', ') || '—'} · ${L.rt} ${c.rt || 0}</div>` : ''}
    ${c.kn || en ? '' : '<div class="small muted atk">이 카드는 아직 한글 자료와 연결되지 않아 영문으로 보여요.</div>'}`;
  return { pic, head, body, only: !!(D.ddet === 'card' && pic) };
}

// ---------- 대전 ----------
let G = null; // { id, view, lines, cards, ws, pend:{}, specs, ui }
function cinfo(cid) { // 판에 저장된 카드 정보 + 지금 카드 자료의 한글 이름·그림·문장
  const base = (G && G.cards[cid]) || (IDX && IDX.byId[cid]) || { n: '?' };
  const cur = IDX && IDX.byId[cid];
  return cur && cur.kn ? { ...base, kn: cur.kn, kimg: cur.kimg, kab: cur.kab, kat: cur.kat, kr: cur.kr, kra: cur.kra, ksa: cur.ksa, kmix: cur.kmix, kmr: cur.kmr, kset: cur.kset, kno: cur.kno, side: cur.side, pair: cur.pair } : base; // 한글은 항상 지금 자료 우선
}
const nmOf = x => x ? cname(cinfo(x.c)) : '?';
const PRE = new Set();
function preloadPics(cards) { // 판을 열면 두 덱 카드 그림을 미리 받아 둔다 (영문 그림 서버는 장당 0.5~0.7초라 처음 놓을 때 늦게 뜸)
  for (const cid of Object.keys(cards || {})) {
    const c = cinfo(cid), m = picMode(c, D.dimg); if (!m) continue;
    for (const u of m === 'mix' ? [c.kmix || c.kimg, c.img] : [m === 'kr' ? c.kimg : c.img]) {
      if (!u || PRE.has(u)) continue; PRE.add(u);
      const im = new Image(); im.referrerPolicy = 'no-referrer'; im.fetchPriority = 'low'; im.decoding = 'async'; im.src = u;
    }
  }
}
const topOf = sl => sl.cards[sl.cards.length - 1];

const TYPE_CH = { Grass: '풀', Fire: '불', Water: '물', Lightning: '번', Psychic: '초', Fighting: '격', Darkness: '악', Metal: '강', Dragon: '드', Colorless: '무' };

function renderGame(id) {
  loadCards().then(() => { if (G && G.view && G.id === id) draw([]); }).catch(() => {});
  G = { id, view: null, lines: [], cards: {}, pend: {}, seq: 1, specs: [], ui: { tab: 'log', dockMode: 'auto', dockSig: '' }, prev: null };
  app.innerHTML = '<div class="arena-loading"><div class="spin-ball"></div><p>판에 연결하는 중…</p></div>';
  document.body.classList.add('in-game');
  let closed = false, retry = 0;
  const connect = () => {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/game/' + id);
    G.ws = ws;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'full') { const first = !G.view; G.view = m.view; G.lines = m.lines; G.cards = m.cards; if (m.specs) G.specs = m.specs; if (m.schat) G.specChat = m.schat; if (m.room) G.room = m.room; draw(first ? [] : null); if (first) preloadPics(m.cards);
        if (first && m.room && m.view.me == null && m.view.phase !== 'over') api(`/api/rooms/${m.room}/follow`).then(r => { G.follow = !!r.follow; if (G.view) draw([]); }).catch(() => {}); }
      else if (m.t === 'upd') { const was = G.view?.phase; G.view = m.view; G.lines.push(...m.lines); draw(m.lines); if (was !== 'over' && m.view.phase === 'over') ws.send(JSON.stringify({ t: 'specView', on: true })); } // 판이 끝나면 선수도 관전자 채팅을 봄
      else if (m.t === 'specs') { G.specs = m.specs; drawSpecs(); }
      else if (m.t === 'spec') { (G.specChat ||= []).push({ name: m.name, text: m.text, t: m.ts }); drawSide(); if (m.name !== ME?.name) Sound.sfx('chat'); }
      else if (m.t === 'specHist') { G.specChat = m.list || []; drawSide(); }
      else if (m.t === 'res') { const p = G.pend[m.id]; if (p) { delete G.pend[m.id]; p(m); } }
      else if (m.t === 'gone') { closed = true; toast('관리자가 이 판을 지웠어요.'); location.hash = '#lobby'; }
    };
    ws.onopen = () => { retry = 0; sendVis(); if (specOn()) ws.send(JSON.stringify({ t: 'specView', on: true })); }; // 선수가 '대전 중에도 관전자 채팅 보기'를 켰으면
    ws.onclose = () => { if (!closed) setTimeout(connect, Math.min(8000, 500 * 2 ** retry++)); };
  };
  const sendVis = () => { try { G.ws.readyState === 1 && G.ws.send(JSON.stringify({ t: 'vis', v: document.hidden ? 0 : 1 })); } catch {} };
  connect();
  document.addEventListener('visibilitychange', sendVis);
  const dockOut = e => { // 판정 창 바깥을 누르면 창만 접음 (누른 곳의 동작은 하지 않음). 손패는 그대로 눌림 (준비 때 '손패를 눌러 놓아 주세요' 안내가 떠 있으므로)
    const d = document.querySelector('.arena .dock'); if (!d || !$('#sheet').hidden || e.target.closest('.dock, .dockfab, #sheet, #toast, .handbar')) return;
    const zt = e.target.closest('[data-zone]'), me = meSeat(), lk = me != null && G.view?.p[me].look; if (zt && lk && lk.z === zt.dataset.zone && lk.p === +zt.dataset.p) return; // 보던 덱·손패를 다시 누르면 바로 크게 보기
    e.preventDefault(); e.stopPropagation(); G.ui.dockMode = 'shut'; draw([]);
  };
  app.addEventListener('click', dockOut, true);
  guardPage('한 번 더 누르면 대전에서 나가요. 대전은 그대로 이어져요');
  const ping = setInterval(() => { try { G.ws.readyState === 1 && G.ws.send('{"t":"ping"}'); } catch {} }, 25000);
  leaveGame = () => { closed = true; clearInterval(ping); document.removeEventListener('visibilitychange', sendVis); app.removeEventListener('click', dockOut, true); if (G.rw) { clearTimeout(G.rw.timer); G.rw = null; } try { G.ws.close(); } catch {} document.body.classList.remove('in-game'); };
}
function send(a) {
  const pre = a.force ? null : fxPrep(a); // 카드 효과 도우미: 쓰기 직전 카드 글 (경고 뒤 '그대로 진행'이면 그때 시작)
  return new Promise(res => {
    const id = G.seq++; G.pend[id] = res;
    G.ws.send(JSON.stringify({ t: 'act', id, a }));
  }).then(async r => {
    if (r.ok) { if (pre) setTimeout(() => fxAfter(pre), 0); return true; }
    if (r.warn) {
      const f = await ask('이렇게 할까요?', `<p>기본 룰과 다른 점이 있어요.</p><ul>${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul><p class="small muted">카드 효과 때문이라면 그대로 진행하세요. 기록에 <span class="chip judge">사람 판정</span>으로 남고 상대가 확인해요.</p><label class="h">설명 (선택)</label><input name="note" maxlength="100" style="width:100%" placeholder="예: 특성으로 에너지 한 장 더">`, '그대로 진행', 'judge');
      if (!f) return false;
      const ok = await send({ ...a, force: true, note: f.note || a.note });
      if (ok && pre) setTimeout(() => fxAfter(pre), 0);
      return ok;
    }
    toast(r.err || '할 수 없어요.'); return false;
  });
}
const meSeat = () => G.view.me;
const oppSeat = () => G.view.me == null ? 1 : 1 - G.view.me;
const bottomSeat = () => G.view.me == null ? 0 : G.view.me;

// ----- 카드 한 장 -----
function cardFace(x, cls = '', extra = '', over = null) { // over: 판 위 포켓몬의 이름·HP 알약 (있으면 영문 그림 이름표 대신)
  const c = cinfo(x.c), m = picMode(c, D.dimg);
  const tag = over != null ? over : m === 'en' && c.kn && D.dtext !== 'en' ? `<span class="kn" style="--len:${[...c.kn].length}">${esc(c.kn)}</span>` : ''; // 영문 그림 위 한글 이름표
  return `<div class="pc ${cls}" data-k="${x.i}" ${extra}>${m ? picHtml(c, D.dimg) + tag : `<div class="ph">${esc(cname(c))}</div>${over || ''}`}</div>`;
}
const cardBack = (cls = '', extra = '') => `<div class="pc back ${cls}" ${extra}><div class="cb"></div></div>`;
// 타입 아이콘 (자체 그림): 색 동그라미 + 흰 기호. HP 알약·붙은 에너지·기술 비용에 같이 씀
const TYPE_PATH = {
  Grass: 'M19.6 3.6C11.4 3.3 5.6 7.2 5.6 13.4c0 1.6.4 3 1.2 4.2l-2.5 2.6 1.4 1.3 2.5-2.6c1.2.8 2.6 1.2 4.1 1.2 6 0 8-7.6 7.3-16.5Zm-3 3.2c-1.6 3.8-4 6.9-7.6 9.4l-.8-.9c3.4-2.4 5.9-5.2 8.4-8.5Z',
  Fire: 'M12.2 2.4c.6 3.1 4 5 5.2 8.6 1.4 4.3-1.3 9.6-5.4 9.6-4.3 0-6.9-3-5.8-7.3.6-2.2 2-3.2 2.7-5.2.5 1.6.3 3.2 1.3 4.2.8-3.3-.2-6.4 2-9.9Z',
  Water: 'M12 2.6c3.5 4.7 6.5 8.4 6.5 11.9a6.5 6.5 0 0 1-13 0c0-3.5 3-7.2 6.5-11.9Zm-3.4 11.6a3.7 3.7 0 0 0 3.2 3.9l.3-1.5a2.2 2.2 0 0 1-1.9-2.3Z',
  Lightning: 'M13.8 2 5.4 13.6h5.3L9.6 22l9-12.1h-5.4L13.8 2Z',
  Psychic: 'M12 5.8c-5 0-8.5 3.4-9.9 6.2 1.4 2.8 4.9 6.2 9.9 6.2s8.5-3.4 9.9-6.2C20.5 9.2 17 5.8 12 5.8Zm0 2.6a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Zm0 2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
  Fighting: 'M6.4 9.4c0-1 .8-1.9 1.9-1.9.4 0 .8.1 1.1.4.3-.8 1-1.4 1.9-1.4.6 0 1.1.3 1.5.7.3-.7 1-1.1 1.8-1.1.9 0 1.7.7 1.9 1.5.3-.2.6-.3 1-.3 1 0 1.9.8 1.9 1.9v5.2c0 3.6-2.7 6.3-6.2 6.3h-1.4c-3 0-5.4-2.4-5.4-5.4V9.4Zm.9 3.7v1.5h4.2c.5 0 .9.4.9.9v.6h1.5v-.6c0-1.3-1.1-2.4-2.4-2.4H7.3Z',
  Darkness: 'M15.2 2.9a9 9 0 1 0 5.9 12.4A7.2 7.2 0 0 1 15.2 2.9Z',
  Metal: 'M12 2.4l8.4 4.8v9.6L12 21.6l-8.4-4.8V7.2L12 2.4Zm0 5.9a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z',
  Dragon: 'M4.6 19.6c3.6-1.1 6.1-3.7 7.1-7.7 1-3.9 3.8-6.6 7.8-7.2-2 1.7-3.1 3.7-3.3 6.2 2.1-.6 3.5-.3 4.4.4-2.7.4-4.6 1.9-5.6 4.2-1.5 3.6-5.2 5.6-10.4 4.1Z',
  Colorless: 'M12 2.4c.8 4.8 3 7 9.6 9.6-6.6 2.6-8.8 4.8-9.6 9.6-.8-4.8-3-7-9.6-9.6 6.6-2.6 8.8-4.8 9.6-9.6Z',
  Special: 'M12 3.4l2.4 5.4 5.9.6-4.4 3.9 1.3 5.8L12 16.1l-5.2 3 1.3-5.8-4.4-3.9 5.9-.6L12 3.4Z',
};
const TOOL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.6 6.4l-3.3 3.3-2.5-.6-.6-2.5 3.3-3.3a5.2 5.2 0 0 0-6.6 6.5L3.4 17.3a2.1 2.1 0 0 0 3 3l7.5-7.5a5.2 5.2 0 0 0 6.7-6.4Z"/></svg>';
const typeIcon = (t, cls = '', extra = '') => { const k = TYPE_PATH[t] ? t : 'Special', dark = k === 'Lightning' || k === 'Colorless';
  return `<i class="ty ${cls}${dark ? ' dk' : ''}" style="--tc:${TYPE_COLOR[k] || '#b58cff'}" ${extra}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${TYPE_PATH[k]}"/></svg></i>`; };
function energyTabs(sl) { // 붙은 에너지: 카드 왼쪽 아래에 타입 아이콘이 나란히 (많으면 겹쳐서)
  const n = sl.en.length; if (!n) return '';
  return `<div class="enrow" style="--n:${n}">${sl.en.map(x => { const e = cinfo(x.c); const ty = (e.n.match(/Basic (\w+) Energy/) || [])[1]; return typeIcon(ty || 'Special', 'en', `data-k="${x.i}" title="${esc(cname(e))}"`); }).join('')}</div>`;
}
function abUsedOf(sid, k = null) { // 이번 차례에 이 포켓몬의 특성을 썼는지 (차례인 사람 것만: 차례가 바뀌면 사라짐)
  const v = G.view; if (!v || v.phase !== 'play' || v.current == null) return false;
  const u = v.p[v.current]?.used?.ab || []; return u.some(x => k == null ? x.startsWith(sid + ':') : x === `${sid}:${k}`);
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
  const abUsed = abUsedOf(sl.sid);
  const marks = [abUsed ? `<b class="mk abu" title="이번 차례에 특성을 썼어요">${ICON.check}특성 사용</b>` : '', cd.poisoned ? '<b class="mk poison">독</b>' : '', cd.burned ? '<b class="mk burn">화상</b>' : '', cd.asleep ? '<b class="mk sleep">잠듦</b>' : '', cd.paralyzed ? '<b class="mk para">마비</b>' : '', cd.confused ? '<b class="mk conf">혼란</b>' : ''].join('');
  const under = sl.cards.length > 1 ? sl.cards.slice(0, -1).map((x, i) => `<div class="pc under" data-k="${x.i}" style="--u:${sl.cards.length - 1 - i}"></div>`).join('') : '';
  // 이름 상자 없이: 오른쪽 위 남은 체력 판(이름 줄 높이, 시안 A) + 왼쪽 아래 안쪽 에너지 받침. 데미지는 남은 HP로 보여요 (HP를 모르는 카드만 데미지 배지)
  const hp = c.hp ? `<span class="hpb ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" title="남은 체력 ${hpLeft} / ${c.hp}"><small>HP</small><b>${hpLeft}</b>${(c.ty || [])[0] ? typeIcon(c.ty[0]) : ''}</span>` : '';
  return `<div class="spot ${size} filled" data-sid="${sl.sid}">
    <div class="rotwrap ${rot}">${under}${cardFace(t, 'onfield', '', '')}${hp}${energyTabs(sl)}
      ${sl.dmg && !c.hp ? `<span class="dmg" data-dmg="${sl.sid}">${sl.dmg}</span>` : ''}
      ${sl.tl.length ? `<div class="tools" style="--tn:${sl.tl.length}">${sl.tl.map((x, i) => `<button type="button" class="tlc" data-tool="${x.i}" style="--ti:${i}" aria-label="붙은 도구 ${esc(nmOf(x))} 보기" title="도구: ${esc(nmOf(x))}">${cardFace(x, 'tlpc')}</button>`).join('')}</div>` : ''}
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
const USES = [['energy', 'bolt', '에너지'], ['supporter', 'user', '서포트'], ['retreat', 'retreat', '후퇴'], ['attack', 'battle', '기술']];
const USE_LONG = { energy: '손패의 에너지 붙이기', supporter: '서포트 카드 쓰기', retreat: '후퇴하기', attack: '기술 쓰기' };
function openUses() { // 막대 가운데 작은 그림 4개 = 한 차례에 한 번만 할 수 있는 것. 한 것은 초록
  const v = G.view; if (v.phase !== 'play') return; const P = v.p[v.current], U = P.used || {};
  openSheet(`<button class="x sm" data-close>닫기</button><h3>이번 차례에 한 것</h3>
    <p class="small muted" style="margin-top:0">${esc(P.name)} 님 차례예요. 한 차례에 한 번만 할 수 있는 것들이고, 한 것은 초록으로 칠해져요. 기술을 쓰면 차례가 끝나요.</p>
    <ul class="uselist">${USES.map(([k, ic]) => `<li class="${U[k] ? 'done' : ''}"><i>${ICON[ic]}</i><b>${USE_LONG[k]}</b><span>${U[k] ? `${ICON.check}했어요` : '아직'}</span></li>`).join('')}</ul>`);
}
function areaHtml(p, isBottom) {
  const v = G.view, P = v.p[p];
  const now = v.phase === 'play' && v.current === p;
  const state = v.phase === 'setup' ? `<b class="zst ${P.ready ? 'ok' : ''}">${P.ready ? '준비 완료' : '준비 중'}</b>` : '';
  // 이름표와 '이번 차례에 쓴 것'은 벤치 칸 테두리에 걸쳐서 (가로 화면은 이름표 왼쪽·쓴 것 오른쪽, 세로 화면은 나란히)
  const nowc = now ? `<b class="zst nowc">${p === v.me ? '내 차례' : '차례'}</b>` : ''; // 누구 차례인지: 이름표 옆 칩 + 그 사람 판 쪽 빛나는 테두리(.area.now)
  const tag = `<div class="ztags"><span class="ztag ${isBottom ? 'me' : 'opp'} ${now ? 'turn' : ''}"><span class="zn">${esc(P.name)}</span></span>${nowc}${state}${v.phase === 'setup' && P.mull ? `<b class="zst">멀리건 ${P.mull}</b>` : ''}</div>`; // 이름만 꾸민 상자에, 준비 상태는 옆에 따로
  return `<section class="area ${isBottom ? 'bottom' : 'top'} ${now ? 'now' : ''}" data-area="${p}">
      <div class="g-pz zone">${prizesHtml(p)}</div>
      <div class="g-act">${slotHtml(P.active, { active: true })}</div>
      <div class="g-pile zone">${pilesHtml(p)}</div>
      <div class="g-bench zone">${tag}<div class="benchrow">${P.bench.map(b => slotHtml(b)).join('')}</div>${P.bench.length ? '' : '<span class="bempty">벤치</span>'}</div>
    </section>`;
}
function handHtml(p) { // 내 손패: 아래쪽 일자 줄 (위쪽만 보이고, 누르면 올라옴). 볼 수 없는 손패는 뒷면
  const P = G.view.p[p], n = P.hand ? P.hand.length : P.handN, mine = G.view.me === p;
  if (!P.hand) return `<div class="handbar peek backs"><div class="fan" style="--n:${Math.min(n, 15)}">${Array.from({ length: Math.min(n, 15) }, (_, i) => cardBack('inhand', `style="--i:${i}"`)).join('')}</div></div>`;
  const turn = mine && G.view.phase === 'play' && G.view.current === p && !G.rw ? ' myturn' : ''; // 내 차례: 손패가 빛남
  return `<div class="handbar ${mine ? '' : 'peek'}${turn}"><div class="fan" style="--n:${n}">${P.hand.map((x, i) => cardFace(x, 'inhand', `${mine ? `data-hand="${x.i}"` : ''} style="--i:${i}"`)).join('') || '<span class="nohand">손패 없음</span>'}</div></div>`;
}
function oppHandHtml(p) { // 상대 손패: 맨 위에 뒷면이 살짝 보임
  const P = G.view.p[p], n = P.hand ? P.hand.length : P.handN;
  const cards = P.hand ? P.hand.map((x, i) => cardFace(x, 'oh', `style="--i:${i}"`)).join('') : Array.from({ length: Math.min(n, 30) }, (_, i) => cardBack('oh', `style="--i:${i}"`)).join('');
  return `<div class="ohand" data-zone="hand" data-p="${p}" title="상대 손패 ${n}장" style="--n:${Math.min(n, 30)}"><div class="ofan">${cards}</div></div>`;
}
function midHtml(readOnly) {
  const v = G.view;
  const stadium = v.stadium ? `<div class="stadium${v.stadium.two ? ' two' : ''}" data-stadium="1">${v.stadium.two ? cardFace(v.stadium, 'stad') + cardFace(v.stadium.two, 'stad') : cardFace(v.stadium, 'stad')}</div>` /* 짝 카드: 좌측·우측 나란히 */ : '<div class="stadium none" title="스타디움 없음"><span>스타디움</span></div>';
  return `<div class="fieldline">${stadium}</div>`;
}
const fmtShort = ms => { if (ms <= 0) return '지남'; const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간` : m >= 1 ? `${m}분` : '곧'; };
function rbarHtml(readOnly) { // 오른쪽 세로 막대: 위 사람 남은 사이드(빨강) · 차례/남은 시간 · 아래 사람 남은 사이드(파랑)
  const v = G.view, bs = bottomSeat(), os = 1 - bs;
  const cur = v.phase === 'play' ? (v.current === bs ? 'me' : 'opp') : '';
  const U = v.phase === 'play' ? v.p[v.current].used : null; // 세로 화면: 이번 차례에 쓴 것(에너지·서포트·후퇴·기술)을 막대 가운데에 작게
  const cu = U ? `<span class="cuses" title="이번 차례에 한 것 (누르면 설명)">${USES.map(([k, ic, l]) => `<i class="${U[k] ? 'done' : ''}" title="${l} ${U[k] ? '(썼어요)' : '(아직)'}">${ICON[ic]}</i>`).join('')}</span>` : '';
  const mid = v.phase === 'setup' ? '<b>준비</b>' : v.phase === 'over' ? '<b>끝</b>' : `<small>${v.turn}번째</small>${v.deadline ? `<b data-dls="${v.deadline}" title="${fmtLeft(v.deadline - Date.now())}">${fmtShort(v.deadline - Date.now())}</b>` : '<b>차례</b>'}${cu}`;
  return `<div class="rbar">
    <div class="pzc opp" title="${esc(v.p[os].name)} 님 남은 사이드"><b>${v.p[os].prizesN}</b></div>
    <div class="clock ${cur}" title="${v.deadline ? '이번 결정까지 남은 시간' : ''}"${U ? ' data-uses role="button" tabindex="0" aria-label="이번 차례에 한 것 보기"' : ''}>${mid}</div>
    <div class="pzc me" title="${esc(v.p[bs].name)} 님 남은 사이드"><b>${v.p[bs].prizesN}</b></div>
    </div>`;
}
// 오른쪽 둥근 버튼: 볼 줄무늬 링 (시안 6-약). 가만히 있어도 옅은 파동, 마우스를 올리면 살짝 갸웃, 누르면 가운데 단추가 빛나요.
const FAB_ICON = {
  log: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.5V8h3.5L14 4.5ZM8 11v1.8h8V11H8Zm0 3.5v1.8h8v-1.8H8Zm0-7V9h4V7.5H8Z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.7" fill="none" stroke="currentColor" stroke-width="2.3"/><path fill="currentColor" d="M12 6.9l1.55 3.15 3.45.5-2.5 2.44.59 3.44L12 14.8l-3.09 1.63.59-3.44L7 10.55l3.45-.5z"/></svg>',
  hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3.5a1.3 1.3 0 0 1 2.6 0V11h.6V2.6a1.3 1.3 0 0 1 2.6 0V11h.6V4.2a1.3 1.3 0 0 1 2.6 0v9.6c0 4-2.7 7.2-6.6 7.2-2.4 0-4-1.2-5.3-3.1l-3-4.6a1.4 1.4 0 0 1 2.3-1.6L9 14V3.5Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="2.3" fill="currentColor"/><circle cx="12" cy="12" r="2.3" fill="currentColor"/><circle cx="18.5" cy="12" r="2.3" fill="currentColor"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 2.5h1.8v19H5v-19Zm2.8 1h11.4l-2.6 4.4 2.6 4.4H7.8V3.5Z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M8.1 2.4h7.8l5.7 5.7v7.8l-5.7 5.7H8.1l-5.7-5.7V8.1zM9 7.6v8.8h2.3V7.6zm3.7 0v8.8H15V7.6z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.4c-4 0-7 2.9-7 7v4.2l-1.8 3.1v1.4h17.6v-1.4L19 13.6V9.4c0-4.1-3-7-7-7Zm-2.7 17.2a2.8 2.8 0 0 0 5.4 0Z"/></svg>',
  rwprev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.5 5.2v13.6L6.3 12z"/></svg>',
  rwnext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.5 5.2v13.6L17.7 12z"/></svg>',
  rwfirst: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.2 5.2h2.4v13.6H5.2zM19 5.2v13.6L9 12z"/></svg>',
  rwlast: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 5.2h2.4v13.6h-2.4zM5 5.2v13.6L15 12z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 4.6v14.8L19.6 12z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.3 5h4v14h-4zM13.7 5h4v14h-4z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.9 1.9 11.6l1.4 1.6 1.9-1.6V20a1.2 1.2 0 0 0 1.2 1.2h4.1v-6.1h3v6.1h4.1a1.2 1.2 0 0 0 1.2-1.2v-8.4l1.9 1.6 1.4-1.6Z"/></svg>',
  rewatch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M4.6 12a7.4 7.4 0 1 0 2.3-5.4"/><path fill="currentColor" d="M3.4 3.4v6h6z"/><path fill="currentColor" d="M10.2 8.4v7.2l5.8-3.6z"/></svg>',
};
const FAB_FX = '<i class="fx f1"></i><i class="fx f3"></i><i class="fx f4"></i>';
// 판·리플레이 왼쪽 위에 늘 있는 '로비' 단추 (한 번에 나감)
const lobbyBtn = () => `<a class="fabw golobby" href="#lobby" aria-label="로비로 나가기"><span class="fab k-home">${FAB_FX}<span class="core">${FAB_ICON.home}</span></span><span class="fl">로비</span></a>`;
const fabBtn = (t, ic, l, k, extra = '') => `<div class="fabw"><button class="fab ${k}" data-t="${t}" aria-label="${l}">${FAB_FX}<span class="core">${FAB_ICON[ic]}</span>${extra}</button><span class="fl">${l}</span></div>`;
function fabHtml() { // 왼쪽: 상대 턴·코인·효과 / 오른쪽: 더 보기·남은 사이드 막대·차례 끝내기 / 오른쪽 아래: 기록
  const v = G.view, me = meSeat();
  const pend = me == null ? 0 : v.groups.filter(g => g.who !== me && g.status !== 'ok').length;
  const unread = unreadChats();
  const log = fabBtn('log', 'log', '기록', 'k-log' + (unread ? ' hasmsg' : ''), (pend ? `<i class="badge" title="확인할 판정 ${pend}개">${pend}</i>` : '') + (unread ? `<i class="cbadge" title="새 채팅 ${unread}개" aria-label="새 채팅 ${unread}개">${unread > 99 ? '99+' : unread}</i>` : '') + specBadge());
  const rwt = me == null ? null : lastOppTurn(), rwNew = rwt && !rwSeen(rwt); // 리플레이: 수가 하나라도 있으면 늘 보임, 안 본 상대 차례가 있으면 '새'
  const rw = (v.n || 0) > 0 ? `<div class="rwbtn">${fabBtn('rewatch', 'rewatch', '리플레이', 'k-rw' + (rwNew ? ' on nudge' : ''), rwNew ? '<i class="badge">새</i>' : '')}</div>` : '';
  const fol = me == null && v.phase !== 'over' && G.room && G.follow != null ? fabBtn('follow', 'bell', G.follow ? '알림 켬' : '알림 받기', 'k-fx' + (G.follow ? ' on' : '')) : ''; // 관전자: 두 사람이 차례를 끝낼 때마다 알림
  if (me == null || v.phase === 'over') return { left: rw || fol ? `<div class="lbtns">${rw}${fol}</div>` : '', log: `<div class="rbtns">${log}</div>` };
  const myTurn = v.phase === 'play' && v.current === me;
  const open = v.openGroup[me];
  const stop = fabBtn('stop', 'stop', v.stop ? '멈춤 중' : '잠깐!', 'k-stop' + (v.stop ? ' on' : '')); // 잠깐 멈추고 지적하기 (상대 차례에도)
  return { left: `<div class="lbtns">${rw}${fabBtn('coin', 'coin', '코인', 'k-coin')}${open ? fabBtn('effectEnd', 'check', '효과 끝', 'k-fx on') : fabBtn('effect', 'hand', '효과 쓰기', 'k-fx')}${stop}</div>`,
    more: fabBtn('more', 'more', '더 보기', 'k-more'), log: `<div class="rbtns">${log}</div>`,
    end: myTurn ? `<button class="fab wide endturn" data-t="endTurn">${FAB_FX}${FAB_ICON.flag}<span>차례<br>끝내기</span></button>`
      : v.phase === 'setup' && v.first != null && !v.p[me].ready ? `<button class="fab wide endturn readyb${v.p[me].active ? ' go' : ' wait'}" data-t="setupDone">${FAB_FX}${FAB_ICON.check}<span>준비<br>완료</span></button>` : '' };
}
// 소리 켜기 안내: 아무 곳이나 한 번 누르면(소리가 켜지면) 바로 없앰
['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => setTimeout(() => { if (Sound.ready()) document.querySelectorAll('.sndhint').forEach(x => x.remove()); }, 0), true));
// 누르면 버튼마다 '누를 때' 움직임을 한 번
// 누르면 통 튀는 효과 + 소리 (버튼·탭·카드)
document.addEventListener('pointerdown', e => {
  const t = e.target.closest && e.target.closest('.fab, button, .btn, #nav a, .pc.inhand, .cardgrid .c, .spot.filled, .pile, .prizes');
  if (!t) return;
  if (t.matches('.fab, button, .btn')) { t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); clearTimeout(t._pop); t._pop = setTimeout(() => t.classList.remove('pop'), 650); }
  Sound.sfx(t.classList.contains('fab') ? 'pop' : 'tap');
});
function matHtml(readOnly = false, inBox = '') { // inBox: 판 상자 안 양옆에 놓을 것 (리플레이 조작)
  const bs = bottomSeat(), os = 1 - bs, v = G.view;
  const f = readOnly ? {} : fabHtml();
  const over = v.phase === 'over' ? `<div class="overpill">${ICON.trophy}${v.winner == null ? '판 끝남' : esc(v.p[v.winner]?.name || '') + ' 승리'}</div>` : '';
  return `${oppHandHtml(os)}<div class="matwrap"><div class="matbox"><div class="mat ${readOnly ? 'ro' : ''}">${areaHtml(os, false)}${midHtml(readOnly)}${areaHtml(bs, true)}</div>
    ${over}${f.left || ''}${inBox}${readOnly ? '' : `<div class="rcol">${f.more || ''}${rbarHtml()}${f.end || ''}</div>`}</div></div>${f.log || ''}${handHtml(bs)}`;
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
    const base = getComputedStyle(el).transform, b = base && base !== 'none' ? base : ''; // 손패처럼 원래 내려가 있는 카드는 그 자리로 돌아오게
    el.animate([{ transform: `translate(${dx}px,${dy}px) ${b} scale(${sx})`, zIndex: 30 }, { transform: b || 'none', zIndex: 30 }], { duration: 480, easing: 'cubic-bezier(.25,.8,.25,1)' });
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
  if (prevView.phase !== 'over' && v.phase === 'over') banner(v.winner == null ? '판이 끝났어요' : `${v.p[v.winner]?.name} 님 승리!`, 'win', 2600);
}
function gameSounds(pv, lines) { // 새 기록 줄과 판 변화에 맞는 효과음 (한 번에 4개까지)
  const v = G.view; if (!pv) return;
  const q = [];
  let hurt = false, heal = false;
  const dm = {}; for (const p of [0, 1]) for (const sl of [pv.p[p].active, ...pv.p[p].bench]) if (sl && !sl.hidden) dm[sl.sid] = sl.dmg;
  for (const p of [0, 1]) for (const sl of [v.p[p].active, ...v.p[p].bench]) { if (!sl || sl.hidden || dm[sl.sid] == null) continue; if (sl.dmg > dm[sl.sid]) hurt = true; if (sl.dmg < dm[sl.sid]) heal = true; }
  for (const { txt: t, chat } of lines || []) {
    if (chat) continue; // 채팅 글자에 '코인' 같은 말이 있어도 카드 소리를 내지 않음
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
    else if (/교체\)/.test(t)) q.push('retreat');
    else if (/공개 —|보기 시작|봤어요/.test(t)) q.push('open');
    else if (/손패\(으\)로|손패로/.test(t)) q.push('draw');
    else if (/트래시\(으\)로|로스트존|덱 (위|아래)|벤치\(으\)로|배틀 포켓몬\(으\)로|에게$/.test(t)) q.push('place');
    else if (/걸림|회복$/.test(t)) q.push('judge');
    else if (/준비 완료|선공|후공/.test(t)) q.push('place');
  }
  // 상대(또는 관전 중 누구든)가 한 행동은 소리가 꼭 나게: 맞는 소리가 없으면 채팅은 알림, 나머지는 카드 놓는 소리 (2026-11-18 링크 님)
  const others = (lines || []).filter(l => l.k >= 0 && (v.me == null || l.who !== v.me));
  if (!q.length && others.some(l => !l.chat)) q.push('place');
  if (others.some(l => l.chat)) q.push('chat');
  if (hurt && !q.includes('attack')) q.push('damage');
  if (heal) q.push('heal');
  if (pv.phase === 'setup' && v.phase === 'play') q.push('start');
  else if (v.phase === 'play' && pv.current !== v.current) q.push(v.current === v.me ? 'turnMine' : 'turnTheirs');
  if (pv.phase !== 'over' && v.phase === 'over') q.push(v.me == null || v.winner === v.me ? 'win' : 'lose');
  [...new Set(q)].slice(0, 4).forEach((n, i) => setTimeout(() => Sound.sfx(n), i * 170));
}
// 상대(관전 중이면 누구든)가 한 행동: 바뀐 곳에 리플레이와 같은 강조 틀. 다음 행동까지 남아 있어서 비동기 판에서도 무엇을 했는지 보임
function liveMarks(pv, lines) {
  const v = G.view; if (!pv || G.rw) return;
  const others = (lines || []).filter(l => l.k >= 0 && !l.chat && (v.me == null || l.who !== v.me));
  if (!others.length) { if ((lines || []).some(l => l.k >= 0 && !l.chat)) G.ui.marks = null; else if (G.ui.marks) rwHighlight(G.ui.marks); return; } // 내 행동이면 지움, 채팅뿐이면 그대로
  G.ui.marks = rwTargets(pv, v, others, others.some(l => /^⚑/.test(l.txt)));
  rwHighlight(G.ui.marks);
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
  if (G.rw) { // 리플레이 보는 중: 판은 그대로 두고, 새로 생긴 수까지 갈 수 있게만
    const rw = G.rw; if (rw.mode !== 'game') return;
    const wasEnd = rw.k >= rw.n; rw.n = v.n ?? rw.n; rw.lines = G.lines;
    if (wasEnd && rw.k < rw.n) drawRw(false); else { const kk = app.querySelector('.vwk'); if (kk) kk.textContent = `${rw.k} / ${rw.n}수`; }
    return;
  }
  const prev = app.querySelector('.mat') ? snapRects() : null;
  const prevView = G.prev;
  const me = meSeat();
  const waitingMe = me != null && v.waiting.includes(me);
  document.title = (waitingMe ? '● 내 차례 · ' : '') + '닌포케카';
  const sndHint = !Sound.ready() && Sound.get('sfx') && !Sound.get('mute') ? `<button type="button" class="sndhint" data-sndon>${ICON.sound}눌러서 소리 켜기</button>` : ''; // 브라우저는 한 번 눌러야 소리가 남
  app.innerHTML = `<div class="arena"><div class="table">${matHtml()}${dockHtml()}<div class="hl-layer"></div></div>${lobbyBtn()}${sndHint}</div>`;
  drawSpecs(); drawSide(); bindBoard();
  app.querySelectorAll('[data-dock]').forEach(b => b.onclick = () => { G.ui.dockMode = b.dataset.dock; draw([]); });
  flip(prev); if (newLines) { effects(prevView, newLines); gameSounds(prevView, newLines); liveMarks(prevView, newLines); chatAlert(newLines); if (prevView) revealShow(newLines); }
  else if (G.ui.marks) rwHighlight(G.ui.marks, true); // 창을 열고 닫아 다시 그려도 강조 틀은 그대로 (움직임 없이)
  const sh = app.querySelector('[data-sndon]'); if (sh) sh.onclick = () => { Sound.unlock(); Sound.sfx('notify'); sh.remove(); };
  G.prev = JSON.parse(JSON.stringify(v));
  const lk = me != null && v.p[me].look, lkKey = lk ? `${lk.p}-${lk.z}-${lk.n}-${lk.bottom ? 'b' : 't'}` : '';
  if (ZV && !ZV.v) { const el = $('#sheet .zvsheet'); if (el) zvFill(el); else ZV = null; }
  if (lkKey && (lkKey !== G.ui.lookKey || G.ui.lookWant) && !$('#sheet:not([hidden]) .in')) { G.ui.lookWant = false; openZoneView({ look: 1 }); } // 덱·손패·프라이즈를 보기 시작하면(또는 다시 보기를 누르면) 바로 크게
  G.ui.lookKey = lkKey;
}
function drawSpecs() { // 관전자 수: 기록 단추 왼쪽 아래 작은 눈 표시 + 기록 화면의 '관전' 칸 이름
  const b = app.querySelector('.fab.k-log'); if (b) { b.querySelector('.specb')?.remove(); b.insertAdjacentHTML('beforeend', specBadge()); }
  const t = document.querySelector('#sheet .lgt[data-st="spec"] span'); if (t) t.textContent = specTab();
  const sl = document.querySelector('#sheet .speclist'); if (sl) sl.outerHTML = specList();
}
const specBadge = () => G.specs.length ? `<i class="specb" title="지금 관전 ${G.specs.length}명" aria-label="지금 관전 ${G.specs.length}명">${ICON.eye}${G.specs.length}</i>` : '';
const specTab = () => `관전 ${G.specs.length}명`;
const specList = () => `<div class="speclist"><b class="slh">${ICON.eye}지금 보는 사람 ${G.specs.length}명</b>${G.specs.length ? `<span class="slc">${G.specs.map(n => `<span class="spc${n === ME?.name ? ' me' : ''}">${ICON.user}${esc(n)}${n === ME?.name ? ' (나)' : ''}</span>`).join('')}</span>` : '<span class="muted">지금 관전하는 사람이 없어요.</span>'}</div>`; // 관전자 목록 (11/18 링크 님)
// 채팅 읽음: 마지막으로 본 채팅 줄 번호를 판마다 이 기기에 저장. 처음 들어온 판은 예전 채팅을 읽은 것으로
function chatSeen() {
  if (G.ui.cseen == null) { let x = null; try { x = localStorage.getItem('cs:' + G.id); } catch {} G.ui.cseen = x != null && x !== '' ? +x : Math.max(-1, ...G.lines.filter(l => l.chat).map(l => l.k)); }
  return G.ui.cseen;
}
function unreadChats() { const me = meSeat(), s = chatSeen(); return G.lines.filter(l => l.chat && l.k > s && (me == null || l.who !== me)).length; }
function markChatSeen() {
  const k = Math.max(-1, ...G.lines.filter(l => l.chat).map(l => l.k)); if (k <= chatSeen()) return;
  G.ui.cseen = k; try { localStorage.setItem('cs:' + G.id, k); } catch {}
  app.querySelectorAll('.fab .cbadge').forEach(b => b.remove()); app.querySelectorAll('.fab.hasmsg').forEach(b => b.classList.remove('hasmsg'));
  document.querySelectorAll('.chatpeek').forEach(x => x.remove());
}
// 선수가 채팅하면(시스템 줄 말고): 기록 단추가 통 튀고, 옆에 말풍선으로 4초 동안 보여 줌. 기록을 보고 있으면 바로 읽음
function chatAlert(lines) {
  const me = meSeat(), ch = (lines || []).filter(l => l.chat && l.k >= 0 && (me == null || l.who !== me)); if (!ch.length) return;
  if (document.querySelector('#sheet .lgs')?.dataset.tab === 'log') { markChatSeen(); return; }
  const b = app.querySelector('.fab.k-log'); if (!b) return;
  b.classList.remove('chatpop'); void b.offsetWidth; b.classList.add('chatpop'); clearTimeout(G.ui.popT); G.ui.popT = setTimeout(() => app.querySelector('.fab.k-log')?.classList.remove('chatpop'), 2200);
  const l = ch[ch.length - 1], nm = l.who != null ? G.view.p[l.who].name : '';
  document.querySelectorAll('.chatpeek').forEach(x => x.remove());
  const r = b.getBoundingClientRect(), pk = document.createElement('button');
  pk.type = 'button'; pk.className = 'chatpeek' + (l.who === bottomSeat() ? ' me' : ' op');
  pk.innerHTML = `<b>${ICON.chat}${esc(nm)}</b><span>${esc(l.txt)}</span>`;
  if (!$('#sheet').hidden || !r.width) pk.classList.add('top'); // 다른 창이 열려 있으면 위쪽 가운데에 보기만 (아래 단추를 가리지 않게)
  else { pk.style.right = Math.max(8, innerWidth - r.left + 10) + 'px'; pk.style.bottom = Math.max(8, innerHeight - r.bottom) + 'px'; }
  pk.onclick = () => { pk.remove(); openLog('log'); };
  document.body.appendChild(pk);
  setTimeout(() => pk.classList.add('out'), 4200); setTimeout(() => pk.remove(), 4700);
}
// ----- 확인할 것 -----
// 내가 지금 답해야 하는 것(급함)만 판 위에 크게 열고, 상대 판정 동의·상대 확인 대기 같은 건 한 줄씩 작게. 기다리는 중 안내는 작은 알약으로.
const qIcon = (ic, k = '') => `<i class="qi ${k}">${ICON[ic]}</i>`;
const Q_ICON = { ko: 'warn', prize: 'star', promote: 'user', checkup: 'check', next: 'next', win: 'trophy', deckout: 'trophy' };
function dockItems() {
  const v = G.view, me = meSeat(); if (me == null) return [];
  const out = [], nm = p => esc(v.p[p].name);
  if (v.stop) { // 잠깐 멈춤: 지적받은 사람은 되돌리기·직접 고치기·이대로 계속, 지적한 사람은 거두기
    const st = v.stop, mine = st.by === me;
    const what = st.what ? `<p class="pq stw"><span class="chip warn">지적한 행동</span><span>${esc(st.what)}</span></p>` : '', why = st.text ? `<p class="pq stw sty"><span class="chip bad">이유</span><span>${esc(st.text)}</span></p>` : '';
    const chat = `<button class="sm" data-t="log">${ICON.chat}채팅</button>`;
    out.push(mine ? { k: 'stopme', u: 1, hd: `잠깐 멈춤 · ${nm(1 - me)} 님 대답을 기다려요`, h: `<div class="prompt stopq"><div class="q">${qIcon('pause', 'warn')}판을 잠깐 멈추고 지적했어요</div>${what}${why}<p class="pq small muted">상대가 되돌리기·직접 고치기·이대로 계속 중에서 골라요. 멈춘 동안에는 둘 다 카드를 움직일 수 없어요.</p><div class="bar"><button class="sm" data-stopend="drop">${ICON.play}지적 거두고 계속</button>${chat}</div></div>` }
      : { k: 'stop' + st.at, u: 1, hd: `${nm(st.by)} 님이 판을 잠깐 멈췄어요`, h: `<div class="prompt stopq"><div class="q">${qIcon('pause', 'warn')}${nm(st.by)} 님이 지적했어요</div>${what}${why}<div class="bar">${st.to != null ? `<button class="bad sm" data-stopundo>${ICON.rewind}그 행동 전으로 되돌리기</button>` : ''}<button class="judge sm" data-stopend="fix">직접 고치고 계속</button><button class="sm" data-stopend="keep">이대로 계속</button>${chat}</div></div>` });
  }
  if (v.phase === 'setup') {
    const P = v.p[me], O = v.p[1 - me];
    if (v.first == null && v.coinWinner === me) out.push({ k: 'order', u: 1, h: `<div class="prompt"><div class="q">${qIcon('coin', 'gold')}코인에서 이겼어요! 선공·후공을 골라 주세요.</div><div class="bar"><button class="primary" data-order="1">선공</button><button data-order="0">후공</button></div></div>` });
    if (v.first == null && v.coinWinner !== me) out.push({ k: 'order-wait', info: '상대가 선공·후공을 고르는 중' });
    if (!P.ready) { // 놓는 방법은 작은 안내만 (판을 가리지 않게), 준비 완료는 오른쪽 '차례 끝내기' 자리의 큰 단추 (2026-11-18 링크 님)
      if (O.mull && !P.mullDrawn) out.push({ k: 'mull', u: 1, h: `<div class="prompt"><div class="q">${qIcon('user')}카드를 더 뽑을 수 있어요</div><div class="row mullr"><span>${nm(1 - me)} 님 첫 손패에 기본 포켓몬이 없어서 ${O.mull}번 다시 나눠 줬어요(멀리건). 그만큼 카드를 더 뽑을 수 있어요.</span> ${Array.from({ length: O.mull + 1 }, (_, n) => `<button class="sm" data-mull="${n}">${n}장</button>`).join('')}</div></div>` });
      if (v.first != null) out.push({ k: 'place', info: P.active ? '벤치도 놓았으면 오른쪽 준비 완료를 눌러 주세요' : '손패의 기본 포켓몬을 눌러 배틀 포켓몬을 놓아 주세요' });
    } else out.push({ k: 'ready-wait', info: '상대 준비를 기다리는 중' });
  }
  for (const q of v.prompts) {
    const ic = qIcon(Q_ICON[q.type] || 'check', q.type === 'ko' ? 'warn' : q.type === 'win' || q.type === 'deckout' ? 'gold' : '');
    if (q.to === me) {
      let btn;
      if (q.type === 'prize') btn = `<div class="pzpick">${Array.from({ length: v.p[me].prizesN }, (_, k) => cardBack('pick', `data-prize="${q.id}" data-k="${k}"`)).join('')}</div>`;
      else if (q.type === 'promote') btn = `<div class="bar">${v.p[me].bench.map(b => `<button class="primary sm" data-promote="${q.id}" data-sid="${b.sid}">${esc(nmOf(topOf(b)))}</button>`).join('')}</div>`;
      else btn = `<div class="bar"><button class="primary sm" data-confirm="${q.id}">${ICON.check}이대로 확정</button><button class="judge sm" data-dismiss="${q.id}">다르게 처리</button></div>`;
      out.push({ k: 'q' + q.id, u: 1, h: `<div class="prompt"><div class="q">${ic}${esc(q.text)}</div>${btn}</div>` });
    } else if (q.type === 'prize' || q.type === 'promote') out.push({ k: 'q' + q.id, info: `${nm(q.to)} 님이 ${q.type === 'prize' ? '프라이즈를' : '새 배틀 포켓몬을'} 고르는 중` });
    else out.push({ k: 'q' + q.id, row: `<div class="drow">${ic}<div class="dtx">${esc(q.text)} <span class="chip">${nm(q.to)} 님 확인</span></div><div class="dbt"><button class="primary xs" data-confirm="${q.id}">확정</button><button class="judge xs" data-dismiss="${q.id}">다르게</button></div></div>` });
  }
  const lk = v.p[me].look;
  if (lk) {
    const P = v.p[lk.p], cards = (lk.z === 'deck' ? P.deck.cards : lk.z === 'hand' ? P.hand : P.prizes) || [];
    const ttl = `${lk.p === me ? '내' : '상대'} ${({ deck: '덱', hand: '손패', prizes: '프라이즈' })[lk.z]}${lkSide(lk)} 보는 중 <span class="chip">${cards.length}장</span>`;
    const body = `<div class="lkbar"><button class="primary sm" data-zvopen>${ICON.expand}크게 보기</button><button class="sm" data-t="lookEnd">닫기</button>${lk.z === 'deck' ? '<button class="sm" data-t="shuffleMine">섞고 닫기</button>' : ''}</div>`;
    out.push({ k: 'look', u: 1, hd: ttl, hb: `<div class="prompt look">${body}</div>`, h: `<div class="prompt look"><div class="q">${qIcon('search', 'judge')}${ttl}</div>${body}</div>` }); // 맨 위 항목이면 머리줄이 곧 제목 (같은 글을 두 번 쓰지 않음)
  }
  for (const g of v.groups) {
    if (g.status === 'ok') continue;
    const theirs = g.who !== me;
    const extra = `${g.note ? `<small>${esc(g.note)}</small>` : ''}${g.disputes.length ? `<small class="dsp">이의: ${g.disputes.map(esc).join(' / ')}</small>` : ''}`;
    const stc = g.status === 'open' ? '<span class="chip">진행 중</span>' : g.status === 'disputed' ? '<span class="chip warn">이의</span>' : '<span class="chip">확인 전</span>';
    const head = `<span class="dwho">${nm(g.who)}</span>${esc(g.title)} ${stc}`;
    if (g.rewindBy != null && g.rewindBy !== me) out.push({ k: 'rw' + g.gid, u: 1, h: `<div class="prompt grp"><div class="q">${qIcon('rewind', 'warn')}${nm(g.rewindBy)} 님이 「${esc(g.title)}」 전으로 되돌리자고 해요</div>${extra}<div class="bar"><button class="bad sm" data-rwok="${g.start}">${ICON.rewind}되돌리기 동의</button><button class="sm" data-rwno="${g.gid}">거절</button></div></div>` });
    else if (g.rewindBy === me) out.push({ k: 'rwme' + g.gid, info: '되돌리기: 상대 동의를 기다리는 중' });
    else if (g.status === 'disputed' && !theirs) out.push({ k: 'dsp' + g.gid + '-' + g.disputes.length, u: 1, h: `<div class="prompt grp"><div class="q">${qIcon('judge', 'judge')}내 판정 「${esc(g.title)}」에 이의가 있어요</div>${extra}<div class="bar"><button class="bad sm" data-rwask="${g.gid}">${ICON.rewind}이 판정 전으로 되돌리자</button></div></div>` });
    else if (g.status === 'disputed') out.push({ k: 'g' + g.gid, row: `<div class="drow">${qIcon('judge', 'judge')}<div class="dtx">${head}${extra}</div><div class="dbt"><button class="bad xs" data-rwask="${g.gid}">${ICON.rewind}되돌리자</button><button class="good xs" data-agree="${g.gid}">그냥 동의</button></div></div>` });
    else if (theirs) out.push({ k: 'g' + g.gid, agree: g.status !== 'open' ? g.gid : null, row: `<div class="drow">${qIcon('judge', 'judge')}<div class="dtx">${head}${extra}</div><div class="dbt"><button class="good xs" data-agree="${g.gid}">${ICON.check}동의</button><button class="bad xs" data-dispute="${g.gid}">이의</button></div></div>` });
  }
  return out;
}
function dockHtml() {
  const items = dockItems(); if (!items.length) { G.ui.dockWas = ''; G.ui.dockRows = 0; return ''; }
  const urg = items.filter(x => x.u), rows = items.filter(x => x.row), info = items.filter(x => x.info);
  const sig = urg.map(x => x.k).join(',');
  if (sig !== G.ui.dockSig) { G.ui.dockSig = sig; G.ui.dockMode = 'auto'; }
  const open = (urg.length || rows.length) && (G.ui.dockMode === 'open' || (G.ui.dockMode === 'auto' && urg.length > 0));
  const infos = info.map(x => `<span class="dinfo">${ICON.wait}${esc(x.info)}</span>`).join('');
  const bump = rows.length > (G.ui.dockRows || 0) ? ' bump' : ''; G.ui.dockRows = rows.length;
  const enter = G.ui.dockWas !== (open ? 'open' : 'shut') ? ' enter' : ''; G.ui.dockWas = open ? 'open' : 'shut'; // 처음 나타날 때만 움직임
  if (!open) { // 접힌 상태: 다른 둥근 버튼과 같은 모양 (급함 = 주황 종, 판정 확인 = 보라 손) + 기다리는 중 알약
    const n = urg.length + rows.length, l = urg.length ? '대답하기' : '판정 확인';
    const fab = n ? `<div class="dockfab${enter}"><div class="fabw"><button class="fab k-dock ${urg.length ? 'on nudge' : 'j' + bump}" data-dock="open" aria-label="${l} ${n}개 펼치기">${FAB_FX}<span class="core">${FAB_ICON[urg.length ? 'bell' : 'hand']}</span><i class="badge">${n}</i></button><span class="fl">${l}</span></div></div>` : '';
    return fab + (infos ? `<div class="dinfos">${infos}</div>` : '');
  }
  const ag = rows.filter(x => x.agree).map(x => x.agree), top = urg.find(x => x.hd), me = meSeat();
  const hd = top ? top.hd : urg.length ? (G.view.waiting.includes(me) ? '상대가 대답을 기다려요' : '확인해 주세요') : '상대 판정 살펴보기'; // 상대가 정말 기다릴 때만 '기다려요'
  return `<div class="dock${enter}"><div class="dockin">
    <div class="dockh"><b class="dtt">${hd}</b>${infos}<button class="dockx sm" data-dock="shut">${ICON.down}접기</button></div>
    ${urg.map(x => x === top && x.hb ? x.hb : x.h).join('')}
    ${rows.length ? `<div class="drows">${urg.length || ag.length >= 2 ? `<div class="drh"><span>${urg.length ? '그 밖의 판정' : '상대 판정'} ${rows.length}</span>${ag.length >= 2 ? `<button class="good xs" data-agreeall="${ag.join(',')}">${ICON.check}모두 동의</button>` : ''}</div>` : ''}${rows.map(x => x.row).join('')}</div>` : ''}
  </div></div>`;
}
// 기록 줄 정렬 (11/18 링크 님): 내 행동·채팅은 오른쪽, 상대는 왼쪽, 확인용 줄(동의·섞기·보기)은 가운데 작게, 큰 사건(기술·기절·사이드·코인)은 가운데 크게, 관전자 채팅은 가운데 초록 말풍선
const LOG_BIG = /의 기술 「|기절|프라이즈 \d+장을 손패로|프라이즈를 모두|항복|님이 이겼어요|판을 끝냈어요|덱이 없어요|코인/;
const LOG_META = /판정에 동의했어요|경고를 넘기고 진행|덱을 섞었어요|덱을 봤어요|을\(를\) 봤어요|보던 카드를 닫았어요|보기 시작|차례를 끝냈어요|되돌리기를 거절|준비 완료/;
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
  const kindOf = (l, txt, a) => l.spec ? 'spec' : l.chat ? 'chat' : a == null ? 'sys' : LOG_BIG.test(txt) ? 'big' : LOG_META.test(txt) ? 'meta' : 'act';
  return blocks.map(b => {
    const h = b.head;
    const head = h ? `<div class="th" ${h.l ? lineHtml(h.l, null, true) : ''}><span class="tno">${esc(h.no)}번째 차례</span><span class="tnm">${esc(h.nm)}</span><span class="tdr">1장 뽑음${h.own ? ` · <span class="own">${esc(h.own)}</span>` : ''}</span></div>` : '<div class="th"><span class="tno">준비</span><span class="tnm">대전 준비</span></div>';
    return `<section class="tblk ${side(b.owner)}">${head}${b.items.map(l => { const a = l.spec ? null : actorOf(l), txt = l.spec ? l.txt : strip(l.txt, a); return lineHtml(l, { cls: 'a-' + side(a) + ' k-' + kindOf(l, txt, a) + (a != null && a === b.owner ? ' ow' : ''), txt }); }).join('')}</section>`;
  }).join('');
}
function logHtml() {
  const gs = Object.fromEntries(G.view.groups.map(g => [g.gid, g]));
  let lastG = null; // 같은 판정 묶음은 첫 줄에만 칩, 나머지는 보라 줄로만 (줄을 더 많이 보이게)
  return logBlocks(withSpec(G.lines), (l, o, headAttr) => {
    if (headAttr) return l.k >= 0 && !G.rw ? `data-vk="${l.k}" role="button" tabindex="0" title="이 차례부터 리플레이"` : '';
    if (l.spec) return `<div class="ln chat spec ${o.cls}"><b class="snm">${ICON.eye}${esc(l.name)}</b>${esc(l.txt)}</div>`;
    const g = l.gid && gs[l.gid];
    const first = l.gid !== lastG; lastG = l.gid || null;
    const st = g ? (g.status === 'ok' ? ['ok', 'check', '동의함'] : g.status === 'disputed' ? ['warn', 'warn', '이의 있음'] : ['judge', 'judge', '사람 판정 · 동의 전']) : ['judge', 'judge', '사람 판정'];
    const jc = l.gid && first ? `<i class="lj ${st[0]}" title="${st[2]}" aria-label="${st[2]}">${ICON[st[1]]}</i>` : '';
    if (l.chat) return `<div class="ln chat ${o.cls} ${l.rw ? 'rw' : ''}">${esc(l.txt)}</div>`;
    const shw = l.show && l.show.length ? `<span class="lshow">${l.show.map(c => `<button type="button" class="lsc" data-ci="${esc(c)}" aria-label="${esc(cname(cinfo(c)))} 보기">${cardFace({ i: '', c }, 'lspc')}</button>`).join('')}</span>` : ''; // 보여준 카드: 작은 그림 (누르면 크게)
    return `<div class="ln ${o.cls} ${l.gid ? 'j' : ''} ${l.rw ? 'rw' : ''}">${esc(o.txt)}${jc}${l.own ? ` <span class="own">(나만 보임: ${esc(l.own)})</span>` : ''}${shw}</div>`;
  });
}
// 관전자 채팅을 기록 사이에 시간 순서로 끼움. 관전자는 늘, 선수는 '대전 중에도 보기'를 켰거나 판이 끝났을 때만
const specOn = () => { try { return localStorage.getItem('specView') === '1'; } catch { return false; } };
const specVisible = () => meSeat() == null || specOn() || G.view?.phase === 'over';
function withSpec(lines) {
  const sc = specVisible() ? G.specChat || [] : []; if (!sc.length) return lines;
  const out = []; let i = 0; const sl = m => ({ spec: true, name: m.name, txt: m.text, t: m.t, k: -2 });
  for (const l of lines) { while (i < sc.length && l.t != null && (sc[i].t || 0) < l.t) out.push(sl(sc[i++])); out.push(l); }
  while (i < sc.length) out.push(sl(sc[i++]));
  return out;
}
// 코인 던지기: 횟수는 ▼▲ 단추로(키보드 없이), '무엇 때문에?'는 카드를 눌러서 고름 (내 포켓몬·상대 포켓몬·내 손패의 트레이너스·특수 상태)
// 카드 고르기 (코인 '무엇 때문에?'·효과 쓰기): 내 포켓몬 · 상대 포켓몬 · 손패 · 스타디움. 다시 누르면 고르기 취소
function whyPicker(opt = {}) {
  const v = G.view, me = meSeat();
  const tile = (x, sub) => { const nm = nmOf(x); return `<button type="button" class="cwc" data-why="${esc(nm)}" aria-pressed="false" title="${esc(nm)}">${cardFace(x, 'cwpc')}<span class="cwn">${esc(nm)}</span>${sub ? `<small>${sub}</small>` : ''}</button>`; };
  const slots = p => allSlots(p).map(sl => tile(topOf(sl), v.p[p].active?.sid === sl.sid ? '배틀' : '벤치')).join('');
  const hand = v.p[me].hand.filter(h => h.c && (opt.handAll || cinfo(h.c).st === 'T')).map(h => tile(h, '')).join('');
  const grp = (t, body) => body ? `<div class="cwg"><span class="cwl">${t}</span><div class="cwrow">${body}</div></div>` : '';
  return `<div class="cwhy">${grp('내 포켓몬', slots(me))}${grp('상대 포켓몬', slots(1 - me))}${grp(opt.handAll ? '내 손패' : '내 손패의 트레이너스', hand)}${grp('스타디움', v.stadium ? tile(v.stadium, '') : '')}${opt.extra || ''}</div>`;
}
function bindWhy(el, onPick) {
  el.querySelectorAll('[data-why]').forEach(b => b.onclick = () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    el.querySelectorAll('[data-why]').forEach(o => o.setAttribute('aria-pressed', 'false'));
    if (on) b.setAttribute('aria-pressed', 'true'); onPick(on ? b.dataset.why : ''); Sound.sfx('tap');
  });
}
function openCoin() {
  const me = meSeat(); if (me == null) return;
  let n = 1, why = '';
  openSheet(`<button class="x sm" data-close>닫기</button><h3>코인 던지기</h3>
    <label class="h">몇 번 던질까요?</label>
    ${stepHtml('n', 1, { min: 1, max: 20, unit: '번' })}
    <label class="h">무엇 때문에? <small class="muted">고르지 않아도 돼요</small></label>
    ${whyPicker({ extra: `<div class="cwg"><span class="cwl">특수 상태</span><div class="cwrow">${['잠듦', '혼란', '마비'].map(s => `<button type="button" class="cws" data-why="${s} 확인" aria-pressed="false">${s} 확인</button>`).join('')}</div></div>` })}
    <div class="acts1"><button class="primary" data-go>${ICON.coin}<span class="gol"></span></button></div>`, el => {
    const gol = el.querySelector('.gol'), upd = () => { gol.textContent = `${n}번 던지기${why ? ` · ${why}` : ''}`; };
    bindSteps(el, v => { n = v; upd(); });
    bindWhy(el, w => { why = w; upd(); });
    el.querySelector('[data-go]').onclick = () => { closeSheet(); send({ type: 'coin', n, why }); };
    upd();
  });
}
// 잠깐! 멈추고 지적하기: 상대가 최근에 한 행동 중 잘못된 것을 고르고(없어도 됨) 이유를 적으면 판이 멈춤
function stopOk() { const v = G.view; return !!v && meSeat() != null && v.phase === 'play' && !v.stop; }
function openStop() { if (!stopOk()) return; openLog('stop'); } // 잠깐!: 기록 화면의 '잠깐!' 칸으로 (기록을 두 번 보여 주지 않음)
function stopParts() { // 잠깐! 칸: 두 사람의 행동을 기록과 같은 모양으로, 잘못된 행동 줄을 눌러 고름. 처음엔 상대의 마지막 행동
  const me = meSeat(), op = 1 - me, txtOf = {};
  const can = l => l.k != null && l.k >= 0 && !l.chat && !l.rw && !/^(⏸|▶|↺)/.test(l.txt || '');
  let pick = null; for (const l of G.lines) if (can(l) && l.who === op) pick = l.k;
  const html = logBlocks(G.lines, (l, o, headAttr) => {
    if (headAttr) return '';
    if (l.chat) return `<div class="ln chat ${o.cls}">${esc(l.txt)}</div>`;
    const ok = can(l); if (ok) (txtOf[l.k] ||= []).push(o.txt);
    return `<div class="ln ${o.cls} ${l.gid ? 'j' : ''} ${l.rw ? 'rw' : ''}" ${ok ? `data-pk="${l.k}" role="button" tabindex="0"` : ''}>${ok ? '<i class="pkr" aria-hidden="true"></i>' : ''}<span>${esc(o.txt)}${l.own ? ` <span class="own">(나만 보임: ${esc(l.own)})</span>` : ''}</span></div>`;
  }) + `<div class="ln nopk" data-pk="none" role="button" tabindex="0"><i class="pkr" aria-hidden="true"></i><span>행동은 고르지 않고 이유만 알리기</span></div>`; // '고르지 않기'도 기록 맨 끝의 한 줄로
  return { html, txtOf, pick };
}
function bindStop(el, st) {
  let pick = st.pick;
  const lg = el.querySelector('.stoplog'), jump = el.querySelector('.stjump');
  const what = k => (st.txtOf[k] || []).join(' · ');
  const cur = () => lg.querySelector('.ln.pick');
  const where = () => { // 고른 줄이 보이는 칸 밖이면 위나 아래 가장자리에 '고른 행동' 단추 (누르면 그 줄로)
    const r = cur(); if (!r) { jump.hidden = true; return; }
    const a = r.getBoundingClientRect(), b = lg.getBoundingClientRect(), up = a.bottom < b.top + 6, down = a.top > b.bottom - 6;
    jump.hidden = !(up || down); if (jump.hidden) return;
    jump.classList.toggle('up', up); jump.classList.toggle('down', down);
    jump.innerHTML = `${up ? ICON.up : ICON.down}<span>${pick == null ? '고르지 않음' : '고른 행동'}</span>`;
  };
  const mark = () => {
    lg.querySelectorAll('[data-pk]').forEach(r => { const on = r.dataset.pk === 'none' ? pick == null : +r.dataset.pk === pick; r.classList.toggle('pick', on); r.setAttribute('aria-pressed', on); });
    where();
  };
  lg.querySelectorAll('[data-pk]').forEach(r => { const f = () => { pick = r.dataset.pk === 'none' ? null : +r.dataset.pk; mark(); }; r.onclick = f; r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } }; });
  lg.addEventListener('scroll', where, { passive: true });
  jump.onclick = () => { lg.scrollTo({ top: lg.scrollTop + cur().getBoundingClientRect().top - lg.getBoundingClientRect().top - (lg.clientHeight - cur().offsetHeight) / 2, behavior: 'smooth' }); };
  mark();
  requestAnimationFrame(() => { scrollInside(lg, cur()); where(); }); // 창 전체는 그대로, 기록 칸 안에서만 굴림
  el.querySelector('[data-stopgo]').onclick = () => { const text = el.querySelector('[name=text]').value; G.ui.tab = 'log'; closeSheet(); send({ type: 'stop', text, to: pick ?? undefined, what: pick != null ? what(pick).slice(0, 140) : undefined }); };
}
function openEffect() { // 효과 쓰기: 글자 대신 어떤 카드의 효과인지 눌러서 고름
  if (meSeat() == null) return;
  let why = '';
  openSheet(`<button class="x sm" data-close>닫기</button><h3>효과 쓰기</h3>
    <p class="small muted" style="margin-top:0">어떤 카드의 효과인가요? 지금부터 하는 카드 이동·체력 변화가 이 효과로 묶여 기록되고, 다 하면 '효과 끝'을 눌러요.</p>
    ${whyPicker({ handAll: true })}
    <div class="acts1"><button class="judge" data-go>${FAB_ICON.hand}<span class="gol">효과 시작</span></button></div>`, el => {
    const gol = el.querySelector('.gol');
    bindWhy(el, w => { why = w; gol.textContent = w ? `${w} 효과 시작` : '효과 시작'; });
    el.querySelector('[data-go]').onclick = () => { closeSheet(); send({ type: 'effect', title: why || '카드 효과' }); };
  });
}
// 기록·채팅 창: 탭·리플레이·입력칸은 옆 줄에, 기록은 창 높이 전부를 씀
function openLog(tab) { // 기록 화면: 기록·채팅 / 관전자 / 잠깐!(선수, 진행 중일 때) — 잠깐!도 같은 화면의 칸
  G.ui.tab = tab || (G.ui.tab === 'spec' ? 'spec' : 'log');
  openSheet('<div class="lgs"></div>', box => { box.classList.add('wide', 'logsheet'); drawSide(box.querySelector('.lgs')); }, () => { if (G.ui.tab === 'stop') G.ui.tab = 'log'; });
}
function drawSide(target) {
  const el = target || document.querySelector('#sheet .lgs'); if (!el || !G.view) return;
  const sOk = stopOk(), tab = G.ui.tab === 'spec' ? 'spec' : G.ui.tab === 'stop' && sOk ? 'stop' : 'log', me = meSeat(), canType = tab === 'log' || (tab === 'spec' && me == null);
  if (tab === 'stop' && el.dataset.tab === 'stop') return; // 고르는 중에는 다시 그리지 않음 (고른 줄·적던 글 그대로)
  if (tab === 'log') markChatSeen(); // 기록을 열어 두면 채팅은 읽은 것
  const specSw = () => me == null || G.view.phase === 'over' ? '' : `<button type="button" class="swb ${specOn() ? 'on' : ''}" role="switch" aria-checked="${specOn()}" data-specview><i class="swk" aria-hidden="true"></i><span>대전 중에도 관전자 채팅 보기</span></button>`;
  const logInner = () => tab === 'log' ? logHtml() || '<p class="muted">아직 기록이 없어요.</p>'
    : specList() + specSw() + (specVisible() ? (G.specChat || []).map(m => `<div class="ln chat spec"><b class="snm">${ICON.eye}${esc(m.name)}</b>${esc(m.text)}</div>`).join('') || '<p class="muted">관전자 채팅이 아직 없어요.</p>'
      : '<p class="muted">관전자 채팅은 숨겨 두었어요. 위 단추를 켜면 대전 중에도 기록에 함께 보여요.</p>');
  const lg0 = el.querySelector('.log');
  if (lg0 && el.dataset.tab === tab && el.dataset.sok === String(sOk)) { // 새 줄만 다시 그림 (입력 중인 글자는 그대로)
    const atEnd = lg0.scrollHeight - lg0.scrollTop - lg0.clientHeight < 40;
    lg0.innerHTML = logInner(); bindLog(lg0); if (atEnd) lg0.scrollTop = lg0.scrollHeight; const t0 = el.querySelector('.lgt[data-st="spec"] span'); if (t0) t0.textContent = specTab(); return;
  }
  el.dataset.tab = tab; el.dataset.sok = String(sOk);
  const st = tab === 'stop' ? stopParts() : null;
  el.innerHTML = `<nav class="lgrail" aria-label="기록 종류">
      <button type="button" class="lgx" data-close aria-label="닫기">${ICON.x}</button>
      <button type="button" class="lgt ${tab === 'log' ? 'on' : ''}" data-st="log">${ICON.chat}<span>기록·채팅</span></button>
      <button type="button" class="lgt ${tab === 'spec' ? 'on' : ''}" data-st="spec">${ICON.eye}<span>${specTab()}</span></button>
      ${sOk ? `<button type="button" class="lgt lgstop ${tab === 'stop' ? 'on' : ''}" data-st="stop">${ICON.pause}<span>잠깐!</span></button>` : ''}
      ${(G.view.n || 0) > 0 ? `<button type="button" class="lgt vwgo" data-vwgo>${ICON.rewind}<span>리플레이</span></button>` : ''}
    </nav>
    ${st ? `<div class="stlogw"><p class="small muted stoph">잘못된 행동을 눌러 고르고 이유를 적으면 판이 멈춰요. 상대가 되돌리기·직접 고치기·이대로 계속 중에서 골라요.</p><div class="log stoplog">${st.html}</div><button type="button" class="stjump" hidden></button></div>
      <div class="lgin stgo"><input name="text" maxlength="200" aria-label="무엇이 잘못됐나요?" placeholder="무엇이 잘못됐나요? 예: 에너지를 두 장 붙였어요" autocomplete="off"><button class="bad" data-stopgo>${ICON.pause}<span>멈추고 지적하기</span></button></div>`
    : `<div class="log">${logInner()}</div>
    ${canType ? `<form class="lgin"><textarea name="t" rows="2" maxlength="${me != null ? 300 : 200}" placeholder="${me != null ? '채팅 (기록에 남아요)' : '응원 한마디 (관전자 채팅)'}" enterkeyhint="send">${esc(G.ui.draft || '')}</textarea><button class="blue" aria-label="보내기">${ICON.next}<span>보내기</span></button></form>` : ''}`}`;
  el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { G.ui.tab = b.dataset.st; drawSide(el); });
  if (st) { bindStop(el, st); const vg0 = el.querySelector('[data-vwgo]'); if (vg0) vg0.onclick = () => { G.ui.tab = 'log'; closeSheet(); setTimeout(() => startRewatch(), 0); }; return; }
  const vg = el.querySelector('[data-vwgo]'); if (vg) vg.onclick = () => { closeSheet(); setTimeout(() => startRewatch(), 0); };
  const lg = el.querySelector('.log'); bindLog(lg); lg.scrollTop = lg.scrollHeight;
  const f = el.querySelector('.lgin'); if (!f) return;
  const ta = f.t, sendIt = () => {
    const t = ta.value.trim(); if (!t) return;
    if (me != null) send({ type: 'chat', text: t }); else G.ws.send(JSON.stringify({ t: 'specChat', text: t }));
    ta.value = ''; G.ui.draft = '';
  };
  ta.oninput = () => { G.ui.draft = ta.value; };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendIt(); } }; // Enter 보내기, Shift+Enter 줄바꿈
  f.onsubmit = e => { e.preventDefault(); sendIt(); ta.focus(); };
}
function bindLog(lg) { // 차례 머리를 누르면 그 차례부터 리플레이
  const sw = lg.querySelector('[data-specview]'); if (sw) sw.onclick = () => { const on = !specOn(); try { localStorage.setItem('specView', on ? '1' : '0'); } catch {} G.ws?.send(JSON.stringify({ t: 'specView', on })); drawSide(); };
  lg.querySelectorAll('[data-vk]').forEach(h => h.onclick = () => { const k = +h.dataset.vk; closeSheet(); setTimeout(() => startRewatch({ k }), 0); });
  bindCardPeek(lg); // 보여준 카드 작은 그림
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
const moveOpts = me => [
  { label: '손패로', value: { z: 'hand', p: me }, cls: 'primary' }, { label: '트래시로', value: { z: 'discard', p: me } },
  { label: '덱 위로', value: { z: 'deck', p: me, pos: 'top' } }, { label: '덱 아래로', value: { z: 'deck', p: me, pos: 'bottom' } },
  { label: '벤치에 내기', value: { z: 'bench', p: me } }, { label: '포켓몬에게 붙이기', value: 'attach' },
  { label: '로스트존으로', value: { z: 'lost', p: me } }, { label: '프라이즈로', value: { z: 'prizes', p: me } }, { label: '공개하기', value: 'reveal' },
];
async function moveMenu(iids, label) {
  const to = await pick(`${label} 옮기기`, moveOpts(meSeat()).map(o => ({ ...o, cls: '' })));
  if (to) doMove(iids, to);
}
async function doMove(iids, to, extra = {}) {
  const me = meSeat();
  if (to === 'reveal') return send({ type: 'reveal', iids });
  if (to === 'attach') { const sid = await pickSlot('어느 포켓몬에게?', [me, 1 - me]); if (!sid) return; const part = (await pick('무엇으로 붙일까요?', [{ label: '에너지로', value: 'en' }, { label: '도구로', value: 'tl' }, { label: '진화 카드로 (위에 겹치기)', value: 'cards' }])); if (!part) return; return send({ type: 'move', iids, to: { z: 'slot', sid, part } }); }
  return send({ type: 'move', iids, to, ...extra });
}
// PC 마우스 휠로 가로 줄도 굴리기: 세로로 굴릴 곳이 먼저 없고, 가로로 넘치는 칸이면 휠을 가로로 바꿈. 끝에 닿으면 바깥이 굴러감
addEventListener('wheel', e => {
  if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
  for (let el = e.target; el && el.nodeType === 1 && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (/auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return;
    if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) {
      const d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? el.clientWidth : 1), max = el.scrollWidth - el.clientWidth;
      if ((d > 0 && el.scrollLeft >= max - 1) || (d < 0 && el.scrollLeft <= 0)) return;
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + d)); e.preventDefault(); return;
    }
  }
}, { passive: false });
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
    else if (c.st === 'T' && c.pair) { const mate = v.p[me].hand.some(h => h.i !== iid && h.c === c.pair); // 짝 카드: 좌측·우측이 다 손패에 있어야 냄
      opts.push(mate ? { label: '좌측·우측 함께 내기', value: 'play', cls: 'primary' } : { label: `사용하기 (${c.side === 'L' ? '우측' : '좌측'} 없음)`, value: 'play', cls: '' }); }
    else if (c.st === 'T') opts.push({ label: '사용하기', value: 'play', cls: 'primary' });
    opts.push({ label: '다른 곳으로 옮기기' + FX, value: 'move', cls: 'judge' });
  }
  openSheet(`<button class="x sm" data-close>닫기</button>${cardActHtml(c, actsHtml(opts.map((o, i) => ({ ...o, i })), '', cactW()), { cid: x.c })}`, el => {
    el.classList.add('cactsheet'); bindCardPeek(el);
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
// 포켓몬에 붙은 카드(도구·에너지·진화 전)를 작은 카드로: 누르면 그 카드 설명 (창 안에서 겹쳐 보기)
function attachedHtml(sl) {
  const grp = [['도구', sl.tl], ['에너지', sl.en], ['진화 전', sl.cards.slice(0, -1).reverse()]].filter(([, xs]) => xs.length);
  if (!grp.length) return '<p class="small muted atnone">붙은 카드 없음</p>';
  return `<div class="atcs">${grp.map(([l, xs]) => `<div class="atg"><span class="atl">${l} <b>${xs.length}</b></span><div class="atrow">${xs.map(x => `<button type="button" class="atc" data-ci="${x.c}" aria-label="${esc(nmOf(x))} 보기">${cardFace(x, 'atpc')}<small>${esc(nmOf(x))}</small></button>`).join('')}</div></div>`).join('')}</div>`;
}
function subView(inn, html, onMount) { // 창 안에서 겹쳐 보기: '목록으로'·뒤로 가기로 원래 창 내용으로
  const st = inn.scrollTop, main = [...inn.children].filter(n => !n.classList.contains('subv'));
  let box = inn.querySelector(':scope > .subv'); if (!box) { box = document.createElement('div'); box.className = 'subv'; inn.appendChild(box); }
  main.forEach(n => n.classList.add('subhide'));
  box.innerHTML = `<div class="subvh"><button type="button" class="sm" data-subback>${ICON.back}<span>목록으로</span></button></div>${html}`; box.hidden = false; inn.scrollTop = 0;
  SUBVIEW = () => { SUBVIEW = null; box.hidden = true; box.innerHTML = ''; main.forEach(n => n.classList.remove('subhide')); inn.scrollTop = st; requestAnimationFrame(placeX); };
  history.pushState({ sub: 1 }, '');
  box.querySelector('[data-subback]').onclick = () => history.back();
  onMount && onMount(box); requestAnimationFrame(placeX);
}
function bindCardPeek(root) { // data-ci(카드 번호)를 누르면 카드 설명
  root.querySelectorAll('[data-ci]').forEach(b => b.onclick = e => { e.stopPropagation(); const inn = b.closest('.sheet > .in'); const html = cardInfoHtml(cinfo(b.dataset.ci)); if (inn) subView(inn, html); else openSheet(`<button class="x sm" data-close>닫기</button>${html}`); });
}
function balanceRows(box) { // 단추 줄 고르게: 줄 수는 가장 적게, 그 안에서 가장 긴 줄이 가장 짧도록 나눔 (3+1 대신 2+2). 줄마다 꽉 채움
  if (!box || !box.isConnected) return;
  box.querySelectorAll(':scope > .slrow').forEach(r => { r.replaceWith(...r.childNodes); }); box.classList.remove('bald');
  const kids = [...box.children], W = box.clientWidth, gap = 10; if (kids.length < 2 || !W) return;
  const ws = kids.map(k => { k.style.flex = '0 0 auto'; const w = k.offsetWidth; /* 창이 열리며 커지는 중(scale)이어도 실제 너비 */ k.style.flex = ''; return w; });
  const lineW = (a, b) => ws.slice(a, b).reduce((t, w) => t + w, 0) + gap * (b - a - 1);
  let K = 1, cur = 0; for (const w of ws) { if (cur && cur + gap + w > W) { K++; cur = w; } else cur = cur ? cur + gap + w : w; }
  if (K < 2) return;
  let best = null; const n = ws.length;
  const go = (start, left, cuts) => { // 남은 것을 left 줄로 나누는 모든 방법 (단추가 몇 개 안 됨)
    if (left === 1) { const all = [...cuts, n], mx = Math.max(...all.map((e, i) => { const a = i ? all[i - 1] : 0; return e - a === 1 && kids[a].classList.contains('hprow') ? W : lineW(a, e); })); /* 체력 상자가 혼자 줄을 차지하면 속이 비어 보이니 되도록 단추와 같은 줄에 */ const ls = all.map((e, i) => lineW(i ? all[i - 1] : 0, e)), avg = ls.reduce((t, x) => t + x, 0) / ls.length, vr = ls.reduce((t, x) => t + (x - avg) ** 2, 0); /* 같으면 줄 길이가 더 고른 쪽 */
      if (lineW(cuts.length ? cuts[cuts.length - 1] : 0, n) <= W && (!best || mx < best.mx - .5 || (Math.abs(mx - best.mx) <= .5 && vr < best.vr))) best = { mx, vr, cuts: [...cuts] }; return; }
    for (let e = start + 1; e <= n - left + 1; e++) { if (lineW(start, e) > W) break; go(e, left - 1, [...cuts, e]); }
  };
  go(0, K, []); if (!best) return;
  const ends = [...best.cuts, n]; box.classList.add('bald');
  ends.forEach((e, i) => { const row = document.createElement('div'); row.className = 'slrow'; kids.slice(i ? ends[i - 1] : 0, e).forEach(k => row.appendChild(k)); box.appendChild(row); });
}
window.addEventListener('resize', () => requestAnimationFrame(() => document.querySelectorAll('.sheet .slacts').forEach(balanceRows)));
function slotInfoHtml(f, live) { // 포켓몬 정보 창 윗부분 (대전·리플레이 같음). live = 아래에 체력 단추가 있음 → 체력 글줄은 빼고, 붙은 카드도 있을 때만
  const c = cinfo(topOf(f.sl).c), hpMax = c.hp || 0, left = hpMax ? Math.max(0, hpMax - f.sl.dmg) : 0;
  const has = f.sl.tl.length || f.sl.en.length || f.sl.cards.length > 1;
  if (live) return `${cardInfoHtml(c)}${has ? attachedHtml(f.sl) : ''}`;
  return `${cardInfoHtml(c)}<div class="small slinfo">${hpMax ? `남은 체력 ${left} / ${hpMax}` : `데미지 ${f.sl.dmg}`}${has ? '' : ' · 붙은 카드 없음'}</div>${has ? attachedHtml(f.sl) : ''}`;
}
async function onSlot(sid) {
  const v = G.view, me = meSeat(); const f = findSlot(sid); if (!f) return;
  const mine = f.p === me, c = cinfo(topOf(f.sl).c);
  const opts = [];
  if (me != null && v.phase === 'setup' && mine) opts.push({ label: '손패로 되돌리기', value: ['setupReturn'] });
  if (me != null && v.phase === 'play') {
    // 맨 윗줄: 기술과 특성 (내 포켓몬) / 둘째 줄: 체력 ▼▲ 적용 / 셋째 줄: 나머지
    if (mine && f.where === 'active') (c.at || []).forEach((a, k) => opts.push({ label: `${ICON.battle}${esc((c.kat || [])[k]?.n || a.n)} ${esc(a.d || '')}`, value: ['attack', k], cls: 'primary', row: 1 }));
    if (mine) (c.ab || []).forEach((a, k) => { const used = abUsedOf(sid, k); opts.push({ label: `${used ? ICON.check : ICON.spark}특성 ${esc((c.kab || [])[k]?.n || a.n)}${used ? '<small class="fx">사용함</small>' : ''}`, value: ['ability', k], cls: used ? 'blue used' : 'blue', row: 1 }); });
    if (mine && f.where === 'active' && v.p[me].bench.length) opts.push({ label: '후퇴', value: ['retreat'], cls: 'blue' });
    if (f.where === 'bench') opts.push({ label: '배틀 포켓몬과 바꾸기' + FX, value: ['switch'], cls: 'judge' });
    if (f.where === 'active') opts.push({ label: '특수상태', value: ['cond'], cls: 'judge' });
    opts.push({ label: '붙은 카드 옮기기', value: ['parts'], cls: 'judge' }, { label: '포켓몬 통째로 옮기기', value: ['whole'], cls: 'judge' });
  }
  const hpMax = c.hp || 0, left = hpMax ? Math.max(0, hpMax - f.sl.dmg) : 0, hv0 = hpMax ? left : f.sl.dmg;
  const hpRow = me != null && v.phase === 'play' ? `<div class="hprow"><span class="hpl">${hpMax ? '체력' : '데미지'}</span>${stepHtml('hp', hv0, hpMax ? { min: 0, max: hpMax, by: 10, unit: `<small class="hpm">/${hpMax}</small>` } : { min: 0, max: 990, by: 10 })}<button class="judge" data-hpgo disabled>적용<i class="hpd" hidden></i></button></div>` : ''; // 한 줄: 이름표 · ▼ 값/최대 ▲ · 적용(바뀐 만큼은 작은 배지, 단추 크기 그대로)
  const ix = opts.map((o, i) => ({ ...o, i }));
  const r3 = ix.filter(o => o.row !== 1).map(o => `<button class="${o.cls || ''}" data-i="${o.i}">${o.label}</button>`).join('');
  const actsBox = `${actsHtml(ix.filter(o => o.row === 1), 'r1', cactW())}${hpRow || r3 ? `<div class="slacts">${hpRow}${r3}</div>` : ''}`;
  const hasAtt = f.sl.tl.length || f.sl.en.length || f.sl.cards.length > 1;
  const body = actsBox ? cardActHtml(c, actsBox, { cid: topOf(f.sl).c, head: hpRow ? '' : `<div class="small slinfo">${hpMax ? `남은 체력 ${left} / ${hpMax}` : `데미지 ${f.sl.dmg}`}</div>`, top: hasAtt ? attachedHtml(f.sl) : '' }) : slotInfoHtml(f, false);
  openSheet(`<button class="x sm" data-close>닫기</button>${body}`, el => {
    if (actsBox) el.classList.add('cactsheet');
    bindCardPeek(el); balanceRows(el.querySelector('.slacts'));
    const hgo = el.querySelector('[data-hpgo]');
    if (hgo) { const hd = hgo.querySelector('.hpd'); bindSteps(el, nv => { hgo.disabled = nv === hv0; hd.hidden = nv === hv0; hd.textContent = (nv > hv0 ? '+' : '−') + Math.abs(nv - hv0); });
      hgo.onclick = () => { const nv = +el.querySelector('[name=hp]').value; closeSheet(); send({ type: 'damage', sid, n: hpMax ? (hpMax - nv) - f.sl.dmg : nv - f.sl.dmg }); }; }
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const [k, arg] = opts[+b.dataset.i].value; closeSheet(); await new Promise(r => setTimeout(r, 30));
      if (k === 'setupReturn') return send({ type: 'setupReturn', sid });
      if (k === 'attack') {
        const a = c.at[arg]; const sug = suggest(arg);
        const ka = (c.kat || [])[arg] || a; const fm = await ask(`기술 ${ka.n}`, `<p>${esc(ka.t || '추가 효과 없음')}</p><p>사이트 계산: <b>${sug.dmg}</b>${sug.parts.length ? ' (' + esc(sug.parts.join(', ')) + ')' : ''}</p><label class="h">상대 배틀 포켓몬에게 줄 데미지</label>${stepHtml('dmg', sug.dmg, { min: 0, max: 990, by: 10 })}<label class="h">설명 (선택)</label><input name="note" maxlength="100" style="width:100%">${a.t ? '<p class="small muted">추가 효과(벤치 데미지, 상태 이상 등)는 기술을 쓴 뒤 도구로 처리하고 「효과 끝」을 눌러요.</p>' : ''}`, '기술 쓰기');
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
      if (k === 'cond') {
        const opt = Object.entries(COND_KO).map(([ck, l]) => ({ label: (f.sl.cond[ck] ? ICON.check : '') + l + (f.sl.cond[ck] ? ' 회복' : ''), value: ck }));
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
const lkSide = lk => lk.z === 'deck' && lk.n != null ? (lk.bottom ? ' 맨 아래 카드' : ' 맨 위 카드') : ''; // 덱 위·아래에서 N장 보는 중
async function onZone(z, p) {
  const v = G.view, me = G.rw ? null : meSeat(), P = v.p[p], mine = p === (G.rw ? G.rw.me : meSeat());
  if (z === 'discard' || z === 'lost') return openZoneView({ z, p });
  if (me == null) { if (zvCards({ z, p }, v)) openZoneView({ z, p }); else toast('이 카드들은 볼 수 없어요.'); return; } // 관전·리플레이: 보이는 것이면 큰 창
  if (me == null || v.phase !== 'play') return;
  const lk = v.p[me].look, lkHere = lk && lk.z === z && lk.p === p; // 보는 중인 곳을 누르면: 덱은 메뉴 맨 위에 '다시 크게 보기', 손패·프라이즈는 바로 크게
  if (lkHere && z !== 'deck') return openZoneView({ look: 1 });
  if (z === 'deck') {
    const opts = mine ? [{ label: '1장 뽑기', value: ['draw', 1] }, { label: '여러 장 뽑기', value: ['drawN'] }, { label: '덱 전체 보기 (검색)', value: ['look', null] }, { label: '위에서 몇 장 보기', value: ['lookN'] }, { label: '아래에서 몇 장 보기', value: ['lookB'] }, { label: '섞기', value: ['shuffle'] }]
      : [{ label: '상대 덱 위에서 몇 장 보기', value: ['lookN'] }, { label: '상대 덱 아래에서 몇 장 보기', value: ['lookB'] }, { label: '상대 덱 섞기', value: ['shuffle'] }];
    if (lkHere) opts.unshift({ label: `${ICON.eye}보던 카드 다시 크게 보기`, value: ['resume'], cls: 'primary' });
    const k = await pick(mine ? '내 덱' : '상대 덱', opts); if (!k) return;
    if (k[0] === 'resume') return openZoneView({ look: 1 });
    if (k[0] === 'draw') return send({ type: 'draw', n: 1 });
    if (k[0] === 'drawN') { const f = await ask('몇 장 뽑을까요?', stepHtml('n', 2, { min: 1, max: 60, unit: '장' }), '뽑기'); if (f) send({ type: 'draw', n: +f.n }); return; }
    if (k[0] === 'look') return askLook(p, 'deck');
    if (k[0] === 'lookN' || k[0] === 'lookB') { const b = k[0] === 'lookB', f = await ask(`${b ? '아래' : '위'}에서 몇 장 볼까요?`, stepHtml('n', 3, { min: 1, max: 60, unit: '장' }), '보기'); if (f) askLook(p, 'deck', +f.n, b); return; }
    if (k[0] === 'shuffle') return send({ type: 'shuffle', p });
  }
  if (z === 'prizes') { const ok = await pick(mine ? '내 프라이즈' : '상대 프라이즈', [{ label: '앞면 확인하기' + FX, value: 1, cls: 'judge' }]); if (ok) askLook(p, 'prizes'); return; }
  if (z === 'hand' && !mine) { const ok = await pick('상대 손패', [{ label: '상대 손패 보기' + FX, value: 1, cls: 'judge' }]); if (ok) askLook(p, 'hand'); }
}
// 덱·손패·프라이즈 보기: 이미 같은 것을 보고 있으면(큰 창만 닫았던 경우) 바로 큰 창, 아니면 보기 시작 후 큰 창 (2026-11-18 '덱이 안 보여요' 고침)
function askLook(p, z, n = null, bottom = false) { // 이미 같은 것을 보는 중이면 서버에 다시 묻지 않고 바로 큰 창 (예전엔 창이 안 열려 '덱이 안 보임')
  const me = meSeat(), lk = me != null && G.view.p[me].look;
  if (lk && lk.p === p && lk.z === z && (lk.n || null) === (n || null) && !!lk.bottom === !!bottom) return openZoneView({ look: 1 });
  G.ui.lookWant = true; send({ type: 'look', p, z, ...(n ? { n } : {}), ...(bottom ? { from: 'bottom' } : {}) });
}
// ---------- 카드 묶음 크게 보기: 화면(매트) 거의 전체 크기 창에 큰 카드 ----------
// 덱 보기·트래시·로스트존·프라이즈·손패 모두 같은 기준. 대전·관전·리플레이 공통. 열어 둔 채 판이 바뀌면 다시 채움
let ZV = null; // { z, p } 또는 { look: 1 }. v: 리플레이면 그 장면
const ZNAME = { deck: '덱', hand: '손패', prizes: '프라이즈', discard: '트래시', lost: '로스트존' };
function zvCards(spec, v = G.view) {
  if (spec.look) { const me = meSeat(), lk = me != null && v.p[me].look; if (!lk) return null; const Q = v.p[lk.p]; return (lk.z === 'deck' ? Q.deck.cards : lk.z === 'hand' ? Q.hand : Q.prizes) || []; }
  const P = v.p[spec.p]; if (!P) return null;
  return (spec.z === 'deck' ? P.deck.cards : P[spec.z]) || null;
}
function openZoneView(spec, v = G.view, keep = null) {
  if (!zvCards(spec, v)) return;
  ZV = { ...spec, v: G.rw ? v : null, sel: keep?.sel || [], only: !!keep?.only, shuf: keep?.shuf ?? null, cat: keep?.cat || '' };
  openSheet(`<button class="x sm" data-close>닫기</button><div class="zvh"><h3 class="zvt"></h3><span class="zvb"></span></div><div class="zvtools"></div><div class="zvgrid"></div><div class="zvbar" hidden></div>`, el => { el.classList.add('zvsheet'); zvFill(el); });
}
// ---------- 여러 장 고르기 + 카드 효과 도우미 ----------
// 카드 오른쪽 위 동그라미로 여러 장을 골라 단추 하나로 옮김(보여주고 손패로, 옮긴 뒤 덱 섞기). 카드를 누르면 지금처럼 크게 보기.
// G.ui.fx: 카드 글을 읽어 차린 도우미 { kind:'search'|'cost', title, cid, sid, sp|co, test, gid } — 맞는 카드를 진하게, 장수·옮길 곳을 미리. 막지는 않음
const ZCAT = [ // 덱 창 분류: 포켓몬(눌러서 기본·1진화·2진화·ex) / 트레이너스 / 에너지, 무리마다 색
  ['pk', '포켓몬', c => c.st === 'P'], ['pk0', '기본 포켓몬', c => c.st === 'P' && (c.sub || []).includes('Basic')], ['pk1', '1진화', c => c.st === 'P' && (c.sub || []).includes('Stage 1')], ['pk2', '2진화', c => c.st === 'P' && (c.sub || []).includes('Stage 2')], ['ex', '포켓몬 ex', c => c.st === 'P' && (c.sub || []).includes('ex')],
  ['tr', '트레이너스', c => c.st === 'T'], ['it', '아이템', c => (c.sub || []).includes('Item')], ['tl', '포켓몬의 도구', c => (c.sub || []).includes('Pokémon Tool')], ['sp', '서포트', c => (c.sub || []).includes('Supporter')], ['st', '스타디움', c => (c.sub || []).includes('Stadium')],
  ['en', '에너지', c => c.st === 'E'], ['eb', '기본 에너지', c => c.st === 'E' && (c.sub || []).includes('Basic')], ['es', '특수 에너지', c => c.st === 'E' && !(c.sub || []).includes('Basic')],
];
const ZGRP = { pk: ['pk0', 'pk1', 'pk2', 'ex'], tr: ['it', 'tl', 'sp', 'st'], en: ['eb', 'es'] };
const zcF = k => (ZCAT.find(c => c[0] === k) || [])[2] || (() => true), zcL = k => (ZCAT.find(c => c[0] === k) || [])[1] || '전체';
const zgOf = k => Object.keys(ZGRP).find(g => g === k || ZGRP[g].includes(k)) || '';
const ZSHORT = { pk0: '기본', ex: 'ex', tl: '도구', eb: '기본', es: '특수' }; // 좁을 때 무리 단추에 쓰는 짧은 이름
function zvFitCats(tl, cnt) { // 분류 줄은 늘 한 줄: 넓으면 트레이너스·에너지를 펼쳐 두고, 좁으면 무리 단추(눌러서 고르기)로, 더 좁으면 장수를 뺌
  const row = tl && tl.querySelector('.zvcats'); if (!row || !ZV) return;
  const over = () => { const vis = [...row.children].filter(b => b.offsetParent), last = vis[vis.length - 1]; return !!last && last.getBoundingClientRect().right > row.getBoundingClientRect().right - 1; }, cg = zgOf(ZV.cat); // 마지막 단추 오른쪽 끝으로 잼 (button의 scrollWidth는 몇 px씩 틀림)
  row.classList.add('fit'); // 재는 동안은 늘리지 않음 (늘어난 단추의 소수점 폭 때문에 넘친다고 잘못 재지 않게)
  try {
  cnt = cnt || (k => { const cs = zvCards(ZV, ZV.v || G.view) || []; return k ? cs.filter(x => zcF(k)(cinfo(x.c))).length : cs.length; });
  const set = (b, k, l) => { b.querySelector('.zcl').textContent = l; b.querySelector('b').textContent = cnt(k); };
  const gb = [...row.querySelectorAll('.zvcat[data-g]')];
  gb.forEach(b => set(b, b.dataset.g, zcL(b.dataset.g))); // 단계는 기본 이름으로 정함 (골라도 단추 모양·장수 표시가 바뀌지 않게)
  for (const m of ['full', 'compact', 'tiny']) { row.dataset.mode = m; if (!over()) break; }
  const b = gb.find(x => x.dataset.g === cg && ZV.cat !== cg && x.offsetParent); if (!b) return; // 무리 단추로 고른 세부 이름 (예: 1진화 6)
  set(b, ZV.cat, zcL(ZV.cat)); if (!over()) return;
  if (ZSHORT[ZV.cat]) { set(b, ZV.cat, ZSHORT[ZV.cat]); if (!over()) return; }
  set(b, ZV.cat, zcL(cg));
  } finally { row.classList.remove('fit'); }
}
function zvSetCat(el, k) { ZV.cat = k; zvMenuClose(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); el.querySelector('.zvgrid').scrollTop = 0; zvFill(el); }
let ZMENU = null; // 무리 단추를 누르면 뜨는 작은 목록 (바깥을 누르거나 뒤로 가기로 닫힘)
function zvMenuClose() { if (!ZMENU) return; const f = ZMENU; ZMENU = null; f(); }
function zvMenu(el, chip) {
  const tl = el.querySelector('.zvtools'), g = chip.dataset.g, old = tl.querySelector('.zvmenu');
  if (old) { const same = old.dataset.g === g; zvMenuClose(); if (same) return; }
  const cards = zvCards(ZV, ZV.v || G.view) || [], cnt = k => cards.filter(x => zcF(k)(cinfo(x.c))).length;
  const m = document.createElement('div'); m.className = `zvmenu k-${g}`; m.dataset.g = g; m.setAttribute('role', 'menu');
  m.innerHTML = [g, ...ZGRP[g]].map(k => { const n = cnt(k); return `<button type="button" class="k-${g}" role="menuitemradio" data-cat="${k}" aria-checked="${(ZV.cat || '') === k}" ${n ? '' : 'disabled'}><span>${k === g ? `${zcL(g)} 전체` : zcL(k)}</span><b>${n}장</b></button>`; }).join('');
  tl.appendChild(m);
  const r = chip.getBoundingClientRect(), t = tl.getBoundingClientRect();
  m.style.top = `${r.bottom - t.top + 6}px`; m.style.left = `${Math.max(0, Math.min(r.left - t.left, tl.clientWidth - m.offsetWidth))}px`;
  chip.setAttribute('aria-expanded', 'true');
  m.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => zvSetCat(el, b.dataset.cat));
  const down = e => { if (!m.contains(e.target) && !(e.target.closest && e.target.closest('.zvcat.zg'))) zvMenuClose(); };
  document.addEventListener('pointerdown', down, true);
  ZMENU = () => { m.remove(); chip.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', down, true); };
  ZMENU.m = m;
}
function zvFx(v = G.view) {
  const fx = G.ui && G.ui.fx, me = G.rw ? null : meSeat(); if (!fx || !ZV || ZV.v || me == null) return null;
  if (fx.gid && v.openGroup?.[me] !== fx.gid) { G.ui.fx = null; return null; } // 그 효과가 끝났으면 도우미도 끝
  if (fx.kind === 'cost') return !ZV.look && ZV.z === 'hand' && ZV.p === me ? fx : null;
  const lk = v.p[me].look; return ZV.look && lk && lk.p === me && lk.z === 'deck' && (fx.sp.top ? lk.n != null && !!lk.bottom === !!fx.sp.bottom : lk.n == null) ? fx : null; // 위·아래에서 N장 도우미는 같은 쪽 N장 보기에만, 덱 찾기는 덱 전체 보기에만
}
function zvOpts(v = G.view) { // 고른 카드를 옮길 곳 (대전 중에만)
  const me = G.rw ? null : meSeat(); if (me == null || v.phase !== 'play' || !ZV || ZV.v) return [];
  const lk = v.p[me].look, z = ZV.look ? lk?.z : ZV.z, p = ZV.look ? lk?.p : ZV.p; if (z == null) return [];
  if (p === me) {
    const o = moveOpts(me).filter(x => !(x.value && x.value.z === z && z !== 'deck')).map(x => ({ ...x, cls: '' }));
    if (z === 'deck' || z === 'prizes') o.unshift({ label: '보여주고 손패로', value: { z: 'hand', p: me }, show: 1 });
    return o;
  }
  return [{ label: '상대 트래시로', value: { z: 'discard', p } }, { label: '상대 덱 위로', value: { z: 'deck', p, pos: 'top' } }, { label: '상대 덱 아래로', value: { z: 'deck', p, pos: 'bottom' } }, { label: '상대 손패로', value: { z: 'hand', p } }, { label: '상대 로스트존으로', value: { z: 'lost', p } }].filter(o => o.value.z !== z);
}
const zvActs = () => zvOpts(); // 카드 한 장 자세히 보기 아래 옮길 곳
const fxPri = sp => `${sp.reveal ? '보여주고 ' : ''}${sp.to ? toLabel(sp) : '옮기기'}`;
const fxRest = (sp, n) => sp.rest === 'shuffle' ? '나머지는 덱에 넣고 섞기' : sp.rest ? `나머지 ${n}장 ${sp.rest === 'discard' ? '트래시로' : '덱 아래로'}` : ''; // 섞어서 아래로는 기록에 '섞어서'로 남음
function zvBarActs(opts, fx, n = 0, total = 0) { // 아래 줄 단추: 자주 쓰는 3개 + 나머지는 '다른 곳으로'
  const me = meSeat();
  if (fx && fx.kind === 'cost') return [{ label: `${ICON.check}트래시로`, value: { z: 'discard', p: me }, cls: 'primary', cost: 1 }, { label: '건너뛰기', skip: 1 }];
  let pri;
  if (fx && fx.sp.top && (fx.sp.to || fx.sp.rest)) { const r = fxRest(fx.sp, total - n); pri = [{ label: `${ICON.check}${n && fx.sp.to && r ? `<span class="b2"><span>${fxPri(fx.sp)}</span><small>+ ${r}</small></span>` : n && fx.sp.to ? fxPri(fx.sp) : r || fxPri(fx.sp)}`, fx: 1, cls: 'primary', zero: !!fx.sp.rest }]; } // 두 줄: 고른 카드 옮기기 / + 나머지 // 위에서 N장: 고른 카드 옮기고 나머지까지 한 번에 (못 찾았으면 나머지만)
  else if (fx && fx.sp.to) pri = [{ label: `${ICON.check}${fxPri(fx.sp)}`, fx: 1, cls: 'primary' }];
  else { const want = o => o.show || (o.value && (o.value.z === 'hand' || o.value.z === 'discard')); pri = opts.filter(want).slice(0, 3); if (pri.length < 3) pri = [...pri, ...opts.filter(o => !pri.includes(o)).slice(0, 3 - pri.length)]; if (pri[0]) pri[0] = { ...pri[0], cls: 'primary' }; }
  const rest = opts.filter(o => !pri.some(p => p.label === o.label));
  return rest.length ? [...pri, { label: '다른 곳으로…', more: rest }] : pri;
}
function zvFill(el, barOnly = false) {
  if (!ZV) return; const v = ZV.v || G.view, cards = zvCards(ZV, v); if (!cards) { ZV = null; closeSheet(); return; }
  const me = G.rw ? null : meSeat(), viewer = G.rw ? G.rw.me : me;
  let title, btns = '';
  if (ZV.look) { const lk = v.p[me].look; title = `${lk.p === me ? '내' : '상대'} ${ZNAME[lk.z]}${lkSide(lk)} 보는 중`; btns = `<button class="sm" data-zlook="end">닫기</button>${lk.z === 'deck' ? '<button class="sm" data-zlook="shuffle">섞고 닫기</button>' : ''}`; }
  else title = `${ZV.p === viewer ? '내' : esc(v.p[ZV.p].name) + ' 님'} ${ZNAME[ZV.z]}`;
  el.querySelector('.zvt').innerHTML = `${title} <span class="chip">${cards.length}장</span>`;
  const bb = el.querySelector('.zvb'); bb.innerHTML = btns;
  bb.querySelectorAll('[data-zlook]').forEach(b => b.onclick = () => send(b.dataset.zlook === 'end' ? { type: 'lookEnd' } : { type: 'shuffle', p: me }));
  const fx = zvFx(v), opts = zvOpts(v), selable = opts.length > 0;
  ZV.sel = ZV.sel.filter(i => cards.some(x => x.i === i));
  const okOf = x => !fx || !fx.test || fx.test(cinfo(x.c)), nOk = fx && fx.test ? cards.filter(okOf).length : null;
  if (!fx || !fx.test) ZV.only = false;
  // 도우미·분류 줄 (모양이 바뀔 때만 다시 그림)
  const showQ = cards.length >= 8, has = k => cards.some(x => zcF(k)(cinfo(x.c)));
  const grps = showQ ? Object.keys(ZGRP).filter(has) : [], subsOf = g => ZGRP[g].filter(has);
  if (ZV.cat && (!showQ || !has(ZV.cat))) ZV.cat = '';
  const tl = el.querySelector('.zvtools'), sig = `${fx ? fx.kind + fx.title + (fx.test ? 1 : 0) : ''}|${grps.map(g => g + ':' + subsOf(g).join('.')).join()}`;
  if (tl.dataset.sig !== sig) {
    tl.dataset.sig = sig; zvMenuClose();
    const lab = fx ? (fx.kind === 'cost' ? `먼저 손패 ${fx.co.n}장${fx.co.cond ? `(${esc(fx.co.cond)})` : ''}을 트래시 · 그다음 덱에서 찾기` : esc(searchLabel(fx.sp))) : '';
    const chip = (cls, attrs, l, dn) => `<button type="button" class="zvcat ${cls}" ${attrs}><span class="zcl">${l}</span><b></b>${dn ? `<i class="zdn">${ICON.down}</i>` : ''}</button>`;
    const row = grps.length ? `<div class="zvcats" role="group" aria-label="분류">${chip('k-all', 'data-cat=""', '전체')}${grps.map(g => g === 'pk' ? chip('k-pk zg', 'data-g="pk" aria-haspopup="menu" aria-expanded="false"', '포켓몬', 1)
      : chip(`k-${g} zg zcmp`, `data-g="${g}" aria-haspopup="menu" aria-expanded="false"`, zcL(g), 1) + subsOf(g).map(k => chip(`k-${g} zful`, `data-cat="${k}"`, zcL(k))).join('')).join('')}</div>` : '';
    tl.innerHTML = `${fx ? `<div class="zvfx"><i class="qi judge">${ICON.spark}</i><div class="zvfxt"><button type="button" class="zvfxn" data-ci="${fx.cid}">${esc(fx.title)}</button><span>${lab}</span></div><div class="zvfxb">${fx.test ? `<button type="button" class="xs zvonly" aria-pressed="${ZV.only}">${ZV.only ? ICON.check : ''}맞는 카드만 <b class="zvok"></b></button>` : ''}<button type="button" class="xs" data-fxoff>도우미 끄기</button></div></div>` : ''}${row}`;
    bindCardPeek(tl);
    const on = tl.querySelector('.zvonly'); if (on) on.onclick = () => { ZV.only = !ZV.only; tl.dataset.sig = ''; zvFill(el); };
    const off = tl.querySelector('[data-fxoff]'); if (off) off.onclick = () => { G.ui.fx = null; tl.dataset.sig = ''; zvFill(el); };
    tl.querySelectorAll('.zvcat[data-cat]').forEach(b => b.onclick = () => zvSetCat(el, b.dataset.cat));
    tl.querySelectorAll('.zvcat[data-g]').forEach(b => b.onclick = () => zvMenu(el, b));
  }
  const okb = tl.querySelector('.zvok'); if (okb) okb.textContent = `${nOk}장`;
  const cnt = k => k ? cards.filter(x => zcF(k)(cinfo(x.c))).length : cards.length, cg = zgOf(ZV.cat);
  tl.querySelectorAll('.zvcat').forEach(b => {
    const g = b.dataset.g; if (!g) b.querySelector('b').textContent = cnt(b.dataset.cat);
    b.setAttribute('aria-pressed', String(g ? cg === g : (ZV.cat || '') === b.dataset.cat));
  });
  zvFitCats(tl, cnt); // 무리 단추 이름·장수는 여기서 (줄에 맞춰)
  const catF = ZV.cat ? zcF(ZV.cat) : null;
  // 카드 격자
  const shown = cards.filter(x => (!ZV.only || okOf(x)) && (!catF || catF(cinfo(x.c))));
  const g = el.querySelector('.zvgrid'), st = g.scrollTop;
  if (!barOnly) {
  g.dataset.n = cards.length;
  g.innerHTML = shown.length ? shown.map(x => { const si = ZV.sel.indexOf(x.i), dim = fx && fx.test && !okOf(x);
    return `<div class="zc${si >= 0 ? ' on' : ''}${dim ? ' dim' : ''}" role="button" tabindex="0" data-zc="${x.i}" aria-label="${esc(nmOf(x))} 자세히">${cardFace(x, 'zpc')}${selable ? `<button type="button" class="zsel" data-zsel="${x.i}" aria-pressed="${si >= 0}" aria-label="${esc(nmOf(x))} 고르기">${si >= 0 ? `<b>${si + 1}</b>` : ''}</button>` : ''}<small style="--ne:${emLen(nmOf(x)).toFixed(2)}">${esc(nmOf(x))}</small></div>`; }).join('')
    : `<p class="muted zve">${cards.length ? '맞는 카드가 없어요.' : '비어 있어요.'}</p>`;
  zvSize(g); g.scrollTop = st;
  g.querySelectorAll('[data-zc]').forEach(b => { const go = () => { const x = cards.find(y => String(y.i) === b.dataset.zc); if (x) zvCard(el, x); }; b.onclick = e => { if (!e.target.closest('[data-zsel]')) go(); }; b.onkeydown = e => { if (e.target === b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(); } }; }); // 단추(button) 대신 div: 격자 줄 높이가 카드 높이를 제대로 따라감
  g.querySelectorAll('[data-zsel]').forEach(b => b.onclick = e => { e.stopPropagation(); zvToggle(el, b.dataset.zsel); });
  }
  // 아래 줄: 고른 장수 + 옮길 곳 (고르기 전에도 같은 자리에 흐리게 두어 모양이 바뀌지 않게)
  const bar = el.querySelector('.zvbar'), n = ZV.sel.length;
  const lk = me != null ? v.p[me].look : null, lkDeck = !!(ZV.look && lk && lk.z === 'deck' && lk.p === me), lkTop = lkDeck && lk.n != null;
  bar.hidden = !selable || (!n && !fx && !lkTop);
  if (!bar.hidden) {
    if (ZV.shuf == null) ZV.shuf = fx && fx.kind === 'search' ? !!fx.sp.shuffle : lkDeck && lk.n == null;
    const max = fx ? (fx.kind === 'cost' ? fx.co.n : fx.sp.max) : null;
    const acts = zvBarActs(opts, fx, n, cards.length).map((o, i) => ({ ...o, i }));
    const fxa = fx && fx.kind !== 'cost' && acts.length <= 2, rest = [['bottom', '덱 맨 아래로'], ['top', '덱 맨 위로'], ['discard', '트래시로'], ['shuffle', '덱 섞기']];
    bar.innerHTML = `<div class="zvbh"><div class="zvn${max != null && n > max ? ' over' : ''}">${n ? `고른 카드 <b>${n}</b>${max != null ? ` / ${max}` : ''}장` : fx ? (fx.kind === 'cost' ? `트래시할 손패 ${max}장을 골라요` : `동그라미를 눌러 골라요${max != null ? ` (${max}장${fx.sp.upTo ? '까지' : ''})` : ''}${fx.sp.top && fx.sp.rest ? ' · 없으면 그냥 눌러요' : ''}`) : lkTop ? '옮길 카드를 동그라미로 골라요' : ''}</div>${lkDeck && !lkTop && fx?.kind !== 'cost' ? `<button type="button" class="sm zvshuf" aria-pressed="${!!ZV.shuf}">${ZV.shuf ? ICON.check : ''}옮긴 뒤 덱 섞기</button>` : ''}</div>
      <div class="acts zvacts${fxa ? ' fxa' : ''}" style="--n:${acts.length};--np:${Math.min(2, acts.length)}">${acts.map(o => `<button class="${o.cls || ''}" data-za="${o.i}" ${!n && !o.skip && !o.zero ? 'disabled' : ''}>${o.label}</button>`).join('')}</div>
      ${lkTop && !fx ? `<div class="zvrest"><span class="zvrn">${n ? '고르지 않은' : '본'} 카드 <b>${cards.length - n}</b>장은</span><div class="acts" style="--n:4;--np:2">${rest.map(([k, l]) => `<button data-zr="${k}" ${cards.length - n ? '' : 'disabled'}>${l}</button>`).join('')}</div></div>` : ''}`;
    bar.querySelectorAll('[data-za]').forEach(b => b.onclick = () => zvDo(acts[+b.dataset.za]));
    bar.querySelectorAll('[data-zr]').forEach(b => b.onclick = () => zvRest(b.dataset.zr, cards.map(x => x.i).filter(i => !ZV.sel.includes(i))));
    const sh = bar.querySelector('.zvshuf'); if (sh) sh.onclick = () => { ZV.shuf = !ZV.shuf; zvFill(el); };
  }
}
async function zvRest(k, ids) { // 위에서 N장 보기: 남은 카드를 한 번에 (덱 맨 아래 / 맨 위 / 트래시 / 덱 섞기)
  const me = meSeat(); if (!ids.length) return;
  const ok = k === 'shuffle' ? await send({ type: 'shuffle', p: me }) : await send({ type: 'move', iids: ids, to: k === 'discard' ? { z: 'discard', p: me } : { z: 'deck', p: me, pos: k } });
  if (ok) Sound.sfx('place');
}
function zvToggle(el, iid) { // 카드 그림은 다시 그리지 않고 동그라미·테두리·아래 줄만 (깜빡임 없게)
  const k = ZV.sel.indexOf(iid);
  if (k >= 0) ZV.sel.splice(k, 1); else ZV.sel.push(iid);
  Sound.sfx('tap');
  el.querySelectorAll('.zvgrid .zc').forEach(c => { const si = ZV.sel.indexOf(c.dataset.zc), b = c.querySelector('.zsel'); c.classList.toggle('on', si >= 0); if (b) { b.setAttribute('aria-pressed', String(si >= 0)); b.innerHTML = si >= 0 ? `<b>${si + 1}</b>` : ''; } });
  zvFill(el, true);
}
async function zvDo(o) { // 고른 카드 옮기기. 창을 바꾸는 물음(어디로?·이대로?)이 있으면 끝난 뒤 창을 다시 열어 줌
  const v = G.view, me = meSeat(); if (!ZV || me == null) return;
  const fx = zvFx(v), cards = zvCards(ZV, v) || [], cmap = Object.fromEntries(cards.map(x => [x.i, x.c]));
  const keep = { spec: ZV.look ? { look: 1 } : { z: ZV.z, p: ZV.p }, sel: [...ZV.sel], only: ZV.only, shuf: ZV.shuf, cat: ZV.cat };
  const reopen = (sel = keep.sel) => { if (!$('#sheet').hidden || !zvCards(keep.spec)) return; openZoneView(keep.spec, G.view, { ...keep, sel }); };
  if (o.skip) { const nx = fx && fx.next; G.ui.fx = null; closeSheet(); if (nx) setTimeout(() => fxSearch(nx), 60); return; }
  const iids = keep.sel; if (!iids.length && !(o.fx && o.zero)) return toast('먼저 카드를 골라 주세요.');
  const restIds = o.fx && fx.sp.top ? cards.map(x => x.i).filter(i => !iids.includes(i)) : null; // 위에서 N장: 고르지 않은 나머지
  const lk = v.p[me].look;
  let to = o.value, show = !!o.show, shuffle = !!(ZV.shuf && ZV.look && lk && lk.z === 'deck' && lk.p === me);
  const nmI = i => esc(cname(cinfo(cmap[i])));
  if (o.more) {
    const r = await pick('어디로 옮길까요?', o.more.map((x, k) => ({ label: x.label, value: String(k) })));
    if (r == null) return reopen(); const x = o.more[+r]; to = x.value; show = !!x.show;
  }
  if (o.fx) { const sp = fx.sp; show = sp.reveal; to = { hand: { z: 'hand', p: me }, bench: { z: 'bench', p: me }, discard: { z: 'discard', p: me }, top: { z: 'deck', p: me, pos: 'top' } }[sp.to] || sp.to; }
  if (fx && (o.fx || o.cost)) { // 카드 글과 다르면 물어봄 (막지는 않음)
    const max = o.cost ? fx.co.n : fx.sp.max, exact = !!o.cost; // 덱에서 찾기는 못 찾을 수도 있어 적게 고르는 건 괜찮음
    const bad = fx.test ? iids.filter(i => !fx.test(cinfo(cmap[i]))) : [];
    const cnt = max != null && (exact ? iids.length !== max : iids.length > max);
    if (bad.length || cnt) {
      const cond = o.cost ? fx.co.cond : fx.sp.cond;
      const f = await ask('이대로 할까요?', `<p>카드 글과 다른 점이 있어요.</p><ul>${cnt ? `<li>${esc(fx.title)}: ${max}장${exact ? '' : '까지'}인데 ${iids.length}장을 골랐어요.</li>` : ''}${bad.length ? `<li>조건 ${esc(cond)}에 안 맞아 보이는 카드: ${bad.map(nmI).join(', ')}</li>` : ''}</ul><p class="small muted">카드 효과로 괜찮다면 그대로 진행하세요. 기록에 <span class="chip judge">사람 판정</span>으로 남고 상대가 확인해요.</p>`, '그대로 진행', 'judge');
      if (!f) return reopen();
    }
  }
  if (iids.length && (to === 'attach' || to === 'evolve')) { // 어느 포켓몬에게
    let sid = o.fx && fx.sp.target === 'self' && fx.sid && findSlot(fx.sid) ? fx.sid : null;
    if (!sid) sid = await pickSlot(to === 'evolve' ? '어느 포켓몬을 진화시킬까요?' : '어느 포켓몬에게 붙일까요?', o.fx ? [me] : [me, 1 - me]);
    if (!sid) return reopen();
    let part = to === 'evolve' ? 'cards' : null;
    if (!part) { const c0 = cinfo(cmap[iids[0]]); part = c0.st === 'E' ? 'en' : (c0.sub || []).includes('Pokémon Tool') ? 'tl' : null; }
    if (!part) { part = await pick('무엇으로 붙일까요?', [{ label: '에너지로', value: 'en' }, { label: '도구로', value: 'tl' }, { label: '진화 카드로 (위에 겹치기)', value: 'cards' }]); if (!part) return reopen(); }
    to = { z: 'slot', sid, part };
  }
  let ok = !iids.length || (to === 'reveal' ? await send({ type: 'reveal', iids }) : await send({ type: 'move', iids, to, ...(show ? { show: true } : {}), ...(shuffle ? { shuffle: true } : {}) }));
  if (ok && restIds) { // 남은 카드: 덱에 넣고 섞기 / (섞어서) 덱 아래로 / 트래시로
    const r = fx.sp.rest;
    if (r === 'shuffle') ok = await send({ type: 'shuffle', p: me });
    else if (r && restIds.length) ok = await send({ type: 'move', iids: restIds, to: r === 'discard' ? { z: 'discard', p: me } : { z: 'deck', p: me, pos: 'bottom' }, ...(r === 'bottomMix' ? { mix: true } : {}) });
  }
  if (ok) Sound.sfx('place');
  if (ok && fx) {
    if (o.cost) { const nx = fx.next; G.ui.fx = null; closeSheet(); if (nx) setTimeout(() => fxSearch(nx), 60); return; }
    if (o.fx) G.ui.fx = null;
  }
  if (ZV) { ZV.sel = ok ? [] : ZV.sel; const el = $('#sheet .zvsheet'); if (el) zvFill(el); }
  else reopen(ok ? [] : keep.sel);
}
function zvCard(el, x) { // 카드 자세히 (창 안에서 겹쳐 보기) + 고르기 + 옮기기
  const acts = zvActs(x).map((o, i) => ({ ...o, i })), on = ZV.sel.includes(x.i);
  subView(el, `${cardInfoHtml(cinfo(x.c))}${acts.length ? `<div class="acts1 zsel1"><button class="${on ? '' : 'primary'}" data-zpick>${on ? '고르기 취소' : `${ICON.check}이 카드 고르기`}</button></div><div class="small muted mvh">바로 옮기기</div>${actsHtml(acts)}` : ''}`, box => {
    const pk = box.querySelector('[data-zpick]'); if (pk) pk.onclick = () => { history.back(); setTimeout(() => { const e2 = $('#sheet .zvsheet'); if (e2 && ZV) zvToggle(e2, x.i); }, 40); };
    box.querySelectorAll('.acts [data-i]').forEach(b => b.onclick = async () => {
      const o = acts[+b.dataset.i], to = o.value;
      if (to && typeof to === 'object') { history.back(); send({ type: 'move', iids: [x.i], to, ...(o.show ? { show: true } : {}) }); return; } // 바로 옮기고 큰 창 목록으로
      closeSheet(); await new Promise(r => setTimeout(r, 30)); doMove([x.i], to);
    });
  });
}
// ---------- 카드 효과 도우미 시작: 트레이너스(아이템·서포트)·특성·기술을 쓰면 카드 글을 읽어 차림 ----------
function fxPrep(a) { // 쓰기 직전에 어떤 카드의 어떤 글인지 잡아 둠 (쓴 뒤에는 손패에서 사라지므로)
  const v = G.view, me = meSeat(); if (!v || me == null || v.phase !== 'play') return null;
  if (a.type === 'play') { const x = (v.p[me].hand || []).find(h => h.i === a.iid); if (!x) return null; const c = cinfo(x.c); if (!(c.sub || []).some(s => s === 'Item' || s === 'Supporter')) return null; return { cid: x.c, title: cname(c), lines: c.kr || c.r || [] }; }
  if (a.type === 'ability') { const f = findSlot(a.sid); if (!f || f.p !== me) return null; const t = topOf(f.sl), c = cinfo(t.c), ab = (c.kab || [])[a.k] || (c.ab || [])[a.k]; return ab ? { cid: t.c, sid: a.sid, title: `${cname(c)} · 특성 ${ab.n}`, lines: [ab.t] } : null; }
  if (a.type === 'attack') { const sl = v.p[me].active; if (!sl) return null; const t = topOf(sl), c = cinfo(t.c), at = (c.kat || [])[a.k] || (c.at || [])[a.k]; return at ? { cid: t.c, sid: sl.sid, title: `${cname(c)} · 기술 ${at.n}`, lines: [at.t] } : null; }
  return null;
}
function fxCtx() { const v = G.view, me = meSeat(); return { name: c => cnameKo(c), oppNames: me == null ? [] : allSlots(1 - me).map(sl => cnameKo(cinfo(topOf(sl).c))) }; }
function fxAfter(pre) {
  if (!pre) return; const ctx = fxCtx(); let sp = null, co = null;
  for (const t of pre.lines) { if (!co) co = parseCost(t, ctx); if (!sp) sp = parseTop(t, ctx) || parseSearch(t, ctx); }
  if (!sp) return;
  const me = meSeat(), gid = G.view.openGroup?.[me] || null;
  const fx = { kind: 'search', title: pre.title, cid: pre.cid, sid: pre.sid, sp, test: sp.test, gid };
  if (sp.coin) { G.ui.fx = fx; toast('동전을 던진 뒤 덱을 열면 맞는 카드를 진하게 보여 줘요.', 3200); return; }
  if (co) { G.ui.fx = { kind: 'cost', title: pre.title, cid: pre.cid, co, test: co.test, gid, next: fx }; setTimeout(() => { if ($('#sheet').hidden) openZoneView({ z: 'hand', p: me }); }, 80); return; }
  fxSearch(fx);
}
function fxSearch(fx) { // 덱을 열고 도우미를 붙임 (이미 덱 전체를 보는 중이면 창만 다시)
  G.ui.fx = fx; const me = meSeat(), lk = G.view.p[me].look;
  if (fx.sp.top) { closeSheet(); return void send({ type: 'look', p: me, z: 'deck', n: fx.sp.top, ...(fx.sp.bottom ? { from: 'bottom' } : {}) }); } // 위·아래에서 N장 보기
  if (lk && lk.p === me && lk.z === 'deck' && lk.n == null) { const el = $('#sheet .zvsheet'); if (el && ZV) { el.querySelector('.zvtools').dataset.sig = ''; zvFill(el); } else if ($('#sheet').hidden) openZoneView({ look: 1 }); return; }
  send({ type: 'look', p: me, z: 'deck' });
}
// ---------- 상대가 보여준 카드: 화면 가운데 크게 (누르면 닫힘) ----------
let REVEAL = null;
function revealShow(lines) {
  if (G.rw || reduceMotionSkip()) return;
  const me = meSeat(), ls = (lines || []).filter(l => l.show && l.show.length && l.who !== me && l.who != null); if (!ls.length) return;
  const had = !!REVEAL; if (REVEAL) { REVEAL.remove(); REVEAL = null; } // 보고 있던 것 위에 새로 (뒤로 가기 칸은 하나만)
  const v = G.view, nm = esc(v.p[ls[0].who]?.name || '상대'), ids = ls.flatMap(l => l.show).slice(0, 12);
  const o = document.createElement('div'); o.className = 'revlayer'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', '상대가 보여준 카드');
  o.innerHTML = `<div class="revbox"><h3>${nm} 님이 보여준 카드</h3><p class="revt">${esc(ls.map(l => l.showT || '').filter(Boolean)[0] || '')}</p><div class="revcards" style="--rn:${ids.length}">${ids.map(c => `<button type="button" class="revc" data-rc="${esc(c)}">${cardFace({ i: '', c }, 'revpc')}<small>${esc(cname(cinfo(c)))}</small></button>`).join('')}</div><button class="primary revok">${ICON.check}확인</button></div>`;
  o.onclick = e => { const b = e.target.closest('[data-rc]'); closeReveal(); if (b) setTimeout(() => openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(cinfo(b.dataset.rc))}`), 40); };
  document.body.appendChild(o); REVEAL = o; if (!had) history.pushState({ reveal: 1 }, ''); Sound.sfx('open');
}
function closeReveal(fromPop) { if (!REVEAL) return; REVEAL.remove(); REVEAL = null; if (!fromPop) { popSkip++; history.back(); } }
const reduceMotionSkip = () => false; // 보여준 카드는 움직임 줄이기 설정과 상관없이 보여 줌 (정보이므로)
const emLen = t => [...String(t)].reduce((n, ch) => n + (/[\u3131-\uD7A3]/.test(ch) ? 1 : ch === ' ' ? .3 : .58), 0) + .4; /* 이름 폭(글자 크기 배수): 한 줄에 다 들어가게 글자 크기를 줄임 */
function zvSize(g) { // 한 줄 카드 수와 카드 폭(px)을 정함. 6장 이하(프라이즈 등)는 한 줄에 다 넣고 창도 카드만큼만 (빈 곳 없게)
  const el = g.closest('.zvsheet'), sh = el.parentElement, cs = getComputedStyle(g), es = getComputedStyle(el), ss = getComputedStyle(sh), px = v => parseFloat(v) || 0;
  const padX = px(cs.paddingLeft) + px(cs.paddingRight) + px(es.paddingLeft) + px(es.paddingRight);
  const outer = Math.min(1240, sh.clientWidth - px(ss.paddingLeft) - px(ss.paddingRight)), W = outer - padX;
  const zw = px(cs.getPropertyValue('--zw')) || 150, gap = px(cs.columnGap) || 12, c = +g.dataset.n || g.querySelectorAll('.zc').length, one = (W - (c - 1) * gap) / c;
  let n, cw, fit = false;
  if (c && c <= 6 && one >= zw * .75) {
    const maxH = px(es.maxHeight) || innerHeight, hd = el.querySelector('.zvh').offsetHeight;
    const hCap = (maxH - hd - px(es.paddingTop) - px(es.paddingBottom) - px(cs.paddingTop) - px(cs.paddingBottom) - 34) / 1.3968;
    n = c; cw = Math.floor(Math.max(60, Math.min(one, zw * 1.2, hCap))); fit = true;
  } else {
    n = Math.max(2, Math.floor((W + gap) / (zw + gap)));
    if (c && c <= 6) n = Math.ceil(c / Math.ceil(c / n)); // 6장 이하가 두 줄이면 줄마다 고르게 (3+3)
    cw = Math.floor((W - (n - 1) * gap) / n);
  }
  g.classList.toggle('fit', fit); g.style.setProperty('--zn', n); g.style.setProperty('--zcw', cw + 'px');
  el.style.width = fit ? Math.round(Math.max(n * cw + (n - 1) * gap + padX, Math.min(outer, 560))) + 'px' : '';
}
window.addEventListener('resize', () => { const g = document.querySelector('#sheet .zvgrid'); if (g) zvSize(g); zvMenuClose(); zvFitCats(document.querySelector('#sheet .zvtools')); });
async function onPile(iid) { // 보고 있는 덱·손패·프라이즈의 카드: 카드 설명(그림 크게) + 옮길 곳 단추
  const v = G.view, me = meSeat(), lk = v.p[me].look; if (!lk) return; const P = v.p[lk.p];
  const arr = lk.z === 'deck' ? P.deck.cards : lk.z === 'hand' ? P.hand : P.prizes; const x = arr.find(y => y.i === iid); if (!x) return;
  const opts = (lk.p === me ? moveOpts(me) : [{ label: '상대 트래시로', value: { z: 'discard', p: lk.p } }, { label: '상대 덱 아래로', value: { z: 'deck', p: lk.p, pos: 'bottom' } }, { label: '상대 덱 위로', value: { z: 'deck', p: lk.p, pos: 'top' } }, { label: '상대 손패로', value: { z: 'hand', p: lk.p } }]).map((o, i) => ({ ...o, i }));
  openSheet(`<button class="x sm" data-close>닫기</button>${cardActHtml(cinfo(x.c), `<div class="small muted mvh">어디로 옮길까요?</div>${actsHtml(opts, '', cactW())}`, { cid: x.c })}`, el => {
    el.classList.add('cactsheet'); bindCardPeek(el);
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => { const to = opts[+b.dataset.i].value; closeSheet(); await new Promise(r => setTimeout(r, 30)); doMove([iid], to); });
  });
}
function bindToolPeek(view = () => G.view) { // 포켓몬 뒤로 보이는 도구 카드를 누르면 그 카드 설명
  app.querySelectorAll('.mat [data-tool]').forEach(b => b.onclick = e => { e.stopPropagation(); const x = { i: b.dataset.tool }, V = view(); for (const p of [0, 1]) for (const sl of [V.p[p].active, ...V.p[p].bench]) { const t = sl && sl.tl && sl.tl.find(y => y.i === x.i); if (t) return openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(cinfo(t.c))}`); } });
}
// ---------- 끌어 놓기: 손패 카드를 잡으면 살짝 커지고, 판 위 놓을 수 있는 곳이 빛남. 놓을 곳이 아니거나 손패로 돌려놓으면 취소 ----------
const DRAG = { at: 0 };
function dragPlan(c) { // 이 카드를 놓을 곳과 그때 보낼 행동
  const v = G.view, me = meSeat(), P = v.p[me], basic = c.st === 'P' && (c.sub || []).includes('Basic'), tool = (c.sub || []).includes('Pokémon Tool');
  const mine = '.area.bottom', T = [];
  if (v.phase === 'setup') {
    if (!basic) return T;
    if (!P.active) T.push({ sel: `${mine} .g-act`, act: iid => ({ type: 'setupPlace', iid, to: 'active' }) });
    if (P.bench.length < 5) T.push({ sel: `${mine} .g-bench`, act: iid => ({ type: 'setupPlace', iid, to: 'bench' }) });
    return T;
  }
  if (v.phase !== 'play') return T;
  if (c.st === 'P' && basic) { if (P.bench.length < 5) T.push({ sel: `${mine} .g-bench`, act: iid => ({ type: 'bench', iid }) }); }
  else if (c.st === 'P') T.push({ sel: `${mine} [data-sid]`, slot: 1, act: (iid, sid) => ({ type: 'evolve', iid, sid }) });
  else if (c.st === 'E' || tool) T.push({ sel: '.mat [data-sid]', slot: 1, act: (iid, sid) => ({ type: 'attach', iid, sid }) });
  else if (c.st === 'T') T.push({ sel: '.mat', act: iid => ({ type: 'play', iid }) });
  return T;
}
function bindDrag() {
  const me = meSeat(); if (me == null || G.rw) return;
  app.querySelectorAll('.handbar [data-hand]').forEach(el => {
    el.ondragstart = e => e.preventDefault();
    el.onpointerdown = e => {
      if (e.button > 0 || DRAG.live) return;
      const x = (G.view.p[me].hand || []).find(h => h.i === el.dataset.hand); if (!x) return;
      const plan = dragPlan(cinfo(x.c)), sx = e.clientX, sy = e.clientY, r0 = el.getBoundingClientRect();
      el.classList.add('grab'); // 잡으면 살짝 커짐
      let ghost = null, tgts = [], over = null;
      const start = () => {
        ghost = el.cloneNode(true); ghost.className = el.className.replace(/\bgrab\b/, '') + ' dragghost'; ghost.removeAttribute('data-hand');
        ghost.style.cssText = `width:${el.offsetWidth}px;left:${r0.left}px;top:${r0.top}px`; document.body.appendChild(ghost);
        el.classList.add('dragsrc'); DRAG.live = true; document.body.classList.add('dragging');
        tgts = plan.flatMap(p => [...app.querySelectorAll(p.sel)].map(t => ({ t, p })));
        tgts.forEach(o => o.t.classList.add('droptgt'));
        if (!tgts.length) toast('이 카드는 끌어서 놓을 곳이 없어요. 카드를 눌러 골라 주세요.', 2400);
        Sound.sfx('tap');
      };
      const hit = (cx, cy) => { // 손가락 아래에서 가장 안쪽(포켓몬 > 벤치 > 판) 놓을 곳
        let n = document.elementFromPoint(cx, cy);
        if (!n || n.closest('.handbar')) return null; // 손패로 돌려놓으면 취소
        for (; n && n !== document.body; n = n.parentElement) { const o = tgts.find(z => z.t === n); if (o) return o; }
        return null;
      };
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!ghost) { if (Math.hypot(dx, dy) < 8) return; start(); }
        ev.preventDefault();
        ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.18) rotate(${Math.max(-8, Math.min(8, dx / 30))}deg)`;
        const o = hit(ev.clientX, ev.clientY);
        if (o !== over) { over && over.t.classList.remove('dropon'); over = o; over && over.t.classList.add('dropon'); }
      };
      const end = (ev, cancel) => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cc);
        el.classList.remove('grab');
        if (!ghost) return; // 움직이지 않았으면 누르기(카드 창)
        DRAG.at = Date.now(); DRAG.live = false; document.body.classList.remove('dragging');
        tgts.forEach(o => o.t.classList.remove('droptgt', 'dropon'));
        const o = !cancel && (hit(ev.clientX, ev.clientY) || over), g = ghost; // 빛나던 곳에 놓임
        if (o) {
          const sid = o.p.slot ? o.t.dataset.sid : null; send(o.p.act(x.i, sid)); Sound.sfx('place');
          g.classList.add('dropin'); setTimeout(() => g.remove(), 180);
        } else { // 제자리로 돌아감 (아무 일도 하지 않음)
          g.classList.add('back'); g.style.transform = 'translate(0, 0) scale(1)';
          setTimeout(() => { g.remove(); el.classList.remove('dragsrc'); }, 230);
          return;
        }
        el.classList.remove('dragsrc');
      };
      const up = ev => end(ev, false), cc = ev => end(ev, true);
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cc);
    };
  });
}
function bindBoard() {
  const v = G.view, me = meSeat();
  app.querySelectorAll('[data-hand]').forEach(el => el.onclick = () => { if (Date.now() - DRAG.at < 350) return; onHandCard(el.dataset.hand); }); // 끌어 놓은 직후의 '누르기'는 무시
  bindDrag();
  app.querySelectorAll('.mat [data-sid]').forEach(el => { el.onclick = () => onSlot(el.dataset.sid); });
  bindToolPeek();
  app.querySelectorAll('[data-zone]').forEach(el => el.onclick = () => onZone(el.dataset.zone, +el.dataset.p));
  app.querySelectorAll('[data-zvopen]').forEach(el => el.onclick = () => openZoneView({ look: 1 }));
  if (me == null) app.querySelectorAll('.handbar .pc[data-k]').forEach(el => { el.classList.add('peekable'); el.onclick = () => { const x = (v.p[bottomSeat()].hand || []).find(h => String(h.i) === el.dataset.k); if (x) openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(cinfo(x.c))}`); }; });
  app.querySelectorAll('[data-pile]').forEach(el => { el.onclick = () => onPile(el.dataset.pile); el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPile(el.dataset.pile); } }; });
  app.querySelectorAll('[data-order]').forEach(el => el.onclick = () => send({ type: 'order', first: el.dataset.order === '1' }));
  app.querySelectorAll('[data-mull]').forEach(el => el.onclick = () => send({ type: 'mullDraw', n: +el.dataset.mull }));
  app.querySelectorAll('[data-confirm]').forEach(el => el.onclick = () => send({ type: 'confirm', pid: el.dataset.confirm }));
  app.querySelectorAll('[data-dismiss]').forEach(el => el.onclick = async () => { const f = await ask('다르게 처리할까요?', '<p>자동 제안 대신 도구로 직접 처리해요. 기록에 사람 판정으로 남아요.</p><label class="h">이유 (선택)</label><input name="note" maxlength="100" style="width:100%" placeholder="예: 특성 효과로 기절하지 않음">', '다르게 처리', 'judge'); if (f) send({ type: 'dismiss', pid: el.dataset.dismiss, note: f.note }); });
  app.querySelectorAll('[data-prize]').forEach(el => el.onclick = () => send({ type: 'confirm', pid: el.dataset.prize, k: +el.dataset.k }));
  app.querySelectorAll('[data-promote]').forEach(el => el.onclick = () => send({ type: 'confirm', pid: el.dataset.promote, sid: el.dataset.sid }));
  app.querySelectorAll('[data-agree]').forEach(el => el.onclick = () => send({ type: 'agree', gid: el.dataset.agree }));
  app.querySelectorAll('[data-agreeall]').forEach(el => el.onclick = async () => { el.disabled = true; for (const gid of el.dataset.agreeall.split(',')) if (!(await send({ type: 'agree', gid }))) break; });
  app.querySelectorAll('[data-dispute]').forEach(el => el.onclick = async () => { const f = await ask('어떤 점이 이상한가요?', '<input name="t" maxlength="200" style="width:100%" placeholder="예: 이 서포트는 벤치에서만 가져와요">', '이의 보내기', 'bad'); if (f) send({ type: 'dispute', gid: el.dataset.dispute, text: f.t }); });
  app.querySelectorAll('[data-rwask]').forEach(el => el.onclick = () => send({ type: 'rewindAsk', gid: el.dataset.rwask }));
  app.querySelectorAll('[data-stopend]').forEach(el => el.onclick = async () => { // 잠깐 멈춤 정리
    const how = el.dataset.stopend;
    if (how === 'keep') { const f = await ask('이대로 계속할까요?', '<p>내 행동이 맞다고 보고 그대로 진행해요. 기록에 남아요.</p><label class="h">이유 (선택)</label><input name="note" maxlength="200" style="width:100%" placeholder="예: 이 카드 효과로 한 번 더 붙일 수 있어요">', '이대로 계속'); if (f) send({ type: 'stopEnd', how, note: f.note }); return; }
    if (await send({ type: 'stopEnd', how }) && how === 'fix') toast("고친 뒤 왼쪽 '효과 끝'을 누르면 상대가 확인해요.", 3200);
  });
  app.querySelectorAll('[data-stopundo]').forEach(el => el.onclick = async () => { const st = G.view.stop; if (st && await ask('그 행동 바로 전으로 되돌릴까요?', `<p>「${esc(st.what || '지적한 행동')}」부터 그 뒤에 한 행동이 모두 취소되고, 기록에는 줄을 그어 남겨요.</p><p class="small"><span class="chip warn">이미 본 카드가 있어요</span> 덱이나 손패에서 본 카드는 잊을 수 없어요. 덱은 다시 섞여요.</p>`, '되돌리기', 'bad')) send({ type: 'stopUndo' }); });
  app.querySelectorAll('[data-rwno]').forEach(el => el.onclick = () => send({ type: 'rewindNo', gid: el.dataset.rwno }));
  app.querySelectorAll('[data-rwok]').forEach(el => el.onclick = async () => { if (await ask('이 판정 바로 전으로 되돌릴까요?', '<p>그 뒤에 한 행동이 모두 취소되고, 기록에는 줄을 그어 남겨요.</p><p class="small"><span class="chip warn">이미 본 카드가 있어요</span> 덱이나 손패에서 본 카드는 잊을 수 없어요. 덱은 다시 섞여요.</p>', '되돌리기', 'bad')) send({ type: 'rewindOk', to: +el.dataset.rwok }); });
  app.querySelectorAll('[data-uses]').forEach(el => { el.onclick = openUses; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUses(); } }; });
  app.querySelectorAll('[data-stadium]').forEach(el => el.onclick = () => { const c = cinfo(v.stadium.c); openSheet(`<button class="x sm" data-close>닫기</button>${me != null ? cardActHtml(c, `<div class="acts"><button class="judge" data-sd>트래시로${v.stadium.two ? ' (2장)' : ''}${FX}</button></div>`) : cardInfoHtml(c)}`, e2 => { if (me != null) e2.classList.add('cactsheet'); const b = e2.querySelector('[data-sd]'); if (b) b.onclick = () => { closeSheet(); send({ type: 'move', iids: [v.stadium.i], to: { z: 'discard', p: v.stadium.by } }); }; }); });
  app.querySelectorAll('[data-t]').forEach(el => el.onclick = async e => {
    const t = el.dataset.t;
    if (t === 'setupDone' && !G.view.p[me].active) return toast('먼저 손패의 기본 포켓몬을 눌러 배틀 포켓몬을 놓아 주세요.');
    if (t === 'setupDone' || t === 'endTurn' || t === 'lookEnd') return send({ type: t });
    if (t === 'rewatch') return startRewatch();
    if (t === 'follow') { const f = await setFollow(G.room, !G.follow); if (f != null) { G.follow = f; draw([]); } return; }
    if (t === 'shuffleMine') return send({ type: 'shuffle', p: me });
    if (t === 'log') return openLog(e?.target?.closest?.('.specb') ? 'spec' : undefined); // 눈 표시(관전자 수)를 누르면 관전자 목록 칸으로
    if (t === 'stop') { if (G.view.stop) { G.ui.dockMode = 'open'; draw([]); return; } return openStop(); }
    if (t === 'coin') return openCoin();
    if (t === 'effect') return openEffect();
    if (t === 'effectEnd') { send({ type: 'effectEnd' }); toast('효과를 끝냈어요. 상대가 확인할 수 있어요.'); return; }
    if (t === 'more') { const k = await pick('더 보기', [{ label: `${ICON.gear}설정`, value: 'set' },
        ...(fsOk() ? [{ label: inFs() ? `${ICON.shrink}전체 화면 끝내기` : `${ICON.expand}전체 화면`, value: 'fs' }] : isApp() || !isPhone() ? [] : [{ label: `${ICON.homeAdd}주소창 없이 보기`, value: 'a2hs' }]),
        { label: `${ICON.flag}항복하기`, value: 'concede', cls: 'bad' }]); // 로비로 나가기는 왼쪽 위 단추
      if (k === 'fs') toggleFs(); if (k === 'a2hs') openA2hs();
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
// 게임 중 리플레이 시작점: 내 차례면 직전 상대 차례 처음부터, 상대 차례면 지금 상대 차례 처음부터 (막 시작해 한 게 없으면 그 앞 상대 차례).
// 관전은 지금 차례 처음부터 (한 게 없으면 앞 차례). 시작할 때 어디부터인지 한 줄로 알려 줌
function rwStart() {
  const v = G.view, me = meSeat(), n = v.n ?? 0, names = [v.p[0].name, v.p[1].name];
  const T = G.lines.filter(l => l.turn && l.k >= 0).map(l => { const m = l.txt.match(/(\d+)번째 차례: (.+) \(/) || []; return { k0: l.k, no: m[1] || '?', who: names.indexOf(m[2]) }; })
    .filter((t, i, a) => i === 0 || t.k0 !== a[i - 1].k0);
  T.forEach((t, i) => { t.k1 = i + 1 < T.length ? T[i + 1].k0 : n; });
  if (!T.length || v.phase === 'setup') return { k: 0, msg: '대전 준비부터 보여 드려요' };
  const cur = T[T.length - 1], busy = t => t.k1 - t.k0 > 1; // 차례 시작 말고도 한 게 있음
  let t;
  if (me == null) t = busy(cur) || T.length < 2 ? cur : T[T.length - 2];
  else { const opp = T.filter(x => x.who === 1 - me); t = opp.length ? opp[opp.length - 1] : cur; if (t === cur && !busy(t) && opp.length > 1) t = opp[opp.length - 2]; }
  const who = t.who === me ? '내' : t.who >= 0 ? `${names[t.who]} 님` : '';
  return { k: t.k0, t, msg: `${who} ${t.no}번째 차례 처음부터 보여 드려요` };
}
const rwKey = t => `rw:${G.id}:${t.k0}:${t.k1}`;
function rwSeen(t) { try { return localStorage.getItem(rwKey(t)) === '1'; } catch { return false; } }
// ---------- 리플레이 (판 위에서 그대로, 판 크기는 그대로) ----------
// 차례 단위로 이동(이전 차례 · 다음 차례), 그 안에서 한 수씩(‹ ›), 재생·멈춤. 위에는 지금 수의 설명, 아래에는 조작 막대
const turnStartsOf = lines => [...new Set(lines.filter(l => l.turn && l.k >= 0).map(l => l.k))].sort((a, b) => a - b);
async function startRewatch(opt = {}) { // 대전 중: 기본은 상대의 마지막 차례 처음부터
  if (G.rw) return;
  const me = meSeat(), n = G.view.n ?? 0, lines = G.lines;
  const t = lastOppTurn(), fresh = !!(t && !rwSeen(t)); // 새로 본 적 없는 상대 차례면 처음부터 자동 재생
  const st = rwStart(), k = opt.k != null ? opt.k : st.k;
  if (opt.k == null) toast(st.msg, 2400);
  if (t) try { localStorage.setItem(rwKey(t), '1'); } catch {}
  G.rw = { mode: 'game', id: G.id, me, n, k, lines, views: {}, playing: fresh && opt.k == null, timer: null, prev: null, start: k };
  await vwLoad(G.rw, k); if (!G.rw) return;
  drawRw(false); rwPlan(); vwPrefetch(G.rw);
}
async function vwLoad(rw, k) { // 그 수의 판 (한 번 받은 건 기억)
  if (rw.views[k]) return rw.views[k];
  const r = await api(`/api/games/${rw.id}/at?k=${k}`);
  return rw.views[k] = { ...r.view, me: rw.me, n: r.n, deadline: null, cfg: (G.view && G.view.cfg) || r.view.cfg };
}
function vwPrefetch(rw) { for (const d of [1, 2, 3, -1]) { const k = rw.k + d; if (k >= 0 && k <= rw.n && !rw.views[k]) vwLoad(rw, k).catch(() => {}); } }
function rwPlan() { // 자동 재생: 한 수마다 천천히, 끝까지 가면 멈춤
  const rw = G.rw; if (!rw) return; clearTimeout(rw.timer);
  if (rw.playing && rw.k < rw.n) rw.timer = setTimeout(() => rwGo(rw.k + 1, true), rw.k === rw.start ? 1100 : 1900);
  else if (rw.k >= rw.n && rw.playing) { rw.playing = false; drawRw(false); }
}
async function rwGo(k, auto = false) {
  const rw = G.rw; if (!rw) return; k = Math.max(0, Math.min(rw.n, k)); if (k === rw.k) return;
  if (!auto) rw.playing = false;
  try { await vwLoad(rw, k); } catch (e) { toast(e.message || '불러오지 못했어요.'); return; }
  if (G.rw !== rw) return;
  const fwd = k === rw.k + 1; rw.k = k;
  if (rw.mode === 'page') history.replaceState(null, '', `#replay/${rw.id}/${k}`);
  drawRw(fwd); rwPlan(); vwPrefetch(rw);
}
function rwTurnJump(d) {
  const rw = G.rw; if (!rw) return; const ts = turnStartsOf(rw.lines);
  if (d < 0) { const back = [...ts].reverse().find(t => t < rw.k); rwGo(back ?? 0); }
  else { const fw = ts.find(t => t > rw.k); rwGo(fw ?? rw.n); }
}
function endRewatch() {
  const rw = G.rw; if (!rw) return; clearTimeout(rw.timer); G.rw = null;
  if (rw.mode === 'page') { leavePage(rw.over || rw.me == null ? '#lobby' : `#game/${rw.id}`); return; }
  draw([]);
}
document.addEventListener('keydown', e => { // PC: ← → 한 수, Shift + ← → 차례, 스페이스 재생·멈춤, Esc 닫기
  const rw = G && G.rw; if (!rw || e.target.closest('input, textarea') || !$('#sheet').hidden) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const d = e.key === 'ArrowRight' ? 1 : -1; e.shiftKey ? rwTurnJump(d) : rwGo(rw.k + d); }
  else if (e.key === ' ') { e.preventDefault(); rw.playing = !rw.playing; drawRw(false); rwPlan(); }
  else if (e.key === 'Escape') endRewatch();
});
const stripWho = (txt, name) => txt.startsWith(name + ': ') ? txt.slice(name.length + 2) : txt;
function rwLoc(v) { // 카드 번호 → 있는 곳
  const m = new Map();
  for (const p of [0, 1]) {
    const P = v.p[p];
    (P.hand || []).forEach(x => m.set(x.i, `hand:${p}`)); P.discard.forEach(x => m.set(x.i, `disc:${p}`)); P.lost.forEach(x => m.set(x.i, `lost:${p}`));
    (P.prizes || []).forEach(x => x && m.set(x.i, `prz:${p}`));
    for (const sl of [P.active, ...P.bench]) if (sl && !sl.hidden) [...sl.cards, ...sl.en, ...sl.tl].forEach(x => m.set(x.i, `slot:${sl.sid}`));
  }
  if (v.stadium) { m.set(v.stadium.i, 'stad'); if (v.stadium.two) m.set(v.stadium.two.i, 'stad'); }
  return m;
}
function rwTargets(a, b, lines = [], judged = false) { // 두 장면 사이에 바뀐 곳: [{s: 화면 요소 선택자, kind: move(움직임) | target(기술 대상) | judge(사람 판정) | big(센 장면)}]
  const A = rwLoc(a), B = rwLoc(b), out = [], rank = { move: 0, target: 1, judge: 2, big: 3 };
  const add = (s, kind = 'move') => { const o = out.find(x => x.s === s); if (!o) out.push({ s, kind }); else if (rank[kind] > rank[o.kind]) o.kind = kind; };
  const ko = lines.some(l => /기절|프라이즈/.test(l.txt || ''));
  const sel = (loc, i) => { const [z, p] = loc.split(':');
    if (z === 'slot') return `.mat [data-sid="${p}"]`; if (z === 'disc') return `.pile.disc[data-p="${p}"]`; if (z === 'lost') return `.lostc[data-p="${p}"]`;
    if (z === 'prz') return `.prizes[data-p="${p}"]`; if (z === 'stad') return '.stadium';
    if (z === 'hand') return +p === bottomSeat() ? `.handbar [data-k="${i}"]` : '.ohand'; return null; };
  const st = v => { const o = {}; for (const p of [0, 1]) [v.p[p].active, ...v.p[p].bench].forEach((sl, j) => { if (sl && !sl.hidden) o[sl.sid] = { dmg: sl.dmg || 0, cond: JSON.stringify(sl.cond || {}), pos: `${p}:${j ? 'b' : 'a'}`, p }; }); return o; };
  const sa = st(a), sb = st(b);
  for (const sid in sb) { // 데미지·상태 이상이 바뀐 포켓몬 = 기술 대상, 100 넘게 받으면 센 장면
    const x = sa[sid], y = sb[sid]; if (!x) continue;
    if (y.dmg - x.dmg >= 100) add(`.mat [data-sid="${sid}"]`, 'big');
    else if (y.dmg !== x.dmg || y.cond !== x.cond) add(`.mat [data-sid="${sid}"]`, 'target');
    else if (y.pos !== x.pos) add(`.mat [data-sid="${sid}"]`);
  }
  for (const sid in sa) if (!sb[sid] && sa[sid].dmg > 0) add(`.pile.disc[data-p="${sa[sid].p}"]`, 'big'); // 기절해서 트래시로
  for (const [i, loc] of B) if (A.get(i) !== loc) { const s2 = sel(loc, i); if (s2) add(s2, ko && /^\.(pile\.disc|prizes)/.test(s2) ? 'big' : 'move'); }
  for (const p of [0, 1]) {
    if (a.p[p].deck.n !== b.p[p].deck.n) add(`.pile.deck[data-p="${p}"]`);
    if (!b.p[p].hand && a.p[p].handN !== b.p[p].handN) add(+p === bottomSeat() ? '.handbar' : '.ohand');
    if (a.p[p].prizesN !== b.p[p].prizesN) add(`.prizes[data-p="${p}"]`, 'big');
  }
  if (judged) out.forEach(o => { if (o.kind !== 'big' || o.s.startsWith('.mat')) o.kind = 'judge'; }); // 사람이 판정한 단계: 기절·프라이즈 말고는 모두 말풍선
  return out.sort((x, y) => rank[y.kind] - rank[x.kind]).slice(0, 5);
}
// 강조 틀 (링크 님이 고른 것, '가는 테두리 도감' 기준): 움직임 = 14번 볼 띠, 기술 대상 = 6번 자 눈금, 센 장면 = 1번 색 어긋남, 사람 판정 = C-2 촘촘 구름 말풍선 + 에어브러시
let HLN = 0;
function hlFrame(w, h, kind = 'move') {
  const f = n => (+n).toFixed(1), o = 2, x0 = o, y0 = o, x1 = w - o, y1 = h - o, cx = w / 2, cy = h / 2;
  if (kind === 'judge') return hlCloud(w, h, f, x0, y0, x1, y1);
  const ln = (d, sw = 1.4, c = '#fff', cls = '', op = 1) => `<path class="${cls}" d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
  const dr = (d, sw = 1.4) => `<path class="hd" pathLength="1" d="${d}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const svg = body => `<svg viewBox="0 0 ${f(w)} ${f(h)}" aria-hidden="true">${body}</svg>`;
  if (kind === 'big') { // 흰 선 뒤로 빨간 선이 대각선으로 살짝 어긋나 있음
    const c = Math.max(6, Math.min(9, Math.min(w, h) * .09));
    const P = `M${f(x0)} ${f(y0)}L${f(x1 - c)} ${f(y0)}L${f(x1)} ${f(y0 + c)}L${f(x1)} ${f(y1)}L${f(x0 + c)} ${f(y1)}L${f(x0)} ${f(y1 - c)}Z`;
    return svg(`<g class="hsnap"><g class="hbreathe">${ln(P, 1.6, '#ff3b4e')}</g></g>${dr(P)}`);
  }
  if (kind === 'target') { // 안쪽 위아래에 자 눈금, 가운데만 길게. 위쪽 작은 삼각형이 눈금 위를 오감
    const r = 3; let t = '';
    for (let x = x0 + 7; x <= x1 - 7 + .1; x += 7.5) { const L = Math.abs(x - cx) < 3.8 ? 4.6 : 2.4; t += `M${f(x)} ${f(y0 + .8)}v${L}M${f(x)} ${f(y1 - .8)}v${-L}`; }
    const rr = `M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}A${r} ${r} 0 0 1 ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}A${r} ${r} 0 0 1 ${f(x1 - r)} ${f(y1)}H${f(x0 + r)}A${r} ${r} 0 0 1 ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}A${r} ${r} 0 0 1 ${f(x0 + r)} ${f(y0)}Z`;
    const tx = x0 + 10, dist = Math.max(0, x1 - 10 - tx);
    return svg(`${dr(rr, 1.25)}${ln(t, .8, '#fff', 'hlate', .9)}<g class="hlate"><g class="hsweep" style="--dist:${f(dist)}px"><path d="M${f(tx - 3)} ${f(y0 - 6.5)}L${f(tx + 3)} ${f(y0 - 6.5)}L${f(tx)} ${f(y0 - 2.5)}Z" fill="#fff"/></g></g>`);
  }
  // 둥근 가는 선의 양옆 가운데가 끊기고 작은 볼 버튼 고리 (6-약 버튼과 같은 잔물결)
  const r = Math.max(5, Math.min(11, Math.min(w, h) * .14)), g = 5.4;
  const top = `M${f(x1)} ${f(cy - g)}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 0 ${f(x1 - r)} ${f(y0)}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 0 ${f(x0)} ${f(y0 + r)}V${f(cy - g)}`;
  const bot = `M${f(x0)} ${f(cy + g)}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x0 + r)} ${f(y1)}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x1)} ${f(y1 - r)}V${f(cy + g)}`;
  const ring = (x, dl) => `<g class="hpop"><circle cx="${f(x)}" cy="${f(cy)}" r="3.4" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="${f(x)}" cy="${f(cy)}" r="1.2" fill="#fff"/></g><g class="hlate"><circle class="hping" style="animation-delay:${dl}s" cx="${f(x)}" cy="${f(cy)}" r="3.4" fill="none" stroke="#fff" stroke-width="1"/></g>`;
  return svg(`${dr(top)}${dr(bot)}${ln(`M${f(x0 - 3.4)} ${f(cy)}h-5M${f(x1 + 3.4)} ${f(cy)}h5`, 1.2, '#fff', 'hlate')}${ring(x0, 0)}${ring(x1, -1.3)}`);
}
// 사람 판정: 모서리가 크게 둥근 말풍선의 변을 따라 작은 혹이 촘촘히 이어지고(3.8초에 한 번 1배 ↔ 1.5배로 숨 쉬기),
// 꼬리는 왼쪽 아래, 위쪽 오른편 틈에 하늘색 점 세 개. 에어브러시 질감은 요소 크기를 절반쯤 따라가게 맞춤(카드 너비 133px 기준)
function hlCloud(w, h, f, x0, y0, x1, y1) {
  const cw = Math.max(20, w - 12), sd = Math.min(1.15, Math.max(.55, Math.pow(cw / 133, .55))), u = 1.108 * sd;
  const r = Math.min(22 * sd, Math.min(w, h) * .3), gE = x1 - r, gS = gE - 24.4 * sd;
  const tE = x0 + r + 5.5 * u, tS = tE + 11.5 * u, tx = tE - 5.5 * u, ty = y1 + 12 * u;
  const bw = 12.7 * sd, bh = 2.66 * sd;
  const fill = (a, b) => { const len = Math.abs(b - a); if (len < bw * .5) return []; const n = Math.max(1, Math.round(len / bw)), st = (b - a) / n; return Array.from({ length: n }, (_, i) => [a + st * (i + .5), Math.abs(st)]); };
  const top = gS - 2 > x0 + r + 2 ? fill(x0 + r + 2, gS - 2) : [], right = fill(y0 + r + 2, y1 - r), bot = x1 - r - 2 > tS + 3 ? fill(x1 - r - 2, tS + 3) : [], left = fill(y1 - r, y0 + r + 2);
  const D = m => { const hh = f(bh * m);
    let d = `M${f(x1 - r)} ${f(y0)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}`;
    for (const [c, bw2] of right) d += `V${f(c - bw2 / 2)}A${f(bw2 / 2)} ${hh} 90 0 1 ${f(x1)} ${f(c + bw2 / 2)}`;
    d += `V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}`;
    for (const [c, bw2] of bot) d += `H${f(c + bw2 / 2)}A${f(bw2 / 2)} ${hh} 0 0 1 ${f(c - bw2 / 2)} ${f(y1)}`;
    d += `H${f(tS)}C${f(tS - 2 * u)} ${f(y1 + 6 * u)} ${f(tS - 8 * u)} ${f(y1 + 10.5 * u)} ${f(tx)} ${f(ty)}C${f(tx + 4.5 * u)} ${f(y1 + 8.5 * u)} ${f(tx + 6 * u)} ${f(y1 + 4 * u)} ${f(tE)} ${f(y1)}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}`;
    for (const [c, bw2] of left) d += `V${f(c + bw2 / 2)}A${f(bw2 / 2)} ${hh} 90 0 1 ${f(x0)} ${f(c - bw2 / 2)}`;
    d += `V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}`;
    for (const [c, bw2] of top) d += `H${f(c - bw2 / 2)}A${f(bw2 / 2)} ${hh} 0 0 1 ${f(c + bw2 / 2)} ${f(y0)}`;
    return d + `H${f(gS)}`; };
  const dA = D(1), dB = D(1.5), id = 'hla' + (++HLN), q = Math.pow(cw / 133, .45), n4 = v => (+v).toFixed(3);
  const anim = reduceMotion() ? '' : `<animate attributeName="d" values="${dA};${dB};${dA}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="3.8s" repeatCount="indefinite"/>`;
  const air = `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur in="SourceGraphic" stdDeviation="${n4(1.389 * q)}" result="soft"/><feTurbulence type="fractalNoise" baseFrequency="${n4(1.444 / q)}" numOctaves="1" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -1.25" result="dots"/><feComposite in="soft" in2="dots" operator="in" result="spray"/><feGaussianBlur in="SourceGraphic" stdDeviation="${n4(.833 * q)}" result="core"/><feMerge><feMergeNode in="spray"/><feMergeNode in="spray"/><feMergeNode in="core"/></feMerge></filter>`;
  const dr = Math.max(1.8, 2.55 * sd), dots = [6, 11.5, 17].map((x, i) => `<circle class="hdot" style="animation-delay:${(i * .22).toFixed(2)}s" cx="${f(gS + x * u)}" cy="${f(y0)}" r="${f(dr)}" fill="#a6deff"/>`).join('');
  return `<svg viewBox="0 0 ${f(w)} ${f(h)}" aria-hidden="true"><defs>${air}</defs><g filter="url(#${id})"><path class="hd" pathLength="1" d="${dA}" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${anim}</path><g class="hlate">${dots}</g></g></svg>`;
}
function rwHighlight(sels, quiet = false) { // quiet: 다시 그릴 때 같은 틀을 움직임 없이 바로
  const layer = app.querySelector('.hl-layer'), tb = app.querySelector('.table'); if (!layer || !tb) return;
  layer.classList.toggle('still', quiet);
  sels.forEach(t => app.querySelectorAll(t.s).forEach(el => el.classList.add('rwon')));
  setTimeout(() => { // 카드가 다 움직인 뒤에 틀을 그림
    if (!layer.isConnected) return;
    const T = tb.getBoundingClientRect(), m = 6, pn = app.querySelector('.vw')?.getBoundingClientRect();
    const lim = pn ? pn.top : T.bottom; // 아래 조작 막대 위까지만
    layer.innerHTML = sels.flatMap(t => [...app.querySelectorAll(t.s)].slice(0, 1).map(el => [el, t.kind])).map(([el, kind]) => {
      const r = el.getBoundingClientRect(); if (!r.width) return '';
      const top = Math.max(r.top, T.top + m), bot = Math.min(r.bottom, lim - m); if (bot - top < 8) return '';
      const w = r.width + m * 2, h = bot - top + m * 2;
      return `<div class="hlf${kind === 'judge' ? ' soft' : ''}" style="left:${(r.left - T.left - m).toFixed(1)}px;top:${(top - T.top - m).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px">${hlFrame(w, h, kind)}</div>`;
    }).join('');
  }, reduceMotion() || quiet ? 0 : 520);
}
// 리플레이 행동 기록 전체: 지금 수는 주황 테두리, 앞으로 올 수는 흐리게. 줄을 누르면 그 장면으로
function scrollInside(box, el) { // 상자 안에서만 el이 가운데 오게 (scrollIntoView는 창까지 굴려서 제목이 숨음). el이 없으면 맨 아래
  if (!box) return; if (!el) { box.scrollTop = box.scrollHeight; return; }
  box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - (box.clientHeight - el.offsetHeight) / 2;
}
function openRwLog() {
  const rw = G.rw; if (!rw) return;
  const gs = Object.fromEntries((G.view.groups || []).map(g => [g.gid, g]));
  const at = l => l.k >= 0 ? `data-k2="${l.k + 1}" role="button" tabindex="0"` : 'data-k2="0" role="button" tabindex="0"';
  const curK = Math.max(0, ...rw.lines.map(l => (l.k ?? -1) + 1).filter(x => x <= rw.k)); // 지금 수에 줄이 없으면(숨은 행동) 바로 앞 줄을 지금으로
  const html = logBlocks(rw.lines, (l, o, headAttr) => {
    if (headAttr) return at(l);
    const st = (l.k ?? -1) + 1 === curK && !l.turn ? 'cur' : (l.k ?? -1) + 1 > rw.k ? 'later' : '';
    const g = l.gid && gs[l.gid], jc = l.gid ? `<i class="lj ${g && g.status === 'ok' ? 'ok' : g && g.status === 'disputed' ? 'warn' : 'judge'}">${ICON[g && g.status === 'ok' ? 'check' : g && g.status === 'disputed' ? 'warn' : 'judge']}</i>` : '';
    return `<div class="ln ${o.cls} ${l.chat ? 'chat' : ''} ${l.gid ? 'j' : ''} ${l.rw ? 'rw' : ''} ${st}" ${at(l)}><b class="lk">${(l.k ?? -1) + 1}</b>${esc(l.chat ? l.txt : o.txt)}${jc}${l.own ? ` <span class="own">(${esc(l.own)})</span>` : ''}</div>`;
  });
  openSheet(`<button class="x sm" data-close>닫기</button><h3>행동 기록 <small class="muted">${rw.k} / ${rw.n}수</small></h3><p class="small muted rwlh">줄을 누르면 그 장면으로 가요. 지금 보는 수는 주황 테두리예요.</p><div class="log rwlog">${html || '<p class="muted">아직 기록이 없어요.</p>'}</div>`, el => {
    el.classList.add('rwlogsheet');
    const cur = el.querySelector('.ln.cur') || [...el.querySelectorAll('.ln:not(.later)')].pop(); scrollInside(el.querySelector('.rwlog'), cur);
    el.querySelectorAll('[data-k2]').forEach(r => { const go = () => { const k = +r.dataset.k2; closeSheet(); setTimeout(() => { rw.playing = false; rwGo(k); }, 40); }; r.onclick = go; r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
  });
}
function drawRw(forward) {
  const rw = G.rw, live = G.view, liveLines = G.lines, names = [0, 1].map(p => (rw.views[rw.k] || live).p[p].name);
  const prevRects = app.querySelector('.mat') ? snapRects() : null;
  const cur = rw.views[rw.k], before = rw.k > 0 ? rw.views[rw.k - 1] : null;
  const ts = turnStartsOf(rw.lines), ti = ts.filter(t => t <= rw.k).length - 1; // 지금 몇 번째 차례 안인지
  const tl = ti >= 0 ? rw.lines.find(l => l.turn && l.k === ts[ti]) : null, tm = tl ? tl.txt.match(/(\d+)번째 차례: (.+) \(/) : null;
  const owner = tm ? names.indexOf(tm[2]) : -1, side = owner < 0 ? 'sys' : owner === (rw.me == null ? 0 : rw.me) ? 'me' : 'op';
  const stepLines = rw.k > 0 ? rw.lines.filter(l => l.k === rw.k - 1) : [];
  const who = owner >= 0 ? names[owner] : '';
  const caps = stepLines.filter(l => l.txt && !l.turn).map(l => esc(who ? stripWho(l.txt, who) : l.txt) + (l.own ? ` <span class="muted">(${esc(l.own)})</span>` : ''));
  const turnL = stepLines.find(l => l.turn), drew = turnL ? (turnL.txt.match(/\(([^)]+)\)/) || [])[1] : '';
  const cap = rw.k === 0 ? '대전 준비부터 한 수씩 볼 수 있어요.' : turnL ? `차례를 시작했어요${drew ? ` (${esc(drew)})` : ''}.` : caps.length ? caps.join(' · ') : '차례를 넘겼어요.';
  const end = rw.k >= rw.n;
  G.view = cur; G.lines = rw.lines.filter(l => l.k < rw.k);
  // 판·두 사람 손패·모든 카드는 대전 때와 똑같이 보임 (가리는 것 없음).
  // 조작은 판 왼쪽 가운데 리모컨 두 줄(왼쪽 줄 = 뒤로, 오른쪽 줄 = 앞으로), 설명은 배틀 포켓몬 오른쪽 빈자리의 카드 한 장
  const rf = (k, ic, l, lb, dis, cls = '') => `<div class="fabw"><button class="fab k-rw2 ${cls}" data-rw="${k}" aria-label="${l}" ${dis ? 'disabled' : ''}>${FAB_FX}<span class="core">${FAB_ICON[ic]}</span></button><span class="fl">${lb}</span></div>`;
  const playB = end ? (rw.mode === 'game' ? rf('close', 'check', '판으로 돌아가기', '판으로', false, 'k-go on') : rf('play', 'play', '재생', '재생', true, 'k-play'))
    : rf('play', rw.playing ? 'pause' : 'play', rw.playing ? '멈춤' : '재생', rw.playing ? '멈춤' : '재생', false, 'k-play' + (rw.playing ? ' on' : ''));
  const turnTxt = tm ? `${tm[1]}번째 차례` : '대전 준비';
  const ctl = `<div class="rwpad" role="group" aria-label="리플레이 조작">${rf('close', 'x', '리플레이 닫기', '닫기', false, 'k-close')}${playB}
      ${rf('tprev', 'rwfirst', '이전 차례로', '이전<br>차례', rw.k <= 0)}${rf('tnext', 'rwlast', '다음 차례로', '다음<br>차례', end)}
      ${rf('prev', 'rwprev', '한 수 뒤로', '한 수<br>뒤로', rw.k <= 0)}${rf('next', 'rwnext', '한 수 앞으로', '한 수<br>앞으로', end)}</div>
    <div class="vwbox"><div class="vwcap ${side}" role="button" tabindex="0" aria-label="행동 기록 전체 보기" title="누르면 행동 기록 전체"><div class="vwtop">${who ? `<b class="vwh">${esc(who)}</b>` : ''}<span class="vwn">${esc(turnTxt)}</span><span class="vwk">${rw.k} / ${rw.n}수</span><span class="vwlg" aria-hidden="true">${ICON.chat}<span>전체 기록</span></span></div><div class="vwt">${cap}</div></div></div>`;
  app.innerHTML = `<div class="arena rwmode"><div class="table">${matHtml(true, ctl)}<div class="hl-layer"></div>
    </div>${lobbyBtn()}</div>`;
  app.querySelectorAll('[data-rw]').forEach(b => b.onclick = () => {
    const k = b.dataset.rw;
    if (k === 'close') return endRewatch();
    if (k === 'play') { rw.playing = !rw.playing; drawRw(false); rwPlan(); return; }
    if (k === 'prev' || k === 'next') return rwGo(rw.k + (k === 'next' ? 1 : -1));
    rwTurnJump(k === 'tnext' ? 1 : -1);
  });
  app.querySelectorAll('.handbar [data-hand]').forEach(el => el.onclick = () => { const x = (cur.p[bottomSeat()].hand || []).find(h => String(h.i) === el.dataset.hand); if (x) openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(cinfo(x.c))}`); });
  const onCur = fn => e => { const sv = G.view; G.view = cur; try { fn(e); } finally { G.view = sv; } }; // 대전 중 리플레이: 누를 때도 그 장면 기준
  app.querySelectorAll('.mat [data-sid]').forEach(el => el.onclick = onCur(() => { const f = findSlot(el.dataset.sid); if (f) openSheet(`<button class="x sm" data-close>닫기</button>${slotInfoHtml(f)}`, bindCardPeek); }));
  bindToolPeek(() => cur);
  app.querySelectorAll('[data-zone]').forEach(el => el.onclick = onCur(() => onZone(el.dataset.zone, +el.dataset.p)));
  app.querySelectorAll('.mat [data-stadium]').forEach(el => el.onclick = () => { const x = cur.stadium; if (x) openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(cinfo(x.c))}`); });
  const vc = app.querySelector('.vwcap'); if (vc) { vc.onclick = openRwLog; vc.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRwLog(); } }; }
  flip(prevRects);
  if (before && forward) {
    if (rw.prev) { effects(rw.prev, stepLines); gameSounds(rw.prev, stepLines); }
    // 사람이 판정한 단계 = 경고를 넘기고 진행·자동 제안 대신 직접(⚑), 또는 카드 효과 묶음 안에서 손으로 한 처리
    const gStart = Object.fromEntries(((rw.mode === 'game' ? live : cur).groups || []).map(g => [g.gid, g.start]));
    const judged = stepLines.some(l => /^⚑/.test(l.txt || '') || (l.gid && l.gid in gStart && gStart[l.gid] !== l.k));
    rwHighlight(rwTargets(before, cur, stepLines, judged));
  } else if (before) rwHighlight(rwTargets(before, cur, stepLines, false));
  rw.prev = JSON.parse(JSON.stringify(cur));
  if (rw.mode === 'game') { G.view = live; G.lines = liveLines; }
}

// 끝난 판·지난 판의 리플레이 (로비의 '리플레이' 버튼): 대전 화면과 같은 판, 같은 조작
async function renderReplay(id, k0) {
  app.innerHTML = '<div class="arena-loading"><div class="spin-ball"></div><p>리플레이를 불러오는 중…</p></div>';
  document.body.classList.add('in-game');
  loadCards().catch(() => {});
  let info; try { info = await api(`/api/games/${id}/info`); } catch (e) { app.innerHTML = `<p class="pad">${esc(e.message)}</p>`; return; }
  const k = k0 >= 0 ? Math.min(k0, info.n) : info.over ? 0 : info.n;
  G = { id, view: null, lines: info.lines, cards: info.cards, specs: [], ui: {} };
  const rw = { mode: 'page', id, me: info.me, n: info.n, k, lines: info.lines, views: {}, playing: false, timer: null, prev: null, start: k, over: info.over };
  G.rw = rw;
  leaveGame = () => { if (G.rw) clearTimeout(G.rw.timer); G.rw = null; document.body.classList.remove('in-game'); };
  try { await vwLoad(rw, k); } catch (e) { app.innerHTML = `<p class="pad">${esc(e.message)}</p>`; return; }
  G.view = rw.views[k];
  drawRw(false); vwPrefetch(rw);
  guardPage('한 번 더 누르면 리플레이를 닫아요');
}

document.addEventListener('error', e => { const im = e.target; if (im.tagName === 'IMG' && !im.dataset.f) { im.dataset.f = 1; const d = document.createElement('div'); d.className = 'ph'; d.textContent = im.alt || '카드'; d.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.72rem;padding:2px;word-break:keep-all;aspect-ratio:63/88'; im.replaceWith(d); } }, true);
// 잔잔한 배경: 천천히 흐르는 구름 몇 겹, 아주 느리게 도는 햇살, 아래에서 떠오르는 빛 알갱이 (움직임 줄이기 설정이면 멈춤)
(function ambient() { // 디지털 경기장: 지나가는 빛 띠 + 격자 위에서 깜빡이는 점
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blips = Array.from({ length: 16 }, () => { const d = 5 + r() * 4; return `<i class="bl" style="--x:${(r() * 100).toFixed(1)}vw;--y:${(r() * 100).toFixed(1)}vh;--s:${(3 + r() * 3).toFixed(1)}px;--d:${d.toFixed(1)}s;--dl:${(-r() * d).toFixed(1)}s"></i>`; }).join('');
  document.body.insertAdjacentHTML('afterbegin', `<div id="amb" aria-hidden="true"><i class="sw"></i>${blips}</div>`);
})();
route();
