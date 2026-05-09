'use client'

import { useViewerStore } from '@/shared/store/viewerStore'

export function useInteraction() {
  const setSelectedCandidateId = useViewerStore((s) => s.setSelectedCandidateId)
  const setRequestedScrollToId = useViewerStore((s) => s.setRequestedScrollToId)
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)
  const setSelectedResidues = useViewerStore((s) => s.setSelectedResidues)
  const addToComparison = useViewerStore((s) => s.addToComparison)

  return {
    focusCandidate: (id: string) => {
      setSelectedCandidateId(id)
      setRequestedScrollToId(id)
    },
    brushCandidates: (ids: string[] | null) => {
      setBrushedCandidateIds(ids)
    },
    selectResidues: (residues: string[]) => {
      setSelectedResidues(residues)
    },
    addToComparison: (id: string) => {
      addToComparison(id)
    },
  }
}
