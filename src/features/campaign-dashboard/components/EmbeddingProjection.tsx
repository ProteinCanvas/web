'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { UMAP } from 'umap-js'
import { Download } from 'lucide-react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useInteraction } from '@/shared/hooks/useInteraction'
import { normalizeMetricValue } from '@/shared/lib/metrics'
import type { Candidate, MetricField } from '@/shared/types'

interface EmbeddingProjectionProps {
  candidates: Candidate[]
  metricFields: MetricField[]
  className?: string
}

interface Point2D {
  x: number
  y: number
  id: string
  colorVal: number | null
}

const POINT_RADIUS = 4
const SELECTED_RADIUS = 7

function interpolateColor(t: number): string {
  const r = Math.round(59 + (239 - 59) * t)
  const g = Math.round(130 + (68 - 130) * t)
  const b = Math.round(246 + (68 - 246) * t)
  return `rgb(${r},${g},${b})`
}

function scalePoints(
  raw: number[][],
  width: number,
  height: number,
  padding: number
): { x: number; y: number }[] {
  if (raw.length === 0) return []
  const xs = raw.map((p) => p[0])
  const ys = raw.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const usableW = width - padding * 2
  const usableH = height - padding * 2
  return raw.map((p) => ({
    x: padding + ((p[0] - minX) / rangeX) * usableW,
    y: padding + ((p[1] - minY) / rangeY) * usableH,
  }))
}

