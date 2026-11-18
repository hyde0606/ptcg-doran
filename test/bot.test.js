// 연습 봇 시험: 서버(Game DO)와 같은 방식으로 봇끼리, 그리고 이의·되돌리기·잠깐!을 거는 시험 상대와 판을 끝까지 둔다.
// node test/bot.test.js [판 수]   (public/cards.json 필요)
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { newGame, apply, viewFor, replay, waitingOn } from '../public/lib/engine.js';
import { withEvo } from '../public/lib/fxrules.js';
import { indexCards } from '../public/lib/deck.js';
import { Bot, BOT_DECKS, botDeckIds, BOT_HELLO } from '../public/lib/bot.js';

const idx = indexCards(JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url))));
const EVO = JSON.parse(readFileSync(new URL('../src/evo.json', import.meta.url)));
const N = +(process.argv[2] || 12);
for (const k of Object.keys(BOT_DECKS)) { const r = botDeckIds(k, idx); assert.equal(r.ids.length, 60, `${k} 덱 60장 (${r.miss.join(', ')})`); }

let saltN = 0;
// 서버 한 판 흉내: 기록(log)에 쌓고, 되돌리기는 기록을 다시 돌림
function game(seed, decks, levels, tester = null) {
  saltN = 0; // 판마다 같은 되돌리기 난수 (다시 해 볼 수 있게)
  const cards = {};
  const ids = decks.map(k => botDeckIds(k, idx).ids);
  for (const d of ids) for (const id of d) cards[id] = withEvo(idx.byId[id], EVO);
  const init = { seed, rv: 2, cfg: {}, cards, players: ids.map((d, k) => ({ uid: 'u' + k, name: ['봇', '시험'][k], deck: d, ...(k === 0 ? { bot: true } : {}) })) };
  const log = []; let G = replay(init, log);
  const stats = { rwSeen: 0, rwMiss: 0, disputes: 0, botRewindAsk: 0, rewinds: 0, stops: 0, stopUndo: 0, stopKeep: 0, oppRewindAsk: 0, botRewindOk: 0, hello: 0, bans: 0 };
  const bots = [0, 1].map(k => new Bot(k, cards, levels[k]));
  const ban = [];
  const mkBot0 = () => { const b = new Bot(0, cards, levels[0], { ban }); b.onDispute = g => { const L = log[g.start]; if (L && L.who === 0) { ban.push(replay(init, log, g.start).s.turn + '|' + JSON.stringify(L.a)); b.ban.add(ban[ban.length - 1]); stats.bans++; } }; return b; };
  bots[0] = mkBot0(); bots[0].outbox.push({ type: 'chat', text: BOT_HELLO });
  const reload = () => { G = replay(init, log); bots[0] = mkBot0(); };
  const special = (who, a) => { a.salt = 'x' + (saltN++); log.push({ who, a, t: 0 }); reload(); };
  let n = 0, idle = 0, rr = 0;
  while (G.s.phase !== 'over' && n < 6000 && log.length < 12000) {
    let acted = false;
    // 시험 상대(자리 1): 가끔 봇 판정에 이의, 내 판정 되돌리자, 잠깐!
    if (tester && !G.s.stop) {
      const s = G.s, rnd = (((log.length + 7 * stats.disputes) * 2654435761) >>> 0) % 100;
      const pend = s.groups.find(g => g.who === 0 && g.status === 'pending' && !g.rewindBy && !g.tested);
      if (pend && rnd < tester.dispute && stats.disputes < tester.maxDispute) { pend.tested = true; const r = apply(s, 1, { type: 'dispute', gid: pend.gid, text: '시험 이의' }, log.length); if (r.ok) { log.push({ who: 1, a: { type: 'dispute', gid: pend.gid, text: '시험 이의' }, t: 0 }); G.steps.push(r); stats.disputes++; acted = true; } }
      const mine = !acted && s.groups.find(g => g.who === 1 && g.status === 'pending' && g.rewindBy == null && !g.tested);
      if (mine && rnd > 100 - tester.rewind && stats.oppRewindAsk < tester.maxRewind) { mine.tested = true; const a = { type: 'rewindAsk', gid: mine.gid }; const r = apply(s, 1, a, log.length); if (r.ok) { log.push({ who: 1, a, t: 0 }); stats.oppRewindAsk++; acted = true; } }
      if (!acted && s.current === 0 && s.phase === 'play' && log.length > 10 && rnd === 7 && stats.stops < tester.stops) {
        const to = stats.stops % 2 ? null : log.length - 1, a = { type: 'stop', text: '시험 지적', ...(to != null ? { to, what: '방금 수' } : {}) };
        const r = apply(s, 1, a, log.length); if (r.ok) { log.push({ who: 1, a, t: 0 }); stats.stops++; acted = true; }
      }
    }
    // 서버처럼 상대가 한 수 둘 때마다 봇도 한 번 깨어나게 번갈아 먼저 묻는다 (동의·되돌리자를 상대 차례 중에도)
    if (!acted) for (const who of (rr++ % 2 ? [0, 1] : [1, 0])) {
      const bot = bots[who]; const v = viewFor(G.s, who); const ob = bot.outbox.length; const a = bot.decide(v); if (!a) continue;
      if (who === 0 && !ob && !G.s.stop && G.s.groups.some(g => g.rewindBy === 1)) { stats.rwSeen++; if (a.type !== 'rewindOk') stats.rwMiss++; }
      if (a.type === 'rewindOk' || a.type === 'stopUndo') {
        const ok = a.type === 'rewindOk' ? G.s.groups.some(g => g.start === a.to && g.rewindBy != null && g.rewindBy !== who) : G.s.stop && G.s.stop.to != null && G.s.stop.by !== who;
        if (!ok) { bot.reject({ err: '없음' }); acted = true; break; }
        if (who === 0) stats[a.type === 'rewindOk' ? 'botRewindOk' : 'stopUndo']++; else stats.rewinds++;
        special(who, a); acted = true; break;
      }
      const c = G.s.cards; G.s.cards = null; const snap = structuredClone(G.s); G.s.cards = c; snap.cards = c;
      const r = apply(G.s, who, a, log.length);
      if (!r.ok) { G.s = snap; bot.reject(r); acted = true; break; }
      log.push({ who, a, t: 0 }); G.steps.push(r); bot.accepted(a, r); n++;
      if (who === 0 && a.type === 'rewindAsk') stats.botRewindAsk++;
      if (who === 0 && a.type === 'stopEnd') stats.stopKeep++;
      if (who === 0 && a.type === 'chat' && a.text === BOT_HELLO) stats.hello++;
      acted = true; break;
    }
    if (!acted) { idle++; if (idle > 3) break; } else idle = 0;
  }
  if (process.env.DBG && G.s.phase !== 'over') for (const w of [0, 1]) { const v = viewFor(G.s, w); const bots0 = [bots[w]]; console.log('STUCK', JSON.stringify({ cur: v.current, open: v.openGroup, look: v.p[0].look, groups: v.groups.filter(g => g.status !== 'ok').map(g => [g.gid, g.who, g.status, g.rewindBy, g.title]), used: v.p[0].used, who: w, prompts: v.prompts, bad: [...bots0[0].bad].slice(-12), queue: bots0[0].queue.length, ban: [...bots0[0].ban].slice(-6), turn: v.turn, look: v.p[w].look, hand: (v.p[w].hand || []).length, last: log.slice(-8).map(l => [l.who, JSON.stringify(l.a).slice(0, 90)]) }, null, 1)); }
  if (process.env.DBG && G.s.phase !== 'over') writeFileSync(process.env.DBG_LOG || '/tmp/bot-stuck-log.json', JSON.stringify(log));
  // 서버처럼 기록만으로 다시 돌려도 같은 판이 되는지
  const again = replay(init, log);
  return { over: G.s.phase === 'over', winner: G.s.winner, turn: G.s.turn, waiting: waitingOn(G.s), stop: G.s.stop, prompts: G.s.prompts.map(q => q.type), n: log.length, same: again.s.phase === G.s.phase && again.s.winner === G.s.winner, stats };
}

