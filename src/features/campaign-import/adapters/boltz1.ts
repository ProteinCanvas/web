import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { extractBFactorsFromPdb, normalizePlddtArray, meanFromArray } from '@/shared/lib/pdb-utils'
import { normalizeMetricKey } from '@/shared/lib/metric-registry'
import { readFileAsText } from '../lib/file-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

interface Boltz1ConfidenceJson {
  confidence_score?: number
  ptm?: number
  iptm?: number
  ligand_iptm?: number
  protein_iptm?: number
  complex_plddt?: number
  chains_ptm?: Record<string, number>
  [key: string]: unknown
}

function isBoltz1ConfidenceJson(obj: unknown): obj is Boltz1ConfidenceJson {
  if (typeof obj !== 'object' || obj === null) return false
  const record = obj as Record<string, unknown>
  return 'confidence_score' in record || 'complex_plddt' in record || 'chains_ptm' in record
}

export const boltz1Adapter: CampaignAdapter = {
  name: 'boltz1',
  label: 'Boltz-1',

  accepts(files: File[]): boolean {
    const names = files.map((f) => f.name.toLowerCase())
    return names.some((n) => n.includes('confidence_boltz1'))
  },

  async parse(files: File[]): Promise<ParseResult> {
    const cifFiles = files.filter((f) => f.name.toLowerCase().endsWith('.cif'))
    const jsonFiles = files.filter((f) =>
      f.name.toLowerCase().endsWith('.json') && f.name.toLowerCase().includes('confidence_boltz1')
    )

    const structureMap = new Map<string, string>()
    for (const cifFile of cifFiles) {
      const content = await readFileAsText(cifFile)
      const baseName = cifFile.name.replace(/\.cif$/i, '')
      structureMap.set(baseName, content)
    }

    const confidenceMap = new Map<string, Boltz1ConfidenceJson>()
    for (const jsonFile of jsonFiles) {
      const text = await readFileAsText(jsonFile)
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        continue
      }
      if (isBoltz1ConfidenceJson(parsed)) {
        const designName = jsonFile.name
          .replace(/^confidence_boltz1_/i, '')
          .replace(/\.json$/i, '')
        confidenceMap.set(designName, parsed)
      }
    }

    const candidates: Candidate[] = []

    for (const [designName, confidence] of Array.from(confidenceMap.entries())) {
      const structureData = structureMap.get(designName)

      const metrics: Record<string, number | string | boolean> = {}
      for (const [key, val] of Object.entries(confidence)) {
        if (key === 'chains_ptm') continue
        if (typeof val === 'number') {
          metrics[normalizeMetricKey(key)] = val
        }
      }

      let plddtPerResidue: number[] | undefined
      if (!metrics[normalizeMetricKey('complex_plddt')] && structureData) {
        const bfactors = extractBFactorsFromPdb(structureData)
        if (bfactors.length > 0) {
          plddtPerResidue = normalizePlddtArray(bfactors)
          metrics[normalizeMetricKey('complex_plddt')] = parseFloat(meanFromArray(plddtPerResidue).toFixed(3))
        }
      }

      candidates.push({
        id: nanoid(),
        name: designName,
        structureData,
        structureFormat: structureData ? 'cif' : undefined,
        metrics,
        metadata: {},
        source: 'boltz1',
        plddtPerResidue,
      })
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'Boltz-1 Campaign'

    return {
      name: folderName,
      source: 'boltz1',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
