// 덱 사진 → 카드 칸·장수·카드 찾기. 기기 안에서만 계산 (사진은 밖으로 나가지 않음)
// 순서: 바탕색 → 세로·가로 경계 → 카드 폭·간격 맞추기 → 줄 간격(경계 맞춤/줄끼리 닮음) → 그림 비교로 줄 위치 고르기
//       → 카드마다 그림으로 찾기(조금씩 움직여 가장 잘 맞는 자리) → 장수 칸(한 가지 색 덩어리 안의 숫자) → 숫자 읽기
// 샘플: 일본 공식(겹친 줄), 아시아 공식(흰 동그라미), Limitless, 한국 공식, 코리안리그 그림에서 시험함

// ---------- 카드 그림 목록 (cardart.bin) ----------
export function parseIndex(buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'NPCA') throw new Error('카드 그림 목록 파일이 아니에요.');
  const hl = dv.getUint32(4, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
  let off = 8 + hl; const F = hdr.fw * hdr.fh * 3, D = hdr.d, n = hdr.n;
  const vq = new Int16Array(buf.slice(off, off + F * D * 2)); off += F * D * 2;
  const V = new Float32Array(F * D); for (let i = 0; i < V.length; i++) V[i] = vq[i] * hdr.vs; // (F, D) 행 우선
  const cq = new Int8Array(buf, off, n * D); off += n * D;
  const Z = new Float32Array(n * D);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < D; k++) { const v = cq[i * D + k]; s += v * v; } s = 1 / Math.sqrt(s || 1); for (let k = 0; k < D; k++) Z[i * D + k] = cq[i * D + k] * s; }
  const T = hdr.tpl, tq = new Int8Array(buf, off, T.n * T.gw * T.gh), TV = new Float32Array(tq.length); for (let i = 0; i < tq.length; i++) TV[i] = tq[i] * T.s;
  return { hdr, V, Z, n, D, F, labels: hdr.labels, TV, tpl: T };
}

// ---------- 작은 도구 ----------
const maxf = (x, r) => { const o = Float32Array.from(x); for (let k = 1; k <= r; k++) for (let i = 0; i < x.length; i++) { if (i - k >= 0 && x[i - k] > o[i]) o[i] = x[i - k]; if (i + k < x.length && x[i + k] > o[i]) o[i] = x[i + k]; } return o; };
const pct = (a, p) => { const s = Float32Array.from(a).sort(), r = (s.length - 1) * p, i = Math.floor(r), f = r - i; return i + 1 < s.length ? s[i] * (1 - f) + s[i + 1] * f : s[i]; };
const arange = (a, b, st) => { const o = []; for (let i = 0; ; i++) { const v = a + i * st; if (v >= b) break; o.push(v); } return o; };
const runs = (prof, thr, minlen) => { const out = []; let s = -1; for (let i = 0; i <= prof.length; i++) { const v = i < prof.length && prof[i] > thr; if (v && s < 0) s = i; if (!v && s >= 0) { if (i - s >= minlen) out.push([s, i]); s = -1; } } return out; };
const pyRound = v => { const r = Math.round(v); return (Math.abs(v % 1) === 0.5 && r % 2) ? r - 1 : r; }; // 파이썬 round (짝수로)

