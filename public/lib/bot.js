// 연습 봇: 엔진의 viewFor(봇 자리) 정보만 보고 한 번에 행동 하나를 고른다 (숨긴 정보는 모름).
// level 'basic'  = 쉬움: 기본 규칙만 (벤치·진화·에너지·후퇴·기술·확인)
// level 'helper' = 보통: + 사이트 카드 글 도우미(fxhelp/fxrules)로 읽히는 트레이너스·특성·동전/고르는 기술
// 판정 흐름: 사람이 처리한 효과에는 늘 동의, 되돌리기 요청에는 늘 동의, 내 판정에 이의가 오면 되돌리자고 함.
// 잠깐!: 지적한 행동이 있으면 그 전으로 되돌리기에 동의, 없으면 이대로 계속 (봇은 직접 고치지 못함).
import { canPay, suggestDamage } from './engine.js';
import { evoOk, parseReset, resetCount, parseDraw, coinSpec, targetDmg, basicEnergyType } from './fxrules.js';
import { parseSearch, parseTop, parseCost } from './fxhelp.js';

const has = (c, s) => (c.sub || []).includes(s);
const isBasicP = c => c.st === 'P' && has(c, 'Basic');
export const BOT_NAME = '연습 봇';
export const BOT_HELLO = '안녕하세요, 연습 봇이에요. 제가 카드 효과를 잘못 쓰면 판정에서 이의를 걸어 주세요. 이의를 받으면 되돌리자고 할게요.';
const STOP_NOTE = '봇은 직접 고치지 못해요. 고칠 행동을 골라 다시 잠깐!을 누르거나, 판정에서 되돌리자를 눌러 주세요.';

export class Bot {
  constructor(me, cards, level = 'helper', opt = {}) {
    this.me = me; this.cards = cards; this.level = level === 'basic' ? 'basic' : 'helper';
    this.queue = []; this.bad = new Set(); this.turnKey = null; this.agreed = new Set(); this.asked = new Set(); this.outbox = [];
    this.ban = new Set(opt.ban || []); // `${차례}|${행동}`: 이의를 받아 되돌린 행동은 그 차례에 다시 하지 않음
    this.onDispute = opt.onDispute || null;
    this.st = { decisions: 0, trainersPlayed: 0, abilities: 0, groups: 0, fails: 0, warns: 0, unsupported: {} };
  }
  C(x) { return this.cards[x.c] || this.cards[x] || {}; }
  // 엔진 계산 함수(canPay, suggestDamage)는 공개 정보만 쓰지만 s 모양을 원해서 보기(view)로 흉내 낸 판을 만든다
  fake(v) {
    const inst = {}; const conv = sl => sl && !sl.hidden ? { sid: sl.sid, cards: sl.cards.map(x => (inst[x.i] = x.c, x.i)), en: sl.en.map(x => (inst[x.i] = x.c, x.i)), tl: sl.tl.map(x => (inst[x.i] = x.c, x.i)), dmg: sl.dmg, cond: sl.cond || {}, turnIn: sl.turnIn } : null;
    return { rv: v.rv, cards: this.cards, inst, p: v.p.map(P => ({ active: conv(P.active), bench: (P.bench || []).map(conv).filter(Boolean) })) };
  }
  slots(v, p) { const P = v.p[p]; return [P.active, ...P.bench].filter(x => x && !x.hidden); }
  top(sl) { return this.C(sl.cards[sl.cards.length - 1]); }
  hpLeft(sl) { return (this.top(sl).hp || 0) - sl.dmg; }
  // 에너지가 몇 개 모자란지 (기본 에너지 타입 맞추기, 특수 에너지는 아무 타입)
  missing(enCards, cost) {
    cost = (cost || []).filter(c => c !== 'Free');
    const pool = enCards.map(e => basicEnergyType(e) || (e.st === 'E' ? '*' : null)).filter(Boolean), used = pool.map(() => false);
    let miss = 0;
    for (const t of cost.filter(c => c !== 'Colorless')) { let k = pool.findIndex((p, i) => !used[i] && p === t); if (k < 0) k = pool.findIndex((p, i) => !used[i] && p === '*'); if (k < 0) miss++; else used[k] = true; }
    const left = used.filter(x => !x).length, col = cost.filter(c => c === 'Colorless').length;
    return miss + Math.max(0, col - left);
  }
  bestAttack(v, fs, sl) { // 이 포켓몬이 지금 낼 수 있는 가장 센 기술
    const c = this.top(sl); let best = null;
    const mine = fs.p[this.me], isAct = mine.active && mine.active.sid === sl.sid, fsl = isAct ? mine.active : mine.bench.find(b => b.sid === sl.sid);
    if (!fsl) return null;
    (c.at || []).forEach((at, k) => {
      if (!canPay(fs, fsl, at.c || [])) return;
      let dmg = parseInt(at.d, 10) || 0;
      if (isAct && fs.p[1 - this.me].active) { try { dmg = suggestDamage(fs, this.me, k).dmg; } catch { /* 계산 못 하면 적힌 숫자 */ } }
      const kt = ((c.kat || [])[k] || {}).t || '';
      const cs = this.level === 'helper' ? coinSpec(kt) : null; if (cs) dmg = (cs.add ? (parseInt(at.d, 10) || 0) : 0) + (cs.n === 'tails' ? 1 : typeof cs.n === 'number' ? cs.n / 2 : 1) * cs.per;
      if (!best || dmg > best.dmg) best = { k, dmg, cs, td: this.level === 'helper' ? targetDmg(kt) : null };
    });
    return best;
  }
  potential(sl) { return Math.max(0, ...(this.top(sl).at || []).map(a => parseInt(a.d, 10) || 0)); }
  newTurn(v) { const key = v.turn; if (this.turnKey !== key) { this.turnKey = key; this.bad.clear(); this.queue = []; } }
  tryA(a) { const k = JSON.stringify(a); if (this.bad.has(k) || this.ban.has(this.vturn + '|' + k)) return null; this.lastKey = k; return a; }
  reject(r) { if (this.lastKey) this.bad.add(this.lastKey); this.st.fails++; if (r && r.warn) this.st.warns++; this.queue = []; }
  accepted(a, r) { if (r && r.gid && !(this.gids ||= new Set()).has(r.gid)) { this.gids.add(r.gid); this.st.groups++; } }

