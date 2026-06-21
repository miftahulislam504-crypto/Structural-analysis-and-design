// ============================================================
// CivilOS Structural — Hub Bridge
// Reads a project + its Site Info / BNBC / Building Info docs
// straight from CivilOS Hub's side of the SAME shared Firestore
// project, and turns them into a starting CivilOSProject so a
// Hub project can be opened here without ever hitting a dead end.
//
// Hub's Firestore layout (must match lib/firestore/*.firestore.ts
// inside the Hub repo):
//   projects/{id}                              — root project doc
//   projects/{id}/site_information/data         — SiteInfo
//   projects/{id}/bnbc_settings/data            — BNBCSettings
//   projects/{id}/building_information/data     — BuildingInfo
// ============================================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import {
  CivilOSProject,
  ProjectMeta,
  GridData,
  GridLine,
  Story,
  StructuralSystem,
  BuildingUse,
  ImportanceCategory,
  LoadDefinition,
} from './types'
import {
  generateId, now,
  defaultConcrete, defaultSteel, defaultLoadCombinations,
} from './utils'

// ── Hub-side shapes (only the fields we actually use) ─────────
export interface HubProjectDoc {
  projectName?: string
  projectCode?: string
  clientName?:  string
  location?:    string
  createdBy?:   string
}

export interface HubSiteInfo {
  address?:  string
  soilType?: 'S1' | 'S2' | 'S3' | 'S4'
}

export interface HubBNBCSettings {
  seismicZone?:          'Z1' | 'Z2' | 'Z3' | 'Z4'
  importanceFactor?:     number
  basicWindSpeed?:       number
  liveLoadValue?:        number
  soilType?:             'S1' | 'S2' | 'S3' | 'S4'
  responseModFactor?:    number
  riskCategory?:         'I' | 'II' | 'III' | 'IV'
  structuralSystem?:     string
}

export interface HubBuildingInfo {
  usageType?:          string
  structureSystem?:    string
  numFloors?:           number
  basementCount?:       number
  floorHeight?:         number   // meter
  groundFloorHeight?:   number   // meter
  buildingLength?:      number   // meter
  buildingWidth?:       number   // meter
  totalFloorArea?:      number   // sqm
}

export interface HubProjectBundle {
  project:  HubProjectDoc | null
  siteInfo: HubSiteInfo | null
  bnbc:     HubBNBCSettings | null
  building: HubBuildingInfo | null
}

// ── Register a Structural-originated project back into Hub ─────
// Used when a project is started from inside Structural's own
// "+ New Project" button (instead of opened from Hub) — writes a
// Hub-compatible root doc under the SAME id, so Hub and every other
// CivilOS app can see it too. Uses merge so it never clobbers
// Site Info / BNBC / Building Info subcollections.
export async function pushProjectToHub(project: CivilOSProject): Promise<void> {
  await setDoc(
    doc(db, 'projects', project.id),
    {
      projectName: project.meta.name,
      projectCode: project.meta.projectNo,
      clientName:  project.meta.client,
      location:    project.meta.address,
      status:      'active',
      createdBy:   project.meta.createdBy ?? null,
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    },
    { merge: true }
  )
}

// ── Fetch everything Hub knows about a project ─────────────────
export async function fetchHubProjectBundle(
  hubProjectId: string
): Promise<HubProjectBundle> {
  const [projSnap, siteSnap, bnbcSnap, buildSnap] = await Promise.all([
    getDoc(doc(db, 'projects', hubProjectId)),
    getDoc(doc(db, 'projects', hubProjectId, 'site_information', 'data')),
    getDoc(doc(db, 'projects', hubProjectId, 'bnbc_settings', 'data')),
    getDoc(doc(db, 'projects', hubProjectId, 'building_information', 'data')),
  ])

  return {
    project:  projSnap.exists()  ? (projSnap.data()  as HubProjectDoc)     : null,
    siteInfo: siteSnap.exists()  ? (siteSnap.data()  as HubSiteInfo)       : null,
    bnbc:     bnbcSnap.exists()  ? (bnbcSnap.data()  as HubBNBCSettings)   : null,
    building: buildSnap.exists() ? (buildSnap.data() as HubBuildingInfo)  : null,
  }
}