// PIL BILINEAR 줄이기와 같은 방식: 줄이는 비율만큼 넓힌 삼각 필터 (가로 → 세로)
function coeffs(inSize, outSize) {
  const scale = inSize / outSize, fs = Math.max(scale, 1), sup = fs, out = [];
  for (let i = 0; i < outSize; i++) {
    const c = (i + 0.5) * scale, x0 = Math.max(Math.trunc(c - sup + 0.5), 0), x1 = Math.min(Math.trunc(c + sup + 0.5), inSize);
    const w = []; let s = 0;
    for (let x = x0; x < x1; x++) { const t = Math.abs((x - c + 0.5) / fs), v = t < 1 ? 1 - t : 0; w.push(v); s += v; }
    out.push([x0, w.map(v => s ? v / s : 0)]);
  }
  return out;
}
// 그림의 (x0,y0)-(x1,y1) 칸을 ow×oh로 줄여 RGB 실수 배열로 (그림 밖은 검정, PIL crop과 같음)
function resampleBox(img, x0, y0, x1, y1, ow, oh) {
  const { R, G, B, W, H } = img, iw = x1 - x0, ih = y1 - y0, cx = coeffs(iw, ow), cy = coeffs(ih, oh);
  const tmp = new Float32Array(ih * ow * 3);
  for (let y = 0; y < ih; y++) {
    const yy = y0 + y, ok = yy >= 0 && yy < H;
    for (let i = 0; i < ow; i++) {
      const [s, w] = cx[i]; let r = 0, g = 0, b = 0;
      if (ok) for (let k = 0; k < w.length; k++) { const xx = x0 + s + k; if (xx < 0 || xx >= W) continue; const p = yy * W + xx; r += R[p] * w[k]; g += G[p] * w[k]; b += B[p] * w[k]; }
      const t = (y * ow + i) * 3; tmp[t] = Math.round(r); tmp[t + 1] = Math.round(g); tmp[t + 2] = Math.round(b);
    }
  }
  const out = new Float32Array(oh * ow * 3);
  for (let j = 0; j < oh; j++) { const [s, w] = cy[j];
    for (let i = 0; i < ow; i++) { let r = 0, g = 0, b = 0; for (let k = 0; k < w.length; k++) { const t = ((s + k) * ow + i) * 3; r += tmp[t] * w[k]; g += tmp[t + 1] * w[k]; b += tmp[t + 2] * w[k]; } const t = (j * ow + i) * 3; out[t] = Math.round(r); out[t + 1] = Math.round(g); out[t + 2] = Math.round(b); } }
  return out;
}

// ---------- 카드 칸 찾기 ----------
function fitAxis(prof, n, plo, phi, wr, gapp, extra) {
  const fs = Array.from({ length: 12 }, (_, i) => 0.12 + i * (0.76 / 11)), allp = [];
  for (let P = plo; P < phi; P += 0.5) {
    let bp = null;
    for (const r of wr) {
      const w = extra ?? P * r, K = Math.floor((n - w * 0.9) / P) + 1, lim = n - w * 0.9;
      let bi = null;
      for (let o = 0; o < P; o += 1) {
        let sum = 0, cnt = 0, g = 0;
        for (let k = 0; k < K; k++) { const ks = o + k * P; if (!(ks < lim)) continue; cnt++;
          const b1 = Math.min(n - 1, Math.max(0, Math.trunc(ks))), b2 = Math.min(n - 1, Math.max(0, Math.trunc(ks + w))); sum += prof[b1] + prof[b2];
          if (gapp) for (const f of fs) g += gapp[Math.min(n - 1, Math.max(0, Math.trunc(ks + w * f)))]; }
        const c = cnt || 1, v = sum / c / 2, sc = gapp ? v - 0.8 * g / (c * fs.length) : v;
        if (bi === null || sc > bi[0]) bi = [sc, P, o, w];
      }
      if (bp === null || bi[0] > bp[0]) bp = bi;
      if (extra != null) break;
    }
    allp.push(bp);
  }
  if (!allp.length) return null;
  const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3];
  const mx = xs => xs.reduce((a, b) => cmp(b, a) > 0 ? b : a);
  const top = Math.max(...allp.map(a => a[0]));
  if (top <= 0) return mx(allp);
  for (const a of allp) if (a[0] >= top * 0.88) return mx(allp.filter(b => Math.abs(b[1] - a[1]) <= 2)); // 두 배 간격 대신 가장 짧은 간격
  return mx(allp);
}

export function toPlanes(imageData) {
  const { data, width: W, height: H } = imageData, N = W * H, R = new Uint8Array(N), G = new Uint8Array(N), B = new Uint8Array(N);
  for (let i = 0; i < N; i++) { R[i] = data[i * 4]; G[i] = data[i * 4 + 1]; B[i] = data[i * 4 + 2]; }
  return { R, G, B, W, H };
}

