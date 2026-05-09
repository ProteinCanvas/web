import type { Campaign, Candidate, MetricField, ProvenanceNode, ShortlistEntry, ExperimentalResult, TargetProtein } from '@/shared/types'
import { enrichWithDevMetrics } from '@/features/developability'

const AA = 'ACDEFGHIKLMNPQRSTVWY'

function seeded(n: number): number {
  const x = Math.sin(n + 1) * 10000
  return x - Math.floor(x)
}

function randRange(seed: number, lo: number, hi: number): number {
  return lo + seeded(seed) * (hi - lo)
}

function normalSample(seed: number, mu: number, sigma: number): number {
  const u1 = seeded(seed)
  const u2 = seeded(seed + 99991)
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2)
  return mu + sigma * z
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function randInt(seed: number, lo: number, hi: number): number {
  return lo + Math.floor(seeded(seed) * (hi - lo + 1))
}

function randSeq(seed: number, length: number, template: string): string {
  const base = template.toUpperCase()
  return Array.from({ length }, (_, i) => {
    const r = seeded(seed * 137 + i * 17 + 3)
    if (r < 0.7 && i < base.length) return base[i % base.length]
    return AA[Math.floor(seeded(seed * 100 + i) * 20)]
  }).join('')
}

function daysOffset(baseIso: string, days: number): string {
  const d = new Date(baseIso)
  d.setTime(d.getTime() + days * 86400000)
  return d.toISOString()
}

function buildHelixChain(seq: string, plddtPerRes: number[], chain: string, offsetX = 0, offsetZ = 0): string {
  const lines: string[] = []
  let atomIdx = 1
  const residues = [
    'ALA', 'LEU', 'PHE', 'GLU', 'GLN', 'LYS', 'ILE', 'ARG', 'ASP', 'TRP',
    'VAL', 'MET', 'SER', 'THR', 'ASN', 'HIS', 'PRO', 'CYS', 'TYR', 'GLY',
  ]
  for (let i = 0; i < seq.length; i++) {
    const x = offsetX + 2.3 * Math.cos(i * 1.745)
    const y = 2.3 * Math.sin(i * 1.745)
    const z = offsetZ + i * 1.5
    const bf = clamp(plddtPerRes[i] ?? plddtPerRes[plddtPerRes.length - 1], 0, 1) * 100
    const resName = residues[i % residues.length]
    const resNum = i + 1
    lines.push(
      `ATOM  ${String(atomIdx).padStart(5)} ${'CA'.padEnd(4)} ${resName} ${chain}${String(resNum).padStart(4)}    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00${bf.toFixed(2).padStart(6)}           C`
    )
    atomIdx++
  }
  return lines.join('\n')
}

function buildBetaSheetChain(length: number, chain: string, offsetX = 20, offsetZ = 20): string {
  const lines: string[] = []
  let atomIdx = 1
  const residues = [
    'ALA', 'LEU', 'PHE', 'GLU', 'GLN', 'LYS', 'ILE', 'ARG', 'ASP', 'TRP',
    'VAL', 'MET', 'SER', 'THR', 'ASN', 'HIS', 'PRO', 'CYS', 'TYR', 'GLY',
  ]
  const strandLen = 6
  const numStrands = Math.ceil(length / (strandLen + 4))
  let resNum = 1
  for (let s = 0; s < numStrands && resNum <= length; s++) {
    for (let r = 0; r < strandLen && resNum <= length; r++) {
      const dir = s % 2 === 0 ? 1 : -1
      const x = offsetX + s * 5.0
      const z = offsetZ + dir * r * 3.8 + (s % 2 === 0 ? 0 : (strandLen - 1) * 3.8)
      const y = (r % 2 === 0) ? 0 : 1.0
      const resName = residues[resNum % residues.length]
      lines.push(
        `ATOM  ${String(atomIdx).padStart(5)} ${'CA'.padEnd(4)} ${resName} ${chain}${String(resNum).padStart(4)}    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00 75.00           C`
      )
      atomIdx++
      resNum++
    }
    for (let l = 0; l < 3 && resNum <= length; l++) {
      const x = offsetX + s * 5.0 + 2.5
      const z = offsetZ + l * 2.0
      const y = l * 1.5
      const resName = residues[resNum % residues.length]
      lines.push(
        `ATOM  ${String(atomIdx).padStart(5)} ${'CA'.padEnd(4)} ${resName} ${chain}${String(resNum).padStart(4)}    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00 75.00           C`
      )
      atomIdx++
      resNum++
    }
  }
  return lines.join('\n')
}

