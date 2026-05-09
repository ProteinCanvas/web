import { describe, it, expect } from 'vitest'
import { normalizeMetricValue, inferMetricFields } from '../metrics'
import type { Candidate } from '../../types'

describe('normalizeMetricValue', () => {
  it('maps min to 0 and max to 1', () => {
    expect(normalizeMetricValue(0, 0, 10)).toBe(0)
    expect(normalizeMetricValue(10, 0, 10)).toBe(1)
  })

  it('maps midpoint correctly', () => {
    expect(normalizeMetricValue(5, 0, 10)).toBeCloseTo(0.5)
  })

  it('returns 0 when min equals max (avoids division by zero)', () => {
    expect(normalizeMetricValue(5, 5, 5)).toBe(0)
  })

  it('can return values outside [0, 1] for out-of-range inputs', () => {
    expect(normalizeMetricValue(-5, 0, 10)).toBeCloseTo(-0.5)
    expect(normalizeMetricValue(15, 0, 10)).toBeCloseTo(1.5)
  })
})

function makeCandidate(id: string, metrics: Record<string, number | string | boolean>): Candidate {
  return { id, name: id, metrics, metadata: {}, source: 'proteinmpnn' }
}

describe('inferMetricFields', () => {
  it('returns an empty array for empty candidates', () => {
    expect(inferMetricFields([])).toEqual([])
  })

  it('infers numeric fields with correct min/max', () => {
    const candidates = [
      makeCandidate('a', { plddt: 0.85 }),
      makeCandidate('b', { plddt: 0.72 }),
    ]
    const fields = inferMetricFields(candidates)
    const plddt = fields.find((f) => f.key === 'plddt')

    expect(plddt).toBeDefined()
    expect(plddt?.type).toBe('number')
    expect(plddt?.min).toBeCloseTo(0.72)
    expect(plddt?.max).toBeCloseTo(0.85)
  })

  it('assigns a human-readable label from the metric registry', () => {
    const candidates = [makeCandidate('a', { plddt: 0.9 })]
    const fields = inferMetricFields(candidates)
    expect(fields.find((f) => f.key === 'plddt')?.label).toBe('pLDDT')
  })

  it('infers boolean fields', () => {
    const candidates = [makeCandidate('a', { is_valid: true })]
    const fields = inferMetricFields(candidates)
    expect(fields.find((f) => f.key === 'is_valid')?.type).toBe('boolean')
  })

  it('infers string fields', () => {
    const candidates = [makeCandidate('a', { tag: 'binder' })]
    const fields = inferMetricFields(candidates)
    expect(fields.find((f) => f.key === 'tag')?.type).toBe('string')
  })

  it('handles candidates with different metric keys (union)', () => {
    const candidates = [
      makeCandidate('a', { plddt: 0.9, iptm: 0.6 }),
      makeCandidate('b', { plddt: 0.8 }),
    ]
    const fields = inferMetricFields(candidates)
    expect(fields.find((f) => f.key === 'plddt')).toBeDefined()
    expect(fields.find((f) => f.key === 'iptm')).toBeDefined()
  })

  it('ignores keys with undefined/null values', () => {
    const candidates = [makeCandidate('a', {})]
    const fields = inferMetricFields(candidates)
    expect(fields).toHaveLength(0)
  })
})
