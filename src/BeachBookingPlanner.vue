<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import BeachMap from './BeachMap.vue';
import { useRouter } from 'vue-router'
import QuoteBuilder from './QuoteBuilder.vue'

const places = ref([]);
const bookings = ref([]);
const pricelists = ref([]);
const timetable = ref([]);

const startDate = ref(new Date());
const days = ref(31);
const daysToShift = 7;

const cellWidth = 60;
const cellHeight = 36;

const selectedBooking = ref(null);
const showModal = ref(false);
const editingBooking = ref(null); // store booking being edited when modal open
const showMap = ref(true);
const selectedDate = ref(new Date().toISOString().split('T')[0]);
const isLoading = ref(false);
const loadError = ref('');
const selectedSector = ref('all');
const selectedRow = ref('all');
const searchQuery = ref('');

const dragging = ref(null);
const tempBooking = ref(null);
const hoveredPlaceId = ref(null);
const editGuest = ref({ first: '', last: '' });
const showQuoteBuilder = ref(false);
const router = useRouter();

const newBookingData = ref({
  placeId: '',
  guestName: '',
  guestSurname: '',
  checkin: '',
  checkout: '',
  isManualPrice: false,
  manualPrice: 0
});

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeResource = (res) => {
  const row = toNumber(res.row) ?? toNumber(res.riga) ?? toNumber(res.fila) ?? 0;
  const column = toNumber(res.column) ?? toNumber(res.fila) ?? toNumber(res.riga) ?? 0;
  const sector = res.sector ?? res.zona ?? '';
  const name = res.name ?? res.code ?? `${sector}${row}-${column}`;
  return { ...res, row, column, sector, name };
};

const normalizeBooking = (b) => {
  const checkin = b.checkin;
  const checkout = b.checkout;
  const duration = diffDays(new Date(checkin), new Date(checkout));
  const acc = b.accountholder || {};
  const guestFirst = acc.firstname || '';
  const guestLast = acc.lastname || '';
  const guest = `${guestFirst} ${guestLast}`.trim() || 'Senza Nome';
  return {
    id: b.id,
    placeId: String(b.placeId),
    startDate: new Date(checkin),
    duration: Math.max(duration, 1),
    guestFirst,
    guestLast,
    guest,
    color: colorFromId(b.id)
  };
};

const colorFromId = (id) => {
  const palette = ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#e11d48'];
  if (!id) return palette[0];
  const str = String(id);
  let acc = 0;
  for (let i = 0; i < str.length; i++) acc += str.charCodeAt(i);
  return palette[acc % palette.length];
};

const dates = computed(() => {
  const arr = [];
  for (let i = 0; i < days.value; i++) {
    const date = new Date(startDate.value);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);
    arr.push(date);
  }
  return arr;
});

const isTodayVisible = computed(() => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const viewStart = new Date(startDate.value);
  viewStart.setHours(0, 0, 0, 0);
  const viewStartVal = viewStart.getTime();
  const viewEndVal = viewStartVal + ((days.value - 1) * 24 * 60 * 60 * 1000);
  return today >= viewStartVal && today <= viewEndVal;
});

const todayLineStyle = computed(() => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const diffDaysIndex = dates.value.findIndex(d => d.toISOString().split('T')[0] === todayStr);
  if (diffDaysIndex !== -1) {
    return {
      position: 'absolute',
      left: `${(diffDaysIndex * cellWidth) + 220}px`,
      top: 0,
      bottom: 0,
      width: '2px',
      backgroundColor: '#ef4444',
      zIndex: 50,
      display: 'block'
    };
  }
  return { display: 'none' };
});

const sectorOptions = computed(() => {
  return [...new Set(places.value.map(p => p.sector).filter(Boolean))].sort();
});

const rowOptions = computed(() => {
  const rows = [...new Set(places.value.map(p => p.row).filter(r => r !== null && r !== undefined))];
  return rows.sort((a, b) => a - b);
});

const filteredPlaces = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return places.value.filter((p) => {
    if (selectedSector.value !== 'all' && String(p.sector) !== String(selectedSector.value)) return false;
    if (selectedRow.value !== 'all' && String(p.row) !== String(selectedRow.value)) return false;
    if (!query) return true;
    const haystack = `${p.name} ${p.sector} ${p.row} ${p.column}`.toLowerCase();
    return haystack.includes(query);
  });
});

