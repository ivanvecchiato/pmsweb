<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

// --- STATO DATI ---
const products = ref([]);
const loading = ref(false);
const searchQuery = ref('');

// --- STATO MODALE ---
const isModalOpen = ref(false);
const selectedProduct = ref(null);
const movementData = ref({
  type: 'purchase',
  quantity: 1,
  note: ''
});

const movementTypes = [
  { id: 'purchase', label: 'Acquisto', icon: '📥' },
  { id: 'manual_out', label: 'Scarico', icon: '📤' },
  { id: 'self_consumption', label: 'Autoconsumo', icon: '🍴' },
  { id: 'correction', label: 'Rettifica', icon: '⚙️' }
];

// --- STATO STATISTICHE ---
const stats = ref({
  purchase: { totalValue: 0, items: 0 },
  breakage: { totalValue: 0, items: 0 },
  expired: { totalValue: 0, items: 0 },
  self_consumption: { totalValue: 0, items: 0 }
});

const fetchStats = async () => {
  try {
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await axios.get(`http://localhost:8088/api/inventory/stats`, {
      params: { start, end }
    });
    stats.value = res.data;
  } catch (err) {
    console.error("Errore caricamento statistiche:", err);
  }
};

const fetchInventory = async () => {
  loading.value = true;
  try {
    const res = await axios.get('http://localhost:8088/api/inventory');
    products.value = res.data;
  } catch (err) {
    console.error("Errore API Inventory:", err);
  } finally {
    loading.value = false;
  }
};

const confirmMovement = async () => {
  try {
    await axios.post('http://localhost:8088/api/inventory/movement', {
      productId: selectedProduct.value.id,
      ...movementData.value
    });
    isModalOpen.value = false;
    await Promise.all([fetchInventory(), fetchStats()]);
  } catch (err) {
    alert("Errore salvataggio");
  }
};

const filteredProducts = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return products.value
    .filter(p => {
      const productName = p.name.toLowerCase();
      // Cerchiamo nel primo fornitore disponibile
      const supplierName = p.inventory.suppliers?.[0]?.supplier?.toLowerCase() || '';
      return productName.includes(query) || supplierName.includes(query);
    })
    .map(p => {
      const margin = p.price - p.purchase_price;
      const marginPercent = p.price > 0 ? (margin / p.price) * 100 : 0;
      return { ...p, margin, marginPercent };
    });
});

const openMovementModal = (product, type = 'purchase') => {
  selectedProduct.value = product;
  movementData.value.type = type;
  movementData.value.quantity = (type === 'correction') ? product.inventory.stock : 1;
  movementData.value.note = '';
  isModalOpen.value = true;
};

onMounted(() => {
  fetchInventory();
  fetchStats();
});
</script>

