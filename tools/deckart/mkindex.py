# 브라우저용 카드 그림 목록: cardart.bin (특징 96차원 int8 + 바꾸는 판 + 숫자 본보기). 카드 그림 자체는 들어 있지 않음
import json, struct, numpy as np
from PIL import Image
import deckscan as D
raw = np.load('dump_raw.npy'); lab = json.load(open('dump_lab.json'))
ART = (0.085, 0.105, 0.915, 0.50); FW, FH, DIM = 24, 16, 96
def feat_img(im):
    w, h = im.size; x = np.asarray(im.crop((round(w * ART[0]), round(h * ART[1]), round(w * ART[2]), round(h * ART[3]))).resize((FW, FH), Image.BILINEAR), dtype=np.float32).reshape(-1)
    x -= x.mean(); return x / (np.linalg.norm(x) + 1e-6)
F = np.stack([feat_img(Image.fromarray(r)) for r in raw])
U, S, Vt = np.linalg.svd(F, full_matrices=False); V = Vt[:DIM].T.astype(np.float32)  # (1152, 96)
Z = F @ V; Z /= np.linalg.norm(Z, axis=1, keepdims=True)
codes = np.round(Z / np.abs(Z).max(1, keepdims=True) * 127).astype(np.int8)
vs = float(np.abs(V).max() / 32767); Vq = np.round(V / vs).astype(np.int16)
labels = [(l[0] if l[0] else '!' + (l[1] or '?')) for l in lab]
tpl = np.round(D.TV * 127 / np.abs(D.TV).max()).astype(np.int8)
hdr = {'v': 1, 'n': len(labels), 'd': DIM, 'fw': FW, 'fh': FH, 'art': ART, 'vs': vs, 'labels': labels,
       'tpl': {'s': float(np.abs(D.TV).max() / 127), 'n': len(D.TD), 'gw': D.GW, 'gh': D.GH, 'dig': ''.join(D.TD), 'asp': [round(float(a), 4) for a in D.TA]}}
hb = json.dumps(hdr, ensure_ascii=False, separators=(',', ':')).encode('utf-8'); pad = (-(8 + len(hb))) % 4
with open('/home/claude/ptcg-doran/public/cardart.bin', 'wb') as f:
    f.write(b'NPCA'); f.write(struct.pack('<I', len(hb) + pad)); f.write(hb + b' ' * pad)
    f.write(Vq.tobytes()); f.write(codes.tobytes()); f.write(tpl.tobytes())
import os; print('cardart.bin', os.path.getsize('/home/claude/ptcg-doran/public/cardart.bin'), 'bytes', len(labels), 'labels, tpl', tpl.shape)
