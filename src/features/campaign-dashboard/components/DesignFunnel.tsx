'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { useViewerStore } from '@/shared/store/viewerStore'
import type { Candidate, MetricField } from '@/shared/types'
import { getMetricMeta, getMetricGoodThreshold } from '@/shared/lib/metric-registry'

function ThresholdMarker({
  value,
  min,
  max,
  label,
  direction,
}: {
  value: number
  min: number
  max: number
  label: string
  direction: 'higher' | 'lower' | 'neutral'
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  const color =
    direction === 'higher'
      ? 'text-green-400'
      : direction === 'lower'
        ? 'text-blue-400'
        : 'text-muted-foreground'
  return (
    <div className="relative h-3 mt-0.5 pointer-events-none" style={{ marginLeft: 24 }}>
      <div
        className={`absolute flex flex-col items-center ${color}`}
        style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
      >
        <div className="w-px h-2 bg-current opacity-60" />
        <span className="text-[9px] whitespace-nowrap opacity-70">{label}</span>
      </div>
    </div>
  )
}

function FilterRow({
  field,
  candidates,
}: {
  field: MetricField
  candidates: Candidate[]
}) {
  const metricFilters = useCampaignStore((s) => s.filters.metricFilters)
  const setMetricFilter = useCampaignStore((s) => s.setMetricFilter)

  const globalMin = field.min ?? 0
  const globalMax = field.max ?? 1
  const current = metricFilters[field.key]
  const currentMin = current?.min ?? globalMin
  const currentMax = current?.max ?? globalMax

  const meta = getMetricMeta(field.key)
  const sampleVal = candidates[0]?.metrics[field.key]
  const threshold = getMetricGoodThreshold(field.key, typeof sampleVal === 'number' ? sampleVal : undefined)
  const hasThreshold = threshold !== undefined && threshold >= globalMin && threshold <= globalMax

  const passingCount = useMemo(
    () =>
      candidates.filter((c) => {
        const val = c.metrics[field.key]
        return typeof val === 'number' && val >= currentMin && val <= currentMax
      }).length,
    [candidates, field.key, currentMin, currentMax],
  )

  return (
    <div className="rounded-lg border border-border bg-card/30 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">{field.label}</span>
          {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            <span className="font-mono">{currentMin.toFixed(2)}</span>
            <span className="mx-1">—</span>
            <span className="font-mono">{currentMax.toFixed(2)}</span>
          </span>
          <span className="text-xs text-muted-foreground/60 tabular-nums">
            {passingCount} / {candidates.length}
          </span>
          <button
            onClick={() => setMetricFilter(field.key, null)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground w-6">Min</label>
          <input
            type="range"
            min={globalMin}
            max={globalMax}
            step={(globalMax - globalMin) / 100}
            value={currentMin}
            onChange={(e) =>
              setMetricFilter(field.key, { min: parseFloat(e.target.value), max: currentMax })
            }
            className="flex-1 h-1 accent-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground w-6">Max</label>
          <input
            type="range"
            min={globalMin}
            max={globalMax}
            step={(globalMax - globalMin) / 100}
            value={currentMax}
            onChange={(e) =>
              setMetricFilter(field.key, { min: currentMin, max: parseFloat(e.target.value) })
            }
            className="flex-1 h-1 accent-primary"
          />
        </div>
      </div>
      {hasThreshold && meta && (
        <ThresholdMarker
          value={threshold!}
          min={globalMin}
          max={globalMax}
          label={`${meta.direction === 'higher' ? '≥' : '≤'}${threshold} (recommended)`}
          direction={meta.direction}
        />
      )}
    </div>
  )
}

interface DesignFunnelProps {
  candidates: Candidate[]
  metricFields: MetricField[]
}

export function DesignFunnel({ candidates, metricFields }: DesignFunnelProps) {
  const metricFilters = useCampaignStore((s) => s.filters.metricFilters)
  const setMetricFilter = useCampaignStore((s) => s.setMetricFilter)
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const numericFields = useMemo(() => metricFields.filter((f) => f.type === 'number'), [metricFields])

  const activeFields = useMemo(
    () => numericFields.filter((f) => metricFilters[f.key] != null),
    [numericFields, metricFilters],
  )

  const availableFields = useMemo(
    () => numericFields.filter((f) => metricFilters[f.key] == null),
    [numericFields, metricFilters],
  )

  const { passingCount, passingIds } = useMemo(() => {
    if (activeFields.length === 0) {
      return { passingCount: candidates.length, passingIds: candidates.map((c) => c.id) }
    }
    const passing = candidates.filter((c) =>
      activeFields.every((field) => {
        const filter = metricFilters[field.key]
        if (!filter) return true
        const val = c.metrics[field.key]
        return typeof val === 'number' && val >= (filter.min ?? -Infinity) && val <= (filter.max ?? Infinity)
      }),
    )
    return { passingCount: passing.length, passingIds: passing.map((c) => c.id) }
  }, [candidates, activeFields, metricFilters])

  useEffect(() => {
    if (!showPicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  function addFilter(key: string) {
    const field = numericFields.find((f) => f.key === key)
    if (!field) return
    setMetricFilter(key, { min: field.min ?? 0, max: field.max ?? 1 })
    setShowPicker(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">{passingCount}</span>
          <span className="text-sm text-muted-foreground">of {candidates.length} candidates</span>
          {activeFields.length > 0 && candidates.length > 0 && (
            <span className="text-xs text-muted-foreground">
              · {Math.round((passingCount / candidates.length) * 100)}%
            </span>
          )}
        </div>
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker((v) => !v)}
            disabled={numericFields.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={11} />
            Add filter
          </button>
          {showPicker && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-border bg-popover shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
              {availableFields.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2 italic">All metrics are active</p>
              ) : (
                availableFields.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => addFilter(f.key)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    <span>{f.label}</span>
                    {f.unit && <span className="text-muted-foreground text-[10px]">{f.unit}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {activeFields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-1.5 text-center">
          <p className="text-sm text-muted-foreground">No active filters</p>
          <p className="text-xs text-muted-foreground/60">
            Add a filter to narrow candidates by metric range.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {activeFields.map((field) => (
              <FilterRow key={field.key} field={field} candidates={candidates} />
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              onClick={() => activeFields.forEach((f) => setMetricFilter(f.key, null))}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
            <button
              disabled={passingCount === 0}
              onClick={() => setBrushedCandidateIds(passingIds.length > 0 ? passingIds : null)}
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Select {passingCount} candidates
            </button>
          </div>
        </>
      )}
    </div>
  )
}
