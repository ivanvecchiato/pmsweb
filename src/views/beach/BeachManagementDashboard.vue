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
  min-height: 100vh;
  gap: 16px;
}

.dashboard-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 28px;
  min-height: 96px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
  z-index: 100;
  margin: 8px 8px 0;
  gap: 16px;
  flex-wrap: wrap;
}

.nav-brand { display: flex; align-items: center; gap: 15px; }

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(251, 191, 36, 0.22));
  font-size: 1.4rem;
}

.brand-text h1 { font-size: 1.28rem; margin: 0; color: var(--ds-text); font-weight: 800; letter-spacing: -0.03em; }
.brand-text p { font-size: 0.85rem; margin: 4px 0 0; color: var(--ds-text-soft); }

.nav-links { display: flex; gap: 10px; }
.nav-links button {
  padding: 12px 18px;
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ds-text-soft);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-links button.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.9));
  color: var(--ds-primary-strong);
  border-color: rgba(29, 140, 242, 0.18);
  box-shadow: 0 14px 24px rgba(29, 140, 242, 0.12);
}

.dashboard-main {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Animazioni */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 720px) {
  .dashboard-nav,
  .nav-links {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
