<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

// --- STATO ---
const resources = ref([]); // Lista ombrelloni (id, name, row, column)
const pricelists = ref([]); // Listini base normalizzati per UI
const selectedPricelist = ref(null);
const timetable = ref([]);
const activeView = ref('pricing'); // pricing | assignment

// Stato per l'assegnazione massiva
const selectionStart = ref(null);
const selectionEnd = ref(null);
const isSelecting = ref(false);

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

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDayOfYear = (dateString) => {
  const date = new Date(dateString);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const handleMouseDown = (date) => {
  if (!selectedPricelist.value) return;
  selectionStart.value = date;
  selectionEnd.value = date;
  isSelecting.value = true;
};

const handleMouseEnter = (date) => {
  if (!isSelecting.value) return;
  selectionEnd.value = date;
};

const handleMouseUp = () => {
  isSelecting.value = false;
};

const isInRange = (date) => {
  if (!selectionStart.value || !selectionEnd.value) return false;
  const d = new Date(date);
  const s = new Date(selectionStart.value);
  const e = new Date(selectionEnd.value);
  const [start, end] = s <= e ? [s, e] : [e, s];
  return d >= start && d <= end;
};

const getDayStyle = (day) => {
  const pricelist = pricelists.value.find((p) => String(p.id) === String(day.pricelist));
  const color = pricelist?.color || '#e2e8f0';
  return {
    backgroundColor: pricelist ? `${color}33` : '#ffffff',
    borderColor: color
  };
};

const getDayOfMonth = (dateStr) => new Date(dateStr).getDate();
const getMonthName = (dateStr) => new Date(dateStr).toLocaleDateString('it-IT', { month: 'short' });
const isSunday = (dateStr) => new Date(dateStr).getDay() === 0;

const saveRangeAssignment = async () => {
  if (!selectedPricelist.value || !selectionStart.value || !selectionEnd.value) return;

  const s = new Date(selectionStart.value);
  const e = new Date(selectionEnd.value);
  const [start, end] = s <= e ? [s, e] : [e, s];
  const updates = [];

  let current = new Date(start);
  while (current <= end) {
    const dateStr = toISODate(current);
    updates.push({
      date: dateStr,
      pricelist: selectedPricelist.value.id,
      day: getDayOfYear(dateStr)
    });
    current.setDate(current.getDate() + 1);
  }

  try {
    await axios.post('/api/pms/updatetimetable', { updates });
    updates.forEach((upd) => {
      const idx = timetable.value.findIndex((d) => d.date === upd.date);
      if (idx !== -1) timetable.value[idx].pricelist = upd.pricelist;
    });
    selectionStart.value = null;
    selectionEnd.value = null;
    alert(`Listino applicato a ${updates.length} giorni`);
  } catch (err) {
    console.error('Errore assegnazione range timetable beach:', err);
    alert('Errore nell\'assegnazione range');
  }
};

// Caricamento dati
const fetchData = async () => {
  try {
    const [resProd, resPrice, resTime] = await Promise.all([
      axios.get('/api/pms/beach/getplan?mode=flat'),
      axios.get('/api/pms/getrates?type=beach'),
      axios.get('/api/pms/gettimetable?type=beach')
    ]);
    const normalizedResources = resProd.data.map(normalizeResource);
    resources.value = normalizedResources;
    pricelists.value = (resPrice.data || []).map((list) => buildUiPricelist(list, normalizedResources));
    timetable.value = resTime.data || [];
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
    await axios.post('/api/pms/saverate?type=beach', payload);
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
  <div class="config-container" @mouseup="handleMouseUp">
    <div class="sidebar">
      <h2>Listini Spiaggia</h2>

      <div v-for="price in pricelists" :key="price.id"
           class="price-card" 
           :class="{ active: selectedPricelist?.id === price.id }"
         :style="{ borderLeftColor: price.color || '#cbd5e1' }"
           @click="selectedPricelist = price">
        <div class="price-card-info">
          <strong>{{ price.description }}</strong>
          <span>{{ price.startDate }} - {{ price.endDate }}</span>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="view-switcher">
        <button
          class="switch-btn"
          :class="{ active: activeView === 'pricing' }"
          @click="activeView = 'pricing'"
        >
          Definizione Listini
        </button>
        <button
          class="switch-btn"
          :class="{ active: activeView === 'assignment' }"
          @click="activeView = 'assignment'"
        >
          Assegnazione Range Temporale
        </button>
      </div>

      <section v-if="activeView === 'pricing' && selectedPricelist" class="editor-section">
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

      <div v-if="activeView === 'assignment'" class="assignment-section">
        <div class="assignment-header">
          <h3>Assegna "{{ selectedPricelist?.description || 'Listino' }}" al calendario</h3>
          <p>Trascina sul calendario per selezionare un range di date.</p>
        </div>

        <div v-if="selectionStart && selectionEnd" class="range-actions">
          <p class="selection-info">Range: {{ selectionStart }} / {{ selectionEnd }}</p>
          <button class="btn-save-range" @click="saveRangeAssignment">Applica Listino al Range</button>
          <button class="btn-cancel" @click="selectionStart = null; selectionEnd = null">Annulla</button>
        </div>

        <div class="calendar-grid">
          <div
            v-for="day in timetable"
            :key="day.date"
            class="day-box"
            :class="{ 'in-selection': isInRange(day.date), 'is-sunday': isSunday(day.date) }"
            :style="getDayStyle(day)"
            @mousedown="handleMouseDown(day.date)"
            @mouseenter="handleMouseEnter(day.date)"
          >
            <span class="day-num">{{ getDayOfMonth(day.date) }}</span>
            <small>{{ getMonthName(day.date) }}</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-container {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  gap: 24px;
  padding: 8px;
  min-height: calc(100vh - 120px);
}

.sidebar,
.assignment-section,
.row-config {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.sidebar {
  width: auto;
  padding: 24px;
  border-radius: 28px;
  align-self: start;
  position: sticky;
  top: 24px;
}

.sidebar h2 {
  margin: 0 0 18px;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ds-text);
}

.price-card { 
  padding: 15px; border-radius: 20px; border: 1px solid rgba(148, 163, 184, 0.18); margin-bottom: 10px; cursor: pointer;
  border-left: 5px solid #cbd5e1;
  background: rgba(248, 250, 252, 0.88);
  transition: transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.price-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
}

.price-card.active { border-color: rgba(29, 140, 242, 0.22); background: rgba(231, 242, 255, 0.92); }

.price-card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.price-card-info strong {
  color: var(--ds-text);
}

.price-card-info span {
  color: var(--ds-text-soft);
  font-size: 0.84rem;
}

.range-actions {
  margin-top: 16px;
  padding: 16px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 20px;
}

.selection-info {
  font-size: 0.75rem;
  color: var(--ds-text-soft);
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 800;
}

.btn-save-range {
  width: 100%;
  margin-bottom: 8px;
  border: 1px solid transparent;
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  border-radius: 16px;
  padding: 11px 14px;
  cursor: pointer;
  font-weight: 700;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-cancel {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-text);
  border-radius: 16px;
  padding: 11px 14px;
  cursor: pointer;
  font-weight: 700;
}

.main-content { flex: 1; padding: 8px 0 8px 0; overflow-y: auto; min-width: 0; }

.view-switcher {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  padding: 4px;
  width: fit-content;
  max-width: 100%;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
}

.switch-btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--ds-text-soft);
  border-radius: 14px;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 700;
}

.switch-btn.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.9));
  border-color: rgba(29, 140, 242, 0.18);
  color: var(--ds-primary-strong);
  box-shadow: 0 12px 24px rgba(29, 140, 242, 0.12);
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.editor-header h3,
.assignment-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--ds-text);
}

