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

const saveRangeAssignment = async () => {
  if (!selectionStart.value || !selectionEnd.value || !selectedPricelist.value) return;

  const s = new Date(selectionStart.value);
  const e = new Date(selectionEnd.value);
  const [start, end] = s < e ? [s, e] : [e, s];

  // Filtriamo i giorni del timetable che ricadono nel range
  const daysToUpdate = timetable.value.filter(day => {
    const d = new Date(day.date);
    return d >= start && d <= end;
  });

  const payload = {
    pricelistId: selectedPricelist.value.id,
    dates: daysToUpdate.map(d => d.date)
  };

  try {
    // Chiamata REST per aggiornamento massivo
    await axios.post('http://localhost:8081/api/pms/updatetimetablerange', payload);
    
    // Aggiornamento locale per feedback immediato
    daysToUpdate.forEach(day => day.pricelist = selectedPricelist.value.id);
    
    // Reset selezione
    selectionStart.value = null;
    selectionEnd.value = null;
    alert("Calendario aggiornato con successo!");
  } catch (err) {
    console.error("Errore nel salvataggio del range", err);
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
</style>