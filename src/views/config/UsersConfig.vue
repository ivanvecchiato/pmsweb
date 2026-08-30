<template>
  <div class="users-page">
    <div class="page-actions">
      <p>Gestisci gli accessi condivisi tra PmsWeb, Mood e GeminiPOS.</p>
      <button type="button" class="primary-button" @click="editUser()">Nuovo utente</button>
    </div>

    <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>
    <div v-if="successMessage" class="message success">{{ successMessage }}</div>

    <div class="users-grid">
      <button v-for="user in users" :key="user.id" type="button" class="user-row" @click="editUser(user)">
        <span class="avatar" :style="getAvatarStyle(user.color)">{{ initials(user.name) }}</span>
        <span class="identity"><strong>{{ user.name }}</strong><small>ID {{ user.id }}</small></span>
        <span class="apps">
          <small v-if="user.access?.pmsweb">Web</small>
          <small v-if="user.access?.mood">Mood</small>
          <small v-if="user.access?.geminipos">POS</small>
        </span>
        <span :class="['status', { disabled: user.active === false }]">{{ user.active === false ? 'Disattivo' : 'Attivo' }}</span>
      </button>
    </div>

    <div v-if="form" class="modal-backdrop" @click.self="form = null">
      <form class="editor" @submit.prevent="save">
        <div class="editor-header">
          <div><small>{{ form.id ? `ID ${form.id}` : 'Nuova identità' }}</small><h2>{{ form.id ? 'Modifica utente' : 'Nuovo utente' }}</h2></div>
          <button type="button" class="close-button" aria-label="Chiudi" @click="form = null">×</button>
        </div>

        <div class="fields">
          <label>Nome<input v-model="form.name" required autofocus></label>
          <label>PIN<input v-model="form.code" inputmode="numeric" pattern="[0-9]*" :placeholder="form.id ? 'Lascia vuoto per non modificarlo' : 'PIN numerico'" :required="!form.id"></label>
        </div>

        <div v-if="form.permissions.globalAdmin" class="admin-summary">
          <strong>Global Admin</strong>
          <span>Accesso completo a PmsWeb, Mood e GeminiPOS. Tutti i permessi sono assegnati automaticamente.</span>
        </div>

        <section v-if="!form.permissions.globalAdmin">
          <h3>Stato e applicazioni</h3>
          <div class="checks">
            <label><input v-model="form.active" type="checkbox"> Utente attivo</label>
            <label><input v-model="form.pinEnabled" type="checkbox"> PIN abilitato</label>
            <label><input v-model="form.access.pmsweb" type="checkbox" :disabled="form.access.mood"> PmsWeb</label>
            <label><input v-model="form.access.mood" type="checkbox"> Mood</label>
            <label><input v-model="form.access.geminipos" type="checkbox"> GeminiPOS</label>
          </div>
          <small v-if="form.access.mood" class="note">Mood richiede automaticamente l’accesso PmsWeb.</small>
        </section>

        <section v-if="!form.permissions.globalAdmin && form.access.pmsweb" class="permissions">
          <h3>Permessi PmsWeb</h3>
          <label v-for="permission in webPermissions" :key="permission.key"><input v-model="form.permissions.web[permission.key]" type="checkbox"> {{ permission.label }}</label>
        </section>

        <section v-if="!form.permissions.globalAdmin && form.access.mood" class="permissions">
          <h3>Permessi Mood</h3>
          <label><input v-model="form.permissions.mood.daily_close" type="checkbox"> Chiusura conti</label>
          <label><input v-model="form.permissions.mood.delete_account" type="checkbox"> Eliminazione conti</label>
        </section>

        <section v-if="!form.permissions.globalAdmin && form.access.geminipos" class="permissions">
          <h3>Permessi GeminiPOS</h3>
          <label><input v-model="form.permissions.geminipos.daily_close" type="checkbox"> Chiusura fiscale</label>
          <label><input v-model="form.permissions.geminipos.delete_account" type="checkbox"> Eliminazione conti</label>
          <label><input v-model="form.permissions.geminipos.handle_sessions" type="checkbox"> Gestione sessioni</label>
        </section>

        <div class="editor-actions">
          <button type="button" class="secondary-button" @click="form = null">Annulla</button>
          <button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Salvataggio...' : 'Salva utente' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { currentUser, logout } = useAuth()
