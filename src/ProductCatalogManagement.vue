<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { collection, deleteDoc, doc, getDocs, query as buildFsQuery, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { getFirebaseDb, isFirebaseRemoteMode } from './services/firebaseClient'

const PRODUCTS_ENDPOINT = '/api/products'
const VARIANTS_ENDPOINT = '/api/variants'
const CONFIGS_ENDPOINT = '/api/configs'
const FAVORITES_ENDPOINT = '/api/favorites'
const FIREBASE_FAVORITES_COLLECTION = import.meta.env.VITE_FIREBASE_FAVORITES_COLLECTION || 'preferiti'
const FIREBASE_DEVICES_COLLECTION = import.meta.env.VITE_FIREBASE_DEVICES_COLLECTION || import.meta.env.VITE_FIREBASE_STATS_DEVICES_COLLECTION || 'devices'
const DEFAULT_PRODUCTS_ORIGIN = import.meta.env.DEV ? 'http://localhost:8088' : window.location.origin
const PRODUCTS_ORIGIN = (import.meta.env.VITE_API_TARGET_ORIGIN || DEFAULT_PRODUCTS_ORIGIN).replace(/\/+$/, '')
const USE_FIREBASE_DIRECT_SYNC = isFirebaseRemoteMode()

const categories = ref([])
const variantFamilies = ref([])
const activeTab = ref('products')
const selectedCategory = ref('')
const searchQuery = ref('')
const loading = ref(false)
const loadingVariants = ref(false)
const loadingFavorites = ref(false)
const savingVariantsConfig = ref(false)
const savingFavoritesConfig = ref(false)
const errorMessage = ref('')
const saveMessage = ref('')
const variantsConfigMessage = ref('')
const variantsConfigError = ref('')
const favoritesConfigMessage = ref('')
const favoritesConfigError = ref('')
const brokenImages = ref({})

const isDialogOpen = ref(false)
const saving = ref(false)
const editingProduct = ref(null)
const isCreatingProduct = ref(false)
const form = ref({
  id: '',
  name: '',
  price: 0,
  purchase_price: 0,
  imageUrl: '',
  color: '#1976d2',
  category: '',
  variantFamilyId: '',
  inventoryEnabled: false,
  auto: false,
  variants: {
    auto: false,
    vars: []
  },
  labels: []
})

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
  }
  return false
}

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const emptyVariants = () => ({
  auto: false,
  vars: []
})

const normalizeLabelValue = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

const normalizeLabelsPayload = (rawLabels) => {
  const labelsRaw = Array.isArray(rawLabels) ? rawLabels : []

  const deduped = []
  const seen = new Set()

  labelsRaw.forEach((entry) => {
    const normalized = normalizeLabelValue(entry)
    const dedupeKey = normalized.toLowerCase()
    if (!normalized || seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    deduped.push(normalized)
  })

  return deduped
}

const normalizeInventoryPayload = (rawInventory, fallbackEnabled = false) => {
  const source = rawInventory && typeof rawInventory === 'object' ? rawInventory : {}
  return {
    enabled: toBoolean(source.enabled ?? source.enable ?? source.active ?? source.inventoryEnabled ?? fallbackEnabled),
    stock: toSafeNumber(source.stock, 0),
    alarm: toSafeNumber(source.alarm, 0)
  }
}

const normalizeVariantsPayload = (rawVariants, fallbackAuto = false) => {
  const source = rawVariants && typeof rawVariants === 'object' ? rawVariants : {}
  const varsRaw = Array.isArray(source.vars)
    ? source.vars
    : Array.isArray(source.variants)
      ? source.variants
      : []

  const auto = toBoolean(source.auto ?? source.audo ?? fallbackAuto)
  const vars = varsRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null

      const id = entry.id ?? entry.variantId
      if (id === null || id === undefined || id === '') return null

      const familyId = entry.family?.id ?? entry.familyId ?? entry.family_id ?? null
      const familyName = String(entry.family?.name ?? entry.familyName ?? entry.family_name ?? '').trim()
      const color = String(entry.color ?? '#FFFFFF').trim() || '#FFFFFF'

      return {
        id: toSafeNumber(id, id),
        name: String(entry.name ?? entry.variantName ?? '').trim(),
        price: toSafeNumber(entry.price, 0),
        color,
        family: {
          id: familyId === null || familyId === undefined || familyId === '' ? null : toSafeNumber(familyId, familyId),
          name: familyName
        }
      }
    })
    .filter((entry) => entry && entry.name)

  return {
    auto,
    vars
  }
}

const normalizeVariantFamilies = (payload) => {
  const rawFamilies = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.variants)
      ? payload.variants
      : []

  return rawFamilies
    .map((family) => {
      const id = family?.familyId ?? family?.id
      const name = String(family?.familyName ?? family?.name ?? '').trim()
      const variants = Array.isArray(family?.variants)
        ? family.variants
          .map((variant) => {
            const variantId = variant?.id ?? variant?.variantId
            if (variantId === null || variantId === undefined || variantId === '') return null

            return {
              id: toSafeNumber(variantId, variantId),
              name: String(variant?.name ?? variant?.label ?? '').trim(),
              price: toSafeNumber(variant?.price, 0),
              color: String(variant?.color ?? '#FFFFFF').trim() || '#FFFFFF'
            }
          })
          .filter((variant) => variant && variant.name)
        : []

      if ((id === null || id === undefined || id === '') || !name) return null

      return {
        id: toSafeNumber(id, id),
        name,
        variants
      }
    })
    .filter((family) => family && family.variants.length > 0)
}

const variantsConfigFamilies = ref([])
const newFamilyName = ref('')
const devices = ref([])
const favoritesByDevice = ref({})
const originalFavoritesByDevice = ref({})
const selectedFavoritesDeviceId = ref('')
const favoritesProductSearch = ref('')

const cloneVariantFamilies = (families) => families.map((family) => ({
  id: family.id,
  name: family.name,
  variants: (Array.isArray(family.variants) ? family.variants : []).map((variant) => ({
    id: variant.id,
    name: variant.name,
    price: toSafeNumber(variant.price, 0),
    color: variant.color || '#FFFFFF'
  }))
}))

const getNextFamilyId = () => {
  const maxId = variantsConfigFamilies.value.reduce((max, family) => {
    const id = Number(family.id)
    return Number.isFinite(id) && id > max ? id : max
  }, 0)
  return maxId + 1
}

const getNextVariantId = () => {
  const allVariants = variantsConfigFamilies.value.flatMap((family) => Array.isArray(family.variants) ? family.variants : [])
  const maxId = allVariants.reduce((max, variant) => {
    const id = Number(variant.id)
    return Number.isFinite(id) && id > max ? id : max
  }, 0)
  return maxId + 1
}

const addVariantFamily = () => {
  const name = newFamilyName.value.trim()
  if (!name) {
    variantsConfigError.value = 'Inserisci un nome famiglia.'
    variantsConfigMessage.value = ''
    return
  }

  const duplicate = variantsConfigFamilies.value.some((family) => family.name.toLowerCase() === name.toLowerCase())
  if (duplicate) {
    variantsConfigError.value = 'Esiste già una famiglia con questo nome.'
    variantsConfigMessage.value = ''
    return
  }

  variantsConfigFamilies.value.push({
    id: getNextFamilyId(),
    name,
    variants: []
  })
  newFamilyName.value = ''
  variantsConfigError.value = ''
}

const removeVariantFamily = (familyId) => {
  variantsConfigFamilies.value = variantsConfigFamilies.value.filter((family) => String(family.id) !== String(familyId))
}

const addVariantToFamily = (familyId) => {
  const family = variantsConfigFamilies.value.find((item) => String(item.id) === String(familyId))
  if (!family) return

  family.variants.push({
    id: getNextVariantId(),
    name: '',
    price: 0,
    color: '#FFFFFF'
  })
}

const removeVariantFromFamily = (familyId, variantId) => {
  const family = variantsConfigFamilies.value.find((item) => String(item.id) === String(familyId))
  if (!family) return
  family.variants = family.variants.filter((variant) => String(variant.id) !== String(variantId))
}

