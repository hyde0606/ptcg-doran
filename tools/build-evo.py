# 진화 정보(어느 포켓몬에서 진화하는지) 표를 만든다: src/evo.json
# 카드 자료(public/cards.json)에는 진화 전 이름이 없어서, 공개 자료(PokemonTCG/pokemon-tcg-data)의 evolvesFrom 을 받아 붙인다.
# 서버가 판을 시작할 때 이 표로 카드마다 ef(진화 전 영문 이름)·efk(한글 이름)를, 2진화는 ef2·efk2(기본 포켓몬)도 붙인다.
# 사용: python tools/build-evo.py public/cards.json [cards_en.json(한글 종 이름 보충용, 없어도 됨)]
# 새 카드 자료를 올린 뒤 다시 돌리고 src/evo.json 을 커밋하면 된다.
import collections, json, sys, urllib.request

RAW = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/'
cards = json.load(open(sys.argv[1], encoding='utf-8'))
en_all = json.load(open(sys.argv[2], encoding='utf-8')) if len(sys.argv) > 2 else []
norm = lambda s: (s or '').replace(' ', '').replace('Antiuqe', 'Antique')  # 'Nidoran ♀' / 'Nidoran♀', 원본 오타
strip_ex = lambda s: (s or '').removesuffix(' ex')

sets = sorted({c['id'].rsplit('-', 1)[0] for c in cards if not c['id'].startswith('kr-')})
ef = {}
for s in sets:
    try: data = json.loads(urllib.request.urlopen(RAW + s + '.json', timeout=60).read())
    except Exception as e: print('건너뜀', s, e); continue
    for c in data:
        if c.get('evolvesFrom'): ef[c['id']] = c['evolvesFrom']

kn_of = collections.defaultdict(collections.Counter)  # 영문 이름 → 한글 이름 (트레이너스 화석 카드 포함)
for c in cards:
    if c.get('kn'): kn_of[norm(c['n'])][c['kn']] += 1
for c in en_all:
    if c.get('supertype') == 'Pokémon' and c.get('species_ko') and not kn_of.get(norm(c['name'])): kn_of[norm(c['name'])][c['species_ko'][0]] += 1
ko = lambda n: kn_of[norm(n)].most_common(1)[0][0] if kn_of.get(norm(n)) else None

by_id, by_en, by_ko = {}, {}, {}
stage = [c for c in cards if c['st'] == 'P' and 'Basic' not in (c.get('sub') or []) and (c.get('sub') or [])]
for c in stage:
    e = ef.get(c['id'])
    if e: e = e.replace('Antiuqe', 'Antique')
    if e:
        by_id[c['id']] = [e, ko(e)]
        by_en.setdefault(c['n'], [e, ko(e)])
        if c.get('kn'): by_ko.setdefault(strip_ex(c['kn']), [e, ko(e)])
MANUAL = {'kr-SVP000000067': ['Wooper', '우파']}  # 누오: 같은 이름 영문 카드가 H·I·J에 없음
for k, v in MANUAL.items():
    if any(c['id'] == k for c in stage): by_id[k] = v
miss = []
for c in stage:  # 한국 전용 카드 등: 같은 이름 카드에서 빌림
    if c['id'] in by_id: continue
    e = by_en.get(c['n']) or by_ko.get(strip_ex(c.get('kn')))
    if e: by_id[c['id']] = e
    else: miss.append(f"{c['id']} {c.get('kn') or c['n']}")
json.dump({'id': by_id, 'en': by_en, 'ko': by_ko}, open('src/evo.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
print(f'진화 카드 {len(stage)}장 중 {len(by_id)}장 채움. 못 찾은 카드 {len(miss)}장:', ', '.join(miss))
