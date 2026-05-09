'use client'

import { useMemo } from 'react'
import { Brain, X, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { Spinner } from '@/shared/components/Spinner'
import { useEmbeddingStore } from '../store/embeddingStore'
import { useEmbeddingComputation } from '../hooks/useEmbeddingComputation'
import type { Candidate } from '@/shared/types'

interface EmbeddingComputeButtonProps {
  campaignId: string
  candidates: ReadonlyArray<Candidate>
}

export function EmbeddingComputeButton({ campaignId, candidates }: EmbeddingComputeButtonProps) {
  const status = useEmbeddingStore((s) => s.status)
  const progress = useEmbeddingStore((s) => s.progress)
  const error = useEmbeddingStore((s) => s.error)
  const { computeMissing, cancel } = useEmbeddingComputation()

  const missingCount = useMemo(
    () => candidates.filter((c) => (!c.embedding || c.embedding.length === 0) && c.sequence).length,
    [candidates]
  )

  const totalWithSequence = useMemo(
    () => candidates.filter((c) => c.sequence).length,
    [candidates]
  )

  if (status === 'loading') {
    const pct =
      progress && progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0
    const label =
      progress?.phase === 'loading_model'
        ? 'Downloading model…'
        : `${progress?.completed ?? 0} / ${progress?.total ?? 0}`

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-muted/40 text-xs text-muted-foreground">
          <Spinner size="sm" />
          <span className="font-mono">{label}</span>
          {progress?.phase === 'computing' && (
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <button
          onClick={cancel}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Cancel"
        >
          <X size={11} />
        </button>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-muted/20 text-xs text-muted-foreground">
        <CheckCircle2 size={12} className="text-green-500 shrink-0" />
        <span>ESM ready</span>
        {missingCount > 0 && (
          <button
            onClick={() => computeMissing(campaignId, candidates)}
            className="ml-1 flex items-center gap-0.5 text-primary hover:underline"
            title={`${missingCount} new candidates without embeddings`}
          >
            <RotateCcw size={10} />
            {missingCount} new
          </button>
        )}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-destructive/50 bg-destructive/5 text-xs text-destructive">
          <AlertCircle size={12} className="shrink-0" />
          <span title={error ?? undefined}>{error?.slice(0, 40) ?? 'Failed'}</span>
        </div>
        <button
          onClick={() => computeMissing(campaignId, candidates)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <RotateCcw size={11} />
          Retry
        </button>
      </div>
    )
  }

  if (missingCount === 0 && totalWithSequence > 0) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-muted/20 text-xs text-muted-foreground">
        <Brain size={12} className="shrink-0" />
        <span>ESM ready</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => computeMissing(campaignId, candidates)}
      disabled={missingCount === 0}
      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors"
      title={`Compute ESM-2 embeddings for ${missingCount} candidates`}
    >
      <Brain size={12} />
      ESM embeddings
      {missingCount > 0 && (
        <span className="font-mono text-primary">({missingCount})</span>
      )}
    </button>
  )
}
