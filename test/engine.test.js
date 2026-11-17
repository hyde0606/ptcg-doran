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
console.log('waiting', waitingOn(state), 'log', log.length, 'OK');
