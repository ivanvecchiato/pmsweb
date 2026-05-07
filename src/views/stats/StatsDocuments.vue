<template>
  <div class="stats-documents">
    <h1>Documenti</h1>

    <div class="controls">
      <div class="control-field">
        <label for="from-date">Dal</label>
        <input id="from-date" v-model="fromDate" type="date" />
      </div>

      <div class="control-field">
        <label for="to-date">Al</label>
        <input id="to-date" v-model="toDate" type="date" />
      </div>

      <div class="control-field control-search">
        <label for="reservation-name">Nome prenotazione</label>
        <input
          id="reservation-name"
          v-model.trim="reservationName"
          type="text"
          placeholder="Es. Mario Rossi"
          @keydown.enter.prevent="fetchDocuments"
        />
      </div>

      <button class="btn btn-primary" @click="fetchDocuments" :disabled="loading">
        {{ loading ? 'Caricamento...' : 'Cerca' }}
      </button>
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="!loading && !error" class="summary">
      <div class="summary-card">
        <span class="summary-label">Documenti</span>
        <strong class="summary-value">{{ documents.length }}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Totale periodo</span>
        <strong class="summary-value">{{ formatEuro(totalAmount) }}</strong>
      </div>
    </div>

    <div class="table-wrapper" v-if="!loading && !error && documents.length">
      <table class="documents-table">
        <thead>
          <tr>
            <th>Data/Ora</th>
            <th>Prenotazione</th>
            <th>Camera/Tavolo</th>
            <th>Progressivo</th>
            <th style="text-align: right;">Totale</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in documents"
            :key="doc.firestore_id || `${doc.progressivo}-${doc.timestamp}`"
            class="document-row"
            @click="openDocumentDetail(doc)"
          >
            <td>{{ formatDateTime(doc.timestamp) }}</td>
            <td>{{ doc.reservationName || '-' }}</td>
            <td>{{ doc.room || doc.tableName || '-' }}</td>
            <td>{{ doc.progressivo || '-' }}</td>
            <td class="amount">{{ formatEuro(doc.totale) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && !error && !documents.length" class="empty-state">
      Nessun documento trovato per i filtri selezionati.
    </div>

    <div v-if="isDetailOpen" class="dialog-backdrop" @click.self="closeDetailDialog">
      <div class="dialog-card" role="dialog" aria-modal="true" aria-label="Dettaglio documento">
        <div class="dialog-header">
          <div>
            <h2>Dettaglio documento</h2>
            <p class="dialog-subtitle" v-if="selectedDocumentDetail">
              Documento {{ selectedDocumentDetail.progressivo || '-' }} • {{ formatDateTime(selectedDocumentDetail.timestamp) }}
            </p>
          </div>
          <div class="dialog-actions">
            <button
              class="btn btn-secondary"
              @click="printDocumentDetail"
              :disabled="detailLoading || !selectedDocumentDetail"
            >
              Stampa
            </button>
            <button class="btn-close" @click="closeDetailDialog" aria-label="Chiudi">×</button>
          </div>
        </div>

        <div v-if="detailLoading" class="dialog-loading">Caricamento dettaglio...</div>
        <div v-else-if="detailError" class="error">{{ detailError }}</div>

        <template v-else-if="selectedDocumentDetail">
          <div class="dialog-info-grid">
            <div><strong>Prenotazione:</strong> {{ selectedDocumentDetail.reservationName || '-' }}</div>
            <div><strong>Camera/Tavolo:</strong> {{ selectedDocumentDetail.room || selectedDocumentDetail.tableName || '-' }}</div>
            <div><strong>Righe:</strong> {{ selectedDocumentDetail.rows?.length || 0 }}</div>
            <div><strong>Totale:</strong> {{ formatEuro(selectedDocumentDetail.totale) }}</div>
          </div>

          <div class="table-wrapper dialog-table-wrapper" v-if="selectedDocumentDetail.rows?.length">
            <table class="documents-table">
              <thead>
                <tr>
                  <th>Prodotto</th>
                  <th style="text-align: right;">Qta</th>
                  <th style="text-align: right;">Prezzo</th>
                  <th style="text-align: right;">Totale riga</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in selectedDocumentDetail.rows" :key="row.rowId">
                  <td>{{ row.productName }}</td>
                  <td class="amount">{{ row.quantity }}</td>
                  <td class="amount">{{ formatEuro(row.unitPrice) }}</td>
                  <td class="amount">{{ formatEuro(row.total) }}</td>
                  <td>{{ row.note || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty-state">
            Nessuna riga di venduto disponibile per questo documento.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

const toDateInputValue = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const today = toDateInputValue(new Date())

const fromDate = ref(today)
const toDate = ref(today)
const reservationName = ref('')
const documents = ref([])
const loading = ref(false)
const error = ref('')
const isDetailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const selectedDocumentDetail = ref(null)

const totalAmount = computed(() => {
  return documents.value.reduce((sum, item) => sum + (Number(item?.totale) || 0), 0)
})

const formatEuro = (value) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(value) || 0)
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return '-'
  const dt = new Date(Number(timestamp))
  if (Number.isNaN(dt.getTime())) return '-'

  return dt.toLocaleString('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const escapeHtml = (value) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const printDocumentDetail = () => {
  const detail = selectedDocumentDetail.value
  if (!detail) return

  const detailRows = Array.isArray(detail.rows) ? detail.rows : []
  const rowsHtml = detailRows
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(row.productName)}</td>
          <td class="num">${escapeHtml(row.quantity)}</td>
          <td class="num">${escapeHtml(formatEuro(row.unitPrice))}</td>
          <td class="num">${escapeHtml(formatEuro(row.total))}</td>
          <td>${escapeHtml(row.note || '-')}</td>
        </tr>
      `
    })
    .join('')

  const popup = window.open('', '_blank', 'width=1024,height=900')
  if (!popup) {
    detailError.value = 'Impossibile aprire la finestra di stampa. Verifica il blocco popup del browser.'
    return
  }

  const html = `
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />
        <title>Ristampa Documento ${escapeHtml(detail.progressivo || '')}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            font-family: "Helvetica Neue", Arial, sans-serif;
            color: #111827;
            font-size: 12px;
          }

          .print-wrap {
            width: 100%;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 12px;
          }

          h1 {
            margin: 0;
            font-size: 20px;
          }

          .subtitle {
            margin-top: 4px;
            color: #475569;
          }

          .meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px 14px;
            margin-bottom: 12px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f8fafc;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
            border: 1px solid #d1d5db;
            padding: 6px 8px;
            vertical-align: top;
            word-break: break-word;
          }

          th {
            background: #eef2ff;
            text-align: left;
          }

          .num {
            text-align: right;
            font-variant-numeric: tabular-nums;
          }

          .footer {
            margin-top: 10px;
            text-align: right;
            font-size: 14px;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="print-wrap">
          <div class="header">
            <div>
              <h1>Documento ${escapeHtml(detail.progressivo || '-')}</h1>
              <div class="subtitle">Data/Ora: ${escapeHtml(formatDateTime(detail.timestamp))}</div>
            </div>
          </div>

          <div class="meta">
            <div><strong>Prenotazione:</strong> ${escapeHtml(detail.reservationName || '-')}</div>
            <div><strong>Camera/Tavolo:</strong> ${escapeHtml(detail.room || detail.tableName || '-')}</div>
            <div><strong>Chiusura:</strong> ${escapeHtml(detail.chiusura || '-')}</div>
            <div><strong>Righe:</strong> ${escapeHtml(detailRows.length)}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 38%;">Prodotto</th>
                <th style="width: 10%;" class="num">Qta</th>
                <th style="width: 16%;" class="num">Prezzo</th>
                <th style="width: 16%;" class="num">Totale</th>
                <th style="width: 20%;">Note</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5">Nessuna riga disponibile</td></tr>'}
            </tbody>
          </table>

          <div class="footer">Totale documento: ${escapeHtml(formatEuro(detail.totale))}</div>
        </div>

        <script>
          window.addEventListener('load', function () {
            window.print();
          });
        <\/script>
      </body>
    </html>
  `

  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}

const fetchDocuments = async () => {
  error.value = ''
  loading.value = true

  try {
    if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
      throw new Error('La data iniziale non puo essere successiva alla data finale.')
    }

    const response = await axios.get('/api/mbar/documents', {
      params: {
        from: fromDate.value,
        to: toDate.value,
        reservationName: reservationName.value
      }
    })

    documents.value = Array.isArray(response.data?.documents) ? response.data.documents : []
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Errore durante il caricamento dei documenti.'
    documents.value = []
  } finally {
    loading.value = false
  }
}

const openDocumentDetail = async (doc) => {
  isDetailOpen.value = true
  detailLoading.value = true
  detailError.value = ''
  selectedDocumentDetail.value = null

  try {
    const response = await axios.get('/api/mbar/document_detail', {
      params: {
        firestoreId: doc?.firestore_id || '',
        progressivo: doc?.progressivo || '',
        chiusura: doc?.chiusura || ''
      }
    })

    const detail = response.data?.document
    if (!detail) {
      throw new Error('Dettaglio documento non disponibile.')
    }

    selectedDocumentDetail.value = {
      ...detail,
      rows: Array.isArray(detail.rows) ? detail.rows : []
    }
  } catch (err) {
    detailError.value = err?.response?.data?.message || err?.message || 'Errore nel caricamento del dettaglio documento.'
  } finally {
    detailLoading.value = false
  }
}

const closeDetailDialog = () => {
  isDetailOpen.value = false
  detailError.value = ''
  selectedDocumentDetail.value = null
}

onMounted(() => {
  fetchDocuments()
})
</script>

<style scoped>
.stats-documents {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 8px;
  min-height: calc(100vh - 120px);
}

h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ds-text);
}

.controls {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 12px;
  align-items: end;
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-field label {
  font-size: 0.74rem;
  color: var(--ds-text-soft);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.control-field input {
  min-height: 48px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  padding: 0 14px;
  font-size: 0.95rem;
  outline: none;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
}

.control-field input:focus {
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.control-search {
  grid-column: span 2;
}

.btn {
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 12px 16px;
  font-weight: 700;
  cursor: pointer;
  font: inherit;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #ffffff;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 240px));
  gap: 12px;
}

.summary-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--ds-shadow-card);
}

.summary-label {
  color: var(--ds-text-soft);
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.summary-value {
  color: var(--ds-text);
  font-size: 1.2rem;
  font-weight: 800;
}

.error {
  color: var(--ds-danger);
  background: rgba(254, 242, 242, 0.92);
  border: 1px solid rgba(220, 77, 77, 0.16);
  padding: 14px 16px;
  border-radius: 20px;
}

.table-wrapper {
  background: rgba(255, 255, 255, 0.78);
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  overflow: auto;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.documents-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.documents-table th,
.documents-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
}

.documents-table thead th {
  background: rgba(242, 247, 252, 0.9);
  color: var(--ds-text-soft);
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.documents-table tbody tr:hover {
  background: rgba(248, 250, 252, 0.72);
}

.document-row {
  cursor: pointer;
}

.amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(36, 49, 66, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}

.dialog-card {
  width: min(980px, 100%);
  max-height: 85vh;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  overflow: hidden;
  box-shadow: var(--ds-shadow-soft);
  backdrop-filter: blur(24px);
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--ds-text);
}

.dialog-subtitle {
  margin: 4px 0 0;
  color: var(--ds-text-soft);
}

.btn-close {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.9);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--ds-text-soft);
  padding: 0;
  width: 42px;
  height: 42px;
  border-radius: 14px;
}

.btn-close:hover {
  background: rgba(248, 250, 252, 0.92);
}

.btn-secondary {
  background: rgba(236, 253, 245, 0.92);
  color: #ffffff;
  color: #166534;
  border-color: rgba(34, 197, 94, 0.18);
}

.btn-secondary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.dialog-loading {
  color: var(--ds-text);
}

.dialog-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  color: var(--ds-text);
}

.dialog-table-wrapper {
  max-height: 55vh;
}

.empty-state {
  color: var(--ds-text-soft);
  background: rgba(248, 250, 252, 0.82);
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 20px;
  padding: 14px;
}

@media (max-width: 1024px) {
  .controls {
    grid-template-columns: 1fr 1fr;
  }

  .control-search {
    grid-column: span 2;
  }

  .summary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .controls {
    grid-template-columns: 1fr;
  }

  .control-search {
    grid-column: span 1;
  }

  .dialog-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
