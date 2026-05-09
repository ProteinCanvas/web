'use client'

import { useMemo } from 'react'
import { useCampaignStore, getActiveCampaign } from '@/shared/store/campaignStore'
import { useViewerStore } from '@/shared/store/viewerStore'
import { inferMetricFields } from '@/shared/lib/metrics'
import { enrichWithDevMetrics } from '@/features/developability'
import type { Campaign, Candidate, MetricField } from '@/shared/types'

export function useCampaignData(): {
  campaign: Campaign | null
  candidates: Candidate[]
  filteredCandidates: Candidate[]
  metricFields: MetricField[]
} {
  const campaign = useCampaignStore(getActiveCampaign)
  const shortlist = useCampaignStore((s) => s.shortlist)
  const filters = useCampaignStore((s) => s.filters)
  const brushedCandidateIds = useViewerStore((s) => s.brushedCandidateIds)

  const enrichedCandidates = useMemo(
    () => enrichWithDevMetrics(campaign?.candidates ?? []),
    [campaign?.candidates]
  )

  const candidates = enrichedCandidates

  const metricFields = useMemo(() => inferMetricFields(candidates), [candidates])

  const filteredCandidates = useMemo(() => {
    const { searchQuery, showShortlistOnly, metricFilters } = filters
    const brushSet = brushedCandidateIds ? new Set(brushedCandidateIds) : null

    return candidates.filter((c) => {
      if (brushSet && !brushSet.has(c.id)) return false

      if (showShortlistOnly) {
        const inList = shortlist.some(
          (e) => e.candidateId === c.id && e.campaignId === campaign?.id
        )
        if (!inList) return false
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = c.name.toLowerCase().includes(q)
        const matchesId = c.id.toLowerCase().includes(q)
        const matchesSeq = c.sequence?.toLowerCase().includes(q) ?? false
        if (!matchesName && !matchesId && !matchesSeq) return false
      }

      for (const [key, range] of Object.entries(metricFilters)) {
        const raw = c.metrics[key]
        if (typeof raw !== 'number') continue
        if (range.min !== undefined && raw < range.min) return false
        if (range.max !== undefined && raw > range.max) return false
      }

      return true
    })
  }, [candidates, filters, shortlist, campaign?.id, brushedCandidateIds])

  return { campaign: campaign ?? null, candidates, filteredCandidates, metricFields }
}
