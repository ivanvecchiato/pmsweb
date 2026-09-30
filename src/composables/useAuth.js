import { ref, computed } from 'vue'

const PMS_API_BASE_URL = import.meta.env.VITE_PMS_API_BASE_URL || ''
const AUTH_SESSION_HOURS = Number(import.meta.env.VITE_AUTH_SESSION_HOURS) || 12
const AUTH_SESSION_DURATION = AUTH_SESSION_HOURS * 60 * 60 * 1000

const rolePermissions = {
  admin: ['inventory', 'stats', 'listino', 'listino_beach', 'onda_push_products', 'users', 'daily_close'],
  staff: []
}

const adminPermissions = ['listino', 'listino_beach', 'onda_push_products', 'users']
const pmsPermissions = ['home', 'customers', 'beach-bookings']

const currentUser = ref(null)
const modules = ref({ hotel: { enabled: false, providerType: null }, beach: { enabled: false } })
let pmsTypeRequest = null

const fetchJson = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

const getLoginUsers = async () => {
  const users = await fetchJson(`${PMS_API_BASE_URL}/api/pms/web-users`)
  if (!Array.isArray(users)) return []

  return users
    .filter((user) => user && user.enabled !== false && user.active !== false)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it'))
}

const loadUser = () => {
  const stored = localStorage.getItem('pms_user')
  if (stored) {
    try {
      const user = JSON.parse(stored)
      if (user.token && Number(user.expiresAt) > Date.now()) {
        currentUser.value = user
      } else {
        localStorage.removeItem('pms_user')
      }
    } catch {
      localStorage.removeItem('pms_user')
    }
  }
}

const loadPmsType = async (forceRefresh = false) => {
  if (!forceRefresh && pmsTypeRequest) {
    return pmsTypeRequest
  }

  pmsTypeRequest = (async () => {
    try {
      const data = await fetchJson(`${PMS_API_BASE_URL}/api/pms/getpmstype`)
      if (typeof data?.hotel?.enabled !== 'boolean' || typeof data?.beach?.enabled !== 'boolean') {
        throw new Error('Configurazione moduli non valida')
      }
      modules.value = { hotel: data.hotel, beach: data.beach }
    } catch (error) {
      modules.value = { hotel: { enabled: false, providerType: null }, beach: { enabled: false } }
      console.warn('Unable to load modules from backend:', error)
    }
    return modules.value
  })()

  try {
    return await pmsTypeRequest
  } finally {
    pmsTypeRequest = null
  }
}

const login = async (user, pin) => {
  const normalizedPin = String(pin ?? '').trim()
  if (user && normalizedPin) {
    const response = await fetch(`${PMS_API_BASE_URL}/api/pms/web-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, pin: normalizedPin })
    })
    if (!response.ok) return false
    const data = await response.json()
    const isAdmin = data.user.permissions?.admin === true
    currentUser.value = {
      id: data.user.id,
      username: String(data.user.name || '').toLowerCase(),
      role: isAdmin ? 'admin' : 'staff',
      name: data.user.name,
      permissions: data.user.permissions?.web || {},
      token: data.token,
      loginTime: new Date().toISOString(),
      expiresAt: data.expiresAt || Date.now() + AUTH_SESSION_DURATION
    }
    localStorage.setItem('pms_user', JSON.stringify(currentUser.value))
    await loadPmsType(true)
    return true
  }
  return false
}

const logout = () => {
  currentUser.value = null
  localStorage.removeItem('pms_user')
  modules.value = { hotel: { enabled: false, providerType: null }, beach: { enabled: false } }
}

const validateSession = () => {
  if (!currentUser.value) return false
  if (Number(currentUser.value.expiresAt) > Date.now()) return true

  logout()
  return false
}

const hasPermission = (page) => {
  if (!currentUser.value) return false
  if (currentUser.value.role === 'admin') return true
  if (adminPermissions.includes(page) && currentUser.value.role !== 'admin') return false
  if (pmsPermissions.includes(page)) return true
  if (currentUser.value.permissions?.[page] === true) return true
  const permissions = rolePermissions[currentUser.value.role] || []
  return permissions.includes(page)
}

const isPmsTypeAllowed = (allowedTypes) => {
  if (!allowedTypes || allowedTypes.length === 0) return true
  return allowedTypes.some(type => modules.value[type]?.enabled === true)
}

const isAuthenticated = computed(() => currentUser.value !== null)
const userRole = computed(() => currentUser.value?.role)
const userName = computed(() => currentUser.value?.name)
const isHotelPms = computed(() => modules.value.hotel.enabled)
const isBeachPms = computed(() => modules.value.beach.enabled)
const pmsIntegrationType = computed(() => modules.value.hotel.providerType)
const canShowHotelBeachMenus = computed(() => isHotelPms.value || isBeachPms.value)

loadUser()

if (currentUser.value) {
  loadPmsType()
}

export const useAuth = () => ({
  currentUser,
  isAuthenticated,
  modules,
  pmsIntegrationType,
  isHotelPms,
  isBeachPms,
  canShowHotelBeachMenus,
  userRole,
  userName,
  getLoginUsers,
  login,
  loadPmsType,
  logout,
  validateSession,
  hasPermission,
  isPmsTypeAllowed,
  rolePermissions
})
