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
                {{ getInitials(customer.firstname, customer.lastname) }}
              </div>
              <div class="customer-info">
                <h3 class="customer-name">{{ customer.firstname }} {{ customer.lastname }}</h3>
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
                {{ getInitials(customer.firstname, customer.lastname) }}
              </div>
            </div>
            <div class="list-col col-name">
              <span class="list-name">{{ customer.firstname }} {{ customer.lastname }}</span>
            </div>
            <div class="list-col col-email">
                <span class="list-email">{{ customer.email || '—' }}</span>
            </div>
            <div class="list-col col-phone">
                <span class="list-phone">{{ customer.phone || '—' }}</span>
            </div>
            <div class="list-col col-city">
              <span class="list-city">{{ customer.city }}</span>
            </div>
            <div class="list-col col-bookings">
              <button
                type="button"
                class="booking-count-button"
                :aria-expanded="openBookingsCustomerId === customer.id"
                @click.stop="toggleCustomerBookings(customer)"
              >
                {{ customer.bookingsCount }} {{ Number(customer.bookingsCount) === 1 ? 'prenotazione' : 'prenotazioni' }}
              </button>
              <div v-if="openBookingsCustomerId === customer.id" class="customer-bookings-dropdown" @click.stop>
                <button
                  v-for="reservation in customer.reservations || []"
                  :key="reservation.id"
                  type="button"
                  class="customer-booking-item"
                  @click="openCustomerReservation(reservation)"
                >
                  <strong>Camera {{ reservation.room || 'N/D' }}</strong>
                  <span>{{ formatReservationPeriod(reservation) }}</span>
                </button>
                <span v-if="!customer.reservations?.length" class="customer-bookings-empty">Nessun riferimento disponibile</span>
              </div>
            </div>
          </div>

          <div v-if="filteredCustomers.length === 0" class="empty-state">
            <p>Nessun cliente trovato</p>
          </div>
        </div>
      </div>
    </div>

    <CustomerDialog
      :open="showModal"
      :customer="selectedCustomer"
      :title="isEditMode ? 'Modifica Cliente' : 'Nuovo Cliente'"
      :show-delete="isEditMode"
      :require-contacts="false"
      @close="closeModal"
      @save="saveCustomer"
      @delete="deleteCustomer"
    />

    <HotelBookingPlanner
      v-if="selectedReservationId"
      :key="selectedReservationId"
      :requested-reservation-id="selectedReservationId"
      standalone-dialog
      @dialog-closed="selectedReservationId = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import CustomerDialog from '@/components/CustomerDialog.vue';
import HotelBookingPlanner from './HotelBookingPlanner.vue';

const customers = ref([]);
const selectedReservationId = ref(null);

const searchQuery = ref('');
const showModal = ref(false);
const isEditMode = ref(false);
const selectedCustomerId = ref(null);
const viewMode = ref('grid'); // 'grid' or 'list'
const openBookingsCustomerId = ref(null);
const selectedCustomer = computed(() => customers.value.find(customer => customer.id === selectedCustomerId.value) || null);

const filteredCustomers = computed(() => {
  if (!searchQuery.value) {
    return customers.value;
  }
  
  const query = searchQuery.value.toLowerCase();
  return customers.value.filter(customer =>
    String(customer.firstname || '').toLowerCase().includes(query) ||
    String(customer.lastname || '').toLowerCase().includes(query) ||
    String(customer.email || '').toLowerCase().includes(query) ||
    String(customer.phone || '').toLowerCase().includes(query) ||
    String(customer.city || '').toLowerCase().includes(query)
  );
});

const getInitials = (firstname, lastname) => {
  return `${String(firstname || '').charAt(0)}${String(lastname || '').charAt(0)}`.toUpperCase();
};

const openAddCustomer = () => {
  isEditMode.value = false;
  selectedCustomerId.value = null;
  showModal.value = true;
};

const selectCustomer = (customer) => {
  isEditMode.value = true;
  selectedCustomerId.value = customer.id;
  showModal.value = true;
};

const toggleCustomerBookings = (customer) => {
  openBookingsCustomerId.value = openBookingsCustomerId.value === customer.id ? null : customer.id;
};

const formatReservationPeriod = (reservation) => {
  const format = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('it-IT') : 'N/D';
  return `${format(reservation.checkin)} – ${format(reservation.checkout)}`;
};

const openCustomerReservation = (reservation) => {
  selectedReservationId.value = String(reservation.id);
  openBookingsCustomerId.value = null;
};

