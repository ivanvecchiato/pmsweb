<template>
  <div class="config-container" @mouseup="handleMouseUp">
    <div class="sidebar">
      <h2>Listini</h2>
      <div v-for="price in pricelists" :key="price.id" 
       class="price-card" 
       :class="{ active: selectedPricelist?.id === price.id }"
       :style="{ borderLeftColor: price.color }"
       @click="selectedPricelist = price">
        
        <div class="price-card-info">
          <strong>{{ price.description }}</strong>
          <span class="base-price-badge">Base: €{{ price.basePrice || 0 }}</span>
        </div>
      </div>
      
      <div v-if="selectionStart && selectionEnd" class="range-actions">
        <p class="selection-info">Range: {{ selectionStart }} / {{ selectionEnd }}</p>
        <button class="btn btn-save-range" @click="saveRangeAssignment">
          Applica Listino al Range
        </button>
        <button class="btn btn-cancel" @click="selectionStart = null">Annulla</button>
      </div>
    </div>

    <div class="main-content">
      
      <section v-if="selectedPricelist" class="editor-section">
        <div class="editor-header">
          <div class="header-titles">
            <h3>{{ selectedPricelist.description }}</h3>
            <span class="id-badge">ID: {{ selectedPricelist.id }}</span>
          </div>
          <button class="btn-glyph-save" @click="savePrices(selectedPricelist)" title="Salva modifiche">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Salva
          </button>
        </div>

        <div class="price-grid">
          <div v-for="rate in selectedPricelist.prices" :key="rate.roomType" class="rate-input-group">
            <label>{{ rate.roomType }}</label>
            <div class="input-wrapper">
              <span class="currency">€</span>
              <input type="number" v-model.number="rate.tariffa" step="0.01">
            </div>
          </div>
        </div>

        <div class="surcharges-container-compact">
          <div class="surcharge-box">
            <label>HB</label>
            <div class="input-wrapper hb-border">
              <span class="currency">€</span>
              <input type="number" v-model.number="selectedPricelist.surcharges.hb">
            </div>
          </div>
          <div class="surcharge-box">
            <label>FB</label>
            <div class="input-wrapper fb-border">
              <span class="currency">€</span>
              <input type="number" v-model.number="selectedPricelist.surcharges.fb">
            </div>
          </div>
        </div>
      </section>

      <div class="calendar-grid">
        <div v-for="day in timetable" :key="day.date" 
            class="day-box" 
            :class="{ 
              'in-selection': isInRange(day.date),
              'is-sunday': isSunday(day.date) 
            }"
            :style="getDayStyle(day)"
            @mousedown="handleMouseDown(day.date)"
            @mouseenter="handleMouseEnter(day.date)">
          <span class="day-num">{{ getDayOfMonth(day.date) }}</span>
          <small>{{ getMonthName(day.date) }}</small>
        </div>
      </div>
    </div>
    <Transition name="toast">
      <div v-if="toast.show" class="toast-notification" :class="toast.type">
        <div class="toast-content">
          <svg v-if="toast.type === 'success'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ toast.message }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const pricelists = ref([]); 
const timetable = ref([]);   
const selectedPricelist = ref(null);

// Stati per la selezione range
const selectionStart = ref(null);
const selectionEnd = ref(null);
const isSelecting = ref(false);

const toast = ref({
  show: false,
  message: '',
  type: 'success' // può essere 'success' o 'error'
});

