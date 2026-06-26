<template>
  <div class="daily-menu-composer">
    <div class="composer-header">
      <div>
        <h2 class="composer-title">Composizione menu del giorno</h2>
      </div>

      <div class="header-actions">
        <button class="btn-pdf" type="button" :disabled="!hasMenuItems || isExportingPdf" @click="exportPdf">
          {{ isExportingPdf ? 'Esportazione PDF...' : 'Scarica PDF' }}
        </button>

        <button class="btn-print" type="button" :disabled="!hasMenuItems" @click="printMenu">
          Stampa A4
        </button>
      </div>
    </div>

    <div class="tabs-nav" role="radiogroup" aria-label="Tipo menu">
      <label
        class="tab-btn"
        :class="{ active: menuType === 'extra' }"
      >
        <input v-model="menuType" class="hidden-radio" type="radio" value="extra" />
        Menu extra
      </label>
      <label
        class="tab-btn"
        :class="{ active: menuType === 'sala' }"
      >
        <input v-model="menuType" class="hidden-radio" type="radio" value="sala" />
        Menù sala
      </label>
    </div>

    <div v-if="isSalaMenu" class="sala-options">
      <div class="tabs-nav meal-tabs" role="radiogroup" aria-label="Pasto menù sala">
        <label
          class="tab-btn"
          :class="{ active: activeSalaMeal === 'lunch' }"
        >
          <input v-model="activeSalaMeal" class="hidden-radio" type="radio" value="lunch" />
          Pranzo
        </label>
        <label
          class="tab-btn"
          :class="{ active: activeSalaMeal === 'dinner' }"
        >
          <input v-model="activeSalaMeal" class="hidden-radio" type="radio" value="dinner" />
          Cena
        </label>
      </div>

      <div class="tabs-nav date-tabs" role="radiogroup" aria-label="Data menù sala">
        <label
          class="tab-btn"
          :class="{ active: salaDateMode === 'today' }"
        >
          <input v-model="salaDateMode" class="hidden-radio" type="radio" value="today" />
          Oggi
        </label>
        <label
          class="tab-btn"
          :class="{ active: salaDateMode === 'tomorrow' }"
        >
          <input v-model="salaDateMode" class="hidden-radio" type="radio" value="tomorrow" />
          Domani
        </label>
      </div>

      <div class="tabs-nav language-tabs" role="radiogroup" aria-label="Lingua menù sala">
        <label
          class="tab-btn"
          :class="{ active: activeSalaLanguage === 'it' }"
        >
          <input v-model="activeSalaLanguage" class="hidden-radio" type="radio" value="it" />
          Italiano
        </label>
        <label
          class="tab-btn"
          :class="{ active: activeSalaLanguage === 'de' }"
        >
          <input v-model="activeSalaLanguage" class="hidden-radio" type="radio" value="de" />
          Tedesco
        </label>
        <label
          class="tab-btn"
          :class="{ active: activeSalaLanguage === 'en' }"
        >
          <input v-model="activeSalaLanguage" class="hidden-radio" type="radio" value="en" />
          Inglese
        </label>
        <label
          class="tab-btn"
          :class="{ active: activeSalaLanguage === 'other' }"
        >
          <input v-model="activeSalaLanguage" class="hidden-radio" type="radio" value="other" />
          Altro
        </label>
      </div>
    </div>

    <div v-else class="sala-options">
      <div class="tabs-nav language-tabs" role="radiogroup" aria-label="Lingua menù extra">
        <label
          class="tab-btn"
          :class="{ active: activeExtraLanguage === 'it' }"
        >
          <input v-model="activeExtraLanguage" class="hidden-radio" type="radio" value="it" />
          Italiano
        </label>
        <label
          class="tab-btn"
          :class="{ active: activeExtraLanguage === 'de' }"
        >
          <input v-model="activeExtraLanguage" class="hidden-radio" type="radio" value="de" />
          Tedesco
        </label>
        <label
          class="tab-btn"
          :class="{ active: activeExtraLanguage === 'en' }"
        >
          <input v-model="activeExtraLanguage" class="hidden-radio" type="radio" value="en" />
          Inglese
        </label>
      </div>
    </div>

    <div class="composer-grid">
      <section class="editor-card">
        <div class="card-heading">
          <h3>{{ activeEditorTranslation.sections.primi }}</h3>
          <span>{{ compiledPrimi.length }}/{{ rowCount }}</span>
        </div>

        <div v-for="(row, index) in activePrimiRows" :key="`primo-${index}`" class="menu-row" :class="{ 'menu-row-sala': isSalaMenu }">
          <label :for="`primo-desc-${index}`" class="sr-only">{{ activeEditorTranslation.fields.primo }} {{ index + 1 }}</label>
          <input
            :id="`primo-desc-${index}`"
            v-model="row.description"
            type="text"
            class="row-description"
            :placeholder="`${activeEditorTranslation.placeholders.primo} ${index + 1}`"
          />

          <label :for="`primo-price-${index}`" class="sr-only">{{ activeEditorTranslation.fields.prezzoPrimo }} {{ index + 1 }}</label>
          <input
            v-if="!isSalaMenu"
            :id="`primo-price-${index}`"
            v-model="row.price"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            class="row-price"
            placeholder="0.00"
          />
        </div>
      </section>

      <section class="editor-card">
        <div class="card-heading">
          <h3>{{ activeEditorTranslation.sections.secondi }}</h3>
          <span>{{ compiledSecondi.length }}/{{ rowCount }}</span>
        </div>

        <div v-for="(row, index) in activeSecondiRows" :key="`secondo-${index}`" class="menu-row" :class="{ 'menu-row-sala': isSalaMenu }">
          <label :for="`secondo-desc-${index}`" class="sr-only">{{ activeEditorTranslation.fields.secondo }} {{ index + 1 }}</label>
          <input
            :id="`secondo-desc-${index}`"
            v-model="row.description"
            type="text"
            class="row-description"
            :placeholder="`${activeEditorTranslation.placeholders.secondo} ${index + 1}`"
          />

          <label :for="`secondo-price-${index}`" class="sr-only">{{ activeEditorTranslation.fields.prezzoSecondo }} {{ index + 1 }}</label>
          <input
            v-if="!isSalaMenu"
            :id="`secondo-price-${index}`"
            v-model="row.price"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            class="row-price"
            placeholder="0.00"
          />
        </div>
      </section>
    </div>

    <p v-if="hasExcludedRows" class="helper-note">
      Alcune righe sono incomplete e sono state escluse dall'anteprima.
    </p>

    <section class="preview-card">
      <div class="card-heading card-heading-preview">
        <div>
          <h3>Anteprima</h3>
        </div>
        <span v-if="hasMenuItems">{{ totalCompiledRows }} piatti pronti</span>
      </div>

      <div v-if="hasMenuItems" class="preview-stage">
        <iframe
          ref="previewFrame"
          class="preview-frame"
          :srcdoc="previewHtml"
          title="Anteprima menu del giorno"
        />
      </div>

      <div v-else class="preview-empty">
        Compila almeno una riga completa per visualizzare l'anteprima del menu.
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import menuTemplate from '@/menu/assets/menu-hotel.html?raw'
import dailyMenuTemplate from '@/menu/assets/menu-hotel-giornaliero.html?raw'
import logoUrl from '@/menu/assets/logo.png'
import interrazzaLogoUrl from '@/menu/assets/interrazza.png'

