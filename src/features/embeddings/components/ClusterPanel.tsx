'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { SequenceLogo } from '@/features/sequence-panel'
import { interpolateColor } from '@/shared/lib/color-utils'
import { normalizeMetricValue } from '@/shared/lib/metrics'
import { getMetricMeta } from '@/shared/lib/metric-registry'
import type { ClusterSummary } from '../types'
import type { Candidate, MetricField, ExperimentalResult } from '@/shared/types'

interface ClusterPanelProps {
  clusters: ClusterSummary[]
  candidates: ReadonlyArray<Candidate>
  metricFields: MetricField[]
  experimentalResults?: ExperimentalResult[]
  className?: string
}

const CLUSTER_COLORS = ['#0072B2', '#E79F00', '#029F73', '#CB7AA7', '#D45E00', '#57B4E9']

function clusterColor(clusterId: number): string {
  return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length]
}

function hitRateColor(rate: number): string {
  if (rate >= 0.5) return 'text-green-600 dark:text-green-400'
  if (rate >= 0.25) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

interface MiniDistributionProps {
  values: number[]
  globalValues: number[]
  min: number
  max: number
  goodThreshold?: number
  direction?: 'higher' | 'lower' | 'neutral'
  label: string
}

function MiniDistribution({ values, globalValues, min, max, goodThreshold, direction, label }: MiniDistributionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const BINS = 20
    const range = max - min || 1

    function toBin(v: number) {
      return Math.min(BINS - 1, Math.floor(((v - min) / range) * BINS))
    }

    const globalBins = new Float32Array(BINS)
    for (const v of globalValues) globalBins[toBin(v)]++
    const globalMax = Math.max(...Array.from(globalBins), 1)

    const clusterBins = new Float32Array(BINS)
    for (const v of values) clusterBins[toBin(v)]++
    const clusterMax = Math.max(...Array.from(clusterBins), 1)

    ctx.clearRect(0, 0, W, H)

    const barW = W / BINS
    for (let b = 0; b < BINS; b++) {
      const gH = (globalBins[b] / globalMax) * (H - 2)
      ctx.fillStyle = 'rgba(100,116,139,0.25)'
      ctx.fillRect(b * barW, H - gH, barW - 1, gH)

      const cH = (clusterBins[b] / clusterMax) * (H - 2)
      const t = b / (BINS - 1)
      ctx.fillStyle = interpolateColor(t) + 'cc'
      ctx.fillRect(b * barW, H - cH, barW - 1, cH)
    }

    if (goodThreshold !== undefined && goodThreshold >= min && goodThreshold <= max) {
      const x = ((goodThreshold - min) / range) * W
      ctx.strokeStyle = direction === 'higher' ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [values, globalValues, min, max, goodThreshold, direction])

  const mean = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null
  const t = mean !== null ? normalizeMetricValue(mean, min, max) : null
  const meanColor = t !== null ? interpolateColor(t) : undefined

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{label}</span>
        {mean !== null && (
          <span className="text-xs font-mono font-medium" style={{ color: meanColor }}>
            {mean.toFixed(2)}
          </span>
        )}
      </div>
      <canvas ref={canvasRef} width={120} height={28} className="w-full rounded-sm" />
    </div>
  )
}

