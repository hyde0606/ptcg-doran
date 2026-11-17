# 카드 자료가 PC에 없을 때: 공개 자료(PokemonTCG/pokemon-tcg-data)에서 스칼렛&바이올렛 이후 카드를 받아
# build-cards.py 가 읽는 형식(cards_en.json, sets_en.json)으로 만든다. 한글 포켓몬 이름은 PokeAPI 자료에서 붙인다.
# 사용: python tools/fetch-cards.py <출력 폴더>
import csv, io, json, os, sys, urllib.request

RAW = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master'
out = sys.argv[1] if len(sys.argv) > 1 else 'card-src'
os.makedirs(out, exist_ok=True)
get = lambda u: urllib.request.urlopen(u, timeout=60).read()

sets = json.loads(get(RAW + '/sets/en.json'))
keep_sets = [s for s in sets if s.get('releaseDate', '') >= '2023/03/01']
ko = {}
try:
    rows = csv.DictReader(io.StringIO(get('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv').decode('utf-8')))
    for r in rows:
        if r['local_language_id'] == '3': ko[int(r['pokemon_species_id'])] = r['name']
except Exception as e:
    print('한글 이름을 못 받았어요 (영문으로 진행):', e)

cards = []
for i, s in enumerate(keep_sets):
    try: data = json.loads(get(f"{RAW}/cards/en/{s['id']}.json"))
    except Exception as e: print('건너뜀', s['id'], e); continue
    for c in data:
        c2 = {**c, 'set_id': s['id'], 'set_name': s['name'], 'release_date': s.get('releaseDate', '').replace('/', '-'),
              'regulation_mark': c.get('regulationMark'), 'image_small': (c.get('images') or {}).get('small'),
              'species_ko': [ko[d] for d in (c.get('nationalPokedexNumbers') or []) if d in ko]}
        cards.append(c2)
    print(f'{i + 1}/{len(keep_sets)} {s["name"]}')
json.dump(cards, open(os.path.join(out, 'cards_en.json'), 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(keep_sets, open(os.path.join(out, 'sets_en.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(len(cards), 'cards saved to', out)
