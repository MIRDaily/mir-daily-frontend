'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import {
  cambiarRespuesta,
  empezarParrafo,
  fallos as contarFallos,
  NOMBRE_NOTA,
  notaDeRepaso,
  reabrir,
  responder,
  resultados,
  segmentos,
  siguienteTapado,
  terminado,
  ultimoRespondido,
  type EstadoParrafo,
  type Nivel,
  type Nota,
  type Respuesta,
} from '@/lib/resumenes/huecos'
import { compararRespuesta, propuestaDe, type Comparacion } from '@/lib/resumenes/escribir'
import { cuandoVuelve, repasarAhora, type Vista } from '@/lib/resumenes/sesion'
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
  type ParrafoFallado,
} from '@/lib/resumenes/api'
import { INK } from './ParrafoHuecos'
import { EditorParrafo } from './EditorParrafo'

// Estudio de un grupo de resúmenes activos. Cada párrafo sale con sus huecos TAPADOS (solo los de los
// niveles elegidos; los demás se ven; en «solo huecos fallados», solo los que la última vez no se
// sabían). Espacio o tocar destapa el siguiente; en cada hueco, «Lo sabía» o «No lo sabía» (teclas 2 y 1).
// Con «Escribir la respuesta», antes de destaparlo se escribe y se propone la respuesta (Enter la acepta).
// Un hueco contestado se corrige tocándolo (o Retroceso reabre el último) y la nota se recalcula. Al
// acabar el párrafo se propone la nota de repaso (todos bien = Bien; uno mal = Difícil; más = Otra vez)
// y se puede cambiar (1-4) antes de pasar al siguiente (Enter). «Ver de dónde sale» (F), editar (E) y
// borrar sin salir de la sesión. «Deshacer» (Ctrl+Z) vuelve atrás el último repaso (también desde la
// pantalla de fin: la sesión se reabre). Al terminar, los párrafos fallados con sus huecos, cuándo vuelve
// cada uno y «Repasar ahora» los que siguen fallados.

const COLOR_NOTA: Record<Nota, string> = { 1: '#B04A5E', 2: '#B07A1E', 3: '#5E8C5A', 4: '#3F7EA6' }
const ROJO = '#B04A5E'
const VERDE = '#5E8C5A'
type Resumen = { parrafos: number; sabidos: number; fallados: number; notas: Record<Nota, number> }
/** Un repaso registrado en esta sesión (para descontarlo del resumen al deshacerlo). */
type Hecho = { tapados: number; fallos: number; grade: Nota }
type Propuesta = { r: Respuesta; c: Comparacion; escrita: string }
const resumenVacio = (): Resumen => ({ parrafos: 0, sabidos: 0, fallados: 0, notas: { 1: 0, 2: 0, 3: 0, 4: 0 } })
const NOMBRE_COMPARACION: Record<Comparacion, string> = { igual: 'coincide', casi: 'casi igual (una letra)', distinta: 'no coincide', vacia: 'sin escribir' }

/** Ancho de una caja tapada: fijo (no delata lo largo) o según la respuesta. */
const anchoCaja = (largo: number, fijo: boolean) => (fijo ? '7em' : `${Math.min(18, Math.max(2.5, largo * 0.55))}em`)

