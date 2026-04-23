<template>
  <div class="settings-page">
    <div class="header">
      <h1>Policy Prezzi Hotel</h1>
      <p>Configura la modalità globale di calcolo prezzi per l'hotel.</p>
    </div>

    <section class="card">
      <h2>Modalità Prezzo</h2>
      <div class="mode-grid">
        <label class="mode-card" :class="{ active: form.mode === 'room' }">
          <input v-model="form.mode" type="radio" value="room" />
          <span>Per camera</span>
          <small>La tariffa di listino è il prezzo camera/notte.</small>
        </label>

        <label class="mode-card" :class="{ active: form.mode === 'person' }">
          <input v-model="form.mode" type="radio" value="person" />
          <span>Per persona</span>
          <small>La tariffa di listino è il prezzo persona/notte.</small>
        </label>
      </div>
    </section>

    <section class="card">
      <h2>Age Bands Bambini</h2>
      <p class="hint">Ogni fascia può usare sconto percentuale oppure prezzo fisso (es. culla infant).</p>

      <div class="bands-table">
        <div class="bands-row bands-head">
          <span>Label</span>
          <span>Età Min</span>
          <span>Età Max</span>
          <span>Tipo</span>
          <span>Valore</span>
          <span></span>
        </div>

        <div v-for="(band, index) in form.ageBands" :key="index" class="bands-row">
          <input v-model="band.label" type="text" placeholder="es. Child" />
          <input v-model.number="band.minAge" type="number" min="0" />
          <input v-model.number="band.maxAge" type="number" min="0" />
          <select v-model="band.pricingType">
            <option value="discount">Sconto %</option>
            <option value="fixed">Prezzo fisso</option>
          </select>
          <input
            v-if="band.pricingType === 'discount'"
            v-model.number="band.discountPct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="%"
          />
          <input
            v-else
            v-model.number="band.fixedPrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="€"
          />
          <button type="button" class="btn btn-danger" @click="removeBand(index)">Rimuovi</button>
        </div>
      </div>

      <div class="actions-inline">
        <button type="button" class="btn btn-secondary" @click="addBand">+ Aggiungi Banda</button>
      </div>
    </section>

    <section class="card">
      <h2>Altri Parametri</h2>
      <div class="params-grid">
        <label>
          Fallback bambino senza età (sconto %)
          <input v-model.number="form.fallbackKidDiscountPct" type="number" min="0" max="100" step="0.01" />
        </label>
        <label>
          Letto aggiuntivo (sconto % sul prezzo intero)
          <input v-model.number="form.extraBedDiscountPct" type="number" min="0" max="100" step="0.01" />
        </label>
      </div>
    </section>

    <section class="card">
      <h2>Tassa di Soggiorno</h2>
      <div class="params-grid">
        <label class="checkbox-stack">
          <span>Abilita tassa</span>
          <input v-model="form.overnightTax.enabled" type="checkbox" />
        </label>

        <label class="checkbox-stack">
          <span>Applicazione tutto l'anno</span>
          <input v-model="form.overnightTax.allYear" type="checkbox" :disabled="!form.overnightTax.enabled" />
        </label>

        <label>
          Importo per persona/notte (€)
          <input
            v-model.number="form.overnightTax.amountPerPerson"
            type="number"
            min="0"
            step="0.01"
            :disabled="!form.overnightTax.enabled"
          />
        </label>

        <label>
          Esenzione bambini sotto età
          <input
            v-model.number="form.overnightTax.childExemptUnderAge"
            type="number"
            min="0"
            step="1"
            :disabled="!form.overnightTax.enabled"
          />
        </label>

        <label>
          Giorni massimi tassabili
          <input
            v-model.number="form.overnightTax.maxDays"
            type="number"
            min="1"
            step="1"
            :disabled="!form.overnightTax.enabled"
          />
        </label>

        <label>
          Inizio applicazione
          <input
            v-model="form.overnightTax.startDate"
            type="date"
            :disabled="!form.overnightTax.enabled || form.overnightTax.allYear"
          />
        </label>

        <label>
          Fine applicazione
          <input
            v-model="form.overnightTax.endDate"
            type="date"
            :disabled="!form.overnightTax.enabled || form.overnightTax.allYear"
          />
        </label>
      </div>
      <p class="hint tax-hint">
        La tassa viene salvata in policy ma non compare nei preventivi. Sara mostrata solo nel conto dedicato.
      </p>
    </section>

    <section class="card">
      <h2>Dati Struttura per Stampa A4</h2>
      <p class="hint">Questi dati vengono usati nell'intestazione ufficiale del conto stampato.</p>
      <div class="params-grid">
        <label>
          Nome struttura
          <input v-model="structureForm.name" type="text" placeholder="es. Hotel Riviera" />
        </label>
        <label>
          Indirizzo
          <input v-model="structureForm.address" type="text" placeholder="es. Via Roma 1" />
        </label>
        <label>
          Citta'
          <input v-model="structureForm.city" type="text" placeholder="es. Jesolo" />
        </label>
        <label>
          P.IVA
          <input v-model="structureForm.vatNumber" type="text" placeholder="es. IT01234567890" />
        </label>
        <label class="full-width">
          URL logo file
          <input v-model="structureForm.logoUrl" type="text" placeholder="es. https://dominio/logo.png" />
        </label>
      </div>
    </section>

    <section class="card beach-note">
      <h2>Nota modalità Beach</h2>
      <p>
        In modalità beach il prezzo è per posto ombrellone, equivalente al modello "per camera"
        lato hotel. Questa policy è fissa e non modificabile.
      </p>
    </section>

    <div class="footer-actions">
      <button type="button" class="btn btn-secondary" @click="loadForm" :disabled="loading">Ricarica</button>
      <button type="button" class="btn btn-primary" @click="save" :disabled="loading">Salva Policy</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { usePricing } from '@/composables/usePricing'

