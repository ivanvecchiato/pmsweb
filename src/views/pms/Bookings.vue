<template>
  <div class="planner-container bookings-view">
    <div class="header">
      <div>
        <h1 class="title">Prenotazioni</h1>
        <p class="subtitle">Elenco prenotazioni {{ currentYear }}</p>
      </div>

      <div class="header-actions">
        <div class="count-chip">
          <strong>{{ filteredBookings.length }}</strong>
          <span>risultati</span>
        </div>
        <button type="button" class="btn btn-secondary" @click="resetFilters">Pulisci</button>
        <button type="button" class="btn btn-primary" :disabled="isLoading" @click="loadBookings">
          {{ isLoading ? 'Caricamento...' : 'Aggiorna' }}
        </button>
      </div>
    </div>

    <div class="content">
      <div class="dashboard-container">
        <section class="filters-card">
          <div class="filters-grid">
            <div class="field search-field">
              <label for="booking-customer-search">Cliente</label>
              <input
                id="booking-customer-search"
                v-model.trim="filters.customer"
                type="search"
                placeholder="Cerca cliente"
              />
            </div>

            <div class="field">
              <label for="booking-sort">Ordina per</label>
              <select id="booking-sort" v-model="sortBy">
                <option value="name">Nome</option>
                <option value="arrival">Data di arrivo</option>
              </select>
            </div>
          </div>

          <div class="range-grid">
            <div class="range-group" :class="{ disabled: filters.dateFilterType !== 'arrival' }">
              <label class="range-radio">
                <input v-model="filters.dateFilterType" type="radio" value="arrival" />
                <span>Data arrivo</span>
              </label>
              <label class="range-field">
                <span>da</span>
                <input
                  v-model="filters.arrivalFrom"
                  type="date"
                  aria-label="Data arrivo da"
                  :disabled="filters.dateFilterType !== 'arrival'"
                />
              </label>
              <label class="range-field">
                <span>a</span>
                <input
                  v-model="filters.arrivalTo"
                  type="date"
                  aria-label="Data arrivo a"
                  :disabled="filters.dateFilterType !== 'arrival'"
                />
              </label>
            </div>

            <div class="range-group" :class="{ disabled: filters.dateFilterType !== 'booking' }">
              <label class="range-radio">
                <input v-model="filters.dateFilterType" type="radio" value="booking" />
                <span>Data prenotazione</span>
              </label>
              <label class="range-field">
                <span>da</span>
                <input
                  v-model="filters.bookingFrom"
                  type="date"
                  aria-label="Data prenotazione da"
                  :disabled="filters.dateFilterType !== 'booking'"
                />
              </label>
              <label class="range-field">
                <span>a</span>
                <input
                  v-model="filters.bookingTo"
                  type="date"
                  aria-label="Data prenotazione a"
                  :disabled="filters.dateFilterType !== 'booking'"
                />
              </label>
            </div>
          </div>
        </section>

        <div class="summary-row">
          <span>Ordinate per {{ sortBy === 'name' ? 'nome intestatario' : 'data di arrivo' }}</span>
          <span v-if="lastUpdated">Aggiornato {{ lastUpdated }}</span>
        </div>

        <div v-if="errorMessage" class="state error">{{ errorMessage }}</div>
        <div v-else-if="isLoading" class="state">Caricamento prenotazioni...</div>
        <div v-else-if="filteredBookings.length === 0" class="state">Nessuna prenotazione trovata.</div>

        <div v-else class="bookings-list">
          <table class="bookings-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Arrivo</th>
                <th>Partenza</th>
                <th>{{ resourceColumnLabel }}</th>
                <th>Stato</th>
                <th class="amount-cell">Totale</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in filteredBookings" :key="booking.id">
                <td>
                  <div class="customer-name">{{ booking.customerName || '-' }}</div>
                  <div class="muted">#{{ booking.id }}</div>
                  <div class="muted booking-date">Prenotazione {{ formatDate(booking.bookingDate) }}</div>
                </td>
                <td>{{ formatDate(booking.checkin) }}</td>
                <td>{{ formatDate(booking.checkout) }}</td>
                <td>{{ booking.resourceLabel || '-' }}</td>
                <td>
                  <span class="status-pill">{{ booking.statusLabel }}</span>
                </td>
                <td class="amount-cell">{{ formatCurrency(booking.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { pmsType, loadPmsType } = useAuth()
const currentYear = new Date().getFullYear()
const today = new Date()
const yesterday = new Date(today)
yesterday.setDate(today.getDate() - 1)
const bookings = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const lastUpdated = ref('')
const sortBy = ref('name')

const formatDateForPicker = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const defaultDateFrom = formatDateForPicker(yesterday)
const defaultDateTo = formatDateForPicker(today)

const filters = reactive({
  customer: '',
  dateFilterType: 'arrival',
  arrivalFrom: defaultDateFrom,
  arrivalTo: defaultDateTo,
  bookingFrom: defaultDateFrom,
  bookingTo: defaultDateTo
})

const statusLabels = {
  '-100': 'Annullata',
  0: 'Prenotata',
  1: 'Check-in',
  2: 'Check-out',
  3: 'In arrivo',
  4: 'In partenza'
}

const toDateOnly = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const toEndpointDate = (value) => toDateOnly(value)

const getYearBoundary = (month, day) => `${currentYear}-${month}-${day}`

const getCustomerName = (booking) => {
  const holder = booking?.accountholder || {}
  const holderName = [holder.lastname, holder.firstname].filter(Boolean).join(' ').trim()
  if (holderName) return holderName
  const firstGuest = Array.isArray(booking?.guests) ? booking.guests[0] : null
  return [firstGuest?.lastname, firstGuest?.firstname].filter(Boolean).join(' ').trim()
}

const getAmount = (booking) => {
  const value = booking?.price_total ?? booking?.price_per_room ?? booking?.price_per_place ?? booking?.fixedPrice ?? booking?.amount
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const normalizeBooking = (booking) => ({
  ...booking,
  id: booking?.id || booking?._id || crypto.randomUUID(),
  customerName: getCustomerName(booking),
  bookingDate: toDateOnly(booking?.datetime || booking?.bookingDate || booking?.createdAt),
  checkin: toDateOnly(booking?.checkin),
  checkout: toDateOnly(booking?.checkout),
  resourceLabel: booking?.room || booking?.roomName || booking?.placeLabel || booking?.placeId || '',
  statusLabel: statusLabels[String(booking?.displayStatus ?? booking?.status)] || 'Prenotata',
  amount: getAmount(booking)
})

const getArrivalRequestRange = () => {
  if (filters.dateFilterType === 'booking') {
    return {
      from: getYearBoundary('01', '01'),
      to: getYearBoundary('12', '31')
    }
  }

  return {
    from: filters.arrivalFrom || getYearBoundary('01', '01'),
    to: filters.arrivalTo || getYearBoundary('12', '31')
  }
}

const normalizeText = (value) => String(value || '').trim().toLowerCase()

const isInRange = (value, from, to) => {
  const date = toDateOnly(value)
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

const loadBookings = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!pmsType.value) {
      await loadPmsType()
    }

    const range = getArrivalRequestRange()
    const from = toEndpointDate(range.from)
    const to = toEndpointDate(range.to)
    const { data } = await axios.get(`/api/pms/getbookingsbyrange?from=${from}&to=${to}`)
    const rows = Array.isArray(data?.bookings) ? data.bookings : []
    bookings.value = rows.map(normalizeBooking)
    lastUpdated.value = new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date())
  } catch (error) {
    console.error('Errore caricamento prenotazioni:', error)
    errorMessage.value = 'Impossibile caricare la lista prenotazioni.'
  } finally {
    isLoading.value = false
  }
}

const filteredBookings = computed(() => {
  const customerQuery = normalizeText(filters.customer)

  return bookings.value
    .filter((booking) => {
      if (customerQuery && !normalizeText(booking.customerName).includes(customerQuery)) return false
      if (filters.dateFilterType === 'arrival' && (filters.arrivalFrom || filters.arrivalTo) && !isInRange(booking.checkin, filters.arrivalFrom, filters.arrivalTo)) return false
      if (filters.dateFilterType === 'booking' && (filters.bookingFrom || filters.bookingTo) && !isInRange(booking.bookingDate, filters.bookingFrom, filters.bookingTo)) return false
      return true
    })
    .sort((left, right) => {
      if (sortBy.value === 'arrival') {
        return left.checkin.localeCompare(right.checkin) || left.customerName.localeCompare(right.customerName, 'it', { sensitivity: 'base' })
      }
      return left.customerName.localeCompare(right.customerName, 'it', { sensitivity: 'base' }) || left.checkin.localeCompare(right.checkin)
    })
})

const resourceColumnLabel = computed(() => (pmsType.value === 'beach' ? 'Posto' : 'Stanza'))

const resetFilters = () => {
  filters.customer = ''
  filters.dateFilterType = 'arrival'
  filters.arrivalFrom = defaultDateFrom
  filters.arrivalTo = defaultDateTo
  filters.bookingFrom = defaultDateFrom
  filters.bookingTo = defaultDateTo
  sortBy.value = 'name'
  loadBookings()
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('it-IT').format(date)
}

const formatCurrency = (value) => {
  if (!Number.isFinite(Number(value))) return '-'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(value))
}

