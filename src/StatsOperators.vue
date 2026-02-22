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
      <h2>Totale vendite: {{ stats.totalSales }}</h2>

      <section v-if="stats.operatorSales">
        <h3>Vendite operatore selezionato</h3>
        <p>{{ stats.operatorSales }}</p>
      </section>

      <section v-if="stats.top20 && stats.top20.length">
        <h3>Top 20 operatori</h3>
        <ol>
          <li v-for="o in stats.top20" :key="o.id">
            {{ o.name }} - {{ o.sales }}
          </li>
        </ol>
      </section>

      <section v-if="stats.byCategory && stats.byCategory.length">
        <h3>Vendite per categoria</h3>
        <ul>
          <li v-for="c in stats.byCategory" :key="c.category">
            {{ c.category }}: {{ c.sales }}
          </li>
        </ul>
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
.stats-operators { padding: 20px; }
.controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.loading { margin-top: 10px; }
.error { color: #ef4444; margin-top: 10px; }
.btn-primary { background: #3b82f6; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; }
</style>