function buildComplexPDB(binderSeq: string, plddtPerResidue: number[]): string {
  const helixLines = buildHelixChain(binderSeq, plddtPerResidue, 'A', 0, 0)
  const targetLen = 70
  const betaLines = buildBetaSheetChain(targetLen, 'B', 20, 20)
  return [helixLines, 'TER', betaLines, 'END'].join('\n')
}

function buildTargetPDB(chain: string): string {
  const betaLines = buildBetaSheetChain(70, chain, 0, 0)
  return [betaLines, 'END'].join('\n')
}

function buildComplexPaeMatrix(binderLen: number, iptm: number, plddt: number, seed: number): number[][] {
  const targetInterface = 30
  const totalSize = binderLen + targetInterface
  const matrix: number[][] = Array.from({ length: totalSize }, () => Array(totalSize).fill(0))

  const quality = clamp(plddt, 0, 1)

  for (let i = 0; i < binderLen; i++) {
    for (let j = 0; j < binderLen; j++) {
      const dist = Math.abs(i - j)
      if (dist === 0) {
        matrix[i][j] = 0
      } else if (dist <= 4) {
        matrix[i][j] = clamp(normalSample(seed + i * 1000 + j, 1.5, 0.8) * (1 - quality * 0.4), 0.3, 6)
      } else {
        matrix[i][j] = clamp(normalSample(seed + i * 500 + j, 5.5, 2.0) * (1 - quality * 0.3), 1.5, 14)
      }
    }
  }

  for (let i = binderLen; i < totalSize; i++) {
    for (let j = binderLen; j < totalSize; j++) {
      const dist = Math.abs(i - j)
      matrix[i][j] = dist === 0 ? 0 : clamp(normalSample(seed + i * 200 + j, 1.0, 0.5), 0.3, 2.5)
    }
  }

  let ifaceLo: number, ifaceHi: number
  if (iptm > 0.7) {
    ifaceLo = 3; ifaceHi = 9
  } else if (iptm > 0.5) {
    ifaceLo = 6; ifaceHi = 16
  } else {
    ifaceLo = 12; ifaceHi = 25
  }

  for (let i = 0; i < binderLen; i++) {
    for (let j = binderLen; j < totalSize; j++) {
      const val = clamp(randRange(seed + i * 333 + j, ifaceLo, ifaceHi), 0, 31.75)
      matrix[i][j] = val
      matrix[j][i] = val
    }
  }

  return matrix
}

function buildPlddtPerResidue(seed: number, length: number, plddt: number): number[] {
  return Array.from({ length }, (_, i) =>
    clamp(plddt + normalSample(seed * 41 + i, 0, 0.06), 0.3, 1.0)
  )
}

function makeProvenanceNode(
  id: string,
  type: 'import' | 'filter' | 'score' | 'shortlist',
  label: string,
  timestamp: string,
  inputIds: string[],
  outputIds: string[],
  count: number,
  params: Record<string, unknown>
): ProvenanceNode {
  return { id, type, label, timestamp, parameters: params, inputIds, outputIds, candidateCount: count }
}

interface ClusterProfile {
  plddtMu: number
  plddtSigma: number
  iptmMu: number
  iptmSigma: number
  lenLo: number
  lenHi: number
}

const CLUSTER_CENTERS_PDL1: number[][] = [
  [2.5, 2.1, 0.3, -1.2, 1.8, -0.5, 0.9, 1.4, -0.7, 2.0],
  [-2.3, 1.5, -1.8, 0.7, -1.2, 2.1, -0.4, 0.8, 1.6, -1.1],
  [0.4, -2.6, 2.2, 1.5, -0.8, -1.7, 2.3, -1.0, 0.5, 1.9],
  [-1.9, -0.3, -2.4, -1.6, 2.5, 0.9, -1.3, 2.2, -0.6, -0.4],
  [1.1, 2.8, 1.7, -2.1, -1.5, 1.3, -2.0, -0.3, 2.4, 0.7],
  [-0.8, -1.4, 0.6, 2.3, 0.2, -2.5, 0.7, -1.9, -1.4, 2.6],
]

