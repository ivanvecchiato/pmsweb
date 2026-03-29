import { ref, computed } from 'vue'
import axios from 'axios'

const pricelists = ref([])
const timetables = ref({
  hotel: [],
  beach: []
})
const hotelPricingPolicy = ref({
  mode: 'room',
  boardChargeMode: 'per_person',
  fallbackKidDiscountPct: 0,
  extraBedDiscountPct: 0,
  overnightTax: {
    enabled: false,
    allYear: true,
    startDate: '',
    endDate: '',
    amountPerPerson: 0,
    childExemptUnderAge: 3,
    maxDays: 10
  },
  ageBands: [
    { label: 'Infant', minAge: 0, maxAge: 2, pricingType: 'fixed', fixedPrice: 15, discountPct: 0 },
    { label: 'Child', minAge: 3, maxAge: 11, pricingType: 'discount', discountPct: 50, fixedPrice: 0 },
    { label: 'Teen', minAge: 12, maxAge: 17, pricingType: 'discount', discountPct: 20, fixedPrice: 0 }
  ]
})

const isValidISODate = (value) => {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && toISODate(date) === value
}

const normalizeOvernightTax = (rawTax = {}) => {
  const enabled = Boolean(rawTax?.enabled)
  const allYear = rawTax?.allYear !== false

  let amountPerPerson = Number(rawTax?.amountPerPerson)
  if (!Number.isFinite(amountPerPerson)) amountPerPerson = 0

  let childExemptUnderAge = Number(rawTax?.childExemptUnderAge)
  if (!Number.isFinite(childExemptUnderAge)) childExemptUnderAge = 0

  let maxDays = Number(rawTax?.maxDays)
  if (!Number.isFinite(maxDays) || maxDays <= 0) maxDays = 10

  const startDate = isValidISODate(rawTax?.startDate) ? rawTax.startDate : ''
  const endDate = isValidISODate(rawTax?.endDate) ? rawTax.endDate : ''

  return {
    enabled,
    allYear,
    startDate,
    endDate,
    amountPerPerson: Math.max(0, Number(amountPerPerson.toFixed(2))),
    childExemptUnderAge: Math.max(0, Math.floor(childExemptUnderAge)),
    maxDays: Math.max(1, Math.floor(maxDays))
  }
}

const normalizePolicy = (rawPolicy = {}) => {
  const mode = String(rawPolicy?.mode || '').toLowerCase() === 'person' ? 'person' : 'room'
  const ageBands = Array.isArray(rawPolicy?.ageBands)
    ? rawPolicy.ageBands
        .map((band) => ({
          label: String(band?.label || ''),
          minAge: Number(band?.minAge),
          maxAge: Number(band?.maxAge),
          pricingType: String(band?.pricingType || '').toLowerCase() === 'fixed' ? 'fixed' : 'discount',
          discountPct: Number.isFinite(Number(band?.discountPct))
            ? Number(band?.discountPct)
            : 0,
          fixedPrice: Number.isFinite(Number(band?.fixedPrice)) ? Number(band.fixedPrice) : 0
        }))
        .filter((band) => Number.isFinite(band.minAge) && Number.isFinite(band.maxAge) && band.maxAge >= band.minAge)
        .map((band) => ({
          ...band,
          discountPct: Math.max(0, Math.min(100, Number(band.discountPct || 0))),
          fixedPrice: Math.max(0, Number(band.fixedPrice || 0))
        }))
        .sort((a, b) => a.minAge - b.minAge)
    : []

  let fallbackKidDiscountPct = Number(rawPolicy?.fallbackKidDiscountPct)
  if (!Number.isFinite(fallbackKidDiscountPct)) fallbackKidDiscountPct = 0

  let extraBedDiscountPct = Number(rawPolicy?.extraBedDiscountPct)
  if (!Number.isFinite(extraBedDiscountPct)) extraBedDiscountPct = 0

  return {
    mode,
    boardChargeMode: String(rawPolicy?.boardChargeMode || 'per_person'),
    fallbackKidDiscountPct: Math.max(0, Math.min(100, fallbackKidDiscountPct)),
    extraBedDiscountPct: Math.max(0, Math.min(100, extraBedDiscountPct)),
    overnightTax: normalizeOvernightTax(
      rawPolicy?.overnightTax || rawPolicy?.overnight_tax || rawPolicy?.tassaDiSoggiorno || {}
    ),
    ageBands
  }
}

