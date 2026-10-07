// Rehacer, ampliar o resumir UNA rama de un mapa con IA (informe 76). Lo que es del navegador:
// qué se manda (la rama en texto plano, el camino, las ramas vecinas y el FRAGMENTO del documento
// de donde sale) y cómo se mete la rama nueva en el mapa (misma raíz, misma posición y lado, una
// sola acción que se deshace con Ctrl+Z). Puro, sin stores: se prueba con `npm test`.

import { plainText } from '@/lib/mapas/export/richtext'
import { computeLayout } from '@/lib/mapas/layout'
import {
  categoryAccent,
  LAYOUT_DEPTH_GAPS,
  styleForCategory,
  styleForNode,
  styleForTable,
  toLabelStyle,
  type CategoryStyles,
  type GraphNodeStyle,
} from '@/lib/mapas/graph'
import { sanitizeDoc } from '@/lib/mapas/tree'
import { sanitizeLabelHtml } from '@/lib/mapas/labelHtml'
import { tableToLabel, type MapTable } from '@/lib/mapas/table'
import { sanitizeIA, type NodoIA } from '@/lib/mapas/ia/revision'
import type { Seccion } from '@/lib/mapas/ia/types'
import { MAP_CATEGORIES, type MapCategoryId, type MapDoc } from '@/lib/mapas/types'

export type AccionRama = 'detalle' | 'resumir' | 'rehacer'

export const ACCIONES_RAMA: { id: AccionRama; titulo: string; descripcion: string }[] = [
  { id: 'detalle', titulo: 'Más detalle', descripcion: 'Añade los datos del documento que faltan (cifras, criterios, fármacos).' },
  { id: 'resumir', titulo: 'Resumir', descripcion: 'Deja lo esencial, en más o menos la mitad de nodos.' },
  { id: 'rehacer', titulo: 'Rehacer esta rama', descripcion: 'La vuelve a hacer desde el documento, con una estructura limpia.' },
]

/** Lo mínimo de un nodo del editor que hace falta aquí (el MindMapNode del editor lo cumple). */
export type NodoMapa = {
  id: string
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
  data: {
    label: string
    parentId?: string
    category?: string
    style: GraphNodeStyle
    table?: MapTable
    ia?: NodoIA
    collapsed?: boolean
    [k: string]: unknown
  }
}
export type LineaMapa = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  data?: Record<string, unknown>
}

const MAX_FRAGMENTO = 55000
const textoDe = (n: NodoMapa) => (n.data.table ? n.data.table.title : plainText(n.data.label)).replace(/\s+/g, ' ').trim()

function hijosDe(nodes: NodoMapa[]) {
  const m = new Map<string, NodoMapa[]>()
  for (const n of nodes) if (n.data.parentId) (m.get(n.data.parentId) ?? m.set(n.data.parentId, []).get(n.data.parentId)!).push(n)
  // Orden de lectura: de arriba abajo (el orden del array no siempre lo es tras mover nodos).
  for (const l of m.values()) l.sort((a, b) => a.position.y - b.position.y)
  return m
}

/**
 * La rama de `id` para mandar: sus líneas (d = 0 la raíz), el camino desde la raíz del mapa, los
 * nombres de las ramas vecinas (hermanas y sus hijos con hijos: lo de ellas no va aquí) y las
 * páginas de origen de sus nodos (revisión guiada).
 */
