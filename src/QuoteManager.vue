<template>
  <div class="quote-manager">
    <div v-if="isLoading" class="loading">
      Caricamento preventivi...
    </div>

    <div v-else-if="!selectedQuoteId" class="quote-list">
      <div class="header">
        <h1>Gestione Preventivi</h1>
        <div class="filters">
          <button 
            v-for="f in filters" 
            :key="f"
            @click="activeFilter = f"
            :class="['filter-btn', { active: activeFilter === f }]"
          >
            {{ f === 'all' ? 'Tutti' : f === 'hotel' ? 'Hotel' : 'Spiaggia' }}
          </button>
          <button @click="createNewQuote" class="btn btn-primary">
            + Nuovo Preventivo
          </button>
        </div>
      </div>

      <div v-if="filteredQuotes.length === 0" class="empty-state">
        <p>Nessun preventivo trovato</p>
        <button @click="createNewQuote" class="btn btn-secondary">
          Crea un preventivo
        </button>
      </div>

      <div v-else class="quotes-grid">
        <div 
          v-for="quote in filteredQuotes" 
          :key="quote.id"
          class="quote-card"
          @click="selectQuote(quote)"
        >
          <div class="quote-header">
            <div>
              <h3>{{ quote.name }}</h3>
              <p class="quote-type">{{ quote.type === 'hotel' ? '🏨 Hotel' : '🏖️ Spiaggia' }}</p>
            </div>
            <span class="quote-date">{{ formatDate(quote.createdAt) }}</span>
          </div>

          <div class="quote-details">
            <div class="detail-row">
              <span class="label">Cliente:</span>
              <span class="value">{{ quote.guestName }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Periodo:</span>
              <span class="value">{{ formatDate(quote.checkin) }} → {{ formatDate(quote.checkout) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Notti:</span>
              <span class="value">{{ quote.duration }}</span>
            </div>
            <div v-if="quote.type === 'hotel'" class="detail-row">
              <span class="label">Ospiti:</span>
              <span class="value">{{ quote.adults }} adult{{ quote.adults !== 1 ? 'i' : 'o' }}
                <span v-if="quote.children > 0">, {{ quote.children }} bambin{{ quote.children !== 1 ? 'i' : 'o' }}</span>
              </span>
            </div>
          </div>

          <div class="quote-footer">
            <span class="status">In sospeso</span>
            <span class="arrow">→</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Dettagli Preventivo -->
    <div v-else class="quote-detail">
      <button @click="selectedQuoteId = null" class="btn-back">
        ← Torna alla lista
      </button>

      <div class="detail-header">
        <div>
          <h2>{{ currentQuote.name }}</h2>
          <p class="subtext">
            {{ currentQuote.type === 'hotel' ? 'Preventivo Hotel' : 'Preventivo Spiaggia' }}
          </p>
        </div>
        <span class="date">{{ formatDate(currentQuote.createdAt) }}</span>
      </div>

      <div class="detail-content">
        <!-- Informazioni Cliente -->
        <section class="detail-section">
          <h3>Informazioni Cliente</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Nome:</span>
              <span class="info-value">{{ currentQuote.guestName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tipo:</span>
              <span class="info-value">{{ currentQuote.type === 'hotel' ? 'Hotel' : 'Spiaggia' }}</span>
            </div>
          </div>
        </section>

        <!-- Prenotazione -->
        <section class="detail-section">
          <h3>Periodo di Prenotazione</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Check-in:</span>
              <span class="info-value">{{ formatDate(currentQuote.checkin) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Check-out:</span>
              <span class="info-value">{{ formatDate(currentQuote.checkout) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Notti:</span>
              <span class="info-value">{{ currentQuote.duration }}</span>
            </div>
          </div>
        </section>

        <!-- Ospiti (Hotel) -->
        <section v-if="currentQuote.type === 'hotel'" class="detail-section">
          <h3>Composizione Ospiti</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Adulti:</span>
              <span class="info-value">{{ currentQuote.adults }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Bambini:</span>
              <span class="info-value">{{ currentQuote.children || '0' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Trattamento:</span>
              <span class="info-value">{{ currentQuote.board.toUpperCase() }}</span>
            </div>
          </div>
        </section>

        <!-- Opzioni Camera Disponibili (Hotel) -->
        <section v-if="currentQuote.type === 'hotel' && currentQuote.allRoomOptions && currentQuote.allRoomOptions.length > 0" class="detail-section room-options-section">
          <h3>Opzioni Camera Disponibili</h3>
          <div class="room-options-grid">
            <div 
              v-for="room in currentQuote.allRoomOptions"
              :key="room.roomType"
              @click="selectRoomForConversion(room)"
              :class="['room-option-card', { 'is-selected': selectedRoomForConversion?.roomType === room.roomType }]"
            >
              <div class="room-opt-type">{{ room.roomType }}</div>
              <div class="room-opt-price">€{{ room.totalPrice.toFixed(2) }}</div>
              <div class="room-opt-per-night">€{{ room.pricePerNight.toFixed(2) }}/notte</div>
            </div>
          </div>
        </section>

        <!-- Data Scadenza -->
        <section class="detail-section expiry-section">
          <h3>Validità Preventivo</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Creato:</span>
              <span class="info-value">{{ formatDate(currentQuote.createdAt) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Scade:</span>
              <span class="info-value" :class="{'is-expired': isQuoteExpired}">
                {{ formatDate(currentQuote.expiresAt) }}
                <span v-if="isQuoteExpired" class="expiry-badge">SCADUTO</span>
              </span>
            </div>
          </div>
        </section>

        <!-- Pricing (mostrato solo se camera selezionata) -->
        <section v-if="selectedRoomForConversion" class="detail-section pricing-section">
          <h3>Dettagli Prezzo - {{ selectedRoomForConversion.roomType }}</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Notti:</span>
              <span class="info-value">{{ currentQuote.duration }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tariffa/notte (per persona):</span>
              <span class="info-value">€{{ selectedRoomForConversion.pricePerNight.toFixed(2) }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">TOTALE PREVENTIVO:</span>
              <span class="info-value price-highlight">€{{ selectedRoomForConversion.totalPrice.toFixed(2) }}</span>
            </div>
          </div>
          <div v-if="selectedRoomForConversion.quote && selectedRoomForConversion.quote.days" class="daily-prices">
            <p class="section-subtitle">Tariffe giornaliere:</p>
            <div class="prices-table">
              <div v-for="day in selectedRoomForConversion.quote.days" :key="day.date" class="price-row">
                <span class="date">{{ formatDate(day.date) }}</span>
                <span class="price">€{{ day.dayTotal.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Note Informative -->
        <section class="detail-section info-box">
          <h3>Prossimi Passi</h3>
          <ul>
            <li>Questo preventivo mostra il dettaglio della richiesta</li>
            <li>Puoi convertirlo in prenotazione confermata dal pulsante sottostante</li>
            <li>Oppure eliminarlo se la richiesta è stata annullata</li>
          </ul>
        </section>
      </div>

      <div class="detail-actions">
        <button 
          @click="deleteCurrentQuote" 
          class="btn btn-danger"
          :disabled="isDeleting"
        >
          {{ isDeleting ? 'Eliminazione...' : 'Elimina Preventivo' }}
        </button>
        <button 
          @click="convertToBooking" 
          class="btn btn-success"
          :disabled="isConverting || isQuoteExpired || (currentQuote.type === 'hotel' && !selectedRoomForConversion)"
          :title="isQuoteExpired ? 'Preventivo scaduto' : (currentQuote.type === 'hotel' && !selectedRoomForConversion ? 'Seleziona una camera' : '')"
        >
          {{ isConverting ? 'Conversione...' : isQuoteExpired ? 'Preventivo Scaduto' : 'Converti in Prenotazione' }}
        </button>
      </div>
    </div>

    <!-- Quote Builder Modal -->
    <QuoteBuilder 
      v-if="showQuoteBuilder"
      :type="selectedQuoteType"
      @close="showQuoteBuilder = false"
      @created="handleQuoteCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import QuoteBuilder from './QuoteBuilder.vue'
import { useQuotes } from '@/composables/useQuotes.js'

const router = useRouter()
const { quotes, loadQuotes, deleteQuote, convertToBooking: convertQuoteToBooking } = useQuotes()

const activeFilter = ref('all')
const selectedQuoteId = ref(null)
const selectedRoomForConversion = ref(null)
const isLoading = ref(true)
const isDeleting = ref(false)
const isConverting = ref(false)
const showQuoteBuilder = ref(false)
const selectedQuoteType = ref('hotel')
const filters = ['all', 'hotel', 'beach']

const filteredQuotes = computed(() => {
  if (activeFilter.value === 'all') return quotes.value
  return quotes.value.filter(q => q.type === activeFilter.value)
})

const currentQuote = computed(() => {
  return quotes.value.find(q => q.id === selectedQuoteId.value)
})

const isQuoteExpired = computed(() => {
  if (!currentQuote.value?.expiresAt) return false
  return new Date() > new Date(currentQuote.value.expiresAt)
})

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric' })
}

const selectQuote = (quote) => {
  selectedQuoteId.value = quote.id
  selectedRoomForConversion.value = null // Reset room selection
}

const selectRoomForConversion = (room) => {
  selectedRoomForConversion.value = room
}

const createNewQuote = () => {
  selectedQuoteType.value = 'hotel'
  showQuoteBuilder.value = true
}

const handleQuoteCreated = () => {
  // La lista si aggiorna automaticamente tramite loadQuotes
}

const deleteCurrentQuote = async () => {
  if (!confirm('Sei sicuro di voler eliminare questo preventivo?')) return
  try {
    isDeleting.value = true
    await deleteQuote(selectedQuoteId.value)
    selectedQuoteId.value = null
  } catch (err) {
    alert('Errore: ' + err.message)
  } finally {
    isDeleting.value = false
  }
}

const convertToBooking = async () => {
  if (isQuoteExpired.value) {
    alert('Questo preventivo è scaduto e non può essere convertito')
    return
  }
  
  if (currentQuote.value.type === 'hotel' && !selectedRoomForConversion.value) {
    alert('Seleziona il tipo di camera prima di convertire')
    return
  }
  
  if (!confirm('Convertire questo preventivo in prenotazione confermata?')) return
  try {
    isConverting.value = true
    
    // Prepara i dati della prenotazione con la camera selezionata
    const bookingData = {
      ...currentQuote.value,
      roomType: currentQuote.value.type === 'hotel' ? selectedRoomForConversion.value.roomType : null,
      pricePerNight: selectedRoomForConversion.value?.pricePerNight,
      totalPrice: selectedRoomForConversion.value?.totalPrice,
      dailyPrices: selectedRoomForConversion.value?.quote?.days,
      priceData: selectedRoomForConversion.value?.quote
    }
    
    await convertQuoteToBooking(selectedQuoteId.value, currentQuote.value.type, bookingData)
    // Redirect alla pagina di prenotazione appropriata
    const redirectRoute = currentQuote.value.type === 'hotel' ? '/hotel-bookings' : '/beach-bookings'
    router.push(redirectRoute)
  } catch (err) {
    alert('Errore: ' + err.message)
  } finally {
    isConverting.value = false
  }
}

onMounted(async () => {
  try {
    await loadQuotes()
  } catch (err) {
    alert('Errore nel caricamento dei preventivi: ' + err.message)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.quote-manager {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
  font-size: 1.1rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  background: #f9fafb;
  border-radius: 12px;
  color: #6b7280;
}

.empty-state p {
  margin: 0 0 1.5rem 0;
  font-size: 1.1rem;
}

/* Header */
.header {
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.header h1 {
  margin: 0;
  font-size: 2rem;
  color: #1f2937;
}

.filters {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #cbd5e1;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  font-size: 0.9rem;
}

.filter-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.filter-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

/* Quote Cards Grid */
.quotes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.quote-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
}

.quote-card:hover {
  border-color: #667eea;
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.15);
  transform: translateY(-4px);
}

.quote-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%);
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.quote-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.1rem;
}

.quote-type {
  margin: 0;
  font-size: 0.85rem;
  color: #6b7280;
}

.quote-date {
  font-size: 0.8rem;
  color: #9ca3af;
  white-space: nowrap;
}

.quote-details {
  padding: 1.5rem;
  flex-grow: 1;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}

.detail-row .label {
  color: #6b7280;
  font-weight: 500;
}

.detail-row .value {
  color: #1f2937;
  font-weight: 600;
}

.quote-footer {
  padding: 1rem 1.5rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.status {
  background: #fef3c7;
  color: #92400e;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.8rem;
}

.arrow {
  color: #d1d5db;
  font-size: 1.25rem;
}

/* Detail View */
.quote-detail {
  background: white;
  border-radius: 12px;
  padding: 2rem;
}

.btn-back {
  background: none;
  border: none;
  color: #667eea;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;
  margin-bottom: 1.5rem;
  transition: color 0.2s;
}

.btn-back:hover {
  color: #764ba2;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.detail-header h2 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.subtext {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.date {
  color: #9ca3af;
  font-size: 0.95rem;
}

.detail-content {
  margin-bottom: 2rem;
}

.detail-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.detail-section h3 {
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.info-value {
  color: #1f2937;
  font-weight: 500;
}

.info-box {
  background: #dcfce7;
  border-left: 4px solid #16a34a;
  color: #15803d;
}

.info-box ul {
  margin: 0;
  padding-left: 1.5rem;
}

.info-box li {
  margin-bottom: 0.5rem;
}

.detail-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
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
  flex: 1;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-success {
  background: #10b981;
  color: white;
  flex: 1;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Room Options Grid */
.room-options-section {
  background: #f9fafb;
  border-left: 4px solid #3b82f6;
}

.room-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.room-option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  border: 2px solid #cbd5e1;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
  text-align: center;
}

.room-option-card:hover {
  border-color: #3b82f6;
  background: #f8f9ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.room-option-card.is-selected {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #3b82f615 0%, #1e40af15 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.room-opt-type {
  font-weight: 700;
  color: #1f2937;
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.room-opt-price {
  font-size: 1.4rem;
  font-weight: 900;
  color: #10b981;
  margin-bottom: 0.25rem;
}

.room-opt-per-night {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
}

/* Expiry Section */
.expiry-section {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
}

.is-expired {
  color: #dc2626 !important;
  font-weight: 600;
}

.expiry-badge {
  display: inline-block;
  background: #dc2626;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  margin-left: 0.5rem;
}
</style>
