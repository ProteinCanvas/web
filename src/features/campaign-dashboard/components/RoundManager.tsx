'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { Plus, Check, Pencil, ChevronDown } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { nanoid } from '@/shared/lib/nanoid'
import { median, stdDev } from '@/shared/lib/metrics'
import { Modal } from '@/shared/components/Modal'
import { GhostButton } from '@/shared/components/GhostButton'
import { EmptyState } from '@/shared/components/EmptyState'
import type { Campaign, DesignRound, ExperimentalResult } from '@/shared/types'

interface Props {
  campaign: Campaign
}

interface OrderModalProps {
  round: DesignRound
  campaign: Campaign
  onClose: () => void
}

function OrderModal({ round, campaign, onClose }: OrderModalProps) {
  const markOrdered = useCampaignStore((s) => s.markOrdered)
  const shortlist = useCampaignStore((s) => s.shortlist)
  const alreadyOrdered = new Set(
    (campaign.rounds ?? []).flatMap((r) => r.orderedCandidateIds)
  )
  const shortlistedIds = new Set(
    shortlist.filter((e) => e.campaignId === campaign.id).map((e) => e.candidateId)
  )
  const eligible = campaign.candidates.filter(
    (c) => shortlistedIds.has(c.id) && !alreadyOrdered.has(c.id)
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleConfirm = () => {
    if (selected.size > 0) markOrdered(campaign.id, round.id, Array.from(selected))
    onClose()
  }

  return (
    <Modal title={`Order candidates — ${round.label}`} onClose={onClose} maxWidth="max-w-sm">
      {eligible.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          All shortlisted candidates are already ordered in a round.
        </p>
      ) : (
        <div className="overflow-y-auto p-2" style={{ maxHeight: '40vh' }}>
          {eligible.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="accent-primary"
              />
              <span className="text-xs text-foreground">{c.name}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        <button
          onClick={handleConfirm}
          disabled={selected.size === 0 && eligible.length > 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          <Check size={12} />
          Confirm
        </button>
      </div>
    </Modal>
  )
}

interface MetricSparklineProps {
  values: number[]
  campaignMean: number
  campaignStd: number
  label: string
}

function MetricSparkline({ values, campaignMean, campaignStd, label }: MetricSparklineProps) {
  if (values.length === 0) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const std = values.length > 1
    ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1))
    : 0

  const allValues = [...values, campaignMean - campaignStd, campaignMean + campaignStd]
  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const range = maxV - minV || 1

  const toX = (v: number) => Math.round(((v - minV) / range) * 100)

  const meanX = toX(mean)
  const stdLeft = Math.max(0, toX(mean - std))
  const stdRight = Math.min(100, toX(mean + std))
  const refX = toX(campaignMean)

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">{label}</span>
        <span className="text-[9px] text-foreground tabular-nums">{mean.toFixed(2)}</span>
      </div>
      <svg width="100%" height="14" viewBox="0 0 100 14" preserveAspectRatio="none">
        <rect x={stdLeft} y={4} width={Math.max(1, stdRight - stdLeft)} height={6} fill="hsl(var(--primary))" opacity={0.2} rx="1" />
        <line x1={refX} y1={2} x2={refX} y2={12} stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx={meanX} cy={7} r="3" fill="hsl(var(--primary))" />
      </svg>
    </div>
  )
}

interface RoundMetricStats {
  roundId: string
  roundLabel: string
  ordered: number
  expressionRate: number | null
  bindingHitRate: number | null
  medianKd: number | null
}

const TOP_METRICS = ['plddt', 'iptm', 'pae_interaction']

interface InlineLabelProps {
  round: DesignRound
  campaignId: string
}

function InlineLabel({ round, campaignId }: InlineLabelProps) {
  const updateRound = useCampaignStore((s) => s.updateRound)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(round.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setDraft(round.label)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== round.label) {
      updateRound(campaignId, round.id, { label: trimmed })
    }
    setEditing(false)
  }, [draft, round.label, round.id, campaignId, updateRound])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="text-xs font-semibold text-foreground bg-transparent border-b border-primary outline-none w-full"
        autoFocus
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className="flex items-center gap-1 group text-left w-full"
      title="Click to edit label"
    >
      <span className="text-xs font-semibold text-foreground">{round.label}</span>
      <Pencil size={9} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  )
}

