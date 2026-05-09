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
        min: nums.reduce((a, b) => Math.min(a, b), Infinity),
        max: nums.reduce((a, b) => Math.max(a, b), -Infinity),
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

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length)
}

export function normalizeExpressionRate(rate: number): number {
  return rate > 1 ? rate : rate * 100
}

export function isHighExpression(rate: number): boolean {
  return rate > 1 ? rate > 30 : rate > 0.3
}
