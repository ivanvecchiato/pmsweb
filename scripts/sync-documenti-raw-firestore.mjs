#!/usr/bin/env node

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

const parseEnv = (filePath) => {
  const result = {}
  let text = ''

  try {
    text = readFileSync(filePath, 'utf8')
  } catch {
    return result
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const idx = trimmed.indexOf('=')
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

const hashString = (value) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const isResourceExhaustedError = (err) => {
  const message = String(err?.message || '').toLowerCase()
  return message.includes('resource_exhausted') || message.includes('resource exhausted')
}

const stableJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJson(v)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`
  }

  return JSON.stringify(value)
}

const buildDeterministicRawDocId = (documentItem, index) => {
  if (documentItem?.firestore_id) {
    return `raw_${String(documentItem.firestore_id)}`
  }

  const identity = {
    progressivo: documentItem?.progressivo ?? null,
    docType: documentItem?.docType ?? null,
    timestamp: documentItem?.timestamp ?? null,
    totale: documentItem?.totale ?? null,
    table: documentItem?.table?.name ?? documentItem?.table?.id ?? null,
    operator: documentItem?.operator ?? null,
    fallbackIndex: index
  }

  return `raw_${hashString(stableJson(identity))}`
}

const env = parseEnv(resolve(ROOT, '.env'))

const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
]

const missing = requiredVars.filter((k) => !env[k])
if (missing.length) {
  console.error(`Variabili mancanti in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const sourcePath = process.env.DOCUMENTI_JSON_PATH || '/Users/ivanvecchiato/work/node/mbar-server/database/collections/documenti.json'
const targetCollection = env.VITE_FIREBASE_RAW_DOCS_COLLECTION || 'documenti_raw'
const writeMode = process.argv.includes('--write')
const maxArg = process.argv.find((a) => a.startsWith('--max='))
const maxToWrite = maxArg ? Number(maxArg.slice('--max='.length)) : Number.POSITIVE_INFINITY

let docsRaw
try {
  docsRaw = JSON.parse(readFileSync(sourcePath, 'utf8'))
} catch (err) {
  console.error(`Impossibile leggere ${sourcePath}: ${err.message}`)
  process.exit(1)
}

const docs = Array.isArray(docsRaw) ? docsRaw : Object.values(docsRaw)
const cappedList = docs.slice(0, Math.max(0, Math.floor(maxToWrite)))

console.log(`Totale documenti sorgente: ${docs.length}`)
console.log(`Documenti da processare (cap): ${cappedList.length}`)
console.log(`Collection target: ${targetCollection}`)
console.log(`Modalita: ${writeMode ? 'WRITE' : 'DRY-RUN'}`)

if (!writeMode) {
  console.log('Dry-run completato. Esegui con --write per sincronizzare su Firestore.')
  process.exit(0)
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined
})

const db = getFirestore(app)

let synced = 0
let failed = 0

const writeWithRetry = async (rawId, payload, maxAttempts = 6) => {
  let attempt = 0

  while (attempt < maxAttempts) {
    attempt += 1
    try {
      await setDoc(doc(db, targetCollection, rawId), payload, { merge: true })
      return
    } catch (err) {
      if (!isResourceExhaustedError(err) || attempt >= maxAttempts) {
        throw err
      }

      const backoffMs = Math.min(2000, 100 * 2 ** (attempt - 1))
      await sleep(backoffMs)
    }
  }
}

for (const [index, documentItem] of cappedList.entries()) {
  const rawId = buildDeterministicRawDocId(documentItem, index)

  try {
    await writeWithRetry(rawId, {
      ...documentItem,
      rawReplicaId: rawId,
      rawSyncedAt: serverTimestamp(),
      rawSource: 'documenti.json'
    })

    synced += 1

    if ((index + 1) % 100 === 0) {
      console.log(`Progress: ${index + 1}/${cappedList.length}`)
    }

    if ((index + 1) % 250 === 0) {
      // Piccola pausa per non saturare lo stream di scrittura gRPC.
      await sleep(75)
    }
  } catch (err) {
    failed += 1
    console.error(`Errore su record #${index + 1} (${rawId}): ${err.message}`)
  }
}

console.log('Sync raw completato.')
console.log(`Sincronizzati: ${synced}`)
console.log(`Falliti: ${failed}`)
