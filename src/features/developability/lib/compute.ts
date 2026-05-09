const KD: Record<string, number> = {
  A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, Q: -3.5, E: -3.5,
  G: -0.4, H: -3.2, I: 4.5, L: 3.8, K: -3.9, M: 1.9, F: 2.8,
  P: -1.6, S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2,
}

const DIWV: Record<string, Record<string, number>> = {
  A: { A: 1.0, C: 44.94, E: 1.0, D: -7.49, G: 1.0, F: 1.0, I: 1.0, H: -7.49, K: 1.0, M: 1.0, L: 1.0, N: 1.0, Q: 1.0, P: 20.26, S: 1.0, R: 1.0, T: 1.0, W: 1.0, V: 1.0, Y: 1.0 },
  C: { A: 1.0, C: 1.0, E: 1.0, D: 20.26, G: 1.0, F: 1.0, I: 1.0, H: 33.6, K: 1.0, M: 33.6, L: 20.26, N: 1.0, Q: -6.54, P: 20.26, S: 1.0, R: 1.0, T: 33.6, W: 24.68, V: -6.54, Y: 1.0 },
  D: { A: 1.0, C: 1.0, E: 1.0, D: 1.0, G: 1.0, F: -6.54, I: 1.0, H: 1.0, K: -7.49, M: 1.0, L: 1.0, N: 1.0, Q: 1.0, P: 1.0, S: 20.26, R: -6.54, T: -14.03, W: 1.0, V: 1.0, Y: 1.0 },
  E: { A: 1.0, C: 44.94, E: 33.6, D: 20.26, G: 1.0, F: 1.0, I: 20.26, H: -6.54, K: 1.0, M: 1.0, L: 1.0, N: 1.0, Q: 20.26, P: 20.26, S: 20.26, R: 1.0, T: 1.0, W: -14.03, V: 1.0, Y: 1.0 },
  F: { A: 1.0, C: 1.0, E: 1.0, D: 13.34, G: 1.0, F: 1.0, I: 1.0, H: 1.0, K: -14.03, M: 1.0, L: 1.0, N: 1.0, Q: 1.0, P: 20.26, S: 1.0, R: 1.0, T: 1.0, W: 1.0, V: 1.0, Y: 33.6 },
  G: { A: -7.49, C: 1.0, E: -6.54, D: 1.0, G: 13.34, F: 1.0, I: -7.49, H: 1.0, K: 1.0, M: 1.0, L: 1.0, N: -7.49, Q: 1.0, P: 1.0, S: 1.0, R: 1.0, T: -7.49, W: 13.34, V: 1.0, Y: -7.49 },
  H: { A: 1.0, C: 1.0, E: 1.0, D: 1.0, G: -9.37, F: -9.37, I: 44.94, H: 1.0, K: 24.68, M: 1.0, L: 1.0, N: 24.68, Q: 1.0, P: -1.88, S: 1.0, R: 1.0, T: -6.54, W: -1.88, V: 1.0, Y: 44.94 },
  I: { A: 1.0, C: 1.0, E: 44.94, D: 1.0, G: 1.0, F: 1.0, I: 1.0, H: 13.34, K: -7.49, M: 1.0, L: 20.26, N: 1.0, Q: 1.0, P: -1.88, S: 1.0, R: 1.0, T: 1.0, W: 1.0, V: -7.49, Y: 1.0 },
  K: { A: 1.0, C: 1.0, E: 1.0, D: 1.0, G: -7.49, F: 1.0, I: -7.49, H: 1.0, K: 1.0, M: 33.6, L: -7.49, N: 1.0, Q: 24.68, P: -6.54, S: 1.0, R: 33.6, T: 1.0, W: 1.0, V: -7.49, Y: 1.0 },
  L: { A: 1.0, C: 1.0, E: 1.0, D: 1.0, G: 1.0, F: 1.0, I: 1.0, H: 1.0, K: -7.49, M: 1.0, L: 1.0, N: 1.0, Q: 33.6, P: 20.26, S: 1.0, R: 20.26, T: 1.0, W: 24.68, V: 1.0, Y: 1.0 },
  M: { A: 13.34, C: 1.0, E: 1.0, D: 1.0, G: 1.0, F: 1.0, I: 1.0, H: 58.28, K: 1.0, M: -1.88, L: 1.0, N: 1.0, Q: -6.54, P: 44.94, S: 44.94, R: -6.54, T: -1.88, W: 1.0, V: 1.0, Y: 24.68 },
  N: { A: 1.0, C: -1.88, E: 1.0, D: 1.0, G: -14.03, F: -14.03, I: 44.94, H: 1.0, K: 24.68, M: 1.0, L: 1.0, N: 1.0, Q: -6.54, P: -1.88, S: 1.0, R: 1.0, T: -7.49, W: -9.37, V: 1.0, Y: 1.0 },
  P: { A: 20.26, C: -6.54, E: 18.38, D: -6.54, G: 1.0, F: 20.26, I: 1.0, H: 1.0, K: 1.0, M: -6.54, L: 1.0, N: 1.0, Q: 20.26, P: 20.26, S: 20.26, R: -6.54, T: 1.0, W: -1.88, V: 20.26, Y: 1.0 },
  Q: { A: 1.0, C: -6.54, E: 20.26, D: 20.26, G: 1.0, F: -6.54, I: 1.0, H: 1.0, K: 1.0, M: 1.0, L: 1.0, N: 1.0, Q: 20.26, P: 20.26, S: 44.94, R: 1.0, T: 1.0, W: 1.0, V: -6.54, Y: -6.54 },
  R: { A: 1.0, C: 1.0, E: 1.0, D: 1.0, G: -7.49, F: 1.0, I: 1.0, H: 20.26, K: 1.0, M: 1.0, L: 1.0, N: 13.34, Q: 20.26, P: 20.26, S: 44.94, R: 58.28, T: 1.0, W: 58.28, V: 1.0, Y: -6.54 },
  S: { A: 1.0, C: 33.6, E: 20.26, D: 1.0, G: 1.0, F: 1.0, I: 1.0, H: 1.0, K: 1.0, M: 1.0, L: 1.0, N: 1.0, Q: 20.26, P: 44.94, S: 20.26, R: 20.26, T: 1.0, W: 1.0, V: 1.0, Y: 1.0 },
  T: { A: 1.0, C: 1.0, E: 20.26, D: 1.0, G: -7.49, F: 13.34, I: 1.0, H: 1.0, K: 1.0, M: 1.0, L: 1.0, N: -14.03, Q: -6.54, P: 1.0, S: 1.0, R: 1.0, T: 1.0, W: -14.03, V: 1.0, Y: 1.0 },
  V: { A: 1.0, C: 1.0, E: 1.0, D: -14.03, G: -7.49, F: 1.0, I: 1.0, H: 1.0, K: -1.88, M: 1.0, L: 1.0, N: 1.0, Q: 1.0, P: 20.26, S: 1.0, R: 1.0, T: -7.49, W: 1.0, V: 1.0, Y: -6.54 },
  W: { A: -14.03, C: 1.0, E: 1.0, D: 1.0, G: -9.37, F: 1.0, I: 44.94, H: 24.68, K: 1.0, M: 24.68, L: 13.34, N: 13.34, Q: 1.0, P: 1.0, S: 1.0, R: 1.0, T: -14.03, W: 1.0, V: -7.49, Y: 1.0 },
  Y: { A: 24.68, C: 1.0, E: -6.54, D: 24.68, G: -7.49, F: 1.0, I: 1.0, H: 13.34, K: 1.0, M: 44.94, L: 1.0, N: 1.0, Q: 1.0, P: 13.34, S: 1.0, R: -15.91, T: -7.49, W: -9.37, V: 1.0, Y: 13.34 },
}

