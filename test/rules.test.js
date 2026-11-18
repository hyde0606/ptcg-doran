// 카드 글 도우미 규칙 (규칙 판 rv 2): 뽑기·패 되돌리기, 조건 경고, 스타디움, 기술 도우미, 진화, 다시 돌리기 안전
// 실행: node test/rules.test.js   (public/cards.json, src/evo.json 필요)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { newGame, apply, viewFor, replay, suggestDamage } from '../public/lib/engine.js';
import { indexCards } from '../public/lib/deck.js';
import { withEvo, parseReset, resetCount, parseDraw, coinSpec, extraDmg, targetDmg, statusOf, lockOf, stadRules, abLost, ruinsHits, evoOk, abilityConds, trainerConds } from '../public/lib/fxrules.js';

const cards = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url)));
const EVO = JSON.parse(readFileSync(new URL('../src/evo.json', import.meta.url)));
const idx = indexCards(cards);
const C = id => { const c = idx.byId[id]; assert.ok(c, 'no card ' + id); return c; };
const ID = {
  fez: 'sv6pt5-38', meowth: 'me3-62', kang: 'me1-104', oger: 'sv6-25', budew: 'sv8pt5-4', dreepy: 'sv6-128', drak: 'sv6-129', pult: 'sv6-130', munki: 'sv6-95', duns: 'sv5-128', dudu: 'sv5-129',
  seedot: 'sv5-3', nuz: 'sv5-4', lillie: 'me1-119', boss: 'me1-114', judge: 'me3-76', candy: 'me1-125', red: 'me4-82', stamp: 'sv6-165', ultra: 'me1-131', stretcher: 'sv6pt5-61',
  pyroL: 'me6-94', pyroR: 'me6-95', tower: 'sv10-180', ruins: 'me1-127', cage: 'me2-85', forest: 'me1-117', tree: 'sv7-136',
  eG: 'sve-1', eP: 'sve-5', eD: 'sve-7',
};
const deckIds = [];
for (const k of ['fez', 'meowth', 'kang', 'oger', 'budew', 'dreepy', 'drak', 'pult', 'munki', 'duns', 'dudu', 'seedot', 'nuz']) deckIds.push(...Array(4).fill(ID[k]));
for (const k of ['lillie', 'boss', 'judge', 'candy', 'red', 'stamp', 'ultra', 'stretcher', 'pyroL', 'pyroR', 'tower', 'ruins', 'cage', 'forest', 'tree']) deckIds.push(ID[k]);
while (deckIds.length < 90) deckIds.push(deckIds.length % 3 === 0 ? ID.eG : deckIds.length % 3 === 1 ? ID.eP : ID.eD);
const used = {}; for (const id of new Set(deckIds)) used[id] = withEvo(C(id), EVO);
const mkInit = (rv, seed = 'r1') => ({ seed, ...(rv ? { rv } : {}), cfg: { mode: 'live' }, cards: used, players: [{ uid: 'u1', name: '링크', deck: [...deckIds] }, { uid: 'u2', name: '친구', deck: [...deckIds] }] });

