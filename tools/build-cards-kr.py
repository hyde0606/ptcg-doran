# 영문 기준 public/cards.json 에 한글 카드 자료를 덧붙이고, 영문에 없는 한국판 카드는 새 카드로 넣는다. (원본 자료는 읽기만 한다)
#   python tools/build-cards-kr.py <cards_kr.json> --en card-src/cards_en.json --hash card-src/art_hash.json [--match card-src/kr_match.json] [--out public/cards.json] [-v]
# - cards_kr.json : 한글 카드 자료 (pokemoncard.co.kr 기준)
# - --en          : (선택) 영문 원본. 그림 작가·레어도로 같은 그림의 한글판을 고르는 데 쓴다.
# - --hash        : (선택) tools/kr-art-hash.cjs 가 만든 그림 지문. 트레이너스 짝짓기와 같은 그림 고르기에 쓴다.
# - --match       : (선택) 손으로 정한 짝 {"영문 id": "한글 code"}. 자동 짝짓기보다 먼저 쓴다. "_" 로 시작하는 키는 메모.
#                   한글 code 는 레귤레이션과 상관없이 찾는다(G 마크뿐인 한글판도 쓸 수 있음).
#                   "fix:<한글 code>": {"hp": 70} 처럼 적으면 한글 원본에 빠진 칸을 채운다.
# 덧붙이는 칸: kn, kimg, kab, kat, kr, kset, kno  (n 등 기존 칸은 그대로 둔다)
# 새로 넣는 한국판 카드: id 는 "kr-<한글 code>", kro=1, 이름·기술·문장은 한글 그대로
import json, sys, re, collections
sys.stdout.reconfigure(encoding='utf-8')

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
VERBOSE = '-v' in args
if VERBOSE: args.remove('-v')
EN_SRC, HASH_SRC, MATCH_SRC, OUT = opt('--en'), opt('--hash'), opt('--match'), opt('--out', 'public/cards.json')
KR_SRC = args[0]

TY = {'풀': 'Grass', '불꽃': 'Fire', '물': 'Water', '번개': 'Lightning', '초': 'Psychic', '격투': 'Fighting',
      '악': 'Darkness', '강철': 'Metal', '드래곤': 'Dragon', '무색': 'Colorless', '페어리': 'Fairy'}
TY_KO = {v: k for k, v in TY.items()}
RAR = {'Common': 'C', 'Uncommon': 'U', 'Rare': 'R', 'Double Rare': 'RR', 'Illustration Rare': 'AR',
       'Special Illustration Rare': 'SAR', 'Ultra Rare': 'SR', 'Hyper Rare': 'UR', 'ACE SPEC Rare': 'ACE',
       'Mega Hyper Rare': 'MUR', 'Black White Rare': 'BWR'}
KIND = {'Supporter': '서포트', 'Item': '아이템', 'Pokémon Tool': '포켓몬의 도구', 'Stadium': '스타디움'}
# 한글 자료는 아이템과 포켓몬의 도구가 섞여 적힌 카드가 있어서(모험 랜턴 등) 짝지을 때는 한 묶음으로 본다
GROUP = {'Supporter': 'Supporter', 'Item': 'ItemTool', 'Pokémon Tool': 'ItemTool', 'Stadium': 'Stadium', 'SpecialE': 'SpecialE'}
# 영문 "누구의" 포켓몬 → 한글 이름 앞부분 (없거나 틀려도 "…의 ○○" 꼴로 다시 찾는다)
OWNER_KO = {'Team Rocket': '로켓단', 'Misty': '이슬', 'Iono': '모야모', 'N': 'N', 'Lillie': '릴리에', 'Hop': '호브',
            'Arven': '페퍼', 'Larry': '청목', 'Cynthia': '난천', 'Erika': '민화', 'Marnie': '마리', 'Steven': '성호', 'Brock': '웅'}
