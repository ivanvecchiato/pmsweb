<template>
  <div class="home-page">
    <div class="home-tabs" role="tablist" aria-label="Home PMS">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'planning'"
        :class="['tab-button', { active: activeTab === 'planning' }]"
        @click="activeTab = 'planning'"
      >
        Planning
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'movements'"
        :class="['tab-button', { active: activeTab === 'movements' }]"
        @click="activeTab = 'movements'"
      >
        Movimenti
      </button>
    </div>

    <HotelBookingPlanner v-if="activeTab === 'planning'" />

    <section v-else class="movements-panel">
      <div class="movements-header">
        <div>
          <h2>Arrivi e partenze</h2>
          <p>{{ formatDisplayDate(selectedDate) }}</p>
        </div>

        <div class="day-selector" role="radiogroup" aria-label="Giorno movimenti">
          <label :class="{ active: dayMode === 'today' }">
            <input v-model="dayMode" type="radio" value="today" />
            Oggi
          </label>
          <label :class="{ active: dayMode === 'tomorrow' }">
            <input v-model="dayMode" type="radio" value="tomorrow" />
            Domani
          </label>
          <label :class="{ active: dayMode === 'custom' }">
            <input v-model="dayMode" type="radio" value="custom" />
            Data
          </label>
          <input
            v-model="customDate"
            class="custom-date-input"
            type="date"
            :min="customMinDate"
            :disabled="dayMode !== 'custom'"
            aria-label="Seleziona data movimenti"
            @focus="dayMode = 'custom'"
          />
        </div>
      </div>

      <div v-if="errorMessage" class="state error">{{ errorMessage }}</div>
      <div v-else-if="isLoading" class="state">Caricamento movimenti...</div>

      <div v-else class="movements-grid">
        <div class="movement-card">
          <div class="movement-card-header">
            <div>
              <h3>Arrivi</h3>
              <span>{{ arrivals.length }}</span>
            </div>
            <button type="button" class="print-button" :disabled="arrivals.length === 0" @click="printReport('arrivals')">
              Stampa
            </button>
          </div>

          <div v-if="arrivals.length === 0" class="empty-state">Nessun arrivo previsto.</div>
          <div v-else class="movement-list">
            <div v-for="booking in arrivals" :key="`arrival-${booking.id}`" class="movement-row">
              <div>
                <strong>{{ booking.customerName || '-' }}</strong>
                <small>#{{ booking.id }}</small>
              </div>
              <div class="movement-meta">
                <span>Stanza {{ booking.resourceLabel || '-' }}</span>
                <span>{{ formatDate(booking.checkin) }} -> {{ formatDate(booking.checkout) }}</span>
              </div>
              <div v-if="booking.notes" class="movement-notes">
                <span>Note</span>
                <p>{{ booking.notes }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="movement-card">
          <div class="movement-card-header">
            <div>
              <h3>Partenze</h3>
              <span>{{ departures.length }}</span>
            </div>
            <button type="button" class="print-button" :disabled="departures.length === 0" @click="printReport('departures')">
              Stampa
            </button>
          </div>

          <div v-if="departures.length === 0" class="empty-state">Nessuna partenza prevista.</div>
          <div v-else class="movement-list">
            <div v-for="booking in departures" :key="`departure-${booking.id}`" class="movement-row">
              <div>
                <strong>{{ booking.customerName || '-' }}</strong>
                <small>#{{ booking.id }}</small>
              </div>
              <div class="movement-meta">
                <span>Stanza {{ booking.resourceLabel || '-' }}</span>
                <span>{{ formatDate(booking.checkin) }} -> {{ formatDate(booking.checkout) }}</span>
              </div>
              <div v-if="booking.notes" class="movement-notes">
                <span>Note</span>
                <p>{{ booking.notes }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import axios from 'axios'
import { computed, onMounted, ref, watch } from 'vue'
import HotelBookingPlanner from './HotelBookingPlanner.vue'

const activeTab = ref('planning')
const dayMode = ref('today')
const customDate = ref('')
const arrivals = ref([])
const departures = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

const toISODate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const selectedDate = computed(() => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (dayMode.value === 'custom') {
    return customDate.value || customMinDate.value
  }
  if (dayMode.value === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  }
  return toISODate(date)
})

const customMinDate = computed(() => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 2)
  return toISODate(date)
})

const toDateOnly = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : toISODate(date)
}

