'use client'

import { useRef, useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { colorByAminoacid, getCellColor } from '../lib/color-schemes'
import type { AlignedSequence, ColumnStats, AlignmentColorMode } from '../lib/alignment'
import type { Candidate } from '@/shared/types'

const CELL_W = 18
const COL_GAP = 1
const CELL_H = 24
const RULER_H = 20
const CONSERVATION_H = 28
const MUT_STRIP_H = 8
const SIDEBAR_W = 136

const PRIORITY_METRICS = ['iptm', 'ptm', 'plddt', 'confidence_score', 'aggregate_score']

function getTopMetric(candidate: Candidate): { key: string; value: number } | null {
  for (const key of PRIORITY_METRICS) {
    const v = candidate.metrics[key]
    if (typeof v === 'number') return { key, value: v }
  }
  return null
}

function RulerCell({ col }: { col: number }) {
  const pos = col + 1
  const isMajor = pos % 10 === 0
  const isMinor = pos % 5 === 0 && !isMajor
  return (
    <div
      className="relative flex flex-col items-center justify-end shrink-0"
      style={{ width: CELL_W, height: RULER_H }}
    >
      {isMajor ? (
        <>
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 text-muted-foreground/70 whitespace-nowrap leading-none"
            style={{ fontSize: 8 }}
          >
            {pos}
          </span>
          <div className="w-px bg-border/80" style={{ height: 7 }} />
        </>
      ) : isMinor ? (
        <div className="w-px bg-border/50" style={{ height: 4 }} />
      ) : (
        <div className="w-px bg-border/25" style={{ height: 2 }} />
      )}
    </div>
  )
}

function SequenceCell({
  aa,
  plddt,
  conservation,
  mutFreq,
  colorMode,
}: {
  aa: string
  plddt: number | null
  conservation: number
  mutFreq: number
  colorMode: AlignmentColorMode
}) {
  const isGap = aa === '-'
  const bg = isGap ? '#1f2937' : getCellColor(aa, plddt, conservation, mutFreq, colorMode)
  return (
    <div
      className="flex items-center justify-center font-mono font-bold rounded-sm shrink-0"
      style={{
        width: CELL_W,
        height: CELL_H,
        background: bg,
        fontSize: isGap ? 9 : 11,
        color: isGap ? '#4b5563' : '#fff',
        opacity: isGap ? 0.5 : 0.92,
      }}
    >
      {isGap ? '–' : aa}
    </div>
  )
}

function ConservationBar({ value, consensus }: { value: number; consensus: string }) {
  const barH = Math.max(value > 0.02 ? 2 : 0, value * CONSERVATION_H)
  const barColor = consensus !== '-' ? colorByAminoacid(consensus) : '#374151'
  return (
    <div
      className="flex flex-col justify-end shrink-0"
      style={{ width: CELL_W, height: CONSERVATION_H }}
    >
      <div
        style={{
          width: '100%',
          height: barH,
          background: barColor,
          opacity: 0.55 + 0.45 * value,
          borderRadius: '2px 2px 0 0',
        }}
      />
    </div>
  )
}

function MutationStrip({ value }: { value: number }) {
  const r = Math.round(195 + 60 * value)
  const g = Math.round(220 - 195 * value)
  const b = Math.round(220 - 205 * value)
  return (
    <div
      className="shrink-0 rounded-sm"
      style={{
        width: CELL_W,
        height: MUT_STRIP_H,
        background: `rgb(${r},${g},${b})`,
        opacity: value > 0.02 ? 1 : 0.25,
      }}
    />
  )
}

interface MSAGridProps {
  candidates: Candidate[]
  aligned: AlignedSequence[]
  colStats: ColumnStats
  colorMode: AlignmentColorMode
  onCandidateClick?: (candidateId: string) => void
}

export function MSAGrid({ candidates, aligned, colStats, colorMode, onCandidateClick }: MSAGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)

  const alignedLength = aligned[0]?.gapped.length ?? 0
  const totalH = RULER_H + aligned.length * (CELL_H + COL_GAP) + CONSERVATION_H + MUT_STRIP_H + COL_GAP * 2

  const colVirtualizer = useVirtualizer({
    count: alignedLength,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CELL_W + COL_GAP,
    horizontal: true,
    overscan: 20,
  })

  const handleMouseLeave = useCallback(() => setHoveredCol(null), [setHoveredCol])

  return (
    <div className="flex h-full w-full overflow-hidden select-none">
      <div
        className="shrink-0 flex flex-col border-r border-border bg-card"
        style={{ width: SIDEBAR_W }}
      >
        <div style={{ height: RULER_H }} />
        {candidates.map((c) => {
          const metric = getTopMetric(c)
          return (
            <div
              key={c.id}
              className="flex items-center gap-1.5 px-2 cursor-pointer hover:bg-muted/40 transition-colors"
              style={{ height: CELL_H + COL_GAP }}
              onClick={() => onCandidateClick?.(c.id)}
            >
              <span className="text-[10px] font-medium text-foreground truncate flex-1 min-w-0">
                {c.name}
              </span>
              {metric && (
                <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                  {metric.value.toFixed(2)}
                </span>
              )}
            </div>
          )
        })}
        <div
          className="flex items-end pb-1 px-2"
          style={{ height: CONSERVATION_H }}
        >
          <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wide leading-none">
            Cons.
          </span>
        </div>
        <div
          className="flex items-center px-2"
          style={{ height: MUT_STRIP_H + COL_GAP * 2 }}
        >
          <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wide leading-none">
            Mut.
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            width: colVirtualizer.getTotalSize(),
            height: totalH,
            position: 'relative',
          }}
        >
          {colVirtualizer.getVirtualItems().map((virtualCol) => {
            const col = virtualCol.index
            const isHovered = col === hoveredCol
            const conservation = colStats.conservation[col] ?? 0
            const mutFreq = colStats.mutationFreq[col] ?? 0
            const consensus = colStats.consensus[col] ?? '-'

            return (
              <div
                key={col}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: virtualCol.start,
                  width: CELL_W,
                  height: totalH,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: COL_GAP,
                }}
                onMouseEnter={() => setHoveredCol(col)}
              >
                {isHovered && (
                  <div
                    className="absolute inset-0 z-10 pointer-events-none rounded-sm"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                    }}
                  />
                )}

                <RulerCell col={col} />

                {aligned.map((seq) => (
                  <SequenceCell
                    key={seq.candidateId}
                    aa={seq.gapped[col] ?? '-'}
                    plddt={seq.plddtAtColumn[col] ?? null}
                    conservation={conservation}
                    mutFreq={mutFreq}
                    colorMode={colorMode}
                  />
                ))}

                <ConservationBar value={conservation} consensus={consensus} />
                <MutationStrip value={mutFreq} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
