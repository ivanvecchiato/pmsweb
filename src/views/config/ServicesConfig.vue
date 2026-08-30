<template>
  <div class="services-config">
    <div class="page-header">
      <div>
        <h1 class="page-title">Configurazione Servizi</h1>
        <p class="page-subtitle">Servizi accessori aggiungibili alle prenotazioni hotel e spiaggia</p>
      </div>
      <button class="btn btn-primary" @click="openAddForm">+ Nuovo Servizio</button>
    </div>

    <section class="pending-returns">
      <div class="pending-returns-header">
        <div>
          <h2>Servizi da restituire</h2>
        </div>
        <span class="pending-returns-count">{{ pendingReturns.length }}</span>
      </div>
      <div v-if="pendingLoading" class="pending-returns-empty">Caricamento...</div>
      <div v-else-if="pendingReturns.length === 0" class="pending-returns-empty">Nessun servizio in sospeso.</div>
      <div v-else class="pending-returns-list">
        <div v-for="item in pendingReturns" :key="`${item.reservationId}-${item.serviceIndex}`" class="pending-return-row">
          <div class="pending-return-info">
            <strong>{{ item.service.name }}<span v-if="Number(item.service.quantity) > 1"> × {{ item.service.quantity }}</span></strong>
            <span>Camera {{ item.room }}<span v-if="item.reservationName"> · {{ item.reservationName }}</span></span>
            <span>Erogato il {{ formatDateTime(item.service.addedAt) }}<template v-if="item.operatorName"> da {{ item.operatorName }}</template></span>
            <span v-if="item.service.deposit">Cauzione € {{ Number(item.service.deposit).toFixed(2) }}</span>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-return"
            :disabled="returningKey !== ''"
            @click="returnService(item)"
          >{{ returningKey === `${item.reservationId}-${item.serviceIndex}` ? 'Restituzione...' : 'Restituisci' }}</button>
        </div>
      </div>
    </section>

    <div v-if="loading" class="loading-state">Caricamento...</div>

    <div v-else-if="services.length === 0 && !showForm" class="empty-state">
      <p>Nessun servizio configurato. Aggiungi il primo servizio.</p>
    </div>

    <div v-else class="services-list">
      <div
        v-for="(service, idx) in services"
        :key="service.id"
        class="service-card"
      >
        <div class="service-info">
          <div class="service-name">{{ service.name }}</div>
          <div class="service-desc">{{ service.description || '—' }}</div>
          <div class="service-meta">
            <span class="service-price" v-if="service.price != null && service.price !== ''">
              € {{ Number(service.price).toFixed(2) }}
            </span>
            <span class="service-price free" v-else>Gratuito</span>
            <span class="service-vat">IVA {{ formatVatRate(service.vatRate) }}%</span>
            <span v-if="service.deposit" class="service-vat">Cauzione € {{ Number(service.deposit).toFixed(2) }}</span>
          </div>
        </div>
        <div class="service-actions">
          <button class="btn btn-sm btn-secondary" @click="openEditForm(idx)">Modifica</button>
          <button class="btn btn-sm btn-danger" @click="deleteService(idx)">Elimina</button>
        </div>
      </div>
    </div>

    <!-- Form aggiunta / modifica -->
    <transition name="fade">
      <Teleport to="body">
        <div v-if="showForm" class="modal-overlay" @click.self="cancelForm">
          <div class="modal-box">
          <div class="modal-header">
            <h3>{{ editingIndex !== null ? 'Modifica Servizio' : 'Nuovo Servizio' }}</h3>
            <button class="close-btn" @click="cancelForm">&times;</button>
          </div>
          <form @submit.prevent="saveService">
            <div class="form-row">
              <div class="form-section">
                <label>Nome *</label>
                <input v-model="form.name" type="text" required placeholder="es. Colazione" />
              </div>
              <div class="form-section form-section--narrow">
                <label>Prezzo (€)</label>
                <input v-model="form.price" type="number" min="0" step="0.01" placeholder="0.00" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-section form-section--narrow">
                <label>Aliquota IVA *</label>
                <select v-model.number="form.vatRate" required>
                  <option disabled value="">Seleziona</option>
                  <option v-for="rate in vatRates" :key="rate" :value="rate">
                    {{ formatVatRate(rate) }}%
                  </option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-section">
                <label>Descrizione</label>
                <input v-model="form.description" type="text" placeholder="Breve descrizione opzionale" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-checkbox">
                <input v-model="form.printOnDelivery" type="checkbox" />
                <span>Stampa ricevuta</span>
              </label>
            </div>
            <div v-if="form.printOnDelivery" class="form-row">
              <div class="form-section form-section--narrow">
                <label>Cauzione (€)</label>
                <input v-model.number="form.deposit" type="number" min="0" step="0.01" placeholder="0.00" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-cancel" @click="cancelForm">Annulla</button>
              <button type="submit" class="btn btn-save" :disabled="saving">
                {{ saving ? 'Salvataggio...' : 'Salva' }}
              </button>
            </div>
          </form>
          </div>
        </div>
      </Teleport>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const SERVICES_ENDPOINT = '/api/pms/services'

