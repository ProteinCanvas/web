import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { computeDevMetrics } from '@/features/developability/lib/compute'
import { extractSequenceFromCif, normalizePlddtArray, meanFromArray } from '@/shared/lib/pdb-utils'
import { readFileAsText } from '../lib/file-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

interface Af3Confidences {
  atom_plddts?: number[]
  pae?: number[][]
  ptm?: number
  iptm?: number
  contact_probs?: number[][]
  ranking_score?: number
}

function isAf3Confidences(data: unknown): data is Af3Confidences {
  if (typeof data !== 'object' || data === null) return false
  return 'atom_plddts' in (data as Record<string, unknown>)
}

function isAf3ConfidencesFile(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower === 'confidences.json' ||
    /^confidences_\d+\.json$/.test(lower) ||
    lower === 'model_confidences.json' ||
    /^model_confidences_\d+\.json$/.test(lower) ||
    /^summary_confidences.*\.json$/.test(lower)
  )
}

function extractRankFromName(name: string): number {
  const m = name.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export const alphafold3Adapter: CampaignAdapter = {
  name: 'alphafold3',
  label: 'AlphaFold3',

  accepts(files: File[]): boolean {
    const names = files.map((f) => f.name.toLowerCase())
    const hasCif = names.some((n) => n.endsWith('.cif'))
    const hasAf3Json = files.some((f) => isAf3ConfidencesFile(f.name))
    return hasCif && hasAf3Json
  },

  async parse(files: File[]): Promise<ParseResult> {
    const cifFiles = files
      .filter((f) => f.name.toLowerCase().endsWith('.cif'))
      .sort((a, b) => a.name.localeCompare(b.name))

    const confidenceFiles = files.filter((f) => isAf3ConfidencesFile(f.name))

    const confidencesByRank = new Map<number, Af3Confidences>()
    for (const jf of confidenceFiles) {
      try {
        const text = await readFileAsText(jf)
        const data = JSON.parse(text) as unknown
        if (isAf3Confidences(data)) {
          confidencesByRank.set(extractRankFromName(jf.name), data)
        }
      } catch (err) { console.warn('[alphafold3] parse error:', err) }
    }

    const candidates: Candidate[] = []

    for (let i = 0; i < cifFiles.length; i++) {
      const cifFile = cifFiles[i]
      const base = cifFile.name.replace(/\.cif$/i, '')
      const structureData = await readFileAsText(cifFile)
      const sequence = extractSequenceFromCif(structureData)

      const conf = confidencesByRank.get(i) ?? confidencesByRank.get(0) ?? null
      const metrics: Record<string, number | string | boolean> = {}
      let plddtPerResidue: number[] | undefined

      if (conf) {
        if (Array.isArray(conf.atom_plddts) && conf.atom_plddts.length > 0) {
          const normalized = normalizePlddtArray(conf.atom_plddts)
          plddtPerResidue = normalized
          metrics.plddt = parseFloat((meanFromArray(normalized) / 100).toFixed(3))
        }
        if (typeof conf.ptm === 'number') metrics.ptm = conf.ptm
        if (typeof conf.iptm === 'number') metrics.iptm = conf.iptm
        if (typeof conf.ranking_score === 'number') metrics.ranking_confidence = conf.ranking_score
      }

      if (sequence) Object.assign(metrics, computeDevMetrics(sequence))

      const paeMatrix = conf?.pae ?? undefined

      candidates.push({
        id: nanoid(),
        name: base,
        sequence,
        structureData,
        structureFormat: 'cif',
        metrics,
        metadata: {},
        source: 'alphafold3',
        paeMatrix,
        plddtPerResidue,
      })
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'AlphaFold3 Campaign'

    return {
      name: folderName,
      source: 'alphafold3',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
