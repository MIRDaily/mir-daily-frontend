'use client'

/* ════════════════════════════════════════════════════════════════════════
   Memoria de la pestaña: lo que una pantalla quiere encontrarse igual al
   volver (filtros, búsqueda, scroll y sus datos), sin URL ni almacenamiento.
   Vive en el módulo, así que dura mientras la pestaña no se recarga: una
   recarga empieza de cero (y por eso no hay desajustes con el HTML del
   servidor, que siempre pinta el estado inicial). Si cambia el usuario, se
   vacía entera.

   - useEstadoRecordado: un useState que sobrevive a salir y volver.
   - useCargaRecordada: datos que se enseñan al instante con lo último que se
     tuvo y se refrescan siempre por detrás (stale-while-revalidate).
     `deMemoria` dice si había datos al montar: con PaginaConMovimiento,
     `animarEntrada={!deMemoria}` evita repetir la entrada al volver.
   - useScrollRecordado: al entrar en una pantalla, arriba; al volver, donde
     estaba.
   Las claves son globales: prefijarlas con la pantalla («biblioteca:…»).
═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'

const memoria = new Map<string, unknown>()

// Al cerrar sesión ya se recarga la página, pero si alguna vez cambia el usuario sin recargar, no se le
// enseña nada del anterior.
let usuarioActual: string | null | undefined
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((_evento, sesion) => {
    const id = sesion?.user.id ?? null
    if (usuarioActual !== undefined && id !== usuarioActual) memoria.clear()
    usuarioActual = id
  })
}

/** Como useState, pero al volver a la pantalla (sin recargar) recupera el último valor. Clave fija por componente. */
export function useEstadoRecordado<T>(clave: string, inicial: T): [T, Dispatch<SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => (memoria.has(clave) ? (memoria.get(clave) as T) : inicial))
  useEffect(() => {
    memoria.set(clave, valor)
  }, [clave, valor])
  return [valor, setValor]
}

type EstadoCarga<T> = { clave: string; datos: T | undefined; error: unknown; deMemoria: boolean }

const leer = <T,>(clave: string): EstadoCarga<T> => ({
  clave,
  datos: memoria.get(clave) as T | undefined,
  error: null,
  deMemoria: memoria.has(clave),
})

export type CargaRecordada<T> = {
  /** undefined mientras llega la primera vez. */
  datos: T | undefined
  /** El último fallo al pedir (puede haber datos de memoria a la vez). */
  error: unknown
  /** Había datos en memoria al montar: la pantalla puede pintarse ya hecha, sin entrada. */
  deMemoria: boolean
  recargar: () => void
  /** Cambio local (tras mover o borrar algo): actualiza la pantalla y la memoria, y descarta respuestas en vuelo. */
  mutar: (cambio: (datos: T) => T) => void
}

/**
 * Datos con memoria: al montar enseña lo último que se tuvo para `clave` y vuelve a pedir siempre por
 * detrás. `cargar` puede cambiar en cada render (se usa la última); lo que manda es `clave`.
 */
export function useCargaRecordada<T>(clave: string, cargar: () => Promise<T>): CargaRecordada<T> {
  const [estado, setEstado] = useState<EstadoCarga<T>>(() => leer<T>(clave))
  // Otra clave (otra asignatura con la misma pantalla montada): se empieza por lo que haya de ella.
  if (estado.clave !== clave) setEstado(leer<T>(clave))
  const [vuelta, setVuelta] = useState(0)
  const cargarActual = useRef(cargar)
  // Cada cambio local invalida las respuestas que estaban en camino (traerían la lista de antes).
  const generacion = useRef(0)

  useEffect(() => {
    cargarActual.current = cargar
  })

  useEffect(() => {
    let vivo = true
    const gen = generacion.current
    cargarActual.current().then(
      (d) => {
        if (gen !== generacion.current) return
        memoria.set(clave, d)
        if (vivo) setEstado((e) => (e.clave === clave ? { ...e, datos: d, error: null } : e))
      },
      (err: unknown) => {
        if (vivo) setEstado((e) => (e.clave === clave ? { ...e, error: err ?? new Error('No se pudo cargar') } : e))
      },
    )
    return () => {
      vivo = false
    }
  }, [clave, vuelta])

  const recargar = useCallback(() => setVuelta((v) => v + 1), [])
  const mutar = useCallback((cambio: (datos: T) => T) => {
    generacion.current += 1
    setEstado((e) => {
      if (e.datos === undefined) return e
      const d = cambio(e.datos)
      memoria.set(e.clave, d)
      return { ...e, datos: d }
    })
  }, [])

  return { datos: estado.datos, error: estado.error, deMemoria: estado.deMemoria, recargar, mutar }
}

