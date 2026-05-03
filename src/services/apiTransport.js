import axios from 'axios'
import { addDoc, collection, doc, getDoc, getDocs, query as buildFsQuery, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { getFirebaseDb, isFirebaseRemoteMode } from './firebaseClient'

const API_CACHE_COLLECTION = import.meta.env.VITE_FIREBASE_API_COLLECTION || 'api_cache'
const API_MUTATIONS_COLLECTION = import.meta.env.VITE_FIREBASE_MUTATIONS_COLLECTION || 'api_mutations'
const STATS_API_BASE_URL = String(import.meta.env.VITE_STATS_API_BASE_URL || '').trim().replace(/\/+$/, '')
const PMS_API_BASE_URL = String(import.meta.env.VITE_PMS_API_BASE_URL || '').trim().replace(/\/+$/, '')
const STATS_BYPASS_BASE_URL = STATS_API_BASE_URL || PMS_API_BASE_URL
const FIREBASE_STATS_DOCS_COLLECTION = import.meta.env.VITE_FIREBASE_STATS_DOCS_COLLECTION || 'order_facts'
const FIREBASE_STATS_DEVICES_COLLECTION = import.meta.env.VITE_FIREBASE_STATS_DEVICES_COLLECTION || 'devices'
const FIREBASE_STATS_OPERATORS_COLLECTION = import.meta.env.VITE_FIREBASE_STATS_OPERATORS_COLLECTION || 'operatori'
const BRIDGE_BYPASS_PREFIXES = String(import.meta.env.VITE_FIREBASE_BRIDGE_BYPASS_PREFIXES || '/api/mbar/')
  .split(',')
  .map((prefix) => prefix.trim())
  .filter((prefix) => prefix.startsWith('/'))

const normalizePath = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return ''

  if (urlString.startsWith('/')) return urlString

  try {
    const url = new URL(urlString)
    return `${url.pathname}${url.search}`
  } catch {
    return urlString
  }
}

const splitEndpointAndQuery = (rawUrl) => {
  const normalized = normalizePath(rawUrl)
  const [endpoint, query = ''] = normalized.split('?')
  return {
    endpoint,
    query
  }
}

