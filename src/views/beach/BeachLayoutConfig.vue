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
    await axios.post('/api/pms/beach/setup', {
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
.layout-container {
  padding: 8px;
  min-height: calc(100vh - 120px);
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  padding: 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.layout-header > div {
  min-width: 0;
}

.layout-header h1,
.layout-header p {
  overflow-wrap: anywhere;
}

.layout-header h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ds-text);
}

.layout-header p {
  margin: 8px 0 0;
  color: var(--ds-text-soft);
}

.sectors-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr));
  gap: 20px;
  width: 100%;
}

.sector-card {
  min-width: 0;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  padding: 20px;
  box-shadow: var(--ds-shadow-card);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(18px);
}

.sector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.input-title {
  min-width: 0;
  width: 100%;
  font-size: 1.2rem;
  font-weight: 800;
  border: 0;
  border-bottom: 2px solid rgba(29, 140, 242, 0.3);
  outline: none;
  background: transparent;
  color: var(--ds-text);
}

.sector-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
  align-items: start;
}

.field {
  min-width: 0;
}

.field label {
  display: block;
  font-size: 0.74rem;
  color: var(--ds-text-soft);
  margin-bottom: 5px;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.field input {
  width: calc(100% - 12px);
  max-width: 180px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
}

.btn-primary {
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  border: 1px solid transparent;
  padding: 12px 24px;
  border-radius: 16px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-add-card {
  min-height: 180px;
  width: 100%;
  border: 2px dashed rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.48);
  border-radius: 24px;
  color: var(--ds-text-soft);
  font-weight: 700;
  cursor: pointer;
}

.btn-delete {
  flex-shrink: 0;
  color: var(--ds-danger);
  background: rgba(220, 77, 77, 0.08);
  border: 1px solid rgba(220, 77, 77, 0.16);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 8px 12px;
  border-radius: 14px;
  font-weight: 700;
}

.sector-footer {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
  color: var(--ds-text-soft);
}

@media (max-width: 900px) {
  .layout-header {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-primary {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .layout-container {
    padding: 0;
  }

  .sector-header {
    flex-direction: column;
    align-items: stretch;
  }

  .sector-body {
    grid-template-columns: 1fr;
  }

  .field input {
    width: 100%;
    max-width: none;
  }

  .btn-delete {
    align-self: flex-end;
  }
}
</style>
