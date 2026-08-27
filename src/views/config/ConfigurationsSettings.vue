<template>
  <div class="settings-page">
    <div class="header">
      <h1>Configurazioni</h1>
      <p>Impostazioni generali del PMS in una vista coerente con la nuova shell operativa.</p>
    </div>

    <section class="card">
      <div class="card-heading">
        <div>
          <h2>Aliquote IVA</h2>
        </div>
      </div>

      <div class="vat-rate-list">
        <div v-for="(rate, index) in vatRatesForm" :key="rate" class="vat-rate-row">
          <strong>{{ formatVatRate(rate) }}%</strong>
          <button type="button" class="remove-button" @click="removeVatRate(index)">Elimina</button>
        </div>
      </div>

      <form class="vat-rate-form" @submit.prevent="addVatRate">
        <label class="field-label">
          Nuova aliquota (%)
          <input
            v-model.number="vatRateDraft"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="es. 10"
            required
          />
        </label>
        <button type="submit" class="btn btn-secondary">+ Aggiungi aliquota</button>
      </form>
    </section>

    <section class="card">
      <div class="card-heading">
        <div>
          <h2>PMS</h2>
        </div>
        <span class="status-pill" :class="{ active: form.enabled }">
          {{ form.enabled ? 'Attivo' : 'Disattivato' }}
        </span>
      </div>
      <div class="params-grid">
        <label class="checkbox-stack">
          <div>
            <strong>PMS abilitato</strong>
            <small>Consente l’accesso alle viste operative principali.</small>
          </div>
          <input v-model="form.enabled" type="checkbox" />
        </label>
      </div>
    </section>

    <section class="card">
      <div class="card-heading">
        <div>
          <h2>Pagamenti</h2>
        </div>
      </div>

      <div class="payments-grid">
        <div v-for="group in paymentGroups" :key="group.key" class="payment-group">
          <div class="payment-group-heading">
            <div>
              <h3>Pagamenti {{ group.label }}</h3>
              <small>{{ paymentsForm[group.key].length }} modalita' configurate</small>
            </div>
          </div>

          <div v-if="paymentsForm[group.key].length" class="payment-list">
            <div
              v-for="(payment, index) in paymentsForm[group.key]"
              :key="`${payment.id}-${index}`"
              class="payment-row"
            >
              <div>
                <strong>{{ payment.name }}</strong>
                <small>ID {{ payment.id }} · {{ payment.electronic ? 'Elettronico' : 'Non elettronico' }}</small>
              </div>
              <button type="button" class="remove-button" @click="removePayment(group.key, index)">
                Elimina
              </button>
            </div>
          </div>
          <p v-else class="payment-empty">Nessuna modalita' di pagamento configurata.</p>

          <form class="payment-form" @submit.prevent="addPayment(group.key)">
            <div class="payment-fields">
              <label class="field-label">
                ID
                <input
                  v-model.number="paymentDrafts[group.key].id"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="es. 1"
                  required
                />
              </label>
              <label class="field-label">
                Nome
                <input
                  v-model="paymentDrafts[group.key].name"
                  type="text"
                  :placeholder="group.key === 'bar' ? 'es. Bancomat' : 'es. Bonifico'"
                  required
                />
              </label>
            </div>
            <label class="toggle-field">
              <span>
                <strong>Elettronico</strong>
                <small>{{ paymentDrafts[group.key].electronic ? 'Si' : 'No' }}</small>
              </span>
              <input v-model="paymentDrafts[group.key].electronic" type="checkbox" />
            </label>
            <button type="submit" class="btn btn-secondary">+ Aggiungi pagamento</button>
          </form>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-heading">
        <div>
          <h2>Dati Struttura per Stampa A4</h2>
        </div>
      </div>
      <div class="params-grid">
        <label class="field-label">
          Nome struttura
          <input v-model="structureForm.name" type="text" placeholder="es. Hotel Riviera" />
        </label>
        <label class="field-label">
          Indirizzo
          <input v-model="structureForm.address" type="text" placeholder="es. Via Roma 1" />
        </label>
        <label class="field-label">
          Citta'
          <input v-model="structureForm.city" type="text" placeholder="es. Jesolo" />
        </label>
        <label class="field-label">
          P.IVA
          <input v-model="structureForm.vatNumber" type="text" placeholder="es. IT01234567890" />
        </label>
        <label class="field-label full-width">
          URL logo file
          <input v-model="structureForm.logoUrl" type="text" placeholder="es. https://dominio/logo.png" />
        </label>
      </div>
    </section>

    <section class="card">
      <div class="card-heading">
        <div>
          <h2>Stampante fiscale hotel</h2>
          <small>Configurazione dedicata ai documenti e alle chiusure fiscali dell’hotel.</small>
        </div>
      </div>
      <div class="params-grid">
        <label class="field-label">
          Nome
          <input v-model="hotelFiscalPrinterForm.name" type="text" placeholder="es. HOTEL" />
        </label>
        <label class="field-label">
          Indirizzo IP
          <input v-model="hotelFiscalPrinterForm.address" type="text" placeholder="es. 192.168.1.20" />
        </label>
        <label class="field-label">
          Porta
          <input v-model.number="hotelFiscalPrinterForm.port" type="number" min="1" max="65535" step="1" placeholder="8080" />
        </label>
      </div>
    </section>

    <div class="footer-actions">
      <button type="button" class="btn btn-secondary" @click="loadForm" :disabled="loading">Ricarica</button>
      <button type="button" class="btn btn-primary" @click="save" :disabled="loading">Salva Configurazioni</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const loading = ref(false)
