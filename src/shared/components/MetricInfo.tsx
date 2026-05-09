'use client'

import { HelpCircle } from 'lucide-react'
import { METRIC_TOOLTIPS } from '@/shared/lib/metric-tooltips'
import { getMetricMeta } from '@/shared/lib/metric-registry'

interface MetricInfoProps {
  metricKey: string
  placement?: 'above' | 'below'
}

export function MetricInfo({ metricKey, placement = 'above' }: MetricInfoProps) {
  const tooltip = METRIC_TOOLTIPS[metricKey] ?? null
  const meta = getMetricMeta(metricKey)
  const description = tooltip?.description ?? meta?.description ?? null
  if (!description) return null

  const directionText =
    tooltip?.direction === 'higher-better'
      ? 'Higher is better ↑'
      : tooltip?.direction === 'lower-better'
        ? 'Lower is better ↓'
        : null

  const popupPos =
    placement === 'above'
      ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
      : 'top-full mt-2 left-1/2 -translate-x-1/2'

  return (
    <div className="relative group/minfo inline-flex items-center">
      <HelpCircle
        size={10}
        className="text-muted-foreground/35 group-hover/minfo:text-muted-foreground/70 transition-colors cursor-help shrink-0"
      />
      <div className={`pointer-events-none absolute ${popupPos} z-50 hidden group-hover/minfo:block w-56`}>
        <div className="rounded-lg border border-border bg-card shadow-xl p-3 text-left">
          <p className="text-xs text-foreground leading-relaxed">{description}</p>
          {tooltip?.typical_good && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">Good: </span>
              {tooltip.typical_good}
            </p>
          )}
          {directionText && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{directionText}</p>
          )}
          {tooltip?.reference && (
            <p className="mt-1.5 text-[10px] text-muted-foreground/60 italic">{tooltip.reference}</p>
          )}
        </div>
      </div>
    </div>
  )
}
