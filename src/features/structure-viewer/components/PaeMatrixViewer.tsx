'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'

interface PaeMatrixViewerProps {
  paeMatrix: number[][]
  candidateName: string
  className?: string
}

const MAX_PAE = 30

function paeToColor(val: number): [number, number, number] {
  const t = Math.min(Math.max(val / MAX_PAE, 0), 1)
  if (t < 0.5) {
    const s = t * 2
    return [
      Math.round(0 + (255 - 0) * s),
      Math.round(80 + (230 - 80) * (1 - s)),
      Math.round(180 + (50 - 180) * s),
    ]
  }
  const s = (t - 0.5) * 2
  return [
    Math.round(255 + (180 - 255) * (1 - s)),
    Math.round(230 * (1 - s)),
    Math.round(50 * (1 - s)),
  ]
}

export function PaeMatrixViewer({ paeMatrix, candidateName, className }: PaeMatrixViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState<{ i: number; j: number; val: number } | null>(null)
  const size = paeMatrix.length

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
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = size / rect.width
    const scaleY = size / rect.height
    const j = Math.floor((e.clientX - rect.left) * scaleX)
    const i = Math.floor((e.clientY - rect.top) * scaleY)
    if (i >= 0 && i < size && j >= 0 && j < size) {
      setHovered({ i, j, val: paeMatrix[i]?.[j] ?? 0 })
    }
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = Math.max(size, 400)
    exportCanvas.height = Math.max(size, 400)
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height)
    const url = exportCanvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${candidateName}_pae.png`
    a.click()
  }

  if (size === 0) return null

  const maxVal = Math.max(...paeMatrix.flat())
  const meanVal = paeMatrix.flat().reduce((a, b) => a + b, 0) / (size * size)

  return (
    <div className={`flex flex-col gap-4 p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Predicted Aligned Error</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {size}×{size} residues · max {maxVal.toFixed(1)} Å · mean {meanVal.toFixed(1)} Å
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Download size={11} />
          PNG
        </button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full rounded border border-border"
          style={{ imageRendering: 'pixelated', aspectRatio: '1' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        />
        {hovered && (
          <div className="absolute top-2 right-2 bg-card/90 border border-border rounded px-2 py-1 text-xs font-mono pointer-events-none">
            ({hovered.i + 1}, {hovered.j + 1}) → {hovered.val.toFixed(1)} Å
          </div>
        )}
        <div className="absolute top-2 left-2 text-[10px] text-white/60 font-mono pointer-events-none">
          scored residue →
        </div>
        <div
          className="absolute left-1 text-[10px] text-white/60 font-mono pointer-events-none"
          style={{ top: '50%', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}
        >
          aligned residue →
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">0 Å</span>
        <div
          className="flex-1 h-3 rounded"
          style={{
            background: `linear-gradient(to right, rgb(0,80,180), rgb(255,230,50), rgb(180,0,0))`,
          }}
        />
        <span className="text-xs text-muted-foreground">{MAX_PAE}+ Å</span>
      </div>
      <p className="text-xs text-muted-foreground/60">
        Low values (blue) = high confidence in relative position. Interface region ideally shows low PAE.
      </p>
    </div>
  )
}
