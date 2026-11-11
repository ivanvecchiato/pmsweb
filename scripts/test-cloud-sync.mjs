import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

// Solo una copia di codice e database temporanei; il server reale non viene avviato né modificato.
const root = fileURLToPath(new URL('../', import.meta.url))
const server = process.env.MBAR_SERVER_ROOT || path.resolve(root, '../../node/mbar-server')
const sandbox = mkdtempSync(path.join(tmpdir(), 'pms-cloud-sync-'))
const deadline = setTimeout(() => { console.error('Timeout collaudo sync'); process.exit(1) }, 60000)
deadline.unref()
if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180') throw Error('Il test richiede Firestore emulator 127.0.0.1:8180')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180'
process.env.MBAR_DATA_ROOT = path.join(sandbox, 'database')
process.env.MBAR_CONFIG_ROOT = path.join(sandbox, 'configs')
mkdirSync(path.join(sandbox, 'database/hotel'), { recursive: true })
mkdirSync(process.env.MBAR_CONFIG_ROOT, { recursive: true })
cpSync(path.join(server, 'configs/configs.json'), path.join(process.env.MBAR_CONFIG_ROOT, 'configs.json'))
writeFileSync(path.join(sandbox, 'database/hotel/cloud-sync.json'), JSON.stringify({ enabled: true, baselines: {}, diagnostics: {} }))
writeFileSync(path.join(sandbox, 'package.json'), '{"type":"module"}')
symlinkSync(path.join(server, 'node_modules'), path.join(sandbox, 'node_modules'))
for (const name of ['index.js', 'modules/firestoreOutbox.js', 'modules/firestore.js', 'modules/firebaseCredentials.js', 'modules/dbPaths.js', 'modules/log.js', 'modules/sse.js', 'hotel/modules/db.js', 'hotel/modules/events.js', 'pms/modules/firestore.js', 'beach/modules/db.js', 'beach/plan.js', 'beach/pricing.js']) {
  mkdirSync(path.dirname(path.join(sandbox, name)), { recursive: true })
  cpSync(path.join(server, name), path.join(sandbox, name))
}
cpSync(path.join(root, 'server-integration/firestoreOutbox.js'), path.join(sandbox, 'modules/firestoreOutbox.js'))
cpSync(path.join(server, 'modules/configs.js'), path.join(sandbox, 'modules/configs.js'))
mkdirSync(path.join(sandbox, 'pms/modules'), { recursive: true })
cpSync(path.join(root, 'server-integration/hotelCloudSync.js'), path.join(sandbox, 'pms/modules/hotelCloudSync.js'))
for (const name of ['reservationSync.js', 'hotel.js']) cpSync(path.join(root, 'server-integration', name), path.join(sandbox, 'pms/modules', name))
cpSync(path.join(server, 'pms/modules/hotelPricing.js'), path.join(sandbox, 'pms/modules/hotelPricing.js'))
cpSync(path.join(server, 'pms/utils.js'), path.join(sandbox, 'pms/utils.js'))
cpSync(path.join(root, 'src/generated/hotel/data'), path.join(sandbox, 'data'), { recursive: true })
writeFileSync(path.join(sandbox, 'pms/modules/hotelReservation.js'), readFileSync(path.join(root, 'src/services/hotelReservation.js'), 'utf8')
  .replace("'../generated/hotel/data/hotel/Reservation.js'", "'../../data/hotel/Reservation.js'")
  .replace("'../generated/hotel/hotelPricing.js'", "'./hotelPricing.js'"))