const globalConfigs = ref({})
const hotelSection = ref({})
const form = ref({
  enabled: true
})
const vatRatesForm = ref([10, 22])
const vatRateDraft = ref('')
const structureForm = ref({
  name: '',
  address: '',
  city: '',
  vatNumber: '',
  logoUrl: ''
})
const hotelFiscalPrinterForm = ref({ name: 'HOTEL', address: '', port: 8080 })
const paymentGroups = [
  { key: 'bar', label: 'BAR' },
  { key: 'hotel', label: 'HOTEL' }
]
const paymentsForm = ref({
  bar: [],
  hotel: []
})
const paymentDrafts = ref({
  bar: { id: '', name: '', electronic: false },
  hotel: { id: '', name: '', electronic: false }
})

const normalizeBooleanLike = (value, defaultValue = true) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  }
  return defaultValue
}

const normalizePmsConfig = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    ...source,
    enabled: normalizeBooleanLike(source.enabled, true)
  }
}

const normalizeVatRates = (value) => {
  if (!Array.isArray(value)) return [10, 22]

  return [...new Set(value
    .map((rate) => Number(rate))
    .filter((rate) => Number.isFinite(rate) && rate >= 0 && rate <= 100))]
    .sort((a, b) => a - b)
}

const formatVatRate = (value) => Number(value).toLocaleString('it-IT', {
  maximumFractionDigits: 2
})

const addVatRate = () => {
  const rate = Number(vatRateDraft.value)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return
  if (vatRatesForm.value.includes(rate)) {
    alert(`L'aliquota IVA ${formatVatRate(rate)}% e' gia' configurata.`)
    return
  }

  vatRatesForm.value.push(rate)
  vatRatesForm.value.sort((a, b) => a - b)
  vatRateDraft.value = ''
}

const removeVatRate = (index) => {
  vatRatesForm.value.splice(index, 1)
}

const normalizeStructureForm = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    name: String(source.name || source.businessName || '').trim(),
    address: String(source.address || source.street || '').trim(),
    city: String(source.city || '').trim(),
    vatNumber: String(source.vatNumber || source.vat || source.piva || '').trim(),
    logoUrl: String(source.logoUrl || source.logo || '').trim()
  }
}

const normalizeHotelFiscalPrinter = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  const port = Number(source.port)
  return {
    ...source,
    name: String(source.name || 'HOTEL').trim(),
    address: String(source.address || '').trim(),
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 8080,
    vatDepartments: source.vatDepartments && typeof source.vatDepartments === 'object'
      ? source.vatDepartments
      : { '10': 1, '22': 2, NS: 3 }
  }
}

const normalizePayments = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  const normalizeGroup = (group) => Array.isArray(group)
    ? group.map((payment) => ({
        id: payment?.id === '' || payment?.id === null || payment?.id === undefined
          ? null
          : Number(payment.id),
        name: String(payment?.name || '').trim(),
        electronic: normalizeBooleanLike(payment?.electronic, false)
      })).filter((payment) => payment.name && Number.isInteger(payment.id) && payment.id >= 0)
    : []

  return {
    bar: normalizeGroup(source.bar),
    hotel: normalizeGroup(source.hotel)
  }
}

const addPayment = (group) => {
  const name = paymentDrafts.value[group].name.trim()
  const id = Number(paymentDrafts.value[group].id)
  if (!name || !Number.isInteger(id) || id < 0) return
  if (paymentsForm.value[group].some((payment) => payment.id === id)) {
    alert(`L'ID ${id} e' gia' utilizzato nei pagamenti ${group.toUpperCase()}.`)
    return
  }

  paymentsForm.value[group].push({
    id,
    name,
    electronic: paymentDrafts.value[group].electronic
  })
  paymentDrafts.value[group] = { id: '', name: '', electronic: false }
}

const removePayment = (group, index) => {
  paymentsForm.value[group].splice(index, 1)
}

