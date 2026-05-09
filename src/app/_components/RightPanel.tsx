'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { Camera, GitCompare, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Spinner } from '@/shared/components/Spinner'
import { GhostButton } from '@/shared/components/GhostButton'
import { TabBar } from '@/shared/components/TabBar'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore, getActiveCampaign } from '@/shared/store/campaignStore'
import { useCampaignData } from '@/features/campaign-dashboard'
import { SequencePanel } from '@/features/sequence-panel'
import { ExportModal } from '@/features/export'
import { getMetricMeta, isAboveGoodThreshold } from '@/shared/lib/metric-registry'
import { SOURCE_LABELS, type RightTab } from './constants'
import { statusTextColor } from '@/shared/lib/status-colors'
import { TargetImportPanel, InterfacePanel } from '@/features/structure-viewer'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'

const StructureViewer = dynamic(
  () => import('@/features/structure-viewer').then((m) => m.StructureViewer),
  { ssr: false, loading: () => <ViewerSkeleton /> }
)

const ComparisonViewer = dynamic(
  () => import('@/features/structure-viewer').then((m) => m.ComparisonViewer),
  { ssr: false, loading: () => <ViewerSkeleton /> }
)

const PaeMatrixViewer = dynamic(
  () => import('@/features/structure-viewer').then((m) => m.PaeMatrixViewer),
  { ssr: false, loading: () => <ViewerSkeleton /> }
)

function ViewerSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <Spinner size="md" className="border-white/30 border-t-white" />
    </div>
  )
}

const PRIORITY_METRICS = ['plddt', 'iptm', 'ptm', 'pae_interaction', 'scrmsd', 'confidence_score', 'aggregate_score']

interface RightPanelProps {
  rightTab: RightTab
  setRightTab: (tab: RightTab) => void
}

function MetricBadge({ metricKey, value }: { metricKey: string; value: number }) {
  const meta = getMetricMeta(metricKey)
  const passing = isAboveGoodThreshold(metricKey, value)

  const directionSymbol = meta?.direction === 'higher' ? '↑' : meta?.direction === 'lower' ? '↓' : ''
  const label = meta?.label ?? metricKey
  const unit = meta?.unit ?? ''

  const statusColor = statusTextColor(passing === true ? 'good' : passing === false ? 'warn' : 'neutral')

  return (
    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-0.5">
      <span className="text-muted-foreground/70">{label}</span>
      {directionSymbol && <span className="text-muted-foreground/50 text-[10px]">{directionSymbol}</span>}
      <span className={`font-mono font-medium ml-0.5 ${statusColor}`}>
        {value.toFixed(3)}{unit}
      </span>
    </span>
  )
}

