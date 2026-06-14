<template>
  <div class="breakfast-report">
    <div class="report-actions no-print">
      <button class="btn-refresh" type="button" :disabled="isLoading" @click="loadReport">
        {{ isLoading ? 'Caricamento...' : 'Aggiorna report' }}
      </button>
      <button class="btn-print" type="button" :disabled="!reportRows.length" @click="printReport">
        Stampa
      </button>
    </div>

    <p v-if="errorMessage" class="status error no-print">{{ errorMessage }}</p>

    <section ref="printArea" class="report-card">
      <header class="report-header">
        <div>
          <p class="eyebrow">Report colazione</p>
          <h2>{{ formattedReportDate }}</h2>
        </div>
        <div class="summary">
          <div class="summary-item">
            <span>Camere</span>
            <strong>{{ roomCount }}</strong>
          </div>
          <div class="summary-item">
            <span>Persone</span>
            <strong>{{ totalPax }}</strong>
          </div>
        </div>
      </header>

      <div v-if="reportRows.length" class="table-wrap">
        <table class="breakfast-table">
          <colgroup>
            <col class="room-column" />
            <col class="name-column" />
            <col class="pax-column" />
            <col class="board-column" />
            <col class="notes-column" />
          </colgroup>
          <thead>
            <tr>
              <th>Camera</th>
              <th>Nome</th>
              <th>Persone</th>
              <th>Board</th>
              <th class="notes-col">Check / Note</th>
            </tr>
          </thead>
          <tbody v-for="group in groupedRows" :key="group.board">
            <tr class="board-row">
              <td colspan="5">{{ group.board }}</td>
            </tr>
            <tr v-for="row in group.rows" :key="`${row.room}-${row.guestName}`">
              <td class="room-cell">{{ row.room }}</td>
              <td>{{ row.guestName }}</td>
              <td>{{ row.pax }}</td>
              <td>{{ row.board }}</td>
              <td class="notes-col"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="report-empty">
        {{ isLoading ? 'Preparazione report colazione...' : 'Nessuna colazione prevista.' }}
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

const BREAKFAST_REPORT_ENDPOINT = '/api/print_breakfast'

const printArea = ref(null)
const reportDate = ref('')
const reportRows = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

onMounted(() => {
  loadReport()
})

const normalizedRows = computed(() => reportRows.value.map((row) => {
  const firstname = String(row?.guest?.firstname || '').trim()
  const lastname = String(row?.guest?.lastname || '').trim()
  const guestName = `${firstname} ${lastname}`.trim() || String(row?.guestName || row?.name || '').trim()

  return {
    room: row?.room ?? '',
    guestName,
    pax: Number(row?.pax || 0),
    board: String(row?.board || 'N/D').trim() || 'N/D'
  }
}))

const groupedRows = computed(() => {
  const groups = new Map()

  normalizedRows.value.forEach((row) => {
    if (!groups.has(row.board)) {
      groups.set(row.board, [])
    }

    groups.get(row.board).push(row)
  })

  return Array.from(groups.entries()).map(([board, rows]) => ({ board, rows }))
})

const totalPax = computed(() => normalizedRows.value.reduce((sum, row) => sum + row.pax, 0))
const roomCount = computed(() => new Set(normalizedRows.value.map(row => String(row.room))).size)
const formattedReportDate = computed(() => {
  if (!reportDate.value) {
    return 'Domani'
  }

  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(`${reportDate.value}T00:00:00`))
})

async function loadReport() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const { data } = await axios.get(BREAKFAST_REPORT_ENDPOINT)
    reportDate.value = data?.date || ''
    reportRows.value = Array.isArray(data?.rows) ? data.rows : []
  } catch (error) {
    console.error('Errore caricamento report colazione:', error)
    errorMessage.value = 'Impossibile caricare il report colazione.'
    reportDate.value = ''
    reportRows.value = []
  } finally {
    isLoading.value = false
  }
}

function printReport() {
  window.print()
}
</script>

<style scoped>
.breakfast-report {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1440px;
  margin: 0 auto;
  color: var(--ds-text);
}

