import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import { parseColor, toCss } from '@/lib/mapas/export/color'
import { parseLabel, plainText } from '@/lib/mapas/export/richtext'
import { parsePath, type SceneEdge, type SceneNode, type Section } from '@/lib/mapas/export/scene'

// Del editor a una escena: nodos con su posición y medida reales (store) y líneas tal como están
// dibujadas ahora mismo (el atributo `d` de sus rutas en el DOM, que ya lleva el cálculo de lados y
// esquivos). Solo entra lo visible: una rama plegada no sale, como en pantalla.

export type Scope = 'all' | 'selection' | 'branches'

function cssColor(value: string, fallback: string): string {
  const c = parseColor(value, { r: -1, g: 0, b: 0, a: 1 })
  return c.r < 0 ? fallback : toCss(c)
}

function readEdges(): Map<string, Pick<SceneEdge, 'cmds' | 'color' | 'width' | 'dash'>> {
  const out = new Map<string, Pick<SceneEdge, 'cmds' | 'color' | 'width' | 'dash'>>()
  document.querySelectorAll<SVGGElement>('.react-flow__edge[data-id]').forEach((g) => {
    const id = g.dataset.id
    if (!id) return
    // Cada línea lleva dos rutas: una transparente (para poder hacer clic) y la visible.
    const visible = [...g.querySelectorAll<SVGPathElement>('path')].find((p) => p.getAttribute('stroke') !== 'transparent')
    const d = visible?.getAttribute('d')
    if (!visible || !d) return
    const cs = getComputedStyle(visible)
    const dashRaw = cs.strokeDasharray
    const dash =
      dashRaw && dashRaw !== 'none'
        ? dashRaw.split(/[ ,]+/).map((v) => parseFloat(v)).filter((v) => Number.isFinite(v) && v > 0)
        : null
    out.set(id, {
      cmds: parsePath(d),
      color: cssColor(cs.stroke, '#7D8A96'),
      width: parseFloat(cs.strokeWidth) || 1.5,
      dash: dash && dash.length ? dash : null,
    })
  })
  return out
}

function build(ids: Set<string> | null, title: string): Section {
  const { nodes, edges } = useMindMapStore.getState()
  const geo = readEdges()
  const sceneNodes: SceneNode[] = []
  const included = new Set<string>()
  for (const n of nodes) {
    if (n.hidden || (ids && !ids.has(n.id))) continue
    const w = n.measured?.width ?? (typeof n.width === 'number' ? n.width : undefined)
    const h = n.measured?.height ?? (typeof n.height === 'number' ? n.height : undefined)
    if (!w || !h) continue
    const st = n.data.style
    sceneNodes.push({
      id: n.id,
      parentId: n.data.parentId ?? null,
      x: n.position.x,
      y: n.position.y,
      w,
      h,
      shape: st.shape,
      fill: cssColor(st.color, '#FFFFFF'),
      stroke: cssColor(st.borderColor, '#EDE6DE'),
      strokeWidth: st.borderWidth,
      textColor: cssColor(st.textColor, '#2A2420'),
      fontFamily: st.fontFamily,
      fontSize: st.fontSize ?? 14,
      align: st.textAlign ?? 'center',
      paragraphs: parseLabel(n.data.label),
      ...(n.data.table ? { table: { ...n.data.table, solid: true } } : {}),
    })
    included.add(n.id)
  }
  const sceneEdges: SceneEdge[] = []
  for (const e of edges) {
    if (!included.has(e.source) || !included.has(e.target)) continue
    const g = geo.get(e.id)
    if (!g) continue
    sceneEdges.push({ id: e.id, source: e.source, target: e.target, ...g })
  }
  return { title, nodes: sceneNodes, edges: sceneEdges }
}

/** Las partes a exportar según lo elegido. Vacío si no hay nada que exportar. */
export function collectSections(scope: Scope): Section[] {
  const { nodes, edges } = useMindMapStore.getState()
  if (scope === 'all') return [build(null, '')]
  const parents = parentMap(nodes, edges)
  const children = childrenMap(parents)
  if (scope === 'selection') {
    const selected = nodes.filter((n) => n.selected && !n.hidden).map((n) => n.id)
    if (selected.length === 0) return []
    const ids = new Set([...selected, ...descendantsOf(selected, children)])
    return [build(ids, 'Selección')]
  }
  // Una hoja por rama principal (los hijos de la raíz), más una portada con el mapa entero.
  const labelOf = (id: string) => {
    const n = nodes.find((x) => x.id === id)
    // De una tabla, el título (su label es la tabla entera en texto).
    return (n?.data.table ? n.data.table.title : plainText(n?.data.label ?? '')) || 'Sin título'
  }
  const roots = nodes.filter((n) => !n.hidden && !parents.has(n.id))
  const sections: Section[] = [build(null, 'Mapa completo')]
  for (const root of roots) {
    const kids = (children.get(root.id) ?? [])
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => !!n && !n.hidden)
      .sort((a, b) => a.position.y - b.position.y)
    for (const kid of kids) {
      const ids = new Set([kid.id, ...descendantsOf([kid.id], children)])
      sections.push(build(ids, `${labelOf(root.id)}  ›  ${labelOf(kid.id)}`))
    }
  }
  return sections
}
