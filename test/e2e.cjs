// 두 사람 + 관전자로 한 판 돌려 보기 (Playwright)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const DECK = `4 Pikachu ex SVP 106
4 Magnemite SSP 58
4 Charmander PFL 11
4 Charmeleon PFL 12
4 Ultra Ball MEG 131
4 Boss's Orders MEG 114
4 Switch MEG 130
16 Basic {L} Energy SVE 4
16 Basic Fire Energy SVE 2`;
const errs = [];
const OUT = __dirname + '/out/';
(async () => {
  const b = await chromium.launch();
  const mk = async (name, w = 390, h = 844) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/images\.pokemontcg\.io/, r => { const u = r.request().url(); let h = 0; for (const ch of u) h = (h * 31 + ch.charCodeAt(0)) % 360; r.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="3" fill="#f5d142"/><rect x="3" y="3" width="57" height="82" rx="2" fill="hsl(${h},55%,62%)"/><rect x="6" y="12" width="51" height="34" fill="hsl(${(h+40)%360},60%,80%)"/><circle cx="31" cy="29" r="11" fill="hsl(${(h+180)%360},50%,45%)"/><rect x="6" y="52" width="51" height="4" fill="#fff8"/><rect x="6" y="60" width="40" height="3" fill="#fff8"/><rect x="6" y="66" width="46" height="3" fill="#fff8"/></svg>` }); });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await p.goto(BASE + '/#login');
    await p.fill('#nm', name); await p.fill('#cd', 'doran'); await p.click('#go');
    await p.waitForSelector('.tabs');
    return p;
  };
  const A = await mk('링크'), B = await mk('친구', 1280, 900);
  for (const p of [A, B]) {
    await p.goto(BASE + '/#decks'); await p.waitForSelector('#nd'); await p.click('#nd');
    await p.click('#imp'); await p.fill('#paste', DECK); await p.click('#go');
    await p.waitForSelector('#cnt.ok');
    await p.click('#add'); await p.waitForSelector('#q');
    await p.fill('#q', 'ㅍㅋㅊ'); await p.waitForTimeout(200);
    const found = await p.$$eval('#res .dkc .cnm', els => els.map(e => e.textContent).join('|'));
    if (!/피카츄/.test(found)) errs.push('초성 검색 실패: ' + found.slice(0, 80));
    await p.fill('#q', 'vlzkcb'); await p.waitForTimeout(200);
    const f2 = await p.$$eval('#res .dkc', els => els.length);
    if (!f2) errs.push('영문 자판 검색 실패');
    await p.click('.sheet [data-close]'); await p.waitForTimeout(150);
    await p.click('#save'); await p.waitForSelector('#nd');
  }
  // 덱 고치기: 고친 뒤 뒤로 가기 → 저장할지 물음 (계속 고치기 / 저장하지 않고 나가기)
  await A.click('.dtile:not(.new)'); await A.waitForSelector('#dn'); await A.fill('#dn', '이름 바꿈 시험');
  await A.evaluate(() => history.back()); await A.waitForTimeout(400);
  if (!/저장하지 않은 변경/.test(await A.textContent('.sheet .in').catch(() => ''))) errs.push('덱 고친 뒤 뒤로 가기: 저장 확인 없음');
  else { await A.click('.sheet [data-i="2"]'); await A.waitForTimeout(300); if (!(await A.$('#dn'))) errs.push('계속 고치기 후 덱 화면이 아님');
    await A.click('#back'); await A.waitForSelector('.sheet [data-i="1"]'); await A.click('.sheet [data-i="1"]'); await A.waitForSelector('#nd'); }
  // 추가 창: 탭과 검색어 기억
  await A.click('.dtile:not(.new)'); await A.waitForSelector('#add'); await A.click('#add'); await A.waitForSelector('#q');
  if ((await A.inputValue('#q')) !== 'vlzkcb') errs.push('카드 추가 창이 검색어를 기억 못 함: ' + await A.inputValue('#q'));
  await A.click('.sheet [data-close]'); await A.waitForTimeout(200); await A.click('#back'); await A.waitForSelector('#nd');
  await A.goto(BASE + '/#lobby'); await A.waitForSelector('[data-tab=new]'); await A.click('[data-tab=new]');
  await A.selectOption('select[name=mode]', 'async'); await A.click('#newroom button.primary');
  await A.waitForTimeout(400);
  await B.goto(BASE + '/#lobby'); await B.waitForSelector('[data-tab=open]'); await B.click('[data-tab=open]');
  await B.click('[data-join]'); await B.click('.sheet [data-i="0"]');
  await B.waitForSelector('.area.bottom');
  const gameUrl = B.url();
  await A.goto(gameUrl); await A.waitForSelector('.area.bottom');
  const S = await mk('관전자'); await S.goto(gameUrl); await S.waitForSelector('.area');
  for (const p of [A, B]) { const o = await p.$('[data-order="1"]'); if (o) await o.click(); }
  await A.waitForTimeout(300);
  for (const p of [A, B]) {
    for (let tries = 0; tries < 2; tries++) {
      const hands = await p.$$('[data-hand]');
      let placed = false;
      for (const h of hands) {
        await h.click({ position: { x: 8, y: 12 } }); await p.waitForSelector('.sheet .in');
        const bt = await p.$('.sheet .acts button');
        if (bt && /배틀|벤치/.test(await bt.textContent())) { const btns = await p.$$('.sheet .acts button'); await btns[tries === 0 ? 0 : 1].click(); placed = true; await p.waitForTimeout(250); break; }
        await p.click('.sheet [data-close]'); await p.waitForTimeout(80);
      }
      if (!placed) break;
    }
    const ms = await p.$$('[data-mull]'); if (ms.length) { await ms[ms.length - 1].click(); await p.waitForTimeout(200); }
    await p.click('[data-t=setupDone]'); await p.waitForTimeout(300);
    const warn = await p.$('.sheet [data-ok]'); if (warn) { await warn.click(); await p.waitForTimeout(300); }
  }
  await A.waitForSelector('.ztag.turn'); await A.waitForTimeout(300);
  console.log('차례:', await A.textContent('.ztag.turn .zn'));
  if ((await S.$$('[data-hand]')).length) errs.push('관전자에게 손패가 보임');
  await S.screenshot({ path: OUT + 'spec.png' });
  const cur = (await A.$('.area.bottom.now')) ? A : B, oth = cur === A ? B : A;
  const energies = async () => { const out = []; for (const h of await cur.$$('[data-hand]')) { if (/Energy|에너지/.test(await h.innerHTML())) out.push(h); } return out; };
  let en = await energies();
  if (en.length >= 2) {
    await en[0].click({ position: { x: 8, y: 12 } }); await cur.click('.sheet .acts button.primary'); await cur.click('.sheet .acts button'); await cur.waitForTimeout(300);
    en = await energies(); await en[0].click({ position: { x: 8, y: 12 } }); await cur.click('.sheet .acts button.primary'); await cur.click('.sheet .acts button'); await cur.waitForTimeout(300);
    const w = await cur.textContent('.sheet .in'); if (!/이미 에너지/.test(w)) errs.push('에너지 2번째 경고 없음: ' + w.slice(0, 60));
    await cur.fill('.sheet input[name=note]', '시험: 특성 효과'); await cur.click('.sheet [data-ok]'); await cur.waitForTimeout(400);
    await oth.waitForSelector('[data-dock=open]'); await oth.click('[data-dock=open]'); await oth.waitForSelector('.drow [data-dispute]'); // 상대 판정은 작은 알약으로 접혀 있다가 눌러서 펼쳐요
    await oth.waitForTimeout(1500); await oth.screenshot({ path: OUT + 'judge.png', fullPage: true });
    await oth.click('.drow [data-dispute]'); await oth.fill('.sheet input[name=t]', '에너지는 한 번만'); await oth.click('.sheet [data-ok]'); await oth.waitForTimeout(300);
    await oth.click('[data-rwask]'); await oth.waitForTimeout(300);
    await cur.waitForSelector('[data-rwok]'); await cur.click('[data-rwok]'); await cur.click('.sheet [data-ok]'); await cur.waitForTimeout(600);
    await cur.click('[data-t=log]'); await cur.waitForSelector('.sheet .lgs .log'); // 기록·채팅 창 (옆 줄에 탭·입력칸)
    if (!/되돌렸어요/.test(await cur.textContent('.sheet .lgs .log'))) errs.push('되돌리기 기록 없음');
    await cur.fill('.lgin textarea', '시험 채팅'); await cur.press('.lgin textarea', 'Enter'); await cur.waitForTimeout(500);
    if (!/시험 채팅/.test(await cur.textContent('.sheet .lgs .log'))) errs.push('채팅이 기록에 안 보임');
    await cur.click('.sheet [data-close]'); await cur.waitForTimeout(200);
  } else console.log('에너지 부족, 경고 시험 건너뜀');
  await cur.waitForTimeout(1500); await cur.screenshot({ path: OUT + 'game-cur.png', fullPage: true });
  await oth.screenshot({ path: OUT + 'game-oth.png', fullPage: true });
  await cur.click('[data-t=endTurn]'); await cur.waitForTimeout(500);
  console.log('다음:', await oth.textContent('.ztag.turn .zn'));
  await oth.click('[data-t=rewatch]'); await oth.waitForSelector('.arena.rwmode .vw'); // 대전 중 기보 보기: 판 크기 그대로
  await oth.click('[data-rw=tprev]'); await oth.waitForTimeout(400); await oth.click('[data-rw=next]'); await oth.waitForTimeout(400);
  if (!/수/.test(await oth.textContent('.vwk'))) errs.push('기보 보기 수 표시 없음');
  await oth.click('.vw [data-rw=close]'); await oth.waitForSelector('.arena:not(.rwmode) .area.bottom');
  await A.goto(gameUrl.replace('#game', '#replay')); await A.waitForSelector('.vw');
  await A.click('[data-rw=prev]'); await A.waitForTimeout(300); await A.click('[data-rw=tprev]'); await A.waitForTimeout(400);
  if (await A.$('input[type=range]')) errs.push('기보에 스크롤바가 남아 있음');
  await A.screenshot({ path: OUT + 'replay.png', fullPage: true });
  await B.goto(gameUrl); await B.waitForSelector('.area.bottom');
  for (const w of [260, 360, 390, 768, 1280]) {
    await B.setViewportSize({ width: w, height: 800 }); await B.waitForTimeout(150);
    const sw = await B.evaluate(() => document.documentElement.scrollWidth); if (sw > w + 1) errs.push(`판 폭 ${w}: 가로 넘침 ${sw}`);
  }
  await B.setViewportSize({ width: 1280, height: 860 }); await B.waitForTimeout(1500); await B.screenshot({ path: OUT + 'game-1280.png' }); await B.setViewportSize({ width: 390, height: 844 }); await B.click('[data-dock]').catch(()=>{}); await B.waitForTimeout(800); await B.screenshot({ path: OUT + 'game-390.png' });
  // 대전 화면: 뒤로 가기 한 번은 안내만, 두 번이면 나감
  await B.goto(BASE + '/#lobby'); await B.waitForSelector('.tabs'); await B.evaluate(u => { location.hash = u; }, new URL(gameUrl).hash); await B.waitForSelector('.area.bottom');
  await B.evaluate(() => history.back()); await B.waitForTimeout(400);
  if (!/#game/.test(B.url()) || !/한 번 더/.test(await B.textContent('#toast'))) errs.push('대전에서 뒤로 한 번: 안내 없이 나감 ' + B.url());
  await B.evaluate(() => history.back()); await B.waitForTimeout(500);
  if (!/#lobby/.test(B.url())) errs.push('대전에서 뒤로 두 번: 안 나가짐 ' + B.url());
  await B.waitForSelector('.tabs');
  for (const w of [260, 360]) { await B.setViewportSize({ width: w, height: 800 }); await B.waitForTimeout(150); const sw = await B.evaluate(() => document.documentElement.scrollWidth); if (sw > w + 1) errs.push(`로비 폭 ${w}: 넘침 ${sw}`); }
  await B.screenshot({ path: OUT + 'lobby-360.png' });
  console.log(errs.length ? '문제:\n' + errs.join('\n') : '문제 없음');
  await b.close();
})().catch(e => { console.error('실패', e.message, errs); process.exit(1); });