  // 내가 둘 차례인데 고를 수가 없으면 (되돌린 뒤 같은 차례로 돌아와 '안 되는 수' 기억이 남은 경우 등) 기억을 지우고 한 번 더
  decide(v) {
    const a = this.pick(v);
    if (a || v.phase === 'over' || !(v.waiting || []).includes(this.me)) return a;
    this.bad.clear(); this.queue = []; return this.pick(v);
  }
  pick(v) {
    this.st.decisions++; this.vturn = v.turn;
    const me = this.me, P = v.p[me], O = v.p[1 - me];
    if (v.phase === 'over') return null;
    if (this.outbox.length) return this.outbox.shift();
    // ---- 잠깐! (사람이 멈추고 지적함): 지적한 행동이 있으면 그 전으로, 없으면 이대로 계속 ----
    if (v.stop) {
      if (v.stop.by === me) return null;
      if (v.stop.to != null) return this.tryA({ type: 'stopUndo' }) || this.tryA({ type: 'stopEnd', how: 'keep', note: STOP_NOTE });
      return this.tryA({ type: 'stopEnd', how: 'keep', note: STOP_NOTE });
    }
    // ---- 되돌리기 요청에는 늘 동의 ----
    for (const g of v.groups) if (g.rewindBy != null && g.rewindBy !== me) { const a = this.tryA({ type: 'rewindOk', to: g.start }); if (a) return a; }
    // ---- 내 판정에 이의: 되돌리자고 하기 (사람이 '되돌리기 동의'를 누르면 되돌아감) ----
    for (const g of v.groups) {
      if (g.who !== me || g.status !== 'disputed' || g.rewindBy != null) continue;
      const key = g.gid + ':' + g.disputes.length; if (this.asked.has(key)) continue;
      this.asked.add(key); if (this.onDispute) this.onDispute(g);
      this.outbox.push({ type: 'chat', text: `「${g.title}」에 이의를 받았어요. '되돌리기 동의'를 누르면 그 전으로 돌아가요.` });
      return { type: 'rewindAsk', gid: g.gid };
    }
    // ---- 준비 ----
    if (v.phase === 'setup') {
      if (v.first == null && v.coinWinner === me) return this.tryA({ type: 'order', first: this.level === 'basic' });
      if (P.ready) return null;
      const basics = (P.hand || []).filter(x => isBasicP(this.C(x)));
      if (!P.active && basics.length) { // 배틀: 기술 비용이 적고 HP 높은 포켓몬
        const sc = x => { const c = this.C(x); const cost = Math.min(9, ...(c.at || []).map(a => (a.c || []).filter(t => t !== 'Free').length)); return (c.hp || 0) / 10 - cost * 3 - (has(c, 'ex') ? 2 : 0); };
        basics.sort((a, b) => sc(b) - sc(a)); const a = this.tryA({ type: 'setupPlace', iid: basics[0].i, to: 'active' }); if (a) return a;
      }
      if (P.active && basics.length && P.bench.length < 5) { const a = this.tryA({ type: 'setupPlace', iid: basics[0].i, to: 'bench' }); if (a) return a; }
      if (O.mull > 0 && !P.mullDrawn) { const a = this.tryA({ type: 'mullDraw', n: O.mull }); if (a) return a; }
      return this.tryA({ type: 'setupDone' });
    }
    if (v.phase !== 'play') return null;
    this.newTurn(v);
    // ---- 나에게 온 확인 (안 되면 '다르게 처리') ----
    for (const q of v.prompts) {
      if (q.to !== me) continue;
      let a = null;
      if (q.type === 'prize') a = this.tryA({ type: 'confirm', pid: q.id, k: 0 });
      else if (q.type === 'promote') {
        const b = P.bench.filter(x => x && !x.hidden);
        b.sort((x, y) => this.missing(x.en.map(e => this.C(e)), this.cheapCost(x)) - this.missing(y.en.map(e => this.C(e)), this.cheapCost(y)) || this.hpLeft(y) - this.hpLeft(x));
        if (b.length) a = this.tryA({ type: 'confirm', pid: q.id, sid: b[0].sid });
      } else a = this.tryA({ type: 'confirm', pid: q.id });
      if (a) return a;
      if (q.type !== 'prize' && q.type !== 'promote') { a = this.tryA({ type: 'dismiss', pid: q.id, note: '봇이 처리하지 못해 넘겼어요' }); if (a) return a; }
    }
    // ---- 상대 판정에 동의 (연습 봇은 늘 동의) ----
    for (const g of v.groups) if (g.who !== me && g.status === 'pending' && !this.agreed.has(g.gid)) { this.agreed.add(g.gid); return { type: 'agree', gid: g.gid }; }
    if (v.current !== me) return null;
    if (v.prompts.some(q => ['ko', 'prize', 'promote', 'checkup', 'next', 'win', 'deckout'].includes(q.type))) return null; // 상대가 고를 차례
    // ---- 이어서 하던 효과 ----
    while (this.queue.length) { const f = this.queue.shift(); let a = null; try { a = f(v); } catch { a = null; } if (a) { const t = this.tryA(a); if (t) return t; } }
    if (v.openGroup && v.openGroup[me]) { const a = this.tryA({ type: 'effectEnd' }); if (a) return a; }
    if (P.look) { const a = this.tryA({ type: 'lookEnd' }); if (a) return a; }
    const fs = this.fake(v), hand = P.hand || [];
    // ---- 보통: 트레이너스 ----
    if (this.level === 'helper') { const a = this.trainer(v, fs); if (a) return a; }
    // ---- 벤치에 기본 포켓몬 ----
    if (P.bench.length < 5 || !P.active) for (const x of hand) { if (!isBasicP(this.C(x))) continue; const a = this.tryA({ type: 'bench', iid: x.i }); if (a) return a; }
    // ---- 진화 ----
    if (v.turn > 2) for (const x of hand) {
      const c = this.C(x); if (c.st !== 'P' || isBasicP(c)) continue;
      for (const sl of this.slots(v, me)) { if (sl.turnIn === v.turn) continue; if (evoOk(c, this.top(sl)) !== true) continue; const a = this.tryA({ type: 'evolve', iid: x.i, sid: sl.sid }); if (a) return a; }
    }
    // ---- 보통: 특성 ----
    if (this.level === 'helper') { const a = this.ability(v); if (a) return a; }
    // ---- 에너지 붙이기 ----
    if (!P.used.energy) { const a = this.energy(v); if (a) return a; }
    // ---- 후퇴 ----
    const act = P.active;
    if (act && !P.used.retreat && !P.used.attack) {
      const ba = this.bestAttack(v, fs, act);
      const cost = this.top(act).rt || 0;
      if ((!ba || ba.dmg === 0) && act.en.length >= cost && !act.cond.asleep && !act.cond.paralyzed) {
        const ready = P.bench.filter(b => b && !b.hidden && this.missing(b.en.map(e => this.C(e)), this.bestCost(b)) === 0 && this.potential(b) > 0);
        if (ready.length) { ready.sort((a, b) => this.potential(b) - this.potential(a)); const a = this.tryA({ type: 'retreat', sid: ready[0].sid, discard: act.en.slice(0, cost).map(e => e.i) }); if (a) return a; }
      }
    }
    // ---- 기술 ----
    if (act && !P.used.attack && v.turn !== 1 && O.active) {
      const ba = this.bestAttack(v, fs, act);
      if (ba && (ba.dmg > 0 || ((this.top(act).at || [])[ba.k] || {}).t)) {
        const a = { type: 'attack', k: ba.k };
        if (ba.cs) a.coins = true;
        if (ba.td != null) { const t = this.slots(v, 1 - me).sort((x, y) => (this.hpLeft(x) <= ba.td ? -1 : 0) - (this.hpLeft(y) <= ba.td ? -1 : 0) || this.hpLeft(x) - this.hpLeft(y))[0]; if (t) a.target = t.sid; }
        const r = this.tryA(a); if (r) return r;
      }
    }
    return this.tryA({ type: 'endTurn' }) || this.tryA({ type: 'endTurn', force: true, note: '봇이 더 둘 수 있는 게 없어요' });
  }
  bestCost(sl) { const at = (this.top(sl).at || []).slice().sort((a, b) => (parseInt(b.d, 10) || 0) - (parseInt(a.d, 10) || 0))[0]; return at ? at.c : []; }
  cheapCost(sl) { const at = (this.top(sl).at || []).filter(a => parseInt(a.d, 10) > 0).sort((a, b) => (a.c || []).length - (b.c || []).length)[0]; return at ? at.c : []; }
  energy(v) {
    const me = this.me, P = v.p[me], ens = (P.hand || []).filter(x => this.C(x).st === 'E'); if (!ens.length) return null;
    const cands = [];
    for (const sl of this.slots(v, me)) {
      const cost = this.bestCost(sl), now = this.missing(sl.en.map(e => this.C(e)), cost); if (!now) continue;
      for (const e of ens) { const after = this.missing([...sl.en.map(x => this.C(x)), this.C(e)], cost); if (after < now) cands.push({ sl, e, gain: now - after, act: sl === P.active ? 1 : 0, pot: this.potential(sl) }); }
    }
    cands.sort((a, b) => b.act - a.act || b.pot - a.pot);
    for (const c of cands) { const a = this.tryA({ type: 'attach', iid: c.e.i, sid: c.sl.sid }); if (a) return a; }
    return null;
  }
  // ---- 보통 ----
  ctx(v) { return { name: c => c.kn || c.ko || c.n, oppNames: this.slots(v, 1 - this.me).map(sl => { const c = this.top(sl); return c.kn || c.n; }) }; }
  trainer(v) {
    const me = this.me, P = v.p[me], hand = P.hand || [];
    const ctx = this.ctx(v);
    for (const x of hand) {
      const c = this.C(x); if (c.st !== 'T') continue;
      if (has(c, 'Pokémon Tool')) { // 도구: 배틀 포켓몬부터 (도구가 없는 포켓몬)
        const sl = this.slots(v, me).find(s => !s.tl.length); if (sl) { const a = this.tryA({ type: 'attach', iid: x.i, sid: sl.sid }); if (a) { this.st.trainersPlayed++; this.queue = [() => ({ type: 'effectEnd' })]; return a; } }
        continue;
      }
      if (has(c, 'Stadium')) { if (!P.used.stadium && (!v.stadium || v.stadium.by !== me)) { const a = this.tryA({ type: 'play', iid: x.i }); if (a) { this.st.trainersPlayed++; this.queue = [() => ({ type: 'effectEnd' })]; return a; } } continue; }
      if (has(c, 'Supporter') && (P.used.supporter || v.turn === 1)) continue;
      const lines = c.kr || [], all = lines.join(' ');
      const plan = this.planTrainer(v, x, c, lines, all, ctx);
      if (plan === 'skip') continue;
      if (!plan) { this.st.unsupported[c.kn || c.n] = (this.st.unsupported[c.kn || c.n] || 0) + 1; continue; }
      const a = this.tryA({ type: 'play', iid: x.i }); if (!a) continue;
      this.st.trainersPlayed++; this.queue = plan; return a;
    }
    return null;
  }
  planTrainer(v, x, c, lines, all, ctx) { // 이 카드를 쓰면 이어서 할 행동들 (함수 목록). 못 읽으면 null, 지금 쓸 때가 아니면 'skip'
    const me = this.me, P = v.p[me], O = v.p[1 - me], hand = P.hand || [];
    const end = () => ({ type: 'effectEnd' });
    for (const t of lines) { const r = parseReset(t); if (r) {
      const n = resetCount(r, P.prizesN, O.prizesN);
      if (r.who === 'me' && hand.length > 4) return 'skip';
      if (r.who === 'opp' && O.handN < 4) return 'skip';
      return [() => ({ type: 'handReset', who: r.who, how: r.how, n, why: c.kn || c.n }), end];
    } }
    if (/상대의 벤치 포켓몬을 1마리 선택해서 배틀 포켓몬과 교체한다/.test(all)) { // 보스의 지령
      const fs = this.fake(v), ba = P.active ? this.bestAttack(v, fs, P.active) : null; if (!ba) return 'skip';
      const t = O.bench.filter(b => b && !b.hidden && this.hpLeft(b) <= ba.dmg).sort((a, b) => (has(this.top(b), 'ex') ? 1 : 0) - (has(this.top(a), 'ex') ? 1 : 0))[0];
      if (!t || (O.active && this.hpLeft(O.active) <= ba.dmg && !has(this.top(t), 'ex'))) return 'skip';
      return [() => ({ type: 'switch', sid: t.sid }), end];
    }
    if (/^(?:자신의 )?배틀 포켓몬을 벤치 포켓몬과 교체한다/.test(lines[0] || '')) { // 포켓몬 교체
      const fs = this.fake(v), ba = P.active ? this.bestAttack(v, fs, P.active) : null;
      const ready = P.bench.filter(b => b && !b.hidden && this.missing(b.en.map(e => this.C(e)), this.bestCost(b)) === 0 && this.potential(b) > 0);
      if ((ba && ba.dmg > 0) || !ready.length) return 'skip';
      return [() => ({ type: 'switch', sid: ready[0].sid }), end];
    }
    if (/자신의 패에서 2진화 포켓몬을 1장 선택해서 그 포켓몬으로 진화하는/.test(all)) { // 이상한사탕
      if (v.turn <= 2) return 'skip';
      for (const y of hand) { const s2 = this.C(y); if (!has(s2, 'Stage 2')) continue;
        for (const sl of this.slots(v, me)) { if (sl.turnIn === v.turn || !isBasicP(this.top(sl))) continue; if (evoOk(s2, this.top(sl), true) !== true) continue; const sid = sl.sid; return [() => ({ type: 'evolve', iid: y.i, sid, candy: true }), end]; } }
      return 'skip';
    }
    const draw = lines.map(parseDraw).find(n => n != null);
    let sp = null; const co = lines.map(t => parseCost(t, ctx)).find(Boolean) || null;
    for (const t of lines) { sp = parseTop(t, ctx) || parseSearch(t, ctx); if (sp) break; }
    if (sp && !sp.top && sp.src === 'deck' && ['hand', 'bench'].includes(sp.to) && sp.test) {
      if (sp.to === 'bench' && P.bench.length >= 5) return 'skip';
      if (co && hand.length - 1 < co.n) return 'skip';
      const steps = [];
      if (co) steps.push(v2 => { const h = (v2.p[me].hand || []).filter(y => y.i !== x.i && (!co.test || co.test(this.C(y)))); const junk = this.junk(v2, h).slice(0, co.n); return junk.length === co.n ? { type: 'move', iids: junk.map(y => y.i), to: { z: 'discard', p: me } } : null; });
      steps.push(() => ({ type: 'look', p: me, z: 'deck' }));
      steps.push(v2 => {
        const deck = v2.p[me].deck.cards || []; let ok = deck.filter(y => sp.test(this.C(y)));
        if (sp.each) { const pick = []; for (const k of sp.each) { const y = ok.find(z => k.test(this.C(z)) && !pick.includes(z)); if (y) pick.push(y); } ok = pick; }
        ok = this.want(v2, ok).slice(0, sp.max == null ? 3 : sp.max);
        if (sp.to === 'bench') ok = ok.filter(y => isBasicP(this.C(y))).slice(0, 5 - v2.p[me].bench.length);
        if (!ok.length) return { type: 'shuffle', p: me };
        return { type: 'move', iids: ok.map(y => y.i), to: { z: sp.to, p: me }, ...(sp.reveal ? { show: true } : {}), ...(sp.shuffle ? { shuffle: true } : {}) };
      });
      steps.push(end); return steps;
    }
    if (sp && sp.top && sp.to === 'hand' && sp.test) { // 위에서 N장 보고 고르기 (포켓기어 등)
      return [() => ({ type: 'look', p: me, z: 'deck', n: sp.top }), v2 => { const deck = v2.p[me].deck.cards || []; const ok = deck.filter(y => sp.test(this.C(y))).slice(0, sp.max || 1); return ok.length ? { type: 'move', iids: ok.map(y => y.i), to: { z: 'hand', p: me }, show: true } : null; },
        v2 => { const deck = v2.p[me].deck.cards || []; return deck.length && sp.rest === 'shuffle' ? { type: 'shuffle', p: me } : deck.length ? { type: 'move', iids: deck.map(y => y.i), to: { z: 'deck', p: me, pos: 'bottom' } } : null; }, end];
    }
    if (sp && sp.src === 'discard' && sp.to === 'hand' && sp.test) { // 밤의 들것
      const ok = this.want(v, (P.discard || []).filter(y => sp.test(this.C(y)))); if (!ok.length) return 'skip';
      return [() => ({ type: 'move', iids: [ok[0].i], to: { z: 'hand', p: me }, show: true }), end];
    }
    if (draw != null && !sp) { if (hand.length > 5) return 'skip'; return [() => ({ type: 'draw', n: draw }), end]; }
    return null;
  }
  want(v, list) { // 고를 카드 순서: 진화 줄이 이어지는 포켓몬 > 2진화 > 1진화 > 기본 포켓몬 > 에너지 > 나머지
    const me = this.me, field = this.slots(v, me).map(sl => this.top(sl)), hand = (v.p[me].hand || []).map(x => this.C(x));
    const sc = y => { const c = this.C(y); if (c.st === 'P') { if (!isBasicP(c) && field.some(f => evoOk(c, f) === true || evoOk(c, f, true) === true)) return 5; if (has(c, 'Stage 2')) return 4; if (!isBasicP(c)) return 3; return hand.some(h => h.n === c.n) ? 1 : 2.5; } if (c.st === 'E') return 1.5; return 1; };
    return list.slice().sort((a, b) => sc(b) - sc(a));
  }
  junk(v, list) { // 버릴 카드 순서: 같은 카드가 많은 것, 에너지, 스타디움 (진화 포켓몬은 아낌)
    const cnt = {}; for (const y of list) cnt[this.C(y).n] = (cnt[this.C(y).n] || 0) + 1;
    const sc = y => { const c = this.C(y); return (cnt[c.n] - 1) * 2 + (c.st === 'E' ? 2 : 0) + (has(c, 'Stadium') ? 1 : 0) - (c.st === 'P' && !isBasicP(c) ? 2 : 0); };
    return list.slice().sort((a, b) => sc(b) - sc(a));
  }
  ability(v) {
    const me = this.me, P = v.p[me];
    for (const sl of this.slots(v, me)) {
      const c = this.top(sl);
      for (let k = 0; k < (c.ab || []).length; k++) {
        const ab = (c.kab || [])[k] || c.ab[k]; if (!ab || !/사용할 수 있다/.test(ab.t || '')) continue;
        if ((P.used.ab || []).includes(`${sl.sid}:${k}`)) continue;
        const t = ab.t, d = parseDraw(t), sp = parseTop(t, this.ctx(v)) || parseSearch(t, this.ctx(v));
        let plan = null;
        if (d != null && !sp && !/패에서/.test(t)) plan = [() => ({ type: 'draw', n: d }), () => ({ type: 'effectEnd' })];
        else if (sp && sp.src === 'hand' && sp.to === 'attach' && sp.target === 'self') { // 패의 에너지를 이 포켓몬에게 붙이고 (뽑기)
          const e = (P.hand || []).find(y => sp.test && sp.test(this.C(y))); if (!e) continue; const sid = sl.sid;
          plan = [() => ({ type: 'move', iids: [e.i], to: { z: 'slot', sid, part: 'en' } }), ...(d != null ? [() => ({ type: 'draw', n: d })] : []), () => ({ type: 'effectEnd' })];
        } else if (sp && sp.top && sp.to === 'hand') { // 위에서 N장 보고 1장
          plan = [() => ({ type: 'look', p: me, z: 'deck', n: sp.top }), v2 => { const deck = v2.p[me].deck.cards || []; const ok = this.want(v2, deck).slice(0, 1); return ok.length ? { type: 'move', iids: ok.map(y => y.i), to: { z: 'hand', p: me } } : null; },
            v2 => { const deck = v2.p[me].deck.cards || []; return deck.length ? { type: 'move', iids: deck.map(y => y.i), to: { z: 'deck', p: me, pos: 'bottom' } } : null; }, () => ({ type: 'effectEnd' })];
        } else if (sp && sp.src === 'deck' && sp.to === 'hand' && sp.test) {
          plan = [() => ({ type: 'look', p: me, z: 'deck' }), v2 => { const ok = this.want(v2, (v2.p[me].deck.cards || []).filter(y => sp.test(this.C(y)))).slice(0, sp.max || 1); return ok.length ? { type: 'move', iids: ok.map(y => y.i), to: { z: 'hand', p: me }, ...(sp.reveal ? { show: true } : {}), ...(sp.shuffle ? { shuffle: true } : {}) } : { type: 'shuffle', p: me }; }, () => ({ type: 'effectEnd' })];
        }
        if (!plan) { this.st.unsupported['특성:' + ab.n] = (this.st.unsupported['특성:' + ab.n] || 0) + 1; continue; }
        const a = this.tryA({ type: 'ability', sid: sl.sid, k }); if (!a) continue;
        this.st.abilities++; this.queue = plan; return a;
      }
    }
    return null;
  }
}

