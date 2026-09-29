<template>
  <div class="events-page">
    <header><h1>Registro eventi hotel</h1><p>Operazioni registrate dal server. Gli eventi restano disponibili anche dopo l’eliminazione della prenotazione.</p></header>
    <p v-if="warning" class="notice" role="alert">{{ warning.message }} Ultima segnalazione: {{ formatTime(warning.time) }}. L’operazione non va ripetuta per questo motivo.</p>
    <form @submit.prevent="loadEvents(false)">
      <fieldset :disabled="loading" class="filters">
        <label>Dal<input v-model="filters.from" type="date" /></label>
        <label>Al<input v-model="filters.to" type="date" /></label>
        <label>Operatore<select v-model="filters.operator"><option value="">Tutti</option><option v-for="operator in operators" :key="operator.id" :value="String(operator.id)">{{ operator.name }}</option></select></label>
        <label>Prenotazione<input v-model.trim="filters.reservation_id" type="search" placeholder="ID prenotazione" /></label>
        <label>Camera<select v-model="filters.roomId"><option value="">Tutte</option><option v-for="room in rooms" :key="room.id" :value="String(room.id)">{{ room.room_code }}</option></select></label>
        <label>Operazione<select v-model="filters.type"><option value="">Tutte</option><option v-for="(label, code) in types" :key="code" :value="code">{{ label }}</option></select></label>
        <button class="btn btn-primary" type="submit">{{ loading ? 'Caricamento…' : 'Cerca' }}</button>
      </fieldset>
    </form>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <div class="events-table-wrap">
      <table><thead><tr><th>Data e ora</th><th>Operatore</th><th>Prenotazione</th><th>Camera</th><th>Operazione</th><th>Descrizione e dati</th></tr></thead>
        <tbody><tr v-for="event in events" :key="event.id">
          <td>{{ formatTime(event.time) }}</td>
          <td>{{ event.operator == null ? (event.source === 'h5s' ? 'H5S' : event.source === 'system' ? 'Sistema' : 'Non comunicato') : operators.find(item => String(item.id) === String(event.operator))?.name || `Operatore ${event.operator}` }}<small>{{ event.source === 'h5s' ? 'Sincronizzazione automatica' : event.source === 'bar' ? 'Bar' : '' }}</small></td>
          <td>{{ event.reservation_id || '—' }}</td>
          <td>{{ event.roomId == null ? '—' : rooms.find(item => String(item.id) === event.roomId)?.room_code || `Camera ${event.roomId}` }}</td>
          <td>{{ types[event.type] || event.type }}<small>{{ event.type }}</small></td>
          <td>{{ event.explanation }}<details v-if="event.data"><summary>Dati dell’operazione</summary><pre>{{ JSON.stringify(event.data, null, 2) }}</pre></details></td>
        </tr><tr v-if="!loading && !events.length"><td colspan="6" class="empty">Nessun evento per i filtri selezionati.</td></tr></tbody>
      </table>
    </div>
    <button v-if="nextCursor" class="btn btn-secondary more" :disabled="loading" @click="loadEvents(true)">{{ loading ? 'Caricamento…' : 'Carica altri eventi' }}</button>
    <p class="retention">Conservazione senza cancellazione automatica. Gli eventi sono inclusi nei backup del server.</p>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const { currentUser } = useAuth()
const filters = reactive({ from: '', to: '', operator: '', reservation_id: String(route.query.reservation_id || ''), roomId: '', type: '' })
const events = ref([])
const operators = ref([])
const rooms = ref([])
const types = ref({})
const nextCursor = ref(null)
const loading = ref(false)
const error = ref('')
const warning = ref(null)
const formatTime = time => new Date(time).toLocaleString('it-IT')

const loadEvents = async (append = false) => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  if (!append) events.value = []
  try {
    const params = { limit: 50 }
    for (const key of ['operator', 'reservation_id', 'roomId', 'type']) if (filters[key]) params[key] = filters[key]
    if (filters.from) params.from = new Date(`${filters.from}T00:00:00`).getTime()
    if (filters.to) {
      const end = new Date(`${filters.to}T00:00:00`)
      end.setDate(end.getDate() + 1)
      params.to = end.getTime()
    }
    if (append && nextCursor.value) params.before = nextCursor.value
    const { data } = await axios.get('/api/pms/hotel/events', {
      params,
      headers: { Authorization: `Bearer ${currentUser.value?.token || ''}` },
      mbarDirect: true
    })
    events.value = append ? [...events.value, ...data.events] : data.events
    nextCursor.value = data.nextCursor
    types.value = data.types
    operators.value = data.operators
    warning.value = data.warning
  } catch (cause) {
    error.value = cause.response?.data?.error || 'Registro non disponibile. Verificare il collegamento con il server.'
    nextCursor.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const response = await axios.post('/api/pms/getrooms', { includeReservations: false, renew: false }, { mbarDirect: true })
    rooms.value = response.data
  } catch {}
  await loadEvents()
})
</script>

<style scoped>
.events-page { padding: 24px; color: var(--ds-text); }
h1 { margin: 0 0 8px; font-size: 1.6rem; }
header p, .retention { color: var(--ds-text-soft); font-size: .88rem; }
.filters { display: flex; align-items: end; flex-wrap: wrap; gap: 12px; margin: 24px 0; padding: 0; border: 0; }
label { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; }
input, select { min-height: 38px; max-width: 220px; padding: 8px; border: 1px solid var(--ds-border); border-radius: 8px; background: var(--ds-surface, white); color: inherit; }
.events-table-wrap { overflow-x: auto; border: 1px solid var(--ds-border); border-radius: 12px; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--ds-border); vertical-align: top; }
th { color: var(--ds-text-soft); white-space: nowrap; }
small { display: block; margin-top: 5px; color: var(--ds-text-soft); }
details { margin-top: 10px; }
summary { cursor: pointer; }
pre { max-width: 480px; max-height: 350px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .78rem; }
.notice { padding: 14px; border: 1px solid #c58a24; border-radius: 8px; background: #fff4db; color: #684713; }
.empty { padding: 28px; text-align: center; color: var(--ds-text-soft); }
.more { margin-top: 20px; }
.retention { margin-top: 22px; }
@media (max-width: 700px) { .events-page { padding: 12px; } .filters label { flex: 1 1 140px; } input, select { max-width: 100%; } }
</style>
