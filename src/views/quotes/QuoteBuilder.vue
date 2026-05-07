<template>
  <div class="quote-builder-overlay" @click.self="close">
    <div class="quote-builder-modal">
      <div class="modal-header">
        <h3>Crea Preventivo{{ type === 'beach' ? ' Spiaggia' : ' Hotel' }}</h3>
        <button @click="close" class="close-btn">&times;</button>
      </div>

      <form @submit.prevent="submitQuote" class="quote-form">
        <!-- Nome Preventivo -->
        <div class="form-section">
          <label>Nome Preventivo *</label>
          <input 
            v-model="quoteData.name" 
            type="text" 
            placeholder="es. Preventivo Rossi - Agosto 2026"
            required 
          />
        </div>

        <!-- Dati Cliente -->
        <div class="form-section">
          <label>Cliente *</label>
          <input 
            v-model="quoteData.guestName" 
            type="text" 
            placeholder="Nome"
            required 
          />
        </div>

        <!-- Periodi e Persone -->
        <div class="form-row">
          <div class="form-section">
            <label>Check-in *</label>
            <input 
              v-model="quoteData.checkin" 
              type="date" 
              required 
            />
          </div>
          <div class="form-section">
            <label>Check-out *</label>
            <input 
              v-model="quoteData.checkout" 
              type="date" 
              required 
            />
          </div>
        </div>

        <!-- Persone (Hotel) -->
        <div v-if="type === 'hotel'" class="form-row">
          <div class="form-section">
            <label>Adulti *</label>
            <input 
              v-model.number="quoteData.adults" 
              type="number" 
              min="1"
              required 
            />
          </div>
          <div class="form-section">
            <label>Bambini</label>
            <input 
              v-model.number="quoteData.children" 
              type="number" 
              min="0"
            />
          </div>
        </div>

        <div v-if="type === 'hotel' && normalizedChildrenCount > 0" class="form-section">
          <label>Età bambini</label>
          <div class="kids-ages-grid">
            <div
              v-for="(_, idx) in normalizedChildrenCount"
              :key="`quote-kid-age-${idx}`"
              class="kid-age-item"
            >
              <span>Bambino {{ idx + 1 }}</span>
              <input
                v-model.number="quoteData.kidsAges[idx]"
                type="number"
                min="0"
                max="17"
                placeholder="Età"
              />
            </div>
          </div>
        </div>

        <!-- Trattamento Hotel -->
        <div v-if="type === 'hotel'" class="form-section">
          <label>Trattamento *</label>
          <div class="board-radio-group">
            <label v-for="mode in ['bb', 'hb', 'fb']" :key="mode" 
                  class="board-radio-card" :class="{ 'is-selected': quoteData.board === mode }">
              <input type="radio" v-model="quoteData.board" :value="mode" class="hidden-radio">
              <span class="board-name">{{ mode.toUpperCase() }}</span>
            </label>
          </div>
        </div>

        <!-- Selezione Tipo di Camera/Fila calcolati (Hotel/Beach) -->
        <div v-if="daysCount > 0 && calculatedRoomPrices.length > 0" class="form-section rooms-section">
          <label>Seleziona {{ type === 'hotel' ? 'Camera' : 'Fila' }}</label>
          <p class="section-hint">Prezzi calcolati per {{ daysCount }} {{ type === 'beach' ? (daysCount !== 1 ? 'giorni' : 'giorno') : (daysCount !== 1 ? 'notti' : 'notte') }}</p>
          <div class="rooms-grid">
            <div 
              v-for="room in calculatedRoomPrices" 
              :key="room.roomType"
              @click="selectRoom(room.roomType)"
              :class="['room-card', { 'is-selected': quoteData.roomType === room.roomType }]"
            >
              <div class="room-type">{{ room.roomType }}</div>
              <div class="room-price">€{{ room.totalPrice.toFixed(2) }}</div>
              <div class="room-per-night">€{{ room.pricePerNight.toFixed(2) }} / {{ type === 'hotel' ? 'notte' : 'giorno' }}</div>
            </div>
          </div>
        </div>

        <!-- Messaggio Informativo -->
        <div class="info-box">
          <p>
            <strong>Periodo:</strong> {{ daysCount }} {{ type === 'beach' ? 'giorn' : 'nott' }}{{ daysCount !== 1 ? 'i' : (type === 'beach' ? 'o' : 'e') }}
          </p>
          <p v-if="type === 'hotel'">
            <strong>Ospiti:</strong> {{ quoteData.adults }} adult{{ quoteData.adults !== 1 ? 'i' : 'o' }}
            <span v-if="quoteData.children > 0">, {{ quoteData.children }} bambin{{ quoteData.children !== 1 ? 'i' : 'o' }}</span>
          </p>
          <div v-if="quoteData.roomType" class="price-section">
            <p>
              <strong>{{ type === 'hotel' ? 'Camera Selezionata' : 'Fila Selezionata' }}:</strong> {{ quoteData.roomType }}
            </p>
            <p class="price-highlight">
              <strong>TOTALE PREVENTIVO:</strong> €{{ priceQuote.finalTotal.toFixed(2) }}
            </p>
          </div>
          <div v-else-if="calculatedRoomPrices.length > 0" class="price-section">
            <p>
              <strong>Prezzi disponibili:</strong>
            </p>
            <p class="price-highlight">
              <strong>Prezzo a partire da:</strong> €{{ minOption?.totalPrice.toFixed(2) || '0.00' }}
            </p>
            <p class="section-hint">Clicca una {{ type === 'hotel' ? 'camera' : 'fila' }} per selezionarla</p>
          </div>
          <p v-else class="price-placeholder">
            Inserisci date valide per calcolare i prezzi
          </p>
        </div>

        <!-- Pulsanti -->
        <div class="form-row button-row">
          <button type="button" @click="close" class="btn btn-secondary">
            Annulla
          </button>
          <button type="submit" class="btn btn-primary" :disabled="!isFormValid">
            Crea Preventivo
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuotes } from '@/composables/useQuotes.js'
import { usePricing } from '@/composables/usePricing.js'

