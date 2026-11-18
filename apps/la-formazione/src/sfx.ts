/**
 * Effetti sonori sintetizzati con Web Audio: nessun file audio da caricare.
 * Partono solo dopo un clic dell'utente (regola dei browser), con `toggle()`.
 */
let ctx: AudioContext | null = null;
let master: GainNode;
let crowd: GainNode;
let on = false;

function init() {
  ctx = new AudioContext();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  // Tifo di sottofondo: rumore "marrone" filtrato, in loop.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = .6;
  crowd = ctx.createGain(); crowd.gain.value = 0;
  src.connect(bp).connect(crowd).connect(master); src.start();
}

function noise(dur: number, freq: number, q: number) {
  const c = ctx!;
  const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(master);
  return { s, f, g };
}

function tone(type: OscillatorType, freq: number, t: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  return o;
}

export const sfx = {
  toggle(): boolean {
    if (!ctx) init();
    on = !on;
    if (on) void ctx!.resume();
    master.gain.setTargetAtTime(on ? .7 : 0, ctx!.currentTime, .05);
    crowd.gain.setTargetAtTime(on ? .07 : 0, ctx!.currentTime, .4);
    return on;
  },
  kick(strong = false) {
    if (!on || !ctx) return; const t = ctx.currentTime;
    const o = tone('sine', strong ? 170 : 130, t, .16, .9); o.frequency.exponentialRampToValueAtTime(45, t + .12);
    const n = noise(.05, 2600, 1); n.g.gain.setValueAtTime(.3, t); n.g.gain.exponentialRampToValueAtTime(.001, t + .05); n.s.start(t);
  },
  whistle(len = .3) {
    if (!on || !ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.value = 2900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38;
    const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.14, t + .02); g.gain.setValueAtTime(.14, t + len); g.gain.linearRampToValueAtTime(0, t + len + .05);
    o.connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + len + .1); lfo.stop(t + len + .1);
  },
  swell(level: number) { if (on && ctx) crowd.gain.setTargetAtTime(.07 + level * .22, ctx.currentTime, .4); },
  goal() {
    if (!on || !ctx) return; const t = ctx.currentTime;
    const n = noise(3.2, 450, .5); n.f.frequency.setValueAtTime(380, t); n.f.frequency.linearRampToValueAtTime(1100, t + .6);
    n.g.gain.setValueAtTime(0, t); n.g.gain.linearRampToValueAtTime(1.2, t + .25); n.g.gain.exponentialRampToValueAtTime(.001, t + 3.2); n.s.start(t);
    [523, 659, 784].forEach((fr) => tone('sawtooth', fr, t + .12, 1.3, .045));
    crowd.gain.setTargetAtTime(.07, t + 1.6, .8);
  },
  tick(p = 0) { if (on && ctx) tone('square', 1500 + p * 900, ctx.currentTime, .035, .025); },
  beep() { if (!on || !ctx) return; const t = ctx.currentTime; tone('square', 880, t, .1, .06); tone('square', 1320, t + .16, .12, .06); },
  reveal() {
    if (!on || !ctx) return; const t = ctx.currentTime;
    const n = noise(.9, 800, 2); n.f.frequency.setValueAtTime(300, t); n.f.frequency.exponentialRampToValueAtTime(5000, t + .7);
    n.g.gain.setValueAtTime(0, t); n.g.gain.linearRampToValueAtTime(.35, t + .6); n.g.gain.linearRampToValueAtTime(0, t + .9); n.s.start(t);
    [1047, 1319, 1568, 2093].forEach((fr, i) => tone('triangle', fr, t + .7 + i * .07, .6, .11));
  },
};
