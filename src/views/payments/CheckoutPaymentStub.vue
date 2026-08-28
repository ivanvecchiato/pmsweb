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

    <section v-else class="card detail-card">
      <h2>Conto Prenotazione #{{ account.id }}</h2>

      <div class="info-grid">
        <div class="info-item"><span class="label">Cliente</span><span class="value">{{ account.guest }}</span></div>
        <div class="info-item"><span class="label">Camera</span><span class="value">{{ account.roomName }}</span></div>
        <div class="info-item"><span class="label">Trattamento</span><span class="value">{{ account.board.toUpperCase() }}</span></div>
        <div class="info-item"><span class="label">Periodo</span><span class="value">{{ formatDate(account.checkin) }} -> {{ formatDate(account.checkout) }}</span></div>
        <div class="info-item"><span class="label">Ospiti</span><span class="value">{{ account.adults }} adult{{ account.adults !== 1 ? 'i' : 'o' }}<template v-if="account.kids > 0">, {{ account.kids }} bambin{{ account.kids !== 1 ? 'i' : 'o' }}</template></span></div>
      </div>

      <div class="lines-block">
        <div class="line-row"><span>Totale soggiorno</span><span>{{ formatCurrency(account.hotelNetTotal) }}</span></div>

        <template v-if="account.services.length">
          <div v-for="(svc, i) in account.services" :key="i" class="line-row service-line">
            <span>{{ svc.name }} x {{ svc.quantity || 1 }}<span v-if="svc.note"> — {{ svc.note }}</span><span v-if="svc.addedAt"> · {{ formatDateTime(svc.addedAt) }}</span></span>
            <span>{{ formatCurrency(getServiceLineTotal(svc)) }}</span>
          </div>
        </template>

        <button
          type="button"
          class="line-row bar-total-row"
          :class="{ 'bar-total-row--active': barConsumptions.length }"
          :disabled="!barConsumptions.length"
          @click="showBarAccount = true"
        >
          <span>Totale bar</span>
          <span>{{ isLoadingBar ? 'Caricamento...' : formatCurrency(barConsumptionsTotal) }}</span>
        </button>

        <div class="line-row total-row"><span>Totale conto</span><span>{{ formatCurrency(accountTotalWithBar) }}</span></div>
        <template v-if="payments.length">
          <div v-for="(pay, i) in payments" :key="`pay-${i}`" class="line-row service-line">
            <span>{{ String(pay.type || 'acconto').toLowerCase() === 'caparra' ? 'Caparra' : 'Acconto' }}<span v-if="pay.paymentDate"> · {{ formatDate(pay.paymentDate) }}</span><span v-if="pay.paymentMode"> — {{ pay.paymentMode }}</span></span>
            <span>{{ formatCurrency(-Number(pay.amount || 0)) }}</span>
          </div>
        </template>

        <div class="line-row tax-row">
          <span>Tassa di soggiorno</span>
          <select
            v-model="taxPaymentMethodId"
            :disabled="isAccountPaid || !hotelPaymentMethods.length"
            @change="changeOvernightTaxPaymentMethod"
          >
            <option v-for="method in hotelPaymentMethods" :key="method.id" :value="String(method.id)">
              {{ method.name }}
            </option>
          </select>
          <span>{{ formatCurrency(account.overnightTax.total) }}</span>
        </div>
        <div class="line-row"><span>Residuo da incassare</span><span>{{ formatCurrency(remaining) }}</span></div>
      </div>

      <div class="lines-block">
        <h3>Pagamento a saldo</h3>

        <div v-if="isAccountPaid" class="checkout-payment-summary checkout-payment-summary--paid">
          <span>Stato conto</span>
          <strong>Pagato</strong>
        </div>

        <div v-if="!isLoadingBar && !barConsumptions.length" class="bar-empty-section">
          <h4>Consumazioni Bar</h4>
          <span>Nessuna consumazione bar</span>
        </div>

        <div v-if="!isAccountPaid" class="payment-entry-form">
          <input
            v-model.number="paymentDraft.amount"
            type="number"
            min="0.01"
            :max="checkoutRemaining"
            step="0.01"
            :placeholder="`Importo massimo ${formatCurrency(checkoutRemaining)}`"
          />
          <select v-model="paymentDraft.paymentMethodId">
            <option value="" disabled>Metodo di pagamento</option>
            <option v-for="method in hotelPaymentMethods" :key="method.id" :value="String(method.id)">
              {{ method.name }}
            </option>
          </select>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="checkoutRemaining <= 0 || !paymentDraft.paymentMethodId"
            @click="addPayment"
          >Aggiungi pagamento</button>
        </div>

        <div v-if="checkoutPayments.length" class="checkout-payment-list">
          <div v-for="(payment, index) in checkoutPayments" :key="`checkout-${index}`" class="checkout-payment-row">
            <span>{{ payment.paymentMode }}</span>
            <strong>{{ formatCurrency(payment.amount) }}</strong>
            <button
              v-if="!payment.overnightTax || payment.amount > payment.overnightTaxAmount"
              type="button"
              @click="removeCheckoutPayment(index)"
            >Rimuovi saldo</button>
          </div>
        </div>
        <div v-if="!isAccountPaid" class="checkout-payment-summary" :class="{ 'checkout-payment-summary--paid': isCheckoutPaid }">
          <span>Residuo da coprire</span>
          <strong>{{ formatCurrency(checkoutRemaining) }}</strong>
        </div>

        <div class="payment-actions-row">
          <button type="button" class="btn btn-secondary" @click="printA4">Stampa ricevuta A4</button>
          <button v-if="!isAccountPaid" type="button" class="btn btn-primary" :disabled="isClosing || !isCheckoutPaid" @click="closeAccount">
            {{ isClosing ? 'Chiusura in corso...' : 'Chiudi conto e stampa fiscale' }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="showBarAccount" class="bar-modal-overlay" @click.self="showBarAccount = false">
      <section class="bar-modal">
        <div class="bar-modal-header">
          <div>
            <h2>Conto bar camera {{ account.roomName }}</h2>
            <p>{{ account.guest }}</p>
          </div>
          <button type="button" class="bar-modal-close" aria-label="Chiudi" @click="showBarAccount = false">&times;</button>
        </div>
        <div class="bar-account-list">
          <div v-for="(item, i) in barConsumptions" :key="item.id || i" class="bar-account-row">
            <div>
              <strong>{{ item.name }}<span v-if="item.quantity > 1"> × {{ item.quantity }}</span></strong>
              <span v-if="item.addedAt">{{ formatDateTime(item.addedAt) }}</span>
            </div>
            <span>{{ formatCurrency(getBarLineTotal(item)) }}</span>
          </div>
        </div>
        <div class="bar-account-total"><span>Totale bar</span><strong>{{ formatCurrency(barConsumptionsTotal) }}</strong></div>
        <div class="bar-modal-actions">
          <button type="button" class="btn btn-secondary" @click="showBarAccount = false">Chiudi</button>
          <button type="button" class="btn btn-primary" @click="printBarAccount">Stampa conto bar</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { usePricing } from '@/composables/usePricing'

const route = useRoute()
const router = useRouter()
const { calculateQuotePrice, calculateOvernightTax, hotelPricingPolicy, loadHotelPricingPolicy } = usePricing()

const reservationId = computed(() => String(route.params.reservationId || ''))
const isLoading = ref(false)
const account = ref(null)
const isClosing = ref(false)
const paymentDraft = ref({ amount: '', paymentMethodId: '' })
const payments = ref([])
const checkoutPayments = ref([])
const hotelPaymentMethods = ref([])
const taxPaymentMethodId = ref('')

const isLoadingBar = ref(false)
const barConsumptions = ref([])
const showBarAccount = ref(false)

const paymentTotal = computed(() => Number(payments.value.reduce((sum, p) => sum + Number(p?.amount || 0), 0).toFixed(2)))
const barConsumptionsTotal = computed(() => 
  Number(barConsumptions.value.reduce((sum, item) => sum + getBarLineTotal(item), 0).toFixed(2))
)
const accountTotalWithBar = computed(() => Number((Number(account.value?.accountTotal || 0) + barConsumptionsTotal.value).toFixed(2)))
const remaining = computed(() => account.value?.paymentStatus === 'paid'
  ? 0
  : Number((accountTotalWithBar.value - paymentTotal.value).toFixed(2)))
const checkoutPaymentsTotal = computed(() => Number(checkoutPayments.value.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2)))
const checkoutRemaining = computed(() => Math.max(0, Number((remaining.value - checkoutPaymentsTotal.value).toFixed(2))))
const isCheckoutPaid = computed(() => remaining.value >= 0 && Math.abs(remaining.value - checkoutPaymentsTotal.value) < 0.01)
const isAccountPaid = computed(() => account.value?.paymentStatus === 'paid')

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