function grid(img) {
  const { R, G, B, W, H } = img, N = W * H;
  // 바탕색 = 가장자리에서 가장 흔한 색
  const cnt = new Map(), add = i => { const k = ((R[i] >> 3) << 10) | ((G[i] >> 3) << 5) | (B[i] >> 3); cnt.set(k, (cnt.get(k) || 0) + 1); };
  for (let x = 0; x < W; x++) { add(x); add((H - 1) * W + x); } for (let y = 0; y < H; y++) { add(y * W); add(y * W + W - 1); }
  let bk = 0, bc = -1; for (const [k, c] of cnt) if (c > bc) { bc = c; bk = k; }
  const bg = [((bk >> 10) & 31) * 8 + 4, ((bk >> 5) & 31) * 8 + 4, (bk & 31) * 8 + 4];
  const fg = new Uint8Array(N), gray = new Float32Array(N);
  for (let i = 0; i < N; i++) { const d = Math.max(Math.abs(R[i] - bg[0]), Math.abs(G[i] - bg[1]), Math.abs(B[i] - bg[2])); fg[i] = d > 48 ? 1 : 0; gray[i] = (R[i] + G[i] + B[i]) / 3; }
  // 세로 경계(위아래 5칸 이어짐) → 열마다, 가로 경계(좌우 5칸) → 줄마다
  const exc = new Float32Array(W), eyc = new Float32Array(H);
  const gxAt = (y, x) => Math.abs(gray[y * W + x + 1] - gray[y * W + x]) > 24, gyAt = (y, x) => Math.abs(gray[(y + 1) * W + x] - gray[y * W + x]) > 24;
  { const run = new Uint8Array(W); for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) { run[x] = gxAt(y, x) ? run[x] + 1 : 0; if (run[x] >= 5) exc[x]++; } }
  for (let x = 0; x < W; x++) exc[x] /= Math.max(1, H - 4);
  for (let y = 0; y < H - 1; y++) { let r = 0; for (let x = 0; x < W; x++) { r = gyAt(y, x) ? r + 1 : 0; if (r >= 5) eyc[y]++; } eyc[y] /= Math.max(1, W - 4); }
  exc[W - 1] = 0; eyc[H - 1] = 0;
  const ex = maxf(exc, 2), ey = maxf(eyc, 2);
  const colp = new Float32Array(W); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) colp[x] += fg[y * W + x]; for (let x = 0; x < W; x++) colp[x] /= H;
  const lvl = pct(colp, 0.8) || 1, ex1 = maxf(ex, 1), gapx = new Float32Array(W);
  for (let x = 0; x < W; x++) { const t = Math.min(1, Math.max(0, 1 - colp[x] / lvl)); gapx[x] = Math.max(t * t, ex1[x]); }
  const bx = fitAxis(ex, W, Math.max(30, W / 14), W / 3.5, [0.86, 0.89, 0.92, 0.95, 0.98], gapx);
  if (!bx) return null;
  const [, P, o, cw] = bx, ch = cw * 88 / 63;
  const strip = new Uint8Array(W); for (const x of arange(o, W - cw * 0.8, P).map(Math.trunc)) for (let i = Math.max(0, x + Math.trunc(cw * 0.1)); i < Math.min(W, x + Math.trunc(cw * 0.9)); i++) strip[i] = 1;
  let ns = 0; for (let i = 0; i < W; i++) ns += strip[i];
  const rowp = new Float32Array(H); for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x++) if (strip[x]) s += fg[y * W + x]; rowp[y] = ns ? s / ns : 0; }
  const lv2 = pct(rowp, 0.8) || 1, gapy = rowp.map(v => { const t = Math.min(1, Math.max(0, 1 - v / lv2)); return t * t; });
  const rr = runs(rowp, lv2 * 0.5, Math.max(4, Math.trunc(ch * 0.4))); const anchor = rr.length ? rr[0][0] : null;
  let Py, oy, Pyac = null;
  if (anchor === null) { const f = fitAxis(ey, H, ch, ch * 1.65, [1], gapy, ch); Py = f[1]; oy = f[2]; }
  else {
    let best = null; const ls = Array.from({ length: 10 }, (_, i) => 0.12 + i * (0.76 / 9));
    for (let Pq = ch * 0.6; Pq < ch * 1.7; Pq += 0.5) {
      const tops = arange(anchor, H - ch * 0.5, Pq); let sc = 0;
      if (tops.length >= 2) { let a = 0, b = 0, g = 0, gn = 0;
        for (let i = 1; i < tops.length; i++) a += ey[Math.trunc(tops[i])]; a /= tops.length - 1;
        for (const t of tops) { b += ey[Math.min(H - 1, Math.trunc(t + ch))]; for (const f of ls) { g += gapy[Math.min(H - 1, Math.trunc(t + ch * f))]; gn++; } } b /= tops.length;
        sc = a + b / 2 - 0.8 * g / gn; }
      if (best === null || sc > best[0]) best = [sc, Pq];
    }
    Py = best[1]; oy = anchor;
    // 줄 간격을 '줄끼리 닮은 정도'(세로 자기상관)로 다시 잼
    const g2 = new Float32Array(H - 1); for (let y = 0; y < H - 1; y++) { let s = 0; for (let x = 0; x < W; x++) if (strip[x]) s += Math.abs(gray[(y + 1) * W + x] - gray[y * W + x]); g2[y] = ns ? s / ns : 0; }
    let m = 0; for (const v of g2) m += v; m /= g2.length; const s2 = g2.map(v => v - m); let den = 0; for (const v of s2) den += v * v; den = den / s2.length + 1e-9;
    const L0 = Math.trunc(ch * 0.6), L1 = Math.trunc(Math.min(ch * 1.9, H - ch * 0.5));
    if (L1 - L0 > 3) {
      const ac = []; for (let L = L0; L < L1; L++) { let s = 0; for (let i = 0; i + L < s2.length; i++) s += s2[i] * s2[i + L]; ac.push(s / (s2.length - L) / den); }
      const top = Math.max(...ac);
      for (let i = 1; i < ac.length - 1; i++) { let lm = -Infinity; for (let j = Math.max(0, i - 3); j < Math.min(ac.length, i + 4); j++) lm = Math.max(lm, ac[j]);
        if (ac[i] >= top * 0.8 && ac[i] >= lm) { const dd = ac[i - 1] - 2 * ac[i] + ac[i + 1]; Pyac = L0 + i + (dd ? 0.5 * (ac[i - 1] - ac[i + 1]) / dd : 0); break; } }
    }
  }
  // 카드 칸 놓기 (fg 합: 적분 그림으로 빠르게)
  const S = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x < W; x++) { r += fg[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + r; } }
  const fgMean = (x0, y0, x1, y1) => { x0 = Math.max(0, x0); y0 = Math.max(0, y0); if (x1 <= x0 || y1 <= y0) return 0; return (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0)); };
  const placeAt = (Pq, oq) => {
    const res = [], ys = oq >= Pq ? oq - Pq * Math.floor(oq / Pq) : oq;
    for (const y of arange(ys, H - ch * 0.55, Pq)) for (const x of arange(o, W - cw * 0.8, P)) {
      const x0 = pyRound(x), y0 = pyRound(y), x1 = Math.trunc(Math.min(W, x0 + cw)), y1 = Math.trunc(Math.min(H, y0 + ch)), fm = fgMean(x0, y0, x1, y1);
      if (y0 < -ch * 0.1 || fm < 0.12) continue;
      res.push({ x: x0, y: y0, w: cw, h: ch, weak: fm < 0.4 });
    }
    return res;
  };
  return { bg, Pys: [Py, ...(Pyac && Math.abs(Pyac - Py) > 2 ? [Pyac] : [])], oy, ch, cw, placeAt };
}