const showToast = (msg, type = 'success') => {
  toast.value.message = msg;
  toast.value.type = type;
  toast.value.show = true;
  
  // Scompare automaticamente dopo 3 secondi
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

const isCreating = ref(false);

const startNewPricelist = () => {
  isCreating.value = true;
  // Creiamo un oggetto con la struttura richiesta dal tuo pricesDB.json
  selectedPricelist.value = {
    id: Date.now(), // ID temporaneo, il backend genererà quello definitivo
    description: '',
    color: '#3b82f6',
    basePrice: 0,
    prices: [
      { roomType: 'FM', tariffa: 0 },
      { roomType: 'JSFM', tariffa: 0 },
      { roomType: 'SNG', tariffa: 0 },
      // ... aggiungi qui tutti i tuoi tipi camera standard
    ],
    surcharges: { hb: 0, fb: 0 }
  };
};

const savePrices = async (pricelist) => {
  try {
    const endpoint = 'http://localhost:8081/api/pms/saverate';

    await axios.post(endpoint, pricelist);
    
    if (isCreating.value) {
      pricelists.value.push({ ...pricelist });
      isCreating.value = false;
    }
    
    showToast(isCreating.value ? "Nuovo listino creato!" : "Listino aggiornato!");
  } catch (err) {
    showToast("Errore durante il salvataggio", "error");
  }
};

const isSunday = (dateStr) => {
  const date = new Date(dateStr);
  return date.getDay() === 0; // 0 rappresenta la domenica in JavaScript
};

const handleMouseDown = (date) => {
  if (!selectedPricelist.value) return;
  selectionStart.value = date;
  selectionEnd.value = date;
  isSelecting.value = true;
};

const handleMouseEnter = (date) => {
  if (isSelecting.value) {
    selectionEnd.value = date;
  }
};

const handleMouseUp = () => {
  isSelecting.value = false;
};

// Calcola se un giorno è nel range selezionato
const isInRange = (date) => {
  if (!selectionStart.value || !selectionEnd.value) return false;
  const d = new Date(date);
  const s = new Date(selectionStart.value);
  const e = new Date(selectionEnd.value);
  const [start, end] = s < e ? [s, e] : [e, s];
  return d >= start && d <= end;
};

const getDayOfYear = (dateString) => {
  const date = new Date(dateString);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

const saveRangeAssignment = async () => {
  if (!selectedPricelist.value || !selectionStart.value || !selectionEnd.value) return;

  const start = new Date(selectionStart.value);
  const end = new Date(selectionEnd.value);
  const updates = [];

  let current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    
    updates.push({
      date: dateStr,
      pricelist: selectedPricelist.value.id,
      // Aggiunta del progressivo annuale
      day: getDayOfYear(dateStr) 
    });

    current.setDate(current.getDate() + 1);
  }

  try {
    // Invio al backend (es. updateBulkTimetable)
    await axios.post('http://localhost:8081/api/pms/updatetimetable', { updates });
    
    // Aggiorna localmente il timetable per vedere subito il cambio colore
    updates.forEach(upd => {
      const dayIdx = timetable.value.findIndex(t => t.date === upd.date);
      if (dayIdx !== -1) timetable.value[dayIdx].pricelist = upd.pricelist;
    });

    showToast(`Listino applicato a ${updates.length} giorni`);
    selectionStart.value = null;
    selectionEnd.value = null;
  } catch (err) {
    showToast("Errore nell'assegnazione range", "error");
  }
};

// Caricamento dati
const loadData = async () => {
  try {
    const resPrices = await axios.get('http://localhost:8081/api/pms/getrates');
    const resTime = await axios.get('http://localhost:8081/api/pms/gettimetable');
    pricelists.value = resPrices.data;
    timetable.value = resTime.data;
  } catch (e) {
    console.error("Errore caricamento dati configurazione", e);
  }
};

// Assegnazione listino al giorno
const assignPricelist = (day) => {
  if (!selectedPricelist.value) return;
  day.pricelist = selectedPricelist.value.id;
  // Qui andrebbe la chiamata axios.post per aggiornare il singolo giorno nel DB
};

const getDayStyle = (day) => {
  const listino = pricelists.value.find(p => p.id === day.pricelist);
  return {
    backgroundColor: listino ? listino.color + '44' : '#fff',
    borderColor: listino ? listino.color : '#ddd'
  };
};

const getDayOfMonth = (dateStr) => new Date(dateStr).getDate();
const getMonthName = (dateStr) => new Date(dateStr).toLocaleDateString('it-IT', { month: 'short' });

onMounted(loadData);
</script>

<style scoped>
.config-container { display: flex; gap: 20px; padding: 20px; background: #f4f7f6; min-height: 100vh; }
.sidebar { width: 300px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.price-card { padding: 10px; border-left: 5px solid #ccc; background: #f9f9f9; margin-bottom: 10px; cursor: pointer; transition: 0.2s; }
.price-card:hover { background: #eee; }
.color-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }

.main-content { flex: 1; display: flex; flex-direction: column; gap: 20px; }
.editor-section, .calendar-section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

.price-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px; margin: 20px 0; }
.rate-input { display: flex; flex-direction: column; font-size: 12px; }
.rate-input input { padding: 5px; border: 1px solid #ddd; border-radius: 4px; }

.calendar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 5px; max-height: 500px; overflow-y: auto; padding: 10px; border: 1px solid #eee; }
.day-box { height: 60px; border: 1px solid #ddd; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; }
.day-num { font-weight: bold; font-size: 14px; }

.btn { padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-primary { background: #3b82f6; color: white; width: 100%; }
.btn-save { background: #10b981; color: white; }
.day-box {
  user-select: none; /* Impedisce la selezione del testo durante il drag */
  transition: transform 0.1s;
}

.in-selection {
  transform: scale(0.95);
  box-shadow: inset 0 0 0 3px #3b82f6 !important;
  z-index: 5;
}

.price-card.active {
  background: #eff6ff;
  box-shadow: 0 0 0 2px #3b82f6;
}

.range-actions {
  margin-top: 2rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}

.btn-save-range {
  background: #2563eb;
  color: white;
  width: 100%;
  margin-bottom: 0.5rem;
}

.selection-info {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 1rem;
}
.price-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  /* ... altri stili esistenti ... */
}

.price-card-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.base-price-badge {
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.day-box.is-sunday {
  background-color: #fff1f2; /* Un rosso chiarissimo di sfondo */
  border-color: #fecaca;    /* Bordo rosato */
}

.day-box.is-sunday .day-num {
  color: #e11d48; /* Numero del giorno in rosso */
}

.day-box.is-sunday small {
  color: #fb7185; /* Nome del mese in rosso chiaro */
}
.editor-section {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  border: 1px solid #e5e7eb;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f3f4f6;
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.rate-input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rate-input-group label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #4b5563;
  text-transform: uppercase;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency {
  position: absolute;
  left: 10px;
  color: #9ca3af;
  font-size: 0.9rem;
}

.input-wrapper input {
  width: 100%;
  padding: 8px 8px 8px 25px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-weight: 600;
  color: #111827;
}

.input-wrapper input:focus {
  border-color: #3b82f6;
  outline: none;
  ring: 2px #bfdbfe;
}

.surcharges-row {
  background: #f9fafb;
  padding: 15px;
  border-radius: 8px;
}

.surcharges-grid {
  display: flex;
  gap: 30px;
  margin-top: 10px;
}
/* Header e Titoli */
.header-titles {
  display: flex;
  align-items: center;
  gap: 12px;
}

.id-badge {
  font-size: 10px;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #64748b;
}

/* Bottone Glyph */
.btn-glyph-save {
  background: #10b981;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
}

.btn-glyph-save:hover {
  background: #059669;
  transform: translateY(-1px);
}

/* Supplementi rimpiccioliti */
.surcharges-container-compact {
  display: flex;
  gap: 15px;
  padding-top: 20px;
  border-top: 1px solid #f1f5f9;
  max-width: 300px; /* Impedisce la tutta larghezza */
}

.surcharge-box {
  flex: 1;
}

.surcharge-box label {
  font-size: 11px;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 4px;
  display: block;
}

/* Bordi colorati per i trattamenti */
.hb-border { border-bottom: 3px solid #fbbf24; }
.fb-border { border-bottom: 3px solid #ef4444; }

.input-wrapper input {
  border: 1px solid #e2e8f0;
  padding: 8px 8px 8px 22px;
  font-size: 14px;
  width: 100%;
  border-radius: 6px;
}
</style>