const getBarLineTotal = (item) => {
  const qty = Number(item?.quantity || 1)
  const price = Number(item?.price || item?.amount || 0)
  return Number.isFinite(price) ? Number((price * qty).toFixed(2)) : 0
}

const loadBarConsumptions = async () => {
  if (!account.value || !account.value.id) return
  isLoadingBar.value = true
  try {
    const params = new URLSearchParams()
    params.set('reservationId', account.value.id)
    if (account.value.roomId != null) params.set('roomId', account.value.roomId)
    if (account.value.roomName) params.set('room', account.value.roomName)
    if (account.value.checkin) params.set('checkin', account.value.checkin)
    if (account.value.checkout) params.set('checkout', account.value.checkout)
    const response = await axios.get(
      `/api/pms/hotel/get_bar_consumptions?${params.toString()}`,
      { mbarDirect: true }
    )
    barConsumptions.value = response.data?.consumptions || []
    if (!barConsumptions.value.length) {
      const floorResponse = await axios.get('/api/floorplan', { mbarDirect: true })
      const floor = Array.isArray(floorResponse.data) ? floorResponse.data : []
      let barAccount = floor.find(item => String(item?.reservation?.id || '') === String(account.value.id))
      if (!barAccount && account.value.roomId != null) {
        barAccount = floor.find(item => String(item?.id || '') === String(account.value.roomId))
      }
      if (!barAccount) {
        barAccount = floor.find(item => String(item?.name || '').trim() === String(account.value.roomName || '').trim())
      }
      const order = Array.isArray(barAccount?.conto?.order) ? barAccount.conto.order : []
      barConsumptions.value = order.map(item => ({
        id: item?.insert_id || null,
        name: item?.product?.name || 'Prodotto',
        quantity: Number(item?.quantity || 1),
        price: Number(item?.product?.price || 0),
        addedAt: item?.insertTime || null
      }))
    }
  } catch (error) {
    try {
      const floorResponse = await axios.get('/api/floorplan', { mbarDirect: true })
      const floor = Array.isArray(floorResponse.data) ? floorResponse.data : []
      let barAccount = floor.find(item => String(item?.reservation?.id || '') === String(account.value.id))
      if (!barAccount && account.value.roomId != null) {
        barAccount = floor.find(item => String(item?.id || '') === String(account.value.roomId))
      }
      if (!barAccount) {
        barAccount = floor.find(item => String(item?.name || '').trim() === String(account.value.roomName || '').trim())
      }
      const order = Array.isArray(barAccount?.conto?.order) ? barAccount.conto.order : []
      barConsumptions.value = order.map(item => ({
        id: item?.insert_id || null,
        name: item?.product?.name || 'Prodotto',
        quantity: Number(item?.quantity || 1),
        price: Number(item?.product?.price || 0),
        addedAt: item?.insertTime || null
      }))
    } catch (floorError) {
      console.error('Errore caricamento consumazioni bar:', error, floorError)
      barConsumptions.value = []
    }
  } finally {
    isLoadingBar.value = false
  }
}

