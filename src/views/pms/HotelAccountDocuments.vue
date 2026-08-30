<template>
  <div class="guest-account-page">
    <div class="header">
      <div>
        <h1>Documenti Hotel</h1>
      </div>
      <div class="header-actions">
        <form class="filters" @submit.prevent="searchAccounts">
          <label class="account-search">Camera o cliente<input v-model="searchText" type="search" placeholder="Camera o nome cliente" /></label>
          <label>Dal<input v-model="fromDate" type="date" :disabled="currentYear" /></label>
          <label>Al<input v-model="toDate" type="date" :disabled="currentYear" /></label>
          <label class="current-year-filter"><input v-model="currentYear" type="checkbox" /> Anno corrente</label>
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            {{ isLoading ? 'Caricamento...' : 'Cerca' }}
          </button>
        </form>
        <div v-if="hasPermission('daily-close')" class="fiscal-close-action">
          <button type="button" class="btn btn-danger" @click="closeFiscalDay" :disabled="isClosingFiscalDay">
            {{ isClosingFiscalDay ? 'Chiusura in corso...' : 'Chiusura giornaliera' }}
          </button>
        </div>
      </div>
    </div>

    <section class="card">
      <h2>Elenco Documenti</h2>
      <div v-if="isLoading" class="state">Caricamento documenti in corso...</div>
      <div v-else-if="accounts.length === 0" class="state">Nessun documento nel periodo selezionato.</div>
      <div v-else class="accounts-table-wrap">
        <table class="accounts-table">
          <thead>
            <tr>
              <th>N.</th>
              <th>Tipo</th>
              <th>Chiuso il</th>
              <th>Cliente</th>
              <th>Camera</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in accounts" :key="account.id" :class="{ selected: selectedAccountId === account.id }" @click="selectedAccountId = account.id">
              <td>{{ account.progressive || account.progressivo || '-' }}</td>
              <td>{{ account.documentType === 'deposit' ? 'Deposito' : 'Conto' }}</td>
              <td>{{ formatDateTime(account.closedAt) }}</td>
              <td>{{ guestName(account) }}</td>
              <td>{{ account.room || '-' }}</td>
              <td class="total-cell">{{ formatCurrency(account.documentType === 'deposit' ? account.totale : account.accountTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="selectedAccount" class="card detail-card">
      <h2>Dettaglio {{ selectedAccount.documentType === 'deposit' ? 'Deposito' : 'Conto' }} n. {{ selectedAccount.progressive || selectedAccount.progressivo || '-' }}</h2>
      <div class="info-grid">
        <div class="info-item"><span class="label">Cliente</span><span class="value">{{ guestName(selectedAccount) }}</span></div>
        <div class="info-item"><span class="label">Camera</span><span class="value">{{ selectedAccount.room || '-' }}</span></div>
        <div class="info-item"><span class="label">Data chiusura</span><span class="value">{{ formatDateTime(selectedAccount.closedAt) }}</span></div>
        <div class="info-item">
          <span class="label">Prenotazione</span>
          <button v-if="selectedAccount.reservationId" type="button" class="reservation-link" @click="openReservation(selectedAccount)">{{ selectedAccount.reservationId }}</button>
          <span v-else class="value">-</span>
        </div>
        <div class="info-item"><span class="label">Progressivo fiscale</span><span class="value">{{ selectedAccount.progressivo || '-' }}</span></div>
        <div class="info-item"><span class="label">Chiusura fiscale</span><span class="value">{{ selectedAccount.chiusura || '-' }}</span></div>
        <div class="info-item"><span class="label">Operatore</span><span class="value">{{ operatorName(selectedAccount) }}</span></div>
        <div v-if="selectedAccount.documentType === 'deposit'" class="info-item"><span class="label">Stato</span><span class="value">{{ selectedAccount.annulled ? 'Annullato' : 'Emesso' }}</span></div>
      </div>

      <div v-if="selectedAccount.documentType === 'deposit'" class="lines-block">
        <h3>Riepilogo deposito</h3>
        <div class="line-row"><span>{{ selectedAccount.sale?.description || 'Acconto' }}</span><span>{{ formatCurrency(selectedAccount.deposit?.amount) }}</span></div>
        <div class="line-row"><span>Pagamento {{ selectedAccount.deposit?.payment_mode || '-' }}</span><span>{{ formatCurrency(selectedAccount.deposit?.amount) }}</span></div>
        <div class="line-row"><span>Periodo</span><span>{{ formatDate(selectedAccount.checkin) }} - {{ formatDate(selectedAccount.checkout) }}</span></div>
        <div class="line-row total-row"><span>Totale deposito</span><span>{{ formatCurrency(selectedAccount.totale) }}</span></div>
      </div>

      <div v-else class="lines-block">
        <h3>Riepilogo conto</h3>
        <div class="line-row"><span>Soggiorno</span><span>{{ formatCurrency(selectedAccount.soggiorno) }}</span></div>
        <div class="line-row tax-row"><span>Tassa di soggiorno</span><span>{{ formatCurrency(selectedAccount.cityTax) }}</span></div>
        <div v-if="itemsTotal(selectedAccount.extra?.services) > 0" class="line-row"><span>Servizi</span><span>{{ formatCurrency(itemsTotal(selectedAccount.extra?.services)) }}</span></div>
        <div v-if="itemsTotal(selectedAccount.extra?.bar) > 0" class="line-row"><span>Bar</span><span>{{ formatCurrency(itemsTotal(selectedAccount.extra?.bar)) }}</span></div>
        <div v-if="itemsTotal(selectedAccount.extra?.restaurant) > 0" class="line-row"><span>Ristorante</span><span>{{ formatCurrency(itemsTotal(selectedAccount.extra?.restaurant)) }}</span></div>
        <div v-if="itemsTotal(selectedAccount.extra?.hotel) > 0" class="line-row"><span>Altri extra hotel</span><span>{{ formatCurrency(itemsTotal(selectedAccount.extra?.hotel)) }}</span></div>
        <div class="line-row total-row"><span>Totale conto</span><span>{{ formatCurrency(selectedAccount.accountTotal) }}</span></div>
      </div>

      <div v-if="selectedAccount.documentType !== 'deposit' && nonZeroItems(selectedAccount.extra?.services).length" class="lines-block">
        <h3>Servizi</h3>
        <div v-for="(service, index) in nonZeroItems(selectedAccount.extra?.services)" :key="`service-${index}`" class="line-row">
          <span>{{ service.name || 'Servizio' }}<span v-if="Number(service.quantity) > 1" class="muted"> x{{ service.quantity }}</span><span v-if="service.note" class="muted"> — {{ service.note }}</span></span>
          <span>{{ formatCurrency(itemTotal(service)) }}</span>
        </div>
      </div>

      <div v-if="selectedAccount.documentType !== 'deposit' && nonZeroItems(selectedAccount.extra?.bar).length" class="lines-block">
        <h3>Documenti bar</h3>
        <div v-for="(item, index) in nonZeroItems(selectedAccount.extra?.bar)" :key="`bar-${index}`" class="line-row">
          <span>{{ Number(item.docId) === 0 ? 'Conto bar aperto incluso' : `Documento ${item.docId}` }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
        </div>
      </div>

      <div v-if="selectedAccount.documentType !== 'deposit'" class="lines-block">
        <h3>Caparre e pagamenti</h3>
        <div v-for="(deposit, index) in selectedAccount.deposits || []" :key="`deposit-${index}`" class="line-row">
          <span>
            Caparra · {{ formatDate(deposit.payment_date) }} · {{ deposit.payment_mode || '-' }}
            · <span v-if="deposit.invoice_progressive">Documento H5S {{ deposit.invoice_progressive }}</span>
            <span v-else class="document-error">documento non trovato</span>
          </span>
          <span>{{ formatCurrency(deposit.amount) }}</span>
        </div>
        <div v-for="(payment, index) in selectedAccount.payments || []" :key="`payment-${index}`" class="line-row">
          <span>Saldo · {{ formatDate(payment.payment_date) }} · {{ payment.payment_mode || '-' }}</span>
          <span>{{ formatCurrency(payment.amount) }}</span>
        </div>
        <div v-if="!selectedAccount.deposits?.length && !selectedAccount.payments?.length" class="line-row"><span>Nessun pagamento registrato</span><span>{{ formatCurrency(0) }}</span></div>
        <div class="line-row"><span>Totale caparre</span><span>{{ formatCurrency(itemsTotal(selectedAccount.deposits)) }}</span></div>
        <div class="line-row"><span>Totale pagamenti a saldo</span><span>{{ formatCurrency(selectedAccount.totalPayments) }}</span></div>
      </div>
    </section>

    <div v-if="showReservationDialog" class="modal-overlay" @click.self="closeReservationDialog">
      <form class="reservation-dialog" @submit.prevent="saveReservation">
        <div class="modal-header">
          <h3>Modifica Prenotazione</h3>
          <button type="button" class="modal-close" aria-label="Chiudi" @click="closeReservationDialog">×</button>
        </div>
        <div v-if="isLoadingReservation" class="state">Caricamento prenotazione...</div>
        <template v-else-if="reservationForm">
          <div class="reservation-grid">
            <section class="dialog-section">
              <h4>Prenotazione</h4>
              <label>Camera
                <select v-model="reservationForm.roomId" required>
                  <option v-for="room in rooms" :key="room.id" :value="String(room.id)">{{ room.description }}</option>
                </select>
              </label>
              <div class="form-row">
                <label>Check-in<input v-model="reservationForm.checkin" type="date" required /></label>
                <label>Check-out<input v-model="reservationForm.checkout" type="date" required /></label>
              </div>
              <label>Trattamento
                <select v-model="reservationForm.board">
                  <option value="BB">BB</option><option value="HB">HB</option><option value="FB">FB</option>
                </select>
              </label>
            </section>
            <section class="dialog-section">
              <h4>Ospite</h4>
              <div class="form-row">
                <label>Nome<input v-model="reservationForm.firstname" type="text" required /></label>
                <label>Cognome<input v-model="reservationForm.lastname" type="text" required /></label>
              </div>
              <div class="form-row">
                <label>Adulti<input v-model.number="reservationForm.adults" type="number" min="1" /></label>
                <label>Bambini<input v-model.number="reservationForm.kids" type="number" min="0" /></label>
              </div>
              <div v-if="reservationForm.kids > 0" class="kids-ages">
                <label v-for="(_, index) in reservationForm.kidsAges" :key="`kid-${index}`">Età bambino {{ index + 1 }}
                  <input v-model.number="reservationForm.kidsAges[index]" type="number" min="0" max="17" />
                </label>
              </div>
              <label>Note prenotazione<textarea v-model="reservationForm.notes" rows="4" maxlength="1000" /></label>
            </section>
            <section class="dialog-section dialog-section-full">
              <h4>Prezzo</h4>
              <label class="manual-price"><input v-model="reservationForm.isManualPrice" type="checkbox" /> Applica prezzo manuale</label>
              <label v-if="reservationForm.isManualPrice">Totale concordato (€)<input v-model.number="reservationForm.fixedPrice" type="number" min="0" step="0.01" /></label>
              <div class="reservation-total">
                <span>{{ reservationForm.isManualPrice ? 'Totale concordato' : 'Totale calcolato' }}</span>
                <strong>{{ formatCurrency(reservationForm.isManualPrice ? reservationForm.fixedPrice : reservationForm.calculatedPrice) }}</strong>
              </div>
            </section>
            <section class="dialog-section dialog-section-full">
              <h4>Deposit</h4>
              <div v-if="!reservationForm.deposits.length" class="empty-dialog-row">Nessun deposit inserito</div>
              <div v-else class="dialog-list">
                <div v-for="(deposit, index) in reservationForm.deposits" :key="`deposit-${index}`" class="dialog-list-row">
                  <strong>{{ formatCurrency(deposit.amount) }}</strong>
                  <span>{{ formatDate(deposit.payment_date || deposit.paymentDate) }}</span>
                  <span>{{ deposit.payment_mode || deposit.paymentMode || '-' }}</span>
                  <button
                    v-if="deposit.document_id || deposit.documentId"
                    type="button"
                    class="deposit-document-link"
                    @click="showDepositDocument(deposit)"
                  >Documento {{ deposit.progressivo || '' }}</button>
                </div>
              </div>
            </section>
            <section class="dialog-section dialog-section-full">
              <h4>Servizi extra</h4>
              <div v-if="!reservationForm.services.length" class="empty-dialog-row">Nessun servizio assegnato</div>
              <div v-else class="dialog-list">
                <div v-for="(service, index) in reservationForm.services" :key="`service-${index}`" class="dialog-list-row">
                  <span>{{ service.name || 'Servizio' }} × {{ service.quantity || 1 }}</span>
                  <span v-if="service.note" class="service-note">{{ service.note }}</span>
                  <strong>{{ formatCurrency(itemTotal(service)) }}</strong>
                </div>
              </div>
            </section>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" @click="closeReservationDialog">Annulla</button>
            <button type="submit" class="btn btn-primary" :disabled="isSavingReservation">{{ isSavingReservation ? 'Salvataggio...' : 'Salva' }}</button>
          </div>
        </template>
        <div v-else class="state document-error">Prenotazione non trovata.</div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const { currentUser, getLoginUsers, hasPermission } = useAuth()
const isLoading = ref(false)
const loadedAccounts = ref([])
const operators = ref([])
const selectedAccountId = ref(null)
const isClosingFiscalDay = ref(false)
const showReservationDialog = ref(false)
const isLoadingReservation = ref(false)
const isSavingReservation = ref(false)
const reservationForm = ref(null)
const reservationSource = ref(null)
const rooms = ref([])
const today = new Date()
const defaultFrom = new Date(today)
defaultFrom.setDate(defaultFrom.getDate() - 30)
const fromDate = ref(toISODate(defaultFrom))
const toDate = ref(toISODate(today))
const searchText = ref('')
const appliedSearchText = ref('')
const currentYear = ref(false)

const accounts = computed(() => {
  const query = appliedSearchText.value.trim().toLocaleLowerCase('it-IT')
  if (!query) return loadedAccounts.value
  return loadedAccounts.value.filter((account) => {
    const room = String(account.room || '').toLocaleLowerCase('it-IT')
    const customer = guestName(account).toLocaleLowerCase('it-IT')
    return room.includes(query) || customer.includes(query)
  })
})

const selectedAccount = computed(() => {
  if (!accounts.value.length) return null
  return accounts.value.find((account) => account.id === selectedAccountId.value) || accounts.value[0]
})

function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatCurrency = (value) => {
  const number = Number(value)
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(number) ? number : 0)
}

const guestName = (account) => `${account?.accountholder?.firstname || ''} ${account?.accountholder?.lastname || ''}`.trim() || account?.reservationName || account?.accountholder?.name || 'N/D'

const operatorName = (account) => {
  if (account.operator == null) return 'Admin'
  const operator = operators.value.find(item => String(item.id) === String(account.operator))
  return operator?.name || `Operatore #${account.operator}`
}

const itemTotal = (item) => {
  const amount = Number(item?.amount ?? item?.total)
  if (Number.isFinite(amount)) return amount
  const price = Number(item?.price)
  const quantity = Number(item?.quantity || 1)
  return Number.isFinite(price) ? price * (Number.isFinite(quantity) ? quantity : 1) : 0
}

const itemsTotal = (items) => (Array.isArray(items) ? items : []).reduce((sum, item) => sum + itemTotal(item), 0)

const nonZeroItems = (items) => (Array.isArray(items) ? items : []).filter((item) => itemTotal(item) !== 0)

const openReservation = async (account) => {
  showReservationDialog.value = true
  isLoadingReservation.value = true
  reservationForm.value = null
  try {
    const [roomsResponse, bookingsResponse] = await Promise.all([
      axios.get('/api/pms/getrooms'),
      axios.get('/api/pms/getbookingsbyrange', { params: { from: account.checkin, to: account.checkout || account.checkin } })
    ])
    rooms.value = Array.isArray(roomsResponse.data) ? roomsResponse.data : []
    const bookings = bookingsResponse.data?.bookings || bookingsResponse.data || []
    const reservation = bookings.find(item => String(item.id) === String(account.reservationId))
    if (!reservation) return
    reservationSource.value = reservation
    reservationForm.value = {
      id: reservation.id,
      roomId: String(reservation.roomId ?? rooms.value.find(room => String(room.room_code) === String(reservation.room))?.id ?? ''),
      checkin: reservation.checkin || '',
      checkout: reservation.checkout || '',
      board: String(reservation.board || 'BB').toUpperCase(),
      firstname: reservation.accountholder?.firstname || reservation.guests?.[0]?.firstname || '',
      lastname: reservation.accountholder?.lastname || reservation.guests?.[0]?.lastname || '',
      adults: Number(reservation.adults ?? reservation.pax ?? 1),
      kids: Number(reservation.kids || 0),
      notes: Array.isArray(reservation.notes) ? reservation.notes.join('\n') : '',
      kidsAges: Array.isArray(reservation.kidsAges) ? [...reservation.kidsAges] : [],
      isManualPrice: reservation.fixedPrice != null,
      fixedPrice: reservation.fixedPrice ?? 0,
      calculatedPrice: reservation.price_total ?? reservation.price_per_room ?? reservation.amount ?? 0,
      deposits: Array.isArray(reservation.deposits) ? reservation.deposits : [],
      services: Array.isArray(reservation.extra?.services) ? reservation.extra.services : []
    }
  } catch (error) {
    console.error('Errore caricamento prenotazione:', error)
  } finally {
    isLoadingReservation.value = false
  }
}

const closeReservationDialog = () => {
  showReservationDialog.value = false
  reservationForm.value = null
  reservationSource.value = null
}

const showDepositDocument = (deposit) => {
  const documentId = String(deposit.document_id || deposit.documentId || '')
  if (!documentId || !accounts.value.some(account => String(account.id) === documentId)) return
  selectedAccountId.value = documentId
  closeReservationDialog()
}

const saveReservation = async () => {
  const form = reservationForm.value
  if (!form) return
  const checkin = new Date(`${form.checkin}T00:00:00`)
  const checkout = new Date(`${form.checkout}T00:00:00`)
  const duration = Math.round((checkout - checkin) / 86400000)
  if (duration <= 0) {
    alert('La data di check-out deve essere successiva al check-in')
    return
  }
  isSavingReservation.value = true
  try {
    await axios.post('/api/pms/hotel/update_reservation', {
      id: form.id,
      operator: currentUser.value.id,
      updatedBy: currentUser.value.id,
      updatedAt: new Date().toISOString(),
      roomId: form.roomId,
      firstname: form.firstname,
      lastname: form.lastname,
      adults: Number(form.adults),
      kids: Number(form.kids),
      kidsAges: form.kidsAges,
      checkin: form.checkin,
      checkout: form.checkout,
      duration,
      board: form.board,
      fixedPrice: form.isManualPrice ? Number(form.fixedPrice) : null,
      isManualPrice: form.isManualPrice,
      notes: form.notes.trim() ? [form.notes.trim()] : [],
      deposits: form.deposits,
      extra: {
        services: form.services,
        bar: Array.isArray(reservationSource.value?.extra?.bar) ? reservationSource.value.extra.bar : [],
        restaurant: Array.isArray(reservationSource.value?.extra?.restaurant) ? reservationSource.value.extra.restaurant : [],
        hotel: Array.isArray(reservationSource.value?.extra?.hotel) ? reservationSource.value.extra.hotel : []
      }
    })
    closeReservationDialog()
    await loadAccounts()
  } catch (error) {
    console.error('Errore salvataggio prenotazione:', error)
    alert(error.response?.data?.error || 'Errore durante il salvataggio della prenotazione')
  } finally {
    isSavingReservation.value = false
  }
}

const applyRouteSelection = () => {
  const documentId = String(route.query.documentId || '').trim()
  const reservationId = String(route.query.reservationId || '').trim()
  const found = accounts.value.find((account) => (documentId && String(account.id) === documentId) || (reservationId && String(account.reservationId) === reservationId))
  if (found) selectedAccountId.value = found.id
}

const loadAccounts = async () => {
  isLoading.value = true
  try {
    const year = today.getFullYear()
    const from = currentYear.value ? `${year}-01-01` : fromDate.value
    const to = currentYear.value ? `${year}-12-31` : toDate.value
    const response = await axios.get('/api/pms/hotel/account/documents', { params: { from, to } })
    loadedAccounts.value = Array.isArray(response.data) ? response.data : []
    if (!accounts.value.some((account) => account.id === selectedAccountId.value)) selectedAccountId.value = accounts.value[0]?.id || null
    applyRouteSelection()
  } catch (error) {
    console.error('Errore caricamento documenti conto hotel:', error)
    alert('Errore caricamento conti hotel')
  } finally {
    isLoading.value = false
  }
}

const searchAccounts = async () => {
  appliedSearchText.value = searchText.value
  await loadAccounts()
}

const closeFiscalDay = async () => {
  if (!window.confirm('Confermi la chiusura fiscale giornaliera della stampante hotel? L’operazione non è annullabile.')) return
  isClosingFiscalDay.value = true
  try {
    const response = await axios.post('/api/pms/hotel/daily-close', {}, { mbarDirect: true })
    if (!response.data?.success) throw new Error(response.data?.error || 'Chiusura fiscale non completata')
    alert(`Chiusura fiscale hotel n. ${response.data.report.chiusura} completata. Documenti consolidati: ${response.data.report.report.items}.`)
    await loadAccounts()
  } catch (error) {
    console.error('Errore chiusura fiscale hotel:', error)
    alert(error?.response?.data?.error || error?.message || 'Errore durante la chiusura fiscale hotel')
  } finally {
    isClosingFiscalDay.value = false
  }
}

watch(() => [route.query.documentId, route.query.reservationId], applyRouteSelection)
watch(() => reservationForm.value?.kids, (value) => {
  if (!reservationForm.value) return
  const count = Math.max(0, Number(value) || 0)
  reservationForm.value.kidsAges = reservationForm.value.kidsAges.slice(0, count)
  while (reservationForm.value.kidsAges.length < count) reservationForm.value.kidsAges.push(1)
})
onMounted(async () => {
  try {
    operators.value = await getLoginUsers()
  } catch (error) {
    console.error('Errore caricamento operatori:', error)
  }
  await loadAccounts()
})
</script>

<style scoped>
.guest-account-page { display: flex; flex-direction: column; gap: 20px; max-width: 1320px; margin: 0 auto; padding: 8px; }
.header { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; padding: 24px 28px; border-radius: 28px; background: rgba(255, 255, 255, 0.8); border: 1px solid rgba(148, 163, 184, 0.18); box-shadow: var(--ds-shadow-card); }
.header h1, .card h2, .lines-block h3 { margin: 0; color: var(--ds-text); }
.header h1 { font-size: clamp(1.8rem, 2vw, 2.2rem); font-weight: 800; letter-spacing: -0.04em; }
.header p { margin: 4px 0 0; color: var(--ds-text-soft); }
.header-actions { display: flex; align-items: end; gap: 18px; flex-wrap: wrap; }
.filters { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; }
.filters label { display: flex; flex-direction: column; gap: 6px; color: var(--ds-text-soft); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
.filters input { min-width: 150px; padding: 12px 14px; border: 1px solid var(--ds-border); border-radius: 16px; background: var(--ds-surface); color: var(--ds-text); }
.filters input:disabled { opacity: 0.55; cursor: not-allowed; }
.filters .account-search input { min-width: 220px; }
.filters .current-year-filter { flex-direction: row; align-items: center; min-height: 43px; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.filters .current-year-filter input { min-width: 0; }
.btn { border: 0; border-radius: 16px; padding: 13px 18px; font-weight: 800; cursor: pointer; }
.btn-primary { color: white; background: var(--ds-primary); }
.btn-danger { color: white; background: #b91c1c; }
.fiscal-close-action { display: flex; flex-direction: column; gap: 6px; padding-left: 18px; border-left: 1px solid var(--ds-border); }
.btn:disabled { opacity: 0.6; cursor: wait; }
.card { padding: 20px; border: 1px solid var(--ds-border); border-radius: 26px; background: var(--ds-surface); box-shadow: var(--ds-shadow-card); }
.card h2 { margin-bottom: 16px; font-size: 1.15rem; }
.state { padding: 28px; color: var(--ds-text-soft); text-align: center; }
.accounts-table-wrap { overflow-x: auto; }
.accounts-table { width: 100%; border-collapse: collapse; }
.accounts-table th, .accounts-table td { padding: 12px 10px; border-bottom: 1px solid var(--ds-border); text-align: left; white-space: nowrap; }
.accounts-table th { color: var(--ds-text-soft); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
.accounts-table tbody tr { cursor: pointer; }
.accounts-table tbody tr:hover, .accounts-table tbody tr.selected { background: var(--ds-primary-soft); }
.total-cell, .total-row { font-weight: 800; }
.detail-card { display: flex; flex-direction: column; gap: 18px; }
.info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.info-item { display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 16px; background: var(--ds-surface-soft); }
.info-item .label { color: var(--ds-text-soft); font-size: 0.72rem; font-weight: 800; text-transform: uppercase; }
.info-item .value { overflow-wrap: anywhere; color: var(--ds-text); font-weight: 700; }
.reservation-link { padding: 0; border: 0; background: none; overflow-wrap: anywhere; color: var(--ds-primary); font: inherit; font-weight: 700; text-align: left; text-decoration: underline; cursor: pointer; }
.modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 23, 42, 0.55); }
.reservation-dialog { width: min(900px, 100%); max-height: calc(100vh - 48px); overflow-y: auto; border-radius: 24px; background: #ffffff; box-shadow: 0 24px 70px rgba(15, 23, 42, 0.3); }
.modal-header, .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px; border-bottom: 1px solid var(--ds-border); }
.modal-header h3, .dialog-section h4 { margin: 0; color: var(--ds-text); }
.modal-close { border: 0; background: none; color: var(--ds-text-soft); font-size: 30px; cursor: pointer; }
.reservation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 24px; }
.dialog-section { display: flex; flex-direction: column; gap: 14px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 18px; background: #f8fafc; }
.dialog-section-full { grid-column: 1 / -1; }
.dialog-section label { display: flex; flex-direction: column; gap: 6px; color: var(--ds-text-soft); font-size: 0.8rem; font-weight: 700; }
.dialog-section input, .dialog-section select, .dialog-section textarea { width: 100%; padding: 11px 12px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; color: var(--ds-text); font: inherit; }
.form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.kids-ages { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
.dialog-section .manual-price { flex-direction: row; align-items: center; }
.manual-price input { width: auto; }
.reservation-total { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 14px; background: #e0f2fe; color: var(--ds-text); }
.reservation-total strong { font-size: 1.15rem; }
.dialog-list { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff; }
.dialog-list-row { display: flex; align-items: center; gap: 18px; padding: 12px 14px; border-top: 1px solid #e2e8f0; color: var(--ds-text); }
.dialog-list-row:first-child { border-top: 0; }
.dialog-list-row strong:last-child { margin-left: auto; }
.empty-dialog-row { padding: 18px; border-radius: 14px; background: #ffffff; color: var(--ds-text-soft); text-align: center; }
.deposit-document-link { margin-left: auto; padding: 0; border: 0; background: none; color: var(--ds-primary); font: inherit; font-size: 0.82rem; font-weight: 700; text-decoration: underline; cursor: pointer; }
.service-note { color: var(--ds-text-soft); }
.modal-footer { justify-content: flex-end; border-top: 1px solid var(--ds-border); border-bottom: 0; }
.lines-block { overflow: hidden; border: 1px solid var(--ds-border); border-radius: 18px; }
.lines-block h3 { padding: 14px 16px; background: var(--ds-surface-soft); font-size: 0.95rem; }
.line-row { display: flex; justify-content: space-between; gap: 20px; padding: 12px 16px; border-top: 1px solid var(--ds-border); }
.tax-row, .muted { color: var(--ds-text-soft); }
.total-row { background: var(--ds-primary-soft); }
.document-error { color: #b91c1c; font-weight: 700; }
@media (max-width: 700px) {
  .header, .card { padding: 16px; border-radius: 20px; }
  .filters, .filters label, .filters input, .filters button { width: 100%; }
  .header-actions, .fiscal-close-action, .fiscal-close-action button { width: 100%; }
  .fiscal-close-action { padding: 16px 0 0; border-left: 0; border-top: 1px solid var(--ds-border); }
}
</style>