const dateFromMs = (ms) => {
  const date = new Date(ms)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const lower = (value) => String(value || '').toLowerCase()

const parseDateRange = ({ from, to }) => {
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null
  return {
    fromMs: Number.isFinite(fromMs) ? fromMs : null,
    toMs: Number.isFinite(toMs) ? toMs : null
  }
}

const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const normalizeFactRow = (data) => {
  const insertTime = toNumber(data?.timestamp, Date.now())
  const quantity = toNumber(data?.quantity, 1)
  const unitPrice = toNumber(data?.price, 0)
  const sales = unitPrice * quantity

  return {
    insertTime,
    date: dateFromMs(insertTime),
    quantity,
    sales,
    operatorId: data?.operator ?? null,
    agentId: data?.agent ?? null,
    tableName: String(data?.tableName || 'BANCO').trim() || 'BANCO',
    productId: data?.productId ?? null,
    productName: String(data?.productName || 'Prodotto').trim() || 'Prodotto',
    category: String(data?.category || 'Altro').trim() || 'Altro'
  }
}

const readCollectionMap = async (db, name, keyCandidates, valueCandidates) => {
  const snapshot = await getDocs(collection(db, name))
  const map = new Map()

  snapshot.forEach((entry) => {
    const data = entry.data() || {}
    const key = keyCandidates.map((candidate) => data[candidate]).find((value) => value !== undefined && value !== null)
    const value = valueCandidates.map((candidate) => data[candidate]).find((item) => item !== undefined && item !== null)
    if (key === undefined || key === null || value === undefined || value === null) return
    map.set(String(key), String(value))
  })

  return map
}

const getStatsRowsFromFirestore = async ({ from, to }) => {
  const db = getFirebaseDb()
  const docsRef = collection(db, FIREBASE_STATS_DOCS_COLLECTION)
  const { fromMs, toMs } = parseDateRange({ from, to })

  let snapshot
  try {
    const filters = []
    if (fromMs !== null) filters.push(where('timestamp', '>=', fromMs))
    if (toMs !== null) filters.push(where('timestamp', '<=', toMs))

    snapshot = filters.length ? await getDocs(buildFsQuery(docsRef, ...filters)) : await getDocs(docsRef)
  } catch {
    snapshot = await getDocs(docsRef)
  }

  const rows = []
  snapshot.forEach((entry) => {
    rows.push(normalizeFactRow(entry.data()))
  })

  return rows.filter((row) => {
    if (fromMs !== null && row.insertTime < fromMs) return false
    if (toMs !== null && row.insertTime > toMs) return false
    return true
  })
}

const buildStatsResponseFromFirestore = async ({ endpoint, params }) => {
  const from = params.from || ''
  const to = params.to || ''
  const rows = await getStatsRowsFromFirestore({ from, to })

  if (endpoint === '/api/mbar/sales_by_day') {
    const byDay = new Map()
    rows.forEach((row) => {
      byDay.set(row.date, (byDay.get(row.date) || 0) + row.sales)
    })

    const sales = Array.from(byDay.entries())
      .map(([date, salesValue]) => ({ date, sales: Math.round(salesValue * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { sales }
  }

  if (endpoint === '/api/mbar/sales_by_table') {
    const byTable = new Map()
    rows.forEach((row) => {
      if (!byTable.has(row.tableName)) {
        byTable.set(row.tableName, {
          table: row.tableName,
          ordersSet: new Set(),
          totalSales: 0
        })
      }

      const current = byTable.get(row.tableName)
      current.ordersSet.add(String(row.insertTime))
      current.totalSales += row.sales
    })

    const tables = Array.from(byTable.values())
      .map((entry) => ({
        table: entry.table,
        orders: entry.ordersSet.size,
        totalSales: Math.round(entry.totalSales * 100) / 100
      }))
      .sort((a, b) => b.totalSales - a.totalSales)

    return { tables }
  }

  if (endpoint === '/api/mbar/sales_by_area') {
    const db = getFirebaseDb()
    const deviceAreaMap = await readCollectionMap(
      db,
      FIREBASE_STATS_DEVICES_COLLECTION,
      ['id', 'deviceId'],
      ['area', 'name']
    )

    const areaTotals = new Map()
    rows.forEach((row) => {
      const area = deviceAreaMap.get(String(row.agentId)) || 'Altro'
      areaTotals.set(area, (areaTotals.get(area) || 0) + row.sales)
    })

    const areas = Array.from(areaTotals.entries())
      .map(([area, sales]) => ({ area, sales: Math.round(sales * 100) / 100 }))
      .sort((a, b) => b.sales - a.sales)

    return { areas }
  }

  if (endpoint === '/api/mbar/product_stats') {
    const queryTerm = lower(params.query || '')
    const grouped = new Map()

    rows.forEach((row) => {
      const key = String(row.productId ?? row.productName)
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: row.productId ?? key,
          name: row.productName,
          category: row.category,
          quantity: 0,
          sales: 0
        })
      }
      const current = grouped.get(key)
      current.quantity += row.quantity
      current.sales += row.sales
    })

    const allProducts = Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        quantity: Math.round(entry.quantity * 100) / 100,
        sales: Math.round(entry.sales * 100) / 100
      }))
      .sort((a, b) => b.sales - a.sales)

    const top20 = allProducts.slice(0, 20)
    const productSales = queryTerm
      ? allProducts.filter((entry) => lower(entry.name).includes(queryTerm))
      : []

    const byCategoryMap = new Map()
    allProducts.forEach((entry) => {
      const key = entry.category || 'Altro'
      if (!byCategoryMap.has(key)) {
        byCategoryMap.set(key, { category: key, quantity: 0, sales: 0 })
      }
      const current = byCategoryMap.get(key)
      current.quantity += entry.quantity
      current.sales += entry.sales
    })

    const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.sales - a.sales)
    const totalSales = Math.round(allProducts.reduce((acc, entry) => acc + entry.sales, 0) * 100) / 100
    const totalQuantity = Math.round(allProducts.reduce((acc, entry) => acc + entry.quantity, 0) * 100) / 100

    return {
      totalSales,
      totalQuantity,
      productSales,
      productSalesFirst: productSales[0] || null,
      top20,
      byCategory
    }
  }

  if (endpoint === '/api/mbar/product_stats/by_category') {
    const selectedCategory = lower(params.category || '')
    const grouped = new Map()

    rows
      .filter((row) => lower(row.category) === selectedCategory)
      .forEach((row) => {
        const key = String(row.productId ?? row.productName)
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: row.productId ?? key,
            name: row.productName,
            category: row.category,
            quantity: 0,
            sales: 0
          })
        }
        const current = grouped.get(key)
        current.quantity += row.quantity
        current.sales += row.sales
      })

    const products = Array.from(grouped.values()).sort((a, b) => b.sales - a.sales)
    return { products }
  }

  if (endpoint === '/api/mbar/product_stats/trend') {
    const selectedProductId = String(params.productId || '')
    const byDay = new Map()

    rows
      .filter((row) => String(row.productId) === selectedProductId)
      .forEach((row) => {
        if (!byDay.has(row.date)) {
          byDay.set(row.date, { date: row.date, quantity: 0, sales: 0 })
        }
        const current = byDay.get(row.date)
        current.quantity += row.quantity
        current.sales += row.sales
      })

    const trend = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
    return { trend }
  }

  if (endpoint === '/api/mbar/operator_stats') {
    const db = getFirebaseDb()
    const queryTerm = lower(params.query || '')
    const operatorNameMap = await readCollectionMap(
      db,
      FIREBASE_STATS_OPERATORS_COLLECTION,
      ['id', 'operatorId'],
      ['name', 'operator', 'description']
    )

    const grouped = new Map()
    rows.forEach((row) => {
      const operatorId = row.operatorId ?? '0'
      const operatorName = operatorNameMap.get(String(operatorId)) || `Operatore ${operatorId}`

      if (!grouped.has(String(operatorId))) {
        grouped.set(String(operatorId), {
          id: operatorId,
          name: operatorName,
          sales: 0
        })
      }
      grouped.get(String(operatorId)).sales += row.sales
    })

    const allOperators = Array.from(grouped.values()).sort((a, b) => b.sales - a.sales)
    const filtered = queryTerm ? allOperators.filter((entry) => lower(entry.name).includes(queryTerm)) : allOperators
    const top20 = filtered.slice(0, 20)
    const operatorSales = queryTerm ? filtered[0] || null : null
    const totalSales = Math.round(allOperators.reduce((acc, entry) => acc + entry.sales, 0) * 100) / 100

    return {
      totalSales,
      operatorSales,
      top20,
      byCategory: []
    }
  }

  return null
}

