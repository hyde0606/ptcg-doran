// 효과음과 배경음악 (모두 Web Audio 로 직접 만든 소리, 외부 음원 없음)
// 브라우저는 사용자가 한 번 누르기 전에는 소리를 못 내므로 첫 누르기 때 켠다.
const LS = 'snd';
const DEF = { sfx: true, sfxVol: 0.7, bgm: true, bgmVol: 0.35, mute: false };
let S = { ...DEF };
try { S = { ...DEF, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch {}
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };

let ctx = null, master, sfxBus, bgmBus, noiseBuf, unlocked = false;
function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    bgmBus = ctx.createGain(); bgmBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function applyVol() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(S.mute ? 0 : 1, t, 0.05);
  sfxBus.gain.setTargetAtTime(S.sfx ? S.sfxVol : 0, t, 0.05);
  bgmBus.gain.setTargetAtTime(S.bgm ? S.bgmVol * 0.55 : 0, t, 0.3);
}

// ---------- 기본 소리 ----------
function tone(f, t, dur, o = {}) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
  if (o.detune) osc.detune.value = o.detune;
  const v = o.vol ?? 0.2, a = o.a ?? 0.005;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; osc.connect(f2); node = f2; }
  node.connect(g); g.connect(o.bus || sfxBus);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(t, dur, o = {}) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true;
  f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1200, t); f.Q.value = o.q ?? 1;
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const v = o.vol ?? 0.15, a = o.a ?? 0.004;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI 번호 → 주파수

// ---------- 효과음 ----------
const FX = {
  tap: t => { tone(1100, t, 0.06, { to: 760, vol: 0.07 }); noise(t, 0.02, { f: 4000, vol: 0.03 }); },
  pop: t => { tone(520, t, 0.09, { to: 980, slide: 0.05, vol: 0.12 }); tone(1560, t + 0.03, 0.08, { type: 'triangle', vol: 0.05 }); },
  open: t => { noise(t, 0.16, { f: 500, to: 2200, vol: 0.05, q: 0.8 }); tone(880, t + 0.05, 0.12, { type: 'triangle', vol: 0.05 }); },
  notify: t => { tone(1046, t, 0.35, { vol: 0.08 }); tone(1568, t + 0.06, 0.4, { vol: 0.05 }); },
  error: t => { tone(220, t, 0.12, { type: 'square', vol: 0.05, lp: 900 }); tone(196, t + 0.13, 0.16, { type: 'square', vol: 0.05, lp: 900 }); },
  draw: t => { noise(t, 0.16, { f: 2600, to: 900, vol: 0.12, q: 1.5 }); tone(1300, t + 0.12, 0.05, { vol: 0.04 }); },
  place: t => { tone(170, t, 0.14, { to: 80, vol: 0.28 }); noise(t, 0.05, { ft: 'lowpass', f: 600, vol: 0.12 }); tone(1400, t + 0.01, 0.04, { vol: 0.04 }); },
  play: t => { noise(t, 0.18, { f: 900, to: 3200, vol: 0.08 }); tone(660, t + 0.06, 0.12, { type: 'triangle', vol: 0.06 }); tone(990, t + 0.12, 0.14, { type: 'triangle', vol: 0.05 }); },
  attach: t => { FX.place(t); [1318, 1760, 2093].forEach((f, i) => tone(f, t + 0.06 + i * 0.05, 0.16, { type: 'triangle', vol: 0.045 })); },
  evolve: t => { tone(330, t, 0.5, { to: 1320, slide: 0.45, type: 'triangle', vol: 0.09 }); noise(t, 0.5, { f: 600, to: 5000, vol: 0.05 }); tone(1760, t + 0.48, 0.3, { vol: 0.07 }); },
  shuffle: t => { for (let i = 0; i < 8; i++) noise(t + i * 0.045, 0.03, { f: 2800 + Math.random() * 1200, vol: 0.08, q: 2 }); },
  retreat: t => { noise(t, 0.25, { f: 2400, to: 500, vol: 0.07 }); },
  attack: t => { noise(t, 0.16, { f: 500, to: 3500, vol: 0.12 }); tone(140, t + 0.15, 0.28, { to: 45, vol: 0.38 }); noise(t + 0.15, 0.16, { ft: 'lowpass', f: 1200, vol: 0.22 }); },
  damage: t => { tone(320, t, 0.14, { to: 140, type: 'square', vol: 0.05, lp: 1400 }); },
  heal: t => { [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.07, 0.25, { vol: 0.06 })); },
  coin: t => { for (let i = 0; i < 6; i++) tone(2600 + i * 90, t + i * 0.07, 0.05, { type: 'triangle', vol: 0.025 }); tone(2093, t + 0.5, 0.6, { vol: 0.07 }); tone(2637, t + 0.5, 0.5, { vol: 0.05, detune: 6 }); },
  prize: t => { [84, 88, 91].forEach((n, i) => tone(N(n), t + i * 0.06, 0.22, { type: 'triangle', vol: 0.05 })); },
  judge: t => { [76, 83, 88].forEach((n, i) => tone(N(n), t + i * 0.05, 0.2, { vol: 0.05 })); },
  ko: t => { tone(660, t, 0.5, { to: 110, type: 'square', vol: 0.06, lp: 1500 }); noise(t + 0.1, 0.4, { ft: 'lowpass', f: 800, vol: 0.1 }); },
  turnMine: t => { tone(N(79), t, 0.16, { type: 'triangle', vol: 0.1 }); tone(N(86), t + 0.12, 0.3, { type: 'triangle', vol: 0.1 }); tone(N(91), t + 0.12, 0.3, { vol: 0.04 }); },
  turnTheirs: t => { tone(N(72), t, 0.18, { type: 'triangle', vol: 0.07 }); tone(N(67), t + 0.13, 0.28, { type: 'triangle', vol: 0.06 }); },
  start: t => { [60, 64, 67, 72].forEach((n, i) => tone(N(n + 12), t + i * 0.08, 0.3, { type: 'triangle', vol: 0.07 })); tone(N(84), t + 0.36, 0.5, { vol: 0.05 }); },
  win: t => { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n + 12), t + i * 0.09, 0.35, { type: 'triangle', vol: 0.07 })); [72, 76, 79].forEach(n => tone(N(n + 12), t + 0.7, 1.1, { vol: 0.05 })); },
  lose: t => { [67, 64, 60, 55].forEach((n, i) => tone(N(n + 12), t + i * 0.16, 0.4, { type: 'triangle', vol: 0.06 })); },
};
let lastAt = {};
function sfx(name) {
  if (!S.sfx || S.mute || !unlocked || !FX[name]) return;
  if (!ensure()) return;
  const now = ctx.currentTime;
  if (lastAt[name] && now - lastAt[name] < 0.05) return; // 같은 소리가 한꺼번에 겹치지 않게
  lastAt[name] = now;
  try { FX[name](now + 0.01); } catch {}
}

