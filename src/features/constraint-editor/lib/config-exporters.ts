import type { ConstraintSpec, ResidueRef, ResidueRange } from '@/shared/types'

function formatResidueRef(ref: ResidueRef): string {
  return `${ref.chainId}${ref.residueIndex}`
}

function formatResidueRange(range: ResidueRange): string {
  return `${range.chainId}${range.startIndex}-${range.endIndex}`
}

export function exportRFdiffusionConfig(spec: ConstraintSpec, numDesigns = 10): string {
  const lines: string[] = []

  if (spec.hotspots.length > 0) {
    const refs = spec.hotspots.map(formatResidueRef)
    lines.push(`hotspot_res: [${refs.join(', ')}]`)
  }

  if (spec.masks.length > 0) {
    const ranges = spec.masks.map(formatResidueRange)
    lines.push(`mask_res: [${ranges.join(', ')}]`)
  }

  if (spec.locks.length > 0) {
    const refs = spec.locks.map(formatResidueRef)
    lines.push(`locked_res: [${refs.join(', ')}]`)
  }

  if (spec.motifs.length > 0) {
    lines.push('motifs:')
    for (const motif of spec.motifs) {
      lines.push(`  - source_pdb: ${motif.sourcePdb}`)
      lines.push(`    residues: [${motif.residues.map(formatResidueRange).join(', ')}]`)
    }
  }

  if (spec.partialDiffusion) {
    lines.push(`partial_diffusion:`)
    lines.push(`  start_t: ${spec.partialDiffusion.startT}`)
    lines.push(
      `  residues: [${spec.partialDiffusion.residues.map(formatResidueRange).join(', ')}]`
    )
  }

  lines.push(`num_designs: ${numDesigns}`)

  return lines.join('\n')
}

export function exportBindCraftConfig(spec: ConstraintSpec): object {
  return {
    hotspot_res: spec.hotspots.map(formatResidueRef),
    mask_res: spec.masks.map(formatResidueRange),
    locked_res: spec.locks.map(formatResidueRef),
    motifs: spec.motifs.map((m) => ({
      source_pdb: m.sourcePdb,
      residues: m.residues.map(formatResidueRange),
    })),
    ...(spec.partialDiffusion && {
      partial_diffusion: {
        start_t: spec.partialDiffusion.startT,
        residues: spec.partialDiffusion.residues.map(formatResidueRange),
      },
    }),
  }
}

export function formatConfigDiff(prev: ConstraintSpec | null, next: ConstraintSpec): string {
  if (!prev) {
    return 'Initial configuration created.'
  }

  const parts: string[] = []

  const addedHotspots = next.hotspots.filter(
    (h) =>
      !prev.hotspots.some(
        (p) => p.chainId === h.chainId && p.residueIndex === h.residueIndex
      )
  )
  const removedHotspots = prev.hotspots.filter(
    (h) =>
      !next.hotspots.some(
        (n) => n.chainId === h.chainId && n.residueIndex === h.residueIndex
      )
  )

  if (addedHotspots.length > 0) {
    parts.push(`Added ${addedHotspots.length} hotspot${addedHotspots.length > 1 ? 's' : ''}: ${addedHotspots.map(formatResidueRef).join(', ')}.`)
  }
  if (removedHotspots.length > 0) {
    parts.push(`Removed ${removedHotspots.length} hotspot${removedHotspots.length > 1 ? 's' : ''}: ${removedHotspots.map(formatResidueRef).join(', ')}.`)
  }

  const addedMasks = next.masks.filter(
    (m) =>
      !prev.masks.some(
        (p) =>
          p.chainId === m.chainId &&
          p.startIndex === m.startIndex &&
          p.endIndex === m.endIndex
      )
  )
  const removedMasks = prev.masks.filter(
    (m) =>
      !next.masks.some(
        (n) =>
          n.chainId === m.chainId &&
          n.startIndex === m.startIndex &&
          n.endIndex === m.endIndex
      )
  )

  if (addedMasks.length > 0) {
    parts.push(`Added ${addedMasks.length} mask${addedMasks.length > 1 ? 's' : ''}.`)
  }
  if (removedMasks.length > 0) {
    parts.push(`Removed ${removedMasks.length} mask${removedMasks.length > 1 ? 's' : ''}.`)
  }

  const addedLocks = next.locks.filter(
    (l) =>
      !prev.locks.some(
        (p) => p.chainId === l.chainId && p.residueIndex === l.residueIndex
      )
  )
  const removedLocks = prev.locks.filter(
    (l) =>
      !next.locks.some(
        (n) => n.chainId === l.chainId && n.residueIndex === l.residueIndex
      )
  )

  if (addedLocks.length > 0) {
    parts.push(`Added ${addedLocks.length} lock${addedLocks.length > 1 ? 's' : ''}: ${addedLocks.map(formatResidueRef).join(', ')}.`)
  }
  if (removedLocks.length > 0) {
    parts.push(`Removed ${removedLocks.length} lock${removedLocks.length > 1 ? 's' : ''}: ${removedLocks.map(formatResidueRef).join(', ')}.`)
  }

  return parts.length > 0 ? parts.join(' ') : 'No changes'
}