const sanitizeVariantsConfigPayload = () => {
  return variantsConfigFamilies.value
    .map((family) => ({
      familyId: toSafeNumber(family.id, family.id),
      familyName: String(family.name || '').trim(),
      variants: (Array.isArray(family.variants) ? family.variants : [])
        .map((variant) => ({
          id: toSafeNumber(variant.id, variant.id),
          name: String(variant.name || '').trim(),
          price: toSafeNumber(variant.price, 0),
          color: String(variant.color || '#FFFFFF').trim() || '#FFFFFF'
        }))
        .filter((variant) => variant.name)
    }))
    .filter((family) => family.familyName)
}

const saveVariantsConfiguration = async () => {
  const payload = sanitizeVariantsConfigPayload()
  if (!payload.length) {
    variantsConfigError.value = 'Aggiungi almeno una famiglia varianti valida.'
    variantsConfigMessage.value = ''
    return
  }

  savingVariantsConfig.value = true
  variantsConfigError.value = ''
  variantsConfigMessage.value = ''

  try {
    const res = await axios.post(VARIANTS_ENDPOINT, { families: payload })
    const normalized = normalizeVariantFamilies(res.data)
    variantFamilies.value = normalized
    variantsConfigFamilies.value = cloneVariantFamilies(normalized)
    variantsConfigMessage.value = 'Configurazione varianti salvata con successo.'
  } catch (error) {
    console.error('Errore salvataggio configurazione varianti', error)
    variantsConfigError.value = 'Salvataggio configurazione varianti non riuscito.'
  } finally {
    savingVariantsConfig.value = false
  }
}

const normalizeCategoryName = (item) => {
  if (!item || typeof item !== 'object') return ''
  const directName = item.name
    ?? item.category
    ?? item.category_name
    ?? item.categoryName
    ?? item.categoria
    ?? item.description
    ?? item.title

  if (typeof directName === 'string' && directName.trim()) return directName.trim()

  const nestedName = item.category?.name
    ?? item.category?.description
    ?? item.categoria?.name
    ?? item.categoria?.description

  if (typeof nestedName === 'string' && nestedName.trim()) return nestedName.trim()
  return ''
}

const inferCategoryFromProducts = (productsRaw) => {
  if (!Array.isArray(productsRaw) || !productsRaw.length) return ''

  for (const product of productsRaw) {
    if (!product || typeof product !== 'object') continue

    const candidate = product.category
      ?? product.categoryName
      ?? product.categoria
      ?? product.category_description
      ?? product.categoryDesc

    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()

    const nested = product.category?.name
      ?? product.category?.description
      ?? product.categoria?.name
      ?? product.categoria?.description

    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }

  return ''
}

const normalizeProduct = (product, categoryName) => {
  const id = product?.id ?? product?._id ?? product?.productId ?? null
  const rawColor = String(product?.color ?? product?.hexColor ?? product?.category_color ?? '').trim()
  const color = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(rawColor) ? rawColor : ''
  const rawImage = String(product?.imgUrl ?? product?.imageUrl ?? product?.image ?? product?.thumb ?? product?.thumbnail ?? '').trim()
  const imageUrl = (() => {
    if (!rawImage) return ''
    if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) return rawImage
    if (rawImage.startsWith('data:') || rawImage.startsWith('blob:')) return rawImage
    return `${PRODUCTS_ORIGIN}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
  })()

  const normalizedVariants = normalizeVariantsPayload(product?.variants, product?.auto ?? product?.audo)
  const normalizedInventory = normalizeInventoryPayload(product?.inventory, product?.inventoryEnabled)
  const normalizedLabels = normalizeLabelsPayload(product?.labels)

  return {
    id,
    name: String(product?.name ?? product?.productName ?? product?.description ?? product?.title ?? '').trim(),
    price: Number(product?.price ?? product?.sell_price ?? product?.listPrice ?? 0) || 0,
    purchase_price: Number(product?.purchase_price ?? product?.purchasePrice ?? product?.cost ?? 0) || 0,
    imageUrl,
    color,
    category: categoryName,
    inventory: normalizedInventory,
    inventoryEnabled: normalizedInventory.enabled,
    auto: normalizedVariants.auto,
    variants: normalizedVariants,
    labels: normalizedLabels
  }
}

const normalizeResponse = (payload) => {
  const rawCategories = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.prodotti)
      ? payload.prodotti
    : Array.isArray(payload?.categories)
      ? payload.categories
      : []

  return rawCategories
    .map((category) => {
      const productsRaw = Array.isArray(category?.products)
        ? category.products
        : Array.isArray(category?.items)
          ? category.items
          : Array.isArray(category?.productList)
            ? category.productList
            : []

      const inferredName = inferCategoryFromProducts(productsRaw)
      const name = normalizeCategoryName(category) || inferredName

      const products = productsRaw
        .map((product) => normalizeProduct(product, name || 'Categoria'))
        .filter((product) => product.id !== null && product.id !== undefined && product.name)

      return {
        id: category?.id ?? category?.categoryId ?? null,
        name: name || 'Categoria',
        products
      }
    })
    .filter((category) => category.products.length > 0)
}

const fetchProducts = async () => {
  loading.value = true
  errorMessage.value = ''
  brokenImages.value = {}

  try {
    const res = await axios.get(PRODUCTS_ENDPOINT)
    categories.value = normalizeResponse(res.data)

    if (!categories.value.length) {
      selectedCategory.value = ''
      return
    }

    const exists = categories.value.some((category) => category.name === selectedCategory.value)
    if (!exists) {
      selectedCategory.value = categories.value[0].name
    }
  } catch (error) {
    console.error('Errore caricamento anagrafiche prodotti', error)
    categories.value = []
    selectedCategory.value = ''
    errorMessage.value = 'Impossibile caricare le anagrafiche prodotto.'
  } finally {
    loading.value = false
  }
}

const fetchVariantFamilies = async () => {
  loadingVariants.value = true

  try {
    const res = await axios.get(VARIANTS_ENDPOINT)
    const normalized = normalizeVariantFamilies(res.data)
    variantFamilies.value = normalized
    variantsConfigFamilies.value = cloneVariantFamilies(normalized)
  } catch (error) {
    console.error('Errore caricamento varianti', error)
    variantFamilies.value = []
    variantsConfigFamilies.value = []
  } finally {
    loadingVariants.value = false
  }
}

const normalizeDevice = (device) => {
  if (!device || typeof device !== 'object') return null
  const id = device.id ?? device.device ?? device.deviceId
  if (id === null || id === undefined || id === '') return null

  return {
    id,
    name: String(device.name ?? device.description ?? `Device ${id}`).trim() || `Device ${id}`,
    area: String(device.area ?? '').trim(),
    type: String(device.type ?? '').trim(),
    address: String(device.address ?? '').trim()
  }
}

const normalizeDevicesPayload = (payload) => {
  const rawDevices = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.devices)
      ? payload.devices
      : Array.isArray(payload?.printers)
        ? payload.printers
        : []

  return rawDevices
    .map(normalizeDevice)
    .filter(Boolean)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'it'))
}

const normalizeFavoriteProducts = (products) => {
  const ids = Array.isArray(products) ? products : []
  const normalized = []
  const seen = new Set()

  ids.forEach((entry) => {
    const id = toSafeNumber(entry, entry)
    const key = String(id)
    if (!key || seen.has(key)) return
    seen.add(key)
    normalized.push(id)
  })

  return normalized
}

const normalizeFavoritesPayload = (payload) => {
  const rawFavorites = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.favorites)
      ? payload.favorites
      : Array.isArray(payload?.preferiti)
        ? payload.preferiti
        : []

  return rawFavorites.reduce((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc
    const deviceId = entry.device ?? entry.agent ?? entry.deviceId
    if (deviceId === null || deviceId === undefined || deviceId === '') return acc
    acc[String(deviceId)] = normalizeFavoriteProducts(entry.products ?? entry.favorites)
    return acc
  }, {})
}

const allProducts = computed(() => {
  const byId = new Map()

  categories.value.forEach((category) => {
    const products = Array.isArray(category.products) ? category.products : []
    products.forEach((product) => {
      const key = String(product.id)
      if (!key || byId.has(key)) return
      byId.set(key, product)
    })
  })

  return Array.from(byId.values())
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it'))
})

const productById = computed(() => {
  const map = new Map()
  allProducts.value.forEach((product) => {
    map.set(String(product.id), product)
  })
  return map
})

const selectedFavoritesDevice = computed(() => {
  return devices.value.find((device) => String(device.id) === String(selectedFavoritesDeviceId.value)) || null
})

const selectedFavorites = computed(() => {
  return favoritesByDevice.value[String(selectedFavoritesDeviceId.value)] || []
})

const selectedFavoritesSet = computed(() => {
  return new Set(selectedFavorites.value.map((id) => String(id)))
})

const favoriteProductsForSelectedDevice = computed(() => {
  return selectedFavorites.value.map((productId) => {
    const product = productById.value.get(String(productId))
    return product || {
      id: productId,
      name: `Prodotto #${productId}`,
      category: 'Non trovato',
      price: 0,
      color: '#e2e8f0'
    }
  })
})

