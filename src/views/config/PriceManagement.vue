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
    const endpoint = '/api/pms/saverate';

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

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const saveRangeAssignment = async () => {
  if (!selectedPricelist.value || !selectionStart.value || !selectionEnd.value) return;

  const start = new Date(selectionStart.value);
  const end = new Date(selectionEnd.value);
  const updates = [];

  let current = new Date(start);
  while (current <= end) {
    const dateStr = toISODate(current);
    
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
    await axios.post('/api/pms/updatetimetable', { updates });
    
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
    const resPrices = await axios.get('/api/pms/getrates');
    const resTime = await axios.get('/api/pms/gettimetable');
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
.config-container {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  gap: 24px;
  padding: 8px;
  min-height: calc(100vh - 120px);
}

.sidebar,
.editor-section,
.calendar-grid {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.sidebar {
  padding: 24px;
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

.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.price-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
  border-left: 5px solid #cbd5e1;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.88);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.price-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
}

.price-card.active {
  background: rgba(231, 242, 255, 0.95);
  box-shadow: 0 0 0 1px rgba(29, 140, 242, 0.2), 0 16px 30px rgba(29, 140, 242, 0.12);
}

.price-card-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.price-card-info strong {
  font-size: 0.96rem;
  color: var(--ds-text);
}

.base-price-badge,
.id-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.95);
  color: var(--ds-text-soft);
  font-size: 0.72rem;
  font-weight: 700;
}

.range-actions {
  margin-top: 20px;
  padding: 18px;
  border-radius: 22px;
  border: 1px dashed rgba(148, 163, 184, 0.45);
  background: rgba(248, 250, 252, 0.88);
}

.selection-info {
  margin: 0 0 12px;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ds-text-soft);
}

.btn {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-radius: 16px;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary,
.btn-save-range {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-save-range {
  margin-bottom: 8px;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-text);
  border-color: rgba(148, 163, 184, 0.18);
}

.editor-section {
  padding: 24px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-bottom: 14px;
  margin-bottom: 22px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.header-titles {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-titles h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ds-text);
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 26px;
}

.rate-input-group,
.surcharge-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rate-input-group label,
.surcharge-box label {
  font-size: 0.74rem;
  font-weight: 800;
  color: var(--ds-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency {
  position: absolute;
  left: 14px;
  color: var(--ds-text-muted);
  font-size: 0.9rem;
  pointer-events: none;
}

.input-wrapper input {
  width: 100%;
  min-height: 48px;
  padding: 0 14px 0 28px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  font: inherit;
  font-weight: 700;
  color: var(--ds-text);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.input-wrapper input:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.surcharges-container-compact {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  max-width: 360px;
  padding-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.hb-border {
  box-shadow: inset 0 -3px 0 #f59e0b;
}

.fb-border {
  box-shadow: inset 0 -3px 0 #ef4444;
}

.btn-glyph-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-radius: 18px;
  background: linear-gradient(180deg, #22c55e, #16a34a);
  color: white;
  cursor: pointer;
  box-shadow: 0 18px 28px rgba(34, 197, 94, 0.18);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.btn-glyph-save:hover {
  transform: translateY(-1px);
  box-shadow: 0 22px 34px rgba(34, 197, 94, 0.22);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
  gap: 8px;
  max-height: 560px;
  overflow-y: auto;
  padding: 16px;
}

.day-box {
  min-height: 68px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  font-size: 0.68rem;
  color: var(--ds-text-soft);
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
}

.day-box:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
}

.day-num {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ds-text);
}

.in-selection {
  transform: scale(0.96);
  box-shadow: inset 0 0 0 3px rgba(29, 140, 242, 0.55), 0 10px 18px rgba(29, 140, 242, 0.12) !important;
  z-index: 1;
}

.day-box.is-sunday {
  background-color: rgba(255, 241, 242, 0.95) !important;
  border-color: rgba(251, 113, 133, 0.3) !important;
}

.day-box.is-sunday .day-num {
  color: #e11d48;
}

.day-box.is-sunday small {
  color: #fb7185;
}

.toast-notification {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1100;
  min-width: 260px;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  box-shadow: var(--ds-shadow-soft);
  backdrop-filter: blur(18px);
}

.toast-notification.success .toast-content {
  background: rgba(236, 253, 245, 0.94);
  color: #166534;
  border: 1px solid rgba(34, 197, 94, 0.18);
}

.toast-notification.error .toast-content {
  background: rgba(254, 242, 242, 0.94);
  color: #b91c1c;
  border: 1px solid rgba(239, 68, 68, 0.18);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
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
  .config-container {
    padding: 0;
  }

  .sidebar,
  .editor-section,
  .calendar-grid {
    border-radius: 24px;
  }

  .editor-header,
  .price-card-info,
  .header-titles {
    flex-direction: column;
    align-items: flex-start;
  }

  .surcharges-container-compact {
    grid-template-columns: 1fr;
    max-width: none;
  }

  .calendar-grid {
    grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
  }

  .toast-notification {
    right: 12px;
    left: 12px;
    bottom: 12px;
    min-width: 0;
  }
}
</style>