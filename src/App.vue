<template>
  <div id="app">
    <div v-if="isAuthenticated" class="app-shell">
      <aside class="sidebar" role="navigation" aria-label="Sidebar menu">
        <div class="sidebar-brand">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 12.5 10 15.5 17 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" opacity="0.38"/>
            </svg>
          </div>
          <div class="brand-copy">
            <strong>MBAR PMS</strong>
            <span>Operations Suite</span>
          </div>
        </div>

        <nav class="menu">
          <!-- AREA PMS -->
          <div v-if="canShowHotelBeachMenus && ((hasPermission('home') && isPmsTypeAllowed(['hotel'])) || hasPermission('customers') || (hasPermission('beach-bookings') && isPmsTypeAllowed(['beach'])))" class="menu-section">
            <div class="section-label">PMS</div>
            
            <router-link
              v-if="hasPermission('home') && isPmsTypeAllowed(['hotel'])"
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
              v-if="hasPermission('beach-bookings') && isPmsTypeAllowed(['beach'])"
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

            <router-link
              v-if="hasPermission('home') && isPmsTypeAllowed(['hotel'])"
              to="/accounts"
              :class="['menu-item', { active: route.path === '/accounts' }]"
              aria-label="Conti Hotel"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16v12H4zM4 10h16M8 14h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Conti</span>
            </router-link>
          </div>

          <!-- AREA BAR -->
          <div v-if="hasPermission('inventory') || hasPermission('stats')" class="menu-section">
            <div class="section-label">BAR</div>

            <router-link
              v-if="hasPermission('inventory')"
              to="/listino-prodotti"
              :class="['menu-item', { active: route.path === '/listino-prodotti' }]"
              aria-label="Listino Prodotti"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 8h16M7 4h10M9 12h6M6 16h12M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Listino</span>
            </router-link>
            
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
                <router-link to="/stats/documents" class="submenu-item">Documenti</router-link>
              </div>
            </div>
          </div>

          <!-- AREA CONFIGURAZIONI (sempre visibile) -->
          <div v-if="hasPermission('listino')" class="menu-section">
            <div class="section-label">CONFIGURAZIONI</div>

            <router-link
              to="/settings/configurations"
              :class="['menu-item', { active: route.path === '/settings/configurations' }]"
              aria-label="Configurazioni"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7h18M6 12h12M8 17h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Configurazioni</span>
            </router-link>
          </div>

          <!-- AREA CONFIGURAZIONE -->
          <div v-if="(canShowHotelBeachMenus && (hasPermission('listino') || hasPermission('listino_beach'))) || hasPermission('onda_push_products')" class="menu-section">
            <div class="section-label">CONFIGURAZIONE</div>
            
            <router-link
              v-if="canShowHotelBeachMenus && hasPermission('listino') && isPmsTypeAllowed(['hotel'])"
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
              v-if="canShowHotelBeachMenus && hasPermission('listino') && isPmsTypeAllowed(['hotel'])"
              to="/settings/hotel-pricing"
              :class="['menu-item', { active: route.path === '/settings/hotel-pricing' }]"
              aria-label="Policy Prezzi Hotel"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7h18M6 12h12M8 17h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Policy Prezzi</span>
            </router-link>

            <router-link
              v-if="canShowHotelBeachMenus && hasPermission('listino_beach') && isPmsTypeAllowed(['beach'])"
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
              v-if="hasPermission('onda_push_products')"
              to="/onda-push-products"
              :class="['menu-item', { active: route.path === '/onda-push-products' }]"
              aria-label="Prodotti in evidenza Onda"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 8h16M7 4h10M9 12h6M6 16h12M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Promo</span>
            </router-link>

            <router-link
              v-if="canShowHotelBeachMenus && (hasPermission('listino') || hasPermission('listino_beach'))"
              to="/services"
              :class="['menu-item', { active: route.path === '/services' }]"
              aria-label="Configurazione Servizi"
            >
              <span class="icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="label">Servizi</span>
            </router-link>

          </div>

          <!-- Logout button -->
          <div class="menu-section menu-section-bottom">
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
        <header class="content-toolbar">
          <div class="toolbar-heading">
            <span class="toolbar-eyebrow">Control panel</span>
            <h1>{{ activeSection.title }}</h1>
          </div>
        </header>

        <section class="content-body">
          <router-view />
        </section>
      </main>
    </div>

    <router-view v-else />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, logout, hasPermission, userRole, userName, isPmsTypeAllowed, canShowHotelBeachMenus } = useAuth()

const isStatsOpen = ref(false)

