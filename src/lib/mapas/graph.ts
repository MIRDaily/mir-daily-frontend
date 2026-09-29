import { computeLayout } from '@/lib/mapas/layout'
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

export type GraphShape = 'rectangle' | 'pill' | 'circle' | 'diamond'
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
    category?: MapCategoryId
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

/** Lo que el usuario ha redefinido de una categoría en ESTE mapa: su color y/o su forma. */
export type CategoryStyleOverride = { color?: string; shape?: GraphShape }
export type CategoryStyles = Partial<Record<MapCategoryId, CategoryStyleOverride>>

export type GraphDoc = {
  version: 2
  nodes: GraphNode[]
  edges: GraphEdge[]
  settings?: { theme?: 'light' | 'dark'; bgStyle?: GraphBgStyle; categoryStyles?: CategoryStyles }
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
const SHAPES: GraphShape[] = ['rectangle', 'pill', 'circle', 'diamond']
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
): GraphNodeStyle {
  const accent = categoryAccent(category, overrides)
  const shape = overrides?.[category]?.shape
  const filled = current.borderWidth === 0
  return {
    ...current,
    ...(shape ? { shape } : {}),
    color: filled ? accent : current.color,
    borderColor: filled ? current.borderColor : accent,
    glowColor: accent,
    textColor: filled ? '#FFFFFF' : current.textColor,
  }
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
  const boxes = computeLayout(doc, { gapX: 110, gapY: 18 })

  const nodes: GraphNode[] = doc.nodes.map((n) => {
    const level = levelOf(n)
    const style = styleForNode(level, n.category, n.text)
    const box = boxes.get(n.id)
    const isCircle = style.shape === 'circle'
    return {
      id: n.id,
      type: 'mindmap',
      position: { x: box?.x ?? 0, y: box?.y ?? 0 },
      ...(isCircle ? { width: ROOT_CIRCLE, height: ROOT_CIRCLE } : {}),
      data: {
        label: n.text,
        style,
        ...(n.parentId ? { parentId: n.parentId } : {}),
        category: n.category,
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
    if (entry.color || entry.shape) out[key as MapCategoryId] = entry
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
    nodes.push({
      id,
      type: 'mindmap',
      position: { x: num(pos.x, -100000, 100000, 0), y: num(pos.y, -100000, 100000, 0) },
      ...(w ? { width: w } : {}),
      ...(h ? { height: h } : {}),
      data: {
        label: str(data.label, 4000, ''),
        style: sanitizeStyle(data.style),
        ...(typeof data.parentId === 'string' ? { parentId: data.parentId.slice(0, 80) } : {}),
        ...(category ? { category } : {}),
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
  const settings: GraphDoc['settings'] | undefined = s
    ? {
        ...(s.theme === 'light' || s.theme === 'dark' ? { theme: s.theme as 'light' | 'dark' } : {}),
        ...(BG_STYLES.includes(s.bgStyle as GraphBgStyle) ? { bgStyle: s.bgStyle as GraphBgStyle } : {}),
        ...(categoryStyles && Object.keys(categoryStyles).length ? { categoryStyles } : {}),
      }
    : undefined

  return { version: 2, nodes, edges, ...(settings && Object.keys(settings).length ? { settings } : {}) }
}

// ---------------------------------------------------------------------------
// Autoordenado de un grafo (usa la jerarquía lógica, no las posiciones)
// ---------------------------------------------------------------------------

type LayoutNode = { id: string; data: { label: string; parentId?: string } }
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
    const boxes = computeLayout({ version: 1, nodes: ordered }, { gapX: 110, gapY: 18, sizeOf })

    let maxY = 0
    for (const b of boxes.values()) maxY = Math.max(maxY, b.y + b.h)
    for (const [id, b] of boxes) out.set(id, { x: b.x, y: b.y + cursorY })
    cursorY += maxY + 90
  }
  return out
}
