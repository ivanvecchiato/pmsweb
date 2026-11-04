import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { getHotelOccupancyReport } from '../src/generated/hotel/hotelOccupancy.js'

const source = (await readFile(new URL('../src/services/apiTransport.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/gm, '').replaceAll('import.meta.env', 'testEnv').replace('export const', 'const')
  .replace("const { getHotelOccupancyReport } = await import('../generated/hotel/hotelOccupancy.js')", 'const { getHotelOccupancyReport } = reportFunctions')

const room = { id: '101', room_code: '101', room_type: { id: 'double', label: 'Doppia' } }
const stay = { id: 'earlier', roomId: '101', room: '101', checkin: '2026-01-08', checkout: '2026-01-12', status: 0 }
const requests = []
let records = {}
let failQuery = false
const context = vm.createContext({
  testEnv: {}, console, URL, URLSearchParams, Date, Intl,
  getFirebaseDb: () => ({}),
  collection: (db, name) => ({ name, filters: [] }),
  where: (field, operator, value) => ({ field, operator, value }),
  buildFsQuery: (ref, ...filters) => ({ ...ref, filters }),
  reportFunctions: { getHotelOccupancyReport },
  getDocs: async request => {
    requests.push(request)
    if (failQuery) throw Error('Indice mancante')
    const values = (records[request.name] || []).filter(row => request.filters.every(({ field, operator, value }) => {
      if (operator === '>=') return row[field] >= value
      if (operator === '>') return row[field] > value
      if (operator === '<=') return row[field] <= value
      if (operator === '<') return row[field] < value
      throw Error(`Operatore inatteso ${operator}`)
    })).map((row, index) => ({ id: row.id || String(index), data: () => row }))
    return { docs: values, forEach: callback => values.forEach(callback) }
  }
})
vm.runInContext(source + '\nglobalThis.reports = { parseDateRange, readFromFirebaseCache, getStatsRowsFromFirestore, buildStatsResponseFromFirestore }', context)
const reports = context.reports

test('periodi italiani, ultimo millisecondo incluso e cambio ora legale', () => {
  const winter = reports.parseDateRange({ from: '2026-01-10', to: '2026-01-10' })
  assert.equal(winter.fromMs, Date.parse('2026-01-09T23:00:00Z'))
  assert.equal(winter.toMs, Date.parse('2026-01-10T23:00:00Z'))
  const spring = reports.parseDateRange({ from: '2026-03-29', to: '2026-03-30', exclusiveTo: true })
  assert.equal(spring.toMs - spring.fromMs, 23 * 3600000)
  const autumn = reports.parseDateRange({ from: '2026-10-25', to: '2026-10-26', exclusiveTo: true })
  assert.equal(autumn.toMs - autumn.fromMs, 25 * 3600000)
})

test('occupazione: soggiorno iniziato prima del periodo, checkout escluso, annullati esclusi', async () => {
  records = { rooms: [room], pms_hotel_reservations: [stay,
    { ...stay, id: 'departed', checkout: '2026-01-10' },
    { ...stay, id: 'cancelled', status: -100 },
    { ...stay, id: 'later', checkin: '2026-01-15', checkout: '2026-01-17' }
  ] }
  requests.length = 0
  const result = await reports.readFromFirebaseCache({ method: 'get', url: '/api/pms/hotel/reports/occupancy', params: { from: '2026-01-10', to: '2026-01-15' } })
  assert.equal(result.response.totals.soldRoomNights, 2)
  assert.equal(result.response.totals.availableRoomNights, 5)
  assert.equal(result.response.totals.conflicts, 0)
  const request = requests.find(entry => entry.name === 'pms_hotel_reservations')
  assert.deepEqual(JSON.parse(JSON.stringify(request.filters)), [{ field: 'checkin', operator: '<', value: '2026-01-15' }, { field: 'checkout', operator: '>', value: '2026-01-10' }])
})

test('presenze: soggiorno precedente incluso e partenza nel primo giorno conservata', async () => {
  records = { rooms: [room], pms_hotel_presences: [
    { ...stay, room_id: '101', registered_timestamp: 1, checkin_timestamp: Date.parse('2026-01-08'), checkout_timestamp: Date.parse('2026-01-12'), status: 2 },
    { ...stay, id: 'departing', room_id: '101', registered_timestamp: 1, checkout: '2026-01-10', checkin_timestamp: Date.parse('2026-01-08'), checkout_timestamp: Date.parse('2026-01-10'), status: 2 }
  ] }
  const result = await reports.readFromFirebaseCache({ method: 'get', url: '/api/pms/hotel/reports/presences', params: { from: '2026-01-10', to: '2026-01-15' } })
  assert.equal(result.response.totals.nights, 2)
  assert.equal(result.response.totals.departures, 2)
  assert.equal(result.response.totals.arrivals, 0)
})

test('vendite hotel: data incasso indipendente dal soggiorno e fine periodo esclusa', async () => {
  const document = { id: 'payment', salesReportVersion: 1, documentType: 'deposit', totale: 50, checkin: '2026-07-01', checkout: '2026-07-08', timestamp: Date.parse('2026-01-10T08:00:00Z') }
  records = { pms_hotel_documents: [document, { ...document, id: 'before', timestamp: Date.parse('2026-01-09T22:59:59.999Z') }, { ...document, id: 'end', timestamp: Date.parse('2026-01-10T23:00:00Z') }] }
  requests.length = 0
  const result = await reports.readFromFirebaseCache({ method: 'get', url: '/api/pms/hotel/reports/sales', params: { from: '2026-01-10', to: '2026-01-11' } })
  assert.equal(result.response.totals.sales, 50)
  assert.equal(result.response.totals.documents, 1)
  assert.equal(requests[0].filters[0].field, 'timestamp')
})

test('fatti bar: ultimo millisecondo del giorno incluso e nessun fallback alla collezione completa', async () => {
  records = { order_facts: [{ timestamp: Date.parse('2026-01-10T22:59:59.999Z'), quantity: 1, price: 5 }, { timestamp: Date.parse('2026-01-10T23:00:00Z'), quantity: 1, price: 8 }] }
  const result = await reports.getStatsRowsFromFirestore({ from: '2026-01-10', to: '2026-01-10' })
  assert.equal(result.length, 1)
  assert.equal(result[0].sales, 5)
  requests.length = 0
  failQuery = true
  try { await assert.rejects(() => reports.getStatsRowsFromFirestore({ from: '2026-01-10', to: '2026-01-10' }), /Indice mancante/) }
  finally { failQuery = false }
  assert.equal(requests.length, 1)
})
