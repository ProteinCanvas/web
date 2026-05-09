'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { Star, TrendingUp, TrendingDown, Target, X, Copy, Check } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { getMetricMeta, getMetricDirection } from '@/shared/lib/metric-registry'
import { statusBgColor, statusTextColor } from '@/shared/lib/status-colors'
import { useToast } from '@/shared/hooks/useToast'
import { MetricInfo } from '@/shared/components/MetricInfo'
import type { Campaign, Candidate, MetricField, StructureFormat } from '@/shared/types'
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
  const min = values.reduce((a, b) => Math.min(a, b), Infinity)
  const max = values.reduce((a, b) => Math.max(a, b), -Infinity)
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
          <MetricInfo metricKey={field.key} />
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
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
            statusBgColor(goodCount / values.length > 0.5 ? 'good' : goodCount / values.length > 0.2 ? 'warn' : 'bad')
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
            className="text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
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

function RoundSummaryTable({ campaign }: { campaign: Campaign }) {
  const data = useMemo(() => {
    const rounds = campaign.rounds ?? []
    const expResults = campaign.experimentalResults ?? []
    if (rounds.length === 0 || expResults.length === 0) return []
    const expByCandidate = new Map(expResults.map((r) => [r.candidateId, r]))
    return rounds.map((round) => {
      const ordered = round.orderedCandidateIds
      const results = ordered.flatMap((id) => {
        const r = expByCandidate.get(id)
        return r ? [r] : []
      })
      const expressed = results.filter(
        (r) => r.expressed === true || (r.expressionRate !== undefined && (r.expressionRate > 1 ? r.expressionRate > 30 : r.expressionRate > 0.3))
      ).length
      const binders = results.filter((r) => r.bindingSuccess === true).length
      const kdValues = results.filter((r) => r.kd !== undefined && r.bindingSuccess === true).map((r) => r.kd!)
      const bestKd = kdValues.length > 0 ? Math.min(...kdValues) : null
      const medianKd = kdValues.length > 0
        ? [...kdValues].sort((a, b) => a - b)[Math.floor(kdValues.length / 2)]
        : null
      return { round, ordered: ordered.length, withResults: results.length, expressed, binders, bestKd, medianKd }
    })
  }, [campaign.rounds, campaign.experimentalResults])

  if (data.length === 0 || data.every((r) => r.withResults === 0)) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-foreground">Design round outcomes</h3>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Round</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ordered</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Expressed</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Binders</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Best KD (nM)</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Median KD (nM)</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ round, ordered, withResults, expressed, binders, bestKd, medianKd }) => (
              <tr key={round.id} className="border-t border-border/50 hover:bg-muted/20">
                <td className="px-3 py-2 font-medium text-foreground">{round.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{ordered}</td>
                <td className="px-3 py-2 text-right">
                  {withResults > 0 ? (
                    <span className="tabular-nums text-foreground">
                      {expressed}
                      <span className="text-muted-foreground ml-1">({Math.round((expressed / withResults) * 100)}%)</span>
                    </span>
                  ) : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {withResults > 0 ? (
                    <span className="tabular-nums text-foreground">
                      {binders}
                      <span className="text-muted-foreground ml-1">({Math.round((binders / Math.max(expressed, 1)) * 100)}%)</span>
                    </span>
                  ) : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {bestKd !== null ? (
                    <span className={`tabular-nums font-mono ${statusTextColor(bestKd < 10 ? 'good' : bestKd < 100 ? 'warn' : 'bad')}`}>
                      {bestKd < 1 ? bestKd.toFixed(2) : bestKd.toFixed(1)}
                    </span>
                  ) : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {medianKd !== null ? (
                    <span className="tabular-nums font-mono text-muted-foreground">
                      {medianKd < 1 ? medianKd.toFixed(2) : medianKd.toFixed(1)}
                    </span>
                  ) : <span className="text-muted-foreground/40">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TargetLoader({ campaignId, target }: { campaignId: string; target: Campaign['target'] }) {
  const setTarget = useCampaignStore((s) => s.setTarget)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const structureData = ev.target?.result as string
      const name = file.name
      const ext = name.split('.').pop()?.toLowerCase()
      const structureFormat: StructureFormat = ext === 'pdb' ? 'pdb' : 'cif'
      setTarget(campaignId, { name, structureData, structureFormat })
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [campaignId, setTarget])

  if (target) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-muted/30 text-xs">
        <Target size={11} className="text-primary shrink-0" />
        <span className="text-foreground truncate max-w-[120px]">{target.name}</span>
        <button
          onClick={() => setTarget(campaignId, null)}
          className="ml-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={10} />
        </button>
      </div>
    )
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdb,.cif,.mmcif" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Target size={11} />
        Load target
      </button>
    </>
  )
}

export function CampaignSummary({ campaign, candidates, metricFields }: CampaignSummaryProps) {
  const shortlist = useCampaignStore((s) => s.shortlist)
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const shortlistedCount = shortlist.filter((e) => e.campaignId === campaign.id).length

  const handleCopySummary = useCallback(() => {
    const rounds = campaign.rounds ?? []
    const expResults = campaign.experimentalResults ?? []
    const orderedCount = new Set(rounds.flatMap((r) => r.orderedCandidateIds)).size
    const hits = expResults.filter((r) => r.bindingSuccess === true).length
    const kdValues = expResults
      .filter((r) => r.kd !== undefined && r.bindingSuccess === true)
      .map((r) => r.kd!)
    const bestKd = kdValues.length > 0 ? Math.min(...kdValues) : null

    const parts: string[] = [
      `Campaign: ${campaign.name}`,
      `Source: ${SOURCE_LABELS[campaign.source] ?? campaign.source}`,
      `${candidates.length} candidates generated`,
      `${shortlistedCount} computationally shortlisted`,
    ]
    if (orderedCount > 0) parts.push(`${orderedCount} synthesized`)
    if (hits > 0) parts.push(`${hits} binding hit${hits !== 1 ? 's' : ''}`)
    if (bestKd !== null) parts.push(`Best KD: ${bestKd.toFixed(1)} nM`)
    if (rounds.length > 0) parts.push(`${rounds.length} design round${rounds.length !== 1 ? 's' : ''}`)

    void navigator.clipboard.writeText(parts.join(' · '))
    setCopied(true)
    toast('Campaign summary copied', 'success')
    setTimeout(() => setCopied(false), 2000)
  }, [campaign, candidates.length, shortlistedCount, toast])

  const withStructures = candidates.filter((c) => c.structureData).length
  const withSequences = candidates.filter((c) => c.sequence).length

  const numericFields = useMemo(() => metricFields.filter((f) => f.type === 'number'), [metricFields])

  const keyMetrics = useMemo(() => {
    const prioritized = [
      'affinity_pred_value',
      'affinity_probability_binary',
      'iptm',
      'pae_interaction',
      'scrmsd',
      'confidence_score',
      'aggregate_score',
      'plddt',
    ]
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
            <span className="text-xs px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground font-medium">
              {SOURCE_LABELS[campaign.source] ?? campaign.source}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(campaign.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Copy campaign summary to clipboard"
          >
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          <TargetLoader campaignId={campaign.id} target={campaign.target} />
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

      <RoundSummaryTable campaign={campaign} />

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
