'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Camera, Maximize2, Crosshair } from 'lucide-react'
import { Spinner } from '@/shared/components/Spinner'
import { useViewerStore } from '@/shared/store/viewerStore'
import { registerCapture, unregisterCapture } from '@/shared/lib/capture-registry'
import { REPRESENTATION_LABELS, COLOR_LABELS } from '../lib/constants'
import type { Candidate, TargetProtein } from '@/shared/types'
import type { MolstarBridge } from '../lib/molstar-bridge'

interface StructureViewerProps {
  candidate: Candidate | null
  target?: TargetProtein | null
  className?: string
  onExportRequest?: () => void
}

export function StructureViewer({ candidate, target, className, onExportRequest }: StructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bridgeRef = useRef<MolstarBridge | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const representationType = useViewerStore((s) => s.representationType)
  const colorScheme = useViewerStore((s) => s.colorScheme)
  const selectedResidues = useViewerStore((s) => s.selectedResidues)
  const isLoading = useViewerStore((s) => s.isLoading)
  const setIsLoading = useViewerStore((s) => s.setIsLoading)
  const setSelectedResidues = useViewerStore((s) => s.setSelectedResidues)
  const setRepresentationType = useViewerStore((s) => s.setRepresentationType)
  const setColorScheme = useViewerStore((s) => s.setColorScheme)

  useEffect(() => {
    if (!containerRef.current) return

    let bridge: MolstarBridge | null = null
    let mounted = true

    async function setup() {
      const { MolstarBridge } = await import('../lib/molstar-bridge')
      if (!mounted || !containerRef.current) return

      bridge = new MolstarBridge()
      await bridge.init(containerRef.current)

      if (!mounted) { bridge.destroy(); return }

      bridge.onSelectionChange((residues) => setSelectedResidues(residues))
      bridgeRef.current = bridge
      loadStructureRef.current()

      registerCapture('structure', async () =>
        bridgeRef.current?.exportPng({ background: 'white' }) ?? null
      )
    }

    setup()

    return () => {
      mounted = false
      unregisterCapture('structure')
      bridgeRef.current?.destroy()
      bridgeRef.current = null
    }
  }, [setSelectedResidues])

  const loadStructure = useCallback(async () => {
    const bridge = bridgeRef.current
    if (!bridge || !candidate) return

    setError(null)
    setIsLoading(true)
    try {
      if (candidate.structureData && candidate.structureFormat) {
        await bridge.loadFromData(candidate.structureData, candidate.structureFormat)
      } else if (candidate.pdbId) {
        await bridge.loadFromPdbId(candidate.pdbId)
      } else if (candidate.sequence) {
        await bridge.loadFromSequence(candidate.sequence)
      } else {
        await bridge.clearStructure()
      }
      if (target?.structureData && target.structureFormat) {
        await bridge.loadTargetStructure(target.structureData, target.structureFormat)
        await bridge.highlightHotspotResidues(target.hotspotResidues ?? [])
      }
    } catch {
      await bridge.clearStructure()
      setError('Failed to load structure')
    } finally {
      setIsLoading(false)
    }
  }, [candidate, target, setIsLoading])

  const loadStructureRef = useRef(loadStructure)
  useEffect(() => { loadStructureRef.current = loadStructure }, [loadStructure])

  useEffect(() => { loadStructure() }, [loadStructure])

  useEffect(() => { bridgeRef.current?.setSelectedResidues(selectedResidues) }, [selectedResidues])
  useEffect(() => { bridgeRef.current?.setRepresentationType(representationType) }, [representationType])
  useEffect(() => { bridgeRef.current?.setColorScheme(colorScheme) }, [colorScheme])

  useEffect(() => {
    const html = document.documentElement
    const observer = new MutationObserver(() => {
      bridgeRef.current?.setBackground(html.classList.contains('dark'))
    })
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const hasStructure = candidate && (candidate.structureData || candidate.pdbId || candidate.sequence)

  const viewerContent = (
    <div className={`relative w-full h-full ${isFullscreen ? 'fixed inset-0 z-[90]' : ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {!hasStructure && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <p className="text-muted-foreground/60 text-sm">No structural data</p>
          <p className="text-muted-foreground/40 text-xs">Select a candidate with structure data</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" className="border-white border-t-transparent" />
            <p className="text-white/70 text-xs">
              {candidate && candidate.sequence && !candidate.structureData && !candidate.pdbId
                ? 'Predicting structure via ESMFold…'
                : 'Loading…'}
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 z-30 flex flex-col gap-1">
        {target && (
          <span className="flex items-center gap-1 bg-teal-600/80 text-white text-xs px-2 py-0.5 rounded">
            <Crosshair size={10} />
            Complex view
          </span>
        )}
        {selectedResidues.length > 0 && (
          <span className="bg-primary/90 text-primary-foreground text-xs px-2 py-0.5 rounded">
            {selectedResidues.length} residue{selectedResidues.length !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      <div className="absolute bottom-2 left-2 right-2 z-30 flex items-center gap-1.5">
        <select
          className="bg-black/70 text-white text-xs rounded px-2 py-1.5 border border-white/20 focus:outline-none cursor-pointer"
          value={representationType}
          onChange={(e) => setRepresentationType(e.target.value as import('@/shared/types').RepresentationType)}
        >
          {Object.entries(REPRESENTATION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select
          className="bg-black/70 text-white text-xs rounded px-2 py-1.5 border border-white/20 focus:outline-none cursor-pointer"
          value={colorScheme}
          onChange={(e) => setColorScheme(e.target.value as import('@/shared/types').ColorScheme)}
        >
          {Object.entries(COLOR_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <div className="flex-1" />

        {onExportRequest && (
          <button
            onClick={onExportRequest}
            disabled={!hasStructure}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-black/70 text-white/80 border border-white/20 hover:bg-black/90 hover:text-white disabled:opacity-30 transition-colors"
          >
            <Camera size={11} />
            Export
          </button>
        )}

        <button
          onClick={() => setIsFullscreen((v) => !v)}
          className="flex items-center justify-center w-7 h-7 rounded bg-black/70 text-white/70 border border-white/20 hover:bg-black/90 hover:text-white transition-colors"
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        >
          <Maximize2 size={11} />
        </button>
      </div>

      {isFullscreen && (
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-3 right-3 z-30 text-white/50 hover:text-white text-xs flex items-center gap-1 transition-colors"
        >
          Esc to exit
        </button>
      )}
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[90] bg-black">
        {viewerContent}
      </div>
    )
  }

  return <div className={`relative w-full h-full ${className ?? ''}`}>{viewerContent}</div>
}
