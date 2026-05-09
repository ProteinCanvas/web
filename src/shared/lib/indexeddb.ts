import { openDB, type IDBPDatabase } from 'idb'
import type { Campaign, ShortlistEntry } from '@/shared/types'

interface ProteinCanvasDB {
  store: {
    campaigns: Campaign[]
    activeCampaignId: string | null
    shortlist: ShortlistEntry[]
  }
}

const DB_NAME = 'protein-canvas'
const DB_VERSION = 1
const STORE_KEY = 'state'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('store')
      },
    })
  }
  return dbPromise
}

export async function saveCampaignStore(
  state: ProteinCanvasDB['store']
): Promise<void> {
  const db = await getDB()
  await db.put('store', state, STORE_KEY)
}

export async function loadCampaignStore(): Promise<ProteinCanvasDB['store'] | null> {
  try {
    const db = await getDB()
    const val = await db.get('store', STORE_KEY)
    return val ?? null
  } catch {
    return null
  }
}

export async function clearCampaignStore(): Promise<void> {
  const db = await getDB()
  await db.delete('store', STORE_KEY)
}
