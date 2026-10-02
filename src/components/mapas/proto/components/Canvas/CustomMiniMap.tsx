import { useCallback, useEffect, useRef, useState } from 'react'
import { useViewport, useNodes, useReactFlow, useStore } from '@xyflow/react'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'

const W        = 220   // minimap width  (px)
const H        = 150   // minimap height (px)
const PAD      = 300   // flow-coord padding around the node bounding box
const MIN_HALF_W = 900 // minimum half-width  (~2 screens of context)
const MIN_HALF_H = 650 // minimum half-height (~2 screens of context)

export function CustomMiniMap() {
  const { x: vpX, y: vpY, zoom } = useViewport()
  // Lo plegado no se dibuja en el minimapa (tampoco ensancha sus límites).
  const nodes = (useNodes() as MindMapNode[]).filter((n) => !n.hidden)
  const { setViewport } = useReactFlow()
  // Tamaño del lienzo del editor (no de la ventana: aquí hay cabecera de la web encima).
  const screenW = useStore((s) => s.width)
  const screenH = useStore((s) => s.height)
  const t = useTheme()

  const containerRef  = useRef<HTMLDivElement>(null)
  const scaleRef      = useRef(1)
  const offsetRef     = useRef({ x: 0, y: 0 })
  const boundsRef     = useRef({ minX: 0, minY: 0, maxX: 1, maxY: 1 })
  const dragState     = useRef<{ active: boolean; startMx: number; startMy: number; startVpX: number; startVpY: number }>({
    active: false, startMx: 0, startMy: 0, startVpX: 0, startVpY: 0,
  })
  const [dragging, setDragging] = useState(false)

  // ── Adaptive bounds: node content + padding, with a sensible minimum ─────
  let rawMinX = -PAD, rawMinY = -PAD, rawMaxX = PAD, rawMaxY = PAD
  if (nodes.length > 0) {
    rawMinX = Math.min(...nodes.map(n => n.position.x)) - PAD
    rawMaxX = Math.max(...nodes.map(n => n.position.x + ((n.measured?.width  as number | undefined) ?? 160))) + PAD
    rawMinY = Math.min(...nodes.map(n => n.position.y)) - PAD
    rawMaxY = Math.max(...nodes.map(n => n.position.y + ((n.measured?.height as number | undefined) ?? 50))) + PAD
  }

  // Expand symmetrically from the content center up to the minimum half-size
  const cx   = (rawMinX + rawMaxX) / 2
  const cy   = (rawMinY + rawMaxY) / 2
  const minX = cx - Math.max((rawMaxX - rawMinX) / 2, MIN_HALF_W)
  const maxX = cx + Math.max((rawMaxX - rawMinX) / 2, MIN_HALF_W)
  const minY = cy - Math.max((rawMaxY - rawMinY) / 2, MIN_HALF_H)
  const maxY = cy + Math.max((rawMaxY - rawMinY) / 2, MIN_HALF_H)

  const contentW = maxX - minX
  const contentH = maxY - minY
  const scale    = Math.min(W / contentW, H / contentH)
  const offX     = (W - contentW * scale) / 2
  const offY     = (H - contentH * scale) / 2

  // Keep refs in sync so event handlers always have fresh values
  useEffect(() => {
    scaleRef.current  = scale
    offsetRef.current = { x: offX, y: offY }
    boundsRef.current = { minX, minY, maxX, maxY }
  })

  // ── Flow ↔ minimap coordinate helpers ──────────────────────────────────
  const flowToMini = (fx: number, fy: number) => ({
    x: (fx - minX) * scale + offX,
    y: (fy - minY) * scale + offY,
  })

  // ── Viewport rectangle (in minimap coords) ───────────────────────────────
  const vp = flowToMini(-vpX / zoom, -vpY / zoom)
  const vpW = (screenW / zoom) * scale
  const vpH = (screenH / zoom) * scale

  // ── Click on minimap → centre viewport on that flow point ───────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top
    const s    = scaleRef.current
    const off  = offsetRef.current
    const bnds = boundsRef.current
    const fx   = (mx - off.x) / s + bnds.minX
    const fy   = (my - off.y) / s + bnds.minY
    setViewport(
      { x: -fx * zoom + screenW / 2, y: -fy * zoom + screenH / 2, zoom },
      { duration: 350 },
    )
  }, [dragging, zoom, screenW, screenH, setViewport])

  // ── Drag viewport rect to pan ────────────────────────────────────────────
  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    dragState.current = { active: true, startMx: e.clientX, startMy: e.clientY, startVpX: vpX, startVpY: vpY }
    setDragging(true)
  }, [vpX, vpY])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const { startMx, startMy, startVpX, startVpY } = dragState.current
      const dmx = e.clientX - startMx
      const dmy = e.clientY - startMy
      const s   = scaleRef.current
      setViewport({
        x:    startVpX - (dmx / s) * zoom,
        y:    startVpY - (dmy / s) * zoom,
        zoom,
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [dragging, zoom, setViewport])

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        position:     'absolute',
        bottom:       16,
        right:        16,
        width:        W,
        height:       H,
        background:   t.isDark ? '#211D19' : '#EDE8E2',
        border:       `1px solid ${t.border}`,
        borderRadius: 12,
        overflow:     'hidden',
        cursor:       dragging ? 'grabbing' : 'crosshair',
        zIndex:       900,
        boxShadow:    `0 4px 20px ${t.shadow}`,
        userSelect:   'none',
      }}
    >
      {/* Dot-grid background */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="mm-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill={t.isDark ? '#7D8A96' : '#A8B4BC'} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mm-grid)" />
      </svg>

      {/* Nodes: un trazado SVG por color en vez de un <div> por nodo. Con ~100 nodos, el
          minimapa recreaba 100 elementos en cada fotograma de un arrastre. */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {Object.entries(
          nodes.reduce<Record<string, string>>((acc, n) => {
            const { x: mx, y: my } = flowToMini(n.position.x, n.position.y)
            const nw = Math.max(((n.measured?.width  as number | undefined) ?? 160) * scale, 4)
            const nh = Math.max(((n.measured?.height as number | undefined) ?? 50)  * scale, 3)
            const color = n.data.style?.color ?? t.border2
            acc[color] = (acc[color] ?? '') + `M${mx.toFixed(1)} ${my.toFixed(1)}h${nw.toFixed(1)}v${nh.toFixed(1)}h${(-nw).toFixed(1)}Z`
            return acc
          }, {}),
        ).map(([color, d]) => (
          <path key={color} d={d} fill={color} opacity={0.9} />
        ))}
      </svg>

      {/* Viewport rectangle */}
      <div
        onMouseDown={handleViewportMouseDown}
        style={{
          position:     'absolute',
          left:         vp.x,
          top:          vp.y,
          width:        Math.max(vpW, 8),
          height:       Math.max(vpH, 8),
          border:       `2px solid ${t.accent}`,
          background:   `${t.accent}20`,
          borderRadius: 3,
          cursor:       dragging ? 'grabbing' : 'grab',
          boxShadow:    `0 0 0 1px ${t.accent}40`,
        }}
      />
    </div>
  )
}
