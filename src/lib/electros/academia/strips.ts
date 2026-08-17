/* ════════════════════════════════════════════════════════════════════════
   Tiras de ritmo ESQUEMÁTICAS de una derivación, para ilustrar cada
   diagnóstico al final de un algoritmo. No pretenden ser señales realistas
   (para eso está el explorador de 12 derivaciones): buscan que el patrón se
   reconozca de un vistazo en pantalla pequeña.

   Devuelve solo la geometría (`d` del path); el SVG lo pinta React.
═══════════════════════════════════════════════════════════════════════════ */

export type StripKind =
  | 'sinus'
  | 'sinus_tachy'
  | 'sinus_brady'
  | 'atrial'
  | 'flutter'
  | 'svt'
  | 'af'
  | 'af_wide'
  | 'vt'
  | 'torsades'
  | 'vfib'
  | 'av1'
  | 'wpw'
  | 'mobitz1'
  | 'mobitz2'
  | 'av3'

type Morph = {
  p: number
  r: number
  s: number
  t: number
  qrsW: number
  qt: number
  pr: number
  q?: number
  st?: number
  delta?: number
}

type StripBeat = { t: number; m: Morph }

const gauss = (t: number, c: number, a: number, w: number) => a * Math.exp(-0.5 * ((t - c) / w) ** 2)

/** Voltaje aportado por un latido cuyo pico R está en tR. */
function beatY(tt: number, tR: number, m: Morph): number {
  const tau = tt - tR
  const w = m.qrsW || 1
  let y = 0
  if (m.p) y += gauss(tau, -(m.pr || 0.16), m.p, 0.022)
  if (m.delta) y += gauss(tau, -0.05 * w, m.delta, 0.03)
  y += gauss(tau, -0.022 * w, m.q || 0, 0.01 * w)
  y += gauss(tau, 0, m.r ?? 1, 0.013 * w)
  y += gauss(tau, 0.03 * w, m.s ?? -0.22, 0.014 * w)
  if (m.st) y += gauss(tau, 0.13, m.st, 0.05)
  y += gauss(tau, 0.32 * (m.qt || 1), m.t ?? 0.3, 0.05)
  return y
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

const DUR = 4.0

/** Descriptores de ritmo: devuelven los latidos y una línea de base opcional. */
function build(kind: StripKind): { beats: StripBeat[]; baseline?: (t: number) => number } {
  const M = (o: Partial<Morph> = {}): Morph => ({
    p: 0.14,
    r: 1.0,
    s: -0.22,
    t: 0.3,
    qrsW: 1,
    qt: 1,
    pr: 0.16,
    ...o,
  })
  const rand = rng(9)
  const beats: StripBeat[] = []
  const regular = (rate: number, m: () => Morph) => {
    const rr = 60 / rate
    for (let t = 0.5; t < DUR; t += rr) beats.push({ t, m: m() })
  }

  switch (kind) {
    case 'sinus':
      regular(72, () => M())
      break
    case 'sinus_tachy':
      regular(130, () => M({ qt: 0.8 }))
      break
    case 'sinus_brady':
      regular(46, () => M({ qt: 1.15 }))
      break
    case 'atrial':
      regular(150, () => M({ p: 0.12, pr: 0.12 }))
      break
    case 'flutter': {
      regular(150, () => M({ p: 0 }))
      return {
        beats,
        baseline: (t) => {
          const ph = (t % (1 / 5)) / (1 / 5)
          return -0.18 * ph + 0.09
        },
      }
    }
    case 'svt':
      regular(185, () => M({ p: 0, qt: 0.7 }))
      break
    case 'af': {
      let t = 0.4
      while (t < DUR) {
        beats.push({ t, m: M({ p: 0 }) })
        t += (60 / 110) * (0.5 + rand() * 1.1)
      }
      return { beats, baseline: (t) => (Math.sin(t * 33) + Math.sin(t * 51 + 1)) * 0.03 }
    }
    case 'af_wide': {
      let t = 0.4
      while (t < DUR) {
        beats.push({ t, m: M({ p: 0, qrsW: 2.0, r: 1.1 + rand() * 0.5, s: -0.5, t: -0.4 }) })
        t += (60 / 170) * (0.45 + rand() * 1.2)
      }
      return { beats }
    }
    case 'vt':
      regular(180, () => M({ p: 0, qrsW: 2.5, r: 1.4, s: -1.0, t: -0.5, q: 0 }))
      break
    case 'torsades': {
      const rr = 60 / 240
      for (let t = 0.4; t < DUR; t += rr) {
        const env = Math.sin(2 * Math.PI * 0.7 * t)
        const a = (0.4 + Math.abs(env) * 1.2) * (Math.sign(env) || 1)
        beats.push({ t, m: M({ p: 0, qrsW: 2.0, r: a, s: -a * 0.5, t: 0, q: 0 }) })
      }
      break
    }
    case 'vfib':
      return {
        beats: [],
        baseline: (t) => {
          let y = 0
          for (let k = 0; k < 5; k++) y += Math.sin(2 * Math.PI * (3 + k) * t + k) * 0.22
          return y / 3
        },
      }
    case 'av1':
      regular(65, () => M({ pr: 0.3 }))
      break
    case 'wpw':
      regular(72, () => M({ delta: 0.3, qrsW: 1.4, pr: 0.1 }))
      break
    case 'mobitz1': {
      const pp = 0.85
      for (let t = 0.5, n = 0; t < DUR; t += pp, n++) {
        // solo la onda P (sin QRS asociado en este trazo)
        beats.push({ t, m: M({ r: 0, s: 0, t: 0, q: 0, p: 0.14, pr: 0 }) })
        if (n % 4 === 3) continue
        beats.push({ t: t + 0.16 + (n % 4) * 0.07, m: M({ p: 0 }) })
      }
      return { beats }
    }
    case 'mobitz2': {
      const pp = 0.8
      for (let t = 0.5, n = 0; t < DUR; t += pp, n++) {
        beats.push({ t, m: M({ r: 0, s: 0, t: 0, q: 0, p: 0.14, pr: 0 }) })
        if (n % 3 === 2) continue
        beats.push({ t: t + 0.18, m: M({ p: 0 }) })
      }
      return { beats }
    }
    case 'av3': {
      // P disociadas por un lado, escape ventricular lento por otro
      for (let t = 0.4; t < DUR; t += 60 / 95) beats.push({ t, m: M({ r: 0, s: 0, t: 0, q: 0, p: 0.14, pr: 0 }) })
      for (let t = 0.7; t < DUR; t += 60 / 38) beats.push({ t, m: M({ p: 0, qrsW: 1.8, r: 1.1, s: -0.4 }) })
      return { beats }
    }
    default:
      regular(72, () => M())
  }
  return { beats }
}

export type Strip = { d: string; w: number; h: number; mm: number }

/** Geometría de una tira de ritmo esquemática. */
export function stripGeometry(kind: StripKind, { w = 320, h = 104 } = {}): Strip {
  const { beats, baseline } = build(kind)
  const mm = h / 22
  const base = h * 0.58
  const mvPx = mm * 9
  const pxPerSec = (w - 4) / DUR
  const x = (t: number) => 2 + t * pxPerSec
  const N = Math.ceil(w)
  let d = ''
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * DUR
    let v = baseline ? baseline(t) : 0
    // solo los latidos cercanos aportan voltaje apreciable
    for (const b of beats) if (Math.abs(t - b.t) < 0.6) v += beatY(t, b.t, b.m)
    d += `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${(base - v * mvPx).toFixed(1)} `
  }
  return { d, w, h, mm }
}
