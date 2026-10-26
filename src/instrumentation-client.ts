// Sentry en el navegador: solo errores, sin trazas ni grabación de la sesión. Sin
// NEXT_PUBLIC_SENTRY_DSN no se descarga el SDK (import bajo demanda): la web queda igual que antes.
// Ver src/lib/observabilidad/sentry.ts.
import { opcionesSentry } from '@/lib/observabilidad/sentry'

const opciones = opcionesSentry('navegador', {
  // Next sustituye estas en la compilación; process.env entero no existe en el navegador.
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NODE_ENV: process.env.NODE_ENV,
})

if (opciones) {
  import('@sentry/nextjs')
    .then((Sentry) => Sentry.init(opciones))
    .catch(() => {})
}
