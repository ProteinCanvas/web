'use client'

import { useMemo, useRef, useState, useCallback } from 'react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { SequenceLogo } from './SequenceLogo'
import type { Candidate } from '@/shared/types'

interface SequencePanelProps {
  candidate: Candidate | null
  className?: string
}

const AA_BG: Record<string, string> = {
  F: '#7c3aed', Y: '#7c3aed', W: '#7c3aed', H: '#6d28d9',
  K: '#1d4ed8', R: '#1d4ed8',
  D: '#b91c1c', E: '#b91c1c',
  S: '#15803d', T: '#15803d', N: '#166534', Q: '#166534',
  V: '#b45309', I: '#b45309', L: '#b45309', M: '#92400e', A: '#78350f', C: '#854d0e',
  G: '#854d0e', P: '#a16207',
}
const AA_DEFAULT_BG = '#374151'

const CELL_W = 18
const CELL_H = 26
const RULER_H = 18
const PLDDT_H = 10

function getAABg(aa: string): string {
  return AA_BG[aa.toUpperCase()] ?? AA_DEFAULT_BG
}

function plddtToColor(value: number): string {
  const v = value > 1 ? value : value * 100
  if (v >= 90) return '#0053D6'
  if (v >= 70) return '#65CBF3'
  if (v >= 50) return '#FFDB13'
  return '#FF7D45'
}

