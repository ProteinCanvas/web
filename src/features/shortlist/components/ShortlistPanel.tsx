'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { X, CheckCircle, XCircle, Download, FlaskConical, ChevronDown, Shuffle } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { getMetricDirection } from '@/shared/lib/metric-registry'
import { enrichWithDevMetrics } from '@/features/developability'
import type { Campaign, Candidate, ShortlistEntry, ShortlistStatus } from '@/shared/types'
import {
  exportShortlistBundle,
  exportShortlistFasta,
  exportShortlistCsv,
  exportTwistCsv,
  exportIdtCsv,
  exportPymolScript,
  type NTerminalTag,
  type ExpressionHost,
} from '../lib/exporters'

const DEV_METRIC_KEYS = [
  'dev_gravy',
  'dev_pi',
  'dev_instability',
  'dev_mw',
  'dev_charge_ph7',
  'dev_length',
] as const

function hammingDistance(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  let dist = Math.abs(a.length - b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++
  }
  return dist
}

function selectDiverseSubset(candidates: Candidate[], n: number, scoreKey: string): string[] {
  const withSeq = candidates.filter((c) => c.sequence && c.sequence.length > 0)
  if (withSeq.length === 0) return []
  if (withSeq.length <= n) return withSeq.map((c) => c.id)

  const direction = getMetricDirection(scoreKey)
  const sorted = [...withSeq].sort((a, b) => {
    const va = typeof a.metrics[scoreKey] === 'number' ? (a.metrics[scoreKey] as number) : 0
    const vb = typeof b.metrics[scoreKey] === 'number' ? (b.metrics[scoreKey] as number) : 0
    return direction === 'lower' ? va - vb : vb - va
  })

  const selected: Candidate[] = [sorted[0]]
  const remaining = sorted.slice(1)

  while (selected.length < n && remaining.length > 0) {
    let maxMinDist = -1
    let bestIdx = 0

    for (let i = 0; i < remaining.length; i++) {
      const seq = remaining[i].sequence!
      let minDist = Infinity
      for (const s of selected) {
        const d = hammingDistance(seq, s.sequence!)
        if (d < minDist) minDist = d
      }
      if (minDist > maxMinDist) {
        maxMinDist = minDist
        bestIdx = i
      }
    }

    selected.push(remaining[bestIdx])
    remaining.splice(bestIdx, 1)
  }

  return selected.map((c) => c.id)
}

interface ShortlistPanelProps {
  campaign: Campaign
  className?: string
}

const STATUS_COLORS: Record<ShortlistStatus, string> = {
  candidate: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  priority: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  approved: 'bg-green-500/20 text-green-400 border-green-500/40',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/40',
}

