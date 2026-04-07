<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

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

const LISTINO_PRODUCTS_ENDPOINT = 'http://localhost:8088/api/products'
const ONDA_PUSH_CONFIG_ENDPOINT = 'http://localhost:8088/api/pms/onda/recommendations'

const normalizeProductName = (item) => {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object') return ''
  return String(item.name ?? item.productName ?? item.description ?? item.title ?? '').trim()
}

const normalizeCategoryName = (item) => {
  if (!item || typeof item !== 'object') return ''
  return String(item.name ?? item.category ?? item.description ?? item.title ?? '').trim()
}

const fetchListinoProducts = async () => {
  isLoadingListino.value = true
  try {
    const res = await axios.get(LISTINO_PRODUCTS_ENDPOINT)
    const categories = Array.isArray(res.data) ? res.data : []
    const collected = categories.flatMap((category) => {
      const categoryName = normalizeCategoryName(category) || 'Categoria'
      const products = Array.isArray(category?.products) ? category.products : []
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
    if ((id === null || id === undefined) || !name) return null
    return { id, name, price, imgUrl }
  }

  if (typeof item === 'string' && item.trim()) {
    return { id: `legacy-${item.trim().toLowerCase()}`, name: item.trim(), price: 0, imgUrl: '' }
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
    const res = await axios.get(ONDA_PUSH_CONFIG_ENDPOINT)
    productsBySlot.value = normalizeConfigPayload(res.data)
  } catch (error) {
    console.error('Errore caricamento configurazione Onda da backend', error)
    productsBySlot.value = normalizeConfigPayload({})
  }
}

const addProduct = (slotKey) => {
  const value = (newProduct.value[slotKey] || '').trim()
  if (!value) return

  const matched = listinoProducts.value.find((item) => item.name.toLowerCase() === value.toLowerCase())
  if (!matched) {
    formMessage.value = 'Seleziona un prodotto dalla lista suggerita per mantenere id, nome, prezzo e imgUrl.'
    setTimeout(() => {
      formMessage.value = ''
    }, 3000)
    return
  }

  const alreadyExists = productsBySlot.value[slotKey].some(
    item => String(item.id) === String(matched.id)
  )
  if (alreadyExists) {
    newProduct.value[slotKey] = ''
    return
  }

  productsBySlot.value[slotKey].push({
    id: matched.id,
    name: matched.name,
    price: matched.price,
    imgUrl: matched.imgUrl
  })
  newProduct.value[slotKey] = ''
  activeSlot.value = null
}

const removeProduct = (slotKey, product) => {
  productsBySlot.value[slotKey] = productsBySlot.value[slotKey].filter(item => String(item.id) !== String(product.id))
}

const saveConfig = async () => {
  isSavingConfig.value = true
  try {
    const payload = normalizeConfigPayload(productsBySlot.value)
    await axios.post(ONDA_PUSH_CONFIG_ENDPOINT, payload)
    saveMessage.value = 'Configurazione salvata con successo.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2500)
  } catch (error) {
    console.error('Errore salvataggio configurazione Onda su backend', error)
    saveMessage.value = 'Errore nel salvataggio configurazione.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2500)
  } finally {
    isSavingConfig.value = false
  }
}

const filteredSuggestions = (slotKey) => {
  const query = (newProduct.value[slotKey] || '').trim().toLowerCase()
  if (!query) return []

  return listinoProducts.value
    .filter((item) => item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
    .filter((item) => !productsBySlot.value[slotKey].some((selected) => String(selected.id) === String(item.id)))
    .slice(0, 8)
}

const selectSuggestion = (slotKey, suggestion) => {
  newProduct.value[slotKey] = suggestion.name
  addProduct(slotKey)
}

onMounted(async () => {
  await Promise.all([fetchListinoProducts(), loadConfig()])
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
      <section v-for="slot in slots" :key="slot.key" class="slot-card">
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
              @blur="setTimeout(() => { if (activeSlot === slot.key) activeSlot = null }, 120)"
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
          <button type="button" class="btn-add" @click="addProduct(slot.key)">Aggiungi</button>
        </div>

        <p v-if="isLoadingListino" class="hint">Caricamento prodotti listino...</p>
        <p v-else-if="!listinoProducts.length" class="hint">Nessun prodotto listino disponibile via API.</p>
        <p v-if="formMessage" class="hint error">{{ formMessage }}</p>

        <div v-if="productsBySlot[slot.key].length" class="chips">
          <span v-for="product in productsBySlot[slot.key]" :key="`${slot.key}-${product.id}`" class="chip">
            {{ product.name }} · € {{ Number(product.price || 0).toFixed(2) }}
            <button type="button" class="chip-remove" @click="removeProduct(slot.key, product)">×</button>
          </span>
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

.header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: #1f2937;
}

.subtitle {
  margin-top: 8px;
  color: #6b7280;
}

.slots-grid {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.slot-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 14px;
}

.slot-title-row h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #111827;
}

.slot-title-row small {
  display: block;
  margin-top: 4px;
  color: #6b7280;
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
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.9rem;
}

.suggestions {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  max-height: 220px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  background: #fff;
  cursor: pointer;
}

.suggestion-name {
  color: #111827;
  font-weight: 600;
}

.suggestion-category {
  color: #6b7280;
  font-size: 0.8rem;
}

.suggestion-item:hover {
  background: #eff6ff;
}

.btn-add,
.btn-save,
.chip-remove {
  border: none;
  cursor: pointer;
}

.btn-add {
  background: #1d4ed8;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-weight: 600;
  min-width: 110px;
  flex: 0 0 auto;
  white-space: nowrap;
}

.chips {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1e3a8a;
  padding: 4px 10px;
  font-size: 0.85rem;
}

.chip-remove {
  background: transparent;
  color: #1e3a8a;
  font-size: 1rem;
  line-height: 1;
}

.empty {
  margin: 12px 0 0;
  color: #9ca3af;
  font-size: 0.9rem;
}

.hint {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 0.86rem;
}

.hint.error {
  color: #b91c1c;
}

.footer-actions {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-save {
  background: #16a34a;
  color: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  font-weight: 700;
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
}
</style>
