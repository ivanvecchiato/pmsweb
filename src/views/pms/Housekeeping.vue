<template>
  <div class="housekeeping-page">
    <header>
      <div>
        <h1>Piano pulizie</h1>
      </div>
      <div class="header-actions">
        <router-link v-if="currentUser?.role === 'admin'" to="/housekeeping/activities" class="refresh-button">Registro pulizie</router-link>
        <button type="button" class="refresh-button" :disabled="loadingRooms" @click="loadRooms">{{ loadingRooms ? 'Aggiornamento…' : 'Aggiorna camere' }}</button>
      </div>
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
      <article v-for="room in visibleRooms" :key="room.roomId" class="room-card" :class="[`status-${room.status}`, { 'menu-open': openMenuRoomId === room.roomId }]">
        <div class="room-heading">
          <div><strong>{{ room.roomCode }}</strong><small>{{ room.roomType }}<span v-if="room.floor"> · Piano {{ room.floor }}</span></small></div>
          <div class="status-control" @keydown.esc.stop="openMenuRoomId = ''">
            <button type="button" class="status-badge" :disabled="saving === room.roomId" :aria-label="`Stato camera ${room.roomCode}: ${statusLabel(room.status)}`" :aria-expanded="openMenuRoomId === room.roomId" @click="openMenuRoomId = openMenuRoomId === room.roomId ? '' : room.roomId">
              {{ statusLabel(room.status) }}<span class="chevron" aria-hidden="true">⌄</span>
            </button>
            <div v-if="openMenuRoomId === room.roomId" class="status-menu">
              <button v-for="status in statuses.filter(item => ['dirty', 'blocked', 'maintenance'].includes(item.value) && item.value !== (isMaintenance(room.status) ? 'maintenance' : room.status))" :key="status.value" type="button" :class="`status-option-${status.value}`" @click="selectStatus(room, status.value)"><span class="status-icon" aria-hidden="true"></span>{{ status.value === 'blocked' ? 'Blocca' : status.label }}</button>
            </div>
          </div>
        </div>
        <p class="guest">{{ room.guestName || 'Nessun ospite associato' }}</p>
        <p v-if="room.checkin || room.checkout" class="dates">{{ formatDate(room.checkin) }} → {{ formatDate(room.checkout) }}</p>
        <p v-if="room.note" class="note">{{ room.note }}</p>
      </article>
    </div>

    <Teleport to="body">
      <div v-if="maintenanceRoom" class="dialog-backdrop" @click.self="maintenanceRoom = null">
        <form class="dialog" @submit.prevent="saveMaintenance">
          <h2>Manutenzione camera {{ maintenanceRoom.roomCode }}</h2>
          <label for="maintenance-note">Nota per l'intervento</label>
          <textarea id="maintenance-note" v-model="maintenanceNote" rows="4" autofocus></textarea>
          <p v-if="error" class="dialog-error" role="alert">{{ error }}</p>
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
  { value: 'blocked', label: 'Bloccata' },
  { value: 'dirty', label: 'Da pulire' },
  { value: 'maintenance', label: 'Manutenzione' },
  { value: 'cleaning', label: 'In pulizia' },
  { value: 'ready', label: 'Pronta' }
]
const rooms = ref([])
const roomDocuments = ref([])
const loaded = ref(false)
const loadingRooms = ref(false)
const saving = ref('')
const error = ref('')
const search = ref('')
const statusFilter = ref('')
const openMenuRoomId = ref('')
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
  if (loadingRooms.value) return
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
  if (!['dirty', 'blocked', 'maintenance'].includes(status)) return
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
    error.value = cause.code === 'resource-exhausted'
      ? 'Stato non salvato: limite del servizio raggiunto. Riprova più tardi.'
      : `Impossibile aggiornare la camera ${room.roomCode}: ${cause.message}`
  } finally {
    saving.value = ''
  }
}

const selectStatus = (room, status) => {
  openMenuRoomId.value = ''
  if (!['dirty', 'blocked', 'maintenance'].includes(status)) return
  if (status === room.status || (status === 'maintenance' && isMaintenance(room.status))) return
  if (status === 'maintenance') {
    maintenanceRoom.value = room
    maintenanceNote.value = room.note || ''
  } else {
    updateStatus(room, status, room.note)
  }
}

const saveMaintenance = () => {
  if (maintenanceRoom.value) updateStatus(maintenanceRoom.value, 'maintenance', maintenanceNote.value)
}

const closeStatusMenu = event => {
  if (!event.target.closest('.status-control')) openMenuRoomId.value = ''
}

onMounted(() => {
  document.addEventListener('pointerdown', closeStatusMenu)
  try {
    unsubscribe = onSnapshot(collection(getFirebaseDb(), 'housekeeping_rooms'), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return
      roomDocuments.value = snapshot.docs.map(item => ({ ...item.data(), documentId: item.id }))
        .filter(room => !isOverRoomType(room.roomType))
      const firstSnapshot = !loaded.value
      loaded.value = true
      if (firstSnapshot) loadRooms()
    }, cause => { error.value = `Piano pulizie non disponibile: ${cause.message}` })
  } catch (cause) {
    error.value = `Piano pulizie non disponibile: ${cause.message}`
  }
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeStatusMenu)
  if (unsubscribe) unsubscribe()
})
</script>