const loadHotelPricingPolicy = async () => {
  try {
    const res = await axios.get('http://localhost:8081/api/pms/getconfigs?section=hotel')
    hotelPricingPolicy.value = normalizePolicy(res?.data?.pricing || res?.data || {})
  } catch (err) {
    console.error('Errore caricamento policy pricing hotel:', err)
  }
  return hotelPricingPolicy.value
}

const saveHotelPricingPolicy = async (pricing) => {
  const normalized = normalizePolicy(pricing)
  const payload = {
    section: 'hotel',
    data: {
      pricing: normalized
    }
  }
  await axios.post('http://localhost:8081/api/pms/setconfigs', payload)
  hotelPricingPolicy.value = normalized
  return normalized
}

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
            placeTypeId: p.place_type?.id ?? null,
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
const calculateDayPrice = (roomType, dateStr, type = 'hotel', board = 'bb') => {
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
    const base = Number(item?.tariffa || 0)
    const boardKey = String(board || 'bb').toLowerCase()
    const surcharge = boardKey === 'hb'
      ? Number(list?.surcharges?.hb || 0)
      : boardKey === 'fb'
        ? Number(list?.surcharges?.fb || 0)
        : 0
    return Number((base + surcharge).toFixed(2))
  }
  
  // Per beach: cerca per place_type.description (roomType sarà "FILA 1", etc.)
  const item = list.prices?.find(p => p.place_type?.description === roomType)
  // Alcuni listini possono usare nomi diversi per il prezzo: price_per_place, price, tariffa
  return Number(item?.price_per_place ?? item?.price ?? item?.tariffa ?? 0)
}

const applyDiscount = (fullPrice, discountPct) => {
  const pct = Math.max(0, Math.min(100, Number(discountPct || 0)))
  return Number((Number(fullPrice || 0) * (1 - pct / 100)).toFixed(2))
}

const resolveKidPricing = (age, policy, fullPrice) => {
  const bands = Array.isArray(policy?.ageBands) ? policy.ageBands : []
  const fallbackDiscount = Number(policy?.fallbackKidDiscountPct ?? 0)
  if (!Number.isFinite(age)) {
    return {
      pricingType: 'discount',
      discountPct: fallbackDiscount,
      fixedPrice: 0,
      amount: applyDiscount(fullPrice, fallbackDiscount)
    }
  }

  const match = bands.find((band) => age >= band.minAge && age <= band.maxAge)
  if (!match) {
    return {
      pricingType: 'discount',
      discountPct: fallbackDiscount,
      fixedPrice: 0,
      amount: applyDiscount(fullPrice, fallbackDiscount)
    }
  }

  if (match.pricingType === 'fixed') {
    return {
      pricingType: 'fixed',
      discountPct: 0,
      fixedPrice: Number(match.fixedPrice || 0),
      amount: Number(Number(match.fixedPrice || 0).toFixed(2))
    }
  }

  return {
    pricingType: 'discount',
    discountPct: Number(match.discountPct || 0),
    fixedPrice: 0,
    amount: applyDiscount(fullPrice, match.discountPct)
  }
}

const calculateWeightedGuests = (occupancy = {}, policy = hotelPricingPolicy.value, fullPrice = 0) => {
  const adults = Math.max(0, Number(occupancy.adults || 0))
  const children = Math.max(0, Number(occupancy.children || 0))
  const extraBeds = Math.max(0, Number(occupancy.extraBeds || 0))
  const kidAges = Array.isArray(occupancy.kidAges) ? occupancy.kidAges : []

  const adultsAmount = Number((adults * Number(fullPrice || 0)).toFixed(2))
  let kidsAmount = 0
  const kidsBreakdown = []
  for (let i = 0; i < children; i++) {
    const age = i < kidAges.length ? Number(kidAges[i]) : NaN
    const pricing = resolveKidPricing(age, policy, fullPrice)
    kidsBreakdown.push({
      index: i + 1,
      age: Number.isFinite(age) ? age : null,
      pricingType: pricing.pricingType,
      discountPct: pricing.discountPct,
      fixedPrice: pricing.fixedPrice,
      amount: pricing.amount
    })
    kidsAmount += Number(pricing.amount || 0)
  }

  const extraBedDiscountPct = Number(policy?.extraBedDiscountPct ?? 0)
  const extraBedUnitPrice = applyDiscount(fullPrice, extraBedDiscountPct)
  const extraBedsAmount = Number((extraBeds * extraBedUnitPrice).toFixed(2))
  const totalAmount = Number((adultsAmount + kidsAmount + extraBedsAmount).toFixed(2))
  const effectiveUnits = fullPrice > 0 ? Number((totalAmount / fullPrice).toFixed(4)) : 0

  return {
    adults,
    children,
    adultsAmount,
    kidsAmount: Number(kidsAmount.toFixed(2)),
    extraBedsAmount,
    kidsBreakdown,
    extraBedDiscountPct,
    effectiveUnits,
    totalAmount
  }
}

