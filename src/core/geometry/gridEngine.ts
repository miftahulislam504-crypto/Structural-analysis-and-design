// ============================================================
// CivilOS Structural — Grid Engine
// Converts physical mm coordinates ↔ canvas pixel coordinates
// ============================================================

import { GridData, GridLine, Story } from '../../lib/types'

export interface CanvasTransform {
  scale: number      // pixels per mm
  offsetX: number    // canvas origin X (pixels)
  offsetY: number    // canvas origin Y (pixels)
}

export interface GridPoint {
  x: number   // mm (physical)
  y: number   // mm (physical)
  gridX: string  // X grid line id
  gridY: string  // Y grid line id
  label: string  // e.g. "A-1"
}

export interface CanvasPoint {
  x: number   // pixels
  y: number   // pixels
}

// ── Coordinate conversion ────────────────────────────────────

export function mmToCanvas(
  mmX: number,
  mmY: number,
  transform: CanvasTransform
): CanvasPoint {
  return {
    x: transform.offsetX + mmX * transform.scale,
    y: transform.offsetY + mmY * transform.scale,
  }
}

export function canvasToMm(
  px: number,
  py: number,
  transform: CanvasTransform
): { x: number; y: number } {
  return {
    x: (px - transform.offsetX) / transform.scale,
    y: (py - transform.offsetY) / transform.scale,
  }
}

// ── Snap to nearest grid point ───────────────────────────────

export function snapToGrid(
  mmX: number,
  mmY: number,
  grid: GridData,
  snapTolerance = 500  // mm
): { x: number; y: number; gridX?: string; gridY?: string } {
  let nearestX = mmX
  let nearestY = mmY
  let nearestGridX: string | undefined
  let nearestGridY: string | undefined
  let minDistX = snapTolerance
  let minDistY = snapTolerance

  for (const line of grid.xLines) {
    const dist = Math.abs(mmX - line.position)
    if (dist < minDistX) {
      minDistX = dist
      nearestX = line.position
      nearestGridX = line.id
    }
  }

  for (const line of grid.yLines) {
    const dist = Math.abs(mmY - line.position)
    if (dist < minDistY) {
      minDistY = dist
      nearestY = line.position
      nearestGridY = line.id
    }
  }

  return { x: nearestX, y: nearestY, gridX: nearestGridX, gridY: nearestGridY }
}

// ── Get all grid intersection points ────────────────────────

export function getGridIntersections(grid: GridData): GridPoint[] {
  const points: GridPoint[] = []
  for (const xLine of grid.xLines) {
    for (const yLine of grid.yLines) {
      points.push({
        x: xLine.position,
        y: yLine.position,
        gridX: xLine.id,
        gridY: yLine.id,
        label: `${xLine.label}-${yLine.label}`,
      })
    }
  }
  return points
}

// ── Calculate bounding box of grid ──────────────────────────

export function getGridBounds(grid: GridData): {
  minX: number; maxX: number; minY: number; maxY: number
  width: number; height: number
} {
  if (grid.xLines.length === 0 || grid.yLines.length === 0) {
    return { minX: 0, maxX: 10000, minY: 0, maxY: 8000, width: 10000, height: 8000 }
  }

  const xs = grid.xLines.map(l => l.position)
  const ys = grid.yLines.map(l => l.position)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

// ── Fit grid to canvas ───────────────────────────────────────

export function fitGridToCanvas(
  grid: GridData,
  canvasWidth: number,
  canvasHeight: number,
  padding = 80  // pixels
): CanvasTransform {
  const bounds = getGridBounds(grid)
  const availW = canvasWidth - padding * 2
  const availH = canvasHeight - padding * 2

  const scaleX = availW / (bounds.width || 10000)
  const scaleY = availH / (bounds.height || 8000)
  const scale = Math.min(scaleX, scaleY, 0.12)  // max 0.12 px/mm

  const totalW = bounds.width * scale
  const totalH = bounds.height * scale

  return {
    scale,
    offsetX: (canvasWidth - totalW) / 2 - bounds.minX * scale,
    offsetY: (canvasHeight - totalH) / 2 - bounds.minY * scale,
  }
}

// ── Get grid line label positions ────────────────────────────

export function getXLineLabel(
  line: GridLine,
  grid: GridData,
  transform: CanvasTransform
): CanvasPoint {
  const firstY = grid.yLines[0]?.position ?? 0
  const pt = mmToCanvas(line.position, firstY, transform)
  return { x: pt.x, y: pt.y - 30 }
}

export function getYLineLabel(
  line: GridLine,
  grid: GridData,
  transform: CanvasTransform
): CanvasPoint {
  const firstX = grid.xLines[0]?.position ?? 0
  const pt = mmToCanvas(firstX, line.position, transform)
  return { x: pt.x - 30, y: pt.y }
}

// ── Story utilities ──────────────────────────────────────────

export function getStoryByIndex(stories: Story[], index: number): Story | null {
  return stories[index] ?? null
}

export function getStoryElevation(stories: Story[], storyId: string): number {
  return stories.find(s => s.id === storyId)?.level ?? 0
}
