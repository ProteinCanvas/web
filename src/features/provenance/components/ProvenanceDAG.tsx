'use client'

import { useState, useMemo } from 'react'
import { Upload, Filter, Zap, BarChart, Star, Download } from 'lucide-react'
import type { ProvenanceNode, ProvenanceNodeType } from '@/shared/types'

interface ProvenanceDAGProps {
  nodes: ProvenanceNode[]
  className?: string
}

interface NodeLayout {
  node: ProvenanceNode
  x: number
  y: number
}

const NODE_W = 148
const NODE_H = 52
const H_GAP = 56
const V_GAP = 72

const NODE_STYLES: Record<ProvenanceNodeType, { bg: string; border: string; icon: string; dot: string }> = {
  import:   { bg: 'bg-blue-500/15',   border: 'border-blue-500/40',   icon: 'text-blue-400',   dot: '#3b82f6' },
  filter:   { bg: 'bg-orange-500/15', border: 'border-orange-500/40', icon: 'text-orange-400', dot: '#f97316' },
  generate: { bg: 'bg-purple-500/15', border: 'border-purple-500/40', icon: 'text-purple-400', dot: '#a855f7' },
  score:    { bg: 'bg-teal-500/15',   border: 'border-teal-500/40',   icon: 'text-teal-400',   dot: '#14b8a6' },
  shortlist:{ bg: 'bg-green-500/15',  border: 'border-green-500/40',  icon: 'text-green-400',  dot: '#22c55e' },
  export:   { bg: 'bg-gray-500/15',   border: 'border-gray-500/40',   icon: 'text-gray-400',   dot: '#6b7280' },
}

const FALLBACK_STYLE = { bg: 'bg-gray-500/15', border: 'border-gray-500/40', icon: 'text-gray-400', dot: '#6b7280' }

function NodeIcon({ type }: { type: ProvenanceNodeType }) {
  const size = 13
  switch (type) {
    case 'import':    return <Upload size={size} />
    case 'filter':    return <Filter size={size} />
    case 'generate':  return <Zap size={size} />
    case 'score':     return <BarChart size={size} />
    case 'shortlist': return <Star size={size} />
    case 'export':    return <Download size={size} />
  }
}

function computeLayout(nodes: ProvenanceNode[]): NodeLayout[] {
  if (nodes.length === 0) return []

  const idToNode = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))

  for (const node of nodes) {
    for (const outId of node.outputIds ?? []) {
      if (idToNode.has(outId)) {
        inDegree.set(outId, (inDegree.get(outId) ?? 0) + 1)
      }
    }
  }

  const topoOrder: string[][] = []
  const visited = new Set<string>()
  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)

  while (queue.length > 0) {
    const layer = [...queue]
    topoOrder.push(layer)
    queue.length = 0
    for (const id of layer) {
      visited.add(id)
      const node = idToNode.get(id)
      if (!node) continue
      for (const outId of node.outputIds ?? []) {
        if (visited.has(outId)) continue
        const deg = (inDegree.get(outId) ?? 0) - 1
        inDegree.set(outId, deg)
        if (deg === 0) queue.push(outId)
      }
    }
  }

  const unvisited = nodes.filter((n) => !visited.has(n.id))
  if (unvisited.length > 0) topoOrder.push(unvisited.map((n) => n.id))

  const layouts: NodeLayout[] = []
  topoOrder.forEach((layer, yi) => {
    const totalWidth = layer.length * (NODE_W + H_GAP) - H_GAP
    layer.forEach((id, xi) => {
      const node = idToNode.get(id)
      if (!node) return
      layouts.push({
        node,
        x: xi * (NODE_W + H_GAP) - totalWidth / 2,
        y: yi * (NODE_H + V_GAP),
      })
    })
  })

  return layouts
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

