/**
 * Sentry en la web: errores sin datos personales. Lo usan src/instrumentation.ts (servidor) y
 * src/instrumentation-client.ts (navegador).
 *
 * Se APAGA SOLO si falta NEXT_PUBLIC_SENTRY_DSN: ni siquiera se descarga el SDK (se importa bajo
 * demanda), así que sin esa variable la web pesa y se comporta exactamente como antes.
 *
 *   NEXT_PUBLIC_SENTRY_DSN             DSN del proyecto de Sentry del frontend
 *   NEXT_PUBLIC_SENTRY_ENVIRONMENT     por defecto 'production' en Vercel y 'development' en local
 *   SENTRY_TRACES_SAMPLE_RATE          fracción de peticiones del SERVIDOR con traza (por defecto 0.02)
 *
 * Qué NO sale nunca hacia Sentry: cuerpos, cookies, parámetros de URL, el usuario (ni id ni email ni
 * IP), cabeceras salvo user-agent y content-type, ni grabaciones de la sesión (sin Replay). Además se
 * tachan los emails y los JWT que se cuelen en un mensaje, una miga o un tramo.
 *
 * Funciones puras (el SDK se inyecta) para poder probarlas con node --test.
 */

type Dict = Record<string, unknown>

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const CABECERAS_PERMITIDAS = ['user-agent', 'content-type']

export const RECOGIDA_DE_DATOS = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: CABECERAS_PERMITIDAS }, response: false },
  httpBodies: [] as never[],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
}

export function limpiarTexto<T>(texto: T): T {
  if (typeof texto !== 'string') return texto
  return texto.replace(JWT, '[token]').replace(BEARER, 'Bearer [token]').replace(EMAIL, '[email]') as T
}

function sinConsulta<T>(url: T): T {
  return (typeof url === 'string' ? url.replace(/[?#].*$/, '') : url) as T
}

/** Miga (breadcrumb) sin emails, tokens ni parámetros de URL. */
export function limpiarMiga<T extends Dict | null | undefined>(miga: T): T {
  if (!miga) return miga
  const m = miga as Dict & { message?: unknown; data?: Dict }
  if (m.message) m.message = limpiarTexto(m.message)
  if (m.data) {
    for (const k of ['url', 'from', 'to']) if (m.data[k]) m.data[k] = sinConsulta(m.data[k])
    if (Array.isArray(m.data.arguments)) m.data.arguments = m.data.arguments.map((a) => limpiarTexto(a))
    delete m.data['http.query']
    delete m.data['http.fragment']
  }
  return miga
}

/** Evento de error sin datos personales. */
export function limpiarEvento<T extends Dict | null>(evento: T): T {
  if (!evento) return evento
  const e = evento as Dict & {
    request?: Dict & { headers?: Record<string, string> }
    message?: string
    logentry?: { message?: string }
    exception?: { values?: { value?: string }[] }
    breadcrumbs?: Dict[]
    extra?: Dict
  }
  delete e.user
  if (e.request) {
    delete e.request.data
    delete e.request.cookies
    delete e.request.query_string
    if (e.request.url) e.request.url = sinConsulta(e.request.url)
    if (e.request.headers) {
      e.request.headers = Object.fromEntries(
        Object.entries(e.request.headers).filter(([k]) => CABECERAS_PERMITIDAS.includes(k.toLowerCase()))
      )
    }
  }
  if (e.message) e.message = limpiarTexto(e.message)
  if (e.logentry?.message) e.logentry.message = limpiarTexto(e.logentry.message)
  for (const ex of e.exception?.values ?? []) ex.value = limpiarTexto(ex.value)
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = e.breadcrumbs.map((b) => limpiarMiga(b))
  if (e.extra) {
    for (const [k, v] of Object.entries(e.extra)) {
      e.extra[k] = Array.isArray(v) ? v.map((x) => limpiarTexto(x)) : limpiarTexto(v)
    }
  }
  return evento
}

/** Tramo de rendimiento (span) sin usuario, IP ni parámetros de URL. */
export function limpiarTramo<T extends Dict | null>(tramo: T): T {
  if (!tramo) return tramo
  const t = tramo as Dict & { name?: string; attributes?: Dict }
  if (t.name) t.name = limpiarTexto(sinConsulta(t.name))
  const attrs = t.attributes
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      if (/^(user\.|client\.address|http\.client_ip)|query|fragment/i.test(k)) {
        delete attrs[k]
        continue
      }
      const limpiar = (v: unknown) => limpiarTexto(/url|target/i.test(k) ? sinConsulta(v) : v)
      const v = attrs[k]
      if (v && typeof v === 'object' && 'value' in v) (v as Dict).value = limpiar((v as Dict).value)
      else attrs[k] = limpiar(v)
    }
  }
  return tramo
}

function muestreo(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor)
  return valor !== undefined && valor !== '' && Number.isFinite(n) && n >= 0 && n <= 1 ? n : porDefecto
}

type Entorno = Record<string, string | undefined>

/**
 * Opciones de Sentry.init, o null si no hay DSN (apagado). `lado`: 'servidor' trae un muestreo bajo
 * de rendimiento; 'navegador' solo errores (sin trazas ni Replay).
 */
export function opcionesSentry(lado: 'servidor' | 'navegador', env: Entorno): Dict | null {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return null
  return {
    dsn,
    environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || env.VERCEL_ENV || env.NODE_ENV || 'production',
    release: env.NEXT_PUBLIC_APP_VERSION && env.NEXT_PUBLIC_APP_VERSION !== 'dev' ? env.NEXT_PUBLIC_APP_VERSION : undefined,
    tracesSampleRate: lado === 'servidor' ? muestreo(env.SENTRY_TRACES_SAMPLE_RATE, 0.02) : 0,
    sendDefaultPii: false,
    dataCollection: RECOGIDA_DE_DATOS,
    beforeSend: limpiarEvento,
    beforeSendSpan: limpiarTramo,
    beforeBreadcrumb: limpiarMiga,
  }
}
