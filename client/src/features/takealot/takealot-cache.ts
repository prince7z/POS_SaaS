export interface TakealotCacheEntry<T> {
  value: T
  savedAt: number
}

const databaseName = 'pos-takealot-dashboard'
const storeName = 'responses'
export const TAKEALOT_CACHE_TTL = 60 * 60 * 1000 // 1hr

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is unavailable.'))
  if (databasePromise) return databasePromise

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the dashboard cache.'))
    request.onblocked = () => reject(new Error('The dashboard cache is blocked by another tab.'))
  })
  databasePromise = opening.catch((error: unknown) => {
    databasePromise = undefined
    throw error
  })

  return databasePromise
}

export async function readTakealotCache<T>(key: string): Promise<TakealotCacheEntry<T> | null> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(key)
    request.onsuccess = () => {
      const entry = request.result as { key?: unknown; value?: unknown; savedAt?: unknown } | undefined
      if (!entry) {
        resolve(null)
      } else if (entry.key === key && typeof entry.savedAt === 'number' && 'value' in entry) {
        resolve({ value: entry.value as T, savedAt: entry.savedAt })
      } else {
        console.warn('Ignoring a malformed Takealot dashboard cache entry.')
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Could not read the dashboard cache.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Dashboard cache read was aborted.'))
  })
}

export async function writeTakealotCache<T>(key: string, value: T, savedAt = Date.now()): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put({ key, value, savedAt })
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not write the dashboard cache.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Dashboard cache write was aborted.'))
  })
}
