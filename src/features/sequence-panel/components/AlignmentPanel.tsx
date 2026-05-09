'use client'

import { useMemo, useState, useCallback } from 'react'
import { computeMSA, computeColumnStats } from '../lib/alignment'
import type { AlignmentColorMode } from '../lib/alignment'
import { AlignmentToolbar } from './AlignmentToolbar'
import { MSAGrid } from './MSAGrid'
import type { Candidate } from '@/shared/types'
import { EmptyState } from '@/shared/components/EmptyState'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'

interface AlignmentPanelProps {
  candidates: Candidate[]
  className?: string
  onCandidateClick?: (candidateId: string) => void
}

export function AlignmentPanel({ candidates, className, onCandidateClick }: AlignmentPanelProps) {
  const [colorMode, setColorMode] = useState<AlignmentColorMode>('aminoacid')

  const addToComparison = useViewerStore((s) => s.addToComparison)
  const comparisonIds = useViewerStore((s) => s.comparisonCandidateIds)
  const shortlist = useCampaignStore((s) => s.shortlist)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allCampaigns = useCampaignStore((s) => s.campaigns)

  const activeCampaign = useMemo(
    () => allCampaigns.find((c) => c.id === activeCampaignId),
    [allCampaigns, activeCampaignId]
  )

  const addableFromShortlist = useMemo(() => {
    if (!activeCampaign || !activeCampaignId) return []
    const compSet = new Set(comparisonIds)
    const shortlistedIds = new Set(
      shortlist
        .filter((e) => e.campaignId === activeCampaignId)
        .map((e) => e.candidateId)
    )
    const maxAdd = Math.max(0, 6 - comparisonIds.length)
    return activeCampaign.candidates
      .filter((c) => shortlistedIds.has(c.id) && !compSet.has(c.id) && Boolean(c.sequence))
      .slice(0, maxAdd)
  }, [activeCampaign, activeCampaignId, comparisonIds, shortlist])

  const handleLoadShortlisted = useCallback(() => {
    for (const c of addableFromShortlist) {
      addToComparison(c.id)
    }
  }, [addableFromShortlist, addToComparison])

  const sequenced = useMemo(
    () => candidates.filter((c) => c.sequence && c.sequence.length > 0),
    [candidates]
  )

  const aligned = useMemo(() => computeMSA(sequenced), [sequenced])

  const colStats = useMemo(() => computeColumnStats(aligned), [aligned])

  if (candidates.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-2 text-muted-foreground ${className ?? ''}`}>
        <p className="text-sm">No candidates in comparison</p>
        <p className="text-xs text-muted-foreground/50">Use the Compare button in the candidate header</p>
      </div>
    )
  }

  if (sequenced.length === 0) {
    return <EmptyState message="No sequences available for alignment" className={`text-sm not-italic ${className ?? ''}`} />
  }

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${className ?? ''}`}>
      <AlignmentToolbar
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        alignedLength={aligned[0]?.gapped.length ?? 0}
        numSequences={sequenced.length}
      />
      {addableFromShortlist.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 shrink-0">
          <span className="text-xs text-muted-foreground">
            {addableFromShortlist.length} shortlisted candidate{addableFromShortlist.length !== 1 ? 's' : ''} not yet in alignment
          </span>
          <button
            onClick={handleLoadShortlisted}
            className="text-xs text-primary hover:underline transition-colors"
          >
            Add all
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 bg-background">
        <MSAGrid
          candidates={sequenced}
          aligned={aligned}
          colStats={colStats}
          colorMode={colorMode}
          onCandidateClick={onCandidateClick}
        />
      </div>
    </div>
  )
}
