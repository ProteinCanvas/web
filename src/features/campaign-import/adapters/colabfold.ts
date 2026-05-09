import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { computeDevMetrics } from '@/features/developability/lib/compute'
import { normalizePlddtArray, meanFromArray } from '@/shared/lib/pdb-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })
}

interface ColabFoldPae {
  predicted_aligned_error?: number[][]
  pae?: number[][]
  max_pae?: number
  plddt?: number[]
  ptm?: number
  iptm?: number
}

function extractPaeMatrix(data: ColabFoldPae): number[][] | undefined {
  return data.predicted_aligned_error ?? data.pae ?? undefined
}

function isColabFoldPdb(name: string): boolean {
  return /unrelaxed_rank_\d+.*\.pdb$/i.test(name) || /relaxed_rank_\d+.*\.pdb$/i.test(name)
}

function isColabFoldJson(name: string): boolean {
  return /scores_rank_\d+.*\.json$/i.test(name) || /pae_.*\.json$/i.test(name) || /_pae_.*\.json$/i.test(name)
}

function extractRankFromName(name: string): number {
  const m = name.match(/rank_(\d+)/i)
  return m ? parseInt(m[1], 10) : 0
}

function extractPrefixFromPdb(name: string): string {
  return name.replace(/_unrelaxed_rank_.*\.pdb$/i, '').replace(/_relaxed_rank_.*\.pdb$/i, '')
}

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

export const colabfoldAdapter: CampaignAdapter = {
  name: 'colabfold',
  label: 'ColabFold',

  accepts(files: File[]): boolean {
    const names = files.map((f) => f.name)
    return names.some(isColabFoldPdb) && names.some((n) => n.endsWith('.json') || n.endsWith('.a3m'))
  },

  async parse(files: File[]): Promise<ParseResult> {
    const pdbFiles = files.filter((f) => isColabFoldPdb(f.name)).sort((a, b) => {
      const ra = extractRankFromName(a.name)
      const rb = extractRankFromName(b.name)
      return ra - rb
    })

    const jsonFiles = files.filter((f) => f.name.endsWith('.json'))

    const scoresByRank = new Map<number, ColabFoldPae>()
    for (const jf of jsonFiles) {
      try {
        const text = await readFileAsText(jf)
        const data = JSON.parse(text) as ColabFoldPae
        if (data.plddt !== undefined || data.predicted_aligned_error !== undefined || data.pae !== undefined) {
          const rank = extractRankFromName(jf.name)
          scoresByRank.set(rank, data)
        }
      } catch {}
    }

    const candidates: Candidate[] = []

    for (const pdbFile of pdbFiles) {
      const rank = extractRankFromName(pdbFile.name)
      const prefix = extractPrefixFromPdb(pdbFile.name)
      const structureData = await readFileAsText(pdbFile)
      const sequence = extractSequenceFromPdb(structureData)
      const scores = scoresByRank.get(rank) ?? null

      const metrics: Record<string, number | string | boolean> = {}
      let plddtPerResidue: number[] | undefined

      if (scores) {
        if (Array.isArray(scores.plddt) && scores.plddt.length > 0) {
          const normalized = normalizePlddtArray(scores.plddt)
          plddtPerResidue = normalized
          metrics.plddt = parseFloat((meanFromArray(normalized) / 100).toFixed(3))
        }
        if (typeof scores.ptm === 'number') metrics.ptm = scores.ptm
        if (typeof scores.iptm === 'number') metrics.iptm = scores.iptm
        if (typeof scores.max_pae === 'number') metrics.max_pae = scores.max_pae
      }

      if (sequence) Object.assign(metrics, computeDevMetrics(sequence))

      const paeMatrix = scores ? extractPaeMatrix(scores) : undefined

      candidates.push({
        id: nanoid(),
        name: `${prefix}_rank${rank}`,
        sequence,
        structureData,
        structureFormat: 'pdb',
        metrics,
        metadata: { rank, prefix },
        source: 'colabfold',
        paeMatrix,
        plddtPerResidue,
      })
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'ColabFold Campaign'

    return {
      name: folderName,
      source: 'colabfold',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
