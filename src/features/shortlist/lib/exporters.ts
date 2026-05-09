import JSZip from 'jszip'
import type { Campaign, Candidate, ShortlistEntry } from '@/shared/types'
import { buildReplayManifest } from '@/features/provenance/lib/replay-manifest'

export async function exportShortlistBundle(
  campaign: Campaign,
  entries: ShortlistEntry[]
): Promise<Blob> {
  const zip = new JSZip()

  const shortlistedIds = new Set(entries.map((e) => e.candidateId))
  const candidates = campaign.candidates.filter((c) => shortlistedIds.has(c.id))

  const manifest = buildReplayManifest(campaign, Array.from(shortlistedIds))
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  zip.file('candidates.json', JSON.stringify(candidates, null, 2))

  const structures = zip.folder('structures')
  if (structures) {
    for (const candidate of candidates) {
      if (candidate.structureData) {
        const ext = candidate.structureFormat ?? 'pdb'
        structures.file(`${candidate.id}.${ext}`, candidate.structureData)
      }
    }
  }

  zip.file('shortlist.fasta', exportShortlistFasta(candidates, entries))

  const provenanceData = {
    campaignId: campaign.id,
    nodes: campaign.provenanceNodes,
  }
  zip.file('provenance.json', JSON.stringify(provenanceData, null, 2))

  return zip.generateAsync({ type: 'blob' })
}

export function exportShortlistFasta(
  candidates: Candidate[],
  entries: ShortlistEntry[]
): string {
  const entryMap = new Map(entries.map((e) => [e.candidateId, e]))
  return candidates
    .filter((c) => c.sequence)
    .map((c) => {
      const entry = entryMap.get(c.id)
      const status = entry?.status ?? 'candidate'
      return `>${c.id} ${c.name} status=${status}\n${c.sequence}`
    })
    .join('\n')
}

