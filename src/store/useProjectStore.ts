import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  CivilOSProject,
  ProjectMeta,
  GridData,
  MaterialData,
  LoadDefinition,
  MemberData,
  ProjectTemplate,
  Story,
  GridLine,
} from '../lib/types'
import {
  generateId,
  defaultConcrete,
  defaultSteel,
  defaultLoadCombinations,
  getBNBCZoneFactor,
  getBNBCCa,
  getBNBCCv,
  now,
} from '../lib/utils'
import { db } from '../lib/firebase'
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore'

// ── Empty defaults ───────────────────────────────────────────

function emptyGrid(): GridData {
  return { xLines: [], yLines: [], stories: [] }
}

function emptyMembers(): MemberData {
  return {
    columns: [],
    beams: [],
    slabs: [],
    walls: [],
    foundations: [],
    stairs: [],
  }
}

function defaultMaterials(): MaterialData {
  return {
    concrete: defaultConcrete(25),
    steel: defaultSteel(415),
    globalClearCover: 40,
  }
}

function defaultLoads(): LoadDefinition {
  const zone = 2
  const siteClass = 'SD'
  return {
    deadLoad: { selfWeight: true, superimposedDL: 1.5, liveLoad: 0, wallLoad: 10 },
    liveLoad: { selfWeight: false, superimposedDL: 0, liveLoad: 2.0 },
    roofLoad: { selfWeight: true, superimposedDL: 1.5, liveLoad: 1.5, waterTank: 0 },
    windLoad: {
      basicWindSpeed: 210,
      exposureCategory: 'B',
      topographicFactor: 1.0,
      gustFactor: 0.85,
      importanceFactor: 1.0,
      pressureCoefficient: 0.8,
    },
    seismicLoad: {
      seismicZone: zone,
      siteClass,
      importanceFactor: 1.0,
      responseModificationFactor: 8.0,
      Z: getBNBCZoneFactor(zone),
      Ca: getBNBCCa(zone, siteClass),
      Cv: getBNBCCv(zone, siteClass),
      Ct: 0.0731,
      analysisMethod: 'static',
    },
    loadCombinations: defaultLoadCombinations(),
  }
}

function emptyResults() {
  return {
    status: 'pending' as const,
    nodeDisplacements: [],
    supportReactions: [],
    memberForces: [],
  }
}

function emptyDesign() {
  return {
    beamDesigns: [],
    columnDesigns: [],
    slabDesigns: [],
    foundationDesigns: [],
  }
}

function emptyCompliance() {
  return {
    generatedAt: 0,
    overallStatus: 'warning' as const,
    checks: [],
  }
}

// ── Template Grids ────────────────────────────────────────────

