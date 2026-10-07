import { sanitizeLabelHtml } from '@/lib/mapas/labelHtml'
import { computeLayout } from '@/lib/mapas/layout'
import { sanitizeTable, tableToLabel, type MapTable } from '@/lib/mapas/table'
import { sanitizeIA, type NodoIA } from '@/lib/mapas/ia/revision'

// Margen extra entre hermanos: [hijos de la raíz = BLOQUES, hijos de los bloques, ...].
// Separa los bloques de un mapa grande (p. ej. generado con IA) para que no se pegue todo.
export const LAYOUT_DEPTH_GAPS = [60, 22]
// Con tantos bloques o más colgando de la raíz, el mapa se abre a ambos lados.
export const LAYOUT_TWO_SIDED_FROM = 8
import { sanitizeDoc } from '@/lib/mapas/tree'
import { MAP_CATEGORIES, type MapCategoryId, type MapDoc, type MapNode } from '@/lib/mapas/types'

// Formato en el que el editor guarda el mapa (versión 2): el grafo del
// prototipo —nodos con posición y estilo propios, aristas con su estilo— más la
// categoría MIR y el padre lógico de cada nodo.
//
// El ÁRBOL (`MapDoc`, versión 1) sigue siendo el formato de intercambio simple:
// es lo que escribirá la IA y lo que se importa a mano. `toGraphDoc` lo
// convierte al abrirlo (estilo por nivel y categoría, posiciones por autolayout).

export const GRAPH_MAX_NODES = 5000

/** `label` (rótulo): texto pequeño en mayúsculas, sin caja; para los subgrupos («Concepto y epidemiología»). */
export type GraphShape = 'rectangle' | 'pill' | 'circle' | 'diamond' | 'label'
export type GraphEdgeVariant = 'solid' | 'dashed' | 'dotted'
export type GraphBgStyle = 'flat' | 'dots-light' | 'dots'

export type GraphNodeStyle = {
  color: string
  borderColor: string
  borderWidth: number
  glowColor: string
  glowIntensity: number
  shape: GraphShape
  textColor: string
  fontSize: number
  fontFamily: string
  textAlign: 'left' | 'center' | 'right'
}

export type GraphNode = {
  id: string
  type: 'mindmap'
  position: { x: number; y: number }
  width?: number
  height?: number
  data: {
    label: string
    style: GraphNodeStyle
    /** Padre lógico (jerarquía), independiente de dónde esté dibujado. */
    parentId?: string
    /** Rama plegada en el editor. */
    collapsed?: boolean
    category?: MapCategoryId
    /** Nodo tabla: `label` es entonces una copia en texto de la tabla (ver `table.ts`). */
    table?: MapTable
    /** Generado con IA: anclaje, página de origen y revisión (ver `ia/revision.ts`). */
    ia?: NodoIA
  }
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle: string | null
  targetHandle: string | null
  type: 'animated'
  data: {
    variant?: GraphEdgeVariant
    color?: string
    strokeWidth?: number
    label?: string
  }
}

/**
 * Lo que el usuario ha redefinido de una categoría en ESTE mapa. Todo es opcional: lo que falta
 * sigue el estilo de serie.
 *  - `color`: el color de la categoría (acento): líneas que llegan al nodo, brillo, chip, y relleno
 *    o borde por defecto del nodo.
 *  - `fill` / `border` / `borderWidth` / `textColor`: relleno, borde y texto de los nodos.
 *  - `fontFamily` / `fontSize`: tipografía. `label`: el título de la categoría.
 */
export type CategoryStyleOverride = {
  color?: string
  shape?: GraphShape
  label?: string
  fill?: string
  border?: string
  borderWidth?: number
  textColor?: string
  fontFamily?: string
  fontSize?: number
}
export type CategoryStyles = Partial<Record<MapCategoryId, CategoryStyleOverride>>

/**
 * Cómo se ven los rótulos (forma `label`) en ESTE mapa (pestaña «Rótulos» de Categorías). Todo es
 * opcional: lo que falta sigue el estilo de serie (gris en el mapa, oscuro en el modo estudio,
 * mayúsculas). `fontSize` es el de los rótulos nuevos; al cambiarlo se aplica a los que ya hay.
 */
export type LabelStyle = { color?: string; studyColor?: string; fontSize?: number; upper?: boolean }

