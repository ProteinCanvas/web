'use client'

import { useState, useMemo } from 'react'
import { useViewerStore } from '@/shared/store/viewerStore'
import type { Candidate, MetricField } from '@/shared/types'
import { getMetricMeta } from '@/shared/lib/metric-registry'

interface FunnelStage {
  label: string
  metricKey: string
  threshold: number
  direction: 'gt' | 'lt'
  defaultThreshold: number
}

const DEFAULT_STAGES: FunnelStage[] = [
  { label: 'pLDDT', metricKey: 'plddt', threshold: 0.8, defaultThreshold: 0.8, direction: 'gt' },
  { label: 'ipTM', metricKey: 'iptm', threshold: 0.5, defaultThreshold: 0.5, direction: 'gt' },
  { label: 'iPAE', metricKey: 'pae_interaction', threshold: 10, defaultThreshold: 10, direction: 'lt' },
  { label: 'scRMSD', metricKey: 'scrmsd', threshold: 2.0, defaultThreshold: 2.0, direction: 'lt' },
  { label: 'scTM', metricKey: 'sctm', threshold: 0.5, defaultThreshold: 0.5, direction: 'gt' },
  { label: 'Confidence', metricKey: 'confidence_score', threshold: 0.5, defaultThreshold: 0.5, direction: 'gt' },
  { label: 'Shape Comp.', metricKey: 'shape_complementarity', threshold: 0.6, defaultThreshold: 0.6, direction: 'gt' },
]

const PRESETS: { label: string; overrides: Record<string, number> }[] = [
  { label: 'Standard', overrides: { plddt: 0.8, iptm: 0.5, pae_interaction: 10 } },
  { label: 'Strict', overrides: { plddt: 0.85, iptm: 0.6, pae_interaction: 8, scrmsd: 1.5 } },
  { label: 'BindCraft', overrides: { plddt: 0.8, iptm: 0.5, shape_complementarity: 0.6 } },
]

interface DesignFunnelProps {
  candidates: Candidate[]
  metricFields: MetricField[]
}

function detectScale(candidates: Candidate[], key: string): 'normalized' | 'percent' {
  const vals = candidates.map((c) => c.metrics[key]).filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return 'normalized'
  return vals.some((v) => v > 2) ? 'percent' : 'normalized'
}

function candidatePasses(candidate: Candidate, stage: FunnelStage, scale: 'normalized' | 'percent'): boolean {
  const val = candidate.metrics[stage.metricKey]
  if (typeof val !== 'number') return false
  const threshold = scale === 'percent' && stage.metricKey === 'plddt'
    ? stage.threshold * 100
    : stage.threshold
  return stage.direction === 'gt' ? val >= threshold : val <= threshold
}

