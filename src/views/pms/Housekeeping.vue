<template>
  <div class="housekeeping-page">
    <header>
      <div>
        <h1>Piano pulizie</h1>
        <p>Stato delle camere condiviso con Mood in tempo reale.</p>
      </div>
      <button type="button" class="refresh-button" :disabled="loadingRooms" @click="loadRooms">{{ loadingRooms ? 'Aggiornamento…' : 'Aggiorna camere' }}</button>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div class="filters">
      <button v-for="filter in filters" :key="filter.value" type="button" :class="{ selected: statusFilter === filter.value }" @click="statusFilter = filter.value">
        {{ filter.label }} <span>{{ count(filter.value) }}</span>
      </button>
      <input v-model.trim="search" type="search" placeholder="Cerca camera o ospite" aria-label="Cerca camera o ospite" />
    </div>

    <p v-if="!loaded" class="empty">Caricamento piano pulizie…</p>
    <p v-else-if="!visibleRooms.length" class="empty">Nessuna camera per i filtri selezionati.</p>
    <div v-else class="room-grid">
      <article v-for="room in visibleRooms" :key="room.roomId" class="room-card" :class="`status-${room.status}`">
        <div class="room-heading">
          <div><strong>{{ room.roomCode }}</strong><small>{{ room.roomType }}<span v-if="room.floor"> · Piano {{ room.floor }}</span></small></div>
          <span class="status-badge">{{ statusLabel(room.status) }}</span>
        </div>
        <p class="guest">{{ room.guestName || 'Nessun ospite associato' }}</p>
        <p v-if="room.checkin || room.checkout" class="dates">{{ formatDate(room.checkin) }} → {{ formatDate(room.checkout) }}</p>
        <p v-if="room.note" class="note">{{ room.note }}</p>
        <div class="actions">
          <button v-if="room.status === 'dirty'" type="button" :disabled="saving === room.roomId" @click="updateStatus(room, 'cleaning', room.note)">Avvia</button>
          <button v-if="room.status === 'cleaning'" type="button" :disabled="saving === room.roomId" @click="updateStatus(room, 'ready', room.note)">Pronta</button>
          <button v-if="room.status === 'maintenance' || room.status === 'maintenance_req'" type="button" :disabled="saving === room.roomId" aria-label="Segna intervento risolto" @click="updateStatus(room, 'ready', '')">Risolvi</button>
          <select :value="isMaintenance(room.status) ? 'maintenance' : room.status" :disabled="saving === room.roomId" :aria-label="`Stato camera ${room.roomCode}`" @change="selectStatus(room, $event)">
            <option v-for="status in statuses" :key="status.value" :value="status.value">{{ status.label }}</option>
          </select>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div v-if="maintenanceRoom" class="dialog-backdrop" @click.self="maintenanceRoom = null">
        <form class="dialog" @submit.prevent="saveMaintenance">
          <h2>Manutenzione camera {{ maintenanceRoom.roomCode }}</h2>
          <label for="maintenance-note">Nota per l'intervento</label>
          <textarea id="maintenance-note" v-model="maintenanceNote" rows="4" autofocus></textarea>
          <div class="dialog-actions">
            <button type="button" @click="maintenanceRoom = null">Annulla</button>
            <button type="submit" :disabled="saving === maintenanceRoom.roomId">Salva</button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import axios from 'axios'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useAuth } from '@/composables/useAuth'
import { getFirebaseDb } from '@/services/firebaseClient'

const { currentUser } = useAuth()
const filters = [
  { value: '', label: 'Tutte' },
  { value: 'dirty', label: 'Da pulire' },
  { value: 'cleaning', label: 'In pulizia' },
  { value: 'ready', label: 'Pronte' },
  { value: 'blocked', label: 'Bloccate' },
  { value: 'maintenance', label: 'Manutenzione' }
]
const statuses = [
  { value: 'dirty', label: 'Da pulire' },
  { value: 'cleaning', label: 'In pulizia' },
  { value: 'ready', label: 'Pronta' },
  { value: 'blocked', label: 'Bloccata' },
  { value: 'maintenance', label: 'Manutenzione' }
]
const rooms = ref([])
const roomDocuments = ref([])
const loaded = ref(false)
const loadingRooms = ref(false)
const saving = ref('')
const error = ref('')
const search = ref('')
const statusFilter = ref('')
const maintenanceRoom = ref(null)
const maintenanceNote = ref('')
let unsubscribe = null

