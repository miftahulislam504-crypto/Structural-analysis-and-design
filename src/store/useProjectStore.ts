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
  Column,
  Beam,
} from '../lib/types'
import {
  generateId, now,
  defaultConcrete, defaultSteel, defaultLoadCombinations,
} from '../lib/utils'
import { useAuthStore } from './useAuthStore'
import {
  fetchHubProjectBundle, buildProjectFromHub, pushProjectToHub,
} from '../lib/hubBridge'

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
    deadLoad:  { liveLoad: 0, deadLoad: 3.5, finishLoad: 1.5, partitionLoad: 1.0 },
    liveLoad:  { liveLoad: 2.0, roofLiveLoad: 1.5 },
    roofLoad:  { liveLoad: 1.5, deadLoad: 3.0 },
    windLoad: {
      basicWindSpeed: 260,
      exposureCategory: 'B',
      importanceFactor: 1.0,
      topographicFactor: 1.0,
      directionFactor: 0.85,
    },
    seismicLoad: {
      zone: 2,
      siteClass: 'SC',
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
    walls: [], foundations: [], stairs: [],
  }
}

function makeEmptyAnalyticalModel(): AnalyticalModel {
  return {
    nodes: [], elements: [], restraints: [],
    diaphragms: [],
  }
}

// ─────────────────────────────────────────────
// FIRESTORE SANITIZER
// Recursively removes undefined values (Firestore does NOT support undefined)
// ─────────────────────────────────────────────
function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore)
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value)
    }
  }
  return result
}

