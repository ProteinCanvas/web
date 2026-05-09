'use client'

import { type ButtonHTMLAttributes } from 'react'

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function GhostButton({ children, className, ...props }: GhostButtonProps) {
  return (
    <button
      {...props}
      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