export type GraphDoc = {
  version: 2
  nodes: GraphNode[]
  edges: GraphEdge[]
  settings?: { theme?: 'light' | 'dark'; bgStyle?: GraphBgStyle; categoryStyles?: CategoryStyles; labelStyle?: LabelStyle }
}

/** Lo que puede haber guardado o importado. */
export type StoredDoc = MapDoc | GraphDoc

export const DEFAULT_GRAPH_STYLE: GraphNodeStyle = {
  color: '#FFFFFF',
  borderColor: '#EDE6DE',
  borderWidth: 1,
  glowColor: '#E8A598',
  glowIntensity: 0,
  shape: 'rectangle',
  textColor: '#2A2420',
  fontSize: 14,
  fontFamily: 'Lexend',
  textAlign: 'center',
}

const ROOT_COLOR = '#E8A598'
const SHAPES: GraphShape[] = ['rectangle', 'pill', 'circle', 'diamond', 'label']
const VARIANTS: GraphEdgeVariant[] = ['solid', 'dashed', 'dotted']
const BG_STYLES: GraphBgStyle[] = ['flat', 'dots-light', 'dots']
const ALIGNS = ['left', 'center', 'right'] as const

// ---------------------------------------------------------------------------
// Estilo por defecto según la posición del nodo en el árbol
// ---------------------------------------------------------------------------

export function styleForNode(level: number, category: MapCategoryId, label: string): GraphNodeStyle {
  const cat = MAP_CATEGORIES[category]
  if (level === 0) {
    const accent = category === 'general' ? ROOT_COLOR : cat.color
    return {
      ...DEFAULT_GRAPH_STYLE,
      shape: label.length <= 16 ? 'circle' : 'pill',
      color: accent,
      borderWidth: 0,
      glowColor: accent,
      textColor: '#FFFFFF',
    }
  }
  if (level === 1) {
    return {
      ...DEFAULT_GRAPH_STYLE,
      shape: 'pill',
      color: cat.color,
      borderWidth: 0,
      glowColor: cat.color,
      textColor: '#FFFFFF',
    }
  }
  return {
    ...DEFAULT_GRAPH_STYLE,
    shape: 'rectangle',
    color: '#FFFFFF',
    borderColor: cat.color,
    borderWidth: 2,
    glowColor: cat.color,
    textColor: '#2A2420',
  }
}

/** Color de acento de una categoría: el que ha puesto el usuario o el de serie. */
export function categoryAccent(category: MapCategoryId, overrides?: CategoryStyles): string {
  return overrides?.[category]?.color ?? MAP_CATEGORIES[category].color
}

/**
 * Estilo que aplica elegir (o redefinir) una categoría en un nodo. El color de la
 * categoría va al relleno si el nodo es macizo o al borde si es de contorno; la
 * forma solo cambia si el usuario ha fijado una para esa categoría. Tamaño de
 * letra, alineación y demás ajustes propios del nodo se conservan.
 */
export function styleForCategory(
  current: GraphNodeStyle,
  category: MapCategoryId,
  overrides?: CategoryStyles,
  /** Lo que tenía la categoría ANTES (si cambia) y el estilo de serie del nodo: lo que se quita de
   *  la categoría vuelve a lo natural en vez de quedarse con el valor viejo. */
  restore?: { prev?: CategoryStyleOverride; natural: GraphNodeStyle },
  /** Tamaño de letra de los rótulos de este mapa. */
  labelFont: number = LABEL_FONT_SIZE,
): GraphNodeStyle {
  const accent = categoryAccent(category, overrides)
  const o = overrides?.[category]
  const prev = restore?.prev
  const nat = restore?.natural
  // ¿Es un nodo macizo (relleno con el color de la categoría) o de contorno?
  const filled = (o?.borderWidth ?? current.borderWidth) === 0
  const out: GraphNodeStyle = {
    ...current,
    color: filled ? accent : current.color,
    borderColor: filled ? current.borderColor : accent,
    glowColor: accent,
    textColor: filled ? '#FFFFFF' : current.textColor,
  }
  if (o?.shape) out.shape = o.shape
  else if (prev?.shape && nat) out.shape = nat.shape
  // Un rótulo lleva letra de rótulo (salvo que la categoría fije otra); al dejar de serlo, vuelve
  // a la natural.
  if (out.shape === 'label' && current.shape !== 'label' && o?.fontSize === undefined) out.fontSize = labelFont
  else if (out.shape !== 'label' && current.shape === 'label' && o?.fontSize === undefined) out.fontSize = nat?.fontSize ?? 14
  const field = <K extends keyof GraphNodeStyle>(key: K, set: GraphNodeStyle[K] | undefined, was: unknown) => {
    if (set !== undefined) out[key] = set
    else if (was !== undefined && nat) out[key] = nat[key]
  }
  field('color', o?.fill, prev?.fill)
  field('borderColor', o?.border, prev?.border)
  field('borderWidth', o?.borderWidth, prev?.borderWidth)
  field('textColor', o?.textColor, prev?.textColor)
  field('fontFamily', o?.fontFamily, prev?.fontFamily)
  field('fontSize', o?.fontSize, prev?.fontSize)
  return out
}

