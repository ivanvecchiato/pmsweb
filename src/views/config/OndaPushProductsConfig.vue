<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseDb } from '../../services/firebaseClient'

const slots = [
  { key: 'mattina', label: 'Mattina', hint: 'Prodotti da evidenziare a colazione o inizio giornata' },
  { key: 'aperitivo', label: 'Aperitivo', hint: 'Prodotti da spingere in fascia aperitivo' },
  { key: 'pomeriggio', label: 'Pomeriggio', hint: 'Prodotti consigliati nel pomeriggio' },
  { key: 'dopo_cena', label: 'Dopo cena', hint: 'Prodotti in evidenza per la sera' }
]

const productsBySlot = ref({
  mattina: [],
  aperitivo: [],
  pomeriggio: [],
  dopo_cena: []
})

const listinoProducts = ref([])
const isLoadingListino = ref(false)

const newProduct = ref({
  mattina: '',
  aperitivo: '',
  pomeriggio: '',
  dopo_cena: ''
})

const saveMessage = ref('')
const activeSlot = ref(null)
const isSavingConfig = ref(false)
const formMessage = ref('')
const slotMessages = ref({
  mattina: '',
  aperitivo: '',
  pomeriggio: '',
  dopo_cena: ''
})
const uploadingImages = ref({})
const imagePreviewUrls = ref({})

const LISTINO_PRODUCTS_ENDPOINT = '/api/products'
const FIREBASE_ONDA_COLLECTION = import.meta.env.VITE_FIREBASE_ONDA_COLLECTION || 'onda_push_config'
const LEGACY_FIREBASE_ONDA_DOCUMENT = import.meta.env.VITE_FIREBASE_ONDA_DOCUMENT || 'default'

const normalizeProductName = (item) => {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object') return ''
  return String(item.name ?? item.productName ?? item.description ?? item.title ?? '').trim()
}

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()

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

const inferCategoryFromProducts = (products) => {
  if (!Array.isArray(products)) return ''

  for (const product of products) {
    const categoryName = normalizeCategoryName({
      category: product?.category,
      category_name: product?.category_name,
      categoryName: product?.categoryName,
      categoria: product?.categoria,
      description: product?.category_description ?? product?.categoryDesc
    })
    if (categoryName) return categoryName
  }

  return ''
}

const fetchListinoProducts = async () => {
  isLoadingListino.value = true
  try {
    const res = await axios.get(LISTINO_PRODUCTS_ENDPOINT)
    const categories = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.prodotti)
        ? res.data.prodotti
        : Array.isArray(res.data?.categories)
          ? res.data.categories
          : []
    const collected = categories.flatMap((category) => {
      const products = Array.isArray(category?.products)
        ? category.products
        : Array.isArray(category?.items)
          ? category.items
          : Array.isArray(category?.productList)
            ? category.productList
            : []
      const categoryName = normalizeCategoryName(category) || inferCategoryFromProducts(products) || 'Categoria'
      return products
        .map((product) => ({
          id: product?.id ?? product?._id ?? null,
          name: normalizeProductName(product),
          price: Number(product?.price ?? product?.sell_price ?? product?.listPrice ?? 0) || 0,
          imgUrl: String(product?.imgUrl ?? product?.imageUrl ?? product?.image ?? ''),
          category: categoryName
        }))
        .filter((item) => item.name && item.id !== null && item.id !== undefined)
    })

    const uniqMap = new Map()
    collected.forEach((item) => {
      const key = `${item.name.toLowerCase()}::${item.category.toLowerCase()}`
      if (!uniqMap.has(key)) uniqMap.set(key, item)
    })

    listinoProducts.value = Array.from(uniqMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  } catch (error) {
    console.error('Errore caricamento prodotti listino', error)
    listinoProducts.value = []
  } finally {
    isLoadingListino.value = false
  }
}

const normalizeSavedProduct = (item) => {
  if (item && typeof item === 'object') {
    const id = item.id ?? item.productId ?? null
    const name = String(item.name ?? item.productName ?? '').trim()
    const price = Number(item.price ?? item.productPrice ?? 0) || 0
    const imgUrl = String(item.imgUrl ?? item.imageUrl ?? '').trim()
    const description = String(item.description ?? '').trim()
    if ((id === null || id === undefined) || !name) return null
    return { id, name, price, imgUrl, description }
  }

  if (typeof item === 'string' && item.trim()) {
    return { id: `legacy-${item.trim().toLowerCase()}`, name: item.trim(), price: 0, imgUrl: '', description: '' }
  }

  return null
}

