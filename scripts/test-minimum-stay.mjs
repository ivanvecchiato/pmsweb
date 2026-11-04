import assert from 'node:assert/strict'
import { initializeApp as initializeWebApp, deleteApp as deleteWebApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore as getWebFirestore, connectFirestoreEmulator, setDoc, doc } from 'firebase/firestore'
import { executeHotelOperation } from '../src/services/cloudHotelReservations.js'
import { calculateHotelQuote } from '../src/services/cloudHotelDocuments.js'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
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

try {
  for (const name of ['pms_hotel_reservations', 'pms_hotel_reservation_versions', 'pms_hotel_reservation_tombstones', 'pms_hotel_reservation_conflicts', 'pms_hotel_reservation_history', 'pms_room_inventory']) await db.recursiveDelete(db.collection(name))
  await db.collection('pms_web_users').doc(account.localId).set({ operatorId: 2, name: 'Minimum stay test', enabled: true, role: 'staff', permissions: { customers: true, home: true, override_pricing_policy: false } })
  await db.collection('pms_configs').doc('current').set({ hotel: { enabled: true, providerType: 'local', pricing: { mode: 'room', minimumStay: { BB: 3, HB: 4, FB: 5 }, ageBands: [] } }, beach: { enabled: false }, payments: { hotel: [{ id: 1, name: 'Contanti', electronic: false }] } })
  await db.collection('rooms').doc('101').set({ id: '101', room_code: '101', room_type: { id: 'std', label: 'Doppia', description: 'Doppia' } })
  await db.collection('pms_hotel_rates').doc('1').set({ id: 1, description: 'Base', prices: [{ roomType: 'Doppia', tariffa: 80 }], surcharges: { hb: 15, fb: 25 } })
  const batch = db.batch()
  for (let offset = 0; offset < 60; offset++) {
    const date = new Date(Date.parse('2026-10-01') + offset * 86400000).toISOString().slice(0, 10)
    batch.set(db.collection('pms_hotel_timetable').doc(date), { date, day: 274 + offset, pricelist: 1 })
  }
  await batch.commit()
  const booking = { id: 'minimum-stay-test', baseRevision: 0, roomId: '101', checkin: '2026-10-21', duration: 2, board: 'BB', adults: 2, kids: 0, lastname: 'Test', deposits: [] }
  let quote = await calculateHotelQuote(webDb, booking, false)
  assert.deepEqual(quote.minimumStay, { required: 3, nights: 2, violated: true, canOverride: false })
  await assert.rejects(executeHotelOperation(webDb, auth.currentUser, '/new_reservation', { ...booking, overrideMinimumStay: true }), /non autorizzato alla deroga/)
  assert.equal((await db.collection('pms_hotel_reservations').doc(booking.id).get()).exists, false)
  await db.collection('pms_web_users').doc(account.localId).update({ 'permissions.override_pricing_policy': true })
  await assert.rejects(executeHotelOperation(webDb, auth.currentUser, '/new_reservation', booking), /confermare esplicitamente/)
  const approved = await executeHotelOperation(webDb, auth.currentUser, '/new_reservation', { ...booking, overrideMinimumStay: true })
  assert.equal(approved.reservation.minimumStayOverride.required, 3)
  assert.equal(approved.reservation.minimumStayOverride.operator, 2)
  assert.equal((await db.collection('pms_hotel_reservation_versions').doc(booking.id).collection('revisions').doc('1').get()).data().snapshot.minimumStayOverride.required, 3)
  await executeHotelOperation(webDb, auth.currentUser, '/update_reservation', { id: booking.id, baseRevision: 1, firstname: 'Persistenza' })
  assert.equal((await db.collection('pms_hotel_reservations').doc(booking.id).get()).data().minimumStayOverride.required, 3)
  console.log('PASS cloud: staff permission, explicit confirmation, Firestore commit, immutable version and retained marker')
  // Same form and transport used by the operator, against isolated emulators.
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.accept())
    await page.goto('http://127.0.0.1:5178/')
    await page.locator('#login-email').fill(account.email)
    await page.locator('#login-password').fill('TestCloud123!')
    await page.getByRole('button', { name: 'Accedi', exact: true }).click()
    await page.getByRole('button', { name: '+ Nuova Prenotazione', exact: true }).click()
    const form = page.locator('.booking-form')
    await form.locator('select').first().selectOption('101')
    await form.getByPlaceholder('es. Mario').fill('Mario')
    await form.getByPlaceholder('es. Rossi').fill('MinimumStayBrowser')
    await form.locator('input[type=date]').nth(0).fill('2026-11-01')
    await form.locator('input[type=date]').nth(1).fill('2026-11-03')
    await form.getByRole('alert').filter({ hasText: 'Soggiorno minimo: 3 notti' }).waitFor()
    await form.getByRole('button', { name: 'Conferma Prenotazione', exact: true }).click()
    await form.waitFor({ state: 'hidden' })
    const saved = await db.collection('pms_hotel_reservations').where('accountholder.lastname', '==', 'MinimumStayBrowser').get()
    assert.equal(saved.size, 1)
    assert.equal(saved.docs[0].data().minimumStayOverride.required, 3)
    await page.locator('.booking').filter({ hasText: 'MinimumStayBrowser' }).click()
    await page.getByText(/Prenotazione inserita nonostante minimum stay/).waitFor()
    assert.deepEqual(errors, [])
    console.log('PASS web client: profile, canonical quote, warning, confirmation, Firestore payload/version, rendered persistent marker')
  } finally { await browser.close() }
} finally {
  clearTimeout(deadline)
  await deleteWebApp(webApp)
  await deleteApp(app)
}
