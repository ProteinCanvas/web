import Papa from 'papaparse'
import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { extractBFactorsFromPdb, normalizePlddtArray, meanFromArray } from '@/shared/lib/pdb-utils'
import { normalizeMetricKey } from '@/shared/lib/metric-registry'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

const EXCLUDED_COLUMNS = new Set(['description', 'Unnamed: 0', 'index'])

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsText(file)
  })
}

interface TrbJson {
  config?: Record<string, unknown>
  con_ref_idx0?: number[]
  con_hal_idx0?: number[]
  fixed_residues?: Record<string, number[]>
}

function parseCsvAsync(file: File): Promise<Record<string, string | number | boolean>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, string | number | boolean>[]),
      error: (err: Error) => reject(err),
    })
  })
}

function isRFdiffusionScoreCsv(rows: Record<string, string | number | boolean>[]): boolean {
  if (rows.length === 0) return false
  const cols = Object.keys(rows[0])
  return cols.includes('description') || cols.some((c) =>
    ['plddt', 'pae_interaction', 'i_pae', 'i_ptm', 'ptm', 'scrmsd', 'sctm'].includes(c.toLowerCase())
  )
}

export const rfdiffusionAdapter: CampaignAdapter = {
  name: 'rfdiffusion',
  label: 'RFdiffusion',

  accepts(files: File[]): boolean {
    const names = files.map((f) => f.name.toLowerCase())
    const hasPdb = names.some((n) => n.endsWith('.pdb'))
    const hasCsv = names.some((n) => n.endsWith('.csv'))
    if (!hasPdb || !hasCsv) return false
    const hasRankedPdb = names.some((n) => n.match(/^ranked_\d+\.pdb$/) !== null)
    const hasColabFoldPdb = names.some((n) => /unrelaxed_rank_\d+/.test(n))
    const hasBindcraftCsv = names.some((n) => n.includes('stats'))
    return !hasRankedPdb && !hasColabFoldPdb && !hasBindcraftCsv
  },

  async parse(files: File[]): Promise<ParseResult> {
    const pdbFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdb'))
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))

    const structureMap = new Map<string, string>()
    for (const pdbFile of pdbFiles) {
      const content = await readFileAsText(pdbFile)
      const baseName = pdbFile.name.replace(/\.pdb$/i, '')
      structureMap.set(baseName, content)
    }

    let csvRows: Record<string, string | number | boolean>[] = []
    let csvColumns: string[] = []

    for (const csvFile of csvFiles) {
      const rows = await parseCsvAsync(csvFile)
      if (isRFdiffusionScoreCsv(rows)) {
        csvRows = rows
        csvColumns = rows.length > 0 ? Object.keys(rows[0]) : []
        break
      }
    }

    const metricColumns = csvColumns.filter((col) => !EXCLUDED_COLUMNS.has(col))

    const trbJsonMap = new Map<string, TrbJson>()
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.trb.json')) continue
      try {
        const text = await readFileAsText(file)
        const baseName = file.name.replace(/\.trb\.json$/i, '')
        trbJsonMap.set(baseName, JSON.parse(text) as TrbJson)
      } catch {}
    }

    const candidates: Candidate[] = []

    if (csvRows.length > 0) {
      for (const row of csvRows) {
        const raw = row['description']
        const name = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : nanoid()
        const metrics: Record<string, number | string | boolean> = {}

        for (const col of metricColumns) {
          const val = row[col]
          if (val !== undefined && val !== null && val !== '') {
            metrics[normalizeMetricKey(col)] = val
          }
        }

        const structureData = structureMap.get(name)
        const trbMeta = trbJsonMap.get(name)

        let plddtPerResidue: number[] | undefined
        if (structureData && !metrics.plddt) {
          const bfactors = extractBFactorsFromPdb(structureData)
          if (bfactors.length > 0) {
            plddtPerResidue = normalizePlddtArray(bfactors)
          }
        }

        candidates.push({
          id: nanoid(),
          name,
          structureData,
          structureFormat: structureData ? 'pdb' : undefined,
          metrics,
          metadata: trbMeta ? { trb: trbMeta } : {},
          source: 'rfdiffusion',
          plddtPerResidue,
        })
      }
    } else {
      for (const [baseName, content] of Array.from(structureMap.entries())) {
        const trbMeta = trbJsonMap.get(baseName)
        const bfactors = extractBFactorsFromPdb(content)
        const plddtPerResidue = bfactors.length > 0 ? normalizePlddtArray(bfactors) : undefined
        const plddt = plddtPerResidue ? parseFloat(meanFromArray(plddtPerResidue).toFixed(3)) : undefined

        candidates.push({
          id: nanoid(),
          name: baseName,
          structureData: content,
          structureFormat: 'pdb',
          metrics: plddt !== undefined ? { plddt } : {},
          metadata: trbMeta ? { trb: trbMeta } : {},
          source: 'rfdiffusion',
          plddtPerResidue,
        })
      }
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'RFdiffusion Campaign'

    return {
      name: folderName,
      source: 'rfdiffusion',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
