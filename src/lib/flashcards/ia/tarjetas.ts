// Flashcards con IA: lo que es del navegador y no depende de React ni de stores (se prueba con
// `npm test`): tipos, saneado de lo que devuelve el servidor (entrada no fiable: solo campos
// conocidos, texto acotado), la vista previa agrupada por tema y nivel, lo que se guarda, y la rama
// de un mapa en texto plano (con las filas de sus tablas) para mandarla como fuente.

import { plainText } from '@/lib/mapas/export/richtext'
import { ramaDeNodo, type NodoMapa } from '@/lib/mapas/ia/rama'
import { FLASHCARD_LEVELS, isFlashcardLevel, type FlashcardLevel, type NewFlashcard } from '@/lib/studioFlashcards'

export type Densidad = 'pocas' | 'normal' | 'muchas'

export const DENSIDADES: { id: Densidad; titulo: string; descripcion: string }[] = [
  { id: 'pocas', titulo: 'Pocas', descripcion: 'Lo esencial de cada tema.' },
  { id: 'normal', titulo: 'Normal', descripcion: 'Un repaso completo.' },
  { id: 'muchas', titulo: 'Muchas', descripcion: 'Casi cada dato examinable.' },
]

export const DESCRIPCION_NIVEL: Record<FlashcardLevel, string> = {
  1: 'Lo nuclear: definición, causa, clínica típica.',
  2: 'Diagnóstico y tratamiento de elección, asociaciones.',
  3: 'Cifras, criterios, segunda línea, diferenciales.',
  4: 'Letra pequeña y trampas MIR.',
}

/**
 * Tarjetas aproximadas que saldrán (para avisar antes de generar). Es lo que sale DE VERDAD, no lo
 * que se pide (el modelo da más): medido con los 16 temas de reuma en «normal» (1.024 tarjetas) y
 * con vasculitis en las tres densidades (58 / ~130 / 216). Crece con la raíz del texto, como los
 * nodos de los mapas.
 */
const POR_RAIZ: Record<Densidad, number> = { pocas: 0.2, normal: 0.42, muchas: 0.75 }
const POR_HOJA: Record<Densidad, number> = { pocas: 0.6, normal: 1.4, muchas: 2.2 }

export function tarjetasAprox(caracteres: number, densidad: Densidad, nNiveles = 4): number {
  return Math.max(6, Math.round(POR_RAIZ[densidad] * Math.sqrt(Math.max(0, caracteres)) * (0.4 + 0.15 * nNiveles)))
}

export function tarjetasAproxMapa(hojas: number, densidad: Densidad, nNiveles = 4): number {
  return Math.max(6, Math.round(POR_HOJA[densidad] * hojas * (0.4 + 0.15 * nNiveles)))
}

export type OrigenIA = {
  anclaje?: number
  cerca?: number
  pagina?: number
  diapositiva?: number
  seccion?: string
  dudoso?: 'anclaje' | 'tratamiento'
  /** Trozo del texto de donde sale (≤280 caracteres): se guarda con la tarjeta («Ver de dónde sale»). */
  fragmento?: string
}

/** Lo que se sabe del origen al guardar: el archivo y, si salen de un mapa, su rama. */
export type FuenteGuardar = { nombre?: string | null; unidad?: 'pagina' | 'diapositiva'; mapId?: string | null; nodeId?: string | null }

export type TarjetaIA = { tema: string; nivel: FlashcardLevel; pregunta: string; respuesta: string; ia?: OrigenIA }

/**
 * Una tarjeta de la vista previa: lo que el usuario puede tocar antes de guardar. `grupo`: en un
 * documento tema a tema, el tema del libro (cada uno puede ir a su propio grupo).
 */
export type Borrador = TarjetaIA & { key: string; incluir: boolean; grupo?: string }

