// 덱 코드 읽기 (worker.js 에서 씀). 공식 사이트 주소·숨은 칸 이름이 바뀌면 여기만 고치면 됨
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const err = (m, status = 400) => json({ error: m }, status);
// 덱 코드: 한국 공식(4-4-4-4)·일본 공식(6-6-6) 덱 코드로 공식 사이트에서 카드 목록을 받아 사이트 카드로 이음.
// 이을 표(public/kprints.json: 한국판 카드 번호·확장팩 번호 → 사이트 카드 id)는 PC에서 올릴 때 함께 올라가고 저장소에는 넣지 않음.
export const DC_KR = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;
export const DC_JP = /^[A-Za-z0-9]{6}-[A-Za-z0-9]{6}-[A-Za-z0-9]{6}$/;
export const DC_UA = 'Mozilla/5.0 (compatible; npcg-deck/1.0)';
export const JP_PICT = /^\/assets\/images\/card_images\/large\/[A-Za-z0-9_-]+\/\d+_[A-Z]_[A-Za-z0-9_]+\.jpg$/;
const JP_ENE = { 草: '풀', 炎: '불꽃', 水: '물', 雷: '번개', 超: '초', 闘: '격투', 悪: '악', 鋼: '강철', 妖: '페어리' };
let KPRINTS = null;
async function kprints(env, base) {
  if (KPRINTS) return KPRINTS;
  const r = await env.ASSETS.fetch(new URL('/kprints.json', base)).catch(() => null);
  if (!r || !r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('덱 코드용 카드 표가 아직 없어요. 관리자에게 알려 주세요.');
  return KPRINTS = await r.json();
}
const dcNz = s => String(s || '').replace(/[^0-9a-zA-Z가-힣]/g, '');
const dcNo = s => String(s || '').split('/')[0].trim().replace(/^0+(?=\d)/, '');
export async function dcFetch(url, init, tries = 2) { // 공식 사이트가 잠깐 안 될 때 한 번 더
  for (let i = 0; ; i++) { try { const r = await fetch(url, init); if (r.ok || i >= tries - 1) return r; } catch (e) { if (i >= tries - 1) throw e; } await new Promise(ok => setTimeout(ok, 400)); }
}
export async function deckKR(code) { // 한국 공식: 덱 레시피 조회 화면이 부르는 것과 같은 주소
  const fd = new FormData(); fd.append('action', 'get_dec_detail'); fd.append('code', code);
  const r = await dcFetch('https://pokemoncard.co.kr/v2/ajax2', { method: 'POST', body: fd, headers: { 'x-requested-with': 'XMLHttpRequest', referer: 'https://pokemoncard.co.kr/recipe/search?code=' + code, origin: 'https://pokemoncard.co.kr', 'user-agent': DC_UA } });
  if (!r.ok) throw new Error('한국 공식 사이트에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.');
  const t = (await r.text()).trim(); if (!t || t === 'null' || t === '[]') return null; // 없는 코드
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!Array.isArray(j)) throw new Error('한국 공식 사이트에서 덱을 받지 못했어요. 잠시 뒤 다시 해 주세요.');
  if (!j.length) return null;
  return j.map(x => { const m = String(x.cardImg || '').match(/\/([^/]+)\/[^/]+$/);
    return { code: String(x.cardNum || ''), name: String(x.cardName || ''), set: m ? m[1] : '', no: dcNo(x.collectoinNum), n: Math.max(1, Math.min(60, parseInt(x.cardCount) || 1)), poke: /포켓몬/.test(String(x.CardType || '')) && !/도구/.test(String(x.CardType || '')) }; });
}
export async function deckJP(code) { // 일본 공식: 덱 보기 화면 속 숨은 칸(카드 번호_장수)과 카드 이름·그림 주소
  const r = await dcFetch(`https://www.pokemon-card.com/deck/confirm.html/deckID/${code}/`, { headers: { 'user-agent': DC_UA, 'accept-language': 'ja' } });
  if (!r.ok) throw new Error('일본 공식 사이트에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.');
  const h = await r.text(), out = [];
  const val = k => (h.match(new RegExp(`name="${k}"[^>]*value="([^"]*)"`)) || h.match(new RegExp(`value="([^"]*)"[^>]*name="${k}"`)) || [])[1] || '';
  const tab = re => { const o = {}; for (const m of h.matchAll(re)) o[m[1]] = m[2].replace(/\\'/g, "'"); return o; };
  const names = tab(/searchItemName\[(\d+)\]\s*=\s*'((?:\\'|[^'])*)'/g), picts = tab(/searchItemCardPict\[(\d+)\]\s*=\s*'((?:\\'|[^'])*)'/g);
  for (const [k, kind] of [['deck_pke', 'P'], ['deck_gds', 'T'], ['deck_tool', 'T'], ['deck_tech', 'T'], ['deck_sup', 'T'], ['deck_sta', 'T'], ['deck_ene', 'E'], ['deck_ajs', 'T']])
    for (const it of val(k).split('-')) { const [id, n] = it.split('_'); if (!/^\d+$/.test(id || '')) continue;
      const nm = names[id] || '', m = nm.match(/\(([A-Za-z0-9-]+)\s+(\d+)\/[^)]*\)\s*$/), p = picts[id] || '', pp = p.replace(/^https?:\/\/[^/]+/, '');
      out.push({ jid: id, name: nm.replace(/\s*\([^)]*\)\s*$/, ''), set: m ? m[1] : '', no: m ? dcNo(m[2]) : '', n: Math.max(1, Math.min(60, parseInt(n) || 1)), kind, pict: JP_PICT.test(pp) ? pp : '' }); }
  return out.length ? out : null;
}
export async function deckCode(env, req, code) {
  const kr = DC_KR.test(code), ck = new Request(`https://deckcode.cache/${kr ? 'kr' : 'jp'}/${code}`);
  let raw = null; const hit = await caches.default.match(ck).catch(() => null); if (hit) raw = await hit.json().catch(() => null);
  if (!raw) { raw = { items: kr ? await deckKR(code) : await deckJP(code) }; if (raw.items) await caches.default.put(ck, new Response(JSON.stringify(raw), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } })).catch(() => {}); }
  if (!raw.items) return err(kr ? '한국 공식 사이트에서 이 덱 코드를 찾지 못했어요. 코드를 다시 확인해 주세요.' : '일본 공식 사이트에서 이 덱 코드를 찾지 못했어요. 코드를 다시 확인해 주세요.', 404);
  const T = await kprints(env, req.url), bySet = x => x.set && x.no ? T.s[x.set.toUpperCase() + '|' + x.no] : null;
  const byName = nm => T.n[dcNz(nm)] || T.n[dcNz(String(nm).replace(/\s*\(.*?\)\s*$/, ''))];
  const items = raw.items.map(x => {
    let v = null, jp = null;
    if (kr) { v = T.c[x.code] || bySet(x); if (!v && !x.poke) v = byName(x.name); if (!v) v = '!' + x.name; }
    else { jp = x.name; const e = x.kind === 'E' && x.name.match(/^基本(.)エネルギー$/);
      if (e && JP_ENE[e[1]]) v = byName(`기본 ${JP_ENE[e[1]]} 에너지`) || `!기본 ${JP_ENE[e[1]]} 에너지`;
      else if (x.kind === 'P') v = bySet(x); } // 일본판 트레이너스는 한국판과 번호가 다를 때가 있어 그림으로 찾음 (화면에서)
    const o = { n: x.n }; if (v && v[0] !== '!') o.id = v; else if (v) o.kn = v.slice(1); if (jp) o.jp = jp; if (!v && x.pict) o.pict = x.pict;
    return o;
  });
  return json({ src: kr ? 'kr' : 'jp', code, items });
}
