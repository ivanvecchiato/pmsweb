<template>
  <div class="planner-container">
    <div class="header">
      <h1 class="title">Planning Prenotazioni Hotel</h1>
      <button @click="addBooking()" class="btn btn-primary">
        + Nuova Prenotazione
      </button>
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
          <div v-for="room in rooms" :key="room.id" class="room-row">
            <div class="room-cell">{{ room.name }}</div>
            <div class="days-container" :style="{ height: cellHeight + 'px' }" @click="handleGridClick($event, room.id)">
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
                :class="{ 'booking-selected': selectedBooking === booking.id }"
                :style="getBookingStyle(booking)"
                @mousedown="handleMouseDown($event, booking, 'move')"
                @click.prevent.stop="openEditBooking(booking)" @dblclick.prevent.stop="openEditBooking(booking)"
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

    <div v-if="selectedBooking && !showModal" class="footer">
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

    <!-- modal for new/edit booking -->
    <transition name="fade">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ editingBookingId ? 'Dettagli Prenotazione' : 'Nuova Prenotazione' }}</h3>
            <button @click="showModal = false" class="close-btn">&times;</button>
          </div>
          <form @submit.prevent="submitBooking" class="booking-form">
            <div class="form-section">
              <label>Camera</label>
              <select v-model="bookingForm.roomId" required>
                <option value="" disabled>Seleziona camera</option>
                <option v-for="r in rooms" :key="r.id" :value="r.id">
                  {{ r.name }}
                </option>
              </select>
            </div>

            <div class="form-section">
              <label>Cliente</label>
              <input type="text" v-model="bookingForm.guest" required placeholder="Nome e Cognome" />
            </div>

            <div class="form-row">
              <div class="form-section">
                <label>Check-in</label>
                <input type="date" v-model="bookingForm.checkin" required />
              </div>
              <div class="form-section">
                <label>Check-out</label>
                <input type="date" v-model="bookingForm.checkout" required />
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" @click="showModal = false" class="btn btn-cancel">Annulla</button>
              <button type="submit" class="btn btn-save">
                {{ editingBookingId ? 'Salva' : 'Conferma' }}
              </button>
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

const bookings = ref([
  { id: 1, roomId: 1, startDay: 2, duration: 4, guest: 'Mario Rossi', color: '#3b82f6' },
  { id: 2, roomId: 1, startDay: 8, duration: 3, guest: 'Laura Bianchi', color: '#ef4444' },
  { id: 3, roomId: 2, startDay: 1, duration: 7, guest: 'Giovanni Verdi', color: '#10b981' },
  { id: 4, roomId: 3, startDay: 5, duration: 5, guest: 'Anna Neri', color: '#f59e0b' },
  { id: 5, roomId: 4, startDay: 10, duration: 6, guest: 'Paolo Gialli', color: '#8b5cf6' }
]);

const dragging = ref(null);
const resizing = ref(null);
const selectedBooking = ref(null);
var movingReservation = ref(null);
const suppressGridClickUntil = ref(0);

// modal & form state for hotel bookings
const showModal = ref(false);
const editingBookingId = ref(null);
const bookingForm = ref({
  roomId: '',
  guest: '',
  checkin: '',
  checkout: ''
});

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDaysISO = (dateStr, daysToAdd) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  return toISODate(d);
};

const diffDays = (start, end) => {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((e - s) / (1000 * 60 * 60 * 24));
};

const cellWidth = 60;
const cellHeight = 60;

const dates = computed(() => {
  const arr = [];
  for (let i = 0; i < days.value; i++) {
    const date = new Date(startDate.value);
    date.setDate(date.getDate() + i);
    arr.push(date);
  }
  return arr;
});

const formatDate = (date) => {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
};

const getDayName = (date) => {
  return date.toLocaleDateString('it-IT', { weekday: 'short' });
};

const getRoomBookings = (roomId) => {
  return bookings.value.filter(b => b.roomId === roomId);
};

const getBookingStyle = (booking) => {
  const isDragging = dragging.value?.bookingId === booking.id;
  const isResizing = resizing.value?.bookingId === booking.id;
  return {
    left: `${(booking.startDay - 1) * cellWidth + 4}px`,
    width: `${booking.duration * cellWidth - 8}px`,
    top: '4px',
    bottom: '4px',
    backgroundColor: booking.color,
    borderColor: booking.color,
    opacity: isDragging || isResizing ? 0.7 : 1
  };
};