function FunnelRow({
  stage,
  passingCount,
  totalCount,
  parentCount,
  threshold,
  field,
  scale,
  onThresholdChange,
  isFirst,
  isBottleneck,
}: {
  stage: FunnelStage
  passingCount: number
  totalCount: number
  parentCount?: number
  threshold: number
  field?: MetricField
  scale: 'normalized' | 'percent'
  onThresholdChange: (v: number) => void
  isFirst?: boolean
  isBottleneck?: boolean
}) {
  const fraction = totalCount > 0 ? passingCount / totalCount : 0
  const dropFraction = parentCount !== undefined && parentCount > 0
    ? (parentCount - passingCount) / parentCount
    : 0

  const fieldMin = field?.min ?? 0
  const fieldMax = field?.max ?? 1
  const step = (fieldMax - fieldMin) / 200

  const displayThreshold = scale === 'percent' && stage.metricKey === 'plddt'
    ? threshold * 100
    : threshold
  const unit = getMetricMeta(stage.metricKey)?.unit ?? ''

  const dirLabel = stage.direction === 'gt' ? '≥' : '≤'

  return (
    <div className={`rounded-lg border px-4 py-3 transition-colors ${isBottleneck ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card/30'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1.5 w-36 shrink-0">
          <span className="text-xs font-medium text-foreground">{stage.label}</span>
          <span className="text-xs text-muted-foreground">{dirLabel}</span>
          <span className="text-xs font-mono text-foreground">{Number.isInteger(displayThreshold) ? displayThreshold : displayThreshold.toFixed(2)}{unit}</span>
          {isBottleneck && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium ml-1">bottleneck</span>
          )}
        </div>

        <div className="flex-1 h-4 bg-muted/40 rounded overflow-hidden">
          <div
            className="h-full rounded transition-all duration-200 bg-primary/70"
            style={{ width: `${Math.max(fraction * 100, 0)}%` }}
          />
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
          <span className="text-foreground font-medium w-10 text-right">{passingCount}</span>
          <span className="text-muted-foreground w-8 text-right">{Math.round(fraction * 100)}%</span>
          <span className={`w-10 text-right ${dropFraction > 0.3 ? 'text-amber-400' : dropFraction > 0.1 ? 'text-muted-foreground/70' : 'text-muted-foreground/30'}`}>
            {parentCount !== undefined && dropFraction > 0.005 ? `−${Math.round(dropFraction * 100)}%` : ''}
          </span>
        </div>
      </div>

      {!isFirst && (
        <div className="flex items-center gap-3">
          <div className="w-36 shrink-0" />
          <input
            type="range"
            min={fieldMin}
            max={fieldMax}
            step={step}
            value={threshold}
            onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-primary cursor-pointer"
          />
          <div className="w-28 shrink-0" />
        </div>
      )}
    </div>
  )
}

export function DesignFunnel({ candidates, metricFields }: DesignFunnelProps) {
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)

  const activeStages = useMemo(() => {
    const availableMetricKeys = new Set(metricFields.filter((f) => f.type === 'number').map((f) => f.key))
    const seen = new Set<string>()
    return DEFAULT_STAGES.filter((stage) => {
      if (!availableMetricKeys.has(stage.metricKey)) return false
      if (seen.has(stage.metricKey)) return false
      seen.add(stage.metricKey)
      return true
    })
  }, [metricFields])

  const [thresholds, setThresholds] = useState<Record<string, number>>(() =>
    Object.fromEntries(activeStages.map((s) => [s.metricKey, s.defaultThreshold]))
  )

  const scaleByKey = useMemo(() => {
    const result: Record<string, 'normalized' | 'percent'> = {}
    for (const stage of activeStages) {
      result[stage.metricKey] = detectScale(candidates, stage.metricKey)
    }
    return result
  }, [candidates, activeStages])

  const stagesWithData = useMemo(() => {
    let remaining = candidates
    return activeStages.map((stage) => {
      const threshold = thresholds[stage.metricKey] ?? stage.defaultThreshold
      const stageWithThreshold = { ...stage, threshold }
      const scale = scaleByKey[stage.metricKey]
      const passing = remaining.filter((c) => candidatePasses(c, stageWithThreshold, scale))
      const entry = {
        stage,
        count: remaining.length,
        passingCount: passing.length,
        passingIds: passing.map((c) => c.id),
      }
      remaining = passing
      return entry
    })
  }, [candidates, activeStages, thresholds, scaleByKey])

  const bottleneckIdx = useMemo(() => {
    let maxDrop = 0
    let idx = -1
    stagesWithData.forEach((s, i) => {
      const drop = s.count > 0 ? (s.count - s.passingCount) / s.count : 0
      if (drop > maxDrop) { maxDrop = drop; idx = i }
    })
    return idx
  }, [stagesWithData])

  const finalEntry = stagesWithData[stagesWithData.length - 1]
  const finalCount = finalEntry?.passingCount ?? 0
  const finalIds = finalEntry?.passingIds ?? []

  const applyPreset = (overrides: Record<string, number>) =>
    setThresholds((prev) => ({ ...prev, ...overrides }))

  const resetThresholds = () =>
    setThresholds(Object.fromEntries(activeStages.map((s) => [s.metricKey, s.defaultThreshold])))

  if (activeStages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm gap-2">
        <p>No filterable metrics found in this campaign.</p>
        <p className="text-xs text-muted-foreground/60">Import a campaign with pLDDT, ipTM, scRMSD, or similar metrics.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Design Funnel</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag sliders to tune quality thresholds and find the right number of candidates to take forward.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.overrides)}
              className="px-2.5 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={resetThresholds}
            className="px-2.5 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
        <div className="w-36 shrink-0">Stage</div>
        <div className="flex-1">Pass rate</div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="w-10 text-right">Count</span>
          <span className="w-8 text-right">% total</span>
          <span className="w-10 text-right">Drop</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="rounded-lg border border-border bg-card/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-36 shrink-0 text-xs font-medium text-muted-foreground">All imported</div>
            <div className="flex-1 h-4 bg-muted/40 rounded overflow-hidden">
              <div className="h-full rounded bg-primary/40 w-full" />
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
              <span className="text-foreground font-medium w-10 text-right">{candidates.length}</span>
              <span className="text-muted-foreground w-8 text-right">100%</span>
              <span className="w-10" />
            </div>
          </div>
        </div>

        {stagesWithData.map(({ stage, count, passingCount, passingIds }, idx) => {
          const field = metricFields.find((f) => f.key === stage.metricKey)
          return (
            <FunnelRow
              key={stage.metricKey}
              stage={stage}
              passingCount={passingCount}
              totalCount={candidates.length}
              parentCount={count}
              threshold={thresholds[stage.metricKey] ?? stage.defaultThreshold}
              field={field}
              scale={scaleByKey[stage.metricKey]}
              onThresholdChange={(v) => setThresholds((prev) => ({ ...prev, [stage.metricKey]: v }))}
              isBottleneck={idx === bottleneckIdx && (count - passingCount) / Math.max(count, 1) > 0.1}
            />
          )
        })}
      </div>

      <div className="rounded-lg border border-border bg-card/50 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Passing all filters</p>
            <p className="text-3xl font-bold text-foreground tabular-nums">{finalCount}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Pass rate</p>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {candidates.length > 0 ? Math.round((finalCount / candidates.length) * 100) : 0}%
            </p>
          </div>
        </div>
        <button
          disabled={finalCount === 0}
          onClick={() => setBrushedCandidateIds(finalIds.length > 0 ? finalIds : null)}
          className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Select {finalCount} candidates
        </button>
      </div>
    </div>
  )
}