const sortedPlaces = computed(() => {
  return [...filteredPlaces.value].sort((a, b) => {
    const sectorCompare = String(a.sector).localeCompare(String(b.sector));
    if (sectorCompare !== 0) return sectorCompare;
    if (a.row !== b.row) return a.row - b.row;
    return a.column - b.column;
  });
});

const getPlaceBookings = (placeId) => {
  return bookings.value.filter(b => String(b.placeId) === String(placeId));
};

const selectedBookingObj = computed(() => {
  return bookings.value.find(b => b.id === selectedBooking.value) || null;
});

const getDateRange = () => {
  const start = startDate.value;
  const end = new Date(start);
  end.setDate(end.getDate() + days.value - 1);
  return `${formatDate(start)} - ${formatDate(end)}`;
};

const formatDate = (date) => {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
};

const getDayName = (date) => {
  return date.toLocaleDateString('it-IT', { weekday: 'short' });
};

const diffDays = (start, end) => {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((e - s) / (1000 * 60 * 60 * 24));
};

const getVisibleMetrics = (booking) => {
  const viewStart = new Date(startDate.value);
  viewStart.setHours(0, 0, 0, 0);
  const viewEndExclusive = new Date(viewStart);
  viewEndExclusive.setDate(viewEndExclusive.getDate() + days.value);

  const bookingStart = new Date(booking.startDate);
  bookingStart.setHours(0, 0, 0, 0);
  const bookingEndExclusive = new Date(bookingStart);
  bookingEndExclusive.setDate(bookingEndExclusive.getDate() + booking.duration);

  const visibleStart = bookingStart < viewStart ? viewStart : bookingStart;
  const visibleEnd = bookingEndExclusive > viewEndExclusive ? viewEndExclusive : bookingEndExclusive;

  const visibleDuration = diffDays(visibleStart, visibleEnd);
  const offset = diffDays(viewStart, visibleStart);

  return { visibleDuration, offset };
};

const getBookingStyle = (booking) => {
  const { visibleDuration, offset } = getVisibleMetrics(booking);
  if (visibleDuration <= 0) return { display: 'none' };
  return {
    left: `${offset * cellWidth}px`,
    width: `${visibleDuration * cellWidth}px`,
    height: `${cellHeight - 6}px`,
    backgroundColor: booking.color,
    borderColor: booking.color
  };
};

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const calculateDayPrice = (placeId, dateStr) => {
  const day = timetable.value.find(d => d.date === dateStr);
  if (!day || !day.pricelist) return 0;
  const list = pricelists.value.find(p => String(p.id) === String(day.pricelist));
  if (!list) return 0;
  const item = list.prices?.find(p => String(p.id) === String(placeId));
  return Number(item?.price_per_place || 0);
};

const bookingQuote = computed(() => {
  const { checkin, checkout, placeId } = newBookingData.value;
  if (!checkin || !checkout || !placeId) return null;
  const start = new Date(checkin);
  const end = new Date(checkout);
  if (start >= end) return null;

  let totalCalculated = 0;
  const daysList = [];
  let current = new Date(start);
  while (current < end) {
    const dateStr = toISODate(current);
    const dayTotal = calculateDayPrice(placeId, dateStr);
    daysList.push({ date: dateStr, dayTotal });
    totalCalculated += dayTotal;
    current.setDate(current.getDate() + 1);
  }

  const finalTotal = newBookingData.value.isManualPrice
    ? Number(newBookingData.value.manualPrice || 0)
    : totalCalculated;

  return { totalCalculated, finalTotal, days: daysList };
});

const openNewBooking = (place) => {
  editingBooking.value = null;
  const todayStr = new Date().toISOString().split('T')[0];
  newBookingData.value = {
    placeId: place?.id ? String(place.id) : '',
    guestName: '',
    guestSurname: '',
    checkin: selectedDate.value || todayStr,
    checkout: addDaysISO(selectedDate.value || todayStr, 1),
    isManualPrice: false,
    manualPrice: 0
  };
  showModal.value = true;
};

