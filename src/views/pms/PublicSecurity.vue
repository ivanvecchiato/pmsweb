<template>
  <div class="ps-page">
    <section class="control-card">
      <div>
        <p class="eyebrow">Pubblica Sicurezza</p>
        <h2>Schedine di notifica PS</h2>
        <p class="description">Genera il file con gli ospiti arrivati e registrati nella data selezionata.</p>
      </div>

      <div class="controls">
        <label for="ps-date">Data arrivi</label>
        <input id="ps-date" v-model="selectedDate" type="date" :max="today" @change="loadArrivals" />
        <button type="button" class="secondary-button" :disabled="isLoading" @click="loadArrivals">
          {{ isLoading ? 'Caricamento...' : 'Aggiorna' }}
        </button>
        <button type="button" class="primary-button" :disabled="!report.canGenerate || isDownloading" @click="downloadFile">
          {{ isDownloading ? 'Generazione...' : 'Scarica file AlloggiatiWeb' }}
        </button>
      </div>
    </section>

    <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="message success">{{ successMessage }}</p>

    <section class="summary-grid">
      <article>
        <span>Arrivi effettivi</span>
        <strong>{{ report.arrivals }}</strong>
      </article>
      <article>
        <span>Schede valide</span>
        <strong>{{ report.valid }}</strong>
      </article>
      <article :class="{ warning: report.invalid > 0 }">
        <span>Da correggere</span>
        <strong>{{ report.invalid }}</strong>
      </article>
    </section>

    <section class="arrivals-card">
      <div class="section-heading">
        <div>
          <h3>Arrivi del {{ formattedDate }}</h3>
          <p>Il download è disponibile quando tutte le schede contengono i dati obbligatori.</p>
        </div>
        <span :class="['file-status', { ready: report.canGenerate }]">
          {{ report.canGenerate ? 'File pronto' : 'File non pronto' }}
        </span>
      </div>

      <div v-if="report.rows.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Camera</th>
              <th>Ospite</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Esito</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in report.rows" :key="row.id">
              <td>{{ row.room || '—' }}</td>
              <td><strong>{{ row.lastname }} {{ row.firstname }}</strong></td>
              <td>{{ formatShortDate(row.checkin) }}</td>
              <td>{{ formatShortDate(row.checkout) }}</td>
              <td>
                <span v-if="row.valid" class="valid-label">Completa</span>
                <ul v-else class="errors-list">
                  <li v-for="error in row.errors" :key="error">{{ error }}</li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        {{ isLoading ? 'Caricamento degli arrivi...' : 'Nessun arrivo effettivo nella data selezionata.' }}
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const ARRIVALS_ENDPOINT = '/api/pms/ps/arrivals'
const FILE_ENDPOINT = '/api/pms/ps/alloggiati'
const router = useRouter()
const { currentUser, logout } = useAuth()

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const selectedDate = ref(today)
const isLoading = ref(false)
const isDownloading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const report = ref({ arrivals: 0, valid: 0, invalid: 0, canGenerate: false, rows: [] })

const formattedDate = computed(() => new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(new Date(`${selectedDate.value}T00:00:00`)))

const requestConfig = () => ({
  headers: { Authorization: `Bearer ${currentUser.value?.token || ''}` },
  mbarDirect: true
})

const formatShortDate = value => value
  ? new Intl.DateTimeFormat('it-IT').format(new Date(`${value}T00:00:00`))
  : '—'

async function loadArrivals() {
  if (!selectedDate.value || selectedDate.value > today) {
    selectedDate.value = today
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await axios.get(ARRIVALS_ENDPOINT, {
      ...requestConfig(),
      params: { day: selectedDate.value }
    })
    report.value = {
      arrivals: Number(data?.arrivals || 0),
      valid: Number(data?.valid || 0),
      invalid: Number(data?.invalid || 0),
      canGenerate: data?.canGenerate === true,
      rows: Array.isArray(data?.rows) ? data.rows : []
    }
  } catch (error) {
    console.error('Errore caricamento arrivi PS:', error)
    report.value = { arrivals: 0, valid: 0, invalid: 0, canGenerate: false, rows: [] }
    if (error?.response?.status === 401) {
      logout()
      await router.replace('/login')
      return
    }
    errorMessage.value = error?.response?.data?.error || 'Impossibile caricare gli arrivi.'
  } finally {
    isLoading.value = false
  }
}

async function downloadFile() {
  if (!report.value.canGenerate) return

  isDownloading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await axios.get(FILE_ENDPOINT, {
      ...requestConfig(),
      params: { day: selectedDate.value },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `alloggiati-${selectedDate.value.replaceAll('-', '')}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'File AlloggiatiWeb generato correttamente.'
  } catch (error) {
    console.error('Errore generazione file AlloggiatiWeb:', error)
    if (error?.response?.status === 401) {
      logout()
      await router.replace('/login')
      return
    }
    errorMessage.value = 'Impossibile generare il file AlloggiatiWeb.'
    await loadArrivals()
  } finally {
    isDownloading.value = false
  }
}

onMounted(loadArrivals)
</script>

<style scoped>
.ps-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1440px;
  margin: 0 auto;
  color: var(--ds-text);
}

.control-card,
.arrivals-card,
.summary-grid article {
  border: 1px solid var(--ds-border);
  border-radius: 18px;
  background: var(--ds-surface);
  box-shadow: var(--ds-shadow-card);
}

.control-card {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  align-items: flex-end;
  padding: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: var(--ds-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h2,
h3,
.description,
.section-heading p {
  margin: 0;
}

.description,
.section-heading p {
  margin-top: 0.4rem;
  color: var(--ds-text-muted);
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.controls label {
  font-size: 0.85rem;
  font-weight: 700;
}

.controls input {
  min-height: 42px;
  padding: 0 0.8rem;
  border: 1px solid var(--ds-border);
  border-radius: 10px;
  background: var(--ds-surface);
  color: var(--ds-text);
}

.primary-button,
.secondary-button {
  min-height: 42px;
  padding: 0 1rem;
  border: 0;
  border-radius: 10px;
  font-weight: 750;
  cursor: pointer;
}

.primary-button {
  background: var(--ds-primary);
  color: #ffffff;
}

.secondary-button {
  background: var(--ds-surface-muted);
  color: var(--ds-text);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.message {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  font-weight: 650;
}

.message.error {
  background: #fff1f2;
  color: #be123c;
}

.message.success {
  background: #ecfdf5;
  color: #047857;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.summary-grid article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
}

.summary-grid span {
  color: var(--ds-text-muted);
  font-weight: 650;
}

.summary-grid strong {
  font-size: 1.7rem;
}

.summary-grid .warning strong {
  color: #dc2626;
}

.arrivals-card {
  overflow: hidden;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.35rem 1.5rem;
  border-bottom: 1px solid var(--ds-border);
}

.file-status,
.valid-label {
  display: inline-flex;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: #fff1f2;
  color: #be123c;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.file-status.ready,
.valid-label {
  background: #ecfdf5;
  color: #047857;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--ds-border);
  text-align: left;
  vertical-align: top;
}

th {
  background: var(--ds-surface-muted);
  color: var(--ds-text-muted);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.errors-list {
  margin: 0;
  padding-left: 1rem;
  color: #be123c;
  font-size: 0.82rem;
}

.empty-state {
  padding: 3rem 1.5rem;
  color: var(--ds-text-muted);
  text-align: center;
}

@media (max-width: 900px) {
  .control-card,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
