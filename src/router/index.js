import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const getAuthorizedFallbackRoute = ({ hasPermission, pmsType, canShowHotelBeachMenus }) => {
  if (canShowHotelBeachMenus.value && hasPermission('home') && pmsType.value === 'hotel') return '/'
  if (canShowHotelBeachMenus.value && hasPermission('beach-bookings') && pmsType.value === 'beach') return '/beach-bookings'
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
      path: '/login',
      name: 'Login',
      component: () => import('@/views/auth/Login.vue'),
      meta: { isPublic: true }
    },
    {
      path: '/',
      name: 'Planner',
      component: () => import('@/views/pms/HotelBookingPlanner.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
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
      meta: { requiresAuth: true, permission: 'listino', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/settings/configurations',
      name: 'ConfigurationsSettings',
      component: () => import('@/views/config/ConfigurationsSettings.vue'),
      meta: { requiresAuth: true, permission: 'listino' }
    },
    {
      path: '/settings/hotel-pricing',
      name: 'HotelPricingPolicySettings',
      component: () => import('@/views/config/HotelPricingPolicySettings.vue'),
      meta: { requiresAuth: true, permission: 'listino', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/menu-del-giorno',
      name: 'DailyMenuComposer',
      component: () => import('@/views/config/DailyMenuComposer.vue'),
      meta: { requiresAuth: true, permission: 'listino' }
    },
    {
      path: '/listino_beach',
      name: 'BeachManagementDashboard',
      component: () => import('@/views/beach/BeachManagementDashboard.vue'),
      meta: { requiresAuth: true, permission: 'listino_beach', pmsTypes: ['beach'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/onda-push-products',
      name: 'OndaPushProductsConfig',
      component: () => import('@/views/config/OndaPushProductsConfig.vue'),
      meta: { requiresAuth: true, permission: 'onda_push_products' }
    },
    {
      path: '/beach-bookings',
      name: 'BeachBookingPlanner',
      component: () => import('@/views/beach/BeachBookingPlanner.vue'),
      meta: { requiresAuth: true, permission: 'beach-bookings', pmsTypes: ['beach'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/inventory',
      name: 'InventoryManagement',
      component: () => import('@/views/bar/InventoryManagement.vue'),
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
      component: () => import('@/views/stats/StatsProducts.vue'),
      meta: { requiresAuth: true, permission: 'stats' }
    },
    {
      path: '/stats/operators',
      name: 'StatsOperators',
      component: () => import('@/views/stats/StatsOperators.vue'),
      meta: { requiresAuth: true, permission: 'stats' }
    },
    {
      path: '/stats/sales',
      name: 'StatsSales',
      component: () => import('@/views/stats/StatsSales.vue'),
      meta: { requiresAuth: true, permission: 'stats' }
    },
    {
      path: '/stats/documents',
      name: 'StatsDocuments',
      component: () => import('@/views/stats/StatsDocuments.vue'),
      meta: { requiresAuth: true, permission: 'stats' }
    },
    {
      path: '/quotes',
      name: 'QuoteManager',
      component: () => import('@/views/quotes/QuoteManager.vue'),
      meta: { requiresAuth: true, permission: 'home', requiresHospitalityStudioPms: true }
    },
    {
      path: '/accounts',
      name: 'GuestAccount',
      component: () => import('@/views/pms/GuestAccount.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/breakfast-report',
      name: 'BreakfastReport',
      component: () => import('@/views/pms/BreakfastReport.vue'),
      meta: { requiresAuth: true, permission: 'home', pmsTypes: ['hotel'], requiresHospitalityStudioPms: true }
    },
    {
      path: '/services',
      name: 'ServicesConfig',
      component: () => import('@/views/config/ServicesConfig.vue'),
      meta: { requiresAuth: true, permission: 'listino', requiresHospitalityStudioPms: true }
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
  const { isAuthenticated, hasPermission, isPmsTypeAllowed, loadPmsType, pmsType, canShowHotelBeachMenus } = useAuth()

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
      next(getAuthorizedFallbackRoute({ hasPermission, pmsType, canShowHotelBeachMenus }))
    } else if (to.meta.requiresHospitalityStudioPms && !canShowHotelBeachMenus.value) {
      next(getAuthorizedFallbackRoute({ hasPermission, pmsType, canShowHotelBeachMenus }))
    } else if (to.meta.pmsTypes && !isPmsTypeAllowed(to.meta.pmsTypes)) {
      next(getAuthorizedFallbackRoute({ hasPermission, pmsType, canShowHotelBeachMenus }))
    } else {
      // Autenticato e con permessi
      next()
    }
  } else {
    next()
  }
})

export default router
