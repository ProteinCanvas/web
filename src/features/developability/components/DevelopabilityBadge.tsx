'use client'

import { useMemo, useState } from 'react'
import { computeDevelopability } from '../lib/compute'
import type { DevelopabilityProfile } from '../lib/compute'
import { statusBgColor, statusDotColor, statusTextColor } from '@/shared/lib/status-colors'

interface DevelopabilityBadgeProps {
  sequence: string
  className?: string
}

function scoreStyle(score: 'good' | 'warn' | 'flag'): string {
  return statusBgColor(score === 'flag' ? 'bad' : score)
}

function scoreDot(score: 'good' | 'warn' | 'flag'): string {
  return statusDotColor(score === 'flag' ? 'bad' : score)
}

function Popover({ profile }: { profile: DevelopabilityProfile }) {
  return (
    <div className="absolute z-50 left-full ml-2 top-0 w-56 rounded-lg border border-border bg-card shadow-lg p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-foreground">Developability</span>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${scoreStyle(profile.score)}`}>
          {profile.score}
        </span>
      </div>
      <div className="flex flex-col gap-1 mb-2 text-muted-foreground">
        <div className="flex justify-between">
          <span>pI</span>
          <span className={`font-mono ${statusTextColor(profile.pI < 4.5 || profile.pI > 10.5 ? 'bad' : 'neutral')}`}>
            {profile.pI}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Net charge (pH 7.4)</span>
          <span className={`font-mono ${statusTextColor(Math.abs(profile.netCharge) > 5 ? 'warn' : 'neutral')}`}>
            {profile.netCharge > 0 ? '+' : ''}{profile.netCharge}
          </span>
        </div>
      </div>
      {profile.liabilities.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          {profile.liabilities.map((l, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${statusDotColor(l.severity === 'flag' ? 'bad' : 'warn')}`} />
              <span className="text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      )}
      {profile.liabilities.length === 0 && (
        <p className={`text-xs ${statusTextColor('good')}`}>No chemical liabilities detected</p>
      )}
    </div>
  )
}

export function DevelopabilityBadge({ sequence, className }: DevelopabilityBadgeProps) {
  const [open, setOpen] = useState(false)

  const profile = useMemo(() => computeDevelopability(sequence), [sequence])

  return (
    <div
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${scoreStyle(profile.score)}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${scoreDot(profile.score)}`} />
        <span className="font-mono">{profile.pI.toFixed(1)}</span>
      </span>
      {open && <Popover profile={profile} />}
    </div>
  )
}
