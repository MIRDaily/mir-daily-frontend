'use client'

import { useState } from 'react'
import { CheckCheck, ChevronLeft, ChevronRight, Layers, PartyPopper, Sparkles, X } from 'lucide-react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { goToPending, markReviewed, useReviewCounts } from '@/components/mapas/proto/utils/review'
import { isPendingReview } from '@/lib/mapas/ia/revision'
import { abrirFlashcardsIA } from '@/components/mapas/flashcards/FlashcardsIADesdeMapa'

/**
 * Banner de la revisión guiada (informe 75), dentro del editor y debajo de su cabecera. Sustituye
 * al aviso fijo «revísalo» de `?ia=1`: ahora dice cuántos dudosos quedan y lleva a ellos (N y
 * Mayús+N, o sus botones) y deja marcarlos como revisados (R). Sale con `?ia=1` (mapa recién
 * generado) y siempre que el mapa tenga dudosos pendientes; se cierra con la X para esta visita.
 * No sale en el modo estudio.
 */
export default function ReviewBanner() {
  const t = useTheme()
  const { pending, total } = useReviewCounts()
  const searchOpen = useUIStore((s) => s.searchOpen)
  const studyMode = useUIStore((s) => s.studyMode)
  const iaFlashcards = useUIStore((s) => s.iaFlashcards)
  const selectedPending = useMindMapStore((s) => {
    let found: string | null = null
    for (const n of s.nodes) {
      if (!n.selected) continue
      if (found !== null) return null // más de uno seleccionado
      found = isPendingReview(n.data.ia) ? n.id : ''
    }
    return found || null
  })
  // Recién generado (?ia=1): se avisa aunque no haya ningún dudoso.
  const [fresh] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('ia') === '1'
    } catch {
      return false
    }
  })
  // Si al abrir quedaba algo, el banner se queda al terminar para decir que ya está. (El editor
  // carga el mapa en la store antes de montar esto.)
  const [startedPending] = useState(() => useMindMapStore.getState().nodes.some((n) => isPendingReview(n.data.ia)))
  const [closed, setClosed] = useState(false)
  if (closed || studyMode || !(fresh || pending > 0 || startedPending)) return null

  const warm = t.isDark
    ? { bg: '#2E2619', ink: '#F3D9A4', border: '#E8B85A', shadow: '#000000', soft: '#3A3020' }
    : { bg: '#FFF8E6', ink: '#6B4E0E', border: '#2C3E50', shadow: '#2C3E50', soft: '#F8EBC8' }

  const btn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 30,
    padding: '0 10px',
    borderRadius: 9,
    border: `1.5px solid ${warm.border}`,
    background: warm.soft,
    color: warm.ink,
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0,
  }

  return (
    <div
      role="status"
      aria-live="polite"
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
        gap: 10,
        padding: '8px 10px 8px 14px',
        borderRadius: 16,
        background: warm.bg,
        border: `2px solid ${warm.border}`,
        boxShadow: `4px 4px 0 0 ${warm.shadow}`,
        color: warm.ink,
        fontSize: '0.82rem',
        fontWeight: 600,
        transition: 'top 200ms ease',
      }}
    >
      {pending === 0 && total > 0 ? (
        <PartyPopper size={18} color="#D9A441" style={{ flexShrink: 0 }} />
      ) : (
        <Sparkles size={18} color="#D9A441" style={{ flexShrink: 0 }} />
      )}
      {pending > 0 ? (
        <span>
          Generado con IA ·{' '}
          <b style={{ fontWeight: 900 }}>
            Quedan {pending} por revisar
          </b>
          {total > pending && <span style={{ opacity: 0.7 }}> de {total}</span>}
          <span style={{ opacity: 0.7 }}> (en ámbar)</span>
        </span>
      ) : total > 0 ? (
        <span>
          <b style={{ fontWeight: 900 }}>Revisión terminada:</b> los {total} dudosos están revisados.
        </span>
      ) : (
        <span>Mapa generado con IA a partir de tu documento. Revisa los datos antes de estudiar con él.</span>
      )}
      {pending > 0 && (
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btn} onClick={() => goToPending(-1)} title="Dudoso anterior (Mayús+N)" aria-label="Dudoso anterior">
            <ChevronLeft size={15} />
          </button>
          <button type="button" style={btn} onClick={() => goToPending(1)} title="Dudoso siguiente (N)">
            Siguiente
            <ChevronRight size={15} />
          </button>
          {selectedPending && (
            <button
              type="button"
              style={{ ...btn, background: '#D9A441', color: '#FFFFFF', borderColor: warm.border }}
              onClick={() => markReviewed(selectedPending, true)}
              title="Marcar como revisado y pasar al siguiente (R)"
            >
              <CheckCheck size={15} />
              Revisado
            </button>
          )}
        </span>
      )}
      {/* Mapa recién generado: sus flashcards en un clic (el mapa entero, con su documento si cabe). */}
      {fresh && iaFlashcards && (
        <button type="button" style={btn} onClick={() => abrirFlashcardsIA(true)} title="Flashcards con IA del mapa entero">
          <Layers size={15} />
          Hacer también las flashcards
        </button>
      )}
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Cerrar aviso"
        title="Cerrar (N y R siguen funcionando)"
        style={{ background: 'none', border: 0, cursor: 'pointer', color: warm.ink, padding: 2, display: 'flex' }}
      >
        <X size={17} />
      </button>
    </div>
  )
}