const openEditBooking = (booking) => {
  console.log('openEditBooking beach', booking);
  selectedBooking.value = booking.id;
  editingBooking.value = booking;
  newBookingData.value = {
    placeId: String(booking.placeId),
    guestName: booking.guestFirst || '',
    guestSurname: booking.guestLast || '',
    checkin: toISODate(booking.startDate),
    checkout: addDaysISO(toISODate(booking.startDate), booking.duration),
    isManualPrice: false,
    manualPrice: 0
  };
  showModal.value = true;
};

const addDaysISO = (dateStr, daysToAdd) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  return toISODate(d);
};

const addDaysDate = (date, daysToAdd) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysToAdd);
  return d;
};

const getBookingEndISO = (booking) => {
  const start = toISODate(booking.startDate);
  return addDaysISO(start, booking.duration);
};

const wouldConflict = (bookingId, placeId, checkin, checkout) => {
  return bookings.value.some(b => {
    if (bookingId && b.id === bookingId) return false;
    if (String(b.placeId) !== String(placeId)) return false;
    const start = toISODate(b.startDate);
    const end = addDaysISO(start, b.duration);
    return start < checkout && end > checkin;
  });
};

const hasConflict = (placeId, checkin, checkout) => {
  return wouldConflict(null, placeId, checkin, checkout);
};

const handleRowMouseMove = (event, place) => {
  hoveredPlaceId.value = place.id;
};

const handleMouseDown = (event, booking, type) => {
  // double-click guard for map planner as well
  if (event.detail > 1 && type === 'move') {
    event.preventDefault();
    openEditBooking(booking);
    return;
  }
  event.preventDefault();
  selectedBooking.value = booking.id;
  tempBooking.value = {
    id: booking.id,
    placeId: booking.placeId,
    startDate: new Date(booking.startDate),
    duration: booking.duration
  };
  dragging.value = {
    bookingId: booking.id,
    type,
    startX: event.clientX,
    originalStartDate: new Date(booking.startDate),
    originalDuration: booking.duration,
    originalPlaceId: booking.placeId
  };
};

const handleMouseMove = (event) => {
  if (!dragging.value) return;
  const booking = bookings.value.find(b => b.id === dragging.value.bookingId);
  if (!booking) return;

  const deltaX = event.clientX - dragging.value.startX;
  const daysDelta = Math.round(deltaX / cellWidth);

  if (dragging.value.type === 'move') {
    const newStart = addDaysDate(dragging.value.originalStartDate, daysDelta);
    const newPlaceId = hoveredPlaceId.value ?? dragging.value.originalPlaceId;
    booking.startDate = newStart;
    booking.placeId = String(newPlaceId);
  } else if (dragging.value.type === 'resize-left') {
    let newDuration = dragging.value.originalDuration - daysDelta;
    if (newDuration < 1) newDuration = 1;
    const maxShift = dragging.value.originalDuration - newDuration;
    const newStart = addDaysDate(dragging.value.originalStartDate, daysDelta > maxShift ? maxShift : daysDelta);
    booking.startDate = newStart;
    booking.duration = newDuration;
  } else if (dragging.value.type === 'resize-right') {
    let newDuration = dragging.value.originalDuration + daysDelta;
    if (newDuration < 1) newDuration = 1;
    booking.duration = newDuration;
  }
};

const updateReservation = async (booking) => {
  const checkin = toISODate(booking.startDate);
  const checkout = addDaysISO(checkin, booking.duration);
  const payload = {
    id: booking.id,
    placeId: Number(booking.placeId),
    checkin,
    checkout
  };
  await axios.post('http://localhost:8081/api/pms/beach/updatereservation', payload);
};

const handleMouseUp = async () => {
  if (!dragging.value) return;
  const booking = bookings.value.find(b => b.id === dragging.value.bookingId);
  if (!booking) {
    dragging.value = null;
    tempBooking.value = null;
    return;
  }

  const checkin = toISODate(booking.startDate);
  const checkout = addDaysISO(checkin, booking.duration);
  const conflict = wouldConflict(booking.id, booking.placeId, checkin, checkout);

  if (conflict && tempBooking.value) {
    booking.startDate = new Date(tempBooking.value.startDate);
    booking.duration = tempBooking.value.duration;
    booking.placeId = tempBooking.value.placeId;
  } else {
    try {
      await updateReservation(booking);
    } catch (err) {
      console.error('Errore aggiornamento prenotazione:', err);
      if (tempBooking.value) {
        booking.startDate = new Date(tempBooking.value.startDate);
        booking.duration = tempBooking.value.duration;
        booking.placeId = tempBooking.value.placeId;
      }
    }
  }

  dragging.value = null;
  tempBooking.value = null;
};

