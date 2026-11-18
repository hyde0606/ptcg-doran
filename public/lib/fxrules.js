// 카드 글(한국어)에서 읽는 규칙 조각. 서버(engine.js)와 화면(app.js)이 같은 함수를 써서 계산이 늘 같게 한다.
// 모두 '도우미'용: 모르는 글이면 null 을 돌려주고, 그때는 예전처럼 사람이 직접 처리한다.
const TY = { 풀: 'Grass', 불꽃: 'Fire', 물: 'Water', 번개: 'Lightning', 초: 'Psychic', 격투: 'Fighting', 악: 'Darkness', 강철: 'Metal', 드래곤: 'Dragon', 무색: 'Colorless', 페어리: 'Fairy' };
export const tyOf = ko => TY[ko] || null;
const has = (c, s) => !!c && (c.sub || []).includes(s);
const txt = c => (c && (c.kr || c.r) || []).join(' ');
export const koName = c => !c ? '' : (c.kn || c.ko || c.n || '');
const norm = s => String(s || '').replace(/\s+/g, '').replace(/ex$/i, '');
export const basicEnergyType = c => !c || c.st !== 'E' ? null : (String(c.n).match(/^Basic (\w+) Energy$/) || [])[1] || null;

// ----- 스타디움 -----
// { abLoss: 'evolved' | 타입 | null, cage, forest: 타입 | null, ruins: 카운터 수 | null, tree }
export function stadRules(c) {
  const t = txt(c), out = { abLoss: null, cage: false, forest: null, ruins: null, tree: false };
  if (!c) return out;
  if (/진화 포켓몬 전원은 특성이 모두 없어진다/.test(t)) out.abLoss = 'evolved';
  let m = t.match(/필드의 \((\S+?)\) 포켓몬 전원의 특성은 모두 없어진다/); if (m && tyOf(m[1])) out.abLoss = tyOf(m[1]);
  if (/벤치 포켓몬 전원은 상대의 기술이나 특성의 효과로 데미지 카운터를 올리지 않는다/.test(t)) out.cage = true;
  m = t.match(/\((\S+?)\) 포켓몬 전원은 필드에 처음 나왔을 때(?:\([^)]*\))?라도 \(\1\) 포켓몬으로 진화할 수 있다/); if (m && tyOf(m[1])) out.forest = tyOf(m[1]);
  m = t.match(/기본 포켓몬\(\(악\) 포켓몬은 제외\)을 벤치로 내보낼 때마다 그 포켓몬에게 데미지 카운터를 (\d+)개 올린다/); if (m) out.ruins = +m[1];
  if (/자신의 차례마다 1번 자신의 필드의 기본 포켓몬 1마리에서 진화하는 1진화 포켓몬을 자신의 덱에서 1장 선택해서/.test(t)) out.tree = true;
  return out;
}
// 스타디움 때문에 이 포켓몬(맨 위 카드)의 특성이 없어졌는지
export function abLost(rules, top) {
  if (!rules || !rules.abLoss || !top || top.st !== 'P') return false;
  if (rules.abLoss === 'evolved') return !has(top, 'Basic');
  return (top.ty || []).includes(rules.abLoss);
}
// 위험한 폐허: 이 카드를 벤치로 낼 때 카운터를 올리는지 (기본 포켓몬, 악 제외)
export const ruinsHits = (rules, c) => !!(rules && rules.ruins && c && c.st === 'P' && has(c, 'Basic') && !(c.ty || []).includes('Darkness'));
// '이 포켓몬은 벤치에 있는 한, 기술의 데미지를 받지 않는다'
export const benchImmune = c => /벤치에 있는 한, 기술의 데미지를 받지 않는다/.test(txt(c));

// ----- 진화 -----
// 진화 카드 c 가 base(맨 위 카드) 위에 올라갈 수 있는지. 자료가 없으면 null (모름)
export function evoOk(c, base, two = false) {
  if (!c || !base) return null;
  const en = two ? c.ef2 : c.ef, ko = two ? c.efk2 : c.efk;
  if (!en && !ko) return null;
  return (!!en && norm(base.n) === norm(en)) || (!!ko && norm(koName(base)) === norm(ko));
}
// 서버가 판을 시작할 때: 진화 카드에 진화 전 이름을 붙임. ef·efk (1진화 전), 2진화는 ef2·efk2 (기본 포켓몬). EVO = src/evo.json
export function withEvo(c, EVO) {
  if (!c || !EVO || c.st !== 'P' || (c.sub || []).includes('Basic')) return c;
  const strip = n => String(n || '').replace(/ ex$/, '');
  const e = EVO.id[c.id] || EVO.en[c.n] || EVO.ko[strip(c.kn)]; if (!e) return c;
  const out = { ...c, ef: e[0], ...(e[1] ? { efk: e[1] } : {}) };
  if ((c.sub || []).includes('Stage 2')) { const e2 = EVO.en[e[0]] || (e[1] && EVO.ko[e[1]]); if (e2) { out.ef2 = e2[0]; if (e2[1]) out.efk2 = e2[1]; } }
  return out;
}
export const evoName = (c, two = false) => (two ? (c.efk2 || c.ef2) : (c.efk || c.ef)) || '';

