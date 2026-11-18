// 카드 능력 도우미 시험 (링크 님 30장): 판 위에서 고르기·단계 단추·동전 기술·고르는 기술·카운터 나누기·패 리셋·거목·사탕·폐허·잠금 배지
// 준비(가입·덱·방·카드 옮기기)는 API·옆 연결로, 시험할 동작은 화면으로. BASE=http://127.0.0.1:8787 node test/cardfx-e2e.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const OUT = __dirname + '/out/cfx-'; require('fs').mkdirSync(__dirname + '/out', { recursive: true });
const L = (o) => Object.entries(o).map(([id, n]) => ({ id, n }));
const DECK = L({ 'sv6pt5-38': 2, 'me3-62': 2, 'me1-104': 2, 'sv6-25': 2, 'sv5-128': 2, 'sv5-129': 2, 'sv8pt5-4': 2, 'sv6-95': 2, 'sv6-128': 3, 'sv6-129': 2, 'sv6-130': 2,
  'me1-114': 2, 'me1-115': 2, 'me1-119': 1, 'me3-76': 1, 'me4-82': 1, 'sv6-165': 1, 'me2-87': 1, 'rsv10pt5-84': 1, 'sv6pt5-61': 2, 'me1-125': 2, 'sv5-144': 2,
  'me1-127': 1, 'me1-117': 1, 'me2-85': 1, 'me6-94': 1, 'me6-95': 1, 'sv7-136': 1, 'sv10-180': 1, 'sve-1': 6, 'sve-7': 4, 'sve-5': 3 });
