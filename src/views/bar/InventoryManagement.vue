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
const movementData = ref({ type: 'purchase', quantity: 1, note: '', purchase_price: 0, supplierName: '' });
const isProductHistoryModalOpen = ref(false);
const selectedHistoryProduct = ref(null);

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
  { id: 'purchase', label: 'Acquisto' },
  { id: 'manual_out', label: 'Scarico' },
  { id: 'self_consumption', label: 'Autoconsumo' },
  { id: 'correction', label: 'Rettifica' }
];

const movementTypeLabels = {
  purchase: 'Acquisto',
  manual_out: 'Scarico',
  self_consumption: 'Autoconsumo',
  correction: 'Rettifica',
  breakage: 'Rottura',
  expired: 'Scaduto',
  sale: 'Vendita'
};

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
    const res = await axios.get(`/api/inventory/stats`, {
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
    const res = await axios.get('/api/inventory');
    products.value = res.data;
  } catch (err) {
    console.error("Errore API Inventory:", err);
  } finally {
    loading.value = false;
  }
};

const refreshInventoryData = async () => {
  await Promise.all([fetchInventory(), fetchStats(), fetchMovements()]);
};

const movements = ref([]); // Popolato da un'apposita chiamata API

const fetchMovements = async () => {
  try {
    const res = await axios.get('/api/inventory/movements');
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
    const noteParts = (m.note || '').split(' - ');
    const bulkSupplierFromNote = noteParts.length > 1 ? noteParts.slice(1).join(' - ').trim() : '';

    let group = groups.find(g => g.key === groupKey);

    if (!group) {
      group = {
        key: groupKey,
        isBulk: isBulk,
        timestamp: m.timestamp,
        supplier: isBulk ? (m.supplier || bulkSupplierFromNote || null) : (m.supplier || null),
        docNumber: isBulk ? noteParts[0] : 'Movimento Singolo',
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

const latestPurchasePriceByProduct = computed(() => {
  const latestByProduct = new Map();

  movements.value.forEach((movement) => {
    if (movement.type !== 'purchase') return;
    if (latestByProduct.has(movement.productId)) return;

    latestByProduct.set(movement.productId, Number(movement.purchase_price || 0));
  });

  return latestByProduct;
});

const selectedProductMovements = computed(() => {
  if (!selectedHistoryProduct.value?.id) return [];

  return movements.value
    .filter((m) => Number(m.productId) === Number(selectedHistoryProduct.value.id))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
});

const movementTypeLabel = (type) => movementTypeLabels[type] || type || 'N/D';

const openProductHistoryModal = (product) => {
  selectedHistoryProduct.value = product;
  isProductHistoryModalOpen.value = true;
};

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
  const supplierName = (bulkDelivery.value.supplierName || '').trim();
  
  try {
    loading.value = true;
    const promises = validItems.map(item => 
      axios.post('/api/inventory/movement', {
        productId: item.productId,
        type: 'purchase',
        quantity: item.quantity,
        purchase_price: item.purchase_price, // Inviamo il prezzo specifico della bolla
        supplier: supplierName,
        note: `BOLLA ${bulkDelivery.value.docNumber} - ${supplierName}`
      })
    );

    await Promise.all(promises);
    isBulkModalOpen.value = false;
    bulkDelivery.value = { supplierName: '', docNumber: '', items: [{ productId: null, productName: '', quantity: 1, purchase_price: 0 }] };
    await refreshInventoryData();
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
  ).map(p => {
    const price = Number(p.price || 0);
    const lastPurchasePrice = latestPurchasePriceByProduct.value.get(p.id);
    const purchasePrice = Number(lastPurchasePrice ?? p.purchase_price ?? 0);

    return {
      ...p,
      price,
      purchase_price: purchasePrice,
      margin: price - purchasePrice,
      marginPercent: price > 0 ? ((price - purchasePrice) / price) * 100 : 0
    };
  });
});

const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const exportFilteredInventoryCsv = () => {
  const headers = [
    'Prodotto',
    'Fornitore',
    'Giacenza',
    'Soglia allarme',
    'Prezzo vendita',
    'Costo acquisto',
    'Margine',
    'Margine %'
  ];

  const rows = filteredProducts.value.map((p) => {
    const supplier = p.inventory?.suppliers?.[0]?.supplier || 'N/D';
    const stock = Number(p.inventory?.stock || 0);
    const alarm = Number(p.inventory?.alarm || 0);

    return [
      p.name || '',
      supplier,
      stock,
      alarm,
      Number(p.price || 0).toFixed(2),
      Number(p.purchase_price || 0).toFixed(2),
      Number(p.margin || 0).toFixed(2),
      Number(p.marginPercent || 0).toFixed(1)
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `magazzino_${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const openMovementModal = (product, type = 'purchase') => {
  selectedProduct.value = product;
  movementData.value.type = type;
  movementData.value.quantity = (type === 'correction') ? product.inventory.stock : 1;
  movementData.value.note = '';
  movementData.value.purchase_price = Number(product.purchase_price || 0);
  movementData.value.supplierName = '';
  isModalOpen.value = true;
};

const confirmMovement = async () => {
  try {
    const purchasePrice = movementData.value.type === 'purchase'
      ? Number(movementData.value.purchase_price || 0)
      : Number(selectedProduct.value.purchase_price || 0);

    const supplierName = (movementData.value.supplierName || '').trim();
    const manualNote = (movementData.value.note || '').trim();
    const composedNote = movementData.value.type === 'purchase'
      ? [supplierName ? `FORNITORE: ${supplierName}` : '', manualNote].filter(Boolean).join(' | ')
      : manualNote;

    await axios.post('/api/inventory/movement', {
      productId: selectedProduct.value.id,
      type: movementData.value.type,
      quantity: movementData.value.quantity,
      supplier: movementData.value.type === 'purchase' ? supplierName : '',
      note: composedNote,
      purchase_price: purchasePrice
    });
    isModalOpen.value = false;
    await refreshInventoryData();
  } catch (err) { alert("Errore"); }
};

onMounted(() => {
  refreshInventoryData();
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
        <button @click="isBulkModalOpen = true" class="btn-bulk">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 4 7l8 4 8-4-8-4Z" />
            <path d="M4 7v10l8 4 8-4V7" />
            <path d="M12 11v10" />
          </svg>
          <span>Registra Bolla</span>
        </button>
        <button @click="exportFilteredInventoryCsv" class="btn-export" :disabled="filteredProducts.length === 0">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m8 11 4 4 4-4" />
            <path d="M5 21h14" />
          </svg>
          <span>Esporta CSV</span>
        </button>
        <div class="search-container">
          <input v-model="searchQuery" placeholder="Filtra tabella..." class="search-input" />
        </div>
        <button @click="fetchInventory" class="btn-refresh" aria-label="Aggiorna magazzino" title="Aggiorna magazzino">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v6h-6" />
          </svg>
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
                <div v-else class="img-placeholder" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="4" y="5" width="16" height="14" rx="2" />
                    <path d="M8 14l2.5-2.5a1 1 0 0 1 1.414 0L16 15.586" />
                    <path d="M14 14l1-1a1 1 0 0 1 1.414 0L20 16.586" />
                    <circle cx="9" cy="9" r="1.25" />
                  </svg>
                </div>
              </div>
              <div class="product-details">
                <span class="p-name">{{ p.name }}</span>
                <span class="p-supplier">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20h16" />
                    <path d="M6 20V7h12v13" />
                    <path d="M9 10h.01M9 13h.01M9 16h.01M15 10h.01M15 13h.01M15 16h.01" />
                  </svg>
                  {{ p.inventory.suppliers?.[0]?.supplier || 'N/D' }}
                </span>
              </div>
            </td>
            <td class="text-center">
              <span class="badge-stock" :class="p.inventory.stock <= p.inventory.alarm ? 'bg-danger' : 'bg-success'">
                {{ p.inventory.stock }}
              </span>
            </td>
            <td class="font-mono">€ {{ Number(p.price || 0).toFixed(2) }}</td>
            <td class="font-mono text-muted">€ {{ Number(p.purchase_price || 0).toFixed(2) }}</td>
            <td>
              <div class="margin-info">
                <span class="m-val">€ {{ Number(p.margin || 0).toFixed(2) }}</span>
                <span class="m-perc" :class="p.marginPercent < 20 ? 'text-red' : ''">{{ Number(p.marginPercent || 0).toFixed(1) }}%</span>
              </div>
            </td>
            <td class="text-right">
              <div class="btn-group-actions">
                <button @click="openMovementModal(p, 'purchase')" class="btn-sm btn-in" aria-label="Carico" title="Carico">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <button @click="openMovementModal(p, 'manual_out')" class="btn-sm btn-out" aria-label="Scarico" title="Scarico">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <button @click="openMovementModal(p, 'correction')" class="btn-sm btn-cfg" aria-label="Rettifica" title="Rettifica">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20h4l10-10a2.121 2.121 0 0 0-3-3L5 17v3Z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                </button>
                <button @click="openProductHistoryModal(p)" class="btn-sm btn-history" aria-label="Storico prodotto" title="Storico prodotto">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 3-6.708" />
                    <path d="M3 4v4h4" />
                    <path d="M12 7v6l4 2" />
                  </svg>
                </button>
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
          <span class="group-icon" aria-hidden="true">
            <svg v-if="group.isBulk" viewBox="0 0 24 24">
              <path d="M12 3 4 7l8 4 8-4-8-4Z" />
              <path d="M4 7v10l8 4 8-4V7" />
              <path d="M12 11v10" />
            </svg>
            <svg v-else viewBox="0 0 24 24">
              <path d="M7 4h8l4 4v12H7z" />
              <path d="M15 4v4h4" />
              <path d="M10 12h6M10 16h6" />
            </svg>
          </span>
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
                  <span class="c-icon" aria-hidden="true">
                    <svg v-if="t.id === 'purchase'" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <svg v-else-if="t.id === 'manual_out'" viewBox="0 0 24 24">
                      <path d="M5 12h14" />
                    </svg>
                    <svg v-else-if="t.id === 'self_consumption'" viewBox="0 0 24 24">
                      <path d="M8 4v16" />
                      <path d="M16 4v7" />
                      <path d="M13 4v7" />
                      <path d="M13 11c0 1.657 1.343 3 3 3" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24">
                      <path d="M4 20h4l10-10a2.121 2.121 0 0 0-3-3L5 17v3Z" />
                      <path d="m13.5 6.5 4 4" />
                    </svg>
                  </span>
                  <span class="c-label">{{ t.label }}</span>
                </div>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label>{{ movementData.type === 'correction' ? 'Nuova Giacenza' : 'Quantità' }}</label>
                  <input type="number" v-model.number="movementData.quantity" class="input-main" />
                </div>
                <div v-if="movementData.type === 'purchase'" class="form-group">
                  <label>Fornitore</label>
                  <input type="text" v-model.trim="movementData.supplierName" placeholder="es. Beverage Srl" class="input-main" />
                </div>
                <div v-if="movementData.type === 'purchase'" class="form-group">
                  <label>Prezzo di acquisto (€)</label>
                  <input type="number" step="0.01" min="0" v-model.number="movementData.purchase_price" class="input-main" />
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

      <Transition name="fade-scale">
        <div v-if="isProductHistoryModalOpen" class="modal-backdrop" @click.self="isProductHistoryModalOpen = false">
          <div class="modal-card history-card">
            <div class="modal-header">
              <div class="m-title">
                <h3>Storico Movimenti: {{ selectedHistoryProduct?.name }}</h3>
                <small>Include carichi, scarichi e scarichi per vendita</small>
              </div>
              <button @click="isProductHistoryModalOpen = false" class="btn-close">&times;</button>
            </div>

            <div class="modal-body scrollable-body history-body">
              <div v-if="selectedProductMovements.length === 0" class="history-empty">
                Nessun movimento disponibile per questo prodotto.
              </div>

              <div v-else class="history-list">
                <div v-for="m in selectedProductMovements" :key="m.id" class="history-row">
                  <div class="history-row-top">
                    <span class="item-type-badge" :class="m.type">{{ movementTypeLabel(m.type) }}</span>
                    <span class="history-date">{{ new Date(m.timestamp).toLocaleString() }}</span>
                  </div>

                  <div class="history-row-details">
                    <span class="item-qty" :class="m.direction">
                      {{ m.direction === 'in' ? '+' : '-' }}{{ m.quantity }}
                    </span>
                    <span class="item-stock-snap">
                      Stock: {{ m.previous_stock }} → <strong>{{ m.new_stock }}</strong>
                    </span>
                    <span class="item-price">€ {{ Number(m.purchase_price || 0).toFixed(2) }}</span>
                  </div>

                  <div v-if="m.supplier || m.note" class="history-row-note">
                    <span v-if="m.supplier"><strong>Fornitore:</strong> {{ m.supplier }}</span>
                    <span v-if="m.note"><strong>Note:</strong> {{ m.note }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="isProductHistoryModalOpen = false" class="btn-dark">Chiudi</button>
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
:global(:root) {
  --inv-font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --inv-bg: #f9fafb;
  --inv-surface: #ffffff;
  --inv-surface-soft: #f3f4f6;
  --inv-border: #e5e7eb;
  --inv-border-strong: #d1d5db;
  --inv-text: #1f2937;
  --inv-muted: #6b7280;
  --inv-primary: #3b82f6;
  --inv-primary-dark: #2563eb;
  --inv-success: #10b981;
  --inv-warning: #f59e0b;
  --inv-danger: #ef4444;
  --inv-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --inv-shadow-lg: 0 18px 50px rgba(15, 23, 42, 0.18);
}

* {
  box-sizing: border-box;
}

.inventory-view {
  min-height: 100vh;
  padding: 24px;
  background: var(--inv-bg);
  color: var(--inv-text);
  font-family: var(--inv-font);
}

.modal-backdrop {
  font-family: var(--inv-font);
}

button,
input,
select,
textarea {
  font-family: inherit;
}

.inv-header {
  background: var(--inv-surface);
  border: 1px solid var(--inv-border);
  border-radius: 16px;
  box-shadow: var(--inv-shadow);
  padding: 20px 22px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.title-group h1 {
  margin: 0;
  font-size: 1.55rem;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #111827;
}

.subtitle {
  margin: 6px 0 0;
  font-size: 0.95rem;
  color: var(--inv-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-bulk,
.btn-export,
.btn-dark,
.btn-ghost,
.btn-refresh,
.btn-sm,
.btn-add-line,
.btn-remove-mini,
.btn-close {
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
}

.btn-bulk {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 10px;
  padding: 11px 16px;
  background: var(--inv-primary);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(59, 130, 246, 0.22);
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--inv-border);
  border-radius: 10px;
  padding: 11px 14px;
  background: var(--inv-surface);
  color: #1f2937;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-export svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.btn-export:hover {
  background: var(--inv-surface-soft);
}

.btn-export:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-bulk:hover,
.btn-dark:hover {
  background: var(--inv-primary-dark);
}

.btn-bulk svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.search-container {
  min-width: 260px;
  background: var(--inv-surface);
  border: 1px solid var(--inv-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 14px;
}

.search-container:focus-within {
  border-color: var(--inv-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.search-input,
.input-main {
  width: 100%;
  border: 1px solid var(--inv-border-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--inv-text);
  font: inherit;
  outline: none;
}

.search-input {
  width: 250px;
  border: none;
  padding: 11px 0;
  background: transparent;
}

.input-main {
  padding: 10px 12px;
  min-height: 42px;
}

.input-main:focus {
  border-color: var(--inv-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-refresh {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid var(--inv-border);
  background: var(--inv-surface);
  cursor: pointer;
}

.btn-refresh:hover,
.btn-close:hover,
.btn-ghost:hover {
  background: var(--inv-surface-soft);
}

.btn-refresh svg {
  width: 20px;
  height: 20px;
  stroke: #374151;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--inv-surface);
  border: 1px solid var(--inv-border);
  border-radius: 14px;
  box-shadow: var(--inv-shadow);
  padding: 18px 20px;
}

.stat-card.blue { border-top: 4px solid var(--inv-primary); }
.stat-card.red { border-top: 4px solid var(--inv-danger); }
.stat-card.orange { border-top: 4px solid var(--inv-warning); }

.stat-card label {
  display: block;
  margin-bottom: 10px;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--inv-muted);
  font-weight: 700;
}

.st-val {
  font-size: 1.5rem;
  line-height: 1.1;
  font-weight: 700;
  color: #111827;
}

.table-container {
  background: var(--inv-surface);
  border: 1px solid var(--inv-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--inv-shadow);
}

.styled-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.styled-table thead th {
  padding: 15px 18px;
  background: #f8fafc;
  border-bottom: 1px solid var(--inv-border);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--inv-muted);
  text-transform: uppercase;
}

.styled-table tbody tr {
  transition: background-color 0.18s ease;
}

.styled-table tbody tr:hover {
  background: #fbfdff;
}

.styled-table td {
  padding: 16px 18px;
  border-bottom: 1px solid #eef2f7;
  vertical-align: middle;
}

.styled-table tbody tr:last-child td {
  border-bottom: none;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 14px;
}

.image-box {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  border: 1px solid var(--inv-border);
  background: #fff;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.img-placeholder {
  color: #9ca3af;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.img-placeholder svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 1.7;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.prod-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-details {
  min-width: 0;
}

.p-name {
  display: block;
  font-size: 1.02rem;
  font-weight: 600;
  color: #111827;
}

.p-supplier {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 0.83rem;
  font-weight: 500;
  color: #6366f1;
}

.p-supplier svg,
.group-icon svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.badge-stock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bg-success {
  background: #ecfdf5;
  color: #047857;
}

.bg-danger {
  background: #fef2f2;
  color: #dc2626;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.text-muted {
  color: #94a3b8;
}

.margin-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-val {
  font-weight: 600;
  color: #111827;
}

.m-perc {
  font-size: 0.83rem;
  font-weight: 700;
  color: var(--inv-success);
}

.text-red {
  color: var(--inv-danger);
}

.btn-group-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-sm {
  width: 34px;
  height: 34px;
  border: 1px solid var(--inv-border);
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: none;
}

.btn-sm:hover {
  transform: translateY(-1px);
}

.btn-sm svg,
.c-icon svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.btn-in {
  color: #047857;
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.btn-out {
  color: #b45309;
  border-color: #fcd34d;
  background: #fffbeb;
}

.btn-cfg {
  color: #475569;
  border-color: #cbd5e1;
  background: #f8fafc;
}

.btn-history {
  color: #1d4ed8;
  border-color: #bfdbfe;
  background: #eff6ff;
}

.btn-in:hover {
  background: #d1fae5;
}

.btn-out:hover {
  background: #fef3c7;
}

.btn-cfg:hover {
  background: #e2e8f0;
}

.btn-history:hover {
  background: #dbeafe;
}

.movements-history {
  margin-top: 0;
  border-top: 1px solid var(--inv-border);
  background: #fbfcfe;
  padding: 24px;
}

.section-header {
  margin-bottom: 14px;
}

.section-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
}

.timeline {
  display: grid;
  gap: 14px;
}

.timeline-group {
  background: var(--inv-surface);
  border: 1px solid var(--inv-border);
  border-radius: 14px;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: #f8fafc;
  border-bottom: 1px solid var(--inv-border);
}

.bulk-header {
  background: #eff6ff;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #eef2ff;
  color: #4f46e5;
}

.bulk-header .group-icon {
  background: #dbeafe;
  color: #2563eb;
}

.group-title {
  font-weight: 600;
  color: #111827;
}

.group-supplier,
.group-date {
  color: var(--inv-muted);
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 14px 18px;
  border-bottom: 1px solid #eef2f7;
}

.history-item:last-child {
  border-bottom: none;
}

.item-main,
.item-details {
  display: flex;
  align-items: center;
  gap: 14px;
}

.item-name {
  font-weight: 600;
  color: var(--inv-text);
}

.item-type-badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  line-height: 1;
  text-transform: uppercase;
  font-weight: 700;
}

.item-type-badge.purchase { background: #dcfce7; color: #166534; }
.item-type-badge.breakage { background: #fee2e2; color: #991b1b; }
.item-type-badge.manual_out,
.item-type-badge.expired,
.item-type-badge.self_consumption,
.item-type-badge.sale { background: #fef3c7; color: #92400e; }
.item-type-badge.correction { background: #e0e7ff; color: #4338ca; }

.item-qty.in {
  color: #059669;
  font-weight: 800;
}

.item-qty.out {
  color: #dc2626;
  font-weight: 800;
}

.item-stock-snap,
.item-price {
  color: var(--inv-muted);
  font-size: 0.92rem;
}

.history-body {
  padding-top: 14px;
}

.history-empty {
  padding: 12px;
  border: 1px dashed var(--inv-border-strong);
  border-radius: 10px;
  color: var(--inv-muted);
  background: #fafafa;
}

.history-list {
  display: grid;
  gap: 10px;
}

.history-row {
  border: 1px solid var(--inv-border);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
}

.history-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.history-date {
  color: var(--inv-muted);
  font-size: 0.86rem;
}

.history-row-details {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.history-row-note {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--inv-muted);
  font-size: 0.9rem;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 9999;
}

.modal-card {
  width: min(520px, 100%);
  background: var(--inv-surface, #ffffff);
  border-radius: 16px;
  border: 1px solid var(--inv-border, #e5e7eb);
  box-shadow: var(--inv-shadow-lg);
  overflow: hidden;
}

.bulk-card {
  width: min(920px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.history-card {
  width: min(860px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--inv-surface, #ffffff);
  border-bottom: 1px solid var(--inv-border, #e5e7eb);
}

.m-title h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #111827;
}

.m-title p,
.m-title small {
  display: block;
  margin-top: 6px;
  color: var(--inv-muted);
  line-height: 1.4;
}

.btn-close {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border: 1px solid var(--inv-border);
  border-radius: 10px;
  background: #fff;
  color: #111827;
  font-size: 1.25rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  background: var(--inv-surface, #ffffff);
}

.scrollable-body {
  padding: 20px;
  background: var(--inv-surface, #ffffff);
  overflow-y: auto;
  flex: 1;
}

.causal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.causal-item {
  padding: 14px 12px;
  border: 1px solid var(--inv-border);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.causal-item:hover {
  border-color: #bfdbfe;
  background: #f8fbff;
}

.causal-item.active {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.c-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.c-label {
  font-weight: 600;
}

.form-grid,
.bulk-header-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.form-group label,
.bulk-header-inputs label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--inv-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.bulk-rows-container {
  margin-top: 18px;
  overflow-x: auto;
}

.bulk-row {
  display: grid;
  grid-template-columns: minmax(240px, 1.7fr) 96px 160px 40px;
  gap: 12px;
  align-items: center;
}

.header-row {
  padding: 10px 12px;
  margin-bottom: 10px;
  background: #f8fafc;
  border: 1px solid var(--inv-border);
  border-radius: 10px;
  font-size: 0.73rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--inv-muted);
}

.entry-row {
  padding: 6px 4px;
}

.col-prod {
  min-width: 0;
}

.col-qty .input-main,
.col-price .input-main {
  text-align: center;
}

.price-field {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-prefix {
  position: absolute;
  left: 12px;
  color: #9ca3af;
  font-weight: 600;
}

.price-field .input-main {
  padding-left: 28px;
  text-align: right;
}

.btn-remove-mini {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff5f5;
  color: var(--inv-danger);
  cursor: pointer;
}

.btn-remove-mini:hover {
  background: #fee2e2;
}

.btn-add-line {
  margin-top: 16px;
  width: 100%;
  border: 1px dashed var(--inv-border-strong);
  border-radius: 10px;
  background: #fff;
  color: #374151;
  padding: 12px 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-add-line:hover {
  background: var(--inv-surface-soft);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid var(--inv-border, #e5e7eb);
}

.btn-dark,
.btn-ghost {
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-dark {
  border: none;
  background: var(--inv-primary);
  color: white;
}

.btn-dark:disabled {
  cursor: wait;
  opacity: 0.7;
}

.btn-ghost {
  border: 1px solid var(--inv-border);
  background: #fff;
  color: #374151;
}

.text-center { text-align: center; }
.text-right { text-align: right; }

@media (max-width: 980px) {
  .inventory-view {
    padding: 16px;
  }

  .inv-header,
  .stats-overview {
    grid-template-columns: 1fr;
  }

  .inv-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: stretch;
  }

  .search-container {
    min-width: 0;
    width: 100%;
  }

  .search-input {
    width: 100%;
  }

  .stats-overview {
    display: grid;
    grid-template-columns: 1fr;
  }

  .styled-table {
    min-width: 760px;
  }

  .table-container {
    overflow-x: auto;
  }

  .group-header,
  .history-item,
  .item-details {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid,
  .bulk-header-inputs {
    grid-template-columns: 1fr;
  }

  .bulk-row {
    grid-template-columns: minmax(220px, 1fr) 90px 140px 40px;
  }
}
</style>