// 판을 만들고 준비까지 (행동 기록을 남겨 다시 돌리기 시험에 씀)
function game(rv = 2, seed = 'r1') {
  const init = mkInit(rv, seed), log = [];
  const S = newGame(init).s;
  const act = (who, a, ok = true) => { const r = apply(S, who, a, log.length); if (r.ok) log.push({ who, a }); if (ok === true) assert.ok(r.ok, JSON.stringify(a) + ' → ' + JSON.stringify(r)); if (ok === false) assert.ok(!r.ok, 'should fail ' + JSON.stringify(a)); return r; };
  act(S.coinWinner, { type: 'order', first: true });
  for (const p of [0, 1]) {
    const b = S.p[p].hand.find(i => S.cards[S.inst[i]].st === 'P' && (S.cards[S.inst[i]].sub || []).includes('Basic'));
    act(p, { type: 'setupPlace', iid: b, to: 'active' });
    const r = act(p, { type: 'setupDone' }, null); if (!r.ok) { act(p, { type: 'mullDraw', n: S.p[1 - p].mull }); act(p, { type: 'setupDone' }); }
  }
  assert.equal(S.phase, 'play');
  return { S, init, log, act, f: S.first, o: 1 - S.first };
}
// 시험용으로 판을 직접 꾸밈 (기록에 안 남음)
const take = (S, p, cid) => { const P = S.p[p]; for (const z of ['hand', 'deck', 'prizes', 'discard']) { const k = P[z].findIndex(i => S.inst[i] === cid); if (k >= 0) return P[z].splice(k, 1)[0]; } throw new Error('없음 ' + cid); };
const toHand = (S, p, cid) => { const i = take(S, p, cid); S.p[p].hand.push(i); return i; };
const slot = (S, p, cid, where = 'bench', turnIn = 0) => { const sl = { sid: 's' + (S.nextId++), cards: [take(S, p, cid)], en: [], tl: [], dmg: 0, cond: {}, turnIn }; if (where === 'active') { if (S.p[p].active) S.p[p].bench.push(S.p[p].active); S.p[p].active = sl; } else S.p[p].bench.push(sl); return sl; };
const energy = (S, p, sl, cid, n = 1) => { for (let k = 0; k < n; k++) sl.en.push(take(S, p, cid)); };
const stadium = (S, p, cid, cid2) => { const i = take(S, p, cid); S.stadium = cid2 ? { iid: i, iid2: take(S, p, cid2), by: p } : { iid: i, by: p }; };
const toTurn = (g, who) => { while (g.S.current !== who || g.S.turn < 3) { g.act(g.S.current, { type: 'endTurn', force: true }); const q = g.S.prompts.find(x => x.type === 'checkup'); if (q) g.act(q.to, { type: 'confirm', pid: q.id }); } };
const W = r => (r.warn || []).join(' / ');

// ----- 글 읽기 (fxrules) -----
{
  const kr = id => C(id).kr.join(' ');
  assert.deepEqual(parseReset(kr(ID.lillie)), { who: 'me', how: 'deck', n: [6, 0], more: { side: 'me', le: false, m: 6, to: 8 } });
  assert.deepEqual(resetCount(parseReset(kr(ID.lillie)), 6, 3), [8, 0]); assert.deepEqual(resetCount(parseReset(kr(ID.lillie)), 5, 3), [6, 0]);
  assert.deepEqual(parseReset(kr(ID.judge)), { who: 'both', how: 'deck', n: [4, 4] });
  assert.deepEqual(parseReset(kr(ID.stamp)), { who: 'both', how: 'deck', n: [5, 2] });
  assert.deepEqual(parseReset(kr(ID.red)), { who: 'opp', how: 'bottom', n: [0, 3] });
  assert.deepEqual(parseReset('자신의 패를 모두 트래쉬하고 덱을 5장 뽑는다.'), { who: 'me', how: 'discard', n: [5, 0] });
  assert.equal(parseDraw(C(ID.fez).kab[0].t), 3); assert.equal(parseDraw(C(ID.kang).kab[0].t), 2); assert.equal(parseDraw(C(ID.dudu).kab[0].t), 3); assert.equal(parseDraw(C(ID.oger).kab[0].t), 1);
  assert.equal(parseDraw(kr(ID.red)), null, '상대가 뽑는 글은 아님'); assert.equal(parseDraw(kr(ID.lillie)), null);
  assert.deepEqual(coinSpec(C(ID.kang).kat[0].t), { n: 'tails', per: 50, add: true });
  assert.deepEqual(coinSpec('동전을 3번 던져서 앞면이 나온 수 × 30데미지를 준다.'), { n: 3, per: 30, add: false });
  assert.deepEqual(extraDmg(C(ID.oger).kat[0].t, { selfEn: 3, oppEn: 2 }).add, 150);
  assert.equal(targetDmg(C(ID.fez).kat[0].t), 100);
  assert.deepEqual(statusOf(C(ID.munki).kat[0].t), ['confused']); assert.equal(statusOf('동전을 1번 던져서 앞면이면 상대의 배틀 포켓몬을 마비로 만든다.'), null);
  assert.equal(lockOf(C(ID.budew).kat[0].t), 'item');
  assert.equal(stadRules(C(ID.pyroL)).abLoss, 'evolved'); assert.equal(stadRules(C(ID.tower)).abLoss, 'Colorless');
  assert.equal(stadRules(C(ID.ruins)).ruins, 2); assert.ok(stadRules(C(ID.cage)).cage); assert.equal(stadRules(C(ID.forest)).forest, 'Grass'); assert.ok(stadRules(C(ID.tree)).tree);
  assert.ok(abLost(stadRules(C(ID.tower)), C(ID.meowth))); assert.ok(!abLost(stadRules(C(ID.tower)), C(ID.fez)));
  assert.ok(abLost(stadRules(C(ID.pyroL)), C(ID.dudu))); assert.ok(!abLost(stadRules(C(ID.pyroL)), C(ID.meowth)));
  assert.ok(ruinsHits(stadRules(C(ID.ruins)), C(ID.meowth))); assert.ok(!ruinsHits(stadRules(C(ID.ruins)), C(ID.fez)), '악 제외'); assert.ok(!ruinsHits(stadRules(C(ID.ruins)), C(ID.drak)), '진화 제외');
  const pult = withEvo(C(ID.pult), EVO), drak = withEvo(C(ID.drak), EVO);
  assert.equal(drak.ef, 'Dreepy'); assert.equal(pult.ef2, 'Dreepy'); assert.equal(pult.efk2, '드라꼰');
  assert.equal(evoOk(drak, C(ID.dreepy)), true); assert.equal(evoOk(drak, C(ID.duns)), false); assert.equal(evoOk(pult, C(ID.dreepy), true), true); assert.equal(evoOk(C(ID.drak), C(ID.dreepy)), null, '자료 없으면 모름');
  assert.deepEqual(abilityConds(C(ID.fez).kab[0].t).map(x => x.k), ['ko', 'name', 'myTurn']);
  assert.deepEqual(abilityConds(C(ID.meowth).kab[0].t).map(x => x.k), ['benched', 'nameHas', 'myTurn']);
  assert.deepEqual(abilityConds(C(ID.kang).kab[0].t).map(x => x.k), ['active', 'name', 'myTurn']);
  assert.deepEqual(abilityConds(C(ID.munki).kab[0].t).map(x => x.k), ['energy', 'myTurn']);
  assert.deepEqual(trainerConds(C(ID.stamp)).map(x => x.k), ['ko']); assert.deepEqual(trainerConds(C(ID.red)), [{ k: 'oppPrizes', n: 3 }]); assert.deepEqual(trainerConds(C(ID.ultra)), [{ k: 'handCost', n: 2 }]);
  console.log('fxrules ok');
}

