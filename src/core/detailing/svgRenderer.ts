// ============================================================
// CivilOS Structural — SVG Rebar Detail Renderer
// Phase 8: Generates inline SVG diagrams for detailing
// Beam section, Column section, Slab strip, Hook details
// ============================================================

export interface SVGDiagramOptions {
  width:   number
  height:  number
  scale?:  number   // mm → px
  title?:  string
}

// ── Color palette ─────────────────────────────────────────────
const C = {
  concrete:  '#1a2535',
  concBg:    '#0d1525',
  rebar:     '#ef4444',
  stirrup:   '#f97316',
  dim:       '#334155',
  dimText:   '#475569',
  label:     '#94a3b8',
  highlight: '#06b6d4',
  white:     '#e2e8f0',
  grid:      '#1e2d4a',
}

// ── Beam Cross-Section SVG ────────────────────────────────────

export interface BeamSectionProps {
  bw:       number   // mm — web width
  h:        number   // mm — total depth
  cc:       number   // mm — clear cover
  stirDia:  number   // mm — stirrup
  botBars:  { n: number; dia: number }
  topBars:  { n: number; dia: number }
  compBars?: { n: number; dia: number }  // compression bars (optional)
  label?:   string
}

export function renderBeamSection(
  props: BeamSectionProps,
  opts: SVGDiagramOptions = { width: 300, height: 350 }
): string {
  const { bw, h, cc, stirDia, botBars, topBars, label } = props
  const { width: W, height: H } = opts

  // Scale to fit
  const scale = Math.min((W - 60) / bw, (H - 80) / h, 0.8)
  const bwPx  = bw * scale
  const hPx   = h  * scale
  const ccPx  = cc * scale
  const stiPx = stirDia * scale
  const ox    = (W - bwPx) / 2
  const oy    = 40

  // Bar sizes in px
  const botDia = botBars.dia * scale
  const topDia = topBars.dia * scale

  // Bottom bars positions
  const botY   = oy + hPx - ccPx - stiPx - botDia / 2
  const topY   = oy + ccPx + stiPx + topDia / 2
  const botXs  = barPositions(botBars.n, ox + ccPx + stiPx + botDia / 2, ox + bwPx - ccPx - stiPx - botDia / 2)
  const topXs  = barPositions(topBars.n, ox + ccPx + stiPx + topDia / 2, ox + bwPx - ccPx - stiPx - topDia / 2)

  const lines: string[] = []

  // Background
  lines.push(`<rect width="${W}" height="${H}" fill="${C.concBg}" rx="8"/>`)

  // Title
  if (label) {
    lines.push(`<text x="${W/2}" y="20" fill="${C.label}" font-size="11" font-family="monospace" text-anchor="middle" font-weight="bold">${label}</text>`)
  }

  // Concrete section
  lines.push(`<rect x="${ox}" y="${oy}" width="${bwPx}" height="${hPx}" fill="${C.concrete}" stroke="${C.grid}" stroke-width="1.5" rx="2"/>`)

  // Hatching (concrete pattern)
  for (let i = 0; i < 8; i++) {
    const y1 = oy + (i / 8) * hPx
    const y2 = y1 + hPx / 8
    lines.push(`<line x1="${ox+4}" y1="${y1+4}" x2="${ox+bwPx-4}" y2="${y1+4}" stroke="${C.grid}" stroke-width="0.3" opacity="0.4"/>`)
  }

  // Stirrups
  const sX = ox + ccPx, sY = oy + ccPx
  const sW = bwPx - 2 * ccPx, sH = hPx - 2 * ccPx
  lines.push(`<rect x="${sX}" y="${sY}" width="${sW}" height="${sH}" fill="none" stroke="${C.stirrup}" stroke-width="${Math.max(stiPx, 1.5)}" rx="2"/>`)

  // Corner hooks (135° seismic)
  const hkLen = stiPx * 4
  ;[
    [sX, sY, hkLen, hkLen],
    [sX + sW, sY, -hkLen, hkLen],
  ].forEach(([x, y, dx, dy]) => {
    lines.push(`<line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y + dy}" stroke="${C.stirrup}" stroke-width="${Math.max(stiPx, 1.5)}" stroke-linecap="round"/>`)
  })

  // Bottom bars
  botXs.forEach(x => {
    lines.push(`<circle cx="${x}" cy="${botY}" r="${Math.max(botDia/2, 3)}" fill="${C.rebar}" stroke="${C.concBg}" stroke-width="0.5"/>`)
  })

  // Top bars
  topXs.forEach(x => {
    lines.push(`<circle cx="${x}" cy="${topY}" r="${Math.max(topDia/2, 3)}" fill="${C.rebar}" stroke="${C.concBg}" stroke-width="0.5"/>`)
  })

  // Dimension lines
  // Width
  lines.push(dimensionLine(ox, oy + hPx + 20, ox + bwPx, oy + hPx + 20, `${bw}`, W))
  // Height
  lines.push(dimensionLine(ox - 25, oy, ox - 25, oy + hPx, `${h}`, W, true))

  // Labels
  lines.push(`<text x="${ox + bwPx + 8}" y="${botY + 4}" fill="${C.rebar}" font-size="9" font-family="monospace">${botBars.n}-#${botBars.dia}</text>`)
  lines.push(`<text x="${ox + bwPx + 8}" y="${topY + 4}" fill="${C.rebar}" font-size="9" font-family="monospace">${topBars.n}-#${topBars.dia}</text>`)
  lines.push(`<text x="${ox + bwPx + 8}" y="${(topY + botY)/2}" fill="${C.stirrup}" font-size="9" font-family="monospace">#${stirDia}@s</text>`)

  // Cover arrows
  lines.push(smallArrow(ox, botY, ox + ccPx, botY, `cc=${cc}`, 'start'))

  return svgWrap(lines.join('\n'), W, H)
}

