'use client'

import { useState, useMemo } from 'react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import type { Campaign } from '@/shared/types'

interface PipelineStageRow {
  label: string
  description: string
  count: number
  parentCount: number
  ids: string[]
  color: string
}

export function PipelineView({ campaign }: { campaign: Campaign }) {
  const brushedCandidateIds = useViewerStore((s) => s.brushedCandidateIds)
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)
  const shortlist = useCampaignStore((s) => s.shortlist)

  const [kdThreshold, setKdThreshold] = useState(100)
  const [tmThreshold, setTmThreshold] = useState(55)

  const stages = useMemo((): PipelineStageRow[] => {
    const candidates = campaign.candidates
    const allIds = candidates.map((c) => c.id)
    const allCount = candidates.length

    const shortlistedIds = new Set(
      shortlist.filter((e) => e.campaignId === campaign.id).map((e) => e.candidateId)
    )
    const shortlistedList = allIds.filter((id) => shortlistedIds.has(id))

    const orderedIds = new Set(
      (campaign.rounds ?? []).flatMap((r) => r.orderedCandidateIds)
    )
    const orderedList = allIds.filter((id) => orderedIds.has(id))

    const expResults = campaign.experimentalResults ?? []
    const expByCandidateId = new Map<string, typeof expResults[number]>()
    for (const r of expResults) expByCandidateId.set(r.candidateId, r)

    const assayedList = allIds.filter((id) => expByCandidateId.has(id))

    const expressedList = assayedList.filter((id) => {
      const r = expByCandidateId.get(id)!
      if (r.expressed === true) return true
      if (r.expressionRate === undefined) return false
      return r.expressionRate > 1 ? r.expressionRate > 30 : r.expressionRate > 0.3
    })

    const bindingList = assayedList.filter((id) => expByCandidateId.get(id)?.bindingSuccess === true)

    const hitList = assayedList.filter((id) => {
      const r = expByCandidateId.get(id)!
      const kdOk = r.kd !== undefined ? r.kd <= kdThreshold : false
      const tmOk = r.tm !== undefined ? r.tm >= tmThreshold : true
      return kdOk && tmOk
    })

    return [
      { label: 'All designs', description: 'All imported candidates', count: allCount, parentCount: allCount, ids: allIds, color: 'bg-muted-foreground/50' },
      { label: 'Shortlisted', description: 'Selected for synthesis consideration', count: shortlistedList.length, parentCount: allCount, ids: shortlistedList, color: 'bg-amber-400/70' },
      { label: 'Ordered', description: 'Sent to synthesis (Twist/IDT)', count: orderedList.length, parentCount: allCount, ids: orderedList, color: 'bg-blue-400/70' },
      { label: 'Assayed', description: 'Has at least one experimental result', count: assayedList.length, parentCount: allCount, ids: assayedList, color: 'bg-violet-400/70' },
      { label: 'Expressed', description: 'Produced soluble protein (>30%)', count: expressedList.length, parentCount: allCount, ids: expressedList, color: 'bg-cyan-400/70' },
      { label: 'Binding+', description: 'Showed measurable binding', count: bindingList.length, parentCount: allCount, ids: bindingList, color: 'bg-green-400/70' },
      { label: 'Hit', description: `KD ≤ ${kdThreshold}nM AND Tm ≥ ${tmThreshold}°C`, count: hitList.length, parentCount: allCount, ids: hitList, color: 'bg-emerald-400' },
    ]
  }, [campaign, shortlist, kdThreshold, tmThreshold])

  const hasExpData = (campaign.experimentalResults ?? []).length > 0

  return (
    <div className="flex flex-col gap-4">
      {!hasExpData && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Import experimental results to see the full pipeline. Synthesis stages are shown from shortlist/round data.
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <span>Hit KD ≤</span>
          <input
            type="number" value={kdThreshold} min={1} max={10000}
            onChange={(e) => setKdThreshold(Number(e.target.value))}
            className="w-16 border border-border rounded px-1.5 py-0.5 bg-background font-mono text-foreground"
          />
          <span>nM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Tm ≥</span>
          <input
            type="number" value={tmThreshold} min={0} max={100}
            onChange={(e) => setTmThreshold(Number(e.target.value))}
            className="w-16 border border-border rounded px-1.5 py-0.5 bg-background font-mono text-foreground"
          />
          <span>°C</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {stages.map((stage, i) => {
          const fraction = stage.parentCount > 0 ? stage.count / stage.parentCount : 0
          const prevCount = i > 0 ? stages[i - 1].count : stage.parentCount
          const drop = prevCount > 0 ? (prevCount - stage.count) / prevCount : 0
          const brushSet = brushedCandidateIds ? new Set(brushedCandidateIds) : null
          const isActive = brushSet !== null && stage.ids.length > 0 && stage.ids.every((id) => brushSet.has(id))
          return (
            <button
              key={stage.label}
              onClick={() => setBrushedCandidateIds(isActive ? null : (stage.ids.length > 0 ? stage.ids : null))}
              className={`rounded-lg border px-4 py-3 text-left transition-colors group ${
                isActive
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-card/30 hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{stage.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{stage.description}</p>
                </div>
                <div className="flex-1 h-4 bg-muted/40 rounded overflow-hidden">
                  <div className={`h-full rounded transition-all ${stage.color}`} style={{ width: `${Math.max(fraction * 100, 0)}%` }} />
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                  <span className="text-foreground font-medium w-10 text-right">{stage.count}</span>
                  <span className="text-muted-foreground w-8 text-right">{Math.round(fraction * 100)}%</span>
                  <span className={`w-12 text-right ${drop > 0.3 ? 'text-amber-400' : drop > 0.1 ? 'text-muted-foreground/60' : 'text-muted-foreground/20'}`}>
                    {i > 0 && drop > 0.005 ? `−${Math.round(drop * 100)}%` : ''}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {brushedCandidateIds && (
        <p className="text-[10px] text-muted-foreground">
          {brushedCandidateIds.length} candidates selected — click the active stage again to clear.
        </p>
      )}
    </div>
  )
}