const apiBaseUrl = import.meta.env.VITE_PMS_API_BASE_URL || ''
const users = ref([])
const form = ref(null)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const webPermissions = [
  { key: 'inventory', label: 'Magazzino e prodotti' }, { key: 'stats', label: 'Statistiche' },
  { key: 'daily_close', label: 'Chiusura giornaliera' }
]
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.value.token}` })
const initials = name => String(name || '').split(' ').filter(Boolean).slice(0, 2).map(value => value[0]).join('').toUpperCase()
const getAvatarStyle = color => {
  const hex = String(color || '').trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255
  return {
    backgroundColor: color,
    color: luminance < 0.55 ? '#ffffff' : `rgb(${Math.round(red * 0.38)}, ${Math.round(green * 0.38)}, ${Math.round(blue * 0.38)})`,
    textShadow: luminance < 0.55 ? '0 1px 2px rgba(0, 0, 0, 0.24)' : 'none'
  }
}

const load = async () => {
  const response = await fetch(`${apiBaseUrl}/api/pms/users`, { headers: headers() })
  if (response.status === 401 || response.status === 403) {
    logout()
    await router.replace('/login')
    throw new Error('Sessione non valida. Accedi nuovamente.')
  }
  if (!response.ok) throw new Error('Impossibile caricare gli utenti')
  users.value = await response.json()
}
const editUser = user => {
  const value = user ? JSON.parse(JSON.stringify(user)) : { name: '', code: '', active: true, pinEnabled: true, access: { pmsweb: true, mood: false, geminipos: false }, permissions: { web: {}, mood: {}, geminipos: {} }, areas: [] }
  value.code = ''
  value.access ||= { pmsweb: false, mood: false, geminipos: false }
  value.permissions ||= { web: {}, mood: {}, geminipos: {} }
  value.permissions.web ||= {}
  value.permissions.mood ||= {}
  value.permissions.geminipos ||= {}
  form.value = value
}
watch(() => form.value?.access?.mood, value => { if (value && form.value) form.value.access.pmsweb = true })
const save = async () => {
  saving.value = true; errorMessage.value = ''; successMessage.value = ''
  try {
    const response = await fetch(`${apiBaseUrl}/api/pms/users`, { method: 'POST', headers: headers(), body: JSON.stringify(form.value) })
    if (response.status === 401 || response.status === 403) {
      logout()
      await router.replace('/login')
      throw new Error('Sessione non valida. Accedi nuovamente.')
    }
    if (!response.ok) throw new Error((await response.json()).error || 'Salvataggio non riuscito')
    await load(); form.value = null; successMessage.value = 'Utente salvato'
  } catch (error) { errorMessage.value = error.message } finally { saving.value = false }
}
onMounted(() => load().catch(error => { errorMessage.value = error.message }))
</script>

<style scoped>
.users-page{display:grid;gap:18px}.page-actions{display:flex;align-items:center;justify-content:space-between}.page-actions p{margin:0;color:var(--ds-text-soft)}.primary-button,.secondary-button{border:0;border-radius:14px;padding:12px 18px;font-weight:700;cursor:pointer}.primary-button{background:var(--ds-primary);color:white}.secondary-button{background:#eef3f8;color:var(--ds-text)}.users-grid{display:grid;gap:9px}.user-row{display:flex;align-items:center;gap:14px;width:100%;padding:14px;border:1px solid rgba(148,163,184,.2);border-radius:18px;background:rgba(255,255,255,.8);text-align:left;cursor:pointer}.user-row:hover{border-color:rgba(29,140,242,.35);transform:translateY(-1px)}.avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:rgba(29,140,242,.12);color:var(--ds-primary);font-weight:800;text-shadow:0 1px 2px rgba(255,255,255,.75)}.identity{display:flex;flex-direction:column}.identity small,.page-actions p,.note{color:var(--ds-text-soft)}.apps{display:flex;gap:6px;margin-left:auto}.apps small,.status{padding:5px 9px;border-radius:999px;background:rgba(29,140,242,.1);font-weight:700}.status.disabled{background:rgba(220,77,77,.1);color:var(--ds-danger)}.modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(30,41,59,.38);backdrop-filter:blur(8px)}.editor{width:min(720px,100%);max-height:calc(100vh - 48px);overflow:auto;display:grid;gap:20px;padding:26px;border-radius:24px;background:white;box-shadow:0 28px 80px rgba(15,23,42,.24)}.editor-header{display:flex;align-items:flex-start;justify-content:space-between}.editor-header h2{margin:3px 0 0}.editor-header small{color:var(--ds-text-muted)}.close-button{border:0;background:transparent;font-size:30px;line-height:1;cursor:pointer}.fields,.checks,.permissions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.admin-summary{display:flex;flex-direction:column;gap:6px;padding:16px 18px;border:1px solid rgba(29,140,242,.2);border-radius:16px;background:rgba(29,140,242,.08)}.admin-summary strong{color:var(--ds-primary-strong)}.admin-summary span{color:var(--ds-text-soft);line-height:1.45}.editor section{display:grid;gap:12px;padding-top:4px}.editor section h3{margin:0}.editor label{display:grid;gap:6px;font-weight:700}.editor input:not([type=checkbox]){padding:12px;border:1px solid rgba(148,163,184,.3);border-radius:12px}.checks label,.permissions label{display:flex;align-items:center;gap:8px}.permissions h3{grid-column:1/-1}.editor-actions{position:sticky;bottom:-26px;display:flex;justify-content:flex-end;gap:10px;margin:0 -26px -26px;padding:16px 26px;background:white;border-top:1px solid rgba(148,163,184,.18)}.message{padding:12px;border-radius:12px}.error{background:rgba(220,77,77,.1);color:var(--ds-danger)}.success{background:rgba(39,179,106,.12);color:#187648}@media(max-width:700px){.apps{display:none}.fields,.checks,.permissions{grid-template-columns:1fr}.modal-backdrop{padding:10px}.editor{max-height:calc(100vh - 20px);padding:20px}.editor-actions{bottom:-20px;margin:0 -20px -20px;padding:14px 20px}}
</style>