// ── Column Cross-Section SVG ──────────────────────────────────

export interface ColumnSectionProps {
  bw:       number   // mm
  h:        number   // mm (= bw for square)
  cc:       number   // mm
  tieDia:   number   // mm
  bars:     { n: number; dia: number }
  isCircular?: boolean
  diameter?: number
  label?:   string
}

export function renderColumnSection(
  props: ColumnSectionProps,
  opts: SVGDiagramOptions = { width: 280, height: 320 }
): string {
  const { bw, h, cc, tieDia, bars, isCircular, diameter, label } = props
  const { width: W, height: H } = opts

  const dim   = isCircular ? (diameter ?? bw) : bw
  const scale = Math.min((W - 80) / dim, (H - 80) / (isCircular ? dim : h), 0.9)
  const dimPx = dim * scale
  const hPx   = isCircular ? dimPx : h * scale
  const ox    = (W - dimPx) / 2
  const oy    = 40

  const lines: string[] = []
  lines.push(`<rect width="${W}" height="${H}" fill="${C.concBg}" rx="8"/>`)

  if (label) {
    lines.push(`<text x="${W/2}" y="22" fill="${C.label}" font-size="11" font-family="monospace" text-anchor="middle" font-weight="bold">${label}</text>`)
  }

  if (isCircular) {
    const cx = ox + dimPx / 2, cy = oy + dimPx / 2, r = dimPx / 2
    lines.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.concrete}" stroke="${C.grid}" stroke-width="1.5"/>`)

    // Spiral/circular tie
    const tiePx = tieDia * scale
    const tieR  = r - (cc + tieDia / 2) * scale
    lines.push(`<circle cx="${cx}" cy="${cy}" r="${tieR}" fill="none" stroke="${C.stirrup}" stroke-width="${Math.max(tiePx, 1.5)}" stroke-dasharray="none"/>`)

    // Bars on circle
    const barR = tieR - (tieDia / 2 + bars.dia / 2) * scale
    const bDia = bars.dia * scale
    for (let i = 0; i < bars.n; i++) {
      const angle = (i / bars.n) * 2 * Math.PI - Math.PI / 2
      const bx = cx + barR * Math.cos(angle)
      const by = cy + barR * Math.sin(angle)
      lines.push(`<circle cx="${bx}" cy="${by}" r="${Math.max(bDia/2, 3)}" fill="${C.rebar}" stroke="${C.concBg}" stroke-width="0.5"/>`)
    }

    lines.push(dimensionLine(ox, oy + dimPx + 20, ox + dimPx, oy + dimPx + 20, `⌀${dim}`, W))

  } else {
    // Rectangular
    lines.push(`<rect x="${ox}" y="${oy}" width="${dimPx}" height="${hPx}" fill="${C.concrete}" stroke="${C.grid}" stroke-width="1.5" rx="2"/>`)

    const tiePx = tieDia * scale
    const ccPx  = cc * scale
    lines.push(`<rect x="${ox+ccPx}" y="${oy+ccPx}" width="${dimPx-2*ccPx}" height="${hPx-2*ccPx}" fill="none" stroke="${C.stirrup}" stroke-width="${Math.max(tiePx, 1.5)}" rx="2"/>`)

    // Bars at corners and sides
    const bDia = bars.dia * scale
    const inset = (ccPx + tiePx + bDia / 2)
    const bxs = barPositions(Math.ceil(bars.n / 2), ox + inset, ox + dimPx - inset)
    const bys = barPositions(2, oy + inset, oy + hPx - inset)

    bxs.forEach(bx => {
      bys.forEach(by => {
        lines.push(`<circle cx="${bx}" cy="${by}" r="${Math.max(bDia/2, 3)}" fill="${C.rebar}" stroke="${C.concBg}" stroke-width="0.5"/>`)
      })
    })

    lines.push(dimensionLine(ox, oy + hPx + 20, ox + dimPx, oy + hPx + 20, `${bw}`, W))
    lines.push(dimensionLine(ox - 28, oy, ox - 28, oy + hPx, `${h}`, W, true))
  }

  // Bar label
  lines.push(`<text x="${W/2}" y="${H - 12}" fill="${C.rebar}" font-size="10" font-family="monospace" text-anchor="middle">${bars.n}-#${bars.dia}mm | #${tieDia}mm ties</text>`)

  return svgWrap(lines.join('\n'), W, H)
}

