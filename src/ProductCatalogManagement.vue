<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const PRODUCTS_ENDPOINT = '/api/products'
const PRODUCTS_ORIGIN = import.meta.env.VITE_API_TARGET_ORIGIN || window.location.origin

const categories = ref([])
const selectedCategory = ref('')
const loading = ref(false)
const errorMessage = ref('')
const saveMessage = ref('')
const brokenImages = ref({})

const isDialogOpen = ref(false)
const saving = ref(false)
const editingProduct = ref(null)
const isCreatingProduct = ref(false)
const form = ref({
  id: '',
  name: '',
  price: 0,
  imageUrl: '',
  color: '#1976d2',
  category: ''
})

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
  const imageUrl = rawImage
    ? (rawImage.startsWith('http://') || rawImage.startsWith('https://')
      ? rawImage
      : `${PRODUCTS_ORIGIN}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`)
    : ''

  return {
    id,
    name: String(product?.name ?? product?.productName ?? product?.description ?? product?.title ?? '').trim(),
    price: Number(product?.price ?? product?.sell_price ?? product?.listPrice ?? 0) || 0,
    imageUrl,
    color,
    category: categoryName
  }
}

const normalizeResponse = (payload) => {
  const rawCategories = Array.isArray(payload)
    ? payload
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

const selectedProducts = computed(() => {
  const category = categories.value.find((item) => item.name === selectedCategory.value)
  if (!category) return []
  return [...category.products].sort((a, b) => a.name.localeCompare(b.name, 'it'))
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

const selectedImageName = ref('')

const ensureCategoryExists = (categoryName) => {
  if (!categoryName) return null
  let category = categories.value.find((item) => item.name === categoryName)
  if (!category) {
    category = { name: categoryName, products: [] }
    categories.value.push(category)
  }
  return category
}

const openCreateDialog = () => {
  form.value = {
    id: '',
    name: '',
    price: 0,
    imageUrl: '',
    color: '#1976d2',
    category: selectedCategory.value || availableCategoryNames.value[0] || ''
  }
  editingProduct.value = null
  isCreatingProduct.value = true
  selectedImageName.value = ''
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const duplicateProduct = (product) => {
  form.value = {
    id: '',
    name: `${product.name} copia`,
    price: Number(product.price || 0),
    imageUrl: product.imageUrl || '',
    color: product.color || '#1976d2',
    category: product.category || selectedCategory.value || availableCategoryNames.value[0] || ''
  }
  editingProduct.value = null
  isCreatingProduct.value = true
  saveMessage.value = ''
  errorMessage.value = ''
  isDialogOpen.value = true
}

const openEditDialog = (product) => {
  form.value = {
    id: String(product.id),
    name: product.name,
    price: Number(product.price || 0),
    imageUrl: product.imageUrl || '',
    color: product.color || '#1976d2',
    category: product.category
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

  saving.value = true
  saveMessage.value = ''
  errorMessage.value = ''

  const payload = {
    id: form.value.id,
    name: form.value.name.trim(),
    price: Number(form.value.price) || 0,
    imgUrl: form.value.imageUrl.trim(),
    color: form.value.color,
    category: form.value.category
  }

  try {
    if (isCreatingProduct.value) {
      const createPayload = {
        name: payload.name,
        price: payload.price,
        imgUrl: payload.imgUrl,
        color: payload.color,
        category: payload.category,
        category_name: payload.category
      }

      const res = await axios.post(PRODUCTS_ENDPOINT, createPayload)
      const createdRaw = res?.data && typeof res.data === 'object' ? res.data : {}
      const createdId = createdRaw.id ?? createdRaw._id ?? null
      const category = ensureCategoryExists(payload.category)
      if (category && createdId !== null && createdId !== undefined) {
        category.products.push({
          id: createdId,
          name: payload.name,
          price: payload.price,
          imageUrl: payload.imgUrl,
          color: payload.color,
          category: payload.category
        })
        selectedCategory.value = payload.category
      } else {
        await fetchProducts()
      }
      saveMessage.value = 'Prodotto creato con successo.'
    } else {
      await axios.put(`${PRODUCTS_ENDPOINT}/${encodeURIComponent(form.value.id)}`, payload)

      const category = categories.value.find((item) => item.name === form.value.category)
      if (category) {
        const index = category.products.findIndex((item) => String(item.id) === String(form.value.id))
        if (index >= 0) {
          category.products[index] = {
            ...category.products[index],
            name: payload.name,
            price: payload.price,
            imageUrl: payload.imgUrl,
            color: payload.color
          }
        }
      }
      saveMessage.value = 'Anagrafica prodotto aggiornata con successo.'
    }
    closeDialog()
  } catch (error) {
    console.error('Errore salvataggio anagrafica prodotto', error)
    errorMessage.value = isCreatingProduct.value
      ? 'Creazione non riuscita. Verifica endpoint creazione prodotto.'
      : 'Salvataggio non riuscito. Verifica endpoint aggiornamento prodotto.'
  } finally {
    saving.value = false
  }
}

onMounted(fetchProducts)
</script>

<template>
  <div class="catalog-page">
    <header class="page-header">
      <div>
        <h1>Listino Prodotti</h1>
        <p class="subtitle">Gestione anagrafiche prodotti per categoria</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" :disabled="loading || !availableCategoryNames.length" @click="openCreateDialog">
          Nuovo prodotto
        </button>
        <button class="btn-refresh" :disabled="loading" @click="fetchProducts">
          {{ loading ? 'Caricamento...' : 'Aggiorna' }}
        </button>
      </div>
    </header>

    <div class="filters">
      <label for="category-select">Categoria</label>
      <select id="category-select" v-model="selectedCategory" :disabled="loading || !categories.length">
        <option v-for="category in categories" :key="category.name" :value="category.name">
          {{ category.name }}
        </option>
      </select>
    </div>

    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
    <p v-if="saveMessage" class="status success">{{ saveMessage }}</p>

    <div class="table-wrap">
      <table v-if="selectedProducts.length" class="products-table">
        <thead>
          <tr>
            <th style="width: 80px;">ID</th>
            <th style="width: 80px;">Thumb</th>
            <th>Nome</th>
            <th style="width: 120px; text-align: right;">Prezzo</th>
            <th style="width: 110px; text-align: center;">Azioni</th>
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
            <td class="actions-cell">
              <button class="btn-secondary btn-sm" @click.stop="duplicateProduct(product)">Duplica</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Nessun prodotto disponibile per la categoria selezionata.</p>
    </div>

    <div v-if="isDialogOpen" class="dialog-backdrop" @click.self="closeDialog">
      <div class="dialog">
        <h3>{{ dialogTitle }}</h3>

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
        </div>

        <div class="form-row">
          <label>Prezzo</label>
          <input v-model.number="form.price" type="number" step="0.01" min="0" />
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

        <div class="dialog-actions">
          <button class="btn-secondary" :disabled="saving" @click="closeDialog">Annulla</button>
          <button class="btn-primary" :disabled="saving || !form.name.trim() || !form.category" @click="saveProduct">
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

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.subtitle {
  margin: 4px 0 0;
  color: #64748b;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  max-width: 320px;
}

.filters label {
  font-weight: 600;
}

.filters select,
.form-row input,
.form-row select {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
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
  border-collapse: separate;
  border-spacing: 0 8px;
}

.products-table th,
.products-table td {
  padding: 10px 12px;
  text-align: left;
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
  border-left: 5px solid var(--row-color, #e2e8f0);
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
  text-align: right;
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
  width: min(540px, 100%);
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

.form-row label {
  font-weight: 600;
}

.upload-info {
  color: #475569;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
