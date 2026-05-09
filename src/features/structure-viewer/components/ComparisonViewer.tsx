'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Maximize2, Minimize2, Download } from 'lucide-react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useToast } from '@/shared/hooks/useToast'
import type { Candidate, RepresentationType, ColorScheme } from '@/shared/types'
import type { MolstarBridge } from '../lib/molstar-bridge'

interface ComparisonCellProps {
  candidate: Candidate
  onRemove: () => void
  syncCamera: boolean
  sharedRepresentation: RepresentationType
  sharedColorScheme: ColorScheme
  externalSnapshot: { snapshot: unknown; sourceId: string } | null
  onCameraChange: (snapshot: unknown, sourceId: string) => void
  presentationMode: boolean
}

const REPRESENTATION_LABELS: Record<RepresentationType, string> = {
  cartoon: 'Cartoon',
  surface: 'Surface',
  'ball-and-stick': 'Ball & Stick',
}

const COLOR_LABELS: Record<ColorScheme, string> = {
  plddt: 'pLDDT',
  chain: 'Chain',
  element: 'Element',
  'residue-index': 'Residue',
  conservation: 'Conservation',
}

function ComparisonCell({
  candidate,
  onRemove,
  syncCamera,
  sharedRepresentation,
  sharedColorScheme,
  externalSnapshot,
  onCameraChange,
  presentationMode,
}: ComparisonCellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bridgeRef = useRef<MolstarBridge | null>(null)
  const [loading, setLoading] = useState(true)

  const plddt = typeof candidate.metrics['plddt'] === 'number'
    ? (candidate.metrics['plddt'] as number).toFixed(1)
    : null

  const cellId = candidate.id

  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true
    let bridge: MolstarBridge | null = null

    async function setup() {
      const { MolstarBridge } = await import('../lib/molstar-bridge')
      if (!mounted || !containerRef.current) return
      bridge = new MolstarBridge()
      await bridge.init(containerRef.current)
      if (!mounted) { bridge.destroy(); return }
      bridgeRef.current = bridge

      setLoading(true)
      try {
        if (candidate.structureData && candidate.structureFormat) {
          await bridge.loadFromData(candidate.structureData, candidate.structureFormat)
        } else if (candidate.pdbId) {
          await bridge.loadFromPdbId(candidate.pdbId)
        } else if (candidate.sequence) {
          await bridge.loadFromSequence(candidate.sequence)
        }
      } catch {}

      if (mounted) {
        setLoading(false)
        bridge.startCameraTracking((snapshot) => onCameraChange(snapshot, cellId))
      }
    }

    setup()
    return () => {
      mounted = false
      bridgeRef.current?.stopCameraTracking()
      bridgeRef.current?.destroy()
      bridgeRef.current = null
    }
  }, [candidate, cellId, onCameraChange])

  useEffect(() => {
    bridgeRef.current?.setRepresentationType(sharedRepresentation)
  }, [sharedRepresentation])

  useEffect(() => {
    bridgeRef.current?.setColorScheme(sharedColorScheme)
  }, [sharedColorScheme])

  useEffect(() => {
    if (!syncCamera || !externalSnapshot || externalSnapshot.sourceId === cellId) return
    bridgeRef.current?.applyCameraSnapshot(externalSnapshot.snapshot)
  }, [syncCamera, externalSnapshot, cellId])

  return (
    <div className="relative w-full h-full min-h-0 bg-black">
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 pointer-events-none">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
        <span className={`bg-black/75 text-white text-xs px-2 py-0.5 rounded border border-white/20 truncate ${presentationMode ? 'max-w-[200px] text-sm' : 'max-w-[120px]'}`}>
          {candidate.name}
        </span>
        {plddt && (
          <span className="bg-black/75 text-white/70 text-xs px-1.5 py-0.5 rounded border border-white/20">
            {plddt}
          </span>
        )}
        {!presentationMode && (
          <button
            onClick={onRemove}
            className="bg-black/75 text-white/50 hover:text-white text-xs rounded px-1.5 py-0.5 border border-white/20 transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  )
}

interface ComparisonViewerProps {
  candidates: Candidate[]
  className?: string
}

export function ComparisonViewer({ candidates, className }: ComparisonViewerProps) {
  const removeFromComparison = useViewerStore((s) => s.removeFromComparison)
  const toast = useToast()

  const [syncCamera, setSyncCamera] = useState(true)
  const [representation, setRepresentation] = useState<RepresentationType>('cartoon')
  const [colorScheme, setColorScheme] = useState<ColorScheme>('plddt')
  const [presentationMode, setPresentationMode] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cameraState, setCameraState] = useState<{ snapshot: unknown; sourceId: string } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && presentationMode) setPresentationMode(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [presentationMode])

  const handleCameraChange = useCallback((snapshot: unknown, sourceId: string) => {
    if (syncCamera) setCameraState({ snapshot, sourceId })
  }, [syncCamera])

  const handleExportComparison = useCallback(async () => {
    if (candidates.length === 0) return

    const { capture } = await import('@/shared/lib/capture-registry')
    const structs = await Promise.all(
      candidates.map(() => capture('structure'))
    )

    const valid = structs.filter((s): s is string => s !== null)
    if (valid.length === 0) { toast('No structures to export', 'error'); return }

    const CELL_W = 520
    const CELL_H = 400
    const GAP = 2
    const total_w = candidates.length * CELL_W + (candidates.length - 1) * GAP
    const canvas = document.createElement('canvas')
    canvas.width = total_w
    canvas.height = CELL_H + 28
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await Promise.all(
      valid.map((url, i) =>
        new Promise<void>((res) => {
          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, i * (CELL_W + GAP), 0, CELL_W, CELL_H)
            ctx.fillStyle = '#ffffff'
            ctx.font = '12px system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(candidates[i]?.name ?? '', i * (CELL_W + GAP) + CELL_W / 2, CELL_H + 18)
            res()
          }
          img.onerror = () => res()
          img.src = url
        })
      )
    )

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'comparison.png'
    a.click()
    toast('Comparison exported', 'success')
  }, [candidates, toast])

  if (candidates.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center w-full h-full gap-2 text-muted-foreground ${className ?? ''}`}>
        <p className="text-sm">No candidates in comparison</p>
        <p className="text-xs text-muted-foreground/50">Use the Compare button in the candidate header</p>
      </div>
    )
  }

  const cols = candidates.length === 1 ? 1 : candidates.length <= 2 ? 2 : 3
  const rows = Math.ceil(candidates.length / cols)

  const controls = (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/90 shrink-0 backdrop-blur-sm">
      <select
        value={representation}
        onChange={(e) => setRepresentation(e.target.value as RepresentationType)}
        className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none"
      >
        {(Object.keys(REPRESENTATION_LABELS) as RepresentationType[]).map((v) => (
          <option key={v} value={v}>{REPRESENTATION_LABELS[v]}</option>
        ))}
      </select>
      <select
        value={colorScheme}
        onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
        className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none"
      >
        {(Object.keys(COLOR_LABELS) as ColorScheme[]).map((v) => (
          <option key={v} value={v}>{COLOR_LABELS[v]}</option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={syncCamera}
          onChange={(e) => setSyncCamera(e.target.checked)}
          className="accent-primary w-3 h-3"
        />
        Sync camera
      </label>
      <div className="flex-1" />
      <button
        onClick={handleExportComparison}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Download size={10} />
        Export
      </button>
      <button
        onClick={() => setPresentationMode(true)}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Maximize2 size={10} />
        Present
      </button>
    </div>
  )

  const grid = (
    <div
      className="flex-1 grid min-h-0"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: '1px',
        background: 'hsl(var(--border))',
      }}
    >
      {candidates.map((candidate) => (
        <ComparisonCell
          key={candidate.id}
          candidate={candidate}
          onRemove={() => removeFromComparison(candidate.id)}
          syncCamera={syncCamera}
          sharedRepresentation={representation}
          sharedColorScheme={colorScheme}
          externalSnapshot={cameraState}
          onCameraChange={handleCameraChange}
          presentationMode={false}
        />
      ))}
    </div>
  )

  const presentationOverlay = mounted && presentationMode ? createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 shrink-0 bg-gradient-to-b from-black to-transparent absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <select
            value={representation}
            onChange={(e) => setRepresentation(e.target.value as RepresentationType)}
            className="text-xs bg-black/60 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
          >
            {(Object.keys(REPRESENTATION_LABELS) as RepresentationType[]).map((v) => (
              <option key={v} value={v}>{REPRESENTATION_LABELS[v]}</option>
            ))}
          </select>
          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
            className="text-xs bg-black/60 text-white border border-white/20 rounded px-2 py-1 focus:outline-none"
          >
            {(Object.keys(COLOR_LABELS) as ColorScheme[]).map((v) => (
              <option key={v} value={v}>{COLOR_LABELS[v]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setPresentationMode(false)}
          className="pointer-events-auto flex items-center gap-1 text-white/50 hover:text-white text-xs transition-colors"
        >
          <Minimize2 size={12} />
          Esc
        </button>
      </div>
      <div
        className="flex-1 grid min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: '1px',
          background: '#111',
        }}
      >
        {candidates.map((candidate) => (
          <ComparisonCell
            key={candidate.id}
            candidate={candidate}
            onRemove={() => removeFromComparison(candidate.id)}
            syncCamera={syncCamera}
            sharedRepresentation={representation}
            sharedColorScheme={colorScheme}
            externalSnapshot={cameraState}
            onCameraChange={handleCameraChange}
            presentationMode
          />
        ))}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className={`flex flex-col w-full h-full overflow-hidden ${className ?? ''}`}>
      {controls}
      {grid}
      {presentationOverlay}
    </div>
  )
}