/** Dónde empieza la pantalla en el documento: lo de encima (la cabecera y sus migas) cambia de alto. */
function inicioDe(raiz: HTMLElement | null) {
  return raiz ? raiz.getBoundingClientRect().top + window.scrollY : 0
}

/** Lo que se guarda del scroll: el del documento y el de dentro de la página (desde su `<main>`). */
type PosicionScroll = { y: number; dentro: number }

/** Cuánto se vigila, tras restaurar, que nada mueva la posición (el navegador o la cabecera). */
const VIGILANCIA_MS = 400

// Para saber si a una pantalla se ENTRA o se VUELVE: la última que se fue (y cuándo), el último «atrás» o
// «adelante» del navegador, y si todavía no se ha montado ninguna desde que se cargó el documento.
let salida: { ruta: string; en: number } | null = null
let documentoRecienCargado = true
/** Cuándo fue el último «atrás»/«adelante» aún sin usar: solo vale para la navegación que lo provoca. */
let historialPendiente: number | null = null
if (typeof window !== 'undefined') {
  // En captura: el router de Next también escucha `popstate` y pinta la pantalla dentro de su manejador;
  // así esta marca ya está puesta cuando la pantalla nueva decide.
  window.addEventListener(
    'popstate',
    () => {
      historialPendiente = performance.now()
    },
    { capture: true },
  )
}

/** ¿Esta navegación viene del «atrás»/«adelante» del navegador? Se consume: la siguiente ya no. */
function vieneDelHistorial(ahora: number) {
  const reciente = historialPendiente !== null && ahora - historialPendiente < 1000
  historialPendiente = null
  return reciente
}

/** La pantalla es la que abrió el documento (recarga o enlace directo): ahí el scroll lo pone el navegador. */
function esLaDelDocumento() {
  const [carga] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  return documentoRecienCargado && !!carga && carga.name === window.location.href
}

/**
 * El scroll de una pantalla, como en una app (devuelve la `ref` que se pone en el `<main>` de la pantalla): al ENTRAR en ella (desde la galería, el menú o un enlace)
 * empieza arriba del todo; al VOLVER (el «atrás» del navegador, o desde una de sus subpáginas, p. ej. de una
 * asignatura a la galería) queda donde se dejó, en cuanto `listo` (el contenido ya tiene su altura). La
 * primera pantalla tras recargar o abrir un enlace la deja el navegador.
 * Hace falta porque el router no siempre sube al cambiar de página: sin esto, al entrar en una asignatura
 * desde la galería desplazada se heredaba su scroll y el título quedaba bajo la cabecera.
 * La posición se guarda al salir (en la limpieza del efecto de layout, que corre antes de quitar la página
 * del DOM, cuando el scroll aún es el del usuario), respecto al principio de la página y no del documento:
 * al volver de una asignatura, la barra de migas de la cabecera desaparece un instante después y movería
 * todo. Si algo la mueve en las primeras décimas de segundo (eso, o el navegador restaurando el historial
 * por su cuenta), se recoloca.
 */
