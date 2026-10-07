import { create } from 'zustand'
import type { UIState } from '@/components/mapas/proto/types/store.types'

export const useUIStore = create<UIState>((set) => ({
  studyMode: false,
  // Entrar o salir del modo estudio empieza siempre con todo tapado.
  setStudyMode: (studyMode) => set((s) => (s.studyMode === studyMode ? s : { studyMode, revealed: new Set() })),
  revealed: new Set(),
  setRevealed: (ids, on) =>
    set((s) => {
      const next = new Set(s.revealed)
      let changed = false
      for (const id of ids) {
        if (on ? next.has(id) : !next.has(id)) continue
        if (on) next.add(id)
        else next.delete(id)
        changed = true
      }
      return changed ? { revealed: next } : s
    }),
  coverAll: () => set((s) => (s.revealed.size ? { revealed: new Set() } : s)),
  flashcardsFrom: null,
  setFlashcardsFrom: (flashcardsFrom) => set({ flashcardsFrom }),
  tableEditor: null,
  setTableEditor: (tableEditor) => set({ tableEditor }),
  stylePanelOpen: false,
  multiSelect: false,
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  cameraLocked: false,
  setCameraLocked: (cameraLocked) => set({ cameraLocked }),
  focusBlur: true,
  setFocusBlur: (focusBlur) => set({ focusBlur }),
  setMultiSelect: (multiSelect) => set((s) => (s.multiSelect === multiSelect ? s : { multiSelect })),
  selectedNodeId: null,
  theme: 'light',
  bgStyle: 'dots-light',
  isDragging: false,
  physicsEnabled: true,
  categoryStyles: {},
  categoriesPanelOpen: false,
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setCategoryStyles: (categoryStyles) => set({ categoryStyles }),
  setCategoriesPanelOpen: (open) => set({ categoriesPanelOpen: open }),
  setPhysicsEnabled: (v) => set({ physicsEnabled: v }),
  setStylePanelOpen: (open) => set({ stylePanelOpen: open }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setTheme: (theme) => set({ theme }),
  setBgStyle: (bgStyle) => set({ bgStyle }),
  setDragging: (v) => set({ isDragging: v }),
}))