const getCustomerName = (booking) => {
  const holder = booking?.accountholder || {}
  const holderName = [holder.lastname, holder.firstname].filter(Boolean).join(' ').trim()
  if (holderName) return holderName
  const firstGuest = Array.isArray(booking?.guests) ? booking.guests[0] : null
  return [firstGuest?.lastname, firstGuest?.firstname].filter(Boolean).join(' ').trim()
}

const getReservationNotes = (reservation) => {
  if (!reservation) return ''

  const rawNotes = reservation.notes
    ?? reservation.note
    ?? reservation.booking_notes
    ?? reservation.booking_note
    ?? reservation.note_booking
    ?? reservation.internal_notes
    ?? reservation.internal_note
    ?? reservation.accountholder?.notes
    ?? reservation.accountholder?.note
    ?? ''

  return String(rawNotes).trim()
}

const normalizeBooking = (booking) => ({
  ...booking,
  id: booking?.id || booking?._id || crypto.randomUUID(),
  customerName: getCustomerName(booking),
  checkin: toDateOnly(booking?.checkin),
  checkout: toDateOnly(booking?.checkout),
  resourceLabel: booking?.room || booking?.roomName || booking?.placeLabel || booking?.placeId || '',
  notes: getReservationNotes(booking)
})

const extractMovementRows = (data) => {
  const arrivalRows = data?.arrivals || data?.checkins || data?.incoming
  const departureRows = data?.departures || data?.checkouts || data?.outgoing

  if (Array.isArray(arrivalRows) || Array.isArray(departureRows)) {
    return {
      arrivals: Array.isArray(arrivalRows) ? arrivalRows : [],
      departures: Array.isArray(departureRows) ? departureRows : []
    }
  }

  const rows = Array.isArray(data?.bookings)
    ? data.bookings
    : Array.isArray(data?.movements)
      ? data.movements
      : Array.isArray(data)
        ? data
        : []

  const normalizedRows = rows.map(normalizeBooking)
  return {
    arrivals: normalizedRows.filter((booking) => booking.checkin === selectedDate.value),
    departures: normalizedRows.filter((booking) => booking.checkout === selectedDate.value)
  }
}

const normalizeMovementRows = (rows) => rows.map(normalizeBooking)

const loadMovements = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const day = selectedDate.value
    const { data } = await axios.get(`/api/pms/movements?date=${day}&day=${day}`)
    const rows = extractMovementRows(data)
    arrivals.value = normalizeMovementRows(rows.arrivals)
    departures.value = normalizeMovementRows(rows.departures)
  } catch (error) {
    console.error('Errore caricamento movimenti:', error)
    errorMessage.value = 'Impossibile caricare arrivi e partenze.'
  } finally {
    isLoading.value = false
  }
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('it-IT').format(date)
}

