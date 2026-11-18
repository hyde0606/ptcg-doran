// 카드 효과 도우미: 카드 글(한국어)을 읽어 흔한 효과("덱에서 ○○를 N장까지 골라 보여주고 패로" 등)를 미리 차려 준다.
// 막지는 않는다. 조건에 맞는 카드를 진하게 보이고, 몇 장·어디로·덱 섞기를 단추 하나로 묶을 뿐 판정은 사람(상대 동의)이 한다.
const TY = { 풀: 'Grass', 불꽃: 'Fire', 물: 'Water', 번개: 'Lightning', 초: 'Psychic', 격투: 'Fighting', 악: 'Darkness', 강철: 'Metal', 드래곤: 'Dragon', 무색: 'Colorless', 페어리: 'Fairy' };
const has = (c, s) => (c.sub || []).includes(s);
const isP = c => c.st === 'P', isE = c => c.st === 'E', isT = c => c.st === 'T';
const basicType = c => (String(c.n).match(/^Basic (\w+) Energy$/) || [])[1] || null;
const ruleBox = c => isP(c) && (has(c, 'ex') || has(c, 'MEGA') || has(c, 'V') || has(c, 'VSTAR') || has(c, 'VMAX'));

// 조건 글 → 카드 시험 함수. 모르는 글이면 null (그때는 모든 카드를 똑같이 보여 줌)
// ctx.name(c): 화면의 한국어 이름, ctx.oppNames: 상대 필드 포켓몬 이름들
export function condTest(raw, ctx = {}) {
  const nameOf = c => (ctx.name ? ctx.name(c) : c.kn || c.n) || '';
  let t = String(raw || '').trim().replace(/^자신의 /, '');
  if (!t) return null;
  if (/같은 이름의 포켓몬$/.test(t) && /상대 필드의 포켓몬/.test(t)) { const ns = new Set((ctx.oppNames || []).map(x => x.replace(/ ex$/, ''))); return c => isP(c) && ns.has(nameOf(c).replace(/ ex$/, '')); }
  if (/같은 타입/.test(t)) return null; // 붙은 에너지 등 판 위 상황에 따라 달라짐: 사람이 판단
  // 여러 종류: 「A」「B」「C」 / A와 B / A 또는 B
  const parts = t.split(/」\s*「|」\s*(?:과|와|또는)\s*「|\s+또는\s+|(?<=[가-힣」)])(?:과|와)\s+(?=[「(가-힣0-9])/).map(x => x.trim()).filter(Boolean);
  if (parts.length > 1) {
    const fix = x => { if (x.startsWith('「') && !x.includes('」')) x = x.slice(1); if (x.endsWith('」') && !x.includes('「')) x = x.slice(0, -1); return x; }; // 나눌 때 잘린 낫표 정리
    const fs = parts.map(x => condTest(fix(x), ctx));
    if (fs.some(f => !f)) return null;
    return c => fs.some(f => f(c));
  }
  return one(t, ctx, nameOf);
}
function one(t0, ctx, nameOf) {
  let t = t0.trim();
  const ands = [];
  let m;
  // 끝에 붙는 빼기: 포켓몬(「룰을 가진 포켓몬」은 제외)
  if ((m = t.match(/^(.*?)\(「룰을 가진 포켓몬」은 제외\)$/))) { ands.push(c => !ruleBox(c)); t = m[1]; }
  if ((m = t.match(/^(.*?)\(특성을 가진 포켓몬은 제외\)$/))) { ands.push(c => !(c.ab && c.ab.length)); t = m[1]; }
  for (;;) { // 앞에 붙는 꾸밈말
    if ((m = t.match(/^(?:카드 )?이름에 「([^」]+)」(?:이|가) 적힌 (.+)$/))) { const w = m[1]; ands.push(c => nameOf(c).includes(w)); t = m[2]; continue; }
    if ((m = t.match(/^HP가 「(\d+)」\s*이하인 (.+)$/))) { const n = +m[1]; ands.push(c => (c.hp || 0) <= n); t = m[2]; continue; }
    if ((m = t.match(/^저항력이 \((\S+?)\) 타입인 (.+)$/))) { const ty = TY[m[1]]; ands.push(c => (c.rs || []).some(r => r[0] === ty)); t = m[2]; continue; }
    if ((m = t.match(/^기본 포켓몬인 (.+)$/))) { ands.push(c => isP(c) && has(c, 'Basic')); t = m[1]; continue; }
    if ((m = t.match(/^진화 포켓몬인 (.+)$/))) { ands.push(c => isP(c) && !has(c, 'Basic')); t = m[1]; continue; }
    if ((m = t.match(/^각각 다른 타입의 (.+)$/))) { t = m[1]; continue; }
    if ((m = t.match(/^\((\S+?)\) 타입의 (.+)$/)) || (m = t.match(/^\((\S+?)\) (포켓몬.*|기본 포켓몬|진화 포켓몬|1진화 포켓몬|2진화 포켓몬)$/))) { const ty = TY[m[1]]; if (!ty) return null; ands.push(c => (c.ty || []).includes(ty)); t = m[2]; continue; }
    break;
  }
  const base = noun(t, nameOf); if (!base) return null;
  return c => base(c) && ands.every(f => f(c));
}
function noun(t0, nameOf) {
  const t = t0.replace(/^「(.*)」$/, '$1').trim();
  const B = {
    '원하는 카드': () => true, '카드': () => true,
    '포켓몬': isP, '기본 포켓몬': c => isP(c) && has(c, 'Basic'), '진화 포켓몬': c => isP(c) && !has(c, 'Basic'),
    '1진화 포켓몬': c => isP(c) && has(c, 'Stage 1'), '2진화 포켓몬': c => isP(c) && has(c, 'Stage 2'),
    '포켓몬 ex': c => isP(c) && has(c, 'ex'), '메가진화 ex': c => isP(c) && has(c, 'MEGA'), '메가진화 포켓몬 ex': c => isP(c) && has(c, 'MEGA'),
    '에너지': isE, '기본 에너지': c => isE(c) && has(c, 'Basic'), '특수 에너지': c => isE(c) && !has(c, 'Basic'),
    '트레이너스': isT, '서포트': c => has(c, 'Supporter'), '아이템': c => has(c, 'Item'), '스타디움': c => has(c, 'Stadium'), '포켓몬의 도구': c => has(c, 'Pokémon Tool'),
  };
  if (B[t]) return B[t];
  let m;
  if ((m = t.match(/^기본 \((\S+?)\) 에너지$/))) { const ty = TY[m[1]]; return ty ? c => isE(c) && has(c, 'Basic') && basicType(c) === ty : null; }
  if ((m = t.match(/^「?(테라스탈|미래|고대)」?의 포켓몬$/))) { const s = { 테라스탈: 'Tera', 미래: 'Future', 고대: 'Ancient' }[m[1]]; return c => isP(c) && has(c, s); }
  if ((m = t.match(/^「?([^「」]+?)의 포켓몬」?$/))) { const w = m[1] + '의 '; return c => isP(c) && nameOf(c).startsWith(w); } // 로켓단의 포켓몬, 마리의 포켓몬 …
  if ((m = t.match(/^「?([^「」(]+?)\(『포켓몬 ex』 포함\)」?$/))) { const w = m[1].trim(); return c => nameOf(c) === w || nameOf(c) === w + ' ex'; }
  if (/^[^\s()「」]+(?: [^\s()「」]+){0,3}$/.test(t) && !/포켓몬|에너지|카드|트레이너스|서포트|아이템|스타디움|도구/.test(t) || /^「[^」]+」$/.test(t0.trim())) { const w = t; return c => nameOf(c) === w; } // 카드 이름 하나 (「턱지충이」, 「주리」)
  return null;
}

// "덱에서 찾기" 효과 읽기. 없으면 null.
// { cond, test, max(null=원하는 만큼), to: hand|bench|discard|attach|evolve|top|null, reveal, shuffle, coin, target: self|bench|any, text }
export function parseSearch(text, ctx = {}) {
  const T = String(text || '');
  const m = T.match(/(?:자신의 )?덱에서 (.+?) ?선택(?:해서|한다)\s*(상대에게 보여주고 )?([^.]*)\./);
  if (!m) return null;
  const at = T.indexOf(m[0]), before = T.slice(0, at);
  let what = m[1], pre = null;
  if (/^\d+장(?:씩|까지)?$/.test(what)) { // "이 포켓몬에서 진화하는 카드를 자신의 덱에서 1장 선택해서"
    const pm = before.match(/([^.]*?)(?:을|를) (?:자신의 )?$/); if (!pm) return null; pre = pm[1];
  }
  const shuffle = /덱을 섞는다|남은 덱을 섞고/.test(T);
  const coin = /동전/.test(before.split(/\.\s*/).pop() || '') || /동전을 \d+번 던진다/.test(before) || /앞면이 나온 수/.test(what);
  let cond = '', max = null, upTo = false, cm;
  if (pre != null) { cm = what.match(/^(\d+)장(씩|까지)?$/); cond = pre.replace(/^.*?(?:선택해서|던진다\.) /, '').trim(); max = cm[2] === '씩' ? null : +cm[1]; upTo = cm[2] === '까지'; }
  else if ((cm = what.match(/^(.+?)(?:을|를) (합계 |각각 )?(\d+)장(까지|씩)?(?: 또는 (.+?)(?:을|를) (\d+)장(까지)?)?$/))) {
    cond = cm[1]; const n = +cm[3]; upTo = cm[4] === '까지';
    if (cm[5]) { cond = `${cm[1]} 또는 ${cm[5]}`; max = Math.max(n, +cm[6]); upTo = true; }
    else if (cm[4] === '씩' || cm[2] === '각각 ') { max = n * countKinds(cm[1]); upTo = cm[4] === '까지' || cm[2] === '각각 '; }
    else max = n;
  } else if ((cm = what.match(/^(.+?)(?:을|를) 원하는 만큼$/))) cond = cm[1];
  else if ((cm = what.match(/만큼까지 (?:자신의 )?덱에서 (.+?)(?:을|를)$/)) || (cm = what.match(/^(.+?)(?:을|를)$/))) cond = cm[1];
  else return null;
  const dest = m[3] || '';
  let to = null, target = null;
  if (/패로/.test(dest) && /붙인다/.test(dest)) to = null; // 일부는 손패로, 나머지는 붙이기: 사람이 나눔
  else if (/^패로 가져/.test(dest)) to = 'hand';
  else if (/^벤치로 내보/.test(dest)) to = 'bench';
  else if (/트래쉬한다$/.test(dest)) to = 'discard';
  else if (/붙인다$/.test(dest)) { to = 'attach'; target = /^이 포켓몬에게/.test(dest) ? 'self' : /벤치/.test(dest) ? 'bench' : 'any'; }
  else if (/진화시킨다$/.test(dest)) { to = 'evolve'; target = /^이 (?:포켓몬|「[^」]+」)에게/.test(dest) ? 'self' : 'any'; }
  else if (/덱의 위로 되돌린다/.test(T)) to = 'top';
  cond = cond.replace(/^자신의 /, '');
  const test = /진화하는 카드/.test(cond) ? null : condTest(cond, ctx);
  return { cond, test, max, upTo, to, reveal: !!m[2], shuffle, coin, target, optional: /원한다면/.test(before) || /좋다$/.test(dest) };
}
function countKinds(t) { return Math.max(1, (t.match(/「[^」]+」/g) || []).length || t.split(/(?:과|와) /).length); }

// "덱을 위(아래)에서부터 N장 보고 그 중에서 ○○를 M장 선택해서 …. 남은 카드는 …" (메가레쿠쟈 ex 등)
// { top: N, rest: 'shuffle'(덱에 넣고 섞기) | 'bottom' | 'bottomMix'(섞어서 아래로) | 'discard' | null, …parseSearch 결과 }
export function parseTop(text, ctx = {}) {
  const T = String(text || '');
  const m = T.match(/자신의 덱을 (위|아래)에서부터 (\d+)장 보고 그 중(?:에서)? (.+?선택해서 [^.]*\.)\s*(?:남은 카드는 ([^.]*)\.)?/);
  if (!m) return null;
  const body = m[3].replace(/^(\d+장)을 선택해서/, '카드를 $1 선택해서');
  const sp = parseSearch(`자신의 덱에서 ${body}`, ctx); if (!sp) return null;
  const r = m[4] || '';
  const rest = /덱으로 되돌리고 섞는다/.test(r) ? 'shuffle' : /섞고 덱의 아래로/.test(r) ? 'bottomMix' : /덱의 아래로/.test(r) ? 'bottom' : /트래쉬한다/.test(r) ? 'discard' : null;
  const before = T.slice(0, T.indexOf(m[0]));
  return { ...sp, top: +m[2], bottom: m[1] === '아래', rest, shuffle: false, coin: /동전/.test(before), optional: sp.optional || /원한다면/.test(before) };
}
export const REST_KO = { shuffle: '나머지는 덱에 넣고 섞기', bottom: '나머지 덱 아래로', bottomMix: '나머지 섞어서 덱 아래로', discard: '나머지 트래시로' };

// "이 카드는 자신의 패를 N장 트래쉬하지 않으면 사용할 수 없다" 같은 비용
export function parseCost(text, ctx = {}) {
  const m = String(text || '').match(/자신의 패(?:를|에서 (.+?)(?:을|를)) (\d+)장 트래쉬하지 않으면/);
  if (!m) return null;
  return { n: +m[2], cond: m[1] || '', test: m[1] ? condTest(m[1], ctx) : null };
}

// 사람이 읽는 짧은 안내: 「포켓몬 ex」를 3장까지 → 보여주고 손패로
export const TO_KO = { hand: '손패로', bench: '벤치에 내기', discard: '트래시로', attach: '포켓몬에게 붙이기', evolve: '올려서 진화', top: '덱 위로' };
export const toLabel = sp => sp.to === 'attach' ? (sp.target === 'self' ? '이 포켓몬에게 붙이기' : sp.target === 'bench' ? '벤치 포켓몬에게 붙이기' : '포켓몬에게 붙이기') : sp.to === 'evolve' && sp.target === 'self' ? '이 포켓몬에게 올려 진화' : TO_KO[sp.to];
export function searchLabel(sp) {
  if (sp.top) { const n = sp.max == null ? '원하는 만큼' : `${sp.max}장${sp.upTo ? '까지' : ''}`; return `${sp.bottom ? '아래' : '위'}에서 ${sp.top}장 중 ${sp.cond ? sp.cond + ' ' : ''}${n}${sp.to ? ' · ' + (sp.reveal ? '보여주고 ' : '') + toLabel(sp) : ''}${sp.rest ? ' · ' + REST_KO[sp.rest] : ''}`; }
  const n = sp.max == null ? '원하는 만큼' : `${sp.max}장${sp.upTo ? '까지' : ''}`;
  const to = sp.to ? `${sp.reveal ? '보여주고 ' : ''}${toLabel(sp)}` : '';
  return `${sp.cond ? sp.cond + ' ' : ''}${n}${to ? ' · ' + to : ''}${sp.shuffle ? ' · 덱 섞기' : ''}`;
}
