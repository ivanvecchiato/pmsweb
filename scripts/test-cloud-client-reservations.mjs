import assert from 'node:assert/strict'
import { initializeApp as initializeWebApp, deleteApp as deleteWebApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore as getWebFirestore, connectFirestoreEmulator, setDoc, doc } from 'firebase/firestore'
import { executeHotelOperation } from '../src/services/cloudHotelReservations.js'
import { calculateHotelQuote } from '../src/services/cloudHotelDocuments.js'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180'
process.env.TZ = 'Europe/Rome'
const app = initializeApp({ projectId: 'demo-pmsweb' }, 'cloud-reservations-test')
const db = getFirestore(app)
const deadline = setTimeout(() => { console.error('Timeout backend cloud'); process.exit(1) }, 60000)
deadline.unref()
const signup = await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `operator-${Date.now()}@example.test`, password: 'TestCloud123!', returnSecureToken: true })
})
assert(signup.ok)
const account = await signup.json()
const webApp = initializeWebApp({ projectId: 'demo-pmsweb', apiKey: 'demo-key', authDomain: 'demo-pmsweb.firebaseapp.com' }, 'reservation-client-test')
const auth = getAuth(webApp)
connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true })
const webDb = getWebFirestore(webApp)
connectFirestoreEmulator(webDb, '127.0.0.1', 8180)
await signInWithEmailAndPassword(auth, account.email, 'TestCloud123!')
const request = async (path, data, expected = 200, token = account.idToken) => {
  console.log('Operazione:', path, data?.id || '', expected)
  try {
    const result = path === '/calculateprice' ? await calculateHotelQuote(webDb, data) : await executeHotelOperation(webDb, token === 'invalid-token' ? null : auth.currentUser, path, data)
    assert.equal(expected, 200, JSON.stringify(result))
    return result
  } catch(error) {
    const status = error.status || (error.code === 'permission-denied' ? 403 : 400)
    if (status !== expected) throw error
    return error.result || { error: error.message }
  }
}

