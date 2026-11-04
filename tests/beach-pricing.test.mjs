import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import axiosModule from 'axios'
import { computed, ref } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { flattenBeachZones } from '../../../node/mbar-server/beach/plan.js'
import { expandBeachRate, validateBeachRate } from '../src/generated/beach/pricing.js'

const source = (await readFile(new URL('../src/services/apiTransport.js', import.meta.url), 'utf8'))
  .replace(/^import .*\r?\n/gm, '').replaceAll('import.meta.env', 'testEnv').replace('export const', 'const')
const component = await readFile(new URL('../src/views/beach/BeachPriceManagement.vue', import.meta.url), 'utf8')
const places = [
  { id: 11, zone_id: 1, row: 1, column: 1, place_type: { id: 1, description: 'FILA 1' } },
  { id: 12, zone_id: 1, row: 1, column: 2, place_type: { id: 1, description: 'FILA 1' } },
  { id: 21, zone_id: 2, row: 1, column: 1, place_type: { id: 1, description: 'FILA 1' } }
]

async function setup(role = 'admin') {
  const store = new Map(places.map(place => [`pms_beach_plan/${place.id}`, place]))
  store.set('pms_web_users/admin', { enabled: true, role })
  store.set('pms_beach_timetable/2026-07-01', { date: '2026-07-01', pricelist: 0 })
  store.set('pms_hotel_timetable/2026-07-01', { date: '2026-07-01', pricelist: 'hotel' })
  const snapshot = path => ({ id: path.split('/').at(-1), exists: () => store.has(path), data: () => structuredClone(store.get(path)) })
  const axios = axiosModule.create({ adapter: () => { throw Error('Il cloud non deve chiamare il server locale') } })
  axios.AxiosError = axiosModule.AxiosError
  const context = vm.createContext({
    axios, testEnv: {}, console, URL, URLSearchParams, Date, Response, crypto: webcrypto,
    expandBeachRate, validateBeachRate,
    isFirebaseRemoteMode: () => true,
    useAuth: () => ({ currentUser: { value: { id: 7 } } }),
    getFirebaseAuth: () => ({ currentUser: { uid: 'admin' } }), getFirebaseDb: () => ({}),
    collection: (_, name) => name, doc: (_, name, id) => `${name}/${id}`,
    getDoc: async path => snapshot(path),
    getDocs: async name => {
      const docs = [...store.keys()].filter(path => path.startsWith(`${name}/`)).map(snapshot)
      return { docs, forEach: callback => docs.forEach(callback) }
    },
    setDoc: async (path, value) => { store.set(path, structuredClone(value)) },
    writeBatch: () => {
      const writes = []
      return { set: (path, value) => writes.push([path, value]), commit: async () => {
        for (const [path, value] of writes) store.set(path, { ...store.get(path), ...structuredClone(value) })
      } }
    }
  })
  vm.runInContext(source + '\nglobalThis.install = installApiTransportBridge', context)
  await context.install()
  return { axios, store }
}

test('cloud: crea due listini, rilegge il canonico e applica gli override per posto senza scrivere hotel', async () => {
  const { axios, store } = await setup()
  const rate = { id: 0, description: 'Estate', rowPrices: [
    { zoneId: 1, row: 1, price_per_place: 20 }, { zoneId: 2, row: 1, price_per_place: 30 }
  ], placeOverrides: [{ placeId: 12, price_per_place: 25 }] }
  const first = (await axios.post('/api/pms/saverate?type=beach', rate)).data.id
  const second = (await axios.post('/api/pms/saverate', rate, { params: { type: 'beach' } })).data.id
  assert.notEqual(first, second)
  assert.equal([...store.keys()].filter(key => key.startsWith('pms_beach_rates/')).length, 2)
  assert.equal([...store.keys()].some(key => key.startsWith('pms_hotel_rates/')), false)
  const canonical = (await axios.get('/api/pms/getrates?type=beach&mode=canonical')).data
  assert.equal(canonical.length, 2)
  assert.equal(canonical[0].prices, undefined)
  const expanded = (await axios.get('/api/pms/getrates?type=beach')).data
  assert.deepEqual(Array.from(expanded[0].prices, place => place.price_per_place), [20, 25, 30])
  assert.equal((await axios.get('/api/pms/beach/getplan?mode=flat')).data.length, 3)
  await axios.post('/api/pms/updatetimetable?type=beach', { updates: [{ date: '2026-07-01', pricelist: first, day: 182 }] })
  assert.equal(store.get('pms_beach_timetable/2026-07-01').pricelist, first)
  assert.equal(store.get('pms_hotel_timetable/2026-07-01').pricelist, 'hotel')
  await assert.rejects(axios.post('/api/pms/updatetimetable?type=beach', { updates: [{ date: '2026-07-01', pricelist: 0 }] }), /Salvare il listino/)
  await assert.rejects(axios.post('/api/pms/saverate?type=beach', { ...rate, placeOverrides: [{ placeId: 999, price_per_place: 5 }] }), /non valido/)
})

test('cloud: uno staff non può salvare listini spiaggia', async () => {
  const { axios, store } = await setup('staff')
  await assert.rejects(axios.post('/api/pms/saverate?type=beach', { id: 0, rowPrices: [], placeOverrides: [] }), /amministratore/)
  assert.equal([...store.keys()].some(key => key.startsWith('pms_beach_rates/')), false)
})

