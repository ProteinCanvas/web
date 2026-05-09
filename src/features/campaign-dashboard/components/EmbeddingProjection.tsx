'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { UMAP } from 'umap-js'
import { Download } from 'lucide-react'
import { Spinner } from '@/shared/components/Spinner'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { useInteraction } from '@/shared/hooks/useInteraction'
import { normalizeMetricValue } from '@/shared/lib/metrics'
import { interpolateColor } from '@/shared/lib/color-utils'
import { EmbeddingComputeButton } from '@/features/embeddings/components/EmbeddingComputeButton'
import { ClusterPanel } from '@/features/embeddings/components/ClusterPanel'
import { kMeans, buildClusterSummaries, computeKDE, convexHull } from '@/features/embeddings/lib/cluster-analysis'
import type { ClusterAssignment, ClusterSummary } from '@/features/embeddings/types'
import type { Candidate, MetricField, ExperimentalResult } from '@/shared/types'
import { EXP_COLOR_OPTIONS } from '../lib/exp-color-options'

interface EmbeddingProjectionProps {
  candidates: Candidate[]
  metricFields: MetricField[]
  experimentalResults?: ExperimentalResult[]
  className?: string
}

interface Point2D {
  x: number
  y: number
  id: string
  colorVal: number | null
}

const POINT_RADIUS = 3
const SELECTED_RADIUS = 7
const VIS_COLORS = ['#0072B2', '#E79F00', '#029F73', '#CB7AA7', '#D45E00', '#57B4E9']

function getRoundColor(roundIndex: number): string {
  return VIS_COLORS[Math.min(roundIndex, VIS_COLORS.length - 1)]
}