.report-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-refresh,
.btn-print {
  border: 0;
  border-radius: 999px;
  padding: 0.85rem 1.25rem;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.btn-refresh {
  background: linear-gradient(135deg, #1d8cf2, #0f6cc8);
  box-shadow: 0 18px 34px rgba(15, 108, 200, 0.26);
}

.btn-print {
  background: linear-gradient(135deg, #1f7661, #155a4a);
  box-shadow: 0 18px 34px rgba(21, 90, 74, 0.24);
}

.btn-refresh:disabled,
.btn-print:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
}

.status {
  margin: 0;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  font-weight: 700;
}

.status.error {
  background: rgba(220, 38, 38, 0.12);
  color: #991b1b;
}

.report-card {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  padding: 1.7rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.eyebrow {
  margin: 0 0 0.5rem;
  color: var(--ds-text-soft);
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.report-header h2 {
  margin: 0;
  font-size: 2rem;
  letter-spacing: 0;
}

.summary {
  display: flex;
  gap: 1rem;
}

.summary-item {
  min-width: 128px;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.9);
  display: grid;
  gap: 0.35rem;
}

.summary span {
  display: block;
  color: var(--ds-text-soft);
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1;
}

.summary strong {
  display: block;
  font-size: 1.7rem;
  line-height: 1;
}

.table-wrap {
  overflow-x: auto;
  padding: 1.1rem;
}

.breakfast-table {
  width: 100%;
  min-width: 1040px;
  border-collapse: collapse;
  table-layout: fixed;
  border: 1px solid rgba(71, 85, 105, 0.32);
  background: #ffffff;
}

.room-column {
  width: 130px;
}

.name-column {
  width: auto;
}

.pax-column {
  width: 140px;
}

.board-column {
  width: 130px;
}

.notes-column {
  width: 220px;
}

.breakfast-table th,
.breakfast-table td {
  height: 48px;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(71, 85, 105, 0.32);
  text-align: left;
  vertical-align: middle;
  font-size: 1rem;
}

.breakfast-table thead {
  background: #e8eef5;
  color: var(--ds-text);
  font-size: 0.9rem;
  text-transform: uppercase;
}

.breakfast-table th {
  font-weight: 900;
}

.board-row td {
  height: 42px;
  background: rgba(29, 140, 242, 0.12);
  color: #0f6cc8;
  font-weight: 800;
  font-size: 1rem;
}

.room-cell {
  font-weight: 800;
  font-size: 1.08rem;
}

.notes-col {
  min-width: 220px;
}

.report-empty {
  display: flex;
  min-height: 420px;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--ds-text-soft);
  text-align: center;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  :global(.sidebar),
  :global(.content-toolbar),
  .no-print {
    display: none !important;
  }

  :global(.content) {
    margin: 0 !important;
  }

  :global(.content-body) {
    padding: 0 !important;
  }

  .breakfast-report {
    max-width: none;
    width: auto;
    padding: 6mm 8mm 0;
    box-sizing: border-box;
    font-size: 10pt;
  }

  .report-card {
    width: auto;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    overflow: visible;
  }

  .report-header {
    padding: 0 0 6mm;
  }

  .table-wrap {
    overflow: visible;
    padding: 0;
  }

  .breakfast-table {
    width: 100%;
    min-width: 0;
  }

  .room-column {
    width: 12%;
  }

  .name-column {
    width: 38%;
  }

  .pax-column {
    width: 13%;
  }

  .board-column {
    width: 12%;
  }

  .notes-column {
    width: 25%;
  }

  .breakfast-table th,
  .breakfast-table td {
    height: 8mm;
    border-color: #333333;
    padding: 1.3mm 1.8mm;
    font-size: 8.5pt;
    line-height: 1.15;
    overflow-wrap: anywhere;
    word-break: normal;
  }

  .breakfast-table thead {
    font-size: 7.5pt;
  }

  .board-row td {
    height: 7mm;
    font-size: 9pt;
  }

  .room-cell {
    font-size: 8.5pt;
  }

  .summary-item {
    min-width: 26mm;
    padding: 3mm;
  }

  .summary strong {
    font-size: 17pt;
  }

  .report-header h2 {
    font-size: 21pt;
  }
}
</style>
