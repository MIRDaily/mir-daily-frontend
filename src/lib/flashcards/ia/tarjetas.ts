// Flashcards con IA: lo que es del navegador y no depende de React ni de stores (se prueba con
// `npm test`): tipos, saneado de lo que devuelve el servidor (entrada no fiable: solo campos
// conocidos, texto acotado), la vista previa agrupada por tema y nivel, lo que se guarda, y la rama
// de un mapa en texto plano (con las filas de sus tablas) para mandarla como fuente.

import { plainText } from '@/lib/mapas/export/richtext'
import { fragmentoParaRama, ramaDeNodo, type NodoMapa } from '@/lib/mapas/ia/rama'
import type { Seccion } from '@/lib/mapas/ia/types'
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

export type TarjetaIA = {
  tema: string
  nivel: FlashcardLevel
  pregunta: string
  respuesta: string
  ia?: OrigenIA
  /** Desde un mapa: el nodo de su tema («Abrir la rama» lleva ahí, no a la raíz de lo generado). */
  nodeId?: string
}

/**
 * Una tarjeta de la vista previa: lo que el usuario puede tocar antes de guardar. `grupo`: en un
 * documento tema a tema, el tema del libro (cada uno puede ir a su propio grupo). `nueva`: llegó con
 * «Más de este tema» y aún no se ha tocado.
 */
export type Borrador = TarjetaIA & { key: string; incluir: boolean; grupo?: string; nueva?: boolean }