function getClusterColor(clusterId: number): string {
  return VIS_COLORS[clusterId % VIS_COLORS.length]
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

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export function EmbeddingProjection({
  candidates,
  metricFields,
  experimentalResults,
  className,
}: EmbeddingProjectionProps) {
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const hoveredCandidateId = useViewerStore((s) => s.hoveredCandidateId)
  const brushedCandidateIds = useViewerStore((s) => s.brushedCandidateIds)
  const { focusCandidate, brushCandidates, hoverCandidate } = useInteraction()

  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  )

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointsRef = useRef<Point2D[]>([])
  const rawPointsRef = useRef<{ x: number; y: number; id: string }[]>([])
  const kdeCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const expByCandidate = useMemo(
    () => new Map((experimentalResults ?? []).map((r) => [r.candidateId, r])),
    [experimentalResults]
  )

  const [isLoading, setIsLoading] = useState(false)
  const [colorKey, setColorKey] = useState<string>('')
  const [colorMode, setColorMode] = useState<'metric' | 'round'>('metric')
  const [showClusters, setShowClusters] = useState(false)
  const [clusterK, setClusterK] = useState(5)
  const [showBindingZone, setShowBindingZone] = useState(false)
  const [umapVersion, setUmapVersion] = useState(0)
  const [assignments, setAssignments] = useState<ClusterAssignment[]>([])
  const [summaries, setSummaries] = useState<ClusterSummary[]>([])
  const [brushBox, setBrushBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; candidateId: string } | null>(null)
  const brushStartRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)

  const numericFields = useMemo(
    () => metricFields.filter((f) => f.type === 'number'),
    [metricFields]
  )

  const hasEmbeddings = useMemo(
    () => candidates.length > 0 && candidates.every((c) => c.embedding && c.embedding.length > 0),
    [candidates]
  )

  const colorField = useMemo(
    () => numericFields.find((f) => f.key === colorKey),
    [numericFields, colorKey]
  )

  const expColorRange = useMemo(() => {
    if (!colorKey.startsWith('exp_') || colorKey === 'exp_binding') return null
    const vals = Array.from(expByCandidate.values()).flatMap((r) => {
      const raw =
        colorKey === 'exp_kd' ? r.kd
        : colorKey === 'exp_expression' ? r.expressionRate
        : r.tm
      if (raw == null || raw <= 0) return []
      return [colorKey === 'exp_kd' ? Math.log10(raw) : raw]
    })
    if (vals.length === 0) return null
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [colorKey, expByCandidate])

  const roundMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!activeCampaign?.rounds) return map
    activeCampaign.rounds.forEach((round, idx) => {
      round.orderedCandidateIds.forEach((id) => {
        if (!map.has(id)) map.set(id, idx)
      })
    })
    return map
  }, [activeCampaign])

  const activeRounds = useMemo(() => activeCampaign?.rounds ?? [], [activeCampaign])

  const draw = useCallback(
    (points: Point2D[], brush: typeof brushBox) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (showBindingZone && kdeCanvasRef.current) {
        ctx.drawImage(kdeCanvasRef.current, 0, 0)
      }

      if (showClusters && assignments.length > 0) {
        const clusterGroups = new Map<number, { x: number; y: number }[]>()
        for (const a of assignments) {
          const group = clusterGroups.get(a.clusterId) ?? []
          group.push({ x: a.umapX, y: a.umapY })
          clusterGroups.set(a.clusterId, group)
        }
        for (const [clusterId, pts] of Array.from(clusterGroups)) {
          const hull = convexHull(pts)
          if (hull.length < 2) continue
          const color = getClusterColor(clusterId)
          const [r, g, b] = hexToRgb(color)
          ctx.beginPath()
          ctx.moveTo(hull[0].x, hull[0].y)
          for (let i = 1; i < hull.length; i++) {
            ctx.lineTo(hull[i].x, hull[i].y)
          }
          ctx.closePath()
          ctx.fillStyle = `rgba(${r},${g},${b},0.07)`
          ctx.fill()
          ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      const brushedSet = brushedCandidateIds ? new Set(brushedCandidateIds) : null
      const hasBrush = brushedSet !== null && brushedSet.size > 0

      for (const pt of points) {
        const isSelected = pt.id === selectedCandidateId
        const isHovered = pt.id === hoveredCandidateId
        const isBrushed = brushedSet?.has(pt.id) ?? false
        const r = isSelected ? SELECTED_RADIUS : isHovered ? POINT_RADIUS + 1 : POINT_RADIUS

        let fill: string
        if (isSelected) {
          fill = 'hsl(217 91% 60%)'
        } else if (hasBrush && !isBrushed) {
          fill =
            colorMode === 'round'
              ? (() => {
                  const ri = roundMap.get(pt.id)
                  const base = ri !== undefined ? getRoundColor(ri) : '#6b7280'
                  return base + '33'
                })()
              : 'hsl(210 40% 60% / 0.2)'
        } else if (colorMode === 'round') {
          const ri = roundMap.get(pt.id)
          fill = ri !== undefined ? getRoundColor(ri) : 'hsl(210 40% 60% / 0.3)'
        } else if (colorKey.startsWith('exp_')) {
          const expResult = expByCandidate.get(pt.id)
          if (!expResult) {
            fill = 'rgba(110,110,110,0.18)'
          } else if (colorKey === 'exp_binding') {
            const bv =
              expResult.bindingSuccess === true ? 1
              : expResult.bindingSuccess === false ? 0
              : null
            fill =
              bv === 1 ? 'rgba(34,197,94,0.78)'
              : bv === 0 ? 'rgba(239,68,68,0.62)'
              : 'rgba(140,140,140,0.35)'
          } else {
            const raw =
              colorKey === 'exp_kd' ? expResult.kd
              : colorKey === 'exp_expression' ? expResult.expressionRate
              : expResult.tm
            if (raw == null || !expColorRange) {
              fill = 'rgba(140,140,140,0.35)'
            } else {
              const val = colorKey === 'exp_kd' ? Math.log10(Math.max(raw, 1e-9)) : raw
              const t = Math.max(
                0,
                Math.min(1, (val - expColorRange.min) / ((expColorRange.max - expColorRange.min) || 1))
              )
              fill = interpolateColor(t)
            }
          }
        } else if (
          colorKey &&
          pt.colorVal !== null &&
          colorField?.min !== undefined &&
          colorField?.max !== undefined
        ) {
          const t = normalizeMetricValue(pt.colorVal, colorField.min, colorField.max)
          fill = interpolateColor(t)
        } else {
          fill = 'hsl(210 40% 60% / 0.5)'
        }

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()

        if (isSelected) {
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 1.5
          ctx.stroke()
        } else if (isHovered) {
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      if (brush) {
        const x = Math.min(brush.x1, brush.x2)
        const y = Math.min(brush.y1, brush.y2)
        const w = Math.abs(brush.x2 - brush.x1)
        const h = Math.abs(brush.y2 - brush.y1)
        ctx.strokeStyle = 'hsl(217 91% 60%)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = 'rgba(96,165,250,0.06)'
        ctx.fillRect(x, y, w, h)
        ctx.setLineDash([])
      }

      if (colorMode === 'round' && activeRounds.length > 0) {
        const legendX = canvas.width - 90
        let legendY = 12
        for (let i = 0; i < activeRounds.length; i++) {
          const color = getRoundColor(i)
          ctx.beginPath()
          ctx.arc(legendX + 6, legendY + 5, 5, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.fillStyle = 'rgba(80,80,80,0.9)'
          ctx.font = '10px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText(
            activeRounds[i].label ?? `Round ${activeRounds[i].roundNumber}`,
            legendX + 16,
            legendY + 9
          )
          legendY += 18
        }
      }
    },
    [
      selectedCandidateId,
      hoveredCandidateId,
      brushedCandidateIds,
      colorKey,
      colorField,
      colorMode,
      roundMap,
      activeRounds,
      expByCandidate,
      expColorRange,
      showClusters,
      assignments,
      showBindingZone,
    ]
  )

  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
  }, [draw])
  const colorKeyRef = useRef(colorKey)
  useEffect(() => {
    colorKeyRef.current = colorKey
  }, [colorKey])

  useEffect(() => {
    draw(pointsRef.current, brushBox)
  }, [
    selectedCandidateId,
    hoveredCandidateId,
    brushedCandidateIds,
    colorKey,
    colorMode,
    brushBox,
    draw,
  ])

  useEffect(() => {
    if (!hasEmbeddings || candidates.length < 5) {
      rawPointsRef.current = []
      pointsRef.current = []
      setAssignments([])
      setSummaries([])
      kdeCanvasRef.current = null
      drawRef.current([], null)
      return
    }

    setIsLoading(true)

    const run = async () => {
      const data = candidates.map((c) => c.embedding!)

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
      const dpr = window.devicePixelRatio ?? 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      const scaled = scalePoints(embedding, canvas.width, canvas.height, 24 * dpr)

      rawPointsRef.current = candidates.map((c, i) => ({ id: c.id, x: scaled[i].x, y: scaled[i].y }))

      const currentColorKey = colorKeyRef.current
      const colorFieldLocal = numericFields.find((f) => f.key === currentColorKey)
      pointsRef.current = rawPointsRef.current.map((p) => {
        const c = candidates.find((ca) => ca.id === p.id)!
        return {
          ...p,
          colorVal:
            currentColorKey && colorFieldLocal
              ? typeof c.metrics[currentColorKey] === 'number'
                ? (c.metrics[currentColorKey] as number)
                : null
              : null,
        }
      })

      drawRef.current(pointsRef.current, null)
      setUmapVersion((v) => v + 1)
      setIsLoading(false)
    }

    run().catch(() => setIsLoading(false))
  }, [candidates, hasEmbeddings])

  useEffect(() => {
    if (!showClusters || rawPointsRef.current.length < clusterK) {
      setAssignments([])
      setSummaries([])
      return
    }
    const pts = rawPointsRef.current
    const newAssignments = kMeans(pts, clusterK)
    const newSummaries = buildClusterSummaries(newAssignments, candidates, experimentalResults)
    setAssignments(newAssignments)
    setSummaries(newSummaries)
    drawRef.current(pointsRef.current, null)
  }, [umapVersion, showClusters, clusterK, candidates, experimentalResults])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !showBindingZone || expByCandidate.size === 0 || rawPointsRef.current.length === 0) {
      kdeCanvasRef.current = null
      drawRef.current(pointsRef.current, null)
      return
    }
    const binderPoints = rawPointsRef.current
      .map((p) => {
        const exp = expByCandidate.get(p.id)
        return {
          x: p.x,
          y: p.y,
          weight: exp?.bindingSuccess === true ? 1 : exp?.bindingSuccess === false ? 0.1 : 0,
        }
      })
      .filter((p) => p.weight > 0)
    const dpr = window.devicePixelRatio ?? 1
    const grid = computeKDE(binderPoints, canvas.width, canvas.height, 30 * dpr)
    const offscreen = document.createElement('canvas')
    offscreen.width = canvas.width
    offscreen.height = canvas.height
    const offCtx = offscreen.getContext('2d')
    if (offCtx) {
      const imageData = offCtx.createImageData(canvas.width, canvas.height)
      for (let i = 0; i < grid.length; i++) {
        const alpha = Math.round(grid[i] * 180)
        imageData.data[i * 4 + 0] = 34
        imageData.data[i * 4 + 1] = 197
        imageData.data[i * 4 + 2] = 94
        imageData.data[i * 4 + 3] = alpha
      }
      offCtx.putImageData(imageData, 0, 0)
      kdeCanvasRef.current = offscreen
    }
    drawRef.current(pointsRef.current, null)
  }, [umapVersion, showBindingZone, expByCandidate])

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
            ? typeof c.metrics[colorKey] === 'number'
              ? (c.metrics[colorKey] as number)
              : null
            : null,
      }
    })
    draw(pointsRef.current, brushBox)
  }, [colorKey, numericFields, candidates, draw, brushBox])

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e)
      const hit = hitTest(coords.x, coords.y)
      if (hit) {
        focusCandidate(hit)
        return
      }
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
        setBrushBox({
          x1: brushStartRef.current.x,
          y1: brushStartRef.current.y,
          x2: coords.x,
          y2: coords.y,
        })
        return
      }
      const hit = hitTest(coords.x, coords.y)
      hoverCandidate(hit)
      setTooltip(hit ? { x: coords.x, y: coords.y, candidateId: hit } : null)
    },
    [hoverCandidate]
  )

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

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      handleMouseUp(e)
      hoverCandidate(null)
      setTooltip(null)
    },
    [handleMouseUp, hoverCandidate]
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
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-wrap">
        <span className="text-xs font-medium">UMAP Projection</span>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center rounded border border-border overflow-hidden text-xs">
            <button
              onClick={() => setColorMode('metric')}
              className={`px-2 py-1 transition-colors ${
                colorMode === 'metric'
                  ? 'bg-primary/10 text-foreground border-r border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-r border-border'
              }`}
              title="Color points by a metric value"
            >
              Metric
            </button>
            <button
              onClick={() => setColorMode('round')}
              className={`px-2 py-1 transition-colors ${
                colorMode === 'round'
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Color points by design round"
            >
              Round
            </button>
          </div>

          {colorMode === 'metric' && (
            <select
              value={colorKey}
              onChange={(e) => setColorKey(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-muted-foreground"
            >
              <option value="">None</option>
              {numericFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
              {expByCandidate.size > 0 && (
                <optgroup label="Experimental">
                  {EXP_COLOR_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}

          <button
            onClick={() => setShowClusters((v) => !v)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              showClusters
                ? 'border-primary text-foreground bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Clusters
          </button>

          {showClusters && (
            <select
              value={clusterK}
              onChange={(e) => setClusterK(Number(e.target.value))}
              className="text-xs border rounded px-2 py-1 bg-background"
            >
              {[3, 5, 8, 10, 15].map((k) => (
                <option key={k} value={k}>
                  k={k}
                </option>
              ))}
            </select>
          )}

          {expByCandidate.size > 0 && (
            <button
              onClick={() => setShowBindingZone((v) => !v)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                showBindingZone
                  ? 'border-primary text-foreground bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Overlay binding probability density from experimental hits"
            >
              Binding zones
            </button>
          )}

          {activeCampaignId && (
            <EmbeddingComputeButton campaignId={activeCampaignId} candidates={candidates} />
          )}

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

      <div ref={containerRef} className="relative flex-1" style={{ minHeight: '280px' }}>
        {!hasEmbeddings && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs text-muted-foreground italic text-center">
              Compute ESM-2 embeddings to enable sequence-space projection.
            </p>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-10">
            <div className="flex flex-col items-center gap-2">
              <Spinner size="md" className="border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground">Running UMAP…</span>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        {tooltip &&
          (() => {
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
                      {f.label}:{' '}
                      <span className="text-foreground font-mono">{v.toFixed(3)}</span>
                    </p>
                  )
                })}
              </div>
            )
          })()}
      </div>

      {showClusters && summaries.length > 0 && (
        <ClusterPanel
          clusters={summaries}
          candidates={candidates}
          metricFields={metricFields}
          experimentalResults={experimentalResults}
        />
      )}
    </div>
  )
}
