'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import {
  empezarParrafo,
  fallos as contarFallos,
  NOMBRE_NOTA,
  notaDeRepaso,
  responder,
  segmentos,
  siguienteTapado,
  terminado,
  type EstadoParrafo,
  type Nivel,
  type Nota,
  type Respuesta,
} from '@/lib/resumenes/huecos'
import {
  deshacerRepaso,
  editarParrafo,
  empezarSesion,
  quitarParrafo,
  registrarRepaso,
  siguiente,
  terminarSesion,
  type AjustesEstudio,
  type Parrafo,
} from '@/lib/resumenes/api'
import { INK } from './ParrafoHuecos'
import { EditorParrafo } from './EditorParrafo'

// Estudio de un grupo de resúmenes activos. Cada párrafo sale con sus huecos TAPADOS (solo los de los
// niveles elegidos; los demás se ven). Espacio o tocar destapa el siguiente; en cada hueco, «Lo sabía» o
// «No lo sabía» (teclas 2 y 1). Al acabar el párrafo se propone la nota de repaso (todos bien = Bien; uno
// mal = Difícil; más = Otra vez) y se puede cambiar (1-4) antes de pasar al siguiente (Enter). «Ver de
// dónde sale» (F), editar (E) y borrar el párrafo sin salir de la sesión. «Deshacer» (Ctrl+Z) vuelve
// atrás el último repaso (también desde la pantalla de fin: la sesión se reabre) y enseña otra vez el párrafo.

const COLOR_NOTA: Record<Nota, string> = { 1: '#B04A5E', 2: '#B07A1E', 3: '#5E8C5A', 4: '#3F7EA6' }
type Resumen = { parrafos: number; sabidos: number; fallados: number; notas: Record<Nota, number> }
/** Un repaso registrado en esta sesión (para descontarlo del resumen al deshacerlo). */
type Hecho = { tapados: number; fallos: number; grade: Nota }
const resumenVacio = (): Resumen => ({ parrafos: 0, sabidos: 0, fallados: 0, notas: { 1: 0, 2: 0, 3: 0, 4: 0 } })

