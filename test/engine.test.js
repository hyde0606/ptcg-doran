import { readFileSync } from 'node:fs';
import { newGame, apply, viewFor, replay, waitingOn } from '../public/lib/engine.js';
import { indexCards, parseDeckList, checkDeck, expand } from '../public/lib/deck.js';
import assert from 'node:assert/strict';

const cards = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url)));
const idx = indexCards(cards);
const deckA = parseDeckList(`Pokémon: 16
4 Pikachu ex SVP 106
4 Magnemite SSP 58
4 Charmander PFL 11
4 Charmeleon PFL 12
Trainer: 12
4 Ultra Ball MEG 131
4 Boss's Orders MEG 114
4 Switch MEG 130
Energy: 32
16 Basic {L} Energy SVE 4
16 Basic Fire Energy SVE 2`, idx);
assert.equal(deckA.bad.length, 0, deckA.bad.join('|'));
const chk = checkDeck(deckA.list, idx);
assert.ok(chk.ok, chk.problems.join('|'));
const used = {}; for (const { id } of deckA.list) used[id] = idx.byId[id];
const init = { seed: 'test1', cfg: { mode: 'live' }, cards: used,
  players: [{ uid: 'u1', name: '링크', deck: expand(deckA.list) }, { uid: 'u2', name: '친구', deck: expand(deckA.list) }] };

