import Papa from 'papaparse'
import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

const RESERVED_COLUMNS = new Set(['id', 'name', 'sequence', 'pdb_id'])

function parseCsvAsync(
  file: File
): Promise<Record<string, string | number | boolean>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) =>
        resolve(
          results.data as Record<string, string | number | boolean>[]
        ),
      error: (err: Error) => reject(err),
    })
  })
}

export const genericCsvAdapter: CampaignAdapter = {
  name: 'generic-csv',
  label: 'Generic CSV',

  accepts(files: File[]): boolean {
    return files.some((f) => f.name.toLowerCase().endsWith('.csv'))
  },

  async parse(files: File[]): Promise<ParseResult> {
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))

    const allCandidates: Candidate[] = []

    for (const csvFile of csvFiles) {
      const rows = await parseCsvAsync(csvFile)

      for (const row of rows) {
        const id = row['id'] !== undefined ? String(row['id']) : nanoid()
        const name =
          row['name'] !== undefined
            ? String(row['name'])
            : `Candidate ${allCandidates.length + 1}`
        const sequence =
          row['sequence'] !== undefined ? String(row['sequence']) : undefined
        const pdbId =
          row['pdb_id'] !== undefined ? String(row['pdb_id']) : undefined

        const metrics: Record<string, number | string | boolean> = {}
        for (const [key, value] of Object.entries(row)) {
          if (RESERVED_COLUMNS.has(key)) continue
          if (value === undefined || value === null) continue
          metrics[key] = value
        }

        allCandidates.push({
          id,
          name,
          sequence,
          pdbId,
          metrics,
          metadata: {},
          source: 'generic',
        })
      }
    }

    const folderName =
      files[0].webkitRelativePath?.split('/')[0] ??
      csvFiles[0]?.name.replace(/\.csv$/i, '') ??
      'Imported Campaign'

    return {
      name: folderName,
      source: 'generic',
      candidates: allCandidates,
      metricFields: inferMetricFields(allCandidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
