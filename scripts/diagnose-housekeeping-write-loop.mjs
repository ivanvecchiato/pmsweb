import { initializeApp, deleteApp } from 'firebase/app'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  setDoc
} from 'firebase/firestore'

// Riproduce la sincronizzazione del commit 5e5a03a e quella attuale su un emulatore locale.
// Le scritture di preparazione sono escluse dal conteggio; non usa credenziali di produzione.
const projectId = 'demo-housekeeping'
const app = initializeApp({ projectId, appId: 'diagnostic', apiKey: 'demo' })
const db = getFirestore(app)
connectFirestoreEmulator(db, '127.0.0.1', 8787)

const roomCount = Number(process.argv[2] || 8)
const mode = process.argv[3] || 'old'
if (!Number.isInteger(roomCount) || roomCount < 1 || !['old', 'new'].includes(mode)) {
  throw new Error('Uso: node scripts/diagnose-housekeeping-write-loop.mjs <numero camere> <old|new>')
}
const generatedRooms = Array.from({ length: roomCount }, (_, index) => ({
  id: index + 1,
  room_code: String(index + 1),
  floor: 1,
  room_type: { label: 'FM' },
  reservation: { id: 'reservation_' + (index + 1), status: 1, checkin: '2026-09-26', checkout: '2026-09-27' }
}))

console.error('Clearing emulator')
await fetch('http://127.0.0.1:8787/emulator/v1/projects/demo-housekeeping/databases/(default)/documents', { method: 'DELETE' })
console.error('Populating emulator')
for (const room of generatedRooms) {
  await setDoc(doc(db, 'housekeeping_rooms', 'room_' + room.id), {
    roomId: String(room.id),
    roomCode: room.room_code,
    floor: '1',
    roomType: 'FM',
    reservationId: room.reservation.id,
    reservationStatus: 0,
    guestName: '',
    checkin: room.reservation.checkin,
    checkout: room.reservation.checkout,
    status: 'ready'
  })
}
console.error('Opening listener')

let rooms = []
let roomDocuments = []
let loaded = false
let writes = 0
let completed = 0
let callbacks = 0
let lastActivity = Date.now()
let limitHit = false
let resolveFirst
const firstSnapshot = new Promise(resolve => { resolveFirst = resolve })

const seedRooms = async () => {
  if (!loaded) return
  for (const room of rooms) {
    const current = roomDocuments.find(item => item.roomId === String(room.id))
    const data = {
      roomId: String(room.id),
      roomCode: room.room_code,
      floor: '1',
      roomType: 'FM',
      reservationId: room.reservation.id,
      reservationStatus: 1,
      guestName: '',
      checkin: room.reservation.checkin,
      checkout: room.reservation.checkout
    }
    if (Object.entries(data).some(([key, value]) => current?.[key] !== value)) {
      if (writes >= 1000) { limitHit = true; return }
      writes++
      lastActivity = Date.now()
      await setDoc(doc(db, 'housekeeping_rooms', 'room_' + room.id), data, { merge: true })
      completed++
      lastActivity = Date.now()
    }
  }
}

const onRoomsSnapshot = snapshot => {
  callbacks++
  lastActivity = Date.now()
  if (mode === 'new' && (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)) return
  roomDocuments = snapshot.docs.map(item => ({ ...item.data(), documentId: item.id }))
  const initial = !loaded
  loaded = true
  if (snapshot.size === roomCount && (mode === 'old' || (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites))) resolveFirst()
  if (mode === 'old') seedRooms()
  else if (initial) seedRooms()
}
const unsubscribe = mode === 'old'
  ? onSnapshot(collection(db, 'housekeeping_rooms'), onRoomsSnapshot, error => console.error('Listener error', error))
  : onSnapshot(collection(db, 'housekeeping_rooms'), { includeMetadataChanges: true }, onRoomsSnapshot, error => console.error('Listener error', error))

await firstSnapshot
console.error('Initial populated snapshot received')
rooms = generatedRooms
const started = Date.now()
await seedRooms()
while (Date.now() - lastActivity < 1000 && Date.now() - started < 20000 && !limitHit) {
  await new Promise(resolve => setTimeout(resolve, 100))
}
unsubscribe()
console.log(JSON.stringify({ mode, roomCount, writes, completed, callbacks, limitHit }))
await deleteApp(app)
