// ============================================================
// CivilOS Structural — Core Type Definitions
// Phase 0: Foundation Architecture
// BNBC 2020 | ACI 318-19 | Bangladesh Engineering Practice
// ============================================================

// ─────────────────────────────────────────────
// META & PROJECT
// ─────────────────────────────────────────────

export interface ProjectMeta {
  id: string
  name: string
  nameLocal: string
  description?: string
  address: string
  client: string
  engineer: string
  checkedBy?: string
  approvedBy?: string
  projectNo: string
  drawingNo?: string
  createdAt: number
  updatedAt: number
  version: string
  status: ProjectStatus
  structuralSystem: StructuralSystem
  buildingUse: BuildingUse
  importanceCategory: ImportanceCategory
}

export type ProjectStatus = 'draft' | 'in_review' | 'approved' | 'archived'

export type StructuralSystem =
  | 'rcc_frame'
  | 'dual_system'
  | 'shear_wall'
  | 'steel_frame'
  | 'load_bearing'

export type BuildingUse =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'institutional'
  | 'mixed'

export type ImportanceCategory = 'I' | 'II' | 'III' | 'IV'

// ─────────────────────────────────────────────
// GRID & GEOMETRY
// ─────────────────────────────────────────────

export interface GridData {
  xLines: GridLine[]
  yLines: GridLine[]
  stories: Story[]
}

export interface GridLine {
  id: string
  label: string
  position: number // mm from origin
}

export interface Story {
  id: string
  label: string   // "GF", "1F", "2F", "RF"
  level: number   // elevation in mm
  height: number  // floor-to-floor mm
  isMasterStory: boolean
}

// ─────────────────────────────────────────────
// MATERIALS
// ─────────────────────────────────────────────

export interface MaterialData {
  concrete: ConcreteMaterial
  steel: SteelMaterial
  globalClearCover: number // mm
}

export interface ConcreteMaterial {
  id: string
  grade: string
  fc: number        // MPa
  Ec: number        // MPa (auto = 4700√fc)
  unitWeight: number // kN/m³
  poissonRatio: number
}

export interface SteelMaterial {
  id: string
  grade: string
  fy: number  // MPa
  Es: number  // MPa (200,000)
  fyt: number // transverse steel MPa
}

// ─────────────────────────────────────────────
// LOADS
// ─────────────────────────────────────────────

export interface LoadDefinition {
  deadLoad: FloorLoad
  liveLoad: FloorLoad
  roofLoad: RoofLoad
  windLoad: WindLoadParams
  seismicLoad: SeismicLoadParams
  loadCombinations: LoadCombination[]
}

export interface FloorLoad {
  selfWeight: boolean
  superimposedDL: number // kN/m²
  liveLoad: number       // kN/m²
  wallLoad?: number      // kN/m
}

export interface RoofLoad {
  selfWeight: boolean
  superimposedDL: number
  liveLoad: number
  waterTank?: number
}

export interface WindLoadParams {
  basicWindSpeed: number
  exposureCategory: 'B' | 'C' | 'D'
  topographicFactor: number
  gustFactor: number
  importanceFactor: number
  pressureCoefficient: number
}

export interface SeismicLoadParams {
  seismicZone: 1 | 2 | 3
  siteClass: 'SA' | 'SB' | 'SC' | 'SD' | 'SE'
  importanceFactor: number
  responseModificationFactor: number
  Z: number
  Ca: number
  Cv: number
  Ct: number
  analysisMethod: 'static' | 'response_spectrum' | 'time_history'
}

export interface LoadCombination {
  id: string
  label: string
  code: string
  factors: LoadFactor[]
  isDefault: boolean
}

export interface LoadFactor {
  loadType: 'D' | 'L' | 'Lr' | 'W' | 'E' | 'S'
  factor: number
}

// ─────────────────────────────────────────────
// MEMBERS
// ─────────────────────────────────────────────

export interface MemberData {
  columns: Column[]
  beams: Beam[]
  slabs: Slab[]
  walls: StructuralWall[]
  foundations: Foundation[]
  stairs: Staircase[]
}

export interface RectangularSection {
  type: 'rectangular'
  width: number
  depth: number
}

export interface CircularSection {
  type: 'circular'
  diameter: number
}

export interface TBeamSection {
  type: 't_beam'
  webWidth: number
  webDepth: number
  flangeWidth: number
  flangeThickness: number
}

export type ColumnSection = RectangularSection | CircularSection
export type BeamSection = RectangularSection | TBeamSection

export interface Column {
  id: string
  label: string
  gridX: string
  gridY: string
  storyId: string
  section: ColumnSection
  materialId: string
  clearCover: number
  rotation: number
}

