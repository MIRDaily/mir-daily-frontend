import { BookOpenCheck, Eye, EyeOff, RotateCcw, X } from 'lucide-react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { branchUnits, revealAll, setStudyMode, toggleBranchReveal } from '@/components/mapas/proto/utils/study'
import { studyUnits } from '@/lib/mapas/study'

/**
 * Barra del modo estudio (informe 75), arriba en el centro del lienzo: cuántas hojas van
 * destapadas, destapar la rama seleccionada, destapar todo, tapar todo otra vez y salir. Kit
 * sticker del editor (borde de tinta y sombra dura) con su textura: el rayado de las tapas.
 */
export function StudyBar() {
  const study = useUIStore((s) => s.studyMode)
  if (!study) return null
  return <StudyBarInner />
}

function StudyBarInner() {
  const t = useTheme()
  const searchOpen = useUIStore((s) => s.searchOpen)
  const revealedSet = useUIStore((s) => s.revealed)
  // Hojas y celdas de tabla (cada celda de datos se destapa por su cuenta).
  const coverable = useMindMapStore((s) => s.nodes.flatMap(studyUnits).join('\u0000'))
  const selected = useMindMapStore((s) => s.nodes.filter((n) => n.selected && !n.hidden).map((n) => n.id).join('\u0000'))
  const ids = coverable ? coverable.split('\u0000') : []
  const sel = selected ? selected.split('\u0000') : []
  const shown = ids.filter((id) => revealedSet.has(id)).length
  const selLeaves = sel.length ? branchUnits(sel) : []
  const selAllShown = selLeaves.length > 0 && selLeaves.every((id) => revealedSet.has(id))

  const ink = t.isDark ? '#FAF7F4' : '#2C3E50'
  const shadow = t.isDark ? '#000000' : '#2C3E50'
  const btn = (enabled = true): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    height: 30,
    padding: '0 10px',
    borderRadius: 9,
    border: `1.5px solid ${t.isDark ? t.border2 : '#2C3E50'}`,
    background: t.bgPanel,
    color: ink,
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.45,
    flexShrink: 0,
  })

  return (
    <div
      role="toolbar"
      aria-label="Modo estudio"
      style={{
        position: 'absolute',
        top: searchOpen ? 64 : 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 10px 8px 12px',
        borderRadius: 16,
        border: `2px solid ${t.isDark ? t.border2 : '#2C3E50'}`,
        boxShadow: `4px 4px 0 0 ${shadow}`,
        // La textura del modo: el mismo rayado que tapa las hojas, muy suave.
        background: t.isDark
          ? `repeating-linear-gradient(-45deg, ${t.bgPanel} 0 10px, #2B2520 10px 20px)`
          : `repeating-linear-gradient(-45deg, #FFFFFF 0 10px, #F7F2EC 10px 20px)`,
        color: ink,
        fontSize: '0.82rem',
        fontWeight: 600,
        transition: 'top 200ms ease',
      }}
    >
      <BookOpenCheck size={18} color={t.accent} style={{ flexShrink: 0 }} />
      <span>
        <b style={{ fontWeight: 900 }}>Modo estudio</b>
        <span style={{ color: t.textSecondary }}>
          {' '}
          · {shown} de {ids.length} destapadas
        </span>
      </span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={btn(selLeaves.length > 0)}
          disabled={selLeaves.length === 0}
          onClick={() => toggleBranchReveal(sel)}
          title={selLeaves.length ? 'Destapar o tapar lo seleccionado con su rama (Enter, o doble clic en el nodo)' : 'Selecciona un nodo para destapar su rama'}
        >
          {selAllShown ? <EyeOff size={14} /> : <Eye size={14} />}
          {selAllShown ? 'Tapar rama' : 'Destapar rama'}
        </button>
        <button type="button" style={btn(shown < ids.length)} disabled={shown >= ids.length} onClick={revealAll} title="Destapar todo el mapa">
          <Eye size={14} />
          Todo
        </button>
        <button
          type="button"
          style={btn(shown > 0)}
          disabled={shown === 0}
          onClick={() => useUIStore.getState().coverAll()}
          title="Volver a tapar todas las hojas"
        >
          <RotateCcw size={14} />
          Tapar todo otra vez
        </button>
        <button
          type="button"
          style={{ ...btn(), background: t.accent, color: '#FFFFFF', borderColor: t.isDark ? t.accent : '#2C3E50' }}
          onClick={() => setStudyMode(false)}
          title="Salir del modo estudio"
        >
          <X size={14} />
          Salir
        </button>
      </span>
    </div>
  )
}
