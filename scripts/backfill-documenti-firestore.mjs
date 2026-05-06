#!/usr/bin/env node

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { collection, deleteDoc, doc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from 'firebase/firestore'

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
const targetCollection = env.VITE_FIREBASE_STATS_DOCS_COLLECTION || 'order_facts'
const writeMode = process.argv.includes('--write')
const cleanupLegacy = process.argv.includes('--cleanup-legacy')
const maxArg = process.argv.find((a) => a.startsWith('--max='))
const maxToWrite = maxArg ? Number(maxArg.slice('--max='.length)) : Number.POSITIVE_INFINITY

const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const hashString = (value) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const factDocId = ({ documentItem, row, rowIndex }) => {
  const stableKey = JSON.stringify({
    progressivo: documentItem?.progressivo ?? null,
    docType: documentItem?.docType ?? null,
    timestamp: documentItem?.timestamp ?? null,
    insert_id: row?.insert_id ?? null,
    insertTime: row?.insertTime ?? null,
    productId: row?.product?.id ?? null,
    rowIndex
  })
  return `bf_${hashString(stableKey)}`
}

const mapDocumentToFacts = (documentItem) => {
  const orderRows = Array.isArray(documentItem?.table?.conto?.order)
    ? documentItem.table.conto.order
    : []

  return orderRows.map((row, rowIndex) => {
    const quantity = toNumber(row?.quantity, 1)
    const unitPrice = toNumber(row?.product?.price, 0)
    const timestamp = toNumber(row?.insertTime, toNumber(documentItem?.timestamp, Date.now()))

    return {
      id: factDocId({ documentItem, row, rowIndex }),
      payload: {
        timestamp,
        quantity,
        price: unitPrice,
        operator: row?.operator ?? documentItem?.operator ?? null,
        agent: documentItem?.agent ?? null,
        productId: row?.product?.id ?? null,
        productName: String(row?.product?.name || 'Prodotto'),
        category: String(row?.product?.category || 'Altro'),
        tableName: String(documentItem?.table?.name || 'BANCO'),
        docType: documentItem?.docType ?? null,
        progressivo: documentItem?.progressivo ?? null,
        closeTab: documentItem?.closeTab ?? null,
        backfillSource: 'documenti-order-facts',
        backfillAt: serverTimestamp()
      }
    }
  })
}

let docsRaw
try {
  docsRaw = JSON.parse(readFileSync(sourcePath, 'utf8'))
} catch (err) {
  console.error(`Impossibile leggere ${sourcePath}: ${err.message}`)
  process.exit(1)
}

const docs = Array.isArray(docsRaw) ? docsRaw : Object.values(docsRaw)
const missingFirestoreId = docs.filter((docItem) => !docItem?.firestore_id)
const missingLimited = missingFirestoreId.slice(0, Math.max(0, Math.floor(maxToWrite)))
const factsToUpsert = missingLimited.flatMap((documentItem) => mapDocumentToFacts(documentItem))

console.log(`Totale documenti: ${docs.length}`)
console.log(`Senza firestore_id: ${missingFirestoreId.length}`)
console.log(`Documenti processati (cap): ${missingLimited.length}`)
console.log(`Fact rows da upsert: ${factsToUpsert.length}`)
console.log(`Collection target: ${targetCollection}`)
console.log(`Modalita: ${writeMode ? 'WRITE' : 'DRY-RUN'}`)
console.log(`Cleanup legacy: ${cleanupLegacy ? 'ON' : 'OFF'}`)

if (!writeMode) {
  console.log('Dry-run completato. Esegui con --write per avviare il backfill reale.')
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

let migrated = 0
let failed = 0
let cleaned = 0

if (cleanupLegacy) {
  const legacySnapshot = await getDocs(
    query(collection(db, targetCollection), where('backfillSource', '==', 'documenti.json'))
  )

  for (const legacyDoc of legacySnapshot.docs) {
    await deleteDoc(doc(db, targetCollection, legacyDoc.id))
    cleaned += 1
  }

  console.log(`Record legacy rimossi: ${cleaned}`)
}

for (const [index, fact] of factsToUpsert.entries()) {
  try {
    await setDoc(doc(db, targetCollection, fact.id), fact.payload, { merge: true })
    migrated += 1

    if ((index + 1) % 50 === 0) {
      console.log(`Progress: ${index + 1}/${factsToUpsert.length}`)
    }
  } catch (err) {
    failed += 1
    console.error(`Errore su fact #${index + 1}: ${err.message}`)
  }
}

console.log('Backfill completato.')
console.log(`Migrati: ${migrated}`)
console.log(`Falliti: ${failed}`)