// ----- 규칙 판: 예전 판은 1, 새 판은 2 -----
{ assert.equal(newGame(mkInit(0)).s.rv, 1); assert.equal(newGame(mkInit(2)).s.rv, 2); assert.equal(viewFor(newGame(mkInit(2)).s, 0).rv, 2); }

// ----- 패 되돌리고 뽑기 -----
{
  const g = game(); const { S, f, o, act } = g;
  const deck0 = S.p[f].deck.length + S.p[f].hand.length;
  const r = act(f, { type: 'handReset', who: 'me', how: 'deck', n: [6, 0] });
  assert.equal(S.p[f].hand.length, 6); assert.equal(S.p[f].deck.length + S.p[f].hand.length, deck0, '카드 수 그대로');
  assert.ok(/덱에 넣고 섞은 뒤 6장을 뽑았어요/.test(r.ev[0].pub), r.ev[0].pub); assert.equal(r.ev[0].ownBy, f); assert.ok(r.gid, '사람 판정 묶음');
  // 서로 5장 / 2장 (언페어 스탬프): 상대 줄은 상대만 뽑은 카드 이름을 봄, 상대 손패 이름은 기록에 없음
  const oppHand = S.p[o].hand.map(i => S.cards[S.inst[i]].kn);
  const r2 = act(f, { type: 'handReset', who: 'both', how: 'deck', n: [5, 2] });
  assert.equal(S.p[f].hand.length, 5); assert.equal(S.p[o].hand.length, 2);
  assert.equal(r2.ev.length, 2); assert.equal(r2.ev[1].ownBy, o); assert.ok(/친구 님이 2장을 뽑았어요|링크 님이 2장을 뽑았어요/.test(r2.ev[1].pub), r2.ev[1].pub);
  assert.ok(!oppHand.some(n => r2.ev[1].pub.includes(n)), '상대 손패 이름이 공개되면 안 됨');
  // 스페셜 레드카드: 상대 손패를 섞어 덱 아래로, 상대 3장
  const h = [...S.p[o].hand], top3 = S.p[o].deck.slice(0, 3);
  act(f, { type: 'handReset', who: 'opp', how: 'bottom', n: [0, 3] });
  assert.deepEqual([...S.p[o].deck.slice(-h.length)].sort(), [...h].sort(), '덱 아래에'); assert.deepEqual(S.p[o].hand, top3);
  { const R = replay(g.init, g.log).s; assert.deepEqual(R.p[o].hand, S.p[o].hand); assert.deepEqual(R.p[f].deck, S.p[f].deck); assert.deepEqual(R.p[o].deck, S.p[o].deck); } // 기록 다시 돌리기가 같은 결과
  // 덱이 모자라면 있는 만큼
  S.p[f].deck.splice(2); const r4 = act(f, { type: 'handReset', who: 'me', how: 'discard', n: [5, 0] });
  assert.ok(r4.ev.some(e => /덱이 모자라/.test(e.pub))); assert.ok(/트래시하고/.test(r4.ev[0].pub));
  act(f, { type: 'handReset', who: 'x', how: 'deck', n: [1, 0] }, false);
  console.log('handReset ok');
}