// ----- 기술 -----
// 동전 기술: { n: 횟수 | 'tails'(뒷면이 나올 때까지) | 'en'(이 포켓몬 에너지 수) | 'en2'(서로의 배틀 포켓몬 에너지 수), per, add(기본 데미지에 더함) }
export function coinSpec(t) {
  const m = String(t || '').match(/^(동전을 (\d+)번 던져서|뒷면이 나올 때까지 동전을 던져서|이 포켓몬에게 붙어 있는 에너지의 개수만큼 동전을 던져서|서로의 배틀 포켓몬에게 붙어 있는 에너지의 개수만큼 동전을 던져서) 앞면이 나온 수 × (\d+)데미지를 (준다|추가한다)\./);
  if (!m) return null;
  const n = m[2] ? +m[2] : /뒷면이 나올 때까지/.test(m[1]) ? 'tails' : /^이 포켓몬/.test(m[1]) ? 'en' : 'en2';
  return { n, per: +m[3], add: m[4] === '추가한다' };
}
export const coinSpecLabel = sp => `${sp.n === 'tails' ? '뒷면이 나올 때까지' : sp.n === 'en' ? '이 포켓몬 에너지 수만큼' : sp.n === 'en2' ? '서로의 배틀 포켓몬 에너지 수만큼' : sp.n + '번'} 동전 · 앞면마다 ${sp.add ? '+' : ''}${sp.per}`;
// 판 위 수로 늘어나는 데미지: ctx = { selfEn, oppEn } (배틀 포켓몬에 붙은 에너지 수) → { add, why } | null
export function extraDmg(t, ctx) {
  const m = String(t || '').match(/^(서로의 배틀 포켓몬|이 포켓몬|상대의 배틀 포켓몬)에게 붙어 있는 에너지의 개수 × (\d+)데미지를 추가한다\./);
  if (!m || !ctx) return null;
  const k = m[1] === '이 포켓몬' ? ctx.selfEn : m[1] === '상대의 배틀 포켓몬' ? ctx.oppEn : ctx.selfEn + ctx.oppEn, per = +m[2];
  return { add: k * per, why: `${m[1] === '서로의 배틀 포켓몬' ? '서로의 배틀 포켓몬' : m[1] === '이 포켓몬' ? '이 포켓몬' : '상대 배틀 포켓몬'} 에너지 ${k}개 × ${per}` };
}
// '상대의 포켓몬 1마리에게 N데미지를 준다' (맞을 포켓몬을 고르는 기술) → N
export function targetDmg(t) { const m = String(t || '').match(/^상대의 포켓몬 1마리에게 (\d+)데미지를 준다\./); return m ? +m[1] : null; }
// 조건 없이 상대 배틀 포켓몬을 특수상태로 만드는 기술 (글 전체가 그 한 문장일 때만)
const COND = { 잠듦: 'asleep', 혼란: 'confused', 마비: 'paralyzed', 독: 'poisoned', 화상: 'burned' };
export function statusOf(t) {
  const m = String(t || '').trim().match(/^상대의 배틀 포켓몬을 (잠듦|혼란|마비|독|화상)(?:과 (잠듦|혼란|마비|독|화상))?(?:으로|로) 만든다\.$/);
  return m ? [COND[m[1]], ...(m[2] ? [COND[m[2]]] : [])] : null;
}
// '상대의 다음 차례에 상대는 패에서 아이템(서포트)을 꺼내서 사용할 수 없다' → 'item' | 'sup'
export function lockOf(t) { const m = String(t || '').match(/상대의 다음 차례에 상대는 패에서 (아이템|서포트)(?:을|를) 꺼내서 사용할 수 없다/); return m ? (m[1] === '아이템' ? 'item' : 'sup') : null; }
export const LOCK_KO = { item: '아이템', sup: '서포트' };