function makeGrid(
  xSpacings: number[],
  ySpacings: number[],
  storyHeights: number[]
): GridData {
  let xPos = 0
  const xLines: GridLine[] = xSpacings.map((sp, i) => {
    const line = { id: generateId('gx'), label: String.fromCharCode(65 + i), position: xPos }
    xPos += sp
    return line
  })
  // last X line
  xLines.push({ id: generateId('gx'), label: String.fromCharCode(65 + xSpacings.length), position: xPos })

  let yPos = 0
  const yLines: GridLine[] = ySpacings.map((sp, i) => {
    const line = { id: generateId('gy'), label: `${i + 1}`, position: yPos }
    yPos += sp
    return line
  })
  yLines.push({ id: generateId('gy'), label: `${ySpacings.length + 1}`, position: yPos })

  const storyLabels = ['GF', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', 'RF']
  let elevation = 0
  const stories: Story[] = storyHeights.map((h, i) => {
    const story = {
      id: generateId('st'),
      label: storyLabels[i] ?? `${i}F`,
      level: elevation,
      height: h,
      isMasterStory: i === 0,
    }
    elevation += h
    return story
  })

  return { xLines, yLines, stories }
}

function templateGrid(template: ProjectTemplate): GridData {
  switch (template) {
    case 'residential_3story':
      return makeGrid([5000, 5000, 5000], [4000, 4000], [3000, 3000, 3000])
    case 'residential_6story':
      return makeGrid([5000, 5000, 5000], [4000, 4000], [3000, 3000, 3000, 3000, 3000, 3000])
    case 'commercial_4story':
      return makeGrid([6000, 6000, 6000, 6000], [5000, 5000, 5000], [4000, 4000, 4000, 4000])
    case 'industrial':
      return makeGrid([8000, 8000, 8000], [7000, 7000], [5000, 5000, 5000])
    default:
      return emptyGrid()
  }
}

// ── Store Types ───────────────────────────────────────────────

interface ProjectStore {
  project: CivilOSProject | null
  projectList: { id: string; name: string; updatedAt: number; status: string }[]
  isDirty: boolean
  isSaving: boolean
  isLoading: boolean
  error: string | null

  // Project lifecycle
  createProject: (template: ProjectTemplate, meta: Partial<ProjectMeta>) => CivilOSProject
  loadProject: (id: string) => Promise<void>
  saveProject: () => Promise<void>
  closeProject: () => void
  loadProjectList: (userId: string) => Promise<void>

  // Update sections
  updateMeta: (meta: Partial<ProjectMeta>) => void
  updateGrid: (grid: GridData) => void
  updateMaterials: (mat: MaterialData) => void
  updateLoads: (loads: LoadDefinition) => void

  // Members CRUD
  addColumn: (col: MemberData['columns'][0]) => void
  updateColumn: (id: string, data: Partial<MemberData['columns'][0]>) => void
  deleteColumn: (id: string) => void

  addBeam: (beam: MemberData['beams'][0]) => void
  updateBeam: (id: string, data: Partial<MemberData['beams'][0]>) => void
  deleteBeam: (id: string) => void

  addSlab: (slab: MemberData['slabs'][0]) => void
  deleteSlab: (id: string) => void

  clearError: () => void
}

// ── Store ─────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    project: null,
    projectList: [],
    isDirty: false,
    isSaving: false,
    isLoading: false,
    error: null,

    createProject(template, metaOverrides) {
      const id = generateId('proj')
      const ts = now()

      const project: CivilOSProject = {
        civp_version: '2.0',
        id,
        meta: {
          id,
          name: metaOverrides.name ?? 'নতুন প্রজেক্ট',
          nameLocal: metaOverrides.nameLocal ?? 'নতুন প্রজেক্ট',
          description: metaOverrides.description ?? '',
          address: metaOverrides.address ?? 'ঢাকা, বাংলাদেশ',
          client: metaOverrides.client ?? '',
          engineer: metaOverrides.engineer ?? '',
          projectNo: metaOverrides.projectNo ?? `COS-${Date.now().toString().slice(-6)}`,
          createdAt: ts,
          updatedAt: ts,
          version: '2.0',
          status: 'draft',
          structuralSystem: metaOverrides.structuralSystem ?? 'rcc_frame',
          buildingUse: metaOverrides.buildingUse ?? 'residential',
          importanceCategory: metaOverrides.importanceCategory ?? 'II',
        },
        grid: templateGrid(template),
        materials: defaultMaterials(),
        loads: defaultLoads(),
        members: emptyMembers(),
        analyticalModel: { nodes: [], elements: [], restraints: [], diaphragms: [] },
        results: emptyResults(),
        design: emptyDesign(),
        compliance: emptyCompliance(),
      }

      set(state => {
        state.project = project
        state.isDirty = true
        state.error = null
      })

      return project
    },

    async loadProject(id) {
      set(state => { state.isLoading = true; state.error = null })
      try {
        const snap = await getDoc(doc(db, 'projects', id))
        if (!snap.exists()) throw new Error('প্রজেক্ট পাওয়া যায়নি')
        set(state => {
          state.project = snap.data() as CivilOSProject
          state.isDirty = false
          state.isLoading = false
        })
      } catch (e: any) {
        set(state => { state.error = e.message; state.isLoading = false })
      }
    },

    async saveProject() {
      const { project } = get()
      if (!project) return
      set(state => { state.isSaving = true })
      try {
        const updated = { ...project, meta: { ...project.meta, updatedAt: now() } }
        await setDoc(doc(db, 'projects', project.id), updated)
        set(state => {
          state.project = updated
          state.isDirty = false
          state.isSaving = false
        })
      } catch (e: any) {
        set(state => { state.error = e.message; state.isSaving = false })
      }
    },

    closeProject() {
      set(state => { state.project = null; state.isDirty = false })
    },

    async loadProjectList(userId) {
      try {
        const q = query(
          collection(db, 'projects'),
          where('meta.engineer', '==', userId),
          orderBy('meta.updatedAt', 'desc')
        )
        const snaps = await getDocs(q)
        set(state => {
          state.projectList = snaps.docs.map(d => {
            const p = d.data() as CivilOSProject
            return { id: p.id, name: p.meta.name, updatedAt: p.meta.updatedAt, status: p.meta.status }
          })
        })
      } catch (e: any) {
        set(state => { state.error = e.message })
      }
    },

    updateMeta(meta) {
      set(state => {
        if (!state.project) return
        Object.assign(state.project.meta, meta)
        state.isDirty = true
      })
    },

    updateGrid(grid) {
      set(state => {
        if (!state.project) return
        state.project.grid = grid
        state.isDirty = true
      })
    },

    updateMaterials(mat) {
      set(state => {
        if (!state.project) return
        state.project.materials = mat
        state.isDirty = true
      })
    },

    updateLoads(loads) {
      set(state => {
        if (!state.project) return
        state.project.loads = loads
        state.isDirty = true
      })
    },

    addColumn(col) {
      set(state => {
        state.project?.members.columns.push(col)
        state.isDirty = true
      })
    },
    updateColumn(id, data) {
      set(state => {
        const col = state.project?.members.columns.find(c => c.id === id)
        if (col) Object.assign(col, data)
        state.isDirty = true
      })
    },
    deleteColumn(id) {
      set(state => {
        if (!state.project) return
        state.project.members.columns = state.project.members.columns.filter(c => c.id !== id)
        state.isDirty = true
      })
    },

    addBeam(beam) {
      set(state => {
        state.project?.members.beams.push(beam)
        state.isDirty = true
      })
    },
    updateBeam(id, data) {
      set(state => {
        const b = state.project?.members.beams.find(b => b.id === id)
        if (b) Object.assign(b, data)
        state.isDirty = true
      })
    },
    deleteBeam(id) {
      set(state => {
        if (!state.project) return
        state.project.members.beams = state.project.members.beams.filter(b => b.id !== id)
        state.isDirty = true
      })
    },

    addSlab(slab) {
      set(state => {
        state.project?.members.slabs.push(slab)
        state.isDirty = true
      })
    },
    deleteSlab(id) {
      set(state => {
        if (!state.project) return
        state.project.members.slabs = state.project.members.slabs.filter(s => s.id !== id)
        state.isDirty = true
      })
    },

    clearError() {
      set(state => { state.error = null })
    },
  }))
)