// ----- 기절 기록: 역이용·언페어 스탬프는 상대의 지난 차례에 기절했을 때만 -----
{
  const g = game(); const { S, f, o, act } = g;
  toTurn(g, o); // 상대 차례
  S.p[f].active.dmg = 9999; const q = (act(o, { type: 'damage', sid: S.p[f].active.sid, n: 10 }), S.prompts.find(x => x.type === 'ko'));
  act(o, { type: 'confirm', pid: q.id });
  assert.equal(S.p[f].koTurn, S.turn);
  for (const p of S.prompts.filter(x => x.type === 'prize')) for (let k = 0; k < p.n; k++) { const pp = S.prompts.find(x => x.type === 'prize'); if (pp) act(pp.p, { type: 'confirm', pid: pp.id, k: 0 }); }
  let pr = S.prompts.find(x => x.type === 'promote'); if (pr) { if (!S.p[f].bench.length) slot(S, f, ID.duns); act(f, { type: 'confirm', pid: pr.id, sid: S.p[f].bench[0].sid }); }
  const fz = slot(S, f, ID.fez); const st = toHand(S, f, ID.stamp);
  act(o, { type: 'endTurn', force: true }); const cq = S.prompts.find(x => x.type === 'checkup'); if (cq) act(cq.to, { type: 'confirm', pid: cq.id });
  assert.equal(S.current, f);
  let r = act(f, { type: 'ability', sid: fz.sid, k: 0 }, null); assert.ok(r.ok, '지난 차례에 기절했으니 경고 없음 ' + W(r));
  r = act(f, { type: 'play', iid: st }, null); assert.ok(r.ok, '언페어 스탬프 경고 없음 ' + W(r));
  // 두 번째 기로치 ex: 다른 「역이용」을 이미 썼으니 경고
  const fz2 = slot(S, f, ID.fez); r = act(f, { type: 'ability', sid: fz2.sid, k: 0 }, null); assert.ok(/이미 「역이용」/.test(W(r)), W(r));
  // 다음 내 차례: 경고
  toTurn(g, o); toTurn(g, f);
  r = act(f, { type: 'ability', sid: fz.sid, k: 0 }, null); assert.ok(/기절하지 않았어요/.test(W(r)), W(r));
  const st2 = toHand(S, f, ID.ultra); S.p[f].hand.splice(0, S.p[f].hand.length - 1); // 하이퍼볼: 손패가 모자라면 경고
  r = act(f, { type: 'play', iid: st2 }, null); assert.ok(/손패를 2장 트래시/.test(W(r)), W(r));
  console.log('ko turn ok');
}
// 기절 확인을 차례가 넘어간 뒤에 눌러도 기절한 차례로 / 포켓몬 체크(독)로 기절하면 차례 사이
{
  const g = game(); const { S, f, o, act } = g;
  toTurn(g, o); const koAt = S.turn;
  slot(S, f, ID.duns);
  S.p[f].active.dmg = 9999; act(o, { type: 'damage', sid: S.p[f].active.sid, n: 10 });
  act(o, { type: 'endTurn', force: true }); const cq = S.prompts.find(x => x.type === 'checkup'); if (cq) act(cq.to, { type: 'confirm', pid: cq.id });
  assert.equal(S.current, f);
  const q = S.prompts.find(x => x.type === 'ko'); assert.ok(q, 'ko prompt left'); act(f, { type: 'confirm', pid: q.id });
  assert.equal(S.p[f].koTurn, koAt, '늦게 눌러도 기절한 차례');
  // 독으로 기절: 차례 사이
  const g2 = game(2, 'r2'); const S2 = g2.S;
  toTurn(g2, g2.o); slot(S2, g2.f, ID.duns);
  const A = S2.p[g2.f].active; A.cond.poisoned = true; A.dmg = (S2.cards[S2.inst[A.cards[A.cards.length - 1]]].hp || 60) - 10;
  g2.act(g2.o, { type: 'endTurn' }, null);
  const c2 = S2.prompts.find(x => x.type === 'checkup'); assert.ok(c2, 'checkup'); g2.act(c2.to, { type: 'confirm', pid: c2.id });
  const k2 = S2.prompts.find(x => x.type === 'ko'); assert.ok(k2, 'poison ko'); g2.act(k2.to, { type: 'confirm', pid: k2.id });
  assert.equal(S2.p[g2.f].koTurn % 1, 0.5, '포켓몬 체크 기절은 차례 사이');
  console.log('ko late/checkup ok');
}