const MENU_ENDPOINT = '/api/menu'
const rowCount = 6
const a4Scale = (210 / 148).toFixed(4)
const storageKey = 'daily-menu-composer-data'
const previewFrame = ref(null)
const isExportingPdf = ref(false)
const isRestoringBackendMenu = ref(false)
const menuType = ref('extra')
const activeSalaMeal = ref('lunch')
const salaDateMode = ref('tomorrow')
const activeSalaLanguage = ref('it')
const activeExtraLanguage = ref('it')

const createEmptyRows = () => Array.from({ length: rowCount }, () => ({ description: '', price: '' }))

const primiRows = ref(createEmptyRows())
const secondiRows = ref(createEmptyRows())
const extraDePrimiRows = ref(createEmptyRows())
const extraDeSecondiRows = ref(createEmptyRows())
const extraEnPrimiRows = ref(createEmptyRows())
const extraEnSecondiRows = ref(createEmptyRows())
const salaLunchPrimiRows = ref(createEmptyRows())
const salaLunchSecondiRows = ref(createEmptyRows())
const salaDinnerPrimiRows = ref(createEmptyRows())
const salaDinnerSecondiRows = ref(createEmptyRows())
const salaDeLunchPrimiRows = ref(createEmptyRows())
const salaDeLunchSecondiRows = ref(createEmptyRows())
const salaDeDinnerPrimiRows = ref(createEmptyRows())
const salaDeDinnerSecondiRows = ref(createEmptyRows())
const salaEnLunchPrimiRows = ref(createEmptyRows())
const salaEnLunchSecondiRows = ref(createEmptyRows())
const salaEnDinnerPrimiRows = ref(createEmptyRows())
const salaEnDinnerSecondiRows = ref(createEmptyRows())
const salaOtherLunchPrimiRows = ref(createEmptyRows())
const salaOtherLunchSecondiRows = ref(createEmptyRows())
const salaOtherDinnerPrimiRows = ref(createEmptyRows())
const salaOtherDinnerSecondiRows = ref(createEmptyRows())

const salaRowsByLanguage = {
  it: {
    lunch: {
      primi: salaLunchPrimiRows,
      secondi: salaLunchSecondiRows
    },
    dinner: {
      primi: salaDinnerPrimiRows,
      secondi: salaDinnerSecondiRows
    }
  },
  de: {
    lunch: {
      primi: salaDeLunchPrimiRows,
      secondi: salaDeLunchSecondiRows
    },
    dinner: {
      primi: salaDeDinnerPrimiRows,
      secondi: salaDeDinnerSecondiRows
    }
  },
  en: {
    lunch: {
      primi: salaEnLunchPrimiRows,
      secondi: salaEnLunchSecondiRows
    },
    dinner: {
      primi: salaEnDinnerPrimiRows,
      secondi: salaEnDinnerSecondiRows
    }
  },
  other: {
    lunch: {
      primi: salaOtherLunchPrimiRows,
      secondi: salaOtherLunchSecondiRows
    },
    dinner: {
      primi: salaOtherDinnerPrimiRows,
      secondi: salaOtherDinnerSecondiRows
    }
  }
}

const extraRowsByLanguage = {
  it: {
    primi: primiRows,
    secondi: secondiRows
  },
  de: {
    primi: extraDePrimiRows,
    secondi: extraDeSecondiRows
  },
  en: {
    primi: extraEnPrimiRows,
    secondi: extraEnSecondiRows
  }
}

const extraTranslations = {
  it: {
    menuTitle: 'Una selezione dalla nostra cucina',
    sections: {
      primi: 'Primi',
      secondi: 'Secondi'
    },
    placeholders: {
      primo: 'Primo',
      secondo: 'Secondo'
    },
    fields: {
      primo: 'Descrizione primo',
      secondo: 'Descrizione secondo',
      prezzoPrimo: 'Prezzo primo',
      prezzoSecondo: 'Prezzo secondo'
    },
    allergensTitle: 'Informazioni sugli allergeni:',
    allergensText: 'I nostri piatti possono contenere: Cereali con glutine, Uova, Pesce, Latte, Frutta a guscio, Sedano, Senape.',
    allergensNotice: 'Si prega di comunicare eventuali intolleranze o allergie al nostro personale.'
  },
  de: {
    menuTitle: 'Eine Auswahl aus unserer Küche',
    sections: {
      primi: 'Erste Gänge',
      secondi: 'Hauptgerichte'
    },
    placeholders: {
      primo: 'Erster Gang',
      secondo: 'Hauptgericht'
    },
    fields: {
      primo: 'Beschreibung erster Gang',
      secondo: 'Beschreibung Hauptgericht',
      prezzoPrimo: 'Preis erster Gang',
      prezzoSecondo: 'Preis Hauptgericht'
    },
    allergensTitle: 'Informationen zu Allergenen:',
    allergensText: 'Unsere Gerichte können enthalten: glutenhaltiges Getreide, Eier, Fisch, Milch, Schalenfrüchte, Sellerie und Senf.',
    allergensNotice: 'Bitte informieren Sie unser Personal über eventuelle Unverträglichkeiten oder Allergien.'
  },
  en: {
    menuTitle: 'A selection from our kitchen',
    sections: {
      primi: 'First courses',
      secondi: 'Main courses'
    },
    placeholders: {
      primo: 'First course',
      secondo: 'Main course'
    },
    fields: {
      primo: 'First course description',
      secondo: 'Main course description',
      prezzoPrimo: 'First course price',
      prezzoSecondo: 'Main course price'
    },
    allergensTitle: 'Allergen information:',
    allergensText: 'Our dishes may contain: cereals containing gluten, eggs, fish, milk, nuts, celery and mustard.',
    allergensNotice: 'Please inform our staff of any intolerances or allergies.'
  }
}

