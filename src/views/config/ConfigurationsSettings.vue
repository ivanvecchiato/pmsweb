<template>
  <div class="settings-page">
    <div class="header">
      <h1>Configurazioni</h1>
      <p>Impostazioni generali del PMS.</p>
    </div>

    <section class="card">
      <h2>PMS</h2>
      <div class="params-grid">
        <label class="checkbox-stack">
          <span>PMS abilitato</span>
          <input v-model="form.enabled" type="checkbox" />
        </label>
      </div>
    </section>

    <div class="footer-actions">
      <button type="button" class="btn btn-secondary" @click="loadForm" :disabled="loading">Ricarica</button>
      <button type="button" class="btn btn-primary" @click="save" :disabled="loading">Salva Configurazioni</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const loading = ref(false)
const globalConfigs = ref({})
const form = ref({
  enabled: true
})

const normalizeBooleanLike = (value, defaultValue = true) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  }
  return defaultValue
}

const normalizePmsConfig = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    ...source,
    enabled: normalizeBooleanLike(source.enabled, true)
  }
}

const loadForm = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/configs')
    const configs = response?.data && typeof response.data === 'object' ? response.data : {}
    globalConfigs.value = configs
    form.value = normalizePmsConfig(configs.pms)
  } catch (error) {
    console.error('Errore caricamento configurazioni PMS:', error)
    alert('Errore caricamento configurazioni')
  } finally {
    loading.value = false
  }
}

const save = async () => {
  loading.value = true
  try {
    const currentPms = globalConfigs.value?.pms && typeof globalConfigs.value.pms === 'object'
      ? globalConfigs.value.pms
      : {}

    const nextConfigs = {
      ...globalConfigs.value,
      pms: {
        ...currentPms,
        enabled: normalizeBooleanLike(form.value.enabled, true)
      }
    }

    await axios.post('/api/configs', nextConfigs)
    globalConfigs.value = nextConfigs
    form.value = normalizePmsConfig(nextConfigs.pms)
    alert('Configurazioni salvate correttamente')
  } catch (error) {
    console.error('Errore salvataggio configurazioni PMS:', error)
    alert('Errore salvataggio configurazioni')
  } finally {
    loading.value = false
  }
}

onMounted(loadForm)
</script>

<style scoped>
.settings-page {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header h1 {
  margin: 0;
  color: #0f172a;
}

.header p {
  margin: 4px 0 0;
  color: #475569;
}

.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.card h2 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 1rem;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.checkbox-stack {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  background: #f8fafc;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  border: 0;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary {
  background: #0ea5e9;
  color: #ffffff;
}

.btn-secondary {
  background: #e2e8f0;
  color: #0f172a;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