export function ramaDeNodo(nodes: NodoMapa[], id: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const hijos = hijosDe(nodes)
  const raiz = byId.get(id)
  if (!raiz) return null
  const rama: { d: number; t: string }[] = []
  const paginas: number[] = []
  const ids: string[] = []
  const walk = (n: NodoMapa, d: number) => {
    ids.push(n.id)
    rama.push({ d, t: textoDe(n).slice(0, 400) })
    const p = n.data.ia?.pagina ?? n.data.ia?.diapositiva
    if (d > 0 && p) paginas.push(p)
    for (const h of hijos.get(n.id) ?? []) walk(h, d + 1)
  }
  walk(raiz, 0)
  const ruta: string[] = []
  for (let p = raiz.data.parentId ? byId.get(raiz.data.parentId) : undefined; p; p = p.data.parentId ? byId.get(p.data.parentId) : undefined) {
    ruta.unshift(textoDe(p).slice(0, 160))
  }
  const vecinos: string[] = []
  const padre = raiz.data.parentId
  if (padre) {
    for (const h of hijos.get(padre) ?? []) {
      if (h.id === id || h.data.table) continue
      vecinos.push(textoDe(h))
      for (const x of hijos.get(h.id) ?? []) if ((hijos.get(x.id) ?? []).length) vecinos.push(textoDe(x))
    }
  }
  return { rama, ruta, vecinos: vecinos.filter((v) => v.length >= 3).slice(0, 60), paginas, ids }
}

/** Páginas del fragmento: alrededor de donde salen los nodos, sin las que quedan lejos (±3 de la mediana). */
export function paginasFragmento(paginas: number[], margen = 1): { desde: number; hasta: number } | null {
  if (!paginas.length) return null
  const ord = [...paginas].sort((a, b) => a - b)
  const med = ord[Math.floor(ord.length / 2)]
  const cerca = ord.filter((p) => Math.abs(p - med) <= 3)
  return { desde: Math.max(1, cerca[0] - margen), hasta: cerca[cerca.length - 1] + margen }
}

const raicesDe = (s: string) =>
  new Set((s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z0-9ñ]{4,}/g) ?? []).map((w) => w.slice(0, 5)))

/**
 * El fragmento del documento para la rama: las páginas de sus nodos (con una de margen) o, si no se
 * saben (Word, mapa hecho a mano), las secciones que más palabras comparten con la rama, alrededor
 * de la mejor. Acotado a ~55.000 caracteres.
 */
export function fragmentoParaRama(secciones: Seccion[], paginas: number[], textoRama: string): Seccion[] {
  const rango = paginasFragmento(paginas)
  let elegidas: Seccion[] = []
  if (rango && secciones.some((s) => s.pagina)) {
    elegidas = secciones.filter((s) => s.pagina !== undefined && s.pagina >= rango.desde && s.pagina <= rango.hasta)
  }
  if (!elegidas.length) {
    const total = secciones.reduce((n, s) => n + s.texto.length, 0)
    if (total <= MAX_FRAGMENTO) return secciones
    const r = raicesDe(textoRama)
    const puntos = secciones.map((s) => {
      const w = raicesDe(`${s.titulo ?? ''} ${s.texto}`)
      let k = 0
      for (const x of r) if (w.has(x)) k += 1
      return k
    })
    const mejor = puntos.indexOf(Math.max(...puntos))
    // Desde la mejor, hacia los lados, mientras quepa y siga habiendo palabras de la rama.
    let a = mejor
    let b = mejor
    let chars = secciones[mejor].texto.length
    for (;;) {
      const izq = a > 0 ? puntos[a - 1] : -1
      const der = b < secciones.length - 1 ? puntos[b + 1] : -1
      const sig = der >= izq ? b + 1 : a - 1
      if ((izq <= 0 && der <= 0) || sig < 0 || sig >= secciones.length) break
      if (chars + secciones[sig].texto.length > MAX_FRAGMENTO) break
      chars += secciones[sig].texto.length
      if (sig > b) b = sig
      else a = sig
    }
    elegidas = secciones.slice(a, b + 1)
  }
  // Tope: se quitan secciones por los extremos (las más lejanas del centro).
  while (elegidas.length > 1 && elegidas.reduce((n, s) => n + s.texto.length, 0) > MAX_FRAGMENTO) {
    elegidas = elegidas.length % 2 ? elegidas.slice(1) : elegidas.slice(0, -1)
  }
  return elegidas
}

const esCategoria = (c: unknown): c is MapCategoryId => typeof c === 'string' && c in MAP_CATEGORIES