const parseMergedParams = ({ inlineQuery, params }) => {
  const merged = {}

  if (inlineQuery) {
    const usp = new URLSearchParams(inlineQuery)
    usp.forEach((value, key) => {
      merged[key] = value
    })
  }

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    merged[key] = String(value)
  })

  return merged
}

const readStatsFromFirestore = async ({ url, params }) => {
  const { endpoint, query: inlineQuery } = splitEndpointAndQuery(url)
  const mergedParams = parseMergedParams({ inlineQuery, params })
  return buildStatsResponseFromFirestore({ endpoint, params: mergedParams })
}

const shouldBypassFirebaseForEndpoint = (endpoint) => {
  if (!endpoint) return false
  return BRIDGE_BYPASS_PREFIXES.some((prefix) => endpoint.startsWith(prefix))
}

const buildRemoteStatsUrl = ({ url, params }) => {
  const { endpoint, query: inlineQuery } = splitEndpointAndQuery(url)
  const bypassed = shouldBypassFirebaseForEndpoint(endpoint)
  if (!bypassed) return { bypassed: false, url: null }

  if (!STATS_BYPASS_BASE_URL) {
    return { bypassed: true, url: null }
  }

  const query = queryStringFromParams(params) || inlineQuery
  return {
    bypassed: true,
    url: `${STATS_BYPASS_BASE_URL}${endpoint}${query ? `?${query}` : ''}`
  }
}

