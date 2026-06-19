/**
 * Registro central de variantes de landing.
 *
 * Para añadir una landing nueva:
 *   1. Crea el componente en src/components/landing/<Nombre>.tsx
 *   2. Crea la ruta en src/app/<slug>/page.tsx que lo renderice
 *   3. Añade una entrada a este array
 *
 * La galería (/landings) y el selector flotante se actualizan solos.
 */

export type LandingVariant = {
  slug: string
  path: string
  name: string
  emoji: string
  description: string
  /** Colores para la mini-preview de la galería y el selector */
  preview: {
    bg: string
    accent: string
    text: string
  }
}

export const LANDING_VARIANTS: LandingVariant[] = [
  {
    slug: 'clasica',
    path: '/',
    name: 'Clásica · Modo día',
    emoji: '☀️',
    description:
      'Crema y coral, pregunta MIR interactiva con confeti, marquee de especialidades y tarjetas con micro-animaciones.',
    preview: {
      bg: '#FAF7F4',
      accent: '#D4978C',
      text: '#171312',
    },
  },
  {
    slug: 'nocturna',
    path: '/landing-v2',
    name: 'Guardia nocturna',
    emoji: '🌙',
    description:
      'Tema oscuro con ECG latiendo, cuenta atrás real hasta la próxima Daily, bento grid con spotlight y timeline luminosa.',
    preview: {
      bg: '#211D1A',
      accent: '#E2A99E',
      text: '#F5F1EC',
    },
  },
  {
    slug: 'atlas',
    path: '/atlas',
    name: 'Atlas vivo',
    emoji: '🔬',
    description:
      'Fondo de cuaderno de anatomía con células flotando (leucocito, eritrocito, virus) y un visor de especímenes interactivo que revela su asignatura MIR.',
    preview: {
      bg: '#FAF7F4',
      accent: '#7C3AED',
      text: '#171312',
    },
  },
  {
    slug: 'recta-final',
    path: '/recta-final',
    name: 'Recta final MIR',
    emoji: '🎯',
    description:
      'Centrada en el examen: cuenta atrás real al día del MIR y un simulador de percentil interactivo (aciertos → nota neta, percentil y puesto sobre la campana).',
    preview: {
      bg: '#FAF7F4',
      accent: '#D4978C',
      text: '#171312',
    },
  },
  {
    slug: 'bienvenida',
    path: '/bienvenida',
    name: 'Bienvenida parallax',
    emoji: '🚪',
    description:
      'Basada en la pantalla de inicio de sesión: logo grande, lluvia de células en 3 profundidades con parallax de scroll y ratón, y tarjeta con slider de píldora como la de /auth.',
    preview: {
      bg: '#FAF7F4',
      accent: '#E2A99E',
      text: '#171312',
    },
  },
]
