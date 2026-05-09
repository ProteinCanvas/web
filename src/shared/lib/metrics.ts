import { getMetricLabel } from './metric-registry'
import type { Candidate, MetricField } from '@/shared/types'

export function inferMetricFields(candidates: Candidate[]): MetricField[] {
  if (candidates.length === 0) return []

  const allKeys = new Set<string>()
  for (const c of candidates) {
    for (const key of Object.keys(c.metrics)) {
      allKeys.add(key)
    }
  }

  const fields: MetricField[] = []

  for (const key of Array.from(allKeys)) {
    const values = candidates
      .map((c) => c.metrics[key])
      .filter((v) => v !== undefined && v !== null)

    if (values.length === 0) continue

    const firstVal = values[0]

    if (typeof firstVal === 'number') {
      const nums = values.filter((v): v is number => typeof v === 'number')
      fields.push({
        key,
        label: getMetricLabel(key),
        type: 'number',
        min: Math.min(...nums),
        max: Math.max(...nums),
      })
    } else if (typeof firstVal === 'boolean') {
      fields.push({ key, label: getMetricLabel(key), type: 'boolean' })
    } else {
      fields.push({ key, label: getMetricLabel(key), type: 'string' })
    }
  }

  return fields
}

export function getNumericMetricKeys(candidates: Candidate[]): string[] {
  return inferMetricFields(candidates)
    .filter((f) => f.type === 'number')
    .map((f) => f.key)
}

export function normalizeMetricValue(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 0
  return (value - min) / (max - min)
}