/* Griglia Spiaggia */
.beach-grid-editor { display: flex; flex-direction: column; gap: 30px; }

.row-config { border-radius: 24px; padding: 20px; }

.row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid rgba(148, 163, 184, 0.16); padding-bottom: 10px; gap: 12px; }
.row-header h4 { margin: 0; color: var(--ds-text); font-size: 1rem; font-weight: 800; }
.default-setter { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: var(--ds-text-soft); }

.umbrellas-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; }

.umbrella-item { 
  display: flex; flex-direction: column; align-items: center; background: rgba(248, 250, 252, 0.86); 
  padding: 10px; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.16);
}
.u-label { font-size: 0.7rem; font-weight: 800; color: var(--ds-text-soft); margin-bottom: 5px; text-transform: uppercase; }
.input-u, .input-mini {
  width: 100%;
  min-height: 38px;
  text-align: center;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
}
.input-mini { width: 88px; font-weight: 700; }

.override-tag { font-size: 0.6rem; color: #ef4444; font-weight: 800; text-transform: uppercase; margin-top: 4px; }

.btn-save { background: linear-gradient(180deg, #22c55e, #16a34a); color: white; border: 1px solid transparent; padding: 12px 18px; border-radius: 16px; cursor: pointer; font-weight: 700; box-shadow: 0 18px 28px rgba(34, 197, 94, 0.18); }

.assignment-section {
  border-radius: 28px;
  padding: 16px;
}

.assignment-header h3 {
  margin: 0 0 4px;
}

.assignment-header p {
  margin: 0 0 12px;
  color: var(--ds-text-soft);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 6px;
  max-height: 440px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
}

.day-box {
  height: 60px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  user-select: none;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  color: var(--ds-text-soft);
}

.day-num {
  font-weight: 800;
  font-size: 14px;
  color: var(--ds-text);
}

.in-selection {
  transform: scale(0.95);
  box-shadow: inset 0 0 0 3px rgba(29, 140, 242, 0.55);
}

.day-box.is-sunday {
  background-color: #fff1f2;
  border-color: #fecaca;
}

.day-box.is-sunday .day-num {
  color: #e11d48;
}

.day-box.is-sunday small {
  color: #fb7185;
}

@media (max-width: 1080px) {
  .config-container {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
  }
}

@media (max-width: 720px) {
  .view-switcher,
  .row-header,
  .editor-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