const handleMouseDown = (e, booking, type) => {
  // if this is a double-click, open edit form and don't start dragging
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
      originalStartDay: booking.startDay,
      originalRoomId: booking.roomId
    };
  } else if (type === 'resize-left' || type === 'resize-right') {
    resizing.value = {
      bookingId: booking.id,
      type,
      startX: e.clientX,
      originalStartDay: booking.startDay,
      originalDuration: booking.duration
    };
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
      booking.startDay = Math.max(1, Math.min(days.value - booking.duration + 1, dragging.value.originalStartDay + daysDelta));
      
      const roomIndex = rooms.value.findIndex(r => r.id === dragging.value.originalRoomId) + roomsDelta;
      if (roomIndex >= 0 && roomIndex < rooms.value.length) {
        booking.roomId = rooms.value[roomIndex].id;
      }

      movingReservation = booking;
    }
  } else if (resizing.value) {
    const deltaX = e.clientX - resizing.value.startX;
    const daysDelta = Math.round(deltaX / cellWidth);

    const booking = bookings.value.find(b => b.id === resizing.value.bookingId);
    if (booking) {
      if (resizing.value.type === 'resize-right') {
        const newDuration = Math.max(1, resizing.value.originalDuration + daysDelta);
        booking.duration = Math.min(newDuration, days.value - booking.startDay + 1);
      } else {
        const newStartDay = Math.max(1, resizing.value.originalStartDay + daysDelta);
        const newDuration = resizing.value.originalDuration - (newStartDay - resizing.value.originalStartDay);
        if (newDuration >= 1) {
          booking.startDay = newStartDay;
          booking.duration = newDuration;
        }
      }
      movingReservation = booking;
    }
  }
};

const updateReservation = (booking) => {
  console.log('Aggiornamento prenotazione:', booking.id);
  const obj = {
    id: booking.id,
    roomId: booking.roomId,
    checkin: toISODate(new Date(startDate.value.getTime() + (booking.startDay) * 24 * 60 * 60 * 1000)),
    duration: booking.duration
  }
  axios.post('/api/pms/updatereservation', obj)
    .then(response => {
      movingReservation = null;
      console.log('Prenotazione aggiornata con successo:', response.data);
    })
    .catch(error => {
      movingReservation = null;
      console.error('Errore nell\'aggiornamento della prenotazione:', error);
    });
};

const handleMouseUp = () => {
  const hadDragOrResize = !!dragging.value || !!resizing.value;
  dragging.value = null;
  resizing.value = null;
  if (hadDragOrResize) {
    suppressGridClickUntil.value = Date.now() + 250;
  }
  updateReservation(movingReservation);
};

const addBooking = () => {
  if (Date.now() < suppressGridClickUntil.value) return;
  // open modal for new booking with default values
  const checkin = toISODate(startDate.value);
  selectedBooking.value = null;
  editingBookingId.value = null;
  bookingForm.value = {
    roomId: rooms.value[0]?.id || '',
    guest: '',
    checkin,
    checkout: addDaysISO(checkin, 1)
  };
  showModal.value = true;
};

const addBookingFromCell = (roomId, date) => {
  if (Date.now() < suppressGridClickUntil.value) return;
  // open modal for new booking prefilled from clicked cell
  const checkin = toISODate(date);
  selectedBooking.value = null;
  editingBookingId.value = null;
  bookingForm.value = {
    roomId: roomId || rooms.value[0]?.id || '',
    guest: '',
    checkin,
    checkout: addDaysISO(checkin, 1)
  };
  showModal.value = true;
};

const handleGridClick = (event, roomId) => {
  if (event.target.closest('.booking')) return;
  const containerRect = event.currentTarget.getBoundingClientRect();
  const relativeX = Math.max(0, event.clientX - containerRect.left);
  const dayIndex = Math.min(days.value - 1, Math.floor(relativeX / cellWidth));
  const checkinDate = new Date(startDate.value);
  checkinDate.setDate(checkinDate.getDate() + dayIndex);
  addBookingFromCell(roomId, checkinDate);
};

const openEditBooking = (booking) => {
  console.log('openEditBooking called for', booking);
  selectedBooking.value = booking.id;
  editingBookingId.value = booking.id;
  const start = new Date(startDate.value);
  const checkinDate = new Date(start.getTime() + (booking.startDay - 1) * 24 * 60 * 60 * 1000);
  bookingForm.value = {
    roomId: booking.roomId,
    guest: booking.guest,
    checkin: toISODate(checkinDate),
    checkout: addDaysISO(toISODate(checkinDate), booking.duration)
  };
  showModal.value = true;
};