export function computeGravy(sequence: string): number {
  const seq = sequence.toUpperCase()
  if (seq.length === 0) return 0
  const total = Array.from(seq).reduce((sum, aa) => sum + (KD[aa] ?? 0), 0)
  return parseFloat((total / seq.length).toFixed(3))
}

export function computeAromaticity(sequence: string): number {
  const seq = sequence.toUpperCase()
  if (seq.length === 0) return 0
  const aromatic = Array.from(seq).filter((aa) => aa === 'F' || aa === 'W' || aa === 'Y').length
  return parseFloat((aromatic / seq.length).toFixed(3))
}

export function computeInstabilityIndex(sequence: string): number {
  const seq = sequence.toUpperCase()
  if (seq.length < 2) return 0
  let score = 0
  for (let i = 0; i < seq.length - 1; i++) {
    const aa1 = seq[i]
    const aa2 = seq[i + 1]
    score += DIWV[aa1]?.[aa2] ?? 1.0
  }
  return parseFloat(((10 / seq.length) * score).toFixed(2))
}

export function computeDevMetrics(sequence: string): Record<string, number> {
  const pI = computeIsoelectricPoint(sequence)
  const netCharge = computeNetCharge(sequence)
  return {
    dev_pI: pI,
    dev_charge: netCharge,
    dev_gravy: computeGravy(sequence),
    dev_aromaticity: computeAromaticity(sequence),
    dev_instability: computeInstabilityIndex(sequence),
    dev_length: sequence.length,
  }
}

