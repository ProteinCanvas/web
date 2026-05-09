'use client'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: 'w-3 h-3 border',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-2',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div className={`${SIZE[size]} border-primary/30 border-t-primary rounded-full animate-spin ${className ?? ''}`} />
  )
}
