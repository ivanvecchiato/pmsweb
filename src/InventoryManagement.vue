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

// --- LOGICA ---
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

const filteredProducts = computed(() => {
  return products.value
    .filter(p => p.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .map(p => {
      const margin = p.price - p.purchase_price;
      const marginPercent = p.price > 0 ? (margin / p.price) * 100 : 0;
      return { ...p, margin, marginPercent };
    });
});

const openMovementModal = (product, type = 'purchase') => {
  selectedProduct.value = product;
  movementData.value.type = type;
  // Se è rettifica, proponiamo lo stock attuale da correggere, altrimenti 1
  movementData.value.quantity = (type === 'correction') ? product.inventory.stock : 1;
  movementData.value.note = '';
  isModalOpen.value = true;
};

const confirmMovement = async () => {
  try {
    await axios.post('http://localhost:8088/api/inventory/movement', {
      productId: selectedProduct.value.id,
      ...movementData.value,
      timestamp: new Date().toISOString()
    });
    isModalOpen.value = false;
    await fetchInventory(); // Refresh dati
  } catch (err) {
    alert("Errore nel salvataggio del movimento");
  }
};

onMounted(fetchInventory);
</script>

<template>
  <div class="inventory-view">
    <header class="inv-header">
      <div class="title-group">
        <h1>Gestione Magazzino</h1>
        <p class="subtitle">Controllo giacenze e movimentazioni merci</p>
      </div>
      <div class="header-actions">
        <div class="search-container">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input v-model="searchQuery" placeholder="Cerca prodotto per nome..." class="search-input" />
        </div>
        <button @click="fetchInventory" class="btn-refresh" :disabled="loading">
          {{ loading ? 'Caricamento...' : 'Sincronizza' }}
        </button>
      </div>
    </header>

    <div class="table-container">
      <table class="styled-table">
        <thead>
          <tr>
            <th>Prodotto</th>
            <th class="text-center">Giacenza</th>
            <th>Prezzo Vendita</th>
            <th>Costo Acquisto</th>
            <th>Margine</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProducts" :key="p.id" :class="{ 'row-alert': p.inventory.stock <= p.inventory.alarm }">
            <td class="product-cell">
              <div class="image-box">
                <img v-if="p.imgUrl" :src="`http://localhost:8088${p.imgUrl}`" class="prod-img" />
                <div v-else class="img-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </div>
              </div>
              <div class="product-details">
                <span class="p-name">{{ p.name }}</span>
                <span class="p-code">SKU: {{ p.inventory.suppliers[0]?.product_code || '---' }}</span>
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
                <span class="m-perc">{{ p.marginPercent.toFixed(1) }}%</span>
              </div>
            </td>
            <td class="text-right">
              <div class="btn-group-actions">
                <button @click="openMovementModal(p, 'purchase')" class="btn-sm btn-in" title="Carico">+</button>
                <button @click="openMovementModal(p, 'manual_out')" class="btn-sm btn-out" title="Scarico">-</button>
                <button @click="openMovementModal(p, 'correction')" class="btn-sm btn-cfg" title="Rettifica">⚙</button>
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
                <span v-if="selectedProduct">{{ selectedProduct.name }}</span>
              </div>
              <button @click="isModalOpen = false" class="btn-close">&times;</button>
            </div>

            <div class="modal-body">
              <div class="causal-grid">
                <div v-for="t in movementTypes" :key="t.id" 
                     class="causal-item" 
                     :class="{ active: movementData.type === t.id }"
                     @click="movementData.type = t.id">
                  <span class="c-icon">{{ t.icon }}</span>
                  <span class="c-label">{{ t.label }}</span>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label>{{ movementData.type === 'correction' ? 'Nuova Giacenza Reale' : 'Quantità' }}</label>
                  <input type="number" v-model.number="movementData.quantity" class="input-main" />
                </div>
                <div class="form-group">
                  <label>Note / Documento Rif.</label>
                  <input type="text" v-model="movementData.note" placeholder="es. Fattura n.10" class="input-main" />
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="isModalOpen = false" class="btn-ghost">Annulla</button>
              <button @click="confirmMovement" class="btn-dark">Conferma Operazione</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Layout Base */
.inventory-view { padding: 40px; background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; color: #1e293b; }

/* Header */
.inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.title-group h1 { font-size: 1.8rem; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
.subtitle { color: #64748b; font-size: 0.9rem; margin: 5px 0 0 0; }
.header-actions { display: flex; gap: 15px; }

.search-container { background: white; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; padding: 0 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.search-input { border: none; padding: 12px; outline: none; width: 280px; font-size: 0.9rem; }
.btn-refresh { background: #fff; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-refresh:hover { background: #f1f5f9; }

/* Tabella */
.table-container { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
.styled-table { width: 100%; border-collapse: collapse; }
.styled-table th { background: #f8fafc; padding: 16px; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
.styled-table td { padding: 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }

.product-cell { display: flex; align-items: center; gap: 15px; }
.image-box { width: 48px; height: 48px; border-radius: 10px; background: #f1f5f9; overflow: hidden; border: 1px solid #e2e8f0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.prod-img { width: 100%; height: 100%; object-fit: cover; }
.p-name { display: block; font-weight: 700; font-size: 0.95rem; }
.p-code { font-size: 0.75rem; color: #94a3b8; }

.badge-stock { padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; }
.bg-success { background: #ecfdf5; color: #059669; }
.bg-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; }

.margin-info { display: flex; flex-direction: column; }
.m-perc { font-size: 0.7rem; font-weight: 800; color: #10b981; }

.btn-group-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-sm { width: 34px; height: 34px; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold; transition: transform 0.1s; }
.btn-sm:active { transform: scale(0.95); }
.btn-in { background: #10b981; }
.btn-out { background: #f59e0b; }
.btn-cfg { background: #64748b; }

/* Modale */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-card { background: white; width: 550px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; }
.modal-header { padding: 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
.m-title span { color: #64748b; font-size: 1.2rem; }

.causal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 25px; }
.causal-item { padding: 15px; border: 2px solid #f1f5f9; border-radius: 12px; cursor: pointer; transition: all 0.2s; text-align: center; }
.causal-item.active { border-color: #1e293b; background: #1e293b; color: white; }
.c-icon { display: block; font-size: 1.4rem; margin-bottom: 5px; }
.c-label { font-size: 0.8rem; font-weight: 700; }

.form-grid { padding: 0 25px 25px 25px; display: grid; gap: 20px; }
.input-main { width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem; outline: none; box-sizing: border-box;}
.input-main:focus { border-color: #3b82f6; }

.modal-footer { padding: 20px 25px; background: #f8fafc; display: flex; justify-content: flex-end; gap: 12px; }
.btn-dark { background: #1e293b; color: white; border: none; padding: 12px 25px; border-radius: 10px; font-weight: 700; cursor: pointer; }
.btn-ghost { background: transparent; border: none; color: #64748b; font-weight: 600; cursor: pointer; }

/* Utility */
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-mono { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
.text-muted { color: #94a3b8; }
</style>