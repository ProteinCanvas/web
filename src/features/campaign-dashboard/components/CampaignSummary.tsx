'use client'

import { useMemo, useState } from 'react'
import { FlaskConical, Dna, Layers, Star, TrendingUp, TrendingDown } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { getMetricMeta, getMetricDirection } from '@/shared/lib/metric-registry'
import type { Campaign, Candidate, MetricField } from '@/shared/types'
import { SOURCE_LABELS } from '@/app/_components/constants'

interface CampaignSummaryProps {
  campaign: Campaign
  candidates: Candidate[]
  metricFields: MetricField[]
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card/60 px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

function MetricSummaryRow({ field, candidates }: { field: MetricField; candidates: Candidate[] }) {
  const values = candidates
    .map((c) => c.metrics[field.key])
    .filter((v): v is number => typeof v === 'number')

  if (values.length === 0) return null

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const meta = getMetricMeta(field.key)
  const direction = getMetricDirection(field.key)

  const goodCount = meta?.goodThreshold !== undefined
    ? values.filter((v) => direction === 'higher' ? v >= meta.goodThreshold! : v <= meta.goodThreshold!).length
    : null

  const pct = max > min ? ((mean - min) / (max - min)) * 100 : 50

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="w-28 shrink-0">
        <div className="flex items-center gap-1">
          {direction === 'higher' ? (
            <TrendingUp size={10} className="text-green-400 shrink-0" />
          ) : direction === 'lower' ? (
            <TrendingDown size={10} className="text-blue-400 shrink-0" />
          ) : null}
          <span className="text-xs text-foreground font-medium truncate">{field.label}</span>
        </div>
        {field.unit && <span className="text-[10px] text-muted-foreground">{field.unit}</span>}
      </div>

      <div className="flex-1">
        <div className="relative h-1.5 bg-muted/60 rounded-full overflow-hidden">
          <div
            className="absolute h-full rounded-full bg-primary/50"
            style={{ width: `${pct}%` }}
          />
          {meta?.goodThreshold !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-px bg-green-400/70"
              style={{
                left: `${max > min ? ((meta.goodThreshold - min) / (max - min)) * 100 : 0}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs tabular-nums shrink-0">
        <span className="text-muted-foreground w-12 text-right">{mean.toFixed(2)}</span>
        <span className="text-muted-foreground/50">avg</span>
        {goodCount !== null && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            goodCount / values.length > 0.5
              ? 'bg-green-500/15 text-green-400'
              : goodCount / values.length > 0.2
                ? 'bg-yellow-500/15 text-yellow-400'
                : 'bg-red-500/15 text-red-400'
          }`}>
            {goodCount}/{values.length}
          </span>
        )}
      </div>
    </div>
  )
}

function TopCandidatesTable({
  candidates,
  metricFields,
  campaignId,
}: {
  candidates: Candidate[]
  metricFields: MetricField[]
  campaignId: string
}) {
  const shortlist = useCampaignStore((s) => s.shortlist)
  const [sortKey, setSortKey] = useState<string>(metricFields[0]?.key ?? '')

  const topCandidates = useMemo(() => {
    if (!sortKey) return candidates.slice(0, 10)
    const direction = getMetricDirection(sortKey)
    return [...candidates]
      .filter((c) => typeof c.metrics[sortKey] === 'number')
      .sort((a, b) => {
        const va = a.metrics[sortKey] as number
        const vb = b.metrics[sortKey] as number
        return direction === 'lower' ? va - vb : vb - va
      })
      .slice(0, 10)
  }, [candidates, sortKey])

  const shortlistedIds = useMemo(
    () => new Set(shortlist.filter((e) => e.campaignId === campaignId).map((e) => e.candidateId)),
    [shortlist, campaignId]
  )

  const visibleMetrics = metricFields.filter((f) => f.type === 'number').slice(0, 4)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Top 10 Candidates</h3>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="text-xs border rounded px-1.5 py-0.5 bg-background"
          >
            {metricFields.filter((f) => f.type === 'number').map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
              {visibleMetrics.map((f) => (
                <th key={f.key} className="px-3 py-2 text-right font-medium text-muted-foreground">
                  {f.label}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-muted-foreground w-8">★</th>
            </tr>
          </thead>
          <tbody>
            {topCandidates.map((c, i) => (
              <tr key={c.id} className="border-t border-border/50 hover:bg-muted/20">
                <td className="px-3 py-1.5">
                  <span className="text-muted-foreground/50 mr-1.5">{i + 1}.</span>
                  <span className="font-medium text-foreground truncate max-w-[140px] inline-block align-bottom">
                    {c.name}
                  </span>
                </td>
                {visibleMetrics.map((f) => {
                  const v = c.metrics[f.key]
                  return (
                    <td key={f.key} className="px-3 py-1.5 text-right tabular-nums text-foreground">
                      {typeof v === 'number' ? v.toFixed(3) : '—'}
                    </td>
                  )
                })}
                <td className="px-3 py-1.5 text-center">
                  {shortlistedIds.has(c.id) && (
                    <Star size={11} className="text-amber-400 inline" fill="currentColor" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CampaignSummary({ campaign, candidates, metricFields }: CampaignSummaryProps) {
  const shortlist = useCampaignStore((s) => s.shortlist)
  const shortlistedCount = shortlist.filter((e) => e.campaignId === campaign.id).length

  const withStructures = candidates.filter((c) => c.structureData).length
  const withSequences = candidates.filter((c) => c.sequence).length

  const numericFields = metricFields.filter((f) => f.type === 'number')

  const keyMetrics = useMemo(() => {
    const prioritized = ['plddt', 'iptm', 'pae_interaction', 'scrmsd', 'confidence_score', 'aggregate_score']
    const found = prioritized
      .map((k) => numericFields.find((f) => f.key === k))
      .filter((f): f is MetricField => f !== undefined)
    const rest = numericFields.filter((f) => !prioritized.includes(f.key))
    return [...found, ...rest].slice(0, 8)
  }, [numericFields])

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground font-medium">
              {SOURCE_LABELS[campaign.source] ?? campaign.source}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(campaign.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Candidates"
          value={candidates.length}
          sub="imported"
        />
        <StatCard
          label="With Structures"
          value={withStructures}
          sub={`${Math.round((withStructures / Math.max(candidates.length, 1)) * 100)}% of total`}
        />
        <StatCard
          label="With Sequences"
          value={withSequences}
          sub={`${Math.round((withSequences / Math.max(candidates.length, 1)) * 100)}% of total`}
        />
        <StatCard
          label="Shortlisted"
          value={shortlistedCount}
          sub={`${Math.round((shortlistedCount / Math.max(candidates.length, 1)) * 100)}% selected`}
        />
      </div>

      {keyMetrics.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-foreground">Metric Summary</h3>
            <span className="text-[10px] text-muted-foreground">mean · good threshold marker (green)</span>
          </div>
          <div className="rounded-lg border border-border bg-card/40 divide-y divide-border/50 px-4 py-1">
            {keyMetrics.map((f) => (
              <MetricSummaryRow key={f.key} field={f} candidates={candidates} />
            ))}
          </div>
        </div>
      )}

      {numericFields.length > 0 && (
        <TopCandidatesTable
          candidates={candidates}
          metricFields={numericFields}
          campaignId={campaign.id}
        />
      )}
    </div>
  )
}