const sectionContent = {
  '/': { title: 'Planner Hotel', description: 'Monitoraggio camere, prenotazioni e operativita giornaliera.' },
  '/customers': { title: 'Gestione Clienti', description: 'Anagrafica ospiti, contatti e storico relazioni.' },
  '/beach-bookings': { title: 'Planner Spiaggia', description: 'Controllo rapido delle prenotazioni stabilimento.' },
  '/quotes': { title: 'Preventivi', description: 'Creazione e conversione offerte in prenotazioni operative.' },
  '/accounts': { title: 'Conti Ospiti', description: 'Saldo servizi, depositi e chiusure conto.' },
  '/listino-prodotti': { title: 'Catalogo Prodotti', description: 'Listini, categorie e prodotti in evidenza.' },
  '/inventory': { title: 'Magazzino', description: 'Stock, movimenti e carichi fornitori in un’unica vista.' },
  '/settings/configurations': { title: 'Configurazioni', description: 'Impostazioni globali e attivazione moduli del PMS.' },
  '/listino': { title: 'Listino Hotel', description: 'Tariffe, fasce e struttura dei prezzi hotel.' },
  '/settings/hotel-pricing': { title: 'Policy Prezzi', description: 'Regole tariffarie per camere, ospiti e stagionalita.' },
  '/listino_beach': { title: 'Gestione Spiaggia', description: 'Configurazione posti, settori e prezzi stabilimento.' },
  '/onda-push-products': { title: 'Promo Onda', description: 'Selezione prodotti e slot promozionali pubblicati.' },
  '/services': { title: 'Servizi', description: 'Servizi accessori e add-on per hotel e spiaggia.' }
}

const activeSection = computed(() => {
  if (route.path.startsWith('/stats')) {
    return {
      title: 'Statistiche',
      description: 'Vista analitica su vendite, prodotti, operatori e documenti.'
    }
  }

  return sectionContent[route.path] || {
    title: 'Dashboard',
    description: 'Ambiente operativo unificato per reception, bar e spiaggia.'
  }
})

const handleLogout = () => {
  logout()
  router.push('/login')
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding: 22px;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  background: transparent;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 24px 54px rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(24px);
  overflow: hidden;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 8px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.brand-mark {
  width: 50px;
  height: 50px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ds-primary);
  background: linear-gradient(180deg, rgba(29, 140, 242, 0.18), rgba(29, 140, 242, 0.08));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.brand-mark svg {
  width: 24px;
  height: 24px;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-copy strong {
  font-size: 0.98rem;
  letter-spacing: -0.03em;
}

.brand-copy span {
  font-size: 0.82rem;
  color: var(--ds-text-soft);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.menu-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.menu-section-bottom {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.section-label {
  padding: 0 12px 6px;
  color: var(--ds-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.menu-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 18px;
  color: var(--ds-text-soft);
  text-decoration: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.menu-item .label {
  display: inline-block;
  font-weight: 700;
  font-size: 0.95rem;
}

.menu-item:hover {
  transform: translateY(-1px);
  color: var(--ds-text);
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(148, 163, 184, 0.2);
}

.menu-item.active {
  color: var(--ds-text);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 251, 255, 0.9));
  border-color: rgba(29, 140, 242, 0.16);
  box-shadow: 0 12px 28px rgba(148, 163, 184, 0.14);
}

.menu-item:focus-visible {
  outline: 2px solid rgba(29, 140, 242, 0.3);
  outline-offset: 2px;
}

.icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 140, 242, 0.08);
  color: inherit;
}

.menu-item.active .icon {
  background: rgba(29, 140, 242, 0.12);
  color: var(--ds-primary);
}

.icon svg {
  width: 19px;
  height: 19px;
  display: block;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  margin-left: auto;
  transition: transform 0.22s ease;
}

.arrow-icon.rotated {
  transform: rotate(180deg);
}

.submenu {
  margin-left: 18px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 18px;
  background: rgba(245, 249, 253, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.submenu-item {
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--ds-text-soft);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
}

.submenu-item:hover,
.submenu-item.router-link-active {
  color: var(--ds-text);
  background: rgba(255, 255, 255, 0.9);
}

.logout-btn {
  color: #cc5757;
}

.logout-btn .icon {
  background: rgba(220, 77, 77, 0.12);
}

.user-info {
  display: block;
  padding: 8px 14px 0;
  font-size: 0.76rem;
  color: var(--ds-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.content-toolbar,
.content-body {
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 54px rgba(148, 163, 184, 0.16);
  backdrop-filter: blur(24px);
}

.content-toolbar {
  padding: 22px 26px;
  border-radius: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.toolbar-heading h1 {
  margin: 0;
  font-size: clamp(1.8rem, 1.3rem + 1vw, 2.5rem);
  letter-spacing: -0.05em;
}

.toolbar-eyebrow {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--ds-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.content-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  border-radius: 34px;
  padding: 20px;
}

@media (max-width: 1080px) {
  .app-shell {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .sidebar,
  .content-toolbar,
  .content-body {
    border-radius: 24px;
  }

  .content-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 720px) {
  .sidebar-brand {
    padding-bottom: 12px;
  }

  .brand-copy span,
  .section-label,
  .user-info {
    display: none;
  }

  .app-shell {
    gap: 12px;
  }

  .sidebar {
    padding: 14px;
  }

  .menu-item {
    padding: 10px 12px;
  }

  .menu-item .label {
    font-size: 0.9rem;
  }

  .content-body {
    padding: 14px;
  }
}
</style>