// ── Mapping helpers (Hub's vocabulary → Structural's vocabulary) ─

function mapSeismicZone(zone?: string): 1 | 2 | 3 {
  // NOTE: Structural App currently only models 3 seismic zones.
  // BNBC defines a 4th (Z4, highest hazard) — until that's added
  // to the seismic/BNBC calculation engine here, Z4 is mapped to
  // the most severe zone this app supports (3) rather than silently
  // under-designing for it.
  switch (zone) {
    case 'Z1': return 1
    case 'Z2': return 2
    case 'Z3': return 3
    case 'Z4': return 3
    default:   return 2
  }
}

function mapSiteClass(soil?: string): 'SA' | 'SB' | 'SC' | 'SD' | 'SE' {
  switch (soil) {
    case 'S1': return 'SB'
    case 'S2': return 'SC'
    case 'S3': return 'SD'
    case 'S4': return 'SE'
    default:   return 'SC'
  }
}

function mapStructuralSystem(label?: string): StructuralSystem {
  const l = (label ?? '').toLowerCase()
  if (l.includes('smrf'))                          return 'SMRF'
  if (l.includes('imrf'))                          return 'IMRF'
  if (l.includes('dual'))                          return 'dual_system'
  if (l.includes('masonry'))                       return 'load_bearing'
  if (l.includes('shear wall'))                    return 'shear_wall'
  if (l.includes('steel'))                         return 'steel_frame'
  return 'rcc_frame'
}

function mapBuildingUse(usage?: string): BuildingUse {
  const u = (usage ?? '').toLowerCase()
  if (u.includes('commercial') || u.includes('hotel') || u.includes('retail') || u.includes('বাণিজ্যিক')) return 'commercial'
  if (u.includes('industrial') || u.includes('শিল্প'))                                                   return 'industrial'
  if (u.includes('hospital') || u.includes('educational') || u.includes('government') || u.includes('religious')) return 'institutional'
  if (u.includes('mixed') || u.includes('মিশ্র'))                                                         return 'mixed'
  return 'residential'
}

// ── Grid + stories sized from Hub's Building Info ──────────────
function buildGridFromHub(building: HubBuildingInfo | null): GridData {
  const lengthMm = building?.buildingLength ? building.buildingLength * 1000 : 10000
  const widthMm  = building?.buildingWidth  ? building.buildingWidth  * 1000 : 10000

  const xLines: GridLine[] = [0, lengthMm].map((pos, i) => ({
    id: generateId('gx'), label: String.fromCharCode(65 + i), position: pos,
  }))
  const yLines: GridLine[] = [0, widthMm].map((pos, i) => ({
    id: generateId('gy'), label: String(i + 1), position: pos,
  }))

  const numFloors      = Math.max(building?.numFloors ?? 1, 1)
  const basementCount  = building?.basementCount ?? 0
  const floorHeightMm  = (building?.floorHeight ?? 3) * 1000
  const groundHeightMm = (building?.groundFloorHeight ?? building?.floorHeight ?? 3.5) * 1000

  const stories: Story[] = []

  for (let i = basementCount; i > 0; i--) {
    stories.push({
      id: generateId('st'), label: `B${i}`,
      level: -i * floorHeightMm, height: floorHeightMm, isMasterStory: false,
    })
  }

  let cum = 0
  for (let i = 0; i < numFloors; i++) {
    const h = i === 0 ? groundHeightMm : floorHeightMm
    stories.push({
      id: generateId('st'), label: i === 0 ? 'GF' : `${i}F`,
      level: cum, height: h, isMasterStory: i === 0,
    })
    cum += h
  }

  return { xLines, yLines, stories }
}

