import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { revealNode, selectOnly } from '@/components/mapas/proto/utils/keyboard'
import type { MapTable } from '@/lib/mapas/table'

// Acciones del editor sobre los nodos tabla. Cada cambio es un paso de deshacer; la edición de
// celdas usa `editingNodeId` (como un texto) más la celda activa de la store de interfaz, así los
// atajos globales se apagan mientras se escribe en una celda.

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

let rev = 0

/**
 * Empieza a editar una celda (fila -2 = título, -1 = cabecera). `seed`: texto que sustituye al de
 * la celda. `select`: con su contenido seleccionado (al llegar con el teclado, como en Word).
 */
export function startTableEdit(id: string, r: number, c: number, seed: string | null = null, select = false) {
  rev += 1
  useUIStore.getState().setTableCell({ id, r, c, rev, select })
  useMindMapStore.getState().setEditing(id, seed)
}

export function stopTableEdit() {
  useUIStore.getState().setTableCell(null)
  useMindMapStore.getState().setEditing(null)
}

/** Tabla nueva colgando del nodo (o suelta), seleccionada y con su primera cabecera en edición. */
export function addTableAndEdit(parentId?: string): string {
  const store = useMindMapStore.getState()
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  const id = store.addTable(parentId)
  selectOnly(id)
  startTableEdit(id, -1, 0, null, true)
  requestAnimationFrame(() => revealNode(id))
  return id
}

/** ¿Es un nodo tabla? */
export function isTableNode(id: string): boolean {
  return !!useMindMapStore.getState().nodes.find((n) => n.id === id)?.data.table
}
