'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { inferMetricFields } from '@/shared/lib/metrics'
import type { Campaign } from '@/shared/types'

interface CampaignComparisonProps {
  activeCampaign: Campaign
}

const BIN_COUNT = 8

function buildHistogram(
  campaign: Campaign,
  key: string,
  min: number,
  max: number
): number[] {
  const range = max - min || 1
  const binSize = range / BIN_COUNT
  const bins = Array(BIN_COUNT).fill(0) as number[]
  for (const c of campaign.candidates) {
    const v = c.metrics[key]
    if (typeof v !== 'number') continue
    const idx = Math.min(Math.floor((v - min) / binSize), BIN_COUNT - 1)
    bins[idx]++
  }
  return bins
}

function buildComparisonData(
  a: Campaign,
  b: Campaign,
  key: string,
  min: number,
  max: number
) {
  const range = max - min || 1
  const binSize = range / BIN_COUNT
  const binsA = buildHistogram(a, key, min, max)
  const binsB = buildHistogram(b, key, min, max)
  return Array.from({ length: BIN_COUNT }, (_, i) => ({
    label: (min + (i + 0.5) * binSize).toFixed(2),
    [a.name.slice(0, 20)]: binsA[i],
    [b.name.slice(0, 20)]: binsB[i],
  }))
}

function passRate(campaign: Campaign, key: string, threshold: number, above: boolean): string {
  const vals = campaign.candidates
    .map((c) => c.metrics[key])
    .filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return '—'
  const passing = vals.filter((v) => (above ? v >= threshold : v <= threshold)).length
  return `${passing}/${vals.length} (${Math.round((passing / vals.length) * 100)}%)`
}

export function CampaignComparison({ activeCampaign }: CampaignComparisonProps) {
  const campaigns = useCampaignStore((s) => s.campaigns)
  const [compareId, setCompareId] = useState<string>('')

  const compareCampaign = campaigns.find((c) => c.id === compareId) ?? null

  const sharedMetrics = useMemo(() => {
    if (!compareCampaign) return []
    const aKeys = new Set(inferMetricFields(activeCampaign.candidates).filter((f) => f.type === 'number').map((f) => f.key))
    return inferMetricFields(compareCampaign.candidates)
      .filter((f) => f.type === 'number' && aKeys.has(f.key))
  }, [activeCampaign, compareCampaign])

  const [metricKey, setMetricKey] = useState<string>('')

  const selectedMetric = useMemo(
    () => sharedMetrics.find((f) => f.key === metricKey) ?? sharedMetrics[0],
    [sharedMetrics, metricKey]
  )

  const chartData = useMemo(() => {
    if (!compareCampaign || !selectedMetric) return []
    const allVals = [
      ...activeCampaign.candidates,
      ...compareCampaign.candidates,
    ]
      .map((c) => c.metrics[selectedMetric.key])
      .filter((v): v is number => typeof v === 'number')
    const min = Math.min(...allVals)
    const max = Math.max(...allVals)
    return buildComparisonData(activeCampaign, compareCampaign, selectedMetric.key, min, max)
  }, [activeCampaign, compareCampaign, selectedMetric])

  const summaryRows = useMemo(() => {
    if (!compareCampaign) return []
    const THRESHOLDS: Record<string, { t: number; above: boolean; label: string }> = {
      plddt: { t: 85, above: true, label: 'pLDDT > 85' },
      pae_interaction: { t: 10, above: false, label: 'PAE < 10' },
      iptm: { t: 0.70, above: true, label: 'iPTM > 0.70' },
      ptm: { t: 0.65, above: true, label: 'pTM > 0.65' },
      dSASA: { t: 700, above: true, label: 'dSASA > 700' },
    }
    return Object.entries(THRESHOLDS)
      .filter(([key]) => sharedMetrics.some((f) => f.key === key))
      .map(([key, { t, above, label }]) => ({
        label,
        a: passRate(activeCampaign, key, t, above),
        b: passRate(compareCampaign, key, t, above),
      }))
  }, [activeCampaign, compareCampaign, sharedMetrics])

  const otherCampaigns = campaigns.filter((c) => c.id !== activeCampaign.id)

  if (otherCampaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Import a second campaign to compare metric distributions across rounds.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Compare with</span>
          <select
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 bg-background"
          >
            <option value="">Select campaign…</option>
            {otherCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.candidates.length} candidates)
              </option>
            ))}
          </select>
        </div>
        {compareCampaign && sharedMetrics.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Metric</span>
            <select
              value={selectedMetric?.key ?? ''}
              onChange={(e) => setMetricKey(e.target.value)}
              className="text-xs border rounded px-2 py-1.5 bg-background"
            >
              {sharedMetrics.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {compareCampaign && selectedMetric && (
        <>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-border p-3 bg-card/50">
              <p className="font-medium text-foreground mb-0.5">{activeCampaign.name}</p>
              <p className="text-muted-foreground">{activeCampaign.candidates.length} candidates · {activeCampaign.source}</p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-card/50">
              <p className="font-medium text-foreground mb-0.5">{compareCampaign.name}</p>
              <p className="text-muted-foreground">{compareCampaign.candidates.length} candidates · {compareCampaign.source}</p>
            </div>
          </div>

          <div className="h-64 border rounded-md p-2 bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  cursor={false}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey={activeCampaign.name.slice(0, 20)} fill="hsl(var(--primary))" opacity={0.7} radius={[2, 2, 0, 0]} isAnimationActive={false} activeBar={false} />
                <Bar dataKey={compareCampaign.name.slice(0, 20)} fill="#f59e0b" opacity={0.7} radius={[2, 2, 0, 0]} isAnimationActive={false} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {summaryRows.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Filter</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">{activeCampaign.name.slice(0, 24)}</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">{compareCampaign.name.slice(0, 24)}</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-foreground">{row.a}</td>
                      <td className="px-3 py-2 text-right font-mono text-foreground">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
