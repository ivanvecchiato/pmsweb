<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

// Stato per la creazione dei settori
const sectors = ref([
  { id: 1, name: 'Area Centrale', prefix: 'A', rows: 5, cols: 10, startPrice: 50 },
  { id: 2, name: 'Area Laterale', prefix: 'B', rows: 5, cols: 8, startPrice: 40 }
]);

const loading = ref(false);

const addSector = () => {
  const newId = sectors.value.length + 1;
  sectors.value.push({ 
    id: newId, 
    name: `Nuovo Settore ${newId}`, 
    prefix: String.fromCharCode(65 + sectors.value.length), // B, C, D...
    rows: 1, 
    cols: 1, 
    startPrice: 30 
  });
};

const removeSector = (id) => {
  sectors.value = sectors.value.filter(s => s.id !== id);
};

// Funzione core: genera gli oggetti "Ombrellone" basati sulla griglia definita
const generateBeachMap = async () => {
  if (!confirm("Questa operazione rigenererà tutti i posti. I dati esistenti potrebbero essere sovrascritti. Procedere?")) return;
  
  loading.value = true;
  const allResources = [];

  sectors.value.forEach(sector => {
    for (let r = 1; r <= sector.rows; r++) {
      for (let c = 1; c <= sector.cols; c++) {
        allResources.push({
          id: `${sector.prefix}${r}-${c}`, // ID univoco es. A1-5
          name: `${sector.prefix}${r}-${c}`,
          row: r,
          column: c,
          sector: sector.name,
          type: `FILA_${r}`, // La fila agisce come "Tipo Camera" per il listino base
          basePrice: sector.startPrice
        });
      }
    }
  });

  try {
    // Salviamo la configurazione nel database
    await axios.post('http://localhost:8081/api/pms/beach/setup', {
      sectors: sectors.value,
      resources: allResources
    });
    alert(`Successo! Generati ${allResources.length} posti spiaggia.`);
  } catch (err) {
    console.error(err);
    alert("Errore durante la generazione del piano.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="layout-container">
    <header class="layout-header">
      <div>
        <h1>Configurazione Piano Spiaggia</h1>
        <p>Definisci la griglia di ombrelloni per ogni settore del tuo stabilimento.</p>
      </div>
      <button @click="generateBeachMap" class="btn-primary" :disabled="loading">
        {{ loading ? 'Generazione...' : 'Applica e Genera Mappa' }}
      </button>
    </header>

    <div class="sectors-list">
      <div v-for="s in sectors" :key="s.id" class="sector-card">
        <div class="sector-header">
          <input v-model="s.name" class="input-title" />
          <button @click="removeSector(s.id)" class="btn-delete">Elimina</button>
        </div>
        
        <div class="sector-body">
          <div class="field">
            <label>Prefisso ID</label>
            <input v-model="s.prefix" maxlength="2" />
          </div>
          <div class="field">
            <label>N. File (Rows)</label>
            <input type="number" v-model.number="s.rows" />
          </div>
          <div class="field">
            <label>Ombrelloni per fila (Cols)</label>
            <input type="number" v-model.number="s.cols" />
          </div>
          <div class="field">
            <label>Prezzo Base (€)</label>
            <input type="number" v-model.number="s.startPrice" />
          </div>
        </div>

        <div class="sector-footer">
          <span>Totale posti in questo settore: <strong>{{ s.rows * s.cols }}</strong></span>
        </div>
      </div>

      <button @click="addSector" class="btn-add-card">
        + Aggiungi Settore
      </button>
    </div>
  </div>
</template>

<style scoped>
.layout-container { padding: 30px; background: #f8fafc; min-height: 100vh; }
.layout-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }

.sectors-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.sector-card {
  background: white;
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  border: 1px solid #e2e8f0;
}

.sector-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
.input-title { font-size: 1.2rem; font-weight: 700; border: none; border-bottom: 2px solid #3b82f6; outline: none; }

.sector-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.field label { display: block; font-size: 0.75rem; color: #64748b; margin-bottom: 5px; text-transform: uppercase; font-weight: 600; }
.field input { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; }

.btn-primary { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; cursor: pointer; }
.btn-add-card { border: 2px dashed #cbd5e1; background: transparent; border-radius: 15px; color: #64748b; font-weight: 600; cursor: pointer; }
.btn-delete { color: #ef4444; background: transparent; border: none; cursor: pointer; font-size: 0.8rem; }
</style>
