const AA_COLORS: Record<string, string> = {
  F: '#7c3aed', Y: '#7c3aed', W: '#7c3aed', H: '#6d28d9',
  K: '#1d4ed8', R: '#1d4ed8',
  D: '#b91c1c', E: '#b91c1c',
  S: '#15803d', T: '#15803d', N: '#166534', Q: '#166534',
  V: '#b45309', I: '#b45309', L: '#b45309', M: '#92400e',
  A: '#78350f', C: '#854d0e', G: '#854d0e', P: '#a16207',
}

const HYDROPHOBICITY: Record<string, number> = {
  I: 4.5, V: 4.2, L: 3.8, F: 2.8, C: 2.5, M: 1.9, A: 1.8,
  G: -0.4, T: -0.7, S: -0.8, W: -0.9, Y: -1.3, P: -1.6,
  H: -3.2, E: -3.5, D: -3.5, N: -3.5, Q: -3.5, K: -3.9, R: -4.5,
}

export function colorByAminoacid(aa: string): string {
  return AA_COLORS[aa.toUpperCase()] ?? '#374151'
}

export function colorByPlddt(value: number): string {
  const v = value > 1 ? value : value * 100
  if (v >= 90) return '#0053D6'
  if (v >= 70) return '#65CBF3'
  if (v >= 50) return '#FFDB13'
  return '#FF7D45'
}

export function colorByConservation(conservation: number): string {
  const v = Math.max(0, Math.min(1, conservation))
  const r = Math.round(30 + 170 * (1 - v))
  const g = Math.round(40 + 140 * (1 - v))
  const b = Math.round(100 + 80 * (1 - v * 0.4))
  return `rgb(${r},${g},${b})`
}

export function colorByMutationFreq(freq: number): string {
  const v = Math.max(0, Math.min(1, freq))
  const r = Math.round(200 + 55 * v)
  const g = Math.round(220 - 200 * v)
  const b = Math.round(220 - 210 * v)
  return `rgb(${r},${g},${b})`
}

export function colorByHydrophobicity(aa: string): string {
  const h = HYDROPHOBICITY[aa.toUpperCase()] ?? 0
  const norm = (h + 4.5) / 9.0
  if (norm > 0.5) {
    const t = (norm - 0.5) * 2
    return `rgb(255,${Math.round(255 - 165 * t)},${Math.round(255 - 235 * t)})`
  }
  const t = norm * 2
  return `rgb(${Math.round(40 + 195 * t)},${Math.round(80 + 175 * t)},${Math.round(200 + 55 * t)})`
}

export function piColor(v: number): string {
  if (v >= 6 && v <= 8) return 'text-blue-500'
  if ((v >= 5 && v < 6) || (v > 8 && v <= 9)) return 'text-yellow-500'
  return 'text-red-500'
}

export function chargeColor(v: number): string {
  if (Math.abs(v) < 3) return 'text-green-500'
  if (Math.abs(v) <= 6) return 'text-yellow-500'
  return 'text-red-500'
}

export function gravyColor(v: number): string {
  if (v < 0) return 'text-green-500'
  if (v <= 0.5) return 'text-yellow-500'
  return 'text-red-500'
}

export function instabilityColor(v: number): string {
  if (v < 40) return 'text-green-500'
  if (v <= 60) return 'text-yellow-500'
  return 'text-red-500'
}

export function getCellColor(
  aa: string,
  plddt: number | null,
  conservation: number,
  mutFreq: number,
  colorMode: import('./alignment').AlignmentColorMode,
): string {
  switch (colorMode) {
    case 'aminoacid': return colorByAminoacid(aa)
    case 'plddt': return plddt !== null ? colorByPlddt(plddt) : '#374151'
    case 'conservation': return colorByConservation(conservation)
    case 'mutation-freq': return colorByMutationFreq(mutFreq)
    case 'hydrophobicity': return colorByHydrophobicity(aa)
  }
}