<template>
  <div class="inventory-view">
    <header class="inv-header">
      <div class="title-group">
        <h1>Gestione Magazzino</h1>
        <p class="subtitle">
          {{ filteredProducts.length }} prodotti trovati 
          <span v-if="searchQuery">per "{{ searchQuery }}"</span>
        </p>
      </div>
      <div class="header-actions">
        <div class="search-container">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input v-model="searchQuery" placeholder="Cerca prodotto o fornitore..." class="search-input" />
        </div>
        <button @click="fetchInventory" class="btn-refresh" :disabled="loading">
          {{ loading ? '...' : 'Sincronizza' }}
        </button>
      </div>
    </header>

    <div class="stats-overview">
      <div class="stat-card blue">
        <label>Acquisti (30gg)</label>
        <div class="st-val">€ {{ stats.purchase?.totalValue.toFixed(2) || '0.00' }}</div>
      </div>
      <div class="stat-card red">
        <label>Perdite & Sprechi</label>
        <div class="st-val">€ {{ ((stats.breakage?.totalValue || 0) + (stats.expired?.totalValue || 0)).toFixed(2) }}</div>
      </div>
      <div class="stat-card orange">
        <label>Autoconsumo</label>
        <div class="st-val">€ {{ stats.self_consumption?.totalValue.toFixed(2) || '0.00' }}</div>
      </div>
    </div>

    <div class="table-container">
      <table class="styled-table">
        <thead>
          <tr>
            <th>Prodotto / Fornitore</th>
            <th class="text-center">Giacenza</th>
            <th>Prezzo</th>
            <th>Costo</th>
            <th>Margine</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProducts" :key="p.id" :class="{ 'row-alert': p.inventory.stock <= p.inventory.alarm }">
            <td class="product-cell">
              <div class="image-box">
                <img v-if="p.imgUrl" :src="`http://localhost:8088${p.imgUrl}`" class="prod-img" />
                <div v-else class="img-placeholder">🖼️</div>
              </div>
              <div class="product-details">
                <span class="p-name">{{ p.name }}</span>
                <span class="p-supplier">
                  🏢 {{ p.inventory.suppliers?.[0]?.supplier || 'Fornitore non settato' }}
                </span>
              </div>
            </td>
            <td class="text-center">
              <span class="badge-stock" :class="p.inventory.stock <= p.inventory.alarm ? 'bg-danger' : 'bg-success'">
                {{ p.inventory.stock }}
              </span>
            </td>
            <td class="font-mono">€ {{ p.price.toFixed(2) }}</td>
            <td class="font-mono text-muted">€ {{ p.purchase_price.toFixed(2) }}</td>
            <td>
              <div class="margin-info">
                <span class="m-val">€ {{ p.margin.toFixed(2) }}</span>
                <span class="m-perc" :class="p.marginPercent < 20 ? 'text-red' : ''">
                  {{ p.marginPercent.toFixed(1) }}%
                </span>
              </div>
            </td>
            <td class="text-right">
              <div class="btn-group-actions">
                <button @click="openMovementModal(p, 'purchase')" class="btn-sm btn-in">+</button>
                <button @click="openMovementModal(p, 'manual_out')" class="btn-sm btn-out">-</button>
                <button @click="openMovementModal(p, 'correction')" class="btn-sm btn-cfg">⚙</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <Transition name="fade-scale">
        <div v-if="isModalOpen" class="modal-backdrop" @click.self="isModalOpen = false">
          <div class="modal-card">
            <div class="modal-header">
              <div class="m-title">
                <h3>{{ selectedProduct?.name }}</h3>
                <small>Attuale: {{ selectedProduct?.inventory.stock }} | Fornitore: {{ selectedProduct?.inventory.suppliers?.[0]?.supplier || 'N/D' }}</small>
              </div>
              <button @click="isModalOpen = false" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
              <div class="causal-grid">
                <div v-for="t in movementTypes" :key="t.id" class="causal-item" :class="{ active: movementData.type === t.id }" @click="movementData.type = t.id">
                  <span class="c-icon">{{ t.icon }}</span>
                  <span class="c-label">{{ t.label }}</span>
                </div>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label>{{ movementData.type === 'correction' ? 'Nuova Giacenza' : 'Quantità' }}</label>
                  <input type="number" v-model.number="movementData.quantity" class="input-main" />
                </div>
                <div class="form-group">
                  <label>Note</label>
                  <input type="text" v-model="movementData.note" placeholder="es. Carico merce" class="input-main" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="isModalOpen = false" class="btn-ghost">Annulla</button>
              <button @click="confirmMovement" class="btn-dark">Conferma</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.inventory-view { padding: 40px; background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; color: #1e293b; }
.inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.title-group h1 { font-size: 1.8rem; font-weight: 800; margin: 0; }
.subtitle { color: #64748b; font-size: 0.9rem; margin: 5px 0 0 0; }

.search-container { background: white; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; padding: 0 15px; }
.search-input { border: none; padding: 12px; outline: none; width: 250px; }

.stats-overview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
.stat-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; border-left: 5px solid #cbd5e1; }
.stat-card.blue { border-left-color: #3b82f6; }
.stat-card.red { border-left-color: #ef4444; }
.stat-card.orange { border-left-color: #f59e0b; }
.stat-card label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
.st-val { font-size: 1.5rem; font-weight: 800; }

.table-container { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
.styled-table { width: 100%; border-collapse: collapse; }
.styled-table th { background: #f8fafc; padding: 16px; text-align: left; font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
.styled-table td { padding: 16px; border-bottom: 1px solid #f1f5f9; }

.product-cell { display: flex; align-items: center; gap: 12px; }
.image-box { width: 44px; height: 44px; border-radius: 8px; background: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; }
.prod-img { width: 100%; height: 100%; object-fit: cover; }
.p-name { display: block; font-weight: 700; }
.p-supplier { font-size: 0.75rem; color: #6366f1; font-weight: 600; } /* Colore distintivo per il fornitore */

.badge-stock { padding: 4px 10px; border-radius: 6px; font-weight: 700; }
.bg-success { background: #ecfdf5; color: #059669; }
.bg-danger { background: #fef2f2; color: #dc2626; }

.margin-info { display: flex; flex-direction: column; }
.m-perc { font-size: 0.75rem; font-weight: 800; color: #10b981; }
.text-red { color: #ef4444; }

.btn-group-actions { display: flex; gap: 6px; justify-content: flex-end; }
.btn-sm { width: 32px; height: 32px; border-radius: 8px; border: none; cursor: pointer; color: white; font-weight: bold; }
.btn-in { background: #10b981; }
.btn-out { background: #f59e0b; }
.btn-cfg { background: #64748b; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-card { background: white; width: 500px; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
.modal-header { padding: 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
.m-title h3 { margin: 0; }
.causal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 20px; }
.causal-item { padding: 12px; border: 2px solid #f1f5f9; border-radius: 12px; cursor: pointer; text-align: center; }
.causal-item.active { background: #1e293b; color: white; border-color: #1e293b; }
.form-grid { padding: 0 20px 20px; display: grid; gap: 15px; }
.input-main { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; }
.modal-footer { padding: 15px 20px; background: #f8fafc; display: flex; justify-content: flex-end; gap: 10px; }
.btn-dark { background: #1e293b; color: white; padding: 10px 20px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }
.btn-ghost { background: transparent; border: none; color: #64748b; cursor: pointer; }

.text-center { text-align: center; }
.text-right { text-align: right; }
.font-mono { font-family: monospace; }
.text-muted { color: #94a3b8; }
.subtitle span {
  color: #3b82f6;
  font-weight: 600;
}

/* Effetto focus sulla ricerca coerente con il form prenotazioni */
.search-container:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  transition: all 0.2s ease;
}
</style>