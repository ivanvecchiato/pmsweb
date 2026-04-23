import { ref, computed } from 'vue'
import axios from 'axios'

const quotes = ref([])
const selectedQuote = ref(null)

const normalizeBoardForBackend = (payload) => {
  if (!payload || payload.board == null) return payload
  return {
    ...payload,
    board: String(payload.board).toUpperCase()
  }
}

// Carica preventivi dal backend
const loadQuotes = async (type = 'all') => {
  try {
    const url = type === 'all' 
      ? '/api/pms/quotes/getall'
      : `/api/pms/quotes/getbytype?type=${type}`
    const res = await axios.get(url)
    quotes.value = res.data || []
  } catch (err) {
    console.error('Errore caricamento preventivi:', err)
    throw err
  }
}

// Salva un nuovo preventivo
const saveQuote = async (quoteData) => {
  try {
    const normalizedQuoteData = normalizeBoardForBackend(quoteData)
    const res = await axios.post('/api/pms/quotes/save', normalizedQuoteData)
    await loadQuotes()
    return res.data
  } catch (err) {
    console.error('Errore salvataggio preventivo:', err)
    throw err
  }
}

// Elimina un preventivo
const deleteQuote = async (quoteId) => {
  try {
    await axios.post('/api/pms/quotes/delete', { id: quoteId })
    await loadQuotes()
  } catch (err) {
    console.error('Errore eliminazione preventivo:', err)
    throw err
  }
}

// Elimina tutti i preventivi
const deleteAllQuotes = async () => {
  try {
    const res = await axios.post('/api/pms/quotes/deleteall')
    await loadQuotes()
    return res.data
  } catch (err) {
    console.error('Errore eliminazione tutti i preventivi:', err)
    throw err
  }
}

// Crea prenotazione da preventivo
const convertToBooking = async (quoteId, type, bookingDataOverride = null) => {
  try {
    const quote = quotes.value.find(q => q.id === quoteId)
    if (!quote) throw new Error('Preventivo non trovato')
    
    const endpoint = type === 'hotel'
      ? '/api/pms/hotel/new_reservation'
      : '/api/pms/beach/new_reservation'
    
    // Usa i dati forniti dalla UI; aggiunge solo metadata di tracciamento conversione.
    const bookingData = {
      ...(bookingDataOverride || quote),
      createdFrom: `quote_${quoteId}`,
      quoteId: quoteId
    }
    const normalizedBookingData = normalizeBoardForBackend(bookingData)
    
    const res = await axios.post(endpoint, normalizedBookingData)
    await deleteQuote(quoteId)
    return res.data
  } catch (err) {
    console.error('Errore conversione preventivo:', err)
    throw err
  }
}

export const useQuotes = () => ({
  quotes: computed(() => quotes.value),
  selectedQuote: computed({
    get: () => selectedQuote.value,
    set: (val) => { selectedQuote.value = val }
  }),
  loadQuotes,
  saveQuote,
  deleteQuote,
  deleteAllQuotes,
  convertToBooking
})
