'use client'

import { useMemo, useRef, useState, useCallback } from 'react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { colorByAminoacid, colorByPlddt, piColor, chargeColor, gravyColor, instabilityColor } from '../lib/color-schemes'
import { EmptyState } from '@/shared/components/EmptyState'
import { SequenceLogo } from './SequenceLogo'
import { computeDevMetrics } from '@/features/developability'
import type { Candidate } from '@/shared/types'

interface SequencePanelProps {
  candidate: Candidate | null
  className?: string
}

const CELL_W = 18
const CELL_H = 26
const RULER_H = 18
const PLDDT_H = 10

function formatCharge(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1)
}

interface SeqPropsProps {
  sequence: string
}

function SeqProps({ sequence }: SeqPropsProps) {
  const metrics = useMemo(() => computeDevMetrics(sequence), [sequence])

  const chips: { label: string; value: string; colorClass: string }[] = [
    { label: 'pI', value: metrics.dev_pi.toFixed(1), colorClass: piColor(metrics.dev_pi) },
    { label: 'Charge', value: formatCharge(metrics.dev_charge_ph7), colorClass: chargeColor(metrics.dev_charge_ph7) },
    { label: 'MW', value: metrics.dev_mw.toFixed(1) + ' kDa', colorClass: 'text-foreground' },
    { label: 'GRAVY', value: metrics.dev_gravy.toFixed(2), colorClass: gravyColor(metrics.dev_gravy) },
    { label: 'Instability', value: metrics.dev_instability.toFixed(1), colorClass: instabilityColor(metrics.dev_instability) },
    { label: 'Length', value: metrics.dev_length.toString() + ' aa', colorClass: 'text-foreground' },
  ]

  return (
    <div className="border-t border-border pt-4 mt-4 px-3 pb-3">
      <p className="text-xs font-semibold text-foreground mb-2">Sequence Properties</p>
      <div className="grid grid-cols-3 gap-2">
        {chips.map(({ label, value, colorClass }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card/50 px-3 py-2 flex flex-col gap-0.5"
          >
            <span className="text-[10px] text-muted-foreground">{label}</span>
            <span className={`text-xs font-mono font-medium ${colorClass}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SequencePanel({ candidate, className }: SequencePanelProps) {
  const selectedResidues = useViewerStore((s) => s.selectedResidues)
  const setSelectedResidues = useViewerStore((s) => s.setSelectedResidues)
  const toggleResidueSelection = useViewerStore((s) => s.toggleResidueSelection)
  const interfaceResidueIds = useViewerStore((s) => s.interfaceResidueIds)
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
  const interfaceSet = useMemo(() => new Set(interfaceResidueIds), [interfaceResidueIds])

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
    return <EmptyState message="No candidate selected" className={`text-sm not-italic ${className ?? ''}`} />
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
              const bg = colorByAminoacid(aa)
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

          {interfaceSet.size > 0 && (
            <div className="flex mt-px" title="Interface residues (contact with target)">
              {sequence.split('').map((_, i) => {
                const residueId = `A:${i + 1}`
                const isInterface = interfaceSet.has(residueId)
                return (
                  <div
                    key={i}
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: CELL_W, height: 6, marginRight: 1 }}
                  >
                    {isInterface && (
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500/80" />
                    )}
                  </div>
                )
              })}
            </div>
          )}

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
                    background: colorByPlddt(v),
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

      {candidate.sequence && <SeqProps sequence={candidate.sequence} />}

      {shortlistSequences.length >= 2 && (
        <div className="border-t border-border flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2 shrink-0 bg-muted/20">
            <p className="text-xs font-semibold text-foreground">Conservation Logo</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Letter height = information content across {shortlistSequences.length} shortlisted sequences. Not a repeat of the sequence above.
            </p>
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 pb-2 pt-1">
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
