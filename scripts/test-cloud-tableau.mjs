const deadline = setTimeout(() => { console.error('Timeout collaudo cloud'); process.exit(1) }, 30000)
deadline.unref()
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { computed, ref, watch } from 'vue'
import axiosModule from 'axios'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signOut } from 'firebase/auth'
import * as fs from 'firebase/firestore'
// Il test usa solo emulatori localhost e il progetto demo-pmsweb.
const testEmail = `tableau-${Date.now()}@example.test`
const authResponse = await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: testEmail, password: 'TableauTest123!', returnSecureToken: true })
})
const account = await authResponse.json()
if (!authResponse.ok) throw Error(JSON.stringify(account))
const encode = value => {
  if (value === null) return { nullValue: null }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { doubleValue: value }
  return { stringValue: value }
}
const write = async (collection, id, data) => {
  if (collection === 'pms_hotel_reservations' && Array.isArray(data.deposits)) {
    const { deposits, ...booking } = data
    for (const [position, deposit] of deposits.entries()) await write(`pms_hotel_reservations/${id}/deposits`, `deposit-${position}`, { ...deposit, id: `deposit-${position}`, position, reservation_revision: 1, fiscal_requested: false })
    data = booking
  }
  const response = await fetch(`http://127.0.0.1:8180/v1/projects/demo-pmsweb/databases/(default)/documents/${collection}/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: encode(data).mapValue.fields })
  })
  if (!response.ok) throw Error(await response.text())
}
await write('pms_web_users', account.localId, { operatorId: 7, name: 'Operatore test', role: 'staff', enabled: true, permissions: { home: true } })
await write('pms_configs', 'current', { hotel: { enabled: true, providerType: 'local', pricing: { mode: 'room', ageBands: [] } }, beach: { enabled: false }, payments: { hotel: [{ id: 1, name: 'Bonifico', electronic: true }] } })
const testRooms = [
  { id: '101', room_code: '101', description: 'Camera 101', room_type: { label: 'Doppia' } },
  { id: '102', room_code: '102', description: 'Camera 102', room_type: { label: 'Doppia' } }
]
for (const room of testRooms) await write('rooms', room.room_code, room)

const booking = { roomId: '101', room: '101', adults: 2, kids: 0, board: 'BB', status: 0, price_total: 900, notes: ['Nota dal cloud'], deposits: [{ amount: 100, payment_date: '2026-10-01', payment_mode: 'Bonifico' }] }
await write('pms_hotel_reservations', 'long-stay', { ...booking, id: 'long-stay', checkin: '2026-08-01', checkout: '2026-10-22', duration: 82, accountholder: { firstname: 'Lungo', lastname: 'Soggiorno' } })
await write('pms_hotel_reservations', 'arrival', { ...booking, id: 'arrival', roomId: '102', room: '102', checkin: '2026-10-12', checkout: '2026-10-14', duration: 2, accountholder: { firstname: 'Arrivo', lastname: 'Cloud' } })
await write('pms_hotel_reservations', 'departure', { ...booking, id: 'departure', roomId: '102', room: '102', checkin: '2026-10-01', checkout: '2026-10-12', duration: 11, accountholder: { firstname: 'Partenza', lastname: 'Cloud' } })
await write('pms_hotel_reservations', 'cancelled', { ...booking, id: 'cancelled', checkin: '2026-10-12', checkout: '2026-10-15', duration: 3, status: -100, accountholder: { firstname: 'Annullata', lastname: 'Cloud' } })
await write('pms_hotel_reservations', 'future', { ...booking, id: 'future', checkin: '2026-11-01', checkout: '2026-11-04', duration: 3, accountholder: { firstname: 'Futuro', lastname: 'Cloud' } })
await write('pms_hotel_reservation_history', 'history-1', { id: 'history-1', reservation_id: 'arrival', modified_timestamp: 1, modified_at: '2026-10-01T10:00:00Z', operator: { id: 7, name: 'Operatore test' }, snapshot: { ...booking, id: 'arrival', checkin: '2026-10-12', checkout: '2026-10-14', accountholder: { firstname: 'Prima', lastname: 'Modifica' } } })

const app = initializeApp({ projectId: 'demo-pmsweb', apiKey: 'demo-key', authDomain: 'demo-pmsweb.firebaseapp.com' }, 'tableau-integration')
const auth = getAuth(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true })
const db = fs.getFirestore(app)
fs.connectFirestoreEmulator(db, '127.0.0.1', 8180)
await signInWithEmailAndPassword(auth, testEmail, 'TableauTest123!')
await assert.rejects(fs.setDoc(fs.doc(db, 'pms_web_users', account.localId), { role: 'admin' }, { merge: true }), error => error.code === 'permission-denied')
await assert.rejects(fs.setDoc(fs.doc(db, 'pms_hotel_reservations', 'client-write-denied'), { id: 'client-write-denied' }), error => error.code === 'permission-denied')
await assert.rejects(fs.setDoc(fs.doc(db, 'pms_fiscal_jobs', 'client-write-denied'), { status: 'completed' }), error => error.code === 'permission-denied')
const axios = axiosModule.create({ adapter: async config => {
  throw Error(`Richiesta HTTP non prevista nel cloud: ${config.url}`)
} })
axios.AxiosError = axiosModule.AxiosError
const context = vm.createContext({
  ...fs, buildFsQuery: fs.query, axios, testEnv: { DEV: true, VITE_FIREBASE_FUNCTIONS_EMULATOR_URL: 'http://127.0.0.1:5001/demo-pmsweb/europe-west1/pmsHotel/api/pms/hotel' }, console, URL, URLSearchParams, Response, Date, JSON,
  isFirebaseRemoteMode: () => true, getFirebaseDb: () => db, getFirebaseAuth: () => auth,
  useAuth: () => ({ currentUser: { value: { id: 7 } } }),
  fetch: async () => { throw Error('È stata eseguita una richiesta LAN') }
})
const transportSource = (await readFile(new URL('../src/services/apiTransport.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replaceAll('import.meta.env', 'testEnv').replace('export const', 'const')
vm.runInContext(transportSource + '\nglobalThis.install = installApiTransportBridge', context, { filename: fileURLToPath(new URL('../src/services/apiTransport.js', import.meta.url)), importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER })
await context.install()
console.log('Cloud: letture')
const { data } = await axios.get('/api/pms/getbookingsbyrange?from=2026-10-02&to=2026-10-21')
assert(data.bookings.some(row => row.id === 'long-stay'))
assert(!data.bookings.some(row => row.id === 'future'))
assert(data.bookings.some(row => row.id === 'arrival'))
const overlap = await axios.get('/api/pms/getbookingsbyrange?from=2026-10-12', { params: { to: '2026-10-12' } })
assert(overlap.data.bookings.some(row => row.id === 'departure'))
const detail = await axios.get('/api/pms/hotel/reservation', { params: { id: 'arrival' } })
assert.equal(detail.data.reservation.deposits[0].amount, 100)
const history = await axios.get('/api/pms/hotel/reservation/history', { params: { reservationId: 'arrival' } })
assert.equal(history.data.history[0].id, 'history-1')
const modules = await axios.get('/api/pms/getpmstype')
assert.equal(modules.data.hotel.enabled, true)
const rooms = await axios.get('/api/pms/getrooms')
assert.equal(rooms.data[0].id, '101')
const fetchResponse = await context.fetch('/api/pms/getbookingsbyrange?from=2026-10-02&to=2026-10-21')
assert.equal((await fetchResponse.json()).bookings.length, data.bookings.length)
await assert.rejects(axios.post('/api/pms/hotel/new_reservation', {}, { mbarDirect: true }), error => error.response.status === 403)
await assert.rejects(axios.get('/api/pms/checkin'), error => error.response.status === 501)
assert.equal((await context.fetch('/api/pms/hotel/update_reservation', { method: 'POST', body: '{}' })).status, 403)
const movements = await axios.get('/api/pms/movements?date=2026-10-12')
assert.equal(movements.data.arrivals.length, 1)
assert.equal(movements.data.arrivals[0].id, 'arrival')
assert.equal(movements.data.departures.length, 1)
assert.equal(movements.data.departures[0].id, 'departure')
console.log('Cloud: listener diretti del tableau e smontaggio')
const plannerSource = await readFile(new URL('../src/views/pms/HotelBookingPlanner.vue', import.meta.url), 'utf8')
const lifecycle = plannerSource.slice(plannerSource.indexOf('onMounted(() => {'), plannerSource.indexOf('</script>')).replaceAll('import.meta.env', 'testEnv')
let mountPlanner
let unmountPlanner
let roomRefreshes = 0
let bookingRefreshes = 0
let displayedRooms = []
let displayedBookings = []
let displayedRates = []
let displayedTimetable = []
let displayedPolicy
let rateRefreshes = 0
let timetableRefreshes = 0
let policyRefreshes = 0
let priceRefreshes = 0
Object.assign(context, {
  onMounted: callback => { mountPlanner = callback }, onUnmounted: callback => { unmountPlanner = callback },
  window: { addEventListener() {}, removeEventListener() {} },
  handleMouseMove() {}, handleMouseUp() {}, handleGlobalClick() {},
  getRooms: async () => { displayedRooms = (await axios.get('/api/pms/getrooms')).data; roomRefreshes++ },
  getReservations: async () => { displayedBookings = (await axios.get('/api/pms/getbookingsbyrange?from=2026-10-02&to=2026-10-21')).data.bookings; bookingRefreshes++ },
  loadHotelPricingPolicy: async () => { displayedPolicy = (await axios.get('/api/pms/getconfigs?section=hotel')).data.pricing; policyRefreshes++ },
  loadPricelists: async () => { displayedRates = (await axios.get('/api/pms/getrates?type=hotel')).data; rateRefreshes++ },
  loadTimetable: async () => { displayedTimetable = (await axios.get('/api/pms/gettimetable?type=hotel')).data; timetableRefreshes++ },
  showModal: ref(true), isModalReadOnly: ref(false), scheduleHotelPricingRefresh: () => { priceRefreshes++ },
  loadAvailableServices() {}, loadHotelPaymentMethods() {},
  getLoginUsers: async () => [], operators: ref([]), showPlannerToast: message => { throw Error(message) },
  connectPmsEvents: () => { throw Error('SSE locale avviato dal tableau cloud') }, setTimeout, clearTimeout,
  handlePmsEvent: () => { throw Error('Conversione degli snapshot in eventi SSE') }
})
vm.runInContext('let unsubscribeCloudRooms, unsubscribeCloudReservations, unsubscribeCloudRates, unsubscribeCloudTimetable, unsubscribeCloudConfigs, pmsRefreshTimeout, plannerToastTimeout, pricingRefreshTimeout, pmsReconnectTimeout, pmsEventAbortController, pmsStreamStopped;\n' + lifecycle, context)
mountPlanner()
const waitFor = async predicate => {
  const end = Date.now() + 5000
  while (Date.now() < end) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw Error('Aggiornamento tableau non ricevuto')
}
await waitFor(() => roomRefreshes >= 2 && bookingRefreshes >= 1)
await write('pms_hotel_reservations', 'arrival', { ...booking, id: 'arrival', roomId: '102', checkin: '2026-10-12', checkout: '2026-10-14', duration: 2, accountholder: { firstname: 'Dopo listener', lastname: 'Cloud' } })
await waitFor(() => displayedBookings.some(row => row.id === 'arrival' && row.accountholder.firstname === 'Dopo listener'))
await write('rooms', '101', { ...testRooms[0], description: 'Camera aggiornata' })
await waitFor(() => displayedRooms.some(row => row.description === 'Camera aggiornata'))
await write('pms_hotel_rates', 'realtime-test', { id: 'realtime-test', prices: [{ roomType: 'Doppia', tariffa: 123 }] })
await waitFor(() => displayedRates.some(row => row.id === 'realtime-test' && row.prices[0]?.tariffa === 123))
await write('pms_hotel_timetable', 'realtime-test', { day: 1, pricelist: 'realtime-test' })
await waitFor(() => displayedTimetable.some(row => row.pricelist === 'realtime-test'))
await write('pms_configs', 'current', { hotel: { enabled: true, providerType: 'local', pricing: { mode: 'person', thirdBedDiscountPct: 35, ageBands: [] } }, beach: { enabled: false } })
await waitFor(() => displayedPolicy?.mode === 'person' && displayedPolicy.thirdBedDiscountPct === 35)
assert(priceRefreshes >= 3)
context.isModalReadOnly.value = true
const readOnlyPriceRefreshes = priceRefreshes
await write('pms_configs', 'current', { hotel: { enabled: true, providerType: 'local', pricing: { mode: 'person', thirdBedDiscountPct: 40, ageBands: [] } }, beach: { enabled: false } })
await waitFor(() => displayedPolicy?.thirdBedDiscountPct === 40)
assert.equal(priceRefreshes, readOnlyPriceRefreshes)
unmountPlanner()
const stoppedRooms = roomRefreshes
const stoppedBookings = bookingRefreshes
const stoppedPricing = [rateRefreshes, timetableRefreshes, policyRefreshes, priceRefreshes]
await write('rooms', '101', testRooms[0])
await write('pms_hotel_reservations', 'arrival', { ...booking, id: 'arrival', roomId: '102', checkin: '2026-10-12', checkout: '2026-10-14', accountholder: { firstname: 'Dopo smontaggio', lastname: 'Cloud' } })
await write('pms_hotel_rates', 'realtime-test', { id: 'realtime-test', prices: [] })
await write('pms_hotel_timetable', 'realtime-test', { day: 1, pricelist: 'stopped' })
await write('pms_configs', 'current', { hotel: { enabled: true, providerType: 'local', pricing: { mode: 'room' } }, beach: { enabled: false } })
await new Promise(resolve => setTimeout(resolve, 250))
assert.equal(roomRefreshes, stoppedRooms)
assert.equal(bookingRefreshes, stoppedBookings)
assert.deepEqual([rateRefreshes, timetableRefreshes, policyRefreshes, priceRefreshes], stoppedPricing)
await write('pms_configs', 'current', { hotel: { enabled: true, providerType: 'h5s' }, beach: { enabled: false } })
assert.equal((await axios.get('/api/pms/getpmstype')).data.hotel.providerType, 'h5s')
console.log('Cloud: autenticazione')
const authContext = vm.createContext({
  ref, computed, testEnv: {}, console, Date, String, Number, JSON,
  onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  doc: fs.doc, onSnapshot: fs.onSnapshot,
  getFirebaseAuth: () => auth, getFirebaseDb: () => db,
  isFirebaseRemoteMode: () => true,
  fetch: context.fetch,
  localStorage: { getItem: () => { throw Error('Accesso alla sessione LAN dal cloud') }, removeItem: () => { throw Error('Modifica della sessione LAN dal cloud') } }
})
const authSource = (await readFile(new URL('../src/composables/useAuth.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/gm, '').replaceAll('import.meta.env', 'testEnv').replace('export const', 'const')
vm.runInContext(authSource + '\nglobalThis.auth = useAuth()', authContext)
await authContext.auth.initializeAuth()
assert.equal(authContext.auth.currentUser.value.id, 7)
authContext.auth.logout()
await signOut(auth)
await authContext.auth.loginOnline(testEmail, 'TableauTest123!')
assert(authContext.auth.hasPermission('home'))
assert(!authContext.auth.hasPermission('customers'))
const revoked = new Promise(resolve => {
  const stop = watch(authContext.auth.currentUser, user => { if (!user) { stop(); resolve() } })
})
await write('pms_web_users', account.localId, { operatorId: 7, name: 'Operatore test', role: 'staff', enabled: false, permissions: { home: true } })
await revoked
assert.equal(authContext.auth.isAuthenticated.value, false)
authContext.auth.logout()
await signOut(auth)
console.log('OK: query sovrapposizione, soggiorno lungo, confini date, dettaglio/acconti, storico, moduli, camere, axios/fetch, listener in tempo reale, arrivi/partenze e annullamenti, autenticazione online, revoca profilo, blocco scritture e nessuna richiesta LAN')
await fs.terminate(db)
await deleteApp(app)
