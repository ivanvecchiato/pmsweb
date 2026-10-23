import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { isFirebaseRemoteMode } from '../services/firebaseClient'

const getAuthorizedFallbackRoute = ({ hasPermission, isPmsTypeAllowed }) => {
  if (hasPermission('home') && isPmsTypeAllowed(['hotel'])) return '/'
  if (hasPermission('beach-bookings') && isPmsTypeAllowed(['beach'])) return '/beach-tableau'
  if (hasPermission('inventory')) return '/listino-prodotti'
  if (hasPermission('stats')) return '/stats/sales'
  if (hasPermission('listino')) return '/settings/configurations'
  if (hasPermission('onda_push_products')) return '/onda-push-products'
  return '/login'
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/ristorazione-bar',
      component: () => import('@/views/AreaOverview.vue'),
      meta: { requiresAuth: true, areaOverview: true, title: 'Ristorazione e bar', description: 'Menu del giorno, colazioni, prodotti e magazzino.', areaOrder: 0, icon: 'M4 3v7m3-7v7m-3-3h3m-1.5 3v11M16 3v18m0-18c5 3 5 9 0 9' }
    },
    {
      path: '/conti-report',
      component: () => import('@/views/AreaOverview.vue'),
      meta: { requiresAuth: true, areaOverview: true, title: 'Conti e report', description: 'Conti hotel e analisi delle attività.', areaOrder: 1, icon: 'M4 6h16v12H4zM4 10h16M8 14h4' }
    },
    {
      path: '/adempimenti',
      component: () => import('@/views/AreaOverview.vue'),
      meta: { requiresAuth: true, areaOverview: true, title: 'Adempimenti', description: 'Comunicazioni e adempimenti della struttura.', areaOrder: 2, icon: 'M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3zM9 12l2 2 4-4' }
    },
    {
      path: '/impostazioni',
      name: 'Settings',
      component: () => import('@/views/AreaOverview.vue'),
      meta: { requiresAuth: true, areaOverview: true, title: 'Impostazioni', description: 'Configurazione della suite, utenti e tariffe.', areaOrder: 3, icon: 'M3 7h18M6 12h12M8 17h8' }
    },
    {
      path: '/tassa-soggiorno',
      name: 'TouristTax',
      component: () => import('@/views/pms/TouristTax.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/adempimenti', areaOrder: 2, title: 'Tassa di soggiorno', description: 'Area predisposta per la futura gestione della tassa.' }
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/auth/Login.vue'),
      meta: { isPublic: true }
    },
    {
      path: '/',
      name: 'Tableau',
      component: () => import('@/views/pms/Home.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/bookings',
      name: 'Bookings',
      component: () => import('@/views/pms/Bookings.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/housekeeping',
      name: 'Housekeeping',
      component: () => import('@/views/pms/Housekeeping.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/housekeeping/activities',
      name: 'HousekeepingActivities',
      component: () => import('@/views/pms/HousekeepingActivities.vue'),
      meta: { requiresAuth: true, adminOnly: true, pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/customers',
      name: 'CustomerManagement',
      component: () => import('@/views/pms/CustomerManagement.vue'),
      meta: { requiresAuth: true, permission: 'customers', requiresHospitalityStudioPms: true }
    },
    {
      path: '/listino',
      name: 'PriceManagement',
      component: () => import('@/views/config/PriceManagement.vue'),
      meta: { requiresAuth: true, permission: 'listino', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/impostazioni', areaOrder: 2, title: 'Listino hotel', description: 'Configura le tariffe hotel.' }
    },
    {
      path: '/settings/configurations',
      name: 'ConfigurationsSettings',
      component: () => import('@/views/config/ConfigurationsSettings.vue'),
      meta: { requiresAuth: true, permission: 'listino', area: '/impostazioni', areaOrder: 0, title: 'Generale', description: 'Configura le impostazioni e i moduli.' }
    },
    {
      path: '/settings/users',
      name: 'UsersConfig',
      component: () => import('@/views/config/UsersConfig.vue'),
      meta: { requiresAuth: true, permission: 'users', area: '/impostazioni', areaOrder: 1, title: 'Utenti e permessi', description: 'Gestisci gli accessi alla suite.' }
    },
    {
      path: '/settings/hotel-pricing',
      name: 'HotelPricingPolicySettings',
      component: () => import('@/views/config/HotelPricingPolicySettings.vue'),
      meta: { requiresAuth: true, permission: 'listino', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/impostazioni', areaOrder: 3, title: 'Regole prezzi hotel', description: 'Configura le regole tariffarie.' }
    },
    {
      path: '/menu-del-giorno',
      name: 'DailyMenuComposer',
      component: () => import('@/views/config/DailyMenuComposer.vue'),
      meta: { requiresAuth: true, permission: 'listino', area: '/ristorazione-bar', areaOrder: 0, title: 'Menu del giorno', description: 'Componi il menu per il servizio hotel.' }
    },
    {
      path: '/listino_beach',
      name: 'BeachManagementDashboard',
      component: () => import('@/views/beach/BeachManagementDashboard.vue'),
      meta: { requiresAuth: true, permission: 'listino_beach', pmsTypes: ['beach'], requiresHospitalityStudioPms: true, area: '/impostazioni', areaOrder: 4, title: 'Gestione spiaggia', description: 'Configura posti, settori e prezzi.' }
    },
    {
      path: '/menu-app',
      name: 'MenuAppConfig',
      component: () => import('@/views/config/MenuAppConfig.vue'),
      meta: { requiresAuth: true, permission: 'onda_push_products', area: '/ristorazione-bar', areaOrder: 4, title: 'Menu app', description: 'Componi il menu pubblicato nell’app.' }
    },
    {
      path: '/onda-push-products',
      name: 'OndaPushProductsConfig',
      component: () => import('@/views/config/OndaPushProductsConfig.vue'),
      meta: { requiresAuth: true, permission: 'onda_push_products', area: '/ristorazione-bar', areaOrder: 5, title: 'Promozioni app', description: 'Gestisci i prodotti in promozione.' }
    },
    {
      path: '/beach-bookings',
      redirect: '/beach-tableau?tab=tableau',
      meta: { requiresAuth: true, permission: 'beach-bookings', pmsTypes: ['beach'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/beach-tableau',
      name: 'BeachTableau',
      component: () => import('@/views/beach/BeachTableau.vue'),
      meta: { requiresAuth: true, permission: 'beach-bookings', pmsTypes: ['beach'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/inventory',
      name: 'InventoryManagement',
      component: () => import('@/views/bar/InventoryManagement.vue'),
      meta: { requiresAuth: true, permission: 'inventory', area: '/ristorazione-bar', areaOrder: 3, title: 'Magazzino', description: 'Consulta scorte e movimenti.' }
    },
    {
      path: '/listino-prodotti',
      name: 'ProductsListino',
      component: () => import('../ProductCatalogManagement.vue'),
      meta: { requiresAuth: true, permission: 'inventory', area: '/ristorazione-bar', areaOrder: 2, title: 'Catalogo prodotti', description: 'Gestisci prodotti, categorie e listini.' }
    },
    {
      path: '/pms/reports',
      name: 'PmsReports',
      component: () => import('@/views/pms/PmsReports.vue'),
      meta: { requiresAuth: true, permission: 'pms_reports', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/conti-report', areaOrder: 1, title: 'Report PMS', description: 'Consulta l’andamento del PMS.' }
    },
    {
      path: '/stats/products',
      name: 'StatsProducts',
      component: () => import('@/views/stats/StatsProducts.vue'),
      meta: { requiresAuth: true, permission: 'stats', area: '/conti-report', areaOrder: 3, title: 'Prodotti', description: 'Analizza le vendite per prodotto.' }
    },
    {
      path: '/stats/operators',
      name: 'StatsOperators',
      component: () => import('@/views/stats/StatsOperators.vue'),
      meta: { requiresAuth: true, permission: 'stats', area: '/conti-report', areaOrder: 4, title: 'Operatori', description: 'Consulta le statistiche degli operatori.' }
    },
    {
      path: '/stats/sales',
      name: 'StatsSales',
      component: () => import('@/views/stats/StatsSales.vue'),
      meta: { requiresAuth: true, permission: 'stats', area: '/conti-report', areaOrder: 2, title: 'Vendite', description: 'Analizza le vendite nel periodo.' }
    },
    {
      path: '/stats/documents',
      name: 'StatsDocuments',
      component: () => import('@/views/stats/StatsDocuments.vue'),
      meta: { requiresAuth: true, permission: 'stats', area: '/conti-report', areaOrder: 5, title: 'Documenti', description: 'Consulta le statistiche dei documenti.' }
    },
    {
      path: '/quotes',
      name: 'QuoteManager',
      component: () => import('@/views/quotes/QuoteManager.vue'),
      meta: { requiresAuth: true, permissions: ['home', 'beach-bookings'], pmsTypes: ['hotel', 'beach'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/hotel-events',
      name: 'HotelEvents',
      component: () => import('@/views/pms/HotelEvents.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/accounts',
      name: 'GuestAccount',
      component: () => import('@/views/pms/HotelAccountDocuments.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/conti-report', areaOrder: 0, title: 'Conti hotel', description: 'Consulta e gestisci i conti degli ospiti.' }
    },
    {
      path: '/breakfast-report',
      name: 'BreakfastReport',
      component: () => import('@/views/pms/BreakfastReport.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/ristorazione-bar', areaOrder: 1, title: 'Report colazione', description: 'Consulta le colazioni e il riepilogo ospiti.' }
    },
    {
      path: '/ps',
      name: 'PublicSecurity',
      component: () => import('@/views/pms/PublicSecurity.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/adempimenti', areaOrder: 0, title: 'PS', description: 'Genera le schedine per AlloggiatiWeb.' }
    },
    {
      path: '/istat',
      name: 'Istat',
      component: () => import('@/views/pms/Istat.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true, area: '/adempimenti', areaOrder: 1, title: 'ISTAT', description: 'Prepara la rilevazione dei flussi turistici.' }
    },
    {
      path: '/services',
      name: 'ServicesConfig',
      component: () => import('@/views/config/ServicesConfig.vue'),
      meta: { requiresAuth: true, permissions: ['listino', 'listino_beach'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/payments/checkout/:reservationId',
      name: 'CheckoutPayment',
      component: () => import('@/views/payments/CheckoutPaymentStub.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    }
  ]
})

// Navigation guard per proteggere le rotte
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, hasPermission, isPmsTypeAllowed, loadPmsType, pmsType, canShowHotelBeachMenus, userRole, validateSession } = useAuth()

  validateSession()

  if (isAuthenticated.value) {
    await loadPmsType()
  }

  if (isFirebaseRemoteMode() && to.name === 'Login' && isAuthenticated.value) {
    next('/')
    return
  }

  const cloudSettingsRoutes = ['/impostazioni', '/listino', '/settings/hotel-pricing']
  if (isFirebaseRemoteMode() && !['Login', 'Tableau', 'Bookings'].includes(to.name) && !cloudSettingsRoutes.includes(to.path)) {
    next(isAuthenticated.value ? '/' : '/login')
    return
  }

  if (isFirebaseRemoteMode() && cloudSettingsRoutes.includes(to.path) && userRole.value !== 'admin') {
    next(isAuthenticated.value ? '/' : '/login')
    return
  }

  if (to.meta.isPublic) {
    // Le pagine pubbliche sono sempre accessibili
    next()
  } else if (to.meta.requiresAuth) {
    if (!isAuthenticated.value) {
      // Non autenticato, redirect a login
      next('/login')
    } else if (to.meta.permissions && !to.meta.permissions.some((permission) => hasPermission(permission))) {
      next(getAuthorizedFallbackRoute({ hasPermission, isPmsTypeAllowed }))
    } else if (to.meta.permission && !hasPermission(to.meta.permission)) {
      next(getAuthorizedFallbackRoute({ hasPermission, isPmsTypeAllowed, canShowHotelBeachMenus }))
    } else if (to.meta.adminOnly && userRole.value !== 'admin') {
      next(getAuthorizedFallbackRoute({ hasPermission, isPmsTypeAllowed }))
    } else if (to.meta.requiresHospitalityStudioPms && !canShowHotelBeachMenus.value) {
      next(getAuthorizedFallbackRoute({ hasPermission, isPmsTypeAllowed }))
    } else if (to.meta.pmsTypes && !isPmsTypeAllowed(to.meta.pmsTypes)) {
      next(getAuthorizedFallbackRoute({ hasPermission, isPmsTypeAllowed }))
    } else {
      // Autenticato e con permessi
      next()
    }
  } else {
    next()
  }
})

export default router
