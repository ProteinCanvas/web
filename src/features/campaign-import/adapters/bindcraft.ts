'use client'

import Papa from 'papaparse'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'
import { computeDevMetrics } from '@/features/developability/lib/compute'
import type { CampaignAdapter, Candidate } from '@/shared/types'

const COLUMN_MAP: Record<string, string> = {
  Average_pLDDT: 'plddt',
  Binder_Average_pLDDT: 'binder_plddt',
  Average_i_pTM: 'iptm',
  Average_pTM: 'ptm',
  Average_pAE: 'pae',
  Average_i_pAE: 'ipae',
  Average_dG: 'dG',
  'Average_dG/dSASA': 'dG_per_dSASA',
  Average_dSASA: 'dSASA',
  Average_ShapeComplementarity: 'shape_complementarity',
  Average_PackStat: 'pack_stat',
  Average_Surface_Hydrophobicity: 'surface_hydrophobicity',
  Average_Interface_Hydrophobicity: 'interface_hydrophobicity',
  Average_Interface_SASA_pct: 'interface_sasa_pct',
  'Average_Interface_SASA_%': 'interface_sasa_pct',
  Average_n_InterfaceHbonds: 'n_hbonds',
  Average_InterfaceHbondsPercentage: 'hbond_pct',
  Average_n_InterfaceUnsatHbonds: 'n_unsat_hbonds',
  Average_Binder_Energy_Score: 'binder_energy',
  Average_Unrelaxed_Clashes: 'unrelaxed_clashes',
  Average_Relaxed_Clashes: 'relaxed_clashes',
  Average_Hotspot_RMSD: 'hotspot_rmsd',
  Average_Target_RMSD: 'target_rmsd',
  MPNN_score: 'mpnn_score',
  Average_MPNN_seq_recovery: 'seq_recovery',
  MPNN_seq_recovery: 'seq_recovery',
  Helicity: 'helicity',
  Average_Interface_Helix_pct: 'interface_helix_pct',
  'Average_Interface_Helix%': 'interface_helix_pct',
  Average_Binder_Helix_pct: 'binder_helix_pct',
  'Average_Binder_Helix%': 'binder_helix_pct',
}

const BINDCRAFT_REQUIRED = ['Average_i_pTM', 'Average_pLDDT', 'Average_pAE']

function isBindCraftCsv(headers: string[]): boolean {
  return BINDCRAFT_REQUIRED.filter((col) => headers.includes(col)).length >= 2
}

function isBindCraftFile(file: File): boolean {
  return file.name === 'final_design_stats.csv' || file.name.endsWith('_stats.csv')
}

export const bindcraftAdapter: CampaignAdapter = {
  name: 'bindcraft',
  label: 'BindCraft',

  accepts(files) {
    const csvFiles = files.filter((f) => f.name.endsWith('.csv'))
    if (csvFiles.length === 0) return false
    if (csvFiles.some(isBindCraftFile)) return true
    return false
  },

  async parse(files) {
    const csvFile =
      files.find(isBindCraftFile) ??
      files.find((f) => f.name.endsWith('.csv'))

    if (!csvFile) throw new Error('No BindCraft CSV found')

    const csvText = await csvFile.text()
    const result = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })

    const rows = result.data
    if (rows.length === 0) throw new Error('BindCraft CSV is empty')

    const headers = Object.keys(rows[0])
    if (!isBindCraftCsv(headers)) {
      throw new Error('CSV does not match BindCraft format — expected Average_i_pTM and Average_pLDDT columns')
    }

    const pdbMap = new Map<string, File>()
    for (const f of files) {
      if (f.name.endsWith('.pdb')) {
        pdbMap.set(f.name.replace(/\.pdb$/i, '').toLowerCase(), f)
      }
    }

    const candidates: Candidate[] = []
    for (const row of rows) {
      const name = String(row['Design'] ?? row['design'] ?? nanoid())
      const sequence = typeof row['Sequence'] === 'string' ? row['Sequence'] : undefined
      const protocol = row['Protocol'] ?? null
      const seed = row['Seed'] ?? null
      const length = row['Length'] ?? null

      const metrics: Record<string, number | string | boolean> = {}
      for (const [col, key] of Object.entries(COLUMN_MAP)) {
        const raw = row[col]
        if (raw !== undefined && raw !== null && raw !== '') {
          const v = typeof raw === 'number' ? raw : parseFloat(String(raw))
          if (!isNaN(v)) metrics[key] = v
        }
      }
      if (sequence) {
        Object.assign(metrics, computeDevMetrics(sequence))
      }

      let structureData: string | undefined
      const pdbKey = name.toLowerCase()
      if (pdbMap.has(pdbKey)) {
        structureData = await pdbMap.get(pdbKey)!.text()
      }

      candidates.push({
        id: nanoid(),
        name,
        sequence,
        structureData,
        structureFormat: structureData ? 'pdb' : undefined,
        metrics,
        metadata: {
          ...(protocol != null && { protocol }),
          ...(seed != null && { seed }),
          ...(length != null && { length }),
        },
        source: 'bindcraft',
      })
    }

    const metricFields = inferMetricFields(candidates)
    const campaignName = csvFile.name.replace(/\.csv$/i, '').replace(/_/g, ' ')

    return {
      name: campaignName,
      source: 'bindcraft',
      candidates,
      metricFields,
      provenanceNodes: [],
      metadata: { adapter: 'BindCraft', file: csvFile.name },
    }
  },
}
