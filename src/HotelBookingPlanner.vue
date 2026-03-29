<template>
  <div class="planner-container">
    <div class="header">
      <h1 class="title">Planning Prenotazioni Hotel</h1>
      <div class="header-controls">
        <div class="date-navigation">
          <button @click="previousPeriod" class="btn-nav" title="Periodo precedente">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span class="date-range">{{ getDateRange() }}</span>
          <button @click="nextPeriod" class="btn-nav" title="Periodo successivo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      <button @click="addBooking()" class="btn btn-primary">
        + Nuova Prenotazione
      </button>
      <button @click="createQuote" class="btn btn-secondary">
        📋 Preventivo
      </button>
    </div>
    </div>

    <div class="content">
      <div class="grid-wrapper">
        <div class="grid-header">
          <div class="header-row">
            <div class="room-label">Camera</div>
            <div
              v-for="(date, idx) in dates"
              :key="idx"
              class="date-cell"
              :style="{ width: cellWidth + 'px' }"
            >
              <div class="date-day">{{ getDayName(date) }}</div>
              <div class="date-num">{{ formatDate(date) }}</div>
            </div>
          </div>
        </div>

        <div class="grid-body">
          <div v-if="hoveredRoomId !== null" :style="verticalColumnStyle" class="vertical-column-highlight"></div>
  
          <div v-if="isTodayVisible" :style="todayLineStyle" class="today-line"></div>

          <div v-for="room in rooms" :key="room.id" class="room-row">
            <div class="room-cell">{{ room.name }}</div>

            <div 
              class="days-container" 
              :style="{ height: cellHeight + 'px' }"
              @mousemove="handleMouseMoveGrid($event, room)"
              @mouseenter="hoveredRoomId = room.id" 
              @mouseleave="hoveredRoomId = null"
              @click="addBooking(room, $event)"
            >
              <div v-if="hoveredRoomId === room.id" :style="mouseLineStyle">
                <div class="mouse-tooltip">
                  <span class="tooltip-date">{{ hoverDate }}</span>
                  <span class="tooltip-room">{{ hoverRoom }}</span>
                </div>
              </div>

                <div
                v-for="(date, idx) in dates"
                :key="idx"
                class="day-slot"
                :style="{ width: cellWidth + 'px' }"
              />
              
              <div
                v-for="booking in getRoomBookings(room.id)"
                :key="booking.id"
                class="booking"
                :class="{ 
                  'booking-conflict': hasConflict(booking)
                }"
                :style="getBookingStyle(booking)"
                :title="booking.notes || ''"
                @mousedown="handleMouseDown($event, booking, 'move')"
                @click.prevent.stop="openBookingActions($event, booking)"
              >
                <div
                  class="resize-handle resize-left"
                  @mousedown.stop="handleMouseDown($event, booking, 'resize-left')"
                />
                
                <div class="booking-content">
                  <div class="booking-guest">{{ booking.guest }}</div>
                </div>

                <div
                  class="resize-handle resize-right"
                  @mousedown.stop="handleMouseDown($event, booking, 'resize-right')"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

