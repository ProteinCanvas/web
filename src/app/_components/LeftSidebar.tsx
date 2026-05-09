'use client'

import { Trash2 } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { ShortlistPanel } from '@/features/shortlist'
import { SOURCE_LABELS, type LeftTab } from './constants'

interface LeftSidebarProps {
  leftTab: LeftTab
  setLeftTab: (tab: LeftTab) => void
  shortlistCount: number
}

export function LeftSidebar({ leftTab, setLeftTab, shortlistCount }: LeftSidebarProps) {
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) ?? null
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)
  const removeCampaign = useCampaignStore((s) => s.removeCampaign)

  return (
    <aside className="w-[260px] shrink-0 border-r border-border flex flex-col overflow-hidden bg-card/30">
      <div className="flex items-center border-b border-border shrink-0">
        <button
          onClick={() => setLeftTab('campaigns')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
            leftTab === 'campaigns'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Campaigns
        </button>
        <button
          onClick={() => setLeftTab('shortlist')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
            leftTab === 'shortlist'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Shortlist {shortlistCount > 0 && `(${shortlistCount})`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leftTab === 'campaigns' && (
          <div className="flex flex-col gap-1 p-2">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                  c.id === activeCampaignId
                    ? 'bg-primary/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
                onClick={() => setActiveCampaign(c.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.candidates.length} candidates · {SOURCE_LABELS[c.source] ?? c.source}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeCampaign(c.id) }}
                  className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {leftTab === 'shortlist' && activeCampaign && (
          <ShortlistPanel campaign={activeCampaign} />
        )}
        {leftTab === 'shortlist' && !activeCampaign && (
          <div className="p-4 text-xs text-muted-foreground">Import a campaign first.</div>
        )}
      </div>
    </aside>
  )
}
