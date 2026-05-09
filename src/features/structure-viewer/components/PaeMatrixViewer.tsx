'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { statusTextColor } from '@/shared/lib/status-colors'

interface PaeMatrixViewerProps {
  paeMatrix: number[][]
  candidateName: string
  binderLength?: number
  onHoverResidues?: (residueIds: string[] | null) => void
  className?: string
}

const MAX_PAE = 30

function paeToColor(val: number): [number, number, number] {
  const t = Math.min(Math.max(val / MAX_PAE, 0), 1)
  if (t < 0.5) {
    const s = t * 2
    return [Math.round(s * 255), Math.round(178 + (200 - 178) * s), Math.round(89 * (1 - s))]
  }
  const s = (t - 0.5) * 2
  return [Math.round(255 - 35 * s), Math.round(200 * (1 - s)), 0]
}

function ticksFor(size: number): number[] {
  const interval = size <= 100 ? 25 : size <= 300 ? 50 : size <= 600 ? 100 : 200
  const out: number[] = []
  for (let i = interval; i <= size; i += interval) out.push(i)
  return out
}

export function PaeMatrixViewer({ paeMatrix, candidateName, binderLength, onHoverResidues, className }: PaeMatrixViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState<{ i: number; j: number; val: number } | null>(null)
  const size = paeMatrix.length

  const { maxVal, meanVal, interfaceMeanVal } = useMemo(() => {
    let max = -Infinity
    let sum = 0
    let ifSum = 0
    let ifCount = 0
    const bl = binderLength
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const v = paeMatrix[i]?.[j] ?? MAX_PAE
        if (v > max) max = v
        sum += v
        if (bl !== undefined && bl > 0 && size - bl > 20) {
          const isOffDiag = (i < bl && j >= bl) || (i >= bl && j < bl)
          if (isOffDiag) { ifSum += v; ifCount++ }
        }
      }
    }
    return {
      maxVal: max,
      meanVal: sum / (size * size),
      interfaceMeanVal: ifCount > 0 ? ifSum / ifCount : null,
    }
  }, [paeMatrix, size, binderLength])

  const ticks = useMemo(() => ticksFor(size), [size])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size === 0) return
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const imageData = ctx.createImageData(size, size)
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const val = paeMatrix[i]?.[j] ?? MAX_PAE
        const [r, g, b] = paeToColor(val)
        const idx = (i * size + j) * 4
        imageData.data[idx] = r
        imageData.data[idx + 1] = g
        imageData.data[idx + 2] = b
        imageData.data[idx + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }, [paeMatrix, size])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const j = Math.floor(((e.clientX - rect.left) / rect.width) * size)
    const i = Math.floor(((e.clientY - rect.top) / rect.height) * size)
    if (i >= 0 && i < size && j >= 0 && j < size) {
      setHovered({ i, j, val: paeMatrix[i]?.[j] ?? 0 })
      onHoverResidues?.([`A:${i + 1}`, `A:${j + 1}`])
    } else {
      setHovered(null)
      onHoverResidues?.(null)
    }
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const out = document.createElement('canvas')
    out.width = Math.max(size, 400)
    out.height = Math.max(size, 400)
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(canvas, 0, 0, out.width, out.height)
    const a = document.createElement('a')
    a.href = out.toDataURL('image/png')
    a.download = `${candidateName}_pae.png`
    a.click()
  }

  if (size === 0) return null

  return (
    <div className={`flex flex-col gap-3 p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">Predicted Aligned Error</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {size}×{size} residues · max {maxVal.toFixed(1)} Å · mean {meanVal.toFixed(1)} Å
            {interfaceMeanVal !== null && (
              <span className="ml-1.5">
                · interface{' '}
                <span className={statusTextColor(interfaceMeanVal < 5 ? 'good' : interfaceMeanVal < 15 ? 'warn' : 'bad')}>
                  {interfaceMeanVal.toFixed(1)} Å
                </span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
        >
          <Download size={11} />
          PNG
        </button>
      </div>

      <div className="flex flex-col gap-0">
        <div className="flex gap-0 items-stretch">
          <div className="relative w-6 shrink-0">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-1 text-[9px] font-mono text-muted-foreground/60 -translate-y-1/2 select-none"
                style={{ top: `${(tick / size) * 100}%` }}
              >
                {tick}
              </span>
            ))}
          </div>

          <div className="flex-1 relative min-w-0">
            <canvas
              ref={canvasRef}
              className="w-full block"
              style={{ aspectRatio: '1', imageRendering: 'pixelated' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => { setHovered(null); onHoverResidues?.(null) }}
            />
            {binderLength !== undefined && binderLength > 0 && binderLength < size && (
              <>
                <div
                  className="absolute inset-y-0 border-l border-dashed border-white/40 pointer-events-none"
                  style={{ left: `${(binderLength / size) * 100}%` }}
                />
                <div
                  className="absolute inset-x-0 border-t border-dashed border-white/40 pointer-events-none"
                  style={{ top: `${(binderLength / size) * 100}%` }}
                />
                {size - binderLength > 20 && (
                  <>
                    <div
                      className="absolute pointer-events-none border border-teal-400/50 rounded-sm"
                      style={{
                        top: 0,
                        left: `${(binderLength / size) * 100}%`,
                        width: `${((size - binderLength) / size) * 100}%`,
                        height: `${(binderLength / size) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute pointer-events-none border border-teal-400/50 rounded-sm"
                      style={{
                        top: `${(binderLength / size) * 100}%`,
                        left: 0,
                        width: `${(binderLength / size) * 100}%`,
                        height: `${((size - binderLength) / size) * 100}%`,
                      }}
                    />
                  </>
                )}
              </>
            )}
            {hovered && (
              <div className="absolute top-1 right-1 bg-card/90 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono pointer-events-none">
                <span className="text-muted-foreground">pos </span>
                {hovered.j + 1},{hovered.i + 1}
                <span className="text-muted-foreground"> → </span>
                <span className={statusTextColor(hovered.val < 5 ? 'good' : hovered.val < 15 ? 'warn' : 'bad')}>
                  {hovered.val.toFixed(1)} Å
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-0">
          <div className="w-6 shrink-0" />
          <div className="flex-1 relative h-4 min-w-0">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-1 text-[9px] font-mono text-muted-foreground/60 -translate-x-1/2 select-none"
                style={{ left: `${(tick / size) * 100}%` }}
              >
                {tick}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">0 Å</span>
        <div
          className="flex-1 h-2.5 rounded"
          style={{ background: 'linear-gradient(to right, rgb(0,178,89), rgb(255,200,0), rgb(220,30,30))' }}
        />
        <span className="text-xs text-muted-foreground shrink-0">{MAX_PAE}+ Å</span>
      </div>

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Green = high confidence. Diagonal blocks = within-chain. Off-diagonal = interface uncertainty.
        {binderLength !== undefined && binderLength > 0 && binderLength < size && (
          <span className="ml-1">Dashed line marks binder / target chain boundary.</span>
        )}
      </p>
    </div>
  )
}
