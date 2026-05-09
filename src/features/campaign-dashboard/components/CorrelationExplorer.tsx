'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  BarChart, Bar, ReferenceLine, LabelList,
} from 'recharts'
import type { Campaign, MetricField, ExperimentalResult } from '@/shared/types'
import { getMetricLabel, getMetricDirection } from '@/shared/lib/metric-registry'
import { MetricInfo } from '@/shared/components/MetricInfo'

interface Props {
  campaign: Campaign
  metricFields: MetricField[]
}

const EXP_METRICS = [
  { key: 'exp_kd', label: 'KD (nM)' },
  { key: 'exp_expression', label: 'Expression (%)' },
  { key: 'exp_tm', label: 'Tm (°C)' },
  { key: 'exp_binding', label: 'Binds (0/1)' },
]

const OUTCOME_KEYS = ['kd', 'expressionRate', 'tm', 'bindingSuccess'] as const
type OutcomeKey = typeof OUTCOME_KEYS[number]

const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  kd: 'KD (nM)',
  expressionRate: 'Expression',
  tm: 'Tm (°C)',
  bindingSuccess: 'Binding',
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array<number>(values.length)
  let j = 0
  while (j < indexed.length) {
    let k = j
    while (k < indexed.length - 1 && indexed[k + 1].v === indexed[j].v) k++
    const avgRank = (j + k) / 2 + 1
    for (let m = j; m <= k; m++) ranks[indexed[m].i] = avgRank
    j = k + 1
  }
  return ranks
}

function spearman(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0
  return pearson(rank(xs), rank(ys))
}

function rToColor(r: number): string {
  const t = (r + 1) / 2
  if (t < 0.5) {
    const s = t * 2
    return `rgb(${Math.round(239 * s + 255 * (1 - s))}, ${Math.round(68 * s + 255 * (1 - s))}, ${Math.round(68 * s + 255 * (1 - s))})`
  }
  const s = (t - 0.5) * 2
  return `rgb(${Math.round(255 * (1 - s) + 59 * s)}, ${Math.round(255 * (1 - s) + 130 * s)}, ${Math.round(255 * (1 - s) + 246 * s)})`
}

function computeAUC(scores: number[], labels: boolean[]): number {
  const pairs = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => b.s - a.s)
  const pos = pairs.filter((p) => p.l).length
  const neg = pairs.length - pos
  if (pos === 0 || neg === 0) return 0.5
  let tp = 0, auc = 0
  for (const p of pairs) {
    if (p.l) tp++
    else auc += tp
  }
  return auc / (pos * neg)
}

interface CorrelationRow {
  metricKey: string
  metricLabel: string
  r: number
  rs: number
  n: number
}

const CALIBRATION_PERCENTILES = [10, 25, 50, 75, 90]

