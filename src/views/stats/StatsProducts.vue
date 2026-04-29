<template>
  <div class="stats-products">
    <h1>Statistiche Prodotti</h1>

    <div class="controls main-controls">
      <input type="date" v-model="fromDate" />
      <input type="date" v-model="toDate" />
      <button @click="fetchBaseData" class="btn btn-primary">Aggiorna periodo</button>
    </div>

    <div class="search-switcher">
      <label class="switch-option">
        <input type="radio" value="product" v-model="searchMode" />
        Ricerca per prodotto
      </label>
      <label class="switch-option">
        <input type="radio" value="category" v-model="searchMode" />
        Ricerca per categoria
      </label>
    </div>

    <div class="controls" v-if="searchMode === 'product'">
      <input v-model="searchQuery" placeholder="Nome prodotto" @keydown.enter.prevent="searchProduct" />
      <button @click="searchProduct" class="btn btn-primary">Cerca prodotto</button>
    </div>

    <div class="controls" v-else>
      <select v-model="selectedCategory" @change="onCategoryChange" class="category-select">
        <option value="">Seleziona categoria</option>
        <option v-for="category in availableCategories" :key="category" :value="category">
          {{ category }}
        </option>
      </select>
    </div>

    <div v-if="loading" class="loading">Caricamento...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <section v-if="searchMode === 'product' && productSearchDone" class="section-container">
      <h3>Risultati ricerca prodotto</h3>

      <div v-if="!productResults.length" class="empty-state">
        Nessun prodotto trovato per "{{ searchQuery.trim() }}"
      </div>

      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50%;">Prodotto</th>
              <th style="width: 15%;">Categoria</th>
              <th style="width: 17.5%; text-align: right;">Quantità</th>
              <th style="width: 17.5%; text-align: right;">Fatturato</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, idx) in productResults"
              :key="p.id || `${p.name}-${idx}`"
              :class="[
                'data-row',
                'result-row',
                idx % 2 === 0 ? 'even' : 'odd',
                selectedProduct && selectedProduct.id === p.id ? 'selected' : ''
              ]"
              @click="selectProduct(p)"
            >
              <td class="product-cell">{{ p.name }}</td>
              <td>{{ p.category || '-' }}</td>
              <td class="numeric-cell">{{ p.quantity }}</td>
              <td class="numeric-cell numeric-highlight">{{ formatCurrency(p.sales) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="searchMode === 'product' && selectedProduct" class="section-container">
      <h3>Andamento vendite: "{{ selectedProduct.name }}"</h3>

      <div v-if="loadingProductTrend" class="loading">Caricamento andamento prodotto...</div>
      <div v-else-if="productTrendError" class="error">{{ productTrendError }}</div>

      <template v-else>
        <div v-if="!productTrendData.length" class="empty-state">
          Nessuna vendita rilevata per questo prodotto nel periodo selezionato.
        </div>

        <template v-else>
          <div class="trend-controls">
            <label>Visualizza:</label>
            <select v-model="productTrendViewMode">
              <option value="daily">Giornaliero</option>
              <option value="weekly">Settimanale</option>
              <option value="monthly">Mensile</option>
            </select>
          </div>

          <div class="chart-section">
            <canvas id="productTrendChart"></canvas>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 34%;">Data</th>
                  <th style="width: 33%; text-align: right;">Quantità</th>
                  <th style="width: 33%; text-align: right;">Fatturato</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(point, idx) in productTrendAggregatedData" :key="`${point.date}-${idx}`" :class="['data-row', idx % 2 === 0 ? 'even' : 'odd']">
                  <td>{{ point.date }}</td>
                  <td class="numeric-cell">{{ point.quantity }}</td>
                  <td class="numeric-cell numeric-highlight">{{ formatCurrency(point.sales) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </section>

    <section v-if="searchMode === 'category' && selectedCategory" class="section-container">
      <h3>Statistiche Categoria: "{{ selectedCategory }}"</h3>
      <div v-if="loadingCategory" class="loading">Caricamento categoria...</div>
      <div v-else-if="categoryError" class="error">{{ categoryError }}</div>
      <div v-else class="stats-summary">
        <div class="summary-card">
          <div class="summary-label">Quantita Totale Categoria</div>
          <div class="summary-value">{{ categorySummary.quantity }} pezzi</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Fatturato Categoria</div>
          <div class="summary-value">{{ formatCurrency(categorySummary.sales) }}</div>
        </div>
      </div>
    </section>

    <section v-if="searchMode === 'category' && selectedCategory && categoryProducts.length" class="section-container category-detail">
      <div class="table-header-actions">
        <h3>Prodotti in "{{ selectedCategory }}"</h3>
        <button @click="exportCsv" class="btn btn-secondary" :disabled="!canExportData || loadingCategory">
          Esporta CSV
        </button>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50%;">Prodotto</th>
              <th style="width: 25%; text-align: right;">Quantità</th>
              <th style="width: 25%; text-align: right;">Fatturato</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, idx) in categoryProducts" :key="p.id" :class="['data-row', idx % 2 === 0 ? 'even' : 'odd']">
              <td class="product-cell">{{ p.name }}</td>
              <td class="numeric-cell">{{ p.quantity }}</td>
              <td class="numeric-cell numeric-highlight">{{ formatCurrency(p.sales) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import Chart from 'chart.js/auto';

const searchQuery = ref('');
const fromDate = ref('');
const toDate = ref('');
const searchMode = ref('product');
const loading = ref(false);
const error = ref('');
const productResults = ref([]);
const productSearchDone = ref(false);
const selectedCategory = ref('');
const availableCategories = ref([]);
const categoryProducts = ref([]);
const categorySummary = ref({ quantity: 0, sales: 0 });
const loadingCategory = ref(false);
const categoryError = ref('');
const selectedProduct = ref(null);
const productTrendData = ref([]);
const productTrendViewMode = ref('daily');
const loadingProductTrend = ref(false);
const productTrendError = ref('');
const productSearchDebounceMs = 350;
let productSearchDebounceTimer = null;
let productTrendChart = null;

const canExportData = computed(() => {
  return searchMode.value === 'category' && !!selectedCategory.value && categoryProducts.value.length > 0;
});

const formatCurrency = (value) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
};

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getWeekEnd = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() + 6);
  return d;
};

const productTrendAggregatedData = computed(() => {
  if (productTrendViewMode.value === 'daily') {
    return productTrendData.value;
  }

  if (productTrendViewMode.value === 'weekly') {
    const weekly = {};
    productTrendData.value.forEach((point) => {
      const date = new Date(point.date);
      const weekStart = getWeekStart(date);
      const key = toISODate(weekStart);
      if (!weekly[key]) {
        weekly[key] = { quantity: 0, sales: 0 };
      }
      weekly[key].quantity += Number(point.quantity) || 0;
      weekly[key].sales += Number(point.sales) || 0;
    });

    return Object.entries(weekly).map(([date, values]) => ({
      date: `${date} - ${toISODate(getWeekEnd(new Date(date)))}`,
      quantity: values.quantity,
      sales: values.sales
    }));
  }

  const monthly = {};
  productTrendData.value.forEach((point) => {
    const date = new Date(point.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) {
      monthly[key] = { quantity: 0, sales: 0 };
    }
    monthly[key].quantity += Number(point.quantity) || 0;
    monthly[key].sales += Number(point.sales) || 0;
  });

  return Object.entries(monthly).map(([date, values]) => ({
    date,
    quantity: values.quantity,
    sales: values.sales
  }));
});

const escapeCsvValue = (value) => {
  const safeValue = String(value ?? '');
  if (safeValue.includes(';') || safeValue.includes('"') || safeValue.includes('\n')) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
};

const exportCsv = () => {
  if (!canExportData.value) return;

  const rows = [['Nome prodotto', 'Quantita', 'Fatturato']];

  categoryProducts.value.forEach((p) => {
    rows.push([p.name, Number(p.quantity) || 0, Number(p.sales) || 0]);
  });

  const csvContent = rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(';'))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `stats_prodotti_${selectedCategory.value}_${fromDate.value}_${toDate.value}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const fetchBaseData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/mbar/product_stats', {
      params: {
        query: '',
        from: fromDate.value,
        to: toDate.value
      }
    });

    availableCategories.value = (res.data.byCategory || [])
      .map(c => c.category)
      .filter(Boolean);

    // Non mostrare il totale generale: il dettaglio prodotto si mostra solo dopo ricerca esplicita.
    productResults.value = [];
    productSearchDone.value = false;
    selectedProduct.value = null;
    productTrendData.value = [];
    productTrendError.value = '';
    destroyProductTrendChart();

    if (searchMode.value === 'category' && selectedCategory.value) {
      if (!availableCategories.value.includes(selectedCategory.value)) {
        selectedCategory.value = '';
        categoryProducts.value = [];
        categorySummary.value = { quantity: 0, sales: 0 };
        categoryError.value = '';
      } else {
        await fetchCategoryDetails(selectedCategory.value);
      }
    }
  } catch (err) {
    console.error('Errore fetch stats prodotti', err);
    error.value = 'Impossibile caricare le statistiche';
  } finally {
    loading.value = false;
  }
};

const destroyProductTrendChart = () => {
  if (productTrendChart) {
    productTrendChart.destroy();
    productTrendChart = null;
  }
};

const renderProductTrendChart = async () => {
  await nextTick();

  const canvas = document.getElementById('productTrendChart');
  if (!canvas) return;

  destroyProductTrendChart();

  productTrendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: productTrendAggregatedData.value.map((point) => point.date),
      datasets: [
        {
          label: 'Fatturato prodotto (€)',
          data: productTrendAggregatedData.value.map((point) => point.sales),
          yAxisID: 'ySales',
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6
        },
        {
          type: 'bar',
          label: 'Quantita venduta',
          data: productTrendAggregatedData.value.map((point) => point.quantity),
          yAxisID: 'yQty',
          backgroundColor: 'rgba(15, 118, 110, 0.35)',
          borderColor: '#0f766e',
          borderWidth: 1,
          borderRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.yAxisID === 'yQty') {
                return `${Number(ctx.parsed.y || 0).toFixed(0)} pezzi`;
              }
              return `€ ${Number(ctx.parsed.y || 0).toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        ySales: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          ticks: {
            callback: (value) => `€ ${Number(value).toFixed(0)}`
          }
        },
        yQty: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: (value) => `${Number(value).toFixed(0)}`
          }
        }
      }
    }
  });
};