const res = [];
const combos = [['dragapult', 'kangaskhan'], ['kangaskhan', 'dragapult'], ['dragapult', 'dragapult']];
for (let i = 0; i < N; i++) {
  if (process.env.ONLY) break;
  const d = combos[i % combos.length], lv = [i % 2 ? 'basic' : 'helper', 'helper'];
  const r = game('bt' + i, d, lv);
  res.push(r); assert.ok(r.over, `판 ${i} (${d}/${lv}) 끝나지 않음: 차례 ${r.turn}, 기다림 ${r.waiting}, 확인 ${r.prompts}, 멈춤 ${JSON.stringify(r.stop)}`);
  assert.ok(r.same, `판 ${i} 기록을 다시 돌리면 다른 판`); assert.equal(r.stats.hello, 1, '첫 인사 한 번');
}
// 이의·되돌리기·잠깐!을 거는 시험 상대
const T = { dispute: 12, rewind: 8, stops: 4, maxDispute: 30, maxRewind: 10 };
const tot = {};
for (let i = 0; i < N; i++) {
  if (process.env.ONLY && +process.env.ONLY !== i) continue;
  const d = combos[i % combos.length];
  const r = game('tt' + i, d, ['helper', 'helper'], T);
  assert.ok(r.over, `시험 상대 판 ${i} 끝나지 않음: 차례 ${r.turn}, 기다림 ${r.waiting}, 확인 ${r.prompts}, 멈춤 ${JSON.stringify(r.stop)}`);
  assert.ok(r.same, `시험 상대 판 ${i} 기록을 다시 돌리면 다른 판`);
  for (const [k, v] of Object.entries(r.stats)) tot[k] = (tot[k] || 0) + v;
}
// 이의 뒤 판이 먼저 끝났거나, 시험 상대의 다른 되돌리기로 그 판정이 사라진 경우는 대답할 일이 없음
assert.ok(tot.disputes > 0 && tot.botRewindAsk >= tot.disputes * 0.8 && tot.botRewindAsk <= tot.disputes, `이의마다 봇이 되돌리자고 함 (${tot.botRewindAsk}/${tot.disputes})`);
assert.ok(tot.stops > 0 && tot.stopUndo + tot.stopKeep === tot.stops, `잠깐!마다 봇이 대답 (${tot.stopUndo}+${tot.stopKeep}/${tot.stops})`);
// 요청이 여러 개면 가장 앞 판정으로 되돌려 뒤의 요청은 함께 사라짐: 봇이 둘 때 요청이 있으면 늘 먼저 동의하는지 봄
assert.ok(tot.oppRewindAsk > 0 && tot.rwSeen > 0 && tot.rwMiss === 0, `되돌리자는 요청에 봇이 먼저 동의 (못 함 ${tot.rwMiss}/${tot.rwSeen})`);
const turns = res.map(r => r.turn), avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`봇 판 ${res.length}판 모두 끝남 (평균 ${avg(turns)}차례, 행동 ${avg(res.map(r => r.n))}개) · 시험 상대 ${N}판: 이의 ${tot.disputes}, 봇 되돌리자 ${tot.botRewindAsk}, 되돌림 ${tot.rewinds}, 잠깐! ${tot.stops}(되돌림 ${tot.stopUndo}·계속 ${tot.stopKeep}), 되돌리자 요청 ${tot.oppRewindAsk}→봇 동의 ${tot.botRewindOk}, 막은 수 ${tot.bans}`);
console.log('bot ok');
