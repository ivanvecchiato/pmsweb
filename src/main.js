import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/design-system.css'
import { installApiTransportBridge } from './services/apiTransport'

await installApiTransportBridge()

const app = createApp(App)

app.use(router)

app.mount('#app')