const fetchProductTrend = async (product) => {
  if (!product?.id) {
    productTrendData.value = [];
    productTrendError.value = 'Prodotto non valido per il calcolo del trend';
    destroyProductTrendChart();
    return;
  }

  loadingProductTrend.value = true;
  productTrendViewMode.value = 'daily';
  productTrendError.value = '';
  productTrendData.value = [];
  destroyProductTrendChart();

  try {
    const res = await axios.get('/api/mbar/product_stats/trend', {
      params: {
        productId: product.id,
        from: fromDate.value,
        to: toDate.value
      }
    });

    const trend = Array.isArray(res.data?.trend) ? res.data.trend : [];
    productTrendData.value = trend.map((point) => ({
      date: point.date,
      quantity: Number(point.quantity) || 0,
      sales: Number(point.sales) || 0
    }));

    if (productTrendData.value.length) {
      await renderProductTrendChart();
    }
  } catch (err) {
    console.error('Errore fetch trend prodotto', err);
    productTrendError.value = 'Impossibile caricare l\'andamento del prodotto';
    productTrendData.value = [];
    destroyProductTrendChart();
  } finally {
    loadingProductTrend.value = false;
  }
};

const selectProduct = async (product) => {
  selectedProduct.value = product;
  await fetchProductTrend(product);
};