// Calcola il prezzo totale per un preventivo
const calculateQuotePrice = (checkin, checkout, roomType, type = 'hotel', persone = 1, options = {}) => {
  if (!checkin || !checkout || !roomType) return null
  
  const start = new Date(checkin)
  const end = new Date(checkout)
  
  if (start >= end) return null
  
  let totalCalculated = 0
  const daysList = []
  let current = new Date(start)
  
  while (current < end) {
    const dateStr = toISODate(current)
    const board = options?.board || 'bb'
    const dayPrice = calculateDayPrice(roomType, dateStr, type, board)

    let units = Number(persone || 1)
    let weighted = null
    if (type === 'hotel') {
      const policy = hotelPricingPolicy.value
      if (policy.mode === 'room') {
        units = 1
      } else {
        weighted = calculateWeightedGuests({
          adults: options?.adults ?? persone,
          children: options?.children ?? 0,
          kidAges: options?.kidAges ?? [],
          extraBeds: options?.extraBeds ?? 0
        }, policy, dayPrice)
        units = weighted.effectiveUnits
      }
    } else {
      // Beach: prezzo sempre per posto ombrellone (non moltiplicabile per persone)
      units = 1
    }

    const dayTotal = type === 'hotel' && weighted
      ? Number(weighted.totalAmount || 0)
      : Number((dayPrice * units).toFixed(2))
    daysList.push({ 
      date: dateStr, 
      dayTotal,
      pricePerUnit: dayPrice,
      units,
      weighted
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
    roomType,
    pricingMode: type === 'hotel' ? hotelPricingPolicy.value.mode : 'place'
  }
}

const calculateOvernightTax = ({
  checkin,
  checkout,
  adults = 0,
  children = 0,
  kidsAges = [],
  policy = hotelPricingPolicy.value
} = {}) => {
  const taxPolicy = normalizeOvernightTax(policy?.overnightTax || {})
  const result = {
    enabled: taxPolicy.enabled,
    taxablePersons: 0,
    taxableDays: 0,
    amountPerPerson: taxPolicy.amountPerPerson,
    total: 0,
    breakdown: []
  }

  if (!taxPolicy.enabled || taxPolicy.amountPerPerson <= 0) return result

  const start = new Date(`${checkin}T00:00:00`)
  const end = new Date(`${checkout}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return result

  const safeAdults = Math.max(0, Number(adults || 0))
  const safeChildren = Math.max(0, Number(children || 0))

  let taxableChildren = 0
  for (let i = 0; i < safeChildren; i++) {
    const age = Number(Array.isArray(kidsAges) ? kidsAges[i] : NaN)
    const isExempt = Number.isFinite(age) && age < taxPolicy.childExemptUnderAge
    if (!isExempt) taxableChildren += 1
  }

  result.taxablePersons = safeAdults + taxableChildren
  if (result.taxablePersons <= 0) return result

  let current = new Date(start)
  while (current < end) {
    const dateStr = toISODate(current)
    let inRange = true
    if (!taxPolicy.allYear) {
      inRange = Boolean(taxPolicy.startDate && taxPolicy.endDate && dateStr >= taxPolicy.startDate && dateStr <= taxPolicy.endDate)
    }

    if (inRange) {
      const amount = Number((result.taxablePersons * taxPolicy.amountPerPerson).toFixed(2))
      result.breakdown.push({
        date: dateStr,
        persons: result.taxablePersons,
        amountPerPerson: taxPolicy.amountPerPerson,
        amount
      })
    }

    current.setDate(current.getDate() + 1)
  }

  if (!result.breakdown.length) return result

  const cappedBreakdown = result.breakdown.slice(0, taxPolicy.maxDays)
  result.breakdown = cappedBreakdown
  result.taxableDays = cappedBreakdown.length
  result.total = Number(cappedBreakdown.reduce((sum, day) => sum + Number(day.amount || 0), 0).toFixed(2))
  return result
}

export const usePricing = () => ({
  pricelists: computed(() => pricelists.value),
  timetables: computed(() => timetables.value),
  hotelPricingPolicy: computed(() => hotelPricingPolicy.value),
  loadPricelists,
  loadTimetable,
  loadHotelPricingPolicy,
  saveHotelPricingPolicy,
  getRoomTypes,
  toISODate,
  calculateDayPrice,
  calculateWeightedGuests,
  calculateQuotePrice,
  calculateOvernightTax
})