export function ProvenanceDAG({ nodes, className }: ProvenanceDAGProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const layouts = useMemo(() => computeLayout(nodes), [nodes])

  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-sm text-muted-foreground ${className ?? ''}`}>
        Import a campaign to start building provenance
      </div>
    )
  }

  const posMap = new Map(layouts.map((l) => [l.node.id, l]))

  const PADDING = 40
  const allX = layouts.map((l) => l.x)
  const allY = layouts.map((l) => l.y)
  const minX = Math.min(...allX) - PADDING
  const minY = Math.min(...allY) - PADDING
  const maxX = Math.max(...allX) + NODE_W + PADDING
  const maxY = Math.max(...allY) + NODE_H + PADDING
  const svgW = maxX - minX
  const svgH = maxY - minY

  const edges: { x1: number; y1: number; x2: number; y2: number; id: string }[] = []
  for (const layout of layouts) {
    for (const outId of layout.node.outputIds ?? []) {
      const target = posMap.get(outId)
      if (!target) continue
      edges.push({
        id: `${layout.node.id}-${outId}`,
        x1: layout.x + NODE_W / 2 - minX,
        y1: layout.y + NODE_H - minY,
        x2: target.x + NODE_W / 2 - minX,
        y2: target.y - minY,
      })
    }
  }

  const selectedLayout = selectedId ? posMap.get(selectedId) : null

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      <div className="flex-1 overflow-auto relative">
        <div
          className="relative"
          style={{ width: svgW, height: svgH }}
        >
          <svg
            width={svgW}
            height={svgH}
            className="absolute inset-0 pointer-events-none"
          >
            <defs>
              <marker id="prov-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="#374151" />
              </marker>
            </defs>
            {edges.map((e) => {
              const cx = (e.x1 + e.x2) / 2
              const cy1 = e.y1 + (e.y2 - e.y1) * 0.4
              const cy2 = e.y1 + (e.y2 - e.y1) * 0.6
              return (
                <path
                  key={e.id}
                  d={`M ${e.x1} ${e.y1} C ${e.x1} ${cy1}, ${e.x2} ${cy2}, ${e.x2} ${e.y2 - 8}`}
                  stroke="#374151"
                  strokeWidth={1.5}
                  fill="none"
                  markerEnd="url(#prov-arrow)"
                />
              )
            })}
          </svg>

          {layouts.map((layout) => {
            const style = NODE_STYLES[layout.node.type] ?? FALLBACK_STYLE
            const isSelected = selectedId === layout.node.id
            return (
              <button
                key={layout.node.id}
                onClick={() => setSelectedId(isSelected ? null : layout.node.id)}
                className={`absolute flex items-center gap-2 px-3 rounded-lg border transition-all text-left ${style.bg} ${style.border} ${
                  isSelected
                    ? 'ring-2 ring-white/20 shadow-lg shadow-black/20'
                    : 'hover:brightness-110'
                }`}
                style={{
                  left: layout.x - minX,
                  top: layout.y - minY,
                  width: NODE_W,
                  height: NODE_H,
                }}
              >
                <span className={style.icon}>
                  <NodeIcon type={layout.node.type} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate leading-snug">
                    {layout.node.label}
                  </p>
                  {layout.node.candidateCount !== undefined && (
                    <p className="text-xs text-muted-foreground leading-snug">
                      {layout.node.candidateCount} candidates
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedLayout && (
        <div className="border-t border-border px-4 py-3 shrink-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{selectedLayout.node.label}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(selectedLayout.node.timestamp).toLocaleString()}
            </span>
          </div>
          {selectedLayout.node.candidateCount !== undefined && (
            <p className="text-xs text-muted-foreground">
              {selectedLayout.node.candidateCount} candidates
            </p>
          )}
          {Object.keys(selectedLayout.node.parameters).length > 0 && (
            <pre className="bg-muted/50 rounded-md p-2 text-xs overflow-x-auto text-muted-foreground leading-relaxed">
              {safeStringify(selectedLayout.node.parameters)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
