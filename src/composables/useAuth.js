import { ref, computed } from 'vue'

const rolePermissions = {
  admin: ['home', 'customers', 'beach-bookings', 'inventory', 'stats', 'listino', 'listino_beach'],
  staff: ['home', 'customers', 'beach-bookings', 'listino', 'listino_beach']
}

const currentUser = ref(null)

const loadUser = () => {
  const stored = localStorage.getItem('pms_user')
  if (stored) {
    currentUser.value = JSON.parse(stored)
  }
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
    return true
  }
  return false
}

const logout = () => {
  currentUser.value = null
  localStorage.removeItem('pms_user')
}

const hasPermission = (page) => {
  if (!currentUser.value) return false
  const permissions = rolePermissions[currentUser.value.role] || []
  return permissions.includes(page)
}

const isAuthenticated = computed(() => currentUser.value !== null)
const userRole = computed(() => currentUser.value?.role)
const userName = computed(() => currentUser.value?.name)

loadUser()

export const useAuth = () => ({
  currentUser,
  isAuthenticated,
  userRole,
  userName,
  login,
  logout,
  hasPermission,
  rolePermissions
})