const props = defineProps({
  type: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['created', 'close'])

const { saveQuote } = useQuotes()
const { loadPricelists, loadTimetable, loadHotelPricingPolicy, calculateQuotePrice, getRoomTypes } = usePricing()

const quoteData = ref({
  name: '',
  guestName: '',
  checkin: '',
  checkout: '',
  adults: 1,
  children: 0,
  kidsAges: [],
  board: 'bb',
  type: props.type,
  roomType: '' // Tipo di camera per hotel, posto per beach
})

const priceQuote = ref(null)
const roomTypes = ref([])
const calculatedRoomPrices = ref([])
const isLoading = ref(false)

const minOption = computed(() => {
  if (!calculatedRoomPrices.value || calculatedRoomPrices.value.length === 0) return null
  return calculatedRoomPrices.value.reduce((min, r) => (r.totalPrice < min.totalPrice ? r : min), calculatedRoomPrices.value[0])
})

const daysCount = computed(() => {
  if (!quoteData.value.checkin || !quoteData.value.checkout) return 0
  const start = new Date(quoteData.value.checkin)
  const end = new Date(quoteData.value.checkout)
  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
})

const normalizedChildrenCount = computed(() => {
  const count = Number(quoteData.value.children)
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.floor(count)
})

const normalizeKidsAges = (ages, expectedCount) => {
  const src = Array.isArray(ages) ? ages : []
  const count = Math.max(0, Number(expectedCount) || 0)
  const normalized = []
  for (let i = 0; i < count; i++) {
    const n = Number(src[i])
    normalized.push(Number.isFinite(n) && n >= 0 ? Math.floor(n) : null)
  }
  return normalized
}

// Calcola i prezzi per TUTTI i roomType (hotel) o un prezzo generico (beach)
const calculateAllRoomPrices = () => {
  if (!quoteData.value.checkin || !quoteData.value.checkout || daysCount.value === 0) {
    calculatedRoomPrices.value = []
    priceQuote.value = null
    return
  }
  
  if (props.type === 'hotel') {
    // Hotel: calcola per ogni tipo di camera
    const prices = roomTypes.value.map(room => {
      const quote = calculateQuotePrice(
        quoteData.value.checkin,
        quoteData.value.checkout,
        room.roomType,
        props.type,
        quoteData.value.adults + quoteData.value.children,
        {
          board: quoteData.value.board,
          adults: quoteData.value.adults,
          children: quoteData.value.children,
          kidAges: normalizeKidsAges(quoteData.value.kidsAges, quoteData.value.children)
        }
      )
      return {
        roomType: room.roomType,
        totalPrice: quote?.finalTotal || 0,
        pricePerNight: quote?.pricePerNight || 0,
        quote
      }
    })
    calculatedRoomPrices.value = prices
  } else {
    // Beach: calcola per ogni tipo di fila
    const prices = roomTypes.value.map(room => {
      const quote = calculateQuotePrice(
        quoteData.value.checkin,
        quoteData.value.checkout,
        room.placeType, // Usa placeType per beach (es. "FILA 1")
        props.type,
        quoteData.value.adults + quoteData.value.children
      )
      return {
        roomType: room.placeType, // Usa placeType (es. "FILA 1")
        placeTypeId: room.placeTypeId,
        totalPrice: quote?.finalTotal || 0,
        pricePerNight: quote?.pricePerNight || 0,
        quote
      }
    })
    calculatedRoomPrices.value = prices
  }
}

// Quando selezioni una camera, calcola il prezzo specifico
const selectRoom = (roomType) => {
  quoteData.value.roomType = roomType
  const roomPrice = calculatedRoomPrices.value.find(r => r.roomType === roomType)
  if (roomPrice) {
    priceQuote.value = roomPrice.quote
  }
}

watch(
  () => [quoteData.value.checkin, quoteData.value.checkout, quoteData.value.adults, quoteData.value.children],
  () => calculateAllRoomPrices(),
  { deep: true }
)

watch(
  () => quoteData.value.children,
  (children) => {
    quoteData.value.kidsAges = normalizeKidsAges(quoteData.value.kidsAges, children)
  }
)

const isFormValid = computed(() => {
  return quoteData.value.name.trim() &&
         quoteData.value.guestName.trim() &&
         quoteData.value.checkin &&
         quoteData.value.checkout &&
         daysCount.value > 0 &&
         (props.type !== 'hotel' || quoteData.value.board) &&
         (props.type !== 'hotel' || calculatedRoomPrices.value.length > 0)
})

const submitQuote = async () => {
  try {
    // Calcola la data di scadenza (7 giorni da oggi)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    
    // Per beach, salva almeno un'opzione generica se non calcolato
    const roomOptions = calculatedRoomPrices.value.length > 0 ? calculatedRoomPrices.value : []
    
    // Determina il prezzo da salvare nel preventivo
    let basePriceData = null
    let baseTotalPrice = null
    let basePricePerNight = null
    let baseDailyPrices = null
    
    if (props.type === 'beach' && roomOptions.length > 0) {
      // Beach: salva il prezzo minimo disponibile (non semplicemente il primo)
      const minOpt = roomOptions.reduce((min, room) => (room.totalPrice < min.totalPrice ? room : min), roomOptions[0])
      basePriceData = minOpt.quote
      baseTotalPrice = minOpt.totalPrice
      basePricePerNight = minOpt.pricePerNight
      baseDailyPrices = minOpt.quote?.days
    } else if (props.type === 'hotel' && roomOptions.length > 0) {
      // Hotel: salva il prezzo minimo delle camere come riferimento
      const minOption = roomOptions.reduce((min, room) => 
        room.totalPrice < min.totalPrice ? room : min
      )
      basePriceData = minOption.quote
      baseTotalPrice = minOption.totalPrice
      basePricePerNight = minOption.pricePerNight
      baseDailyPrices = minOption.quote?.days
    }
    
    if (props.type === 'beach') {
      const selectedOption = roomOptions.find((r) => r.roomType === quoteData.value.roomType) || minOption.value
      const placeTypeId = selectedOption?.placeTypeId
      if (!placeTypeId) {
        throw new Error('Seleziona una fila valida per il preventivo beach.')
      }

      await saveQuote({
        type: 'beach',
        checkin: quoteData.value.checkin,
        checkout: quoteData.value.checkout,
        place_type_id: placeTypeId,
        customer: quoteData.value.guestName,
        name: quoteData.value.name,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      })
    } else {
      await saveQuote({
        ...quoteData.value,
        kidsAges: normalizeKidsAges(quoteData.value.kidsAges, quoteData.value.children),
        childrenAges: normalizeKidsAges(quoteData.value.kidsAges, quoteData.value.children),
        // Mantieni la camera/fila selezionata (se presente)
        duration: daysCount.value,
        allRoomOptions: roomOptions, // Salva le opzioni calcolate
        priceData: basePriceData, // Prezzo base per visibilità
        totalPrice: baseTotalPrice, // Prezzo base per visibilità
        pricePerNight: basePricePerNight, // Prezzo base per visibilità
        dailyPrices: baseDailyPrices, // Prezzo base per visibilità
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      })
    }
    emit('created')
    close()
  } catch (err) {
    // Log dettagliato per debug runtime: mostriamo errore e payload
    try {
      const payload = {
        ...quoteData.value,
        duration: daysCount.value,
        allRoomOptions: roomOptions,
        priceData: basePriceData,
        totalPrice: baseTotalPrice,
        pricePerNight: basePricePerNight,
        dailyPrices: baseDailyPrices,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }
      console.error('submitQuote error', err)
      console.log('submitQuote payload', payload)
    } catch (logErr) {
      console.error('Error while logging submitQuote payload', logErr)
    }
    alert('Errore nella creazione del preventivo: ' + (err && err.message ? err.message : String(err)))
  }
}

const close = () => {
  emit('close')
}

onMounted(async () => {
  isLoading.value = true
  try {
    if (props.type === 'hotel') {
      await loadHotelPricingPolicy()
    }
    await loadPricelists(props.type)
    await loadTimetable(props.type)
    
    // Carica i tipi disponibili (hotel: roomType, beach: place types)
    roomTypes.value = getRoomTypes(props.type)
    // Avvia il calcolo dei prezzi non appena i dati sono pronti
    calculateAllRoomPrices()
  } catch (err) {
    console.error('Errore caricamento dati:', err)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.quote-builder-overlay {
  position: fixed;
  inset: 0;
  background: rgba(36, 49, 66, 0.24);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 18px;
}

.quote-builder-modal {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 30px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-soft);
  width: min(96vw, 1100px);
  max-width: 1100px;
  max-height: 90vh;
  overflow-y: auto;
  backdrop-filter: blur(24px);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 1.5rem 1.6rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(248, 251, 255, 0.72));
  color: var(--ds-text);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.close-btn {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: var(--ds-text-soft);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  transition: background 0.16s ease, transform 0.16s ease;
}

.close-btn:hover {
  background: rgba(248, 250, 252, 0.92);
  transform: translateY(-1px);
}

.quote-form {
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1rem;
}

.quote-form > .form-section,
.quote-form > .form-row {
  grid-column: 1 / span 8;
}

.quote-form > .rooms-section {
  grid-column: 1 / span 8;
}

.quote-form > .info-box {
  grid-column: 9 / -1;
  grid-row: 1 / span 8;
  position: sticky;
  top: 1rem;
  align-self: start;
  max-height: calc(90vh - 4rem);
  overflow-y: auto;
}

.quote-form > .button-row {
  grid-column: 1 / -1;
}

.form-section label {
  font-weight: 800;
  color: var(--ds-text-soft);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  display: block;
}

.form-section input,
.form-section select {
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  font-size: 1rem;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ds-text);
  width: 100%;
  box-sizing: border-box;
}

.form-section input:focus,
.form-section select:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.45);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.board-radio-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.board-radio-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
  font-weight: 700;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.82);
  color: var(--ds-text-soft);
}

