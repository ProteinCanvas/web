import { capture } from '@/shared/lib/capture-registry'

export type FigurePreset = 'nature-1col' | 'nature-2col' | 'presentation' | 'screen'
export type FigureLayout = 'structure' | 'composite'

export interface FigureOptions {
  layout: FigureLayout
  preset: FigurePreset
  background: 'white' | 'black'
  title?: string
  panelLabels?: boolean
  metrics?: Array<{ label: string; value: string }>
}

interface PresetSpec {
  widthPx: number
  heightPx?: number
  dpi: number
}

const PRESETS: Record<FigurePreset, PresetSpec> = {
  'nature-1col': { widthPx: 1063, dpi: 300 },
  'nature-2col': { widthPx: 2126, dpi: 300 },
  'presentation': { widthPx: 1920, heightPx: 1080, dpi: 96 },
  'screen': { widthPx: 0, dpi: 96 },
}

function pt(points: number, dpi: number): number {
  return Math.round((points / 72) * dpi)
}

async function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function composeFigure(opts: FigureOptions): Promise<string | null> {
  const { layout, preset, background, title, panelLabels, metrics = [] } = opts
  const spec = PRESETS[preset]
  const dpi = spec.dpi

  const bg = background === 'white' ? '#ffffff' : '#0a0a0a'
  const fg = background === 'white' ? '#111827' : '#f9fafb'
  const muted = background === 'white' ? '#6b7280' : '#9ca3af'
  const panelBg = background === 'white' ? '#f9fafb' : '#161616'
  const panelBorder = background === 'white' ? '#e5e7eb' : '#2a2a2a'

  const MARGIN = pt(8, dpi)
  const GAP = pt(4, dpi)
  const HEADER_H = title ? pt(18, dpi) : MARGIN
  const FOOTER_H = pt(10, dpi)

  const structureSrc = await capture('structure')
  const structureImg = structureSrc ? await loadImg(structureSrc) : null

  if (layout === 'structure') {
    let targetW = spec.widthPx
    if (preset === 'screen') {
      targetW = structureImg?.width ?? 800
    }

    const structureCapture = await captureStructureAtSize(targetW, spec.heightPx)
    if (!structureCapture) return null

    const img = await loadImg(structureCapture)
    if (!img) return null

    const totalH = spec.heightPx ?? img.height
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = totalH + HEADER_H + FOOTER_H

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (title) {
      ctx.fillStyle = fg
      ctx.font = `${pt(8, dpi)}px Helvetica, Arial, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(title, MARGIN, HEADER_H / 2)
    }

    if (panelLabels) {
      ctx.fillStyle = fg
      ctx.font = `bold ${pt(8, dpi)}px Helvetica, Arial, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText('a', MARGIN, HEADER_H + MARGIN / 2)
    }

    ctx.drawImage(img, 0, HEADER_H, targetW, totalH)

    renderFooter(ctx, canvas.width, canvas.height, FOOTER_H, muted, dpi)
    return canvas.toDataURL('image/png')
  }

  const chartSrc = await capture('scatter')
  const chartImg = chartSrc ? await loadImg(chartSrc) : null

  let targetW = spec.widthPx
  if (preset === 'screen') {
    targetW = (structureImg?.width ?? 600) + 360
  }

  const STRUCTURE_W = Math.round(targetW * 0.58)
  const RIGHT_W = targetW - STRUCTURE_W - MARGIN * 3 - GAP
  const INNER_H = spec.heightPx
    ? spec.heightPx - HEADER_H - FOOTER_H - MARGIN * 2
    : STRUCTURE_W

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = INNER_H + HEADER_H + FOOTER_H + MARGIN * 2

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (title) {
    ctx.fillStyle = fg
    ctx.font = `${pt(8, dpi)}px Helvetica, Arial, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(title, MARGIN, HEADER_H / 2)
  }

  const structureX = MARGIN
  const contentY = HEADER_H + MARGIN

  if (panelLabels) {
    ctx.fillStyle = fg
    ctx.font = `bold ${pt(8, dpi)}px Helvetica, Arial, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText('a', structureX + pt(2, dpi), contentY + pt(2, dpi))
  }

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(structureX, contentY, STRUCTURE_W, INNER_H)

  if (structureImg) {
    const aspect = structureImg.width / structureImg.height
    let dw = STRUCTURE_W
    let dh = dw / aspect
    if (dh > INNER_H) { dh = INNER_H; dw = dh * aspect }
    ctx.drawImage(
      structureImg,
      structureX + (STRUCTURE_W - dw) / 2,
      contentY + (INNER_H - dh) / 2,
      dw,
      dh
    )
  }

  const rightX = structureX + STRUCTURE_W + MARGIN + GAP

  const CHART_H = chartImg ? Math.round(INNER_H * 0.52) : 0
  const METRICS_TOP = contentY + CHART_H + (chartImg ? GAP : 0)
  const METRICS_H = INNER_H - CHART_H - (chartImg ? GAP : 0)

  if (chartImg) {
    if (panelLabels) {
      ctx.fillStyle = fg
      ctx.font = `bold ${pt(8, dpi)}px Helvetica, Arial, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText('b', rightX + pt(2, dpi), contentY + pt(2, dpi))
    }
    ctx.fillStyle = panelBg
    ctx.strokeStyle = panelBorder
    ctx.lineWidth = 1
    ctx.fillRect(rightX, contentY, RIGHT_W, CHART_H)
    ctx.strokeRect(rightX, contentY, RIGHT_W, CHART_H)
    ctx.drawImage(chartImg, rightX, contentY, RIGHT_W, CHART_H)
  }

  if (metrics.length > 0) {
    if (panelLabels && !chartImg) {
      ctx.fillStyle = fg
      ctx.font = `bold ${pt(8, dpi)}px Helvetica, Arial, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText('b', rightX + pt(2, dpi), METRICS_TOP + pt(2, dpi))
    }
    ctx.fillStyle = panelBg
    ctx.strokeStyle = panelBorder
    ctx.lineWidth = 1
    ctx.fillRect(rightX, METRICS_TOP, RIGHT_W, METRICS_H)
    ctx.strokeRect(rightX, METRICS_TOP, RIGHT_W, METRICS_H)

    const ROW_H = pt(11, dpi)
    const LABEL_SZ = pt(5.5, dpi)
    const VAL_SZ = pt(8, dpi)
    const mPad = pt(5, dpi)
    const cols = 2
    const colW = RIGHT_W / cols

    metrics.forEach(({ label, value }, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const mx = rightX + col * colW + mPad
      const my = METRICS_TOP + mPad + row * (ROW_H + pt(3, dpi))

      ctx.fillStyle = muted
      ctx.font = `${LABEL_SZ}px Helvetica, Arial, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText(label, mx, my)

      ctx.fillStyle = fg
      ctx.font = `bold ${VAL_SZ}px Helvetica, Arial, sans-serif`
      ctx.fillText(value, mx, my + LABEL_SZ + pt(1, dpi))
    })
  }

  renderFooter(ctx, canvas.width, canvas.height, FOOTER_H, muted, dpi)
  return canvas.toDataURL('image/png')
}

function renderFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  footerH: number,
  color: string,
  dpi: number
) {
  ctx.fillStyle = color
  ctx.font = `${pt(4.5, dpi)}px Helvetica, Arial, sans-serif`
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'right'
  ctx.fillText('Generated with ProteinCanvas', w - pt(4, dpi), h - pt(2, dpi))
  ctx.textAlign = 'left'
}

async function captureStructureAtSize(
  targetW: number,
  targetH?: number
): Promise<string | null> {
  const { capture } = await import('@/shared/lib/capture-registry')
  const raw = await capture('structure')
  if (!raw) return null

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const h = targetH ?? Math.round((targetW * img.height) / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, targetW, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = raw
  })
}

export function presetDimensions(preset: FigurePreset): { width: number; dpi: number } {
  const spec = PRESETS[preset]
  return { width: spec.widthPx, dpi: spec.dpi }
}
