<template>
  <div class="istat-page">
    <section class="control-card">
      <div>
        <p class="eyebrow">Regione Veneto</p>
        <h2>Rilevazione mensile Ross1000</h2>
        <p class="description">Genera il file XML mensile con la movimentazione giornaliera registrata nel PMS.</p>
      </div>

      <div class="controls">
        <label for="istat-month">Mese</label>
        <input id="istat-month" v-model="selectedMonth" type="month" :max="currentMonth" @change="loadArrivals" />
        <label for="ross-code">Codice struttura</label>
        <input
          id="ross-code"
          v-model.trim="structureCode"
          class="code-input"
          maxlength="30"
          placeholder="Codice ROSS1000"
          @keyup.enter="saveStructureCode"
        />
        <button type="button" class="secondary-button" :disabled="isSavingCode" @click="saveStructureCode">
          {{ isSavingCode ? 'Salvataggio...' : 'Salva codice' }}
        </button>
        <button type="button" class="secondary-button" :disabled="isLoading" @click="loadArrivals">
          {{ isLoading ? 'Caricamento...' : 'Aggiorna' }}
        </button>
        <button type="button" class="primary-button" :disabled="!report.canGenerate || isDownloading" @click="downloadFile">
          {{ isDownloading ? 'Generazione...' : 'Scarica XML Ross1000' }}
        </button>
      </div>
    </section>

    <section class="procedure-card">
      <h3>Procedura di trasmissione</h3>
      <ol>
        <li>Seleziona il mese da rendicontare e inserisci il codice univoco assegnato alla struttura in Ross1000.</li>
        <li>Correggi nel PMS le schede segnalate e premi <strong>Aggiorna</strong> finché il file risulta pronto.</li>
        <li>Scarica l'XML e importalo nell'area autenticata Ross1000 entro i primi dieci giorni lavorativi del mese successivo.</li>
        <li>L'XML include tutti i giorni del mese, anche quelli senza arrivi o partenze.</li>
      </ol>
      <p>Il codice viene salvato sul server e usato per il nome del file.</p>
      <p><strong>Attenzione:</strong> finché non viene configurato un calendario delle chiusure, tutti i giorni del mese sono dichiarati come struttura aperta.</p>
    </section>
    <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
    <p v-if="report.errors.length" class="message error">{{ report.errors.join(' · ') }}</p>
    <p v-if="successMessage" class="message success">{{ successMessage }}</p>
    <p v-if="excludeInvalid && report.invalid" class="message warning-message">
      Il file conterrà {{ report.valid }} schede valide; {{ report.invalid }} schede non valide saranno escluse e dovranno essere trasmesse dopo la correzione.
    </p>

    <section class="summary-grid">
      <article>
        <span>Arrivi effettivi</span>
        <strong>{{ report.arrivals }}</strong>
      </article>
      <article>
        <span>Presenze</span>
        <strong>{{ report.presences }}</strong>
      </article>
      <article>
        <span>Schede valide</span>
        <strong>{{ report.valid }}</strong>
      </article>
      <article :class="{ warning: report.invalid > 0 }">
        <span>{{ excludeInvalid ? 'Escluse dal file' : 'Da correggere' }}</span>
        <strong>{{ report.invalid }}</strong>
      </article>
    </section>

    <section class="arrivals-card">
      <div class="section-heading">
        <div>
          <h3>Movimentazione di {{ formattedMonth }}</h3>
          <p>Il download è disponibile quando tutte le schede contengono i dati richiesti da Ross1000.</p>
        </div>
        <div class="section-actions">
          <label class="option-control">
            <input v-model="excludeInvalid" type="checkbox" @change="loadArrivals" />
            Escludi righe non valide
          </label>
          <button v-if="report.rows.length" type="button" class="details-button" @click="showDetails = !showDetails">
            {{ showDetails ? 'Nascondi dettaglio' : 'Mostra dettaglio' }}
          </button>
          <span :class="['file-status', { ready: report.canGenerate }]">
            {{ report.canGenerate ? 'File pronto' : 'File non pronto' }}
          </span>
        </div>
      </div>

      <div v-if="report.rows.length && showDetails" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Camera</th>
              <th>Ospite</th>
              <th>Partenza</th>
              <th>Esito</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in report.rows" :key="row.id">
              <td>{{ formatDate(row.checkin) }}</td>
              <td>{{ row.room || '—' }}</td>
              <td><strong>{{ row.lastname }} {{ row.firstname }}</strong></td>
              <td>{{ formatDate(row.checkout) }}</td>
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

      <div v-else-if="!report.rows.length" class="empty-state">
        {{ isLoading ? 'Caricamento della movimentazione...' : 'Nessun arrivo effettivo nel mese selezionato.' }}
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const ARRIVALS_ENDPOINT = '/api/pms/istat/arrivals'
const FILE_ENDPOINT = '/api/pms/istat/ross1000'
const CONFIG_ENDPOINT = '/api/pms/istat/config'
const LEGACY_STRUCTURE_CODE_KEY = 'ross1000_structure_code'
const router = useRouter()
const { currentUser, logout } = useAuth()

