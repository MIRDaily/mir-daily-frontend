import type { Tutorial, TutorialId, TutorialStep } from './types'

/* ════════════════════════════════════════════════════════════════════════
   El guion.

   Tres reglas que conviene no perder al añadir pantallas:

   1. Un paso por cosa que el usuario tenga que DECIDIR, y ninguno más. El
      Daily son tres porque solo hay tres; el Studio son seis porque son seis
      modos distintos y elegir entre ellos es justo la decisión de esa
      pantalla. La regla no es un número: es que ningún paso sobre. (El cierre
      va aparte y no cuenta: no explica la pantalla, despide.)
   2. Solo se explica lo que no se explica solo. Versus no lleva tutorial
      porque un botón que pone "Versus" ya dice lo que hace, y por eso mismo
      los pasos de los modos NO repiten su nombre —que ya está escrito en la
      tarjeta— sino para qué sirven. Electros se queda fuera del recorrido:
      su propia tarjeta ya se explica con detalle.
   3. Frases cortas. El texto se escribe letra a letra: un párrafo se vuelve
      una espera.
═══════════════════════════════════════════════════════════════════════════ */

export const TUTORIAL_DAILY: Tutorial = {
  /* v2: el cierre pasó de un cuadro suelto en mitad de la pantalla a dos pasos
     señalando la nav, y el aviso de la app dejó de salir centrado. Subir la
     versión lo vuelve a enseñar a quien ya vio la v1, que es lo que toca
     cuando lo que cambia es el guion y no una errata. */
  id: 'daily.v2',
  // El aviso de la app cuelga de este tutorial: su ancla vive en el Daily.
  llevaMensajeAppMovil: true,
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

export const TUTORIAL_STUDIO: Tutorial = {
  /* v2: la rejilla de módulos era un solo paso que los nombraba de carrerilla.
     Ahora la mascota para en cada modo y dice para qué sirve, que es lo que
     de verdad hacía falta: los nombres ya están escritos en las tarjetas, lo
     que no se ve es en qué te ayuda cada uno.
     v3: los mazos se explicaban por el mazo automático de fallos, que es el
     caso raro y encima no lo crea el usuario. Ahora se explica el mazo normal
     —lo armas tú— y qué gana quien lo use. */
  id: 'studio.v3',
  /* Sin `cierre`: la despedida y el "te voy explicando cada pestaña" ya los
     dio el Daily, y este tutorial es justo el cumplimiento de esa promesa.
     Repetir el adiós en cada pantalla lo convertiría en un peaje. */
  steps: [
    {
      pose: 'saludo',
      placement: 'centro',
      text: 'Esto es el Studio. Aquí eliges tú qué estudiar, sin esperar al sobre del día.',
    },
    {
      anchor: 'studio-simulacro',
      pose: 'senalando',
      text: 'Este simulacro se monta solo: 30 preguntas de aquello que peor llevas.',
    },
    /* Una parada por modo. Electros no está: es la única tarjeta del Studio
       sin ancla, y se queda fuera del recorrido a propósito. */
    {
      anchor: 'studio-preguntas-simulacros',
      pose: 'senalando',
      preview: 'simulacros',
      text: 'Aquí los montas tú: por asignatura, por tema, o un test rápido si solo tienes cinco minutos.',
    },
    /* Tres bocadillos para un solo sitio: qué es, cómo funciona y para qué
       sirve. No es saltarse la regla 1 —sigue siendo UNA decisión— sino la
       3: cabe en tres frases cortas o en un párrafo que nadie espera a que
       se escriba. La maqueta no se reinicia entre ellos. */
    {
      anchor: 'studio-mazos',
      pose: 'senalando',
      preview: 'mazos',
      text: 'Un mazo lo armas tú: cuando una pregunta te cueste, la guardas ahí desde el Daily o desde un simulacro.',
    },
    {
      anchor: 'studio-mazos',
      pose: 'hablando',
      preview: 'mazos',
      text: 'Y al estudiarlo, cada pregunta te vuelve a salir justo antes de que se te olvide.',
    },
    {
      anchor: 'studio-mazos',
      pose: 'hablando',
      preview: 'mazos',
      text: 'Así dejas de repasar mil veces lo que ya te sabes y le das el tiempo a lo que se te resiste.',
    },
    {
      anchor: 'studio-flashcards',
      pose: 'senalando',
      text: 'Y si te lo escribes tú, flashcards: van bien para fármacos, dosis y criterios.',
    },
    {
      anchor: 'studio-sala-zen',
      pose: 'hablando',
      text: 'Y cuando no te concentres, para aquí un rato. Puedes entrar en sala con alguien más.',
    },
  ],
}

export const TUTORIALS: Record<TutorialId, Tutorial> = {
  [TUTORIAL_DAILY.id]: TUTORIAL_DAILY,
  [TUTORIAL_STUDIO.id]: TUTORIAL_STUDIO,
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
