// Respuesta en streaming de «Crear con IA» (informe 76): el servidor manda una línea JSON por evento
// (NDJSON): fases, ramas provisionales mientras el modelo escribe y, al final, el mapa validado.
// Todo lo que llega es entrada no fiable: cada evento se reduce a sus campos conocidos y el texto
// de una rama provisional es texto plano (se pinta como texto de React, nunca como HTML). Lo
// provisional es solo una vista: nunca se guarda; lo que se guarda es el mapa del evento «fin».

import { IAError } from '@/lib/mapas/ia/types'

/** Fases del diálogo, en orden. */
export type FaseIA = 'leyendo' | 'estructura' | 'tablas' | 'tarjetas' | 'ordenando'
// «tarjetas»: las flashcards con IA usan este mismo streaming (fases leyendo → tarjetas → ordenando).
export const FASES_IA: FaseIA[] = ['leyendo', 'estructura', 'tablas', 'tarjetas', 'ordenando']

/** `tema`: en un documento largo tema a tema, el tema al que pertenece la rama. */
export type LineaProvisional = { parte: number; tema?: number; d: number; t: string }

export type EstadoTema = 'empieza' | 'listo' | 'fallo'

export type EventoIA =
  | { tipo: 'fase'; fase: FaseIA }
  | ({ tipo: 'rama' } & LineaProvisional)
  | { tipo: 'reinicio'; parte: number; tema?: number }
  | { tipo: 'temas'; temas: { titulo: string; chars: number }[] }
  | { tipo: 'tema'; i: number; estado: EstadoTema; nodos?: number }
  | { tipo: 'latido' }
  | { tipo: 'fin'; datos: Record<string, unknown> }
  | { tipo: 'error'; error: string; codigo: string; status: number }

const MAX_TEXTO = 300
const MAX_NIVEL = 8
const MAX_PARTE = 10000
const MAX_TEMA = 1000
const ESTADOS_TEMA: EstadoTema[] = ['empieza', 'listo', 'fallo']

const entero = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null

/** Una línea del servidor → evento conocido, o null (se ignora). */
export function leerEvento(linea: string): EventoIA | null {
  if (!linea.trim()) return null
  let j: unknown
  try {
    j = JSON.parse(linea)
  } catch {
    return null
  }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null
  const r = j as Record<string, unknown>
  switch (r.tipo) {
    case 'fase':
      return FASES_IA.includes(r.fase as FaseIA) ? { tipo: 'fase', fase: r.fase as FaseIA } : null
    case 'rama': {
      const parte = entero(r.parte, 0, MAX_PARTE)
      const d = entero(r.d, 1, MAX_NIVEL)
      if (parte === null || d === null || typeof r.t !== 'string' || !r.t.trim()) return null
      const tema = entero(r.tema, 0, MAX_TEMA)
      return { tipo: 'rama', parte, ...(tema !== null ? { tema } : {}), d, t: r.t.trim().slice(0, MAX_TEXTO) }
    }
    case 'reinicio': {
      const parte = entero(r.parte, 0, MAX_PARTE)
      const tema = entero(r.tema, 0, MAX_TEMA)
      return parte === null ? null : { tipo: 'reinicio', parte, ...(tema !== null ? { tema } : {}) }
    }
    case 'temas': {
      if (!Array.isArray(r.temas)) return null
      const temas = r.temas.slice(0, MAX_TEMA).map((t) => {
        const x = t && typeof t === 'object' ? (t as Record<string, unknown>) : {}
        return { titulo: typeof x.titulo === 'string' ? x.titulo.slice(0, 160) : '', chars: entero(x.chars, 0, 10_000_000) ?? 0 }
      })
      return { tipo: 'temas', temas }
    }
    case 'tema': {
      const i = entero(r.i, 0, MAX_TEMA)
      if (i === null || !ESTADOS_TEMA.includes(r.estado as EstadoTema)) return null
      const nodos = entero(r.nodos, 0, 100000)
      return { tipo: 'tema', i, estado: r.estado as EstadoTema, ...(nodos !== null ? { nodos } : {}) }
    }
    case 'latido':
      return { tipo: 'latido' }
    case 'fin': {
      const { tipo: _tipo, ...datos } = r
      void _tipo
      return { tipo: 'fin', datos }
    }
    case 'error':
      return {
        tipo: 'error',
        error: typeof r.error === 'string' ? r.error.slice(0, 300) : 'No se pudo generar el mapa',
        codigo: typeof r.codigo === 'string' ? r.codigo.slice(0, 40) : '',
        status: entero(r.status, 0, 599) ?? 0,
      }
    default:
      return null
  }
}

