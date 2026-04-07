<template>
  <div class="stats-products">
    <h1>Statistiche Prodotti</h1>

    <div class="controls">
      <input v-model="searchQuery" placeholder="Nome prodotto" />
      <input type="date" v-model="fromDate" />
      <input type="date" v-model="toDate" />
      <button @click="fetchStats" class="btn btn-primary">Ricerca</button>
    </div>

    <div v-if="loading" class="loading">Caricamento...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="stats">
      <div class="stats-summary">
        <div class="summary-card">
          <div class="summary-label">Totale Fatturato</div>
          <div class="summary-value">€ {{ stats.totalSales.toFixed(2) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Quantità Totale</div>
          <div class="summary-value">{{ stats.totalQuantity }} pezzi</div>
        </div>
      </div>

      <section v-if="stats.productSales" class="section-container">
        <h3>Prodotto Selezionato</h3>
        <div class="product-detail-card">
          <div class="detail-info">
            <p class="product-name">{{ stats.productSales.name }}</p>
            <div class="detail-row">
              <span class="detail-label">Quantità:</span>
              <span class="detail-value">{{ stats.productSales.quantity }} pezzi</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fatturato:</span>
              <span class="detail-value-highlight">€ {{ stats.productSales.sales.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="stats.top20 && stats.top20.length" class="section-container">
        <h3>Top 20 Prodotti</h3>
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
              <tr v-for="(p, idx) in stats.top20" :key="p.id" :class="['data-row', idx % 2 === 0 ? 'even' : 'odd']">
                <td class="product-cell">
                  <span class="rank-badge">{{ idx + 1 }}</span>
                  {{ p.name }}
                </td>
                <td class="numeric-cell">{{ p.quantity }}</td>
                <td class="numeric-cell numeric-highlight">€ {{ p.sales.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="stats.byCategory && stats.byCategory.length" class="section-container">
        <h3>Vendite per Categoria</h3>
        <div class="category-list">
          <div v-for="c in stats.byCategory" :key="c.category" class="category-item" @click="selectCategory(c.category)">
            <div class="category-name">{{ c.category }}</div>
            <div class="category-stats">
              <span class="stat-badge">{{ c.quantity || 0 }} pezzi</span>
              <span class="stat-value">€ {{ c.sales.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="selectedCategory && categoryProducts && categoryProducts.length" class="section-container category-detail">
        <h3>Prodotti in "{{ selectedCategory }}"</h3>
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
                <td class="numeric-cell numeric-highlight">€ {{ p.sales.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const searchQuery = ref('');
const fromDate = ref('');
const toDate = ref('');
const loading = ref(false);
const error = ref('');
const stats = ref(null);
const selectedCategory = ref(null);
const categoryProducts = ref([]);

const fetchStats = async () => {
  loading.value = true;
  error.value = '';
  stats.value = null;
  selectedCategory.value = null;
  categoryProducts.value = [];
  try {
    // endpoint generico restituisce oggetto con le sezioni richieste
    // API server runs on port 8088
    const res = await axios.get('http://localhost:8088/api/mbar/product_stats', {
      params: {
        query: searchQuery.value,
        from: fromDate.value,
        to: toDate.value
      }
    });
    stats.value = res.data;
  } catch (err) {
    console.error('Errore fetch stats prodotti', err);
    error.value = 'Impossibile caricare le statistiche';
  } finally {
    loading.value = false;
  }
};

const selectCategory = async (categoryName) => {
  selectedCategory.value = categoryName;
  // fetch products for this category with current filters
  try {
    const res = await axios.get('http://localhost:8088/api/mbar/product_stats/by_category', {
      params: {
        category: categoryName,
        from: fromDate.value,
        to: toDate.value
      }
    });
    categoryProducts.value = res.data.products || [];
  } catch (err) {
    console.error('Errore fetch prodotti per categoria', err);
    categoryProducts.value = [];
  }
};
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

.controls input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  flex: 1;
  min-width: 150px;
}

.controls input:focus {
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