for (const name of ['index.js', 'modules/firestoreOutbox.js', 'pms/modules/hotelCloudSync.js']) {
  assert.equal(spawnSync(process.execPath, ['--check', path.join(sandbox, name)]).status, 0)
}
const require = createRequire(path.join(sandbox, 'package.json'))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const app = initializeApp({ projectId: 'demo-pmsweb-sync' })
const cloud = getFirestore(app)
for (const name of ['pms_hotel_reservations', 'pms_hotel_reservation_tombstones', 'pms_hotel_reservation_history', 'pms_hotel_reservation_versions', 'pms_hotel_reservation_conflicts', 'pms_hotel_rates', 'pms_hotel_timetable', 'pms_configs']) {
  await cloud.recursiveDelete(cloud.collection(name))
}
const { default: db } = await import(pathToFileURL(path.join(sandbox, 'hotel/modules/db.js')))
const { default: sse } = await import(pathToFileURL(path.join(sandbox, 'modules/sse.js')))
const { default: hotelEvents } = await import(pathToFileURL(path.join(sandbox, 'hotel/modules/events.js')))
const configs = (await import(pathToFileURL(path.join(sandbox, 'modules/configs.js')))).default
const sync = await import(pathToFileURL(path.join(sandbox, 'pms/modules/hotelCloudSync.js')))
const outbox = await import(pathToFileURL(path.join(sandbox, 'modules/firestoreOutbox.js')))
const shared = await import(pathToFileURL(path.join(sandbox, 'pms/modules/reservationSync.js')))
const bookings = cloud.collection('pms_hotel_reservations')
const cloudSave = async (id, payload, type = 'set') => {
  const [current, deleted] = await cloud.getAll(bookings.doc(id), cloud.collection('pms_hotel_reservation_tombstones').doc(id))
  const baseRevision = current.exists ? current.data().revision : deleted.exists ? deleted.data().revision : 0
  const result = await shared.commitHotelReservation(cloud, { documentId: id, type, payload, baseRevision, source: 'cloud', operator: 2 })
  assert.equal(result.status, 'committed')
  return result
}
const local = id => db.reservationDB.findOne(item => String(item.id) === id)
const periods = new Map()
const fixture = (id, notes = []) => {
  if (!periods.has(id)) periods.set(id, periods.size * 4)
  return ({ id, roomId: '101', room: '101', roomType: 'Doppia', checkin: new Date(Date.UTC(2026, 0, 1 + periods.get(id))).toISOString().slice(0, 10), checkout: new Date(Date.UTC(2026, 0, 4 + periods.get(id))).toISOString().slice(0, 10), status: 0, accountholder: { firstname: 'Test', lastname: id }, notes, deposits: [{ id: 'deposit', amount: 100, payment_mode: 'Bonifico', fiscal_status: 'pending' }] })
}
const until = async (predicate, message) => {
  const end = Date.now() + 10000
  while (Date.now() < end) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw Error(message)
}
const state = () => JSON.parse(readFileSync(path.join(process.env.MBAR_DATA_ROOT, 'hotel/cloud-sync.json'), 'utf8'))
const events = []
const syncErrors = []
const originalError = console.error
console.error = (...args) => {
  const message = args.join(' ')
  if (/firestore outbox|Hotel cloud sync listener/.test(message)) syncErrors.push(message)
  originalError(...args)
}
sse.newClient('cloud-sync-test', 'test', { write: chunk => events.push(JSON.parse(chunk.trim())) }, 'pms')
await db.roomDB.insertOne({ id: '101', room_code: '101', room_type: { label: 'Doppia' } })
await db.reservationDB.insertOne(fixture('matched'))
await db.reservationDB.insertOne(fixture('local-only'))
await db.reservationDB.insertOne(fixture('divergent', ['versione locale']))
await cloudSave('matched', fixture('matched'))
await cloudSave('cloud-only', fixture('cloud-only'))
await cloudSave('divergent', fixture('divergent', ['versione cloud']))
try {
  console.log('Sync: primo allineamento e conflitti')
  sync.startHotelCloudSync()
  await until(async () => (await local('cloud-only')) && (await bookings.doc('local-only').get()).exists, 'Primo allineamento non completato')
  await until(async () => !(await cloud.collection('pms_hotel_reservation_conflicts').doc('divergent').collection('proposals').get()).empty, 'Divergenza iniziale non segnalata')
  assert.deepEqual((await local('divergent')).notes, ['versione cloud'])
  assert.equal((await local('divergent')).revision, 1)
  const initialProposals = await cloud.collection('pms_hotel_reservation_conflicts').doc('divergent').collection('proposals').get()
  assert.equal(initialProposals.size, 1)
  assert.deepEqual(initialProposals.docs[0].data().snapshot.notes, ['versione locale'])
  assert.deepEqual((await bookings.doc('divergent').get()).data().notes, ['versione cloud'])
  assert(events.some(event => event.type === 'reservation_created'))

  console.log('Sync: registro e notifiche delle prenotazioni cloud, senza duplicati')
  const notificationBooking = fixture('notifications')
  const notificationsFor = id => events.filter(event => event.type === 'operational_notification' && event.data.reservation_id === id)
  await cloudSave(notificationBooking.id, notificationBooking)
  await until(() => notificationsFor(notificationBooking.id).length === 1, 'Notifica creazione cloud assente')
  assert.equal(notificationsFor(notificationBooking.id)[0].data.message, 'Creata prenotazione')
  assert.equal(notificationsFor(notificationBooking.id)[0].data.operator, 2)
  assert.equal(hotelEvents.getEvents({ reservation_id: notificationBooking.id }).events[0].type, 'reservation.created')
  const changedBooking = { ...notificationBooking, checkout: new Date(new Date(notificationBooking.checkout).getTime() + 86400000).toISOString().slice(0, 10), amount: 150, notes: ['modifica cloud'], deposits: [] }
  await cloudSave(notificationBooking.id, changedBooking)
  await until(() => notificationsFor(notificationBooking.id).length === 2, 'Notifica modifica cloud assente')
  assert.equal(notificationsFor(notificationBooking.id)[1].data.message, 'Prenotazione modificata: periodo, prezzo/sconto, depositi, dati ospite/soggiorno')
  assert.deepEqual(hotelEvents.getEvents({ reservation_id: notificationBooking.id }).events.map(event => event.type).sort(), [
    'reservation.created', 'reservation.deposits_changed', 'reservation.period_changed', 'reservation.price_changed', 'reservation.updated'
  ])
  const sameContent = await shared.commitHotelReservation(cloud, { documentId: notificationBooking.id, type: 'set', payload: changedBooking, baseRevision: 2, source: 'cloud', operator: 2 })
  await until(async () => (await local(notificationBooking.id)).revision === sameContent.revision, 'Revisione senza modifiche non ricevuta')
  assert.equal(notificationsFor(notificationBooking.id).length, 2)
  sync.stopHotelCloudSync()
  sync.startHotelCloudSync()
  await cloudSave(notificationBooking.id, { ...changedBooking, status: -100, cancellation_reason: 'Test annullamento' })
  await until(() => notificationsFor(notificationBooking.id).length === 3, 'Notifica annullamento cloud assente')
  assert.equal(notificationsFor(notificationBooking.id)[2].data.type, 'reservation.cancelled')
  await cloudSave(notificationBooking.id, null, 'delete')
  await until(() => notificationsFor(notificationBooking.id).length === 4, 'Notifica eliminazione cloud assente')
  assert.equal(notificationsFor(notificationBooking.id)[3].data.message, 'Eliminata prenotazione')
  const localNotificationBooking = fixture('notification-local')
  await db.reservationDB.insertOne(localNotificationBooking)
  hotelEvents.addLogEntry({ type: 'reservation.created', explanation: 'Creata prenotazione', source: 'client', operator: 2, reservation_id: localNotificationBooking.id })
  await outbox.enqueueSet('pms_hotel_reservations', localNotificationBooking.id, localNotificationBooking, true)
  await until(() => sync.getHotelSyncBase(localNotificationBooking.id), 'Conferma creazione locale assente')
  assert.equal(notificationsFor(localNotificationBooking.id).length, 1)
  assert.equal(hotelEvents.getEvents({ reservation_id: localNotificationBooking.id }).events.length, 1)

  console.log('Sync: piano camere realtime attraverso la coda persistente')
  await until(async () => (await cloud.collection('rooms').doc('101').get()).exists, 'Piano camere iniziale non pubblicato')
  await db.roomDB.updateOne({ id: '101' }, { description: 'Camera aggiornata' })
  await db.roomDB.save()
  await until(async () => (await cloud.collection('rooms').doc('101').get()).data()?.description === 'Camera aggiornata', 'Modifica camera non pubblicata')

  console.log('Sync: downlink realtime, annullamento, storico e nessun ciclo')
  await cloudSave('matched', { ...fixture('matched', ['modifica online']), status: -100, cancellation_reason: 'Test cloud' })
  await until(async () => (await local('matched')).status === -100, 'Annullamento cloud non ricevuto')
  assert.equal((await local('matched')).deposits[0].amount, 100)
  const history = { id: 'history-sync', reservation_id: 'matched', modified_timestamp: 1, snapshot: fixture('matched') }
  await cloud.collection('pms_hotel_reservation_history').doc(history.id).set(history)
  await until(async () => await db.reservationHistoryDB.findOne({ id: history.id }), 'Storico non ricevuto')
  assert(events.some(event => event.type === 'reservation_updated'))

  console.log('Sync: listini, calendario tariffe e policy in entrambe le direzioni')
  const rate = { id: 'rate-sync', description: 'Tariffa test', basePrice: 100, prices: [], surcharges: { hb: 0, fb: 0 } }
  await db.hotelPricesdb.insertOne(rate)
  await outbox.enqueueSet('pms_hotel_rates', rate.id, rate, false)
  await until(async () => (await cloud.collection('pms_hotel_rates').doc(rate.id).get()).data()?.basePrice === 100, 'Listino locale non pubblicato')
  await cloud.collection('pms_hotel_rates').doc(rate.id).set({ ...rate, basePrice: 120 })
  await until(async () => (await db.hotelPricesdb.findOne(item => String(item.id) === rate.id))?.basePrice === 120, 'Listino cloud non ricevuto')
  assert.equal(JSON.parse(readFileSync(path.join(process.env.MBAR_DATA_ROOT, 'firestore-outbox.json'))).some(item => item.collection === 'pms_hotel_rates' && item.documentId === rate.id), false)

  const calendar = { date: '2026-01-01', day: 1, pricelist: rate.id }
  await db.hotelTimeTableDB.insertOne(calendar)
  await outbox.enqueueSet('pms_hotel_timetable', calendar.date, calendar, false)
  await until(async () => (await cloud.collection('pms_hotel_timetable').doc(calendar.date).get()).data()?.pricelist === rate.id, 'Calendario locale non pubblicato')
  await cloud.collection('pms_hotel_timetable').doc(calendar.date).set({ ...calendar, pricelist: 'cloud-rate' })
  await until(async () => (await db.hotelTimeTableDB.findOne(item => item.date === calendar.date))?.pricelist === 'cloud-rate', 'Calendario cloud non ricevuto')

  const localHotel = configs.getConfigs('hotel')
  const localPricing = { ...localHotel.pricing, mode: 'room' }
  configs.writeConfigs('hotel', { ...localHotel, pricing: localPricing })
  await outbox.enqueueSet('pms_configs', 'current', configs.getConfigs(), false)
  await until(async () => (await cloud.collection('pms_configs').doc('current').get()).data()?.hotel?.pricing?.mode === 'room', 'Policy locale non pubblicata')
  const remotePricing = { ...localPricing, mode: 'person', extraBedDiscountPct: 15 }
  await cloud.collection('pms_configs').doc('current').set({ hotel: { pricing: remotePricing } }, { merge: true })
  await until(async () => configs.getConfigs('hotel').pricing.extraBedDiscountPct === 15, 'Policy cloud non ricevuta')
  assert.equal(configs.getConfigs('hotel').pricing.mode, 'person')
  assert(events.some(event => event.type === 'hotel_rates_updated'))
  assert(events.some(event => event.type === 'hotel_timetable_updated'))
  assert(events.some(event => event.type === 'hotel_pricing_policy_updated'))

  console.log('Sync: uplink e aggiornamenti locali ravvicinati')
  const updated = { ...(await local('local-only')), notes: ['modifica locale'] }
  await db.reservationDB.updateOne({ id: updated.id }, () => updated)
  await outbox.enqueueSet('pms_hotel_reservations', updated.id, updated, true)
  await until(async () => (await bookings.doc(updated.id).get()).data().notes[0] === 'modifica locale', 'Upload non completato')
  await until(() => !JSON.parse(readFileSync(path.join(process.env.MBAR_DATA_ROOT, 'firestore-outbox.json'))).some(item => item.documentId === updated.id), 'Outbox non svuotata')
  const originalTransaction = cloud.runTransaction.bind(cloud)
  let committed
  let release
  const commit = new Promise(resolve => { committed = resolve })
  const gate = new Promise(resolve => { release = resolve })
  let held = false
  cloud.runTransaction = async (...args) => {
    const result = await originalTransaction(...args)
    if (!held) { held = true; committed(); await gate }
    return result
  }
  const first = { ...(await local('local-only')), notes: ['prima modifica'] }
  await db.reservationDB.updateOne({ id: first.id }, () => first)
  await outbox.enqueueSet('pms_hotel_reservations', first.id, first, true)
  await commit
  const second = { ...(await local('local-only')), notes: ['seconda modifica'] }
  await db.reservationDB.updateOne({ id: second.id }, () => second)
  await outbox.enqueueSet('pms_hotel_reservations', second.id, second, true)
  release()
  await until(async () => (await bookings.doc(second.id).get()).data().notes[0] === 'seconda modifica', 'Modifica ravvicinata persa')
  await until(async () => (await local(second.id)).revision === (await bookings.doc(second.id).get()).data().revision, 'Revisione locale non confermata dopo salvataggi ravvicinati')
  cloud.runTransaction = originalTransaction

  console.log('Sync: recupero alla riconnessione e assenza duplicati')
  sync.stopHotelCloudSync()
  await cloudSave('cloud-only', fixture('cloud-only', ['mentre server spento']))
  await db.reservationDB.updateOne({ id: 'local-only' }, item => ({ ...item, notes: ['persistita offline'] }))
  sync.startHotelCloudSync()
  await until(async () => (await local('cloud-only')).notes[0] === 'mentre server spento', 'Download alla riconnessione assente')
  await until(async () => (await bookings.doc('local-only').get()).data().notes[0] === 'persistita offline', 'Upload persistito offline assente')
  await until(async () => sync.getHotelSyncBase('local-only').revision === (await bookings.doc('local-only').get()).data().revision, 'Checkpoint offline non ancora confermato')
  assert.equal((await db.reservationDB.findMany({ id: 'cloud-only' })).length, 1)
  assert.equal((await db.reservationHistoryDB.findMany({ id: history.id })).length, 1)

  console.log('Sync: scritture concorrenti preservate e coda non bloccata')
  sync.stopHotelCloudSync()
  const baseRevision = sync.getHotelSyncBase('local-only').revision
  const conflicting = fixture('local-only', ['concorrente locale'])
  await db.reservationDB.updateOne({ id: conflicting.id }, () => conflicting)
  await cloudSave('local-only', fixture('local-only', ['concorrente cloud']))
  const rejected = await sync.publishHotelReservation({ documentId: 'local-only', type: 'set', payload: conflicting, baseRevision })
  assert.equal(rejected.status, 'conflict')
  assert.equal(rejected.revision, baseRevision + 1)
  const proposal = await cloud.collection('pms_hotel_reservation_conflicts').doc('local-only').collection('proposals').doc(rejected.proposalId).get()
  assert.deepEqual(proposal.data().snapshot.notes, ['concorrente locale'])
  assert.equal(proposal.data().status, 'pending')
  await outbox.enqueueSet('sync_test_other', 'unrelated', { value: 1 }, true)
  await until(async () => (await cloud.collection('sync_test_other').doc('unrelated').get()).exists, 'Un conflitto blocca la coda degli altri documenti')
  assert.deepEqual((await local('local-only')).notes, ['concorrente cloud'])
  assert.equal((await local('local-only')).revision, baseRevision + 1)
  assert.deepEqual((await bookings.doc('local-only').get()).data().notes, ['concorrente cloud'])
  assert.equal((await proposal.ref.get()).data().status, 'pending')

  console.log('Sync: cancellazione persistente e protezione piano camere')
  await db.reservationDB.deleteOne({ id: 'cloud-only' })
  await outbox.enqueueDelete('pms_hotel_reservations', 'cloud-only', sync.getHotelSyncBase('cloud-only').revision)
  await until(async () => (await cloud.collection('pms_hotel_reservation_tombstones').doc('cloud-only').get()).exists, 'Tombstone cancellazione assente')
  await cloudSave('bad-room', { ...fixture('bad-room'), roomId: '999', room: '999' })
  await cloudSave('matched', null, 'delete')
  sync.startHotelCloudSync()
  await until(async () => !(await local('matched')), 'Cancellazione offline cloud non recuperata')
  await until(() => state().diagnostics['bad-room'], 'Camera incompatibile non segnalata')
  assert.equal(await local('bad-room'), null)
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(await local('cloud-only'), null)
  assert.equal((await bookings.doc('cloud-only').get()).exists, false)

  console.log('Sync: documento invalido isolato senza fermare gli altri download')
  await bookings.doc('invalid-id').set({ ...fixture('invalid-id'), id: 'different-id' })
  await cloudSave('after-invalid', fixture('after-invalid'))
  await until(() => state().diagnostics['invalid-id'], 'Documento invalido non segnalato')
  await until(async () => await local('after-invalid'), 'Un documento invalido blocca gli altri download')
  assert.equal(await local('invalid-id'), null)
  await cloud.collection('pms_hotel_reservation_history').doc(history.id).set({ ...history, modified_timestamp: 2 })
  await until(() => state().diagnostics[`history/${history.id}`], 'Storico divergente non segnalato')
  assert.equal((await db.reservationHistoryDB.findOne({ id: history.id })).modified_timestamp, 1)

  console.log('Sync: una sola revisione definitiva fra due salvataggi concorrenti')
  await cloudSave('revision-race', fixture('revision-race'))
  await until(async () => (await local('revision-race'))?.revision === 1, 'Revisione iniziale non ricevuta')
  const concurrent = await Promise.all([
    shared.commitHotelReservation(cloud, { documentId: 'revision-race', type: 'set', payload: { ...fixture('revision-race', ['proposta A']), datetime_timestamp: 9999999999999 }, baseRevision: 1, source: 'cloud', operator: 2 }),
    shared.commitHotelReservation(cloud, { documentId: 'revision-race', type: 'set', payload: { ...fixture('revision-race', ['proposta B']), datetime_timestamp: 1 }, baseRevision: 1, source: 'cloud', operator: 3 })
  ])
  assert.equal(concurrent.filter(result => result.status === 'committed').length, 1)
  assert.equal(concurrent.filter(result => result.status === 'conflict').length, 1)
  const winner = concurrent.find(result => result.status === 'committed')
  const loser = concurrent.find(result => result.status === 'conflict')
  assert.equal(winner.revision, 2)
  assert.equal(loser.revision, 2)
  await until(async () => (await local('revision-race'))?.revision === 2, 'Versione definitiva non ricevuta')
  assert.deepEqual((await local('revision-race')).notes, winner.current.notes)
  const proposalRef = cloud.collection('pms_hotel_reservation_conflicts').doc('revision-race').collection('proposals').doc(loser.proposalId)
  const pending = (await proposalRef.get()).data()
  assert.equal(pending.status, 'pending')
  assert.notDeepEqual(pending.snapshot.notes, winner.current.notes)

  console.log('Sync: risoluzione esplicita, revisione corrente e storico immutabile')
  const staleResolution = await sync.resolveHotelReservationConflict({ id: 'revision-race', proposalId: loser.proposalId, expectedRevision: 1, choice: 'proposal', operator: 2 })
  assert.equal(staleResolution.status, 'conflict')
  assert.equal((await bookings.doc('revision-race').get()).data().revision, 2)
  assert.equal((await proposalRef.get()).data().status, 'pending')
  await assert.rejects(sync.resolveHotelReservationConflict({ id: 'revision-race', proposalId: loser.proposalId, expectedRevision: 2, choice: 'proposal' }), /operatore obbligatori/)
  const resolution = await sync.resolveHotelReservationConflict({ id: 'revision-race', proposalId: loser.proposalId, expectedRevision: 2, choice: 'proposal', operator: 2 })
  assert.equal(resolution.status, 'committed')
  assert.equal(resolution.revision, 3)
  assert.deepEqual((await local('revision-race')).notes, pending.snapshot.notes)
  assert.equal((await local('revision-race')).revision, 3)
  assert.equal((await proposalRef.get()).data().resolution_revision, 3)
  assert.equal((await proposalRef.get()).data().resolved_by, 2)
  const replay = await sync.resolveHotelReservationConflict({ id: 'revision-race', proposalId: loser.proposalId, expectedRevision: 2, choice: 'proposal', operator: 2 })
  assert.equal(replay.status, 'already_committed')
  await assert.rejects(sync.resolveHotelReservationConflict({ id: 'revision-race', proposalId: loser.proposalId, expectedRevision: 3, choice: 'current', operator: 2 }), /decisione diversa/)
  assert.equal((await bookings.doc('revision-race').get()).data().revision, 3)
  const acceptedVersions = await cloud.collection('pms_hotel_reservation_versions').doc('revision-race').collection('revisions').get()
  assert.deepEqual(acceptedVersions.docs.map(entry => entry.id), ['1', '2', '3'])
  assert.deepEqual(acceptedVersions.docs[1].data().snapshot.notes, winner.current.notes)
  assert.deepEqual(acceptedVersions.docs[2].data().snapshot.notes, pending.snapshot.notes)
  assert.deepEqual((await proposalRef.get()).data().snapshot, pending.snapshot)

  const discarded = await shared.commitHotelReservation(cloud, { documentId: 'revision-race', type: 'set', payload: fixture('revision-race', ['da scartare']), baseRevision: 2, operator: 3 })
  assert.equal(discarded.status, 'conflict')
  const kept = await sync.resolveHotelReservationConflict({ id: 'revision-race', proposalId: discarded.proposalId, expectedRevision: 3, choice: 'current', operator: 2 })
  assert.equal(kept.revision, 4)
  assert.deepEqual(kept.current.notes, pending.snapshot.notes)
  const oldRetry = await shared.commitHotelReservation(cloud, { documentId: 'revision-race', type: 'set', payload: fixture('revision-race', ['da scartare']), baseRevision: 2, operator: 3 })
  assert.equal(oldRetry.status, 'conflict')
  assert.equal(oldRetry.proposalStatus, 'resolved')
  assert.equal(oldRetry.revision, 4)
  assert.equal((await bookings.doc('revision-race').get()).data().revision, 4)
  const deletedVersion = (await cloud.collection('pms_hotel_reservation_tombstones').doc('cloud-only').get()).data().revision
  const resurrection = await shared.commitHotelReservation(cloud, { documentId: 'cloud-only', type: 'set', payload: fixture('cloud-only'), baseRevision: 0 })
  assert.equal(resurrection.status, 'already_committed')
  assert.equal(resurrection.revision, deletedVersion)
  assert.equal(resurrection.current, null)
  const staleCreation = await shared.commitHotelReservation(cloud, { documentId: 'cloud-only', type: 'set', payload: fixture('cloud-only', ['vecchia proposta']), baseRevision: 0 })
  assert.equal(staleCreation.status, 'conflict')
  assert.equal(staleCreation.revision, deletedVersion)
  assert.equal((await bookings.doc('cloud-only').get()).exists, false)

  console.log('Sync: modifiche senza revisione non diventano definitive')
  await cloudSave('tampered', fixture('tampered'))
  await until(async () => (await local('tampered'))?.revision === 1, 'Versione da proteggere non ricevuta')
  await bookings.doc('tampered').set({ ...fixture('tampered', ['scrittura fuori protocollo']), revision: 1 })
  await until(() => state().diagnostics.tampered, 'Scrittura senza revisione non rilevata')
  assert.deepEqual((await local('tampered')).notes, [])
  await cloudSave('removed-pointer', fixture('removed-pointer'))
  await until(async () => (await local('removed-pointer'))?.revision === 1, 'Versione prima della rimozione non ricevuta')
  await bookings.doc('removed-pointer').delete()
  await until(() => state().diagnostics['removed-pointer'], 'Rimozione senza revisione non rilevata')
  await assert.rejects(shared.commitHotelReservation(cloud, { documentId: 'removed-pointer', type: 'set', payload: fixture('removed-pointer'), baseRevision: 0 }), /senza cancellazione revisionata/)

  console.log('Sync: riavvio del processo con checkpoint su disco')
  const restartBooking = fixture('persisted-restart')
  await db.reservationDB.insertOne(restartBooking)
  await outbox.enqueueSet('pms_hotel_reservations', restartBooking.id, restartBooking, true)
  await until(() => sync.getHotelSyncBase(restartBooking.id), 'Checkpoint iniziale non salvato')
  sync.stopHotelCloudSync()
  await cloudSave(restartBooking.id, fixture(restartBooking.id, ['ricevuta dopo riavvio']))
  await db.reservationDB.insertOne(fixture('local-after-stop'))
  const restarted = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { createRequire } from 'node:module'
    import { pathToFileURL } from 'node:url'
    const root = ${JSON.stringify(sandbox)}
    const require = createRequire(root + '/package.json')
    const { initializeApp, deleteApp } = require('firebase-admin/app')
    const { getFirestore } = require('firebase-admin/firestore')
    const app = initializeApp({ projectId: 'demo-pmsweb-sync' })
    const { default: db } = await import(pathToFileURL(root + '/hotel/modules/db.js'))
    const sync = await import(pathToFileURL(root + '/pms/modules/hotelCloudSync.js'))
    sync.startHotelCloudSync()
    let received = false
    try {
      for (let i = 0; i < 200; i++) {
        const booking = await db.reservationDB.findOne({ id: 'persisted-restart' })
        const uploaded = await getFirestore(app).collection('pms_hotel_reservations').doc('local-after-stop').get()
        if (booking?.notes[0] === 'ricevuta dopo riavvio' && uploaded.exists) { received = true; break }
        await new Promise(resolve => setTimeout(resolve, 25))
      }
    } finally { sync.stopHotelCloudSync(); await deleteApp(app) }
    if (!received) throw Error('Ripristino dal checkpoint fallito')
  `], { encoding: 'utf8', timeout: 20000 })
  assert.equal(restarted.status, 0, restarted.stdout + restarted.stderr)
  assert.doesNotMatch(restarted.stderr, /firestore outbox|Hotel cloud sync listener/)
  const persisted = JSON.parse(readFileSync(path.join(process.env.MBAR_DATA_ROOT, 'hotel/reservationDB.json')))
  assert.deepEqual(persisted.find(row => row.id === restartBooking.id).notes, ['ricevuta dopo riavvio'])

  console.log('Sync: configurazione disabilitata')
  const disabledRoot = path.join(sandbox, 'disabled-database')
  const disabled = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { createRequire } from 'node:module'
    import { pathToFileURL } from 'node:url'
    import { existsSync } from 'node:fs'
    const root = ${JSON.stringify(sandbox)}
    const require = createRequire(root + '/package.json')
    const { initializeApp, deleteApp } = require('firebase-admin/app')
    const { getFirestore } = require('firebase-admin/firestore')
    const app = initializeApp({ projectId: 'demo-pmsweb-sync' })
    const { default: db } = await import(pathToFileURL(root + '/hotel/modules/db.js'))
    const originalSave = db.reservationDB.save
    const sync = await import(pathToFileURL(root + '/pms/modules/hotelCloudSync.js'))
    if (db.reservationDB.save !== originalSave) throw Error('Persistenza locale modificata con configurazione disabilitata')
    const outbox = await import(pathToFileURL(root + '/modules/firestoreOutbox.js'))
    sync.startHotelCloudSync()
    await outbox.enqueueSet('pms_hotel_reservations', 'flag-disabled', { id: 'flag-disabled', test: 'original upload' })
    try {
      for (let i = 0; i < 200; i++) {
        if ((await getFirestore(app).collection('pms_hotel_reservations').doc('flag-disabled').get()).exists) break
        await new Promise(resolve => setTimeout(resolve, 25))
      }
      if (existsSync(process.env.MBAR_DATA_ROOT + '/hotel/cloud-sync.json')) throw Error('Sync avviata con configurazione disabilitata')
    } finally { await deleteApp(app) }
  `], { encoding: 'utf8', timeout: 20000, env: { ...process.env, MBAR_DATA_ROOT: disabledRoot } })
  assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr)
  assert.equal((await bookings.doc('flag-disabled').get()).data().test, 'original upload')
  assert.deepEqual(syncErrors, [], 'Errori di persistenza o della pipeline realtime')
  console.log('OK: prenotazioni e prezzi sincronizzati in entrambe le direzioni, una sola revisione definitiva, conflitti come proposte storiche, checkpoint, riavvio e configurazione disabilitata; solo emulatori e database temporanei')
} finally {
  sync.stopHotelCloudSync()
  await deleteApp(app)
  console.error = originalError
  clearTimeout(deadline)
  rmSync(sandbox, { recursive: true, force: true })
}
