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
import { anuncioEstudio, etiquetaHueco, GRIS_AA, NIVEL_CORTO, ROJO_KO, TINTA_NIVEL, VERDE_OK } from '@/lib/resumenes/accesible'
import { progresoDeslizar, respuestaDeslizar, type Deslizar } from '@/lib/resumenes/gestos'
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
import { hojaApuntes, SOLO_TECLADO } from './ui'

// Estudio de un grupo de resúmenes activos. Cada párrafo sale con sus huecos TAPADOS (solo los de los
// niveles elegidos; los demás se ven; en «solo huecos fallados», solo los que la última vez no se
// sabían). Espacio o tocar destapa el siguiente; en cada hueco, «Lo sabía» o «No lo sabía» (teclas 2 y 1,
// o con el dedo: DESLIZAR la tarjeta a la derecha o a la izquierda). Con «Escribir la respuesta», antes
// de destaparlo se escribe y se propone la respuesta (Enter la acepta). Un hueco contestado se corrige
// tocándolo (o Retroceso reabre el último) y la nota se recalcula. Al acabar el párrafo se propone la
// nota de repaso (todos bien = Bien; uno mal = Difícil; más = Otra vez) y se puede cambiar (1-4) antes de
// pasar al siguiente (Enter). «Ver de dónde sale» (F), editar (E) y borrar sin salir de la sesión.
// «Deshacer» (Ctrl+Z) vuelve atrás el último repaso (también desde la pantalla de fin: la sesión se
// reabre). Al terminar, una celebración, los párrafos fallados con sus huecos, cuándo vuelve cada uno y
// «Repasar ahora» los que siguen fallados.
//
// En el móvil: los botones grandes van fijos abajo (al alcance del pulgar), las herramientas son
// iconos de 44 px y no salen las pistas de teclado. La tarjeta es una hoja de apuntes (ui.tsx), la
// barra de arriba dice por dónde vas y las animaciones respetan «reducir movimiento». Un lector de
// pantalla oye cada paso (región aria-live) y cada hueco dice si está tapado, destapado, sabido o fallado.

// Colores de las notas con texto blanco encima: los de la tinta AA de los niveles.
const COLOR_NOTA: Record<Nota, string> = { 1: ROJO_KO, 2: TINTA_NIVEL[3], 3: VERDE_OK, 4: TINTA_NIVEL[2] }
const AMBAR = TINTA_NIVEL[3]
const LINEA = 2.15
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
      enterKeyHint="done"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={120}
      aria-label={`Escribe lo que va en el hueco (nivel ${LEVEL_INFO[nivel].name}) y pulsa Intro`}
      placeholder="…"
      data-escribir
      className="mx-[1px] inline-block rounded-md bg-white px-1.5 align-baseline text-[16px] font-bold text-[#2C3E50] outline-none sm:text-[0.95em]"
      style={{ width: ancho, minWidth: '5em', height: '1.6em', border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
    />
  )
}

