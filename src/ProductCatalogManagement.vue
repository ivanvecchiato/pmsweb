<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const PRODUCTS_ENDPOINT = '/api/products'
const VARIANTS_ENDPOINT = '/api/variants'
const DEFAULT_PRODUCTS_ORIGIN = import.meta.env.DEV ? 'http://localhost:8088' : window.location.origin
const PRODUCTS_ORIGIN = (import.meta.env.VITE_API_TARGET_ORIGIN || DEFAULT_PRODUCTS_ORIGIN).replace(/\/+$/, '')

const categories = ref([])
const variantFamilies = ref([])
const activeTab = ref('products')
const selectedCategory = ref('')
const searchQuery = ref('')
const loading = ref(false)
const loadingVariants = ref(false)
const savingVariantsConfig = ref(false)
const errorMessage = ref('')
const saveMessage = ref('')
const variantsConfigMessage = ref('')
const variantsConfigError = ref('')
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
  auto: false,
  variants: {
    auto: false,
    vars: []
  }
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

  return {
    id,
    name: String(product?.name ?? product?.productName ?? product?.description ?? product?.title ?? '').trim(),
    price: Number(product?.price ?? product?.sell_price ?? product?.listPrice ?? 0) || 0,
    purchase_price: Number(product?.purchase_price ?? product?.purchasePrice ?? product?.cost ?? 0) || 0,
    imageUrl,
    color,
    category: categoryName,
    auto: normalizedVariants.auto,
    variants: normalizedVariants
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
    auto: false,
    variants: emptyVariants()
  }
  editingProduct.value = null
  isCreatingProduct.value = true
  selectedImageName.value = ''
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const duplicateProduct = (product) => {
  const normalizedVariants = normalizeVariantsPayload(product?.variants, product?.auto ?? product?.audo)
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
    auto: toBoolean(normalizedVariants.auto),
    variants: normalizedVariants
  }
  editingProduct.value = null
  isCreatingProduct.value = true
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const openEditDialog = (product) => {
  const normalizedVariants = normalizeVariantsPayload(product?.variants, product?.auto ?? product?.audo)
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
    auto: toBoolean(normalizedVariants.auto),
    variants: normalizedVariants
  }
  editingProduct.value = product
  isCreatingProduct.value = false
  selectedImageName.value = ''
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const closeDialog = () => {
  isDialogOpen.value = false
  editingProduct.value = null
  isCreatingProduct.value = false
  selectedImageName.value = ''
}

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

  const payload = {
    id: form.value.id,
    name: String(form.value.name).trim(),
    price: Number(form.value.price) || 0,
    purchase_price: Number(form.value.purchase_price) || 0,
    imgUrl: form.value.imageUrl.trim(),
    color: form.value.color,
    category: form.value.category,
    auto: toBoolean(form.value.auto),
    variants: {
      auto: toBoolean(form.value.auto),
      vars: normalizedVariants.vars
    }
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
        auto: payload.auto,
        variants: payload.variants
      }

      const res = await axios.post(PRODUCTS_ENDPOINT, createPayload)
      const createdRaw = res?.data && typeof res.data === 'object' ? res.data : {}
      const createdId = createdRaw.id ?? createdRaw._id ?? null
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
          auto: payload.auto,
          variants: payload.variants
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
          category.products[index] = {
            ...category.products[index],
            name: payload.name,
            price: payload.price,
            purchase_price: payload.purchase_price,
            imageUrl: payload.imgUrl,
            color: payload.color,
            auto: payload.auto,
            variants: payload.variants
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
          class="btn-refresh"
          :disabled="loading || loadingVariants"
          @click="activeTab === 'products' ? fetchProducts() : fetchVariantFamilies()"
        >
          {{ activeTab === 'products'
            ? (loading ? 'Caricamento...' : 'Aggiorna prodotti')
            : (loadingVariants ? 'Caricamento...' : 'Aggiorna varianti') }}
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

    <section v-else class="variants-config-section">
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
  </div>
</template>

<style scoped>
.catalog-page {
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.tabs-nav {
  display: flex;
  width: fit-content;
  gap: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 4px;
  background: #f8fafc;
  margin-bottom: 12px;
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
  background: #1976d2;
  color: #fff;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.subtitle {
  margin: 4px 0 0;
  color: #64748b;
}

.filters-card {
  display: block;
  clear: both;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
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
  border: 1px solid #d1d5db;
  border-radius: 8px;
  height: 42px;
  padding: 0 12px;
  background: #fff;
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
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.12);
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
  border-radius: 8px;
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
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
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
  background: #f8fafc;
}

.products-table tbody td {
  background: #ffffff;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
}

.products-table tbody td:first-child {
  box-shadow: inset 5px 0 0 var(--row-color, #e2e8f0);
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.products-table tbody td:last-child {
  border-right: 1px solid #f1f5f9;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.row {
  cursor: pointer;
}

.row:hover {
  background: #f8fafc;
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
  border-radius: 8px;
  border: 1px solid #e5e7eb;
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
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
}

.variants-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.variants-config-header h2 {
  margin: 0;
  font-size: 1.2rem;
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
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  background: #f8fafc;
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
  border: 1px solid #d1d5db;
  border-radius: 8px;
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
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font: inherit;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 0.85rem;
}

.btn-refresh,
.btn-secondary {
  background: #fff;
  border-color: #d1d5db;
}

.btn-primary {
  background: #1976d2;
  color: #fff;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 16px;
}

.dialog {
  width: min(980px, 100%);
  background: #fff;
  border-radius: 12px;
  padding: 16px;
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
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  background: #f8fafc;
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
  background: #cbd5e1;
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
  background: #1976d2;
}

.switch-input:checked + .switch-slider::before {
  transform: translateX(18px);
}

.switch-input:focus-visible + .switch-slider {
  outline: 2px solid #1976d2;
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
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
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
  border: 1px solid #d1d5db;
  border-radius: 8px;
  height: 36px;
  padding: 0 8px;
}

.variants-empty {
  margin: 10px 0 0;
  color: #64748b;
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
  margin-top: 12px;
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

  .variants-config-header,
  .variants-family-add {
    flex-direction: column;
    align-items: stretch;
  }

  .variants-inner-item {
    grid-template-columns: 1fr;
  }
}
</style>
