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
      path: '/inventory',
      name: 'InventoryManagement',
      component: () => import('../InventoryManagement.vue')
    }
  ],
})

export default router
