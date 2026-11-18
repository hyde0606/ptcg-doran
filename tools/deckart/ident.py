# 카드 칸 → 그림 비교로 카드 찾기 (덤프 목록 전체)
import sys, json, numpy as np
from PIL import Image
import deckscan as D
raw = np.load('dump_raw.npy'); lab = json.load(open('dump_lab.json'))
C = {c['id']: c for c in json.load(open('/home/claude/ptcg-doran/public/cards.json'))}
ART = (0.085, 0.105, 0.915, 0.50); FW, FH = 24, 16
def feat_img(im):  # PIL 카드 그림 → 특징
    w, h = im.size; x = np.asarray(im.crop((round(w * ART[0]), round(h * ART[1]), round(w * ART[2]), round(h * ART[3]))).resize((FW, FH), Image.BILINEAR), dtype=np.float32).reshape(-1)
    x -= x.mean(); return x / (np.linalg.norm(x) + 1e-6)
F = np.stack([feat_img(Image.fromarray(r)) for r in raw])
import os
if os.environ.get('PCA'):
    d = int(os.environ['PCA']); U, S_, Vt = np.linalg.svd(F, full_matrices=False); V = Vt[:d].T.astype(np.float32)
    Z = F @ V; Z /= np.linalg.norm(Z, axis=1, keepdims=True); sc_ = np.abs(Z).max(1, keepdims=True) / 127; Zq = np.round(Z / sc_).astype(np.int8)
    F = (Zq * sc_).astype(np.float32)
    _fi = feat_img
    def feat_img(im):
        z = _fi(im) @ V; return z / (np.linalg.norm(z) + 1e-6)
import re
NM = [re.sub(r'\s', '', l[1] or '') for l in lab]
def ident(im, c):
    best = None
    for dy in (-0.02, 0, 0.02):
        for dx in (-0.015, 0, 0.015):
            x0 = c['x'] + c['w'] * dx; y0 = c['y'] + c['h'] * dy
            cr = im.crop((round(x0), round(y0), round(x0 + c['w']), round(y0 + c['h'])))
            s = F @ feat_img(cr); i = int(s.argmax())
            if best is None or s[i] > best[0]: best = (float(s[i]), s)
    sc, s = best; o = np.argsort(-s); top = NM[o[0]]
    other = next((float(s[j]) for j in o if NM[j] != top), 0.0)
    return lab[o[0]], sc, sc - other, [NM[j] for j in o[:3]]
if __name__ == '__main__':
    for src in sys.argv[1:]:
        im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.int16); g, bg = D.find_cards(a, alts=True)
        def quick(cs):
            if not cs: return 0
            cs = [c for c in cs if not c.get('weak')]
            if not cs: return 0
            pick = cs[::max(1, len(cs) // 10)][:10]  # 10장만 골고루
            return np.mean([float((F @ feat_img(im.crop((c['x'], c['y'], round(c['x'] + c['w']), round(c['y'] + c['h']))))).max()) for c in pick])
        best = None
        for Py in g['Pys']:
            for dy in np.arange(-0.12, 0.121, 0.02) * g['ch']:
                cs = g['placeAt'](Py, g['oy'] + dy); q = quick(cs)
                if best is None or q > best[0]: best = (q, Py, dy, cs)
        q, Py, dy, cards = best
        if len(cards) < len(g['place'](g['Pys'][0])): pass
        print(f'고른 줄 간격 {Py:.1f} 첫 줄 {dy:+.1f}px 점수 {q:.3f} 카드 {len(cards)}')
        print('==', src.split('/')[-1], len(cards))
        R = [(c, ident(im, c)) for c in cards]
        R = [(c, r) for c, r in R if not c.get('weak') or r[1] >= 0.6]
        print('카드', len(R))
        for k, (c, ((cid, nm), sc, gap, t3)) in enumerate(R):
            nm = nm or '?'
            sure = sc >= 0.68 and gap >= 0.1
            print(f'{k+1:2d} {"확실" if sure else "애매"} {sc:.2f} {gap:.2f} {nm} [{C[cid]["n"] if cid else "사이트에 없음"}]  / {t3[1]}')
