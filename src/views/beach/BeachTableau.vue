<script setup>
import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { isFirebaseRemoteMode } from '@/services/firebaseClient'
import { getBeachReservationsForDate } from '@/services/beachReservations'
import BeachBookingPlanner from './BeachBookingPlanner.vue'

const route = useRoute()
const router = useRouter()
const activeTab = computed(() => route.query.tab === 'tableau' ? 'tableau' : 'mappa')
const today = new Date()
const selectedDate = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
const zones = ref([])
const loading = ref(false)
const error = ref('')

const places = computed(() => zones.value.flatMap(zone => zone.rows.flatMap(row => row.places.filter(Boolean))))
const occupied = computed(() => places.value.filter(place => place.reservation).length)

const loadPlan = async () => {
  loading.value = true
  error.value = ''
  try {
    const remote = isFirebaseRemoteMode()
    const response = remote
      ? await axios.get('/api/pms/beach/getplan?mode=zones')
      : await axios.get('/api/pms/beach/getplan', {
          params: { mode: 'zones', includeReservations: true, date: selectedDate.value }
        })
    if (!Array.isArray(response.data) || response.data.some(zone => !Array.isArray(zone.rows))) {
      throw new Error('Formato del piano spiaggia non valido')
    }
    if (remote) {
      const reservations = await getBeachReservationsForDate(selectedDate.value)
      zones.value = response.data.map(zone => ({ ...zone, rows: zone.rows.map(row => ({
        ...row,
        places: row.places.map(place => place && reservations.has(place.id)
          ? { ...place, reservation: reservations.get(place.id) }
          : place)
      })) }))
    } else {
      zones.value = response.data
    }
  } catch (cause) {
    zones.value = []
    error.value = cause.message || 'Impossibile caricare il piano spiaggia'
  } finally {
    loading.value = false
  }
}

watch([selectedDate, activeTab], () => {
  if (activeTab.value === 'mappa') loadPlan()
}, { immediate: true })
</script>

<template>
  <div class="beach-tableau">
    <div class="plan-tabs" role="tablist" aria-label="Viste piano spiaggia">
      <button type="button" role="tab" id="beach-map-tab" aria-controls="beach-map-panel"
        :aria-selected="activeTab === 'mappa'" :class="['plan-tab', { active: activeTab === 'mappa' }]"
        @click="router.replace('/beach-tableau')">Mappa</button>
      <button type="button" role="tab" id="beach-planner-tab" aria-controls="beach-planner-panel"
        :aria-selected="activeTab === 'tableau'" :class="['plan-tab', { active: activeTab === 'tableau' }]"
        @click="router.replace('/beach-tableau?tab=tableau')">Tableau</button>
    </div>

    <BeachBookingPlanner v-if="activeTab === 'tableau'" id="beach-planner-panel" role="tabpanel" aria-labelledby="beach-planner-tab" />
    <template v-else>
    <header class="tableau-header">
      <div>
        <h2>Piano spiaggia</h2>
        <p>Zone, file e posti disponibili nella data selezionata.</p>
      </div>
      <div class="tableau-actions">
        <label for="beach-tableau-date">Data</label>
        <input id="beach-tableau-date" v-model="selectedDate" type="date" />
      </div>
    </header>

    <div id="beach-map-panel" role="tabpanel" aria-labelledby="beach-map-tab" class="map-panel-content">
    <div v-if="error" class="tableau-state error" role="alert">{{ error }}</div>
    <div v-else-if="loading" class="tableau-state">Caricamento piano spiaggia...</div>
    <template v-else>
      <div class="tableau-summary">
        <span>{{ zones.length }} zone</span>
        <span>{{ places.length }} posti</span>
        <span>{{ occupied }} occupati</span>
        <span>{{ places.length - occupied }} liberi</span>
      </div>
      <div v-if="!zones.length" class="tableau-state">Nessuna zona configurata.</div>
      <section v-for="zone in zones" :key="zone.id" class="zone-card">
        <header class="zone-header">
          <div>
            <span class="zone-code">{{ zone.code }}</span>
            <h3>{{ zone.name }}</h3>
          </div>
          <span>{{ zone.rows.length }} file · {{ zone.rows[0]?.places.length || 0 }} colonne</span>
        </header>
        <div class="zone-grid">
          <div class="sea-line">MARE</div>
          <div
            v-for="(row, rowIndex) in zone.rows"
            :key="rowIndex"
            class="plan-row"
            :style="{ gridTemplateColumns: `minmax(100px, 150px) repeat(${row.places.length}, minmax(64px, 1fr))` }"
          >
            <div class="row-label">
              <strong>Fila {{ rowIndex + 1 }}</strong>
              <small>{{ row.place_type.description }}</small>
            </div>
            <div
              v-for="(place, columnIndex) in row.places"
              :key="place?.id || `empty-${columnIndex}`"
              class="place"
              :class="{ occupied: place?.reservation, empty: !place }"
              :title="place ? `${place.name || `${zone.code}${rowIndex + 1}-${columnIndex + 1}`} · ${place.reservation ? 'Occupato' : 'Libero'}` : 'Nessun posto'"
            >
              <template v-if="place">
                <strong>{{ place.name || `${zone.code}${rowIndex + 1}-${columnIndex + 1}` }}</strong>
                <small>{{ place.place_type?.label || row.place_type.label }}</small>
              </template>
            </div>
          </div>
        </div>
      </section>
    </template>
    </div>
    </template>
  </div>