const CLUSTER_CENTERS_IL2RA: number[][] = [
  [2.2, -1.8, 0.5, 1.9, -0.7, 2.4, -1.1, 0.3, 1.7, -2.0],
  [-1.5, 2.7, -2.1, 0.4, 1.6, -0.9, 2.0, -1.4, -0.2, 1.8],
  [0.7, 0.3, 2.5, -2.3, 0.8, -1.6, -0.5, 2.1, -1.8, 0.4],
  [-2.4, -0.6, -0.9, 1.2, -2.2, 0.5, 1.7, -0.7, 2.3, -1.3],
  [1.4, -2.0, 1.1, -0.8, 2.0, 1.4, -2.3, 1.2, -0.5, 2.2],
]

const CLUSTER_CENTERS_RSVF: number[][] = [
  [3.0, 2.5, -1.0, 0.5, 2.2, -1.5, 1.0, 2.8, -0.5, 1.5],
  [-2.5, 1.2, 2.8, -0.8, -1.6, 2.3, -0.9, 1.4, 2.0, -1.2],
  [0.5, -2.8, -1.5, 2.4, 0.9, -2.0, 2.5, -0.6, -1.8, 0.8],
  [-1.8, -0.4, 0.8, -2.6, 1.5, 0.7, -1.4, -2.2, 0.3, 2.4],
]

function buildEmbedding(clusterId: number, candidateIdx: number, centers: number[][], seed: number): number[] {
  const center = centers[clusterId % centers.length]
  const full64: number[] = new Array(64).fill(0)
  for (let d = 0; d < 64; d++) {
    const baseDim = d < center.length ? center[d] : 0
    full64[d] = baseDim + normalSample(seed + d * 1000 + candidateIdx * 7, 0, 0.35)
  }
  return full64
}

const PDL1_CLUSTERS: ClusterProfile[] = [
  { plddtMu: 0.90, plddtSigma: 0.03, iptmMu: 0.78, iptmSigma: 0.05, lenLo: 55, lenHi: 68 },
  { plddtMu: 0.83, plddtSigma: 0.04, iptmMu: 0.67, iptmSigma: 0.06, lenLo: 48, lenHi: 60 },
  { plddtMu: 0.76, plddtSigma: 0.05, iptmMu: 0.57, iptmSigma: 0.07, lenLo: 42, lenHi: 55 },
  { plddtMu: 0.85, plddtSigma: 0.04, iptmMu: 0.71, iptmSigma: 0.06, lenLo: 45, lenHi: 58 },
  { plddtMu: 0.68, plddtSigma: 0.06, iptmMu: 0.43, iptmSigma: 0.08, lenLo: 38, lenHi: 50 },
  { plddtMu: 0.61, plddtSigma: 0.05, iptmMu: 0.34, iptmSigma: 0.06, lenLo: 35, lenHi: 47 },
]

const IL2RA_CLUSTERS: ClusterProfile[] = [
  { plddtMu: 0.88, plddtSigma: 0.04, iptmMu: 0.76, iptmSigma: 0.06, lenLo: 55, lenHi: 68 },
  { plddtMu: 0.80, plddtSigma: 0.05, iptmMu: 0.63, iptmSigma: 0.07, lenLo: 45, lenHi: 58 },
  { plddtMu: 0.72, plddtSigma: 0.06, iptmMu: 0.50, iptmSigma: 0.09, lenLo: 38, lenHi: 52 },
  { plddtMu: 0.83, plddtSigma: 0.05, iptmMu: 0.69, iptmSigma: 0.07, lenLo: 48, lenHi: 62 },
  { plddtMu: 0.65, plddtSigma: 0.06, iptmMu: 0.40, iptmSigma: 0.08, lenLo: 35, lenHi: 48 },
]

