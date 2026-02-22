<template>
  <div id="app">
    <!-- Mostra la vista principale solo se autenticato -->
    <div v-if="isAuthenticated" style="display: flex; width: 100%; height: 100vh;">
      <aside class="sidebar" role="navigation" aria-label="Sidebar menu">
        <nav class="menu">
          <!-- AREA PMS -->
          <div v-if="hasPermission('home') || hasPermission('customers') || hasPermission('beach-bookings')" class="menu-section">
            <div class="section-label">PMS</div>
            
            <router-link
              v-if="hasPermission('home')"
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
              v-if="hasPermission('customers')"
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

            <router-link
              v-if="hasPermission('beach-bookings')"
              to="/beach-bookings"
              :class="['menu-item', { active: route.path === '/beach-bookings' }]"
              aria-label="Prenotazioni Spiaggia"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 20h16M6 20v-9m6 9V6m6 14v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Prenotazioni Spiaggia</span>
            </router-link>
          </div>

          <!-- AREA BAR -->
          <div v-if="hasPermission('inventory') || hasPermission('stats')" class="menu-section">
            <div class="section-label">BAR</div>
            
            <router-link
              v-if="hasPermission('inventory')"
              to="/inventory"
              :class="['menu-item', { active: route.path === '/inventory' }]"
              aria-label="Magazzino"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21v-1.5C2 16.5 6.7 15 8 15s6 1.5 6 4.5V21H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Magazzino</span>
            </router-link>

            <div v-if="hasPermission('stats')" class="menu-group">
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
                <router-link to="/stats/sales" class="submenu-item">Vendite</router-link>
                <router-link to="/stats/products" class="submenu-item">Prodotti</router-link>
                <router-link to="/stats/operators" class="submenu-item">Operatori</router-link>
              </div>
            </div>
          </div>

          <!-- AREA CONFIGURAZIONE -->
          <div v-if="hasPermission('listino') || hasPermission('listino_beach')" class="menu-section">
            <div class="section-label">CONFIGURAZIONE</div>
            
            <router-link
              v-if="hasPermission('listino')"
              to="/listino"
              :class="['menu-item', { active: route.path === '/listino' }]"
              aria-label="Listino Hotel"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21v-1.5C2 16.5 6.7 15 8 15s6 1.5 6 4.5V21H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Listino Hotel</span>
            </router-link>

            <router-link
              v-if="hasPermission('listino_beach')"
              to="/listino_beach"
              :class="['menu-item', { active: route.path === '/listino_beach' }]"
              aria-label="Gestione Spiaggia"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21v-1.5C2 16.5 6.7 15 8 15s6 1.5 6 4.5V21H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Gestione Spiaggia</span>
            </router-link>

            <router-link
              to="/quotes"
              :class="['menu-item', { active: route.path === '/quotes' }]"
              aria-label="Preventivi"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12h6m-6 4h6M9 8h6m9-2h-2V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2h2a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Preventivi</span>
            </router-link>
          </div>

          <!-- Logout button -->
          <div class="menu-section" style="margin-top: auto;">
            <button @click="handleLogout" class="menu-item logout-btn">
              <span class="icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Logout</span>
            </button>
            <small class="user-info">{{ userName }} ({{ userRole }})</small>
          </div>
        </nav>
      </aside>

      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- Altrimenti mostra il router (login page) -->
    <router-view v-else />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, logout, hasPermission, userRole, userName } = useAuth()

const isStatsOpen = ref(false)

const handleLogout = () => {
  logout()
  router.push('/login')
}
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
.menu { display: flex; flex-direction: column; gap: 12px; width: 100%; align-items: center; }

.menu-section { 
  width: 100%; 
  display: flex; 
  flex-direction: column; 
  gap: 8px; 
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.15);
}

.menu-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  padding: 0 12px;
  text-align: center;
  display: none;
}

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
  display: flex; 
  flex-direction: column; 
  background: rgba(0, 0, 0, 0.25);
  margin-top: 8px; 
  border-radius: 8px; 
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.submenu-item {
  padding: 10px 16px; 
  color: rgba(255, 255, 255, 0.95);
  text-decoration: none; 
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.submenu-item:last-child {
  border-bottom: none;
}

.submenu-item:hover { 
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  transform: translateX(2px);
}

/* Schermi larghi: espansione sidebar */
@media(min-width:600px) {
  .sidebar { width: 200px; align-items: flex-start; padding: 16px; }
  .menu { align-items: flex-start; }
  .menu-item { justify-content: flex-start; padding: 10px 12px; }
  .menu-item .label { display: inline-block; }
  .arrow-icon { display: block; margin-left: auto; }
  .submenu-item { 
    text-align: left; 
    padding: 10px 12px 10px 40px;
    font-size: 0.9rem;
  }
  .section-label { display: block; text-align: left; }
}

.menu-item:focus { outline: 2px solid rgba(255,255,255,0.25); outline-offset: 2px; }

.logout-btn {
  color: #ff6b6b;
  font-weight: 600;
}

.logout-btn:hover {
  background: rgba(255, 107, 107, 0.15);
}

.user-info {
  display: block;
  padding: 8px 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  margin-top: 8px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-weight: 600;
}

@media(min-width:600px) {
  .user-info {
    text-align: left;
  }
}
</style>