const STATUS_OPTIONS: ShortlistStatus[] = ['candidate', 'priority', 'approved', 'rejected']

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ExportDropdown({ campaign, shortlist }: {
  campaign: Campaign
  shortlist: ShortlistEntry[]
}) {
  const [open, setOpen] = useState(false)
  const [showWetLab, setShowWetLab] = useState(false)
  const [wetLabTag, setWetLabTag] = useState<NTerminalTag>('his6tev')
  const [wetLabHost, setWetLabHost] = useState<ExpressionHost>('human')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowWetLab(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const candidates = useMemo(() => {
    const raw = shortlist
      .map((e) => campaign.candidates.find((c) => c.id === e.candidateId))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
    return enrichWithDevMetrics(raw)
  }, [shortlist, campaign.candidates])

  const actions = [
    {
      label: 'Bundle (.pcz)',
      handler: async () => {
        const blob = await exportShortlistBundle(campaign, shortlist)
        downloadBlob(blob, `${campaign.name}-shortlist.pcz`)
        setOpen(false)
      },
    },
    {
      label: 'FASTA',
      handler: () => {
        const fasta = exportShortlistFasta(candidates, shortlist)
        downloadBlob(new Blob([fasta], { type: 'text/plain' }), `${campaign.name}-shortlist.fasta`)
        setOpen(false)
      },
    },
    {
      label: 'CSV',
      handler: () => {
        const campaignKeys = campaign.metricFields.map((f) => f.key)
        const seen = new Set<string>()
        const allKeys = [...campaignKeys, ...DEV_METRIC_KEYS].filter((k) => {
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        const csv = exportShortlistCsv(candidates, shortlist, allKeys)
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `${campaign.name}-shortlist.csv`)
        setOpen(false)
      },
    },
    {
      label: 'PyMOL script',
      handler: () => {
        const script = exportPymolScript(candidates, shortlist)
        downloadBlob(new Blob([script], { type: 'text/plain' }), `${campaign.name}-pymol.py`)
        setOpen(false)
      },
    },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 text-muted-foreground px-2 py-1 rounded transition-colors"
      >
        <Download size={11} />
        Export
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.handler}
              className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted/50 transition-colors"
            >
              {a.label}
            </button>
          ))}
          <div className="border-t border-border">
            <button
              onClick={() => setShowWetLab((v) => !v)}
              className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors flex items-center gap-1.5"
            >
              <FlaskConical size={11} />
              Synthesis…
            </button>
            {showWetLab && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-8">Tag</label>
                    <select
                      value={wetLabTag}
                      onChange={(e) => setWetLabTag(e.target.value as NTerminalTag)}
                      className="flex-1 text-xs border rounded px-1.5 py-0.5 bg-background"
                    >
                      <option value="none">None</option>
                      <option value="his6">6×His</option>
                      <option value="his6tev">6×His-TEV</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-8">Host</label>
                    <select
                      value={wetLabHost}
                      onChange={(e) => setWetLabHost(e.target.value as ExpressionHost)}
                      className="flex-1 text-xs border rounded px-1.5 py-0.5 bg-background"
                    >
                      <option value="human">Human</option>
                      <option value="ecoli">E. coli</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      const csv = exportTwistCsv(candidates, shortlist, { tag: wetLabTag, host: wetLabHost })
                      downloadBlob(new Blob([csv], { type: 'text/csv' }), `${campaign.name}-twist.csv`)
                      setOpen(false)
                    }}
                    className="flex-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded transition-colors"
                  >
                    Twist
                  </button>
                  <button
                    onClick={() => {
                      const csv = exportIdtCsv(candidates, shortlist, { tag: wetLabTag, host: wetLabHost })
                      downloadBlob(new Blob([csv], { type: 'text/csv' }), `${campaign.name}-idt.csv`)
                      setOpen(false)
                    }}
                    className="flex-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-1 rounded transition-colors"
                  >
                    IDT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DiverseSelectPanel({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false)
  const [n, setN] = useState(48)
  const [scoreKey, setScoreKey] = useState('')
  const addToShortlist = useCampaignStore((s) => s.addToShortlist)

  const numericKeys = useMemo(() => {
    return campaign.metricFields.filter((f) => f.type === 'number').map((f) => f.key)
  }, [campaign.metricFields])

  const currentScoreKey = scoreKey || numericKeys[0] || ''

  const withSeq = campaign.candidates.filter((c) => c.sequence && c.sequence.length > 0).length

  const handleSelect = () => {
    const ids = selectDiverseSubset(campaign.candidates, n, currentScoreKey)
    for (const id of ids) {
      addToShortlist({
        candidateId: id,
        campaignId: campaign.id,
        addedAt: new Date().toISOString(),
        status: 'candidate',
        notes: '',
      })
    }
    setOpen(false)
  }

  if (numericKeys.length === 0 || withSeq === 0) return null

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        <Shuffle size={11} />
        Select diverse subset
        <ChevronDown size={10} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2.5">
          <p className="text-[10px] text-muted-foreground">
            Greedy max-min diversity selection from {withSeq} sequenced candidates.
          </p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-14">Select N</label>
              <input
                type="number"
                min={1}
                max={withSeq}
                value={n}
                onChange={(e) => setN(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="flex-1 text-xs border rounded px-1.5 py-0.5 bg-background font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-14">Seed by</label>
              <select
                value={currentScoreKey}
                onChange={(e) => setScoreKey(e.target.value)}
                className="flex-1 text-xs border rounded px-1.5 py-0.5 bg-background"
              >
                {numericKeys.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSelect}
            className="w-full text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-2 py-1.5 rounded transition-colors font-medium"
          >
            Add {Math.min(n, withSeq)} diverse candidates to shortlist
          </button>
        </div>
      )}
    </div>
  )
}