/** Corta en líneas lo que va llegando (los trozos de red parten las líneas por cualquier sitio). */
export function crearLectorLineas(onLinea: (linea: string) => void) {
  let buf = ''
  return {
    push(trozo: string) {
      buf += trozo
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        onLinea(buf.slice(0, i))
        buf = buf.slice(i + 1)
      }
    },
    fin() {
      if (buf.trim()) onLinea(buf)
      buf = ''
    },
  }
}

/** Lo que el diálogo acumula: las líneas provisionales, con los reinicios ya aplicados. */
export function aplicarEvento(lineas: LineaProvisional[], e: EventoIA): LineaProvisional[] {
  if (e.tipo === 'rama') return [...lineas, { parte: e.parte, ...(e.tema !== undefined ? { tema: e.tema } : {}), d: e.d, t: e.t }]
  if (e.tipo === 'reinicio') return lineas.filter((l) => l.parte !== e.parte || l.tema !== e.tema)
  return lineas
}

export type RamaProvisional = { key: string; t: string; hijos: RamaProvisional[] }

/**
 * Líneas «nivel | texto» → árbol, como lo reconstruye el servidor: un nodo cuelga del último de
 * nivel inferior y un nivel nunca salta más de uno. Las partes (documento troceado) van una detrás
 * de otra, en su orden.
 */
export function arbolProvisional(lineas: LineaProvisional[]): RamaProvisional[] {
  const raices: RamaProvisional[] = []
  const partes = [...new Set(lineas.map((l) => l.parte))].sort((a, b) => a - b)
  let k = 0
  for (const parte of partes) {
    const pila: RamaProvisional[] = []
    for (const l of lineas) {
      if (l.parte !== parte) continue
      const d = Math.min(l.d, pila.length + 1)
      const nodo: RamaProvisional = { key: `${parte}-${k++}`, t: l.t, hijos: [] }
      if (d === 1) raices.push(nodo)
      else pila[d - 2].hijos.push(nodo)
      pila.length = d - 1
      pila.push(nodo)
    }
  }
  return raices
}

/**
 * Documento largo: un bloque por tema (con su título) y debajo su borrador. Solo los temas que ya
 * tienen ramas, en el orden del documento.
 */
export function arbolLibro(lineas: LineaProvisional[], titulos: string[]): RamaProvisional[] {
  const temas = [...new Set(lineas.map((l) => l.tema ?? 0))].sort((a, b) => a - b)
  return temas.map((i) => ({
    key: `tema-${i}`,
    t: titulos[i] || `Tema ${i + 1}`,
    hijos: arbolProvisional(lineas.filter((l) => (l.tema ?? 0) === i)).map((n) => ({ ...n, key: `${i}-${n.key}` })),
  }))
}

/** Cuerpo JSON de una respuesta, o IAError con el mensaje seguro del servidor. */
export async function cuerpoOError(res: Response) {
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) {
    throw new IAError(
      typeof cuerpo?.error === 'string' ? cuerpo.error : 'No se pudo completar la operación',
      res.status,
      typeof cuerpo?.codigo === 'string' ? cuerpo.codigo : typeof cuerpo?.motivo === 'string' ? cuerpo.motivo : '',
    )
  }
  return cuerpo
}

/** Mensaje si el streaming se corta antes del mapa final (red, servidor reiniciado, proxy). */
export const MENSAJE_CORTADO =
  'Se cortó la conexión con el servidor antes de terminar. No se ha guardado nada: vuelve a intentarlo.'

/**
 * Respuesta en streaming (NDJSON): pasa cada evento a `onEvento` y devuelve los datos del evento
 * «fin». Un evento «error» o un corte antes del final lanzan IAError. Una respuesta que NO es
 * NDJSON (servidor antiguo, o un error antes de empezar: cupo, petición no válida) se lee como el
 * JSON de siempre.
 */
export async function leerRespuesta(res: Response, onEvento: (e: EventoIA) => void): Promise<Record<string, unknown>> {
  if (!/application\/x-ndjson/i.test(res.headers.get('content-type') ?? '') || !res.body) {
    return (await cuerpoOError(res)) as Record<string, unknown>
  }
  let final: Record<string, unknown> | null = null
  let fallo: IAError | null = null
  const lector = crearLectorLineas((linea) => {
    const e = leerEvento(linea)
    if (!e || final || fallo) return
    if (e.tipo === 'fin') final = e.datos
    else if (e.tipo === 'error') fallo = new IAError(e.error, e.status, e.codigo)
    else onEvento(e)
  })
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      lector.push(dec.decode(value, { stream: true }))
    }
    lector.push(dec.decode())
    lector.fin()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new IAError(MENSAJE_CORTADO, 0, 'cortado')
  }
  if (fallo) throw fallo
  if (!final) throw new IAError(MENSAJE_CORTADO, 0, 'cortado')
  return final
}
