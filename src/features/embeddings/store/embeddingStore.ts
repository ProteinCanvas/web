'use client'

import { create } from 'zustand'
import type { EmbeddingProgress, EmbeddingStatus } from '../types'

interface EmbeddingStore {
  status: EmbeddingStatus
  progress: EmbeddingProgress | null
  error: string | null
  setStatus: (s: EmbeddingStatus) => void
  setProgress: (p: EmbeddingProgress | null) => void
  setError: (e: string | null) => void
}

export const useEmbeddingStore = create<EmbeddingStore>((set) => ({
  status: 'idle',
  progress: null,
  error: null,
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
}))
