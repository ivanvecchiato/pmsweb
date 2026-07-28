<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseDb } from '../../services/firebaseClient'

const PRODUCTS_ENDPOINT = '/api/products'
const FIREBASE_MENU_APP_COLLECTION = import.meta.env.VITE_FIREBASE_MENU_APP_COLLECTION || 'menu_app_config'
const FIREBASE_MENU_APP_DOCUMENT = import.meta.env.VITE_FIREBASE_MENU_APP_DOCUMENT || 'default'

const categories = ref([])
const selectedCategory = ref('')
const selectedProducts = ref({})
const productOrder = ref({})
const presentationNames = ref({})
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

const currentProducts = computed(() => {
  const category = categories.value.find(item => item.name === selectedCategory.value)
  return category?.products || []
})

const selectedCount = computed(() =>
  Object.values(selectedProducts.value).filter(Boolean).length
)

const normalizeCategoryName = (category, products) => {
  const directName = category?.category_name
    ?? category?.categoryName
    ?? category?.name
    ?? category?.category
    ?? category?.description

  if (typeof directName === 'string' && directName.trim()) return directName.trim()

  for (const product of products) {
    const productCategory = product?.category_name
      ?? product?.categoryName
      ?? product?.category
      ?? product?.category_description
    if (typeof productCategory === 'string' && productCategory.trim()) return productCategory.trim()
  }

  return 'Categoria'
}

const normalizeCatalog = (payload) => {
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.prodotti)
      ? payload.prodotti
      : Array.isArray(payload?.categories)
        ? payload.categories
        : []

  return values
    .map((category) => {
      const products = Array.isArray(category?.products)
        ? category.products
        : Array.isArray(category?.items)
          ? category.items
          : []
      const name = normalizeCategoryName(category, products)

      return {
        name,
        products: products
          .map((product) => ({
            id: product?.id ?? product?._id,
            name: String(product?.name ?? product?.productName ?? product?.description ?? '').trim(),
            price: Number(product?.price ?? product?.sell_price ?? 0) || 0
          }))
          .filter(product => product.id !== undefined && product.id !== null && product.name)
      }
    })
    .filter(category => category.products.length)
}

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [catalogResponse, configSnapshot] = await Promise.all([
      axios.get(PRODUCTS_ENDPOINT),
      getDoc(doc(getFirebaseDb(), FIREBASE_MENU_APP_COLLECTION, FIREBASE_MENU_APP_DOCUMENT))
    ])

    categories.value = normalizeCatalog(catalogResponse.data)
    selectedCategory.value = categories.value[0]?.name || ''

    const configuredCategories = configSnapshot.exists() && Array.isArray(configSnapshot.data()?.categories)
      ? configSnapshot.data().categories
      : []
    const selected = {}
    const order = {}
    const names = {}

    configuredCategories.forEach((category) => {
      const products = Array.isArray(category?.products) ? category.products : []
      products.forEach((product) => {
        const id = String(product?.id ?? product?.productId ?? '')
        if (!id) return
        selected[id] = true
        order[id] = Number(product?.order) || 0
        const catalogProduct = categories.value
          .flatMap(item => item.products)
          .find(item => String(item.id) === id)
        names[id] = String(product?.presentationName ?? product?.name ?? catalogProduct?.name ?? '').trim()
      })
    })

    selectedProducts.value = selected
    productOrder.value = order
    presentationNames.value = names
  } catch (error) {
    console.error('Errore caricamento configurazione Menu App', error)
    errorMessage.value = 'Impossibile caricare il catalogo o la configurazione Menu App.'
  } finally {
    loading.value = false
  }
}

const toggleProduct = (product, checked) => {
  const id = String(product.id)
  selectedProducts.value = {
    ...selectedProducts.value,
    [id]: checked
  }

  if (checked && !Number(productOrder.value[id])) {
    const maxOrder = Math.max(0, ...Object.values(productOrder.value).map(value => Number(value) || 0))
    productOrder.value = {
      ...productOrder.value,
      [id]: maxOrder + 1
    }
  }

  if (checked && presentationNames.value[id] === undefined) {
    presentationNames.value = {
      ...presentationNames.value,
      [id]: ''
    }
  }
}