const salaTranslations = {
  it: {
    locale: 'it-IT',
    meals: {
      lunch: 'Pranzo',
      dinner: 'Cena'
    },
    roomLabel: 'camera',
    portionLabels: 'norm.&nbsp;&nbsp;&nbsp;&nbsp;rid.',
    allergensTitle: 'Informazioni sugli allergeni:',
    allergensText: 'I nostri piatti possono contenere: cereali con glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta a guscio, sedano, senape, sesamo, solfiti, lupini e molluschi.',
    footer: 'Si prega di comunicare eventuali intolleranze o allergie al nostro personale'
  },
  de: {
    locale: 'de-DE',
    meals: {
      lunch: 'Mittagessen',
      dinner: 'Abendessen'
    },
    roomLabel: 'zimmer',
    portionLabels: 'norm.&nbsp;&nbsp;&nbsp;&nbsp;red.',
    allergensTitle: 'Informationen zu Allergenen:',
    allergensText: 'Unsere Gerichte können enthalten: glutenhaltiges Getreide, Krebstiere, Eier, Fisch, Erdnüsse, Soja, Milch, Schalenfrüchte, Sellerie, Senf, Sesam, Sulfite, Lupinen und Weichtiere.',
    footer: 'Bitte informieren Sie unser Personal über eventuelle Unverträglichkeiten oder Allergien'
  },
  en: {
    locale: 'en-GB',
    meals: {
      lunch: 'Lunch',
      dinner: 'Dinner'
    },
    roomLabel: 'room',
    portionLabels: 'reg.&nbsp;&nbsp;&nbsp;&nbsp;red.',
    allergensTitle: 'Allergen information:',
    allergensText: 'Our dishes may contain: cereals containing gluten, crustaceans, eggs, fish, peanuts, soy, milk, nuts, celery, mustard, sesame, sulphites, lupin and molluscs.',
    footer: 'Please inform our staff of any intolerances or allergies'
  },
  other: {
    locale: 'en-GB',
    meals: {
      lunch: 'Lunch',
      dinner: 'Dinner'
    },
    roomLabel: 'room',
    portionLabels: 'reg.&nbsp;&nbsp;&nbsp;&nbsp;red.',
    allergensTitle: 'Allergen information:',
    allergensText: 'Our dishes may contain: cereals containing gluten, crustaceans, eggs, fish, peanuts, soy, milk, nuts, celery, mustard, sesame, sulphites, lupin and molluscs.',
    footer: 'Please inform our staff of any intolerances or allergies'
  }
}

onMounted(async () => {
  restoreDraft()
  await loadPersistedSalaMenu()
})

watch([
  menuType,
  activeSalaMeal,
  salaDateMode,
  activeSalaLanguage,
  activeExtraLanguage,
  primiRows,
  secondiRows,
  extraDePrimiRows,
  extraDeSecondiRows,
  extraEnPrimiRows,
  extraEnSecondiRows,
  salaLunchPrimiRows,
  salaLunchSecondiRows,
  salaDinnerPrimiRows,
  salaDinnerSecondiRows,
  salaDeLunchPrimiRows,
  salaDeLunchSecondiRows,
  salaDeDinnerPrimiRows,
  salaDeDinnerSecondiRows,
  salaEnLunchPrimiRows,
  salaEnLunchSecondiRows,
  salaEnDinnerPrimiRows,
  salaEnDinnerSecondiRows,
  salaOtherLunchPrimiRows,
  salaOtherLunchSecondiRows,
  salaOtherDinnerPrimiRows,
  salaOtherDinnerSecondiRows
], () => {
  if (isRestoringBackendMenu.value) {
    return
  }

  persistDraft()
}, { deep: true })

watch([menuType, salaDateMode], async () => {
  await loadPersistedSalaMenu()
})

const normalizeRows = rows => rows.map(row => ({
  description: row.description.trim(),
  price: row.price === '' ? '' : String(row.price).trim()
}))

const isSalaMenu = computed(() => menuType.value === 'sala')
const activeSalaPrimiRows = computed(() => getSalaRows(activeSalaLanguage.value, activeSalaMeal.value).primi.value)
const activeSalaSecondiRows = computed(() => getSalaRows(activeSalaLanguage.value, activeSalaMeal.value).secondi.value)
const activeExtraPrimiRows = computed(() => getExtraRows(activeExtraLanguage.value).primi.value)
const activeExtraSecondiRows = computed(() => getExtraRows(activeExtraLanguage.value).secondi.value)
const activePrimiRows = computed(() => isSalaMenu.value ? activeSalaPrimiRows.value : activeExtraPrimiRows.value)
const activeSecondiRows = computed(() => isSalaMenu.value ? activeSalaSecondiRows.value : activeExtraSecondiRows.value)
const activeEditorTranslation = computed(() => isSalaMenu.value
  ? extraTranslations.it
  : getExtraTranslation())
const compiledPrimi = computed(() => normalizeRows(activePrimiRows.value).filter(isCompleteRow))
const compiledSecondi = computed(() => normalizeRows(activeSecondiRows.value).filter(isCompleteRow))
const compiledSalaLunchPrimi = computed(() => normalizeRows(getSalaRows(activeSalaLanguage.value, 'lunch').primi.value).filter(isSalaCompleteRow))
const compiledSalaLunchSecondi = computed(() => normalizeRows(getSalaRows(activeSalaLanguage.value, 'lunch').secondi.value).filter(isSalaCompleteRow))
const compiledSalaDinnerPrimi = computed(() => normalizeRows(getSalaRows(activeSalaLanguage.value, 'dinner').primi.value).filter(isSalaCompleteRow))
const compiledSalaDinnerSecondi = computed(() => normalizeRows(getSalaRows(activeSalaLanguage.value, 'dinner').secondi.value).filter(isSalaCompleteRow))

