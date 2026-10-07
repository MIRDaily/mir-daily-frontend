import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import { studyUnits } from '@/lib/mapas/study'

// Acciones del modo estudio (informe 75): qué se puede tapar, destapar una rama, tapar todo.
// Lo destapado es estado de la interfaz: no se guarda ni entra en deshacer.

/** Entra o sale del modo estudio. Cierra antes lo que sirve para editar. */
export function setStudyMode(on: boolean) {
  const ui = useUIStore.getState()
  if (on) {
    useMindMapStore.getState().setEditing(null)
    ui.setStylePanelOpen(false)
    ui.setTableEditor(null)
    ui.setCategoriesPanelOpen(false)
  }
  ui.setStudyMode(on)
}

/** Todo lo que se tapa en el modo estudio: hojas y, en las tablas, cada celda de datos. */
export function coverableUnits(): string[] {
  return useMindMapStore.getState().nodes.flatMap(studyUnits)
}

/** Lo tapable de esas ramas (los propios nodos si son hojas; las tablas, celda a celda). */
export function branchUnits(ids: string[]): string[] {
  const { nodes, edges } = useMindMapStore.getState()
  const children = childrenMap(parentMap(nodes, edges))
  const scope = new Set([...ids, ...descendantsOf(ids, children)])
  return nodes.filter((n) => scope.has(n.id)).flatMap(studyUnits)
}

/**
 * Destapa esas ramas enteras (hojas y todas las celdas de sus tablas); si ya estaba todo
 * destapado, lo vuelve a tapar.
 */
export function toggleBranchReveal(ids: string[]) {
  const units = branchUnits(ids)
  if (units.length === 0) return
  const ui = useUIStore.getState()
  const allShown = units.every((u) => ui.revealed.has(u))
  ui.setRevealed(units, !allShown)
}

/** Destapa o tapa una sola cosa: una hoja o una celda (clave de `cellKey`). */
export function toggleUnitReveal(key: string) {
  const ui = useUIStore.getState()
  ui.setRevealed([key], !ui.revealed.has(key))
}

/** Destapa todo el mapa. */
export function revealAll() {
  useUIStore.getState().setRevealed(coverableUnits(), true)
}
