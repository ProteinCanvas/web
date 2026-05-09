let dbPromise: Promise<import('@duckdb/duckdb-wasm').AsyncDuckDB> | null = null

async function createDB(): Promise<import('@duckdb/duckdb-wasm').AsyncDuckDB> {
  const duckdb = await import('@duckdb/duckdb-wasm')
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  )

  const worker = new Worker(workerUrl)
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(workerUrl)
  return db
}

export function getDuckDB(): Promise<import('@duckdb/duckdb-wasm').AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = createDB().catch((err) => {
      dbPromise = null
      throw err
    })
  }
  return dbPromise
}

export async function runQuery(
  db: import('@duckdb/duckdb-wasm').AsyncDuckDB,
  sql: string
): Promise<Record<string, unknown>[]> {
  const conn = await db.connect()
  try {
    const result = await conn.query(sql)
    return result.toArray().map((row) => row.toJSON() as Record<string, unknown>)
  } finally {
    await conn.close()
  }
}
