import { useEffect, useRef } from 'react'
import type { BgStyle } from '@/components/mapas/proto/types/store.types'

interface Props {
  isDark:  boolean
  bgStyle: BgStyle
}

// Puntos finos y densos: el prototipo usaba GAP 26 / radio 1.6–4.2, que se sentía tosco.
const GAP         = 16
const DOT_BASE_R  = 0.8
const DOT_MAX_R   = 2.2
// Con más puntos, repintar a la tasa de la pantalla (120–144 Hz) sale caro sin que se aprecie:
// el fondo se repinta como mucho a ~60 fotogramas por segundo.
const MIN_FRAME_MS = 15
const GLOW_RADIUS = 155
// Niveles de brillo. Todos los puntos del mismo nivel comparten radio y color y se dibujan
// de una vez (un trazo por nivel, no uno por punto): con ~5.000 puntos, el dibujado punto a
// punto costaba ~10 ms por fotograma y el agrupado ~2 ms. 24 niveles no se distinguen del
// degradado continuo (el radio cambia ~0,06 px entre niveles).
const GLOW_LEVELS = 24

// ─── Wave parameters ─────────────────────────────────────────────────────────
const WAVE_PERIOD   = 22      // seconds between wave starts
const WAVE_TRAVEL   = 10      // seconds for wave to cross the full diagonal
const WAVE_WIDTH    = 520     // half-width of the wave falloff in diagonal-units
const WAVE_STRENGTH = 0.72    // peak influence — high enough to show accent color clearly

/**
 * Organic distortion applied to the wave front at each dot position.
 * Uses 5 superimposed sine waves at different frequencies/phases
 * so the edge is never a clean diagonal — it undulates irregularly.
 */
function waveDistortion(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 0.013 + t * 0.38) * 52 +
    Math.sin(y * 0.019 + t * 0.55) * 38 +
    Math.sin((x + y) * 0.009 + t * 0.22) * 60 +
    Math.sin((x - y) * 0.011 + t * 0.47) * 30 +
    Math.sin(x * 0.031 + y * 0.007 + t * 0.15) * 20
  )
}

