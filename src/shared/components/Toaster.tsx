'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useToastStore } from '../hooks/useToast'

export function Toaster() {
  const [mounted, setMounted] = useState(false)
  const { toasts, dismiss } = useToastStore()

  useEffect(() => { setMounted(true) }, [])

  if (!mounted || toasts.length === 0) return null

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-card border border-border shadow-xl pointer-events-auto max-w-sm"
        >
          {t.type === 'success' && <CheckCircle2 size={13} className="text-green-400 shrink-0" />}
          {t.type === 'error' && <AlertCircle size={13} className="text-red-400 shrink-0" />}
          {t.type === 'info' && <Info size={13} className="text-blue-400 shrink-0" />}
          <p className="text-xs text-foreground flex-1 leading-snug">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
