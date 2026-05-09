'use client'

import type { AlignmentColorMode } from '../lib/alignment'

const COLOR_MODES: { id: AlignmentColorMode; label: string }[] = [
  { id: 'aminoacid', label: 'AA' },
  { id: 'plddt', label: 'pLDDT' },
  { id: 'conservation', label: 'Conservation' },
  { id: 'mutation-freq', label: 'Mutation' },
  { id: 'hydrophobicity', label: 'Hydrophob.' },
]

interface AlignmentToolbarProps {
  colorMode: AlignmentColorMode
  onColorModeChange: (mode: AlignmentColorMode) => void
  alignedLength: number
  numSequences: number
}

export function AlignmentToolbar({
  colorMode,
  onColorModeChange,
  alignedLength,
  numSequences,
}: AlignmentToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-card/90 shrink-0">
      <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
        {COLOR_MODES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onColorModeChange(id)}
            className={`px-2 py-1 text-[11px] rounded transition-colors font-medium ${
              colorMode === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums ml-auto">
        {numSequences} seq · {alignedLength} col
      </span>
    </div>
  )
}
