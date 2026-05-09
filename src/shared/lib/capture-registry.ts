type CaptureKey = 'structure' | 'scatter' | 'distribution'

const registry = new Map<CaptureKey, () => Promise<string | null>>()

export function registerCapture(key: CaptureKey, fn: () => Promise<string | null>) {
  registry.set(key, fn)
}

export function unregisterCapture(key: CaptureKey) {
  registry.delete(key)
}

export async function capture(key: CaptureKey): Promise<string | null> {
  return registry.get(key)?.() ?? null
}