/**
 * Estilo de serie de un nodo tabla: el de un nodo de detalle (contorno del color de la categoría),
 * esté donde esté. Un relleno macizo con letra blanca (el de los bloques) no sirve para una tabla.
 */
export function styleForTable(category: MapCategoryId): GraphNodeStyle {
  return styleForNode(2, category, '')
}

/** Tamaño de letra de un rótulo (forma `label`): menor que el de un nodo, va en mayúsculas. */
export const LABEL_FONT_SIZE = 11
/** Color de serie de un rótulo al exportar (en pantalla, gris en el mapa y oscuro en el modo estudio). */
export const LABEL_INK = '#7D8A96'

/**
 * Un nodo pasado a rótulo: forma `label` y letra pequeña; lo demás (categoría, colores de la línea)
 * se conserva. El borde se mantiene aunque no se dibuja: con borde 0, aplicar una categoría lo
 * trataría como nodo macizo (letra blanca).
 */
export function toLabelStyle(style: GraphNodeStyle, fontSize: number = LABEL_FONT_SIZE): GraphNodeStyle {
  return { ...style, shape: 'label', fontSize, borderWidth: Math.max(1, style.borderWidth) }
}

/** Ajustes de los rótulos leídos de fuera (BD, JSON importado): colores hexadecimales y tamaño acotado. */
export function sanitizeLabelStyle(raw: unknown): LabelStyle {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const hex = (x: unknown) => (typeof x === 'string' && HEX_COLOR.test(x) ? x : undefined)
  const out: LabelStyle = {}
  const color = hex(r.color)
  if (color) out.color = color
  const studyColor = hex(r.studyColor)
  if (studyColor) out.studyColor = studyColor
  if (typeof r.fontSize === 'number' && Number.isFinite(r.fontSize)) out.fontSize = Math.min(20, Math.max(8, Math.round(r.fontSize)))
  if (r.upper === false) out.upper = false
  return out
}

/** Título de una categoría: el que le ha puesto el usuario o el de serie. */
export function categoryLabel(category: MapCategoryId, overrides?: CategoryStyles): string {
  return overrides?.[category]?.label?.trim() || MAP_CATEGORIES[category].label
}

// ---------------------------------------------------------------------------
// Árbol → grafo
// ---------------------------------------------------------------------------

export const ROOT_CIRCLE = 116

/** Forma que tendría un nodo sin ningún ajuste del usuario, según su nivel en el árbol. */
export function naturalShape(level: number, label: string): GraphShape {
  return styleForNode(level, 'general', label).shape
}

export function newGraphDoc(rootLabel = 'Tema principal'): GraphDoc {
  return {
    version: 2,
    nodes: [
      {
        id: 'root',
        type: 'mindmap',
        position: { x: -ROOT_CIRCLE / 2, y: -ROOT_CIRCLE / 2 },
        width: ROOT_CIRCLE,
        height: ROOT_CIRCLE,
        data: { label: rootLabel, style: styleForNode(0, 'general', rootLabel), category: 'general' },
      },
    ],
    edges: [],
  }
}

