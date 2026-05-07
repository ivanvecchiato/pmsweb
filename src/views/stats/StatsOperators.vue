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
            <span class="name-pill" :style="selectedOperator.pillStyle">
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
              <span class="name-pill" :style="o.pillStyle">{{ o.name }}</span>
            </div>
            <div class="card-metrics">
              <span class="metric-euro">{{ formatEuro(o.sales) }}</span>
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

const hexToRgb = (hex) => {
  const normalized = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
};

const rgbToHex = ({ r, g, b }) => {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixWithWhite = (hex, factor) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex({
    r: rgb.r + (255 - rgb.r) * factor,
    g: rgb.g + (255 - rgb.g) * factor,
    b: rgb.b + (255 - rgb.b) * factor
  });
};

const getPillStyle = (baseColor) => {
  return {
    backgroundColor: mixWithWhite(baseColor, 0.78),
    borderColor: mixWithWhite(baseColor, 0.58),
    color: mixWithWhite(baseColor, 0.12)
  };
};

const formatEuro = (value) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(toNumber(value));
};

const extractSales = (item) => {
  return toNumber(item?.sales ?? item?.totalSales ?? item?.amount ?? item?.incasso ?? 0);
};

const topOperators = computed(() => {
  const list = Array.isArray(stats.value?.top20) ? stats.value.top20 : [];
  return list.map((o, idx) => {
    const name = o?.name || o?.operator || o?.operatorName || `Operatore ${idx + 1}`;
    return {
      ...o,
      name,
      sales: extractSales(o),
      color: resolveColor(o, name, idx),
      pillStyle: getPillStyle(resolveColor(o, name, idx))
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
      color: hashColor(fallbackName),
      pillStyle: getPillStyle(hashColor(fallbackName))
    };
  }

  if (typeof source === 'object') {
    const name = source.name || source.operator || source.operatorName || searchQuery.value || 'Operatore selezionato';
    return {
      name,
      sales: extractSales(source),
      color: resolveColor(source, name),
      pillStyle: getPillStyle(resolveColor(source, name))
    };
  }

  const fallbackName = searchQuery.value || 'Operatore selezionato';
  return {
    name: fallbackName,
    sales: toNumber(source),
    color: hashColor(fallbackName),
    pillStyle: getPillStyle(hashColor(fallbackName))
  };
});

const fetchStats = async () => {
  loading.value = true;
  error.value = '';
  stats.value = null;
  try {
    const res = await axios.get('/api/mbar/operator_stats', {
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
  padding: 8px;
  min-height: calc(100vh - 120px);
}

h1 {
  margin: 0 0 20px;
  color: var(--ds-text);
  font-size: clamp(1.8rem, 2vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.04em;
}

h3 {
  margin: 0 0 12px;
  color: var(--ds-text);
  font-size: 1.05rem;
  font-weight: 800;
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.controls input {
  min-width: 170px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
}

.loading {
  margin-top: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ds-text-soft);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.error {
  color: var(--ds-danger);
  margin-top: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(220, 77, 77, 0.08);
  border: 1px solid rgba(220, 77, 77, 0.16);
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  border: 1px solid transparent;
  padding: 11px 16px;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(239, 248, 255, 0.84));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  padding: 18px 20px;
  margin-bottom: 16px;
  box-shadow: var(--ds-shadow-card);
}

.summary-label {
  color: var(--ds-text-soft);
  font-size: 0.85rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.summary-value {
  color: #047857;
  font-weight: 800;
  font-size: 1.25rem;
}

.section-container {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
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
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 18px;
  padding: 12px 14px;
  background: rgba(248, 250, 252, 0.86);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.result-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(15, 23, 42, 0.08);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rank-pill {
  background: linear-gradient(180deg, #1e293b, #0f172a);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
}

.name-pill {
  color: #334155;
  border: 1px solid transparent;
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
  padding: 6px 12px;
  font-weight: 800;
  font-size: 0.86rem;
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
