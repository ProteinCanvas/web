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

interface CaAtom {
  chainId: string
  seqId: number
  x: number
  y: number
  z: number
  bfactor: number
}

function parseCaAtoms(pdbText: string): CaAtom[] {
  const atoms: CaAtom[] = []
  const seen = new Set<string>()
  for (const line of pdbText.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue
    const atomName = line.slice(12, 16).trim()
    if (atomName !== 'CA') continue
    const chainId = line[21]
    const seqId = parseInt(line.slice(22, 26).trim(), 10)
    const key = `${chainId}:${seqId}`
    if (seen.has(key)) continue
    seen.add(key)
    const x = parseFloat(line.slice(30, 38).trim())
    const y = parseFloat(line.slice(38, 46).trim())
    const z = parseFloat(line.slice(46, 54).trim())
    const bfactor = parseFloat(line.slice(60, 66).trim())
    if (isNaN(x) || isNaN(y) || isNaN(z)) continue
    atoms.push({ chainId, seqId, x, y, z, bfactor: isNaN(bfactor) ? 0 : bfactor })
  }
  return atoms
}

export interface InterfaceResidue {
  id: string
  plddt: number
  minDistÅ: number
}

export function computeInterfaceResidues(
  binderPdb: string,
  targetPdb: string,
  thresholdÅ = 8,
): InterfaceResidue[] {
  const binderAtoms = parseCaAtoms(binderPdb)
  const targetAtoms = parseCaAtoms(targetPdb)
  if (binderAtoms.length === 0 || targetAtoms.length === 0) return []

  const results: InterfaceResidue[] = []
  for (const b of binderAtoms) {
    let minDist = Infinity
    for (const t of targetAtoms) {
      const dx = b.x - t.x
      const dy = b.y - t.y
      const dz = b.z - t.z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d < minDist) minDist = d
    }
    if (minDist <= thresholdÅ) {
      const plddt = b.bfactor > 1 ? b.bfactor : b.bfactor * 100
      results.push({ id: `${b.chainId}:${b.seqId}`, plddt, minDistÅ: minDist })
    }
  }

  results.sort((a, b) => {
    const aSeq = parseInt(a.id.split(':')[1], 10)
    const bSeq = parseInt(b.id.split(':')[1], 10)
    return aSeq - bSeq
  })

  return results
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
