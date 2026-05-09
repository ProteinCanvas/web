'use client'

import { create } from 'zustand'
import { nanoid } from '@/shared/lib/nanoid'
import type {
  Campaign,
  ShortlistEntry,
  ProvenanceNode,
  FilterState,
  ShortlistStatus,
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
  }).catch(console.error)
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  campaigns: [],
  activeCampaignId: null,
  shortlist: [],
  filters: defaultFilters,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
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
}))

export function getActiveCampaign(state: CampaignStore): Campaign | null {
  return state.campaigns.find((c) => c.id === state.activeCampaignId) ?? null
}