const PKA: Record<string, number> = {
  N_term: 8.0,
  C_term: 3.1,
  D: 3.9,
  E: 4.07,
  H: 6.04,
  C: 8.18,
  Y: 10.46,
  K: 10.54,
  R: 12.48,
}

export function computeNetCharge(sequence: string, pH = 7.4): number {
  let charge = 0
  charge += 1 / (1 + Math.pow(10, pH - PKA.N_term))
  charge -= 1 / (1 + Math.pow(10, PKA.C_term - pH))
  for (const aa of sequence.toUpperCase()) {
    if (aa === 'D') charge -= 1 / (1 + Math.pow(10, PKA.D - pH))
    else if (aa === 'E') charge -= 1 / (1 + Math.pow(10, PKA.E - pH))
    else if (aa === 'H') charge += 1 / (1 + Math.pow(10, pH - PKA.H))
    else if (aa === 'C') charge -= 1 / (1 + Math.pow(10, PKA.C - pH))
    else if (aa === 'Y') charge -= 1 / (1 + Math.pow(10, PKA.Y - pH))
    else if (aa === 'K') charge += 1 / (1 + Math.pow(10, pH - PKA.K))
    else if (aa === 'R') charge += 1 / (1 + Math.pow(10, pH - PKA.R))
  }
  return parseFloat(charge.toFixed(2))
}

export function computeIsoelectricPoint(sequence: string): number {
  let lo = 0
  let hi = 14
  for (let i = 0; i < 150; i++) {
    const mid = (lo + hi) / 2
    if (computeNetCharge(sequence, mid) > 0) lo = mid
    else hi = mid
  }
  return parseFloat(((lo + hi) / 2).toFixed(2))
}

export type LiabilitySeverity = 'warn' | 'flag'
export type LiabilityType = 'deamidation' | 'free_cys' | 'oxidation' | 'extreme_pi' | 'high_charge'

export interface ChemicalLiability {
  type: LiabilityType
  positions: number[]
  severity: LiabilitySeverity
  label: string
}

export function scanChemicalLiabilities(sequence: string): ChemicalLiability[] {
  const liabilities: ChemicalLiability[] = []
  const seq = sequence.toUpperCase()

  const deamidPos: number[] = []
  for (let i = 0; i < seq.length - 1; i++) {
    if (seq[i] === 'N' && (seq[i + 1] === 'G' || seq[i + 1] === 'S')) {
      deamidPos.push(i + 1)
    }
  }
  if (deamidPos.length > 0) {
    liabilities.push({
      type: 'deamidation',
      positions: deamidPos,
      severity: 'warn',
      label: `NG/NS deamidation (${deamidPos.length} site${deamidPos.length > 1 ? 's' : ''})`,
    })
  }

  const cysPositions: number[] = []
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === 'C') cysPositions.push(i + 1)
  }
  if (cysPositions.length % 2 !== 0) {
    liabilities.push({
      type: 'free_cys',
      positions: cysPositions,
      severity: 'flag',
      label: `Unpaired Cys (${cysPositions.length} total)`,
    })
  }

  const oxidPos: number[] = []
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === 'W' || seq[i] === 'M') oxidPos.push(i + 1)
  }
  if (oxidPos.length > 3) {
    liabilities.push({
      type: 'oxidation',
      positions: oxidPos,
      severity: 'warn',
      label: `Oxidation risk: ${oxidPos.length} W/M residues`,
    })
  }

  return liabilities
}

export type DevelopabilityScore = 'good' | 'warn' | 'flag'

export interface DevelopabilityProfile {
  pI: number
  netCharge: number
  liabilities: ChemicalLiability[]
  score: DevelopabilityScore
}

export function computeDevelopability(sequence: string): DevelopabilityProfile {
  const pI = computeIsoelectricPoint(sequence)
  const netCharge = computeNetCharge(sequence)
  const liabilities = scanChemicalLiabilities(sequence)

  const hasFlag = liabilities.some((l) => l.severity === 'flag') || pI < 4.5 || pI > 10.5
  const hasWarn = liabilities.some((l) => l.severity === 'warn') || Math.abs(netCharge) > 5

  return {
    pI,
    netCharge,
    liabilities,
    score: hasFlag ? 'flag' : hasWarn ? 'warn' : 'good',
  }
}
