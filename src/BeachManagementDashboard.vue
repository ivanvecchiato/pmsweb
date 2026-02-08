<script setup>
import { ref } from 'vue';
import BeachLayoutConfig from './BeachLayoutConfig.vue';
import BeachPriceManagement from './BeachPriceManagement.vue';
import BeachMap from './BeachMap.vue';

const activeTab = ref('layout'); // 'layout' | 'prices' | 'map'
const selectedDate = ref(new Date().toISOString().split('T')[0]);
const selectedPlace = ref(null);

// Stato condiviso per forzare il refresh del listino dopo il cambio layout
const layoutVersion = ref(0);

const handleLayoutGenerated = () => {
  layoutVersion.value++;
  activeTab.value = 'prices'; // Passa automaticamente ai prezzi dopo la generazione
};

const handlePlaceSelect = (place) => {
  selectedPlace.value = place;
};
</script>

<template>
  <div class="dashboard-container">
    <nav class="dashboard-nav">
      <div class="nav-brand">
        <span class="icon">🏖️</span>
        <div class="brand-text">
          <h1>Beach Manager</h1>
          <p>Controllo Stabilimento</p>
        </div>
      </div>
      
      <div class="nav-links">
        <button 
          @click="activeTab = 'layout'" 
          :class="{ active: activeTab === 'layout' }"
        >
          1. Configura Mappa
        </button>
        <button 
          @click="activeTab = 'prices'" 
          :class="{ active: activeTab === 'prices' }"
        >
          2. Listini e Tariffe
        </button>
        <button 
          @click="activeTab = 'map'" 
          :class="{ active: activeTab === 'map' }"
        >
          3. Mappa Posti
        </button>
      </div>
    </nav>

    <main class="dashboard-main">
      <Transition name="fade" mode="out-in">
        <div v-if="activeTab === 'layout'" key="layout">
          <BeachLayoutConfig @generated="handleLayoutGenerated" />
        </div>
        <div v-else-if="activeTab === 'prices'" key="prices">
          <BeachPriceManagement :key="layoutVersion" />
        </div>
        <div v-else key="map">
          <div class="map-toolbar">
            <div class="toolbar-left">
              <label for="beach-date">Data</label>
              <input id="beach-date" type="date" v-model="selectedDate" />
            </div>
            <div v-if="selectedPlace" class="selected-place">
              Selezionato: {{ selectedPlace.name }} (Fila {{ selectedPlace.row }}, Col {{ selectedPlace.column }})
            </div>
          </div>
          <BeachMap :selectedDate="selectedDate" @select="handlePlaceSelect" />
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.dashboard-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
  height: 80px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  z-index: 100;
}

.nav-brand { display: flex; align-items: center; gap: 15px; }
.brand-text h1 { font-size: 1.2rem; margin: 0; color: #1e293b; }
.brand-text p { font-size: 0.8rem; margin: 0; color: #64748b; }

.nav-links { display: flex; gap: 10px; }
.nav-links button {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-links button.active {
  background: #eff6ff;
  color: #3b82f6;
}

.dashboard-main {
  flex: 1;
  overflow-y: auto;
  background: #f8fafc;
}

.map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #475569;
}

.toolbar-left input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-weight: 600;
}

.selected-place {
  font-size: 0.9rem;
  color: #1e293b;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 6px 10px;
  border-radius: 8px;
  font-weight: 600;
}

/* Animazioni */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
