import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const {
  chromium
} = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const require = createRequire(new URL('../package.json', import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180';
const {
  initializeApp,
  deleteApp
} = require('firebase-admin/app');
const {
  getFirestore
} = require('firebase-admin/firestore');
const app = initializeApp({
  projectId: 'demo-pmsweb'
}, 'browser-test');
const db = getFirestore(app);
const email = `browser-${Date.now()}@example.test`;
const a = await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email,
    password: 'TestCloud123!',
    returnSecureToken: true
  })
});
const account = await a.json();
assert(a.ok);
for (const name of ['pms_hotel_reservations', 'pms_hotel_reservation_versions', 'pms_hotel_reservation_tombstones', 'pms_hotel_reservation_conflicts', 'pms_hotel_reservation_history', 'pms_room_inventory', 'pms_fiscal_jobs']) await db.recursiveDelete(db.collection(name));
const batch = db.batch();
batch.set(db.collection('pms_web_users').doc(account.localId), {
  operatorId: 2,
  name: 'Ivan test',
  role: 'admin',
  enabled: true,
  permissions: {}
});
batch.set(db.collection('pms_configs').doc('current'), {
  hotel: {
    enabled: true,
    providerType: 'local',
    pricing: {
      mode: 'room',
      ageBands: []
    }
  },
  beach: {
    enabled: false
  },
  payments: {
    hotel: [{
      id: 1,
      name: 'Bonifico',
      electronic: true
    }]
  }
});
for (const id of ['101', '102']) batch.set(db.collection('rooms').doc(id), {
  id,
  room_code: id,
  description: `Camera ${id}`,
  room_type: {
    label: 'Doppia'
  }
});
batch.set(db.collection('pms_hotel_rates').doc('1'), {
  id: 1,
  prices: [{
    roomType: 'Doppia',
    tariffa: 80
  }],
  surcharges: {
    hb: 15,
    fb: 25
  }
});
for (let day = 1; day <= 365; day++) batch.set(db.collection('pms_hotel_timetable').doc(String(day)), {
  day,
  pricelist: 1
});
await batch.commit();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});
const context = await browser.newContext({
  viewport: {
    width: 1440,
    height: 1000
  }
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
const dialogs = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', async message => {
  if (message.type() === 'error') for (const argument of message.args()) console.error(await argument.evaluate(value => value?.message || String(value)));
});
page.on('dialog', async d => {
  dialogs.push(d.message());
  await d.accept();
});
await context.route('**/*', route => {
  const u = new URL(route.request().url());
  return ['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort();
});
const apiRequests = [];
await context.route('**/api/**', route => { apiRequests.push(route.request().url()); return route.abort(); });
try {
  await page.goto('http://127.0.0.1:5178/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill('TestCloud123!');
  await page.getByRole('button', {
    name: 'Accedi',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '+ Nuova Prenotazione',
    exact: true
  }).click();
  const form = page.locator('.booking-form');
  await form.locator('select').first().selectOption('101');
  await form.getByPlaceholder('es. Mario').fill('Mario');
  await form.getByPlaceholder('es. Rossi').fill('Browser');
  await form.locator('input[type=date]').nth(0).fill('2026-10-21');
  await form.locator('input[type=date]').nth(1).fill('2026-10-24');
  await form.locator('.form-section').filter({ has: page.locator('label', { hasText: /^Adulti$/ }) }).locator('input').fill('2');
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€240');
  await db.collection('pms_hotel_rates').doc('1').update({ prices: [{ roomType: 'Doppia', tariffa: 100 }] });
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€300');
  await db.collection('pms_hotel_rates').doc('2').set({ id: 2, prices: [{ roomType: 'Doppia', tariffa: 200 }], surcharges: { hb: 15, fb: 25 } });
  const calendar = db.batch();
  for (let day = 1; day <= 365; day++) calendar.update(db.collection('pms_hotel_timetable').doc(String(day)), { pricelist: 2 });
  await calendar.commit();
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€600');
  await db.collection('pms_configs').doc('current').update({ 'hotel.pricing': { mode: 'person', thirdBedDiscountPct: 0, ageBands: [] } });
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€1200');
  await form.locator('.form-section').filter({ has: page.locator('label', { hasText: /^Adulti$/ }) }).locator('input').fill('3');
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€1800');
  await db.collection('pms_configs').doc('current').update({ 'hotel.pricing.thirdBedDiscountPct': 50 });
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€1500');
  await form.locator('.price-management-row input[type=checkbox]').check();
  await form.locator('.price-management-row input[type=number]').fill('777');
  await db.collection('pms_hotel_rates').doc('2').update({ prices: [{ roomType: 'Doppia', tariffa: 250 }] });
  await page.waitForTimeout(400);
  assert.equal(await form.locator('.price-management-row input[type=number]').inputValue(), '777');
  console.log('OK browser realtime listino, calendario, policy e sconto senza riaprire il tableau; prezzo manuale conservato');
  await form.getByPlaceholder('es. 100').fill('100');
  await form.locator('.deposit-entry-grid select').selectOption('1');
  await form.getByRole('button', { name: '+ Aggiungi Deposit', exact: true }).click();
  const popupPromise = context.waitForEvent('page');
  await form.getByRole('button', { name: 'Stampa proforma A4', exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL('blob:**');
  const pdf = await page.evaluate(async url => {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { length: bytes.length, header: String.fromCharCode(...bytes.slice(0, 5)) };
  }, popup.url());
  assert.equal(pdf.header, '%PDF-');
  assert(pdf.length > 1000);
  assert.deepEqual(apiRequests, []);
  assert.deepEqual(errors, []);
  console.log('OK browser: preventivo realtime e proforma PDF interamente client, zero richieste API/LAN/Functions');
} finally {
  await browser.close();
  await db.collection('pms_web_users').doc(account.localId).delete();
  await deleteApp(app);
}