const filteredFavoriteProducts = computed(() => {
  const query = favoritesProductSearch.value.trim().toLowerCase()
  const products = allProducts.value

  if (!query) return products

  return products.filter((product) => {
    const haystack = `${product.id} ${product.name} ${product.category}`.toLowerCase()
    return haystack.includes(query)
  })
})

const hasFavoritesChanges = computed(() => {
  const deviceIds = new Set([
    ...Object.keys(favoritesByDevice.value),
    ...Object.keys(originalFavoritesByDevice.value)
  ])

  for (const deviceId of deviceIds) {
    const current = normalizeFavoriteProducts(favoritesByDevice.value[deviceId]).map(String).sort()
    const original = normalizeFavoriteProducts(originalFavoritesByDevice.value[deviceId]).map(String).sort()
    if (current.length !== original.length) return true
    if (current.some((item, index) => item !== original[index])) return true
  }

  return false
})

const setDeviceFavorites = (deviceId, products) => {
  favoritesByDevice.value = {
    ...favoritesByDevice.value,
    [String(deviceId)]: normalizeFavoriteProducts(products)
  }
}

const syncLocalFavoriteAdd = async (deviceId, productId) => {
  if (USE_FIREBASE_DIRECT_SYNC) return

  try {
    await axios.get('/api/addfavorite', {
      params: {
        agent: deviceId,
        product: productId
      }
    })

    originalFavoritesByDevice.value = {
      ...originalFavoritesByDevice.value,
      [String(deviceId)]: normalizeFavoriteProducts(favoritesByDevice.value[String(deviceId)])
    }
    favoritesConfigMessage.value = 'Preferito salvato sul backend locale.'
    favoritesConfigError.value = ''
  } catch (error) {
    console.error('Errore salvataggio preferito locale', error)
    favoritesConfigMessage.value = ''
    favoritesConfigError.value = 'Preferito aggiunto in vista, ma non salvato sul backend locale.'
  }
}

const toggleFavoriteProduct = (productId, enabled) => {
  if (!selectedFavoritesDeviceId.value) return
  const deviceId = selectedFavoritesDeviceId.value
  const current = selectedFavorites.value
  const key = String(productId)

  if (enabled) {
    if (current.some((id) => String(id) === key)) return
    setDeviceFavorites(deviceId, [...current, productId])
    syncLocalFavoriteAdd(deviceId, productId)
    return
  }

  setDeviceFavorites(
    deviceId,
    current.filter((id) => String(id) !== key)
  )
}

const addFavoriteFromProduct = (product) => {
  if (!product) return
  toggleFavoriteProduct(product.id, true)
}

const removeFavoriteFromSelectedDevice = (productId) => {
  toggleFavoriteProduct(productId, false)
}

const fetchDevicesFromFirestore = async () => {
  const db = getFirebaseDb()
  const snapshot = await getDocs(collection(db, FIREBASE_DEVICES_COLLECTION))
  const rows = []

  snapshot.forEach((entry) => {
    rows.push(entry.data())
  })

  return normalizeDevicesPayload(rows)
}

const fetchDevices = async () => {
  if (USE_FIREBASE_DIRECT_SYNC) {
    devices.value = await fetchDevicesFromFirestore()
  } else {
    const res = await axios.get(CONFIGS_ENDPOINT)
    devices.value = normalizeDevicesPayload(res.data)
  }

  if (!devices.value.length) {
    selectedFavoritesDeviceId.value = ''
    return
  }

  const exists = devices.value.some((device) => String(device.id) === String(selectedFavoritesDeviceId.value))
  if (!exists) {
    selectedFavoritesDeviceId.value = String(devices.value[0].id)
  }
}

const fetchFavoritesFromFirestore = async () => {
  const db = getFirebaseDb()
  const snapshot = await getDocs(collection(db, FIREBASE_FAVORITES_COLLECTION))
  const rows = []

  snapshot.forEach((entry) => {
    rows.push(entry.data())
  })

  return normalizeFavoritesPayload(rows)
}

const fetchFavoritesFromApi = async () => {
  const entries = await Promise.all(devices.value.map(async (device) => {
    const res = await axios.get(FAVORITES_ENDPOINT, { params: { agent: device.id } })
    const products = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.favorites)
        ? res.data.favorites
        : []
    return [String(device.id), normalizeFavoriteProducts(products)]
  }))

  return Object.fromEntries(entries)
}

const fetchFavoritesConfiguration = async () => {
  loadingFavorites.value = true
  favoritesConfigError.value = ''
  favoritesConfigMessage.value = ''

  try {
    if (!categories.value.length) {
      await fetchProducts()
    }
    await fetchDevices()

    const normalizedFavorites = USE_FIREBASE_DIRECT_SYNC
      ? await fetchFavoritesFromFirestore()
      : await fetchFavoritesFromApi()

    favoritesByDevice.value = { ...normalizedFavorites }
    originalFavoritesByDevice.value = JSON.parse(JSON.stringify(normalizedFavorites))
  } catch (error) {
    console.error('Errore caricamento preferiti', error)
    devices.value = []
    favoritesByDevice.value = {}
    originalFavoritesByDevice.value = {}
    selectedFavoritesDeviceId.value = ''
    favoritesConfigError.value = 'Impossibile caricare preferiti e dispositivi.'
  } finally {
    loadingFavorites.value = false
  }
}

const saveFavoritesConfiguration = async () => {
  savingFavoritesConfig.value = true
  favoritesConfigError.value = ''
  favoritesConfigMessage.value = ''

  try {
    if (USE_FIREBASE_DIRECT_SYNC) {
      const db = getFirebaseDb()
      const collectionRef = collection(db, FIREBASE_FAVORITES_COLLECTION)

      await Promise.all(devices.value.map(async (device) => {
        const deviceId = String(device.id)
        const products = normalizeFavoriteProducts(favoritesByDevice.value[deviceId])
        const snapshots = await Promise.all([
          getDocs(buildFsQuery(collectionRef, where('device', '==', device.id))),
          getDocs(buildFsQuery(collectionRef, where('device', '==', deviceId)))
        ])
        const matchedDocs = snapshots
          .flatMap((snapshot) => snapshot.docs)
          .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.ref.path === entry.ref.path) === index)
        const docRef = matchedDocs[0]?.ref || doc(db, FIREBASE_FAVORITES_COLLECTION, deviceId)

        await setDoc(docRef, {
          device: device.id,
          products,
          updatedAt: serverTimestamp()
        }, { merge: true })

        await Promise.all(matchedDocs.slice(1).map((entry) => deleteDoc(entry.ref)))
      }))
    } else {
      const favorites = devices.value.map((device) => {
        const deviceId = String(device.id)
        return {
          device: device.id,
          products: normalizeFavoriteProducts(favoritesByDevice.value[deviceId])
        }
      })

      await axios.post(FAVORITES_ENDPOINT, { favorites })
    }

    originalFavoritesByDevice.value = JSON.parse(JSON.stringify(favoritesByDevice.value))
    favoritesConfigMessage.value = USE_FIREBASE_DIRECT_SYNC
      ? 'Preferiti sincronizzati con Firebase.'
      : 'Preferiti salvati sul backend locale e sincronizzati dal server.'
  } catch (error) {
    console.error('Errore salvataggio preferiti', error)
    favoritesConfigError.value = USE_FIREBASE_DIRECT_SYNC
      ? 'Salvataggio preferiti su Firebase non riuscito.'
      : 'Salvataggio preferiti sul backend locale non riuscito.'
  } finally {
    savingFavoritesConfig.value = false
  }
}

const selectedProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (query) {
    return categories.value
      .flatMap((category) => Array.isArray(category.products) ? category.products : [])
      .filter((product) => String(product.name || '').toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'))
  }

  const category = categories.value.find((item) => item.name === selectedCategory.value)
  if (!category) return []

  return [...category.products]
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))
})

const imageKey = (productId) => String(productId)
const isImageBroken = (productId) => brokenImages.value[imageKey(productId)] === true
const markImageBroken = (productId) => {
  brokenImages.value = {
    ...brokenImages.value,
    [imageKey(productId)]: true
  }
}

const availableCategoryNames = computed(() => categories.value.map((category) => category.name))

const dialogTitle = computed(() => (isCreatingProduct.value ? 'Nuovo prodotto' : 'Modifica prodotto'))
const saveButtonLabel = computed(() => (saving.value
  ? (isCreatingProduct.value ? 'Creazione...' : 'Salvataggio...')
  : (isCreatingProduct.value ? 'Crea' : 'Salva')))
const refreshButtonDisabled = computed(() => loading.value || loadingVariants.value || loadingFavorites.value)
const refreshButtonLabel = computed(() => {
  if (activeTab.value === 'products') return loading.value ? 'Caricamento...' : 'Aggiorna prodotti'
  if (activeTab.value === 'variants') return loadingVariants.value ? 'Caricamento...' : 'Aggiorna varianti'
  return loadingFavorites.value ? 'Caricamento...' : 'Aggiorna preferiti'
})
const refreshActiveTab = () => {
  if (activeTab.value === 'products') {
    fetchProducts()
    return
  }
  if (activeTab.value === 'variants') {
    fetchVariantFamilies()
    return
  }
  fetchFavoritesConfiguration()
}

const normalizeProductName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

const isDuplicateCreateName = computed(() => {
  if (!isCreatingProduct.value) return false
  const candidate = normalizeProductName(form.value.name)
  if (!candidate) return false

  return categories.value.some((category) =>
    Array.isArray(category.products) && category.products.some((product) => normalizeProductName(product.name) === candidate)
  )
})

const selectedImageName = ref('')
const newLabelText = ref('')

const selectedVariantFamily = computed(() => {
  return variantFamilies.value.find((family) => String(family.id) === String(form.value.variantFamilyId)) || null
})

const visibleFamilyVariants = computed(() => {
  return selectedVariantFamily.value?.variants || []
})

const selectedVariantIds = computed(() => {
  const ids = new Set()
  const vars = Array.isArray(form.value.variants?.vars) ? form.value.variants.vars : []
  vars.forEach((entry) => {
    ids.add(String(entry.id))
  })
  return ids
})

const isVariantSelected = (variantId) => selectedVariantIds.value.has(String(variantId))

const findVariantInForm = (variantId) => {
  const vars = Array.isArray(form.value.variants?.vars) ? form.value.variants.vars : []
  return vars.find((entry) => String(entry.id) === String(variantId)) || null
}

const addVariantToForm = (family, variant) => {
  if (!family || !variant) return
  if (isVariantSelected(variant.id)) return

  const vars = Array.isArray(form.value.variants?.vars) ? [...form.value.variants.vars] : []
  vars.push({
    id: variant.id,
    name: variant.name,
    price: toSafeNumber(variant.price, 0),
    color: variant.color,
    family: {
      id: family.id,
      name: family.name
    }
  })

  form.value.variants = {
    auto: toBoolean(form.value.variants?.auto),
    vars
  }
}

const removeVariantFromForm = (variantId) => {
  const vars = Array.isArray(form.value.variants?.vars) ? form.value.variants.vars : []
  form.value.variants = {
    auto: toBoolean(form.value.variants?.auto),
    vars: vars.filter((entry) => String(entry.id) !== String(variantId))
  }
}

const toggleVariantSelection = (family, variant, enabled) => {
  if (enabled) {
    addVariantToForm(family, variant)
    return
  }
  removeVariantFromForm(variant.id)
}

const updateVariantPrice = (variantId, value) => {
  const vars = Array.isArray(form.value.variants?.vars) ? [...form.value.variants.vars] : []
  const index = vars.findIndex((entry) => String(entry.id) === String(variantId))
  if (index < 0) return
  vars[index] = {
    ...vars[index],
    price: toSafeNumber(value, 0)
  }
  form.value.variants = {
    auto: toBoolean(form.value.variants?.auto),
    vars
  }
}

const addLabelToForm = () => {
  const candidate = normalizeLabelValue(newLabelText.value)
  if (!candidate) return

  const existing = Array.isArray(form.value.labels) ? form.value.labels : []
  const candidateKey = candidate.toLowerCase()
  const hasDuplicate = existing.some((label) => normalizeLabelValue(label).toLowerCase() === candidateKey)
  if (hasDuplicate) {
    newLabelText.value = ''
    return
  }

  form.value.labels = [...existing, candidate]
  newLabelText.value = ''
}

const removeLabelFromForm = (labelToRemove) => {
  const labels = Array.isArray(form.value.labels) ? form.value.labels : []
  form.value.labels = labels.filter((label) => normalizeLabelValue(label).toLowerCase() !== normalizeLabelValue(labelToRemove).toLowerCase())
}

const handleLabelInputKeydown = (event) => {
  if (!event) return
  if (event.key !== 'Enter' && event.key !== ',') return
  event.preventDefault()
  addLabelToForm()
}

const ensureCategoryExists = (categoryName) => {
  if (!categoryName) return null
  let category = categories.value.find((item) => item.name === categoryName)
  if (!category) {
    category = { id: null, name: categoryName, products: [] }
    categories.value.push(category)
  }
  return category
}

const getCategoryIdByName = (categoryName) => {
  const category = categories.value.find((item) => item.name === categoryName)
  if (!category) return null
  const id = Number(category.id)
  return Number.isFinite(id) ? id : null
}

const persistVariantsFallback = async (productId, categoryName, payload) => {
  const normalizedProductId = Number(productId)
  if (!Number.isFinite(normalizedProductId)) return

  const categoryId = getCategoryIdByName(categoryName)
  if (!Number.isFinite(categoryId)) return

  const setProp = async (prop, value) => {
    await axios.get('/api/setproduct', {
      params: {
        id: normalizedProductId,
        category: categoryId,
        prop,
        value
      }
    })
  }

  await setProp('auto', String(toBoolean(payload.auto)))
  await setProp('variants', JSON.stringify(payload.variants || emptyVariants()))
  await setProp('labels', JSON.stringify(payload.labels || []))
}