const printBarAccount = () => {
  const rows = barConsumptions.value.map(item => `
    <div class="row">
      <div>
        <strong>${escapeHtml(item.name)}${Number(item.quantity || 1) > 1 ? ` × ${Number(item.quantity)}` : ''}</strong>
        ${item.addedAt ? `<small>${escapeHtml(formatDateTime(item.addedAt))}</small>` : ''}
      </div>
      <strong>${escapeHtml(formatCurrency(getBarLineTotal(item)))}</strong>
    </div>
  `).join('')
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.border = '0'
  iframe.srcdoc = `
    <!doctype html>
    <html>
      <head>
        <title>Conto bar camera ${escapeHtml(account.value?.roomName || '')}</title>
        <style>
          @page { margin: 15mm; }
          body { margin: 0; font-family: Arial, sans-serif; color: #1e293b; font-size: 13px; }
          h1 { margin: 0 0 4px; font-size: 20px; }
          .guest { margin: 0 0 20px; color: #64748b; }
          .row { display: flex; justify-content: space-between; gap: 20px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }
          .row div { display: flex; flex-direction: column; gap: 3px; }
          small { color: #64748b; }
          .total { display: flex; justify-content: space-between; gap: 20px; margin-top: 16px; padding-top: 12px; border-top: 2px solid #1e293b; font-size: 17px; }
        </style>
      </head>
      <body>
        <h1>Conto bar camera ${escapeHtml(account.value?.roomName || '')}</h1>
        <p class="guest">${escapeHtml(account.value?.guest || '')}</p>
        ${rows}
        <div class="total"><span>Totale bar</span><strong>${escapeHtml(formatCurrency(barConsumptionsTotal.value))}</strong></div>
      </body>
    </html>
  `
  iframe.onload = () => {
    const printWindow = iframe.contentWindow
    printWindow.onafterprint = () => iframe.remove()
    printWindow.focus()
    printWindow.print()
    window.setTimeout(() => iframe.remove(), 60000)
  }
  document.body.appendChild(iframe)
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
    type: String(dep?.type || 'caparra'),
    annulled: Boolean(dep?.annulled)
  })).filter((dep) => Number.isFinite(dep.amount) && dep.amount >= 0 && !dep.annulled)
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

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const loadReservationAccount = async () => {
  if (!reservationId.value) return
  isLoading.value = true
  try {
    await loadHotelPricingPolicy()
    const bookingResponse = await axios.get(`/api/pms/hotel/reservation?id=${encodeURIComponent(reservationId.value)}`)
    const res = bookingResponse.data?.reservation
    if (!res) {
      account.value = null
      return
    }

    const checkin = typeof res.checkin === 'string' ? res.checkin : ''
    const duration = Math.max(1, Number(res.duration || 1))
    const adults = Math.max(0, Number(res.adults ?? res.pax ?? 1))
    const kids = Math.max(0, Number(res.kids ?? 0))
    const kidsAges = normalizeKidsAges(res.kidsAges, kids)
    const roomType = res.roomType || res.room_type?.label || res.room || 'N/D'

    const quote = calculateQuotePrice(checkin, addDaysISO(checkin, duration), roomType, 'hotel', adults + kids, {
      board: String(res.board || 'bb').toLowerCase(),
      adults,
      kids,
      kidAges: kidsAges
    })

    const dailyTotal = Array.isArray(res.price_per_day)
      ? res.price_per_day.reduce((sum, day) => sum + Number(day?.day_total ?? day?.price ?? day?.price_per_room ?? 0), 0)
      : 0
    const storedTotal = Number(res.price_per_room ?? res.price_total ?? res.total_price ?? res.amount ?? 0)
    const hotelNetTotal = res.fixedPrice != null
      ? Number(res.fixedPrice)
      : (dailyTotal > 0 ? dailyTotal : (storedTotal > 0 ? storedTotal : Number(quote?.totalCalculated || 0)))
    const overnightTax = getOvernightTaxSnapshotFromReservation(res) || calculateOvernightTax({ checkin, checkout: addDaysISO(checkin, duration), adults, kids, kidsAges })
    const services = Array.isArray(res.extra?.services) ? res.extra.services : []
    const servicesTotal = Number(services.reduce((sum, svc) => sum + getServiceLineTotal(svc), 0).toFixed(2))

    account.value = {
      id: res.id,      roomId: res.roomId ?? null,      roomName: res.room || `Camera ${res.roomId}`,
      checkin,
      checkout: addDaysISO(checkin, duration),
      duration,
      guest: `${res.accountholder?.firstname || ''} ${res.accountholder?.lastname || ''}`.trim() || 'N/D',
      adults,
      kids,
      board: String(res.board || 'bb').toLowerCase(),
      services,
      servicesTotal,
      overnightTax,
      hotelNetTotal,
      paymentStatus: Number(res.sub_status) === 9 || res.payment_status === 'paid' ? 'paid' : String(res.payment_status || ''),
      accountTotal: Number((hotelNetTotal + Number(overnightTax.total || 0) + servicesTotal).toFixed(2))
    }

    payments.value = normalizeDeposits(res)
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
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('Inserisci un importo valido')
    return
  }
  if (amount - checkoutRemaining.value > 0.001) {
    alert(`L'importo non puo' superare il residuo di ${formatCurrency(checkoutRemaining.value)}`)
    return
  }
  const paymentMethod = hotelPaymentMethods.value.find(method => String(method.id) === String(paymentDraft.value.paymentMethodId))
  if (!paymentMethod) {
    alert('Seleziona un metodo di pagamento')
    return
  }
  const existingPayment = checkoutPayments.value.find(payment => String(payment.paymentMethodId) === String(paymentMethod.id))
  if (existingPayment) {
    existingPayment.amount = Number((Number(existingPayment.amount || 0) + amount).toFixed(2))
  } else {
    checkoutPayments.value.push({
      amount: Number(amount.toFixed(2)),
      paymentDate: toISODate(new Date()),
      paymentMode: paymentMethod.name,
      paymentMethodId: paymentMethod.id,
      electronic: paymentMethod.electronic,
      type: 'saldo'
    })
  }
  paymentDraft.value.amount = ''
}

