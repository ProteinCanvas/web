'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'

const SHORTCUTS = [
  { section: 'Navigation', rows: [
    { key: 'j / ↓', action: 'Next candidate' },
    { key: 'k / ↑', action: 'Previous candidate' },
  ]},
  { section: 'Selection', rows: [
    { key: 's', action: 'Toggle shortlist for selected candidate' },
    { key: 'c', action: 'Add selected candidate to comparison' },
  ]},
  { section: 'Interface', rows: [
    { key: '?', action: 'Toggle this shortcuts panel' },
    { key: 'Esc', action: 'Close panel / exit fullscreen' },
  ]},
  { section: 'Structure viewer', rows: [
    { key: 'Click residue', action: 'Select residue (cross-highlights sequence panel)' },
    { key: 'Scroll', action: 'Zoom in / out' },
  ]},
]

interface KeyboardShortcutsProps {
  externalOpen?: boolean
  onExternalClose?: () => void
}

export function KeyboardShortcuts({ externalOpen, onExternalClose }: KeyboardShortcutsProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen ?? internalOpen
  const onExternalCloseRef = useRef(onExternalClose)
  useEffect(() => { onExternalCloseRef.current = onExternalClose }, [onExternalClose])

  const close = () => {
    setInternalOpen(false)
    onExternalCloseRef.current?.()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const isInput =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      if (isInput) return
      if (e.key === '?') setInternalOpen((v) => !v)
      if (e.key === 'Escape') {
        setInternalOpen(false)
        onExternalCloseRef.current?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  return (
    <Modal title="Keyboard shortcuts" onClose={close} maxWidth="max-w-sm">
      <div className="p-5 flex flex-col gap-4">
        {SHORTCUTS.map(({ section, rows }) => (
          <div key={section}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{section}</p>
            <table className="w-full">
              <tbody>
                {rows.map(({ key, action }) => (
                  <tr key={key} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-4 w-36 shrink-0">
                      <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded text-foreground whitespace-nowrap">
                        {key}
                      </kbd>
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground/50">Press ? anywhere to toggle</p>
      </div>
    </Modal>
  )
}
