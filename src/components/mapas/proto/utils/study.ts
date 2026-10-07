import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import { isCoverable } from '@/lib/mapas/study'

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

/** Ids de las hojas que se tapan en el modo estudio. */
export function coverableIds(): string[] {
  return useMindMapStore
    .getState()
    .nodes.filter(isCoverable)
    .map((n) => n.id)
}

/** Hojas tapables de esas ramas (los propios nodos si son hojas). */
export function branchLeaves(ids: string[]): string[] {
  const { nodes, edges } = useMindMapStore.getState()
  const children = childrenMap(parentMap(nodes, edges))
  const scope = new Set([...ids, ...descendantsOf(ids, children)])
  return nodes.filter((n) => scope.has(n.id) && isCoverable(n)).map((n) => n.id)
}

/** Destapa las hojas de esas ramas; si ya estaban todas destapadas, las vuelve a tapar. */
export function toggleBranchReveal(ids: string[]) {
  const leaves = branchLeaves(ids)
  if (leaves.length === 0) return
  const ui = useUIStore.getState()
  const allShown = leaves.every((id) => ui.revealed.has(id))
  ui.setRevealed(leaves, !allShown)
}

/** Destapa o tapa una sola hoja. */
export function toggleLeafReveal(id: string) {
  const ui = useUIStore.getState()
  ui.setRevealed([id], !ui.revealed.has(id))
}

/** Destapa todo el mapa. */
export function revealAll() {
  useUIStore.getState().setRevealed(coverableIds(), true)
}