export function SequencePanel({ candidate, className }: SequencePanelProps) {
  const selectedResidues = useViewerStore((s) => s.selectedResidues)
  const setSelectedResidues = useViewerStore((s) => s.setSelectedResidues)
  const toggleResidueSelection = useViewerStore((s) => s.toggleResidueSelection)
  const shortlist = useCampaignStore((s) => s.shortlist)
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const [jumpInput, setJumpInput] = useState('')
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const shortlistSequences = useMemo(() => {
    if (!activeCampaignId) return []
    const campaign = campaigns.find((c) => c.id === activeCampaignId)
    if (!campaign) return []
    const shortlistedIds = new Set(
      shortlist.filter((e) => e.campaignId === activeCampaignId).map((e) => e.candidateId)
    )
    return campaign.candidates
      .filter((c) => shortlistedIds.has(c.id) && c.sequence)
      .map((c) => c.sequence!)
  }, [shortlist, campaigns, activeCampaignId])

  const selectedSet = useMemo(() => new Set(selectedResidues), [selectedResidues])

  const highlightedPositions = useMemo(() => {
    if (!candidate?.sequence) return []
    return selectedResidues
      .map((rid) => {
        const match = rid.match(/^[A-Z]:(\d+)$/)
        return match ? parseInt(match[1], 10) - 1 : -1
      })
      .filter((i) => i >= 0)
  }, [selectedResidues, candidate])

  const handleResidueClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      const residueId = `A:${index + 1}`
      if (e.shiftKey && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, index)
        const end = Math.max(lastClickedIndex, index)
        const range = Array.from({ length: end - start + 1 }, (_, i) => `A:${start + i + 1}`)
        setSelectedResidues(range)
      } else {
        toggleResidueSelection(residueId)
        setLastClickedIndex(index)
      }
    },
    [lastClickedIndex, setSelectedResidues, toggleResidueSelection]
  )

  const handleJump = useCallback(() => {
    const pos = parseInt(jumpInput, 10)
    if (isNaN(pos) || !trackRef.current || !candidate?.sequence) return
    const clamped = Math.max(1, Math.min(pos, candidate.sequence.length))
    const cellLeft = (clamped - 1) * (CELL_W + 1)
    trackRef.current.scrollLeft = cellLeft - trackRef.current.clientWidth / 2
    setJumpInput('')
  }, [jumpInput, candidate])

  if (!candidate || !candidate.sequence) {
    return (
      <div className={`flex items-center justify-center h-full text-sm text-muted-foreground ${className ?? ''}`}>
        No candidate selected
      </div>
    )
  }

  const sequence = candidate.sequence
  const totalWidth = sequence.length * (CELL_W + 1)

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Length <span className="text-foreground font-medium font-mono">{sequence.length}</span>
          </span>
          {selectedResidues.length > 0 && (
            <span>
              Selected <span className="text-foreground font-medium font-mono">{selectedResidues.length}</span>
            </span>
          )}
          {selectedResidues.length > 0 && (
            <button
              onClick={() => { setSelectedResidues([]); setLastClickedIndex(null) }}
              className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJump() }}
            placeholder="Go to…"
            min={1}
            max={sequence.length}
            className="w-20 px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:border-primary font-mono"
          />
        </div>
      </div>

      <div ref={trackRef} className="overflow-x-auto overflow-y-hidden shrink-0 bg-background" style={{ paddingBottom: 2 }}>
        <div style={{ width: totalWidth, minWidth: totalWidth }}>
          <div
            className="relative flex"
            style={{ height: RULER_H }}
          >
            {sequence.split('').map((_, i) => {
              const pos = i + 1
              const isMajor = pos % 10 === 0
              const isMinor = pos % 5 === 0 && !isMajor
              return (
                <div
                  key={i}
                  className="relative shrink-0 flex flex-col items-center justify-end"
                  style={{ width: CELL_W, marginRight: 1 }}
                >
                  {isMajor ? (
                    <>
                      <span className="text-muted-foreground/70 leading-none mb-px absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ fontSize: 9 }}>
                        {pos}
                      </span>
                      <div className="w-px bg-border/80 shrink-0" style={{ height: 6 }} />
                    </>
                  ) : isMinor ? (
                    <div className="w-px bg-border/60 shrink-0 mb-px" style={{ height: 4 }} />
                  ) : (
                    <div className="w-px bg-border/20 shrink-0 mb-px" style={{ height: 2 }} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex">
            {sequence.split('').map((aa, i) => {
              const residueId = `A:${i + 1}`
              const isSelected = selectedSet.has(residueId)
              const bg = getAABg(aa)
              return (
                <button
                  key={i}
                  onClick={(e) => handleResidueClick(i, e)}
                  title={`${aa} ${i + 1}`}
                  className="shrink-0 flex items-center justify-center rounded-sm font-mono font-bold text-white transition-all focus:outline-none"
                  style={{
                    width: CELL_W,
                    height: CELL_H,
                    fontSize: 11,
                    marginRight: 1,
                    background: bg,
                    opacity: isSelected ? 1 : 0.85,
                    outline: isSelected ? '2px solid white' : 'none',
                    outlineOffset: isSelected ? '-2px' : '0',
                    zIndex: isSelected ? 1 : 'auto',
                    transform: isSelected ? 'scaleY(1.06)' : 'none',
                  }}
                >
                  {aa.toUpperCase()}
                </button>
              )
            })}
          </div>

          {candidate.plddtPerResidue && candidate.plddtPerResidue.length > 0 && (
            <div className="flex mt-px" title="pLDDT per residue">
              {candidate.plddtPerResidue.slice(0, sequence.length).map((v, i) => (
                <div
                  key={i}
                  className="shrink-0 rounded-sm"
                  style={{
                    width: CELL_W,
                    height: PLDDT_H,
                    marginRight: 1,
                    background: plddtToColor(v),
                    opacity: 0.9,
                  }}
                  title={`${sequence[i]} ${i + 1}: pLDDT ${v > 1 ? v.toFixed(1) : (v * 100).toFixed(1)}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {candidate.plddtPerResidue && candidate.plddtPerResidue.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1 border-t border-border shrink-0">
          <span className="text-[9px] text-muted-foreground">pLDDT</span>
          {[
            { color: '#0053D6', label: '>90' },
            { color: '#65CBF3', label: '70–90' },
            { color: '#FFDB13', label: '50–70' },
            { color: '#FF7D45', label: '<50' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}

      {shortlistSequences.length >= 2 && (
        <div className="border-t border-border flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-1.5 shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Conservation · {shortlistSequences.length} shortlisted sequences
            </span>
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 pb-2">
            <SequenceLogo
              sequences={shortlistSequences}
              highlightPositions={highlightedPositions}
              trackRef={trackRef}
            />
          </div>
        </div>
      )}

      {shortlistSequences.length < 2 && (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-xs text-muted-foreground/50 text-center">
            Shortlist 2+ candidates to see conservation
          </p>
        </div>
      )}
    </div>
  )
}