try {
  for (const name of ['pms_hotel_reservations', 'pms_hotel_reservation_tombstones', 'pms_hotel_reservation_versions', 'pms_hotel_reservation_conflicts', 'pms_hotel_reservation_history', 'pms_room_inventory', 'pms_fiscal_jobs']) await db.recursiveDelete(db.collection(name))
  const batch = db.batch()
  batch.set(db.collection('pms_web_users').doc(account.localId), { operatorId: 2, name: 'Ivan test', enabled: true, role: 'admin', permissions: {} })
  batch.set(db.collection('pms_configs').doc('current'), { hotel: { enabled: true, providerType: 'local', pricing: { mode: 'person', thirdBedDiscountPct: 30, ageBands: [{ label: 'Bambini', minAge: 0, maxAge: 17, pricingType: 'discount', discountPct: 50 }] } }, beach: { enabled: false }, payments: { hotel: [{ id: 1, name: 'Bonifico', electronic: true }] } })
  for (const id of ['101', '102']) batch.set(db.collection('rooms').doc(id), { id, room_code: id, room_type: { label: 'Doppia' } })
  batch.set(db.collection('pms_hotel_rates').doc('1'), { id: 1, prices: [{ roomType: 'Doppia', tariffa: 80 }], surcharges: { hb: 15, fb: 25 } })
  for (let day = 1; day <= 365; day++) batch.set(db.collection('pms_hotel_timetable').doc(String(day)), { day, pricelist: 1 })
  await batch.commit()
  const base = { id: 'cloud-booking', baseRevision: 0, roomId: '101', checkin: '2026-10-21', duration: 3, board: 'BB', adults: 2, kids: 1, kidsAges: [8], firstname: 'Ospite', lastname: 'Cloud', deposits: [{ id: 'deposit-a', amount: 100, payment_date: '2026-10-20', payment_method_id: 1 }] }
  console.log('Client Firestore: accesso, prezzi, creazione con acconto e retry')
  await request('/new_reservation', base, 401, 'invalid-token')
  const quote = await request('/calculateprice', base)
  assert.equal(quote.total_price, 600)
  const created = await request('/new_reservation', base)
  assert.equal(created.revision, 1)
  assert.equal(created.reservation.price_total, 600)
  assert.equal(created.reservation.room, '101')
  assert.equal(created.reservation.deposits[0].amount, 100)
  assert.equal(created.reservation.deposits[0].fiscal_status, 'pending')
  assert.equal((await db.collection('pms_fiscal_jobs').doc('cloud-booking_deposit-a').get()).exists, false)
  assert.equal((await db.collection('pms_hotel_reservations').doc(base.id).get()).data().deposits, undefined)
  assert.equal((await db.collection('pms_hotel_reservations').doc(base.id).collection('deposits').doc('deposit-a').get()).data().fiscal_requested, false)
  const replay = await request('/new_reservation', base)
  assert.equal(replay.revision, 1)
  console.log('Client Firestore: modifica, spostamento e conflitto')
  const updated = await request('/update_reservation', { id: base.id, baseRevision: 1, firstname: 'Modificato' })
  assert.equal(updated.revision, 2)
  assert.equal(updated.reservation.deposits.length, 1)
  const moved = await request('/update_reservation', { id: base.id, baseRevision: 2, roomId: '102', duration: 4 })
  assert.equal(moved.revision, 3)
  assert.equal(moved.reservation.room, '102')
  assert.equal(moved.reservation.price_total, 800)
  const conflict = await request('/update_reservation', { id: base.id, baseRevision: 1, firstname: 'Vecchia proposta' }, 409)
  assert.equal(conflict.current.revision, 3)
  assert.equal((await db.collection('pms_hotel_reservations').doc(base.id).get()).data().accountholder.firstname, 'Modificato')
  const conflicts = await request('/conflicts')
  assert(conflicts.some(row => row.proposalId === conflict.proposalId && row.currentRevision === 3))
  const resolved = await request('/resolve_conflict', { id: base.id, baseRevision: 3, proposalId: conflict.proposalId, choice: 'current' })
  assert.equal(resolved.revision, 4)
  console.log('Client Firestore: disponibilità atomica con due inserimenti concorrenti')
  const concurrent = await Promise.all(['race-a', 'race-b'].map(async id => {
    try { await executeHotelOperation(webDb, auth.currentUser, '/new_reservation', { ...base, id, checkin: '2026-10-28', deposits: [] }); return 200 }
    catch(error) { if(error.status !== 409) { console.error('Race negata', id, error.code, 'guard', (await db.collection('pms_room_inventory').doc('101').get()).data(), 'record', (await db.collection('pms_hotel_reservations').get()).docs.map(doc => [doc.id,doc.data().revision])); throw error } return error.status }
  }))
  assert.deepEqual(concurrent.sort(), [200, 409])
  const late = { ...base, id: 'late-fiscal', checkin: '2027-01-02' }
  await request('/new_reservation', late)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('late-fiscal_deposit-a').get()).exists, false)
  const emission = await request('/deposit/request_fiscal', { id: late.id, baseRevision: 1, depositId: 'deposit-a' })
  assert.equal(emission.revision, 2)
  assert.equal((await db.collection('pms_fiscal_jobs').doc('late-fiscal_deposit-a').get()).data().status, 'pending')
  const repeat = await request('/deposit/request_fiscal', { id: late.id, baseRevision: 2, depositId: 'deposit-a' })
  assert.equal(repeat.revision, 2)
  await assert.rejects(setDoc(doc(webDb, 'pms_fiscal_jobs', 'late-fiscal_deposit-a'), { status: 'completed' }, { merge: true }), error => error.code === 'permission-denied')
  await assert.rejects(setDoc(doc(webDb, 'pms_hotel_reservations', late.id, 'deposits', 'deposit-a'), { fiscal_status: 'issued', document_id: 'forged' }, { merge: true }), error => error.code === 'permission-denied')
  const cancelled = await request('/cancel_reservation', { id: base.id, baseRevision: 4, cancellation_reason: 'Annullamento test' })
  assert.equal(cancelled.revision, 5)
  assert.equal(cancelled.reservation.status, -100)
  assert.equal(cancelled.reservation.deposits[0].amount, 100)
  console.log('Client Firestore: revoca permessi e tutela acconti')
  await db.collection('pms_web_users').doc(account.localId).update({ role: 'staff', permissions: { home: true } })
  await request('/new_reservation', { ...base, id: 'forbidden' }, 403)
  await db.collection('pms_web_users').doc(account.localId).update({ enabled: false })
  await request('/calculateprice', base, 403)
  console.log('OK: SDK Web autenticato, prezzi server, CRUD prenotazioni, acconto immediato e fiscalizzazione differita, disponibilità concorrente, conflitti e permessi; solo emulatori')
} finally {
  await deleteWebApp(webApp)
  await deleteApp(app)
  clearTimeout(deadline)
}
