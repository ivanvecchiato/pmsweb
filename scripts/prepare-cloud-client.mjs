import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = process.env.MBAR_SERVER_ROOT || resolve(root, '../../node/mbar-server')
const destination = resolve(root, 'src/generated/hotel')
mkdirSync(destination, { recursive: true })

// Artefatto browser generato dal motore installato: nessuna modifica al server.
const pricing = readFileSync(resolve(server, 'pms/modules/hotelPricing.js'), 'utf8')
const utils = readFileSync(resolve(server, 'pms/utils.js'), 'utf8')
const methods = []
for (const name of ['uid', 'dayOfYear', 'dateH5S']) {
  const start = utils.search(new RegExp(`    ${name}\\s*\\(`))
  const end = utils.indexOf('\n    }', start)
  if (start < 0 || end < 0) throw Error(`Metodo prezzi del server non trovato: ${name}`)
  methods.push(utils.slice(start, end + 6).trim())
}
if (!pricing.startsWith("import utils from '../utils.js';")) throw Error('Import del motore prezzi non riconosciuto')
writeFileSync(resolve(destination, 'hotelPricing.js'), '// Generato dal motore prezzi del server; non modificare.\n' + pricing.replace("import utils from '../utils.js';", `const utils = {\n${methods.join(',\n')}\n};`))
copyFileSync(resolve(server, 'desktop/branding/logo-source.png'), resolve(destination, 'logo-source.png'))

for (const name of ['hotel/Reservation.js', 'shared/Guest.js']) {
  mkdirSync(resolve(destination, 'data', dirname(name)), { recursive: true })
  copyFileSync(resolve(server, 'data', name), resolve(destination, 'data', name))
}

// Riutilizza il calcolo dell'occupazione locale sui dati già filtrati da Firestore.
const repo = readFileSync(resolve(server, 'pms/repo.js'), 'utf8')
const reportStart = repo.indexOf('   async getHotelOccupancyReport(dayFrom, dayTo) {')
const reportEnd = repo.indexOf('\n   async getHotelEconomicsReport(', reportStart)
if (reportStart < 0 || reportEnd < 0) throw Error('Report occupazione del server non riconosciuto')
const occupancy = repo.slice(reportStart, reportEnd).trim()
  .replace('async getHotelOccupancyReport(dayFrom, dayTo)', 'export async function getHotelOccupancyReport(rooms, reservations, dayFrom, dayTo)')
  .replace('      const rooms = await db.roomDB.findMany();\n', '')
  .replace('await db.reservationDB.findMany()', 'reservations')
  .replace(/},$/, '}')
copyFileSync(resolve(server, 'pms/statuses.js'), resolve(destination, 'statuses.js'))
writeFileSync(resolve(destination, 'hotelOccupancy.js'), "// Generato dal report del server; non modificare.\nimport { isOverbookingRoomType } from './hotelPricing.js'\nimport { CANCELLED } from './statuses.js'\n\n" + occupancy + '\n')
