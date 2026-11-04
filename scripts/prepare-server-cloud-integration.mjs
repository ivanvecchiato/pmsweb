import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = process.env.MBAR_SERVER_ROOT || resolve(root, '../../node/mbar-server')
const destination = mkdtempSync(resolve(tmpdir(), 'pmsweb-server-cloud-review-'))
for (const name of ['index.js', 'modules/firestoreOutbox.js', 'pms/modules/firestore.js', 'pms/repo.js']) {
  mkdirSync(dirname(resolve(destination, name)), { recursive: true })
  cpSync(resolve(server, name), resolve(destination, name))
}
for (const name of ['hotelCloudSync.js', 'hotelFiscalJobs.js']) cpSync(resolve(root, 'server-integration', name), resolve(destination, 'pms/modules', name))
cpSync(resolve(root, 'server-integration/firestoreOutbox.js'), resolve(destination, 'modules/firestoreOutbox.js'))
for (const name of ['reservationSync.js', 'hotel.js']) cpSync(resolve(root, 'server-integration', name), resolve(destination, 'pms/modules', name))
const model = readFileSync(resolve(root, 'src/services/hotelReservation.js'), 'utf8')
  .replace("'../generated/hotel/data/hotel/Reservation.js'", "'../../data/hotel/Reservation.js'")
  .replace("'../generated/hotel/hotelPricing.js'", "'./hotelPricing.js'")
writeFileSync(resolve(destination, 'pms/modules/hotelReservation.js'), model)
cpSync(resolve(server, 'pms/modules/hotelPricing.js'), resolve(destination, 'pms/modules/hotelPricing.js'))

for (const name of ['index.js', 'modules/firestoreOutbox.js', 'pms/modules/firestore.js', 'pms/repo.js', 'pms/modules/hotelCloudSync.js', 'pms/modules/hotelFiscalJobs.js', 'pms/modules/reservationSync.js', 'pms/modules/hotel.js', 'pms/modules/hotelPricing.js', 'pms/modules/hotelReservation.js']) {
  execFileSync(process.execPath, ['--check', resolve(destination, name)])
}
console.log(`Integrazione preparata e verificata in ${destination}`)
console.log('Il server originale non è stato modificato. Installazione di test: attivazione dopo il riallineamento diretto, senza backup.')