const removeCheckoutPayment = (index) => {
  const payment = checkoutPayments.value[index]
  if (payment?.overnightTax) {
    payment.amount = payment.overnightTaxAmount
    return
  }
  checkoutPayments.value.splice(index, 1)
}

const loadHotelPaymentMethods = async () => {
  try {
    const response = await axios.get('/api/pms/getconfigs?section=payments', { mbarDirect: true })
    const configured = Array.isArray(response.data?.hotel)
      ? response.data.hotel
      : (Array.isArray(response.data?.payments?.hotel) ? response.data.payments.hotel : [])
    hotelPaymentMethods.value = configured
      .map(method => ({
        id: Number(method?.id),
        name: String(method?.name || '').trim(),
        electronic: Boolean(method?.electronic)
      }))
      .filter(method => Number.isInteger(method.id) && method.id >= 0 && method.name)
    paymentDraft.value.paymentMethodId = hotelPaymentMethods.value.length
      ? String(hotelPaymentMethods.value[0].id)
      : ''
  } catch (error) {
    console.error('Errore caricamento metodi di pagamento:', error)
    hotelPaymentMethods.value = []
  }
}

const prepareOvernightTaxPayment = () => {
  const taxAmount = Math.min(
    Math.max(0, Number(account.value?.overnightTax?.total || 0)),
    Math.max(0, remaining.value)
  )
  if (taxAmount <= 0) return

  const configuredMethodId = hotelPricingPolicy.value?.overnightTax?.defaultPaymentMethodId
  const paymentMethod = hotelPaymentMethods.value.find(method => String(method.id) === String(configuredMethodId))
    || hotelPaymentMethods.value.find(method => method.name.toLowerCase() === 'contanti')
    || hotelPaymentMethods.value[0]
  if (!paymentMethod) return

  taxPaymentMethodId.value = String(paymentMethod.id)
  checkoutPayments.value = [{
    amount: Number(taxAmount.toFixed(2)),
    paymentDate: toISODate(new Date()),
    paymentMode: paymentMethod.name,
    paymentMethodId: paymentMethod.id,
    electronic: paymentMethod.electronic,
    type: 'saldo',
    overnightTax: true,
    overnightTaxAmount: Number(taxAmount.toFixed(2))
  }]
  paymentDraft.value.amount = checkoutRemaining.value || ''
}