KFIELDS = ('kn', 'kimg', 'kab', 'kat', 'kr', 'kset', 'kno')
HASH_OK, HASH_MARGIN = 70, 12        # 트레이너스: 1등이 이 값 이하로 다르고, 이름이 다른 2등보다 이만큼 가까우면 표를 준다
HASH_OK2, HASH_MARGIN2 = 80, 15      # 위 기준으로 표가 하나도 없는 이름만, 조금 느슨하게

cards = [c for c in json.load(open(OUT, encoding='utf-8')) if not c.get('kro')]  # 지난번에 넣은 한국판 카드는 다시 만든다
kr_all = json.load(open(KR_SRC, encoding='utf-8'))
en_meta = {}
if EN_SRC:
    for c in json.load(open(EN_SRC, encoding='utf-8')):
        en_meta[c['id']] = {'artist': (c.get('artist') or '').strip().lower(), 'rar': RAR.get(c.get('rarity') or '', '')}
H = json.load(open(HASH_SRC, encoding='utf-8')) if HASH_SRC else {'en': {}, 'kr': {}}
HI = {k: {i: int(h, 16) for i, h in H[k].items()} for k in ('en', 'kr')}
MATCH = json.load(open(MATCH_SRC, encoding='utf-8')) if MATCH_SRC else {}
MANUAL = {k: v for k, v in MATCH.items() if not k.startswith(('_', 'fix:'))}
FIX = {k[4:]: v for k, v in MATCH.items() if k.startswith('fix:')}
for k in kr_all:
    if k.get('code') in FIX: k.update(FIX[k['code']])
def hd(en_id, kr_code):
    a, b = HI['en'].get(en_id), HI['kr'].get(kr_code)
    return bin(a ^ b).count('1') if a is not None and b is not None else 999

sp = lambda s: re.sub(r'\s+', '', s or '')
def dmg(d): return sp(str(d or '')).replace('×', 'x').replace('X', 'x').replace('＋', '+').replace('－', '-')
def is_rule(a): return not a.get('cost') and not a.get('damage') and (a.get('name') or '').strip() in ('ex 룰', '메가진화 ex 룰', '테라스탈')
def en_cost(a): return tuple(sorted(x for x in a.get('c') or [] if x != 'Free'))
def kr_cost(a): return tuple(sorted(TY.get(x, x) for x in a.get('cost') or []))
def kr_attacks(k): return [a for a in k.get('attacks') or [] if not is_rule(a)]
BASIC_E = re.compile(r'기본\s*(\S+)\s*에너지')
def kr_basic_energy(c):
    return BASIC_E.fullmatch(c.get('name') or '') is not None and '특수' not in (c.get('card_kind') or '')
def kr_std(c): return c.get('regulation_mark') in ('H', 'I', 'J') or kr_basic_energy(c)
kr = [c for c in kr_all if kr_std(c)]
by_code = {k['code']: k for k in kr_all}  # 손으로 정한 짝은 표준 밖 판(G 등)도 찾는다
is_pk = lambda k: k.get('tab') == '포켓몬' or bool(k.get('hp'))  # HP 가 빠진 포켓몬도 포켓몬으로

def kr_kind(c):
    k = c.get('card_kind') or ''
    for en, ko in KIND.items():
        if k.startswith(ko): return GROUP[en]
    if '특수 에너지' in k: return 'SpecialE'
    return None
def en_kind(c):
    if c['st'] == 'E': return 'SpecialE'
    for s in c.get('sub') or []:
        if s in KIND: return GROUP[s]
    return None

def pk_key_en(c):
    at = tuple(sorted((en_cost(a), dmg(a.get('d'))) for a in c.get('at') or []))
    return (c.get('hp'), at, tuple(c.get('wk') or [])[:1], c.get('rt') or 0)
def kr_wk(c):
    wk = (c.get('weakness') or {}).get('type')
    return (TY.get(wk, wk),) if wk else ()
def pk_key_kr(c):
    at = tuple(sorted((kr_cost(a), dmg(a.get('damage'))) for a in kr_attacks(c)))
    return (c.get('hp'), at, kr_wk(c), c.get('retreat') or 0)
