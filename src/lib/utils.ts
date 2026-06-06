import { ConcreteMaterial } from './types'

// ── ID Generation ────────────────────────────────────────────
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ── Material Calculations ────────────────────────────────────

/** Elastic modulus of concrete: Ec = 4700√f'c (MPa) — ACI 318 */
export function calcEc(fc: number): number {
  return Math.round(4700 * Math.sqrt(fc))
}

/** Modulus of rupture: fr = 0.62λ√f'c (MPa) */
export function calcFr(fc: number, lambda = 1.0): number {
  return +(0.62 * lambda * Math.sqrt(fc)).toFixed(3)
}

/** Shear modulus: G = E / (2(1+ν)) */
export function calcG(E: number, nu: number): number {
  return Math.round(E / (2 * (1 + nu)))
}

// ── Section Properties ───────────────────────────────────────

/** Moment of inertia for rectangular section: I = bh³/12 */
export function calcIRectangular(b: number, h: number): number {
  return (b * Math.pow(h, 3)) / 12
}

/** Area of rectangular section */
export function calcAreaRectangular(b: number, h: number): number {
  return b * h
}

/** Area of circular section */
export function calcAreaCircular(d: number): number {
  return Math.PI * Math.pow(d / 2, 2)
}

/** Moment of inertia for circular section */
export function calcICircular(d: number): number {
  return (Math.PI * Math.pow(d, 4)) / 64
}

// ── BNBC Seismic ─────────────────────────────────────────────

/** Zone factor Z per BNBC 2020 */
export function getBNBCZoneFactor(zone: 1 | 2 | 3): number {
  const zoneMap = { 1: 0.12, 2: 0.20, 3: 0.28 }
  return zoneMap[zone]
}

/** Site coefficient Ca per BNBC 2020 */
export function getBNBCCa(zone: 1 | 2 | 3, siteClass: string): number {
  const table: Record<string, Record<number, number>> = {
    SA: { 1: 0.09, 2: 0.15, 3: 0.21 },
    SB: { 1: 0.12, 2: 0.20, 3: 0.28 },
    SC: { 1: 0.16, 2: 0.24, 3: 0.33 },
    SD: { 1: 0.20, 2: 0.28, 3: 0.36 },
    SE: { 1: 0.24, 2: 0.34, 3: 0.36 },
  }
  return table[siteClass]?.[zone] ?? 0.28
}

/** Site coefficient Cv per BNBC 2020 */
export function getBNBCCv(zone: 1 | 2 | 3, siteClass: string): number {
  const table: Record<string, Record<number, number>> = {
    SA: { 1: 0.12, 2: 0.20, 3: 0.28 },
    SB: { 1: 0.16, 2: 0.27, 3: 0.38 },
    SC: { 1: 0.24, 2: 0.36, 3: 0.45 },
    SD: { 1: 0.32, 2: 0.45, 3: 0.54 },
    SE: { 1: 0.40, 2: 0.64, 3: 0.84 },
  }
  return table[siteClass]?.[zone] ?? 0.54
}

/** Approximate building period: T = Ct × hn^(3/4) */
export function calcBuildingPeriod(Ct: number, hn: number): number {
  return +(Ct * Math.pow(hn, 0.75)).toFixed(3)
}

// ── Unit Conversions ─────────────────────────────────────────

export function mmToM(mm: number): number { return mm / 1000 }
export function mToMm(m: number): number { return m * 1000 }
export function kNToN(kN: number): number { return kN * 1000 }
export function NToKN(N: number): number { return N / 1000 }
export function MPaTokNm2(MPa: number): number { return MPa * 1000 }
export function psiToMPa(psi: number): number { return +(psi * 0.006895).toFixed(3) }
export function MPaToPsi(MPa: number): number { return Math.round(MPa / 0.006895) }

// ── Rebar Utilities ──────────────────────────────────────────

/** Standard bar diameters in mm (BNBC/BD standard) */
export const STANDARD_BAR_DIAMETERS = [10, 12, 16, 20, 25, 32, 40]