const RSVF_CLUSTERS: ClusterProfile[] = [
  { plddtMu: 0.91, plddtSigma: 0.03, iptmMu: 0.82, iptmSigma: 0.04, lenLo: 50, lenHi: 65 },
  { plddtMu: 0.84, plddtSigma: 0.04, iptmMu: 0.71, iptmSigma: 0.06, lenLo: 42, lenHi: 58 },
  { plddtMu: 0.78, plddtSigma: 0.05, iptmMu: 0.60, iptmSigma: 0.07, lenLo: 38, lenHi: 52 },
  { plddtMu: 0.72, plddtSigma: 0.05, iptmMu: 0.50, iptmSigma: 0.07, lenLo: 35, lenHi: 48 },
]

function buildCandidate(
  idx: number,
  campaignPrefix: string,
  seedBase: number,
  cluster: ClusterProfile,
  clusterIdx: number,
  round: number,
  paeCount: number,
  centers: number[][],
  seqTemplate: string,
  roundBoost: number,
  extraMetrics: Record<string, number | string | boolean>
): Candidate {
  const s = seedBase + idx + 1
  const plddtRaw = normalSample(s * 7, cluster.plddtMu + roundBoost * 0.04, cluster.plddtSigma)
  const iptmRaw = normalSample(s * 13, cluster.iptmMu + roundBoost * 0.05, cluster.iptmSigma)
  const plddt = clamp(plddtRaw, 0.35, 0.98)
  const iptm = clamp(iptmRaw, 0.20, 0.95)
  const pae_interaction = clamp(normalSample(s * 19, lerp(15, 5, iptm), 2.5), 2.0, 29.0)
  const scrmsd = clamp(normalSample(s * 23, lerp(4.5, 1.0, plddt), 0.8), 0.4, 8.0)
  const seq_recovery = clamp(normalSample(s * 29, 0.35 + iptm * 0.15, 0.07), 0.10, 0.65)
  const ptm = clamp(plddt * 0.9 + normalSample(s * 31, 0, 0.03), 0.30, 0.98)
  const num_hotspot_contacts = clamp(Math.round(normalSample(s * 37, iptm * 14, 2.5)), 2, 18)
  const composite_score = clamp(iptm * 0.4 + (1 - pae_interaction / 31.75) * 0.3 + (1 - scrmsd / 10) * 0.3, 0, 1)
  const binderLen = randInt(s * 41, cluster.lenLo, cluster.lenHi)
  const sequence = randSeq(s, binderLen, seqTemplate)
  const plddtPerResidue = buildPlddtPerResidue(s, binderLen, plddt)

  const hasPae = idx < paeCount
  const hasStruct = idx < paeCount

  return {
    id: `${campaignPrefix}-${idx}`,
    name: `design_${String(idx + 1).padStart(4, '0')}`,
    sequence,
    structureData: hasStruct ? buildComplexPDB(sequence, plddtPerResidue) : undefined,
    structureFormat: hasStruct ? 'pdb' : undefined,
    metrics: {
      plddt,
      iptm,
      pae_interaction,
      ptm,
      scrmsd,
      seq_recovery,
      binder_length: binderLen,
      num_hotspot_contacts,
      composite_score,
      clusterFamily: clusterIdx,
      ...extraMetrics,
    },
    metadata: { round },
    source: undefined,
    embedding: buildEmbedding(clusterIdx, idx, centers, s),
    paeMatrix: hasPae ? buildComplexPaeMatrix(binderLen, iptm, plddt, s * 1009) : undefined,
    plddtPerResidue,
  }
}