const totalCompiledRows = computed(() => {
  if (isSalaMenu.value) {
    return compiledSalaLunchPrimi.value.length +
      compiledSalaLunchSecondi.value.length +
      compiledSalaDinnerPrimi.value.length +
      compiledSalaDinnerSecondi.value.length
  }

  return compiledPrimi.value.length + compiledSecondi.value.length
})
const hasMenuItems = computed(() => totalCompiledRows.value > 0)
const hasExcludedRows = computed(() => {
  if (isSalaMenu.value) {
    return false
  }

  const allRows = [...normalizeRows(activeExtraPrimiRows.value), ...normalizeRows(activeExtraSecondiRows.value)]
  return allRows.some(row => (row.description && !row.price) || (!row.description && row.price))
})

const previewHtml = computed(() => buildMenuDocument({
  primi: compiledPrimi.value,
  secondi: compiledSecondi.value,
  forPrint: false,
  autoPrint: false
}))

function resolveAssetUrl(assetUrl) {
  return new URL(assetUrl, window.location.href).href
}

function resolveTemplateLogoUrl(logo) {
  const templateSrc = logo.getAttribute('src') || ''

  if (templateSrc.includes('interrazza')) {
    return resolveAssetUrl(interrazzaLogoUrl)
  }

  return resolveAssetUrl(logoUrl)
}

function getSalaRows(language, meal) {
  return salaRowsByLanguage[language]?.[meal] || salaRowsByLanguage.it.lunch
}

function getExtraRows(language) {
  return extraRowsByLanguage[language] || extraRowsByLanguage.it
}

function getExtraTranslation() {
  return extraTranslations[activeExtraLanguage.value] || extraTranslations.it
}

function getSalaTranslation() {
  return salaTranslations[activeSalaLanguage.value] || salaTranslations.it
}

function getSalaWeekday() {
  return [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ][getSalaMenuDate().getDay()]
}

function isSalaCompleteRow(row) {
  return Boolean(row.description)
}

function isCompleteRow(row) {
  if (isSalaMenu.value) {
    return isSalaCompleteRow(row)
  }

  return Boolean(row.description && row.price)
}

function sanitizeStoredRows(rows) {
  if (!Array.isArray(rows)) {
    return createEmptyRows()
  }

  const sanitized = rows.slice(0, rowCount).map(row => ({
    description: typeof row?.description === 'string' ? row.description : '',
    price: row?.price === null || row?.price === undefined ? '' : String(row.price)
  }))

  while (sanitized.length < rowCount) {
    sanitized.push({ description: '', price: '' })
  }

  return sanitized
}

function cloneRows(rows) {
  return sanitizeStoredRows(rows)
}

function serializeRows(rows) {
  return normalizeRows(rows).map(row => ({
    description: row.description,
    price: row.price
  }))
}

function buildSalaMenuSnapshot() {
  return {
    version: 1,
    type: 'sala',
    dateMode: salaDateMode.value,
    languages: {
      it: {
        lunch: {
          primi: serializeRows(salaLunchPrimiRows.value),
          secondi: serializeRows(salaLunchSecondiRows.value)
        },
        dinner: {
          primi: serializeRows(salaDinnerPrimiRows.value),
          secondi: serializeRows(salaDinnerSecondiRows.value)
        }
      },
      de: {
        lunch: {
          primi: serializeRows(salaDeLunchPrimiRows.value),
          secondi: serializeRows(salaDeLunchSecondiRows.value)
        },
        dinner: {
          primi: serializeRows(salaDeDinnerPrimiRows.value),
          secondi: serializeRows(salaDeDinnerSecondiRows.value)
        }
      },
      en: {
        lunch: {
          primi: serializeRows(salaEnLunchPrimiRows.value),
          secondi: serializeRows(salaEnLunchSecondiRows.value)
        },
        dinner: {
          primi: serializeRows(salaEnDinnerPrimiRows.value),
          secondi: serializeRows(salaEnDinnerSecondiRows.value)
        }
      },
      other: {
        lunch: {
          primi: serializeRows(salaOtherLunchPrimiRows.value),
          secondi: serializeRows(salaOtherLunchSecondiRows.value)
        },
        dinner: {
          primi: serializeRows(salaOtherDinnerPrimiRows.value),
          secondi: serializeRows(salaOtherDinnerSecondiRows.value)
        }
      }
    }
  }
}

function applySalaMenuSnapshot(menu) {
  const languages = menu?.languages && typeof menu.languages === 'object' ? menu.languages : {}

  salaLunchPrimiRows.value = cloneRows(languages.it?.lunch?.primi)
  salaLunchSecondiRows.value = cloneRows(languages.it?.lunch?.secondi)
  salaDinnerPrimiRows.value = cloneRows(languages.it?.dinner?.primi)
  salaDinnerSecondiRows.value = cloneRows(languages.it?.dinner?.secondi)
  salaDeLunchPrimiRows.value = cloneRows(languages.de?.lunch?.primi)
  salaDeLunchSecondiRows.value = cloneRows(languages.de?.lunch?.secondi)
  salaDeDinnerPrimiRows.value = cloneRows(languages.de?.dinner?.primi)
  salaDeDinnerSecondiRows.value = cloneRows(languages.de?.dinner?.secondi)
  salaEnLunchPrimiRows.value = cloneRows(languages.en?.lunch?.primi)
  salaEnLunchSecondiRows.value = cloneRows(languages.en?.lunch?.secondi)
  salaEnDinnerPrimiRows.value = cloneRows(languages.en?.dinner?.primi)
  salaEnDinnerSecondiRows.value = cloneRows(languages.en?.dinner?.secondi)
  salaOtherLunchPrimiRows.value = cloneRows(languages.other?.lunch?.primi)
  salaOtherLunchSecondiRows.value = cloneRows(languages.other?.lunch?.secondi)
  salaOtherDinnerPrimiRows.value = cloneRows(languages.other?.dinner?.primi)
  salaOtherDinnerSecondiRows.value = cloneRows(languages.other?.dinner?.secondi)
}

