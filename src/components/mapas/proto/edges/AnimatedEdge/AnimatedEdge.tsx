import { memo, useRef, useLayoutEffect, useEffect, useMemo } from 'react'
import {
  type EdgeProps,
  type InternalNode,
  Position,
  useNodes,
  useInternalNode,
} from '@xyflow/react'
import { animate as fmAnimate } from 'framer-motion'
import type { MindMapEdge, EdgeVariant } from '@/components/mapas/proto/types/edge.types'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'

// ─── Geometry helpers ────────────────────────────────────────────────────────

// Margen de esquiva alrededor de cada nodo. El prototipo usaba 32; en un mapa ordenado en
// árbol los nodos están a ~18 px y casi todas las líneas rozaban a algún vecino y hacían rodeos.
const NODE_PAD = 6
// Desvíos que se prueban (px desde la cuerda) antes de rendirse y dibujar la curva directa.
// Antes el desvío era siempre medio nodo (~115 px en uno ancho) aunque la línea solo rozara
// una esquina, y salía una joroba enorme.
const DETOUR_STEPS = [14, 24, 36, 50, 66, 84, 104]

type Pt = { x: number; y: number }
type Cubic = [Pt, Pt, Pt, Pt]
type Rect = { x: number; y: number; w: number; h: number; cx: number; cy: number }

