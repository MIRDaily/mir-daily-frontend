import { useUIStore } from '@/components/mapas/proto/store/ui.store'

// Crear flashcards desde una rama del mapa (informe 75): abre el diálogo con la vista previa.

export function openFlashcardsFromBranch(id: string) {
  useUIStore.getState().setFlashcardsFrom(id)
}
