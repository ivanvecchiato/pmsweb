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
      <button @click="addBooking" class="btn btn-primary">
        + Nuova Prenotazione
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
                  'booking-selected': selectedBooking === booking.id,
                  'booking-conflict': hasConflict(booking)
                }"
                :style="getBookingStyle(booking)"
                @mousedown="handleMouseDown($event, booking, 'move')"
                @click="selectedBooking = booking.id"
              >
                <div
                  class="resize-handle resize-left"
                  @mousedown.stop="handleMouseDown($event, booking, 'resize-left')"
                />
                
                <div class="booking-content">
                  <div class="booking-guest">{{ booking.guest }}</div>
                  <div class="booking-duration">
                    {{ booking.duration }} {{ booking.duration === 1 ? 'notte' : 'notti' }}
                  </div>
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

    <div v-if="selectedBooking" class="footer">
      <div class="footer-content">
        <div class="input-group">
          <label class="input-label">Nome Cliente</label>
          <input
            type="text"
            :value="getSelectedGuest()"
            @input="updateGuest($event.target.value)"
            class="input-field"
          />
        </div>
        <button @click="deleteBooking" class="btn btn-danger">
          Elimina
        </button>
      </div>
    </div>

<transition name="fade">
  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Nuova Prenotazione</h3>
        <button @click="showModal = false" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="submitNewBooking" class="booking-form">
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
            <label>Nome</label>
            <input type="text" v-model="newBookingData.guestName" required placeholder="es. Mario" />
          </div>
          <div class="form-section">
            <label>Cognome</label>
            <input type="text" v-model="newBookingData.guestSurname" required placeholder="es. Rossi" />
          </div>
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

        <div class="modal-footer">
          <button type="button" @click="showModal = false" class="btn btn-cancel">Annulla</button>
          <button type="submit" class="btn btn-save">Conferma Prenotazione</button>
        </div>
      </form>
    </div>
  </div>
</transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';

const rooms = ref([
  { id: 1, name: 'Camera 101 - Singola' },
  { id: 2, name: 'Camera 102 - Doppia' },
  { id: 3, name: 'Camera 103 - Suite' },
  { id: 4, name: 'Camera 201 - Doppia' },
  { id: 5, name: 'Camera 202 - Singola' }
]);

const startDate = ref(new Date(2026, 0, 1));
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

const cellWidth = 60;
const cellHeight = 60;

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
const newBookingData = ref({
  roomId: '',
  guestName: '',
  guestSurname: '',
  adults: 1,
  children: 0,
  checkin: '',
  checkout: ''
});

const addBooking = () => {
  // Inizializza con la prima camera disponibile e date vuote
  newBookingData.value = {
    roomId: rooms.value[0]?.id || '',
    guestName: '',
    guestSurname: '',
    adults: 1,
    children: 0,
    checkin: new Date().toISOString().split('T')[0], // Oggi come default
    checkout: ''
  };
  showModal.value = true;
};