const isMaintenance = status => status === 'maintenance' || status === 'maintenance_req'
const isOverRoomType = value => ['over', 'overbooking'].includes(String(value || '').trim().toLowerCase())
const statusLabel = status => statuses.find(item => item.value === status)?.label || (isMaintenance(status) ? 'Manutenzione' : status)
const formatDate = value => {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date)
}
const count = status => roomDocuments.value.filter(room => !status || room.status === status || (status === 'maintenance' && isMaintenance(room.status))).length
const visibleRooms = computed(() => roomDocuments.value
  .filter(room => !statusFilter.value || room.status === statusFilter.value || (statusFilter.value === 'maintenance' && isMaintenance(room.status)))
  .filter(room => `${room.roomCode} ${room.guestName} ${room.roomType}`.toLocaleLowerCase('it').includes(search.value.toLocaleLowerCase('it')))
  .sort((a, b) => String(a.roomCode).localeCompare(String(b.roomCode), 'it', { numeric: true })))

const seedRooms = async () => {
  if (!loaded.value || !rooms.value.length) return
  const db = getFirebaseDb()
  for (const room of rooms.value) {
    if (room.id == null) continue
    const roomId = String(room.id)
    const current = roomDocuments.value.find(item => String(item.roomId) === roomId)
    const reservation = room.reservation
    const guest = reservation?.guests?.[0] || reservation?.accountholder
    const data = {
      roomId,
      roomCode: String(room.room_code || ''),
      floor: String(room.floor || ''),
      roomType: String(room.room_type?.label || ''),
      reservationId: String(reservation?.id || ''),
      reservationStatus: Number(reservation?.status ?? 2),
      guestName: guest ? `${guest.firstname || ''} ${guest.lastname || ''}`.trim() : '',
      checkin: String(reservation?.checkin || ''),
      checkout: String(reservation?.checkout || '')
    }
    if (!current) {
      await setDoc(doc(db, 'housekeeping_rooms', `room_${roomId}`), {
        ...data, status: data.reservationStatus === 2 || data.reservationStatus === 4 ? 'dirty' : 'ready',
        maintenanceRequired: false,
        updatedBy: currentUser.value?.name || '',
        updatedById: currentUser.value?.id || 0,
        updatedAt: serverTimestamp()
      }, { merge: true })
      continue
    }
    if (current.status === 'ready' && current.reservationId !== data.reservationId && (data.reservationStatus === 2 || data.reservationStatus === 4)) data.status = 'dirty'
    if (Object.entries(data).some(([key, value]) => current[key] !== value)) {
      await setDoc(doc(db, 'housekeeping_rooms', current.documentId), data, { merge: true })
    }
  }
}

const loadRooms = async () => {
  loadingRooms.value = true
  error.value = ''
  try {
    const response = await axios.post('/api/pms/getrooms', { includeReservations: true, renew: false }, { mbarDirect: true })
    if (!Array.isArray(response.data)) throw new Error('Elenco camere non valido')
    rooms.value = response.data.filter(room => !isOverRoomType(room.room_type?.label))
    await seedRooms()
  } catch (cause) {
    error.value = `Impossibile aggiornare le camere: ${cause.message}`
  } finally {
    loadingRooms.value = false
  }
}

const updateStatus = async (room, status, note) => {
  saving.value = room.roomId
  error.value = ''
  try {
    await setDoc(doc(getFirebaseDb(), 'housekeeping_rooms', room.documentId), {
      status,
      maintenanceRequired: isMaintenance(status),
      note: note || '',
      updatedBy: currentUser.value?.name || '',
      updatedById: currentUser.value?.id || 0,
      updatedAt: serverTimestamp()
    }, { merge: true })
    maintenanceRoom.value = null
  } catch (cause) {
    error.value = `Impossibile aggiornare la camera ${room.roomCode}: ${cause.message}`
  } finally {
    saving.value = ''
  }
}

const selectStatus = (room, event) => {
  const status = event.target.value
  event.target.value = isMaintenance(room.status) ? 'maintenance' : room.status
  if (status === room.status || (status === 'maintenance' && isMaintenance(room.status))) return
  if (status === 'maintenance') {
    maintenanceRoom.value = room
    maintenanceNote.value = room.note || ''
  } else {
    updateStatus(room, status, status === 'ready' ? '' : room.note)
  }
}