/** Bar area in mm² for a given diameter */
export function barArea(dia: number): number {
  return +(Math.PI * Math.pow(dia / 2, 2)).toFixed(1)
}

/** Unit weight of steel bar in kg/m */
export function barWeight(dia: number): number {
  return +(Math.PI * Math.pow(dia / 2, 2) * 7850 / 1e6).toFixed(3)
}

/** Development length (simplified ACI 25.4) */
export function devLength(
  dia: number,
  fy: number,
  fc: number,
  lambda = 1.0
): number {
  const ld = (3 / 40) * (fy / (lambda * Math.sqrt(fc))) * dia
  return Math.max(Math.round(ld), 300)
}

// ── Number Formatting ────────────────────────────────────────

export function round2(n: number): number { return Math.round(n * 100) / 100 }
export function round1(n: number): number { return Math.round(n * 10) / 10 }

/** Format kN with 2 decimal places */
export function fmtKN(n: number): string { return `${round2(n)} kN` }

/** Format kN·m */
export function fmtKNm(n: number): string { return `${round2(n)} kN·m` }

/** Format mm² */
export function fmtMm2(n: number): string { return `${Math.round(n)} mm²` }

/** Format mm */
export function fmtMm(n: number): string { return `${Math.round(n)} mm` }

// ── Date & Time ──────────────────────────────────────────────

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function now(): number { return Date.now() }

// ── Default Material Presets ─────────────────────────────────

export function defaultConcrete(fc = 25): ConcreteMaterial {
  return {
    id: generateId('mat'),
    grade: `f'c=${fc}MPa`,
    fc,
    Ec: calcEc(fc),
    unitWeight: 24,
    poissonRatio: 0.2,
  }
}

export function defaultSteel(fy = 415) {
  return {
    id: generateId('mat'),
    grade: `Grade ${fy}`,
    fy,
    Es: 200000,
    fyt: 275,
  }
}

// ── BNBC Load Combination Defaults ───────────────────────────

export function defaultLoadCombinations() {
  return [
    { id: generateId('lc'), label: '1.4D', code: 'ACI 5.3.1a', factors: [{ loadType: 'D' as const, factor: 1.4 }], isDefault: true },
    { id: generateId('lc'), label: '1.2D + 1.6L', code: 'ACI 5.3.1b', factors: [{ loadType: 'D' as const, factor: 1.2 }, { loadType: 'L' as const, factor: 1.6 }], isDefault: true },
    { id: generateId('lc'), label: '1.2D + 1.6Lr + 1.0L', code: 'ACI 5.3.1c', factors: [{ loadType: 'D' as const, factor: 1.2 }, { loadType: 'Lr' as const, factor: 1.6 }, { loadType: 'L' as const, factor: 1.0 }], isDefault: true },
    { id: generateId('lc'), label: '1.2D + 1.0W + 1.0L', code: 'ACI 5.3.1d', factors: [{ loadType: 'D' as const, factor: 1.2 }, { loadType: 'W' as const, factor: 1.0 }, { loadType: 'L' as const, factor: 1.0 }], isDefault: true },
    { id: generateId('lc'), label: '1.2D + 1.0E + 1.0L', code: 'BNBC 2020', factors: [{ loadType: 'D' as const, factor: 1.2 }, { loadType: 'E' as const, factor: 1.0 }, { loadType: 'L' as const, factor: 1.0 }], isDefault: true },
    { id: generateId('lc'), label: '0.9D + 1.0W', code: 'ACI 5.3.1f', factors: [{ loadType: 'D' as const, factor: 0.9 }, { loadType: 'W' as const, factor: 1.0 }], isDefault: true },
    { id: generateId('lc'), label: '0.9D + 1.0E', code: 'ACI 5.3.1g', factors: [{ loadType: 'D' as const, factor: 0.9 }, { loadType: 'E' as const, factor: 1.0 }], isDefault: true },
  ]
}
