import type { Candidate } from '@/shared/types'

export type AlignmentColorMode = 'aminoacid' | 'plddt' | 'conservation' | 'mutation-freq' | 'hydrophobicity'

export interface AlignedSequence {
  candidateId: string
  name: string
  gapped: string
  gapMap: number[]
  plddtAtColumn: (number | null)[]
}

export interface ColumnStats {
  conservation: number[]
  mutationFreq: number[]
  consensus: string[]
}

const GAP = -2

const GROUPS: Set<string>[] = [
  new Set(['F', 'Y', 'W', 'H']),
  new Set(['K', 'R']),
  new Set(['D', 'E']),
  new Set(['S', 'T', 'N', 'Q']),
  new Set(['V', 'I', 'L', 'M', 'A', 'C']),
  new Set(['G', 'P']),
]

function scoreAA(a: string, b: string): number {
  if (a === b) return 2
  for (const g of GROUPS) {
    if (g.has(a) && g.has(b)) return 1
  }
  return -1
}

function needlemanWunsch(seqA: string, seqB: string): [string, string] {
  const m = seqA.length
  const n = seqB.length
  const H = Array.from({ length: m + 1 }, () => new Float32Array(n + 1))
  const trace = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1))

  for (let i = 0; i <= m; i++) H[i][0] = i * GAP
  for (let j = 0; j <= n; j++) H[0][j] = j * GAP

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const diag = H[i - 1][j - 1] + scoreAA(seqA[i - 1], seqB[j - 1])
      const up = H[i - 1][j] + GAP
      const left = H[i][j - 1] + GAP
      if (diag >= up && diag >= left) { H[i][j] = diag; trace[i][j] = 0 }
      else if (up >= left) { H[i][j] = up; trace[i][j] = 1 }
      else { H[i][j] = left; trace[i][j] = 2 }
    }
  }

  let i = m, j = n
  let alignA = '', alignB = ''
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && trace[i][j] === 0) {
      alignA = seqA[i - 1] + alignA; alignB = seqB[j - 1] + alignB; i--; j--
    } else if (i > 0 && (j === 0 || trace[i][j] === 1)) {
      alignA = seqA[i - 1] + alignA; alignB = '-' + alignB; i--
    } else {
      alignA = '-' + alignA; alignB = seqB[j - 1] + alignB; j--
    }
  }

  return [alignA, alignB]
}

export function computeMSA(candidates: Candidate[]): AlignedSequence[] {
  if (candidates.length === 0) return []

  const seqs = candidates.map((c) =>
    (c.sequence ?? '').toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, 'X')
  )

  if (candidates.length === 1) {
    return [{
      candidateId: candidates[0].id,
      name: candidates[0].name,
      gapped: seqs[0],
      gapMap: Array.from({ length: seqs[0].length }, (_, i) => i),
      plddtAtColumn: Array.from({ length: seqs[0].length }, (_, i) => {
        const p = candidates[0].plddtPerResidue
        return p && i < p.length ? p[i] : null
      }),
    }]
  }

  const ref = seqs[0]
  const pairwise: [string, string][] = [[ref, ref]]
  for (let i = 1; i < seqs.length; i++) {
    pairwise.push(needlemanWunsch(ref, seqs[i]))
  }

  const gapsBefore = new Array(ref.length + 1).fill(0)
  for (const [gappedRef] of pairwise) {
    let origPos = 0
    let gapCount = 0
    for (const ch of gappedRef) {
      if (ch === '-') {
        gapCount++
      } else {
        gapsBefore[origPos] = Math.max(gapsBefore[origPos], gapCount)
        origPos++
        gapCount = 0
      }
    }
    gapsBefore[ref.length] = Math.max(gapsBefore[ref.length], gapCount)
  }

  let consensusRef = ''
  for (let i = 0; i < ref.length; i++) {
    consensusRef += '-'.repeat(gapsBefore[i]) + ref[i]
  }
  consensusRef += '-'.repeat(gapsBefore[ref.length])

  return candidates.map((candidate, k) => {
    const [gappedRef, gappedTarget] = pairwise[k]
    let cPos = 0
    let pPos = 0
    let result = ''

    while (cPos < consensusRef.length) {
      const cChar = consensusRef[cPos]
      const pChar = pPos < gappedRef.length ? gappedRef[pPos] : undefined
      if (cChar === '-') {
        if (pChar === '-') {
          result += gappedTarget[pPos] ?? '-'
          cPos++; pPos++
        } else {
          result += '-'
          cPos++
        }
      } else {
        result += gappedTarget[pPos] ?? '-'
        cPos++; pPos++
      }
    }

    const gapMap: number[] = []
    let origIdx = 0
    for (const ch of result) {
      gapMap.push(ch === '-' ? -1 : origIdx++)
    }

    const plddt = candidate.plddtPerResidue
    const plddtAtColumn: (number | null)[] = result.split('').map((_, col) => {
      const idx = gapMap[col]
      return idx >= 0 && plddt && idx < plddt.length ? plddt[idx] : null
    })

    return { candidateId: candidate.id, name: candidate.name, gapped: result, gapMap, plddtAtColumn }
  })
}

export function computeColumnStats(aligned: AlignedSequence[]): ColumnStats {
  if (aligned.length === 0) return { conservation: [], mutationFreq: [], consensus: [] }

  const len = aligned[0].gapped.length
  const conservation: number[] = new Array(len).fill(0)
  const mutationFreq: number[] = new Array(len).fill(0)
  const consensus: string[] = new Array(len).fill('-')

  for (let col = 0; col < len; col++) {
    const counts: Record<string, number> = {}
    let total = 0
    for (const seq of aligned) {
      const ch = seq.gapped[col]
      if (ch && ch !== '-') {
        counts[ch] = (counts[ch] ?? 0) + 1
        total++
      }
    }
    if (total === 0) continue

    let maxCount = 0
    let cons = '-'
    for (const [aa, cnt] of Object.entries(counts)) {
      if (cnt > maxCount) { maxCount = cnt; cons = aa }
    }
    consensus[col] = cons

    let entropy = 0
    for (const cnt of Object.values(counts)) {
      const p = cnt / total
      if (p > 0) entropy -= p * Math.log2(p)
    }
    const maxEntropy = Math.log2(Math.min(total, 20))
    conservation[col] = maxEntropy > 0 ? 1 - entropy / maxEntropy : 1
    mutationFreq[col] = 1 - maxCount / total
  }

  return { conservation, mutationFreq, consensus }
}
