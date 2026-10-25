import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(root, "assets", "audio");
const SR = 32000;
const DURATION = 48;
const N = SR * DURATION;

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function addTone(buf, start, duration, freq, amp, options = {}) {
  const offset = Math.round(start * SR);
  if (offset >= N) return;
  const length = Math.max(1, Math.round(duration * SR));
  const attack = Math.max(0.004, options.attack ?? 0.02);
  const release = Math.max(0.01, options.release ?? 0.3);
  const decay = options.decay ?? 0;
  const type = options.type ?? "sine";
  const vibrato = options.vibrato ?? 0;
  const vibratoRate = options.vibratoRate ?? 0.12;
  const detune = options.detune ?? 0;
  const phase0 = options.phase ?? 0;
  const base = freq * Math.pow(2, detune / 1200);
  const end = Math.min(N, offset + length);
  const a = Math.min(attack, duration * 0.45);
  const r = Math.min(release, duration * 0.45);

  for (let i = 0; i < end - offset; i += 1) {
    const t = i / SR;
    let env;
    if (decay > 0) {
      env = Math.min(1, t / attack) * Math.exp(-t / decay);
    } else if (t < a) {
      env = t / a;
    } else if (t > duration - r) {
      env = Math.max(0, (duration - t) / r);
    } else {
      env = 1;
    }

    let phase = 2 * Math.PI * base * t + phase0;
    if (vibrato) phase += vibrato * Math.sin(2 * Math.PI * vibratoRate * t);

    let value;
    if (type === "triangle") value = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (type === "saw") value = 2 * ((base * t + phase0 / (2 * Math.PI)) % 1) - 1;
    else if (type === "bell") value = Math.sin(phase) + 0.45 * Math.sin(2.01 * phase) + 0.22 * Math.sin(3.97 * phase);
    else if (type === "glass") value = Math.sin(phase) + 0.3 * Math.sin(2.7 * phase) + 0.16 * Math.sin(5.1 * phase);
    else value = Math.sin(phase);

    buf[offset + i] += value * env * amp;
  }
}

function addKick(buf, start, amp) {
  const offset = Math.round(start * SR);
  const length = Math.round(0.38 * SR);
  for (let i = 0; i < length && offset + i < N; i += 1) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * Math.exp(-t / 0.12);
    const phase = 2 * Math.PI * (46 * t + 22 * 0.05 * (1 - Math.exp(-t / 0.05)));
    buf[offset + i] += Math.sin(phase) * env * amp;
  }
}

function addTick(buf, start, amp) {
  addTone(buf, start, 0.12, 1450, amp, { type: "sine", attack: 0.002, decay: 0.035 });
}

function addBeep(buf, start, freq, amp) {
  addTone(buf, start, 0.16, freq, amp, { type: "sine", attack: 0.006, decay: 0.11 });
  addTone(buf, start + 0.2, 0.12, freq * 1.12, amp * 0.45, { type: "sine", attack: 0.006, decay: 0.08 });
}

function chooseBass(note) {
  let bass = note - 12;
  while (midiToFreq(bass) < 48) bass += 12;
  return bass;
}

function highpass(buf, cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const alpha = rc / (rc + dt);
  let previousInput = 0;
  let previousOutput = 0;
  for (let i = 0; i < N; i += 1) {
    const input = buf[i];
    const output = alpha * (previousOutput + input - previousInput);
    previousInput = input;
    previousOutput = output;
    buf[i] = output;
  }
}

function lowpass(buf, cutoff) {
  const alpha = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
  let output = 0;
  for (let i = 0; i < N; i += 1) {
    output += alpha * (buf[i] - output);
    buf[i] = output;
  }
}

function addSpace(buf, amount) {
  const taps = [
    [0.19, 0.28],
    [0.31, 0.21],
    [0.47, 0.15],
    [0.71, 0.1],
    [0.97, 0.07]
  ];
  const wet = new Float32Array(N);
  for (const [delay, gain] of taps) {
    const offset = Math.round(delay * SR);
    for (let i = offset; i < N; i += 1) wet[i] += buf[i - offset] * gain;
  }
  lowpass(wet, 3400);
  for (let i = 0; i < N; i += 1) buf[i] += wet[i] * amount;
}

function normalize(buf, peak) {
  let max = 0;
  for (let i = 0; i < N; i += 1) max = Math.max(max, Math.abs(buf[i]));
  if (max < 1e-6) return 0;
  const scale = peak / max;
  for (let i = 0; i < N; i += 1) buf[i] *= scale;
  return max;
}

