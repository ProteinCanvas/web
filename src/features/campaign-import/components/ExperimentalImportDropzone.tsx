'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, Loader2, AlertCircle, FlaskConical, CheckCircle2, ChevronDown } from 'lucide-react'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { experimentalCsvAdapter, type ImportReport } from '../adapters/experimental-csv'
import { useToast } from '@/shared/hooks/useToast'

interface Props {
  onClose: () => void
}

function ColumnMappingTable({ mapping, customColumns }: { mapping: Record<string, string>; customColumns: string[] }) {
  const entries = Object.entries(mapping)
  if (entries.length === 0) return null
  return (
    <div className="rounded-lg border border-border overflow-hidden text-xs">
      <div className="px-3 py-1.5 bg-muted/50 text-muted-foreground font-medium">Column mapping</div>
      <div className="divide-y divide-border/50">
        {entries.map(([col, field]) => (
          <div key={col} className="flex items-center justify-between px-3 py-1.5">
            <span className="font-mono text-foreground">{col}</span>
            <span className={`text-muted-foreground ${customColumns.includes(col) ? 'italic' : ''}`}>
              → {customColumns.includes(col) ? 'custom metric' : field}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportView({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const [showUnmatched, setShowUnmatched] = useState(false)
  const matchRate = report.total > 0 ? report.matched / report.total : 0
  const isGood = matchRate >= 0.8
  const isPartial = matchRate > 0 && matchRate < 0.8

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
        isGood ? 'bg-green-950/30 border-green-700/40 text-green-400' :
        isPartial ? 'bg-yellow-950/30 border-yellow-700/40 text-yellow-400' :
        'bg-red-950/30 border-red-700/40 text-red-400'
      }`}>
        {isGood ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
        {report.matched} / {report.total} rows matched to candidates
        {report.unmatched.length > 0 && (
          <button
            onClick={() => setShowUnmatched((v) => !v)}
            className="ml-auto flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            {report.unmatched.length} unmatched
            <ChevronDown size={11} className={`transition-transform ${showUnmatched ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {showUnmatched && report.unmatched.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-1.5">Unmatched row names (check spelling vs. candidate names):</p>
          <div className="flex flex-col gap-0.5">
            {report.unmatched.map((name) => (
              <span key={name} className="text-xs font-mono text-foreground">{name}</span>
            ))}
          </div>
        </div>
      )}

      <ColumnMappingTable mapping={report.columnMapping} customColumns={report.customColumns} />

      <button
        onClick={onClose}
        className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors self-end"
      >
        Done
      </button>
    </div>
  )
}

export function ExperimentalImportDropzone({ onClose }: Props) {
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const addExperimentalResults = useCampaignStore((s) => s.addExperimentalResults)
  const [selectedCampaignId, setSelectedCampaignId] = useState(activeCampaignId ?? campaigns[0]?.id ?? '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const setError = useCallback((msg: string) => {
    setStatus('error')
    setErrorMessage(msg)
    toast(msg, 'error')
  }, [toast])

  const processFiles = useCallback(
    async (files: File[]) => {
      const campaign = campaigns.find((c) => c.id === selectedCampaignId)
      if (!campaign) { setError('Select a campaign before importing results.'); return }
      if (!experimentalCsvAdapter.accepts(files)) {
        setError('Please provide a single CSV file. It must contain a name or id column, plus result columns (kd, expression, tm, binds, or any numeric column).')
        return
      }
      setStatus('loading')
      setErrorMessage(null)
      try {
        const names = campaign.candidates.map((c) => c.name)
        const ids = campaign.candidates.map((c) => c.id)
        const { results, report: importReport } = await experimentalCsvAdapter.parse(files, names, ids)
        if (importReport.matched === 0) {
          setError(`No rows matched any candidate in "${campaign.name}". Check that the name column values match your candidate names exactly.`)
          return
        }
        addExperimentalResults(selectedCampaignId, results)
        setReport(importReport)
        setStatus('done')
        toast(`${importReport.matched} results imported successfully.`, 'success')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse results CSV.')
      }
    },
    [campaigns, selectedCampaignId, addExperimentalResults, setError, toast]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      await processFiles(Array.from(e.dataTransfer.files))
    },
    [processFiles]
  )

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await processFiles(Array.from(e.target.files ?? []))
      e.target.value = ''
    },
    [processFiles]
  )

  if (campaigns.length === 0) {
    return <div className="text-xs text-muted-foreground p-4">No campaigns loaded</div>
  }

  if (status === 'done' && report) {
    return <ReportView report={report} onClose={onClose} />
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground shrink-0">Campaign</span>
        <select
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
          className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-background text-foreground"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false) }}
        onDrop={handleDrop}
        onClick={() => status !== 'loading' && fileRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 px-6 py-10 cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' :
          status === 'error' ? 'border-dashed border-red-400 bg-red-50/30 dark:bg-red-950/20' :
          'border-dashed border-border bg-muted/20 hover:bg-muted/40',
        ].join(' ')}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleChange} />
        {status === 'loading' ? <Loader2 size={28} className="text-primary animate-spin" /> :
         status === 'error' ? <AlertCircle size={28} className="text-red-500" /> :
         <Upload size={28} className={isDragging ? 'text-primary' : 'text-muted-foreground'} />}
        <div className="text-center">
          {status === 'loading' && <p className="text-xs text-muted-foreground">Matching results…</p>}
          {status === 'error' && <p className="text-xs text-red-500">{errorMessage}</p>}
          {status === 'idle' && (
            <>
              <p className="text-xs font-medium text-foreground">Drop experimental results CSV</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Required: name column · Optional: kd, expression, tm, binds, round, kon, koff + any numeric columns
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
