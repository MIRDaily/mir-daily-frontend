'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ListaCarpetas } from '@/components/carpetas/SelectorCarpeta'
import { moverACarpeta, useArbolCarpetas } from '@/lib/carpetas/api'
import { nombreCarpeta, SIN_CLASIFICAR, type Carpeta } from '@/lib/carpetas/sugerir'
import { agruparPorTipo, type TipoElemento } from '@/lib/carpetas/biblioteca'

// «Mover a…» de una selección (Biblioteca › Sin clasificar): mapas y grupos mezclados a una misma
// carpeta. El servidor mueve un tipo cada vez y cada tipo es todo o nada; si un tipo falla, los demás
// ya movidos se quedan movidos y se dice cuáles no. Nada se mueve sin que el usuario elija la carpeta.

const INK = '#2C3E50'

export default function MoverVarios({
  seleccion,
  sugerida = null,
  onClose,
  onMovidos,
}: {
  seleccion: { tipo: TipoElemento; id: string }[]
  /** Si todos los seleccionados comparten sugerencia, se ofrece como atajo. */
  sugerida?: Carpeta | null
  onClose: () => void
  /** Los que se movieron de verdad (aunque otros fallaran) y adónde. */
  onMovidos: (ids: string[], c: Carpeta) => void
}) {
  const arbol = useArbolCarpetas()
  const [error, setError] = useState<string | null>(null)
  const [moviendo, setMoviendo] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !moviendo && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, moviendo])

  const elegir = async (c: Carpeta, origen: 'usuario' | 'sugerencia') => {
    setMoviendo(true)
    setError(null)
    const movidos: string[] = []
    const fallos: string[] = []
    for (const [tipo, ids] of agruparPorTipo(seleccion)) {
      try {
        await moverACarpeta(tipo, ids, c, origen)
        movidos.push(...ids)
      } catch (e) {
        fallos.push(e instanceof Error ? e.message : 'No se pudo mover')
      }
    }
    if (movidos.length) onMovidos(movidos, c)
    if (fallos.length) {
      setError(movidos.length ? `Se movieron ${movidos.length}; el resto no: ${fallos[0]}` : fallos[0])
      setMoviendo(false)
      return
    }
    onClose()
  }

  if (typeof document === 'undefined') return null
  const n = seleccion.length
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && !moviendo && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Mover la selección a una carpeta" className="w-full max-w-md rounded-3xl bg-white p-5" style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}>
        <div className="mb-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-[24px] text-[#E8A598]">drive_file_move</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-[#2C3E50]">
              Mover {n} {n === 1 ? 'elemento' : 'elementos'}
            </h2>
            <p className="text-xs text-[#7D8A96]">Elige la carpeta: todos irán a la misma.</p>
          </div>
          <button type="button" onClick={onClose} disabled={moviendo} aria-label="Cerrar" className="text-[#7D8A96] hover:text-[#2C3E50] disabled:opacity-40">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        {!arbol ? (
          <p className="py-6 text-center text-sm text-[#7D8A96]">Cargando las carpetas…</p>
        ) : (
          <>
            {sugerida && sugerida.subjectId !== null && (
              <div className="mb-3">
                <button
                  type="button"
                  disabled={moviendo}
                  onClick={() => void elegir(sugerida, 'sugerencia')}
                  className="max-w-full truncate rounded-full border border-[#E8A598]/60 bg-[#FCEFEC] px-3 py-1 text-xs font-extrabold text-[#C97D6F] hover:border-[#E8A598] disabled:opacity-50"
                >
                  ¿A {nombreCarpeta(arbol, sugerida, { corto: true })}?
                </button>
              </div>
            )}
            <ListaCarpetas arbol={arbol} valor={SIN_CLASIFICAR} onElegir={(c) => (c.subjectId === null ? onClose() : void elegir(c, 'usuario'))} />
          </>
        )}
        {moviendo && <p className="mt-2 text-xs font-bold text-[#7D8A96]">Moviendo…</p>}
        {error && <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">{error}</p>}
      </div>
    </div>,
    document.body,
  )
}
