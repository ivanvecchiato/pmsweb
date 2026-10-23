import { createApp, watch } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/design-system.css'
import { installApiTransportBridge } from './services/apiTransport'
import { useAuth } from './composables/useAuth'

await installApiTransportBridge()

const { isAuthenticated, loadPmsType, initializeAuth } = useAuth()

if (import.meta.env.VITE_DATA_SOURCE === 'firebase') {
  await initializeAuth()
  watch(isAuthenticated, authenticated => {
    if (!authenticated) router.replace('/login')
  })
}

if (isAuthenticated.value) {
	await loadPmsType(true)
}

const app = createApp(App)

app.use(router)

app.mount('#app')