const loadForm = async () => {
  loading.value = true
  try {
    const [configsResponse, hotelResponse] = await Promise.all([
      axios.get('/api/configs', { mbarDirect: true }),
      axios.get('/api/pms/getconfigs?section=hotel')
    ])
    const configs = configsResponse?.data && typeof configsResponse.data === 'object' ? configsResponse.data : {}
    const currentHotelSection = hotelResponse?.data && typeof hotelResponse.data === 'object' ? hotelResponse.data : {}
    globalConfigs.value = configs
    hotelSection.value = currentHotelSection
    form.value = normalizePmsConfig(configs.pms)
    vatRatesForm.value = normalizeVatRates(configs.vatRates)
    paymentsForm.value = normalizePayments(configs.payments)
    hotelFiscalPrinterForm.value = normalizeHotelFiscalPrinter(configs.hotelFiscalPrinter)
    structureForm.value = normalizeStructureForm(currentHotelSection.structure)
  } catch (error) {
    console.error('Errore caricamento configurazioni PMS:', error)
    alert('Errore caricamento configurazioni')
  } finally {
    loading.value = false
  }
}

const save = async () => {
  loading.value = true
  try {
    const currentPms = globalConfigs.value?.pms && typeof globalConfigs.value.pms === 'object'
      ? globalConfigs.value.pms
      : {}

    const nextConfigs = {
      ...globalConfigs.value,
      pms: {
        ...currentPms,
        enabled: normalizeBooleanLike(form.value.enabled, true)
      },
      vatRates: normalizeVatRates(vatRatesForm.value),
      payments: normalizePayments(paymentsForm.value),
      hotelFiscalPrinter: normalizeHotelFiscalPrinter(hotelFiscalPrinterForm.value)
    }
    const nextHotelSection = {
      ...(hotelSection.value || {}),
      structure: normalizeStructureForm(structureForm.value)
    }

    await Promise.all([
      axios.post('/api/configs', nextConfigs, { mbarDirect: true }),
      axios.post('/api/pms/setconfigs', {
        section: 'hotel',
        data: nextHotelSection
      })
    ])
    globalConfigs.value = nextConfigs
    hotelSection.value = nextHotelSection
    form.value = normalizePmsConfig(nextConfigs.pms)
    vatRatesForm.value = normalizeVatRates(nextConfigs.vatRates)
    paymentsForm.value = normalizePayments(nextConfigs.payments)
    hotelFiscalPrinterForm.value = normalizeHotelFiscalPrinter(nextConfigs.hotelFiscalPrinter)
    structureForm.value = normalizeStructureForm(nextHotelSection.structure)
    alert('Configurazioni salvate correttamente')
  } catch (error) {
    console.error('Errore salvataggio configurazioni PMS:', error)
    alert('Errore salvataggio configurazioni')
  } finally {
    loading.value = false
  }
}

onMounted(loadForm)
</script>

<style scoped>
.settings-page {
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header p {
  margin: 8px 0 0;
}

.card {
  border-radius: 28px;
  padding: 24px;
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.card h2 {
  margin: 0;
  color: var(--ds-text);
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(220, 77, 77, 0.1);
  color: var(--ds-danger);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-pill.active {
  background: rgba(39, 179, 106, 0.12);
  color: var(--ds-success);
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--ds-text-soft);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.field-label input {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  min-height: 44px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}

.full-width {
  grid-column: 1 / -1;
}

.vat-rate-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.vat-rate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 6px 8px 6px 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ds-text);
}

.vat-rate-form {
  display: grid;
  grid-template-columns: minmax(180px, 280px) auto;
  align-items: end;
  gap: 12px;
}

.payments-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.payment-group {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.payment-group-heading h3 {
  margin: 0;
  color: var(--ds-text);
  font-size: 1rem;
}

.payment-group-heading small,
.payment-row small,
.toggle-field small {
  display: block;
  margin-top: 4px;
  color: var(--ds-text-soft);
}

.payment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 0;
}

.payment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(241, 245, 249, 0.82);
}

.payment-row strong {
  color: var(--ds-text);
}

.payment-empty {
  margin: 16px 0;
  color: var(--ds-text-soft);
  font-size: 0.9rem;
}

.remove-button {
  border: 0;
  padding: 8px;
  background: transparent;
  color: var(--ds-danger);
  cursor: pointer;
  font-weight: 700;
}

.payment-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.payment-fields {
  display: grid;
  grid-template-columns: minmax(90px, 0.35fr) minmax(0, 1fr);
  gap: 12px;
}

.toggle-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--ds-text);
}

.toggle-field input {
  width: 22px;
  height: 22px;
  accent-color: var(--ds-primary);
}

.checkbox-stack {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.checkbox-stack strong {
  display: block;
  margin-bottom: 4px;
}

.checkbox-stack small {
  color: var(--ds-text-soft);
  line-height: 1.5;
}

.checkbox-stack input {
  width: 22px;
  height: 22px;
  accent-color: var(--ds-primary);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  border: 0;
  border-radius: 18px;
  min-height: 48px;
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 700;
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #ffffff;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.84);
  color: var(--ds-text);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .card-heading,
  .footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .checkbox-stack {
    align-items: flex-start;
  }

  .payments-grid {
    grid-template-columns: 1fr;
  }

  .vat-rate-form,
  .payment-fields {
    grid-template-columns: 1fr;
  }
}
</style>
