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
      <input v-model="searchQuery" placeholder="Nome prodotto" />
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

    <section v-if="productResult" class="section-container">
      <h3>Prodotto Selezionato</h3>
      <div class="product-detail-card">
        <div class="detail-info">
          <p class="product-name">{{ productResult.name }}</p>
          <div class="detail-row">
            <span class="detail-label">Quantità:</span>
            <span class="detail-value">{{ productResult.quantity }} pezzi</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Fatturato:</span>
            <span class="detail-value-highlight">{{ formatCurrency(productResult.sales) }}</span>
          </div>
        </div>
      </div>
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
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';

const searchQuery = ref('');
const fromDate = ref('');
const toDate = ref('');
const searchMode = ref('product');
const loading = ref(false);
const error = ref('');
const productResult = ref(null);
const selectedCategory = ref('');
const availableCategories = ref([]);
const categoryProducts = ref([]);
const categorySummary = ref({ quantity: 0, sales: 0 });
const loadingCategory = ref(false);
const categoryError = ref('');

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
    const res = await axios.get('http://localhost:8088/api/mbar/product_stats', {
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
    productResult.value = null;

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

const searchProduct = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    productResult.value = null;
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const res = await axios.get('http://localhost:8088/api/mbar/product_stats', {
      params: {
        query,
        from: fromDate.value,
        to: toDate.value
      }
    });

    productResult.value = res.data.productSales || null;
  } catch (err) {
    console.error('Errore fetch prodotto', err);
    error.value = 'Impossibile caricare il prodotto richiesto';
  } finally {
    loading.value = false;
  }
};

const fetchCategoryDetails = async (categoryName) => {
  loadingCategory.value = true;
  categoryError.value = '';

  // fetch products for this category with current filters
  try {
    const res = await axios.get('http://localhost:8088/api/mbar/product_stats/by_category', {
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
    searchQuery.value = '';
    productResult.value = null;
  }
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

.table-container {
  overflow-x: auto;
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