function fadeInOut(buf, seconds) {
  const length = Math.round(seconds * SR);
  for (let i = 0; i < length; i += 1) {
    const gain = Math.sin(0.5 * Math.PI * i / length);
    buf[i] *= gain;
    buf[N - 1 - i] *= gain;
  }
  buf[0] = 0;
  buf[N - 1] = 0;
}

const tracks = [
  {
    file: "rain.mp3",
    chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
    motif: [62, 65, 69, 62, 65, 70, 67, 70, 74, 69, 73, 76],
    arpStep: 0.75,
    arpPattern: [0, 1, 2, 1, 2, 0, 1, 2],
    padType: "sine",
    padAmp: 0.055,
    padAttack: 4.5,
    padRelease: 5,
    bassAmp: 0.1,
    bassDur: 3.8,
    pluckAmp: 0.055,
    pluckDecay: 1.1,
    melodyAmp: 0.08,
    melodyType: "sine",
    melodyDecay: 2.4,
    kickAmp: 0.045,
    kickEvery: 4,
    tickAmp: 0.006,
    tickEvery: 2,
    space: 0.42
  },
  {
    file: "paper.mp3",
    chords: [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55]],
    motif: [65, 69, 72, 62, 65, 69, 58, 62, 65, 60, 64, 67],
    arpStep: 0.5,
    arpPattern: [0, 2, 1, 2, 0, 1, 2, 1],
    padType: "triangle",
    padAmp: 0.045,
    padAttack: 3.5,
    padRelease: 4,
    bassAmp: 0.085,
    bassDur: 3.4,
    pluckAmp: 0.048,
    pluckDecay: 0.7,
    melodyAmp: 0.065,
    melodyType: "triangle",
    melodyDecay: 1.8,
    kickAmp: 0.032,
    kickEvery: 6,
    tickAmp: 0.005,
    tickEvery: 3,
    space: 0.34
  },
  {
    file: "industry.mp3",
    chords: [[45, 48, 52], [41, 45, 48], [50, 53, 57], [40, 44, 47]],
    motif: [69, 72, 76, 65, 69, 72, 62, 65, 69, 64, 68, 71],
    arpStep: 1,
    arpPattern: [0, 1, 2, 0, 2, 1],
    padType: "sine",
    padAmp: 0.06,
    padAttack: 5,
    padRelease: 5,
    bassAmp: 0.095,
    bassDur: 4,
    pluckAmp: 0.042,
    pluckDecay: 1.3,
    melodyAmp: 0.06,
    melodyType: "bell",
    melodyDecay: 2.8,
    kickAmp: 0.055,
    kickEvery: 3,
    tickAmp: 0.004,
    tickEvery: 1.5,
    bellAmp: 0.025,
    space: 0.52
  },
  {
    file: "neon.mp3",
    chords: [[48, 51, 55], [44, 48, 51], [51, 55, 58], [46, 50, 53]],
    motif: [72, 75, 79, 68, 72, 75, 75, 79, 82, 74, 77, 81],
    arpStep: 0.5,
    arpPattern: [0, 1, 2, 1, 0, 2, 1, 2],
    padType: "triangle",
    padAmp: 0.04,
    padAttack: 3,
    padRelease: 4,
    bassAmp: 0.08,
    bassDur: 3,
    pluckAmp: 0.045,
    pluckDecay: 0.6,
    melodyAmp: 0.062,
    melodyType: "glass",
    melodyDecay: 2,
    kickAmp: 0.045,
    kickEvery: 2,
    tickAmp: 0.005,
    tickEvery: 1,
    shimmer: true,
    space: 0.38
  },
  {
    file: "signal.mp3",
    chords: [[52, 55, 59], [48, 52, 55], [43, 47, 50], [50, 54, 57]],
    motif: [64, 67, 71, 60, 64, 67, 59, 62, 67, 62, 66, 69],
    arpStep: 0.75,
    arpPattern: [0, 2, 1, 0, 1, 2],
    padType: "sine",
    padAmp: 0.05,
    padAttack: 4,
    padRelease: 4,
    bassAmp: 0.09,
    bassDur: 3.6,
    pluckAmp: 0.04,
    pluckDecay: 0.9,
    melodyAmp: 0.068,
    melodyType: "sine",
    melodyDecay: 2.2,
    kickAmp: 0.038,
    kickEvery: 4,
    tickAmp: 0.004,
    tickEvery: 2,
    beepAmp: 0.016,
    space: 0.48
  }
];