const changeOvernightTaxPaymentMethod = () => {
  const paymentMethod = hotelPaymentMethods.value.find(method => String(method.id) === taxPaymentMethodId.value)
  const taxPaymentIndex = checkoutPayments.value.findIndex(payment => payment.overnightTax)
  if (!paymentMethod || taxPaymentIndex < 0) return

  const taxPayment = checkoutPayments.value[taxPaymentIndex]
  const taxAmount = Number(taxPayment.overnightTaxAmount || 0)
  const generalAmount = Number((Number(taxPayment.amount || 0) - taxAmount).toFixed(2))
  if (generalAmount > 0) {
    taxPayment.amount = generalAmount
    delete taxPayment.overnightTax
    delete taxPayment.overnightTaxAmount
  } else {
    checkoutPayments.value.splice(taxPaymentIndex, 1)
  }

  const existingPayment = checkoutPayments.value.find(payment => String(payment.paymentMethodId) === String(paymentMethod.id))
  if (existingPayment) {
    existingPayment.amount = Number((Number(existingPayment.amount || 0) + taxAmount).toFixed(2))
    existingPayment.overnightTax = true
    existingPayment.overnightTaxAmount = taxAmount
  } else {
    checkoutPayments.value.push({
      amount: taxAmount,
      paymentDate: toISODate(new Date()),
      paymentMode: paymentMethod.name,
      paymentMethodId: paymentMethod.id,
      electronic: paymentMethod.electronic,
      type: 'saldo',
      overnightTax: true,
      overnightTaxAmount: taxAmount
    })
  }
}

