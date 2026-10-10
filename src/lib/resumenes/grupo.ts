// Página de un grupo de resúmenes activos: lo puro. Buscar (sin tildes ni mayúsculas), filtrar, ordenar
// y agrupar los párrafos por tema; el icono por defecto de un grupo; y los mensajes de las acciones en
// bloque. Sin React ni Supabase, para poder probarlo con `node --test`.

import type { Hueco, Nivel } from '@/lib/resumenes/huecos'
import { SUBJECT_ICONS } from '@/lib/flashcardTheme'

export type EstadoRepaso = 'new' | 'failed' | 'learning' | 'mastered'
export const ESTADOS_REPASO: EstadoRepaso[] = ['new', 'failed', 'learning', 'mastered']

/** Nombre y color de cada estado de repaso (los mismos de la lista de grupos). */
export const ESTADO: Record<EstadoRepaso, { nombre: string; color: string }> = {
  new: { nombre: 'Nuevo', color: '#7D8A96' },
  failed: { nombre: 'Fallado', color: '#B04A5E' },
  learning: { nombre: 'Aprendiendo', color: '#B07A1E' },
  mastered: { nombre: 'Dominado', color: '#5E8C5A' },
}

/** Icono de un grupo de resúmenes que no tiene ninguno (o tiene uno que ya no está en la paleta). */
export const ICONO_RESUMEN_POR_DEFECTO = 'menu_book'
export const iconoGrupo = (icon?: string | null): string => (icon && SUBJECT_ICONS.includes(icon) ? icon : ICONO_RESUMEN_POR_DEFECTO)

/** Lo que hace falta de un párrafo para filtrarlo y ordenarlo (Parrafo de api.ts lo cumple). */
export type ParrafoFiltrable = {
  itemId: number
  tema: string | null
  texto: string
  huecos: Hueco[]
  status?: EstadoRepaso
  due?: boolean
  nextDueAt?: string | null
  huecosFallados?: number[]
  fallos?: number
}

export const temaDe = (p: { tema: string | null }) => (p.tema ?? '').trim()
/** «Toca repasar»: lo mismo que pinta la tarjeta (los nuevos no cuentan). */
export const tocaRepasar = (p: ParrafoFiltrable) => !!p.due && p.status !== 'new'

// ─── Búsqueda ─────────────────────────────────────────────────────────────

/**
 * Texto sin tildes ni mayúsculas y, por cada carácter del resultado, de qué posición del original
 * viene (para resaltar lo encontrado en el texto de verdad).
 */
export function normalizarConMapa(s: string): { t: string; mapa: number[] } {
  let t = ''
  const mapa: number[] = []
  let k = 0
  for (const c of s) {
    const n = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    for (let j = 0; j < n.length; j++) mapa.push(k)
    t += n
    k += c.length
  }
  mapa.push(k)
  return { t, mapa }
}

export const normalizar = (s: string) => normalizarConMapa(s).t

/** La búsqueda en palabras normalizadas (todas tienen que aparecer, en cualquier orden). */
export function terminosDe(busqueda: string): string[] {
  return [...new Set(normalizar(busqueda).split(/\s+/).filter(Boolean))]
}

/** Dónde aparece cada término en un texto (rangos del ORIGINAL, ordenados y sin solapes). */
export function rangosEn(texto: string, terminos: string[]): { i: number; f: number }[] {
  if (!terminos.length || !texto) return []
  const { t, mapa } = normalizarConMapa(texto)
  const rangos: { i: number; f: number }[] = []
  for (const term of terminos) {
    let desde = 0
    for (;;) {
      const a = t.indexOf(term, desde)
      if (a < 0) break
      // El final es donde empieza el siguiente carácter del original (uno puede dar varios normalizados).
      const ultimo = mapa[a + term.length - 1]
      let j = a + term.length
      while (mapa[j] === ultimo) j++
      rangos.push({ i: mapa[a], f: mapa[j] })
      desde = a + term.length
    }
  }
  rangos.sort((x, y) => x.i - y.i || x.f - y.f)
  const unidos: { i: number; f: number }[] = []
  for (const r of rangos) {
    const u = unidos[unidos.length - 1]
    if (u && r.i <= u.f) u.f = Math.max(u.f, r.f)
    else unidos.push({ ...r })
  }
  return unidos
}