const now = new Date()
const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`
const selectedMonth = ref(previousMonth)
const structureCode = ref('')
const isLoading = ref(false)
const isDownloading = ref(false)
const isSavingCode = ref(false)
const excludeInvalid = ref(false)
const showDetails = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const report = ref({ arrivals: 0, presences: 0, valid: 0, invalid: 0, excluded: 0, canGenerate: false, errors: [], rows: [] })

const formattedMonth = computed(() => new Intl.DateTimeFormat('it-IT', {
  month: 'long',
  year: 'numeric'
}).format(new Date(`${selectedMonth.value}-01T00:00:00`)))

const requestConfig = () => ({
  headers: { Authorization: `Bearer ${currentUser.value?.token || ''}` },
  mbarDirect: true
})

const formatDate = value => value
  ? new Intl.DateTimeFormat('it-IT').format(new Date(`${value}T00:00:00`))
  : '—'

async function saveStructureCode() {
  structureCode.value = structureCode.value.toUpperCase()
  isSavingCode.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await axios.post(CONFIG_ENDPOINT, { structureCode: structureCode.value }, requestConfig())
    localStorage.removeItem(LEGACY_STRUCTURE_CODE_KEY)
    await loadArrivals()
    successMessage.value = 'Codice struttura salvato sul server.'
  } catch (error) {
    console.error('Errore salvataggio codice struttura:', error)
    if (error?.response?.status === 401) {
      logout()
      await router.replace('/login')
      return
    }
    errorMessage.value = error?.response?.data?.error || 'Impossibile salvare il codice struttura.'
  } finally {
    isSavingCode.value = false
  }
}

async function loadArrivals() {
  if (!selectedMonth.value || selectedMonth.value > currentMonth) selectedMonth.value = previousMonth

  isLoading.value = true
  showDetails.value = false
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await axios.get(ARRIVALS_ENDPOINT, {
      ...requestConfig(),
      params: { month: selectedMonth.value, excludeInvalid: excludeInvalid.value }
    })
    report.value = {
      arrivals: Number(data?.arrivals || 0),
      presences: Number(data?.presences || 0),
      valid: Number(data?.valid || 0),
      invalid: Number(data?.invalid || 0),
      excluded: Number(data?.excluded || 0),
      canGenerate: data?.canGenerate === true,
      errors: Array.isArray(data?.errors) ? data.errors : [],
      rows: Array.isArray(data?.rows) ? data.rows : []
    }
    structureCode.value = String(data?.structureCode || '')
  } catch (error) {
    console.error('Errore caricamento rilevazione Istat:', error)
    report.value = { arrivals: 0, presences: 0, valid: 0, invalid: 0, excluded: 0, canGenerate: false, errors: [], rows: [] }
    if (error?.response?.status === 401) {
      logout()
      await router.replace('/login')
      return
    }
    errorMessage.value = error?.response?.data?.error || 'Impossibile caricare la rilevazione mensile.'
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
      params: { month: selectedMonth.value, excludeInvalid: excludeInvalid.value },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `${structureCode.value}_${selectedMonth.value.replace('-', '')}.xml`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'File XML Ross1000 generato correttamente.'
  } catch (error) {
    console.error('Errore generazione file Ross1000:', error)
    if (error?.response?.status === 401) {
      logout()
      await router.replace('/login')
      return
    }
    errorMessage.value = 'Impossibile generare il file Ross1000.'
  } finally {
    isDownloading.value = false
  }
}

onMounted(async () => {
  const legacyStructureCode = localStorage.getItem(LEGACY_STRUCTURE_CODE_KEY)
  await loadArrivals()
  if (!structureCode.value && legacyStructureCode) {
    structureCode.value = legacyStructureCode
    await saveStructureCode()
  } else {
    localStorage.removeItem(LEGACY_STRUCTURE_CODE_KEY)
  }
})
</script>

<style scoped>
.istat-page { display: flex; flex-direction: column; gap: 1rem; max-width: 1440px; margin: 0 auto; color: var(--ds-text); }
.control-card, .procedure-card, .arrivals-card, .summary-grid article { border: 1px solid var(--ds-border); border-radius: 18px; background: var(--ds-surface); box-shadow: var(--ds-shadow-card); }
.control-card { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-end; padding: 1.5rem; }
.eyebrow { margin: 0 0 0.35rem; color: var(--ds-primary); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
h2, h3, .description, .section-heading p { margin: 0; }
.description, .section-heading p, .procedure-card p { margin-top: 0.4rem; color: var(--ds-text-muted); }
.procedure-card { padding: 1.1rem 1.35rem; }
.procedure-card ol { margin: 0.75rem 0; padding-left: 1.25rem; color: var(--ds-text-muted); }
.procedure-card li + li { margin-top: 0.35rem; }
.procedure-card p { margin-bottom: 0; font-size: 0.9rem; }
.controls { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
.controls label { font-size: 0.85rem; font-weight: 700; }
.controls input { min-height: 42px; padding: 0 0.8rem; border: 1px solid var(--ds-border); border-radius: 10px; background: var(--ds-surface); color: var(--ds-text); }
.option-control { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 34px; font-size: 0.85rem; font-weight: 700; white-space: nowrap; }
.option-control input { min-height: auto; margin: 0; padding: 0; }
.code-input { width: 150px; text-transform: uppercase; }
.primary-button, .secondary-button { min-height: 42px; padding: 0 1rem; border: 0; border-radius: 10px; font-weight: 750; cursor: pointer; }
.primary-button { background: var(--ds-primary); color: #ffffff; }
.secondary-button { background: var(--ds-surface-muted); color: var(--ds-text); }
button:disabled { cursor: not-allowed; opacity: 0.5; }
.message { margin: 0; padding: 0.9rem 1rem; border-radius: 12px; font-weight: 650; }
.message.error { background: #fff1f2; color: #be123c; }
.message.success { background: #ecfdf5; color: #047857; }
.warning-message { background: #fff7ed; color: #c2410c; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
.summary-grid article { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.25rem; }
.summary-grid span { color: var(--ds-text-muted); font-weight: 650; }
.summary-grid strong { font-size: 1.7rem; }
.summary-grid .warning strong { color: #dc2626; }
.arrivals-card { overflow: hidden; }
.section-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.35rem 1.5rem; border-bottom: 1px solid var(--ds-border); }
.section-actions { display: flex; align-items: center; gap: 0.65rem; }
.details-button { min-height: 34px; padding: 0 0.75rem; border: 1px solid var(--ds-border); border-radius: 9px; background: var(--ds-surface); color: var(--ds-text); font-weight: 700; cursor: pointer; }
.file-status, .valid-label { display: inline-flex; padding: 0.35rem 0.65rem; border-radius: 999px; background: #fff1f2; color: #be123c; font-size: 0.78rem; font-weight: 800; white-space: nowrap; }
.file-status.ready, .valid-label { background: #ecfdf5; color: #047857; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.9rem 1rem; border-bottom: 1px solid var(--ds-border); text-align: left; vertical-align: top; }
th { background: var(--ds-surface-muted); color: var(--ds-text-muted); font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; }
.errors-list { margin: 0; padding-left: 1rem; color: #be123c; font-size: 0.82rem; }
.empty-state { padding: 3rem 1.5rem; color: var(--ds-text-muted); text-align: center; }
@media (max-width: 1100px) { .control-card, .section-heading { align-items: stretch; flex-direction: column; } .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 700px) { .summary-grid { grid-template-columns: 1fr; } }
</style>
