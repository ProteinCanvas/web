import type {
  EmbeddingProvider,
  EmbeddingResult,
  EmbeddingProgress,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './types'

export class BrowserEmbeddingProvider implements EmbeddingProvider {
  private worker: Worker | null = null
  private runIdCounter = 0

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./esm2-worker.ts', import.meta.url))
    }
    return this.worker
  }

  async *computeEmbeddings(
    sequences: string[],
    onProgress: (p: EmbeddingProgress) => void,
    signal: AbortSignal
  ): AsyncIterable<EmbeddingResult> {
    if (signal.aborted) return

    const worker = this.ensureWorker()
    const runId = ++this.runIdCounter
    const queue: EmbeddingResult[] = []
    let done = false
    let error: Error | null = null
    let notify: (() => void) | null = null

    const onMessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      const msg = event.data
      if (msg.runId !== runId) return
      if (msg.type === 'result') {
        queue.push(msg.payload)
        notify?.()
      } else if (msg.type === 'progress') {
        onProgress(msg.payload)
      } else if (msg.type === 'done') {
        done = true
        notify?.()
      } else if (msg.type === 'error') {
        error = new Error(msg.message)
        done = true
        notify?.()
      }
    }

    const onAbort = () => {
      worker.postMessage({ type: 'cancel' } satisfies WorkerInboundMessage)
    }

    worker.addEventListener('message', onMessage)
    signal.addEventListener('abort', onAbort)

    worker.postMessage({
      type: 'compute',
      sequences,
      maxLength: 1022,
      runId,
    } satisfies WorkerInboundMessage)

    try {
      while (!done || queue.length > 0) {
        if (signal.aborted) return
        if (queue.length > 0) {
          yield queue.shift()!
          continue
        }
        await new Promise<void>((resolve) => {
          notify = resolve
        })
        notify = null
      }
      if (error) throw error
    } finally {
      worker.removeEventListener('message', onMessage)
      signal.removeEventListener('abort', onAbort)
    }
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
  }
}

let singleton: BrowserEmbeddingProvider | null = null

export function getBrowserEmbeddingProvider(): BrowserEmbeddingProvider {
  singleton ??= new BrowserEmbeddingProvider()
  return singleton
}