// ---------- 그림으로 카드 찾기 ----------
function featBox(img, idx, x0, y0, x1, y1) {
  const [a0, a1, a2, a3] = idx.hdr.art, w = x1 - x0, h = y1 - y0;
  const v = resampleBox(img, x0 + pyRound(w * a0), y0 + pyRound(h * a1), x0 + pyRound(w * a2), y0 + pyRound(h * a3), idx.hdr.fw, idx.hdr.fh);
  let m = 0; for (const t of v) m += t; m /= v.length; let s = 0; for (let i = 0; i < v.length; i++) { v[i] -= m; s += v[i] * v[i]; } s = 1 / (Math.sqrt(s) + 1e-6);
  const D = idx.D, z = new Float32Array(D); // 96차원으로 바꿈
  for (let i = 0; i < v.length; i++) { const t = v[i] * s; if (!t) continue; const r = i * D; for (let k = 0; k < D; k++) z[k] += t * idx.V[r + k]; }
  let zn = 0; for (const t of z) zn += t * t; zn = 1 / (Math.sqrt(zn) + 1e-6); for (let k = 0; k < D; k++) z[k] *= zn;
  return z;
}
function scores(idx, z) { const { Z, n, D } = idx, out = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; const r = i * D; for (let k = 0; k < D; k++) s += Z[r + k] * z[k]; out[i] = s; } return out; }
const boxOf = (c, dx = 0, dy = 0) => { const x0 = c.x + c.w * dx, y0 = c.y + c.h * dy; return [pyRound(x0), pyRound(y0), pyRound(x0 + c.w), pyRound(y0 + c.h)]; };
function identify(img, idx, c, names) {
  let best = null;
  for (const dy of [-0.02, 0, 0.02]) for (const dx of [-0.015, 0, 0.015]) {
    const s = scores(idx, featBox(img, idx, ...boxOf(c, dx, dy))); let bi = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[bi]) bi = i;
    if (!best || s[bi] > best.s[best.i]) best = { s, i: bi };
  }
  const { s } = best, ord = Array.from(s.keys()).sort((a, b) => s[b] - s[a]).slice(0, 60), cands = [], seen = new Set();
  for (const i of ord) { const nm = names[i]; if (seen.has(nm)) continue; seen.add(nm); cands.push({ i, label: idx.labels[i], name: nm, score: s[i] }); if (cands.length >= 6) break; }
  const top = cands[0], gap = top.score - (cands[1] ? cands[1].score : 0);
  return { cands, score: top.score, gap, sure: top.score >= 0.68 && gap >= 0.1 };
}

