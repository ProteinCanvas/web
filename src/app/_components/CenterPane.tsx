'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Fingerprint, FlaskConical, GitMerge, Dna, ArrowLeftRight, LayoutDashboard } from 'lucide-react'
import { useCampaignData } from '@/features/campaign-dashboard'
import { CandidateTable, MetricPanel, EmbeddingProjection, CampaignComparison, DesignFunnel, CampaignSummary } from '@/features/campaign-dashboard'
import { ConstraintEditor } from '@/features/constraint-editor'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import type { ConstraintSpec } from '@/shared/types'
import { type CenterTab } from './constants'

interface CenterPaneProps {
  centerTab: CenterTab
  setCenterTab: (tab: CenterTab) => void
}

const TABS: { id: CenterTab; label: string; icon: React.ReactNode }[] = [
  { id: 'summary', label: 'Summary', icon: <LayoutDashboard size={13} /> },
  { id: 'candidates', label: 'Candidates', icon: <FlaskConical size={13} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={13} /> },
  { id: 'umap', label: 'UMAP', icon: <Fingerprint size={13} /> },
  { id: 'funnel', label: 'Funnel', icon: <GitMerge size={13} /> },
  { id: 'constraints', label: 'Constraints', icon: <Dna size={13} /> },
  { id: 'comparison', label: 'Compare', icon: <ArrowLeftRight size={13} /> },
]

export function CenterPane({ centerTab, setCenterTab }: CenterPaneProps) {
  const { campaign, filteredCandidates, metricFields } = useCampaignData()
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const setSelectedCandidateId = useViewerStore((s) => s.setSelectedCandidateId)
  const addToComparison = useViewerStore((s) => s.addToComparison)
  const isShortlisted = useCampaignStore((s) => s.isShortlisted)
  const addToShortlist = useCampaignStore((s) => s.addToShortlist)
  const removeFromShortlist = useCampaignStore((s) => s.removeFromShortlist)
  const [constraintSpec, setConstraintSpec] = useState<ConstraintSpec>({
    hotspots: [], masks: [], locks: [], motifs: [],
  })

  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
    }

    const onKey = (e: KeyboardEvent) => {
      if (isInputFocused() || !campaign) return
      const idx = filteredCandidates.findIndex((c) => c.id === selectedCandidateId)

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = filteredCandidates[Math.min(idx + 1, filteredCandidates.length - 1)]
        if (next) setSelectedCandidateId(next.id)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = filteredCandidates[Math.max(idx - 1, 0)]
        if (prev) setSelectedCandidateId(prev.id)
      } else if (e.key === 's' && selectedCandidateId && campaign) {
        if (isShortlisted(selectedCandidateId, campaign.id)) {
          removeFromShortlist(selectedCandidateId, campaign.id)
        } else {
          addToShortlist({
            candidateId: selectedCandidateId,
            campaignId: campaign.id,
            addedAt: new Date().toISOString(),
            status: 'candidate',
            notes: '',
          })
        }
      } else if (e.key === 'c' && selectedCandidateId) {
        addToComparison(selectedCandidateId)
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [campaign, filteredCandidates, selectedCandidateId, setSelectedCandidateId, addToComparison, isShortlisted, addToShortlist, removeFromShortlist])

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Import a campaign to get started
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/30 px-3 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setCenterTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t transition-colors ${
              centerTab === t.id
                ? 'text-foreground border-b-2 border-primary bg-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {centerTab === 'summary' && (
        <div className="flex-1 overflow-auto p-6">
          <CampaignSummary campaign={campaign} candidates={campaign.candidates} metricFields={metricFields} />
        </div>
      )}
      {centerTab === 'candidates' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <CandidateTable
            candidates={filteredCandidates}
            campaignId={campaign.id}
            metricFields={metricFields}
            className="flex-1 p-4"
          />
        </div>
      )}
      {centerTab === 'analytics' && (
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <MetricPanel
            candidates={filteredCandidates}
            metricFields={metricFields}
            onBrushSelection={(ids) => setBrushedCandidateIds(ids.size > 0 ? Array.from(ids) : null)}
            className="flex-1 min-h-0"
          />
        </div>
      )}
      {centerTab === 'umap' && (
        <div className="flex-1 overflow-auto p-4">
          <EmbeddingProjection candidates={filteredCandidates} metricFields={metricFields} />
        </div>
      )}
      {centerTab === 'funnel' && (
        <div className="flex-1 overflow-auto p-6">
          <DesignFunnel candidates={campaign.candidates} metricFields={metricFields} />
        </div>
      )}
      {centerTab === 'constraints' && (
        <div className="flex-1 overflow-auto p-4">
          <ConstraintEditor spec={constraintSpec} onChange={setConstraintSpec} />
        </div>
      )}
      {centerTab === 'comparison' && (
        <div className="flex-1 overflow-auto p-4">
          <CampaignComparison activeCampaign={campaign} />
        </div>
      )}
    </div>
  )
}
