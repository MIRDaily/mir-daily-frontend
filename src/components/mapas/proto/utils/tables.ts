import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { revealNode, selectOnly } from '@/components/mapas/proto/utils/keyboard'
import type { MapTable } from '@/lib/mapas/table'

// Acciones del editor sobre los nodos tabla. Una tabla se edita en su popup (TableEditorDialog):
// trabaja sobre una copia y al cerrarlo la guarda con editTable, un solo paso de deshacer.

const same = (a: MapTable, b: MapTable) => JSON.stringify(a) === JSON.stringify(b)

/** Cambia la tabla de un nodo con un paso de deshacer. No hace nada si no cambia. */
export function editTable(id: string, fn: (t: MapTable) => MapTable) {
  const store = useMindMapStore.getState()
  const current = store.nodes.find((n) => n.id === id)?.data.table
  if (!current) return
  const next = fn(current)
  if (next === current || same(next, current)) return
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  store.updateTable(id, () => next)
}

/**
 * Abre el popup de la tabla en una celda (fila -2 = título, -1 = cabecera). `seed`: texto que
 * sustituye al de la celda. `select`: con su contenido seleccionado (al llegar con el teclado).
 */
export function openTableEditor(id: string, r = -1, c = 0, seed: string | null = null, select = false) {
  if (!isTableNode(id)) return
  useMindMapStore.getState().setEditing(null)
  useUIStore.getState().setTableEditor({ id, r, c, seed, select })
}

/** Tabla nueva colgando del nodo (o suelta), seleccionada y abierta en su popup. */
export function addTableAndEdit(parentId?: string): string {
  const store = useMindMapStore.getState()
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  const id = store.addTable(parentId)
  selectOnly(id)
  requestAnimationFrame(() => revealNode(id))
  openTableEditor(id, -1, 0, null, true)
  return id
}

/** ¿Es un nodo tabla? */
export function isTableNode(id: string): boolean {
  return !!useMindMapStore.getState().nodes.find((n) => n.id === id)?.data.table
}