const printA4 = async () => {
  if (!account.value?.id) return

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Impossibile aprire la finestra di stampa')
    return
  }

  try {
    const response = await axios.post('/api/pms/hotel/account/proforma', {
      reservationId: account.value.id
    }, {
      responseType: 'blob',
      mbarDirect: true
    })
    const pdfUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    printWindow.addEventListener('load', () => {
      window.setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 500)
    }, { once: true })
    printWindow.location.replace(pdfUrl)
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
  } catch (error) {
    printWindow.close()
    console.error('Errore stampa conto A4:', error)
    alert('Impossibile generare il conto A4')
  }
}

const closeAccount = async () => {
  if (!account.value) return
  if (isAccountPaid.value) return
  if (!isCheckoutPaid.value) return

  isClosing.value = true
  try {
    const response = await axios.post('/api/pms/hotel/account/close', {
      reservationId: account.value.id,
      account: {
        ...account.value,
        barTotal: barConsumptionsTotal.value,
        accountTotal: accountTotalWithBar.value
      },
      payments: [...payments.value, ...checkoutPayments.value],
      barConsumptions: barConsumptions.value,
      operator: 0
    }, { mbarDirect: true })
    if (!response.data?.success) {
      alert(response.data?.error || 'Errore chiusura conto')
      return
    }

    alert('Documento fiscale stampato e conto chiuso.')
    checkoutPayments.value = []
    await loadReservationAccount()
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
  await Promise.all([loadReservationAccount(), loadHotelPaymentMethods()])
  prepareOvernightTaxPayment()
  if (account.value?.id) {
    await loadBarConsumptions()
  }
})
</script>