onMounted(loadBookings)
</script>

<style scoped>
.bookings-view {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 120px);
  gap: 18px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.title {
  margin: 0;
  color: var(--ds-text);
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: 0;
}

.subtitle {
  margin: 4px 0 0;
  color: var(--ds-text-soft);
  font-size: 0.92rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.count-chip {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: var(--ds-text-soft);
  font-size: 0.88rem;
}

.count-chip strong {
  color: var(--ds-text);
  font-size: 1.1rem;
}

.content {
  flex: 1;
  overflow: auto;
  padding: 0 8px 8px;
}

.dashboard-container {
  max-width: 1400px;
  margin: 0 auto;
}

.filters-card,
.bookings-list,
.state {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.filters-card {
  padding: 20px;
}

.filters-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1.5fr) minmax(180px, 1fr);
  gap: 14px;
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 18px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.field,
.range-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.range-group {
  display: grid;
  grid-template-columns: max-content minmax(180px, 1fr) minmax(180px, 1fr);
  align-items: end;
  column-gap: 12px;
}

.search-field {
  flex: 1;
}

label,
.group-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ds-text-soft);
}

.range-radio {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ds-text);
  white-space: nowrap;
}

.range-radio input {
  width: 16px;
  min-height: 16px;
  padding: 0;
  box-shadow: none;
  cursor: pointer;
}

