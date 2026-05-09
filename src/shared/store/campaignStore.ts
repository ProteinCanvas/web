'use client'

import { create } from 'zustand'
import { nanoid } from '@/shared/lib/nanoid'
import type {
  Campaign,
  ShortlistEntry,
  ProvenanceNode,
  FilterState,
  ShortlistStatus,
  TargetProtein,
  ExperimentalResult,
  DesignRound,
} from '@/shared/types'
import { saveCampaignStore, loadCampaignStore } from '@/shared/lib/indexeddb'

interface CampaignStore {
  campaigns: Campaign[]
  activeCampaignId: string | null
  shortlist: ShortlistEntry[]
  filters: FilterState
  hydrated: boolean

  hydrate: () => Promise<void>
  addCampaign: (campaign: Campaign) => void
  removeCampaign: (id: string) => void
  setActiveCampaign: (id: string | null) => void
  addProvenanceNode: (campaignId: string, node: ProvenanceNode) => void
  addToShortlist: (entry: ShortlistEntry) => void
  removeFromShortlist: (candidateId: string, campaignId: string) => void
  updateShortlistEntry: (
    candidateId: string,
    campaignId: string,
    update: Partial<Pick<ShortlistEntry, 'status' | 'notes'>>
  ) => void
  isShortlisted: (candidateId: string, campaignId: string) => boolean
  setMetricFilter: (key: string, filter: { min?: number; max?: number } | null) => void
  setSearchQuery: (query: string) => void
  setShowShortlistOnly: (value: boolean) => void
  clearFilters: () => void
  setTarget: (campaignId: string, target: TargetProtein | null) => void
  addExperimentalResults: (campaignId: string, results: ExperimentalResult[]) => void
  addRound: (campaignId: string, round: DesignRound) => void
  updateRound: (campaignId: string, roundId: string, update: Partial<Pick<DesignRound, 'label' | 'rationale' | 'strategy'>>) => void
  markOrdered: (campaignId: string, roundId: string, candidateIds: string[]) => void
  renameCampaign: (id: string, name: string) => void
  updateCandidateEmbeddings: (
    campaignId: string,
    updates: ReadonlyArray<{ candidateId: string; embedding: number[]; fitness: number }>
  ) => void
}

const defaultFilters: FilterState = {
  metricFilters: {},
  searchQuery: '',
  showShortlistOnly: false,
}