/** Árbol → grafo con el aspecto del prototipo. Las posiciones son una primera pasada: el editor reordena con tamaños reales. */
export function treeToGraph(tree: MapDoc): GraphDoc {
  const doc = sanitizeDoc(tree)
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  const levelOf = (n: MapNode): number => {
    let l = 0
    for (let cur: MapNode | undefined = n; cur && cur.parentId !== null; cur = byId.get(cur.parentId)) l++
    return l
  }
  const boxes = computeLayout(doc, { gapX: 110, gapY: 18, depthGaps: LAYOUT_DEPTH_GAPS, twoSidedFrom: LAYOUT_TWO_SIDED_FROM })

  const nodes: GraphNode[] = doc.nodes.map((n) => {
    const level = levelOf(n)
    // Subgrupo marcado por la IA («Concepto y epidemiología»): nace como rótulo.
    const style = n.table
      ? styleForTable(n.category)
      : n.ia?.subgrupo
        ? toLabelStyle(styleForNode(level, n.category, n.text))
        : styleForNode(level, n.category, n.text)
    const box = boxes.get(n.id)
    const isCircle = style.shape === 'circle'
    return {
      id: n.id,
      type: 'mindmap',
      position: { x: box?.x ?? 0, y: box?.y ?? 0 },
      ...(isCircle ? { width: ROOT_CIRCLE, height: ROOT_CIRCLE } : {}),
      data: {
        // El texto del árbol (IA, archivo importado) se pinta como HTML: se sanea igual.
        label: n.table ? tableToLabel(n.table) : sanitizeLabelHtml(n.text),
        style,
        ...(n.parentId ? { parentId: n.parentId } : {}),
        category: n.category,
        ...(n.table ? { table: n.table } : {}),
        ...(n.ia ? { ia: n.ia } : {}),
      },
    }
  })

  const edges: GraphEdge[] = doc.nodes
    .filter((n) => n.parentId !== null)
    .map((n) => ({
      id: `e-${n.parentId}-${n.id}`,
      source: n.parentId as string,
      target: n.id,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'animated' as const,
      data: { variant: 'solid' as const, color: MAP_CATEGORIES[n.category].color, strokeWidth: 1.8 },
    }))

  return { version: 2, nodes, edges }
}

export function isGraphDoc(doc: unknown): doc is GraphDoc {
  return !!doc && typeof doc === 'object' && (doc as { version?: unknown }).version === 2
}

/** Cualquier documento guardado → grafo. `fromTree` avisa de que las posiciones son provisionales. */
export function toGraphDoc(raw: unknown): { doc: GraphDoc; fromTree: boolean } {
  if (isGraphDoc(raw)) return { doc: sanitizeGraph(raw), fromTree: false }
  return { doc: treeToGraph(sanitizeDoc(raw)), fromTree: true }
}

export function docNodeCount(raw: unknown): number {
  if (raw && typeof raw === 'object') {
    const nodes = (raw as { nodes?: unknown }).nodes
    if (Array.isArray(nodes)) return nodes.length
  }
  return 0
}

// ---------------------------------------------------------------------------
// Saneado (entrada no fiable: BD, archivo importado, IA)
// ---------------------------------------------------------------------------

const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

const str = (v: unknown, max: number, fallback: string) =>
  typeof v === 'string' ? v.slice(0, max) : fallback

function sanitizeStyle(raw: unknown): GraphNodeStyle {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_GRAPH_STYLE
  return {
    color: str(r.color, 40, d.color),
    borderColor: str(r.borderColor, 40, d.borderColor),
    borderWidth: num(r.borderWidth, 0, 12, d.borderWidth),
    glowColor: str(r.glowColor, 40, d.glowColor),
    glowIntensity: num(r.glowIntensity, 0, 1, d.glowIntensity),
    shape: SHAPES.includes(r.shape as GraphShape) ? (r.shape as GraphShape) : d.shape,
    textColor: str(r.textColor, 40, d.textColor),
    fontSize: num(r.fontSize, 8, 72, d.fontSize),
    fontFamily: str(r.fontFamily, 80, d.fontFamily),
    textAlign: ALIGNS.includes(r.textAlign as (typeof ALIGNS)[number])
      ? (r.textAlign as GraphNodeStyle['textAlign'])
      : d.textAlign,
  }
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export function sanitizeCategoryStyles(raw: unknown): CategoryStyles {
  const out: CategoryStyles = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in MAP_CATEGORIES) || !value || typeof value !== 'object') continue
    const v = value as Record<string, unknown>
    const entry: CategoryStyleOverride = {}
    if (typeof v.color === 'string' && HEX_COLOR.test(v.color)) entry.color = v.color
    if (SHAPES.includes(v.shape as GraphShape)) entry.shape = v.shape as GraphShape
    const hex = (x: unknown) => (typeof x === 'string' && HEX_COLOR.test(x) ? x : undefined)
    const label = typeof v.label === 'string' ? v.label.trim().slice(0, 40) : ''
    if (label) entry.label = label
    const fill = hex(v.fill)
    if (fill) entry.fill = fill
    const border = hex(v.border)
    if (border) entry.border = border
    const textColor = hex(v.textColor)
    if (textColor) entry.textColor = textColor
    if (typeof v.borderWidth === 'number' && Number.isFinite(v.borderWidth)) {
      entry.borderWidth = Math.min(8, Math.max(0, Math.round(v.borderWidth)))
    }
    if (typeof v.fontFamily === 'string' && v.fontFamily.length > 0 && v.fontFamily.length <= 80) entry.fontFamily = v.fontFamily
    if (typeof v.fontSize === 'number' && Number.isFinite(v.fontSize)) {
      entry.fontSize = Math.min(48, Math.max(8, Math.round(v.fontSize)))
    }
    if (Object.keys(entry).length > 0) out[key as MapCategoryId] = entry
  }
  return out
}

