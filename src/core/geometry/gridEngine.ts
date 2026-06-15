// ============================================================
// CivilOS Structural — Grid Engine
// Coordinate transforms, snap-to-grid, canvas utilities
// ============================================================

import { GridData } from '../../lib/types'

export interface CanvasTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export interface SnapResult {
  x: number
  y: number
  gridX?: string
  gridY?: string
}

/**
 * Convert mm world coordinates to canvas pixel coordinates
 */
export function mmToCanvas(
  mmX: number,
  mmY: number,
  t: CanvasTransform,
): { x: number; y: number } {
  return {
    x: mmX * t.scale + t.offsetX,
    y: mmY * t.scale + t.offsetY,
  }
}

/**
 * Convert canvas pixel coordinates to mm world coordinates
 */
export function canvasToMm(
  px: number,
  py: number,
  t: CanvasTransform,
): { x: number; y: number } {
  return {
    x: (px - t.offsetX) / t.scale,
    y: (py - t.offsetY) / t.scale,
  }
}

/**
 * Snap point (mm) to nearest grid intersection within tolerance
 */
export function snapToGrid(
  x: number,
  y: number,
  grid: GridData,
  tolerance: number,
): SnapResult {
  let bestDist = tolerance
  let result: SnapResult = { x, y }

  for (const gx of grid.xLines) {
    for (const gy of grid.yLines) {
      const dx = x - gx.position
      const dy = y - gy.position
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) {
        bestDist = dist
        result = { x: gx.position, y: gy.position, gridX: gx.id, gridY: gy.id }
      }
    }
  }
  return result
}

/**
 * Calculate a transform that fits the entire grid into the canvas
 */
export function fitGridToCanvas(
  grid: GridData,
  canvasWidth: number,
  canvasHeight: number,
): CanvasTransform {
  if (!grid.xLines.length || !grid.yLines.length) {
    return { scale: 0.06, offsetX: 80, offsetY: 80 }
  }

  const xPositions = grid.xLines.map(l => l.position)
  const yPositions = grid.yLines.map(l => l.position)

  const minX = Math.min(...xPositions)
  const maxX = Math.max(...xPositions)
  const minY = Math.min(...yPositions)
  const maxY = Math.max(...yPositions)

  const gridW = maxX - minX || 1
  const gridH = maxY - minY || 1

  const PADDING = 80
  const scaleX = (canvasWidth  - PADDING * 2) / gridW
  const scaleY = (canvasHeight - PADDING * 2) / gridH
  const scale  = Math.min(scaleX, scaleY, 0.15)

  const offsetX = PADDING - minX * scale + ((canvasWidth  - PADDING * 2) - gridW * scale) / 2
  const offsetY = PADDING - minY * scale + ((canvasHeight - PADDING * 2) - gridH * scale) / 2

  return { scale, offsetX, offsetY }
}

/**
 * Get all grid intersection points
 */
export function getGridIntersections(
  grid: GridData,
): { x: number; y: number; gridX: string; gridY: string }[] {
  const pts: { x: number; y: number; gridX: string; gridY: string }[] = []
  for (const gx of grid.xLines) {
    for (const gy of grid.yLines) {
      pts.push({ x: gx.position, y: gy.position, gridX: gx.id, gridY: gy.id })
    }
  }
  return pts
}
