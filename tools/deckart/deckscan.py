# 덱 사진 → 카드 칸 + 장수 (형식에 상관없이). 시험용 파이썬, 같은 방법을 브라우저 JS로 옮김
import sys, os, json, numpy as np
from PIL import Image, ImageDraw, ImageFont

def load(src):
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.int16); return im, a

def bg_color(a):  # 가장자리에서 가장 흔한 색 = 바탕
    e = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); q = (e // 8).astype(np.int32)
    k = q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]; v, c = np.unique(k, return_counts=True); m = v[c.argmax()]
    return np.array([(m // 1024) * 8 + 4, (m // 32 % 32) * 8 + 4, (m % 32) * 8 + 4])

def runs(prof, thr, minlen):
    on = prof > thr; out = []; s = None
    for i, v in enumerate(list(on) + [False]):
        if v and s is None: s = i
        if not v and s is not None:
            if i - s >= minlen: out.append((s, i))
            s = None
    return out

def period(sig, lo, hi):  # 되풀이 간격 (자기상관). 배수 대신 가장 짧은 간격
    s = sig - sig.mean(); n = len(s); lo = max(2, int(lo)); hi = min(n // 2, int(hi))
    if hi <= lo: return None
    ac = np.array([(s[:-k] * s[k:]).sum() / (n - k) for k in range(lo, hi + 1)])
    if ac.max() <= 0: return None
    for i in range(1, len(ac) - 1):
        if ac[i] >= ac.max() * 0.8 and ac[i] >= ac[i - 1] and ac[i] >= ac[i + 1]:
            y0, y1, y2 = ac[i - 1], ac[i], ac[i + 1]; dd = (y0 - 2 * y1 + y2)
            return lo + i + (0.5 * (y0 - y2) / dd if dd else 0)
    return lo + int(ac.argmax())

def maxf(x, r):  # 1차원 최대값 거르기 (r칸 흔들림 허용)
    out = x.copy()
    for k in range(1, r + 1): out[k:] = np.maximum(out[k:], x[:-k]); out[:-k] = np.maximum(out[:-k], x[k:])
    return out

def fit_axis(prof, n, plo, phi, wr, gapp=None, extra=None):
    """경계 세기(prof)에 맞는 되풀이 격자: 간격 P, 시작 o, 카드 폭 w. 경계는 o+kP, o+kP+w.
    gapp: 카드 안쪽이면 높고 틈이면 낮은 값 → 카드 안쪽 자리에 틈이 있으면 깎음 (두 배 간격 막기)"""
    best = None; fs = np.linspace(0.12, 0.88, 12); allp = []
    for P in np.arange(plo, phi, 0.5):
        bp = None
        os_ = np.arange(0, P, 1.0)
        for r in wr:
            w = P * r if extra is None else extra
            K = int((n - w * 0.9) // P) + 1
            ks = os_[:, None] + np.arange(K)[None, :] * P  # (o, k)
            ok = ks < n - w * 0.9
            b1 = np.clip(ks.astype(int), 0, n - 1); b2 = np.clip((ks + w).astype(int), 0, n - 1)
            cnt = ok.sum(1); cnt[cnt == 0] = 1
            v = ((prof[b1] + prof[b2]) * ok).sum(1) / cnt / 2
            if gapp is not None:
                ins = np.clip((ks[:, :, None] + w * fs[None, None, :]).astype(int), 0, n - 1)
                g = (gapp[ins] * ok[:, :, None]).sum((1, 2)) / (cnt * len(fs))
                sc = v - 0.8 * g
            else: sc = v
            i = int(sc.argmax())
            if bp is None or sc[i] > bp[0]: bp = (float(sc[i]), float(P), float(os_[i]), float(w))
            if extra is not None: break
        allp.append(bp)
    if not allp: return None
    top = max(a[0] for a in allp)
    if top <= 0: return max(allp)
    # 두 배·세 배 간격도 비슷한 점수가 나오므로, 충분히 높은 것 가운데 가장 짧은 간격
    for a_ in allp:
        if a_[0] >= top * 0.88:
            # 그 둘레(±2)에서 가장 좋은 것
            near = [b_ for b_ in allp if abs(b_[1] - a_[1]) <= 2]; return max(near)
    return max(allp)

def find_cards(a, alts=False):
    H, W, _ = a.shape; bg = bg_color(a)
    gray = a.mean(axis=2)
    d = np.abs(a - bg).max(axis=2); fg = d > 48
    gx = np.abs(np.diff(gray, axis=1)) > 24; gy = np.abs(np.diff(gray, axis=0)) > 24
    # 세로 경계: 위아래로 길게 이어진 것만 세기 (세로로 5칸 연속)
    gxs = gx[:-4] & gx[1:-3] & gx[2:-2] & gx[3:-1] & gx[4:]
    ex = maxf(np.append(gxs.mean(axis=0), 0), 2)  # 2칸 흔들림 허용
    gys = gy[:, :-4] & gy[:, 1:-3] & gy[:, 2:-2] & gy[:, 3:-1] & gy[:, 4:]
    ey = maxf(np.append(gys.mean(axis=1), 0), 2)
    colp = fg.mean(axis=0); lvl = np.percentile(colp, 80) or 1
    gapx = np.maximum(np.clip(1 - colp / lvl, 0, 1) ** 2, maxf(ex, 1))  # 틈(바탕)이거나 세로 경계일수록 1
    bx = fit_axis(ex, W, max(30, W / 14), W / 3.5, (0.86, 0.89, 0.92, 0.95, 0.98), gapx)
    if not bx: return [], bg
    _, P, o, cw = bx; ch = cw * 88 / 63
    # 카드가 있는 열만 모아 위에서부터: 첫 줄 카드 윗변 = 바탕에서 카드로 바뀌는 첫 자리
    xs_ = [int(x) for x in np.arange(o, W - cw * 0.8, P)]
    strip = np.zeros(W, bool)
    for x in xs_: strip[max(0, x + int(cw * 0.1)):min(W, x + int(cw * 0.9))] = True
    rowp = fg[:, strip].mean(axis=1); lv2 = np.percentile(rowp, 80) or 1
    anchor = None
    for (s0, e) in runs(rowp, lv2 * 0.5, max(4, int(ch * 0.4))): anchor = s0; break
    gapy = np.clip(1 - rowp / lv2, 0, 1) ** 2
    Py_ac = None
    if anchor is None:
        _, Py, oy, _ = fit_axis(ey, H, ch * 1.0, ch * 1.65, (1,), gapy, extra=ch)
    else:  # 첫 줄은 고정, 줄 간격만 맞춤
        best = None
        for Py_ in np.arange(ch * 0.6, ch * 1.7, 0.5):  # 일본 공식은 줄이 겹침
            tops = np.arange(anchor, H - ch * 0.5, Py_)
            if len(tops) < 2: sc = 0.0
            else:
                t = tops[1:].astype(int); bt = np.minimum(H - 1, (tops + ch).astype(int))
                ins = np.minimum(H - 1, (tops[:, None] + ch * np.linspace(0.12, 0.88, 10)[None, :]).astype(int))
                sc = ey[t].mean() + ey[bt].mean() / 2 - 0.8 * gapy[ins].mean()
            if best is None or sc > best[0]: best = (sc, Py_)
        Py = best[1]; oy = anchor; Py_ac = None
        # 줄 간격은 '줄끼리 닮은 정도'(세로 자기상관)로 다시 잼: 모든 줄이 같은 모양(카드 윗변·그림 칸·글줄·장수 칸)이라 경계가 흐린 화면에서도 맞음
        g2 = np.abs(np.diff(gray, axis=0))[:, strip].mean(1); s2 = g2 - g2.mean(); den = (s2 ** 2).mean() + 1e-9
        lags = np.arange(int(ch * 0.6), int(min(ch * 1.9, H - ch * 0.5)))
        if len(lags) > 3:
            ac = np.array([(s2[:-L] * s2[L:]).mean() / den for L in lags]); top = ac.max()
            for i in range(1, len(ac) - 1):
                if ac[i] >= top * 0.8 and ac[i] >= ac[max(0, i - 3):i + 4].max():
                    y0_, y1_, y2_ = ac[i - 1], ac[i], ac[i + 1]; dd = y0_ - 2 * y1_ + y2_
                    Py_ac = lags[i] + (0.5 * (y0_ - y2_) / dd if dd else 0); break
    def place(Py, oy=oy):
        return placeAt(Py, oy)
    def placeAt(Py, oy):
        res = []
        y_start = oy - Py * int(oy // Py) if oy >= Py else oy
        for y in np.arange(y_start, H - ch * 0.55, Py):
            for x in np.arange(o, W - cw * 0.8, P):
                x0, y0 = int(round(x)), int(round(y)); x1, y1 = int(min(W, x0 + cw)), int(min(H, y0 + ch))
                fm = fg[max(0, y0):y1, max(0, x0):x1].mean() if y1 > max(0, y0) else 0
                if y0 < -ch * 0.1 or fm < 0.12: continue
                res.append({'x': x0, 'y': y0, 'w': cw, 'h': ch, 'weak': fm < 0.4})  # weak: 흰 카드일 수도 → 그림 비교로 확인
        return res
    if alts:  # 줄 간격 후보 둘 (경계 맞춤 / 자기상관)과 첫 줄 위치 → 그림 비교 점수로 고름
        return {'Pys': [Py] + ([Py_ac] if Py_ac and abs(Py_ac - Py) > 2 else []), 'oy': oy, 'ch': ch, 'place': place, 'placeAt': placeAt}, bg
    return place(Py_ac or Py), bg

# ---- 장수 칸: 카드 아래쪽 가운데 둘레에서 '한 가지 색으로 된 덩어리 안의 숫자' ----
def flood(a, sy, sx, box, tol, maxn):
    x0, y0, x1, y1 = box; c0 = a[sy, sx]; st = [(sy, sx)]; seen = {(sy, sx)}; n = 0
    while st:
        y, x = st.pop(); n += 1
        if n > maxn: return None
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if x0 <= nx < x1 and y0 <= ny < y1 and (ny, nx) not in seen and np.abs(a[ny, nx] - c0).max() <= tol:
                seen.add((ny, nx)); st.append((ny, nx))
    return seen

def find_badge(a, card, bgc):
    H, W, _ = a.shape; cw, chh = card['w'], card['h']; cx = card['x'] + cw / 2
    x0 = int(max(0, cx - cw * 0.38)); x1 = int(min(W, cx + cw * 0.38))
    y0 = int(max(0, card['y'] + chh * 0.55)); y1 = int(min(H, card['y'] + chh * 1.32))
    box = (x0, y0, x1, y1); best = None; done = np.zeros((y1 - y0, x1 - x0), bool)
    step = max(2, int(cw / 40))
    for sy in range(y0, y1, step):
        for sx in range(x0, x1, step):
            if done[sy - y0, sx - x0]: continue
            blob = flood(a, sy, sx, box, 34, int(cw * cw * 0.6))
            if blob is None: continue
            ys = np.array([p[0] for p in blob]); xs = np.array([p[1] for p in blob])
            done[ys - y0, xs - x0] = True
            bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
            if not (cw * 0.1 <= bw <= cw * 0.72 and cw * 0.1 <= bh <= cw * 0.72): continue
            if xs.min() <= x0 or xs.max() >= x1 - 1: continue  # 찾는 칸 가장자리에 닿으면 바탕이나 그림
            bxc = (xs.min() + xs.max()) / 2
            if abs(bxc - cx) > cw * 0.12: continue
            col = a[sy, sx]
            # 덩어리 안쪽 구멍 = 숫자 후보: 둘레 안에 있으면서 덩어리 색과 많이 다른 점
            sub = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            inb = np.zeros((bh, bw), bool); inb[ys - ys.min(), xs - xs.min()] = True
            # 덩어리로 둘러싸인 곳 (가로·세로 모두 양쪽에 덩어리가 있음)
            l = np.maximum.accumulate(inb, axis=1); r = np.maximum.accumulate(inb[:, ::-1], axis=1)[:, ::-1]
            u = np.maximum.accumulate(inb, axis=0); dn = np.maximum.accumulate(inb[::-1], axis=0)[::-1]
            enc = l & r & u & dn & ~inb
            con = np.abs(sub - col).max(axis=2) > 90
            dig = enc & con
            fill = inb.sum() / (bw * bh)
            if dig.sum() < 4 or fill < 0.35: continue
            dys, dxs = np.nonzero(dig)
            gh = dys.max() - dys.min() + 1
            if gh < bh * 0.3: continue
            score = dig.sum() / (bw * bh) * 0 + fill - abs(bxc - cx) / cw
            cand = {'box': (int(xs.min()), int(ys.min()), int(bw), int(bh)), 'col': col.tolist(), 'dig': dig, 'sub': sub, 'score': score}
            if best is None or cand['score'] > best['score']: best = cand
    return best

FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/opentype/inter/Inter-Bold.otf', '/usr/share/fonts/opentype/inter/Inter-Regular.otf', '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf']
GW, GH = 10, 14
def glyph(g):
    ys, xs = np.nonzero(g > 0.45)
    if not len(ys): return None, 0
    c = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; asp = c.shape[1] / c.shape[0]
    v = np.asarray(Image.fromarray((np.clip(c, 0, 1) * 255).astype('uint8')).resize((GW, GH), Image.BILINEAR), dtype=np.float32).reshape(-1) / 255
    v = v - v.mean(); return v / (np.linalg.norm(v) + 1e-6), asp
T = []
for fp in FONTS:
    if not os.path.exists(fp): continue
    for size in (12, 18, 26):
        ft = ImageFont.truetype(fp, size)
        for d in '0123456789':
            img = Image.new('L', (size * 2, size * 2), 0); ImageDraw.Draw(img).text((size // 2, 0), d, 255, font=ft)
            g0 = np.asarray(img, dtype=np.float32) / 255
            for sx in (0.8, 1.0):
                g = np.asarray(Image.fromarray((g0 * 255).astype('uint8')).resize((max(1, int(g0.shape[1] * sx)), g0.shape[0]), Image.BILINEAR), dtype=np.float32) / 255
                v, asp = glyph(g)
                if v is not None: T.append((d, v, asp))
TV = np.stack([t[1] for t in T]); TD = [t[0] for t in T]; TA = np.array([t[2] for t in T])

def read_digits(b):
    sub, col = b['sub'].astype(np.float32), np.array(b['col'], np.float32)
    g = np.abs(sub - col).max(axis=2); g = np.clip((g - 40) / 120, 0, 1) * b['dig'].astype(np.float32)
    # 숫자 자리 나누기
    cols = (g > 0.45).any(axis=0); parts = []; s = None
    for i, v in enumerate(list(cols) + [False]):
        if v and s is None: s = i
        if not v and s is not None: parts.append((s, i)); s = None
    ys_all = np.nonzero((g > 0.45).any(axis=1))[0]; full = ys_all.max() - ys_all.min() + 1 if len(ys_all) else 0
    out = []
    for s0, e in parts:
        sub2 = g[:, max(0, s0 - 1):e + 1]; ys = np.nonzero((sub2 > 0.45).any(axis=1))[0]
        if len(ys) < full * 0.6: continue
        v, asp = glyph(sub2)
        sc = TV @ v - 0.5 * np.abs(TA - asp); best = {}
        for d, val in zip(TD, sc): best[d] = max(best.get(d, -9), float(val))
        out.append(best)
    return out

if __name__ == '__main__':
    src = sys.argv[1]; im, a = load(src); cards, bg = find_cards(a)
    print(src.split('/')[-1], im.size, '바탕', bg.tolist(), '카드', len(cards), '폭', round(float(np.median([c['w'] for c in cards])), 1) if cards else 0)
    dr = ImageDraw.Draw(im); ns = []
    for c in cards:
        dr.rectangle([c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h']], outline=(255, 0, 255), width=2)
        b = find_badge(a, c, bg)
        if b:
            x, y, w, h = b['box']; dr.rectangle([x, y, x + w, y + h], outline=(0, 200, 0), width=2)
            p = read_digits(b); s = ''.join(max(d, key=d.get) for d in p); ns.append(s or '?')
        else: ns.append('-')
    print('장수', ' '.join(ns))
    im.save('/tmp/claude-0/-home-claude/b448173d-0095-50f5-a113-2b8b851774cf/scratchpad/scan_' + os.path.basename(src).split('.')[0] + '.png')