const submitNewBooking = async () => {
  // handle both creation and editing
  const { placeId, guestName, guestSurname, checkin, checkout } = newBookingData.value;
  if (!placeId || !guestName || !guestSurname || !checkin || !checkout) {
    alert('Compila tutti i campi obbligatori.');
    return;
  }

  const conflict = hasConflict(editingBooking.value ? editingBooking.value.id : null, placeId, checkin, checkout);
  if (conflict) {
    alert('Conflitto: posto già occupato nel periodo selezionato.');
    return;
  }

  if (editingBooking.value) {
    // update existing booking
    const b = editingBooking.value;
    b.placeId = String(placeId);
    b.guestFirst = guestName;
    b.guestLast = guestSurname;
    b.guest = `${guestName} ${guestSurname}`.trim();
    b.startDate = new Date(checkin);
    b.duration = diffDays(new Date(checkin), new Date(checkout));

    try {
      await updateReservation(b);
      showModal.value = false;
      editingBooking.value = null;
      await fetchBookings();
    } catch (err) {
      console.error('Errore aggiornamento prenotazione:', err);
    }
  } else {
    // create new
    const payload = {
      placeId: Number(placeId),
      checkin,
      checkout,
      datetime: toISODate(new Date()),
      origin: 1,
      status: 0,
      price_per_place: bookingQuote.value?.finalTotal || 0,
      price_per_day: bookingQuote.value?.days.map(d => d.dayTotal) || [],
      accountholder: {
        firstname: guestName,
        lastname: guestSurname
      }
    };

    try {
      await axios.post('http://localhost:8081/api/pms/beach/new_reservation', payload);
      showModal.value = false;
      await fetchBookings();
    } catch (err) {
      console.error('Errore creazione prenotazione:', err);
      alert('Errore durante il salvataggio della prenotazione');
    }
  }
};

const saveGuest = async () => {
  if (!selectedBookingObj.value) return;
  const payload = {
    id: selectedBookingObj.value.id,
    accountholder: {
      firstname: editGuest.value.first,
      lastname: editGuest.value.last
    }
  };
  try {
    await axios.post('http://localhost:8081/api/pms/beach/updatereservation', payload);
    selectedBookingObj.value.guestFirst = editGuest.value.first;
    selectedBookingObj.value.guestLast = editGuest.value.last;
    selectedBookingObj.value.guest = `${editGuest.value.first} ${editGuest.value.last}`.trim() || 'Senza Nome';
  } catch (err) {
    console.error('Errore aggiornamento cliente:', err);
  }
};

const deleteBooking = async () => {
  if (!selectedBookingObj.value) return;
  if (!confirm('Vuoi eliminare questa prenotazione?')) return;
  try {
    await axios.post('http://localhost:8081/api/pms/beach/deletereservation', { id: selectedBookingObj.value.id });
    bookings.value = bookings.value.filter(b => b.id !== selectedBookingObj.value.id);
    selectedBooking.value = null;
  } catch (err) {
    console.error('Errore eliminazione prenotazione:', err);
  }
};

const fetchPlaces = async () => {
  const res = await axios.get('http://localhost:8081/api/pms/beach/getplan?mode=flat');
  places.value = res.data.map(normalizeResource);
};

const fetchBookings = async () => {
  const from = toISODate(startDate.value);
  const toDate = new Date(startDate.value);
  toDate.setDate(toDate.getDate() + days.value - 1);
  const to = toISODate(toDate);
  const res = await axios.get(`http://localhost:8081/api/pms/beach/getbookingsbyrange?from=${from}&to=${to}`);
  bookings.value = (res.data.bookings || []).map(normalizeBooking);
};

const loadPricingData = async () => {
  const [resRates, resTime] = await Promise.all([
    axios.get('http://localhost:8081/api/pms/getrates?type=beach'),
    axios.get('http://localhost:8081/api/pms/gettimetable?type=beach')
  ]);
  pricelists.value = resRates.data || [];
  timetable.value = resTime.data || [];
};