function ThresholdCalibrator({
  aucData,
  expByCandidate,
  candidates,
}: {
  aucData: { metricKey: string; metricLabel: string; auc: number; n: number }[]
  expByCandidate: Map<string, ExperimentalResult>
  candidates: Campaign['candidates']
}) {
  const [selectedMetric, setSelectedMetric] = useState(aucData[0]?.metricKey ?? '')

  const direction = getMetricDirection(selectedMetric)

  const calibrationData = useMemo(() => {
    const scored = candidates.flatMap((c) => {
      const exp = expByCandidate.get(c.id)
      if (!exp || exp.bindingSuccess === undefined) return []
      const v = typeof c.metrics[selectedMetric] === 'number' ? (c.metrics[selectedMetric] as number) : null
      if (v === null) return []
      return [{ value: v, binds: exp.bindingSuccess === true }]
    })
    if (scored.length < 5) return []

    const sorted = [...scored].sort((a, b) => a.value - b.value)
    const n = sorted.length

    return CALIBRATION_PERCENTILES.map((pct) => {
      const idx = Math.floor((pct / 100) * n)
      const threshold = sorted[Math.min(idx, n - 1)].value
      const passing = direction === 'lower'
        ? scored.filter((s) => s.value <= threshold)
        : scored.filter((s) => s.value >= threshold)
      const hits = passing.filter((s) => s.binds).length
      const hitRate = passing.length > 0 ? hits / passing.length : 0
      return { pct, threshold, nPassing: passing.length, hits, hitRate }
    })
  }, [selectedMetric, candidates, expByCandidate, direction])

  if (calibrationData.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Threshold calibrator</h3>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          className="text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
        >
          {aucData.map((d) => (
            <option key={d.metricKey} value={d.metricKey}>{d.metricLabel}</option>
          ))}
        </select>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cutoff</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Threshold</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Passing</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Hits</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Hit rate</th>
            </tr>
          </thead>
          <tbody>
            {calibrationData.map((row) => {
              const barColor = row.hitRate >= 0.4
                ? 'bg-vis-teal'
                : row.hitRate >= 0.2
                ? 'bg-vis-amber'
                : 'bg-muted-foreground/40'
              return (
                <tr key={row.pct} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-3 py-1.5 text-muted-foreground">
                    P{row.pct} {direction === 'lower' ? '≤' : '≥'}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-foreground">
                    {row.threshold.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{row.nPassing}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{row.hits}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${row.hitRate * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">
                        {(row.hitRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Hit rate at percentile thresholds of {getMetricLabel(selectedMetric)}. Teal ≥ 40% · Amber ≥ 20%.
      </p>
    </div>
  )
}

const CELL_W = 60
const CELL_H = 32
const LABEL_COL_W = 90
const HEADER_ROW_H = 24

export function CorrelationExplorer({ campaign, metricFields }: Props) {
  const expResults = useMemo(() => campaign.experimentalResults ?? [], [campaign.experimentalResults])
  const numericFields = useMemo(
    () => metricFields.filter((f) => f.type === 'number' && !f.key.startsWith('exp_')),
    [metricFields]
  )

  const [xKey, setXKey] = useState(numericFields[0]?.key ?? '')
  const [yKey, setYKey] = useState('exp_kd')

  const expByCandidate = useMemo(() => {
    const map = new Map<string, typeof expResults[number]>()
    for (const r of expResults) map.set(r.candidateId, r)
    return map
  }, [expResults])

  const matchedCount = useMemo(() => {
    return campaign.candidates.filter((c) => expByCandidate.has(c.id)).length
  }, [campaign.candidates, expByCandidate])

  const roundNumbers = useMemo(() => {
    const set = new Set(expResults.map((r) => r.round))
    return Array.from(set).sort((a, b) => a - b)
  }, [expResults])

  const scatterData = useMemo(() => {
    if (!xKey || !yKey) return []
    return campaign.candidates.flatMap((c) => {
      const exp = expByCandidate.get(c.id)
      if (!exp) return []
      const x = typeof c.metrics[xKey] === 'number' ? (c.metrics[xKey] as number) : null
      const yRaw = yKey === 'exp_kd' ? exp.kd :
                   yKey === 'exp_expression' ? exp.expressionRate :
                   yKey === 'exp_tm' ? exp.tm :
                   yKey === 'exp_binding' ? (exp.bindingSuccess === true ? 1 : exp.bindingSuccess === false ? 0 : null) :
                   null
      if (x === null || yRaw === null || yRaw === undefined) return []
      return [{ x, y: yRaw, name: c.name, binds: exp.bindingSuccess }]
    })
  }, [campaign.candidates, expByCandidate, xKey, yKey])

  const correlationTable = useMemo((): CorrelationRow[] => {
    return numericFields.map((f) => {
      const pairs = campaign.candidates.flatMap((c) => {
        const exp = expByCandidate.get(c.id)
        if (!exp || exp.kd === undefined) return []
        const x = typeof c.metrics[f.key] === 'number' ? (c.metrics[f.key] as number) : null
        if (x === null) return []
        return [{ x, y: exp.kd }]
      })
      const xs = pairs.map((p) => p.x)
      const ys = pairs.map((p) => p.y)
      const r = pairs.length >= 5 ? pearson(xs, ys) : 0
      const rs = pairs.length >= 5 ? spearman(xs, ys) : 0
      return { metricKey: f.key, metricLabel: getMetricLabel(f.key), r, rs, n: pairs.length }
    })
      .filter((row) => row.n >= 5)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
  }, [numericFields, campaign.candidates, expByCandidate])

  const heatmapData = useMemo(() => {
    if (matchedCount < 5) return null
    const outcomes: OutcomeKey[] = ['kd', 'expressionRate', 'tm', 'bindingSuccess']
    return numericFields.map((f) => {
      const byOutcome: Partial<Record<OutcomeKey, number>> = {}
      for (const outcome of outcomes) {
        const pairs = campaign.candidates.flatMap((c) => {
          const exp = expByCandidate.get(c.id)
          if (!exp) return []
          const x = typeof c.metrics[f.key] === 'number' ? (c.metrics[f.key] as number) : null
          if (x === null) return []
          const y = outcome === 'bindingSuccess'
            ? (exp.bindingSuccess === true ? 1 : exp.bindingSuccess === false ? 0 : null)
            : (exp[outcome] as number | undefined) ?? null
          if (y === null || y === undefined) return []
          return [{ x, y }]
        })
        if (pairs.length >= 5) {
          byOutcome[outcome] = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y))
        }
      }
      return { metricKey: f.key, metricLabel: getMetricLabel(f.key), byOutcome }
    }).filter((row) => Object.keys(row.byOutcome).length > 0)
  }, [numericFields, campaign.candidates, expByCandidate, matchedCount])

  const aucData = useMemo(() => {
    const bindingPairs = campaign.candidates.flatMap((c) => {
      const exp = expByCandidate.get(c.id)
      if (!exp || exp.bindingSuccess === undefined) return []
      return [{ candidateId: c.id, bindingSuccess: exp.bindingSuccess, metrics: c.metrics }]
    })
    if (bindingPairs.length < 10) return null
    return numericFields.flatMap((f) => {
      const pairs = bindingPairs.flatMap((p) => {
        const v = typeof p.metrics[f.key] === 'number' ? (p.metrics[f.key] as number) : null
        if (v === null) return []
        return [{ score: v, label: p.bindingSuccess === true }]
      })
      if (pairs.length < 10) return []
      const auc = computeAUC(pairs.map((p) => p.score), pairs.map((p) => p.label))
      return [{ metricKey: f.key, metricLabel: getMetricLabel(f.key), auc, n: pairs.length }]
    }).sort((a, b) => b.auc - a.auc)
  }, [numericFields, campaign.candidates, expByCandidate])

  const maxAuc = useMemo(
    () => (aucData && aucData.length > 0 ? Math.max(...aucData.map((d) => d.auc)) : 0),
    [aucData]
  )

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const outcomes = useMemo<OutcomeKey[]>(() => ['kd', 'expressionRate', 'tm', 'bindingSuccess'], [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !heatmapData || heatmapData.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rows = heatmapData
    const cols = outcomes
    const w = LABEL_COL_W + cols.length * CELL_W
    const h = HEADER_ROW_H + rows.length * CELL_H
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.font = '10px system-ui, sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.textBaseline = 'middle'
    for (let ci = 0; ci < cols.length; ci++) {
      const cx = LABEL_COL_W + ci * CELL_W + CELL_W / 2
      ctx.textAlign = 'center'
      ctx.fillText(OUTCOME_LABELS[cols[ci]], cx, HEADER_ROW_H / 2)
    }
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]
      const cy = HEADER_ROW_H + ri * CELL_H + CELL_H / 2
      ctx.textAlign = 'right'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(row.metricLabel.slice(0, 12), LABEL_COL_W - 4, cy)
      for (let ci = 0; ci < cols.length; ci++) {
        const outcome = cols[ci]
        const r = row.byOutcome[outcome]
        const cx = LABEL_COL_W + ci * CELL_W
        const cy2 = HEADER_ROW_H + ri * CELL_H
        if (r === undefined) {
          ctx.fillStyle = '#1e293b'
          ctx.fillRect(cx + 1, cy2 + 1, CELL_W - 2, CELL_H - 2)
          ctx.fillStyle = '#475569'
          ctx.textAlign = 'center'
          ctx.fillText('—', cx + CELL_W / 2, cy2 + CELL_H / 2)
        } else {
          ctx.fillStyle = rToColor(r)
          ctx.fillRect(cx + 1, cy2 + 1, CELL_W - 2, CELL_H - 2)
          ctx.fillStyle = Math.abs(r) > 0.5 ? '#ffffff' : '#1e293b'
          ctx.textAlign = 'center'
          ctx.fillText(`${r >= 0 ? '+' : ''}${r.toFixed(2)}`, cx + CELL_W / 2, cy2 + CELL_H / 2)
        }
      }
    }
  }, [heatmapData, outcomes])

  const hasExpData = expResults.length > 0

  if (!hasExpData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-48 text-center">
        <p className="text-sm font-medium text-foreground">No experimental results loaded</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Import a results CSV (columns: name, kd, expression, tm, binds, round) using the
          &ldquo;Add results&rdquo; button above.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-vis-teal/10 border border-vis-teal/30">
        <span className="text-xs text-vis-teal font-medium">
          {matchedCount} candidates with experimental data
          {roundNumbers.length > 0 && ` · Round${roundNumbers.length > 1 ? 's' : ''} ${roundNumbers.join(', ')} results`}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground flex-1">Scatter explorer</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">X axis</span>
            <select
              value={xKey}
              onChange={(e) => setXKey(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
            >
              {numericFields.map((f) => (
                <option key={f.key} value={f.key}>{f.label ?? f.key}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Y axis</span>
            <select
              value={yKey}
              onChange={(e) => setYKey(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
            >
              {EXP_METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {scatterData.length} matched candidates
          </span>
        </div>

        {scatterData.length >= 2 && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 24, left: 24 }}>
                <XAxis
                  dataKey="x"
                  type="number"
                  name={getMetricLabel(xKey)}
                  tick={{ fontSize: 10 }}
                  label={{ value: getMetricLabel(xKey), position: 'insideBottom', offset: -12, fontSize: 10 }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name={EXP_METRICS.find((m) => m.key === yKey)?.label ?? yKey}
                  tick={{ fontSize: 10 }}
                  width={36}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    const d = payload?.[0]?.payload as { name: string; x: number; y: number } | undefined
                    if (!d) return null
                    return (
                      <div className="bg-card border border-border rounded px-2 py-1.5 text-xs shadow">
                        <p className="font-medium text-foreground">{d.name}</p>
                        <p className="text-muted-foreground">{getMetricLabel(xKey)}: {d.x.toFixed(3)}</p>
                        <p className="text-muted-foreground">{EXP_METRICS.find((m) => m.key === yKey)?.label}: {d.y.toFixed(3)}</p>
                      </div>
                    )
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.binds === true ? '#22c55e' : d.binds === false ? '#ef4444' : '#6b7280'}
                      opacity={0.75}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="border-t border-border/50" />

      {correlationTable.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            Pearson &amp; Spearman r vs. experimental KD (n ≥ 5)
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Metric</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">r</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">r_s</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">n</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">Strength</th>
                </tr>
              </thead>
              <tbody>
                {correlationTable.map((row) => {
                  const absR = Math.abs(row.r)
                  const color = absR > 0.6 ? 'text-vis-teal' : absR > 0.3 ? 'text-vis-amber' : 'text-muted-foreground'
                  const absRs = Math.abs(row.rs)
                  const colorS = absRs > 0.6 ? 'text-vis-teal' : absRs > 0.3 ? 'text-vis-amber' : 'text-muted-foreground'
                  return (
                    <tr key={row.metricKey} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-foreground">
                        <div className="flex items-center gap-1">
                          <span>{row.metricLabel}</span>
                          <MetricInfo metricKey={row.metricKey} placement="below" />
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums font-mono ${color}`}>
                        {row.r >= 0 ? '+' : ''}{row.r.toFixed(3)}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums font-mono ${colorS}`}>
                        {row.rs >= 0 ? '+' : ''}{row.rs.toFixed(3)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{row.n}</td>
                      <td className="px-3 py-1.5">
                        <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${absR > 0.6 ? 'bg-vis-teal' : absR > 0.3 ? 'bg-vis-amber' : 'bg-muted-foreground/40'}`}
                            style={{ width: `${absR * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border-t border-border/50" />

      {heatmapData && heatmapData.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-foreground">All-metric correlation heatmap</h3>
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              style={{
                width: LABEL_COL_W + outcomes.length * CELL_W,
                height: HEADER_ROW_H + heatmapData.length * CELL_H,
                imageRendering: 'crisp-edges',
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Color scale: red = −1 (negative correlation) → white = 0 → blue = +1 (positive correlation)
          </p>
        </div>
      )}

      {aucData && aucData.length > 0 && (
        <>
          <div className="border-t border-border/50" />
          {maxAuc < 0.65 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="text-amber-400 text-xs shrink-0 mt-0.5">⚠</span>
              <p className="text-xs text-amber-300/90 leading-relaxed">
                No computational metric strongly predicts binding success in this campaign (best AUC {maxAuc.toFixed(2)}).
                This is common when using ipTM/ipAE alone — these measure structural confidence, not affinity.
                Consider adding Rosetta rescoring or scRMSD filtering to improve selectivity.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-foreground">Binding success predictors</h3>
            <div style={{ height: Math.max(80, aucData.length * 28 + 32) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aucData}
                  layout="vertical"
                  margin={{ top: 4, right: 48, bottom: 4, left: 80 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 1]}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <YAxis
                    type="category"
                    dataKey="metricLabel"
                    tick={{ fontSize: 10 }}
                    width={76}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      const d = payload?.[0]?.payload as { metricLabel: string; auc: number; n: number } | undefined
                      if (!d) return null
                      return (
                        <div className="bg-card border border-border rounded px-2 py-1.5 text-xs shadow">
                          <p className="font-medium text-foreground">{d.metricLabel}</p>
                          <p className="text-muted-foreground">AUC: {d.auc.toFixed(3)}</p>
                          <p className="text-muted-foreground">n={d.n}</p>
                        </div>
                      )
                    }}
                  />
                  <ReferenceLine x={0.5} stroke="#6b7280" strokeDasharray="3 3" label={{ value: '0.5', fontSize: 9, fill: '#6b7280' }} />
                  <Bar dataKey="auc" radius={[0, 3, 3, 0]}>
                    <LabelList
                      dataKey="auc"
                      position="right"
                      formatter={(v: unknown) => typeof v === 'number' ? v.toFixed(2) : ''}
                      style={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    {aucData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.auc > 0.7 ? '#22c55e' : d.auc >= 0.5 ? '#eab308' : '#6b7280'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground">
              AUC-ROC for predicting binding success. Green &gt; 0.7 · Yellow 0.5–0.7 · Grey &lt; 0.5. Dashed line = random (0.5).
            </p>
          </div>
          <div className="border-t border-border/50" />
          <ThresholdCalibrator
            aucData={aucData}
            expByCandidate={expByCandidate}
            candidates={campaign.candidates}
          />
        </>
      )}
    </div>
  )
}