def loose_eq(c, k):
    """영문 원본에 데미지가 빠진 기술(예: Seaking 의 30×)만 너그럽게 본다. 나머지는 키와 똑같이 비교한다."""
    if c.get('hp') != k.get('hp') or tuple(c.get('wk') or [])[:1] != kr_wk(k) or (c.get('rt') or 0) != (k.get('retreat') or 0): return False
    ea, ka = c.get('at') or [], kr_attacks(k)
    if len(ea) != len(ka): return False
    return all(en_cost(a) == kr_cost(b) and (dmg(a.get('d')) == dmg(b.get('damage')) or not dmg(a.get('d'))) for a, b in zip(ea, ka))

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

# ---------- 포켓몬 이름 맞추기 ----------
def owner(n):
    m = re.match(r"^(.+?)'s ", n); return m.group(1) if m else None
def base_ko(c):
    k = sp(c.get('ko') or '')
    if not k: return ''
    plain = re.sub(r"^.+?'s ", '', c['n'])
    if plain.startswith('Mega '): k = '메가' + k
    if plain.endswith(' ex'): k += 'ex'
    return k
def name_filter(c, cands):
    """영문 ko(종 이름)로 한글 후보를 좁힌다. "로켓단의 애버라스"와 "애버라스"처럼 주인 이름이 붙은 카드를 가른다."""
    k0, b = sp(c.get('ko') or ''), base_ko(c)
    if not k0: return cands
    ow = owner(c['n'])
    names = lambda f: [x for x in cands if f(sp(x['name']))]
    if ow:
        pre = OWNER_KO.get(ow)
        exact = names(lambda n: pre and n == pre + '의' + b)
        return exact or names(lambda n: k0 in n and n.split(k0)[0].endswith('의'))
    return names(lambda n: n == b) or names(lambda n: k0 in n and not n.split(k0)[0].endswith('의'))

kr_pk = collections.defaultdict(list)
kr_hp = collections.defaultdict(list)
kr_tr = collections.defaultdict(list)      # (묶음, 레귤레이션) → 카드
kr_by_name = collections.defaultdict(list)  # (묶음, 이름) → 카드
for k in kr:
    if k.get('hp'): kr_pk[pk_key_kr(k)].append(k); kr_hp[k['hp']].append(k)
    kk = kr_kind(k)
    if kk:
        kr_tr[(kk, k.get('regulation_mark'))].append(k)
        kr_by_name[(kk, sp(k['name']))].append(k)

# ---------- 트레이너스·특수 에너지 이름 번역: 판마다 그림이 가장 닮은 한글 카드에 표를 준다 ----------
votes = collections.defaultdict(collections.Counter)
votes2 = collections.defaultdict(collections.Counter)
for c in cards:
    kk = en_kind(c)
    if not kk or c['st'] == 'P': continue
    pool = kr_tr.get((kk, c.get('rm')), [])
    ranked = sorted(((hd(c['id'], k['code']), sp(k['name'])) for k in pool))
    if not ranked: continue
    d1, n1 = ranked[0]
    d2 = next((d for d, n in ranked if n != n1), 999)
    if d1 <= HASH_OK and d2 - d1 >= HASH_MARGIN: votes[(kk, c['n'])][n1] += 1
    if d1 <= HASH_OK2 and d2 - d1 >= HASH_MARGIN2: votes2[(kk, c['n'])][n1] += 1
trans = {key: cnt.most_common(1)[0][0] for key, cnt in votes2.items()}
trans.update({key: cnt.most_common(1)[0][0] for key, cnt in votes.items()})
manual_names = {}  # 손으로 정한 트레이너스 짝: 같은 영문 이름의 다른 판도 같은 한글 카드로
for c in cards:
    k = by_code.get(MANUAL.get(c['id']))
    if k and c['st'] != 'P' and en_kind(c): manual_names[c['n']] = [x for x in kr_all if sp(x['name']) == sp(k['name']) and not is_pk(x)]