function CandidateHeader({
  rightTab,
  setRightTab,
  onExportFigure,
  onClose,
}: {
  rightTab: RightTab
  setRightTab: (tab: RightTab) => void
  onExportFigure: () => void
  onClose: () => void
}) {
  const { campaign } = useCampaignData()
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const comparisonCount = useViewerStore((s) => s.comparisonCandidateIds.length)
  const addToComparison = useViewerStore((s) => s.addToComparison)

  const selectedCandidate = useMemo(() => {
    if (!campaign || !selectedCandidateId) return null
    return campaign.candidates.find((c) => c.id === selectedCandidateId) ?? null
  }, [campaign, selectedCandidateId])

  const topMetrics = useMemo(() => {
    if (!selectedCandidate) return []
    return PRIORITY_METRICS
      .filter((k) => typeof selectedCandidate.metrics[k] === 'number')
      .slice(0, 3)
      .map((k) => ({ key: k, value: selectedCandidate.metrics[k] as number }))
  }, [selectedCandidate])

  const parentLineage = useMemo(() => {
    if (!selectedCandidate?.parentId || !campaign) return null
    const parent = campaign.candidates.find((c) => c.id === selectedCandidate.parentId)
    if (!parent) return null
    const expResult = (campaign.experimentalResults ?? []).find((r) => r.candidateId === parent.id)
    return { name: parent.name, kd: expResult?.kd }
  }, [selectedCandidate, campaign])

  const tabs: { id: RightTab; label: string; disabled?: boolean }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'sequence', label: 'Sequence' },
    { id: 'compare', label: comparisonCount > 0 ? `Compare (${comparisonCount})` : 'Compare' },
    { id: 'pae', label: 'PAE' },
  ]

  const sourceLabel = selectedCandidate?.source
    ? (SOURCE_LABELS[selectedCandidate.source] ?? selectedCandidate.source)
    : campaign?.source
    ? (SOURCE_LABELS[campaign.source] ?? campaign.source)
    : null

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
        <div className="flex-1 min-w-0">
          {selectedCandidate ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                  {selectedCandidate.name}
                </span>
                {sourceLabel && (
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
                    {sourceLabel}
                  </span>
                )}
                {topMetrics.map(({ key, value }) => (
                  <MetricBadge key={key} metricKey={key} value={value} />
                ))}
              </div>
              {parentLineage && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <span>↳ from</span>
                  <span className="font-medium text-muted-foreground truncate max-w-[120px]">{parentLineage.name}</span>
                  {parentLineage.kd !== undefined && (
                    <span className="font-mono text-muted-foreground/60">
                      · KD {parentLineage.kd < 1 ? parentLineage.kd.toFixed(2) : parentLineage.kd.toFixed(1)} nM
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No candidate selected</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <GhostButton
            onClick={onExportFigure}
            disabled={!selectedCandidate}
            title="Export figure"
          >
            <Camera size={11} />
            Export
          </GhostButton>
          <GhostButton
            onClick={() => {
              if (selectedCandidateId) {
                addToComparison(selectedCandidateId)
                setRightTab('compare')
              }
            }}
            disabled={!selectedCandidate}
            title="Add to comparison view"
          >
            <GitCompare size={11} />
            Compare
          </GhostButton>
          <button
            onClick={onClose}
            className="ml-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Close panel"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <TabBar tabs={tabs} active={rightTab} onChange={setRightTab} />
    </>
  )
}

const MIN_WIDTH = 320
const MAX_WIDTH = 960
const DEFAULT_WIDTH = 420

export function RightPanel({ rightTab, setRightTab }: RightPanelProps) {
  const { campaign, metricFields } = useCampaignData()
  const activeCampaign = useCampaignStore((s) => getActiveCampaign(s))
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const comparisonIds = useViewerStore((s) => s.comparisonCandidateIds)
  const setSelectedCandidateId = useViewerStore((s) => s.setSelectedCandidateId)
  const setSelectedResidues = useViewerStore((s) => s.setSelectedResidues)
  const clearComparison = useViewerStore((s) => s.clearComparison)
  const [showExportModal, setShowExportModal] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [targetSectionExpanded, setTargetSectionExpanded] = useState(
    () => !!(activeCampaign?.target)
  )
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = panelWidth
    setIsResizing(true)
  }, [panelWidth])

  useEffect(() => {
    if (!isResizing) return

    const onMove = (e: MouseEvent) => {
      const delta = startXRef.current - e.clientX
      setPanelWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta)))
    }

    const onUp = () => setIsResizing(false)

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [isResizing])

  useEffect(() => {
    if (activeCampaign?.target) {
      setTargetSectionExpanded(true)
    }
  }, [activeCampaign?.target])

  const handleClose = () => {
    setSelectedCandidateId(null)
    clearComparison()
  }

  const selectedCandidate = useMemo(() => {
    if (!campaign || !selectedCandidateId) return null
    return campaign.candidates.find((c) => c.id === selectedCandidateId) ?? null
  }, [campaign, selectedCandidateId])

  const comparisonCandidates = useMemo(() => {
    if (!campaign) return []
    return comparisonIds
      .map((id) => campaign.candidates.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
  }, [campaign, comparisonIds])

  const isVisible = selectedCandidateId !== null || comparisonIds.length > 0

  return (
    <>
      <div
        className="shrink-0 flex flex-col overflow-hidden relative"
        style={{
          width: isVisible ? panelWidth : 0,
          transition: isResizing ? 'none' : 'width 300ms ease-out',
        }}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 z-50 flex items-stretch group ${isVisible ? '' : 'hidden'}`}
          style={{ width: 5, cursor: 'col-resize' }}
          onMouseDown={handleResizeStart}
        >
          <div className={`w-px h-full transition-colors ${isResizing ? 'bg-primary' : 'bg-border group-hover:bg-primary/60'}`} />
        </div>
        <CandidateHeader
          rightTab={rightTab}
          setRightTab={setRightTab}
          onExportFigure={() => setShowExportModal(true)}
          onClose={handleClose}
        />
        {rightTab === 'structure' && (
          <ErrorBoundary key={selectedCandidateId ?? 'none'} label="Structure viewer" compact>
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 bg-black overflow-hidden min-h-0">
                <StructureViewer
                  candidate={selectedCandidate}
                  target={activeCampaign?.target ?? null}
                  className="w-full h-full"
                  onExportRequest={() => setShowExportModal(true)}
                />
              </div>
              {activeCampaign && (
                <div className="shrink-0 overflow-y-auto bg-card border-t border-border max-h-72">
                  <button
                    onClick={() => setTargetSectionExpanded((v) => !v)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    {targetSectionExpanded ? (
                      <ChevronDown size={12} className="shrink-0" />
                    ) : (
                      <ChevronRight size={12} className="shrink-0" />
                    )}
                    <span>Target &amp; Hotspots</span>
                    {activeCampaign.target && (
                      <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                        {activeCampaign.target.name}
                      </span>
                    )}
                  </button>
                  {targetSectionExpanded && (
                    <>
                      <TargetImportPanel
                        campaignId={activeCampaign.id}
                        target={activeCampaign.target}
                      />
                      {activeCampaign.target && selectedCandidate?.structureData && (
                        <InterfacePanel
                          candidate={selectedCandidate}
                          target={activeCampaign.target}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}
        {rightTab === 'sequence' && (
          <ErrorBoundary key={selectedCandidateId ?? 'none'} label="Sequence viewer" compact>
            <div className="flex-1 overflow-auto bg-card">
              <SequencePanel candidate={selectedCandidate} />
            </div>
          </ErrorBoundary>
        )}
        {rightTab === 'compare' && (
          <ErrorBoundary label="Comparison viewer" compact>
            <div className="flex-1 bg-black overflow-hidden">
              <ComparisonViewer candidates={comparisonCandidates} className="w-full h-full" />
            </div>
          </ErrorBoundary>
        )}
        {rightTab === 'pae' && (
          <ErrorBoundary key={selectedCandidateId ?? 'none'} label="PAE matrix" compact>
            <div className="flex-1 overflow-auto bg-card">
              {selectedCandidate?.paeMatrix ? (
                <PaeMatrixViewer
                  paeMatrix={selectedCandidate.paeMatrix}
                  candidateName={selectedCandidate.name}
                  binderLength={selectedCandidate.sequence?.length}
                  onHoverResidues={(ids) => setSelectedResidues(ids ?? [])}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                  <p className="text-sm font-medium text-foreground">No PAE matrix available</p>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                    {selectedCandidate
                      ? 'This candidate has no predicted aligned error data. PAE matrices are exported by AlphaFold2, ColabFold, and ESMFold.'
                      : 'Select a candidate to view its PAE matrix.'}
                  </p>
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}
      </div>

      {showExportModal && (
        <ExportModal
          candidate={selectedCandidate}
          metricFields={metricFields}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </>
  )
}
