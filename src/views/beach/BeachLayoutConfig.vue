<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const sectors = ref([]);
const savedZones = ref([]);
const loading = ref(false);
const error = ref('');

const loadZones = async () => {
  try {
    const response = await axios.get('/api/pms/beach/getplan?mode=zones');
    savedZones.value = response.data;
    sectors.value = savedZones.value.map(zone => ({
      id: zone.id,
      name: zone.name,
      prefix: zone.code,
      rows: zone.rows.length,
      cols: zone.rows[0]?.places.length || 0,
      rowTypes: zone.rows.map(row => ({ ...row.place_type })),
      placeOverrides: Object.fromEntries(zone.rows.flatMap((row, rowIndex) =>
        row.places.flatMap((place, columnIndex) => place?.place_type
          ? [[`${rowIndex}:${columnIndex}`, place.place_type.id]] : [])))
    }));
  } catch (cause) {
    error.value = cause.message || 'Errore nel caricamento delle zone';
  }
};

onMounted(loadZones);

const addSector = () => {
  const newId = Math.max(0, ...sectors.value.map(sector => sector.id)) + 1;
  sectors.value.push({ 
    id: newId, 
    name: `Nuovo Settore ${newId}`, 
    prefix: String.fromCharCode(65 + sectors.value.length), // B, C, D...
    rows: 1, 
    cols: 1,
    rowTypes: [{ id: 1, description: 'FILA 1', label: 'F1', color: '#E3F2FD' }],
    placeOverrides: {}
  });
};

const removeSector = (id) => {
  sectors.value = sectors.value.filter(s => s.id !== id);
};

const syncRows = (sector) => {
  while (sector.rowTypes.length < sector.rows) {
    const number = sector.rowTypes.length + 1;
    sector.rowTypes.push({ id: number, description: `FILA ${number}`, label: `F${number}`, color: '#E3F2FD' });
  }
};

const generateBeachMap = async () => {
  if (!confirm('Applicare la nuova struttura del piano spiaggia? I posti rimossi non saranno recuperabili.')) return;
  error.value = '';
  loading.value = true;
  try {
    const zones = sectors.value.map(sector => {
      const existing = savedZones.value.find(zone => zone.id === sector.id);
      return {
        id: sector.id,
        name: sector.name.trim(),
        code: sector.prefix.trim(),
        rows: Array.from({ length: sector.rows }, (_, rowIndex) => ({
          place_type: sector.rowTypes[rowIndex],
          places: Array.from({ length: sector.cols }, (_, columnIndex) => {
            const place = { ...(existing?.rows[rowIndex]?.places[columnIndex] || {}) };
            const overrideId = Number(sector.placeOverrides[`${rowIndex}:${columnIndex}`]);
            const override = sector.rowTypes.find(type => type.id === overrideId);
            if (override && override.id !== sector.rowTypes[rowIndex].id) place.place_type = override;
            else delete place.place_type;
            return place;
          })
        }))
      };
    });
    const response = await axios.post('/api/pms/beach/setup', { zones });
    if (response.data?.queued) {
      error.value = 'Modifica accodata su Firebase: il server attuale non applica ancora le mutazioni remote.';
      return;
    }
    await loadZones();
    alert('Piano spiaggia aggiornato.');
  } catch (cause) {
    error.value = cause.response?.data?.error || cause.message || 'Errore nel salvataggio del piano';
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
        {{ loading ? 'Salvataggio...' : 'Salva piano' }}
      </button>
    </header>

    <p v-if="error" role="alert">{{ error }}</p>

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
            <input type="number" min="1" v-model.number="s.rows" @input="syncRows(s)" />
          </div>
          <div class="field">
            <label>Ombrelloni per fila (Cols)</label>
            <input type="number" min="1" v-model.number="s.cols" />
          </div>
        </div>

        <div v-for="rowIndex in s.rows" :key="rowIndex" class="row-type-editor">
          <strong>Fila {{ rowIndex }}</strong>
          <label>Tipo</label>
          <input type="number" min="1" v-model.number="s.rowTypes[rowIndex - 1].id" />
          <label>Descrizione</label>
          <input v-model="s.rowTypes[rowIndex - 1].description" />
          <div class="place-overrides">
            <label v-for="columnIndex in s.cols" :key="columnIndex">
              Posto {{ columnIndex }} · tipo
              <select v-model.number="s.placeOverrides[`${rowIndex - 1}:${columnIndex - 1}`]">
                <option value="">Della fila</option>
                <option v-for="type in s.rowTypes.slice(0, s.rows)" :key="type.id" :value="type.id">{{ type.description }}</option>
              </select>
            </label>
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
.row-type-editor { margin: 12px 0; padding: 14px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.row-type-editor input { max-width: 170px; }
.place-overrides { display: flex; flex-wrap: wrap; gap: 10px; width: 100%; }
.place-overrides label { display: flex; align-items: center; gap: 6px; font-size: .85rem; }
.place-overrides select { padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
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
