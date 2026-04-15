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
import { ref, onMounted } from 'vue';
import axios from 'axios';

const BASE = 'http://localhost:8081';

const services = ref([]);
const loading = ref(true);
const saving = ref(false);
const showForm = ref(false);
const editingIndex = ref(null);

const emptyForm = () => ({ name: '', description: '', price: '' });
const form = ref(emptyForm());

onMounted(loadServices);

async function loadServices() {
  loading.value = true;
  try {
    const { data } = await axios.get(`${BASE}/api/pms/services`);
    services.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Errore caricamento servizi:', e);
    services.value = [];
  } finally {
    loading.value = false;
  }
}

function openAddForm() {
  editingIndex.value = null;
  form.value = emptyForm();
  showForm.value = true;
}

function openEditForm(idx) {
  editingIndex.value = idx;
  const s = services.value[idx];
  form.value = {
    name: s.name ?? '',
    description: s.description ?? '',
    price: s.price ?? '',
  };
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  editingIndex.value = null;
}

async function saveService() {
  if (!form.value.name.trim()) return;
  saving.value = true;
  try {
    const updated = [...services.value];
    const entry = {
      id: editingIndex.value !== null ? updated[editingIndex.value].id : Date.now(),
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      price: form.value.price !== '' && form.value.price !== null ? Number(form.value.price) : null,
    };

    if (editingIndex.value !== null) {
      updated[editingIndex.value] = entry;
    } else {
      updated.push(entry);
    }

    await axios.post(`${BASE}/api/pms/services`, updated);
    services.value = updated;
    cancelForm();
  } catch (e) {
    console.error('Errore salvataggio servizio:', e);
    alert('Errore durante il salvataggio.');
  } finally {
    saving.value = false;
  }
}

async function deleteService(idx) {
  if (!confirm(`Eliminare il servizio "${services.value[idx].name}"?`)) return;
  try {
    const updated = services.value.filter((_, i) => i !== idx);
    await axios.post(`${BASE}/api/pms/services`, updated);
    services.value = updated;
  } catch (e) {
    console.error('Errore eliminazione servizio:', e);
    alert('Errore durante l\'eliminazione.');
  }
}


</script>

<style scoped>
.services-config {
  padding: 2rem;
  max-width: 860px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.25rem;
}

.page-subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.service-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.service-name {
  font-weight: 600;
  color: #111827;
  font-size: 0.95rem;
}

.service-desc {
  color: #6b7280;
  font-size: 0.82rem;
  margin-top: 0.15rem;
}

.service-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.4rem;
}

.service-price {
  font-size: 0.88rem;
  font-weight: 700;
  color: #374151;
}

.service-price.free {
  font-weight: 400;
  color: #9ca3af;
}

.service-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* ---- BUTTONS ---- */
.btn {
  padding: 0.55rem 1.1rem;
  border-radius: 6px;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary  { background: #2563eb; color: white; }
.btn-secondary{ background: #f3f4f6; color: #374151; }
.btn-danger   { background: #fee2e2; color: #dc2626; }
.btn-save     { background: #2563eb; color: white; }
.btn-cancel   { background: #f3f4f6; color: #374151; }
.btn-sm       { padding: 0.35rem 0.7rem; font-size: 0.8rem; }

/* ---- MODAL ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: white;
  width: 90%;
  max-width: 540px;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.2rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: #6b7280;
  line-height: 1;
  padding: 0;
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
  font-size: 0.75rem;
  font-weight: 700;
  color: #4b5563;
  margin-bottom: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.form-section input,
.form-section select {
  padding: 0.55rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #111827;
  outline: none;
  transition: border-color 0.15s;
}

.form-section input:focus,
.form-section select:focus {
  border-color: #2563eb;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