export function sanitizeGraph(raw: unknown): GraphDoc {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rawNodes = Array.isArray(src.nodes) ? src.nodes.slice(0, GRAPH_MAX_NODES) : []
  const rawEdges = Array.isArray(src.edges) ? src.edges : []

  const seen = new Set<string>()
  const nodes: GraphNode[] = []
  for (const item of rawNodes) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const id = typeof r.id === 'string' && r.id ? r.id.slice(0, 80) : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    const pos = r.position && typeof r.position === 'object' ? (r.position as Record<string, unknown>) : {}
    const data = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {}
    const category =
      typeof data.category === 'string' && data.category in MAP_CATEGORIES
        ? (data.category as MapCategoryId)
        : undefined
    const w = typeof r.width === 'number' && Number.isFinite(r.width) ? num(r.width, 20, 2000, 0) : 0
    const h = typeof r.height === 'number' && Number.isFinite(r.height) ? num(r.height, 20, 2000, 0) : 0
    // Tabla: se sanea entera y su label se REGENERA desde ella (no se fía del guardado).
    const table = sanitizeTable(data.table)
    const ia = sanitizeIA(data.ia)
    nodes.push({
      id,
      type: 'mindmap',
      position: { x: num(pos.x, -100000, 100000, 0), y: num(pos.y, -100000, 100000, 0) },
      ...(w ? { width: w } : {}),
      ...(h ? { height: h } : {}),
      data: {
        label: table ? tableToLabel(table) : sanitizeLabelHtml(str(data.label, 4000, '')),
        style: sanitizeStyle(data.style),
        ...(typeof data.parentId === 'string' ? { parentId: data.parentId.slice(0, 80) } : {}),
        ...(category ? { category } : {}),
        ...(data.collapsed === true ? { collapsed: true } : {}),
        ...(table ? { table } : {}),
        ...(ia ? { ia } : {}),
      },
    })
  }
  if (nodes.length === 0) return newGraphDoc()

  const ids = new Set(nodes.map((n) => n.id))
  // Un padre que no existe (o uno mismo) no es un padre.
  for (const n of nodes) {
    if (n.data.parentId && (!ids.has(n.data.parentId) || n.data.parentId === n.id)) delete n.data.parentId
  }

  const edgeIds = new Set<string>()
  const edges: GraphEdge[] = []
  for (const item of rawEdges) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const source = typeof r.source === 'string' ? r.source : ''
    const target = typeof r.target === 'string' ? r.target : ''
    if (!ids.has(source) || !ids.has(target) || source === target) continue
    let id = typeof r.id === 'string' && r.id ? r.id.slice(0, 120) : `e-${source}-${target}`
    while (edgeIds.has(id)) id += '_'
    edgeIds.add(id)
    const data = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {}
    edges.push({
      id,
      source,
      target,
      sourceHandle: typeof r.sourceHandle === 'string' ? r.sourceHandle.slice(0, 10) : null,
      targetHandle: typeof r.targetHandle === 'string' ? r.targetHandle.slice(0, 10) : null,
      type: 'animated',
      data: {
        ...(VARIANTS.includes(data.variant as GraphEdgeVariant) ? { variant: data.variant as GraphEdgeVariant } : {}),
        ...(typeof data.color === 'string' ? { color: data.color.slice(0, 40) } : {}),
        ...(typeof data.strokeWidth === 'number' ? { strokeWidth: num(data.strokeWidth, 0.5, 12, 1.8) } : {}),
        ...(typeof data.label === 'string' && data.label ? { label: data.label.slice(0, 200) } : {}),
      },
    })
  }

  const s = src.settings && typeof src.settings === 'object' ? (src.settings as Record<string, unknown>) : null
  const categoryStyles = s ? sanitizeCategoryStyles(s.categoryStyles) : undefined
  const labelStyle = s ? sanitizeLabelStyle(s.labelStyle) : undefined
  const settings: GraphDoc['settings'] | undefined = s
    ? {
        ...(s.theme === 'light' || s.theme === 'dark' ? { theme: s.theme as 'light' | 'dark' } : {}),
        ...(BG_STYLES.includes(s.bgStyle as GraphBgStyle) ? { bgStyle: s.bgStyle as GraphBgStyle } : {}),
        ...(categoryStyles && Object.keys(categoryStyles).length ? { categoryStyles } : {}),
        ...(labelStyle && Object.keys(labelStyle).length ? { labelStyle } : {}),
      }
    : undefined

  return { version: 2, nodes, edges, ...(settings && Object.keys(settings).length ? { settings } : {}) }
}