const previousPeriod = () => {
  const newDate = new Date(startDate.value);
  newDate.setDate(newDate.getDate() - daysToShift);
  newDate.setHours(0, 0, 0, 0);
  startDate.value = newDate;
  fetchBookings();
};

const nextPeriod = () => {
  const newDate = new Date(startDate.value);
  newDate.setDate(newDate.getDate() + daysToShift);
  newDate.setHours(0, 0, 0, 0);
  startDate.value = newDate;
  fetchBookings();
};

const onMapSelect = (place) => {
  openNewBooking(place);
};

const onMapEdit = (reservation) => {
  // reservation is raw API object; normalize then open modal
  const normalized = normalizeBooking(reservation);
  openEditBooking(normalized);
};

const reloadAll = async () => {
  isLoading.value = true;
  loadError.value = '';
  const results = await Promise.allSettled([fetchPlaces(), fetchBookings(), loadPricingData()]);
  const failed = results.find(r => r.status === 'rejected');
  if (failed) {
    loadError.value = 'Errore caricamento dati. Verifica che il backend PMS sia attivo su 8081.';
  }
  isLoading.value = false;
};

const generateDemoPlan = async () => {
  if (!confirm('Generare un piano demo con settori e ombrelloni?')) return;
  const sectors = [
    { id: 1, name: 'Area Centrale', prefix: 'A', rows: 5, cols: 10, startPrice: 50 },
    { id: 2, name: 'Area Laterale', prefix: 'B', rows: 5, cols: 8, startPrice: 40 }
  ];
  const resources = [];
  let id = 1;
  sectors.forEach((sector) => {
    for (let r = 1; r <= sector.rows; r++) {
      for (let c = 1; c <= sector.cols; c++) {
        const code = `${sector.prefix}${r}-${c}`;
        resources.push({
          id: id++,
          name: code,
          row: r,
          column: c,
          sector: sector.name,
          type: `FILA_${r}`,
          basePrice: sector.startPrice
        });
      }
    }
  });
  try {
    await axios.post('http://localhost:8081/api/pms/beach/setup', { sectors, resources });
    await reloadAll();
  } catch (err) {
    console.error('Errore generazione piano demo:', err);
    loadError.value = 'Errore generazione piano demo.';
  }
};

const createQuote = () => {
  showQuoteBuilder.value = true;
};

onMounted(async () => {
  await reloadAll();
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
});

watch(() => newBookingData.value.checkin, (newIn) => {
  if (!newIn) return;
  const dateIn = new Date(newIn);
  const dateOut = new Date(newBookingData.value.checkout);
  if (!newBookingData.value.checkout || dateOut <= dateIn) {
    newBookingData.value.checkout = addDaysISO(newIn, 1);
  }
});

watch(selectedBooking, (id) => {
  const booking = bookings.value.find(b => b.id === id);
  editGuest.value = {
    first: booking?.guestFirst || '',
    last: booking?.guestLast || ''
  };
});
</script>