const normalizeSavedArray = (arr) => {
  if (!Array.isArray(arr)) return []
  const map = new Map()
  arr.forEach((item) => {
    const normalized = normalizeSavedProduct(item)
    if (!normalized) return
    const key = String(normalized.id)
    if (!map.has(key)) map.set(key, normalized)
  })
  return Array.from(map.values())
}

const normalizeConfigPayload = (payload) => ({
  mattina: normalizeSavedArray(payload?.mattina),
  aperitivo: normalizeSavedArray(payload?.aperitivo),
  pomeriggio: normalizeSavedArray(payload?.pomeriggio),
  dopo_cena: normalizeSavedArray(payload?.dopo_cena)
})

const loadConfig = async () => {
  try {
    const db = getFirebaseDb()
    const snapshots = await Promise.all(
      slots.map((slot) => getDoc(doc(db, FIREBASE_ONDA_COLLECTION, slot.key)))
    )
    const hasSlotDocuments = snapshots.some((snapshot) => snapshot.exists())

    if (hasSlotDocuments) {
      productsBySlot.value = Object.fromEntries(
        slots.map((slot, index) => {
          const data = snapshots[index].exists() ? snapshots[index].data() : {}
          return [slot.key, normalizeSavedArray(data.products)]
        })
      )
      return
    }

    const legacySnapshot = await getDoc(doc(db, FIREBASE_ONDA_COLLECTION, LEGACY_FIREBASE_ONDA_DOCUMENT))
    productsBySlot.value = normalizeConfigPayload(legacySnapshot.exists() ? legacySnapshot.data() : {})
  } catch (error) {
    console.error('Errore caricamento configurazione Onda da Firebase', error)
    productsBySlot.value = normalizeConfigPayload({})
  }
}

const addProduct = (slotKey) => {
  const value = (newProduct.value[slotKey] || '').trim()
  if (!value) {
    slotMessages.value[slotKey] = 'Cerca e seleziona prima un prodotto dal listino.'
    return
  }

  const matched = listinoProducts.value.find((item) => item.name.toLowerCase() === value.toLowerCase())
  if (!matched) {
    slotMessages.value[slotKey] = 'Seleziona un prodotto dalla lista dei suggerimenti.'
    return
  }

  const alreadyExists = productsBySlot.value[slotKey].some(
    item => String(item.id) === String(matched.id)
  )
  if (alreadyExists) {
    newProduct.value[slotKey] = ''
    slotMessages.value[slotKey] = `${matched.name} è già presente in questa fascia.`
    return
  }

  productsBySlot.value[slotKey].push({
    id: matched.id,
    name: matched.name,
    price: matched.price,
    imgUrl: matched.imgUrl,
    description: ''
  })
  newProduct.value[slotKey] = ''
  activeSlot.value = null
  slotMessages.value[slotKey] = `${matched.name} aggiunto. Ora inserisci la descrizione dedicata.`
}

const removeProduct = (slotKey, product) => {
  productsBySlot.value[slotKey] = productsBySlot.value[slotKey].filter(item => String(item.id) !== String(product.id))
}

const imageUploadKey = (slotKey, product) => `${slotKey}-${product.id}`