/**
 * Mete la rama nueva en el mapa: quita los descendientes de `id` y cuelga los nodos de `doc` (árbol
 * v1 del servidor: su raíz es la de la rama y no se toca). Conserva la posición y el lado de la rama
 * (en espejo si queda a la izquierda de su padre), da a cada nodo el estilo de su nivel y categoría
 * (con lo que el usuario haya redefinido) y conserva «revisado» si un nodo nuevo tiene el mismo
 * texto que uno revisado que había. Devuelve los arrays nuevos (no muta los de entrada).
 */
export function aplicarRama<N extends NodoMapa, E extends LineaMapa>(
  nodes: N[],
  edges: E[],
  id: string,
  doc: MapDoc,
  opts: {
    nuevoId: () => string
    categoryStyles?: CategoryStyles
    labelFont?: number
    /** Los nodos nuevos quedan pendientes de revisar (motivo «nuevo») si no traen otro. */
    marcarNuevos?: boolean
    /** AÑADIR en vez de sustituir: lo que ya cuelga de `id` se queda y lo nuevo va debajo. */
    conservar?: boolean
    /** Documento de donde salen los nodos (otro que el del mapa): su página va como «nombre, pág. N». */
    origen?: string
  },
): { nodes: N[]; edges: E[]; nuevos: string[] } | null {
  const raiz = nodes.find((n) => n.id === id)
  const arbol = sanitizeDoc(doc)
  const raizArbol = arbol.nodes.find((n) => n.parentId === null)
  if (!raiz || !raizArbol) return null

  // Fuera los descendientes de la rama (y sus líneas).
  const hijos = hijosDe(nodes)
  const viejos = new Set<string>()
  const recoger = (x: string) => {
    for (const h of hijos.get(x) ?? []) {
      viejos.add(h.id)
      recoger(h.id)
    }
  }
  if (!opts.conservar) recoger(id)
  const revisados = new Set(nodes.filter((n) => viejos.has(n.id) && n.data.ia?.revisado).map(textoDe))

  // Nivel de la raíz en el mapa (para el estilo de cada nivel) y lado hacia el que se abre.
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let nivel = 0
  for (let p = raiz.data.parentId; p; p = byId.get(p)?.data.parentId) nivel += 1
  const padre = raiz.data.parentId ? byId.get(raiz.data.parentId) : undefined
  const w = (n: NodoMapa) => n.measured?.width ?? n.width ?? 160
  const h = (n: NodoMapa) => n.measured?.height ?? n.height ?? 44
  // Al añadir, lo nuevo va del lado donde ya están sus hijos (si tiene)...
  const yaHijos = opts.conservar ? (hijos.get(id) ?? []) : []
  const izquierda = yaHijos.length
    ? yaHijos.reduce((n, x) => n + x.position.x + w(x) / 2, 0) / yaHijos.length < raiz.position.x + w(raiz) / 2
    : !!padre && raiz.position.x + w(raiz) / 2 < padre.position.x + w(padre) / 2
  // ...y debajo de todo lo que ya cuelga de ella.
  const descendientes: NodoMapa[] = []
  if (opts.conservar) {
    const bajar = (x: string) => {
      for (const c of hijos.get(x) ?? []) {
        descendientes.push(c)
        bajar(c.id)
      }
    }
    bajar(id)
  }
  const fondo = descendientes.length ? Math.max(...descendientes.map((d) => d.position.y + h(d))) : null

  const cajas = computeLayout(arbol, { gapX: 110, gapY: 18, depthGaps: LAYOUT_DEPTH_GAPS.slice(Math.min(nivel, LAYOUT_DEPTH_GAPS.length)) })
  const propia = cajas.get(raizArbol.id)
  const cx = raiz.position.x
  const cy = raiz.position.y + h(raiz) / 2
  const nivelEnArbol = new Map<string, number>([[raizArbol.id, 0]])
  const idNuevo = new Map<string, string>([[raizArbol.id, id]])
  const nuevosNodos: N[] = []
  const nuevasLineas: E[] = []
  const plantilla = raiz as N
  for (const n of arbol.nodes) {
    if (n === raizArbol || !n.parentId) continue
    const lv = (nivelEnArbol.get(n.parentId) ?? 0) + 1
    nivelEnArbol.set(n.id, lv)
    const nid = opts.nuevoId()
    idNuevo.set(n.id, nid)
    const cat: MapCategoryId = esCategoria(n.category) ? n.category : 'general'
    const ia = sanitizeIA(n.ia)
    const base = n.table
      ? styleForTable(cat)
      : ia?.subgrupo
        ? toLabelStyle(styleForNode(nivel + lv, cat, n.text), opts.labelFont)
        : styleForNode(nivel + lv, cat, n.text)
    const style = styleForCategory(base, cat, opts.categoryStyles, undefined, opts.labelFont)
    const caja = cajas.get(n.id)
    let pos = { x: cx + w(raiz) + 110, y: cy }
    if (caja && propia) {
      const dx = caja.x - propia.x - propia.w
      const y = cy + (caja.y + caja.h / 2 - (propia.y + propia.h / 2)) - caja.h / 2
      pos = izquierda ? { x: cx - dx - caja.w, y } : { x: cx + w(raiz) + dx, y }
    }
    const texto = n.table ? n.table.title : n.text
    const revisado = revisados.has(texto.replace(/\s+/g, ' ').trim())
    // La página es la del OTRO documento: se dice cuál, como sección (el chip de origen la enseña).
    const pag = ia?.pagina ?? ia?.diapositiva
    const iaOrigen: NodoIA | undefined =
      ia && opts.origen
        ? {
            ...ia,
            pagina: undefined,
            diapositiva: undefined,
            ...(pag ? { seccion: `${opts.origen}, ${ia.diapositiva ? 'diap.' : 'pág.'} ${pag}`.slice(0, 80) } : {}),
          }
        : ia
    const iaFinal: NodoIA | undefined = opts.marcarNuevos
      ? { ...(iaOrigen ?? {}), dudoso: iaOrigen?.dudoso ?? 'nuevo' }
      : iaOrigen
        ? { ...ia, ...(revisado ? { revisado: true } : {}) }
        : undefined
    const parentId = idNuevo.get(n.parentId) as string
    nuevosNodos.push({
      ...plantilla,
      id: nid,
      position: pos,
      measured: undefined,
      width: undefined,
      height: undefined,
      selected: false,
      hidden: false,
      data: {
        label: n.table ? tableToLabel(n.table) : sanitizeLabelHtml(n.text),
        style,
        parentId,
        category: cat,
        ...(n.table ? { table: n.table } : {}),
        ...(iaFinal ? { ia: iaFinal } : {}),
        isEditing: false,
        isFocused: false,
        isNew: false,
        isRemoving: false,
      },
    } as unknown as N)
    nuevasLineas.push({
      id: `e-${parentId}-${nid}`,
      source: parentId,
      target: nid,
      sourceHandle: null,
      targetHandle: null,
      type: 'animated',
      data: { variant: 'solid', color: categoryAccent(cat, opts.categoryStyles), strokeWidth: 1.8, isAnimating: false },
    } as unknown as E)
  }

  // Al añadir: todo el bloque nuevo, debajo de lo que ya había.
  if (fondo !== null && nuevosNodos.length) {
    const arriba = Math.min(...nuevosNodos.map((n) => n.position.y))
    const bajar = fondo + 30 - arriba
    for (const n of nuevosNodos) n.position = { x: n.position.x, y: n.position.y + bajar }
  }
  const quedan = nodes
    .filter((n) => !viejos.has(n.id))
    // La rama se ve: si estaba plegada, se despliega.
    .map((n) => (n.id === id && n.data.collapsed ? ({ ...n, data: { ...n.data, collapsed: false } } as N) : n))
  return {
    nodes: [...quedan, ...nuevosNodos],
    edges: [...edges.filter((e) => !viejos.has(e.source) && !viejos.has(e.target)), ...nuevasLineas],
    nuevos: nuevosNodos.map((n) => n.id),
  }
}
