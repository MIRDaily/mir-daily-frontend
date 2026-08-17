/* ════════════════════════════════════════════════════════════════════════
   Motor de síntesis del ECG. Dos etapas:
     1) generador de RITMO  → cuándo ocurre cada latido / onda P / actividad
        auricular (línea temporal, independiente de la derivación).
     2) estampado de MORFOLOGÍA por derivación → 12 buffers de voltaje (mV),
        usando la tabla de derivaciones de leads.ts.
   Resultado: { leads:{I:Float32Array,…}, beats:[tR…], fs, dur, hr }.
═══════════════════════════════════════════════════════════════════════════ */
import { applyMods, baseLeads, LEAD_ORDER, type LeadName, type LeadTable, type Wave } from './leads'

export const FS = 500 // Hz
export const DUR = 10 // s (tira de ritmo estándar)
const N = FS * DUR

/** Parámetros morfológicos declarados por cada patrón. */
export type Morph = {
  /** Factor de anchura del QRS (1 ≈ 90 ms) */
  qrsWidth?: number
  /** Anchura de la onda T */
  tWidth?: number
  /** Escala de posición/QT de la T */
  qtScale?: number
  pWidth?: number
  /** P mitrale (bífida) */
  pNotch?: number
  /** P pulmonale (picuda) */
  pPeak?: number
  /** Intervalo PR en segundos */
  pr?: number
  qrsMag?: number
  qrsAxis?: number
  pMag?: number
  pAxis?: number
  tMag?: number
  tAxis?: number
  mods?: readonly string[]
}

export type RhythmName =
  | 'regular'
  | 'noP'
  | 'afib'
  | 'aflutter'
  | 'wenckebach'
  | 'mobitz2'
  | 'avblock3'
  | 'bigeminy'
  | 'torsades'
  | 'vfib'
  | 'asystole'

export type EcgPattern = {
  id: string
  hr: number
  gen?: RhythmName
  morph?: Morph
  rhythm?: Record<string, number>
}

export type Synth = {
  leads: Record<LeadName, Float32Array>
  /** Tiempos (s) de cada R, para sincronizar el latido del monitor */
  beats: number[]
  fs: number
  dur: number
  hr: number
}

type Timing = {
  qrsWidth: number
  tWidth: number
  qtScale: number
  pWidth: number
  pNotch: number
  pPeak: number
}

type Beat = { t: number; kind: 'sinus' | 'pvc' | 'escape' | 'torsade'; noP?: boolean }

type Rhythm = {
  beats: Beat[]
  pWaves: number[]
  baseline?: (buf: Float32Array, name: LeadName) => void
  polymorphic?: boolean
  chaos?: 'vfib' | 'asystole'
}

/* ─── Formas de onda base ───────────────────────────────────────────── */
const gauss = (t: number, c: number, amp: number, w: number) => amp * Math.exp(-0.5 * ((t - c) / w) ** 2)
// Meseta plana (súper-gaussiana) para segmentos ST / PR.
const plateau = (t: number, c: number, amp: number, w: number) => amp * Math.exp(-(((t - c) / w) ** 4))

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

/* ─── Estampado de un latido en UNA derivación ──────────────────────────
   w  : onda de la derivación (de leads.ts)
   tm : timing { qrsWidth, tWidth, qtScale, … }
*/
function stampBeat(buf: Float32Array, tR: number, w: Wave, tm: Timing) {
  const qw = tm.qrsWidth
  const qt = tm.qtScale
  const tw = tm.tWidth
  const i0 = Math.max(0, Math.floor((tR - 0.12 * qw) * FS))
  const i1 = Math.min(N, Math.ceil((tR + 0.52 * qt) * FS))
  const tPeak = (0.3 + 0.03 * qw) * qt // posición de la T
  for (let i = i0; i < i1; i++) {
    const tau = i / FS - tR
    let y = 0
    // Onda delta (preexcitación): empastamiento previo a la R
    if (w.delta) y += gauss(tau, -0.05 * qw, w.delta, 0.03 * qw)
    // Segmento PR (desnivel, p. ej. pericarditis)
    if (w.prDep) y += plateau(tau, -0.07, w.prDep, 0.035)
    // Q — R — S
    y += gauss(tau, -0.024 * qw, w.q, 0.011 * qw)
    y += gauss(tau, 0, w.r, 0.013 * qw)
    if (w.notch) y += gauss(tau, 0.016 * qw, -Math.abs(w.r) * 0.28, 0.01 * qw)
    y += gauss(tau, 0.03 * qw, w.s, 0.015 * qw)
    // R' (orejas de conejo del BRD)
    if (w.rp) y += gauss(tau, 0.06 * qw, w.rp, 0.017 * qw)
    // Segmento ST (nivel del punto J)
    if (w.j) y += plateau(tau, 0.115 + 0.02 * qw, w.j, 0.05)
    // Onda T (asimétrica normal; simétrica si w.tSym)
    const twR = 0.06 * tw
    const twL = w.tSym ? twR : twR * 1.5
    y += tau < tPeak ? gauss(tau, tPeak, w.t, twL) : gauss(tau, tPeak, w.t, twR)
    // Onda U
    if (w.u) y += gauss(tau, tPeak + 0.16 * qt, w.u, 0.05)
    buf[i] += y
  }
}

