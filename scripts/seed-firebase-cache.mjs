#!/usr/bin/env node
/**
 * seed-firebase-cache.mjs
 *
 * Chiama tutti gli endpoint GET del server locale (mbar-server su :8088)
 * e scrive le risposte in Firestore nella collection api_cache,
 * usando gli stessi document ID usati dal bridge apiTransport.js.
 *
 * Uso:
 *   npm run seed:firebase
 *
 * Prerequisiti:
 *   - mbar-server in esecuzione su http://localhost:8088 (o MBAR_API=http://...)
 *   - .env con le credenziali Firebase valorizzate
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Legge .env senza dipendenze esterne
// ---------------------------------------------------------------------------

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

const parseEnv = (filePath) => {
  let text
  try {
    text = readFileSync(filePath, 'utf8')
  } catch {
    return {}
  }
  const result = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

const env = parseEnv(resolve(ROOT, '.env'))

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]
const missing = required.filter((k) => !env[k])
if (missing.length) {
  console.error('Variabili .env mancanti:', missing.join(', '))
  process.exit(1)
}

const API_BASE = process.env.MBAR_API || 'http://localhost:8088'
const API_CACHE_COLLECTION = env.VITE_FIREBASE_API_COLLECTION || 'api_cache'

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
})

const db = getFirestore(app)

// ---------------------------------------------------------------------------
// Stessa logica di hashing di apiTransport.js
// ---------------------------------------------------------------------------

const hashString = (value) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const requestFingerprint = ({ method, endpoint, query, data }) =>
  JSON.stringify({
    method: String(method || 'get').toLowerCase(),
    endpoint,
    query,
    data: data || null,
  })

const buildDocId = ({ method, endpoint, query, data }) => {
  const key = requestFingerprint({ method, endpoint, query, data })
  return `${String(method).toLowerCase()}_${hashString(key)}`
}

const splitUrl = (path) => {
  const [endpoint, query = ''] = path.split('?')
  return { endpoint, query }
}

// ---------------------------------------------------------------------------
// Fetch locale + scrittura Firestore
// ---------------------------------------------------------------------------

const seedEndpoint = async (path) => {
  const { endpoint, query } = splitUrl(path)
  const docId = buildDocId({ method: 'get', endpoint, query, data: null })

  let response
  try {
    const res = await fetch(`${API_BASE}${path}`)
    if (!res.ok) {
      console.warn(`  ⚠  ${path} → HTTP ${res.status}, saltato`)
      return
    }
    response = await res.json()
  } catch (err) {
    console.warn(`  ⚠  ${path} → ${err.message}, saltato`)
    return
  }

  await setDoc(
    doc(db, API_CACHE_COLLECTION, docId),
    {
      method: 'get',
      endpoint,
      query,
      response,
      seededAt: serverTimestamp(),
    },
    { merge: false }
  )

  const display = Array.isArray(response)
    ? `array[${response.length}]`
    : typeof response === 'object' && response !== null
      ? `object{${Object.keys(response).join(',')}}`
      : String(response)
  console.log(`  ✓  ${path} → ${docId} (${display})`)
}

// ---------------------------------------------------------------------------
// Endpoint da seedare
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  // Prodotti e varianti bar
  '/api/products',
  '/api/variants',

  // PMS config
  '/api/configs',
  '/api/pms/getpmstype',
  '/api/pms/getconfigs',
  '/api/pms/getconfigs?section=hotel',
  '/api/pms/getrooms',
  '/api/pms/services',
  '/api/pms/onda/push-config',

  // Listini e timetable hotel
  '/api/pms/getrates',
  '/api/pms/getrates?type=hotel',
  '/api/pms/gettimetable',
  '/api/pms/gettimetable?type=hotel',

  // Listini e timetable beach
  '/api/pms/getrates?type=beach',
  '/api/pms/gettimetable?type=beach',
  '/api/pms/beach/getplan?mode=flat',
  '/api/pms/beach/getplan?mode=flat&includeReservations=true',

  // Inventario bar
  '/api/inventory',
  '/api/inventory/movements',
  '/api/inventory/stats',

  // Statistiche
  '/api/mbar/product_stats',
  '/api/mbar/product_stats/by_category',
  '/api/mbar/sales_by_day',
  '/api/mbar/sales_by_table',
  '/api/mbar/sales_by_area',
  '/api/mbar/operator_stats',
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`\nFirebase seed → collection: ${API_CACHE_COLLECTION}`)
console.log(`Server locale: ${API_BASE}\n`)

for (const path of ENDPOINTS) {
  await seedEndpoint(path)
}

console.log('\nSeed completato.')
process.exit(0)
