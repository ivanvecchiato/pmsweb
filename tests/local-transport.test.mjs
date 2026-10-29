import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import axiosModule from 'axios'
import { computed, ref } from 'vue'

const transportSource = (await readFile(new URL('../src/services/apiTransport.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/gm, '').replaceAll('import.meta.env', 'testEnv').replace('export const', 'const')
const authSource = (await readFile(new URL('../src/composables/useAuth.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/gm, '').replaceAll('import.meta.env', 'testEnv').replace('export const', 'const')

test('locale: login PIN, utenti e sessione usano esclusivamente il protocollo esistente', async () => {
  const requests = []
  const storage = new Map()
  const noFirebase = () => { throw Error('Firebase non deve essere inizializzato nel locale') }
  const context = vm.createContext({
    ref, computed, testEnv: {}, Date, String, Number, JSON, console,
    isFirebaseRemoteMode: () => false,
    getFirebaseAuth: noFirebase, getFirebaseDb: noFirebase,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (url, init) => {
      requests.push({ url, init })
      let data
      if (url.endsWith('/web-users')) data = [{ id: 7, name: 'Operatore', enabled: true }]
      if (url.endsWith('/web-login')) data = { user: { id: 7, name: 'Operatore', permissions: { web: {} } }, token: 'sessione-locale', expiresAt: Date.now() + 60000 }
      if (url.endsWith('/getpmstype')) data = { hotel: { enabled: true }, beach: { enabled: false } }
      assert(data, `Endpoint inatteso: ${url}`)
      return { ok: true, json: async () => data }
    }
  })
  vm.runInContext(authSource + '\nglobalThis.auth = useAuth()', context)
  await context.auth.initializeAuth()
  assert.equal(requests.length, 0)
  const users = await context.auth.getLoginUsers()
  assert.equal(users[0].id, 7)
  assert(await context.auth.login(users[0], '1234'))
  assert.equal(requests[1].url, '/api/pms/web-login')
  assert.deepEqual(JSON.parse(requests[1].init.body), { id: 7, pin: '1234' })
  assert.equal(context.auth.currentUser.value.token, 'sessione-locale')
  assert(context.auth.validateSession())
  assert(context.auth.hasPermission('home'))
  assert(storage.has('pms_user'))
  context.auth.logout()
  assert.equal(context.auth.currentUser.value, null)
  assert.equal(storage.has('pms_user'), false)
})

test('locale: camere, prenotazioni, scritture e mbarDirect mantengono il trasporto Axios', async () => {
  const requests = []
  const axios = axiosModule.create({ adapter: async config => {
    requests.push(config)
    return { status: 200, data: { success: true }, config, headers: {} }
  } })
  const originalFetch = async () => ({ ok: true })
  const context = vm.createContext({
    axios, testEnv: {}, console, URL, URLSearchParams, Response, Date,
    fetch: originalFetch, isFirebaseRemoteMode: () => false,
    useAuth: () => ({ currentUser: { value: { id: 7 } } })
  })
  vm.runInContext(transportSource + '\nglobalThis.install = installApiTransportBridge', context)
  await context.install()
  assert.equal(context.fetch, originalFetch)
  await axios.get('/api/pms/getrooms')
  await axios.get('/api/pms/getbookingsbyrange', { params: { from: '2026-10-01', to: '2026-10-31' }, mbarDirect: true })
  await axios.post('/api/pms/hotel/new_reservation', { roomId: '101' })
  await axios.get('/api/pms/checkin', { params: { reservation: 'a' } })
  await axios.get('/api/pms/hotel/sync_h5s')
  assert.equal(requests[0].url, '/api/pms/getrooms')
  assert.equal(requests[1].mbarDirect, true)
  assert.equal(requests[1].params.from, '2026-10-01')
  assert.deepEqual(JSON.parse(requests[2].data), { roomId: '101', operator: 7 })
  assert.equal(requests[3].params.operator, 7)
  assert.equal(requests[4].url, '/api/pms/hotel/sync_h5s')
})

const plannerSource = await readFile(new URL('../src/views/pms/HotelBookingPlanner.vue', import.meta.url), 'utf8')
const refreshStart = plannerSource.indexOf('const refreshPlanner =')
const refreshSource = plannerSource.slice(refreshStart, plannerSource.indexOf('\n};', refreshStart) + 3)

for (const cloud of [false, true]) {
  for (const provider of ['local', 'h5s']) {
    test(`refresh planning: target ${cloud ? 'cloud' : 'locale'}, provider ${provider}`, async () => {
      const requests = []
      let refreshes = 0
      const context = vm.createContext({
        isRefreshingPlanner: ref(false), providerType: ref(provider), console,
        isFirebaseRemoteMode: () => cloud,
        axios: { get: async url => { requests.push(url) } },
        getReservations: () => { refreshes++ },
        alert: message => { throw Error(message) }
      })
      vm.runInContext(refreshSource + '\nglobalThis.refreshPlanner = refreshPlanner', context)
      await context.refreshPlanner()
      assert.deepEqual(requests, provider === 'h5s' ? ['/api/pms/hotel/sync_h5s'] : [])
      assert.equal(refreshes, 1)
      assert.equal(context.isRefreshingPlanner.value, false)
    })
  }
}
