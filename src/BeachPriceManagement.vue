<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

// --- STATO ---
const resources = ref([]); // Lista ombrelloni (id, name, row, column)
const pricelists = ref([]); // Listini base normalizzati per UI
const selectedPricelist = ref(null);

// Stato per l'assegnazione massiva
const selectionStart = ref(null);
const selectionEnd = ref(null);

// --- LOGICA BEACH SPECIFICA ---
const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeResource = (res) => {
  const row = toNumber(res.row) ?? toNumber(res.riga) ?? toNumber(res.fila) ?? 0;
  const column = toNumber(res.column) ?? toNumber(res.fila) ?? toNumber(res.riga) ?? 0;
  const sector = res.sector ?? res.zona ?? '';
  const placeType = res.place_type ?? res.placeType ?? (row ? { id: row, description: `FILA ${row}` } : { id: 1, description: 'FILA' });
  const name = res.name ?? res.code ?? `${sector}${row}-${column}`;
  return { ...res, row, column, sector, place_type: placeType, name };
};

const mostCommonValue = (values) => {
  if (values.length === 0) return 0;
  const counts = new Map();
  values.forEach((val) => counts.set(val, (counts.get(val) || 0) + 1));
  let bestVal = values[0];
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestCount = count;
      bestVal = value;
    }
  });
  return bestVal;
};

const buildUiPricelist = (list, normalizedResources) => {
  const pricesById = new Map();
  (list.prices || []).forEach((p) => {
    const price = Number(p.price_per_place);
    pricesById.set(String(p.id), Number.isFinite(price) ? price : 0);
  });

  const rowDefaults = {};
  const customPrices = {};
  const rows = {};

  normalizedResources.forEach((r) => {
    const rowKey = String(r.row ?? 0);
    if (!rows[rowKey]) rows[rowKey] = [];
    rows[rowKey].push(r);
  });

  Object.entries(rows).forEach(([rowKey, items]) => {
    const prices = items.map((r) => {
      const price = pricesById.get(String(r.id));
      return Number.isFinite(price) ? price : 0;
    });
    const defaultPrice = mostCommonValue(prices);
    rowDefaults[rowKey] = defaultPrice;
    items.forEach((r, idx) => {
      if (prices[idx] !== defaultPrice) {
        customPrices[r.id] = prices[idx];
      }
    });
  });

  return {
    id: list.id,
    description: list.description ?? `Listino ${list.id}`,
    startDate: list.startDate ?? '',
    endDate: list.endDate ?? '',
    color: list.color ?? '#cbd5e1',
    rowDefaults,
    customPrices,
    _source: list
  };
};

const buildPmsPayload = (list, normalizedResources) => {
  const prices = normalizedResources.map((r, idx) => {
    const rowKey = String(r.row ?? 0);
    const rowDefault = Number(list.rowDefaults?.[rowKey] ?? 0);
    const override = list.customPrices?.[r.id];
    const price = Number.isFinite(Number(override)) ? Number(override) : (Number.isFinite(rowDefault) ? rowDefault : 0);
    const placeType = r.place_type ?? {};
    const priceId = Number(r.id);
    return {
      id: Number.isFinite(priceId) ? priceId : idx + 1,
      fila: r.column,
      riga: r.row,
      place_type: {
        id: placeType.id ?? r.row ?? 1,
        description: placeType.description ?? `FILA ${r.row}`
      },
      price_per_place: price
    };
  });

  return {
    id: list.id ?? 0,
    color: list.color ?? '#A5D6A7',
    prices
  };
};

// Raggruppiamo le risorse per fila per la visualizzazione nel configuratore
const resourcesByRow = computed(() => {
  const rows = {};
  resources.value.forEach(r => {
    const rowKey = String(r.row ?? 0);
    if (!rows[rowKey]) rows[rowKey] = [];
    rows[rowKey].push(r);
  });
  Object.values(rows).forEach((items) => items.sort((a, b) => (a.column ?? 0) - (b.column ?? 0)));
  return rows;
});

// Caricamento dati
const fetchData = async () => {
  try {
    const [resProd, resPrice] = await Promise.all([
      axios.get('http://localhost:8081/api/pms/beach/getplan?mode=flat'),
      axios.get('http://localhost:8081/api/pms/getrates?type=beach')
    ]);
    const normalizedResources = resProd.data.map(normalizeResource);
    resources.value = normalizedResources;
    pricelists.value = (resPrice.data || []).map((list) => buildUiPricelist(list, normalizedResources));
    if (pricelists.value.length > 0) selectedPricelist.value = pricelists.value[0];
  } catch (err) {
    console.error("Errore caricamento:", err);
  }
};

