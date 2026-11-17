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
  zoom: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  star: svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>'),
  paste: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>'),
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
  { k: 'dzoom', t: '크게 보기 첫 화면', d: "'크게 보기'를 누르면 먼저 나오는 그림이에요. 영문판은 워터마크가 없어요. 열린 뒤에도 바꿀 수 있어요.", o: [['en', '영문판'], ['mix', '합친 카드'], ['kr', '한글판']] },
  { k: 'dinfo', t: '카드 밑 글자', d: '덱과 카드 추가 창에서 이름과 번호를 숨기면 카드만 보여요.', o: [['show', '보이기'], ['hide', '숨기기']] },
  { k: 'dsize', t: '카드 크기', d: '덱과 카드 추가 창의 카드 크기예요.', o: [['s', '작게'], ['m', '보통'], ['l', '크게']] },
];
const DISP_DEF = { dimg: 'mix', dtext: 'ko', ddet: 'text', dzoom: 'mix', dinfo: 'show', dsize: 'm' };
const DISP_PRESETS = [
  ['rec', '추천', '작게도 크게도 합친 카드, 글자는 한국어', {}],
  ['cardonly', '카드만', '설명 없이 카드 그림만', { ddet: 'card', dinfo: 'hide' }],
  ['en', '영어로만', '카드 그림도 글자도 영문판', { dimg: 'en', dtext: 'en', dzoom: 'en' }],
  ['kr', '한글판만', '어디서든 한글판 그림', { dimg: 'kr', dzoom: 'kr' }],
].map(([k, l, d, o]) => ({ k, l, d, v: { ...DISP_DEF, ...o } }));
const sameDisp = (a, b) => DISP_OPTS.every(o => a[o.k] === b[o.k]);
const validDisp = (o, src, base) => { const out = { ...base }; for (const x of DISP_OPTS) if (src && x.o.some(y => y[0] === src[x.k])) out[x.k] = src[x.k]; return out; };
const groupDisp = () => validDisp(DISP_OPTS, SK.group, DISP_DEF);
let D = { ...DISP_DEF };
function applyDisp() {
  const p = SK.prefs || {}, g = groupDisp();
  if (p.disp === 'mine') D = validDisp(DISP_OPTS, p, g);
  else if (!p.disp && (p.art === 'en' || p.art === 'kr')) D = { ...g, dimg: p.art, ...(p.art === 'kr' ? { dzoom: 'kr' } : {}) }; // 예전 '카드 그림' 설정
  else D = g;
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
// 카드 그림: kr = 한글판, en = 영문판(워터마크 없음), mix = 합친 카드(한글판 위에 그림 칸만 같은 그림의 영문판)
const hires = u => u ? u.replace(/\.png$/, '_hires.png') : null;
const canMix = c => !!(c && c.kimg && c.img && c.ksa && !(c.st === 'E' && (c.sub || []).includes('Basic'))); // 영문판과 한글판 그림이 같은 카드만 (기본 에너지는 글 칸이 없어 뺌)
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
  if (c.kra === 'AR') return [11.5, 50.5];
  if (s.includes('ex') || /^(SAR|SR|UR|HR|MUR|SSR|BWR)$/.test(c.kra || '')) return [12, 50.9];
  return [11.8, 47.4]; // 보통 포켓몬: 진화 줄 아래 ~ 도감 줄 위
};
function picHtml(c, want, big = false) { // 카드 그림 <img> (합친 카드는 두 장 겹침). 감싸는 칸은 position: relative
  const m = picMode(c, want); if (!m) return '';
  const nm = esc(cname(c)), lazy = big ? '' : 'loading="lazy"';
  const en = big ? hires(c.img) : c.img, fb = big ? ` onerror="if(!this.dataset.s){this.dataset.s=1;this.src='${c.img}'}"` : '';
  if (m === 'mix') { const [t, b, ace] = BAND(c), clip = ace ? `;clip-path:polygon(0 ${t}%,100% ${t}%,100% 55.5%,90.5% 55.5%,90.5% ${b}%,0 ${b}%)` : ''; return `<img src="${c.kimg}" alt="${nm}" referrerpolicy="no-referrer" ${lazy} draggable="false"><img class="band" src="${en}" alt="" referrerpolicy="no-referrer" ${lazy} draggable="false" style="--bt:${t}%;--bb:${100 - b}%${clip}"${fb}>`; }
  return `<img src="${m === 'kr' ? c.kimg : en}" alt="${nm}" referrerpolicy="no-referrer" ${lazy} draggable="false"${m === 'en' ? fb : ''}>`;
}
const cnameKo = c => { if (!c) return '?'; if (c.kn) return c.kn; if (!c.ko) return c.n; let k = c.ko; if (/^Mega /.test(c.n)) k = '메가' + k; if (/ ex$/.test(c.n)) k += ' ex'; return k; };
const cname = c => !c ? '?' : D.dtext === 'en' && !c.kro ? c.n : cnameKo(c); // 화면에 쓰는 이름 (카드 글자 설정)
const altName = c => D.dtext === 'both' && c && !c.kro && c.n !== cnameKo(c) ? c.n : ''; // '한국어 + 영어 이름'일 때 덧붙일 영문 이름

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
  const sub = SUBVIEW ? 1 : 0; SUBVIEW = null;
  sh.hidden = true; sh.innerHTML = ''; sheetStack.length = 0;
  if (!fromPop) { popSkip++; history.go(-1 - sub); }
}
// ---------- 뒤로 가기 ----------
// 순서: 크게 보기 → 창 안의 자세히 보기 → 선택 창 → 기보 보기 → 페이지. 대전·기보·덱 고치기는 두 번 눌러야 나감 (첫 번째엔 안내, 덱을 고쳤으면 저장할지 물음)
let GUARD = null, SUBVIEW = null, popSkip = 0, navCount = 0;
function guardPage(msg, onLeave) { if (GUARD) clearTimeout(GUARD.t); GUARD = { hash: location.hash, msg, onLeave, t: 0, armed: 0 }; history.pushState({ guard: 1 }, ''); }
function rearm() { if (GUARD && location.hash === GUARD.hash && !GUARD.leaving) { GUARD.armed = 0; history.pushState({ guard: 1 }, ''); } }
function leavePage(fallback) { // 화면의 '닫기'로 나갈 때: 지킴 칸을 건너뛰고 바로 앞 페이지로
  if (GUARD) { GUARD.leaving = true; clearTimeout(GUARD.t); }
  if (navCount > 1 && GUARD && !GUARD.armed) history.go(-2); else location.hash = fallback;
}
window.addEventListener('popstate', () => {
  if (popSkip) { popSkip--; return; }
  if (ZOOM) { closeZoom(); return; }
  if (SUBVIEW) { SUBVIEW(); return; }
  if (!$('#sheet').hidden) { closeSheet(true); return; }
  if (!GUARD || GUARD.leaving || location.hash !== GUARD.hash) return; // 다른 페이지로 가는 중 (hashchange가 그림)
  if (G && G.rw && G.rw.mode === 'game') { endRewatch(); rearm(); return; }
  const fn = GUARD.onLeave && GUARD.onLeave();
  if (fn) { rearm(); fn(); return; }
  if (GUARD.armed) return;
  GUARD.armed = 1; toast(GUARD.msg, 2200); clearTimeout(GUARD.t);
  GUARD.t = setTimeout(() => { if (GUARD && GUARD.armed) rearm(); }, 2200);
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
  if (GUARD) { clearTimeout(GUARD.t); GUARD = null; } SUBVIEW = null; navCount++;
  if (!ME) { try { await loadMe(); } catch { ME = null; } }
  else if (Date.now() - meAt > 60000) loadMe().catch(() => {}); // 관리자가 바꾼 모임 기본값을 가끔 다시 받아 옴
  const h = location.hash || '#lobby';
  if (!ME && h !== '#login') { location.hash = '#login'; return; }
  const [base, arg] = h.split('/');
  armFs(base);
  document.body.classList.toggle('nohdr', base === '#game' || base === '#replay'); // 맨 위 머리줄은 로비·덱 목록·설정에서만 (덱 고치기는 deckEditor에서 숨김)
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

// ---------- 폰에서 주소창 줄이기: 홈 화면에 추가(앱처럼 열림), 안드로이드는 대전판에서 전체 화면 ----------
// 브라우저는 사람이 누르기 전에는 전체 화면을 막아 두고, 아이폰 사파리는 웹페이지 전체 화면을 아예 막아 둠 → 아이폰은 홈 화면에 추가를 안내
const UA = navigator.userAgent;
const IS_IOS = /iPhone|iPod|iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const IS_KAKAO = /KAKAOTALK/i.test(UA), IS_SAMSUNG = /SamsungBrowser/i.test(UA);
const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
const isApp = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: minimal-ui)').matches || (matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement); // 전체 화면 버튼으로 바꾼 것은 앱이 아님
const fsOk = () => !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
const inFs = () => !!document.fullscreenElement;
const fsAuto = () => pref('fsAuto', 'on') === 'on';
let installEvt = null, fsArm = false;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.querySelectorAll('[data-a2hs]').forEach(b => b.innerHTML = `${ICON.homeAdd}설치하기`); });
window.addEventListener('appinstalled', () => { installEvt = null; setPref('a2hs', 'done'); document.querySelector('.a2hs')?.remove(); });
const fsEnter = () => document.documentElement.requestFullscreen({ navigationUI: 'hide' });
function toggleFs() { if (inFs()) document.exitFullscreen().catch(() => {}); else fsEnter().catch(() => toast('이 브라우저는 전체 화면을 허락하지 않아요. 홈 화면에 추가해 보세요.')); }
// 대전판·기보에 들어온 뒤 처음 누를 때 전체 화면. 스스로 빠져나오면 다음에 판에 들어올 때까지 다시 바꾸지 않음
function armFs(base) { fsArm = (base === '#game' || base === '#replay') && fsAuto() && fsOk() && isPhone() && !isApp() && !inFs(); }
document.addEventListener('pointerup', () => { if (fsArm) { fsArm = false; if (!inFs()) fsEnter().catch(() => {}); } }, true);
function a2hsBanner() {
  if (!isPhone() || isApp() || pref('a2hs', '')) return '';
  return `<div class="a2hs">${ringIcon('homeAdd', 'k-open')}<div class="a2t"><b>주소창 없이 크게 보기</b><span>홈 화면에 추가해 앱처럼 열기</span></div>
    <button class="primary sm" data-a2hs>${ICON.homeAdd}${installEvt ? '설치하기' : '방법 보기'}</button><button class="sm ib" data-a2hs-x aria-label="안내 닫기">${ICON.x}</button></div>`;
}
function bindA2hs(root) {
  root.querySelectorAll('[data-a2hs]').forEach(b => b.onclick = openA2hs);
  root.querySelectorAll('[data-a2hs-x]').forEach(b => b.onclick = () => { setPref('a2hs', 'hide'); b.closest('.a2hs')?.remove(); toast('설정 → 폰 화면에서 언제든 다시 볼 수 있어요.'); });
}
async function openA2hs() {
  if (installEvt) { // 안드로이드 크롬: 브라우저의 설치 창을 바로 띄움
    const e = installEvt; installEvt = null; e.prompt();
    const r = await e.userChoice.catch(() => null);
    if (r && r.outcome === 'accepted') { setPref('a2hs', 'done'); document.querySelector('.a2hs')?.remove(); toast('홈 화면의 도란 대전 아이콘으로 열어 주세요.'); }
    return;
  }
  const st = (ic, t) => `<li><i class="a2ic">${ic}</i><span>${t}</span></li>`, dots = '<b class="a2dots">⋮</b>';
  const open3 = st(`<img src="/icons/icon-192.png" alt="">`, '홈 화면에 생긴 <b>도란 대전</b> 아이콘으로 열어요.');
  const steps = IS_KAKAO ? [st(IS_IOS ? ICON.share : dots, `카카오톡 화면 ${IS_IOS ? '오른쪽 아래 <b>공유</b>' : '오른쪽 위 <b>⋮</b>'} 단추를 누르고 <b>다른 브라우저로 열기</b>를 골라요.`), st(ICON.homeAdd, '열린 브라우저에서 이 안내(설정 → 폰 화면)를 다시 열어 주세요.')]
    : IS_IOS ? [st(ICON.share, '화면 아래쪽(아이패드는 위쪽) <b>공유</b> 단추를 눌러요.'), st(ICON.homeAdd, '목록을 내려 <b>홈 화면에 추가</b>를 누르고, 오른쪽 위 <b>추가</b>를 눌러요.'), open3]
    : IS_SAMSUNG ? [st('<b class="a2dots">≡</b>', '화면 아래쪽 <b>≡</b> 메뉴를 눌러요.'), st(ICON.homeAdd, '<b>현재 페이지 추가</b> → <b>홈 화면</b>을 눌러요.'), open3]
    : [st(dots, '화면 오른쪽 위 <b>⋮</b> 메뉴를 눌러요.'), st(ICON.homeAdd, '<b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러요.'), open3];
  openSheet(`<button class="x sm" data-close>닫기</button><h3>주소창 없이 크게 보기</h3>
    <p class="muted small" style="margin-top:0">홈 화면에 추가하면 주소창 없이 앱처럼 열려요. ${IS_IOS ? '아이폰은 맨 위 시계 줄만 남아요.' : '안드로이드는 맨 위 시계 줄까지 숨겨져요.'}</p>
    <ol class="a2steps">${steps.join('')}</ol>
    <p class="small muted" style="margin:0">홈 화면에서 처음 열 때 입장 코드를 한 번 더 넣어야 할 수도 있어요.</p>`);
}
function screenHtml() { // 설정 → 폰 화면
  const rows = [];
  if (fsOk()) rows.push(`<div class="r"><span class="nm">전체 화면</span><button class="sw" data-fsauto aria-label="대전판에 들어가면 전체 화면으로"></button><button class="sm" data-fsnow>${inFs() ? `${ICON.shrink}전체 화면 끝내기` : `${ICON.expand}지금 전체 화면`}</button></div>`);
  rows.push(`<div class="r"><span class="nm">홈 화면 추가</span>${isApp() ? '<span class="small muted">지금 앱으로 열려 있어요</span>' : `<button class="sm" data-a2hs>${ICON.homeAdd}${installEvt ? '설치하기' : '방법 보기'}</button>`}</div>`);
  return `<section class="set"><h3>폰 화면</h3><div class="snd">${rows.join('')}
    <p class="small muted" style="margin:0">홈 화면에 추가하면 주소창 없이 앱처럼 열려요.${fsOk() ? ' 전체 화면을 켜 두면 폰에서 대전판에 들어가 처음 누를 때 주소창이 사라져요(아이폰 사파리는 지원하지 않아요).' : ''} 이 설정은 이 기기에만 저장돼요.</p></div></section>`;
}
document.addEventListener('fullscreenchange', () => document.querySelectorAll('[data-fsnow]').forEach(b => b.innerHTML = inFs() ? `${ICON.shrink}전체 화면 끝내기` : `${ICON.expand}지금 전체 화면`));

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
    ${dispHtml(false)}
    <section class="set"><h3>소리</h3><div class="snd">
      <div class="r"><span class="nm">효과음</span><button class="sw" data-sw="sfx" aria-label="효과음 켜고 끄기"></button><input type="range" min="0" max="100" value="${vol('sfxVol')}" style="--v:${vol('sfxVol')}%" data-vol="sfxVol" aria-label="효과음 크기"><button class="sm" data-try>${ICON.play}들어 보기</button></div>
      <div class="r"><span class="nm">배경음악</span><button class="sw" data-sw="bgm" aria-label="배경음악 켜고 끄기"></button><input type="range" min="0" max="100" value="${vol('bgmVol')}" style="--v:${vol('bgmVol')}%" data-vol="bgmVol" aria-label="배경음악 크기"></div>
      <p class="small muted" style="margin:0">효과음과 배경음악은 모두 이 사이트에서 직접 만든 소리예요. 소리 설정은 이 기기에만 저장돼요.</p></div></section>
    ${screenHtml()}
    ${!inSheet && SK.admin ? `<section class="set admin"><h3>모임 기본값 <span class="chip k-admin">관리자</span></h3>
      <p class="small muted">처음 들어온 사람과 '모임 기본'을 고른 사람에게 보이는 모양이에요. 각자 다른 것을 고른 사람은 그대로예요.</p>
      ${admin('back', '카드 뒷면')}${admin('mat', '매트')}
      ${dispHtml(true)}</section>` : ''}
    ${inSheet ? '' : `<section class="set"><h3>내 정보</h3><div class="row"><span class="grow">${esc(ME.name)} 님으로 들어와 있어요.</span><button id="lo">로그아웃</button></div></section>`}`;
}
// 카드 표시: 빠른 설정(모임 기본·추천·카드만·영어로만·한글판만) + 항목별로 고르기. admin = 모임 기본값 고르기
function dispHtml(admin) {
  const cur = admin ? groupDisp() : D, g = groupDisp(), mineOn = !admin && SK.prefs?.disp === 'mine';
  const pre = DISP_PRESETS.find(x => sameDisp(x.v, cur));
  const nowName = !admin && !mineOn && SK.prefs?.disp !== 'mine' ? '모임 기본' : pre ? pre.l : '직접 고름';
  const rows = [...(admin ? [] : [{ k: 'group', l: '모임 기본 따르기', d: `관리자가 정한 모양이에요. 지금: ${(DISP_PRESETS.find(x => sameDisp(x.v, g)) || { l: '직접 고른 조합' }).l}` }]), ...DISP_PRESETS];
  const on = r => admin ? pre && pre.k === r.k : r.k === 'group' ? !mineOn : mineOn && pre && pre.k === r.k;
  return `${admin ? '<h4>카드 표시</h4>' : `<section class="set disp"><h3>카드 표시 <span class="chip">${esc(nowName)}</span></h3>`}
    <div class="seg dpre">${rows.map(r => `<button class="opt ${r.k === 'group' ? 'wide' : ''} ${on(r) ? 'on' : ''}" aria-pressed="${!!on(r)}" data-dpre="${r.k}" data-scope="${admin ? 'group' : 'me'}"><span>${esc(r.l)}<small class="sub">${esc(r.d)}</small></span></button>`).join('')}</div>
    ${[['판과 카드 정보', ['dimg', 'dtext', 'ddet', 'dzoom']], ['덱 만들기', ['dinfo', 'dsize']]].map(([gt, ks]) => `<div class="dgh">${esc(gt)}</div><div class="dopts n${ks.length}">${DISP_OPTS.filter(o => ks.includes(o.k)).map(o => `<div class="dopt"><h5 id="do-${admin ? 'g' : 'm'}-${o.k}">${esc(o.t)}</h5>${o.d && !admin ? `<p class="small muted">${esc(o.d)}</p>` : ''}<div class="seg2 n${o.o.length}" role="group" aria-labelledby="do-${admin ? 'g' : 'm'}-${o.k}">${o.o.map(([v, l]) => `<button class="sm ${cur[o.k] === v ? 'on' : ''}" aria-pressed="${cur[o.k] === v}" data-dk="${o.k}" data-v="${v}" data-scope="${admin ? 'group' : 'me'}">${esc(l)}</button>`).join('')}</div></div>`).join('')}</div>`).join('')}
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
  const curOf = { back: () => SK.prefs?.back || 'group', mat: () => SK.prefs?.mat || 'group', art: () => SK.prefs?.art || 'group',
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
  bindA2hs(root);
  root.querySelectorAll('[data-vol]').forEach(r => { r.oninput = () => { Sound.set(r.dataset.vol, r.value / 100); r.style.setProperty('--v', r.value + '%'); }; r.onchange = () => { if (r.dataset.vol === 'sfxVol') Sound.sfx('coin'); }; });
  const tr = root.querySelector('[data-try]');
  if (tr) tr.onclick = () => ['draw', 'place', 'attack', 'coin', 'turnMine'].forEach((n, i) => setTimeout(() => Sound.sfx(n), i * 450));
  const lo = root.querySelector('#lo');
  if (lo) lo.onclick = async () => { await api('/api/logout', {}); ME = null; try { localStorage.removeItem('skin'); } catch {} setSkin({}); location.hash = '#login'; };
}
function renderSettings() {
  app.innerHTML = `<div class="card-box" style="max-width:860px;margin:0 auto"><h2>설정</h2><p class="muted small" style="margin-top:0">고르면 바로 바뀌어요. 카드 뒷면·매트·카드 표시는 내 계정에 저장돼서 다른 기기에서도 그대로예요.</p><div class="setwrap">${settingsHtml(false)}</div></div>`;
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
  if (lobbyTab === 'new' || !['mine', 'open', 'watch', 'done'].includes(lobbyTab)) lobbyTab = 'mine';
  const tabs = [['mine', '내 대전', mine.length], ['open', '들어갈 방', open.length], ['watch', '관전', watch.length], ['done', '끝난 판', done.length]];
  // 방 하나 = 카드 한 장: 위 색 띠(상태) · 방 이름 · 두 사람 · 진행 방식 · 남은 시간 · 단추. 줄 위치는 모든 카드가 같음 (값이 없으면 —)
  const roomCard = r => {
    const last = r.games[r.games.length - 1];
    const st = r.status === 'open' ? ['open', 'door', '모집 중'] : r.myTurn ? ['turn', 'bolt', '내 차례'] : r.status === 'playing' ? (r.mine ? ['wait', 'wait', r.phase === 'setup' ? '준비 중' : `${r.turn || 0}번째 차례`] : ['watch', 'eye', r.phase === 'setup' ? '준비 중' : `${r.turn || 0}번째 차례`]) : ['done', 'trophy', r.status === 'between' ? '다음 판 기다림' : '끝남'];
    const nm = [0, 1].map(i => r.names[i] || '');
    const who = n => n ? `<span class="rp"><i class="av">${esc(n.slice(0, 1))}</i><b>${esc(n)}</b></span>` : '<span class="rp empty"><i class="av">?</i><b>기다리는 중</b></span>';
    const score = r.wins && (r.status === 'done' || r.status === 'between') ? `<span class="rsc">${r.wins.join(' : ')}</span>` : '<span class="rvs">vs</span>';
    const left = r.deadline && r.status === 'playing' ? `<span class="rleft">${ICON.wait}${fmtLeft(r.deadline - Date.now())}</span>` : `<span class="rleft none">${r.cfg.invite ? `초대: ${esc(r.cfg.invite)}` : '—'}</span>`;
    let main = '';
    if (r.status === 'open' && !r.mine) main = `<button class="primary sm" data-join="${r.id}">${ICON.door}들어가기</button>`;
    else if (r.status === 'open' && r.host === data.me) main = `<button class="sm" data-close-room="${r.id}">${ICON.x}방 닫기</button>`;
    else if (r.status === 'between' && r.mine) main = `<button class="primary sm" data-next="${r.id}">${ICON.play}다음 판</button>`;
    else if (last && r.status === 'playing') main = `<a class="btn ${r.mine ? 'primary' : ''} sm" href="#game/${last}">${r.mine ? `${ICON.battle}판으로` : `${ICON.eye}관전`}</a>`;
    const rec = last && r.status !== 'open' ? `<a class="btn sm" href="#replay/${last}">${ICON.rewind}기보</a>` : '';
    return `<article class="rcard s-${st[0]}"><div class="rtop">${ringIcon(st[1], 'k-' + st[0], r.myTurn)}<span class="rst">${st[2]}</span></div>
      <h4 class="rt">${esc(r.cfg.title || nm.filter(Boolean).join(' vs '))}</h4>
      <div class="rvsrow">${who(nm[0])}${score}${who(nm[1])}</div>
      <div class="rmode">${esc(modeKo(r.cfg))}</div>${left}
      <div class="rbtns2">${main}${rec}</div></article>`;
  };
  const lists = { mine, open, watch, done }, cur = lists[lobbyTab] || [];
  const emptyMsg = { mine: '진행 중인 대전이 없어요. 방을 만들거나 들어갈 방을 찾아보세요.', open: '들어갈 수 있는 방이 없어요. 직접 방을 만들어 보세요.', watch: '지금 관전할 대전이 없어요.', done: '끝난 판이 아직 없어요.' }[lobbyTab];
  app.innerHTML = `<div class="lobh"><h2>대전</h2><button class="primary newroom" data-tab="new">${ICON.plus}방 만들기</button></div>${a2hsBanner()}
    <div class="ltabs" role="tablist">${tabs.map(([k, l, n]) => `<button class="ltab ${lobbyTab === k ? 'on' : ''}" role="tab" aria-selected="${lobbyTab === k}" data-tab="${k}">${l}<b>${n}</b>${k === 'mine' && myTurnN ? `<i class="dot" title="내 차례 ${myTurnN}"></i>` : ''}</button>`).join('')}</div>
    ${cur.length ? `<div class="rlist">${cur.map(roomCard).join('')}</div>` : `<div class="empty-note">${ringIcon('wait', 'k-wait')}<p>${emptyMsg}</p></div>`}`;
  app.querySelectorAll('.ltab[data-tab]').forEach(b => b.onclick = () => { lobbyTab = b.dataset.tab; try { localStorage.setItem('lobbyTab', lobbyTab); } catch {} renderLobby(); });
  const rl = app.querySelector('.rlist'); // 가로 화면: 마우스 휠을 가로 스크롤로
  if (rl) rl.addEventListener('wheel', e => { if (getComputedStyle(rl).overflowX === 'auto' && Math.abs(e.deltaY) > Math.abs(e.deltaX) && rl.scrollWidth > rl.clientWidth) { rl.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  const chooseDeck = async () => {
    const ok = decks.decks; if (!ok.length) { toast('먼저 덱을 만들어 주세요.'); location.hash = '#decks'; return null; }
    return pick('어떤 덱으로 할까요?', ok.map(d => ({ label: esc(d.name) + (d.ok ? '' : ` <span class="chip warn">규칙 확인</span>`), value: d.id })));
  };
  app.querySelectorAll('[data-join]').forEach(b => b.onclick = async () => {
    const deckId = await chooseDeck(); if (!deckId) return;
    try { const r = await api(`/api/rooms/${b.dataset.join}/join`, { deckId }); location.hash = '#game/' + r.room.games[r.room.games.length - 1]; } catch (e) { toast(e.message); }
  });
  app.querySelectorAll('[data-next]').forEach(b => b.onclick = async () => { try { const r = await api(`/api/rooms/${b.dataset.next}/next`, {}); location.hash = '#game/' + r.room.games[r.room.games.length - 1]; } catch (e) { toast(e.message); } });
  app.querySelectorAll('[data-close-room]').forEach(b => b.onclick = async () => { await api(`/api/rooms/${b.dataset.closeRoom}/close`, {}); renderLobby(); });
  bindA2hs(app);
  app.querySelector('.newroom').onclick = () => openSheet(newRoomForm(decks.decks), el => {
    const f = el.querySelector('#newroom'); if (!f) return;
    const syncDl = () => { const a = f.querySelector('input[name=mode]:checked')?.value === 'async'; f.querySelector('.dlrow').hidden = !a; };
    f.querySelectorAll('input[name=mode]').forEach(x => x.onchange = syncDl); syncDl();
    f.onsubmit = async e => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(f));
      try { await api('/api/rooms', fd); closeSheet(); lobbyTab = 'mine'; try { localStorage.setItem('lobbyTab', 'mine'); } catch {} toast('방을 만들었어요. 상대가 들어오면 시작해요.'); setTimeout(renderLobby, 40); } catch (er) { toast(er.message); }
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
    <label class="h">관전</label>${seg('spectate', [['yes', '허용', '공개 정보만'], ['no', '끔'], ['open', '손패 공개', '연습·가르치기']], 'yes')}
    <label class="h">초대 <small class="muted">이 이름만 들어올 수 있어요. 비우면 누구나</small></label><input name="invite" maxlength="12" style="width:100%">
    <div class="acts1"><button class="primary">${ICON.plus}방 만들기</button></div></form>`;
}

// ---------- 덱 ----------
async function renderDecks(editId) {
  app.innerHTML = '<p class="muted pad">카드 자료를 불러오는 중…</p>';
  await loadCards();
  const { decks } = await api('/api/decks');
  if (editId) return deckEditor(decks.find(d => d.id === editId) || { name: '새 덱', list: [] });
  app.innerHTML = `<div class="row" style="margin-bottom:10px"><h2 class="grow">내 덱</h2></div>
    <div class="dtiles"><button class="dtile new" id="nd"><span class="fan">${ringIcon('plus', 'k-ok')}</span><span class="dtl"><span class="dtr"><b>새 덱 만들기</b></span><small>카드를 골라 60장을 채워요</small></span></button>${decks.map(d => { const ch = checkDeck(d.list, IDX);
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
const fkey = c => c._fk ||= c.st + '|' + (c.st === 'P' ? [c.n, c.hp, (c.sub || []).join(','), (c.at || []).map(a => a.n + (a.d || '')).join(';'), (c.ab || []).map(a => a.n).join(';')].join('|') : c.n);
let PRINTS = null;
function printsOf(c) { // 같은 카드의 다른 그림들 (보이는 그림이 같은 것은 하나만)
  if (!PRINTS) {
    PRINTS = new Map(); ALL.forEach((x, i) => { x._ix = i; const k = fkey(x); if (!PRINTS.has(k)) PRINTS.set(k, []); PRINTS.get(k).push(x); });
    for (const [k, xs] of PRINTS) PRINTS.set(k, xs.sort((a, b) => (REG_RARE.has(a.kra) ? 0 : 1) - (REG_RARE.has(b.kra) ? 0 : 1) || b._ix - a._ix));
  }
  const xs = PRINTS.get(fkey(c)) || [c], seen = new Set();
  return xs.filter(x => { const u = picKey(x); if (seen.has(u)) return false; seen.add(u); return true; });
}
const picKey = x => D.dimg === 'en' || !x.kimg ? x.img || x.id : x.kimg;
function deckEditor(deck) {
  let list = deck.list.map(x => ({ ...x }));
  document.body.classList.add('nohdr');
  const snap = () => JSON.stringify([($('#dn') || {}).value ?? deck.name, list.map(x => [x.id, x.n, x.c || 0]).sort()]);
  const saved0 = JSON.stringify([deck.name, deck.list.map(x => [x.id, x.n, x.c || 0]).sort()]);
  const dirty = () => snap() !== saved0 && !(deck.id == null && !list.length);
  const count = () => list.reduce((a, b) => a + b.n, 0);
  const KIND = { P: '포켓몬', T: '트레이너스', E: '에너지' }, KIND_EN = { P: 'Pokémon', T: 'Trainer', E: 'Energy' };
  const kindName = st => D.dtext === 'en' ? KIND_EN[st] : KIND[st];
  const setNo = c => D.dtext !== 'en' && c.kset ? `${c.kset} ${c.kno || ''}` : `${c.set || ''} ${c.no || ''}`;
  const hexN = n => `<span class="hexn"><b>${n}</b></span>`;
  const tile = (c, n, extra = '', note = '') => `<div class="dkc" data-id="${c.id}">${picMode(c, D.dimg) ? `<span class="cpic">${picHtml(c, D.dimg)}</span>` : `<div class="ph">${esc(cname(c))}</div>`}${n ? hexN(n) : ''}${extra}<div class="cnm">${esc(cname(c))}${altName(c) ? `<small class="alt">${esc(altName(c))}</small>` : D.dtext === 'both' ? '<small class="alt">&nbsp;</small>' : ''}</div><div class="muted cno">${esc(setNo(c))}${note}</div></div>`;
  let view = 'kind'; try { view = localStorage.getItem('dkView') === 'all' ? 'all' : 'kind'; } catch {}
  // 위쪽은 한 줄: 뒤로 · 덱 이름 · 장수(규칙) · 카드 추가 · 더 보기 · 저장
  app.innerHTML = `<div class="dk-top"><button class="sm ib" id="back" aria-label="덱 목록으로">${ICON.back}</button><input id="dn" value="${esc(deck.name)}" maxlength="30" aria-label="덱 이름" placeholder="덱 이름"><button type="button" id="cnt" class="cntb" aria-label="덱 규칙 보기"></button><button class="primary sm" id="add">${ICON.plus}<span class="lb">카드 추가</span></button><button class="sm ib" id="more" aria-label="더 보기">${FAB_ICON.more}</button><button class="good sm" id="save">${ICON.check}<span class="lb">저장</span></button></div>
    <div id="lst"></div>`;
  const drawList = () => {
    const ch = checkDeck(list, IDX), cb = $('#cnt');
    cb.className = 'cntb ' + (ch.ok ? 'ok' : 'warn'); cb.innerHTML = `${ch.ok ? ICON.check : ICON.warn}<b>${count()}</b><span>/ 60</span>`; cb.title = ch.ok ? '덱 규칙 통과' : ch.problems.join(' / ');
    const sorted = [...list].sort((a, b) => ('PTE'.indexOf(IDX.byId[a.id].st) - 'PTE'.indexOf(IDX.byId[b.id].st)) || cname(IDX.byId[a.id]).localeCompare(cname(IDX.byId[b.id])));
    const per = st => sorted.filter(x => IDX.byId[x.id].st === st), sum = xs => xs.reduce((a, b) => a + b.n, 0);
    const vsw = `<span class="vsw" role="group" aria-label="보기 방식">${[['kind', '종류별'], ['all', '한꺼번에']].map(([k, l]) => `<button type="button" data-v="${k}" class="${view === k ? 'on' : ''}" aria-pressed="${view === k}">${l}</button>`).join('')}</span>`;
    const grid = xs => `<div class="dkgrid sz-${D.dsize}${D.dinfo === 'hide' ? ' noinfo' : ''}">${xs.map(x => tile(IDX.byId[x.id], x.n, x.c ? `<span class="cvstar" title="덱 목록에 보이는 대표 카드">${ICON.star}</span>` : '')).join('')}</div>`;
    $('#lst').innerHTML = !list.length ? `<div class="empty-note">${ringIcon('deck', 'k-ok')}<p>아직 카드가 없어요.</p><div class="row"><button class="primary" id="add2">${ICON.plus}카드 추가</button><button id="imp">${ICON.paste}리스트 붙여 넣기</button></div></div>`
      : view === 'all' ? `<div class="dgrp"><span class="dkst">${[...'PTE'].map(st => `<span>${kindName(st)} <b>${sum(per(st))}</b></span>`).join('')}</span>${vsw}</div>${grid(sorted)}` // 보기 단추는 첫 머리 줄 오른쪽 (줄을 따로 쓰지 않음)
      : [...'PTE'].filter(st => per(st).length).map((st, i) => { const xs = per(st); return `<div class="dgrp"><span>${kindName(st)} <small>${sum(xs)}장</small></span>${i === 0 ? vsw : ''}</div>${grid(xs)}`; }).join('');
    $('#lst').querySelectorAll('.dkc').forEach(el => el.onclick = () => cardSheet(el.dataset.id));
    const a2 = $('#add2'); if (a2) a2.onclick = openAdd; const im = $('#imp'); if (im) im.onclick = openImp;
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
  const openAdd = () => {
    let q = '', filt = 'all';
    try { q = localStorage.getItem('addQ') || ''; filt = localStorage.getItem('addTab') || 'all'; } catch {}
    if (!['all', 'P', 'T', 'E'].includes(filt)) filt = 'all';
    const TABS = [['all', 'deck', '전체'], ['P', 'battle', '포켓몬'], ['T', 'user', '트레이너스'], ['E', 'bolt', '에너지']];
    openSheet(`<div class="adds"><div class="addh"><h3>카드 추가</h3><span class="chip" id="acnt"></span><label class="addq">${ICON.search}<input id="q" placeholder="${innerWidth < 480 ? '카드 이름 검색' : '이름 검색 (피카츄, ㅍㅋㅊ, vzc)'}" autocomplete="off" value="${esc(q)}"></label><button class="sm ib" data-close aria-label="닫기">${ICON.x}</button></div>
      <nav class="addt" aria-label="카드 종류">${TABS.map(([k, ic, l]) => `<button type="button" class="lgt ${k === filt ? 'on' : ''}" data-f="${k}">${ICON[ic]}<span>${l}</span></button>`).join('')}</nav>
      <div class="addr"><div id="res" class="dkgrid add sz-${D.dsize}${D.dinfo === 'hide' ? ' noinfo' : ''}"></div></div><div class="addi" hidden></div></div>`, el => {
      el.classList.add('wide', 'addsheet');
      const repOf = c => { const ps = printsOf(c), inDeck = ps.find(p => list.some(x => x.id === p.id)); return IDX.byId[artPick[fkey(c)]] || inDeck || ps[0]; };
      const nIn = c => { const ids = new Set(printsOf(c).map(p => p.id)); return list.filter(x => ids.has(x.id) || fkey(IDX.byId[x.id]) === fkey(c)).reduce((a, b) => a + b.n, 0); };
      const minusId = c => { const r = repOf(c); if (list.some(x => x.id === r.id)) return r.id; const k = fkey(c); return list.find(x => fkey(IDX.byId[x.id]) === k)?.id; };
      const draw = () => {
        el.querySelector('#acnt').textContent = count() + ' / 60';
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
        info.innerHTML = `<div class="addih"><button class="sm" data-back>${ICON.back}<span>목록으로</span></button><span class="chip">덱에 ${n}장</span></div><div class="addib">${cardInfoHtml(cur)}
          ${ps.length > 1 ? `<label class="h">그림 고르기 <small class="muted">넣을 그림을 골라요 (효과는 같아요)</small></label><div class="artrow">${ps.map(p => `<button type="button" class="artc ${p.id === cur.id ? 'on' : ''}" data-art="${p.id}" aria-pressed="${p.id === cur.id}" title="${esc(setNo(p))}"><span class="cpic">${picHtml(p, D.dimg)}</span><small>${esc(setNo(p))}</small></button>`).join('')}</div>` : ''}</div>
          <div class="addia"><button class="primary" data-a="1">${ICON.plus}1장 넣기</button><button data-a="-1" ${n ? '' : 'disabled'}>${ICON.minus}1장 빼기</button></div>`;
        if (open) { info.hidden = false; info.scrollTop = 0; SUBVIEW = () => { info.hidden = true; SUBVIEW = null; draw(); }; history.pushState({ sub: 1 }, ''); }
        info.querySelector('[data-back]').onclick = () => history.back();
        info.querySelectorAll('[data-art]').forEach(b => b.onclick = () => { artPick[fkey(c)] = b.dataset.art; showInfo(c, false); });
        info.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (+b.dataset.a > 0) addN(repOf(c).id, 1); else { const id = minusId(c); if (id) addN(id, -1); } Sound.sfx('place'); showInfo(c, false); });
        const z = info.querySelector('[data-zoom]'); if (z) z.onclick = () => openZoom(z.dataset.zoom);
      };
      const qi = el.querySelector('#q'); qi.oninput = () => { q = qi.value; try { localStorage.setItem('addQ', q); } catch {} draw(); };
      el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filt = b.dataset.f; try { localStorage.setItem('addTab', filt); } catch {} el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
      draw(); if (matchMedia('(hover: hover)').matches) { qi.focus(); qi.select(); }
    });
  };
  const openImp = () => openSheet(`<button class="x sm" data-close>닫기</button><h3>리스트 붙여 넣기</h3><p class="small muted">PTCGL에서 내보낸 덱 리스트를 붙여 넣으면 지금 리스트를 바꿔요.</p><textarea id="paste" placeholder="4 Pikachu ex SVP 106&#10;..."></textarea><div class="row" style="margin-top:8px"><button id="go" class="primary">불러오기</button></div><div id="bad" class="small"></div>`, el => {
    el.querySelector('#go').onclick = () => { const r = parseDeckList(el.querySelector('#paste').value, IDX); list = r.list; drawList(); if (r.bad.length) el.querySelector('#bad').innerHTML = '못 찾은 줄: ' + r.bad.map(esc).join(' · '); else { closeSheet(); toast('리스트를 모두 불러왔어요.'); } };
  });
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
  $('#add').onclick = openAdd;
  $('#cnt').onclick = () => { const ch = checkDeck(list, IDX); openSheet(`<button class="x sm" data-close>닫기</button><h3>덱 규칙</h3>${ch.ok ? '<p><span class="chip ok">덱 규칙 통과</span> 60장, 같은 이름 4장까지, 기본 포켓몬 1장 이상을 모두 지켰어요.</p>' : `<ul class="probs">${ch.problems.map(p => `<li>${ICON.warn}<span>${esc(p)}</span></li>`).join('')}</ul>`}`); };
  $('#more').onclick = async () => { const k = await pick('덱 더 보기', [{ label: `${ICON.paste}리스트 붙여 넣기`, value: 'imp' }, ...(deck.id ? [{ label: '덱 지우기', value: 'del', cls: 'bad' }] : [])]);
    if (k === 'imp') setTimeout(openImp, 40);
    if (k === 'del' && await ask('덱을 지울까요?', '<p>지우면 되돌릴 수 없어요.</p>', '지우기', 'bad')) { await api('/api/decks/' + deck.id, null, 'DELETE'); GUARD = null; go('#decks'); } };
  $('#save').onclick = save;
  guardPage('한 번 더 누르면 덱 목록으로 가요', () => dirty() ? leave : null);
  drawList();
}
function cardInfoHtml(c) { // 카드를 눌렀을 때: 글자 + 작은 카드 / 카드만 크게 (표시 설정)
  if (!c) return '<p>카드 정보가 없어요.</p>';
  const en = D.dtext === 'en' && !c.kro, alt = s2 => D.dtext === 'both' && s2 ? `<small class="alt">${esc(s2)}</small>` : '';
  const pic = picMode(c, D.dimg) ? `<div class="big"><span class="cpic">${picHtml(c, D.dimg, D.ddet === 'card')}</span><button class="sm zbtn" data-zoom="${esc(c.id)}">${ICON.zoom}크게 보기</button></div>` : '';
  if (D.ddet === 'card' && pic) return `<div class="cardinfo only">${pic}</div>`;
  const cost = cs => (cs || []).map(t => typeIcon(t, 'ecost', `title="${TYPE_KO[t] || t}"`)).join('');
  const L = en ? { ab: 'Ability', w: 'Weakness', r: 'Resistance', rt: 'Retreat', reg: 'Regulation' } : { ab: '특성', w: '약점', r: '저항력', rt: '후퇴', reg: '레귤레이션' };
  const tyName = t => en ? t : TYPE_KO[t] || t;
  const setLine = en || !c.kset ? `${c.set || ''} ${c.no || ''}` : `${c.kset} ${c.kno || ''}`;
  return `<div class="cardinfo">${pic}<div class="txt"><h3>${esc(en ? c.n : cnameKo(c))}${alt(c.kro ? '' : c.n !== cnameKo(c) ? c.n : '')}</h3><div class="small muted">${c.kro ? '한국판 카드 · ' : ''}${esc(setLine)} · ${L.reg} ${esc(c.rm || '')}${c.kra && !en ? ` · ${esc(c.kra)}` : ''}</div>
    <div class="row" style="margin:4px 0">${(c.sub || []).map(x => `<span class="chip">${esc(x)}</span>`).join('')}${c.hp ? `<span class="chip">HP ${c.hp}</span>` : ''}${(c.ty || []).map(t => `<span class="chip">${esc(tyName(t))}</span>`).join('')}</div>
    ${(c.ab || []).map((a, i) => { const k = en ? a : (c.kab || [])[i] || a; return `<div class="atk"><b>${L.ab} ${esc(k.n)}</b>${alt(en ? '' : a.n !== k.n ? a.n : '')}<div>${esc(k.t)}</div></div>`; }).join('')}
    ${(c.at || []).map((a, i) => { const k = en ? a : (c.kat || [])[i] || a; return `<div class="atk"><b>${cost(a.c)} ${esc(k.n)} ${esc(a.d || '')}</b>${alt(en ? '' : a.n !== k.n ? a.n : '')}<div>${esc(k.t || '')}</div></div>`; }).join('')}
    ${((en ? c.r : c.kr || c.r) || []).map(t => `<div class="small muted atk">${esc(t)}</div>`).join('')}
    ${c.st === 'P' ? `<div class="small atk">${L.w} ${(c.wk || []).map(tyName).join(', ') || '—'} · ${L.r} ${(c.rs || []).map(r => tyName(r[0]) + ' ' + r[1]).join(', ') || '—'} · ${L.rt} ${c.rt || 0}</div>` : ''}
    ${c.kn || en ? '' : '<div class="small muted atk">이 카드는 아직 한글 자료와 연결되지 않아 영문으로 보여요.</div>'}</div></div>`;
}
// 크게 보기: 영문판 · 합친 카드 · 한글판 (있는 것만). 뒤로 가기로 닫힘
let ZOOM = null;
function openZoom(c) {
  if (!c) return;
  const sides = [['en', '영문판'], ['mix', '합친 카드'], ['kr', '한글판']].filter(([k]) => picMode(c, k) === k);
  if (!sides.length) return;
  const ov = document.createElement('div'); ov.className = 'zoomov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  document.body.appendChild(ov); ZOOM = ov; history.pushState({ zoom: 1 }, ''); Sound.sfx('open');
  let side = sides.some(x => x[0] === D.dzoom) ? D.dzoom : sides[0][0];
  const cap = { en: c.ksa ? '한글판과 그림이 같은 영문판 카드예요. 워터마크가 없어요.' : '영문판 카드예요. 한글판과 그림이 다를 수 있어요.', mix: '그림 칸은 영문판, 이름과 설명은 한글판으로 합쳤어요.', kr: '공식 사이트 한글판 그림이에요. 크게 보면 워터마크가 보여요.' };
  const paint = () => {
    ov.innerHTML = `<button class="x sm" data-zx>닫기</button>${sides.length > 1 ? `<div class="zseg" role="group" aria-label="그림 고르기">${sides.map(([k, l]) => `<button class="sm" data-side="${k}" aria-pressed="${k === side}">${l}</button>`).join('')}</div>` : ''}
      <div class="zimg"><span class="cpic">${picHtml(c, side, true)}</span></div><p class="zcap"><b>${esc(side === 'en' ? c.n : cnameKo(c))}</b>${esc(cap[side])}</p>`;
    ov.querySelectorAll('[data-side]').forEach(b => b.onclick = e => { e.stopPropagation(); side = b.dataset.side; paint(); });
  };
  paint();
  ov.onclick = e => { if (e.target === ov || e.target.closest('[data-zx]') || e.target.classList.contains('zimg')) history.back(); };
}
function closeZoom() { if (ZOOM) { ZOOM.remove(); ZOOM = null; } }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-zoom]'); if (b) { e.stopPropagation(); openZoom(cinfo(b.dataset.zoom)); } }, true);

// ---------- 대전 ----------
let G = null; // { id, view, lines, cards, ws, pend:{}, specs, ui }
function cinfo(cid) { // 판에 저장된 카드 정보 + 지금 카드 자료의 한글 이름·그림·문장
  const base = (G && G.cards[cid]) || (IDX && IDX.byId[cid]) || { n: '?' };
  const cur = IDX && IDX.byId[cid];
  return cur && cur.kn ? { ...base, kn: cur.kn, kimg: cur.kimg, kab: cur.kab, kat: cur.kat, kr: cur.kr, kra: cur.kra, ksa: cur.ksa, kset: cur.kset, kno: cur.kno } : base; // 한글은 항상 지금 자료 우선
}
const nmOf = x => x ? cname(cinfo(x.c)) : '?';
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
      if (m.t === 'full') { const first = !G.view; G.view = m.view; G.lines = m.lines; G.cards = m.cards; if (m.specs) G.specs = m.specs; draw(first ? [] : null); }
      else if (m.t === 'upd') { G.view = m.view; G.lines.push(...m.lines); draw(m.lines); }
      else if (m.t === 'specs') { G.specs = m.specs; drawSpecs(); }
      else if (m.t === 'spec') { (G.specChat ||= []).push(m); drawSide(); }
      else if (m.t === 'res') { const p = G.pend[m.id]; if (p) { delete G.pend[m.id]; p(m); } }
    };
    ws.onopen = () => { retry = 0; };
    ws.onclose = () => { if (!closed) setTimeout(connect, Math.min(8000, 500 * 2 ** retry++)); };
  };
  connect();
  guardPage('한 번 더 누르면 대전에서 나가요. 대전은 그대로 이어져요');
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
  // PTCGL처럼 이름 상자 없이: 오른쪽 위 HP 상자(남은 HP + 타입 기호) + 왼쪽 아래 에너지. 데미지는 남은 HP로 보여요 (HP를 모르는 카드만 데미지 배지)
  const hp = c.hp ? `<span class="hpb ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" title="남은 HP ${hpLeft} / ${c.hp}"><b>${hpLeft}</b>${(c.ty || [])[0] ? typeIcon(c.ty[0]) : ''}</span>` : '';
  return `<div class="spot ${size} filled" data-sid="${sl.sid}">
    <div class="rotwrap ${rot}">${under}${cardFace(t, 'onfield', '', '')}${hp}${energyTabs(sl)}
      ${sl.dmg && !c.hp ? `<span class="dmg" data-dmg="${sl.sid}">${sl.dmg}</span>` : ''}
      ${sl.tl.length ? `<div class="tools">${sl.tl.map(x => `<span data-k="${x.i}" title="도구: ${esc(nmOf(x))}">${TOOL_SVG}</span>`).join('')}</div>` : ''}
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
function areaHtml(p, isBottom) {
  const v = G.view, P = v.p[p];
  const now = v.phase === 'play' && v.current === p;
  const state = v.phase === 'setup' ? `<b class="zst ${P.ready ? 'ok' : ''}">${P.ready ? '준비 완료' : '준비 중'}</b>` : '';
  // 이름표와 '이번 차례에 쓴 것'은 벤치 칸 테두리에 걸쳐서 (가로 화면은 이름표 왼쪽·쓴 것 오른쪽, 세로 화면은 나란히)
  const tag = `<div class="ztags"><span class="ztag ${isBottom ? 'me' : 'opp'} ${now ? 'turn' : ''}"><i class="av">${esc(P.name.slice(0, 1))}</i><span class="zn">${esc(P.name)}</span>${state}${v.phase === 'setup' && P.mull ? `<b class="zst">멀리건 ${P.mull}</b>` : ''}</span></div>`;
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
  return `<div class="handbar ${mine ? '' : 'peek'}"><div class="fan" style="--n:${n}">${P.hand.map((x, i) => cardFace(x, 'inhand', `${mine ? `data-hand="${x.i}"` : ''} style="--i:${i}"`)).join('') || '<span class="nohand">손패 없음</span>'}</div></div>`;
}
function oppHandHtml(p) { // 상대 손패: 맨 위에 뒷면이 살짝 보임
  const P = G.view.p[p], n = P.hand ? P.hand.length : P.handN;
  const cards = P.hand ? P.hand.map((x, i) => cardFace(x, 'oh', `style="--i:${i}"`)).join('') : Array.from({ length: Math.min(n, 15) }, (_, i) => cardBack('oh', `style="--i:${i}"`)).join('');
  return `<div class="ohand" data-zone="hand" data-p="${p}" title="상대 손패 ${n}장" style="--n:${Math.min(n, 15)}"><div class="ofan">${cards}</div></div>`;
}
function midHtml(readOnly) {
  const v = G.view;
  const stadium = v.stadium ? `<div class="stadium" data-stadium="1">${cardFace(v.stadium, 'stad')}</div>` : '<div class="stadium none" title="스타디움 없음"><span>스타디움</span></div>';
  return `<div class="fieldline">${stadium}</div>`;
}
const fmtShort = ms => { if (ms <= 0) return '지남'; const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간` : m >= 1 ? `${m}분` : '곧'; };
function rbarHtml(readOnly) { // 오른쪽 세로 막대: 위 사람 남은 사이드(빨강) · 차례/남은 시간 · 아래 사람 남은 사이드(파랑)
  const v = G.view, bs = bottomSeat(), os = 1 - bs;
  const cur = v.phase === 'play' ? (v.current === bs ? 'me' : 'opp') : '';
  const U = v.phase === 'play' ? v.p[v.current].used : null; // 세로 화면: 이번 차례에 쓴 것(에너지·서포트·후퇴·기술)을 막대 가운데에 작게
  const cu = U ? `<span class="cuses" title="${esc(v.p[v.current].name)} 님이 이번 차례에 쓴 것">${USES.map(([k, ic, l]) => `<i class="${U[k] ? 'done' : ''}" title="${l} ${U[k] ? '(썼어요)' : '(아직)'}">${ICON[ic]}</i>`).join('')}</span>` : '';
  const mid = v.phase === 'setup' ? '<b>준비</b>' : v.phase === 'over' ? '<b>끝</b>' : `<small>${v.turn}번째</small>${v.deadline ? `<b title="${fmtLeft(v.deadline - Date.now())}">${fmtShort(v.deadline - Date.now())}</b>` : '<b>차례</b>'}${cu}`;
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
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.4c-4 0-7 2.9-7 7v4.2l-1.8 3.1v1.4h17.6v-1.4L19 13.6V9.4c0-4.1-3-7-7-7Zm-2.7 17.2a2.8 2.8 0 0 0 5.4 0Z"/></svg>',
  rewatch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M4.6 12a7.4 7.4 0 1 0 2.3-5.4"/><path fill="currentColor" d="M3.4 3.4v6h6z"/><path fill="currentColor" d="M10.2 8.4v7.2l5.8-3.6z"/></svg>',
};
const FAB_FX = '<i class="fx f1"></i><i class="fx f3"></i><i class="fx f4"></i>';
const fabBtn = (t, ic, l, k, extra = '') => `<div class="fabw"><button class="fab ${k}" data-t="${t}" aria-label="${l}">${FAB_FX}<span class="core">${FAB_ICON[ic]}</span>${extra}</button><span class="fl">${l}</span></div>`;
function fabHtml() { // 왼쪽: 상대 턴·코인·효과 / 오른쪽: 더 보기·남은 사이드 막대·차례 끝내기 / 오른쪽 아래: 기록
  const v = G.view, me = meSeat();
  const pend = me == null ? 0 : v.groups.filter(g => g.who !== me && g.status !== 'ok').length;
  const log = fabBtn('log', 'log', '기록', 'k-log', pend ? `<i class="badge">${pend}</i>` : '');
  const rwt = me == null ? null : lastOppTurn(), rwNew = rwt && !rwSeen(rwt); // 기보 보기: 수가 하나라도 있으면 늘 보임, 안 본 상대 차례가 있으면 '새'
  const rw = (v.n || 0) > 0 ? `<div class="rwbtn">${fabBtn('rewatch', 'rewatch', '기보 보기', 'k-rw' + (rwNew ? ' on nudge' : ''), rwNew ? '<i class="badge">새</i>' : '')}</div>` : '';
  if (me == null || v.phase === 'over') return { left: rw ? `<div class="lbtns">${rw}</div>` : '', log: `<div class="rbtns">${log}</div>` };
  const myTurn = v.phase === 'play' && v.current === me;
  const open = v.openGroup[me];
  return { left: `<div class="lbtns">${rw}${fabBtn('coin', 'coin', '코인', 'k-coin')}${open ? fabBtn('effectEnd', 'check', '효과 끝', 'k-fx on') : fabBtn('effect', 'hand', '효과 쓰기', 'k-fx')}</div>`,
    more: fabBtn('more', 'more', '더 보기', 'k-more'), log: `<div class="rbtns">${log}</div>`,
    end: myTurn ? `<button class="fab wide endturn" data-t="endTurn">${FAB_FX}${FAB_ICON.flag}<span>차례<br>끝내기</span></button>` : '' };
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
  const f = readOnly ? {} : fabHtml();
  const over = v.phase === 'over' ? `<div class="overpill">${ICON.trophy}${esc(v.p[v.winner]?.name || '')} 승리</div>` : '';
  return `${oppHandHtml(os)}<div class="matwrap"><div class="matbox"><div class="mat ${readOnly ? 'ro' : ''}">${areaHtml(os, false)}${midHtml(readOnly)}${areaHtml(bs, true)}</div>
    ${over}${f.left || ''}<div class="rcol">${f.more || ''}${rbarHtml(readOnly)}${f.end || ''}</div></div></div>${f.log || ''}${handHtml(bs)}`;
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
  if (prevView.phase !== 'over' && v.phase === 'over') banner(`${v.p[v.winner]?.name} 님 승리!`, 'win', 2600);
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
  if (G.rw) { // 기보 보는 중: 판은 그대로 두고, 새로 생긴 수까지 갈 수 있게만
    const rw = G.rw; if (rw.mode !== 'game') return;
    const wasEnd = rw.k >= rw.n; rw.n = v.n ?? rw.n; rw.lines = G.lines;
    if (wasEnd && rw.k < rw.n) drawRw(false); else { const kk = app.querySelector('.vwk'); if (kk) kk.textContent = `${rw.k} / ${rw.n}수`; }
    return;
  }
  const prev = app.querySelector('.mat') ? snapRects() : null;
  const prevView = G.prev;
  const me = meSeat();
  const waitingMe = me != null && v.waiting.includes(me);
  document.title = (waitingMe ? '● 내 차례 · ' : '') + '도란 카드 대전';
  app.innerHTML = `<div class="arena"><div class="table">${matHtml()}${dockHtml()}</div></div>`;
  drawSpecs(); drawSide(); bindBoard();
  app.querySelectorAll('[data-dock]').forEach(b => b.onclick = () => { G.ui.dockMode = b.dataset.dock; draw([]); });
  flip(prev); if (newLines) { effects(prevView, newLines); gameSounds(prevView, newLines); }
  G.prev = JSON.parse(JSON.stringify(v));
}
function drawSpecs() { const el = $('#specs'); if (el) el.innerHTML = G.specs.length ? `${ICON.eye}관전 ${G.specs.length}` : ''; }
// ----- 확인할 것 -----
// 내가 지금 답해야 하는 것(급함)만 판 위에 크게 열고, 상대 판정 동의·상대 확인 대기 같은 건 한 줄씩 작게. 기다리는 중 안내는 작은 알약으로.
const qIcon = (ic, k = '') => `<i class="qi ${k}">${ICON[ic]}</i>`;
const Q_ICON = { ko: 'warn', prize: 'star', promote: 'user', checkup: 'check', next: 'next', win: 'trophy', deckout: 'trophy' };
function dockItems() {
  const v = G.view, me = meSeat(); if (me == null) return [];
  const out = [], nm = p => esc(v.p[p].name);
  if (v.phase === 'setup') {
    const P = v.p[me], O = v.p[1 - me];
    if (v.first == null && v.coinWinner === me) out.push({ k: 'order', u: 1, h: `<div class="prompt"><div class="q">${qIcon('coin', 'gold')}코인에서 이겼어요! 선공·후공을 골라 주세요.</div><div class="bar"><button class="primary" data-order="1">선공</button><button data-order="0">후공</button></div></div>` });
    if (v.first == null && v.coinWinner !== me) out.push({ k: 'order-wait', info: '상대가 선공·후공을 고르는 중' });
    if (!P.ready) out.push({ k: 'place', u: 1, h: `<div class="prompt"><div class="q">${qIcon('user')}배틀 포켓몬과 벤치를 놓아 주세요</div>
      <p class="pq">손패의 기본 포켓몬을 눌러 배틀 포켓몬 1장과 벤치(최대 5장)를 놓아요. 상대에게는 뒷면으로 보여요.</p>
      ${O.mull && !P.mullDrawn ? `<div class="row mullr"><span>상대가 멀리건을 ${O.mull}번 했어요. 추가로 몇 장 뽑을까요?</span> ${Array.from({ length: O.mull + 1 }, (_, n) => `<button class="sm" data-mull="${n}">${n}장</button>`).join('')}</div>` : ''}
      <div class="bar"><button class="primary" data-t="setupDone" ${P.active ? '' : 'disabled'}>준비 완료</button></div></div>` });
    else out.push({ k: 'ready-wait', info: '상대 준비를 기다리는 중' });
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
    out.push({ k: 'look', u: 1, h: `<div class="prompt look"><div class="row"><div class="q grow">${qIcon('search', 'judge')}${lk.p === me ? '내' : '상대'} ${({ deck: '덱', hand: '손패', prizes: '프라이즈' })[lk.z]} 보는 중 <span class="chip">${cards.length}장</span></div><button class="sm" data-t="lookEnd">닫기</button>${lk.z === 'deck' ? '<button class="sm" data-t="shuffleMine">섞고 닫기</button>' : ''}</div>
      <p class="pq">카드를 눌러 옮겨요.</p><div class="lookrow">${cards.map(x => cardFace(x, 'lk', `data-pile="${x.i}"`)).join('')}</div></div>` });
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
    const n = urg.length + rows.length, l = urg.length ? '답할 것' : '확인할 것';
    const fab = n ? `<div class="dockfab${enter}"><div class="fabw"><button class="fab k-dock ${urg.length ? 'on nudge' : 'j' + bump}" data-dock="open" aria-label="${l} ${n}개 펼치기">${FAB_FX}<span class="core">${FAB_ICON[urg.length ? 'bell' : 'hand']}</span><i class="badge">${n}</i></button><span class="fl">${l}</span></div></div>` : '';
    return fab + (infos ? `<div class="dinfos">${infos}</div>` : '');
  }
  const ag = rows.filter(x => x.agree).map(x => x.agree);
  return `<div class="dock${enter}"><div class="dockin">
    <div class="dockh"><b class="dtt">${urg.length ? '지금 답할 것' : '확인할 것'}</b>${infos}<button class="dockx sm" data-dock="shut">${ICON.down}접기</button></div>
    ${urg.map(x => x.h).join('')}
    ${rows.length ? `<div class="drows">${urg.length || ag.length >= 2 ? `<div class="drh"><span>${urg.length ? '그 밖에 확인할 것' : '상대 판정'} ${rows.length}</span>${ag.length >= 2 ? `<button class="good xs" data-agreeall="${ag.join(',')}">${ICON.check}모두 동의</button>` : ''}</div>` : ''}${rows.map(x => x.row).join('')}</div>` : ''}
  </div></div>`;
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
  let lastG = null; // 같은 판정 묶음은 첫 줄에만 칩, 나머지는 보라 줄로만 (줄을 더 많이 보이게)
  return logBlocks(G.lines, (l, o, headAttr) => {
    if (headAttr) return l.k >= 0 && !G.rw ? `data-vk="${l.k}" role="button" tabindex="0" title="이 차례부터 기보 보기"` : '';
    const g = l.gid && gs[l.gid];
    const first = l.gid !== lastG; lastG = l.gid || null;
    const st = g ? (g.status === 'ok' ? ['ok', 'check', '동의함'] : g.status === 'disputed' ? ['warn', 'warn', '이의 있음'] : ['judge', 'judge', '사람 판정 · 동의 전']) : ['judge', 'judge', '사람 판정'];
    const jc = l.gid && first ? `<i class="lj ${st[0]}" title="${st[2]}" aria-label="${st[2]}">${ICON[st[1]]}</i>` : '';
    if (l.chat) return `<div class="ln chat ${o.cls} ${l.rw ? 'rw' : ''}">${esc(l.txt)}</div>`;
    return `<div class="ln ${o.cls} ${l.gid ? 'j' : ''} ${l.rw ? 'rw' : ''}">${jc}${esc(o.txt)}${l.own ? ` <span class="own">(나만 보임: ${esc(l.own)})</span>` : ''}</div>`;
  });
}
// 코인 던지기: 횟수는 ▼▲ 단추로(키보드 없이), '무엇 때문에?'는 카드를 눌러서 고름 (내 포켓몬·상대 포켓몬·내 손패의 트레이너스·특수 상태)
function openCoin() {
  const v = G.view, me = meSeat(); if (me == null) return;
  const tile = (x, sub) => { const nm = nmOf(x); return `<button type="button" class="cwc" data-why="${esc(nm)}" aria-pressed="false" title="${esc(nm)}">${cardFace(x, 'cwpc')}<span class="cwn">${esc(nm)}</span>${sub ? `<small>${sub}</small>` : ''}</button>`; };
  const slots = p => allSlots(p).map(sl => tile(topOf(sl), v.p[p].active?.sid === sl.sid ? '배틀' : '벤치')).join('');
  const hand = v.p[me].hand.filter(h => h.c && cinfo(h.c).st === 'T').map(h => tile(h, '')).join('');
  const grp = (t, body) => body ? `<div class="cwg"><span class="cwl">${t}</span><div class="cwrow">${body}</div></div>` : '';
  let n = 1, why = '';
  openSheet(`<button class="x sm" data-close>닫기</button><h3>코인 던지기</h3>
    <label class="h">몇 번 던질까요?</label>
    <div class="stepper"><button type="button" class="stp" data-d="-1" aria-label="한 번 줄이기">${ICON.down}</button><output class="stv" aria-live="polite"><b>1</b>번</output><button type="button" class="stp" data-d="1" aria-label="한 번 늘리기">${ICON.up}</button></div>
    <label class="h">무엇 때문에? <small class="muted">고르지 않아도 돼요</small></label>
    <div class="cwhy">${grp('내 포켓몬', slots(me))}${grp('상대 포켓몬', slots(1 - me))}${grp('내 손패의 트레이너스', hand)}
      ${grp('특수 상태', ['잠듦', '혼란', '마비'].map(s => `<button type="button" class="cws" data-why="${s} 확인" aria-pressed="false">${s} 확인</button>`).join(''))}</div>
    <div class="acts1"><button class="primary" data-go>${ICON.coin}<span class="gol"></span></button></div>`, el => {
    const stv = el.querySelector('.stv b'), gol = el.querySelector('.gol'), stp = [...el.querySelectorAll('.stp')];
    const upd = () => { stv.textContent = n; stp[0].disabled = n <= 1; stp[1].disabled = n >= 20; gol.textContent = `${n}번 던지기${why ? ` · ${why}` : ''}`; };
    stp.forEach(b => b.onclick = () => { n = Math.max(1, Math.min(20, n + +b.dataset.d)); upd(); });
    el.querySelectorAll('[data-why]').forEach(b => b.onclick = () => {
      const on = b.getAttribute('aria-pressed') !== 'true'; // 다시 누르면 고르기 취소
      el.querySelectorAll('[data-why]').forEach(o => o.setAttribute('aria-pressed', 'false'));
      if (on) b.setAttribute('aria-pressed', 'true'); why = on ? b.dataset.why : ''; upd();
    });
    el.onkeydown = e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); n = Math.max(1, Math.min(20, n + (e.key === 'ArrowUp' ? 1 : -1))); upd(); } };
    el.querySelector('[data-go]').onclick = () => { closeSheet(); send({ type: 'coin', n, why }); };
    upd();
  });
}
// 기록·채팅 창: 탭·기보 보기·입력칸은 옆 줄에, 기록은 창 높이 전부를 씀
function openLog() {
  openSheet('<div class="lgs"></div>', box => { box.classList.add('wide', 'logsheet'); drawSide(box.querySelector('.lgs')); });
}
function drawSide(target) {
  const el = target || document.querySelector('#sheet .lgs'); if (!el || !G.view) return;
  const tab = G.ui.tab === 'spec' ? 'spec' : 'log', me = meSeat(), canType = tab === 'log' ? me != null : me == null;
  const logInner = () => tab === 'log' ? logHtml() || '<p class="muted">아직 기록이 없어요.</p>'
    : (G.specChat || []).map(m => `<div class="ln chat"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') || '<p class="muted">관전자 채팅이 없어요.</p>';
  const lg0 = el.querySelector('.log');
  if (lg0 && el.dataset.tab === tab) { // 새 줄만 다시 그림 (입력 중인 글자는 그대로)
    const atEnd = lg0.scrollHeight - lg0.scrollTop - lg0.clientHeight < 40;
    lg0.innerHTML = logInner(); bindLog(lg0); if (atEnd) lg0.scrollTop = lg0.scrollHeight; return;
  }
  el.dataset.tab = tab;
  const nSpec = (G.specChat || []).length;
  el.innerHTML = `<nav class="lgrail" aria-label="기록 종류">
      <button type="button" class="lgt x" data-close aria-label="닫기">${ICON.x}<span>닫기</span></button>
      <button type="button" class="lgt ${tab === 'log' ? 'on' : ''}" data-st="log">${ICON.chat}<span>기록·채팅</span></button>
      <button type="button" class="lgt ${tab === 'spec' ? 'on' : ''}" data-st="spec">${ICON.eye}<span>관전자${nSpec ? ` ${nSpec}` : ''}</span></button>
      ${(G.view.n || 0) > 0 ? `<button type="button" class="lgt vwgo" data-vwgo>${ICON.rewind}<span>기보 보기</span></button>` : ''}
    </nav>
    <div class="log">${logInner()}</div>
    ${canType ? `<form class="lgin"><textarea name="t" rows="2" maxlength="${tab === 'log' ? 300 : 200}" placeholder="${tab === 'log' ? '채팅 (기록에 남아요)' : '응원 한마디'}" enterkeyhint="send">${esc(G.ui.draft || '')}</textarea><button class="blue sm" aria-label="보내기">${ICON.next}<span>보내기</span></button></form>` : ''}`;
  el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { G.ui.tab = b.dataset.st; drawSide(el); });
  const vg = el.querySelector('[data-vwgo]'); if (vg) vg.onclick = () => { closeSheet(); setTimeout(() => startRewatch(), 0); };
  const lg = el.querySelector('.log'); bindLog(lg); lg.scrollTop = lg.scrollHeight;
  const f = el.querySelector('.lgin'); if (!f) return;
  const ta = f.t, sendIt = () => {
    const t = ta.value.trim(); if (!t) return;
    if (tab === 'log') send({ type: 'chat', text: t }); else G.ws.send(JSON.stringify({ t: 'specChat', text: t }));
    ta.value = ''; G.ui.draft = '';
  };
  ta.oninput = () => { G.ui.draft = ta.value; };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendIt(); } }; // Enter 보내기, Shift+Enter 줄바꿈
  f.onsubmit = e => { e.preventDefault(); sendIt(); ta.focus(); };
}
function bindLog(lg) { // 차례 머리를 누르면 그 차례부터 기보 보기
  lg.querySelectorAll('[data-vk]').forEach(h => h.onclick = () => { const k = +h.dataset.vk; closeSheet(); setTimeout(() => startRewatch({ k }), 0); });
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
      (c.at || []).forEach((a, k) => opts.push({ label: `${ICON.battle}${esc((c.kat || [])[k]?.n || a.n)} ${esc(a.d || '')}`, value: ['attack', k], cls: 'primary' }));
      if (v.p[me].bench.length) opts.push({ label: '후퇴', value: ['retreat'], cls: 'blue' });
    }
    if (mine) (c.ab || []).forEach((a, k) => opts.push({ label: `${ICON.spark}특성 ${esc((c.kab || [])[k]?.n || a.n)}`, value: ['ability', k], cls: 'blue' }));
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
async function onZone(z, p) {
  const v = G.view, me = meSeat(), P = v.p[p], mine = p === me;
  if (z === 'discard' || z === 'lost') {
    const cards = P[z];
    openSheet(`<button class="x sm" data-close>닫기</button><h3>${mine ? '내' : esc(P.name) + ' 님'} ${z === 'discard' ? '트래시' : '로스트존'} (${cards.length}장)</h3><div class="cardgrid">${cards.map(x => { const c = cinfo(x.c); return `<div class="c" data-i="${x.i}">${picMode(c, D.dimg) ? `<span class="cpic">${picHtml(c, D.dimg)}</span>` : `<div class="ph">${esc(cname(c))}</div>`}<div>${esc(cname(c))}</div></div>`; }).join('') || '<p class="muted">비어 있어요.</p>'}</div>`, el => {
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
  app.querySelectorAll('[data-agreeall]').forEach(el => el.onclick = async () => { el.disabled = true; for (const gid of el.dataset.agreeall.split(',')) if (!(await send({ type: 'agree', gid }))) break; });
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
    if (t === 'log') return openLog();
    if (t === 'coin') return openCoin();
    if (t === 'effect') { const f = await ask('효과 쓰기', '<p>지금부터 하는 카드 이동, 데미지 등이 이 효과 아래에 묶여 기록돼요.</p><label class="h">어떤 카드의 효과인가요?</label><input name="title" maxlength="40" style="width:100%" placeholder="예: 보스의 지령"><label class="h">설명 (선택)</label><input name="note" maxlength="100" style="width:100%">', '시작', 'judge'); if (f) send({ type: 'effect', title: f.title || '카드 효과', note: f.note }); return; }
    if (t === 'effectEnd') { const f = await ask('효과 끝', '<p>상대에게 "이렇게 처리했어요"로 보여요.</p><label class="h">한 줄 설명 (선택)</label><input name="note" maxlength="100" style="width:100%">', '끝내기', 'judge'); if (f) send({ type: 'effectEnd', note: f.note }); return; }
    if (t === 'more') { const k = await pick('더 보기', [{ label: `${ICON.gear}설정`, value: 'set' },
        ...(fsOk() ? [{ label: inFs() ? `${ICON.shrink}전체 화면 끝내기` : `${ICON.expand}전체 화면`, value: 'fs' }] : isApp() ? [] : [{ label: `${ICON.homeAdd}주소창 없이 보기`, value: 'a2hs' }]),
        { label: '항복하기', value: 'concede', cls: 'bad' }, { label: '로비로', value: 'lobby' }]); if (k === 'lobby') location.hash = '#lobby';
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
const rwKey = t => `rw:${G.id}:${t.k0}:${t.k1}`;
function rwSeen(t) { try { return localStorage.getItem(rwKey(t)) === '1'; } catch { return false; } }
// ---------- 기보 보기 (판 위에서 그대로, 판 크기는 그대로) ----------
// 차례 단위로 이동(이전 차례 · 다음 차례), 그 안에서 한 수씩(‹ ›), 재생·멈춤. 위에는 지금 수의 설명, 아래에는 조작 막대
const turnStartsOf = lines => [...new Set(lines.filter(l => l.turn && l.k >= 0).map(l => l.k))].sort((a, b) => a - b);
async function startRewatch(opt = {}) { // 대전 중: 기본은 상대의 마지막 차례 처음부터
  if (G.rw) return;
  const me = meSeat(), n = G.view.n ?? 0, lines = G.lines;
  const ts = turnStartsOf(lines), t = lastOppTurn();
  const fresh = !!(t && !rwSeen(t)), done = ts.filter(x => x < n); // 새로 본 적 없는 상대 차례면 그 처음부터 자동 재생
  const k = opt.k != null ? opt.k : t ? t.k0 : done.length ? done[done.length - 1] : 0;
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
  if (v.stadium) m.set(v.stadium.i, 'stad');
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
    if (!b.p[p].hand && a.p[p].handN !== b.p[p].handN) add('.ohand');
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
function rwHighlight(sels) {
  const layer = app.querySelector('.hl-layer'), tb = app.querySelector('.table'); if (!layer || !tb) return;
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
  }, reduceMotion() ? 0 : 520);
}
function drawRw(forward) {
  const rw = G.rw, live = G.view, liveLines = G.lines, names = [0, 1].map(p => (rw.views[rw.k] || live).p[p].name);
  const prevRects = app.querySelector('.mat') ? snapRects() : null;
  const cur = rw.views[rw.k], before = rw.k > 0 ? rw.views[rw.k - 1] : null;
  const ts = turnStartsOf(rw.lines), ti = ts.filter(t => t <= rw.k).length - 1; // 지금 몇 번째 차례 안인지
  const tl = ti >= 0 ? rw.lines.find(l => l.turn && l.k === ts[ti]) : null, tm = tl ? tl.txt.match(/(\d+)번째 차례: (.+) \(/) : null;
  const owner = tm ? names.indexOf(tm[2]) : -1, side = owner < 0 ? 'sys' : owner === (rw.me == null ? 0 : rw.me) ? 'me' : 'op';
  const head0 = tm ? `${tm[1]}번째 차례 · ${tm[2]}` : '대전 준비';
  const stepLines = rw.k > 0 ? rw.lines.filter(l => l.k === rw.k - 1) : [];
  const who = owner >= 0 ? names[owner] : '';
  const caps = stepLines.filter(l => l.txt && !l.turn).map(l => esc(who ? stripWho(l.txt, who) : l.txt) + (l.own ? ` <span class="muted">(${esc(l.own)})</span>` : ''));
  const turnL = stepLines.find(l => l.turn), drew = turnL ? (turnL.txt.match(/\(([^)]+)\)/) || [])[1] : '';
  const cap = rw.k === 0 ? '대전 준비부터 한 수씩 볼 수 있어요.' : turnL ? `차례를 시작했어요${drew ? ` (${esc(drew)})` : ''}.` : caps.length ? caps.join(' · ') : '차례를 넘겼어요.';
  const end = rw.k >= rw.n;
  G.view = cur; G.lines = rw.lines.filter(l => l.k < rw.k);
  const lb = (t, sh) => `<span class="vl">${t}</span>${sh ? `<span class="vs">${sh}</span>` : ''}`;
  const play = end ? (rw.mode === 'game' ? `<button class="vb main primary" data-rw="close" aria-label="판으로 돌아가기">${ICON.check}${lb('판으로')}</button>` : `<button class="vb main" disabled aria-label="마지막 수">${ICON.play}</button>`)
    : `<button class="vb main primary ${rw.playing ? 'on' : ''}" data-rw="play" aria-label="${rw.playing ? '멈춤' : '재생'}">${rw.playing ? ICON.pause : ICON.play}${lb(rw.playing ? '멈춤' : '재생')}</button>`;
  app.innerHTML = `<div class="arena rwmode"><div class="table">${matHtml(true)}<div class="hl-layer"></div>
    <div class="vw ${side}"><div class="vwcap${cap.length > 70 ? ' long' : ''}" aria-live="polite"><b class="vwh">${esc(head0)}</b><span class="vwk">${rw.k} / ${rw.n}수</span> <span class="vwt">${cap}</span></div>
    <div class="vwctl">
      <button class="vb x" data-rw="close" aria-label="기보 닫기">${ICON.x}</button>
      <button class="vb t" data-rw="tprev" ${rw.k > 0 ? '' : 'disabled'} aria-label="이전 차례로">${ICON.first}<span class="vtl">이전<br> 차례</span></button>
      <button class="vb s" data-rw="prev" ${rw.k > 0 ? '' : 'disabled'} aria-label="한 수 뒤로">${ICON.prev}</button>
      ${play}
      <button class="vb s" data-rw="next" ${end ? 'disabled' : ''} aria-label="한 수 앞으로">${ICON.next}</button>
      <button class="vb t" data-rw="tnext" ${end ? 'disabled' : ''} aria-label="다음 차례로"><span class="vtl">다음<br> 차례</span>${ICON.last}</button>
    </div></div></div></div>`;
  app.querySelectorAll('[data-rw]').forEach(b => b.onclick = () => {
    const k = b.dataset.rw;
    if (k === 'close') return endRewatch();
    if (k === 'play') { rw.playing = !rw.playing; drawRw(false); rwPlan(); return; }
    if (k === 'prev' || k === 'next') return rwGo(rw.k + (k === 'next' ? 1 : -1));
    rwTurnJump(k === 'tnext' ? 1 : -1);
  });
  app.querySelectorAll('.mat [data-sid]').forEach(el => el.onclick = () => { const f = findSlot(el.dataset.sid); if (f) openSheet(`<button class="x sm" data-close>닫기</button>${cardInfoHtml(cinfo(topOf(f.sl).c))}`); });
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

// 끝난 판·지난 판의 기보 (로비의 '기보' 버튼): 대전 화면과 같은 판, 같은 조작
async function renderReplay(id, k0) {
  app.innerHTML = '<div class="arena-loading"><div class="spin-ball"></div><p>기보를 불러오는 중…</p></div>';
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
  guardPage('한 번 더 누르면 기보를 닫아요');
}

document.addEventListener('error', e => { const im = e.target; if (im.tagName === 'IMG' && !im.dataset.f) { im.dataset.f = 1; const d = document.createElement('div'); d.className = 'ph'; d.textContent = im.alt || '카드'; d.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.72rem;padding:2px;word-break:keep-all;aspect-ratio:63/88'; im.replaceWith(d); } }, true);
// 잔잔한 배경: 천천히 흐르는 구름 몇 겹, 아주 느리게 도는 햇살, 아래에서 떠오르는 빛 알갱이 (움직임 줄이기 설정이면 멈춤)
(function ambient() {
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const clouds = Array.from({ length: 6 }, (_, i) => `<i class="cl" style="--w:${Math.round(90 + r() * 120)}px;--y:${Math.round(6 + r() * 58)}vh;--o:${(.5 + r() * .4).toFixed(2)};--d:${Math.round(110 + r() * 90)}s;--dl:${-Math.round(r() * 200)}s"></i>`).join('');
  const motes = Array.from({ length: 16 }, () => `<i class="mo" style="--x:${Math.round(r() * 100)}vw;--s:${Math.round(4 + r() * 7)}px;--o:${(.35 + r() * .45).toFixed(2)};--sw:${Math.round(-40 + r() * 80)}px;--d:${Math.round(16 + r() * 14)}s;--dl:${-Math.round(r() * 30)}s"></i>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<div id="amb" aria-hidden="true"><i class="sun"></i>${clouds}${motes}</div>`);
})();
route();
