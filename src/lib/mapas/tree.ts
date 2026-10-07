import { MAP_CATEGORIES, type MapCategoryId, type MapDoc, type MapNode } from '@/lib/mapas/types'
import { sanitizeTable } from '@/lib/mapas/table'
import { sanitizeIA } from '@/lib/mapas/ia/revision'

let counter = 0
export function newNodeId(): string {
  counter += 1
  return `n${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function createDoc(rootText = 'Tema principal'): MapDoc {
  return {
    version: 1,
    nodes: [{ id: newNodeId(), parentId: null, text: rootText, category: 'general' }],
  }
}

export function getRoot(doc: MapDoc): MapNode {
  return doc.nodes.find((n) => n.parentId === null) ?? doc.nodes[0]
}

export function childrenOf(doc: MapDoc, id: string): MapNode[] {
  return doc.nodes.filter((n) => n.parentId === id)
}

export function findNode(doc: MapDoc, id: string): MapNode | undefined {
  return doc.nodes.find((n) => n.id === id)
}

export function descendantIds(doc: MapDoc, id: string): Set<string> {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop() as string
    for (const c of childrenOf(doc, cur)) {
      if (!out.has(c.id)) {
        out.add(c.id)
        stack.push(c.id)
      }
    }
  }
  return out
}

function lastSubtreeIndexIn(nodes: MapNode[], id: string): number {
  const doc: MapDoc = { version: 1, nodes }
  const ids = descendantIds(doc, id)
  ids.add(id)
  let last = -1
  nodes.forEach((n, i) => {
    if (ids.has(n.id)) last = i
  })
  return last
}

/** Hijo nuevo al final de los hijos del padre; hereda su categoría y despliega al padre. */
export function addChild(doc: MapDoc, parentId: string): { doc: MapDoc; id: string } {
  const parent = findNode(doc, parentId)
  if (!parent) return { doc, id: parentId }
  const id = newNodeId()
  const node: MapNode = { id, parentId, text: 'Nueva idea', category: parent.category }
  const nodes = doc.nodes.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n))
  // Insertar tras el último descendiente del padre mantiene el array agrupado.
  nodes.splice(lastSubtreeIndexIn(nodes, parentId) + 1, 0, node)
  return { doc: { ...doc, nodes }, id }
}

/** Hermano justo después del nodo. La raíz no tiene hermanos: se crea un hijo. */
export function addSibling(doc: MapDoc, id: string): { doc: MapDoc; id: string } {
  const node = findNode(doc, id)
  if (!node || node.parentId === null) return addChild(doc, id)
  const newId = newNodeId()
  const sib: MapNode = { id: newId, parentId: node.parentId, text: 'Nueva idea', category: node.category }
  const nodes = doc.nodes.slice()
  nodes.splice(lastSubtreeIndexIn(nodes, id) + 1, 0, sib)
  return { doc: { ...doc, nodes }, id: newId }
}

/** Borra el nodo y todo lo que cuelga de él. La raíz no se borra. */
export function removeSubtree(doc: MapDoc, id: string): MapDoc {
  const node = findNode(doc, id)
  if (!node || node.parentId === null) return doc
  const gone = descendantIds(doc, id)
  gone.add(id)
  return { ...doc, nodes: doc.nodes.filter((n) => !gone.has(n.id)) }
}

export function updateNode(
  doc: MapDoc,
  id: string,
  patch: Partial<Omit<MapNode, 'id' | 'parentId'>>,
): MapDoc {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }
}

/** Cambia la categoría del nodo; con `withSubtree` también la de sus descendientes. */
export function setCategory(doc: MapDoc, id: string, category: MapCategoryId, withSubtree = false): MapDoc {
  const ids = withSubtree ? descendantIds(doc, id) : new Set<string>()
  ids.add(id)
  return { ...doc, nodes: doc.nodes.map((n) => (ids.has(n.id) ? { ...n, category } : n)) }
}

/** Reparenta `id` bajo `newParentId` (al final). Evita ciclos y mover la raíz. */
export function moveNode(doc: MapDoc, id: string, newParentId: string): MapDoc {
  const node = findNode(doc, id)
  if (!node || node.parentId === null || node.parentId === newParentId) return doc
  if (id === newParentId || descendantIds(doc, id).has(newParentId)) return doc
  const moving = descendantIds(doc, id)
  moving.add(id)
  const block = doc.nodes
    .filter((n) => moving.has(n.id))
    .map((n) => (n.id === id ? { ...n, parentId: newParentId } : n))
  const rest = doc.nodes.filter((n) => !moving.has(n.id))
  rest.splice(lastSubtreeIndexIn(rest, newParentId) + 1, 0, ...block)
  const nodes = rest.map((n) => (n.id === newParentId && n.collapsed ? { ...n, collapsed: false } : n))
  return { ...doc, nodes }
}

/** Sube o baja el nodo (con toda su rama) entre sus hermanos. */
export function reorderSibling(doc: MapDoc, id: string, dir: -1 | 1): MapDoc {
  const node = findNode(doc, id)
  if (!node || node.parentId === null) return doc
  const sibs = childrenOf(doc, node.parentId)
  const i = sibs.findIndex((s) => s.id === id)
  const other = sibs[i + dir]
  if (!other) return doc

  const blockOf = (nid: string) => {
    const ids = descendantIds(doc, nid)
    ids.add(nid)
    return doc.nodes.filter((n) => ids.has(n.id))
  }
  const mine = blockOf(id)
  const theirs = blockOf(other.id)
  const upper = dir === -1 ? other.id : id
  const startIdx = doc.nodes.findIndex((n) => n.id === upper)
  const both = new Set([...mine, ...theirs].map((n) => n.id))
  const rest = doc.nodes.filter((n) => !both.has(n.id))
  const at = doc.nodes.slice(0, startIdx).filter((n) => !both.has(n.id)).length
  rest.splice(at, 0, ...(dir === -1 ? [...mine, ...theirs] : [...theirs, ...mine]))
  return { ...doc, nodes: rest }
}

/** Valida y sanea un documento leído de fuera (BD, JSON importado, futura IA). */
export function sanitizeDoc(raw: unknown): MapDoc {
  const src = raw && typeof raw === 'object' ? (raw as { nodes?: unknown }).nodes : null
  const list = Array.isArray(src) ? src : []
  const seen = new Set<string>()
  const nodes: MapNode[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const id = typeof r.id === 'string' && r.id ? r.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    const category =
      typeof r.category === 'string' && r.category in MAP_CATEGORIES ? (r.category as MapCategoryId) : 'general'
    const text = typeof r.text === 'string' ? r.text.slice(0, 2000) : ''
    // Tabla: en el árbol el título va en `text` (así la escribe la IA); si la tabla trae el suyo, vale ese.
    const table = sanitizeTable(r.table, text)
    const ia = sanitizeIA(r.ia)
    nodes.push({
      id,
      parentId: typeof r.parentId === 'string' ? r.parentId : null,
      text: table ? table.title : text,
      category,
      ...(r.collapsed === true ? { collapsed: true } : {}),
      ...(table ? { table } : {}),
      ...(ia ? { ia } : {}),
    })
  }
  const root = nodes.find((n) => n.parentId === null) ?? nodes[0]
  if (!root) return createDoc()
  // La raíz no puede ser una tabla: se queda con su título.
  if (root.table) delete root.table
  const ids = new Set(nodes.map((n) => n.id))
  // Huérfanos, raíces sobrantes y autorreferencias cuelgan de la raíz.
  const fixed = nodes.map((n) => {
    if (n.id === root.id) return { ...n, parentId: null }
    if (n.parentId === null || !ids.has(n.parentId) || n.parentId === n.id) return { ...n, parentId: root.id }
    return n
  })
  // Rompe ciclos: un nodo que no llega a la raíz se cuelga de ella.
  const byId = new Map(fixed.map((n) => [n.id, n]))
  const out = fixed.map((n) => {
    const path = new Set<string>()
    let cur: MapNode | undefined = n
    while (cur && cur.parentId !== null) {
      if (path.has(cur.id)) return { ...n, parentId: root.id }
      path.add(cur.id)
      cur = byId.get(cur.parentId)
    }
    return n
  })
  return { version: 1, nodes: out }
}
