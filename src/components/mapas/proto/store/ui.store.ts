import { create } from 'zustand'
import type { UIState } from '@/components/mapas/proto/types/store.types'

export const useUIStore = create<UIState>((set) => ({
  stylePanelOpen: false,
  selectedNodeId: null,
  theme: 'light',
  bgStyle: 'dots-light',
  isDragging: false,
  physicsEnabled: true,
  categoryStyles: {},
  categoriesPanelOpen: false,
  setCategoryStyles: (categoryStyles) => set({ categoryStyles }),
  setCategoriesPanelOpen: (open) => set({ categoriesPanelOpen: open }),
  setPhysicsEnabled: (v) => set({ physicsEnabled: v }),
  setStylePanelOpen: (open) => set({ stylePanelOpen: open }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setTheme: (theme) => set({ theme }),
  setBgStyle: (bgStyle) => set({ bgStyle }),
  setDragging: (v) => set({ isDragging: v }),
}))
