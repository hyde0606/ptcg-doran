// 카드 그림의 일러스트 부분을 작은 지문(dHash 256비트)으로 만든다. build-cards-kr.py 가 같은 그림의 한글판을 찾는 데 쓴다.
//   node tools/kr-art-hash.cjs <카드 자료 폴더(F:\AI\17_포켓몬 카드)> <public/cards.json> <출력 json>
// 이미 만든 지문은 출력 파일에서 다시 읽어 건너뛴다. 원본 폴더는 읽기만 한다.
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const [ROOT, CARDS, OUT] = process.argv.slice(2);
const cards = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const kr = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/kr/cards_kr.json'), 'utf8'));
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { en: {}, kr: {} };
const isStdKr = c => ['H', 'I', 'J'].includes(c.regulation_mark) || /^기본\s*\S+\s*에너지$/.test(c.name || '');

async function dhash(file) {
  const img = sharp(file);
  const m = await img.metadata();
  // 일러스트 칸: 가로 9~91%, 세로 11~49%
  const left = Math.round(m.width * 0.09), top = Math.round(m.height * 0.11);
  const width = Math.round(m.width * 0.82), height = Math.round(m.height * 0.38);
  const buf = await sharp(file).extract({ left, top, width, height }).greyscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits += buf[y * 17 + x] > buf[y * 17 + x + 1] ? '1' : '0';
  let hex = ''; for (let i = 0; i < 256; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
function krFile(c) {
  const dir = (c.image_path || '').split('/').slice(-2, -1)[0] || c.set_code;
  for (const d of [dir, c.set_code, encodeURIComponent(dir)]) {
    const f = path.join(ROOT, 'images/kr', d || '', c.image_file || ''); if (c.image_file && fs.existsSync(f)) return f;
  }
  return null;
}
(async () => {
  const jobs = [];
  for (const c of cards) {
    if (done.en[c.id]) continue;
    const [set] = c.id.split('-'); const no = c.id.slice(set.length + 1);
    const f = path.join(ROOT, 'images/en/small', set, no + '.png');
    if (fs.existsSync(f)) jobs.push(['en', c.id, f]);
  }
  for (const c of kr) { if (!isStdKr(c) || done.kr[c.code]) continue; const f = krFile(c); if (f) jobs.push(['kr', c.code, f]); }
  console.log('지문 만들 그림', jobs.length);
  let n = 0, bad = 0;
  const work = async () => {
    while (jobs.length) {
      const [k, id, f] = jobs.shift();
      try { done[k][id] = await dhash(f); } catch { bad++; }
      if (++n % 500 === 0) { console.log(n); fs.writeFileSync(OUT, JSON.stringify(done)); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  fs.writeFileSync(OUT, JSON.stringify(done));
  console.log('끝', Object.keys(done.en).length, Object.keys(done.kr).length, '실패', bad);
})();
