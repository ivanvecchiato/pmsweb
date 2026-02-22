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

// Estrae i tipi di camera/fila disponibili dal listino
const getRoomTypes = (type = 'hotel') => {
  // Aggrega i tipi da tutti i listini disponibili (più robusto)
  if (type === 'hotel') {
    const typesMap = new Map()
    pricelists.value.forEach(list => {
      if (!list || !list.prices) return
      list.prices.forEach(p => {
        const rt = p.roomType
        if (!rt) return
        if (!typesMap.has(rt)) {
          typesMap.set(rt, {
            roomType: rt,
            tariffa: p.tariffa || 0,
            description: rt
          })
        }
      })
    })
    return Array.from(typesMap.values())
  }

  if (type === 'beach') {
    const typesMap = new Map()
    pricelists.value.forEach(list => {
      if (!list || !list.prices) return
      list.prices.forEach(p => {
        const desc = p.place_type?.description || (p.fila ? `Fila ${p.fila}` : null)
        if (!desc) return
        if (!typesMap.has(desc)) {
          typesMap.set(desc, {
            placeType: desc,
            price: p.price_per_place || p.tariffa || 0,
            description: desc
          })
        }
      })
    })
    return Array.from(typesMap.values())
  }
  
  return []
}

// Calcola il prezzo di un giorno per una camera/posto
const calculateDayPrice = (roomType, dateStr, type = 'hotel') => {
  const timetable = timetables.value[type] || []
  const day = timetable.find(d => d.date === dateStr)
  if (!day || !day.pricelist) return 0
  
  let list = pricelists.value.find(p => String(p.id) === String(day.pricelist))
  // Fallback: some timetables store pricelist as 0-based index
  if (!list && typeof day.pricelist !== 'undefined') {
    const idx = Number(day.pricelist)
    if (!Number.isNaN(idx) && pricelists.value[idx]) {
      list = pricelists.value[idx]
    }
  }
  if (!list) return 0
  
  // Per hotel: cerca per roomType
  if (type === 'hotel') {
    const item = list.prices?.find(p => p.roomType === roomType)
    return Number(item?.tariffa || 0)
  }
  
  // Per beach: cerca per place_type.description (roomType sarà "FILA 1", etc.)
  const item = list.prices?.find(p => p.place_type?.description === roomType)
  // Alcuni listini possono usare nomi diversi per il prezzo: price_per_place, price, tariffa
  return Number(item?.price_per_place ?? item?.price ?? item?.tariffa ?? 0)
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