function buildMetricFields(extra: MetricField[] = []): MetricField[] {
  return [
    { key: 'plddt', label: 'pLDDT', type: 'number', min: 0, max: 1 },
    { key: 'iptm', label: 'ipTM', type: 'number', min: 0, max: 1 },
    { key: 'pae_interaction', label: 'iPAE', type: 'number', unit: 'Å', min: 0, max: 31.75 },
    { key: 'ptm', label: 'pTM', type: 'number', min: 0, max: 1 },
    { key: 'scrmsd', label: 'scRMSD', type: 'number', unit: 'Å', min: 0, max: 10 },
    { key: 'seq_recovery', label: 'Seq. Recovery', type: 'number', min: 0, max: 1 },
    { key: 'binder_length', label: 'Binder Length', type: 'number', unit: 'aa', min: 0, max: 100 },
    { key: 'num_hotspot_contacts', label: 'Hotspot Contacts', type: 'number', min: 0, max: 20 },
    { key: 'composite_score', label: 'Composite Score', type: 'number', min: 0, max: 1 },
    { key: 'clusterFamily', label: 'Cluster', type: 'number', min: 0, max: 10 },
    ...extra,
    { key: 'dev_pi', label: 'pI', type: 'number', min: 3, max: 12 },
    { key: 'dev_gravy', label: 'GRAVY', type: 'number', min: -3, max: 3 },
    { key: 'dev_instability', label: 'Instability', type: 'number', min: 0, max: 100 },
    { key: 'dev_mw', label: 'MW (kDa)', type: 'number', unit: 'kDa', min: 0, max: 30 },
  ]
}

function buildExperimentalResults(
  campaignPrefix: string,
  total: number,
  binderCount: number,
  kdLo: number,
  kdHi: number,
  seedBase: number
): ExperimentalResult[] {
  return Array.from({ length: total }, (_, i) => {
    const isBinder = i < binderCount
    const kd = isBinder
      ? Math.exp(lerp(Math.log(kdLo), Math.log(kdHi), seeded(seedBase + i * 71)))
      : undefined
    const expressionRate = clamp(randRange(seedBase + i * 37, 0.1, 1.0), 0.05, 1.0)
    return {
      candidateId: `${campaignPrefix}-${i}`,
      round: 1,
      kd,
      expressionRate,
      bindingSuccess: isBinder,
      metadata: {},
      customMetrics: {},
    }
  })
}

function buildShortlistEntries(
  campaignId: string,
  candidateIds: string[],
  notes: Record<string, string> = {}
): ShortlistEntry[] {
  const now = new Date().toISOString()
  return candidateIds.map((candidateId) => ({
    candidateId,
    campaignId,
    addedAt: now,
    status: 'candidate' as const,
    notes: notes[candidateId] ?? '',
  }))
}