// 카드 한 장의 그림 (덱 코드의 일본 공식 카드 그림처럼 카드만 있는 그림)
export function identifyCard(imageData, idx, names) { const img = toPlanes(imageData); return identify(img, idx, { x: 0, y: 0, w: img.W, h: img.H }, names); }

// ---------- 장수 칸과 숫자 ----------
function findBadge(img, c) { return findBadge1(img, c, 34) || findBadge1(img, c, 20); }
function findBadge1(img, c, tol) {
  const { R, G, B, W, H } = img, cw = c.w, chh = c.h, cx = c.x + cw / 2;
  const x0 = Math.trunc(Math.max(0, cx - cw * 0.38)), x1 = Math.trunc(Math.min(W, cx + cw * 0.38)), y0 = Math.trunc(Math.max(0, c.y + chh * 0.55)), y1 = Math.trunc(Math.min(H, c.y + chh * 1.32));
  const bw0 = x1 - x0, bh0 = y1 - y0; if (bw0 <= 2 || bh0 <= 2) return null;
  const done = new Uint8Array(bw0 * bh0), mark = new Int32Array(bw0 * bh0), step = Math.max(2, Math.trunc(cw / 40)), maxn = Math.trunc(cw * cw * 0.6);
  let best = null, stamp = 0; const stack = new Int32Array(bw0 * bh0), pts = new Int32Array(bw0 * bh0);
  for (let sy = y0; sy < y1; sy += step) for (let sx = x0; sx < x1; sx += step) {
    if (done[(sy - y0) * bw0 + sx - x0]) continue;
    stamp++; const p0 = sy * W + sx, c0 = [R[p0], G[p0], B[p0]]; let sp = 0, np = 0, over = false;
    stack[sp++] = (sy - y0) * bw0 + sx - x0; mark[stack[0]] = stamp;
    while (sp) { const q = stack[--sp]; pts[np++] = q; if (np > maxn) { over = true; break; }
      const qy = Math.trunc(q / bw0), qx = q - qy * bw0;
      for (const [ny, nx] of [[qy + 1, qx], [qy - 1, qx], [qy, qx + 1], [qy, qx - 1]]) {
        if (nx < 0 || ny < 0 || nx >= bw0 || ny >= bh0) continue; const k = ny * bw0 + nx; if (mark[k] === stamp) continue;
        const p = (ny + y0) * W + nx + x0; if (Math.max(Math.abs(R[p] - c0[0]), Math.abs(G[p] - c0[1]), Math.abs(B[p] - c0[2])) > tol) continue;
        const pq = (qy + y0) * W + qx + x0; if (Math.max(Math.abs(R[p] - R[pq]), Math.abs(G[p] - G[pq]), Math.abs(B[p] - B[pq])) > 16) continue; // 한 칸 사이에 확 바뀌면 경계 (장수 칸이 옆의 어두운 카드와 붙지 않게)
        mark[k] = stamp; stack[sp++] = k; } }
    if (over) { // 너무 큰 덩어리 (바탕·그림): 씨앗과 거의 같은 색만 건너뜀 (장수 칸까지 건너뛰지 않게)
      continue; }
    for (let i = 0; i < np; i++) done[pts[i]] = 1;
    let mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1;
    for (let i = 0; i < np; i++) { const q = pts[i], qy = Math.trunc(q / bw0), qx = q - qy * bw0; if (qx < mnx) mnx = qx; if (qx > mxx) mxx = qx; if (qy < mny) mny = qy; if (qy > mxy) mxy = qy; }
    const bw = mxx - mnx + 1, bh = mxy - mny + 1;
    if (!(cw * 0.1 <= bw && bw <= cw * 0.72 && cw * 0.1 <= bh && bh <= cw * 0.72)) continue;
    if (mnx <= 0 || mxx >= bw0 - 1) continue; // 찾는 칸 가장자리에 닿으면 바탕이나 그림
    const bxc = x0 + (mnx + mxx) / 2; if (Math.abs(bxc - cx) > cw * 0.12) continue;
    // 덩어리로 둘러싸인 자리 가운데 덩어리 색과 많이 다른 점 = 숫자
    const inb = new Uint8Array(bw * bh); for (let i = 0; i < np; i++) { const q = pts[i], qy = Math.trunc(q / bw0), qx = q - qy * bw0; inb[(qy - mny) * bw + qx - mnx] = 1; }
    const L = new Uint8Array(bw * bh), Rr = new Uint8Array(bw * bh), U = new Uint8Array(bw * bh), Dn = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) { let a = 0; for (let x = 0; x < bw; x++) { a |= inb[y * bw + x]; L[y * bw + x] = a; } a = 0; for (let x = bw - 1; x >= 0; x--) { a |= inb[y * bw + x]; Rr[y * bw + x] = a; } }
    for (let x = 0; x < bw; x++) { let a = 0; for (let y = 0; y < bh; y++) { a |= inb[y * bw + x]; U[y * bw + x] = a; } a = 0; for (let y = bh - 1; y >= 0; y--) { a |= inb[y * bw + x]; Dn[y * bw + x] = a; } }
    const dig = new Uint8Array(bw * bh), gv = new Float32Array(bw * bh); let nd = 0, dmn = 1e9, dmx = -1, fill = 0;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const k = y * bw + x; fill += inb[k]; const p = (y + mny + y0) * W + x + mnx + x0, d = Math.max(Math.abs(R[p] - c0[0]), Math.abs(G[p] - c0[1]), Math.abs(B[p] - c0[2]));
      gv[k] = d; if (L[k] && Rr[k] && U[k] && Dn[k] && !inb[k] && d > 90) { dig[k] = 1; nd++; if (y < dmn) dmn = y; if (y > dmx) dmx = y; } }
    fill /= bw * bh;
    if (nd < 4 || fill < 0.35 || (dmx - dmn + 1) < bh * 0.3) continue;
    const score = fill - Math.abs(bxc - cx) / cw;
    if (!best || score > best.score) best = { box: [x0 + mnx, y0 + mny, bw, bh], dig, gv, bw, bh, score };
  }
  return best;
}
function glyph(g, gw0, gh0, T) { // g: 0~1 (gw0×gh0) → 10x14 모양
  let mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1;
  for (let y = 0; y < gh0; y++) for (let x = 0; x < gw0; x++) if (g[y * gw0 + x] > 0.45) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
  if (mxx < 0) return null;
  const w = mxx - mnx + 1, h = mxy - mny + 1, asp = w / h;
  const img = { R: new Uint8Array(w * h), G: null, B: null, W: w, H: h };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.R[y * w + x] = Math.trunc(Math.min(1, Math.max(0, g[(y + mny) * gw0 + x + mnx])) * 255);
  img.G = img.R; img.B = img.R;
  const r = resampleBox(img, 0, 0, w, h, T.gw, T.gh), v = new Float32Array(T.gw * T.gh); let m = 0;
  for (let i = 0; i < v.length; i++) { v[i] = r[i * 3] / 255; m += v[i]; } m /= v.length; let s = 0; for (let i = 0; i < v.length; i++) { v[i] -= m; s += v[i] * v[i]; } s = 1 / (Math.sqrt(s) + 1e-6); for (let i = 0; i < v.length; i++) v[i] *= s;
  return { v, asp };
}
function readDigits(b, idx) {
  const { bw, bh, dig, gv } = b, T = idx.tpl, g = new Float32Array(bw * bh);
  for (let i = 0; i < g.length; i++) g[i] = dig[i] ? Math.min(1, Math.max(0, (gv[i] - 40) / 120)) : 0;
  const cols = []; for (let x = 0; x < bw; x++) { let a = false; for (let y = 0; y < bh; y++) if (g[y * bw + x] > 0.45) { a = true; break; } cols.push(a); }
  const parts = []; let s = -1; for (let i = 0; i <= bw; i++) { const v = i < bw && cols[i]; if (v && s < 0) s = i; if (!v && s >= 0) { parts.push([s, i]); s = -1; } }
  let r0 = 1e9, r1 = -1; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (g[y * bw + x] > 0.45) { if (y < r0) r0 = y; if (y > r1) r1 = y; }
  const full = r1 >= 0 ? r1 - r0 + 1 : 0, out = [], n = T.n, GL = T.gw * T.gh;
  for (const [s0, e] of parts) {
    const a = Math.max(0, s0 - 1), z = Math.min(bw, e + 1), w = z - a, sub = new Float32Array(w * bh); let rows = 0;
    for (let y = 0; y < bh; y++) { let any = false; for (let x = 0; x < w; x++) { const v = g[y * bw + a + x]; sub[y * w + x] = v; if (v > 0.45) any = true; } if (any) rows++; }
    if (rows < full * 0.6) continue;
    const gl = glyph(sub, w, bh, T); if (!gl) continue;
    const best = {};
    for (let t = 0; t < n; t++) { let d = 0; for (let k = 0; k < GL; k++) d += idx.TV[t * GL + k] * gl.v[k]; const sc = d - 0.5 * Math.abs(T.asp[t] - gl.asp), dg = T.dig[t]; if (!(dg in best) || sc > best[dg]) best[dg] = sc; }
    out.push(best);
  }
  return out;
}
function numCands(parts) { // 자리별 점수 → {장수: 점수}
  if (!parts.length) return {};
  if (parts.length === 1) return Object.fromEntries(Object.entries(parts[0]).filter(([d]) => d !== '0').map(([d, v]) => [+d, v]));
  const c = {}, top3 = p => Object.entries(p).sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [d1, v1] of top3(parts[0])) for (const [d2, v2] of top3(parts[1])) if (d1 !== '0') c[+(d1 + d2)] = (v1 + v2) / 2;
  return c;
}

