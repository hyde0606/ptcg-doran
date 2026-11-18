// 덱 리스트 읽기와 덱 규칙 검사 (서버·화면 공용)
const ENERGY_SYM = { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal' };

// 좌측·우측 두 장을 이어 한 장으로 내는 카드(전설의 산정·용암동굴·해구): side 'L'|'R', pair = 짝 카드 id
export const sideKo = c => c && c.side ? (c.side === 'L' ? ' (좌측)' : ' (우측)') : '';
export const sideEn = c => c && c.side ? (c.side === 'L' ? ' (Left)' : ' (Right)') : '';
// 한국어 이름 (화면의 cnameKo와 같음): 한국판 이름 > 포켓몬 한국어 이름(+메가, ex). 짝 카드는 (좌측)·(우측)을 붙임
const koBase = c => c.kn || (c.ko ? (/^Mega /.test(c.n) ? '메가' : '') + c.ko + (/ ex$/.test(c.n) ? ' ex' : '') : '');
export const koName = c => { const k = koBase(c); return k ? k + sideKo(c) : ''; };
const nkey = s => String(s).toLowerCase().replace(/\{(\w)\}/g, (_, k) => ENERGY_SYM[k.toUpperCase()] || k).replace(/[\s'’.\-:!?&()\[\]]/g, ''); // 이름 비교용 (띄어쓰기·기호 무시)
// 영문 카드 번호: 원본 자료에 번호가 틀린 카드가 있어(Black Bolt 'Antique Cover Fossil'이 60으로 적힘, 실제 80) 카드 id 끝 번호를 믿는다
export const cardNo = c => { const m = !c.kro && /^\d+$/.test(c.no || '') && c.id.match(/-(\d+)$/); return m && m[1] !== c.no ? m[1] : c.no; };
const nokey = s => String(s).replace(/^0+(?=\d)/, '').toUpperCase(); // 번호 앞 0 무시 (005 = 5)

// 짝 카드 찾기: 한글 글에 '1장만으로는 내놓을 수 없고'가 있는 같은 세트·같은 이름 스타디움 두 장. 영문 번호가 작은 쪽이 좌측.
// 한글판은 두 장을 이어 붙인 그림 하나(번호 하나)만 있어 좌측 = 그 번호, 우측 = 다음 번호로 채우고, 한글 사이트의 안내 줄은 뺌
const SPLIT_KR = /1장만으로는 내놓을 수 없고/, SPLIT_NOTE = /^\s*\[좌측\].*\[우측\].*조합할 시/;
function markSplit(cards) {
  const g = {};
  for (const c of cards) if (c.st === 'T' && (c.kr || []).some(t => SPLIT_KR.test(t))) (g[(c.set || c.kset || '') + '|' + c.n] ||= []).push(c);
  for (const xs of Object.values(g)) {
    if (xs.length !== 2) continue;
    xs.sort((a, b) => (parseInt(cardNo(a)) || 0) - (parseInt(cardNo(b)) || 0));
    xs.forEach((c, i) => {
      c.side = i ? 'R' : 'L'; c.pair = xs[1 - i].id; c.kr = (c.kr || []).filter(t => !SPLIT_NOTE.test(t));
      if (!c.kno) { const m = String(c.kimg || '').match(/_(\d{3})(?:_\w+)?\.\w+$/); if (m) c.kno = String(+m[1] + i).padStart(3, '0'); }
    });
  }
}
export function indexCards(cards) {
  markSplit(cards);
  const byId = {}, bySetNo = {}, byName = {}, byKSetNo = {}, byKo = {};
  for (const c of cards) {
    byId[c.id] = c;
    if (c.set && !c.kro) bySetNo[(c.set + ' ' + cardNo(c)).toUpperCase()] = c; // 한국판 카드(kro)는 세트 코드가 영문과 겹칠 수 있어 뺀다
    (byName[c.n.toLowerCase()] ||= []).push(c);
    if (c.side) for (const t of [sideEn(c), sideEn(c).replace(/[()]/g, '')]) (byName[(c.n + t).toLowerCase()] ||= []).push(c); // 'Legendary Pyroduct (Left)'
    if (c.kset && c.kno) (byKSetNo[c.kset.toUpperCase() + ' ' + nokey(c.kno)] ||= []).push(c); // 한국판 번호 (그림만 다른 영문 카드 여러 장이 한 번호를 함께 씀)
    const k = koName(c); if (k) (byKo[nkey(k)] ||= []).push(c);
    if (c.side && koBase(c)) (byKo[nkey(koBase(c))] ||= []).push(c); // 짝 카드는 (좌측)·(우측) 없이 써도 찾음
  }
  return { byId, bySetNo, byName, byKSetNo, byKo };
}

// PTCGL 형식 "4 Pikachu ex SVP 106"과 이 사이트의 한국어 형식 "4 피카츄 ex M6a 017"을 읽음. "Pokémon: 12", "에너지: 12" 같은 줄은 건너뜀
const HEAD = /^(pok[eé]mon|trainers?|energy|total cards|포켓몬|트레이너스?|에너지|합계|모두)(?![a-z])[^:]*:\s*\d*\s*장?$/i;
const LINE = /^(\d+)\s*[x×]?\s+(.+?)(?:\s+([A-Z0-9][A-Za-z0-9-]{1,6})\s+([A-Z]*\d+[a-z]?|[A-Z]{1,3}))?$/;
export function parseDeckList(text, idx) {
  const out = [], bad = [], at = {}, loose = new Set();
  const nameOk = (c, nm) => { const k = nkey(nm); return k && (nkey(c.n) === k || nkey(koName(c)) === k || nkey('Basic ' + nm) === nkey(c.n)); };
  const byName = nm => {
    const en = String(nm).replace(/\{(\w)\}/g, (_, k) => ENERGY_SYM[k.toUpperCase()] || k).replace(/ Energy Energy$/, ' Energy').toLowerCase();
    const cand = idx.byName[en] || idx.byName['basic ' + en] || idx.byName[en.replace(/^basic /, '')] || (idx.byKo || {})[nkey(nm)];
    if (!cand) return null;
    const pool = cand.filter(c => !c.kro); return (pool.length ? pool : cand)[(pool.length ? pool : cand).length - 1]; // 이름만 있으면 가장 최근 카드
  };
  for (let line of String(text).split(/\r?\n/)) {
    line = line.trim().replace(/^[-*•·]\s*/, '');
    if (!line || HEAD.test(line) || /^\*\*/.test(line) || /^#/.test(line)) continue;
    const m = line.match(LINE);
    if (!m) { bad.push(line); continue; }
    const n = +m[1], name = m[2].trim(); let card = null;
    if (m[3]) { // 세트 코드 + 번호: 영문 번호와 한국판 번호를 모두 찾아 이름이 맞는 쪽
      const en = idx.bySetNo[(m[3] + ' ' + nokey(m[4])).toUpperCase()] || idx.bySetNo[(m[3] + ' ' + m[4]).toUpperCase()];
      const kr = (idx.byKSetNo || {})[m[3].toUpperCase() + ' ' + nokey(m[4])] || [];
      card = [en, ...kr].filter(Boolean).find(c => nameOk(c, name)) || en || kr[0] || null;
    }
    let byNm = false;
    if (!card) { card = byName(name); byNm = !!card; }
    if (!card && m[3]) { card = byName(name + ' ' + m[3] + ' ' + m[4]) || byName(name + ' ' + m[3]); byNm = !!card; } // 이름 끝이 세트 코드처럼 보였던 경우
    if (!card) { bad.push(line); continue; }
    if (byNm && card.side && !/좌측|우측|\b(left|right)\b/i.test(name)) loose.add(card.id);
    if (at[card.id] != null) out[at[card.id]].n += n; else { at[card.id] = out.length; out.push({ id: card.id, n }); }
  }
  // 좌측·우측 짝 카드를 이름만 쓴 줄('2 전설의 해구'): 다른 줄을 더해 60장이 되면 '짝 수', 아니면 '장수'로 보고 좌측·우측 두 줄로 나눔
  const total = out.reduce((t, x) => t + x.n, 0);
  for (const id of loose) {
    const x = out.find(y => y.id === id), c = idx.byId[id]; if (!x || !c.pair || !idx.byId[c.pair] || out.some(y => y.id === c.pair)) continue;
    const pairs = total + x.n === 60, Ln = pairs ? x.n : Math.ceil(x.n / 2), Rn = pairs ? x.n : x.n - Ln;
    const lid = c.side === 'L' ? c.id : c.pair, rid = c.side === 'L' ? c.pair : c.id;
    x.id = lid; x.n = Ln; if (Rn) out.splice(out.indexOf(x) + 1, 0, { id: rid, n: Rn });
  }
  return { list: out, bad };
}

// 덱 리스트를 글로 내보내기. fmt 'ptcgl' = 포켓몬 TCG 라이브에 붙여 넣는 영어 형식, 'ko' = 한국어 이름 + 한국판 번호
const SYM_OF = Object.fromEntries(Object.entries(ENERGY_SYM).map(([k, v]) => [v, k]));
const NO_OK = /^([A-Z]*\d+[a-z]?|[A-Z]{1,3})$/;
export function exportDeckList(list, idx, fmt = 'ptcgl') {
  const ko = fmt === 'ko', HEADS = ko ? { P: '포켓몬', T: '트레이너스', E: '에너지' } : { P: 'Pokémon', T: 'Trainer', E: 'Energy' };
  const rows = { P: [], T: [], E: [] }, at = {}, krOnly = [];
  let total = 0;
  for (const { id, n } of list) {
    const c = idx.byId[id]; if (!c || !rows[c.st]) continue;
    let name, set = c.set, no = cardNo(c);
    if (ko) {
      name = koName(c) || c.n;
      if (c.kset && c.kno && NO_OK.test(c.kno)) { set = c.kset; no = c.kno; }
    } else {
      name = c.n;
      const b = !c.kro && c.st === 'E' && (c.sub || []).includes('Basic') && name.match(/^Basic (\w+) Energy$/);
      if (b && SYM_OF[b[1]]) name = `Basic {${SYM_OF[b[1]]}} Energy`;
      if (c.kro && !krOnly.includes(name)) krOnly.push(name);
    }
    const code = set && no && NO_OK.test(no) ? ` ${set} ${no}` : '';
    const key = c.st + name + code; total += n;
    if (at[key]) at[key].n += n; else rows[c.st].push(at[key] = { name, code, n, base: c.side ? (ko ? koBase(c) : c.n) : name, side: c.side || '' });
  }
  const loc = ko ? 'ko' : 'en', parts = [];
  for (const st of 'PTE') {
    const xs = rows[st]; if (!xs.length) continue;
    xs.sort((a, b) => b.n - a.n || a.base.localeCompare(b.base, loc) || a.side.localeCompare(b.side) || a.code.localeCompare(b.code)); // 짝 카드는 좌측 다음 우측
    parts.push(`${HEADS[st]}: ${xs.reduce((a, b) => a + b.n, 0)}\n` + xs.map(x => `${x.n} ${x.name}${x.code}`).join('\n'));
  }
  parts.push(ko ? `합계: ${total}장` : `Total Cards: ${total}`);
  return { text: parts.join('\n\n'), total, krOnly };
}

const isBasicEnergy = c => c.st === 'E' && (c.sub || []).includes('Basic');

export function checkDeck(list, idx) {
  const problems = [];
  let total = 0, basics = 0, ace = 0;
  const byName = {}, shown = {}, half = {}, warns = [];
  for (const { id, n } of list) {
    const c = idx.byId[id]; if (!c) { problems.push(`모르는 카드: ${id}`); continue; }
    total += n;
    if (c.st === 'P' && (c.sub || []).includes('Basic')) basics += n;
    if ((c.sub || []).includes('ACE SPEC')) ace += n;
    // 같은 이름 4장: 한글 이름이 있으면 한글 이름으로 센다 (영문 카드와 한국 전용 카드가 섞여도 같이 셈)
    if (!isBasicEnergy(c)) { const k = (c.kn || c.n).replace(/\s+/g, ''); byName[k] = (byName[k] || 0) + n; shown[k] = c.kn || c.n; } // 짝 카드는 좌측·우측을 합쳐 4장
    if (c.side) { const k = [c.id, c.pair].sort().join('|'), h = half[k] ||= { L: 0, R: 0, nm: c.kn || c.n }; h[c.side] += n; }
    if (!isBasicEnergy(c) && !['H', 'I', 'J'].includes(c.rm)) problems.push(`스탠다드에서 못 쓰는 카드: ${c.n} (${c.rm || '마크 없음'})`);
  }
  if (total !== 60) problems.push(`덱은 60장이어야 해요 (지금 ${total}장).`);
  if (!basics) problems.push('기본 포켓몬이 1장 이상 있어야 해요.');
  if (ace > 1) problems.push(`에이스 스펙은 1장까지예요 (지금 ${ace}장).`);
  for (const [n, k] of Object.entries(byName)) if (k > 4) problems.push(`같은 이름은 4장까지예요: ${shown[n]} ${k}장`);
  // 규칙 위반은 아니지만 한쪽만 있으면 낼 수 없음 (알려 주기만)
  for (const h of Object.values(half)) {
    if (!h.L || !h.R) warns.push(`${h.nm}: 좌측·우측 두 장을 함께 손패에 모아야 낼 수 있어요 (지금 덱에 좌측 ${h.L}장, 우측 ${h.R}장)`);
    else if (h.L !== h.R) warns.push(`${h.nm}: 좌측 ${h.L}장, 우측 ${h.R}장이라 ${Math.abs(h.L - h.R)}장은 짝이 없어요`);
  }
  return { ok: problems.length === 0, problems, warns, total };
}

export const expand = list => list.flatMap(({ id, n }) => Array(n).fill(id));