function buildPdl1Campaign(): Campaign {
  const campaignId = 'demo-pdl1-round1'
  const prefix = 'pdl1'
  const createdAt = '2024-03-15T09:00:00.000Z'

  const r1ClusterWeights = [0.20, 0.20, 0.20, 0.20, 0.10, 0.10]
  const r2Clusters = [0, 1, 3]
  const r3Clusters = [0, 1, 3]

  const candidates: Candidate[] = []

  for (let i = 0; i < 320; i++) {
    const cumWeights = r1ClusterWeights.reduce<number[]>((acc, w, idx) => {
      acc.push((acc[idx - 1] ?? 0) + w)
      return acc
    }, [])
    const rand = seeded(i * 1009 + 7)
    const clusterIdx = cumWeights.findIndex((cw) => rand < cw)
    const cluster = PDL1_CLUSTERS[clusterIdx]
    const ddg = clamp(normalSample(i * 53 + 1, -35 - cluster.plddtMu * 10, 8), -60, -15)
    candidates.push(buildCandidate(i, prefix, 1000, cluster, clusterIdx, 1, 72, CLUSTER_CENTERS_PDL1, 'FTVPWNISGQKLHVEYRGDLTCASPGEKFAMDNWR', 0, { rosetta_ddg: ddg }))
  }

  for (let i = 320; i < 432; i++) {
    const clusterIdx = r2Clusters[i % r2Clusters.length]
    const cluster = PDL1_CLUSTERS[clusterIdx]
    const ddg = clamp(normalSample(i * 53 + 1, -42 - cluster.plddtMu * 8, 6), -60, -15)
    candidates.push(buildCandidate(i, prefix, 1000, cluster, clusterIdx, 2, 72, CLUSTER_CENTERS_PDL1, 'FTVPWNISGQKLHVEYRGDLTCASPGEKFAMDNWR', 1, { rosetta_ddg: ddg }))
  }

  for (let i = 432; i < 480; i++) {
    const clusterIdx = r3Clusters[i % r3Clusters.length]
    const cluster = PDL1_CLUSTERS[clusterIdx]
    const ddg = clamp(normalSample(i * 53 + 1, -48 - cluster.plddtMu * 6, 5), -60, -15)
    candidates.push(buildCandidate(i, prefix, 1000, cluster, clusterIdx, 3, 72, CLUSTER_CENTERS_PDL1, 'FTVPWNISGQKLHVEYRGDLTCASPGEKFAMDNWR', 2, { rosetta_ddg: ddg }))
  }

  const enriched = enrichWithDevMetrics(candidates)

  const n0 = 'pdl1-prov-0'
  const n1 = 'pdl1-prov-1'
  const n2 = 'pdl1-prov-2'
  const n3 = 'pdl1-prov-3'
  const n4 = 'pdl1-prov-4'

  const provenanceNodes: ProvenanceNode[] = [
    makeProvenanceNode(n0, 'import', 'RFdiffusion 10k backbones', daysOffset(createdAt, 0), [], [n1], 10000, { tool: 'rfdiffusion', backbones: 10000 }),
    makeProvenanceNode(n1, 'score', 'ProteinMPNN + AF2 validation', daysOffset(createdAt, 0.33), [n0], [n2], 1240, { tool: 'proteinmpnn', sequences_per_backbone: 20, af2_filter: 'pLDDT>75,iPAE<12' }),
    makeProvenanceNode(n2, 'score', 'AF2 multimer revalidation', daysOffset(createdAt, 1), [n1], [n3], 1240, { tool: 'alphafold2', mode: 'multimer' }),
    makeProvenanceNode(n3, 'filter', 'Quality filter pLDDT>82, ipTM>0.60', daysOffset(createdAt, 2), [n2], [n4], 387, { plddt_min: 0.82, iptm_min: 0.60 }),
    makeProvenanceNode(n4, 'shortlist', 'Round 1 shortlist composite>0.60', daysOffset(createdAt, 3), [n3], [], 95, { composite_min: 0.60, selected: 95 }),
  ]

  const target: TargetProtein = {
    name: 'PD-L1 IgV domain',
    structureData: buildTargetPDB('B'),
    structureFormat: 'pdb',
    hotspotResidues: [
      { chainId: 'B', residueIndex: 56, residueName: 'TYR' },
      { chainId: 'B', residueIndex: 58, residueName: 'GLU' },
      { chainId: 'B', residueIndex: 113, residueName: 'ARG' },
      { chainId: 'B', residueIndex: 115, residueName: 'MET' },
    ],
  }

  const experimentalResults = buildExperimentalResults(prefix, 48, 14, 2, 850, 5001)

  return {
    id: campaignId,
    name: 'PD-L1 Binder Design — Multi-Round Campaign',
    source: 'rfdiffusion',
    createdAt,
    candidates: enriched,
    metricFields: buildMetricFields([{ key: 'rosetta_ddg', label: 'Rosetta ΔΔG', type: 'number', unit: 'REU', min: -65, max: -10 }]),
    provenanceNodes,
    metadata: { demo: true, target: 'PD-L1' },
    target,
    experimentalResults,
  }
}