/** Estampado de una onda P (auricular). */
function stampP(buf: Float32Array, tP: number, w: Wave, tm: Timing) {
  if (!w.p) return
  const pw = 0.022 * (tm.pWidth || 1)
  const i0 = Math.max(0, Math.floor((tP - 4 * pw) * FS))
  const i1 = Math.min(N, Math.ceil((tP + 4 * pw) * FS))
  for (let i = i0; i < i1; i++) {
    const t = i / FS
    if (tm.pNotch) {
      // P mitrale: dos jorobas
      buf[i] += gauss(t, tP - 0.02, w.p * 0.9, pw * 0.7) + gauss(t, tP + 0.022, w.p, pw * 0.7)
    } else if (tm.pPeak) {
      // P pulmonale: alta y picuda
      buf[i] += gauss(t, tP, w.p, pw * 0.75)
    } else {
      buf[i] += gauss(t, tP, w.p, pw)
    }
  }
}

/* ─── Actividad auricular continua por derivación ───────────────────────
   Pesos de visibilidad (flutter/fibrilación se ven mejor en II/III/aVF/V1).
*/
const ATRIAL_WEIGHT: Record<LeadName, number> = {
  I: 0.3,
  II: 1.0,
  III: 0.9,
  aVR: -0.6,
  aVL: -0.2,
  aVF: 0.9,
  V1: 0.8,
  V2: 0.4,
  V3: 0.2,
  V4: 0.15,
  V5: 0.1,
  V6: 0.1,
}

function flutterBaseline(buf: Float32Array, name: LeadName) {
  const wgt = ATRIAL_WEIGHT[name] ?? 0.3
  const period = 1 / 5 // 300/min = 5 Hz
  for (let i = 0; i < N; i++) {
    const ph = ((i / FS) % period) / period // diente de sierra 0..1
    buf[i] += (-0.16 * ph + 0.08) * wgt
  }
}

function fibBaseline(buf: Float32Array, name: LeadName, rand: () => number) {
  const wgt = ATRIAL_WEIGHT[name] ?? 0.3
  const comps: { f: number; ph: number; a: number }[] = []
  for (let k = 0; k < 6; k++) comps.push({ f: 5 + rand() * 5, ph: rand() * 6.28, a: 0.5 + rand() })
  for (let i = 0; i < N; i++) {
    const t = i / FS
    let y = 0
    for (const c of comps) y += c.a * Math.sin(2 * Math.PI * c.f * t + c.ph)
    buf[i] += (y / comps.length) * 0.06 * wgt
  }
}

/* ════════════════════════════════════════════════════════════════════
   GENERADORES DE RITMO
   Devuelven { beats:[{t, kind}], pWaves:[tP], baseline?:fn }
═══════════════════════════════════════════════════════════════════════ */
type GenArgs = { hr: number; pr: number; pp?: number; start?: number }

