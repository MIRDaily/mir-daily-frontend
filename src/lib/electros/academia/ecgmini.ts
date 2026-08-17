/* ════════════════════════════════════════════════════════════════════════
   Piezas compartidas para las animaciones didácticas de la Academia:
     · PHASES        fases del ciclo cardíaco (impulso ↔ onda del ECG).
     · beatVoltage   voltaje (mV) de un latido "de libro" en función de la
                     fracción del ciclo f ∈ [0,1].
     · beatPath      genera el trazo de un latido para ilustraciones SVG.
     · EcgTracer     dibuja UN latido progresivamente sobre canvas, sincronizado
                     con f, con papel milimetrado y "bolígrafo" en la punta.
═══════════════════════════════════════════════════════════════════════════ */

export type PhaseStruct = 'sa' | 'atria' | 'av' | 'his' | 'vent' | 'repol' | 'none'

export type Phase = {
  id: string
  t0: number
  t1: number
  struct: PhaseStruct
  wave: string
  color: string
  title: string
  text: string
}

/** Cada fase mapea una parte de la mecánica eléctrica con su huella en el ECG. */
export const PHASES: readonly Phase[] = [
  {
    id: 'sa',
    t0: 0.0,
    t1: 0.05,
    struct: 'sa',
    wave: 'P',
    color: '#D4978C',
    title: 'Nodo sinusal',
    text: 'El marcapasos fisiológico dispara el impulso.',
  },
  {
    id: 'atria',
    t0: 0.05,
    t1: 0.13,
    struct: 'atria',
    wave: 'P',
    color: '#D4978C',
    title: 'Despolarización auricular',
    text: 'El impulso recorre las aurículas → onda P.',
  },
  {
    id: 'av',
    t0: 0.13,
    t1: 0.21,
    struct: 'av',
    wave: 'PR',
    color: '#C9A24A',
    title: 'Retraso en el nodo AV',
    text: 'Pausa fisiológica → segmento PR (línea isoeléctrica).',
  },
  {
    id: 'his',
    t0: 0.21,
    t1: 0.24,
    struct: 'his',
    wave: 'QRS',
    color: '#7CA3C9',
    title: 'Haz de His y ramas',
    text: 'El impulso baja rápido por el sistema His-Purkinje.',
  },
  {
    id: 'vent',
    t0: 0.24,
    t1: 0.31,
    struct: 'vent',
    wave: 'QRS',
    color: '#7CA3C9',
    title: 'Despolarización ventricular',
    text: 'Los ventrículos se activan → complejo QRS.',
  },
  {
    id: 'st',
    t0: 0.31,
    t1: 0.44,
    struct: 'vent',
    wave: 'ST',
    color: '#8BA888',
    title: 'Meseta',
    text: 'Ventrículos despolarizados y contraídos → segmento ST.',
  },
  {
    id: 'trep',
    t0: 0.44,
    t1: 0.64,
    struct: 'repol',
    wave: 'T',
    color: '#8BA888',
    title: 'Repolarización ventricular',
    text: 'Los ventrículos se recuperan → onda T.',
  },
  {
    id: 'dias',
    t0: 0.64,
    t1: 1.0,
    struct: 'none',
    wave: '—',
    color: '#A8A4A0',
    title: 'Diástole eléctrica',
    text: 'Reposo: el corazón se llena y espera el próximo impulso.',
  },
]

export function phaseAt(f: number): Phase {
  const x = ((f % 1) + 1) % 1
  return PHASES.find((p) => x >= p.t0 && x < p.t1) || PHASES[PHASES.length - 1]
}

const gauss = (t: number, c: number, a: number, w: number) => a * Math.exp(-0.5 * ((t - c) / w) ** 2)

/** Voltaje (mV) de un latido de referencia (tipo II) según la fracción f. */
export function beatVoltage(f: number): number {
  const x = ((f % 1) + 1) % 1
  let v = 0
  v += gauss(x, 0.09, 0.15, 0.02) // P
  v += gauss(x, 0.25, -0.08, 0.008) // Q
  v += gauss(x, 0.268, 1.2, 0.01) // R
  v += gauss(x, 0.288, -0.25, 0.01) // S
  v += gauss(x, 0.52, 0.3, 0.04) // T
  return v
}