function buildIl2raCampaign(): Campaign {
  const campaignId = 'demo-il2ra-round1'
  const prefix = 'il2ra'
  const createdAt = '2024-01-10T08:00:00.000Z'

  const r1ClusterWeights = [0.25, 0.25, 0.20, 0.20, 0.10]
  const r2Clusters = [0, 1, 3]

  const candidates: Candidate[] = []

  for (let i = 0; i < 250; i++) {
    const cumWeights = r1ClusterWeights.reduce<number[]>((acc, w, idx) => {
      acc.push((acc[idx - 1] ?? 0) + w)
      return acc
    }, [])
    const rand = seeded(i * 1009 + 13)
    const clusterIdx = cumWeights.findIndex((cw) => rand < cw)
    const cluster = IL2RA_CLUSTERS[clusterIdx]
    candidates.push(buildCandidate(i, prefix, 2000, cluster, clusterIdx, 1, 55, CLUSTER_CENTERS_IL2RA, 'HCPSCDSYTAELCDISGLRAHEKCERFLNMQVWST', 0, {}))
  }

  for (let i = 250; i < 320; i++) {
    const clusterIdx = r2Clusters[i % r2Clusters.length]
    const cluster = IL2RA_CLUSTERS[clusterIdx]
    candidates.push(buildCandidate(i, prefix, 2000, cluster, clusterIdx, 2, 55, CLUSTER_CENTERS_IL2RA, 'HCPSCDSYTAELCDISGLRAHEKCERFLNMQVWST', 1, {}))
  }

  const enriched = enrichWithDevMetrics(candidates)

  const n0 = 'il2ra-prov-0'
  const n1 = 'il2ra-prov-1'
  const n2 = 'il2ra-prov-2'
  const n3 = 'il2ra-prov-3'

  const provenanceNodes: ProvenanceNode[] = [
    makeProvenanceNode(n0, 'import', 'RFdiffusion 7k backbones', daysOffset(createdAt, 0), [], [n1], 7000, { tool: 'rfdiffusion', backbones: 7000 }),
    makeProvenanceNode(n1, 'score', 'ProteinMPNN + AF2 multimer', daysOffset(createdAt, 1), [n0], [n2], 750, { tool: 'proteinmpnn', af2_filter: 'multimer_pLDDT>75' }),
    makeProvenanceNode(n2, 'filter', 'Quality filter pLDDT>80, ipTM>0.55', daysOffset(createdAt, 2), [n1], [n3], 320, { plddt_min: 0.80, iptm_min: 0.55 }),
    makeProvenanceNode(n3, 'shortlist', 'DBTL shortlist top-54', daysOffset(createdAt, 3), [n2], [], 54, { selected: 54 }),
  ]

  const target: TargetProtein = {
    name: 'IL-2Rα sushi domain',
    structureData: buildTargetPDB('B'),
    structureFormat: 'pdb',
    hotspotResidues: [
      { chainId: 'B', residueIndex: 34, residueName: 'CYS' },
      { chainId: 'B', residueIndex: 37, residueName: 'SER' },
      { chainId: 'B', residueIndex: 52, residueName: 'TYR' },
      { chainId: 'B', residueIndex: 55, residueName: 'LEU' },
    ],
  }

  const experimentalResults = buildExperimentalResults(prefix, 36, 11, 8, 1200, 6001)

  return {
    id: campaignId,
    name: 'IL-2Rα Binder Design — DBTL Round 1→2',
    source: 'rfdiffusion',
    createdAt,
    candidates: enriched,
    metricFields: buildMetricFields(),
    provenanceNodes,
    metadata: { demo: true, target: 'IL-2Ra' },
    target,
    experimentalResults,
  }
}