def kr_rules(k, pokemon):
    rules = [a.get('text') for a in k.get('attacks') or [] if is_rule(a) and a.get('text')]
    if not pokemon and k.get('text'): rules += [t for t in k['text'].split('\n') if t.strip()]
    return rules

def overlay(c, k):
    for f in KFIELDS: c.pop(f, None)
    c['kn'] = (k.get('name') or '').strip()
    if k.get('image_url'): c['kimg'] = k['image_url']
    if k.get('abilities'): c['kab'] = [{'n': a.get('name') or '', 't': a.get('text') or ''} for a in k['abilities']]
    if c.get('at'):
        # 영문 기술 순서에 맞춘다 (비용·데미지가 같은 것끼리)
        kat = [{'n': a.get('name') or '', 't': a.get('text') or '', '_k': (kr_cost(a), dmg(a.get('damage')))} for a in kr_attacks(k)]
        out = []
        for a in c['at']:
            key = (en_cost(a), dmg(a.get('d')))
            j = next((i for i, x in enumerate(kat) if x['_k'] == key), None)
            x = kat.pop(j) if j is not None else (kat.pop(0) if kat else {'n': '', 't': ''})
            out.append({'n': x['n'], 't': x['t']})
        c['kat'] = out
    rules = kr_rules(k, c['st'] == 'P')
    if rules: c['kr'] = rules
    c['kset'] = k.get('set_code'); c['kno'] = k.get('number')

def ident(k):
    """같은 카드(다른 판 포함)를 가리키는 열쇠."""
    if kr_basic_energy(k): return ('E', sp(k['name']))
    if is_pk(k): return ('P', sp(k['name']), pk_key_kr(k))
    return ('T', kr_kind(k), sp(k['name']))

stat = collections.Counter(); far = 0; how = collections.Counter(); covered = set()
for c in cards:
    k = by_code.get(MANUAL.get(c['id']))
    if k: how['manual'] += 1
    elif c['st'] == 'P':
        cands = name_filter(c, kr_pk.get(pk_key_en(c), []))
        if cands and len({sp(x['name']) for x in cands}) == 1: k = pick(c['id'], cands); how['key'] += 1
        else:
            cands = name_filter(c, [x for x in kr_hp.get(c.get('hp'), []) if loose_eq(c, x)])
            if cands and len({sp(x['name']) for x in cands}) == 1: k = pick(c['id'], cands); how['loose'] += 1
    elif c['st'] == 'E' and 'Basic' in (c.get('sub') or []):
        ty = (re.match(r'Basic (\w+) Energy', c['n']) or [None, None])[1]
        cands = [x for x in kr if kr_basic_energy(x) and sp(x['name']) == '기본' + TY_KO.get(ty, '?') + '에너지']
        if cands: k = pick(c['id'], cands)
    else:
        kk = en_kind(c); ko = trans.get((kk, c['n']))
        pool = manual_names.get(c['n']) or (kr_by_name.get((kk, ko)) if ko else None)
        if pool: k = pick(c['id'], pool)
    if k:
        overlay(c, k); stat[c['st']] += 1; covered.add(ident(k))
        if hd(c['id'], k['code']) > HASH_OK: far += 1
    else:
        for f in KFIELDS: c.pop(f, None)

# ---------- 영문에 없는 한국판 카드를 새 카드로 ----------
STAGE = (('2진화', 'Stage 2'), ('1진화', 'Stage 1'), ('기본', 'Basic'))
def kr_sub(k):
    ck = k.get('card_kind') or ''
    parts = [p.strip() for p in ck.split('|')]
    s = []
    if kr_basic_energy(k): return ['Basic']
    if is_pk(k):
        s.append(next((en for ko, en in STAGE if parts[0].startswith(ko)), 'Basic'))
        if '메가진화' in ck: s.append('MEGA')
        if any((a.get('name') or '').strip() == '테라스탈' for a in k.get('attacks') or []): s.append('Tera')
        if re.search(r'(^|\s)ex$', (k.get('name') or '').strip()) or 'ex' in ck: s.append('ex')
    else:
        kind = parts[0]
        s += [en for en, ko in KIND.items() if kind.startswith(ko)] or (['Special'] if '특수 에너지' in kind else [])
    if '고대' in parts: s.append('Ancient')
    if '미래' in parts: s.append('Future')
    if not is_pk(k) and (k.get('rarity') == 'ACE' or 'ACE SPEC' in (k.get('text') or '')): s.append('ACE SPEC')
    return s