function renderTrack(config) {
  const buf = new Float32Array(N);
  const chordDuration = DURATION / config.chords.length;

  for (let index = 0; index < config.chords.length; index += 1) {
    const start = index * chordDuration;
    const chord = config.chords[index];

    for (const note of chord) {
      addTone(buf, start, chordDuration, midiToFreq(note), config.padAmp, {
        type: config.padType,
        attack: config.padAttack,
        release: config.padRelease,
        vibrato: 0.0015,
        vibratoRate: 0.06 + index * 0.012,
        detune: (note % 3 - 1) * 2
      });
    }

    if (config.shimmer) {
      for (const note of chord) {
        addTone(buf, start, chordDuration, midiToFreq(note + 12), config.padAmp * 0.28, {
          type: "sine",
          attack: 3,
          release: 4,
          vibrato: 0.001
        });
      }
    }

    const bassNote = chooseBass(chord[0]);
    addTone(buf, start, config.bassDur, midiToFreq(bassNote), config.bassAmp, {
      type: "triangle",
      attack: 0.08,
      release: 1.6
    });
    addTone(buf, start + chordDuration / 2, config.bassDur, midiToFreq(bassNote), config.bassAmp * 0.78, {
      type: "triangle",
      attack: 0.08,
      release: 1.6
    });

    const steps = Math.floor(chordDuration / config.arpStep);
    for (let step = 0; step < steps; step += 1) {
      const note = chord[config.arpPattern[step % config.arpPattern.length]] + 12;
      const swing = step % 2 === 1 ? 0.012 : 0;
      const humanTime = ((step * 7) % 5 - 2) * 0.004;
      const humanAmp = 0.86 + ((step * 3) % 5) * 0.035;
      addTone(buf, start + step * config.arpStep + swing + humanTime, Math.min(1.5, config.arpStep * 2.2), midiToFreq(note), config.pluckAmp * humanAmp, {
        type: "triangle",
        attack: 0.008,
        decay: config.pluckDecay
      });
    }

    const times = [1.5, 4.5, 8];
    for (let noteIndex = 0; noteIndex < 3; noteIndex += 1) {
      addTone(buf, start + times[noteIndex], 3.2, midiToFreq(config.motif[index * 3 + noteIndex]), config.melodyAmp, {
        type: config.melodyType,
        attack: 0.04,
        decay: config.melodyDecay
      });
    }

    for (let time = 0; time < chordDuration; time += config.kickEvery) {
      addKick(buf, start + time, config.kickAmp);
    }
    for (let time = config.tickEvery; time < chordDuration; time += config.tickEvery) {
      addTick(buf, start + time, config.tickAmp);
    }

    if (config.bellAmp) {
      addTone(buf, start + chordDuration * 0.55, 3.5, midiToFreq(chord[2] + 12), config.bellAmp, {
        type: "bell",
        attack: 0.02,
        decay: 2.8
      });
    }

    if (config.beepAmp) {
      addBeep(buf, start + 2.2, 880, config.beepAmp);
      addBeep(buf, start + 7.4, 1046, config.beepAmp * 0.8);
    }
  }

  highpass(buf, 32);
  lowpass(buf, 7200);
  addSpace(buf, config.space);
  const rawPeak = normalize(buf, 0.68);
  fadeInOut(buf, 3.2);
  return { buf, rawPeak };
}

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG,
    "ffmpeg",
    "C:\\Users\\Dario\\SVDL_Codecs\\ffmpeg.exe",
    "C:\\VibeGallery\\release\\win-unpacked\\resources\\bin\\win32\\ffmpeg.exe"
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-version"], { stdio: "ignore" });
    if (!result.error && result.status === 0) return candidate;
  }
  return null;
}

function encodeMp3(ffmpeg, samples, file) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const output = path.join(outDir, file);
  const result = spawnSync(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-f", "s16le",
    "-ar", String(SR),
    "-ac", "1",
    "-i", "pipe:0",
    "-codec:a", "libmp3lame",
    "-b:a", "64k",
    output
  ], { input: pcm, maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error("ffmpeg: " + String(result.stderr || "неизвестная ошибка"));
  }
  return output;
}

function main() {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.error("Не найден ffmpeg. Укажите путь в переменной FFMPEG.");
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const config of tracks) {
    const { buf, rawPeak } = renderTrack(config);
    const output = encodeMp3(ffmpeg, buf, config.file);
    const size = fs.statSync(output).size;
    console.log(config.file, (size / 1024).toFixed(0) + " КБ", "пик до нормализации " + rawPeak.toFixed(2));
  }
}

main();