<template>
  <div class="planner-container">
    <div class="header">
      <div>
        <h1 class="title">Planning Ombrelloni</h1>
        <p class="subtitle">Gestione prenotazioni stabilimento</p>
      </div>
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
        <button @click="openNewBooking(null)" class="btn btn-primary">
          + Nuova Prenotazione
        </button>
        <button @click="createQuote" class="btn btn-secondary">
          📋 Preventivo
        </button>
      </div>
    </div>

    <div class="map-panel">
      <div class="map-toolbar">
        <div class="toolbar-left">
          <label>Data mappa</label>
          <input type="date" v-model="selectedDate" />
        </div>
        <button class="btn btn-secondary" @click="showMap = !showMap">
          {{ showMap ? 'Nascondi Mappa' : 'Mostra Mappa' }}
        </button>
      </div>
      <div v-if="showMap" class="map-wrapper">
        <BeachMap :selectedDate="selectedDate" @select="onMapSelect" @edit="onMapEdit" />
      </div>
    </div>

    <div v-if="isLoading" class="loading-banner">Caricamento dati in corso...</div>
    <div v-else-if="loadError" class="error-banner">
      {{ loadError }}
      <button class="btn btn-secondary" @click="reloadAll">Riprova</button>
    </div>

    <div class="content">
      <div class="filters-bar">
        <div class="filter-group">
          <label>Settore</label>
          <select v-model="selectedSector">
            <option value="all">Tutti</option>
            <option v-for="sector in sectorOptions" :key="sector" :value="sector">
              {{ sector }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Fila</label>
          <select v-model="selectedRow">
            <option value="all">Tutte</option>
            <option v-for="row in rowOptions" :key="row" :value="row">
              {{ row }}
            </option>
          </select>
        </div>
        <div class="filter-group search-group">
          <label>Ricerca</label>
          <input v-model="searchQuery" placeholder="A1, VIP, Fila 1" />
        </div>
        <div class="filter-count">Mostrati {{ sortedPlaces.length }} / {{ places.length }}</div>
      </div>

      <div class="grid-wrapper">
        <div v-if="!isLoading && !loadError && sortedPlaces.length === 0" class="empty-state">
          Nessun posto trovato. Verifica che il piano spiaggia sia stato generato.
          <button class="btn btn-secondary" @click="generateDemoPlan">Genera piano demo</button>
        </div>
        <div class="grid-header">
          <div class="header-row">
            <div class="room-label">Posto</div>
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
          <div v-if="isTodayVisible" :style="todayLineStyle" class="today-line"></div>

          <div v-for="place in sortedPlaces" :key="place.id" class="room-row">
            <div class="room-cell">
              <div class="place-name">{{ place.name }}</div>
              <div class="place-meta">Fila {{ place.row }} · {{ place.sector }}</div>
            </div>

            <div
              class="days-container"
              :style="{ height: cellHeight + 'px' }"
              @mousemove="handleRowMouseMove($event, place)"
              @mouseleave="hoveredPlaceId = null"
              @click="openNewBooking(place)"
            >
              <div
                v-for="(date, idx) in dates"
                :key="idx"
                class="day-slot"
                :style="{ width: cellWidth + 'px' }"
              />
              
              <div
                v-for="booking in getPlaceBookings(place.id)"
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

    <div v-if="selectedBookingObj && !showModal" class="footer">
      <div class="footer-content">
        <div class="input-group">
          <label class="input-label">Nome</label>
          <input type="text" v-model="editGuest.first" class="input-field" />
        </div>
        <div class="input-group">
          <label class="input-label">Cognome</label>
          <input type="text" v-model="editGuest.last" class="input-field" />
        </div>
        <button class="btn btn-secondary" @click="saveGuest">Salva Cliente</button>
        <button class="btn btn-danger" @click="deleteBooking">Elimina</button>
      </div>
    </div>

    <transition name="fade">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ editingBooking ? 'Modifica Prenotazione' : 'Nuova Prenotazione Spiaggia' }}</h3>
            <button @click="showModal = false" class="close-btn">&times;</button>
          </div>
          
          <form @submit.prevent="submitNewBooking" class="booking-form">
            <div class="form-section">
              <label>Posto</label>
              <select v-model="newBookingData.placeId" required>
                <option value="" disabled>Seleziona posto</option>
                <option v-for="p in sortedPlaces" :key="p.id" :value="p.id">
                  {{ p.name }} (Fila {{ p.row }}, {{ p.sector }})
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
                <label>Check-in</label>
                <input type="date" v-model="newBookingData.checkin" required />
              </div>
              <div class="form-section">
                <label>Check-out</label>
                <input type="date" v-model="newBookingData.checkout" required />
              </div>
            </div>

            <div class="form-row price-management-row">
              <div class="form-section">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="newBookingData.isManualPrice">
                  <span>Prezzo Manuale</span>
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

    <!-- Quote Builder Modal -->
    <QuoteBuilder 
      v-if="showQuoteBuilder"
      type="beach"
      @close="showQuoteBuilder = false"
      @created="() => { showQuoteBuilder = false; router.push('/quotes'); }"
    />
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

.planner-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f9fafb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: #64748b;
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
  background: #0ea5e9;
  border-color: #0ea5e9;
  color: white;
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
  background: #0ea5e9;
  color: white;
}

.btn-primary:hover {
  background: #0284c7;
}