const formatDisplayDate = (value) => {
  const prefix = dayMode.value === 'today'
    ? 'Oggi'
    : dayMode.value === 'tomorrow'
      ? 'Domani'
      : 'Data selezionata'
  return `${prefix}, ${formatDate(value)}`
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const buildReportRows = (rows) => rows.map((booking) => `
  <tr>
    <td>
      <strong>${escapeHtml(booking.customerName || '-')}</strong>
      <small>#${escapeHtml(booking.id)}</small>
      ${booking.notes ? `<div class="notes"><span>Note</span>${escapeHtml(booking.notes).replace(/\n/g, '<br>')}</div>` : ''}
    </td>
    <td>${escapeHtml(booking.resourceLabel || '-')}</td>
    <td>${escapeHtml(formatDate(booking.checkin))}</td>
    <td>${escapeHtml(formatDate(booking.checkout))}</td>
  </tr>
`).join('')

const printReport = (type) => {
  const rows = type === 'arrivals' ? arrivals.value : departures.value
  const title = type === 'arrivals' ? 'Arrivi' : 'Partenze'
  const printWindow = window.open('', '_blank', 'width=960,height=720')
  if (!printWindow) return

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)} ${escapeHtml(formatDate(selectedDate.value))}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
          h1 { margin: 0; font-size: 24px; }
          .date { margin: 6px 0 24px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid #d1d5db; }
          th { background: #f3f4f6; font-size: 12px; text-transform: uppercase; color: #4b5563; }
          small { display: block; margin-top: 3px; color: #6b7280; }
          .notes { margin-top: 8px; font-size: 12px; color: #374151; line-height: 1.45; }
          .notes span { display: block; font-weight: 700; color: #4b5563; margin-bottom: 2px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="date">${escapeHtml(formatDisplayDate(selectedDate.value))}</div>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Stanza</th>
              <th>Arrivo</th>
              <th>Partenza</th>
            </tr>
          </thead>
          <tbody>
            ${buildReportRows(rows)}
          </tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

watch(dayMode, () => {
  if (dayMode.value === 'custom' && (!customDate.value || customDate.value < customMinDate.value)) {
    customDate.value = customMinDate.value
    return
  }

  if (activeTab.value === 'movements') {
    loadMovements()
  }
})

watch(customDate, () => {
  if (dayMode.value === 'custom' && activeTab.value === 'movements') {
    loadMovements()
  }
})

watch(activeTab, (tab) => {
  if (tab === 'movements' && arrivals.value.length === 0 && departures.value.length === 0) {
    loadMovements()
  }
})

onMounted(() => {
  if (activeTab.value === 'movements') {
    loadMovements()
  }
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.home-tabs {
  width: fit-content;
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
  box-shadow: var(--ds-shadow-card);
}

.tab-button {
  min-height: 42px;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 0 18px;
  background: transparent;
  color: var(--ds-text-soft);
  font-weight: 800;
  cursor: pointer;
}

.tab-button.active {
  background: rgba(255, 255, 255, 0.94);
  color: var(--ds-primary);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.08);
}

.movements-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.movements-header,
.movement-card,
.state {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.movements-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 22px 24px;
}

.movements-header h2,
.movement-card h3 {
  margin: 0;
  color: var(--ds-text);
  font-weight: 800;
}

.movements-header p {
  margin: 4px 0 0;
  color: var(--ds-text-soft);
}

.day-selector {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
  flex-wrap: wrap;
}

.day-selector label {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-radius: 12px;
  color: var(--ds-text-soft);
  font-weight: 800;
  cursor: pointer;
}

.day-selector label.active {
  background: rgba(255, 255, 255, 0.94);
  color: var(--ds-primary);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
}

.day-selector input {
  margin: 0;
}

.custom-date-input {
  min-height: 40px;
  min-width: 160px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
  box-shadow: var(--ds-shadow-inset);
}

.custom-date-input:disabled {
  opacity: 0.58;
}

.movements-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.movement-card {
  overflow: hidden;
}

.movement-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  background: rgba(248, 250, 252, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.movement-card-header > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.movement-card-header span {
  min-width: 32px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--ds-primary-soft);
  color: var(--ds-primary-strong);
  font-weight: 800;
}

.print-button {
  min-height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  padding: 0 13px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--ds-shadow-inset);
}

.print-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.movement-list {
  display: flex;
  flex-direction: column;
}

.movement-row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(220px, 1fr);
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.movement-row:last-child {
  border-bottom: 0;
}

.movement-row strong {
  color: var(--ds-text);
}

.movement-row small,
.movement-meta {
  color: var(--ds-text-muted);
  font-size: 0.8rem;
}

.movement-row small {
  display: block;
  margin-top: 4px;
}

.movement-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.movement-notes {
  grid-column: 1 / -1;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.movement-notes span {
  display: block;
  color: var(--ds-text-soft);
  font-size: 0.74rem;
  font-weight: 800;
  margin-bottom: 3px;
}

.movement-notes p {
  margin: 0;
  color: var(--ds-text);
  font-size: 0.86rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.empty-state,
.state {
  padding: 24px;
  color: var(--ds-text-soft);
  text-align: center;
}

.state.error {
  border-color: rgba(220, 77, 77, 0.22);
  background: rgba(254, 242, 242, 0.84);
  color: var(--ds-danger);
}

@media (max-width: 900px) {
  .home-tabs,
  .movements-header,
  .day-selector {
    width: 100%;
  }

  .movements-header {
    align-items: stretch;
    flex-direction: column;
  }

  .day-selector label {
    flex: 1;
    justify-content: center;
  }

  .custom-date-input {
    width: 100%;
  }

  .movements-grid {
    grid-template-columns: 1fr;
  }

  .movement-row {
    grid-template-columns: 1fr;
  }

  .movement-meta {
    align-items: flex-start;
  }

  .movement-card-header {
    align-items: stretch;
  }
}
</style>