</template>

<style scoped>
.beach-tableau { display: grid; gap: 22px; padding: 8px; color: var(--ds-text, #172033); }
.plan-tabs { width: fit-content; display: flex; gap: 4px; padding: 4px; border: 1px solid #e2e8f0; border-radius: 18px; background: #f8fafc; }
.plan-tab { min-height: 42px; border: 1px solid transparent; border-radius: 14px; padding: 0 18px; background: transparent; color: #64748b; font-weight: 800; cursor: pointer; }
.plan-tab.active { background: white; color: #0f766e; box-shadow: 0 12px 22px rgba(15, 23, 42, 0.08); }
.map-panel-content { display: grid; gap: 22px; }
.tableau-header, .zone-header, .tableau-summary, .tableau-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.tableau-header h2, .zone-header h3 { margin: 0; }
.tableau-header p { margin: 5px 0 0; color: var(--ds-text-muted, #64748b); }
.tableau-actions { flex-wrap: wrap; justify-content: flex-end; }
.tableau-actions input, .tableau-actions a { border: 1px solid #cbd5e1; border-radius: 10px; padding: 9px 12px; background: white; color: inherit; text-decoration: none; }
.tableau-actions a { background: #0f766e; color: white; border-color: #0f766e; }
.tableau-summary { justify-content: flex-start; flex-wrap: wrap; }
.tableau-summary span { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 14px; }
.tableau-state, .zone-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; }
.tableau-state.error { color: #b91c1c; }
.zone-card { overflow-x: auto; }
.zone-header { margin-bottom: 18px; }
.zone-header > div { display: flex; align-items: center; gap: 10px; }
.zone-header > span { color: #64748b; }
.zone-code { display: inline-grid; place-items: center; width: 32px; height: 32px; background: #ccfbf1; border-radius: 8px; color: #115e59; font-weight: 700; }
.zone-grid { min-width: max-content; }
.sea-line { text-align: center; padding: 9px; margin-bottom: 16px; background: #dbeafe; color: #075985; border-radius: 8px; font-weight: 700; letter-spacing: .18em; }
.plan-row { display: grid; align-items: stretch; gap: 8px; margin-bottom: 8px; }
.row-label, .place { min-height: 68px; padding: 8px; border-radius: 10px; }
.row-label { display: flex; flex-direction: column; justify-content: center; background: #f1f5f9; }
.row-label small, .place small { color: #64748b; }
.place { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ecfdf5; border: 1px solid #86efac; }
.place.occupied { background: #fef2f2; border-color: #fca5a5; }
.place.empty { background: #f8fafc; border: 1px dashed #cbd5e1; }
@media (max-width: 720px) { .tableau-header { align-items: flex-start; flex-direction: column; } }
</style>