function segIntersectsSeg(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const abx = bx - ax, aby = by - ay
  const cdx = dx - cx, cdy = dy - cy
  const denom = abx * cdy - aby * cdx
  if (Math.abs(denom) < 1e-10) return false
  const t = ((cx - ax) * cdy - (cy - ay) * cdx) / denom
  const u = ((cx - ax) * aby - (cy - ay) * abx) / denom
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

function segHitsRect(a: Pt, b: Pt, r: Rect): boolean {
  const inside = (p: Pt) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h
  if (inside(a) || inside(b)) return true
  const x2 = r.x + r.w, y2 = r.y + r.h
  return (
    segIntersectsSeg(a.x, a.y, b.x, b.y, r.x, r.y, x2,  r.y) ||
    segIntersectsSeg(a.x, a.y, b.x, b.y, x2,  r.y, x2,  y2 ) ||
    segIntersectsSeg(a.x, a.y, b.x, b.y, x2,  y2,  r.x, y2 ) ||
    segIntersectsSeg(a.x, a.y, b.x, b.y, r.x, y2,  r.x, r.y)
  )
}

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Pt {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/** Polilínea que aproxima la curva real (no la cuerda): así solo se esquiva lo que de verdad pisa. */
function samplePath(curves: Cubic[], steps = 14): Pt[] {
  const pts: Pt[] = [curves[0][0]]
  for (const c of curves) for (let i = 1; i <= steps; i++) pts.push(cubicAt(c, i / steps))
  return pts
}

/** Primer obstáculo que pisa la curva (sin el primer y último tramo, que salen de sus nodos). */
function firstHit(curves: Cubic[], rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const pts = samplePath(curves)
  for (let i = 1; i < pts.length - 2; i++) {
    for (const r of rects) if (segHitsRect(pts[i], pts[i + 1], r)) return r
  }
  return null
}

function toD(curves: Cubic[]): string {
  let d = `M ${curves[0][0].x} ${curves[0][0].y}`
  for (const [, c1, c2, e] of curves) d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${e.x} ${e.y}`
  return d
}

// ─── Lados de conexión ───────────────────────────────────────────────────────

/**
 * Lados por los que sale y entra la línea según dónde está cada nodo AHORA. Los lados guardados
 * en la arista quedaban fijos: al mover un nodo (a mano o con la física) la línea seguía saliendo
 * por la derecha hacia un nodo que ya estaba a la izquierda y dibujaba un bucle.
 */
function pickSides(s: Rect, t: Rect): [Position, Position] {
  if (t.x >= s.x + s.w) return [Position.Right, Position.Left]
  if (t.x + t.w <= s.x) return [Position.Left, Position.Right]
  return t.cy >= s.cy ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom]
}

function anchor(r: Rect, pos: Position): Pt {
  if (pos === Position.Right)  return { x: r.x + r.w, y: r.cy }
  if (pos === Position.Left)   return { x: r.x,       y: r.cy }
  if (pos === Position.Bottom) return { x: r.cx,      y: r.y + r.h }
  return                              { x: r.cx,      y: r.y }
}

function rectOf(n: InternalNode | undefined): Rect | null {
  const w = n?.measured?.width, h = n?.measured?.height
  if (!n || !w || !h) return null
  const { x, y } = n.internals.positionAbsolute
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

// ─── Path computation ────────────────────────────────────────────────────────

/** Punto de control a `arm` px del extremo, en la dirección del lado */
function ctrl(p: Pt, pos: Position, arm: number): Pt {
  if (pos === Position.Right)  return { x: p.x + arm, y: p.y }
  if (pos === Position.Left)   return { x: p.x - arm, y: p.y }
  if (pos === Position.Bottom) return { x: p.x, y: p.y + arm }
  return                              { x: p.x, y: p.y - arm }
}

/**
 * Brazo de la curva. El prototipo daba hasta 220 px según la distancia en línea recta; en un
 * mapa en árbol (hijos a ~110 px del padre pero a cientos de px en vertical) eso pasaba de largo
 * y dibujaba bucles: el brazo no puede superar lo que hay de distancia en el eje por el que sale.
 */
function armFor(a: Pt, b: Pt, pos: Position): number {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const axis = pos === Position.Left || pos === Position.Right ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
  return Math.min(dist * 0.42, axis * 0.55 + 20, 220)
}

function directCurve(s: Pt, t: Pt, srcPos: Position, tgtPos: Position): Cubic[] {
  return [[s, ctrl(s, srcPos, armFor(s, t, srcPos)), ctrl(t, tgtPos, armFor(t, s, tgtPos)), t]]
}

/**
 * Dos tramos que pasan por un punto de paso. En el punto de paso la tangente sigue el eje por el
 * que sale la línea (`axis`: horizontal si sale por un lado) o la cuerda origen→destino (`chord`,
 * como el prototipo; suave pero puede hacer gancho, solo de reserva). Continuidad G1 siempre.
 */
function curveThrough(
  s: Pt, t: Pt, srcPos: Position, tgtPos: Position, w: Pt, tangent: 'axis' | 'chord',
): Cubic[] {
  const len = Math.hypot(t.x - s.x, t.y - s.y) || 1
  const horizontal = srcPos === Position.Left || srcPos === Position.Right
  let ux: number, uy: number, wpArm: number
  if (tangent === 'chord') {
    ux = (t.x - s.x) / len
    uy = (t.y - s.y) / len
    wpArm = Math.min(len * 0.22, 100)
  } else {
    ux = horizontal ? Math.sign(t.x - s.x) || 1 : 0
    uy = horizontal ? 0 : Math.sign(t.y - s.y) || 1
    const room = horizontal
      ? Math.min(Math.abs(w.x - s.x), Math.abs(t.x - w.x))
      : Math.min(Math.abs(w.y - s.y), Math.abs(t.y - w.y))
    wpArm = Math.min(len * 0.22, 100, room * 0.8 + 8)
  }
  return [
    [s, ctrl(s, srcPos, Math.min(armFor(s, w, srcPos), 110)), { x: w.x - ux * wpArm, y: w.y - uy * wpArm }, w],
    [w, { x: w.x + ux * wpArm, y: w.y + uy * wpArm }, ctrl(t, tgtPos, Math.min(armFor(t, w, tgtPos), 110)), t],
  ]
}

type SlimNode = {
  id: string
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
}

function computePath(
  s: Pt, t: Pt,
  srcPos: Position, tgtPos: Position,
  nodes: SlimNode[],
  sourceId: string, targetId: string,
): string {
  const direct = directCurve(s, t, srcPos, tgtPos)

  // Solo cuentan los nodos cerca de la línea (su caja + el desvío máximo, 160).
  const reach = 200
  const minX = Math.min(s.x, t.x) - reach, maxX = Math.max(s.x, t.x) + reach
  const minY = Math.min(s.y, t.y) - reach, maxY = Math.max(s.y, t.y) + reach
  const rects: Rect[] = []
  for (const node of nodes) {
    if (node.id === sourceId || node.id === targetId) continue
    const nw = node.measured?.width  ?? 160
    const nh = node.measured?.height ?? 50
    const x = node.position.x - NODE_PAD, y = node.position.y - NODE_PAD
    const w = nw + NODE_PAD * 2, h = nh + NODE_PAD * 2
    if (x > maxX || x + w < minX || y > maxY || y + h < minY) continue
    rects.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 })
  }

  const hit = firstHit(direct, rects)
  if (!hit) return toD(direct)

  // Se prueba el desvío más pequeño que deje la curva limpia, primero por el lado contrario al
  // obstáculo.
  const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2
  const len = Math.hypot(t.x - s.x, t.y - s.y) || 1
  const px = -(t.y - s.y) / len, py = (t.x - s.x) / len
  const away = (hit.cx - mx) * px + (hit.cy - my) * py > 0 ? -1 : 1
  const horizontal = srcPos === Position.Left || srcPos === Position.Right
  // Primero se desplaza el punto medio solo en el eje transversal (vertical si la línea sale por
  // un lado), que nunca hace rizo; si nada queda limpio, perpendicular a la cuerda.
  const crossAway = horizontal ? Math.sign(my - hit.cy) || 1 : Math.sign(mx - hit.cx) || 1
  const tries: [Pt, 'axis' | 'chord'][] = []
  for (const off of [...DETOUR_STEPS, 130, 160]) {
    for (const sign of [crossAway, -crossAway]) {
      tries.push([horizontal ? { x: mx, y: my + sign * off } : { x: mx + sign * off, y: my }, 'axis'])
    }
  }
  for (const off of DETOUR_STEPS) {
    for (const sign of [away, -away]) tries.push([{ x: mx + sign * px * off, y: my + sign * py * off }, 'chord'])
  }
  for (const [w, tangent] of tries) {
    const cand = curveThrough(s, t, srcPos, tgtPos, w, tangent)
    if (!firstHit(cand, rects)) return toD(cand)
  }
  // Ningún desvío razonable la deja limpia: mejor la curva directa que un rodeo enorme.
  return toD(direct)
}

// ─── Edge component ──────────────────────────────────────────────────────────

const NO_NODES: SlimNode[] = []

const DASH_MAP: Record<EdgeVariant, string> = {
  solid:  '',
  dashed: '10 5',
  dotted: '2 6',
}

function AnimatedEdgeInner({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
}: EdgeProps<MindMapEdge>) {
  const pathRef             = useRef<SVGPathElement>(null)
  const updateEdgeAnimating = useMindMapStore((s) => s.updateEdgeAnimating)
  const isDragging          = useUIStore((s) => s.isDragging)
  const allNodes            = useNodes()
  const srcRect             = rectOf(useInternalNode(source))
  const tgtRect             = rectOf(useInternalNode(target))
  // El atenuado por el modo foco (hover) lo pone useFocusController con un atributo y CSS:
  // suscribir cada línea al hover las re-renderizaba todas en cada movimiento del ratón.

  // Mientras se arrastra no se esquiva nada (se recalcula al soltar).
  const obstacles = isDragging ? NO_NODES : allNodes
  const edgePath = useMemo(
    () => {
      let s: Pt = { x: sourceX, y: sourceY }
      let t: Pt = { x: targetX, y: targetY }
      let sp = sourcePosition, tp = targetPosition
      if (srcRect && tgtRect) {
        ;[sp, tp] = pickSides(srcRect, tgtRect)
        s = anchor(srcRect, sp)
        t = anchor(tgtRect, tp)
      }
      return computePath(s, t, sp, tp, obstacles, source, target)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
     srcRect?.x, srcRect?.y, srcRect?.w, srcRect?.h,
     tgtRect?.x, tgtRect?.y, tgtRect?.w, tgtRect?.h,
     obstacles, source, target],
  )

  const variant: EdgeVariant  = data?.variant ?? 'solid'
  const dashValue  = DASH_MAP[variant]
  const strokeColor = data?.color ?? (selected ? '#89b4fa' : '#585b70')
  const strokeW     = data?.strokeWidth ?? 1.5

  useEffect(() => {
    if (!pathRef.current || data?.isAnimating) return
    const p = pathRef.current
    p.style.strokeDasharray = dashValue
    p.style.strokeLinecap   = variant === 'dotted' ? 'round' : 'butt'
  }, [dashValue, variant, data?.isAnimating])

  useLayoutEffect(() => {
    if (!data?.isAnimating || !pathRef.current) return
    const path = pathRef.current
    const timer = setTimeout(() => {
      const length = path.getTotalLength()
      if (length === 0) return
      path.style.strokeDasharray  = String(length)
      path.style.strokeDashoffset = String(length)
      const ctrl = fmAnimate(length, 0, {
        duration: 0.45, ease: 'easeOut',
        onUpdate:   (v) => { path.style.strokeDashoffset = String(v) },
        onComplete: () => {
          path.style.strokeDasharray  = ''
          path.style.strokeDashoffset = '0'
          updateEdgeAnimating(id, false)
        },
      })
      return () => ctrl.stop()
    }, 50)
    return () => clearTimeout(timer)
  }, [data?.isAnimating, id, updateEdgeAnimating])

  return (
    <g>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer' }} />
      <path
        ref={pathRef}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? strokeW + 0.8 : strokeW}
        style={{ pointerEvents: 'none', transition: 'stroke 200ms ease, stroke-width 200ms ease' }}
      />
    </g>
  )
}

export const AnimatedEdgeComponent = memo(AnimatedEdgeInner)
