# 영문 기준 public/cards.json 에 한글 카드 자료를 덧붙인다. (원본 자료는 읽기만 한다)
#   python tools/build-cards-kr.py <cards_kr.json> --en card-src/cards_en.json --hash card-src/art_hash.json [--out public/cards.json] [-v]
# - cards_kr.json : 한글 카드 자료 (pokemoncard.co.kr 기준)
# - --en          : (선택) 영문 원본. 그림 작가·레어도로 같은 그림의 한글판을 고르는 데 쓴다.
# - --hash        : (선택) tools/kr-art-hash.cjs 가 만든 그림 지문. 트레이너스 짝짓기와 같은 그림 고르기에 쓴다.
# 덧붙이는 칸: kn, kimg, kab, kat, kr, kset, kno  (n 등 기존 칸은 그대로 둔다)
import json, sys, re, collections
sys.stdout.reconfigure(encoding='utf-8')

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
VERBOSE = '-v' in args
if VERBOSE: args.remove('-v')
EN_SRC, HASH_SRC, OUT = opt('--en'), opt('--hash'), opt('--out', 'public/cards.json')
KR_SRC = args[0]

TY = {'풀': 'Grass', '불꽃': 'Fire', '물': 'Water', '번개': 'Lightning', '초': 'Psychic', '격투': 'Fighting',
      '악': 'Darkness', '강철': 'Metal', '드래곤': 'Dragon', '무색': 'Colorless'}
TY_KO = {v: k for k, v in TY.items()}
RAR = {'Common': 'C', 'Uncommon': 'U', 'Rare': 'R', 'Double Rare': 'RR', 'Illustration Rare': 'AR',
       'Special Illustration Rare': 'SAR', 'Ultra Rare': 'SR', 'Hyper Rare': 'UR', 'ACE SPEC Rare': 'ACE',
       'Mega Hyper Rare': 'MUR', 'Black White Rare': 'BWR'}
KIND = {'Supporter': '서포트', 'Item': '아이템', 'Pokémon Tool': '포켓몬의 도구', 'Stadium': '스타디움'}
KFIELDS = ('kn', 'kimg', 'kab', 'kat', 'kr', 'kset', 'kno')
HASH_OK = 70      # 256비트 중 다른 비트가 이 값 이하이면 같은 그림으로 본다
HASH_MARGIN = 12  # 트레이너스: 1등과 (다른 이름) 2등의 차이가 이만큼은 나야 한다

cards = json.load(open(OUT, encoding='utf-8'))
kr_all = json.load(open(KR_SRC, encoding='utf-8'))
en_meta = {}
if EN_SRC:
    for c in json.load(open(EN_SRC, encoding='utf-8')):
        en_meta[c['id']] = {'artist': (c.get('artist') or '').strip().lower(), 'rar': RAR.get(c.get('rarity') or '', '')}
H = json.load(open(HASH_SRC, encoding='utf-8')) if HASH_SRC else {'en': {}, 'kr': {}}
HI = {k: {i: int(h, 16) for i, h in H[k].items()} for k in ('en', 'kr')}
def hd(en_id, kr_code):
    a, b = HI['en'].get(en_id), HI['kr'].get(kr_code)
    return bin(a ^ b).count('1') if a is not None and b is not None else 999

sp = lambda s: re.sub(r'\s+', '', s or '')
def dmg(d): return sp(str(d or '')).replace('×', 'x').replace('X', 'x')
def is_rule(a): return not a.get('cost') and not a.get('damage') and (a.get('name') or '').strip() in ('ex 룰', '메가진화 ex 룰', '테라스탈')
def kr_std(c):
    if c.get('regulation_mark') in ('H', 'I', 'J'): return True
    return re.fullmatch(r'기본\s*\S+\s*에너지', c.get('name') or '') is not None
kr = [c for c in kr_all if kr_std(c)]

def kr_kind(c):
    k = c.get('card_kind') or ''
    for en, ko in KIND.items():
        if k.startswith(ko): return en
    if '특수 에너지' in k: return 'SpecialE'
    return None
def en_kind(c):
    if c['st'] == 'E': return 'SpecialE'
    for s in c.get('sub') or []:
        if s in KIND: return s
    return None

def pk_key_en(c):
    at = tuple(sorted((tuple(sorted(a.get('c') or [])), dmg(a.get('d'))) for a in c.get('at') or []))
    return (c.get('hp'), at, tuple(c.get('wk') or [])[:1], c.get('rt') or 0)
def pk_key_kr(c):
    at = tuple(sorted((tuple(sorted(TY.get(x, x) for x in (a.get('cost') or []))), dmg(a.get('damage'))) for a in c.get('attacks') or [] if not is_rule(a)))
    wk = (c.get('weakness') or {}).get('type')
    return (c.get('hp'), at, (TY.get(wk, wk),) if wk else (), c.get('retreat') or 0)

NORMAL = {None, 'C', 'U', 'R', 'RR', 'ACE'}
def tier(k):
    """일반 판(C·U·R·RR) 먼저, AR, 그다음 SR·SAR·UR 등 특별 판."""
    r = k.get('rarity')
    return 0 if r in NORMAL else 1 if r == 'AR' else 2