/**
 * ¿Coincide el párrafo con la búsqueda? Todos los términos tienen que aparecer: en el texto o el tema,
 * o, con `soloHuecos`, en alguna de las respuestas de los huecos (`texto.slice(i, f)`).
 */
export function coincide(p: ParrafoFiltrable, terminos: string[], soloHuecos = false): boolean {
  if (!terminos.length) return true
  const donde = soloHuecos ? p.huecos.map((h) => normalizar(p.texto.slice(h.i, h.f))) : [normalizar(p.texto), normalizar(temaDe(p))]
  return terminos.every((term) => donde.some((d) => d.includes(term)))
}

// ─── Filtros ──────────────────────────────────────────────────────────────

export type FiltrosGrupo = {
  busqueda: string
  soloHuecos: boolean
  estados: EstadoRepaso[]
  niveles: Nivel[]
  tocaRepasar: boolean
  conFallados: boolean
}

export const FILTROS_VACIOS: FiltrosGrupo = { busqueda: '', soloHuecos: false, estados: [], niveles: [], tocaRepasar: false, conFallados: false }

/** ¿Hay algún filtro puesto? («Solo en huecos» sin texto que buscar no filtra nada.) */
export const hayFiltros = (f: FiltrosGrupo) =>
  terminosDe(f.busqueda).length > 0 || f.estados.length > 0 || f.niveles.length > 0 || f.tocaRepasar || f.conFallados

/** Los párrafos que pasan los filtros, en el mismo orden. Dentro de estado y nivel vale cualquiera; entre filtros, todos. */
export function filtrarParrafos<P extends ParrafoFiltrable>(ps: P[], f: FiltrosGrupo): P[] {
  const terminos = terminosDe(f.busqueda)
  const estados = new Set(f.estados)
  const niveles = new Set(f.niveles)
  return ps.filter(
    (p) =>
      (!estados.size || estados.has(p.status ?? 'new')) &&
      (!niveles.size || p.huecos.some((h) => niveles.has(h.n))) &&
      (!f.tocaRepasar || tocaRepasar(p)) &&
      (!f.conFallados || (p.huecosFallados?.length ?? 0) > 0) &&
      coincide(p, terminos, f.soloHuecos),
  )
}

// ─── Orden ────────────────────────────────────────────────────────────────

export type OrdenGrupo = 'documento' | 'fallados' | 'vencer'
export const ORDENES: { k: OrdenGrupo; nombre: string }[] = [
  { k: 'documento', nombre: 'Documento' },
  { k: 'fallados', nombre: 'Más fallados' },
  { k: 'vencer', nombre: 'Próximos a vencer' },
]
export const esOrden = (v: unknown): v is OrdenGrupo => v === 'documento' || v === 'fallados' || v === 'vencer'

/** Por tema, en el orden en que aparece cada tema por primera vez; dentro, el de llegada. */
export function agruparPorTema<P extends { tema: string | null }>(ps: P[]): [string, P[]][] {
  const m = new Map<string, P[]>()
  for (const p of ps) {
    const t = temaDe(p)
    const l = m.get(t)
    if (l) l.push(p)
    else m.set(t, [p])
  }
  return [...m.entries()]
}