const saveConfig = async () => {
  saving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    const productWithoutName = categories.value
      .flatMap(category => category.products)
      .find(product =>
        selectedProducts.value[String(product.id)]
        && !String(presentationNames.value[String(product.id)] || '').trim()
      )

    if (productWithoutName) {
      const category = categories.value.find(item =>
        item.products.some(product => String(product.id) === String(productWithoutName.id))
      )
      selectedCategory.value = category?.name || selectedCategory.value
      errorMessage.value = `Inserisci il nome di presentazione per ${productWithoutName.name}.`
      saving.value = false
      return
    }

    const payload = categories.value
      .map((category, categoryIndex) => ({
        name: category.name,
        order: categoryIndex + 1,
        products: category.products
          .filter(product => selectedProducts.value[String(product.id)])
          .map(product => ({
            id: product.id,
            order: Number(productOrder.value[String(product.id)]) || 0,
            presentationName: String(presentationNames.value[String(product.id)]).trim()
          }))
          .sort((left, right) => left.order - right.order)
      }))
      .filter(category => category.products.length)

    await setDoc(
      doc(getFirebaseDb(), FIREBASE_MENU_APP_COLLECTION, FIREBASE_MENU_APP_DOCUMENT),
      {
        categories: payload,
        updatedAt: serverTimestamp()
      }
    )

    message.value = `Menu App salvato: ${selectedCount.value} prodotti selezionati.`
  } catch (error) {
    console.error('Errore salvataggio configurazione Menu App', error)
    errorMessage.value = 'Salvataggio non riuscito.'
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="menu-app-config">
    <div class="page-header">
      <div>
        <p class="page-subtitle">Seleziona dal listino interno solo i prodotti visibili nell’app e assegna il loro ordine globale.</p>
      </div>
      <button class="save-button" :disabled="loading || saving" @click="saveConfig">
        {{ saving ? 'Salvataggio...' : 'Salva menu' }}
      </button>
    </div>

    <p v-if="message" class="status success">{{ message }}</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>

    <div v-if="loading" class="state-card">Caricamento catalogo...</div>

    <template v-else>
      <div class="category-filter">
        <label for="menu-app-category">Categoria</label>
        <select id="menu-app-category" v-model="selectedCategory">
          <option v-for="category in categories" :key="category.name" :value="category.name">
            {{ category.name }}
          </option>
        </select>
        <span>{{ selectedCount }} prodotti selezionati complessivamente</span>
      </div>

      <div class="products-list">
        <div
          v-for="product in currentProducts"
          :key="product.id"
          class="product-row"
          :class="{ selected: selectedProducts[String(product.id)] }"
        >
          <input
            type="checkbox"
            :checked="selectedProducts[String(product.id)]"
            :aria-label="`Seleziona ${product.name}`"
            @change="toggleProduct(product, $event.target.checked)"
          />
          <span class="product-copy">
            <strong>{{ product.name }}</strong>
            <small>Codice {{ product.id }} · € {{ product.price.toFixed(2) }}</small>
          </span>
          <span class="order-field">
            <span>Ordine</span>
            <input
              v-model.number="productOrder[String(product.id)]"
              type="number"
              min="1"
              :disabled="!selectedProducts[String(product.id)]"
              @click.stop
            />
          </span>
          <label
            v-if="selectedProducts[String(product.id)]"
            class="presentation-field"
          >
            <span>Nome di presentazione nell’app</span>
            <input
              v-model="presentationNames[String(product.id)]"
              type="text"
              maxlength="100"
              :placeholder="product.name"
            />
          </label>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.menu-app-config {
  color: var(--ds-text);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.page-subtitle {
  margin: 0;
}

.save-button {
  border: 0;
  border-radius: 14px;
  padding: 12px 18px;
  background: linear-gradient(135deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(29, 140, 242, 0.2);
}

.save-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.category-filter,
.state-card,
.products-list {
  border: 1px solid var(--ds-border);
  border-radius: 22px;
  background: var(--ds-surface);
  box-shadow: var(--ds-shadow-card);
}

.category-filter {
  display: grid;
  grid-template-columns: auto minmax(220px, 420px) 1fr;
  align-items: center;
  gap: 14px;
  padding: 18px;
}

.category-filter label {
  font-weight: 800;
}

.category-filter select {
  min-height: 44px;
  border: 1px solid var(--ds-border-strong);
  border-radius: 12px;
  padding: 0 12px;
  background: white;
  color: var(--ds-text);
}

.category-filter span {
  color: var(--ds-text-soft);
  font-size: 0.88rem;
}

.products-list {
  margin-top: 16px;
  padding: 10px;
}

.product-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 110px;
  align-items: center;
  gap: 14px;
  border-radius: 16px;
  padding: 13px 14px;
  cursor: pointer;
}

.product-row + .product-row {
  border-top: 1px solid var(--ds-border);
}

.product-row.selected {
  background: var(--ds-primary-soft);
}

.product-row > input {
  width: 18px;
  height: 18px;
}

.product-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-copy small {
  color: var(--ds-text-soft);
}

.order-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ds-text-soft);
  font-size: 0.78rem;
}

.order-field input {
  width: 62px;
  min-height: 38px;
  border: 1px solid var(--ds-border-strong);
  border-radius: 10px;
  padding: 0 8px;
  background: white;
}

.presentation-field {
  grid-column: 2 / 4;
  display: flex;
  flex-direction: column;
  gap: 7px;
  cursor: default;
}

.presentation-field span {
  color: var(--ds-text-soft);
  font-size: 0.78rem;
  font-weight: 700;
}

.presentation-field input {
  min-height: 42px;
  border: 1px solid var(--ds-border-strong);
  border-radius: 10px;
  padding: 0 12px;
  background: white;
  color: var(--ds-text);
}

.status,
.state-card {
  padding: 14px 16px;
}

.status {
  border-radius: 14px;
}

.success {
  color: var(--ds-success);
  background: rgba(39, 179, 106, 0.1);
}

.error {
  color: var(--ds-danger);
  background: rgba(220, 77, 77, 0.1);
}

@media (max-width: 720px) {
  .page-header,
  .category-filter {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .product-row {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .order-field {
    grid-column: 2;
  }

  .presentation-field {
    grid-column: 1 / 3;
  }
}
</style>
