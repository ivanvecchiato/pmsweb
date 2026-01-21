<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';

// --- STATO DATI ---
const products = ref([]);
const loading = ref(false);
const searchQuery = ref('');

// --- STATO MODALE SINGOLO ---
const isModalOpen = ref(false);
const selectedProduct = ref(null);
const movementData = ref({ type: 'purchase', quantity: 1, note: '' });

// --- STATO CARICO MASSIVO (BOLLA) ---
const isBulkModalOpen = ref(false);
const bulkDelivery = ref({
  supplierName: '',
  docNumber: '',
  items: [
    { productId: null, productName: '', quantity: 1, purchase_price: 0 }
  ]
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

// --- LOGICA FETCH ---
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

const movements = ref([]); // Popolato da un'apposita chiamata API

const fetchMovements = async () => {
  try {
    const res = await axios.get('http://localhost:8088/api/inventory/movements');
    // Ordiniamo dal più recente al più vecchio prima di raggruppare
    movements.value = res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (err) {
    console.error("Errore recupero movimenti:", err);
  }
};

const groupedMovements = computed(() => {
  const groups = [];
  
  movements.value.forEach(m => {
    // Identifichiamo se il movimento fa parte di una bolla cercando "BOLLA" nella nota
    const isBulk = m.note && m.note.startsWith('BOLLA');
    const groupKey = isBulk ? m.note : `single-${m.id}`;

    let group = groups.find(g => g.key === groupKey);

    if (!group) {
      group = {
        key: groupKey,
        isBulk: isBulk,
        timestamp: m.timestamp,
        supplier: isBulk ? m.note.split(' - ')[1] : null,
        docNumber: isBulk ? m.note.split(' - ')[0] : 'Movimento Singolo',
        items: []
      };
      groups.push(group);
    }
    
    // Cerchiamo il nome del prodotto (puoi fare un join con la lista prodotti)
    const product = products.value.find(p => p.id === m.productId);
    group.items.push({
      ...m,
      productName: product ? product.name : 'Prodotto eliminato'
    });
  });

  return groups;
});

// --- LOGICA CARICO MASSIVO ---
const addBulkRow = () => {
  bulkDelivery.value.items.push({ productId: null, productName: '', quantity: 1, purchase_price: 0 });
};

const removeBulkRow = (index) => {
  if (bulkDelivery.value.items.length > 1) bulkDelivery.value.items.splice(index, 1);
};

// Quando l'utente seleziona o scrive un prodotto, cerchiamo l'ID e il prezzo di default
const onProductInput = (item) => {
  const found = products.value.find(p => p.name === item.productName);
  if (found) {
    item.productId = found.id;
    item.purchase_price = found.purchase_price; // Prezzo di default da anagrafica
  } else {
    item.productId = null;
  }
};

const confirmBulkDelivery = async () => {
  const validItems = bulkDelivery.value.items.filter(i => i.productId);
  if (validItems.length === 0) return alert("Inserisci almeno un prodotto valido");
  if (!bulkDelivery.value.docNumber) return alert("Inserisci il numero della bolla");
  
  try {
    loading.value = true;
    const promises = validItems.map(item => 
      axios.post('http://localhost:8088/api/inventory/movement', {
        productId: item.productId,
        type: 'purchase',
        quantity: item.quantity,
        purchase_price: item.purchase_price, // Inviamo il prezzo specifico della bolla
        note: `BOLLA ${bulkDelivery.value.docNumber} - ${bulkDelivery.value.supplierName}`
      })
    );

    await Promise.all(promises);
    isBulkModalOpen.value = false;
    bulkDelivery.value = { supplierName: '', docNumber: '', items: [{ productId: null, productName: '', quantity: 1, purchase_price: 0 }] };
    await Promise.all([fetchInventory(), fetchStats()]);
  } catch (err) {
    alert("Errore nel salvataggio");
  } finally {
    loading.value = false;
  }
};

// --- LOGICA FILTRI E MODALE SINGOLO ---
const filteredProducts = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return products.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    (p.inventory.suppliers?.[0]?.supplier?.toLowerCase() || '').includes(query)
  ).map(p => ({
    ...p,
    margin: p.price - p.purchase_price,
    marginPercent: p.price > 0 ? ((p.price - p.purchase_price) / p.price) * 100 : 0
  }));
});

const openMovementModal = (product, type = 'purchase') => {
  selectedProduct.value = product;
  movementData.value.type = type;
  movementData.value.quantity = (type === 'correction') ? product.inventory.stock : 1;
  movementData.value.note = '';
  isModalOpen.value = true;
};

