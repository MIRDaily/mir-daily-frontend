// Sentry en el servidor de Next (Node y edge). Sin NEXT_PUBLIC_SENTRY_DSN no se carga nada.
// Ver src/lib/observabilidad/sentry.ts.
import { opcionesSentry } from '@/lib/observabilidad/sentry'

export async function register() {
  const opciones = opcionesSentry('servidor', process.env)
  if (!opciones) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.init(opciones)
}

// Errores de las páginas y rutas del servidor (componentes de servidor, route handlers, proxy).
export async function onRequestError(...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
