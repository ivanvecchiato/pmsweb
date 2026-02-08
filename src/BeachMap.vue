<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';

const props = defineProps({
  selectedDate: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

const resources = ref([]);
const loading = ref(false);

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeResource = (res) => {
  const row = toNumber(res.row) ?? toNumber(res.riga) ?? toNumber(res.fila) ?? 0;
  const column = toNumber(res.column) ?? toNumber(res.fila) ?? toNumber(res.riga) ?? 0;
  const sector = res.sector ?? res.zona ?? '';
  const name = res.name ?? res.code ?? `${sector}${row}-${column}`;
  return { ...res, row, column, sector, name };
};

// Raggruppamento per Settore e poi per Fila per disegnare la mappa
const sectorsMap = computed(() => {
  const map = {};
  resources.value.forEach(res => {
    if (!map[res.sector]) map[res.sector] = { name: res.sector, rows: {} };
    if (!map[res.sector].rows[res.row]) map[res.sector].rows[res.row] = [];
    
    // Arricchiamo il dato con lo stato di occupazione (solo se il backend include reservation)
    const isOccupied = Boolean(res.reservation);
    map[res.sector].rows[res.row].push({ ...res, isOccupied });
  });
  return map;
});

const fetchData = async () => {
  loading.value = true;
  try {
    const resData = await axios.get(`http://localhost:8081/api/pms/beach/getplan?mode=flat&includeReservations=true&date=${props.selectedDate}`);
    resources.value = resData.data.map(normalizeResource);
  } catch (err) {
    console.error("Errore caricamento mappa:", err);
  } finally {
    loading.value = false;
  }
};

const handleUmbrellaClick = (umbrella) => {
  if (umbrella.isOccupied) {
    alert(`Posto ${umbrella.name} già occupato.`);
  } else {
    // Emette un evento per il componente padre (BookingPlanner) 
    // per aprire il modale di prenotazione pre-compilato
    emit('select', umbrella);
  }
};

const emit = defineEmits(['select']);
onMounted(fetchData);
watch(() => props.selectedDate, fetchData);
</script>

<template>
  <div class="map-container">
    <div class="map-legend">
      <div class="legend-item"><span class="box free"></span> Libero</div>
      <div class="legend-item"><span class="box occupied"></span> Occupato</div>
      <div class="legend-item"><span class="box premium"></span> Premium</div>
    </div>

    <div class="sea-line">MARE 🌊</div>

    <div v-if="loading" class="skeleton">
      <div class="skeleton-line wide"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-grid">
        <div v-for="n in 60" :key="n" class="skeleton-cell"></div>
      </div>
    </div>

    <div v-else class="beach-area">
      <div v-for="sector in sectorsMap" :key="sector.name" class="sector-block">
        <h3 class="sector-title">{{ sector.name }}</h3>
        
        <div class="grid-rows">
          <div v-for="(umbrellas, rowNum) in sector.rows" :key="rowNum" class="map-row">
            <div class="row-label">F{{ rowNum }}</div>
            
            <div class="umbrellas-list">
              <div 
                v-for="u in umbrellas" 
                :key="u.id"
                class="umbrella-spot"
                :class="{ 'is-occupied': u.isOccupied, 'is-premium': u.column >= 4 && u.column <= 6 }"
                @click="handleUmbrellaClick(u)"
                :title="`Posto ${u.name} - Fila ${u.row}`"
              >
                {{ u.column }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-container { background: #fef3c7; padding: 40px; border-radius: 20px; overflow-x: auto; }

.sea-line { 
  text-align: center; padding: 20px; background: #0ea5e9; color: white; 
  font-weight: 800; border-radius: 50px; margin-bottom: 50px; letter-spacing: 5px;
}

.map-legend { display: flex; gap: 20px; margin-bottom: 20px; justify-content: center; }
.box { width: 15px; height: 15px; border-radius: 3px; display: inline-block; }
.box.free { background: white; border: 1px solid #cbd5e1; }
.box.occupied { background: #ef4444; }
.box.premium { background: #fbbf24; }

.sector-block { margin-bottom: 40px; }
.sector-title { font-size: 0.8rem; color: #92400e; text-transform: uppercase; margin-bottom: 15px; }

.grid-rows { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.map-row { display: flex; align-items: center; gap: 15px; }
.row-label { width: 30px; font-size: 0.7rem; font-weight: 800; color: #92400e; }

.umbrellas-list { display: flex; gap: 8px; }

.umbrella-spot {
  width: 35px; height: 35px; background: white; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; cursor: pointer;
  border: 2px solid #fbbf24; transition: all 0.2s;
}

.umbrella-spot:hover { transform: scale(1.2); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.umbrella-spot.is-occupied { background: #ef4444; border-color: #991b1b; color: white; cursor: not-allowed; }
.umbrella-spot.is-premium { background: #fffbeb; border-width: 3px; }

.skeleton { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.skeleton-line {
  height: 14px;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(226,232,240,0.6), rgba(226,232,240,0.95), rgba(226,232,240,0.6));
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
.skeleton-line.wide { width: 65%; height: 18px; }
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  gap: 10px;
}
.skeleton-cell {
  height: 32px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(241,245,249,0.7), rgba(226,232,240,0.95), rgba(241,245,249,0.7));
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