function buildRsvfCampaign(): Campaign {
  const campaignId = 'demo-rsvf-site0'
  const prefix = 'rsvf'
  const createdAt = '2024-05-20T10:00:00.000Z'

  const r1ClusterWeights = [0.30, 0.30, 0.25, 0.15]

  const candidates: Candidate[] = []

  for (let i = 0; i < 150; i++) {
    const cumWeights = r1ClusterWeights.reduce<number[]>((acc, w, idx) => {
      acc.push((acc[idx - 1] ?? 0) + w)
      return acc
    }, [])
    const rand = seeded(i * 1009 + 19)
    const clusterIdx = cumWeights.findIndex((cw) => rand < cw)
    const cluster = RSVF_CLUSTERS[clusterIdx]
    candidates.push(buildCandidate(i, prefix, 3000, cluster, clusterIdx, 1, 40, CLUSTER_CENTERS_RSVF, 'MSKNKNRRGDHCLAETGRMKELKVYGPQKKTLRQAWE', 0, {}))
  }

  const enriched = enrichWithDevMetrics(candidates)

  const n0 = 'rsvf-prov-0'
  const n1 = 'rsvf-prov-1'
  const n2 = 'rsvf-prov-2'

  const provenanceNodes: ProvenanceNode[] = [
    makeProvenanceNode(n0, 'import', 'BindCraft 150 designs', daysOffset(createdAt, 0), [], [n1], 150, { tool: 'bindcraft', target: 'RSV-F site Ø' }),
    makeProvenanceNode(n1, 'score', 'AF2 revalidation (all 150)', daysOffset(createdAt, 0.5), [n0], [n2], 150, { tool: 'alphafold2', mode: 'multimer', all_pass: true }),
    makeProvenanceNode(n2, 'shortlist', 'BindCraft shortlist top-30', daysOffset(createdAt, 1), [n1], [], 30, { selected: 30, criterion: 'composite>0.65' }),
  ]

  const target: TargetProtein = {
    name: 'RSV F protein site Ø apex',
    structureData: buildTargetPDB('B'),
    structureFormat: 'pdb',
    hotspotResidues: [
      { chainId: 'B', residueIndex: 62, residueName: 'LYS' },
      { chainId: 'B', residueIndex: 65, residueName: 'GLN' },
      { chainId: 'B', residueIndex: 196, residueName: 'PHE' },
      { chainId: 'B', residueIndex: 200, residueName: 'LEU' },
    ],
  }

  const experimentalResults = buildExperimentalResults(prefix, 30, 16, 1, 400, 7001)

  return {
    id: campaignId,
    name: 'RSV F Prefusion Site Ø Binders — BindCraft',
    source: 'bindcraft',
    createdAt,
    candidates: enriched,
    metricFields: buildMetricFields(),
    provenanceNodes,
    metadata: { demo: true, target: 'RSV-F' },
    target,
    experimentalResults,
  }
}

export function buildAllDemoCampaigns(): { campaign: Campaign; shortlistEntries: ShortlistEntry[] }[] {
  const pdl1 = buildPdl1Campaign()
  const il2ra = buildIl2raCampaign()
  const rsvf = buildRsvfCampaign()

  const pdl1ShortlistIds = [
    ...Array.from({ length: 48 }, (_, i) => `pdl1-${i}`),
    ...Array.from({ length: 48 }, (_, i) => `pdl1-${432 + i}`),
  ]
  const pdl1Notes: Record<string, string> = {
    'pdl1-0': 'Top hit — Kd 2 nM, best-in-round composite',
    'pdl1-1': 'Strong binder, excellent cluster 0 representative',
    'pdl1-5': 'Promising beta-hairpin binder, follow-up in R3',
    'pdl1-432': 'R3 champion — highest composite score across all rounds',
    'pdl1-433': 'R3 top-2, confirmed binder in biophysical assay',
  }

  const il2raShortlistIds = Array.from({ length: 36 }, (_, i) => `il2ra-${i}`)
  const il2raNotes: Record<string, string> = {
    'il2ra-0': 'Top hit — Kd 8 nM, excellent thermal stability',
    'il2ra-3': 'Strong binder, high expression',
    'il2ra-7': 'Confirmed binder, follow-up in R2',
  }

  const rsvfShortlistIds = Array.from({ length: 30 }, (_, i) => `rsvf-${i}`)
  const rsvfNotes: Record<string, string> = {
    'rsvf-0': 'Site Ø champion — Kd 1 nM, blocks F-protein prefusion trimer',
    'rsvf-1': 'Strong neutralizing binder, Kd 3 nM',
    'rsvf-4': 'High expression + strong binding, priority for animal model',
  }

  return [
    {
      campaign: pdl1,
      shortlistEntries: buildShortlistEntries(pdl1.id, pdl1ShortlistIds, pdl1Notes),
    },
    {
      campaign: il2ra,
      shortlistEntries: buildShortlistEntries(il2ra.id, il2raShortlistIds, il2raNotes),
    },
    {
      campaign: rsvf,
      shortlistEntries: buildShortlistEntries(rsvf.id, rsvfShortlistIds, rsvfNotes),
    },
  ]
}

export function buildDemoCampaign(): Campaign {
  return buildPdl1Campaign()
}

export function buildDemoShortlist(campaignId: string): ShortlistEntry[] {
  const ids = Array.from({ length: 48 }, (_, i) => `pdl1-${i}`)
  return buildShortlistEntries(campaignId, ids)
}