<style scoped>
.housekeeping-page { padding: 24px; color: var(--ds-text); }
header, .header-actions, .room-heading, .dialog-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
header { flex-wrap: wrap; margin-bottom: 24px; }
.header-actions { flex-wrap: wrap; }
h1 { margin: 0 0 6px; font-size: 1.7rem; }
header p, .room-heading small, .guest, .dates { color: var(--ds-text-soft); }
header p { margin: 0; }
button, select, input, textarea { font: inherit; }
button, select { cursor: pointer; }
.refresh-button, .dialog-actions button { padding: 9px 12px; border: 1px solid var(--ds-border); border-radius: 8px; background: var(--ds-surface, white); color: inherit; text-decoration: none; }
button:disabled, select:disabled { opacity: .55; cursor: wait; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.filters button { padding: 10px 13px; border: 1px solid var(--ds-border); border-radius: 10px; background: var(--ds-surface, white); color: inherit; }
.filters button.selected { border-color: #335f93; background: #eaf2fc; }
.filters span { margin-left: 5px; font-weight: 700; }
.filters input { min-width: 210px; flex: 1; padding: 10px 12px; border: 1px solid var(--ds-border); border-radius: 10px; background: var(--ds-surface, white); color: inherit; }
.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }
.room-card { position: relative; padding: 17px; border: 1px solid var(--ds-border); border-radius: 12px; background: var(--ds-surface, white); }
.room-card.menu-open { z-index: 2; }
.status-dirty .status-badge { background: #dd8529; }
.status-cleaning .status-badge { background: #8567c9; }
.status-blocked .status-badge { background: #cb5555; }
.status-maintenance .status-badge, .status-maintenance_req .status-badge { background: #f2c94c; color: #3b3000; }
.room-heading strong { display: block; font-size: 1.25rem; }
.room-heading small { display: block; margin-top: 3px; }
.status-control { position: relative; flex: none; }
.status-badge { display: inline-flex; align-items: center; gap: 7px; padding: 5px 8px; border: 0; border-radius: 6px; background: #33a06f; color: white; font-size: .78rem; white-space: nowrap; }
.chevron { font-size: .95rem; line-height: .7; }
.status-menu { position: absolute; top: calc(100% + 6px); right: 0; min-width: 190px; padding: 5px; border: 1px solid var(--ds-border); border-radius: 9px; background: var(--ds-surface, white); color: var(--ds-text); box-shadow: 0 8px 24px #17233426; }
.status-menu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; border-radius: 6px; background: transparent; text-align: left; white-space: nowrap; }
.status-icon { width: 22px; height: 22px; flex: none; background: currentColor; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
.status-option-blocked { color: #d32f2f; }
.status-option-blocked .status-icon { -webkit-mask-image: url('../../assets/housekeeping-lock.png'); mask-image: url('../../assets/housekeeping-lock.png'); }
.status-option-dirty { color: #f57c00; }
.status-option-dirty .status-icon { -webkit-mask-image: url('../../assets/housekeeping-broom.png'); mask-image: url('../../assets/housekeeping-broom.png'); }
.status-option-maintenance { color: #836300; }
.status-option-maintenance .status-icon { background: #f2c94c; -webkit-mask-image: url('../../assets/housekeeping-gear.png'); mask-image: url('../../assets/housekeeping-gear.png'); }
.status-menu button:hover, .status-menu button:focus-visible { background: #eaf2fc; }
.status-menu .status-option-maintenance:hover, .status-menu .status-option-maintenance:focus-visible { background: #fff9e6; }
.guest { margin: 18px 0 4px; }
.dates { margin: 0 0 12px; font-size: .85rem; }
.note { margin: 10px 0; padding: 10px; border-radius: 7px; background: #fff4e7; white-space: pre-wrap; }
.dialog-actions button[type='submit'] { background: #285e99; border-color: #285e99; color: white; }
.empty, .error { padding: 20px; border-radius: 10px; background: var(--ds-surface, white); }
.error { margin-bottom: 16px; color: #a72d2d; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 20px; overflow-y: auto; background: #17233499; }
.dialog { width: min(100%, 440px); max-height: calc(100dvh - 40px); box-sizing: border-box; overflow-y: auto; padding: 24px; border-radius: 14px; background: white; color: #172334; }
.dialog h2 { margin: 0 0 18px; font-size: 1.2rem; }
.dialog label { display: block; margin-bottom: 8px; }
.dialog textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #aeb6c2; border-radius: 8px; resize: vertical; }
.dialog-error { margin: 12px 0 0; color: #a72d2d; }
.dialog-actions { justify-content: flex-end; margin-top: 16px; }
@media (max-width: 600px) { .housekeeping-page { padding: 14px; } .filters input { width: 100%; } }
</style>