export function InteractiveBackground({ isDark, bgStyle }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const mouseRef   = useRef({ x: -9999, y: -9999 })
  const isDarkRef  = useRef(isDark)
  const bgStyleRef = useRef(bgStyle)
  const startRef   = useRef(0)
  // Hay que repintar aunque no haya animación (tema, estilo o tamaño cambiaron).
  const dirtyRef   = useRef(true)

  useEffect(() => { isDarkRef.current  = isDark;  dirtyRef.current = true }, [isDark])
  useEffect(() => { bgStyleRef.current = bgStyle; dirtyRef.current = true }, [bgStyle])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    startRef.current = performance.now()

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = Math.round(canvas.clientWidth  * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      dirtyRef.current = true
    }

    // Bubble-phase listener on document: during RF setPointerCapture() the pointermove event
    // is dispatched to the capturing element (RF canvas/node) and bubbles up to document.
    // window-capture listeners are bypassed during pointer capture, so we listen here instead.
    // This covers normal movement, canvas panning, and node dragging with a single listener.
    const onPointerMove  = (e: PointerEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    const onPointerLeave = () => { mouseRef.current = { x: -9999, y: -9999 } }

    const ctx = canvas.getContext('2d')
    // Índice de nivel de cada punto, reutilizado entre fotogramas (sin reservar memoria en cada uno).
    let levelOf = new Uint8Array(0)
    const levelCount = new Uint32Array(GLOW_LEVELS)
    let lastMouseNear = false

    const draw = () => {
      if (!ctx) return

      const cssW = canvas.clientWidth
      const cssH = canvas.clientHeight
      const dark  = isDarkRef.current
      const style = bgStyleRef.current
      const t     = (performance.now() - startRef.current) * 0.001

      // Mouse pulse
      const pulse          = Math.sin(t * 1.9) * 0.5 + 0.5
      const effectiveRadius = GLOW_RADIUS + pulse * 22
      const intensityBoost  = 1 + pulse * 0.28

      const rect = canvas.getBoundingClientRect()
      const mx   = mouseRef.current.x - rect.left
      const my   = mouseRef.current.y - rect.top

      // ── ¿Hay algo que animar? ────────────────────────────────────────────
      // Si no hay onda, el ratón no está cerca y nada ha cambiado, el fotograma anterior sigue
      // siendo válido: no se repinta (más de la mitad del tiempo, la onda no está activa).
      const cyclePos     = t % WAVE_PERIOD
      const waveActive   = style !== 'flat' && cyclePos < WAVE_TRAVEL
      const mouseNear =
        style !== 'flat' &&
        mx > -effectiveRadius && mx < cssW + effectiveRadius &&
        my > -effectiveRadius && my < cssH + effectiveRadius
      if (!dirtyRef.current && !waveActive && !mouseNear && !lastMouseNear) return
      dirtyRef.current = false
      lastMouseNear = mouseNear

      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = dark ? '#1C1815' : '#FAF7F4'
      ctx.fillRect(0, 0, cssW, cssH)

      if (style === 'flat') return

      // ── Wave state ───────────────────────────────────────────────────────
      const waveProgress = waveActive ? cyclePos / WAVE_TRAVEL : -1
      const diagSpan     = cssW + cssH
      const waveFront    = waveProgress * (diagSpan + WAVE_WIDTH * 2) - WAVE_WIDTH

      // ── 1ª pasada: brillo de cada punto → su nivel ───────────────────────
      const cols  = Math.ceil(cssW / GAP) + 1
      const rows  = Math.ceil(cssH / GAP) + 1
      const total = cols * rows
      if (levelOf.length !== total) levelOf = new Uint8Array(total)
      levelCount.fill(0)
      const effR2 = effectiveRadius * effectiveRadius

      let k = 0
      for (let i = 0; i < cols; i++) {
        const x = i * GAP
        for (let j = 0; j < rows; j++, k++) {
          const y = j * GAP

          // Mouse glow (fuera del radio no hay brillo: se evita la raíz cuadrada)
          const dx = x - mx
          const dy = y - my
          const d2 = dx * dx + dy * dy
          let mouseGlow = 0
          if (d2 < effR2) {
            const raw = 1 - Math.sqrt(d2) / effectiveRadius
            mouseGlow = Math.min(1, raw * raw * (3 - 2 * raw) * intensityBoost)
          }

          // Wave glow — uses organic distortion to make the front irregular
          let waveGlow = 0
          if (waveActive) {
            const dotDiag     = x + y + waveDistortion(x, y, t)
            const distToFront = dotDiag - waveFront
            // Asymmetric falloff: sharp leading edge, softer trailing tail
            const falloff = distToFront >= 0
              ? Math.max(0, 1 - distToFront / (WAVE_WIDTH * 0.6))
              : Math.max(0, 1 - Math.abs(distToFront) / (WAVE_WIDTH * 1.4))
            waveGlow = falloff * falloff * WAVE_STRENGTH
          }

          // Combine: wave adds on top of base, mouse hover takes full priority
          const totalGlow = Math.min(1, mouseGlow + waveGlow * (1 - mouseGlow))
          const level = Math.round(totalGlow * (GLOW_LEVELS - 1))
          levelOf[k] = level
          levelCount[level]++
        }
      }

      // ── 2ª pasada: un trazo por nivel ────────────────────────────────────
      for (let level = 0; level < GLOW_LEVELS; level++) {
        if (levelCount[level] === 0) continue
        const glow   = level / (GLOW_LEVELS - 1)
        const radius = DOT_BASE_R + glow * (DOT_MAX_R - DOT_BASE_R)

        let r: number, g: number, b: number, a: number
        if (dark) {
          r = Math.round(110 + glow * (232 - 110))
          g = Math.round(88  + glow * (165 - 88))
          b = Math.round(75  + glow * (152 - 75))
          a = style === 'dots-light' ? 0.10 + glow * 0.50 : 0.22 + glow * 0.68
        } else {
          r = Math.round(165 + glow * (232 - 165))
          g = Math.round(150 + glow * (165 - 150))
          b = Math.round(138 + glow * (152 - 138))
          a = style === 'dots-light' ? 0.14 + glow * 0.40 : 0.28 + glow * 0.52
        }

        ctx.beginPath()
        let n = 0
        for (let i = 0; i < cols; i++) {
          const x = i * GAP
          for (let j = 0; j < rows; j++, n++) {
            if (levelOf[n] !== level) continue
            const y = j * GAP
            ctx.moveTo(x + radius, y) // sin esto, cada círculo se uniría con el anterior por una recta
            ctx.arc(x, y, radius, 0, Math.PI * 2)
          }
        }
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fill()
      }
    }

    let animId: number
    let lastDraw = 0
    const loop = (now: number) => {
      if (now - lastDraw >= MIN_FRAME_MS) {
        lastDraw = now
        draw()
      }
      animId = requestAnimationFrame(loop)
    }

    resize()
    animId = requestAnimationFrame(loop)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    window.addEventListener('resize',         resize)
    document.addEventListener('pointermove',  onPointerMove,  { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      window.removeEventListener('resize',          resize)
      document.removeEventListener('pointermove',   onPointerMove)
      document.removeEventListener('pointerleave',  onPointerLeave)
    }
  }, [])

  return (
    <canvas
      id="interactive-bg-canvas"
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none', display: 'block',
      }}
    />
  )
}