// ── Loads sized from Hub's BNBC Settings ───────────────────────
function buildLoadsFromHub(bnbc: HubBNBCSettings | null, siteInfo: HubSiteInfo | null): LoadDefinition {
  const soil = bnbc?.soilType ?? siteInfo?.soilType ?? 'S2'

  return {
    deadLoad: { liveLoad: 0, deadLoad: 3.5, finishLoad: 1.5, partitionLoad: 1.0 },
    liveLoad: { liveLoad: bnbc?.liveLoadValue ?? 2.0, roofLiveLoad: 1.5 },
    roofLoad: { liveLoad: 1.5, deadLoad: 3.0 },
    windLoad: {
      basicWindSpeed:    bnbc?.basicWindSpeed   ?? 260,
      exposureCategory:  'B',
      importanceFactor:  bnbc?.importanceFactor ?? 1.0,
      topographicFactor: 1.0,
      directionFactor:   0.85,
    },
    seismicLoad: {
      zone:                          mapSeismicZone(bnbc?.seismicZone),
      seismicZone:                   mapSeismicZone(bnbc?.seismicZone),
      siteClass:                     mapSiteClass(soil),
      importanceFactor:              bnbc?.importanceFactor ?? 1.0,
      responseModificationFactor:    bnbc?.responseModFactor ?? 5,
      deflectionAmplificationFactor: 4.5,
      overstrengthFactor:            3,
    },
    loadCombinations: defaultLoadCombinations(),
  }
}

// ── Full project builder ────────────────────────────────────────
// Builds a brand-new CivilOSProject for a Hub project that doesn't
// have structural data yet, pre-filled from whatever Hub already
// knows (project name/client/address, BNBC settings, building info).
export function buildProjectFromHub(
  hubProjectId: string,
  bundle: HubProjectBundle,
  fallbackUid: string,
): CivilOSProject {
  const { project, siteInfo, bnbc, building } = bundle
  const ts = now()

  const fullMeta: ProjectMeta = {
    id:        hubProjectId,
    name:      project?.projectName ?? 'নতুন প্রজেক্ট',
    nameLocal: project?.projectName ?? 'নতুন প্রজেক্ট',
    client:    project?.clientName  ?? '',
    address:   project?.location    ?? siteInfo?.address ?? 'ঢাকা, বাংলাদেশ',
    engineer:  '',
    projectNo: project?.projectCode ?? `COS-${ts.toString().slice(-6)}`,
    status:    'draft',
    template:  'from_hub',
    createdAt: ts,
    updatedAt: ts,
    createdBy: project?.createdBy ?? fallbackUid,
    version:   '1.0',
    structuralSystem:   mapStructuralSystem(bnbc?.structuralSystem ?? building?.structureSystem),
    buildingUse:        mapBuildingUse(building?.usageType),
    importanceCategory: (bnbc?.riskCategory as ImportanceCategory) ?? 'II',
    numberOfStoreys:    building?.numFloors ?? 1,
    totalHeight:        building
      ? Math.round(((building.groundFloorHeight ?? building.floorHeight ?? 3.5)
          + ((building.numFloors ?? 1) - 1) * (building.floorHeight ?? 3)) * 1000)
      : 3000,
    floorArea: building?.totalFloorArea ?? 100,
  }

  return {
    civp_version: '2.0',
    id: hubProjectId,
    meta: fullMeta,
    grid: buildGridFromHub(building),
    materials: {
      concrete: defaultConcrete(25),
      steel:    defaultSteel(415),
    },
    loads: buildLoadsFromHub(bnbc, siteInfo),
    members: {
      columns: [], beams: [], slabs: [],
      walls: [], foundations: [], stairs: [],
    },
    analyticalModel: {
      nodes: [], elements: [], restraints: [],
      diaphragms: [],
    },
    results: {
      status: 'pending',
      memberForces: [],
      modalResults: undefined,
    },
    design: {
      beamDesigns: [], columnDesigns: [],
      slabDesigns: [], foundationDesigns: [],
    },
    compliance: {
      generatedAt: 0,
      overallStatus: 'not_checked' as any,
      checks: [],
    },
  }
}