export function useScrollRecordado(clave: string, listo: boolean): RefObject<HTMLElement | null> {
  const ruta = usePathname()
  /** La raíz de la pantalla (su `<main>`): la posición se mide desde ahí. */
  const raiz = useRef<HTMLElement | null>(null)
  // Se mide en el momento, también al salir: React suelta la ref de la raíz después de limpiar el layout de
  // quien la pinta, y la raíz puede cambiar (el `<main>` de carga deja paso al de contenido).
  const inicio = useCallback(() => inicioDe(raiz.current), [])
  const claveScroll = `scroll:${clave}`
  /** null hasta el primer montaje; luego, si se ha vuelto a la pantalla (true) o se ha entrado (false). */
  const vuelve = useRef<boolean | null>(null)
  /** Solo se guarda una pantalla ya pintada: antes, su scroll no es el que el usuario ha visto. */
  const lista = useRef(false)

  // En layout: decide y sube antes de pintar. La pantalla que se va se limpia en el mismo commit, antes que
  // este montaje, así que `salida` ya dice de dónde se viene. Se decide una sola vez: el modo estricto de
  // React repite el montaje (y su limpieza de prueba guarda justo la posición recién restaurada).
  useLayoutEffect(() => {
    if (vuelve.current === null) {
      const ahora = performance.now()
      const anterior = salida && ahora - salida.en < 1000 ? salida.ruta : null
      const porHistorial = vieneDelHistorial(ahora)
      vuelve.current = porHistorial || (anterior !== null && anterior.startsWith(`${ruta}/`))
      const delDocumento = esLaDelDocumento()
      documentoRecienCargado = false
      if (!vuelve.current && !delDocumento) window.scrollTo({ top: 0, behavior: 'instant' })
    }
    return () => {
      if (lista.current) memoria.set(claveScroll, { y: window.scrollY, dentro: window.scrollY - inicio() } satisfies PosicionScroll)
      salida = { ruta, en: performance.now() }
    }
  }, [ruta, claveScroll, inicio])

  // Restaurar dos veces no mueve nada: el modo estricto puede repetirlo.
  useEffect(() => {
    lista.current = listo
    if (!listo || !vuelve.current) return
    const guardada = memoria.get(claveScroll) as PosicionScroll | undefined
    if (!guardada) return
    const colocar = () => {
      // A media página, respecto a su principio (la cabecera puede cambiar de alto entre medias). Viendo el
      // principio de la página (dentro ≤ 0, su arranque aún bajo la cabecera), el scroll tal cual: en esa
      // zona el navegador no compensa los cambios de la cabecera y la medida relativa engañaría.
      const destino = guardada.dentro > 0 ? guardada.dentro + inicio() : guardada.y
      if (Math.abs(window.scrollY - destino) > 1) window.scrollTo({ top: destino, behavior: 'instant' })
    }
    colocar()
    // Durante un rato, si algo la mueve (el navegador restaura por su cuenta el scroll del historial al ir
    // «atrás», o desaparece la barra de migas de la cabecera), se vuelve a colocar. Cada comprobación va a
    // la vez por fotograma (antes de pintar) y por temporizador (si no hay fotogramas: pestaña en segundo
    // plano); corre la que llegue antes. Si el usuario toca la rueda, la pantalla o el teclado, se le deja.
    const fin = performance.now() + VIGILANCIA_MS
    let fotograma = 0
    let temporizador = 0
    const parar = () => {
      cancelAnimationFrame(fotograma)
      window.clearTimeout(temporizador)
    }
    const siguiente = () => {
      const tic = () => {
        parar()
        colocar()
        if (performance.now() < fin) siguiente()
      }
      fotograma = requestAnimationFrame(tic)
      temporizador = window.setTimeout(tic, 20)
    }
    const gestos = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    gestos.forEach((g) => window.addEventListener(g, parar, { passive: true, once: true }))
    siguiente()
    return () => {
      parar()
      gestos.forEach((g) => window.removeEventListener(g, parar))
    }
  }, [claveScroll, listo, inicio])

  return raiz
}