export interface Beam {
  id: string
  label: string
  startNodeId: string
  endNodeId: string
  storyId: string
  section: BeamSection
  materialId: string
  clearCover: number
  isCantilever: boolean
}

export interface Slab {
  id: string
  label: string
  storyId: string
  panelNodeIds: string[]
  thickness: number
  type: 'one_way' | 'two_way' | 'flat_slab' | 'flat_plate'
  spanDirection?: 'x' | 'y'
  materialId: string
  clearCover: number
  openings: SlabOpening[]
}

export interface SlabOpening {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface StructuralWall {
  id: string
  label: string
  startNodeId: string
  endNodeId: string
  storyId: string
  thickness: number
  type: 'structural' | 'shear_wall'
  materialId: string
  clearCover: number
  hasBoundaryElements: boolean
}

export type FoundationType =
  | 'isolated'
  | 'combined'
  | 'raft'
  | 'pile_cap'
  | 'strap'

export interface Foundation {
  id: string
  label: string
  type: FoundationType
  columnIds: string[]
  depth: number
  length: number
  width: number
  thickness: number
  materialId: string
  soilBearingCapacity: number
  piles?: Pile[]
}

export interface Pile {
  id: string
  diameter: number
  length: number
  type: 'bored' | 'driven' | 'precast'
  capacity: number
}

export interface Staircase {
  id: string
  label: string
  type: 'waist_slab' | 'beam_stair'
  riser: number
  tread: number
  noOfRisers: number
  flightWidth: number
  waistThickness?: number
  storyFromId: string
  storyToId: string
}

// ─────────────────────────────────────────────
// ANALYTICAL MODEL
// ─────────────────────────────────────────────

export interface AnalyticalModel {
  nodes: AnalyticalNode[]
  elements: AnalyticalElement[]
  restraints: BoundaryCondition[]
  diaphragms: Diaphragm[]
}

export interface AnalyticalNode {
  id: string
  x: number
  y: number
  z: number
  dof: DOFIndex
  physicalMemberId?: string
}

export interface DOFIndex {
  ux: number
  uy: number
  uz: number
  rx: number
  ry: number
  rz: number
}

export interface AnalyticalElement {
  id: string
  type: 'frame' | 'shell' | 'link'
  startNodeId: string
  endNodeId: string
  physicalMemberId: string
  sectionProperties: SectionProperties
  materialProperties: MaterialProperties
  releases: MemberReleases
}

export interface SectionProperties {
  area: number
  Ix: number
  Iy: number
  J: number
  Sz: number
  Sy: number
}

export interface MaterialProperties {
  E: number
  G: number
  nu: number
  rho: number
}

export interface MemberReleases {
  startMx?: boolean
  startMy?: boolean
  startMz?: boolean
  endMx?: boolean
  endMy?: boolean
  endMz?: boolean
}

export interface BoundaryCondition {
  nodeId: string
  ux: boolean
  uy: boolean
  uz: boolean
  rx: boolean
  ry: boolean
  rz: boolean
  type: 'fixed' | 'pinned' | 'roller'
}

export interface Diaphragm {
  id: string
  storyId: string
  type: 'rigid' | 'semi_rigid'
  masterNodeId: string
}

// ─────────────────────────────────────────────
// ANALYSIS RESULTS
// ─────────────────────────────────────────────

export interface AnalysisResults {
  status: 'pending' | 'running' | 'complete' | 'failed'
  timestamp?: number
  nodeDisplacements: NodeDisplacement[]
  supportReactions: SupportReaction[]
  memberForces: MemberForces[]
  modalResults?: ModalResults
  storyDrifts?: StoryDrift[]
  errorLog?: string[]
}

export interface NodeDisplacement {
  nodeId: string
  loadCaseId: string
  ux: number
  uy: number
  uz: number
  rx: number
  ry: number
  rz: number
}

export interface SupportReaction {
  nodeId: string
  loadCaseId: string
  Fx: number
  Fy: number
  Fz: number
  Mx: number
  My: number
  Mz: number
}

export interface MemberForces {
  elementId: string
  loadCaseId: string
  stations: ForceStation[]
}

export interface ForceStation {
  position: number
  N: number
  Vy: number
  Vz: number
  T: number
  My: number
  Mz: number
}

export interface ModalResults {
  modes: Mode[]
  totalParticipatingMass: number
}

export interface Mode {
  modeNo: number
  period: number
  frequency: number
  participationFactorX: number
  participationFactorY: number
  participationFactorZ: number
  modeShape: ModeShapeValue[]
}

export interface ModeShapeValue {
  nodeId: string
  ux: number
  uy: number
  uz: number
  rx: number
  ry: number
  rz: number
}

export interface StoryDrift {
  storyId: string
  loadCaseId: string
  driftX: number
  driftY: number
  limit: number
  passed: boolean
}

// ─────────────────────────────────────────────
// DESIGN RESULTS
// ─────────────────────────────────────────────

export interface DesignResults {
  beamDesigns: BeamDesign[]
  columnDesigns: ColumnDesign[]
  slabDesigns: SlabDesign[]
  foundationDesigns: FoundationDesign[]
}

export interface BeamDesign {
  beamId: string
  status: 'ok' | 'fail' | 'pending'
  flexure: FlexureDesign
  shear: ShearDesign
  torsion?: TorsionDesign
  deflection: DeflectionCheck
}

export interface FlexureDesign {
  Mu_pos: number
  Mu_neg: number
  As_pos_req: number
  As_neg_req: number
  As_min: number
  As_max: number
  bars_pos: RebarLayout
  bars_neg: RebarLayout
}

export interface ShearDesign {
  Vu_max: number
  Vc: number
  Vs_req: number
  stirrupBar: number
  stirrupLegs: number
  stirrupSpacing_mid: number
  stirrupSpacing_end: number
}

export interface TorsionDesign {
  Tu: number
  Tcr: number
  requiresTorsionDesign: boolean
  closedStirrupSpacing?: number
}

export interface DeflectionCheck {
  span: number
  ieff: number
  delta_immediate: number
  delta_longterm: number
  limit_live: number
  limit_total: number
  passed: boolean
}

export interface RebarLayout {
  barDiameter: number
  noOfBars: number
  layers: number
  clearSpacing: number
}

export interface ColumnDesign {
  columnId: string
  status: 'ok' | 'fail' | 'pending'
  isSlender: boolean
  Pu: number
  Mux: number
  Muy: number
  longitudinalBars: RebarLayout
  tieBar: number
  tieSpacing: number
  pmDiagram: PMPoint[]
}

export interface PMPoint {
  phi_Pn: number
  phi_Mn: number
}

export interface SlabDesign {
  slabId: string
  status: 'ok' | 'fail' | 'pending'
  type: 'one_way' | 'two_way'
  thickness: number
  As_x_top: number
  As_x_bot: number
  As_y_top: number
  As_y_bot: number
  barX: RebarLayout
  barY: RebarLayout
  punchingCheck?: PunchingShearCheck
}

export interface PunchingShearCheck {
  Vu: number
  phiVc: number
  ratio: number
  passed: boolean
  criticalPerimeter: number
}

export interface FoundationDesign {
  foundationId: string
  status: 'ok' | 'fail' | 'pending'
  bearingPressure: BearingCheck
  flexure: FlexureDesign
  shear: ShearDesign
  punching?: PunchingShearCheck
}

export interface BearingCheck {
  q_max: number
  q_min: number
  q_allowable: number
  passed: boolean
}

// ─────────────────────────────────────────────
// COMPLIANCE
// ─────────────────────────────────────────────

export interface ComplianceReport {
  generatedAt: number
  overallStatus: 'pass' | 'fail' | 'warning'
  checks: ComplianceCheck[]
}

export interface ComplianceCheck {
  id: string
  name: string
  nameLocal: string
  bnbcReference: string
  category: ComplianceCategory
  status: 'pass' | 'fail' | 'warning' | 'not_checked'
  value: number
  limit: number
  unit: string
  failedMembers?: string[]
  suggestion?: string
}

export type ComplianceCategory =
  | 'drift'
  | 'irregularity'
  | 'ductility'
  | 'deflection'
  | 'shear'
  | 'bearing'
  | 'detailing'

// ─────────────────────────────────────────────
// ROOT PROJECT — .civp v2.0
// ─────────────────────────────────────────────

export interface CivilOSProject {
  civp_version: '2.0'
  id: string
  meta: ProjectMeta
  grid: GridData
  materials: MaterialData
  loads: LoadDefinition
  members: MemberData
  analyticalModel: AnalyticalModel
  results: AnalysisResults
  design: DesignResults
  compliance: ComplianceReport
}

// ─────────────────────────────────────────────
// UI STATE
// ─────────────────────────────────────────────

export type ActiveModule =
  | 'dashboard'
  | 'project_setup'
  | 'modeling'
  | 'loads'
  | 'analysis'
  | 'design'
  | 'detailing'
  | 'drawing'
  | 'bbs'
  | 'compliance'
  | 'report'
  | 'optimization'
  | 'bim'
  | 'fem'

export type ViewMode = 'plan' | 'elevation' | '3d' | 'section'

export type ProjectTemplate =
  | 'blank'
  | 'residential_3story'
  | 'residential_6story'
  | 'commercial_4story'
  | 'industrial'
