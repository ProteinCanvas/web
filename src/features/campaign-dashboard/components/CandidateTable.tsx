'use client'

import { useEffect, useRef, useCallback, KeyboardEvent, useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Star, GitCompare, ArrowUp, ArrowDown, ArrowUpDown, Search, SlidersHorizontal, X, Filter } from 'lucide-react'
import { useViewerStore } from '@/shared/store/viewerStore'
import { useCampaignStore } from '@/shared/store/campaignStore'
import { useInteraction } from '@/shared/hooks/useInteraction'
import { useDuckDB } from '../hooks/useDuckDB'
import { DevelopabilityBadge } from '@/features/developability/components/DevelopabilityBadge'
import type { Candidate, MetricField } from '@/shared/types'

interface CandidateTableProps {
  candidates: Candidate[]
  campaignId: string
  metricFields: MetricField[]
  className?: string
}

const columnHelper = createColumnHelper<Candidate>()

const FILTER_PRESETS = [
  { label: 'High confidence', where: 'plddt > 85 AND pae_interaction < 10' },
  { label: 'Strong interface', where: 'iptm > 0.70' },
  { label: 'BindCraft strict', where: 'plddt > 80 AND iptm > 0.65 AND dSASA > 700' },
  { label: 'Clear', where: '' },
]

