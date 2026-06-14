// ============================================================
// CivilOS Structural — UI Store
// Zustand store for UI state: sidebar, active module, story
// ============================================================

import { create } from 'zustand'
import { ActiveModule } from '../lib/types'

interface UIState {
  activeModule:     ActiveModule
  activeStoryIndex: number
  sidebarOpen:      boolean
  showGrid:         boolean

  setActiveModule:     (module: ActiveModule) => void
  setActiveStoryIndex: (index: number) => void
  toggleSidebar:       () => void
  toggleGrid:          () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeModule:     'dashboard',
  activeStoryIndex: 0,
  sidebarOpen:      true,
  showGrid:         true,

  setActiveModule:     (module) => set({ activeModule: module }),
  setActiveStoryIndex: (index)  => set({ activeStoryIndex: index }),
  toggleSidebar:       ()       => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleGrid:          ()       => set((s) => ({ showGrid: !s.showGrid })),
}))
