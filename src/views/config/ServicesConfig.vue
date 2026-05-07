<template>
  <div class="services-config">
    <div class="page-header">
      <div>
        <h1 class="page-title">Configurazione Servizi</h1>
        <p class="page-subtitle">Servizi accessori aggiungibili alle prenotazioni hotel e spiaggia</p>
      </div>
      <button class="btn btn-primary" @click="openAddForm">+ Nuovo Servizio</button>
    </div>

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
              <div class="form-section">
                <label>Descrizione</label>
                <input v-model="form.description" type="text" placeholder="Breve descrizione opzionale" />
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
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const BASE = 'http://localhost:8081'

const services = ref([])
const loading = ref(true)
const saving = ref(false)
const showForm = ref(false)
const editingIndex = ref(null)

const emptyForm = () => ({ name: '', description: '', price: '' })
const form = ref(emptyForm())

onMounted(loadServices)

async function loadServices() {
  loading.value = true
  try {
    const { data } = await axios.get(`${BASE}/api/pms/services`)
    services.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('Errore caricamento servizi:', e)
    services.value = []
  } finally {
    loading.value = false
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
    price: s.price ?? ''
  }
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingIndex.value = null
}

async function saveService() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const updated = [...services.value]
    const entry = {
      id: editingIndex.value !== null ? updated[editingIndex.value].id : Date.now(),
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      price: form.value.price !== '' && form.value.price !== null ? Number(form.value.price) : null
    }

    if (editingIndex.value !== null) {
      updated[editingIndex.value] = entry
    } else {
      updated.push(entry)
    }

    await axios.post(`${BASE}/api/pms/services`, updated)
    services.value = updated
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
    await axios.post(`${BASE}/api/pms/services`, updated)
    services.value = updated
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

.form-section input {
  min-height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.9);
  padding: 0 14px;
  font: inherit;
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
