<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h1>🔐 PMS Login</h1>
        <p>Property Management System</p>
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
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.login-box {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
  padding: 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.login-header p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
}

.hint {
  display: block;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.error-message {
  background: #fee2e2;
  color: #dc2626;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 16px;
  border-left: 4px solid #dc2626;
}

.btn-login {
  width: 100%;
  padding: 12px;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 24px;
}

.btn-login:hover {
  background: #1565c0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
}

.btn-login:active {
  transform: translateY(0);
}

.demo-info {
  border-top: 1px solid #e5e7eb;
  padding-top: 20px;
}

.demo-info h3 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.demo-user {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
  padding: 8px;
  margin-bottom: 8px;
  background: #f9fafb;
  border-radius: 6px;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.badge.admin {
  background: #dbeafe;
  color: #1e40af;
}

.badge.staff {
  background: #dcfce7;
  color: #166534;
}
</style>
