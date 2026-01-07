<template>
  <div class="planner-container">
    <div class="header">
      <h1 class="title">Planning Prenotazioni Hotel</h1>
      <button @click="addBooking" class="btn btn-primary">
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
            <div class="days-container" :style="{ height: cellHeight + 'px' }">
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
    checkin: new Date(startDate.value.getTime() + (booking.startDay) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    duration: booking.duration
  }
  axios.post('http://localhost:8081/api/pms/updatereservation', obj)
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
  dragging.value = null;
  resizing.value = null;
  updateReservation(movingReservation);
};

const addBooking = () => {
  const maxId = Math.max(...bookings.value.map(b => b.id), 0);
  const newBooking = {
    id: maxId + 1,
    roomId: rooms.value[0].id,
    startDay: 1,
    duration: 3,
    guest: 'Nuovo Cliente',
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
  };
  bookings.value.push(newBooking);
  selectedBooking.value = newBooking.id;
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
  const fromDate = startDate.value.toISOString().split('T')[0];
  const toDateObj = new Date(startDate.value);
  toDateObj.setDate(toDateObj.getDate() + days.value - 1);
  const toDate = toDateObj.toISOString().split('T')[0];

  var url = 'http://localhost:8081/api/pms/getbookingsbyrange';
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
</style>