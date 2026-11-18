# 덱 코드 → 사이트 카드 표 (public/kprints.json, 저장소 밖)
# 한국판 카드 자료(cards_kr.json)의 카드 번호(BS…)·확장팩 기호+번호를 사이트 카드 id로 잇는다.
# 사이트에 없는 SV·MEGA 시기 카드는 '!'+한글 이름. 트레이너스·에너지는 이름으로도 찾게 n 표를 같이 둔다.
# 쓰는 법: python mkprints.py <cards.json> <cards_kr.json> <나갈 kprints.json>
import json, re, sys, collections
C = json.load(open(sys.argv[1], encoding='utf-8')); K = json.load(open(sys.argv[2], encoding='utf-8'))
byId = {c['id']: c for c in C}
nz = lambda s: re.sub(r'[^0-9a-zA-Z가-힣]', '', s or '')
voc = set(nz(a.get('n')) for c in C for a in (c.get('kat') or []) + (c.get('kab') or []))
keyC = lambda c: (nz(c.get('kn')), tuple(sorted(nz(a.get('n')) for a in (c.get('kat') or []) + (c.get('kab') or []))))
keyK = lambda k, nm: (nz(nm), tuple(sorted(x for x in (nz(a.get('name')) for a in (k.get('attacks') or []) + (k.get('abilities') or [])) if x in voc)))
idx = collections.defaultdict(list)
for c in C:
    if c.get('kn'): idx[keyC(c)].append(c['id'])
no = lambda s: (s or '').lstrip('0') or '0'
bySetNo = {((c.get('kset') or '').upper(), no(c.get('kno'))): c['id'] for c in C if c.get('kset')}
byCode = {c['id'][3:]: c['id'] for c in C if c['id'].startswith('kr-')}
names = {}
for c in C:
    if c.get('st') in ('T', 'E') and c.get('kn'): names.setdefault(nz(c['kn']), c['id'])
NEW = ('SV', 'MEGA')
out_c, out_s, hit, miss = {}, {}, 0, 0
for k in K:
    sk = ((k.get('set_code') or '').upper(), no(k.get('number')))
    cid = byCode.get(k['code']) or bySetNo.get(sk)
    if not cid:
        ids = idx.get(keyK(k, k['name'])) or idx.get(keyK(k, re.sub(r'\s*\(.*?\)\s*$', '', k['name'] or '')))
        cid = ids[0] if ids else None
    if not cid and (k.get('tab') != '포켓몬'):
        cid = names.get(nz(k['name'])) or names.get(nz(re.sub(r'\s*\(.*?\)\s*$', '', k['name'] or '')))
    if cid: v = cid; hit += 1
    elif (k.get('series_dir') or '') in NEW: v = '!' + k['name']; miss += 1
    else: continue
    out_c[k['code']] = v
    if sk[0] and k.get('number'): out_s.setdefault(sk[0] + '|' + sk[1], v)
json.dump({'v': 1, 'c': out_c, 's': out_s, 'n': names}, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('사이트 카드로 이어짐', hit, '· 사이트에 없는 SV·MEGA 카드', miss, '· 번호 표', len(out_s), '· 이름 표', len(names))
