// 홈 화면 아이콘 만들기: node tools/make-icons.cjs  (playwright 필요)
// 청록→파랑 바탕에 사이트 머리의 공 무늬. maskable 은 둥글게 잘려도 공이 남도록 작게.
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'icons');
const list = [
  ['icon-192.png', 192, .70, 22], ['icon-512.png', 512, .70, 22],
  ['maskable-512.png', 512, .56, 0], ['apple-180.png', 180, .66, 0],
];
const html = (s, k, rad) => {
  const d = Math.round(s * k), bw = Math.max(3, Math.round(d * .065)), c = Math.round(d * .36), cb = Math.max(2, Math.round(d * .05));
  return `<html><body style="margin:0;background:transparent">
  <div style="width:${s}px;height:${s}px;border-radius:${rad}%;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 30% 22%, #7fe0c4 0, transparent 55%), linear-gradient(135deg,#38c6a0,#2fa5d8 70%,#2a8fd0)">
    <div style="position:relative;width:${d}px;height:${d}px;border-radius:50%;box-sizing:border-box;border:${bw}px solid #1d5f86;
      background:linear-gradient(#fff 0 44%, #1d5f86 44% 56%, #f4f8fb 56%);box-shadow:0 ${Math.round(s * .025)}px ${Math.round(s * .05)}px rgba(10,50,80,.28)">
      <div style="position:absolute;left:50%;top:50%;width:${c}px;height:${c}px;margin:${-c / 2}px 0 0 ${-c / 2}px;border-radius:50%;box-sizing:border-box;background:#fff;border:${cb}px solid #1d5f86;box-shadow:inset 0 0 0 ${Math.round(c * .14)}px #fff, inset 0 0 0 ${Math.round(c * .14) + Math.max(1, Math.round(cb * .6))}px #9fd8ee"></div>
    </div></div></body></html>`;
};
(async () => {
  const b = await chromium.launch();
  for (const [name, s, k, rad] of list) {
    const p = await b.newPage({ viewport: { width: s, height: s }, deviceScaleFactor: 1 });
    await p.setContent(html(s, k, rad));
    await p.screenshot({ path: path.join(OUT, name), omitBackground: rad > 0 });
    await p.close();
  }
  await b.close();
  console.log('icons ->', OUT);
})();
