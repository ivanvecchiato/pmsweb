<template>
  <div class="login-container">
    <div class="login-shell">
      <section class="login-hero">
        <div class="hero-badge">MBAR PMS</div>
        <h1>Un’unica interfaccia per reception, bar e spiaggia.</h1>
        <p>
          Accesso rapido all’operativita giornaliera con un linguaggio visivo coerente,
          chiaro e orientato alla produttivita.
        </p>

        <div class="hero-notes">
          <article>
            <strong>Dashboard unificata</strong>
            <span>Prenotazioni, preventivi, stock e configurazioni nello stesso flusso.</span>
          </article>
          <article>
            <strong>Design morbido e leggibile</strong>
            <span>Superfici chiare, gerarchia forte e controlli consistenti.</span>
          </article>
        </div>
      </section>

      <section class="login-box">
        <div class="login-header">
          <div class="login-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 12.5 10 15.5 17 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" opacity="0.38"/>
            </svg>
          </div>
          <div>
            <h1>Accedi al sistema</h1>
            <p>Property Management System</p>
          </div>
        </div>

        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label>Utente</label>
            <input 
              v-model="username" 
              type="text" 
              placeholder="Inserisci username"
              class="form-input"
            >
            <small class="hint">Demo: admin, staff</small>
          </div>

          <div class="form-group">
            <label>Password</label>
            <input 
              v-model="password" 
              type="password" 
              placeholder="Inserisci password"
              class="form-input"
            >
            <small class="hint">Demo password: 123456</small>
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <button type="submit" class="btn-login">
            <span v-if="!isLoading">Accedi</span>
            <span v-else>Caricamento...</span>
          </button>
        </form>

        <div class="demo-info">
          <h3>Account Demo</h3>
          <div class="demo-user">
            <strong>Admin:</strong> admin / 123456
            <span class="badge admin">Accesso totale</span>
          </div>
          <div class="demo-user">
            <strong>Staff:</strong> staff / 123456
            <span class="badge staff">PMS + Configurazione</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'

const router = useRouter()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  errorMessage.value = ''
  isLoading.value = true

  await new Promise(resolve => setTimeout(resolve, 500))

  if (login(username.value, password.value)) {
    router.push('/')
  } else {
    errorMessage.value = 'Username o password non validi'
  }

  isLoading.value = false
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 32%),
    linear-gradient(180deg, #f3f8fd 0%, #e8f0f8 100%);
}

.login-shell {
  width: min(1120px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 440px);
  gap: 24px;
}

.login-hero,
.login-box {
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 26px 60px rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(24px);
}

.login-hero {
  padding: 42px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 640px;
}

.hero-badge {
  display: inline-flex;
  align-self: flex-start;
  border-radius: 999px;
  padding: 10px 16px;
  background: rgba(29, 140, 242, 0.12);
  color: var(--ds-primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.login-hero h1 {
  max-width: 10ch;
  margin: 22px 0 14px;
  font-size: clamp(2.6rem, 2rem + 1vw, 4.4rem);
  line-height: 0.95;
  letter-spacing: -0.07em;
  color: var(--ds-text);
}

.login-hero p {
  max-width: 48ch;
  margin: 0;
  color: var(--ds-text-soft);
  font-size: 1rem;
  line-height: 1.7;
}

.hero-notes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: auto;
  padding-top: 30px;
}

.hero-notes article {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 20px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.hero-notes strong {
  font-size: 0.98rem;
}

.hero-notes span {
  color: var(--ds-text-soft);
  line-height: 1.55;
}

.login-box {
  width: 100%;
  padding: 34px;
}

.login-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 30px;
}

.login-mark {
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 140, 242, 0.12);
  color: var(--ds-primary);
}

.login-mark svg {
  width: 25px;
  height: 25px;
}

.login-header h1 {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.05em;
  color: var(--ds-text);
  margin: 0 0 6px 0;
}

.login-header p {
  font-size: 14px;
  color: var(--ds-text-soft);
  margin: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--ds-text-soft);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.86);
}

.form-input:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.4);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.hint {
  display: block;
  font-size: 12px;
  color: var(--ds-text-muted);
  margin-top: 4px;
}

.error-message {
  background: rgba(220, 77, 77, 0.1);
  color: var(--ds-danger);
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 13px;
  margin-bottom: 16px;
  border: 1px solid rgba(220, 77, 77, 0.16);
}

.btn-login {
  width: 100%;
  min-height: 54px;
  padding: 12px;
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  border: none;
  border-radius: 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 24px;
  box-shadow: 0 18px 30px rgba(29, 140, 242, 0.22);
}

.btn-login:hover {
  background: linear-gradient(180deg, var(--ds-primary-strong), #0b63bb);
  transform: translateY(-2px);
  box-shadow: 0 24px 34px rgba(29, 140, 242, 0.25);
}

.btn-login:active {
  transform: translateY(0);
}

.demo-info {
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  padding-top: 20px;
}

.demo-info h3 {
  font-size: 13px;
  font-weight: 700;
  color: var(--ds-text-soft);
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.demo-user {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--ds-text-soft);
  padding: 12px 14px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.badge.admin {
  background: rgba(29, 140, 242, 0.12);
  color: var(--ds-primary-strong);
}

.badge.staff {
  background: rgba(39, 179, 106, 0.14);
  color: #1b7d4d;
}

@media (max-width: 960px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-hero {
    min-height: auto;
  }

  .hero-notes {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .login-container {
    padding: 14px;
  }

  .login-hero,
  .login-box {
    padding: 22px;
    border-radius: 24px;
  }

  .demo-user {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
