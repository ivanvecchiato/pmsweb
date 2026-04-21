import { ref, computed } from 'vue'

const PMS_API_BASE_URL = import.meta.env.VITE_PMS_API_BASE_URL || 'http://localhost:8081'

const rolePermissions = {
  admin: ['home', 'customers', 'beach-bookings', 'inventory', 'stats', 'listino', 'listino_beach', 'onda_push_products'],
  staff: ['home', 'customers', 'beach-bookings', 'listino', 'listino_beach', 'onda_push_products']
}

const currentUser = ref(null)
const pmsType = ref(null)
const pmsEnabled = ref(false)
const pmsIntegrationType = ref(null)

const normalizePmsType = (type) => {
  if (!type || typeof type !== 'string') return null
  const normalized = type.toLowerCase()
  if (normalized === 'hotel' || normalized === 'beach') return normalized
  return null
}

const normalizeIntegrationType = (type) => {
  if (!type || typeof type !== 'string') return null
  return type
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim()
}

const parsePmsEnabled = (payload) => {
  const value = payload?.pmsEnabled ?? payload?.enabled ?? payload?.active ?? payload?.isActive ?? payload?.pms?.enabled
  return value === true
}

const parseIntegrationType = (payload) => {
  return normalizeIntegrationType(
    payload?.pmsIntegrationType ||
      payload?.integrationType ||
      payload?.pmsTypeName ||
      payload?.pmsName ||
      payload?.provider ||
      payload?.pms?.type
  )
}

const loadStoredPmsType = () => {
  const stored = localStorage.getItem('pms_type')
  pmsType.value = normalizePmsType(stored)

  const storedEnabled = localStorage.getItem('pms_enabled')
  pmsEnabled.value = storedEnabled === 'true'

  const storedIntegrationType = localStorage.getItem('pms_integration_type')
  pmsIntegrationType.value = normalizeIntegrationType(storedIntegrationType)
}

const loadUser = () => {
  const stored = localStorage.getItem('pms_user')
  if (stored) {
    currentUser.value = JSON.parse(stored)
  }
}

const loadPmsType = async (forceRefresh = false) => {
  try {
    const response = await fetch(`${PMS_API_BASE_URL}/api/pms/getpmstype`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const backendType = normalizePmsType(data?.type || data?.pmsType || data?.pms?.mode)
    pmsEnabled.value = parsePmsEnabled(data)
    pmsIntegrationType.value = parseIntegrationType(data)
    pmsType.value = backendType || 'hotel'
  } catch (error) {
    pmsType.value = pmsType.value || 'hotel'
    pmsEnabled.value = false
    pmsIntegrationType.value = null
    console.warn('Unable to load PMS type from backend:', error)
  }

  localStorage.setItem('pms_type', pmsType.value)
  localStorage.setItem('pms_enabled', String(pmsEnabled.value))
  localStorage.setItem('pms_integration_type', pmsIntegrationType.value || '')
  return pmsType.value
}

const login = (username, password) => {
  const validUsers = {
    admin: { role: 'admin', name: 'Amministratore' },
    staff: { role: 'staff', name: 'Staff' }
  }

  if (validUsers[username] && password === '123456') {
    currentUser.value = {
      username,
      role: validUsers[username].role,
      name: validUsers[username].name,
      loginTime: new Date()
    }
    localStorage.setItem('pms_user', JSON.stringify(currentUser.value))
    loadPmsType(true)
    return true
  }
  return false
}

const logout = () => {
  currentUser.value = null
  localStorage.removeItem('pms_user')
  localStorage.removeItem('pms_type')
  localStorage.removeItem('pms_enabled')
  localStorage.removeItem('pms_integration_type')
  pmsType.value = null
  pmsEnabled.value = false
  pmsIntegrationType.value = null
}

const hasPermission = (page) => {
  if (!currentUser.value) return false
  const permissions = rolePermissions[currentUser.value.role] || []
  return permissions.includes(page)
}

const isPmsTypeAllowed = (allowedTypes) => {
  if (!allowedTypes || allowedTypes.length === 0) return true
  if (!pmsType.value) return false
  return allowedTypes.includes(pmsType.value)
}

const isAuthenticated = computed(() => currentUser.value !== null)
const userRole = computed(() => currentUser.value?.role)
const userName = computed(() => currentUser.value?.name)
const isHotelPms = computed(() => pmsType.value === 'hotel')
const isBeachPms = computed(() => pmsType.value === 'beach')
const isHospitalityStudioPms = computed(() => pmsIntegrationType.value === 'hospitality studio')
const canShowHotelBeachMenus = computed(() => pmsEnabled.value && isHospitalityStudioPms.value)

loadUser()
loadStoredPmsType()

if (currentUser.value) {
  loadPmsType()
}

export const useAuth = () => ({
  currentUser,
  isAuthenticated,
  pmsType,
  pmsEnabled,
  pmsIntegrationType,
  isHotelPms,
  isBeachPms,
  isHospitalityStudioPms,
  canShowHotelBeachMenus,
  userRole,
  userName,
  login,
  loadPmsType,
  logout,
  hasPermission,
  isPmsTypeAllowed,
  rolePermissions
})