.range-radio span {
  font-size: 0.82rem;
  font-weight: 800;
}

.range-group.disabled {
  opacity: 0.58;
}

.range-group .group-label {
  min-height: 48px;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.range-field {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.range-field span {
  color: var(--ds-text-soft);
  font-size: 0.82rem;
  font-weight: 700;
}

input,
select {
  width: 100%;
  min-height: 48px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--ds-text);
  box-shadow: var(--ds-shadow-inset);
}

input:disabled {
  cursor: not-allowed;
  background: rgba(241, 245, 249, 0.72);
}

.btn {
  min-height: 46px;
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 0 16px;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #fff;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-text);
  border-color: rgba(148, 163, 184, 0.18);
}

.btn:disabled {
  cursor: wait;
  opacity: 0.65;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 2px;
  justify-content: space-between;
  color: var(--ds-text-soft);
  font-size: 0.92rem;
}

.state {
  padding: 28px;
  color: var(--ds-text-soft);
  text-align: center;
}

.state.error {
  border-color: rgba(220, 77, 77, 0.22);
  background: rgba(254, 242, 242, 0.84);
  color: var(--ds-danger);
}

.bookings-list {
  overflow: auto;
}

.bookings-table {
  width: 100%;
  min-width: 860px;
  border-collapse: separate;
  border-spacing: 0;
}

th,
td {
  padding: 15px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  text-align: left;
  vertical-align: middle;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(248, 250, 252, 0.94);
  color: var(--ds-text-soft);
  font-size: 0.8rem;
  font-weight: 800;
}

tbody tr {
  transition: background-color 0.16s ease;
}

tbody tr:hover {
  background: rgba(248, 250, 252, 0.72);
}

tbody tr:last-child td {
  border-bottom: 0;
}

.customer-name {
  font-weight: 700;
  color: var(--ds-text);
}

.muted {
  margin-top: 3px;
  color: var(--ds-text-muted);
  font-size: 0.8rem;
}

.booking-date {
  font-size: 0.74rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border-radius: 999px;
  padding: 0 10px;
  background: var(--ds-primary-soft);
  color: var(--ds-primary-strong);
  font-size: 0.78rem;
  font-weight: 800;
}

.amount-cell {
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .header {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions,
  .count-chip,
  .btn {
    width: 100%;
  }

  .header-actions {
    align-items: stretch;
  }

  .filters-grid,
  .range-grid {
    grid-template-columns: 1fr;
  }

  .range-group {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .range-group .group-label {
    min-height: auto;
  }
}
</style>
