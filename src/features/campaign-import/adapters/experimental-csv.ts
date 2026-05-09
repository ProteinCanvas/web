import Papa from 'papaparse'
import type { ExperimentalResult } from '@/shared/types'

export interface ImportReport {
  total: number
  matched: number
  unmatched: string[]
  columnMapping: Record<string, string>
  customColumns: string[]
}

export interface ExperimentalParseResult {
  results: ExperimentalResult[]
  report: ImportReport
}

export interface ExperimentalAdapter {
  accepts: (files: File[]) => boolean
  parse: (files: File[], campaignCandidateNames: string[], campaignCandidateIds: string[]) => Promise<ExperimentalParseResult>
}

const KD_KEYS = ['kd', 'kd_nm', 'binding_affinity', 'affinity_nm', 'affinity', 'kd (nm)']
const EXPRESSION_KEYS = ['expression', 'expression_rate', 'yield', 'expression_yield', 'expression_pct', 'expression (%)']
const TM_KEYS = ['tm', 'melting_temp', 'melting_temperature', 'tm_c', 'tm (°c)', 'tm (c)']
const BINDING_KEYS = ['binds', 'binding_success', 'binder', 'hit', 'active']
const ROUND_KEYS = ['round', 'round_number', 'cycle']
const NAME_KEYS = ['name', 'candidate_id', 'id', 'candidate_name', 'design', 'sample', 'sample_id']
const KON_KEYS = ['kon', 'kon_1_ms', 'on_rate', 'ka', 'ka_1_ms']
const KOFF_KEYS = ['koff', 'koff_1_s', 'off_rate', 'kd_off', 'kdis']
const SYNTHESIZED_KEYS = ['synthesized', 'synthesis_success', 'synthesis_ok']
const EXPRESSED_KEYS = ['expressed', 'expression_success', 'soluble', 'soluble_expression']

const KNOWN_KEY_GROUPS = [
  KD_KEYS, EXPRESSION_KEYS, TM_KEYS, BINDING_KEYS,
  ROUND_KEYS, NAME_KEYS, KON_KEYS, KOFF_KEYS,
  SYNTHESIZED_KEYS, EXPRESSED_KEYS,
]

function parseCsvAsync(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, string>[]),
      error: (err: Error) => reject(err),
    })
  })
}

function findColumn(keys: string[], columns: string[]): string | null {
  const lower = columns.map((c) => c.toLowerCase().trim())
  for (const k of keys) {
    const idx = lower.indexOf(k)
    if (idx !== -1) return columns[idx]
  }
  return null
}

function parseNum(v: string | undefined): number | undefined {
  if (!v || v.trim() === '' || v === 'nd' || v === 'n/a' || v === 'NA' || v === '-') return undefined
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

function parseBool(v: string | undefined): boolean | undefined {
  if (!v) return undefined
  const lower = v.toLowerCase().trim()
  if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'y') return true
  if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'n') return false
  return undefined
}

function isKnownColumn(col: string, columns: string[]): boolean {
  return KNOWN_KEY_GROUPS.some((keys) => findColumn(keys, [col]) !== null)
}

export const experimentalCsvAdapter: ExperimentalAdapter = {
  accepts(files: File[]): boolean {
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))
    return csvFiles.length === 1
  },

  async parse(files, campaignCandidateNames, campaignCandidateIds): Promise<ExperimentalParseResult> {
    const csvFile = files.find((f) => f.name.toLowerCase().endsWith('.csv'))
    if (!csvFile) return { results: [], report: { total: 0, matched: 0, unmatched: [], columnMapping: {}, customColumns: [] } }

    const rows = await parseCsvAsync(csvFile)
    if (rows.length === 0) return { results: [], report: { total: 0, matched: 0, unmatched: [], columnMapping: {}, customColumns: [] } }

    const columns = Object.keys(rows[0])
    const nameCol = findColumn(NAME_KEYS, columns)
    if (!nameCol) return { results: [], report: { total: rows.length, matched: 0, unmatched: [], columnMapping: {}, customColumns: [] } }

    const kdCol = findColumn(KD_KEYS, columns)
    const expressionCol = findColumn(EXPRESSION_KEYS, columns)
    const tmCol = findColumn(TM_KEYS, columns)
    const bindingCol = findColumn(BINDING_KEYS, columns)
    const roundCol = findColumn(ROUND_KEYS, columns)
    const konCol = findColumn(KON_KEYS, columns)
    const koffCol = findColumn(KOFF_KEYS, columns)
    const synthesizedCol = findColumn(SYNTHESIZED_KEYS, columns)
    const expressedCol = findColumn(EXPRESSED_KEYS, columns)

    const mappedCols = new Set(
      [nameCol, kdCol, expressionCol, tmCol, bindingCol, roundCol, konCol, koffCol, synthesizedCol, expressedCol]
        .filter((c): c is string => c !== null)
    )

    const customCols = columns.filter((col) => {
      if (mappedCols.has(col)) return false
      const firstNumericVal = rows.find((r) => r[col] !== undefined && r[col].trim() !== '')
      if (!firstNumericVal) return false
      const n = parseFloat(firstNumericVal[col])
      return !isNaN(n)
    })

    const columnMapping: Record<string, string> = {}
    if (kdCol) columnMapping[kdCol] = 'kd'
    if (expressionCol) columnMapping[expressionCol] = 'expressionRate'
    if (tmCol) columnMapping[tmCol] = 'tm'
    if (bindingCol) columnMapping[bindingCol] = 'bindingSuccess'
    if (konCol) columnMapping[konCol] = 'kon'
    if (koffCol) columnMapping[koffCol] = 'koff'
    if (synthesizedCol) columnMapping[synthesizedCol] = 'synthesized'
    if (expressedCol) columnMapping[expressedCol] = 'expressed'
    for (const col of customCols) columnMapping[col] = col

    const nameToId = new Map<string, string>()
    campaignCandidateNames.forEach((name, i) => nameToId.set(name, campaignCandidateIds[i]))

    const results: ExperimentalResult[] = []
    const unmatched: string[] = []

    for (const row of rows) {
      const rowName = row[nameCol]?.trim()
      if (!rowName) continue
      const candidateId = nameToId.get(rowName)
      if (!candidateId) {
        if (unmatched.length < 20) unmatched.push(rowName)
        continue
      }

      const round = roundCol ? (parseInt(row[roundCol], 10) || 1) : 1

      const customMetrics: Record<string, number> = {}
      for (const col of customCols) {
        const n = parseNum(row[col])
        if (n !== undefined) customMetrics[col] = n
      }

      const result: ExperimentalResult = {
        candidateId,
        round,
        customMetrics,
        metadata: {},
      }

      if (kdCol) result.kd = parseNum(row[kdCol])
      if (expressionCol) result.expressionRate = parseNum(row[expressionCol])
      if (tmCol) result.tm = parseNum(row[tmCol])
      if (bindingCol) result.bindingSuccess = parseBool(row[bindingCol])
      if (konCol) result.kon = parseNum(row[konCol])
      if (koffCol) result.koff = parseNum(row[koffCol])
      if (synthesizedCol) result.synthesized = parseBool(row[synthesizedCol])
      if (expressedCol) result.expressed = parseBool(row[expressedCol])

      results.push(result)
    }

    return {
      results,
      report: {
        total: rows.length,
        matched: results.length,
        unmatched,
        columnMapping,
        customColumns: customCols,
      },
    }
  },
}
