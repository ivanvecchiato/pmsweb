import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const require = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180'
const app = initializeApp({ projectId: 'demo-pmsweb-fiscal' }, 'fiscal-test')
const db = getFirestore(app)
const dir = mkdtempSync(path.join(tmpdir(), 'pms-fiscal-test-'))
const coreContext = vm.createContext({ createHash, FieldValue, structuredClone, console, Date })
const core = readFileSync(new URL('../server-integration/reservationSync.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/^export .*\n/gm, '')
vm.runInContext(core + '\nglobalThis.commit = commitHotelReservation; globalThis.version = getHotelReservationVersion', coreContext)
const coreDb = { collection: db.collection.bind(db), runTransaction: callback => db.runTransaction(async transaction => await callback(transaction)) }
const commitHotelReservation = (firedb, operation) => coreContext.commit(coreDb, operation)
const getHotelReservationVersion = (firedb, id, transaction) => coreContext.version(coreDb, id, transaction)

let online = false
let uncertain = false
let failedCommit = false
let simulateCommitFailure = false
let concurrentEdit = false
let sends = 0
const documents = []
const deadline = setTimeout(() => { console.error('Timeout coda fiscale'); process.exit(1) }, 30000)
deadline.unref()
const context = vm.createContext({
  fs, path, FieldValue, hotelCloudSyncEnabled: true, databaseRoot: dir, console, Date, setInterval, clearInterval,
  getFireDb: () => ({ collection: db.collection.bind(db), runTransaction: callback => db.runTransaction(async transaction => callback(transaction)) }), configs: { getConfigs: () => ({ address: 'fiscal-printer-simulated' }) },
  printf: { getStatus: callback => callback(online ? { result: 'ok', data: { Service: { Request: { errorCode: 0, busy: 0 } } } } : { result: 'error' }) },
  db: { reservationDB: { findOne: async predicate => (await db.collection('pms_hotel_reservations').get()).docs.map(entry => entry.data()).find(predicate) }, hotelAccountDocumentDB: { findOne: async query => documents.find(item => item.fiscal_job_id === query.fiscal_job_id) || null } },
  log: { e: message => { if (!String(message).includes('commit failure simulated')) throw Error(message) } },
  getHotelReservationVersion,
  commitHotelReservation: async (...args) => {
    if (simulateCommitFailure && !failedCommit && args[1].type === 'fiscal') { failedCommit = true; throw Error('commit failure simulated') }
    return commitHotelReservation(...args)
  },
  repo: { printHotelDepositFiscal: async (data, jobId) => {
    sends++
    if (uncertain) return { success: false, error: 'Esito non confermato' }
    if (concurrentEdit) {
      const current = (await db.runTransaction(async transaction => await getHotelReservationVersion(db, data.reservationId, transaction))).current
      await commitHotelReservation(db, { documentId: data.reservationId, type: 'set', baseRevision: current.revision, payload: { ...current, notes: ['modifica durante la stampa'] } })
    }
    const document = { id: `document-${jobId}`, fiscal_job_id: jobId, progressivo: sends, chiusura: 1, timestamp: Date.now() }
    documents.push(document)
    return { success: true, documentId: document.id, ...document }
  } }
})
const source = readFileSync(new URL('../server-integration/hotelFiscalJobs.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/^export .*\n/gm, '')
vm.runInContext(source + '\nglobalThis.processJobs = processHotelFiscalJobs', context)
const seed = async (id, day) => {
  await commitHotelReservation(db, { documentId: id, type: 'set', baseRevision: 0, validateInventory: true, payload: { id, roomId: '101', room: '101', roomType: 'Doppia', checkin: `2026-10-${day}`, checkout: `2026-10-${day + 1}`, notes: [], status: 0, deposits: [{ id: 'deposit', amount: 100, payment_date: '2026-10-20', payment_method_id: 1, payment_mode: 'Bonifico', fiscal_status: 'pending', annulled: false }] } })
}
try {
  for (const name of ['pms_hotel_reservations', 'pms_hotel_reservation_versions', 'pms_hotel_reservation_history', 'pms_hotel_reservation_tombstones', 'pms_hotel_reservation_conflicts', 'pms_room_inventory', 'pms_fiscal_jobs']) await db.recursiveDelete(db.collection(name))
  console.log('Fiscale: preparazione')
  await seed('first', 21)
  console.log('Fiscale: stampante non disponibile')
  await context.processJobs()
  assert.equal(sends, 0)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('first_deposit').get()).data().status, 'pending')
  online = true
  console.log('Fiscale: stampante disponibile')
  await context.processJobs()
  assert.equal(sends, 1)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('first_deposit').get()).data().status, 'completed')
  assert.equal((await db.collection('pms_hotel_reservations').doc('first').collection('deposits').doc('deposit').get()).data().fiscal_status, 'issued')
  await context.processJobs()
  assert.equal(sends, 1)
  console.log('Fiscale: stampante assente, disponibilità locale, emissione una sola volta')

  await seed('uncertain', 23)
  uncertain = true
  await context.processJobs()
  assert.equal(sends, 2)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('uncertain_deposit').get()).data().status, 'uncertain')
  await context.processJobs()
  assert.equal(sends, 2)
  uncertain = false
  await seed('interrupted', 25)
  await db.collection('pms_fiscal_jobs').doc('interrupted_deposit').update({ status: 'processing' })
  await context.processJobs()
  assert.equal(sends, 2)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('interrupted_deposit').get()).data().status, 'uncertain')
  console.log('Fiscale: esiti incerti e processo interrotto senza ristampa automatica')

  await seed('commit-retry', 27)
  simulateCommitFailure = true
  await context.processJobs()
  assert(failedCommit)
  assert.equal(sends, 3)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('commit-retry_deposit').get()).data().status, 'processing')
  await context.processJobs()
  assert.equal(sends, 3)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('commit-retry_deposit').get()).data().status, 'completed')
  simulateCommitFailure = false
  await seed('concurrent', 29)
  concurrentEdit = true
  await context.processJobs()
  const current = (await db.collection('pms_hotel_reservations').doc('concurrent').get()).data()
  assert.equal(current.revision, 3)
  assert.deepEqual(current.notes, ['modifica durante la stampa'])
  assert.equal((await db.collection('pms_hotel_reservations').doc('concurrent').collection('deposits').doc('deposit').get()).data().fiscal_status, 'issued')
  console.log('OK: coda fiscale differita, esiti incerti, recupero da documento locale senza duplicare stampa e aggiornamenti concorrenti preservati; stampante simulata')
} finally {
  await deleteApp(app)
  rmSync(dir, { recursive: true, force: true })
  clearTimeout(deadline)
}
