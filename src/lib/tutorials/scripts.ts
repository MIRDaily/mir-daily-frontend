import type { Tutorial, TutorialId } from './types'

/* ════════════════════════════════════════════════════════════════════════
   El guion.

   Tres reglas que conviene no perder al añadir pantallas:

   1. Máximo tres pasos. Si una pantalla necesita seis, el problema es la
      pantalla, no la falta de tutorial.
   2. Solo se explica lo que no se explica solo. Versus no lleva tutorial
      porque un botón que pone "Versus" ya dice lo que hace.
   3. Frases cortas. El texto se escribe letra a letra: un párrafo se vuelve
      una espera.
═══════════════════════════════════════════════════════════════════════════ */

export const TUTORIAL_DAILY: Tutorial = {
  id: 'daily.v1',
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
}

export const TUTORIALS: Record<TutorialId, Tutorial> = {
  [TUTORIAL_DAILY.id]: TUTORIAL_DAILY,
}

/* ── Mensajes de una sola vez ────────────────────────────────────────────

   No son tutoriales de pantalla: son avisos que se dan una vez y tienen su
   propio ciclo de vida. Van aparte por una razón concreta: un paso de
   tutorial se marca visto para siempre, así que si el aviso de la app móvil
   viviera dentro de "daily.v1", todo el que entrase antes de que la app
   saliera no se enteraría nunca de que existe. Con clave propia, el día que
   la app se publique se sube a "app-movil.v2" y se vuelve a contar, una vez.

   El texto es sensible a plataforma porque el mismo mensaje no vale en
   todas: en una tablet no hay nada que recomendar, y dentro de la propia app
   decirle a alguien que se baje la app es absurdo.
─────────────────────────────────────────────────────────────────────────── */

export type Superficie = 'escritorio' | 'movil' | 'tablet'

export const MENSAJE_APP_MOVIL_ID = 'app-movil.v1' as const

/**
 * Devuelve el texto del aviso, o null si en esta superficie no toca decir
 * nada. `disponible` viene del servidor: mientras la app no esté publicada
 * el mensaje es "pronto", y el día que salga se cambia sin desplegar nada.
 */
export function textoAppMovil(
  superficie: Superficie,
  disponible: boolean,
): string | null {
  if (superficie === 'tablet') return null

  if (superficie === 'movil') {
    return disponible
      ? 'Por cierto: MIRDaily también es app de Android y iOS, y ahí esto va mucho más suelto. En tablet se ve entero.'
      : 'Por cierto: esto se ve entero en tablet. Y estamos terminando la app de Android y iOS.'
  }

  return disponible
    ? 'Una última cosa: también estamos en Android y iOS, por si prefieres estudiar desde el sofá.'
    : 'Una última cosa: estamos terminando la app de Android y iOS. Te aviso cuando salga.'
}