type Strategy = NonNullable<DesignRound['strategy']>

const STRATEGY_META: Record<Strategy, { label: string; color: string }> = {
  diversity: { label: 'Diversity', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  optimization: { label: 'Optimization', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  combination: { label: 'Combination', color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  validation: { label: 'Validation', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
}
const STRATEGY_OPTIONS: Strategy[] = ['diversity', 'optimization', 'combination', 'validation']

function StrategyBadge({ round, campaignId }: { round: DesignRound; campaignId: string }) {
  const updateRound = useCampaignStore((s) => s.updateRound)
  const [open, setOpen] = useState(false)
  const current = round.strategy

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
          current ? STRATEGY_META[current].color : 'border-border text-muted-foreground hover:text-foreground'
        }`}
      >
        {current ? STRATEGY_META[current].label : 'Strategy'}
        <ChevronDown size={9} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden w-28">
          {current && (
            <button
              onClick={() => { updateRound(campaignId, round.id, { strategy: undefined }); setOpen(false) }}
              className="w-full text-left px-2.5 py-1.5 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Clear
            </button>
          )}
          {STRATEGY_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { updateRound(campaignId, round.id, { strategy: s }); setOpen(false) }}
              className={`w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${STRATEGY_META[s].color.replace('border-', 'hover:bg-').replace('/40', '/20')} hover:opacity-80`}
            >
              {STRATEGY_META[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RationaleEditor({ round, campaignId }: { round: DesignRound; campaignId: string }) {
  const updateRound = useCampaignStore((s) => s.updateRound)
  const [draft, setDraft] = useState(round.rationale ?? '')

  const commit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed !== (round.rationale ?? '')) {
      updateRound(campaignId, round.id, { rationale: trimmed || undefined })
    }
  }, [draft, round.rationale, round.id, campaignId, updateRound])

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      placeholder="Goal for this round…"
      rows={2}
      className="w-full text-[10px] bg-muted/20 border border-border/50 rounded px-2 py-1 text-muted-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/50 focus:text-foreground transition-colors"
    />
  )
}

export function RoundManager({ campaign }: Props) {
  const addRound = useCampaignStore((s) => s.addRound)
  const experimentalResults = useMemo(() => campaign.experimentalResults ?? [], [campaign.experimentalResults])
  const rounds = useMemo(() => campaign.rounds ?? [], [campaign.rounds])
  const [orderingRound, setOrderingRound] = useState<DesignRound | null>(null)

  const hitRateByRound = useMemo(() => {
    const map = new Map<string, { ordered: number; hits: number }>()
    for (const round of rounds) {
      const hits = round.orderedCandidateIds.filter((id) => {
        const result = experimentalResults.find((r) => r.candidateId === id && r.round === round.roundNumber)
        return result?.bindingSuccess === true
      }).length
      map.set(round.id, { ordered: round.orderedCandidateIds.length, hits })
    }
    return map
  }, [rounds, experimentalResults])

  const expByCandidate = useMemo(() => {
    const map = new Map<string, ExperimentalResult>()
    for (const r of experimentalResults) map.set(r.candidateId, r)
    return map
  }, [experimentalResults])

  const roundComparisonStats = useMemo((): RoundMetricStats[] => {
    if (rounds.length < 2 || experimentalResults.length === 0) return []
    return rounds.map((round) => {
      const ids = round.orderedCandidateIds
      const results = ids.flatMap((id) => {
        const r = expByCandidate.get(id)
        return r ? [r] : []
      })
      const expressed = results.filter((r) => (r.expressionRate ?? 0) > 0.3)
      const expressionRate = results.length > 0 ? expressed.length / results.length : null
      const bound = results.filter((r) => r.bindingSuccess === true)
      const bindingHitRate = results.length > 0 ? bound.length / results.length : null
      const kdValues = bound.flatMap((r) => r.kd !== undefined ? [r.kd] : [])
      const medianKd = median(kdValues)
      return {
        roundId: round.id,
        roundLabel: round.label,
        ordered: ids.length,
        expressionRate,
        bindingHitRate,
        medianKd,
      }
    })
  }, [rounds, experimentalResults, expByCandidate])

  const campaignMetricStats = useMemo(() => {
    const result: Record<string, { mean: number; std: number }> = {}
    for (const key of TOP_METRICS) {
      const values = campaign.candidates.flatMap((c) => {
        const v = c.metrics[key]
        return typeof v === 'number' ? [v] : []
      })
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length
        result[key] = { mean, std: stdDev(values) }
      }
    }
    return result
  }, [campaign.candidates])

  const roundMetricValues = useMemo(() => {
    const map = new Map<string, Record<string, number[]>>()
    for (const round of rounds) {
      const byMetric: Record<string, number[]> = {}
      for (const key of TOP_METRICS) {
        const vals = round.orderedCandidateIds.flatMap((id) => {
          const c = campaign.candidates.find((x) => x.id === id)
          if (!c) return []
          const v = c.metrics[key]
          return typeof v === 'number' ? [v] : []
        })
        if (vals.length > 0) byMetric[key] = vals
      }
      map.set(round.id, byMetric)
    }
    return map
  }, [rounds, campaign.candidates])

  const handleAddRound = () => {
    const roundNumber = rounds.length + 1
    addRound(campaign.id, {
      id: nanoid(),
      roundNumber,
      label: `Round ${roundNumber}`,
      createdAt: new Date().toISOString(),
      orderedCandidateIds: [],
    })
  }

  const metricsAvailable = TOP_METRICS.filter((k) => k in campaignMetricStats)

  const fmt = (v: number | null, unit = '', decimals = 1) =>
    v === null ? '—' : `${v.toFixed(decimals)}${unit}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Design Rounds</h3>
        <GhostButton onClick={handleAddRound}>
          <Plus size={12} />
          New round
        </GhostButton>
      </div>

      {rounds.length === 0 ? (
        <EmptyState message="No rounds yet. Create a round to track which candidates were synthesized and tested." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {rounds.map((round) => {
            const stats = hitRateByRound.get(round.id)
            const hitRate = stats && stats.ordered > 0 ? stats.hits / stats.ordered : null
            const metricVals = roundMetricValues.get(round.id) ?? {}
            return (
              <div
                key={round.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3 min-w-[160px] shrink-0"
              >
                <div className="flex items-start justify-between gap-1">
                  <InlineLabel round={round} campaignId={campaign.id} />
                  <StrategyBadge round={round} campaignId={campaign.id} />
                </div>
                <RationaleEditor round={round} campaignId={campaign.id} />
                <div className="text-xs text-muted-foreground">
                  {round.orderedCandidateIds.length} ordered
                </div>
                {hitRate !== null && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Hit rate</span>
                      <span className="text-[10px] font-medium text-foreground">
                        {stats!.hits}/{stats!.ordered}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-vis-teal rounded-full"
                        style={{ width: `${hitRate * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {metricsAvailable.length > 0 && round.orderedCandidateIds.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2 mt-1">
                    <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Metrics</span>
                    {metricsAvailable.map((key) => {
                      const vals = metricVals[key]
                      if (!vals || vals.length === 0) return null
                      const cs = campaignMetricStats[key]
                      return (
                        <MetricSparkline
                          key={key}
                          values={vals}
                          campaignMean={cs.mean}
                          campaignStd={cs.std}
                          label={key === 'plddt' ? 'pLDDT' : key === 'iptm' ? 'ipTM' : 'iPAE'}
                        />
                      )
                    })}
                  </div>
                )}
                <button
                  onClick={() => setOrderingRound(round)}
                  className="mt-1 text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors text-left"
                >
                  + Mark ordered
                </button>
              </div>
            )
          })}
        </div>
      )}

      {roundComparisonStats.length >= 2 && (
        <div className="flex flex-col gap-2 mt-2">
          <h3 className="text-xs font-semibold text-foreground">Round comparison</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Round</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ordered</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Expression rate</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Binding hit rate</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Median KD (nM)</th>
                </tr>
              </thead>
              <tbody>
                {roundComparisonStats.map((s) => (
                  <tr key={s.roundId} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-1.5 text-foreground font-medium">{s.roundLabel}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{s.ordered}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                      {fmt(s.expressionRate !== null ? s.expressionRate * 100 : null, '%')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                      {fmt(s.bindingHitRate !== null ? s.bindingHitRate * 100 : null, '%')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                      {fmt(s.medianKd, '', 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {orderingRound && (
        <OrderModal
          round={orderingRound}
          campaign={campaign}
          onClose={() => setOrderingRound(null)}
        />
      )}
    </div>
  )
}
