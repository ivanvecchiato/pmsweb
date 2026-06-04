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

    <div class="composer-grid">
      <section class="editor-card">
        <div class="card-heading">
          <h3>Primi</h3>
          <span>{{ compiledPrimi.length }}/{{ rowCount }}</span>
        </div>

        <div v-for="(row, index) in primiRows" :key="`primo-${index}`" class="menu-row">
          <label :for="`primo-desc-${index}`" class="sr-only">Descrizione primo {{ index + 1 }}</label>
          <input
            :id="`primo-desc-${index}`"
            v-model="row.description"
            type="text"
            class="row-description"
            :placeholder="`Primo ${index + 1}`"
          />

          <label :for="`primo-price-${index}`" class="sr-only">Prezzo primo {{ index + 1 }}</label>
          <input
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
          <h3>Secondi</h3>
          <span>{{ compiledSecondi.length }}/{{ rowCount }}</span>
        </div>

        <div v-for="(row, index) in secondiRows" :key="`secondo-${index}`" class="menu-row">
          <label :for="`secondo-desc-${index}`" class="sr-only">Descrizione secondo {{ index + 1 }}</label>
          <input
            :id="`secondo-desc-${index}`"
            v-model="row.description"
            type="text"
            class="row-description"
            :placeholder="`Secondo ${index + 1}`"
          />

          <label :for="`secondo-price-${index}`" class="sr-only">Prezzo secondo {{ index + 1 }}</label>
          <input
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
import menuTemplate from '@/menu/assets/menu-hotel.html?raw'
import logoUrl from '@/menu/assets/logo.png'

const rowCount = 6
const a4Scale = (210 / 148).toFixed(4)
const storageKey = 'daily-menu-composer-data'
const previewFrame = ref(null)
const isExportingPdf = ref(false)

const createEmptyRows = () => Array.from({ length: rowCount }, () => ({ description: '', price: '' }))

const primiRows = ref(createEmptyRows())
const secondiRows = ref(createEmptyRows())

onMounted(() => {
  restoreDraft()
})

watch([primiRows, secondiRows], () => {
  persistDraft()
}, { deep: true })

const normalizeRows = rows => rows.map(row => ({
  description: row.description.trim(),
  price: row.price === '' ? '' : String(row.price).trim()
}))

const compiledPrimi = computed(() => normalizeRows(primiRows.value).filter(isCompleteRow))
const compiledSecondi = computed(() => normalizeRows(secondiRows.value).filter(isCompleteRow))

const totalCompiledRows = computed(() => compiledPrimi.value.length + compiledSecondi.value.length)
const hasMenuItems = computed(() => totalCompiledRows.value > 0)
const hasExcludedRows = computed(() => {
  const allRows = [...normalizeRows(primiRows.value), ...normalizeRows(secondiRows.value)]
  return allRows.some(row => (row.description && !row.price) || (!row.description && row.price))
})

const previewHtml = computed(() => buildMenuDocument({
  primi: compiledPrimi.value,
  secondi: compiledSecondi.value,
  forPrint: false,
  autoPrint: false
}))

function isCompleteRow(row) {
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

function persistDraft() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify({
    primi: primiRows.value,
    secondi: secondiRows.value
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
    primiRows.value = sanitizeStoredRows(parsedDraft?.primi)
    secondiRows.value = sanitizeStoredRows(parsedDraft?.secondi)
  } catch (error) {
    console.warn('Bozza menu del giorno non valida nello storage locale:', error)
    primiRows.value = createEmptyRows()
    secondiRows.value = createEmptyRows()
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

function buildSectionMarkup(title, items) {
  if (!items.length) {
    return ''
  }

  const itemsMarkup = items
    .map(item => `
      <div class="menu-item">
        <div class="item-info">
          <span class="item-name">${escapeHtml(item.description)}</span>
        </div>
        <span class="item-price">${escapeHtml(formatPrice(item.price))}</span>
      </div>
    `)
    .join('')

  return `
    <div class="menu-section">
      <div class="section-title">${escapeHtml(title)}</div>
      ${itemsMarkup}
    </div>
  `
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
  const parser = new DOMParser()
  const doc = parser.parseFromString(menuTemplate, 'text/html')
  const container = doc.querySelector('.menu-container')
  const allergens = doc.querySelector('.allergeni-legenda')?.outerHTML ?? ''
  const footer = doc.querySelector('.footer')?.outerHTML ?? ''
  const logo = doc.querySelector('.logo-area img')

  if (!container || !logo) {
    return menuTemplate
  }

  logo.src = logoUrl

  const sections = [
    buildSectionMarkup('Primi', primi),
    primi.length && secondi.length ? buildDividerMarkup() : '',
    buildSectionMarkup('Secondi', secondi)
  ].join('')

  container.innerHTML = `
    <div class="logo-area">
      <img src="${escapeHtml(logoUrl)}" alt="Logo Hotel Mirafiori" />
    </div>
    <div class="divider"></div>
    ${sections}
    ${allergens}
    ${footer}
  `

  const wrapperClass = forPrint ? 'print-mode' : 'preview-mode'
  const pageMarkup = forPrint
    ? `<div class="a4-page"><div class="a4-scale">${container.outerHTML}</div></div>`
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

    body.print-mode .a4-page {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: flex-start;
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
      size: A4 portrait;
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

function createRenderFrame(srcdoc) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.left = '-10000px'
    iframe.style.top = '0'
    iframe.style.width = '210mm'
    iframe.style.height = '297mm'
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

  return `menu-del-giorno-${date}.pdf`
}

async function exportPdf() {
  if (!hasMenuItems.value || isExportingPdf.value) {
    return
  }

  isExportingPdf.value = true

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ])

    const exportHtml = buildMenuDocument({
      primi: compiledPrimi.value,
      secondi: compiledSecondi.value,
      forPrint: true,
      autoPrint: false
    })

    const { frameDocument, cleanup } = await createRenderFrame(exportHtml)

    try {
      const page = frameDocument.querySelector('.a4-page')

      if (!page) {
        throw new Error('Layout A4 non trovato.')
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
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      })

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST')
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

  const printHtml = buildMenuDocument({
    primi: compiledPrimi.value,
    secondi: compiledSecondi.value,
    forPrint: true,
    autoPrint: false
  })

  try {
    const { frameWindow, cleanup } = await createRenderFrame(printHtml)
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