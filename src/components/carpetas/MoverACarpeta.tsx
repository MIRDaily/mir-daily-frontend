'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ListaCarpetas } from '@/components/carpetas/SelectorCarpeta'
import { moverACarpeta, useArbolCarpetas, type TipoMaterial } from '@/lib/carpetas/api'
import { nombreCarpeta, sugerirCarpeta, textosDocumento, type Carpeta } from '@/lib/carpetas/sugerir'

// «Mover a…»: elegir la carpeta de un mapa o un grupo ya guardado. La sugerencia (por su título) sale
// arriba como atajo, nunca se aplica sola. El servidor valida dueño, asignatura y tema.

const INK = '#2C3E50'
const NOMBRE_TIPO: Record<TipoMaterial, string> = { mapa: 'el mapa', flashcards: 'el grupo', resumenes: 'el grupo' }

export default function MoverACarpeta({
  tipo,
  id,
  titulo,
  actual,
  onClose,
  onMovido,
}: {
  tipo: TipoMaterial
  id: string
  titulo: string
  actual: Carpeta
  onClose: () => void
  onMovido: (c: Carpeta) => void
}) {
  const arbol = useArbolCarpetas()
  const [error, setError] = useState<string | null>(null)
  const [moviendo, setMoviendo] = useState(false)
  const sugerencia = useMemo(() => (arbol ? sugerirCarpeta(arbol, textosDocumento(titulo)) : null), [arbol, titulo])
  // La sugerencia y sus candidatas, sin la carpeta en la que ya está.
  const atajos = useMemo(() => {
    if (!sugerencia) return []
    const todas = [sugerencia.carpeta, ...sugerencia.candidatas].filter((c) => c.subjectId !== null)
    return todas.filter((c) => !(c.subjectId === actual.subjectId && c.topicId === actual.topicId)).slice(0, 3)
  }, [sugerencia, actual])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !moviendo && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, moviendo])

  const elegir = async (c: Carpeta) => {
    if (c.subjectId === actual.subjectId && c.topicId === actual.topicId) return onClose()
    setMoviendo(true)
    setError(null)
    try {
      await moverACarpeta(tipo, [id], c, 'usuario')
      onMovido(c)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mover')
      setMoviendo(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && !moviendo && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Mover a una carpeta" className="w-full max-w-md rounded-3xl bg-white p-5" style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}>
        <div className="mb-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-[24px] text-[#E8A598]">drive_file_move</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-[#2C3E50]">Mover {NOMBRE_TIPO[tipo]}</h2>
            <p className="truncate text-xs text-[#7D8A96]" title={titulo}>
              «{titulo}» está en {arbol ? nombreCarpeta(arbol, actual) : '…'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={moviendo} aria-label="Cerrar" className="text-[#7D8A96] hover:text-[#2C3E50] disabled:opacity-40">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        {!arbol ? (
          <p className="py-6 text-center text-sm text-[#7D8A96]">Cargando las carpetas…</p>
        ) : (
          <>
            {atajos.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {atajos.map((c) => (
                  <button
                    key={`${c.subjectId}-${c.topicId}`}
                    type="button"
                    disabled={moviendo}
                    onClick={() => void elegir(c)}
                    className="max-w-full truncate rounded-full border border-[#E8A598]/60 bg-[#FCEFEC] px-3 py-1 text-xs font-extrabold text-[#C97D6F] hover:border-[#E8A598] disabled:opacity-50"
                  >
                    ¿A {nombreCarpeta(arbol, c, { corto: true })}?
                  </button>
                ))}
              </div>
            )}
            <ListaCarpetas arbol={arbol} valor={actual} onElegir={(c) => void elegir(c)} />
          </>
        )}
        {moviendo && <p className="mt-2 text-xs font-bold text-[#7D8A96]">Moviendo…</p>}
        {error && <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">{error}</p>}
      </div>
    </div>,
    document.body,
  )
}
