'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Upload, Loader2, AlertCircle, FlaskConical } from 'lucide-react'
import type { Campaign } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { detectAdapter } from '../registry'

interface ImportDropzoneProps {
  onImport: (campaign: Campaign) => void
}

type ImportState = 'idle' | 'loading' | 'error'

export function ImportDropzone({ onImport }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null)
  const [importState, setImportState] = useState<ImportState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const adapter = detectAdapter(files)
      if (!adapter) {
        setImportState('error')
        setErrorMessage(
          'No compatible adapter found. Provide PDB/CSV, FASTA, CIF/JSON, or a generic CSV.'
        )
        return
      }

      setImportState('loading')
      setErrorMessage(null)

      try {
        const partial = await adapter.parse(files)
        const campaign: Campaign = {
          ...partial,
          id: nanoid(),
          createdAt: new Date().toISOString(),
        }
        setImportState('idle')
        setDetectedLabel(null)
        onImport(campaign)
      } catch (err) {
        setImportState('error')
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to parse campaign files.'
        )
      }
    },
    [onImport]
  )

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)

      const items = Array.from(e.dataTransfer.items)
      const mockFiles = items
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null)

      if (mockFiles.length > 0) {
        const adapter = detectAdapter(mockFiles)
        setDetectedLabel(adapter?.label ?? null)
      }
    },
    []
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
      setDetectedLabel(null)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      setDetectedLabel(null)

      const files = Array.from(e.dataTransfer.files)
      await processFiles(files)
    },
    [processFiles]
  )

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      await processFiles(files)
      e.target.value = ''
    },
    [processFiles]
  )

  const handleLoadSample = useCallback(async () => {
    setImportState('loading')
    setErrorMessage(null)
    try {
      const res = await fetch('/samples/rfdiffusion_binder_campaign.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data: unknown = await res.json()
      if (
        typeof data !== 'object' ||
        data === null ||
        !('id' in data) ||
        !('candidates' in data) ||
        !Array.isArray((data as { candidates: unknown }).candidates)
      ) {
        throw new Error('Invalid sample campaign format')
      }
      setImportState('idle')
      onImport(data as Campaign)
    } catch (err) {
      setImportState('error')
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load sample campaign.'
      )
    }
  }, [onImport])

  const handleLoadSampleFiles = useCallback(
    async (label: string, paths: string[]) => {
      setImportState('loading')
      setErrorMessage(null)
      try {
        const files = await Promise.all(
          paths.map(async (p) => {
            const res = await fetch(p)
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${p}`)
            const blob = await res.blob()
            const filename = p.split('/').pop() ?? 'file'
            return new File([blob], filename)
          })
        )
        await processFiles(files)
      } catch (err) {
        setImportState('error')
        setErrorMessage(
          err instanceof Error ? err.message : `Failed to load ${label}.`
        )
      }
    },
    [processFiles]
  )

  const isLoading = importState === 'loading'
  const isError = importState === 'error'

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'relative w-full rounded-2xl border-2 px-8 py-16 flex flex-col items-center justify-center gap-4 transition-all duration-150 cursor-pointer select-none',
          isDragging
            ? 'border-blue-500 bg-blue-500/5 shadow-md'
            : isError
              ? 'border-dashed border-red-400 bg-red-50/40 dark:bg-red-950/20'
              : 'border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
        ].join(' ')}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
            fileInputRef.current?.click()
          }
        }}
        aria-label="Import campaign files"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          tabIndex={-1}
          aria-hidden
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          tabIndex={-1}
          aria-hidden
          {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />

        {isLoading ? (
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        ) : isError ? (
          <AlertCircle className="w-10 h-10 text-red-500" />
        ) : (
          <Upload
            className={[
              'w-10 h-10 transition-colors',
              isDragging ? 'text-blue-500' : 'text-zinc-400',
            ].join(' ')}
          />
        )}

        <div className="text-center">
          {isLoading ? (
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Parsing campaign files…
            </p>
          ) : isError ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Drop files or a folder here
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                RFdiffusion · ProteinMPNN · BoltzGen · Generic CSV
              </p>
            </>
          )}
        </div>

        {detectedLabel && !isLoading && (
          <div className="absolute bottom-4 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-300">
              Detected: {detectedLabel}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-400">or</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => !isLoading && folderInputRef.current?.click()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Browse folder
        </button>

        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600" />

        <button
          type="button"
          onClick={handleLoadSample}
          disabled={isLoading}
          title="50 EGFR binder candidates — RFdiffusion + ProteinMPNN pipeline"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          EGFR binder campaign
        </button>

        <button
          type="button"
          onClick={() => handleLoadSampleFiles('EGFR binders CSV', ['/samples/binder_campaign.csv'])}
          disabled={isLoading}
          title="40 binder candidates — generic CSV with pLDDT, PAE, iPTM"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          EGFR binders (CSV)
        </button>

        <button
          type="button"
          onClick={() => handleLoadSampleFiles('enzyme variants CSV', ['/samples/enzyme_design.csv'])}
          disabled={isLoading}
          title="30 laccase variants — catalytic fitness, thermal stability, kcat/Km"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Enzyme variants (CSV)
        </button>

        <button
          type="button"
          onClick={() => handleLoadSampleFiles('ProteinMPNN designs', ['/samples/proteinmpnn_egfr_binders.fasta'])}
          disabled={isLoading}
          title="25 ProteinMPNN redesigns — score, global_score, seq_recovery"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          ProteinMPNN (FASTA)
        </button>

        <button
          type="button"
          onClick={() => handleLoadSampleFiles('RFdiffusion designs', [
            '/samples/rfdiffusion/scored_designs.csv',
            ...Array.from({ length: 12 }, (_, i) => `/samples/rfdiffusion/design_${String(i).padStart(2, '0')}.pdb`),
          ])}
          disabled={isLoading}
          title="12 RFdiffusion backbones with structures — CA-only PDB + scored CSV"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          RFdiffusion (PDB+CSV)
        </button>
      </div>
    </div>
  )
}