export function EstudioResumen({
  grupoId,
  ajustes,
  temas,
  onSalir,
  onCambio,
}: {
  grupoId: string
  ajustes: AjustesEstudio
  temas: string[]
  onSalir: () => void
  /** Algo ha cambiado en el grupo (editado, borrado, repasado): la lista se recarga al salir. */
  onCambio?: () => void
}) {
  const niveles: Nivel[] | null = ajustes.levels && ajustes.levels.length ? ajustes.levels : null
  const [sesion, setSesion] = useState<string | null>(null)
  const [parrafo, setParrafo] = useState<Parrafo | null>(null)
  const [estado, setEstado] = useState<EstadoParrafo | null>(null)
  const [destapado, setDestapado] = useState<number | null>(null)
  const [nota, setNota] = useState<Nota | null>(null)
  const [fin, setFin] = useState<null | 'fin' | 'caducada' | 'limite'>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [verOrigen, setVerOrigen] = useState(false)
  const [editando, setEditando] = useState(false)
  const [resumen, setResumen] = useState<Resumen>(resumenVacio)
  const [vuelta, setVuelta] = useState(0)
  const [pila, setPila] = useState<Hecho[]>([])
  const desde = useRef(Date.now())

  const mostrar = useCallback((p: Parrafo) => {
    setParrafo(p)
    setEstado(empezarParrafo(p.huecos, niveles))
    setDestapado(null)
    setNota(null)
    setVerOrigen(false)
    setEditando(false)
    desde.current = Date.now()
    // `niveles` sale de los ajustes, que no cambian en una sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarSiguiente = useCallback(
    async (s: string) => {
      setOcupado(true)
      try {
        const r = await siguiente(grupoId, s)
        if (r.tipo === 'parrafo') mostrar(r.parrafo)
        else {
          setParrafo(null)
          setFin(r.tipo)
          void terminarSesion(grupoId, s)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el siguiente párrafo')
      } finally {
        setOcupado(false)
      }
    },
    [grupoId, mostrar],
  )

  // Una sola petición de sesión por vuelta: si el efecto se monta dos veces (el modo estricto de React lo
  // hace en desarrollo), la segunda reutiliza la promesa de la primera en vez de abrir otra sesión.
  const arranque = useRef<{ vuelta: number; sesion: Promise<string> } | null>(null)
  useEffect(() => {
    let vivo = true
    setFin(null)
    setResumen(resumenVacio())
    setPila([])
    if (!arranque.current || arranque.current.vuelta !== vuelta) arranque.current = { vuelta, sesion: empezarSesion(grupoId, ajustes) }
    void arranque.current.sesion
      .then((s) => {
        if (!vivo) return
        setSesion(s)
        void cargarSiguiente(s)
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se pudo empezar la sesión'))
    return () => {
      vivo = false
    }
    // Una sesión por vuelta («Repasar otra vez» suma una).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId, vuelta])

  const listo = !!estado && terminado(estado)
  const fallos = estado ? contarFallos(estado) : 0
  const propuesta = notaDeRepaso(fallos)
  const notaFinal = nota ?? propuesta

  const destaparSiguiente = useCallback(() => {
    if (!estado || destapado !== null) return
    const k = siguienteTapado(estado)
    if (k !== null) setDestapado(k)
  }, [estado, destapado])

  const contestar = useCallback(
    (r: Respuesta) => {
      if (!estado || destapado === null) return
      setEstado(responder(estado, destapado, r))
      setDestapado(null)
    },
    [estado, destapado],
  )

  const pasar = useCallback(async () => {
    if (!parrafo || !estado || !sesion || !listo || ocupado) return
    setOcupado(true)
    setError(null)
    try {
      if (estado.tapados.length > 0) {
        const r = await registrarRepaso(grupoId, {
          sessionId: sesion,
          deckItemId: parrafo.itemId,
          tapados: estado.tapados.length,
          fallos,
          ...(nota !== null && nota !== propuesta ? { grade: nota } : {}),
          timeSpent: Math.round((Date.now() - desde.current) / 1000),
        })
        setResumen((x) => ({
          parrafos: x.parrafos + 1,
          sabidos: x.sabidos + estado.tapados.length - fallos,
          fallados: x.fallados + fallos,
          notas: { ...x.notas, [r.grade]: x.notas[r.grade] + 1 },
        }))
        setPila((x) => [...x, { tapados: estado.tapados.length, fallos, grade: r.grade }])
        onCambio?.()
      }
      setOcupado(false)
      await cargarSiguiente(sesion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el repaso')
      setOcupado(false)
    }
  }, [parrafo, estado, sesion, listo, ocupado, grupoId, fallos, nota, propuesta, cargarSiguiente, onCambio])

  // Deshacer el último repaso: el servidor restaura el progreso (y reabre la sesión si estaba cerrada);
  // aquí se descuenta del resumen y se enseña otra vez el párrafo, sin responder.
  const deshacer = useCallback(async () => {
    if (!sesion || ocupado || pila.length === 0) return
    setOcupado(true)
    setError(null)
    try {
      const r = await deshacerRepaso(grupoId, sesion)
      const u = pila[pila.length - 1]
      setPila((x) => x.slice(0, -1))
      setResumen((x) => ({
        parrafos: Math.max(0, x.parrafos - 1),
        sabidos: Math.max(0, x.sabidos - (u.tapados - u.fallos)),
        fallados: Math.max(0, x.fallados - u.fallos),
        notas: { ...x.notas, [u.grade]: Math.max(0, x.notas[u.grade] - 1) },
      }))
      setFin(null)
      onCambio?.()
      if (r.parrafo) mostrar(r.parrafo)
      else {
        // Se borró después de repasarlo: el repaso se deshace igual y se sigue con el siguiente.
        setOcupado(false)
        await cargarSiguiente(sesion)
      }
    } catch (e) {
      // Nada que deshacer en el servidor: la pila de aquí ya no vale.
      if ((e as { status?: number }).status === 409) setPila([])
      setError(e instanceof Error ? e.message : 'No se pudo deshacer el repaso')
    } finally {
      setOcupado(false)
    }
  }, [sesion, ocupado, pila, grupoId, onCambio, mostrar, cargarSiguiente])

  const borrar = async () => {
    if (!parrafo || !sesion) return
    if (!window.confirm('¿Borrar este párrafo del grupo? Queda 24 horas en la papelera.')) return
    setOcupado(true)
    try {
      await quitarParrafo(grupoId, parrafo.itemId)
      onCambio?.()
      setOcupado(false)
      await cargarSiguiente(sesion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar')
      setOcupado(false)
    }
  }

  // Teclado: Espacio destapa; 2/1 responden el hueco destapado; al acabar, 1-4 cambian la nota y
  // Enter (o Espacio) pasa al siguiente; F, el origen; E, editar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editando) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      // Ctrl+Z: deshacer el último repaso (también en la pantalla de fin).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void deshacer()
        return
      }
      if (fin) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (destapado !== null) {
        if (e.key === '2') { e.preventDefault(); contestar('sabia') }
        else if (e.key === '1') { e.preventDefault(); contestar('no') }
        return
      }
      if (listo) {
        if (['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); setNota(Number(e.key) as Nota) }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void pasar() }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        destaparSiguiente()
      }
      if (e.key === 'f' || e.key === 'F') setVerOrigen((v) => !v)
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setEditando(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editando, fin, destapado, listo, contestar, pasar, destaparSiguiente, deshacer])

  const segs = useMemo(() => (parrafo ? segmentos(parrafo.texto, parrafo.huecos) : []), [parrafo])

  if (error && !parrafo && !fin) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}>
        <p className="font-bold text-[#B04A5E]">{error}</p>
        <button type="button" onClick={onSalir} className="mt-3 text-sm font-bold text-[#7D8A96] underline">
          Volver al grupo
        </button>
      </div>
    )
  }

  if (fin) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center" style={{ border: `2px solid ${INK}`, boxShadow: `5px 5px 0 0 ${INK}` }} data-resumen-fin>
        <span className="material-symbols-outlined text-[44px] text-[#5E8C5A]">{fin === 'fin' ? 'celebration' : 'schedule'}</span>
        <p className="mt-1 text-xl font-extrabold text-[#2C3E50]">
          {fin === 'fin' ? 'Sesión terminada' : fin === 'caducada' ? 'La sesión ha caducado' : 'Has llegado al límite de la sesión'}
        </p>
        <p className="mt-1 text-sm text-[#7D8A96]">
          {resumen.parrafos} {resumen.parrafos === 1 ? 'párrafo repasado' : 'párrafos repasados'} · {resumen.sabidos} huecos sabidos · {resumen.fallados} por repasar
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {([1, 2, 3, 4] as Nota[]).map((n) =>
            resumen.notas[n] ? (
              <span key={n} className="rounded-lg px-2 py-0.5 text-xs font-extrabold text-white" style={{ background: COLOR_NOTA[n] }}>
                {resumen.notas[n]} {NOMBRE_NOTA[n]}
              </span>
            ) : null,
          )}
        </div>
        {error && <p className="mt-3 text-sm font-bold text-[#B04A5E]">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {pila.length > 0 && (
            <button
              type="button"
              onClick={() => void deshacer()}
              disabled={ocupado}
              title="Deshacer el último repaso (Ctrl+Z)"
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2C3E50] disabled:opacity-50"
              style={{ border: `2px solid ${INK}` }}
            >
              <span className="material-symbols-outlined align-middle text-[18px]">undo</span> Deshacer el último
            </button>
          )}
          <button
            type="button"
            onClick={() => setVuelta((v) => v + 1)}
            className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-extrabold text-white"
            style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
          >
            Repasar otra vez
          </button>
          <button type="button" onClick={onSalir} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
            Volver al grupo
          </button>
        </div>
      </div>
    )
  }

  if (!parrafo || !estado) {
    return <p className="py-12 text-center text-sm text-[#7D8A96]">Preparando la sesión…</p>
  }

  const pendientes = estado.tapados.filter((k) => !(k in estado.respuestas)).length
  return (
    <div className="flex flex-col gap-4" data-resumen-estudio>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7D8A96]">
        <span className="rounded-lg bg-white px-2 py-1 font-extrabold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
          {parrafo.tema || 'Sin tema'}
        </span>
        <span>
          {resumen.parrafos} hechos · {estado.tapados.length} {estado.tapados.length === 1 ? 'hueco tapado' : 'huecos tapados'}
          {niveles ? ` (${niveles.map((n) => LEVEL_INFO[n].name.toLowerCase()).join(', ')})` : ''}
        </span>
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => void deshacer()}
            disabled={pila.length === 0 || ocupado}
            className="rounded-lg px-2 py-1 font-bold hover:bg-white hover:text-[#2C3E50] disabled:opacity-40 disabled:hover:bg-transparent"
            title="Deshacer el último repaso (Ctrl+Z)"
          >
            <span className="material-symbols-outlined align-middle text-[16px]">undo</span> Deshacer
          </button>
          <button type="button" onClick={() => setVerOrigen((v) => !v)} className="rounded-lg px-2 py-1 font-bold hover:bg-white hover:text-[#2C3E50]" title="Ver de dónde sale (F)">
            <span className="material-symbols-outlined align-middle text-[16px]">source</span> De dónde sale
          </button>
          <button type="button" onClick={() => setEditando(true)} className="rounded-lg px-2 py-1 font-bold hover:bg-white hover:text-[#2C3E50]" title="Editar (E)">
            <span className="material-symbols-outlined align-middle text-[16px]">edit</span> Editar
          </button>
          <button type="button" onClick={() => void borrar()} className="rounded-lg px-2 py-1 font-bold hover:bg-[#FAEAED] hover:text-[#B04A5E]">
            <span className="material-symbols-outlined align-middle text-[16px]">delete</span> Borrar
          </button>
          <button type="button" onClick={onSalir} className="rounded-lg px-2 py-1 font-bold hover:bg-white hover:text-[#2C3E50]">
            Salir
          </button>
        </span>
      </div>

      {verOrigen && (
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-[#2C3E50]" style={{ border: '2px dashed rgba(44,62,80,0.35)' }} data-resumen-origen>
          {parrafo.origen?.name || parrafo.origen?.page ? (
            <>
              <span className="material-symbols-outlined mr-1 align-middle text-[18px] text-[#E8A598]">description</span>
              <b>{parrafo.origen?.name ?? 'Documento'}</b>
              {parrafo.origen?.page ? `, ${parrafo.origen.unit === 'diapositiva' ? 'diapositiva' : 'página'} ${parrafo.origen.page}` : ''}
              <span className="block pt-1 text-xs text-[#7D8A96]">
                {parrafo.modo === 'literal' ? 'Texto original del documento (copiado tal cual).' : 'Resumen hecho por la IA con las palabras del documento.'}
              </span>
            </>
          ) : (
            <span className="text-[#7D8A96]">Este párrafo no tiene documento de origen (escrito a mano).</span>
          )}
        </div>
      )}

      {editando ? (
        <EditorParrafo
          inicial={{ texto: parrafo.texto, huecos: parrafo.huecos, tema: parrafo.tema ?? '' }}
          temas={temas}
          guardando={ocupado}
          onCancelar={() => setEditando(false)}
          onGuardar={async (x) => {
            setOcupado(true)
            try {
              const nuevo = await editarParrafo(parrafo.id, { texto: x.texto, huecos: x.huecos, tema: x.tema || null })
              onCambio?.()
              mostrar({ ...parrafo, ...nuevo, itemId: parrafo.itemId })
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo guardar')
            } finally {
              setOcupado(false)
            }
          }}
        />
      ) : (
        <div
          className="rounded-3xl bg-white px-6 py-6 sm:px-8"
          style={{ border: `2px solid ${INK}`, boxShadow: `5px 5px 0 0 ${INK}` }}
          onClick={(e) => {
            // Tocar el párrafo destapa el siguiente (los huecos y los botones tienen su propio clic).
            if ((e.target as HTMLElement).closest('button')) return
            destaparSiguiente()
          }}
        >
          <p className="text-[1.08rem] leading-[2.15] text-[#2C3E50]" data-resumen-texto>
            {segs.map((s, j) => {
              if (s.k === undefined) return <span key={j}>{s.t}</span>
              const k = s.k
              const h = parrafo.huecos[k]
              const info = LEVEL_INFO[h.n]
              if (!estado.tapados.includes(k)) {
                // De un nivel no elegido: se ve, con el subrayado de su nivel.
                return (
                  <span key={j} style={{ boxShadow: `inset 0 -2px 0 ${info.soft}` }}>
                    {s.t}
                  </span>
                )
              }
              const r = estado.respuestas[k]
              if (r || destapado === k) {
                const color = r === 'sabia' ? '#5E8C5A' : r === 'no' ? '#B04A5E' : info.color
                return (
                  <span
                    key={j}
                    data-hueco={k}
                    data-estado={r ?? 'destapado'}
                    className={`rounded-md px-1 font-bold ${destapado === k ? 'animate-[ra-latido_1.2s_ease-in-out_infinite]' : ''}`}
                    style={{ color, background: r ? `${color}14` : info.soft, boxShadow: `inset 0 -2px 0 ${color}` }}
                  >
                    {s.t}
                    {r ? (
                      <span className="material-symbols-outlined ml-0.5 align-[-3px] text-[15px]" aria-label={r === 'sabia' ? 'Lo sabía' : 'No lo sabía'}>
                        {r === 'sabia' ? 'check' : 'close'}
                      </span>
                    ) : null}
                  </span>
                )
              }
              const esSiguiente = siguienteTapado(estado) === k && destapado === null
              return (
                <button
                  key={j}
                  type="button"
                  data-hueco={k}
                  data-estado="tapado"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (destapado === null) setDestapado(k)
                  }}
                  aria-label={`Hueco tapado, nivel ${info.name}. Destapar`}
                  className="mx-[1px] inline-block rounded-md align-[-2px] transition-transform hover:-translate-y-[1px]"
                  style={{
                    width: `${Math.min(18, Math.max(2.5, s.t.length * 0.55))}em`,
                    height: '1.25em',
                    background: `repeating-linear-gradient(135deg, ${info.soft} 0 6px, #fff 6px 9px)`,
                    border: `2px solid ${esSiguiente ? INK : info.color}`,
                    boxShadow: esSiguiente ? `2px 2px 0 0 ${INK}` : 'none',
                  }}
                />
              )
            })}
          </p>
        </div>
      )}

      {!editando && (
        <div className="flex min-h-[64px] flex-wrap items-center justify-center gap-3">
          {destapado !== null ? (
            <>
              <button
                type="button"
                onClick={() => contestar('no')}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-[#B04A5E]"
                style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span> No lo sabía <kbd className="text-[0.7rem] text-[#7D8A96]">1</kbd>
              </button>
              <button
                type="button"
                onClick={() => contestar('sabia')}
                className="flex items-center gap-2 rounded-2xl bg-[#5E8C5A] px-5 py-3 text-sm font-extrabold text-white"
                style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
              >
                <span className="material-symbols-outlined text-[20px]">check</span> Lo sabía <kbd className="text-[0.7rem] text-white/80">2</kbd>
              </button>
            </>
          ) : !listo ? (
            <button
              type="button"
              onClick={destaparSiguiente}
              className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-6 py-3 text-sm font-extrabold text-white"
              style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              <span className="material-symbols-outlined text-[20px]">visibility</span>
              Destapar {pendientes > 1 ? `(quedan ${pendientes})` : 'el último'} <kbd className="text-[0.7rem] text-white/80">Espacio</kbd>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2" data-resumen-nota={notaFinal}>
              <p className="text-xs font-bold text-[#7D8A96]">
                {fallos === 0 ? 'Todos bien' : fallos === 1 ? 'Un fallo' : `${fallos} fallos`}: nota propuesta <b style={{ color: COLOR_NOTA[propuesta] }}>{NOMBRE_NOTA[propuesta]}</b>. Puedes cambiarla.
              </p>
              <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Nota de repaso">
                {([1, 2, 3, 4] as Nota[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={notaFinal === n}
                    onClick={() => setNota(n)}
                    className="rounded-xl px-3 py-2 text-sm font-extrabold"
                    style={{
                      background: notaFinal === n ? COLOR_NOTA[n] : '#fff',
                      color: notaFinal === n ? '#fff' : COLOR_NOTA[n],
                      border: `2px solid ${notaFinal === n ? INK : COLOR_NOTA[n]}`,
                      boxShadow: notaFinal === n ? `2px 2px 0 0 ${INK}` : 'none',
                    }}
                  >
                    {NOMBRE_NOTA[n]} <kbd className="text-[0.66rem] opacity-70">{n}</kbd>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void pasar()}
                  disabled={ocupado}
                  className="flex items-center gap-1 rounded-xl bg-[#2C3E50] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                  style={{ border: `2px solid ${INK}` }}
                >
                  Siguiente <kbd className="text-[0.66rem] opacity-70">Enter</kbd>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-center text-sm font-bold text-[#B04A5E]">{error}</p>}
      <p className="text-center text-[0.7rem] text-[#7D8A96]">Espacio destapa · 2 lo sabía · 1 no lo sabía · al terminar, 1-4 cambian la nota y Enter sigue · F origen · E editar · Ctrl+Z deshacer</p>
      <style>{`@keyframes ra-latido{0%,100%{filter:none}50%{filter:brightness(1.12)}}`}</style>
    </div>
  )
}