function getSalaMenuIsoDate() {
  const date = getSalaMenuDate()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

async function loadPersistedSalaMenu() {
  if (typeof window === 'undefined' || !isSalaMenu.value) {
    return
  }

  isRestoringBackendMenu.value = true

  try {
    const { data } = await axios.get(MENU_ENDPOINT, {
      params: {
        weekday: getSalaWeekday()
      }
    })

    applySalaMenuSnapshot(data?.menu || null)
    persistDraft()
  } catch (error) {
    console.warn('Impossibile caricare il menù sala persistito:', error)
  } finally {
    isRestoringBackendMenu.value = false
  }
}

async function persistPrintedSalaMenu() {
  if (!isSalaMenu.value) {
    return
  }

  await axios.post(MENU_ENDPOINT, {
    weekday: getSalaWeekday(),
    date: getSalaMenuIsoDate(),
    menu: buildSalaMenuSnapshot()
  })
}

function persistDraft() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify({
    menuType: menuType.value,
    activeSalaMeal: activeSalaMeal.value,
    salaDateMode: salaDateMode.value,
    activeSalaLanguage: activeSalaLanguage.value,
    activeExtraLanguage: activeExtraLanguage.value,
    primi: primiRows.value,
    secondi: secondiRows.value,
    extraTranslations: {
      de: {
        primi: extraDePrimiRows.value,
        secondi: extraDeSecondiRows.value
      },
      en: {
        primi: extraEnPrimiRows.value,
        secondi: extraEnSecondiRows.value
      }
    },
    salaLunchPrimi: salaLunchPrimiRows.value,
    salaLunchSecondi: salaLunchSecondiRows.value,
    salaDinnerPrimi: salaDinnerPrimiRows.value,
    salaDinnerSecondi: salaDinnerSecondiRows.value,
    salaTranslations: {
      de: {
        lunchPrimi: salaDeLunchPrimiRows.value,
        lunchSecondi: salaDeLunchSecondiRows.value,
        dinnerPrimi: salaDeDinnerPrimiRows.value,
        dinnerSecondi: salaDeDinnerSecondiRows.value
      },
      en: {
        lunchPrimi: salaEnLunchPrimiRows.value,
        lunchSecondi: salaEnLunchSecondiRows.value,
        dinnerPrimi: salaEnDinnerPrimiRows.value,
        dinnerSecondi: salaEnDinnerSecondiRows.value
      },
      other: {
        lunchPrimi: salaOtherLunchPrimiRows.value,
        lunchSecondi: salaOtherLunchSecondiRows.value,
        dinnerPrimi: salaOtherDinnerPrimiRows.value,
        dinnerSecondi: salaOtherDinnerSecondiRows.value
      }
    }
  }))
}

