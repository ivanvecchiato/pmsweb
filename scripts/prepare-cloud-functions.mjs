import { copyFileSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = process.env.MBAR_SERVER_ROOT || resolve(root, '../../node/mbar-server')
copyFileSync(resolve(server, 'pms/utils.js'), resolve(root, 'functions/pms-utils.js'))

for (const name of ['hotel/Reservation.js', 'shared/Guest.js']) {
  mkdirSync(resolve(root, 'functions/data', dirname(name)), { recursive: true })
  copyFileSync(resolve(server, 'data', name), resolve(root, 'functions/data', name))
}

// Il renderer resta quello del server: qui vengono generati soltanto gli artefatti di deploy.
const repo = readFileSync(resolve(server, 'pms/repo.js'), 'utf8')
const payment = repo.slice(repo.indexOf('const normalizePaymentEntry ='), repo.indexOf('const normalizePaymentList ='))
const proforma = repo.slice(repo.indexOf('   async createHotelDepositProforma('), repo.indexOf('   async printHotelDepositFiscal(')).trim().replace(/,$/, '')
if (!payment || !proforma.startsWith('async createHotelDepositProforma(')) throw Error('Contratto proforma del server non riconosciuto')
writeFileSync(resolve(root, 'functions/hotelProforma.js'), `// Generato da pms/repo.js; modificare il sorgente condiviso.\nimport fs from 'node:fs';\nimport PDFDocument from 'pdfkit';\n${payment}\nexport default {\n${proforma.replace("../desktop/branding/logo-source.png", './data/logo-source.png')}\n};\n`)
copyFileSync(resolve(server, 'desktop/branding/logo-source.png'), resolve(root, 'functions/data/logo-source.png'))

const gateway = readFileSync(resolve(server, 'pms/modules/h5s-gateway.js'), 'utf8')
const mapping = gateway.slice(gateway.indexOf('function normalizeIsoDate('), gateway.indexOf('function toCachedBooking('))
if (!mapping.includes('function mapMovement(')) throw Error('Contratto mapping H5S non riconosciuto')
writeFileSync(resolve(root, 'functions/h5sMapping.js'), `// Generato dal gateway H5S condiviso.\nimport utils from './pms-utils.js';\nimport { createHash } from 'node:crypto';\nimport { normalizeDocumentIssuedBy } from './alloggiati.js';\nconst CANCELLED = -100;\n${mapping.replace('function mapMovement(movement, roomsByCode)', 'function mapMovement(movement, roomsByCode, pricingMode)').replace("configs.getConfigs('hotel')?.pricing?.mode || 'room'", 'pricingMode')}\nexport { mapMovement, normalizeRoomCode };\n`)
writeFileSync(resolve(root, 'functions/alloggiati.js'), readFileSync(resolve(server, 'pms/modules/alloggiati.js'), 'utf8').replace("'../data/alloggiati'", "'./data/alloggiati'"))
cpSync(resolve(server, 'pms/data/alloggiati'), resolve(root, 'functions/data/alloggiati'), { recursive: true })
