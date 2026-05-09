import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'

type ParseResult = Omit<Campaign, 'id' | 'createdAt'>

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })
}

const METRIC_RENAME: Record<string, string> = {
  total_score: 'rosetta_total',
  dG_cross: 'dG',
  'dG_cross/dSASA_int': 'dG_per_dSASA',
  dSASA_int: 'dSASA',
  hbond_sc: 'hbond_sc',
  hbond_bb_sc: 'hbond_bb',
  fa_atr: 'fa_atr',
  fa_rep: 'fa_rep',
  fa_sol: 'fa_sol',
  fa_elec: 'fa_elec',
  shape_complementarity: 'shape_complementarity',
  packstat: 'pack_stat',
}

const SKIP_COLS = new Set(['description', 'SCORE:', 'sequence'])

function parseScoreFile(text: string): { headers: string[]; rows: Record<string, number | string>[] } {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const headerLine = lines.find((l) => l.startsWith('SCORE:') && l.includes('description'))
  if (!headerLine) return { headers: [], rows: [] }

  const headers = headerLine.trim().split(/\s+/).filter((h) => !SKIP_COLS.has(h))
  const rows: Record<string, number | string>[] = []

  for (const line of lines) {
    if (!line.startsWith('SCORE:') || line.includes('description')) continue
    const parts = line.trim().split(/\s+/)
    const headerFull = headerLine.trim().split(/\s+/)
    const descIdx = headerFull.indexOf('description')

    const row: Record<string, number | string> = {}
    for (let i = 0; i < headerFull.length; i++) {
      const col = headerFull[i]
      if (col === 'SCORE:') continue
      const val = parts[i]
      if (col === 'description') {
        row['_name'] = val ?? ''
      } else if (!SKIP_COLS.has(col)) {
        const num = parseFloat(val)
        row[METRIC_RENAME[col] ?? col] = isNaN(num) ? val : num
      }
    }
    if (descIdx >= 0 && parts[descIdx]) {
      row['_name'] = parts[descIdx]
    }
    rows.push(row)
  }

  return { headers, rows }
}

export const rosettaAdapter: CampaignAdapter = {
  name: 'rosetta',
  label: 'Rosetta',

  accepts(files: File[]): boolean {
    return files.some((f) => f.name.toLowerCase().endsWith('.sc'))
  },

  async parse(files: File[]): Promise<ParseResult> {
    const scFiles = files.filter((f) => f.name.toLowerCase().endsWith('.sc'))
    const pdbFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdb'))

    const pdbMap = new Map<string, string>()
    for (const pf of pdbFiles) {
      const base = pf.name.replace(/\.pdb$/i, '')
      pdbMap.set(base, await readFileAsText(pf))
    }

    const candidates: Candidate[] = []

    for (const scFile of scFiles) {
      const text = await readFileAsText(scFile)
      const { rows } = parseScoreFile(text)

      for (const row of rows) {
        const name = String(row['_name'] ?? nanoid())
        const metrics: Record<string, number | string | boolean> = {}

        for (const [key, val] of Object.entries(row)) {
          if (key === '_name') continue
          if (typeof val === 'number') metrics[key] = val
        }

        const structureData = pdbMap.get(name) ?? pdbMap.get(name.replace(/_\d{4}$/, ''))

        candidates.push({
          id: nanoid(),
          name,
          structureData,
          structureFormat: structureData ? 'pdb' : undefined,
          metrics,
          metadata: {},
          source: 'rosetta',
        })
      }
    }

    const folderName = files[0].webkitRelativePath?.split('/')[0] ?? 'Rosetta Campaign'

    return {
      name: folderName,
      source: 'rosetta',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