const submitNewBooking = () => {
  const start = new Date(newBookingData.value.checkin);
  const end = new Date(newBookingData.value.checkout);
  
  // Calcolo durata (notti)
  const diffTime = end - start;
  const duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (duration <= 0) {
    alert("La data di check-out deve essere successiva al check-in");
    return;
  }

  const payload = {
    roomId: newBookingData.value.roomId,
    firstname: newBookingData.value.guestName,
    lastname: newBookingData.value.guestSurname,
    adults: parseInt(newBookingData.value.adults),
    children: parseInt(newBookingData.value.children),
    checkin: newBookingData.value.checkin,
    duration: duration
  };

  axios.post('http://localhost:8081/api/pms/createreservation', payload)
    .then(() => {
      showModal.value = false;
      getReservations(); // Ricarica i dati per mostrare la nuova barra
    })
    .catch(err => {
      console.error("Errore creazione:", err);
      alert("Errore durante il salvataggio della prenotazione");
    });
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
  const todayStr = now.toISOString().split('T')[0];

  // 2. Data di inizio planning in formato YYYY-MM-DD
  // Ci assicuriamo che startDate sia un oggetto Date valido
  const start = new Date(startDate.value);
  const startStr = start.toISOString().split('T')[0];

  // 3. Troviamo l'indice del giorno cercando la data di oggi nell'array 'dates'
  // L'array 'dates' è quello che usi per generare l'header della griglia
  const diffDays = dates.value.findIndex(d => d.toISOString().split('T')[0] === todayStr);

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
  
  const left = (displayStart - 1) * cellWidth + 4;
  const width = (visibleDur * cellWidth) - 8;

  return {
    left: `${left}px`,
    width: `${width}px`,
    top: '4px',
    bottom: '4px',
    backgroundColor: booking.color,
    borderColor: booking.color,
    position: 'absolute',
    // Arrotonda gli angoli solo se la prenotazione è interamente visibile
    borderRadius: `${relativeStart < 1 ? '0' : '0.5rem'} 0.5rem 0.5rem ${relativeStart < 1 ? '0' : '0.5rem'}`
  };
};

const handleMouseDown = (e, booking, type) => {
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
  bookings.value = bookings.value.filter(b => b.id !== selectedBooking.value);
  selectedBooking.value = null;
};

const updateGuest = (value) => {
  const booking = bookings.value.find(b => b.id === selectedBooking.value);
  if (booking) {
    booking.guest = value;
  }
};

const getSelectedGuest = () => {
  const booking = bookings.value.find(b => b.id === selectedBooking.value);
  return booking ? booking.guest : '';
};

const getReservations = () => {
  // Chiediamo al server dati a partire da 30 giorni prima della data visibile
  // per includere le prenotazioni che finiscono dentro la finestra attuale
  const safetyMargin = 30; 
  const fetchStart = new Date(startDate.value);
  fetchStart.setDate(fetchStart.getDate() - safetyMargin);
  
  const fromDate = fetchStart.toISOString().split('T')[0];
  const toDateObj = new Date(startDate.value);
  toDateObj.setDate(toDateObj.getDate() + days.value - 1);
  const toDate = toDateObj.toISOString().split('T')[0];

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
    name: r.description
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

    return {
      id: res.id,
      roomId: String(res.roomId), // Forza a stringa per il confronto
      startDate: startDateObj,
      duration: res.duration,
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

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  getRooms();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
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

.room-row:hover {
  background: #f9fafb;
}

.room-cell {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  background: white;
  font-weight: 500;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  position: sticky;
  left: 0;
  z-index: 10;
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

.booking {
  position: absolute;
  cursor: move;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 2px solid;
  transition: all 0.1s;
}

.booking-selected {
  box-shadow: 0 0 0 3px #3b82f6;
}

.booking-conflict {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);
}

.booking-content {
  padding: 0.5rem 0.75rem;
  color: white;
  font-weight: 500;
  font-size: 0.875rem;
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

.footer {
  background: white;
  border-top: 1px solid #e5e7eb;
  padding: 1rem;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
}

.footer-content {
  max-width: 60rem;
  margin: 0 auto;
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.input-group {
  flex: 1;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.25rem;
}

.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.input-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  position: absolute;
  top: -45px; /* Alzato leggermente per non coprire il bordo superiore */
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: white;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 100;
  pointer-events: none;
}

/* Stile per evidenziare meglio la riga intera al passaggio */
.room-row:hover {
  background-color: rgba(59, 130, 246, 0.04);
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

.modal-content {
  background: white;
  width: 90%;
  max-width: 550px;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
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
  margin-bottom: 15px;
}

.form-section label {
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
  margin-bottom: 5px;
  text-transform: uppercase;
}

.form-section input, .form-section select {
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-save { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-cancel { background: #f3f4f6; color: #374151; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }

/* Animazione */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>