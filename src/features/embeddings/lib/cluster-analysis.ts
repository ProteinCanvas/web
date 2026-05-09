import type { ClusterAssignment, ClusterSummary } from '../types'
import type { Candidate, ExperimentalResult } from '@/shared/types'

interface Point2D {
  x: number
  y: number
  id: string
}

function distanceSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

function centroid(points: { x: number; y: number }[]): { x: number; y: number } {
  const n = points.length
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  }
}

function kMeansPlusPlusInit(
  points: Point2D[],
  k: number
): { x: number; y: number }[] {
  const centers: { x: number; y: number }[] = []
  const first = points[Math.floor(Math.random() * points.length)]
  centers.push({ x: first.x, y: first.y })

  for (let c = 1; c < k; c++) {
    const weights = points.map((p) => {
      let minDistSq = Infinity
      for (const center of centers) {
        const d = distanceSq(p, center)
        if (d < minDistSq) minDistSq = d
      }
      return minDistSq
    })
    const total = weights.reduce((s, w) => s + w, 0)
    let rand = Math.random() * total
    let chosen = points[points.length - 1]
    for (let i = 0; i < points.length; i++) {
      rand -= weights[i]
      if (rand <= 0) {
        chosen = points[i]
        break
      }
    }
    centers.push({ x: chosen.x, y: chosen.y })
  }

  return centers
}

export function kMeans(
  points: ReadonlyArray<Point2D>,
  k: number,
  maxIter = 100
): ClusterAssignment[] {
  if (points.length === 0) return []
  const effectiveK = Math.min(k, points.length)
  const mutable = points as Point2D[]

  let centers = kMeansPlusPlusInit(mutable, effectiveK)
  let assignments = new Int32Array(points.length)

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false

    for (let i = 0; i < points.length; i++) {
      let best = 0
      let bestDistSq = Infinity
      for (let c = 0; c < centers.length; c++) {
        const d = distanceSq(points[i], centers[c])
        if (d < bestDistSq) {
          bestDistSq = d
          best = c
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best
        changed = true
      }
    }

    if (!changed) break

    const newCenters = Array.from({ length: effectiveK }, () => ({ x: 0, y: 0, count: 0 }))
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i]
      newCenters[c].x += points[i].x
      newCenters[c].y += points[i].y
      newCenters[c].count++
    }

    centers = newCenters.map((nc, idx) =>
      nc.count > 0
        ? { x: nc.x / nc.count, y: nc.y / nc.count }
        : centers[idx]
    )
  }

  return points.map((p, i) => ({
    candidateId: p.id,
    clusterId: assignments[i],
    umapX: p.x,
    umapY: p.y,
  }))
}

export function buildClusterSummaries(
  assignments: ClusterAssignment[],
  candidates: ReadonlyArray<Candidate>,
  experimentalResults: ReadonlyArray<ExperimentalResult> | undefined
): ClusterSummary[] {
  if (assignments.length === 0) return []

  const candidateMap = new Map(candidates.map((c) => [c.id, c]))

  const expByCandidate = new Map<string, ExperimentalResult[]>()
  for (const r of experimentalResults ?? []) {
    const arr = expByCandidate.get(r.candidateId) ?? []
    arr.push(r)
    expByCandidate.set(r.candidateId, arr)
  }

  const clusterIds = Array.from(new Set(assignments.map((a) => a.clusterId))).sort((a, b) => a - b)

  return clusterIds.map((clusterId) => {
    const members = assignments.filter((a) => a.clusterId === clusterId)
    const clusterCandidates = members
      .map((a) => candidateMap.get(a.candidateId))
      .filter((c): c is Candidate => c !== undefined)

    const sequences = clusterCandidates
      .map((c) => c.sequence)
      .filter((s): s is string => typeof s === 'string' && s.length > 0)

    const center = centroid(members.map((a) => ({ x: a.umapX, y: a.umapY })))

    let hits = 0
    let tested = 0
    for (const c of clusterCandidates) {
      const results = expByCandidate.get(c.id) ?? []
      const testedResults = results.filter((r) => r.bindingSuccess !== undefined)
      if (testedResults.length > 0) {
        tested++
        if (testedResults.some((r) => r.bindingSuccess === true)) hits++
      }
    }

    return {
      clusterId,
      candidateIds: members.map((a) => a.candidateId),
      sequences,
      centroidX: center.x,
      centroidY: center.y,
      bindingHitRate: tested > 0 ? hits / tested : null,
    }
  })
}

export function computeKDE(
  points: ReadonlyArray<{ x: number; y: number; weight: number }>,
  width: number,
  height: number,
  bandwidth: number
): Float32Array {
  const grid = new Float32Array(width * height)
  if (points.length === 0) return grid

  const bw2 = bandwidth * bandwidth * 2

  for (const pt of points) {
    if (pt.weight === 0) continue
    const xMin = Math.max(0, Math.floor(pt.x - bandwidth * 3))
    const xMax = Math.min(width - 1, Math.ceil(pt.x + bandwidth * 3))
    const yMin = Math.max(0, Math.floor(pt.y - bandwidth * 3))
    const yMax = Math.min(height - 1, Math.ceil(pt.y + bandwidth * 3))

    for (let py = yMin; py <= yMax; py++) {
      for (let px = xMin; px <= xMax; px++) {
        const dx = px - pt.x
        const dy = py - pt.y
        const k = Math.exp(-(dx * dx + dy * dy) / bw2) * pt.weight
        grid[py * width + px] += k
      }
    }
  }

  let maxVal = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxVal) maxVal = grid[i]
  }
  if (maxVal > 0) {
    for (let i = 0; i < grid.length; i++) {
      grid[i] /= maxVal
    }
  }

  return grid
}

export function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return [...points]

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)

  function cross(o: typeof sorted[0], a: typeof sorted[0], b: typeof sorted[0]) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  }

  const lower: typeof sorted = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: typeof sorted = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}