const normalizeParams = (params = {}) => {
  const result = {}
  Object.keys(params)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      const value = params[key]
      if (value === undefined || value === null || value === '') return
      result[key] = value
    })
  return result
}

const queryStringFromParams = (params = {}) => {
  const usp = new URLSearchParams()
  Object.entries(normalizeParams(params)).forEach(([key, value]) => {
    usp.append(key, String(value))
  })
  return usp.toString()
}

const requestFingerprint = ({ method, endpoint, query, data }) => {
  return JSON.stringify({
    method: String(method || 'get').toLowerCase(),
    endpoint,
    query,
    data: data || null
  })
}

const hashString = (value) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const getResponsePayload = (snapshotData, queryKey) => {
  if (!snapshotData) return null

  if (Object.prototype.hasOwnProperty.call(snapshotData, 'response')) {
    return snapshotData.response
  }

  if (Object.prototype.hasOwnProperty.call(snapshotData, 'data')) {
    return snapshotData.data
  }

  if (snapshotData.responses && typeof snapshotData.responses === 'object') {
    if (queryKey && Object.prototype.hasOwnProperty.call(snapshotData.responses, queryKey)) {
      return snapshotData.responses[queryKey]
    }

    if (Object.prototype.hasOwnProperty.call(snapshotData.responses, '__default')) {
      return snapshotData.responses.__default
    }
  }

  return snapshotData
}

const buildDocIds = ({ method, endpoint, query, data }) => {
  const requestKey = requestFingerprint({ method, endpoint, query, data })
  const endpointKey = requestFingerprint({ method, endpoint, query: '', data: null })

  return {
    requestDocId: `${String(method).toLowerCase()}_${hashString(requestKey)}`,
    endpointDocId: `${String(method).toLowerCase()}_${hashString(endpointKey)}`
  }
}

const parseAxiosData = (value) => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const readFromFirebaseCache = async ({ method, url, params, data }) => {
  const db = getFirebaseDb()
  const { endpoint, query: inlineQuery } = splitEndpointAndQuery(url)
  const query = queryStringFromParams(params) || inlineQuery
  const parsedData = parseAxiosData(data)
  const { requestDocId, endpointDocId } = buildDocIds({ method, endpoint, query, data: parsedData })

  const requestSnapshot = await getDoc(doc(db, API_CACHE_COLLECTION, requestDocId))
  if (requestSnapshot.exists()) {
    const response = getResponsePayload(requestSnapshot.data(), query)
    return { response, source: 'request' }
  }

  const endpointSnapshot = await getDoc(doc(db, API_CACHE_COLLECTION, endpointDocId))
  if (endpointSnapshot.exists()) {
    const response = getResponsePayload(endpointSnapshot.data(), query)
    return { response, source: 'endpoint' }
  }

  throw new Error(`Nessun dato Firebase per ${String(method).toUpperCase()} ${endpoint}${query ? `?${query}` : ''}`)
}