<style scoped>
.payment-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.header h1 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ds-text);
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  padding: 24px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.state {
  color: var(--ds-text-soft);
}

.detail-card h2 {
  margin: 0 0 18px;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--ds-text);
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
  color: var(--ds-text-soft);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 800;
}

.info-item .value {
  color: var(--ds-text);
  font-weight: 700;
}

.lines-block {
  margin-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  padding-top: 16px;
}

.lines-block h3 {
  margin: 0 0 12px;
  color: var(--ds-text);
  font-size: 1rem;
  font-weight: 800;
}

.line-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.24);
  color: var(--ds-text);
}

.line-row:last-child {
  border-bottom: 0;
}

.tax-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(180px, 320px) auto;
  align-items: center;
  color: var(--ds-primary-strong);
}

.tax-row select {
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(29, 140, 242, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
  font: inherit;
}

.total-row {
  font-weight: 700;
  color: var(--ds-text);
}

.services-header-row {
  font-weight: 700;
  color: #166534;
  background: rgba(236, 253, 245, 0.92);
  border: 1px solid rgba(34, 197, 94, 0.16);
  border-radius: 14px;
  padding: 10px 12px;
  margin: 6px 0;
}

.service-line {
  color: var(--ds-text);
  font-size: 0.875rem;
}

.counter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  color: var(--ds-text);
}

.payment-entry-form {
  margin-top: 12px;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1fr) auto;
  gap: 10px;
}

.payment-entry-form input,
.payment-entry-form select {
  min-height: 48px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  padding: 0 14px;
  min-width: 0;
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-text);
}

.payment-entry-form input:focus,
.payment-entry-form select:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.checkout-payment-list {
  margin-top: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  overflow: hidden;
}

.checkout-payment-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.checkout-payment-row:last-child {
  border-bottom: 0;
}

.checkout-payment-row button {
  border: 0;
  background: transparent;
  color: #dc2626;
  font: inherit;
  cursor: pointer;
}

.checkout-payment-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(254, 242, 242, 0.9);
  color: #b91c1c;
}

.checkout-payment-summary--paid {
  background: rgba(236, 253, 245, 0.92);
  color: #166534;
}

.payment-actions-row {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 12px 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
  box-shadow: none;
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

.bar-total-row {
  width: 100%;
  border: 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.24);
  background: transparent;
  font: inherit;
  text-align: left;
  color: var(--ds-text);
}

.bar-total-row--active {
  color: #b45309;
  cursor: pointer;
  font-weight: 700;
}

.bar-total-row--active:hover { background: rgba(255, 251, 235, 0.92); }

.bar-empty-section {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-left: 4px solid #f59e0b;
  border-radius: 20px;
  background: rgba(255, 251, 235, 0.92);
  color: #b45309;
}

.bar-empty-section h4 { margin: 0 0 10px; color: #92400e; }

.bar-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.bar-modal {
  width: min(620px, 100%);
  max-height: 85vh;
  overflow: auto;
  padding: 24px;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
}

.bar-modal-header,
.bar-account-row,
.bar-account-total,
.bar-modal-actions {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.bar-modal-header h2 { margin: 0 0 4px; }
.bar-modal-header p { margin: 0; color: var(--ds-text-soft); }
.bar-modal-close { border: 0; background: transparent; font-size: 2rem; cursor: pointer; color: var(--ds-text-soft); }
.bar-account-list { margin-top: 20px; }
.bar-account-row { align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.2); }
.bar-account-row div { display: flex; flex-direction: column; gap: 3px; }
.bar-account-row div span { color: var(--ds-text-soft); font-size: 0.78rem; }
.bar-account-row > span { font-weight: 700; white-space: nowrap; }
.bar-account-total { padding: 18px 0 4px; font-size: 1.1rem; }
.bar-modal-actions { justify-content: flex-end; margin-top: 24px; }


@media (max-width: 900px) {
  .header,
  .payment-actions-row {
    flex-direction: column;
    align-items: stretch;
  }

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
    background: transparent;
  }
}
</style>