export function EmbeddingProjection({
  candidates,
  metricFields,
  className,
}: EmbeddingProjectionProps) {
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const { focusCandidate, brushCandidates } = useInteraction()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointsRef = useRef<Point2D[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [colorKey, setColorKey] = useState<string>('')
  const [brushBox, setBrushBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; candidateId: string } | null>(null)
  const brushStartRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)

  const numericFields = useMemo(
    () => metricFields.filter((f) => f.type === 'number'),
    [metricFields]
  )

  const colorField = useMemo(
    () => numericFields.find((f) => f.key === colorKey),
    [numericFields, colorKey]
  )

  const draw = useCallback(
    (points: Point2D[], brush: typeof brushBox) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const pt of points) {
        const isSelected = pt.id === selectedCandidateId
        const r = isSelected ? SELECTED_RADIUS : POINT_RADIUS

        let fill = 'hsl(210 40% 60% / 0.5)'
        if (isSelected) {
          fill = 'hsl(var(--primary, 217 91% 60%))'
        } else if (colorKey && pt.colorVal !== null && colorField?.min !== undefined && colorField?.max !== undefined) {
          const t = normalizeMetricValue(pt.colorVal, colorField.min, colorField.max)
          fill = interpolateColor(t)
        }

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()
        if (isSelected) {
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      if (brush) {
        const x = Math.min(brush.x1, brush.x2)
        const y = Math.min(brush.y1, brush.y2)
        const w = Math.abs(brush.x2 - brush.x1)
        const h = Math.abs(brush.y2 - brush.y1)
        ctx.strokeStyle = 'hsl(var(--primary, 217 91% 60%))'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = 'hsl(var(--primary, 217 91% 60%) / 0.08)'
        ctx.fillRect(x, y, w, h)
        ctx.setLineDash([])
      }
    },
    [selectedCandidateId, colorKey, colorField]
  )

  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])
  const colorKeyRef = useRef(colorKey)
  useEffect(() => { colorKeyRef.current = colorKey }, [colorKey])

  useEffect(() => {
    draw(pointsRef.current, brushBox)
  }, [selectedCandidateId, colorKey, brushBox, draw])

  useEffect(() => {
    if (candidates.length < 5) {
      pointsRef.current = []
      drawRef.current([], null)
      return
    }

    setIsLoading(true)

    const run = async () => {
      const hasEmbeddings = candidates.every((c) => c.embedding && c.embedding.length > 0)
      let data: number[][]

      if (hasEmbeddings) {
        data = candidates.map((c) => c.embedding!)
      } else {
        data = candidates.map((c) =>
          numericFields.map((f) => {
            const v = c.metrics[f.key]
            if (typeof v !== 'number') return 0
            const min = f.min ?? 0
            const max = f.max ?? 1
            return normalizeMetricValue(v, min, max)
          })
        )
      }

      const nNeighbors = Math.min(15, Math.max(2, Math.floor(candidates.length / 3)))
      const umap = new UMAP({ nNeighbors, minDist: 0.1, nComponents: 2 })
      const embedding = await umap.fitAsync(data)

      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) {
        setIsLoading(false)
        return
      }

      const { width, height } = container.getBoundingClientRect()
      canvas.width = width
      canvas.height = height

      const scaled = scalePoints(embedding, width, height, 24)

      const currentColorKey = colorKeyRef.current
      const colorFieldLocal = numericFields.find((f) => f.key === currentColorKey)
      pointsRef.current = candidates.map((c, i) => ({
        id: c.id,
        x: scaled[i].x,
        y: scaled[i].y,
        colorVal:
          currentColorKey && colorFieldLocal
            ? (typeof c.metrics[currentColorKey] === 'number' ? (c.metrics[currentColorKey] as number) : null)
            : null,
      }))

      drawRef.current(pointsRef.current, null)
      setIsLoading(false)
    }

    run().catch(() => setIsLoading(false))
  }, [candidates, numericFields])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pointsRef.current.length === 0) return

    const colorFieldLocal = numericFields.find((f) => f.key === colorKey)
    pointsRef.current = pointsRef.current.map((pt) => {
      const c = candidates.find((ca) => ca.id === pt.id)
      if (!c) return pt
      return {
        ...pt,
        colorVal:
          colorKey && colorFieldLocal
            ? (typeof c.metrics[colorKey] === 'number' ? (c.metrics[colorKey] as number) : null)
            : null,
      }
    })
    draw(pointsRef.current, brushBox)
  }, [colorKey, numericFields, candidates, draw, brushBox])

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const hitTest = (x: number, y: number): string | null => {
    for (const pt of pointsRef.current) {
      const dx = pt.x - x
      const dy = pt.y - y
      if (Math.sqrt(dx * dx + dy * dy) <= SELECTED_RADIUS + 2) {
        return pt.id
      }
    }
    return null
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e)
    const hit = hitTest(coords.x, coords.y)
    if (hit) {
      focusCandidate(hit)
      return
    }
    brushStartRef.current = coords
    isDraggingRef.current = true
    setBrushBox({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y })
  }, [focusCandidate])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e)
    if (isDraggingRef.current && brushStartRef.current) {
      setTooltip(null)
      setBrushBox({
        x1: brushStartRef.current.x,
        y1: brushStartRef.current.y,
        x2: coords.x,
        y2: coords.y,
      })
      return
    }
    const hit = hitTest(coords.x, coords.y)
    setTooltip(hit ? { x: coords.x, y: coords.y, candidateId: hit } : null)
  }, [])

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'umap.png'
    a.click()
  }, [])

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
        (pt) => pt.x >= box.x1 && pt.x <= box.x2 && pt.y >= box.y1 && pt.y <= box.y2
      )
      brushCandidates(selected.length > 0 ? selected.map((pt) => pt.id) : null)
    },
    [brushCandidates]
  )

  if (candidates.length < 5) {
    return (
      <div
        className={`flex items-center justify-center border rounded-md bg-muted/20 ${className ?? ''}`}
        style={{ minHeight: '240px' }}
      >
        <p className="text-xs text-muted-foreground italic">
          At least 5 candidates required for projection.
        </p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col border rounded-md overflow-hidden bg-background ${className ?? ''}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <span className="text-xs font-medium">UMAP Projection</span>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-muted-foreground">Color by</label>
          <select
            value={colorKey}
            onChange={(e) => setColorKey(e.target.value)}
            className="text-xs border rounded px-2 py-1 bg-background"
          >
            <option value="">None</option>
            {numericFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={isLoading || pointsRef.current.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors"
            title="Export as PNG"
          >
            <Download size={11} />
            PNG
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1"
        style={{ minHeight: '280px' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Running UMAP...</span>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => { handleMouseUp(e); setTooltip(null) }}
        />
        {tooltip && (() => {
          const c = candidates.find((ca) => ca.id === tooltip.candidateId)
          if (!c) return null
          const topMetrics = numericFields.slice(0, 4)
          return (
            <div
              className="absolute z-10 bg-popover border border-border rounded-md p-2 pointer-events-none shadow-md"
              style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
            >
              <p className="text-xs font-semibold text-foreground mb-1">{c.name}</p>
              {topMetrics.map((f) => {
                const v = c.metrics[f.key]
                if (typeof v !== 'number') return null
                return (
                  <p key={f.key} className="text-xs text-muted-foreground">
                    {f.label}: <span className="text-foreground font-mono">{v.toFixed(3)}</span>
                  </p>
                )
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
