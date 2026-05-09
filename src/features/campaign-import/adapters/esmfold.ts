import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { computeDevMetrics } from '@/features/developability/lib/compute'
import { extractBFactorsFromPdb, normalizePlddtArray, meanFromArray } from '@/shared/lib/pdb-utils'
import { readFileAsText } from '../lib/file-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

function extractSequenceFromPdb(pdbText: string): string | undefined {
  const AA3: Record<string, string> = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E',
    GLY: 'G', HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F',
    PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  }
  const residues: { chain: string; seq: number; name: string }[] = []
  const seen = new Set<string>()
  for (const line of pdbText.split('\n')) {
    if (!line.startsWith('ATOM')) continue
    const chain = line[21]
    const seqNum = parseInt(line.slice(22, 26).trim(), 10)
    const resName = line.slice(17, 20).trim()
    const key = `${chain}:${seqNum}`
    if (!seen.has(key)) {
      seen.add(key)
      residues.push({ chain, seq: seqNum, name: resName })
    }
  }
  if (residues.length === 0) return undefined
  return residues.map((r) => AA3[r.name] ?? 'X').join('')
}


interface EsmFoldJson {
  mean_plddt?: number
  ptm?: number
  plddt?: number[] | number
  predicted_aligned_error?: number[][]
}

function isEsmFoldJson(data: unknown): data is EsmFoldJson {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return 'mean_plddt' in d || ('plddt' in d && !('confidence_score' in d) && !('predictions' in d))
}

export const esmfoldAdapter: CampaignAdapter = {
  name: 'esmfold',
  label: 'ESMFold',

  accepts(files: File[]): boolean {
    const names = files.map((f) => f.name.toLowerCase())
    const hasPdb = names.some((n) => n.endsWith('.pdb'))
    const hasEsmJson = files.some((f) => {
      const lower = f.name.toLowerCase()
      if (!lower.endsWith('.json')) return false
      return lower.includes('esmfold') || lower.includes('esm') || lower.includes('plddt') || lower.includes('mean_plddt')
    })
    const hasEsmLog = names.some((n) => n.endsWith('.log') || n.endsWith('.txt'))
    if (!hasPdb) return false
    const hasRankedPdb = names.some((n) => n.match(/^ranked_\d+\.pdb$/))
    const hasColabFoldPdb = names.some((n) => /unrelaxed_rank_\d+/.test(n))
    if (hasRankedPdb || hasColabFoldPdb) return false
    return hasEsmJson || hasEsmLog || (!names.some((n) => n.endsWith('.csv')) && !names.some((n) => n.endsWith('.sc')))
  },

  async parse(files: File[]): Promise<ParseResult> {
    const pdbFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdb'))
    const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'))

    const scoresByBase = new Map<string, EsmFoldJson>()
    for (const jf of jsonFiles) {
      try {
        const text = await readFileAsText(jf)
        const data = JSON.parse(text) as unknown
        if (isEsmFoldJson(data)) {
          const base = jf.name.replace(/\.json$/i, '')
          scoresByBase.set(base, data)
        }
      } catch (err) { console.warn('[esmfold] parse error:', err) }
    }

    const candidates: Candidate[] = []

    for (const pdbFile of pdbFiles) {
      const base = pdbFile.name.replace(/\.pdb$/i, '')
      const structureData = await readFileAsText(pdbFile)
      const sequence = extractSequenceFromPdb(structureData)
      const scores = scoresByBase.get(base) ?? null

      const metrics: Record<string, number | string | boolean> = {}
      let plddtPerResidue: number[] | undefined

      if (scores?.mean_plddt !== undefined) {
        const v = scores.mean_plddt
        metrics.plddt = v > 2 ? parseFloat((v / 100).toFixed(3)) : v
      } else if (scores?.plddt !== undefined) {
        if (Array.isArray(scores.plddt)) {
          const normalized = normalizePlddtArray(scores.plddt)
          plddtPerResidue = normalized
          metrics.plddt = parseFloat((meanFromArray(normalized) / 100).toFixed(3))
        } else if (typeof scores.plddt === 'number') {
          metrics.plddt = scores.plddt > 2 ? parseFloat((scores.plddt / 100).toFixed(3)) : scores.plddt
        }
      } else {
        const bfactors = extractBFactorsFromPdb(structureData)
        if (bfactors.length > 0) {
          const normalized = normalizePlddtArray(bfactors)
          plddtPerResidue = normalized
          metrics.plddt = parseFloat((meanFromArray(normalized) / 100).toFixed(3))
        }
      }

      if (scores?.ptm !== undefined) metrics.ptm = scores.ptm

      if (sequence) Object.assign(metrics, computeDevMetrics(sequence))

      const paeMatrix = scores?.predicted_aligned_error ?? undefined

      candidates.push({
        id: nanoid(),
        name: base,
        sequence,
        structureData,
        structureFormat: 'pdb',
        metrics,
        metadata: {},
        source: 'esmfold',
        paeMatrix,
        plddtPerResidue,
      })
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'ESMFold Campaign'

    return {
      name: folderName,
      source: 'esmfold',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