const services = ref([])
const pendingReturns = ref([])
const vatRates = ref([10, 22])
const loading = ref(true)
const pendingLoading = ref(true)
const saving = ref(false)
const returningKey = ref('')
const showForm = ref(false)
const editingIndex = ref(null)

const defaultVatRate = () => vatRates.value.includes(10) ? 10 : (vatRates.value[0] ?? '')
const emptyForm = () => ({ name: '', description: '', price: '', vatRate: defaultVatRate(), printOnDelivery: false, deposit: '' })
const form = ref(emptyForm())

const formatVatRate = (value) => Number(value).toLocaleString('it-IT', {
  maximumFractionDigits: 2
})

const formatDateTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('it-IT')
}

onMounted(loadServices)

async function loadServices() {
  loading.value = true
  try {
    const [servicesResponse, configsResponse] = await Promise.all([
      axios.get(SERVICES_ENDPOINT),
      axios.get('/api/configs')
    ])
    const configuredVatRates = configsResponse?.data?.vatRates
    vatRates.value = Array.isArray(configuredVatRates)
      ? [...new Set(configuredVatRates
          .map((rate) => Number(rate))
          .filter((rate) => Number.isFinite(rate) && rate >= 0 && rate <= 100))].sort((a, b) => a - b)
      : [10, 22]
    services.value = Array.isArray(servicesResponse.data)
      ? servicesResponse.data.map((service) => ({
          ...service,
          vatRate: vatRates.value.includes(Number(service?.vatRate))
            ? Number(service.vatRate)
            : defaultVatRate()
        }))
      : []
  } catch (e) {
    console.error('Errore caricamento servizi:', e)
    services.value = []
  } finally {
    loading.value = false
  }
  await loadPendingReturns()
}

async function loadPendingReturns() {
  pendingLoading.value = true
  try {
    const response = await axios.get('/api/pms/hotel/services/pending_returns')
    pendingReturns.value = Array.isArray(response.data) ? response.data : []
  } catch (e) {
    console.error('Errore caricamento servizi da restituire:', e)
    pendingReturns.value = []
  } finally {
    pendingLoading.value = false
  }
}

async function returnService(item) {
  if (returningKey.value) return
  if (!confirm(`Confermi la restituzione di "${item.service.name}" dalla camera ${item.room}?`)) return
  returningKey.value = `${item.reservationId}-${item.serviceIndex}`
  try {
    const response = await axios.post('/api/pms/hotel/return_service', {
      reservationId: item.reservationId,
      serviceIndex: item.serviceIndex
    })
    if (!response.data?.success) throw new Error(response.data?.error || 'Restituzione non confermata dal server')
    await loadPendingReturns()
  } catch (e) {
    console.error('Errore restituzione servizio:', e)
    alert(e.response?.data?.error || e.message || 'Errore durante la restituzione del servizio.')
  } finally {
    returningKey.value = ''
  }
}

function openAddForm() {
  editingIndex.value = null
  form.value = emptyForm()
  showForm.value = true
}

function openEditForm(idx) {
  editingIndex.value = idx
  const s = services.value[idx]
  form.value = {
    name: s.name ?? '',
    description: s.description ?? '',
    price: s.price ?? '',
    vatRate: vatRates.value.includes(Number(s.vatRate)) ? Number(s.vatRate) : defaultVatRate(),
    printOnDelivery: s.printOnDelivery === true,
    deposit: s.deposit ?? ''
  }
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingIndex.value = null
}

async function saveService() {
  if (!form.value.name.trim()) return
  const vatRate = Number(form.value.vatRate)
  if (!vatRates.value.includes(vatRate)) {
    alert('Seleziona un\'aliquota IVA configurata.')
    return
  }
  saving.value = true
  try {
    const updated = [...services.value]
    const entry = {
      id: editingIndex.value !== null ? updated[editingIndex.value].id : Date.now(),
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      price: form.value.price !== '' && form.value.price !== null ? Number(form.value.price) : null,
      vatRate,
      printOnDelivery: form.value.printOnDelivery,
      deposit: form.value.printOnDelivery && Number(form.value.deposit) > 0 ? Number(form.value.deposit) : null
    }

    if (editingIndex.value !== null) {
      updated[editingIndex.value] = entry
    } else {
      updated.push(entry)
    }

    const response = await axios.post(SERVICES_ENDPOINT, updated)
    if (!response.data?.success || !Array.isArray(response.data.services)) {
      throw new Error(response.data?.error || 'Salvataggio non confermato dal server')
    }
    services.value = response.data.services
    cancelForm()
  } catch (e) {
    console.error('Errore salvataggio servizio:', e)
    alert('Errore durante il salvataggio.')
  } finally {
    saving.value = false
  }
}

