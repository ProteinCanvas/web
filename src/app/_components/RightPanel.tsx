'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { Camera, GitCompare, X } from 'lucide-react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore, getActiveCampaign } from '@/shared/store/campaignStore'
import { useCampaignData } from '@/features/campaign-dashboard'
import { SequencePanel } from '@/features/sequence-panel'
import { ExportModal } from '@/features/export'
import { getMetricMeta, isAboveGoodThreshold } from '@/shared/lib/metric-registry'
import { SOURCE_LABELS, type RightTab } from './constants'

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
      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

  const statusColor =
    passing === true
      ? 'text-green-500'
      : passing === false
      ? 'text-yellow-500'
      : 'text-foreground'

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
  const { campaign, metricFields } = useCampaignData()
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

  const hasPae = !!(selectedCandidate?.paeMatrix && selectedCandidate.paeMatrix.length > 0)

  const tabs: { id: RightTab; label: string; disabled?: boolean }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'sequence', label: 'Sequence' },
    { id: 'compare', label: comparisonCount > 0 ? `Compare (${comparisonCount})` : 'Compare' },
    { id: 'pae', label: 'PAE', disabled: !hasPae },
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
          ) : (
            <span className="text-xs text-muted-foreground">No candidate selected</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onExportFigure}
            disabled={!selectedCandidate}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors"
            title="Export figure"
          >
            <Camera size={11} />
            Export
          </button>
          <button
            onClick={() => {
              if (selectedCandidateId) {
                addToComparison(selectedCandidateId)
                setRightTab('compare')
              }
            }}
            disabled={!selectedCandidate}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors"
            title="Add to comparison view"
          >
            <GitCompare size={11} />
            Compare
          </button>
          <button
            onClick={onClose}
            className="ml-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Close panel"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex items-center border-b border-border bg-muted/30 px-3 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setRightTab(t.id)}
            disabled={t.disabled}
            className={`px-3 py-2.5 text-xs font-medium rounded-t transition-colors ${
              rightTab === t.id
                ? 'text-foreground border-b-2 border-primary bg-background'
                : t.disabled
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function RightPanel({ rightTab, setRightTab }: RightPanelProps) {
  const { campaign, metricFields } = useCampaignData()
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const comparisonIds = useViewerStore((s) => s.comparisonCandidateIds)
  const setSelectedCandidateId = useViewerStore((s) => s.setSelectedCandidateId)
  const clearComparison = useViewerStore((s) => s.clearComparison)
  const [showExportModal, setShowExportModal] = useState(false)

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
        className={`shrink-0 flex flex-col overflow-hidden transition-[width] duration-300 ease-out ${
          isVisible ? 'w-[420px] border-l border-border' : 'w-0'
        }`}
      >
        <CandidateHeader
          rightTab={rightTab}
          setRightTab={setRightTab}
          onExportFigure={() => setShowExportModal(true)}
          onClose={handleClose}
        />
        {rightTab === 'structure' && (
          <div className="flex-1 bg-black overflow-hidden">
            <StructureViewer
              candidate={selectedCandidate}
              className="w-full h-full"
              onExportRequest={() => setShowExportModal(true)}
            />
          </div>
        )}
        {rightTab === 'sequence' && (
          <div className="flex-1 overflow-auto bg-card">
            <SequencePanel candidate={selectedCandidate} />
          </div>
        )}
        {rightTab === 'compare' && (
          <div className="flex-1 bg-black overflow-hidden">
            <ComparisonViewer candidates={comparisonCandidates} className="w-full h-full" />
          </div>
        )}
        {rightTab === 'pae' && selectedCandidate?.paeMatrix && (
          <div className="flex-1 overflow-auto bg-card">
            <PaeMatrixViewer paeMatrix={selectedCandidate.paeMatrix} candidateName={selectedCandidate.name} />
          </div>
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