const confirmMovement = async () => {
  try {
    await axios.post('http://localhost:8088/api/inventory/movement', {
      productId: selectedProduct.value.id,
      ...movementData.value,
      purchase_price: selectedProduct.value.purchase_price // Anche qui salviamo il prezzo corrente
    });
    isModalOpen.value = false;
    await Promise.all([fetchInventory(), fetchStats()]);
  } catch (err) { alert("Errore"); }
};

onMounted(() => {
  fetchInventory();
  fetchStats();
  fetchMovements();
});
</script>

<template>
  <div class="inventory-view">
    <header class="inv-header">
      <div class="title-group">
        <h1>Gestione Magazzino</h1>
        <p class="subtitle">{{ filteredProducts.length }} prodotti in elenco</p>
      </div>
      <div class="header-actions">
        <button @click="isBulkModalOpen = true" class="btn-bulk">📦 Registra Bolla</button>
        <div class="search-container">
          <input v-model="searchQuery" placeholder="Filtra tabella..." class="search-input" />
        </div>
        <button @click="fetchInventory" class="btn-refresh">🔄</button>
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
                <span class="p-supplier">🏢 {{ p.inventory.suppliers?.[0]?.supplier || 'N/D' }}</span>
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
                <span class="m-perc" :class="p.marginPercent < 20 ? 'text-red' : ''">{{ p.marginPercent.toFixed(1) }}%</span>
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

      <div class="movements-history">
  <div class="section-header">
    <h2>Cronologia Movimenti</h2>
  </div>

  <div class="timeline">
    <div v-for="group in groupedMovements" :key="group.key" class="timeline-group">
      <div class="group-header" :class="{ 'bulk-header': group.isBulk }">
        <div class="group-info">
          <span class="group-icon">{{ group.isBulk ? '📦' : '📝' }}</span>
          <div>
            <span class="group-title">{{ group.docNumber }}</span>
            <small v-if="group.supplier" class="group-supplier"> | {{ group.supplier }}</small>
          </div>
        </div>
        <span class="group-date">{{ new Date(group.timestamp).toLocaleString() }}</span>
      </div>

      <div class="group-content">
        <div v-for="item in group.items" :key="item.id" class="history-item">
          <div class="item-main">
            <span class="item-name">{{ item.productName }}</span>
            <span class="item-type-badge" :class="item.type">{{ item.type }}</span>
          </div>
          <div class="item-details">
            <span class="item-qty" :class="item.direction">
              {{ item.direction === 'in' ? '+' : '-' }}{{ item.quantity }}
            </span>
            <span class="item-stock-snap">
              Stock: {{ item.previous_stock }} → <strong>{{ item.new_stock }}</strong>
            </span>
            <span class="item-price">€ {{ (item.purchase_price || 0).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
    </div>

<Teleport to="body">
  <Transition name="fade-scale">
    <div v-if="isBulkModalOpen" class="modal-backdrop" @click.self="isBulkModalOpen = false">
      <div class="modal-card bulk-card">
        <div class="modal-header">
          <div class="m-title">
            <h3>Carico da Bolla / DDT</h3>
            <p>Inserisci i prezzi reali della bolla per statistiche accurate</p>
          </div>
          <button @click="isBulkModalOpen = false" class="btn-close">&times;</button>
        </div>

        <div class="modal-body scrollable-body">
          <div class="bulk-header-inputs">
            <div class="form-group">
              <label>Fornitore</label>
              <input v-model="bulkDelivery.supplierName" placeholder="es. Beverage Srl" class="input-main" />
            </div>
            <div class="form-group">
              <label>N° Documento</label>
              <input v-model="bulkDelivery.docNumber" placeholder="es. DDT 456/A" class="input-main" />
            </div>
          </div>

          <div class="bulk-rows-container">
            <div class="bulk-row header-row">
              <span class="col-prod">Prodotto (Autocompletamento)</span>
              <span class="col-qty text-center">Qtà</span>
              <span class="col-price text-center">Costo Unit.</span>
              <span class="col-action"></span>
            </div>

            <div v-for="(item, index) in bulkDelivery.items" :key="index" class="bulk-row entry-row">
              <div class="col-prod">
                <input 
                  list="product-options" 
                  v-model="item.productName" 
                  @input="onProductInput(item)"
                  placeholder="Cerca prodotto..."
                  class="input-main"
                />
              </div>
              
              <div class="col-qty">
                <input type="number" v-model.number="item.quantity" class="input-main text-center" />
              </div>
              
              <div class="col-price">
                <div class="price-field">
                  <span class="currency-prefix">€</span>
                  <input type="number" step="0.01" v-model.number="item.purchase_price" class="input-main" />
                </div>
              </div>

              <div class="col-action">
                <button @click="removeBulkRow(index)" class="btn-remove-mini">✕</button>
              </div>
            </div>
          </div>

          <button @click="addBulkRow" class="btn-add-line">
            <span>+</span> Aggiungi riga alla bolla
          </button>
        </div>

        <div class="modal-footer">
          <button @click="isBulkModalOpen = false" class="btn-ghost">Annulla</button>
          <button @click="confirmBulkDelivery" class="btn-dark" :disabled="loading">
            {{ loading ? 'Salvataggio...' : 'Conferma e Carica' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
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

    <datalist id="product-options">
      <option v-for="p in products" :key="p.id" :value="p.name">
        {{ p.inventory.suppliers?.[0]?.supplier || 'N/D' }}
      </option>
    </datalist>

  </div>
</template>

<style scoped>
/* Layout specifico per il Modale Bulk */
.bulk-card {
  width: 900px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.scrollable-body {
  padding: 25px;
  overflow-y: auto;
  flex-grow: 1;
}

.bulk-header-inputs {
  display: flex;
  gap: 20px;
  margin-bottom: 25px;
}

.bulk-header-inputs .form-group {
  flex: 1;
}

/* Griglia Righe Bolla */
.bulk-row {
  display: grid;
  grid-template-columns: 1fr 100px 140px 40px; /* Definisce le proporzioni delle colonne */
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}

.header-row {
  background: #f8fafc;
  padding: 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 15px;
}

.entry-row {
  padding: 0 5px;
}

/* Prezzo con prefisso € interno */
.price-field {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-prefix {
  position: absolute;
  left: 12px;
  color: #94a3b8;
  font-weight: 600;
}

.price-field .input-main {
  padding-left: 30px !important;
  text-align: right;
}

/* Bottoni */
.btn-remove-mini {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #fee2e2;
  color: #ef4444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-remove-mini:hover { background: #fecaca; }

.btn-add-line {
  width: 100%;
  padding: 12px;
  margin-top: 15px;
  border: 2px dashed #e2e8f0;
  background: white;
  border-radius: 12px;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-line:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #1e293b;
}

/* Stili comuni input */
.input-main {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box; /* Cruciale per evitare che l'input esca dai bordi */
}

.bulk-header-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.bulk-header-inputs label { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 5px; display: block; }

.bulk-row-header { display: grid; grid-template-columns: 1fr 100px 130px 40px; gap: 10px; padding: 10px; background: #f8fafc; border-radius: 8px; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 10px; }

.price-input-wrapper { position: relative; display: flex; align-items: center; }
.currency-addon { position: absolute; left: 10px; color: #94a3b8; font-weight: 600; font-size: 0.9rem; }
.price-input { padding-left: 25px !important; text-align: right; }

.qty-input { text-align: center; font-weight: 700; }
.btn-remove-row { border: none; background: #fee2e2; color: #ef4444; border-radius: 6px; height: 38px; cursor: pointer; }
.btn-add-row { width: 100%; padding: 12px; margin-top: 10px; border: 2px dashed #e2e8f0; background: transparent; color: #64748b; font-weight: 600; border-radius: 10px; cursor: pointer; }

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
.btn-bulk {
  background: #6366f1;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-bulk:hover { background: #4f46e5; }

.select-prod { appearance: auto; }
.qty-input { text-align: center; }

.btn-remove-row { background: #fee2e2; color: #ef4444; border: none; border-radius: 8px; height: 40px; cursor: pointer; font-size: 1.2rem; }
.btn-add-row { width: 100%; padding: 10px; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 10px; color: #64748b; font-weight: 600; cursor: pointer; }
.btn-add-row:hover { background: #f1f5f9; border-color: #cbd5e1; }

.movements-history { margin-top: 50px; }

.timeline-group {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  overflow: hidden;
}

.group-header {
  padding: 12px 20px;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
}

.bulk-header { background: #eff6ff; border-left: 4px solid #3b82f6; }

.group-info { display: flex; align-items: center; gap: 10px; }
.group-title { font-weight: 700; color: #1e293b; }
.group-date { font-size: 0.85rem; color: #64748b; }

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.history-item:last-child { border-bottom: none; }

.item-main { display: flex; align-items: center; gap: 15px; }
.item-name { font-weight: 600; width: 200px; }

.item-type-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
}

.item-type-badge.purchase { background: #dcfce7; color: #166534; }
.item-type-badge.breakage { background: #fee2e2; color: #991b1b; }

.item-details { display: flex; gap: 25px; align-items: center; font-size: 0.9rem; }
.item-qty.in { color: #10b981; font-weight: 800; }
.item-qty.out { color: #ef4444; font-weight: 800; }
.item-stock-snap { color: #64748b; }
</style>