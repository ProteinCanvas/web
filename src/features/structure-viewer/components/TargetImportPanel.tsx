'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Upload, Crosshair } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { useToast } from '@/shared/hooks/useToast'
import type { TargetProtein, StructureFormat, ResidueRef } from '@/shared/types'

interface TargetImportPanelProps {
  campaignId: string
  target: TargetProtein | null | undefined
}

function parseResidueRefs(input: string): ResidueRef[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((token) => {
      const colonIdx = token.indexOf(':')
      if (colonIdx === -1) return []
      const chainId = token.slice(0, colonIdx).trim()
      const rest = token.slice(colonIdx + 1).trim()
      const residueIndex = parseInt(rest, 10)
      if (!chainId || isNaN(residueIndex)) return []
      return [{ chainId, residueIndex }] satisfies ResidueRef[]
    })
}

function formatResidueRefs(residues: ResidueRef[]): string {
  return residues.map((r) => `${r.chainId}:${r.residueIndex}`).join(', ')
}

function fileNameToTargetName(filename: string): string {
  return filename.replace(/\.(pdb|cif|mmcif)$/i, '')
}

function fileExtToFormat(filename: string): StructureFormat | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdb')) return 'pdb'
  if (lower.endsWith('.cif') || lower.endsWith('.mmcif')) return 'cif'
  return null
}

export function TargetImportPanel({ campaignId, target }: TargetImportPanelProps) {
  const setTarget = useCampaignStore((s) => s.setTarget)
  const toast = useToast()

  const [isDragging, setIsDragging] = useState(false)
  const [pdbIdInput, setPdbIdInput] = useState('')
  const [isPdbLoading, setIsPdbLoading] = useState(false)
  const [hotspotInput, setHotspotInput] = useState(
    target?.hotspotResidues ? formatResidueRefs(target.hotspotResidues) : ''
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHotspotInput(target?.hotspotResidues ? formatResidueRefs(target.hotspotResidues) : '')
  }, [target])

  const hotspotCount = target?.hotspotResidues?.length ?? 0

  const parsedHotspots = hotspotInput.trim() ? parseResidueRefs(hotspotInput) : null

  const handleFile = useCallback(
    (file: File) => {
      const format = fileExtToFormat(file.name)
      if (!format) {
        toast('Only .pdb and .cif files are supported', 'error')
        return
      }
      const name = fileNameToTargetName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const structureData = e.target?.result
        if (typeof structureData !== 'string') {
          toast('Failed to read file', 'error')
          return
        }
        const newTarget: TargetProtein = {
          name,
          structureData,
          structureFormat: format,
          hotspotResidues: [],
        }
        setTarget(campaignId, newTarget)
        setHotspotInput('')
        toast(`Target "${name}" loaded`, 'success')
      }
      reader.onerror = () => toast('Failed to read file', 'error')
      reader.readAsText(file)
    },
    [campaignId, setTarget, toast]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile]
  )

  const handleLoadPdbId = useCallback(async () => {
    const id = pdbIdInput.trim().toUpperCase()
    if (id.length !== 4) {
      toast('Enter a valid 4-character PDB ID', 'error')
      return
    }
    setIsPdbLoading(true)
    try {
      const url = `https://files.rcsb.org/download/${id}.pdb`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`PDB ID ${id} not found`)
      const structureData = await res.text()
      const newTarget: TargetProtein = {
        name: id,
        structureData,
        structureFormat: 'pdb',
        hotspotResidues: [],
      }
      setTarget(campaignId, newTarget)
      setPdbIdInput('')
      setHotspotInput('')
      toast(`Target "${id}" loaded from RCSB`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch PDB'
      toast(message, 'error')
    } finally {
      setIsPdbLoading(false)
    }
  }, [pdbIdInput, campaignId, setTarget, toast])

  const handleRemoveTarget = useCallback(() => {
    setTarget(campaignId, null)
    setHotspotInput('')
    toast('Target removed', 'info')
  }, [campaignId, setTarget, toast])

  const handleHotspotSave = useCallback(() => {
    if (!target) return
    const residues = parseResidueRefs(hotspotInput)
    const updated: TargetProtein = { ...target, hotspotResidues: residues }
    setTarget(campaignId, updated)
    toast(
      residues.length > 0
        ? `${residues.length} hotspot residue${residues.length !== 1 ? 's' : ''} saved`
        : 'Hotspot residues cleared',
      'success'
    )
  }, [target, hotspotInput, campaignId, setTarget, toast])

  return (
    <div className="border-t border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <Crosshair size={12} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1">Target protein</span>
        {hotspotCount > 0 && (
          <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-medium shrink-0">
            {hotspotCount} hotspot{hotspotCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="px-3 pb-3 space-y-3">
        {!target ? (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-1.5 rounded border-2 border-dashed cursor-pointer py-4 transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/40'
              }`}
            >
              <Upload size={16} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground text-center">
                Drop a <span className="font-medium">.pdb</span> or{' '}
                <span className="font-medium">.cif</span> file, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdb,.cif,.mmcif"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="PDB ID (e.g. 1ABC)"
                value={pdbIdInput}
                onChange={(e) => setPdbIdInput(e.target.value.slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadPdbId()}
                maxLength={4}
                className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary uppercase"
              />
              <button
                onClick={handleLoadPdbId}
                disabled={isPdbLoading || pdbIdInput.trim().length !== 4}
                className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors shrink-0"
              >
                {isPdbLoading ? 'Loading…' : 'Load'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-muted/50 rounded px-2.5 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{target.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{target.structureFormat}</p>
              </div>
              <button
                onClick={handleRemoveTarget}
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Remove target"
              >
                <X size={12} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Hotspot residues
              </label>
              <textarea
                value={hotspotInput}
                onChange={(e) => setHotspotInput(e.target.value)}
                placeholder="A:123, A:124, B:200"
                rows={2}
                className="w-full text-xs bg-muted border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono"
              />
              {parsedHotspots !== null && (
                parsedHotspots.length > 0 ? (
                  <p className="text-[10px] text-green-500">
                    {parsedHotspots.length} valid residue{parsedHotspots.length !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-[10px] text-destructive">
                    No valid residues — use format Chain:Number (e.g. A:123)
                  </p>
                )
              )}
              <p className="text-[10px] text-muted-foreground">
                Comma-separated residue refs in format <span className="font-mono">Chain:ResidueNum</span>
              </p>
              <button
                onClick={handleHotspotSave}
                className="w-full py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Save hotspots
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
