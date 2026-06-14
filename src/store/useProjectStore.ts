// ============================================================
// CivilOS Structural — Project Store
// Zustand store: Firebase CRUD + template factory
// ============================================================

import { create } from 'zustand'
import {
  doc, getDoc, setDoc, collection,
  query, where, getDocs, serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  CivilOSProject,
  ProjectTemplate,
  ProjectMeta,
  GridData,
  GridLine,
  Story,
  MemberData,
  AnalyticalModel,
  AnalysisResults,
  DesignResults,
  ComplianceReport,
  LoadDefinition,
  MaterialData,
} from '../lib/types'
import {
  generateId, now,
  defaultConcrete, defaultSteel, defaultLoadCombinations,
} from '../lib/utils'

// ─────────────────────────────────────────────
// PROJECT SUMMARY (for dashboard list)
// ─────────────────────────────────────────────

export interface ProjectSummary {
  id:        string
  name:      string
  status:    string
  updatedAt: number
  projectNo: string
  engineer:  string
}

// ─────────────────────────────────────────────
// TEMPLATE FACTORY
// ─────────────────────────────────────────────

function makeGrid(template: ProjectTemplate): GridData {
  const configs: Record<ProjectTemplate, { x: number[]; y: number[]; stories: { label: string; h: number }[] }> = {
    blank: {
      x: [0, 5000],
      y: [0, 5000],
      stories: [{ label: 'GF', h: 3000 }],
    },
    residential_3story: {
      x: [0, 4000, 8000, 12000],
      y: [0, 4000, 8000, 12000],
      stories: [
        { label: 'GF', h: 3000 },
        { label: '1F', h: 3000 },
        { label: '2F', h: 3000 },
      ],
    },
    residential_6story: {
      x: [0, 4000, 8000, 12000],
      y: [0, 4000, 8000, 12000],
      stories: [
        { label: 'GF', h: 3000 },
        { label: '1F', h: 3000 },
        { label: '2F', h: 3000 },
        { label: '3F', h: 3000 },
        { label: '4F', h: 3000 },
        { label: '5F', h: 3000 },
      ],
    },
    commercial_4story: {
      x: [0, 5000, 10000, 15000, 20000],
      y: [0, 5000, 10000, 15000],
      stories: [
        { label: 'GF', h: 4000 },
        { label: '1F', h: 4000 },
        { label: '2F', h: 4000 },
        { label: '3F', h: 4000 },
      ],
    },
    industrial: {
      x: [0, 6000, 12000, 18000],
      y: [0, 8000, 16000],
      stories: [
        { label: 'GF', h: 5000 },
        { label: '1F', h: 5000 },
        { label: '2F', h: 5000 },
      ],
    },
  }

  const cfg = configs[template]
  const xLines: GridLine[] = cfg.x.map((pos, i) => ({
    id: generateId('gx'), label: String.fromCharCode(65 + i), position: pos,
  }))
  const yLines: GridLine[] = cfg.y.map((pos, i) => ({
    id: generateId('gy'), label: String(i + 1), position: pos,
  }))

  let cumLevel = 0
  const stories: Story[] = cfg.stories.map((s, i) => {
    const level = cumLevel
    cumLevel += s.h
    return {
      id: generateId('st'), label: s.label,
      level, height: s.h, isMasterStory: i === 0,
    }
  })

  return { xLines, yLines, stories }
}

function makeDefaultLoads(): LoadDefinition {
  return {
    deadLoad:  { deadLoad: 3.5, finishLoad: 1.5, partitionLoad: 1.0 },
    liveLoad:  { liveLoad: 2.0, roofLiveLoad: 1.5 },
    roofLoad:  { deadLoad: 3.0, liveLoad: 1.5 },
    windLoad: {
      basicWindSpeed: 260,
      exposureCategory: 'B',
      importanceFactor: 1.0,
      topographicFactor: 1.0,
      directionFactor: 0.85,
    },
    seismicLoad: {
      zone: 2,
      siteClass: 'D',
      importanceFactor: 1.0,
      responseModificationFactor: 5,
      deflectionAmplificationFactor: 4.5,
      overstrengthFactor: 3,
    },
    loadCombinations: defaultLoadCombinations(),
  }
}

function makeDefaultMaterials(): MaterialData {
  return {
    concrete: defaultConcrete(25),
    steel:    defaultSteel(415),
  }
}

function makeEmptyMembers(): MemberData {
  return {
    columns: [], beams: [], slabs: [],
    walls: [], foundations: [], piles: [], staircases: [],
  }
}

function makeEmptyAnalyticalModel(): AnalyticalModel {
  return {
    nodes: [], elements: [], boundaryConditions: [],
    diaphragms: [], loadPatterns: [],
  }
}

function makeEmptyResults(): AnalysisResults {
  return {
    status: 'pending',
    displacements: [], reactions: [], memberForces: [],
    modalResults: null, storyDrift: [],
  }
}