const log = [];
const { s } = newGame(init);
let state = s;
function act(who, a, expectOk = true) {
  const r = apply(state, who, a, log.length);
  if (r.ok) log.push({ who, a });
  if (expectOk) assert.ok(r.ok, JSON.stringify(r));
  return r;
}
// 준비
act(state.coinWinner, { type: 'order', first: true });
for (const p of [0, 1]) {
  const basics = state.p[p].hand.filter(i => (state.cards[state.inst[i]].sub || []).includes('Basic') && state.cards[state.inst[i]].st === 'P');
  act(p, { type: 'setupPlace', iid: basics[0], to: 'active' });
  if (basics[1]) act(p, { type: 'setupPlace', iid: basics[1], to: 'bench' });
  // 상대 화면에서는 뒷면
  assert.equal(viewFor(state, 1 - p).p[p].active.hidden, true);
  const r = act(p, { type: 'setupDone' }, false);
  if (r.warn) act(p, { type: 'mullDraw', n: state.p[1 - p].mull }), act(p, { type: 'setupDone' });
}
assert.equal(state.phase, 'play');
assert.equal(state.p[0].prizes.length, 6);
const f = state.first;
assert.equal(state.p[f].hand.length >= 8 - 2, true);
// 숨긴 정보: 상대 손패/덱 순서 안 보임
const v = viewFor(state, 1 - f);
assert.equal(v.p[f].hand, null); assert.equal(v.p[f].deck.cards, undefined); assert.equal(v.p[f].prizes, null);
const sv = viewFor(state, 'spec'); assert.equal(sv.p[0].hand, null); assert.equal(sv.p[1].hand, null);
// 에너지 1회 경고
const en = state.p[f].hand.filter(i => state.cards[state.inst[i]].st === 'E');
const sid = state.p[f].active.sid;
if (en.length >= 2) {
  act(f, { type: 'attach', iid: en[0], sid });
  const w = act(f, { type: 'attach', iid: en[1], sid }, false);
  assert.ok(w.warn && /이미 에너지/.test(w.warn[0]));
  const r = act(f, { type: 'attach', iid: en[1], sid, force: true, note: '효과로 붙임' });
  assert.ok(r.gid, '사람 판정 묶음');
}
// 선공 첫 차례 기술 경고
const wa = act(f, { type: 'attack', k: 0 }, false); assert.ok(wa.warn.some(x => /선공 첫 차례/.test(x)));
act(f, { type: 'endTurn' });
assert.equal(state.current, 1 - f); assert.equal(state.turn, 2);
// 후공: 데미지 계산 → 기절 → 프라이즈 → 승격
const o = 1 - f;
state.p[f].active.dmg = 990; // 강제로 거의 기절 (시험용)
const ens = state.p[o].hand.filter(i => state.cards[state.inst[i]].st === 'E');
act(o, { type: 'attach', iid: ens[0], sid: state.p[o].active.sid });
const r2 = act(o, { type: 'attack', k: 0, force: true });
const ko = state.prompts.find(q => q.type === 'ko'); assert.ok(ko, 'KO prompt');
act(o, { type: 'confirm', pid: ko.id });
const pz = state.prompts.find(q => q.type === 'prize'); assert.ok(pz);
for (let k = 0; k < pz.n + 0; k++) { const q = state.prompts.find(x => x.type === 'prize'); if (!q) break; act(o, { type: 'confirm', pid: q.id, k: 0 }); }
const pr = state.prompts.find(q => q.type === 'promote' || q.type === 'win');
assert.ok(pr, 'promote or win');
// 동의·이의·되돌리기
const g = state.groups.find(x => x.who === f);
if (g) {
  act(o, { type: 'dispute', gid: g.gid, text: '에너지 2번째는 안 돼요' });
  act(o, { type: 'rewindAsk', gid: g.gid });
  log.push({ who: f, a: { type: 'rewindOk', to: g.start, salt: 'xyz' } });
  const R = replay(init, log);
  assert.equal(R.s.turn, 1, '되돌린 뒤 1번째 차례');
  assert.ok(R.steps.slice(g.start, -1).every(x => x.rewound));
  console.log('rewind ok; turn', R.s.turn, 'energy on active', R.s.p[f].active.en.length);
}
// 다시 돌리기가 같은 결과
const R2 = replay(init, log.slice(0, 10));
const st2 = replay(init, log.slice(0, 10));
assert.deepEqual(R2.s.p[0].deck, st2.s.p[0].deck);
// 잠깐! 멈추고 지적하기: 멈춘 동안 다른 행동 막힘 → 거두기 / 이대로 계속 / 직접 고치기 / 되돌리기
{
  const L2 = log.slice(0, 12); let S = replay(init, L2).s; const cur = S.current, op = 1 - cur;
  const ap = (who, a, ok = true) => { const r = apply(S, who, a, L2.length); if (r.ok) L2.push({ who, a }); assert.equal(!!r.ok, ok, JSON.stringify(r)); return r; };
  const k0 = L2.length; ap(cur, { type: 'draw', n: 1 }); // 잘못한 행동이라고 칠 것
  ap(op, { type: 'stop', text: '드로우를 두 번 했어요', to: k0, what: '덱에서 1장을 뽑았어요' });
  assert.ok(S.stop && S.stop.by === op); assert.deepEqual(waitingOn(S), [cur]);
  assert.ok(/멈춘 상태/.test(ap(cur, { type: 'draw', n: 1 }, false).err), '멈춘 동안 막힘');
  ap(cur, { type: 'chat', text: '아 맞네요' });
  ap(cur, { type: 'stopEnd', how: 'drop' }, false); // 거두기는 지적한 사람만
  ap(op, { type: 'stopEnd', how: 'drop' }); assert.equal(S.stop, null);
  ap(op, { type: 'stop', text: '다시' }); ap(cur, { type: 'stopEnd', how: 'keep', note: '효과예요' }); assert.equal(S.stop, null);
  ap(op, { type: 'stop', text: '고쳐 주세요' }); const r = ap(cur, { type: 'stopEnd', how: 'fix' }); assert.ok(r.gid && S.openGroup[cur]);
  ap(cur, { type: 'effectEnd' });
  const hand0 = replay(init, L2.slice(0, k0)).s.p[cur].hand.length;
  ap(op, { type: 'stop', text: '드로우 취소', to: k0, what: '덱에서 1장을 뽑았어요' });
  L2.push({ who: op, a: { type: 'stopUndo', salt: 'a1' } }); // 지적한 사람이 되돌리기는 안 됨
  let R = replay(init, L2); assert.equal(R.steps.at(-1).ok, false); assert.ok(R.s.stop);
  L2.pop(); L2.push({ who: cur, a: { type: 'stopUndo', salt: 'a1' } });
  R = replay(init, L2); assert.equal(R.steps.at(-1).ok, true); assert.equal(R.s.stop, null);
  assert.equal(R.s.p[cur].hand.length, hand0, '드로우 전 손패로'); assert.ok(R.steps.slice(k0, -1).every(x => x.rewound));
  assert.ok(viewFor(R.s, 0).stop === null);
  console.log('stop ok');
}
// 덱 보기·여러 장 옮기기·보여주기·섞기 (11/18 카드 효과 도우미)
{
  const L3 = log.slice(0, 12); const S = replay(init, L3).s; const me = S.current;
  const ap = (a, ok = true) => { const r = apply(S, me, a, L3.length); if (r.ok) L3.push({ who: me, a }); assert.equal(!!r.ok, ok, JSON.stringify(r)); return r; };
  // 위에서 4장 보기: 한 장을 손패로 옮겨도 5번째 카드가 새로 보이지 않음
  ap({ type: 'look', p: me, z: 'deck', n: 4 });
  const top4 = S.p[me].deck.slice(0, 4), fifth = S.p[me].deck[4];
  assert.deepEqual(viewFor(S, me).p[me].deck.cards.map(x => x.i), top4);
  ap({ type: 'move', iids: [top4[0]], to: { z: 'hand', p: me } });
  const seen = viewFor(S, me).p[me].deck.cards.map(x => x.i);
  assert.deepEqual(seen, top4.slice(1), '본 카드 3장만'); assert.ok(!seen.includes(fifth));
  // 남은 3장을 섞어서 덱 아래로 → 보기 끝, 덱 맨 아래 3장이 그 카드들
  const r = ap({ type: 'move', iids: top4.slice(1), to: { z: 'deck', p: me, pos: 'bottom' }, mix: true });
  assert.equal(S.p[me].look, null, '다 옮기면 보기 끝');
  assert.deepEqual([...S.p[me].deck.slice(-3)].sort(), [...top4.slice(1)].sort());
  assert.ok(/섞어서 덱 아래/.test(r.ev[0].pub), r.ev[0].pub);
  // 덱 전체 보기 → 두 장을 보여주고 손패로 + 덱 섞기: 이름이 모두에게, 보여준 카드 번호가 기록에, 보기 끝
  ap({ type: 'look', p: me, z: 'deck' });
  const two = S.p[me].deck.slice(5, 7);
  const r2 = ap({ type: 'move', iids: two, to: { z: 'hand', p: me }, show: true, shuffle: true });
  assert.ok(r2.ev[0].show && r2.ev[0].show.length === 2, '보여준 카드');
  assert.ok(!r2.ev[0].own && /보여주고 손패/.test(r2.ev[0].pub), r2.ev[0].pub);
  assert.ok(r2.ev.some(e => /자기 덱을 섞었어요/.test(e.pub))); assert.equal(S.p[me].look, null);
  assert.ok(two.every(i => S.p[me].hand.includes(i)));
  // 보지 않는 덱 카드는 고를 수 없음
  ap({ type: 'move', iids: [S.p[me].deck[0]], to: { z: 'hand', p: me } }, false);
  // 벤치 자리 수: 여러 장을 한 번에 낼 때도 5장까지
  const free = 5 - S.p[me].bench.length; ap({ type: 'look', p: me, z: 'deck' });
  ap({ type: 'move', iids: S.p[me].deck.slice(0, free + 1), to: { z: 'bench', p: me } }, false);
  console.log('deck look/move ok');
}
// 특성 사용 표시: 쓰면 used.ab에 남고, '차례에 1번' 특성을 또 쓰면 경고, 차례가 바뀌면 지워짐
{
  const Sx = replay(init, log.slice(0, 12)).s, me = Sx.current;
  const sl = Sx.p[me].active; const cid = Sx.inst[sl.cards[0]];
  Sx.cards[cid] = { ...Sx.cards[cid], ab: [{ n: 'Test', t: 'Once during your turn, you may draw a card.' }], kab: [{ n: '시험', t: '자신의 차례에 1번 사용할 수 있다.' }] };
  const r1 = apply(Sx, me, { type: 'ability', sid: sl.sid, k: 0 }); assert.ok(r1.ok);
  assert.deepEqual(Sx.p[me].used.ab, [`${sl.sid}:0`]);
  const r2 = apply(Sx, me, { type: 'ability', sid: sl.sid, k: 0 }); assert.ok(r2.warn && /이미 쓴 특성/.test(r2.warn[0]), JSON.stringify(r2));
  assert.ok(apply(Sx, me, { type: 'ability', sid: sl.sid, k: 0, force: true }).ok);
  apply(Sx, me, { type: 'endTurn', force: true });
  if (Sx.current !== me) { const r3 = apply(Sx, Sx.current, { type: 'endTurn', force: true }); }
  if (Sx.current === me) assert.ok(!(Sx.p[me].used.ab || []).length, '차례가 바뀌면 지워짐');
  console.log('ability mark ok');
}
console.log('waiting', waitingOn(state), 'log', log.length, 'OK');
