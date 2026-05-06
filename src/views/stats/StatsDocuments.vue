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
  gap: 16px;
}

h1 {
  margin: 0;
}

.controls {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 12px;
  align-items: end;
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-field label {
  font-size: 0.9rem;
  color: #4b5563;
}

.control-field input {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.95rem;
  outline: none;
}

.control-field input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.control-search {
  grid-column: span 2;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
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
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  color: #6b7280;
  font-size: 0.9rem;
}

.summary-value {
  color: #111827;
  font-size: 1.2rem;
}

.error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 10px 12px;
  border-radius: 10px;
}

.table-wrapper {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: auto;
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
  background: #f8fafc;
  color: #334155;
  font-size: 0.85rem;
}

.documents-table tbody tr:hover {
  background: #f8fafc;
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
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}

.dialog-card {
  width: min(980px, 100%);
  max-height: 85vh;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
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
}

.dialog-subtitle {
  margin: 4px 0 0;
  color: #6b7280;
}

.btn-close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #475569;
  padding: 2px 6px;
  border-radius: 8px;
}

.btn-close:hover {
  background: #f1f5f9;
}

.btn-secondary {
  background: #0f766e;
  color: #ffffff;
}

.btn-secondary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.dialog-loading {
  color: #334155;
}

.dialog-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  color: #1f2937;
}

.dialog-table-wrapper {
  max-height: 55vh;
}

.empty-state {
  color: #6b7280;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
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