<transition name="fade">
  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ editingBooking ? 'Modifica Prenotazione' : 'Nuova Prenotazione' }}</h3>
        <button @click="showModal = false" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="submitNewBooking" class="booking-form">
        <div class="dialog-layout">
          <section class="dialog-section">
            <h4 class="section-title">Prenotazione</h4>
            <div class="form-section">
              <label>Camera</label>
              <select v-model="newBookingData.roomId" required>
                <option v-for="room in rooms" :key="room.id" :value="room.id">
                  {{ room.name }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-section">
                <label>Check-in</label>
                <input type="date" v-model="newBookingData.checkin" required />
              </div>
              <div class="form-section">
                <label>Check-out</label>
                <input type="date" v-model="newBookingData.checkout" required />
              </div>
            </div>

            <div class="form-section">
              <label>Trattamento</label>
              <div class="board-radio-group">
                <label v-for="mode in ['bb', 'hb', 'fb']" :key="mode"
                      class="board-radio-card" :class="{ 'is-selected': newBookingData.board === mode }">
                  <input type="radio" v-model="newBookingData.board" :value="mode" class="hidden-radio">
                  <span class="board-name">{{ mode.toUpperCase() }}</span>
                </label>
              </div>
            </div>
          </section>

          <section class="dialog-section">
            <h4 class="section-title">Ospite</h4>
            <div class="form-row">
              <div class="form-section">
                <label>Nome</label>
                <input type="text" v-model="newBookingData.guestName" required placeholder="es. Mario" />
              </div>
              <div class="form-section">
                <label>Cognome</label>
                <input type="text" v-model="newBookingData.guestSurname" required placeholder="es. Rossi" />
              </div>
            </div>

            <div class="form-section">
              <label>Note prenotazione</label>
              <textarea
                v-model="newBookingData.notes"
                rows="3"
                maxlength="1000"
                placeholder="Aggiungi note interne per il PMS"
              />
            </div>

            <div class="form-row">
              <div class="form-section">
                <label>Adulti</label>
                <input type="number" v-model="newBookingData.adults" min="1" />
              </div>
              <div class="form-section">
                <label>Bambini</label>
                <input type="number" v-model="newBookingData.children" min="0" />
              </div>
            </div>

            <div v-if="Number(newBookingData.children) > 0" class="form-section">
              <label>Età bambini</label>
              <div class="kids-ages-grid">
                <div
                  v-for="(_, idx) in normalizedChildrenCount"
                  :key="`kid-age-${idx}`"
                  class="kid-age-item"
                >
                  <span>Bambino {{ idx + 1 }}</span>
                  <input
                    type="number"
                    min="0"
                    max="17"
                    v-model.number="newBookingData.kidsAges[idx]"
                    placeholder="Età"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="dialog-section dialog-section-full">
            <h4 class="section-title">Prezzi</h4>
            <div class="form-row price-management-row">
              <div class="form-section">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="newBookingData.isManualPrice">
                  <span>Applica Prezzo Manuale</span>
                </label>
              </div>

              <div class="form-section" v-if="newBookingData.isManualPrice">
                <label>Totale Concordato (€)</label>
                <input type="number" v-model.number="newBookingData.manualPrice" class="input-manual-highlight">
              </div>
            </div>

            <div v-if="bookingQuote" class="quote-box" :class="{ 'manual-active': newBookingData.isManualPrice }">
              <div class="quote-details">
                <div v-for="day in bookingQuote.days" :key="day.date" class="quote-line">
                  <span>{{ day.date }}</span>
                  <span>€{{ day.dayTotal }}</span>
                </div>
              </div>
              <div class="quote-summary-footer">
                <div v-if="newBookingData.isManualPrice" class="price-strikethrough">
                  Calcolato: €{{ bookingQuote.totalCalculated }}
                </div>
                <div class="final-price-display">
                  TOTALE: €{{ bookingQuote.finalTotal }}
                </div>
              </div>
            </div>
          </section>

          <section class="dialog-section dialog-section-full">
            <h4 class="section-title">Deposit</h4>

            <div class="deposit-entry-grid">
              <div class="form-section">
                <label>Importo (€)</label>
                <input type="number" min="0" step="0.01" v-model.number="depositDraft.amount" placeholder="es. 100" />
              </div>
              <div class="form-section">
                <label>Data pagamento</label>
                <input type="date" v-model="depositDraft.paymentDate" />
              </div>
              <div class="form-section">
                <label>Metodo</label>
                <input type="text" v-model="depositDraft.paymentMode" placeholder="es. Bonifico" />
              </div>
              <div class="form-section deposit-add-wrap">
                <button type="button" class="btn btn-secondary" @click="addDeposit">+ Aggiungi Deposit</button>
              </div>
            </div>

            <div class="deposit-summary">
              Totale deposit inseriti: <strong>€{{ totalDeposits.toFixed(2) }}</strong>
            </div>

            <div v-if="!newBookingData.deposits.length" class="deposit-empty">
              Nessun deposit inserito
            </div>
            <div v-else class="deposit-list">
              <div v-for="(dep, index) in newBookingData.deposits" :key="`${dep.paymentDate}-${index}`" class="deposit-item">
                <div class="deposit-meta">
                  <strong>€{{ Number(dep.amount).toFixed(2) }}</strong>
                  <span>{{ dep.paymentDate }}</span>
                  <span>{{ dep.paymentMode || 'N/D' }}</span>
                </div>
                <button type="button" class="deposit-remove" @click="removeDeposit(index)">Rimuovi</button>
              </div>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button type="button" @click="showModal = false" class="btn btn-cancel">Annulla</button>
          <button v-if="editingBooking" type="button" class="btn btn-danger" @click.prevent="deleteBooking(); showModal=false">
            Elimina
          </button>
          <button type="submit" class="btn btn-save">{{ editingBooking ? 'Salva' : 'Conferma Prenotazione' }}</button>
        </div>
      </form>
    </div>
  </div>
</transition>

<div
  v-if="showBookingActionMenu"
  class="booking-action-menu"
  :style="bookingActionMenuStyle"
  @click.stop
>
  <button type="button" class="booking-action-item" @click="openEditFromMenu">
    Modifica
  </button>
  <button type="button" class="booking-action-item" @click="runBookingStatusAction">
    {{ bookingStatusActionLabel }}
  </button>
</div>

<!-- Quote Builder Modal -->
<QuoteBuilder 
  v-if="showQuoteBuilder"
  type="hotel"
  @close="showQuoteBuilder = false"
  @created="() => { showQuoteBuilder = false; router.push('/quotes'); }"
/>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { watch } from 'vue';
import { useRouter } from 'vue-router'
import QuoteBuilder from './QuoteBuilder.vue'
import { usePricing } from './composables/usePricing'

const { calculateQuotePrice, calculateOvernightTax, loadHotelPricingPolicy } = usePricing();

const rooms = ref([
  { id: 1, name: 'Camera 101 - Singola' },
  { id: 2, name: 'Camera 102 - Doppia' },
  { id: 3, name: 'Camera 103 - Suite' },
  { id: 4, name: 'Camera 201 - Doppia' },
  { id: 5, name: 'Camera 202 - Singola' }
]);

const initialPlannerStartDate = new Date();
initialPlannerStartDate.setHours(0, 0, 0, 0);
initialPlannerStartDate.setDate(initialPlannerStartDate.getDate() - 10);
const startDate = ref(initialPlannerStartDate);
const days = ref(61);
const daysToShift = 7;

// Converti le prenotazioni con date assolute
const bookings = ref([
  { id: 1, roomId: 1, startDate: new Date(2026, 0, 3), duration: 4, guest: 'Mario Rossi', color: '#3b82f6' },
  { id: 2, roomId: 1, startDate: new Date(2026, 0, 9), duration: 3, guest: 'Laura Bianchi', color: '#ef4444' },
  { id: 3, roomId: 2, startDate: new Date(2026, 0, 2), duration: 7, guest: 'Giovanni Verdi', color: '#10b981' },
  { id: 4, roomId: 3, startDate: new Date(2026, 0, 6), duration: 5, guest: 'Anna Neri', color: '#f59e0b' },
  { id: 5, roomId: 4, startDate: new Date(2026, 0, 11), duration: 6, guest: 'Paolo Gialli', color: '#8b5cf6' }
]);

const dragging = ref(null);
const resizing = ref(null);
const selectedBooking = ref(null);
const tempBooking = ref(null);
var movingReservation = ref(null);
const showQuoteBuilder = ref(false);
const router = useRouter();

const cellWidth = 60;
const cellHeight = 40;

const mouseLineX = ref(0);
const hoverDate = ref('');
const hoverRoom = ref('');

// 1. Sostituisci isMouseOverGrid con hoveredRoomId
const hoveredRoomId = ref(null); 

const handleMouseMoveGrid = (event, room) => {
  // 2. Aggiorna l'ID della camera corrente
  hoveredRoomId.value = room.id;
  
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  mouseLineX.value = x;
  
  const dayIndex = Math.floor(x / cellWidth);
  const targetDate = new Date(startDate.value);
  targetDate.setDate(targetDate.getDate() + dayIndex);
  
  hoverDate.value = targetDate.toLocaleDateString('it-IT', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  });
  
  hoverRoom.value = room.name;
};

const verticalColumnStyle = computed(() => {
  if (hoveredRoomId.value === null) return { display: 'none' };
  
  // Calcoliamo l'indice del giorno basandoci sulla posizione X del mouse
  const dayIndex = Math.floor(mouseLineX.value / cellWidth);
  
  // Calcoliamo la posizione 'left'. 
  // Poiché è dentro grid-body (che parte dall'inizio del wrapper), 
  // dobbiamo sommare i 200px della colonna "Camera" per allinearla alle celle.
  const left = (dayIndex * cellWidth) + 200; 

  return {
    left: `${left}px`,
    width: `${cellWidth}px`,
    height: '100%',
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(59, 130, 246, 0.04)', // Blu chiarissimo per la colonna
    borderLeft: '1px solid rgba(59, 130, 246, 0.2)',
    borderRight: '1px solid rgba(59, 130, 246, 0.2)',
    zIndex: 1, // Sotto la casella blu intensa e le prenotazioni
    pointerEvents: 'none'
  };
});

// La casella singola (già presente nel tuo file) rimane invariata 
// perché è relativa al container della singola riga (che non ha i 200px di offset)
const mouseLineStyle = computed(() => {
  if (hoveredRoomId.value === null) return { display: 'none' };
  const dayIndex = Math.floor(mouseLineX.value / cellWidth);
  const snappedLeft = dayIndex * cellWidth;

  return {
    left: `${snappedLeft}px`,
    width: `${cellWidth}px`,
    height: '100%',
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '2px solid #3b82f6',
    zIndex: 2,
    pointerEvents: 'none'
  };
});