const searchProduct = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    productResults.value = [];
    productSearchDone.value = false;
    selectedProduct.value = null;
    productTrendData.value = [];
    productTrendError.value = '';
    destroyProductTrendChart();
    return;
  }

  loading.value = true;
  error.value = '';
  productSearchDone.value = false;
  selectedProduct.value = null;
  productTrendData.value = [];
  productTrendError.value = '';
  destroyProductTrendChart();

  try {
    const res = await axios.get('/api/mbar/product_stats', {
      params: {
        query,
        from: fromDate.value,
        to: toDate.value
      }
    });

    const payload = res.data.productSales;
    const normalized = Array.isArray(payload)
      ? payload
      : payload
        ? [payload]
        : [];

    productResults.value = normalized
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        quantity: Number(p.quantity) || 0,
        sales: Number(p.sales) || 0
      }))
      .sort((a, b) => b.sales - a.sales);

    productSearchDone.value = true;
  } catch (err) {
    console.error('Errore fetch prodotto', err);
    error.value = 'Impossibile caricare il prodotto richiesto';
    productResults.value = [];
  } finally {
    loading.value = false;
  }
};

const fetchCategoryDetails = async (categoryName) => {
  loadingCategory.value = true;
  categoryError.value = '';

  // fetch products for this category with current filters
  try {
    const res = await axios.get('/api/mbar/product_stats/by_category', {
      params: {
        category: categoryName,
        from: fromDate.value,
        to: toDate.value
      }
    });

    const products = res.data.products || [];
    categoryProducts.value = products;
    categorySummary.value = {
      quantity: products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0),
      sales: products.reduce((sum, p) => sum + (Number(p.sales) || 0), 0)
    };
  } catch (err) {
    console.error('Errore fetch prodotti per categoria', err);
    categoryProducts.value = [];
    categorySummary.value = { quantity: 0, sales: 0 };
    categoryError.value = 'Impossibile caricare i dettagli della categoria';
  } finally {
    loadingCategory.value = false;
  }
};

const onCategoryChange = async () => {
  if (!selectedCategory.value) {
    categoryProducts.value = [];
    categorySummary.value = { quantity: 0, sales: 0 };
    categoryError.value = '';
    return;
  }

  await fetchCategoryDetails(selectedCategory.value);
};

