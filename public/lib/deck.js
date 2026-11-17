// 덱 리스트 읽기와 덱 규칙 검사 (서버·화면 공용)
const ENERGY_SYM = { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal' };

export function indexCards(cards) {
  const byId = {}, bySetNo = {}, byName = {};
  for (const c of cards) {
    byId[c.id] = c;
    if (c.set) bySetNo[(c.set + ' ' + c.no).toUpperCase()] = c;
    (byName[c.n.toLowerCase()] ||= []).push(c);
  }
  return { byId, bySetNo, byName };
}

// PTCGL 형식: "4 Pikachu ex SVP 106", "Pokémon: 12" 같은 줄은 건너뜀
export function parseDeckList(text, idx) {
  const out = [], bad = [];
  for (let line of String(text).split(/\r?\n/)) {
    line = line.trim();
    if (!line || /^(pok[eé]mon|trainer|energy|total cards|포켓몬|트레이너스|에너지)\b.*:\s*\d*$/i.test(line) || /^\*\*/.test(line)) continue;
    const m = line.match(/^(\d+)\s+(.+?)(?:\s+([A-Z][A-Z0-9-]{1,6})\s+([A-Z]*\d+[a-z]?))?$/);
    if (!m) { bad.push(line); continue; }
    const n = +m[1]; let name = m[2].trim(); let card = null;
    if (m[3]) card = idx.bySetNo[(m[3] + ' ' + m[4].replace(/^0+/, '')).toUpperCase()] || idx.bySetNo[(m[3] + ' ' + m[4]).toUpperCase()];
    name = name.replace(/\{(\w)\}/g, (_, k) => ENERGY_SYM[k] || k).replace(/ Energy Energy$/, ' Energy');
    if (!card) {
      const cand = idx.byName[name.toLowerCase()] || idx.byName[('Basic ' + name).toLowerCase()] || idx.byName[name.replace(/^Basic /, '').toLowerCase()];
      if (cand) card = cand[cand.length - 1];
    }
    if (!card && m[3]) { const cand = idx.byName[(m[2] + ' ' + m[3]).trim().toLowerCase()]; if (cand) card = cand[0]; }
    if (!card) { bad.push(line); continue; }
    out.push({ id: card.id, n });
  }
  return { list: out, bad };
}

const isBasicEnergy = c => c.st === 'E' && (c.sub || []).includes('Basic');

export function checkDeck(list, idx) {
  const problems = [];
  let total = 0, basics = 0, ace = 0;
  const byName = {};
  for (const { id, n } of list) {
    const c = idx.byId[id]; if (!c) { problems.push(`모르는 카드: ${id}`); continue; }
    total += n;
    if (c.st === 'P' && (c.sub || []).includes('Basic')) basics += n;
    if ((c.sub || []).includes('ACE SPEC')) ace += n;
    if (!isBasicEnergy(c)) byName[c.n] = (byName[c.n] || 0) + n;
    if (!isBasicEnergy(c) && !['H', 'I', 'J'].includes(c.rm)) problems.push(`스탠다드에서 못 쓰는 카드: ${c.n} (${c.rm || '마크 없음'})`);
  }
  if (total !== 60) problems.push(`덱은 60장이어야 해요 (지금 ${total}장).`);
  if (!basics) problems.push('기본 포켓몬이 1장 이상 있어야 해요.');
  if (ace > 1) problems.push(`에이스 스펙은 1장까지예요 (지금 ${ace}장).`);
  for (const [n, k] of Object.entries(byName)) if (k > 4) problems.push(`같은 이름은 4장까지예요: ${n} ${k}장`);
  return { ok: problems.length === 0, problems, total };
}

export const expand = list => list.flatMap(({ id, n }) => Array(n).fill(id));