const openCreateDialog = () => {
  const firstFamilyId = variantFamilies.value[0]?.id ?? ''

  form.value = {
    id: '',
    name: '',
    price: 0,
    purchase_price: 0,
    imageUrl: '',
    color: '#1976d2',
    category: selectedCategory.value || availableCategoryNames.value[0] || '',
    variantFamilyId: firstFamilyId,
    inventoryEnabled: false,
    auto: false,
    variants: emptyVariants(),
    labels: []
  }
  editingProduct.value = null
  isCreatingProduct.value = true
  selectedImageName.value = ''
  newLabelText.value = ''
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const duplicateProduct = (product) => {
  const normalizedVariants = normalizeVariantsPayload(product?.variants, product?.auto ?? product?.audo)
  const normalizedLabels = normalizeLabelsPayload(product?.labels)
  const firstVariantFamilyId = normalizedVariants.vars[0]?.family?.id
    ?? variantFamilies.value[0]?.id
    ?? ''

  form.value = {
    id: '',
    name: `${product.name} copia`,
    price: Number(product.price || 0),
    purchase_price: Number(product.purchase_price || 0),
    imageUrl: product.imageUrl || '',
    color: product.color || '#1976d2',
    category: product.category || selectedCategory.value || availableCategoryNames.value[0] || '',
    variantFamilyId: firstVariantFamilyId,
    inventoryEnabled: toBoolean(product?.inventory?.enabled ?? product?.inventoryEnabled),
    auto: toBoolean(normalizedVariants.auto),
    variants: normalizedVariants,
    labels: normalizedLabels
  }
  editingProduct.value = null
  isCreatingProduct.value = true
  selectedImageName.value = ''
  newLabelText.value = ''
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const openEditDialog = (product) => {
  const normalizedVariants = normalizeVariantsPayload(product?.variants, product?.auto ?? product?.audo)
  const normalizedLabels = normalizeLabelsPayload(product?.labels)
  const firstVariantFamilyId = normalizedVariants.vars[0]?.family?.id
    ?? variantFamilies.value[0]?.id
    ?? ''

  form.value = {
    id: String(product.id),
    name: product.name,
    price: Number(product.price || 0),
    purchase_price: Number(product.purchase_price || 0),
    imageUrl: product.imageUrl || '',
    color: product.color || '#1976d2',
    category: product.category,
    variantFamilyId: firstVariantFamilyId,
    inventoryEnabled: toBoolean(product?.inventory?.enabled ?? product?.inventoryEnabled),
    auto: toBoolean(normalizedVariants.auto),
    variants: normalizedVariants,
    labels: normalizedLabels
  }
  editingProduct.value = product
  isCreatingProduct.value = false
  selectedImageName.value = ''
  newLabelText.value = ''
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const closeDialog = () => {
  isDialogOpen.value = false
  editingProduct.value = null
  isCreatingProduct.value = false
  selectedImageName.value = ''
  newLabelText.value = ''
}

let previousBodyOverflow = ''
watch(isDialogOpen, (open) => {
  if (typeof document === 'undefined') return

  if (open) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = previousBodyOverflow
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = previousBodyOverflow
})

const handleImageUpload = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Seleziona un file immagine valido.'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : ''
    if (!result) {
      errorMessage.value = 'Impossibile leggere il file selezionato.'
      return
    }
    form.value.imageUrl = result
    selectedImageName.value = file.name
    errorMessage.value = ''
  }
  reader.onerror = () => {
    errorMessage.value = 'Errore durante il caricamento dell\'immagine.'
  }
  reader.readAsDataURL(file)
}

const saveProduct = async () => {
  if (!isCreatingProduct.value && !editingProduct.value) return

  const normalizedName = normalizeProductName(form.value.name)
  if (!normalizedName) return

  if (isCreatingProduct.value && isDuplicateCreateName.value) {
    errorMessage.value = 'Esiste già un prodotto con questo nome.'
    saveMessage.value = ''
    return
  }

  saving.value = true
  saveMessage.value = ''
  errorMessage.value = ''

  const normalizedVariants = normalizeVariantsPayload(form.value.variants, form.value.auto)
  const normalizedLabels = normalizeLabelsPayload(form.value.labels)

  const payload = {
    id: form.value.id,
    name: String(form.value.name).trim(),
    price: Number(form.value.price) || 0,
    purchase_price: Number(form.value.purchase_price) || 0,
    imgUrl: form.value.imageUrl.trim(),
    color: form.value.color,
    category: form.value.category,
    inventoryEnabled: toBoolean(form.value.inventoryEnabled),
    auto: toBoolean(form.value.auto),
    variants: {
      auto: toBoolean(form.value.auto),
      vars: normalizedVariants.vars
    },
    labels: normalizedLabels
  }

  try {
    if (isCreatingProduct.value) {
      const createPayload = {
        name: payload.name,
        price: payload.price,
        purchase_price: payload.purchase_price,
        imgUrl: payload.imgUrl,
        color: payload.color,
        category: payload.category,
        category_name: payload.category,
        inventoryEnabled: payload.inventoryEnabled,
        auto: payload.auto,
        variants: payload.variants,
        labels: payload.labels
      }

      const res = await axios.post(PRODUCTS_ENDPOINT, createPayload)
      const createdRaw = res?.data && typeof res.data === 'object' ? res.data : {}
      const createdId = createdRaw.id ?? createdRaw._id ?? null
      const normalizedInventory = normalizeInventoryPayload(createdRaw.inventory, payload.inventoryEnabled)
      const category = ensureCategoryExists(payload.category)
      if (category && createdId !== null && createdId !== undefined) {
        await persistVariantsFallback(createdId, payload.category, payload)

        category.products.push({
          id: createdId,
          name: payload.name,
          price: payload.price,
          purchase_price: payload.purchase_price,
          imageUrl: payload.imgUrl,
          color: payload.color,
          category: payload.category,
          inventory: normalizedInventory,
          inventoryEnabled: normalizedInventory.enabled,
          auto: payload.auto,
          variants: payload.variants,
          labels: normalizedLabels
        })
        selectedCategory.value = payload.category
      } else {
        await fetchProducts()
      }
      saveMessage.value = 'Prodotto creato con successo.'
    } else {
      await axios.put(`${PRODUCTS_ENDPOINT}/${encodeURIComponent(form.value.id)}`, payload)
      await persistVariantsFallback(form.value.id, form.value.category, payload)

      const category = categories.value.find((item) => item.name === form.value.category)
      if (category) {
        const index = category.products.findIndex((item) => String(item.id) === String(form.value.id))
        if (index >= 0) {
          const currentInventory = normalizeInventoryPayload(category.products[index]?.inventory, payload.inventoryEnabled)
          category.products[index] = {
            ...category.products[index],
            name: payload.name,
            price: payload.price,
            purchase_price: payload.purchase_price,
            imageUrl: payload.imgUrl,
            color: payload.color,
            inventory: {
              ...currentInventory,
              enabled: payload.inventoryEnabled
            },
            inventoryEnabled: payload.inventoryEnabled,
            auto: payload.auto,
            variants: payload.variants,
            labels: normalizedLabels
          }
        }
      }
      saveMessage.value = 'Anagrafica prodotto aggiornata con successo.'
    }
    closeDialog()
  } catch (error) {
    console.error('Errore salvataggio anagrafica prodotto', error)
    const apiError = error?.response?.data?.error
    if (apiError === 'duplicate_name') {
      errorMessage.value = 'Esiste già un prodotto con questo nome.'
      return
    }
    errorMessage.value = isCreatingProduct.value
      ? 'Creazione non riuscita. Verifica endpoint creazione prodotto.'
      : 'Salvataggio non riuscito. Verifica endpoint aggiornamento prodotto.'
  } finally {
    saving.value = false
  }
}

onMounted(fetchProducts)
onMounted(fetchVariantFamilies)

watch(activeTab, (tab) => {
  if (tab === 'favorites' && !devices.value.length && !loadingFavorites.value) {
    fetchFavoritesConfiguration()
  }
})
</script>

<template>
  <div class="catalog-page">
    <header class="page-header">
      <div>
        <h1>Listino Prodotti</h1>
      </div>
      <div class="header-actions">
        <button v-if="activeTab === 'products'" class="btn-primary" :disabled="loading || !availableCategoryNames.length" @click="openCreateDialog">
          Nuovo prodotto
        </button>
        <button
          v-if="activeTab === 'favorites'"
          class="btn-primary"
          :disabled="savingFavoritesConfig || loadingFavorites || !devices.length || !hasFavoritesChanges"
          @click="saveFavoritesConfiguration"
        >
          {{ savingFavoritesConfig ? 'Salvataggio...' : 'Salva preferiti' }}
        </button>
        <button
          class="btn-refresh"
          :disabled="refreshButtonDisabled"
          @click="refreshActiveTab"
        >
          {{ refreshButtonLabel }}
        </button>
      </div>
    </header>

    <div class="tabs-nav" role="tablist" aria-label="Sezioni listino prodotti">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'products' }"
        role="tab"
        :aria-selected="activeTab === 'products'"
        @click="activeTab = 'products'"
      >
        Prodotti
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'variants' }"
        role="tab"
        :aria-selected="activeTab === 'variants'"
        @click="activeTab = 'variants'"
      >
        Varianti
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'favorites' }"
        role="tab"
        :aria-selected="activeTab === 'favorites'"
        @click="activeTab = 'favorites'"
      >
        Preferiti
      </button>
    </div>

    <div v-if="activeTab === 'products'" class="filters-card">
      <div class="filters">
        <div class="filter-field">
          <label for="category-select" class="sr-only">Categoria</label>
          <select id="category-select" v-model="selectedCategory" :disabled="loading || !categories.length" aria-label="Categoria prodotto">
            <option v-for="category in categories" :key="category.name" :value="category.name">
              {{ category.name }}
            </option>
          </select>
        </div>

        <div class="filter-field filter-field-search">
          <label for="product-search" class="sr-only">Cerca per nome</label>
          <input
            id="product-search"
            v-model="searchQuery"
            type="text"
            placeholder="Filtra per nome..."
            aria-label="Cerca prodotto per nome"
            :disabled="loading || !categories.length"
          />
        </div>
      </div>
    </div>

    <p v-if="activeTab === 'products' && errorMessage" class="status error">{{ errorMessage }}</p>
    <p v-if="activeTab === 'products' && saveMessage" class="status success">{{ saveMessage }}</p>

    <div v-if="activeTab === 'products'" class="table-wrap">
      <table v-if="selectedProducts.length" class="products-table">
        <colgroup>
          <col style="width: 80px" />
          <col style="width: 80px" />
          <col />
          <col style="width: 120px" />
          <col style="width: 165px" />
          <col style="width: 110px" />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>Thumb</th>
            <th>Nome</th>
            <th class="price-head">Prezzo</th>
            <th class="price-head">Prezzo acquisto</th>
            <th class="actions-head">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in selectedProducts"
            :key="product.id"
            class="row"
            :style="{ '--row-color': product.color || '#e2e8f0' }"
            @click="openEditDialog(product)"
          >
            <td>{{ product.id }}</td>
            <td>
              <img
                v-if="product.imageUrl && !isImageBroken(product.id)"
                :src="product.imageUrl"
                alt="thumb"
                class="thumb"
                @error="markImageBroken(product.id)"
              />
              <div v-else class="thumb thumb-fallback">N/A</div>
            </td>
            <td>{{ product.name }}</td>
            <td class="price">€ {{ Number(product.price || 0).toFixed(2) }}</td>
            <td class="price">€ {{ Number(product.purchase_price || 0).toFixed(2) }}</td>
            <td class="actions-cell">
              <button class="btn-secondary btn-sm" @click.stop="duplicateProduct(product)">Duplica</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Nessun prodotto disponibile per la categoria selezionata.</p>
    </div>

    <section v-else-if="activeTab === 'variants'" class="variants-config-section">
      <div class="variants-config-header">
        <div>
          <h2>Configurazione Varianti</h2>
        </div>
        <button class="btn-primary" :disabled="savingVariantsConfig || loadingVariants" @click="saveVariantsConfiguration">
          {{ savingVariantsConfig ? 'Salvataggio...' : 'Salva configurazione varianti' }}
        </button>
      </div>

      <div class="variants-family-add">
        <input
          v-model="newFamilyName"
          type="text"
          placeholder="Nuova famiglia (es. Cocktail)"
          :disabled="savingVariantsConfig"
        />
        <button class="btn-secondary" :disabled="savingVariantsConfig" @click="addVariantFamily">Aggiungi famiglia</button>
      </div>

      <p v-if="variantsConfigError" class="status error">{{ variantsConfigError }}</p>
      <p v-if="variantsConfigMessage" class="status success">{{ variantsConfigMessage }}</p>

      <div v-if="variantsConfigFamilies.length" class="variants-family-list">
        <article v-for="family in variantsConfigFamilies" :key="family.id" class="variants-family-card">
          <div class="variants-family-row">
            <div class="variants-family-title">Famiglia #{{ family.id }}</div>
            <button class="btn-secondary btn-sm" :disabled="savingVariantsConfig" @click="removeVariantFamily(family.id)">Rimuovi famiglia</button>
          </div>

          <div class="form-row">
            <label>Nome famiglia</label>
            <input v-model="family.name" type="text" :disabled="savingVariantsConfig" />
          </div>

          <div class="variants-inner-list">
            <div v-for="variant in family.variants" :key="variant.id" class="variants-inner-item">
              <div class="variants-inner-id">#{{ variant.id }}</div>
              <input v-model="variant.name" type="text" placeholder="Nome variante" :disabled="savingVariantsConfig" />
              <input v-model.number="variant.price" type="number" min="0" step="0.01" placeholder="Prezzo default" :disabled="savingVariantsConfig" />
              <button class="btn-secondary btn-sm" :disabled="savingVariantsConfig" @click="removeVariantFromFamily(family.id, variant.id)">Rimuovi</button>
            </div>
          </div>

          <button class="btn-secondary btn-sm" :disabled="savingVariantsConfig" @click="addVariantToFamily(family.id)">Aggiungi variante</button>
        </article>
      </div>
      <p v-else class="empty">Nessuna famiglia varianti configurata.</p>
    </section>

    <section v-else class="favorites-config-section">
      <div class="favorites-config-header">
        <div>
          <h2>Gestione Preferiti</h2>
          <p v-if="selectedFavoritesDevice" class="favorites-device-meta">
            {{ selectedFavoritesDevice.name }}
            <span v-if="selectedFavoritesDevice.area"> · {{ selectedFavoritesDevice.area }}</span>
            <span v-if="selectedFavoritesDevice.type"> · {{ selectedFavoritesDevice.type }}</span>
          </p>
        </div>
        <button
          class="btn-primary"
          :disabled="savingFavoritesConfig || loadingFavorites || !devices.length || !hasFavoritesChanges"
          @click="saveFavoritesConfiguration"
        >
          Salva
        </button>
      </div>

      <div class="favorites-toolbar">
        <div class="filter-field">
          <label for="favorites-device" class="sr-only">Dispositivo</label>
          <select
            id="favorites-device"
            v-model="selectedFavoritesDeviceId"
            :disabled="loadingFavorites || !devices.length"
            aria-label="Dispositivo preferiti"
          >
            <option v-for="device in devices" :key="device.id" :value="String(device.id)">
              {{ device.name }} #{{ device.id }}
            </option>
          </select>
        </div>

        <div class="filter-field filter-field-search">
          <label for="favorites-search" class="sr-only">Cerca prodotto</label>
          <input
            id="favorites-search"
            v-model="favoritesProductSearch"
            type="text"
            placeholder="Cerca prodotto..."
            :disabled="loadingFavorites || !allProducts.length"
          />
        </div>
      </div>

      <p v-if="favoritesConfigError" class="status error">{{ favoritesConfigError }}</p>
      <p v-if="favoritesConfigMessage" class="status success">{{ favoritesConfigMessage }}</p>

      <div v-if="loadingFavorites" class="empty">Caricamento preferiti...</div>
      <div v-else-if="!devices.length" class="empty">Nessun dispositivo configurato.</div>
      <div v-else class="favorites-grid">
        <section class="favorites-panel">
          <div class="favorites-panel-head">
            <h3>Preferiti dispositivo</h3>
            <span>{{ selectedFavorites.length }} prodotti</span>
          </div>

          <div v-if="favoriteProductsForSelectedDevice.length" class="favorites-selected-list">
            <div
              v-for="product in favoriteProductsForSelectedDevice"
              :key="product.id"
              class="favorite-selected-item"
              :style="{ '--row-color': product.color || '#e2e8f0' }"
            >
              <div>
                <strong>{{ product.name }}</strong>
                <small>#{{ product.id }} · {{ product.category }}</small>
              </div>
              <button class="btn-secondary btn-sm" :disabled="savingFavoritesConfig" @click="removeFavoriteFromSelectedDevice(product.id)">Rimuovi</button>
            </div>
          </div>
          <p v-else class="empty compact-empty">Nessun preferito configurato per questo dispositivo.</p>
        </section>

        <section class="favorites-panel">
          <div class="favorites-panel-head">
            <h3>Catalogo prodotti</h3>
            <span>{{ filteredFavoriteProducts.length }} disponibili</span>
          </div>

          <div v-if="filteredFavoriteProducts.length" class="favorites-products-list">
            <button
              v-for="product in filteredFavoriteProducts"
              :key="product.id"
              type="button"
              class="favorite-product-option"
              :class="{ active: selectedFavoritesSet.has(String(product.id)) }"
              :disabled="savingFavoritesConfig"
              @click="selectedFavoritesSet.has(String(product.id)) ? removeFavoriteFromSelectedDevice(product.id) : addFavoriteFromProduct(product)"
            >
              <span>
                <strong>{{ product.name }}</strong>
                <small>#{{ product.id }} · {{ product.category }}</small>
              </span>
              <span class="favorite-state">{{ selectedFavoritesSet.has(String(product.id)) ? 'Preferito' : 'Aggiungi' }}</span>
            </button>
          </div>
          <p v-else class="empty compact-empty">Nessun prodotto trovato.</p>
        </section>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="isDialogOpen" class="dialog-backdrop" @click.self="closeDialog">
        <div class="dialog">
          <h3>{{ dialogTitle }}</h3>

          <div class="dialog-grid">
            <section class="dialog-col dialog-col-main">
              <div v-if="!isCreatingProduct" class="form-row">
                <label>ID</label>
                <input :value="form.id" disabled />
              </div>

              <div class="form-row">
                <label>Categoria</label>
                <select v-model="form.category" :disabled="!availableCategoryNames.length || saving">
                  <option v-for="categoryName in availableCategoryNames" :key="categoryName" :value="categoryName">
                    {{ categoryName }}
                  </option>
                </select>
              </div>

              <div class="form-row">
                <label>Nome</label>
                <input v-model="form.name" type="text" />
                <small v-if="isCreatingProduct && isDuplicateCreateName" class="field-error">Esiste già un prodotto con questo nome.</small>
              </div>

              <div class="form-row">
                <label>Etichette</label>
                <div class="labels-input-row">
                  <input
                    v-model="newLabelText"
                    type="text"
                    placeholder="Aggiungi etichetta e premi Enter"
                    @keydown="handleLabelInputKeydown"
                  />
                  <button class="btn-secondary btn-sm" type="button" :disabled="saving" @click="addLabelToForm">Aggiungi</button>
                </div>
                <div v-if="Array.isArray(form.labels) && form.labels.length" class="labels-pills">
                  <span v-for="label in form.labels" :key="label" class="label-pill">
                    <span>{{ label }}</span>
                    <button type="button" class="label-pill-remove" :disabled="saving" @click="removeLabelFromForm(label)">X</button>
                  </span>
                </div>
              </div>

              <div class="form-row">
                <label>Prezzo</label>
                <input v-model.number="form.price" type="number" step="0.01" min="0" />
              </div>

              <div class="form-row">
                <label>Prezzo di acquisto</label>
                <input v-model.number="form.purchase_price" type="number" step="0.01" min="0" />
              </div>

              <div class="form-row">
                <label>Immagine URL</label>
                <input v-model="form.imageUrl" type="text" />
              </div>

              <div v-if="isCreatingProduct" class="form-row">
                <label>Upload immagine</label>
                <input type="file" accept="image/*" @change="handleImageUpload" />
                <small v-if="selectedImageName" class="upload-info">File selezionato: {{ selectedImageName }}</small>
              </div>

              <div class="form-row">
                <label>Colore</label>
                <div class="color-row">
                  <input v-model="form.color" type="color" class="color-input" />
                  <input v-model="form.color" type="text" placeholder="#1976d2" />
                </div>
              </div>

              <div class="form-row compact-row">
                <label>Abilita magazzino</label>
                <label class="switch-field" :class="{ disabled: saving }">
                  <input v-model="form.inventoryEnabled" type="checkbox" :disabled="saving" class="switch-input" />
                  <span class="switch-slider" aria-hidden="true"></span>
                  <span class="switch-text">{{ form.inventoryEnabled ? 'Si' : 'No' }}</span>
                </label>
              </div>
            </section>

            <section class="dialog-col dialog-col-variants">
              <h4>Associazione Varianti</h4>

              <div class="form-row">
                <label>Famiglia varianti</label>
                <select v-model="form.variantFamilyId" :disabled="saving || loadingVariants || !variantFamilies.length">
                  <option value="" disabled>
                    {{ loadingVariants ? 'Caricamento famiglie...' : 'Seleziona famiglia' }}
                  </option>
                  <option v-for="family in variantFamilies" :key="family.id" :value="family.id">
                    {{ family.name }}
                  </option>
                </select>
              </div>

              <div class="form-row compact-row">
                <label>Automatica</label>
                <label class="switch-field" :class="{ disabled: saving }">
                  <input v-model="form.auto" type="checkbox" :disabled="saving" class="switch-input" />
                  <span class="switch-slider" aria-hidden="true"></span>
                  <span class="switch-text">{{ form.auto ? 'Si' : 'No' }}</span>
                </label>
              </div>

              <div class="variants-list" v-if="selectedVariantFamily && visibleFamilyVariants.length">
                <div v-for="variant in visibleFamilyVariants" :key="variant.id" class="variant-item">
                  <label class="variant-name">
                    <input
                      type="checkbox"
                      :checked="isVariantSelected(variant.id)"
                      :disabled="saving"
                      @change="toggleVariantSelection(selectedVariantFamily, variant, $event.target.checked)"
                    />
                    <span>{{ variant.name }}</span>
                  </label>

                  <div class="variant-price">
                    <span>Prezzo</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      :disabled="!isVariantSelected(variant.id) || saving"
                      :value="findVariantInForm(variant.id)?.price ?? variant.price"
                      @input="updateVariantPrice(variant.id, $event.target.value)"
                    />
                  </div>
                </div>
              </div>

              <p v-else class="variants-empty">Nessuna variante disponibile per la famiglia selezionata.</p>
            </section>
          </div>

          <div class="dialog-actions">
            <button class="btn-secondary" :disabled="saving" @click="closeDialog">Annulla</button>
            <button class="btn-primary" :disabled="saving || !form.name.trim() || !form.category || (isCreatingProduct && isDuplicateCreateName)" @click="saveProduct">
              {{ saveButtonLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.catalog-page {
  padding: 6px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.tabs-nav {
  display: flex;
  width: fit-content;
  gap: 6px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.72);
  margin-bottom: 12px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.tab-btn {
  border: 0;
  background: transparent;
  color: #475569;
  font: inherit;
  font-weight: 600;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.tab-btn.active {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #fff;
}

.page-header h1 {
  margin: 0;
  font-size: 2rem;
  color: var(--ds-text);
  letter-spacing: -0.05em;
}

.subtitle {
  margin: 4px 0 0;
  color: var(--ds-text-soft);
}

.filters-card {
  display: block;
  clear: both;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
  max-width: 100%;
}

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  min-width: 0;
}

.filter-field:first-child {
  width: 240px;
}

.filter-field-search {
  width: 240px;
}

.filters select,
.filters input,
.form-row input,
.form-row select {
  box-sizing: border-box;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  height: 48px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.88);
  line-height: 40px;
  font: inherit;
}

.filters select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 36px;
  background-image: linear-gradient(45deg, transparent 50%, #475569 50%), linear-gradient(135deg, #475569 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.filters input {
  line-height: normal;
}

.filters select,
.filters input {
  width: 100%;
}

.filters select:focus,
.filters input:focus,
.form-row input:focus,
.form-row select:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.34);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.color-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
}

