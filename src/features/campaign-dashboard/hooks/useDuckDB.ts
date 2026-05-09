'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getDuckDB, runQuery } from '@/shared/lib/duckdb'
import type { Candidate, MetricField } from '@/shared/types'

export function useDuckDB(candidates: Candidate[], metricFields: MetricField[]) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [filteredIds, setFilteredIds] = useState<Set<string> | null>(null)
  const dbRef = useRef<import('@duckdb/duckdb-wasm').AsyncDuckDB | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      setIsReady(false)
      setError(null)
      setFilteredIds(null)

      try {
        const db = await getDuckDB()
        if (cancelled) return
        dbRef.current = db

        const conn = await db.connect()
        try {
          if (initializedRef.current) {
            await conn.query('DROP TABLE IF EXISTS candidates')
          }
          initializedRef.current = true

          const numericFields = metricFields.filter((f) => f.type === 'number')
          const metricColDefs = numericFields.map((f) => `"${f.key}" DOUBLE`).join(', ')
          const colDefs = `id TEXT, name TEXT, sequence_length INT${metricColDefs ? ', ' + metricColDefs : ''}`

          await conn.query(`CREATE TABLE candidates (${colDefs})`)

          if (candidates.length > 0) {
            const metricColNames = numericFields.map((f) => `"${f.key}"`).join(', ')
            const baseColNames = `id, name, sequence_length${metricColNames ? ', ' + metricColNames : ''}`

            const valueRows = candidates.map((c) => {
              const id = c.id.replace(/'/g, "''")
              const name = c.name.replace(/'/g, "''")
              const seqLen = c.sequence?.length ?? 0
              const metricVals = numericFields.map((f) => {
                const v = c.metrics[f.key]
                return typeof v === 'number' ? String(v) : 'NULL'
              })
              const allVals = [`'${id}'`, `'${name}'`, String(seqLen), ...metricVals]
              return `(${allVals.join(', ')})`
            })

            const chunkSize = 500
            for (let i = 0; i < valueRows.length; i += chunkSize) {
              const chunk = valueRows.slice(i, i + chunkSize)
              await conn.query(`INSERT INTO candidates (${baseColNames}) VALUES ${chunk.join(', ')}`)
            }
          }
        } finally {
          await conn.close()
        }

        if (!cancelled) setIsReady(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [candidates, metricFields])

  const applyFilter = useCallback(
    async (whereClause: string): Promise<string | null> => {
      if (!dbRef.current) return null

      if (!whereClause.trim()) {
        setFilteredIds(null)
        return null
      }

      try {
        const rows = await runQuery(
          dbRef.current,
          `SELECT id FROM candidates WHERE ${whereClause}`
        )
        const ids = new Set(rows.map((r) => String(r['id'])))
        setFilteredIds(ids)
        return null
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(err instanceof Error ? err : new Error(msg))
        return msg
      }
    },
    []
  )

  return { isReady, error, filteredIds, applyFilter }
}