const RITMOS: Record<RhythmName, (a: GenArgs) => Rhythm> = {
  regular({ hr, pr }) {
    const rr = 60 / hr
    const beats: Beat[] = []
    const pWaves: number[] = []
    for (let t = 0.55; t < DUR; t += rr) {
      beats.push({ t, kind: 'sinus' })
      pWaves.push(t - pr)
    }
    return { beats, pWaves }
  },
  // Sin ondas P visibles (taquicardias de QRS estrecho: TPSV) o anchas (TV)
  noP({ hr, start = 0.45 }) {
    const rr = 60 / hr
    const beats: Beat[] = []
    for (let t = start; t < DUR; t += rr) beats.push({ t, kind: 'sinus' })
    return { beats, pWaves: [] }
  },
  afib({ hr }) {
    const rand = rng(7)
    const beats: Beat[] = []
    const mean = 60 / hr
    let t = 0.5
    while (t < DUR) {
      beats.push({ t, kind: 'sinus' })
      t += mean * (0.5 + rand() * 1.0)
    }
    return { beats, pWaves: [], baseline: (buf, n) => fibBaseline(buf, n, rng(7)) }
  },
  aflutter({ hr }) {
    const rr = 60 / hr
    const beats: Beat[] = []
    for (let t = 0.6; t < DUR; t += rr) beats.push({ t, kind: 'sinus' })
    return { beats, pWaves: [], baseline: flutterBaseline }
  },
  wenckebach({ pp = 0.82 }) {
    const beats: Beat[] = []
    const pWaves: number[] = []
    for (let t = 0.5, n = 0; t < DUR; t += pp, n++) {
      pWaves.push(t)
      if (n % 4 === 3) continue // 4ª P bloqueada
      beats.push({ t: t + 0.16 + (n % 4) * 0.07, kind: 'sinus', noP: true })
    }
    return { beats, pWaves }
  },
  mobitz2({ pp = 0.8, pr = 0.18 }) {
    const beats: Beat[] = []
    const pWaves: number[] = []
    for (let t = 0.5, n = 0; t < DUR; t += pp, n++) {
      pWaves.push(t)
      if (n % 3 === 2) continue // QRS caído sin previo aviso
      beats.push({ t: t + pr, kind: 'sinus', noP: true })
    }
    return { beats, pWaves }
  },
  avblock3({ hr }) {
    // Disociación AV: aurículas ~92/min, escape ventricular lento e independiente
    const pWaves: number[] = []
    const beats: Beat[] = []
    for (let t = 0.4; t < DUR; t += 60 / 92) pWaves.push(t)
    for (let t = 0.7; t < DUR; t += 60 / hr) beats.push({ t, kind: 'escape', noP: true })
    return { beats, pWaves }
  },
  bigeminy({ hr }) {
    const rr = 60 / hr
    const beats: Beat[] = []
    const pWaves: number[] = []
    let t = 0.55
    let i = 0
    while (t < DUR) {
      if (i % 2 === 0) {
        pWaves.push(t - 0.16)
        beats.push({ t, kind: 'sinus' })
        t += rr * 0.6
      } else {
        beats.push({ t, kind: 'pvc' })
        t += rr * 1.4
      }
      i++
    }
    return { beats, pWaves }
  },
  torsades({ hr }) {
    const rr = 60 / hr
    const beats: Beat[] = []
    for (let t = 0.4; t < DUR; t += rr) beats.push({ t, kind: 'torsade' })
    return { beats, pWaves: [], polymorphic: true }
  },
  vfib() {
    return { beats: [], pWaves: [], chaos: 'vfib' }
  },
  asystole() {
    return { beats: [], pWaves: [], chaos: 'asystole' }
  },
}

/* ─── PVC: complejo ventricular ancho y bizarro por derivación ───────── */
function pvcLeads(): LeadTable {
  const L = {} as LeadTable
  for (const n of LEAD_ORDER) {
    L[n] = { p: 0, q: 0, r: 0, s: 0, rp: 0, t: 0, j: 0, u: 0, prDep: 0, delta: 0, notch: 0, tSym: 0 }
  }
  // Morfología tipo BRI (foco VD): dominante negativo dcha, positivo izq, T opuesta
  const neg: LeadName[] = ['V1', 'V2', 'V3', 'III', 'aVF', 'aVR']
  const pos: LeadName[] = ['I', 'aVL', 'V5', 'V6', 'II', 'V4']
  neg.forEach((n) => {
    L[n].s = -1.5
    L[n].r = 0.15
    L[n].t = 0.5
  })
  pos.forEach((n) => {
    L[n].r = 1.5
    L[n].s = -0.1
    L[n].t = -0.6
  })
  return L
}

