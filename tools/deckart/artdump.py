# 덱 사진 인식용 카드 그림 목록 만들기 (링크 님 PC에서 한 번 실행)
# F:\AI\17_포켓몬 카드 의 그림 파일(한글판 SV·메가 시대 전부 + 영문판 사이트 카드)을 60x84 로 줄여 한 파일로 모음.
# 실행: python artdump.py   (F:\AI\18_포켓몬 대전\card-src 에서)   → artdump.bin, artdump.json
import os, sys, json, glob, re, time
try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 필요해요: python -m pip install pillow')
HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.environ.get('ARTCARDS', os.path.join(HERE, '..', 'public', 'cards.json'))
SRC = os.environ.get('ARTSRC', r'F:\AI\17_포켓몬 카드')
sys.path.insert(0, os.path.join(SRC, 'scripts'))
W, H = 60, 84

def safe(s):
    return "".join(ch if ch not in '<>:"/\\|?*' else "_" for ch in str(s)).strip() or "_"

def kr_dest_map():  # images.py 의 jobs_kr() 와 같은 규칙 (그림 주소 → 저장한 파일)
    try:
        from images import jobs_kr
        return dict(jobs_kr()['kr'])
    except Exception as e:
        print('images.py 를 못 불러서 기본 규칙으로:', e)
        cards = json.load(open(os.path.join(SRC, 'data', 'kr', 'cards_kr.json'), encoding='utf-8'))
        return {c['image_url']: os.path.join(SRC, 'images', 'kr', safe(c.get('set_code') or '_'), safe(c.get('image_file') or c['code'] + '.webp')) for c in cards if c.get('image_url')}

def main():
    t0 = time.time()
    C = json.load(open(CARDS, encoding='utf-8'))
    K = json.load(open(os.path.join(SRC, 'data', 'kr', 'cards_kr.json'), encoding='utf-8'))
    kd = kr_dest_map()
    jobs, seen = [], set()
    # 1) 한글판: SV·메가 시대 또는 G·H·I·J 마크 전부
    for k in K:
        if not (k.get('series_dir') in ('SV', 'MEGA') or k.get('regulation_mark') in ('G', 'H', 'I', 'J')): continue
        u = k.get('image_url'); p = kd.get(u)
        if not p or u in seen: continue
        seen.add(u); jobs.append(({'k': 'kr', 'set': k.get('set_code'), 'no': k.get('number'), 'name': k.get('name'), 'url': u}, p))
    # 2) 사이트 카드의 한글판 그림(위에 없으면) + 영문판 그림
    for c in C:
        u = c.get('kimg')
        if u and u not in seen and kd.get(u):
            seen.add(u); jobs.append(({'k': 'kr', 'set': c.get('kset'), 'no': c.get('kno'), 'name': c.get('kn'), 'url': u, 'id': c['id']}, kd[u]))
        if c.get('img'):
            sid, num = c['id'].rsplit('-', 1)
            fs = glob.glob(os.path.join(SRC, 'images', 'en', 'small', safe(sid), glob.escape(safe(num)) + '.*'))
            if fs: jobs.append(({'k': 'en', 'id': c['id'], 'url': c['img']}, fs[0]))
            else: print('영문 그림 없음', c['id'])
    print('그림', len(jobs), '장 줄이는 중…', flush=True)
    meta, bad = [], 0
    with open(os.path.join(HERE, 'artdump.bin'), 'wb') as out:
        for i, (m, p) in enumerate(jobs):
            try:
                im = Image.open(p).convert('RGB'); m['w'], m['h'] = im.size
                out.write(im.resize((W, H), Image.LANCZOS).tobytes()); meta.append(m)
            except Exception as e:
                bad += 1; print('못 읽음', p, e)
            if i % 1000 == 0: print(f'  {i}/{len(jobs)}', flush=True)
    json.dump({'w': W, 'h': H, 'items': meta}, open(os.path.join(HERE, 'artdump.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'끝: {len(meta)}장, 못 읽은 것 {bad}장, {time.time() - t0:.0f}초 → artdump.bin, artdump.json')

if __name__ == '__main__':
    main()
