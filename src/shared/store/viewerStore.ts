'use client'

import { create } from 'zustand'
import type { RepresentationType, ColorScheme } from '@/shared/types'

interface ViewerStore {
  selectedCandidateId: string | null
  selectedResidues: string[]
  comparisonCandidateIds: string[]
  brushedCandidateIds: string[] | null
  requestedScrollToId: string | null
  representationType: RepresentationType
  colorScheme: ColorScheme
  isLoading: boolean
  activePanel: 'structure' | 'sequence' | 'comparison'

  setSelectedCandidateId: (id: string | null) => void
  setSelectedResidues: (residues: string[]) => void
  toggleResidueSelection: (residueId: string) => void
  clearResidueSelection: () => void
  addToComparison: (candidateId: string) => void
  removeFromComparison: (candidateId: string) => void
  clearComparison: () => void
  setBrushedCandidateIds: (ids: string[] | null) => void
  setRequestedScrollToId: (id: string | null) => void
  setRepresentationType: (type: RepresentationType) => void
  setColorScheme: (scheme: ColorScheme) => void
  setIsLoading: (loading: boolean) => void
  setActivePanel: (panel: ViewerStore['activePanel']) => void
}

export const useViewerStore = create<ViewerStore>((set, get) => ({
  selectedCandidateId: null,
  selectedResidues: [],
  comparisonCandidateIds: [],
  brushedCandidateIds: null,
  requestedScrollToId: null,
  representationType: 'cartoon',
  colorScheme: 'plddt',
  isLoading: false,
  activePanel: 'structure',

  setSelectedCandidateId: (id) => set({ selectedCandidateId: id, selectedResidues: [] }),

  setSelectedResidues: (residues) => set({ selectedResidues: residues }),

  toggleResidueSelection: (residueId) => {
    set((s) => ({
      selectedResidues: s.selectedResidues.includes(residueId)
        ? s.selectedResidues.filter((r) => r !== residueId)
        : [...s.selectedResidues, residueId],
    }))
  },

  clearResidueSelection: () => set({ selectedResidues: [] }),

  addToComparison: (candidateId) => {
    set((s) => {
      if (s.comparisonCandidateIds.includes(candidateId)) return {}
      if (s.comparisonCandidateIds.length >= 6) return {}
      return {
        comparisonCandidateIds: [...s.comparisonCandidateIds, candidateId],
        activePanel: 'comparison',
      }
    })
  },

  removeFromComparison: (candidateId) => {
    set((s) => ({
      comparisonCandidateIds: s.comparisonCandidateIds.filter((id) => id !== candidateId),
    }))
  },

  clearComparison: () => set({ comparisonCandidateIds: [], activePanel: 'structure' }),

  setBrushedCandidateIds: (ids) => set({ brushedCandidateIds: ids }),

  setRequestedScrollToId: (id) => set({ requestedScrollToId: id }),

  setRepresentationType: (type) => set({ representationType: type }),

  setColorScheme: (scheme) => set({ colorScheme: scheme }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setActivePanel: (panel) => set({ activePanel: panel }),
}))