def pick(cid, cands):
    """같은 카드 여러 판 중 일반 판을 먼저, 그 안에서 그림이 닮은 판(그림 지문·작가), 그다음 낮은 번호."""
    meta = en_meta.get(cid, {}); art = meta.get('artist', '')
    def score(k):
        s = -min(hd(cid, k['code']), 200)
        if art and (k.get('illustrator') or '').strip().lower() == art: s += 40
        return -s
    return sorted(cands, key=lambda k: (tier(k), score(k), k.get('code') or ''))[0]

kr_pk = collections.defaultdict(list)
kr_tr = collections.defaultdict(list)      # (종류, 레귤레이션) → 카드
kr_by_name = collections.defaultdict(list)  # (종류, 이름) → 카드
for k in kr:
    if k.get('hp'): kr_pk[pk_key_kr(k)].append(k)
    kk = kr_kind(k)
    if kk:
        kr_tr[(kk, k.get('regulation_mark'))].append(k)
        kr_by_name[(kk, sp(k['name']))].append(k)

# 트레이너스·특수 에너지 이름 번역: 판마다 그림이 가장 닮은 한글 카드에 표를 준다
votes = collections.defaultdict(collections.Counter)
for c in cards:
    kk = en_kind(c)
    if not kk or c['st'] == 'P': continue
    pool = kr_tr.get((kk, c.get('rm')), [])
    ranked = sorted(((hd(c['id'], k['code']), sp(k['name'])) for k in pool))
    if not ranked or ranked[0][0] > HASH_OK: continue
    d1, n1 = ranked[0]
    d2 = next((d for d, n in ranked if n != n1), 999)
    if d2 - d1 >= HASH_MARGIN: votes[(kk, c['n'])][n1] += 1
trans = {key: cnt.most_common(1)[0][0] for key, cnt in votes.items()}

def overlay(c, k):
    for f in KFIELDS: c.pop(f, None)
    c['kn'] = (k.get('name') or '').strip()
    if k.get('image_url'): c['kimg'] = k['image_url']
    if k.get('abilities'): c['kab'] = [{'n': a.get('name') or '', 't': a.get('text') or ''} for a in k['abilities']]
    real = [a for a in k.get('attacks') or [] if not is_rule(a)]
    if c.get('at'):
        # 영문 기술 순서에 맞춘다 (비용·데미지가 같은 것끼리)
        kat = [{'n': a.get('name') or '', 't': a.get('text') or '', '_k': (tuple(sorted(TY.get(x, x) for x in (a.get('cost') or []))), dmg(a.get('damage')))} for a in real]
        out = []
        for a in c['at']:
            key = (tuple(sorted(a.get('c') or [])), dmg(a.get('d')))
            j = next((i for i, x in enumerate(kat) if x['_k'] == key), None)
            x = kat.pop(j) if j is not None else (kat.pop(0) if kat else {'n': '', 't': ''})
            out.append({'n': x['n'], 't': x['t']})
        c['kat'] = out
    rules = [a.get('text') for a in k.get('attacks') or [] if is_rule(a) and a.get('text')]
    if c['st'] != 'P' and k.get('text'): rules += [t for t in k['text'].split('\n') if t.strip()]
    if rules: c['kr'] = rules
    c['kset'] = k.get('set_code'); c['kno'] = k.get('number')

stat = collections.Counter(); far = 0
for c in cards:
    k = None
    if c['st'] == 'P':
        cands = kr_pk.get(pk_key_en(c), [])
        sp_ko = sp(c.get('ko') or '')
        if sp_ko: cands = [x for x in cands if sp_ko in sp(x['name'])]
        if cands and len({sp(x['name']) for x in cands}) == 1: k = pick(c['id'], cands)
    elif c['st'] == 'E' and 'Basic' in (c.get('sub') or []):
        ty = (re.match(r'Basic (\w+) Energy', c['n']) or [None, None])[1]
        cands = [x for x in kr if sp(x['name']) == '기본' + TY_KO.get(ty, '?') + '에너지']
        if cands: k = pick(c['id'], cands)
    else:
        kk = en_kind(c); ko = trans.get((kk, c['n']))
        if ko and kr_by_name.get((kk, ko)): k = pick(c['id'], kr_by_name[(kk, ko)])
    if k:
        overlay(c, k); stat[c['st']] += 1
        if hd(c['id'], k['code']) > HASH_OK: far += 1
    else:
        for f in KFIELDS: c.pop(f, None)

used_names = {sp(c['kn']) for c in cards if c.get('kn')}
kr_names = {sp(k['name']) for k in kr}
kr_only = sorted(kr_names - used_names)

json.dump(cards, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
tot = collections.Counter(c['st'] for c in cards)
print(json.dumps({
    'en_total': len(cards), 'matched': sum(stat.values()),
    'by_type': {t: f"{stat[t]}/{tot[t]}" for t in 'PTE'},
    'picked_print_art_differs': far,
    'kr_std_cards': len(kr), 'kr_std_names': len(kr_names), 'kr_only_names': len(kr_only),
    'trainer_names_translated': len(trans),
}, ensure_ascii=False))
if VERBOSE:
    print('KR only:', ' / '.join(kr_only))
    print('EN unmatched:', ' / '.join(sorted({c['n'] for c in cards if not c.get('kn')})))
    print('trans:', ' / '.join(f'{k[1]}={v}' for k, v in sorted(trans.items(), key=lambda x: x[0][1])))