// ----- 특성 조건: 배틀필드, 손패에서 벤치로 낸 차례, (악) 에너지, 이름 -----
{
  const g = game(); const { S, f, act } = g; toTurn(g, f);
  const kang = slot(S, f, ID.kang); let r = act(f, { type: 'ability', sid: kang.sid, k: 0 }, null); assert.ok(/배틀필드에 있을 때만/.test(W(r)), W(r));
  const mi = toHand(S, f, ID.meowth); act(f, { type: 'bench', iid: mi });
  const ms = S.p[f].bench.find(b => b.cards[0] === mi); assert.equal(ms.benchAt, S.turn);
  r = act(f, { type: 'ability', sid: ms.sid, k: 0 }, null); assert.ok(r.ok, '이번 차례에 낸 나옹 ex ' + W(r));
  r = act(f, { type: 'ability', sid: ms.sid, k: 0 }, null); assert.ok(/이미 쓴 특성/.test(W(r)) && !/이름에/.test(W(r)), '같은 경고 두 번 안 씀: ' + W(r));
  const m2 = slot(S, f, ID.meowth); r = act(f, { type: 'ability', sid: m2.sid, k: 0 }, null); assert.ok(/손패에서 벤치로 낸/.test(W(r)) && /이름에 「비장의 수단」/.test(W(r)), W(r));
  const mk = slot(S, f, ID.munki); r = act(f, { type: 'ability', sid: mk.sid, k: 0 }, null); assert.ok(/\(악\) 에너지가 붙어 있지 않아요/.test(W(r)), W(r));
  energy(S, f, mk, ID.eD); r = act(f, { type: 'ability', sid: mk.sid, k: 0 }, null); assert.ok(r.ok, W(r));
  // 상대 차례에 쓰면 경고
  const o = 1 - f; const ofz = slot(S, o, ID.oger); r = act(o, { type: 'ability', sid: ofz.sid, k: 0 }, null); assert.ok(/내 차례에 쓰는/.test(W(r)), W(r));
  console.log('ability conds ok');
}

