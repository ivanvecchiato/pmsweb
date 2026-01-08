<template>
  <div id="app">
    <aside class="sidebar" role="navigation" aria-label="Sidebar menu">
      <nav class="menu">
        <router-link
          to="/"
          :class="['menu-item', { active: route.path === '/' }]"
          aria-label="Vai alla Home"
        >
          <span class="icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="label">Home</span>
        </router-link>

        <router-link
          to="/customers"
          :class="['menu-item', { active: route.path === '/customers' }]"
          aria-label="Gestione Clienti"
        >
          <span class="icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21v-1.5C2 16.5 6.7 15 8 15s6 1.5 6 4.5V21H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="label">Clienti</span>
        </router-link>

        <div class="menu-group">
          <button 
            @click="isStatsOpen = !isStatsOpen"
            :class="['menu-item', 'menu-trigger', { active: route.path.startsWith('/stats') }]"
          >
            <span class="icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="label">Statistiche</span>
            <span class="arrow-icon" :class="{ rotated: isStatsOpen }">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>

          <div v-if="isStatsOpen" class="submenu">
            <router-link to="/stats/products" class="submenu-item">Prodotti</router-link>
            <router-link to="/stats/operators" class="submenu-item">Operatori</router-link>
            <router-link to="/stats/various" class="submenu-item">Varie</router-link>
          </div>
        </div>
      </nav>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isStatsOpen = ref(false)
</script>

<style scoped>
:root { 
  --primary: #1976d2; 
  --onprimary: #ffffff; 
  --bg: #f6f8fa; 
}

/* Layout Principale: occupa l'intera altezza del viewport e impedisce lo scroll del body */
#app { 
  height: 100vh; 
  display: flex; 
  flex-direction: row; 
  background: var(--bg); 
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden; /* Impedisce lo scroll dell'intera pagina */
}

/* Sidebar: larghezza fissa e altezza 100% */
.sidebar {
  width: 64px;
  background: var(--primary);
  color: var(--onprimary);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  flex-shrink: 0; /* Impedisce alla sidebar di restringersi */
  box-shadow: 2px 0 6px rgba(0,0,0,0.06);
  z-index: 10;
}

/* Main Content: occupa lo spazio rimanente e gestisce gli scroll internamente */
.content { 
  flex: 1; 
  height: 100vh;
  overflow: auto; /* Abilita lo scroll sia verticale che orizzontale */
  padding: 16px; 
  box-sizing: border-box;
}

/* Menu Styles */
.menu { display: flex; flex-direction: column; gap: 8px; width: 100%; align-items: center; }
.menu-group { width: 100%; }

.menu-item { 
  display: flex; align-items: center; gap: 8px; padding: 10px; color: inherit; text-decoration: none; 
  border-radius: 8px; width: 100%; justify-content: center; box-sizing: border-box;
  background: transparent; border: none; cursor: pointer; font-size: inherit;
}

.menu-item .label { display: none; font-weight: 600; }
.menu-item:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
.menu-item.active { background: var(--onprimary); color: var(--primary); }

.icon svg { width: 20px; height: 20px; display: block; }
.arrow-icon { display: none; width: 16px; height: 16px; transition: transform 0.3s; }
.arrow-icon.rotated { transform: rotate(180deg); }

/* Sottomenu */
.submenu {
  display: flex; flex-direction: column; background: rgba(0,0,0,0.1); margin-top: 4px; border-radius: 8px; overflow: hidden;
}
.submenu-item {
  padding: 10px; color: rgba(255,255,255,0.8); text-decoration: none; font-size: 0.85rem; text-align: center;
}
.submenu-item:hover { background: rgba(255,255,255,0.1); color: white; }

/* Schermi larghi: espansione sidebar */
@media(min-width:600px) {
  .sidebar { width: 200px; align-items: flex-start; padding: 16px; }
  .menu { align-items: flex-start; }
  .menu-item { justify-content: flex-start; padding: 10px 12px; }
  .menu-item .label { display: inline-block; }
  .arrow-icon { display: block; margin-left: auto; }
  .submenu-item { text-align: left; padding-left: 40px; }
}

.menu-item:focus { outline: 2px solid rgba(255,255,255,0.25); outline-offset: 2px; }
</style>