const showModal = ref(false);
const editingBooking = ref(null);
const showBookingActionMenu = ref(false);
const actionMenuBooking = ref(null);
const actionMenuPosition = ref({ x: 0, y: 0 });
const depositDraft = ref({
  amount: null,
  paymentDate: '',
  paymentMode: 'Bonifico'
});
const newBookingData = ref({
  roomId: '',
  guestName: '',
  guestSurname: '',
  notes: '',
  adults: 1,
  children: 0,
  kidsAges: [],
  checkin: '',
  checkout: '',
  board: 'bb',
  isManualPrice: false,
  manualPrice: 0,
  deposits: []
});

const normalizeDeposits = (deposits) => {
  if (!Array.isArray(deposits)) return [];
  return deposits
    .map(dep => ({
      amount: Number(dep?.amount ?? 0),
      paymentMode: dep?.payment_mode || dep?.paymentMode || '',
      paymentDate: dep?.payment_date || dep?.paymentDate || ''
    }))
    .filter(dep => Number.isFinite(dep.amount) && dep.amount > 0 && dep.paymentDate);
};

const getReservationDeposits = (reservation) => {
  if (Array.isArray(reservation?.deposits)) return reservation.deposits;
  if (Array.isArray(reservation?.deposit)) return reservation.deposit;
  if (Array.isArray(reservation?.caparra)) return reservation.caparra;

  const rawJson = reservation?.deposits_json || reservation?.deposit_json || reservation?.caparra_json;
  if (typeof rawJson === 'string' && rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const getReservationNotes = (reservation) => {
  if (!reservation) return '';

  const rawNotes = reservation.notes
    ?? reservation.note
    ?? reservation.booking_notes
    ?? reservation.booking_note
    ?? reservation.note_booking
    ?? reservation.internal_notes
    ?? reservation.internal_note
    ?? reservation.accountholder?.notes
    ?? reservation.accountholder?.note
    ?? '';

  return String(rawNotes).trim();
};

const resetDepositDraft = (defaultDate = '') => {
  depositDraft.value = {
    amount: null,
    paymentDate: defaultDate || '',
    paymentMode: 'Bonifico'
  };
};

const totalDeposits = computed(() => {
  return (newBookingData.value.deposits || []).reduce((sum, dep) => sum + Number(dep.amount || 0), 0);
});

const normalizedChildrenCount = computed(() => {
  const count = Number(newBookingData.value.children);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
});

const normalizeKidsAges = (ages, expectedCount) => {
  const source = Array.isArray(ages) ? ages : [];
  const count = Math.max(0, Number(expectedCount) || 0);
  const normalized = [];
  for (let i = 0; i < count; i++) {
    const value = Number(source[i]);
    normalized.push(Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);
  }
  return normalized;
};

const addDeposit = () => {
  const amount = Number(depositDraft.value.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('Inserisci un importo deposito valido');
    return;
  }
  if (!depositDraft.value.paymentDate) {
    alert('Inserisci la data del deposito');
    return;
  }

  newBookingData.value.deposits.push({
    amount,
    paymentMode: (depositDraft.value.paymentMode || '').trim(),
    paymentDate: depositDraft.value.paymentDate
  });

  resetDepositDraft(newBookingData.value.checkin || '');
};

const removeDeposit = (index) => {
  newBookingData.value.deposits.splice(index, 1);
};

// 1. AUTOMAZIONE DATE: Il checkout segue il checkin
watch(() => newBookingData.value.checkin, (newIn) => {
  if (!newIn) return;
  const dateIn = new Date(newIn);
  const dateOut = new Date(newBookingData.value.checkout);

  if (!newBookingData.value.checkout || dateOut <= dateIn) {
    const nextDay = new Date(dateIn);
    nextDay.setDate(nextDay.getDate() + 1);
    newBookingData.value.checkout = toISODate(nextDay);
  }

  if (!depositDraft.value.paymentDate) {
    depositDraft.value.paymentDate = newIn;
  }
});

watch(() => newBookingData.value.children, (newValue) => {
  const count = Math.max(0, Number(newValue) || 0);
  newBookingData.value.kidsAges = normalizeKidsAges(newBookingData.value.kidsAges, count);
});

const getBookingStatus = (booking) => {
  const numeric = Number(booking?.status);
  return Number.isFinite(numeric) ? numeric : 0;
};

const bookingStatusActionLabel = computed(() => {
  if (!actionMenuBooking.value) return 'Check-in';
  return getBookingStatus(actionMenuBooking.value) === 1 ? 'Check-out' : 'Check-in';
});

const bookingActionMenuStyle = computed(() => ({
  left: `${actionMenuPosition.value.x}px`,
  top: `${actionMenuPosition.value.y}px`
}));

const closeBookingActions = () => {
  showBookingActionMenu.value = false;
  actionMenuBooking.value = null;
};

const openBookingActions = (event, booking) => {
  selectedBooking.value = booking.id;
  actionMenuBooking.value = booking;

  const menuWidth = 180;
  const menuHeight = 92;
  const viewportPadding = 8;
  const x = Math.min(event.clientX, window.innerWidth - menuWidth - viewportPadding);
  const y = Math.min(event.clientY + 8, window.innerHeight - menuHeight - viewportPadding);

  actionMenuPosition.value = {
    x: Math.max(viewportPadding, x),
    y: Math.max(viewportPadding, y)
  };

  showBookingActionMenu.value = true;
};

const openEditFromMenu = () => {
  if (!actionMenuBooking.value) return;
  const booking = actionMenuBooking.value;
  closeBookingActions();
  openEditBooking(booking);
};

const runBookingStatusAction = async () => {
  if (!actionMenuBooking.value) return;

  const booking = actionMenuBooking.value;
  const endpoint = getBookingStatus(booking) === 1 ? 'checkout' : 'checkin';

  try {
    await axios.get(`http://localhost:8081/api/pms/${endpoint}`, {
      params: {
        reservation: booking.id,
        operator: 0
      }
    });
    closeBookingActions();
    getReservations();
  } catch (error) {
    console.error(`Errore ${endpoint}:`, error);
    alert(`Errore durante ${endpoint === 'checkin' ? 'il check-in' : 'il check-out'}`);
  }
};

const handleGlobalClick = () => {
  if (showBookingActionMenu.value) {
    closeBookingActions();
  }
};

const addBooking = (room = null, event = null) => {
  closeBookingActions();
  selectedBooking.value = null;
  editingBooking.value = null;

  let checkin = '';
  if (room && event?.currentTarget) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.max(0, event.clientX - rect.left);
    const dayIndex = Math.min(days.value - 1, Math.floor(relativeX / cellWidth));
    const clickedDate = new Date(startDate.value);
    clickedDate.setDate(clickedDate.getDate() + dayIndex);
    checkin = toISODate(clickedDate);
  }

  if (!checkin) {
    checkin = toISODate(startDate.value);
  }

  const checkout = addDaysISO(checkin, 1);

  newBookingData.value = {
    roomId: room?.id ?? rooms.value[0]?.id ?? '',
    guestName: '',
    guestSurname: '',
    notes: '',
    adults: 1,
    children: 0,
    kidsAges: [],
    checkin,
    checkout,
    board: 'bb',
    isManualPrice: false,
    manualPrice: '',
    deposits: []
  };
  resetDepositDraft(checkin);
  showModal.value = true;
};

const createQuote = () => {
  showQuoteBuilder.value = true;
};

const openEditBooking = (booking) => {
  closeBookingActions();
  console.log('editing hotel booking', booking);
  selectedBooking.value = booking.id;
  editingBooking.value = booking;
  const start = new Date(booking.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + booking.duration);

  newBookingData.value = {
    roomId: booking.roomId,
    guestName: booking.guestName || booking.guest || '',
    guestSurname: booking.guestSurname || '',
    notes: getReservationNotes(booking),
    adults: booking.adults || 1,
    children: booking.children || 0,
    kidsAges: normalizeKidsAges(booking.kidsAges, booking.children || 0),
    checkin: toISODate(start),
    checkout: toISODate(end),
    board: booking.board || 'bb',
    isManualPrice: booking.fixedPrice != null,
    manualPrice: booking.fixedPrice || 0,
    deposits: normalizeDeposits(booking.deposits)
  };
  resetDepositDraft(toISODate(start));
  showModal.value = true;
};

const shouldTryNextEndpoint = (error) => {
  const status = error?.response?.status;
  if (!status) return true;
  return status === 404 || status === 405;
};

const postToFirstAvailableEndpoint = async (endpoints, payload) => {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await axios.post(endpoint, payload);
    } catch (error) {
      lastError = error;
      if (!shouldTryNextEndpoint(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};

const normalizeBoardForBackend = (boardValue) => {
  if (boardValue == null) return boardValue;
  return String(boardValue).toUpperCase();
};

const buildOvernightTaxSnapshot = () => {
  const tax = calculateOvernightTax({
    checkin: newBookingData.value.checkin,
    checkout: newBookingData.value.checkout,
    adults: Number(newBookingData.value.adults || 0),
    children: Number(newBookingData.value.children || 0),
    kidsAges: normalizeKidsAges(newBookingData.value.kidsAges, newBookingData.value.children)
  });

  return {
    type: 'overnight_tax',
    vatMode: 'exempt',
    ...tax
  };
};

const submitNewBooking = async () => {
  const start = new Date(newBookingData.value.checkin);
  const end = new Date(newBookingData.value.checkout);
  
  // Calcolo durata (notti)
  const diffTime = end - start;
  const duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (duration <= 0) {
    alert("La data di check-out deve essere successiva al check-in");
    return;
  }

  const normalizedDeposits = normalizeDeposits(newBookingData.value.deposits || []);
  const backendDeposits = normalizedDeposits.map(dep => ({
    amount: dep.amount,
    payment_mode: dep.paymentMode || '',
    payment_date: dep.paymentDate,
    paymentMode: dep.paymentMode || '',
    paymentDate: dep.paymentDate
  }));
  const overnightTax = buildOvernightTaxSnapshot();
  const taxesSnapshot = { overnight: overnightTax };
  const bookingNotes = String(newBookingData.value.notes || '').trim();

  const payload = {
    roomId: newBookingData.value.roomId,
    firstname: newBookingData.value.guestName,
    lastname: newBookingData.value.guestSurname,
    accountholder: {
      firstname: newBookingData.value.guestName,
      lastname: newBookingData.value.guestSurname
    },
    adults: parseInt(newBookingData.value.adults),
    children: parseInt(newBookingData.value.children),
    kids: parseInt(newBookingData.value.children),
    kidsAges: normalizeKidsAges(newBookingData.value.kidsAges, newBookingData.value.children),
    childrenAges: normalizeKidsAges(newBookingData.value.kidsAges, newBookingData.value.children),
    checkin: newBookingData.value.checkin,
    duration: duration,
    board: normalizeBoardForBackend(newBookingData.value.board),
    fixedPrice: newBookingData.value.isManualPrice ? parseFloat(newBookingData.value.manualPrice) : null,
    pricingModeSnapshot: bookingQuote.value?.pricingMode || null,
    note: bookingNotes,
    notes: bookingNotes,
    booking_note: bookingNotes,
    booking_notes: bookingNotes,
    overnight_tax: overnightTax,
    overnightTax,
    taxes: taxesSnapshot,
    taxes_json: JSON.stringify(taxesSnapshot),
    deposits: backendDeposits,
    deposit: backendDeposits,
    deposits_json: JSON.stringify(backendDeposits.map(dep => ({
      amount: dep.amount,
      payment_mode: dep.payment_mode,
      payment_date: dep.payment_date
    })))
  };

  try {
    if (editingBooking.value) {
      payload.id = editingBooking.value.id;
      await postToFirstAvailableEndpoint([
        'http://localhost:8081/api/pms/hotel/update_reservation',
        'http://localhost:8081/api/pms/hotel/updatereservation',
        'http://localhost:8081/api/pms/updatereservation'
      ], payload);

      showModal.value = false;
      editingBooking.value = null;
      getReservations();
      return;
    }

    await postToFirstAvailableEndpoint([
      'http://localhost:8081/api/pms/hotel/new_reservation',
      'http://localhost:8081/api/pms/hotel/newreservation',
      'http://localhost:8081/api/pms/newreservation'
    ], payload);

    showModal.value = false;
    getReservations();
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('Errore salvataggio prenotazione:', status, data || err);
    alert("Errore durante il salvataggio della prenotazione");
  }
};

const dates = computed(() => {
  const arr = [];
  for (let i = 0; i < days.value; i++) {
    const date = new Date(startDate.value);
    date.setDate(date.getDate() + i);
    arr.push(date);
  }
  return arr;
});

const isTodayVisible = computed(() => {
  const now = new Date();
  // Creiamo un timestamp "puro" per oggi (mezzanotte locale)
  const todayVal = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  const vStart = new Date(startDate.value);
  const startVal = new Date(vStart.getFullYear(), vStart.getMonth(), vStart.getDate()).getTime();
  
  const endVal = startVal + ((days.value - 1) * 24 * 60 * 60 * 1000);
  
  return todayVal >= startVal && todayVal <= endVal;
});

const todayLineStyle = computed(() => {
  // 1. Data di oggi in formato YYYY-MM-DD
  const now = new Date();
  const todayStr = toISODate(now);

  // 2. Data di inizio planning in formato YYYY-MM-DD
  // Ci assicuriamo che startDate sia un oggetto Date valido
  const start = new Date(startDate.value);

  // 3. Troviamo l'indice del giorno cercando la data di oggi nell'array 'dates'
  // L'array 'dates' è quello che usi per generare l'header della griglia
  const diffDays = dates.value.findIndex(d => toISODate(d) === todayStr);

  // 4. Se trovata (indice >= 0), calcoliamo la posizione
  if (diffDays !== -1) {
    return {
      position: 'absolute',
      left: `${(diffDays * cellWidth) + 200}px`,
      top: 0,
      bottom: 0,
      width: '2px',
      backgroundColor: '#ef4444',
      zIndex: 50, // Deve essere sopra tutto
      display: 'block'
    };
  }

  // Se oggi non è nel periodo visualizzato, nascondi
  return { display: 'none' };
});

const bookingQuote = computed(() => {
  const { checkin, checkout, roomId, board, adults, children } = newBookingData.value;
  if (!checkin || !checkout || !roomId) return null;

  const start = new Date(checkin);
  const end = new Date(checkout);
  const room = rooms.value.find(r => r.id === roomId);
  const numAdults = parseInt(adults) || 0;
  const numChildren = parseInt(children) || 0;

  if (!room || start >= end || numAdults + numChildren === 0) return null;

  const quote = calculateQuotePrice(
    checkin,
    checkout,
    room.type,
    'hotel',
    numAdults + numChildren,
    {
      board,
      adults: numAdults,
      children: numChildren,
      kidAges: newBookingData.value.kidsAges || []
    }
  );
  if (!quote) return null;

  const finalTotal = newBookingData.value.isManualPrice 
    ? newBookingData.value.manualPrice 
    : quote.totalCalculated;

  return {
    totalCalculated: quote.totalCalculated,
    finalTotal,
    days: quote.days,
    pricingMode: quote.pricingMode
  };
});

const formatDate = (date) => {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
};

const getDayName = (date) => {
  return date.toLocaleDateString('it-IT', { weekday: 'short' });
};

// Funzione di filtraggio: verifica l'intersezione tra due intervalli di date
const getRoomBookings = (roomId) => {
  const viewStart = new Date(startDate.value);
  viewStart.setHours(0, 0, 0, 0);
  
  const viewEnd = new Date(viewStart);
  viewEnd.setDate(viewEnd.getDate() + days.value - 1);
  viewEnd.setHours(23, 59, 59, 999);
  
  return bookings.value.filter(b => {
    // Confronto sicuro tra stringhe
    if (String(b.roomId) !== String(roomId)) return false;
    
    const bStart = new Date(b.startDate);
    bStart.setHours(0, 0, 0, 0);
    
    const bEnd = new Date(bStart);
    bEnd.setDate(bEnd.getDate() + b.duration - 1);
    
    // Logica di intersezione: la prenotazione è visibile se inizia prima della fine vista
    // E finisce dopo l'inizio della vista
    return bStart <= viewEnd && bEnd >= viewStart;
  });
};

// Calcola il giorno di inizio relativo alla finestra corrente
const getRelativeStartDay = (booking) => {
  const bStart = new Date(booking.startDate);
  bStart.setHours(0, 0, 0, 0);
  const vStart = new Date(startDate.value);
  vStart.setHours(0, 0, 0, 0);
  
  const diffTime = bStart - vStart;
  // Usiamo Math.floor per evitare errori decimali dovuti all'ora legale
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// Calcola la durata effettivamente visibile a schermo
const getVisibleDuration = (booking) => {
  const vStart = new Date(startDate.value);
  vStart.setHours(0, 0, 0, 0);
  const vEnd = new Date(vStart);
  vEnd.setDate(vEnd.getDate() + days.value - 1);

  const bStart = new Date(booking.startDate);
  const bEnd = new Date(bStart);
  bEnd.setDate(bEnd.getDate() + booking.duration - 1);

  // Clipping delle date nell'intervallo visibile
  const start = bStart < vStart ? vStart : bStart;
  const end = bEnd > vEnd ? vEnd : bEnd;

  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// Calcola l'offset se la prenotazione inizia prima della finestra
const getVisibleOffset = (booking) => {
  const bookingStart = new Date(booking.startDate);
  bookingStart.setHours(0, 0, 0, 0);
  
  const viewStart = new Date(startDate.value);
  viewStart.setHours(0, 0, 0, 0);
  
  if (bookingStart >= viewStart) return 0;
  
  const diffTime = startDate.value - booking.startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

const hasConflict = (booking) => {
  return bookings.value.some(b => {
    if (b.id === booking.id) return false;
    if (b.roomId !== booking.roomId) return false;
    
    const bookingEnd = new Date(booking.startDate);
    bookingEnd.setDate(bookingEnd.getDate() + booking.duration - 1);
    
    const bEnd = new Date(b.startDate);
    bEnd.setDate(bEnd.getDate() + b.duration - 1);
    
    return !(bookingEnd < b.startDate || booking.startDate > bEnd);
  });
};

const wouldConflict = (bookingId, roomId, startDateVal, duration) => {
  const endDate = new Date(startDateVal);
  endDate.setDate(endDate.getDate() + duration - 1);
  
  return bookings.value.some(b => {
    if (b.id === bookingId) return false;
    if (b.roomId !== roomId) return false;
    
    const bEnd = new Date(b.startDate);
    bEnd.setDate(bEnd.getDate() + b.duration - 1);
    
    return !(endDate < b.startDate || startDateVal > bEnd);
  });
};

const getMaxStartDay = (bookingId, roomId, currentEndDate) => {
  let maxStartDate = null;
  
  bookings.value.forEach(b => {
    if (b.id === bookingId || b.roomId !== roomId) return;
    
    const bEnd = new Date(b.startDate);
    bEnd.setDate(bEnd.getDate() + b.duration - 1);
    
    if (bEnd < currentEndDate) {
      const potentialStart = new Date(bEnd);
      potentialStart.setDate(potentialStart.getDate() + 1);
      if (!maxStartDate || potentialStart > maxStartDate) {
        maxStartDate = potentialStart;
      }
    }
  });
  
  return maxStartDate;
};

const getMaxDuration = (bookingId, roomId, startDateVal) => {
  let maxDuration = 365; // Un anno come massimo default
  
  bookings.value.forEach(b => {
    if (b.id === bookingId || b.roomId !== roomId) return;
    
    if (b.startDate > startDateVal) {
      const diffTime = b.startDate - startDateVal;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      maxDuration = Math.min(maxDuration, diffDays);
    }
  });
  
  return maxDuration;
};

const getBookingStyle = (booking) => {
  const bStart = new Date(booking.startDate);
  const vStart = new Date(startDate.value);
  
  // Calcolo matematico dei giorni di differenza (robusto contro ora legale)
  const diffMs = bStart.getTime() - vStart.getTime();
  const relativeStart = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  
  // Se la prenotazione inizia prima, la attacchiamo al bordo sinistro (slot 1)
  const displayStart = relativeStart < 1 ? 1 : relativeStart;
  const visibleDur = getVisibleDuration(booking);
  const status = getBookingStatus(booking);

  let backgroundColor = '#ef4444';
  let borderColor = '#dc2626';
  let textColor = '#ffffff';

  if (status === 2) {
    backgroundColor = '#9ca3af';
    borderColor = '#6b7280';
    textColor = '#111827';
  } else if (status === 1) {
    backgroundColor = '#38bdf8';
    borderColor = '#0ea5e9';
    textColor = '#ffffff';
  } else if (booking.hasDeposit) {
    backgroundColor = '#86efac';
    borderColor = '#4ade80';
    textColor = '#111827';
  }
  
  const left = (displayStart - 1) * cellWidth + 4;
  const width = (visibleDur * cellWidth) - 8;

  return {
    left: `${left}px`,
    width: `${width}px`,
    top: '4px',
    bottom: '4px',
    backgroundColor,
    borderColor,
    color: textColor,
    position: 'absolute',
    // Arrotonda gli angoli solo se la prenotazione è interamente visibile
    borderRadius: `${relativeStart < 1 ? '0' : '0.5rem'} 0.5rem 0.5rem ${relativeStart < 1 ? '0' : '0.5rem'}`
  };
};

const handleMouseDown = (e, booking, type) => {
  closeBookingActions();
  if (e.detail > 1 && type === 'move') {
    e.stopPropagation();
    openEditBooking(booking);
    return;
  }
  e.stopPropagation();
  if (type === 'move') {
    dragging.value = {
      bookingId: booking.id,
      startX: e.clientX,
      startY: e.clientY,
      originalStartDate: new Date(booking.startDate),
      originalRoomId: booking.roomId
    };
    tempBooking.value = { ...booking, startDate: new Date(booking.startDate) };
  } else if (type === 'resize-left' || type === 'resize-right') {
    resizing.value = {
      bookingId: booking.id,
      type,
      startX: e.clientX,
      originalStartDate: new Date(booking.startDate),
      originalDuration: booking.duration
    };
    tempBooking.value = { ...booking, startDate: new Date(booking.startDate) };
  }
};

const handleMouseMove = (e) => {
  if (dragging.value) {
    const deltaX = e.clientX - dragging.value.startX;
    const deltaY = e.clientY - dragging.value.startY;
    const daysDelta = Math.round(deltaX / cellWidth);
    const roomsDelta = Math.round(deltaY / cellHeight);

    const booking = bookings.value.find(b => b.id === dragging.value.bookingId);
    if (booking) {
      const newStartDate = new Date(dragging.value.originalStartDate);
      newStartDate.setDate(newStartDate.getDate() + daysDelta);
      
      const roomIndex = rooms.value.findIndex(r => r.id === dragging.value.originalRoomId) + roomsDelta;
      let newRoomId = booking.roomId;
      
      if (roomIndex >= 0 && roomIndex < rooms.value.length) {
        newRoomId = rooms.value[roomIndex].id;
      }
      
      if (!wouldConflict(booking.id, newRoomId, newStartDate, booking.duration)) {
        booking.startDate = newStartDate;
        booking.roomId = newRoomId;
        movingReservation.value = booking;
      }
    }
  } else if (resizing.value) {
    const deltaX = e.clientX - resizing.value.startX;
    const daysDelta = Math.round(deltaX / cellWidth);

    const booking = bookings.value.find(b => b.id === resizing.value.bookingId);
    if (booking) {
      if (resizing.value.type === 'resize-right') {
        const maxDur = getMaxDuration(booking.id, booking.roomId, booking.startDate);
        const newDuration = Math.max(1, resizing.value.originalDuration + daysDelta);
        const constrainedDuration = Math.min(newDuration, maxDur);
        
        if (!wouldConflict(booking.id, booking.roomId, booking.startDate, constrainedDuration)) {
          booking.duration = constrainedDuration;
        }
      } else {
        const originalEndDate = new Date(resizing.value.originalStartDate);
        originalEndDate.setDate(originalEndDate.getDate() + resizing.value.originalDuration - 1);
        
        const newStartDate = new Date(resizing.value.originalStartDate);
        newStartDate.setDate(newStartDate.getDate() + daysDelta);
        
        const maxStart = getMaxStartDay(booking.id, booking.roomId, originalEndDate);
        const constrainedStartDate = maxStart && newStartDate < maxStart ? maxStart : newStartDate;
        
        const diffTime = originalEndDate - constrainedStartDate;
        const newDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        if (newDuration >= 1 && !wouldConflict(booking.id, booking.roomId, constrainedStartDate, newDuration)) {
          booking.startDate = constrainedStartDate;
          booking.duration = newDuration;
        }
      }
      movingReservation.value = booking;
    }
  }
};

const updateReservation = (booking) => {
  if (!booking) return; // Protezione contro chiamate nulle

  console.log('Aggiornamento prenotazione:', booking.id);
  const obj = {
    id: booking.id,
    roomId: booking.roomId,
    checkin: toISODate(booking.startDate), // Usa l'helper invece di toISOString
    duration: booking.duration
  };

  axios.post('http://localhost:8081/api/pms/updatereservation', obj)
    .then(response => {
      movingReservation.value = null; // CORRETTO: usa .value
      console.log('Prenotazione aggiornata con successo');
    })
    .catch(error => {
      movingReservation.value = null; // CORRETTO: usa .value
      console.error('Errore nell\'aggiornamento:', error);
    });
};

const handleMouseUp = () => {
  if (dragging.value || resizing.value) {
    const bookingId = dragging.value?.bookingId || resizing.value?.bookingId;
    const booking = bookings.value.find(b => b.id === bookingId);
    
    // Ripristina se c'è conflitto
    if (booking && hasConflict(booking) && tempBooking.value) {
      booking.startDate = new Date(tempBooking.value.startDate);
      booking.roomId = tempBooking.value.roomId;
      booking.duration = tempBooking.value.duration;
    }
    
    // Salva solo se abbiamo effettivamente mosso qualcosa
    if (movingReservation.value) {
      updateReservation(movingReservation.value);
    }
  }
  
  dragging.value = null;
  resizing.value = null;
  tempBooking.value = null;
};

const deleteBooking = () => {
  if (editingBooking.value) {
    // call backend to delete
    axios.post('http://localhost:8081/api/pms/hotel/delete_reservation', { id: editingBooking.value.id })
      .then(() => {
        bookings.value = bookings.value.filter(b => b.id !== editingBooking.value.id);
        selectedBooking.value = null;
        editingBooking.value = null;
      })
      .catch(err => {
        console.error('Errore eliminazione:', err);
      });
  } else {
    bookings.value = bookings.value.filter(b => b.id !== selectedBooking.value);
    selectedBooking.value = null;
  }
};

const getReservations = () => {
  // Chiediamo al server dati a partire da 30 giorni prima della data visibile
  // per includere le prenotazioni che finiscono dentro la finestra attuale
  const safetyMargin = 30; 
  const fetchStart = new Date(startDate.value);
  fetchStart.setDate(fetchStart.getDate() - safetyMargin);
  
  const fromDate = toISODate(fetchStart);
  const toDateObj = new Date(startDate.value);
  toDateObj.setDate(toDateObj.getDate() + days.value - 1);
  const toDate = toISODate(toDateObj);

  var url = `http://localhost:8081/api/pms/getbookingsbyrange?from=${fromDate}&to=${toDate}`;
  
  axios.get(url)
    .then(response => {
      convertReservations(response.data);
    })
    .catch(error => {
      console.error('Errore nel caricamento:', error);
    });
};

const convertRooms = (apiRooms) => {
  rooms.value = apiRooms.map(r => ({
    id: String(r.id), // Forza ID a stringa
    name: r.description,
    type: r.room_type.label
  }));
};

const convertReservations = (apiReservations) => {
  // Nota: l'oggetto che hai postato è una singola prenotazione. 
  // Se l'API restituisce direttamente l'array, togli '.bookings'
  const data = apiReservations.bookings || apiReservations; 
  
  bookings.value = data.map(res => {
    // Trasformiamo la stringa "YYYY-MM-DD" in oggetto Date locale a mezzanotte
    const [year, month, day] = res.checkin.split('-').map(Number);
    const startDateObj = new Date(year, month - 1, day, 0, 0, 0);

    const deposits = normalizeDeposits(getReservationDeposits(res));
    const hasDeposit = deposits.some(dep => Number(dep?.amount || 0) > 0) || deposits.length > 0;

    return {
      id: res.id,
      roomId: String(res.roomId), // Forza a stringa per il confronto
      startDate: startDateObj,
      duration: res.duration,
      status: Number(res.status ?? 0),
      hasDeposit,
      deposits,
      guestName: res.accountholder?.firstname || '',
      guestSurname: res.accountholder?.lastname || '',
      adults: res.adults ?? res.pax ?? 1,
      children: res.kids ?? 0,
      kidsAges: normalizeKidsAges(res.kidsAges ?? res.childrenAges ?? res.kids_ages ?? res.children_ages, res.kids ?? 0),
      board: (res.board || 'BB').toLowerCase(),
      fixedPrice: res.fixedPrice ?? null,
      notes: getReservationNotes(res),
      guest: res.accountholder.firstname + ' ' + res.accountholder.lastname,
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
    };
  });
};

const getRooms = () =>{
  const url = 'http://localhost:8081/api/pms/getrooms'; // Sostituisci con il tuo endpoint API reale
  axios.get(url)
    .then(response => {
      console.log('Camere caricate:', response.data);
      convertRooms(response.data);
//      rooms.value = response.data;
      getReservations();
    })
    .catch(error => {
      console.error('Errore nel caricamento delle camere:', error);
    });
}

// Funzione Helper per formattare la data senza shift UTC
const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDaysISO = (dateStr, daysToAdd) => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + daysToAdd);
  return toISODate(date);
};

// Correzione Navigazione (Reset ore a mezzanotte)
const previousPeriod = () => {
  const newDate = new Date(startDate.value);
  newDate.setDate(newDate.getDate() - daysToShift);
  newDate.setHours(0, 0, 0, 0); // Reset fondamentale
  startDate.value = newDate;
  getReservations();
};

const nextPeriod = () => {
  const newDate = new Date(startDate.value);
  newDate.setDate(newDate.getDate() + daysToShift);
  newDate.setHours(0, 0, 0, 0); // Reset fondamentale
  startDate.value = newDate;
  getReservations();
};

const getDateRange = () => {
  const start = startDate.value;
  const end = new Date(start);
  end.setDate(end.getDate() + days.value - 1);
  
  return `${formatDate(start)} - ${formatDate(end)}`;
};

const pricelists = ref([]); // Da pricesDB.json
const timetable = ref([]);   // Da timeTableDB.json

const loadPricingData = async () => {
  try {
    const [resPrices, resTime] = await Promise.all([
      axios.get('http://localhost:8081/api/pms/getrates'),
      axios.get('http://localhost:8081/api/pms/gettimetable')
    ]);
    pricelists.value = resPrices.data;
    timetable.value = resTime.data;
  } catch (err) {
    console.error("Errore caricamento listini:", err);
  }
};

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('click', handleGlobalClick);
  getRooms();
  loadHotelPricingPolicy();
  loadPricingData();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('click', handleGlobalClick);
});
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
  gap: 1rem;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f9fafb;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.date-range {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  min-width: 150px;
  text-align: center;
}

.btn-nav {
  padding: 0.5rem 0.75rem;
  border: none;
  background: white;
  cursor: pointer;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  font-weight: bold;
  font-size: 1rem;
}

.btn-nav:hover {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.kids-ages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.6rem;
}

.kid-age-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.kid-age-item span {
  font-size: 0.8rem;
  color: #4b5563;
}

.btn-danger {
  background: #ef4444;
  color: white;
  margin-top: 1.5rem;
}

.btn-danger:hover {
  background: #dc2626;
}

.content {
  flex: 1;
  overflow: auto;
}

.grid-wrapper {
  display: inline-block;
  min-width: 100%;
}

.grid-header {
  position: sticky;
  top: 0;
  background: white;
  z-index: 20;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-row {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.room-label {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  background: #f9fafb;
  font-weight: 600;
  padding: 0.75rem;
  display: flex;
  align-items: center;
}

.date-cell {
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  text-align: center;
  padding: 0.5rem;
}

.date-day {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
}

.date-num {
  font-size: 0.875rem;
  font-weight: 500;
}

.grid-body {
  position: relative;
}

.room-row {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

/* Altezza ridotta per la cella con il nome della camera */
.room-cell {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  background: white;
  font-weight: 500;
  padding: 0 0.75rem; /* Ridotto il padding verticale a 0 */
  display: flex;
  align-items: center;
  height: 40px; /* Deve corrispondere a cellHeight */
  position: sticky;
  left: 0;
  z-index: 10;
  font-size: 0.85rem; /* Testo leggermente più piccolo per equilibrio */
}

.days-container {
  display: flex;
  flex: 1;
  position: relative;
}

.day-slot {
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
}

/* Riduciamo anche i margini verticali della barra prenotazione */
.booking {
  position: absolute;
  cursor: move;
  border-radius: 0.3rem; /* Angoli meno arrotondati per altezze piccole */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid; /* Bordo più sottile */
  transition: all 0.1s;
  top: 3px !important;    /* Margine superiore minimo */
  bottom: 3px !important; /* Margine inferiore minimo */
}

.booking-conflict {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);
}


/* Padding ridotto per la prenotazione */
.booking-content {
  padding: 2px 8px; /* Padding minimo per far stare il nome al centro */
  color: inherit;
  font-weight: 500;
  font-size: 0.8rem; /* Font leggermente ridotto */
  height: 100%;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.booking-guest {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.booking-duration {
  font-size: 0.75rem;
  opacity: 0.9;
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
}

.resize-handle:hover {
  background: rgba(0, 0, 0, 0.2);
}

.resize-left {
  left: 0;
  border-radius: 0.5rem 0 0 0.5rem;
}

.resize-right {
  right: 0;
  border-radius: 0 0.5rem 0.5rem 0;
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-controls {
    flex-direction: column;
  }

  .date-navigation {
    justify-content: center;
  }
}

.today-line {
  position: absolute;
  width: 2px;
  background-color: #ef4444;
  pointer-events: none; /* Importante: non deve bloccare il mouse */
}

.today-indicator {
  position: absolute;
  top: -22px;
  left: -15px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.mouse-tooltip {
  top: -40px; /* Avvicinato alla riga */
  padding: 3px 10px;
  font-size: 10px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: white;
  border-radius: 6px;
  white-space: nowrap;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 100;
  pointer-events: none;
}

.mouse-tooltip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: #1e293b transparent transparent transparent;
}

.tooltip-date {
  font-weight: bold;
  text-transform: capitalize;
}

.tooltip-room {
  opacity: 0.8;
  font-size: 9px;
}

/* Stile per la riga evidenziata al passaggio del mouse */
.room-row:hover {
  background-color: rgba(59, 130, 246, 0.03);
}
.vertical-column-highlight {
  pointer-events: none;
  background-color: rgba(59, 130, 246, 0.05);
}

/* Opzionale: illumina leggermente l'header del giorno corrispondente */
.date-cell.highlighted {
  background-color: #eff6ff;
  color: #3b82f6;
}
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.booking-action-menu {
  position: fixed;
  z-index: 2200;
  min-width: 180px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.booking-action-item {
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  text-align: left;
  color: #111827;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
}

.booking-action-item:hover {
  background: #f3f4f6;
}

.modal-content {
  background: white;
  width: 90%;
  max-width: 980px;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.dialog-section {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
  background: #fafafa;
}

.dialog-section-full {
  grid-column: 1 / -1;
}

.section-title {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #111827;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.form-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}

.form-section label {
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
  margin-bottom: 5px;
  text-transform: uppercase;
}

.form-section input, .form-section select, .form-section textarea {
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.form-section textarea {
  resize: vertical;
  min-height: 84px;
}

.deposit-entry-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr auto;
  gap: 10px;
  align-items: end;
}

.deposit-add-wrap {
  display: flex;
  justify-content: flex-end;
}

.deposit-summary {
  margin-top: 8px;
  margin-bottom: 8px;
  color: #374151;
  font-size: 0.92rem;
}

.deposit-empty {
  padding: 10px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 0.9rem;
}

.deposit-list {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.deposit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.deposit-item:last-child {
  border-bottom: none;
}

.deposit-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  color: #334155;
  font-size: 0.88rem;
}

.deposit-remove {
  border: 1px solid #fecaca;
  color: #b91c1c;
  background: #fff5f5;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.82rem;
}

.deposit-remove:hover {
  background: #fee2e2;
}

@media (max-width: 980px) {
  .dialog-layout {
    grid-template-columns: 1fr;
  }

  .deposit-entry-grid {
    grid-template-columns: 1fr;
  }

  .deposit-add-wrap {
    justify-content: flex-start;
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.modal-footer .btn {
  margin-top: 0;
}

.btn-save { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-cancel { background: #f3f4f6; color: #374151; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }

/* Animazione */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.quote-summary {
  margin-top: 20px;
  padding: 15px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.quote-scroll {
  max-height: 120px;
  overflow-y: auto;
  margin: 10px 0;
  border-bottom: 1px solid #cbd5e1;
}

.quote-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 4px 0;
  color: #475569;
}

.quote-total {
  display: flex;
  justify-content: space-between;
  font-weight: 800;
  font-size: 1.1rem;
  color: #1e293b;
  padding-top: 10px;
}

.quote-summary h4 {
  margin: 0;
  font-size: 0.9rem;
  color: #334155;
  text-transform: uppercase;
}

/* Radio Buttons come Card */
.board-radio-group {
  display: flex;
  gap: 10px;
  margin-top: 5px;
}

.board-radio-card {
  flex: 1;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.board-radio-card.is-selected {
  background: #3b82f6;
  color: white;
  border-color: #2563eb;
  font-weight: bold;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.hidden-radio {
  display: none;
}

/* Prezzo Manuale */
.input-manual-highlight {
  border: 2px solid #ef4444 !important; /* Rosso per indicare "attenzione/manuale" */
  background: #fef2f2;
  font-weight: 800;
  font-size: 1.1rem;
}

.quote-box.manual-active {
  border-left: 4px solid #ef4444;
  background: #fff5f5;
}

.price-strikethrough {
  text-decoration: line-through;
  color: #94a3b8;
  font-size: 0.8rem;
}

.final-price-display {
  font-size: 1.3rem;
  font-weight: 800;
  color: #1e293b;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  margin-top: 10px;
}

.quote-preview {
  margin-top: 15px;
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
}
.quote-list { max-height: 100px; overflow-y: auto; margin: 8px 0; }
.quote-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  padding: 4px 0;
  border-bottom: 1px solid #f1f5f9;
}
.quote-footer {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  font-size: 1rem;
  padding-top: 8px;
  border-top: 2px solid #cbd5e1;
}
.manual-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.manual-input {
  border: 2px solid #3b82f6 !important;
  background: #eff6ff;
  font-weight: bold;
  font-size: 1.1rem;
}

.quote-container {
  margin-top: 15px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 12px;
}

.quote-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  padding: 4px 0;
}

.original-price {
  text-decoration: line-through;
  color: #94a3b8;
  font-size: 0.8rem;
}

.final-price {
  font-weight: 800;
  font-size: 1.2rem;
  color: #1e293b;
}

.animate-fade {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Contenitore principale del preventivo */
.quote-box {
  margin-top: 20px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s ease;
}

/* Evidenziazione quando il prezzo è manuale */
.quote-box.manual-active {
  border-left: 5px solid #ef4444;
  background: #fff5f5;
}

/* Area scrollabile con l'elenco delle notti */
.quote-details {
  max-height: 150px;
  overflow-y: auto;
  padding: 12px;
  background: white;
  margin: 10px;
  border-radius: 6px;
  border: 1px solid #edf2f7;
}

/* Singola riga del giorno */
.quote-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.85rem;
  color: #475569;
}

.quote-line:last-child {
  border-bottom: none;
}

.quote-line span:first-child {
  font-family: monospace; /* Rende le date più allineate */
}

/* Footer con il calcolo finale */
.quote-summary-footer {
  padding: 15px;
  background: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.quote-box.manual-active .quote-summary-footer {
  background: #fee2e2;
}

/* Prezzo originale barrato (quando c'è il manuale) */
.price-strikethrough {
  text-decoration: line-through;
  color: #94a3b8;
  font-size: 0.8rem;
  margin-bottom: 2px;
}

/* Prezzo finale grande */
.final-price-display {
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
}

.quote-box.manual-active .final-price-display {
  color: #b91c1c;
}
</style>