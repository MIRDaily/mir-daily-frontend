import { NodeToolbar, Position } from '@xyflow/react'
import { FileText, TriangleAlert } from 'lucide-react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { isPendingReview, motivoLabel, origenLabel, type NodoIA } from '@/lib/mapas/ia/revision'

// Al pasar el ratón por un nodo generado con IA: de qué página del documento sale y, si es dudoso,
// por qué conviene revisarlo. Va en un NodeToolbar (tamaño fijo, no escala con el zoom) debajo del
// nodo, y no captura el ratón. Todo es texto de React: nada se pinta como HTML.

export function IAHoverChip({ id, ia }: { id: string; ia: NodoIA }) {
  const hovered = useMindMapStore((s) => s.hoveredNodeId === id)
  const dragging = useUIStore((s) => s.isDragging)
  const t = useTheme()
  const origen = origenLabel(ia)
  const pending = isPendingReview(ia)
  if (!origen && !pending) return null
  return (
    <NodeToolbar isVisible={hovered && !dragging} position={Position.Bottom} offset={10}>
      <div
        role="tooltip"
        style={{
          pointerEvents: 'none',
          maxWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: '6px 10px',
          borderRadius: 10,
          border: `1.5px solid ${pending ? t.warning : t.border}`,
          background: t.bgPanel,
          boxShadow: `3px 3px 0 0 ${pending ? `${t.warning}55` : t.shadow}`,
          color: t.textSecondary,
          fontSize: '0.72rem',
          fontWeight: 600,
          lineHeight: 1.35,
        }}
      >
        {origen && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={12} style={{ flexShrink: 0 }} />
            <span>
              {origen}
              {typeof ia.anclaje === 'number' && (
                <span style={{ color: t.textMuted, fontWeight: 500 }}> · anclaje {Math.round(ia.anclaje * 100)} %</span>
              )}
              {typeof ia.cerca === 'number' && ia.cerca < 1 && (
                <span style={{ color: t.textMuted, fontWeight: 500 }}> · junto a su tema {Math.round(ia.cerca * 100)} %</span>
              )}
            </span>
          </span>
        )}
        {pending && ia.dudoso && (
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: t.isDark ? '#E8C27A' : '#8A6214' }}>
            <TriangleAlert size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{motivoLabel(ia.dudoso)}</span>
          </span>
        )}
      </div>
    </NodeToolbar>
  )
}
