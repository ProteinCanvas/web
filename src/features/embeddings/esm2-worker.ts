import type { WorkerInboundMessage, WorkerOutboundMessage, EmbeddingResult } from './types'

const MODEL_ID = 'Xenova/esm2_t12_35M_UR50D'
const MAX_SAMPLE_POSITIONS = 25

let cancelRequested = false

type ExtractorPipeline = {
  (text: string, opts: Record<string, unknown>): Promise<{ data: Float32Array }>
}

type FillMaskEntry = { score: number; token_str: string }
type FillMaskPipeline = {
  (inputs: string[], opts: Record<string, unknown>): Promise<FillMaskEntry[][]>
  tokenizer: {
    (text: string, opts: Record<string, unknown>): Promise<{ input_ids: { data: BigInt64Array | Int32Array } }>
    mask_token: string
  }
}

let modelsPromise: Promise<{ extractor: ExtractorPipeline; filler: FillMaskPipeline }> | null = null

function loadModels(): Promise<{ extractor: ExtractorPipeline; filler: FillMaskPipeline }> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false
      env.useBrowserCache = true

      const pipelineOpts = { dtype: 'q8' } as Parameters<typeof pipeline>[2]
      const fillMaskOpts = { dtype: 'q8', top_k: 33 } as Parameters<typeof pipeline>[2]

      const [extractor, filler] = await Promise.all([
        pipeline('feature-extraction', MODEL_ID, pipelineOpts),
        pipeline('fill-mask', MODEL_ID, fillMaskOpts),
      ])

      return {
        extractor: extractor as unknown as ExtractorPipeline,
        filler: filler as unknown as FillMaskPipeline,
      }
    })()

    modelsPromise.catch(() => {
      modelsPromise = null
    })
  }
  return modelsPromise
}

function samplePositions(length: number, n: number): number[] {
  if (length <= n) return Array.from({ length }, (_, i) => i)
  const step = length / n
  return Array.from({ length: n }, (_, i) => Math.floor(i * step))
}

async function computeEmbedding(extractor: ExtractorPipeline, sequence: string): Promise<number[]> {
  const result = await extractor(sequence, { pooling: 'mean', normalize: false })
  return Array.from(result.data)
}

async function computeFitness(filler: FillMaskPipeline, sequence: string): Promise<number> {
  const maskToken = filler.tokenizer.mask_token ?? '<mask>'
  const positions = samplePositions(sequence.length, MAX_SAMPLE_POSITIONS)

  const maskedInputs = positions.map(
    (i) => sequence.slice(0, i) + maskToken + sequence.slice(i + 1)
  )

  const results = await filler(maskedInputs, { top_k: 33 })

  let total = 0
  let count = 0

  for (let j = 0; j < positions.length; j++) {
    const trueAA = sequence[positions[j]].toUpperCase()
    const prediction = results[j]?.find(
      (r) => r.token_str.trim().toUpperCase() === trueAA
    )
    if (prediction && prediction.score > 0) {
      total += Math.log(prediction.score)
      count++
    }
  }

  return count > 0 ? total / count : -5.0
}

self.addEventListener('message', (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data

  if (msg.type === 'cancel') {
    cancelRequested = true
    return
  }

  if (msg.type !== 'compute') return

  cancelRequested = false
  const { sequences, maxLength, runId } = msg

  const post = (m: WorkerOutboundMessage) => self.postMessage(m)

  post({
    type: 'progress',
    payload: { completed: 0, total: sequences.length, phase: 'loading_model' },
    runId,
  })

  loadModels()
    .then(async ({ extractor, filler }) => {
      for (let i = 0; i < sequences.length; i++) {
        if (cancelRequested) break

        const sequence = sequences[i].slice(0, maxLength)

        const embedding = await computeEmbedding(extractor, sequence)
        if (cancelRequested) break

        const fitness = await computeFitness(filler, sequence)
        if (cancelRequested) break

        const result: EmbeddingResult = { index: i, embedding, fitness }
        post({ type: 'result', payload: result, runId })
        post({
          type: 'progress',
          payload: { completed: i + 1, total: sequences.length, phase: 'computing' },
          runId,
        })
      }

      post({ type: 'done', runId })
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown worker error'
      post({ type: 'error', message, runId })
    })
})
