// 카드 효과 도우미 시험: 덱 창 여러 장 고르기·이름 찾기·보여주고 손패로·위에서 N장·시아노·하이퍼볼(비용)·메가레쿠쟈 ex 특성·특성 사용 표시
// 준비(가입·덱·방)는 API로, 대전은 화면으로. BASE=http://127.0.0.1:8787 node test/fx-e2e.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const OUT = __dirname + '/out/fx-'; require('fs').mkdirSync(__dirname + '/out', { recursive: true });
const LIST = [['sv8-170', 4], ['me1-131', 4], ['me6-84', 4], ['sv8-57', 4], ['zsv10pt5-84', 4], ['sv5-144', 4], ['sv5-153', 1], ['sve-4', 18], ['sve-2', 17]].map(([id, n]) => ({ id, n }));
const errs = [], log = (...a) => console.log(...a);
const svgFor = u => { let h = 0; for (const ch of u) h = (h * 31 + ch.charCodeAt(0)) % 360; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="3" fill="#f5d142"/><rect x="3" y="3" width="57" height="82" rx="2" fill="hsl(${h},55%,62%)"/><circle cx="31" cy="29" r="11" fill="hsl(${(h + 180) % 360},50%,45%)"/></svg>`; };
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
    const r = await p.evaluate(async ([n]) => { const f = await fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, pw: 'test1234', code: 'doran' }) }); return f.status; }, [name]);
    if (r !== 200) errs.push(name + ' 가입 ' + r);
    return p;
  };
  const api = (p, path, body) => p.evaluate(async ([path, body]) => (await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json(), [path, body]);
  const A = await mk('가' + tag, 390, 844), B = await mk('나' + tag, 1280, 860);
  const dA = await api(A, '/api/decks', { name: '시험덱', list: LIST }), dB = await api(B, '/api/decks', { name: '시험덱', list: LIST });
  if (!dA.check?.ok) errs.push('덱 규칙: ' + JSON.stringify(dA.check?.problems));
  const room = await api(A, '/api/rooms', { mode: 'live', deckId: dA.deck.id });
  const j = await api(B, `/api/rooms/${room.room.id}/join`, { deckId: dB.deck.id });
  const url = BASE + '/#game/' + j.room.games[j.room.games.length - 1];
  for (const p of [A, B]) { await p.goto(url); await p.waitForSelector('.area.bottom'); }
  // 준비
  for (const p of [A, B]) { const o = await p.$('[data-order="1"]'); if (o) await o.click(); }
  await A.waitForTimeout(300);
  for (const p of [A, B]) {
    for (const h of await p.$$('[data-hand]')) {
      await h.click({ position: { x: 8, y: 12 } }); await p.waitForSelector('.sheet .in');
      const bt = await p.$('.sheet .acts button');
      if (bt && /배틀/.test(await bt.textContent())) { await bt.click(); await p.waitForTimeout(250); break; }
      await p.click('.sheet [data-close]'); await p.waitForTimeout(80);
    }
    const ms = await p.$$('[data-mull]'); if (ms.length) { await ms[ms.length - 1].click(); await p.waitForTimeout(200); }
    await p.click('[data-t=setupDone]'); await p.waitForTimeout(300);
    const warn = await p.$('.sheet [data-ok]'); if (warn) { await warn.click(); await p.waitForTimeout(300); }
  }
  await A.waitForSelector('.ztag.turn'); await A.waitForTimeout(400);
  const cur = (await A.$('.area.bottom.now')) ? A : B, oth = cur === A ? B : A;
  log('차례:', cur === A ? 'A(폰)' : 'B(PC)');
  const closeAll = async p => { for (let i = 0; i < 3 && await p.$('#sheet:not([hidden])'); i++) { await p.evaluate(() => history.back()); await p.waitForTimeout(250); } };
  const openDeck = async (p, how) => { await closeAll(p); await p.click('.area.bottom [data-deck]'); await p.waitForSelector('.sheet .acts button'); const bs = await p.$$('.sheet .acts button'); for (const bt of bs) if ((await bt.textContent()).includes(how)) { await bt.click(); break; } };
  const zv = '.sheet .zvsheet';
  const selByName = async (p, re, n = 1) => { let k = 0; const ids = await p.$$eval(`${zv} .zc:not(.on)`, e => e.map(x => [x.dataset.zc, x.textContent])); for (const [id, t] of ids) { if (k >= n) break; if (re.test(t)) { await p.click(`${zv} .zc[data-zc="${id}"] .zsel`); k++; await p.waitForTimeout(120); } } return k; };
  const barBtn = async (p, re) => { for (const bt of await p.$$(`${zv} .zvbar button`)) if (re.test(await bt.textContent())) return bt; return null; };
  const logText = async p => { await closeAll(p); await p.click('[data-t=log]'); await p.waitForSelector('.sheet .lgs .log'); const t = await p.textContent('.sheet .lgs .log'); await closeAll(p); return t; };
  // 1) 덱 전체 보기 + 이름 찾기(초성) + 고르기 + 손패로 (옮긴 뒤 덱 섞기 기본 켜짐)
  await openDeck(cur, '덱 전체 보기'); await cur.waitForSelector(zv + ' .zvq input');
  await cur.fill(zv + ' .zvq input', 'ㅅㅇㄴ'); await cur.waitForTimeout(200);
  let names = await cur.$$eval(zv + ' .zc small', e => e.map(x => x.textContent));
  if (!names.length || !names.every(n => /시아노/.test(n))) errs.push('덱 창 초성 찾기 실패: ' + names.join(','));
  await cur.fill(zv + ' .zvq input', 'tldksh'); await cur.waitForTimeout(200);
  names = await cur.$$eval(zv + ' .zc small', e => e.map(x => x.textContent)); if (!names.length || !names.every(n => /시아노/.test(n))) errs.push('덱 창 영문 자판 찾기 실패: ' + names.join(','));
  await cur.fill(zv + ' .zvq input', ''); await cur.waitForTimeout(150);
  const catTxt = await cur.$$eval(zv + ' .zvcat', e => e.map(x => x.textContent.trim())); log('분류:', catTxt.join(' / '));
  await cur.click(zv + ' .zvcat[data-cat=sp]'); await cur.waitForTimeout(150);
  names = await cur.$$eval(zv + ' .zc small', e => e.map(x => x.textContent)); if (!names.length || !names.every(n => /시아노/.test(n))) errs.push('분류 서포트: ' + names.join(','));
  await cur.click(zv + ' .zvcat[data-cat=eb]'); await cur.waitForTimeout(150);
  names = await cur.$$eval(zv + ' .zc small', e => e.map(x => x.textContent)); if (!names.length || !names.every(n => /에너지/.test(n))) errs.push('분류 기본 에너지: ' + names.slice(0, 3).join(','));
  await cur.screenshot({ path: OUT + '0-filter.png' });
  await cur.click(zv + ' .zvcat[data-cat=""]'); await cur.waitForTimeout(150);
  await cur.fill(zv + ' .zvq input', 'ㅎㅇㅍ'); await cur.waitForTimeout(150); // 하이퍼볼
  await selByName(cur, /하이퍼볼/); await cur.fill(zv + ' .zvq input', 'ㅅㅇㄴ'); await cur.waitForTimeout(150); await selByName(cur, /시아노/);
  await cur.screenshot({ path: OUT + '1-select.png' });
  if ((await cur.textContent(zv + ' .zvn')).replace(/\s/g, '') !== '고른카드2장') errs.push('고른 장수 표시: ' + await cur.textContent(zv + ' .zvn'));
  await (await barBtn(cur, /^손패로$/)).click(); await cur.waitForTimeout(600);
  if (await cur.$(zv)) errs.push('옮긴 뒤 덱 섞기로 창이 닫혀야 함');
  let lt = await logText(cur); if (!/덱에서 2장을 손패로/.test(lt) || !/자기 덱을 섞었어요/.test(lt)) errs.push('손패로+섞기 기록: ' + lt.slice(-120));
  // 2) 시아노: 쓰면 덱이 열리고 「포켓몬 ex」만 진하게
  const handCard = async (p, re) => { for (const h of await p.$$('[data-hand]')) if (re.test(await h.innerHTML())) return h; return null; };
  await (await handCard(cur, /시아노/)).click({ position: { x: 8, y: 12 } }); await cur.waitForSelector('.sheet .acts button.primary');
  await cur.click('.sheet .acts button.primary'); await cur.waitForTimeout(400);
  const w1 = await cur.$('.sheet [data-ok]'); if (w1) { await w1.click(); await cur.waitForTimeout(500); } // 선공 첫 차례 서포트 경고
  await cur.waitForSelector(zv + ' .zvfx', { timeout: 5000 }).catch(() => errs.push('시아노 도우미가 안 열림'));
  const fxt = await cur.textContent(zv + ' .zvfx').catch(() => ''); log('도우미:', fxt.trim());
  if (!/포켓몬 ex/.test(fxt)) errs.push('시아노 도우미 글: ' + fxt);
  const dimN = (await cur.$$(zv + ' .zc.dim')).length, allN = (await cur.$$(zv + ' .zc')).length; log('흐린 카드', dimN, '/', allN);
  if (!dimN || dimN === allN) errs.push('시아노: 맞는 카드만 진하게가 안 됨');
  await cur.screenshot({ path: OUT + '2-cyrano.png' });
  await cur.click(zv + ' .zvonly'); await cur.waitForTimeout(150);
  if ((await cur.$$(zv + ' .zc.dim')).length) errs.push('맞는 카드만 보기에 흐린 카드가 남음');
  const exN = await selByName(cur, /ex/, 2);
  await (await barBtn(cur, /보여주고 손패로/)).click(); await cur.waitForTimeout(700);
  await oth.waitForSelector('.revlayer', { timeout: 4000 }).catch(() => errs.push('상대 화면에 보여준 카드가 안 뜸'));
  const revN = (await oth.$$('.revlayer .revc')).length; if (revN !== exN) errs.push(`보여준 카드 수 ${revN} != ${exN}`);
  await oth.screenshot({ path: OUT + '3-reveal-opp.png' });
  await oth.click('.revlayer .revok'); await oth.waitForTimeout(300); if (await oth.$('.revlayer')) errs.push('보여준 카드 창이 안 닫힘');
  lt = await logText(cur); if (!/보여주고 손패로/.test(lt)) errs.push('보여주고 손패로 기록 없음');
  await cur.click('[data-t=log]'); await cur.waitForSelector('.sheet .lgs .log'); if (!(await cur.$$('.sheet .lgs .lsc')).length) errs.push('기록에 보여준 카드 그림 없음'); await cur.screenshot({ path: OUT + '4-log.png' }); await closeAll(cur);
  // 3) 하이퍼볼: 손패 2장 트래시 → 덱에서 포켓몬
  await (await handCard(cur, /하이퍼볼/)).click({ position: { x: 8, y: 12 } }); await cur.waitForSelector('.sheet .acts button.primary'); await cur.click('.sheet .acts button.primary');
  await cur.waitForSelector(zv + ' .zvfx', { timeout: 5000 }).catch(() => errs.push('하이퍼볼 비용 창이 안 열림'));
  if (!/트래시/.test(await cur.textContent(zv + ' .zvfx').catch(() => ''))) errs.push('하이퍼볼 비용 안내 없음');
  const hs = await cur.$$(zv + ' .zc .zsel'); for (const h of hs.slice(0, 2)) { await h.click(); await cur.waitForTimeout(100); }
  await cur.screenshot({ path: OUT + '5-cost.png' });
  await (await barBtn(cur, /트래시로/)).click(); await cur.waitForTimeout(900);
  const fx2 = await cur.textContent(zv + ' .zvfx').catch(() => ''); if (!/포켓몬 1장/.test(fx2)) errs.push('하이퍼볼 다음 단계(덱 찾기) 안 열림: ' + fx2);
  await selByName(cur, /피카츄 ex|메가레쿠쟈/, 1); await (await barBtn(cur, /보여주고 손패로/)).click(); await cur.waitForTimeout(600);
  // 4) 위에서 N장 보기: 한 장 옮겨도 새 카드가 안 채워짐 + 남은 카드 덱 맨 아래로
  await openDeck(cur, '위에서 몇 장'); await cur.waitForSelector('.sheet [name=n]', { state: 'attached' });
  await cur.evaluate(() => { const i = document.querySelector('.sheet [name=n]'); i.value = 4; }); await cur.click('.sheet [data-ok]');
  await cur.waitForSelector(zv + ' .zc'); await cur.waitForTimeout(300);
  const top0 = await cur.$$eval(zv + ' .zc', e => e.map(x => x.dataset.zc));
  await (await cur.$(zv + ' .zc .zsel')).click(); await (await barBtn(cur, /^손패로$/)).click(); await cur.waitForTimeout(600);
  const top1 = await cur.$$eval(zv + ' .zc', e => e.map(x => x.dataset.zc));
  if (top1.length !== 3 || top1.some(i => !top0.includes(i))) errs.push(`위에서 4장: 한 장 옮긴 뒤 ${top1.length}장 (새 카드 섞임?)`);
  await cur.screenshot({ path: OUT + '6-top-rest.png' });
  await (await cur.$(`${zv} [data-zr=bottom]`)).click(); await cur.waitForTimeout(600);
  if (await cur.$(zv)) errs.push('남은 카드 덱 아래로 뒤에 창이 남음');
  // 5) 메가레쿠쟈 ex: 덱에서 벤치로 → 특성 → 위에서 4장 + 기본 에너지 붙이기 + 나머지 섞어서 아래로, 특성 사용 표시
  await openDeck(cur, '덱 전체 보기'); await cur.waitForSelector(zv + ' .zvq input'); await cur.fill(zv + ' .zvq input', 'ㅁㄱㄹ'); await cur.waitForTimeout(150);
  if (await selByName(cur, /메가레쿠쟈/, 1)) {
    await (await barBtn(cur, /다른 곳으로/)).click(); await cur.waitForSelector('.sheet .acts button');
    for (const bt of await cur.$$('.sheet .acts button')) if (/벤치에 내기/.test(await bt.textContent())) { await bt.click(); break; }
    await cur.waitForTimeout(700); await closeAll(cur);
    const sl = (await cur.$$('.area.bottom .g-bench [data-sid]')).pop(); await sl.click(); await cur.waitForSelector('.sheet .acts button.blue');
    await cur.click('.sheet .acts button.blue'); await cur.waitForTimeout(800);
    await cur.waitForSelector(zv + ' .zvfx', { timeout: 5000 }).catch(() => errs.push('메가레쿠쟈 도우미 안 열림'));
    log('레쿠쟈 도우미:', (await cur.textContent(zv + ' .zvfx').catch(() => '')).trim(), '/ 카드', (await cur.$$(zv + ' .zc')).length);
    await selByName(cur, /에너지/, 1);
    const pb = await barBtn(cur, /나머지/); log('단추:', pb && (await pb.textContent()));
    await cur.screenshot({ path: OUT + '7-rayquaza.png' });
    await pb.click(); await cur.waitForTimeout(900);
    if (await cur.$(zv)) errs.push('레쿠쟈: 나머지 뒤에 창이 남음');
    lt = await logText(cur); if (!/섞어서 덱 아래로|덱 아래로/.test(lt)) errs.push('레쿠쟈: 나머지 덱 아래 기록 없음: ' + lt.slice(-200));
    if (!await cur.$('.area.bottom .mk.abu')) errs.push('특성 사용 표시 없음');
    await oth.waitForSelector('.area.top .mk.abu', { timeout: 3000 }).catch(() => errs.push('상대 화면에 특성 사용 표시 없음'));
    await cur.screenshot({ path: OUT + '8-badge.png' });
  } else errs.push('덱에 메가레쿠쟈 없음');
  // 6) 넘침 검사: 덱 창을 여러 폭에서
  await openDeck(cur, '덱 전체 보기'); await cur.waitForSelector(zv + ' .zc'); await selByName(cur, /에너지/, 2);
  for (const w of [260, 360, 390, 768, 1280]) { await cur.setViewportSize({ width: w, height: w < 700 ? 760 : 820 }); await cur.waitForTimeout(250);
    const o = await cur.evaluate(() => { const s = document.querySelector('.sheet .zvsheet'); const over = [...s.querySelectorAll('.zvbar *, .zvtools *, .zvh *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'auto' && e.tagName !== 'INPUT').map(e => e.className || e.tagName).slice(0, 4); return { sw: document.documentElement.scrollWidth, ssw: s.scrollWidth, scw: s.clientWidth, over }; });
    if (o.sw > w + 1 || o.ssw > o.scw + 1) errs.push(`덱 창 폭 ${w}: 넘침 ${JSON.stringify(o)}`);
    if (o.over.length) log(`폭 ${w} 안쪽 넘침 후보`, o.over);
    if (w === 360 || w === 1280) await cur.screenshot({ path: OUT + `9-zv-${w}.png` }); }
  console.log(errs.length ? '문제:\n' + errs.join('\n') : '문제 없음');
  await b.close();
})().catch(e => { console.error('실패', e.message, errs); process.exit(1); });