def kr_card(k):
    pokemon = is_pk(k)
    st = 'P' if pokemon else 'E' if (kr_basic_energy(k) or '에너지' in (k.get('card_kind') or '')) else 'T'
    name = (k.get('name') or '').strip()
    c = {'id': 'kr-' + k['code'], 'kro': 1, 'n': name, 'kn': name, 'st': st, 'sub': kr_sub(k),
         'set': k.get('set_code'), 'no': k.get('number'), 'rm': k.get('regulation_mark'),
         'kimg': k.get('image_url'), 'kset': k.get('set_code'), 'kno': k.get('number')}
    if kr_basic_energy(k):
        c['n'] = 'Basic ' + TY.get(BASIC_E.fullmatch(name).group(1), 'Colorless') + ' Energy'  # 판에서 에너지 타입을 이 이름으로 읽는다
    if pokemon:
        c['hp'] = k.get('hp')
        if k.get('type'): c['ty'] = [TY.get(k['type'], k['type'])]
        c['ab'] = [{'n': a.get('name') or '', 't': a.get('text') or ''} for a in k.get('abilities') or []]
        c['at'] = [{'n': a.get('name') or '', 'c': [TY.get(x, x) for x in a.get('cost') or []], 'd': str(a.get('damage') or ''), 't': a.get('text') or ''} for a in kr_attacks(k)]
        if kr_wk(k): c['wk'] = list(kr_wk(k))
        rs = k.get('resistance') or {}
        if rs.get('type'): c['rs'] = [[TY.get(rs['type'], rs['type']), rs.get('value') or '']]
        c['rt'] = k.get('retreat') or 0
    rules = kr_rules(k, pokemon)
    if rules: c['r'] = rules; c['kr'] = rules
    return {x: y for x, y in c.items() if y not in (None, [], '')}

groups = collections.defaultdict(list)
for k in kr:
    i = ident(k)
    if i not in covered: groups[i].append(k)
added = [kr_card(pick(None, ks)) for ks in groups.values()]
added.sort(key=lambda c: (c.get('kset') or '', c.get('kno') or ''))

json.dump(cards + added, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
tot = collections.Counter(c['st'] for c in cards)
kr_kinds = len({ident(k) for k in kr})
print(json.dumps({
    'en_total': len(cards), 'matched': sum(stat.values()),
    'by_type': {t: f"{stat[t]}/{tot[t]}" for t in 'PTE'},
    'matched_by': dict(how), 'manual_pairs': len(MANUAL),
    'picked_print_art_differs': far,
    'kr_std_cards': len(kr), 'kr_kinds': kr_kinds, 'kr_kinds_linked': kr_kinds - len(groups),
    'kr_only_added': len(added), 'kr_only_no_hp': [c['id'] for c in added if c['st'] == 'P' and not c.get('hp')], 'kr_only_by_type': dict(collections.Counter(c['st'] for c in added)),
    'trainer_names_translated': len(trans),
}, ensure_ascii=False))
if VERBOSE:
    print('KR only added:', ' / '.join(f"{c['kn']} {c.get('kset')} {c.get('kno')}" for c in added))
    print('EN unmatched:', ' / '.join(sorted({f"{c['n']} ({c['id']})" for c in cards if not c.get('kn')})))
    print('trans:', ' / '.join(f'{k[1]}={v}' for k, v in sorted(trans.items(), key=lambda x: x[0][1])))
