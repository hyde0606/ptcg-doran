// 포켓몬 카드 대전 엔진 (기본 룰 도우미 + 사람 판정)
// 결정적(deterministic): 같은 시작값(init)과 같은 행동 목록이면 항상 같은 판이 나온다.
// 기본 룰은 막지 않고 "경고(warn)"만 한다. 경고를 무시하고 진행하면 '사람 판정'으로 기록된다.
// 규칙 판(rv): 카드 글을 읽는 규칙·경고는 rv 2(새로 시작한 판)부터. 예전 판(rv 1)은 기록을 다시 돌려도 예전과 똑같이 나오게 둔다.
import { stadRules, abLost, benchImmune, evoOk, evoName, coinSpec, extraDmg, targetDmg, statusOf, lockOf, LOCK_KO, abilityConds, trainerConds, basicEnergyType } from './fxrules.js';

// ---------- 난수 ----------
function hash128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
function rnd(s) { // sfc32, s.rng = [a,b,c,d]
  let [a, b, c, d] = s.rng;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
  s.rng = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
  return (t >>> 0) / 4294967296;
}
function shuffle(s, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
const coin = s => rnd(s) < 0.5; // true = 앞면

// ---------- 카드 정보 ----------
export const TYPE_KO = { Grass: '풀', Fire: '불꽃', Water: '물', Lightning: '번개', Psychic: '초', Fighting: '격투', Darkness: '악', Metal: '강철', Dragon: '드래곤', Colorless: '무색', Fairy: '페어리' };
export const COND_KO = { asleep: '잠듦', confused: '혼란', paralyzed: '마비', poisoned: '독', burned: '화상' };
// 조사 맞추기: '피카츄을(를)' → '피카츄를', '드래런치(으)로' → '드래런치로'. 앞 낱말의 끝소리(받침 없음 0, 있음 1, ㄹ 8)로 고름
const endSound = str => {
  const t = String(str).replace(/[\s」』)\]>"'’”.,!?·~…-]+$/u, ''), ch = t.slice(-1); if (!ch) return 0;
  const c = ch.charCodeAt(0);
  if (c >= 0xAC00 && c <= 0xD7A3) { const j = (c - 0xAC00) % 28; return j === 0 ? 0 : j === 8 ? 8 : 1; }
  if (/[0-9]/.test(ch)) return { 0: 1, 1: 8, 3: 1, 6: 1, 7: 8, 8: 8 }[ch] || 0; // 영·일·삼·육·칠·팔 (10, 100 → 십·백)
  if (/ex$/i.test(t)) return 0; // 엑스
  if (/(^|[^A-Za-z])[A-Z]{1,4}$/.test(t)) return { L: 8, M: 1, N: 1, R: 8 }[ch] || 0; // 글자 이름으로 읽음 (엘·엠·엔·알)
  if (/(ng|[mn])$/i.test(t)) return 1;
  if (/l$/i.test(t)) return 8;
  return 0;
};
const KJ = { '을(를)': ['을', '를'], '이(가)': ['이', '가'], '은(는)': ['은', '는'], '과(와)': ['과', '와'], '와(과)': ['과', '와'], '(으)로': ['으로', '로'] };
export function fixJosa(str) {
  if (typeof str !== 'string' || !str.includes('(')) return str;
  return str.replace(/을\(를\)|이\(가\)|은\(는\)|과\(와\)|와\(과\)|\(으\)로/g, (m, off) => { const e = endSound(str.slice(0, off)), [a, b] = KJ[m]; return m === '(으)로' ? (e && e !== 8 ? a : b) : (e ? a : b); });
}
const info = (s, iid) => s.cards[s.inst[iid]] || { n: '?', st: '?' };
const sideKo = c => c.side ? (c.side === 'L' ? ' (좌측)' : ' (우측)') : '';
const nm = (s, iid) => {
  const c = info(s, iid);
  if (c.kn) return c.kn + sideKo(c);
  if (!c.ko) return c.n;
  let k = c.ko;
  if (/^Mega /.test(c.n)) k = '메가' + k;
  if (/ ex$/.test(c.n)) k += ' ex';
  return k;
};
const has = (c, sub) => (c.sub || []).includes(sub);
const isBasicPokemon = c => c.st === 'P' && has(c, 'Basic');
const isEnergy = c => c.st === 'E';
const prizeValue = c => has(c, 'MEGA') ? 3 : has(c, 'ex') ? 2 : 1;
const other = p => 1 - p;

// ---------- 새 판 ----------
// init = { seed, cfg, players:[{uid,name,deck:[cid,...]}], cards:{cid:info} }
export function newGame(init) {
  const s = {
    v: 1, rv: init.rv || 1, cfg: init.cfg || {}, players: init.players.map(p => ({ uid: p.uid, name: p.name })),
    cards: init.cards, inst: {}, rng: hash128(String(init.seed)),
    phase: 'setup', turn: 0, current: null, first: null, coinWinner: null,
    p: [0, 1].map(() => ({ deck: [], hand: [], prizes: [], discard: [], lost: [], active: null, bench: [], mull: 0, mullDrawn: false, ready: false,
      used: { energy: false, supporter: false, stadium: false, retreat: false, attack: false }, look: null })),
    stadium: null, prompts: [], groups: [], openGroup: [null, null], nextId: 1, winner: null, winReason: null,
    stop: null, // 잠깐 멈춤(지적): { by, text, to(되돌릴 행동 번호), what(그 행동 설명), at }
  };
  init.players.forEach((pl, p) => {
    pl.deck.forEach((cid, i) => { const iid = (p ? 'b' : 'a') + i; s.inst[iid] = cid; s.p[p].deck.push(iid); });
  });
  const ev = [];
  // 섞기, 코인, 7장, 멀리건
  for (const p of [0, 1]) shuffle(s, s.p[p].deck);
  s.coinWinner = coin(s) ? 0 : 1;
  ev.push({ pub: `코인 던지기: ${s.players[s.coinWinner].name} 님이 이겼어요. 선공·후공을 골라 주세요.` });
  for (const p of [0, 1]) {
    for (;;) {
      drawN(s, p, 7);
      if (s.p[p].hand.some(i => isBasicPokemon(info(s, i)))) break;
      s.p[p].mull++;
      ev.push({ pub: `${s.players[p].name}: 기본 포켓몬이 없어 멀리건 (${s.p[p].mull}번째). 손패 공개: ${s.p[p].hand.map(i => nm(s, i)).join(', ')}` });
      s.p[p].deck.push(...s.p[p].hand); s.p[p].hand = []; shuffle(s, s.p[p].deck);
      if (s.p[p].mull > 50) break;
    }
  }
  ev.push({ pub: '두 사람 모두 7장을 뽑았어요. 배틀 포켓몬과 벤치 포켓몬을 뒷면으로 놓아 주세요.' });
  return { s, ev };
}

function drawN(s, p, n) { const d = s.p[p].deck.splice(0, n); s.p[p].hand.push(...d); return d; }

// ---------- 위치 찾기 ----------
function locate(s, iid) {
  for (const p of [0, 1]) {
    const P = s.p[p];
    for (const z of ['deck', 'hand', 'prizes', 'discard', 'lost']) { const k = P[z].indexOf(iid); if (k >= 0) return { p, z, arr: P[z], k }; }
    for (const slot of [P.active, ...P.bench]) {
      if (!slot) continue;
      for (const part of ['cards', 'en', 'tl']) { const k = slot[part].indexOf(iid); if (k >= 0) return { p, z: 'slot', slot, part, arr: slot[part], k }; }
    }
  }
  if (s.stadium && (s.stadium.iid === iid || s.stadium.iid2 === iid)) return { p: s.stadium.by, z: 'stadium' };
  return null;
}
const stadIds = st => st ? [st.iid, st.iid2].filter(x => x != null) : []; // 짝 카드 스타디움은 두 장
function takeOut(s, iid) {
  const L = locate(s, iid); if (!L) return null;
  if (L.z === 'stadium') { const rest = stadIds(s.stadium).filter(x => x !== iid); s.stadium = rest.length ? { iid: rest[0], by: s.stadium.by } : null; return L; } // 짝 카드는 한 장씩 빠짐 (move가 남은 한 장도 함께 옮김)
  L.arr.splice(L.k, 1);
  if (L.z === 'slot' && L.part === 'cards' && L.slot.cards.length === 0) { // 포켓몬이 다 빠지면 붙은 카드는 트래시로
    const P = s.p[L.p];
    P.discard.push(...L.slot.en, ...L.slot.tl); removeSlot(s, L.p, L.slot.sid);
  }
  return L;
}
function findSlot(s, sid) {
  for (const p of [0, 1]) { const P = s.p[p]; if (P.active && P.active.sid === sid) return { p, slot: P.active, where: 'active' };
    const b = P.bench.find(x => x.sid === sid); if (b) return { p, slot: b, where: 'bench' }; }
  return null;
}
function removeSlot(s, p, sid) {
  const P = s.p[p];
  if (P.active && P.active.sid === sid) P.active = null; else P.bench = P.bench.filter(x => x.sid !== sid);
}
const newSlot = (s, iid) => ({ sid: 's' + (s.nextId++), cards: [iid], en: [], tl: [], dmg: 0, cond: {}, turnIn: s.turn });
const top = (s, slot) => info(s, slot.cards[slot.cards.length - 1]);
const slotName = (s, slot) => nm(s, slot.cards[slot.cards.length - 1]);
const allSlots = P => [P.active, ...P.bench].filter(Boolean);
const stadR = s => stadRules(s.stadium ? info(s, s.stadium.iid) : null); // 깔린 스타디움의 규칙 (특성 없어짐·카운터 막기·활력의 숲 …)
const stadNm = s => s.stadium ? nm(s, s.stadium.iid).replace(/ \((좌측|우측)\)$/, '') : '';

// 보이는 카드인지 (조작하려는 사람 기준)
function visibleTo(s, iid, who) {
  const L = locate(s, iid); if (!L) return false;
  if (['discard', 'lost', 'slot', 'stadium'].includes(L.z)) return true;
  if (L.z === 'hand') return L.p === who || (s.p[who].look && s.p[who].look.p === L.p && s.p[who].look.z === 'hand');
  if (L.z === 'deck') { const lk = s.p[who].look; if (!lk || lk.p !== L.p || lk.z !== 'deck') return false; return lk.ids ? lk.ids.includes(iid) : lk.n == null || L.k < lk.n; }
  if (L.z === 'prizes') { const lk = s.p[who].look; return !!(lk && lk.p === L.p && lk.z === 'prizes'); }
  return false;
}

// ---------- 확인 요청(프롬프트) ----------
function addPrompt(s, pr) { pr.id = 'q' + (s.nextId++); pr.text = fixJosa(pr.text); s.prompts.push(pr); return pr; }
function checkKO(s, between = false) { // between: 포켓몬 체크(차례 사이)에서 기절
  for (const p of [0, 1]) for (const slot of allSlots(s.p[p])) {
    const hp = top(s, slot).hp || 0;
    if (hp && slot.dmg >= hp && !s.prompts.some(q => q.type === 'ko' && q.sid === slot.sid))
      addPrompt(s, { type: 'ko', p, sid: slot.sid, to: s.current ?? p, ...((s.rv || 1) >= 2 ? { kt: s.turn + (between ? 0.5 : 0) } : {}), text: `${slotName(s, slot)}이(가) 기절해요 (HP ${hp}, 데미지 ${slot.dmg}). 트래시로 보내고 상대가 프라이즈 ${prizeValue(top(s, slot))}장을 가져갈까요?` });
  }
}
function checkWin(s) {
  if (s.phase !== 'play') return;
  if (s.prompts.some(q => q.type === 'win')) return;
  for (const p of [0, 1]) {
    const P = s.p[p];
    if (P.prizes.length === 0 && s.turn > 0) return void addPrompt(s, { type: 'win', winner: p, reason: '프라이즈를 모두 가져갔어요', to: other(p), text: `${s.players[p].name} 님이 프라이즈를 모두 가져가 승리해요. 확정할까요?` });
    if (!P.active && P.bench.length === 0 && !s.prompts.some(q => q.type === 'ko'))
      return void addPrompt(s, { type: 'win', winner: other(p), reason: '상대 필드에 포켓몬이 없어요', to: p, text: `${s.players[p].name} 님의 필드에 포켓몬이 없어 ${s.players[other(p)].name} 님이 승리해요. 확정할까요?` });
  }
}
function needPromote(s) {
  for (const p of [0, 1]) {
    const P = s.p[p];
    if (s.phase === 'play' && !P.active && P.bench.length && !s.prompts.some(q => q.type === 'promote' && q.p === p))
      addPrompt(s, { type: 'promote', p, to: p, text: '벤치에서 새 배틀 포켓몬을 골라 주세요.' });
  }
}

// ---------- 사람 판정 묶음 ----------
function openGroup(s, who, title, idx, note) {
  const g = { gid: 'g' + (s.nextId++), who, title, note: note || '', start: idx, status: 'open', disputes: [] };
  s.groups.push(g); s.openGroup[who] = g.gid; return g;
}
function closeGroup(s, who) {
  const gid = s.openGroup[who]; if (!gid) return;
  const g = s.groups.find(x => x.gid === gid); if (g && g.status === 'open') g.status = 'pending';
  s.openGroup[who] = null;
}
const groupOf = (s, gid) => s.groups.find(x => x.gid === gid);

// ---------- 행동 처리 ----------
// apply(s, who, a, idx) -> { ok, err?, warn?, ev:[{pub, own?, ownBy?}], gid? }
// a.force = true 이면 경고를 무시하고 진행(사람 판정으로 기록)
export function apply(s, who, a, idx = 0, opt = {}) {
  const ev = [];
  const R2 = (s.rv || 1) >= 2; // 새 판(규칙 판 2)에서만 쓰는 규칙
  const replayQuiet = !!opt.replay && !a.force; // 기록을 다시 돌릴 때: 그때 이미 받아들여진 행동이라 경고로 멈추지 않음
  const me = s.players[who]?.name || '?';
  const P = s.p[who], O = s.p[other(who)];
  const warns = [];
  const warn = m => warns.push(m);
  const fail = err => ({ ok: false, err, ev: [] });
  const say = (pub, own) => ev.push(own ? { pub, own, ownBy: who } : { pub });
  const show = (iids, title) => { const e = ev[ev.length - 1]; if (e && iids.length) { e.show = iids.map(i => s.inst[i]); e.showT = title; } }; // 바로 앞 기록 줄에 보여준 카드(카드 번호)를 붙임
  if (s.phase === 'over' && !['chat', 'agree', 'dispute'].includes(a.type)) return fail('끝난 판이에요.');
  // 잠깐 멈춘 동안에는 채팅·대답·항복만 (지적을 정리해야 판이 다시 움직임)
  if (s.stop && !['chat', 'stopEnd', 'concede', 'agree', 'dispute', 'rewindAsk', 'rewindNo', 'lookEnd', 'adminEnd'].includes(a.type)) return fail('잠깐 멈춘 상태예요. 지적을 먼저 정리해 주세요.');

  let gid = null; // 이 행동이 속한 사람 판정 묶음
  const judged = (title) => { // 사람 판정 묶음에 넣기 (없으면 새로)
    if (s.openGroup[who]) { gid = s.openGroup[who]; return; }
    const g = openGroup(s, who, title, idx); gid = g.gid;
  };
  const finishWarns = (title) => {
    if (!warns.length || replayQuiet) return null;
    if (!a.force) return { ok: false, warn: warns.map(fixJosa), ev: [] };
    judged('규칙 예외: ' + title);
    const g = groupOf(s, gid); g.note = (g.note ? g.note + ' / ' : '') + warns.join(' / ') + (a.note ? ' — ' + a.note : '');
    say(`⚑ ${me}: 경고를 넘기고 진행 (${warns.join(', ')})${a.note ? ' — ' + a.note : ''}`);
    return null;
  };
  const myTurn = () => s.phase === 'play' && s.current === who;

  switch (a.type) {
    // ----- 준비 단계 -----
    case 'order': {
      if (s.phase !== 'setup' || s.first != null) return fail('지금은 고를 수 없어요.');
      if (who !== s.coinWinner) return fail('코인을 이긴 사람이 골라요.');
      s.first = a.first ? who : other(who);
      say(`${me}: ${a.first ? '선공' : '후공'}을 골랐어요. 선공은 ${s.players[s.first].name} 님이에요.`);
      break;
    }
    case 'setupPlace': { // {iid, to:'active'|'bench'}
      if (s.phase !== 'setup' || P.ready) return fail('지금은 놓을 수 없어요.');
      if (!P.hand.includes(a.iid)) return fail('손패에 없는 카드예요.');
      if (!isBasicPokemon(info(s, a.iid))) return fail('준비 단계에는 기본 포켓몬만 놓을 수 있어요.');
      if (a.to === 'active') { if (P.active) P.hand.push(...P.active.cards); P.active = null; P.hand.splice(P.hand.indexOf(a.iid), 1); P.active = newSlot(s, a.iid); }
      else { if (P.bench.length >= 5) return fail('벤치는 5마리까지예요.'); P.hand.splice(P.hand.indexOf(a.iid), 1); P.bench.push(newSlot(s, a.iid)); }
      ev.push({ pub: `${me}: 포켓몬 1장을 뒷면으로 놓았어요.`, own: `${a.to === 'active' ? '배틀' : '벤치'}에 ${nm(s, a.iid)}`, ownBy: who, quiet: true });
      break;
    }
    case 'setupReturn': {
      if (s.phase !== 'setup' || P.ready) return fail('지금은 할 수 없어요.');
      const f = findSlot(s, a.sid); if (!f || f.p !== who) return fail('내 포켓몬이 아니에요.');
      P.hand.push(...f.slot.cards); removeSlot(s, who, a.sid);
      ev.push({ pub: `${me}: 놓은 포켓몬을 손패로 되돌렸어요.`, quiet: true });
      break;
    }
    case 'mullDraw': { // 상대 멀리건 수만큼 추가 드로우 (0~n)
      if (s.phase !== 'setup' || P.ready || P.mullDrawn) return fail('지금은 할 수 없어요.');
      const n = Math.max(0, Math.min(O.mull, a.n | 0));
      const d = drawN(s, who, n); P.mullDrawn = true;
      say(`${me}: 상대 멀리건으로 ${n}장을 더 뽑았어요.`, d.length ? d.map(i => nm(s, i)).join(', ') : '');
      break;
    }
    case 'setupDone': {
      if (s.phase !== 'setup' || P.ready) return fail('지금은 할 수 없어요.');
      if (!P.active) return fail('배틀 포켓몬을 먼저 놓아 주세요.');
      if (O.mull > 0 && !P.mullDrawn) warn(`상대가 멀리건을 ${O.mull}번 했어요. 추가로 뽑을지 먼저 정해 주세요.`);
      const w = finishWarns('준비'); if (w) return w;
      P.ready = true;
      say(`${me}: 준비 완료.`);
      if (s.p[0].ready && s.p[1].ready && s.first != null) startPlay(s, ev);
      break;
    }
    // ----- 차례 행동 (기본 룰 도우미) -----
    case 'bench': { // 손패의 기본 포켓몬을 벤치로
      if (!P.hand.includes(a.iid)) return fail('손패에 없는 카드예요.');
      const c = info(s, a.iid);
      if (!myTurn()) warn('내 차례가 아니에요.');
      if (!isBasicPokemon(c)) warn('기본 포켓몬이 아니에요.');
      if (P.bench.length >= 5) return fail('벤치가 가득 찼어요 (5마리).');
      const w = finishWarns('벤치에 놓기'); if (w) return w;
      P.hand.splice(P.hand.indexOf(a.iid), 1);
      const sl = newSlot(s, a.iid); if (R2) sl.benchAt = s.turn; // 손패에서 낸 차례 (나옹 ex '패에서 벤치로 내보냈을 때' 등)
      if (!P.active) P.active = sl; else P.bench.push(sl);
      say(`${me}: ${nm(s, a.iid)}을(를) ${P.active === sl ? '배틀 포켓몬으로' : '벤치에'} 냈어요.`);
      break;
    }
    case 'evolve': { // {iid, sid, candy?: 이상한사탕(1진화 건너뜀), from?: 'deck'(덱에서 본 카드로 진화), chain?: 같은 효과로 이어서 한 번 더}
      const fromDeck = a.from === 'deck';
      if (fromDeck ? !(P.deck.includes(a.iid) && visibleTo(s, a.iid, who)) : !P.hand.includes(a.iid)) return fail(fromDeck ? '덱에서 보고 있는 카드만 고를 수 있어요.' : '손패에 없는 카드예요.');
      const f = findSlot(s, a.sid); if (!f || f.p !== who) return fail('내 포켓몬이 아니에요.');
      const c = info(s, a.iid), base = top(s, f.slot);
      if (!myTurn()) warn('내 차례가 아니에요.');
      if (c.st !== 'P' || isBasicPokemon(c)) warn('진화 포켓몬이 아니에요.');
      if (s.turn <= 2) warn('두 사람 모두 첫 차례에는 진화할 수 없어요.');
      const st = R2 ? stadR(s) : null;
      const forest = !!(st && st.forest && (c.ty || []).includes(st.forest) && (base.ty || []).includes(st.forest) && f.slot.evoAt !== s.turn); // 활력의 숲: 처음 나온 차례라도 (풀)끼리는 진화
      const chained = !!(a.chain && f.slot.evoBy && f.slot.evoBy === s.openGroup[who]); // 위대한 거목: 같은 효과로 이어서 2진화
      if (f.slot.turnIn === s.turn && !forest && !chained) warn('이번 차례에 나왔거나 진화한 포켓몬이에요.');
      if (a.candy) {
        if (!has(c, 'Stage 2')) warn('이상한사탕으로는 2진화 포켓몬을 올려요.');
        if (!isBasicPokemon(base)) warn('이상한사탕은 기본 포켓몬 위에 올려요.');
        else if (evoOk(c, base, true) === false) warn(`${evoName(c, true)}에서 진화하는 카드예요.`);
      } else if (R2) { if (evoOk(c, base) === false) warn(`${evoName(c)}에서 진화하는 카드예요.`); }
      else if (c.ef && c.ef !== base.n) warn(`${c.ef}에서 진화하는 카드예요.`);
      const w = finishWarns('진화'); if (w) return w;
      const from = slotName(s, f.slot);
      if (fromDeck) { takeOut(s, a.iid); if (P.look && P.look.ids) { P.look.ids = P.look.ids.filter(i => i !== a.iid); if (!P.look.ids.length) P.look = null; } }
      else P.hand.splice(P.hand.indexOf(a.iid), 1);
      f.slot.cards.push(a.iid); f.slot.turnIn = s.turn; f.slot.cond = {};
      if (R2) f.slot.evoAt = s.turn;
      if (a.candy || fromDeck) { judged(a.candy ? '이상한사탕' : '덱에서 진화'); if (fromDeck) f.slot.evoBy = gid; } // 카드 효과로 한 진화는 사람 판정 묶음에
      say(`${me}: ${from}을(를) ${nm(s, a.iid)}(으)로 진화시켰어요.${a.candy ? ' (이상한사탕: 1진화 건너뜀)' : fromDeck ? ' (덱에서)' : ''}`);
      break;
    }
    case 'attach': { // 에너지나 도구를 손패에서 포켓몬에
      if (!P.hand.includes(a.iid)) return fail('손패에 없는 카드예요.');
      const f = findSlot(s, a.sid); if (!f) return fail('포켓몬을 찾을 수 없어요.');
      const c = info(s, a.iid);
      if (!myTurn()) warn('내 차례가 아니에요.');
      if (f.p !== who) warn('상대 포켓몬이에요.');
      let part;
      if (isEnergy(c)) { part = 'en'; if (P.used.energy) warn('이번 차례에 이미 에너지를 붙였어요.'); }
      else if (has(c, 'Pokémon Tool')) { part = 'tl'; if (f.slot.tl.length) warn('이미 도구가 붙어 있어요.'); }
      else return fail('에너지나 포켓몬의 도구만 붙일 수 있어요.');
      const w = finishWarns(isEnergy(c) ? '에너지 붙이기' : '도구 붙이기'); if (w) return w;
      P.hand.splice(P.hand.indexOf(a.iid), 1); f.slot[part].push(a.iid);
      if (part === 'en' && !gid) P.used.energy = true;
      say(`${me}: ${slotName(s, f.slot)}에게 ${nm(s, a.iid)}을(를) 붙였어요.`);
      if (part === 'tl') { judged(nm(s, a.iid)); }
      break;
    }
    case 'play': { // 트레이너스 사용
      if (!P.hand.includes(a.iid)) return fail('손패에 없는 카드예요.');
      const c = info(s, a.iid);
      if (c.st !== 'T') return fail('트레이너스 카드가 아니에요.');
      if (!myTurn()) warn('내 차례가 아니에요.');
      if (has(c, 'Supporter')) {
        if (P.used.supporter) warn('이번 차례에 이미 서포트를 썼어요.');
        if (s.turn === 1) warn('선공 첫 차례에는 서포트를 쓸 수 없어요.');
      }
      let mate = null;
      if (c.pair) { // 좌측·우측 두 장을 함께 내야 하는 카드
        mate = P.hand.find(i => i !== a.iid && info(s, i).id === c.pair);
        if (mate == null) return fail(`${c.kn || c.n}: 좌측·우측 두 장이 모두 손패에 있어야 낼 수 있어요.`);
      }
      if (has(c, 'Stadium')) {
        if (P.used.stadium) warn('이번 차례에 이미 스타디움을 냈어요.');
        if (s.stadium && info(s, s.stadium.iid).n === c.n) warn('같은 이름의 스타디움이 이미 나와 있어요.');
      }
      if (R2) { // 꼬몽울 '근질근질 꽃가루' 같은 금지, 카드 글의 사용 조건
        const lk = P.lock || {};
        if (has(c, 'Item') && lk.item === s.turn) warn(`${lk.itemBy ? `「${lk.itemBy}」` : '상대 기술'} 때문에 이번 차례에는 손패에서 아이템을 쓸 수 없어요.`);
        if (has(c, 'Supporter') && lk.sup === s.turn) warn(`${lk.supBy ? `「${lk.supBy}」` : '상대 기술'} 때문에 이번 차례에는 손패에서 서포트를 쓸 수 없어요.`);
        for (const q of trainerConds(c)) {
          if (q.k === 'ko' && P.koTurn !== s.turn - 1) warn('상대의 지난 차례에 내 포켓몬이 기절했을 때만 쓸 수 있어요.');
          if (q.k === 'oppPrizes' && O.prizes.length > q.n) warn(`상대의 남은 프라이즈가 ${q.n}장 이하일 때만 쓸 수 있어요 (지금 ${O.prizes.length}장).`);
          if (q.k === 'myPrizes' && P.prizes.length > q.n) warn(`내 남은 프라이즈가 ${q.n}장 이하일 때만 쓸 수 있어요 (지금 ${P.prizes.length}장).`);
          if (q.k === 'handCost') { const left = P.hand.length - 1 - (mate != null ? 1 : 0); if (left < q.n) warn(`손패를 ${q.n}장 트래시해야 쓸 수 있어요 (남는 손패 ${left}장).`); }
        }
      }
      if (has(c, 'Pokémon Tool')) return fail('도구는 포켓몬에 붙여 주세요.');
      const w = finishWarns('트레이너스'); if (w) return w;
      closeGroup(s, who);
      P.hand.splice(P.hand.indexOf(a.iid), 1);
      if (mate != null) P.hand.splice(P.hand.indexOf(mate), 1);
      if (has(c, 'Stadium')) {
        if (s.stadium) s.p[s.stadium.by].discard.push(...stadIds(s.stadium));
        s.stadium = mate != null ? { iid: c.side === 'R' ? mate : a.iid, iid2: c.side === 'R' ? a.iid : mate, by: who } : { iid: a.iid, by: who }; P.used.stadium = true; // 짝 카드: iid = 좌측, iid2 = 우측
      } else P.discard.push(a.iid, ...(mate != null ? [mate] : []));
      if (has(c, 'Supporter')) P.used.supporter = true;
      const g = openGroup(s, who, nm(s, a.iid), idx, a.note); gid = g.gid;
      say(`${me}: ${has(c, 'Supporter') ? '서포트' : has(c, 'Stadium') ? '스타디움' : '아이템'} ${mate != null ? `${c.kn || c.n}(좌측·우측 2장)` : nm(s, a.iid)}을(를) 썼어요.${a.note ? ' — ' + a.note : ''}`);
      break;
    }
    case 'ability': { // {sid, k}
      const f = findSlot(s, a.sid); if (!f || f.p !== who) return fail('내 포켓몬이 아니에요.');
      const tc = top(s, f.slot); const ab0 = (tc.ab || [])[a.k | 0]; if (!ab0) return fail('특성이 없어요.');
      const ab = (tc.kab || [])[a.k | 0] || ab0;
      const abKey = `${a.sid}:${a.k | 0}`, once = /차례에 1번|Once during your turn/i.test(`${ab.t || ''} ${ab0.t || ''}`);
      const usedOnce = once && (P.used.ab || []).includes(abKey);
      if (usedOnce) warn(`이번 차례에 이미 쓴 특성이에요 (${ab.n}).`);
      if (R2) { // 스타디움으로 없어진 특성, 카드 글의 사용 조건
        if (abLost(stadR(s), tc)) warn(`「${stadNm(s)}」 때문에 이 포켓몬은 지금 특성이 없어요.`);
        const abn = P.used.abn || [];
        for (const q of abilityConds(ab.t)) {
          if (q.k === 'active' && f.where !== 'active') warn('배틀필드에 있을 때만 쓰는 특성이에요.');
          if (q.k === 'bench' && f.where !== 'bench') warn('벤치에 있을 때만 쓰는 특성이에요.');
          if (q.k === 'ko' && P.koTurn !== s.turn - 1) warn('상대의 지난 차례에 내 포켓몬이 기절하지 않았어요.');
          if (q.k === 'energy' && !f.slot.en.some(i => { const e = info(s, i), t = basicEnergyType(e); return t ? t === q.ty : !has(e, 'Basic'); })) warn(`이 포켓몬에게 (${q.ko}) 에너지가 붙어 있지 않아요.`); // 특수 에너지는 사람이 판단
          if (q.k === 'benched' && f.slot.benchAt !== s.turn) warn('이번 차례에 손패에서 벤치로 낸 포켓몬만 쓸 수 있어요.');
          if (q.k === 'name' && !usedOnce && abn.includes(q.n)) warn(`이번 차례에 이미 「${q.n}」 특성을 썼어요.`);
          if (q.k === 'nameHas' && !usedOnce && abn.some(x => x.includes(q.n))) warn(`이번 차례에 이미 이름에 「${q.n}」이(가) 적힌 특성을 썼어요.`);
          if (q.k === 'myTurn' && !myTurn()) warn('내 차례에 쓰는 특성이에요.');
        }
      }
      const w = finishWarns('특성'); if (w) return w;
      closeGroup(s, who);
      P.used.ab = [...(P.used.ab || []).filter(x => x !== abKey), abKey]; // 특성 사용 표시 (차례가 바뀌면 지워짐)
      if (R2) P.used.abn = [...(P.used.abn || []), ab.n]; // 이번 차례에 쓴 특성 이름 (다른 「역이용」 등)
      const g = openGroup(s, who, `${slotName(s, f.slot)}의 특성 ${ab.n}`, idx, a.note); gid = g.gid;
      say(`${me}: ${slotName(s, f.slot)}의 특성 「${ab.n}」을(를) 썼어요.${a.note ? ' — ' + a.note : ''}`);
      break;
    }
    case 'retreat': { // {sid: 벤치 포켓몬, discard:[에너지 iid]}
      if (!P.active) return fail('배틀 포켓몬이 없어요.');
      const f = findSlot(s, a.sid); if (!f || f.p !== who || f.where !== 'bench') return fail('내 벤치 포켓몬을 골라 주세요.');
      const cost = top(s, P.active).rt || 0, dis = a.discard || [];
      if (!myTurn()) warn('내 차례가 아니에요.');
      if (P.used.retreat) warn('이번 차례에 이미 후퇴했어요.');
      if (P.active.cond.asleep || P.active.cond.paralyzed) warn('잠듦이나 마비 상태에서는 후퇴할 수 없어요.');
      if (dis.length !== cost) warn(`후퇴 비용은 에너지 ${cost}개예요 (지금 ${dis.length}개).`);
      if (dis.some(i => !P.active.en.includes(i))) return fail('배틀 포켓몬에 붙은 에너지만 트래시할 수 있어요.');
      const w = finishWarns('후퇴'); if (w) return w;
      for (const i of dis) { P.active.en.splice(P.active.en.indexOf(i), 1); P.discard.push(i); }
      const old = P.active; old.cond = {};
      P.bench.splice(P.bench.indexOf(f.slot), 1); P.bench.push(old); P.active = f.slot;
      if (!gid) P.used.retreat = true;
      say(`${me}: ${slotName(s, old)}이(가) 후퇴하고 ${slotName(s, f.slot)}이(가) 배틀 포켓몬이 됐어요.${dis.length ? ` (에너지 ${dis.length}장 트래시)` : ''}`);
      break;
    }
    case 'attack': { // {k, dmg?: 최종 데미지(사람이 고친 값), note, target?: 맞을 상대 포켓몬(고르는 기술), coins?: true(동전 기술: 사이트가 던져 계산)}
      if (!P.active) return fail('배틀 포켓몬이 없어요.');
      const c = top(s, P.active), at0 = (c.at || [])[a.k | 0]; if (!at0) return fail('기술이 없어요.');
      const at = { ...at0, n: ((c.kat || [])[a.k | 0] || at0).n };
      const kt = R2 ? (((c.kat || [])[a.k | 0] || {}).t || '') : ''; // 한국어 기술 글 (새 판에서만 읽음)
      const tgt = R2 && a.target ? findSlot(s, a.target) : null;
      if (R2 && a.target && (!tgt || tgt.p === who)) return fail('맞을 상대 포켓몬을 골라 주세요.');
      const onBench = !!tgt && tgt.where === 'bench';
      const cs = R2 && a.coins ? coinSpec(kt) : null;
      if (R2 && a.coins && !cs) return fail('동전을 던지는 기술이 아니에요.');
      if (!myTurn()) warn('내 차례가 아니에요.');
      if (s.turn === 1) warn('선공 첫 차례에는 기술을 쓸 수 없어요.');
      if (P.used.attack) warn('이번 차례에 이미 기술을 썼어요.');
      if (P.active.cond.asleep || P.active.cond.paralyzed) warn('잠듦이나 마비 상태에서는 기술을 쓸 수 없어요.');
      if (!canPay(s, P.active, at.c || [])) warn('에너지가 모자라요.');
      if (onBench && benchImmune(top(s, tgt.slot))) warn(`${slotName(s, tgt.slot)}은(는) 벤치에 있는 한 기술 데미지를 받지 않아요.`);
      const sug = suggestDamage(s, who, a.k | 0, tgt ? tgt.slot.sid : null);
      const edited = a.dmg != null && !cs && sug.dmg !== a.dmg;
      if (edited && !a.force) warn(`데미지를 ${sug.dmg}에서 ${a.dmg}(으)로 바꿨어요.`);
      const w = finishWarns('기술'); if (w) return w;
      closeGroup(s, who);
      P.used.attack = true;
      if (P.active.cond.confused) {
        const h = coin(s);
        if (!h) { P.active.dmg += 30; say(`${me}: ${slotName(s, P.active)}은(는) 혼란 상태. 코인 뒷면 — 기술 실패, 자신에게 데미지 30.`); checkKO(s); break; }
        say(`${me}: 혼란 코인 앞면 — 기술을 그대로 써요.`);
      }
      const D = tgt ? tgt.slot : O.active; // 맞는 포켓몬 (고르는 기술이면 고른 포켓몬)
      let dmg = a.dmg != null && !cs ? a.dmg : sug.dmg;
      if (cs) { // 동전 기술: 사이트가 던지고 앞면 수로 계산
        const nEn = sl => sl ? sl.en.length : 0;
        const n = cs.n === 'tails' ? 60 : cs.n === 'en' ? nEn(P.active) : cs.n === 'en2' ? nEn(P.active) + nEn(O.active) : cs.n;
        const r = []; for (let i = 0; i < Math.min(60, n); i++) { const h = coin(s); r.push(h); if (cs.n === 'tails' && !h) break; }
        const h = r.filter(Boolean).length, parts = [`${cs.add ? `기본 ${sug.base} + ` : ''}앞면 ${h} × ${cs.per}`];
        const raw = (cs.add ? sug.base : 0) + h * cs.per;
        dmg = onBench || !D ? raw : applyWR(c, top(s, D), raw, parts); sug.parts = parts;
        say(r.length ? `${me}: 코인 ${r.length}번 — ${r.map(x => x ? '앞' : '뒤').join(' ')} (앞면 ${h}번) · ${at.n}` : `${me}: 던질 동전이 없어요 (0번) · ${at.n}`);
      }
      let txt = `${me}: ${slotName(s, P.active)}의 기술 「${at.n}」`;
      if (D && dmg > 0) { D.dmg += dmg; txt += ` → ${onBench ? '상대 벤치 ' : ''}${slotName(s, D)}에게 ${dmg}데미지`; if (sug.parts.length) txt += ` (${sug.parts.join(', ')})`; }
      else if (cs && D) txt += ' → 데미지 없음';
      if (R2) { // 조건 없는 특수상태, 다음 차례 아이템·서포트 금지
        const sc = statusOf(kt);
        if (sc && O.active) { const cd = O.active.cond; for (const k of sc) { if (['asleep', 'confused', 'paralyzed'].includes(k)) { delete cd.asleep; delete cd.confused; delete cd.paralyzed; } cd[k] = true; } txt += ` · ${slotName(s, O.active)} ${sc.map(k => COND_KO[k]).join('·')}`; }
        const lk = lockOf(kt);
        if (lk) { O.lock = { ...(O.lock || {}), [lk]: s.turn + 1, [lk + 'By']: at.n }; txt += ` · ${s.players[other(who)].name} 님은 다음 차례에 손패의 ${LOCK_KO[lk]}을(를) 쓸 수 없어요`; }
      }
      say(txt + (a.note ? ' — ' + a.note : ''));
      if (edited || (at.t && at.t.trim())) { const g = openGroup(s, who, `기술 ${at.n}`, idx, a.note || (edited ? `데미지 ${sug.dmg}→${dmg}` : '')); gid = g.gid; }
      checkKO(s);
      break;
    }
    case 'endTurn': {
      if (!myTurn()) return fail('내 차례가 아니에요.');
      if (s.prompts.some(q => q.type === 'ko' || q.type === 'prize' || q.type === 'promote')) warn('기절·프라이즈·배틀 포켓몬 고르기가 남아 있어요.');
      const w = finishWarns('차례 끝내기'); if (w) return w;
      closeGroup(s, who);
      say(`${me}: 차례를 끝냈어요.`);
      P.look = null;
      const items = checkupItems(s);
      if (items.length) addPrompt(s, { type: 'checkup', to: who, items, text: '포켓몬 체크: ' + items.map(x => x.text).join(' · ') });
      else nextTurn(s, ev);
      break;
    }
    case 'confirm': { // 확인 요청에 "이대로" (a.pid, 프라이즈면 a.k, 승격이면 a.sid)
      const q = s.prompts.find(x => x.id === a.pid); if (!q) return fail('이미 처리된 확인이에요.');
      if (q.type === 'ko') {
        const f = findSlot(s, q.sid); s.prompts = s.prompts.filter(x => x !== q);
        if (!f) break;
        const val = prizeValue(top(s, f.slot)), owner = f.p, nmK = slotName(s, f.slot), wasActive = f.where === 'active';
        s.p[owner].discard.push(...f.slot.cards, ...f.slot.en, ...f.slot.tl); removeSlot(s, owner, f.slot.sid);
        if (R2) s.p[owner].koTurn = q.kt ?? (s.prompts.some(x => x.type === 'next') ? s.turn + 0.5 : s.turn); // 기절한 차례 (기절 확인을 늦게 눌러도 기절한 때로. 포켓몬 체크 때는 차례 사이: '상대의 이전 차례에 기절'이 아님)
        say(`${nmK} 기절 → 트래시. ${s.players[other(owner)].name} 님이 프라이즈 ${val}장을 가져가요.`);
        const n = Math.min(val, s.p[other(owner)].prizes.length);
        if (n > 0) addPrompt(s, { type: 'prize', p: other(owner), n, to: other(owner), text: `프라이즈 ${n}장을 골라 가져가 주세요.` });
        if (wasActive) needPromote(s);
        checkWin(s);
      } else if (q.type === 'prize') {
        if (who !== q.p) return fail('프라이즈를 가져갈 사람이 골라요.');
        const Pp = s.p[q.p], k = a.k | 0; if (k < 0 || k >= Pp.prizes.length) return fail('프라이즈를 골라 주세요.');
        const [iid] = Pp.prizes.splice(k, 1); Pp.hand.push(iid);
        q.n--; say(`${me}: 프라이즈 1장을 손패로 (남은 프라이즈 ${Pp.prizes.length}장).`, nm(s, iid));
        if (q.n <= 0) s.prompts = s.prompts.filter(x => x !== q);
        checkWin(s);
      } else if (q.type === 'promote') {
        if (who !== q.p) return fail('본인이 골라요.');
        const f = findSlot(s, a.sid); if (!f || f.p !== who || f.where !== 'bench') return fail('벤치 포켓몬을 골라 주세요.');
        s.p[who].bench.splice(s.p[who].bench.indexOf(f.slot), 1); s.p[who].active = f.slot;
        s.prompts = s.prompts.filter(x => x !== q);
        say(`${me}: ${slotName(s, f.slot)}을(를) 배틀 포켓몬으로 냈어요.`);
      } else if (q.type === 'checkup') {
        s.prompts = s.prompts.filter(x => x !== q);
        runCheckup(s, ev);
        checkKO(s, true);
        if (!s.prompts.some(x => x.type === 'ko')) nextTurn(s, ev); else addPrompt(s, { type: 'next', to: s.current, text: '기절 처리가 끝나면 다음 차례로 넘어가요.' });
      } else if (q.type === 'handReset') { // 상대가 요청한 손패 정리: 손패 주인이 누름
        if (who !== q.p) return fail('손패 주인이 눌러서 처리해요.');
        s.prompts = s.prompts.filter(x => x !== q); applyReset(s, q, ev);
      } else if (q.type === 'next') {
        s.prompts = s.prompts.filter(x => x !== q); nextTurn(s, ev);
      } else if (q.type === 'win') {
        s.prompts = []; s.phase = 'over'; s.winner = q.winner; s.winReason = q.reason;
        say(`🏆 ${s.players[q.winner].name} 님 승리 — ${q.reason}`);
      } else if (q.type === 'deckout') {
        s.prompts = []; s.phase = 'over'; s.winner = other(q.p); s.winReason = '상대 덱이 없어 카드를 뽑지 못했어요';
        say(`🏆 ${s.players[other(q.p)].name} 님 승리 — ${s.winReason}`);
      }
      break;
    }
    case 'dismiss': { // 확인 요청을 "다르게 처리" (사람 판정)
      const q = s.prompts.find(x => x.id === a.pid); if (!q) return fail('이미 처리된 확인이에요.');
      s.prompts = s.prompts.filter(x => x !== q);
      judged('자동 처리 대신 직접: ' + ({ ko: '기절', prize: '프라이즈', promote: '배틀 포켓몬', checkup: '포켓몬 체크', win: '승패', deckout: '덱 아웃', next: '다음 차례', handReset: '손패 정리' }[q.type] || q.type));
      const g = groupOf(s, gid); if (a.note) g.note = a.note;
      say(`⚑ ${me}: 자동 제안 「${q.text}」 대신 직접 처리해요.${a.note ? ' — ' + a.note : ''}`);
      if (q.type === 'checkup' || q.type === 'next') nextTurn(s, ev);
      break;
    }
    // ----- 카드 효과용 도구 (모두 사람 판정) -----
    case 'effect': { // 효과 쓰기 시작 {title, note}
      closeGroup(s, who);
      const g = openGroup(s, who, a.title || '카드 효과', idx, a.note); gid = g.gid;
      say(`⚑ ${me}: 효과 처리 시작 — ${g.title}${a.note ? ' — ' + a.note : ''}`);
      break;
    }
    case 'effectEnd': {
      if (!s.openGroup[who]) return fail('진행 중인 효과가 없어요.');
      gid = s.openGroup[who]; const g = groupOf(s, gid);
      if (a.note) g.note = a.note;
      closeGroup(s, who); P.look = null;
      say(`${me}: 효과 처리 끝 — ${g.title}${g.note ? ' — ' + g.note : ''}. 상대 확인을 기다려요.`);
      break;
    }
    case 'note': { // 진행 중인 효과에 설명 달기
      const g = groupOf(s, a.gid || s.openGroup[who]); if (!g || g.who !== who) return fail('설명을 달 효과가 없어요.');
      g.note = String(a.text || '').slice(0, 200); gid = g.gid;
      say(`${me}: 설명 — ${g.note}`);
      break;
    }
    case 'draw': {
      const n = Math.max(1, a.n | 0); judged('카드 뽑기');
      const d = drawN(s, who, n);
      say(`${me}: 덱에서 ${d.length}장을 뽑았어요.`, d.map(i => nm(s, i)).join(', '));
      if (d.length < n) say(`${me}: 덱이 모자라요.`);
      break;
    }
    case 'shuffle': {
      const pp = a.p ?? who; judged('덱 섞기');
      shuffle(s, s.p[pp].deck); s.p[who].look = null;
      say(`${me}: ${pp === who ? '자기' : '상대'} 덱을 섞었어요.`);
      break;
    }
    case 'look': { // {p, z:'deck'|'hand'|'prizes', n}
      const pp = a.p ?? who; const z = a.z || 'deck';
      if (pp !== who && z === 'deck' && !a.force) warn('상대 덱을 보는 효과인지 확인해 주세요.');
      if (pp !== who && z === 'hand' && !a.force) warn('상대 손패를 보는 효과인지 확인해 주세요.');
      const w = finishWarns('카드 보기'); if (w) return w;
      judged('카드 보기');
      const bot = z === 'deck' && a.n && a.from === 'bottom', nn = a.n ? Math.max(1, a.n | 0) : null; // from:'bottom' = 덱 아래에서 N장
      P.look = { p: pp, z, n: nn, ...(bot ? { bottom: true } : {}) };
      if (z === 'deck' && nn) P.look.ids = bot ? s.p[pp].deck.slice(-nn) : s.p[pp].deck.slice(0, nn); // 위·아래에서 N장: 본 카드만 (옮기면 빠지고 새 카드가 채워지지 않음)
      say(`${me}: ${pp === who ? '자기' : '상대'} ${({ deck: '덱', hand: '손패', prizes: '프라이즈' })[z]}${nn ? ` ${bot ? '아래' : '위'}에서 ${nn}장` : ''}을(를) 봤어요.`);
      break;
    }
    case 'lookEnd': { P.look = null; ev.push({ pub: `${me}: 보던 카드를 닫았어요.`, quiet: true }); break; }
    case 'reveal': { // 공개
      const ids = (a.iids || []).filter(i => visibleTo(s, i, who));
      if (!ids.length) return fail('보여 줄 카드를 골라 주세요.');
      judged('카드 공개');
      say(`${me}: 공개 — ${ids.map(i => nm(s, i)).join(', ')}`); show(ids, '보여준 카드');
      break;
    }
    case 'move': { // {iids, to:{z, p, sid, part, pos: top|bottom|shuffle}, random:{p, n}}
      const to = a.to || {}; const tp = to.p ?? who;
      let ids = [...(a.iids || [])];
      const rp = a.random ? (a.random.p ?? who) : null; // 손패에서 무작위로 N장 (보지 않고 고름. 상대 손패도 됨)
      if (a.random) {
        if (rp !== 0 && rp !== 1) return fail('누구의 손패인지 몰라요.');
        const pool = [...s.p[rp].hand]; if (!pool.length) return fail('손패가 없어요.');
        shuffle(s, pool); ids = pool.slice(0, Math.min(pool.length, Math.max(1, a.random.n | 0)));
      }
      if (!ids.length) return fail('옮길 카드를 골라 주세요.');
      if (!a.random) for (const i of ids) if (!visibleTo(s, i, who) && !(locate(s, i)?.z === 'hand' && locate(s, i)?.p === who)) return fail('볼 수 없는 카드는 고를 수 없어요.');
      if (to.z === 'bench' && s.p[tp].bench.length + ids.length > 5) return fail('벤치가 가득 찼어요.');
      judged('카드 옮기기');
      const desc = [];
      const fromZones = new Set();
      // a.show: 상대에게 보여주고 옮기기 (이름이 모두에게 보이고 카드 그림이 상대 화면에 뜸)
      // a.shuffle: 옮긴 뒤 내 덱 섞기 (덱 위로 되돌리면 남은 덱을 먼저 섞고 위에 놓음)
      for (const st of stadIds(s.stadium)) if (ids.includes(st)) for (const o of stadIds(s.stadium)) if (!ids.includes(o)) ids.splice(ids.indexOf(st) + 1, 0, o); // 짝 카드 스타디움은 두 장 함께 옮김
      const out = [];
      for (const i of ids) { const L = takeOut(s, i); if (L) out.push([i, L]); }
      if (P.look && P.look.ids) { P.look.ids = P.look.ids.filter(i => !ids.includes(i)); if (!P.look.ids.length) P.look = null; } // 위에서 본 카드를 다 옮기면 보기 끝
      const T = s.p[tp], mixFirst = a.shuffle && to.z === 'deck' && tp === who;
      if (mixFirst) shuffle(s, P.deck);
      let ins = to.z === 'deck' && to.pos !== 'bottom' ? [...out].reverse() : out; // 덱 위로 여러 장: 고른 순서대로 위에서부터
      if (a.mix) { ins = [...ins]; shuffle(s, ins); } // 뒷면으로 섞어서 (덱 아래로 되돌릴 때)
      for (const [i, L] of ins) {
        if (['hand', 'discard', 'lost', 'prizes'].includes(to.z)) T[to.z].push(i);
        else if (to.z === 'deck') { if (to.pos === 'bottom' || to.pos === 'shuffle') T.deck.push(i); else T.deck.unshift(i); }
        else if (to.z === 'slot') { const f = findSlot(s, to.sid); if (!f) { T.discard.push(i); continue; } f.slot[to.part || 'en'].push(i); }
        else if (to.z === 'bench' || to.z === 'active') {
          const sl = newSlot(s, i); if (R2 && L.z === 'hand') sl.benchAt = s.turn;
          if (to.z === 'active' && !T.active) T.active = sl; else T.bench.push(sl);
        }
      }
      for (const [i, L] of out) {
        fromZones.add(zoneKo(L.z === 'slot' ? (L.part === 'en' ? 'en' : L.part === 'tl' ? 'tl' : 'pk') : L.z));
        const hiddenFrom = L.z === 'deck' || L.z === 'hand' || L.z === 'prizes';
        const toHidden = ['deck', 'hand', 'prizes'].includes(to.z);
        desc.push(hiddenFrom && toHidden && !a.show ? null : nm(s, i));
      }
      const named = desc.filter(Boolean), hidden = desc.length - named.length;
      if (to.z === 'deck' && to.pos === 'shuffle') shuffle(s, T.deck); // 덱에 넣고 섞기
      const target = to.z === 'slot' ? (findSlot(s, to.sid) ? slotName(s, findSlot(s, to.sid).slot) + '에게' : '포켓몬에게') : to.z === 'deck' && to.pos === 'shuffle' ? `${tp === who ? '' : '상대 '}덱에 넣고 섞었어요.` : `${tp === who ? '' : '상대 '}${zoneKo(to.z)}${to.z === 'deck' ? (to.pos === 'bottom' ? ' 아래' : ' 위') : ''}(으)로`;
      const from = `${rp != null && rp !== who ? '상대 ' : ''}${[...fromZones].join('·')}에서${a.random ? ' 무작위로' : ''}`;
      const pubTxt = `${me}: ${from} ${named.length ? named.join(', ') : ''}${named.length && hidden ? ' 외 ' : ''}${hidden ? hidden + '장' : ''}을(를) ${a.show ? '보여주고 ' : ''}${a.mix ? '섞어서 ' : ''}${target}`;
      if (hidden && rp != null && rp !== who) ev.push({ pub: pubTxt, own: out.map(([i]) => nm(s, i)).join(', '), ownBy: rp }); // 상대 손패에서 무작위로 덱에: 이름은 손패 주인만 봄
      else say(pubTxt, hidden ? out.map(([i]) => nm(s, i)).join(', ') : null);
      if (a.show) show(out.map(([i]) => i), `${[...fromZones].join('·')}에서 보여준 카드`);
      if (a.shuffle && !mixFirst) { shuffle(s, P.deck); say(`${me}: 자기 덱을 섞었어요.`); }
      else if (mixFirst) say(`${me}: 남은 덱을 섞고 위에 올렸어요.`);
      if (a.shuffle) P.look = null;
      needPromote(s); checkWin(s);
      break;
    }
    case 'switch': { // 배틀 ↔ 벤치 맞바꾸기 {sid} (자기 또는 상대)
      const f = findSlot(s, a.sid); if (!f || f.where !== 'bench') return fail('벤치 포켓몬을 골라 주세요.');
      judged('포켓몬 바꾸기');
      const T = s.p[f.p], old = T.active;
      T.bench.splice(T.bench.indexOf(f.slot), 1); if (old) { old.cond = {}; T.bench.push(old); } T.active = f.slot;
      say(`${me}: ${f.p === who ? '' : '상대 '}${old ? slotName(s, old) : ''} ↔ ${slotName(s, f.slot)} (배틀 포켓몬 교체)`);
      break;
    }
    case 'damage': { // {sid, n: 바꿀 양(+/-), why?: 이유(판정 이름·기록), kind?: 'counter'(효과로 올리는 카운터) | 'atk'(기술 데미지)}
      const f = findSlot(s, a.sid); if (!f) return fail('포켓몬을 찾을 수 없어요.');
      const why = a.why ? String(a.why).slice(0, 40) : '';
      if (R2 && (a.n | 0) > 0 && f.p !== who && f.where === 'bench') {
        if (a.kind === 'counter' && stadR(s).cage) warn(`「${stadNm(s)}」: 상대 벤치 포켓몬에게는 기술·특성 효과로 데미지 카운터를 올릴 수 없어요.`);
        if (a.kind === 'atk' && benchImmune(top(s, f.slot))) warn(`${slotName(s, f.slot)}은(는) 벤치에 있는 한 기술 데미지를 받지 않아요.`);
      }
      const w = finishWarns('데미지 카운터'); if (w) return w;
      judged(why || '데미지 카운터');
      f.slot.dmg = Math.max(0, f.slot.dmg + (a.n | 0));
      say(`${me}: ${f.p === who ? '' : '상대 '}${slotName(s, f.slot)}에게 데미지 카운터 ${a.n > 0 ? '+' : ''}${(a.n | 0) / 10}개 (합계 ${f.slot.dmg})${why ? ' · ' + why : ''}`);
      checkKO(s);
      break;
    }
    case 'dmgMove': { // {from, to, n: 카운터 수, why} 데미지 카운터 옮기기 (이야후 '아드레나 브레인' 등)
      const A = findSlot(s, a.from), B = findSlot(s, a.to); if (!A || !B || A.slot === B.slot) return fail('어디서 어디로 옮길지 골라 주세요.');
      const amt = Math.min(Math.max(1, a.n | 0) * 10, A.slot.dmg); if (amt <= 0) return fail('옮길 데미지 카운터가 없어요.');
      if (R2 && B.p !== who && B.where === 'bench' && stadR(s).cage) warn(`「${stadNm(s)}」: 상대 벤치 포켓몬에게는 기술·특성 효과로 데미지 카운터를 올릴 수 없어요.`);
      const w = finishWarns('데미지 카운터 옮기기'); if (w) return w;
      const why = a.why ? String(a.why).slice(0, 40) : '';
      judged(why || '데미지 카운터 옮기기');
      A.slot.dmg -= amt; B.slot.dmg += amt;
      say(`${me}: ${A.p === who ? '' : '상대 '}${slotName(s, A.slot)}의 데미지 카운터 ${amt / 10}개를 ${B.p === who ? '' : '상대 '}${slotName(s, B.slot)}에게 옮겼어요${why ? ' · ' + why : ''}.`);
      checkKO(s);
      break;
    }
    case 'spread': { // {to: [{sid, n: 카운터 수}], why} 데미지 카운터를 여러 포켓몬에게 나눠 올리기 (드래펄트 ex '스펙터다이브' 등)
      const list = (Array.isArray(a.to) ? a.to : []).map(x => ({ f: findSlot(s, x && x.sid), n: Math.max(0, Math.min(30, (x && x.n) | 0)) })).filter(x => x.n > 0);
      if (!list.length || list.some(x => !x.f)) return fail('카운터를 올릴 포켓몬을 골라 주세요.');
      if (new Set(list.map(x => x.f.slot.sid)).size !== list.length) return fail('같은 포켓몬이 두 번 있어요.');
      if (R2 && stadR(s).cage && list.some(x => x.f.p !== who && x.f.where === 'bench')) warn(`「${stadNm(s)}」: 상대 벤치 포켓몬에게는 기술·특성 효과로 데미지 카운터를 올릴 수 없어요.`);
      const w = finishWarns('데미지 카운터'); if (w) return w;
      const why = a.why ? String(a.why).slice(0, 40) : '';
      judged(why || '데미지 카운터');
      for (const x of list) x.f.slot.dmg += x.n * 10;
      say(`${me}: 데미지 카운터 ${list.reduce((t, x) => t + x.n, 0)}개 — ${list.map(x => `${x.f.p === who ? '' : '상대 '}${slotName(s, x.f.slot)} ${x.n}개`).join(', ')}${why ? ' · ' + why : ''}`);
      checkKO(s);
      break;
    }
    case 'handReset': { // {who:'me'|'opp'|'both', how:'deck'(덱에 넣고 섞기)|'bottom'(섞어서 덱 아래로)|'discard', n:[내가, 상대가]} 릴리에의 결심·저지맨·레드카드 등
      if (s.phase !== 'play') return fail('지금은 할 수 없어요.');
      const ps = a.who === 'opp' ? [other(who)] : a.who === 'both' ? [who, other(who)] : a.who === 'me' ? [who] : null;
      if (!ps || !['deck', 'bottom', 'discard'].includes(a.how)) return fail('어떻게 할지 골라 주세요.');
      const nn = [0, 1].map(k => Math.max(0, Math.min(60, (Array.isArray(a.n) ? a.n[k] : 0) | 0)));
      judged('패 되돌리고 뽑기');
      const src = a.why ? String(a.why).slice(0, 40) : '';
      for (const p of ps) {
        const mine = p === who, on = s.players[p].name, n = nn[mine ? 0 : 1];
        if (!mine && a.ask) { // 상대 손패는 상대가 눌러서 처리 (11/18 링크 님). 누르지 않으면 상대 차례가 시작될 때 뽑기 전에 먼저 처리
          for (const q0 of s.prompts.filter(x => x.type === 'handReset' && x.p === p)) { s.prompts = s.prompts.filter(x => x !== q0); applyReset(s, q0, ev, '다음 요청 전에 먼저 처리 — '); } // 앞선 요청이 남아 있으면 순서대로
          addPrompt(s, { type: 'handReset', p, to: p, how: a.how, n, src, by: who, text: `${me} 님의 「${src || '카드 효과'}」: ${RESET_KO[a.how]} ${n}장 뽑아 주세요.` });
          say(`${me}: ${src ? `「${src}」 — ` : ''}${on} 님에게 손패 정리를 요청했어요 (${RESET_KO[a.how]} ${n}장 뽑기, ${on} 님이 눌러서 처리).`);
          continue;
        }
        const { how, d } = resetHand(s, p, a.how, n);
        ev.push({ pub: mine ? `${me}: ${how} ${d.length}장을 뽑았어요.` : `${me}: ${on} 님 ${how} ${on} 님이 ${d.length}장을 뽑았어요.`, own: d.map(i => nm(s, i)).join(', '), ownBy: p });
        if (d.length < n) say(`${on}: 덱이 모자라 ${d.length}장만 뽑았어요.`);
      }
      break;
    }
    case 'stadUse': { // 스타디움 효과 쓰기 (위대한 거목 등, 차례마다 1번)
      if (!s.stadium) return fail('스타디움이 없어요.');
      if (!myTurn()) warn('내 차례가 아니에요.');
      if (P.used.stad) warn('이번 차례에 이미 스타디움 효과를 썼어요.');
      const w = finishWarns('스타디움'); if (w) return w;
      closeGroup(s, who); P.used.stad = true;
      const g = openGroup(s, who, stadNm(s), idx, a.note); gid = g.gid;
      say(`${me}: 스타디움 「${stadNm(s)}」의 효과를 썼어요.${a.note ? ' — ' + a.note : ''}`);
      break;
    }
    case 'cond': { // {sid, c, on}
      const f = findSlot(s, a.sid); if (!f || !COND_KO[a.c]) return fail('상태를 고를 수 없어요.');
      judged('특수상태');
      const cd = f.slot.cond;
      if (a.on) { if (['asleep', 'confused', 'paralyzed'].includes(a.c)) { delete cd.asleep; delete cd.confused; delete cd.paralyzed; } cd[a.c] = true; } else delete cd[a.c];
      say(`${me}: ${slotName(s, f.slot)} ${COND_KO[a.c]} ${a.on ? '걸림' : '회복'}`);
      break;
    }
    case 'coin': {
      const n = Math.max(1, Math.min(20, a.n | 0 || 1));
      const r = []; for (let i = 0; i < n; i++) r.push(coin(s));
      if (s.openGroup[who]) gid = s.openGroup[who];
      say(`${me}: 코인 ${n}번 — ${r.map(x => x ? '앞' : '뒤').join(' ')} (앞면 ${r.filter(Boolean).length}번)${a.why ? ' · ' + a.why : ''}`);
      break;
    }
    case 'concede': {
      s.phase = 'over'; s.winner = other(who); s.winReason = `${me} 님이 항복했어요`; s.prompts = [];
      say(`🏆 ${s.players[other(who)].name} 님 승리 — ${s.winReason}`);
      break;
    }
    case 'adminEnd': { // 서버가 보냄 (관리자가 판을 끝냄, 승자 없음)
      s.phase = 'over'; s.winner = null; s.winReason = `관리자 ${a.by || ''} 님이 판을 끝냈어요`; s.prompts = []; s.stop = null;
      say(`⏹ ${s.winReason}`);
      break;
    }
    case 'timeout': { // 서버가 보냄 (기한 초과)
      s.phase = 'over'; s.winner = other(a.p); s.winReason = `${s.players[a.p].name} 님이 기한 안에 두지 않았어요`; s.prompts = [];
      say(`🏆 ${s.players[other(a.p)].name} 님 승리 — ${s.winReason}`);
      break;
    }
    // ----- 확인과 이의 -----
    case 'agree': {
      const g = groupOf(s, a.gid); if (!g) return fail('판정을 찾을 수 없어요.');
      if (g.who === who) return fail('상대가 확인해요.');
      g.status = 'ok'; say(`${me}: 「${g.title}」 판정에 동의했어요.`);
      break;
    }
    case 'dispute': {
      const g = groupOf(s, a.gid); if (!g) return fail('판정을 찾을 수 없어요.');
      if (g.who === who) return fail('상대가 이의를 내요.');
      g.status = 'disputed'; g.disputes.push(String(a.text || '').slice(0, 200));
      say(`⚠ ${me}: 「${g.title}」 판정에 이의가 있어요${a.text ? ' — ' + a.text : ''}`);
      break;
    }
    case 'rewindAsk': { // {gid}: 이 판정 바로 전으로 되돌리자
      const g = groupOf(s, a.gid); if (!g) return fail('판정을 찾을 수 없어요.');
      g.rewindBy = who; say(`↺ ${me}: 「${g.title}」 바로 전으로 되돌리자고 했어요. 상대가 동의하면 되돌려요.`);
      break;
    }
    case 'rewindNo': {
      const g = groupOf(s, a.gid); if (!g || g.rewindBy == null) return fail('되돌리기 요청이 없어요.');
      g.rewindBy = null; say(`${me}: 되돌리기를 거절했어요.`);
      break;
    }
    // rewindOk 는 서버(replay)가 처리한다
    // ----- 잠깐! 멈추고 지적하기 -----
    case 'stop': { // {text, to?: 잘못된 행동 번호, what?: 그 행동 설명} 상대 차례에도 누를 수 있음
      if (s.stop) return fail('이미 잠깐 멈춘 상태예요.');
      const text = String(a.text || '').trim().slice(0, 200);
      const to = Number.isInteger(a.to) && a.to >= 0 && a.to < idx ? a.to : null;
      s.stop = { by: who, text, to, what: to == null ? '' : String(a.what || '').trim().slice(0, 140), at: idx };
      say(`⏸ ${me}: 잠깐! 판을 멈추고 지적했어요${s.stop.what ? ` (「${s.stop.what}」)` : ''}${text ? ' — ' + text : ''}`);
      break;
    }
    case 'stopEnd': { // {how: 'drop' 지적한 사람이 거둠 | 'fix' 직접 고치고 계속 | 'keep' 이대로 계속, note?}
      const st = s.stop; if (!st) return fail('멈춘 상태가 아니에요.');
      const note = String(a.note || '').trim().slice(0, 200);
      if (a.how === 'drop') {
        if (st.by !== who) return fail('지적한 사람이 거둘 수 있어요.');
        s.stop = null; say(`▶ ${me}: 지적을 거두고 계속해요.${note ? ' — ' + note : ''}`);
      } else if (a.how === 'fix' || a.how === 'keep') {
        if (st.by === who) return fail('지적받은 사람이 정해요.');
        s.stop = null;
        if (a.how === 'fix') { // 고치는 손질은 한 묶음(사람 판정)으로: '효과 끝'을 누르면 상대가 확인
          closeGroup(s, who); const g = openGroup(s, who, '지적 받아 고치기', idx, st.text); gid = g.gid;
          say(`▶ ${me}: 지적을 받아들여 직접 고치고 계속해요.${note ? ' — ' + note : ''}`);
        } else say(`▶ ${me}: 제 행동이 맞다고 보고 이대로 계속해요.${note ? ' — ' + note : ''}`);
      } else return fail('어떻게 할지 골라 주세요.');
      break;
    }
    // stopUndo(지적받은 사람이 '그 행동 전으로 되돌리기'에 동의)도 서버(replay)가 처리한다
    case 'chat': {
      const t = String(a.text || '').trim().slice(0, 300); if (!t) return fail('빈 메시지예요.');
      ev.push({ pub: t, chat: true });
      break;
    }
    default: return fail('알 수 없는 행동이에요: ' + a.type);
  }
  const wr = warns.length && !a.force && !replayQuiet ? { ok: false, warn: warns, ev: [] } : null;
  if (wr) return wr;
  return { ok: true, ev, gid };
}

const zoneKo = z => ({ deck: '덱', hand: '손패', prizes: '프라이즈', discard: '트래시', lost: '로스트존', bench: '벤치', active: '배틀 필드', slot: '포켓몬', en: '붙은 에너지', tl: '붙은 도구', pk: '필드', stadium: '스타디움' }[z] || z);

function startPlay(s, ev) {
  for (const p of [0, 1]) { const P = s.p[p]; P.prizes = P.deck.splice(0, 6); }
  s.phase = 'play'; s.turn = 1; s.current = s.first;
  for (const p of [0, 1]) for (const sl of allSlots(s.p[p])) sl.turnIn = 0;
  ev.push({ pub: `프라이즈를 6장씩 놓고 포켓몬을 앞면으로 뒤집었어요. ${s.players[0].name}: ${allSlots(s.p[0]).map(x => slotName(s, x)).join(', ')} / ${s.players[1].name}: ${allSlots(s.p[1]).map(x => slotName(s, x)).join(', ')}` });
  beginTurn(s, ev);
}
// ----- 손패 되돌리고 뽑기 (릴리에의 결심·저지맨·레드카드 …) -----
const RESET_KO = { deck: '손패를 모두 덱에 넣고 섞은 뒤', bottom: '손패를 모두 섞어서 덱 아래로 되돌린 뒤', discard: '손패를 모두 트래시하고' };
function resetHand(s, p, how, n) {
  const Q = s.p[p], H = Q.hand.splice(0);
  for (const q of [0, 1]) { const lk = s.p[q].look; if (lk && lk.p === p && (lk.z === 'hand' || (lk.z === 'deck' && how !== 'discard'))) s.p[q].look = null; } // 보던 손패·덱은 바뀌었으니 닫음
  let t;
  if (how === 'discard') { Q.discard.push(...H); t = `손패 ${H.length}장${H.length ? `(${H.map(i => nm(s, i)).join(', ')})` : ''}을(를) 트래시하고`; }
  else if (how === 'bottom') { shuffle(s, H); Q.deck.push(...H); t = `손패 ${H.length}장을 섞어서 덱 아래로 되돌리고`; }
  else { Q.deck.push(...H); shuffle(s, Q.deck); t = `손패 ${H.length}장을 덱에 넣고 섞은 뒤`; }
  return { how: t, d: drawN(s, p, n) };
}
// 상대에게 요청한 손패 정리를 처리 (본인이 눌렀을 때, 또는 본인 차례가 시작될 때 먼저)
function applyReset(s, q, ev, lead = '') {
  const on = s.players[q.p].name, { how, d } = resetHand(s, q.p, q.how, q.n);
  ev.push({ pub: fixJosa(`${on}: ${lead}${q.src ? `「${q.src}」 ` : ''}${how} ${d.length}장을 뽑았어요.${d.length < q.n ? ` (덱이 모자라 ${d.length}장만)` : ''}`), own: d.map(i => nm(s, i)).join(', '), ownBy: q.p });
}
function beginTurn(s, ev) {
  const p = s.current, P = s.p[p];
  for (const q of s.prompts.filter(x => x.type === 'handReset' && x.p === p)) { s.prompts = s.prompts.filter(x => x !== q); applyReset(s, q, ev, '차례가 시작돼 뽑기 전에 먼저 처리 — '); } // 누르지 않은 손패 정리 요청
  P.used = { energy: false, supporter: false, stadium: false, retreat: false, attack: false };
  if (!P.deck.length) { addPrompt(s, { type: 'deckout', p, to: other(p), text: `${s.players[p].name} 님의 덱이 없어 카드를 뽑지 못해요. ${s.players[other(p)].name} 님 승리로 확정할까요?` }); ev.push({ pub: `${s.turn}번째 차례: ${s.players[p].name} — 덱이 없어요!` }); return; }
  const d = drawN(s, p, 1);
  ev.push({ pub: `── ${s.turn}번째 차례: ${s.players[p].name} (1장 뽑음) ──`, own: nm(s, d[0]), ownBy: p, turn: true });
}
function nextTurn(s, ev) {
  for (const p of [0, 1]) closeGroup(s, p);
  s.current = other(s.current); s.turn++;
  beginTurn(s, ev);
}
function checkupItems(s) {
  const items = [];
  for (const p of [0, 1]) {
    const a = s.p[p].active; if (!a) continue; const n = slotName(s, a);
    if (a.cond.poisoned) items.push({ text: `${n} 독 +10` });
    if (a.cond.burned) items.push({ text: `${n} 화상 +20, 코인 앞면이면 회복` });
    if (a.cond.asleep) items.push({ text: `${n} 잠듦: 코인 앞면이면 회복` });
    if (a.cond.paralyzed && p === s.current) items.push({ text: `${n} 마비 회복` });
  }
  return items;
}
function runCheckup(s, ev) {
  const out = [];
  for (const p of [0, 1]) {
    const a = s.p[p].active; if (!a) continue; const n = slotName(s, a);
    if (a.cond.poisoned) { a.dmg += 10; out.push(`${n} 독 10`); }
    if (a.cond.burned) { a.dmg += 20; const h = coin(s); if (h) delete a.cond.burned; out.push(`${n} 화상 20, 코인 ${h ? '앞면 → 회복' : '뒷면'}`); }
    if (a.cond.asleep) { const h = coin(s); if (h) delete a.cond.asleep; out.push(`${n} 잠듦 코인 ${h ? '앞면 → 회복' : '뒷면'}`); }
    if (a.cond.paralyzed && p === s.current) { delete a.cond.paralyzed; out.push(`${n} 마비 회복`); }
  }
  ev.push({ pub: '포켓몬 체크: ' + out.join(' · ') });
}

// ---------- 에너지·데미지 제안 ----------
export function canPay(s, slot, cost) {
  if ((s.rv || 1) >= 2) cost = cost.filter(c => c !== 'Free'); // 에너지가 필요 없는 기술 (새 판부터: 예전 판 기록은 그대로)
  const en = slot.en.map(i => info(s, i));
  const pool = []; // 각 에너지가 낼 수 있는 타입
  for (const e of en) {
    if (has(e, 'Basic') || /^Basic /.test(e.n)) pool.push([(e.n.match(/Basic (\w+) Energy/) || [])[1] || 'Colorless']);
    else pool.push(['*']); // 특수 에너지: 사람 판단 (어떤 타입이든 인정)
  }
  const need = cost.filter(c => c !== 'Colorless'), colorless = cost.length - need.length;
  const used = new Array(pool.length).fill(false);
  for (const t of need) {
    let k = pool.findIndex((p, i) => !used[i] && p.includes(t));
    if (k < 0) k = pool.findIndex((p, i) => !used[i] && p.includes('*'));
    if (k < 0) return false; used[k] = true;
  }
  return used.filter(x => !x).length >= colorless;
}
function applyWR(c, d, dmg, parts) { // 약점·저항력 (배틀 포켓몬에게 줄 때만)
  if (!d || dmg <= 0) return dmg;
  if ((d.wk || []).some(t => (c.ty || []).includes(t))) { dmg *= 2; parts.push(`약점 ×2`); }
  const r = (d.rs || []).find(([t]) => (c.ty || []).includes(t));
  if (r) { dmg = Math.max(0, dmg + (parseInt(r[1], 10) || -30)); parts.push(`저항력 ${r[1]}`); }
  return dmg;
}
// target: 고르는 기술에서 맞을 상대 포켓몬 sid (벤치면 약점·저항력 없음). 새 판(rv 2)은 카드 글로 더할 데미지도 셈
export function suggestDamage(s, who, k, target = null) {
  const P = s.p[who], O = s.p[other(who)];
  if (!P.active) return { dmg: 0, parts: [] };
  const c = top(s, P.active), at = (c.at || [])[k]; if (!at) return { dmg: 0, parts: [] };
  const R2 = (s.rv || 1) >= 2, kt = R2 ? (((c.kat || [])[k] || {}).t || '') : '', parts = [];
  let base = parseInt(String(at.d || '0'), 10) || 0;
  const td = R2 ? targetDmg(kt) : null; if (td != null && !base) base = td;
  const tf = target ? findSlot(s, target) : null, D = tf ? tf.slot : O.active, bench = !!tf && tf.where === 'bench';
  let dmg = base;
  const ex = R2 ? extraDmg(kt, { selfEn: P.active.en.length, oppEn: O.active ? O.active.en.length : 0 }) : null;
  if (ex) { dmg += ex.add; parts.push(`${ex.why} = +${ex.add}`); }
  else if (/[+×x-]$/.test(String(at.d || ''))) parts.push(`기본 ${at.d}: 추가 데미지는 효과대로 고쳐 주세요`);
  if (bench) { if (dmg > 0) parts.push('벤치: 약점·저항력 없음'); }
  else if (D) dmg = applyWR(c, top(s, D), dmg, parts);
  return { dmg, parts, base };
}

// ---------- 누가 둘 차례인가 ----------
export function waitingOn(s) {
  if (s.phase === 'over') return [];
  if (s.phase === 'setup') {
    const w = [0, 1].filter(p => !s.p[p].ready);
    if (s.first == null && !w.includes(s.coinWinner)) w.push(s.coinWinner);
    return w;
  }
  if (s.stop) return [other(s.stop.by)]; // 잠깐 멈춤: 지적받은 사람이 대답할 차례
  const q = s.prompts.map(x => x.to).filter(x => x != null);
  if (s.prompts.some(x => x.type === 'handReset')) q.push(s.current); // 상대가 손패를 정리하는 동안에도 차례인 사람은 계속 함
  return q.length ? [...new Set(q)] : [s.current];
}

// ---------- 보이는 정보만 (숨긴 정보 지키기) ----------
// who: 0 | 1 | 'spec' | 'all'(끝난 판 기보)
export function viewFor(s, who) {
  const all = who === 'all';
  const card = iid => ({ i: iid, c: s.inst[iid] });
  const slotV = sl => sl && ({ sid: sl.sid, cards: sl.cards.map(card), en: sl.en.map(card), tl: sl.tl.map(card), dmg: sl.dmg, cond: sl.cond, turnIn: sl.turnIn });
  const hideSetup = (p) => s.phase === 'setup' && !all && who !== p;
  const p = [0, 1].map(pp => {
    const P = s.p[pp], mine = all || who === pp;
    const look = (who === 0 || who === 1) ? s.p[who].look : null;
    const lookHere = z => look && look.p === pp && look.z === z;
    let deck = { n: P.deck.length };
    if (all) deck.cards = P.deck.map(card);
    else if (lookHere('deck')) deck.cards = (look.ids ? P.deck.filter(i => look.ids.includes(i)) : look.n ? P.deck.slice(0, look.n) : P.deck).map(card);
    return {
      name: s.players[pp].name, uid: s.players[pp].uid,
      deck, hand: mine || lookHere('hand') ? P.hand.map(card) : null, handN: P.hand.length,
      prizes: (all || lookHere('prizes')) ? P.prizes.map(card) : null, prizesN: P.prizes.length,
      discard: P.discard.map(card), lost: P.lost.map(card),
      active: hideSetup(pp) ? (P.active ? { hidden: true } : null) : slotV(P.active),
      bench: hideSetup(pp) ? P.bench.map(() => ({ hidden: true })) : P.bench.map(slotV),
      mull: P.mull, mullDrawn: P.mullDrawn, ready: P.ready, used: P.used, look: mine ? P.look : null, lock: P.lock || null, koTurn: P.koTurn ?? null,
    };
  });
  return {
    phase: s.phase, rv: s.rv || 1, turn: s.turn, current: s.current, first: s.first, coinWinner: s.coinWinner,
    stadium: s.stadium && { ...card(s.stadium.iid), by: s.stadium.by, ...(s.stadium.iid2 != null ? { two: card(s.stadium.iid2) } : {}) }, prompts: s.prompts, groups: s.groups,
    openGroup: s.openGroup, winner: s.winner, winReason: s.winReason, p, waiting: waitingOn(s), cfg: s.cfg, stop: s.stop || null,
  };
}

// ---------- 기록 다시 돌리기 ----------
// log 항목: { who, a, t } . a.type === 'rewindOk' 이면 a.to(행동 번호) 바로 전 상태로 되돌리고 a.salt 로 난수를 새로 섞는다.
// 반환: { s, steps: [{ ev, ok, gid, rewound }] }
const clone = o => JSON.parse(JSON.stringify(o));
export function replay(init, log, upto = log.length, keepSnaps = false) {
  const { s: s0, ev: ev0 } = newGame(init);
  let s = s0; const snaps = [clone(s)]; // snaps[k] = k번째 행동 전 상태
  const steps = [];
  const cards = s.cards; // 큰 카드 정보는 복사하지 않는다
  for (let k = 0; k < Math.min(upto, log.length); k++) {
    const L = log[k];
    if (L.a.type === 'rewindOk') {
      const target = L.a.to | 0;
      const g = s.groups.find(x => x.start === target);
      if (!g || g.rewindBy == null || g.rewindBy === L.who || target > k) { steps.push({ ok: false, ev: [] }); snaps.push(snapOf(s)); continue; }
      const title = g.title;
      const sn = snaps[target]; sn.cards = null; s = clone(sn); sn.cards = cards; s.cards = cards;
      s.rng = hash128(String(s.rng.join(',')) + ':' + L.a.salt);
      for (let j = target; j < k; j++) if (steps[j]) steps[j].rewound = true;
      steps.push({ ok: true, ev: [{ pub: `↺ ${s.players[L.who].name}: 동의 — 「${title}」 바로 전으로 되돌렸어요. (이미 본 카드는 잊을 수 없어요)` }] });
      snaps.push(snapOf(s));
      continue;
    }
    if (L.a.type === 'stopUndo') { // 잠깐 멈춤: 지적받은 사람이 동의 → 지적한 행동 바로 전으로
      const st = s.stop, target = st ? st.to : null;
      if (!st || target == null || st.by === L.who || target > k) { steps.push({ ok: false, ev: [] }); snaps.push(snapOf(s)); continue; }
      const what = st.what;
      const sn = snaps[target]; sn.cards = null; s = clone(sn); sn.cards = cards; s.cards = cards;
      s.rng = hash128(String(s.rng.join(',')) + ':' + L.a.salt);
      for (let j = target; j < k; j++) if (steps[j]) steps[j].rewound = true;
      steps.push({ ok: true, ev: [{ pub: `↺ ${s.players[L.who].name}: 지적을 받아들여 「${what || '그 행동'}」 바로 전으로 되돌렸어요. (이미 본 카드는 잊을 수 없어요)` }] });
      snaps.push(snapOf(s));
      continue;
    }
    const r = apply(s, L.who, L.a, k, { replay: true });
    steps.push({ ok: r.ok, ev: r.ev, gid: r.gid });
    snaps.push(snapOf(s));
  }
  function snapOf(x) { const c = x.cards; x.cards = null; const o = clone(x); x.cards = c; o.cards = c; return o; }
  return { s, steps, ev0, snaps: keepSnaps ? snaps : null };
}
