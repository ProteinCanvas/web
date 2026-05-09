'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dna, Plus, FlaskConical, Zap, Box } from 'lucide-react'
import { useCampaignStore, getActiveCampaign } from '@/shared/store/campaignStore'
import { useViewerStore } from '@/shared/store/viewerStore'
import { ImportDropzone } from '@/features/campaign-import'
import { ConstraintEditor } from '@/features/constraint-editor'
import { Toaster } from '@/shared/components/Toaster'
import { KeyboardShortcuts } from '@/shared/components/KeyboardShortcuts'
import { Spinner } from '@/shared/components/Spinner'
import { Modal } from '@/shared/components/Modal'
import { OnboardingModal } from '@/shared/components/OnboardingModal'
import { buildProvenanceImportNode } from '@/features/provenance'
import { buildAllDemoCampaigns } from '@/shared/lib/demo'
import { AppHeader } from './_components/AppHeader'
import { LeftSidebar } from './_components/LeftSidebar'
import { CenterPane } from './_components/CenterPane'
import { RightPanel } from './_components/RightPanel'
import { type CenterTab, type LeftTab } from './_components/constants'
import type { Campaign, ConstraintSpec } from '@/shared/types'

export default function Home() {
  const [centerTab, setCenterTab] = useState<CenterTab>('summary')
  const [leftTab, setLeftTab] = useState<LeftTab>('campaigns')
  const [showImport, setShowImport] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showDesign, setShowDesign] = useState(false)
  const [constraintSpec, setConstraintSpec] = useState<ConstraintSpec>({
    hotspots: [], masks: [], locks: [], motifs: [],
  })

  const hydrate = useCampaignStore((s) => s.hydrate)
  const hydrated = useCampaignStore((s) => s.hydrated)
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeCampaign = useCampaignStore((s) => getActiveCampaign(s))
  const addCampaign = useCampaignStore((s) => s.addCampaign)
  const addProvenanceNode = useCampaignStore((s) => s.addProvenanceNode)
  const shortlist = useCampaignStore((s) => s.shortlist)
  const rightTab = useViewerStore((s) => s.rightTab)
  const setRightTab = useViewerStore((s) => s.setRightTab)
  const setSelectedCandidateId = useViewerStore((s) => s.setSelectedCandidateId)
  const clearComparison = useViewerStore((s) => s.clearComparison)
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    setSelectedCandidateId(null)
    clearComparison()
    setBrushedCandidateIds(null)
  }, [activeCampaignId, setSelectedCandidateId, clearComparison, setBrushedCandidateIds])

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

  const addToShortlist = useCampaignStore((s) => s.addToShortlist)

  const handleLoadDemo = () => {
    buildAllDemoCampaigns().forEach(({ campaign, shortlistEntries }) => {
      addCampaign(campaign)
      shortlistEntries.forEach((e) => addToShortlist(e))
      addProvenanceNode(campaign.id, buildProvenanceImportNode(campaign.name, campaign.candidates.length, campaign.source))
    })
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
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  const hasNoCampaigns = campaigns.length === 0

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <Toaster />
      <OnboardingModal
        onOpenImport={() => setShowImport(true)}
        onLoadDemo={handleLoadDemo}
      />
      <KeyboardShortcuts externalOpen={showShortcuts} onExternalClose={() => setShowShortcuts(false)} />
      <AppHeader
        activeCampaign={activeCampaign}
        shortlistCount={shortlistCount}
        onToggleImport={() => setShowImport((v) => !v)}
        onOpenShortlist={() => setLeftTab('shortlist')}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenDesign={() => setShowDesign(true)}
      />

      {showImport && (
        <div className="border-b border-border bg-card p-4 shrink-0">
          <ImportDropzone onImport={handleImport} />
        </div>
      )}

      {hasNoCampaigns && !showImport ? (
        <div className="flex flex-1 items-center justify-center bg-background">
          <div className="text-center max-w-md px-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border border-border bg-card mb-6">
              <Dna size={20} className="text-primary" />
            </div>
            <h2 className="text-base font-semibold mb-2 text-foreground tracking-tight">ProteinCanvas</h2>
            <p className="text-xs text-muted-foreground mb-8 leading-relaxed">
              Visual analytics workbench for generative protein design. Explore candidates, visualize structures, analyze metric distributions, and track DBTL cycles — entirely in your browser.
            </p>
            <div className="flex items-center justify-center gap-2 mb-10">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus size={12} />
                Import campaign
              </button>
              <button
                onClick={handleLoadDemo}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <FlaskConical size={12} />
                Load demo
              </button>
            </div>
            <div className="flex items-center justify-center gap-5 border-t border-border pt-6">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <FlaskConical size={11} className="shrink-0" />
                <span>15 tool adapters</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Zap size={11} className="shrink-0" />
                <span>DuckDB-Wasm</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Box size={11} className="shrink-0" />
                <span>Mol* 3D viewer</span>
              </div>
            </div>
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

      {showDesign && (
        <Modal
          title="Design Constraints"
          subtitle={activeCampaign?.name}
          onClose={() => setShowDesign(false)}
        >
          {activeCampaign ? (
            <ConstraintEditor spec={constraintSpec} onChange={setConstraintSpec} />
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Import a campaign first.
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
