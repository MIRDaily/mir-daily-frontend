'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { xpParaNivel } from '@/lib/levels'
import { useAuthContext } from '@/providers/AuthProvider'
import { fetchProgress, type ProgressResponse } from '@/services/progressService'
import {
  detectarLogros,
  fotoAnomala,
  fusionarSaltos,
  guardarPendientes,
  guardarReferencia,
  leerPendientes,
  leerReferencia,
  nuevoId,
  purgarSinDuenno,
  referenciaDe,
  type Logro,
} from '@/lib/logros'

/** Cuánto se queda abierto el permiso cuando se concede sin nada que enseñar. */
const VENTANA_PERMISO_MS = 8000

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
   *
   * Y CADUCA: ver la nota de la implementación.
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
 *
 * ─── Lo que cambió tras el incidente del 21/09/2026 ────────────────────
 * Entrar al perfil disparó varios avisos de subida de nivel seguidos, con el
 * servidor perfectamente sano. La especificación completa, compartida con la
 * app de Flutter, está en `src/lib/logros.ts`.
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
  const [logros, setLogros] = useState<Logro[]>([])
  const [permitido, setPermitido] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const cierrePermisoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Espejo de `logros` para consultarlo desde temporizadores y callbacks sin
  // meterlos en las dependencias (lo que los reiniciaría en cada render).
  const logrosRef = useRef<Logro[]>(logros)
  logrosRef.current = logros

  /**
   * Sube con cada cambio de cuenta.
   *
   * Una carga guarda la generación con la que empezó y, al volver, comprueba
   * que siga siendo la misma. El `AbortController` ya cubría el caso normal,
   * pero esto lo hace explícito y protege del orden en que React aplica los
   * efectos al cambiar de usuario.
   */
  const generacionRef = useRef(0)

  // Las claves globales de antes de que esto fuera por usuario: se tiran una
  // vez y para siempre. No llevan dueño, así que no se pueden adoptar sin
  // arriesgar celebrarle a una cuenta lo que consiguió otra.
  useEffect(() => {
    purgarSinDuenno()
  }, [])

  // Al cambiar de cuenta, la pantalla se vacía y se recoge lo que esa cuenta
  // dejara pendiente. Lo que hay en localStorage NO se borra: ya va bajo el id
  // de su dueño, así que no puede colarse en la cuenta siguiente.
  useEffect(() => {
    generacionRef.current += 1
    abortRef.current?.abort()
    if (cierrePermisoRef.current) clearTimeout(cierrePermisoRef.current)
    cierrePermisoRef.current = null
    setPermitido(false)
    setData(null)
    setError(null)
    setLogros(userId ? fusionarSaltos(leerPendientes(userId)) : [])
  }, [userId])

  const load = useCallback(async () => {
    if (!userId) {
      setData(null)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const gen = generacionRef.current
    setLoading(true)
    setError(null)
    try {
      const nuevo = await fetchProgress(controller.signal)
      // Otra cuenta ha entrado mientras esto volaba: esta respuesta ya no es
      // de nadie que esté mirando.
      if (gen !== generacionRef.current) return

      const ref = leerReferencia(userId)

      if (fotoAnomala(ref, nuevo)) {
        // Ni se pinta ni se guarda. Un nivel 1 con cero XP encima de una
        // referencia de nivel 12 es el servidor tragándose un error, y
        // guardarlo como referencia es exactamente lo que hacía celebrar el
        // nivel entero en la siguiente lectura buena. Se conserva lo que ya
        // había en pantalla: es viejo, pero es verdad.
        setError('Tu progreso no está disponible ahora mismo.')
        return
      }

      setData(nuevo)

      // La primera vez que se ve a este usuario no se celebra nada: solo se
      // toma la foto. Si no, entrar por primera vez dispararía un aluvión de
      // avisos por cosas que no acaba de conseguir.
      if (ref) {
        const nuevos = detectarLogros(ref, nuevo)
        if (nuevos.length > 0) {
          setLogros((prev) => {
            // Una subida de tres peldaños repartida en tres recargas es UNA
            // subida, no tres modales.
            const cola = fusionarSaltos([...prev, ...nuevos])
            guardarPendientes(userId, cola)
            return cola
          })
        }
      }
      guardarReferencia(userId, referenciaDe(nuevo))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (gen !== generacionRef.current) return
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu progreso.')
    } finally {
      if (!controller.signal.aborted && gen === generacionRef.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  /**
   * El permiso CADUCA.
   *
   * Antes no: quien lo concede es el montaje de `/profile` o la salida de la
   * pantalla de resultados, y ninguno de los dos puede saber si hay algo que
   * enseñar. Un daily sin logros dejaba el permiso abierto para siempre, y lo
   * siguiente que detectara cualquier recarga salía de golpe: es lo que se vio
   * el 21/09/2026, varios avisos de subida de nivel encadenados al entrar al
   * perfil.
   *
   * La rendija existe porque la recarga que dispara esa misma pantalla suele
   * llegar un instante DESPUÉS del permiso; cerrar el grifo del todo se
   * comería la celebración legítima.
   */
  const permitirCelebracion = useCallback(() => {
    if (cierrePermisoRef.current) clearTimeout(cierrePermisoRef.current)
    cierrePermisoRef.current = null
    setPermitido(true)
    // La cuenta atrás se consulta con una ref y no con el estado: programar un
    // temporizador DENTRO del updater de `setLogros` es justo lo que
    // StrictMode ejecuta dos veces en desarrollo, y ya costó encontrar un
    // fallo parecido en `AvisosDesafio`.
    if (logrosRef.current.length > 0) return
    cierrePermisoRef.current = setTimeout(() => {
      cierrePermisoRef.current = null
      // Si en la rendija llegó algo, el permiso se queda: ya hay una tanda en
      // marcha y la cierra `descartarLogros` al vaciarse.
      if (logrosRef.current.length === 0) setPermitido(false)
    }, VENTANA_PERMISO_MS)
  }, [])

  useEffect(() => () => {
    if (cierrePermisoRef.current) clearTimeout(cierrePermisoRef.current)
  }, [])

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
    // Tramos de mentira pero coherentes con la curva, para que la barra
    // recorra de verdad lo que le toca.
    const nivel: Logro = {
      id: nuevoId(),
      tipo: 'nivel',
      nivel: 12,
      color: '#5E9AA8',
      xpAntes: xpParaNivel(11) + 30,
      xpDespues: xpParaNivel(12) + 90,
    }
    const rango: Logro = {
      id: nuevoId(),
      tipo: 'rango',
      nivel: 20,
      rango: 'Residente R1',
      color: '#8BA888',
      // Dos peldaños de golpe, para ver el encadenado.
      xpAntes: xpParaNivel(18) + 120,
      xpDespues: xpParaNivel(20) + 140,
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

    if (cierrePermisoRef.current) clearTimeout(cierrePermisoRef.current)
    cierrePermisoRef.current = null
    setLogros((prev) => [...prev, ...tanda])
    setPermitido(true)
  }, [])

  // Al vaciarse la cola se vuelve a cerrar el grifo del permiso: vale para una
  // tanda, no para siempre.
  const quitar = useCallback(
    (fuera: Set<string>) => {
      setLogros((prev) => {
        const cola = prev.filter((l) => !fuera.has(l.id))
        if (cola.length === prev.length) return prev
        if (userId) guardarPendientes(userId, cola)
        // El permiso solo se cierra si NO queda nada. Si al cerrar el modal
        // quedan desafíos, siguen teniendo vía libre para salir como avisos.
        if (cola.length === 0) {
          if (cierrePermisoRef.current) clearTimeout(cierrePermisoRef.current)
          cierrePermisoRef.current = null
          setPermitido(false)
        }
        return cola
      })
    },
    [userId],
  )

  const descartarLogro = useCallback((id: string) => quitar(new Set([id])), [quitar])
  const descartarLogros = useCallback((ids: string[]) => quitar(new Set(ids)), [quitar])

  const cerrarCelebracion = useCallback(() => {
    setLogros([])
    if (userId) guardarPendientes(userId, [])
    if (cierrePermisoRef.current) clearTimeout(cierrePermisoRef.current)
    cierrePermisoRef.current = null
    // Se vuelve a cerrar el grifo: el permiso vale para una tanda, no para
    // siempre. Si el usuario entra luego en otra pregunta, no queremos que la
    // siguiente meta le salte encima.
    setPermitido(false)
  }, [userId])

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