.color-input {
  padding: 4px;
  height: 40px;
}

.status {
  margin: 8px 0;
  padding: 10px;
  border-radius: 18px;
}

.status.error {
  background: #fee2e2;
  color: #991b1b;
}

.status.success {
  background: #dcfce7;
  color: #166534;
}

.table-wrap {
  background: rgba(255, 255, 255, 0.78);
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.products-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0 8px;
}



.products-table th,
.products-table td {
  padding: 10px 12px;
  text-align: left;
  white-space: nowrap;
}

.products-table th:nth-child(1),
.products-table td:nth-child(1) {
  width: 80px;
}

.products-table th:nth-child(2),
.products-table td:nth-child(2) {
  width: 80px;
}

.products-table th:nth-child(4),
.products-table td:nth-child(4) {
  width: 120px;
  text-align: center;
}

.products-table th:nth-child(5),
.products-table td:nth-child(5) {
  width: 165px;
  text-align: center;
}

.products-table th:nth-child(6),
.products-table td:nth-child(6) {
  width: 110px;
  text-align: center;
}

.price-head {
  text-align: center !important;
}

.actions-head {
  text-align: center !important;
}

.products-table thead {
  background: #f2f7fc;
}

.products-table tbody td {
  background: rgba(255, 255, 255, 0.9);
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.products-table tbody td:first-child {
  box-shadow: inset 5px 0 0 var(--row-color, #e2e8f0);
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.products-table tbody td:last-child {
  border-right: 1px solid rgba(148, 163, 184, 0.12);
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.row {
  cursor: pointer;
}

.row:hover {
  background: rgba(245, 249, 253, 0.72);
}

.price {
  text-align: center;
  font-weight: 600;
}

.actions-cell {
  text-align: center;
}

.thumb {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.thumb-fallback {
  display: grid;
  place-items: center;
  color: #94a3b8;
  background: #f8fafc;
}

.empty {
  padding: 18px;
  color: #64748b;
}

.variants-config-section {
  margin-top: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  padding: 18px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.favorites-config-section {
  margin-top: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  padding: 18px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.favorites-config-header,
.variants-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.favorites-config-header h2,
.variants-config-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.favorites-device-meta {
  margin: 4px 0 0;
  color: #64748b;
}

.favorites-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.favorites-toolbar select,
.favorites-toolbar input {
  box-sizing: border-box;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  height: 48px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.88);
  line-height: 40px;
  font: inherit;
  width: 100%;
}

.favorites-toolbar select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 36px;
  background-image: linear-gradient(45deg, transparent 50%, #475569 50%), linear-gradient(135deg, #475569 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.favorites-toolbar select:focus,
.favorites-toolbar input:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.34);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.favorites-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.82fr) minmax(320px, 1fr);
  gap: 14px;
  align-items: start;
}

.favorites-panel {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 14px;
  background: rgba(245, 249, 253, 0.78);
}

.favorites-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.favorites-panel-head h3 {
  margin: 0;
  font-size: 1rem;
}

.favorites-panel-head span {
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 600;
}

.favorites-selected-list,
.favorites-products-list {
  display: grid;
  gap: 8px;
  max-height: 520px;
  overflow: auto;
  padding-right: 2px;
}

.favorite-selected-item,
.favorite-product-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  padding: 10px;
}

.favorite-selected-item {
  box-shadow: inset 5px 0 0 var(--row-color, #e2e8f0);
}

.favorite-product-option {
  width: 100%;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: #0f172a;
}

.favorite-product-option.active {
  border-color: rgba(29, 140, 242, 0.34);
  background: rgba(29, 140, 242, 0.1);
}

.favorite-selected-item div,
.favorite-product-option span:first-child {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.favorite-selected-item strong,
.favorite-product-option strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-selected-item small,
.favorite-product-option small {
  color: #64748b;
}

.favorite-state {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.08);
  color: #334155;
  font-size: 0.78rem;
  font-weight: 700;
}

.favorite-product-option.active .favorite-state {
  background: rgba(29, 140, 242, 0.18);
  color: #075985;
}

.compact-empty {
  padding: 8px 0 0;
}

.variants-family-add {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.variants-family-add input {
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  height: 40px;
  padding: 0 12px;
  width: min(420px, 100%);
}

.variants-family-list {
  display: grid;
  gap: 10px;
}

.variants-family-card {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 14px;
  background: rgba(245, 249, 253, 0.78);
}

.variants-family-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.variants-family-title {
  font-weight: 700;
  color: #0f172a;
}

.variants-inner-list {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}

.variants-inner-item {
  display: grid;
  grid-template-columns: 60px 1fr 140px auto;
  gap: 8px;
  align-items: center;
}

.variants-inner-item input {
  box-sizing: border-box;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  height: 38px;
  padding: 0 10px;
}

.variants-inner-id {
  font-weight: 600;
  color: #475569;
}

.btn-refresh,
.btn-primary,
.btn-secondary {
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 11px 14px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 0.85rem;
}

.btn-refresh,
.btn-secondary {
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(148, 163, 184, 0.18);
  color: var(--ds-text);
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #fff;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-refresh:hover,
.btn-primary:hover,
.btn-secondary:hover {
  transform: translateY(-1px);
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(36, 49, 66, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dialog {
  width: min(980px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 30px;
  padding: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(24px);
  box-shadow: var(--ds-shadow-soft);
}

.dialog h3 {
  margin: 0 0 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.dialog-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.dialog-col {
  min-width: 0;
}

.dialog-col-variants {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  padding: 12px;
  background: rgba(245, 249, 253, 0.78);
}

.dialog-col-variants h4 {
  margin: 0 0 10px;
  font-size: 1rem;
}

.compact-row {
  margin-bottom: 12px;
}

.switch-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  width: fit-content;
}

.switch-field.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.switch-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.switch-slider {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.36);
  transition: background-color 0.2s ease;
}

.switch-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
  transition: transform 0.2s ease;
}

.switch-input:checked + .switch-slider {
  background: var(--ds-primary);
}

.switch-input:checked + .switch-slider::before {
  transform: translateX(18px);
}

.switch-input:focus-visible + .switch-slider {
  outline: 2px solid var(--ds-primary);
  outline-offset: 2px;
}

.switch-text {
  font-weight: 600;
  font-size: 0.9rem;
  color: #334155;
}

.variants-list {
  display: grid;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
  padding-right: 2px;
}

.variant-item {
  display: grid;
  grid-template-columns: 1fr 136px;
  gap: 8px;
  align-items: center;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  padding: 8px;
}

.variant-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.variant-price {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.variant-price span {
  font-size: 0.8rem;
  color: #475569;
}

.variant-price input {
  box-sizing: border-box;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  height: 36px;
  padding: 0 8px;
}

.variants-empty {
  margin: 10px 0 0;
  color: #64748b;
}

.labels-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.labels-input-row input {
  flex: 1;
}

.labels-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.label-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: rgba(29, 140, 242, 0.12);
  color: #0f172a;
  padding: 4px 10px;
  font-size: 0.85rem;
  font-weight: 600;
}

.label-pill-remove {
  border: 0;
  background: rgba(15, 23, 42, 0.12);
  color: #0f172a;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.7rem;
  line-height: 1;
  font-weight: 700;
  padding: 0;
}

.label-pill-remove:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-row label {
  font-weight: 600;
}

.upload-info {
  color: #475569;
}

.field-error {
  color: #b91c1c;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 720px) {
  .filters-card {
    display: block;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .tabs-nav {
    display: flex;
    width: 100%;
  }

  .tab-btn {
    flex: 1;
    text-align: center;
  }

  .filter-field,
  .filter-field:first-child,
  .filter-field-search {
    width: 100%;
  }

  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .favorites-config-header,
  .variants-config-header,
  .favorites-toolbar,
  .variants-family-add {
    flex-direction: column;
    align-items: stretch;
  }

  .favorites-grid {
    grid-template-columns: 1fr;
  }

  .variants-inner-item {
    grid-template-columns: 1fr;
  }
}
</style>
