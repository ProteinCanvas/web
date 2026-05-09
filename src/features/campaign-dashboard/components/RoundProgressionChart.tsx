'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { median, isHighExpression } from '@/shared/lib/metrics'
import type { Campaign } from '@/shared/types'

interface Props {
  campaign: Campaign
}

type MetricKey = 'hitRate' | 'expressionRate' | 'medianKd' | 'medianTm'

const METRIC_OPTIONS: { key: MetricKey; label: string; unit: string; domain: [number | 'auto', number | 'auto'] }[] = [
  { key: 'hitRate', label: 'Hit rate', unit: '%', domain: [0, 100] },
  { key: 'expressionRate', label: 'Expression rate', unit: '%', domain: [0, 100] },
  { key: 'medianKd', label: 'Median KD', unit: 'nM', domain: [0, 'auto'] },
  { key: 'medianTm', label: 'Median Tm', unit: '°C', domain: ['auto', 'auto'] },
]

export function RoundProgressionChart({ campaign }: Props) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('hitRate')

  const chartData = useMemo(() => {
    const rounds = campaign.rounds ?? []
    const experimentalResults = campaign.experimentalResults ?? []
    return rounds
      .map((round) => {
        const results = experimentalResults.filter((r) => r.round === round.roundNumber)
        if (results.length === 0) return null

        const expressed = results.filter((r) =>
          r.expressed === true || (r.expressionRate !== undefined && isHighExpression(r.expressionRate))
        )
        const binding = results.filter((r) => r.bindingSuccess === true)
        const kdValues = results.flatMap((r) => r.kd !== undefined ? [r.kd] : [])
        const tmValues = results.flatMap((r) => r.tm !== undefined ? [r.tm] : [])

        return {
          label: round.label,
          hitRate: results.length > 0 ? (binding.length / results.length) * 100 : null,
          expressionRate: results.length > 0 ? (expressed.length / results.length) * 100 : null,
          medianKd: median(kdValues),
          medianTm: median(tmValues),
          n: results.length,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
  }, [campaign.rounds, campaign.experimentalResults])

  const roundsWithData = chartData.length
  if (roundsWithData < 2) return null

  const meta = METRIC_OPTIONS.find((m) => m.key === selectedMetric)!
  const hasData = chartData.some((d) => d[selectedMetric] !== null)
  if (!hasData) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Round progression</h3>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
        >
          {METRIC_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={meta.domain}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v: number) => `${v.toFixed(0)}${meta.unit !== 'nM' && meta.unit !== '°C' ? meta.unit : ''}`}
            />
            <Tooltip
              contentStyle={{
                fontSize: '11px',
                borderRadius: '6px',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--popover))',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value) => {
                const v = value as number | undefined
                if (typeof v !== 'number') return ['—', meta.label]
                return [`${v.toFixed(1)} ${meta.unit}`, meta.label]
              }}
              labelFormatter={(label, payload) => {
                const n = (payload?.[0]?.payload as { n?: number } | undefined)?.n
                return `${String(label)}${n !== undefined ? ` (n=${n})` : ''}`
              }}
            />
            {(selectedMetric === 'hitRate' || selectedMetric === 'expressionRate') && (
              <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />
            )}
            <Line
              type="monotone"
              dataKey={selectedMetric}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
