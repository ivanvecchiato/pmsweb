import { ref, computed } from 'vue'
import axios from 'axios'

const pricelists = ref([])
const timetables = ref({
  hotel: [],
  beach: []
})

// Carica i listini di prezzo
const loadPricelists = async (type = 'hotel') => {
  try {
    const url = `http://localhost:8081/api/pms/getrates?type=${type}`
    const res = await axios.get(url)
    pricelists.value = res.data || []
    return pricelists.value
  } catch (err) {
    console.error('Errore caricamento listini:', err)
    return []
  }
}

// Carica il timetable (tariffe per data)
const loadTimetable = async (type = 'hotel') => {
  try {
    const url = `http://localhost:8081/api/pms/gettimetable?type=${type}`
    const res = await axios.get(url)
    timetables.value[type] = res.data || []
    return timetables.value[type]
  } catch (err) {
    console.error('Errore caricamento timetable:', err)
    return []
  }
}

// Converti data a formato ISO
const toISODate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Estrae i tipi di camera disponibili dal listino
const getRoomTypes = (type = 'hotel') => {
  if (type === 'beach') return []
  
  // Per hotel: estrai i roomType dal primo listino (stesso per tutti)
  const firstPricelist = pricelists.value?.[0]
  if (!firstPricelist || !firstPricelist.prices) return []
  
  return firstPricelist.prices.map(p => ({
    roomType: p.roomType,
    tariffa: p.tariffa || 0,
    description: p.roomType
  }))
}

// Calcola il prezzo di un giorno per una camera/posto
const calculateDayPrice = (roomType, dateStr, type = 'hotel') => {
  const timetable = timetables.value[type] || []
  const day = timetable.find(d => d.date === dateStr)
  if (!day || !day.pricelist) return 0
  
  const list = pricelists.value.find(p => String(p.id) === String(day.pricelist))
  if (!list) return 0
  
  // Per hotel: cerca per roomType
  if (type === 'hotel') {
    const item = list.prices?.find(p => p.roomType === roomType)
    return Number(item?.tariffa || 0)
  }
  
  // Per beach: era il vecchio sistema con id/price_per_place
  const item = list.prices?.find(p => String(p.id) === String(roomType))
  return Number(item?.price_per_room || item?.price_per_place || 0)
}

// Calcola il prezzo totale per un preventivo
const calculateQuotePrice = (checkin, checkout, roomType, type = 'hotel', persone = 1) => {
  if (!checkin || !checkout || !roomType) return null
  
  const start = new Date(checkin)
  const end = new Date(checkout)
  
  if (start >= end) return null
  
  let totalCalculated = 0
  const daysList = []
  let current = new Date(start)
  
  while (current < end) {
    const dateStr = toISODate(current)
    const dayPrice = calculateDayPrice(roomType, dateStr, type) // prezzo per persona
    const dayTotal = dayPrice * persone // moltiplicato per numero di persone
    daysList.push({ 
      date: dateStr, 
      dayTotal,
      pricePerUnit: dayPrice
    })
    totalCalculated += dayTotal
    current.setDate(current.getDate() + 1)
  }
  
  const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  
  return {
    days: daysList,
    nights,
    totalCalculated,
    finalTotal: totalCalculated,
    pricePerNight: nights > 0 ? totalCalculated / nights : 0,
    perPerson: persone > 0 ? totalCalculated / persone : totalCalculated,
    roomType
  }
}

export const usePricing = () => ({
  pricelists: computed(() => pricelists.value),
  timetables: computed(() => timetables.value),
  loadPricelists,
  loadTimetable,
  getRoomTypes,
  toISODate,
  calculateDayPrice,
  calculateQuotePrice
})
