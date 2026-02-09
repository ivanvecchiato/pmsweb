<script setup>
import { ref } from 'vue';
import BeachLayoutConfig from './BeachLayoutConfig.vue';
import BeachPriceManagement from './BeachPriceManagement.vue';

const activeTab = ref('layout'); // 'layout' | 'prices'

// Stato condiviso per forzare il refresh del listino dopo il cambio layout
const layoutVersion = ref(0);

const handleLayoutGenerated = () => {
  layoutVersion.value++;
  activeTab.value = 'prices'; // Passa automaticamente ai prezzi dopo la generazione
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

/* Animazioni */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
