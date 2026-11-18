// 덱 사진 읽기는 따로 돌려 화면이 멈추지 않게 (진행 정도를 알려 줌)
import { parseIndex, scanDeck, identifyCard } from './deckscan.js';
let IDX = null;
async function index() {
  if (IDX) return IDX;
  const r = await fetch('/cardart.bin', { credentials: 'same-origin' });
  if (!r.ok) throw new Error(r.status === 401 ? '로그인이 필요해요.' : '덱 사진 인식 자료를 받지 못했어요.');
  return IDX = parseIndex(await r.arrayBuffer());
}
onmessage = async e => {
  const m = e.data;
  try {
    const idx = await index();
    if (m.t === 'labels') return postMessage({ t: 'labels', labels: idx.labels });
    if (m.t === 'card') { const r = identifyCard(m.img, idx, m.names); return postMessage({ t: 'card', res: { cands: r.cands.map(c => ({ label: c.label, score: c.score })), score: r.score, gap: r.gap, sure: r.sure } }); }
    const res = scanDeck(m.img, idx, m.names, m.energy, (p, s) => postMessage({ t: 'p', p, s }));
    postMessage({ t: 'done', res });
  } catch (er) { postMessage({ t: 'err', msg: er.message || String(er) }); }
};