const uploadProductImage = async (slotKey, product, event) => {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return

  if (file.size > 8 * 1024 * 1024) {
    slotMessages.value[slotKey] = `Il file pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Il limite è 8 MB.`
    input.value = ''
    return
  }

  const key = imageUploadKey(slotKey, product)
  if (imagePreviewUrls.value[key]?.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreviewUrls.value[key])
  }
  imagePreviewUrls.value = {
    ...imagePreviewUrls.value,
    [key]: URL.createObjectURL(file)
  }
  uploadingImages.value = {
    ...uploadingImages.value,
    [key]: true
  }
  slotMessages.value[slotKey] = ''

  try {
    const res = await axios.post(
      '/api/pms/onda/push-config',
      file,
      {
        params: {
          slot: slotKey,
          productId: product.id
        },
        headers: {
          'Content-Type': file.type
        },
        mbarDirect: true
      }
    )
    product.imgUrl = String(res.data?.imgUrl || '').trim()
    slotMessages.value[slotKey] = `Immagine dedicata di ${product.name} caricata.`
  } catch (error) {
    console.error('Errore upload immagine prodotto Onda', error)
    const serverError = String(error.response?.data?.error || '').trim()
    const messages = {
      invalid_product: 'Prodotto o fascia non validi.',
      unsupported_image_type: `Formato non supportato (${file.type || 'tipo sconosciuto'}). Usa JPG, PNG o WebP.`,
      empty_image: 'Il file selezionato è vuoto.',
      image_too_large: 'Il server ha rifiutato il file perché supera 8 MB.',
      image_upload_failed: 'Il server non riesce a scrivere l’immagine nella cartella di destinazione.'
    }
    slotMessages.value[slotKey] = messages[serverError]
      || `Upload non riuscito${error.response?.status ? ` (HTTP ${error.response.status})` : ': server non raggiungibile'}.`
    URL.revokeObjectURL(imagePreviewUrls.value[key])
    const nextPreviewUrls = { ...imagePreviewUrls.value }
    delete nextPreviewUrls[key]
    imagePreviewUrls.value = nextPreviewUrls
    input.value = ''
  } finally {
    uploadingImages.value = {
      ...uploadingImages.value,
      [key]: false
    }
  }
}

const saveConfig = async () => {
  if (Object.values(uploadingImages.value).some(Boolean)) {
    formMessage.value = 'Attendi il completamento degli upload prima di salvare.'
    return
  }

  const hasMissingDescription = slots.some((slot) =>
    productsBySlot.value[slot.key].some((product) => !String(product.description || '').trim())
  )
  if (hasMissingDescription) {
    formMessage.value = 'Inserisci una descrizione per ogni prodotto suggerito prima di salvare.'
    return
  }

  const hasMissingImage = slots.some((slot) =>
    productsBySlot.value[slot.key].some((product) => !String(product.imgUrl || '').trim())
  )
  if (hasMissingImage) {
    formMessage.value = 'Seleziona un’immagine dedicata per ogni prodotto suggerito prima di salvare.'
    return
  }

  formMessage.value = ''
  isSavingConfig.value = true
  try {
    const payload = normalizeConfigPayload(productsBySlot.value)
    const db = getFirebaseDb()
    await Promise.all(
      slots.map((slot) =>
        setDoc(
          doc(db, FIREBASE_ONDA_COLLECTION, slot.key),
          {
            key: slot.key,
            label: slot.label,
            products: payload[slot.key],
            updatedAt: serverTimestamp()
          }
        )
      )
    )
    saveMessage.value = 'Configurazione salvata con successo.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2500)
  } catch (error) {
    console.error('Errore salvataggio configurazione Onda su Firebase', error)
    saveMessage.value = 'Errore nel salvataggio configurazione.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2500)
  } finally {
    isSavingConfig.value = false
  }
}

const filteredSuggestions = (slotKey) => {
  const query = normalizeSearchText(newProduct.value[slotKey])
  if (!query) return []

  return listinoProducts.value
    .map((item) => ({
      item,
      matchesName: normalizeSearchText(item.name).includes(query),
      matchesCategory: item.category !== 'Categoria' && normalizeSearchText(item.category).includes(query)
    }))
    .filter(({ matchesName, matchesCategory }) => matchesName || matchesCategory)
    .filter(({ item }) => !productsBySlot.value[slotKey].some((selected) => String(selected.id) === String(item.id)))
    .sort((a, b) => Number(b.matchesName) - Number(a.matchesName))
    .slice(0, 20)
    .map(({ item }) => item)
}

const canAddProduct = (slotKey) => {
  const value = (newProduct.value[slotKey] || '').trim().toLowerCase()
  if (!value) return false
  return listinoProducts.value.some((item) =>
    item.name.toLowerCase() === value
    && !productsBySlot.value[slotKey].some((selected) => String(selected.id) === String(item.id))
  )
}

const selectSuggestion = (slotKey, suggestion) => {
  newProduct.value[slotKey] = suggestion.name
  activeSlot.value = null
  slotMessages.value[slotKey] = `${suggestion.name} selezionato. Premi “Aggiungi prodotto” per inserirlo nella fascia.`
}

