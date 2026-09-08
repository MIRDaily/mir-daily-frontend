'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '@/providers/AuthProvider'
import { fetchProgress, type ProgressResponse } from '@/services/progressService'
import {
  detectarLogros,
  guardarPendientes,
  guardarReferencia,
  leerPendientes,
  leerReferencia,
  nuevoId,
  referenciaDe,
  type Logro,
} from '@/lib/logros'

type ProgressContextValue = {
  data: ProgressResponse | null
  loading: boolean
  error: string | null
  /** Recargar después de terminar una sesión de estudio. */
  refresh: () => void
  /**
   * Metas cumplidas pendientes de celebrar. Se llenan solas al recargar, pero
   * NO se enseñan hasta que alguien da permiso con `permitirCelebracion`.
   */
  logros: Logro[]
  /**
   * "Ya no estoy en mitad de nada, puedes celebrar".
   *
   * El permiso es explícito a propósito. La alternativa —que cada pantalla
   * avise de que está ocupada— falla en el lado malo: si un modo nuevo se
   * olvida de declararse, interrumpe al usuario en mitad de una pregunta. Así,
   * lo peor que pasa si alguien olvida llamar es que la celebración espera al
   * siguiente momento seguro.
   */
  permitirCelebracion: () => void
  /** Se ha visto: fuera de la cola. */
  cerrarCelebracion: () => void
  /** Quita UN logro de la cola, por identificador. */
  descartarLogro: (id: string) => void
  /** Quita varios de golpe. Lo usa el modal al cerrarse. */
  descartarLogros: (ids: string[]) => void
  /** Hay algo que celebrar Y estamos en un momento en que se puede. */
  celebracionLista: boolean
  /**
   * Dispara logros de mentira para poder mirar las animaciones sin tener que
   * conseguirlos de verdad. NO toca el servidor ni el XP: solo los mete en la
   * cola, como haría la detección normal.
   */
  simularLogro: (que: 'desafio' | 'nivel' | 'rango' | 'racha' | 'todo') => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

/**
 * Nivel, XP, racha y desafíos, compartidos por toda la app.
 *
 * Vive en un provider y no en un hook suelto porque hay al menos dos
 * consumidores simultáneos (la insignia de la cabecera, que sale en cada
 * página, y el bloque del Studio). Con un hook por consumidor serían dos
 * peticiones idénticas en cada navegación, y cada una arrastra una
 * sincronización de desafíos en el servidor.
 */
export function ProgressProvider({ children }: { children: React.ReactNode }) {
  // El provider envuelve la app entera, landings incluidas. Sin esto pedía el
  // progreso también a quien no ha entrado, y se llevaba un 401 en cada visita
  // a la portada.
  const { user } = useAuthContext()
  const userId = user?.id ?? null

  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Arranca con lo que quedara pendiente de una sesión anterior. El
  // inicializador perezoso evita tocar localStorage en el render del servidor.
  const [logros, setLogros] = useState<Logro[]>(() =>
    typeof window === 'undefined' ? [] : leerPendientes(),
  )
  const [permitido, setPermitido] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setData(null)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const nuevo = await fetchProgress(controller.signal)
      setData(nuevo)

      // La primera vez que se ve a este usuario no se celebra nada: solo se
      // toma la foto. Si no, entrar por primera vez dispararía un aluvión de
      // avisos por cosas que no acaba de conseguir.
      const ref = leerReferencia()
      if (ref) {
        const nuevos = detectarLogros(ref, nuevo)
        if (nuevos.length > 0) {
          setLogros((prev) => {
            const cola = [...prev, ...nuevos]
            guardarPendientes(cola)
            return cola
          })
        }
      }
      guardarReferencia(referenciaDe(nuevo))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu progreso.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  const permitirCelebracion = useCallback(() => setPermitido(true), [])

  // La cola de mentira NO se persiste: es para mirar la animación, no para que
  // reaparezca en la próxima visita. Se ACUMULA en vez de reemplazar, para
  // poder pulsar varias veces y ver cómo se apilan.
  /* ─── Simulador de logros, solo para poder mirarlos ────────────────────
     La cola de mentira NO se persiste: es para ver la animación, no para que
     reaparezca en la próxima visita. Cubre TODOS los tipos porque el modal de
     rango, el de racha y la combinación no se habían llegado a dibujar nunca. */
  const simularLogro = useCallback((que: 'desafio' | 'nivel' | 'rango' | 'racha' | 'todo') => {
    const desafios: Logro[] = [
      { id: nuevoId(), tipo: 'desafio', titulo: 'Haz el Daily', xp: 30, scope: 'daily' },
      { id: nuevoId(), tipo: 'desafio', titulo: 'Sesión de fondo', xp: 25, scope: 'daily' },
      { id: nuevoId(), tipo: 'desafio', titulo: 'Cinco de siete', xp: 150, scope: 'weekly' },
    ]
    const nivel: Logro = { id: nuevoId(), tipo: 'nivel', nivel: 12, color: '#5E9AA8' }
    const rango: Logro = {
      id: nuevoId(),
      tipo: 'rango',
      nivel: 20,
      rango: 'Residente R1',
      color: '#8BA888',
    }
    const racha: Logro = { id: nuevoId(), tipo: 'racha', dias: 30 }

    const tanda: Logro[] =
      que === 'desafio'
        ? [desafios[Math.floor(Math.random() * desafios.length)]]
        : que === 'nivel'
          ? [nivel]
          : que === 'rango'
            ? [rango]
            : que === 'racha'
              ? [racha]
              : [rango, racha, ...desafios]

    setLogros((prev) => [...prev, ...tanda])
    setPermitido(true)
  }, [])

  // Al vaciarse la cola se vuelve a cerrar el grifo del permiso: vale para una
  // tanda, no para siempre.
  const descartarLogro = useCallback((id: string) => {
    setLogros((prev) => {
      const cola = prev.filter((l) => l.id !== id)
      guardarPendientes(cola)
      if (cola.length === 0) setPermitido(false)
      return cola
    })
  }, [])

  const descartarLogros = useCallback((ids: string[]) => {
    const fuera = new Set(ids)
    setLogros((prev) => {
      const cola = prev.filter((l) => !fuera.has(l.id))
      guardarPendientes(cola)
      // El permiso solo se cierra si NO queda nada. Si al cerrar el modal
      // quedan desafíos, siguen teniendo vía libre para salir como avisos.
      if (cola.length === 0) setPermitido(false)
      return cola
    })
  }, [])

  const cerrarCelebracion = useCallback(() => {
    setLogros([])
    guardarPendientes([])
    // Se vuelve a cerrar el grifo: el permiso vale para una tanda, no para
    // siempre. Si el usuario entra luego en otra pregunta, no queremos que la
    // siguiente meta le salte encima.
    setPermitido(false)
  }, [])

  const value = useMemo<ProgressContextValue>(
    () => ({
      data,
      loading,
      error,
      refresh: () => void load(),
      logros,
      permitirCelebracion,
      cerrarCelebracion,
      celebracionLista: permitido && logros.length > 0,
      descartarLogro,
      descartarLogros,
      simularLogro,
    }),
    [
      data,
      loading,
      error,
      load,
      logros,
      permitido,
      permitirCelebracion,
      cerrarCelebracion,
      descartarLogro,
      descartarLogros,
      simularLogro,
    ],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

/** Devuelve null fuera del provider, para que un componente suelto no reviente. */
export function useProgressContext(): ProgressContextValue {
  return (
    useContext(ProgressContext) ?? {
      data: null,
      loading: false,
      error: null,
      refresh: () => {},
      logros: [],
      permitirCelebracion: () => {},
      cerrarCelebracion: () => {},
      celebracionLista: false,
      descartarLogro: () => {},
      descartarLogros: () => {},
      simularLogro: () => {},
    }
  )
}