const closeModal = () => {
  showModal.value = false;
  selectedCustomerId.value = null;
};

const loadCustomers = async () => {
  const response = await axios.get('/api/pms/hotel/customers');
  customers.value = Array.isArray(response.data) ? response.data : [];
};

const saveCustomer = async (customer) => {
  await axios.post('/api/pms/hotel/customers', {
    ...customer,
    id: selectedCustomerId.value || customer.id
  });
  closeModal();
  await loadCustomers();
};

const deleteCustomer = async () => {
  if (confirm('Sei sicuro di voler eliminare questo cliente?')) {
    await axios.delete('/api/pms/hotel/customers', { params: { id: selectedCustomerId.value } });
    closeModal();
    await loadCustomers();
  }
};

onMounted(loadCustomers);
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.planner-container {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 120px);
  gap: 18px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.title {
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ds-text);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.view-toggle {
  display: flex;
  background: rgba(248, 250, 252, 0.92);
  border-radius: 16px;
  padding: 4px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.toggle-btn {
  padding: 0.6rem;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  border-radius: 12px;
  transition: transform 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-btn svg {
  stroke: var(--ds-text-soft);
}

.toggle-btn.active {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.08);
}

.toggle-btn.active svg {
  stroke: var(--ds-primary);
}

.toggle-btn:hover:not(.active) {
  background: rgba(226, 232, 240, 0.68);
}

.btn {
  padding: 0.8rem 1.15rem;
  border: 1px solid transparent;
  border-radius: 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
  font-size: 0.875rem;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-text);
  border-color: rgba(148, 163, 184, 0.18);
}

.btn-danger {
  background: rgba(220, 77, 77, 0.12);
  color: var(--ds-danger);
  border-color: rgba(220, 77, 77, 0.18);
}

.content {
  flex: 1;
  overflow: auto;
  padding: 0 8px 8px;
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
  min-height: 52px;
  padding: 0 16px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.88);
  color: var(--ds-text);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.search-input:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.customers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.customer-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  padding: 1.5rem;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.customer-card:hover {
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.1);
  border-color: rgba(29, 140, 242, 0.28);
  transform: translateY(-2px);
}

.customer-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.customer-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.125rem;
  flex-shrink: 0;
  box-shadow: 0 14px 24px rgba(29, 140, 242, 0.18);
}

.customer-info {
  flex: 1;
  min-width: 0;
}

.customer-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--ds-text);
  margin: 0 0 0.25rem 0;
}

.customer-email {
  font-size: 0.875rem;
  color: var(--ds-text-soft);
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
  color: var(--ds-text-soft);
  font-weight: 600;
}

.detail-value {
  color: var(--ds-text);
  font-weight: 600;
}

.customers-list {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  overflow: visible;
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.list-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(248, 250, 252, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--ds-text-soft);
}

.list-row {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  cursor: pointer;
  transition: background-color 0.16s ease;
}

.list-row:last-child {
  border-bottom: none;
}

.list-row:hover {
  background: rgba(248, 250, 252, 0.72);
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
  position: relative;
  width: 180px;
  text-align: center;
  flex-shrink: 0;
}

.customer-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.875rem;
}

.list-name {
  font-weight: 700;
  color: var(--ds-text);
}

.list-email {
  color: var(--ds-text-soft);
  font-size: 0.875rem;
}

.list-phone {
  color: var(--ds-text);
  font-size: 0.875rem;
}

.list-city {
  color: var(--ds-text);
  font-size: 0.875rem;
}

.badge {
  background: rgba(231, 242, 255, 0.95);
  border: 1px solid rgba(29, 140, 242, 0.18);
  color: var(--ds-primary-strong);
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-block;
}

.booking-count-button {
  border: 1px solid rgba(29, 140, 242, 0.28);
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  background: rgba(231, 242, 255, 0.98);
  color: var(--ds-primary-strong);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.booking-count-button:hover {
  background: rgba(211, 231, 255, 1);
}

.customer-bookings-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 260px;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background: white;
  box-shadow: var(--ds-shadow-soft);
}

.customer-booking-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ds-text);
  cursor: pointer;
  text-align: left;
}

.customer-booking-item:hover {
  background: rgba(231, 242, 255, 0.8);
}

.customer-booking-item span,
.customer-bookings-empty {
  color: var(--ds-text-soft);
  font-size: 0.8rem;
}


.customer-bookings-empty {
  display: block;
  padding: 12px;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: var(--ds-text-soft);
  font-size: 1.125rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 24px;
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
  .header,
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

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

  .btn {
    width: 100%;
  }
}
</style>
