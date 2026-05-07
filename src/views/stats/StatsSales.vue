<template>
  <div class="stats-sales-container">
    <div class="header">
      <h1>📊 Ordinato</h1>
    </div>

    <!-- Filtri -->
    <div class="filters-section">
      <div class="date-range">
        <label>Data inizio:</label>
        <input v-model="fromDate" type="date">
      </div>
      <div class="date-range">
        <label>Data fine:</label>
        <input v-model="toDate" type="date">
      </div>
      <div class="view-mode">
        <label>Visualizza:</label>
        <select v-model="viewMode">
          <option value="daily">Giornaliero</option>
          <option value="weekly">Settimanale</option>
          <option value="monthly">Mensile</option>
        </select>
      </div>
      <button @click="fetchSales" class="btn-fetch">Carica</button>
    </div>

    <div v-if="salesData.length > 0" class="total-section">
      <div class="total-card">
        <span class="total-label">Totale Ordinato nel periodo</span>
        <strong class="total-value">{{ formatCurrency(totalSales) }}</strong>
      </div>
    </div>

    <!-- Grafico -->
    <div class="chart-section" v-if="aggregatedSalesData.length > 0">
      <canvas id="salesChart"></canvas>
    </div>

    <!-- Tabella dati -->
    <div class="table-section" v-if="aggregatedSalesData.length > 0">
      <table class="sales-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Totale Ordinato</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in aggregatedSalesData" :key="idx" :class="{ 'alt-row': idx % 2 === 1 }">
            <td>{{ item.date }}</td>
            <td class="amount">{{ formatCurrency(item.sales) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="topProducts.length" class="table-stats-section">
      <h2 class="section-title">Prodotti più venduti</h2>
      <div class="table-section">
        <table class="sales-table">
          <thead>
            <tr>
              <th style="width: 50%;">Prodotto</th>
              <th style="width: 25%; text-align: right;">Quantità</th>
              <th style="width: 25%; text-align: right;">Fatturato</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(product, idx) in topProducts" :key="product.id || idx" :class="{ 'alt-row': idx % 2 === 1 }">
              <td>{{ product.name }}</td>
              <td style="text-align: right;">{{ product.quantity }}</td>
              <td class="amount" style="text-align: right;">{{ formatCurrency(product.sales) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Ordinato per area -->
    <div v-if="areaData.length" class="table-stats-section">
      <h2 class="section-title">Ordinato per area</h2>
      <div class="area-stats-grid">
        <div v-for="(row, idx) in areaData" :key="idx" class="area-stat-card">
          <div class="area-stat-name">{{ row.area }}</div>
          <div class="area-stat-amount">{{ formatCurrency(row.sales) }}</div>
          <div class="area-stat-bar">
            <div class="area-stat-bar-fill" :style="{ width: areaBarWidth(row.sales) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ordinato per tavolo/camera -->
    <div v-if="tableData.length" class="table-stats-section">
      <h2 class="section-title">Ordinato per tavolo / camera</h2>
      <div class="table-stats-grid">
        <div v-for="(row, idx) in tableData" :key="idx" class="table-stat-card">
          <div>
            <div class="table-stat-name">{{ row.table }}</div>
            <div v-if="row.guestName" class="table-stat-guest">{{ row.guestName }}</div>
          </div>
          <div class="table-stat-meta">
            <span class="badge-orders">{{ row.orders }} {{ row.orders === 1 ? 'ordine' : 'ordini' }}</span>
            <span class="badge-sales">{{ formatCurrency(row.totalSales) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import axios from 'axios'
import Chart from 'chart.js/auto'

const fromDate = ref('')
const toDate = ref('')
const viewMode = ref('daily')
const salesData = ref([])
const aggregatedSalesData = ref([])
const tableData = ref([])
const areaData = ref([])
const topProducts = ref([])
let chart = null

const totalSales = computed(() =>
  salesData.value.reduce((sum, item) => sum + (Number(item.sales) || 0), 0)
)

const toISODate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Inizializza date di default (ultimi 30 giorni)
onMounted(() => {
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  toDate.value = toISODate(today)
  fromDate.value = toISODate(thirtyDaysAgo)
  
  fetchSales()
})

const fetchSales = async () => {
  try {
    const [salesRes, tableRes, areaRes] = await Promise.all([
      axios.get('/api/mbar/sales_by_day', {
        params: { from: fromDate.value, to: toDate.value }
      }),
      axios.get('/api/mbar/sales_by_table', {
        params: { from: fromDate.value, to: toDate.value }
      }),
      axios.get('/api/mbar/sales_by_area', {
        params: { from: fromDate.value, to: toDate.value }
      })
    ])

    salesData.value = salesRes.data.sales || []
    tableData.value = tableRes.data.tables || []
    areaData.value = areaRes.data.areas || []

    try {
      const topProductsRes = await axios.get('/api/mbar/product_stats', {
        params: { query: '', from: fromDate.value, to: toDate.value }
      })
      topProducts.value = topProductsRes.data.top20 || []
    } catch (topProductsError) {
      console.error('Errore nel caricamento prodotti più venduti:', topProductsError)
      topProducts.value = []
    }

    aggregateAndRenderChart()
  } catch (error) {
    console.error('Errore nel caricamento delle vendite:', error)
  }
}

const aggregateData = () => {
  if (viewMode.value === 'daily') {
    return salesData.value
  }
  
  if (viewMode.value === 'weekly') {
    const weekly = {}
    salesData.value.forEach(item => {
      const date = new Date(item.date)
      const week = getWeekStart(date)
      const key = toISODate(week)
      weekly[key] = (weekly[key] || 0) + item.sales
    })
    return Object.entries(weekly).map(([date, sales]) => ({
      date: `${date} - ${toISODate(getWeekEnd(new Date(date)))}`,
      sales
    }))
  }
  
  if (viewMode.value === 'monthly') {
    const monthly = {}
    salesData.value.forEach(item => {
      const date = new Date(item.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthly[key] = (monthly[key] || 0) + item.sales
    })
    return Object.entries(monthly).map(([key, sales]) => ({
      date: key,
      sales
    }))
  }
}

const getWeekStart = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

const getWeekEnd = (date) => {
  const d = new Date(date)
  d.setDate(d.getDate() + 6)
  return d
}

const aggregateAndRenderChart = async () => {
  const aggregated = aggregateData()
  aggregatedSalesData.value = aggregated
  
  await nextTick()
  
  const ctx = document.getElementById('salesChart')
  if (!ctx) return
  
  if (chart) {
    chart.destroy()
  }
  
  const chartData = {
    labels: aggregated.map(item => item.date),
    datasets: [
      {
        label: 'Totale Ordinato (€)',
        data: aggregated.map(item => item.sales),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }
    ]
  }
  
  chart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { size: 14 },
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          callbacks: {
            label: ctx => `€ ${ctx.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => `€ ${value.toFixed(0)}`
          }
        }
      }
    }
  })
}

watch(viewMode, () => {
  if (salesData.value.length > 0) {
    aggregateAndRenderChart()
  }
})

const areaBarWidth = (sales) => {
  const max = Math.max(...areaData.value.map(r => r.sales), 1)
  return Math.round((sales / max) * 100)
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
}
</script>

<style scoped>
.stats-sales-container {
  padding: 8px;
  min-height: calc(100vh - 120px);
}

.header {
  margin-bottom: 20px;
  padding: 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.header h1 {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ds-text);
  margin: 0;
}

.filters-section {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: flex-end;
  background: rgba(255, 255, 255, 0.78);
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
  flex-wrap: wrap;
}

.date-range,
.view-mode {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.date-range label,
.view-mode label {
  font-size: 0.74rem;
  font-weight: 800;
  color: var(--ds-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.date-range input,
.view-mode select {
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  font-size: 14px;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
}

.date-range input:focus,
.view-mode select:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.btn-fetch {
  padding: 12px 18px;
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  border: 1px solid transparent;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-fetch:hover {
  transform: translateY(-1px);
  box-shadow: 0 22px 34px rgba(29, 140, 242, 0.22);
}

.total-section {
  margin-bottom: 20px;
}

.total-card {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(29, 140, 242, 0.18);
  border-left: 5px solid var(--ds-primary);
  border-radius: 20px;
  padding: 14px 18px;
  box-shadow: var(--ds-shadow-card);
}

.total-label {
  font-size: 0.74rem;
  font-weight: 800;
  color: var(--ds-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.total-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--ds-primary-strong);
}

.chart-section {
  background: rgba(255, 255, 255, 0.78);
  padding: 24px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
  margin-bottom: 24px;
  height: 400px;
}

.chart-section canvas {
  max-height: 400px;
}

.table-section {
  background: rgba(255, 255, 255, 0.78);
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.sales-table {
  width: 100%;
  border-collapse: collapse;
}

.sales-table thead {
  background: rgba(242, 247, 252, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.sales-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 800;
  color: var(--ds-text-soft);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sales-table tbody tr {
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  transition: background 0.2s ease;
}

.sales-table tbody tr:hover {
  background: rgba(248, 250, 252, 0.72);
}

.sales-table tbody tr.alt-row {
  background: rgba(248, 250, 252, 0.52);
}

.sales-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--ds-text);
}

.sales-table td.amount {
  font-weight: 700;
  color: #059669;
}

.table-stats-section {
  margin-top: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--ds-text);
  margin: 0 0 16px;
}

.table-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.table-stat-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--ds-shadow-card);
}

.table-stat-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--ds-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table-stat-guest {
  margin-top: 4px;
  font-size: 0.83rem;
  color: var(--ds-text-soft);
  font-weight: 500;
}

.table-stat-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge-orders {
  background: rgba(231, 242, 255, 0.92);
  color: var(--ds-primary-strong);
  border: 1px solid rgba(29, 140, 242, 0.16);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.78rem;
  font-weight: 600;
}

.badge-sales {
  background: rgba(236, 253, 245, 0.92);
  color: #047857;
  border: 1px solid rgba(34, 197, 94, 0.16);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.82rem;
  font-weight: 700;
}

.area-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.area-stat-card {
  background: rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  padding: 16px 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.area-stat-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ds-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.area-stat-amount {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--ds-primary-strong);
}

.area-stat-bar {
  height: 6px;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  overflow: hidden;
}

.area-stat-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ds-primary), var(--ds-primary-strong));
  border-radius: 999px;
  transition: width 0.4s ease;
}

@media (max-width: 720px) {
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