function restoreDraft() {
  if (typeof window === 'undefined') {
    return
  }

  const savedDraft = window.localStorage.getItem(storageKey)

  if (!savedDraft) {
    return
  }

  try {
    const parsedDraft = JSON.parse(savedDraft)
    menuType.value = parsedDraft?.menuType === 'sala' ? 'sala' : 'extra'
    activeSalaMeal.value = parsedDraft?.activeSalaMeal === 'dinner' ? 'dinner' : 'lunch'
    salaDateMode.value = parsedDraft?.salaDateMode === 'today' ? 'today' : 'tomorrow'
    activeSalaLanguage.value = ['it', 'de', 'en', 'other'].includes(parsedDraft?.activeSalaLanguage) ? parsedDraft.activeSalaLanguage : 'it'
    activeExtraLanguage.value = ['it', 'de', 'en'].includes(parsedDraft?.activeExtraLanguage) ? parsedDraft.activeExtraLanguage : 'it'
    primiRows.value = sanitizeStoredRows(parsedDraft?.primi)
    secondiRows.value = sanitizeStoredRows(parsedDraft?.secondi)
    extraDePrimiRows.value = sanitizeStoredRows(parsedDraft?.extraTranslations?.de?.primi)
    extraDeSecondiRows.value = sanitizeStoredRows(parsedDraft?.extraTranslations?.de?.secondi)
    extraEnPrimiRows.value = sanitizeStoredRows(parsedDraft?.extraTranslations?.en?.primi)
    extraEnSecondiRows.value = sanitizeStoredRows(parsedDraft?.extraTranslations?.en?.secondi)
    salaLunchPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaLunchPrimi ?? parsedDraft?.salaPrimi)
    salaLunchSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaLunchSecondi ?? parsedDraft?.salaSecondi)
    salaDinnerPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaDinnerPrimi)
    salaDinnerSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaDinnerSecondi)
    salaDeLunchPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.de?.lunchPrimi)
    salaDeLunchSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.de?.lunchSecondi)
    salaDeDinnerPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.de?.dinnerPrimi)
    salaDeDinnerSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.de?.dinnerSecondi)
    salaEnLunchPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.en?.lunchPrimi)
    salaEnLunchSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.en?.lunchSecondi)
    salaEnDinnerPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.en?.dinnerPrimi)
    salaEnDinnerSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.en?.dinnerSecondi)
    salaOtherLunchPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.other?.lunchPrimi)
    salaOtherLunchSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.other?.lunchSecondi)
    salaOtherDinnerPrimiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.other?.dinnerPrimi)
    salaOtherDinnerSecondiRows.value = sanitizeStoredRows(parsedDraft?.salaTranslations?.other?.dinnerSecondi)
  } catch (error) {
    console.warn('Bozza menu del giorno non valida nello storage locale:', error)
    primiRows.value = createEmptyRows()
    secondiRows.value = createEmptyRows()
    extraDePrimiRows.value = createEmptyRows()
    extraDeSecondiRows.value = createEmptyRows()
    extraEnPrimiRows.value = createEmptyRows()
    extraEnSecondiRows.value = createEmptyRows()
    salaLunchPrimiRows.value = createEmptyRows()
    salaLunchSecondiRows.value = createEmptyRows()
    salaDinnerPrimiRows.value = createEmptyRows()
    salaDinnerSecondiRows.value = createEmptyRows()
    salaDeLunchPrimiRows.value = createEmptyRows()
    salaDeLunchSecondiRows.value = createEmptyRows()
    salaDeDinnerPrimiRows.value = createEmptyRows()
    salaDeDinnerSecondiRows.value = createEmptyRows()
    salaEnLunchPrimiRows.value = createEmptyRows()
    salaEnLunchSecondiRows.value = createEmptyRows()
    salaEnDinnerPrimiRows.value = createEmptyRows()
    salaEnDinnerSecondiRows.value = createEmptyRows()
    salaOtherLunchPrimiRows.value = createEmptyRows()
    salaOtherLunchSecondiRows.value = createEmptyRows()
    salaOtherDinnerPrimiRows.value = createEmptyRows()
    salaOtherDinnerSecondiRows.value = createEmptyRows()
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatPrice(price) {
  const amount = Number(price)

  if (Number.isNaN(amount)) {
    return `${price} €`
  }

  const hasDecimals = Math.abs(amount % 1) > 0

  return `${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  }).format(amount)} €`
}

function buildExtraItemsMarkup(items) {
  return items
    .map(item => `
      <div class="menu-item">
        <div class="item-info">
          <span class="item-name">${escapeHtml(item.description)}</span>
        </div>
        <span class="item-price">${escapeHtml(formatPrice(item.price))}</span>
      </div>
    `)
    .join('')
}

function buildDividerMarkup() {
  return `
    <div class="deco-icon">
      <svg width="40" height="15" viewBox="0 0 100 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="8" width="80" height="2" rx="1" fill="#8eb3c7" />
        <circle cx="50" cy="9" r="4" fill="#b8cfde" />
      </svg>
    </div>
  `
}

function buildMenuDocument({ primi, secondi, forPrint, autoPrint = false }) {
  if (isSalaMenu.value) {
    return buildSalaMenuPreviewDocument({
      lunchPrimi: compiledSalaLunchPrimi.value,
      lunchSecondi: compiledSalaLunchSecondi.value,
      dinnerPrimi: compiledSalaDinnerPrimi.value,
      dinnerSecondi: compiledSalaDinnerSecondi.value,
      forPrint,
      autoPrint
    })
  }

  return buildExtraMenuDocument({ primi, secondi, forPrint, autoPrint })
}

function buildExtraMenuDocument({ primi, secondi, forPrint, autoPrint = false }) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(menuTemplate, 'text/html')
  const container = doc.querySelector('.menu-container')
  const logo = doc.querySelector('.logo-area img')
  const menuSection = container?.querySelector('.menu-section')
  const sectionTitle = menuSection?.querySelector('.section-title')
  const dividers = menuSection ? Array.from(menuSection.querySelectorAll('.deco-icon')) : []
  const translation = getExtraTranslation()

  if (!container || !logo || !menuSection || !dividers.length) {
    return menuTemplate
  }

  doc.documentElement.lang = activeExtraLanguage.value
  logo.src = resolveTemplateLogoUrl(logo)

  if (sectionTitle) {
    sectionTitle.textContent = translation.menuTitle
  }

  const fixedSectionDivider = dividers[1] || null
  let reachedFixedSection = false

  Array.from(menuSection.children).forEach(child => {
    if (child === fixedSectionDivider) {
      reachedFixedSection = true
      return
    }

    if (!reachedFixedSection && child.classList.contains('menu-item')) {
      child.remove()
    }
  })

  dividers[0].insertAdjacentHTML('beforebegin', buildExtraItemsMarkup(primi))

  if (fixedSectionDivider) {
    fixedSectionDivider.insertAdjacentHTML('beforebegin', buildExtraItemsMarkup(secondi))
  } else {
    dividers[0].insertAdjacentHTML('afterend', buildExtraItemsMarkup(secondi))
  }

  const allergens = container.querySelector('.allergeni-legenda')

  if (allergens) {
    allergens.innerHTML = `
      <span class="allergeni-titolo">${escapeHtml(translation.allergensTitle)}</span>
      ${escapeHtml(translation.allergensText)}
      <br><i>${escapeHtml(translation.allergensNotice)}</i>
    `
  }

  const wrapperClass = forPrint ? 'print-mode' : 'preview-mode'
  const pageMarkup = forPrint
    ? `<div class="a4-landscape-page">${container.outerHTML}${container.outerHTML}</div>`
    : container.outerHTML

  doc.body.className = wrapperClass
  doc.body.innerHTML = pageMarkup

  const extraStyles = doc.createElement('style')
  extraStyles.textContent = `
    body.preview-mode {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 18px;
      background: #edf3f6;
    }

    body.preview-mode .menu-container {
      box-shadow: 0 24px 54px rgba(79, 101, 116, 0.16);
    }

    body.print-mode {
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    body.print-mode .a4-landscape-page {
      width: 297mm;
      height: 210mm;
      overflow: hidden;
      display: grid;
      grid-template-columns: repeat(2, 148mm);
      justify-content: space-between;
      align-items: start;
      background: #ffffff;
      page-break-after: always;
      break-after: page;
    }

    body.print-mode .a4-landscape-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    body.print-mode .menu-container {
      margin: 0;
    }

    @page {
      size: A4 landscape;
      margin: 0;
    }
  `
  doc.head.appendChild(extraStyles)

  if (forPrint && autoPrint) {
    const autoPrintScript = doc.createElement('script')
    autoPrintScript.textContent = `
      const waitForPrintAssets = async () => {
        const images = Array.from(document.images || [])

        await Promise.all(images.map(image => {
          if (image.complete) {
            return Promise.resolve()
          }

          return new Promise(resolve => {
            image.addEventListener('load', resolve, { once: true })
            image.addEventListener('error', resolve, { once: true })
          })
        }))

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready
        }

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      }

      window.addEventListener('load', async () => {
        await waitForPrintAssets()
        window.focus()
        window.print()
      }, { once: true })
    `
    doc.body.appendChild(autoPrintScript)
  }

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

function getSalaMenuDate() {
  const date = new Date()

  if (salaDateMode.value === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  }

  return date
}

function formatSalaMenuDate() {
  return new Intl.DateTimeFormat(getSalaTranslation().locale, {
    day: 'numeric',
    month: 'long'
  }).format(getSalaMenuDate())
}

function formatSalaMenuFileDate() {
  return getSalaMenuIsoDate()
}

function buildSalaItemMarkup(item) {
  return `
    <div class="menu-item">
      <div class="item-info">
        <span class="item-name">${escapeHtml(item.description)}</span>
      </div>
      <span class="item-right">____&nbsp;&nbsp;____</span>
    </div>
  `
}

function buildSalaContainer({ primi, secondi, meal }) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(dailyMenuTemplate, 'text/html')
  const container = doc.querySelector('.menu-container')
  const translation = getSalaTranslation()
  const resolvedLogoUrl = resolveAssetUrl(logoUrl)

  if (!container) {
    return ''
  }

  const divider = primi.length && secondi.length ? buildDividerMarkup() : ''
  const itemsMarkup = [
    ...primi.map(buildSalaItemMarkup),
    divider,
    ...secondi.map(buildSalaItemMarkup)
  ].join('')

  container.innerHTML = `
    <div class="logo-area">
      <img src="${escapeHtml(resolvedLogoUrl)}" alt="Logo Hotel Mirafiori" />
    </div>
    <div class="camera-placeholder">${escapeHtml(translation.roomLabel)} ________</div>
    <div class="menu-section">
      <div class="section-title">${escapeHtml(formatSalaMenuDate())} - ${escapeHtml(translation.meals[meal])}</div>
      <div class="menu-item">
        <div class="item-info">
          <span class="item-name">&nbsp;</span>
        </div>
        <span class="item-right">${translation.portionLabels}</span>
      </div>
      ${itemsMarkup}
    </div>
    <div class="allergeni-legenda">
      <span class="allergeni-titolo">${escapeHtml(translation.allergensTitle)}</span>
      ${escapeHtml(translation.allergensText)}
    </div>
    <div class="footer">
      ${escapeHtml(translation.footer)}
    </div>
  `

  return container.outerHTML
}