export function CandidateTable({
  candidates,
  campaignId,
  metricFields,
  className,
}: CandidateTableProps) {
  const selectedCandidateId = useViewerStore((s) => s.selectedCandidateId)
  const setSelectedCandidateId = useViewerStore((s) => s.setSelectedCandidateId)
  const requestedScrollToId = useViewerStore((s) => s.requestedScrollToId)
  const setRequestedScrollToId = useViewerStore((s) => s.setRequestedScrollToId)
  const addToComparison = useViewerStore((s) => s.addToComparison)
  const brushedCandidateIds = useViewerStore((s) => s.brushedCandidateIds)
  const setBrushedCandidateIds = useViewerStore((s) => s.setBrushedCandidateIds)
  const { focusCandidate } = useInteraction()
  const isShortlisted = useCampaignStore((s) => s.isShortlisted)
  const addToShortlist = useCampaignStore((s) => s.addToShortlist)
  const removeFromShortlist = useCampaignStore((s) => s.removeFromShortlist)
  const searchQuery = useCampaignStore((s) => s.filters.searchQuery)
  const showShortlistOnly = useCampaignStore((s) => s.filters.showShortlistOnly)
  const setSearchQuery = useCampaignStore((s) => s.setSearchQuery)
  const setShowShortlistOnly = useCampaignStore((s) => s.setShowShortlistOnly)

  const [sorting, setSorting] = useState<SortingState>([])
  const [sqlFilter, setSqlFilter] = useState('')
  const [sqlInput, setSqlInput] = useState('')
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const columnPickerRef = useRef<HTMLDivElement>(null)

  const numericMetricFields = useMemo(
    () => metricFields.filter((f) => f.type === 'number'),
    [metricFields]
  )

  const [selectedMetricKeys, setSelectedMetricKeys] = useState<string[]>(() =>
    numericMetricFields.slice(0, 4).map((f) => f.key)
  )

  useEffect(() => {
    setSelectedMetricKeys((prev) => {
      const available = new Set(numericMetricFields.map((f) => f.key))
      const kept = prev.filter((k) => available.has(k))
      const needed = numericMetricFields.slice(0, 4).map((f) => f.key).filter((k) => !kept.includes(k))
      return kept.length > 0 ? kept : [...kept, ...needed].slice(0, 4)
    })
  }, [numericMetricFields])

  const visibleMetricFields = useMemo(
    () => numericMetricFields.filter((f) => selectedMetricKeys.includes(f.key)),
    [numericMetricFields, selectedMetricKeys]
  )

  const { isReady: dbReady, filteredIds: dbFilteredIds, applyFilter } = useDuckDB(candidates, metricFields)

  useEffect(() => {
    if (!dbReady) return
    applyFilter(sqlFilter).then((err) => setSqlError(err))
  }, [sqlFilter, dbReady, applyFilter])

  const brushedSet = useMemo(
    () => (brushedCandidateIds ? new Set(brushedCandidateIds) : null),
    [brushedCandidateIds]
  )

  const displayCandidates = useMemo(() => {
    if (!dbFilteredIds) return candidates
    return candidates.filter((c) => dbFilteredIds.has(c.id))
  }, [candidates, dbFilteredIds])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const columns = useMemo<ColumnDef<Candidate>[]>(() => {
    const metricCols: ColumnDef<Candidate>[] = visibleMetricFields.map((field) => ({
      id: field.key,
      header: field.label,
      accessorFn: (row: Candidate) => {
        const v = row.metrics[field.key]
        return typeof v === 'number' ? v : null
      },
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const v = getValue()
        return typeof v === 'number' ? v.toFixed(3) : '—'
      },
    }))

    return [
      {
        id: 'rank',
        header: '#',
        cell: ({ row }: { row: { index: number; original: Candidate } }) => {
          const candidateId = row.original.id
          const starred = isShortlisted(candidateId, campaignId)
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (starred) removeFromShortlist(candidateId, campaignId)
                  else addToShortlist({ candidateId, campaignId, addedAt: new Date().toISOString(), status: 'candidate', notes: '' })
                }}
                className={`shrink-0 p-0.5 rounded transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30 ${
                  starred ? 'text-amber-400' : 'text-muted-foreground opacity-30 hover:opacity-100'
                }`}
              >
                <Star size={14} fill={starred ? 'currentColor' : 'none'} strokeWidth={2} />
              </button>
              <span className="text-xs text-muted-foreground">{row.index + 1}</span>
            </div>
          )
        },
      },
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row, getValue }: { row: { original: Candidate }; getValue: () => unknown }) => (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate max-w-[160px]">{String(getValue())}</span>
            <button
              onClick={(e) => { e.stopPropagation(); addToComparison(row.original.id) }}
              className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-20 group-hover/row:opacity-100"
              title="Add to comparison"
            >
              <GitCompare size={12} />
            </button>
          </div>
        ),
      },
      {
        id: 'dev',
        header: 'Dev.',
        cell: ({ row }: { row: { original: Candidate } }) => {
          const seq = row.original.sequence
          if (!seq) return <span className="text-muted-foreground/40 text-xs">—</span>
          return <DevelopabilityBadge sequence={seq} />
        },
      },
      {
        id: 'sequence_length',
        header: 'Len',
        accessorFn: (row: Candidate) => row.sequence?.length ?? 0,
        cell: ({ getValue }: { getValue: () => unknown }) => String(getValue()),
      },
      ...metricCols,
    ]
  }, [visibleMetricFields, campaignId, isShortlisted, addToShortlist, removeFromShortlist, addToComparison])

  const table = useReactTable({
    data: displayCandidates,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 33,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalVirtualSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0
    ? totalVirtualSize - virtualRows[virtualRows.length - 1].end
    : 0

  const selectedIndex = useMemo(
    () => rows.findIndex((r) => r.original.id === selectedCandidateId),
    [rows, selectedCandidateId]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(selectedIndex + 1, rows.length - 1)
        if (rows[next]) setSelectedCandidateId(rows[next].original.id)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max(selectedIndex - 1, 0)
        if (rows[prev]) setSelectedCandidateId(rows[prev].original.id)
      }
    },
    [selectedIndex, rows, setSelectedCandidateId]
  )

  useEffect(() => {
    if (selectedCandidateId === null) return
    const idx = rows.findIndex((r) => r.original.id === selectedCandidateId)
    if (idx !== -1) rowVirtualizer.scrollToIndex(idx, { align: 'auto' })
  }, [selectedCandidateId, rows, rowVirtualizer])

  useEffect(() => {
    if (!requestedScrollToId) return
    const idx = rows.findIndex((r) => r.original.id === requestedScrollToId)
    if (idx !== -1) rowVirtualizer.scrollToIndex(idx, { align: 'center' })
    setRequestedScrollToId(null)
  }, [requestedScrollToId, rows, setRequestedScrollToId, rowVirtualizer])

  const handleApplySql = () => { setSqlError(null); setSqlFilter(sqlInput.trim()) }
  const handleClearSql = () => { setSqlFilter(''); setSqlInput(''); setSqlError(null) }

  return (
    <div className={`flex flex-col gap-2 min-h-0 ${className ?? ''}`} onKeyDown={handleKeyDown} tabIndex={0} role="grid" aria-label="Candidate table">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, sequence…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:border-primary"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={11} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowShortlistOnly(!showShortlistOnly)}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
            showShortlistOnly
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Star size={11} fill={showShortlistOnly ? 'currentColor' : 'none'} />
          Shortlisted
        </button>

        <div className="relative" ref={columnPickerRef}>
          <button
            onClick={() => setShowColumnPicker((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
              showColumnPicker ? 'border-primary text-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <SlidersHorizontal size={11} />
            Columns
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-border bg-card shadow-lg p-3 z-50">
              <p className="text-xs font-medium text-muted-foreground mb-2">Metric columns (max 6)</p>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {numericMetricFields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMetricKeys.includes(f.key)}
                      onChange={(e) => {
                        if (e.target.checked && selectedMetricKeys.length < 6) {
                          setSelectedMetricKeys([...selectedMetricKeys, f.key])
                        } else if (!e.target.checked) {
                          setSelectedMetricKeys(selectedMetricKeys.filter((k) => k !== f.key))
                        }
                      }}
                      className="accent-primary"
                    />
                    <span className="text-xs text-foreground">{f.label}</span>
                    {f.unit && <span className="text-xs text-muted-foreground">({f.unit})</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {brushedSet && brushedSet.size > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (!brushedCandidateIds || brushedCandidateIds.length === 0) return
                const idList = brushedCandidateIds.map((id) => `'${id}'`).join(',')
                const filter = `id IN (${idList})`
                setSqlInput(filter)
                setSqlFilter(filter)
                setBrushedCandidateIds(null)
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              title="Apply as filter"
            >
              <Filter size={11} />
              Filter {brushedSet.size}
            </button>
            <button
              onClick={() => setBrushedCandidateIds(null)}
              className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Clear selection"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApplySql() }}
            placeholder={dbReady ? 'SQL filter: plddt > 85 AND iptm > 0.7' : 'DuckDB initializing…'}
            disabled={!dbReady}
            className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:border-primary font-mono disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleApplySql}
          disabled={!dbReady || !sqlInput.trim()}
          className="px-2.5 py-1.5 text-xs rounded-md border border-border bg-muted hover:bg-muted/70 text-muted-foreground disabled:opacity-40 transition-colors"
        >
          Filter
        </button>
        {sqlFilter && (
          <button onClick={handleClearSql} className="px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors">
            Clear
          </button>
        )}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_PRESETS.filter((p) => p.where).map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setSqlInput(preset.where); setSqlFilter(preset.where) }}
              className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {sqlError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
          <span className="font-medium shrink-0">SQL error:</span>
          <span className="truncate">{sqlError}</span>
          <button onClick={handleClearSql} className="ml-auto shrink-0 hover:opacity-70"><X size={11} /></button>
        </div>
      )}

      <div ref={tableContainerRef} className="flex-1 min-h-0 overflow-y-auto border rounded-md">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort()
                  const sortDir = header.column.getIsSorted()
                  const isNumeric = visibleMetricFields.some((f) => f.key === header.column.id)
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 font-medium text-xs text-muted-foreground border-b select-none whitespace-nowrap ${
                        isSortable ? 'cursor-pointer hover:text-foreground' : ''
                      } ${isNumeric ? 'text-right' : 'text-left'}`}
                      onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className={`flex items-center gap-1 ${isNumeric ? 'justify-end' : ''}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isSortable && (
                          <span className="text-muted-foreground/60">
                            {sortDir === 'asc' ? <ArrowUp size={12} /> : sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />}
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr><td style={{ height: paddingTop }} colSpan={columns.length} /></tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              const isSelected = row.original.id === selectedCandidateId
              const isBrushed = brushedSet?.has(row.original.id) ?? false
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() => setSelectedCandidateId(row.original.id)}
                  onDoubleClick={() => focusCandidate(row.original.id)}
                  className={`group/row cursor-pointer border-b last:border-0 transition-colors ${
                    isSelected
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : isBrushed
                        ? 'bg-blue-500/8 hover:bg-blue-500/12'
                        : 'hover:bg-muted/50'
                  }`}
                  role="row"
                  aria-selected={isSelected}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = visibleMetricFields.some((f) => f.key === cell.column.id)
                    return (
                      <td
                        key={cell.id}
                        className={`px-3 py-2 text-xs text-foreground whitespace-nowrap ${isNumeric ? 'text-right tabular-nums' : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-xs text-muted-foreground italic">
                  No candidates match the current filters.
                </td>
              </tr>
            )}
            {paddingBottom > 0 && (
              <tr><td style={{ height: paddingBottom }} colSpan={columns.length} /></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length} of {candidates.length} candidates
        {sqlFilter && <span className="ml-1 text-primary">· SQL filter active</span>}
        {showShortlistOnly && <span className="ml-1 text-amber-400">· Shortlisted only</span>}
      </p>
    </div>
  )
}
