'use client'

import { useCallback } from 'react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { useEmbeddingStore } from '../store/embeddingStore'
import { getBrowserEmbeddingProvider } from '../browser-provider'
import type { Candidate } from '@/shared/types'

let currentAbort: AbortController | null = null

export function useEmbeddingComputation() {
  const updateCandidateEmbeddings = useCampaignStore((s) => s.updateCandidateEmbeddings)
  const { setStatus, setProgress, setError } = useEmbeddingStore()

  const run = useCallback(
    async (campaignId: string, items: ReadonlyArray<{ id: string; sequence: string }>) => {
      currentAbort?.abort()
      currentAbort = new AbortController()
      const { signal } = currentAbort

      setStatus('loading')
      setProgress({ completed: 0, total: items.length, phase: 'loading_model' })
      setError(null)

      try {
        const provider = getBrowserEmbeddingProvider()
        const sequences = items.map((i) => i.sequence)

        for await (const result of provider.computeEmbeddings(sequences, setProgress, signal)) {
          if (signal.aborted) break
          const item = items[result.index]
          if (item) {
            updateCandidateEmbeddings(campaignId, [
              { candidateId: item.id, embedding: result.embedding, fitness: result.fitness },
            ])
          }
        }

        if (!signal.aborted) setStatus('done')
      } catch (err) {
        if (!signal.aborted) {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Embedding computation failed')
        }
      }
    },
    [updateCandidateEmbeddings, setStatus, setProgress, setError]
  )

  const computeAll = useCallback(
    (campaignId: string, candidates: ReadonlyArray<Candidate>) => {
      const valid = candidates.filter(
        (c): c is Candidate & { sequence: string } => typeof c.sequence === 'string' && c.sequence.length > 0
      )
      if (valid.length > 0) void run(campaignId, valid)
    },
    [run]
  )

  const computeMissing = useCallback(
    (campaignId: string, candidates: ReadonlyArray<Candidate>) => {
      const missing = candidates.filter(
        (c): c is Candidate & { sequence: string } =>
          (!c.embedding || c.embedding.length === 0) && typeof c.sequence === 'string' && c.sequence.length > 0
      )
      if (missing.length > 0) void run(campaignId, missing)
    },
    [run]
  )

  const cancel = useCallback(() => {
    currentAbort?.abort()
    setStatus('idle')
    setProgress(null)
  }, [setStatus, setProgress])

  return { computeAll, computeMissing, cancel }
}