// ── Hook Detail SVG ───────────────────────────────────────────

export function renderHookDetail(
  db: number,        // mm
  ldh: number,       // mm
  hookExt: number,   // mm — 12db
  bendDia: number,   // mm
  opts: SVGDiagramOptions = { width: 260, height: 200 }
): string {
  const { width: W, height: H } = opts
  const scale = Math.min(W / (ldh + hookExt + 60), H / (bendDia + hookExt + 40), 0.15)

  const barW  = Math.max(db * scale, 3)
  const ldhPx = ldh * scale
  const extPx = hookExt * scale
  const bendR = Math.max(bendDia * scale / 2, 10)
  const ox = 30, oy = H / 2

  const lines: string[] = []
  lines.push(`<rect width="${W}" height="${H}" fill="${C.concBg}" rx="8"/>`)
  lines.push(`<text x="${W/2}" y="18" fill="${C.label}" font-size="10" font-family="monospace" text-anchor="middle">90° Standard Hook</text>`)

  // Straight portion
  lines.push(`<line x1="${ox}" y1="${oy}" x2="${ox + ldhPx}" y2="${oy}" stroke="${C.rebar}" stroke-width="${barW}" stroke-linecap="round"/>`)

  // Bend arc
  const arcX = ox + ldhPx
  lines.push(`<path d="M${arcX},${oy} A${bendR},${bendR} 0 0,0 ${arcX + bendR},${oy + bendR}" fill="none" stroke="${C.rebar}" stroke-width="${barW}"/>`)

  // Extension
  lines.push(`<line x1="${arcX + bendR}" y1="${oy + bendR}" x2="${arcX + bendR}" y2="${oy + bendR + extPx}" stroke="${C.rebar}" stroke-width="${barW}" stroke-linecap="round"/>`)

  // Dimensions
  lines.push(dimensionLine(ox, oy + 20, ox + ldhPx, oy + 20, `ldh=${ldh}mm`, W))
  lines.push(dimensionLine(arcX + bendR + 15, oy + bendR, arcX + bendR + 15, oy + bendR + extPx, `12db=${hookExt}mm`, W, true))

  return svgWrap(lines.join('\n'), W, H)
}