export type EstadoFlashcardsIA = {
  disponible: boolean
  niveles: FlashcardLevel[]
  densidades: Densidad[]
  opciones?: { libro?: boolean; mapa?: boolean; ampliar?: { cantidades: number[] } }
  limites: { maxChars: number; maxPaginas: number; maxCharsLibro?: number; maxPaginasLibro?: number; maxTemas?: number }
  cupo: {
    generacionesHoy: number
    maxGeneracionesDia: number
    caracteresHoy: number
    maxCaracteresDia: number
    /** «Más de este tema» (tope propio). */
    masHoy?: number
    maxMasDia?: number
  }
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
        ...(fuente.mapId ? { mapId: fuente.mapId, ...((b.nodeId ?? fuente.nodeId) ? { nodeId: (b.nodeId ?? fuente.nodeId)! } : {}) } : {}),
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

// ---------------------------------------------------------------------------
// «Más de este tema»
// ---------------------------------------------------------------------------

export type OpcionMas = 'mas' | 'dificiles' | 'faciles'

export const OPCIONES_MAS: { id: OpcionMas; titulo: string; descripcion: string; niveles: FlashcardLevel[] }[] = [
  { id: 'mas', titulo: 'Más de este tema', descripcion: 'De todos los niveles.', niveles: [1, 2, 3, 4] },
  { id: 'dificiles', titulo: 'Más difíciles', descripcion: 'Difícil y demencial.', niveles: [3, 4] },
  { id: 'faciles', titulo: 'Más fáciles', descripcion: 'Fácil y media.', niveles: [1, 2] },
]
export const CANTIDADES_MAS = [5, 10, 20] as const
export const CANTIDAD_MAS_DEFECTO = 10

/**
 * Las tarjetas que ya hay en un tema (todas, también las quitadas: tampoco se quieren repetidas), con
 * su respuesta: con solo la pregunta, la IA colaba el mismo dato preguntado con otras palabras.
 */
export const tarjetasDeTema = (lista: Borrador[], tema: string) =>
  lista.filter((b) => b.tema === tema).map((b) => ({ pregunta: b.pregunta, respuesta: b.respuesta }))

/** Páginas (o diapositivas) de donde salen las tarjetas de un tema: para elegir su fragmento. */
export function paginasDeTema(lista: Borrador[], tema: string): number[] {
  const out: number[] = []
  for (const b of lista) {
    const p = b.tema === tema ? (b.ia?.pagina ?? b.ia?.diapositiva) : undefined
    if (p) out.push(p)
  }
  return out
}

/**
 * Mete las tarjetas nuevas de un tema en su sitio: justo después de la última de ese tema (la vista
 * previa agrupa por tema y nivel, así que quedan con las suyas), marcadas como nuevas, con el mismo
 * grupo del libro que el resto del tema y claves que no chocan con las que hay. No muta `lista`.
 */
export function insertarNuevas(lista: Borrador[], tema: string, nuevas: TarjetaIA[], prefijo = 'm'): Borrador[] {
  if (!nuevas.length) return lista
  const usadas = new Set(lista.map((b) => b.key))
  const grupo = lista.find((b) => b.tema === tema && b.grupo)?.grupo
  const sello = Date.now().toString(36)
  let n = 0
  const clave = () => {
    let k = `${prefijo}${sello}-${n++}`
    while (usadas.has(k)) k = `${prefijo}${sello}-${n++}`
    usadas.add(k)
    return k
  }
  const aMeter: Borrador[] = nuevas.map((t) => ({ ...t, tema, key: clave(), incluir: true, nueva: true, ...(grupo ? { grupo } : {}) }))
  let ultima = -1
  lista.forEach((b, i) => {
    if (b.tema === tema) ultima = i
  })
  return ultima < 0 ? [...lista, ...aMeter] : [...lista.slice(0, ultima + 1), ...aMeter, ...lista.slice(ultima + 1)]
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
  const raiz = byId.get(id)
  return { mapa, hojas: contarHojas(mapa), paginas: r.paginas, titulo: raiz ? (raiz.data.table ? raiz.data.table.title : plainText(raiz.data.label)) : '' }
}

/** Hojas de una rama en líneas { d, t }: las que no tienen otra más profunda justo debajo. */
const contarHojas = (mapa: { d: number; t: string }[]) => mapa.filter((x, i) => !(mapa[i + 1] && mapa[i + 1].d > x.d)).length
const caracteresDe = (mapa: { d: number; t: string }[], secciones: Seccion[]) =>
  mapa.reduce((n, x) => n + x.t.length + 1, 0) + secciones.reduce((n, s) => n + s.texto.length, 0)

/** La raíz del mapa: el nodo sin padre del que cuelga más (un mapa puede tener nodos sueltos). */
export function raizDelMapa(nodes: NodoMapa[]): string | null {
  const hijos = new Map<string, number>()
  for (const n of nodes) if (n.data.parentId) hijos.set(n.data.parentId, (hijos.get(n.data.parentId) ?? 0) + 1)
  let mejor: NodoMapa | null = null
  for (const n of nodes) if (!n.data.parentId && (!mejor || (hijos.get(n.id) ?? 0) > (hijos.get(mejor.id) ?? 0))) mejor = n
  return mejor?.id ?? null
}

export type BloqueMapa = { id: string; titulo: string; mapa: { d: number; t: string }[]; hojas: number; fragmento: Seccion[]; chars: number }

/**
 * El mapa ENTERO para hacer sus flashcards: con el documento entero si cabe en el tope de un documento
 * (`entero`); y siempre sus bloques (los hijos de la raíz, de arriba abajo), cada uno con su rama y el
 * fragmento de sus páginas, para «Qué parte usar» si no cabe.
 */
export function mapaEnteroParaFlashcards(nodes: NodoMapa[], raizId: string, secciones: Seccion[] | null, maxChars: number) {
  const todo = mapaParaFlashcards(nodes, raizId)
  if (!todo) return null
  const doc = secciones ?? []
  const charsEntero = caracteresDe(todo.mapa, doc)
  const bloques: BloqueMapa[] = nodes
    .filter((n) => n.data.parentId === raizId)
    .sort((a, b) => a.position.y - b.position.y)
    .flatMap((n) => {
      const r = mapaParaFlashcards(nodes, n.id)
      if (!r) return []
      const fragmento = doc.length ? fragmentoDeBloque(doc, r.paginas, r.mapa.map((x) => x.t).join(' ')) : []
      return [{ id: n.id, titulo: r.titulo, mapa: r.mapa, hojas: r.hojas, fragmento, chars: caracteresDe(r.mapa, fragmento) }]
    })
  return { titulo: todo.titulo, todo, cabeEntero: charsEntero <= maxChars, charsEntero, bloques }
}

/**
 * El fragmento de un BLOQUE del mapa (un tema entero de un libro): todas sus páginas, de la primera a
 * la última de sus nodos, con una de margen. La regla de las ramas (mediana ±3) se quedaba con el
 * centro de un tema de 10-12 páginas y perdía su principio y su final. Sin páginas, la de las ramas.
 */
export function fragmentoDeBloque(secciones: Seccion[], paginas: number[], textoRama: string): Seccion[] {
  if (!paginas.length || !secciones.some((s) => s.pagina)) return fragmentoParaRama(secciones, paginas, textoRama)
  const desde = Math.max(1, Math.min(...paginas) - 1)
  const hasta = Math.max(...paginas) + 1
  const elegidas = secciones.filter((s) => s.pagina !== undefined && s.pagina >= desde && s.pagina <= hasta)
  return elegidas.length ? elegidas : fragmentoParaRama(secciones, paginas, textoRama)
}

/**
 * Lo que se manda con unos bloques elegidos: la raíz (d = 0) con cada bloque debajo, y los fragmentos
 * unidos sin repetir secciones y en el orden del documento.
 */
export function envioDeBloques(raiz: string, bloques: BloqueMapa[], documento: Seccion[] | null) {
  const mapa = [{ d: 0, t: raiz.slice(0, 400) || 'Mapa' }, ...bloques.flatMap((b) => b.mapa.map((x) => ({ d: x.d + 1, t: x.t })))]
  const vistas = new Set<Seccion>()
  for (const b of bloques) for (const s of b.fragmento) vistas.add(s)
  const orden = documento ?? []
  const secciones = [...vistas].sort((a, b) => orden.indexOf(a) - orden.indexOf(b))
  return { mapa, secciones, hojas: contarHojas(mapa), chars: caracteresDe(mapa, secciones) }
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * El nodo del mapa que corresponde a un tema de las tarjetas (el tema desde un mapa es el nombre de
 * un nodo): igual o, si no, el más parecido que lo contenga o esté contenido en él; dentro de la rama
 * `dentroDe` si se da. Si es una hoja, su padre (una hoja no da para ampliar). null si no hay.
 */
export function nodoDeTema(nodes: NodoMapa[], tema: string, dentroDe?: string): string | null {
  const k = normalizar(tema)
  if (k.length < 2) return null
  let candidatos = nodes
  if (dentroDe && nodes.some((n) => n.id === dentroDe)) {
    const r = ramaDeNodo(nodes, dentroDe)
    const ids = new Set(r?.ids ?? [])
    candidatos = nodes.filter((n) => ids.has(n.id))
  }
  const texto = (n: NodoMapa) => normalizar(n.data.table ? n.data.table.title : plainText(n.data.label))
  let elegido = candidatos.find((n) => texto(n) === k) ?? null
  if (!elegido) {
    let distancia = Infinity
    for (const n of candidatos) {
      const t = texto(n)
      if (t.length >= 4 && k.length >= 4 && (t.includes(k) || k.includes(t)) && Math.abs(t.length - k.length) < distancia) {
        distancia = Math.abs(t.length - k.length)
        elegido = n
      }
    }
  }
  if (!elegido) return null
  const tieneHijos = nodes.some((n) => n.data.parentId === elegido!.id)
  return tieneHijos ? elegido.id : (elegido.data.parentId ?? elegido.id)
}

/** Recorta un fragmento por los extremos hasta que, con la rama, quepa en `max` caracteres. */
export function acotarFragmento(mapa: { d: number; t: string }[], fragmento: Seccion[], max: number): Seccion[] {
  let f = fragmento
  while (f.length > 1 && caracteresDe(mapa, f) > max) f = f.length % 2 ? f.slice(1) : f.slice(0, -1)
  return caracteresDe(mapa, f) > max ? [] : f
}