export function ShortlistPanel({ campaign, className }: ShortlistPanelProps) {
  const shortlist = useCampaignStore((s) =>
    s.shortlist.filter((e) => e.campaignId === campaign.id)
  )
  const removeFromShortlist = useCampaignStore((s) => s.removeFromShortlist)
  const updateShortlistEntry = useCampaignStore((s) => s.updateShortlistEntry)

  const [orderedIds, setOrderedIds] = useState<string[]>(() => shortlist.map((e) => e.candidateId))
  const dragIndex = useRef<number | null>(null)

  useEffect(() => {
    const currentIds = new Set(shortlist.map((e) => e.candidateId))
    setOrderedIds((prev) => {
      const kept = prev.filter((id) => currentIds.has(id))
      const added = shortlist
        .filter((e) => !prev.includes(e.candidateId))
        .map((e) => e.candidateId)
      return [...kept, ...added]
    })
  }, [shortlist])

  const entryMap = new Map(shortlist.map((e) => [e.candidateId, e]))
  const candidateMap = new Map(campaign.candidates.map((c) => [c.id, c]))

  const displayEntries: ShortlistEntry[] = [
    ...orderedIds
      .filter((id) => entryMap.has(id))
      .map((id) => entryMap.get(id)!),
    ...shortlist.filter((e) => !orderedIds.includes(e.candidateId)),
  ]

  const handleDragStart = (index: number) => {
    dragIndex.current = index
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex.current === null || dragIndex.current === index) return
    const ids = displayEntries.map((e) => e.candidateId)
    const [moved] = ids.splice(dragIndex.current, 1)
    ids.splice(index, 0, moved)
    dragIndex.current = index
    setOrderedIds(ids)
  }

  const handleDragEnd = () => {
    dragIndex.current = null
  }

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className ?? ''}`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Shortlist</span>
          <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
            {shortlist.length}
          </span>
        </div>
        <ExportDropdown campaign={campaign} shortlist={shortlist} />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center px-4 py-8">
            <p className="text-xs text-muted-foreground">No candidates shortlisted yet</p>
            <p className="text-xs text-muted-foreground/60">
              Select any candidate in the table and press S to shortlist it, or click the bookmark icon.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {displayEntries.map((entry, index) => {
              const candidate = candidateMap.get(entry.candidateId)
              const hasSeq = Boolean(candidate?.sequence)
              const hasStruct = Boolean(candidate?.structureData)
              const hasNotes = entry.notes.trim().length > 0
              return (
                <li
                  key={entry.candidateId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="px-3 py-2.5 cursor-grab active:cursor-grabbing hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium text-foreground truncate">
                          {candidate?.name ?? entry.candidateId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <select
                          value={entry.status}
                          onChange={(e) =>
                            updateShortlistEntry(entry.candidateId, entry.campaignId, {
                              status: e.target.value as ShortlistStatus,
                            })
                          }
                          className={`text-xs border rounded px-1.5 py-0.5 bg-transparent cursor-pointer ${STATUS_COLORS[entry.status]}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s} className="bg-card text-foreground">
                              {s}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5 ml-auto">
                          {[
                            { ok: hasSeq, label: 'seq' },
                            { ok: hasStruct, label: 'str' },
                            { ok: hasNotes, label: 'note' },
                          ].map(({ ok, label }) => (
                            <span key={label} className="flex items-center gap-0.5 text-xs text-muted-foreground/60">
                              {ok ? (
                                <CheckCircle size={9} className="text-green-400" />
                              ) : (
                                <XCircle size={9} className="text-muted-foreground/30" />
                              )}
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={entry.notes}
                        onChange={(e) =>
                          updateShortlistEntry(entry.candidateId, entry.campaignId, {
                            notes: e.target.value,
                          })
                        }
                        placeholder="Notes…"
                        rows={2}
                        className="w-full text-xs bg-muted/30 border border-border rounded px-2 py-1 text-muted-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <button
                      onClick={() => removeFromShortlist(entry.candidateId, entry.campaignId)}
                      className="text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0 mt-0.5 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <DiverseSelectPanel campaign={campaign} />
      </div>
    </div>
  )
}
