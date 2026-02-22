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

        <!-- Selezione Tipo di Camera Calcolato (Hotel) -->
        <div v-if="type === 'hotel' && daysCount > 0" class="form-section rooms-section">
          <label>Seleziona Camera</label>
          <p class="section-hint">Prezzi calcolati per {{ daysCount }} nott{{ daysCount !== 1 ? 'i' : 'e' }}</p>
          <div class="rooms-grid">
            <div 
              v-for="room in calculatedRoomPrices" 
              :key="room.roomType"
              @click="selectRoom(room.roomType)"
              :class="['room-card', { 'is-selected': quoteData.roomType === room.roomType }]"
            >
              <div class="room-type">{{ room.roomType }}</div>
              <div class="room-price">€{{ room.totalPrice.toFixed(2) }}</div>
              <div class="room-per-night">{{ room.pricePerNight.toFixed(2) }}/notte</div>
            </div>
          </div>
        </div>

        <!-- Messaggio Informativo -->
        <div class="info-box">
          <p>
            <strong>Periodo:</strong> {{ daysCount }} nott{{ daysCount !== 1 ? 'i' : 'e' }}
          </p>
          <p v-if="type === 'hotel'">
            <strong>Ospiti:</strong> {{ quoteData.adults }} adult{{ quoteData.adults !== 1 ? 'i' : 'o' }}
            <span v-if="quoteData.children > 0">, {{ quoteData.children }} bambin{{ quoteData.children !== 1 ? 'i' : 'o' }}</span>
          </p>
          <div v-if="quoteData.roomType" class="price-section">
            <p>
              <strong>Camera Selezionata:</strong> {{ quoteData.roomType }}
            </p>
            <p class="price-highlight">
              <strong>TOTALE PREVENTIVO:</strong> €{{ priceQuote.finalTotal.toFixed(2) }}
            </p>
          </div>
          <p v-else class="price-placeholder">
            Seleziona date e camera per visualizzare il prezzo
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
    enum: ['hotel', 'beach'],
    required: true
  }
})

const emit = defineEmits(['close', 'created'])

const { saveQuote } = useQuotes()
const { loadPricelists, loadTimetable, calculateQuotePrice, getRoomTypes } = usePricing()

const quoteData = ref({
  name: '',
  guestName: '',
  checkin: '',
  checkout: '',
  adults: 1,
  children: 0,
  board: 'bb',
  type: props.type,
  roomType: '' // Tipo di camera per hotel, posto per beach
})

const priceQuote = ref(null)
const roomTypes = ref([])
const calculatedRoomPrices = ref([])
const isLoading = ref(false)

const daysCount = computed(() => {
  if (!quoteData.value.checkin || !quoteData.value.checkout) return 0
  const start = new Date(quoteData.value.checkin)
  const end = new Date(quoteData.value.checkout)
  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
})

// Calcola i prezzi per TUTTI i roomType
const calculateAllRoomPrices = () => {
  if (!quoteData.value.checkin || !quoteData.value.checkout || daysCount.value === 0) {
    calculatedRoomPrices.value = []
    priceQuote.value = null
    return
  }
  
  const prices = roomTypes.value.map(room => {
    const quote = calculateQuotePrice(
      quoteData.value.checkin,
      quoteData.value.checkout,
      room.roomType,
      props.type,
      quoteData.value.adults + quoteData.value.children
    )
    return {
      roomType: room.roomType,
      totalPrice: quote?.finalTotal || 0,
      pricePerNight: quote?.pricePerNight || 0,
      quote
    }
  })
  
  calculatedRoomPrices.value = prices
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

const isFormValid = computed(() => {
  return quoteData.value.name.trim() &&
         quoteData.value.guestName.trim() &&
         quoteData.value.checkin &&
         quoteData.value.checkout &&
         daysCount.value > 0 &&
         (props.type !== 'hotel' || quoteData.value.board) &&
         calculatedRoomPrices.value.length > 0
})

const submitQuote = async () => {
  try {
    // Calcola la data di scadenza (7 giorni da oggi)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    
    await saveQuote({
      ...quoteData.value,
      roomType: null, // Non selezionata ancora
      duration: daysCount.value,
      allRoomOptions: calculatedRoomPrices.value, // Salva TUTTE le opzioni
      priceData: null, // Sarà scelto dal cliente
      totalPrice: null, // Sarà scelto dal cliente
      pricePerNight: null, // Sarà scelto dal cliente
      dailyPrices: null, // Sarà scelto dal cliente
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    })
    emit('created')
    close()
  } catch (err) {
    alert('Errore nella creazione del preventivo: ' + err.message)
  }
}

const close = () => {
  emit('close')
}

onMounted(async () => {
  isLoading.value = true
  try {
    await loadPricelists(props.type)
    await loadTimetable(props.type)
    
    // Carica i tipi di camera disponibili per hotel
    if (props.type === 'hotel') {
      roomTypes.value = getRoomTypes(props.type)
    }
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
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.quote-builder-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
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
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.quote-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-section label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.form-section input,
.form-section select {
  padding: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-section input:focus,
.form-section select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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
  padding: 0.75rem;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  font-size: 0.85rem;
}

.board-radio-card.is-selected {
  border-color: #667eea;
  background: #f3f4f6;
  color: #667eea;
}

.hidden-radio {
  display: none;
}

.info-box {
  background: #f0f9ff;
  border-left: 4px solid #0284c7;
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e40af;
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
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.price-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid #667eea;
}

.price-section p {
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.price-highlight {
  font-size: 1.2rem;
  color: #10b981;
  font-weight: 900;
  background: #ecfdf5;
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 0.75rem !important;
}

.price-placeholder {
  color: #9ca3af;
  font-style: italic;
  margin: 0 !important;
}

/* Room Selection Cards */
.rooms-section {
  margin-top: 1rem;
}

.section-hint {
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: -0.3rem;
  font-style: italic;
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.room-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 2px solid #cbd5e1;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
  text-align: center;
}

.room-card:hover {
  border-color: #667eea;
  background: #f8f9ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.room-card.is-selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.room-type {
  font-weight: 700;
  color: #1f2937;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.room-price {
  font-size: 1.3rem;
  font-weight: 900;
  color: #10b981;
  margin-bottom: 0.25rem;
}

.room-per-night {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}
</style>