export function exportShortlistCsv(
  candidates: Candidate[],
  entries: ShortlistEntry[],
  metricKeys: string[]
): string {
  const entryMap = new Map(entries.map((e) => [e.candidateId, e]))

  const headers = ['id', 'name', 'sequence', 'status', 'notes', ...metricKeys]

  const rows = candidates.map((c) => {
    const entry = entryMap.get(c.id)
    const base = [
      c.id,
      c.name,
      c.sequence ?? '',
      entry?.status ?? '',
      entry?.notes ?? '',
    ]
    const metrics = metricKeys.map((k) => {
      const v = c.metrics[k]
      return v !== undefined ? String(v) : ''
    })
    return [...base, ...metrics]
      .map((v) => `"${String(v).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`)
      .join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

export { buildReplayManifest as generateReplayManifest } from '@/features/provenance/lib/replay-manifest'

export function exportPymolScript(
  candidates: Candidate[],
  entries: ShortlistEntry[]
): string {
  const entryMap = new Map(entries.map((e) => [e.candidateId, e]))
  const withStructure = candidates.filter((c) => c.structureData && c.structureFormat === 'pdb')

  const lines: string[] = [
    'from pymol import cmd',
    '',
    '# Load structures',
  ]

  for (const c of withStructure) {
    const safeName = c.name.replace(/[^a-zA-Z0-9_]/g, '_')
    lines.push(`cmd.read_pdbstr("""${c.structureData}""", "${safeName}")`)
  }

  if (withStructure.length > 1) {
    lines.push('')
    lines.push('# Align all to first structure')
    const firstName = withStructure[0].name.replace(/[^a-zA-Z0-9_]/g, '_')
    for (const c of withStructure.slice(1)) {
      const safeName = c.name.replace(/[^a-zA-Z0-9_]/g, '_')
      lines.push(`cmd.align("${safeName}", "${firstName}")`)
    }
  }

  lines.push('')
  lines.push('# Apply pLDDT-style coloring')
  for (const c of withStructure) {
    const safeName = c.name.replace(/[^a-zA-Z0-9_]/g, '_')
    const plddt = typeof c.metrics['plddt'] === 'number' ? c.metrics['plddt'] as number : null
    const status = entryMap.get(c.id)?.status ?? 'candidate'
    lines.push(`# ${c.name} | pLDDT: ${plddt?.toFixed(1) ?? 'N/A'} | status: ${status}`)
    lines.push(`cmd.color("blue", "${safeName} and b > 90")`)
    lines.push(`cmd.color("cyan", "${safeName} and b > 70 and b <= 90")`)
    lines.push(`cmd.color("yellow", "${safeName} and b > 50 and b <= 70")`)
    lines.push(`cmd.color("red", "${safeName} and b <= 50")`)
  }

  lines.push('')
  lines.push('# Rendering settings')
  lines.push('cmd.show("cartoon")')
  lines.push('cmd.hide("lines")')
  lines.push('cmd.bg_color("white")')
  lines.push('cmd.set("ray_opaque_background", 0)')
  lines.push('cmd.set("cartoon_fancy_helices", 1)')
  lines.push('cmd.set("cartoon_smooth_loops", 1)')
  lines.push('cmd.zoom("all")')
  lines.push('')
  lines.push('# Uncomment to render:')
  lines.push('# cmd.ray(1200, 900)')
  lines.push('# cmd.png("output.png", dpi=300)')

  return lines.join('\n')
}

const HUMAN_CODONS: Record<string, string> = {
  A:'GCC', R:'CGG', N:'AAC', D:'GAC', C:'TGC', Q:'CAG', E:'GAG',
  G:'GGC', H:'CAC', I:'ATC', L:'CTG', K:'AAG', M:'ATG', F:'TTC',
  P:'CCC', S:'AGC', T:'ACC', W:'TGG', Y:'TAC', V:'GTG',
}

const ECOLI_CODONS: Record<string, string> = {
  A:'GCG', R:'CGT', N:'AAC', D:'GAT', C:'TGC', Q:'CAG', E:'GAA',
  G:'GGC', H:'CAC', I:'ATT', L:'CTG', K:'AAA', M:'ATG', F:'TTT',
  P:'CCG', S:'AGC', T:'ACC', W:'TGG', Y:'TAT', V:'GTT',
}

export type ExpressionHost = 'human' | 'ecoli'
export type NTerminalTag = 'none' | 'his6' | 'his6tev'

const TAG_SEQUENCES: Record<NTerminalTag, string> = {
  none: '',
  his6: 'MHHHHHH',
  his6tev: 'MHHHHHHHSENLYFQG',
}

export function codonOptimize(proteinSeq: string, host: ExpressionHost): string {
  const table = host === 'human' ? HUMAN_CODONS : ECOLI_CODONS
  const seq = proteinSeq.toUpperCase()
  const codons: string[] = []
  for (const aa of seq) {
    const codon = table[aa]
    if (codon) codons.push(codon)
  }
  return codons.join('')
}

export interface WetLabExportOptions {
  tag: NTerminalTag
  host: ExpressionHost
  addStopCodon?: boolean
}

export function exportTwistCsv(
  candidates: Candidate[],
  entries: ShortlistEntry[],
  opts: WetLabExportOptions
): string {
  const { tag, host, addStopCodon = true } = opts
  const entryMap = new Map(entries.map((e) => [e.candidateId, e]))
  const header = 'Name,Sequence,Length,Status'
  const rows = candidates
    .filter((c) => c.sequence)
    .map((c) => {
      const entry = entryMap.get(c.id)
      const proteinSeq = TAG_SEQUENCES[tag] + c.sequence!
      const dnaSeq = codonOptimize(proteinSeq, host) + (addStopCodon ? 'TAA' : '')
      const status = entry?.status ?? 'candidate'
      const fields = [c.name, dnaSeq, String(dnaSeq.length), status]
      return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')
    })
  return [header, ...rows].join('\n')
}

export function exportIdtCsv(
  candidates: Candidate[],
  entries: ShortlistEntry[],
  opts: WetLabExportOptions
): string {
  const { tag, host, addStopCodon = true } = opts
  const entryMap = new Map(entries.map((e) => [e.candidateId, e]))
  const header = 'Name,Sequence,Length,Scale,Purification'
  const rows = candidates
    .filter((c) => c.sequence)
    .map((c) => {
      const entry = entryMap.get(c.id)
      const proteinSeq = TAG_SEQUENCES[tag] + c.sequence!
      const dnaSeq = codonOptimize(proteinSeq, host) + (addStopCodon ? 'TAA' : '')
      const scale = dnaSeq.length <= 500 ? '25nm' : '100nm'
      const _ = entry
      const fields = [c.name, dnaSeq, String(dnaSeq.length), scale, 'STD']
      return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')
    })
  return [header, ...rows].join('\n')
}
