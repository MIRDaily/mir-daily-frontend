import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

// Jerarquía del mapa, con la misma regla que el autoordenado (`autoLayoutGraph`): el padre de un
// nodo es `data.parentId` o, si no lo tiene (unido a mano), el origen de la primera arista que
// llega a él.

type TreeNode = Pick<MindMapNode, 'id'> & { data: { parentId?: string } }
type TreeEdge = Pick<MindMapEdge, 'source' | 'target'>

export function parentMap(nodes: TreeNode[], edges: TreeEdge[]): Map<string, string> {
  const ids = new Set(nodes.map((n) => n.id))
  const out = new Map<string, string>()
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target && !out.has(e.target)) {
      out.set(e.target, e.source)
    }
  }
  for (const n of nodes) {
    const p = n.data.parentId
    if (p && p !== n.id && ids.has(p)) out.set(n.id, p)
  }
  return out
}

export function childrenMap(parents: Map<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [child, parent] of parents) {
    const list = out.get(parent)
    if (list) list.push(child)
    else out.set(parent, [child])
  }
  return out
}

/** Todos los descendientes de `roots` (sin incluirlos). A prueba de ciclos. */
export function descendantsOf(roots: Iterable<string>, children: Map<string, string[]>): Set<string> {
  const rootSet = new Set(roots)
  const out = new Set<string>()
  const stack = [...rootSet]
  while (stack.length) {
    const id = stack.pop()!
    for (const c of children.get(id) ?? []) {
      if (out.has(c) || rootSet.has(c)) continue
      out.add(c)
      stack.push(c)
    }
  }
  return out
}

/**
 * Recalcula qué se ve según las ramas plegadas: oculta los descendientes de cada nodo con
 * `collapsed` (y sus líneas) y deja en cada nodo lo que pinta su botón de plegar: cuántos hijos
 * tiene, cuántos nodos esconde y hacia qué lado salen sus hijos. Muta los nodos que recibe
 * (borrador de immer).
 */
export function syncCollapse(nodes: MindMapNode[], edges: MindMapEdge[]) {
  const parents = parentMap(nodes, edges)
  const children = childrenMap(parents)
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const hidden = new Set<string>()
  for (const n of nodes) {
    if (n.data.collapsed && children.has(n.id)) {
      for (const d of descendantsOf([n.id], children)) hidden.add(d)
    }
  }

  for (const n of nodes) {
    const kids = children.get(n.id) ?? []
    const isHidden = hidden.has(n.id)
    if (!!n.hidden !== isHidden) n.hidden = isHidden
    const childCount = kids.length
    const hiddenCount = n.data.collapsed && childCount ? descendantsOf([n.id], children).size : 0
    let childSide: 'left' | 'right' = 'right'
    if (childCount) {
      const w = n.measured?.width ?? 160
      const cx = n.position.x + w / 2
      let left = 0
      for (const k of kids) {
        const kn = byId.get(k)
        if (kn && kn.position.x + (kn.measured?.width ?? 160) / 2 < cx) left++
      }
      if (left > childCount / 2) childSide = 'left'
    }
    if (n.data.childCount !== childCount) n.data.childCount = childCount
    if (n.data.hiddenCount !== hiddenCount) n.data.hiddenCount = hiddenCount
    if (n.data.childSide !== childSide) n.data.childSide = childSide
  }

  for (const e of edges) {
    const isHidden = hidden.has(e.source) || hidden.has(e.target)
    if (!!e.hidden !== isHidden) e.hidden = isHidden
  }
}