function makeEmptyResults(): AnalysisResults {
  return {
    status: 'pending',
    memberForces: [],
    // modalResults is omitted intentionally — undefined crashes Firestore setDoc
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
    version:       '1.0',
    structuralSystem: 'rcc_frame',
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
  isDirty:     boolean
  error:       string | null
  justAutoInitFromHub: boolean

  // Actions
  setProject:       (project: CivilOSProject) => void
  createProject:    (template: ProjectTemplate, meta: Partial<ProjectMeta>, uid?: string) => CivilOSProject
  loadProject:      (id: string) => Promise<void>
  saveProject:      () => Promise<void>
  loadProjectList:  (uid: string) => Promise<void>
  updateProject:    (patch: Partial<CivilOSProject>) => void
  closeProject:     () => void
  clearError:       () => void

  // Granular update actions
  updateMeta:       (patch: Partial<ProjectMeta>) => void
  updateGrid:       (grid: GridData) => void
  updateMaterials:  (materials: MaterialData) => void
  updateLoads:      (loads: LoadDefinition) => void

  // Member actions
  addColumn:    (column: Column) => void
  addBeam:      (beam: Beam) => void
  updateColumn: (id: string, patch: Partial<Column>) => void
  updateBeam:   (id: string, patch: Partial<Beam>) => void
  deleteColumn: (id: string) => void
  deleteBeam:   (id: string) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project:     null,
  projectList: [],
  isLoading:   false,
  isSaving:    false,
  isDirty:     false,
  error:       null,
  justAutoInitFromHub: false,

  setProject: (project) => {
    set({ project, isDirty: true })
    get().saveProject()
  },

  createProject: (template, meta, uid = 'local') => {
    const project = buildProject(template, meta, uid)
    set({ project, isDirty: false })
    get().saveProject().catch(console.error)
    pushProjectToHub(project).catch(console.error)
    return project
  },

  loadProject: async (id) => {
    set({ isLoading: true, error: null, justAutoInitFromHub: false })
    try {
      // Structural data lives in subcollection to avoid overwriting Hub's project doc
      const snap = await getDoc(doc(db, 'projects', id, 'structuralData', 'civp'))
      if (snap.exists()) {
        const data = snap.data() as CivilOSProject
        set({ project: data, isLoading: false, isDirty: false })
        return
      }

      // No structural data yet for this Hub project — this is the
      // *normal* state for any freshly-created Hub project. Pull
      // whatever Hub already knows (project info, Site Info, BNBC
      // Settings, Building Info) and auto-initialize a structural
      // project from it instead of dead-ending here.
      const bundle = await fetchHubProjectBundle(id)
      if (!bundle.project) {
        set({
          error: 'এই প্রজেক্ট খুঁজে পাওয়া যায়নি — Hub-এ এই ID-র কোনো প্রজেক্ট নেই',
          isLoading: false,
        })
        return
      }

      const uid     = useAuthStore.getState().user?.uid ?? bundle.project.createdBy ?? 'unknown'
      const project = buildProjectFromHub(id, bundle, uid)

      await setDoc(doc(db, 'projects', id, 'structuralData', 'civp'), sanitizeForFirestore(project))
      set({ project, isLoading: false, isDirty: false, justAutoInitFromHub: true })
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
      // Save structural data to subcollection — preserves Hub's root project document
      // Path: projects/{hubProjectId}/structuralData/civp
      await setDoc(doc(db, 'projects', project.id, 'structuralData', 'civp'), sanitizeForFirestore(updated))
      set({ project: updated, isSaving: false, isDirty: false })
    } catch (e: any) {
      console.error('Save failed:', e)
      set({ isSaving: false })
    }
  },

  loadProjectList: async (uid) => {
    set({ isLoading: true })
    try {
      // Query Hub's projects collection filtered by the current user
      // then check which ones have structural data
      const q     = query(collection(db, 'projects'), where('createdBy', '==', uid))
      const snaps = await getDocs(q)

      const list: ProjectSummary[] = []
      for (const d of snaps.docs) {
        // Check if structural data exists for this Hub project
        const structSnap = await getDoc(doc(db, 'projects', d.id, 'structuralData', 'civp'))
        if (structSnap.exists()) {
          const p = structSnap.data() as CivilOSProject
          list.push({
            id:        p.id,
            name:      p.meta.name,
            status:    p.meta.status,
            updatedAt: p.meta.updatedAt,
            projectNo: p.meta.projectNo,
            engineer:  p.meta.engineer,
          })
        } else {
          // Hub project exists but no structural data yet — still show it
          const hubData = d.data()
          list.push({
            id:        d.id,
            name:      hubData.projectName ?? hubData.name ?? 'Unnamed Project',
            status:    'draft',
            updatedAt: Date.now(),
            projectNo: hubData.projectCode ?? '',
            engineer:  '',
          })
        }
      }

      list.sort((a, b) => b.updatedAt - a.updatedAt)
      set({ projectList: list, isLoading: false })
    } catch (e: any) {
      set({ error: `তালিকা লোড ব্যর্থ: ${e.message}`, isLoading: false })
    }
  },

  updateProject: (patch) => {
    const { project } = get()
    if (!project) return
    const updated = { ...project, ...patch }
    set({ project: updated, isDirty: true })
    get().saveProject().catch(console.error)
  },

  closeProject: () => set({ project: null, isDirty: false }),

  clearError: () => set({ error: null }),

  // ── Granular update actions ──────────────────────────────────
  updateMeta: (patch) => {
    const { project } = get()
    if (!project) return
    set({ project: { ...project, meta: { ...project.meta, ...patch } }, isDirty: true })
    get().saveProject().catch(console.error)
  },

  updateGrid: (grid) => {
    const { project } = get()
    if (!project) return
    set({ project: { ...project, grid }, isDirty: true })
    get().saveProject().catch(console.error)
  },

  updateMaterials: (materials) => {
    const { project } = get()
    if (!project) return
    set({ project: { ...project, materials }, isDirty: true })
    get().saveProject().catch(console.error)
  },

  updateLoads: (loads) => {
    const { project } = get()
    if (!project) return
    set({ project: { ...project, loads }, isDirty: true })
    get().saveProject().catch(console.error)
  },

  // ── Member actions ───────────────────────────────────────────
  addColumn: (column) => {
    const { project } = get()
    if (!project) return
    const members = { ...project.members, columns: [...project.members.columns, column] }
    set({ project: { ...project, members }, isDirty: true })
  },

  addBeam: (beam) => {
    const { project } = get()
    if (!project) return
    const members = { ...project.members, beams: [...project.members.beams, beam] }
    set({ project: { ...project, members }, isDirty: true })
  },

  updateColumn: (id, patch) => {
    const { project } = get()
    if (!project) return
    const columns = project.members.columns.map(c => c.id === id ? { ...c, ...patch } : c)
    const members = { ...project.members, columns }
    set({ project: { ...project, members }, isDirty: true })
  },

  updateBeam: (id, patch) => {
    const { project } = get()
    if (!project) return
    const beams = project.members.beams.map(b => b.id === id ? { ...b, ...patch } : b)
    const members = { ...project.members, beams }
    set({ project: { ...project, members }, isDirty: true })
  },

  deleteColumn: (id) => {
    const { project } = get()
    if (!project) return
    const columns = project.members.columns.filter(c => c.id !== id)
    const members = { ...project.members, columns }
    set({ project: { ...project, members }, isDirty: true })
  },

  deleteBeam: (id) => {
    const { project } = get()
    if (!project) return
    const beams = project.members.beams.filter(b => b.id !== id)
    const members = { ...project.members, beams }
    set({ project: { ...project, members }, isDirty: true })
  },
}))
