'use client'

import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, XCircle, Minus } from 'lucide-react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { statusTextColor, statusDotColor } from '@/shared/lib/status-colors'
import type { Campaign, ExperimentalResult } from '@/shared/types'

interface Props {
  campaign: Campaign
}

type SortKey = 'name' | 'round' | 'kd' | 'tm' | 'expression' | 'binds' | string
type SortDir = 'asc' | 'desc'
type LifecycleFilter = 'all' | 'pending' | 'expressed' | 'binding'


function getLifecycleStatus(result: ExperimentalResult | null): { label: string; color: string } {
  if (!result) return { label: 'ordered', color: 'text-muted-foreground' }
  if (result.kd !== undefined) return { label: 'characterized', color: 'text-vis-teal' }
  if (result.bindingSuccess !== undefined) return { label: 'binding tested', color: 'text-green-400' }
  const expressed = result.expressed === true || (result.expressionRate !== undefined && (result.expressionRate > 1 ? result.expressionRate > 30 : result.expressionRate > 0.3))
  if (expressed) return { label: 'expressed', color: 'text-blue-400' }
  if (result.synthesized === true) return { label: 'synthesized', color: 'text-purple-400' }
  return { label: 'ordered', color: 'text-muted-foreground' }
}

function KdCell({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-muted-foreground/40">—</span>
  const color = statusTextColor(value < 10 ? 'good' : value < 100 ? 'warn' : 'bad')
  return <span className={`tabular-nums font-mono ${color}`}>{value < 1 ? value.toFixed(2) : value.toFixed(1)}</span>
}

function TmCell({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-muted-foreground/40">—</span>
  const color = statusTextColor(value >= 65 ? 'good' : value >= 50 ? 'warn' : 'neutral')
  return <span className={`tabular-nums font-mono ${color}`}>{value.toFixed(1)}</span>
}

function ExpressionCell({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-muted-foreground/40">—</span>
  const pct = value > 1 ? value : value * 100
  const color = statusDotColor(pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad')
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-muted/60 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="tabular-nums text-foreground text-xs">{pct.toFixed(0)}%</span>
    </div>
  )
}

function BindsCell({ value }: { value: boolean | undefined }) {
  if (value === true) return <CheckCircle2 size={13} className={statusTextColor('good')} />
  if (value === false) return <XCircle size={13} className="text-red-500/60" />
  return <Minus size={13} className="text-muted-foreground/30" />
}

function SortHeader({
  label, sortKey, current, dir, onClick,
}: { label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onClick: (k: SortKey) => void }) {
  const active = current === sortKey
  return (
    <th
      className="px-3 py-2 text-left font-medium text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
      onClick={() => onClick(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
      </div>
    </th>
  )
}

export function ExperimentTable({ campaign }: Props) {
  const setSelectedCandidateId = useViewerStore((s) => s.setSelectedCandidateId)
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const [sortKey, setSortKey] = useState<SortKey>('round')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [roundFilter, setRoundFilter] = useState<number | 'all'>('all')
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all')

  const candidateMap = useMemo(
    () => new Map(campaign.candidates.map((c) => [c.id, c])),
    [campaign.candidates]
  )

  const orderedSet = useMemo(() => {
    const set = new Set<string>()
    for (const round of campaign.rounds ?? []) {
      for (const id of round.orderedCandidateIds) set.add(id)
    }
    return set
  }, [campaign.rounds])

  const orderedRoundMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const round of campaign.rounds ?? []) {
      for (const id of round.orderedCandidateIds) {
        if (!map.has(id)) map.set(id, round.roundNumber)
      }
    }
    return map
  }, [campaign.rounds])

  const roundNumbers = useMemo(() => {
    const results = campaign.experimentalResults ?? []
    const set = new Set(results.map((r) => r.round))
    return Array.from(set).sort((a, b) => a - b)
  }, [campaign.experimentalResults])

  const customKeys = useMemo(() => {
    const results = campaign.experimentalResults ?? []
    const counts = new Map<string, number>()
    for (const r of results) {
      for (const k of Object.keys(r.customMetrics ?? {})) {
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k)
  }, [campaign.experimentalResults])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  type UnifiedRow = { result: ExperimentalResult | null; candidateId: string; roundNumber: number }

  const rows = useMemo((): UnifiedRow[] => {
    const experimentalResults = campaign.experimentalResults ?? []
    const expIds = new Set(experimentalResults.map((r) => r.candidateId))

    if (lifecycleFilter === 'pending') {
      const pending = Array.from(orderedSet)
        .filter((id) => !expIds.has(id))
        .filter((id) => roundFilter === 'all' || orderedRoundMap.get(id) === roundFilter)
      return pending.map((id) => ({ result: null, candidateId: id, roundNumber: orderedRoundMap.get(id) ?? 0 }))
    }

    let filtered = experimentalResults.filter((r) => {
      if (roundFilter !== 'all' && r.round !== roundFilter) return false
      if (lifecycleFilter === 'expressed') {
        const expressed = r.expressed === true || (r.expressionRate !== undefined && (r.expressionRate > 1 ? r.expressionRate > 30 : r.expressionRate > 0.3))
        if (!expressed) return false
      }
      if (lifecycleFilter === 'binding' && r.bindingSuccess !== true) return false
      return true
    })

    filtered = [...filtered].sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      if (sortKey === 'name') {
        va = candidateMap.get(a.candidateId)?.name ?? ''
        vb = candidateMap.get(b.candidateId)?.name ?? ''
      } else if (sortKey === 'round') { va = a.round; vb = b.round }
      else if (sortKey === 'kd') { va = a.kd ?? Infinity; vb = b.kd ?? Infinity }
      else if (sortKey === 'tm') { va = a.tm ?? -Infinity; vb = b.tm ?? -Infinity }
      else if (sortKey === 'expression') { va = a.expressionRate ?? -Infinity; vb = b.expressionRate ?? -Infinity }
      else if (sortKey === 'binds') { va = a.bindingSuccess === true ? 1 : 0; vb = b.bindingSuccess === true ? 1 : 0 }
      else { va = (a.customMetrics ?? {})[sortKey] ?? -Infinity; vb = (b.customMetrics ?? {})[sortKey] ?? -Infinity }

      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

    return filtered.map((r) => ({ result: r, candidateId: r.candidateId, roundNumber: r.round }))
  }, [campaign.experimentalResults, roundFilter, lifecycleFilter, sortKey, sortDir, candidateMap, orderedSet, orderedRoundMap])

  const hasOrderedCandidates = orderedSet.size > 0
  const pendingCount = useMemo(() => {
    const expIds = new Set((campaign.experimentalResults ?? []).map((r) => r.candidateId))
    return Array.from(orderedSet).filter((id) => !expIds.has(id)).length
  }, [orderedSet, campaign.experimentalResults])

  if ((campaign.experimentalResults ?? []).length === 0 && !hasOrderedCandidates) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No experimental results imported</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Import a CSV with columns: name, kd, expression, tm, binds, round — and any other numeric assay columns.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Round</span>
          <select
            value={roundFilter === 'all' ? 'all' : String(roundFilter)}
            onChange={(e) => setRoundFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
            className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
          >
            <option value="all">All rounds</option>
            {roundNumbers.map((n) => <option key={n} value={n}>Round {n}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {(['all', 'pending', 'expressed', 'binding'] as LifecycleFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setLifecycleFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                lifecycleFilter === f
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {f === 'all' ? 'All'
                : f === 'pending' ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                : f === 'expressed' ? 'Expressed'
                : 'Binding+'}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">{rows.length} records</span>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border">
              <tr>
                <SortHeader label="Candidate" sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Round" sortKey="round" current={sortKey} dir={sortDir} onClick={handleSort} />
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Expressed</th>
                <SortHeader label="KD (nM)" sortKey="kd" current={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Tm (°C)" sortKey="tm" current={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Expression" sortKey="expression" current={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Binds" sortKey="binds" current={sortKey} dir={sortDir} onClick={handleSort} />
                {customKeys.map((k) => (
                  <SortHeader key={k} label={k} sortKey={k} current={sortKey} dir={sortDir} onClick={handleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ result: r, candidateId, roundNumber }) => {
                const candidate = candidateMap.get(candidateId)
                const isSelected = selectedCandidateId === candidateId
                const { label: statusLabel, color: statusColor } = getLifecycleStatus(r)
                return (
                  <tr
                    key={`${candidateId}:${roundNumber}:${r ? 'result' : 'pending'}`}
                    onClick={() => setSelectedCandidateId(candidateId)}
                    className={`border-t border-border/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 hover:bg-primary/15' : r === null ? 'opacity-60 hover:opacity-100 hover:bg-muted/20' : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="px-3 py-2 text-foreground font-medium max-w-[160px] truncate">
                      {candidate?.name ?? candidateId}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">Round {roundNumber}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r === null ? <Minus size={13} className="text-muted-foreground/30" />
                       : r.expressed === true ? <CheckCircle2 size={13} className={statusTextColor('good')} />
                       : r.expressed === false ? <XCircle size={13} className="text-red-500/60" />
                       : r.expressionRate !== undefined ? (
                         <span className={`text-xs ${statusTextColor((r.expressionRate > 1 ? r.expressionRate > 30 : r.expressionRate > 0.3) ? 'good' : 'bad')}`}>
                           {(r.expressionRate > 1 ? r.expressionRate : r.expressionRate * 100).toFixed(0)}%
                         </span>
                       ) : <Minus size={13} className="text-muted-foreground/30" />}
                    </td>
                    <td className="px-3 py-2"><KdCell value={r?.kd} /></td>
                    <td className="px-3 py-2"><TmCell value={r?.tm} /></td>
                    <td className="px-3 py-2"><ExpressionCell value={r?.expressionRate} /></td>
                    <td className="px-3 py-2"><BindsCell value={r?.bindingSuccess} /></td>
                    {customKeys.map((k) => (
                      <td key={k} className="px-3 py-2 text-foreground tabular-nums font-mono">
                        {r && (r.customMetrics ?? {})[k] !== undefined ? (r.customMetrics ?? {})[k].toFixed(3) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
