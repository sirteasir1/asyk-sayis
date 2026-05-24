// Synthesized audio using WebAudio - no external assets
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicNode: { stop: () => void } | null = null;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(masterGain);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.4;
    musicGain.connect(masterGain);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setSfxVolume(v: number) {
  ensure(); if (sfxGain) sfxGain.gain.value = v;
}
export function setMusicVolume(v: number) {
  ensure(); if (musicGain) musicGain.gain.value = v;
}

export function playImpact(strength = 1) {
  const c = ensure(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  // wood-ish thump
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180 + Math.random() * 60, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
  g.gain.setValueAtTime(0.5 * strength, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(g); g.connect(sfxGain);
  osc.start(now); osc.stop(now + 0.25);

  // click transient
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, 2048, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 200);
  noise.buffer = buf;
  const ng = c.createGain();
  ng.gain.value = 0.3 * strength;
  noise.connect(ng); ng.connect(sfxGain);
  noise.start(now);
}

export function playThrow() {
  const c = ensure(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(g); g.connect(sfxGain);
  osc.start(now); osc.stop(now + 0.3);
}

export function playCharge() {
  const c = ensure(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(400, now + 1.5);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.08, now + 0.5);
  g.gain.linearRampToValueAtTime(0, now + 1.6);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass"; filter.frequency.value = 800;
  osc.connect(filter); filter.connect(g); g.connect(sfxGain);
  osc.start(now); osc.stop(now + 1.6);
}

export function playPerfect() {
  const c = ensure(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, now + i * 0.05);
    g.gain.linearRampToValueAtTime(0.18, now + i * 0.05 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.6);
    osc.connect(g); g.connect(sfxGain!);
    osc.start(now + i * 0.05); osc.stop(now + i * 0.05 + 0.7);
  });
}

export function playStreak(level: number) {
  const c = ensure(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  const base = 330 + level * 60;
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.15);
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(g); g.connect(sfxGain);
  osc.start(now); osc.stop(now + 0.35);
}

export function playUI() {
  const c = ensure(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, now);
  g.gain.setValueAtTime(0.08, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(g); g.connect(sfxGain);
  osc.start(now); osc.stop(now + 0.1);
}

export function playMiss() {
  const c = ensure(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  const f = c.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = 400;
  osc.connect(f); f.connect(g); g.connect(sfxGain);
  osc.start(now); osc.stop(now + 0.4);
}

// Ambient looping music (Kazakh-inspired pentatonic drone)
export function startMusic() {
  const c = ensure(); if (!c || !musicGain) return;
  if (musicNode) return;
  const now = c.currentTime;
  // Drone
  const drone = c.createOscillator();
  drone.type = "sawtooth";
  drone.frequency.value = 110; // A2
  const dg = c.createGain(); dg.gain.value = 0.06;
  const df = c.createBiquadFilter(); df.type = "lowpass"; df.frequency.value = 400;
  drone.connect(df); df.connect(dg); dg.connect(musicGain);
  drone.start(now);

  // Drone fifth
  const drone2 = c.createOscillator();
  drone2.type = "sine";
  drone2.frequency.value = 165; // E3
  const dg2 = c.createGain(); dg2.gain.value = 0.05;
  drone2.connect(dg2); dg2.connect(musicGain);
  drone2.start(now);

  // Melodic pentatonic notes
  const notes = [440, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25];
  let step = 0;
  const interval = setInterval(() => {
    if (!ctx || !musicGain) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = notes[step % notes.length];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 1.3);
    step++;
  }, 850);

  musicNode = {
    stop: () => {
      clearInterval(interval);
      try { drone.stop(); drone2.stop(); } catch {}
      musicNode = null;
    },
  };
}

export function stopMusic() {
  if (musicNode) musicNode.stop();
}

export function resumeAudio() { ensure(); }