function makeEmptyDesign(): DesignResults {
  return {
    beamDesigns: [], columnDesigns: [],
    slabDesigns: [], foundationDesigns: [],
  }
}

function makeEmptyCompliance(): ComplianceReport {
  return {
    generatedAt: 0,
    overallStatus: 'not_checked' as any,
    checks: [],
  }
}

function buildProject(
  template: ProjectTemplate,
  meta: Partial<ProjectMeta>,
  uid: string,
): CivilOSProject {
  const id = generateId('prj')
  const ts = now()

  const fullMeta: ProjectMeta = {
    id,
    name:          meta.name        ?? 'নতুন প্রজেক্ট',
    nameLocal:     meta.nameLocal   ?? meta.name ?? 'নতুন প্রজেক্ট',
    client:        meta.client      ?? '',
    address:       meta.address     ?? 'ঢাকা, বাংলাদেশ',
    engineer:      meta.engineer    ?? '',
    projectNo:     meta.projectNo   ?? `COS-${ts.toString().slice(-6)}`,
    status:        'draft',
    template,
    createdAt:     ts,
    updatedAt:     ts,
    createdBy:     uid,
    structuralSystem: 'OMRF',
    buildingUse:      'residential',
    importanceCategory: 'II',
    numberOfStoreys:    1,
    totalHeight:        3000,
    floorArea:          100,
  }

  return {
    civp_version: '2.0',
    id,
    meta:             fullMeta,
    grid:             makeGrid(template),
    materials:        makeDefaultMaterials(),
    loads:            makeDefaultLoads(),
    members:          makeEmptyMembers(),
    analyticalModel:  makeEmptyAnalyticalModel(),
    results:          makeEmptyResults(),
    design:           makeEmptyDesign(),
    compliance:       makeEmptyCompliance(),
  }
}

// ─────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────

interface ProjectState {
  project:     CivilOSProject | null
  projectList: ProjectSummary[]
  isLoading:   boolean
  isSaving:    boolean
  error:       string | null

  // Actions
  setProject:       (project: CivilOSProject) => void
  createProject:    (template: ProjectTemplate, meta: Partial<ProjectMeta>, uid?: string) => CivilOSProject
  loadProject:      (id: string) => Promise<void>
  saveProject:      () => Promise<void>
  loadProjectList:  (uid: string) => Promise<void>
  updateProject:    (patch: Partial<CivilOSProject>) => void
  closeProject:     () => void
  clearError:       () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project:     null,
  projectList: [],
  isLoading:   false,
  isSaving:    false,
  error:       null,

  setProject: (project) => {
    set({ project })
    // Auto-save to Firestore
    get().saveProject()
  },

  createProject: (template, meta, uid = 'local') => {
    const project = buildProject(template, meta, uid)
    set({ project })
    // Fire-and-forget save
    get().saveProject().catch(console.error)
    return project
  },

  loadProject: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const snap = await getDoc(doc(db, 'projects', id))
      if (!snap.exists()) {
        set({ error: 'প্রজেক্ট পাওয়া যায়নি', isLoading: false })
        return
      }
      const data = snap.data() as CivilOSProject
      set({ project: data, isLoading: false })
    } catch (e: any) {
      set({ error: `লোড ব্যর্থ: ${e.message}`, isLoading: false })
    }
  },

  saveProject: async () => {
    const { project } = get()
    if (!project) return
    set({ isSaving: true })
    try {
      const updated = { ...project, meta: { ...project.meta, updatedAt: now() } }
      await setDoc(doc(db, 'projects', project.id), updated)
      set({ project: updated, isSaving: false })
    } catch (e: any) {
      console.error('Save failed:', e)
      set({ isSaving: false })
    }
  },

  loadProjectList: async (uid) => {
    set({ isLoading: true })
    try {
      const q     = query(collection(db, 'projects'), where('meta.createdBy', '==', uid))
      const snaps = await getDocs(q)
      const list: ProjectSummary[] = snaps.docs.map(d => {
        const p = d.data() as CivilOSProject
        return {
          id:        p.id,
          name:      p.meta.name,
          status:    p.meta.status,
          updatedAt: p.meta.updatedAt,
          projectNo: p.meta.projectNo,
          engineer:  p.meta.engineer,
        }
      }).sort((a, b) => b.updatedAt - a.updatedAt)

      set({ projectList: list, isLoading: false })
    } catch (e: any) {
      set({ error: `তালিকা লোড ব্যর্থ: ${e.message}`, isLoading: false })
    }
  },

  updateProject: (patch) => {
    const { project } = get()
    if (!project) return
    const updated = { ...project, ...patch }
    set({ project: updated })
    // Debounced save — fire and forget
    get().saveProject().catch(console.error)
  },

  closeProject: () => set({ project: null }),

  clearError: () => set({ error: null }),
}))