const closeSuggestions = (slotKey) => {
  window.setTimeout(() => {
    if (activeSlot.value === slotKey) activeSlot.value = null
  }, 120)
}

const handleProductInput = (slotKey) => {
  slotMessages.value[slotKey] = ''
}

onMounted(async () => {
  await Promise.all([fetchListinoProducts(), loadConfig()])
})

onBeforeUnmount(() => {
  Object.values(imagePreviewUrls.value).forEach((previewUrl) => {
    if (String(previewUrl).startsWith('blob:')) URL.revokeObjectURL(previewUrl)
  })
})
</script>

<template>
  <div class="config-page">
    <div class="header">
      <h1>Prodotti in evidenza su Onda</h1>
      <p class="subtitle">
        Definisci i prodotti da spingere nelle fasce orarie mostrate prima dell’elenco prodotti sull’app Onda.
      </p>
    </div>

    <div class="slots-grid">
      <section
        v-for="slot in slots"
        :key="slot.key"
        class="slot-card"
        :class="{ 'slot-card-active': activeSlot === slot.key }"
      >
        <div class="slot-title-row">
          <h2>{{ slot.label }}</h2>
          <small>{{ slot.hint }}</small>
        </div>

        <div class="add-row">
          <div class="search-wrap">
            <input
              v-model="newProduct[slot.key]"
              type="text"
              :placeholder="`Cerca prodotto listino per ${slot.label.toLowerCase()}`"
              @focus="activeSlot = slot.key"
              @input="handleProductInput(slot.key)"
              @blur="closeSuggestions(slot.key)"
              @keyup.enter="addProduct(slot.key)"
            />
            <div
              v-if="activeSlot === slot.key && filteredSuggestions(slot.key).length"
              class="suggestions"
            >
              <button
                v-for="suggestion in filteredSuggestions(slot.key)"
                :key="`${slot.key}-${suggestion.name}-${suggestion.category}`"
                type="button"
                class="suggestion-item"
                @mousedown.prevent="selectSuggestion(slot.key, suggestion)"
              >
                <span class="suggestion-name">{{ suggestion.name }}</span>
                <span class="suggestion-category">{{ suggestion.category }}</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            class="btn-add"
            :disabled="!canAddProduct(slot.key)"
            @click="addProduct(slot.key)"
          >
            Aggiungi prodotto
          </button>
        </div>

        <p v-if="isLoadingListino" class="hint">Caricamento prodotti listino...</p>
        <p v-else-if="!listinoProducts.length" class="hint">Nessun prodotto listino disponibile via API.</p>
        <p v-if="slotMessages[slot.key]" class="hint slot-message">{{ slotMessages[slot.key] }}</p>
        <p v-else-if="!newProduct[slot.key]" class="hint">Cerca un prodotto, selezionalo dall’elenco e aggiungilo alla fascia.</p>
        <p v-if="formMessage" class="hint error">{{ formMessage }}</p>

        <div v-if="productsBySlot[slot.key].length" class="associated-products">
          <div v-for="product in productsBySlot[slot.key]" :key="`${slot.key}-${product.id}`" class="associated-product">
            <div class="associated-product-header">
              <span>{{ product.name }} · € {{ Number(product.price || 0).toFixed(2) }}</span>
              <button type="button" class="chip-remove" aria-label="Rimuovi prodotto" @click="removeProduct(slot.key, product)">×</button>
            </div>
            <textarea
              v-model="product.description"
              rows="3"
              :placeholder="`Descrizione di ${product.name} per la fascia ${slot.label.toLowerCase()}`"
            ></textarea>
            <div class="product-image-row">
              <img
                v-if="imagePreviewUrls[imageUploadKey(slot.key, product)] || product.imgUrl"
                :src="imagePreviewUrls[imageUploadKey(slot.key, product)] || product.imgUrl"
                :alt="`Immagine Onda di ${product.name}`"
              />
              <span v-else class="product-image-placeholder">Nessuna immagine dedicata</span>
              <label class="btn-image" :class="{ disabled: uploadingImages[imageUploadKey(slot.key, product)] }">
                {{ uploadingImages[imageUploadKey(slot.key, product)] ? 'Caricamento...' : 'Seleziona immagine' }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  :disabled="uploadingImages[imageUploadKey(slot.key, product)]"
                  @change="uploadProductImage(slot.key, product, $event)"
                />
              </label>
            </div>
          </div>
        </div>
        <p v-else class="empty">Nessun prodotto configurato.</p>
      </section>
    </div>

    <div class="footer-actions">
      <button type="button" class="btn-save" :disabled="isSavingConfig" @click="saveConfig">
        {{ isSavingConfig ? 'Salvataggio...' : 'Salva configurazione' }}
      </button>
      <span v-if="saveMessage" class="save-message">{{ saveMessage }}</span>
    </div>
  </div>
</template>

<style scoped>
.config-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px;
}