const queueMutation = async ({ method, url, params, data }) => {
  const db = getFirebaseDb()
  const { endpoint, query: inlineQuery } = splitEndpointAndQuery(url)
  const query = queryStringFromParams(params) || inlineQuery
  const payload = parseAxiosData(data)

  await addDoc(collection(db, API_MUTATIONS_COLLECTION), {
    method: String(method || 'post').toLowerCase(),
    endpoint,
    query,
    payload: payload || null,
    createdAt: serverTimestamp()
  })

  const { requestDocId } = buildDocIds({ method, endpoint, query, data: payload })

  await setDoc(
    doc(db, API_CACHE_COLLECTION, requestDocId),
    {
      method: String(method || 'post').toLowerCase(),
      endpoint,
      query,
      response: {
        success: true,
        queued: true,
        endpoint,
        method: String(method || 'post').toLowerCase()
      },
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  return {
    success: true,
    queued: true,
    endpoint
  }
}

const createAxiosLikeResponse = (data, status = 200, config = {}) => ({
  data,
  status,
  statusText: status >= 200 && status < 300 ? 'OK' : 'ERROR',
  headers: {},
  config,
  request: null
})

const createFetchLikeResponse = (payload, status = 200) => {
  const body = JSON.stringify(payload ?? null)

  if (typeof Response !== 'undefined') {
    return new Response(body, {
      status,
      headers: {
        'content-type': 'application/json'
      }
    })
  }

  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => body
  }
}

const isApiEndpoint = (url) => {
  const normalized = normalizePath(url)
  return normalized.startsWith('/api/')
}

export const installApiTransportBridge = async () => {
  if (!isFirebaseRemoteMode()) return

  const originalAxiosRequest = axios.request.bind(axios)
  const originalFetch = globalThis.fetch?.bind(globalThis)

  axios.request = async (config = {}) => {
    const method = (config.method || 'get').toLowerCase()
    const url = config.url || ''
    const bypass = buildRemoteStatsUrl({ url, params: config.params })

    if (bypass.url) {
      const passthroughConfig = {
        ...config,
        url: bypass.url
      }
      delete passthroughConfig.params
      return originalAxiosRequest(passthroughConfig)
    }

    if (bypass.bypassed) {
      if (method === 'get') {
        const firebaseStatsPayload = await readStatsFromFirestore({ url, params: config.params })
        if (firebaseStatsPayload) {
          return createAxiosLikeResponse(firebaseStatsPayload, 200, config)
        }
      }
      return originalAxiosRequest(config)
    }

    if (!isApiEndpoint(url)) {
      return originalAxiosRequest(config)
    }

    if (method === 'get') {
      const { response } = await readFromFirebaseCache({ method, url, params: config.params, data: config.data })
      return createAxiosLikeResponse(response, 200, config)
    }

    const mutationResponse = await queueMutation({ method, url, params: config.params, data: config.data })
    return createAxiosLikeResponse(mutationResponse, 200, config)
  }

  axios.get = (url, config = {}) => axios.request({ ...config, method: 'get', url })
  axios.delete = (url, config = {}) => axios.request({ ...config, method: 'delete', url })
  axios.post = (url, data, config = {}) => axios.request({ ...config, method: 'post', url, data })
  axios.put = (url, data, config = {}) => axios.request({ ...config, method: 'put', url, data })
  axios.patch = (url, data, config = {}) => axios.request({ ...config, method: 'patch', url, data })

  if (!originalFetch) return

  globalThis.fetch = async (input, init = undefined) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || ''
    const method = String(init?.method || 'get').toLowerCase()
    const bypass = buildRemoteStatsUrl({ url: rawUrl })

    if (bypass.url) {
      return originalFetch(bypass.url, init)
    }

    if (bypass.bypassed) {
      if (method === 'get') {
        const firebaseStatsPayload = await readStatsFromFirestore({ url: rawUrl })
        if (firebaseStatsPayload) {
          return createFetchLikeResponse(firebaseStatsPayload, 200)
        }
      }
      return originalFetch(input, init)
    }

    if (!isApiEndpoint(rawUrl)) {
      return originalFetch(input, init)
    }

    if (method === 'get') {
      const { response } = await readFromFirebaseCache({ method, url: rawUrl })
      return createFetchLikeResponse(response, 200)
    }

    let body = init?.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        // lascia body stringa se non JSON
      }
    }

    const mutationResponse = await queueMutation({ method, url: rawUrl, data: body })
    return createFetchLikeResponse(mutationResponse, 200)
  }
}