export type EstadoFlashcardsIA = {
  disponible: boolean
  niveles: FlashcardLevel[]
  densidades: Densidad[]
  opciones?: { libro?: boolean; mapa?: boolean }
  limites: { maxChars: number; maxPaginas: number; maxCharsLibro?: number; maxPaginasLibro?: number; maxTemas?: number }
  cupo: { generacionesHoy: number; maxGeneracionesDia: number; caracteresHoy: number; maxCaracteresDia: number }
}

const MAX_TEMA = 120
const MAX_PREGUNTA = 300
const MAX_RESPUESTA = 200
const MAX_TARJETAS = 2000
/** 280 del servidor más los «…». */
const MAX_FRAGMENTO = 282

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const fraccion = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? Math.round(v * 100) / 100 : undefined)
const entero = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100000 ? v : undefined)

function sanitizeOrigen(raw: unknown): OrigenIA | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: OrigenIA = {}
  const a = fraccion(r.anclaje)
  if (a !== undefined) out.anclaje = a
  const c = fraccion(r.cerca)
  if (c !== undefined) out.cerca = c
  const p = entero(r.pagina)
  if (p !== undefined) out.pagina = p
  const d = entero(r.diapositiva)
  if (d !== undefined) out.diapositiva = d
  const s = texto(r.seccion, 80)
  if (s) out.seccion = s
  if (r.dudoso === 'anclaje' || r.dudoso === 'tratamiento') out.dudoso = r.dudoso
  const f = texto(r.fragmento, MAX_FRAGMENTO)
  if (f) out.fragmento = f
  return Object.keys(out).length ? out : undefined
}

/** Lo que manda el servidor → tarjetas válidas (lo demás se ignora). */
export function sanitizeTarjetas(raw: unknown): TarjetaIA[] {
  if (!Array.isArray(raw)) return []
  const out: TarjetaIA[] = []
  for (const x of raw.slice(0, MAX_TARJETAS)) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    const pregunta = texto(r.pregunta, MAX_PREGUNTA)
    const respuesta = texto(r.respuesta, MAX_RESPUESTA)
    if (!pregunta || !respuesta || !isFlashcardLevel(r.nivel)) continue
    const ia = sanitizeOrigen(r.ia)
    out.push({ tema: texto(r.tema, MAX_TEMA) || 'General', nivel: r.nivel, pregunta, respuesta, ...(ia ? { ia } : {}) })
  }
  return out
}

export function borradores(tarjetas: TarjetaIA[], prefijo = 't', grupo?: string): Borrador[] {
  return tarjetas.map((t, i) => ({ ...t, key: `${prefijo}${i}`, incluir: true, ...(grupo ? { grupo } : {}) }))
}

/**
 * Vista previa: por tema (en el orden en que salen) y dentro, por nivel de fácil a demencial.
 * Devuelve índices sobre `lista` para poder editar cada tarjeta en su sitio.
 */
export function agrupar(lista: Borrador[]): { tema: string; niveles: { nivel: FlashcardLevel; indices: number[] }[] }[] {
  const temas = new Map<string, Map<FlashcardLevel, number[]>>()
  lista.forEach((b, i) => {
    const t = temas.get(b.tema) ?? temas.set(b.tema, new Map()).get(b.tema)!
    ;(t.get(b.nivel) ?? t.set(b.nivel, []).get(b.nivel)!).push(i)
  })
  return [...temas].map(([tema, porNivel]) => ({
    tema,
    niveles: FLASHCARD_LEVELS.filter((n) => porNivel.has(n)).map((nivel) => ({ nivel, indices: porNivel.get(nivel)! })),
  }))
}

export function contarNiveles(lista: Pick<Borrador, 'nivel' | 'incluir'>[], soloIncluidas = true): Record<FlashcardLevel, number> {
  const out: Record<FlashcardLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const b of lista) if (!soloIncluidas || b.incluir) out[b.nivel] += 1
  return out
}

/**
 * Lo que se manda a guardar: las marcadas y con texto, en el orden de la vista previa, cada una con
 * su origen (archivo, página o diapositiva, rama del mapa y fragmento) si se sabe.
 */
