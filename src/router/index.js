import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Planner',
      component: () => import('../HotelBookingPlanner.vue')
    },
    {
      path: '/customers',
      name: 'CustomerManagement',
      component: () => import('../CustomerManagement.vue')
    },
    {
      path: '/listino',
      name: 'PriceManagement',
      component: () => import('../PriceManagement.vue')
    },
    {
      path: '/listino_beach',
      name: 'BeachManagementDashboard',
      component: () => import('../BeachManagementDashboard.vue')
    },
    {
      path: '/beach-bookings',
      name: 'BeachBookingPlanner',
      component: () => import('../BeachBookingPlanner.vue')
    },
    {
      path: '/inventory',
      name: 'InventoryManagement',
      component: () => import('../InventoryManagement.vue')
    },
    {
      path: '/stats/products',
      name: 'StatsProducts',
      component: () => import('../StatsProducts.vue')
    },
    {
      path: '/stats/operators',
      name: 'StatsOperators',
      component: () => import('../StatsOperators.vue')
    },
    {
      path: '/stats/various',
      name: 'StatsVarious',
      component: () => import('../StatsVarious.vue')    },
    {
      path: '/stats/sales',
      name: 'StatsSales',
      component: () => import('../StatsSales.vue')    }
  ],
})

export default router
