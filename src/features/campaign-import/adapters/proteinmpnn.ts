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

function isProteinMpnnHeader(header: string): boolean {
  return header.includes('score=') && !header.includes('ligand_mpnn') && !header.includes('LigandMPNN')
}

export const proteinmpnnAdapter: CampaignAdapter = {
  name: 'proteinmpnn',
  label: 'ProteinMPNN',

  accepts(files: File[]): boolean {
    return files.some((f) => {
      const lower = f.name.toLowerCase()
      return (lower.endsWith('.fasta') || lower.endsWith('.fa')) && !lower.includes('ligand')
    })
  },

  async parse(files: File[]): Promise<ParseResult> {
    const fastaFiles = files.filter((f) => {
      const lower = f.name.toLowerCase()
      return (lower.endsWith('.fasta') || lower.endsWith('.fa')) && !lower.includes('ligand')
    })

    const candidates: Candidate[] = []

    for (const fastaFile of fastaFiles) {
      const text = await readFileAsText(fastaFile)
      const entries = parseFasta(text)

      for (const entry of entries) {
        if (!isProteinMpnnHeader(entry.header)) continue

        const backboneName = entry.header.split(',')[0].trim()
        const headerMetrics = parseHeaderMetrics(entry.header)
        const sampleId = typeof headerMetrics.sample_id === 'number' ? headerMetrics.sample_id : null
        const name = sampleId !== null ? `${backboneName}_s${sampleId}` : backboneName
        const metrics = {
          ...headerMetrics,
          ...computeDevMetrics(entry.sequence),
        }

        candidates.push({
          id: nanoid(),
          name,
          sequence: entry.sequence,
          metrics,
          metadata: { rawHeader: entry.header, backboneName },
          source: 'proteinmpnn',
        })
      }
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'ProteinMPNN Campaign'

    return {
      name: folderName,
      source: 'proteinmpnn',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