// ---------- 배경음악 (자체 작곡, 반복) ----------
// 음표: MIDI 번호, 0 = 쉼. 한 마디 = 8칸(8분음표).
const TRACKS = {
  lobby: { bpm: 84,
    chords: [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55], [53, 57, 60], [45, 48, 52], [46, 50, 53], [48, 52, 55]],
    mel: [[69, 0, 72, 0, 69, 67, 65, 0], [65, 0, 69, 0, 74, 0, 72, 0], [74, 0, 72, 70, 69, 0, 67, 0], [67, 0, 64, 0, 67, 0, 72, 0],
          [69, 0, 72, 0, 77, 0, 76, 74], [72, 0, 76, 0, 72, 0, 69, 0], [70, 0, 74, 0, 72, 0, 70, 69], [67, 0, 0, 0, 72, 0, 0, 0]],
    lead: 'sine', drums: false },
  battle: { bpm: 126,
    chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]],
    mel: [[76, 0, 81, 0, 79, 76, 74, 0], [72, 0, 77, 0, 76, 72, 69, 0], [67, 0, 72, 0, 76, 0, 79, 0], [77, 76, 74, 0, 71, 0, 74, 0],
          [76, 0, 81, 0, 83, 0, 84, 0], [81, 0, 79, 77, 76, 0, 72, 0], [74, 0, 79, 0, 77, 0, 74, 0], [76, 0, 80, 0, 83, 0, 0, 0]],
    lead: 'square', drums: true },
};
let cur = null, want = null, timer = null, step = 0, nextT = 0;
function schedule() {
  const tr = TRACKS[cur]; if (!tr || !ctx) return;
  const sp = 60 / tr.bpm / 2; // 8분음표 길이
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % tr.chords.length, s = step % 8, ch = tr.chords[bar], t = nextT, B = bgmBus;
    if (s === 0) ch.forEach(n => tone(N(n + 12), t, sp * 8, { type: 'triangle', vol: 0.035, a: 0.25, lp: 1800, bus: B })); // 화음 패드
    if (tr.drums) {
      tone(N(ch[0] - 12), t, sp * 0.9, { type: 'triangle', vol: s % 2 ? 0.08 : 0.12, bus: B, lp: 600 }); // 8분 베이스
      if (s % 4 === 0) tone(120, t, 0.18, { to: 45, vol: 0.22, bus: B });                               // 킥
      if (s % 4 === 2) noise(t, 0.12, { f: 1800, vol: 0.06, q: 0.7, bus: B });                             // 스네어
      noise(t, 0.03, { ft: 'highpass', f: 7000, vol: s % 2 ? 0.025 : 0.012, bus: B });                    // 하이햇
    } else {
      if (s === 0 || s === 4) tone(N(ch[0] - 12), t, sp * 3.5, { type: 'triangle', vol: 0.1, bus: B, lp: 500 });
      if (s % 2 === 1) tone(N(ch[(s >> 1) % 3] + 24), t, sp * 1.6, { vol: 0.025, bus: B });                 // 반짝이는 아르페지오
    }
    const m = tr.mel[bar][s];
    if (m) tone(N(m), t, sp * 1.8, { type: tr.lead, vol: tr.lead === 'square' ? 0.03 : 0.07, lp: tr.lead === 'square' ? 2200 : 0, bus: B, a: 0.01 });
    step++; nextT += sp;
  }
}
function startLoop() {
  if (!ctx || !want || !S.bgm || S.mute || document.hidden) return;
  if (cur === want && timer) return;
  stopLoop(); cur = want; step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 60); schedule();
}
function stopLoop() { if (timer) clearInterval(timer); timer = null; cur = null; }
function music(name) { want = name; if (unlocked) { ensure(); startLoop(); } }

function unlock() {
  if (unlocked) return; unlocked = true;
  if (ensure()) startLoop();
}
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoop(); else if (unlocked) startLoop(); });

function set(k, v) {
  S[k] = v; save(); if (ctx) applyVol();
  if (k === 'bgm' || k === 'mute') { if (S.bgm && !S.mute) { if (unlocked) { ensure(); startLoop(); } } else stopLoop(); }
}
export default { sfx, music, set, get: k => S[k], unlock, names: Object.keys(FX) };
