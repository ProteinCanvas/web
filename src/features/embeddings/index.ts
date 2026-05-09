export { EmbeddingComputeButton } from './components/EmbeddingComputeButton'
export { ClusterPanel } from './components/ClusterPanel'
export { useEmbeddingComputation } from './hooks/useEmbeddingComputation'
export { useEmbeddingStore } from './store/embeddingStore'
export { kMeans, buildClusterSummaries, computeKDE, convexHull } from './lib/cluster-analysis'
export type {
  EmbeddingProvider,
  EmbeddingResult,
  EmbeddingProgress,
  EmbeddingStatus,
  ClusterAssignment,
  ClusterSummary,
} from './types'
