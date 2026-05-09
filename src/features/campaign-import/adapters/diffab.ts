import Papa from 'papaparse'
import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { normalizeMetricKey } from '@/shared/lib/metric-registry'
import { readFileAsText } from '../lib/file-utils'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

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

const CDR_VALUES = new Set(['H1', 'H2', 'H3', 'L1', 'L2', 'L3'])

function isDiffAbCsv(rows: Record<string, string | number | boolean>[]): boolean {
  if (rows.length === 0) return false
  const cols = Object.keys(rows[0])
  if (!cols.includes('cdr')) return false
  return rows.some((row) => CDR_VALUES.has(String(row['cdr'])))
}

const METRIC_COLUMNS = ['score', 'recovery', 'rmsd']

export const diffabAdapter: CampaignAdapter = {
  name: 'diffab',
  label: 'DiffAb',

  accepts(files: File[]): boolean {
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))
    if (csvFiles.length === 0) return false
    return csvFiles.some((f) =>
      f.name.toLowerCase().includes('result') ||
      f.name.toLowerCase().includes('diffab') ||
      f.name.toLowerCase().includes('cdr')
    )
  },

  async parse(files: File[]): Promise<ParseResult> {
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))
    const pdbFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdb'))

    const pdbMap = new Map<string, string>()
    for (const pdbFile of pdbFiles) {
      const content = await readFileAsText(pdbFile)
      const baseName = pdbFile.name.replace(/\.pdb$/i, '')
      pdbMap.set(baseName, content)
    }

    const candidates: Candidate[] = []

    for (const csvFile of csvFiles) {
      const rows = await parseCsvAsync(csvFile)
      if (!isDiffAbCsv(rows)) continue

      for (const row of rows) {
        const rawName = row['pdb_path'] ?? row['name']
        const name = typeof rawName === 'string'
          ? rawName.replace(/\.pdb$/i, '').split('/').pop() ?? nanoid()
          : nanoid()

        const metrics: Record<string, number | string | boolean> = {}
        for (const col of METRIC_COLUMNS) {
          const val = row[col]
          if (val !== undefined && val !== null && val !== '') {
            metrics[normalizeMetricKey(col)] = val
          }
        }

        const structureData = pdbMap.get(name)

        candidates.push({
          id: nanoid(),
          name,
          structureData,
          structureFormat: structureData ? 'pdb' : undefined,
          metrics,
          metadata: { cdr: row['cdr'] },
          source: 'diffab',
        })
      }
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'DiffAb Campaign'

    return {
      name: folderName,
      source: 'diffab',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
