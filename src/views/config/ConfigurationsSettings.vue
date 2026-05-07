<template>
  <div class="settings-page">
    <div class="header">
      <h1>Configurazioni</h1>
      <p>Impostazioni generali del PMS in una vista coerente con la nuova shell operativa.</p>
    </div>

    <section class="card">
      <div class="card-heading">
        <div>
          <h2>PMS</h2>
          <p>Attiva o disattiva il modulo centrale dell’applicazione.</p>
        </div>
        <span class="status-pill" :class="{ active: form.enabled }">
          {{ form.enabled ? 'Attivo' : 'Disattivato' }}
        </span>
      </div>
      <div class="params-grid">
        <label class="checkbox-stack">
          <div>
            <strong>PMS abilitato</strong>
            <small>Consente l’accesso alle viste operative principali.</small>
          </div>
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
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header p {
  margin: 8px 0 0;
}

.card {
  border-radius: 28px;
  padding: 24px;
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.card h2 {
  margin: 0;
  color: var(--ds-text);
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.card-heading p {
  margin: 6px 0 0;
  color: var(--ds-text-soft);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(220, 77, 77, 0.1);
  color: var(--ds-danger);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-pill.active {
  background: rgba(39, 179, 106, 0.12);
  color: var(--ds-success);
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.checkbox-stack {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.checkbox-stack strong {
  display: block;
  margin-bottom: 4px;
}

.checkbox-stack small {
  color: var(--ds-text-soft);
  line-height: 1.5;
}

.checkbox-stack input {
  width: 22px;
  height: 22px;
  accent-color: var(--ds-primary);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  border: 0;
  border-radius: 18px;
  min-height: 48px;
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 700;
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #ffffff;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.84);
  color: var(--ds-text);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .card-heading,
  .footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .checkbox-stack {
    align-items: flex-start;
  }
}
</style>
