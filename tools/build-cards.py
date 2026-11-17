# Build compact card file for the battle site from project card data.
import json, sys
src = sys.argv[1]; sets_src = sys.argv[2]; out = sys.argv[3]
cards = json.load(open(src)); sets = {s['id']: s for s in json.load(open(sets_src))}
keep = []
for c in cards:
    basic_energy = c['supertype'] == 'Energy' and 'Basic' in (c.get('subtypes') or [])
    if c.get('regulation_mark') not in ('H', 'I', 'J') and not (basic_energy and c['set_id'] in ('sve',)):
        continue
    k = {
        'id': c['id'], 'n': c['name'], 'ko': (c.get('species_ko') or [None])[0] if c['supertype'] == 'Pokémon' else None,
        'st': c['supertype'][0],  # P / T / E
        'sub': c.get('subtypes') or [], 'hp': int(c['hp']) if c.get('hp') else None,
        'ty': c.get('types') or [], 'set': sets.get(c['set_id'], {}).get('ptcgoCode') or c['set_id'], 'no': c['number'],
        'rm': c.get('regulation_mark'), 'img': c.get('image_small'),
        'ab': [{'n': a['name'], 't': a.get('text', '')} for a in c.get('abilities') or []],
        'at': [{'n': a['name'], 'c': a.get('cost') or [], 'd': a.get('damage', ''), 't': a.get('text', '')} for a in c.get('attacks') or []],
        'wk': [w['type'] for w in c.get('weaknesses') or []],
        'rs': [[r['type'], r['value']] for r in c.get('resistances') or []],
        'rt': c.get('retreat') or 0, 'r': c.get('rules') or [],
    }
    if c['supertype'] == 'Energy' and not basic_energy: k['r'] = c.get('rules') or []
    if basic_energy:
        ty = c['name'].replace('Basic ', '').replace(' Energy', '')
        k['ko'] = '기본 ' + {'Grass':'풀','Fire':'불꽃','Water':'물','Lightning':'번개','Psychic':'초','Fighting':'격투','Darkness':'악','Metal':'강철'}.get(ty, ty) + ' 에너지'
    keep.append({x: y for x, y in k.items() if y not in (None, [], '')} | {'id': c['id'], 'n': c['name'], 'st': k['st']})
json.dump(keep, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(keep), 'cards')