test('hotel: le scritture senza type mantengono il contratto esistente', async () => {
  const { axios, store } = await setup()
  await axios.post('/api/pms/saverate', { id: 'hotel', prices: [] })
  await axios.post('/api/pms/updatetimetable', { updates: [{ date: '2026-07-01', pricelist: 'hotel-new' }] })
  assert(store.has('pms_hotel_rates/hotel'))
  assert.equal(store.get('pms_hotel_timetable/2026-07-01').pricelist, 'hotel-new')
  assert.equal(store.get('pms_beach_timetable/2026-07-01').pricelist, 0)
})

test('configuratore: salva e rilegge eccezioni, poi uniforma solo la fila selezionata', async () => {
  const { axios, store } = await setup()
  const messages = []
  const { descriptor, errors } = parse(component)
  assert.equal(errors.length, 0)
  compileScript(descriptor, { id: 'beach' })
  assert.equal(compileTemplate({ source: descriptor.template.content, filename: 'BeachPriceManagement.vue', id: 'beach' }).errors.length, 0)
  const script = descriptor.scriptSetup.content.replace(/^import .*\r?\n/gm, '').replace('onMounted(fetchData);', '')
  const context = vm.createContext({ axios, ref, computed, console, Date, alert: message => messages.push(message) })
  vm.runInContext(script + '\nglobalThis.editor = { fetchData, addPricelist, selectedPricelist, saveBeachPrices, setRowPrice, selectionStart, selectionEnd, saveRangeAssignment }', context)
  const editor = context.editor
  assert(await editor.fetchData())
  editor.addPricelist()
  const draft = editor.selectedPricelist.value
  draft.rowDefaults['1:1'] = 20
  draft.rowDefaults['2:1'] = 30
  draft.customPrices[12] = 25
  draft.customPrices[21] = 35
  await editor.saveBeachPrices(draft)
  assert.notEqual(editor.selectedPricelist.value.id, 0)
  assert.equal(editor.selectedPricelist.value.customPrices[12], 25)
  editor.setRowPrice('1:1', 22)
  assert.equal(editor.selectedPricelist.value.customPrices[12], undefined)
  assert.equal(editor.selectedPricelist.value.customPrices[21], 35)
  await editor.saveBeachPrices(editor.selectedPricelist.value)
  const flat = (await axios.get('/api/pms/getrates?type=beach')).data[0]
  assert.deepEqual(Array.from(flat.prices, place => place.price_per_place), [22, 22, 35])
  editor.selectionStart.value = '2026-07-01'
  editor.selectionEnd.value = '2026-07-01'
  await editor.saveRangeAssignment()
  assert.equal(store.get('pms_beach_timetable/2026-07-01').pricelist, editor.selectedPricelist.value.id)
  assert(messages.includes('Listino spiaggia aggiornato con successo!'))
})

test('server: le sottoscrizioni ricevono listini e calendario spiaggia nelle rispettive basi locali', async () => {
  const server = await readFile(new URL('../../../node/mbar-server/pms/modules/hotelCloudSync.js', import.meta.url), 'utf8')
  const start = server.indexOf("   for (const type of ['hotel', 'beach']) {")
  const end = server.indexOf("   subscriptions.push(getFireDb().collection('pms_configs')", start)
  assert(start >= 0 && end > start)
  const database = () => {
    const records = []
    return { records, findOne: async predicate => records.find(predicate), insertOne: async item => records.push(item),
      updateOne: async (predicate, update) => { const index = records.findIndex(predicate); records[index] = update(records[index]) },
      deleteOne: async ({ id }) => { records.splice(records.findIndex(item => item.id === id), 1) } }
  }
  const beachRates = database()
  const beachTime = database()
  const hotelRates = database()
  const hotelTime = database()
  const listeners = new Map()
  const warnings = []
  const context = vm.createContext({
    validateBeachRate, flattenBeachZones,
    db: { hotelPricesdb: hotelRates, hotelTimeTableDB: hotelTime },
    beachDb: { beachPricesdb: beachRates, beachTimeTableDB: beachTime,
      planDB: { findMany: async () => [{ id: 1, code: 'A', name: 'A', rows: [{ place_type: { id: 1 }, places: [{ id: 11 }] }] }] } },
    subscriptions: [], activeGeneration: 1, generation: 1, changes: Promise.resolve(),
    getFireDb: () => ({ collection: name => ({ onSnapshot: callback => { listeners.set(name, callback); return () => {} } }) }),
    restart: error => { throw error }, hasPendingFirestoreOperation: () => false,
    isDeepStrictEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    sse: { broadcast: () => {} }, log: { e: message => warnings.push(message) }
  })
  vm.runInContext(server.slice(start, end) + '\nglobalThis.flush = () => changes', context)
  const notify = async (collection, data) => {
    listeners.get(collection)({ docChanges: () => [{ type: 'added', doc: { id: String(data.id ?? data.date), data: () => data } }] })
    await context.flush()
  }
  const rate = { id: 'estate', rowPrices: [{ zoneId: 1, row: 1, price_per_place: 20 }], placeOverrides: [{ placeId: 11, price_per_place: 25 }] }
  await notify('pms_beach_rates', rate)
  await notify('pms_beach_timetable', { date: '2026-07-01', pricelist: 'estate' })
  assert.equal(beachRates.records[0].placeOverrides[0].price_per_place, 25)
  assert.equal(beachTime.records[0].pricelist, 'estate')
  assert.equal(hotelRates.records.length, 0)
  assert.equal(hotelTime.records.length, 0)
  await notify('pms_beach_rates', { ...rate, id: 'invalid', rowPrices: [{ zoneId: 999, row: 1, price_per_place: 20 }] })
  assert.equal(beachRates.records.length, 1)
  assert.equal(warnings.length, 1)
})