// ---------------------------------------------------------------------------
// Autoordenado de un grafo (usa la jerarquía lógica, no las posiciones)
// ---------------------------------------------------------------------------

type LayoutNode = { id: string; data: { label: string; parentId?: string; table?: MapTable } }
type LayoutEdge = { source: string; target: string }

/**
 * Coloca cada árbol del mapa de izquierda a derecha, y los árboles sueltos uno
 * debajo de otro. El padre de un nodo es `data.parentId` o, si no lo tiene, el
 * origen de la primera arista que llega a él.
 */
export function autoLayoutGraph(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  sizeOf?: (id: string) => { w: number; h: number } | undefined,
): Map<string, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id))
  const incoming = new Map<string, string>()
  for (const e of edges) {
    if (ids.has(e.source) && !incoming.has(e.target)) incoming.set(e.target, e.source)
  }
  const parentOf = new Map<string, string | null>()
  for (const n of nodes) {
    const p = n.data.parentId && ids.has(n.data.parentId) ? n.data.parentId : incoming.get(n.id)
    parentOf.set(n.id, p && p !== n.id ? p : null)
  }
  // Ciclos: un nodo que no llega a ninguna raíz pasa a ser raíz.
  for (const n of nodes) {
    const path = new Set<string>()
    let cur: string | null = n.id
    while (cur) {
      if (path.has(cur)) {
        parentOf.set(n.id, null)
        break
      }
      path.add(cur)
      cur = parentOf.get(cur) ?? null
    }
  }

  const rootOf = (id: string): string => {
    let cur = id
    for (let p = parentOf.get(cur); p; p = parentOf.get(cur)) cur = p
    return cur
  }
  const groups = new Map<string, LayoutNode[]>()
  for (const n of nodes) {
    const r = rootOf(n.id)
    const list = groups.get(r) ?? []
    list.push(n)
    groups.set(r, list)
  }

  const out = new Map<string, { x: number; y: number }>()
  let cursorY = 0
  for (const [rootId, members] of groups) {
    const tree: MapDoc = {
      version: 1,
      nodes: members.map((n) => ({
        id: n.id,
        parentId: n.id === rootId ? null : (parentOf.get(n.id) as string),
        text: n.data.label,
        category: 'general' as const,
        ...(n.data.table ? { table: n.data.table } : {}),
      })),
    }
    // El array debe empezar por la raíz y agrupar hijos: se ordena en profundidad.
    const kids = new Map<string | null, MapNode[]>()
    for (const n of tree.nodes) {
      const l = kids.get(n.parentId) ?? []
      l.push(n)
      kids.set(n.parentId, l)
    }
    const ordered: MapNode[] = []
    const walk = (n: MapNode) => {
      ordered.push(n)
      for (const c of kids.get(n.id) ?? []) walk(c)
    }
    for (const r of kids.get(null) ?? []) walk(r)
    const boxes = computeLayout({ version: 1, nodes: ordered }, { gapX: 110, gapY: 18, depthGaps: LAYOUT_DEPTH_GAPS, twoSidedFrom: LAYOUT_TWO_SIDED_FROM, sizeOf })

    let maxY = 0
    for (const b of boxes.values()) maxY = Math.max(maxY, b.y + b.h)
    for (const [id, b] of boxes) out.set(id, { x: b.x, y: b.y + cursorY })
    cursorY += maxY + 90
  }
  return out
}
