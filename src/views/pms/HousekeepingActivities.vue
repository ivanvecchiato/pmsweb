<template>
  <div class="activities-page">
    <header>
      <div>
        <h1>Registro pulizie</h1>
        <p>Attività e segnalazioni registrate dalla webapp della governante.</p>
      </div>
      <div class="day-controls">
        <label for="activity-day">Giorno</label>
        <input id="activity-day" v-model="day" type="date" />
        <button type="button" :disabled="loading" @click="loadActivities">Aggiorna</button>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="summary">
      <span><strong>{{ cleaningCount }}</strong> pulizie</span>
      <span><strong>{{ inProgressCount }}</strong> in corso</span>
      <span><strong>{{ noteCount }}</strong> note e segnalazioni</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Camera</th><th>Attività</th><th>Inizio</th><th>Fine</th><th>Note e segnalazioni</th></tr></thead>
        <tbody>
          <tr v-for="activity in rows" :key="activity.id">
            <td><strong>{{ activity.roomCode }}</strong><small>{{ activity.roomType }}<span v-if="activity.floor"> · Piano {{ activity.floor }}</span></small></td>
            <td><span v-if="activity.kind === 'cleaning' && !activity.endedAt" class="in-progress">In corso</span><span v-else>{{ activity.kind === 'cleaning' ? 'Conclusa' : activity.kind === 'fault' ? 'Segnalazione' : 'Nota' }}</span></td>
            <td>{{ activity.kind === 'cleaning' ? formatTime(activity.time) : '—' }}</td>
            <td>{{ activity.kind === 'cleaning' ? (activity.endedAt ? formatTime(activity.endedAt) : '—') : '—' }}</td>
            <td><div v-for="(note, index) in activity.notes" :key="index" class="note"><strong>{{ note.kind === 'fault' ? 'Segnalazione' : 'Nota' }}</strong> {{ note.text }}<small v-if="activity.kind !== 'cleaning'">{{ formatTime(activity.time) }}</small></div><span v-if="!activity.notes.length">—</span></td>
          </tr>
          <tr v-if="!loading && !rows.length"><td colspan="5" class="empty">Nessuna attività per il giorno selezionato.</td></tr>
          <tr v-if="loading"><td colspan="5" class="empty">Caricamento attività…</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import axios from 'axios'
import { useAuth } from '@/composables/useAuth'

const { currentUser } = useAuth()
const day = ref(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
const rows = ref([])
const loading = ref(false)
const error = ref('')
let refreshInterval = null

const cleaningCount = computed(() => rows.value.filter(item => item.kind === 'cleaning').length)
const inProgressCount = computed(() => rows.value.filter(item => item.kind === 'cleaning' && !item.endedAt).length)
const noteCount = computed(() => rows.value.reduce((count, item) => count + item.notes.length, 0))
const formatTime = value => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

const loadActivities = async () => {
  if (!day.value || loading.value) return
  const requestedDay = day.value
  loading.value = true
  error.value = ''
  try {
    const response = await axios.get('/api/pms/housekeeping/activities', {
      params: { day: requestedDay },
      headers: { Authorization: `Bearer ${currentUser.value?.token || ''}` },
      mbarDirect: true
    })
    if (day.value === requestedDay) rows.value = response.data.rows
  } catch (cause) {
    if (day.value === requestedDay) {
      rows.value = []
      error.value = cause.response?.data?.error || 'Registro pulizie non disponibile.'
    }
  } finally {
    loading.value = false
    if (day.value !== requestedDay) loadActivities()
  }
}

watch(day, loadActivities)
onMounted(() => {
  loadActivities()
  refreshInterval = window.setInterval(loadActivities, 30000)
})
onUnmounted(() => { if (refreshInterval) window.clearInterval(refreshInterval) })
</script>

<style scoped>
.activities-page { padding: 24px; color: var(--ds-text); }
header, .day-controls, .summary { display: flex; align-items: center; gap: 12px; }
header { justify-content: space-between; flex-wrap: wrap; margin-bottom: 20px; }
h1 { margin: 0 0 6px; font-size: 1.7rem; }
header p { margin: 0; color: var(--ds-text-soft); }
.day-controls label { font-size: .85rem; }
.day-controls input, .day-controls button { min-height: 38px; padding: 7px 11px; border: 1px solid var(--ds-border); border-radius: 8px; background: white; color: inherit; font: inherit; }
.day-controls button { cursor: pointer; }
.summary { flex-wrap: wrap; margin-bottom: 18px; }
.summary span { padding: 10px 14px; border: 1px solid var(--ds-border); border-radius: 9px; background: white; }
.summary strong { font-size: 1.1rem; }
.error { padding: 14px; border-radius: 9px; background: #fff0ef; color: #a3342b; }
.table-wrap { overflow-x: auto; border: 1px solid var(--ds-border); border-radius: 12px; background: white; }
table { width: 100%; border-collapse: collapse; font-size: .88rem; }
th, td { padding: 13px 15px; border-bottom: 1px solid var(--ds-border); text-align: left; vertical-align: top; }
th { color: var(--ds-text-soft); font-size: .78rem; white-space: nowrap; }
td small { display: block; margin-top: 3px; color: var(--ds-text-soft); }
.in-progress { color: #755ab2; font-weight: 700; }
.note + .note { margin-top: 8px; }
.note strong { margin-right: 4px; }
.empty { padding: 28px; text-align: center; color: var(--ds-text-soft); }
@media (max-width: 600px) { .activities-page { padding: 14px; } .day-controls { width: 100%; flex-wrap: wrap; } }
</style>