/** La caja donde se escribe la respuesta de un hueco (Enter la compara; Esc destapa sin escribir). */
function CajaEscribir({ ancho, nivel, onEnviar, onSaltar }: { ancho: string; nivel: Nivel; onEnviar: (t: string) => void; onSaltar: () => void }) {
  const [t, setT] = useState('')
  return (
    <input
      autoFocus
      value={t}
      onChange={(e) => setT(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          onEnviar(t)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onSaltar()
        }
      }}
      maxLength={120}
      aria-label={`Escribe lo que va en el hueco (nivel ${LEVEL_INFO[nivel].name}) y pulsa Enter`}
      placeholder="…"
      data-escribir
      className="mx-[1px] inline-block rounded-md bg-white px-1.5 align-baseline text-[0.95em] font-bold text-[#2C3E50] outline-none"
      style={{ width: ancho, minWidth: '5em', height: '1.6em', border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
    />
  )
}

export function EstudioResumen({
  grupoId,
  ajustes,
  vista = { escribir: false, anchoFijo: false },
  temas,
  onSalir,
  onCambio,
}: {
  grupoId: string
  ajustes: AjustesEstudio
  /** Cómo se estudia (solo de la pantalla): escribir la respuesta, cajas de ancho fijo. */
  vista?: Vista
  temas: string[]
  onSalir: () => void
  /** Algo ha cambiado en el grupo (editado, borrado, repasado): la lista se recarga al salir. */
  onCambio?: () => void
}) {
  // Los ajustes de la vuelta en curso: los elegidos, o los de «Repasar ahora» los fallados.
  const [activos, setActivos] = useState<AjustesEstudio>(ajustes)
  const niveles: Nivel[] | null = activos.levels && activos.levels.length ? activos.levels : null
  const [sesion, setSesion] = useState<string | null>(null)
  const [parrafo, setParrafo] = useState<Parrafo | null>(null)
  const [estado, setEstado] = useState<EstadoParrafo | null>(null)
  const [destapado, setDestapado] = useState<number | null>(null)
  const [escribiendo, setEscribiendo] = useState<number | null>(null)
  const [propuestas, setPropuestas] = useState<Record<number, Propuesta>>({})
  const [nota, setNota] = useState<Nota | null>(null)
  const [fin, setFin] = useState<null | 'fin' | 'caducada' | 'limite'>(null)
  const [falladosFin, setFalladosFin] = useState<ParrafoFallado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [verOrigen, setVerOrigen] = useState(false)
  const [editando, setEditando] = useState(false)
  const [resumen, setResumen] = useState<Resumen>(resumenVacio)
  const [vuelta, setVuelta] = useState(0)
  const [pila, setPila] = useState<Hecho[]>([])
  const desde = useRef(Date.now())

  const mostrar = useCallback(
    (p: Parrafo) => {
      setParrafo(p)
      setEstado(empezarParrafo(p.huecos, niveles, activos.soloHuecosFallados ? (p.huecosFallados ?? []) : null))
      setDestapado(null)
      setEscribiendo(null)
      setPropuestas({})
      setNota(null)
      setVerOrigen(false)
      setEditando(false)
      desde.current = Date.now()
    },
    // `niveles` sale de `activos`, que no cambia dentro de una vuelta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activos],
  )

  const terminar = useCallback(
    async (s: string, tipo: 'fin' | 'caducada' | 'limite') => {
      setParrafo(null)
      setFin(tipo)
      setFalladosFin(null)
      const r = await terminarSesion(grupoId, s)
      setFalladosFin(r.fallados)
    },
    [grupoId],
  )

  const cargarSiguiente = useCallback(
    async (s: string) => {
      setOcupado(true)
      try {
        const r = await siguiente(grupoId, s)
        if (r.tipo === 'parrafo') mostrar(r.parrafo)
        else void terminar(s, r.tipo)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el siguiente párrafo')
      } finally {
        setOcupado(false)
      }
    },
    [grupoId, mostrar, terminar],
  )

  // Una sola petición de sesión por vuelta: si el efecto se monta dos veces (el modo estricto de React lo
  // hace en desarrollo), la segunda reutiliza la promesa de la primera en vez de abrir otra sesión.
  const arranque = useRef<{ vuelta: number; sesion: Promise<string> } | null>(null)
  useEffect(() => {
    let vivo = true
    setFin(null)
    setFalladosFin(null)
    setResumen(resumenVacio())
    setPila([])
    if (!arranque.current || arranque.current.vuelta !== vuelta) arranque.current = { vuelta, sesion: empezarSesion(grupoId, activos) }
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
    // Una sesión por vuelta («Repasar otra vez» y «Repasar ahora» suman una; los ajustes cambian con ella).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId, vuelta])

  const listo = !!estado && terminado(estado)
  const fallos = estado ? contarFallos(estado) : 0
  const propuesta = notaDeRepaso(fallos)
  const notaFinal = nota ?? propuesta

  /** Abrir un hueco tapado: destaparlo o, escribiendo, poner la caja para escribir. */
  const abrir = useCallback(
    (k: number) => {
      if (destapado !== null || escribiendo !== null) return
      if (vista.escribir) setEscribiendo(k)
      else setDestapado(k)
    },
    [destapado, escribiendo, vista.escribir],
  )

  const destaparSiguiente = useCallback(() => {
    if (!estado) return
    const k = siguienteTapado(estado)
    if (k !== null) abrir(k)
  }, [estado, abrir])

  const enviarEscrita = (k: number, texto: string) => {
    if (!parrafo) return
    const h = parrafo.huecos[k]
    const c = compararRespuesta(texto, parrafo.texto.slice(h.i, h.f))
    setPropuestas((x) => ({ ...x, [k]: { r: propuestaDe(c), c, escrita: texto.trim() } }))
    setEscribiendo(null)
    setDestapado(k)
  }

  const contestar = useCallback(
    (r: Respuesta) => {
      if (!estado || destapado === null) return
      setEstado(responder(estado, destapado, r))
      setDestapado(null)
      setNota(null)
    },
    [estado, destapado],
  )

  /** Corregir un hueco ya contestado (antes de pasar): «Lo sabía» ↔ «No lo sabía»; la nota se recalcula. */
  const corregir = useCallback(
    (k: number) => {
      if (!estado || destapado !== null || escribiendo !== null) return
      setEstado(cambiarRespuesta(estado, k))
      setNota(null)
    },
    [estado, destapado, escribiendo],
  )

  /** Retroceso: el último hueco contestado vuelve a estar destapado y sin respuesta. */
  const reabrirUltimo = useCallback(() => {
    if (!estado || destapado !== null || escribiendo !== null) return
    const k = ultimoRespondido(estado)
    if (k === null) return
    setEstado(reabrir(estado, k))
    setDestapado(k)
    setNota(null)
  }, [estado, destapado, escribiendo])

  const pasar = useCallback(async () => {
    if (!parrafo || !estado || !sesion || !listo || ocupado) return
    setOcupado(true)
    setError(null)
    try {
      if (estado.tapados.length > 0) {
        const r = await registrarRepaso(grupoId, {
          sessionId: sesion,
          deckItemId: parrafo.itemId,
          huecos: resultados(estado, parrafo.huecos),
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
      setFalladosFin(null)
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

  const otraVuelta = (a: AjustesEstudio) => {
    setActivos(a)
    setVuelta((v) => v + 1)
  }

  // Teclado: Espacio destapa; 2/1 responden el hueco destapado (Enter acepta lo propuesto al escribir);
  // Retroceso reabre el último contestado; al acabar, 1-4 cambian la nota y Enter (o Espacio) pasa al
  // siguiente; F, el origen; E, editar. (Mientras se escribe en un hueco, el teclado es de la caja.)
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
      if (fin || escribiendo !== null) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (destapado !== null) {
        if (e.key === '2') { e.preventDefault(); contestar('sabia') }
        else if (e.key === '1') { e.preventDefault(); contestar('no') }
        else if (e.key === 'Enter' && propuestas[destapado]) { e.preventDefault(); contestar(propuestas[destapado].r) }
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        reabrirUltimo()
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
  }, [editando, fin, escribiendo, destapado, propuestas, listo, contestar, pasar, destaparSiguiente, deshacer, reabrirUltimo])

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
    const siguen = (falladosFin ?? []).filter((p) => (p.huecosFallados ?? []).length > 0)
    return (
      <div className="rounded-3xl bg-white p-6" style={{ border: `2px solid ${INK}`, boxShadow: `5px 5px 0 0 ${INK}` }} data-resumen-fin>
        <div className="text-center">
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
        </div>

        {falladosFin === null ? (
          <p className="mt-5 text-center text-xs text-[#7D8A96]">Buscando los huecos fallados…</p>
        ) : falladosFin.length > 0 ? (
          <div className="mt-5" data-resumen-fallados>
            <p className="text-xs font-bold uppercase tracking-wide text-[#7D8A96]">
              {falladosFin.length === 1 ? 'El párrafo que has fallado' : `Los ${falladosFin.length} párrafos que has fallado`}
            </p>
            <ul className="mt-2 flex max-h-[46vh] flex-col gap-2 overflow-y-auto pr-1">
              {falladosFin.map((p) => {
                const ahora = new Set(p.huecosFallados ?? [])
                const enSesion = new Set(p.huecosFalladosSesion)
                return (
                  <li key={p.itemId} className="rounded-2xl bg-[#FAF7F4] px-4 py-3" style={{ border: '2px solid rgba(44,62,80,0.15)' }} data-fallado={p.itemId}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[0.72rem] font-bold">
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[#2C3E50]" style={{ border: `1.5px solid ${INK}` }}>{p.tema || 'Sin tema'}</span>
                      {ahora.size > 0 ? (
                        <span style={{ color: ROJO }}>{ahora.size === 1 ? 'Sigue fallado 1 hueco' : `Siguen fallados ${ahora.size} huecos`}</span>
                      ) : (
                        <span style={{ color: VERDE }}>Recuperado al repetirlo</span>
                      )}
                      <span className="ml-auto text-[#7D8A96]" data-vuelve>
                        <span className="material-symbols-outlined align-[-3px] text-[14px]">event_repeat</span> Vuelve {cuandoVuelve(p.nextDueAt)}
                      </span>
                    </div>
                    <p className="text-[0.92rem] leading-[1.75] text-[#2C3E50]">
                      {segmentos(p.texto, p.huecos).map((s, j) => {
                        if (s.k === undefined) return <span key={j}>{s.t}</span>
                        const fallado = enSesion.has(s.k)
                        const color = ahora.has(s.k) ? ROJO : fallado ? '#B07A1E' : 'rgba(44,62,80,0.35)'
                        return (
                          <span
                            key={j}
                            className={fallado ? 'rounded px-0.5 font-bold' : ''}
                            style={{ color: fallado ? color : undefined, background: fallado ? `${color}14` : undefined, boxShadow: `inset 0 -2px 0 ${color}` }}
                            title={ahora.has(s.k) ? 'No lo sabías' : fallado ? 'Lo fallaste y luego lo supiste' : undefined}
                          >
                            {s.t}
                          </span>
                        )
                      })}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : resumen.parrafos > 0 ? (
          <p className="mt-5 text-center text-sm font-bold text-[#5E8C5A]">Ningún hueco fallado en esta sesión.</p>
        ) : null}

        {error && <p className="mt-3 text-center text-sm font-bold text-[#B04A5E]">{error}</p>}
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
          {siguen.length > 0 && (
            <button
              type="button"
              onClick={() => otraVuelta(repasarAhora(ajustes, siguen.map((p) => p.itemId)))}
              className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
              style={{ background: ROJO, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
              data-repasar-ahora
            >
              Repasar ahora {siguen.length === 1 ? 'el fallado' : `los ${siguen.length} fallados`}
            </button>
          )}
          <button
            type="button"
            onClick={() => otraVuelta(ajustes)}
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
  const prop = destapado !== null ? propuestas[destapado] : undefined
  const origen = parrafo.origen
  return (
    <div className="flex flex-col gap-4" data-resumen-estudio>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7D8A96]">
        <span className="rounded-lg bg-white px-2 py-1 font-extrabold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
          {parrafo.tema || 'Sin tema'}
        </span>
        <span>
          {resumen.parrafos} hechos · {estado.tapados.length} {estado.tapados.length === 1 ? 'hueco tapado' : 'huecos tapados'}
          {niveles ? ` (${niveles.map((n) => LEVEL_INFO[n].name.toLowerCase()).join(', ')})` : ''}
          {activos.soloHuecosFallados ? ' · solo los fallados' : ''}
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
          {origen?.name || origen?.page || origen?.fragmento ? (
            <>
              <span className="material-symbols-outlined mr-1 align-middle text-[18px] text-[#E8A598]">description</span>
              <b>{origen?.name ?? 'Documento'}</b>
              {origen?.page ? `, ${origen.unit === 'diapositiva' ? 'diapositiva' : 'página'} ${origen.page}` : ''}
              {parrafo.modo === 'literal' ? (
                <span className="block pt-1 text-xs text-[#7D8A96]">Texto original del documento (copiado tal cual): el párrafo es el propio texto.</span>
              ) : origen?.fragmento ? (
                <>
                  <span className="block pt-1 text-xs text-[#7D8A96]">Resumen hecho por la IA con las palabras del documento. Lo que dice el documento ahí:</span>
                  <blockquote className="mt-1.5 rounded-xl bg-[#FAF7F4] px-3 py-2 text-[0.85rem] italic leading-relaxed text-[#2C3E50]" style={{ borderLeft: '4px solid #E8A598' }} data-resumen-fragmento>
                    «{origen.fragmento}»
                  </blockquote>
                </>
              ) : (
                <span className="block pt-1 text-xs text-[#7D8A96]">Resumen hecho por la IA con las palabras del documento.</span>
              )}
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
            if ((e.target as HTMLElement).closest('button, input')) return
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
                // De un nivel no elegido (o no fallado): se ve, con el subrayado de su nivel.
                return (
                  <span key={j} style={{ boxShadow: `inset 0 -2px 0 ${info.soft}` }}>
                    {s.t}
                  </span>
                )
              }
              const r = estado.respuestas[k]
              if (r) {
                // Contestado: se corrige tocándolo.
                const color = r === 'sabia' ? VERDE : ROJO
                const p = propuestas[k]
                return (
                  <button
                    key={j}
                    type="button"
                    data-hueco={k}
                    data-estado={r}
                    onClick={(e) => {
                      e.stopPropagation()
                      corregir(k)
                    }}
                    title={`${r === 'sabia' ? 'Lo sabía' : 'No lo sabía'}${p?.escrita ? ` · escribiste «${p.escrita}»` : ''}. Toca para cambiarlo.`}
                    className="rounded-md px-1 font-bold transition-transform hover:-translate-y-[1px]"
                    style={{ color, background: `${color}14`, boxShadow: `inset 0 -2px 0 ${color}` }}
                  >
                    {s.t}
                    <span className="material-symbols-outlined ml-0.5 align-[-3px] text-[15px]" aria-label={r === 'sabia' ? 'Lo sabía' : 'No lo sabía'}>
                      {r === 'sabia' ? 'check' : 'close'}
                    </span>
                  </button>
                )
              }
              if (destapado === k) {
                return (
                  <span
                    key={j}
                    data-hueco={k}
                    data-estado="destapado"
                    className="animate-[ra-latido_1.2s_ease-in-out_infinite] rounded-md px-1 font-bold"
                    style={{ color: info.color, background: info.soft, boxShadow: `inset 0 -2px 0 ${info.color}` }}
                  >
                    {s.t}
                  </span>
                )
              }
              if (escribiendo === k) {
                return (
                  <CajaEscribir
                    key={j}
                    ancho={anchoCaja(s.t.length, vista.anchoFijo)}
                    nivel={h.n}
                    onEnviar={(t) => enviarEscrita(k, t)}
                    onSaltar={() => {
                      setEscribiendo(null)
                      setDestapado(k)
                    }}
                  />
                )
              }
              const esSiguiente = siguienteTapado(estado) === k && destapado === null && escribiendo === null
              return (
                <button
                  key={j}
                  type="button"
                  data-hueco={k}
                  data-estado="tapado"
                  onClick={(e) => {
                    e.stopPropagation()
                    abrir(k)
                  }}
                  aria-label={`Hueco tapado, nivel ${info.name}. ${vista.escribir ? 'Escribir la respuesta' : 'Destapar'}`}
                  className="mx-[1px] inline-block rounded-md align-[-2px] transition-transform hover:-translate-y-[1px]"
                  style={{
                    width: anchoCaja(s.t.length, vista.anchoFijo),
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
        <div className="flex min-h-[64px] flex-col items-center justify-center gap-2">
          {prop && (
            <p className="text-xs font-bold text-[#7D8A96]" data-comparacion={prop.c}>
              {prop.escrita ? (
                <>
                  Escribiste «<span className="text-[#2C3E50]">{prop.escrita}</span>»: {NOMBRE_COMPARACION[prop.c]}.
                </>
              ) : (
                'No escribiste nada.'
              )}{' '}
              Se propone <b style={{ color: prop.r === 'sabia' ? VERDE : ROJO }}>{prop.r === 'sabia' ? 'Lo sabía' : 'No lo sabía'}</b> (Enter); puedes cambiarlo.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {destapado !== null ? (
              <>
                <button
                  type="button"
                  onClick={() => contestar('no')}
                  className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-[#B04A5E]"
                  style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}`, outline: prop?.r === 'no' ? `3px solid ${ROJO}` : undefined, outlineOffset: 2 }}
                  data-responder="no"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span> No lo sabía <kbd className="text-[0.7rem] text-[#7D8A96]">1</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => contestar('sabia')}
                  className="flex items-center gap-2 rounded-2xl bg-[#5E8C5A] px-5 py-3 text-sm font-extrabold text-white"
                  style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}`, outline: prop?.r === 'sabia' ? `3px solid ${VERDE}` : undefined, outlineOffset: 2 }}
                  data-responder="sabia"
                >
                  <span className="material-symbols-outlined text-[20px]">check</span> Lo sabía <kbd className="text-[0.7rem] text-white/80">2</kbd>
                </button>
              </>
            ) : escribiendo !== null ? (
              <p className="text-xs font-bold text-[#7D8A96]">Escribe la respuesta y pulsa Enter (Esc para destaparla sin escribir).</p>
            ) : !listo ? (
              <button
                type="button"
                onClick={destaparSiguiente}
                className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-6 py-3 text-sm font-extrabold text-white"
                style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
              >
                <span className="material-symbols-outlined text-[20px]">{vista.escribir ? 'edit' : 'visibility'}</span>
                {vista.escribir ? 'Escribir' : 'Destapar'} {pendientes > 1 ? `(quedan ${pendientes})` : 'el último'} <kbd className="text-[0.7rem] text-white/80">Espacio</kbd>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2" data-resumen-nota={notaFinal}>
                <p className="text-xs font-bold text-[#7D8A96]">
                  {fallos === 0 ? 'Todos bien' : fallos === 1 ? 'Un fallo' : `${fallos} fallos`}: nota propuesta <b style={{ color: COLOR_NOTA[propuesta] }}>{NOMBRE_NOTA[propuesta]}</b>. Puedes cambiarla, o tocar un hueco para corregirlo.
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
        </div>
      )}
      {error && <p className="text-center text-sm font-bold text-[#B04A5E]">{error}</p>}
      <p className="text-center text-[0.7rem] text-[#7D8A96]">
        Espacio {vista.escribir ? 'escribe' : 'destapa'} · 2 lo sabía · 1 no lo sabía · tocar un hueco contestado lo cambia · Retroceso reabre el último · al terminar, 1-4 cambian la nota y Enter sigue · F origen · E editar · Ctrl+Z deshacer
      </p>
      <style>{`@keyframes ra-latido{0%,100%{filter:none}50%{filter:brightness(1.12)}}`}</style>
    </div>
  )
}
