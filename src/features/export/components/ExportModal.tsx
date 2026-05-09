'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import NextImage from 'next/image'
import { X, Download, RefreshCw } from 'lucide-react'
import { composeFigure, presetDimensions, type FigurePreset, type FigureLayout } from '../lib/figure-composer'
import { capture } from '@/shared/lib/capture-registry'
import { useToast } from '@/shared/hooks/useToast'
import type { Candidate, MetricField } from '@/shared/types'

interface ExportModalProps {
  candidate: Candidate | null
  metricFields: MetricField[]
  onClose: () => void
}

const PRESETS: { id: FigurePreset; label: string; sub: string }[] = [
  { id: 'nature-1col', label: 'Nature / Science', sub: '90 mm · 300 DPI' },
  { id: 'nature-2col', label: 'Nature double col', sub: '180 mm · 300 DPI' },
  { id: 'presentation', label: 'Presentation', sub: '1920 × 1080 · 96 DPI' },
  { id: 'screen', label: 'Screen capture', sub: 'Current resolution' },
]

const LAYOUTS: { id: FigureLayout; label: string; sub: string }[] = [
  { id: 'structure', label: 'Structure only', sub: '3D render' },
  { id: 'composite', label: 'Structure + metrics', sub: 'Figure panel' },
]

export function ExportModal({ candidate, metricFields, onClose }: ExportModalProps) {
  const [layout, setLayout] = useState<FigureLayout>('structure')
  const [preset, setPreset] = useState<FigurePreset>('nature-1col')
  const [background, setBackground] = useState<'white' | 'black'>('white')
  const [figTitle, setFigTitle] = useState(candidate?.name ?? '')
  const [panelLabels, setPanelLabels] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const toast = useToast()
  const modalRef = useRef<HTMLDivElement>(null)

  const dims = presetDimensions(preset)
  const candidateName = candidate?.name ?? 'export'

  const metrics = metricFields
    .filter((f) => f.type === 'number')
    .slice(0, 10)
    .map((f) => {
      const v = candidate?.metrics[f.key]
      return { label: f.label, value: typeof v === 'number' ? v.toFixed(3) : '—' }
    })

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const src = await capture('structure')
      if (src) setPreviewUrl(src)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  useEffect(() => { refreshPreview() }, [refreshPreview])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const onOut = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [onClose])

  const handleExport = async () => {
    setExporting(true)
    try {
      if (layout === 'structure') {
        const raw = await capture('structure')
        if (!raw) { toast('Structure not available', 'error'); return }

        if (preset === 'screen') {
          const a = document.createElement('a')
          a.href = raw
          a.download = `${candidateName}.png`
          a.click()
        } else {
          const { width: widthPx } = presetDimensions(preset)
          const img = await new Promise<HTMLImageElement>((res) => {
            const i = new Image(); i.onload = () => res(i); i.src = raw
          })
          const h = Math.round((widthPx * img.height) / img.width)
          const canvas = document.createElement('canvas')
          canvas.width = widthPx
          canvas.height = h
          const ctx = canvas.getContext('2d')!
          if (background === 'white') {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, widthPx, h)
          }
          ctx.drawImage(img, 0, 0, widthPx, h)
          const a = document.createElement('a')
          a.href = canvas.toDataURL('image/png')
          a.download = `${candidateName}-${preset}.png`
          a.click()
        }
        toast(`Exported ${candidateName} (${dims.dpi} DPI)`, 'success')
        onClose()
        return
      }

      const dataUrl = await composeFigure({
        layout,
        preset,
        background,
        title: figTitle.trim() || undefined,
        panelLabels,
        metrics,
      })

      if (!dataUrl) { toast('Export failed', 'error'); return }

      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${candidateName}-figure-${preset}.png`
      a.click()
      toast(`Figure exported (${dims.width > 0 ? dims.width + ' px · ' : ''}${dims.dpi} DPI)`, 'success')
      onClose()
    } finally {
      setExporting(false)
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="w-full max-w-[600px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <span className="text-sm font-semibold">Export Figure</span>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex overflow-hidden flex-1 min-h-0">
          <div className="w-[220px] shrink-0 border-r border-border flex flex-col items-center justify-center gap-3 p-4 bg-muted/20">
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-black/60 border border-border">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              {previewUrl && !previewLoading && (
                <NextImage
                  src={previewUrl}
                  alt="Preview"
                  fill
                  unoptimized
                  className="object-contain"
                  style={{ background: background === 'white' ? '#fff' : '#0a0a0a' }}
                />
              )}
              {!previewUrl && !previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-xs">
                  No preview
                </div>
              )}
            </div>
            <button
              onClick={refreshPreview}
              disabled={previewLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={previewLoading ? 'animate-spin' : ''} />
              Refresh preview
            </button>
            {dims.width > 0 && (
              <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
                {dims.width} px · {dims.dpi} DPI
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Layout</p>
              <div className="flex flex-col gap-1.5">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      layout === l.id
                        ? 'border-primary/50 bg-primary/8 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-xs font-medium leading-none">{l.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{l.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Size & resolution</p>
              <div className="flex flex-col gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                      preset === p.id
                        ? 'border-primary/50 bg-primary/8'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <span className="text-xs font-medium text-foreground">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Background</p>
              <div className="flex gap-2">
                {(['white', 'black'] as const).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setBackground(bg)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                      background === bg
                        ? 'border-primary/50 bg-primary/8 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-sm border border-border shrink-0"
                      style={{ background: bg === 'white' ? '#ffffff' : '#0a0a0a' }}
                    />
                    {bg === 'white' ? 'White (print)' : 'Dark (screen)'}
                  </button>
                ))}
              </div>
            </div>

            {layout === 'composite' && (
              <>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Figure title</p>
                  <input
                    type="text"
                    value={figTitle}
                    onChange={(e) => setFigTitle(e.target.value)}
                    placeholder="Optional title…"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={panelLabels}
                    onChange={(e) => setPanelLabels(e.target.checked)}
                    className="accent-primary w-3.5 h-3.5"
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground">Panel labels</p>
                    <p className="text-xs text-muted-foreground">Add (a), (b)… labels at 8 pt</p>
                  </div>
                </label>
              </>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors mt-auto"
            >
              {exporting ? (
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {exporting ? 'Exporting…' : 'Download PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
