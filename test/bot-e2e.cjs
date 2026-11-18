// 연습 봇 시험 (실제 서버): 방 만들기 창에서 '연습 봇'으로 시작 → 서버의 봇이 혼자 두는지, 이의·잠깐!에 대답하는지,
// 사람 자리는 같은 봇 코드를 화면 안에서 돌려 끝까지 둠 → '한 판 더'. BASE=http://127.0.0.1:8787 node test/bot-e2e.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const OUT = __dirname + '/out/bot-'; require('fs').mkdirSync(__dirname + '/out', { recursive: true });
const errs = [], log = (...a) => console.log(...a);
const check = (ok, msg) => { if (!ok) { errs.push(msg); log('  ✗ ' + msg); } else log('  ✓ ' + msg); };
const svgFor = u => { let h = 0; for (const ch of u) h = (h * 31 + ch.charCodeAt(0)) % 360; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="3" fill="#f5d142"/><rect x="3" y="3" width="57" height="82" rx="2" fill="hsl(${h},55%,62%)"/></svg>`; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { indexCards } = await import('../public/lib/deck.js');
  const { botDeckIds } = await import('../public/lib/bot.js');
  const idx = indexCards(JSON.parse(require('fs').readFileSync(__dirname + '/../public/cards.json', 'utf8')));
  const ids = botDeckIds('kangaskhan', idx).ids, cnt = {}; for (const id of ids) cnt[id] = (cnt[id] || 0) + 1;
  const DECK = Object.entries(cnt).map(([id, n]) => ({ id, n }));
  const b = await chromium.launch();
  const tag = Date.now().toString(36).slice(-4);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route(/images\.pokemontcg\.io|pokemoncard\.co\.kr|pokemonkorea/, r => r.fulfill({ contentType: 'image/svg+xml', body: svgFor(r.request().url()) }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('page: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(BASE + '/#login'); await p.waitForSelector('#lf');
  const name = '봇시험' + tag;
  const st = await p.evaluate(async n => (await fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, pw: 'test1234', code: 'doran' }) })).status, name);
  check(st === 200, '가입');
  const api = (path, body) => p.evaluate(async ([path, body]) => { const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return r.json(); }, [path, body]);
  const dk = await api('/api/decks', { name: '캥카 연습', list: DECK }); check(dk.deck && dk.check.ok, '내 덱 저장 (60장)');

  // ---- 방 만들기 창: '연습 봇' 고르기, 여러 폭에서 넘침 검사 ----
  await p.goto(BASE + '/#lobby'); await p.waitForSelector('.newroom');
  await p.click('.newroom'); await p.waitForSelector('#newroom');
  await p.click('#newroom input[name=opp][value=bot] + span');
  check(await p.$eval('.forbot', e => !e.hidden) && await p.$eval('.forpeople', e => e.hidden), "연습 봇: 봇 덱·실력이 보이고 진행 방식·판수·초대는 숨음");
  check((await p.textContent('#newroom .acts1 button')).includes('연습 봇과 시작'), "단추 글자 '연습 봇과 시작'");
  for (const [w, h] of [[260, 640], [360, 740], [390, 844], [768, 1024], [1280, 860]]) {
    await p.setViewportSize({ width: w, height: h }); await sleep(250);
    const o = await p.evaluate(() => { const sh = document.querySelector('.sheet, #newroom').closest('.sheet') || document.querySelector('#newroom'); const bad = [...sh.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').map(e => e.className || e.tagName).slice(0, 3); return { page: document.documentElement.scrollWidth > innerWidth + 1, bad }; });
    check(!o.page && !o.bad.length, `${w}px 방 만들기 창 넘침 없음 ${o.bad.join(',')}`);
    if (w === 390 || w === 1280) await p.screenshot({ path: OUT + `form-${w}.png`, fullPage: false });
  }
  await p.setViewportSize({ width: 1280, height: 860 });
  await p.click('#newroom input[name=botDeck][value=dragapult] + span');
  await p.click('#newroom .acts1 button');
  await p.waitForFunction(() => location.hash.startsWith('#game/'), null, { timeout: 15000 }).catch(async e => { log('toast:', await p.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map(x => x.textContent).join(' | '))); log('rooms:', JSON.stringify((await api('/api/rooms')).rooms.map(r => [r.status, r.players, r.cfg.bot]))); throw e; });
  const gid = await p.evaluate(() => location.hash.slice(6));
  check(!!gid, '바로 판으로 들어감');
  await p.waitForSelector('.area.bottom', { timeout: 20000 });

  // ---- 옆 연결: 사람 자리 (화면 안에서 같은 봇 코드로 둠) ----
  await p.evaluate(g => new Promise(res => {
    const ws = new WebSocket(`ws://${location.host}/ws/game/${g}`); window.T = { ws, view: null, lines: [], seq: 9000, pend: {}, cards: null };
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.view) T.view = m.view; if (m.cards) T.cards = m.cards; if (m.t === 'full') T.lines = m.lines; if (m.t === 'upd') T.lines.push(...m.lines); if (m.t === 'res' && T.pend[m.id]) { T.pend[m.id](m); delete T.pend[m.id]; } if (m.t === 'full') res(); };
  }), gid);
  const act = a => p.evaluate(a => new Promise(r => { const id = T.seq++; T.pend[id] = r; T.ws.send(JSON.stringify({ t: 'act', id, a })); }), a);
  const V = () => p.evaluate(() => T.view);
  const clearReveals = async () => { for (let i = 0; i < 30; i++) { const bt = await p.$('.revlayer button.primary'); if (!bt) break; await bt.click().catch(() => {}); await sleep(120); } }; // 상대가 보여준 카드 창 닫기 (사람은 '확인'을 누름)
  const until = async (fn, ms = 15000, what = '') => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await V(); const r = fn(v); if (r) return r; await sleep(200); } errs.push('기다림 시간 초과: ' + what); return null; };
  let v = await V(); const me = v.me, bs = 1 - me;
  check(v.p[bs].name === '연습 봇', `상대 이름 '연습 봇' (${v.p[bs].name})`);
  // 봇이 혼자 준비 (첫 인사·포켓몬 놓기·준비 완료)
  await until(v => v.p[bs].ready || (v.first == null && v.coinWinner === bs ? false : v.p[bs].ready), 15000, '봇 준비 완료');
  const hello = await p.evaluate(() => T.lines.some(l => l.chat && /연습 봇이에요/.test(l.txt)));
  check(hello, '봇 첫 인사 채팅');
  v = await V(); check(v.p[bs].ready, '봇이 준비 완료');
  // 사람 자리: 화면 안에서 봇 코드로 (판정에는 동의, 이의·잠깐!은 직접 시험)
  await p.evaluate(async seat => { const { Bot } = await import('/lib/bot.js'); window.HB = new Bot(seat, T.cards, 'basic'); }, me);
  const humanStep = () => p.evaluate(async () => {
    const a = HB.decide(T.view); if (!a) return null;
    const r = await new Promise(res => { const id = T.seq++; T.pend[id] = res; T.ws.send(JSON.stringify({ t: 'act', id, a })); });
    if (!r.ok) HB.reject(r); return { a: a.type, ok: r.ok };
  });
  const t0 = Date.now(); let disputed = false, stopped = false, rwAskSeen = false, rewound = false, stopAnswered = false, botActs = 0, shot = false;
  let stepTested = false;
  while (Date.now() - t0 < 8 * 60e3) {
    v = await V(); if (v.phase === 'over') break;
    // 봇 차례: '다음 수'를 누를 때만 한 수 → 화면 크기마다 단추가 겹치지 않는지 → '자동'을 켜고 나머지는 자동으로
    if (!stepTested && v.phase === 'play' && v.current === bs && !v.stop) {
      stepTested = true;
      const waitGo = () => p.waitForSelector('.botstep.go', { timeout: 8000 }).then(() => true).catch(() => false);
      check(await waitGo(), "봇 차례에 '다음 수' 단추가 반짝이며 기다림");
      await sleep(400); const n0 = (await V()).n; await sleep(2500);
      check((await V()).n === n0, `누르기 전엔 봇이 두지 않음 (${n0} → ${(await V()).n})`);
      await clearReveals(); await p.click('[data-t=botStep]');
      const one = await until(v => v.n > n0, 4000, "'다음 수' 뒤 봇이 한 수");
      check(!!one, "'다음 수' 누르면 봇이 한 수 둠");
      await sleep(300); const n1 = (await V()).n; check(n1 >= n0 + 1 && n1 <= n0 + 2, `한 번 누르면 한 수만 (${n0} → ${n1})`);
      await waitGo(); await clearReveals();
      for (const [w, h] of [[1280, 860], [844, 390], [740, 340], [390, 844], [360, 740], [260, 560]]) {
        await p.setViewportSize({ width: w, height: h }); await sleep(450);
        const m = await p.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
          const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
          const c = r('.botctl'), lg = r('.rbtns'), bar = r('.rcol .rbar'), more = r('.rcol > .fabw');
          const kids = [...document.querySelectorAll('.botctl > *')].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; });
          return { c, kids, lg, bar, more, rcol: r('.rcol'), over: hit(c, lg) || hit(c, bar) || hit(c, more), out: !c || c.l < 0 || c.t < 0 || c.r > innerWidth + 0.5 || c.b > innerHeight + 0.5, sw: document.scrollingElement.scrollWidth - innerWidth };
        });
        if (process.env.STEP_ONLY) log(w, h, JSON.stringify({ kids: m.kids, lg: m.lg, bar: m.bar, rcol: m.rcol }));
        check(m.c && !m.over && !m.out && m.sw <= 0, `${w}×${h} 봇 단추 겹침·잘림 없음 ${m.over ? '(겹침)' : ''}${m.out ? '(화면 밖)' : ''}${m.sw > 0 ? '(가로 넘침)' : ''}`);
        if ((w === 390 && h === 844) || (w === 844 && h === 390) || w === 1280) await p.screenshot({ path: OUT + `step-${w}x${h}.png` });
      }
      if (process.env.STEP_ONLY) { await b.close(); log(errs.length ? `\n실패 ${errs.length}개:\n- ${errs.join('\n- ')}` : '\n모두 통과'); process.exit(errs.length ? 1 : 0); }
      await p.setViewportSize({ width: 1280, height: 860 }); await sleep(300);
      await p.click('[data-t=botAuto]'); await sleep(300);
      check(await p.$('[data-t=botAuto].on') != null, "'자동' 켜짐 (단추가 '자동 멈춤'으로)");
      const n2 = (await V()).n; const auto = await until(v => v.n >= n2 + 2 || v.current !== bs, 6000, '자동으로 봇이 둠');
      check(!!auto, '자동이면 누르지 않아도 봇이 둠');
      continue;
    }
    // 이의: 봇 판정이 처음 올라오면 이의 → 봇이 되돌리자고 하는지 → 동의
    const pend = v.groups.find(g => g.who === bs && g.status === 'pending');
    if (!disputed && pend) {
      disputed = true; await act({ type: 'dispute', gid: pend.gid, text: '시험 이의' });
      const got = await until(v => v.groups.find(g => g.gid === pend.gid && g.rewindBy === bs), 8000, '봇이 되돌리자고 함');
      rwAskSeen = !!got; check(rwAskSeen, `이의 → 봇이 「${pend.title}」 전으로 되돌리자고 함`);
      if (got) { const n0 = (await V()).n; const r = await act({ type: 'rewindOk', to: got.start }); rewound = r.ok; check(r.ok, '되돌리기 동의 → 되돌림'); await until(v => v.n > n0, 5000, '되돌린 뒤 판'); }
      continue;
    }
    // 잠깐!: 봇 차례에 방금 봇이 둔 수를 지적 → 봇이 그 전으로 되돌리기에 동의하는지
    if (!stopped && v.phase === 'play' && v.current === bs && v.turn >= 4 && !v.stop) {
      const lines = await p.evaluate(() => T.lines.filter(l => l.who != null && l.k >= 0));
      const last = [...lines].reverse().find(l => l.who === bs && !l.chat);
      if (last) {
        stopped = true; const n0 = v.n;
        const r = await act({ type: 'stop', text: '시험 지적', to: last.k, what: last.txt.slice(0, 40) });
        check(r.ok, '잠깐! 누름');
        const ok = await until(v => !v.stop && v.n > n0 + 1, 8000, '봇이 잠깐!에 대답');
        stopAnswered = !!ok; check(stopAnswered, '잠깐! → 봇이 그 행동 전으로 되돌리기에 동의');
        continue;
      }
    }
    if (!shot && v.phase === 'play' && v.turn >= 5 && v.current === bs) { shot = true; await clearReveals(); await sleep(1200); await clearReveals(); await p.screenshot({ path: OUT + 'board-1280.png' }); }
    const waiting = v.waiting.includes(me) || v.groups.some(g => g.who === bs && g.status === 'pending');
    if (waiting) { const r = await humanStep(); if (r) continue; }
    botActs++; await sleep(300);
  }
  v = await V();
  check(v.phase === 'over', `판이 끝까지 감 (${v.turn}차례, ${v.winReason || ''})`);
  check(disputed && rwAskSeen && rewound, '이의 → 되돌리기 흐름');
  check(stopped && stopAnswered, '잠깐! 흐름');
  check(stepTested, "'다음 수'·'자동' 흐름");
  // 끝난 판: '한 판 더'
  await p.waitForSelector('[data-t=botAgain]', { timeout: 10000 }).catch(() => null); await sleep(2800); await clearReveals();
  const again = await p.$('[data-t=botAgain]'); check(!!again, "끝난 판에 '한 판 더' 단추");
  await p.screenshot({ path: OUT + 'over-1280.png' });
  if (again) { await again.click(); await p.waitForFunction(g => location.hash.startsWith('#game/') && location.hash.slice(6) !== g, gid, { timeout: 15000 }).catch(() => null); check((await p.evaluate(() => location.hash.slice(6))) !== gid, '한 판 더 → 새 판'); }
  // 로비: 봇 방 카드 (봇 얼굴)
  await p.goto(BASE + '/#lobby'); await p.waitForSelector('.rcard');
  check(await p.$('.rp.bot .av svg') != null, '로비 방 카드에 봇 얼굴');
  await p.setViewportSize({ width: 390, height: 844 }); await sleep(300); await p.screenshot({ path: OUT + 'lobby-390.png' });
  const st2 = await api('/api/stats'); check(st2.opps && st2.opps.some(o => o.name === '연습 봇'), "전적에 '연습 봇'");
  await b.close();
  log(errs.length ? `\n실패 ${errs.length}개:\n- ${errs.join('\n- ')}` : '\n모두 통과');
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