/* ════════════════════════════════════════════════════════════════════
   SÍNTESIS DE LAS 12 DERIVACIONES
═══════════════════════════════════════════════════════════════════════ */
export function synthesize(pattern: EcgPattern): Synth {
  const m = pattern.morph || {}
  const tm: Timing = {
    qrsWidth: m.qrsWidth ?? 1,
    tWidth: m.tWidth ?? 1,
    qtScale: m.qtScale ?? 1,
    pWidth: m.pWidth ?? 1,
    pNotch: m.pNotch ?? 0,
    pPeak: m.pPeak ?? 0,
  }
  const pr = m.pr ?? 0.16

  // Tabla de derivaciones (morfología) tras aplicar el eje y las mods.
  const L = baseLeads({
    qrsMag: m.qrsMag ?? 1.2,
    qrsAxis: m.qrsAxis ?? 60,
    pMag: m.pMag ?? 0.15,
    pAxis: m.pAxis ?? 55,
    tMag: m.tMag ?? 0.35,
    tAxis: m.tAxis ?? 45,
  })
  applyMods(L, m.mods || [])

  // Ritmo
  const gen = RITMOS[pattern.gen || 'regular'] || RITMOS.regular
  const rhythm = gen({ hr: pattern.hr, pr, ...(pattern.rhythm || {}) })

  // Buffers por derivación
  const leads = {} as Record<LeadName, Float32Array>
  const noise = rng(42)
  for (const name of LEAD_ORDER) {
    const buf = new Float32Array(N)
    // ruido muscular + deriva de la línea de base (realismo)
    for (let i = 0; i < N; i++) {
      buf[i] += (noise() - 0.5) * 0.01
      buf[i] += Math.sin(2 * Math.PI * 0.22 * (i / FS) + name.length) * 0.01
    }
    leads[name] = buf
  }

  // Caos (FV / asistolia): se genera directamente y se retorna
  if (rhythm.chaos === 'vfib') {
    for (const name of LEAD_ORDER) {
      const r = rng(11 + name.length)
      const comps: { f: number; ph: number; a: number }[] = []
      for (let k = 0; k < 7; k++) comps.push({ f: 3 + r() * 5, ph: r() * 6.28, a: 0.18 + r() * 0.3 })
      const buf = leads[name]
      for (let i = 0; i < N; i++) {
        const t = i / FS
        let y = 0
        for (const c of comps) y += c.a * Math.sin(2 * Math.PI * c.f * t + c.ph + Math.sin(t * 1.7) * 1.5)
        buf[i] = y
      }
    }
    return { leads, beats: [], fs: FS, dur: DUR, hr: pattern.hr }
  }
  if (rhythm.chaos === 'asystole') {
    for (const name of LEAD_ORDER) {
      const r = rng(5 + name.length)
      const buf = leads[name]
      for (let i = 0; i < N; i++) buf[i] = (r() - 0.5) * 0.02
    }
    return { leads, beats: [], fs: FS, dur: DUR, hr: pattern.hr }
  }

  // Actividad auricular continua (flutter/fib)
  if (rhythm.baseline) for (const name of LEAD_ORDER) rhythm.baseline(leads[name], name)

  // Ondas P
  for (const name of LEAD_ORDER) for (const tP of rhythm.pWaves) stampP(leads[name], tP, L[name], tm)

  // Latidos
  const pvcL = pvcLeads()
  for (const b of rhythm.beats) {
    for (const name of LEAD_ORDER) {
      let w: Wave = L[name]
      let bt = tm
      if (b.kind === 'pvc') w = pvcL[name]
      if (rhythm.polymorphic) {
        // Torsade: amplitud/eje modulados en huso alrededor de la línea base
        const env = Math.sin(2 * Math.PI * 0.3 * b.t)
        const sign = Math.sign(env) || 1
        const amp = (0.4 + Math.abs(env) * 1.3) * sign
        w = { ...L[name], q: 0, r: amp, s: -amp * 0.5, rp: 0, t: 0, j: 0, u: 0, delta: 0, notch: 0 }
        bt = { ...tm, qrsWidth: 2.0 }
      }
      stampBeat(leads[name], b.t, w, bt)
    }
  }

  // Latidos para el monitor (tiempos de R)
  return { leads, beats: rhythm.beats.map((b) => b.t), fs: FS, dur: DUR, hr: pattern.hr }
}