.btn-secondary {
  background: #e2e8f0;
  color: #0f172a;
}

.btn-secondary:hover {
  background: #cbd5f5;
}

.map-panel {
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.map-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
  color: #475569;
}

.toolbar-left input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-weight: 600;
}

.map-wrapper { padding: 12px 20px 24px; }

.content { flex: 1; overflow: auto; }

.loading-banner,
.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.loading-banner {
  background: #eff6ff;
  color: #1d4ed8;
  border-bottom: 1px solid #bfdbfe;
}

.error-banner {
  background: #fef2f2;
  color: #b91c1c;
  border-bottom: 1px solid #fecaca;
}

.empty-state {
  padding: 16px 20px;
  font-size: 0.9rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 12px;
}

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.8rem;
  color: #475569;
}

.filter-group select,
.filter-group input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  min-width: 160px;
  font-weight: 600;
}

.search-group input { min-width: 220px; }

.filter-count {
  margin-left: auto;
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

.grid-wrapper { display: inline-block; min-width: 100%; }

.grid-header {
  position: sticky;
  top: 0;
  background: white;
  z-index: 20;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-row { display: flex; border-bottom: 1px solid #e5e7eb; }

.room-label {
  width: 220px;
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

.date-day { font-size: 0.75rem; font-weight: 600; color: #6b7280; }
.date-num { font-size: 0.875rem; font-weight: 500; }

.grid-body { position: relative; }

.room-row {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.room-cell {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  background: white;
  font-weight: 500;
  padding: 0 0.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 36px;
  position: sticky;
  left: 0;
  z-index: 10;
}

.place-name { font-size: 0.9rem; font-weight: 700; color: #0f172a; }
.place-meta { font-size: 0.7rem; color: #64748b; }

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
  border-radius: 0.3rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid;
  transition: all 0.1s;
  top: 3px !important;
  bottom: 3px !important;
  cursor: pointer;
}

.booking-selected { box-shadow: 0 0 0 3px #0ea5e9; }

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

.resize-left { left: 0; border-radius: 0.5rem 0 0 0.5rem; }
.resize-right { right: 0; border-radius: 0 0.5rem 0.5rem 0; }

.booking-content {
  padding: 2px 8px;
  color: white;
  font-weight: 600;
  font-size: 0.75rem;
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

.today-line {
  position: absolute;
  width: 2px;
  background-color: #ef4444;
  pointer-events: none;
}

.footer {
  background: white;
  border-top: 1px solid #e5e7eb;
  padding: 1rem 1.5rem;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.08);
}

.footer-content {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.input-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
}

.input-field {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
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
  max-width: 580px;
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

.form-row { display: flex; gap: 15px; margin-bottom: 15px; }
.form-section { flex: 1; display: flex; flex-direction: column; margin-bottom: 15px; }
.form-section label { font-size: 12px; font-weight: 700; color: #4b5563; margin-bottom: 5px; text-transform: uppercase; }
.form-section input, .form-section select { padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }

.modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.btn-save { background: #0ea5e9; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-cancel { background: #f3f4f6; color: #374151; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }

.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; margin-top: 10px; }

.quote-box {
  margin-top: 20px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.quote-box.manual-active { border-left: 5px solid #ef4444; background: #fff5f5; }
.quote-details { max-height: 150px; overflow-y: auto; padding: 12px; background: white; margin: 10px; border-radius: 6px; border: 1px solid #edf2f7; }
.quote-line { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; color: #475569; }
.quote-line:last-child { border-bottom: none; }
.quote-summary-footer { padding: 15px; background: #f1f5f9; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: flex-end; }
.quote-box.manual-active .quote-summary-footer { background: #fee2e2; }
.price-strikethrough { text-decoration: line-through; color: #94a3b8; font-size: 0.8rem; margin-bottom: 2px; }
.final-price-display { font-size: 1.4rem; font-weight: 800; color: #0f172a; }
.quote-box.manual-active .final-price-display { color: #b91c1c; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .header { flex-direction: column; align-items: stretch; }
  .header-controls { flex-direction: column; }
  .date-navigation { justify-content: center; }
  .map-toolbar { flex-direction: column; align-items: flex-start; }
  .filter-count { width: 100%; margin-left: 0; }
}
</style>
