'use client'

import { useState, useRef } from 'react'
import { Plus, X, Copy, Check } from 'lucide-react'
import type { ConstraintSpec, ResidueRef, ResidueRange } from '@/shared/types'
import {
  exportRFdiffusionConfig,
  exportBindCraftConfig,
  formatConfigDiff,
} from '../lib/config-exporters'

interface ConstraintEditorProps {
  spec: ConstraintSpec
  onChange: (spec: ConstraintSpec) => void
  className?: string
}

type ExportTab = 'rfdiffusion' | 'bindcraft'

function parseResidueRef(input: string): ResidueRef | null {
  const match = input.trim().match(/^([A-Za-z]):(\d+)$/)
  if (!match) return null
  return { chainId: match[1].toUpperCase(), residueIndex: parseInt(match[2], 10) }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:border-border"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function ConstraintEditor({ spec, onChange, className }: ConstraintEditorProps) {
  const [hotspotInput, setHotspotInput] = useState('')
  const [hotspotError, setHotspotError] = useState('')
  const [lockInput, setLockInput] = useState('')
  const [lockError, setLockError] = useState('')
  const [maskChain, setMaskChain] = useState('A')
  const [maskStart, setMaskStart] = useState('')
  const [maskEnd, setMaskEnd] = useState('')
  const [maskError, setMaskError] = useState('')
  const [exportTab, setExportTab] = useState<ExportTab>('rfdiffusion')
  const prevSpec = useRef<ConstraintSpec | null>(null)

  const diff = formatConfigDiff(prevSpec.current, spec)

  const addHotspot = () => {
    const ref = parseResidueRef(hotspotInput)
    if (!ref) {
      setHotspotError('Format: A:123')
      return
    }
    prevSpec.current = spec
    onChange({ ...spec, hotspots: [...spec.hotspots, ref] })
    setHotspotInput('')
    setHotspotError('')
  }

  const removeHotspot = (index: number) => {
    prevSpec.current = spec
    onChange({ ...spec, hotspots: spec.hotspots.filter((_, i) => i !== index) })
  }

  const addLock = () => {
    const ref = parseResidueRef(lockInput)
    if (!ref) {
      setLockError('Format: A:123')
      return
    }
    prevSpec.current = spec
    onChange({ ...spec, locks: [...spec.locks, ref] })
    setLockInput('')
    setLockError('')
  }

  const removeLock = (index: number) => {
    prevSpec.current = spec
    onChange({ ...spec, locks: spec.locks.filter((_, i) => i !== index) })
  }

  const addMask = () => {
    const start = parseInt(maskStart, 10)
    const end = parseInt(maskEnd, 10)
    if (!maskChain || isNaN(start) || isNaN(end) || start > end) {
      setMaskError('Valid chain and start ≤ end required')
      return
    }
    const range: ResidueRange = { chainId: maskChain.toUpperCase(), startIndex: start, endIndex: end }
    prevSpec.current = spec
    onChange({ ...spec, masks: [...spec.masks, range] })
    setMaskChain('A')
    setMaskStart('')
    setMaskEnd('')
    setMaskError('')
  }

  const removeMask = (index: number) => {
    prevSpec.current = spec
    onChange({ ...spec, masks: spec.masks.filter((_, i) => i !== index) })
  }

  const rfdiffusionYaml = exportRFdiffusionConfig(spec)
  const bindcraftJson = JSON.stringify(exportBindCraftConfig(spec), null, 2)

  return (
    <div className={`flex flex-col gap-4 p-4 ${className ?? ''}`}>
      <p className="text-xs text-muted-foreground/70 leading-relaxed border-b border-border pb-4">
        Define constraints for your next design round based on what you learned from this campaign.
        Add hotspots, masks, and locks, then copy the generated config directly into RFdiffusion or BindCraft.
      </p>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Hotspots
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {spec.hotspots.map((ref, i) => (
            <span
              key={i}
              className="flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs rounded px-2 py-0.5"
            >
              {ref.chainId}:{ref.residueIndex}
              <button onClick={() => removeHotspot(i)} className="hover:text-blue-100">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={hotspotInput}
            onChange={(e) => setHotspotInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHotspot()}
            placeholder="A:123"
            className="flex-1 text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
          <button
            onClick={addHotspot}
            className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 text-muted-foreground px-2 py-1.5 rounded transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        {hotspotError && <p className="text-xs text-red-400 mt-1">{hotspotError}</p>}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Masks
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {spec.masks.map((range, i) => (
            <span
              key={i}
              className="flex items-center gap-1 bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs rounded px-2 py-0.5"
            >
              {range.chainId}:{range.startIndex}-{range.endIndex}
              <button onClick={() => removeMask(i)} className="hover:text-orange-100">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={maskChain}
            onChange={(e) => setMaskChain(e.target.value)}
            placeholder="Chain"
            maxLength={1}
            className="w-14 text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
          <input
            value={maskStart}
            onChange={(e) => setMaskStart(e.target.value)}
            placeholder="Start"
            type="number"
            className="w-16 text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
          <input
            value={maskEnd}
            onChange={(e) => setMaskEnd(e.target.value)}
            placeholder="End"
            type="number"
            className="w-16 text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
          <button
            onClick={addMask}
            className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 text-muted-foreground px-2 py-1.5 rounded transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        {maskError && <p className="text-xs text-red-400 mt-1">{maskError}</p>}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Locks
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {spec.locks.map((ref, i) => (
            <span
              key={i}
              className="flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs rounded px-2 py-0.5"
            >
              {ref.chainId}:{ref.residueIndex}
              <button onClick={() => removeLock(i)} className="hover:text-purple-100">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={lockInput}
            onChange={(e) => setLockInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLock()}
            placeholder="A:123"
            className="flex-1 text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
          <button
            onClick={addLock}
            className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 text-muted-foreground px-2 py-1.5 rounded transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        {lockError && <p className="text-xs text-red-400 mt-1">{lockError}</p>}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Export
        </h3>
        <div className="flex gap-1 mb-2">
          {(['rfdiffusion', 'bindcraft'] as ExportTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setExportTab(tab)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                exportTab === tab
                  ? 'bg-muted text-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab === 'rfdiffusion' ? 'RFdiffusion YAML' : 'BindCraft JSON'}
            </button>
          ))}
        </div>
        <div className="relative">
          <pre className="text-xs bg-card border border-border rounded p-3 overflow-x-auto text-muted-foreground max-h-48">
            {exportTab === 'rfdiffusion' ? rfdiffusionYaml : bindcraftJson}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={exportTab === 'rfdiffusion' ? rfdiffusionYaml : bindcraftJson} />
          </div>
        </div>
        {prevSpec.current !== null && (
          <p className="text-xs text-muted-foreground/70 mt-2">{diff}</p>
        )}
      </div>
    </div>
  )
}