const submitBooking = () => {
  const { roomId, guest, checkin, checkout } = bookingForm.value;
  if (!roomId || !guest || !checkin || !checkout) {
    alert('Compila tutti i campi');
    return;
  }
  const startDay = Math.floor((new Date(checkin) - startDate.value) / (1000 * 60 * 60 * 24)) + 1;
  const duration = Math.max(diffDays(new Date(checkin), new Date(checkout)), 1);

  if (editingBookingId.value) {
    const booking = bookings.value.find(b => b.id === editingBookingId.value);
    if (booking) {
      booking.roomId = roomId;
      booking.guest = guest;
      booking.startDay = startDay;
      booking.duration = duration;
      updateReservation(booking);
    }
  } else {
    const maxId = Math.max(...bookings.value.map(b => b.id), 0);
    const newBooking = {
      id: maxId + 1,
      roomId,
      startDay,
      duration,
      guest,
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
    };
    bookings.value.push(newBooking);
  }
  showModal.value = false;
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

const getReservations = () =>{
  const fromDate = toISODate(startDate.value);
  const toDateObj = new Date(startDate.value);
  toDateObj.setDate(toDateObj.getDate() + days.value - 1);
  const toDate = toISODate(toDateObj);

  var url = '/api/pms/getbookingsbyrange';
  url += `?from=${fromDate}&to=${toDate}`;
  console.log('Fetching reservations from:', url);
  axios.get(url)
    .then(response => {
      console.log('Prenotazioni caricate:', response.data);
      //bookings.value = response.data;
      convertReservations(response.data);
    })
    .catch(error => {
      console.error('Errore nel caricamento delle prenotazioni:', error);
    });
};

const convertRooms = (apiRooms) => {
  rooms.value = apiRooms.map(r => ({
    id: r.id,
    name: r.description
  }));
};

const convertReservations = (apiReservations) => {
  bookings.value = apiReservations.bookings.map(res => ({
    id: res.id,
    roomId: res.roomId,
    startDay: Math.floor((new Date(res.checkin) - startDate.value) / (1000 * 60 * 60 * 24)) + 1,
    duration: res.duration,
    guest: res.accountholder.firstname + ' ' + res.accountholder.lastname,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
  }));
};

const getRooms = () =>{
  const url = '/api/pms/getrooms'; // Sostituisci con il tuo endpoint API reale
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

.btn {
  padding: 0.8rem 1.2rem;
  border: 1px solid transparent;
  border-radius: 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-danger {
  background: rgba(220, 77, 77, 0.12);
  border-color: rgba(220, 77, 77, 0.18);
  color: var(--ds-danger);
  margin-top: 1.5rem;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-text);
  border-color: rgba(148, 163, 184, 0.18);
}

.btn-save {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.content {
  flex: 1;
  overflow: auto;
}

.grid-wrapper {
  display: inline-block;
  min-width: 100%;
  border-radius: 30px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.grid-header {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.92);
  z-index: 20;
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.header-row {
  display: flex;
}

.room-label {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(248, 250, 252, 0.92);
  font-weight: 800;
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  color: var(--ds-text);
}

.date-cell {
  flex-shrink: 0;
  border-right: 1px solid rgba(148, 163, 184, 0.16);
  text-align: center;
  padding: 0.65rem 0.5rem;
}

.date-day {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ds-text-soft);
}

.date-num {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ds-text);
}

.grid-body {
  position: relative;
}

.room-row {
  display: flex;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.room-row:hover {
  background: rgba(248, 250, 252, 0.72);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(36, 49, 66, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 28px;
  width: 440px;
  max-width: 90%;
  padding: 24px;
  position: relative;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-soft);
  backdrop-filter: blur(24px);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ds-text);
}

.close-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--ds-text-soft);
}

.booking-form .form-section {
  margin-bottom: 14px;
}

.booking-form .form-row {
  display: flex;
  gap: 12px;
}

.booking-form label {
  display: block;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ds-text-soft);
  margin-bottom: 6px;
}

.booking-form input,
.booking-form select,
.input-field {
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  font: inherit;
  color: var(--ds-text);
}

.booking-form input:focus,
.booking-form select:focus,
.input-field:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.room-cell {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.92);
  font-weight: 700;
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  position: sticky;
  left: 0;
  z-index: 10;
  color: var(--ds-text);
}

.days-container {
  display: flex;
  flex: 1;
  position: relative;
}

.day-slot {
  flex-shrink: 0;
  border-right: 1px solid rgba(148, 163, 184, 0.14);
}

.booking {
  position: absolute;
  cursor: move;
  border-radius: 16px;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.16);
  border: 2px solid;
  transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.1s ease;
}

.booking-selected {
  box-shadow: 0 0 0 3px rgba(29, 140, 242, 0.55), 0 14px 26px rgba(29, 140, 242, 0.2);
}

.booking-content {
  padding: 0.55rem 0.85rem;
  color: white;
  font-weight: 700;
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
  background: rgba(255, 255, 255, 0.2);
}

.resize-left {
  left: 0;
  border-radius: 16px 0 0 16px;
}

.resize-right {
  right: 0;
  border-radius: 0 16px 16px 0;
}

.footer {
  padding: 22px 24px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.footer-content {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.input-group {
  flex: 1;
}

.input-label {
  display: block;
  font-size: 0.74rem;
  font-weight: 800;
  color: var(--ds-text-soft);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

@media (max-width: 960px) {
  .header,
  .footer-content,
  .booking-form .form-row {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 720px) {
  .header,
  .footer,
  .grid-wrapper {
    border-radius: 24px;
  }

  .header,
  .footer {
    padding: 18px;
  }
}
</style>