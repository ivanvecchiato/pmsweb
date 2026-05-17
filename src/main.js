import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/design-system.css'
import { installApiTransportBridge } from './services/apiTransport'
import { useAuth } from './composables/useAuth'

await installApiTransportBridge()

const { isAuthenticated, loadPmsType } = useAuth()

if (isAuthenticated.value) {
	await loadPmsType(true)
}

const app = createApp(App)

app.use(router)

app.mount('#app')
