export function statusTextColor(state: 'good' | 'warn' | 'bad' | 'neutral'): string {
  if (state === 'good') return 'text-vis-teal'
  if (state === 'warn') return 'text-vis-amber'
  if (state === 'bad') return 'text-red-400'
  return 'text-foreground'
}

export function statusBgColor(state: 'good' | 'warn' | 'bad'): string {
  if (state === 'good') return 'bg-vis-teal/15 border-vis-teal/30 text-vis-teal'
  if (state === 'warn') return 'bg-vis-amber/15 border-vis-amber/30 text-vis-amber'
  return 'bg-red-500/15 border-red-500/30 text-red-400'
}

export function statusDotColor(state: 'good' | 'warn' | 'bad'): string {
  if (state === 'good') return 'bg-vis-teal'
  if (state === 'warn') return 'bg-vis-amber'
  return 'bg-red-400'
}
