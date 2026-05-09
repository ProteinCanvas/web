'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dna, Plus } from 'lucide-react'
import { useCampaignStore, getActiveCampaign } from '@/shared/store/campaignStore'
import { useViewerStore } from '@/shared/store/viewerStore'
import { ImportDropzone } from '@/features/campaign-import'
import { Toaster } from '@/shared/components/Toaster'
import { buildProvenanceImportNode } from '@/features/provenance'
import { AppHeader } from './_components/AppHeader'
import { LeftSidebar } from './_components/LeftSidebar'
import { CenterPane } from './_components/CenterPane'
import { RightPanel } from './_components/RightPanel'
import { type CenterTab, type RightTab, type LeftTab } from './_components/constants'
import type { Campaign } from '@/shared/types'

export default function Home() {
  const [centerTab, setCenterTab] = useState<CenterTab>('summary')
  const [rightTab, setRightTab] = useState<RightTab>('structure')
  const [leftTab, setLeftTab] = useState<LeftTab>('campaigns')
  const [showImport, setShowImport] = useState(false)

  const hydrate = useCampaignStore((s) => s.hydrate)
  const hydrated = useCampaignStore((s) => s.hydrated)
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeCampaign = useCampaignStore((s) => getActiveCampaign(s))
  const addCampaign = useCampaignStore((s) => s.addCampaign)
  const addProvenanceNode = useCampaignStore((s) => s.addProvenanceNode)
  const shortlist = useCampaignStore((s) => s.shortlist)
  const activePanel = useViewerStore((s) => s.activePanel)

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    if (activePanel === 'comparison') setRightTab('compare')
    else if (activePanel === 'sequence') setRightTab('sequence')
    else setRightTab('structure')
  }, [activePanel])

  const handleImport = (campaign: Campaign) => {
    addCampaign(campaign)
    addProvenanceNode(
      campaign.id,
      buildProvenanceImportNode(campaign.name, campaign.candidates.length, campaign.source)
    )
    setShowImport(false)
    setLeftTab('campaigns')
    setCenterTab('summary')
  }

  const shortlistCount = useMemo(
    () => shortlist.filter((e) => activeCampaign && e.campaignId === activeCampaign.id).length,
    [shortlist, activeCampaign]
  )

  if (!hydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  const hasNoCampaigns = campaigns.length === 0

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <Toaster />
      <AppHeader
        activeCampaign={activeCampaign}
        shortlistCount={shortlistCount}
        onToggleImport={() => setShowImport((v) => !v)}
        onOpenShortlist={() => setLeftTab('shortlist')}
      />

      {showImport && (
        <div className="border-b border-border bg-card/50 p-6 shrink-0">
          <ImportDropzone onImport={handleImport} />
        </div>
      )}

      {hasNoCampaigns && !showImport ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-md">
            <Dna size={48} className="text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No campaign loaded</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Import outputs from RFdiffusion, ProteinMPNN, BoltzGen, AlphaFold2/3, ColabFold, Chai-1, BindCraft, ESMFold, LigandMPNN, or Rosetta.
            </p>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mx-auto"
            >
              <Plus size={14} />
              Import campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar leftTab={leftTab} setLeftTab={setLeftTab} shortlistCount={shortlistCount} />
          <div className="flex flex-1 overflow-hidden">
            <CenterPane centerTab={centerTab} setCenterTab={setCenterTab} />
            <RightPanel rightTab={rightTab} setRightTab={setRightTab} />
          </div>
        </div>
      )}
    </div>
  )
}