// ── Slab Strip SVG ────────────────────────────────────────────

export function renderSlabStrip(
  t:       number,   // mm — thickness
  cc:      number,   // mm — cover
  barDia:  number,   // mm — main bar
  spacing: number,   // mm — bar spacing
  stripW:  number,   // mm — shown strip width (e.g. 1000mm)
  label?:  string,
  opts: SVGDiagramOptions = { width: 360, height: 160 }
): string {
  const { width: W, height: H } = opts
  const scale = Math.min((W - 60) / stripW, (H - 60) / t, 0.4)
  const tPx   = Math.max(t * scale, 30)
  const wPx   = Math.min(stripW * scale, W - 60)
  const ox    = (W - wPx) / 2
  const oy    = 30

  const lines: string[] = []
  lines.push(`<rect width="${W}" height="${H}" fill="${C.concBg}" rx="8"/>`)

  if (label) {
    lines.push(`<text x="${W/2}" y="18" fill="${C.label}" font-size="10" font-family="monospace" text-anchor="middle">${label}</text>`)
  }

  // Slab
  lines.push(`<rect x="${ox}" y="${oy}" width="${wPx}" height="${tPx}" fill="${C.concrete}" stroke="${C.grid}" stroke-width="1.5"/>`)

  // Main bars (bottom)
  const barY  = oy + tPx - (cc + barDia / 2) * scale
  const bDia  = Math.max(barDia * scale, 3)
  const nBars = Math.floor(stripW / spacing) + 1
  for (let i = 0; i < nBars; i++) {
    const bx = ox + (i * spacing * scale)
    if (bx > ox + wPx) break
    lines.push(`<circle cx="${bx}" cy="${barY}" r="${bDia / 2}" fill="${C.rebar}" stroke="${C.concBg}" stroke-width="0.5"/>`)
  }

  // Dimensions
  lines.push(dimensionLine(ox, oy + tPx + 18, ox + wPx, oy + tPx + 18, `${stripW}mm strip`, W))
  lines.push(dimensionLine(ox - 25, oy, ox - 25, oy + tPx, `${t}`, W, true))
  lines.push(dimensionLine(ox, oy - 15, ox + spacing * scale, oy - 15, `@${spacing}`, W))

  // Bar label
  lines.push(`<text x="${W/2}" y="${H - 8}" fill="${C.rebar}" font-size="9" font-family="monospace" text-anchor="middle">#${barDia}mm @ ${spacing}mm c/c</text>`)

  return svgWrap(lines.join('\n'), W, H)
}

// ── Helpers ───────────────────────────────────────────────────

function barPositions(n: number, x1: number, x2: number): number[] {
  if (n <= 1) return [(x1 + x2) / 2]
  return Array.from({ length: n }, (_, i) => x1 + (i / (n - 1)) * (x2 - x1))
}

function dimensionLine(
  x1: number, y1: number,
  x2: number, y2: number,
  text: string,
  _W: number,
  vertical = false
): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const anchor = vertical ? 'end' : 'middle'
  const tx = vertical ? mx - 4 : mx
  const ty = vertical ? my : y1 + 10

  return [
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.dim}" stroke-width="0.8" marker-start="url(#arr)" marker-end="url(#arr)"/>`,
    `<text x="${tx}" y="${ty}" fill="${C.dimText}" font-size="9" font-family="monospace" text-anchor="${anchor}">${text}</text>`,
  ].join('\n')
}

function smallArrow(x1: number, y1: number, x2: number, y2: number, text: string, anchor: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.highlight}" stroke-width="0.8" stroke-dasharray="3,2"/>
<text x="${(x1+x2)/2}" y="${y1-4}" fill="${C.highlight}" font-size="8" font-family="monospace" text-anchor="${anchor}">${text}</text>`
}

function svgWrap(content: string, W: number, H: number): string {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arr" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
      <path d="M0,0 L4,2 L0,4" fill="none" stroke="${C.dim}" stroke-width="0.8"/>
    </marker>
  </defs>
  ${content}
</svg>`
}
