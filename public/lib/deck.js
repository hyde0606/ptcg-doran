// 덱 리스트 읽기와 덱 규칙 검사 (서버·화면 공용)
const ENERGY_SYM = { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal' };

// 한국어 이름 (화면의 cnameKo와 같음): 한국판 이름 > 포켓몬 한국어 이름(+메가, ex)
export const koName = c => c.kn || (c.ko ? (/^Mega /.test(c.n) ? '메가' : '') + c.ko + (/ ex$/.test(c.n) ? ' ex' : '') : '');
const nkey = s => String(s).toLowerCase().replace(/\{(\w)\}/g, (_, k) => ENERGY_SYM[k.toUpperCase()] || k).replace(/[\s'’.\-:!?&()\[\]]/g, ''); // 이름 비교용 (띄어쓰기·기호 무시)
// 영문 카드 번호: 원본 자료에 번호가 틀린 카드가 있어(Black Bolt 'Antique Cover Fossil'이 60으로 적힘, 실제 80) 카드 id 끝 번호를 믿는다
export const cardNo = c => { const m = !c.kro && /^\d+$/.test(c.no || '') && c.id.match(/-(\d+)$/); return m && m[1] !== c.no ? m[1] : c.no; };
const nokey = s => String(s).replace(/^0+(?=\d)/, '').toUpperCase(); // 번호 앞 0 무시 (005 = 5)

export function indexCards(cards) {
  const byId = {}, bySetNo = {}, byName = {}, byKSetNo = {}, byKo = {};
  for (const c of cards) {
    byId[c.id] = c;
    if (c.set && !c.kro) bySetNo[(c.set + ' ' + cardNo(c)).toUpperCase()] = c; // 한국판 카드(kro)는 세트 코드가 영문과 겹칠 수 있어 뺀다
    (byName[c.n.toLowerCase()] ||= []).push(c);
    if (c.kset && c.kno) (byKSetNo[c.kset.toUpperCase() + ' ' + nokey(c.kno)] ||= []).push(c); // 한국판 번호 (그림만 다른 영문 카드 여러 장이 한 번호를 함께 씀)
    const k = koName(c); if (k) (byKo[nkey(k)] ||= []).push(c);
  }
  return { byId, bySetNo, byName, byKSetNo, byKo };
}

// PTCGL 형식 "4 Pikachu ex SVP 106"과 이 사이트의 한국어 형식 "4 피카츄 ex M6a 017"을 읽음. "Pokémon: 12", "에너지: 12" 같은 줄은 건너뜀
const HEAD = /^(pok[eé]mon|trainers?|energy|total cards|포켓몬|트레이너스?|에너지|합계|모두)(?![a-z])[^:]*:\s*\d*\s*장?$/i;
const LINE = /^(\d+)\s*[x×]?\s+(.+?)(?:\s+([A-Z0-9][A-Za-z0-9-]{1,6})\s+([A-Z]*\d+[a-z]?|[A-Z]{1,3}))?$/;
export function parseDeckList(text, idx) {
  const out = [], bad = [], at = {};
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
    if (!card) card = byName(name);
    if (!card && m[3]) card = byName(name + ' ' + m[3] + ' ' + m[4]) || byName(name + ' ' + m[3]); // 이름 끝이 세트 코드처럼 보였던 경우
    if (!card) { bad.push(line); continue; }
    if (at[card.id] != null) out[at[card.id]].n += n; else { at[card.id] = out.length; out.push({ id: card.id, n }); }
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
    if (at[key]) at[key].n += n; else rows[c.st].push(at[key] = { name, code, n });
  }
  const loc = ko ? 'ko' : 'en', parts = [];
  for (const st of 'PTE') {
    const xs = rows[st]; if (!xs.length) continue;
    xs.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, loc) || a.code.localeCompare(b.code));
    parts.push(`${HEADS[st]}: ${xs.reduce((a, b) => a + b.n, 0)}\n` + xs.map(x => `${x.n} ${x.name}${x.code}`).join('\n'));
  }
  parts.push(ko ? `합계: ${total}장` : `Total Cards: ${total}`);
  return { text: parts.join('\n\n'), total, krOnly };
}

const isBasicEnergy = c => c.st === 'E' && (c.sub || []).includes('Basic');

export function checkDeck(list, idx) {
  const problems = [];
  let total = 0, basics = 0, ace = 0;
  const byName = {}, shown = {};
  for (const { id, n } of list) {
    const c = idx.byId[id]; if (!c) { problems.push(`모르는 카드: ${id}`); continue; }
    total += n;
    if (c.st === 'P' && (c.sub || []).includes('Basic')) basics += n;
    if ((c.sub || []).includes('ACE SPEC')) ace += n;
    // 같은 이름 4장: 한글 이름이 있으면 한글 이름으로 센다 (영문 카드와 한국 전용 카드가 섞여도 같이 셈)
    if (!isBasicEnergy(c)) { const k = (c.kn || c.n).replace(/\s+/g, ''); byName[k] = (byName[k] || 0) + n; shown[k] = c.kn || c.n; }
    if (!isBasicEnergy(c) && !['H', 'I', 'J'].includes(c.rm)) problems.push(`스탠다드에서 못 쓰는 카드: ${c.n} (${c.rm || '마크 없음'})`);
  }
  if (total !== 60) problems.push(`덱은 60장이어야 해요 (지금 ${total}장).`);
  if (!basics) problems.push('기본 포켓몬이 1장 이상 있어야 해요.');
  if (ace > 1) problems.push(`에이스 스펙은 1장까지예요 (지금 ${ace}장).`);
  for (const [n, k] of Object.entries(byName)) if (k > 4) problems.push(`같은 이름은 4장까지예요: ${shown[n]} ${k}장`);
  return { ok: problems.length === 0, problems, total };
}

export const expand = list => list.flatMap(({ id, n }) => Array(n).fill(id));
