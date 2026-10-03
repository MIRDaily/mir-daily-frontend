import type { Thumb } from '@/lib/mapas/summary'

/** Dibujo en miniatura de un mapa: sus nodos (con sus colores) y las líneas que los unen. */
export function MapThumb({ thumb }: { thumb: Thumb | null }) {
  if (!thumb) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[#7D8A96]/50">
        <span className="material-symbols-outlined text-5xl">account_tree</span>
      </div>
    )
  }
  const pad = Math.max(thumb.w, thumb.h) * 0.04 + 6
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${thumb.w + 2 * pad} ${thumb.h + 2 * pad}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden
    >
      {thumb.edges.map((e, i) => (
        <path key={i} d={e.d} fill="none" stroke={e.color} strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.75} />
      ))}
      {thumb.nodes.map((n, i) => (
        <rect key={i} x={n.x} y={n.y} width={n.w} height={n.h} rx={n.r} fill={n.fill} stroke={n.stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