// ---------- 전체 ----------
// names[i]: 목록 i번 그림의 이름 (띄어쓰기 없앤 한국어 이름, 같은 이름끼리 묶어 '다음 후보'를 셈)
// energy[i]: 목록 i번이 기본 에너지면 1 (1~4장 규칙 없음)
export function scanDeck(imageData, idx, names, energy, progress = () => {}) {
  const img = toPlanes(imageData);
  progress(0.05, '카드 칸 찾는 중');
  const g = grid(img);
  if (!g) return { cards: [], note: '카드 칸을 찾지 못했어요.' };
  // 줄 간격 후보와 첫 줄 위치를 그림 비교 점수로 고름 (10장만 골고루 빠르게)
  const quick = cs => { cs = cs.filter(c => !c.weak); if (!cs.length) return 0; const st = Math.max(1, Math.floor(cs.length / 10)), pick = cs.filter((_, i) => i % st === 0).slice(0, 10);
    let t = 0; for (const c of pick) { const s = scores(idx, featBox(img, idx, ...boxOf(c))); let m = -1; for (const v of s) if (v > m) m = v; t += m; } return t / pick.length; };
  let best = null; const tries = [];
  for (const Py of g.Pys) for (let i = 0; i <= 12; i++) tries.push([Py, (-0.12 + i * 0.02) * g.ch]);
  tries.forEach(([Py, dy], i) => { const cs = g.placeAt(Py, g.oy + dy), q = quick(cs); if (!best || q > best.q) best = { q, cs }; progress(0.05 + 0.35 * (i + 1) / tries.length, '카드 칸 맞추는 중'); });
  let cards = best.cs;
  // 줄마다 위아래 위치를 그림 점수로 다시 맞춤: 줄 간격이 조금만 틀려도 첫 줄·끝 줄로 갈수록 칸이 어긋나 포켓몬 그림을 못 찾음 (2026-11-18, 영문 4줄 사진)
  const rows = new Map(); for (const c of cards) { if (!rows.has(c.y)) rows.set(c.y, []); rows.get(c.y).push(c); }
  const rowQ = (cs, dy) => { let t = 0; for (const c of cs) { const s = scores(idx, featBox(img, idx, ...boxOf(c, 0, dy))); let m = -1; for (const v of s) if (v > m) m = v; t += m; } return t / cs.length; };
  let ri = 0;
  for (const cs of rows.values()) {
    const pool = cs.filter(c => !c.weak), use = pool.length ? pool : cs, st = Math.max(1, Math.floor(use.length / 4)), sm = use.filter((_, i) => i % st === 0).slice(0, 4);
    let bd = 0, bq = -1;
    for (let k = -4; k <= 4; k++) { const q = rowQ(sm, k * 0.03); if (q > bq) { bq = q; bd = k * 0.03; } } // 3% 간격으로 넓게
    const c0 = bd; for (const d of [-0.02, -0.01, 0.01, 0.02]) { const q = rowQ(sm, c0 + d); if (q > bq) { bq = q; bd = c0 + d; } } // 1% 간격으로 좁게
    if (bd) for (const c of cs) c.y = pyRound(c.y + c.h * bd);
    progress(0.4 + 0.1 * (++ri) / rows.size, '카드 칸 맞추는 중');
  }
  // 카드마다 그림으로 찾기
  const out = [];
  cards.forEach((c, i) => {
    const r = identify(img, idx, c, names);
    progress(0.5 + 0.4 * (i + 1) / cards.length, `카드 찾는 중 ${i + 1}/${cards.length}`);
    if (c.weak && r.score < 0.6) return; // 흰 바탕 칸이 카드가 아님
    const b = findBadge(img, c), cand = b ? numCands(readDigits(b, idx)) : {};
    out.push({ ...c, ...r, badge: b ? b.box : null, ncand: cand });
  });
  // 장수: 기본 에너지 말고는 1~4장, 합이 60장이 되게 (안 되면 칸마다 가장 비슷한 숫자)
  for (const r of out) {
    const lim = energy[r.cands[0].i] ? 59 : 4, c = Object.fromEntries(Object.entries(r.ncand).filter(([k]) => +k >= 1 && +k <= lim));
    r.cand = Object.keys(c).length ? c : { 1: 0 }; r.n = +Object.keys(r.cand).reduce((a, b) => r.cand[b] > r.cand[a] ? b : a); r.nSure = !!r.badge && Object.keys(c).length > 0;
  }
  let dp = new Map([[0, [0, []]]]);
  for (const r of out) { const nd = new Map();
    for (const [tot, [sc0, pick]] of dp) for (const [k, v] of Object.entries(r.cand)) { const t = tot + +k; if (t <= 60 && (!nd.has(t) || nd.get(t)[0] < sc0 + v)) nd.set(t, [sc0 + v, [...pick, +k]]); }
    dp = nd; }
  // 장수 칸을 모두 읽었을 때만 60장 맞춤으로 흐린 숫자를 고침. 못 읽은 칸이 하나면 60에서 나머지를 뺀 수, 둘 이상이면 1장으로 두고 '?' 표시
  const miss = out.filter(r => !r.nSure), fit60 = !miss.length && dp.has(60);
  if (fit60) out.forEach((r, i) => { const k = dp.get(60)[1][i]; r.fixed = k !== r.n; r.n = k; });
  else if (miss.length === 1) { const r = miss[0], k = 60 - out.reduce((a, x) => a + (x === r ? 0 : x.n), 0), lim = energy[r.cands[0].i] ? 59 : 4; if (k >= 1 && k <= lim) { r.n = k; r.fixed = true; } }
  progress(1, '끝');
  return { cards: out, fit60, total: out.reduce((a, r) => a + r.n, 0) };
}
