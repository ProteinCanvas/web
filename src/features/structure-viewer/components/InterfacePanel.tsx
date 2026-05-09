'use client'

import { useMemo, useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { computeInterfaceResidues } from '@/shared/lib/pdb-utils'
import { useViewerStore } from '@/shared/store/viewerStore'
import type { Candidate, TargetProtein } from '@/shared/types'

interface InterfacePanelProps {
  candidate: Candidate
  target: TargetProtein
}

function plddtColor(plddt: number): string {
  if (plddt >= 90) return '#0053D6'
  if (plddt >= 70) return '#65CBF3'
  if (plddt >= 50) return '#FFDB13'
  return '#FF7D45'
}

function plddtLabel(plddt: number): string {
  if (plddt >= 90) return 'Very high'
  if (plddt >= 70) return 'Confident'
  if (plddt >= 50) return 'Low'
  return 'Very low'
}

export function InterfacePanel({ candidate, target }: InterfacePanelProps) {
  const [thresholdÅ, setThresholdÅ] = useState(8)
  const setSelectedResidues = useViewerStore((s) => s.setSelectedResidues)
  const setInterfaceResidueIds = useViewerStore((s) => s.setInterfaceResidueIds)

  const contacts = useMemo(() => {
    if (!candidate.structureData || !target.structureData) return []
    return computeInterfaceResidues(candidate.structureData, target.structureData, thresholdÅ)
  }, [candidate.structureData, target.structureData, thresholdÅ])

  useEffect(() => {
    setInterfaceResidueIds(contacts.map((c) => c.id))
    return () => setInterfaceResidueIds([])
  }, [contacts, setInterfaceResidueIds])

  const meanPlddt = useMemo(() => {
    if (contacts.length === 0) return null
    return contacts.reduce((sum, c) => sum + c.plddt, 0) / contacts.length
  }, [contacts])

  if (!candidate.structureData || !target.structureData) return null

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <Activity size={12} className="text-teal-500 shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1">Interface residues</span>
        {contacts.length > 0 && meanPlddt !== null && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            mean pLDDT{' '}
            <span className="font-mono font-medium" style={{ color: plddtColor(meanPlddt) }}>
              {meanPlddt.toFixed(1)}
            </span>
          </span>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0 w-12">
            {thresholdÅ} Å
          </span>
          <input
            type="range"
            min={4}
            max={12}
            step={1}
            value={thresholdÅ}
            onChange={(e) => setThresholdÅ(parseInt(e.target.value, 10))}
            className="flex-1 h-1 accent-teal-500 cursor-pointer"
          />
          <span className="text-[10px] text-muted-foreground shrink-0">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {contacts.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60 text-center py-2">
            No contacts found within {thresholdÅ} Å
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {contacts.map((c) => (
              <button
                key={c.id}
                onMouseEnter={() => setSelectedResidues([c.id])}
                onMouseLeave={() => setSelectedResidues([])}
                onClick={() => setSelectedResidues([c.id])}
                title={`${c.id} · pLDDT ${c.plddt.toFixed(1)} · ${c.minDistÅ.toFixed(1)} Å`}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors hover:opacity-80"
                style={{
                  borderColor: plddtColor(c.plddt) + '80',
                  color: plddtColor(c.plddt),
                  background: plddtColor(c.plddt) + '18',
                }}
              >
                {c.id}
              </button>
            ))}
          </div>
        )}

        {contacts.length > 0 && (
          <div className="flex items-center gap-2 pt-0.5">
            {(
              [
                { color: '#0053D6', label: 'Very high' },
                { color: '#65CBF3', label: 'Confident' },
                { color: '#FFDB13', label: 'Low' },
                { color: '#FF7D45', label: 'Very low' },
              ] as { color: string; label: string }[]
            )
              .filter(({ label }) => contacts.some((c) => plddtLabel(c.plddt) === label))
              .map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                  <span className="text-[9px] text-muted-foreground">{label}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