export function ClusterPanel({
  clusters,
  candidates,
  metricFields,
  experimentalResults,
  className,
}: ClusterPanelProps) {
  const [selectedClusterId, setSelectedClusterId] = useState<number>(clusters[0]?.clusterId ?? 0)

  useEffect(() => {
    setSelectedClusterId(clusters[0]?.clusterId ?? 0)
  }, [clusters])

  const selected = useMemo(
    () => clusters.find((c) => c.clusterId === selectedClusterId) ?? clusters[0],
    [clusters, selectedClusterId]
  )

  const candidateMap = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates]
  )

  const expMap = useMemo(
    () => new Map((experimentalResults ?? []).map((r) => [r.candidateId, r])),
    [experimentalResults]
  )

  const topMetrics = useMemo(
    () => metricFields.filter((f) => f.type === 'number').slice(0, 4),
    [metricFields]
  )

  const globalMetricValues = useMemo(() => {
    const result: Record<string, number[]> = {}
    for (const f of topMetrics) {
      result[f.key] = candidates
        .map((c) => c.metrics[f.key])
        .filter((v): v is number => typeof v === 'number')
    }
    return result
  }, [topMetrics, candidates])

  const clusterMetricValues = useMemo(() => {
    if (!selected) return {}
    const result: Record<string, number[]> = {}
    const clusterCandidates = selected.candidateIds
      .map((id) => candidateMap.get(id))
      .filter((c): c is Candidate => c !== undefined)
    for (const f of topMetrics) {
      result[f.key] = clusterCandidates
        .map((c) => c.metrics[f.key])
        .filter((v): v is number => typeof v === 'number')
    }
    return result
  }, [selected, topMetrics, candidateMap])

  const bindingContext = useMemo(() => {
    if (!selected || expMap.size === 0) return null
    const clusterCandidates = selected.candidateIds
      .map((id) => candidateMap.get(id))
      .filter((c): c is Candidate => c !== undefined)
    const tested = clusterCandidates.filter((c) => expMap.get(c.id)?.bindingSuccess !== undefined)
    const hits = tested.filter((c) => expMap.get(c.id)?.bindingSuccess === true)
    if (tested.length === 0) return null
    return { hits: hits.length, tested: tested.length, rate: hits.length / tested.length }
  }, [selected, expMap, candidateMap])

  const logoSequences = useMemo(
    () => selected?.sequences.slice(0, 200) ?? [],
    [selected]
  )

  if (clusters.length === 0 || !selected) return null

  return (
    <div className={`border-t bg-background ${className ?? ''}`}>
      <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Clusters</span>
        <div className="flex items-center gap-1 flex-wrap">
          {clusters.map((cl) => (
            <button
              key={cl.clusterId}
              onClick={() => setSelectedClusterId(cl.clusterId)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                cl.clusterId === selectedClusterId
                  ? 'border-transparent text-white'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              style={
                cl.clusterId === selectedClusterId
                  ? { backgroundColor: clusterColor(cl.clusterId) }
                  : { borderColor: clusterColor(cl.clusterId) }
              }
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: clusterColor(cl.clusterId) }}
              />
              {cl.candidateIds.length}
              {cl.bindingHitRate !== null && (
                <span
                  className={`font-mono ${hitRateColor(cl.bindingHitRate)} ${
                    cl.clusterId === selectedClusterId ? 'text-white opacity-90' : ''
                  }`}
                >
                  {Math.round(cl.bindingHitRate * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 grid grid-cols-[1fr_auto] gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: clusterColor(selected.clusterId) }}
            />
            <span className="text-xs font-medium">
              Cluster {selected.clusterId + 1}
            </span>
            <span className="text-xs text-muted-foreground">
              {selected.candidateIds.length} candidates
            </span>
            {bindingContext !== null && (
              <span className={`text-xs font-medium ${hitRateColor(bindingContext.rate)}`}>
                {bindingContext.hits}/{bindingContext.tested} hits ({Math.round(bindingContext.rate * 100)}%)
              </span>
            )}
          </div>

          {logoSequences.length > 0 && (
            <div className="overflow-x-auto">
              <SequenceLogo sequences={logoSequences} />
            </div>
          )}
        </div>

        {topMetrics.length > 0 && (
          <div className="flex flex-col gap-2 w-32 shrink-0">
            {topMetrics.map((f) => {
              const meta = getMetricMeta(f.key)
              return (
                <MiniDistribution
                  key={f.key}
                  values={clusterMetricValues[f.key] ?? []}
                  globalValues={globalMetricValues[f.key] ?? []}
                  min={f.min ?? 0}
                  max={f.max ?? 1}
                  goodThreshold={meta?.goodThreshold}
                  direction={meta?.direction}
                  label={f.label}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
