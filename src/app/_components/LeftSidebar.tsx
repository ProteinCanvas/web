'use client'

import { useState, useMemo, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { ShortlistPanel } from '@/features/shortlist'
import { SOURCE_LABELS, type LeftTab } from './constants'
import { TabBar } from '@/shared/components/TabBar'

interface LeftSidebarProps {
  leftTab: LeftTab
  setLeftTab: (tab: LeftTab) => void
  shortlistCount: number
}

export function LeftSidebar({ leftTab, setLeftTab, shortlistCount }: LeftSidebarProps) {
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)
  const removeCampaign = useCampaignStore((s) => s.removeCampaign)
  const renameCampaign = useCampaignStore((s) => s.renameCampaign)
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) ?? null

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>('')
  const committedRef = useRef(false)

  const sidebarTabs = useMemo(() => [
    { id: 'campaigns' as LeftTab, label: 'Campaigns' },
    { id: 'shortlist' as LeftTab, label: shortlistCount > 0 ? `Shortlist (${shortlistCount})` : 'Shortlist' },
  ], [shortlistCount])

  return (
    <aside className="w-[260px] shrink-0 border-r border-border flex flex-col overflow-hidden bg-card/30">
      <TabBar tabs={sidebarTabs} active={leftTab} onChange={setLeftTab} />

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
                  {editingId === c.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') {
                          committedRef.current = true
                          renameCampaign(c.id, editingName.trim() || c.name)
                          setEditingId(null)
                        } else if (e.key === 'Escape') {
                          committedRef.current = true
                          setEditingId(null)
                        }
                      }}
                      onBlur={() => {
                        if (!committedRef.current) {
                          renameCampaign(c.id, editingName.trim() || c.name)
                        }
                        committedRef.current = false
                        setEditingId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-xs font-medium bg-transparent border-b border-primary focus:outline-none"
                    />
                  ) : (
                    <p
                      className="truncate text-xs font-medium"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingId(c.id)
                        setEditingName(c.name)
                      }}
                    >
                      {c.name}
                    </p>
                  )}
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