.header {
  padding: 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.header h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ds-text);
}

.subtitle {
  margin-top: 8px;
  color: var(--ds-text-soft);
}

.slots-grid {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.slot-card {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  padding: 18px;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.slot-card-active {
  z-index: 30;
}

.slot-title-row h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--ds-text);
  font-weight: 800;
}

.slot-title-row small {
  display: block;
  margin-top: 4px;
  color: var(--ds-text-soft);
}

.add-row {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.add-row input {
  width: 100%;
  box-sizing: border-box;
  min-height: 48px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  padding: 0 14px;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
}

.add-row input:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.suggestions {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  box-shadow: var(--ds-shadow-soft);
  max-height: 220px;
  overflow-y: auto;
  backdrop-filter: blur(18px);
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.suggestion-name {
  color: var(--ds-text);
  font-weight: 700;
}

.suggestion-category {
  color: var(--ds-text-soft);
  font-size: 0.8rem;
}

.suggestion-item:hover {
  background: rgba(231, 242, 255, 0.9);
}

.btn-add,
.btn-save,
.chip-remove {
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-add {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #fff;
  border-radius: 16px;
  padding: 12px 14px;
  font-weight: 700;
  min-width: 110px;
  flex: 0 0 auto;
  white-space: nowrap;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-add:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.slot-message {
  color: var(--ds-primary-strong);
  font-weight: 600;
}

.associated-products {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.associated-product {
  border-radius: 16px;
  border: 1px solid rgba(29, 140, 242, 0.16);
  background: rgba(231, 242, 255, 0.92);
  padding: 10px 12px;
}

.associated-product-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--ds-primary-strong);
  font-size: 0.85rem;
  font-weight: 600;
}

.associated-product textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: 8px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  padding: 10px 12px;
  resize: vertical;
  font: inherit;
  color: var(--ds-text);
  background: rgba(255, 255, 255, 0.92);
}

.associated-product textarea:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 3px rgba(29, 140, 242, 0.1);
}

.product-image-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.product-image-row img,
.product-image-placeholder {
  width: 72px;
  height: 54px;
  flex: 0 0 auto;
  border-radius: 10px;
}

.product-image-row img {
  object-fit: cover;
}

.product-image-placeholder {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 5px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ds-text-muted);
  font-size: 0.65rem;
  line-height: 1.15;
  text-align: center;
}

.btn-image {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  border: 1px solid rgba(29, 140, 242, 0.25);
  border-radius: 12px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-primary-strong);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-image.disabled {
  opacity: 0.55;
  cursor: wait;
}

.btn-image input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.chip-remove {
  background: transparent;
  color: var(--ds-primary-strong);
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.empty {
  margin: 12px 0 0;
  color: var(--ds-text-muted);
  font-size: 0.9rem;
}

.hint {
  margin: 8px 0 0;
  color: var(--ds-text-soft);
  font-size: 0.86rem;
}

.hint.error {
  color: var(--ds-danger);
}

.footer-actions {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-save {
  background: linear-gradient(180deg, #22c55e, #16a34a);
  color: #fff;
  border-radius: 16px;
  padding: 12px 16px;
  font-weight: 700;
  box-shadow: 0 18px 28px rgba(34, 197, 94, 0.18);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-message {
  color: #15803d;
  font-weight: 600;
}

@media (max-width: 640px) {
  .add-row {
    flex-direction: column;
  }

  .btn-add {
    width: 100%;
  }

  .header,
  .slot-card {
    border-radius: 24px;
  }
}
</style>
