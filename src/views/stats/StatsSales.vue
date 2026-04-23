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
  padding: 24px;
  background: #f6f8fa;
  min-height: 100vh;
}

.header {
  margin-bottom: 32px;
}

.header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.filters-section {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  align-items: flex-end;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.date-range input,
.view-mode select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  background: white;
  color: #1f2937;
}

.date-range input:focus,
.view-mode select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-fetch {
  padding: 8px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-fetch:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-fetch:active {
  transform: translateY(0);
}

.total-section {
  margin-bottom: 20px;
}

.total-card {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  background: white;
  border: 1px solid #dbeafe;
  border-left: 5px solid #2563eb;
  border-radius: 8px;
  padding: 14px 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.total-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.total-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #1d4ed8;
}

.chart-section {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 32px;
  height: 400px;
}

.chart-section canvas {
  max-height: 400px;
}

.table-section {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.sales-table {
  width: 100%;
  border-collapse: collapse;
}

.sales-table thead {
  background: #f3f4f6;
  border-bottom: 2px solid #e5e7eb;
}

.sales-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sales-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.2s ease;
}

.sales-table tbody tr:hover {
  background: #f9fafb;
}

.sales-table tbody tr.alt-row {
  background: #f9fafb;
}

.sales-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #1f2937;
}

.sales-table td.amount {
  font-weight: 600;
  color: #059669;
}

.table-stats-section {
  margin-top: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 16px;
}

.table-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.table-stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.table-stat-name {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table-stat-guest {
  margin-top: 4px;
  font-size: 0.83rem;
  color: #64748b;
  font-weight: 500;
}

.table-stat-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge-orders {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.78rem;
  font-weight: 600;
}

.badge-sales {
  background: #f0fdf4;
  color: #047857;
  border: 1px solid #bbf7d0;
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
  background: white;
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.area-stat-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.area-stat-amount {
  font-size: 1.3rem;
  font-weight: 800;
  color: #1d4ed8;
}

.area-stat-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.area-stat-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  border-radius: 999px;
  transition: width 0.4s ease;
}
</style>
