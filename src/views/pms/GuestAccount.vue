<template>
  <div class="guest-account-page">
    <div class="header">
      <div>
        <h1>Conti Hotel</h1>
        <p>Vista conto separata dalle quotazioni: il preventivo resta netto hotel.</p>
      </div>
      <div class="filters">
        <label>
          Dal
          <input v-model="fromDate" type="date" />
        </label>
        <label>
          Al
          <input v-model="toDate" type="date" />
        </label>
        <button type="button" class="btn btn-primary" @click="loadAccounts" :disabled="isLoading">
          {{ isLoading ? 'Caricamento...' : 'Aggiorna' }}
        </button>
      </div>
    </div>

    <section class="card">
      <h2>Elenco Conti</h2>

      <div v-if="isLoading" class="state">Caricamento conti in corso...</div>
      <div v-else-if="accounts.length === 0" class="state">Nessun conto trovato nel periodo selezionato.</div>

      <div v-else class="accounts-table-wrap">
        <table class="accounts-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Camera</th>
              <th>Periodo</th>
              <th>Hotel netto</th>
              <th>Tassa soggiorno</th>
              <th>Servizi</th>
              <th>Totale conto</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="account in accounts"
              :key="account.id"
              :class="{ selected: selectedAccountId === account.id }"
              @click="selectedAccountId = account.id"
            >
              <td>{{ account.guest }}</td>
              <td>{{ account.roomName }}</td>
              <td>{{ formatDate(account.checkin) }} -> {{ formatDate(account.checkout) }}</td>
              <td>{{ formatCurrency(account.hotelNetTotal) }}</td>
              <td>{{ formatCurrency(account.overnightTax.total) }}</td>
              <td>{{ formatCurrency(account.servicesTotal) }}</td>
              <td class="total-cell">{{ formatCurrency(account.accountTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="selectedAccount" class="card detail-card">
      <h2>Dettaglio Conto #{{ selectedAccount.id }}</h2>

      <div class="info-grid">
        <div class="info-item">
          <span class="label">Cliente</span>
          <span class="value">{{ selectedAccount.guest }}</span>
        </div>
        <div class="info-item">
          <span class="label">Camera</span>
          <span class="value">{{ selectedAccount.roomName }}</span>
        </div>
        <div class="info-item">
          <span class="label">Trattamento</span>
          <span class="value">{{ selectedAccount.board.toUpperCase() }}</span>
        </div>
        <div class="info-item">
          <span class="label">Periodo</span>
          <span class="value">{{ formatDate(selectedAccount.checkin) }} -> {{ formatDate(selectedAccount.checkout) }}</span>
        </div>
        <div class="info-item">
          <span class="label">Ospiti</span>
          <span class="value">
            {{ selectedAccount.adults }} adult{{ selectedAccount.adults !== 1 ? 'i' : 'o' }}
            <template v-if="selectedAccount.children > 0">, {{ selectedAccount.children }} bambin{{ selectedAccount.children !== 1 ? 'i' : 'o' }}</template>
          </span>
        </div>
        <div class="info-item">
          <span class="label">Notti</span>
          <span class="value">{{ selectedAccount.duration }}</span>
        </div>
        <div class="info-item">
          <span class="label">Fonte tassa</span>
          <span class="value">{{ selectedAccount.overnightTaxSource }}</span>
        </div>
      </div>

      <div class="lines-block">
        <h3>Righe conto</h3>
        <div class="line-row">
          <span>Servizio hotel (netto)</span>
          <span>{{ formatCurrency(selectedAccount.hotelNetTotal) }}</span>
        </div>
        <div class="line-row tax-row">
          <span>Tassa di soggiorno (IVA esente)</span>
          <span>{{ formatCurrency(selectedAccount.overnightTax.total) }}</span>
        </div>
        <template v-if="selectedAccount.services && selectedAccount.services.length">
          <div class="line-row services-header-row">
            <span><strong>Servizi aggiuntivi</strong></span>
            <span>{{ formatCurrency(selectedAccount.servicesTotal) }}</span>
          </div>
          <div v-for="(svc, i) in selectedAccount.services" :key="i" class="line-row service-line">
            <span>
              {{ svc.name }}
              <span class="svc-qty" v-if="svc.quantity && svc.quantity > 1"> x{{ svc.quantity }}</span>
              <span class="svc-note" v-if="svc.note"> — {{ svc.note }}</span>
              <span class="svc-date" v-if="svc.addedAt"> · {{ formatDateTime(svc.addedAt) }}</span>
            </span>
            <span>{{ getServiceLineTotal(svc) > 0 ? formatCurrency(getServiceLineTotal(svc)) : '—' }}</span>
          </div>
        </template>
        <template v-else>
          <div class="line-row service-line">
            <span>Servizi aggiuntivi</span>
            <span>{{ formatCurrency(0) }}</span>
          </div>
        </template>

        <div class="line-row services-header-row">
          <span><strong>Caparre / Acconti</strong></span>
          <span>{{ formatCurrency(selectedAccountPaymentTotal) }}</span>
        </div>
        <template v-if="selectedAccountPayments.length">
          <div v-for="(pay, i) in selectedAccountPayments" :key="`pay-${i}`" class="line-row service-line">
            <span>
              {{ pay.type || 'acconto' }}
              <span class="svc-date" v-if="pay.paymentDate"> · {{ formatDate(pay.paymentDate) }}</span>
              <span class="svc-note" v-if="pay.paymentMode"> — {{ pay.paymentMode }}</span>
            </span>
            <span>{{ formatCurrency(pay.amount || 0) }}</span>
          </div>
        </template>
        <template v-else>
          <div class="line-row service-line">
            <span>Nessuna caparra/acconto registrato</span>
            <span>{{ formatCurrency(0) }}</span>
          </div>
        </template>

        <div class="line-row">
          <span>Residuo da incassare</span>
          <span>{{ formatCurrency(selectedAccountRemaining) }}</span>
        </div>
        <div class="line-row total-row">
          <span>Totale conto</span>
          <span>{{ formatCurrency(selectedAccount.accountTotal) }}</span>
        </div>
      </div>

      <div class="lines-block">
        <h3>Gestione pagamento checkout</h3>
        <div class="counter-row">
          <span>Prossimo progressivo backend</span>
          <strong>{{ counterInfo?.nextProgressive ?? '-' }}</strong>
        </div>
        <div class="counter-row">
          <span>Progressivo riservato per questo conto</span>
          <strong>{{ selectedReservedProgressive ?? 'non riservato' }}</strong>
        </div>

        <div class="payment-entry-form">
          <input v-model.number="paymentDraft.amount" type="number" min="0" step="0.01" placeholder="Importo" />
          <input v-model="paymentDraft.paymentDate" type="date" />
          <input v-model="paymentDraft.paymentMode" type="text" placeholder="Modalita'" />
          <select v-model="paymentDraft.type">
            <option value="caparra">Caparra</option>
            <option value="acconto">Acconto</option>
          </select>
          <button type="button" class="btn btn-secondary" @click="addPaymentEntry">Aggiungi</button>
        </div>

        <div class="payment-actions-row">
          <button type="button" class="btn btn-secondary" :disabled="isReservingProgressive" @click="reserveProgressive">
            {{ isReservingProgressive ? 'Riserva in corso...' : 'Riserva progressivo' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="printA4Receipt">
            Stampa ricevuta A4
          </button>
          <button type="button" class="btn btn-primary" :disabled="isClosingAccount" @click="closeAccountAndPrintFiscal">
            {{ isClosingAccount ? 'Chiusura in corso...' : 'Chiudi conto e stampa fiscale' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { usePricing } from '@/composables/usePricing'

const { calculateQuotePrice, calculateOvernightTax, loadHotelPricingPolicy } = usePricing()
const route = useRoute()

const isLoading = ref(false)
const roomsById = ref({})
const rawBookings = ref([])
const selectedAccountId = ref(null)

const today = new Date()
const defaultFrom = new Date(today)
defaultFrom.setDate(defaultFrom.getDate() - 7)
const defaultTo = new Date(today)
defaultTo.setDate(defaultTo.getDate() + 30)

const fromDate = ref(toISODate(defaultFrom))
const toDate = ref(toISODate(defaultTo))
const paymentEntriesByReservation = ref({})
const paymentDraft = ref({ amount: '', paymentDate: toISODate(new Date()), paymentMode: 'Contanti', type: 'acconto' })
const counterInfo = ref(null)
const reservedProgressiveByReservation = ref({})
const isReservingProgressive = ref(false)
const isClosingAccount = ref(false)

const accounts = computed(() => {
  return rawBookings.value.map((booking) => {
    const roomData = roomsById.value[String(booking.roomId)] || {}
    const roomType = roomData.type || roomData.name || booking.roomType || 'N/D'

    const quote = calculateQuotePrice(
      booking.checkin,
      booking.checkout,
      roomType,
      'hotel',
      booking.adults + booking.children,
      {
        board: booking.board,
        adults: booking.adults,
        children: booking.children,
        kidAges: booking.kidsAges
      }
    )

    const calculatedHotelTotal = Number(quote?.totalCalculated || 0)
    const hotelNetTotal = booking.fixedPrice != null
      ? Number(booking.fixedPrice)
      : calculatedHotelTotal

    const overnightTax = booking.overnightTaxSnapshot || calculateOvernightTax({
      checkin: booking.checkin,
      checkout: booking.checkout,
      adults: booking.adults,
      children: booking.children,
      kidsAges: booking.kidsAges
    })

    const services = Array.isArray(booking.services) ? booking.services : []
    const servicesTotal = Number(
      services
        .reduce((sum, service) => sum + getServiceLineTotal(service), 0)
        .toFixed(2)
    )

    return {
      ...booking,
      roomName: roomData.name || `Camera ${booking.roomId}`,
      roomType,
      hotelNetTotal,
      overnightTax,
      taxes: { overnight: overnightTax },
      services,
      servicesTotal,
      accountTotal: Number((hotelNetTotal + Number(overnightTax.total || 0) + servicesTotal).toFixed(2))
    }
  })
})

const selectedAccount = computed(() => {
  if (!accounts.value.length) return null
  const found = accounts.value.find((account) => account.id === selectedAccountId.value)
  return found || accounts.value[0]
})

const selectedAccountPayments = computed(() => {
  if (!selectedAccount.value) return []
  return paymentEntriesByReservation.value[selectedAccount.value.id] || []
})

const selectedAccountPaymentTotal = computed(() => {
  return Number(
    selectedAccountPayments.value.reduce((sum, entry) => sum + Number(entry?.amount || 0), 0).toFixed(2)
  )
})

const selectedAccountRemaining = computed(() => {
  if (!selectedAccount.value) return 0
  return Number((Number(selectedAccount.value.accountTotal || 0) - selectedAccountPaymentTotal.value).toFixed(2))
})

const selectedReservedProgressive = computed(() => {
  if (!selectedAccount.value) return null
  return reservedProgressiveByReservation.value[selectedAccount.value.id] || null
})

function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const addDaysISO = (dateStr, daysToAdd) => {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + daysToAdd)
  return toISODate(date)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatCurrency = (value) => {
  const num = Number(value)
  const safe = Number.isFinite(num) ? num : 0
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(safe)
}

const formatDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return String(iso)
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const parseNumber = (value) => {
  if (value == null) return NaN
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

const getServiceLineTotal = (service) => {
  if (!service || typeof service !== 'object') return 0

  const qtyRaw = parseNumber(service.quantity)
  const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1

  const unitPrice = parseNumber(service.price)
  if (Number.isFinite(unitPrice)) return unitPrice * quantity

  const amount = parseNumber(service.amount ?? service.total)
  if (Number.isFinite(amount)) return amount

  return 0
}

const normalizeKidsAges = (ages, expectedCount) => {
  const source = Array.isArray(ages) ? ages : []
  const count = Math.max(0, Number(expectedCount) || 0)
  const normalized = []
  for (let i = 0; i < count; i++) {
    const value = Number(source[i])
    normalized.push(Number.isFinite(value) && value >= 0 ? Math.floor(value) : null)
  }
  return normalized
}

const normalizeTaxSnapshot = (rawTax) => {
  if (!rawTax || typeof rawTax !== 'object') return null

  const total = Number(rawTax.total)
  if (!Number.isFinite(total)) return null

  const persons = Number(rawTax.taxablePersons)
  const days = Number(rawTax.taxableDays)
  const amountPerPerson = Number(rawTax.amountPerPerson)
  const breakdown = Array.isArray(rawTax.breakdown)
    ? rawTax.breakdown.map((day) => ({
        date: String(day?.date || ''),
        persons: Number(day?.persons || 0),
        amountPerPerson: Number(day?.amountPerPerson || 0),
        amount: Number(day?.amount || 0)
      }))
    : []

  return {
    enabled: Boolean(rawTax.enabled),
    taxablePersons: Number.isFinite(persons) ? persons : 0,
    taxableDays: Number.isFinite(days) ? days : 0,
    amountPerPerson: Number.isFinite(amountPerPerson) ? amountPerPerson : 0,
    total: Number(total.toFixed(2)),
    breakdown
  }
}

const getExplicitOvernightTaxFromReservation = (reservation) => {
  const snapshot = normalizeTaxSnapshot(reservation?.overnight_tax || reservation?.overnightTax)
  if (!snapshot) return null
  return {
    snapshot,
    source: 'campo esplicito prenotazione'
  }
}

const getOvernightTaxSnapshotFromReservation = (reservation) => {
  const explicitTax = getExplicitOvernightTaxFromReservation(reservation)
  if (explicitTax) return explicitTax

  if (reservation?.taxes && typeof reservation.taxes === 'object') {
    const snapshot = normalizeTaxSnapshot(reservation.taxes.overnight)
    if (snapshot) {
      return {
        snapshot,
        source: 'sezione taxes'
      }
    }
  }

  if (typeof reservation?.taxes_json === 'string' && reservation.taxes_json.trim()) {
    try {
      const parsed = JSON.parse(reservation.taxes_json)
      const snapshot = normalizeTaxSnapshot(parsed?.overnight)
      if (snapshot) {
        return {
          snapshot,
          source: 'sezione taxes_json'
        }
      }
    } catch {
      return null
    }
  }

  return null
}

const loadRooms = async () => {
  const res = await axios.get('http://localhost:8081/api/pms/getrooms')
  const mapped = {}
  ;(res.data || []).forEach((room) => {
    mapped[String(room.id)] = {
      id: String(room.id),
      name: room.description,
      type: room.room_type?.label || ''
    }
  })
  roomsById.value = mapped
}

const normalizeBookings = (apiPayload) => {
  const list = apiPayload?.bookings || apiPayload || []
  return list.map((res) => {
    const checkin = typeof res.checkin === 'string' ? res.checkin : ''
    const duration = Math.max(1, Number(res.duration || 1))
    const adults = Math.max(0, Number(res.adults ?? res.pax ?? 1))
    const children = Math.max(0, Number(res.kids ?? res.children ?? 0))
    const overnightTaxInfo = getOvernightTaxSnapshotFromReservation(res)
    const deposits = normalizeDeposits(res)

    return {
      id: res.id,
      roomId: String(res.roomId),
      roomType: res.room_type?.label || '',
      guest: `${res.accountholder?.firstname || ''} ${res.accountholder?.lastname || ''}`.trim() || 'N/D',
      adults,
      children,
      kidsAges: normalizeKidsAges(res.kidsAges ?? res.childrenAges ?? res.kids_ages ?? res.children_ages, children),
      overnightTaxSnapshot: overnightTaxInfo?.snapshot || null,
      overnightTaxSource: overnightTaxInfo?.source || 'calcolo locale (fallback)',
      checkin,
      checkout: addDaysISO(checkin, duration),
      duration,
      board: String(res.board || 'bb').toLowerCase(),
      fixedPrice: res.fixedPrice ?? null,
      services: Array.isArray(res.services) ? res.services : [],
      deposits
    }
  })
}

const normalizeDeposits = (reservation) => {
  const raw = reservation?.deposits
    ?? reservation?.deposit
    ?? reservation?.caparra
    ?? []

  return (Array.isArray(raw) ? raw : [])
    .map((dep) => ({
      amount: Number(dep?.amount ?? 0),
      paymentDate: String(dep?.payment_date ?? dep?.paymentDate ?? '').trim(),
      paymentMode: String(dep?.payment_mode ?? dep?.paymentMode ?? '').trim(),
      type: String(dep?.type || 'caparra')
    }))
    .filter((dep) => Number.isFinite(dep.amount) && dep.amount >= 0)
}

const ensureReservationPayments = (account) => {
  if (!account) return
  if (paymentEntriesByReservation.value[account.id]) return
  const baseDeposits = Array.isArray(account.deposits) ? account.deposits : []
  paymentEntriesByReservation.value = {
    ...paymentEntriesByReservation.value,
    [account.id]: baseDeposits.map((entry) => ({
      amount: Number(entry.amount || 0),
      paymentDate: entry.paymentDate || '',
      paymentMode: entry.paymentMode || '',
      type: entry.type || 'caparra'
    }))
  }
}

const addPaymentEntry = () => {
  if (!selectedAccount.value) return

  const amount = Number(paymentDraft.value.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    alert('Inserisci un importo valido')
    return
  }

  const current = paymentEntriesByReservation.value[selectedAccount.value.id] || []
  paymentEntriesByReservation.value = {
    ...paymentEntriesByReservation.value,
    [selectedAccount.value.id]: [
      ...current,
      {
        amount: Number(amount.toFixed(2)),
        paymentDate: paymentDraft.value.paymentDate || '',
        paymentMode: (paymentDraft.value.paymentMode || '').trim(),
        type: paymentDraft.value.type || 'acconto'
      }
    ]
  }

  paymentDraft.value = {
    amount: '',
    paymentDate: toISODate(new Date()),
    paymentMode: 'Contanti',
    type: 'acconto'
  }
}

const removePaymentEntry = (index) => {
  if (!selectedAccount.value) return
  const current = paymentEntriesByReservation.value[selectedAccount.value.id] || []
  current.splice(index, 1)
  paymentEntriesByReservation.value = {
    ...paymentEntriesByReservation.value,
    [selectedAccount.value.id]: [...current]
  }
}

const loadProgressiveCounter = async () => {
  try {
    const response = await axios.get('http://localhost:8081/api/pms/hotel/account/counter')
    counterInfo.value = response.data || null
  } catch (error) {
    console.error('Errore caricamento contatore progressivo:', error)
    alert('Errore caricamento contatore progressivo')
  }
}

const reserveProgressive = async () => {
  if (!selectedAccount.value) return
  isReservingProgressive.value = true
  try {
    const response = await axios.post('http://localhost:8081/api/pms/hotel/account/reserve_progressive', {
      reservationId: selectedAccount.value.id
    })
    const progressive = Number(response.data?.progressive)
    if (Number.isFinite(progressive)) {
      reservedProgressiveByReservation.value = {
        ...reservedProgressiveByReservation.value,
        [selectedAccount.value.id]: progressive
      }
    }
    await loadProgressiveCounter()
  } catch (error) {
    console.error('Errore riserva progressivo:', error)
    alert('Errore riserva progressivo')
  } finally {
    isReservingProgressive.value = false
  }
}

const printA4Receipt = () => {
  window.print()
}

const closeAccountAndPrintFiscal = async () => {
  if (!selectedAccount.value) return

  const progressive = selectedReservedProgressive.value
  if (!Number.isFinite(Number(progressive)) || Number(progressive) <= 0) {
    alert('Riserva prima un numero progressivo')
    return
  }

  isClosingAccount.value = true
  try {
    const payload = {
      reservationId: selectedAccount.value.id,
      progressive: Number(progressive),
      account: selectedAccount.value,
      payments: selectedAccountPayments.value,
      operator: 0
    }

    const response = await axios.post('http://localhost:8081/api/pms/hotel/account/close', payload)
    if (!response.data?.success) {
      alert(response.data?.error || 'Errore chiusura conto')
      return
    }

    alert(`Conto chiuso con progressivo ${progressive}. Comando stampa fiscale inviato al backend.`)
    await loadAccounts()
    await loadProgressiveCounter()
  } catch (error) {
    console.error('Errore chiusura conto:', error)
    alert('Errore durante la chiusura conto')
  } finally {
    isClosingAccount.value = false
  }
}

const applyRouteReservationSelection = () => {
  const reservationId = String(route.query.reservationId || '').trim()
  if (!reservationId) return

  const found = rawBookings.value.find((booking) => String(booking.id) === reservationId)
  if (!found) return
  selectedAccountId.value = found.id
}

const loadAccounts = async () => {
  isLoading.value = true
  try {
    await loadHotelPricingPolicy()
    await loadRooms()

    const url = `http://localhost:8081/api/pms/getbookingsbyrange?from=${fromDate.value}&to=${toDate.value}`
    const response = await axios.get(url)
    rawBookings.value = normalizeBookings(response.data)

    if (!rawBookings.value.length) {
      selectedAccountId.value = null
    } else if (!rawBookings.value.some((booking) => booking.id === selectedAccountId.value)) {
      selectedAccountId.value = rawBookings.value[0].id
    }
    applyRouteReservationSelection()
  } catch (error) {
    console.error('Errore caricamento conti hotel:', error)
    alert('Errore caricamento conti hotel')
  } finally {
    isLoading.value = false
  }
}

watch(selectedAccount, (account) => {
  ensureReservationPayments(account)
})

watch(
  () => route.query.reservationId,
  () => {
    applyRouteReservationSelection()
  }
)

onMounted(async () => {
  await loadAccounts()
  await loadProgressiveCounter()
})
</script>

<style scoped>
.guest-account-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  flex-wrap: wrap;
}

.header h1 {
  margin: 0;
  color: #0f172a;
}

.header p {
  margin: 4px 0 0;
  color: #475569;
}

.filters {
  display: flex;
  gap: 10px;
  align-items: end;
  flex-wrap: wrap;
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #334155;
  font-size: 0.9rem;
}

.filters input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
  min-width: 145px;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.card h2 {
  margin: 0 0 12px;
  color: #1e293b;
}

.state {
  color: #64748b;
}

.accounts-table-wrap {
  overflow-x: auto;
}

.accounts-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 820px;
}

.accounts-table th,
.accounts-table td {
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  padding: 10px 8px;
  color: #334155;
}

.accounts-table tbody tr {
  cursor: pointer;
}

.accounts-table tbody tr:hover {
  background: #f8fafc;
}

.accounts-table tbody tr.selected {
  background: #eff6ff;
}

.total-cell {
  font-weight: 700;
  color: #0f172a;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  color: #64748b;
  font-size: 0.86rem;
}

.info-item .value {
  color: #0f172a;
  font-weight: 600;
}

.lines-block {
  margin-top: 16px;
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}

.lines-block h3 {
  margin: 0 0 10px;
  color: #1e293b;
  font-size: 1rem;
}

.line-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #e2e8f0;
  color: #334155;
}

.line-row:last-child {
  border-bottom: 0;
}

.tax-row {
  color: #1d4ed8;
}

.total-row {
  font-weight: 700;
  color: #0f172a;
}

.services-header-row {
  font-weight: 600;
  color: #047857;
  background: #f0fdf4;
  border-radius: 4px;
  padding: 6px 0;
}

.service-line {
  padding-left: 12px;
  color: #374151;
  font-size: 0.875rem;
}

.svc-qty { color: #6b7280; font-size: 0.8rem; }
.svc-note { color: #6b7280; font-style: italic; font-size: 0.8rem; }
.svc-date { color: #9ca3af; font-size: 0.75rem; }

.btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 9px 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-secondary {
  background: #0f172a;
  color: #fff;
}

.counter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  color: #334155;
}

.payment-entry-form {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 8px;
}

.payment-entry-form input,
.payment-entry-form select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
  min-width: 0;
}

.payment-actions-row {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .header {
    align-items: flex-start;
  }

  .payment-entry-form {
    grid-template-columns: 1fr;
  }
}

@media print {
  .header,
  .filters,
  .payment-entry-form,
  .payment-actions-row,
  .btn {
    display: none !important;
  }

  .guest-account-page {
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .card {
    border: 0;
    box-shadow: none;
    padding: 0;
  }
}
</style>