async function deleteService(idx) {
  if (!confirm(`Eliminare il servizio "${services.value[idx].name}"?`)) return
  try {
    const updated = services.value.filter((_, i) => i !== idx)
    const response = await axios.post(SERVICES_ENDPOINT, updated)
    if (!response.data?.success || !Array.isArray(response.data.services)) {
      throw new Error(response.data?.error || 'Eliminazione non confermata dal server')
    }
    services.value = response.data.services
  } catch (e) {
    console.error('Errore eliminazione servizio:', e)
    alert('Errore durante l\'eliminazione.')
  }
}
</script>

<style scoped>
.services-config {
  padding: 6px;
  max-width: 980px;
  margin: 0 auto;
  font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 16px;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--ds-text);
  margin: 0 0 0.25rem;
  letter-spacing: -0.05em;
}

.page-subtitle {
  color: var(--ds-text-soft);
  font-size: 0.95rem;
  margin: 0;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--ds-text-soft);
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pending-returns {
  margin-bottom: 2rem;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 24px;
  background: rgba(255, 251, 235, 0.78);
  padding: 1.2rem 1.35rem;
}

.pending-returns-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 1rem;
}

.pending-returns-header h2 { margin: 0; color: var(--ds-text); font-size: 1.05rem; }
.pending-returns-count { min-width: 32px; padding: 5px 9px; border-radius: 999px; background: #f59e0b; color: white; font-weight: 800; text-align: center; }
.pending-returns-list { display: flex; flex-direction: column; }
.pending-return-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid rgba(245, 158, 11, 0.18); }
.pending-return-info { display: flex; flex-direction: column; gap: 3px; color: var(--ds-text-soft); font-size: 0.8rem; }
.pending-return-info strong { color: var(--ds-text); font-size: 0.92rem; }
.pending-returns-empty { color: var(--ds-text-soft); font-size: 0.88rem; }
.btn-return { background: rgba(22, 163, 74, 0.1); border-color: rgba(22, 163, 74, 0.22); color: #15803d; }

.service-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  padding: 1.2rem 1.35rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.service-name {
  font-weight: 700;
  color: var(--ds-text);
  font-size: 1rem;
}

.service-desc {
  color: var(--ds-text-soft);
  font-size: 0.88rem;
  margin-top: 0.15rem;
}

.service-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.4rem;
}

.service-price {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ds-text);
}

.service-price.free {
  font-weight: 500;
  color: var(--ds-text-muted);
}

.service-vat {
  padding: 4px 8px;
  border-radius: 10px;
  background: rgba(29, 140, 242, 0.1);
  color: var(--ds-primary-strong);
  font-size: 0.78rem;
  font-weight: 700;
}

.service-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.75rem 1.2rem;
  border-radius: 16px;
  border: 1px solid transparent;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s, background-color 0.15s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.86);
  color: var(--ds-text);
  border-color: rgba(148, 163, 184, 0.18);
}

.btn-danger {
  background: rgba(220, 77, 77, 0.1);
  color: var(--ds-danger);
  border-color: rgba(220, 77, 77, 0.16);
}

.btn-save {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.86);
  color: var(--ds-text);
  border-color: rgba(148, 163, 184, 0.18);
}

.btn-sm {
  padding: 0.45rem 0.8rem;
  font-size: 0.8rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(36, 49, 66, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: rgba(255, 255, 255, 0.9);
  width: 90%;
  max-width: 540px;
  border-radius: 28px;
  padding: 24px;
  box-shadow: var(--ds-shadow-soft);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(24px);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.2rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ds-text);
}

.close-btn {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 1.4rem;
  cursor: pointer;
  color: var(--ds-text-soft);
  line-height: 1;
  padding: 0;
  width: 42px;
  height: 42px;
  border-radius: 14px;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-section--narrow {
  flex: 0 0 140px;
}

.form-section label {
  color: var(--ds-text-soft);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.76rem;
  margin-bottom: 6px;
}

.form-section input,
.form-section select {
  min-height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.9);
  padding: 0 14px;
  font: inherit;
}

.form-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ds-text);
  font-weight: 700;
  cursor: pointer;
}

.form-checkbox input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--ds-primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .services-config {
    padding: 0;
  }

  .page-header,
  .service-card,
  .form-row,
  .modal-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .form-section--narrow {
    flex: 1 1 auto;
  }
}
</style>
