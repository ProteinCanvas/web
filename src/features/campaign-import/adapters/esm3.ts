import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { normalizeMetricKey } from '@/shared/lib/metric-registry'
import { readFileAsText } from '../lib/file-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

interface FastaEntry {
  name: string
  header: string
  sequence: string
  metrics: Record<string, number>
  embedding?: number[]
}

function parseFasta(text: string): FastaEntry[] {
  const entries: FastaEntry[] = []
  const blocks = text.split(/^>/m).filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.split('\n')
    const headerLine = lines[0] ?? ''
    const sequence = lines.slice(1).join('').replace(/\s/g, '')

    const embeddingMatch = headerLine.match(/\|embedding_mean=([\d.,\-]+)/)
    let embedding: number[] | undefined
    let cleanHeader = headerLine

    if (embeddingMatch) {
      embedding = embeddingMatch[1].split(',').map(Number)
      cleanHeader = headerLine.slice(0, embeddingMatch.index ?? headerLine.length).trim()
    }

    const name = cleanHeader.split(/\s+/)[0] ?? nanoid()

    const metrics: Record<string, number> = {}
    const metricPattern = /(\w+)=([\-\d.]+)/g
    let match: RegExpExecArray | null
    while ((match = metricPattern.exec(cleanHeader)) !== null) {
      const key = match[1]
      const val = parseFloat(match[2])
      if (!isNaN(val) && key !== name) {
        metrics[normalizeMetricKey(key)] = val
      }
    }

    entries.push({ name, header: headerLine, sequence, metrics, embedding })
  }

  return entries
}

export const esm3Adapter: CampaignAdapter = {
  name: 'esm3',
  label: 'ESM3',

  accepts(files: File[]): boolean {
    const fastaFiles = files.filter((f) => /\.(fa|fasta)$/i.test(f.name))
    if (fastaFiles.length === 0) return false
    return fastaFiles.some((f) => f.name.toLowerCase().includes('esm'))
  },

  async parse(files: File[]): Promise<ParseResult> {
    const fastaFiles = files.filter((f) => /\.(fa|fasta)$/i.test(f.name))

    const candidates: Candidate[] = []

    for (const fastaFile of fastaFiles) {
      const text = await readFileAsText(fastaFile)
      const entries = parseFasta(text)

      for (const entry of entries) {
        candidates.push({
          id: nanoid(),
          name: entry.name,
          sequence: entry.sequence || undefined,
          metrics: entry.metrics,
          metadata: {},
          source: 'esm3',
          embedding: entry.embedding,
        })
      }
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'ESM3 Campaign'

    return {
      name: folderName,
      source: 'esm3',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
