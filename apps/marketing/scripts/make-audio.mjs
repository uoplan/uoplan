// Synthesizes an ORIGINAL soundtrack (music bed + SFX) to public/master.wav.
// No copyrighted audio — everything here is generated from oscillators/noise.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { DURATION_S, SFX, MUSIC } from "../src/timeline.mjs";

const SR = 44100;
const N = Math.ceil(SR * DURATION_S);
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TAU = Math.PI * 2;

function add(ch, i, v) {
  if (i < 0 || i >= N) return;
  if (ch === 0 || ch === 2) L[i] += v;
  if (ch === 1 || ch === 2) R[i] += v;
}

// sidechain "pump" envelope driven by the kick
const sc = new Float32Array(N).fill(1);

/* ---------------- KICK (four-on-the-floor) ---------------- */
for (let bt = MUSIC.kickIn; bt < MUSIC.kickOut; bt += 60 / MUSIC.bpm) {
  const s0 = Math.floor(bt * SR);
  for (let n = 0; n < SR * 0.4; n++) {
    const tt = n / SR;
    const f = 45 + 70 * Math.exp(-tt / 0.03);
    const env = Math.exp(-tt / 0.11);
    const v = Math.sin(TAU * f * tt) * env * 0.55;
    add(2, s0 + n, v);
  }
  // sidechain dip
  for (let n = 0; n < SR * 0.32; n++) {
    const tt = n / SR;
    const g = 0.32 + 0.68 * (1 - Math.exp(-tt / 0.16));
    const idx = s0 + n;
    if (idx >= 0 && idx < N) sc[idx] = Math.min(sc[idx], g);
  }
}

/* ---------------- PAD (sustained chord, additive) ---------------- */
const chord = [45, 52, 57, 60, 64, 67]; // A minor-ish
{
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const atk = clamp(t / 2.0, 0, 1);
    const rel = 1 - clamp((t - (MUSIC.outroChord - 0.5)) / 1.2, 0, 1);
    const trem = 1 + 0.12 * Math.sin(TAU * 0.13 * t);
    let s = 0;
    for (const m of chord) {
      const f = midi(m);
      s += Math.sin(TAU * f * t);
      s += 0.32 * Math.sin(TAU * 2 * f * t);
      s += 0.14 * Math.sin(TAU * 3 * f * t);
    }
    s = (s / chord.length) * 0.05 * atk * rel * trem * sc[i];
    // one-pole lowpass, opening up slowly
    const cut = 1200 + 700 * clamp(t / 10, 0, 1);
    const a = clamp((TAU * cut) / SR, 0, 1);
    lp += a * (s - lp);
    add(0, i, lp * 0.95);
    add(1, i, lp * 1.05);
  }
}

/* ---------------- BASS drone (root, pumped) ---------------- */
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const gate = clamp((t - MUSIC.kickIn) / 0.5, 0, 1) * (1 - clamp((t - MUSIC.kickOut) / 0.6, 0, 1));
  if (gate <= 0) continue;
  const v =
    (Math.sin(TAU * midi(33) * t) * 0.13 + Math.sin(TAU * midi(45) * t) * 0.05) * gate * sc[i];
  add(2, i, v);
}

/* ---------------- ARP pluck (movement) ---------------- */
{
  const pat = [69, 72, 76, 72, 74, 72, 76, 79];
  let k = 0;
  for (let at = 3.0; at < 20.2; at += 0.25, k++) {
    const m = pat[k % pat.length];
    const f = midi(m);
    const s0 = Math.floor(at * SR);
    for (let n = 0; n < SR * 0.22; n++) {
      const tt = n / SR;
      const env = Math.exp(-tt / 0.09) * Math.min(1, tt / 0.005);
      const tri =
        Math.sin(TAU * f * tt) +
        0.11 * Math.sin(TAU * 3 * f * tt) +
        0.04 * Math.sin(TAU * 5 * f * tt);
      const v = tri * env * 0.045;
      add(0, s0 + n, v); // main left
      add(1, s0 + n + Math.floor(0.25 * SR), v * 0.4); // echo right
      add(0, s0 + n + Math.floor(0.5 * SR), v * 0.16); // echo feedback
    }
  }
}

/* ---------------- RISER into the impact ---------------- */
{
  const s0 = Math.floor(MUSIC.riser * SR);
  const len = Math.floor((MUSIC.outroChord - MUSIC.riser) * SR);
  let hp = 0,
    prev = 0;
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const p = tt / (len / SR);
    const env = p * p;
    // rising noise
    const noise = Math.random() * 2 - 1;
    const cut = 400 + 4000 * p;
    const a = clamp((TAU * cut) / SR, 0, 1);
    const lp = prev + a * (noise - prev);
    prev = lp;
    hp = noise - lp; // highpass-ish
    // sine sweep
    const f = 220 + 1400 * p;
    ph += (TAU * f) / SR;
    const v = (hp * 0.6 + Math.sin(ph) * 0.4) * env * 0.16;
    add(2, s0 + n, v);
  }
}

