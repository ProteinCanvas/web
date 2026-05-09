import { describe, it, expect } from 'vitest'
import {
  normalizePlddtArray,
  meanFromArray,
  extractBFactorsFromPdb,
  extractSequenceFromPdb,
} from '../pdb-utils'

// Minimal valid PDB ATOM records (fixed-width, standard format)
// Columns: resName=17-19, chain=21, seqNum=22-25, bfactor=60-65
const PDB_TWO_RESIDUES = [
  'ATOM      1  N   ALA A   1       1.000   2.000   3.000  1.00 85.23           N  ',
  'ATOM      2  CA  ALA A   1       1.500   2.500   3.500  1.00 85.23           C  ',
  'ATOM      3  N   GLY A   2       4.000   5.000   6.000  1.00 72.10           N  ',
  'ATOM      4  CA  GLY A   2       4.500   5.500   6.500  1.00 72.10           C  ',
].join('\n')

describe('normalizePlddtArray', () => {
  it('detects 0-100 scale (any value > 2) and leaves values unchanged', () => {
    const result = normalizePlddtArray([85, 92, 70])
    expect(result).toEqual([85, 92, 70])
  })

  it('detects 0-1 scale and multiplies by 100', () => {
    const result = normalizePlddtArray([0.85, 0.92, 0.70])
    expect(result[0]).toBeCloseTo(85)
    expect(result[1]).toBeCloseTo(92)
    expect(result[2]).toBeCloseTo(70)
  })

  it('returns an empty array unchanged', () => {
    expect(normalizePlddtArray([])).toEqual([])
  })
})

describe('meanFromArray', () => {
  it('computes the arithmetic mean', () => {
    expect(meanFromArray([1, 2, 3])).toBeCloseTo(2)
    expect(meanFromArray([10, 20])).toBeCloseTo(15)
  })

  it('returns 0 for an empty array', () => {
    expect(meanFromArray([])).toBe(0)
  })

  it('returns the single value for a one-element array', () => {
    expect(meanFromArray([42])).toBe(42)
  })
})

describe('extractBFactorsFromPdb', () => {
  it('extracts one B-factor per unique residue (first atom wins)', () => {
    const bfactors = extractBFactorsFromPdb(PDB_TWO_RESIDUES)
    expect(bfactors).toHaveLength(2)
    expect(bfactors[0]).toBeCloseTo(85.23)
    expect(bfactors[1]).toBeCloseTo(72.10)
  })

  it('returns an empty array for non-PDB text', () => {
    expect(extractBFactorsFromPdb('not a pdb\njust text')).toEqual([])
  })

  it('returns an empty array for an empty string', () => {
    expect(extractBFactorsFromPdb('')).toEqual([])
  })

  it('preserves residue order', () => {
    const bfactors = extractBFactorsFromPdb(PDB_TWO_RESIDUES)
    expect(bfactors[0]).toBeGreaterThan(bfactors[1])
  })
})

describe('extractSequenceFromPdb', () => {
  it('converts ATOM residues to single-letter sequence', () => {
    const seq = extractSequenceFromPdb(PDB_TWO_RESIDUES)
    expect(seq).toBe('AG')
  })

  it('returns undefined when no ATOM records are present', () => {
    expect(extractSequenceFromPdb('HEADER  example\nREMARK  no atoms')).toBeUndefined()
  })

  it('uses X for unknown residue names', () => {
    const pdb = 'ATOM      1  N   XYZ A   1       1.000   2.000   3.000  1.00 90.00           N  '
    const seq = extractSequenceFromPdb(pdb)
    expect(seq).toBe('X')
  })
})
