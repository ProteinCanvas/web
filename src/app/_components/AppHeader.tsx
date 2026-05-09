'use client'

import { Dna, Plus, Star } from 'lucide-react'
import type { Campaign } from '@/shared/types'

interface AppHeaderProps {
  activeCampaign: Campaign | null
  shortlistCount: number
  onToggleImport: () => void
  onOpenShortlist: () => void
}

export function AppHeader({ activeCampaign, shortlistCount, onToggleImport, onOpenShortlist }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Dna size={20} className="text-primary" />
          <span className="font-bold text-sm tracking-tight">ProteinCanvas</span>
        </div>
        {activeCampaign && (
          <>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-sm text-muted-foreground font-medium truncate max-w-[200px]">
              {activeCampaign.name}
            </span>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {activeCampaign.candidates.length} candidates
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {activeCampaign && shortlistCount > 0 && (
          <button
            onClick={onOpenShortlist}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <Star size={12} fill="currentColor" />
            {shortlistCount} shortlisted
          </button>
        )}
        <button
          onClick={onToggleImport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} />
          Import
        </button>
      </div>
    </header>
  )
}
