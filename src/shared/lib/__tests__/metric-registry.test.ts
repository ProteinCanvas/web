import { describe, it, expect } from 'vitest'
import {
  normalizeMetricKey,
  getMetricMeta,
  getMetricLabel,
  getMetricDirection,
  getMetricGoodThreshold,
} from '../metric-registry'

describe('normalizeMetricKey', () => {
  it('maps i_ptm → iptm', () => {
    expect(normalizeMetricKey('i_ptm')).toBe('iptm')
  })
  it('maps i_pae → pae_interaction', () => {
    expect(normalizeMetricKey('i_pae')).toBe('pae_interaction')
  })
  it('maps pae → pae_interaction', () => {
    expect(normalizeMetricKey('pae')).toBe('pae_interaction')
  })
  it('passes canonical keys through unchanged', () => {
    expect(normalizeMetricKey('iptm')).toBe('iptm')
    expect(normalizeMetricKey('plddt')).toBe('plddt')
    expect(normalizeMetricKey('scrmsd')).toBe('scrmsd')
  })
  it('lowercases unknown keys', () => {
    expect(normalizeMetricKey('PLDDT')).toBe('plddt')
    expect(normalizeMetricKey('MyMetric')).toBe('mymetric')
  })
})

describe('getMetricMeta', () => {
  it('returns metadata for a known key', () => {
    const meta = getMetricMeta('plddt')
    expect(meta).not.toBeNull()
    expect(meta?.direction).toBe('higher')
    expect(meta?.goodThreshold).toBe(0.8)
  })
  it('resolves aliased keys transparently', () => {
    expect(getMetricMeta('i_ptm')).toEqual(getMetricMeta('iptm'))
    expect(getMetricMeta('i_pae')).toEqual(getMetricMeta('pae_interaction'))
  })
  it('returns null for completely unknown keys', () => {
    expect(getMetricMeta('no_such_metric_xyz')).toBeNull()
  })
})

describe('getMetricDirection', () => {
  it('returns higher for confidence metrics', () => {
    expect(getMetricDirection('plddt')).toBe('higher')
    expect(getMetricDirection('iptm')).toBe('higher')
    expect(getMetricDirection('sctm')).toBe('higher')
  })
  it('returns lower for error/RMSD metrics', () => {
    expect(getMetricDirection('scrmsd')).toBe('lower')
    expect(getMetricDirection('pae_interaction')).toBe('lower')
  })
  it('returns neutral for unknown keys', () => {
    expect(getMetricDirection('unknown_key_abc')).toBe('neutral')
  })
})

describe('getMetricGoodThreshold', () => {
  it('returns threshold for known metric', () => {
    expect(getMetricGoodThreshold('iptm')).toBe(0.5)
    expect(getMetricGoodThreshold('scrmsd')).toBe(2.0)
  })
  it('returns scale-100 threshold when sample value is on 0-100 scale', () => {
    expect(getMetricGoodThreshold('plddt', 85)).toBe(80)
  })
  it('returns undefined for metrics without a threshold', () => {
    expect(getMetricGoodThreshold('temperature')).toBeUndefined()
  })
})

describe('getMetricLabel', () => {
  it('returns a human-readable label for known keys', () => {
    expect(getMetricLabel('plddt')).toBe('pLDDT')
    expect(getMetricLabel('iptm')).toBe('ipTM')
    expect(getMetricLabel('pae_interaction')).toBe('iPAE')
  })
  it('formats unknown keys as title-case fallback', () => {
    const label = getMetricLabel('my_custom_metric')
    expect(label.length).toBeGreaterThan(0)
  })
})