function appendSalaStyles(doc, { forPrint, autoPrint }) {
  const extraStyles = doc.createElement('style')
  extraStyles.textContent = `
    body.preview-mode {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: flex-start;
      gap: 24px;
      padding: 18px;
      background: #edf3f6;
    }

    body.preview-mode .menu-container {
      box-shadow: 0 24px 54px rgba(79, 101, 116, 0.16);
    }

    body.print-mode {
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    body.print-mode .a4-page {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      page-break-after: always;
      break-after: page;
    }

    body.print-mode .a4-landscape-page {
      width: 297mm;
      height: 210mm;
      overflow: hidden;
      display: grid;
      grid-template-columns: repeat(2, 148mm);
      justify-content: space-between;
      align-items: start;
      background: #ffffff;
      page-break-after: always;
      break-after: page;
    }

    body.print-mode .a4-landscape-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    body.print-mode .a4-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    body.print-mode .a4-scale {
      width: 148mm;
      height: 210mm;
      transform: scale(${a4Scale});
      transform-origin: top center;
    }

    body.print-mode .menu-container {
      margin: 0;
    }

    @page {
      size: A4 landscape;
      margin: 0;
    }
  `
  doc.head.appendChild(extraStyles)

  if (forPrint && autoPrint) {
    const autoPrintScript = doc.createElement('script')
    autoPrintScript.textContent = `
      const waitForPrintAssets = async () => {
        const images = Array.from(document.images || [])

        await Promise.all(images.map(image => {
          if (image.complete) {
            return Promise.resolve()
          }

          return new Promise(resolve => {
            image.addEventListener('load', resolve, { once: true })
            image.addEventListener('error', resolve, { once: true })
          })
        }))

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready
        }

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      }

      window.addEventListener('load', async () => {
        await waitForPrintAssets()
        window.focus()
        window.print()
      }, { once: true })
    `
    doc.body.appendChild(autoPrintScript)
  }
}

function buildSalaMenuPreviewDocument({ lunchPrimi, lunchSecondi, dinnerPrimi, dinnerSecondi, forPrint, autoPrint = false }) {
  if (forPrint) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(dailyMenuTemplate, 'text/html')
    const lunch = buildSalaContainer({ primi: lunchPrimi, secondi: lunchSecondi, meal: 'lunch' })
    const dinner = buildSalaContainer({ primi: dinnerPrimi, secondi: dinnerSecondi, meal: 'dinner' })

    doc.body.className = 'print-mode'
    doc.body.innerHTML = `
      <div class="a4-landscape-page">
        ${lunch}
        ${lunch}
      </div>
      <div class="a4-landscape-page">
        ${dinner}
        ${dinner}
      </div>
    `
    appendSalaStyles(doc, { forPrint, autoPrint })

    return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(dailyMenuTemplate, 'text/html')
  const lunch = buildSalaContainer({ primi: lunchPrimi, secondi: lunchSecondi, meal: 'lunch' })
  const dinner = buildSalaContainer({ primi: dinnerPrimi, secondi: dinnerSecondi, meal: 'dinner' })

  doc.body.className = 'preview-mode'
  doc.body.innerHTML = `${lunch}${dinner}`
  appendSalaStyles(doc, { forPrint, autoPrint })

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

async function waitForFrameAssets(doc) {
  const imagePromises = Array.from(doc.images).map(image => {
    if (image.complete) {
      return Promise.resolve()
    }

    return new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true })
      image.addEventListener('error', resolve, { once: true })
    })
  })

  if (doc.fonts?.ready) {
    await doc.fonts.ready
  }

  await Promise.all(imagePromises)
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function createRenderFrame(srcdoc, options = {}) {
  return new Promise((resolve, reject) => {
    const isLandscape = options.orientation === 'landscape'
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.left = '-10000px'
    iframe.style.top = '0'
    iframe.style.width = isLandscape ? '297mm' : '210mm'
    iframe.style.height = isLandscape ? '210mm' : '297mm'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    iframe.style.background = '#ffffff'

    const cleanup = () => {
      iframe.remove()
    }

    iframe.addEventListener('load', async () => {
      try {
        const frameDocument = iframe.contentDocument
        const frameWindow = iframe.contentWindow

        if (!frameDocument || !frameWindow) {
          throw new Error('Documento di esportazione non disponibile.')
        }

        await waitForFrameAssets(frameDocument)
        resolve({ iframe, frameDocument, frameWindow, cleanup })
      } catch (error) {
        cleanup()
        reject(error)
      }
    }, { once: true })

    document.body.appendChild(iframe)
    iframe.srcdoc = srcdoc
  })
}

function buildPdfFileName() {
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')

  return `menu-extra-${activeExtraLanguage.value}-${date}.pdf`
}

