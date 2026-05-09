'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  type MouseHandlerDataParam,
} from 'recharts'
import { Download } from 'lucide-react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { useInteraction } from '@/shared/hooks/useInteraction'
import { normalizeMetricValue } from '@/shared/lib/metrics'
import { registerCapture, unregisterCapture } from '@/shared/lib/capture-registry'
import { svgElementToPng } from '@/features/export/lib/chart-export'
import { getMetricMeta, getMetricGoodThreshold } from '@/shared/lib/metric-registry'
import type { Candidate, MetricField } from '@/shared/types'

interface MetricPanelProps {
  candidates: Candidate[]
  metricFields: MetricField[]
  onBrushSelection?: (selectedIds: Set<string>) => void
  className?: string
}

type ActiveTab = 'scatter' | 'distribution' | 'filters'

function getNumericValue(c: Candidate, key: string): number | null {
  const v = c.metrics[key]
  return typeof v === 'number' ? v : null
}

function interpolateColor(t: number): string {
  const r = Math.round(59 + (239 - 59) * t)
  const g = Math.round(130 + (68 - 130) * t)
  const b = Math.round(246 + (68 - 246) * t)
  return `rgb(${r},${g},${b})`
}

const CHART_HEIGHT = 280

function ChartExportButton({ containerRef, filename }: { containerRef: React.RefObject<HTMLDivElement | null>; filename: string }) {
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
        <div className="w-3 h-3 border border-muted-foreground/50 border-t-muted-foreground rounded-full animate-spin" />
      ) : (
        <Download size={11} />
      )}
      PNG
    </button>
  )
}

