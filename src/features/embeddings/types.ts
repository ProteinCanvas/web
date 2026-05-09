export interface EmbeddingResult {
  index: number
  embedding: number[]
  fitness: number
}

export interface EmbeddingProgress {
  completed: number
  total: number
  phase: 'loading_model' | 'computing'
}

export interface EmbeddingProvider {
  computeEmbeddings(
    sequences: string[],
    onProgress: (p: EmbeddingProgress) => void,
    signal: AbortSignal
  ): AsyncIterable<EmbeddingResult>
  dispose(): void
}

export type EmbeddingStatus = 'idle' | 'loading' | 'done' | 'error'

export type WorkerInboundMessage =
  | { type: 'compute'; sequences: string[]; maxLength: number; runId: number }
  | { type: 'cancel' }

export type WorkerOutboundMessage =
  | { type: 'result'; payload: EmbeddingResult; runId: number }
  | { type: 'progress'; payload: EmbeddingProgress; runId: number }
  | { type: 'done'; runId: number }
  | { type: 'error'; message: string; runId: number }

export interface ClusterAssignment {
  candidateId: string
  clusterId: number
  umapX: number
  umapY: number
}

export interface ClusterSummary {
  clusterId: number
  candidateIds: string[]
  sequences: string[]
  centroidX: number
  centroidY: number
  bindingHitRate: number | null
}
