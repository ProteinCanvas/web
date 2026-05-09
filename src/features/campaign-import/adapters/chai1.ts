import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { computeDevMetrics } from '@/features/developability/lib/compute'
import { normalizePlddtArray, meanFromArray } from '@/shared/lib/pdb-utils'
import { readFileAsText } from '../lib/file-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

function extractSequenceFromCif(cifText: string): string | undefined {
  const AA3: Record<string, string> = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E',
    GLY: 'G', HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F',
    PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  }
  const residues: { seq: number; name: string }[] = []
  const seen = new Set<string>()
  for (const line of cifText.split('\n')) {
    if (!line.startsWith('ATOM')) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 9) continue
    const resName = parts[5]
    const seqNum = parts[8]
    const key = seqNum
    if (!seen.has(key)) {
      seen.add(key)
      residues.push({ seq: parseInt(seqNum, 10), name: resName })
    }
  }
  if (residues.length === 0) return undefined
  return residues.map((r) => AA3[r.name] ?? 'X').join('')
}

interface Chai1Scores {
  aggregate_score?: number
  ptm?: number
  iptm?: number
  per_residue_plddt?: number[]
  chain_iptm?: number[]
}

export const chai1Adapter: CampaignAdapter = {
  name: 'chai1',
  label: 'Chai-1',

  accepts(files: File[]): boolean {
    const names = files.map((f) => f.name.toLowerCase())
    return (
      names.some((n) => n.match(/pred\.model_idx_\d+\.cif$/) || n.match(/pred.*\.cif$/)) &&
      names.some((n) => n.match(/scores\.model_idx_\d+\.json$/) || n.match(/scores.*\.json$/))
    )
  },

  async parse(files: File[]): Promise<ParseResult> {
    const cifFiles = files
      .filter((f) => f.name.toLowerCase().endsWith('.cif'))
      .sort((a, b) => a.name.localeCompare(b.name))

    const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'))

    const scoresMap = new Map<number, Chai1Scores>()
    for (const jf of jsonFiles) {
      const match = jf.name.match(/(\d+)/)
      const idx = match ? parseInt(match[1], 10) : 0
      try {
        const text = await readFileAsText(jf)
        scoresMap.set(idx, JSON.parse(text) as Chai1Scores)
      } catch (err) { console.warn('[chai1] parse error:', err) }
    }

    const candidates: Candidate[] = []

    for (let i = 0; i < cifFiles.length; i++) {
      const cifFile = cifFiles[i]
      const base = cifFile.name.replace(/\.cif$/i, '')
      const structureData = await readFileAsText(cifFile)
      const sequence = extractSequenceFromCif(structureData)

      const scores = scoresMap.get(i) ?? scoresMap.get(0) ?? null
      const metrics: Record<string, number | string | boolean> = {}
      let plddtPerResidue: number[] | undefined

      if (scores) {
        if (typeof scores.aggregate_score === 'number') metrics.aggregate_score = scores.aggregate_score
        if (typeof scores.ptm === 'number') metrics.ptm = scores.ptm
        if (typeof scores.iptm === 'number') metrics.iptm = scores.iptm
        if (Array.isArray(scores.per_residue_plddt) && scores.per_residue_plddt.length > 0) {
          const normalized = normalizePlddtArray(scores.per_residue_plddt)
          plddtPerResidue = normalized
          metrics.plddt = parseFloat((meanFromArray(normalized) / 100).toFixed(3))
        }
        if (Array.isArray(scores.chain_iptm) && scores.chain_iptm.length > 0) {
          metrics.mean_chain_iptm = parseFloat(
            (scores.chain_iptm.reduce((a, b) => a + b, 0) / scores.chain_iptm.length).toFixed(3)
          )
        }
      }

      if (sequence) {
        Object.assign(metrics, computeDevMetrics(sequence))
      }

      candidates.push({
        id: nanoid(),
        name: base,
        sequence,
        structureData,
        structureFormat: 'cif',
        metrics,
        metadata: {},
        source: 'chai1',
        plddtPerResidue,
      })
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'Chai-1 Campaign'

    return {
      name: folderName,
      source: 'chai1',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