onMounted(async () => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  toDate.value = toISODate(today);
  fromDate.value = toISODate(thirtyDaysAgo);

  await fetchBaseData();
});

watch(searchMode, (mode) => {
  if (mode === 'product') {
    selectedCategory.value = '';
    categoryProducts.value = [];
    categorySummary.value = { quantity: 0, sales: 0 };
    categoryError.value = '';
  } else {
    if (productSearchDebounceTimer) {
      clearTimeout(productSearchDebounceTimer);
      productSearchDebounceTimer = null;
    }
    searchQuery.value = '';
    productResults.value = [];
    productSearchDone.value = false;
    selectedProduct.value = null;
    productTrendViewMode.value = 'daily';
    productTrendData.value = [];
    productTrendError.value = '';
    destroyProductTrendChart();
  }
});

watch(searchQuery, (nextQuery) => {
  if (searchMode.value !== 'product') {
    return;
  }

  if (productSearchDebounceTimer) {
    clearTimeout(productSearchDebounceTimer);
    productSearchDebounceTimer = null;
  }

  const trimmed = nextQuery.trim();
  if (!trimmed) {
    productResults.value = [];
    productSearchDone.value = false;
    error.value = '';
    selectedProduct.value = null;
    productTrendViewMode.value = 'daily';
    productTrendData.value = [];
    productTrendError.value = '';
    destroyProductTrendChart();
    return;
  }

  productSearchDebounceTimer = setTimeout(() => {
    searchProduct();
  }, productSearchDebounceMs);
});

watch(productResults, (results) => {
  if (!selectedProduct.value) return;

  const stillPresent = results.some((item) => item.id === selectedProduct.value.id);
  if (!stillPresent) {
    selectedProduct.value = null;
    productTrendViewMode.value = 'daily';
    productTrendData.value = [];
    productTrendError.value = '';
    destroyProductTrendChart();
  }
});

watch(productTrendViewMode, async () => {
  if (!selectedProduct.value || !productTrendAggregatedData.value.length) {
    destroyProductTrendChart();
    return;
  }

  await renderProductTrendChart();
});

onBeforeUnmount(() => {
  if (productSearchDebounceTimer) {
    clearTimeout(productSearchDebounceTimer);
    productSearchDebounceTimer = null;
  }
  destroyProductTrendChart();
});
</script>

<style scoped>
.stats-products {
  padding: 24px;
  background: #f9fafb;
  min-height: 100vh;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 24px;
  color: #111827;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #374151;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 24px;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.main-controls input {
  flex: 0 0 auto;
  min-width: 180px;
}

.search-switcher {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;
}

.switch-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
}

.controls input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  flex: 1;
  min-width: 150px;
}

.category-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  min-width: 180px;
  background: white;
  color: #111827;
}

.controls input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.category-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #0f766e;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #0d665f;
}

.btn-secondary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.table-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.loading,
.error {
  padding: 16px;
  border-radius: 6px;
  margin-top: 12px;
  font-weight: 500;
}

.loading {
  background: #dbeafe;
  color: #1e40af;
}

.error {
  background: #fee2e2;
  color: #991b1b;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.section-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.product-detail-card {
  background: #f9fafb;
  padding: 16px;
  border-radius: 6px;
  border-left: 4px solid #3b82f6;
}

.product-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.detail-label {
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  color: #374151;
  font-weight: 600;
}

.detail-value-highlight {
  color: #059669;
  font-weight: 700;
  font-size: 16px;
}

.empty-state {
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  padding: 16px;
  color: #4b5563;
  font-weight: 500;
}

.table-container {
  overflow-x: auto;
}

.chart-section {
  position: relative;
  width: 100%;
  height: 320px;
  margin-bottom: 16px;
}

.trend-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.trend-controls label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.trend-controls select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #111827;
}

.trend-controls select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table thead {
  background: #f3f4f6;
  border-bottom: 2px solid #d1d5db;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  font-size: 13px;
}

.data-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.15s;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.data-table tbody tr.even {
  background: white;
}

.data-table tbody tr.odd {
  background: #fafbfc;
}

.data-row td {
  padding: 14px 16px;
  color: #374151;
}

.result-row {
  cursor: pointer;
}

.result-row.selected {
  background: #eff6ff !important;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: #111827;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.numeric-cell {
  text-align: right;
  font-weight: 500;
  color: #374151;
}

.numeric-highlight {
  color: #059669;
  font-weight: 700;
}

.category-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.category-item:hover {
  background: #eff6ff;
  border-color: #3b82f6;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.category-name {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
}

.category-stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.stat-badge {
  background: #dbeafe;
  color: #1e40af;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.stat-value {
  font-weight: 700;
  color: #059669;
}

.category-detail {
  margin-top: 24px;
  border: 2px solid #dbeafe;
}
</style>