const errs = [], log = (...a) => console.log(...a);
const svgFor = u => { let h = 0; for (const ch of u) h = (h * 31 + ch.charCodeAt(0)) % 360; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="3" fill="#f5d142"/><rect x="3" y="3" width="57" height="82" rx="2" fill="hsl(${h},55%,62%)"/><circle cx="31" cy="29" r="11" fill="hsl(${(h + 180) % 360},50%,45%)"/></svg>`; };
const check = (ok, msg) => { if (!ok) { errs.push(msg); log('  ✗ ' + msg); } else log('  ✓ ' + msg); };
(async () => {
  const b = await chromium.launch();
  const tag = Date.now().toString(36).slice(-4);
  const mk = async (name, w, h) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/images\.pokemontcg\.io|pokemoncard\.co\.kr|pokemonkorea/, r => r.fulfill({ contentType: 'image/svg+xml', body: svgFor(r.request().url()) }));
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await p.goto(BASE + '/#login'); await p.waitForSelector('#lf');
    const r = await p.evaluate(async ([n]) => (await fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, pw: 'test1234', code: 'doran' }) })).status, [name]);
    if (r !== 200) errs.push(name + ' 가입 ' + r);
    return p;
  };
  const api = (p, path, body) => p.evaluate(async ([path, body]) => (await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json(), [path, body]);
  const A = await mk('가' + tag, 1280, 860), B = await mk('나' + tag, 1280, 860);
  const dA = await api(A, '/api/decks', { name: '시험덱', list: DECK }), dB = await api(B, '/api/decks', { name: '시험덱', list: DECK });
  const room = await api(A, '/api/rooms', { mode: 'live', deckId: dA.deck.id });
  const j = await api(B, `/api/rooms/${room.room.id}/join`, { deckId: dB.deck.id });
  const gid = j.room.games[j.room.games.length - 1], url = BASE + '/#game/' + gid;
  for (const p of [A, B]) { await p.goto(url); await p.waitForSelector('.area.bottom'); }
  // 옆 연결: 같은 사람으로 판에 붙어 준비용 행동을 보냄 (화면은 그대로 따라 그려짐)
  for (const p of [A, B]) await p.evaluate(g => new Promise(res => {
    const ws = new WebSocket(`ws://${location.host}/ws/game/${g}`); window.T = { ws, view: null, seq: 5000, pend: {} };
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.view) T.view = m.view; if (m.t === 'res' && T.pend[m.id]) { T.pend[m.id](m); delete T.pend[m.id]; } if (m.t === 'full') res(); };
  }), gid);
  const act = (p, a) => p.evaluate(a => new Promise(r => { const id = T.seq++; T.pend[id] = r; T.ws.send(JSON.stringify({ t: 'act', id, a })); }), a);
  const V = p => p.evaluate(() => T.view);
  const force = async (p, a) => { const r = await act(p, { ...a, force: true }); if (!r.ok) errs.push('준비 실패 ' + JSON.stringify(a) + ' ' + (r.err || JSON.stringify(r.warn))); return r; };
  const me = async p => (await V(p)).me;
  const fromDeck = async (p, cid, to, n = 1) => { // 그 카드 n장을 to로 (손패·덱·프라이즈 어디에 있든: 시험 준비용)
    const m = await me(p), out = [];
    const dest = to.z ? { p: m, ...to } : to;
    let v = await V(p);
    if (dest.z === 'hand') out.push(...v.p[m].hand.filter(x => x.c === cid).slice(0, n).map(x => x.i)); // 이미 손패에 있음
    if (dest.z !== 'hand') for (const x of v.p[m].hand.filter(x => x.c === cid)) { if (out.length >= n) break; await force(p, { type: 'move', iids: [x.i], to: dest }); out.push(x.i); }
    if (dest.z !== 'discard') for (const x of v.p[m].discard.filter(x => x.c === cid)) { if (out.length >= n) break; await force(p, { type: 'move', iids: [x.i], to: dest }); out.push(x.i); }
    if (out.length < n) { await force(p, { type: 'look', p: m, z: 'deck' }); v = await V(p);
      for (const x of v.p[m].deck.cards.filter(x => x.c === cid)) { if (out.length >= n) break; await force(p, { type: 'move', iids: [x.i], to: dest }); out.push(x.i); }
      await act(p, { type: 'lookEnd' }); }
    if (out.length < n) { await force(p, { type: 'look', p: m, z: 'prizes' }); v = await V(p);
      for (const x of (v.p[m].prizes || []).filter(x => x.c === cid)) { if (out.length >= n) break; await force(p, { type: 'move', iids: [x.i], to: dest }); out.push(x.i); }
      await act(p, { type: 'lookEnd' }); }
    if (out.length < n) errs.push(`${cid} ${n}장을 못 찾음`);
    return out;
  };
  const ensureDeck = async (p, cid) => { // 그 카드가 덱에 있게 (프라이즈·손패에 있으면 덱으로)
    const m = await me(p); await force(p, { type: 'look', p: m, z: 'prizes' });
    let v = await V(p); for (const x of (v.p[m].prizes || []).filter(x => x.c === cid)) await force(p, { type: 'move', iids: [x.i], to: { z: 'deck', p: m } });
    await act(p, { type: 'lookEnd' }); v = await V(p);
    for (const x of v.p[m].hand.filter(x => x.c === cid)) await force(p, { type: 'move', iids: [x.i], to: { z: 'deck', p: m } });
  };
  const slotOf = async (p, cid, who = 'me') => { const v = await V(p), q = who === 'me' ? v.me : 1 - v.me; return [...v.p[q].bench, v.p[q].active].find(s => s && s.cards[s.cards.length - 1].c === cid); }; // 벤치 먼저
  const clearBench = async (p, keep = []) => { const v = await V(p), m = v.me; for (const sl of v.p[m].bench) if (!keep.includes(sl.sid)) await force(p, { type: 'move', iids: [...sl.cards, ...sl.en, ...sl.tl].map(x => x.i), to: { z: 'discard', p: m } }); await p.waitForTimeout(150); };
  const handOf = async (p, cid) => { const v = await V(p); return v.p[v.me].hand.find(x => x.c === cid); };
  const closeAll = async p => { for (let i = 0; i < 4 && (await p.$('#sheet:not([hidden])') || await p.$('.bpbar')); i++) { await p.evaluate(() => history.back()); await p.waitForTimeout(220); } };
  const shut = async p => { const d = await p.$('.dock [data-dock=shut]'); if (d) { await d.click(); await p.waitForTimeout(150); } };
  const okWarn = async p => { await p.waitForTimeout(350); const s = await p.$('#sheet:not([hidden]) .askr [data-ok]'); if (s && /그대로 진행/.test(await s.textContent())) { await s.click(); await p.waitForTimeout(450); return true; } return false; };
  const playHand = async (p, cid, re = /사용하기|벤치에 내기|진화시키기|붙이기|함께 내기/) => {
    await closeAll(p); await shut(p);
    const x = await handOf(p, cid); if (!x) { errs.push('손패에 없음 ' + cid); return false; }
    await p.click(`[data-hand="${x.i}"]`, { position: { x: 10, y: 14 } }); await p.waitForSelector('#sheet:not([hidden]) .acts button');
    for (const bt of await p.$$('#sheet .acts button')) if (re.test(await bt.textContent())) { await bt.click(); await p.waitForTimeout(400); await okWarn(p); return true; }
    errs.push('단추 없음 ' + cid + ' ' + re); await closeAll(p); return false;
  };
  const slotBtn = async (p, sid, re) => {
    await closeAll(p); await shut(p);
    await p.click(`.mat [data-sid="${sid}"]`); await p.waitForSelector('#sheet:not([hidden]) .in');
    for (const bt of await p.$$('#sheet button')) if (re.test(await bt.textContent())) { await bt.click(); await p.waitForTimeout(400); return true; }
    errs.push('포켓몬 창 단추 없음 ' + re); await closeAll(p); return false;
  };
  const step = async (p, re, wait = 450) => {
    await p.waitForTimeout(300);
    if (await p.$('.dockfab [data-dock=open]')) { await p.click('.dockfab [data-dock=open]'); await p.waitForTimeout(200); }
    for (const bt of await p.$$('.dock [data-fxs]')) if (re.test(await bt.textContent())) { await bt.click(); await p.waitForTimeout(wait); await okWarn(p); return true; }
    const have = await p.$$eval('.dock [data-fxs]', e => e.map(x => x.textContent)); errs.push(`단계 단추 없음 ${re} (있는 것: ${have.join(' / ')})`); return false;
  };
  const stepTexts = p => p.$$eval('.dock [data-fxs]', e => e.map(x => x.textContent));
  const bpick = async (p, sid) => { await p.waitForSelector('.arena.picking .bpbar', { timeout: 4000 }); await p.click(`.mat [data-sid="${sid}"]`); await p.waitForTimeout(450); };
  const bpSids = p => p.$$eval('.mat .spot.bpick', e => e.map(x => x.dataset.sid));
  const logHas = async (p, re) => { const v = await p.evaluate(() => [...document.querySelectorAll('.log .ln')].map(x => x.textContent).join('\n')); return re.test(v); };
  const lines = async (p) => p.evaluate(async g => { const r = await fetch(`/api/games/${g}/at?k=0`); return r.ok; }, gid);
  const lastLog = async (p, n = 6) => { await closeAll(p); await p.click('[data-t=log]'); await p.waitForSelector('.sheet .lgs .log'); const t = await p.$$eval('.sheet .lgs .log .ln', (e, n) => e.slice(-n).map(x => x.textContent.trim()), n); await closeAll(p); return t.join('\n'); };
  // SIZES=1: 그 순간의 화면을 폰~PC 폭과 어두운 모드에서 넘침 검사 + 스크린샷 (끝나면 1280으로 되돌림)
  const sizes = async (p, name) => {
    if (!process.env.SIZES) return;
    for (const dark of [false, true]) {
      await p.evaluate(d => { if (d) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme; }, dark);
      for (const w of [260, 360, 390, 768, 1280]) {
        await p.setViewportSize({ width: w, height: w < 600 ? 760 : 860 }); await p.waitForTimeout(300);
        const o = await p.evaluate(() => {
          const W = document.documentElement.clientWidth, over = [];
          for (const el of document.querySelectorAll('.bpbar, .bpbar *, #sheet .in, #sheet .in *, .dock, .dock *, .ztags, .ztags *')) {
            const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
            if (r.right > W + 1 || r.left < -1) over.push((el.className && el.className.baseVal == null ? el.className : el.tagName) + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
            if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible' && !/zvgrid|zvcats|handbar/.test(el.className)) over.push('scroll:' + el.className);
          }
          return { sw: document.documentElement.scrollWidth, W, over: [...new Set(over)].slice(0, 6) };
        });
        check(o.sw <= o.W && !o.over.length, `[크기] ${name} ${w}px${dark ? ' 어두운' : ''}: 넘침 없음${o.over.length || o.sw > o.W ? ' ' + JSON.stringify(o) : ''}`);
        if (w === 260 || w === 390 || (w === 1280 && dark)) await p.screenshot({ path: OUT + 'size-' + name.replace(/\s/g, '') + '-' + w + (dark ? 'd' : '') + '.png' });
      }
    }
    await p.evaluate(() => delete document.documentElement.dataset.theme);
    await p.setViewportSize({ width: 1280, height: 860 }); await p.waitForTimeout(300);
  };
  // ----- 준비: 서로 배틀 포켓몬 1장 놓고 준비 완료 -----
  for (const p of [A, B]) { const o = await p.$('[data-order="1"]'); if (o) await o.click(); }
  await A.waitForTimeout(300);
  for (const p of [A, B]) {
    const v = await V(p), basic = v.p[v.me].hand.find(x => ['sv5-128', 'sv8pt5-4', 'sv6-95', 'sv6-128', 'sv6pt5-38', 'me3-62', 'me1-104', 'sv6-25'].includes(x.c));
    if (basic) await act(p, { type: 'setupPlace', iid: basic.i, to: 'active' });
    const v2 = await V(p); if (v2.p[v2.me].mull != null) {}
    await act(p, { type: 'mullDraw', n: 0 }).catch(() => {});
    const r = await act(p, { type: 'setupDone' }); if (!r.ok) await act(p, { type: 'setupDone', force: true });
  }
  await A.waitForTimeout(600);
  let v = await V(A); const first = v.current === v.me ? A : B, second = first === A ? B : A;
  log('선공:', first === A ? 'A' : 'B', '차례', v.turn);
  // 3번째 차례까지 넘김 (첫 차례 제한 없이 시험)
  await force(first, { type: 'endTurn' }); await force(second, { type: 'endTurn' });
  await A.waitForTimeout(500);
  v = await V(first); log('지금 차례', v.turn, v.current === v.me ? '선공' : '후공');
  const P = first, O = second; // P가 시험하는 사람, O는 상대
  await P.reload(); await P.waitForSelector('.area.bottom'); await P.evaluate(g => new Promise(res => { const ws = new WebSocket(`ws://${location.host}/ws/game/${g}`); window.T = { ws, view: null, seq: 9000, pend: {} }; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.view) T.view = m.view; if (m.t === 'res' && T.pend[m.id]) { T.pend[m.id](m); delete T.pend[m.id]; } if (m.t === 'full') res(); }; }), gid);
  // 상대 벤치에 포켓몬 2마리 (끌어내기·카운터 나누기 대상)
  await fromDeck(O, 'sv6-128', { z: 'bench' }, 2); await fromDeck(O, 'sv5-128', { z: 'bench' });
  await P.waitForTimeout(400);

  // 1) 릴리에의 결심: 남은 프라이즈 6장 → 8장 뽑기 단추 한 번
  log('1) 릴리에의 결심');
  await fromDeck(P, 'me1-119', { z: 'hand' });
  v = await V(P); const lpz = v.p[v.me].prizesN, lex = lpz === 6 ? 8 : 6; // 릴리에가 프라이즈에 있었으면 꺼내서 5장 → 6장
  await playHand(P, 'me1-119');
  let st = await stepTexts(P); check(st.some(t => new RegExp(`${lex}장 뽑기`).test(t)), `릴리에: 프라이즈 ${lpz}장 → ${lex}장 뽑기 단추 (` + st.join(' / ') + ')');
  await P.screenshot({ path: OUT + '01-lillie.png' }); await sizes(P, '단계단추');
  await step(P, new RegExp(`${lex}장 뽑기`));
  v = await V(P); check(v.p[v.me].hand.length === lex, `릴리에: 손패 ${lex}장 (` + v.p[v.me].hand.length + ')');
  check(!(await stepTexts(P)).length, '릴리에: 단추가 사라짐');
  // 2) 저지맨 (서포트 두 번째 → 경고 넘기고) : 서로 4장
  log('2) 저지맨');
  await fromDeck(P, 'me3-76', { z: 'hand' }); await playHand(P, 'me3-76');
  st = await stepTexts(P); check(st.some(t => /4장 뽑기 · 상대에게 4장 요청/.test(t)), '저지맨 단추 (' + st.join(' / ') + ')');
  const ohn = (await V(P)).p[1 - (await V(P)).me].handN;
  await step(P, /4장/);
  v = await V(P); check(v.p[v.me].hand.length === 4 && v.p[1 - v.me].handN === ohn, `저지맨: 내 손패 4 · 상대 손패는 그대로 (${v.p[v.me].hand.length} / ${v.p[1 - v.me].handN})`);
  check(/손패를 정리하는 중/.test(await P.textContent('.arena').catch(() => '')), '저지맨: 내 쪽엔 상대가 정리하는 중 안내');
  // 상대 화면: 판정 창에 '손패를 덱에 넣고 섞은 뒤 4장 뽑기' 단추 → 누르면 상대 손패 4장
  const oppPress = async (re) => {
    await O.waitForTimeout(400);
    if (await O.$('.dockfab [data-dock=open]')) { await O.click('.dockfab [data-dock=open]'); await O.waitForTimeout(200); }
    const find = async () => { if (await O.$('.dockfab [data-dock=open]')) { await O.click('.dockfab [data-dock=open]'); await O.waitForTimeout(200); } for (const bt of await O.$$('.dock [data-confirm]')) if (re.test(await bt.textContent())) return bt; return null; };
    let bt = await find();
    if (bt) {
      await O.screenshot({ path: OUT + '02-opp-reset.png' });
      if (/4장/.test(re.source)) { await sizes(O, '손패정리요청'); bt = await find(); } // 크기를 바꾸면 다시 그려지므로 다시 찾음
      if (bt) { await bt.click(); await O.waitForTimeout(500); return true; }
    }
    errs.push('상대 화면에 손패 정리 단추 없음 ' + re + ' (' + (await O.$$eval('.dock button', e => e.map(x => x.textContent).join(' / ')).catch(() => '')) + ')'); return false;
  };
  await oppPress(/덱에 넣고 섞은 뒤 4장 뽑기/);
  v = await V(P); check(v.p[1 - v.me].handN === 4 && !v.prompts.some(q => q.type === 'handReset'), '저지맨: 상대가 누르면 상대 손패 4장 (' + v.p[1 - v.me].handN + ')');
  // 3) 스페셜 레드카드: 상대에게 요청 → 상대가 누르면 패를 섞어서 덱 아래로, 3장
  log('3) 레드카드');
  await fromDeck(P, 'me4-82', { z: 'hand' }); await playHand(P, 'me4-82');
  await step(P, /상대에게 요청.*3장/);
  await oppPress(/덱 아래로 넣은 뒤 3장 뽑기/);
  v = await V(P); check(v.p[1 - v.me].handN === 3, '레드카드: 상대 손패 3장 (' + v.p[1 - v.me].handN + ')');
  // 4) 보스의 지령: 상대 벤치가 빛나고 누르면 교체
  log('4) 보스의 지령');
  await fromDeck(P, 'me1-114', { z: 'hand' }); await playHand(P, 'me1-114');
  await P.waitForSelector('.arena.picking', { timeout: 4000 }).catch(() => errs.push('보스: 고르기가 안 열림'));
  v = await V(P); const oppB = v.p[1 - v.me].bench.map(s => s.sid), sel = await bpSids(P);
  check(sel.length === oppB.length && sel.every(s => oppB.includes(s)), '보스: 상대 벤치만 빛남');
  await P.screenshot({ path: OUT + '04-boss.png' }); await sizes(P, '판에서고르기');
  await bpick(P, oppB[0]);
  v = await V(P); check(v.p[1 - v.me].active.sid === oppB[0], '보스: 고른 포켓몬이 배틀로');
  // 5) 에너지 갈아 달기: 에너지 붙은 내 포켓몬 → 다른 포켓몬
  log('5) 에너지 갈아 달기');
  const myAct = (await V(P)).p[(await V(P)).me].active;
  await fromDeck(P, 'sve-1', { z: 'slot', sid: myAct.sid, part: 'en' });
  await fromDeck(P, 'sv5-128', { z: 'bench' });
  const nog = await slotOf(P, 'sv5-128');
  await fromDeck(P, 'me1-115', { z: 'hand' }); await playHand(P, 'me1-115');
  await P.waitForSelector('.arena.picking', { timeout: 4000 }).catch(() => errs.push('갈아 달기: 고르기가 안 열림'));
  check((await bpSids(P)).join() === myAct.sid, '갈아 달기: 에너지 붙은 포켓몬만 빛남 (' + (await bpSids(P)).join() + ')');
  await bpick(P, myAct.sid); await bpick(P, nog.sid);
  check((await slotOf(P, 'sv5-128')).en.length === 1, '갈아 달기: 에너지가 옮겨짐');
  // 6) 밤의 들것: 트래시 창, 맞는 카드만 진하게, 보여주고 손패로
  log('6) 밤의 들것');
  await fromDeck(P, 'sv6-95', { z: 'discard' }); await fromDeck(P, 'me1-125', { z: 'discard' });
  await fromDeck(P, 'sv6pt5-61', { z: 'hand' }); await playHand(P, 'sv6pt5-61');
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 4000 }).catch(() => errs.push('들것: 트래시 창이 안 열림'));
  const dim = await P.$$eval('.sheet .zvsheet .zc', e => e.map(x => x.textContent.trim() + (x.classList.contains('dim') ? '(흐림)' : '')));
  check(dim.some(t => /이상한사탕\(흐림\)/.test(t)) && dim.some(t => /이야후$/.test(t)), '들것: 아이템은 흐리고 포켓몬은 진함 (' + dim.join(', ') + ')');
  const yid = (await V(P)).p[(await V(P)).me].discard.find(x => x.c === 'sv6-95').i;
  await P.click(`.sheet .zvsheet .zc[data-zc="${yid}"] .zsel`); await P.waitForTimeout(150);
  await P.screenshot({ path: OUT + '06-stretcher.png' });
  for (const bt of await P.$$('.sheet .zvbar button')) if (/손패로/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(500);
  check(!!(await handOf(P, 'sv6-95')), '들것: 이야후가 손패로'); check(!(await P.$('#sheet:not([hidden])')), '들것: 끝나면 창이 닫힘');
  // 7) 빛나: 종류마다 1장, 아직 안 고른 종류 표시
  log('7) 빛나');
  await fromDeck(P, 'me2-87', { z: 'hand' }); await playHand(P, 'me2-87');
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 5000 }).catch(() => errs.push('빛나: 덱 창이 안 열림'));
  await P.waitForTimeout(300);
  let dk = (await V(P)).p[(await V(P)).me].deck.cards;
  const pickId = async id => { await P.click(`.sheet .zvsheet .zc[data-zc="${id}"] .zsel`); await P.waitForTimeout(150); };
  const BASICS = ['sv5-128', 'sv8pt5-4', 'sv6-95', 'sv6-128', 'sv6pt5-38', 'me3-62', 'me1-104', 'sv6-25'], b1 = dk.find(x => BASICS.includes(x.c)).i;
  await pickId(b1); await pickId(dk.find(x => x.c === 'sv6-129').i);
  const zvn = await P.textContent('.sheet .zvbar .zvn'); check(/아직 2진화 포켓몬/.test(zvn), '빛나: 남은 종류 표시 (' + zvn + ')');
  await P.screenshot({ path: OUT + '07-cynthia.png' });
  const b2 = dk.find(x => BASICS.includes(x.c) && x.i !== b1).i; await pickId(b2); // 같은 종류(기본 포켓몬) 두 장 → 물어봄
  for (const bt of await P.$$('.sheet .zvbar button')) if (/손패로/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(400);
  const askT = await P.textContent('#sheet:not([hidden]) .in').catch(() => '');
  check(/같은 종류를 더 골랐어요/.test(askT), '빛나: 같은 종류 2장이면 물어봄');
  await P.click('#sheet .askr [data-close]'); await P.waitForTimeout(400);
  check(!!(await P.$('.sheet .zvsheet')), '빛나: 취소하면 덱 창으로 돌아옴');
  await pickId(b2); // 두 번째 기본 포켓몬은 빼고
  for (const bt of await P.$$('.sheet .zvbar button')) if (/손패로/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(700);
  check(!!(await handOf(P, 'sv6-129')), '빛나: 손패로 가져옴');
  await closeAll(P);
  // 8) 이상한사탕: 손패의 2진화만 → 진화할 수 있는 기본 포켓몬이 빛남 (이번 차례에 낸 드라꼰은 경고)
  log('8) 이상한사탕'); await clearBench(P);
  await fromDeck(P, 'sv6-128', { z: 'bench' }); const dre = await slotOf(P, 'sv6-128');
  await fromDeck(P, 'sv6-130', { z: 'hand' }); await fromDeck(P, 'me1-125', { z: 'hand' });
  await playHand(P, 'me1-125');
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 4000 }).catch(() => errs.push('사탕: 손패 창이 안 열림'));
  await P.waitForTimeout(300);
  const shown = await P.$$eval('.sheet .zvsheet .zc small', e => e.map(x => x.textContent));
  if (!shown.length) { log('  [디버그]', await P.textContent('.sheet .zvsheet .zvh').catch(() => '?'), '|', (await P.innerHTML('.sheet .zvsheet .zvgrid').catch(() => '?')).slice(0, 300), '| 손패', JSON.stringify((await V(P)).p[(await V(P)).me].hand.map(x => x.c))); await P.screenshot({ path: OUT + '08-debug.png' }); }
  check(shown.length >= 1 && shown.every(t => /드래펄트/.test(t)), '사탕: 2진화만 보임 (' + shown.join(', ') + ')');
  await P.click('.sheet .zvsheet .zc .zsel'); await P.waitForTimeout(150);
  for (const bt of await P.$$('.sheet .zvbar button')) if (/기본 포켓몬에 올려 진화/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForSelector('.arena.picking', { timeout: 4000 }).catch(() => errs.push('사탕: 판 고르기가 안 열림'));
  { const bs = await bpSids(P), vv = await V(P), ok = [vv.p[vv.me].active, ...vv.p[vv.me].bench].filter(s => s && s.cards.length === 1 && s.cards[0].c === 'sv6-128').map(s => s.sid);
    check(bs.includes(dre.sid) && bs.every(s => ok.includes(s)), '사탕: 드라꼰만 빛남 (' + bs.join() + ')'); }
  await P.screenshot({ path: OUT + '08-candy.png' });
  await bpick(P, dre.sid);
  const cw = await P.textContent('#sheet:not([hidden]) .in').catch(() => '');
  check(/이번 차례에 나왔거나/.test(cw), '사탕: 이번 차례에 낸 포켓몬이면 경고');
  await okWarn(P);
  check(!!(await slotOf(P, 'sv6-130')), '사탕: 드래펄트 ex로 진화');
  // 9) 위험한 폐허 + 절친 포핀: 덱에서 벤치로 낸 기본 포켓몬에게 카운터를 올릴지 단추
  log('9) 위험한 폐허 + 절친 포핀'); await clearBench(P);
  await fromDeck(P, 'me1-127', { z: 'hand' }); await playHand(P, 'me1-127');
  await closeAll(P);
  await fromDeck(P, 'sv5-144', { z: 'hand' }); await playHand(P, 'sv5-144');
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 5000 }).catch(() => errs.push('포핀: 덱 창이 안 열림'));
  dk = (await V(P)).p[(await V(P)).me].deck.cards;
  const ky = dk.find(x => x.c === 'sv8pt5-4'); if (ky) await pickId(ky.i);
  for (const bt of await P.$$('.sheet .zvbar button')) if (/벤치에 내기/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(700); await closeAll(P);
  st = await stepTexts(P); check(st.some(t => /카운터 2개 올리기/.test(t)), '폐허: 카운터 단추 (' + st.join(' / ') + ')');
  await P.screenshot({ path: OUT + '09-ruins.png' });
  await step(P, /카운터 2개/);
  check((await slotOf(P, 'sv8pt5-4')).dmg === 20, '폐허: 꼬몽울 데미지 20');
  // 15) 이야후 아드레나 브레인: 가져올 포켓몬 → 올릴 포켓몬 → 개수
  log('15) 이야후');
  await fromDeck(P, 'sv6-95', { z: 'bench' }); const ya = await slotOf(P, 'sv6-95');
  await slotBtn(P, ya.sid, /아드레나 브레인/);
  const yw = await P.textContent('#sheet:not([hidden]) .in').catch(() => ''); check(/\(악\) 에너지가 붙어 있지 않아요/.test(yw), '이야후: 악 에너지 경고');
  await okWarn(P);
  await P.waitForSelector('.arena.picking', { timeout: 4000 }).catch(() => errs.push('이야후: 고르기가 안 열림'));
  const kyo = await slotOf(P, 'sv8pt5-4'); check((await bpSids(P)).join() === kyo.sid, '이야후: 카운터 있는 포켓몬만 빛남');
  await bpick(P, kyo.sid);
  v = await V(P); const oAct = v.p[1 - v.me].active.sid; await bpick(P, oAct);
  await P.waitForSelector('#sheet:not([hidden]) .picksheet', { timeout: 3000 }).catch(() => {});
  for (const bt of await P.$$('#sheet .acts button')) if (/2개/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(600);
  v = await V(P); check(v.p[1 - v.me].active.dmg === 20 && (await slotOf(P, 'sv8pt5-4')).dmg === 0, '이야후: 카운터 2개 옮김');
  // 10) 나옹 ex: 손패에서 벤치로 내면 '특성 쓰기' → 덱에서 서포트
  log('10) 나옹 ex'); await clearBench(P);
  await closeAll(P);
  await fromDeck(P, 'me3-62', { z: 'hand' }); await playHand(P, 'me3-62', /벤치에 내기/);
  st = await stepTexts(P); check(st.some(t => /특성 쓰기/.test(t)), '나옹: 특성 쓰기 단추 (' + st.join(' / ') + ')');
  check(st.some(t => /카운터 2개/.test(t)), '나옹: 폐허 카운터 단추도');
  await step(P, /특성 쓰기/, 900);
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 5000 }).catch(() => errs.push('나옹: 덱 창이 안 열림'));
  const fxl = await P.textContent('.sheet .zvsheet .zvfx').catch(() => ''); check(/서포트/.test(fxl), '나옹: 서포트 찾기 도우미 (' + fxl + ')');
  await closeAll(P); await act(P, { type: 'shuffle', p: await me(P) });
  // 11) 기로치 ex 역이용: 기절 기록이 없으면 경고 → 3장 뽑기 단추
  log('11) 기로치 ex 역이용'); await clearBench(P);
  await fromDeck(P, 'sv6pt5-38', { z: 'bench' }); const fez = await slotOf(P, 'sv6pt5-38');
  await slotBtn(P, fez.sid, /역이용/);
  const fw = await P.textContent('#sheet:not([hidden]) .in').catch(() => ''); check(/기절하지 않았어요/.test(fw), '역이용: 기절 기록 경고');
  await okWarn(P);
  let h0 = (await V(P)).p[(await V(P)).me].hand.length;
  await step(P, /3장 뽑기/);
  check((await V(P)).p[(await V(P)).me].hand.length === h0 + 3, '역이용: 3장 뽑음');
  // 12) 메가캥카 ex: 벤치에서 쓰면 경고, 2장 뽑기
  log('12) 메가캥카 ex'); await clearBench(P);
  await fromDeck(P, 'me1-104', { z: 'bench' }); const kan = await slotOf(P, 'me1-104');
  await slotBtn(P, kan.sid, /심부름 대시/);
  const kw = await P.textContent('#sheet:not([hidden]) .in').catch(() => ''); check(/배틀필드에 있을 때만/.test(kw), '심부름 대시: 벤치 경고');
  await okWarn(P); h0 = (await V(P)).p[(await V(P)).me].hand.length;
  await step(P, /2장 뽑기/); check((await V(P)).p[(await V(P)).me].hand.length === h0 + 2, '심부름 대시: 2장 뽑음');
  // 13) 오거폰 ex 벽록의 춤: 손패의 기본 풀 에너지가 진하게 → 붙이고 바로 1장
  log('13) 오거폰 ex'); await clearBench(P);
  await fromDeck(P, 'sv6-25', { z: 'bench' }); const og = await slotOf(P, 'sv6-25');
  await fromDeck(P, 'sve-1', { z: 'hand' });
  h0 = (await V(P)).p[(await V(P)).me].hand.length;
  await slotBtn(P, og.sid, /벽록의 춤/); await okWarn(P);
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 4000 }).catch(() => errs.push('오거폰: 손패 창이 안 열림'));
  const gE = (await V(P)).p[(await V(P)).me].hand.find(x => x.c === 'sve-1');
  const gcls = await P.$eval(`.sheet .zvsheet .zc[data-zc="${gE.i}"]`, e => e.className);
  check(!/dim/.test(gcls), '오거폰: 풀 에너지는 진함');
  await P.click(`.sheet .zvsheet .zc[data-zc="${gE.i}"] .zsel`); await P.waitForTimeout(150);
  await P.screenshot({ path: OUT + '13-ogerpon.png' });
  for (const bt of await P.$$('.sheet .zvbar button')) if (/이 포켓몬에게 붙이기/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(900);
  check((await slotOf(P, 'sv6-25')).en.length === 1, '오거폰: 에너지 붙음');
  check((await V(P)).p[(await V(P)).me].hand.length === h0, '오거폰: 붙인 뒤 1장 뽑음 (손패 수 그대로)');
  // 14) 노고고치 도주 드로: 3장 뽑고 덱에 넣고 섞기 한 번에
  log('14) 노고고치'); await clearBench(P);
  await fromDeck(P, 'sv5-128', { z: 'bench' }); const nog2 = await slotOf(P, 'sv5-128');
  await fromDeck(P, 'sv5-129', { z: 'slot', sid: nog2.sid, part: 'cards' });
  h0 = (await V(P)).p[(await V(P)).me].hand.length;
  await slotBtn(P, nog2.sid, /도주 드로/); await okWarn(P);
  st = await stepTexts(P); check(st.some(t => /3장 뽑고 노고고치 덱에 넣고 섞기/.test(t)), '노고고치: 한 번에 단추 (' + st.join(' / ') + ')');
  await step(P, /3장 뽑고/, 900);
  check((await V(P)).p[(await V(P)).me].hand.length === h0 + 3 && !(await slotOf(P, 'sv5-129')), '노고고치: 3장 뽑고 덱으로');
  // 16) 용암동굴: 진화 포켓몬 특성 단추에 '용암동굴로 없어짐'
  log('16) 용암동굴'); await clearBench(P);
  await fromDeck(P, 'me6-94', { z: 'hand' }); await fromDeck(P, 'me6-95', { z: 'hand' }); await playHand(P, 'me6-94', /함께 내기/);
  await closeAll(P);
  await fromDeck(P, 'sv5-128', { z: 'bench' }); const n2 = (await V(P)).p[(await V(P)).me].bench.filter(s => s.cards[s.cards.length - 1].c === 'sv5-128').pop();
  await fromDeck(P, 'sv5-129', { z: 'slot', sid: n2.sid, part: 'cards' });
  await closeAll(P); await shut(P); await P.click(`.mat [data-sid="${n2.sid}"]`); await P.waitForSelector('#sheet:not([hidden]) .in');
  const abT = await P.textContent('#sheet .acts'); check(/용암동굴로 없어짐/.test(abT), '용암동굴: 없어짐 표시 (' + abT.slice(0, 80) + ')');
  await P.screenshot({ path: OUT + '16-pyro.png' });
  for (const bt of await P.$$('#sheet button')) if (/도주 드로/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(500);
  const pw = await P.textContent('#sheet:not([hidden]) .in').catch(() => ''); check(/용암동굴」 때문에/.test(pw), '용암동굴: 누르면 경고');
  await closeAll(P);
  // 17) 위대한 거목: 스타디움 창 → 기본 포켓몬 → 덱에서 1진화(빛남) → 2진화 → 섞기 (지난 차례에 낸 드라꼰)
  log('17) 위대한 거목'); await clearBench(P);
  await fromDeck(P, 'sv7-136', { z: 'hand' }); await playHand(P, 'sv7-136');
  await closeAll(P);
  { const hd = await handOf(P, 'sv6-128'); if (hd) await force(P, { type: 'bench', iid: hd.i }); else await fromDeck(P, 'sv6-128', { z: 'bench' }); } // 지난 차례에 낸 드라꼰
  await force(P, { type: 'endTurn' }); await force(O, { type: 'endTurn' }); await P.waitForTimeout(500);
  await ensureDeck(P, 'sv6-129'); await ensureDeck(P, 'sv6-130');
  const dre2 = (await V(P)).p[(await V(P)).me].bench.find(s => s.cards.length === 1 && s.cards[0].c === 'sv6-128');
  await closeAll(P); await shut(P);
  await P.click('.stadium[data-stadium]'); await P.waitForSelector('#sheet:not([hidden]) [data-su]');
  check(/위대한 거목 쓰기/.test(await P.textContent('#sheet [data-su]')), '거목: 쓰기 단추');
  await P.click('#sheet [data-su]'); await P.waitForTimeout(500); await okWarn(P);
  await P.waitForSelector('.arena.picking', { timeout: 4000 }).catch(() => errs.push('거목: 고르기가 안 열림'));
  await bpick(P, dre2.sid); await P.waitForTimeout(700);
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 5000 }).catch(() => errs.push('거목: 덱 창이 안 열림'));
  dk = (await V(P)).p[(await V(P)).me].deck.cards;
  const s1 = dk.find(x => x.c === 'sv6-129'), s1cls = s1 && await P.$eval(`.sheet .zvsheet .zc[data-zc="${s1.i}"]`, e => e.className);
  const n1 = dk.find(x => x.c === 'sv5-129'), n1cls = n1 && await P.$eval(`.sheet .zvsheet .zc[data-zc="${n1.i}"]`, e => e.className);
  check(s1 && !/dim/.test(s1cls) && (!n1 || /dim/.test(n1cls)), '거목: 드래런치만 진함 (노고고치는 흐림)');
  await P.screenshot({ path: OUT + '17-tree1.png' });
  await pickId(s1.i);
  for (const bt of await P.$$('.sheet .zvbar button')) if (/올려서 진화/.test(await bt.textContent())) { await bt.click(); break; }
  await P.waitForTimeout(900); await okWarn(P);
  check((await V(P)).p[(await V(P)).me].bench.some(s => s.sid === dre2.sid && s.cards.length === 2), '거목: 드래런치로 진화');
  await P.waitForSelector('.sheet .zvsheet .zvfx', { timeout: 4000 }).catch(() => errs.push('거목: 2진화 창이 안 열림'));
  const fx2 = await P.textContent('.sheet .zvsheet .zvfx').catch(() => ''); check(/2진화/.test(fx2), '거목: 이어서 2진화 (' + fx2 + ')');
  dk = (await V(P)).p[(await V(P)).me].deck.cards; const s2 = dk.find(x => x.c === 'sv6-130');
  if (s2) { await pickId(s2.i); for (const bt of await P.$$('.sheet .zvbar button')) if (/올려서 진화/.test(await bt.textContent())) { await bt.click(); break; } await P.waitForTimeout(900); await okWarn(P); }
  v = await V(P); check(v.p[v.me].bench.some(s => s.sid === dre2.sid && s.cards.length === 3) && !v.p[v.me].look, '거목: 드래펄트 ex까지 진화하고 덱 섞음');
  check(!/이번 차례에 나왔거나/.test(await lastLog(P, 8)), '거목: 2진화는 이어서라 경고 없음');
  // 18) 드래펄트 ex 스펙터다이브: 카운터 6개 나누기 (배틀 포켓몬을 드래펄트로)
  log('18) 스펙터다이브');
  const pult = (await V(P)).p[(await V(P)).me].bench.find(s => s.sid === dre2.sid);
  await force(P, { type: 'switch', sid: pult.sid }); await closeAll(P);
  await slotBtn(P, pult.sid, /스펙터다이브/);
  await P.waitForSelector('#sheet:not([hidden]) .askr [data-ok]'); await P.click('#sheet .askr [data-ok]'); await P.waitForTimeout(500); // 기술 쓰기
  await okWarn(P);
  await P.waitForSelector('#sheet:not([hidden]) .sprows', { timeout: 4000 }).catch(() => errs.push('스펙터다이브: 나누기 창이 안 열림'));
  check(await P.$eval('#sheet [data-ok]', e => e.disabled), '스펙터다이브: 6개를 다 나누기 전엔 단추가 꺼짐');
  const ups = await P.$$('#sheet .sprow');
  for (let k = 0; k < 4; k++) await (await ups[0].$$('.stp'))[1].click();
  for (let k = 0; k < 2; k++) await (await ups[1].$$('.stp'))[1].click();
  await P.screenshot({ path: OUT + '18-spread.png' }); await sizes(P, '카운터나누기');
  check(!(await P.$eval('#sheet [data-ok]', e => e.disabled)), '스펙터다이브: 6개면 단추가 켜짐');
  check(await (await ups[0].$$('.stp'))[1].isDisabled(), '스펙터다이브: 다 나누면 ▲ 꺼짐');
  await P.click('#sheet [data-ok]'); await P.waitForTimeout(600); await okWarn(P);
  v = await V(P); const ob = v.p[1 - v.me].bench.map(s => s.dmg); check(ob.includes(40) && ob.includes(20), '스펙터다이브: 벤치에 40·20 (' + ob.join(',') + ')');
  // 19) 기로치 ex 크루얼애로: 맞을 포켓몬을 판에서 고름 → 벤치 100 (약점 없음)
  log('19) 크루얼애로'); await clearBench(P);
  await fromDeck(P, 'sv6pt5-38', { z: 'bench' }); const fez2 = await slotOf(P, 'sv6pt5-38'); await force(P, { type: 'switch', sid: fez2.sid }); await closeAll(P);
  await slotBtn(P, fez2.sid, /크루얼애로/);
  await P.waitForSelector('.arena.picking', { timeout: 4000 }).catch(() => errs.push('크루얼애로: 고르기가 안 열림'));
  v = await V(P); const tb = v.p[1 - v.me].bench[v.p[1 - v.me].bench.length - 1]; await bpick(P, tb.sid);
  await P.waitForSelector('#sheet:not([hidden]) .askr', { timeout: 3000 });
  const cd = await P.textContent('#sheet .in'); check(/사이트 계산: 100/.test(cd) && /벤치: 약점·저항력 없음/.test(cd), '크루얼애로: 100 (벤치 계산)');
  await P.screenshot({ path: OUT + '19-cruel.png' });
  await P.click('#sheet .askr [data-ok]'); await P.waitForTimeout(500); await okWarn(P);
  v = await V(P); check(v.p[1 - v.me].bench.find(s => s.sid === tb.sid)?.dmg === tb.dmg + 100 || !v.p[1 - v.me].bench.find(s => s.sid === tb.sid), '크루얼애로: 고른 벤치에 100');
  // 20) 메가캥카 기관총콤보: 사이트가 동전
  log('20) 기관총콤보'); await clearBench(P);
  await fromDeck(P, 'me1-104', { z: 'bench' }); const kan2 = await slotOf(P, 'me1-104'); await force(P, { type: 'switch', sid: kan2.sid }); await closeAll(P);
  await slotBtn(P, kan2.sid, /기관총콤보/);
  await P.waitForSelector('#sheet:not([hidden]) .fxcoin', { timeout: 3000 }).catch(() => errs.push('기관총콤보: 동전 창이 안 열림'));
  await P.screenshot({ path: OUT + '20-coin.png' }); await sizes(P, '동전기술');
  await P.click('#sheet .askr [data-ok]'); await P.waitForTimeout(600); await okWarn(P);
  check(/코인 \d+번 — .*기관총콤보/.test(await lastLog(P, 6)), '기관총콤보: 동전 기록');
  // 21) 꼬몽울 근질근질 꽃가루 → 상대에게 '아이템 금지' 배지, 상대가 아이템을 쓰면 경고
  log('21) 꼬몽울'); await clearBench(P);
  await fromDeck(P, 'sv8pt5-4', { z: 'bench' }); const kyo2 = await slotOf(P, 'sv8pt5-4'); await force(P, { type: 'switch', sid: kyo2.sid }); await closeAll(P);
  await slotBtn(P, kyo2.sid, /근질근질/);
  await P.waitForSelector('#sheet:not([hidden]) .askr [data-ok]'); check(/사이트가 처리: .*아이템 금지/.test(await P.textContent('#sheet .in')), '꼬몽울: 사이트가 처리 안내');
  await P.click('#sheet .askr [data-ok]'); await P.waitForTimeout(500); await okWarn(P);
  await P.waitForTimeout(300);
  check(/아이템 금지/.test(await P.textContent('.area.top .ztags')), '꼬몽울: 상대 판에 아이템 금지 배지');
  await force(P, { type: 'endTurn' }); await O.waitForTimeout(500);
  check(/아이템 금지/.test(await O.textContent('.area.bottom .ztags')), '꼬몽울: 상대 차례에도 배지');
  for (let i = 0; i < 4 && await O.$('.revok'); i++) { await O.click('.revok'); await O.waitForTimeout(250); } // 보여준 카드 창 닫기
  await O.screenshot({ path: OUT + '21-lock.png' }); await sizes(O, '아이템금지');
  await fromDeck(O, 'me1-125', { z: 'hand' }); const oc = await handOf(O, 'me1-125');
  const lr = await act(O, { type: 'play', iid: oc.i }); check(lr.warn && lr.warn.some(w => /근질근질 꽃가루/.test(w)), '꼬몽울: 아이템 쓰면 경고');
  await force(O, { type: 'endTurn' }); await P.waitForTimeout(500);
  check(!/아이템 금지/.test(await P.textContent('.area.top .ztags')), '꼬몽울: 그다음 차례엔 배지 없음');
  // 22) 나옹 ex 꽁무니빼기: 한 번에 손패로
  log('22) 꽁무니빼기'); await clearBench(P);
  await fromDeck(P, 'me3-62', { z: 'bench' }); const mw = await slotOf(P, 'me3-62');
  await force(P, { type: 'switch', sid: mw.sid }); await closeAll(P);
  await slotBtn(P, mw.sid, /꽁무니빼기/); await P.waitForSelector('#sheet:not([hidden]) .askr [data-ok]'); await P.click('#sheet .askr [data-ok]'); await P.waitForTimeout(500); await okWarn(P);
  st = await stepTexts(P); check(st.some(t => /나옹 ex 손패로 되돌리기/.test(t)), '꽁무니빼기 단추 (' + st.join(' / ') + ')');
  await step(P, /손패로 되돌리기/);
  check(!!(await handOf(P, 'me3-62')) && !(await V(P)).p[(await V(P)).me].active, '꽁무니빼기: 손패로, 새 배틀 포켓몬 고르기');
  // 23) 배틀 콜로세움: 상대 벤치에 카운터 올리면 경고 (판정 창 단추로 처리하는 스펙터다이브는 다음 판에서) — 엔진 시험이 맡음
  log('콘솔·화면 오류:', errs.filter(e => /console|: /.test(e)).length);
  await b.close();
  log(errs.length ? `\n실패 ${errs.length}개:\n- ` + errs.join('\n- ') : '\n모두 통과');
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