/** Genera el path SVG de un latido dentro de un rectángulo dado. */
export function beatPath(
  x0: number,
  y0: number,
  w: number,
  h: number,
  { fStart = 0, fEnd = 1, samples = 240 } = {},
): { d: string; xOf: (f: number) => number; base: number; scale: number } {
  const base = y0 + h * 0.62
  const scale = h * 0.42
  let d = ''
  for (let i = 0; i <= samples; i++) {
    const f = fStart + (fEnd - fStart) * (i / samples)
    const x = x0 + w * (i / samples)
    const y = base - beatVoltage(f) * scale
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `
  }
  return { d, xOf: (f: number) => x0 + w * ((f - fStart) / (fEnd - fStart)), base, scale }
}

/* ─── Trazador progresivo sobre canvas ─────────────────────────────────── */
export class EcgTracer {
  private grid: HTMLCanvasElement
  private trace: HTMLCanvasElement
  private gctx: CanvasRenderingContext2D
  private tctx: CanvasRenderingContext2D
  private marginX = 0.06 // margen izq/dcha como fracción del ancho
  private W = 0
  private H = 0
  private mm = 0
  pen = true

  constructor(gridCanvas: HTMLCanvasElement, traceCanvas: HTMLCanvasElement) {
    this.grid = gridCanvas
    this.trace = traceCanvas
    this.gctx = gridCanvas.getContext('2d')!
    this.tctx = traceCanvas.getContext('2d')!
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    for (const c of [this.grid, this.trace]) {
      const r = c.getBoundingClientRect()
      c.width = Math.max(1, Math.round(r.width * dpr))
      c.height = Math.max(1, Math.round(r.height * dpr))
      c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const r = this.grid.getBoundingClientRect()
    this.W = r.width
    this.H = r.height
    this.mm = this.H / 26 // ~26 mm de alto visibles
    this.drawGrid()
  }

  private drawGrid() {
    const ctx = this.gctx
    const { W, H, mm } = this
    if (!W || !mm) return
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#FFF7F4'
    ctx.fillRect(0, 0, W, H)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(212,151,140,0.22)'
    ctx.beginPath()
    for (let x = 0; x <= W; x += mm) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
    }
    for (let y = 0; y <= H; y += mm) {
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
    }
    ctx.stroke()
    ctx.lineWidth = 1.3
    ctx.strokeStyle = 'rgba(212,151,140,0.5)'
    ctx.beginPath()
    for (let x = 0; x <= W; x += mm * 5) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
    }
    for (let y = 0; y <= H; y += mm * 5) {
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
    }
    ctx.stroke()
  }

  private x(f: number) {
    const m = this.W * this.marginX
    return m + (this.W - 2 * m) * f
  }

  private y(mv: number) {
    return this.H * 0.6 - mv * (this.mm * 10)
  }

  /** Dibuja el latido desde 0 hasta f. */
  render(f: number) {
    if (!this.W) return
    const ctx = this.tctx
    ctx.clearRect(0, 0, this.W, this.H)
    ctx.lineWidth = 2.4
    ctx.strokeStyle = '#241c1a'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const steps = Math.max(2, Math.floor(240 * f))
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const ff = f * (i / steps)
      const x = this.x(ff)
      const y = this.y(beatVoltage(ff))
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.stroke()
    if (this.pen && f > 0 && f < 1) {
      const x = this.x(f)
      const y = this.y(beatVoltage(f))
      ctx.beginPath()
      ctx.fillStyle = '#B87A6F'
      ctx.arc(x, y, 3.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(184,122,111,0.35)'
      ctx.lineWidth = 1.2
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.H)
      ctx.stroke()
    }
  }

  clear() {
    if (this.W) this.tctx.clearRect(0, 0, this.W, this.H)
  }
}
