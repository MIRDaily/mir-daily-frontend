import type { Tutorial, TutorialId, TutorialStep } from './types'

/* ════════════════════════════════════════════════════════════════════════
   El guion.

   Tres reglas que conviene no perder al añadir pantallas:

   1. Máximo tres pasos de contenido. Si una pantalla necesita seis, el
      problema es la pantalla, no la falta de tutorial. (El cierre va aparte y
      no cuenta: no explica la pantalla, despide.)
   2. Solo se explica lo que no se explica solo. Versus no lleva tutorial
      porque un botón que pone "Versus" ya dice lo que hace.
   3. Frases cortas. El texto se escribe letra a letra: un párrafo se vuelve
      una espera.
═══════════════════════════════════════════════════════════════════════════ */

export const TUTORIAL_DAILY: Tutorial = {
  /* v2: el cierre pasó de un cuadro suelto en mitad de la pantalla a dos pasos
     señalando la nav, y el aviso de la app dejó de salir centrado. Subir la
     versión lo vuelve a enseñar a quien ya vio la v1, que es lo que toca
     cuando lo que cambia es el guion y no una errata. */
  id: 'daily.v2',
  steps: [
    {
      pose: 'saludo',
      placement: 'centro',
      text: '¡Hola! Soy tu compi de estudio. Deja que te enseñe esto en diez segundos.',
    },
    {
      anchor: 'daily-sobre',
      pose: 'senalando',
      text: 'Este es tu sobre de hoy: cinco preguntas nuevas, una vez al día. Ábrelo y ya está.',
    },
    {
      anchor: 'daily-fallada',
      pose: 'hablando',
      text: 'Y aquí abajo, la pregunta que más se atragantó la semana pasada. A todos, no solo a ti.',
    },
  ],
  cierre: [
    {
      anchor: 'nav-pestanas',
      pose: 'senalando',
      text: 'Ahí arriba está todo lo demás. Según vayas entrando en cada pestaña, te la voy explicando.',
    },
    {
      pose: 'despedida',
      placement: 'centro',
      text: 'Y sin agobios: nadie se lo sabe todo el primer día. Si quieres volver a verme, enciéndeme en Configuración.',
    },
  ],
}

export const TUTORIALS: Record<TutorialId, Tutorial> = {
  [TUTORIAL_DAILY.id]: TUTORIAL_DAILY,
}

/* ── Mensajes de una sola vez ────────────────────────────────────────────

   No son tutoriales de pantalla: son avisos que se dan una vez y tienen su
   propio ciclo de vida. Van aparte por una razón concreta: un paso de
   tutorial se marca visto para siempre, así que si el aviso de la app móvil
   viviera dentro de "daily.vN", todo el que entrase antes de que la app
   saliera no se enteraría nunca de que existe. Con clave propia, el día que
   la app se publique se sube a "app-movil.v2" y se vuelve a contar, una vez.

   El texto es sensible a plataforma porque el mismo mensaje no vale en
   todas: en una tablet no hay nada que recomendar, y dentro de la propia app
   decirle a alguien que se baje la app es absurdo.
─────────────────────────────────────────────────────────────────────────── */

export type Superficie = 'escritorio' | 'movil' | 'tablet'

export const MENSAJE_APP_MOVIL_ID = 'app-movil.v1' as const

/** El bloque de la app en el dashboard, que es lo que ilumina este aviso. */
const ANCLA_APP_MOVIL = 'daily-app-movil'

/**
 * Devuelve el paso del aviso, o null si en esta superficie no toca decir
 * nada. `disponible` viene del servidor: mientras la app no esté publicada
 * el mensaje es "pronto", y el día que salga se cambia sin desplegar nada.
 *
 * Va anclado al bloque de la app, no centrado: mientras no esté publicada,
 * esa tarjeta enseña dos botones de tienda que no llevan a ningún sitio, y
 * quien la ve por primera vez merece saber por qué. Señalarla y decirlo es
 * más honesto que un cuadro flotando en medio de la pantalla.
 */
export function pasoAppMovil(
  superficie: Superficie,
  disponible: boolean,
): TutorialStep | null {
  const texto = textoAppMovil(superficie, disponible)
  if (!texto) return null

  return {
    anchor: ANCLA_APP_MOVIL,
    pose: disponible ? 'senalando' : 'hablando',
    text: texto,
  }
}

export function textoAppMovil(
  superficie: Superficie,
  disponible: boolean,
): string | null {
  if (superficie === 'tablet') return null

  if (superficie === 'movil') {
    return disponible
      ? 'Y esto también es app de Android y iOS: desde el móvil va mucho más suelto.'
      : 'Aquí vivirá la app de Android y iOS. Todavía la estamos terminando, así que esos botones aún no llevan a ningún sitio.'
  }

  return disponible
    ? 'Y aquí tienes la app de Android y iOS, por si prefieres estudiar desde el sofá.'
    : 'Aquí vivirá la app de Android y iOS. La estamos terminando: esos botones todavía no llevan a ningún sitio, pero te aviso en cuanto salga.'
}