const saveMaintenance = () => {
  if (maintenanceRoom.value) updateStatus(maintenanceRoom.value, 'maintenance', maintenanceNote.value)
}

onMounted(() => {
  try {
    unsubscribe = onSnapshot(collection(getFirebaseDb(), 'housekeeping_rooms'), snapshot => {
      roomDocuments.value = snapshot.docs.map(item => ({ ...item.data(), documentId: item.id }))
        .filter(room => !isOverRoomType(room.roomType))
      loaded.value = true
      seedRooms().catch(cause => { error.value = `Impossibile sincronizzare le camere: ${cause.message}` })
    }, cause => { error.value = `Piano pulizie non disponibile: ${cause.message}` })
    loadRooms()
  } catch (cause) {
    error.value = `Piano pulizie non disponibile: ${cause.message}`
  }
})

onUnmounted(() => { if (unsubscribe) unsubscribe() })
</script>

<style scoped>
.housekeeping-page { padding: 24px; color: var(--ds-text); }
header, .room-heading, .actions, .dialog-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
header { flex-wrap: wrap; margin-bottom: 24px; }
h1 { margin: 0 0 6px; font-size: 1.7rem; }
header p, .room-heading small, .guest, .dates { color: var(--ds-text-soft); }
header p { margin: 0; }
button, select, input, textarea { font: inherit; }
button, select { cursor: pointer; }
.refresh-button, .actions button, .actions select, .dialog-actions button { padding: 9px 12px; border: 1px solid var(--ds-border); border-radius: 8px; background: var(--ds-surface, white); color: inherit; }
button:disabled, select:disabled { opacity: .55; cursor: wait; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.filters button { padding: 10px 13px; border: 1px solid var(--ds-border); border-radius: 10px; background: var(--ds-surface, white); color: inherit; }
.filters button.selected { border-color: #335f93; background: #eaf2fc; }
.filters span { margin-left: 5px; font-weight: 700; }
.filters input { min-width: 210px; flex: 1; padding: 10px 12px; border: 1px solid var(--ds-border); border-radius: 10px; background: var(--ds-surface, white); color: inherit; }
.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }
.room-card { padding: 17px; border: 1px solid var(--ds-border); border-radius: 12px; background: var(--ds-surface, white); }
.status-dirty .status-badge { background: #dd8529; }
.status-cleaning .status-badge { background: #8567c9; }
.status-blocked .status-badge { background: #cb5555; }
.status-maintenance .status-badge, .status-maintenance_req .status-badge { background: #f2c94c; color: #3b3000; }
.room-heading strong { display: block; font-size: 1.25rem; }
.room-heading small { display: block; margin-top: 3px; }
.status-badge { padding: 5px 8px; border-radius: 6px; background: #33a06f; color: white; font-size: .78rem; white-space: nowrap; }
.guest { margin: 18px 0 4px; }
.dates { margin: 0 0 12px; font-size: .85rem; }
.note { margin: 10px 0; padding: 10px; border-radius: 7px; background: #fff4e7; white-space: pre-wrap; }
.actions { justify-content: flex-end; flex-wrap: nowrap; margin-top: 18px; }
.actions select { flex: 0 1 150px; min-width: 0; }
.actions button, .dialog-actions button[type='submit'] { background: #285e99; border-color: #285e99; color: white; }
.empty, .error { padding: 20px; border-radius: 10px; background: var(--ds-surface, white); }
.error { margin-bottom: 16px; color: #a72d2d; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 20px; overflow-y: auto; background: #17233499; }
.dialog { width: min(100%, 440px); max-height: calc(100dvh - 40px); box-sizing: border-box; overflow-y: auto; padding: 24px; border-radius: 14px; background: white; color: #172334; }
.dialog h2 { margin: 0 0 18px; font-size: 1.2rem; }
.dialog label { display: block; margin-bottom: 8px; }
.dialog textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #aeb6c2; border-radius: 8px; resize: vertical; }
.dialog-actions { justify-content: flex-end; margin-top: 16px; }
@media (max-width: 600px) { .housekeeping-page { padding: 14px; } .filters input { width: 100%; } }
</style>