// ----- 특성·트레이너스 조건 (경고용) -----
// 특성 글 → [{ k, …}] : 배틀필드에 있을 때 / 벤치에 있을 때 / 지난 차례 기절 / (타입) 에너지 / 패에서 벤치로 낸 차례 / 같은 이름 특성
export function abilityConds(t) {
  const s = String(t || ''), out = [];
  if (/이 포켓몬이 배틀필드에 있다면/.test(s)) out.push({ k: 'active' });
  if (/이 포켓몬이 벤치에 있다면/.test(s)) out.push({ k: 'bench' });
  if (/상대의 이전 차례에 자신의 포켓몬이 기절했다면/.test(s)) out.push({ k: 'ko' });
  let m = s.match(/이 포켓몬에게 \((\S+?)\) 에너지가 붙어 있다면/); if (m && tyOf(m[1])) out.push({ k: 'energy', ty: tyOf(m[1]), ko: m[1] });
  if (/자신의 차례에 이 카드를 패에서 벤치로 내보냈을 때/.test(s)) out.push({ k: 'benched' });
  m = s.match(/다른 「([^」]+)」(?:을|를) 사용(?:했다면|한 차례)/); if (m) out.push({ k: 'name', n: m[1] });
  m = s.match(/이름에 「([^」]+)」(?:이|가) 적힌 특성을 사용했다면/); if (m) out.push({ k: 'nameHas', n: m[1] });
  if (/자신의 차례에/.test(s)) out.push({ k: 'myTurn' });
  return out;
}
// 트레이너스 글 → [{ k, n }] : 지난 차례 기절했을 때만 / 상대(자신) 남은 프라이즈 N장 이하 / 손패 N장 트래시
export function trainerConds(c) {
  const s = txt(c), out = [];
  if (/상대의 이전 차례에 자신의 포켓몬이 기절하지 않으면 사용할 수 없다/.test(s)) out.push({ k: 'ko' });
  let m = s.match(/상대의 남은 프라이즈 장수가 (\d+)장 이하일 때만 사용할 수 있다/); if (m) out.push({ k: 'oppPrizes', n: +m[1] });
  m = s.match(/자신의 남은 프라이즈 장수가 (\d+)장 이하일 때만 사용할 수 있다/); if (m) out.push({ k: 'myPrizes', n: +m[1] });
  m = s.match(/이 카드는 자신의 패를 (\d+)장 트래쉬하지 않으면 사용할 수 없다/); if (m) out.push({ k: 'handCost', n: +m[1] });
  return out;
}

// ----- 뽑기·패 되돌리기 -----
// { who: 'me'|'opp'|'both', how: 'deck'(덱에 넣고 섞기)|'bottom'(섞어서 덱 아래로)|'discard', n: [내가, 상대가], more?: { mine|opp, eq|le, m, to } }
export function parseReset(t) {
  const s = String(t || '');
  let m;
  if ((m = s.match(/자신의 패를 모두 덱으로 되돌리고 섞는다\. 그 뒤, 덱을 (\d+)장 뽑는다\.(?: (자신|상대)의 남은 프라이즈 장수가 (\d+)장(이라면| 이하라면) 뽑는 장수는 (\d+)장이 된다\.)?/)))
    return { who: 'me', how: 'deck', n: [+m[1], 0], ...(m[2] ? { more: { side: m[2] === '자신' ? 'me' : 'opp', le: m[4] !== '이라면', m: +m[3], to: +m[5] } } : {}) };
  if ((m = s.match(/자신의 패를 모두 트래쉬하고,? (?:자신의 )?덱을 (\d+)장 뽑는다\./))) return { who: 'me', how: 'discard', n: [+m[1], 0] };
  if ((m = s.match(/서로의 플레이어는 각각 (?:자신의 )?패를 모두 덱으로 되돌리고 섞는다\. 그 뒤, (?:각각 덱을 (\d+)장|자신은 (\d+)장 상대는 (\d+)장 덱을) 뽑는다\./)))
    return { who: 'both', how: 'deck', n: m[1] ? [+m[1], +m[1]] : [+m[2], +m[3]] };
  if ((m = s.match(/상대는 상대 자신의 패를 모두 (뒷면으로 하여 섞고 덱의 아래로 되돌린다|덱으로 되돌리고 섞는다)\. 그 뒤, 상대는 덱을 (\d+)장 뽑는다\./)))
    return { who: 'opp', how: /아래로/.test(m[1]) ? 'bottom' : 'deck', n: [0, +m[2]] };
  return null;
}
// 늘어나는 장수 반영 (릴리에의 결심: 자신의 남은 프라이즈가 6장이면 8장)
export function resetCount(sp, myPrizes, oppPrizes) {
  if (!sp.more) return sp.n;
  const k = sp.more.side === 'me' ? myPrizes : oppPrizes, hit = sp.more.le ? k <= sp.more.m : k === sp.more.m;
  return hit ? [sp.more.to, sp.n[1]] : sp.n;
}
// 단순 뽑기 '자신의 덱을 N장 뽑는다' (상대·서로가 뽑는 글, 패 되돌리기 글은 빼고) → N
export function parseDraw(t) {
  const s = String(t || ''); if (parseReset(s)) return null;
  const m = s.match(/(?:^|[.,] )(?:자신의 )?덱을 (\d+)장 뽑는다/); return m ? +m[1] : null;
}
