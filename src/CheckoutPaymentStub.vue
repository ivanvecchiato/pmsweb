<template>
  <div class="payment-page">
    <div class="header">
      <h1>Pagamento Checkout</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="goToAccounts">Vai ai conti</button>
        <button class="btn btn-secondary" @click="goBack">Torna al planner</button>
      </div>
    </div>

    <div v-if="isLoading" class="card state">Caricamento prenotazione...</div>
    <div v-else-if="!account" class="card state">Prenotazione non trovata.</div>

    <section v-else ref="receiptRef" class="card detail-card">
      <h2>Conto Prenotazione #{{ account.id }}</h2>

      <div class="info-grid">
        <div class="info-item"><span class="label">Cliente</span><span class="value">{{ account.guest }}</span></div>
        <div class="info-item"><span class="label">Camera</span><span class="value">{{ account.roomName }}</span></div>
        <div class="info-item"><span class="label">Trattamento</span><span class="value">{{ account.board.toUpperCase() }}</span></div>
        <div class="info-item"><span class="label">Periodo</span><span class="value">{{ formatDate(account.checkin) }} -> {{ formatDate(account.checkout) }}</span></div>
        <div class="info-item"><span class="label">Ospiti</span><span class="value">{{ account.adults }} adult{{ account.adults !== 1 ? 'i' : 'o' }}<template v-if="account.children > 0">, {{ account.children }} bambin{{ account.children !== 1 ? 'i' : 'o' }}</template></span></div>
      </div>

      <div class="lines-block">
        <h3>Righe conto</h3>
        <div class="line-row"><span>Servizio hotel (netto)</span><span>{{ formatCurrency(account.hotelNetTotal) }}</span></div>
        <div class="line-row tax-row"><span>Tassa di soggiorno (IVA esente)</span><span>{{ formatCurrency(account.overnightTax.total) }}</span></div>

        <template v-if="account.services.length">
          <div class="line-row services-header-row"><span><strong>Servizi aggiuntivi</strong></span><span>{{ formatCurrency(account.servicesTotal) }}</span></div>
          <div v-for="(svc, i) in account.services" :key="i" class="line-row service-line">
            <span>{{ svc.name }}<span v-if="svc.quantity > 1"> x{{ svc.quantity }}</span><span v-if="svc.note"> — {{ svc.note }}</span><span v-if="svc.addedAt"> · {{ formatDateTime(svc.addedAt) }}</span></span>
            <span>{{ formatCurrency(getServiceLineTotal(svc)) }}</span>
          </div>
        </template>
        <template v-else>
          <div class="line-row service-line"><span>Servizi aggiuntivi</span><span>{{ formatCurrency(0) }}</span></div>
        </template>

        <div class="line-row services-header-row"><span><strong>Caparre / Acconti</strong></span><span>{{ formatCurrency(paymentTotal) }}</span></div>
        <template v-if="payments.length">
          <div v-for="(pay, i) in payments" :key="`pay-${i}`" class="line-row service-line">
            <span>{{ pay.type || 'acconto' }}<span v-if="pay.paymentDate"> · {{ formatDate(pay.paymentDate) }}</span><span v-if="pay.paymentMode"> — {{ pay.paymentMode }}</span></span>
            <span>{{ formatCurrency(pay.amount || 0) }}</span>
          </div>
        </template>
        <template v-else>
          <div class="line-row service-line"><span>Nessuna caparra/acconto registrato</span><span>{{ formatCurrency(0) }}</span></div>
        </template>

        <div class="line-row"><span>Residuo da incassare</span><span>{{ formatCurrency(remaining) }}</span></div>
        <div class="line-row total-row"><span>Totale conto</span><span>{{ formatCurrency(account.accountTotal) }}</span></div>
      </div>

      <div class="lines-block">
        <h3>Gestione pagamento checkout</h3>
        <div class="counter-row"><span>Prossimo progressivo backend</span><strong>{{ counterInfo?.nextProgressive ?? '-' }}</strong></div>
        <div class="counter-row"><span>Progressivo riservato</span><strong>{{ reservedProgressive ?? 'non riservato' }}</strong></div>

        <div class="payment-entry-form">
          <input v-model.number="paymentDraft.amount" type="number" min="0" step="0.01" placeholder="Importo" />
          <input v-model="paymentDraft.paymentDate" type="date" />
          <input v-model="paymentDraft.paymentMode" type="text" placeholder="Modalita'" />
          <select v-model="paymentDraft.type">
            <option value="caparra">Caparra</option>
            <option value="acconto">Acconto</option>
          </select>
          <button type="button" class="btn btn-secondary" @click="addPayment">Aggiungi</button>
        </div>

        <div class="payment-actions-row">
          <button type="button" class="btn btn-secondary" :disabled="isReserving" @click="reserveProgressive">
            {{ isReserving ? 'Riserva in corso...' : 'Riserva progressivo' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="printA4">Stampa ricevuta A4</button>
          <button type="button" class="btn btn-primary" :disabled="isClosing" @click="closeAccount">
            {{ isClosing ? 'Chiusura in corso...' : 'Chiudi conto e stampa fiscale' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { usePricing } from './composables/usePricing'

const route = useRoute()
const router = useRouter()
const { calculateQuotePrice, calculateOvernightTax, loadHotelPricingPolicy } = usePricing()

const reservationId = computed(() => String(route.params.reservationId || ''))
const isLoading = ref(false)
const account = ref(null)
const counterInfo = ref(null)
const reservedProgressive = ref(null)
const isReserving = ref(false)
const isClosing = ref(false)
const receiptRef = ref(null)
const structureInfo = ref({
  name: 'Struttura',
  address: '',
  city: '',
  vatNumber: '',
  logoUrl: ''
})
const paymentDraft = ref({ amount: '', paymentDate: toISODate(new Date()), paymentMode: 'Contanti', type: 'acconto' })
const payments = ref([])

const paymentTotal = computed(() => Number(payments.value.reduce((sum, p) => sum + Number(p?.amount || 0), 0).toFixed(2)))
const remaining = computed(() => Number((Number(account.value?.accountTotal || 0) - paymentTotal.value).toFixed(2)))

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

const formatDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return String(iso)
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatCurrency = (value) => {
  const num = Number(value)
  const safe = Number.isFinite(num) ? num : 0
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(safe)
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

const getServiceLineTotal = (service) => {
  const qty = Number(service?.quantity || 1)
  const amount = Number(service?.price)
  if (Number.isFinite(amount)) return Number((amount * (Number.isFinite(qty) && qty > 0 ? qty : 1)).toFixed(2))
  const total = Number(service?.amount ?? service?.total ?? 0)
  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0
}

const normalizeDeposits = (reservation) => {
  const raw = reservation?.deposits ?? reservation?.deposit ?? reservation?.caparra ?? []
  return (Array.isArray(raw) ? raw : []).map((dep) => ({
    amount: Number(dep?.amount ?? 0),
    paymentDate: String(dep?.payment_date ?? dep?.paymentDate ?? '').trim(),
    paymentMode: String(dep?.payment_mode ?? dep?.paymentMode ?? '').trim(),
    type: String(dep?.type || 'caparra')
  })).filter((dep) => Number.isFinite(dep.amount) && dep.amount >= 0)
}

const getOvernightTaxSnapshotFromReservation = (reservation) => {
  const overnight = reservation?.overnight_tax ?? reservation?.overnightTax ?? reservation?.taxes?.overnight
  if (!overnight || typeof overnight !== 'object') return null
  const total = Number(overnight.total)
  if (!Number.isFinite(total)) return null
  return {
    total: Number(total.toFixed(2))
  }
}

const loadCounter = async () => {
  const response = await axios.get('http://localhost:8081/api/pms/hotel/account/counter')
  counterInfo.value = response.data || null
}

const toSafeText = (value) => String(value || '').trim()

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const extractStructureInfo = (configs) => {
  const root = configs && typeof configs === 'object' ? configs : {}
  const structure = root.structure || root.hotel?.structure || {}

  const name = toSafeText(
    structure.name
    || structure.businessName
    || root.businessName
    || root.hotel?.businessName
    || 'Struttura'
  )

  const address = toSafeText(
    structure.address
    || structure.street
    || root.address
    || root.hotel?.address
    || ''
  )

  const city = toSafeText(
    structure.city
    || root.city
    || root.hotel?.city
    || ''
  )

  const vatNumber = toSafeText(
    structure.vatNumber
    || structure.vat
    || structure.piva
    || root.vatNumber
    || root.vat
    || root.piva
    || root.hotel?.vatNumber
    || ''
  )

  const logoUrl = toSafeText(
    structure.logoUrl
    || structure.logo
    || root.logoUrl
    || root.logo
    || root.hotel?.logoUrl
    || ''
  )

  return { name, address, city, vatNumber, logoUrl }
}

const loadStructureInfo = async () => {
  try {
    const response = await axios.get('http://localhost:8081/api/pms/getconfigs')
    structureInfo.value = extractStructureInfo(response.data)
  } catch (error) {
    console.error('Errore caricamento dati struttura:', error)
  }
}

const loadReservationAccount = async () => {
  if (!reservationId.value) return
  isLoading.value = true
  try {
    await loadHotelPricingPolicy()
    const bookingResponse = await axios.get(`http://localhost:8081/api/pms/hotel/reservation?id=${encodeURIComponent(reservationId.value)}`)
    const res = bookingResponse.data?.reservation
    if (!res) {
      account.value = null
      return
    }

    const checkin = typeof res.checkin === 'string' ? res.checkin : ''
    const duration = Math.max(1, Number(res.duration || 1))
    const adults = Math.max(0, Number(res.adults ?? res.pax ?? 1))
    const children = Math.max(0, Number(res.kids ?? res.children ?? 0))
    const kidsAges = normalizeKidsAges(res.kidsAges ?? res.childrenAges ?? res.kids_ages ?? res.children_ages, children)
    const roomType = res.roomType || res.room_type?.label || res.room || 'N/D'

    const quote = calculateQuotePrice(checkin, addDaysISO(checkin, duration), roomType, 'hotel', adults + children, {
      board: String(res.board || 'bb').toLowerCase(),
      adults,
      children,
      kidAges: kidsAges
    })

    const hotelNetTotal = res.fixedPrice != null ? Number(res.fixedPrice) : Number(quote?.totalCalculated || 0)
    const overnightTax = getOvernightTaxSnapshotFromReservation(res) || calculateOvernightTax({ checkin, checkout: addDaysISO(checkin, duration), adults, children, kidsAges })
    const services = Array.isArray(res.services) ? res.services : []
    const servicesTotal = Number(services.reduce((sum, svc) => sum + getServiceLineTotal(svc), 0).toFixed(2))

    account.value = {
      id: res.id,
      roomName: res.room || `Camera ${res.roomId}`,
      checkin,
      checkout: addDaysISO(checkin, duration),
      duration,
      guest: `${res.accountholder?.firstname || ''} ${res.accountholder?.lastname || ''}`.trim() || 'N/D',
      adults,
      children,
      board: String(res.board || 'bb').toLowerCase(),
      services,
      servicesTotal,
      overnightTax,
      hotelNetTotal,
      accountTotal: Number((hotelNetTotal + Number(overnightTax.total || 0) + servicesTotal).toFixed(2))
    }

    payments.value = normalizeDeposits(res)
    const existingProgressive = Number(res?.accounting?.progressive)
    reservedProgressive.value = Number.isFinite(existingProgressive) && existingProgressive > 0 ? existingProgressive : null
  } catch (error) {
    console.error('Errore caricamento conto dedicato:', error)
    account.value = null
    alert('Errore caricamento conto dedicato')
  } finally {
    isLoading.value = false
  }
}

const addPayment = () => {
  const amount = Number(paymentDraft.value.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    alert('Inserisci un importo valido')
    return
  }
  payments.value.push({
    amount: Number(amount.toFixed(2)),
    paymentDate: paymentDraft.value.paymentDate || '',
    paymentMode: (paymentDraft.value.paymentMode || '').trim(),
    type: paymentDraft.value.type || 'acconto'
  })
  paymentDraft.value = { amount: '', paymentDate: toISODate(new Date()), paymentMode: 'Contanti', type: 'acconto' }
}

const reserveProgressive = async () => {
  if (!account.value) return
  isReserving.value = true
  try {
    const response = await axios.post('http://localhost:8081/api/pms/hotel/account/reserve_progressive', {
      reservationId: account.value.id
    })
    const progressive = Number(response.data?.progressive)
    if (Number.isFinite(progressive)) {
      reservedProgressive.value = progressive
    }
    await loadCounter()
  } catch (error) {
    console.error('Errore riserva progressivo:', error)
    alert('Errore riserva progressivo')
  } finally {
    isReserving.value = false
  }
}

const printA4 = () => {
  if (!receiptRef.value) return

  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) {
    alert('Impossibile aprire la finestra di stampa')
    return
  }

  const receiptHtml = receiptRef.value.innerHTML
  const guestName = account.value?.guest || 'N/D'
  const title = `Conto prenotazione ${reservationId.value}`
  const headerName = escapeHtml(structureInfo.value.name || 'Struttura')
  const headerAddress = escapeHtml(structureInfo.value.address || '')
  const headerCity = escapeHtml(structureInfo.value.city || '')
  const headerVat = escapeHtml(structureInfo.value.vatNumber || 'N/D')
  const logoHtml = structureInfo.value.logoUrl
    ? `<img src="${escapeHtml(structureInfo.value.logoUrl)}" alt="Logo struttura" class="print-logo" />`
    : ''

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #111827;
            margin: 20mm;
            font-size: 12px;
          }
          h2, h3 {
            margin: 0 0 10px 0;
            color: #0f172a;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 14px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 10px;
          }
          .print-header-left {
            flex: 1;
          }
          .print-logo {
            width: 120px;
            max-height: 70px;
            object-fit: contain;
          }
          .print-header p {
            margin: 4px 0;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(200px, 1fr));
            gap: 8px;
          }
          .info-item .label {
            color: #64748b;
            font-size: 11px;
          }
          .info-item .value {
            font-weight: 600;
          }
          .line-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 6px 0;
            border-bottom: 1px dashed #e2e8f0;
          }
          .total-row {
            font-weight: 700;
          }
          .counter-row,
          .payment-entry-form,
          .payment-actions-row {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 14mm;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="print-header-left">
            <h2>${headerName}</h2>
            <p>${headerAddress}${headerAddress && headerCity ? ', ' : ''}${headerCity}</p>
            <p>P.IVA: ${headerVat}</p>
            <p>${title}</p>
            <p>Cliente: ${escapeHtml(guestName)}</p>
            <p>Data stampa: ${new Date().toLocaleString('it-IT')}</p>
          </div>
          ${logoHtml}
        </div>
        ${receiptHtml}
      </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}

const closeAccount = async () => {
  if (!account.value) return
  if (!Number.isFinite(Number(reservedProgressive.value)) || Number(reservedProgressive.value) <= 0) {
    alert('Riserva prima un numero progressivo')
    return
  }

  isClosing.value = true
  try {
    const response = await axios.post('http://localhost:8081/api/pms/hotel/account/close', {
      reservationId: account.value.id,
      progressive: Number(reservedProgressive.value),
      account: account.value,
      payments: payments.value,
      operator: 0
    })
    if (!response.data?.success) {
      alert(response.data?.error || 'Errore chiusura conto')
      return
    }

    alert(`Conto chiuso con progressivo ${reservedProgressive.value}. Comando stampa fiscale inviato al backend.`)
    await loadReservationAccount()
    await loadCounter()
  } catch (error) {
    console.error('Errore chiusura conto:', error)
    alert('Errore durante la chiusura conto')
  } finally {
    isClosing.value = false
  }
}

const goBack = () => router.push('/')
const goToAccounts = () => router.push('/accounts')

onMounted(async () => {
  await Promise.all([loadReservationAccount(), loadCounter(), loadStructureInfo()])
})
</script>

<style scoped>
.payment-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header h1 {
  margin: 0;
  color: #0f172a;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.state {
  color: #64748b;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

@media (max-width: 900px) {
  .payment-entry-form {
    grid-template-columns: 1fr;
  }
}

@media print {
  .header,
  .payment-entry-form,
  .payment-actions-row,
  .btn {
    display: none !important;
  }

  .payment-page {
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