function buildSalaPdfFileName() {
  return `menu-sala-${activeSalaLanguage.value}-${formatSalaMenuFileDate()}.pdf`
}

async function exportPdf() {
  if (!hasMenuItems.value || isExportingPdf.value) {
    return
  }

  isExportingPdf.value = true

  try {
    await persistPrintedSalaMenu()

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ])

    if (isSalaMenu.value) {
      const exportHtml = buildMenuDocument({
        primi: compiledPrimi.value,
        secondi: compiledSecondi.value,
        forPrint: true,
        autoPrint: false
      })

      const { frameDocument, cleanup } = await createRenderFrame(exportHtml, { orientation: 'landscape' })

      try {
        const pages = Array.from(frameDocument.querySelectorAll('.a4-landscape-page'))

        if (!pages.length) {
          throw new Error('Layout A4 orizzontale non trovato.')
        }

        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
          compress: true
        })

        for (const [index, page] of pages.entries()) {
          const canvas = await html2canvas(page, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false,
            width: page.scrollWidth,
            height: page.scrollHeight,
            windowWidth: page.scrollWidth,
            windowHeight: page.scrollHeight
          })

          if (index > 0) {
            pdf.addPage('a4', 'landscape')
          }

          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST')
        }

        pdf.save(buildSalaPdfFileName())
      } finally {
        cleanup()
      }

      return
    }

    const exportHtml = buildMenuDocument({
      primi: compiledPrimi.value,
      secondi: compiledSecondi.value,
      forPrint: true,
      autoPrint: false
    })

    const { frameDocument, cleanup } = await createRenderFrame(exportHtml, { orientation: 'landscape' })

    try {
      const page = frameDocument.querySelector('.a4-landscape-page')

      if (!page) {
        throw new Error('Layout A4 orizzontale non trovato.')
      }

      const canvas = await html2canvas(page, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width: page.scrollWidth,
        height: page.scrollHeight,
        windowWidth: page.scrollWidth,
        windowHeight: page.scrollHeight
      })

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      })

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST')
      pdf.save(buildPdfFileName())
    } finally {
      cleanup()
    }
  } catch (error) {
    console.error('Errore esportazione PDF menu del giorno:', error)
    window.alert('Errore durante l\'esportazione del PDF.')
  } finally {
    isExportingPdf.value = false
  }
}

async function printMenu() {
  if (!hasMenuItems.value) {
    return
  }

  try {
    await persistPrintedSalaMenu()

    const printHtml = buildMenuDocument({
      primi: compiledPrimi.value,
      secondi: compiledSecondi.value,
      forPrint: true,
      autoPrint: false
    })

    const { frameWindow, cleanup } = await createRenderFrame(printHtml, {
      orientation: 'landscape'
    })
    let hasCleanedUp = false

    const safeCleanup = () => {
      if (hasCleanedUp) {
        return
      }

      hasCleanedUp = true
      cleanup()
    }

    frameWindow.addEventListener('afterprint', safeCleanup, { once: true })
    window.setTimeout(safeCleanup, 1500)
    frameWindow.focus()
    frameWindow.print()
  } catch (error) {
    console.error('Errore apertura stampa menu del giorno:', error)
    window.alert('Impossibile avviare la stampa del menu.')
  }
}
</script>

<style scoped>
.daily-menu-composer {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1240px;
  margin: 0 auto;
  color: var(--ds-text);
}

.composer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tabs-nav {
  display: flex;
  width: fit-content;
  gap: 6px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.sala-options {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.tab-btn {
  border: 0;
  background: transparent;
  color: #475569;
  font: inherit;
  font-weight: 600;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.tab-btn.active {
  background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong));
  color: #fff;
}

.hidden-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.composer-title {
  margin: 0 0 0.35rem;
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.composer-subtitle {
  margin: 0;
  color: var(--ds-text-soft);
  max-width: 720px;
}

.btn-print,
.btn-pdf {
  border: 0;
  border-radius: 999px;
  padding: 0.85rem 1.35rem;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.btn-print {
  background: linear-gradient(135deg, #1d8cf2, #0f6cc8);
  box-shadow: 0 18px 34px rgba(15, 108, 200, 0.26);
}

.btn-pdf {
  background: linear-gradient(135deg, #1f7661, #155a4a);
  box-shadow: 0 18px 34px rgba(21, 90, 74, 0.24);
}

.btn-print:disabled,
.btn-pdf:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
}

.composer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.2rem;
}

.editor-card,
.preview-card {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.editor-card {
  padding: 1.25rem;
}

.preview-card {
  overflow: hidden;
}

.card-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.card-heading h3 {
  margin: 0;
  font-size: 1.05rem;
}

.card-heading span {
  color: var(--ds-text-soft);
  font-size: 0.88rem;
  font-weight: 700;
}

.card-heading-preview {
  padding: 1.2rem 1.2rem 0;
  align-items: flex-start;
}

.card-heading-preview p {
  margin: 0.25rem 0 0;
  color: var(--ds-text-soft);
  font-size: 0.9rem;
}

.menu-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 0.8rem;
}

.menu-row-sala {
  grid-template-columns: 1fr;
}

.menu-row + .menu-row {
  margin-top: 0.8rem;
}

.row-description,
.row-price {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  padding: 0.82rem 0.95rem;
  font: inherit;
  background: rgba(248, 250, 252, 0.9);
  color: var(--ds-text);
}

.row-description:focus,
.row-price:focus {
  outline: none;
  border-color: rgba(29, 140, 242, 0.42);
  box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12);
}

.helper-note {
  margin: -0.25rem 0 0;
  color: #9a6700;
  font-size: 0.92rem;
}

.preview-stage {
  padding: 1.2rem;
}

.preview-frame {
  width: 100%;
  min-height: 920px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: #edf3f6;
}

.preview-empty {
  padding: 3.2rem 1.2rem;
  text-align: center;
  color: var(--ds-text-soft);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 960px) {
  .composer-header,
  .card-heading-preview {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .composer-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .menu-row {
    grid-template-columns: 1fr;
  }

  .header-actions {
    flex-direction: column;
  }

  .btn-print,
  .btn-pdf {
    width: 100%;
  }

  .preview-frame {
    min-height: 760px;
  }
}
</style>
