import { memo, useRef, useLayoutEffect, useEffect, useMemo } from 'react'
import {
  type EdgeProps,
  Position,
  useNodes,
} from '@xyflow/react'
import { animate as fmAnimate } from 'framer-motion'
import type { MindMapEdge, EdgeVariant } from '@/components/mapas/proto/types/edge.types'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'

// ─── Geometry helpers ────────────────────────────────────────────────────────

// Margen de esquiva alrededor de cada nodo. El prototipo usaba 32; en un mapa ordenado en
// árbol los nodos están a ~18 px y casi todas las líneas rozaban a algún vecino y hacían rodeos.
const NODE_PAD = 6

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
  return t > 0.04 && t < 0.96 && u >= 0 && u <= 1
}

function lineBlocksRect(
  sx: number, sy: number, tx: number, ty: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  const inside = (x: number, y: number) =>
    x > rx && x < rx + rw && y > ry && y < ry + rh
  if (inside(sx, sy) || inside(tx, ty)) return true
  return (
    segIntersectsSeg(sx, sy, tx, ty, rx,      ry,      rx + rw, ry     ) ||
    segIntersectsSeg(sx, sy, tx, ty, rx + rw, ry,      rx + rw, ry + rh) ||
    segIntersectsSeg(sx, sy, tx, ty, rx + rw, ry + rh, rx,      ry + rh) ||
    segIntersectsSeg(sx, sy, tx, ty, rx,      ry + rh, rx,      ry     )
  )
}

// ─── Path computation ────────────────────────────────────────────────────────

/** Offset for the bezier control point given the handle direction */
function cpOffset(pos: Position, dist: number): [number, number] {
  const t = Math.min(dist * 0.42, 220)
  if (pos === Position.Right)  return [ t,  0]
  if (pos === Position.Left)   return [-t,  0]
  if (pos === Position.Bottom) return [ 0,  t]
  return                              [ 0, -t]   // Top
}

/**
 * Direct cubic bezier using the ACTUAL source/target handle positions.
 * Never overrides them — React Flow already picked the nearest/correct handles.
 */
function simplePath(
  sx: number, sy: number, tx: number, ty: number,
  srcPos: Position, tgtPos: Position,
): string {
  const dist = Math.hypot(tx - sx, ty - sy)
  if (dist < 1) return `M ${sx} ${sy} L ${tx} ${ty}`
  // El prototipo daba a las curvas hasta 220 px de "brazo" según la distancia en línea
  // recta. En un mapa ordenado en árbol (hijos a ~110 px del padre pero a cientos de px
  // en vertical) eso pasaba de largo y dibujaba bucles: el brazo no puede superar lo que
  // hay de distancia en el eje por el que sale la línea.
  const dx = Math.abs(tx - sx)
  const dy = Math.abs(ty - sy)
  const armLimit = (pos: Position) =>
    ((pos === Position.Left || pos === Position.Right ? dx : dy) * 0.55 + 20) / 0.42
  const [o1x, o1y] = cpOffset(srcPos, Math.min(dist, armLimit(srcPos)))
  const [o2x, o2y] = cpOffset(tgtPos, Math.min(dist, armLimit(tgtPos)))
  return `M ${sx} ${sy} C ${sx + o1x} ${sy + o1y}, ${tx + o2x} ${ty + o2y}, ${tx} ${ty}`
}

/**
 * Two-segment cubic bezier routed through a waypoint.
 *
 * cp1/cp4 respect the actual handle directions (source exit / target entry).
 * cp2/cp3 are always aligned to the main source→target axis — this guarantees
 * G1 continuity at the waypoint and prevents spikes regardless of waypoint position.
 */
function pathThroughWaypoint(
  sx: number, sy: number, tx: number, ty: number,
  srcPos: Position, tgtPos: Position,
  wx: number, wy: number,
): string {
  const d1 = Math.hypot(wx - sx, wy - sy)
  const d2 = Math.hypot(tx - wx, ty - wy)
  const totalLen = Math.hypot(tx - sx, ty - sy) || 1

  // Unit vector along main axis (source → target)
  const ux = (tx - sx) / totalLen
  const uy = (ty - sy) / totalLen
  // Tangent arm at waypoint — scales with total distance, capped
  const wpArm = Math.min(totalLen * 0.22, 100)

  // cp1: exit source in handle direction
  const [o1x, o1y] = cpOffset(srcPos, Math.min(d1 * 0.5, 110))
  const cp1x = sx + o1x, cp1y = sy + o1y

  // cp2/cp3: aligned to main axis → no kinks or spikes at waypoint
  const cp2x = wx - ux * wpArm, cp2y = wy - uy * wpArm
  const cp3x = wx + ux * wpArm, cp3y = wy + uy * wpArm

  // cp4: enter target in handle direction
  const [o4x, o4y] = cpOffset(tgtPos, Math.min(d2 * 0.5, 110))
  const cp4x = tx + o4x, cp4y = ty + o4y

  return (
    `M ${sx} ${sy} ` +
    `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${wx} ${wy} ` +
    `C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${tx} ${ty}`
  )
}

type SlimNode = {
  id: string
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
}

function computePath(
  sx: number, sy: number, tx: number, ty: number,
  srcPos: Position, tgtPos: Position,
  nodes: SlimNode[],
  sourceId: string, targetId: string,
): string {
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2

  // Find the blocking node closest to the midpoint
  let bestObs: {
    cx: number; cy: number
    halfW: number; halfH: number
    dist: number
  } | null = null

  for (const node of nodes) {
    if (node.id === sourceId || node.id === targetId) continue
    const nw = (node.measured?.width  as number | undefined) ?? 160
    const nh = (node.measured?.height as number | undefined) ?? 50
    const rx = node.position.x - NODE_PAD
    const ry = node.position.y - NODE_PAD
    const rw = nw + NODE_PAD * 2
    const rh = nh + NODE_PAD * 2
    if (!lineBlocksRect(sx, sy, tx, ty, rx, ry, rw, rh)) continue
    const ncx = node.position.x + nw / 2
    const ncy = node.position.y + nh / 2
    const d = Math.hypot(ncx - mx, ncy - my)
    if (!bestObs || d < bestObs.dist) {
      bestObs = { cx: ncx, cy: ncy, halfW: rw / 2, halfH: rh / 2, dist: d }
    }
  }

  if (!bestObs) return simplePath(sx, sy, tx, ty, srcPos, tgtPos)

  // Perpendicular unit vector to source→target
  const len = Math.hypot(tx - sx, ty - sy) || 1
  const px = -(ty - sy) / len
  const py =  (tx - sx) / len

  // Push to the side AWAY from the obstacle centre
  const dot  = (bestObs.cx - mx) * px + (bestObs.cy - my) * py
  const sign = dot > 0 ? -1 : 1
  const pushDist = Math.max(bestObs.halfW, bestObs.halfH) + NODE_PAD * 1.5

  return pathThroughWaypoint(
    sx, sy, tx, ty, srcPos, tgtPos,
    mx + sign * px * pushDist,
    my + sign * py * pushDist,
  )
}

// ─── Edge component ──────────────────────────────────────────────────────────

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
  // El atenuado por el modo foco (hover) lo pone useFocusController con un atributo y CSS:
  // suscribir cada línea al hover las re-renderizaba todas en cada movimiento del ratón.

  const edgePath = useMemo(
    () => computePath(
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
      isDragging ? [] : allNodes,
      source, target,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
     isDragging, isDragging ? null : allNodes, source, target],
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