// ----- 스타디움: 특성 없어짐, 배틀 콜로세움, 활력의 숲 -----
{
  const g = game(); const { S, f, o, act } = g; toTurn(g, f);
  const me = slot(S, f, ID.meowth); me.benchAt = S.turn; const dd = slot(S, f, ID.dudu); const fz = slot(S, f, ID.fez);
  stadium(S, o, ID.tower);
  let r = act(f, { type: 'ability', sid: me.sid, k: 0 }, null); assert.ok(/로켓단의 감시탑」 때문에/.test(W(r)), W(r));
  stadium(S, o, ID.pyroL, ID.pyroR);
  r = act(f, { type: 'ability', sid: dd.sid, k: 0 }, null); assert.ok(/전설의 용암동굴」 때문에/.test(W(r)), W(r));
  r = act(f, { type: 'ability', sid: me.sid, k: 0, force: true }); // 기본 포켓몬은 용암동굴과 상관없음 (경고는 다른 것)
  // 배틀 콜로세움: 상대 벤치에 카운터 → 경고, 배틀 포켓몬은 괜찮음, 데미지(기술)는 괜찮음
  stadium(S, o, ID.cage); const ob = slot(S, o, ID.duns);
  r = act(f, { type: 'spread', to: [{ sid: ob.sid, n: 3 }, { sid: S.p[o].active.sid, n: 3 }], why: '스펙터다이브' }, null); assert.ok(/배틀 콜로세움/.test(W(r)), W(r));
  r = act(f, { type: 'spread', to: [{ sid: S.p[o].active.sid, n: 2 }], why: '시험' }); assert.equal(S.p[o].active.dmg, 20);
  r = act(f, { type: 'damage', sid: ob.sid, n: 30, kind: 'counter' }, null); assert.ok(/배틀 콜로세움/.test(W(r)));
  r = act(f, { type: 'damage', sid: ob.sid, n: 30 }); // 손으로 고친 데미지는 경고 없음
  S.p[f].active.dmg = 30; r = act(f, { type: 'dmgMove', from: S.p[f].active.sid, to: ob.sid, n: 3 }, null); assert.ok(/배틀 콜로세움/.test(W(r)));
  r = act(f, { type: 'dmgMove', from: S.p[f].active.sid, to: S.p[o].active.sid, n: 5, why: '아드레나 브레인' }); assert.equal(S.p[f].active.dmg, 0); assert.equal(S.p[o].active.dmg, 50, '있는 만큼만 (3개)');
  act(f, { type: 'dmgMove', from: S.p[f].active.sid, to: S.p[o].active.sid, n: 1 }, false);
  // 활력의 숲: 이번 차례에 낸 (풀) 포켓몬도 (풀)로 진화, 한 차례에 두 번은 안 됨
  stadium(S, o, ID.forest); const sd = slot(S, f, ID.seedot, 'bench', S.turn); const nz = toHand(S, f, ID.nuz);
  r = act(f, { type: 'evolve', iid: nz, sid: sd.sid }, null); assert.ok(r.ok, '활력의 숲 ' + W(r));
  const dr = slot(S, f, ID.dreepy, 'bench', S.turn); const dk = toHand(S, f, ID.drak);
  r = act(f, { type: 'evolve', iid: dk, sid: dr.sid }, null); assert.ok(/이번 차례에 나왔거나/.test(W(r)), '드래곤은 안 됨 ' + W(r));
  console.log('stadium ok');
}

