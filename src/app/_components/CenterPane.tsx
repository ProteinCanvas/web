'use client'

import { useEffect, useState } from 'react'
import { BarChart3, FlaskConical, LayoutDashboard, TestTube2, SlidersHorizontal, Dna } from 'lucide-react'
import { useCampaignData } from '@/features/campaign-dashboard'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { EmptyState } from '@/shared/components/EmptyState'
import { GhostButton } from '@/shared/components/GhostButton'
import { TabBar } from '@/shared/components/TabBar'
import { CandidateTable, MetricPanel, DesignFunnel, CampaignSummary, CorrelationExplorer, RoundManager, ExperimentTable, RoundProgressionChart, PipelineView, EmbeddingProjection } from '@/features/campaign-dashboard'
import { ExperimentalImportDropzone } from '@/features/campaign-import'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { type CenterTab } from './constants'

interface CenterPaneProps {
  centerTab: CenterTab
  setCenterTab: (tab: CenterTab) => void
}

const TABS: { id: CenterTab; label: string; icon: React.ReactNode }[] = [
  { id: 'summary', label: 'Summary', icon: <LayoutDashboard size={13} /> },
  { id: 'candidates', label: 'Candidates', icon: <FlaskConical size={13} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={13} /> },
  { id: 'umap', label: 'UMAP', icon: <Dna size={13} /> },
  { id: 'filters', label: 'Filters', icon: <SlidersHorizontal size={13} /> },
  { id: 'experiments', label: 'Experiments', icon: <TestTube2 size={13} /> },
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
  const [showExpImport, setShowExpImport] = useState(false)

  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
    }

    const onKey = (e: KeyboardEvent) => {
      if (isInputFocused() || !campaign) return
      if (centerTab === 'filters' || centerTab === 'experiments') return
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
  }, [campaign, filteredCandidates, selectedCandidateId, setSelectedCandidateId, addToComparison, isShortlisted, addToShortlist, removeFromShortlist, centerTab])

  if (!campaign) {
    return <EmptyState message="Import a campaign to get started" className="flex-1 text-sm not-italic" />
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <TabBar tabs={TABS} active={centerTab} onChange={setCenterTab} />

      {centerTab === 'summary' && (
        <ErrorBoundary label="Summary">
          <div className="flex-1 overflow-auto p-5">
            <CampaignSummary campaign={campaign} candidates={campaign.candidates} metricFields={metricFields} />
          </div>
        </ErrorBoundary>
      )}
      {centerTab === 'candidates' && (
        <ErrorBoundary label="Candidates table">
          <div className="flex-1 overflow-hidden flex flex-col">
            <CandidateTable
              candidates={filteredCandidates}
              campaignId={campaign.id}
              metricFields={metricFields}
              className="flex-1 p-4"
            />
          </div>
        </ErrorBoundary>
      )}
      {centerTab === 'analytics' && (
        <ErrorBoundary label="Analytics">
          <div className="flex-1 overflow-hidden flex flex-col p-3">
            <MetricPanel
              candidates={filteredCandidates}
              metricFields={metricFields}
              experimentalResults={campaign.experimentalResults}
              onBrushSelection={(ids) => setBrushedCandidateIds(ids.size > 0 ? Array.from(ids) : null)}
              className="flex-1 min-h-0"
            />
          </div>
        </ErrorBoundary>
      )}
      {centerTab === 'umap' && (
        <ErrorBoundary label="UMAP">
          <div className="flex-1 overflow-hidden flex flex-col">
            <EmbeddingProjection
              candidates={filteredCandidates}
              metricFields={metricFields}
              experimentalResults={campaign.experimentalResults}
              className="flex-1 min-h-0"
            />
          </div>
        </ErrorBoundary>
      )}
      {centerTab === 'filters' && (
        <ErrorBoundary label="Filters">
          <div className="flex-1 overflow-auto p-5">
            <DesignFunnel candidates={campaign.candidates} metricFields={metricFields} />
          </div>
        </ErrorBoundary>
      )}
      {centerTab === 'experiments' && (
        <ErrorBoundary label="Experiments">
          <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <PipelineView campaign={campaign} />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase text-muted-foreground">Experimental Results</h2>
              <GhostButton
                onClick={() => setShowExpImport((v) => !v)}
                className="px-3 py-1.5"
              >
                <TestTube2 size={12} />
                {showExpImport ? 'Cancel' : 'Add results'}
              </GhostButton>
            </div>
            {showExpImport && (
              <div className="rounded-lg border border-border bg-card/40">
                <ExperimentalImportDropzone onClose={() => setShowExpImport(false)} />
              </div>
            )}
            <ExperimentTable campaign={campaign} />
            <RoundProgressionChart campaign={campaign} />
            <RoundManager campaign={campaign} />
            <CorrelationExplorer campaign={campaign} metricFields={metricFields} />
          </div>
        </ErrorBoundary>
      )}
    </div>
  )
}
