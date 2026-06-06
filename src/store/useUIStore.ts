import { create } from 'zustand'
import { ActiveModule, ViewMode } from '../lib/types'

interface UIStore {
  activeModule: ActiveModule
  activeStoryIndex: number
  viewMode: ViewMode
  selectedMemberIds: string[]
  showGrid: boolean
  showLoads: boolean
  showResults: boolean
  sidebarOpen: boolean
  zoom: number
  panX: number
  panY: number
  isDarkMode: boolean

  setActiveModule: (module: ActiveModule) => void
  setActiveStoryIndex: (index: number) => void
  setViewMode: (mode: ViewMode) => void
  selectMember: (id: string, addToSelection?: boolean) => void
  clearSelection: () => void
  toggleGrid: () => void
  toggleLoads: () => void
  toggleResults: () => void
  toggleSidebar: () => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  resetView: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  activeModule: 'dashboard',
  activeStoryIndex: 0,
  viewMode: 'plan',
  selectedMemberIds: [],
  showGrid: true,
  showLoads: false,
  showResults: false,
  sidebarOpen: true,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDarkMode: true,

  setActiveModule: (module) => set({ activeModule: module, selectedMemberIds: [] }),
  setActiveStoryIndex: (index) => set({ activeStoryIndex: index }),
  setViewMode: (mode) => set({ viewMode: mode }),

  selectMember: (id, addToSelection = false) =>
    set((state) => ({
      selectedMemberIds: addToSelection
        ? state.selectedMemberIds.includes(id)
          ? state.selectedMemberIds.filter((m) => m !== id)
          : [...state.selectedMemberIds, id]
        : [id],
    })),

  clearSelection: () => set({ selectedMemberIds: [] }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleLoads: () => set((s) => ({ showLoads: !s.showLoads })),
  toggleResults: () => set((s) => ({ showResults: !s.showResults })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
}))
