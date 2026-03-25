<template>
  <div class="stats-operators">
    <h1>Statistiche Operatori</h1>

    <div class="controls">
      <input v-model="searchQuery" placeholder="Nome operatore" />
      <input type="date" v-model="fromDate" />
      <input type="date" v-model="toDate" />
      <button @click="fetchStats" class="btn btn-primary">Ricerca</button>
    </div>

    <div v-if="loading" class="loading">Caricamento...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="stats">
      <div class="summary-card">
        <span class="summary-label">Totale vendite</span>
        <span class="summary-value">{{ formatEuro(stats.totalSales || 0) }}</span>
      </div>

      <section v-if="selectedOperator" class="section-container">
        <h3>Vendite operatore selezionato</h3>
        <article class="result-card">
          <div class="card-main">
            <span class="name-pill" :style="{ backgroundColor: selectedOperator.color }">
              {{ selectedOperator.name }}
            </span>
          </div>
          <div class="card-metrics">
            <span class="metric-euro">{{ formatEuro(selectedOperator.sales) }}</span>
          </div>
        </article>
      </section>

      <section v-if="topOperators.length" class="section-container">
        <h3>Top 20 operatori</h3>
        <div class="cards-list">
          <article v-for="(o, idx) in topOperators" :key="o.id || `${o.name}-${idx}`" class="result-card">
            <div class="card-main">
              <span class="rank-pill">#{{ idx + 1 }}</span>
              <span class="name-pill" :style="{ backgroundColor: o.color }">{{ o.name }}</span>
            </div>
            <div class="card-metrics">
              <span class="metric-euro">{{ formatEuro(o.sales) }}</span>
            </div>
          </article>
        </div>
      </section>

      <section v-if="categories.length" class="section-container">
        <h3>Vendite per categoria</h3>
        <div class="cards-list">
          <article v-for="(c, idx) in categories" :key="`${c.name}-${idx}`" class="result-card">
            <div class="card-main">
              <span class="name-pill" :style="{ backgroundColor: c.color }">{{ c.name }}</span>
            </div>
            <div class="card-metrics">
              <span class="metric-qty">{{ formatQuantity(c.quantity) }}</span>
              <span class="metric-euro">{{ formatEuro(c.sales) }}</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

const searchQuery = ref('');
const fromDate = ref('');
const toDate = ref('');
const loading = ref(false);
const error = ref('');
const stats = ref(null);

const colorPalette = ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#e11d48', '#22c55e'];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const hashColor = (seed, offset = 0) => {
  const str = String(seed || 'unknown');
  let acc = 0;
  for (let i = 0; i < str.length; i++) acc += str.charCodeAt(i);
  return colorPalette[(acc + offset) % colorPalette.length];
};

const resolveColor = (item, fallbackSeed, idx = 0) => {
  return item?.color || item?.hex || item?.operatorColor || item?.categoryColor || hashColor(fallbackSeed, idx);
};

const formatEuro = (value) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(toNumber(value));
};

const formatQuantity = (value) => {
  return `${toNumber(value)} pz`;
};

const extractSales = (item) => {
  return toNumber(item?.sales ?? item?.totalSales ?? item?.amount ?? item?.incasso ?? 0);
};

const extractQuantity = (item) => {
  return toNumber(item?.quantity ?? item?.qty ?? item?.pieces ?? item?.items ?? 0);
};

const topOperators = computed(() => {
  const list = Array.isArray(stats.value?.top20) ? stats.value.top20 : [];
  return list.map((o, idx) => {
    const name = o?.name || o?.operator || o?.operatorName || `Operatore ${idx + 1}`;
    return {
      ...o,
      name,
      sales: extractSales(o),
      color: resolveColor(o, name, idx)
    };
  });
});

const categories = computed(() => {
  const list = Array.isArray(stats.value?.byCategory) ? stats.value.byCategory : [];
  return list.map((c, idx) => {
    const name = c?.category || c?.name || `Categoria ${idx + 1}`;
    return {
      ...c,
      name,
      sales: extractSales(c),
      quantity: extractQuantity(c),
      color: resolveColor(c, name, idx)
    };
  });
});

const selectedOperator = computed(() => {
  const source = stats.value?.operatorSales;
  if (!source) return null;

  if (typeof source === 'number') {
    const fallbackName = searchQuery.value || 'Operatore selezionato';
    return {
      name: fallbackName,
      sales: source,
      color: hashColor(fallbackName)
    };
  }

  if (typeof source === 'object') {
    const name = source.name || source.operator || source.operatorName || searchQuery.value || 'Operatore selezionato';
    return {
      name,
      sales: extractSales(source),
      color: resolveColor(source, name)
    };
  }

  const fallbackName = searchQuery.value || 'Operatore selezionato';
  return {
    name: fallbackName,
    sales: toNumber(source),
    color: hashColor(fallbackName)
  };
});

const fetchStats = async () => {
  loading.value = true;
  error.value = '';
  stats.value = null;
  try {
    const res = await axios.get('http://localhost:8088/api/mbar/operator_stats', {
      params: {
        query: searchQuery.value,
        from: fromDate.value,
        to: toDate.value
      }
    });
    stats.value = res.data;
  } catch (err) {
    console.error('Errore fetch stats operatori', err);
    error.value = 'Impossibile caricare le statistiche';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.stats-operators {
  padding: 24px;
  min-height: 100vh;
  background: #f8fafc;
}

h1 {
  margin: 0 0 20px;
  color: #0f172a;
}

h3 {
  margin: 0 0 12px;
  color: #1e293b;
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 20px;
  padding: 14px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.controls input {
  min-width: 170px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}

.loading {
  margin-top: 10px;
}

.error {
  color: #ef4444;
  margin-top: 10px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.summary-label {
  color: #64748b;
  font-size: 0.85rem;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.summary-value {
  color: #047857;
  font-weight: 800;
  font-size: 1.15rem;
}

.section-container {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.cards-list {
  display: grid;
  gap: 10px;
}

.result-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  background: #f8fafc;
}

.card-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rank-pill {
  background: #0f172a;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
}

.name-pill {
  color: white;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 999px;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-euro {
  background: #dcfce7;
  color: #047857;
  border: 1px solid #86efac;
  border-radius: 999px;
  padding: 5px 10px;
  font-weight: 800;
  font-size: 0.86rem;
}

.metric-qty {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #93c5fd;
  border-radius: 999px;
  padding: 5px 10px;
  font-weight: 700;
  font-size: 0.82rem;
}

@media (max-width: 680px) {
  .controls input {
    min-width: 0;
    width: 100%;
  }

  .btn-primary {
    width: 100%;
  }

  .result-card {
    align-items: flex-start;
  }
}
</style>