const fecha = (s?: string | null) => {
  const n = s ? Date.parse(s) : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * Ordena (sin tocar la lista que llega):
 *  - «documento»: el de llegada, agrupado por tema (como lo pinta la página).
 *  - «fallados»: más fallos primero; a igualdad, más huecos fallados; luego el del documento.
 *  - «vencer»: los que tocan repasar primero, luego por fecha (la más cercana antes) y los nuevos o
 *    sin fecha al final (entre ellos, el del documento); a igualdad, el del documento.
 */
export function ordenarParrafos<P extends ParrafoFiltrable>(ps: P[], orden: OrdenGrupo): P[] {
  const doc = agruparPorTema(ps).flatMap(([, l]) => l)
  if (orden === 'documento') return doc
  const pos = new Map(doc.map((p, k) => [p, k]))
  const porDoc = (a: P, b: P) => pos.get(a)! - pos.get(b)!
  if (orden === 'fallados') {
    return [...doc].sort((a, b) => (b.fallos ?? 0) - (a.fallos ?? 0) || (b.huecosFallados?.length ?? 0) - (a.huecosFallados?.length ?? 0) || porDoc(a, b))
  }
  const grupo = (p: P) => (tocaRepasar(p) ? 0 : p.status !== 'new' && fecha(p.nextDueAt) !== null ? 1 : 2)
  return [...doc].sort((a, b) => {
    const ga = grupo(a)
    const gb = grupo(b)
    if (ga !== gb) return ga - gb
    if (ga === 2) return porDoc(a, b)
    const fa = fecha(a.nextDueAt)
    const fb = fecha(b.nextDueAt)
    if (fa !== null && fb !== null && fa !== fb) return fa - fb
    if (fa === null && fb !== null) return 1
    if (fb === null && fa !== null) return -1
    return porDoc(a, b)
  })
}

/** «vence hoy», «vence mañana», «vence en 5 días», «toca repasar»… (null si no hay fecha). */
export function cuandoVence(p: ParrafoFiltrable, ahora = Date.now()): string | null {
  if (tocaRepasar(p)) return 'Toca repasar'
  const f = fecha(p.nextDueAt)
  if (f === null || p.status === 'new') return null
  const dia = (ms: number) => {
    const d = new Date(ms)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000
  }
  const dias = dia(f) - dia(ahora)
  if (dias <= 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}

// ─── Selección ────────────────────────────────────────────────────────────

/** Estado de la casilla de «todo el tema»: ninguno, algunos o todos seleccionados. */
export function estadoSeleccion(ids: number[], seleccion: ReadonlySet<number>): 'ninguno' | 'algunos' | 'todos' {
  let n = 0
  for (const id of ids) if (seleccion.has(id)) n++
  return n === 0 ? 'ninguno' : n === ids.length ? 'todos' : 'algunos'
}

/** Marca todos los `ids` o, si ya lo estaban todos, los desmarca. Devuelve un Set nuevo. */
export function alternarVarios(seleccion: ReadonlySet<number>, ids: number[]): Set<number> {
  const s = new Set(seleccion)
  if (ids.length && ids.every((id) => s.has(id))) for (const id of ids) s.delete(id)
  else for (const id of ids) s.add(id)
  return s
}

// ─── Mensajes de las acciones en bloque ───────────────────────────────────

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export type ResultadoBloque =
  | { accion: 'borrar'; borrados: number }
  | { accion: 'tema'; cambiados: number; tema?: string | null }
  | { accion: 'copiar'; copiados: number; duplicados: number; destino: { name: string } }
  | { accion: 'mover'; movidos: number; duplicados: number; destino: { name: string } }

/** El mensaje que se enseña tras una acción en bloque que ha ido bien. */
export function mensajeBloque(r: ResultadoBloque): string {
  switch (r.accion) {
    case 'borrar':
      return `${plural(r.borrados, 'párrafo borrado', 'párrafos borrados')} · quedan 24 horas en la papelera`
    case 'tema': {
      const a = r.tema === undefined ? '' : r.tema && r.tema.trim() ? ` a «${r.tema.trim()}»` : ' a «Sin tema»'
      return `${plural(r.cambiados, 'párrafo cambiado', 'párrafos cambiados')} de tema${a}`
    }
    case 'copiar': {
      const base = `${plural(r.copiados, 'copiado', 'copiados')} a «${r.destino.name}»`
      return r.duplicados ? `${base} · ${r.duplicados === 1 ? '1 ya estaba y no se ha repetido' : `${r.duplicados} ya estaban y no se han repetido`}` : base
    }
    case 'mover': {
      const base = `${plural(r.movidos, 'movido', 'movidos')} a «${r.destino.name}»`
      return r.duplicados
        ? `${base} · ${r.duplicados === 1 ? '1 ya estaba allí y se queda aquí' : `${r.duplicados} ya estaban allí y se quedan aquí`}`
        : base
    }
  }
}

/** El mensaje de un error del servidor, tal cual; el de «no cabe» con cuántos caben. */
export function mensajeErrorBloque(e: unknown): string {
  const msg = e instanceof Error && e.message ? e.message : 'No se pudo completar la acción'
  const x = e as { limite?: unknown; caben?: unknown } | null
  if (x && x.limite === true && typeof x.caben === 'number') {
    return `${msg} · ${x.caben === 0 ? 'No cabe ninguno más' : x.caben === 1 ? 'Solo cabe 1 más' : `Solo caben ${x.caben} más`}`
  }
  return msg
}
