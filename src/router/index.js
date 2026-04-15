import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../Login.vue'),
      meta: { isPublic: true }
    },
    {
      path: '/',
      name: 'Planner',
      component: () => import('../HotelBookingPlanner.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'] }
    },
    {
      path: '/customers',
      name: 'CustomerManagement',
      component: () => import('../CustomerManagement.vue'),
      meta: { requiresAuth: true, permission: 'customers' }
    },
    {
      path: '/listino',
      name: 'PriceManagement',
      component: () => import('../PriceManagement.vue'),
      meta: { requiresAuth: true, permission: 'listino', pmsTypes: ['hotel'] }
    },
    {
      path: '/listino_beach',
      name: 'BeachManagementDashboard',
      component: () => import('../BeachManagementDashboard.vue'),
      meta: { requiresAuth: true, permission: 'listino_beach', pmsTypes: ['beach'] }
    },
    {
      path: '/onda-push-products',
      name: 'OndaPushProductsConfig',
      component: () => import('../OndaPushProductsConfig.vue'),
      meta: { requiresAuth: true, permission: 'onda_push_products' }
    },
    {
      path: '/beach-bookings',
      name: 'BeachBookingPlanner',
      component: () => import('../BeachBookingPlanner.vue'),
      meta: { requiresAuth: true, permission: 'beach-bookings', pmsTypes: ['beach'] }
    },
    {
      path: '/inventory',
      name: 'InventoryManagement',
      component: () => import('../InventoryManagement.vue'),
      meta: { requiresAuth: true, permission: 'inventory' }
    },
    {
      path: '/listino-prodotti',
      name: 'ProductsListino',
      component: () => import('../ProductCatalogManagement.vue'),
      meta: { requiresAuth: true, permission: 'inventory' }
    },
    {
      path: '/stats/products',
      name: 'StatsProducts',
      component: () => import('../StatsProducts.vue'),
      meta: { requiresAuth: true, permission: 'stats' }
    },
    {
      path: '/stats/operators',
      name: 'StatsOperators',
      component: () => import('../StatsOperators.vue'),
      meta: { requiresAuth: true, permission: 'stats' }
    },
    {
      path: '/stats/sales',
      name: 'StatsSales',
      component: () => import('../StatsSales.vue'),
      meta: { requiresAuth: true, permission: 'stats' }
    },
    {
      path: '/quotes',
      name: 'QuoteManager',
      component: () => import('../QuoteManager.vue'),
      meta: { requiresAuth: true, permission: 'home' }
    }
  ]
})

// Navigation guard per proteggere le rotte
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, hasPermission, isPmsTypeAllowed, loadPmsType, pmsType } = useAuth()

  if (isAuthenticated.value) {
    await loadPmsType()
  }

  if (to.meta.isPublic) {
    // Le pagine pubbliche sono sempre accessibili
    next()
  } else if (to.meta.requiresAuth) {
    if (!isAuthenticated.value) {
      // Non autenticato, redirect a login
      next('/login')
    } else if (to.meta.permission && !hasPermission(to.meta.permission)) {
      // Autenticato ma senza permessi, redirect a home
      next('/')
    } else if (to.meta.pmsTypes && !isPmsTypeAllowed(to.meta.pmsTypes)) {
      const fallbackRoute = pmsType.value === 'beach' ? '/beach-bookings' : '/'
      next(fallbackRoute)
    } else {
      // Autenticato e con permessi
      next()
    }
  } else {
    next()
  }
})

export default router