// 고른 덱 이름 → 기본 제공 덱 (영어 카드 이름 + 장 수, 서버가 지금 카드 자료에서 한글 글이 있는 카드로 찾음)
export const BOT_DECKS = {
  dragapult: { name: '드래펄트 ex', note: '진화·검색이 많은 덱', list: '3 Drakloak|2 Dragapult ex|4 Lillie\'s Determination|4 Judge|2 Blaziken ex|2 Torchic|1 Blowtorch|1 Combusken|3 Dreepy|2 Munkidori|2 Budew|1 Fezandipiti ex|1 Chi-Yu|1 Shaymin|1 Psyduck|3 Boss\'s Orders|2 Dawn|4 Night Stretcher|3 Buddy-Buddy Poffin|4 Ultra Ball|2 Rare Candy|2 Jamming Tower|3 Basic Fire Energy|3 Basic Darkness Energy|2 Basic Psychic Energy|1 Mega Absol ex|1 Prime Catcher' },
  kangaskhan: { name: '메가캥카 ex', note: '에너지 붙이고 바로 공격', list: '4 Mega Kangaskhan ex|3 Munkidori|2 Teal Mask Ogerpon ex|2 Meowth ex|2 Pecharunt|1 Mega Absol ex|1 Latias ex|1 Pecharunt ex|1 Yveltal|1 Fezandipiti ex|3 Boss\'s Orders|3 Crispin|2 Lillie\'s Determination|1 Brock\'s Scouting|1 Judge|1 Cyrano|1 Ciphermaniac\'s Codebreaking|4 Ultra Ball|4 Energy Switch|2 Dark Bell|1 Night Stretcher|1 Special Red Card|1 Hero\'s Cape|3 Area Zero Underdepths|8 Basic Grass Energy|6 Basic Darkness Energy' },
};
// 카드 이름으로 찾기: 한글 이름·글이 있는 카드를 먼저 (한국판에만 있는 카드는 나중)
export function botDeckIds(key, idx) {
  const d = BOT_DECKS[key]; if (!d) return null;
  const score = c => (c.kn ? 4 : 0) + (c.kat || c.kr ? 2 : 0) + (c.kro ? -5 : 0);
  const out = [], miss = [];
  for (const part of d.list.split('|')) {
    const m = part.trim().match(/^(\d+) (.+)$/); if (!m) continue;
    const list = (idx.byName[m[2].toLowerCase()] || []).slice().sort((a, b) => score(b) - score(a));
    if (!list.length) { miss.push(m[2]); continue; }
    for (let i = 0; i < +m[1]; i++) out.push(list[0].id);
  }
  return { ids: out, miss, name: d.name };
}
