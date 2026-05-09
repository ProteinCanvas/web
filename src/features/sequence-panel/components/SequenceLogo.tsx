'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface SequenceLogoProps {
  sequences: string[]
  highlightPositions?: number[]
  trackRef?: React.RefObject<HTMLDivElement | null>
  className?: string
}

const AA_HEX: Record<string, string> = {
  F: '#7c3aed', Y: '#7c3aed', W: '#7c3aed', H: '#6d28d9',
  K: '#1d4ed8', R: '#1d4ed8',
  D: '#b91c1c', E: '#b91c1c',
  S: '#15803d', T: '#15803d', N: '#166534', Q: '#166534',
  V: '#b45309', I: '#b45309', L: '#b45309', M: '#92400e', A: '#78350f', C: '#854d0e',
  G: '#854d0e', P: '#a16207',
}
const AA_DEFAULT_HEX = '#374151'

function getAAHex(aa: string): string {
  return AA_HEX[aa.toUpperCase()] ?? AA_DEFAULT_HEX
}

const CELL_W = 18
const CELL_GAP = 1
const LOGO_H = 52
const LABEL_H = 14

interface TooltipState {
  x: number
  y: number
  position: number
  frequencies: [string, number][]
}

export function SequenceLogo({ sequences, highlightPositions, trackRef, className }: SequenceLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const positions = sequences.length > 0 ? sequences[0].length : 0
  const stride = CELL_W + CELL_GAP

  const computeColumn = useCallback(
    (col: number): [string, number][] => {
      const counts: Record<string, number> = {}
      for (const seq of sequences) {
        const aa = seq[col]?.toUpperCase()
        if (aa) counts[aa] = (counts[aa] ?? 0) + 1
      }
      const total = sequences.length
      return Object.entries(counts)
        .map(([aa, count]): [string, number] => [aa, count / total])
        .sort((a, b) => b[1] - a[1])
    },
    [sequences]
  )

  const computeInfo = useCallback(
    (col: number): number => {
      const freqs = computeColumn(col)
      let entropy = 0
      for (const [, f] of freqs) {
        if (f > 0) entropy -= f * Math.log2(f)
      }
      return Math.max(0, Math.log2(20) - entropy)
    },
    [computeColumn]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || sequences.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let col = 0; col < positions; col++) {
      const x = col * stride
      const info = computeInfo(col)
      const barH = (info / Math.log2(20)) * LOGO_H
      const freqs = computeColumn(col)

      if (highlightPositions?.includes(col)) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        ctx.fillRect(x, 0, CELL_W, LOGO_H + LABEL_H)
      }

      let yOff = LOGO_H - barH
      for (const [aa, freq] of freqs) {
        const letterH = freq * barH
        if (letterH < 0.5) continue
        ctx.fillStyle = getAAHex(aa)
        ctx.fillRect(x, yOff, CELL_W, letterH)

        if (letterH >= 9) {
          ctx.fillStyle = '#fff'
          ctx.font = `bold ${Math.min(Math.floor(letterH - 1), CELL_W - 1)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(aa, x + CELL_W / 2, yOff + letterH / 2)
        }

        yOff += letterH
      }
    }
  }, [sequences, highlightPositions, positions, stride, computeColumn, computeInfo])

  useEffect(() => {
    const outer = trackRef?.current
    const container = containerRef.current
    if (!outer || !container) return
    function sync() {
      if (container) container.scrollLeft = outer!.scrollLeft
    }
    outer.addEventListener('scroll', sync, { passive: true })
    return () => outer.removeEventListener('scroll', sync)
  }, [trackRef])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const col = Math.floor(mx / stride)
      if (col < 0 || col >= positions) { setTooltip(null); return }
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        position: col + 1,
        frequencies: computeColumn(col),
      })
    },
    [positions, stride, computeColumn]
  )

  const canvasW = positions * stride

  if (sequences.length === 0) return null

  return (
    <div className={`flex flex-col gap-0 ${className ?? ''}`}>
      <div ref={containerRef} className="overflow-hidden" style={{ scrollbarWidth: 'none' }}>
        <div className="relative" style={{ width: canvasW }}>
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={LOGO_H + LABEL_H}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
            className="cursor-crosshair block"
          />
          {tooltip && (
            <div
              className="absolute z-20 bg-popover border border-border rounded-md p-2 pointer-events-none shadow-md text-xs"
              style={{ left: Math.min(tooltip.x + 10, canvasW - 120), top: Math.max(tooltip.y - 80, 0) }}
            >
              <p className="font-semibold text-foreground mb-1">Position {tooltip.position}</p>
              {tooltip.frequencies.slice(0, 5).map(([aa, freq]) => (
                <div key={aa} className="flex items-center gap-1.5 py-px">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: getAAHex(aa) }}
                  />
                  <span className="text-muted-foreground font-mono">
                    {aa} <span className="text-foreground">{(freq * 100).toFixed(0)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