// ----- 진화: 진화 전 이름, 이상한사탕, 덱에서 진화(위대한 거목) -----
{
  const g = game(); const { S, f, act } = g; toTurn(g, f);
  const du = slot(S, f, ID.duns); const dk = toHand(S, f, ID.drak);
  let r = act(f, { type: 'evolve', iid: dk, sid: du.sid }, null); assert.ok(/드라꼰에서 진화하는 카드/.test(W(r)), W(r));
  const dr = slot(S, f, ID.dreepy); r = act(f, { type: 'evolve', iid: dk, sid: dr.sid }); assert.equal(dr.evoAt, S.turn);
  // 이상한사탕: 2진화를 기본 포켓몬에
  const dr2 = slot(S, f, ID.dreepy); const pu = toHand(S, f, ID.pult);
  r = act(f, { type: 'evolve', iid: pu, sid: du.sid, candy: true }, null); assert.ok(/드라꼰에서 진화하는 카드/.test(W(r)), W(r));
  r = act(f, { type: 'evolve', iid: pu, sid: dr2.sid, candy: true }); assert.ok(/이상한사탕/.test(r.ev[0].pub)); assert.ok(r.gid);
  const dr3 = slot(S, f, ID.dreepy, 'bench', S.turn); const pu2 = toHand(S, f, ID.pult);
  r = act(f, { type: 'evolve', iid: pu2, sid: dr3.sid, candy: true }, null); assert.ok(/이번 차례에 나왔거나/.test(W(r)), W(r));
  console.log('evolve ok');
}
{
  const g = game(); const { S, f, act } = g; toTurn(g, f);
  const dr = slot(S, f, ID.dreepy); stadium(S, f, ID.tree);
  act(f, { type: 'stadUse' }); assert.ok(S.openGroup[f]);
  let r = act(f, { type: 'stadUse' }, null); assert.ok(/이미 스타디움 효과/.test(W(r)));
  // 보지 않은 덱 카드로는 진화할 수 없음
  const dkId = S.p[f].deck.find(i => S.inst[i] === ID.drak); act(f, { type: 'evolve', iid: dkId, sid: dr.sid, from: 'deck' }, false);
  act(f, { type: 'look', p: f, z: 'deck' });
  act(f, { type: 'evolve', iid: dkId, sid: dr.sid, from: 'deck' }); assert.ok(!S.p[f].deck.includes(dkId)); assert.equal(dr.evoBy, S.openGroup[f]);
  const puId = S.p[f].deck.find(i => S.inst[i] === ID.pult);
  r = act(f, { type: 'evolve', iid: puId, sid: dr.sid, from: 'deck', chain: true }, null); assert.ok(r.ok, '이어서 2진화 ' + W(r));
  assert.equal(S.cards[S.inst[dr.cards.at(-1)]].n, 'Dragapult ex');
  console.log('grand tree ok');
}