/** Una herramienta de la barra de arriba: icono de 44 px en el móvil, con su nombre desde sm. */
function Herramienta({ icono, nombre, onClick, disabled, peligro, title }: { icono: string; nombre: string; onClick: () => void; disabled?: boolean; peligro?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? nombre}
      aria-label={nombre}
      className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl px-2 font-bold disabled:opacity-40 sm:min-h-[36px] sm:min-w-0 ${
        peligro ? 'hover:bg-[#FAEAED] hover:text-[#8E3346]' : 'hover:bg-white hover:text-[#2C3E50]'
      }`}
      style={{ color: GRIS_AA }}
    >
      <span className="material-symbols-outlined text-[20px] sm:text-[16px]" aria-hidden>
        {icono}
      </span>
      <span className="hidden sm:inline">{nombre}</span>
    </button>
  )
}

/** Confeti de papelitos con borde de tinta (determinista: nada de Math.random en el render). */
function Confeti() {
  const colores = ['#E8A598', '#5E8C5A', '#3F7EA6', '#B07A1E', '#B04A5E', '#F2D492']
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-[2px] opacity-0 motion-safe:animate-[ra-confeti_1.6s_ease-out_forwards] motion-reduce:hidden"
          style={{
            left: `${(i * 53) % 100}%`,
            background: colores[i % colores.length],
            border: `1.5px solid ${INK}`,
            animationDelay: `${(i % 6) * 70}ms`,
            ['--ra-x' as string]: `${((i * 37) % 60) - 30}px`,
            ['--ra-r' as string]: `${((i * 71) % 540) - 270}deg`,
          }}
        />
      ))}
    </div>
  )
}

export function EstudioResumen({
  grupoId,
  ajustes,
  vista = { escribir: false, anchoFijo: false },
  temas,
  total,
  onSalir,
  onCambio,
}: {
  grupoId: string
  ajustes: AjustesEstudio
  /** Cómo se estudia (solo de la pantalla): escribir la respuesta, cajas de ancho fijo. */
  vista?: Vista
  temas: string[]
  /** Cuántos párrafos se esperan en la sesión (para la barra de progreso; puede crecer con las repeticiones). */
  total?: number
  onSalir: () => void
  /** Algo ha cambiado en el grupo (editado, borrado, repasado): la lista se recarga al salir. */
  onCambio?: () => void
}) {
  // Los ajustes de la vuelta en curso: los elegidos, o los de «Repasar ahora» los fallados.
  const [activos, setActivos] = useState<AjustesEstudio>(ajustes)
  const [totalVuelta, setTotalVuelta] = useState(total ?? 0)
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
  const [anuncio, setAnuncio] = useState('')
  // Deslizar con el dedo: cuánto se ha arrastrado la tarjeta (px) mientras se arrastra.
  const [dx, setDx] = useState(0)
  const [anchoTarjeta, setAnchoTarjeta] = useState(320)
  const desde = useRef(Date.now())

  const mostrar = useCallback(
    (p: Parrafo) => {
      const e = empezarParrafo(p.huecos, niveles, activos.soloHuecosFallados ? (p.huecosFallados ?? []) : null)
      setParrafo(p)
      setEstado(e)
      setDestapado(null)
      setEscribiendo(null)
      setPropuestas({})
      setNota(null)
      setVerOrigen(false)
      setEditando(false)
      setDx(0)
      setAnuncio(anuncioEstudio({ tipo: 'parrafo', tapados: e.tapados.length, tema: p.tema }))
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
      setAnuncio(tipo === 'fin' ? 'Sesión terminada.' : tipo === 'caducada' ? 'La sesión ha caducado.' : 'Has llegado al límite de la sesión.')
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
  const respuestaDe = useCallback((k: number) => (parrafo ? parrafo.texto.slice(parrafo.huecos[k].i, parrafo.huecos[k].f) : ''), [parrafo])

  /** Abrir un hueco tapado: destaparlo o, escribiendo, poner la caja para escribir. */
  const abrir = useCallback(
    (k: number) => {
      if (destapado !== null || escribiendo !== null) return
      if (vista.escribir) setEscribiendo(k)
      else {
        setDestapado(k)
        setAnuncio(anuncioEstudio({ tipo: 'destapado', respuesta: respuestaDe(k) }))
      }
    },
    [destapado, escribiendo, vista.escribir, respuestaDe],
  )

  const destaparSiguiente = useCallback(() => {
    if (!estado) return
    const k = siguienteTapado(estado)
    if (k !== null) abrir(k)
  }, [estado, abrir])

  const enviarEscrita = (k: number, texto: string) => {
    if (!parrafo) return
    const c = compararRespuesta(texto, respuestaDe(k))
    setPropuestas((x) => ({ ...x, [k]: { r: propuestaDe(c), c, escrita: texto.trim() } }))
    setEscribiendo(null)
    setDestapado(k)
    setAnuncio(`${anuncioEstudio({ tipo: 'destapado', respuesta: respuestaDe(k) })} Lo que escribiste ${NOMBRE_COMPARACION[c]}.`)
  }

  const contestar = useCallback(
    (r: Respuesta) => {
      if (!estado || destapado === null) return
      const nuevo = responder(estado, destapado, r)
      setEstado(nuevo)
      setDestapado(null)
      setNota(null)
      setDx(0)
      const quedan = nuevo.tapados.filter((k) => !(k in nuevo.respuestas)).length
      setAnuncio(anuncioEstudio({ tipo: 'respondido', respuesta: respuestaDe(destapado), sabia: r === 'sabia', quedan }))
    },
    [estado, destapado, respuestaDe],
  )

  /** Corregir un hueco ya contestado (antes de pasar): «Lo sabía» ↔ «No lo sabía»; la nota se recalcula. */
  const corregir = useCallback(
    (k: number) => {
      if (!estado || destapado !== null || escribiendo !== null) return
      const antes = estado.respuestas[k]
      setEstado(cambiarRespuesta(estado, k))
      setNota(null)
      setAnuncio(`${respuestaDe(k)}: cambiado a «${antes === 'sabia' ? 'No lo sabía' : 'Lo sabía'}».`)
    },
    [estado, destapado, escribiendo, respuestaDe],
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

  const otraVuelta = (a: AjustesEstudio, n: number) => {
    setActivos(a)
    setTotalVuelta(n)
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

  // En el móvil la botonera va fija abajo: el hueco que se abre (destapado o para escribir) se trae a la
  // vista si quedaría debajo de ella o fuera de la pantalla.
  useEffect(() => {
    const k = destapado ?? escribiendo
    if (k === null) return
    const id = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-resumen-estudio] [data-hueco="${k}"]`)
      const barra = document.querySelector<HTMLElement>('[data-botonera]')
      if (!el) return
      const r = el.getBoundingClientRect()
      const tapa = barra && getComputedStyle(barra).position === 'fixed' ? barra.getBoundingClientRect().height : 0
      if (r.bottom > window.innerHeight - tapa - 16 || r.top < 80) {
        const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ block: 'center', behavior: suave ? 'smooth' : 'auto' })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [destapado, escribiendo])

  // Deslizar la tarjeta con el dedo (solo con un hueco destapado): derecha = «Lo sabía», izquierda = «No
  // lo sabía». `touch-action: pan-y` deja desplazar la página en vertical y nos da el movimiento
  // horizontal. Tras deslizar, el «clic» que llega después no destapa nada.
  const tarjeta = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ id: number; x: number; y: number; horizontal: boolean | null } | null>(null)
  const sinClic = useRef(false)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || destapado === null) return
    arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: null }
    setAnchoTarjeta(tarjeta.current?.offsetWidth ?? 320)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    const mx = e.clientX - a.x
    const my = e.clientY - a.y
    if (a.horizontal === null && Math.hypot(mx, my) > 10) a.horizontal = Math.abs(mx) > Math.abs(my)
    if (a.horizontal) setDx(mx)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const a = arrastre.current
    arrastre.current = null
    if (!a || a.id !== e.pointerId || !a.horizontal) return
    sinClic.current = true
    window.setTimeout(() => (sinClic.current = false), 350)
    const r: Deslizar = respuestaDeslizar(e.clientX - a.x, e.clientY - a.y, anchoTarjeta)
    if (r) contestar(r)
    else setDx(0)
  }
  const onPointerCancel = () => {
    arrastre.current = null
    setDx(0)
  }

  const segs = useMemo(() => (parrafo ? segmentos(parrafo.texto, parrafo.huecos) : []), [parrafo])

  if (error && !parrafo && !fin) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}>
        <p className="font-bold text-[#8E3346]">{error}</p>
        <button type="button" onClick={onSalir} className="mt-3 min-h-[44px] text-sm font-bold underline" style={{ color: GRIS_AA }}>
          Volver al grupo
        </button>
      </div>
    )
  }

  const vivo = (
    <p className="sr-only" aria-live="polite" role="status" data-anuncio>
      {anuncio}
    </p>
  )

  if (fin) {
    const siguen = (falladosFin ?? []).filter((p) => (p.huecosFallados ?? []).length > 0)
    const huecosTot = resumen.sabidos + resumen.fallados
    const acierto = huecosTot ? Math.round((resumen.sabidos / huecosTot) * 100) : null
    return (
      <div className="relative overflow-hidden rounded-3xl bg-white p-5 sm:p-6" style={{ border: `2px solid ${INK}`, boxShadow: `5px 5px 0 0 ${INK}` }} data-resumen-fin>
        {vivo}
        {fin === 'fin' && resumen.parrafos > 0 && <Confeti />}
        <div className="relative text-center">
          {fin === 'fin' && resumen.parrafos > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/img/mascota/celebracion.png"
              alt=""
              width={112}
              height={112}
              className="mx-auto h-28 w-28 object-contain motion-safe:animate-[ra-salto_0.7s_ease-out]"
              data-mascota-fin
            />
          ) : (
            <span className="material-symbols-outlined text-[44px]" style={{ color: VERDE_OK }} aria-hidden>
              {fin === 'fin' ? 'celebration' : 'schedule'}
            </span>
          )}
          <p className="mt-1 text-xl font-extrabold text-[#2C3E50]">
            {fin === 'fin' ? (resumen.parrafos > 0 ? '¡Sesión terminada!' : 'Sesión terminada') : fin === 'caducada' ? 'La sesión ha caducado' : 'Has llegado al límite de la sesión'}
          </p>
          <div className="mx-auto mt-3 grid max-w-md grid-cols-3 gap-2" data-fin-cifras>
            {[
              { n: resumen.parrafos, t: resumen.parrafos === 1 ? 'párrafo' : 'párrafos' },
              { n: resumen.sabidos, t: 'huecos sabidos' },
              { n: acierto === null ? '—' : `${acierto} %`, t: 'de acierto' },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl bg-[#FAF7F4] px-2 py-2" style={{ border: '2px solid rgba(44,62,80,0.12)' }}>
                <p className="text-2xl font-black tabular-nums text-[#2C3E50]">{c.n}</p>
                <p className="text-[11px] font-bold" style={{ color: GRIS_AA }}>
                  {c.t}
                </p>
              </div>
            ))}
          </div>
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
          <p className="mt-5 text-center text-xs" style={{ color: GRIS_AA }}>
            Buscando los huecos fallados…
          </p>
        ) : falladosFin.length > 0 ? (
          <div className="mt-5" data-resumen-fallados>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GRIS_AA }}>
              {falladosFin.length === 1 ? 'El párrafo que has fallado' : `Los ${falladosFin.length} párrafos que has fallado`}
            </p>
            <ul className="mt-2 flex max-h-[46vh] flex-col gap-2 overflow-y-auto pr-1">
              {falladosFin.map((p) => {
                const ahora = new Set(p.huecosFallados ?? [])
                const enSesion = new Set(p.huecosFalladosSesion)
                return (
                  <li key={p.itemId} className="rounded-2xl bg-[#FAF7F4] px-4 py-3" style={{ border: '2px solid rgba(44,62,80,0.15)' }} data-fallado={p.itemId}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[0.72rem] font-bold">
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[#2C3E50]" style={{ border: `1.5px solid ${INK}` }}>
                        {p.tema || 'Sin tema'}
                      </span>
                      {ahora.size > 0 ? (
                        <span style={{ color: ROJO_KO }}>{ahora.size === 1 ? 'Sigue fallado 1 hueco' : `Siguen fallados ${ahora.size} huecos`}</span>
                      ) : (
                        <span style={{ color: VERDE_OK }}>Recuperado al repetirlo</span>
                      )}
                      <span className="ml-auto" style={{ color: GRIS_AA }} data-vuelve>
                        <span className="material-symbols-outlined align-[-3px] text-[14px]" aria-hidden>
                          event_repeat
                        </span>{' '}
                        Vuelve {cuandoVuelve(p.nextDueAt)}
                      </span>
                    </div>
                    <p className="text-[0.92rem] leading-[1.75] text-[#2C3E50]">
                      {segmentos(p.texto, p.huecos).map((s, j) => {
                        if (s.k === undefined) return <span key={j}>{s.t}</span>
                        const fallado = enSesion.has(s.k)
                        const sigue = ahora.has(s.k)
                        const color = sigue ? ROJO_KO : fallado ? AMBAR : 'rgba(44,62,80,0.35)'
                        return (
                          <span
                            key={j}
                            className={fallado ? 'rounded px-0.5 font-bold' : ''}
                            style={{ color: fallado ? color : undefined, background: fallado ? `${color}14` : undefined, boxShadow: `inset 0 -2px 0 ${color}` }}
                            title={sigue ? 'No lo sabías' : fallado ? 'Lo fallaste y luego lo supiste' : undefined}
                          >
                            {s.t}
                            {fallado && <span className="sr-only">{sigue ? ' (no lo sabías)' : ' (lo fallaste y luego lo supiste)'}</span>}
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
          <p className="mt-5 text-center text-sm font-bold" style={{ color: VERDE_OK }}>
            Ningún hueco fallado en esta sesión.
          </p>
        ) : null}

        {error && <p className="mt-3 text-center text-sm font-bold text-[#8E3346]">{error}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {siguen.length > 0 && (
            <button
              type="button"
              onClick={() => otraVuelta(repasarAhora(ajustes, siguen.map((p) => p.itemId)), siguen.length)}
              className="min-h-[48px] rounded-xl px-4 py-2 text-sm font-extrabold text-white"
              style={{ background: ROJO_KO, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
              data-repasar-ahora
            >
              Repasar ahora {siguen.length === 1 ? 'el fallado' : `los ${siguen.length} fallados`}
            </button>
          )}
          <button
            type="button"
            onClick={() => otraVuelta(ajustes, total ?? 0)}
            className="min-h-[48px] rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-extrabold text-[#2C3E50]"
            style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
          >
            Repasar otra vez
          </button>
          {pila.length > 0 && (
            <button
              type="button"
              onClick={() => void deshacer()}
              disabled={ocupado}
              title="Deshacer el último repaso (Ctrl+Z)"
              className="flex min-h-[48px] items-center justify-center gap-1 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2C3E50] disabled:opacity-50"
              style={{ border: `2px solid ${INK}` }}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                undo
              </span>
              Deshacer el último
            </button>
          )}
          <button type="button" onClick={onSalir} className="min-h-[48px] rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
            Volver al grupo
          </button>
        </div>
        <style>{ESTILOS}</style>
      </div>
    )
  }

  if (!parrafo || !estado) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: GRIS_AA }}>
        Preparando la sesión…
      </p>
    )
  }

  const pendientes = estado.tapados.filter((k) => !(k in estado.respuestas)).length
  const prop = destapado !== null ? propuestas[destapado] : undefined
  const origen = parrafo.origen
  const totalBarra = Math.max(totalVuelta, resumen.parrafos + 1)
  const hechoPct = Math.min(100, ((resumen.parrafos + (listo ? 1 : estado.tapados.length ? (estado.tapados.length - pendientes) / estado.tapados.length : 0)) / totalBarra) * 100)
  const sello = progresoDeslizar(dx, anchoTarjeta)

  return (
    <div className="flex flex-col gap-3 pb-44 sm:gap-4 sm:pb-0" data-resumen-estudio>
      {vivo}
      {/* ── Por dónde vas ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3" data-progreso>
        <div
          className="relative h-4 flex-1 overflow-hidden rounded-full bg-white"
          style={{ border: `2px solid ${INK}` }}
          role="progressbar"
          aria-label="Progreso de la sesión"
          aria-valuemin={0}
          aria-valuemax={totalBarra}
          aria-valuenow={resumen.parrafos}
          aria-valuetext={`${resumen.parrafos} de ${totalBarra} párrafos`}
        >
          <div
            className="h-full motion-safe:transition-[width] motion-safe:duration-500"
            style={{
              width: `${hechoPct}%`,
              background: 'repeating-linear-gradient(135deg, #E8A598 0 8px, #EDB6AA 8px 14px)',
              borderRight: hechoPct > 0 && hechoPct < 100 ? `2px solid ${INK}` : undefined,
            }}
          />
        </div>
        <span className="shrink-0 text-xs font-black tabular-nums text-[#2C3E50]">
          {Math.min(resumen.parrafos + 1, totalBarra)} / {totalBarra}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: GRIS_AA }}>
        <span className="max-w-full truncate rounded-lg bg-white px-2 py-1 font-extrabold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
          {parrafo.tema || 'Sin tema'}
        </span>
        <span>
          {estado.tapados.length} {estado.tapados.length === 1 ? 'hueco tapado' : 'huecos tapados'}
          {niveles ? ` (${niveles.map((n) => LEVEL_INFO[n].name.toLowerCase()).join(', ')})` : ''}
          {activos.soloHuecosFallados ? ' · solo los fallados' : ''}
        </span>
        <span className="ml-auto flex">
          <Herramienta icono="undo" nombre="Deshacer" title="Deshacer el último repaso (Ctrl+Z)" onClick={() => void deshacer()} disabled={pila.length === 0 || ocupado} />
          <Herramienta icono="source" nombre="De dónde sale" title="Ver de dónde sale (F)" onClick={() => setVerOrigen((v) => !v)} />
          <Herramienta icono="edit" nombre="Editar" title="Editar (E)" onClick={() => setEditando(true)} />
          <Herramienta icono="delete" nombre="Borrar" onClick={() => void borrar()} peligro />
          <Herramienta icono="close" nombre="Salir" onClick={onSalir} />
        </span>
      </div>

      {verOrigen && (
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-[#2C3E50]" style={{ border: '2px dashed rgba(44,62,80,0.35)' }} data-resumen-origen>
          {origen?.name || origen?.page || origen?.fragmento ? (
            <>
              <span className="material-symbols-outlined mr-1 align-middle text-[18px] text-[#E8A598]" aria-hidden>
                description
              </span>
              <b>{origen?.name ?? 'Documento'}</b>
              {origen?.page ? `, ${origen.unit === 'diapositiva' ? 'diapositiva' : 'página'} ${origen.page}` : ''}
              {parrafo.modo === 'literal' ? (
                <span className="block pt-1 text-xs" style={{ color: GRIS_AA }}>
                  Texto original del documento (copiado tal cual): el párrafo es el propio texto.
                </span>
              ) : origen?.fragmento ? (
                <>
                  <span className="block pt-1 text-xs" style={{ color: GRIS_AA }}>
                    Resumen hecho por la IA con las palabras del documento. Lo que dice el documento ahí:
                  </span>
                  <blockquote className="mt-1.5 rounded-xl bg-[#FAF7F4] px-3 py-2 text-[0.85rem] italic leading-relaxed text-[#2C3E50]" style={{ borderLeft: '4px solid #E8A598' }} data-resumen-fragmento>
                    «{origen.fragmento}»
                  </blockquote>
                </>
              ) : (
                <span className="block pt-1 text-xs" style={{ color: GRIS_AA }}>
                  Resumen hecho por la IA con las palabras del documento.
                </span>
              )}
            </>
          ) : (
            <span style={{ color: GRIS_AA }}>Este párrafo no tiene documento de origen (escrito a mano).</span>
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
        <div className="relative">
          {/* Sellos al deslizar: se ven más cuanto más se arrastra. */}
          {sello.hacia && (
            <span
              aria-hidden
              className={`pointer-events-none absolute top-4 z-10 rotate-[-8deg] rounded-xl px-3 py-1 text-sm font-black uppercase tracking-wide text-white ${sello.hacia === 'sabia' ? 'left-4' : 'right-4'}`}
              style={{ background: sello.hacia === 'sabia' ? VERDE_OK : ROJO_KO, border: `2px solid ${INK}`, opacity: sello.fuerza }}
            >
              {sello.hacia === 'sabia' ? '✓ Lo sabía' : '✗ No lo sabía'}
            </span>
          )}
          <div
            ref={tarjeta}
            key={parrafo.itemId}
            className="relative rounded-3xl py-6 pl-10 pr-5 motion-safe:animate-[ra-entrada_0.35s_ease-out] sm:py-7 sm:pl-12 sm:pr-8"
            style={{
              ...hojaApuntes(LINEA),
              border: `2px solid ${INK}`,
              boxShadow: `5px 5px 0 0 ${INK}`,
              touchAction: 'pan-y',
              transform: dx ? `translateX(${dx * 0.55}px) rotate(${dx / 45}deg)` : undefined,
              transition: dx ? 'none' : 'transform 0.2s ease-out',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClick={(e) => {
              // Tocar el párrafo destapa el siguiente (los huecos y los botones tienen su propio clic).
              if (sinClic.current || (e.target as HTMLElement).closest('button, input')) return
              destaparSiguiente()
            }}
            data-tarjeta-estudio
          >
            <p className="text-[1.08rem] text-[#2C3E50] sm:text-[1.12rem]" style={{ lineHeight: LINEA }} data-resumen-texto>
              {segs.map((s, j) => {
                if (s.k === undefined) return <span key={j}>{s.t}</span>
                const k = s.k
                const h = parrafo.huecos[k]
                const info = LEVEL_INFO[h.n]
                if (!estado.tapados.includes(k)) {
                  // De un nivel no elegido (o no fallado): se ve, con el subrayado de su nivel.
                  return (
                    <span key={j} style={{ boxShadow: `inset 0 -2px 0 ${info.soft}` }} title={etiquetaHueco('visible', h.n, s.t)}>
                      {s.t}
                    </span>
                  )
                }
                const r = estado.respuestas[k]
                if (r) {
                  // Contestado: se corrige tocándolo.
                  const color = r === 'sabia' ? VERDE_OK : ROJO_KO
                  const p = propuestas[k]
                  // Un `span` con papel de botón (no un <button>): una respuesta larga se parte entre líneas
                  // como el resto del texto en vez de convertirse en un bloque.
                  return (
                    <span
                      key={j}
                      role="button"
                      tabIndex={0}
                      data-hueco={k}
                      data-estado={r}
                      onClick={(e) => {
                        e.stopPropagation()
                        corregir(k)
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        e.stopPropagation()
                        corregir(k)
                      }}
                      aria-label={`${etiquetaHueco(r, h.n, s.t)}${p?.escrita ? `. Escribiste «${p.escrita}»` : ''}`}
                      title={`${r === 'sabia' ? 'Lo sabía' : 'No lo sabía'}${p?.escrita ? ` · escribiste «${p.escrita}»` : ''}. Toca para cambiarlo.`}
                      className="cursor-pointer rounded-md px-1 font-bold outline-none [box-decoration-break:clone] focus-visible:ring-2"
                      style={{ color, background: `${color}14`, boxShadow: `inset 0 -2px 0 ${color}`, ['--tw-ring-color' as string]: color }}
                    >
                      {s.t}
                      <span className="material-symbols-outlined ml-0.5 align-[-3px] text-[15px]" aria-hidden>
                        {r === 'sabia' ? 'check' : 'close'}
                      </span>
                    </span>
                  )
                }
                if (destapado === k) {
                  return (
                    <span
                      key={j}
                      data-hueco={k}
                      data-estado="destapado"
                      aria-label={etiquetaHueco('destapado', h.n, s.t)}
                      className="rounded-md px-1 font-bold [box-decoration-break:clone] motion-safe:animate-[ra-destapar_0.45s_ease-out]"
                      style={{ color: TINTA_NIVEL[h.n], background: info.soft, boxShadow: `inset 0 -2px 0 ${info.color}, 0 0 0 2px ${INK}` }}
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
                    aria-label={etiquetaHueco('tapado', h.n, s.t, { escribir: vista.escribir })}
                    className="mx-[1px] inline-flex items-center justify-center rounded-md align-[-3px] transition-transform hover:-translate-y-[1px]"
                    style={{
                      width: anchoCaja(s.t.length, vista.anchoFijo),
                      height: '1.3em',
                      background: `repeating-linear-gradient(135deg, ${info.soft} 0 6px, #fff 6px 9px)`,
                      border: `2px solid ${esSiguiente ? INK : info.color}`,
                      boxShadow: esSiguiente ? `2px 2px 0 0 ${INK}` : 'none',
                    }}
                  >
                    <span className="text-[0.55rem] font-black uppercase leading-none tracking-wide" style={{ color: TINTA_NIVEL[h.n] }} aria-hidden>
                      {NIVEL_CORTO[h.n]}
                    </span>
                  </button>
                )
              })}
            </p>
          </div>
        </div>
      )}

      {!editando && (
        <>
          {prop && (
            <p className="text-center text-xs font-bold" style={{ color: GRIS_AA }} data-comparacion={prop.c}>
              {prop.escrita ? (
                <>
                  Escribiste «<span className="text-[#2C3E50]">{prop.escrita}</span>»: {NOMBRE_COMPARACION[prop.c]}.
                </>
              ) : (
                'No escribiste nada.'
              )}{' '}
              Se propone <b style={{ color: prop.r === 'sabia' ? VERDE_OK : ROJO_KO }}>{prop.r === 'sabia' ? 'Lo sabía' : 'No lo sabía'}</b>
              <span className={SOLO_TECLADO}> (Intro)</span>; puedes cambiarlo.
            </p>
          )}
          {destapado !== null && (
            <p className="hidden text-center text-xs font-bold [@media(pointer:coarse)]:block" style={{ color: GRIS_AA }}>
              Desliza la tarjeta → si lo sabías, ← si no.
            </p>
          )}

          {/* ── Botones: fijos abajo en el móvil, debajo de la tarjeta desde sm ─── */}
          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t-2 bg-[#FAF7F4]/95 px-4 pt-3 backdrop-blur sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
            style={{ borderColor: INK, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            data-botonera
          >
            <div className="mx-auto flex max-w-3xl flex-col items-stretch gap-2 sm:min-h-[64px] sm:items-center sm:justify-center">
              {destapado !== null ? (
                <div className="flex gap-3 sm:justify-center">
                  <button
                    type="button"
                    onClick={() => contestar('no')}
                    className="flex min-h-[56px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-white px-3 py-3 text-base font-extrabold sm:min-h-[48px] sm:flex-none sm:px-5 sm:text-sm"
                    style={{ color: ROJO_KO, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}`, outline: prop?.r === 'no' ? `3px solid ${ROJO_KO}` : undefined, outlineOffset: 2 }}
                    data-responder="no"
                  >
                    <span className="material-symbols-outlined text-[22px]" aria-hidden>
                      close
                    </span>
                    No lo sabía <kbd className={`text-[0.7rem] ${SOLO_TECLADO}`} style={{ color: GRIS_AA }}>1</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => contestar('sabia')}
                    className="flex min-h-[56px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-3 text-base font-extrabold text-white sm:min-h-[48px] sm:flex-none sm:px-5 sm:text-sm"
                    style={{ background: VERDE_OK, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}`, outline: prop?.r === 'sabia' ? `3px solid ${VERDE_OK}` : undefined, outlineOffset: 2 }}
                    data-responder="sabia"
                  >
                    <span className="material-symbols-outlined text-[22px]" aria-hidden>
                      check
                    </span>
                    Lo sabía <kbd className={`text-[0.7rem] text-white/80 ${SOLO_TECLADO}`}>2</kbd>
                  </button>
                </div>
              ) : escribiendo !== null ? (
                <p className="py-3 text-center text-xs font-bold" style={{ color: GRIS_AA }}>
                  Escribe la respuesta y pulsa Intro<span className={SOLO_TECLADO}> (Esc para destaparla sin escribir)</span>.
                </p>
              ) : !listo ? (
                <button
                  type="button"
                  onClick={destaparSiguiente}
                  className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#E8A598] px-6 py-3 text-base font-extrabold text-[#2C3E50] sm:min-h-[48px] sm:w-auto sm:text-sm"
                  style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
                  data-destapar
                >
                  <span className="material-symbols-outlined text-[22px]" aria-hidden>
                    {vista.escribir ? 'edit' : 'visibility'}
                  </span>
                  {vista.escribir ? 'Escribir' : 'Destapar'} {pendientes > 1 ? `(quedan ${pendientes})` : 'el último'}{' '}
                  <kbd className={`text-[0.7rem] ${SOLO_TECLADO}`} style={{ color: '#2C3E50aa' }}>
                    Espacio
                  </kbd>
                </button>
              ) : (
                <div className="flex flex-col items-stretch gap-2 sm:items-center" data-resumen-nota={notaFinal}>
                  <p className="text-center text-xs font-bold" style={{ color: GRIS_AA }}>
                    {fallos === 0 ? 'Todos bien' : fallos === 1 ? 'Un fallo' : `${fallos} fallos`}: nota propuesta <b style={{ color: COLOR_NOTA[propuesta] }}>{NOMBRE_NOTA[propuesta]}</b>
                    <span className="hidden sm:inline">. Puedes cambiarla, o tocar un hueco para corregirlo.</span>
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-2" role="radiogroup" aria-label="Nota de repaso">
                    {([1, 2, 3, 4] as Nota[]).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={notaFinal === n}
                        onClick={() => setNota(n)}
                        className="min-h-[44px] rounded-xl px-1 py-2 text-[13px] font-extrabold sm:px-3 sm:text-sm"
                        style={{
                          background: notaFinal === n ? COLOR_NOTA[n] : '#fff',
                          color: notaFinal === n ? '#fff' : COLOR_NOTA[n],
                          border: `2px solid ${notaFinal === n ? INK : COLOR_NOTA[n]}`,
                          boxShadow: notaFinal === n ? `2px 2px 0 0 ${INK}` : 'none',
                        }}
                      >
                        {NOMBRE_NOTA[n]} <kbd className={`text-[0.66rem] opacity-70 ${SOLO_TECLADO}`}>{n}</kbd>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void pasar()}
                    disabled={ocupado}
                    className="flex min-h-[56px] items-center justify-center gap-1 rounded-2xl bg-[#2C3E50] px-6 py-2 text-base font-extrabold text-white disabled:opacity-60 sm:min-h-[44px] sm:text-sm"
                    style={{ border: `2px solid ${INK}` }}
                    data-siguiente
                  >
                    Siguiente
                    <span className="material-symbols-outlined text-[20px]" aria-hidden>
                      arrow_forward
                    </span>
                    <kbd className={`text-[0.66rem] opacity-70 ${SOLO_TECLADO}`}>Intro</kbd>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {error && <p className="text-center text-sm font-bold text-[#8E3346]">{error}</p>}
      <p className={`text-center text-[0.7rem] ${SOLO_TECLADO} hidden sm:block`} style={{ color: GRIS_AA }}>
        Espacio {vista.escribir ? 'escribe' : 'destapa'} · 2 lo sabía · 1 no lo sabía · tocar un hueco contestado lo cambia · Retroceso reabre el último · al terminar, 1-4 cambian la nota e Intro sigue · F origen · E editar · Ctrl+Z deshacer
      </p>
      <style>{ESTILOS}</style>
    </div>
  )
}

// Las animaciones (todas con `motion-safe:`: con «reducir movimiento» no se ve ninguna).
const ESTILOS = `
@keyframes ra-destapar{0%{opacity:0;filter:blur(5px) brightness(1.3);background-color:#E8A598}55%{opacity:1;filter:none}100%{opacity:1;filter:none}}
@keyframes ra-entrada{0%{opacity:0;transform:translateY(10px) rotate(-.6deg)}100%{opacity:1;transform:none}}
@keyframes ra-confeti{0%{opacity:1;transform:translate(0,-10px) rotate(0)}100%{opacity:0;transform:translate(var(--ra-x),190px) rotate(var(--ra-r))}}
@keyframes ra-salto{0%{transform:translateY(16px) scale(.85)}55%{transform:translateY(-6px) scale(1.04)}100%{transform:none}}
`
