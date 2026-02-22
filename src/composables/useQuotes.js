import { ref, computed } from 'vue'
import axios from 'axios'

const quotes = ref([])
const selectedQuote = ref(null)

// Carica preventivi dal backend
const loadQuotes = async (type = 'all') => {
  try {
    const url = type === 'all' 
      ? 'http://localhost:8081/api/pms/quotes/getall'
      : `http://localhost:8081/api/pms/quotes/getbytype?type=${type}`
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
    const res = await axios.post('http://localhost:8081/api/pms/quotes/save', quoteData)
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
    await axios.post('http://localhost:8081/api/pms/quotes/delete', { id: quoteId })
    await loadQuotes()
  } catch (err) {
    console.error('Errore eliminazione preventivo:', err)
    throw err
  }
}

// Crea prenotazione da preventivo
const convertToBooking = async (quoteId, type, bookingDataOverride = null) => {
  try {
    const quote = quotes.value.find(q => q.id === quoteId)
    if (!quote) throw new Error('Preventivo non trovato')
    
    const endpoint = type === 'hotel'
      ? 'http://localhost:8081/api/pms/hotel/new_reservation'
      : 'http://localhost:8081/api/pms/beach/new_reservation'
    
    // Usa i dati forniti (con camera selezionata) o i dati del preventivo
    const bookingData = {
      ...(bookingDataOverride || quote),
      status: 'confirmed',
      createdFrom: `quote_${quoteId}`,
      quoteId: quoteId
    }
    
    const res = await axios.post(endpoint, bookingData)
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
  convertToBooking
})
