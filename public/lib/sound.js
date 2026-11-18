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
  const v = o.vol ?? 0.2, a = o.a ?? 0.005, sus = o.sus || 0;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
  if (sus) { g.gain.setTargetAtTime(v * sus, t + a, 0.08); g.gain.setValueAtTime(v * sus, t + Math.max(a, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03); } // 길게 유지되는 소리
  else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
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

// ---------- 효과음: '실감' 묶음 (11/18 링크 님 고름) — 실제 카드를 내려놓는 듯한 묵직한 소리 ----------
const bell = (f, t, dur, v) => [[1, v], [2.76, v * 0.4], [5.4, v * 0.2]].forEach(([k, vv]) => tone(f * k, t, dur / (k > 1 ? 1.6 : 1), { vol: vv }));
const FX = {
  tap: t => { noise(t, 0.018, { ft: 'highpass', f: 4800, vol: 0.08 }); tone(2400, t, 0.02, { vol: 0.03 }); },
  pop: t => { noise(t, 0.02, { ft: 'highpass', f: 4000, vol: 0.07 }); tone(900, t, 0.06, { to: 600, vol: 0.06 }); },
  open: t => { noise(t, 0.13, { f: 1200, to: 2600, vol: 0.06, q: 0.9, a: 0.02 }); },
  notify: t => { bell(N(84), t, 0.7, 0.05); },
  error: t => { tone(180, t, 0.1, { to: 120, vol: 0.22 }); noise(t, 0.05, { ft: 'lowpass', f: 700, vol: 0.12 }); tone(160, t + 0.13, 0.12, { to: 100, vol: 0.2 }); },
  draw: t => { noise(t, 0.2, { f: 1600, to: 3800, vol: 0.13, q: 0.9, a: 0.03 }); noise(t + 0.17, 0.03, { ft: 'highpass', f: 5000, vol: 0.06 }); },
  place: t => { noise(t, 0.07, { ft: 'lowpass', f: 900, vol: 0.32 }); tone(130, t, 0.12, { to: 55, vol: 0.32 }); noise(t, 0.012, { ft: 'highpass', f: 6000, vol: 0.12 }); },
  play: t => { noise(t, 0.12, { f: 1600, to: 3200, vol: 0.1, a: 0.02 }); noise(t + 0.1, 0.06, { ft: 'lowpass', f: 900, vol: 0.22 }); tone(140, t + 0.1, 0.1, { to: 60, vol: 0.2 }); },
  attach: t => { FX.place(t); [1568, 2350, 3136].forEach((f, i) => tone(f, t + 0.05, 0.7 - i * 0.12, { vol: 0.05 - i * 0.012, detune: i * 7 })); noise(t + 0.05, 0.35, { ft: 'highpass', f: 7000, vol: 0.03, a: 0.05 }); },
  evolve: t => { noise(t, 1.0, { f: 300, to: 6000, vol: 0.12, q: 1.2, a: 0.8 }); tone(220, t, 1.0, { to: 880, type: 'sawtooth', vol: 0.03, a: 0.8, lp: 2400 }); tone(80, t + 1.0, 0.6, { to: 38, vol: 0.4 }); [84, 88, 91].forEach(n => tone(N(n), t + 1.0, 1.1, { vol: 0.04 })); },
  shuffle: t => { let a = 0; for (let i = 0; i < 14; i++) { noise(t + a, 0.018, { f: 3000 + Math.random() * 2500, q: 2.5, vol: 0.09 }); a += 0.05 - i * 0.002; } noise(t + a + 0.04, 0.05, { ft: 'lowpass', f: 900, vol: 0.18 }); },
  retreat: t => { noise(t, 0.3, { f: 3000, to: 700, vol: 0.09, a: 0.05 }); },
  attack: t => { noise(t, 0.13, { f: 600, to: 4000, vol: 0.12, a: 0.1 }); tone(95, t + 0.13, 0.5, { to: 34, vol: 0.5 }); noise(t + 0.13, 0.35, { ft: 'lowpass', f: 1500, vol: 0.3 }); noise(t + 0.13, 0.05, { ft: 'highpass', f: 5000, vol: 0.15 }); },
  damage: t => { tone(170, t, 0.13, { to: 60, vol: 0.4 }); noise(t, 0.09, { f: 700, vol: 0.2 }); },
  heal: t => { [76, 79, 84].forEach((n, i) => bell(N(n), t + i * 0.09, 0.8, 0.035)); },
  coin: t => { [0, .07, .13, .18, .22].forEach(a => noise(t + a, 0.015, { f: 6500, q: 4, vol: 0.12 })); [2637, 3951, 5274].forEach((f, i) => tone(f, t + 0.32, 1.1 - i * 0.25, { vol: 0.05 - i * 0.012, detune: i ? 9 : 0 })); },
  prize: t => { noise(t, 0.16, { f: 2000, to: 4200, vol: 0.1, a: 0.03 }); tone(N(91), t + 0.14, 0.6, { vol: 0.05 }); tone(N(96), t + 0.18, 0.6, { vol: 0.04 }); },
  judge: t => { [0, 0.12].forEach(a => { tone(820, t + a, 0.05, { vol: 0.08 }); noise(t + a, 0.03, { f: 1500, q: 2, vol: 0.1 }); }); },
  ko: t => { tone(90, t, 0.9, { to: 30, vol: 0.5 }); noise(t, 1.1, { ft: 'lowpass', f: 900, to: 200, vol: 0.32, a: 0.01 }); tone(320, t + 0.1, 1.0, { to: 60, type: 'sawtooth', vol: 0.025, lp: 900 }); },
  turnMine: t => { bell(N(69), t, 1.3, 0.06); tone(N(76), t + 0.16, 1.1, { vol: 0.035 }); },
  turnTheirs: t => { bell(N(64), t, 1.0, 0.04); },
  start: t => { [60, 64, 67, 72].forEach((n, i) => tone(N(n), t + 0.05, 0.9, { type: 'sawtooth', vol: 0.03, a: 0.06, lp: 1800, detune: i * 3 })); tone(70, t, 0.5, { to: 45, vol: 0.35 }); noise(t + 0.05, 1.0, { ft: 'highpass', f: 5200, vol: 0.08 }); },
  win: t => { [60, 64, 67, 72].forEach((n, i) => tone(N(n), t + 0.05, 1.5, { type: 'sawtooth', vol: 0.035, a: 0.09, sus: 0.8, lp: 1800, detune: i * 3 })); for (let i = 0; i < 7; i++) tone(90, t + i * 0.035, 0.12, { to: 70, vol: 0.12 + i * 0.02 }); noise(t + 0.25, 1.6, { ft: 'highpass', f: 5000, vol: 0.11 }); tone(65, t + 0.25, 0.7, { to: 45, vol: 0.4 }); },
  lose: t => { [57, 60, 64].forEach((n, i) => tone(N(n), t, 1.4, { type: 'sawtooth', to: N(n - 2), slide: 1.2, vol: 0.03, a: 0.05, lp: 1100, detune: i * 4 })); tone(80, t, 0.6, { to: 40, vol: 0.3 }); },
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
