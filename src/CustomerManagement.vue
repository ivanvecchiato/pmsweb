<template>
  <div class="planner-container">
    <div class="header">
      <h1 class="title">Gestione Clienti</h1>
      <div class="header-actions">
        <div class="view-toggle">
          <button
            @click="viewMode = 'grid'"
            class="toggle-btn"
            :class="{ active: viewMode === 'grid' }"
            title="Vista griglia"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
          <button
            @click="viewMode = 'list'"
            class="toggle-btn"
            :class="{ active: viewMode === 'list' }"
            title="Vista lista"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </button>
        </div>
        <button @click="openAddCustomer" class="btn btn-primary">
          + Nuovo Cliente
        </button>
      </div>
    </div>

    <div class="content">
      <div class="dashboard-container">
        <!-- Search Bar -->
        <div class="search-section">
          <div class="search-wrapper">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cerca cliente per nome, email o telefono..."
              class="search-input"
            />
          </div>
        </div>

        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="customers-grid">
          <div
            v-for="customer in filteredCustomers"
            :key="customer.id"
            class="customer-card"
            @click="selectCustomer(customer)"
          >
            <div class="customer-header">
              <div class="customer-avatar">
                {{ getInitials(customer.name) }}
              </div>
              <div class="customer-info">
                <h3 class="customer-name">{{ customer.name }}</h3>
                <p class="customer-email">{{ customer.email }}</p>
              </div>
            </div>
            <div class="customer-details">
              <div class="detail-item">
                <span class="detail-label">Telefono:</span>
                <span class="detail-value">{{ customer.phone }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Città:</span>
                <span class="detail-value">{{ customer.city }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Prenotazioni:</span>
                <span class="detail-value badge">{{ customer.bookingsCount }}</span>
              </div>
            </div>
          </div>

          <div v-if="filteredCustomers.length === 0" class="empty-state">
            <p>Nessun cliente trovato</p>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="customers-list">
          <div class="list-header">
            <div class="list-col col-avatar"></div>
            <div class="list-col col-name">Nome</div>
            <div class="list-col col-email">Email</div>
            <div class="list-col col-phone">Telefono</div>
            <div class="list-col col-city">Città</div>
            <div class="list-col col-bookings">Prenotazioni</div>
          </div>

          <div
            v-for="customer in filteredCustomers"
            :key="customer.id"
            class="list-row"
            @click="selectCustomer(customer)"
          >
            <div class="list-col col-avatar">
              <div class="customer-avatar-small">
                {{ getInitials(customer.name) }}
              </div>
            </div>
            <div class="list-col col-name">
              <span class="list-name">{{ customer.name }}</span>
            </div>
            <div class="list-col col-email">
              <span class="list-email">{{ customer.email }}</span>
            </div>
            <div class="list-col col-phone">
              <span class="list-phone">{{ customer.phone }}</span>
            </div>
            <div class="list-col col-city">
              <span class="list-city">{{ customer.city }}</span>
            </div>
            <div class="list-col col-bookings">
              <span class="badge">{{ customer.bookingsCount }}</span>
            </div>
          </div>

          <div v-if="filteredCustomers.length === 0" class="empty-state">
            <p>Nessun cliente trovato</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for Add/Edit Customer -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">
            {{ isEditMode ? 'Modifica Cliente' : 'Nuovo Cliente' }}
          </h2>
          <button @click="closeModal" class="btn-close">×</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="input-label">Nome Completo *</label>
            <input
              v-model="formData.name"
              type="text"
              class="input-field"
              placeholder="Mario Rossi"
            />
          </div>

          <div class="form-group">
            <label class="input-label">Email *</label>
            <input
              v-model="formData.email"
              type="email"
              class="input-field"
              placeholder="mario.rossi@email.com"
            />
          </div>

          <div class="form-group">
            <label class="input-label">Telefono *</label>
            <input
              v-model="formData.phone"
              type="tel"
              class="input-field"
              placeholder="+39 333 1234567"
            />
          </div>

          <div class="form-group">
            <label class="input-label">Città</label>
            <input
              v-model="formData.city"
              type="text"
              class="input-field"
              placeholder="Roma"
            />
          </div>

          <div class="form-group">
            <label class="input-label">Indirizzo</label>
            <input
              v-model="formData.address"
              type="text"
              class="input-field"
              placeholder="Via Roma 123"
            />
          </div>

          <div class="form-group">
            <label class="input-label">Note</label>
            <textarea
              v-model="formData.notes"
              class="textarea-field"
              rows="3"
              placeholder="Note aggiuntive sul cliente..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn btn-secondary">
            Annulla
          </button>
          <button
            v-if="isEditMode"
            @click="deleteCustomer"
            class="btn btn-danger"
          >
            Elimina
          </button>
          <button @click="saveCustomer" class="btn btn-primary">
            {{ isEditMode ? 'Salva Modifiche' : 'Aggiungi Cliente' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const customers = ref([
  {
    id: 1,
    name: 'Mario Rossi',
    email: 'mario.rossi@email.com',
    phone: '+39 333 1234567',
    city: 'Roma',
    address: 'Via Roma 123',
    bookingsCount: 5,
    notes: 'Cliente abituale, preferisce camere al piano alto'
  },
  {
    id: 2,
    name: 'Laura Bianchi',
    email: 'laura.bianchi@email.com',
    phone: '+39 340 7654321',
    city: 'Milano',
    address: 'Corso Buenos Aires 45',
    bookingsCount: 3,
    notes: ''
  },
  {
    id: 3,
    name: 'Giovanni Verdi',
    email: 'g.verdi@email.com',
    phone: '+39 349 9876543',
    city: 'Napoli',
    address: 'Via Toledo 78',
    bookingsCount: 8,
    notes: 'Viaggia spesso per lavoro'
  },
  {
    id: 4,
    name: 'Anna Neri',
    email: 'anna.neri@email.com',
    phone: '+39 338 5551234',
    city: 'Firenze',
    address: 'Piazza Duomo 12',
    bookingsCount: 2,
    notes: ''
  },
  {
    id: 5,
    name: 'Paolo Gialli',
    email: 'paolo.gialli@email.com',
    phone: '+39 347 8889999',
    city: 'Venezia',
    address: 'Calle Larga 56',
    bookingsCount: 12,
    notes: 'VIP - richiedere sempre upgrade se disponibile'
  }
]);

const searchQuery = ref('');
const showModal = ref(false);
const isEditMode = ref(false);
const selectedCustomerId = ref(null);
const viewMode = ref('grid'); // 'grid' or 'list'

const formData = ref({
  name: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  notes: '',
  bookingsCount: 0
});

const filteredCustomers = computed(() => {
  if (!searchQuery.value) {
    return customers.value;
  }
  
  const query = searchQuery.value.toLowerCase();
  return customers.value.filter(customer =>
    customer.name.toLowerCase().includes(query) ||
    customer.email.toLowerCase().includes(query) ||
    customer.phone.toLowerCase().includes(query) ||
    customer.city.toLowerCase().includes(query)
  );
});

const getInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

const openAddCustomer = () => {
  isEditMode.value = false;
  selectedCustomerId.value = null;
  formData.value = {
    name: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    notes: '',
    bookingsCount: 0
  };
  showModal.value = true;
};

const selectCustomer = (customer) => {
  isEditMode.value = true;
  selectedCustomerId.value = customer.id;
  formData.value = { ...customer };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  selectedCustomerId.value = null;
};

const saveCustomer = () => {
  if (!formData.value.name || !formData.value.email || !formData.value.phone) {
    alert('Compila tutti i campi obbligatori (Nome, Email, Telefono)');
    return;
  }

  if (isEditMode.value) {
    const index = customers.value.findIndex(c => c.id === selectedCustomerId.value);
    if (index !== -1) {
      customers.value[index] = { ...formData.value };
    }
  } else {
    const maxId = Math.max(...customers.value.map(c => c.id), 0);
    customers.value.push({
      ...formData.value,
      id: maxId + 1
    });
  }

  closeModal();
};

const deleteCustomer = () => {
  if (confirm('Sei sicuro di voler eliminare questo cliente?')) {
    customers.value = customers.value.filter(c => c.id !== selectedCustomerId.value);
    closeModal();
  }
};
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.planner-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f9fafb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-toggle {
  display: flex;
  background: #f3f4f6;
  border-radius: 0.5rem;
  padding: 0.25rem;
}

.toggle-btn {
  padding: 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-btn svg {
  stroke: #6b7280;
}

.toggle-btn.active {
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toggle-btn.active svg {
  stroke: #3b82f6;
}

.toggle-btn:hover:not(.active) {
  background: #e5e7eb;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.875rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.content {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}

.dashboard-container {
  max-width: 1400px;
  margin: 0 auto;
}

.search-section {
  margin-bottom: 1.5rem;
}

.search-wrapper {
  max-width: 600px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  background: white;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Grid View Styles */
.customers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.customer-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.customer-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.customer-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.customer-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.customer-info {
  flex: 1;
  min-width: 0;
}

.customer-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.customer-email {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.detail-label {
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  color: #1f2937;
  font-weight: 500;
}

/* List View Styles */
.customers-list {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  font-size: 0.875rem;
  color: #6b7280;
}

.list-row {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background-color 0.2s;
}

.list-row:last-child {
  border-bottom: none;
}

.list-row:hover {
  background: #f9fafb;
}

.list-col {
  padding: 0 0.5rem;
}

.col-avatar {
  width: 60px;
  flex-shrink: 0;
}

.col-name {
  flex: 1.5;
  min-width: 150px;
}

.col-email {
  flex: 2;
  min-width: 200px;
}

.col-phone {
  flex: 1.5;
  min-width: 130px;
}

.col-city {
  flex: 1;
  min-width: 100px;
}

.col-bookings {
  width: 100px;
  text-align: center;
  flex-shrink: 0;
}

.customer-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.875rem;
}

.list-name {
  font-weight: 600;
  color: #1f2937;
}

.list-email {
  color: #6b7280;
  font-size: 0.875rem;
}

.list-phone {
  color: #374151;
  font-size: 0.875rem;
}

.list-city {
  color: #374151;
  font-size: 0.875rem;
}

.badge {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-block;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: #6b7280;
  font-size: 1.125rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6b7280;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background: #f3f4f6;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 1.25rem;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.input-field {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.input-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.textarea-field {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
}

.textarea-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

@media (max-width: 1024px) {
  .list-col {
    font-size: 0.875rem;
  }
  
  .col-email,
  .col-phone {
    min-width: 150px;
  }
}

@media (max-width: 768px) {
  .customers-grid {
    grid-template-columns: 1fr;
  }

  .customers-list {
    overflow-x: auto;
  }

  .list-header,
  .list-row {
    min-width: 800px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>