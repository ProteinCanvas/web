import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { computeDevMetrics } from '@/features/developability/lib/compute'
import { readFileAsText } from '../lib/file-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

interface FastaEntry {
  header: string
  sequence: string
}

function parseFasta(text: string): FastaEntry[] {
  const entries: FastaEntry[] = []
  const lines = text.split(/\r?\n/)
  let currentHeader = ''
  let seqLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('>')) {
      if (currentHeader) entries.push({ header: currentHeader, sequence: seqLines.join('') })
      currentHeader = line.slice(1).trim()
      seqLines = []
    } else if (line.trim()) {
      seqLines.push(line.trim())
    }
  }
  if (currentHeader) entries.push({ header: currentHeader, sequence: seqLines.join('') })
  return entries
}

function isLigandMpnnHeader(header: string): boolean {
  return (
    header.includes('ligand_mpnn') ||
    header.includes('LigandMPNN') ||
    (header.includes('score=') && header.includes('T='))
  )
}

function parseHeaderMetrics(header: string): Record<string, number | string | boolean> {
  const metrics: Record<string, number | string | boolean> = {}
  const patterns: [RegExp, string][] = [
    [/score=([\d.eE+\-]+)/, 'score'],
    [/global_score=([\d.eE+\-]+)/, 'global_score'],
    [/seq_recovery=([\d.eE+\-]+)/, 'seq_recovery'],
    [/T=([\d.eE+\-]+)/, 'temperature'],
    [/sample=(\d+)/, 'sample_id'],
  ]
  for (const [pattern, key] of patterns) {
    const m = header.match(pattern)
    if (m) metrics[key] = parseFloat(m[1])
  }
  return metrics
}

export const ligandmpnnAdapter: CampaignAdapter = {
  name: 'ligandmpnn',
  label: 'LigandMPNN',

  accepts(files: File[]): boolean {
    const fastaFiles = files.filter((f) => {
      const lower = f.name.toLowerCase()
      return lower.endsWith('.fasta') || lower.endsWith('.fa')
    })
    if (fastaFiles.length === 0) return false
    return fastaFiles.some((f) => f.name.toLowerCase().includes('ligand'))
  },

  async parse(files: File[]): Promise<ParseResult> {
    const fastaFiles = files.filter((f) => {
      const lower = f.name.toLowerCase()
      return lower.endsWith('.fasta') || lower.endsWith('.fa')
    })

    const candidates: Candidate[] = []

    for (const fastaFile of fastaFiles) {
      const text = await readFileAsText(fastaFile)
      const entries = parseFasta(text)

      for (const entry of entries) {
        const namePart = entry.header.split(',')[0].trim()
        const metrics = {
          ...parseHeaderMetrics(entry.header),
          ...computeDevMetrics(entry.sequence),
        }

        candidates.push({
          id: nanoid(),
          name: namePart,
          sequence: entry.sequence,
          metrics,
          metadata: { rawHeader: entry.header },
          source: 'ligandmpnn',
        })
      }
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'LigandMPNN Campaign'

    return {
      name: folderName,
      source: 'ligandmpnn',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
