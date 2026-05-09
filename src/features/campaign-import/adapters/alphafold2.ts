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

function extractSequenceFromPdb(pdbText: string): string | undefined {
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
  const AA3: Record<string, string> = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E',
    GLY: 'G', HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F',
    PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  }
  return residues.map((r) => AA3[r.name] ?? 'X').join('')
}

interface AF2Scores {
  plddt?: number[]
  max_pae?: number
  ptm?: number
  iptm?: number
  pae_interaction?: number
  ranking_confidence?: number
  predicted_aligned_error?: number[][]
  pae?: number[][]
}

function extractPaeMatrix(scores: AF2Scores): number[][] | undefined {
  return scores.predicted_aligned_error ?? scores.pae ?? undefined
}

function rankIndexFromName(name: string): string {
  const m = name.match(/ranked?[_-](\d+)/i)
  return m ? m[1] : name
}

export const alphafold2Adapter: CampaignAdapter = {
  name: 'alphafold2',
  label: 'AlphaFold2',

  accepts(files: File[]): boolean {
    const names = files.map((f) => f.name.toLowerCase())
    const hasRankedPdb = names.some((n) => n.match(/^ranked_\d+\.pdb$/) || n.match(/ranked.*\.pdb$/))
    const hasScoresJson = names.some((n) => n.match(/scores.*\.json$/) || n.match(/result_model.*\.json$/) || n.match(/predicted_aligned_error.*\.json$/))
    return (hasRankedPdb || names.some((n) => n.endsWith('.pdb'))) && hasScoresJson
  },

  async parse(files: File[]): Promise<ParseResult> {
    const pdbFiles = files
      .filter((f) => f.name.toLowerCase().endsWith('.pdb'))
      .sort((a, b) => a.name.localeCompare(b.name))

    const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'))

    const scoresMap = new Map<string, AF2Scores>()

    for (const jf of jsonFiles) {
      try {
        const text = await readFileAsText(jf)
        const data = JSON.parse(text) as AF2Scores
        const base = jf.name.replace(/\.json$/i, '')
        scoresMap.set(base, data)
        const altKey = base.replace(/scores_rank_(\d+)_.*/, 'ranked_$1')
        scoresMap.set(altKey, data)
        const rankIdx = rankIndexFromName(base)
        scoresMap.set(`ranked_${rankIdx}`, data)
        scoresMap.set(`rank_${rankIdx}`, data)
      } catch {}
    }

    let globalPaeMatrix: number[][] | undefined

    for (const jf of jsonFiles) {
      if (jf.name.toLowerCase().includes('predicted_aligned_error')) {
        try {
          const text = await readFileAsText(jf)
          const data = JSON.parse(text) as { predicted_aligned_error?: number[][] }
          if (data.predicted_aligned_error) {
            globalPaeMatrix = data.predicted_aligned_error
            break
          }
        } catch {}
      }
    }

    const candidates: Candidate[] = []

    for (const pdbFile of pdbFiles) {
      const base = pdbFile.name.replace(/\.pdb$/i, '')
      const structureData = await readFileAsText(pdbFile)
      const sequence = extractSequenceFromPdb(structureData)

      const scores =
        scoresMap.get(base) ??
        scoresMap.get(base.replace('ranked_', 'scores_rank_')) ??
        null

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
        if (typeof scores.pae_interaction === 'number') metrics.pae_interaction = scores.pae_interaction
        if (typeof scores.ranking_confidence === 'number') metrics.ranking_confidence = scores.ranking_confidence
      }

      if (sequence) Object.assign(metrics, computeDevMetrics(sequence))

      const paeMatrix = (scores ? extractPaeMatrix(scores) : undefined) ?? globalPaeMatrix

      candidates.push({
        id: nanoid(),
        name: base,
        sequence,
        structureData,
        structureFormat: 'pdb',
        metrics,
        metadata: {},
        source: 'alphafold2',
        paeMatrix,
        plddtPerResidue,
      })
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'AlphaFold2 Campaign'

    return {
      name: folderName,
      source: 'alphafold2',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