function ScatterTab({
  candidates,
  metricFields,
}: {
  candidates: Candidate[]
  metricFields: MetricField[]
}) {
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const { focusCandidate } = useInteraction()
  const chartRef = useRef<HTMLDivElement>(null)

  const [xKey, setXKey] = useState<string>(metricFields[0]?.key ?? '')
  const [yKey, setYKey] = useState<string>(metricFields[1]?.key ?? metricFields[0]?.key ?? '')
  const [colorKey, setColorKey] = useState<string>('')

  const colorField = metricFields.find((f) => f.key === colorKey)

  const data = useMemo(() => {
    return candidates.flatMap((c) => {
      const x = getNumericValue(c, xKey)
      const y = getNumericValue(c, yKey)
      if (x === null || y === null) return []
      return [{ id: c.id, x, y, colorVal: colorKey ? getNumericValue(c, colorKey) : null }]
    })
  }, [candidates, xKey, yKey, colorKey])

  const getPointColor = useCallback(
    (id: string, colorVal: number | null) => {
      if (id === selectedCandidateId) return 'hsl(var(--primary))'
      if (colorKey && colorVal !== null && colorField?.min !== undefined && colorField?.max !== undefined) {
        const t = normalizeMetricValue(colorVal, colorField.min, colorField.max)
        return interpolateColor(t)
      }
      return 'hsl(var(--muted-foreground) / 0.5)'
    },
    [selectedCandidateId, colorKey, colorField]
  )

  useEffect(() => {
    registerCapture('scatter', async () => {
      if (!chartRef.current) return null
      const svgEl = chartRef.current.querySelector('svg')
      if (!svgEl) return null
      return svgElementToPng(svgEl as SVGElement, { background: '#ffffff', scale: 2 })
    })
    return () => unregisterCapture('scatter')
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground">X</label>
        <select
          value={xKey}
          onChange={(e) => setXKey(e.target.value)}
          className="text-xs border rounded px-2 py-1 bg-background"
        >
          {metricFields.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">Y</label>
        <select
          value={yKey}
          onChange={(e) => setYKey(e.target.value)}
          className="text-xs border rounded px-2 py-1 bg-background"
        >
          {metricFields.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">Color</label>
        <select
          value={colorKey}
          onChange={(e) => setColorKey(e.target.value)}
          className="text-xs border rounded px-2 py-1 bg-background"
        >
          <option value="">None</option>
          {metricFields.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <div className="ml-auto">
          <ChartExportButton containerRef={chartRef} filename="scatter.png" />
        </div>
      </div>
      <div ref={chartRef} style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="x" type="number" name={xKey} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis dataKey="y" type="number" name={yKey} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
              formatter={(value: unknown) => [typeof value === 'number' ? value.toFixed(3) : String(value)]}
            />
            <Scatter
              data={data}
              onClick={(point: { payload?: { id?: unknown } }) => {
                const id = point?.payload?.id
                if (typeof id === 'string') focusCandidate(id)
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={getPointColor(entry.id, entry.colorVal)}
                  r={entry.id === selectedCandidateId ? 6 : 4}
                  className="cursor-pointer transition-all"
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
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
    if (!f || f.min === undefined || f.max === undefined) {
      return { bins: [], field: f }
    }

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
      if (binsArr[idx]) {
        binsArr[idx].count++
        binsArr[idx].ids.push(c.id)
      }
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
      if (newSelected.has(data.index)) {
        newSelected.delete(data.index)
      } else {
        newSelected.add(data.index)
      }
      setSelectedBins(newSelected)

      if (onBrushSelection) {
        const ids = new Set<string>()
        newSelected.forEach((binIdx) => {
          bins[binIdx]?.ids.forEach((id) => ids.add(id))
        })
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
          onChange={(e) => {
            setMetricKey(e.target.value)
            setSelectedBins(new Set())
            onBrushSelection?.(new Set())
          }}
          className="text-xs border rounded px-2 py-1 bg-background"
        >
          {metricFields.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        {selectedBins.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium">{selectedCount} selected</span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">Click bars to select</span>
        )}
        <div className="ml-auto">
          <ChartExportButton containerRef={chartRef} filename="distribution.png" />
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
                if (idx >= 0 && bins[idx]) {
                  handleBarClick(bins[idx] as { index: number; ids: string[] })
                }
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
                        ? hoveredIndex === b.index
                          ? 'hsl(var(--primary) / 0.75)'
                          : 'hsl(var(--primary))'
                        : hoveredIndex === b.index
                        ? 'hsl(var(--muted-foreground) / 0.75)'
                        : 'hsl(var(--muted-foreground) / 0.4)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
            No data
          </div>
        )}
      </div>
    </div>
  )
}

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
  const color = direction === 'higher' ? 'text-green-400' : direction === 'lower' ? 'text-blue-400' : 'text-muted-foreground'
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

function FiltersTab({
  candidates,
  metricFields,
}: {
  candidates: Candidate[]
  metricFields: MetricField[]
}) {
  const metricFilters = useCampaignStore((s) => s.filters.metricFilters)
  const setMetricFilter = useCampaignStore((s) => s.setMetricFilter)

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      {metricFields.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No numeric metrics available.</p>
      )}
      {metricFields.map((field) => {
        const globalMin = field.min ?? 0
        const globalMax = field.max ?? 1
        const current = metricFilters[field.key]
        const currentMin = current?.min ?? globalMin
        const currentMax = current?.max ?? globalMax
        const meta = getMetricMeta(field.key)
        const sampleVal = candidates[0]?.metrics[field.key]
        const threshold = getMetricGoodThreshold(field.key, typeof sampleVal === 'number' ? sampleVal : undefined)
        const hasThreshold = threshold !== undefined && threshold >= globalMin && threshold <= globalMax

        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{field.label}</span>
                {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{currentMin.toFixed(2)}</span>
                <span>—</span>
                <span className="font-mono">{currentMax.toFixed(2)}</span>
                {current && (
                  <button
                    onClick={() => setMetricFilter(field.key, null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-6">Min</label>
                <input
                  type="range"
                  min={globalMin}
                  max={globalMax}
                  step={(globalMax - globalMin) / 100}
                  value={currentMin}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setMetricFilter(field.key, { min: v, max: currentMax })
                  }}
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
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setMetricFilter(field.key, { min: currentMin, max: v })
                  }}
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
      })}
    </div>
  )
}

export function MetricPanel({ candidates, metricFields, onBrushSelection, className }: MetricPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scatter')

  const numericFields = useMemo(
    () => metricFields.filter((f) => f.type === 'number'),
    [metricFields]
  )

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'scatter', label: 'Scatter' },
    { id: 'distribution', label: 'Distribution' },
    { id: 'filters', label: 'Filters' },
  ]

  return (
    <div className={`flex flex-col border rounded-md overflow-hidden bg-background ${className ?? ''}`}>
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 overflow-auto">
        {numericFields.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
            No numeric metrics available.
          </div>
        ) : (
          <>
            {activeTab === 'scatter' && (
              <ScatterTab candidates={candidates} metricFields={numericFields} />
            )}
            {activeTab === 'distribution' && (
              <DistributionTab
                candidates={candidates}
                metricFields={numericFields}
                onBrushSelection={onBrushSelection}
              />
            )}
            {activeTab === 'filters' && (
              <FiltersTab candidates={candidates} metricFields={numericFields} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