/* ---------------- OUTRO chord (resolve, with echo tail) ---------------- */
{
  const s0 = Math.floor(MUSIC.outroChord * SR);
  const notes = [57, 64, 69, 73]; // A major lift
  const taps = [0.0, 0.09, 0.17, 0.27];
  const tapG = [1, 0.5, 0.3, 0.18];
  for (let n = 0; n < (DURATION_S - MUSIC.outroChord) * SR; n++) {
    const tt = n / SR;
    const env =
      Math.min(1, tt / 0.18) *
      Math.exp(-tt / 2.2) *
      (1 - clamp((tt - (DURATION_S - MUSIC.outroChord - 1.4)) / 1.4, 0, 1));
    let s = 0;
    for (const m of notes) {
      const f = midi(m);
      s += Math.sin(TAU * f * tt) + 0.25 * Math.sin(TAU * 2 * f * tt);
    }
    s = (s / notes.length) * 0.07 * env;
    for (let k = 0; k < taps.length; k++) {
      const idx = s0 + n + Math.floor(taps[k] * SR);
      add(0, idx, s * tapG[k] * (k % 2 ? 0.8 : 1));
      add(1, idx, s * tapG[k] * (k % 2 ? 1 : 0.8));
    }
  }
}

/* ---------------- SFX: soft airy swishes (phone reveals) ---------------- */
for (const at of SFX.whoosh) {
  const s0 = Math.floor(at * SR);
  const dur = 0.6;
  let lp = 0;
  for (let n = 0; n < SR * dur; n++) {
    const tt = n / SR;
    const p = tt / dur;
    const env = Math.sin(Math.PI * clamp(p, 0, 1)) ** 2.2; // gentle hump
    const noise = Math.random() * 2 - 1;
    const cut = 220 + 1600 * Math.sin(Math.PI * p); // airy, well below the harsh band
    const a = clamp((TAU * cut) / SR, 0, 1);
    lp += a * (noise - lp);
    const v = lp * env * 0.13; // soft
    const panL = 1 - p,
      panR = p; // subtle L -> R drift
    add(0, s0 + n, v * panL);
    add(1, s0 + n, v * panR);
  }
}

/* ---------------- SFX: caption / flip ticks (quiet, muted — NOT a ding) ---------------- */
for (const at of SFX.tick) {
  const s0 = Math.floor(at * SR);
  // A soft woody tick: a tiny low-passed noise click + a short muted ~180 Hz body,
  // both decaying fast. Deliberately dull and low-level so word flips feel tactile
  // rather than chiming (the old 760 Hz blip was a bright, too-loud ding).
  let lp = 0;
  for (let n = 0; n < SR * 0.05; n++) {
    const tt = n / SR;
    const noise = Math.random() * 2 - 1;
    lp += 0.35 * (noise - lp); // low-pass the click so there's no bright top end
    const click = lp * Math.exp(-tt / 0.006) * 0.05;
    const body = Math.sin(TAU * 180 * tt) * Math.exp(-tt / 0.02) * 0.06;
    add(2, s0 + n, click + body);
  }
}

/* ---------------- SFX: final impact ---------------- */
for (const at of SFX.impact) {
  const s0 = Math.floor(at * SR);
  const taps = [0, 0.11, 0.2, 0.31];
  const tapG = [1, 0.45, 0.28, 0.16];
  for (let n = 0; n < SR * 1.4; n++) {
    const tt = n / SR;
    const f = 80 * Math.exp(-tt / 0.25) + 38;
    const boom = Math.sin(TAU * f * tt) * Math.exp(-tt / 0.5) * 0.6;
    const hit = tt < 0.15 ? (Math.random() * 2 - 1) * Math.exp(-tt / 0.05) * 0.3 : 0;
    const v = boom + hit;
    for (let k = 0; k < taps.length; k++) {
      add(2, s0 + n + Math.floor(taps[k] * SR), v * tapG[k]);
    }
  }
}

/* ---------------- master limiter + normalize ---------------- */
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 0.9);
  R[i] = Math.tanh(R[i] * 0.9);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = peak > 0 ? 0.95 / peak : 1;
// global fade in/out
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = clamp(t / 0.3, 0, 1) * (1 - clamp((t - (DURATION_S - 0.6)) / 0.6, 0, 1));
  L[i] *= g * fade;
  R[i] *= g * fade;
}

/* ---------------- write 16-bit stereo WAV ---------------- */
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
let o = 44;
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), o);
  buf.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), o + 2);
  o += 4;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "public", "master.wav");
fs.writeFileSync(out, buf);
console.log(`Wrote ${out} (${DURATION_S}s, ${(buf.length / 1e6).toFixed(1)} MB)`);
