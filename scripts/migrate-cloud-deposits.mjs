import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import net from 'node:net'

const apply = process.argv.includes('--apply')
const emulator = process.argv.includes('--emulator')
const server = process.env.MBAR_SERVER_ROOT || resolve('../../node/mbar-server')
if (emulator !== Boolean(process.env.FIRESTORE_EMULATOR_HOST)) throw Error('Ambiente Firestore non coerente')
if (emulator && process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180') throw Error('Emulatore non valido')
const require = createRequire(new URL('../package.json', import.meta.url))
const { initializeApp, cert, deleteApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const credentials = emulator ? null : JSON.parse(readFileSync(resolve(server, 'configs/mpos.json')))
if (credentials && credentials.project_id !== 'mpos-dbce8') throw Error('Progetto non valido')
if (apply && !emulator) {
  const running = await new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: 8088 })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
  if (running) throw Error('Fermare il server prima della conversione del formato Firestore')
}
const app = initializeApp(emulator ? { projectId: 'demo-pmsweb-deposits' } : { credential: cert(credentials) }, 'migrate-cloud-deposits')
try {
  const db = getFirestore(app)
  const snapshot = await db.collection('pms_hotel_reservations').get()
  let count = 0
  let bookings = 0
  for (const entry of snapshot.docs) {
    const booking = entry.data()
    if (!Object.hasOwn(booking, 'deposits')) continue
    if (!Array.isArray(booking.deposits) || !Number.isSafeInteger(booking.revision)) throw Error(`Formato non valido: ${entry.id}`)
    const ids = new Set()
    const batch = db.batch()
    for (const [position, deposit] of booking.deposits.entries()) {
      if (!deposit.id || ids.has(deposit.id)) throw Error(`Identificativo acconto non valido: ${entry.id}`)
      ids.add(deposit.id)
      batch.create(entry.ref.collection('deposits').doc(deposit.id), {
        ...deposit,
        fiscal_status: deposit.annulled ? 'cancelled' : deposit.document_id ? 'issued' : Number(deposit.invoice_progressive) > 0 ? 'external' : 'pending',
        position, reservation_revision: booking.revision, fiscal_requested: false
      })
      count++
    }
    batch.update(entry.ref, { deposits: FieldValue.delete() })
    if (apply) await batch.commit()
    bookings++
  }
  console.log(JSON.stringify({ apply, project: emulator ? 'demo-pmsweb-deposits' : credentials.project_id, bookings, deposits: count }))
} finally { await deleteApp(app) }