.board-radio-card.is-selected {
  border-color: rgba(29, 140, 242, 0.24);
  background: rgba(231, 242, 255, 0.92);
  color: var(--ds-primary-strong);
  box-shadow: 0 12px 22px rgba(29, 140, 242, 0.12);
}

.hidden-radio {
  display: none;
}

.kids-ages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
}

.kid-age-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.kid-age-item span {
  font-size: 0.82rem;
  color: var(--ds-text-soft);
}

.info-box {
  background: rgba(248, 250, 252, 0.84);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-left: 4px solid var(--ds-primary);
  padding: 1.1rem;
  border-radius: 24px;
  font-size: 0.9rem;
  color: var(--ds-text);
  box-shadow: var(--ds-shadow-card);
}

.info-box p {
  margin: 0.5rem 0;
}

.button-row {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.85rem 1.4rem;
  border: 1px solid transparent;
  border-radius: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
  font-size: 0.95rem;
}

.btn-primary {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: white;
  box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 22px 34px rgba(29, 140, 242, 0.22);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.9);
  color: var(--ds-text);
  border-color: rgba(148, 163, 184, 0.18);
}

.btn-secondary:hover {
  background: rgba(248, 250, 252, 0.92);
}

.price-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(29, 140, 242, 0.18);
}

.price-section p {
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.price-highlight {
  font-size: 1.2rem;
  color: #047857;
  font-weight: 900;
  background: rgba(236, 253, 245, 0.92);
  border: 1px solid rgba(34, 197, 94, 0.16);
  padding: 0.75rem;
  border-radius: 16px;
  margin-top: 0.75rem !important;
}

.price-placeholder {
  color: var(--ds-text-muted);
  font-style: italic;
  margin: 0 !important;
}

/* Room Selection Cards */
.rooms-section {
  margin-top: 1rem;
}

.section-hint {
  font-size: 0.85rem;
  color: var(--ds-text-soft);
  margin-top: -0.3rem;
  font-style: italic;
}

.rooms-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(150px, 170px);
  gap: 0.75rem;
  margin-top: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scroll-snap-type: x proximity;
}