const { loadHotelPricingPolicy } = usePricing()

const loading = ref(false)
const form = ref({
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
  ageBands: []
})

const structureForm = ref({
  name: '',
  address: '',
  city: '',
  vatNumber: '',
  logoUrl: ''
})

const loadedHotelSection = ref({})

const normalizeForm = (value) => {
  let fallbackKidDiscountPct = Number(value?.fallbackKidDiscountPct)
  if (!Number.isFinite(fallbackKidDiscountPct)) fallbackKidDiscountPct = 0

  let extraBedDiscountPct = Number(value?.extraBedDiscountPct)
  if (!Number.isFinite(extraBedDiscountPct)) extraBedDiscountPct = 0

  const ageBands = Array.isArray(value?.ageBands)
    ? value.ageBands
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

  const rawTax = value?.overnightTax || value?.overnight_tax || {}
  let amountPerPerson = Number(rawTax?.amountPerPerson)
  if (!Number.isFinite(amountPerPerson)) amountPerPerson = 0

  let childExemptUnderAge = Number(rawTax?.childExemptUnderAge)
  if (!Number.isFinite(childExemptUnderAge)) childExemptUnderAge = 0

  let maxDays = Number(rawTax?.maxDays)
  if (!Number.isFinite(maxDays) || maxDays <= 0) maxDays = 10

  const overnightTax = {
    enabled: Boolean(rawTax?.enabled),
    allYear: rawTax?.allYear !== false,
    startDate: typeof rawTax?.startDate === 'string' ? rawTax.startDate : '',
    endDate: typeof rawTax?.endDate === 'string' ? rawTax.endDate : '',
    amountPerPerson: Math.max(0, Number(amountPerPerson.toFixed(2))),
    childExemptUnderAge: Math.max(0, Math.floor(childExemptUnderAge)),
    maxDays: Math.max(1, Math.floor(maxDays))
  }

  return {
    mode: String(value?.mode || '').toLowerCase() === 'person' ? 'person' : 'room',
    boardChargeMode: 'per_person',
    fallbackKidDiscountPct: Math.max(0, Math.min(100, fallbackKidDiscountPct)),
    extraBedDiscountPct: Math.max(0, Math.min(100, extraBedDiscountPct)),
    overnightTax,
    ageBands
  }
}

const normalizeStructureForm = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    name: String(source.name || source.businessName || '').trim(),
    address: String(source.address || source.street || '').trim(),
    city: String(source.city || '').trim(),
    vatNumber: String(source.vatNumber || source.vat || source.piva || '').trim(),
    logoUrl: String(source.logoUrl || source.logo || '').trim()
  }
}

const loadForm = async () => {
  loading.value = true
  try {
    await loadHotelPricingPolicy()
    const res = await axios.get('/api/pms/getconfigs?section=hotel')
    const hotelSection = res?.data && typeof res.data === 'object' ? res.data : {}
    loadedHotelSection.value = hotelSection
    form.value = normalizeForm(hotelSection?.pricing || hotelSection)
    structureForm.value = normalizeStructureForm(hotelSection?.structure)

  } catch (err) {
    console.error('Errore caricamento policy hotel:', err)
    alert('Errore caricamento policy prezzi')
  } finally {
    loading.value = false
  }
}

const addBand = () => {
  form.value.ageBands.push({
    label: '',
    minAge: 0,
    maxAge: 0,
    pricingType: 'discount',
    discountPct: 0,
    fixedPrice: 0
  })
}

const removeBand = (index) => {
  form.value.ageBands.splice(index, 1)
}

const save = async () => {
  loading.value = true
  try {
    const normalizedPricing = normalizeForm(form.value)
    const normalizedStructure = normalizeStructureForm(structureForm.value)
    const mergedSection = {
      ...(loadedHotelSection.value || {}),
      pricing: normalizedPricing,
      structure: normalizedStructure
    }

    await axios.post('/api/pms/setconfigs', {
      section: 'hotel',
      data: mergedSection
    })

    await loadHotelPricingPolicy()
    loadedHotelSection.value = mergedSection
    alert('Policy prezzi e dati struttura salvati correttamente')
  } catch (err) {
    console.error('Errore salvataggio policy hotel:', err)
    alert('Errore salvataggio configurazione hotel')
  } finally {
    loading.value = false
  }
}

onMounted(loadForm)
</script>

<style scoped>
.settings-page {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header h1 {
  margin: 0;
  color: #0f172a;
}

.header p {
  margin: 4px 0 0;
  color: #475569;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.card h2 {
  margin: 0 0 8px;
  color: #1e293b;
}

.hint {
  margin: 0 0 12px;
  color: #64748b;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.mode-card {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mode-card.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.mode-card input {
  align-self: flex-start;
}

.bands-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bands-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.2fr 1.4fr auto;
  gap: 8px;
}

.bands-row input,
.bands-row select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
}

.bands-head {
  font-weight: 700;
  color: #475569;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.params-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #334155;
}

.checkbox-stack input {
  align-self: flex-start;
}

.params-grid input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
}

.params-grid select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
}

.full-width {
  grid-column: 1 / -1;
}

.actions-inline {
  margin-top: 12px;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 9px 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-secondary {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #cbd5e1;
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fecaca;
}

.beach-note p {
  margin: 0;
  color: #334155;
}

.tax-hint {
  margin-top: 12px;
}

@media (max-width: 800px) {
  .bands-row {
    grid-template-columns: 1fr;
  }
}
</style>