export function paraGuardar(lista: Borrador[], fuente: FuenteGuardar = {}): NewFlashcard[] {
  return lista
    .filter((b) => b.incluir && b.pregunta.trim() && b.respuesta.trim())
    .map((b) => {
      const page = b.ia?.pagina ?? b.ia?.diapositiva ?? null
      const source = {
        ...(fuente.nombre ? { name: fuente.nombre.slice(0, 160) } : {}),
        ...(page ? { page, unit: b.ia?.diapositiva ? ('diapositiva' as const) : (fuente.unidad ?? ('pagina' as const)) } : {}),
        ...(fuente.mapId ? { mapId: fuente.mapId, ...(fuente.nodeId ? { nodeId: fuente.nodeId } : {}) } : {}),
        ...(b.ia?.fragmento ? { snippet: b.ia.fragmento } : {}),
      }
      return {
        front: b.pregunta.trim(),
        back: b.respuesta.trim(),
        topic: b.tema.trim().slice(0, MAX_TEMA) || null,
        level: b.nivel,
        ...(Object.keys(source).length ? { source } : {}),
      }
    })
}

/** Con qué niveles se empieza a estudiar lo recién guardado: los dos más fáciles que haya. */
export function nivelesParaEmpezar(lista: Pick<Borrador, 'nivel' | 'incluir'>[]): FlashcardLevel[] {
  const hay = FLASHCARD_LEVELS.filter((n) => lista.some((b) => b.incluir && b.nivel === n))
  return hay.slice(0, 2)
}

/** `?niveles=1,2` → niveles válidos sin repetir y en orden (null si no hay ninguno). */
export function leerNivelesURL(v: string | null | undefined): FlashcardLevel[] | null {
  if (!v) return null
  const out = FLASHCARD_LEVELS.filter((n) => v.split(',').map((x) => x.trim()).includes(String(n)))
  return out.length ? out : null
}

/** «pág. 12» / «diapositiva 4» / la sección, o '' si no se sabe. */
export function origenTexto(ia?: OrigenIA): string {
  if (!ia) return ''
  if (ia.pagina) return `pág. ${ia.pagina}`
  if (ia.diapositiva) return `diapositiva ${ia.diapositiva}`
  return ia.seccion ?? ''
}

// ---------------------------------------------------------------------------
// Desde un mapa
// ---------------------------------------------------------------------------

/**
 * La rama de `id` como la quiere el servidor: líneas { d, t } (d = 0 su raíz) en orden de lectura,
 * con cada tabla desplegada en una línea por fila («Fila — Columna: celda; …») colgando de ella, y
 * las páginas de origen de sus nodos (para el fragmento del documento). null si no hay nodo.
 */
export function mapaParaFlashcards(nodes: NodoMapa[], id: string) {
  const r = ramaDeNodo(nodes, id)
  if (!r) return null
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const mapa: { d: number; t: string }[] = []
  r.rama.forEach((linea, i) => {
    const n = byId.get(r.ids[i])
    const tabla = n?.data.table
    if (!tabla) {
      mapa.push(linea)
      return
    }
    mapa.push({ d: linea.d, t: (tabla.title || 'Tabla').slice(0, 400) })
    for (const fila of tabla.rows) {
      const nombre = (fila[0] ?? '').trim()
      const celdas = fila
        .slice(1)
        .map((c, j) => [tabla.columns[j + 1]?.trim(), c.trim()] as const)
        .filter(([, c]) => c)
        .map(([h, c]) => (h ? `${h}: ${c}` : c))
      if (nombre && celdas.length) mapa.push({ d: linea.d + 1, t: `${nombre} — ${celdas.join('; ')}`.slice(0, 400) })
    }
  })
  const hojas = mapa.filter((x, i) => !(mapa[i + 1] && mapa[i + 1].d > x.d)).length
  const raiz = byId.get(id)
  return { mapa, hojas, paginas: r.paginas, titulo: raiz ? (raiz.data.table ? raiz.data.table.title : plainText(raiz.data.label)) : '' }
}
