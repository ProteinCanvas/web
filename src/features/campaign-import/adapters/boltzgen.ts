import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsText(file)
  })
}

interface BoltzPrediction {
  confidence_score?: number
  ptm?: number
  iptm?: number
  [key: string]: unknown
}

interface BoltzJson {
  predictions?: BoltzPrediction[]
  [key: string]: unknown
}

function isBoltzJson(obj: unknown): obj is BoltzJson {
  if (typeof obj !== 'object' || obj === null) return false
  const record = obj as Record<string, unknown>
  if ('confidence_score' in record || 'ptm' in record || 'iptm' in record) return true
  if (Array.isArray(record['predictions'])) {
    const first = (record['predictions'] as unknown[])[0]
    if (typeof first === 'object' && first !== null) {
      const p = first as Record<string, unknown>
      return 'confidence_score' in p || 'ptm' in p || 'iptm' in p
    }
  }
  return false
}

function extractPredictions(parsed: BoltzJson): BoltzPrediction[] {
  if (Array.isArray(parsed.predictions)) return parsed.predictions
  const { predictions: _p, ...rest } = parsed
  if ('confidence_score' in rest || 'ptm' in rest || 'iptm' in rest) {
    return [rest as BoltzPrediction]
  }
  return []
}

export const boltzgenAdapter: CampaignAdapter = {
  name: 'boltzgen',
  label: 'BoltzGen / Boltz-2',

  accepts(files: File[]): boolean {
    const hasCif = files.some((f) => f.name.toLowerCase().endsWith('.cif'))
    const hasJson = files.some((f) => f.name.toLowerCase().endsWith('.json'))
    return hasCif && hasJson
  },

  async parse(files: File[]): Promise<ParseResult> {
    const cifFiles = files.filter((f) => f.name.toLowerCase().endsWith('.cif'))
    const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'))

    const structureMap = new Map<string, string>()
    for (const cifFile of cifFiles) {
      const content = await readFileAsText(cifFile)
      const baseName = cifFile.name.replace(/\.cif$/i, '')
      structureMap.set(baseName, content)
    }

    let predictions: BoltzPrediction[] = []
    for (const jsonFile of jsonFiles) {
      const text = await readFileAsText(jsonFile)
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        continue
      }
      if (isBoltzJson(parsed)) {
        predictions = extractPredictions(parsed)
        break
      }
    }

    const candidates: Candidate[] = []

    const cifEntries = Array.from(structureMap.entries())

    for (let i = 0; i < cifEntries.length; i++) {
      const [baseName, content] = cifEntries[i]
      const prediction = predictions[i]

      const metrics: Record<string, number | string | boolean> = {}
      if (prediction) {
        if (prediction.confidence_score !== undefined)
          metrics['confidence_score'] = prediction.confidence_score
        if (prediction.ptm !== undefined) metrics['ptm'] = prediction.ptm
        if (prediction.iptm !== undefined) metrics['iptm'] = prediction.iptm
      }

      candidates.push({
        id: nanoid(),
        name: baseName,
        structureData: content,
        structureFormat: 'cif',
        metrics,
        metadata: {},
        source: 'boltzgen',
      })
    }

    const folderName =
      files[0].webkitRelativePath?.split('/')[0] ?? 'BoltzGen Campaign'

    return {
      name: folderName,
      source: 'boltzgen',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
