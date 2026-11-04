import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'

const server = fs.realpathSync(process.argv[2] || process.env.MBAR_SERVER_ROOT || new URL('../../../node/mbar-server', import.meta.url))
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-cloud-test-'))
process.env.MBAR_DATA_ROOT = directory
globalThis.analyticsCloudWrites = new Map()
registerHooks({ load(url, context, nextLoad) {
  if (url === pathToFileURL(path.join(server, 'modules/firestoreOutbox.js')).href) return {
    format: 'module', shortCircuit: true, source: `
      export const enqueueSet = async (collection, id, payload) => globalThis.analyticsCloudWrites.set(collection + '/' + id, structuredClone(payload));
      export const enqueueDelete = async (collection, id) => globalThis.analyticsCloudWrites.delete(collection + '/' + id);`
  }
  if (url === pathToFileURL(path.join(server, 'pms/modules/hotelCloudSync.js')).href) return {
    format: 'module', shortCircuit: true, source: 'export const hotelCloudSyncEnabled = true;'
  }
  return nextLoad(url, context)
} })
try {
  const analytics = await import(pathToFileURL(path.join(server, 'olap/analytics.js')))
  const item = { operator: 1, agent: 1, chiusura: 123, insert_id: 'stable-order', insertTime: Date.parse('2026-10-31T12:00:00Z'), quantity: 2, price: 5, tableName: 'Test', product: { name: 'Test', category_name: 'Test', price: 5 } }
  await analytics.updateAnalyticsDb([structuredClone(item)])
  assert.equal(globalThis.analyticsCloudWrites.get('order_facts/stable-order').price, 5)
  await analytics.updateAnalyticsDb([{ ...structuredClone(item), quantity: 3 }])
  assert.equal(globalThis.analyticsCloudWrites.size, 1)
  assert.equal(globalThis.analyticsCloudWrites.get('order_facts/stable-order').quantity, 3)
  assert.deepEqual(globalThis.analyticsCloudWrites.get('order_facts/stable-order'), analytics.getOrderFacts(['stable-order'])[0])
  await analytics.rebuildAnalyticsFacts([{ ...structuredClone(item), insert_id: 'replacement' }], 123)
  assert.equal(globalThis.analyticsCloudWrites.has('order_facts/stable-order'), false)
  assert.equal(globalThis.analyticsCloudWrites.get('order_facts/replacement').price, 5)
  await analytics.updateAnalyticsDb([], ['replacement'])
  assert.equal(globalThis.analyticsCloudWrites.size, 0)
  assert.equal(analytics.getOrderFacts().length, 0)
  const originalError = console.error
  console.error = () => {}
  try { await assert.rejects(() => analytics.updateAnalyticsDb([{ ...item, insert_id: undefined }]), /Identificativo riga ordine/) }
  finally { console.error = originalError }
  assert.equal(analytics.getOrderFacts().length, 0)
  console.log('OK: ID stabile, aggiornamento, ricostruzione e cancellazione; rifiuto dei nuovi fatti senza ID; nessuna connessione esterna')
} finally {
  fs.rmSync(directory, { recursive: true, force: true })
  delete globalThis.analyticsCloudWrites
}