function persist(state: Pick<CampaignStore, 'campaigns' | 'activeCampaignId' | 'shortlist'>) {
  saveCampaignStore({
    campaigns: state.campaigns,
    activeCampaignId: state.activeCampaignId,
    shortlist: state.shortlist,
  }).catch((err: unknown) => console.error('Failed to persist campaign store:', err))
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  campaigns: [],
  activeCampaignId: null,
  shortlist: [],
  filters: defaultFilters,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const saved = await loadCampaignStore()
      if (saved) {
        set({
          campaigns: saved.campaigns ?? [],
          activeCampaignId: saved.activeCampaignId ?? null,
          shortlist: saved.shortlist ?? [],
          hydrated: true,
        })
      } else {
        set({ hydrated: true })
      }
    } catch {
      set({ hydrated: true })
    }
  },

  addCampaign: (campaign) => {
    set((s) => {
      const next = {
        campaigns: [...s.campaigns, campaign],
        activeCampaignId: campaign.id,
        shortlist: s.shortlist,
      }
      persist(next)
      return { campaigns: next.campaigns, activeCampaignId: next.activeCampaignId }
    })
  },

  removeCampaign: (id) => {
    set((s) => {
      const campaigns = s.campaigns.filter((c) => c.id !== id)
      const activeCampaignId =
        s.activeCampaignId === id ? (campaigns[0]?.id ?? null) : s.activeCampaignId
      const shortlist = s.shortlist.filter((e) => e.campaignId !== id)
      persist({ campaigns, activeCampaignId, shortlist })
      return { campaigns, activeCampaignId, shortlist }
    })
  },

  setActiveCampaign: (id) => {
    set((s) => {
      persist({ campaigns: s.campaigns, activeCampaignId: id, shortlist: s.shortlist })
      return { activeCampaignId: id, filters: defaultFilters }
    })
  },

  addProvenanceNode: (campaignId, node) => {
    set((s) => {
      const campaigns = s.campaigns.map((c) =>
        c.id === campaignId
          ? { ...c, provenanceNodes: [...c.provenanceNodes, node] }
          : c
      )
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },

  addToShortlist: (entry) => {
    set((s) => {
      if (s.shortlist.some((e) => e.candidateId === entry.candidateId && e.campaignId === entry.campaignId)) {
        return {}
      }
      const shortlist = [...s.shortlist, entry]
      persist({ campaigns: s.campaigns, activeCampaignId: s.activeCampaignId, shortlist })
      return { shortlist }
    })
  },

  removeFromShortlist: (candidateId, campaignId) => {
    set((s) => {
      const shortlist = s.shortlist.filter(
        (e) => !(e.candidateId === candidateId && e.campaignId === campaignId)
      )
      persist({ campaigns: s.campaigns, activeCampaignId: s.activeCampaignId, shortlist })
      return { shortlist }
    })
  },

  updateShortlistEntry: (candidateId, campaignId, update) => {
    set((s) => {
      const shortlist = s.shortlist.map((e) =>
        e.candidateId === candidateId && e.campaignId === campaignId
          ? { ...e, ...update }
          : e
      )
      persist({ campaigns: s.campaigns, activeCampaignId: s.activeCampaignId, shortlist })
      return { shortlist }
    })
  },

  isShortlisted: (candidateId, campaignId) => {
    return get().shortlist.some(
      (e) => e.candidateId === candidateId && e.campaignId === campaignId
    )
  },

  setMetricFilter: (key, filter) => {
    set((s) => ({
      filters: {
        ...s.filters,
        metricFilters: filter
          ? { ...s.filters.metricFilters, [key]: filter }
          : Object.fromEntries(
              Object.entries(s.filters.metricFilters).filter(([k]) => k !== key)
            ),
      },
    }))
  },

  setSearchQuery: (query) => {
    set((s) => ({ filters: { ...s.filters, searchQuery: query } }))
  },

  setShowShortlistOnly: (value) => {
    set((s) => ({ filters: { ...s.filters, showShortlistOnly: value } }))
  },

  clearFilters: () => {
    set({ filters: defaultFilters })
  },

  setTarget: (campaignId, target) => {
    set((s) => {
      const campaigns = s.campaigns.map((c) =>
        c.id === campaignId
          ? { ...c, target: target ?? undefined }
          : c
      )
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },

  addExperimentalResults: (campaignId, results) => {
    set((s) => {
      const campaigns = s.campaigns.map((c) => {
        if (c.id !== campaignId) return c
        const existing = c.experimentalResults ?? []
        const existingIds = new Set(existing.map((r) => `${r.candidateId}:${r.round}`))
        const merged = [
          ...existing,
          ...results.filter((r) => !existingIds.has(`${r.candidateId}:${r.round}`)),
        ]
        return { ...c, experimentalResults: merged }
      })
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },

  addRound: (campaignId, round) => {
    set((s) => {
      const campaigns = s.campaigns.map((c) =>
        c.id === campaignId
          ? { ...c, rounds: [...(c.rounds ?? []), round] }
          : c
      )
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },

  updateRound: (campaignId, roundId, update) => {
    set((s) => {
      const campaigns = s.campaigns.map((c) => {
        if (c.id !== campaignId) return c
        const rounds = (c.rounds ?? []).map((r) => r.id === roundId ? { ...r, ...update } : r)
        return { ...c, rounds }
      })
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },

  markOrdered: (campaignId, roundId, candidateIds) => {
    set((s) => {
      const campaigns = s.campaigns.map((c) => {
        if (c.id !== campaignId) return c
        const rounds = (c.rounds ?? []).map((r) => {
          if (r.id !== roundId) return r
          const existing = new Set(r.orderedCandidateIds)
          candidateIds.forEach((id) => existing.add(id))
          return { ...r, orderedCandidateIds: Array.from(existing) }
        })
        return { ...c, rounds }
      })
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },

  renameCampaign: (id, name) => {
    set((s) => {
      if (s.campaigns.find((c) => c.id === id)?.name === name) return {}
      const campaigns = s.campaigns.map((c) =>
        c.id === id ? { ...c, name } : c
      )
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },

  updateCandidateEmbeddings: (campaignId, updates) => {
    set((s) => {
      const updateMap = new Map(updates.map((u) => [u.candidateId, u]))
      const campaigns = s.campaigns.map((c) => {
        if (c.id !== campaignId) return c
        const candidates = c.candidates.map((cand) => {
          const u = updateMap.get(cand.id)
          if (!u) return cand
          return {
            ...cand,
            embedding: u.embedding,
            metrics: { ...cand.metrics, esm_fitness: u.fitness },
          }
        })
        return { ...c, candidates }
      })
      persist({ campaigns, activeCampaignId: s.activeCampaignId, shortlist: s.shortlist })
      return { campaigns }
    })
  },
}))

export function getActiveCampaign(state: CampaignStore): Campaign | null {
  return state.campaigns.find((c) => c.id === state.activeCampaignId) ?? null
}