.room-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.86);
  text-align: center;
  min-height: 140px;
  scroll-snap-align: start;
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.06);
}

.room-card:hover {
  border-color: rgba(29, 140, 242, 0.24);
  background: rgba(248, 251, 255, 0.92);
  transform: translateY(-1px);
  box-shadow: 0 18px 30px rgba(29, 140, 242, 0.12);
}

.room-card.is-selected {
  border-color: rgba(29, 140, 242, 0.26);
  background: rgba(231, 242, 255, 0.92);
  box-shadow: 0 20px 32px rgba(29, 140, 242, 0.16);
}

.room-type {
  font-weight: 700;
  color: var(--ds-text);
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.room-price {
  font-size: 1.3rem;
  font-weight: 900;
  color: #047857;
  margin-bottom: 0.25rem;
}

.room-per-night {
  font-size: 0.75rem;
  color: var(--ds-text-soft);
  font-weight: 500;
}

@media (max-width: 960px) {
  .quote-builder-modal {
    width: 92%;
    max-width: 620px;
  }

  .quote-form {
    display: flex;
    flex-direction: column;
  }

  .rooms-grid {
    grid-auto-columns: minmax(140px, 1fr);
  }

  .quote-form > .info-box {
    position: static;
    max-height: none;
    overflow-y: visible;
  }
}

@media (max-width: 640px) {
  .quote-builder-overlay {
    padding: 10px;
  }

  .modal-header,
  .button-row,
  .form-row {
    flex-direction: column;
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .board-radio-group {
    grid-template-columns: 1fr;
  }
}
</style>
