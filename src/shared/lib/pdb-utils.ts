const AA3: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E',
  GLY: 'G', HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F',
  PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
}

export function extractBFactorsFromPdb(pdbText: string): number[] {
  const bfactorsByResidue = new Map<string, number>()
  const order: string[] = []

  for (const line of pdbText.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue
    const chain = line[21]
    const seqNum = line.slice(22, 26).trim()
    const key = `${chain}:${seqNum}`
    const bfStr = line.slice(60, 66).trim()
    const bf = parseFloat(bfStr)
    if (isNaN(bf)) continue
    if (!bfactorsByResidue.has(key)) {
      bfactorsByResidue.set(key, bf)
      order.push(key)
    }
  }

  return order.map((k) => bfactorsByResidue.get(k)!)
}

export function normalizePlddtArray(values: number[]): number[] {
  if (values.length === 0) return []
  const isPercent = values.some((v) => v > 2)
  return isPercent ? values : values.map((v) => v * 100)
}

export function meanFromArray(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function extractSequenceFromPdb(pdbText: string): string | undefined {
  const residues: { chain: string; seq: number; name: string }[] = []
  const seen = new Set<string>()
  for (const line of pdbText.split('\n')) {
    if (!line.startsWith('ATOM')) continue
    const chain = line[21]
    const seqNum = parseInt(line.slice(22, 26).trim(), 10)
    const resName = line.slice(17, 20).trim()
    const key = `${chain}:${seqNum}`
    if (!seen.has(key)) {
      seen.add(key)
      residues.push({ chain, seq: seqNum, name: resName })
    }
  }
  if (residues.length === 0) return undefined
  return residues.map((r) => AA3[r.name] ?? 'X').join('')
}

export function extractSequenceFromCif(cifText: string): string | undefined {
  const residues: { seq: number; name: string }[] = []
  const seen = new Set<string>()
  for (const line of cifText.split('\n')) {
    if (!line.startsWith('ATOM')) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 9) continue
    const resName = parts[5]
    const seqNum = parts[8]
    if (!seen.has(seqNum)) {
      seen.add(seqNum)
      residues.push({ seq: parseInt(seqNum, 10), name: resName })
    }
  }
  if (residues.length === 0) return undefined
  return residues.map((r) => AA3[r.name] ?? 'X').join('')
}
