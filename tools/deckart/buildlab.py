# 덤프 → 특징 + 이름표 (카드 id / 사이트에 없는 한글판 이름)
import json, re, collections, numpy as np
D = '/mnt/user-data/uploads/AI/18_포켓몬 대전/card-src/'
meta = json.load(open(D + 'artdump.json', encoding='utf-8')); W, H = meta['w'], meta['h']; items = meta['items']
raw = np.fromfile(D + 'artdump.bin', np.uint8).reshape(len(items), H, W, 3)
C = json.load(open('/home/claude/ptcg-doran/public/cards.json')); byId = {c['id']: c for c in C}
K = json.load(open('/mnt/user-data/uploads/AI/17_포켓몬 카드/data/kr/cards_kr.json')); byUrl = {k['image_url']: k for k in K}
nz = lambda s: re.sub(r'[^0-9a-zA-Z가-힣]', '', s or '')
voc = set(nz(a.get('n')) for c in C for a in (c.get('kat') or []) + (c.get('kab') or []))
keyC = lambda c: (nz(c.get('kn')), tuple(sorted(nz(a.get('n')) for a in (c.get('kat') or []) + (c.get('kab') or []))))
keyK = lambda k: (nz(k['name']), tuple(sorted(x for x in (nz(a.get('name')) for a in (k['attacks'] or []) + (k['abilities'] or [])) if x in voc)))
idx = collections.defaultdict(list)
for c in C:
    if c.get('kn'): idx[keyC(c)].append(c['id'])
bySetNo = {(c.get('kset'), (c.get('kno') or '').lstrip('0')): c['id'] for c in C if c.get('kset')}
lab = []
for it in items:
    if it.get('id'): lab.append((it['id'], byId[it['id']].get('kn') or byId[it['id']]['n'])); continue
    k = byUrl.get(it['url']); cid = bySetNo.get((it.get('set'), (it.get('no') or '').lstrip('0')))
    if not cid and k:
        ids = idx.get(keyK(k))
        if not ids:  # '보스의 지령(게치스)' 처럼 괄호로 그림 이름만 붙은 것
            k2 = dict(k); k2['name'] = re.sub(r'\s*\(.*?\)\s*$', '', k['name'] or ''); ids = idx.get(keyK(k2))
        cid = ids[0] if ids else None
    lab.append((cid, (byId[cid].get('kn') if cid else None) or it.get('name')))
print('그림', len(items), '· 사이트 카드로 이어진 것', sum(1 for l in lab if l[0]), '· 사이트에 없는 한글판', sum(1 for l in lab if not l[0]))
np.save('dump_raw.npy', raw); json.dump(lab, open('dump_lab.json', 'w'), ensure_ascii=False)
