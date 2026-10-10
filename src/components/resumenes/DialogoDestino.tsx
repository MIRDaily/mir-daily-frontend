'use client'

// «Mover a…» / «Copiar a…»: los OTROS grupos de resúmenes del usuario (con su color, icono y cuántos
// párrafos tienen) y «Grupo nuevo…». Elegir uno y confirmar; la acción la hace la página, que devuelve
// el error (si lo hay) para enseñarlo aquí sin cerrar.

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { listarGrupos, type GrupoResumen } from '@/lib/resumenes/api'
import { BaldosaGrupo } from '@/components/resumenes/ColorIconoGrupo'

const INK = '#2C3E50'

export type Destino = { tipo: 'existente'; id: string; name: string } | { tipo: 'nuevo'; name: string }
/** Lo que devuelve la página si algo falla (null si ha ido bien). `creado`: el grupo nuevo, si llegó a crearse. */
export type FalloDestino = { error: string; creado?: GrupoResumen } | null

export function DialogoDestino({
  accion,
  n,
  grupoActual,
  max,
  onCerrar,
  onConfirmar,
}: {
  accion: 'mover' | 'copiar'
  n: number
  grupoActual: string
  /** Tope de párrafos por grupo. */
  max: number
  onCerrar: () => void
  /** Hace la acción; devuelve el error, o null si ha ido bien (y entonces la página cierra esto). */
  onConfirmar: (d: Destino) => Promise<FalloDestino>
}) {
  const [grupos, setGrupos] = useState<GrupoResumen[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [elegido, setElegido] = useState<string | null>(null) // id, o '' para «Grupo nuevo…»
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idTitulo = useId()

  useEffect(() => {
    let vivo = true
    listarGrupos()
      .then((gs) => vivo && setGrupos(gs.filter((g) => g.id !== grupoActual)))
      .catch((e) => vivo && setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar los grupos'))
    return () => {
      vivo = false
    }
  }, [grupoActual])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !ocupado) onCerrar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar, ocupado])

  const verbo = accion === 'mover' ? 'Mover' : 'Copiar'
  const nuevo = elegido === ''
  const valido = nuevo ? nombre.trim().length >= 3 : !!elegido
  const confirmar = async () => {
    if (!valido || ocupado) return
    const g = grupos?.find((x) => x.id === elegido)
    setOcupado(true)
    setError(null)
    const fallo = await onConfirmar(nuevo ? { tipo: 'nuevo', name: nombre.trim() } : { tipo: 'existente', id: elegido!, name: g?.name ?? '' })
    setOcupado(false)
    if (!fallo) return
    setError(fallo.error)
    // Si el grupo nuevo llegó a crearse, a partir de ahora es uno más (para no crearlo dos veces).
    const creado = fallo.creado
    if (creado) {
      setGrupos((gs) => [...(gs ?? []), creado])
      setElegido(creado.id)
      setNombre('')
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#2c3e50]/45 backdrop-blur-sm" onClick={() => !ocupado && onCerrar()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white"
        style={{ boxShadow: `7px 7px 0 0 ${INK}` }}
        data-dialogo-destino
      >
        <header className="flex items-center gap-3 border-b border-[#7D8A96]/15 px-6 py-4">
          <h2 id={idTitulo} className="min-w-0 flex-1 text-lg font-black text-[#2C3E50]">
            {verbo} {n === 1 ? '1 párrafo' : `${n} párrafos`} a…
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#2C3E50]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" role="radiogroup" aria-labelledby={idTitulo}>
          {errorCarga ? (
            <p className="px-2 py-4 text-sm font-bold text-[#B04A5E]">{errorCarga}</p>
          ) : grupos === null ? (
            <p className="px-2 py-4 text-sm text-[#7D8A96]">Cargando grupos…</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {grupos.map((g) => {
                const sel = elegido === g.id
                const libres = Math.max(0, max - g.total)
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setElegido(g.id)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-[#FAF7F4]"
                      style={{ border: sel ? `2px solid ${INK}` : '2px solid transparent', background: sel ? '#FFF4F1' : undefined }}
                    >
                      <BaldosaGrupo color={g.color} icon={g.icon} tam="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-[#2C3E50]">{g.name}</span>
                        <span className="block text-[0.7rem] text-[#7D8A96]">
                          {g.total} {g.total === 1 ? 'párrafo' : 'párrafos'}
                          {libres < n ? <b className="text-[#B07A1E]"> · {libres === 0 ? 'lleno' : `solo caben ${libres}`}</b> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
              {grupos.length === 0 && <li className="px-2 py-2 text-sm text-[#7D8A96]">No tienes otros grupos: crea uno nuevo.</li>}
              <li>
                <button
                  type="button"
                  role="radio"
                  aria-checked={nuevo}
                  onClick={() => setElegido('')}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-[#FAF7F4]"
                  style={{ border: nuevo ? `2px solid ${INK}` : '2px dashed rgba(44,62,80,0.25)', background: nuevo ? '#FFF4F1' : undefined }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[#7D8A96]/50 text-[#7D8A96]" aria-hidden>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </span>
                  <span className="text-sm font-extrabold text-[#2C3E50]">Grupo nuevo…</span>
                </button>
                {nuevo && (
                  <input
                    autoFocus
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value.slice(0, 80))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void confirmar()
                    }}
                    placeholder="Nombre del grupo nuevo"
                    aria-label="Nombre del grupo nuevo"
                    className="mt-2 block w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
                  />
                )}
              </li>
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-[#7D8A96]/15 px-6 py-4">
          {error ? (
            <p className="min-w-0 flex-1 text-xs font-bold text-[#B04A5E]" role="alert">
              {error}
            </p>
          ) : (
            <p className="min-w-0 flex-1 text-[0.7rem] text-[#7D8A96]">
              {accion === 'mover' ? 'Los que ya estén en el destino se quedan aquí.' : 'Los que ya estén en el destino no se repiten.'}
            </p>
          )}
          <button type="button" onClick={onCerrar} disabled={ocupado} className="text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={!valido || ocupado}
            className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
          >
            {ocupado ? (accion === 'mover' ? 'Moviendo…' : 'Copiando…') : nuevo ? `Crear y ${verbo.toLowerCase()}` : verbo}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