// ----- 기술: 고르는 기술(크루얼애로), 에너지 세기(만엽소낙비), 동전(기관총콤보), 혼란, 아이템 금지 -----
{
  const g = game(); const { S, f, o, act } = g; toTurn(g, f);
  const fz = slot(S, f, ID.fez, 'active'); energy(S, f, fz, ID.eD, 3);
  const ob = slot(S, o, ID.pult); const od = slot(S, o, ID.duns);
  let r = act(f, { type: 'attack', k: 0, target: od.sid }); assert.equal(od.dmg, 100, '벤치 100 (약점·저항력 없음)'); assert.ok(/상대 벤치/.test(r.ev.at(-1).pub));
  toTurn(g, o); toTurn(g, f);
  r = act(f, { type: 'attack', k: 0, target: ob.sid }, null); assert.ok(/벤치에 있는 한 기술 데미지를 받지 않아요/.test(W(r)), W(r));
  const sg = suggestDamage(S, f, 0, S.p[o].active.sid); r = act(f, { type: 'attack', k: 0, target: S.p[o].active.sid, force: true });
  act(f, { type: 'attack', k: 0, target: S.p[f].active.sid, force: true }, false); // 내 포켓몬은 고를 수 없음
  assert.ok(sg.dmg >= 100 || sg.parts.length, JSON.stringify(sg));
  toTurn(g, o); toTurn(g, f);
  const og = slot(S, f, ID.oger, 'active'); energy(S, f, og, ID.eG, 3); S.p[o].active.en.push(take(S, o, ID.eP));
  const s2 = suggestDamage(S, f, 0); assert.ok(s2.parts.some(x => /서로의 배틀 포켓몬 에너지 4개 × 30/.test(x)), JSON.stringify(s2));
  r = act(f, { type: 'attack', k: 0, dmg: s2.dmg }, null); assert.ok(r.ok, '계산이 같으면 고친 것이 아님 ' + W(r));
  toTurn(g, o); toTurn(g, f);
  const kg = slot(S, f, ID.kang, 'active'); energy(S, f, kg, ID.eG, 3); const D = S.p[o].active, before = D.dmg;
  r = act(f, { type: 'attack', k: 0, coins: true }); const coinLine = r.ev.find(e => /코인 \d+번/.test(e.pub)).pub;
  const heads = +coinLine.match(/앞면 (\d+)번/)[1]; assert.ok(/뒤 \(앞면/.test(coinLine), '뒷면에서 멈춤 ' + coinLine);
  const exp = suggestDamage(S, f, 0); // 이미 맞은 뒤라도 약점은 같음
  assert.equal(D.dmg - before, (200 + 50 * heads) * (exp.parts.includes('약점 ×2') ? 2 : 1), coinLine + ' / ' + r.ev.at(-1).pub);
  toTurn(g, o); toTurn(g, f);
  const mk = slot(S, f, ID.munki, 'active'); energy(S, f, mk, ID.eP, 2); delete S.p[o].active.cond.confused;
  r = act(f, { type: 'attack', k: 0 }); assert.ok(S.p[o].active.cond.confused, '사이코트립 혼란'); assert.ok(/혼란/.test(r.ev.at(-1).pub));
  toTurn(g, o); toTurn(g, f);
  const bd = slot(S, f, ID.budew, 'active'); r = act(f, { type: 'attack', k: 0 });
  assert.equal(S.p[o].lock.item, S.turn + 1); assert.ok(/아이템을\(를\) 쓸 수 없어요|아이템을 쓸 수 없어요/.test(r.ev.at(-1).pub), r.ev.at(-1).pub);
  act(f, { type: 'endTurn', force: true }); const cq = S.prompts.find(x => x.type === 'checkup'); if (cq) act(cq.to, { type: 'confirm', pid: cq.id });
  assert.equal(S.current, o); assert.ok(viewFor(S, f).p[o].lock, '모두에게 보임');
  const ub = toHand(S, o, ID.ultra); r = act(o, { type: 'play', iid: ub }, null); assert.ok(/근질근질 꽃가루」 때문에/.test(W(r)), W(r));
  const bs = toHand(S, o, ID.boss); r = act(o, { type: 'play', iid: bs }, null); assert.ok(!/근질근질/.test(W(r)), '서포트는 괜찮음');
  toTurn(g, f); toTurn(g, o); const ub2 = toHand(S, o, ID.ultra); r = act(o, { type: 'play', iid: ub2 }, null); assert.ok(!/근질근질/.test(W(r)), '그다음 차례는 괜찮음');
  console.log('attack helpers ok');
}

// ----- 예전 판(rv 1)은 새 규칙이 하나도 안 걸림 -----
{
  const g = game(0); const { S, f, o, act } = g; toTurn(g, f);
  const bd = slot(S, f, ID.budew, 'active'); assert.ok(/에너지가 모자라요/.test(W(act(f, { type: 'attack', k: 0 }, null))), '예전 판은 Free 비용도 예전처럼'); act(f, { type: 'attack', k: 0, force: true }); assert.equal(S.p[o].lock, undefined);
  toTurn(g, o); toTurn(g, f);
  const st = toHand(S, f, ID.stamp); let r = act(f, { type: 'play', iid: st }, null); assert.ok(r.ok, '예전 판은 기절 조건 경고 없음 ' + W(r));
  const kang = slot(S, f, ID.kang); r = act(f, { type: 'ability', sid: kang.sid, k: 0 }, null); assert.ok(r.ok, W(r));
  const fz = slot(S, f, ID.fez, 'active'); energy(S, f, fz, ID.eD, 3); const od = slot(S, o, ID.duns);
  act(f, { type: 'attack', k: 0, target: od.sid, force: true }); assert.equal(od.dmg, 0, '예전 판은 고르는 기술을 몰라 배틀 포켓몬에게');
  console.log('rv1 unchanged ok');
}

// ----- 다시 돌리기: 그때 받아들여진 행동은 새 경고로 멈추지 않음 -----
{
  const g = game(); const { S, f, act } = g; toTurn(g, f);
  const kang = slot(S, f, ID.kang);
  const a = { type: 'ability', sid: kang.sid, k: 0 };
  assert.ok(!apply(S, f, a, 0).ok, '지금은 경고');
  const S2 = JSON.parse(JSON.stringify(S)); S2.cards = S.cards;
  const r = apply(S2, f, a, 0, { replay: true }); assert.ok(r.ok && !r.ev.some(e => /경고를 넘기고/.test(e.pub)), '다시 돌릴 때는 그대로 (경고 넘김 줄도 없음)');
  const S3 = JSON.parse(JSON.stringify(S)); S3.cards = S.cards; const n0 = S3.groups.length;
  const r3 = apply(S3, f, { ...a, force: true }, 0, { replay: true }); assert.ok(r3.ok && r3.ev.some(e => /경고를 넘기고/.test(e.pub)), '경고를 넘긴 행동은 예전처럼');
  console.log('replay quiet ok');
}
console.log('rules OK');
