'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  type MouseHandlerDataParam,
} from 'recharts'
import { Download, X as XIcon } from 'lucide-react'
import { Spinner } from '@/shared/components/Spinner'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useInteraction } from '@/shared/hooks/useInteraction'
import { registerCapture, unregisterCapture } from '@/shared/lib/capture-registry'
import { interpolateColor } from '@/shared/lib/color-utils'
import { svgElementToPng } from '@/features/export/lib/chart-export'
import { EmptyState } from '@/shared/components/EmptyState'
import { TabBar } from '@/shared/components/TabBar'
import { getMetricMeta } from '@/shared/lib/metric-registry'
import type { Candidate, MetricField, ExperimentalResult } from '@/shared/types'
import { EXP_COLOR_OPTIONS } from '../lib/exp-color-options'

interface MetricPanelProps {
  candidates: Candidate[]
  metricFields: MetricField[]
  experimentalResults?: ExperimentalResult[]
  onBrushSelection?: (selectedIds: Set<string>) => void
  className?: string
}

type ActiveTab = 'scatter' | 'distribution'

const ANALYTICS_TABS: { id: ActiveTab; label: string }[] = [
  { id: 'scatter', label: 'Scatter' },
  { id: 'distribution', label: 'Distribution' },
]

function getNumericValue(c: Candidate, key: string): number | null {
  const v = c.metrics[key]
  return typeof v === 'number' ? v : null
}

function getExpColorValue(exp: ExperimentalResult | undefined, key: string): number | null {
  if (!exp) return null
  if (key === 'exp_binding') return exp.bindingSuccess === true ? 1 : exp.bindingSuccess === false ? 0 : null
  if (key === 'exp_kd') return exp.kd != null && exp.kd > 0 ? exp.kd : null
  if (key === 'exp_expression') return exp.expressionRate ?? null
  if (key === 'exp_tm') return exp.tm ?? null
  return null
}

const CHART_HEIGHT = 280

function ChartExportButton({ canvasRef, filename }: { canvasRef: React.RefObject<HTMLCanvasElement | null>; filename: string }) {
  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = filename
    a.click()
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      title="Export chart as PNG"
    >
      <Download size={11} />
      PNG
    </button>
  )
}

function SvgChartExportButton({ containerRef, filename }: { containerRef: React.RefObject<HTMLDivElement | null>; filename: string }) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!containerRef.current || loading) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return
    setLoading(true)
    try {
      const dataUrl = await svgElementToPng(svgEl as SVGElement, { background: '#ffffff', scale: 2 })
      if (dataUrl) {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = filename
        a.click()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors"
      title="Export chart as PNG"
    >
      {loading ? (
        <Spinner size="sm" className="border-muted-foreground/50 border-t-muted-foreground" />
      ) : (
        <Download size={11} />
      )}
      PNG
    </button>
  )
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * mag
}

function niceTicks(min: number, max: number, target = 5): number[] {
  const range = max - min
  if (range === 0) return [min]
  const step = niceStep(range, target)
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.001 && ticks.length <= target + 2; v = parseFloat((v + step).toPrecision(12))) {
    ticks.push(parseFloat(v.toPrecision(10)))
  }
  return ticks
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 10000) return (v / 1000).toFixed(0) + 'k'
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k'
  if (Number.isInteger(v) || Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1)
  if (Math.abs(v) >= 1) return v.toFixed(2)
  return v.toPrecision(2)
}

interface ScatterPoint {
  id: string
  x: number
  y: number
  colorVal: number | null
  canvasX: number
  canvasY: number
}

const PAD = { top: 20, right: 20, bottom: 46, left: 56 }
const PT_R = 3.5
const PT_R_SEL = 6
const PT_R_HOV = 4.5