// Salvataggio prezzi con override per singolo posto
const saveBeachPrices = async (list) => {
  try {
    // Il payload conterrà i prezzi per fila (default) 
    // e gli override per (fila, colonna) specifici
    const payload = buildPmsPayload(list, resources.value);
    await axios.post('http://localhost:8081/api/pms/saverate?type=beach', payload);
    alert("Listino spiaggia aggiornato con successo!");
  } catch (err) {
    alert("Errore nel salvataggio");
  }
};

// Funzione per impostare rapidamente il prezzo a tutta una fila
const setRowPrice = (rowNumber, price) => {
  if (!selectedPricelist.value.rowDefaults) selectedPricelist.value.rowDefaults = {};
  selectedPricelist.value.rowDefaults[rowNumber] = price;
  
  // Opzionale: resetta gli override manuali di quella fila se si vuole resettare
  resources.value.filter(r => String(r.row) === String(rowNumber)).forEach(r => {
    delete selectedPricelist.value.customPrices?.[r.id];
  });
};

onMounted(fetchData);
</script>

<template>
  <div class="config-container">
    <div class="sidebar">
      <h2>Listini Spiaggia</h2>
      <div v-for="price in pricelists" :key="price.id" 
           class="price-card" 
           :class="{ active: selectedPricelist?.id === price.id }"
           @click="selectedPricelist = price">
        <div class="price-card-info">
          <strong>{{ price.description }}</strong>
          <span>{{ price.startDate }} - {{ price.endDate }}</span>
        </div>
      </div>
    </div>

    <div class="main-content">
      <section v-if="selectedPricelist" class="editor-section">
        <div class="editor-header">
          <h3>Configurazione Prezzi: {{ selectedPricelist.description }}</h3>
          <button class="btn-save" @click="saveBeachPrices(selectedPricelist)">Salva Configurazione</button>
        </div>

        <div class="beach-grid-editor">
          <div v-for="(items, row) in resourcesByRow" :key="row" class="row-config">
            <div class="row-header">
              <h4>FILA {{ row }}</h4>
              <div class="default-setter">
                <label>Prezzo Base Fila:</label>
                <input type="number" 
                       v-model.number="selectedPricelist.rowDefaults[row]" 
                       @change="setRowPrice(row, selectedPricelist.rowDefaults[row])"
                       class="input-mini" />
              </div>
            </div>

            <div class="umbrellas-row">
              <div v-for="u in items" :key="u.id" class="umbrella-item">
                <span class="u-label">Col. {{ u.column }}</span>
                <input type="number" 
                       v-model.number="selectedPricelist.customPrices[u.id]" 
                       :placeholder="selectedPricelist.rowDefaults[row]"
                       class="input-u" />
                <small v-if="selectedPricelist.customPrices[u.id]" class="override-tag">Override</small>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.config-container { display: flex; height: 100vh; background: #f1f5f9; }
.sidebar { width: 300px; background: white; border-right: 1px solid #e2e8f0; padding: 20px; }

.price-card { 
  padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 10px; cursor: pointer;
  border-left: 5px solid #cbd5e1;
}
.price-card.active { border-color: #3b82f6; background: #eff6ff; }

.main-content { flex: 1; padding: 30px; overflow-y: auto; }

/* Griglia Spiaggia */
.beach-grid-editor { display: flex; flex-direction: column; gap: 30px; }

.row-config { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

.row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
.default-setter { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }

.umbrellas-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; }

.umbrella-item { 
  display: flex; flex-direction: column; align-items: center; background: #f8fafc; 
  padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;
}
.u-label { font-size: 0.7rem; font-weight: 700; color: #64748b; margin-bottom: 5px; }
.input-u { width: 100%; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem; }
.input-mini { width: 80px; padding: 5px; border-radius: 4px; border: 1px solid #3b82f6; text-align: center; font-weight: 700; }

.override-tag { font-size: 0.6rem; color: #ef4444; font-weight: 800; text-transform: uppercase; margin-top: 4px; }

.btn-save { background: #1e293b; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
</style>
