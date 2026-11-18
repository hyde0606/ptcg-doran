# 합친 카드용 한글판 그림 찾기 (build-cards-kr.py 다음에 실행)
# 사이트 카드의 한글판 그림(kimg)은 일반 판을 먼저 고르므로, 영문판이 아트·SAR 같은 특별 그림이면 그림이 달라 합친 카드를 못 만든다.
# 같은 카드의 다른 한글판 중 영문판과 그림 지문이 가장 가까운 판이 같은 그림(지문 차이 ≤ 40)이면 kmix(그 그림 주소), kmr(그 판 레어도)로 덧붙인다.
# 쓰는 법: python tools/add-kmix.py <cards.json> <cards_kr.json> <art_hash.json> [--same-art 40]
#   예) python tools/add-kmix.py public/cards.json "F:\AI\17_포켓몬 카드\data\kr\cards_kr.json" card-src/art_hash.json
import json, re, sys, collections
args = [a for a in sys.argv[1:] if not a.startswith('--')]
SAME_ART = int(sys.argv[sys.argv.index('--same-art') + 1]) if '--same-art' in sys.argv else 40
cards_path, kr_path, hash_path = args[:3]
C = json.load(open(cards_path, encoding='utf-8'))
K = json.load(open(kr_path, encoding='utf-8'))
H = json.load(open(hash_path, encoding='utf-8'))
HE = {a: int(b, 16) for a, b in H['en'].items()}; HK = {a: int(b, 16) for a, b in H['kr'].items()}
hd = lambda e, k: bin(HE[e] ^ HK[k]).count('1') if e in HE and k in HK else 999
sp = lambda s: re.sub(r'\s+', '', s or '')
def lst(x):  # cards_kr.json의 기술·특성은 글자로 된 목록일 때가 있음
    if isinstance(x, list): return x
    try: import ast; v = ast.literal_eval(x or '[]'); return v if isinstance(v, list) else []
    except Exception: return []
akey = lambda k: tuple(sorted(sp(a.get('name')) for a in lst(k.get('attacks')) + lst(k.get('abilities')) if isinstance(a, dict)))
by_img, grp = {}, collections.defaultdict(list)
for k in K:
    if k.get('image_url'): by_img.setdefault(k['image_url'], k)
    grp[(sp(k.get('name')), k.get('tab'), akey(k))].append(k)
st = collections.Counter()
for c in C:
    c.pop('kmix', None); c.pop('kmr', None)
    if not c.get('kimg') or not c.get('img') or c.get('ksa') or (c.get('st') == 'E' and 'Basic' in (c.get('sub') or [])): continue
    k0 = by_img.get(c['kimg'])
    if not k0: st['한글판 없음'] += 1; continue
    best = min(grp[(sp(k0.get('name')), k0.get('tab'), akey(k0))], key=lambda k: hd(c['id'], k['code']))
    if best is not k0 and best.get('image_url') and hd(c['id'], best['code']) <= SAME_ART:
        c['kmix'] = best['image_url']
        if best.get('rarity'): c['kmr'] = best['rarity']
        st['같은 그림 찾음'] += 1
    else: st['같은 그림 없음'] += 1
json.dump(C, open(cards_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(dict(st))