function ScatterTab({
  candidates,
  metricFields,
  experimentalResults,
}: {
  candidates: Candidate[]
  metricFields: MetricField[]
  experimentalResults?: ExperimentalResult[]
}) {
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const hoveredCandidateId = useViewerStore((s) => s.hoveredCandidateId)
  const brushedCandidateIds = useViewerStore((s) => s.brushedCandidateIds)
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)
  const { focusCandidate, hoverCandidate, brushCandidates } = useInteraction()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointsRef = useRef<ScatterPoint[]>([])
  const cssDims = useRef({ w: 0, h: CHART_HEIGHT })
  const brushStartRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)

  const [brushBox, setBrushBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ mouseX: number; mouseY: number; candidateId: string } | null>(null)
  const [xKey, setXKey] = useState<string>(metricFields[0]?.key ?? '')
  const [yKey, setYKey] = useState<string>(metricFields[1]?.key ?? metricFields[0]?.key ?? '')
  const [colorKey, setColorKey] = useState<string>('')

  useEffect(() => {
    setXKey(metricFields[0]?.key ?? '')
    setYKey(metricFields[1]?.key ?? metricFields[0]?.key ?? '')
  }, [metricFields])

  const xField = useMemo(() => metricFields.find((f) => f.key === xKey), [metricFields, xKey])
  const yField = useMemo(() => metricFields.find((f) => f.key === yKey), [metricFields, yKey])
  const colorField = useMemo(() => metricFields.find((f) => f.key === colorKey), [metricFields, colorKey])

  const expByCandidate = useMemo(
    () => new Map((experimentalResults ?? []).map((r) => [r.candidateId, r])),
    [experimentalResults]
  )
  const isExpColor = colorKey.startsWith('exp_')

  const rawData = useMemo(() => {
    return candidates.flatMap((c) => {
      const x = getNumericValue(c, xKey)
      const y = getNumericValue(c, yKey)
      if (x === null || y === null) return []
      return [{ id: c.id, x, y, colorVal: colorKey ? getNumericValue(c, colorKey) : null }]
    })
  }, [candidates, xKey, yKey, colorKey])

  const ranges = useMemo(() => {
    if (rawData.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
    const xs = rawData.map((d) => d.x)
    const ys = rawData.map((d) => d.y)
    return {
      xMin: xField?.min ?? Math.min(...xs),
      xMax: xField?.max ?? Math.max(...xs),
      yMin: yField?.min ?? Math.min(...ys),
      yMax: yField?.max ?? Math.max(...ys),
    }
  }, [rawData, xField, yField])

  const colorRange = useMemo(() => {
    if (!colorKey) return null
    if (isExpColor && colorKey !== 'exp_binding') {
      const vals: number[] = []
      Array.from(expByCandidate.values()).forEach((r) => {
        const v = getExpColorValue(r, colorKey)
        if (v !== null) vals.push(colorKey === 'exp_kd' ? Math.log10(v) : v)
      })
      if (vals.length === 0) return null
      return { min: Math.min(...vals), max: Math.max(...vals) }
    }
    const vals = rawData.flatMap((d) => (d.colorVal !== null ? [d.colorVal] : []))
    if (vals.length === 0) return null
    return {
      min: colorField?.min ?? Math.min(...vals),
      max: colorField?.max ?? Math.max(...vals),
    }
  }, [rawData, colorKey, colorField, isExpColor, expByCandidate])

  const buildPoints = useCallback(
    (cssW: number, cssH: number): ScatterPoint[] => {
      const plotW = cssW - PAD.left - PAD.right
      const plotH = cssH - PAD.top - PAD.bottom
      const { xMin, xMax, yMin, yMax } = ranges
      const xRange = xMax - xMin || 1
      const yRange = yMax - yMin || 1
      return rawData.map((d) => ({
        ...d,
        canvasX: PAD.left + ((d.x - xMin) / xRange) * plotW,
        canvasY: PAD.top + (1 - (d.y - yMin) / yRange) * plotH,
      }))
    },
    [rawData, ranges]
  )

  const draw = useCallback(
    (points: ScatterPoint[], brush: typeof brushBox) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio ?? 1
      const { w, h } = cssDims.current
      const { xMin, xMax, yMin, yMax } = ranges
      const xRange = xMax - xMin || 1
      const yRange = yMax - yMin || 1
      const plotW = w - PAD.left - PAD.right
      const plotH = h - PAD.top - PAD.bottom

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const xTicks = niceTicks(xMin, xMax)
      const yTicks = niceTicks(yMin, yMax)

      ctx.strokeStyle = 'rgba(128,128,128,0.1)'
      ctx.lineWidth = 1
      for (const tick of xTicks) {
        const gx = PAD.left + ((tick - xMin) / xRange) * plotW
        if (gx < PAD.left - 1 || gx > PAD.left + plotW + 1) continue
        ctx.beginPath()
        ctx.moveTo(gx, PAD.top)
        ctx.lineTo(gx, PAD.top + plotH)
        ctx.stroke()
      }
      for (const tick of yTicks) {
        const gy = PAD.top + (1 - (tick - yMin) / yRange) * plotH
        if (gy < PAD.top - 1 || gy > PAD.top + plotH + 1) continue
        ctx.beginPath()
        ctx.moveTo(PAD.left, gy)
        ctx.lineTo(PAD.left + plotW, gy)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(128,128,128,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD.left, PAD.top)
      ctx.lineTo(PAD.left, PAD.top + plotH)
      ctx.lineTo(PAD.left + plotW, PAD.top + plotH)
      ctx.stroke()

      ctx.fillStyle = 'rgba(110,110,110,0.85)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const tick of xTicks) {
        const gx = PAD.left + ((tick - xMin) / xRange) * plotW
        if (gx < PAD.left - 1 || gx > PAD.left + plotW + 1) continue
        ctx.fillText(formatTick(tick), gx, PAD.top + plotH + 6)
      }
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (const tick of yTicks) {
        const gy = PAD.top + (1 - (tick - yMin) / yRange) * plotH
        if (gy < PAD.top - 1 || gy > PAD.top + plotH + 1) continue
        ctx.fillText(formatTick(tick), PAD.left - 6, gy)
      }

      ctx.save()
      ctx.fillStyle = 'rgba(100,100,100,0.95)'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(xField?.label ?? xKey, PAD.left + plotW / 2, h - 4)
      ctx.translate(14, PAD.top + plotH / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(yField?.label ?? yKey, 0, 0)
      ctx.restore()

      const brushedSet = brushedCandidateIds ? new Set(brushedCandidateIds) : null
      const hasBrush = brushedSet !== null && brushedSet.size > 0

      let selectedPt: ScatterPoint | null = null
      let hoveredPt: ScatterPoint | null = null

      for (const pt of points) {
        if (pt.id === selectedCandidateId) { selectedPt = pt; continue }
        if (pt.id === hoveredCandidateId) { hoveredPt = pt; continue }

        const isBrushed = brushedSet?.has(pt.id) ?? false

        let fill: string
        if (isBrushed) {
          fill = 'rgba(96,165,250,0.75)'
        } else if (hasBrush) {
          fill = 'rgba(140,140,140,0.18)'
        } else if (isExpColor) {
          const expResult = expByCandidate.get(pt.id)
          if (!expResult) {
            fill = 'rgba(110,110,110,0.18)'
          } else if (colorKey === 'exp_binding') {
            const bv = getExpColorValue(expResult, 'exp_binding')
            fill = bv === 1 ? 'rgba(34,197,94,0.78)' : bv === 0 ? 'rgba(239,68,68,0.62)' : 'rgba(140,140,140,0.35)'
          } else {
            const raw = getExpColorValue(expResult, colorKey)
            if (raw === null || !colorRange) {
              fill = 'rgba(140,140,140,0.35)'
            } else {
              const val = colorKey === 'exp_kd' ? Math.log10(raw) : raw
              const t = Math.max(0, Math.min(1, (val - colorRange.min) / ((colorRange.max - colorRange.min) || 1)))
              fill = interpolateColor(t)
            }
          }
        } else if (colorKey && pt.colorVal !== null && colorRange) {
          const t = Math.max(0, Math.min(1, (pt.colorVal - colorRange.min) / ((colorRange.max - colorRange.min) || 1)))
          fill = interpolateColor(t)
        } else {
          fill = 'rgba(96,165,250,0.55)'
        }

        ctx.beginPath()
        ctx.arc(pt.canvasX, pt.canvasY, PT_R, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()
      }

      if (hoveredPt) {
        ctx.beginPath()
        ctx.arc(hoveredPt.canvasX, hoveredPt.canvasY, PT_R_HOV, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(96,165,250,0.9)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.88)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      if (selectedPt) {
        ctx.shadowColor = 'rgba(96,165,250,0.45)'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(selectedPt.canvasX, selectedPt.canvasY, PT_R_SEL, 0, Math.PI * 2)
        ctx.fillStyle = 'rgb(96,165,250)'
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      if (brush) {
        const bx = Math.min(brush.x1, brush.x2)
        const by = Math.min(brush.y1, brush.y2)
        const bw = Math.abs(brush.x2 - brush.x1)
        const bh = Math.abs(brush.y2 - brush.y1)
        ctx.fillStyle = 'rgba(96,165,250,0.06)'
        ctx.fillRect(bx, by, bw, bh)
        ctx.strokeStyle = 'rgba(96,165,250,0.65)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.strokeRect(bx, by, bw, bh)
        ctx.setLineDash([])
      }

      ctx.restore()
    },
    [ranges, xField, yField, xKey, yKey, selectedCandidateId, hoveredCandidateId, brushedCandidateIds, colorKey, colorRange, isExpColor, expByCandidate]
  )

  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const w = container.getBoundingClientRect().width
    const h = CHART_HEIGHT
    const dpr = window.devicePixelRatio ?? 1
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    cssDims.current = { w, h }
    pointsRef.current = buildPoints(w, h)
    drawRef.current(pointsRef.current, null)
  }, [buildPoints])

  useEffect(() => { initCanvas() }, [initCanvas])

  useEffect(() => {
    drawRef.current(pointsRef.current, brushBox)
  }, [selectedCandidateId, hoveredCandidateId, brushedCandidateIds, brushBox])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new ResizeObserver(() => initCanvas())
    obs.observe(container)
    return () => obs.disconnect()
  }, [initCanvas])

  useEffect(() => {
    registerCapture('scatter', async () => {
      const canvas = canvasRef.current
      if (!canvas) return null
      return canvas.toDataURL('image/png')
    })
    return () => unregisterCapture('scatter')
  }, [])

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => ({
    x: e.nativeEvent.offsetX,
    y: e.nativeEvent.offsetY,
  })

  const hitTest = (x: number, y: number): string | null => {
    for (const pt of pointsRef.current) {
      const dx = pt.canvasX - x
      const dy = pt.canvasY - y
      if (dx * dx + dy * dy <= (PT_R_SEL + 2) * (PT_R_SEL + 2)) return pt.id
    }
    return null
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e)
      const hit = hitTest(coords.x, coords.y)
      if (hit) { focusCandidate(hit); return }
      brushStartRef.current = coords
      isDraggingRef.current = true
      setBrushBox({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y })
    },
    [focusCandidate]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e)
      if (isDraggingRef.current && brushStartRef.current) {
        setTooltip(null)
        setBrushBox({ x1: brushStartRef.current.x, y1: brushStartRef.current.y, x2: coords.x, y2: coords.y })
        return
      }
      const hit = hitTest(coords.x, coords.y)
      hoverCandidate(hit)
      setTooltip(hit ? { mouseX: e.nativeEvent.offsetX, mouseY: e.nativeEvent.offsetY, candidateId: hit } : null)
    },
    [hoverCandidate]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      const coords = getCanvasCoords(e)
      const box = {
        x1: Math.min(brushStartRef.current!.x, coords.x),
        y1: Math.min(brushStartRef.current!.y, coords.y),
        x2: Math.max(brushStartRef.current!.x, coords.x),
        y2: Math.max(brushStartRef.current!.y, coords.y),
      }
      brushStartRef.current = null
      setBrushBox(null)
      if (Math.abs(box.x2 - box.x1) < 4 && Math.abs(box.y2 - box.y1) < 4) {
        brushCandidates(null)
        return
      }
      const selected = pointsRef.current.filter(
        (pt) => pt.canvasX >= box.x1 && pt.canvasX <= box.x2 && pt.canvasY >= box.y1 && pt.canvasY <= box.y2
      )
      brushCandidates(selected.length > 0 ? selected.map((pt) => pt.id) : null)
    },
    [brushCandidates]
  )

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      handleMouseUp(e)
      hoverCandidate(null)
      setTooltip(null)
    },
    [handleMouseUp, hoverCandidate]
  )

  const brushCount = brushedCandidateIds?.length ?? 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground">X</label>
        <select value={xKey} onChange={(e) => setXKey(e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
          {metricFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {getMetricMeta(xKey)?.description && (
          <span title={getMetricMeta(xKey)!.description} className="text-muted-foreground/50 hover:text-muted-foreground cursor-help text-xs">?</span>
        )}
        <label className="text-xs text-muted-foreground">Y</label>
        <select value={yKey} onChange={(e) => setYKey(e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
          {metricFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {getMetricMeta(yKey)?.description && (
          <span title={getMetricMeta(yKey)!.description} className="text-muted-foreground/50 hover:text-muted-foreground cursor-help text-xs">?</span>
        )}
        <label className="text-xs text-muted-foreground">Color</label>
        <select value={colorKey} onChange={(e) => setColorKey(e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
          <option value="">None</option>
          {metricFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          {expByCandidate.size > 0 && (
            <optgroup label="Experimental">
              {EXP_COLOR_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
          )}
        </select>
        {colorKey && !isExpColor && getMetricMeta(colorKey)?.description && (
          <span title={getMetricMeta(colorKey)!.description} className="text-muted-foreground/50 hover:text-muted-foreground cursor-help text-xs">?</span>
        )}
        <div className="ml-auto">
          <ChartExportButton canvasRef={canvasRef} filename="scatter.png" />
        </div>
      </div>

      <div ref={containerRef} className="relative" style={{ height: CHART_HEIGHT }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        {brushCount > 0 && brushedCandidateIds !== null && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-primary/15 border border-primary/30 text-xs text-primary">
            <span>{brushCount} selected</span>
            <button onClick={() => setBrushedCandidateIds(null)} className="hover:text-primary/70 transition-colors">
              <XIcon size={10} />
            </button>
          </div>
        )}
        {tooltip && (() => {
          const c = candidates.find((ca) => ca.id === tooltip.candidateId)
          if (!c) return null
          const canvasEl = canvasRef.current
          const maxLeft = canvasEl ? canvasEl.offsetWidth - 160 : 9999
          const xVal = getNumericValue(c, xKey)
          const yVal = getNumericValue(c, yKey)
          const colorVal = colorKey ? getNumericValue(c, colorKey) : null
          return (
            <div
              className="absolute z-10 bg-popover border border-border rounded-md p-2 pointer-events-none shadow-md"
              style={{ left: Math.min(tooltip.mouseX + 12, maxLeft), top: Math.max(tooltip.mouseY - 8, 0) }}
            >
              <p className="text-xs font-semibold text-foreground mb-1">{c.name}</p>
              {xVal !== null && (
                <p className="text-xs text-muted-foreground">
                  {xField?.label ?? xKey}: <span className="text-foreground font-mono">{xVal.toFixed(3)}</span>
                </p>
              )}
              {yVal !== null && (
                <p className="text-xs text-muted-foreground">
                  {yField?.label ?? yKey}: <span className="text-foreground font-mono">{yVal.toFixed(3)}</span>
                </p>
              )}
              {colorKey && colorVal !== null && (
                <p className="text-xs text-muted-foreground">
                  {colorField?.label ?? colorKey}: <span className="text-foreground font-mono">{colorVal.toFixed(3)}</span>
                </p>
              )}
            </div>
          )
        })()}
      </div>

      {colorKey === 'exp_binding' && expByCandidate.size > 0 && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground" style={{ paddingLeft: PAD.left }}>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500/78 inline-block shrink-0" />Binder</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500/62 inline-block shrink-0" />Non-binder</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted inline-block shrink-0" />No data</span>
        </div>
      )}
      {colorKey && colorKey !== 'exp_binding' && colorRange && (
        <div className="flex items-center gap-2" style={{ paddingLeft: PAD.left, paddingRight: PAD.right }}>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {colorKey === 'exp_kd' ? `${Math.pow(10, colorRange.min).toFixed(1)} nM` : formatTick(colorRange.min)}
          </span>
          <div
            className="flex-1 h-2 rounded"
            style={{
              background: 'linear-gradient(to right, rgb(59,130,246), rgb(149,100,157), rgb(239,68,68))',
            }}
          />
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {colorKey === 'exp_kd' ? `${Math.pow(10, colorRange.max).toFixed(1)} nM` : formatTick(colorRange.max)}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-1">
            {EXP_COLOR_OPTIONS.find((o) => o.key === colorKey)?.label ?? colorField?.label ?? colorKey}
          </span>
        </div>
      )}
    </div>
  )
}

function DistributionTab({
  candidates,
  metricFields,
  onBrushSelection,
}: {
  candidates: Candidate[]
  metricFields: MetricField[]
  onBrushSelection?: (selectedIds: Set<string>) => void
}) {
  const [metricKey, setMetricKey] = useState<string>(metricFields[0]?.key ?? '')
  const [selectedBins, setSelectedBins] = useState<Set<number>>(new Set())
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const { bins, field } = useMemo(() => {
    const f = metricFields.find((mf) => mf.key === metricKey)
    if (!f || f.min === undefined || f.max === undefined) return { bins: [], field: f }

    const BIN_COUNT = 10
    const range = f.max - f.min || 1
    const binSize = range / BIN_COUNT
    const binsArr = Array.from({ length: BIN_COUNT }, (_, i) => ({
      index: i,
      label: `${(f.min! + i * binSize).toFixed(2)}`,
      count: 0,
      ids: [] as string[],
    }))

    for (const c of candidates) {
      const v = getNumericValue(c, metricKey)
      if (v === null) continue
      const idx = Math.min(Math.floor((v - f.min!) / binSize), BIN_COUNT - 1)
      if (binsArr[idx]) { binsArr[idx].count++; binsArr[idx].ids.push(c.id) }
    }

    return { bins: binsArr, field: f }
  }, [candidates, metricKey, metricFields])

  const selectedCount = useMemo(() => {
    let count = 0
    selectedBins.forEach((idx) => { count += bins[idx]?.ids.length ?? 0 })
    return count
  }, [selectedBins, bins])

  const handleBarClick = useCallback(
    (data: { index: number; ids: string[] }) => {
      const newSelected = new Set(selectedBins)
      if (newSelected.has(data.index)) newSelected.delete(data.index)
      else newSelected.add(data.index)
      setSelectedBins(newSelected)
      if (onBrushSelection) {
        const ids = new Set<string>()
        newSelected.forEach((binIdx) => { bins[binIdx]?.ids.forEach((id) => ids.add(id)) })
        onBrushSelection(ids.size > 0 ? ids : new Set<string>())
      }
    },
    [selectedBins, bins, onBrushSelection]
  )

  const clearSelection = useCallback(() => {
    setSelectedBins(new Set())
    onBrushSelection?.(new Set())
  }, [onBrushSelection])

  useEffect(() => {
    registerCapture('distribution', async () => {
      if (!chartRef.current) return null
      const svgEl = chartRef.current.querySelector('svg')
      if (!svgEl) return null
      return svgElementToPng(svgEl as SVGElement, { background: '#ffffff', scale: 2 })
    })
    return () => unregisterCapture('distribution')
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Metric</label>
        <select
          value={metricKey}
          onChange={(e) => { setMetricKey(e.target.value); setSelectedBins(new Set()); onBrushSelection?.(new Set()) }}
          className="text-xs border rounded px-2 py-1 bg-background"
        >
          {metricFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {selectedBins.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium">{selectedCount} selected</span>
            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">Click bars to select</span>
        )}
        <div className="ml-auto">
          <SvgChartExportButton containerRef={chartRef} filename="distribution.png" />
        </div>
      </div>
      <div ref={chartRef} style={{ height: CHART_HEIGHT }}>
        {field ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bins}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              onMouseMove={(state: MouseHandlerDataParam) => {
                setHoveredIndex(typeof state?.activeIndex === 'number' ? state.activeIndex : null)
              }}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(state: MouseHandlerDataParam) => {
                const idx = typeof state?.activeIndex === 'number' ? state.activeIndex : -1
                if (idx >= 0 && bins[idx]) handleBarClick(bins[idx] as { index: number; ids: string[] })
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                formatter={(value: unknown) => [String(value), 'Count']}
                cursor={false}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} className="cursor-pointer" isAnimationActive={false} activeBar={false}>
                {bins.map((b) => (
                  <Cell
                    key={b.index}
                    fill={
                      selectedBins.has(b.index)
                        ? hoveredIndex === b.index ? 'hsl(var(--primary) / 0.75)' : 'hsl(var(--primary))'
                        : hoveredIndex === b.index ? '#0072B2aa' : '#0072B2'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No data" />
        )}
      </div>
    </div>
  )
}

export function MetricPanel({ candidates, metricFields, experimentalResults, onBrushSelection, className }: MetricPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scatter')

  const numericFields = useMemo(
    () => metricFields.filter((f) => f.type === 'number'),
    [metricFields]
  )

  return (
    <div className={`flex flex-col border rounded-md overflow-hidden bg-background ${className ?? ''}`}>
      <TabBar tabs={ANALYTICS_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="p-4 overflow-auto">
        {numericFields.length === 0 ? (
          <EmptyState message="No numeric metrics available." />
        ) : (
          <>
            {activeTab === 'scatter' && (
              <ScatterTab candidates={candidates} metricFields={numericFields} experimentalResults={experimentalResults} />
            )}
            {activeTab === 'distribution' && (
              <DistributionTab candidates={candidates} metricFields={numericFields} onBrushSelection={onBrushSelection} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
