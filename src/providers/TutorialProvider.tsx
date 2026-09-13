'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { useProgressContext } from '@/providers/ProgressProvider'
import TutorialOverlay from '@/components/tutorial/TutorialOverlay'
import { armarDesbloqueo } from '@/lib/tutorials/mascotAudio'
import {
  MENSAJE_APP_MOVIL_ID,
  TUTORIALS,
  textoAppMovil,
  type Superficie,
} from '@/lib/tutorials/scripts'
import {
  leerVistosLocales,
  guardarVistosLocales,
  marcarVisto,
  tutorialesActivos,
} from '@/lib/tutorials/storage'
import type { TutorialId, TutorialStep } from '@/lib/tutorials/types'

/* ════════════════════════════════════════════════════════════════════════
   Quién decide que un tutorial se enseña.

   Vive junto a la celebración de logros y sigue sus mismas reglas, porque el
   problema es el mismo: interrumpir a alguien en mal momento.

   1. Nunca arranca solo por estar en una ruta. La pantalla tiene que decir
      "estoy lista" (useTutorialReady). /dashboard, por ejemplo, es a la vez
      el hub, el quiz y los resultados: disparar por pathname habría sacado la
      mascota en mitad de una pregunta.
   2. Uno cada vez, y nunca a la vez que una celebración. Subir de nivel gana
      siempre: el tutorial espera a que se cierre.
   3. Saltar es de primera clase. Está siempre visible y no pregunta dos veces.
═══════════════════════════════════════════════════════════════════════════ */

function detectarSuperficie(): Superficie {
  if (typeof window === 'undefined') return 'escritorio'
  const ancho = window.innerWidth
  const dedo = window.matchMedia('(pointer: coarse)').matches
  if (ancho < 768) return 'movil'
  if (dedo && ancho < 1280) return 'tablet'
  return 'escritorio'
}

type TutorialContextValue = {
  /** La pantalla avisa de que ya se puede enseñar su tutorial. */
  declararListo: (id: TutorialId, listo: boolean) => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const { user } = useAuth()
  const authenticatedFetch = useAuthenticatedFetch()
  const { celebracionLista } = useProgressContext()

  const [candidato, setCandidato] = useState<TutorialId | null>(null)
  const [enCurso, setEnCurso] = useState<TutorialId | null>(null)
  const [pasos, setPasos] = useState<TutorialStep[]>([])
  const [indice, setIndice] = useState(0)
  const [incluyeMensajeApp, setIncluyeMensajeApp] = useState(false)
  /* Lo marcado en esta sesión. Sin esto, volver a /dashboard antes de que el
     perfil se refresque relanzaría el tutorial que se acaba de ver: el perfil
     del servidor todavía no lo sabe y la memoria de este render tampoco. */
  const [marcadosAhora, setMarcadosAhora] = useState<string[]>([])

  /* Servidor + caché local. El servidor manda, pero la caché evita que un
     fallo de red repita el mismo tutorial en bucle. */
  const vistos = useMemo(() => {
    const locales = leerVistosLocales()
    const remotos = user?.tutorials_seen ?? []
    return new Set([...locales, ...remotos, ...marcadosAhora])
  }, [user?.tutorials_seen, marcadosAhora])

  // La caché se pone al día con lo que diga el servidor, que es quien sabe lo
  // que se vio desde el móvil.
  useEffect(() => {
    if (user?.tutorials_seen) guardarVistosLocales(vistos)
  }, [user?.tutorials_seen, vistos])

  // Se arma nada más montar la app, no al abrir el tutorial: así cualquier
  // click previo del usuario ya deja el audio listo para el primer cuadro.
  useEffect(() => armarDesbloqueo(), [])

  const declararListo = useCallback((id: TutorialId, listo: boolean) => {
    setCandidato((actual) => (listo ? id : actual === id ? null : actual))
  }, [])

  /* ── Arranque ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (enCurso || !candidato || !user) return
    if (!tutorialesActivos()) return
    if (celebracionLista) return // la celebración va primero
    if (vistos.has(candidato)) return

    const tutorial = TUTORIALS[candidato]
    if (!tutorial) return

    const guion = [...tutorial.steps]
    let llevaMensajeApp = false

    // El aviso de la app móvil se engancha como cierre, pero con su propia
    // clave: si viviera dentro de "daily.v1", quien entre antes de que la app
    // salga no se enteraría nunca de que existe.
    if (!vistos.has(MENSAJE_APP_MOVIL_ID)) {
      const texto = textoAppMovil(detectarSuperficie(), user.mobile_app_available)
      if (texto) {
        guion.push({ pose: 'despedida', placement: 'centro', text: texto })
        llevaMensajeApp = true
      }
    }

    // Un fotograma de margen: la pantalla acaba de decir que está lista y
    // todavía se está pintando. Arrancar dentro de su mismo commit encadena
    // renders y, peor, mide el ancla antes de que esté colocada.
    const id = requestAnimationFrame(() => {
      setPasos(guion)
      setIndice(0)
      setIncluyeMensajeApp(llevaMensajeApp)
      setEnCurso(candidato)
    })
    return () => cancelAnimationFrame(id)
  }, [candidato, celebracionLista, enCurso, user, vistos])

  /* ── Cierre ───────────────────────────────────────────────────────────── */
  const terminar = useCallback(
    (saltado: boolean) => {
      const id = enCurso
      setEnCurso(null)
      setCandidato(null)
      setPasos([])
      setIndice(0)
      if (!id) return

      // Saltar cuenta como visto: insistir a quien ya dijo que no es peor que
      // no haberlo enseñado.
      const nuevas = [id]

      // El mensaje de la app solo se marca si de verdad se llegó a él. Quien
      // saltó en el primer paso no lo vio, y merece verlo otro día.
      if (incluyeMensajeApp && !saltado) nuevas.push(MENSAJE_APP_MOVIL_ID)

      setMarcadosAhora((previas) => [...previas, ...nuevas])
      setIncluyeMensajeApp(false)
      for (const clave of nuevas) void marcarVisto(apiUrl, authenticatedFetch, clave)
    },
    [apiUrl, authenticatedFetch, enCurso, incluyeMensajeApp],
  )

  /* FALLO 3 corregido: esto usaba la forma funcional de setIndice y llamaba a
     terminar() DENTRO del updater. React puede ejecutar un updater dos veces
     (StrictMode), y eso significaba marcar el tutorial y hacer el POST por
     duplicado. Leyendo `indice` de las dependencias, se ejecuta una sola vez. */
  const avanzar = useCallback(() => {
    if (indice + 1 >= pasos.length) {
      terminar(false)
      return
    }
    setIndice(indice + 1)
  }, [indice, pasos.length, terminar])

  const valor = useMemo(() => ({ declararListo }), [declararListo])

  return (
    <TutorialContext.Provider value={valor}>
      {children}
      {enCurso && pasos[indice] && (
        <TutorialOverlay
          paso={pasos[indice]}
          indice={indice}
          total={pasos.length}
          onAvanzar={avanzar}
          onSaltar={() => terminar(true)}
        />
      )}
    </TutorialContext.Provider>
  )
}

/**
 * Lo que llama una pantalla para decir "ya estoy montada y en el estado en el
 * que este tutorial tiene sentido". Es la única línea que hace falta tocar en
 * la página, aparte de los `data-tutorial` de los elementos a señalar.
 */
export function useTutorialReady(id: TutorialId, listo: boolean) {
  const ctx = useContext(TutorialContext)

  useEffect(() => {
    if (!ctx) return
    ctx.declararListo(id, listo)
    return () => ctx.declararListo(id, false)
  }, [ctx, id, listo])
}
