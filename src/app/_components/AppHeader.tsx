'use client'

import { Dna, Plus, Star, Keyboard, Wand2, Github, MessageSquare } from 'lucide-react'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import type { Campaign } from '@/shared/types'

interface AppHeaderProps {
  activeCampaign: Campaign | null
  shortlistCount: number
  onToggleImport: () => void
  onOpenShortlist: () => void
  onOpenShortcuts: () => void
  onOpenDesign: () => void
}

export function AppHeader({ activeCampaign, shortlistCount, onToggleImport, onOpenShortlist, onOpenShortcuts, onOpenDesign }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Dna size={16} className="text-primary" />
          <span className="font-semibold text-xs tracking-wide text-foreground">ProteinCanvas</span>
        </div>
        {activeCampaign && (
          <>
            <span className="text-border">/</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {activeCampaign.name}
            </span>
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded tabular-nums">
              {activeCampaign.candidates.length}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        {activeCampaign && shortlistCount > 0 && (
          <button
            onClick={onOpenShortlist}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-vis-amber/30 bg-vis-amber/10 text-vis-amber hover:bg-vis-amber/20 transition-colors"
          >
            <Star size={11} fill="currentColor" />
            {shortlistCount}
          </button>
        )}
        <a
          href="https://github.com/ProteinCanvas/web/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          title="Share feedback or report a bug"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <MessageSquare size={12} />
          Feedback
        </a>
        <a
          href="https://github.com/ProteinCanvas/web"
          target="_blank"
          rel="noopener noreferrer"
          title="Star on GitHub"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Github size={12} />
          Star
        </a>
        <ThemeToggle />
        <button
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (?)"
          className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Keyboard size={13} />
        </button>
        <button
          onClick={onOpenDesign}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Wand2 size={12} />
          Design
        </button>
        <button
          onClick={onToggleImport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={12} />
          Import
        </button>
      </div>
    </header>
  )
}
