'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { moverACarpeta } from '@/lib/carpetas/api'
import { nombreCarpeta, type AsignaturaCatalogo, type Carpeta } from '@/lib/carpetas/sugerir'
import { agruparPorTipo, type ElementoMaterial } from '@/lib/carpetas/biblioteca'
import { TRANSICION } from '@/components/ui/movimiento'

// «Aceptar las sugerencias» (Biblioteca › Sin clasificar): mueve cada elemento a la carpeta que se le
// sugiere, de una vez. Antes enseña adónde va cada grupo; nada se mueve hasta pulsar el botón. Un grupo
// (una carpeta y un tipo) es todo o nada en el servidor; si alguno falla, los ya movidos se quedan movidos
// y se dice cuántos no.

const INK = '#2C3E50'

type Grupo = { carpeta: Carpeta; nombre: string; elementos: ElementoMaterial[] }

export default function AceptarSugerencias({
  elementos,
  sugerencias,
  clave,
  arbol,
  onClose,
  onMovidos,
  onTerminado,
}: {
  /** Los que se van a mover (todos con sugerencia). */
  elementos: ElementoMaterial[]
  sugerencias: Map<string, Carpeta>
  clave: (e: ElementoMaterial) => string
  arbol: AsignaturaCatalogo[]
  onClose: () => void
  /** Cada grupo movido de verdad: sus claves y adónde. */
  onMovidos: (claves: string[], c: Carpeta) => void
  /** Al acabar: cuántos se movieron y a qué carpetas (las que recibieron algo). */
  onTerminado: (movidos: number, carpetas: Carpeta[]) => void
}) {
  const [moviendo, setMoviendo] = useState(false)
  const [hechos, setHechos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Los grupos se fijan al abrir: mientras se mueve, la página va quitando filas (y con ellas sus
  // sugerencias), y aquí no debe cambiar nada.
  const [grupos] = useState(() => {
    const m = new Map<string, Grupo>()
    for (const e of elementos) {
      const c = sugerencias.get(clave(e))
      if (!c || c.subjectId === null) continue
      const k = `${c.subjectId}:${c.topicId ?? 'general'}`
      if (!m.has(k)) m.set(k, { carpeta: c, nombre: nombreCarpeta(arbol, c, { corto: true }), elementos: [] })
      m.get(k)!.elementos.push(e)
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  })
  const total = grupos.reduce((n, g) => n + g.elementos.length, 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !moviendo && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, moviendo])

  const aceptar = async () => {
    setMoviendo(true)
    setError(null)
    let movidos = 0
    const carpetas: Carpeta[] = []
    const fallos: string[] = []
    for (const g of grupos) {
      let enEsta = 0
      for (const [tipo, ids] of agruparPorTipo(g.elementos)) {
        try {
          await moverACarpeta(tipo, ids, g.carpeta, 'sugerencia')
          const deEste = g.elementos.filter((e) => e.tipo === tipo && ids.includes(e.id))
          onMovidos(deEste.map(clave), g.carpeta)
          enEsta += deEste.length
          movidos += deEste.length
          setHechos(movidos)
        } catch (e) {
          fallos.push(e instanceof Error ? e.message : 'No se pudo mover')
        }
      }
      if (enEsta) carpetas.push(g.carpeta)
    }
    onTerminado(movidos, carpetas)
    if (fallos.length) {
      setError(movidos ? `Se movieron ${movidos}; ${total - movidos} no: ${fallos[0]}` : fallos[0])
      setMoviendo(false)
      return
    }
    onClose()
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !moviendo && onClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Aceptar las sugerencias"
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-white p-5"
        style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
        transition={TRANSICION}
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="inline-flex text-[#E8A598]" aria-hidden>
            <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-[#2C3E50]">
              Mover {total} {total === 1 ? 'elemento' : 'elementos'} a su carpeta sugerida
            </h2>
            <p className="text-xs text-[#7D8A96]">
              {total === 1
                ? 'Revisa adónde va antes de moverlo.'
                : `${grupos.length} ${grupos.length === 1 ? 'carpeta' : 'carpetas'}. Revisa adónde va cada grupo antes de moverlos.`}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={moviendo} aria-label="Cerrar" className="inline-flex text-[#7D8A96] hover:text-[#2C3E50] disabled:opacity-40">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-1">
          {grupos.map((g) => (
            <li key={`${g.carpeta.subjectId}:${g.carpeta.topicId}`} className="rounded-2xl border-2 border-[#EAE4E2] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex text-[#E8A598]" aria-hidden>
                  <span className="material-symbols-outlined text-[18px]">{g.carpeta.topicId === null ? 'folder_special' : 'folder'}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-black text-[#2C3E50]" title={g.nombre}>
                  {g.nombre}
                </span>
                <span className="shrink-0 rounded-full bg-[#F5F1EE] px-2 text-[11px] leading-5 font-black text-[#7D8A96] tabular-nums">{g.elementos.length}</span>
              </div>
              <p className="mt-0.5 truncate pl-[26px] text-[11px] text-[#7D8A96]" title={g.elementos.map((e) => e.titulo).join(' · ')}>
                {g.elementos.map((e) => e.titulo).join(' · ')}
              </p>
            </li>
          ))}
        </ul>

        {error ? (
          <p role="alert" className="mt-3 text-sm font-bold text-[#B04A5E]">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={moviendo} className="rounded-xl px-3 py-2 text-sm font-extrabold text-[#7D8A96] hover:text-[#2C3E50] disabled:opacity-40">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void aceptar()}
            disabled={moviendo || total === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2c3e50] bg-[#E8A598] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_0_#2c3e50] transition-[translate,box-shadow] duration-150 hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_#2c3e50] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#2c3e50] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            <span className="material-symbols-outlined text-[18px]">drive_file_move</span>
            {moviendo ? (total === 1 ? 'Moviendo…' : `Moviendo ${hechos} de ${total}…`) : total === 1 ? 'Moverlo' : `Mover los ${total}`}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
